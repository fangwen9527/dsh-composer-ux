/**
 * 侧边栏**底部区**折叠（0.29.0）的测试。
 *
 *   node test/sidebar-footer.mjs
 *
 * 用户 2026-10-29：「这个位置的这些按钮也让它能收缩起来，兼容所有在这个部位的按钮」，
 * 并选定：**整个底部区一起收**（插件卡片 + 官方账号行）、形态是**一行细条**。
 *
 * 这里要钉住三件事：
 *   1. **找得到**那个容器（靠结构：nav 的父节点 → 它的最后一个子节点，不认哈希类名）；
 *   2. **整块藏/显**，而且**不碰里面任何一个节点**（兼容的前提：别人放的东西原样留着）；
 *   3. 收起/展开的状态能来回贴，且点细条返回"下一状态"。
 *
 * 环境里没有浏览器，所以同样用最小 DOM 桩（只实现本模块用到的那几个 API）。
 */
import { build } from 'esbuild'

let passes = 0
let failures = 0
function check(label, condition, detail) {
  if (condition) {
    passes += 1
    console.log(`  ✓ ${label}`)
    return
  }
  failures += 1
  console.log(`  ✗ ${label}${detail === undefined ? '' : ` — ${detail}`}`)
}

const bundled = await build({
  bundle: true, write: false, format: 'esm', platform: 'node', target: ['es2022'], logLevel: 'warning',
  stdin: {
    contents: "export { FOOTER_FOLD_CSS, FOOTER_FOLD_ATTR, FOOTER_HEAD_ATTR, FOOTER_HEAD_INLINE_ATTR, FOOTER_HEAD_TEXT, applyFooterFold, findSidebarFooter } from './src/client/sidebar-footer.ts'\n",
    resolveDir: process.cwd(), loader: 'ts',
  },
})
const pure = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)

/** 够用的 DOM 桩（与 test/sidebar-nav.mjs 同一套思路，按本模块需要裁剪）。 */
class StubElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase()
    this.attributes = new Map()
    this.children = []
    this.parentElement = null
    this.textContent = ''
    this.style = {}
    this.onclick = null
    this.type = ''
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)) }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null }
  hasAttribute(name) { return this.attributes.has(name) }
  removeAttribute(name) { this.attributes.delete(name) }
  appendChild(child) {
    if (child.parentElement !== null) child.parentElement.children = child.parentElement.children.filter(item => item !== child)
    child.parentElement = this
    this.children.push(child)
    return child
  }
  append(...nodes) { for (const node of nodes) this.appendChild(node) }
  insertBefore(child, before) {
    if (child.parentElement !== null) child.parentElement.children = child.parentElement.children.filter(item => item !== child)
    child.parentElement = this
    const at = this.children.indexOf(before)
    if (at < 0) this.children.push(child)
    else this.children.splice(at, 0, child)
    return child
  }
  remove() {
    const parent = this.parentElement
    if (parent === null) return
    parent.children = parent.children.filter(child => child !== this)
    this.parentElement = null
  }
  get lastElementChild() { return this.children.length === 0 ? null : this.children[this.children.length - 1] }
  contains(node) {
    if (node === this) return true
    for (const child of this.children) if (child.contains(node)) return true
    return false
  }
  querySelectorAll(selector) {
    // 真 DOM 的 querySelector 支持逗号分隔（"a, b" = 命中任意一个）。桩以前只认单条，
    // 于是 `nav[aria-label="全局面板"], nav[aria-label="Global panels"]` 永远匹配不到 ——
    // 硬保护因此形同虚设（2026-11-13 查出来的）。这里按逗号拆开，逐条试。
    const parts = selector.split(",").map(part => part.trim()).filter(Boolean)
    if (parts.length > 1) {
      const merged = []
      for (const part of parts) for (const hit of this.querySelectorAll(part)) if (!merged.includes(hit)) merged.push(hit)
      return merged
    }
    const want = selector.trim()
    const match = (element) => {
      const attrMatch = /^([a-z]*)\[([a-z-]+)(?:=['"]?([^'"]*)['"]?)?\]$/.exec(want)
      if (attrMatch !== null) {
        const [, tag, attr, value] = attrMatch
        if (tag !== '' && element.tagName !== tag.toUpperCase()) return false
        if (!element.hasAttribute(attr)) return false
        return value === undefined || element.getAttribute(attr) === value
      }
      return element.tagName === want.toUpperCase()
    }
    const out = []
    const walk = (element) => {
      for (const child of element.children) {
        if (match(child)) out.push(child)
        walk(child)
      }
    }
    walk(this)
    return out
  }
  querySelector(selector) {
    const hits = this.querySelectorAll(selector)
    return hits.length > 0 ? hits[0] : null
  }
}

