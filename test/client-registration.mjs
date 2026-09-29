/**
 * 客户端半的装配冒烟测试。
 *
 * 直接执行构建产物 lib/client.js（它只是 `window.__ModuleLoader__.load({factory})`
 * 一层壳），用最小的 window / document / React 桩把 `apply(ctx)` 真正跑一遍，
 * 断言它把该注册的槽位都注册了。
 *
 * 为什么值得单独测：客户端半的接线错误（槽位名写错、注入面字段名与组件取用的名字
 * 对不上、effect 里引用了不存在的 API）在构建期完全看不出来 —— esbuild 不做类型检查，
 * 而浏览器里只表现为「按钮不出现」或一条 console 报错。这个测试把它们挡在本地。
 *
 *   node test/client-registration.mjs
 */
import { readFileSync } from 'node:fs'

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

// ── 最小 DOM / React 桩 ─────────────────────────────────────────────────────
const listeners = []
/** 每种事件的**最新**处理函数：拦截器会在设置变化时重装，永远用最后装的那个。 */
const handlers = new Map()

/** 让拦截器里的 `target instanceof Element` 成立。 */
globalThis.Element = class Element {}

/** 假的输入框根节点：closest 只认输入框那个选择器（与拦截器一致）。 */
function makeComposerRoot() {
  return Object.assign(new globalThis.Element(), {
    closest: (selector) => (selector === '[data-composer-input]' ? root : null),
    contains: () => true,
    focus: () => {},
  })
}
const root = makeComposerRoot()

function makeStyleTag() {
  return {
    id: '',
    textContent: '',
    dataset: {},
    setAttribute() {},
    appendChild() {},
    remove() {},
  }
}

globalThis.window = {
  innerWidth: 1440,
  innerHeight: 900,
  addEventListener: (type, handler) => { listeners.push(type); if (typeof handler === 'function') handlers.set(type, handler) },
  removeEventListener: () => {},
  setTimeout: (fn) => setTimeout(fn, 0),
  clearTimeout: (handle) => clearTimeout(handle),
  getSelection: () => null,
  __ModuleLoader__: null,
}

globalThis.document = {
  head: { appendChild() {} },
  documentElement: { classList: { toggle() {}, remove() {}, add() {} } },
  body: {},
  createElement: () => makeStyleTag(),
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener: () => {},
  removeEventListener: () => {},
}

// React 桩：本测试只跑 apply(ctx)，不渲染任何组件，所以只要模块级 import 不炸。
const reactStub = {
  createElement: () => null,
  Fragment: function Fragment() {},
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
  useLayoutEffect: () => {},
  useRef: (initial) => ({ current: initial }),
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn(),
}
const jsxRuntimeStub = { jsx: () => null, jsxs: () => null, Fragment: reactStub.Fragment }

/** 快照店桩：与 dsh-client-store 的 createSnapshotStore 形状一致的最小实现。 */
function createSnapshotStore(initial) {
  let value = initial
  const subscribers = new Set()
  return {
    getSnapshot: () => value,
    set: (next) => {
      value = next
      for (const listener of subscribers) listener(value)
    },
    subscribe: (listener) => {
      subscribers.add(listener)
      return () => { subscribers.delete(listener) }
    },
  }
}

const requireStub = (id) => {
  if (id === 'react') return reactStub
  if (id === 'react/jsx-runtime') return jsxRuntimeStub
  if (id === 'react-dom' || id === 'react-dom/client') return {}
  if (id === '@deepseek-ai/dsh-client-store') return { createSnapshotStore }
  if (id === '@deepseek-ai/dsh-client-ui-slots') return {}
  if (id === '@deepseek-ai/dsh-client-ui-primitives') return {}
  if (id === '@deepseek-ai/cordis') return {}
  throw new Error(`测试桩没有准备这个平台模块：${id}`)
}

// ── 执行产物，取出 factory ──────────────────────────────────────────────────
let moduleExports = null
globalThis.window.__ModuleLoader__ = {
  load: (spec) => {
    if (typeof spec.id !== 'string' || spec.id === '') throw new Error('client bundle 缺少 id')
    moduleExports = spec.factory(requireStub)
  },
}

await import(new URL('../lib/client.js', import.meta.url))
check('产物以 __ModuleLoader__.load 形式发布', moduleExports !== null)
check('导出了 apply', typeof moduleExports.apply === 'function')
check('导出了插件名 composer-ux', moduleExports.name === 'composer-ux', String(moduleExports.name))

// ── 用一个可观测的假 ctx 跑 apply ───────────────────────────────────────────
const registrations = []
const injectedSlotNames = []
const effectLabels = []

const scopeValue = {
  enabled: true,
  quickPrompts: [{ id: 'a', label: '甲', prompt: '内容甲', always: true }],
  optimizerTier: 'extreme',
}
/** 设置变化的订阅者：三档行为测试要靠它把新值推进插件（真实插件就是靠这个 sync）。 */
const settingsSubscribers = new Set()

const settingsScope = {
  bind: () => ({
    getSnapshot: () => ({ status: 'ready', value: scopeValue }),
    subscribe: (listener) => {
      settingsSubscribers.add(listener)
      return () => { settingsSubscribers.delete(listener) }
    },
    set: async () => {},
    unset: async () => {},
    mutate: async () => {},
  }),
}

const slots = {
  // 与真实签名一致：slots.inject(slotName, () => slots.register(meta, Component))
  inject: (slotName, callback) => {
    injectedSlotNames.push(slotName)
    return callback()
  },
  register: (meta, component) => {
    registrations.push({ ...meta, component })
    return () => {}
  },
}

const ctx = {
  slots,
  settingsScope,
  effect: (fn) => {
    effectLabels.push('effect')
    const dispose = fn()
    return () => { if (typeof dispose === 'function') dispose() }
  },
  /**
   * 假的 `ctx.inject`：与 cordis 同语义 —— **依赖全在场才回调，缺席就静默不调**。
   *
   * 本插件用它各等一次 `configForms`（DSH 0.1.7）与 `settingsScope`（0.1.6 及以前），
   * 哪个在场就用哪个（见 src/client.tsx 的 adoptSettings）。这里只备了 settingsScope，
   * 所以走的正是 0.1.6 那条路；0.1.7 那条路由 test/settings-service-adopt.mjs 覆盖。
   */
  inject: (deps, callback) => {
    const view = {}
    for (const name of deps) {
      if (ctx[name] === undefined) return
      view[name] = ctx[name]
    }
    callback(view)
  },
}

moduleExports.apply(ctx)

const byId = (id) => registrations.find(entry => entry.id === id)

console.log('1. 槽位注册')
check('注册了 8 个槽位条目', registrations.length === 8, JSON.stringify(registrations.map(r => r.id)))
check('设置页条目', byId('composer-ux')?.name === 'settings.section')
check('右键菜单浮层', byId('composer-ux-menu')?.name === 'shell.overlay')
check('面板缩放手柄', byId('composer-ux-panel-resize')?.name === 'shell.overlay')
check('优化按钮（0.11.1 新增，与快捷指令同槽）', byId('composer-ux-optimize')?.name === 'conversation.input.right')
check('快捷指令按钮', byId('composer-ux-quick')?.name === 'conversation.input.right')
check('快捷指令面板', byId('composer-ux-quick-panel')?.name === 'shell.overlay')
check('统计行隐形条目', byId('composer-ux-stats-line')?.name === 'conversation.composer.dock')
check('金额胶囊条目', byId('composer-ux-cost')?.name === 'conversation.composer.dock')
check('每个条目都带组件', registrations.every(entry => typeof entry.component === 'function'))

console.log('2. 按钮与「展开」同排（order 89 < 官方的 90）')
check('按钮 order = 89', byId('composer-ux-quick')?.order === 89, String(byId('composer-ux-quick')?.order))
check('按钮带标签（便于导航投影）', byId('composer-ux-quick')?.label === '快捷指令')

console.log('2.0 优化按钮：排在快捷指令左侧（88 < 89 < 官方展开的 90）')
{
  const optimize = byId('composer-ux-optimize')
  check('order = 88（在快捷指令按钮左侧）', optimize?.order === 88, String(optimize?.order))
  check('排在快捷指令之前',
    (optimize?.order ?? 99) < (byId('composer-ux-quick')?.order ?? -1),
    `${String(optimize?.order)} vs ${String(byId('composer-ux-quick')?.order)}`)
  check('标签便于导航投影', optimize?.label === '优化提示词')
  const injected = optimize?.inject()
  check('拿到 openAndOptimize 动作', typeof injected?.actions?.openAndOptimize === 'function')
  check('拿到 busy 与 startedAt（秒表读数）',
    typeof injected?.hooks?.busy?.getSnapshot === 'function'
    && typeof injected?.hooks?.startedAt?.getSnapshot === 'function')
  check('拿到设置快照（跟随「快捷指令」开关）',
    typeof injected?.hooks?.live?.getSnapshot === 'function')
}

