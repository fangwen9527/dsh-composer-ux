/**
 * 「按 route 分列」的纯逻辑：把一个会话的事件流折成 per-`(provider, model)` 的 token 桶。
 *
 * ## 为什么这件事只能在宿主半做
 *
 * 客户端拿到的两个官方投影都有天然上限：
 *   · `tokenUsage` 只有**整会话累计**的四个桶 —— 没有任何 provider/model 维度；
 *   · `modelSelection` 只保留 **`lastUsed`**（外加 pending）—— 一个会话里换过 route 之后，
 *     前面那些请求算在谁头上，客户端再也看不到。
 * 所以"官方 ¥x / go ¥y"这种分列必须回到**事件日志**里逐条归因，而完整事件只有宿主能读
 * （`sessionQuery.readSession()`；见 `src/host.ts` 那条只读路由）。
 *
 * ## 事件形状（按本版官方 `SessionEventMap` 的真实声明，不按记忆）
 *
 * 2026-09-28 真机踩过一次坑：最初照抄的社区实现折的是 `assistant/chunk` 事件，
 * 而**本版 DSH 根本没有这个事件类型**，于是分列一行都出不来（面板只显示"还没有可归因的用量"）。
 * 权威形状是：
 *
 *   · `request/header` → `data.header.config.{provider, model}`（官方 `modelSelection` 的
 *     `lastUsed` 取的就是这里）
 *   · `assistant/message` → `data.usage?: TokenUsage`（有时只有 `data.stream`）
 *   · `assistant/attempt` → 只有 `data.stream`；usage 藏在
 *     `stream[i].type === 'chunk' && stream[i].chunk.type === 'usage'` 里的**最后一条**
 *     （官方 `lastAssistantStreamChunk(stream, 'usage')` 就是从后往前找这一条）
 *
 * ## 三条口径（每条错了都会静默算错）
 *
 * 1. **归属**：一条 usage 记在它**之前最近一条** `request/header` 的 `(provider, model)` 头上。
 * 2. **同一步是替换而不是累加**：同一 `(turn, step)` 再次上报时要用"新值 − 旧值"替换旧值
 *    （官方 `addReplacing`）。直接累加会把同一步重复计费，直接覆盖又会丢掉前一次那份。
 * 3. **重试要重新开始记**：`llm/retry-started` 命中同一步时清掉替换槽（官方做法），
 *    这样重试那次的用量是**加**上去而不是减出来的。
 *
 * ## 出处
 *
 * 折叠口径与官方 `packages/llm/token-meter/src/usage-projection.ts` 逐条对齐
 * （`addReplacing` / 同一步替换 / `llm/retry-started`），事件取法对齐
 * `packages/llm/llm/src/assistant-stream.ts` 的 `lastAssistantStreamChunk`。
 * 早先参考的 `dsh-plugin-usage-meter@1.9.1`（MIT，Copyright (c) 2026 fancr-code）只贡献了
 * "按 provider/model 分列"这个**目标**与桶运算的写法。
 *
 * 本模块零 import、零 node API —— host 与 client 两半共用（客户端只用它的类型与常量）。
 */

/** 一个会话（或一个 route）的 token 桶，键名与官方 `TokenUsage` 一致。 */
export interface UsageBuckets {
  /** 未缓存输入（官方 `inputTokens`）。 */
  readonly inputTokens: number
  /** 输出（官方 `outputTokens`）。 */
  readonly outputTokens: number
  /** 缓存命中读取（官方 `cacheReadTokens`）。 */
  readonly cacheReadTokens: number
  /** 缓存写入（官方 `cacheWriteTokens`；DeepSeek 不单独计价，只进显示口径）。 */
  readonly cacheWriteTokens: number
}

/** 一条 route 的用量：`(provider, model)` 一对即一条。 */
export interface RouteUsage {
  readonly provider: string
  readonly model: string
  readonly usage: UsageBuckets
}

