/**
 * 「统计行」的挂载点：注册在 `conversation.composer.dock` 上的一个**隐形条目**。
 *
 * 为什么走这条路（而不是覆盖官方那个 `stats` 条目自己重画）：官方 `StatsPills` 一颗胶囊
 * 里同时挂着会话统计弹窗、时间胶囊、每轮 token 弹窗、紧凑/详细两档，重画等于把官方 UI
 * 整块抄一遍，之后 DSH 每升一版都要跟着抄。这里只改**那一段文本**，官方其它部分一个字节
 * 都不碰。代价是依赖真实 DOM 结构，所以定位一律走官方**属性**（`data-composer-stats`），
 * 不走 CSS Modules 的类名（那串带哈希，升级就会变）。
 *
 * 作用范围（用户 2026-09-28 拍板）：**只改输入框下方这一行**（含它的 `aria-label`）。
 * 两处统计弹窗里的百分比保持官方原样——它们的 `<dt>` / `<dd>` 是两个节点，拼起来是
 * `缓存命中49.4%`（中间没有空白），`stats-line.ts` 那条"整段才算"的判据天然不会碰它们。
 *
 * 这个文件只负责"什么时候扫、扫完怎么收尾"；定位与改写的实现在 `stats-dom.ts`
 * （那里不 import React，可以喂假 DOM 测）。
 */
import React from 'react'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-store'
import type { ComposerUxSettings } from '../settings-contract.ts'
import {
  HIT_DIGITS, STATS_ROOT_SELECTOR, cacheHitDisplay, statsLineEnabled, type TokenUsageLike,
} from './stats-line.ts'
import { hostOf, rewriteCacheHit } from './stats-dom.ts'

/** 同一次 React 提交会连发多条变更记录，攒这一小段时间再扫一次。 */
const SCAN_DEBOUNCE_MS = 80

/** 设置页注入面。 */
export interface StatsLineEntryProps {
  /** 当前设置快照（`inject: () => ({ hooks: { live } })`）。 */
  readonly useLive: SnapshotSelectorHook<ComposerUxSettings>
  /**
   * 会话级槽位的**框架标准套件**成员，按 key 读投影值（这里只读 `tokenUsage`）。
   * 官方 `StatsPills` 读的是同一个 key，所以两个数字天然同源。
   */
  readonly useProjection: (key: string) => unknown
}

/**
 * 隐形条目本体。
 *
 * 自己渲染一个 `display:none` 的 span，作用只有一个：**给我一个落在同一个 composer dock 里的
 * 位置**，据此找到兄弟节点里的统计行。这样即使页面上有多个 composer，也只动我自己这一个，
 * 而不是"全页第一个统计行"。
 *
 * 这个 span **常驻挂载**（不随开关卸载），因为"关掉"这件事本身要靠它定位到统计行、把
 * 官方原样写回去：关掉时 `target` 就是官方口径（0 位小数），扫一遍即还原。
 */
export function StatsLineEntry({ useLive, useProjection }: StatsLineEntryProps): React.ReactElement {
  const settings = useLive(item => item)
  const active = statsLineEnabled(settings)
  const usage = typeof useProjection === 'function'
    ? useProjection('tokenUsage') as TokenUsageLike | undefined
    : undefined
  // 关着的时候目标是**官方口径**（0 位小数），不是"什么都不写"——否则关掉开关的那一刻，
  // 已经改上去的三位小数没人负责收回来（React 那边字符串没变，不会重画那个节点）。
  const target = cacheHitDisplay(usage, active ? HIT_DIGITS : 0)
  const anchor = React.useRef<HTMLSpanElement | null>(null)

  React.useLayoutEffect(() => {
    const host = hostOf(anchor.current)
    if (host === null) return
    let timer: ReturnType<typeof setTimeout> | undefined

    const apply = (): void => {
      const stats = host.querySelector(STATS_ROOT_SELECTOR)
      // 这一轮统计行还没渲染出来（没有计费输入时官方整个节点都不存在）—— 无事可做。
      if (stats === null) return
      if (target !== null) rewriteCacheHit(stats, target)
    }

    apply()

    // 关掉时不留常驻监听：apply() 已经把官方原样写回去了，再盯下去纯属白耗。
    if (!active) return

    const schedule = (): void => {
      if (timer !== undefined) return
      timer = setTimeout(() => { timer = undefined; apply() }, SCAN_DEBOUNCE_MS)
    }
    // `aria-label` 必须单独盯：它由 React 每次重画时整串重写（只要总数变了就会写回官方整数）；
    // 可见文本节点那边的写入会自己触发 characterData，所以两种都要覆盖。
    const observer = new MutationObserver(schedule)
    observer.observe(host, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['aria-label'],
    })
    return () => {
      observer.disconnect()
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [active, target])

  return (
    <span
      ref={anchor}
      hidden
      aria-hidden="true"
      data-composer-ux-stats-anchor=""
      style={{ display: 'none' }}
    />
  )
}
