/**
 * 设置页折叠卡片样式。
 *
 * 观感对齐社区插件 @linxin666/dsh-web-all 的 SettingsCard：12px 圆角、
 * 1px 描边（hover 变 --dsw-alias-label-dimmed）、展开时换底色并显示分隔线、
 * 右侧 chevron 旋转 180°。类名统一 dsh-ux- 前缀，避免与宿主 CSS Modules 冲突。
 */

const CARD_CSS = `
.dsh-ux-card {
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-3);
  border-radius: 12px;
  margin-bottom: 12px;
  transition: border-color .16s, background .16s;
}
.dsh-ux-card:hover { border-color: var(--dsw-alias-label-dimmed); }
.dsh-ux-cardOpen {
  background: var(--dsw-alias-bg-layer-2);
  border-color: var(--dsw-alias-label-dimmed);
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
  gap: 12px;
  padding: 14px 16px;
}
.dsh-ux-cardHeader:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: -2px;
}
/* 标题行 = 左边"展开"按钮（占满剩余宽度）+ 右边从属控件与本栏开关。
   不能在 <button> 里塞按钮，所以两者是兄弟节点。 */
.dsh-ux-cardHeaderRow {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding-right: 12px;
}
.dsh-ux-cardControls {
  align-items: center;
  display: inline-flex;
  flex: none;
  flex-wrap: wrap;
  gap: 8px;
}
/* 标题行里的"文字 + 小开关"（导航滚动 / 边缘缩放）。 */
.dsh-ux-miniToggle {
  align-items: center;
  color: var(--dsw-alias-label-secondary);
  display: inline-flex;
  flex: none;
  font-size: 11px;
  gap: 5px;
  white-space: nowrap;
}
/* 未启用：标题行里说清楚，正文压暗，让人一眼看出"这一栏现在不生效"。 */
.dsh-ux-cardOff { border-style: dashed; }
.dsh-ux-cardOff .dsh-ux-cardBody { opacity: .6; }
.dsh-ux-cardHeaderStatic {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
}
.dsh-ux-cardHeadText {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 4px;
  min-width: 0;
}
.dsh-ux-cardName {
  color: var(--dsw-alias-label-primary);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  margin: 0;
}
.dsh-ux-cardDescription {
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
}
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
/* 抬头右端那一组：重启按钮 + GitHub 链接，两枚都不参与收缩。 */
.dsh-ux-cardActions {
  align-items: center;
  display: inline-flex;
  flex: none;
  gap: 10px;
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
.dsh-ux-cardChevron {
  color: var(--dsw-alias-label-tertiary);
  flex: none;
  transition: transform .16s;
}
.dsh-ux-cardChevronOpen { transform: rotate(180deg); }
.dsh-ux-cardBody {
  border-top: 1px solid var(--dsw-alias-border-l2);
  margin: 0 16px;
  padding-bottom: 8px;
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
