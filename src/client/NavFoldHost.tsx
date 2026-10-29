/**
 * 侧边栏两处折叠的挂载点（0.27.0 的「全局面板」+ 0.29.0 的底部区）。
 *
 * 组件本身**不渲染任何东西**：它只把 `nav-fold-store` 里的状态贴到宿主侧边栏上
 * （DOM 逻辑分别在 `sidebar-nav.ts` / `sidebar-footer.ts`，纯函数、可单测）。
 *
 * 为什么挂在 `shell.overlay`：那是 root 级槽，页面生命周期内一直在；而侧边栏不属于本插件的
 * 任何槽位，只能靠"常驻组件 + 直接改 DOM"这条路（与「设置面板边缘拖拽」同一做法）。
 *
 * 为什么一个组件管两处：两处的状态都存在同一份 `composer-ux-nav-fold.json` 里，
 * 观察器也只该挂一个（挂在侧边栏根上，两处的结构变化都看得见）。
 */
import { useEffect } from 'react'
import { saveNavFold, useNavFold } from './nav-fold-store.ts'
import { applyNavFold, findPanelNav } from './sidebar-nav.ts'
import { applyFooterFold } from './sidebar-footer.ts'

/** 只跑副作用的组件（返回 null）。 */
export function NavFoldHost(): null {
  const { mode, collapsed, footerCollapsed } = useNavFold()

  useEffect(() => {
    let frame = 0
    const apply = (): void => {
      applyNavFold(document, { mode, collapsed }, next => {
        // 点折叠条 = 只改"要不要收起"，形态不动。写盘失败也不回滚本地：这一轮先按用户点的那样显示。
        void saveNavFold({ collapsed: next })
      })
      // 底部区：整块藏/显（内容是宿主与别的插件渲染的，我们一个子节点都不碰）。
      applyFooterFold(document, { collapsed: footerCollapsed }, next => {
        void saveNavFold({ footerCollapsed: next })
      })
    }
    apply()

    // 只观察侧边栏那一层：结构变了（React 重渲染 / 新装面板 / 插件往底部加卡片）就重贴一次。
    const nav = findPanelNav(document)
    const scope = nav?.parentElement ?? document.body
    if (scope === null) return undefined
    const observer = new MutationObserver(() => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        apply()
      })
    })
    observer.observe(scope, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      if (frame !== 0) window.cancelAnimationFrame(frame)
    }
  }, [mode, collapsed, footerCollapsed])

  return null
}
