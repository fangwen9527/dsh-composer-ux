/**
 * 「默认终端」的宿主半：探测 → 决策 → **按会话下发** → 状态回写 → 给设置页一个查询接口。
 *
 * 为什么是"按会话下发"而不是"全局隐藏 pwsh"：官方 `tools.restrict()` 在**全局上下文会直接抛错**
 * （`packages/core/tools/src/index.ts:1077`，原文：a context-global restriction would mask every agent
 * — deny the tool for the intended agent instead）。所以正确做法只有一条：在该 agent 自己的 scope 里
 * restrict。为了让"改完设置立刻生效"，这里在设置变化时**遍历所有在跑 agent** 重新下发 —— 这正是
 * 官方 fixture 的写法（`packages/subagent/.../scoped-tool-subagent.ts`：`ctx.on('agent/created')`
 * + `for (const agent of ctx.agents.list()) install(agent)`）。
 *
 * 为什么不必再写 `system-prompt/assemble` 过滤器：工具注册表**自己**把 schema 喂给提示词
 * （`packages/core/tools/src/index.ts:834` → `systemPrompt.tools(context => this.wireSchemas(context.scope))`），
 * 而 `wireSchemas(scope)` 取的是"可见（已过滤）"的 schema —— 所以 deny 会同时从**可调用注册表**
 * 与**提示词工具列表**里消失。
 *
 * 失败一律"只降级、不伤会话"（A 的做法）：restrict 失败（例如该 agent 本来就看不到 pwsh）
 * 只记一行原因；register 失败只记原因；两种情况都不抛、不 veto 别的插件。
 */
import { existsSync, readdirSync } from 'node:fs'
import { isAbsolute, sep } from 'node:path'
import type { DiscoverResult } from './discover.ts'
import {
  TERMINAL_BASH_PATH_FIELD, TERMINAL_CANDIDATES_FIELD, TERMINAL_EFFECTIVE_FIELD,
  TERMINAL_MODE_FIELD, TERMINAL_STATUS_FIELD, activeBashPath, candidatesToStored, probeBash,
  sanitizeTerminalCandidates, terminalModeFrom, terminalStatusText,
  type TerminalCandidate, type TerminalMode,
} from './contracts.ts'
import { BASH_SECTION_TEXT, TOOL_BASH_SECTION_ORDER, TOOL_PWSH_SECTION_ORDER, createBashTool } from './tool.ts'
import type { BashToolDeps, ToolDefinitionLike } from './tool.ts'
import { TERMINAL_ENABLED_FIELD, sectionEnabledOf } from '../settings-contract.ts'

/**
 * 这一栏没启用（或总开关关着）时写进状态行的那句话。
 *
 * 写状态行而不是什么都不写：设置页那行只读文字是用户判断"到底生效了没"的唯一依据，
 * 留空会被读成"还没探测"。
 */
export const TERMINAL_OFF_TEXT = '未启用：打开这一栏的开关后才会接管（现在保持 PowerShell）'

/** 宿主半用到的 settings 能力（与 src/host.ts 同一套结构窄化）。 */
export interface SettingsLike {
  get(ns: string): unknown
  mutate(ns: string, ops: readonly (
    | { op: 'set'; path: readonly string[]; value: unknown }
    | { op: 'unset'; path: readonly string[] }
  )[]): Promise<void>
}

/** 工具面（只取本插件用得到的两件事）。 */
interface ToolServiceLike {
  register(definition: unknown): (() => void) | undefined
  restrict(filter: { deny?: readonly string[]; allow?: readonly string[] }): (() => void) | undefined
}

/** 提示词面。 */
interface PromptServiceLike {
  section(section: { name: string; order: number; text: string }): (() => void) | undefined
}

/** agent 自己 scope 上的上下文（官方模板 `const scoped = agent.ctx` 直接取）。 */
interface ScopedLike {
  readonly tools?: ToolServiceLike
  readonly systemPrompt?: PromptServiceLike
  /** 作用域事件：注册在 agent.ctx 上的 `system-prompt/assemble` 只收到该 agent 的装配。 */
  on?(event: string, listener: (...args: never[]) => unknown): (() => void) | undefined
}

/** 一个活着的 agent（只取本插件用得到的部分）。 */
interface AgentLike {
  readonly ctx: ScopedLike
}

interface AgentsLike {
  list(): readonly AgentLike[]
}

/** 宿主半需要的服务集合。 */
interface CtxLike {
  get(name: string): unknown
  /** 事件接线；真实 cordis 上下文一定有，测试替身可能没有（没有时降级并在状态行说明）。 */
  on?(event: string, listener: (...args: never[]) => void): unknown
  inject?(deps: string[], callback: (ctx: CtxLike) => void): unknown
  effect?(callback: () => unknown, label?: string): unknown
  webServer: {
    register(route: { kind: 'exact' | 'prefix'; path: string; handler: unknown }): () => void
  }
}