console.log('2.0b 优化流程的三处护栏（0.11.1）')
{
  // 这三条是**行为契约**，而它们在 node 里跑不到（要走真浏览器与真模型），所以按
  // 源码文本钉住：谁把它们删了，这里就红。注释先剥掉，免得注释里的说明把判据蒙过去。
  const strip = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const source = strip(readFileSync('src/client.tsx', 'utf8'))
  const panel = strip(readFileSync('src/client/QuickCommandsPanel.tsx', 'utf8'))
  const button = strip(readFileSync('src/client/OptimizeButton.tsx', 'utf8'))

  // 0.12.0 起"写回"不再发生在优化回调里，而是用户点「插入输入框」时由 dockInsert 决定：
  // 判定本身是纯函数（insertDecision，在 optimize-dock.ts 里单测），这里钉住接线与判据。
  check('插入前比对草稿（飞行期间用户改了字就先要一次确认）',
    source.includes('insertDecision(state, currentDraft(), insertConfirmed)'))
  check('「先问一次」是两步确认，不是静默覆盖',
    source.includes('再点一次「插入输入框」就覆盖它'))
  check('写回时把斜杠命令前缀拼回',
    source.includes('replaceDraft(composeOptimizedDraft(state.slashPrefix, state.text))'))
  check('斜杠命令：只把正文送去优化',
    source.includes("const source = slash.prefix === '' ? draft : slash.body"))
  check('只有命令没正文 → 提示且不发请求', source.includes('后面没有正文'))
  // 这条曾经写成"数一数 optimizeStartedAt.set( 出现 3 次"——计数对**参数**不敏感，
  // 变异 CV（把真实起点换成 0）照样能过。所以拆开：起点必须是**真时刻**、
  // 收尾必须逐条清 0（成功 / 失败 / 取消三条路各一条）。
  check('秒表起点写的是发起时的真实时刻（不是 0）',
    source.includes('optimizeStartedAt.set(startedAt)'))
  check('秒表收尾：成功、失败、取消三条路都清 0',
    (source.match(/optimizeStartedAt\.set\(0\)/g) ?? []).length === 3,
    String((source.match(/optimizeStartedAt\.set\(0\)/g) ?? []).length))
  check('独立按钮与面板显示同一个秒表读数（两处文案一致）',
    button.includes('优化中…（${String(seconds)}s）') && panel.includes('优化中…（${String(seconds)}s）'))
  check('没在跑时不起计时器（读数回到 0）', button.includes('useOptimizeElapsed(busy ? startedAt : 0)')
    && panel.includes('useOptimizeElapsed(busy ? startedAt : 0)'))
  check('独立按钮点击 = 开面板 + 立刻开跑', source.includes('openAndOptimize: (anchor: QuickPanelAnchor)'))
}

