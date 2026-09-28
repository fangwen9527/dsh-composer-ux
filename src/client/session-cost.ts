/**
 * 「金额」的宿主半取数（0.9.1）：折叠态那颗胶囊也要**逐笔准时**。
 *
 * ## 为什么胶囊必须问宿主半
 *
 * 客户端能拿到的只有整会话累计的 token 桶（`tokenUsage` 投影）——**没有任何时间信息**。
 * 而峰谷价差 2 倍，要"按用量真正发生的时刻"计价就必须知道每一笔发生在什么时候；那份信息
 * 只在会话事件里（官方 `SessionEvent.time`），只有宿主半读得到。0.8.0 拿"你看面板的那一秒"
 * 当所有用量的时刻，于是昨晚跑的会话今天上午看会整份按高峰价显示（差 2 倍，屏幕上只是个数字）。
 *
 * ## 节奏：节流 + 尾随 + 单飞
 *
 * 流式期间投影每一小段就变一次（一帧可能变好几次），不能变一次发一个请求：
 *   · 最短间隔 {@link MIN_INTERVAL_MS}，期间来的变化排一个**尾随**请求 ——
 *     尾随保证"流结束后的那个数字"是准的（最后一批 token 也计进去）；
 *   · 同一时刻只有一个请求在飞；飞行期间来的变化只置一个标记，回来后补发；
 *   · 回来的响应按序号丢弃旧的（会话切换、慢响应都不会把新数字盖成旧的）。
 *
 * 宿主半那边是 O(1) 取缓存（见 `src/host.ts` 的增量折叠与 `session/event` 订阅），
 * 所以这个节奏不会变成负担。取不到时调用方用本地估值兜底 —— 胶囊从不空着。
 */
import React from 'react'
import { USAGE_API_PATH } from '../settings-contract.ts'

/** 两个请求之间至少隔这么久。 */
const MIN_INTERVAL_MS = 600

/** 一个 token 桶（键名与官方 `TokenUsage` 一致）。 */
export interface SessionCostBuckets {
  readonly inputTokens?: number
  readonly outputTokens?: number
  readonly cacheReadTokens?: number
  readonly cacheWriteTokens?: number
}

/** 宿主半算好的一行：`(provider, model, 档位)` + token 桶 + 金额（含分项）。 */
export interface SessionCostRoute {
  readonly provider?: string
  readonly model?: string
  /** 这一行是高峰档（true）还是空闲档（false）。 */
  readonly peak?: boolean
  readonly usage?: SessionCostBuckets
  /** 这一行的金额（元）。 */
  readonly cost?: number
  readonly parts?: { readonly miss?: number; readonly hit?: number; readonly out?: number }
}

/** `/composer-ux/usage` 的响应（0.9.1 起多带回 `tiers` 与算好的 `cost`）。 */
export interface SessionCostResponse {
  readonly ok?: boolean
  readonly error?: string
  /** 事件来源：`sessionQuery`（完整日志）/ `cache`（增量折叠器）/ `none`。 */
  readonly source?: string
  /** 折过的事件条数与折到 usage 的条数（诊断用：区分"没事件"与"形状不对"）。 */
  readonly events?: number
  readonly samples?: number
  readonly total?: SessionCostBuckets
  readonly tiers?: { readonly peak?: SessionCostBuckets; readonly offPeak?: SessionCostBuckets }
  readonly routes?: readonly SessionCostRoute[]
  readonly cost?: { readonly miss?: number; readonly hit?: number; readonly out?: number; readonly total?: number }
}

/** 取数结果：`data` 一定对应当前 `sessionId`（会话切换期间的旧响应不会被交出来）。 */
export interface SessionCostState {
  readonly data: SessionCostResponse | null
  /** 有请求在飞（面板据此显示"正在按 route 归因…"）。 */
  readonly loading: boolean
}

/**
 * 按会话取一次"宿主半算好的费用"，随 `fingerprint` 变化节流刷新。
 *
 * @param sessionId 会话 id；空则不取（例如槽位没给 sessionId 的场合）。
 * @param fingerprint 变化即视为"用量变了"的字符串（调用方传四个桶拼起来的串）。
 * @param force 为 true 时忽略节流、立刻取一次（点开面板时用：那一屏的数字要当场是准的）。
 * @returns 当前数据与是否在飞。
 */
export function useSessionCost(
  sessionId: string | undefined,
  fingerprint: string,
  force: boolean,
): SessionCostState {
  const [entry, setEntry] = React.useState<{ readonly sessionId: string; readonly data: SessionCostResponse } | null>(null)
  const [loading, setLoading] = React.useState(false)
  const lastAt = React.useRef(0)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const inflight = React.useRef(false)
  const again = React.useRef(false)
  const serial = React.useRef(0)
  const alive = React.useRef(true)
  /** 最新的"发一次请求"函数（`finally` 里补发尾随时用，避免闭包自引用与陈旧闭包）。 */
  const runRef = React.useRef<() => void>(() => {})

  React.useEffect(() => () => {
    alive.current = false
    if (timer.current !== null) clearTimeout(timer.current)
  }, [])

  const run = React.useCallback((): void => {
    if (typeof sessionId !== 'string' || sessionId === '') return
    if (inflight.current) {
      again.current = true
      return
    }
    inflight.current = true
    again.current = false
    lastAt.current = Date.now()
    const mine = serial.current + 1
    serial.current = mine
    setLoading(true)
    fetch(`${USAGE_API_PATH}?sessionId=${encodeURIComponent(sessionId)}`, {
      headers: { accept: 'application/json' },
    })
      .then(response => response.json() as Promise<SessionCostResponse>)
      .then(next => {
        if (!alive.current || mine !== serial.current) return
        setEntry({ sessionId, data: next })
      })
      .catch(() => {
        if (!alive.current || mine !== serial.current) return
        setEntry({ sessionId, data: { ok: false, error: '取不到会话费用' } })
      })
      .finally(() => {
        inflight.current = false
        if (!alive.current) return
        setLoading(false)
        if (again.current) {
          again.current = false
          runRef.current()
        }
      })
  }, [sessionId])
  runRef.current = run

  React.useEffect(() => {
    if (typeof sessionId !== 'string' || sessionId === '') return
    const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastAt.current))
    // `force`（点开面板）不排队：它要的就是"当场一次准的"。
    if (wait === 0 || force) {
      run()
      return
    }
    if (timer.current !== null) return
    timer.current = setTimeout(() => {
      timer.current = null
      runRef.current()
    }, wait)
    // 只在会话/指纹/强制标记变化时触发；`run` 只依赖 sessionId。
  }, [sessionId, fingerprint, force, run])

  return {
    data: entry !== null && entry.sessionId === sessionId ? entry.data : null,
    loading,
  }
}
