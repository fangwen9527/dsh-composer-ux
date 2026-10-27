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

/** 宿主半算好的一行：`(provider, model, 档位, 价格档)` + token 桶 + 金额（含分项与单价）。 */
export interface SessionCostRoute {
  readonly provider?: string
  readonly model?: string
  /** 这一行是高峰档（true）还是空闲档（false）。第三方路由恒 false（它们没有峰谷两档）。 */
  readonly peak?: boolean
  /** 这一行按哪个**价格历史档**结算（`pricing.ts` 的 era id）；第三方路由是空串。 */
  readonly era?: string
  readonly usage?: SessionCostBuckets
  /** 这一行的金额（元）。`unpriced` 为 true 时是 0。 */
  readonly cost?: number
  readonly parts?: { readonly miss?: number; readonly hit?: number; readonly out?: number }
  /** 这一行实际用的单价（界面原样显示"按什么价算的"）。 */
  readonly price?: { readonly miss?: number; readonly hit?: number; readonly out?: number }
  /** 单价来源：`official` / `override` / `provider` / `none`。 */
  readonly priceSource?: string
  /** 单价被你的覆盖价改过。 */
  readonly overridden?: boolean
  /** **认不出价**（第三方路由且同步价目与内置快照里都没有它）：金额是 0，界面要写"未定价"而不是 ¥0.00。 */
  readonly unpriced?: boolean
  /** 单价来自**内置快照**（不是用户点过一次的同步价目）——界面据此标明可能过时。 */
  readonly priceBuiltin?: boolean
}

/**
 * 子代理（subagent）那半边账（0.24.0）。
 *
 * ## 为什么单列一块，不折进顶层 `total` / `cost`
 *
 * 顶层的 `total` / `cost` / `routes` / `tiers` **只统计本会话**，而且必须一直如此：客户端拿
 * `agreesWithProjection()` 判"宿主半的分列敢不敢当权威"时，比对的是官方 `tokenUsage` 投影，
 * 而那份投影**只有本会话**（子会话的事件在自己的日志里，不进父会话投影）。把子代理的钱并进
 * 顶层，那个判据会永远不成立 —— 宿主半算得分毫不差，界面却退化成"估算"口径（"日志 vs 投影"
 * 这条判据的来历见 `usage-fold.ts` 文件头）。所以子代理的合计单独一块交给客户端，
 * 由它在"本会话分列可信"之后**自己决定**怎么并进展示数字。
 *
 * ## 字段都是可选的，缺了就是"没有子代理"
 *
 * 老宿主（0.23.x 及以前）根本不会回这块；客户端必须把 `subagents === undefined` 当成
 * `sessions === 0` 处理 —— 浮层一个字都不许多出来。
 *
 * ## 为什么 `missing` / `external` / `skipped` / `unpriced` 要一个个报出来
 *
 * 子代理的费用是"读别人的日志读出来的"，读不全有四种完全不同的原因（见下面每个字段），
 * 而界面上只有一个金额。不把这些数报出来，用户看到的就是"我明明跑了 5 个子代理，钱怎么只多了
 * 一点点"—— 只能自己猜。所以它们不是诊断字段，是**金额的一部分解释**，界面要写在脸上。
 */
export interface SessionCostSubagents {
  /** 折到日志的子代理会话数（含孙代理：递归折下去的都算）。 */
  readonly sessions?: number
  /** 其中当前仍活着的会话数（还可能在长；胶囊本身随着用量刷新，这里只用于诊断展示）。 */
  readonly live?: number
  /** catalog 里有、但本机读不到日志（已归档 / 外部执行到一半失去日志 / 读失败）的个数。 */
  readonly missing?: number
  /** catalog 里 `mode: 'external'`（claude-code / codex / acp 那类外部执行）的个数：本机没有会话，用量拿不到。 */
  readonly external?: number
  /** 因超过单次读取上限没读的个数（会话太多时只折前 N 个，省得一个请求读完几百个日志）。 */
  readonly skipped?: number
  /** 子代理合计 token 桶（四个键名与顶层 `total` 相同）。 */
  readonly total?: SessionCostBuckets
  /**
   * 子代理合计金额（与顶层 `cost` 同形）。
   *
   * 注意它**没有**按下峰谷/价格档拆开（见 `tiers`）：宿主半只把子代理的总金额算出来，
   * 所以界面不能用"子代理 token × 某一档单价"去编造按档金额。
   */
  readonly cost?: { readonly miss?: number; readonly hit?: number; readonly out?: number; readonly total?: number }
  /** 子代理的高峰 / 空闲小计（**桶，不是金额**）。 */
  readonly tiers?: { readonly peak?: SessionCostBuckets; readonly offPeak?: SessionCostBuckets }
  /** 子代理里有几行没认出价（那部分金额按 0 计）。 */
  readonly unpriced?: number
}

