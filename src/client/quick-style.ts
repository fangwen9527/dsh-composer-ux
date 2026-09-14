/**
 * 「快捷指令」入口按钮的样式表。
 *
 * 为什么不用行内样式（React `style`）：它表达不了 `:hover` / `[aria-expanded]`
 * 这类状态，而「和旁边的官方按钮长得一样」恰恰要靠 hover 与常态透明度。
 *
 * 参数逐项对齐社区插件 `dsh-composer-expand` 的 `.cpex-btn`（同一个槽位
 * `conversation.input.right`、同一个 order 邻位）—— 两个按钮并排，必须同高、
 * 同圆角、同内边距、同边框、同常态透明度，否则一眼就看得出是两家人做的。
 * 特别记一笔：边框**不用**主题令牌 `--dsw-alias-border-l2`（它更亮，会呈现成
 * 用户截图里那圈突兀的白线），而是和对方一样用中性半透明灰，明暗主题下都协调。
 */

/** 入口按钮的基础类名。 */
export const QUICK_BUTTON_CLASS = 'composer-ux-quick-button'

/** 与 .cpex-btn 逐项对齐。 */
const QUICK_BUTTON_CSS = `
.${QUICK_BUTTON_CLASS} {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  border: 1px solid rgba(127, 127, 137, .35);
  background: transparent;
  color: inherit;
  border-radius: 999px;
  padding: 0 9px;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  opacity: .75;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  transition: opacity .12s ease, background-color .12s ease;
}
.${QUICK_BUTTON_CLASS}:hover { opacity: 1; background: rgba(127, 127, 137, .12); }
.${QUICK_BUTTON_CLASS}[aria-expanded="true"] {
  opacity: 1;
  background: rgba(127, 127, 137, .18);
  border-color: rgba(127, 127, 137, .6);
}
.${QUICK_BUTTON_CLASS} svg { flex: 0 0 auto; }
`

/** 注入入口按钮样式表；返回卸载器（随插件 fiber 回收）。 */
export function installQuickButtonStyle(): () => void {
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-composer-ux-quick-button'
  tag.textContent = QUICK_BUTTON_CSS
  document.head.appendChild(tag)
  return () => { tag.remove() }
}