/**
 * 搭一棵"像宿主的"侧边栏：
 * root → [nav(面板行…), regionArea, footer(footerActions(用量卡片) + settingsArea(账号按钮))]
 */
function makeSidebar({ withAccount = true, rc3 = false, slots = true } = {}) {
  const html = new StubElement('html')
  const head = new StubElement('head')
  const body = new StubElement('body')
  html.appendChild(head)
  html.appendChild(body)

  const root = new StubElement('aside')
  body.appendChild(root)
  // rc.3 起：nav 与"会话列表"被 scrollArea 包在一起，footArea 是它们的外层兄弟。
  const scrollRegion = rc3 ? new StubElement('div') : null
  const scrollArea = rc3 ? new StubElement('div') : null
  if (rc3 && scrollRegion !== null && scrollArea !== null) {
    root.appendChild(scrollRegion)
    scrollRegion.appendChild(scrollArea)
  }

  const nav = new StubElement('nav')
  nav.setAttribute('aria-label', '全局面板')
  const row = new StubElement('button')
  row.setAttribute('aria-label', '插件')
  const glyph = new StubElement('span')
  glyph.setAttribute('aria-hidden', 'true')
  row.appendChild(glyph)
  nav.appendChild(row)
  if (rc3 && scrollArea !== null) scrollArea.appendChild(nav)
  else root.appendChild(nav)

  const region = new StubElement('div')
  // 会话列表这一层在 rc.3 里与 nav 同级（同样住在 scrollArea 里）—— 绝不能被当成底部区。
  const workspaces = new StubElement('div')
  // 真机上 regionArea 里有会话/工作区按钮 —— 桩必须照做，否则"位置兜底"看起来永远安全。
  const sessionButton = new StubElement('button')
  sessionButton.setAttribute('aria-label', '酒馆远程连接')
  workspaces.appendChild(sessionButton)
  region.appendChild(workspaces)
  if (rc3 && scrollArea !== null) scrollArea.appendChild(region)
  else root.appendChild(region)

  const footer = new StubElement('div')
  const actions = new StubElement('div')
  // 第三方插件（@kenz1117/dsh-ui-usage-billing 那种）放在这里的卡片
  const card = new StubElement('div')
  card.setAttribute('data-third-party', 'usage-billing')
  const cardButton = new StubElement('button')
  cardButton.setAttribute('aria-label', '今日消耗金额')
  cardButton.textContent = '今日消耗金额'
  card.appendChild(cardButton)
  actions.appendChild(card)
  footer.appendChild(actions)

  const settings = new StubElement('div')
  if (withAccount) {
    const account = new StubElement('button')
    account.setAttribute('aria-label', '账号菜单')
    account.textContent = '方文'
    settings.appendChild(account)
  }
  footer.appendChild(settings)
  // 两个槽的标记（rc.3 真机上就在 footArea 的两个子 div 里）。
  // slots: false 用来模拟"没有槽标记的宿主"——这时只能靠位置兜底 + 硬保护。
  if (slots) {
    actions.setAttribute('data-slot', 'sidebar.footer.action')
    settings.setAttribute('data-slot', 'sidebar.settings')
    workspaces.setAttribute('data-slot', 'sidebar.workspaces')
  }
  root.appendChild(footer)

  const doc = {
    head,
    body,
    createElement: tag => new StubElement(tag),
    querySelector: selector => html.querySelector(selector),
    querySelectorAll: selector => html.querySelectorAll(selector),
  }
  return { doc, root, nav, footer, card, cardButton, region, workspaces, scrollArea, scrollRegion }
}

console.log('1. 找得到底部区（结构定位，不认哈希类名）')
{
  const { doc, footer } = makeSidebar()
  check('nav 的父节点的最后一个子节点就是底部区', pure.findSidebarFooter(doc) === footer)

  // 没有 nav 时退到"账号菜单按钮往上爬"
  const noNav = makeSidebar()
  noNav.root.children = noNav.root.children.filter(child => child !== noNav.nav)
  check('没有 nav 也能靠账号按钮找到（兜底路径）', pure.findSidebarFooter(noNav.doc) === noNav.footer)
}

