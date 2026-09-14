/**
 * 内联样式工具：只使用 DSH Web 的 --dsw-* 设计令牌，深浅主题自适应。
 */
import type { CSSProperties } from 'react'

/** 页面卡片。 */
export const card: CSSProperties = {
  background: 'var(--dsw-alias-bg-layer-2)',
  border: '0.5px solid var(--dsw-alias-border-l2)',
  borderRadius: 12,
  padding: '14px 16px',
  marginBottom: 12,
}

/** 卡片标题。 */
export const cardTitle: CSSProperties = {
  color: 'var(--dsw-alias-label-primary)',
  fontSize: 14,
  fontWeight: 600,
  margin: '0 0 4px',
}

/** 说明文字。 */
export const description: CSSProperties = {
  color: 'var(--dsw-alias-label-tertiary)',
  fontSize: 12,
  lineHeight: 1.6,
  margin: '0 0 12px',
}

/** 设置行。 */
export const row: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  minHeight: 40,
  padding: '7px 0',
  borderTop: '0.5px solid var(--dsw-alias-border-l2)',
}

/** 行内标签区。 */
export const rowText: CSSProperties = {
  minWidth: 0,
  flex: 1,
}

/** 行标题。 */
export const rowTitle: CSSProperties = {
  color: 'var(--dsw-alias-label-primary)',
  fontSize: 13,
  lineHeight: 1.4,
}

/** 行说明。 */
export const rowDesc: CSSProperties = {
  color: 'var(--dsw-alias-label-tertiary)',
  fontSize: 11,
  lineHeight: 1.4,
  marginTop: 2,
}

/** 键位显示胶囊。 */
export const kbd: CSSProperties = {
  color: 'var(--dsw-alias-label-primary)',
  background: 'var(--dsw-alias-bg-layer-1)',
  border: '0.5px solid var(--dsw-alias-border-l2)',
  borderRadius: 6,
  padding: '3px 8px',
  fontSize: 12,
  fontFamily: 'var(--dsw-font-family)',
  whiteSpace: 'nowrap',
}

/** 预设/动作小按钮。 */
export const pill: CSSProperties = {
  background: 'var(--dsw-alias-interactive-bg-hover)',
  color: 'var(--dsw-alias-label-secondary)',
  border: '0.5px solid var(--dsw-alias-border-l2)',
  borderRadius: 999,
  padding: '4px 10px',
  fontSize: 12,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

/** 选中态按钮。 */
export const pillActive: CSSProperties = {
  ...pill,
  color: 'var(--dsw-alias-button-primary-fill)',
  borderColor: 'var(--dsw-alias-button-primary-fill)',
}

/** 单行文本输入（跟随主题令牌）。 */
export const textInput: CSSProperties = {
  background: 'var(--dsw-alias-bg-layer-1)',
  color: 'var(--dsw-alias-label-primary)',
  border: '0.5px solid var(--dsw-alias-border-l2)',
  borderRadius: 8,
  padding: '6px 9px',
  fontSize: 12,
  lineHeight: 1.4,
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  flex: 1,
}

/** 提示/错误文字。 */
export const hintError: CSSProperties = {
  color: 'var(--dsw-alias-state-error-primary)',
  fontSize: 12,
  lineHeight: 1.5,
  margin: '6px 0 0',
}

/** 提示文字（中性）。 */
export const hintInfo: CSSProperties = {
  color: 'var(--dsw-alias-label-secondary)',
  fontSize: 12,
  lineHeight: 1.5,
  margin: '6px 0 0',
}

/** 菜单（与图片一致的深色圆角菜单）；背景取自官方菜单令牌。 */
export const menu: CSSProperties = {
  position: 'fixed',
  zIndex: 9999,
  minWidth: 200,
  background: 'var(--dsw-specific-menu)',
  border: '0.5px solid var(--dsw-alias-border-l1)',
  borderRadius: 10,
  boxShadow: 'var(--dsw-elevation-prominent)',
  padding: 5,
  pointerEvents: 'auto',
  userSelect: 'none',
}

/** 菜单项。 */
export const menuItem: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 24,
  padding: '6px 10px',
  borderRadius: 6,
  fontSize: 13,
  color: 'var(--dsw-alias-label-primary)',
  cursor: 'pointer',
  background: 'transparent',
  border: 'none',
  width: '100%',
  textAlign: 'left',
}

export const menuItemDim: CSSProperties = {
  ...menuItem,
  color: 'var(--dsw-alias-label-dimmed)',
  cursor: 'default',
}

/** 菜单项快捷键。 */
export const menuShortcut: CSSProperties = {
  color: 'var(--dsw-alias-label-tertiary)',
  fontSize: 12,
  fontFamily: 'var(--dsw-font-family)',
}

/** 菜单分隔线。 */
export const menuSeparator: CSSProperties = {
  height: 0,
  borderTop: '0.5px solid var(--dsw-alias-border-l2)',
  margin: '4px 8px',
}

/** 菜单底部提示。 */
export const menuNote: CSSProperties = {
  color: 'var(--dsw-alias-state-warn-label)',
  fontSize: 11,
  lineHeight: 1.4,
  padding: '4px 10px 2px',
}

// ── 快捷指令：输入卡片里的入口按钮（形状对齐官方「展开」胶囊） ─────────────

