/**
 * 设置服务的「两代认领」测试。
 *
 * 为什么必须有这个文件：DSH 0.1.7 把客户端设置服务改了名（`settingsScope` →
 * `configForms`），而**静态 inject 写错名字的后果是"整块不挂载"** ——
 * 设置页、键位、右键菜单、快捷指令会一起消失，浏览器里只有一条等依赖的静默。
 * 所以这里把三种组合都跑一遍真产物：
 *
 *   1. 只有 `settingsScope`（0.1.6 及以前）→ 走 bind({ namespace })
 *   2. 只有 `configForms`（0.1.7 起）      → 走 get(namespace)
 *   3. 两个都没有（组合里没有设置 provider）→ 仍要挂载，降级成默认值
 *
 * 另外钉住一条：客户端半的**静态** inject 只能写 `slots`。
 * 一旦有人把 `settingsScope`/`configForms` 写回去，就会在另一代上整块消失 ——
 * 这正是 0.1.7 上"插件不见了"的成因。
 *
 *   node test/settings-service-adopt.mjs
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

// ── 最小 DOM / React 桩（与 client-registration.mjs 同一套）────────────────
globalThis.Element = class Element {}

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
  addEventListener: () => {},
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

// ── 静态 inject：只能写 slots ───────────────────────────────────────────────
console.log('1. 静态 inject 不绑某一代的服务名')
const staticInject = moduleExports.inject
check('inject 是数组', Array.isArray(staticInject), JSON.stringify(staticInject))
check('inject 只含 slots', JSON.stringify(staticInject) === '["slots"]', JSON.stringify(staticInject))
check(
  'inject 里没有版本专属的服务名',
  !staticInject.includes('settingsScope') && !staticInject.includes('configForms'),
  JSON.stringify(staticInject),
)

// ── 三种服务组合各跑一遍 apply ──────────────────────────────────────────────
/** 观测到的调用记录。 */
const scopeValue = {
  enabled: true,
  optimizerTier: 'extreme',
  quickPrompts: [{ id: 'a', label: '甲', prompt: '内容甲', always: true }],
}

/**
 * 造一个作用域替身（两代的实例形状相同：快照 + 订阅 + 三种写入）。
 * @param onWrite 写入时调用（用来断言真的写到了被认领的那个服务上）。
 */
function makeScope(onWrite) {
  return {
    getSnapshot: () => ({ status: 'ready', value: scopeValue }),
    subscribe: () => () => {},
    set: async (field, value) => { onWrite(field, value); return true },
    unset: async (field) => { onWrite(field, undefined); return true },
    mutate: async (ops) => { onWrite('mutate', ops); return true },
  }
}

/**
 * 用给定的服务组合跑一次 apply。
 * @param services 形如 `{ settingsScope }` 或 `{ configForms }`（可为空对象）。
 * @param opts `{ inject: false }` 用来模拟"没有 ctx.inject"的上下文（兜底路径）。
 * @returns 观测结果：槽位注册、服务调用、以及插件的 live 快照读取口。
 */
function runApply(services, opts = {}) {
  const registrations = []
  const calls = { bind: [], get: [] }
  const writes = []
  const slots = {
    inject: (slotName, callback) => callback(),
    register: (meta, component) => {
      registrations.push({ ...meta, component })
      return () => {}
    },
  }
  const ctx = {
    slots,
    ...services,
    effect: (fn) => {
      const dispose = fn()
      return () => { if (typeof dispose === 'function') dispose() }
    },
  }
  if (opts.inject !== false) {
    // 与 cordis 同语义：依赖全在场才回调，缺席就静默不调。
    ctx.inject = (deps, callback) => {
      const view = {}
      for (const name of deps) {
        if (ctx[name] === undefined) return
        view[name] = ctx[name]
      }
      callback(view)
    }
  }
  if (services.settingsScope !== undefined) {
    ctx.settingsScope = {
      bind: (spec) => {
        calls.bind.push(spec?.namespace)
        return makeScope((field, value) => writes.push({ field, value }))
      },
    }
  }
  if (services.configForms !== undefined) {
    ctx.configForms = {
      get: (namespace) => {
        calls.get.push(namespace)
        return makeScope((field, value) => writes.push({ field, value }))
      },
    }
  }

  moduleExports.apply(ctx)
  const settingsEntry = registrations.find(entry => entry.id === 'composer-ux')
  return {
    registrations,
    calls,
    writes,
    inject: settingsEntry?.inject?.(),
  }
}

console.log('2. 0.1.6：只有 settingsScope（走 bind）')
{
  const run = runApply({ settingsScope: {} })
  check('注册了 5 个槽位条目', run.registrations.length === 5, String(run.registrations.length))
  check('认领的是 bind({ namespace: composer-ux })', JSON.stringify(run.calls.bind) === '["composer-ux"]', JSON.stringify(run.calls.bind))
  check('没有去问 configForms', run.calls.get.length === 0, JSON.stringify(run.calls.get))
  check(
    '服务里的值真的进了 live 快照',
    run.inject?.hooks?.live?.getSnapshot()?.optimizerTier === 'extreme',
    JSON.stringify(run.inject?.hooks?.live?.getSnapshot()?.optimizerTier),
  )
  run.inject?.actions?.setField('sendKey', 'Ctrl+Enter')
  check('写字段落在被认领的作用域上', run.writes[0]?.field === 'sendKey', JSON.stringify(run.writes))
}

