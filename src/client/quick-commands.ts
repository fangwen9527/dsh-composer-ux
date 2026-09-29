/**
 * 快捷指令与「发送时附加条目」的运行时桥接。
 *
 * 为什么需要这个模块：输入框拦截器（interceptors.ts）活在纯 DOM / 捕获阶段里，
 * 拿不到 React 槽位才有的 `inputActions` 与 InputState 草稿；而「点发送时自动把
 * 提示词附加到消息末尾」两样都要用 —— 得知道当前草稿是什么，再把附加后的整段写
 * 回编辑器。于是由 `conversation.input.right` 的按钮组件在每次渲染时把这两样东西
 * 投递到这里，拦截器同步读取。
 *
 * 注意分工：**「哪些条目该附加」不在这里判断**，由调用方
 * `appendBatchForSend(book, currentBlankSession())` 决定（「每次」全带上，
 * 「仅首次」只在会话还没有消息时带上）；本模块只负责把那一批拼上去、写回去。
 * 0.4.0 曾在一个函数里判断了两次，见 `withPromptsAppended` 的说明。
 *
 * 本模块零 React 依赖，可被拦截器与组件共用。
 */
import type { QuickPrompt } from '../settings-contract.ts'
import { OPTIMIZER_API_PATH } from '../settings-contract.ts'

/** 官方公开输入动作里本模块用到的两个（见 DSH 的 InputActions 契约）。 */
export interface InputActionsLike {
  /** 整体替换草稿（官方支持的程序化写入路径）。 */
  setDraft: (text: string) => void
}

/** 草稿来源：槽位快照（权威）> DOM 兜底。 */
interface BridgeState {
  actions: InputActionsLike | null
  draft: string
  sessionId: string
  /**
   * 会话是否还**没有任何消息**（槽位给的 `SessionSnapshot.blank`）。
   *
   * 「仅首次插入」就靠它：发完第一条它自己会变成 false，所以不必自己记「本会话附加过
   * 没有」，刷新页面也不会重复附加。取不到会话时按 false 处理（宁可不附加，也不误附加）。
   */
  blank: boolean
}

/** 输入框根元素的选择器（与 interceptors.ts 保持一致）。 */
const COMPOSER_SELECTOR = '[data-composer-input]'

/** 输入卡片选择器（官方在 InputBar 上写的标记）。 */
const CARD_SELECTOR = '[data-composer-card]'

const state: BridgeState = { actions: null, draft: '', sessionId: '', blank: false }

/**
 * 槽位组件每次渲染投递一次桥接数据。
 * @param next - 本会话的输入动作、当前草稿、服务端会话 id、以及会话是否还没有消息。
 */
export function publishInputBridge(next: {
  readonly actions: InputActionsLike | null
  readonly draft: string
  readonly sessionId: string
  readonly blank: boolean
}): void {
  state.actions = next.actions
  state.draft = next.draft
  state.sessionId = next.sessionId
  state.blank = next.blank
}

/**
 * 卸载时撤下桥接，避免「切走的会话」留下的旧 actions 被后续手势误用。
 * 只清自己那份：同一个会话可能先后挂载多个槽位条目。
 * @param sessionId - 卸载方所属会话 id。
 */
export function releaseInputBridge(sessionId: string): void {
  if (state.sessionId !== sessionId) return
  state.actions = null
  state.draft = ''
  state.sessionId = ''
  state.blank = false
}

/** 当前会话是不是还没有任何消息（「仅首次插入」的判据）。 */
export function currentBlankSession(): boolean {
  return state.blank === true
}

/** DOM 兜底读草稿（槽位未挂载时的最后手段）。 */
function draftFromDom(): string {
  const el = document.querySelector(COMPOSER_SELECTOR)
  if (!(el instanceof HTMLElement)) return ''
  return el.innerText.replace(/\n+$/, '')
}

/** 当前草稿：有槽位就信槽位快照，否则读 DOM。 */
export function currentDraft(): string {
  return state.actions === null ? draftFromDom() : state.draft
}

/** 当前会话 id（'' = 无会话）。 */
export function currentSessionId(): string {
  return state.sessionId
}

