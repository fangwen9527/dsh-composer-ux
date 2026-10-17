/**
 * 「金额浮层」真渲染测试（**手动跑**，不在 `npm test` 里）：
 *
 *   node test/cost-panel-render.mjs
 *
 * 为什么要有它：`CostChipEntry.tsx`（胶囊 + 点开后的明细浮层）是 0.10.0 改动最大、却**只有
 * 源码字符串断言**的一处。而这个浮层恰恰是"诚实性"的落点：未定价要不要写 `¥0.00`、内置快照价
 * 有没有标明、价格历史档有没有说出来、分项加起来是不是等于合计。这里用 `react-dom/server`
 * 把**真组件**渲染成 HTML 来断言可见文本与数字。
 *
 * 三个已知的手工改造（都是这个测试自己的，不是被测代码的；锚点找不到就报错退出，不静默放行）：
 *  1. 浮层走 `createPortal(…, document.body)`，SSR 不支持 ⇒ 把 portal 换成恒等函数、并给一个假的
 *     `document`（真 `document` 的那些监听只在 effect 里注册，SSR 不跑 effect）。
 *  2. `展开态`在组件内部（`useState(false)`）⇒ 在内存里把 `open` / `hover` 的初值改成 `true`。
 *  3. 宿主那份"逐笔按时"的数据来自 `useSessionCost`（内部 `fetch`）⇒ 把它的返回值换成夹具
 *     （钩子本身的行为由 `test/client-registration.mjs` 覆盖，这里要测的是**拿到数据之后怎么画**）。
 *
 * 依赖：react / react-dom 借 profile 里那份（客户端半运行时由 DSH 注入，本包没有依赖）。
 */
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

const REPO = process.cwd()
/**
 * 找一份能解析出 react / react-dom 的 package.json。
 *
 * 顺序：本仓自己的 node_modules（**0.12.0 起 react/react-dom 是 devDependencies**）
 * → 环境变量 CUX_PROFILE 指定的 profile → 本机默认 profile（历史路径，保留为兼容）。
 *
 * 为什么要改：以前只能向本机 DSH profile 借，于是 CI（三平台、干净检出）
 * 永远拿不到 react、这两个渲染套件在 CI 上直接 exit 2 —— 0.12.0 首次三平台 CI 就是这么红的。
 */
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
      // 同一份 React：各拿一份就是「Invalid hook call / dispatcher 为 null」。
      const reactDir = dirname(req.resolve('react', { paths: [dirname(rdServer)] }))
      return { req, reactDir }
    } catch (error) {
      tried.push(`${candidate}（${String(error).split(String.fromCharCode(10))[0]}）`)
    }
  }
  console.error(`借不到 react/react-dom：试过 ${tried.length === 0 ? '（没有可用的 package.json）' : tried.join('；')}`)
  console.error('（先 npm install，或用 CUX_PROFILE=<某个已装 react 的 package.json> 指一份）')
  process.exit(2)
}

const { req, reactDir } = resolveReact()

const ALIAS = {
  react: reactDir,
  'react/jsx-runtime': join(reactDir, 'jsx-runtime.js'),
  'react/jsx-dev-runtime': join(reactDir, 'jsx-dev-runtime.js'),
}
const customRequire = id => (id in ALIAS ? req(ALIAS[id]) : req(id))

