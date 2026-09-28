/**
 * 「金额」条目（0.8.0）：注册在 `conversation.composer.dock` 上的一颗极简金额胶囊。
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
 *  · **折叠态那一个数字**：用官方 `tokenUsage` 投影 + `modelSelection.lastUsed` 的模型算
 *    （纯客户端、零请求、随流式更新），是"马上能看"的估值。
 *  · **展开态的分列**：必须逐请求归因，只有宿主半能做到，所以点开时才向
 *    `/composer-ux/usage?sessionId=…` 取一次（折叠规则在 `src/usage-fold.ts`）。
 *    **分列到手后，面板总额改成分列之和**，这样"分列加起来等于总额"永远成立。
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
 */
import React from 'react'
import { createPortal } from 'react-dom'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-store'
import { USAGE_API_PATH, type ComposerUxSettings } from '../settings-contract.ts'
import {
  PRICE_VERIFIED_AT, costBucketsOf, costPartsOf, formatMoney, formatTokens, isKnownModel, resolvePrice,
} from '../pricing.ts'
import { UNKNOWN_ROUTE, agreesWithProjection, type UsageBuckets } from '../usage-fold.ts'
import { billedInputTokens, cacheHitText } from './stats-line.ts'

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

/** 宿主半 `/composer-ux/usage` 的响应。 */
interface UsageBreakdown {
  readonly ok?: boolean
  readonly error?: string
  /** 事件来源：`sessionQuery`（官方完整日志）/ `live`（活会话对象）/ `none`。 */
  readonly source?: string
  /** 折过的事件条数与真正折到 usage 的条数（诊断用：区分"没事件"与"形状不对"）。 */
  readonly events?: number
  readonly samples?: number
  readonly total?: UsageBuckets
  readonly routes?: readonly { readonly provider?: string; readonly model?: string; readonly usage?: UsageBuckets }[]
}

