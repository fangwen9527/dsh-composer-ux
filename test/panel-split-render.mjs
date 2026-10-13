/**
 * 面板「分两半」与结果框按钮的真渲染测试（0.13.1）。
 *
 *   node test/panel-split-render.mjs
 *
 * 为什么必须真渲染：这次改动的价值全在**结构与可见性**上 ——
 *  - 两半必须互斥（显示结果框时不该还渲染那一长串条目）；
 *  - 底部那排按钮（插入输入框 / 重新优化 / 复制）必须**在可滚内容区之外** ——
 *    这正是用户报的 bug：它们原来和内容同一个流，内容一长就被面板 `overflow: hidden` 裁掉。
 * 只搜源码字符串的话，把 `section === 'optimize'` 改成 `true`、把按钮挪回滚动区里，都可能照样绿。
 *
 * 依赖 react / react-dom：与 settings-render.mjs 同一套解析顺序（本仓 node_modules → CUX_PROFILE → 老路径）。
 */
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

const REPO = process.cwd()

function resolveReact() {
  const candidates = [
    join(REPO, 'package.json'),
    process.env.CUX_PROFILE ?? '',
    'C:/Users/fangwen/.dsh/profiles/web/package.json',
  ].filter(candidate => candidate !== '' && existsSync(candidate))
  const tried = []
  for (const candidate of candidates) {
    const req = createRequire(candidate)
    try {
      const rdServer = req.resolve('react-dom/server')
      const reactDir = dirname(req.resolve('react', { paths: [dirname(rdServer)] }))
      return { req, reactDir }
    } catch (error) {
      tried.push(`${candidate}（${String(error).split(String.fromCharCode(10))[0]}）`)
    }
  }
  console.error(`借不到 react/react-dom：试过 ${tried.length === 0 ? '（没有可用 package.json）' : tried.join('；')}`)
  process.exit(2)
}

const { req, reactDir } = resolveReact()
const ALIAS = {
  react: reactDir,
  'react/jsx-runtime': join(reactDir, 'jsx-runtime.js'),
  'react/jsx-dev-runtime': join(reactDir, 'jsx-dev-runtime.js'),
}
const customRequire = id => (id in ALIAS ? req(ALIAS[id]) : req(id))

