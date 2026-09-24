/**
 * 宿主半「两代设置服务」的兼容测试。
 *
 * 为什么必须有这个文件：DSH 0.1.7 把宿主设置服务重写了 ——
 *   · `settings.register(ns, schema)` **被删除**（命名空间改由插件导出的 Config 推导）；
 *   · `settings.get(ns)` **被删除**（自己的行看 Config，别人的行只能从 describe() 读）；
 * 而这两处任意一个按老写法调用都会**抛异常**，后果是宿主半整块挂不上
 * （设置页没有真相来源、请求头镜像不再工作）。
 *
 *   node test/host-settings-generations.mjs
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply, Config } from '../lib/index.js'

// 与 host-header-mirror 同理：把 $DSH_HOME 指到空目录，避免读到跑测试的人的真实文件。
process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'dsh-hsg-home-'))

const NAMESPACE = 'composer-ux'
const LLM = 'llm-pi-ai'

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

const settle = () => new Promise(resolve => { setTimeout(resolve, 15) })

function setPath(root, path, value) {
  let cursor = root
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i]
    if (typeof cursor[key] !== 'object' || cursor[key] === null) cursor[key] = {}
    cursor = cursor[key]
  }
  cursor[path[path.length - 1]] = value
}

function unsetPath(root, path) {
  let cursor = root
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i]
    if (typeof cursor[key] !== 'object' || cursor[key] === null) return
    cursor = cursor[key]
  }
  delete cursor[path[path.length - 1]]
}

const baseLlm = () => ({
  providers: {
    'opencode-go': { apiKeyEnv: 'OPENCODE_GO_API_KEY', models: [{ id: 'glm-5.3-flash' }] },
  },
})

const baseOwn = overrides => ({
  enabled: true,
  headerEnabled: true,
  headerName: 'x-opencode-session',
  headerValue: 'fixed-value',
  headerRoutes: '',
  headerAppliedName: '',
  headerAppliedValue: '',
  headerStatus: '',
  ...overrides,
})

/**
 * 用给定的 settings 形状跑一次 apply。
 * @param shape `'legacy'`（0.1.6：get + register + mutate）或 `'modern'`（0.1.7：describe + mutate）。
 * @param seed 初始的「命名空间 → 值」快照。
 * @param config 传给 apply 的 Config 解析值（0.1.7 就是它给宿主读自己的行）。
 * @param readOwnFrom `'describe'` 或 `'config'`：自己的行从哪读得到。
 */
async function boot(shape, seed, config, readOwnFrom = 'describe') {
  const state = structuredClone(seed)
  const calls = []
  const registered = []
  const settings = {
    mutate: async (ns, ops) => {
      calls.push({ ns, ops })
      if (state[ns] === undefined) state[ns] = {}
      for (const op of ops) {
        if (op.op === 'set') setPath(state[ns], op.path, op.value)
        else unsetPath(state[ns], op.path)
      }
    },
  }
  if (shape === 'legacy') {
    settings.get = ns => state[ns]
    settings.register = (ns, schema) => { registered.push({ ns, schema }) }
  } else {
    settings.describe = () => Object.entries(state)
      .filter(([ns]) => !(readOwnFrom === 'config' && ns === NAMESPACE))
      .map(([ns, value]) => ({ ns, value }))
  }
  const services = {
    settings,
    effect: (fn) => {
      const dispose = fn()
      return () => { if (typeof dispose === 'function') dispose() }
    },
    get: name => services[name],
  }
  const ctx = {
    inject: (deps, callback) => {
      if (!deps.every(dep => services[dep] !== undefined)) return
      callback(services)
    },
    effect: services.effect,
    on: () => {},
  }
  let error = null
  try {
    apply(ctx, config)
    await settle()
  } catch (thrown) {
    // 抛出来就是这一代上"挂不上"——把它变成一条 ✗ 而不是让整个测试崩掉，
    // 这样变异测试能指名道姓地看到是哪个断言咬住的。
    error = thrown
  }
  return { state, calls, registered, error }
}

// ── 1. Config 的形状（0.1.7 服务靠它判定"这一行可编辑"）──────────────────────
console.log('1. 导出的 Config 必须给**每个字段**带 volatile 标记（不标根）')
check('Config 已导出且是 schema', typeof Config === 'function')
check(
  '每个字段都带 volatile 标记',
  Object.values(Config?.dict ?? {}).every(child => child?.meta?.volatile === true),
  Object.entries(Config?.dict ?? {}).filter(([, child]) => child?.meta?.volatile !== true).map(([key]) => key).join(' / '),
)
/**
 * 根**不能**标 volatile：schemastery 3.18.4 会把整棵解析结果包成**一个根引用**，
 * 而 loader 把配置变更提交回运行中引用（`_commitVolatile`）是按**叶子路径**设计的
 * —— 官方插件一律逐字段标，没有一个标根（2026-09-23 真机：根标记导致"写入落了盘、
 * 界面还是旧值"）。
 */
