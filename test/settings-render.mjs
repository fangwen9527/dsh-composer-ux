/**
 * 设置页「真渲染」测试（**手动跑**，不在 `npm test` 里）：
 *
 *   node test/settings-render.mjs
 *
 * 为什么要有这个文件：这套件一直没有 React 渲染器，设置页的版式只能靠"搜源码字符串"来护栏
 * —— 那是最弱的一层（把 `{settings.menuMode === 'custom' && (` 改成 `{true && (` 它照样绿）。
 * 这里用 `react-dom/server` 把设置页**真的渲染成 HTML**，断言可见文本与 DOM 结构：
 * 标题行还有没有第二个入口、三档说明是否互斥、那 7 行条目开关到底在不在「自定义」档里。
 *
 * 依赖：react / react-dom **不在本包的依赖里**（客户端半用平台种子词，运行时由 DSH 注入），
 * 所以这里向 profile 借一份来跑；借不到就直接失败退出（手动测试不许"静默跳过"）。
 * 可用环境变量覆盖 profile 位置：`CUX_PROFILE`（默认 web profile 的 package.json 路径）。
 *
 * ⚠️ 两个已知偏差（都是这个测试自己的，不是被测代码的）：
 *  1. `FoldCard` 的展开状态在组件内部（`useState(false)`），SSR 里点不动 ⇒ 打包时**在内存里**
 *     把那一行改成 `useState(true)`。锚点找不到就直接报错退出（不静默放行）。
 *  2. 断言只看**去掉标签后的可见文本**：三枚胶囊的 `title` 里也带着那三句话，按 HTML 搜会把
 *     悬停提示误当成"说明没互斥"（第一版就误报了 3 项，都是假红）。
 */
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

const REPO = process.cwd()
const PROFILE_PKG = process.env.CUX_PROFILE
  ?? 'C:/Users/fangwen/.dsh/profiles/web/package.json'

const PATCH_FROM = 'const [open, setOpen] = useState(false)'
const PATCH_TO = 'const [open, setOpen] = useState(true)'

if (!existsSync(PROFILE_PKG)) {
  console.error(`借不到 react/react-dom：找不到 ${PROFILE_PKG}`)
  console.error('（用 CUX_PROFILE=<某个已装 react 的 package.json> 指一份）')
  process.exit(2)
}
const req = createRequire(PROFILE_PKG)

/*
 * ⚠️ profile 里有两个 React 副本：`node_modules/react`（顶层那份）与 `react-dom` 内部 peer
 * 真正用的那份（pnpm store 里）。各拿一份就是「Invalid hook call / dispatcher 为 null」。
 * 所以统一按 **react-dom 自己的解析路径**去解析 react，再把这一份喂给产物。
 */
let reactDir
try {
  const rdServer = req.resolve('react-dom/server')
  reactDir = dirname(req.resolve('react', { paths: [dirname(rdServer)] }))
} catch (error) {
  console.error(`借不到 react/react-dom：${String(error)}`)
  process.exit(2)
}
const ALIAS = {
  react: reactDir,
  'react/jsx-runtime': join(reactDir, 'jsx-runtime.js'),
  'react/jsx-dev-runtime': join(reactDir, 'jsx-dev-runtime.js'),
}
const customRequire = id => (id in ALIAS ? req(ALIAS[id]) : req(id))

