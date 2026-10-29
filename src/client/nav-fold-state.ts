/**
 * 「全局面板」/ 底部区 折叠的**纯状态**（0.29.1 从 nav-fold-store.ts 拆出来）。
 *
 * 这里零依赖（不 import react、不碰 fetch），所以能被单测直接 bundle。
 *
 * ⚠️ 两条行为是用户 2026-10-29 拍板的，别改回去：
 *   1. **收起位永远 true**：每次打开 DSH 都收起，**不记忆展开**（点折叠条只在本次会话有效）；
 *      文件里即使写着 `collapsed: false` 也忽略 —— 老文件不会把"上次点开过"带过来。
 *   2. **只有"形态"落盘**（{@link persistableNavFold}）：收起/展开不写文件。
 */

/** 折叠形态：不折叠 / 收成一条 / 只留图标。 */
export type NavFoldMode = 'off' | 'bar' | 'icons'

/** 三档的展示文案（设置页分段控件用）。 */
export const NAV_FOLD_MODES: ReadonlyArray<{ readonly id: NavFoldMode; readonly label: string }> = [
  { id: 'off', label: '不折叠' },
  { id: 'bar', label: '收成一条' },
  { id: 'icons', label: '只留图标' },
]

/** 一次应用所需的全部状态。 */
export interface NavFoldState {
  readonly mode: NavFoldMode
  /** 顶部面板组是否收起（**本次会话**，不落盘）。 */
  readonly collapsed: boolean
  /** 侧边栏底部区是否收起（**本次会话**，不落盘）。 */
  readonly footerCollapsed: boolean
}

/** 默认：收成一条 + 两处都收起。 */
export const DEFAULT_NAV_FOLD: NavFoldState = { mode: 'bar', collapsed: true, footerCollapsed: true }

/**
 * 把宿主/文件里的值净化成合法状态。
 *
 * @param value - 原始 JSON（可能缺字段、可能是脏数据）。
 * @returns 合法状态；**两个收起位永远是 true**（见文件头第 1 条）。
 */
export function sanitizeNavFold(value: unknown): NavFoldState {
  const raw = (value ?? {}) as { mode?: unknown }
  const mode: NavFoldMode = raw.mode === 'off' || raw.mode === 'icons' || raw.mode === 'bar'
    ? raw.mode
    : DEFAULT_NAV_FOLD.mode
  return { mode, collapsed: true, footerCollapsed: true }
}

/**
 * 这次改动里**哪些字段该写盘**。
 *
 * 只有形态该持久化；收起/展开是会话内状态（写盘会把"打开时总是收起"这条规则破掉）。
 *
 * @param patch - 调用方想改的字段。
 * @returns 要 POST 的字段（可能为空对象 = 什么都不用发）。
 */
export function persistableNavFold(patch: Partial<NavFoldState>): { mode?: NavFoldMode } {
  return patch.mode === undefined ? {} : { mode: patch.mode }
}
