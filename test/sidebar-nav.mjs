/**
 * 左侧「全局面板」折叠（0.27.0）的测试。
 *
 *   node test/sidebar-nav.mjs
 *
 * 这块代码**直接改宿主 DOM**（`nav[aria-label="全局面板"]`），所以三件事必须钉住：
 *   1. **三种形态 × 展开/收起** 的属性映射（写错了用户会看到"设置了但没反应"）；
 *   2. **幂等**：设置一变就重贴一次，重复贴不能贴出两条折叠条（React 重渲染也会触发）；
 *   3. **能干净地退回去**：切到"不折叠"时必须把属性、折叠条、`title` 全部摘掉 ——
 *      否则用户关掉功能后，侧边栏还留着一个"展开全局面板"的假按钮。
 *
 * 测试环境没有浏览器，所以这里写了一个**够用的 DOM 桩**（只实现我们用到的那几个 API）。
 * 这不是在测 DOM 本身，是在测"我们对 DOM 做的那些动作"，桩越薄越不容易自欺。
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
    contents: "export { NAV_FOLD_API_PATH } from './src/settings-contract.ts'\n"
      + "export { NAV_FOLD_CSS, NAV_FOLD_ATTR, NAV_FOLD_HEAD_ATTR, NAV_FOLD_ROW_ATTR, NAV_FOLD_TITLE_ATTR, NAV_FOLD_HEADER_TEXT, applyNavFold, findPanelNav, navFoldAttrOf, splitPanelRows } from './src/client/sidebar-nav.ts'\n",
    resolveDir: process.cwd(), loader: 'ts',
  },
})
const pure = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)

// ── 一个够用的 DOM 桩 ─────────────────────────────────────────────────────────
class StubElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase()
    this.attributes = new Map()
    this.children = []
    this.parentElement = null
    this.textContent = ''
    this.onclick = null
    this.type = ''
    /** 行内样式（图标模式靠 display:none 藏文字）。 */
    this.style = {}
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
  /** 深度优先找所有匹配（只支持 `tag` / `tag[attr]` / `[attr]` / `:scope > tag` 这几种本模块用到的形状）。 */
  querySelectorAll(selector) {
    const direct = selector.startsWith(':scope > ')
    const want = (direct ? selector.slice(':scope > '.length) : selector).trim()
    const match = (element) => {
      const attrMatch = /^([a-z]*)\[([a-z-]+)(?:=['"]?([^'"]*)['"]?)?\]$/.exec(want)
      if (attrMatch !== null) {
        const [, tag, attr, value] = attrMatch
        if (tag !== '' && element.tagName !== tag.toUpperCase()) return false
        if (!element.hasAttribute(attr)) return false
        return value === undefined || element.getAttribute(attr) === value
      }
      const tagOnly = /^[a-z]+$/.exec(want)
      if (tagOnly !== null) return element.tagName === want.toUpperCase()
      return false
    }
    const out = []
    const walk = (element) => {
      for (const child of element.children) {
        if (match(child)) out.push(child)
        if (!direct) walk(child)
        else if (!match(child)) continue
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

function makeDoc({ label = '全局面板', buttons = ['插件', '自动化任务', '上下文洞察', 'MCP连接器', '更多'], foreign = [] } = {}) {
  const html = new StubElement('html')
  const head = new StubElement('head')
  const body = new StubElement('body')
  html.appendChild(head)
  html.appendChild(body)
  const sidebar = new StubElement('div')
  body.appendChild(sidebar)
  const nav = new StubElement('nav')
  if (label !== '') nav.setAttribute('aria-label', label)
  for (const text of buttons) {
    const button = new StubElement('button')
    button.setAttribute('aria-label', text)
    const glyph = new StubElement('span')
    glyph.setAttribute('aria-hidden', 'true')
    // 真宿主的图标是一颗 <svg>：图标模式靠"里面有没有 svg"区分图标与文字，桩必须照做，
    // 否则藏文字那条变异根本咬不住（2026-10-28：变异 SU 就是这么漏的）。
    glyph.appendChild(new StubElement('svg'))
    const title = new StubElement('span')
    title.textContent = text
    button.append(glyph, title)
    nav.appendChild(button)
  }
  // 别的插件往这一组里塞的东西：可能是裸按钮、也可能是包一层的 div。
  for (const item of foreign) {
    if (item.kind === 'button') {
      const button = new StubElement('button')
      button.setAttribute('aria-label', item.label ?? '第三方按钮')
      button.textContent = item.label ?? '第三方按钮'
      nav.appendChild(button)
      continue
    }
    const wrapper = new StubElement('div')
    const inner = new StubElement('button')
    inner.setAttribute('aria-label', item.label ?? '第三方包装按钮')
    inner.textContent = item.label ?? '第三方包装按钮'
    wrapper.appendChild(inner)
    nav.appendChild(wrapper)
  }
  sidebar.appendChild(nav)
  return { doc: { head, body, createElement: tag => new StubElement(tag), querySelector: sel => html.querySelector(sel), querySelectorAll: sel => html.querySelectorAll(sel) }, nav, sidebar }
}

// ═══════════════════════════ 1. 属性映射（纯函数） ═══════════════════════════
console.log('1. 三档形态 × 展开/收起 → 属性值')
{
  check('不折叠 ⇒ 没有属性（等于完全不介入）', pure.navFoldAttrOf({ mode: 'off', collapsed: true }) === null)
  check('收成一条 + 收起 ⇒ bar-collapsed', pure.navFoldAttrOf({ mode: 'bar', collapsed: true }) === 'bar-collapsed')
  check('收成一条 + 展开 ⇒ bar-open', pure.navFoldAttrOf({ mode: 'bar', collapsed: false }) === 'bar-open')
  check('只留图标 ⇒ icons（与收起状态无关）',
    pure.navFoldAttrOf({ mode: 'icons', collapsed: true }) === 'icons'
    && pure.navFoldAttrOf({ mode: 'icons', collapsed: false }) === 'icons')
  check('样式表里两条关键规则都在（藏面板行 / 藏文字），且都限定在我们标出来的行上',
    pure.NAV_FOLD_CSS.includes("[data-ux-nav-fold='bar-collapsed'] > [data-ux-nav-row] { display: none !important; }")
    && pure.NAV_FOLD_CSS.includes("[data-ux-nav-row] > span:not([aria-hidden='true']) { display: none !important; }"))
}

// ═══════════════════════════ 2. 找宿主那一组 ═══════════════════════════
console.log('2. 找「全局面板」组（按 aria-label，不认哈希类名）')
{
  const hit = makeDoc()
  check('按中文无障碍名找到', pure.findPanelNav(hit.doc) === hit.nav)
  const en = makeDoc({ label: 'Global panels' })
  check('英文宿主同样找到', pure.findPanelNav(en.doc) === en.nav)
  const noLabel = makeDoc({ label: '' })
  check('没有无障碍名时按条目文案兜底', pure.findPanelNav(noLabel.doc) === noLabel.nav)
  const empty = makeDoc({ label: '', buttons: [] })
  check('什么都没有 ⇒ null（静默不介入，绝不乱抓一个 nav）', pure.findPanelNav(empty.doc) === null)
}

// ═══════════════════════════ 3. 应用与撤销 ═══════════════════════════
console.log('3. 贴上去 / 撤干净')
{
  const { doc, nav, sidebar } = makeDoc()
  const toggles = []

  check('收成一条 + 收起：返回 true（说明找到了宿主那一组）',
    pure.applyNavFold(doc, { mode: 'bar', collapsed: true }, next => toggles.push(next)) === true)
  check('nav 打上 bar-collapsed（CSS 靠它隐藏）', nav.getAttribute(pure.NAV_FOLD_ATTR) === 'bar-collapsed')
  const head = sidebar.querySelector(`button[${pure.NAV_FOLD_HEAD_ATTR}]`)
  check('折叠条插在 nav 前面（同一父节点，位置在 nav 之前）',
    head !== null && head.parentElement === sidebar && sidebar.children.indexOf(head) === 0)
  check('折叠条里面有「全局面板」文字 + 一个箭头，且 aria-expanded=false',
    head.children.some(child => child.textContent === '全局面板')
    && head.children.some(child => child.getAttribute('data-ux-nav-fold-chevron') !== null)
    && head.getAttribute('aria-expanded') === 'false',
    JSON.stringify(head.children.map(child => child.textContent)))
  check('折叠条文案来自 NAV_FOLD_HEADER_TEXT', pure.NAV_FOLD_HEADER_TEXT === '全局面板')
  head.onclick()
  check('点折叠条回调"下一状态 = 展开"', toggles.length === 1 && toggles[0] === false, JSON.stringify(toggles))

  pure.applyNavFold(doc, { mode: 'bar', collapsed: false }, () => {})
  check('展开后属性变 bar-open（nav 显示出来）', nav.getAttribute(pure.NAV_FOLD_ATTR) === 'bar-open')
  check('展开后折叠条还在，aria-expanded=true',
    sidebar.querySelector(`button[${pure.NAV_FOLD_HEAD_ATTR}]`).getAttribute('aria-expanded') === 'true')

  // 幂等：同一个状态连贴三次，折叠条不能变成三条
  pure.applyNavFold(doc, { mode: 'bar', collapsed: true }, () => {})
  pure.applyNavFold(doc, { mode: 'bar', collapsed: true }, () => {})
  pure.applyNavFold(doc, { mode: 'bar', collapsed: true }, () => {})
  check('❗重复贴三次也只有一条折叠条（设置一变就重贴，不能越贴越多）',
    sidebar.querySelectorAll(`button[${pure.NAV_FOLD_HEAD_ATTR}]`).length === 1,
    String(sidebar.querySelectorAll(`button[${pure.NAV_FOLD_HEAD_ATTR}]`).length))

  // 图标模式：补 title，且不再需要折叠条
  pure.applyNavFold(doc, { mode: 'icons', collapsed: true }, () => {})
  check('图标模式：属性 icons', nav.getAttribute(pure.NAV_FOLD_ATTR) === 'icons')
  check('图标模式：每个条目补上 title（宽侧栏下宿主不挂 Tooltip，悬停要能看到名字）',
    nav.querySelectorAll(`button[${pure.NAV_FOLD_TITLE_ATTR}]`).length === 5,
    String(nav.querySelectorAll(`button[${pure.NAV_FOLD_TITLE_ATTR}]`).length))
  check('图标模式不需要折叠条（那一行本身就是图标）',
    sidebar.querySelector(`button[${pure.NAV_FOLD_HEAD_ATTR}]`) === null)
  const labels = nav.querySelectorAll('button').map(button =>
    [...button.children].filter(child => child.getAttribute('aria-hidden') === null))
  check('❗图标模式：文字那些 span 被藏掉（display:none）',
    labels.every(spans => spans.every(span => span.style.display === 'none')),
    JSON.stringify(labels.map(spans => spans.map(span => span.style.display))))
  const glyphs = nav.querySelectorAll('button').map(button =>
    [...button.children].filter(child => child.getAttribute('aria-hidden') === 'true'))
  check('❗图标模式：图标（含 svg 的那颗）不能被一起藏了',
    glyphs.every(spans => spans.every(span => span.style.display !== 'none')),
    JSON.stringify(glyphs.map(spans => spans.map(span => span.style.display))))

  // 关掉：全撤
  pure.applyNavFold(doc, { mode: 'off', collapsed: true }, () => {})
  check('❗关掉后属性摘干净（否则 CSS 还在藏东西）', nav.getAttribute(pure.NAV_FOLD_ATTR) === null)
  check('❗关掉后 title 也摘干净（不能留一个假的悬停提示）',
    nav.querySelectorAll(`button[${pure.NAV_FOLD_TITLE_ATTR}]`).length === 0)
  check('关掉后折叠条不存在',
    sidebar.querySelector(`button[${pure.NAV_FOLD_HEAD_ATTR}]`) === null)
}

// ═══════════════════════════ 4. 宿主没有那一组时 ═══════════════════════════
console.log('4. 宿主没有那一组：静默不介入')
{
  const { doc, sidebar } = makeDoc({ label: '', buttons: [] })
  check('返回 false（界面/自检据此说"没找到"，而不是假装成功）',
    pure.applyNavFold(doc, { mode: 'bar', collapsed: true }, () => {}) === false)
  check('没有插入任何折叠条', sidebar.querySelector(`button[${pure.NAV_FOLD_HEAD_ATTR}]`) === null)
}

console.log(`\n${passes} passed, ${failures} failed`)
console.log('6. 别人的按钮（0.28.1）：只动认得出的面板行，别的节点一个字不改')
{
  // 宿主渲染的面板行：button + aria-label + aria-hidden 的图标。
  // 别的插件**注册面板**时会得到一模一样的一行 —— 那种跟着折叠没问题（它本来就是这组里的入口）；
  // 而**自己往 DOM 里塞**的节点（裸按钮 / 包一层 div）必须原样保留，否则"兼容所有插件"是空话。
  const withForeign = makeDoc({ foreign: [{ kind: 'button', label: '别的插件的按钮' }, { kind: 'wrap', label: '包在 div 里' }] })
  const split = pure.splitPanelRows(withForeign.nav)
  check('认得出 5 颗面板行', split.rows.length === 5, String(split.rows.length))
  check('别人的两个节点被分到 foreign（裸按钮 + 包装 div）', split.foreign.length === 2, String(split.foreign.length))
  check('只有面板行被打了标记',
    split.rows.every(row => row.getAttribute(pure.NAV_FOLD_ROW_ATTR) !== null)
    && split.foreign.every(node => node.getAttribute(pure.NAV_FOLD_ROW_ATTR) === null))

  pure.applyNavFold(withForeign.doc, { mode: 'bar', collapsed: true }, () => {})
  check('❗收成一条时，别人的节点不被藏掉（它们在 DOM 里、也没被打标记）',
    withForeign.sidebar.querySelectorAll('button').some(button => button.getAttribute('aria-label') === '别的插件的按钮')
    && split.foreign.every(node => node.getAttribute(pure.NAV_FOLD_ROW_ATTR) === null))
  check('❗这一组里有别人的节点时，整只 nav 不隐藏（否则它们跟着消失）',
    withForeign.nav.style.display !== 'none', String(withForeign.nav.style.display))

  const onlyRows = makeDoc()
  pure.applyNavFold(onlyRows.doc, { mode: 'bar', collapsed: true }, () => {})
  check('只有面板行时，整只 nav 照旧收起来（视觉不变）', onlyRows.nav.style.display === 'none')

  pure.applyNavFold(withForeign.doc, { mode: 'icons', collapsed: true }, () => {})
  const foreignLabel = split.foreign[0]
  check('❗图标模式不去压缩别人的按钮（宽度/字号/文字都不碰）',
    foreignLabel.getAttribute(pure.NAV_FOLD_ROW_ATTR) === null
    && foreignLabel.style.fontSize === undefined
    && foreignLabel.style.display === undefined)
  check('图标模式仍然只标面板行',
    split.rows.every(row => row.getAttribute(pure.NAV_FOLD_ROW_ATTR) !== null)
    && split.foreign.every(node => node.getAttribute(pure.NAV_FOLD_ROW_ATTR) === null))

  pure.applyNavFold(withForeign.doc, { mode: 'off', collapsed: true }, () => {})
  check('关掉之后：标记全部摘掉、nav 不再隐藏',
    split.rows.every(row => row.getAttribute(pure.NAV_FOLD_ROW_ATTR) === null)
    && withForeign.nav.style.display !== 'none'
    && withForeign.nav.getAttribute(pure.NAV_FOLD_ATTR) === null,
    JSON.stringify({ rows: split.rows.map(r => r.getAttribute(pure.NAV_FOLD_ROW_ATTR)), display: withForeign.nav.style.display, attr: withForeign.nav.getAttribute(pure.NAV_FOLD_ATTR) }))
}

process.exit(failures === 0 ? 0 : 1)
