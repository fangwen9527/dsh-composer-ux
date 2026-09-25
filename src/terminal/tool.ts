/**
 * 「默认终端」的 bash 工具：与官方 `@deepseek-ai/dsh-tool-bash` **同契约**的自包含实现。
 *
 * 为什么不直接用官方那个：win32 上它的行是 `disabled`（`packages/bundle/base/cordis.patch.yml`），
 * 而且它只消费 `ctx.shell` —— 而 win32 的 `ctx.shell` 栈是 `pwsh-sandbox`（PowerShell）。
 * 也就是说"启用官方 bash 工具"得不到 Git Bash，必须自己带工具。
 *
 * 为什么不像官方那样 `import { defineTool }`：本插件宿主半是自包含产物（build.mjs 只内联
 * schemastery/cosmokit）。所以这里的 `parameters` / `output.schema` 直接写成**编译后的
 * canonical JSON Schema**（即 defineTool 编译后的形状），字段与官方**逐字一致**：
 * 模型看到的工具描述、参数、输出、标记、终端卡片都应当与官方不可区分。
 *
 * 三处"看起来可以更聪明但故意照抄"的地方：
 *  1. 非零退出**不是错误**，只是渲染成末尾的 `[exit code: N]` 标记；
 *  2. `sandbox.confine` 是 **async**（装在你机器上的 dsh-windows-shell-policy 当同步用，
 *     所以它在带沙箱的组合里根本发不起来 —— 这里必须 await）；
 *  3. 中止时抛的错带 `name='AbortError'` + `code='ABORTED'`。官方用 `HarnessError`
 *     （`instanceof` 才能被 registry 认成 `info`）；本包结构上无法提供同一个类身份，
 *     而 registry 对"调用方中止"本身就会把结局规范化为 ABORTED，故这里抛结构等价的
 *     普通错误，代价是 `info` 少一条注解（已在交接文档中如实记录）。
 */
import {
  parseExitStatus, renderBashResult, renderProcessRead,
  type BashRunResult, type ProcessRead, type SandboxFacts,
} from './render.ts'
import {
  ESCALATION_TARGETS, approveEscalation, validateEscalationArgs,
  type ConfinedArgv, type EscalationApproverLike, type SandboxExecutionPolicy, type SandboxLike,
  type SandboxMode, type SandboxPolicyLike,
} from './sandbox.ts'

/** 工具名（与官方一致：模型看到的就是 `bash`）。 */
export const BASH_TOOL_NAME = 'bash'

/** 工具提示词段的顺序（官方 `TOOL_BASH: 1000`）。 */
export const TOOL_BASH_SECTION_ORDER = 1000

/** pwsh 提示词段的顺序（官方 `TOOL_PWSH: 1010`）——换壳时用它压掉预设那段。 */
export const TOOL_PWSH_SECTION_ORDER = 1010

/** 换成 bash 后写进提示词的那句（官方逐字）。 */
export const BASH_SECTION_TEXT = 'Check the [exit code: N] marker on every bash result; '
  + 'investigate failures before moving on.'

/** 超时与输出的默认值（官方 bash-local 的默认值）。 */
export const DEFAULT_TIMEOUT_MS = 120_000
export const MAX_TIMEOUT_MS = 600_000
export const MAX_OUTPUT_BYTES = 64_000
export const MAX_SPILL_BYTES = 64 * 1024 * 1024
export const GRACE_MS = 3_000

/** 中止错误的码（官方 `TOOL_ABORTED`）。 */
export const TOOL_ABORTED = 'ABORTED'

/** 执行环境的三条压制项（官方 ENV_OVERRIDES：让输出稳定、少分页）。 */
export const ENV_OVERRIDES: Readonly<Record<string, string>> = {
  NO_COLOR: '1',
  TERM: 'dumb',
  PAGER: 'cat',
  GIT_PAGER: 'cat',
}