console.log('3. 0.1.7：只有 configForms（走 get）')
{
  const run = runApply({ configForms: {} })
  check('注册了 5 个槽位条目', run.registrations.length === 5, String(run.registrations.length))
  check('认领的是 get(composer-ux)', JSON.stringify(run.calls.get) === '["composer-ux"]', JSON.stringify(run.calls.get))
  check('没有去问 settingsScope', run.calls.bind.length === 0, JSON.stringify(run.calls.bind))
  check(
    '服务里的值真的进了 live 快照',
    run.inject?.hooks?.live?.getSnapshot()?.optimizerTier === 'extreme',
    JSON.stringify(run.inject?.hooks?.live?.getSnapshot()?.optimizerTier),
  )
  run.inject?.actions?.setField('sendKey', 'Ctrl+Enter')
  check('写字段落在被认领的作用域上', run.writes[0]?.field === 'sendKey', JSON.stringify(run.writes))
}

console.log('4. 两个都没有：降级但不消失')
{
  const run = runApply({})
  check('仍然注册了 5 个槽位条目', run.registrations.length === 5, String(run.registrations.length))
  check('没有认领任何服务', run.calls.bind.length === 0 && run.calls.get.length === 0)
  const live = run.inject?.hooks?.live?.getSnapshot()
  check('live 落回默认档位（不是 extreme）', live?.optimizerTier !== 'extreme', JSON.stringify(live?.optimizerTier))
  let threw = false
  try {
    run.inject?.actions?.setField('sendKey', 'Ctrl+Enter')
  } catch {
    threw = true
  }
  check('写字段不抛（空作用域兜底）', threw === false)
}

console.log('5. 没有 ctx.inject：兜底也要认领')
{
  const run = runApply({ settingsScope: {} }, { inject: false })
  check('仍然注册了 5 个槽位条目', run.registrations.length === 5, String(run.registrations.length))
  check('靠"直接读一次"认领了 bind', JSON.stringify(run.calls.bind) === '["composer-ux"]', JSON.stringify(run.calls.bind))
  check(
    'live 仍是服务里的值',
    run.inject?.hooks?.live?.getSnapshot()?.optimizerTier === 'extreme',
    JSON.stringify(run.inject?.hooks?.live?.getSnapshot()?.optimizerTier),
  )
}

console.log('6. 两代服务同时在：认领第一个（configForms），不重复认领')
{
  const run = runApply({ configForms: {}, settingsScope: {} })
  check('认领了 configForms', JSON.stringify(run.calls.get) === '["composer-ux"]', JSON.stringify(run.calls.get))
  check('没有再认领 settingsScope', run.calls.bind.length === 0, JSON.stringify(run.calls.bind))
}

/*
 * 7. 真 cordis 代理：读未 inject 的服务名会抛，不能让 apply 挂掉。
 *
 * 上面每个用例的 ctx 都是普通对象，`ctx.configForms` 只回 undefined；真 host 里
 * `ctx` 是 Proxy，读**不在 inject 里**的服务名直接抛
 * `cannot get property "X" without inject`（vendor/cordis/src/reflect.ts）。
 * 本插件静态 inject 只有 `['slots']`，所以在缺那一代服务的 DSH 上，裸读
 * `ctx.configForms` / `ctx.settingsScope` 会让整个 apply 抛出 —— 设置页、键位、
 * 右键菜单、快捷指令一起消失。本用例把 ctx 换成同样会抛的 Proxy 复现它。
 */
console.log('7. 真 cordis 代理：读缺席服务名抛错时，apply 仍要活下来')
{
  const registrations = []
  const calls = { bind: [], get: [] }
  const slots = {
    inject: (slotName, callback) => callback(),
    register: (meta, component) => {
      registrations.push({ ...meta, component })
      return () => {}
    },
  }
  /** 只有 settingsScope 在场；其余服务名一律按 cordis 代理规则抛错。 */
  const present = { slots, settingsScope: { bind: (spec) => { calls.bind.push(spec?.namespace); return makeScope(() => {}) } } }
  const ctx = new Proxy(present, {
    get: (target, prop) => {
      if (prop in target) return target[prop]
      throw new Error(`cannot get property "${String(prop)}" without inject`)
    },
  })
  ctx.inject = (deps, callback) => {
    const view = {}
    for (const name of deps) {
      if (!(name in present)) return
      view[name] = present[name]
    }
    callback(view)
  }
  ctx.effect = (fn) => {
    const dispose = fn()
    return () => { if (typeof dispose === 'function') dispose() }
  }

  let threw = null
  try {
    moduleExports.apply(ctx)
  } catch (error) {
    threw = error
  }
  check('apply 不抛', threw === null, threw === null ? '' : String(threw?.message))
  check('仍然注册了 5 个槽位条目', registrations.length === 5, String(registrations.length))
  check('认领了在场的 settingsScope', JSON.stringify(calls.bind) === '["composer-ux"]', JSON.stringify(calls.bind))
}

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