/** 一个会话折出来的结果。 */
export interface SessionUsageFold {
  /** 全部 route 相加（应当等于官方 `tokenUsage` 投影的四个桶）。 */
  readonly total: UsageBuckets
  /** 按 token 总量从多到少排好的 route 列表。 */
  readonly routes: readonly RouteUsage[]
  /** 折过的事件条数（诊断用：分列出不来时，界面靠它区分"没事件"和"形状不对"）。 */
  readonly events: number
  /** 真正折到 usage 的样本条数（诊断用）。 */
  readonly samples: number
}

/** 认不出 provider/model 时用的标签（客户端会把它标出来，不假装知道）。 */
export const UNKNOWN_ROUTE = '未知'

/** 全零桶。 */
export function zeroBuckets(): UsageBuckets {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }
}

/** 桶相加。 */
export function addBuckets(left: UsageBuckets, right: UsageBuckets): UsageBuckets {
  return {
    inputTokens: left.inputTokens + right.inputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    cacheReadTokens: left.cacheReadTokens + right.cacheReadTokens,
    cacheWriteTokens: left.cacheWriteTokens + right.cacheWriteTokens,
  }
}

/** 桶相减（同一步替换用）。 */
export function subBuckets(left: UsageBuckets, right: UsageBuckets): UsageBuckets {
  return {
    inputTokens: left.inputTokens - right.inputTokens,
    outputTokens: left.outputTokens - right.outputTokens,
    cacheReadTokens: left.cacheReadTokens - right.cacheReadTokens,
    cacheWriteTokens: left.cacheWriteTokens - right.cacheWriteTokens,
  }
}

/** 两个桶是否逐项相同。 */
function sameBuckets(left: UsageBuckets, right: UsageBuckets): boolean {
  return left.inputTokens === right.inputTokens
    && left.outputTokens === right.outputTokens
    && left.cacheReadTokens === right.cacheReadTokens
    && left.cacheWriteTokens === right.cacheWriteTokens
}

/** 桶是否全零。 */
function isZero(buckets: UsageBuckets): boolean {
  return buckets.inputTokens === 0 && buckets.outputTokens === 0
    && buckets.cacheReadTokens === 0 && buckets.cacheWriteTokens === 0
}

/** 桶的 token 总量（排序用）。 */
export function bucketTotal(buckets: UsageBuckets): number {
  return buckets.inputTokens + buckets.outputTokens + buckets.cacheReadTokens + buckets.cacheWriteTokens
}

/** 有限非负数才认，其余当 0（脏数据不许把金额算成 NaN）。 */
function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

/** 从 `request/header` 取 provider/model。 */
function headerOf(event: Record<string, unknown>): { provider: string; model: string } | undefined {
  if (event.type !== 'request/header') return undefined
  const data = event.data as { header?: { config?: { provider?: unknown; model?: unknown } } } | undefined
  const config = data?.header?.config
  if (config === undefined) return undefined
  const provider = typeof config.provider === 'string' && config.provider.length > 0 ? config.provider : UNKNOWN_ROUTE
  const model = typeof config.model === 'string' && config.model.length > 0 ? config.model : UNKNOWN_ROUTE
  return { provider, model }
}

/** 官方 `lastAssistantStreamChunk(stream,'usage')`：从后往前找最后一条 usage 原始块。 */
function lastUsageOf(stream: unknown): unknown {
  if (!Array.isArray(stream)) return undefined
  for (let index = stream.length - 1; index >= 0; index -= 1) {
    const record = stream[index] as { type?: unknown; chunk?: { type?: unknown; usage?: unknown } } | undefined
    if (record?.type === 'chunk' && record.chunk?.type === 'usage') return record.chunk.usage
  }
  return undefined
}

