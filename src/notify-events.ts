/**
 * 官方事件 → 微信通知的适配层（0.17.0）。
 *
 * 为什么单独一层：三个事件（等审批 / 完成 / 出错）的**原始 payload 形状完全不同** ——
 * `approval/request` 是 waterfall 的决策请求、`agent/status` 只是"状态变了"、`agent/error`
 * 带一个 `unknown` 的 error。把"从这些形状里提取出该告诉用户的那一句话"抽成纯函数，
 * 才能真的测（而不是挂在事件上靠肉眼试）。
 *
 * 红线（用户划的，写在这里当护栏）：
 *   · **只观察、不干预** —— 这一层不返回任何决策，也不改 payload；
 *   · **不代答** —— 绝不因为收到审批请求就替用户批准/拒绝；
 *   · 消息里**不放**凭据、不放完整命令正文（截断），只给"是什么事、哪个会话、什么时候"。
 */
import type { NotifyEvent } from './notify.ts'

/** 摘要上限（微信里一行太长没人看；也避免把长命令/长堆栈整段推出去）。 */
export const NOTIFY_DETAIL_MAX = 160

/**
 * 把任意一段文本压成适合推送的一行。
 *
 * 为什么要它：错误对象与工具参数里可能带换行、超长路径甚至凭据；推送出去就收不回来了。
 * @param value 原始文本。
 * @returns 单行、去首尾空白、超长截断并加省略号的文本。
 */
export function summarize(value: string): string {
  const one = value.replace(/\s+/gu, ' ').trim()
  if (one.length <= NOTIFY_DETAIL_MAX) return one
  return `${one.slice(0, NOTIFY_DETAIL_MAX - 1)}…`
}

/**
 * 从 `unknown` 的 error 里取一句人话。
 * @param error 事件给的 error（形状不可信）。
 * @returns 单行摘要；取不到就给个中性说法。
 */
export function describeError(error: unknown): string {
  if (error === null || error === undefined) return '原因未知（事件里没带 error）'
  if (typeof error === 'string') return summarize(error)
  if (typeof error === 'object') {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message !== '') return summarize(message)
  }
  if (typeof error === 'number' || typeof error === 'boolean') return String(error)
  return '原因未知（error 不是常见形状）'
}

/** 审批请求要告诉用户的那条。 */
export function notifyForApproval(sessionTitle: string, toolName: string | undefined): NotifyEvent {
  return {
    kind: 'needs-input',
    sessionTitle,
    detail: toolName === undefined || toolName === ''
      ? '有一条操作等你审批（回 DSH 界面处理）'
      : `有一条操作等你审批：${summarize(toolName)}（回 DSH 界面处理）`,
  }
}

/** 结构化提问要告诉用户的那条。 */
export function notifyForQuestion(sessionTitle: string, question: string | undefined): NotifyEvent {
  return {
    kind: 'needs-input',
    sessionTitle,
    detail: question === undefined || question === ''
      ? '有一个问题等你回答（回 DSH 界面处理）'
      : `等你回答：${summarize(question)}`,
  }
}

/**
 * 状态变化要不要发"完成"。
 *
 * 只在 `running → idle` 时发：`idle → running` 是"开始干活"，用户不需要被通知；
 * 而反复的 `idle → idle` 之类噪声必须挡掉，否则一次长会话能把手机刷爆。
 * @param previous 上一个状态（未知就传 undefined）。
 * @param next 新状态。
 * @returns 该发就返回事件，否则 null。
 */
export function notifyForStatus(previous: string | undefined, next: string, sessionTitle: string): NotifyEvent | null {
  if (previous !== 'running' || next !== 'idle') return null
  return { kind: 'done', sessionTitle, detail: '这一轮跑完了（详细内容回 DSH 界面看）' }
}

/** 出错要告诉用户的那条。 */
export function notifyForAgentError(sessionTitle: string, error: unknown): NotifyEvent {
  return { kind: 'error', sessionTitle, detail: `出错了：${describeError(error)}` }
}