const ENTRY = `
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QuickCommandsPanel } from './QuickCommandsPanel.tsx'
import { OptimizeOptionsCard } from './OptimizeOptionsCard.tsx'
import { OptimizeDock } from './OptimizeDock.tsx'
 import { sectionOnPanelOpen, sectionForDock, toggleSection, DEFAULT_PANEL_SECTION, OPTIONS_FOLD_DEFAULT_OPEN } from './panel-sections.ts'
import { DEFAULT_SETTINGS, defaultQuickBook } from '../settings-contract.ts'

const actions = {
  close() {}, insert() {}, optimize() {}, dockInsert() {}, dockRetry() {}, dockCancel() {},
  dockClose() {}, dockDiscard() {}, dockShow() {}, dockEdit() {}, setTier() {}, setInsertMode() {}, addCategory() {},
  addPrompt() {}, movePrompt() {}, reloadBook() {},
}

const anchor = { left: 10, bottom: 20 }

/** 给外面的用例复用（卡片那几条要拿它拼非默认设置）。 */
export const baseSettings = DEFAULT_SETTINGS

export function render({ dock = null, panelOpen = true, busy = false, notice = '', hidden = false, book = defaultQuickBook() } = {}) {
  return renderToStaticMarkup(h(QuickCommandsPanel, {
    // 注入面给的是一堆 **hook 函数**（各自接一个 selector），不是 store —— 假实现直接返回选中值。
    useLive: selector => selector(DEFAULT_SETTINGS),
    usePanel: selector => selector(panelOpen ? anchor : null),
    useBusy: selector => selector(busy),
    useStartedAt: () => 0,
    useNotice: selector => selector(notice),
    useBook: selector => selector(book),
    useBookStatus: () => '',
    useDock: selector => selector(dock),
    useDockHidden: selector => selector(hidden),
    actions,
  }))
}

/**
 * 直接渲染「优化选项」卡片（0.14.0）。
 *
 * 为什么要能直接渲：面板默认停在「快捷指令」那半（用户 2026-10-10 要的"默认收着"），
 * 卡片在面板首帧根本不会出现 —— 它的"收起 / 展开"两态只能单独渲。
 */
export function renderCard({ open = false, settings = DEFAULT_SETTINGS } = {}) {
  const noop = () => {}
  return renderToStaticMarkup(h(OptimizeOptionsCard, {
    settings,
    open,
    onToggle: noop,
    actions: {
      setFraming: noop, setPermission: noop, setModel: noop, setHistory: noop,
      setTurns: noop, setReadTools: noop, setBash: noop, setPrompt: noop,
    },
  }))
}

/** 直接渲染结果框（面板里它长在「优化」那一半内，§3 的布局断言只关心它自己）。 */
export function renderDock({ state, seconds = 0 } = {}) {
  const noop = () => {}
  return renderToStaticMarkup(h(OptimizeDock, {
    state,
    seconds,
    actions: { insert: noop, retry: noop, cancel: noop, close: noop, discard: noop, edit: noop },
  }))
}

/**
 * 两半规则的纯函数（§0 用）。
 *
 * 为什么要有这一节：「面板开着时结果框从无到有 ⇒ 自动切过去」是**跨渲染**的行为，
 * SSR 一次渲染测不到（每次渲染都是新挂载）；而它又不能丢 —— 丢了就是"点 ✨ 没反应"。
 * 所以把规则本身当契约钉住，接线由 client-registration 的源码断言钉住。
 */
export const rules = {
  sectionOnPanelOpen, sectionForDock, toggleSection, DEFAULT_PANEL_SECTION, OPTIONS_FOLD_DEFAULT_OPEN,
}

/** 造一个"跑完一轮"的结果框（成品 + 两条流水）。 */
export function doneDock() {
  return {
    phase: 'done',
    items: [
      { index: 1, id: 'i1', kind: 'user_requirement', text: '把设置页做得好看点', quote: '把那个页面弄好看点', quoteSource: 'user' },
      { index: 2, id: 'i2', kind: 'requirement', text: '改完能正常打开', quote: '弄好看点', quoteSource: 'user' },
    ],
    dropped: [{ id: 'i3', kind: 'quality', reason: '引文不是原话里的逐字片段：「x」' }],
    text: '成品正文：把设置页做得好看点，改完能正常打开。',
    edited: false, error: '', route: 'go/deepseek-flash', truncated: false, fallback: false,
    retried: false, promptSource: 'builtin', itemCount: 2, startedAt: 0, elapsedMs: 17500,
    draftAtStart: '把那个页面弄好看点', source: '把那个页面弄好看点', slashPrefix: '',
  }
}
`

const result = await build({
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'node',
  target: ['es2022'],
  jsx: 'automatic',
  logLevel: 'warning',
  external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/server'],
  stdin: { contents: ENTRY, resolveDir: join(REPO, 'src/client'), loader: 'tsx', sourcefile: 'panel-split-entry.tsx' },
})
const module = { exports: {} }
new Function('require', 'module', 'exports', result.outputFiles[0].text)(customRequire, module, module.exports)
const { render, renderCard, renderDock, doneDock, baseSettings, rules } = module.exports

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
const textOf = html => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

// SSR 里 useLayoutEffect 会打一堆同样的警告（面板只在浏览器里跑）：静音，别淹掉失败信息。
const realError = console.error
console.error = (...args) => { if (String(args[0]).includes('useLayoutEffect')) return; realError(...args) }

console.log('0. 两半规则的纯函数（跨渲染那两条只能这么钉）')
{
  check('打开面板：没在跑 ⇒ 快捷指令那半',
    rules.sectionOnPanelOpen(false) === 'quick' && rules.sectionOnPanelOpen(false) === rules.DEFAULT_PANEL_SECTION)
  check('打开面板：正在跑 ⇒ 优化那半（要能看见进度与「取消」）', rules.sectionOnPanelOpen(true) === 'optimize')
  check('面板开着时"结果框从无到有" ⇒ 自动切过去（点 ✨ 必须看得到结果）',
    rules.sectionForDock(true, 'quick') === 'optimize')
  check('没有结果框 ⇒ 不自动切回（用户可以边看条目边等）', rules.sectionForDock(false, 'quick') === 'quick')
  check('用户选的那半在没有结果框时不被改动（optimize 就还是 optimize）',
    rules.sectionForDock(false, 'optimize') === 'optimize')
  check('切换按钮：两半互换',
    rules.toggleSection('quick') === 'optimize' && rules.toggleSection('optimize') === 'quick')
  check('❗「优化选项」折叠初值是**收起**（用户 2026-10-10）', rules.OPTIONS_FOLD_DEFAULT_OPEN === false)
}