/** 注入面：标准套件给 `sessionId` / `useProjection`，我们自己的 `inject` 给 `live`。 */
export interface CostChipInjected {
  readonly useLive: SnapshotSelectorHook<ComposerUxSettings>
  /** 当前会话 id（session 级槽位由框架解析后注入）。 */
  readonly sessionId?: string
  readonly useProjection: (key: string) => unknown
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

/**
 * 金额胶囊本体。
 *
 * hooks 一律在早退之前调用（没有用量时返回 null 只是不画，不是不挂载）。
 */
export function CostChipEntry({ useLive, sessionId, useProjection }: CostChipInjected): React.ReactElement | null {
  // 设置快照这一版还没用上（币种/覆盖价/开关在下一版接入），但读它能让组件在设置变化时重画。
  useLive(item => item)
  const project = typeof useProjection === 'function' ? useProjection : () => undefined
  const usage = project('tokenUsage') as TokenUsageLike | undefined
  const selection = project('modelSelection') as ModelSelectionLike | undefined

  const [open, setOpen] = React.useState(false)
  const [hover, setHover] = React.useState(false)
  const [anchor, setAnchor] = React.useState<{ readonly left: number; readonly top: number } | null>(null)
  const [breakdown, setBreakdown] = React.useState<UsageBreakdown | null>(null)
  const [loading, setLoading] = React.useState(false)
  const chip = React.useRef<HTMLButtonElement | null>(null)

  // 两个名字都认（投影 `uncachedInputTokens` / 日志 `inputTokens`）—— 见文件头"字段名坑"。
  const buckets = costBucketsOf(usage)
  const model = selection?.lastUsed?.model
  const price = resolvePrice(model, {})
  const parts = costPartsOf(buckets, price.prices)
  const billed = buckets.miss + buckets.hit + buckets.out + (usage?.cacheWriteTokens ?? 0)

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

  // 点开时才去问宿主半"这个会话按 route 各花了多少"。每次打开都重取一次，数字不会停在旧值上。
  React.useEffect(() => {
    if (!open || typeof sessionId !== 'string' || sessionId.length === 0) return
    let cancelled = false
    setLoading(true)
    fetch(`${USAGE_API_PATH}?sessionId=${encodeURIComponent(sessionId)}`, { headers: { accept: 'application/json' } })
      .then(response => response.json() as Promise<UsageBreakdown>)
      .then(data => { if (!cancelled) setBreakdown(data) })
      .catch(() => { if (!cancelled) setBreakdown({ ok: false, error: '取不到按 route 的分列' }) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, sessionId])

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
  const fold = breakdown?.ok === true && Array.isArray(breakdown.routes)
    ? {
        total: breakdown.total ?? { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
        routes: breakdown.routes,
      }
    : null
  const foldAgrees = fold !== null && agreesWithProjection(
    { total: fold.total },
    {
      inputTokens: buckets.miss,
      outputTokens: buckets.out,
      cacheReadTokens: buckets.hit,
      cacheWriteTokens: usage?.cacheWriteTokens ?? 0,
    },
  )
  const routeRows = fold?.routes
    .filter(route => {
      const row = route.usage ?? { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }
      return row.inputTokens + row.outputTokens + row.cacheReadTokens + row.cacheWriteTokens > 0
    })
    .map(route => {
      const row = route.usage ?? { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }
      const priced = resolvePrice(route.model ?? '')
      const rowParts = costPartsOf(costBucketsOf(row), priced.prices)
      return {
        provider: route.provider === undefined || route.provider === '' ? UNKNOWN_ROUTE : route.provider,
        model: route.model === undefined || route.model === '' ? UNKNOWN_ROUTE : route.model,
        unknownModel: isKnownModel(route.model) === false,
        tokens: row.inputTokens + row.outputTokens + row.cacheReadTokens + row.cacheWriteTokens,
        cost: rowParts.total,
        parts: rowParts,
      }
    }) ?? []
  const routeTotal = routeRows.reduce((sum, route) => sum + route.cost, 0)
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
  const useBreakdown = routeRows.length > 0 && foldAgrees
  // ── 展示口径：分列到手就用分列，否则用投影 ─────────────────────────────────
  // 命中率必须和面板上那些数字**同源**（否则同一个面板里两个数字互相打脸），而分母必须是
  // 官方 `billedInputTokens()` 的口径（未缓存 + 缓存读 + 缓存写）——注意这里的**键名**，
  // 见文件头"字段名坑"的第二次踩坑记录。
  const view = useBreakdown && fold !== null
    ? {
        miss: fold.total.inputTokens,
        hit: fold.total.cacheReadTokens,
        write: fold.total.cacheWriteTokens,
        out: fold.total.outputTokens,
        parts: routeParts,
        total: routeTotal,
      }
    : {
        miss: buckets.miss,
        hit: buckets.hit,
        write: usage?.cacheWriteTokens ?? 0,
        out: buckets.out,
        parts,
        total: parts.total,
      }
  const viewBilledInput = billedInputTokens({
    uncachedInputTokens: view.miss,
    cacheReadTokens: view.hit,
    cacheWriteTokens: view.write,
  })
  // 与输入框下面那一行（本插件的三位小数改写）**同一套函数、同一位数**，两处数字必然一致。
  const viewHitRate = cacheHitText(view.hit, viewBilledInput)
  const headline = formatMoney(view.total)
  const expanded = hover || open

  return (
    <>
      <button
        ref={chip}
        type="button"
        data-composer-ux-cost=""
        aria-expanded={open}
        title="本会话费用（估算）"
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
      >{headline}</button>
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
          }}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 8,
            color: 'var(--dsw-alias-label-primary)',
            fontWeight: 500,
          }}>
            <span>本会话费用</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{headline}</span>
          </div>
          <div style={{ marginBottom: 10, borderTop: '0.5px solid var(--dsw-alias-border-l2)' }} />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(76px, auto) minmax(0, 1fr)',
            gap: '6px 16px',
            margin: 0,
          }}>
            {useBreakdown ? (
              <>
                {routeRows.map(route => detail(
                  `${route.provider} · ${route.model}`,
                  `${formatTokens(route.tokens)} · ${formatMoney(route.cost)}`,
                  `${route.provider}|${route.model}`,
                ))}
                {detail('合计', `${formatTokens(view.miss + view.hit + view.write + view.out)} · ${formatMoney(view.total)}`, '__total__')}
                {detail('未缓存输入', `${formatTokens(view.miss)} · ${formatMoney(view.parts.miss)}`, '__miss__')}
                {detail('缓存命中', `${formatTokens(view.hit)} · ${formatMoney(view.parts.hit)}`, '__hit__')}
                {detail('输出', `${formatTokens(view.out)} · ${formatMoney(view.parts.out)}`, '__out__')}
                {routeRows.some(route => route.unknownModel)
                  ? note('有一行的模型不在官方价目表里，那一行按 deepseek-flash 估价', '__unknown__')
                  : null}
              </>
            ) : (
              <>
                {detail('未缓存输入', `${formatTokens(buckets.miss)} · ${formatMoney(parts.miss)}`)}
                {detail('缓存命中', `${formatTokens(buckets.hit)} · ${formatMoney(parts.hit)}`)}
                {detail('输出', `${formatTokens(buckets.out)} · ${formatMoney(parts.out)}`)}
                {note(loading
                  ? '正在按 route 归因…'
                  : routeRows.length > 0 && !foldAgrees
                    ? '日志与投影对不上（会话可能刚写入），这里按投影口径显示总额'
                    : breakdown?.ok === true
                      ? `这个会话还没有可归因的用量（读了 ${breakdown.events ?? 0} 条事件、`
                        + `${breakdown.samples ?? 0} 条 usage，来源 ${breakdown.source ?? '未知'}）`
                      : breakdown?.ok === false
                        ? `按 route 分列取不到：${breakdown.error ?? '未知原因'}`
                        : '按 route 分列需要宿主半读会话日志', '__fold__')}
              </>
            )}
            {detail('缓存命中率', viewHitRate === null ? '—' : `${viewHitRate}%`)}
            {detail('单价（每 1M）', `${price.prices.miss} / ${price.prices.hit} / ${price.prices.out}`)}
            {note(`${model === undefined || model === '' ? '未知模型（按默认模型计价）' : model} · `
              + `${price.peak ? '高峰档' : '空闲档'} · 刊例价快照 ${PRICE_VERIFIED_AT}`)}
            {note('各 route 都按 DeepSeek 官方价估算，未含中转加价；实际扣费以各家账单为准。')}
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  )
}
