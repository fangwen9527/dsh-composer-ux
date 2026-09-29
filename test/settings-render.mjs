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

export function renderWith(mode, notice = '', priceOverrides = undefined, extra = {}) {
  const settings = {
    ...DEFAULT_SETTINGS, menuMode: mode, priceOverrides,
    keysEnabled: true, menuEnabled: true, quickEnabled: true, panelEnabled: true, terminalEnabled: true,
    ...extra,
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
/** 带覆盖价的那一版（「金额」栏要能显示已填的值与自定义行）。
 *  第三方行的价要写进 **offPeak** 那一格：0.10.0 起非 DeepSeek 行只渲染"平坦价"一档，
 *  界面读的就是 offPeak（与 `pricing.ts` 的 `override?.offPeak ?? override?.peak` 一致）。 */
const priced = render('official', '', {
  'deepseek-flash': { peak: { miss: 3 }, offPeak: { out: 4.5 } },
  'my-relay': { offPeak: { miss: 9 } },
})
/** 自定义节假日 + 同步过第三方价目的那一版（标题行概览要把这两件事说出来）。 */
const synced = render('official', '', undefined, {
  peakHolidays: ['2026-10-01', '2026-10-02'],
  syncedPrices: { modelsDevAt: Date.parse('2026-10-01T00:00:00Z'), modelsDevCount: 123 },
})

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

console.log('1. 设置页能真的渲染出来（八张卡都在）')
for (const [mode, source] of Object.entries(html)) {
  const names = ['键位', '右键菜单', '快捷指令', '设置面板', 'OpenCode 请求头', '默认终端', '统计行', '金额']
  const missing = names.filter(name => cardOf(source, name) === '')
  check(`${mode}：八张卡都渲染出来了`, missing.length === 0, missing.join(' / '))
}

console.log('\n1.1 统计行卡：说清"不撒谎"与作用范围，且只有一个开关')
for (const [mode, source] of Object.entries(html)) {
  const card = cardOf(source, '统计行')
  const body = bodyOf(card)
  const text = textOf(body)
  const head = textOf(headerOf(card))
  check(`${mode}：说清"会凑成 100 就继续加位"这条不撒谎规则`,
    text.includes('不撒谎') && text.includes('99.9999%'))
  check(`${mode}：说清口径与官方一致（三个桶）`,
    text.includes('缓存读 ÷（未缓存输入 + 缓存读 + 缓存写）'), text)
  check(`${mode}：说清只改输入框下面那一行（弹窗不动 + 同步无障碍名字）`,
    text.includes('每轮用量弹窗') && text.includes('保持官方原样') && text.includes('无障碍名字'))
  // 0.7.0 早期版本这里还有两个子开关（三位小数 / 加宽统计行）。撤掉加宽之后只剩一个功能，
  // 就不该再有同义的子开关：**开关只能出现在标题行**，卡内只剩说明文字。
  check(`${mode}：卡内没有第二个开关（开关只在标题行）、也没有撤掉的"加宽"字样`,
    !body.includes('role="switch"') && !text.includes('加宽') && !text.includes('260px'), text)
  check(`${mode}：概览行给出位数`,
    head.includes('3 位小数'), head)
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
    && !text.browser.includes('chrome://settings/content/clipboard'),
    text.browser)
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

console.log('\n7. 「金额」卡（0.10.0）：两个内置模型 × 峰谷六格 + 平坦价自定义行 + 节假日/提醒/余额/同步')
{
  const card = cardOf(html.official, '金额')
  const body = bodyOf(card)
  const text = textOf(body)
  const inputs = body.match(/<input[^>]*>/g) ?? []
  /** 单价格子：只有它们带 `单价` 这个无障碍名。 */
  const priceInputs = inputs.filter(input => input.includes('单价'))
  check('渲染出来了，且标题行概览说清"没改价"',
    card !== '' && textOf(headerOf(card)).includes('按官方刊例价估算'), textOf(headerOf(card)))
  check('说清只影响本插件估算、留空＝沿用官方价',
    text.includes('只是本插件显示的费用估算') && text.includes('留空＝沿用官方价'))
  // 0.11.0：这三句从金额胶囊的明细浮层搬进设置页（用户要求"浮层只留数字"），所以在这里钉住。
  // ⚠️ `textOf` 把标签换成 ` | `，所以跨元素断开的句子要拆开查（逐字查整句会假红）。
  check('新增「计价说明」块：刊例价快照日期 + 价格档 + 峰谷判定 + 非 DeepSeek 口径',
    text.includes('计价说明')
    && text.includes('刊例价快照：') && text.includes('2026-09-29')
    && text.includes('按每笔用量') && text.includes('发生时刻') && text.includes('生效的档结算')
    && text.includes('不含法定节假日') && text.includes('全天谷价')
    && text.includes('未含中转加价') && text.includes('实际扣费以各家账单为准'))
  // 0.10.0 的 PRICE_TABLE 只剩两个内置模型（flash / v4-pro），每个两档六格：
  // 12 格单价 + 1 个「新增模型名」+ 峰谷提醒 5 个控件 + 余额开关 1 个 + 自动同步 1 个 = 20。
  check('单价框数 = 2 个内置模型 × 6 格（峰谷两档）', priceInputs.length === 2 * 6, String(priceInputs.length))
  check('输入框总数 = 12 格单价 + 1 个「新增模型名」+ 峰谷提醒 5 个 + 余额开关 1 个 + 自动同步 1 个',
    inputs.length === 2 * 6 + 1 + 5 + 1 + 1, String(inputs.length))
  check('两个内置行都是峰谷两档（各一个「高峰（元 / 1M）」+ 一个「空闲（元 / 1M）」）',
    (body.match(/高峰（元 \/ 1M）/g) ?? []).length === 2
    && (body.match(/空闲（元 \/ 1M）/g) ?? []).length === 2
    && (body.match(/平坦价（元 \/ 1M）/g) ?? []).length === 0)
  check('单价格子 value 是空串（不是 0：留空＝官方价）',
    priceInputs.every(input => input.includes('value=""')) && priceInputs.length === 12,
    priceInputs.map(input => /value="([^"]*)"/.exec(input)?.[1]).join(','))
  // 0.10.0 的 flash 官方价（人民币）：高峰 2 / 0.04 / 8，空闲 1 / 0.02 / 4。
  check('占位提示就是官方新价（flash 高峰 2 / 0.04 / 8，空闲 1 / 0.02 / 4）',
    ['2', '0.04', '8', '1', '0.02', '4'].every(value => body.includes(`placeholder="${value}"`))
    && !body.includes('placeholder="2.05"'),
    (body.match(/placeholder="[^"]*"/g) ?? []).join(','))
  check('两个内置模型各一行都渲染了（v4-flash 已退役、不再单开一行）',
    ['deepseek-flash', 'deepseek-v4-pro'].every(name => text.includes(name))
    && !body.includes('>deepseek-v4-flash<'))
  check('别名写在内置行的说明里（deepseek-chat / deepseek-v4-flash 不该另开一行）',
    text.includes('别名 deepseek-v4-flash') && text.includes('deepseek-chat')
    && !body.includes('>deepseek-chat<'))
  check('有「添加」按钮与模型名输入框', text.includes('添加') && text.includes('再加一个模型'))
  check('内置行的按钮是「恢复官方价」（每行一枚）',
    (text.match(/恢复官方价/g) ?? []).length >= 2)

  // ── 0.10.0 新增的四段：节假日 / 峰谷提醒 / 余额 / 同步（0.11.0 起含节假日获取）────
  check('节假日区：一个 textarea + 保存 / 恢复默认 + 当前生效来源（默认=内置 10 天）',
    (body.match(/<textarea[^>]*>/g) ?? []).length === 1
    && body.includes('aria-label="法定节假日日期表"')
    && text.includes('法定节假日（北京日期，一行一个）')
    && text.includes('保存') && text.includes('恢复默认')
    && text.includes('10 个日期') && text.includes('来源：内置（国务院办公厅 2026 年安排）'))
  // 0.11.0：留空 = 用自动获取那份；文本框里**不该**再预填别的（否则"保存"会把自动那份冻成手填）
  check('0.11.0：节假日文本框默认是空的（留空 = 用自动获取 / 内置），灰字说清这件事',
    /<textarea[^>]*placeholder="留空 = 用自动获取的那份（没取到就用内置）"/.test(body)
    && /<textarea[^>]*>\s*<\/textarea>/.test(body))
  check('0.11.0：没开自动同步时，卡里明说"打开后插件会自己取次年安排"',
    text.includes('打开下面「同步价目」里的自动同步后，插件会自己取次年安排'))
  check('0.11.0：生效日期可以展开看（details/summary，默认收起）',
    body.includes('<details') && text.includes('看当前生效的日期'))
  const boxes = inputs.filter(input => input.includes('type="checkbox"'))
  check('峰谷提醒：4 个复选框（默认 启用/进峰前/离峰前 开、系统通知关）+ 提前量默认 5 分钟',
    boxes.length === 6
    && boxes.some(box => box.includes('aria-label="启用峰谷提醒"') && box.includes('checked'))
    && boxes.some(box => box.includes('aria-label="进入高峰前提醒"') && box.includes('checked'))
    && boxes.some(box => box.includes('aria-label="离开高峰前提醒"') && box.includes('checked'))
    && boxes.some(box => box.includes('aria-label="额外发浏览器通知"') && !box.includes('checked'))
    && /aria-label="提前多少分钟提醒"[^>]*value="5"/.test(body))
  // 0.10.0 后补：自动同步（默认**关** —— 会自己出网的开关不该默认开）；0.11.0 起它**也管节假日**
  check('同步区：自动同步复选框默认关 + 说清两件事的频率',
    boxes.some(box => box.includes('aria-label="自动同步官方价与节假日"') && !box.includes('checked'))
    && text.includes('自动同步（价格每天一次、节假日每 30 天复核）'))
  check('说清"没同步过时用内置快照价"（并带快照日期，免得看着像实时价）',
    text.includes('内置快照价') && /models\.dev 快照 20\d\d-\d\d-\d\d/.test(text))
  check('余额：复选框默认开 + 「刷新」按钮（关掉时禁用）+ 说清 Key 只在宿主半读',
    boxes.some(box => box.includes('aria-label="启用余额查询"') && box.includes('checked'))
    && text.includes('刷新') && text.includes('API Key 只在宿主半读取'))
  check('同步区：三个独立按钮（官方价 / 第三方价目 / 法定节假日），初始都可点',
    text.includes('同步官方价') && text.includes('同步第三方价目') && text.includes('获取法定节假日')
    && (body.match(/<button[^>]*>(同步|获取)[^<]*<\/button>/g) ?? []).every(button => !button.includes('disabled'))
    && text.includes('抓失败不会覆盖本地数据'))
  check('0.11.0：同步区状态行列出"法定节假日上次获取：从没同步过"',
    text.includes('法定节假日上次获取：从没同步过'))
}

console.log('\n7.1 「金额」卡：有覆盖价时（实填值 + 自定义行只一档）')
{
  const card = cardOf(priced, '金额')
  const body = bodyOf(card)
  const text = textOf(body)
  const inputs = body.match(/<input[^>]*>/g) ?? []
  const priceInputs = inputs.filter(input => input.includes('单价'))
  check('概览说清已覆盖几个模型',
    textOf(headerOf(card)).includes('已覆盖 2 个模型的单价'), textOf(headerOf(card)))
  // flash 高峰 miss=3、flash 空闲 out=4.5 都落在 DeepSeek 的两档里；my-relay 的 9 落在**平坦价**
  // 那一格（0.10.0 起第三方行只渲染这一档，界面读的也是 offPeak）。
  check('已填的格子显示为实填值（3 / 4.5 / 9）',
    inputs.some(input => input.includes('value="3"'))
    && inputs.some(input => input.includes('value="4.5"'))
    && inputs.some(input => input.includes('value="9"')),
    priceInputs.map(input => /value="([^"]*)"/.exec(input)?.[1]).join(','))
  check('自定义模型单开一行「平坦价」且只有 3 个格子（没有高峰列）',
    priceInputs.length === 2 * 6 + 3
    && (body.match(/平坦价（元 \/ 1M）/g) ?? []).length === 1
    && body.includes('aria-label="my-relay 平坦 未缓存输入单价"')
    && !body.includes('my-relay 高峰'))
  check('平坦价行不给官方占位（价目表里没有它，认不出会写「未定价」）',
    /aria-label="my-relay 平坦 未缓存输入单价"[^>]*placeholder=""/.test(body))
  check('那行的按钮是「删除」而不是「恢复官方价」（只有内置行才是恢复官方价）',
    text.includes('my-relay') && text.includes('删除')
    && (text.match(/恢复官方价/g) ?? []).length === 2)
}

console.log('\n7.2 「金额」卡：自定义节假日 + 同步过第三方价目时的概览与状态行')
{
  const card = cardOf(synced, '金额')
  const body = bodyOf(card)
  const text = textOf(body)
  const head = textOf(headerOf(card))
  check('标题行概览把"自定义节假日"与"第三方价目条数"都说出来',
    head.includes('自定义节假日 2 天') && head.includes('第三方价目 123 个模型'), head)
  check('节假日区带出当前生效的那份（用户手填，不再是内置）',
    text.includes('2 个日期') && text.includes('你上面填的那份（自定义')
    && body.includes('2026-10-01'))
  check('0.11.0：手填时也如实报告"自动获取那份有 N 个日期，现在不参与"',
    text.includes('自动获取那份有 0 个日期，现在不参与'))
  check('第三方价目同步过之后就报条数，不再写"从没同步过"',
    text.includes('（123 个模型）') && !text.includes('第三方价目上次同步：从没同步过'))
}

console.log('\n7.3 「金额」卡：一个"长期用下来"的非默认设置（覆盖价 + 自定义节假日 + 自动同步开着）')
{
  // 为什么单开一节：前面几节要么用默认值、要么只改一两个字段。真实用户是"一堆字段都被改过"，
  // 而这正是最容易画出问题的地方（某个分支把别人的文案顶掉、或者开关状态没跟设置走）。
  const custom = render('custom', '', {
    'opencode-go:gpt-5.6-luna': { offPeak: { miss: 3, hit: 0.3, out: 12 } },
    'deepseek-flash': { peak: { miss: 9, hit: 0.9, out: 27 } },
    'my-relay': { peak: { miss: 1, hit: 0.1, out: 2 } },
  }, {
    panelWidth: 872,
    panelHeight: 774,
    panelScroll: true,
    panelResize: false,
    menuNative: false,
    terminalMode: 'custom',
    terminalBashPath: 'D:\\Git\\bin\\bash.exe',
    headerEnabled: true,
    headerRoutes: 'opencode\nother',
    statsEnabled: true,
    peakHolidays: ['2026-10-01', '2026-10-02', '2026-10-03'],
    peakAlert: { enabled: true, aheadMinutes: 15, onPeak: true, onOffPeak: false, webNotify: false },
    balanceEnabled: false,
    priceAutoSync: true,
    syncedPrices: { fetchedAt: Date.parse('2026-10-01T00:00:00Z'), eras: [] },
  })
  const card = cardOf(custom, '金额')
  const body = bodyOf(card)
  const text = textOf(body)
  const inputs = body.match(/<input[^>]*>/g) ?? []
  const boxes = inputs.filter(input => input.includes('type="checkbox"'))

  check('卡还在、"金额"这一域各块的关键文案都在',
    text.includes('高峰（元 / 1M）') && text.includes('法定节假日（北京日期，一行一个）')
    && text.includes('峰谷提醒') && text.includes('余额') && text.includes('同步') && text.includes('计价说明'))
  check('自定义节假日带出三行（当前生效 3 天、来源是手填）',
    text.includes('3 个日期') && text.includes('你上面填的那份（自定义')
    && body.includes('2026-10-03'))
  check('自动同步开着时复选框是勾上的（默认那条只验了"默认关"）',
    boxes.some(box => box.includes('aria-label="自动同步官方价与节假日"') && box.includes('checked')))
  check('余额关着时复选框不勾 + 「刷新」按钮禁用',
    boxes.some(box => box.includes('aria-label="启用余额查询"') && !box.includes('checked'))
    && /<button[^>]*disabled[^>]*>刷新<\/button>/.test(body))
  check('提前量跟着设置走（15 分钟，不是默认 5）',
    /aria-label="提前多少分钟提醒"[^>]*value="15"/.test(body))
  check('覆盖价写出的行出现在卡里（含 provider:model 那种键）',
    text.includes('opencode-go:gpt-5.6-luna') && text.includes('my-relay'))
  check('第三方覆盖价那一行是「平坦价」一档（不是峰/谷两档）',
    text.includes('平坦价（元 / 1M）'))
  check('内置行仍然是峰/谷两档', (body.match(/高峰（元 \/ 1M）/g) ?? []).length >= 1)
  check('渲染文本里没有 markdown 记号（沿用浮层那条纪律）', !text.includes('**'))
}

console.log('\n7.4 「金额」卡：自动获取到节假日之后（0.11.0）')
{
  // 没手填、但后台自动取回了一份：概览要报"节假日自动 N 天"，生效行要说清来源与获取时间。
  const auto = render('official', '', undefined, {
    syncedPrices: {
      fetchedAt: Date.parse('2026-10-01T00:00:00Z'),
      holidaysAt: Date.parse('2026-10-02T00:00:00Z'),
      holidays: ['2026-10-01', '2026-10-02', '2027-01-01'],
      holidayYears: [2026, 2027],
    },
  })
  const card = cardOf(auto, '金额')
  const head = textOf(headerOf(card))
  const text = textOf(bodyOf(card))
  const body = bodyOf(card)
  check('概览写出"节假日自动 3 天"（按自动那份算，不是并集后的总数）',
    head.includes('节假日自动 3 天'), head)
  check('没手填时概览不说"自定义节假日"', !head.includes('自定义节假日'), head)
  check('生效行说清来源是自动获取 + 获取时间 + 自动那份有多少天',
    text.includes('自动获取（') && text.includes('共 3 个日期'), text.slice(0, 200))
  check('并集后的天数也写出来（内置 10 ∪ 自动 3 = 11 天）',
    text.includes('与内置表取并集后是 11 个'), (text.match(/与内置表[^）]*）/) ?? [''])[0])
  check('自动那份**不进**手填框（留空才代表"用自动获取的"）',
    /<textarea[^>]*>\s*<\/textarea>/.test(body))
  check('同步状态行写出"已有 2026、2027 年"',
    text.includes('法定节假日上次获取：') && text.includes('（已有 2026、2027 年）'))
  check('自动同步开关没开时仍提示"打开后插件会自己取次年安排"（提示看的是开关，不是有没有数据）',
    text.includes('插件会自己取次年安排'))
  const on = render('official', '', undefined, {
    priceAutoSync: true,
    syncedPrices: { holidaysAt: Date.parse('2026-10-02T00:00:00Z'), holidays: ['2027-01-01'] },
  })
  check('开关打开后这条提示消失',
    !textOf(bodyOf(cardOf(on, '金额'))).includes('插件会自己取次年安排'))
  check('开关打开时同步区那个复选框是勾上的',
    (bodyOf(cardOf(on, '金额')).match(/<input[^>]*aria-label="自动同步官方价与节假日"[^>]*>/g) ?? [])
      .some(tag => tag.includes('checked')))
}

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