/** 工具参数。 */
export interface BashToolArgs {
  readonly command: string
  readonly description: string
  readonly timeoutMs?: number
  readonly workdir?: string
  readonly run_in_background?: boolean
  readonly sandbox_permissions?: string
  readonly justification?: string
}

/** 结构化窄化出来的执行上下文（只取本工具用得到的字段）。 */
export interface ToolRunContextLike {
  readonly callId: string
  readonly signal: AbortSignal
  readonly agent?: {
    readonly session: {
      readonly header: { readonly cwd?: string; readonly id?: string }
    }
  }
}

/** 子进程服务（官方 `SubprocessHandle` 的可观测子集）。 */
export interface SubprocessHandleLike {
  readonly collected: {
    readonly stdout?: { readFrom(fromByte: number): { text: string; nextOffset: number; lossy: boolean; spillPath?: string } }
    readonly stderr?: { readFrom(fromByte: number): { text: string; nextOffset: number; lossy: boolean; spillPath?: string } }
  }
  readonly done: Promise<{ exitCode: number | null; signal: string | null }>
  terminate(): void
}

export interface SubprocessLike {
  spawn(spec: {
    argv: readonly string[]
    cwd: string
    stdio: {
      stdin: 'ignore'
      stdout: { maxBytes: number; spill: { maxBytes: number } }
      stderr: { maxBytes: number; spill: { maxBytes: number } }
    }
    graceMs: number
    signal?: AbortSignal
    env: Record<string, string>
  }): SubprocessHandleLike
}

/** 后台 job 的钩子（官方 `JobHooks`）。 */
export interface JobHooksLike {
  cancel(reason?: string): void
  done: Promise<{ status: 'completed' | 'killed' | 'failed'; detail?: string }>
  readOutput?(): string
}

export interface JobsLike {
  start(spec: {
    kind: 'bash'
    label: string
    owner?: unknown
    run(): JobHooksLike
  }): string
}

/** 受管环境变量收集（官方 `ctx.shellEnv.collect`）。 */
export interface ShellEnvLike {
  collect(exec: ToolRunContextLike): Record<string, string>
}

/** 内容块与视图（只声明本文件返回的那几种）。 */
export type ContentBlockLike = { readonly type: 'text'; readonly text: string }

export interface ToolDefinitionLike {
  readonly name: string
  readonly description: string
  readonly parameters: Record<string, unknown>
  readonly output: {
    readonly schema: Record<string, unknown>
    render(args: unknown, value: unknown): ContentBlockLike[]
  }
  execute(args: unknown, exec: ToolRunContextLike): Promise<unknown>
  presentCall?(args: unknown): unknown
  presentResult?(args: unknown, result: { content: ContentBlockLike[]; isError: boolean }): unknown
}

/** 工具依赖（全部结构性注入，便于单测）。 */
export interface BashToolDeps {
  readonly subprocess: SubprocessLike
  readonly sandbox?: SandboxLike
  readonly sandboxPolicy?: SandboxPolicyLike
  readonly approval?: EscalationApproverLike
  readonly jobs?: JobsLike
  readonly shellEnv?: ShellEnvLike
}

/** 可升级的模式表：只有组合里真的能 confine 时才提供升级参数（官方同判据）。 */
export function escalationModesOf(deps: BashToolDeps): readonly SandboxMode[] {
  return deps.sandbox !== undefined && deps.sandboxPolicy !== undefined ? ESCALATION_TARGETS : []
}

/**
 * 工具描述（官方逐字）。
 * @param backgroundEnabled 是否暴露 `run_in_background`。
 * @param escalationModes 可升级模式（空 = 不暴露 `sandbox_permissions`）。
 * @returns 完整描述串。
 */
