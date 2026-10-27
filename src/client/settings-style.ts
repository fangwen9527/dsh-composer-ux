/**
 * 设置页折叠卡样式。
 *
 * 视觉语言照社区里那套「用量计费」设置页（分组卡 + 卡内设置行 + 右侧分段控件）来，
 * 但令牌只用 DSH 自己的 `--dsw-*`：插件必须跟着宿主的深浅主题一起变，自带色板迟早
 * 会在某个主题下变成白底白字。几何上就三条：1px 描边 + 12px 圆角 + 第三层底色，
 * 组与组之间 12px，卡内边距 14–16px、行距 10–12px（比"营销页"松一点，但不再往下撑）。
 *
 * 类名统一 `dsh-ux-` 前缀，避免与宿主 CSS Modules 冲突。**不要改已有类名**：
 * test/client-registration.mjs 同时钉着源码与界面产物里的这些名字。
 */

const CARD_CSS = `
/* ── 设置页根 ─────────────────────────────────────────────────────────── */
/* 数字一律等宽：尺寸 / 单价 / 天数都在卡片里，跳动时不能让小数点来回挪。 */
.dsh-ux-settings { font-variant-numeric: tabular-nums; }

/* ── 卡片外壳 ─────────────────────────────────────────────────────────── */
.dsh-ux-card {
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-3);
  border-radius: 12px;
  margin-bottom: 12px;
  transition: border-color .16s, background-color .16s;
}
.dsh-ux-card:hover { border-color: var(--dsw-alias-label-dimmed); }
/* 展开时只加深描边、**不换底色**：卡里的分段控件选中项画在 layer-2 上，
   卡片本身也掉到 layer-2 的话，选中项就没底了（换皮最容易漏的一处）。 */
.dsh-ux-cardOpen { border-color: var(--dsw-alias-label-dimmed); }
/* 未启用：描边改虚线，一眼看出"这一栏现在不生效"。 */
.dsh-ux-cardOff { border-style: dashed; }
.dsh-ux-cardOff .dsh-ux-cardBody { opacity: .62; }
/* 顶部这张卡在 DOM 上还包着「微信通知 / 目录选择 / 自检 / 自启动」与总开关那一行
   （那几块的先后顺序被 test/client-registration.mjs 钉着，这一轮不动结构）。
   所以它自己**不画卡片**：画了就是"卡片套卡片"，内外两层描边会贴在一起变成双线。
   它退化成一块页头 —— 标题 + 一行描述 + 刷新/重启/链接，与参考仓库的设置页一致。 */
.dsh-ux-cardTop {
  background: transparent;
  border: 0;
  margin-bottom: 0;
}
.dsh-ux-cardTop:hover { border-color: transparent; }
.dsh-ux-cardTop .dsh-ux-cardHeaderStatic { padding: 2px 0 14px; }
.dsh-ux-cardTop > .dsh-ux-restartBanner { margin: 0 0 12px; }
/* 总开关那一行是页头的尾巴（DOM 上它排在那几张卡之后），单独读成一张小卡，
   否则它会夹在两张卡中间、只有一条孤零零的横线。 */
.dsh-ux-cardTop > .dsh-ux-cardBody {
  background: var(--dsw-alias-bg-layer-3);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  margin: 0 0 12px;
  padding: 0 16px;
}
/* 顶部那张栏目头卡：它不是折叠卡，标题比其他 11 张高一号。 */
.dsh-ux-cardTop .dsh-ux-cardName { font-size: 15px; }

/* ── 标题行 ───────────────────────────────────────────────────────────── */
/* 标题行 = 左边"展开"按钮（占满剩余宽度）+ 右边从属控件与本栏开关。
   不能在 <button> 里塞按钮，所以两者是兄弟节点。 */
.dsh-ux-cardHeaderRow {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding-right: 12px;
}
.dsh-ux-cardHeader {
  appearance: none;
  box-sizing: border-box;
  flex: 1;
  min-width: 0;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  background: 0 0;
  border: 0;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
}
.dsh-ux-cardHeader:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: -2px;
}
.dsh-ux-cardHeaderStatic {
  box-sizing: border-box;
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 12px;
  padding: 14px 16px;
}
.dsh-ux-cardHeadText {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 3px;
  min-width: 0;
}
.dsh-ux-cardTitleRow {
  align-items: center;
  display: flex;
  gap: 6px;
  min-width: 0;
}
.dsh-ux-cardName {
  color: var(--dsw-alias-label-primary);
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.35;
  margin: 0;
}
.dsh-ux-cardDescription {
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 1.5;
  margin: 0;
}
.dsh-ux-cardControls {
  align-items: center;
  display: inline-flex;
  flex: none;
  flex-wrap: wrap;
  gap: 8px;
}
/* 标题行里的"文字 + 小开关"（边缘缩放这类）。 */
.dsh-ux-miniToggle {
  align-items: center;
  color: var(--dsw-alias-label-secondary);
  display: inline-flex;
  flex: none;
  font-size: 11px;
  gap: 5px;
  white-space: nowrap;
}
.dsh-ux-cardChevron {
  color: var(--dsw-alias-label-tertiary);
  flex: none;
  transition: transform .16s;
}
.dsh-ux-cardChevronOpen { transform: rotate(180deg); }

/* ── 卡内正文 ─────────────────────────────────────────────────────────── */
.dsh-ux-cardBody {
  border-top: 1px solid var(--dsw-alias-border-l2);
  margin: 0 16px;
  padding: 2px 0 14px;
}
/* 导语：卡片开头那段"这一栏干什么"的长说明（窄面板里要读得下去）。 */
.dsh-ux-lead {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 1.7;
  margin: 12px 0;
}
.dsh-ux-lead strong { color: var(--dsw-alias-label-primary); font-weight: 600; }

/* ── 设置行 ───────────────────────────────────────────────────────────── */
.dsh-ux-row {
  align-items: center;
  border-top: 1px solid var(--dsw-alias-border-l2);
  display: flex;
  gap: 12px;
  padding: 10px 0;
}
.dsh-ux-rowFirst { border-top: none; }
.dsh-ux-rowStacked { align-items: stretch; flex-direction: column; gap: 8px; }
.dsh-ux-rowText { flex: 1; min-width: 0; }
.dsh-ux-rowTitle {
  align-items: center;
  color: var(--dsw-alias-label-primary);
  display: flex;
  font-size: 12.5px;
  gap: 6px;
  line-height: 1.45;
}
.dsh-ux-rowDesc {
  color: var(--dsw-alias-label-tertiary);
  font-size: 11.5px;
  line-height: 1.55;
  margin-top: 2px;
}
.dsh-ux-rowControl {
  align-items: center;
  display: inline-flex;
  flex: none;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}
.dsh-ux-rowStacked .dsh-ux-rowControl { justify-content: flex-start; }

/* ── 分段控件 ─────────────────────────────────────────────────────────── */
.dsh-ux-segmented {
  align-items: center;
  background: transparent;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  display: inline-flex;
  flex: none;
  gap: 2px;
  padding: 2px;
}
.dsh-ux-segment {
  appearance: none;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--dsw-alias-label-tertiary);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  line-height: 1;
  padding: 5px 10px;
  transition: background-color .14s, border-color .14s, color .14s;
  white-space: nowrap;
}
.dsh-ux-segment:hover { color: var(--dsw-alias-label-primary); }
.dsh-ux-segmentOn {
  background: var(--dsw-alias-bg-layer-2);
  border-color: var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-primary);
  font-weight: 600;
}
.dsh-ux-segmentedCompact .dsh-ux-segment { font-size: 11px; padding: 4px 8px; }

/* 标题行/卡内的 PillChoice（role=group）：它是个独立组件、内联样式写在那边，
   这一轮不能改那个文件，而标题行要的是"一个控件分成几段"的观感，所以只在
   本插件的容器里、对它那几个内联属性用 !important 盖住（内联样式是普通优先级）。
   :not(.dsh-ux-segmented) 是为了不重复命中本文件自己的分段控件。 */
.dsh-ux-cardControls > [role='group']:not(.dsh-ux-segmented),
.dsh-ux-cardBody [role='group']:not(.dsh-ux-segmented) {
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  padding: 2px;
}
.dsh-ux-cardControls > [role='group']:not(.dsh-ux-segmented) > button,
.dsh-ux-cardBody [role='group']:not(.dsh-ux-segmented) > button {
  background: transparent !important;
  border: 1px solid transparent !important;
  border-radius: 6px !important;
  color: var(--dsw-alias-label-tertiary) !important;
  font-size: 11px !important;
  line-height: 1 !important;
  padding: 4px 8px !important;
  transition: background-color .14s, border-color .14s, color .14s;
}
.dsh-ux-cardControls > [role='group']:not(.dsh-ux-segmented) > button:hover,
.dsh-ux-cardBody [role='group']:not(.dsh-ux-segmented) > button:hover {
  color: var(--dsw-alias-label-primary) !important;
}
.dsh-ux-cardControls > [role='group']:not(.dsh-ux-segmented) > button[aria-pressed='true'],
.dsh-ux-cardBody [role='group']:not(.dsh-ux-segmented) > button[aria-pressed='true'] {
  background: var(--dsw-alias-bg-layer-2) !important;
  border-color: var(--dsw-alias-border-l2) !important;
  color: var(--dsw-alias-label-primary) !important;
  font-weight: 600;
}

/* ── ? 悬停说明 ───────────────────────────────────────────────────────── */
/* 徽标只占 14px：说明文字放进浮层，卡面才收得回"一句概览"的密度。 */
.dsh-ux-hint {
  align-items: center;
  appearance: none;
  background: transparent;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 50%;
  color: var(--dsw-alias-label-tertiary);
  cursor: help;
  display: inline-flex;
  flex: none;
  font: inherit;
  font-size: 10px;
  height: 14px;
  justify-content: center;
  line-height: 1;
  padding: 0;
  transition: border-color .14s, color .14s;
  width: 14px;
}
.dsh-ux-hint:hover,
.dsh-ux-hintOpen {
  border-color: var(--dsw-alias-label-dimmed);
  color: var(--dsw-alias-label-primary);
}
/* 浮层：官方菜单面 + 毛玻璃（只抄半透明会出现"一块没磨砂的玻璃"，0.1.7 踩过）。
   固定定位 + 由 JS 夹进视口，见 ui-kit.tsx 的 Hint。 */
.dsh-ux-hintBubble {
  background: var(--dsw-specific-menu);
  backdrop-filter: var(--dsw-menu-backdrop-filter);
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  box-shadow: var(--dsw-elevation-prominent);
  box-sizing: border-box;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 1.6;
  padding: 8px 10px;
  pointer-events: none;
  position: fixed;
  white-space: pre-wrap;
  z-index: 1200;
}

/* ── 卡内小标题 ───────────────────────────────────────────────────────── */
.dsh-ux-groupLabel {
  align-items: center;
  color: var(--dsw-alias-label-tertiary);
  display: flex;
  font-size: 11.5px;
  font-weight: 600;
  gap: 6px;
  letter-spacing: .04em;
  margin: 14px 0 2px;
}

/* ── 抬头：动作按钮与链接 ─────────────────────────────────────────────── */
.dsh-ux-cardLink {
  align-items: center;
  color: var(--dsw-alias-label-secondary);
  display: inline-flex;
  flex: none;
  font-size: 12px;
  gap: 4px;
  text-decoration: none;
  white-space: nowrap;
}
.dsh-ux-cardLink:hover {
  color: var(--dsw-alias-brand-primary);
  text-decoration: underline;
}
/* 抬头右端那一组：刷新 + 重启 + 两个链接，四枚都不参与收缩。 */
.dsh-ux-cardActions {
  align-items: center;
  display: inline-flex;
  flex: none;
  flex-wrap: wrap;
  gap: 8px;
}
.dsh-ux-restartButton {
  appearance: none;
  background: 0 0;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
  flex: none;
  font: inherit;
  font-size: 12px;
  line-height: 1;
  padding: 6px 12px;
  transition: border-color .16s, color .16s, background .16s;
  white-space: nowrap;
}
.dsh-ux-restartButton:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
  border-color: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-brand-primary);
}
.dsh-ux-restartButton:disabled {
  color: var(--dsw-alias-label-tertiary);
  cursor: default;
  opacity: .7;
}
/* 确认条：抬头正下方的一条，位置对齐市场的「N 项变更需重启」横幅。 */
.dsh-ux-restartBanner {
  align-items: center;
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  display: flex;
  gap: 10px;
  margin: 0 16px 12px;
  padding: 10px 12px;
}
.dsh-ux-restartBannerFailed { border-color: var(--dsw-alias-state-error-primary); }
.dsh-ux-restartBannerText {
  color: var(--dsw-alias-label-secondary);
  flex: 1;
  font-size: 12px;
  line-height: 1.5;
  min-width: 0;
}
.dsh-ux-restartBannerFailed .dsh-ux-restartBannerText { color: var(--dsw-alias-state-error-primary); }
.dsh-ux-restartBannerActions {
  align-items: center;
  display: inline-flex;
  flex: none;
  gap: 8px;
}
.dsh-ux-restartGo {
  appearance: none;
  background: var(--dsw-alias-button-primary-fill);
  border: 0;
  border-radius: 999px;
  color: var(--dsw-alias-label-primary-foreground);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  line-height: 1;
  padding: 7px 14px;
  white-space: nowrap;
}
.dsh-ux-restartGo:hover { background: var(--dsw-alias-brand-primary); }
.dsh-ux-restartCancel {
  appearance: none;
  background: 0 0;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  line-height: 1;
  padding: 7px 14px;
  white-space: nowrap;
}
.dsh-ux-restartCancel:hover {
  border-color: var(--dsw-alias-label-dimmed);
  color: var(--dsw-alias-label-primary);
}
`

/** 注入卡片样式表；返回卸载器（随插件 fiber 回收）。 */
export function installSettingsCardStyle(): () => void {
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-composer-ux-settings'
  tag.textContent = CARD_CSS
  document.head.appendChild(tag)
  return () => { tag.remove() }
}