check('根节点不标 volatile（标了会把整棵树变成一个引用）',
  Config?.meta?.volatile !== true, String(Config?.meta?.volatile))
check('字段标记能被序列化带出去（0.1.7 的表单投影靠 toJSON）',
  Object.values(Config.toJSON()?.dict ?? {}).every(child => child?.meta?.volatile === true),
  JSON.stringify(Config.toJSON()?.dict?.enabled?.meta ?? null))
check('整棵 schema 里确实带 volatile 数据（给表单投影用）',
  JSON.stringify(Config.toJSON()).includes('"volatile":true'))
{
  /**
   * 解开 volatile 引用：随包的 schemastery 升到 3.18.4 后，带 `volatile` 标记的字段
   * 在解析结果里就是**引用**（只有 `get()`），普通对象壳还在。这两条断言要的是
   * "解析后的值"（缺省仍是缺省、未声明的旧键放行），所以先解引用。
   */
  const plain = value => (value !== null && typeof value === 'object'
    ? typeof value.get === 'function'
      ? plain(value.get())
      : Array.isArray(value)
        ? value.map(plain)
        : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]))
    : value)
  const parsed = plain(Config({ enabled: true }))
  check('可选键缺省时仍是缺省（迁移判据靠它）', parsed.keysEnabled === undefined, String(parsed.keysEnabled))
  check('未声明的旧键原样放行（升级不炸）', plain(Config({ panelScroll: true })).panelScroll === true)
  check('标了 volatile 的字段解引用后仍是普通值（表单要读它）',
    parsed.enabled === true && parsed.sendKey === 'Enter',
    JSON.stringify({ enabled: parsed.enabled, sendKey: parsed.sendKey }))
}

// ── 2. 0.1.6 形状：走 get + register ────────────────────────────────────────
console.log('2. 0.1.6 形状（有 get / register）')
{
  const app = await boot('legacy', { [NAMESPACE]: baseOwn(), [LLM]: baseLlm() })
  check('0.1.6 形状下 apply 不抛', app.error === undefined || app.error === null,
    app.error === null || app.error === undefined ? '' : String(app.error))
  check('调用了 register(composer-ux, Config)', app.registered.length === 1 && app.registered[0].ns === NAMESPACE,
    JSON.stringify(app.registered.map(entry => entry.ns)))
  const header = app.state[LLM].providers['opencode-go'].headers?.['x-opencode-session']
  check('请求头镜像照旧写入', header === 'fixed-value', String(header))
}

// ── 3. 0.1.7 形状：没有 get、没有 register ──────────────────────────────────
console.log('3. 0.1.7 形状（只有 describe / mutate）')
{
  const app = await boot('modern', { [NAMESPACE]: baseOwn(), [LLM]: baseLlm() })
  check('0.1.7 形状下 apply 不抛（register 已被官方删除）', app.error === undefined || app.error === null,
    app.error === null || app.error === undefined ? '' : String(app.error))
  check('没有 register 也不抛（register 已被官方删除）', app.registered.length === 0)
  const header = app.state[LLM].providers['opencode-go'].headers?.['x-opencode-session']
  check('自己那一行从 describe 读得到 → 镜像仍写入', header === 'fixed-value', String(header))
  check('渲染了记账字段（写回的是我们自己的命名空间）',
    app.calls.some(call => call.ns === NAMESPACE), JSON.stringify(app.calls.map(call => call.ns)))
}

// ── 4. 0.1.7 形状 + 自己的行只存在于 Config ─────────────────────────────────
console.log('4. 0.1.7 形状，自己的行只从 Config 读')
{
  const app = await boot('modern', { [LLM]: baseLlm() }, baseOwn(), 'config')
  const header = app.state[LLM].providers['opencode-go'].headers?.['x-opencode-session']
  check('Config 分支也能读出自己那一行', header === 'fixed-value', String(header))
}

// ── 5. 设置服务整个缺席：不抛 ───────────────────────────────────────────────
console.log('5. 设置服务缺席（组合里没有 provider）')
{
  let threw = null
  try {
    apply({ inject: () => {}, effect: () => {}, on: () => {} }, undefined)
    await settle()
  } catch (error) {
    threw = error
  }
  check('apply 不抛', threw === null, threw === null ? '' : String(threw))
}

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