export function bashDescription(backgroundEnabled: boolean, escalationModes: readonly SandboxMode[]): string {
  const background = backgroundEnabled
    ? 'Set `run_in_background: true` for long-running commands: the call returns a job id immediately; '
      + 'read its output with `job_output` and stop it with `job_kill`.'
    : 'Background execution is not available; long-running commands must finish within the timeout.'
  const base = 'Execute a bash command (`bash -c`) and return its stdout/stderr. '
    + 'Each call runs in a fresh shell: no state (cwd, variables, functions) persists between calls — '
    + 'pass `workdir` instead of using `cd`. Non-zero exits are reported as `[exit code: N]`. '
    + 'Current harness environment facts are exposed through managed `$DSH_*` variables; inspect them when needed. '
    + 'Commands may run under a file sandbox; a blocked file operation is reported as '
    + '`[sandbox: file access denied under <mode> mode]` — a policy denial, not a bug in the command; '
    + 'do not retry another way. '
    + 'Long output is truncated to its tail; the full output is saved to a file whose path is reported when available. '
    + background
  if (escalationModes.length === 0) return base
  return base + ' Attempting a command the sandbox may deny is safe and expected: run it and read the '
    + 'marker rather than assuming the denial. When a command is denied and a wider mode would let it '
    + 'succeed, escalate immediately in the same turn — the one sanctioned exception to a denial: retry '
    + 'the exact same command once with `sandbox_permissions` (the narrowest wider mode that suffices) '
    + 'plus a one-sentence `justification`. Do not detour through chat to ask permission first — the '
    + 'approval prompt raised by that retry is how the user consents. If the session states approval '
    + 'prompts are disabled, there is no exception: a denial is final — do not set `sandbox_permissions`. '
    + 'Never escalate speculatively: ground the request in a real denial — normally the one this command '
    + 'just hit; escalating up front is fine only when this session already denied the same access. '
    + 'A rejected escalation is final for that command — stop and explain, never work around '
    + 'it — but it does not forbid attempting or escalating other commands later.'
}

/** 参数 JSON Schema（canonical；与官方编译后的形状一致）。 */
export function bashParameters(escalationModes: readonly SandboxMode[]): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      command: { type: 'string', description: 'The bash command to execute.' },
      description: {
        type: 'string',
        description: 'Clear, concise description of what this command does in active voice, '
          + '5-10 words (shown in the UI). Examples: "ls" → "List files in current directory"; '
          + '"git status" → "Show working tree status"; "npm install" → "Install package dependencies".',
      },
      timeoutMs: {
        type: 'number',
        description: 'Timeout in milliseconds. The executor applies its configured default and cap, '
          + 'and kills the command on expiry.',
      },
      workdir: {
        type: 'string',
        description: 'Working directory for this command. Defaults to the session workspace; '
          + 'a relative path is resolved against it.',
      },
      ...(escalationModes.length === 0 ? {} : {
        sandbox_permissions: {
          type: 'string',
          enum: [...escalationModes],
          description: 'The wider sandbox mode this command needs. Only valid as a one-shot retry of a '
            + 'command the sandbox just denied; requires justification and user approval.',
        },
        justification: {
          type: 'string',
          description: 'Required with sandbox_permissions: one sentence for the user explaining why '
            + 'this exact command needs the wider access.',
        },
      }),
    },
    required: ['command', 'description'],
  }
}

/** 输出 JSON Schema（canonical：前台 / 后台两支）。 */
export function bashOutputSchema(): Record<string, unknown> {
  const stream = {
    type: 'object',
    additionalProperties: false,
    required: ['text', 'truncated'],
    properties: {
      text: { type: 'string' },
      truncated: { type: 'boolean' },
      spillPath: { type: 'string' },
    },
  }
  return {
    oneOf: [
      {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'jobId'],
        properties: {
          kind: { type: 'string', const: 'background' },
          jobId: { type: 'string' },
        },
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'exitCode', 'signal', 'timedOut', 'aborted', 'timeoutMs', 'stdout', 'stderr'],
        properties: {
          kind: { type: 'string', const: 'foreground' },
          exitCode: { oneOf: [{ type: 'integer' }, { type: 'null' }] },
          signal: { oneOf: [{ type: 'string' }, { type: 'null' }] },
          timedOut: { type: 'boolean' },
          aborted: { type: 'boolean' },
          timeoutMs: { type: 'number' },
          stdout: stream,
          stderr: stream,
          sandbox: {
            type: 'object',
            additionalProperties: false,
            required: ['mode', 'denied'],
            properties: {
              mode: { type: 'string' },
              denied: { type: 'boolean' },
              enforcement: { type: 'string' },
              runnerFailed: { type: 'boolean' },
            },
          },
        },
      },
    ],
  }
}

