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

/**
 * 菜单（与图片一致的深色圆角菜单）；背景取自官方菜单令牌。
 *
 * ⚠️ **2026-09-25 修（0.1.7 兼容）**：DSH 把菜单面改成了「半透明 + 毛玻璃」——
 * 官方每一个绘制 `--dsw-specific-menu` 的浮层都**成对**补一层
 * `backdrop-filter: var(--dsw-menu-backdrop-filter)`（实测 `blur(40px) saturate(150%)`）。
 * 我们以前只抄了「半透明」那一半、漏了磨砂，于是浮层成了**一块没磨砂的玻璃**：
 * 背后正文直接透出来、字叠字看不清（用户 2026-09-25 截图报的就是这个）。
 *
 * 同批对齐官方的另两条：① 描边走 elevation 的发丝线（`border: 0` —— 否则实线边框
 * 会和 box-shadow 里那 0.5px 描边叠成两条）；② 圆角改用官方令牌。
 */
export const menu: CSSProperties = {
  position: 'fixed',
  // 官方浮层用 1100，这里**刻意保留 9999**：本插件的浮层挂在 `shell.overlay` 这个
  // 独立层叠上下文里，要和别的插件抢层，降下去只会被盖住（见 panel.ts 文件头）。
  zIndex: 9999,
  minWidth: 200,
  background: 'var(--dsw-specific-menu)',
  backdropFilter: 'var(--dsw-menu-backdrop-filter)',
  border: 0,
  borderRadius: 'var(--dsw-radius-lg)',
  boxShadow: 'var(--dsw-elevation-prominent)',
  '--dsw-elevation-stroke-color': 'var(--dsw-alias-border-l1)',
  padding: 5,
  pointerEvents: 'auto',
  userSelect: 'none',
} as CSSProperties

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

// ── 快捷指令：输入卡片里的入口按钮 ─────────────────────────────────────────
//
// 按钮样式**故意不放在这里**：它需要 hover 与展开态，行内样式表达不了，而且
// 要与旁边官方「展开」按钮（dsh-composer-expand 的 .cpex-btn）逐项对齐。
// 见 `quick-style.ts` 的注入样式表。

// ── 快捷指令：展开面板 ─────────────────────────────────────────────────────

/**
 * 面板容器（fixed 定位，锚点在入口按钮上方）。
 *
 * 材质与描边与上面 `menu` 完全同一套（半透明填充 + 官方伴侣模糊 + elevation 发丝线），
 * 两处必须一起改 —— 只改一处就会出现「一个浮层清楚、另一个还在透」。
 * 病因与实测依据写在 `menu` 的注释里，不重复。
 */
export const quickPanel: CSSProperties = {
  position: 'fixed',
  // 同 `menu`：刻意保留 9999，理由见那里。
  zIndex: 9999,
  width: 420,
  maxWidth: 'calc(100vw - 24px)',
  maxHeight: 'min(60vh, 520px)',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--dsw-specific-menu)',
  backdropFilter: 'var(--dsw-menu-backdrop-filter)',
  border: 0,
  borderRadius: 'var(--dsw-radius-lg)',
  boxShadow: 'var(--dsw-elevation-prominent)',
  '--dsw-elevation-stroke-color': 'var(--dsw-alias-border-l1)',
  pointerEvents: 'auto',
  overflow: 'hidden',
} as CSSProperties

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

/** 选中档位。
 *  前景必须用配对令牌 `label-primary-foreground`：`button-primary-fill` 取自
 *  `brand-primary`，浅色主题下是墨色/深色，**深色主题下它是白**——此时写死
 *  `#fff` 就是白底白字（0.2.0 真踩过）。官方 ui-primitives/Button 的成对写法
 *  就是 fill + label-primary-foreground。 */
export const quickTierButtonActive: CSSProperties = {
  ...quickTierButton,
  background: 'var(--dsw-alias-button-primary-fill)',
  color: 'var(--dsw-alias-label-primary-foreground)',
}

/** 主行动按钮（优化提示词）。同上：fill 与前景必须成对。 */
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
  color: 'var(--dsw-alias-label-primary-foreground)',
  fontSize: 12,
  cursor: 'pointer',
}

/** 主行动按钮（不可用）：与官方 .primary:disabled 一致用 0.4。 */
export const quickPrimaryButtonDisabled: CSSProperties = {
  ...quickPrimaryButton,
  opacity: 0.4,
  cursor: 'default',
}