console.log('2.0c 结果框接线（0.12.0）')
{
  const strip = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const source = strip(readFileSync('src/client.tsx', 'utf8'))
  const panel = strip(readFileSync('src/client/QuickCommandsPanel.tsx', 'utf8'))
  const dockSource = strip(readFileSync('src/client/OptimizeDock.tsx', 'utf8'))

  check('跑优化走的是流式传输（逐条回调进结果框）',
    source.includes('optimizeDraftStream(input.source') && source.includes("type: 'item'") && source.includes("type: 'dropped'"))
  check('取消会真的中止这一轮（abort 交给宿主 res.on(close) 收尾）',
    source.includes('optimizeAbort?.abort()'))
  check('被取消/被新一轮替换的回调不再写状态（否则会把"已取消"覆盖成失败）',
    source.includes('if (controller.signal.aborted) return'))
  check('重新优化用的是框里那一轮的原文（不是输入框现在的内文）',
    /startOptimize\(\{[^}]*source: state\.source/s.test(source))
  check('记忆链：接着改时把上一轮成品一起给（门槛在 previousForChain 里，纯函数单测）',
    source.includes('previousForChain(dock.getSnapshot(), source)'))
  check('记忆链：框里手改过才带上一轮成品（同文重跑不带）',
    /previous: state\.edited \? state\.text : ''/.test(source))
  // 这条要卡住的是"Esc 在跑的时候**中止**而不是关面板"这个分支本身 —— 只查 `dockCancel()`
  // 出现过是不够的：把整段包进 `if (false)` 也照样出现（变异 CY 就是这么干的）。
  check('取消时面板不关（只是中止等待）',
    /if \(dockRunning\) \{\s+actions\.dockCancel\(\)/.test(panel) && panel.includes('dockRunning'))
  check('面板把结果框与五个动作都注入了',
    panel.includes('<OptimizeDock') && panel.includes('insert: actions.dockInsert')
    && panel.includes('retry: actions.dockRetry') && panel.includes('cancel: actions.dockCancel')
    && panel.includes('close: actions.dockClose') && panel.includes('edit: actions.dockEdit'))
  check('结果框：成品可编辑（textarea 绑到 edit 动作）',
    dockSource.includes('aria-label="优化后的提示词（可编辑）"') && dockSource.includes('actions.edit(event.target.value)'))
  check('结果框：没有成品时「插入输入框」点不动',
    dockSource.includes('const canInsert = state.phase === \'done\' && hasText'))
  check('结果框：跑的时候给的是「取消」，不是「关闭」',
    dockSource.includes("running\n          ? (") && dockSource.includes('onClick={actions.cancel}'))
  check('结果框：复制失败不谎报"已复制"', dockSource.includes('if (!ok) return'))
  check('结果框：每条流水都显示依据（不冒充用户说过的话）',
    dockSource.includes('模型自己补的，依据不是你原话'))
}

console.log('2.0d 字段常量必须真的 import 进来（typecheck 抓到的运行时 ReferenceError）')
{
  /**
   * 从源码里收出"import 进来的名字"与"文件里定义的名字"。
   * 只扫 `import { … } from '…'` 块 + `const/let NAME =`，够用且不依赖解析器。
   */
  const importedNamesOf = text => {
    const names = new Set()
    for (const match of text.matchAll(/import\s+(?:type\s+)?\{([\s\S]*?)\}\s+from\s+'[^']+'/g)) {
      for (const raw of match[1].split(',')) {
        const name = raw.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop()?.trim() ?? ''
        if (name !== '') names.add(name)
      }
    }
    return names
  }
  const definedNamesOf = text => new Set([...text.matchAll(/(?:const|let|function)\s+([A-Za-z_$][\w$]*)/g)].map(m => m[1]))
  const strip = text => text.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
    .filter(line => !/^\s*\/\//.test(line)).join('\n')

  for (const file of ['src/client.tsx', 'src/client/SettingsSection.tsx', 'src/client/CostCard.tsx', 'src/host.ts']) {
    const text = strip(readFileSync(file, 'utf8'))
    const imported = importedNamesOf(text)
    const defined = definedNamesOf(text)
    const used = new Set(text.match(/\b[A-Z][A-Z0-9_]*_(?:FIELD|PATH)\b/g) ?? [])
    const missing = [...used].filter(name => !imported.has(name) && !defined.has(name))
    // 这条就是 0.12.0 引入 typecheck 时抓到的那个真 bug：`PRICE_AUTO_SYNC_FIELD` 没被 import，
    // 于是设置页「恢复默认」一点就 ReferenceError（界面上表现为"点了没反应"），而 18 套件全绿
    // —— 因为没有一条用例走过那条路径。类型检查能看见它，测试看不见，所以这里补一条静态护栏。
    check(`${file}：用到的字段常量都 import/定义过`, missing.length === 0, missing.join(', '))
  }
}

console.log('2.0e 非浏览器环境下的健壮性（Node 20 没有全局 navigator）')
{
  const strip = text => text.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
    .filter(line => !/^\s*\/\//.test(line)).join('\n')
  const interceptors = strip(readFileSync('src/client/interceptors.ts', 'utf8'))
  // Node 22 才把 `navigator`（连剪贴板）补成全局；Node 20 及更早读它就是 ReferenceError。
  // 0.12.0 三平台 CI 里三个平台**同时**在测试步骤崩掉，就是 `prefetchClipboard` 直接读
  // `navigator.clipboard` —— 这条护栏让它在默认（Node 24）本地跑里也能被挡住。
  check('预读剪贴板前先判 navigator 存在',
    /function prefetchClipboard[\s\S]{0,500}?typeof navigator === 'undefined'/.test(interceptors))
  check('剪贴板粘贴路径同样先判环境',
    interceptors.includes("typeof navigator === 'undefined' || navigator.clipboard === undefined"))
}

console.log('2.1 统计行条目：自己的 id、排在官方 stats 之后')
{
  const stats = byId('composer-ux-stats-line')
  // 官方那颗统计胶囊的 id 就叫 `stats`。槽位契约写明"复用别人的 id 会顶替掉那一格"，
  // 顶替 = 把官方统计胶囊整块换掉 —— 那正是本插件不要的，所以 id 必须是自己的。
  check('用自己的 id，不占官方 stats 那一格',
    stats?.id === 'composer-ux-stats-line' && stats?.id !== 'stats')
  check('order 99 排在官方 stats（order 0）之后',
    stats?.order === 99 && stats.order > 0, String(stats?.order))
  check('拿到设置快照钩子（三项开关都在设置里）',
    typeof stats?.inject().hooks.live?.getSnapshot === 'function')
}

console.log('2.2 金额条目：自己的 id、排在统计行之后')
{
  const cost = byId('composer-ux-cost')
  // 与统计行同一条槽位契约：复用官方 `stats` 的 id 会顶替那一格，所以金额也必须是自己的 id。
  check('用自己的 id，不占官方 stats 那一格',
    cost?.id === 'composer-ux-cost' && cost?.id !== 'stats')
  check('order 100 排在「统计行」（99）与官方 stats（0）之后',
    cost?.order === 100 && cost.order > (byId('composer-ux-stats-line')?.order ?? -1),
    String(cost?.order))
  check('标签便于导航投影', cost?.label === '金额')
  check('拿到设置快照钩子', typeof cost?.inject().hooks.live?.getSnapshot === 'function')
  // 金额必须与统计行读**同一份**官方投影，否则两个数字不同源（一个来自 tokenUsage，另一个
  // 自己抓一遍 DOM 或日志）。这条钉住"只在官方投影上算钱"。剥掉注释再查，免得注释里的说明
  // 把这条判据蒙过去（第 10 节那条 `codeOf` 是块内局部的，这里就地剥一次）。
  const costSource = readFileSync('src/client/CostChipEntry.tsx', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  check('金额只读官方投影 tokenUsage / modelSelection',
    costSource.includes("project('tokenUsage')") && costSource.includes("project('modelSelection')"))
  // 判据原本是 `/miss:\s*\d/`，2026-09-28 加了"分列三个分项求和"之后被误伤：
  // 那里的 `{ miss: 0, hit: 0, out: 0 }` 是**累加器初值**，不是单价。所以收紧成"带小数点的
  // 单价字面量"（`miss: 1.02` 那种），并额外禁掉官方价目表里的具体数字。
  check('金额不在客户端硬编码价目表（价目表只有 src/pricing.ts 一份）',
    !/miss:\s*\d+\.\d/.test(costSource)
    && !/\b(?:1\.02|0\.02|4\.09|2\.05|8\.18)\b/.test(costSource)
    && costSource.includes("from '../pricing.ts'"))
  // 2026-09-28 真机踩过：客户端投影的未缓存输入叫 `uncachedInputTokens`、日志里叫 `inputTokens`，
  // 只认一个就会把未缓存输入读成 0（命中率 100% + 金额少算）。这条钉住"两个名字都认"。
  check('未缓存输入两个键名都认（pricing 层统一处理）',
    readFileSync('src/pricing.ts', 'utf8').includes('uncachedInputTokens'))
  check('金额面板不吃等宽字体（与旁边官方胶囊同为 UI 字体：StatsPills 是 font: inherit）',
    !costSource.includes('--ds-font-family-code'))
  // 2026-09-28 第二次真机反馈："插件输入框下方的字比旁边官方胶囊大"。原因是官方那颗胶囊的
  // **字号在 `.root` 上**（`calc(var(--dsh-content-font-size-secondary, 13px) - 1px)`），
  // `.pill` 里的 `font: inherit` 只是抵消 button 的 UA 字体；本条目是同槽位的另一条记录，
  // 不在那颗 `.root` 里，只写 `font: inherit` 就会继承输入框那一层（默认 14px）。
  // 所以必须显式写上官方 `.root` 的字号与行高，且不能再用 `font:` 简写（简写会把它重置回继承）。
  check('胶囊字号照抄官方 .root（不是继承输入框那一层）',
    costSource.includes('calc(var(--dsh-content-font-size-secondary, 13px) - 1px)'))
  check('胶囊行高照抄官方 .root',
    costSource.includes('calc(20px + var(--dsh-content-font-delta-secondary, 0px))'))
  check('不再用 font: 简写（简写会把字号重置回继承）',
    !costSource.includes("font: 'inherit'"))
  // 「按 route 分列」只能由宿主半给（session.events 客户端读不到），所以客户端必须
  // **按 sessionId 去问那条路由**（0.9.1 起抽成了 `session-cost.ts`：折叠态胶囊也要这个数字，
  // 而且它得跟着流式用量节流刷新，所以不能只写在"点开"那条路上）。
  const costFetchSource = readFileSync('src/client/session-cost.ts', 'utf8')
  check('按 sessionId 向宿主半取费用',
    costFetchSource.includes('USAGE_API_PATH') && costFetchSource.includes('encodeURIComponent(sessionId)'))
  check('折叠态也走这条取数（把 sessionId 与用量指纹交给它）',
    costSource.includes('useSessionCost(sessionId') && costSource.includes('fingerprint'))
  check('总额用宿主半算好的那份（分列之和在宿主半成立）',
    costSource.includes('data?.cost?.total') && costSource.includes('useBreakdown'))
  check('逐笔准时看得见：面板按高峰/空闲两档分列',
    costSource.includes('高峰档') && costSource.includes('空闲档'))
  // 0.10.0：客户端自己算的只有"现在这一档"（`peak-alert.ts` 的 `peakPhaseAt`，用来写那行提醒），
  // **逐笔用量的档位**仍然只能来自宿主半（`isPeakAt` 按每条事件自己的时间判）—— 面板里
  // 「高峰档 / 空闲档」两行读的是 `route.peak`，不是客户端重算的。两条一起钉住才不会
  // 让后来的人以为"客户端既然会算相位，那也能算档位"。
  const hostSource = readFileSync('src/host.ts', 'utf8')
  check('逐笔档位仍由宿主半按事件时间判定（客户端只读 route.peak，不自己重构时间线）',
    !costSource.includes('isPeakAt')
    && costSource.includes('route.peak === true')
    && hostSource.includes('isPeakAt(at, { holidays: moneyRules.holidays })'))
  check('峰谷提醒的相位规则与宿主半同源（节假日表由宿主半回给客户端）',
    costSource.includes('usePeakAlert(settings, data?.holidays ?? settings.peakHolidays')
    && readFileSync('src/client/peak-alert.ts', 'utf8').includes('peakPhaseAt(Date.now()')
    && hostSource.includes('holidays: moneyRules.holidays'))
  check('分列与投影对不上时退回投影口径并说明', costSource.includes('agreesWithProjection'))
  // 2026-09-28 命中率显示 100%（旁边官方胶囊 98.206%）的**真因**：`billedInputTokens()` 只认
  // `uncachedInputTokens`，调用处却传了 `inputTokens` → 分母丢掉整块未缓存输入 → 恒 100%。
  // 这两条同时钉住"调用处键名对"与"和输入框下面那一行同一套函数"。
  check('计费输入的分母用官方键名 uncachedInputTokens（踩过一次的坑）',
    costSource.includes('uncachedInputTokens: view.miss'))
  check('命中率与输入框下面那一行同一套函数（cacheHitText）',
    costSource.includes('cacheHitText(') && costSource.includes("from './stats-line.ts'"))

  // ── 0.10.0：明细页新增的几行（平坦价 / 峰谷提醒 / 其他路由 / 未定价 / 价格档）──────
  check('第三方 route 行的档位标签是「（平坦价）」（不再给它摆假的峰/谷两档）',
    costSource.includes("'（平坦价）'") && costSource.includes("route.peak ? '（高峰）' : '（空闲）'"))
  check('明细页有「峰谷」一行，文案来自 peak-alert 的 peakNoticeText',
    costSource.includes("detail('峰谷', peakText)") && costSource.includes("from './peak-alert.ts'")
    && costSource.includes('const { text: peakText } = usePeakAlert('))
  check('第三方路由单列一行「其他路由（无峰谷）」小计',
    costSource.includes("detail('其他路由（无峰谷）'"))
  check('未定价的 route 金额位置写「未定价」，不写 ¥0.00',
    costSource.includes("route.unpriced ? '未定价' : formatMoney(route.cost)")
    && costSource.includes("viewUnpriced ? '未定价' : formatMoney(view.total)"))
  check('有未定价行时写明少算了哪部分、怎么补价',
    costSource.includes('「未定价」：那是非 DeepSeek 模型')
    && costSource.includes('同步第三方价目')
    // `note()` 是纯文本渲染：以前这里写的是 markdown 的 `**未定价**`，界面上会显示字面星号
    // （2026-09-29 的真渲染测试抓到，见 test/cost-panel-render.mjs）。旧断言把那个 bug 焊死了。
    && !costSource.includes('行**未定价**'))
  check('价格档来自宿主半给的 era，并说明"官方调价不改历史金额"',
    costSource.includes("era: typeof route.era === 'string' ? route.era : ''")
    && costSource.includes("route.deepseek && route.era !== ''")
    && costSource.includes('这批用量按各自发生时刻的价格档结算'))
}

console.log('2.3 宿主半取数（session-cost）：0.10.0 多回的字段')
{
  const fetchSource = readFileSync('src/client/session-cost.ts', 'utf8')
  // 「金额是 0」与「认不出价」是两回事：前者是算出来就是 0，后者界面必须写"未定价"。
  // 所以 unpriced 必须是单独一位，不能靠 cost === 0 反推。
  check('route 行带回价格档 / 生效单价 / 单价来源 / 是否被覆盖 / 是否未定价',
    ['era', 'price', 'priceSource', 'overridden', 'unpriced'].every(field =>
      new RegExp(`readonly ${field}\\??:`).test(fetchSource)))
  check('响应带回宿主半生效的节假日表（客户端算提醒用的是同一份规则）',
    /readonly holidays\?: readonly string\[\]/.test(fetchSource))
  check('单价来源是四个白名单取值（official / override / provider / none）',
    fetchSource.includes('`official` / `override` / `provider` / `none`'))
}

console.log('3. 只注册到真实存在的槽位名')
const knownSlots = new Set([
  'settings.section', 'shell.overlay', 'conversation.input.right', 'conversation.composer.dock',
])
check(
  '槽位名都在白名单里',
  injectedSlotNames.every(name => knownSlots.has(name)),
  injectedSlotNames.join(','),
)

console.log('4. 输入框拦截器真的挂上了')
check('注册了 keydown 捕获监听', listeners.includes('keydown'), listeners.join(','))
check('注册了 contextmenu 捕获监听', listeners.includes('contextmenu'), listeners.join(','))
check('注册了 click 捕获监听（官方发送按钮那一路）', listeners.includes('click'), listeners.join(','))

console.log('5. 设置写入面齐备')
const settingsInject = byId('composer-ux').inject()
check('设置页拿到 live 钩子', typeof settingsInject.hooks.live?.getSnapshot === 'function')
check('设置页拿到 setField/clearField/resetAll', typeof settingsInject.actions.setField === 'function'
  && typeof settingsInject.actions.clearField === 'function'
  && typeof settingsInject.actions.resetAll === 'function')
const buttonInject = byId('composer-ux-quick').inject()
check('按钮拿到 toggle 动作', typeof buttonInject.actions.toggle === 'function')
check('按钮拿到 panel 钩子', typeof buttonInject.hooks.panel?.getSnapshot === 'function')
const panelInject = byId('composer-ux-quick-panel').inject()
// 0.4.0：插入模式从「单个 setAlways 勾选框」换成三选一的 setInsertMode
// （两个互斥标志必须一次写对，不能再由界面分别改）。
for (const name of ['close', 'insert', 'optimize', 'setTier', 'setInsertMode', 'addPrompt', 'movePrompt']) {
  check(`面板拿到 ${name}`, typeof panelInject.actions[name] === 'function')
}
check('面板不再拿到会造成矛盾状态的 setAlways', panelInject.actions.setAlways === undefined)
for (const name of ['live', 'panel', 'busy', 'notice', 'book', 'bookStatus']) {
  check(`面板拿到 ${name} 钩子`, typeof panelInject.hooks[name]?.getSnapshot === 'function')
}

console.log('6. 右键菜单三档（派发真实 contextmenu，看实际行为而不是看源码文本）')
{
  /** 派发一次 contextmenu，返回这次事件被怎么对待。 */
  const fireContextMenu = () => {
    const event = {
      target: root,
      prevented: false,
      stopped: false,
      immediate: false,
      preventDefault() { this.prevented = true },
      stopPropagation() { this.stopped = true },
      stopImmediatePropagation() { this.immediate = true },
    }
    const handler = handlers.get('contextmenu')
    if (typeof handler !== 'function') throw new Error('contextmenu 拦截器没有装上')
    handler(event)
    return event
  }
  /** 改档并让插件重新同步（真实插件走的就是这个订阅回放）。 */
  const setMenuMode = (mode) => {
    scopeValue.menuMode = mode
    for (const listener of settingsSubscribers) listener()
  }

  // 初始设置里没有 menuMode：应当落到默认档。
  const initial = fireContextMenu()
  check('没设过档位 → 默认「官方不介入」：不 preventDefault、也不拦事件',
    !initial.prevented && !initial.immediate && !initial.stopped, JSON.stringify(initial))

  setMenuMode('official')
  const official = fireContextMenu()
  check('官方档：插件完全不介入（别的插件的右键处理拿得到事件）',
    !official.prevented && !official.immediate && !official.stopped, JSON.stringify(official))

  setMenuMode('browser')
  const browser = fireContextMenu()
  check('浏览器档：挡住别的插件（stopImmediatePropagation）但不 preventDefault（浏览器菜单照常弹）',
    browser.immediate && browser.stopped && !browser.prevented, JSON.stringify(browser))

  setMenuMode('custom')
  const custom = fireContextMenu()
  // 自定义档：preventDefault 掉浏览器菜单、由本插件接管，同时挡住同一层里其它插件的
  // 捕获监听（否则两边会各弹一个菜单；浏览器档同样这么做）。
  check('自定义档：preventDefault 掉浏览器菜单、并挡住同层其它捕获监听',
    custom.prevented && custom.stopped && custom.immediate, JSON.stringify(custom))
}

console.log('7. 抬头那个「GitHub ↗」链接（两处地址不许分叉）')
{
  const contract = readFileSync('src/settings-contract.ts', 'utf8')
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  const declared = /REPO_URL = '([^']+)'/.exec(contract)?.[1]
  const fromPackage = String(pkg.repository?.url ?? '').replace(/\.git$/, '')
  check('契约里的仓库地址与 package.json 的 repository.url 一致',
    declared !== undefined && declared === fromPackage, `${String(declared)} vs ${fromPackage}`)

  // 注释里会提到地址，所以剥掉注释再找；链接必须用常量，不许在客户端硬编码第二份。
  const section = readFileSync('src/client/SettingsSection.tsx', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
  check('抬头用 href={REPO_URL}，且文件里没有硬编码的 https://github.com/',
    section.includes('href={REPO_URL}') && !section.includes('https://github.com/'),
    section.includes('https://github.com/') ? '出现了硬编码地址' : '')
  check('新标签打开且不带 referrer',
    section.includes('target="_blank"') && /rel="noreferrer[^"]*"/.test(section))
  check('样式表里定义了 .dsh-ux-cardLink（否则链接会难看/看不见）',
    readFileSync('src/client/settings-style.ts', 'utf8').includes('.dsh-ux-cardLink'))
}

console.log('8. 「重启 DSH」：在抬头右端、两步确认、靠 boot 号判断重启成功')
{
  const section = readFileSync('src/client/SettingsSection.tsx', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
  const style = readFileSync('src/client/settings-style.ts', 'utf8')
  const bundle = readFileSync('lib/client.js', 'utf8')

  // 位置：按钮在 cardActions 里，且在 GitHub 链接**之前**（用源码顺序断言，不看注释）。
  const actionsAt = section.indexOf('dsh-ux-cardActions')
  const buttonAt = section.indexOf('<RestartButton restart={restart} />')
  const linkAt = section.indexOf('className="dsh-ux-cardLink"')
  const bannerAt = section.indexOf('<RestartBanner restart={restart} />')
  check('按钮与 GitHub 链接同组（抬头右端），且按钮在链接左边',
    actionsAt > 0 && buttonAt > actionsAt && linkAt > buttonAt,
    `actions=${String(actionsAt)} button=${String(buttonAt)} link=${String(linkAt)}`)
  check('确认条挂在抬头与卡片内容之间（市场那条横幅的位置）',
    bannerAt > linkAt, `banner=${String(bannerAt)} link=${String(linkAt)}`)

  // 两步确认：第一步只读状态，第二步才 POST。
  check('第一步是只读 GET（不带 method）',
    section.includes('fetch(RESTART_API_PATH, { cache: \'no-store\' })'))
  check('第二步才 POST，且带 JSON 体（浏览器 POST 一定会带 Origin，信任关卡才有东西可查）',
    section.includes("method: 'POST'") && section.includes('body: \'{}\''))
  check('确认与取消两枚按钮都在', section.includes('确认重启') && section.includes('取消'))

  // 判定"重启成功"的方式：boot 号变了就刷新，而不是靠"请求断了"猜。
  check('轮询 boot 号，变了才 location.reload()',
    section.includes('facts.boot !== previousBoot') && section.includes('location.reload()'))
  check('有 60 秒上限（不会无限转圈）', section.includes('RESTART_WAIT_MS = 60_000'))
  check('被拦的宿主（调试器/systemd）会说明原因并禁用按钮',
    section.includes('blockedText(blocked)') && section.includes('disabled={busy || blocked !== null}'))
  // 第一次点的时候，正在跑的宿主还是上一版（新路由要重启后才加载）：界面必须如实说明，
  // 否则用户会以为"新机制没生效"。
  check('宿主半是上一版（没有 boot 字段）时如实说明这次走旧机制',
    section.includes('facts.boot === null') && section.includes('宿主半还是上一版'))

  // 产物与样式表里真的有这套类名。中文在产物里是 \uXXXX（esbuild charset: ascii），
  // 所以这里只找 ASCII 标记（0.5.0 就栽在"拿中文去产物里搜"上）。
  for (const cls of ['dsh-ux-cardActions', 'dsh-ux-restartButton', 'dsh-ux-restartBanner',
    'dsh-ux-restartBannerFailed', 'dsh-ux-restartGo', 'dsh-ux-restartCancel']) {
    check(`产物与样式表都有 ${cls}`, bundle.includes(cls) && style.includes(`.${cls}`))
  }
  check('产物里带上了重启接口路径', bundle.includes('/composer-ux/restart'))

  // 用户已经拍掉的东西不能再回来：可选重启命令 + 那张「维护」卡。
  const contract = readFileSync('src/settings-contract.ts', 'utf8')
  check('设置契约里不再有「可选重启命令」字段', !contract.includes('restartCommand'))
  check('设置页不再渲染那张「维护」折卡', !section.includes('name="维护"'))
  check('老文档里可能留着的 restartCommand 会被「恢复默认」顺手清掉',
    readFileSync('src/client.tsx', 'utf8').includes("'restartCommand'"))
}

console.log('9. 「每一栏一个开关」：七张卡各一个 + 卡内开关搬到标题行 + 默认关')
{
  const section = readFileSync('src/client/SettingsSection.tsx', 'utf8')
  const style = readFileSync('src/client/settings-style.ts', 'utf8')
  const bundle = readFileSync('lib/client.js', 'utf8')

  const cardToggles = (section.match(/checked: sections\.\w+/g) ?? []).length
  check('七张折叠卡各有自己的卡级开关（读 activeSections 的结果）', cardToggles === 7, String(cardToggles))
  check('七栏的判据只有一处（activeSections(settings)），不在每个组件里各写一遍',
    section.includes('const sections = activeSections(settings)'))
  check('未启用时概览上加前缀，一眼看得出这一栏没生效', section.includes('未启用 · '))

  // 「卡内已有的开关全部移到标题行」——但右键菜单那 7 项按后来的反馈又搬回了卡内
  // （理由：那 7 项只对「自定义」档有意义，摆在标题行等于在任何档位都能改一堆当时不生效的东西）。
  const customAt = section.indexOf("settings.menuMode === 'custom' && (")
  const itemsAt = section.indexOf('{MENU_ITEMS.map((item, index) => (')
  check('那 7 个条目开关确实在「自定义」分支里（位置上在它之后，不在标题行）',
    customAt > 0 && itemsAt > customAt, `custom@${customAt} items@${itemsAt}`)
  check('标题行不再有「7 项 ▼」：strip 那一套（按钮 + 展开条 + 专用样式）整套拆掉，不留第二个入口',
    !section.includes('strip={{') && !section.includes('strip?: {')
    && !section.includes('dsh-ux-stripButton') && !section.includes('dsh-ux-cardStrip'))
  check('三档说明改成「点哪档只显示哪档」（官方 / 浏览器 / 自定义各一段，互斥渲染）',
    section.includes("settings.menuMode === 'official' && (")
    && section.includes("settings.menuMode === 'browser' && ("))
  check('标题行下不再重复当前档位的 hint（那一档的说明只剩卡内那一段）',
    !section.includes('MENU_MODES.find(item => item.id === settings.menuMode)?.hint'))
  check('设置面板的两个开关搬到标题行（MiniToggle）', section.includes('<MiniToggle'))
  check('默认终端的三档搬到标题行（compact 胶囊）',
    /controls=\{\(\s*<PillChoice\s+compact/.test(section))
  check('OpenCode 那一栏复用 headerEnabled，没有第二个同义开关',
    section.includes('checked: sections.header') && !section.includes('headerSectionEnabled'))

  // 标题行里现在有按钮，不能再把整行包成一个 <button>（嵌套按钮是无效 HTML，点击也会冒泡成"展开"）。
  check('标题行拆成"展开按钮 + 控件区"两个兄弟节点',
    section.includes('className="dsh-ux-cardHeaderRow"')
    && section.includes('className="dsh-ux-cardControls"')
    && /<\/button>\s*<span className="dsh-ux-cardControls">/.test(section))
  for (const cls of ['dsh-ux-cardHeaderRow', 'dsh-ux-cardControls', 'dsh-ux-miniToggle',
    'dsh-ux-cardOff']) {
    check(`产物与样式表都有 ${cls}`, bundle.includes(cls) && style.includes(`.${cls}`))
  }
  for (const cls of ['dsh-ux-stripButton', 'dsh-ux-cardStrip']) {
    check(`${cls} 随 strip 机构一起删干净了（产物与样式表里都不再有）`,
      !bundle.includes(cls) && !style.includes(`.${cls}`))
  }

  // 栏开关要真的门控住每一处行为，不是只在界面上画个开关。
  const interceptors = readFileSync('src/client/interceptors.ts', 'utf8')
  check('键位：拦截器按「键位」栏判断',
    interceptors.includes('activeSections(deps.settings()).keys'))
  check('右键菜单：拦截器按「右键菜单」栏判断',
    interceptors.includes('activeSections(settings).menu'))
  check('快捷指令：入口按钮按栏开关返回 null',
    readFileSync('src/client/QuickCommandsButton.tsx', 'utf8').includes('activeSections(settings).quick'))
  check('设置面板：尺寸把手按栏开关停用',
    readFileSync('src/client/PanelResizeHandles.tsx', 'utf8').includes('activeSections(value).panel'))

  // 「恢复默认」清掉栏开关 = 回到"从没碰过"的样子。五栏那是"关"，而 0.7.0 的统计行
  // 清掉之后是"开"（它的默认就是开）—— 方向相反但各自都对，所以两组都要清。
  const client = readFileSync('src/client.tsx', 'utf8')
  for (const field of ['KEYS_ENABLED_FIELD', 'MENU_ENABLED_FIELD', 'QUICK_ENABLED_FIELD',
    'PANEL_ENABLED_FIELD', 'TERMINAL_ENABLED_FIELD', 'STATS_ENABLED_FIELD']) {
    check(`「恢复默认」清掉 ${field}`, new RegExp(`${field},`).test(client))
  }
}

console.log('10. 「统计行」的实现约定：窄域、只改文本、可还原')
{
  const entry = readFileSync('src/client/StatsLineEntry.tsx', 'utf8')
  const dom = readFileSync('src/client/stats-dom.ts', 'utf8')
  const pure = readFileSync('src/client/stats-line.ts', 'utf8')
  /**
   * 去掉注释后再查关键词。
   *
   * 第一次跑这条护栏是**红的**，原因不在代码而在注释：`StatsLineEntry.tsx` 的说明里写了
   * "不设限就可能一路走到 `document.body`"，于是 `includes('document.body')` 命中的是
   * 那句解释。护栏要盯的是代码。
   */
  const codeOf = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const entryCode = codeOf(entry)
  const domCode = codeOf(dom)
  check('定位只用官方属性 data-composer-stats（不用会随升级变的 CSS Modules 类名）',
    pure.includes("STATS_ROOT_SELECTOR = '[data-composer-stats]'"))
  // 扫全页是社区插件 dsh-cache-precision 的做法（`document.body` + TreeWalker），
  // 本插件刻意不跟：那等于给整个页面挂一个 MutationObserver。
  check('只在自己的 composer dock 里找统计行，不扫全页',
    !entryCode.includes('document.body') && !entryCode.includes('document.querySelector')
    && !domCode.includes('document.body') && !domCode.includes('document.querySelector'))
  check('往上找祖先有层数上限（不设限会一路走到 body，又变成全页监听）',
    domCode.includes('MAX_HOST_DEPTH') && /depth < MAX_HOST_DEPTH/.test(domCode))
  check('同时改写 aria-label（只改可见文字的话读屏听到的还是整数）',
    domCode.includes('rewriteCacheHitLabel(label, display)')
    && domCode.includes("setAttribute('aria-label'"))
  check('观察器只盯 aria-label，不盯 style（盯 style 等于自己喂自己）',
    entryCode.includes("attributeFilter: ['aria-label']") && !/attributeFilter: \[[^\]]*'style'/.test(entryCode))
  // 0.7.0 早期版本还写过行内 max-width（"加宽统计行"），真机核对后按用户拍板撤掉。
  // 这四条是"撤干净"的护栏：那一半一旦悄悄长回来就会红。
  check('这一半只改文本，不写任何行内样式（不碰统计行元素的 style）',
    !/\.style\s*\./.test(domCode) && !/\.style\s*\./.test(entryCode))
  check('加宽相关常量已从契约里删干净',
    !pure.includes('WIDEN_MAX_WIDTH') && !pure.includes('WIDEN_EXTRA_PX'))
  check('只剩一个开关，没有同义的子开关',
    !readFileSync('src/client/SettingsSection.tsx', 'utf8').includes('STATS_PRECISION_FIELD')
    && !codeOf(readFileSync('src/settings-contract.ts', 'utf8')).includes('statsPrecision'))
  check('关掉时写回官方口径（0 位小数），不是"什么都不写"',
    entryCode.includes('active ? HIT_DIGITS : 0'))
  check('锚点常驻挂载：关掉之后仍要能定位到统计行把官方原样写回去',
    entryCode.includes('data-composer-ux-stats-anchor') && !entryCode.includes('if (!active) return null'))
}

console.log('11. 「金额」栏（0.9.1）：设置页可改价 + 客户端不自己造时间线')
{
  const section = readFileSync('src/client/SettingsSection.tsx', 'utf8')
  const card = readFileSync('src/client/CostCard.tsx', 'utf8')
  const contract = readFileSync('src/settings-contract.ts', 'utf8')
  const host = readFileSync('src/host.ts', 'utf8')

  check('设置页多了一张「金额」折卡，且内容区是我们自己的组件',
    section.includes('name="金额"') && section.includes('<CostCardBody'))
  check('这一栏没有卡级开关（用户只要"能改价"，不要这一栏的开关）',
    !/name="金额"[\s\S]{0,200}toggle=/.test(section))
  check('卡片把 setField / clearField 都接上了（清空要能把那个键从设置里去掉）',
    card.includes('setField(PRICE_OVERRIDES_FIELD') && card.includes('clearField(PRICE_OVERRIDES_FIELD'))
  // 留空＝官方价：占位提示必须来自官方价目表，绝不能用 `value={值 ?? 0}` 之类把空当 0。
  // 0.10.0：只有 DeepSeek 系（峰谷两档）的行才给官方价占位；第三方「平坦价」行没有可显示的
  // 官方价（它的价来自同步来的第三方价目，可能压根没同步过），占位留空 —— "未定价"就是这么来的。
  // 这里只钉"按档取官方价"这件事（`officialTripleOf(model, peak…`），不钉它后面还带了哪些
  // 选项 —— 那个参数表还在长（例如同步来的价格档），钉死了只会让正常改动误伤这条断言。
  check('占位提示 = 官方价（留空＝沿用官方价，不是 0）；平坦价行不给占位',
    card.includes("placeholder={twoTier ? String(official[field]) : ''}")
    && card.includes('officialTripleOf(model, peak'))
  check('非法文本标红并保留，不当清空（parsePriceText 三态）',
    card.includes('parsePriceText') && card.includes("parsed.kind === 'invalid'"))
  check('写设置合并 + 识别回声（连改几格不会被自己的回声冲掉）',
    card.includes('WRITE_DEBOUNCE_MS') && card.includes('lastWritten') && card.includes('canonical'))
  // 0.10.0 起内置价目只剩两个（flash / v4-pro）：行数照 `BUILTIN_PRICING_MODELS` 走，
  // 加上用户自加的行；这里钉的是"两个来源都渲染"，不是写死个数。
  check('内置模型常显（0.10.0 起两个：deepseek-flash / deepseek-v4-pro）、可自加任意模型名',
    card.includes('BUILTIN_PRICING_MODELS') && card.includes('customPricingModels'))
  check('「恢复默认」会清掉覆盖价（否则金额还是按旧价算）',
    readFileSync('src/client.tsx', 'utf8').includes('PRICE_OVERRIDES_FIELD'))
  check('契约里登记了这个字段（schemastery 侧才能写）',
    contract.includes("export const PRICE_OVERRIDES_FIELD = 'priceOverrides'"))
  check('宿主半的 schema 收下了这个字段（z.any：键是用户自加的模型名）',
    host.includes('[PRICE_OVERRIDES_FIELD]: z.any()'))
  // 客户端不可能知道"每笔用量发生在什么时候"（投影只有累计桶），所以时间线只能在宿主半。
  check('宿主半订阅 session/event 增量喂折叠缓存（胶囊取价才是 O(1)）',
    host.includes("on?.('session/event'") && host.includes('createUsageCache')
    && host.includes('usageCache.event('))
  check('宿主半按需播种（readSession 只读一次，之后走缓存）',
    host.includes('usageCache.sync(') && host.includes('readSession'))
  check('宿主半按事件时间判峰谷与价格档，并把成本一起算好回给客户端',
    host.includes('const tierAt = (ms: number, provider: string, model: string)')
    && host.includes('isPeakAt(at, { holidays: moneyRules.holidays })')
    && host.includes('eraIdAt(at, moneyRules.eras)')
    && host.includes('const parts = costPartsOf(costBucketsOf(item.usage), resolved.prices)')
    && host.includes('provider: item.provider')
    && host.includes('era: item.era')
    && host.includes('providers: moneyRules.providers'))
}

console.log('11.1 「金额」0.10.0：节假日 / 峰谷提醒 / 余额 / 价目同步（界面 + 宿主调用封装）')
{
  const card = readFileSync('src/client/CostCard.tsx', 'utf8')
  const admin = readFileSync('src/client/money-admin.ts', 'utf8')
  const chip = readFileSync('src/client/CostChipEntry.tsx', 'utf8')
  const balancePath = /BALANCE_API_PATH = '([^']+)'/.exec(readFileSync('src/balance.ts', 'utf8'))?.[1]

  check('节假日表：一个 textarea + 保存 / 恢复默认 两个按钮',
    card.includes('aria-label="法定节假日日期表"')
    && card.includes('onClick={saveHolidays}') && card.includes('恢复默认')
    && card.includes('clearField(PEAK_HOLIDAYS_FIELD)'))
  // 0.11.0：节假日改成"自动获取 + 手填覆盖"，所以多了获取按钮与生效来源那行
  check('0.11.0 节假日：第三个同步按钮「获取法定节假日」走 sync.sync(\'holidays\')',
    card.includes("sync.sync('holidays')") && card.includes('获取法定节假日'))
  check('0.11.0 节假日：文本框只放**手填**那份（自动获取的不进输入框，留空=用自动/内置）',
    card.includes('(settings.peakHolidays ?? []).join')  // initial + savedHolidayText 两处
    && !card.includes('(settings.peakHolidays ?? DEFAULT_PEAK_HOLIDAYS).join'))
  check('0.11.0 节假日：当前生效那行说的是**生效表**的来源与天数（与宿主同一份函数）',
    card.includes('effectiveHolidays(settings.peakHolidays, synced?.holidays)')
    && card.includes('HOLIDAY_SOURCE_LABEL')
    && card.includes('holidayInfo.days.length'))
  check('0.11.0 节假日：自动获取的那份与内置取并集（浮层/宿主/设置页三处同源）',
    card.includes('与内置表取并集后是'))
  check('0.11.0：卡里新增「计价说明」块，把浮层那三行静态说明接过来',
    card.includes('计价说明') && card.includes('PRICE_VERIFIED_AT') && card.includes('价格档：'))
  check('节假日只收 YYYY-MM-DD，坏行逐条点名（不静默丢）',
    card.includes('isDayKey(item)') && card.includes('这些不是合法日期'))
  check('峰谷提醒一组控件（启用 / 提前分钟 / 进峰前 / 离峰前 / 系统通知）',
    ['启用峰谷提醒', '提前多少分钟提醒', '进入高峰前提醒', '离开高峰前提醒', '额外发浏览器通知']
      .every(label => card.includes(`aria-label="${label}"`))
    && card.includes('setField(PEAK_ALERT_FIELD'))
  check('提前量钳在 1–60 分钟（写坏值不会落进设置）',
    card.includes('Math.min(60, Math.max(1, Math.round(value)))'))
  check('勾系统通知时先要授权（非安全上下文里 Notification 不存在也不炸）',
    card.includes("typeof Notification !== 'undefined'") && card.includes('Notification.requestPermission()'))
  check('余额：一个开关 + 一个刷新按钮，走 BALANCE_ENABLED_FIELD',
    card.includes('aria-label="启用余额查询"') && card.includes('setField(BALANCE_ENABLED_FIELD')
    && card.includes('onClick={balance.refresh}') && card.includes('disabled={!settings.balanceEnabled}'))
  check('两个同步按钮各自只同步一条路（官方价 / 第三方价目）',
    card.includes("sync.sync('official')") && card.includes("sync.sync('modelsDev')")
    && card.includes('同步官方价') && card.includes('同步第三方价目')
    && card.includes('disabled={sync.busy !== null}'))
  check('同步结果如实显示（失败走失败态样式，不谎报"已同步"）',
    card.includes('style={sync.ok ? hintInfo : hintError}'))
  check('卡内显式标出"抓失败不会覆盖本地数据"',
    card.includes('抓失败不会覆盖本地数据'))
  check('第三方模型行只有一档（平坦价），DeepSeek 行才两档',
    card.includes('const twoTier = isDeepSeekRoute(provider, model)')
    && card.includes('(twoTier ? [true, false] : [false])'))

  check('价目同步：POST SYNC_API_PATH，body 是 { target }',
    admin.includes('usePriceSync') && admin.includes('fetch(SYNC_API_PATH, {')
    && admin.includes("method: 'POST'") && admin.includes('body: JSON.stringify({ target })')
    && admin.includes("target: 'official' | 'modelsDev'"))
  check('忙碌期点击被挡住（用 ref 判据，不只看异步的 state）',
    admin.includes('busyRef.current') && admin.includes('if (busyRef.current) return'))
  check('余额：只在开关打开时取一次，关掉一个请求都不发',
    admin.includes('settings.balanceEnabled === true') && admin.includes('if (!enabled) {')
    && admin.includes("setState({ status: 'off' })"))
  // 0.10.0 起这里改成**结构性**断言：客户端不再写字面量路径，而是 import `BALANCE_API_PATH`
  // 本身 —— 那样两处根本不可能分叉。原来那条"字面量逐字一致"的断言在 import 之后必然变红
  // （源码里再也不出现那个字符串了），所以改成"必须 import + 用常量"。
  check('余额请求路径用 balance.ts 的 BALANCE_API_PATH（import 常量，不写字面量）',
    balancePath === '/composer-ux/balance'
    && admin.includes("import { BALANCE_API_PATH } from '../balance.ts'")
    && admin.includes('fetch(BALANCE_API_PATH,')
    && !admin.includes("'/composer-ux/balance'"),
    String(balancePath))
  check('余额与同步都不往设置里写值（余额是账户事实，不进设置文档）',
    !admin.includes('setField'))
  // 0.10.0 后补：自动同步开关（默认关）与"内置快照价"的如实标注；0.11.0 起这把开关
  // **也管节假日**（同一个语义"这个插件可以自己出网"，没必要两个开关）。
  check('自动同步：卡里一个复选框，写的是 PRICE_AUTO_SYNC_FIELD',
    card.includes('aria-label="自动同步官方价与节假日"')
    && card.includes('setField(PRICE_AUTO_SYNC_FIELD, event.target.checked)')
    && card.includes('checked={settings.priceAutoSync}'))
  check('自动同步说清两件事的频率（价格每天一次、节假日每 30 天复核）',
    card.includes('自动同步（价格每天一次、节假日每 30 天复核）'))
  check('同步区状态行如实列出"节假日上次获取"与已有年份',
    card.includes('法定节假日上次获取：') && card.includes('synced.holidayYears.join'))
  // 0.11.0：面板瘦身 —— 那三行说明的去留（用户 2026-09-29 要求"点开胶囊更简洁"）
  check('0.11.0 面板：快照行与峰谷判定段已从浮层移走（设置页留一份）',
    // ⚠️ 这里只查"代码里还在不在"：文件头的注释里刻意留着"刊例价快照行"这个说法（记录改动），
    // 拿它当判据会假红 —— 所以查 import 与那两处 JSX 文本。
    !chip.includes('PRICE_VERIFIED_AT')
    && !chip.includes('刊例价快照 ${PRICE_VERIFIED_AT}')
    && !chip.includes("note('峰谷按每笔用量发生的时间判定"))
  check('0.11.0 面板：价格档说明改成"只在非默认时出现"（跨档才提，单档不占行）',
    chip.includes('erasUsed.length > 1 || erasUsed[0] !== eraIdAt(Date.now(), eras)'))
  check('0.11.0 面板：覆盖价用「已自定义」小标，不再整行说明',
    chip.includes("overridden ? ' · 已自定义' : ''"))
  check('0.11.0 同步封装：三条路（官方价 / 第三方价目 / 节假日）',
    admin.includes("readonly busy: 'official' | 'modelsDev' | 'holidays' | null")
    && admin.includes("sync: (target: 'official' | 'modelsDev' | 'holidays')"))
  check('说清没同步过时用内置快照价，并把快照日期写出来（不假装是实时价）',
    card.includes('内置快照价') && card.includes('PROVIDER_PRICES_SNAPSHOT_AT'))
  check('明细页也标明"有 N 行用的是内置快照价"（并指向同步按钮）',
    chip.includes("'__builtin__'") && chip.includes('内置快照价') && chip.includes('同步第三方价目'))
}

console.log('12. 「金额」的覆盖价真的能被设置服务收下（复刻那三步校验）')
{
  // 为什么值得单独跑一遍：这张表是**一个字段装一棵树**（键是用户自加的模型名），
  // 能不能写进设置文档取决于三件事同时成立：字段是 volatile、schema 类型容得下、
  // 写入校验不在它下面继续挑刺。这三条任何一条不成立，表现都是"改了价、界面没反应"
  // 或者"点了保存没报错但设置文件里什么都没有" —— 都必须在这里挡住。
  const { pathToFileURL } = await import('node:url')
  const { existsSync } = await import('node:fs')
  const repoPath = (process.env.DSH_REPO_PATH ?? 'D:/DeepSeek Harness').replace(/\\/g, '/')
  // 两条候选，与 build.mjs 的退路一致：CI 上没有 DSH 检出，但 npm 包里那份与 vendor 那份
  // **逐字节相同**（0.12.0 核对过），所以这一节在 CI 上跑的是同一代代码。
  const schemasteryPath = [
    `${repoPath}/vendor/schemastery/lib/index.mjs`,
    'node_modules/@deepseek-ai/schemastery/lib/index.mjs',
  ].find(candidate => existsSync(candidate))
  if (schemasteryPath === undefined) {
    // 不静默放水：把话说出来（这句会出现在 CI 日志里），整节跳过。
    console.log('  — 跳过：找不到 schemastery（既没有 DSH 检出，也没 npm install）—')
  } else {
  const { default: z } = await import(pathToFileURL(schemasteryPath).href)
  const { Config } = await import('../lib/index.js')

  // 下面两个函数与 DSH 的 `packages/settings/settings/src/schema.ts` 逐行同义。
  const plainSchema = schema => {
    const result = new z(schema.toJSON())
    const walk = node => {
      delete node.meta.volatile
      for (const child of Object.values(node.dict ?? {})) walk(child)
      if (node.inner) walk(node.inner)
      for (const child of node.list ?? []) walk(child)
    }
    walk(result)
    return result
  }
  const volatileForm = schema => {
    if (schema.meta.volatile) return plainSchema(schema)
    if (schema.type === 'object') {
      const dict = Object.fromEntries(Object.entries(schema.dict ?? {}).flatMap(([key, child]) => {
        const field = volatileForm(child)
        return field === undefined ? [] : [[key, field]]
      }))
      return Object.keys(dict).length === 0 ? undefined : z.object(dict)
    }
    return undefined
  }
  const isVolatilePath = (schema, path) => {
    if (schema.meta.volatile) return true
    const [key, ...rest] = path
    const child = key === undefined ? undefined : schema.dict?.[key]
    return child !== undefined && isVolatilePath(child, rest)
  }
  const projectForm = (schema, value) => schema.type === 'object' && value !== null && typeof value === 'object'
    ? Object.fromEntries(Object.entries(schema.dict ?? {}).flatMap(([key, child]) => {
        const field = value[key]
        return field === undefined ? [] : [[key, projectForm(child, field)]]
      }))
    : value

  const field = readFileSync('src/settings-contract.ts', 'utf8')
  const fieldName = /PRICE_OVERRIDES_FIELD = '([^']+)'/.exec(field)?.[1]
  check('契约里的字段名就是 schema 里的那个键', fieldName === 'priceOverrides')
  check('这个字段是 volatile（否则设置页根本写不进去）',
    isVolatilePath(Config, [fieldName]) === true)
  check('类型是"接受任何值"（键是动态的模型名，对象 schema 表达不了）',
    Config.dict[fieldName].type === 'any')
  const form = volatileForm(Config)
  check('volatileForm 能把这棵树建出来（含这张表）',
    form !== undefined && form.dict?.[fieldName] !== undefined)
  const value = { 'deepseek-flash': { peak: { miss: 3 } }, 'my-relay': { offPeak: { out: 4.5 } } }
  const current = projectForm(form, { [fieldName]: value })
  check('读回来的值原样保留（不会被 schema 吃掉）',
    JSON.stringify(current[fieldName]) === JSON.stringify(value))
  let rejected = ''
  const validatePaths = (next, node, path = []) => {
    for (const [key, child] of Object.entries(next)) {
      const target = [...path, key]
      if (isVolatilePath(Config, target)) continue
      const fields = node.dict ?? {}
      const child0 = Object.hasOwn(fields, key) ? fields[key] : undefined
      if (child !== null && typeof child === 'object' && !Array.isArray(child) && child0 !== undefined) validatePaths(child, child0, target)
      else rejected = target.join('.')
    }
  }
  validatePaths(current, form)
  check('写入校验放过它（不许在表下面继续挑刺）', rejected === '')
  }
}

console.log('13. 「峰谷提醒」纯文案（peakNoticeText）：相位 → 一行中文（跑真函数，不是搜源码）')
{
  // peakNoticeText 是纯函数，直接喂相位断言输出 —— 比"源码里有没有这几个字"硬得多：
  // 文案里那几种情形（高峰/空闲、周末/节假日谷价、找不到切换点、x 小时 y 分钟）各是一条
  // 用户会当场读到的句子，写错方向（把"转高峰"写成"转空闲"）屏幕上很难看出来。
  // 这个模块 import 了 React（只为旁边的两个 hook），所以打包时把 react 换成一个最小桩。
  const { build } = await import('esbuild')
  const { join } = await import('node:path')
  const reactStub = {
    name: 'react-stub',
    setup(build) {
      build.onResolve({ filter: /^react$/ }, () => ({ path: 'react-stub', namespace: 'stub' }))
      build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
        contents: 'export default { useState: v => [typeof v === "function" ? v() : v, () => {}], useEffect: () => {}, useCallback: f => f, useRef: v => ({ current: v }) }',
        loader: 'js',
      }))
    },
  }
  const bundled = await build({
    bundle: true, write: false, format: 'esm', platform: 'node', target: ['es2022'], logLevel: 'warning',
    stdin: {
      contents: "export { peakNoticeText, usePeakPhase, usePeakAlert } from './peak-alert.ts'\nexport { peakPhaseAt, formatCountdown } from '../pricing.ts'\n",
      resolveDir: join(process.cwd(), 'src/client'),
      loader: 'ts',
    },
    plugins: [reactStub],
  })
  const code = bundled.outputFiles[0].text
  const peak = await import(`data:text/javascript;base64,${Buffer.from(code, 'utf8').toString('base64')}`)

  /** 造一个相位，只写关心的那几项。 */
  const phase = over => ({
    inPeak: false, nextAtMs: Date.parse('2026-10-12T04:00:00Z'), nextIntoPeak: true,
    minutesUntil: 45, holiday: false, weekend: false, ...over,
  })
  const text = p => peak.peakNoticeText(p)
  check('空闲 + 45 分钟后转高峰', text(phase()) === '空闲档 · 45 分钟后转高峰', text(phase()))
  check('高峰 + 45 分钟后转空闲', text(phase({ inPeak: true, nextIntoPeak: false })) === '高峰档 · 45 分钟后转空闲',
    text(phase({ inPeak: true, nextIntoPeak: false })))
  check('超过 60 分钟走「x 小时 y 分钟」文案',
    text(phase({ minutesUntil: 135 })) === '空闲档 · 2 小时 15 分钟后转高峰', text(phase({ minutesUntil: 135 })))
  check('周末谷价写明原因', text(phase({ weekend: true })) === '空闲档（周末谷价） · 45 分钟后转高峰',
    text(phase({ weekend: true })))
  check('法定节假日谷价写明原因', text(phase({ holiday: true })) === '空闲档（法定节假日谷价） · 45 分钟后转高峰',
    text(phase({ holiday: true })))
  check('高峰档不写谷价原因（周末/节假日只影响谷价那一档）',
    text(phase({ inPeak: true, nextIntoPeak: false, weekend: true, holiday: true })) === '高峰档 · 45 分钟后转空闲')
  check('96 小时内找不到切换点 → 只写当前档，不编一个倒计时',
    text(phase({ nextAtMs: Number.NaN, minutesUntil: 0 })) === '空闲档'
    && text(phase({ inPeak: true, nextAtMs: Number.NaN, minutesUntil: 0, weekend: true })) === '高峰档')
  check('分钟数 0 → 「不到 1 分钟」（不写 0 分钟）',
    text(phase({ minutesUntil: 0 })) === '空闲档 · 不到 1 分钟后转高峰', text(phase({ minutesUntil: 0 })))
  // 与 pricing.ts 的相位同源：2026-10-12（周一）北京 09:30 → 高峰，北京 12:00 转空闲 = 150 分钟后。
  check('相位 + 文案串起来跑：周一北京 09:30 → 高峰档 · 2 小时 30 分钟后转空闲',
    (() => {
      const now = peak.peakPhaseAt(Date.parse('2026-10-12T01:30:00Z'))
      return now.inPeak === true && now.minutesUntil === 150
        && text(now) === '高峰档 · 2 小时 30 分钟后转空闲'
    })())
  check('两个 hook 也导出了（胶囊/明细页就是靠它们拿相位与文案）',
    typeof peak.usePeakPhase === 'function' && typeof peak.usePeakAlert === 'function')
}

