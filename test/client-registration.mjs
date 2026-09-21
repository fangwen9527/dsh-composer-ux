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
}

moduleExports.apply(ctx)

const byId = (id) => registrations.find(entry => entry.id === id)

console.log('1. 槽位注册')
check('注册了 5 个槽位条目', registrations.length === 5, JSON.stringify(registrations.map(r => r.id)))
check('设置页条目', byId('composer-ux')?.name === 'settings.section')
check('右键菜单浮层', byId('composer-ux-menu')?.name === 'shell.overlay')
check('面板缩放手柄', byId('composer-ux-panel-resize')?.name === 'shell.overlay')
check('快捷指令按钮', byId('composer-ux-quick')?.name === 'conversation.input.right')
check('快捷指令面板', byId('composer-ux-quick-panel')?.name === 'shell.overlay')
check('每个条目都带组件', registrations.every(entry => typeof entry.component === 'function'))

console.log('2. 按钮与「展开」同排（order 89 < 官方的 90）')
check('按钮 order = 89', byId('composer-ux-quick')?.order === 89, String(byId('composer-ux-quick')?.order))
check('按钮带标签（便于导航投影）', byId('composer-ux-quick')?.label === '快捷指令')

console.log('3. 只注册到真实存在的槽位名')
const knownSlots = new Set(['settings.section', 'shell.overlay', 'conversation.input.right'])
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

console.log('9. 「每一栏一个开关」：六张卡各一个 + 卡内开关搬到标题行 + 默认关')
{
  const section = readFileSync('src/client/SettingsSection.tsx', 'utf8')
  const style = readFileSync('src/client/settings-style.ts', 'utf8')
  const bundle = readFileSync('lib/client.js', 'utf8')

  const cardToggles = (section.match(/checked: sections\.\w+/g) ?? []).length
  check('六张折叠卡各有自己的卡级开关（读 activeSections 的结果）', cardToggles === 6, String(cardToggles))
  check('六栏的判据只有一处（activeSections(settings)），不在每个组件里各写一遍',
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

  // 「恢复默认」清掉五栏开关 = 回到"从没碰过" = 六栏全关（与"默认关"的语义一致）。
  const client = readFileSync('src/client.tsx', 'utf8')
  for (const field of ['KEYS_ENABLED_FIELD', 'MENU_ENABLED_FIELD', 'QUICK_ENABLED_FIELD',
    'PANEL_ENABLED_FIELD', 'TERMINAL_ENABLED_FIELD']) {
    check(`「恢复默认」清掉 ${field}`, new RegExp(`${field},`).test(client))
  }
}

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