/** 每个 agent 的下发记账。 */
interface Installed {
  readonly path: string
  readonly dispose: () => void
  /** 下发时遇到的问题（第一条），用于状态行如实说明。 */
  readonly failure?: string
}

/** 取普通对象。 */
function objectOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

/** 取字符串。 */
function textOf(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** 错误 → 一行。 */
function errorText(error: unknown): string {
  return error instanceof Error && error.message !== '' ? error.message : String(error)
}

/**
 * 装上「默认终端」子系统。
 *
 * @param ctx 宿主半上下文（组合层）。
 * @param namespace 本插件的 settings 命名空间。
 * @param settings settings 服务（缺席时只挂状态路由，不接管终端）。
 * @param readToolDeps 采集工具运行所需的宿主服务；`subprocess` 缺席时返回 undefined（降级为只压制 pwsh）。
 */
export function installTerminalPolicy(
  ctx: CtxLike,
  namespace: string,
  settings: SettingsLike | undefined,
  readToolDeps: () => BashToolDeps | undefined,
  options: {
    /** 平台（默认 process.platform；测试用来走非 Windows 分支）。 */
    readonly platform?: string
    /** 探测（默认读真实 PATH 与文件系统；测试注入假结果）。 */
    readonly discover?: (explicitPath: string) => DiscoverResult
    /** 存在性判定（默认 existsSync）。 */
    readonly exists?: (path: string) => boolean
  } = {},
): void {
  const platform = options.platform ?? process.platform
  const isWindows = platform === 'win32'
  const existsFn = options.exists ?? existsSync
  const installed = new Map<AgentLike, Installed>()
  let lastStatus = ''
  let lastEffective = ''
  let lastCandidates = ''
  let failure = ''
  let busy = false
  let again = false

  /** 走一遍探测（唯一碰 node API 的地方都在这里）。 */
  const discover = options.discover ?? ((explicitPath: string): DiscoverResult => probeBash(
    explicitPath,
    process.env.PATH ?? '',
    name => process.env[name],
    path => existsFn(path),
    // 只读子目录名（带版本号的来源：GitHub Desktop 的 app-*、旧 GitHub 的 PortableGit_*、VS 的年份/版本）；
    // 目录不存在或没权限一律当空，探测就退化成纯存在性检查。
    parent => {
      try {
        return readdirSync(parent, { withFileTypes: true })
          .filter(entry => entry.isDirectory())
          .map(entry => entry.name)
      } catch {
        return []
      }
    },
  ))

  /**
   * 在一个 agent 自己的 scope 里下发：压制 pwsh + 注册 bash + 换提示词段。
   * @param agent 目标 agent。
   * @param bashPath 这一轮生效的 bash 路径（换路径时会重新下发）。
   * @returns 记账；拿不到 scoped 服务时返回 undefined。
   */
  const install = (agent: AgentLike, bashPath: string): Installed | undefined => {
    const scoped: ScopedLike = agent.ctx
    const cleanups: (() => void)[] = []
    const notes: string[] = []

    // 1) 压掉预设的 pwsh。名字必须已在全局注册表里，否则官方会抛
    //    `names unknown global tool "pwsh"` —— 那种情况说明该 agent 本来就看不到 pwsh，
    //    记一行原因跳过即可（A 的日志里也是这么处理的）。
    try {
      const lift = scoped.tools?.restrict({ deny: ['pwsh'] })
      if (typeof lift === 'function') cleanups.push(lift)
    } catch (error: unknown) {
      notes.push(`restrict(pwsh) 跳过：${errorText(error)}`)
    }

    // 2) 注册 bash 工具。注册在**该 agent 自己的 scope**：restrict 只作用于全局工具，
    //    不会隐藏自身注册（官方 view() 的语义）。
    try {
      const deps = readToolDeps()
      if (deps === undefined) {
        notes.push('宿主没有 subprocess 服务，无法注册 bash')
      } else {
        const definition = createBashTool(deps, { bashPath, sep, isAbsolute })
        const unregister = scoped.tools?.register(definition as ToolDefinitionLike)
        if (typeof unregister === 'function') cleanups.push(unregister)
      }
    } catch (error: unknown) {
      notes.push(`注册 bash 失败：${errorText(error)}`)
    }

    // 3) 提示词：加 bash 的那句（官方 `tool:bash` 段），并在**本 scope 的装配**里
    //    摘掉预设的 `tool:pwsh` 段。用瀑布而不是"注册空同名段"：官方明确
    //    「段名唯一、重复注册会抛」，而按名字过滤 sections 是官方现成做法
    //    （`browser-use-runtime` 的 mcp.ts 就是这么摘掉自己那段）。
    try {
      const bashSection = scoped.systemPrompt?.section({
        name: 'tool:bash', order: TOOL_BASH_SECTION_ORDER, text: BASH_SECTION_TEXT,
      })
      if (typeof bashSection === 'function') cleanups.push(bashSection)
      const dropPwsh = scoped.on?.('system-prompt/assemble', (async (
        _assembly: unknown, _context: unknown, next: () => Promise<{ sections: { name: string }[] }>,
      ) => {
        const assembly = await next()
        return { ...assembly, sections: assembly.sections.filter(section => section.name !== 'tool:pwsh') }
      }) as never)
      if (typeof dropPwsh === 'function') cleanups.push(dropPwsh)
    } catch (error: unknown) {
      notes.push(`提示词段失败：${errorText(error)}`)
    }

    return {
      path: bashPath,
      dispose: () => {
        for (const cleanup of [...cleanups].reverse()) {
          try { cleanup() } catch { /* 已随 agent 释放 */ }
        }
      },
      ...(notes.length === 0 ? {} : { failure: notes.join('；') }),
    }
  }

  /** 按当前设置重新下发（幂等；只有真的变化才动）。 */
  const reconcile = (): void => {
    if (busy) {
      again = true
      return
    }
    busy = true
    void (async () => {
      const row = settings === undefined ? undefined : objectOf(settings.get(namespace))
      const mode = terminalModeFrom(row?.[TERMINAL_MODE_FIELD])
      const explicit = textOf(row?.[TERMINAL_BASH_PATH_FIELD])
      const agents = (ctx.get('agents') as AgentsLike | undefined)
      const ops: { op: 'set'; path: readonly string[]; value: unknown }[] = []
      // 总闸 + 这一栏的开关：`enabled`（缺省视为开）与「默认终端」栏开关都为真才接管。
      const sectionOn = row?.['enabled'] !== false && sectionEnabledOf(TERMINAL_ENABLED_FIELD, row ?? {})

      if (!isWindows) {
        // 非 Windows：不接管（官方 bash 工具本来就在），只如实回报。
        for (const entry of installed.values()) entry.dispose()
        installed.clear()
        failure = ''
        writeState(ops, {
          status: terminalStatusText({ platform, mode, candidates: [], excludedCount: 0, effective: 'unsupported' }),
          effective: 'unsupported',
          candidates: [],
        })
        await flush(ops)
        return
      }

      if (!sectionOn) {
        // 这一栏（或总开关）关着：一律不接管，并把原因写进状态行。
        // 候选也清空：没接管时列一堆路径只会让人以为已经生效了。
        for (const entry of installed.values()) entry.dispose()
        installed.clear()
        failure = ''
        writeState(ops, { status: TERMINAL_OFF_TEXT, effective: 'pwsh', candidates: [] })
        await flush(ops)
        return
      }

      const found = discover(explicit)
      const candidates = candidatesToStored(found.candidates)
      const bashPath = activeBashPath(mode, explicit, candidates, found.explicit)
      const usable = bashPath !== '' && existsFn(bashPath)

      if (usable) {
        for (const agent of agents?.list() ?? []) {
          const current = installed.get(agent)
          if (current !== undefined && current.path === bashPath) continue
          if (current !== undefined) {
            current.dispose()
            installed.delete(agent)
          }
          const record = install(agent, bashPath)
          if (record !== undefined) installed.set(agent, record)
        }
      } else {
        for (const entry of installed.values()) entry.dispose()
        installed.clear()
        failure = ''
      }

      const firstFailure = [...installed.values()].find(entry => entry.failure !== undefined)?.failure
      writeState(ops, {
        status: terminalStatusText({
          platform,
          mode,
          candidates,
          excludedCount: found.excluded.length,
          ...(found.explicit === undefined ? {} : { explicit: found.explicit }),
          effective: usable ? 'bash' : 'pwsh',
          ...(usable ? { effectivePath: bashPath } : {}),
          ...(firstFailure === undefined && failure === '' ? {} : { failure: firstFailure ?? failure }),
        }),
        effective: usable ? 'bash' : 'pwsh',
        candidates,
      })
      await flush(ops)
    })()
      .catch((error: unknown) => {
        console.error('[composer-ux] 终端策略下发失败', error)
      })
      .finally(() => {
        busy = false
        if (again) {
          again = false
          reconcile()
        }
      })
  }

  /** 只在真的变化时写状态字段（避免自触发回环）。 */
  const writeState = (
    ops: { op: 'set'; path: readonly string[]; value: unknown }[],
    next: { status: string; effective: string; candidates: readonly TerminalCandidate[] },
  ): void => {
    const candidatesJson = JSON.stringify(next.candidates)
    if (next.status !== lastStatus) {
      lastStatus = next.status
      ops.push({ op: 'set', path: [TERMINAL_STATUS_FIELD], value: next.status })
    }
    if (next.effective !== lastEffective) {
      lastEffective = next.effective
      ops.push({ op: 'set', path: [TERMINAL_EFFECTIVE_FIELD], value: next.effective })
    }
    if (candidatesJson !== lastCandidates) {
      lastCandidates = candidatesJson
      ops.push({ op: 'set', path: [TERMINAL_CANDIDATES_FIELD], value: next.candidates })
    }
  }

  /** 落盘（values 为空时什么都不做）。 */
  const flush = async (ops: readonly { op: 'set'; path: readonly string[]; value: unknown }[]): Promise<void> => {
    if (ops.length === 0 || settings === undefined) return
    try {
      await settings.mutate(namespace, ops)
    } catch (error: unknown) {
      console.error('[composer-ux] 终端状态写入失败', error)
    }
  }

  // ── 事件接线 ──────────────────────────────────────────────────────────────
  // 新会话（agent 创建）立刻下发；agent 释放时清记账（它 scope 里的东西随之释放）。
  // 没有事件能力的上下文（测试替身）不算致命，但**必须让用户看见**：状态行会写明。
  if (typeof ctx.on !== 'function') {
    failure = '上下文不支持事件，无法在会话创建时下发'
  }
  ctx.on?.('agent/created', (() => { reconcile() }) as never)
  ctx.on?.('agent/disposed', ((payload: { agent?: AgentLike }) => {
    if (payload?.agent !== undefined) installed.delete(payload.agent)
  }) as never)
  if (settings !== undefined) ctx.on?.('settings/updated', (() => { reconcile() }) as never)

  // ── 设置页的查询/发现接口 ─────────────────────────────────────────────────
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/composer-ux/terminal',
    handler: async (req: { method?: string }, res: {
      statusCode?: number
      writeHead: (code: number, headers: Record<string, string>) => void
      end: (body?: string) => void
    }): Promise<void> => {
      const send = (code: number, payload: unknown): void => {
        res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify(payload))
      }
      // 官方每条路由都先过这一道：本机的 webServer 绑在 0.0.0.0（用户还会从中继远程访问），
      // 而这条接口会回传本地 bash 路径，不设防等于把本机目录结构透出去。
      const connection = ctx.get('connection') as
        { requestRejection?: (request: unknown) => number | undefined } | undefined
      const rejection = connection?.requestRejection?.(req)
      if (rejection !== undefined) {
        res.statusCode = rejection
        res.end()
        return
      }
      const method = (req.method ?? 'GET').toUpperCase()
      const row = settings === undefined ? undefined : objectOf(settings.get(namespace))
      const mode = terminalModeFrom(row?.[TERMINAL_MODE_FIELD])
      const explicit = textOf(row?.[TERMINAL_BASH_PATH_FIELD])
      if (method === 'POST') {
        // 「自动发现」：重新探测一次并即时回传（写盘由 reconcile 完成）。
        reconcile()
        const found = discover(explicit)
        send(200, {
          ok: true,
          candidates: candidatesToStored(found.candidates),
          excluded: found.excluded,
          ...(found.explicit === undefined ? {} : { explicit: found.explicit }),
        })
        return
      }
      const found = discover(explicit)
      send(200, {
        ok: true,
        platform,
        supported: isWindows,
        mode,
        bashPath: explicit,
        effective: lastEffective === '' ? 'pwsh' : lastEffective,
        status: lastStatus,
        candidates: isWindows ? candidatesToStored(found.candidates) : [],
        excluded: found.excluded,
      })
    },
  }), 'composer-ux: terminal status route')

  // 启动即对齐一次（与 settings 文档里的现状一致为止）。
  reconcile()
  // 供外部（settings 变化的兜底路径）主动触发一次。
  return
}

/** 读一份宿主半自持的候选（测试与界面共用同一套净化）。 */
export function storedCandidates(row: unknown): readonly TerminalCandidate[] {
  return sanitizeTerminalCandidates(objectOf(row)?.[TERMINAL_CANDIDATES_FIELD])
}

/** 读档位（测试用）。 */
export function storedMode(row: unknown): TerminalMode {
  return terminalModeFrom(objectOf(row)?.[TERMINAL_MODE_FIELD])
}
