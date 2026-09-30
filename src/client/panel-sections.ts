/**
 * 「快捷指令」面板的两半规则（0.13.1）。
 *
 * 面板中部现在二选一：「优化提示词」半（结果框）或「快捷指令」半（分类 + 条目列表）。
 * 抽成纯函数是因为**规则本身是行为契约**，而它在浏览器里很难逐例复现：
 *
 *  - 点中间那个切换按钮 = 换另一半（不是"只展开不收起"）；
 *  - **默认**展开快捷指令（用户 2026-09-30 选的 A：打开面板先看到条目）；
 *  - 一旦有结果框（刚开跑 / 跑完 / 失败 / 取消都算）就**自动切到优化那半** ——
 *    否则点了 ✨ 之后结果被自己藏在收起的一半里，看起来像"没反应"；
 *  - 自动切换只在"从无到有"那一刻发生：用户手动切回快捷指令时不该被抢回去。
 *
 * 最后一条靠调用方的依赖数组实现（`dockPresent` 变化才触发），这里只表达"该显示哪一半"。
 */

/** 面板中部显示哪一半。 */
export type PanelSection = 'quick' | 'optimize'

/** 默认展开的那一半（用户选的 A）。 */
export const DEFAULT_PANEL_SECTION: PanelSection = 'quick'

/** 点切换按钮：换另一半。 */
export function toggleSection(current: PanelSection): PanelSection {
  return current === 'quick' ? 'optimize' : 'quick'
}

/**
 * 结果框的有无决定该显示哪一半。
 *
 * @param dockPresent - 当前有没有结果框。
 * @param current - 用户当前选的那一半。
 * @returns 有结果框 ⇒ `'optimize'`；没有 ⇒ 保持用户的选择（**不自动切回** ——
 *          用户可能就是想一边看条目一边等结果；关掉结果框时由组件的 close 回调切回快捷指令）。
 */
export function sectionForDock(dockPresent: boolean, current: PanelSection): PanelSection {
  return dockPresent ? 'optimize' : current
}