/** 条目列表容器（可滚动）。 */
export const quickList: CSSProperties = {
  // `flex: 1 1 auto` + `minHeight: 0`：这一半被压时**自己滚**，而不是把内容顶出去。
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  padding: '6px 6px 8px',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
}

/** 一条快捷指令。
 *  注意：这一行里还有「默认插入」勾选框，所以按钮必须可被压缩
 *  （flex 1 1 auto + minWidth 0），否则长预览会把勾选框挤出面板
 *  （width:100% 会吃满整行，0.2.0 真踩过）。 */
export const quickItem: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '5px 8px',
  borderRadius: 7,
  cursor: 'pointer',
  background: 'transparent',
  border: 'none',
  flex: '1 1 auto',
  minWidth: 0,
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

// ── 快捷指令：分类（0.3.0 起的两级结构） ───────────────────────────────────

/**
 * 面板中部：**两半内容区共用的容器**（「优化提示词」与「快捷指令」二选一放进来）。
 *
 * 为什么要它：面板是 `maxHeight` 封顶的弹性列，两半如果都当普通块排下去，
 * 就会**互相抢高度** —— 结果框一长（条目多 + 成品多行）就把下面的列表挤没、
 * 再继续把**自己底部的按钮**顶出面板边界（`overflow: hidden` 直接裁掉）。
 * 用户 2026-09-30 报的「展开优化之后看不到 插入输入框 / 重新优化 / 复制」正是这个。
 * 现在两半互斥、各自内部滚（见 quickList / dockBody），谁都不会被裁。
 */
export const quickSectionBody: CSSProperties = {
  flex: '1 1 auto',
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

/** 两半之间的切换按钮（一整行，点它换另一半）。 */
export const quickSectionToggle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  width: '100%',
  padding: '6px 12px',
  border: 0,
  borderTop: '0.5px solid var(--dsw-alias-border-l2)',
  borderBottom: '0.5px solid var(--dsw-alias-border-l2)',
  background: 'transparent',
  color: 'var(--dsw-alias-label-secondary)',
  fontSize: 11.5,
  textAlign: 'left',
  cursor: 'pointer',
}

/** 切换按钮里那个箭头（用等宽字符占位，避免文字左右跳）。 */
export const quickSectionToggleArrow: CSSProperties = {
  width: 10,
  flex: '0 0 auto',
}

/** 分类标签行（分类两级里的第一级）。 */
export const quickCategoryRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  flexWrap: 'wrap',
}

/** 单个分类标签。 */
export const quickCategoryTab: CSSProperties = {
  border: '0.5px solid var(--dsw-alias-border-l2)',
  background: 'transparent',
  color: 'var(--dsw-alias-label-tertiary)',
  fontSize: 11,
  lineHeight: 1,
  padding: '4px 8px',
  borderRadius: 999,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  maxWidth: 160,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

/** 选中的分类标签。
 *  只改边框与文字色，**不用实色填充**：这样不需要填/前景成对令牌，
 *  也就不会重演 0.2.0 那次「深色主题白底白字」。 */
export const quickCategoryTabActive: CSSProperties = {
  ...quickCategoryTab,
  border: '0.5px solid var(--dsw-alias-brand-primary)',
  color: 'var(--dsw-alias-label-primary)',
  fontWeight: 600,
}

/** 「＋ 分类」小按钮。 */
export const quickCategoryAdd: CSSProperties = {
  ...quickCategoryTab,
  color: 'var(--dsw-alias-label-tertiary)',
  padding: '4px 7px',
  cursor: 'pointer',
}

// ── 优化结果框（0.12.0）────────────────────────────────────────────────────
//
// 放在面板头部与分类行之间：它是"这一轮优化"的现场，比清单更该先被看到。

/** 结果框外框。 */
export const dockBox: CSSProperties = {
  // 撑满中部容器（`minHeight: 0` 是关键：否则弹性子项按内容高度撑，又会被裁）。
  flex: '1 1 auto',
  minHeight: 0,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '8px 12px 8px',
  // 0.13.2：**不再画成一张独立卡片**（用户原话「提示词优化是悬浮的」）。
  // 去掉自己的背景与圆角边框，只留一条细分隔线 —— 它就是面板里的一段，而不是浮在上面的小窗。
  borderTop: '0.5px solid var(--dsw-alias-border-l2)',
}

/**
 * 结果框的**可滚内容区**（条目 / 丢弃记账 / 失败提示 / 成品输入框 / 记账行）。
 *
 * 为什么把它单独包一层：底部那排按钮（插入输入框 / 重新优化 / 复制）**必须永远看得见**。
 * 之前它们和内容在同一个流里，内容一长就被面板裁掉 —— 那一排反而最需要点得到。
 */
export const dockBody: CSSProperties = {
  flex: '1 1 auto',
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  overflowY: 'auto',
}

/** 底部按钮行：钉在结果框底部，不随内容滚动。 */
export const dockButtonsPinned: CSSProperties = {
  flex: '0 0 auto',
}

/** 结果框里的弱化按钮（0.13.2：丢弃）。 */
export const dockButtonGhost: CSSProperties = {
  border: 0,
  background: 'transparent',
  color: 'var(--dsw-alias-label-tertiary)',
  borderRadius: 999,
  padding: '3px 8px',
  fontSize: 11,
  lineHeight: 1.6,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

/** 二次确认中的丢弃按钮（红一点，明确这是破坏性动作）。 */
export const dockButtonWarn: CSSProperties = {
  ...dockButtonGhost,
  color: 'var(--dsw-alias-label-error, #d33)',
  border: '0.5px solid var(--dsw-alias-label-error, #d33)',
}

/** 结果框标题行（阶段 + 秒表 + 取消/关闭）。 */
export const dockHead: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
}

/** 阶段文案。 */
export const dockPhase: CSSProperties = {
  color: 'var(--dsw-alias-label-primary)',
  fontSize: 12,
  fontWeight: 600,
}

/** 次要说明（秒表 / 依据 / 记账），可换行。 */
export const dockMeta: CSSProperties = {
  color: 'var(--dsw-alias-label-tertiary)',
  fontSize: 11,
  lineHeight: 1.5,
  // 顶到右边：`marginLeft: auto` 让秒表贴着取消按钮。
  marginLeft: 'auto',
}

/** 逐条流水列表。 */
export const dockList: CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  maxHeight: '18vh',
  overflowY: 'auto',
}

