/**
 * bash 工具的结果渲染与退出状态解析。
 *
 * 这里的每一根字符串都**逐字对齐**官方 `@deepseek-ai/dsh-tool-bash`（+ `dsh-shell` 的
 * render / `dsh-sandbox` 的两个标记），因为它们是**模型看到的行为**：标记顺序、`[stderr]`
 * 头、`(no output)` 兜底、以及"退出状态必须挂在最末尾"（终端卡片靠这个锚点把它拆成 pill）。
 *
 * 为什么不直接 import 官方包：本插件的宿主半是自包含产物（见 build.mjs，只内联
 * schemastery/cosmokit），引入官方运行时会把它绑死在某个 DSH 版本上，还会让市场体检
 * 报「依赖了共享宿主包」。官方那 5 个运行时符号（常量与两个纯函数式的标记构造器）
 * 在这里本地等价实现，行为一致。
 */

import {
  ESCALATION_TARGETS, escalationHintMarker, sandboxDenialMarker, type SandboxMode,
} from './sandbox.ts'

export { ESCALATION_TARGETS, escalationHintMarker, sandboxDenialMarker, type SandboxMode }

/** 受管环境变量的前缀（官方 `DSH_ENV_PREFIX`）。 */
export const DSH_ENV_PREFIX = 'DSH_'

/** 一段流式输出（官方 `CollectedOutput` 的可观测子集）。 */
export interface StreamOutput {
  readonly text: string
  readonly truncated: boolean
  readonly spillPath?: string
}

/** 沙箱事实。 */
export interface SandboxFacts {
  readonly mode: SandboxMode | string
  readonly denied: boolean
  readonly enforcement?: string
  readonly runnerFailed?: boolean
}

/** 一次前台执行的结果（官方 `ShellRunResult` 的可观测子集）。 */
export interface BashRunResult {
  readonly exitCode: number | null
  readonly signal: string | null
  readonly timedOut: boolean
  readonly aborted: boolean
  readonly timeoutMs: number
  readonly stdout: StreamOutput
  readonly stderr: StreamOutput
  readonly sandbox?: SandboxFacts
}

/** 后台任务增量读取的一帧（官方 `ShellProcessRead` 的可观测子集）。 */
export interface ProcessRead {
  readonly delta: string
  readonly lossy: boolean
  readonly stdoutSpillPath?: string
  readonly stderrSpillPath?: string
}

/** 退出状态拆解结果：正文 + 要么 exitCode、要么 signal。 */
export type ParsedExitStatus = { readonly body: string } & (
  | { readonly exitCode: number }
  | { readonly signal: string }
)

/**
 * 拆出末尾的退出状态。
 *
 * 为什么必须锚在**末尾**：终端卡片把 exit 状态显示成独立的 pill，标记得从正文里摘掉；
 * 官方因此把标记放在最后，并用 `$` 锚定。注意 `[exit code: null]`（进程被信号杀掉、
 * 退出码未知）**不匹配** `\d+`，所以它会留在正文里——这是官方行为，不要"顺手修好"。
 */
export function parseExitStatus(text: string): ParsedExitStatus {
  const signal = /\n\[killed by signal: ([^\]\n]+)\]$/.exec(text)
  if (signal?.[1] !== undefined) return { body: text.slice(0, signal.index), signal: signal[1] }
  const exit = /\n\[exit code: (\d+)\]$/.exec(text)
  if (exit?.[1] !== undefined) return { body: text.slice(0, exit.index), exitCode: Number(exit[1]) }
  return { body: text, exitCode: 0 }
}

/** 输出体：截断时补一行"完整输出在哪"。 */
function streamText(output: StreamOutput): string {
  if (!output.truncated) return output.text
  return `${output.text}\n[output truncated; full output: ${output.spillPath ?? '(unavailable)'}]`
}

/**
 * 前台结果 → 给模型看的正文（官方 `renderResult`）。
 *
 * 标记顺序是契约：沙箱拒绝 → 升级提示 → 超时 → 最后才是 signal **或** exit code。
 * 退出码为 0 且无信号时不产生任何标记。
 */
export function renderBashResult(result: BashRunResult, escalationModes: readonly SandboxMode[] = []): string {
  const out = streamText(result.stdout)
  const err = streamText(result.stderr)
  let body = out
  if (err.length > 0) {
    if (body.length > 0 && !body.endsWith('\n')) body += '\n'
    body += `[stderr]\n${err}`
  }
  if (body.length === 0) body = '(no output)'
  const markers: string[] = []
  if (result.sandbox?.denied === true) {
    markers.push(sandboxDenialMarker(result.sandbox.mode))
    if (escalationModes.length > 0) markers.push(escalationHintMarker('command'))
  }
  if (result.timedOut) markers.push(`[timed out after ${result.timeoutMs}ms]`)
  if (result.signal !== null) markers.push(`[killed by signal: ${result.signal}]`)
  else if (result.exitCode !== 0) markers.push(`[exit code: ${result.exitCode}]`)
  if (markers.length === 0) return body
  if (!body.endsWith('\n')) body += '\n'
  return body + markers.join('\n')
}

/**
 * 后台任务的一帧 → 给模型看的增量（官方 `renderProcessRead`）。
 * 丢了内存里的输出、以及沙箱自身失败，都要在这里如实说出来（它们与"命令失败"不同）。
 */
export function renderProcessRead(
  read: ProcessRead,
  sandbox: SandboxFacts | undefined,
  escalationModes: readonly SandboxMode[] = [],
): string {
  const notices: string[] = []
  if (read.lossy) {
    const paths = [read.stdoutSpillPath, read.stderrSpillPath]
      .filter((path): path is string => path !== undefined)
    notices.push('[some output was dropped from memory; full output: '
      + `${paths.length > 0 ? paths.join(', ') : '(unavailable)'}]`)
  }
  if (sandbox?.runnerFailed === true) {
    notices.push(`[sandbox: the sandbox runner itself failed under ${sandbox.mode} mode — `
      + 'the command did not run; this is a sandbox problem, not a command failure]')
  } else if (sandbox?.denied === true) {
    notices.push(sandboxDenialMarker(sandbox.mode))
    if (escalationModes.length > 0) notices.push(escalationHintMarker('command'))
  }
  if (notices.length === 0) return read.delta
  const separator = read.delta.length > 0 && !read.delta.endsWith('\n') ? '\n' : ''
  return `${read.delta}${separator}${notices.join('\n')}`
}