/**
 * 把这一次要附加的条目拼到原文**末尾**。
 *
 * 规则（与用户确认过的语义一致）：
 *  - 多条按列表顺序拼接，条目之间空一行；
 *  - 原文为空时**不附加** —— 没有「你的消息」可附加，此时应当交还官方原语义
 *    （空输入的 Enter 在官方那里是别的动作，抢过来会让人意外）；
 *  - 批次为空时返回 null；
 *  - **已经以同一段后缀结尾时返回 null（幂等）** —— 万一发送那一步没成，第二次
 *    点击不会把同一段提示词再叠一遍，而是直接放行官方发送（0.2.0 的失控症状就是
 *    「一直点一直插入」，这条护栏让它变成「再点一次就发出去」）。
 *
 * ⚠️ **这里绝不能再按插入模式过滤一遍**：这一批里该有谁，已由调用方
 * `appendBatchForSend(book, blank)` 决定。0.4.0 就是在这里丢过功能的 —— 本函数当时
 * 叫 `withAlwaysPrompts`，内部又按 `always === true` 过滤了一次，后果是：
 *   · 新会话第一条里「仅首次」的条目被这层过滤丢掉，只剩「每次」的；
 *   · 若一条「每次」都没有，`picked.length === 0` 直接返回 null，第一条什么都不附。
 * 模式判断只允许有一处（`settings-contract.ts` 的 `insertModeOf`）。
 * @param draft - 当前草稿原文。
 * @param prompts - 这一次要附加的条目（调用方已决定，含跨分类顺序）。
 * @returns 拼接后的完整草稿；无需附加时为 null。
 */
export function withPromptsAppended(draft: string, prompts: readonly QuickPrompt[]): string | null {
  const picked = prompts.filter(item => item.prompt.trim() !== '')
  if (picked.length === 0) return null
  const base = draft.replace(/\s+$/, '')
  if (base === '') return null
  const suffix = picked.map(item => item.prompt.trim()).join('\n\n')
  if (base.endsWith(suffix)) return null
  return `${base}\n\n${suffix}`
}

/**
 * 把这一次要附加的条目写回编辑器。
 *
 * 只负责写入，不负责发送：发送动作交还官方手势（见 interceptors.ts 的两条路径），
 * 这样「发送 / 排队 / 打断」的语义完全由官方决定，本插件不做第二套判断。
 * @param prompts - 这一次要附加的条目（来自 `deps.promptsForSend()`）。
 * @returns true = 已写入（调用方应继续走官方发送手势）；false = 无需附加。
 */
export function applyPromptsForSend(prompts: readonly QuickPrompt[]): boolean {
  const actions = state.actions
  if (actions === null) return false
  const next = withPromptsAppended(currentDraft(), prompts)
  if (next === null) return false
  actions.setDraft(next)
  return true
}

/** 把一段文本插进输入框（条目点击插入用；原有内容保留，新内容另起一行）。 */
export function insertIntoDraft(text: string): boolean {
  const actions = state.actions
  const body = text.trim()
  if (actions === null || body === '') return false
  const draft = currentDraft()
  const next = draft.trim() === '' ? body : `${draft.replace(/\s+$/, '')}\n${body}`
  actions.setDraft(next)
  return true
}

/** 整体替换草稿（优化结果写回用）。 */
export function replaceDraft(text: string): boolean {
  const actions = state.actions
  if (actions === null) return false
  actions.setDraft(text)
  return true
}

/**
 * 优化已用秒数（向下取整）。
 *
 * `startedAt <= 0` 表示"没有在跑"，返回 0（调用方据此决定要不要显示秒表）。
 * 刻意做成纯函数（`now` 由调用方传）：计时器在测试里不可控，而这段算术必须可验证。
 *
 * @param startedAt - 这次优化的起始时刻（`Date.now()`，0 = 没在跑）。
 * @param now - 当前时刻。
 * @returns 已用整秒数；没在跑时 0。
 */
export function elapsedSeconds(startedAt: number, now: number): number {
  const ms = now - startedAt
  if (!Number.isFinite(ms) || startedAt <= 0 || ms <= 0) return 0
  return Math.floor(ms / 1000)
}

