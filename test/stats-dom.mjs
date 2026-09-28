/**
 * 「统计行」DOM 助手测试（0.7.0）。
 *
 *   node test/stats-dom.mjs
 *
 * 为什么需要一个**假 DOM**：这块能力最容易坏的地方是**静默**的 —— 定位落空（锚点与统计行
 * 不在同一个祖先下）⇒ 什么都不发生，用户只看到"数字还是整数"；改写没收窄范围 ⇒ 会把两处
 * 统计弹窗或同排的 token 数一起改掉。两件都不会报错、也不会崩，只能靠把结构喂进来逐条钉。
 *
 * 树结构**按官方源码复刻**（`packages/client/ui-chat/src/client/chat/StatsPills.tsx`
 * 的紧凑与详细两档 + `ui-conversation` 的 `InputBar` dock 容器），并额外造出两处真实存在
 * 的"陷阱"：槽位运行时可能给条目套的包裹层，以及两处统计弹窗那种 `<dt>缓存命中</dt><dd>` 结构。
 *
 * 假 DOM 只实现被用到的那几个口子（`querySelector` 只认我们真查的三个选择器），
 * 不是通用实现 —— 它盯的是"我们的用法"，不是"浏览器该怎么做"。
 */

let failures = 0
let passes = 0

function check(label, condition, detail) {
  if (condition) {
    passes += 1
    console.log(`  ✓ ${label}`)
    return
  }
  failures += 1
  console.log(`  ✗ ${label}${detail === undefined ? '' : ` — ${detail}`}`)
}

// ── 极简 DOM ────────────────────────────────────────────────────────────────
const TEXT_NODE = 3
const ELEMENT_NODE = 1

class FakeText {
  constructor(value) {
    this.nodeType = TEXT_NODE
    this.nodeValue = value
  }
}

class FakeElement {
  constructor(tag, attrs = {}) {
    this.nodeType = ELEMENT_NODE
    this.tagName = tag.toUpperCase()
    this.attrs = { ...attrs }
    this.style = {}
    this.children = []
    this.parentElement = null
  }

  /** 加子节点（字符串即文本节点）。 */
  add(...nodes) {
    for (const node of nodes) {
      const child = typeof node === 'string' ? new FakeText(node) : node
      child.parentElement = this
      this.children.push(child)
    }
    return this
  }

  /** 是不是我们的元素节点（文本节点没有这些方法）。 */
  get isElement() { return true }

  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null
  }

  setAttribute(name, value) {
    this.attrs[name] = String(value)
  }

  /** 只实现我们真查的三个选择器；别的选择器一律返回空（假 DOM 的边界要写明白）。 */
  matches(selector) {
    if (selector === '[data-composer-stats]') return this.getAttribute('data-composer-stats') !== null
    if (selector === '[aria-label]') return this.getAttribute('aria-label') !== null
    return false
  }

  querySelector(selector) {
    for (const child of this.children) {
      if (child.nodeType !== ELEMENT_NODE) continue
      if (child.matches(selector)) return child
      const deeper = child.querySelector(selector)
      if (deeper !== null) return deeper
    }
    return null
  }

  querySelectorAll(selector) {
    const out = []
    for (const child of this.children) {
      if (child.nodeType !== ELEMENT_NODE) continue
      if (child.matches(selector)) out.push(child)
      out.push(...child.querySelectorAll(selector))
    }
    return out
  }

  /** 深度优先收集文本节点（真 DOM 的 TreeWalker 就是这么走的）。 */
  textNodes() {
    const out = []
    for (const child of this.children) {
      if (child.nodeType === TEXT_NODE) out.push(child)
      else out.push(...child.textNodes())
    }
    return out
  }
}

globalThis.NodeFilter = { SHOW_TEXT: 4 }
globalThis.document = {
  createTreeWalker(root, whatToShow) {
    if (whatToShow !== NodeFilter.SHOW_TEXT) throw new Error('假 DOM 只实现 SHOW_TEXT')
    const nodes = root.textNodes()
    let index = -1
    return {
      nextNode() {
        index += 1
        return index < nodes.length ? nodes[index] : null
      },
    }
  },
}

const { build } = await import('esbuild')
const { mkdirSync } = await import('node:fs')
mkdirSync(new URL('./.build/', import.meta.url), { recursive: true })
await build({
  entryPoints: ['test/pure-entry.ts'],
  outfile: 'test/.build/stats-dom.mjs',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['es2022'],
  logLevel: 'warning',
})
const pure = await import(new URL('./.build/stats-dom.mjs', import.meta.url))

