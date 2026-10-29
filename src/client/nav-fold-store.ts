/**
 * 「全局面板」折叠状态的存储（0.27.0）—— **插件自己存，不挤进宿主设置**。
 *
 * ## 为什么不用设置字段（2026-10-28 真机教训）
 *
 * 最初这两个值做成了宿主设置字段，结果踩到两件事叠在一起：
 *   1. **revision 竞态**：\`POST /api/settings/mutate\` 回
 *      \`{"ok":false,"error":{"code":"settings/conflict","expected revision 0, now 2"}}\` ——
 *      客户端镜像落后于宿主（宿主半启动时会自己写设置），于是"点开关没反应"；
 *   2. **legacy / patch 双存储**：本插件走的是 \`settings.register\` 老接口，宿主把写落进
 *      \`$DSH_HOME/settings-legacy.yaml\`，而界面读的是 patch 层 —— 写进去了也看不见。
 *
 * 而"这个组要不要折叠"本就是**界面偏好**（和窗口大小一类），不该占宿主 schema 的位置。
 * 所以改成和快捷指令本同一套路：宿主半存一份小 JSON（\`$DSH_HOME/composer-ux-nav-fold.json\`），
 * 客户端通过插件自己的路由读写。好处是换浏览器/换主机都一致，且不受设置服务的版本与存储形态影响。
 *
 * ## 默认值 = 用户要的"打开后默认折叠"
 *
 * \`{ mode: 'bar', collapsed: true }\`：收成一条「全局面板」。第一次打开就生效，
 * 不需要用户先去设置页点一下。
 */
import { useEffect, useState } from 'react'
import { NAV_FOLD_API_PATH } from '../settings-contract.ts'

/** 折叠形态：不折叠 / 收成一条 / 只留图标。 */
export type NavFoldMode = 'off' | 'bar' | 'icons'

/** 三档的展示文案（设置页分段控件用）。 */
export const NAV_FOLD_MODES: ReadonlyArray<{ readonly id: NavFoldMode; readonly label: string }> = [
  { id: 'off', label: '不折叠' },
  { id: 'bar', label: '收成一条' },
  { id: 'icons', label: '只留图标' },
]

/** 当前状态。 */
export interface NavFoldState {
  readonly mode: NavFoldMode
  readonly collapsed: boolean
  /** 侧边栏底部区（账号 + 用量卡片等）是否收起（0.29.0）。 */
  readonly footerCollapsed: boolean
}

/** 默认：收成一条 + 收起（用户原话"打开后默认折叠这个区域"）。 */
export const DEFAULT_NAV_FOLD: NavFoldState = { mode: 'bar', collapsed: true, footerCollapsed: true }

let state: NavFoldState = DEFAULT_NAV_FOLD
const listeners = new Set<() => void>()

/** 读当前状态（同步，给拖拽/点击这类即时反馈用）。 */
export function navFoldSnapshot(): NavFoldState {
  return state
}

/** 订阅状态变化。 */
export function subscribeNavFold(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** 本地更新 + 通知（写盘由 {@link saveNavFold} 负责）。 */
function setLocal(next: Partial<NavFoldState>): void {
  const merged = { ...state, ...next }
  if (merged.mode === state.mode && merged.collapsed === state.collapsed
    && merged.footerCollapsed === state.footerCollapsed) return
  state = merged
  for (const listener of listeners) listener()
}

/** 把任意输入净化成合法状态（宿主/文件被手改坏时兜底）。 */
export function sanitizeNavFold(value: unknown): NavFoldState {
  const raw = (value ?? {}) as { mode?: unknown; collapsed?: unknown; footerCollapsed?: unknown }
  const mode: NavFoldMode = raw.mode === 'off' || raw.mode === 'icons' || raw.mode === 'bar'
    ? raw.mode
    : DEFAULT_NAV_FOLD.mode
  return {
    mode,
    collapsed: typeof raw.collapsed === 'boolean' ? raw.collapsed : DEFAULT_NAV_FOLD.collapsed,
    footerCollapsed: typeof raw.footerCollapsed === 'boolean' ? raw.footerCollapsed : DEFAULT_NAV_FOLD.footerCollapsed,
  }
}

/**
 * 从宿主半读一次（启动时调）。
 *
 * 失败**保持默认**：读不到就按"收成一条 + 收起"渲染，用户仍然得到他要的行为，
 * 只是这一轮的开关状态不会跨重启记住。
 */
export async function loadNavFold(): Promise<void> {
  try {
    const response = await fetch(NAV_FOLD_API_PATH, { headers: { accept: 'application/json' } })
    if (!response.ok) return
    const payload = await response.json() as unknown
    setLocal(sanitizeNavFold(payload))
  } catch {
    /* 读不到就保持默认，不打扰用户 */
  }
}

/**
 * 写回宿主半。
 *
 * @param patch - 要改的字段。
 * @returns 空串 = 成功；否则是给人看的一句错误。
 */
export async function saveNavFold(patch: Partial<NavFoldState>): Promise<string> {
  // 先落本地：点击的即时反馈不能等网络。
  setLocal(patch)
  try {
    const response = await fetch(NAV_FOLD_API_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!response.ok) return `保存折叠状态失败：宿主返回 HTTP ${response.status}`
    const payload = await response.json() as { ok?: boolean; error?: string }
    if (payload.ok === true) return ''
    return `保存折叠状态失败：${payload.error === undefined || payload.error === '' ? '宿主拒绝' : payload.error}`
  } catch (error: unknown) {
    return `保存折叠状态失败：${error instanceof Error ? error.message : String(error)}`
  }
}

/**
 * 组件用的钩子：订阅折叠状态。
 *
 * 只在浏览器里用（SSR/测试里没有 fetch 也没关系：初始值就是默认值）。
 */
export function useNavFold(): NavFoldState {
  const [snapshot, setSnapshot] = useState<NavFoldState>(state)
  useEffect(() => subscribeNavFold(() => { setSnapshot(state) }), [])
  return snapshot
}
