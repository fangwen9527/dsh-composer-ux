/**
 * 左侧「全局面板」那一组的折叠（0.27.0）。
 *
 * ## 用户要什么
 *
 * 2026-10-28：「给我的插件添加一个打开后默认折叠这个区域的功能」，并在追问里选了
 * **A + B 都要、在设置里选**：
 *   · **A｜收成一条**：那 5 个入口（插件 / 自动化任务 / 上下文洞察 / MCP连接器 / 更多）
 *     变成一行「全局面板」，点一下展开；
 *   · **B｜只留图标**：保留那一排按钮，但只显示图标（悬停出名字）；
 *   · 外加「不折叠」这一档，等价于关掉。
 *
 * ## 为什么用 aria-label 找宿主节点，而不是类名
 *
 * 宿主那棵树的类名是 CSS Modules 哈希（`_panelList_xxxx`），每次发版都可能变；而
 * `dsh-client-ui-sidebar` 里写得很清楚：
 *
 * ```jsx
 * <nav className={panelList} aria-label={t('panels.label')}>      // 全局面板 / Global panels
 *   <button aria-label={label} class="panelRow">
 *     <span class="panelGlyph" aria-hidden="true">{icon}</span>
 *     {wide && <span class="panelTitle">{label}</span>}            // 只有宽侧栏才有文字
 *   </button>
 * ```
 *
 * 所以：**组**用 `nav[aria-label="全局面板"]`（兼容英文），**文字**用
 * `button > span:not([aria-hidden="true"])` —— 图标那一颗带 `aria-hidden`，文字那颗没有，
 * 这个区别是语义上的、不是样式上的，比类名稳。
 *
 * ## 为什么还要 MutationObserver
 *
 * 面板条目是 React 渲染的（切换会话、装了新插件、`wide` 变化都会重渲染）。我们改的是
 * **DOM 属性**，React 不会主动保留；所以挂一个只观察侧栏子树的观察器，变了就重新贴一遍
 * （本函数幂等：该有的属性有了就不动）。
 */

/** 折叠形态：不折叠 / 收成一条 / 只留图标。与 `settings-contract.ts` 的 `NavFoldMode` 同值。 */
export type NavFoldMode = 'off' | 'bar' | 'icons'

/** 一次应用所需的全部状态。 */
export interface NavFoldState {
  readonly mode: NavFoldMode
  /** true = 收起（bar 模式藏掉整组；icons 模式本来就是收起的，此值只用于 bar 的展开）。 */
  readonly collapsed: boolean
}

/** 面板组的无障碍名（宿主 i18n 的两份文案）。 */
const NAV_LABELS = ['全局面板', 'Global panels'] as const

/** 兜底识别用的条目名（宿主拿不到 aria-label 时按"这组里有这些按钮"认）。 */
const PANEL_HINTS = ['插件', 'Plugins', '自动化任务', '上下文洞察', 'MCP连接器', '更多', 'More'] as const

/** 折叠条上的文案（与宿主那份 `panels.label` 保持一致，别让用户看到两个名字）。 */
export const NAV_FOLD_HEADER_TEXT = '全局面板'

/** 我们贴上去的属性名（全带 `data-ux-` 前缀，绝不和宿主的属性撞）。 */
export const NAV_FOLD_ATTR = 'data-ux-nav-fold'
export const NAV_FOLD_HEAD_ATTR = 'data-ux-nav-fold-head'
export const NAV_FOLD_STYLE_ATTR = 'data-ux-nav-fold-style'
export const NAV_FOLD_TITLE_ATTR = 'data-ux-nav-title'

/**
 * 把状态折算成贴在 `<nav>` 上的属性值。
 *
 * 单独一个纯函数，是为了让"三档 × 展开/收起"这六种组合能在 node 测试里逐条钉住
 * （DOM 那半边在测试环境里没有实现，只有这条映射是可测的）。
 *
 * @param state - 当前形态与收起状态。
 * @returns 属性值；`null` = 不折叠（同时表示要摘掉属性）。
 */
