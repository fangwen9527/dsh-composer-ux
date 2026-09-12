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
  width: 100%;
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
