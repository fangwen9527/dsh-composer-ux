/**
 * 「按 route 分列」的纯逻辑：把一个会话的事件流折成 per-`(provider, model, 档位, 价格档)` 的 token 桶。
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
 * ## 五条口径（每条错了都会静默算错）
 *
 * 1. **归属**：一条 usage 记在它**之前最近一条** `request/header` 的 `(provider, model)` 头上。
 * 2. **同一步是替换而不是累加**：同一 `(turn, step)` 再次上报时要用"新值 − 旧值"替换旧值
 *    （官方 `addReplacing`）。直接累加会把同一步重复计费，直接覆盖又会丢掉前一次那份。
 * 3. **重试要重新开始记**：`llm/retry-started` 命中同一步时清掉替换槽（官方做法），
 *    这样重试那次的用量是**加**上去而不是减出来的。
 * 4. **档位按请求发生的时刻判，并固化进 key**（0.9.1 起判峰谷、0.10.0 起连价格档一起判）：
 *    官方按请求发生时刻计费（高峰价是空闲价的 2 倍，且官方会调价），所以一条 usage 的档位
 *    取"它那条 `request/header` 的时间"（没有就用事件自己的 `time`，两者都没有则把
 *    `Number.NaN` 交给调用方兜底）。**同一步后续的替换增量沿用该步第一次判定的档位** ——
 *    否则一次跨越 09:00 的请求会被拆成两档，凭空多出一个"高峰用量"。
 *    判定函数由调用方注入（{@link TierAt}），本模块不 import 任何东西。
 * 5. **价格档是 key 的一部分**（0.10.0）：官方 2026-09-10 调过 Flash 的价，若新旧用量
 *    折进同一条 route，"每一档各花了多少"就没法按当时的价结算（历史金额会跟着现在变）。
 *    所以档位里带 {@link UsageTier.era}，由调用方按同一时刻算出来 —— 宿主半把两件事
 *    绑成一个闭包，本模块只负责把它塞进 key。
 *
 * ## 增量折叠（{@link createUsageFolder}）
 *
 * 折叠是**有状态**的：宿主半把它按会话缓存起来，用 `session/event` 增量喂事件，
 * 这样金额胶囊每次取价是 O(1)，不必反复重读整份会话日志（`readSession` 会深拷贝全部事件）。
 * `feed()` 按 `seq` 幂等：重复喂同一批事件不会重复计费（这一点是缓存能安全复用的前提）。
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
  /** 缓存写入（官方 `cacheWriteTokens`；实测恒 0，只进显示口径）。 */
  readonly cacheWriteTokens: number
}

/**
 * 一条 route 的用量：`(provider, model, 档位, 价格档)` 一组即一条 —— 峰谷**拆开**成两条。
 *
 * 为什么拆：高峰价是空闲价的 2 倍，合成一条就没法按不同单价计价了；而"这一条到底按哪个价
 * 算的"恰恰是用户要看的东西（`panel` 会把两档分行显示）。
 */
export interface RouteUsage {
  readonly provider: string
  readonly model: string
  /** 高峰档（true）还是空闲档（false）。第三方路由恒 false（它们没有峰谷两档）。 */
  readonly peak: boolean
  /** 价格历史档 id（`pricing.ts` 的 `eraIdAt`）；第三方路由是空串。 */
  readonly era: string
  readonly usage: UsageBuckets
}

/** 两档各自的小计。 */
export interface TierUsage {
  readonly peak: UsageBuckets
  readonly offPeak: UsageBuckets
}

/** 一个会话折出来的结果。 */
export interface SessionUsageFold {
  /** 全部 route 相加（应当等于官方 `tokenUsage` 投影的四个桶）。 */
  readonly total: UsageBuckets
  /** 高峰 / 空闲两档的小计（逐项相加恰好等于 {@link total}）。 */
  readonly tiers: TierUsage
  /** 按 token 总量从多到少排好的 route 列表（峰谷与价格档都已拆开）。 */
  readonly routes: readonly RouteUsage[]
  /** 折过的事件条数（诊断用：分列出不来时，界面靠它区分"没事件"和"形状不对"）。 */
  readonly events: number
  /** 真正折到 usage 的样本条数（诊断用）。 */
  readonly samples: number
}

/** 一条用量该落哪一档（由调用方注入判定，见 {@link TierAt}）。 */
export interface UsageTier {
  /** 高峰档还是空闲档。 */
  readonly peak: boolean
  /** 价格历史档 id；没有历史价概念（第三方路由）就是空串。 */
  readonly era: string
}