/** `/composer-ux/usage` 的响应（0.9.1 起多带回 `tiers` 与算好的 `cost`；0.10.0 加价格档与节假日）。 */
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
  /**
   * 子代理的合计（0.24.0）。**顶层那几个字段因此不变**：它们仍然只统计本会话，见
   * {@link SessionCostSubagents} 里"为什么单列一块"。
   *
   * 老宿主不回这个字段 ⇒ 一律当"没有子代理"处理（金额、浮层、胶囊文案逐字节保持 0.23.x）。
   */
  readonly subagents?: SessionCostSubagents
  /**
   * 订阅通道的**额度**口径（0.26.0）：本会话（含子代理）吃掉了多少套餐额度（美元）。
   *
   * 与 `cost`（按刊例价折算的人民币）**是两套口径**，别相加、也别互相覆盖：
   * `cost` 回答"这些 token 值多少钱"，`quota` 回答"你实际被扣掉多少额度"。
   * 用户 2026-10-27 选定：胶囊默认显示后者（带 `订阅内` 标），展开再看折算金额。
   */
  readonly quota?: SessionCostQuota
  /** 额度窗口（5 小时 / 周 / 月）；只在用到订阅通道时才回。 */
  readonly plan?: SessionCostPlan
  /**
   * 宿主半当前生效的节假日表（北京日期）。
   *
   * 客户端算"下一次峰谷切换"用**同一份**规则：各拿一份表就会出现"胶囊说还有 3 分钟进峰、
   * 面板说不是"这种无法解释的分歧。宿主没回（老版本/取数失败）时退回设置里的或内置那份。
   */
  readonly holidays?: readonly string[]
}

/** 一个模型在本会话里消耗的额度（0.26.0）。 */
export interface SessionCostQuotaModel {
  /** 价目表里的模型键（已归一，例如 `deepseek-v4.1-flash`）。 */
  readonly model?: string
  /** 消耗的额度（美元）。 */
  readonly usd?: number
  /** 该模型的月度额度上限（美元）；官方没公布时缺失。 */
  readonly monthlyLimitUsd?: number
  /** 占该模型月度上限的百分比（0–100）；没有上限时缺失。 */
  readonly percentOfLimit?: number
}

/** 本会话（含子代理）的额度合计（0.26.0）。 */
export interface SessionCostQuota {
  readonly usd?: number
  readonly models?: readonly SessionCostQuotaModel[]
}

/** 一段额度窗口（0.26.0）。`percent` 是**已用**百分比。 */
export interface SessionCostQuotaWindow {
  readonly id?: 'rolling' | 'weekly' | 'monthly'
  readonly percent?: number
  readonly resetsAt?: string
}

/** 订阅套餐的额度快照（0.26.0）。 */
export interface SessionCostPlan {
  readonly provider?: string
  readonly displayName?: string
  /**
   * `ok` = 拿到了；`pending` = 第一次取、后台还在请求（界面显示"正在取额度…"）；
   * `not-configured` = 没配 key；`unavailable` = 接口失败；`invalid` = 响应形状不对。
   */
  readonly status?: 'ok' | 'pending' | 'not-configured' | 'unavailable' | 'invalid'
  readonly windows?: readonly SessionCostQuotaWindow[]
  /** 取到时刻（毫秒；失败时是上次成功的时刻）。 */
  readonly fetchedAt?: number
  /** 失败原因（给人看的一句话）。 */
  readonly reason?: string
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

  React.useEffect(() => {
    // ⚠️ 重置为 true：StrictMode（及某些 HMR 重挂）会走"挂载 → 清理 → 再挂载"，
    // ref 在同一轮里是同一个 —— 不重置的话 `alive` 永远 false，之后所有响应被静默丢弃，
    // 界面上表现为"胶囊永远停在本地估算那一个数"。
    alive.current = true
    return () => {
      alive.current = false
      if (timer.current !== null) clearTimeout(timer.current)
    }
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