const ENTRY = `
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SettingsSection } from './SettingsSection.tsx'
import { DEFAULT_SETTINGS, defaultQuickBook } from '../settings-contract.ts'

const actions = {
  setField() {}, clearField() {}, resetAll() {},
  saveBook() {}, reloadBook() {}, resetBook() {}, dismissNotice() {},
}

export function renderWith(mode, notice = '') {
  const settings = {
    ...DEFAULT_SETTINGS, menuMode: mode,
    keysEnabled: true, menuEnabled: true, quickEnabled: true, panelEnabled: true, terminalEnabled: true,
  }
  const book = defaultQuickBook()
  return renderToStaticMarkup(h(SettingsSection, {
    useLive: selector => selector(settings),
    useBook: selector => selector(book),
    useBookStatus: selector => selector(''),
    useWriteNotice: selector => selector(notice),
    actions,
  }))
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
  stdin: { contents: ENTRY, resolveDir: join(REPO, 'src/client'), loader: 'tsx', sourcefile: 'settings-render-entry.tsx' },
  plugins: [{
    name: 'force-fold-open',
    setup(b) {
      b.onLoad({ filter: /SettingsSection\.tsx$/ }, async args => {
        const { readFile } = await import('node:fs/promises')
        const text = await readFile(args.path, 'utf8')
        if (!text.includes(PATCH_FROM)) {
          return { errors: [{ text: `展开态锚点没找到（FoldCard 被重构了？）：${PATCH_FROM}` }] }
        }
        return { contents: text.replace(PATCH_FROM, PATCH_TO), loader: 'tsx' }
      })
    },
  }],
})

const code = result.outputFiles[0].text
const mod = { exports: {} }
// 产物是 CJS：用借来的 require 解析 react / react-dom。
new Function('require', 'module', 'exports', code)(customRequire, mod, mod.exports)
const render = mod.exports.renderWith

const html = {
  official: render('official'),
  browser: render('browser'),
  custom: render('custom'),
}

/** 按 `<span class="dsh-ux-cardName">` 把六张卡切开（比按正文里的字找起点可靠）。 */
function cardOf(source, name) {
  const parts = source.split('<span class="dsh-ux-cardName">')
  const hit = parts.find(part => part.startsWith(`${name}</span>`))
  return hit ?? ''
}
const bodyOf = card => card.slice(card.indexOf('dsh-ux-cardBody'))
const headerOf = card => {
  const cut = card.indexOf('dsh-ux-cardBody')
  const head = cut === -1 ? card : card.slice(0, cut)
  return head.slice(0, head.lastIndexOf('<'))
}
/** 去掉标签后的可见文本（属性里的 title 提示不算可见文本，见文件头偏差 2）。 */
const textOf = part => part
  .replace(/<[^>]*>/g, '\n')
  .split('\n')
  .map(line => line.trim())
  .filter(line => line !== '')
  .join(' | ')

const MENU_ROW_KEYS = [
  '快捷键 Ctrl+Z', '快捷键 Ctrl+Y', '快捷键 Ctrl+X', '快捷键 Ctrl+C', '快捷键 Ctrl+V', '快捷键 Ctrl+A',
]
const MENU_LABELS = ['撤销', '重做', '剪切', '复制', '粘贴', '删除', '全选']

let passes = 0
let failures = 0
function check(name, ok, detail = '') {
  if (ok) passes += 1
  else failures += 1
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail === '' ? '' : ` — ${detail}`}`)
}

console.log('1. 设置页能真的渲染出来（六张卡都在）')
for (const [mode, source] of Object.entries(html)) {
  const names = ['键位', '右键菜单', '快捷指令', '设置面板', 'OpenCode 请求头', '默认终端']
  const missing = names.filter(name => cardOf(source, name) === '')
  check(`${mode}：六张卡都渲染出来了`, missing.length === 0, missing.join(' / '))
}

console.log('\n2. 右键菜单卡的标题行：只剩卡级开关，没有第二个入口')
for (const [mode, source] of Object.entries(html)) {
  const header = headerOf(cardOf(source, '右键菜单'))
  const text = textOf(header)
  check(`${mode}：没有「7 项 ▼」按钮，也没有它那套样式类`,
    !header.includes('dsh-ux-stripButton') && !header.includes('dsh-ux-cardStrip')
    && !text.includes('7 项 ▼') && !text.includes('▲'))
  check(`${mode}：卡级开关在标题行`, header.includes('type="checkbox"') || header.includes('role="switch"'))
  check(`${mode}：概览行仍在（只是一句话，不是控件）`, text.includes('当前：'), text)
}