/**
 * 超时收敛到 [下限, 上限]（官方 executor 的 clamp 语义：请求值过小被抬到默认、过大被压到上限）。
 * @param requested 模型给的 timeoutMs。
 * @param min 下限（官方 `timeoutMs`，默认 120s）。
 * @param max 上限（官方 `maxTimeoutMs`，默认 600s）。
 * @returns 实际超时毫秒数。
 */
export function clampTimeout(requested: number | undefined, min: number, max: number): number {
  if (requested === undefined || !Number.isFinite(requested) || requested <= 0) return min
  return Math.min(Math.max(requested, min), max)
}

/**
 * 解析工作目录（官方 `resolveWorkdir`）。
 *
 * 刻意与官方一致：**策略里的 workspaceRoot 优先于会话 cwd**（沙箱把可写边界当作工作目录），
 * 相对路径用 `sep` 拼接而**不是** `resolve()`（避免把一个不存在的路径规范化成别的东西）。
 * @param modelWorkdir 模型给的 workdir。
 * @param exec 执行上下文。
 * @param policyWorkspaceRoot 策略里的 workspaceRoot。
 * @param sep 平台分隔符。
 * @param isAbsolute 判定绝对路径（注入以便单测）。
 * @returns 工作目录；都没有时 undefined（由调用方兜底）。
 */
export function resolveWorkdir(
  modelWorkdir: string | undefined,
  exec: ToolRunContextLike,
  policyWorkspaceRoot: string | undefined,
  sep: string,
  isAbsolute: (path: string) => boolean,
): string | undefined {
  const headerCwd = exec.agent?.session.header.cwd
  const sessionCwd = policyWorkspaceRoot ?? headerCwd
  if (modelWorkdir === undefined) return sessionCwd
  if (sessionCwd !== undefined && !isAbsolute(modelWorkdir)) return `${sessionCwd}${sep}${modelWorkdir}`
  return modelWorkdir
}

/** 造一个"中止"错误（结构等价于官方的 HarnessError + name 覆写）。 */
function abortedError(): Error {
  const error = new Error('tool call aborted') as Error & { code?: string }
  error.name = 'AbortError'
  error.code = TOOL_ABORTED
  return error
}

/**
 * 创建 bash 工具定义。
 *
 * @param deps 结构性注入的服务（subprocess 必需，其余缺省即降级）。
 * @param options `bashPath` 是 Git Bash 可执行文件；`sep`/`isAbsolute` 注入以便跨平台单测。
 * @returns 可直接交给 `tools.register()` 的工具定义。
 */