/**
 * 优化耗时文案（秒，一位小数）。
 *
 * 为什么不复用 {@link elapsedSeconds}：一次真实调用可能不到 1 秒（假模型/本地路由），
 * 取整会显示成「用时 0 秒」——那个读数看起来像出错。
 */
export function elapsedText(startedAt: number, now: number): string {
  const ms = now - startedAt
  if (!Number.isFinite(ms) || startedAt <= 0 || ms < 0) return '—'
  return (ms / 1000).toFixed(1)
}

/**
 * 写回前的比对：输入框里还是发起时那一份草稿吗。
 *
 * 只比 trim 后的结果 —— 用户敲了个空格不该算"改过"（那会让一次真花了钱的优化白跑），
 * 但任何**实质**改动都必须算改过：否则我们会把他刚打的新内容整段吃掉。
 *
 * @param before - 发起优化时抓取的草稿。
 * @param after - 拿到结果时输入框里的草稿。
 * @returns 是否可以把结果整体写回去。
 */
export function sameDraft(before: string, after: string): boolean {
  return before.trim() === after.trim()
}

/**
 * 把优化结果拼回输入框：命令前缀原样保留，正文用优化稿。
 *
 * @param prefix - 斜杠命令前缀（没有就是空串）。
 * @param optimized - 宿主回来的成品正文。
 * @returns 准备写进输入框的完整文本。
 */
export function composeOptimizedDraft(prefix: string, optimized: string): string {
  return prefix === '' ? optimized : `${prefix} ${optimized}`
}

/** 把焦点交还输入框（插入/写回之后调用，方便接着打字）。 */
export function focusComposer(): void {
  const el = document.querySelector(COMPOSER_SELECTOR)
  if (el instanceof HTMLElement) el.focus({ preventScroll: true })
}

/**
 * 找出这次点击落在的**官方发送主按钮**；不是发送键时返回 null。
 *
 * 为什么返回元素而不是布尔：调用方要拿它**重放一次点击**（见 interceptors.ts）。
 * 这里必须返回真正的 `<button>`，而不是 `event.target` —— 发送键是个圆形按钮，
 * 视觉中心就是里面的 `<svg>` / `<path>`，而 **SVG 元素没有 `.click()`**。
 * 0.2.0 就是因为把 `event.target` 当按钮用、`click()` 抛 TypeError 而没发送，
 * 症状是「点了只插入、不发送，一直点一直插入」。
 *
 * 为什么敢按结构判别：发送键与停止键共用同一个位置（卡片里最后一个 button），
 * 只能靠图形区分 —— 停止渲染 `<rect>`（方块），发送渲染 `<path>`（箭头）。
 * 按图形判别与界面文案、语言都无关，中英文环境一致。
 * @param target - 事件目标（可能是按钮本身，也可能是它内部的图标）。
 * @returns 官方发送主按钮；无法确定时 null（此时调用方必须**不拦截**）。
 */
export function sendButtonOf(target: EventTarget | null): HTMLButtonElement | null {
  if (!(target instanceof Element)) return null
  const card = target.closest(CARD_SELECTOR)
  if (card === null) return null
  const buttons = card.querySelectorAll('button')
  if (buttons.length === 0) return null
  const last = buttons[buttons.length - 1]!
  // 必须是真正的 <button>：拿到的若是 svg，重放点击会失败。
  if (!(last instanceof HTMLButtonElement)) return null
  if (last !== target && !last.contains(target)) return null
  if (last.disabled) return null
  // 停止键：方块图标。发送键：箭头 path。
  if (last.querySelector('svg rect') !== null) return null
  if (last.querySelector('svg path') === null) return null
  return last
}

/** 一条被宿主丢掉的条目（面板据此如实告诉用户"丢了几条、为什么"）。 */
export interface OptimizeDropped {
  readonly id: string
  readonly kind: string
  readonly reason: string
}

