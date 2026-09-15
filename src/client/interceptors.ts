/** 输入框拦截器：接管 Enter 家族键位（发送/换行）与右键菜单。
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
import { applyAlwaysPrompts, sendButtonOf } from './quick-commands.ts'
import type { ComposerUxSettings, MenuState, QuickPrompt } from '../settings-contract.ts'

export interface InterceptorDeps {
  /** 同步读取当前解析后的设置（拦截器非 React 环境）。 */
  readonly settings: () => ComposerUxSettings
  /**
   * 同步读取「默认插入」的条目（跨分类）。
   *
   * 0.3.0 起快捷指令存在 quick-prompts.json 里，不再属于设置文档，所以这里单独要一个
   * 取值函数，而不是从 `settings.quickPrompts` 拿。
   */
  readonly alwaysPrompts: () => readonly QuickPrompt[]
  /** 打开 / 关闭右键菜单。 */
  readonly setMenu: (state: MenuState | null) => void
  /** 自定义菜单当前是否打开（原生菜单模式下需要清掉）。 */
  readonly menuOpen: () => boolean
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

/** 右键时预读成功的剪贴板文本缓存（null = 未预读/预读失败）。 */
let pasteCache: string | null = null

/** 在右键手势里发起一次静默预读：授权浮窗此刻出现，用户顺手点一次即可。 */
function prefetchClipboard(): void {
  pasteCache = null
  const readText = (navigator as Navigator & { clipboard?: { readText?: () => Promise<string> } }).clipboard?.readText
  if (typeof readText !== 'function') return
  readText.call(navigator.clipboard).then(
    (text: string) => { pasteCache = text },
    () => { pasteCache = null },
  )
}

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