export function createBashTool(
  deps: BashToolDeps,
  options: {
    readonly bashPath: string
    readonly sep?: string
    readonly isAbsolute?: (path: string) => boolean
    /** 超时下限（默认 120s）。可注入：小值让超时路径能被测到。 */
    readonly timeoutMs?: number
    /** 超时上限（默认 600s）。 */
    readonly maxTimeoutMs?: number
    /**
     * 是否按「打包形态的 Electron 宿主」补 `ELECTRON_RUN_AS_NODE`。
     *
     * 默认看 `process.versions.electron`；可注入，好让 node 下跑的测试也能断言这一项。
     */
    readonly electron?: boolean
  },
): ToolDefinitionLike {
  const escalationModes = escalationModesOf(deps)
  const sep = options.sep ?? '\\'
  const isAbsolute = options.isAbsolute ?? ((path: string) => /^([a-zA-Z]:[\\/]|[\\/])/.test(path))
  const electron = options.electron ?? (process.versions as { electron?: string }).electron !== undefined
  const minTimeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxTimeout = options.maxTimeoutMs ?? MAX_TIMEOUT_MS

  /** 造一份 spawn 规格（官方 bash-local 的 spawnSpec 等价物）。 */
  const spawnSpec = (argv: readonly string[], cwd: string, dshEnv: Record<string, string>, signal: AbortSignal | undefined) => ({
    argv,
    cwd,
    stdio: {
      stdin: 'ignore' as const,
      stdout: { maxBytes: MAX_OUTPUT_BYTES, spill: { maxBytes: MAX_SPILL_BYTES } },
      stderr: { maxBytes: MAX_OUTPUT_BYTES, spill: { maxBytes: MAX_SPILL_BYTES } },
    },
    graceMs: GRACE_MS,
    ...(signal === undefined ? {} : { signal }),
    // dshEnv 必须显式带上：subprocess 会先按凭据形状清洗父环境（含清掉所有 DSH_*）。
    env: {
      ...ENV_OVERRIDES,
      ...dshEnv,
      // ⚠️ 打包形态（Electron 桌面版）下必须补这一项。Windows 上受限模式的沙箱 runner
      // 的 argv[0] 是 `process.execPath`（`dsh-sandbox-local/lib/index.js:539`），桌面版里
      // 那就是 `DeepSeek Harness.exe`；而用 Electron 跑 JS 脚本**必须**带
      // `ELECTRON_RUN_AS_NODE=1`，否则它按 App 形态启动、原生初始化就失败
      // （2026-09-25 实测：零输出 / 0xC0000142）。官方 `sandbox-local` 只返回 argv、不带 env，
      // 所以这一项只能由 **spawn 方**补齐。对 `bash.exe` 本身无副作用（它不认这个变量）。
      ...(electron ? { ELECTRON_RUN_AS_NODE: '1' } : {}),
    },
  })

  /** 读一帧增量（官方 executor 的游标记账）。 */
  const readFrame = (
    handle: SubprocessHandleLike,
    offsets: { stdout: number; stderr: number },
  ): ProcessRead => {
    const outRead = handle.collected.stdout?.readFrom(offsets.stdout)
    const errRead = handle.collected.stderr?.readFrom(offsets.stderr)
    offsets.stdout = outRead?.nextOffset ?? offsets.stdout
    offsets.stderr = errRead?.nextOffset ?? offsets.stderr
    const outText = outRead?.text ?? ''
    const errText = errRead?.text ?? ''
    const separator = outText.length > 0 && !outText.endsWith('\n') ? '\n' : ''
    return {
      delta: outText + (errText.length > 0 ? `${separator}[stderr]\n${errText}` : ''),
      lossy: (outRead?.lossy ?? false) || (errRead?.lossy ?? false),
      ...(outRead?.spillPath === undefined ? {} : { stdoutSpillPath: outRead.spillPath }),
      ...(errRead?.spillPath === undefined ? {} : { stderrSpillPath: errRead.spillPath }),
    }
  }

  /** 一条命令的完整执行体。 */
  const execute = async (rawArgs: unknown, exec: ToolRunContextLike): Promise<unknown> => {
    const args = rawArgs as BashToolArgs
    if (args.command.trim().length === 0) throw new Error('invalid command: expected a non-empty string')
    if (args.description.trim().length === 0) throw new Error('invalid description: expected a non-empty string')
    if (args.timeoutMs !== undefined && (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0)) {
      throw new Error(`invalid timeoutMs: expected a positive number, got ${JSON.stringify(args.timeoutMs)}`)
    }
    validateEscalationArgs(args.sandbox_permissions, args.justification)

    const standingPolicy: SandboxExecutionPolicy | undefined = deps.sandboxPolicy?.resolve(
      exec.agent === undefined ? {} : { session: exec.agent.session },
    )
    const approvedMode = args.sandbox_permissions !== undefined && args.justification !== undefined
      ? await approveEscalation(
        {
          requestedMode: args.sandbox_permissions,
          justification: args.justification,
          effectiveMode: (standingPolicy as SandboxExecutionPolicy).mode,
          subject: 'command',
        },
        {
          approver: deps.approval,
          agent: exec.agent,
          callId: exec.callId,
          toolName: BASH_TOOL_NAME,
          signal: exec.signal,
        },
      )
      : undefined
    const policy: SandboxExecutionPolicy | undefined = approvedMode === undefined
      ? standingPolicy
      : { ...(standingPolicy as SandboxExecutionPolicy), mode: approvedMode }

    const workdir = resolveWorkdir(args.workdir, exec, standingPolicy?.workspaceRoot, sep, isAbsolute)
    const dshEnv = deps.shellEnv?.collect(exec) ?? {}

    // 约束：只有"受限模式 + 有 sandbox 服务"才包；`danger-full-access` 直接跑（官方同判据）。
    let argv: readonly string[] = [options.bashPath, '-c', args.command]
    let confined: ConfinedArgv | undefined
    if (policy !== undefined && policy.mode !== 'danger-full-access' && deps.sandbox !== undefined) {
      // 官方 `bash-sandbox` 的做法：把 shell 形状的命令交给 confine（argv 而不是命令行字符串）。
      confined = await deps.sandbox.confine(argv, { ...policy, mode: policy.mode })
      argv = confined.argv
    }

    const timeoutMs = clampTimeout(args.timeoutMs, minTimeout, maxTimeout)

    // ── 后台 ────────────────────────────────────────────────────────────────
    if (args.run_in_background === true) {
      const jobs = deps.jobs
      if (jobs === undefined) {
        throw new Error('background jobs unavailable: load @deepseek-ai/dsh-jobs and @deepseek-ai/dsh-tool-jobs')
      }
      if (exec.signal.aborted) throw abortedError()
      const id = jobs.start({
        kind: 'bash',
        label: args.command,
        ...(exec.agent === undefined ? {} : { owner: exec.agent }),
        run: () => {
          const controller = new AbortController()
          let handle: SubprocessHandleLike | undefined
          const offsets = { stdout: 0, stderr: 0 }
          const done = (async () => {
            try {
              handle = deps.subprocess.spawn(spawnSpec(argv, workdir ?? process.cwd(), dshEnv, controller.signal))
              if (controller.signal.aborted) handle.terminate()
              const outcome = await handle.done
              if (controller.signal.aborted) {
                return {
                  status: 'killed' as const,
                  detail: outcome.signal !== null ? `signal: ${outcome.signal}` : 'killed before exit',
                }
              }
              return { status: 'completed' as const, detail: `exit code: ${outcome.exitCode ?? 0}` }
            } catch (error: unknown) {
              return {
                status: (controller.signal.aborted && handle === undefined ? 'killed' : 'failed') as 'killed' | 'failed',
                detail: error instanceof Error ? error.message : String(error),
              }
            }
          })()
          return {
            cancel: (): void => {
              if (controller.signal.aborted) return
              controller.abort()
              handle?.terminate()
            },
            done,
            readOutput: (): string => (handle === undefined
              ? ''
              : renderProcessRead(readFrame(handle, offsets), undefined, escalationModes)),
          }
        },
      })
      return { kind: 'background', jobId: id }
    }

    // ── 前台 ────────────────────────────────────────────────────────────────
    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)
    const onAbort = (): void => { controller.abort() }
    exec.signal.addEventListener('abort', onAbort)
    let handle: SubprocessHandleLike | undefined
    try {
      handle = deps.subprocess.spawn(spawnSpec(argv, workdir ?? process.cwd(), dshEnv, controller.signal))
    } catch (error: unknown) {
      clearTimeout(timer)
      exec.signal.removeEventListener('abort', onAbort)
      throw error
    }
    const onControllerAbort = (): void => {
      try { handle?.terminate() } catch { /* 已经结束 */ }
    }
    controller.signal.addEventListener('abort', onControllerAbort)
    try {
      const outcome = await handle.done
      const read = readFrame(handle, { stdout: 0, stderr: 0 })
      const aborted = exec.signal.aborted && !timedOut
      const denied = confined !== undefined
        && outcome.exitCode !== 0
        && confined.denialSignatures.some(signature => read.delta.toLowerCase().includes(signature.toLowerCase()))
      const result: BashRunResult = {
        exitCode: outcome.exitCode,
        signal: outcome.signal,
        timedOut,
        aborted,
        timeoutMs,
        stdout: { text: read.delta, truncated: read.lossy, ...(read.stdoutSpillPath === undefined ? {} : { spillPath: read.stdoutSpillPath }) },
        stderr: { text: '', truncated: false },
        ...(denied ? { sandbox: { mode: policy?.mode ?? 'read-only', denied: true } as SandboxFacts } : {}),
      }
      if (aborted) throw abortedError()
      return { kind: 'foreground', ...result }
    } finally {
      clearTimeout(timer)
      exec.signal.removeEventListener('abort', onAbort)
      controller.signal.removeEventListener('abort', onControllerAbort)
    }
  }

  return {
    name: BASH_TOOL_NAME,
    description: bashDescription(true, escalationModes),
    parameters: bashParameters(escalationModes),
    output: {
      schema: bashOutputSchema(),
      render: (_args: unknown, value: unknown): ContentBlockLike[] => {
        const v = value as { kind?: string; jobId?: string } & BashRunResult
        const text = v.kind === 'background'
          ? `started background job ${v.jobId}`
          : renderBashResult(v, escalationModes)
        return [{ type: 'text', text }]
      },
    },
    execute,
    presentCall: (args: unknown): unknown => {
      const a = args as BashToolArgs
      if (a.run_in_background === true) {
        return {
          card: 'generic', title: a.command, kind: 'execute', rawInput: a.command,
          content: [{ type: 'text', text: a.description }],
        }
      }
      return {
        card: 'terminal', title: a.command, description: a.description,
        ...(a.workdir === undefined ? {} : { cwd: a.workdir }),
      }
    },
    presentResult: (args: unknown, result: { content: ContentBlockLike[]; isError: boolean }): unknown => {
      const block = result.content.length === 1 ? result.content[0] : undefined
      if (block === undefined || block.type !== 'text') return undefined
      const raw = block.text
      const isBackground = typeof args === 'object' && args !== null
        && (args as { run_in_background?: unknown }).run_in_background === true
      if (isBackground || result.isError) {
        return { card: 'generic', content: [{ type: 'text', text: `\`\`\`console\n${raw.replace(/\n+$/, '')}\n\`\`\`` }] }
      }
      const { body, ...exit } = parseExitStatus(raw)
      return { card: 'terminal', output: body, ...exit }
    },
  }
}