// ── 按官方源码复刻的那棵树 ──────────────────────────────────────────────────
/**
 * 详细档的官方结构：
 *   div.dock
 *     div.root[data-composer-stats]
 *       span.anchor > button.pill[aria-label] > svg + span.label > ("8.2K tok", span.sep·, "缓存命中 12%")
 *     div (ContextMeter，同排的另一个 flex 项)
 * 紧凑档更简单：div.root > span.pill > svg + "缓存命中 12%"（文本节点直接挂在 pill 上）。
 * @param options - wrap=true 时模拟"槽位运行时给条目套了一层包裹元素"。
 * @returns 节点句柄。
 */
function buildTree(options = {}) {
  const body = new FakeElement('body')
  const dock = new FakeElement('div', { class: 'dock_hash' })
  // 我的锚点（StatsLineEntry 渲染出来的那个 display:none 的 span）
  const anchor = new FakeElement('span', { 'data-composer-ux-stats-anchor': '', hidden: '' })
  anchor.style.display = 'none'
  if (options.wrap === true) {
    const wrapper = new FakeElement('div', { class: 'slotEntry_hash' })
    wrapper.add(anchor)
    dock.add(wrapper)
  } else {
    dock.add(anchor)
  }

  // 统计行本体（详细档）
  const root = new FakeElement('div', { 'data-composer-stats': '' })
  const pillAnchor = new FakeElement('span', { class: '_anchor_hash' })
  const button = new FakeElement('button', {
    class: '_pill_hash',
    'aria-label': `${options.total ?? '8.2K tok'} · 缓存命中 ${options.percent ?? '12'}%`,
  })
  const label = new FakeElement('span', { class: '_label_hash' })
  label.add(options.total ?? '8.2K tok', new FakeElement('span', { class: '_sep_hash' }).add('·'), `缓存命中 ${options.percent ?? '12'}%`)
  button.add(new FakeElement('svg'), label)
  pillAnchor.add(button)
  root.add(pillAnchor)
  dock.add(root)
  dock.add(new FakeElement('div', { class: '_meter_hash' }).add('上下文 12%'))

  // 同排的另一个 composer（页面上可能有多个）：用来证明我们只动自己那一个
  const otherDock = new FakeElement('div', { class: 'dock_hash' })
  const otherRoot = new FakeElement('div', { 'data-composer-stats': '' })
  const otherPill = new FakeElement('span', { class: '_pill_hash' })
  otherPill.add('缓存命中 88%')
  otherRoot.add(otherPill)
  otherDock.add(otherRoot)

  body.add(dock, otherDock)

  // 两处统计弹窗：<dt>缓存命中</dt><dd>12.3%</dd>（拼起来是「缓存命中12.3%」，中间没有空白）
  const dialog = new FakeElement('div', { role: 'dialog' })
  const dl = new FakeElement('dl', { 'data-session-stats-usage': '' })
  dl.add(new FakeElement('dt').add('缓存命中'), new FakeElement('dd').add('12.3%'))
  dialog.add(dl)
  body.add(dialog)

  return { body, dock, root, button, label, otherRoot, otherPill, dialog, anchor }
}

const cacheTextOf = root => root.textNodes().map(node => node.nodeValue).filter(text => text.includes('缓存命中'))
/** 把一棵子树里的可见文本按出现顺序拼起来（断言"整棵里到底有什么"用）。 */
const textOf = root => root.textNodes().map(node => node.nodeValue).join('|')

// ══════════════ 1. 定位 ═════════════════════════════════════════════════════
console.log('1. 定位：从锚点找到"同时装着我和统计行"的最近祖先')
{
  const flat = buildTree()
  check('直接平铺时找到的是 dock（不是统计行本身）',
    pure.hostOf(flat.anchor) === flat.dock)
  const wrapped = buildTree({ wrap: true })
  check('槽位运行时套了一层包裹元素时，仍然找得到 dock',
    pure.hostOf(wrapped.anchor) === wrapped.dock)

  check('锚点不在树上（null）→ null', pure.hostOf(null) === null)
  check('同级没有统计行 → null', pure.hostOf(new FakeElement('span')) === null)

  // 层数上限防的是这一种情形：我的锚点与统计行**不在同一棵子树**里
  // （槽位运行时把条目渲染到别处去了）。那时往上走只会在第 7 层撞到 <body>，
  // 而 body 当然"包含"统计行 —— 不设限就会把整个页面变成观察目标。
  const splitBody = new FakeElement('body')
  const branch = new FakeElement('div')
  splitBody.add(branch)
  let cursor = branch
  for (let level = 0; level < pure.MAX_HOST_DEPTH + 1; level += 1) {
    const next = new FakeElement('div')
    cursor.add(next)
    cursor = next
  }
  const deepAnchor = new FakeElement('span')
  cursor.add(deepAnchor)
  const apartBranch = new FakeElement('div')
  apartBranch.add(new FakeElement('div', { 'data-composer-stats': '' }))
  splitBody.add(apartBranch)
  check('同一棵 body 但不在同一子树（第 7 层才是 body）→ 放弃，不返回 body',
    pure.hostOf(deepAnchor) === null, String(pure.hostOf(deepAnchor)?.tagName))
}

