/**
 * 面板内「结果框」的状态与状态迁移（0.12.0）。
 *
 * 为什么把状态机做成纯函数：结果框的每条规则（同一轮里条目只追加、取消保留已生成的条目、
 * 手改之后置编辑标记、插入前比对草稿、面板关闭不清空）都是**行为契约**，而它们在浏览器里
 * 很难逐例复现。抽成纯函数后组件只负责画，判断全在 node 里钉住（测试第 3d 节）。
 *
 * 单轮语义（用户 2026-09-29 选的是 A：「单轮结果框」）：一次优化一份结果 ——
 * 「重新优化」是开新一轮，不是把多轮堆在同一个框里。记忆链（0.12.0 第四批）会把
 * 上一轮的成品作为 `previous` 传给宿主，但框里仍然只显示**这一轮**。
 *
 * 诚实边界：取消时框里保留的是**条目流水**，不是成品 —— 成品要等整段输出到齐、
 * 逐条校验装配完才存在（见 optimizer-assemble.ts），取消时它本来就不存在。
 * 所以取消后面板文案必须说"已生成的部分"，不能假装有成品。
 */
import type { OptimizeDropped, OptimizeItemView, OptimizeOutcome } from './quick-commands.ts'
import { sameDraft } from './quick-commands.ts'

/** 结果框当前的阶段。 */
export type OptimizeDockPhase = 'running' | 'done' | 'error' | 'cancelled'

/** 结果框状态（`null` = 框收起）。 */
export interface OptimizeDockState {
  readonly phase: OptimizeDockPhase
  /** 逐条流水：已经通过宿主逐字依据校验的条目（按到达顺序）。 */
  readonly items: readonly OptimizeItemView[]
  /** 被丢掉的条目（引文对不上 / 超上限 / 档位不匹配）。 */
  readonly dropped: readonly OptimizeDropped[]
  /** 成品正文 —— **用户可编辑**；完成后才填。 */
  readonly text: string
  /** 用户手改过成品吗（重新优化前据此提示"会覆盖手改"）。 */
  readonly edited: boolean
  /** 失败时给用户看的一句话。 */
  readonly error: string
  /** 实际路由（`provider/model`），完成后才有。 */
  readonly route: string
  /** 成品的记账（与状态行同一套语义，见 dockSummary）。 */
  readonly truncated: boolean
  readonly fallback: boolean
  readonly retried: boolean
  readonly promptSource: string
  /** 宿主记账的条目数（完成后可能与流水条数不同：篇幅闸门会丢掉可选的节）。 */
  readonly itemCount: number
  /** 这一轮的起始时刻（跑的时候 > 0，秒表读数由它算）。 */
  readonly startedAt: number
  /** 这一轮实际耗时（毫秒；完成/取消时填，跑的时候是 0）。 */
  readonly elapsedMs: number
  /** 发起时输入框里的原文（插入前比对：期间被改过就先问一次）。 */
  readonly draftAtStart: string
  /** 送去优化的正文（不含斜杠前缀）；「重新优化」与记忆链都用它。 */
  readonly source: string
  /** 斜杠命令前缀（插入时原样拼回）。 */
  readonly slashPrefix: string
}

/** 结果框事件。 */
export type OptimizeDockEvent =
  | { readonly type: 'start'; readonly source: string; readonly draft: string; readonly prefix: string; readonly startedAt: number }
  | { readonly type: 'item'; readonly item: OptimizeItemView }
  | { readonly type: 'dropped'; readonly row: OptimizeDropped }
  | { readonly type: 'done'; readonly outcome: OptimizeOutcome; readonly at: number }
  | { readonly type: 'cancel'; readonly at: number }
  | { readonly type: 'edit'; readonly text: string }
  | { readonly type: 'clear' }

/**
 * 状态迁移。
 *
 * 两条"只认第一条"的规则是刻意的：同一个 `id` 的条目/丢弃记录只收一次 ——
 * 传输层若因重连/重放把同一条送来两次，框里不该出现两行（条目上限与依据记账都会跟着错）。
 *
 * @param state - 当前状态（null = 框收起）。
 * @param event - 事件。
 * @returns 新状态；`clear` 返回 null。
 */
