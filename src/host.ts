/**
 * Host half。两件事：
 *
 *  1. 当 settings 服务存在时，为浏览器侧注册「composer-ux」设置区（schema）；
 *  2. 把设置页的「OpenCode 请求头」镜像进 llm-pi-ai 的 provider profile。
 *     引擎/菜单行为仍全部由 client 半实现。
 *
 * 为什么请求头必须落在宿主半：出网请求由宿主的模型适配器发出，浏览器侧碰不到。
 * 而 DSH 里唯一受支持的请求头入口就是 llm-pi-ai 的 `providers.<route>.headers`
 * —— 它作为 pi-ai 的 optionsHeaders 在最后合并（能覆盖默认头），且该适配器每次
 * 请求都重读配置，所以「改完下一次请求即生效、不用重启」。
 *
 * 写入方式用 `settings.mutate` 的路径寻址：只动我们自己那一个键，
 * 既不重述也不删除用户写在同一个 profile 里的其它字段。
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import inspector from 'node:inspector'
import {
  DEFAULT_HEADER_NAME, DEFAULT_QUICK_PROMPTS, DEFAULT_SETTINGS, ENABLED_FIELD,
  KEYS_ENABLED_FIELD, MENU_ENABLED_FIELD, PANEL_ENABLED_FIELD, QUICK_ENABLED_FIELD,
  TERMINAL_ENABLED_FIELD,
  HEADER_APPLIED_NAME_FIELD,
  HEADER_APPLIED_VALUE_FIELD, HEADER_ENABLED_FIELD, HEADER_NAME_FIELD, HEADER_NAME_MAX,
  HEADER_ROUTES_FIELD, HEADER_STATUS_FIELD, HEADER_VALUE_FIELD, HEADER_VALUE_MAX,
  LLM_NAMESPACE, MENU_FIELDS, MENU_MODE_FIELD, MENU_NATIVE_FIELD, NAMESPACE, NEWLINE_KEY_FIELD,
  OPENCODE_HOSTS, OPENCODE_ROUTE_PREFIX, OPTIMIZE_OUTPUT_MAX, OPTIMIZE_TEXT_MAX,
  OPTIMIZER_API_PATH, OPTIMIZER_TIER_FIELD, PANEL_HEIGHT_FIELD, PANEL_RESIZE_FIELD,
  PANEL_SCROLL_FIELD, PANEL_WIDTH_FIELD, QUICK_PROMPTS_API_PATH, QUICK_PROMPTS_FIELD,
  RESTART_API_PATH,
  SEND_KEY_FIELD, defaultQuickBook, newSessionId, parseRouteList, sanitizeBook, DEFAULT_OPTIMIZER_TIER,
  type QuickPromptBook,
} from './settings-contract.ts'
import {
  TERMINAL_BASH_PATH_FIELD, TERMINAL_CANDIDATES_FIELD, TERMINAL_EFFECTIVE_FIELD,
  TERMINAL_MODE_FIELD, TERMINAL_STATUS_FIELD,
} from './terminal/contracts.ts'
import { installTerminalPolicy } from './terminal/host.ts'
import type { BashToolDeps } from './terminal/tool.ts'
import {
  RESTART_LOG_PREFIX, bootId, detectedDebugger, detectedSupervisor, gracefulStop, planRestart,
  scheduleRestart, servingPort, trustedRestartRequest,
} from './restart.ts'
import type { RestartIo } from './restart.ts'
import { buildOptimizeSystem, buildOptimizeTemperature, buildOptimizeUser } from './optimizer-prompt.ts'
import { ensureQuickBook, quickStorePath, readQuickBook, writeQuickBook } from './quick-store.ts'

export const name = 'composer-ux'

/** 设置面板可调尺寸的上下限（与 client 侧的 clamp 保持一致）。 */
const PANEL_MIN = 560
const PANEL_MAX = 4000

/** 路径寻址写入：与 settings 服务的 SettingsPathOp 结构一致。 */
type PathOp =
  | { op: 'set'; path: readonly string[]; value: unknown }
  | { op: 'unset'; path: readonly string[] }

/** 本插件用到的 settings 能力（保持结构最小，避免依赖具体实现类）。 */
interface SettingsLike {
  get(ns: string): unknown
  mutate(ns: string, ops: readonly PathOp[]): Promise<void>
}

/** 收窄成普通对象（数组与 null 都不算）。 */
function objectOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