export function navFoldAttrOf(state: NavFoldState): string | null {
  if (state.mode === 'off') return null
  if (state.mode === 'icons') return 'icons'
  return state.collapsed ? 'bar-collapsed' : 'bar-open'
}

/**
 * 折叠相关的全部样式。
 *
 * 用 `!important` 的地方只有两处（藏整组、藏文字），因为宿主的行内/模块样式优先级不低；
 * 其余都靠属性选择器自然生效。
 */
export const NAV_FOLD_CSS = `
nav[${NAV_FOLD_ATTR}='bar-collapsed'] { display: none !important; }
nav[${NAV_FOLD_ATTR}='icons'] { flex-direction: row; flex-wrap: wrap; gap: 4px; }
nav[${NAV_FOLD_ATTR}='icons'] > button {
  width: 34px;
  min-width: 34px;
  padding-left: 0;
  padding-right: 0;
  justify-content: center;
}
/* 图标那一颗带 aria-hidden，文字那颗不带 —— 靠语义藏文字，不认哈希类名。 */
nav[${NAV_FOLD_ATTR}='icons'] > button > span:not([aria-hidden='true']) { display: none !important; }
/* 「更多」那颗按钮的标签是**裸文本节点**（没有 span），上面那条规则管不到它；
   所以图标模式再补一刀 fontSize:0（图标是 SVG，不受字号影响）。 */
nav[${NAV_FOLD_ATTR}='icons'] > button { font-size: 0; }
[${NAV_FOLD_HEAD_ATTR}] {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  box-sizing: border-box;
  padding: 6px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
}
[${NAV_FOLD_HEAD_ATTR}]:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-secondary); }
[${NAV_FOLD_HEAD_ATTR}]:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
[${NAV_FOLD_HEAD_ATTR}] > span[data-ux-nav-fold-chevron] { margin-left: auto; opacity: .7; }
`

/**
 * 找到宿主那个「全局面板」组。
 *
 * 三级策略（越往后越宽松，但都要求"确实像那一组"，绝不乱抓一个 nav）：
 *   1. `nav[aria-label]` 命中宿主的两份文案；
 *   2. 任意 `nav` 里含"插件 / 更多"这类条目文案；
 *   3. 放弃（返回 null）—— 此时整个功能静默不生效，不影响宿主。
 *
 * @param doc - 文档（测试可传假对象）。
 * @returns 那个 nav 元素；找不到返回 null。
 */
export function findPanelNav(doc: Document): HTMLElement | null {
  const navs = [...doc.querySelectorAll('nav')] as HTMLElement[]
  for (const nav of navs) {
    const label = (nav.getAttribute('aria-label') ?? '').trim()
    if ((NAV_LABELS as readonly string[]).includes(label)) return nav
  }
  for (const nav of navs) {
    const texts = [...nav.querySelectorAll('button')]
      .map(button => (button.getAttribute('aria-label') ?? button.textContent ?? '').trim())
    if (texts.some(text => (PANEL_HINTS as readonly string[]).includes(text))) return nav
  }
  return null
}

/** 确保样式表在文档里（只插一次，内容变了就更新）。 */
function ensureStyle(doc: Document): void {
  let tag = doc.querySelector(`style[${NAV_FOLD_STYLE_ATTR}]`) as HTMLStyleElement | null
  if (tag === null) {
    tag = doc.createElement('style')
    tag.setAttribute(NAV_FOLD_STYLE_ATTR, '')
    doc.head.appendChild(tag)
  }
  if (tag.textContent !== NAV_FOLD_CSS) tag.textContent = NAV_FOLD_CSS
}