/**
 * 档位判定：给一个毫秒时刻与它归属的 route，回报峰谷档与价格档。
 *
 * **由调用方注入**而不是在这里 import 一份判定规则：规则与刊例价同源（`pricing.ts` 的
 * `isPeakAt` + `eraIdAt` + `isDeepSeekRoute`），但本模块要能在 node 里用**定死的时刻**
 * 逐例钉住，也要让宿主半对"没有时间戳"自己决定兜底（它退回"现在"）。
 * 事件里既没有 `request/header` 时间、自身也没有 `time` 时传 `Number.NaN`。
 *
 * route 一起传进来是因为第三方路由**没有**峰谷与价格档的概念：判定要能按 provider/model
 * 分叉（否则第三方用量会被打上莫须有的"高峰档"，界面会多出两行假的峰谷小计）。
 */
export type TierAt = (timeMs: number, provider: string, model: string) => UsageTier

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

/** 事件信封上的 `time`（毫秒）；没有/不是有限数就是 `NaN`（交给 {@link TierAt} 兜底）。 */
function timeOf(event: Record<string, unknown>): number {
  const time = event.time
  return typeof time === 'number' && Number.isFinite(time) ? time : Number.NaN
}

/** 事件信封上的 `seq`（幂等去重与"喂到哪了"都靠它）；不是有限数就是 `undefined`。 */
function seqOf(event: Record<string, unknown>): number | undefined {
  const seq = event.seq
  return typeof seq === 'number' && Number.isFinite(seq) ? seq : undefined
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

/** 折叠器内部的一步替换槽。 */
interface StepSlot {
  readonly turn: unknown
  readonly step: unknown
  readonly buckets: UsageBuckets
  readonly tier: UsageTier
}

/** 增量折叠器：宿主半按会话缓存一个，用 `session/event` 增量喂。 */
export interface UsageFolder {
  /** 喂一批事件（按 `seq` 幂等：已折过的不会再折一遍）。 */
  feed(events: readonly unknown[]): void
  /** 当前结果快照（每次调用新建数组/对象，调用方可以随便持有）。 */
  snapshot(): SessionUsageFold
}

/** 折叠器内部的行（`usage` 要能就地替换，所以这里不是对外的只读 {@link RouteUsage}）。 */
interface MutableRouteUsage {
  readonly provider: string
  readonly model: string
  readonly peak: boolean
  readonly era: string
  usage: UsageBuckets
}

/**
 * 造一个增量折叠器。
 * @param tierAt 档位判定（见 {@link TierAt}）；宿主半传 `pricing.ts` 包装，测试传定死的表。
 * @returns 折叠器：`feed()` 可反复调用，`snapshot()` 随时取结果。
 */
export function createUsageFolder(tierAt: TierAt): UsageFolder {
  const byRoute = new Map<string, MutableRouteUsage>()
  let provider = UNKNOWN_ROUTE
  let model = UNKNOWN_ROUTE
  /** 最近一条 `request/header` 的时刻（请求发出时刻 = 官方计费时刻）。 */
  let headerTime = Number.NaN
  let last: StepSlot | null = null
  let total = zeroBuckets()
  let tierPeak = zeroBuckets()
  let tierOffPeak = zeroBuckets()
  let events = 0
  let samples = 0
  /** 已经折到的事件 seq：重复喂同一批（缓存复用、重读日志）不会重复计费。 */
  let lastSeq: number | undefined

  return {
    feed(batch: readonly unknown[]): void {
      for (const raw of batch) {
        if (typeof raw !== 'object' || raw === null) continue
        const event = raw as Record<string, unknown>
        const seq = seqOf(event)
        if (seq !== undefined && lastSeq !== undefined && seq <= lastSeq) continue
        if (seq !== undefined) lastSeq = seq
        events += 1

        const header = headerOf(event)
        if (header !== undefined) {
          provider = header.provider
          model = header.model
          headerTime = timeOf(event)
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
        const previous = last !== null && last.turn === data.turn && last.step === data.step ? last : undefined
        if (previous !== undefined && sameBuckets(previous.buckets, buckets)) continue
        const delta = previous === undefined ? buckets : subBuckets(buckets, previous.buckets)
        // 档位只在**这一步第一次上报**时判一次，后续替换增量沿用同一个档位（见文件头第 4 条）。
        const tier = previous?.tier ?? tierAt(Number.isFinite(headerTime) ? headerTime : timeOf(event), provider, model)
        last = { turn: data.turn, step: data.step, buckets, tier }
        if (isZero(delta)) continue
        const key = `${provider}\u0000${model}\u0000${tier.peak ? 'peak' : 'offPeak'}\u0000${tier.era}`
        const row = byRoute.get(key) ?? { provider, model, peak: tier.peak, era: tier.era, usage: zeroBuckets() }
        row.usage = addBuckets(row.usage, delta)
        byRoute.set(key, row)
        total = addBuckets(total, delta)
        if (tier.peak) tierPeak = addBuckets(tierPeak, delta)
        else tierOffPeak = addBuckets(tierOffPeak, delta)
      }
    },
    snapshot(): SessionUsageFold {
      const routes = [...byRoute.values()]
        .filter(row => !isZero(row.usage))
        .sort((left, right) => bucketTotal(right.usage) - bucketTotal(left.usage))
      return {
        total,
        tiers: { peak: tierPeak, offPeak: tierOffPeak },
        routes,
        events,
        samples,
      }
    },
  }
}

/**
 * 把一个会话的事件流折成 per-route 用量（一次性）。
 *
 * @param events 会话事件（`sessionQuery.readSession(sessionId).events`）；形状不对的条目直接跳过。
 * @param tierAt 档位判定（见 {@link TierAt}）；宿主半传 `pricing.ts` 包装，测试传定死的表。
 * @returns 各 route 的用量（按 token 总量降序）、总和与诊断计数。
 */
export function foldSessionUsage(events: readonly unknown[], tierAt: TierAt): SessionUsageFold {
  const folder = createUsageFolder(tierAt)
  folder.feed(events)
  return folder.snapshot()
}

/** 空折（没有任何可归因用量）。 */
export function emptyFold(): SessionUsageFold {
  return {
    total: zeroBuckets(),
    tiers: { peak: zeroBuckets(), offPeak: zeroBuckets() },
    routes: [],
    events: 0,
    samples: 0,
  }
}

/** {@link UsageCache.sync} 的结果。 */
export interface UsageCacheOutcome {
  readonly fold: SessionUsageFold
  /** `sessionQuery` = 这一轮完整读过日志；`cache` = 直接用缓存（含"日志读不到"的兜底）。 */
  readonly source: 'sessionQuery' | 'cache'
}

/**
 * 按会话缓存的增量折叠器（宿主半用）。
 *
 * 为什么需要它：金额胶囊要跟着流式用量刷新，而 `sessionQuery.readSession()` 会深拷贝整份日志
 * 并重新校验（几千条事件要几百毫秒），不能每次取价都重读。
 *
 * 两条腿走路：
 *   · {@link UsageCache.event} —— 会话事件订阅，一条条喂进对应会话的折叠器，取价时是 O(1)；
 *   · {@link UsageCache.sync} —— 首次（或发现落后）时完整读一次日志播种。
 *
 * ## 播种窗口：这里最贵的错误是"静默少算"
 *
 * `UsageFolder.feed()` 的去重是 **seq 水位**式的：一旦折过 seq=12 的事件，再喂 seq=5 的会被
 * 整条跳过。而播种要先 `await read()`（深拷贝整份日志，几百毫秒），这期间追加的事件订阅会
 * 先看到。若那时直接折进去，水位就跳到了快照之后 —— 快照里那些**中间**事件被永久跳过，
 * 金额少算而且再也补不回来（`feed()` 是幂等的，补也补不进去）。
 *
 * 所以播种期间订阅来的事件进 `buffered`，读完快照后按 seq 升序补上。`test/usage-fold.mjs`
 * 第 8 节用一个"读的时候顺手追加两条事件"的假 read 把这条钉住。
 *
 * ## 什么时候必须整份作废（{@link UsageCache.clear}）
 *
 * 折叠结果里**固化了判定当时的事实**：峰谷档、价格档。所以"用户改了节假日表""同步来了新的
 * 官方价档"这类**判定规则本身**的变化，不能靠"下次再折一遍"生效 —— 水位去重会把旧事件
 * 整条跳过，金额会一直停在旧规则上（而且看不出来）。宿主半因此在这些设置变化时调 `clear()`：
 * 下次取价重新读日志、按新规则重折。
 *
 * @param tierAt 档位判定（见 {@link TierAt}）。
 * @param options.maxSessions 同时保留几个会话（默认 8；超出按最先被问的顺序淘汰）。
 */
export interface UsageCache {
  /** 订阅到一条事件；**没被问过的会话直接忽略**（不占内存、也不做无用折叠）。 */
  event(sessionId: string, event: unknown): void
  /**
   * 同步一个会话到最新，并取出快照。
   * @param sessionId 会话 id。
   * @param liveSeq 活会话的 `seq`（= 已写入条数，所以最后一条事件的 seq 是它减一）；
   *   归档会话拿不到就传 `undefined`，此时只在首次同步时读一次。
   * @param read 完整读一次会话事件；**允许抛**（读不到就用已有缓存，绝不冒泡给路由）。
   * @returns 折叠快照与这一轮事件来源。
   */
  sync(
    sessionId: string,
    liveSeq: number | undefined,
    read: () => Promise<readonly unknown[]>,
  ): Promise<UsageCacheOutcome>
  /** 丢掉全部缓存（判定规则变了：节假日、价格档、用户覆盖价与第三方价目都算）。 */
  clear(): void
}

/** 内部行状态。 */
interface CacheRow {
  readonly folder: UsageFolder
  /** 已折到的事件 seq；`undefined` = 还没成功播种过（下次仍要读）。 */
  lastSeq: number | undefined
  /** 正在播种：订阅来的事件先攒着（见 {@link UsageCache} 的"播种窗口"）。 */
  seeding: boolean
  buffered: unknown[]
}

/**
 * 造一个按会话缓存的增量折叠器。
 * @param tierAt 档位判定。
 * @param options.maxSessions 同时保留几个会话（默认 8）。
 * @returns 缓存；`event()` 可随时调，`sync()` 取快照并按需播种，`clear()` 整份作废。
 */
export function createUsageCache(tierAt: TierAt, options: { maxSessions?: number } = {}): UsageCache {
  const rows = new Map<string, CacheRow>()
  const maxSessions = options.maxSessions ?? 8
  const trim = (): void => {
    while (rows.size > maxSessions) {
      // Map 保持插入顺序：最先被问的那个先淘汰（切会话时不会立刻丢掉上一个）。
      const oldest = rows.keys().next().value
      if (oldest === undefined) return
      rows.delete(oldest)
    }
  }
  const seqOf = (event: unknown): number | undefined => {
    const seq = (event as { seq?: unknown } | null)?.seq
    return typeof seq === 'number' && Number.isFinite(seq) ? seq : undefined
  }
  /** 把一批事件按 seq 升序喂进去（`feed()` 自己会跳过已折过的）。 */
  const feedAll = (row: CacheRow, events: readonly unknown[]): void => {
    if (events.length === 0) return
    row.folder.feed(events)
    for (const event of events) {
      const seq = seqOf(event)
      if (seq !== undefined) row.lastSeq = seq
    }
  }

  return {
    event(sessionId: string, event: unknown): void {
      const row = rows.get(sessionId)
      if (row === undefined) return
      if (row.seeding) {
        row.buffered.push(event)
        return
      }
      feedAll(row, [event])
    },
    clear(): void {
      rows.clear()
    },
    async sync(
      sessionId: string,
      liveSeq: number | undefined,
      read: () => Promise<readonly unknown[]>,
    ): Promise<UsageCacheOutcome> {
      let row = rows.get(sessionId)
      const behind = row === undefined
        // 没成功播种过（首次或上次读失败）→ 必须再读。
        || row.lastSeq === undefined
        // `seq` 是"下一条的序号"，所以已写入的最后一条是 `liveSeq - 1`。
        || (liveSeq !== undefined && liveSeq - 1 > row.lastSeq)
      if (!behind) return { fold: row!.folder.snapshot(), source: 'cache' }

      if (row === undefined) {
        row = { folder: createUsageFolder(tierAt), lastSeq: undefined, seeding: true, buffered: [] }
        rows.set(sessionId, row)
        trim()
      } else {
        row.seeding = true
      }
      const seeding = row
      let source: 'sessionQuery' | 'cache' = 'cache'
      try {
        const events = await read()
        if (events.length > 0) {
          feedAll(seeding, events)
          source = 'sessionQuery'
        }
      } catch {
        /* 读不到就用缓存里已有的那份（首帧时可能什么都没有，调用方如实回报空分列） */
      }
      // 播种结束：把期间攒下的事件按 seq 升序补上。
      seeding.seeding = false
      const tail = seeding.buffered
      seeding.buffered = []
      if (tail.length > 0) {
        tail.sort((left, right) => (seqOf(left) ?? 0) - (seqOf(right) ?? 0))
        feedAll(seeding, tail)
      }
      return { fold: seeding.folder.snapshot(), source }
    },
  }
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