export function dockReducer(state: OptimizeDockState | null, event: OptimizeDockEvent): OptimizeDockState | null {
  switch (event.type) {
    case 'start':
      // 开新一轮：条目流水、成品、记账全部清空（单轮语义）。
      return {
        phase: 'running',
        items: [],
        dropped: [],
        text: '',
        edited: false,
        error: '',
        route: '',
        truncated: false,
        fallback: false,
        retried: false,
        promptSource: '',
        itemCount: 0,
        startedAt: event.startedAt,
        elapsedMs: 0,
        draftAtStart: event.draft,
        source: event.source,
        slashPrefix: event.prefix,
      }
    case 'item': {
      if (state === null) return state
      if (state.items.some(row => row.id === event.item.id)) return state
      return { ...state, items: [...state.items, event.item] }
    }
    case 'dropped': {
      if (state === null) return state
      if (state.dropped.some(row => row.id === event.row.id)) return state
      return { ...state, dropped: [...state.dropped, event.row] }
    }
    case 'done': {
      if (state === null) return state
      const outcome = event.outcome
      const ok = outcome.ok === true
      return {
        ...state,
        phase: ok ? 'done' : 'error',
        text: ok ? (outcome.text ?? '') : '',
        edited: false,
        error: ok ? '' : (outcome.error ?? '优化失败'),
        route: outcome.route ?? '',
        truncated: outcome.truncated === true,
        fallback: outcome.fallback === true,
        retried: outcome.retried === true,
        promptSource: outcome.promptSource ?? '',
        itemCount: typeof outcome.itemCount === 'number' ? outcome.itemCount : state.items.length,
        startedAt: 0,
        elapsedMs: elapsed(state.startedAt, event.at),
      }
    }
    case 'cancel': {
      if (state === null) return state
      // 条目保留（用户等了几十秒看到的东西不该一键蒸发），成品留空 —— 它本来就不存在。
      return { ...state, phase: 'cancelled', startedAt: 0, elapsedMs: elapsed(state.startedAt, event.at), error: '' }
    }
    case 'edit': {
      if (state === null) return state
      return { ...state, text: event.text, edited: true }
    }
    case 'clear':
      return null
  }
}

/** 已用毫秒（起始时刻为 0 —— 没在跑 —— 时回 0，绝不出现负数）。 */
function elapsed(startedAt: number, at: number): number {
  if (startedAt <= 0 || !Number.isFinite(at)) return 0
  return at > startedAt ? at - startedAt : 0
}

/**
 * 「插入输入框」这一下该干什么。
 *
 * 为什么需要"先问一次"：优化是一次往返（几十秒），期间用户完全可能又打了字。
 * 直接覆盖会静默吃掉他刚写的内容 —— 所以先给一次明确的确认机会（界面上是
 * "再点一次确认覆盖"），而不是弹一个会打断输入的浏览器 confirm。
 *
 * @param state - 结果框状态（null = 框收起）。
 * @param currentDraft - 此刻输入框里的内容。
 * @param confirmed - 用户是否已经在这次插入上点过第二下。
 * @returns `empty` = 没有可插的成品；`insert` = 直接覆盖；`confirm` = 先要一次确认。
 */
export function insertDecision(
  state: OptimizeDockState | null,
  currentDraft: string,
  confirmed: boolean,
): 'empty' | 'insert' | 'confirm' {
  if (state === null || state.phase !== 'done' || state.text.trim() === '') return 'empty'
  if (confirmed) return 'insert'
  return sameDraft(state.draftAtStart, currentDraft) ? 'insert' : 'confirm'
}

/**
 * 结果框底部那行记账（与面板状态行同一套措辞：同一件事不该有两处各写一遍的说法）。
 * @param state - 结果框状态。
 * @returns 一行中文说明（各段用 ` · ` 连接）。
 */
export function dockSummary(state: OptimizeDockState): string {
  const bits: string[] = []
  if (state.fallback) bits.push('模型没按条目契约输出，已整段照收（未校验依据）')
  else {
    const count = state.phase === 'done' && state.itemCount > 0 ? state.itemCount : state.items.length
    bits.push(`${String(count)} 条补全`)
  }
  if (state.dropped.length > 0) bits.push(`丢弃 ${String(state.dropped.length)} 条`)
  if (state.promptSource === 'custom') bits.push('自定义提示词')
  if (state.retried) bits.push('重试过一次')
  if (state.truncated) bits.push('篇幅闸门动过手（省略了可选的节）')
  if (state.edited) bits.push('你手改过')
  return bits.join(' · ')
}

/**
 * 结果框顶部的阶段文案。
 *
 * `running` 时只报"等待模型响应" —— 非流式那半边做不到更细的阶段（流式下逐条流水本身
 * 就是进度），不编造一个我们其实不知道的阶段名。
 * @param state - 结果框状态。
 * @returns 一行中文文案。
 */
export function dockPhaseText(state: OptimizeDockState): string {
  switch (state.phase) {
    case 'running': return '正在优化…（等待模型响应）'
    case 'done': return '优化完成'
    case 'cancelled': return '已取消：下面是已经生成的部分'
    case 'error': return '出错了'
  }
}
