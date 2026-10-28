/** 输入框拦截器：接管 Enter 家族键位（发送/换行）。
 * 与 React 无关：基于「捕获阶段 + 目标限定 + 合成回放」的拦截模型。
 *
 * 键位规则（总括）：
 *  - 记录目标只在主聊天输入框 [data-composer-input] 内；
 *  - IME 组合期间（isComposing / keyCode 229）一律放行，绝不影响中文输入；
 *  - '/' '@' 触发器菜单或任何输入框 overlay 打开时放行 Enter，让菜单仲裁优先；
 *  - 命中「发送键位」→ 回放带 Ctrl 加速语义之外的普通 Enter（走官方提交管线）；
 *  - 命中「换行键位」→ 回放 Shift+Enter（官方换行管线）；
 *  - Ctrl+Enter / Meta+Enter 若未被绑定，则回放原组合，保留官方「加速提交」行为；
 *  - 其余 Enter 家族组合：消耗但不动作（用户显式取消的原生语义）。
 *
 * 关键守卫：合成回放事件也必须经过 window 捕获监听器，因此回放期间用
 * 同步标志跳过自身拦截，否则发送/换行回放会无限自触发。
 */
import {
  chordToInit, encodeChord, isEnterFamily, type ChordEvent,
} from './chords.ts'
import { applyPromptsForSend, sendButtonOf } from './quick-commands.ts'
import { activeSections, type ComposerUxSettings, type QuickPrompt } from '../settings-contract.ts'

export interface InterceptorDeps {
  /** 同步读取当前解析后的设置（拦截器非 React 环境）。 */
  readonly settings: () => ComposerUxSettings
  /**
   * 同步读取**这一次发送要附加的条目**（跨分类）。
   *
   * 0.3.0 起快捷指令存在 quick-prompts.json 里，不再属于设置文档，所以这里单独要一个
   * 取值函数。「仅首次」的条目是否算在内，由调用方在这个函数里结合「会话是否还没有
   * 消息」决定（见 client.tsx 的 `appendBatchForSend(book, currentBlankSession())`）——
   * 拦截器只负责把拿到的这一批附加上去。
   */
  readonly promptsForSend: () => readonly QuickPrompt[]
}

const INPUT_SELECTOR = '[data-composer-input]'
const OVERLAY_SELECTOR = '[data-trigger-menu], [data-conversation-composer-overlay]'

/** 目标是否落在主聊天输入框及其内部。 */
function findComposerRoot(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  return target.closest<HTMLElement>(INPUT_SELECTOR)
}

/** 触发器菜单（'/' '@'）或输入框 overlay 是否打开。 */
function overlayOpen(): boolean {
  return document.querySelector(OVERLAY_SELECTOR) !== null
}

/** 回放进行中标志：合成事件回到捕获监听器时跳过自身拦截。 */
let replaying = false

/** 官方发送按钮的「先写回、再重放」标志（避免合成点击被自己再拦一次）。 */
let replayingSendClick = false

/** 向输入框根元素派发合成按键（触发 Lexical 自身键盘管线）。 */
function dispatchKey(root: HTMLElement, init: KeyboardEventInit): void {
  replaying = true
  try {
    root.dispatchEvent(new KeyboardEvent('keydown', init))
  } finally {
    replaying = false
  }
}

/** 是否进入 IME 组合（合成事件需与真实按键走同一守卫）。 */
function composing(event: KeyboardEvent): boolean {
  // oxlint-disable-next-line typescript/no-deprecated
  return event.isComposing || event.keyCode === 229
}

/** 安装捕获阶段拦截器（键位 + 官方发送按钮的条目附加）；返回卸载器。 */
export function installInterceptors(deps: InterceptorDeps): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (replaying) return
    // 「键位」栏（或总开关）关着时完全不介入：Enter 家族按 DSH 原生行为走。
    if (!activeSections(deps.settings()).keys) return
    const root = findComposerRoot(event.target)
    if (root === null) return
    if (composing(event)) return
    const chord = encodeChord(event as unknown as ChordEvent)
    if (!isEnterFamily(chord)) return
    // 菜单/overlay 打开时，Enter 要给菜单仲裁（补全选择、弹层关闭）让路。
    if (overlayOpen()) return

    const settings = deps.settings()
    const gesture = chord === settings.sendKey
      ? 'send'
      : chord === settings.newlineKey
        ? 'newline'
        : (chord === 'Ctrl+Enter' || chord === 'Meta+Enter') ? 'accelerated'
          : 'none'

    event.preventDefault()
    event.stopPropagation()
    // 长按连发：消耗一次即可（发送防机枪门与官方一致，换行连发无意义）。
    if (event.repeat) return

    if (gesture === 'send') {
      // 发送时附加条目：先把 promptsForSend() 给出的那一批写回编辑器末尾，再回放发送
      // 手势 —— 官方手势照旧（含运行中「排队 / 打断」的判定），本插件不做第二套判断。
      // 原文为空时 applyPromptsForSend 返回 false，一切照旧。
      // ⚠️ 这一批里「该有谁」已由 promptsForSend()（= appendBatchForSend + blank）定好，
      // 写回这一步不得再按插入模式过滤（0.4.0 在这里丢过「仅首次」）。
      applyPromptsForSend(deps.promptsForSend())
      dispatchKey(root, chordToInit('Enter'))
    } else if (gesture === 'newline') {
      dispatchKey(root, chordToInit('Shift+Enter'))
    } else if (gesture === 'accelerated') {
      dispatchKey(root, chordToInit('Ctrl+Enter'))
    }
    // gesture === 'none'：消耗但无动作。
  }

  /**
   * 官方「发送」按钮上的条目附加。
   *
   * 官方主按钮走的是包内部的 keyboard.submit（没有对外的拦截钩子），所以只能在
   * 捕获阶段认下这次点击。认下之后不去自己调 submit —— 而是先把附加内容写回编辑器、
   * 再用同一个按钮重放一次点击，让官方的 primarySubmitMode（发送 / 排队 / 打断）
   * 原样生效。
   *
   * 两条必须守住的纪律（0.2.0 在这两处都出过事）：
   *  1. 重放的必须是 `sendButtonOf()` 返回的**真 <button>**，不能是 event.target
   *     —— 点在圆形按钮的视觉中心时 target 是内部的 svg，svg 没有 `.click()`，
   *     会抛 TypeError，结果就是「已插入但没发送」。
   *  2. 只有在确认能重放之后才 preventDefault/stopPropagation；拿不到按钮就直接
   *     放行，绝不把用户这次点击吞掉。
   */
  const onClickSend = (event: MouseEvent): void => {
    if (replayingSendClick) return
    const button = sendButtonOf(event.target)
    if (button === null) return
    if (!applyPromptsForSend(deps.promptsForSend())) return
    event.preventDefault()
    event.stopPropagation()
    replayingSendClick = true
    try {
      button.click()
    } finally {
      replayingSendClick = false
    }
  }

  window.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('click', onClickSend, true)
  return () => {
    window.removeEventListener('keydown', onKeyDown, true)
    window.removeEventListener('click', onClickSend, true)
  }
}