// ── 自检探针（2026-09-25 新增）────────────────────────────────────────────────
//
// 为什么需要：官方安装的**桌面版**（Electron 打包）在**受限文件策略**下，命令会经过沙箱
// runner，而 runner 是用 `process.execPath` 起的 —— 桌面版里那是 `DeepSeek Harness.exe`
// 而不是 node，于是每条命令都以 `0xC0000142`（DLL 初始化失败）退出、零输出。
// 插件的「默认终端」若照旧接管，结果就是：`restrict(pwsh)` 已生效 + 自带的 bash 又跑不动
// = 该会话**一个能用的 shell 都没有**（比不接管更糟）。
// 所以：接管前先用**同一条执行路径**探一次；不通过就不接管，至少还留着 PowerShell。
// 注意 `danger-full-access` 会跳过 confine，实测那条路径本来就是好的 —— 调用方只在受限
// 模式下才要求探针（见 terminal/host.ts）。

/** 探针命令：只打印一个标记，不写文件、不依赖当前目录。 */
export const PROBE_COMMAND = 'printf %s dsh-composer-ux-probe-ok'
/** 探针通过时 stdout 必须包含的标记。 */
export const PROBE_MARKER = 'dsh-composer-ux-probe-ok'
/** 探针超时（毫秒）：够慢机器起一次 shell，又不至于把插件启动拖住。 */
export const PROBE_TIMEOUT_MS = 8_000

