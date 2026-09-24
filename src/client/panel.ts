/**
 * 设置面板增强：导航列滚动样式 + 面板尺寸调整手柄。
 *
 * 官方面板结构（ui-settings-general SettingsRoot）：
 *   .overlay（position:fixed; inset:0; **z-index:1000**）
 *     ├── .mask（position:absolute; inset:0）── 全屏遮罩
 *     └── [role="dialog"][aria-modal="true"]  ── .panel（position:relative; width:800; overflow:hidden）
 *           ├── <nav>  ── 标题 + navList（条目较多时溢出）
 *           └── <div>  ── header + .options（本身 overflow-y:auto）
 *
 * ⚠️ 层叠上下文陷阱（0.2.0 整段功能因此失效，务必记住）：
 * 本插件能挂浮层的位置只有 `shell.overlay`，而它被官方封在
 * `ui-layout` 的 `.overlayLayer { position:absolute; inset:0; z-index:20 }` 里 ——
 * `position` + `z-index` 使它**自成层叠上下文**，里面的元素再怎么把 z-index
 * 写成 9998 也**逃不出去**，永远排在设置弹窗（1000）下面，被全屏遮罩吃掉鼠标。
 * 所以：**凡是给设置弹窗做浮层，必须把手柄挂进面板内部**（`createPortal` 到
 * panel），而不是在 shell.overlay 里对准坐标画。
 */
import type { CSSProperties } from 'react'

/** 设置对话框选择器（面板为「带 nav 子元素的 aria-modal 对话框」，在应用
 * 里唯一：其它对话框（审批、模型编辑器等）不以 nav 为直接子元素）。 */
export const PANEL_SELECTOR = '[role="dialog"][aria-modal="true"]:has(> nav)'


/** 手柄层类名（由下方注入样式表定义）。 */
export const RESIZE_LAYER_CLASS = 'dsh-ux-resize-layer'
/** 四边描边（纯视觉，不吃指针）。 */
export const RESIZE_OUTLINE_CLASS = 'dsh-ux-resize-outline'
/** 可拖拽的边。 */
export const RESIZE_EDGE_CLASS = 'dsh-ux-resize-edge'
/** 可拖拽的右下角抓手。 */
export const RESIZE_GRIP_CLASS = 'dsh-ux-resize-grip'

/** 可拖拽的位置。 */
export type ResizeEdge = 'left' | 'right' | 'top' | 'bottom' | 'br'

/** 边的抓取带宽（可见描边是 1px，这 8px 是"好抓"的余量）。 */
const BAND = 8
/** 边条两端避让量，让圆角处不出现压线的直角。 */
const INSET = 14
/** 右下角抓手尺寸。 */
const GRIP = 26

/**
 * 一条手柄在**面板内部**的绝对定位盒。
 *
 * 刻意不使用视口坐标：手柄是面板的子元素（挂进面板内部），所以定位全部相对
 * 面板本身 —— 面板移动、滚动、改尺寸都会自动跟随，不需要任何重算或轮询。
 * @param edge - 边或右下角。
 * @returns 该手柄的 CSS 定位属性。
 */
export function handleBox(edge: ResizeEdge): CSSProperties {
  switch (edge) {
    case 'left': return { left: 0, top: INSET, bottom: INSET, width: BAND, cursor: 'ew-resize' }
    case 'right': return { right: 0, top: INSET, bottom: INSET, width: BAND, cursor: 'ew-resize' }
    case 'top': return { top: 0, left: INSET, right: INSET, height: BAND, cursor: 'ns-resize' }
    case 'bottom': return { bottom: 0, left: INSET, right: INSET, height: BAND, cursor: 'ns-resize' }
    case 'br': return { right: 8, bottom: 8, width: GRIP, height: GRIP, cursor: 'nwse-resize' }
  }
}

/** 四边描边层：贴着面板圆角画一圈 1px 细线（纯视觉，`pointer-events: none`）。 */
export const RESIZE_OUTLINE_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  // 跟随面板自身的圆角（官方 .panel 是 32px）——用 inherit 而不是写死数字，
  // 官方改圆角时这里自动跟上。
  borderRadius: 'inherit',
  border: '1px solid rgba(127, 127, 137, .28)',
  pointerEvents: 'none',
}

/**
 * 尺寸手柄样式。
 *
 * 手柄层挂在**设置面板内部**（见文件头的层叠上下文说明），所以这些规则里的
 * 定位一律相对面板；`pointer-events` 在层上关掉、只在具体手柄上打开，
 * 免得整层吃掉面板本身的点击。
 *
 * ⚠️ 0.6.0 删掉了这里另一半「导航列滚动」样式（原 PANEL_CSS +
 * `html.dsh-ux-panel-scroll` 门控）：DSH 0.1.7 的官方设置页已经给 `.navList`
 * 自带 `overflow-y: auto`，我们再注入一套就成了重复实现，故整项移除。
 */
const RESIZE_CSS = `
.${RESIZE_LAYER_CLASS} { position: absolute; inset: 0; pointer-events: none; }
.${RESIZE_EDGE_CLASS}, .${RESIZE_GRIP_CLASS} {
  position: absolute;
  pointer-events: auto;
  background: transparent;
  border-radius: 6px;
  transition: background-color .12s ease, color .12s ease;
  touch-action: none;
}
.${RESIZE_EDGE_CLASS}:hover { background: rgba(127, 127, 137, .22); }
.${RESIZE_EDGE_CLASS}[data-active="true"] { background: rgba(127, 127, 137, .3); }
.${RESIZE_GRIP_CLASS} {
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 3px;
  color: rgba(127, 127, 137, .55);
}
.${RESIZE_GRIP_CLASS}:hover { color: rgba(127, 127, 137, .95); background: rgba(127, 127, 137, .16); }
`

/** 注入尺寸手柄样式表；返回卸载器。 */
export function installPanelResizeStyle(): () => void {
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-composer-ux-panel'
  tag.textContent = RESIZE_CSS
  document.head.appendChild(tag)
  return () => {
    tag.remove()
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
