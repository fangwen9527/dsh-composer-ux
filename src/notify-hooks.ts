/**
 * 把四个官方事件挂到通知上（0.17.0）。
 *
 * 为什么这一层与"渠道"无关：不管最后是把消息推给 PushPlus、企业微信，还是（调研之后可能改用的）
 * 腾讯 ClawBot，**"什么时机该通知"这件事是同一份**。所以它单独一层，渠道换掉不用重写。
 *
 * 三条硬约束（写成结构，而不是注释里的承诺）：
 *   1. **只观察，不干预** —— `approval/request` 与 `user-questions/request` 是 waterfall，
 *      我们的处理器必须**原样调用 `next()` 并返回它的结果**，绝不改决策、绝不代答；这一条有测试钉。
 *   2. **绝不因为通知出错而影响 DSH** —— 每个处理器整体包在 try/catch 里；通知失败只是没人收到提醒，
 *      绝不能让它变成"审批界面卡住"。
 *   3. **失败可诊断** —— 出错时只记一行（经调用方注入的 `warn`），不抛。
 */
import type { NotifyEvent } from './notify.ts'
import { notifyForAgentError, notifyForApproval, notifyForQuestion, notifyForStatus } from './notify-events.ts'

/** 事件处理器（waterfall 需要 next，emit 不需要）。 */
type Handler = (payload: unknown, next?: () => Promise<unknown>) => unknown

/** 注入面（便于真跑测试：假 ctx 记下注册了谁，再手动触发）。 */
export interface NotifyHooksIo {
  /** 注册一个监听器；返回注销函数。 */
  readonly on: (name: string, handler: Handler) => (() => void) | void
  /** 真正把事件交付出去（渠道由调用方决定）。 */
  readonly deliver: (event: NotifyEvent) => void
  /** 会话标题（拿不到就返回空串）。 */
  readonly titleOf: (sessionId: string | undefined) => string
  /** 只记一行日志（注入，便于测试断言"出错不影响主流程"）。 */
  readonly warn: (message: string) => void
  /** 审批请求里可选的工具名（payload 形状不可信，所以由调用方注入提取）。 */
  readonly toolNameOf?: (payload: unknown) => string | undefined
  /** 提问请求里可选的问题正文。 */
  readonly questionOf?: (payload: unknown) => string | undefined
  /** 从 payload 里取会话 id。 */
  readonly sessionIdOf?: (payload: unknown) => string | undefined
}

/** 要注册的事件名（导出便于测试与文档对齐）。 */
export const NOTIFY_EVENTS = [
  'approval/request',
  'user-questions/request',
  'agent/status',
  'agent/error',
] as const

/** 从 `{ agent }` 这类 payload 里尽力取一个会话标识（形状不可信，取不到就 undefined）。 */
function looseSessionId(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined
  const agent = (payload as { agent?: unknown }).agent
  if (typeof agent !== 'object' || agent === null) return undefined
  const id = (agent as { id?: unknown }).id
  if (typeof id === 'string' && id !== '') return id
  const sessionId = (agent as { sessionId?: unknown }).sessionId
  return typeof sessionId === 'string' && sessionId !== '' ? sessionId : undefined
}

/**
 * 注册全部通知钩子。
 * @param io 注入面。
 * @returns 注销函数（把所有监听器拆掉）。
 */
export function registerNotifyHooks(io: NotifyHooksIo): () => void {
  const disposers: (() => void)[] = []
  /** 每个 agent 的上一次状态（用于只在 running→idle 时报"完成"）。 */
  const lastStatus = new Map<string, string>()

  const safe = (label: string, run: () => void): void => {
    try {
      run()
    } catch (error) {
      // 通知坏掉不能连累 DSH：只记一行。
      io.warn(`[notify] ${label} 处理失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const add = (name: string, handler: Handler): void => {
    const dispose = io.on(name, handler)
    if (typeof dispose === 'function') disposers.push(dispose)
  }

  // ① 等审批：**透传** —— 原样把 next() 的结果还回去。
  add('approval/request', (payload, next) => {
    safe('approval/request', () => {
      const sessionId = io.sessionIdOf?.(payload) ?? looseSessionId(payload)
      io.deliver(notifyForApproval(io.titleOf(sessionId), io.toolNameOf?.(payload)))
    })
    return next === undefined ? undefined : next()
  })

  // ② 等回答：同样透传。
  add('user-questions/request', (payload, next) => {
    safe('user-questions/request', () => {
      const sessionId = io.sessionIdOf?.(payload) ?? looseSessionId(payload)
      io.deliver(notifyForQuestion(io.titleOf(sessionId), io.questionOf?.(payload)))
    })
    return next === undefined ? undefined : next()
  })

  // ③ 状态变化：只在 running → idle 时报"完成"（开始干活不打扰）。
  add('agent/status', (payload) => {
    safe('agent/status', () => {
      const sessionId = io.sessionIdOf?.(payload) ?? looseSessionId(payload) ?? ''
      const status = typeof payload === 'object' && payload !== null
        ? (payload as { status?: unknown }).status
        : undefined
      if (typeof status !== 'string') return
      const event = notifyForStatus(lastStatus.get(sessionId), status, io.titleOf(sessionId))
      lastStatus.set(sessionId, status)
      if (event !== null) io.deliver(event)
    })
  })

  // ④ 出错。
  add('agent/error', (payload) => {
    safe('agent/error', () => {
      const sessionId = io.sessionIdOf?.(payload) ?? looseSessionId(payload) ?? ''
      const error = typeof payload === 'object' && payload !== null
        ? (payload as { error?: unknown }).error
        : undefined
      io.deliver(notifyForAgentError(io.titleOf(sessionId), error))
    })
  })

  return () => {
    for (const dispose of disposers) {
      try {
        dispose()
      } catch {
        // 注销失败无所谓：进程要退出了。
      }
    }
    disposers.length = 0
    lastStatus.clear()
  }
}