/** 探针结论。 */
export interface ProbeOutcome {
  readonly ok: boolean
  /** 失败原因（ok 时为空串）。 */
  readonly detail: string
}

/** 退出码的可读写法：Windows 上那些 `0xC0000xxx` 语义上是"进程没起来"，写成十六进制最好认。 */
export function formatProbeExit(exitCode: number | null): string {
  if (exitCode === null) return 'null（被信号结束）'
  if (exitCode < 0 || exitCode >= 0x80000000) {
    const unsigned = exitCode < 0 ? exitCode + 0x1_0000_0000 : exitCode
    return `0x${unsigned.toString(16).toUpperCase()}（${unsigned}）`
  }
  return String(exitCode)
}

/**
 * 用**与真实 bash 工具完全相同的路径**跑一条无副作用命令（同一份 argv 构造、同一个
 * 沙箱 `confine`、同一个 `subprocess.spawn`）。
 *
 * 刻意借道 `createBashTool(...).execute(...)` 而不是另写一套 spawn：自检必须测到"真工具会走的
 * 那条路"，否则它证明不了任何事（argv 拼错、confine 漏包、cwd/env 不对都会漏过去）。
 * 也刻意**不带** `sandbox_permissions`：自检不该弹审批。
 * @param deps 工具依赖（与真工具同一份）。
 * @param options `bashPath` 等（与真工具同一份）。
 * @param exec 借来的执行上下文（agent/signal/callId）。
 * @returns 探针结论；任何异常都收敛成 `{ ok: false }`（fail-closed）。
 */
