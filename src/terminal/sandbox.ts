/**
 * 沙箱策略与升级审批：与官方 `@deepseek-ai/dsh-sandbox`（`src/escalation.ts`）**同语义**的
 * 本地实现。
 *
 * 为什么本地实现而不是 import：本插件宿主半是自包含产物（build.mjs 只内联
 * schemastery/cosmokit），引官方运行时会把它绑死在某个 DSH 版本，并且市场体检会因为
 * 「依赖了共享宿主包」给出警告。而这些语义本身是**稳定的契约**（模式词汇、更宽顺序、
 * 审批文案、fail-closed 规则），逐字照抄比"用不了就崩"更可靠。
 *
 * 三处必须逐字一致，否则用户看到的文案会与官方工具不同：
 *  - `sandboxDenialMarker` / `escalationHintMarker` 的文本；
 *  - `WIDER_MODES` 的严格更宽顺序（「不更宽」是错误，不是空操作）；
 *  - 审批失败文案与 fail-closed（没有审批服务 / 没有 agent 都必须拒绝，不能放行）。
 */

/** 文件效果模式。 */
export type SandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access'

/** 可被 confining 的模式（`danger-full-access` 不受限，故不在其中）。 */
export type ConfinedSandboxMode = Exclude<SandboxMode, 'danger-full-access'>

/** 每条模式能升级到的更宽模式（顺序即优先级）。 */
export const WIDER_MODES: Record<string, readonly SandboxMode[]> = {
  'read-only': ['workspace-write', 'danger-full-access'],
  'workspace-write': ['danger-full-access'],
}

/** 升级目标的封闭词汇（没有任何东西会升级到 read-only）。 */
export const ESCALATION_TARGETS: readonly SandboxMode[] = ['workspace-write', 'danger-full-access']

/** 一次调用的完整策略（官方 `SandboxExecutionPolicy`）。 */
export interface SandboxExecutionPolicy {
  readonly mode: SandboxMode
  /** `workspace-write` 的绝对根目录。 */
  readonly workspaceRoot: string
  readonly sessionId?: string
}

/** `sandbox.confine` 的返回值（官方 `ConfinedArgv`）。 */
export interface ConfinedArgv {
  /** 包好后应当 spawn 的 argv。 */
  readonly argv: readonly string[]
  readonly enforcement: 'full' | 'partial'
  /** 该后端拒绝文件效果时 stderr 里会出现的特征串（大小写不敏感）。 */
  readonly denialSignatures: readonly string[]
  /** runner 自身失败的判定规则；命中说明"命令没跑"，与"被拒绝"不同。 */
  readonly runnerFailureRules: readonly {
    readonly allowedExitCodes?: readonly number[]
    readonly fatalSignatures: readonly string[]
    readonly informationalLines?: readonly string[]
  }[]
}

/** 只取本插件用得到的那一面（结构性窄化，不 import 官方类型）。 */
export interface SandboxLike {
  confine(argv: readonly string[], policy: SandboxExecutionPolicy, signal?: AbortSignal): Promise<ConfinedArgv>
}

/** 策略解析服务（官方 `SandboxPolicyService.resolve`）。 */
export interface SandboxPolicyLike {
  resolve(request?: { readonly session?: unknown; readonly mode?: SandboxMode }): SandboxExecutionPolicy
}

/** 审批结果（官方 `ApprovalOutcome`）。 */
export type EscalationOutcome = 'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'

/** 审批服务的结构面（官方 `EscalationApprover`）。 */
export interface EscalationApproverLike<A = unknown, C = string> {
  request(req: {
    agent: A
    toolName: string
    callId: C
    reason: string
    signal?: AbortSignal
  }): Promise<EscalationOutcome>
}

/** 请求升级所需的上下文。 */
export interface EscalationApproval<A = unknown, C = string> {
  readonly approver: EscalationApproverLike<A, C> | undefined
  readonly agent: A | undefined
  readonly callId: C
  readonly toolName: string
  readonly signal?: AbortSignal
}

/** 升级请求。 */
export interface EscalationRequest {
  readonly requestedMode: string
  readonly justification: string
  /** 本次调用的当前模式；与它相同时无需审批。 */
  readonly effectiveMode: SandboxMode
  /** 面向用户的动作名词（bash 是 `command`，文件操作是 `operation`）。 */
  readonly subject: string
}

/** 沙箱拒绝标记（与官方逐字一致）。 */
export function sandboxDenialMarker(mode: SandboxMode | string): string {
  return `[sandbox: file access denied under ${mode} mode]`
}

/** 升级提示标记（与官方逐字一致）。 */
export function escalationHintMarker(subject: string): string {
  return `[sandbox: escalation available — retry this exact ${subject} once with sandbox_permissions `
    + '(the narrowest wider mode that suffices) + justification; the approval prompt asks the user]'
}

/** 升级参数校验（与官方逐字一致的三条错误）。 */
export function validateEscalationArgs(
  sandboxPermissions: string | undefined,
  justification: string | undefined,
): void {
  if (sandboxPermissions !== undefined && justification === undefined) {
    throw new Error('invalid escalation: sandbox_permissions requires a justification')
  }
  if (justification !== undefined && sandboxPermissions === undefined) {
    throw new Error('invalid escalation: justification is only valid together with sandbox_permissions')
  }
  if (justification !== undefined && justification.trim().length === 0) {
    throw new Error('invalid justification: expected a non-empty sentence')
  }
}

/**
 * 审批一次升级（与官方 `approveEscalation` 同语义）。
 *
 * 几个刻意的行为，别"顺手优化"：
 *  - 请求的模式与当前模式**相同**时直接返回，不打扰用户；
 *  - 不是**严格更宽**就报错（`read-only → read-only` 不是空操作，是配置错误）；
 *  - 没有审批服务、或没有 agent 可路由时**一律拒绝**（fail-closed，绝不默认放行）。
 * @param request 升级请求。
 * @param approval 审批上下文。
 * @returns 获批的模式。
 */
export async function approveEscalation<A, C>(
  request: EscalationRequest,
  approval: EscalationApproval<A, C>,
): Promise<SandboxMode> {
  const { requestedMode: mode, effectiveMode, justification, subject } = request
  if (mode === effectiveMode) return effectiveMode
  if (!(WIDER_MODES[effectiveMode] ?? []).includes(mode as SandboxMode)) {
    throw new Error(`sandbox escalation to "${mode}" is not strictly wider than this call's current "${effectiveMode}" mode`)
  }
  if (approval.approver === undefined) {
    throw new Error(`sandbox escalation to "${mode}" requires approval, but no approval service is composed`)
  }
  if (approval.agent === undefined) {
    throw new Error(`sandbox escalation to "${mode}" requires approval, but the call has no agent to route it through`)
  }
  const outcome = await approval.approver.request({
    agent: approval.agent,
    toolName: approval.toolName,
    callId: approval.callId,
    reason: `escalate sandbox to ${mode}: ${justification}`,
    ...approval.signal === undefined ? {} : { signal: approval.signal },
  })
  switch (outcome) {
    case 'allowed-once': return mode as SandboxMode
    case 'rejected': throw new Error(`the user rejected escalating this ${subject} to "${mode}"`)
    case 'cancelled': throw new Error(`approval for escalating to "${mode}" was cancelled`)
    case 'unavailable': throw new Error(`sandbox escalation to "${mode}" requires approval, but no approval channel is available`)
    default: throw new Error(`unexpected escalation outcome ${JSON.stringify(outcome)}`)
  }
}
