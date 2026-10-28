/**
 * 「金额」条目：注册在 `conversation.composer.dock` 上的一颗极简金额胶囊。
 *
 * ## 外观：逐项抄官方，不自己发明
 *
 * 用户 2026-09-28 的要求是"**字的大小跟亮度调成跟旁边一样**"。旁边那颗就是官方的统计胶囊
 * （`ui-chat/src/client/chat/StatsPills.module.css`），点击后的面板官方也有现成的皮肤
 * （同目录 `stat-dialog.module.css`，就是那颗「Token 用量」）。所以这里**照抄官方数值**，
 * 一个字都不自己定：
 *
 *   胶囊：`padding: 1px 8px`、`border-radius: 24px`、静止 `label-tertiary`、
 *     hover/展开 `label-secondary` + `interactive-bg-hover`、`tabular-nums`、**非等宽**（对齐 `.pill`）。
 *     ⚠ 字号与行高**不在 `.pill` 上**，而在它爸爸 `.root` 上：
 *       `font-size: calc(var(--dsh-content-font-size-secondary, 13px) - 1px)`、
 *       `line-height: calc(20px + var(--dsh-content-font-delta-secondary, 0px))`。
 *     `.pill` 里那条 `font: inherit` 只是**抵消 button 的 UA 字体**。本条目是同一个槽位里的
 *     **另一条**记录，不在这颗 `.root` 里，所以 `font: inherit` 拿到的是输入框那一层
 *     （`InputBar` 的 `--dsh-content-font-size`，默认 14px）—— 2026-09-28 用户真机反馈
 *     "插件输入框下方的字比官方的大"就是这么来的（14px vs 12px）。修法是**把 `.root` 那两条
 *     显式写在按钮上**，从而与旁边那颗胶囊逐像素同字号，且随用户的字号设置一起变。
 *   弹层（对齐 stat-dialog 的 `.panel`）：`padding: 16px`、`border-radius: 12px`、
 *     `background: var(--dsw-specific-menu)` + `backdrop-filter: var(--dsw-menu-backdrop-filter)`、
 *     `box-shadow: var(--dsw-elevation-prominent)`、`--dsw-elevation-stroke-color: border-l1`、
 *     `font-size: 12px; line-height: 18px; color: label-secondary`；标题行 `font-weight: 500`；
 *     明细用 grid（`minmax(76px, auto) minmax(0, 1fr)`、`gap: 6px 16px`），标签 tertiary、值 secondary 右对齐。
 *   位置：官方靠 `useStatDialog` 的锚点 clamp（12px 视口边界、z-index 1100）。本插件不依赖官方的
 *     hook（它在官方包内部），所以自己算锚点，但同样做 12px 视口夹紧与同一层级。
 *
 * ## 两种口径，别混
 *
 *  · **折叠态那一个数字**：0.9.1 起**以宿主半算的"逐笔按时"金额为准**（见 `session-cost.ts`），
 *    它还没到手、或会话日志还没跟上投影时，用本地的"按当前时刻判峰谷"估值顶上 ——
 *    胶囊从不空着，但面板里会说明当前这个数字是哪一种。
 *  · **展开态的分列**：必须逐请求归因，只有宿主半能做到，所以点开时强制取一次
 *    `/composer-ux/usage?sessionId=…`（折叠规则在 `src/usage-fold.ts`）。
 *    **分列到手后，面板总额改成分列之和**，这样"分列加起来等于总额"永远成立。
 *
 * ## 0.9.1：峰谷按"每笔用量发生的时间"判，不按"你看面板的时间"
 *
 * 官方按请求发生时刻计费（高峰价是空闲价的 2 倍），而客户端投影**没有任何时间信息**，
 * 所以这件事只能在宿主半做：折叠时用每条事件的 `time` 判档、按 `(provider, model, 档)`
 * 拆桶，**金额也由宿主半算好**（用户覆盖价也读自设置）。这样"折叠 → 分档 → 单价"只有一处，
 * 胶囊、面板与测试看到的是同一份数字。
 *
 * ## 字段名坑（2026-09-28 真机踩过，别再犯）
 *
 * 官方 **客户端投影**用的是 `uncachedInputTokens`（见 `token-meter` 的 `projectionSchema`），
 * 而**会话日志里的 `TokenUsage`** 用的是 `inputTokens`。只认一个名字的后果是很具体的：
 * 面板把"未缓存输入"读成 0 → 命中率显示 100%（实际 98.1%）→ **金额少算那部分未缓存输入** →
 * 而且"日志 vs 投影"的一致性判据永远不成立，连宿主半已经折对的分列都被丢掉。
 * 所以这里统一走 `costBucketsOf`（两个名字都认）。
 *
 * **同一个坑当天又踩了第二次**（真机面板显示"缓存命中率 100%"，旁边官方胶囊是 98.206%）：
 * `billedInputTokens()` 这个函数**只认** `uncachedInputTokens`，而我在调用处传的是
 * `{ inputTokens: buckets.miss, … }` —— 于是分母少了整块未缓存输入，命中率恒等于 100%。
 * 结论：键名这件事在**每一处传值**都要对，不能只在一个函数里修。现在调用处传
 * `uncachedInputTokens`，并由 `test/client-registration.mjs` 钉住这一条。
 *
 * ## 0.11.0：浮层只留"数字 + 状态"，说明挪去设置页
 *
 * 用户 2026-09-29 的原话是"图里这些说明放到设置页面，使点开胶囊变得更简洁"。浮层原来的
 * 最后三行（刊例价快照行、价格档段、峰谷判定段）去留不同：
 *
 *  · **峰谷判定段**：设置页「金额」里本来就有一份同义文字，删掉是纯去重；
 *  · **刊例价快照行**：整行搬去设置页的「计价说明」；其中"这份价是你自己填的"这一点
 *    缩成单价行上的 `· 已自定义` 小标 —— 它只在**你覆盖过价**时出现，默认不占字；
 *  · **价格档段**：改成**只在非默认时出现**（本会话用到的档 ≠ 当前生效的档）。
 *    这一条不能简单删：跨了 9-10 调价的会话，浮层上的单价是今天的价、金额却是当时的价，
 *    不说反而是误导。
 *
 * ## 0.24.0：子代理（subagent）的费用并进展示数字
 *
 * 用户报的是"金额胶囊不算子代理花的钱"。原因在数据源头，不在格式化：子代理跑在**自己的**会话里，
 * 它的 usage 事件落在**自己的**日志里，父会话的折叠器看不到；官方 `tokenUsage` 投影同样只有本会话。
 * 于是 0.23.x 的胶囊只报父会话自己那一份，跑一堆子代理之后数字几乎不动。
 *
 * 0.24.0 由宿主半递归折子代理的日志，并在响应里**单列**一块 `subagents`（契约见
 * `session-cost.ts` 的 {@link SessionCostSubagents}），客户端把它并进展示数字。四条口径：
 *
 *  · **只在 `useBreakdown` 为真时并**。为假说明本会话的分列还不可信（日志没跟上投影），
 *    这时展示的是本地估值 —— 拿"估出来的本会话"加"宿主算准的子代理"，同一个数字里两套口径，
 *    比少算更糟。所以并子代理这一律以"本会话分列可信"为前提。
 *  · **顶层的 `total` / `cost` 仍然只是本会话**，`agreesWithProjection` 的判据一个字都没动：
 *    那份投影也只有本会话。谁要是把子代理并进顶层字段，这个判据会永远不成立，界面反而退化成估算。
 *  · **分项三行必须跟着并**（`view.parts` 并 `subagents.cost`），否则"未缓存输入 + 缓存命中 + 输出
 *    = 合计"这条承诺当场破掉。
 *  · **峰谷两档只并 token、不并金额**：宿主半只给子代理的**总**金额，没按峰谷拆开。
 *    拿"子代理 token × 某一档单价"凑一个按档金额就是编数字，所以两档的金额仍只含本会话，
 *    并在浮层里写明（高峰档 / 空闲档两行的 token 已含子代理、金额不含）。那两行只在**本会话**
 *    该档有量时才出现：只有子代理在该档有量时画一个"高峰档 1.2M · ¥0.00"，比不显示更误导。
 *
 * 没有子代理（字段缺失或 `sessions === 0`）时上面这些分支全不成立：浮层、胶囊、文案逐字节
 * 与 0.23.x 相同 —— 老宿主、不用子代理的会话都走这条路。
 */