console.log('2. 收起：整块藏，且不碰里面任何一个节点')
{
  const { doc, footer, card, cardButton } = makeSidebar()
  const toggles = []
  check('第一次应用返回 true（说明找到了）',
    pure.applyFooterFold(doc, { collapsed: true }, next => toggles.push(next)) === true)
  check('容器被打上 folded（CSS 靠它隐藏）', footer.getAttribute(pure.FOOTER_FOLD_ATTR) === 'folded')
  check('❗第三方卡片与它里面的按钮**一个属性都没被加**（兼容的前提）',
    card.getAttribute(pure.FOOTER_FOLD_ATTR) === null
    && cardButton.getAttribute(pure.FOOTER_FOLD_ATTR) === null
    && card.getAttribute('data-third-party') === 'usage-billing')
  check('❗第三方节点的行内样式没被改（宽度/字号/display 都不动）',
    Object.keys(card.style).length === 0 && Object.keys(cardButton.style).length === 0)

  const head = doc.querySelector(`button[${pure.FOOTER_HEAD_ATTR}]`)
  check('细条插在底部区前面（同一个父节点，位置在它之前）',
    head !== null && head.parentElement === footer.parentElement
    && footer.parentElement.children.indexOf(head) === footer.parentElement.children.indexOf(footer) - 1)
  check('细条文字来自 FOOTER_HEAD_TEXT（0.29.1 起叫「账号与其他」）', pure.FOOTER_HEAD_TEXT === '账号与其他')
  check('细条里有文字 + 一个箭头，且 aria-expanded=false',
    head.children.some(child => child.textContent === '账号与其他')
    && head.children.some(child => child.getAttribute('data-ux-footer-fold-chevron') !== null)
    && head.getAttribute('aria-expanded') === 'false')
  head.onclick()
  check('点细条回调"下一状态 = 展开"', toggles.length === 1 && toggles[0] === false, JSON.stringify(toggles))
}

console.log('3. 展开 / 再收起 / 幂等')
{
  const { doc, footer } = makeSidebar()
  pure.applyFooterFold(doc, { collapsed: false }, () => {})
  check('展开时属性摘掉（容器照常显示）', footer.getAttribute(pure.FOOTER_FOLD_ATTR) === null)
  check('展开时细条仍在，aria-expanded=true',
    doc.querySelector(`button[${pure.FOOTER_HEAD_ATTR}]`).getAttribute('aria-expanded') === 'true')

  pure.applyFooterFold(doc, { collapsed: true }, () => {})
  pure.applyFooterFold(doc, { collapsed: true }, () => {})
  pure.applyFooterFold(doc, { collapsed: true }, () => {})
  const heads = doc.querySelectorAll(`button[${pure.FOOTER_HEAD_ATTR}]`)
  check('❗重复贴三次也只有一条细条（不叠加）', heads.length === 1, String(heads.length))
  check('重复贴之后仍然是 folded', footer.getAttribute(pure.FOOTER_FOLD_ATTR) === 'folded')
}

console.log('4. 找不到底部区时静默不介入')
{
  const html = new StubElement('html')
  const head = new StubElement('head')
  const body = new StubElement('body')
  html.appendChild(head)
  html.appendChild(body)
  const doc = {
    head, body,
    createElement: tag => new StubElement(tag),
    querySelector: selector => html.querySelector(selector),
    querySelectorAll: selector => html.querySelectorAll(selector),
  }
  check('返回 false（界面/自检据此说"没找到"）', pure.applyFooterFold(doc, { collapsed: true }, () => {}) === false)
  check('没有插入任何细条', doc.querySelector(`button[${pure.FOOTER_HEAD_ATTR}]`) === null)
}

console.log('5. 样式表只藏容器，不写任何子选择器')
{
  check('有 folded 规则', pure.FOOTER_FOLD_CSS.includes("[data-ux-footer-fold='folded'] { display: none !important; }"))
  check('❗没有针对子节点的规则（不碰里面的按钮）',
    !/\[data-ux-footer-fold='folded'\][^\n]*>/.test(pure.FOOTER_FOLD_CSS))
}

console.log('7. rc.3 真实结构：绝不能把会话列表当底部区（0.29.5 修）')
{
  // 事故：0.29.0~0.29.4 在 rc.3 上把 regionArea（会话列表）当底部区藏了 —— 用户侧表现就是"会话栏目消失"。
  const rc3 = makeSidebar({ rc3: true })
  check('❗底部区认的是 footArea（含两个插槽的那一层）', pure.findSidebarFooter(rc3.doc) === rc3.footer)
  check('❗会话列表所在层没有被当成底部区',
    pure.findSidebarFooter(rc3.doc) !== rc3.region
    && pure.findSidebarFooter(rc3.doc) !== rc3.scrollArea
    && pure.findSidebarFooter(rc3.doc) !== rc3.scrollRegion)

  pure.applyFooterFold(rc3.doc, { collapsed: true }, () => {})
  check('❗收起后打标记的是 footArea', rc3.footer.getAttribute(pure.FOOTER_FOLD_ATTR) === 'folded')
  check('❗会话列表那层一个属性都没有（这就是回归的判据）',
    rc3.region.getAttribute(pure.FOOTER_FOLD_ATTR) === null
    && rc3.scrollArea.getAttribute(pure.FOOTER_FOLD_ATTR) === null
    && rc3.scrollRegion.getAttribute(pure.FOOTER_FOLD_ATTR) === null)
  check('会话列表里的 workspaces 槽也完好',
    rc3.workspaces.getAttribute('data-slot') === 'sidebar.workspaces'
    && rc3.workspaces.getAttribute(pure.FOOTER_FOLD_ATTR) === null)

  const head = rc3.doc.querySelector(`button[${pure.FOOTER_HEAD_ATTR}]`)
  check('❗「账号与其他」插在 root 下、footArea 之前（不是塞进滚动区）',
    head !== null && head.parentElement === rc3.root,
    head?.parentElement === rc3.root ? 'root' : head?.parentElement?.tagName ?? 'null')

  // 展开后一切复原，会话列表依旧没被动过
  pure.applyFooterFold(rc3.doc, { collapsed: false }, () => {})
  check('展开后 footArea 属性摘掉、会话列表仍未被动',
    rc3.footer.getAttribute(pure.FOOTER_FOLD_ATTR) === null
    && rc3.region.getAttribute(pure.FOOTER_FOLD_ATTR) === null)
}