export async function probeBashExecution(
  deps: BashToolDeps,
  options: { readonly bashPath: string; readonly sep?: string; readonly isAbsolute?: (path: string) => boolean },
  exec: ToolRunContextLike,
): Promise<ProbeOutcome> {
  // 受管环境变量收集失败不该否掉整个探针：那是另一条链路的问题，而这里要验的是"命令能不能跑"。
  const probeDeps: BashToolDeps = deps.shellEnv === undefined
    ? deps
    : {
        ...deps,
        shellEnv: {
          collect: (ctx): Record<string, string> => {
            try {
              return deps.shellEnv?.collect(ctx) ?? {}
            } catch {
              return {}
            }
          },
        },
      }
  try {
    const tool = createBashTool(probeDeps, { ...options, timeoutMs: PROBE_TIMEOUT_MS, maxTimeoutMs: PROBE_TIMEOUT_MS })
    const result = await tool.execute(
      { command: PROBE_COMMAND, description: 'composer-ux terminal self-check', timeoutMs: PROBE_TIMEOUT_MS },
      exec,
    ) as {
      kind?: string
      exitCode?: number | null
      timedOut?: boolean
      aborted?: boolean
      stdout?: { text?: string }
      sandbox?: { denied?: boolean }
    }
    if (result?.kind !== 'foreground') return { ok: false, detail: '自检没有走前台执行路径' }
    if (result.timedOut === true) return { ok: false, detail: `自检超时（${PROBE_TIMEOUT_MS}ms）` }
    const text = result.stdout?.text ?? ''
    const exit = result.exitCode ?? 0
    if (exit !== 0) {
      return {
        ok: false,
        detail: `自检命令退出码 ${formatProbeExit(exit)}${text.trim() === '' ? '（零输出）' : ''}`,
      }
    }
    if (!text.includes(PROBE_MARKER)) return { ok: false, detail: '自检没拿到预期输出（命令没真正跑起来）' }
    return { ok: true, detail: '' }
  } catch (error: unknown) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) }
  }
}