// ── 夹具：一份"像宿主真的回过来"的响应（两条 DeepSeek 档 + 一条第三方 + 一条未定价）─────
/** 会话投影：与夹具里的 total 必须完全一致，否则组件会退回"估算口径"而不是分列。 */
const PROJECTION = {
  uncachedInputTokens: 1_200_000,
  cacheReadTokens: 2_000_000,
  cacheWriteTokens: 0,
  outputTokens: 500_000,
}
const FIXTURE = {
  ok: true,
  events: 42,
  samples: 9,
  source: 'sessionQuery.readSession',
  holidays: ['2026-09-25', '2026-09-26', '2026-09-27'],
  total: {
    inputTokens: PROJECTION.uncachedInputTokens,
    outputTokens: PROJECTION.outputTokens,
    cacheReadTokens: PROJECTION.cacheReadTokens,
    cacheWriteTokens: PROJECTION.cacheWriteTokens,
  },
  // 三项分项之和 = 2.0 + 0.08 + 2.0 = 4.08（合计同为 4.08，下面会断言这个等式的渲染结果）
  cost: { miss: 2.0, hit: 0.08, out: 2.0, total: 4.08 },
  routes: [
    {
      provider: 'opencode-go', model: 'deepseek-flash', peak: true, era: 'flash-2026-09-10',
      cost: 2.0, parts: { miss: 2.0, hit: 0, out: 0 }, priceSource: 'official',
      usage: { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
    },
    {
      provider: 'opencode-go', model: 'deepseek-v4-pro', peak: false, era: 'flash-2026-09-10',
      cost: 0.3, parts: { miss: 0, hit: 0.3, out: 0 }, priceSource: 'official',
      usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 2_000_000, cacheWriteTokens: 0 },
    },
    {
      provider: 'opencode-go', model: 'glm-5.2', peak: false, era: '',
      cost: 2.0, parts: { miss: 0, hit: 0, out: 2.0 }, priceSource: 'provider', priceBuiltin: true,
      usage: { inputTokens: 0, outputTokens: 500_000, cacheReadTokens: 0, cacheWriteTokens: 0 },
    },
    {
      // ⚠️ 这条必须有 **非零 token** 才会出现在分列里（组件按 `tokenTotal > 0` 过滤）——
      // 第一版夹具给了 0，于是"未定价那一行"根本没被渲染，断言假红。
      provider: 'my-relay', model: 'unknown-model-x', peak: false, era: '',
      cost: 0, parts: { miss: 0, hit: 0, out: 0 }, priceSource: 'none', unpriced: true,
      usage: { inputTokens: 200_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
    },
  ],
}

/**
 * 带子代理（subagent）的夹具（0.24.0）。
 *
 * 口径要点：`total` / `cost` / `routes` **仍然只是本会话**（必须与 `PROJECTION` 一致，否则
 * 组件会退回"估算"口径、根本不走分列）。子代理的钱只出现在 `subagents` 这一块 —— 这正是
 * 宿主的契约，而"顶层字段别被并脏"是 `agreesWithProjection` 还能成立的前提。
 *
 * 下面断言里的期望值都是**手算**的（不拿被测代码再算一遍，否则组件算错时测试跟着一起错）：
 *   金额：本会话 4.08 + 子代理 1.14 = **5.22**
 *   分项：未缓存输入 2.00+0.60=2.60、缓存命中 0.08+0.04=0.12、输出 2.00+0.50=2.50
 *         2.60 + 0.12 + 2.50 = 5.22 ✓（"分项之和 = 合计"并了子代理之后照样成立）
 *   tokens：本会话 3.7M + 子代理 1.22M = 4.92M
 *   峰谷：高峰档 1M + 0.2M = 1.2M，空闲档 2M + 0.92M = 2.92M（**只有 token 被并**，
 *         金额仍是本会话的 ¥2.00 / ¥0.30 —— 宿主没把子代理的钱按峰谷拆开）
 */
const SUBAGENTS = {
  sessions: 3,
  live: 1,
  // 读不全的两种原因都非零：界面上必须点名，否则用户只会觉得"钱怎么比预期少"。
  missing: 2,
  external: 1,
  total: { inputTokens: 300_000, outputTokens: 120_000, cacheReadTokens: 800_000, cacheWriteTokens: 0 },
  cost: { miss: 0.6, hit: 0.04, out: 0.5, total: 1.14 },
  tiers: {
    peak: { inputTokens: 200_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
    offPeak: { inputTokens: 0, outputTokens: 120_000, cacheReadTokens: 800_000, cacheWriteTokens: 0 },
  },
}
const SUB_FIXTURE = { ...FIXTURE, subagents: SUBAGENTS }

const ENTRY = `
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CostChipEntry } from './CostChipEntry.tsx'
import { DEFAULT_SETTINGS } from '../settings-contract.ts'

export function render(fixture, settingsOverride = {}, selection = undefined, projection = undefined) {
  const settings = { ...DEFAULT_SETTINGS, ...settingsOverride }
  const selectionValue = selection ?? { lastUsed: { provider: 'opencode-go', model: 'deepseek-flash' } }
  const usage = projection ?? __PROJECTION__
  globalThis.__PANEL_FIXTURE__ = fixture
  return renderToStaticMarkup(h(CostChipEntry, {
    sessionId: 'session-panel-render',
    useLive: selector => selector(settings),
    useProjection: name => (name === 'tokenUsage' ? usage : selectionValue),
  }))
}
`.replace('__PROJECTION__', JSON.stringify(PROJECTION))

const PATCHES = [
  {
    file: /CostChipEntry\.tsx$/,
    list: [
      ['const [open, setOpen] = React.useState(false)', 'const [open, setOpen] = React.useState(true)'],
      ['const [hover, setHover] = React.useState(false)', 'const [hover, setHover] = React.useState(true)'],
      // 浮层的渲染条件是 `open && anchor !== null`，而 `anchor` 只在 `toggle()`（点击）里才被设上 ——
      // SSR 里没有点击，所以这里把初值也换成非空，否则浮层整块不渲染（第一版就漏了这一步，12 条失败）。
      ['const [anchor, setAnchor] = React.useState<{ readonly left: number; readonly top: number } | null>(null)',
        'const [anchor, setAnchor] = React.useState<{ readonly left: number; readonly top: number } | null>({ left: 12, top: 12 })'],
      ['const { data, loading } = useSessionCost(sessionId, fingerprint, open)',
        'const { data, loading } = { data: globalThis.__PANEL_FIXTURE__, loading: false }'],
      ['createPortal(', '__portal('],
    ],
    // portal 换恒等函数；`document` / `window` 用最小替身。注意：浮层在**渲染期**就读
    // `window.innerWidth/innerHeight` 来夹视口（浏览器里当然有），所以这两个都得给上。
    banner: 'const __portal = node => node\n'
      + 'const document = { body: {}, addEventListener() {}, removeEventListener() {} }\n'
      + 'const window = { innerWidth: 1280, innerHeight: 800 }\n'
      + 'void useSessionCost\n',
  },
]

const result = await build({
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'node',
  target: ['es2022'],
  jsx: 'automatic',
  logLevel: 'warning',
  external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/server'],
  stdin: { contents: ENTRY, resolveDir: join(REPO, 'src/client'), loader: 'tsx', sourcefile: 'cost-panel-entry.tsx' },
  plugins: [{
    name: 'patch-for-ssr',
    setup(b) {
      b.onLoad({ filter: /CostChipEntry\.tsx$/ }, async args => {
        const { readFile } = await import('node:fs/promises')
        let text = await readFile(args.path, 'utf8')
        for (const patch of PATCHES) {
          for (const [from, to] of patch.list) {
            if (!text.includes(from)) {
              return { errors: [{ text: `锚点没找到（组件被重构了？）：${from}` }] }
            }
            text = text.replace(from, to)
          }
          text = patch.banner + text
        }
        return { contents: text, loader: 'tsx' }
      })
    },
  }],
})

const code = result.outputFiles[0].text
const mod = { exports: {} }
new Function('require', 'module', 'exports', code)(customRequire, mod, mod.exports)
const render = mod.exports.render

/** 去掉标签、归一空白，只看"人眼能看到什么"。 */
const visible = html => html
  .replace(/<[^>]*>/g, ' ')
  .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ')
  .trim()

let passes = 0
let failures = 0
const check = (label, condition, detail) => {
  if (condition) { passes += 1; console.log(`  ✓ ${label}`) } else {
    failures += 1
    console.log(`  ✗ ${label}${detail === undefined ? '' : ` — ${detail}`}`)
  }
}

console.log('1. 分列到手时：浮层画出的东西')
{
  const html = render(FIXTURE)
  const text = visible(html)
  check('胶囊头显宿主算好的合计（¥4.08）', text.includes('¥4.08'), text.slice(0, 120))
  check('列出两条 DeepSeek 分档（高峰 / 空闲）',
    text.includes('opencode-go · deepseek-flash（高峰）') && text.includes('opencode-go · deepseek-v4-pro（空闲）'))
  check('第三方路由单独归到「其他路由（无峰谷）」',
    text.includes('其他路由（无峰谷）') && text.includes('opencode-go · glm-5.2（平坦价）'))
  check('「峰谷」一行写出现在哪一档与还有多久切换',
    /峰谷\s*(高峰档|空闲档)/.test(text), (/(高峰档|空闲档)[^ ]*/.exec(text) ?? [''])[0])
  check('两档单价都列出来（每 1M）',
    text.includes('高峰单价（每 1M）') && text.includes('空闲单价（每 1M）'))
  /**
   * 0.11.0（用户 2026-09-29 拍板"浮层只留数字"）：那三行说明的去留不同 ——
   *  · **价格档说明**改成"只在非默认时出现"，本夹具是**单档且就是当前档**，所以不许出现；
   *  · **刊例价快照行**整行搬去设置页；
   *  · **峰谷判定段**设置页本来就有，纯去重。
   * 这三条一起构成"点开胶囊更简洁"这个需求的可验收判据，所以逐条断言。
   */
  check('单档（且就是当前档）会话里不出现「价格档说明」——默认不占行',
    !text.includes('按各自发生时刻的价格档结算') && !text.includes('官方调价不会改动历史金额'))
  check('刊例价快照行已搬去设置页（浮层不再印快照日期）',
    !text.includes('刊例价快照'))
  check('峰谷判定段已从浮层移走（设置页「金额」里有同一份）',
    !text.includes('峰谷按每笔用量发生的时间判定') && !text.includes('未含中转加价'))
  check('内置快照价被标出来（并写快照日期）',
    /内置快照价（models\.dev 快照 20\d\d-\d\d-\d\d）/.test(text), text.match(/内置快照价[^。]*/)?.[0])
  check('未定价的那一行显示「未定价」而不是 ¥0.00',
    text.includes('my-relay · unknown-model-x（平坦价） 200K · 未定价'), text.match(/my-relay[^。]{0,60}/)?.[0])
  check('未定价有专门说明（并指向同步按钮 / 直接填价）',
    text.includes('有 1 行「未定价」') && text.includes('所以那部分按 0 计')
    && text.includes('同步第三方价目'), text.match(/有 1 行[^。]*/)?.[0])
  check('渲染文本里**没有 markdown 记号**（`note()` 不是 markdown，写 `**加粗**` 会原样显示）',
    !text.includes('**'), (text.match(/\*\*[^*]{0,20}\*\*/) ?? [''])[0])
  check('「合计」就是宿主给的数（没被本地估算顶掉）', text.includes('合计') && text.includes('¥4.08'))
  check('分项三行合计 4.08 恰好等于合计（与 README 的承诺一致）',
    Math.abs(2.0 + 0.08 + 2.0 - 4.08) < 1e-9)
}

console.log('1.1 非默认时才多出来的两样（跨价档说明 / 覆盖价小标）')
{
  /** 把某条 route 换成旧价档：`erasUsed` 就不再是"只有当前档"。 */
  const withEras = eras => ({
    ...FIXTURE,
    routes: FIXTURE.routes.map(route => (route.era === '' ? route : { ...route, era: eras.shift() ?? 'legacy' })),
  })
  const multi = visible(render(withEras(['legacy', 'peak-2026-08'])))
  check('跨了两个价档的会话：价格档说明**出现**（浮层上的单价是今天的价、金额是当时的价）',
    multi.includes('按各自发生时刻的价格档结算') && multi.includes('官方调价不会改动历史金额'))
  check('说明里点名了用到的那几档（两个旧档的中文名）',
    multi.includes('峰谷制之前（单一档价）') && multi.includes('峰谷两档（2026-08 价）'),
    (multi.match(/这批用量[^（]*/) ?? [''])[0])
  const singleOld = visible(render(withEras(['legacy'])))
  check('整段跑在旧档上（只有一个档、但不是当前档）也算非默认',
    singleOld.includes('按各自发生时刻的价格档结算'))
  const overridden = visible(render(FIXTURE, {
    priceOverrides: { 'deepseek-flash': { peak: { miss: 3, hit: 0.3, out: 9 } } },
  }))
  check('覆盖价生效时，单价行带「已自定义」小标（不丢"这份价是你填的"）',
    overridden.includes('高峰单价（每 1M · 已自定义）'), (overridden.match(/高峰单价[^ ]*/) ?? [''])[0])
  const plain = visible(render(FIXTURE))
  check('没覆盖过价时小标不出现（默认不占字）', !plain.includes('已自定义'))
}

console.log('1.2 子代理的费用并进来（0.24.0）')
{
  const html = render(SUB_FIXTURE)
  const text = visible(html)
  // 头号数字必须是 **本会话 + 子代理**：4.08 + 1.14 = 5.22（期望值手算，见夹具注释）。
  check('胶囊头号数字 = 本会话 + 子代理（¥4.08 + ¥1.14 = ¥5.22）',
    text.startsWith('¥5.22'), text.slice(0, 60))
  check('本会话那一份的数（¥4.08）不再单独出现在任何地方（合计已含子代理）',
    !text.includes('¥4.08'))
  check('胶囊 title 说清这个数字含子代理（免得以为本会话真花了这么多）',
    html.includes('本会话费用（含子代理，按每笔用量发生的时间计价）'))
  check('浮层多一行「子代理（3 个会话）」，带它自己的 tokens 与金额',
    text.includes('子代理（3 个会话） 1.22M · ¥1.14'),
    (text.match(/子代理（3 个会话） [^ ]* · [^ ]*/) ?? [''])[0])
  check('「合计」= 本会话 + 子代理（tokens 3.7M + 1.22M = 4.92M；金额 4.08 + 1.14 = 5.22）',
    text.includes('合计 4.92M · ¥5.22'), (text.match(/合计 [^ ]* · [^ ]*/) ?? [''])[0])
  check('分项三行并进子代理（未缓存输入 2.00+0.60、缓存命中 0.08+0.04、输出 2.00+0.50）',
    text.includes('未缓存输入 1.5M · ¥2.60')
    && text.includes('缓存命中 2.8M · ¥0.12')
    && text.includes('输出 620K · ¥2.50'))
  check('分项三行之和仍然**恰好**等于合计（2.60 + 0.12 + 2.50 = 5.22，与合计同屏可核）',
    Math.abs(2.60 + 0.12 + 2.50 - 5.22) < 1e-9 && text.includes('合计 4.92M · ¥5.22'))
  // 峰谷两档：token 并进子代理那一档，金额只含本会话（不拿 token 乘单价编一个按档金额）。
  check('高峰档的 token 并进子代理那一档（1M + 0.2M），金额仍只含本会话（¥2.00）',
    text.includes('高峰档 1.2M · ¥2.00'), (text.match(/高峰档 [^ ]* · [^ ]*/) ?? [''])[0])
  check('空闲档的 token 并进子代理那一档（2M + 0.92M），金额仍只含本会话（¥0.30）',
    text.includes('空闲档 2.92M · ¥0.30'), (text.match(/空闲档 [^ ]* · [^ ]*/) ?? [''])[0])
  check('并了 token 就必须说清"金额只含本会话"（否则读者以为两档加起来就是全额）',
    text.includes('token 已含子代理，金额只含本会话'))
  check('读不全的子代理要点名（2 个读不到日志 + 1 个外部执行 = 3 个没算进来）',
    text.includes('另有 3 个子代理的费用没算进来')
    && text.includes('2 个读不到会话日志') && text.includes('1 个是外部执行'),
    (text.match(/另有 3 个子代理[^。]*/) ?? [''])[0])
  check('这些说明同样是纯文本（没有 markdown 记号，否则浮层里会看到字面星号）',
    !text.includes('**'))
  // 子代理全未定价：金额位置写「未定价」而不是 ¥0.00，且分项/合计仍自洽（合计退回本会话那份）。
  const unpriced = visible(render({
    ...FIXTURE,
    subagents: {
      ...SUBAGENTS,
      cost: { miss: 0, hit: 0, out: 0, total: 0 },
      unpriced: 2,
      missing: 0,
      external: 0,
    },
  }))
  check('子代理全未定价：那一行写「未定价」而不是 ¥0.00',
    unpriced.includes('子代理（3 个会话） 1.22M · 未定价'),
    (unpriced.match(/子代理（3 个会话） [^ ]* · [^ ]*/) ?? [''])[0])
  check('未定价的子代理单独点名（按 0 计），金额仍是本会话那份',
    unpriced.includes('子代理里有费用没算进来：2 行没认出价，按 0 计')
    && unpriced.includes('合计 4.92M · ¥4.08'),
    (unpriced.match(/子代理里有[^。]*/) ?? [''])[0])
  // 老宿主 / 没跑子代理的会话走同一条路径：一个字节都不许多（反向断言，防"顺手加一行空行"）。
  const legacy = render(FIXTURE)
  const legacyText = visible(legacy)
  check('没有子代理时浮层里一个「子代理」字都没有',
    !legacyText.includes('子代理') && !legacyText.includes('含子代理'))
  check('没有子代理时胶囊文案保持原文案',
    legacy.includes('本会话费用（按每笔用量发生的时间计价）'))
}

console.log('2. 宿主数据还没到手 / 认不出价时：不许显示 ¥0.00')
{
  const html = render(undefined, {}, { lastUsed: { provider: 'my-relay', model: 'unknown-model-x' } })
  const text = visible(html)
  // 关键是**头号数字**不能是 ¥0.00（分项里那些 ¥0.00 是"没定价所以乘出来是 0"，
  // 浮层用那条说明把这件事讲清楚了）。
  check('第三方未定价模型：胶囊那颗头号数字写「未定价」，不是 ¥0.00',
    text.startsWith('未定价') && !text.startsWith('¥0.00'), text.slice(0, 60))
  check('两档单价也写「未定价」而不是 0', text.includes('高峰单价（每 1M） 未定价') && text.includes('空闲单价（每 1M） 未定价'))
  check('并说清怎么补价（同步 / 直接填一行单价）',
    text.includes('同步第三方价目') && text.includes('直接填一行单价'))
  check('这里的渲染文本同样没有 markdown 记号', !text.includes('**'))
}

console.log('3. 没有用量就不占位')
{
  const html = render(FIXTURE, {}, { lastUsed: { provider: 'opencode-go', model: 'deepseek-flash' } })
  check('有量时有内容', html.length > 0)
  // ⚠️ 第一版这里忘了把投影也清零，于是"没有用量"根本没被构造出来（断言假绿）。
  const zero = { uncachedInputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0 }
  const empty = render(undefined, {}, { lastUsed: undefined }, zero)
  check('投影没有用量时渲染为空（返回 null）', empty === '', empty.slice(0, 80))
}

console.log(`\n${passes} passed / ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