/** 从事件里取一次 usage 样本（形状按本版官方声明）。 */
function usageOf(event: Record<string, unknown>): unknown {
  if (event.type !== 'assistant/message' && event.type !== 'assistant/attempt') return undefined
  const data = event.data as Record<string, unknown> | undefined
  if (data === undefined) return undefined
  // `assistant/message` 常常直接带一份 usage；没有就退回它自己的 stream。
  if (event.type === 'assistant/message' && data.usage !== undefined) return data.usage
  return lastUsageOf(data.stream)
}

/** 官方 usage 形状 → 四个桶。 */
function bucketsOf(usage: unknown): UsageBuckets {
  const source = usage as Record<string, unknown> | undefined
  if (source === undefined || source === null || typeof source !== 'object') return zeroBuckets()
  return {
    inputTokens: count(source.inputTokens),
    outputTokens: count(source.outputTokens),
    cacheReadTokens: count(source.cacheReadTokens),
    cacheWriteTokens: count(source.cacheWriteTokens),
  }
}

/**
 * 把一个会话的事件流折成 per-route 用量。
 *
 * @param events 会话事件（`sessionQuery.readSession(sessionId).events`）；形状不对的条目直接跳过。
 * @returns 各 route 的用量（按 token 总量降序）、总和与诊断计数。
 */
export function foldSessionUsage(events: readonly unknown[]): SessionUsageFold {
  const byRoute = new Map<string, { provider: string; model: string; usage: UsageBuckets }>()
  let provider = UNKNOWN_ROUTE
  let model = UNKNOWN_ROUTE
  let last: { turn: unknown; step: unknown; buckets: UsageBuckets } | null = null
  let total = zeroBuckets()
  let samples = 0

  for (const raw of events) {
    if (typeof raw !== 'object' || raw === null) continue
    const event = raw as Record<string, unknown>
    const header = headerOf(event)
    if (header !== undefined) {
      provider = header.provider
      model = header.model
      continue
    }
    // 重试：同一步重新开始记（否则重试那次的用量会在替换时被减掉）。
    if (event.type === 'llm/retry-started') {
      const data = event.data as { turn?: unknown; step?: unknown } | undefined
      if (last !== null && data?.turn === last.turn && data?.step === last.step) last = null
      continue
    }
    const usage = usageOf(event)
    if (usage === undefined) continue
    const data = event.data as { turn?: unknown; step?: unknown }
    const buckets = bucketsOf(usage)
    samples += 1
    // 同一步再次上报 = 替换旧值（官方 addReplacing）：这次的值减去上一次那一步的值。
    const previous = last !== null && last.turn === data.turn && last.step === data.step
      ? last.buckets
      : undefined
    if (previous !== undefined && sameBuckets(previous, buckets)) continue
    const delta = previous === undefined ? buckets : subBuckets(buckets, previous)
    last = { turn: data.turn, step: data.step, buckets }
    if (isZero(delta)) continue
    const key = `${provider}\u0000${model}`
    const row = byRoute.get(key) ?? { provider, model, usage: zeroBuckets() }
    row.usage = addBuckets(row.usage, delta)
    byRoute.set(key, row)
    total = addBuckets(total, delta)
  }

  const routes = [...byRoute.values()]
    .filter(row => !isZero(row.usage))
    .sort((left, right) => bucketTotal(right.usage) - bucketTotal(left.usage))
  return { total, routes, events: events.length, samples }
}

/**
 * 一个会话的全部 route 之和与官方 `tokenUsage` 投影是否一致。
 *
 * 客户端用它决定"敢不敢把分列当成权威"：不一致说明日志里少了事件（例如日志尚未落盘），
 * 这时界面应当以投影为准并如实说明，而不是把两套数字并排摆着让人猜。
 */
export function agreesWithProjection(
  fold: Pick<SessionUsageFold, 'total'>,
  projection: UsageBuckets | undefined,
): boolean {
  if (projection === undefined) return true
  return sameBuckets(fold.total, bucketsOf(projection))
}