import React, { type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-store'
import {
  DEFAULT_PEAK_HOLIDAYS, costBucketsOf, costPartsOf, eraById, eraIdAt, formatMoney,
  formatTokens, isDeepSeekRoute, overrideTierOf, resolvePrice,
} from '../pricing.ts'
import type { ComposerUxSettings } from '../settings-contract.ts'
import { UNKNOWN_ROUTE, agreesWithProjection, type UsageBuckets } from '../usage-fold.ts'
// 订阅套餐的额度口径（0.26.0）：这个模块**零 import**（只有类型与纯函数），所以客户端可以直接用
// 同一份 `formatUsd` / 窗口标签 —— 两端各写一份格式化，迟早会出现"胶囊 $0.30、浮层 $0.3"。
import { QUOTA_WINDOW_LABEL, formatUsd } from '../subscription-plans.ts'
import { billedInputTokens, cacheHitText } from './stats-line.ts'
import { usePeakAlert } from './peak-alert.ts'
import { PROVIDER_PRICES_SNAPSHOT_AT } from '../provider-prices.ts'
import { useSessionCost, type SessionCostBuckets, type SessionCostRoute } from './session-cost.ts'

/** 位置夹紧：与官方 `useStatDialog` 同值（视口两边各留 12px）。 */
const VIEWPORT_MARGIN = 12
/** 面板宽度上限/下限：与官方 `stat-dialog` 的 `.panel` 同值。 */
const PANEL_MIN_WIDTH = 'min(300px, calc(100vw - 24px))'
const PANEL_MAX_WIDTH = 'min(440px, calc(100vw - 24px))'

/** 官方 `tokenUsage` 投影的形状（客户端口径：`uncachedInputTokens`）。 */
interface TokenUsageLike {
  readonly inputTokens?: number
  readonly uncachedInputTokens?: number
  readonly cacheReadTokens?: number
  readonly cacheWriteTokens?: number
  readonly outputTokens?: number
}

/** 官方 `modelSelection` 投影的形状。 */
interface ModelSelectionLike {
  readonly lastUsed?: { readonly provider?: string; readonly model?: string } | null
}

/** 注入面：标准套件给 `sessionId` / `useProjection`，我们自己的 `inject` 给 `live`。 */
export interface CostChipInjected {
  readonly useLive: SnapshotSelectorHook<ComposerUxSettings>
  /** 当前会话 id（session 级槽位由框架解析后注入）。 */
  readonly sessionId?: string
  readonly useProjection: (key: string) => unknown
}

/** 有限数才认，其余当 0（宿主半的响应字段都是可选的，缺了不许算成 NaN）。 */
function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** 一个 token 桶的总量（宿主半的桶字段都可选，缺的当 0）。 */
function tokenTotal(buckets: SessionCostBuckets | undefined): number {
  if (buckets === undefined) return 0
  return num(buckets.inputTokens) + num(buckets.outputTokens)
    + num(buckets.cacheReadTokens) + num(buckets.cacheWriteTokens)
}

/** 一条明细行（官方 stat-dialog 的 dt/dd 两格）。 */
function detail(label: string, value: string, key?: string): React.ReactElement {
  return (
    <React.Fragment key={key ?? label}>
      <dt style={{ minWidth: 0, margin: 0, color: 'var(--dsw-alias-label-tertiary)', overflowWrap: 'anywhere' }}>{label}</dt>
      <dd style={{
        minWidth: 0,
        margin: 0,
        color: 'var(--dsw-alias-label-secondary)',
        fontVariantNumeric: 'tabular-nums',
        textAlign: 'right',
      }}>{value}</dd>
    </React.Fragment>
  )
}

/** 灰字说明行（跨两格）。 */
function note(text: string, key?: string): React.ReactElement {
  return (
    <div key={key ?? text} style={{ gridColumn: '1 / -1', color: 'var(--dsw-alias-label-tertiary)' }}>{text}</div>
  )
}

/** 三项单价写成一行（`2.05 / 0.041 / 8.18`）。 */
function priceText(triple: { readonly miss: number; readonly hit: number; readonly out: number }): string {
  return `${triple.miss} / ${triple.hit} / ${triple.out}`
}

/**
 * 金额胶囊本体。
 *
 * hooks 一律在早退之前调用（没有用量时返回 null 只是不画，不是不挂载）。
 */
export function CostChipEntry({ useLive, sessionId, useProjection }: CostChipInjected): React.ReactElement | null {
  const settings = useLive(item => item)
  const overrides = settings.priceOverrides
  const project = typeof useProjection === 'function' ? useProjection : () => undefined
  const usage = project('tokenUsage') as TokenUsageLike | undefined
  const selection = project('modelSelection') as ModelSelectionLike | undefined

  const [open, setOpen] = React.useState(false)
  const [hover, setHover] = React.useState(false)
  const [anchor, setAnchor] = React.useState<{ readonly left: number; readonly top: number } | null>(null)
  const chip = React.useRef<HTMLButtonElement | null>(null)

  // 两个名字都认（投影 `uncachedInputTokens` / 日志 `inputTokens`）—— 见文件头"字段名坑"。
  const buckets = costBucketsOf(usage)
  const write = num(usage?.cacheWriteTokens)
  const model = selection?.lastUsed?.model
  const billed = buckets.miss + buckets.hit + buckets.out + write

  // 宿主半那份"逐笔按时"的费用：用量一变就（节流）刷一次；点开面板时强制刷一次。
  const fingerprint = `${buckets.miss}|${buckets.hit}|${write}|${buckets.out}`
  const { data, loading } = useSessionCost(sessionId, fingerprint, open)

  // 本地估值（兜底口径）：按**当前**时刻判峰谷（价格档也取当前档），所以对跨峰谷/跨调价的
  // 会话必然有偏差 —— 面板里那几条说明会把"这个数字是哪一种"讲清楚。
  const lastProvider = selection?.lastUsed?.provider
  // `eras` 要一起传：官方价同步可能新增了一个价格档，客户端本地估值也得按同一批档算。
  const eras = settings.syncedPrices?.eras
  const estimate = resolvePrice(model, { overrides, ...(lastProvider === undefined ? {} : { provider: lastProvider }), ...(eras === undefined ? {} : { eras }) })
  const estimateParts = costPartsOf(buckets, estimate.prices)

  // ── 峰谷提醒（0.10.0）：相位规则与宿主半同源（节假日表由宿主回，取不到就用设置里的/内置的）
  const { text: peakText } = usePeakAlert(settings, data?.holidays ?? settings.peakHolidays ?? DEFAULT_PEAK_HOLIDAYS)

  const close = React.useCallback((): void => { setOpen(false); setAnchor(null) }, [])
  const toggle = (): void => {
    if (open) { close(); return }
    const rect = chip.current?.getBoundingClientRect()
    if (rect === undefined) return
    // 贴胶囊上方，并像官方 `useStatDialog` 那样夹在视口里（12px 边距）。
    const panelWidth = Math.min(440, Math.max(300, window.innerWidth - VIEWPORT_MARGIN * 2))
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - panelWidth / 2, VIEWPORT_MARGIN),
      Math.max(VIEWPORT_MARGIN, window.innerWidth - VIEWPORT_MARGIN - panelWidth),
    )
    setAnchor({ left, top: rect.top - 8 })
    setOpen(true)
  }

  // 浮层开着时：点别处 / 按 Esc 关掉（官方弹层同一行为）。
  React.useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent): void => {
      const target = event.target as Node | null
      if (target !== null && chip.current?.contains(target) === true) return
      if (target !== null && (target as Element).closest?.('[data-composer-ux-cost-panel]') !== null) return
      close()
    }
    const onKeyDown = (event: KeyboardEvent): void => { if (event.key === 'Escape') close() }
    document.addEventListener('mousedown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open, close])

  // 没有用量就不占位（官方那行统计也是没有计费输入时整块不出现）。
  if (billed === 0 && buckets.out === 0) return null

  // ── 分列（到齐且与投影一致才敢当权威）─────────────────────────────────────
  const hostRoutes: readonly SessionCostRoute[] = data?.ok === true && Array.isArray(data.routes) ? data.routes : []
  const foldTotal = data?.ok === true
    ? {
        inputTokens: num(data.total?.inputTokens),
        outputTokens: num(data.total?.outputTokens),
        cacheReadTokens: num(data.total?.cacheReadTokens),
        cacheWriteTokens: num(data.total?.cacheWriteTokens),
      }
    : null
  const foldAgrees = foldTotal !== null && agreesWithProjection(
    { total: foldTotal },
    {
      inputTokens: buckets.miss,
      outputTokens: buckets.out,
      cacheReadTokens: buckets.hit,
      cacheWriteTokens: write,
    },
  )
  const routeRows = hostRoutes
    .filter(route => tokenTotal(route.usage) > 0)
    .map(route => {
      const row: UsageBuckets = {
        inputTokens: num(route.usage?.inputTokens),
        outputTokens: num(route.usage?.outputTokens),
        cacheReadTokens: num(route.usage?.cacheReadTokens),
        cacheWriteTokens: num(route.usage?.cacheWriteTokens),
      }
      const rowProvider = route.provider === undefined || route.provider === '' ? UNKNOWN_ROUTE : route.provider
      const rowModel = route.model === undefined || route.model === '' ? UNKNOWN_ROUTE : route.model
      return {
        provider: rowProvider,
        model: rowModel,
        peak: route.peak === true,
        era: typeof route.era === 'string' ? route.era : '',
        /** DeepSeek 路由才有峰谷两档与价格历史档（见 `pricing.ts` 的 isDeepSeekRoute）。 */
        deepseek: isDeepSeekRoute(rowProvider, rowModel),
        /** 认不出价：金额是 0，界面必须写"未定价"而不是 ¥0.00。 */
        unpriced: route.unpriced === true,
        /** 单价来自内置快照（没点过「同步第三方价目」时的兜底）。 */
        builtin: route.priceBuiltin === true,
        priceSource: typeof route.priceSource === 'string' ? route.priceSource : '',
        overridden: route.overridden === true,
        tokens: tokenTotal(row),
        cost: num(route.cost),
        parts: { miss: num(route.parts?.miss), hit: num(route.parts?.hit), out: num(route.parts?.out) },
      }
    })
  /** 两档各自的小计：这正是"逐笔准时"看得见的地方（同一模型在两档里的用量分别列出来）。 */
  const tierOf = (peak: boolean): { readonly tokens: number; readonly cost: number } => routeRows
    .filter(route => route.deepseek && route.peak === peak)
    .reduce((sum, route) => ({ tokens: sum.tokens + route.tokens, cost: sum.cost + route.cost }), { tokens: 0, cost: 0 })
  const peakTier = tierOf(true)
  const offTier = tierOf(false)
  /** 第三方路由的小计（它们没有峰谷，单列一行"其他路由"）。 */
  const otherTier = routeRows
    .filter(route => !route.deepseek)
    .reduce((sum, route) => ({ tokens: sum.tokens + route.tokens, cost: sum.cost + route.cost }), { tokens: 0, cost: 0 })
  /** 有几行的单价来自**内置快照**（不是用户同步来的那份）：界面要标明"可能过时"。 */
  const builtinCount = routeRows.filter(route => route.builtin && !route.unpriced).length
  /** 未定价的行数（有几行就少算几行的钱，必须写在脸上）。 */
  const unpricedCount = routeRows.filter(route => route.unpriced).length
  /** 本次用量涉及的价格历史档（同一会话跨调价时会有多个）。 */
  const erasUsed = [...new Set(routeRows.filter(route => route.deepseek && route.era !== '').map(route => route.era))]
  // 分列里三个分项的**加和**：这样"未缓存输入 + 缓存命中 + 输出"三行加起来**恰好**是合计，
  // 即使两条 route 的模型单价不同也不会出现"分项之和对不上总数"。
  const routeParts = routeRows.reduce(
    (sum, route) => ({
      miss: sum.miss + route.parts.miss,
      hit: sum.hit + route.parts.hit,
      out: sum.out + route.parts.out,
    }),
    { miss: 0, hit: 0, out: 0 },
  )
  const useBreakdown = routeRows.length > 0 && foldAgrees && foldTotal !== null
  // ── 子代理（0.24.0）：宿主半单列的那一块，只在"本会话分列可信"时才并进来 ───────────
  // `sessions === 0` 与"老宿主根本不回这个字段"同等对待（`sub` 一律 undefined）：下面所有
  // 子代理分支都不成立，浮层与胶囊逐字节保持 0.23.x 的样子。`sessions` 是"折到日志的子会话数"
  // （含孙代理），有量就必然 > 0 —— 拿它当总开关，比拿 `cost.total > 0` 稳（全未定价时金额是 0，
  // 但子代理确实跑过，那一行仍然要出现，否则用户以为插件根本不知道有子代理）。
  const subRaw = useBreakdown ? data?.subagents : undefined
  const subSessions = num(subRaw?.sessions)
  const sub = subSessions > 0 ? subRaw : undefined
  const subMissing = num(sub?.missing)
  const subExternal = num(sub?.external)
  const subSkipped = num(sub?.skipped)
  const subUnpriced = num(sub?.unpriced)
  const subCost = num(sub?.cost?.total)
  const subTokens = tokenTotal(sub?.total)
  /** 子代理的四桶（并进展示桶用）。 */
  const subParts = {
    miss: num(sub?.total?.inputTokens),
    hit: num(sub?.total?.cacheReadTokens),
    write: num(sub?.total?.cacheWriteTokens),
    out: num(sub?.total?.outputTokens),
  }
  /**
   * 子代理落在两档里的 token（**桶**，不是钱）。
   *
   * 只在**本会话这一档确实有量**时才并：否则本会话高峰档是 0、子代理高峰档有量，就会画出一行
   * "高峰档 1.2M · ¥0.00" —— 那比不显示更误导（看着像"高峰不要钱"）。所以这一档的可见条件
   * 仍旧只由本会话的量决定，并进来的子代理 token 是"附加信息"。
   *
   * ⚠️ 子代理走的**第三方**路由（既不在高峰档、也不在空闲档）没有小计行可并：`subagents`
   * 只给了峰谷两个桶。那部分量只出现在「合计」和三个分项里 —— 这是宿主契约的边界，宁可少一行
   * 小计，也不拿"总数减两档"去猜第三方那一路有多少（猜错就是把 token 记到别的档上）。
   */
  const peakTierTokens = peakTier.tokens + (peakTier.tokens > 0 ? tokenTotal(sub?.tiers?.peak) : 0)
  const offTierTokens = offTier.tokens + (offTier.tokens > 0 ? tokenTotal(sub?.tiers?.offPeak) : 0)
  /** 真的并进去过 token（浮层里那句"两档的 token 含子代理、金额只含本会话"只在此时才写）。 */
  const subTierMerged = peakTierTokens > peakTier.tokens || offTierTokens > offTier.tokens
  /**
   * 子代理里"没算进来的那部分"：只列**实际非零**的几项，写成人话。
   *
   * 为什么非得写：金额只有一个数，而它可能来自四种完全不同的残缺（读不到日志 / 外部执行 /
   * 超上限没读 / 没认出价），不点明的话用户只会觉得"钱怎么比预期少"。`note()` 是纯文本，
   * 所以这里一个 markdown 记号都不能有。
   */
  const subGapParts: string[] = []
  if (subMissing > 0) subGapParts.push(`${subMissing} 个读不到会话日志（已归档，或本机没有它的日志）`)
  if (subExternal > 0) subGapParts.push(`${subExternal} 个是外部执行（本机没有这个会话，用量拿不到）`)
  if (subSkipped > 0) subGapParts.push(`${subSkipped} 个超出单次读取上限`)
  if (subUnpriced > 0) subGapParts.push(`${subUnpriced} 行没认出价，按 0 计`)
  const subUnaccounted = subMissing + subExternal + subSkipped
  const subGapText = subGapParts.length === 0
    ? null
    : subUnaccounted > 0
      ? `另有 ${subUnaccounted} 个子代理的费用没算进来：${subGapParts.join('、')}`
      : `子代理里有费用没算进来：${subGapParts.join('、')}`
  // ── 展示口径：分列到手就用宿主半算好的那份，否则用本地估值 ───────────────────
  // 命中率必须和面板上那些数字**同源**（否则同一个面板里两个数字互相打脸），而分母必须是
  // 官方 `billedInputTokens()` 的口径（未缓存 + 缓存读 + 缓存写）——注意这里的**键名**，
  // 见文件头"字段名坑"的第二次踩坑记录。
  const view = useBreakdown && foldTotal !== null
    ? {
        // 子代理的四桶并进展示桶（`sub` 为 undefined 时每一项都是 0，即原样）：
        // 这样"分项之和 = 合计 = 全额"与命中率都是同一份量，见文件头 0.24.0 第三条。
        miss: foldTotal.inputTokens + subParts.miss,
        hit: foldTotal.cacheReadTokens + subParts.hit,
        write: foldTotal.cacheWriteTokens + subParts.write,
        out: foldTotal.outputTokens + subParts.out,
        // ⚠️ 三个分项**也要**并钱：只并桶不并钱，"未缓存输入 + 缓存命中 + 输出 = 合计"当场破。
        parts: {
          miss: num(data?.cost?.miss) + num(sub?.cost?.miss),
          hit: num(data?.cost?.hit) + num(sub?.cost?.hit),
          out: num(data?.cost?.out) + num(sub?.cost?.out),
        },
        total: num(data?.cost?.total) + subCost,
      }
    : {
        miss: buckets.miss,
        hit: buckets.hit,
        write,
        out: buckets.out,
        parts: estimateParts,
        total: estimateParts.total,
      }
  const viewBilledInput = billedInputTokens({
    uncachedInputTokens: view.miss,
    cacheReadTokens: view.hit,
    cacheWriteTokens: view.write,
  })
  // 与输入框下面那一行（本插件的三位小数改写）**同一套函数、同一位数**，两处数字必然一致。
  const viewHitRate = cacheHitText(view.hit, viewBilledInput)
  /**
   * 兜底口径下认不出价（第三方模型且同步价目里没有它）时**不许显示 ¥0.00**：
   * 那会让人以为"这个模型不要钱"。显示"未定价"并说清怎么补价（0.10.0 新增）。
   */
  const viewUnpriced = !useBreakdown && estimate.unpriced
  // ── 订阅额度（0.26.0）：胶囊主数字改用它 ──────────────────────────────────
  // 用户 2026-10-27 选的口径：**默认看实付**。OpenCode Go 这类套餐单次调用不扣钱、扣额度，
  // 所以"本会话花了 ¥91"既不是他付的钱、也不是额度消耗。这里优先显示 `quota.usd`
  // （按套餐单价算出的额度消耗，含子代理），旁边加 `订阅内` 小标；按量付费的会话或老宿主
  // 没有这个字段，退回原来的刊例价折算。
  const quotaUsd = useBreakdown ? num(data?.quota?.usd) : 0
  const hasQuota = quotaUsd > 0
  const planInfo = data?.plan
  const planWindows = Array.isArray(planInfo?.windows) ? planInfo.windows : []
  const headline = hasQuota ? formatUsd(quotaUsd) : (viewUnpriced ? '未定价' : formatMoney(view.total))
  const expanded = hover || open

  // 两档生效单价（用户覆盖价 > 刊例价）：面板里显式列出来，改价之后一眼能核对。
  const peakPrice = resolvePrice(model, { peak: true, overrides, ...(lastProvider === undefined ? {} : { provider: lastProvider }), ...(eras === undefined ? {} : { eras }) })
  const offPrice = resolvePrice(model, { peak: false, overrides, ...(lastProvider === undefined ? {} : { provider: lastProvider }), ...(eras === undefined ? {} : { eras }) })
  const overridden = peakPrice.overridden || offPrice.overridden
    || overrideTierOf(overrides, model, true) !== undefined || overrideTierOf(overrides, model, false) !== undefined

  return (
    <>
      <button
        ref={chip}
        type="button"
        data-composer-ux-cost=""
        aria-expanded={open}
        title={(useBreakdown
          // 有子代理时那个数字里不止本会话：说清"含子代理"，免得用户以为本会话真花了这么多。
          ? hasQuota
            // 订阅通道：这个数字是**额度消耗**（美元），不是钱包里的钱 —— 标题必须说清。
            ? '本会话额度消耗（订阅内，按套餐单价计，含子代理）'
            : sub !== undefined
              ? '本会话费用（含子代理，按每笔用量发生的时间计价）'
              : '本会话费用（按每笔用量发生的时间计价）'
          : '本会话费用（估算）') + ` · ${peakText}`}
        onClick={toggle}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        // 逐项对齐官方 StatsPills 的 `.pill`（见文件头）。
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          boxSizing: 'border-box',
          maxWidth: '100%',
          padding: '1px 8px',
          border: 'none',
          borderRadius: 24,
          background: expanded ? 'var(--dsw-alias-interactive-bg-hover)' : 'transparent',
          color: expanded ? 'var(--dsw-alias-label-secondary)' : 'var(--dsw-alias-label-tertiary)',
          // 字号/行高来自官方 **`.root`**（不是 `.pill`）：本条目是同一槽位里的另一条记录，
          // 不在那颗 `.root` 里，只写 `font: inherit` 就会拿到输入框那一层的 14px
          // —— 那正是"比旁边大"的原因。`font: inherit` 的本意只是抵消 button 的 UA 字体，
          // 所以这里拆成等价的长写，再把官方的两条显式写上去。
          fontFamily: 'inherit',
          fontWeight: 'inherit',
          fontStyle: 'inherit',
          fontSize: 'calc(var(--dsh-content-font-size-secondary, 13px) - 1px)',
          lineHeight: 'calc(20px + var(--dsh-content-font-delta-secondary, 0px))',
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          cursor: 'pointer',
        }}
      >{headline}
        {hasQuota
          // 一颗 9px 的小标：告诉用户"这个 $ 不是你充的钱，是套餐额度"。
          // 不加它的话，¥ 变 $ 会让人以为算错了单位。
          ? (
            <span style={{
              fontSize: 9,
              lineHeight: '12px',
              padding: '0 4px',
              borderRadius: 6,
              border: '0.5px solid var(--dsw-alias-border-l2)',
              color: 'var(--dsw-alias-label-tertiary)',
              fontVariantNumeric: 'normal',
            }}>订阅内</span>
          )
          : null}
      </button>
      {open && anchor !== null ? createPortal(
        <div
          data-composer-ux-cost-panel=""
          role="dialog"
          aria-label="本会话费用"
          // 逐项对齐官方 stat-dialog 的 `.panel`（见文件头）。
          style={{
            position: 'fixed',
            left: anchor.left,
            bottom: Math.max(VIEWPORT_MARGIN, window.innerHeight - anchor.top),
            zIndex: 1100,
            boxSizing: 'border-box',
            width: 'max-content',
            minWidth: PANEL_MIN_WIDTH,
            maxWidth: PANEL_MAX_WIDTH,
            padding: 16,
            border: 0,
            borderRadius: 12,
            background: 'var(--dsw-specific-menu)',
            backdropFilter: 'var(--dsw-menu-backdrop-filter)',
            boxShadow: 'var(--dsw-elevation-prominent)',
            ['--dsw-elevation-stroke-color']: 'var(--dsw-alias-border-l1)',
            fontSize: 12,
            lineHeight: '18px',
            color: 'var(--dsw-alias-label-secondary)',
            cursor: 'default',
            // 自定义属性（`--dsw-*`）不在 React 的 CSSProperties 里，必须显式断言 ——
            // 与 styles.ts 里那些样式对象同一做法（那边也是 `as CSSProperties`）。
          } as CSSProperties}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 8,
            color: 'var(--dsw-alias-label-primary)',
            fontWeight: 500,
          }}>
            <span>{hasQuota ? '本会话额度消耗' : '本会话费用'}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{headline}</span>
          </div>
          {hasQuota
            // 两套口径必须在同一屏同时可见，否则用户永远不知道"胶囊上的 $ 和下面的 ¥"是什么关系。
            ? note(`订阅内 · 按刊例价折算 ${formatMoney(view.total)}（两套口径并存：上面是实际被扣的套餐额度，这里是这些 token 按官方价折算值多少钱）`, '__quota_head__')
            : null}
          <div style={{ marginBottom: 10, borderTop: '0.5px solid var(--dsw-alias-border-l2)' }} />
          {/*
            读不到会话日志时**必须说出来**（0.26.1）：否则分列全 0，屏幕上是一个「¥0」，
            看起来像"这个会话没花钱"。真机来源：0.2.2-alpha.2 起会话 id 要 `session-<uuid>`
            全写，裸 uuid 会 not found（宿主半已经两种都试，仍失败才走到这里）。
          */}
          {data?.ok === true && typeof data.readError === 'string' && data.readError !== ''
            ? note(`读不到会话日志：${data.readError}（金额按 0 计）`, '__read_error__')
            : null}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(76px, auto) minmax(0, 1fr)',
            gap: '6px 16px',
            margin: 0,
          }}>
            {hasQuota
              ? (
                <>
                  {detail('额度消耗（含子代理）', formatUsd(quotaUsd), '__quota__')}
                  {(data?.quota?.models ?? []).map(row => detail(
                    `其中 ${row.model === undefined || row.model === '' ? '未知模型' : row.model}`,
                    `${formatUsd(num(row.usd))}${row.percentOfLimit === undefined
                      ? ''
                      : ` · 占月额度 ${num(row.percentOfLimit).toFixed(2)}%`}`,
                    `__quota_${row.model ?? ''}`,
                  ))}
                  {planWindows.length > 0
                    ? detail(
                      '额度窗口',
                      planWindows
                        .map(window => `${window.id === undefined ? '' : QUOTA_WINDOW_LABEL[window.id]} ${num(window.percent).toFixed(0)}%`)
                        .filter(text => text !== '')
                        .join(' · '),
                      '__quota_windows__',
                    )
                    : null}
                  {planInfo?.status === 'pending'
                    ? note('额度窗口正在取（官方接口第一次返回前先显示"—"；不影响上面的额度消耗）', '__quota_pending__')
                    : null}
                  {planInfo !== undefined && planInfo.status !== undefined && planInfo.status !== 'ok' && planInfo.status !== 'pending'
                    ? note(`额度窗口取不到：${planInfo.reason === undefined || planInfo.reason === '' ? planInfo.status : planInfo.reason}`, '__quota_gap__')
                    : null}
                </>
              )
              : null}
            {useBreakdown ? (
              <>
                {routeRows.map(route => detail(
                  `${route.provider} · ${route.model}`
                  + (route.deepseek ? (route.peak ? '（高峰）' : '（空闲）') : '（平坦价）'),
                  `${formatTokens(route.tokens)} · ${route.unpriced ? '未定价' : formatMoney(route.cost)}`,
                  `${route.provider}|${route.model}|${String(route.peak)}|${route.era}`,
                ))}
                {sub !== undefined
                  // 子代理的行放在本会话各 route 之后、"合计"之前：合计 = 本会话 + 子代理，
                  // 顺序与这个等式一致。全未定价时金额写"未定价"而不是 ¥0.00（同 route 行口径）。
                  ? detail(
                    `子代理（${subSessions} 个会话）`,
                    `${formatTokens(subTokens)} · ${subUnpriced > 0 ? '未定价' : formatMoney(subCost)}`,
                    '__subagents__',
                  )
                  : null}
                {detail('合计', `${formatTokens(view.miss + view.hit + view.write + view.out)} · ${formatMoney(view.total)}`, '__total__')}
                {peakTier.tokens > 0
                  ? detail('高峰档', `${formatTokens(peakTierTokens)} · ${formatMoney(peakTier.cost)}`, '__peak__')
                  : null}
                {offTier.tokens > 0
                  ? detail('空闲档', `${formatTokens(offTierTokens)} · ${formatMoney(offTier.cost)}`, '__off__')
                  : null}
                {otherTier.tokens > 0
                  ? detail('其他路由（无峰谷）', `${formatTokens(otherTier.tokens)} · ${formatMoney(otherTier.cost)}`, '__other__')
                  : null}
                {subTierMerged
                  // 紧跟在那三行小计后面：读者刚看完"高峰档 / 空闲档"就会觉得"那两行的金额加起来
                  // 怎么不等于合计"，这一句是给他的答案（总额的那个答案是宿主的，这里只能给量）。
                  ? note('高峰 / 空闲两档的 token 已含子代理，金额只含本会话'
                    + '（宿主半没把子代理的钱按峰谷拆开，所以不拿 token 乘单价编一个按档金额出来）。', '__sub_tier__')
                  : null}
                {detail('未缓存输入', `${formatTokens(view.miss)} · ${formatMoney(view.parts.miss)}`, '__miss__')}
                {detail('缓存命中', `${formatTokens(view.hit)} · ${formatMoney(view.parts.hit)}`, '__hit__')}
                {detail('输出', `${formatTokens(view.out)} · ${formatMoney(view.parts.out)}`, '__out__')}
                {builtinCount > 0
                  ? note(`有 ${builtinCount} 行用的是内置快照价（models.dev 快照 ${PROVIDER_PRICES_SNAPSHOT_AT}）——`
                    + '想换成最新价，去设置页「金额」点一次「同步第三方价目」。', '__builtin__')
                  : null}
                {unpricedCount > 0
                  // ⚠️ 这里只能用纯文本：`note()` 不是 markdown 渲染器，写 `**未定价**` 会让用户
                  // 在浮层里看到字面的星号（2026-09-29 的真渲染测试抓到的）。
                  ? note(`有 ${unpricedCount} 行「未定价」：那是非 DeepSeek 模型，同步价目与内置快照里都没有它，`
                    + '所以那部分按 0 计。去设置页「金额」刷新一次「同步第三方价目」，或给那行直接填个价。', '__unpriced__')
                  : null}
                {subGapText !== null ? note(subGapText, '__sub_gap__') : null}
              </>
            ) : (
              <>
                {detail('未缓存输入', `${formatTokens(buckets.miss)} · ${formatMoney(estimateParts.miss)}`)}
                {detail('缓存命中', `${formatTokens(buckets.hit)} · ${formatMoney(estimateParts.hit)}`)}
                {detail('输出', `${formatTokens(buckets.out)} · ${formatMoney(estimateParts.out)}`)}
                {note(loading
                  ? '正在按 route 归因…'
                  : routeRows.length > 0 && !foldAgrees
                    ? '日志与投影对不上（会话可能刚写入），这里先按当前档位估算总额'
                    : data?.ok === true
                      ? `这个会话还没有可归因的用量（读了 ${data.events ?? 0} 条事件、`
                        + `${data.samples ?? 0} 条 usage，来源 ${data.source ?? '未知'}）`
                      : data?.ok === false
                        ? `按 route 分列取不到：${data.error ?? '未知原因'}`
                        : '按 route 分列需要宿主半读会话日志', '__fold__')}
              </>
            )}
            {detail('缓存命中率', viewHitRate === null ? '—' : `${viewHitRate}%`)}
            {detail('峰谷', peakText)}
            {/* 单价两行**留在浮层**（2026-09-29 用户拍板）：它们回答"现在按什么价算"，
                而且改完覆盖价立刻能在这里看到数字变化 —— 这正是 0.10.0 的卖点。
                `已自定义` 是个小标：只在这一行的价来自用户覆盖价时出现，默认不占字。 */}
            {detail(`高峰单价（每 1M${overridden ? ' · 已自定义' : ''}）`, peakPrice.unpriced ? '未定价' : priceText(peakPrice.prices))}
            {detail(`空闲单价（每 1M${overridden ? ' · 已自定义' : ''}）`, offPrice.unpriced ? '未定价' : priceText(offPrice.prices))}
            {viewUnpriced
              ? note('这个模型不是 DeepSeek 系、同步来的第三方价目里也没有它，所以金额给不出来。'
                + '去设置页「金额」点一次「同步第三方价目」，或给这个模型直接填一行单价。', '__unpriced__')
              : null}
            {/* 价格档说明（0.11.0 起**只在非默认时出现**）：这一行原本是"这批用量按各自发生
                时刻的价格档结算：…"，常显会让浮层多一行静态文字。所谓"非默认"= 这个会话用到的
                档与**当前生效**的档不一致（跨了 9-10 调价的会话、或整段跑在旧档上的会话）——
                那种情况下浮层上的单价是今天的价、金额却是当时的价，不说明反而是误导。 */}
            {erasUsed.length > 0 && (erasUsed.length > 1 || erasUsed[0] !== eraIdAt(Date.now(), eras))
              ? note('这批用量按各自发生时刻的价格档结算：'
                + erasUsed.map(id => eraById(id, eras).label).join(' · ')
                + '（官方调价不会改动历史金额）', '__eras__')
              : null}
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  )
}
