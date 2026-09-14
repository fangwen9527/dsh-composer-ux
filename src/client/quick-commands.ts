/**
 * 快捷指令与「默认插入」的运行时桥接。
 *
 * 为什么需要这个模块：输入框拦截器（interceptors.ts）活在纯 DOM / 捕获阶段里，
 * 拿不到 React 槽位才有的 `inputActions` 与 InputState 草稿；而「点发送时自动把
 * 提示词附加到消息末尾」两样都要用 —— 得知道当前草稿是什么，再把附加后的整段写
 * 回编辑器。于是由 `conversation.input.right` 的按钮组件在每次渲染时把这两样东西
 * 投递到这里，拦截器同步读取。
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
}

/** 输入框根元素的选择器（与 interceptors.ts 保持一致）。 */
const COMPOSER_SELECTOR = '[data-composer-input]'

/** 输入卡片选择器（官方在 InputBar 上写的标记）。 */
const CARD_SELECTOR = '[data-composer-card]'

const state: BridgeState = { actions: null, draft: '', sessionId: '' }

/**
 * 槽位组件每次渲染投递一次桥接数据。
 * @param next - 本会话的输入动作、当前草稿与服务端会话 id。
 */
export function publishInputBridge(next: {
  readonly actions: InputActionsLike | null
  readonly draft: string
  readonly sessionId: string
}): void {
  state.actions = next.actions
  state.draft = next.draft
  state.sessionId = next.sessionId
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

/** 取「默认插入」条目（保持列表顺序，丢掉空内容）。 */
export function alwaysPrompts(prompts: readonly QuickPrompt[]): readonly QuickPrompt[] {
  return prompts.filter(item => item.always === true && item.prompt.trim() !== '')
}

/**
 * 把勾了「默认插入」的条目拼到原文**末尾**。
 *
 * 规则（与用户确认过的语义一致）：
 *  - 多条按列表顺序拼接，条目之间空一行；
 *  - 原文为空时**不附加** —— 没有「你的消息」可附加，此时应当交还官方原语义
 *    （空输入的 Enter 在官方那里是别的动作，抢过来会让人意外）；
 *  - 一条都没勾时返回 null。
 * @param draft - 当前草稿原文。
 * @param prompts - 完整快捷指令列表。
 * @returns 拼接后的完整草稿；无需附加时为 null。
 */
export function withAlwaysPrompts(draft: string, prompts: readonly QuickPrompt[]): string | null {
  const picked = alwaysPrompts(prompts)
  if (picked.length === 0) return null
  const base = draft.replace(/\s+$/, '')
  if (base === '') return null
  const suffix = picked.map(item => item.prompt.trim()).join('\n\n')
  return `${base}\n\n${suffix}`
}

/**
 * 把「默认插入」写回编辑器。
 *
 * 只负责写入，不负责发送：发送动作交还官方手势（见 interceptors.ts 的两条路径），
 * 这样「发送 / 排队 / 打断」的语义完全由官方决定，本插件不做第二套判断。
 * @param prompts - 完整快捷指令列表。
 * @returns true = 已写入（调用方应继续走官方发送手势）；false = 无需附加。
 */
export function applyAlwaysPrompts(prompts: readonly QuickPrompt[]): boolean {
  const actions = state.actions
  if (actions === null) return false
  const next = withAlwaysPrompts(currentDraft(), prompts)
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

/** 把焦点交还输入框（插入/写回之后调用，方便接着打字）。 */
export function focusComposer(): void {
  const el = document.querySelector(COMPOSER_SELECTOR)
  if (el instanceof HTMLElement) el.focus({ preventScroll: true })
}

/**
 * 目标元素是不是官方的「发送」主按钮。
 *
 * 为什么敢按结构判别：发送键与停止键共用同一个位置（卡片里最后一个 button），
 * 只能靠图形区分 —— 停止渲染 `<rect>`（方块），发送渲染 `<path>`（箭头）。
 * 按图形判别与界面文案、语言都无关，中英文环境一致。
 * @param target - 事件目标。
 * @returns 是发送主按钮时为 true。
 */
export function isSendButton(target: EventTarget | null): target is HTMLElement {
  if (!(target instanceof Element)) return false
  const card = target.closest(CARD_SELECTOR)
  if (card === null) return false
  const buttons = card.querySelectorAll('button')
  if (buttons.length === 0) return false
  const last = buttons[buttons.length - 1]!
  if (last !== target && !last.contains(target)) return false
  if (last instanceof HTMLButtonElement && last.disabled) return false
  // 停止键：方块图标。发送键：箭头 path。
  if (last.querySelector('svg rect') !== null) return false
  return last.querySelector('svg path') !== null
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
  if (record.ok !== true) {
    const message = typeof record.error === 'string' && record.error !== '' ? record.error : '优化失败'
    return { ok: false, error: message }
  }
  const optimized = typeof record.text === 'string' ? record.text.trim() : ''
  if (optimized === '') return { ok: false, error: '模型没有产出任何内容' }
  const route = `${String(record.provider ?? '')}/${String(record.model ?? '')}`
  return { ok: true, text: optimized, route }
}