/** 一条流水。 */
export const dockItemRow: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  fontSize: 12,
  lineHeight: 1.5,
}

/** 条目标签（改写 / 补全·要求 …）。 */
export const dockKind: CSSProperties = {
  color: 'var(--dsw-alias-brand-primary)',
  fontSize: 10,
  fontWeight: 600,
}

/** 条目正文。 */
export const dockItemText: CSSProperties = {
  color: 'var(--dsw-alias-label-primary)',
  wordBreak: 'break-word',
}

/** 丢弃记账行。 */
export const dockDropped: CSSProperties = {
  color: 'var(--dsw-alias-label-tertiary)',
  fontSize: 11,
  lineHeight: 1.5,
}

/** 失败提示。 */
export const dockError: CSSProperties = {
  color: 'var(--dsw-alias-label-error, #d33)',
  fontSize: 12,
  lineHeight: 1.5,
  wordBreak: 'break-word',
}

/** 成品编辑框。 */
export const dockEditor: CSSProperties = {
  width: '100%',
  minHeight: 88,
  maxHeight: '30vh',
  resize: 'vertical',
  boxSizing: 'border-box',
  padding: '6px 8px',
  borderRadius: 8,
  border: '0.5px solid var(--dsw-alias-border-l2)',
  background: 'var(--dsw-specific-menu)',
  color: 'var(--dsw-alias-label-primary)',
  fontSize: 12,
  lineHeight: 1.6,
  fontFamily: 'inherit',
}

/** 记账行。 */
export const dockSummaryLine: CSSProperties = {
  color: 'var(--dsw-alias-label-tertiary)',
  fontSize: 11,
  lineHeight: 1.5,
  wordBreak: 'break-word',
}

/** 按钮行。 */
export const dockButtons: CSSProperties = {
  display: 'flex',
  gap: 6,
  alignItems: 'center',
}