/** 一次优化的结果。 */
export interface OptimizeOutcome {
  readonly ok: boolean
  /** 成功时：优化后的正文。 */
  readonly text?: string
  /** 失败时：给用户看的一句话原因。 */
  readonly error?: string
  /** 成功时：实际使用的路由（用于「优化没生效」时的排查）。 */
  readonly route?: string
  /** 0.6.0 起：通过逐字依据校验、真的进入成品的条目数。 */
  readonly itemCount?: number
  /** 0.6.0 起：被丢掉的条目（引文对不上原话 / 超上限 / 超篇幅预算）。 */
  readonly dropped?: readonly OptimizeDropped[]
  /** 0.6.0 起：宿主给的警告（截断、忽略的 op、预算降级……）。 */
  readonly warnings?: readonly string[]
  /** 0.6.0 起：true = 降级路径（模型没按 JSON 契约输出，整段照收，未做依据校验）。 */
  readonly fallback?: boolean
  /** 0.6.0 起：true = 空产出后重试过一次。 */
  readonly retried?: boolean
  /** 0.6.0 起：'custom' = 用了设置页里那份提示词；'builtin' = 内置那份。 */
  readonly promptSource?: string
  /** 0.6.0 起：被 rewrite 覆盖掉的原话字符数。 */
  readonly rewrittenChars?: number
  /**
   * 0.12.0 起开始读：true = 篇幅闸门真的动过手（装了必保节仍超预算、省略了可选的节）。
   *
   * 此前客户端拿到这个字段却没读（宿主 0.6.0 就在回），结果"成品比原话短"这件事在界面上
   * 没有解释；结果框会把它显示成一行说明。
   */
  readonly truncated?: boolean
}

/** 把宿主回的 `dropped` 收窄成安全形状（响应体按不可信输入处理）。 */
function droppedOf(value: unknown): readonly OptimizeDropped[] {
  if (!Array.isArray(value)) return []
  const out: OptimizeDropped[] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue
    const row = entry as Record<string, unknown>
    out.push({
      id: typeof row.id === 'string' ? row.id : '',
      kind: typeof row.kind === 'string' ? row.kind : '',
      reason: typeof row.reason === 'string' ? row.reason : '',
    })
  }
  return out
}

/** 把宿主回的 `warnings` 收窄成字符串数组。 */
function warningsOf(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string')
}

/**
 * 流式里已经通过校验的一条条目（宿主 `{type:'item'}` 事件）。
 *
 * 与 {@link OptimizeDropped} 同样按**不可信输入**收窄：宿主与客户端同版本，
 * 但响应体不该被当成可信数据直接进 React 状态。
 */
export interface OptimizeItemView {
  /** 1 起的序号（与宿主记账的 `item#N` 对齐）。 */
  readonly index: number
  readonly id: string
  readonly kind: string
  readonly text: string
  /** 逐字引文；`unknown`/`plan`/`risk` 允许为空。 */
  readonly quote: string
  /** 'user' = 引文在你原话里逐字存在；'none' = 模型自己补的（不冒充你说过的话）。 */
  readonly quoteSource: string
}

/** 把一个 `{type:'item'}` 事件收窄成 {@link OptimizeItemView}；认不出就返回 undefined。 */
export function itemViewOf(value: unknown): OptimizeItemView | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const row = value as Record<string, unknown>
  const text = typeof row.text === 'string' ? row.text : ''
  if (text === '') return undefined
  return {
    index: typeof row.index === 'number' ? row.index : 0,
    id: typeof row.id === 'string' ? row.id : '',
    kind: typeof row.kind === 'string' ? row.kind : '',
    text,
    quote: typeof row.quote === 'string' ? row.quote : '',
    quoteSource: typeof row.quoteSource === 'string' ? row.quoteSource : '',
  }
}

/**
 * 把宿主给的结论（旧 JSON 响应体，或流式 `done` 事件的载荷）收窄成 {@link OptimizeOutcome}。
 *
 * 两条路径共用这一个函数：字段含义只有一处定义，不必担心"流式少解析了一个字段"。
 * @param payload - 宿主返回的原始载荷（按不可信输入处理）。
 * @returns 归一化后的结果。
 */
