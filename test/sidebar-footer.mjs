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
    contents: "export { FOOTER_FOLD_CSS, FOOTER_FOLD_ATTR, FOOTER_HEAD_ATTR, FOOTER_HEAD_TEXT, applyFooterFold, findSidebarFooter } from './src/client/sidebar-footer.ts'\n",
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
  appendChild(child) { child.parentElement = this; this.children.push(child); return child }
  append(...nodes) { for (const node of nodes) this.appendChild(node) }
  insertBefore(child, before) {
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
  querySelectorAll(selector) {
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
function makeSidebar({ withAccount = true } = {}) {
  const html = new StubElement('html')
  const head = new StubElement('head')
  const body = new StubElement('body')
  html.appendChild(head)
  html.appendChild(body)

  const root = new StubElement('aside')
  body.appendChild(root)

  const nav = new StubElement('nav')
  nav.setAttribute('aria-label', '全局面板')
  const row = new StubElement('button')
  row.setAttribute('aria-label', '插件')
  const glyph = new StubElement('span')
  glyph.setAttribute('aria-hidden', 'true')
  row.appendChild(glyph)
  nav.appendChild(row)
  root.appendChild(nav)

  const region = new StubElement('div')
  root.appendChild(region)

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
  root.appendChild(footer)

  const doc = {
    head,
    body,
    createElement: tag => new StubElement(tag),
    querySelector: selector => html.querySelector(selector),
    querySelectorAll: selector => html.querySelectorAll(selector),
  }
  return { doc, root, nav, footer, card, cardButton }
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
  check('细条文字来自 FOOTER_HEAD_TEXT', pure.FOOTER_HEAD_TEXT === '账号与用量')
  check('细条里有文字 + 一个箭头，且 aria-expanded=false',
    head.children.some(child => child.textContent === '账号与用量')
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

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
