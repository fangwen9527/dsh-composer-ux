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
  addEventListener: (type) => { listeners.push(type) },
  removeEventListener: () => {},
  setTimeout: (fn) => setTimeout(fn, 0),
  clearTimeout: (handle) => clearTimeout(handle),
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
const settingsScope = {
  bind: () => ({
    getSnapshot: () => ({ status: 'ready', value: scopeValue }),
    subscribe: () => () => {},
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
for (const name of ['close', 'insert', 'optimize', 'setTier', 'setAlways']) {
  check(`面板拿到 ${name}`, typeof panelInject.actions[name] === 'function')
}
for (const name of ['live', 'panel', 'busy', 'notice']) {
  check(`面板拿到 ${name} 钩子`, typeof panelInject.hooks[name]?.getSnapshot === 'function')
}

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