export function outcomeOf(payload: unknown): OptimizeOutcome {
  const record = (typeof payload === 'object' && payload !== null ? payload : {}) as Record<string, unknown>
  const retried = record.retried === true
  if (record.ok !== true) {
    const message = typeof record.error === 'string' && record.error !== '' ? record.error : '优化失败'
    return { ok: false, error: message, retried }
  }
  const optimized = typeof record.text === 'string' ? record.text.trim() : ''
  if (optimized === '') return { ok: false, error: '模型没有产出任何内容', retried }
  return {
    ok: true,
    text: optimized,
    route: `${String(record.provider ?? '')}/${String(record.model ?? '')}`,
    itemCount: typeof record.itemCount === 'number' ? record.itemCount : 0,
    dropped: droppedOf(record.dropped),
    warnings: warningsOf(record.warnings),
    fallback: record.fallback === true,
    retried,
    promptSource: typeof record.promptSource === 'string' ? record.promptSource : '',
    rewrittenChars: typeof record.rewrittenChars === 'number' ? record.rewrittenChars : 0,
    truncated: record.truncated === true,
  }
}

/**
 * 切分服务端事件流（SSE）的一段文本。
 *
 * 为什么做成纯函数：帧边界会**跨 chunk 落在任意位置**（网络怎么切完全不受控），这是整条
 * 流式链路里最容易错、又最难在真机上复现的一步，所以它必须能在 node 里逐例钉住。
 * 只认 `data:` 行：注释行（`:`）、`event:`、`id:` 一律忽略 —— 我们用的是"载荷自带
 * 一个 type 字段"的单一格式，不需要额外的事件名通道。
 *
 * @param buffer - 累积未消费的文本（上一帧剩下的尾巴 + 这一块新数据）。
 * @returns 完整事件（对象载荷）与**还没凑齐的尾巴**（调用方带着它等下一块）。
 */
export function parseSseChunk(buffer: string): { events: readonly Record<string, unknown>[]; rest: string } {
  const events: Record<string, unknown>[] = []
  // 先把 CRLF 归一成 LF：我们自己发的是 `\n\n`，但链路上任何一环都可能把它换成 `\r\n\r\n`，
  // 而 `\n\n` 切不开 `\r\n\r\n`（中间夹着 \r）——那种"一个字都不显示"的故障最难查。
  // 归一之后再切；跨 chunk 落在 `\r` 与 `\n` 之间也没事：rest 留着 `\r`，下一块补上 `\n` 就成了 CRLF。
  const text = buffer.replace(/\r\n/g, '\n')
  const parts = text.split('\n\n')
  const rest = parts.pop() ?? ''
  for (const frame of parts) {
    for (const rawLine of frame.split('\n')) {
      const line = rawLine.replace(/\r$/, '')
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (payload === '') continue
      try {
        const value: unknown = JSON.parse(payload)
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          events.push(value as Record<string, unknown>)
        }
      } catch {
        // 坏帧跳过：界面上少一条流水，不该把整轮优化打断（成品仍由 done 事件给）。
      }
    }
  }
  return { events, rest }
}

/**
 * 请宿主半跑一次独立优化。
 *
 * 为什么是一次 HTTP 往返：出网请求由宿主的模型适配器发出，浏览器侧碰不到模型路由；
 * 宿主 <-> 客户端之间没有别的受支持通道（与 WestFox 的插件同构）。
 * @param text - 输入框里的原文。
 * @param tier - 强度档位。
 * @returns 优化结果；网络层失败也归一成 `ok: false` 而不抛。
 */
export async function optimizeDraft(text: string, tier: string): Promise<OptimizeOutcome> {
  const body = text.trim()
  if (body === '') return { ok: false, error: '输入框是空的，先写点什么再优化' }
  let response: Response
  try {
    response = await fetch(OPTIMIZER_API_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: body, tier }),
    })
  } catch (error) {
    return { ok: false, error: `连不上宿主半的优化接口：${error instanceof Error ? error.message : String(error)}` }
  }
  if (!response.ok) {
    return { ok: false, error: `宿主半返回 HTTP ${response.status}（插件可能还没重启生效）` }
  }
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    return { ok: false, error: '宿主半返回的不是 JSON' }
  }
  const record = (typeof payload === 'object' && payload !== null ? payload : {}) as Record<string, unknown>
  return outcomeOf(record)
}

/**
 * 流式优化的回调（全部可选）。
 *
 * 只暴露"发生了什么"，不暴露任何状态：谁在用（结果框）自己决定怎么渲染。
 * 每条 `item` 都已经过宿主的逐字依据校验 —— 界面不需要、也不该再做一次判断。
 */
