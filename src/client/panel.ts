/**
 * 设置面板增强：导航列滚动样式 + 面板定位/尺寸工具。
 *
 * 官方面板结构（ui-settings-general SettingsPanel）：
 *   [role="dialog"][aria-modal="true"]  ── .panel（width:800, overflow:hidden）
 *     ├── <nav>  ── 标题 + navList（条目较多时溢出且不可滚动）
 *     └── <div>  ── header + .options（本身 overflow-y:auto）
 *
 * 采用稳定结构选择器（role/aria + 直接子元素 nav），CSS Modules 哈希类名
 * 不可依赖。滚动样式通过 <html> 上的类门控，随设置开关即时切换。
 */

/** 设置对话框选择器（面板为「带 nav 子元素的 aria-modal 对话框」，在应用
 * 里唯一：其它对话框（审批、模型编辑器等）不以 nav 为直接子元素）。 */
export const PANEL_SELECTOR = '[role="dialog"][aria-modal="true"]:has(> nav)'

/** 注入的滚动/滚动条样式（由 html.dsh-ux-panel-scroll 门控）。 */
const PANEL_CSS = `
html.dsh-ux-panel-scroll [role="dialog"][aria-modal="true"]:has(> nav) { min-height: 320px; }
html.dsh-ux-panel-scroll [role="dialog"][aria-modal="true"]:has(> nav) > nav {
  min-height: 0;
}
html.dsh-ux-panel-scroll [role="dialog"][aria-modal="true"]:has(> nav) > nav > div:last-child {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}
html.dsh-ux-panel-scroll [role="dialog"][aria-modal="true"]:has(> nav) > nav > div:last-child::-webkit-scrollbar {
  width: 8px;
}
html.dsh-ux-panel-scroll [role="dialog"][aria-modal="true"]:has(> nav) > nav > div:last-child::-webkit-scrollbar-thumb {
  background: var(--dsh-scrollbar-thumb, var(--dsw-alias-scrollbar-bg-l2));
  border-radius: 8px;
}
html.dsh-ux-panel-scroll [role="dialog"][aria-modal="true"]:has(> nav) > nav > div:last-child::-webkit-scrollbar-thumb:hover {
  background: var(--dsh-scrollbar-thumb-hover, var(--dsw-alias-scrollbar-hover-l2));
}
`

/** 注入样式表并同步滚动开关到 <html> 类（随设置变化即时更新）；返回卸载器。 */
export function installPanelStyle(
  settings: () => boolean,
  subscribe: (listener: () => void) => () => void,
): () => void {
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-composer-ux-panel'
  tag.textContent = PANEL_CSS
  document.head.appendChild(tag)
  const applyClass = (): void => {
    document.documentElement.classList.toggle('dsh-ux-panel-scroll', settings())
  }
  applyClass()
  const unsubscribe = subscribe(applyClass)
  return () => {
    unsubscribe()
    tag.remove()
    document.documentElement.classList.remove('dsh-ux-panel-scroll')
  }
}

/** 查询当前打开的设置对话框。 */
export function findSettingsPanel(): HTMLElement | null {
  return document.querySelector<HTMLElement>(PANEL_SELECTOR)
}

/** 尺寸范围钳制（与 host schema 一致）。 */
export function clampPanelWidth(width: number): number {
  return Math.max(560, Math.min(width, Math.max(800, window.innerWidth - 48)))
}

export function clampPanelHeight(height: number): number {
  return Math.max(320, Math.min(height, Math.max(400, window.innerHeight - 48)))
}

/** 持久化尺寸（写入设置；失败静默——下次打开回退默认）。 */
export function persistPanelSize(
  width: number,
  height: number,
  setField: (field: string, value: boolean | number) => void,
): void {
  setField('panelWidth', clampPanelWidth(width))
  setField('panelHeight', clampPanelHeight(height))
}