/** 只接受字符串，其余一律视为空串。 */
function textOf(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** 取头值的第一个（Node 对重复头会给出数组）。 */
function firstHeaderValue(value: string | readonly string[] | undefined): string | undefined {
  if (value === undefined) return undefined
  return typeof value === 'string' ? value : value[0]
}

/**
 * 书本里有没有"非内置"的内容 —— 「快捷指令」栏迁移的判据（见 apply 里那段说明）。
 * @param book 读到的书本。
 * @returns 与内置默认本不同则为 true。
 */
function bookLooksCustom(book: QuickPromptBook): boolean {
  return JSON.stringify(sanitizeBook(book)) !== JSON.stringify(defaultQuickBook())
}

/** 头名是否合法：与 llm-pi-ai 的 assertValidHeaders 同规则（Fetch 接受才算）。 */
function nameIsValid(name: string): boolean {
  if (name === '' || name.length > HEADER_NAME_MAX) return false
  try {
    new Headers([[name, 'probe']])
    return true
  } catch {
    return false
  }
}

/** 头值是否合法：非空、不超长、单行且可表示为字节（Fetch 接受才算）。 */
function valueIsValid(value: string): boolean {
  if (value === '' || value.length > HEADER_VALUE_MAX) return false
  try {
    new Headers([['x-dsh-probe', value]])
    return true
  } catch {
    return false
  }
}

/**
 * provider 的 baseURL 是否指向 OpenCode（含子域）。
 * 用户自建路由的名字可以是任意字符串（例如 `go`），端点却仍是 OpenCode，
 * 所以「按 URL 认」比「按名字认」可靠；URL 解析失败时退回子串判断。
 */
function isOpencodeBaseUrl(value: unknown): boolean {
  const raw = textOf(value).trim()
  if (raw === '') return false
  let host = ''
  try {
    host = new URL(raw).hostname.toLowerCase()
  } catch {
    return raw.toLowerCase().includes('opencode.ai')
  }
  return OPENCODE_HOSTS.some(name => host === name || host.endsWith(`.${name}`))
}

/**
 * 本次要写的目标路由。
 * 显式名单只保留 llm-pi-ai 里**已存在**的路由——profile 的 `models` 是必填项，
 * 凭空造一个只有 headers 的 profile 会让整份配置校验失败。
 * 留空时的自动匹配：路由名以 `opencode` 开头（内置 `opencode-go` 走这条，它的
 * baseURL 由 pi-ai 目录内置、配置里没有），**或**该路由的 `baseURL` 指向 opencode.ai
 * （自建路由常起别名，按 URL 认更准）。
 * @param providers - llm-pi-ai 当前的 providers 字典。
 * @param listed - 设置里的「作用路由」名单（留空表示自动匹配）。
 * @returns 目标路由名，顺序跟随 providers 的键顺序。
 */
function pickRoutes(
  providers: Record<string, unknown>,
  listed: readonly string[],
): readonly string[] {
  const keys = Object.keys(providers)
  if (listed.length === 0) {
    return keys.filter(key => key.startsWith(OPENCODE_ROUTE_PREFIX)
      || isOpencodeBaseUrl(objectOf(providers[key])?.baseURL))
  }
  return listed.filter(key => Object.prototype.hasOwnProperty.call(providers, key))
}

/** 错误转一行可读文本（写进 headerStatus，供设置页展示）。 */
function errorText(error: unknown): string {
  if (error instanceof Error && error.message !== '') return error.message
  return String(error)
}

/**
 * 把「请求头」栏目对齐到 llm-pi-ai 配置。幂等：算出的目标与现状一致时不写任何东西，
 * 因此本函数既可在插件启动时跑一次，也可在每次 settings 变更后被反复调用。
 * @param settings - settings 服务。
 */
async function mirrorHeader(settings: SettingsLike): Promise<void> {
  const own = objectOf(settings.get(NAMESPACE))
  if (own === undefined) return

  const enabled = own[ENABLED_FIELD] === true && own[HEADER_ENABLED_FIELD] === true
  const name = textOf(own[HEADER_NAME_FIELD])
  const nameOk = nameIsValid(name)
  const routesText = parseRouteList(textOf(own[HEADER_ROUTES_FIELD]))

  // 首次启用且值为空：生成一个稳定 ID 并落盘，此后每次都用同一个。
  let value = textOf(own[HEADER_VALUE_FIELD])
  if (enabled && nameOk && value === '') {
    value = newSessionId()
    await settings.mutate(NAMESPACE, [{ op: 'set', path: [HEADER_VALUE_FIELD], value }])
  }

  const llm = objectOf(settings.get(LLM_NAMESPACE))
  const providers = llm === undefined ? undefined : objectOf(llm.providers)

  const writes: PathOp[] = []
  const applied: string[] = []
  let status = ''

  if (!enabled) {
    status = ''
  } else if (providers === undefined) {
    status = '未挂载 llm-pi-ai（模型路由）设置，暂未写入'
  } else if (!nameOk) {
    status = '头名不合法，未写入'
  } else if (!valueIsValid(value)) {
    status = `头值不合法（需 1–${HEADER_VALUE_MAX} 字符且单行），未写入`
  } else {
    for (const route of pickRoutes(providers, routesText)) {
      const headers = objectOf(objectOf(providers[route])?.headers)
      if (headers?.[name] !== value) {
        writes.push({ op: 'set', path: ['providers', route, 'headers', name], value })
      }
      applied.push(route)
    }
    status = applied.length === 0
      ? `已启用，但没有可写入的路由（目标：${routesText.length === 0 ? `自动（名字以 ${OPENCODE_ROUTE_PREFIX} 开头，或 baseURL 指向 opencode.ai）` : routesText.join('、')}）`
      : `已写入 ${applied.join('、')}`
  }

  // 撤销：上次写入过、这次不再是目标的位置（停用、改名、值被换、路由被移除）。
  // 只删「确实是我们写的」：值必须等于当前配置值或记账值，否则视为用户自己写的，不碰。
  const stale: PathOp[] = []
  if (providers !== undefined) {
    const previousName = textOf(own[HEADER_APPLIED_NAME_FIELD])
    const previousValue = textOf(own[HEADER_APPLIED_VALUE_FIELD])
    const ours = new Set([textOf(own[HEADER_VALUE_FIELD]), previousValue])
    ours.delete('')
    // 本轮的目标键（哪怕值已经对、不需要写）——它们绝不能被当成过期项撤销。
    const targets = new Set(applied.map(route => `${route}\u0000${name}`))
    const candidates = new Set([previousName, nameOk ? name : ''])
    candidates.delete('')
    for (const candidate of candidates) {
      for (const [route, profile] of Object.entries(providers)) {
        if (targets.has(`${route}\u0000${candidate}`)) continue
        const headers = objectOf(objectOf(profile)?.headers)
        const current = headers?.[candidate]
        if (typeof current !== 'string' || !ours.has(current)) continue
        stale.push({ op: 'unset', path: ['providers', route, 'headers', candidate] })
      }
    }
  }

  const providerOps = [...writes, ...stale]
  let failed = false
  if (providerOps.length > 0) {
    try {
      await settings.mutate(LLM_NAMESPACE, providerOps)
    } catch (error: unknown) {
      failed = true
      status = `写入失败：${errorText(error)}`
    }
  }

  // 记账 + 状态回写：只有真正写成功才记账，且值不变时不写（保证幂等、不产生回环）。
  const nextAppliedName = !failed && applied.length > 0 ? name : ''
  const nextAppliedValue = !failed && applied.length > 0 ? value : ''
  const ownOps: PathOp[] = []
  if (textOf(own[HEADER_APPLIED_NAME_FIELD]) !== nextAppliedName) {
    ownOps.push({ op: 'set', path: [HEADER_APPLIED_NAME_FIELD], value: nextAppliedName })
  }
  if (textOf(own[HEADER_APPLIED_VALUE_FIELD]) !== nextAppliedValue) {
    ownOps.push({ op: 'set', path: [HEADER_APPLIED_VALUE_FIELD], value: nextAppliedValue })
  }
  if (textOf(own[HEADER_STATUS_FIELD]) !== status) {
    ownOps.push({ op: 'set', path: [HEADER_STATUS_FIELD], value: status })
  }
  if (ownOps.length > 0) await settings.mutate(NAMESPACE, ownOps)
}

/** 注册 durable section；settings 服务缺席（无 provider）时静默跳过。 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(
      NAMESPACE,
      z.object({
        [ENABLED_FIELD]: z.boolean().default(DEFAULT_SETTINGS.enabled),
        // 五栏开关。**故意不给默认值、声明成可选**：迁移要用的信息就是"文档里有没有这个键"
        // —— 没有 ⇒ 从没碰过这一栏 ⇒ 关闭；有 ⇒ 用户碰过 ⇒ 保持他写下的值。
        // 给了静态默认值就再也分不出这两种情况了（净化的 sectionEnabledOf 靠它）。
        [KEYS_ENABLED_FIELD]: z.boolean().required(false),
        [MENU_ENABLED_FIELD]: z.boolean().required(false),
        [QUICK_ENABLED_FIELD]: z.boolean().required(false),
        [PANEL_ENABLED_FIELD]: z.boolean().required(false),
        [TERMINAL_ENABLED_FIELD]: z.boolean().required(false),
        [SEND_KEY_FIELD]: z.string().default(DEFAULT_SETTINGS.sendKey),
        [NEWLINE_KEY_FIELD]: z.string().default(DEFAULT_SETTINGS.newlineKey),
        ...Object.fromEntries(MENU_FIELDS.map(field => [
          field,
          z.boolean().default(DEFAULT_SETTINGS[field]),
        ])),
        // 右键菜单模式（0.5.0 起三档）。**故意不给默认值、且声明成可选**：
        // 「文档里没有这个键」本身就是迁移要用的信息——净化据此按旧布尔 menuNative
        // 推断（见 menuModeFrom）。给了默认值就再也分不出「从没设置过」与「明确设成了它」。
        [MENU_MODE_FIELD]: z.string().required(false),
        // 旧的布尔字段：只作迁移线索，故同样不给默认值——旧文档里的 true / false
        // 都要保住原意（true = 浏览器菜单、false = 明确选过自定义菜单）。
        [MENU_NATIVE_FIELD]: z.boolean().required(false),
        [PANEL_SCROLL_FIELD]: z.boolean().default(DEFAULT_SETTINGS.panelScroll),
        [PANEL_RESIZE_FIELD]: z.boolean().default(DEFAULT_SETTINGS.panelResize),
        // schemastery 无 .optional()：可选键用 .required(false)。
        [PANEL_WIDTH_FIELD]: z.number().min(PANEL_MIN).max(PANEL_MAX).required(false),
        [PANEL_HEIGHT_FIELD]: z.number().min(320).max(PANEL_MAX).required(false),
        // OpenCode 请求头栏目（值由宿主半按 llm-pi-ai 的 Fetch 规则自校验后再写入）。
        [HEADER_ENABLED_FIELD]: z.boolean().default(DEFAULT_SETTINGS.headerEnabled),
        [HEADER_NAME_FIELD]: z.string().default(DEFAULT_HEADER_NAME),
        [HEADER_VALUE_FIELD]: z.string().default(DEFAULT_SETTINGS.headerValue),
        [HEADER_ROUTES_FIELD]: z.string().default(DEFAULT_SETTINGS.headerRoutes),
        [HEADER_APPLIED_NAME_FIELD]: z.string().default(DEFAULT_SETTINGS.headerAppliedName),
        [HEADER_APPLIED_VALUE_FIELD]: z.string().default(DEFAULT_SETTINGS.headerAppliedValue),
        [HEADER_STATUS_FIELD]: z.string().default(DEFAULT_SETTINGS.headerStatus),
        // 快捷指令列表：结构固定为 {id,label,prompt,always}，逐条自带默认值，
        // 让旧设置文档（没有这个键）在读取时直接得到内置 9 条。
        [QUICK_PROMPTS_FIELD]: z.array(z.object({
          id: z.string().default(''),
          label: z.string().default(''),
          prompt: z.string().default(''),
          always: z.boolean().default(false),
        })).default(DEFAULT_QUICK_PROMPTS.map(item => ({ ...item }))),
        [OPTIMIZER_TIER_FIELD]: z.string().default(DEFAULT_SETTINGS.optimizerTier),
        // 「默认终端」（0.5.0 起）：用户档位与可选路径。
        [TERMINAL_MODE_FIELD]: z.string().default(DEFAULT_SETTINGS.terminalMode),
        [TERMINAL_BASH_PATH_FIELD]: z.string().default(DEFAULT_SETTINGS.terminalBashPath),
        // 宿主半自持的三项：探测候选、状态行、当前生效 shell（见 HOST_OWNED_FIELDS）。
        [TERMINAL_CANDIDATES_FIELD]: z.array(z.object({
          path: z.string().default(''),
          label: z.string().default(''),
          kind: z.string().default('path'),
          explicit: z.boolean().default(false),
        })).default([]),
        [TERMINAL_STATUS_FIELD]: z.string().default(DEFAULT_SETTINGS.terminalStatus),
        [TERMINAL_EFFECTIVE_FIELD]: z.string().default(DEFAULT_SETTINGS.terminalEffective),
      }),
    )

    const settings = settingsCtx.settings as unknown as SettingsLike
    // 串行化：本插件自己的写入也会再触发 settings/updated，用 busy/again 保证
    // 一次只跑一轮镜像，且不漏掉期间到达的变更。
    let busy = false
    let again = false
    const sync = (): void => {
      if (busy) {
        again = true
        return
      }
      busy = true
      void mirrorHeader(settings)
        .catch((error: unknown) => {
          console.error('[composer-ux] 请求头镜像失败', error)
        })
        .finally(() => {
          busy = false
          if (again) {
            again = false
            sync()
          }
        })
    }

    const onSettingsUpdated = (ns: unknown): void => {
      if (ns === NAMESPACE || ns === LLM_NAMESPACE) sync()
    }
    ctx.on('settings/updated' as never, onSettingsUpdated as never)
    // 启动即对齐一次：启用状态下的头即使在别处被抹掉，也会在此补回。
    sync()
  })

  // ── 提示词优化接口 ────────────────────────────────────────────────────────
  //
  // 为什么必须在宿主半：出网请求由宿主的模型适配器发出，浏览器侧碰不到模型路由。
  // 所以「优化提示词」是一次「浏览器 POST 原文 -> 宿主独立跑一次模型调用 ->
  // 把优化后的正文回给浏览器填进输入框」的往返。这与
  // WestFox-AwA/dsh-prompt-optimizer 的架构一致（它的系统提示词也已提取到
  // ./optimizer-prompt.ts）。
  ctx.inject(['webServer', 'llm'], (optCtx) => {
    /** 单次优化的墙钟上限：够慢模型跑完，但不会让请求永远挂着。 */
    const LLM_TIMEOUT_MS = 180_000
    /** 请求体上限（输入框里的原文，正常都是几 KB）。 */
    const BODY_MAX_BYTES = 1_000_000
    /**
     * 直接送去优化的原文长度上限。
     *
     * 与旧实现等值（旧 `QUICK_TEXT_MAX * 2` = 8000）：快捷指令的存储上限已经提到
     * 20 万，但**优化请求**的输入上限必须留在原地，否则超长文本会被丢给模型。
     */
    const TEXT_MAX = OPTIMIZE_TEXT_MAX

    const sendJson = (
      res: { writeHead: (code: number, headers: Record<string, string>) => void; end: (body: string) => void },
      code: number,
      payload: unknown,
    ): void => {
      res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(payload))
    }

    const readBody = async (req: AsyncIterable<unknown>): Promise<string> => {
      const chunks: Buffer[] = []
      let total = 0
      for await (const chunk of req) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
        total += buf.length
        if (total > BODY_MAX_BYTES) throw new Error('请求体过大')
        chunks.push(buf)
      }
      return Buffer.concat(chunks).toString('utf8')
    }

    /** 解析本次优化用哪条路由：请求体优先，其次当前默认模型。 */
    const resolveRoute = (payload: Record<string, unknown>): { provider: string; model: string } => {
      const provider = textOf(payload.provider)
      const model = textOf(payload.model)
      if (provider !== '' && model !== '') return { provider, model }
      try {
        const selector = optCtx.get('agentDefaultModel') as
          { currentSelection?: () => { provider?: unknown; model?: unknown } } | undefined
        const current = selector?.currentSelection?.()
        return { provider: textOf(current?.provider), model: textOf(current?.model) }
      } catch {
        return { provider: '', model: '' }
      }
    }

    const handle = async (
      req: { method?: string; [key: string]: unknown },
      res: { writeHead: (code: number, headers: Record<string, string>) => void; end: (body: string) => void },
    ): Promise<void> => {
      if ((req.method ?? 'GET').toUpperCase() !== 'POST') {
        sendJson(res, 405, { ok: false, error: '只接受 POST' })
        return
      }
      let payload: Record<string, unknown>
      try {
        payload = objectOf(JSON.parse(await readBody(req as unknown as AsyncIterable<unknown>)))
          ?? {}
      } catch (error: unknown) {
        sendJson(res, 400, { ok: false, error: `请求体不是合法 JSON：${errorText(error)}` })
        return
      }

      const text = textOf(payload.text).trim()
      if (text === '') {
        sendJson(res, 400, { ok: false, error: '输入框是空的，没有可优化的内容' })
        return
      }
      if (text.length > TEXT_MAX) {
        sendJson(res, 400, { ok: false, error: `原文过长（上限 ${TEXT_MAX} 字符）` })
        return
      }

      const tier = textOf(payload.tier) === '' ? DEFAULT_OPTIMIZER_TIER : textOf(payload.tier)
      const route = resolveRoute(payload)
      if (route.provider === '' || route.model === '') {
        sendJson(res, 200, { ok: false, error: '拿不到当前的模型路由，无法优化（请先在输入框旁的模型选择器里选一个模型）' })
        return
      }

      const controller = new AbortController()
      const timer = setTimeout(() => { controller.abort() }, LLM_TIMEOUT_MS)
      let out = ''
      let failure = ''
      try {
        const stream = optCtx.llm.stream({
          provider: route.provider,
          model: route.model,
          system: buildOptimizeSystem(tier),
          temperature: buildOptimizeTemperature(tier),
          signal: controller.signal,
          messages: [{
            id: `optimize-${Date.now().toString(36)}`,
            role: 'user',
            content: [{ type: 'text', text: buildOptimizeUser(text) }],
            source: { kind: 'user' },
          }],
        })
        for await (const chunk of stream as AsyncIterable<Record<string, unknown>>) {
          if (chunk.type === 'text-delta') {
            out += String(chunk.text ?? '')
            if (out.length > OPTIMIZE_OUTPUT_MAX) break
          } else if (chunk.type === 'finish') {
            const reason = objectOf(chunk.reason)
            if (reason?.kind === 'error' || reason?.kind === 'aborted') {
              const detail = objectOf(reason.failure)
              failure = textOf(detail?.message) || (reason.kind === 'aborted' ? '优化被中断' : '模型返回错误')
            }
          }
        }
      } catch (error: unknown) {
        failure = errorText(error)
      } finally {
        clearTimeout(timer)
      }

      const optimized = out.trim()
      if (optimized === '') {
        sendJson(res, 200, {
          ok: false,
          error: failure === '' ? '模型没有产出任何内容' : `优化失败：${failure}`,
        })
        return
      }
      sendJson(res, 200, {
        ok: true,
        text: optimized.slice(0, OPTIMIZE_OUTPUT_MAX),
        truncated: out.length > OPTIMIZE_OUTPUT_MAX,
        provider: route.provider,
        model: route.model,
      })
    }

    optCtx.effect(() => optCtx.webServer.register({
      kind: 'exact',
      path: OPTIMIZER_API_PATH,
      handler: handle as never,
    }), 'composer-ux: prompt optimizer route')
  })

  // ── 快捷指令的全局存储 ────────────────────────────────────────────────────
  //
  // 0.3.0 起快捷指令不再写入 settings 文档，改存 `$DSH_HOME/quick-prompts.json`：
  // 设置文档对数组是整份替换、且受 schema 长度上限截断，而快捷指令是**用户内容**
  // （长提示词是常态），并且需要一份与会话、项目无关、可以单独备份的落点。
  //
  // 本块只负责「读、迁移、整本写回」；原子写、写锁、坏文件隔离都在
  // ./quick-store.ts，客户端半通过这条路由读写（见 client/prompt-book.ts）。
  ctx.inject(['webServer'], (storeCtx) => {
    /** 请求体上限：整本快捷指令都在里面，给足余量（正常只有几十 KB）。 */
    const BODY_MAX_BYTES = 8_000_000

    const sendJson = (
      res: { writeHead: (code: number, headers: Record<string, string>) => void; end: (body: string) => void },
      code: number,
      payload: unknown,
    ): void => {
      res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(payload))
    }

    const readBody = async (req: AsyncIterable<unknown>): Promise<string> => {
      const chunks: Buffer[] = []
      let total = 0
      for await (const chunk of req) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
        total += buf.length
        if (total > BODY_MAX_BYTES) throw new Error('请求体过大')
        chunks.push(buf)
      }
      return Buffer.concat(chunks).toString('utf8')
    }

    /**
     * 迁移种子：0.2.x 存在 settings 里的平铺列表。
     *
     * 取不到就是 undefined —— 那时用内置 9 条初始化（见 quick-store 的 ensureQuickBook）。
     * 旧值**保留在设置文档里、不清空**：万一回滚到旧版本，用户还能看到自己那几条。
     */
    const legacyPrompts = (): readonly unknown[] | undefined => {
      try {
        const settings = storeCtx.get('settings') as SettingsLike | undefined
        const row = objectOf(settings?.get(NAMESPACE))
        const list = row?.[QUICK_PROMPTS_FIELD]
        return Array.isArray(list) ? list as readonly unknown[] : undefined
      } catch {
        return undefined
      }
    }

    const handle = async (
      req: { method?: string; [key: string]: unknown },
      res: { writeHead: (code: number, headers: Record<string, string>) => void; end: (body: string) => void },
    ): Promise<void> => {
      const method = (req.method ?? 'GET').toUpperCase()
      if (method !== 'GET' && method !== 'POST') {
        sendJson(res, 405, { ok: false, error: '只接受 GET / POST' })
        return
      }

      const file = quickStorePath()
      // 每次请求都尝试一次「缺失即迁移」；文件存在时它什么也不做。
      const outcome = await ensureQuickBook(legacyPrompts(), file)
      if (outcome.kind === 'broken') {
        // 坏文件已被改名隔离，这里**不做任何写入**，如实把原因交给 UI 显示。
        sendJson(res, 200, {
          ok: false,
          file,
          error: `快捷指令文件读不了：${outcome.error}`,
          quarantined: outcome.quarantined ?? '',
        })
        return
      }
      if (method === 'GET') {
        sendJson(res, 200, { ok: true, file, book: outcome.book })
        return
      }

      let payload: Record<string, unknown>
      try {
        payload = objectOf(JSON.parse(await readBody(req as unknown as AsyncIterable<unknown>))) ?? {}
      } catch (error: unknown) {
        sendJson(res, 400, { ok: false, error: `请求体不是合法 JSON：${errorText(error)}` })
        return
      }

      const candidate = payload.book !== undefined ? payload.book : payload
      const next = sanitizeBook(candidate)
      if (next === undefined) {
        sendJson(res, 400, {
          ok: false,
          error: '提交的结构认不出（期望 { book: { categories: [...] } } 或 { categories: [...] }）',
        })
        return
      }
      try {
        await writeQuickBook(next, file)
      } catch (error: unknown) {
        sendJson(res, 500, { ok: false, error: `写入失败：${errorText(error)}` })
        return
      }
      // 写完重读一遍：回给客户端的是**磁盘上的真实内容**，不是我们以为写进去的东西，
      // 这样任何被收窄/丢弃的字段都会立刻在 UI 上暴露出来。
      const verified = await readQuickBook(file)
      sendJson(res, 200, { ok: true, file, book: verified.kind === 'ok' ? verified.book : next })
    }

    storeCtx.effect(() => storeCtx.webServer.register({
      kind: 'exact',
      path: QUICK_PROMPTS_API_PATH,
      handler: handle as never,
    }), 'composer-ux: quick prompt store route')
  })

  // ── 默认终端（Windows：把终端的 pwsh 换成 Git Bash）────────────────────────
  //
  // 机制：**按 agent 会话下发**。官方 `tools.restrict()` 在全局上下文会抛错
  // （"a context-global restriction would mask every agent"），所以压制 pwsh 必须发生在
  // 该 agent 自己的 scope 里；为了让"改完设置立刻生效"，这里在设置变化时遍历
  // `ctx.agents.list()` 对每个在跑会话重新下发（见 terminal/host.ts 的注释）。
  //
  // 平台：非 Windows 直接不接管（官方 bash 工具本来就在），只把状态如实回报给设置页。
  ctx.inject(['settings', 'webServer'], (termCtx) => {
    /** 采集工具运行所需的宿主服务；缺 subprocess 就没法跑命令（只降级为压制 pwsh）。 */
    const readToolDeps = (): BashToolDeps | undefined => {
      const subprocess = termCtx.get('subprocess')
      if (subprocess === undefined) return undefined
      const sandbox = termCtx.get('sandbox')
      const sandboxPolicy = termCtx.get('sandboxPolicy')
      const approval = termCtx.get('approval')
      const jobs = termCtx.get('jobs')
      const shellEnv = termCtx.get('shellEnv')
      return {
        subprocess: subprocess as never,
        ...(sandbox === undefined ? {} : { sandbox: sandbox as never }),
        ...(sandboxPolicy === undefined ? {} : { sandboxPolicy: sandboxPolicy as never }),
        ...(approval === undefined ? {} : { approval: approval as never }),
        ...(jobs === undefined ? {} : { jobs: jobs as never }),
        ...(shellEnv === undefined ? {} : { shellEnv: shellEnv as never }),
      }
    }
    installTerminalPolicy(
      termCtx as never,
      NAMESPACE,
      termCtx.get('settings') as never,
      readToolDeps,
    )
  })

  // ── 迁移：「快捷指令」栏对老用户保持开着（一次性写回文档）──────────────────
  //
  // 为什么这一栏不能只靠设置文档判断：0.3.0 起条目搬到了 `quick-prompts.json`，
  // **"用过快捷指令的人"和"从没碰过的人"的设置文档可以一模一样**（都是内置 9 条 + 默认档位），
  // 纯净函数那套"值不等于默认值"的判据在他身上会得出"没碰过 ⇒ 关"，把入口按钮收掉。
  // 所以这里读一次书本文件：有非内置内容 ⇒ 认定他在用 ⇒ 写回 `quickEnabled: true`。
  // 写回之后两端都只需要看那一个布尔，不必各自知道文件的存在。
  // **只在文档里还没有这个键时写**：用户明确关掉之后文档里就是 `false`，不会被重新打开。
  ctx.inject(['settings'], (migrateCtx) => {
    void (async () => {
      const service = migrateCtx.get('settings') as SettingsLike | undefined
      if (service === undefined) return
      const row = objectOf(service.get(NAMESPACE))
      if (row === undefined || row[QUICK_ENABLED_FIELD] !== undefined) return
      try {
        const outcome = await readQuickBook(quickStorePath())
        if (outcome.kind !== 'ok' || !bookLooksCustom(outcome.book)) return
        await service.mutate(NAMESPACE, [
          { op: 'set', path: [QUICK_ENABLED_FIELD], value: true },
        ])
      } catch (error: unknown) {
        // 迁移失败不是致命错误：用户顶多在设置页手动打开这一栏。
        console.error('[composer-ux] quick section migration skipped', error)
      }
    })()
  })

  // ── 重启 DSH ──────────────────────────────────────────────────────────────
  //
  // 只有宿主进程能把自己重新拉起来（浏览器碰不到进程），DSH 也没有官方重启机制
  // （插件市场那边只说「更改将在下次启动生效」）。机制照搬插件市场：分离一个 node 助手
  // 进程 → 自己退出 → 助手等端口真的空出来 → 用隐藏控制台的 PowerShell 起新宿主 →
  // 20 秒内确认端口有人监听，没起来把诊断写进日志。细节与理由全在 `src/restart.ts`。
  //
  // 这一整块是**宿主半**，所以改完必须重启 DSH 才会生效（这也正是它要解决的问题）。
  ctx.inject(['webServer'], (restartCtx) => {
    /** 这次启动的标识：界面靠"号变了"判断新进程真的起来了。 */
    const BOOT_ID = bootId(process.pid, Date.now())
    /** 当前宿主是否处于"不该被从界面里杀掉"的状态。 */
    const blockedBy = (): string | null => {
      const supervisor = detectedSupervisor({
        env: process.env,
        ppid: process.ppid,
        parentComm: (pid) => {
          try {
            return readFileSync(`/proc/${String(pid)}/comm`, 'utf8').trim()
          } catch {
            // /proc 只在 Linux 上有；读不到就说明"不是 systemd 的主进程"。
            return null
          }
        },
      })
      if (supervisor !== null) return `supervised:${supervisor}`
      if (detectedDebugger({
        inspectorUrl: inspector.url(),
        execArgv: process.execArgv,
        nodeOptions: process.env.NODE_OPTIONS,
      }) !== null) return 'debugger'
      return null
    }
    /** 组装注入面（真实实现；测试里换假的）。 */
    const buildIo = (): RestartIo => ({
      platform: process.platform,
      pid: process.pid,
      argv0: process.argv0,
      execPath: process.execPath,
      argv1: process.argv[1],
      execArgv: process.execArgv,
      // argv[0] 是 node 自己、argv[1] 是入口；重放的是"入口 + 之后的参数"。
      rest: process.argv.slice(2),
      cwd: process.cwd(),
      env: process.env,
      tmpdir: tmpdir(),
      stamp: new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19),
      exists: (path) => existsSync(path),
      resolve: (path) => resolve(path),
      dirname: (path) => dirname(path),
      join: (...parts) => join(...parts),
      spawn: (command, args, options) => spawn(command, [...args], {
        detached: options.detached,
        stdio: options.stdio,
        windowsHide: options.windowsHide,
        env: options.env as NodeJS.ProcessEnv,
      }),
      stop: () => {
        gracefulStop({
          emitSignal: (signal) => { process.emit(signal as 'SIGTERM') },
          exit: (code) => { process.exit(code) },
          timer: (ms, run) => { setTimeout(run, ms) },
        })
      },
      wait: (ms) => new Promise<void>((done) => { setTimeout(done, ms) }),
    })
    /** 已经排过一次重启：防止界面重复点 / 两个标签页同时点。 */
    let restarting = false
    /** GET 只读展示：会怎么重启、日志落在哪。 */
    const planForDisplay = (): { command: string; execPath: string; logHint: string } => {
      const io = buildIo()
      const plan = planRestart(io, null)
      return {
        command: [plan.respawn.file, ...plan.respawn.args].join(' '),
        execPath: plan.node,
        logHint: join(io.tmpdir, `${RESTART_LOG_PREFIX}*.err.log`),
      }
    }

    restartCtx.effect(() => restartCtx.webServer.register({
      kind: 'exact',
      path: RESTART_API_PATH,
      handler: (req: {
        method?: string
        headers?: Readonly<Record<string, string | readonly string[] | undefined>>
        socket?: { remoteAddress?: string }
      }, res: {
        statusCode?: number
        writeHead: (code: number, headers: Record<string, string>) => void
        end: (body?: string) => void
      }): void => {
        const send = (code: number, payload: unknown): void => {
          res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
          res.end(JSON.stringify(payload))
        }
        // 第一道：官方那道信任关卡（本机 webServer 绑 0.0.0.0：Host/Origin 围栏 + 浏览器令牌）。
        // 与另外两条路由一致，先问它，被拒就直接结束。
        const connection = restartCtx.get('connection') as
          { requestRejection?: (request: unknown) => number | undefined } | undefined
        const rejection = connection?.requestRejection?.(req)
        if (rejection !== undefined) {
          res.statusCode = rejection
          res.end()
          return
        }

        const agents = restartCtx.get('agents') as { list?: () => readonly unknown[] } | undefined
        const running = agents?.list?.().length ?? 0
        const blocked = blockedBy()
        const method = (req.method ?? 'GET').toUpperCase()

        if (method !== 'GET' && method !== 'POST') {
          res.writeHead(405, { allow: 'GET, POST' })
          res.end()
          return
        }
        if (method === 'GET') {
          const plan = planForDisplay()
          send(200, { ok: true, ...plan, running, blocked, boot: BOOT_ID })
          return
        }

        // 第二道：这是"杀进程"的接口，所以额外要求请求确实来自本机同源页面 ——
        // 回环 peer、无转发痕迹、Origin 与 Host 同源。跨站页面一定带自己的 Origin，挡在这里。
        if (!trustedRestartRequest({
          remoteAddress: req.socket?.remoteAddress,
          headers: req.headers ?? {},
        })) {
          send(403, { ok: false, error: 'restart is limited to same-origin loopback requests' })
          return
        }
        if (blocked !== null) {
          send(403, { ok: false, error: blocked === 'debugger'
            ? 'self-restart is disabled while the host is under a debugger'
            : `restart belongs to the ${blocked.slice('supervised:'.length)} supervisor on this host` })
          return
        }
        if (restarting) {
          send(409, { ok: false, error: 'restart already scheduled' })
          return
        }
        restarting = true
        try {
          const scheduled = scheduleRestart(buildIo(), servingPort(firstHeaderValue(req.headers?.host)))
          send(202, { ok: true, boot: BOOT_ID, running, ...scheduled })
        } catch (error: unknown) {
          restarting = false
          send(500, { ok: false, error: error instanceof Error ? error.message : String(error) })
        }
      },
    }), 'composer-ux: restart route')
  })
}