/** 次要按钮。 */
export const dockButton: CSSProperties = {
  border: '0.5px solid var(--dsw-alias-border-l2)',
  background: 'transparent',
  color: 'var(--dsw-alias-label-secondary)',
  borderRadius: 999,
  padding: '3px 10px',
  fontSize: 11,
  lineHeight: 1.6,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

/** 不可用按钮：压暗、去掉手型（"点不动"要一眼可见）。 */
export const dockButtonDisabled: CSSProperties = {
  ...dockButton,
  opacity: 0.45,
  cursor: 'default',
}

/**
 * 主按钮（插入输入框）。
 *
 * ⚠️ **填色与前景必须用配对令牌**（与上面 `quickPrimaryButton` 同一条纪律）：
 * `background` 用 `button-primary-fill`（取自 `brand-primary`，**深色主题下是近白**），
 * 前景就必须用 `label-primary-foreground`（深色主题下是墨色）。
 *
 * 0.12.0 截图验收时抓到的真 bug：这里原本写的是
 * `background: var(--dsw-alias-brand-primary)` + `color: var(--dsw-alias-label-inverse, #fff)`，
 * 而 **`--dsw-alias-label-inverse` 这个令牌根本不存在**（官方叫 `label-primary-inverted`）⇒ 兜底成 `#fff`，
 * 于是深色主题下就是**白底白字**：按钮只剩一个白色胶囊，"插入输入框"这几个字看不见。
 * 浅色主题下 `brand-primary` 是墨色、白字正好可读，所以这个 bug **只在深色主题出现** ——
 * 只跑测试与类型检查都发现不了，必须真看一眼界面。
 */
export const dockButtonPrimary: CSSProperties = {
  ...dockButton,
  background: 'var(--dsw-alias-button-primary-fill)',
  borderColor: 'var(--dsw-alias-button-primary-fill)',
  color: 'var(--dsw-alias-label-primary-foreground)',
  fontWeight: 600,
}

// ── 0.14.0：优化选项卡片（照 dsh-prompt-optimizer 的卡片搬进面板）─────────────────

/** 卡片外框：面板里的一段（不画独立浮窗感，与结果框同一做法）。 */
export const optCard: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '8px 12px 10px',
  borderBottom: '0.5px solid var(--dsw-alias-border-l2)',
}

/** 卡片标题行。 */
export const optCardTitle: CSSProperties = {
  color: 'var(--dsw-alias-label-primary)',
  fontSize: 12,
  fontWeight: 600,
}

/** 一行：左边标签、右边控件。 */
export const optRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

/** 行标签（固定宽度，让右边控件对齐）。 */
export const optLabel: CSSProperties = {
  color: 'var(--dsw-alias-label-secondary)',
  fontSize: 11.5,
  flex: '0 0 52px',
}

/** 分段控件容器。 */
export const optSegmented: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  flex: '1 1 auto',
  minWidth: 0,
}

/** 分段按钮。 */
export const optSegButton: CSSProperties = {
  flex: '1 1 auto',
  minWidth: 0,
  padding: '3px 6px',
  border: '0.5px solid var(--dsw-alias-border-l2)',
  background: 'transparent',
  color: 'var(--dsw-alias-label-secondary)',
  borderRadius: 6,
  fontSize: 11,
  lineHeight: 1.6,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

/** 选中的分段按钮。 */
export const optSegButtonActive: CSSProperties = {
  ...optSegButton,
  background: 'var(--dsw-alias-bg-layer-1)',
  color: 'var(--dsw-alias-label-primary)',
  borderColor: 'var(--dsw-alias-label-primary)',
  fontWeight: 600,
}

/** 单行文本输入（模型 id）。 */
export const optInput: CSSProperties = {
  flex: '1 1 auto',
  minWidth: 0,
  boxSizing: 'border-box',
  padding: '3px 8px',
  border: '0.5px solid var(--dsw-alias-border-l2)',
  borderRadius: 6,
  background: 'transparent',
  color: 'var(--dsw-alias-label-primary)',
  fontSize: 11.5,
}

/** 滑条（上下文回合数）。 */
export const optSlider: CSSProperties = {
  flex: '1 1 auto',
  minWidth: 0,
  accentColor: 'var(--dsw-alias-label-primary)',
}

/** 数字显示（滑条右边）。 */
export const optNumber: CSSProperties = {
  color: 'var(--dsw-alias-label-tertiary)',
  fontSize: 11,
  flex: '0 0 auto',
  minWidth: 34,
  textAlign: 'right',
}

/** 详情里的提示词输入框。 */
export const optPromptBox: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 96,
  maxHeight: '22vh',
  resize: 'vertical',
  padding: '6px 8px',
  border: '0.5px solid var(--dsw-alias-border-l2)',
  borderRadius: 8,
  background: 'transparent',
  color: 'var(--dsw-alias-label-primary)',
  fontSize: 11.5,
  lineHeight: 1.6,
  fontFamily: 'inherit',
}

/** 卡片的说明行（弱化，用来说清这个开关到底做什么）。 */
export const optHint: CSSProperties = {
  color: 'var(--dsw-alias-label-tertiary)',
  fontSize: 10.5,
  lineHeight: 1.5,
}
