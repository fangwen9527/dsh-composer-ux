/**
 * 侧边栏**底部区**的折叠（0.29.0）。
 *
 * ## 用户要什么
 *
 * 2026-10-29（截图圈住左下角「今日消耗金额」那张卡 + 下面那行账号）：
 * 「这个位置的这些按钮也让它能收缩起来，兼容所有在这个部位的按钮」。
 * 追问两轮定下：**整个底部区一起收**（插件卡片 + 官方账号/设置行），形态是**一行细条**、
 * 点一下展开 —— 与上面「全局面板」同一种观感（0.27.0 那一套）。
 *
 * ## 为什么"整块藏"反而是最兼容的做法
 *
 * 这个位置是**插槽拼出来的**：宿主自己在 `sidebar.footer.action` 与 `sidebar.settings`
 * 两个槽里渲染内容，任何插件都能往里加东西（例如 `@kenz1117/dsh-ui-usage-billing` 的
 * 用量卡片就走前一个槽）。这些内容的结构、类名、数量**都不可预知**，所以：
 *
 *   · 我们**不碰任何一个子节点**（不标属性、不改样式、不改文字）；
 *   · 只在外层容器上挂一个属性，由 CSS 把整块收起来 —— 展开时一切原样，
 *     插件自己的按钮、卡片、弹层、事件监听全都没被动过。
 *
 * 换句话说：折叠的粒度是"容器"，不是"按钮"。这比逐个按钮去识别安全得多，
 * 也是"兼容所有在这个部位的按钮"最省事的实现。
 *
 * ## 怎么找到这个容器（不用哈希类名）
 *
 * 宿主的结构（`dsh-client-ui-sidebar` 的 SidebarRoot）：
 *
 * ```jsx
 * <aside>                       // 根
 *   …品牌/新会话…
 *   <nav aria-label={t('panels.label')}>…</nav>
 *   <div class="regionArea">{renderSlot('sidebar.workspaces', …)}</div>
 *   <div class="footArea">                                     // ← 要收的就是它
 *     <div class="footerActions">{renderSlot('sidebar.footer.action', { wide })}</div>
 *     <div class="settingsArea">{renderSlot('sidebar.settings', { wide })}</div>
 *   </div>
 * </aside>
 * ```
 *
 * 所以：**`nav` 的父节点，就是侧边栏根**；根的**最后一个元素子节点**就是 `footArea`。
 * 这比"按类名找"稳（类名是 CSS Modules 哈希），也比"按 aria-label 找账号菜单"稳
 * （那个标签是 i18n 文案，会随语言变）。找不到 `nav` 时退一步：从账号菜单按钮往上退两层
 * （`footArea > settingsArea > 账号按钮`），只求不崩、不误收整只侧边栏。
 */

import { findPanelNav } from './sidebar-nav.ts'

/** 折叠状态贴在容器上的属性名。 */
export const FOOTER_FOLD_ATTR = 'data-ux-footer-fold'
/** 那条「账号与用量」细条的标记属性。 */
export const FOOTER_HEAD_ATTR = 'data-ux-footer-fold-head'
/** 样式表标记。 */
export const FOOTER_FOLD_STYLE_ATTR = 'data-ux-footer-fold-style'
/** 展开态下"贴在账号行右端"的标记属性（只影响我们这颗按钮的定位）。 */
export const FOOTER_HEAD_INLINE_ATTR = 'data-ux-footer-inline'
/** 细条上的文字。 */
export const FOOTER_HEAD_TEXT = '账号与其他'
/** 账号按钮的无障碍名（两条 i18n 文案；只用来兜底找容器）。 */
const ACCOUNT_LABELS = ['账号菜单', 'Account menu', '账户菜单'] as const

/** 折叠状态（现在只有收起/展开；形态固定成一条细条）。 */
export interface FooterFoldState {
  readonly collapsed: boolean
}

/**
 * 折叠样式。
 *
 * 只有一条真正干活的规则：容器整个不显示。**不写任何 `> button` 之类的子选择器** ——
 * 里面的东西属于宿主和别的插件，我们一个都不碰。
 */
export const FOOTER_FOLD_CSS = `
[${FOOTER_FOLD_ATTR}='folded'] { display: none !important; }
[${FOOTER_HEAD_ATTR}] {
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
[${FOOTER_HEAD_ATTR}]:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-secondary); }
/* 展开态：贴在账号那一行的右端，不占布局高度（绝对定位在账号块里）。 */
[${FOOTER_HEAD_ATTR}][${FOOTER_HEAD_INLINE_ATTR}] {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: auto;
  max-width: 55%;
  padding: 2px 6px;
  z-index: 1;
}
[${FOOTER_HEAD_ATTR}]:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
[${FOOTER_HEAD_ATTR}] > span[data-ux-footer-fold-chevron] { margin-left: auto; opacity: .7; }
`

/**
 * 找到侧边栏底部那个容器。
 *
 * @param doc - 文档。
 * @returns 容器；找不到返回 null（此时整个功能静默不介入）。
 */
