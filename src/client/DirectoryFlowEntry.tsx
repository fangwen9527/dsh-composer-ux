/**
 * 目录流程占用者的 React 适配层（0.18.0）：**无界面** —— 每条 `open` 上升沿弹一次系统文件夹框。
 *
 * 全部行为都在 `directory-flow.ts` 的纯逻辑里（可单测、有变异护栏），这里只做两件事：
 * 把 React 生命周期接到 `isAlive`（卸载后迟到的结果丢弃）、把持有方的**最新**回调交给结果映射。
 * 远端不注册本组件（`installDirectoryFlow` 在没有 preload 桥时直接返回），所以手机上照旧是
 * 官方那个应用内浏览界面。
 */
import { useEffect, useMemo, useRef } from 'react'
import {
  applyOutcome, createPickFlow,
  type DirectoryFlowOutcome, type DirectoryFlowOwner,
} from './directory-flow.ts'

/**
 * @param props - 槽位持有方的对话 + 注入进来的 `pick`（由 `installDirectoryFlow` 绑定到 preload 桥）。
 * @returns 永远 null：系统框开在操作系统那一侧。
 */
export function DirectoryFlowEntry(props: DirectoryFlowOwner & { pick: () => Promise<string | null> }): null {
  const { open, pick } = props
  /**
   * 实例是否还算数。
   *
   * 原生对话框没有按请求中止的机制，卸载后请求仍会落地；让死实例去 `onPicked`
   * 会凭空给用户加一个工作区。StrictMode 的开发态重放（setup→cleanup→setup）要在
   * 第二次 setup 里把它复活，否则所有结果都会被当成死实例扔掉。
   */
  const alive = useRef(true)
  /** 处理器走 ref：结果落地时用的是持有方**最新**的那份，而不是弹框那一刻捕获的。 */
  const latest = useRef(props)
  latest.current = props
  const flow = useMemo(() => createPickFlow({
    pick,
    report: (outcome: DirectoryFlowOutcome): void => { applyOutcome(latest.current, outcome) },
    isAlive: () => alive.current,
  }), [pick])
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])
  // 只在 open 变化时报告：保持 true（持有方 busy 采纳中）不会重复弹框，由状态机的上膛位保证。
  useEffect(() => { flow.setOpen(open) }, [flow, open])
  return null
}