/** 安装两个捕获阶段拦截器；返回卸载器。 */
export function installInterceptors(deps: InterceptorDeps): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (replaying) return
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
      // 「默认插入」：先把勾选的提示词写回编辑器末尾，再回放发送手势 ——
      // 官方手势照旧（含运行中「排队 / 打断」的判定），本插件不做第二套判断。
      // 原文为空时 applyAlwaysPrompts 返回 false，一切照旧。
      applyAlwaysPrompts(deps.alwaysPrompts())
      dispatchKey(root, chordToInit('Enter'))
    } else if (gesture === 'newline') {
      dispatchKey(root, chordToInit('Shift+Enter'))
    } else if (gesture === 'accelerated') {
      dispatchKey(root, chordToInit('Ctrl+Enter'))
    }
    // gesture === 'none'：消耗但无动作。
  }

  const onContextMenu = (event: MouseEvent): void => {
    const root = findComposerRoot(event.target)
    if (root === null) return
    // 原生菜单模式：不让第三方插件（如 dsh-paste-input-plus 的「只有复制」菜单）
    // 吃掉 contextmenu——我们排在 capture 阶段先执行，stopImmediatePropagation 后
    // 事件到不了 bubble 阶段的插件监听器；但不 preventDefault，浏览器原生菜单照常出现。
    if (deps.settings().menuNative) {
      if (deps.menuOpen()) deps.setMenu(null)
      event.stopImmediatePropagation()
      event.stopPropagation()
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const selection = window.getSelection()
    const hasSelection = selection !== null
      && !selection.isCollapsed
      && selection.anchorNode !== null
      && root.contains(selection.anchorNode)
    deps.setMenu({ x: event.clientX, y: event.clientY, hasSelection })
    // 趁着右键的用户手势还在，静默预读剪贴板（授权浮窗此刻弹出，点一次即固化）。
    prefetchClipboard()
  }

  /**
   * 官方「发送」按钮上的「默认插入」。
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
    if (!applyAlwaysPrompts(deps.alwaysPrompts())) return
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
  window.addEventListener('contextmenu', onContextMenu, true)
  window.addEventListener('click', onClickSend, true)
  return () => {
    window.removeEventListener('keydown', onKeyDown, true)
    window.removeEventListener('contextmenu', onContextMenu, true)
    window.removeEventListener('click', onClickSend, true)
  }
}

/** 右键菜单动作 id（与 MENU_ITEMS 对应）。 */
export type MenuActionId = 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'delete' | 'selectAll'

export interface MenuActionResult {
  readonly ok: boolean
  readonly message?: string
}

/** 在当前输入框上执行一个右键菜单动作。 */
export async function runMenuAction(id: MenuActionId): Promise<MenuActionResult> {
  const root = document.querySelector<HTMLElement>(INPUT_SELECTOR)
  if (root === null) return { ok: false, message: '找不到输入框' }
  if (!document.activeElement || !root.contains(document.activeElement)) {
    if (root.isConnected) {
      root.focus({ preventScroll: true })
    }
  }
  switch (id) {
    case 'undo':
      dispatchKey(root, chordToInit('Ctrl+Z'))
      return { ok: true }
    case 'redo':
      dispatchKey(root, chordToInit('Ctrl+Y'))
      return { ok: true }
    case 'copy':
      return { ok: document.execCommand('copy') }
    case 'cut':
      return { ok: document.execCommand('cut') }
    case 'delete':
      return { ok: document.execCommand('delete') }
    case 'selectAll':
      return { ok: document.execCommand('selectAll') }
    case 'paste':
      return pasteText(root)
  }
}

/** 带超时的 Promise（用于等待剪贴板授权弹窗）。 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => { reject(new Error('clipboard-read timeout')) }, ms)
    promise.then(
      (value) => { clearTimeout(timer); resolve(value) },
      (error: unknown) => { clearTimeout(timer); reject(error) },
    )
  })
}

function isClipboardTimeout(error: unknown): boolean {
  return error instanceof Error && error.message === 'clipboard-read timeout'
}

/** Firefox：剪贴板授权不进站点权限面板，只能靠 about:config 全局允许一次。 */
function isFirefox(): boolean {
  return typeof navigator !== 'undefined' && /Firefox\//.test(navigator.userAgent)
}

/** Firefox 一次性配置指引（全局允许读剪贴板，after:config 新建整数，改完立即生效）。 */
const FIREFOX_TIP = 'Firefox 每次读剪贴板都要点「粘贴(P)」确认：地址栏输入 about:config → 接受风险继续 → 右键新建「整数」→ 名称填 permissions.default.clipboard-read → 值填 1 → 重进 DSH；之后点一次粘贴即成功（或直接 Ctrl+V）'

/** 粘贴：读剪贴板后在光标处插入纯文本。
 * 浏览器安全模型：写剪贴板（复制/剪切）免授权，读剪贴板（粘贴）必须授权，
 * 任何网页都无法绕过——但首次授权后浏览器会记住该站点，之后静默可用。
 * 优先使用右键时预读的缓存（授权已被点击过一次，无感），失败再实时读取。
 */
async function pasteText(root: HTMLElement): Promise<MenuActionResult> {
  const insertText = (text: string): MenuActionResult => {
    if (!document.activeElement || !root.contains(document.activeElement)) {
      root.focus({ preventScroll: true })
    }
    if (text === '') return { ok: true }
    return { ok: document.execCommand('insertText', false, text) }
  }
  // 缓存命中：右键时授权已完成，直接插入（可能为空字符串，此时走实时读取）。
  if (pasteCache !== null && pasteCache !== '') {
    const text = pasteCache
    pasteCache = null
    return insertText(text)
  }
  if (typeof navigator === 'undefined' || navigator.clipboard === undefined
    || typeof navigator.clipboard.readText !== 'function') {
    return { ok: false, message: '当前浏览器不支持读取剪贴板，请用 Ctrl+V 粘贴' }
  }
  // 权限预检：已被明确拒绝时直接给恢复指引（避免假死或误导）。
  const permissions = (navigator as {
    permissions?: { query?: (descriptor: { name: string }) => Promise<{ state: string }> }
  }).permissions
  if (permissions?.query) {
    try {
      const result = await permissions.query({ name: 'clipboard-read' })
      if (result.state === 'denied') {
        if (isFirefox()) return { ok: false, message: FIREFOX_TIP }
        return {
          ok: false,
          message: '浏览器已拒绝剪贴板读取：点击地址栏左侧图标 → 站点设置 → 剪贴板 → 允许；或直接按 Ctrl+V',
        }
      }
    } catch {
      // 不支持该权限查询：继续尝试读取。
    }
  }
  let text: string
  try {
    // 等待授权弹窗可能较久（要用户点击），不用短超时误报失败；15 秒无响应
    // 才提示，避免菜单永久挂起。
    text = await withTimeout(navigator.clipboard.readText(), 15000)
  } catch (error) {
    if (isFirefox()) {
      return { ok: false, message: FIREFOX_TIP }
    }
    if (isClipboardTimeout(error)) {
      return {
        ok: false,
        message: '等待浏览器授权超时：请在弹出提示中选择「允许」（若未出现，点地址栏左侧图标开启），或按 Ctrl+V',
      }
    }
    return {
      ok: false,
      message: '未获剪贴板读取授权：点击地址栏左侧图标 → 站点设置 → 剪贴板 → 允许；或直接按 Ctrl+V 粘贴',
    }
  }
  if (!document.activeElement || !root.contains(document.activeElement)) {
    root.focus({ preventScroll: true })
  }
  if (text === '') return { ok: true }
  return { ok: document.execCommand('insertText', false, text) }
}
