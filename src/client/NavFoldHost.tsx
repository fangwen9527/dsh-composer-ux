/**
 * 「全局面板」折叠的挂载点（0.27.0）。
 *
 * 组件本身**不渲染任何东西**：它只把 `nav-fold-store` 里的状态贴到宿主侧边栏那个 `<nav>` 上
 * （DOM 逻辑在 `sidebar-nav.ts`，纯函数、可单测）。
 *
 * 为什么挂在 `shell.overlay`：那是 root 级槽，页面生命周期内一直在；而侧边栏不属于本插件的
 * 任何槽位，只能靠"常驻组件 + 直接改 DOM"这条路（与「设置面板边缘拖拽」同一做法）。
 */
import { useEffect } from 'react'
import { useNavFold } from './nav-fold-store.ts'
import { applyNavFold, findPanelNav } from './sidebar-nav.ts'

/** 只跑副作用的组件（返回 null）。 */
export function NavFoldHost(): null {
  const { mode, collapsed } = useNavFold()

  useEffect(() => {
    let frame = 0
    const apply = (): void => {
      applyNavFold(document, { mode, collapsed }, next => {
        // 点折叠条 = 只改"要不要收起"，形态不动。写盘失败也不回滚本地：这一轮先按用户点的那样显示。
        void import('./nav-fold-store.ts').then(store => store.saveNavFold({ collapsed: next }))
      })
    }
    apply()

    // 只观察侧边栏那一层：结构变了（React 重渲染 / 新装面板）就重贴一次。
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
  }, [mode, collapsed])

  return null
}