export interface OptimizeStreamHandlers {
  /** 又一条条目通过校验（按数组顺序到达）。 */
  readonly onItem?: (item: OptimizeItemView) => void
  /** 又一条条目被丢掉（引文对不上原话 / 超上限 / 档位不匹配）。 */
  readonly onDropped?: (row: OptimizeDropped) => void
}

/**
 * 流式跑一次优化（0.12.0 的「边写边看」）。
 *
 * 与 {@link optimizeDraft} 的关系：**同一件事的两种送达方式**。宿主按 `Accept` 协商，
 * 这里明确要 `text/event-stream`；成品与记账仍由最后的 `done` 事件给出，逐条流水只是
 * "让你提前看到它在核实什么"。失败路径完全一致（预校验失败时宿主回的是普通 JSON + 4xx，
 * 这里按状态码报错）。
 *
 * @param text - 输入框里的原文。
 * @param tier - 强度档位。
 * @param handlers - 逐条/丢弃/重置的回调（都可以不传：不传就是"只要最终结果"）。
 * @param signal - 取消用（Esc 取消 = abort；宿主那边 `res.on('close')` 会跟着中止模型调用）。
 * @returns 最终结果；网络层失败也归一成 `ok: false` 而不抛。
 */
export async function optimizeDraftStream(
  text: string,
  tier: string,
  handlers: OptimizeStreamHandlers = {},
  signal?: AbortSignal,
  previous?: string,
): Promise<OptimizeOutcome> {
  const body = text.trim()
  if (body === '') return { ok: false, error: '输入框是空的，先写点什么再优化' }
  let response: Response
  try {
    response = await fetch(OPTIMIZER_API_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      // sessionId: the host uses it to read conversation context (0.12.0);
      // unavailable session just means "no context", never a failed round.
      body: JSON.stringify({
        text: body,
        tier,
        sessionId: currentSessionId(),
        ...(previous === undefined || previous.trim() === '' ? {} : { previous }),
      }),
      ...(signal === undefined ? {} : { signal }),
    })
  } catch (error) {
    // 取消也是一种"连不上"：如实说成取消，别让用户以为是网络坏了。
    if (signal?.aborted === true) return { ok: false, error: '已取消' }
    return { ok: false, error: `连不上宿主半的优化接口：${error instanceof Error ? error.message : String(error)}` }
  }
  if (!response.ok) {
    // 预校验失败走的是普通 JSON + 状态码（流还没开始）：把宿主那句原因透出来。
    let detail = ''
    try {
      const payload: unknown = await response.json()
      const row = (typeof payload === 'object' && payload !== null ? payload : {}) as Record<string, unknown>
      if (typeof row.error === 'string') detail = row.error
    } catch {
      // 读不出就用状态码本身。
    }
    return { ok: false, error: detail === '' ? `宿主半返回 HTTP ${response.status}（插件可能还没重启生效）` : detail }
  }
  const reader = response.body?.getReader()
  if (reader === undefined) return { ok: false, error: '宿主半没有返回可读的事件流' }
  const decoder = new TextDecoder()
  let buffer = ''
  let outcome: OptimizeOutcome | undefined
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done === true) break
      buffer += decoder.decode(value, { stream: true })
      const parsed = parseSseChunk(buffer)
      buffer = parsed.rest
      for (const event of parsed.events) {
        const type = String(event.type ?? '')
        if (type === 'item') {
          const item = itemViewOf(event)
          if (item !== undefined) handlers.onItem?.(item)
          continue
        }
        if (type === 'dropped') {
          const [row] = droppedOf([event])
          if (row !== undefined) handlers.onDropped?.(row)
          continue
        }
        if (type === 'done') {
          outcome = outcomeOf(event)
          continue
        }
      }
    }
  } catch (error) {
    if (signal?.aborted === true) return outcome ?? { ok: false, error: '已取消' }
    return outcome ?? { ok: false, error: `事件流中断：${error instanceof Error ? error.message : String(error)}` }
  }
  if (outcome !== undefined) return outcome
  return { ok: false, error: '事件流结束了，但宿主没有给出结论（done 事件缺）' }
}