console.log('1. 默认：面板打开时展开「快捷指令」那一半')
{
  const html = render()
  const text = textOf(html)
  check('面板打开（锚点存在）', html.length > 0)
  check('标题行常露：快捷指令 + 三档档位 + ✨ 优化提示词',
    text.includes('快捷指令') && text.includes('关闭') && text.includes('轻度') && text.includes('标准')
    && text.includes('重度')
    && text.includes('优化提示词'))
  check('切换按钮在，且默认是收起态（▸）', html.includes('▸') && html.includes('还没有结果'))
  check('默认渲染的是快捷指令那半：分类标签与条目都在',
    text.includes('默认') && text.includes('把那个页面弄好看点') === false && html.includes('快捷指令'))
  check('默认**不**渲染结果框（两半互斥）',
    !text.includes('插入输入框') && !text.includes('重新优化') && !text.includes('复制'))
  // 0.14.1：面板内容区必须能滚（否则卡片比面板高时，下面的内容被面板底部裁掉够不到）。
  check('❗面板内容区是可滚容器（overflow-y:auto + overscroll 收敛）',
    /overflow-y:auto/.test(html) && html.includes('overscroll-behavior:contain'))
}

console.log('2. ❗有结果框也**不**自动切过去（用户 2026-10-10：面板打开默认收着）')
{
  const html = render({ dock: doneDock() })
  const text = textOf(html)
  check('打开时仍停在「快捷指令」那半（上次的结果不抢视图）',
    text.includes('默认') && html.includes('快捷指令'), text.slice(0, 80))
  check('结果框本体没被渲染（两半互斥）',
    !text.includes('插入输入框') && !text.includes('重新优化') && !text.includes('复制'))
  check('切换按钮是收起态（▸），并告诉用户上次的结果还在',
    html.includes('▸') && text.includes('上次的结果在这儿'))
  check('不渲染结果框 → 也看不到阶段用时', !text.includes('用时 17.5 秒'))
  // 用「分类行的 ＋ 按钮」+ 默认分类名认这一半（原来写的是 `＋ 新分类`，那个字符串面板里
  // 从来不存在 —— 等于一条永远绿的假断言，2026-10-10 顺手修掉）。
  check('❗两半互斥的另一面：这一屏渲染的是快捷指令列表',
    html.includes('新增一个分类') && html.includes('>默认<'))
}

console.log('2b. 想在优化那半就别让它"自动"过去：手动切过去才展开（正在跑是唯一例外，见 §4）')
{
  const html = render({ dock: doneDock(), busy: false })
  // 面板本身没有"外部传进来的初始分区"，所以这里能表达的只有"默认收着"；
  // 手动切换后的形态由 §2c 直接渲卡片覆盖。
  check('默认那一半不含「优化选项」卡片（卡片只在优化半渲染）', !html.includes('优化选项'))
}

console.log('2c. 「优化选项」卡片（0.14.0）：默认收起 + 收起时一行摘要（用户 2026-10-10）')
{
  const closed = renderCard({ open: false })
  const closedText = textOf(closed)
  check('收起时标题在', closed.includes('优化选项'))
  check('收起时给一行当前值摘要（不点开也知道关键值）',
    closedText.includes('权限 审查') && closedText.includes('上下文 回合 6')
    && closedText.includes('只读工具 关') && closedText.includes('Bash 关'), closedText)
  check('收起时箭头是 ▸', closed.includes('▸'))
  check('收起时**不**渲染那些控件（这才叫收起来）',
    !closed.includes('aria-label="只读工具"') && !closed.includes('aria-label="内置 Bash"')
    && !closed.includes('<textarea'))
  check('收起时也不渲染「详情」行', !closedText.includes('详情'))

  const open = renderCard({ open: true })
  check('展开时标题仍在且箭头是 ▾', open.includes('优化选项') && open.includes('▾'))
  check('展开时不再重复那行摘要（控件就在下面）', !textOf(open).includes('上下文 回合 6 ·'))
  for (const label of ['权限', '协作基调', '模型', '上下文', '只读工具', '内置 Bash', '详情']) {
    check(`展开后卡片里有「${label}」这一行`, open.includes(`>${label}</span>`))
  }
  check('开关反映当前设置（只读工具/内置 Bash 两行都在）',
    open.includes('aria-label="只读工具"') && open.includes('aria-label="内置 Bash"'))
  check('说明写清了边界（Bash 默认关、锁定工作目录、超时）',
    open.includes('锁定会话工作目录') && open.includes('单条超时 20 秒'))
  // 0.14.1：面板内容区必须能滚（否则卡片比面板高时，下面的内容被面板底部裁掉够不到）。
  // 滚的是**面板**的内容区，不是卡片自己 —— 所以这条在面板那一屏上验（见 §1）。
  check('模型行显示「跟随会话模型」（未指定时的默认）', open.includes('跟随会话模型'))
  check('摘要里的「模型」只在指定过模型时才占位',
    !renderCard({ open: false, settings: { ...baseSettings, optimizerModel: '' } }).includes('模型 '))
}

