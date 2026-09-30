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
import { DEFAULT_SETTINGS, defaultQuickBook } from '../settings-contract.ts'

const actions = {
  close() {}, insert() {}, optimize() {}, dockInsert() {}, dockRetry() {}, dockCancel() {},
  dockClose() {}, dockDiscard() {}, dockShow() {}, dockEdit() {}, setTier() {}, setInsertMode() {}, addCategory() {},
  addPrompt() {}, movePrompt() {}, reloadBook() {},
}

const anchor = { left: 10, bottom: 20 }

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

/** 造一个"跑完一轮"的结果框（成品 + 两条流水）。 */
export function doneDock() {
  return {
    phase: 'done',
    items: [
      { index: 1, id: 'i1', kind: 'rewrite', text: '把设置页做得好看点', quote: '把那个页面弄好看点', quoteSource: 'user' },
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
const { render, doneDock } = module.exports

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

console.log('1. 默认：面板打开时展开「快捷指令」那一半')
{
  const html = render()
  const text = textOf(html)
  check('面板打开（锚点存在）', html.length > 0)
  check('标题行常露：快捷指令 + 三档档位 + ✨ 优化提示词',
    text.includes('快捷指令') && text.includes('普通') && text.includes('高级') && text.includes('极端')
    && text.includes('优化提示词'))
  check('切换按钮在，且默认是收起态（▸）', html.includes('▸') && html.includes('还没有结果'))
  check('默认渲染的是快捷指令那半：分类标签与条目都在',
    text.includes('默认') && text.includes('把那个页面弄好看点') === false && html.includes('快捷指令'))
  check('默认**不**渲染结果框（两半互斥）',
    !text.includes('插入输入框') && !text.includes('重新优化') && !text.includes('复制'))
}

console.log('2. 有结果框：自动切到「优化提示词」那半，快捷指令收起')
{
  const html = render({ dock: doneDock() })
  const text = textOf(html)
  check('结果框渲染出来了', text.includes('插入输入框') && text.includes('重新优化') && text.includes('复制'))
  check('切换按钮变成展开态（▾）', html.includes('▾') && text.includes('点此回到快捷指令'))
  check('结果框显示阶段用时（秒表不谎报）', text.includes('用时 17.5 秒'))
  check('成品可编辑（textarea 在）', html.includes('<textarea'))
  check('条目流水与依据都在', text.includes('把设置页做得好看点') && text.includes('依据'))
  check('❗两半互斥：这一屏**不**渲染快捷指令列表', !text.includes('＋ 新分类') && !text.includes('点条目'))
}

console.log('3. ❗底部按钮在可滚内容区之外（用户报的"展开后看不到按钮"就是这条）')
{
  const html = render({ dock: doneDock() })
  const buttonsAt = html.indexOf('插入输入框')
  const lastScrollAt = html.lastIndexOf('overflow-y:auto')
  check('三个按钮都在 DOM 里', buttonsAt > 0 && html.includes('重新优化') && html.includes('复制'))
  check('按钮出现在最后一个滚动容器**之后**', lastScrollAt > 0 && buttonsAt > lastScrollAt,
    `按钮@${String(buttonsAt)} / 最后滚动容器@${String(lastScrollAt)}`)
  check('内容区自己滚（有 overflow-y:auto 的容器）', html.includes('overflow-y:auto'))
  check('结果框自己也是弹性列 + 可滚（面板再矮也不裁按钮）',
    html.includes('min-height:0') && html.includes('overflow:hidden'))
}

console.log('4. 优化在跑 / 无结果 / 面板关闭')
{
  const running = render({ dock: { ...doneDock(), phase: 'running', elapsedMs: 0 }, busy: true })
  check('跑的时候自动在优化那半（看得到"取消"）', textOf(running).includes('取消') && running.includes('▾'))
  const empty = render({ panelOpen: false })
  check('锚点为空时整块不渲染', empty === '')
  const manual = render({ dock: null, notice: '写入失败' })
  check('状态提示行常露（两半之外）', textOf(manual).includes('写入失败'))
}

console.log('6. 收起（0.13.2）：✕ 之后结果还在，只是不自动显示')
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
  check('没收起时照旧自动显示结果框（老行为不变）',
    textOf(shown).includes('插入输入框') && shown.includes('\u25be'))
  check('两种 hidden 渲染出的 HTML 不同（不是同一份）', html !== shown)
}

console.log('5. 产物里没有"把两半都渲染出来"的退路')
{
  const html = render({ dock: doneDock() })
  const quickOnly = render()
  check('两种状态渲染出的 HTML 不同（不是同一份）', html !== quickOnly)
  check('有结果框时不会有分类「＋」按钮', !html.includes('＋ 新分类'))
}

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