export function findSidebarFooter(doc: Document): HTMLElement | null {
  const nav = findPanelNav(doc)
  const root = nav?.parentElement ?? null
  if (root !== null) {
    const last = root.lastElementChild as HTMLElement | null
    // 最后一个子节点必须不是 nav 自己，而且里面确实有按钮（账号行 / 插件卡片），
    // 才算"底部区" —— 免得在别的宿主布局上误收一个空 div。
    if (last !== null && last !== nav && last.querySelector('button') !== null) return last
  }
  // 兜底（正常不会走到：宿主只要有一格面板就会渲染 nav）。
  //
  // 没有 nav 可参照时，用账号菜单按钮往上退两层：宿主的结构是
  // `footArea > settingsArea > …账号按钮…`，所以"上两层"就是 footArea。
  // 这条路径**只求不崩**，不追求和主路径一样精确 —— 真跑不到主路径时，宁可少收一点，
  // 也不要把整个侧边栏收掉。
  for (const label of ACCOUNT_LABELS) {
    const account = doc.querySelector(`button[aria-label="${label}"]`)
    if (account === null) continue
    const up1 = account.parentElement
    const up2 = up1?.parentElement ?? null
    const candidate = up2 ?? up1
    if (candidate !== null && candidate !== doc.body && candidate.querySelector('button') !== null) return candidate
  }
  return null
}

/** 确保样式表在文档里（只插一次，内容变了就更新）。 */
function ensureStyle(doc: Document): void {
  let tag = doc.querySelector(`style[${FOOTER_FOLD_STYLE_ATTR}]`) as HTMLStyleElement | null
  if (tag === null) {
    tag = doc.createElement('style')
    tag.setAttribute(FOOTER_FOLD_STYLE_ATTR, '')
    doc.head.appendChild(tag)
  }
  if (tag.textContent !== FOOTER_FOLD_CSS) tag.textContent = FOOTER_FOLD_CSS
}

/** 造/更新那条「账号与用量」细条（放在底部容器前面）。 */
function ensureHeader(
  doc: Document,
  footer: HTMLElement,
  state: FooterFoldState,
  onToggle: (next: boolean) => void,
): void {
  let head = doc.querySelector(`button[${FOOTER_HEAD_ATTR}]`) as HTMLButtonElement | null
  if (head === null) {
    head = doc.createElement('button')
    head.type = 'button'
    head.setAttribute(FOOTER_HEAD_ATTR, '')
  }

  // 展开时贴在"账号那一块"的右端（不占布局高度）；收起时是底部容器前面那一整条。
  // 账号块 = 底部容器的最后一个子节点（宿主结构：footerActions + settingsArea）。
  const accountArea = footer.lastElementChild as HTMLElement | null
  const inline = !state.collapsed && accountArea !== null
  const parent = inline ? accountArea : footer.parentElement
  if (parent !== null && head.parentElement !== parent) {
    // 收起态要保持在底部容器**前面**（原来那一整条的位置）；展开态塞进账号块里。
    if (inline) parent.appendChild(head)
    else parent.insertBefore(head, footer)
  }
  if (inline && accountArea !== null) {
    // 绝对定位需要一个已定位的包含块；只加 position，其余样式不动。
    if (accountArea.style.position !== 'relative') accountArea.style.position = 'relative'
    if (!head.hasAttribute(FOOTER_HEAD_INLINE_ATTR)) head.setAttribute(FOOTER_HEAD_INLINE_ATTR, '')
  } else if (head.hasAttribute(FOOTER_HEAD_INLINE_ATTR)) {
    head.removeAttribute(FOOTER_HEAD_INLINE_ATTR)
  }
  const open = !state.collapsed
  head.setAttribute('aria-expanded', open ? 'true' : 'false')
  head.setAttribute('title', open ? '收起账号与其他' : '展开账号与其他')
  head.textContent = ''
  const label = doc.createElement('span')
  label.textContent = FOOTER_HEAD_TEXT
  const chevron = doc.createElement('span')
  chevron.setAttribute('data-ux-footer-fold-chevron', '')
  chevron.setAttribute('aria-hidden', 'true')
  chevron.textContent = open ? '▴' : '▾'
  head.append(label, chevron)
  head.onclick = () => { onToggle(!state.collapsed) }
}

/**
 * 把状态贴到 DOM 上（幂等）。
 *
 * @param doc - 文档。
 * @param state - 收起 / 展开。
 * @param onToggle - 点细条时回调（参数是**下一状态**的 collapsed）。
 * @returns 是否真的找到并处理了底部区（找不到 = false）。
 */
export function applyFooterFold(doc: Document, state: FooterFoldState, onToggle: (next: boolean) => void): boolean {
  ensureStyle(doc)
  const footer = findSidebarFooter(doc)
  if (footer === null) return false
  if (state.collapsed) {
    if (footer.getAttribute(FOOTER_FOLD_ATTR) !== 'folded') footer.setAttribute(FOOTER_FOLD_ATTR, 'folded')
  } else if (footer.hasAttribute(FOOTER_FOLD_ATTR)) {
    footer.removeAttribute(FOOTER_FOLD_ATTR)
  }
  ensureHeader(doc, footer, state, onToggle)
  return true
}
