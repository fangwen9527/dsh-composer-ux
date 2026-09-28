/**
 * 「统计行」的 DOM 助手：定位那一行、改写那一段文本。
 *
 * 与 `StatsLineEntry.tsx` 分开是为了**能在 node 里测**：这个文件只在函数体里碰 `document`，
 * 顶层没有任何 DOM 访问，也不 import React，所以测试可以喂它一棵"按官方源码复刻的"假 DOM
 * （`test/stats-dom.mjs`）。React 那一层只剩"什么时候扫、扫完怎么收尾"，风险低得多。
 *
 * 0.7.0 曾在这里实现过"加宽统计行"（写行内 `max-width` 并逐项还原），真机核对后按用户拍板
 * **撤掉**：`--dsh-chat-content-width` 管不到统计行，参考实现那个上限反而比可用宽度小。
 * 理由见 `stats-line.ts` 文件头与 `CHANGELOG.md` 的 `[0.7.0]` 节。
 */
import { STATS_ROOT_SELECTOR, rewriteCacheHitLabel, rewriteCacheHitText } from './stats-line.ts'

/**
 * 从锚点往上找"同时装着我和统计行"的祖先时的最大层数。
 *
 * 为什么不直接用 `anchor.parentElement`：槽位运行时可能给每个条目套一层包裹元素，那时
 * `parentElement` 是包裹层、里面没有统计行，`querySelector` 就落空。所以按"谁包含统计行"
 * 往上找，但**必须有上限**：不设限就可能一路走到 body，那样这个 MutationObserver 就变成
 * "监听整个页面"（社区插件 dsh-cache-precision 正是扫整个 body）。真到了第 6 层还没找到，
 * 就当这一版 DSH 的结构我们不认识，什么都不做（宁可功能不生效，也不留一个全页监听）。
 */
export const MAX_HOST_DEPTH = 6

/** 找到同时装着锚点与统计行的最近祖先；找不到（或超过层数上限）返回 null。 */
export function hostOf(anchor: Element | null): HTMLElement | null {
  let element = anchor?.parentElement ?? null
  for (let depth = 0; depth < MAX_HOST_DEPTH && element !== null; depth += 1) {
    if (element.querySelector(STATS_ROOT_SELECTOR) !== null) return element as HTMLElement
    element = element.parentElement
  }
  return null
}

/**
 * 把统计行里那一段百分比改成 `display`。
 *
 * 两处都要改：
 *  · 可见文本节点（官方 locale 渲染成单独一个节点：`缓存命中 12%`）；
 *  · 那颗胶囊的 `aria-label`（`` `${total} · ${cacheHitText}` ``）——不同步的话，
 *    **读屏用户听到的还是整数**，与屏幕上的三位小数对不上。
 *
 * 是否该改由 `stats-line.ts` 的两个纯函数判（它们有"整段才算"这条约束），这里只负责遍历
 * 与写入；写入前已经比对过，值没变就不写，所以观察器不会自己喂自己。
 * @param stats - 官方统计行根元素。
 * @param display - 目标百分比数字文本（不含 `%`）。
 */
export function rewriteCacheHit(stats: Element, display: string): void {
  const walker = document.createTreeWalker(stats, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node !== null) {
    const text = node.nodeValue ?? ''
    const next = rewriteCacheHitText(text, display)
    if (next !== null) node.nodeValue = next
    node = walker.nextNode()
  }
  for (const labelled of stats.querySelectorAll('[aria-label]')) {
    const label = labelled.getAttribute('aria-label')
    if (label === null) continue
    const next = rewriteCacheHitLabel(label, display)
    if (next !== null) labelled.setAttribute('aria-label', next)
  }
}