console.log('\n3. 三档说明互斥：点哪档只显示哪档的正文')
{
  const text = {}
  for (const [mode, source] of Object.entries(html)) text[mode] = textOf(bodyOf(cardOf(source, '右键菜单')))
  check('官方：只有官方那段',
    text.official.includes('本插件完全不介入')
    && !text.official.includes('粘贴免授权、零配置')
    && !text.official.includes('chrome://settings/content/clipboard'))
  check('浏览器：只有浏览器那段',
    text.browser.includes('粘贴免授权、零配置')
    && !text.browser.includes('本插件完全不介入')
    && !text.browser.includes('chrome://settings/content/clipboard'))
  check('自定义：自定义那段 + Chrome/Edge 与 Firefox 的授权说明 + chrome:// 提示',
    text.custom.includes('chrome://settings/content/clipboard')
    && text.custom.includes('Firefox：不允许网页静默读剪贴板')
    && text.custom.includes('about:config')
    && !text.custom.includes('本插件完全不介入')
    && !text.custom.includes('粘贴免授权、零配置'))
  check('三档正文两两不同（互斥渲染确实生效）',
    new Set([text.official, text.browser, text.custom]).size === 3)
  check('标题行下没有重复当前档位的 hint（正文里只剩那一段）',
    !text.browser.includes('固定使用浏览器自带的菜单'))
}

console.log('\n4. 那 7 个条目开关：只在「自定义」档出现')
for (const [mode, source] of Object.entries(html)) {
  const text = textOf(bodyOf(cardOf(source, '右键菜单')))
  const hasRows = MENU_ROW_KEYS.every(key => text.includes(key))
  if (mode === 'custom') {
    check('自定义：7 行都在（标签 + 快捷键 + 全部开启）',
      hasRows && MENU_LABELS.every(label => text.includes(label))
      && text.includes('全部开启') && text.includes('菜单条目'))
  } else {
    check(`${mode}：一行条目开关都没有`, !hasRows && !text.includes('快捷键 Ctrl+') && !text.includes('菜单条目'))
  }
}

console.log('\n5. 写入失败 / 未生效的说明条（0.6.1：点了没反应必须说得出话）')
{
  const clean = render('official')
  check('正常时不渲染说明条',
    !clean.includes('设置未生效') && !clean.includes('dismissNotice'))

  const notice = '写入「enabled」被宿主拒绝。常见原因：profile 的写入锁被占用。'
  const shown = render('official', notice)
  check('有原因时渲染出来，且带上原因原文',
    shown.includes('设置未生效') && shown.includes(notice))
  check('说明条带关闭按钮（知道了）', shown.includes('知道了'))
  check('说明条走的是失败态样式', shown.includes('dsh-ux-restartBannerFailed'))
}

console.log('\n6. 抬头右端：新增的「刷新」按钮（官方桌面版里「重启」不可能生效）')
{
  // 注意：不能用 cardOf('输入体验') —— 那张卡的卡名是 `<h2 class="dsh-ux-cardName">`，
  // 而 cardOf 是按 `<span class="dsh-ux-cardName">` 切片的（其余五张卡都是 span）。
  // 整页找更稳，而且这两枚按钮全页各只有一枚。
  const page = html.official
  const refresh = /<button[^>]*>刷新<\/button>/.exec(page)?.[0] ?? ''
  const restart = /<button[^>]*>重启 DSH<\/button>/.exec(page)?.[0] ?? ''
  // 结构类断言只验"出现过"是最弱的一种（见交接文档 §7.25）：这里既查元素形状、
  // 又查它真的可点，再比它与「重启 DSH」的先后 —— 光加一个按钮、或把它塞到
  // 「重启」后面都应当被判失败。
  check('页面里有「刷新」按钮（真的是 <button>）', refresh !== '')
  check('刷新初始可点（不带 disabled）', refresh !== '' && !refresh.includes('disabled'))
  check('刷新排在「重启 DSH」之前（轻的在前）',
    refresh !== '' && restart !== '' && page.indexOf(refresh) < page.indexOf(restart))
  check('刷新的 title 说清"不重启、不打断会话"',
    refresh.includes('不重启 DSH') && refresh.includes('不打断'))
}

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