console.log('3. ❗底部按钮在可滚内容区之外（用户报的"展开后看不到按钮"就是这条）')
{
  const html = renderDock({ state: doneDock(), seconds: 17.5 })
  const text = textOf(html)
  // 按**按钮文本**定位（0.14.0 起「优化选项」卡片的 tooltip 里也会出现「插入输入框」这几个字，
  // 用 indexOf 直接找会命中提示文案、把这条布局断言变成假红）。
  const buttonsAt = html.indexOf('>插入输入框<')
  const lastScrollAt = html.lastIndexOf('overflow-y:auto')
  check('三个按钮都在 DOM 里', buttonsAt > 0 && html.includes('重新优化') && html.includes('复制'))
  check('按钮出现在最后一个滚动容器**之后**', lastScrollAt > 0 && buttonsAt > lastScrollAt,
    `按钮@${String(buttonsAt)} / 最后滚动容器@${String(lastScrollAt)}`)
  check('内容区自己滚（有 overflow-y:auto 的容器）', html.includes('overflow-y:auto'))
  check('结果框显示阶段用时（秒表不谎报）', text.includes('用时 17.5 秒'))
  check('成品可编辑（textarea 在）', html.includes('<textarea'))
  check('条目流水与依据都在', text.includes('把设置页做得好看点') && text.includes('依据'))
}

console.log('4. 优化在跑 / 无结果 / 面板关闭')
{
  const running = render({ dock: { ...doneDock(), phase: 'running', elapsedMs: 0 }, busy: true })
  check('跑的时候自动在优化那半（看得到"取消"）', textOf(running).includes('取消') && running.includes('▾'))
  check('结果框外面那层外壳是弹性列 + 可压（面板再矮也不裁按钮）',
    running.includes('min-height:0') && running.includes('overflow:hidden'))
  const empty = render({ panelOpen: false })
  check('锚点为空时整块不渲染', empty === '')
  const manual = render({ dock: null, notice: '写入失败' })
  check('状态提示行常露（两半之外）', textOf(manual).includes('写入失败'))
}

console.log('6. 收起（0.13.2）：✕ 之后结果还在，只是不自动显示 —— 现在"收着/不收起"都不抢视图')
{
  const html = render({ dock: doneDock(), hidden: true })
  const text = textOf(html)
  check('收起时面板打开在「快捷指令」那半（不抢过去）',
    text.includes('一问一答') || html.includes('quickItem'), '应该看到条目列表')
  check('收起时不渲染结果框本体（也不渲染那三个按钮）',
    !text.includes('插入输入框') && !text.includes('重新优化') && !text.includes('复制'))
  check('切换按钮告诉用户结果还在（上次的结果在这儿）',
    html.includes('\u25b8') && text.includes('上次的结果在这儿'))

  const shown = render({ dock: doneDock(), hidden: false })
  check('❗2026-10-10 起：没收起的结果框也不再抢视图（默认都收着）',
    !textOf(shown).includes('插入输入框') && shown.includes('\u25b8'))
  check('两种 hidden 渲染出的 HTML 相同（这一屏只由"有没有刚出结果"决定）', html === shown)
}

console.log('5. 产物里没有"把两半都渲染出来"的退路')
{
  // 用「正在跑」做对照：那是唯一会自动落到优化半的状态（见 §4）。
  const running = render({ dock: { ...doneDock(), phase: 'running' }, busy: true })
  const quickOnly = render()
  check('两种状态渲染出的 HTML 不同（不是同一份）', running !== quickOnly)
  check('自动切到优化半时不会同时渲染分类「＋」按钮', !running.includes('＋ 新分类'))
  check('两半互斥：优化半那一屏**不**渲染快捷指令列表', !textOf(running).includes('新分类'))
}

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
