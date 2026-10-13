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
 * ── 2026-10-10 修订（用户截图报的）──────────────────────────────────────────
 * 原规则有个副作用：**面板一打开就已经是"优化那半"** —— 因为上次的结果还在（"从无到有"
 * 在**重开面板**时也成立）。用户要的是「打开面板默认收着」，所以现在：
 *
 *  - 每次**打开**面板 ⇒ 回到 {@link PANEL_OPEN_SECTION}（快捷指令那半），
 *    哪怕上次有结果；**唯一的例外是"正在跑"** —— 那时他有进度/取消要看（见 {@link sectionOnPanelOpen}）；
 *  - 「从无到有」的自动切换只在**面板已经开着**的时候生效（调用方在打开那一刻把结果框的
 *    有无当成基线，不再算作"刚出结果"）。
 *
 * 最后一条靠调用方的 ref 实现，这里只表达"该显示哪一半"。
 */

/** 面板中部显示哪一半。 */
export type PanelSection = 'quick' | 'optimize'

/** 默认展开的那一半（用户选的 A）。 */
export const DEFAULT_PANEL_SECTION: PanelSection = 'quick'

/**
 * 面板每次打开落在哪一半（用户 2026-10-10 要的"默认收着"）。
 *
 * 只给"正在跑"留例外：那时你要看进度和「取消」，把它藏起来才是坏事；
 * "上次跑完的结果还摆着"不算例外 —— 那正是用户嫌它挡视野的那种情况。
 */
export const PANEL_OPEN_SECTION: PanelSection = DEFAULT_PANEL_SECTION

/** 「优化选项」那一组设置的折叠初值：收起（用户 2026-10-10 要的）。 */
export const OPTIONS_FOLD_DEFAULT_OPEN = false

/**
 * 面板打开时该显示哪一半。
 *
 * @param running - 打开这一刻结果框是不是正在跑（`phase === 'running'`）。
 * @returns 正在跑 ⇒ `'optimize'`（看得到进度与取消）；否则 ⇒ 默认那一半（快捷指令）。
 */
export function sectionOnPanelOpen(running: boolean): PanelSection {
  return running ? 'optimize' : PANEL_OPEN_SECTION
}

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