/**
 * 图标模式：把每个条目的**文字**藏掉，只留图标（并补 `title` 让悬停能看名字）。
 *
 * 为什么用行内样式而不是只靠 CSS：宿主那几颗按钮的文字都包在 `span.panelTitle` 里，
 * 但「更多」那颗的 span 同时带宿主自己的字号/宽度样式，纯属性选择器在一部分宿主版本上
 * 会被盖掉（2026-10-28 真机：前两颗藏掉了，"更多"还在）。所以逐个元素判定：
 *   · 里面含 `<svg>` 的 span = 图标，保留；
 *   · 其余 span = 文字，`display:none`。
 * 判定依据是**结构**（有没有 svg），不是类名，宿主改样式也不受影响。
 */
function applyTitles(nav: HTMLElement, on: boolean): void {
  for (const button of [...nav.querySelectorAll(':scope > button')] as HTMLElement[]) {
    if (on) {
      const label = (button.getAttribute('aria-label') ?? '').trim()
      if (label !== '' && button.getAttribute(NAV_FOLD_TITLE_ATTR) !== label) {
        button.setAttribute('title', label)
        button.setAttribute(NAV_FOLD_TITLE_ATTR, label)
      }
      // 递归找文字 span：有的宿主版本把标签再包一层（「更多」那颗就被包过），
      // 只处理直接子节点会漏掉它。判据仍是"里面有没有 svg"。
      for (const span of [...button.querySelectorAll('span')] as HTMLElement[]) {
        if (span.querySelector('svg') !== null) continue
        span.style.display = 'none'
      }
      continue
    }
    if (button.hasAttribute(NAV_FOLD_TITLE_ATTR)) {
      button.removeAttribute('title')
      button.removeAttribute(NAV_FOLD_TITLE_ATTR)
    }
    for (const span of [...button.querySelectorAll('span')] as HTMLElement[]) {
      if (span.style.display === 'none') span.style.display = ''
    }
  }
}

/** 造/更新那条「全局面板」折叠条。 */
function ensureHeader(doc: Document, nav: HTMLElement, state: NavFoldState, onToggle: (next: boolean) => void): void {
  const want = state.mode === 'bar'
  let head = doc.querySelector(`button[${NAV_FOLD_HEAD_ATTR}]`) as HTMLButtonElement | null
  if (!want) {
    head?.remove()
    return
  }
  if (head === null) {
    head = doc.createElement('button')
    head.type = 'button'
    head.setAttribute(NAV_FOLD_HEAD_ATTR, '')
    nav.parentElement?.insertBefore(head, nav)
  }
  const open = !state.collapsed
  head.setAttribute('aria-expanded', open ? 'true' : 'false')
  head.setAttribute('title', open ? '收起全局面板' : '展开全局面板')
  head.textContent = ''
  const label = doc.createElement('span')
  label.textContent = NAV_FOLD_HEADER_TEXT
  const chevron = doc.createElement('span')
  chevron.setAttribute('data-ux-nav-fold-chevron', '')
  chevron.setAttribute('aria-hidden', 'true')
  chevron.textContent = open ? '▴' : '▾'
  head.append(label, chevron)
  head.onclick = () => { onToggle(!state.collapsed) }
}

/**
 * 把当前状态贴到 DOM 上（幂等）。
 *
 * @param doc - 文档。
 * @param state - 形态与收起状态。
 * @param onToggle - 点折叠条时回调（参数是**下一状态**的 collapsed）。
 * @returns 是否真的找到并处理了宿主那一组（找不到 = false，界面可以据此提示"没找到"）。
 */
export function applyNavFold(doc: Document, state: NavFoldState, onToggle: (next: boolean) => void): boolean {
  ensureStyle(doc)
  const nav = findPanelNav(doc)
  if (nav === null) return false
  const attr = navFoldAttrOf(state)
  if (attr === null) nav.removeAttribute(NAV_FOLD_ATTR)
  else if (nav.getAttribute(NAV_FOLD_ATTR) !== attr) nav.setAttribute(NAV_FOLD_ATTR, attr)
  applyTitles(nav, state.mode === 'icons')
  ensureHeader(doc, nav, state, onToggle)
  return true
}