console.log('6. 展开时缩进账号行右端（0.29.2 用户截图要求），收起时仍是整条')
{
  // 用户 2026-10-29：「这个展开时，把这个账号和其他和收缩按钮放到这个位置」（指方文右侧的空白）。
  const { doc, footer } = makeSidebar()
  const accountArea = footer.lastElementChild

  pure.applyFooterFold(doc, { collapsed: true }, () => {})
  const collapsedHead = doc.querySelector(`button[${pure.FOOTER_HEAD_ATTR}]`)
  check('收起态：细条是底部容器的兄弟节点（在它前面）',
    collapsedHead.parentElement === footer.parentElement, collapsedHead.parentElement?.tagName)
  check('收起态：没有 inline 标记', collapsedHead.getAttribute(pure.FOOTER_HEAD_INLINE_ATTR) === null)

  pure.applyFooterFold(doc, { collapsed: false }, () => {})
  const expandedHead = doc.querySelector(`button[${pure.FOOTER_HEAD_ATTR}]`)
  check('❗展开态：细条被塞进账号那一块（不单独占一行）',
    expandedHead.parentElement === accountArea, expandedHead.parentElement?.tagName)
  check('❗展开态：打上 inline 标记（CSS 靠它做绝对定位）',
    expandedHead.getAttribute(pure.FOOTER_HEAD_INLINE_ATTR) !== null)
  check('❗展开态：账号块被标成已定位（绝对定位的包含块）',
    accountArea.style.position === 'relative', String(accountArea.style.position))
  check('❗展开态：仍然只有这一个按钮（没有在旧位置留一个）',
    doc.querySelectorAll(`button[${pure.FOOTER_HEAD_ATTR}]`).length === 1)

  pure.applyFooterFold(doc, { collapsed: true }, () => {})
  const backHead = doc.querySelector(`button[${pure.FOOTER_HEAD_ATTR}]`)
  check('再收起：回到容器前面，inline 标记摘掉',
    backHead.parentElement === footer.parentElement
    && backHead.getAttribute(pure.FOOTER_HEAD_INLINE_ATTR) === null)
  check('再收起：仍然只有一个按钮', doc.querySelectorAll(`button[${pure.FOOTER_HEAD_ATTR}]`).length === 1)

  check('样式表里有 inline 态规则（绝对定位 + 右端）',
    pure.FOOTER_FOLD_CSS.includes('position: absolute') && pure.FOOTER_FOLD_CSS.includes('right: 6px'))
}

console.log('8. 没有槽标记时：硬保护必须把会话列表挡在外面')
{
  // 现实里别的 DSH 版本/宿主可能不带 data-slot 标记。这时只能按位置兜底 ——
  // 而 rc.3 的位置兜底第一枪就打在 regionArea（会话列表）上，必须靠 forbidden() 挡回去。
  const noSlots = makeSidebar({ rc3: true, slots: false })
  check('❗没有槽标记也认到 footArea', pure.findSidebarFooter(noSlots.doc) === noSlots.footer)
  check('❗位置兜底没有把会话列表当底部区',
    pure.findSidebarFooter(noSlots.doc) !== noSlots.region)

  pure.applyFooterFold(noSlots.doc, { collapsed: true }, () => {})
  check('❗收起后会话列表那层仍然没有任何标记',
    noSlots.region.getAttribute(pure.FOOTER_FOLD_ATTR) === null
    && noSlots.scrollArea.getAttribute(pure.FOOTER_FOLD_ATTR) === null)
  check('收起的是 footArea', noSlots.footer.getAttribute(pure.FOOTER_FOLD_ATTR) === 'folded')
}

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