console.log('14. React 副作用：alive ref 必须在 effect 体里重置（StrictMode / HMR 重挂）')
{
  // 为什么必须重置：StrictMode（以及某些 HMR 重挂）会走"挂载 → 清理 → 再挂载"，
  // 而 ref 在这一轮里是同一个对象 —— 只在 cleanup 里置 false、不在 effect 体里置回 true 的话，
  // `alive` 会**永远是 false**：之后所有响应被静默丢弃（表现是"同步永远停在同步中…""余额一直空白"
  // "胶囊永远停在本地估算那个数"）。2026-09-29 复查时发现三处都是这个写法，已改。
  for (const [file, label] of [
    ['src/client/money-admin.ts', '金额的同步 / 余额两个 hook'],
    ['src/client/session-cost.ts', '会话金额取数（胶囊那个数字）'],
  ]) {
    const source = readFileSync(file, 'utf8')
    const refs = (source.match(/React\.useRef\(true\)/g) ?? []).length
    const resets = (source.match(/alive\.current = true/g) ?? []).length
    check(`${label}：每个 alive ref 都有对应的重置（ref ${refs} 个 / 重置 ${resets} 处）`,
      refs > 0 && refs === resets, `${refs}/${resets}`)
    check(`${label}：没有"只写 cleanup、不重置"的旧写法`,
      !/React\.useEffect\(\(\) => \(\) => \{[\s\S]{0,120}alive\.current = false/.test(source))
  }
}

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