// ══════════════ 2. 改写：只动那一段 ═════════════════════════════════════════
console.log('2. 改写：可见文本与 aria-label 一起换，弹窗与同排别的 composer 不碰')
{
  const tree = buildTree()
  pure.rewriteCacheHit(tree.root, '12.346')
  check('可见文本节点变成三位小数',
    cacheTextOf(tree.root).includes('缓存命中 12.346%'), cacheTextOf(tree.root).join(' | '))
  check('aria-label 同步（读屏听到的也是三位）',
    tree.button.getAttribute('aria-label') === '8.2K tok · 缓存命中 12.346%',
    tree.button.getAttribute('aria-label'))
  check('同一行里的 token 数没被误改', tree.root.textNodes().some(node => node.nodeValue === '8.2K tok'))
  check('同排的 ContextMeter 没被误改',
    tree.root.textNodes().every(node => !(node.nodeValue === '上下文 12%')))
  check('弹窗里的 <dt>缓存命中</dt> / <dd>12.3%</dd> 一个都没动',
    tree.dialog.textNodes().map(node => node.nodeValue).join('|') === '缓存命中|12.3%',
    tree.dialog.textNodes().map(node => node.nodeValue).join('|'))
  check('页面上另一个 composer 的统计行没被动（只动自己那一个）',
    cacheTextOf(tree.otherRoot).join('|') === '缓存命中 88%', cacheTextOf(tree.otherRoot).join('|'))

  // 还原档：把官方那一份写回去。
  pure.rewriteCacheHit(tree.root, '12')
  check('写回官方口径（0 位小数）',
    cacheTextOf(tree.root).join('|') === '缓存命中 12%'
    && tree.button.getAttribute('aria-label') === '8.2K tok · 缓存命中 12%',
    cacheTextOf(tree.root).join('|'))

  // 紧凑档：文本节点直接挂在 pill 上，也认。
  const compact = new FakeElement('div', { 'data-composer-stats': '' })
  const pill = new FakeElement('span', { 'aria-label': '8.2K tok · 缓存命中 12%' })
  pill.add('缓存命中 12%')
  compact.add(pill)
  pure.rewriteCacheHit(compact, '7.500')
  check('紧凑档（文本直接挂 span 上）同样改写',
    textOf(compact) === '缓存命中 7.500%', textOf(compact))

  // 英文界面
  const en = new FakeElement('div', { 'data-composer-stats': '' })
  const enPill = new FakeElement('span', { 'aria-label': '8.2K tok · Cache hit 12%' })
  enPill.add('Cache hit 12%')
  en.add(enPill)
  pure.rewriteCacheHit(en, '12.346')
  check('英文界面（Cache hit）同样改写',
    textOf(en) === 'Cache hit 12.346%'
    && enPill.getAttribute('aria-label') === '8.2K tok · Cache hit 12.346%', textOf(en))

  // 幂等：同一目标再写一次不该有任何写入（观察器收敛的前提）。
  const before = cacheTextOf(tree.root).join('|')
  tree.root.textNodes().forEach(node => { node.writes = 0 })
  pure.rewriteCacheHit(tree.root, '12')
  check('目标值一致时不再写（幂等，观察器不会自己喂自己）',
    cacheTextOf(tree.root).join('|') === before)
}

// ══════════════ 3. 不碰样式 ═════════════════════════════════════════════════
//
// 0.7.0 早期版本还在这里写过行内 `max-width`（"加宽统计行"），真机核对后由用户拍板撤掉：
// `--dsh-chat-content-width` 管不到统计行（约束它的是外层容器），参考实现那个上限反而
// 比可用宽度小。**这一节留着当护栏**：那一半一旦被人重新加回来，这条会红。
console.log('3. 只改文本，不碰那一行的样式')
{
  const tree = buildTree()
  tree.root.style.maxWidth = '200px'
  const before = { ...tree.root.style }
  pure.rewriteCacheHit(tree.root, '12.346')
  check('改写文本不动任何行内样式（不写 max-width / width / box-sizing）',
    JSON.stringify(tree.root.style) === JSON.stringify(before), JSON.stringify(tree.root.style))
  check('契约里不再导出加宽相关常量（撤干净）',
    pure.WIDEN_MAX_WIDTH === undefined && pure.WIDEN_EXTRA_PX === undefined && pure.setWidening === undefined)
}

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