/** 入口按钮（静止态）。 */
export const quickButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  height: 26,
  padding: '0 10px',
  borderRadius: 999,
  border: '0.5px solid var(--dsw-alias-border-l2)',
  background: 'transparent',
  color: 'var(--dsw-alias-label-secondary)',
  fontSize: 12,
  lineHeight: 1,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flex: '0 0 auto',
}

/** 入口按钮（面板已展开）。 */
export const quickButtonActive: CSSProperties = {
  ...quickButton,
  color: 'var(--dsw-alias-button-primary-fill)',
  borderColor: 'var(--dsw-alias-button-primary-fill)',
  background: 'var(--dsw-alias-interactive-bg-hover)',
}

/** 入口按钮里的图标。 */
export const quickButtonIcon: CSSProperties = {
  flex: '0 0 auto',
}

// ── 快捷指令：展开面板 ─────────────────────────────────────────────────────

/** 面板容器（fixed 定位，锚点在入口按钮上方）。 */
export const quickPanel: CSSProperties = {
  position: 'fixed',
  zIndex: 9999,
  width: 420,
  maxWidth: 'calc(100vw - 24px)',
  maxHeight: 'min(60vh, 520px)',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--dsw-specific-menu)',
  border: '0.5px solid var(--dsw-alias-border-l1)',
  borderRadius: 12,
  boxShadow: 'var(--dsw-elevation-prominent)',
  pointerEvents: 'auto',
  overflow: 'hidden',
}

/** 面板顶部区（标题 + 档位 + 优化按钮）。 */
export const quickPanelHead: CSSProperties = {
  padding: '10px 12px 8px',
  borderBottom: '0.5px solid var(--dsw-alias-border-l2)',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

/** 面板标题行。 */
export const quickPanelTitleRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
}

/** 面板标题。 */
export const quickPanelTitle: CSSProperties = {
  color: 'var(--dsw-alias-label-primary)',
  fontSize: 13,
  fontWeight: 600,
}

/** 档位分段控件。 */
export const quickTierRow: CSSProperties = {
  display: 'inline-flex',
  gap: 2,
  padding: 2,
  borderRadius: 999,
  background: 'var(--dsw-alias-bg-layer-1)',
  border: '0.5px solid var(--dsw-alias-border-l2)',
}

/** 单个档位按钮。 */
export const quickTierButton: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--dsw-alias-label-tertiary)',
  fontSize: 11,
  lineHeight: 1,
  padding: '4px 8px',
  borderRadius: 999,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

/** 选中档位。 */
export const quickTierButtonActive: CSSProperties = {
  ...quickTierButton,
  background: 'var(--dsw-alias-button-primary-fill)',
  color: '#fff',
}

/** 主行动按钮（优化提示词）。 */
export const quickPrimaryButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  width: '100%',
  padding: '7px 12px',
  borderRadius: 8,
  border: '0.5px solid var(--dsw-alias-button-primary-fill)',
  background: 'var(--dsw-alias-button-primary-fill)',
  color: '#fff',
  fontSize: 12,
  cursor: 'pointer',
}

/** 主行动按钮（不可用）。 */
export const quickPrimaryButtonDisabled: CSSProperties = {
  ...quickPrimaryButton,
  opacity: 0.5,
  cursor: 'default',
}

/** 条目列表容器（可滚动）。 */
export const quickList: CSSProperties = {
  overflowY: 'auto',
  padding: '6px 6px 8px',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
}

/** 一条快捷指令。 */
export const quickItem: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '5px 8px',
  borderRadius: 7,
  cursor: 'pointer',
  background: 'transparent',
  border: 'none',
  width: '100%',
  textAlign: 'left',
}

/** 条目名称。 */
export const quickItemLabel: CSSProperties = {
  color: 'var(--dsw-alias-label-primary)',
  fontSize: 12,
  flex: '0 0 auto',
  whiteSpace: 'nowrap',
}

/** 条目内容预览。 */
export const quickItemPreview: CSSProperties = {
  color: 'var(--dsw-alias-label-tertiary)',
  fontSize: 11,
  flex: '1 1 auto',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

/** 「默认插入」勾选区。 */
export const quickAlwaysLabel: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  flex: '0 0 auto',
  color: 'var(--dsw-alias-label-tertiary)',
  fontSize: 11,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
}

/** 勾选框。 */
export const quickAlwaysBox: CSSProperties = {
  margin: 0,
  cursor: 'pointer',
}

/** 面板底部提示条。 */
export const quickPanelFoot: CSSProperties = {
  padding: '5px 12px 7px',
  borderTop: '0.5px solid var(--dsw-alias-border-l2)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
}

/** 面板里的提示文字。 */
export const quickNotice: CSSProperties = {
  color: 'var(--dsw-alias-state-warn-label)',
  fontSize: 11,
  lineHeight: 1.4,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

/** 面板里的次要说明。 */
export const quickFootHint: CSSProperties = {
  color: 'var(--dsw-alias-label-tertiary)',
  fontSize: 11,
  whiteSpace: 'nowrap',
  flex: '0 0 auto',
}

/** 空列表占位。 */
export const quickEmpty: CSSProperties = {
  color: 'var(--dsw-alias-label-tertiary)',
  fontSize: 12,
  lineHeight: 1.6,
  padding: '14px 10px',
  textAlign: 'center',
}
