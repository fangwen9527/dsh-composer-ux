/**
 * 宿主半「OpenCode 请求头」的行为测试（0.22.0 起：**运行期可逆覆盖**，不再写用户配置）。
 *
 * 它直接 import 构建产物 lib/index.js，用一个假的 settings/Cordis 上下文驱动，
 * 因此不需要重启 DSH 就能验证：
 *   · 启用后**一个字节都不写**用户的模型路由配置（这是本文件最重要的断言）；
 *   · 头是通过 `internal/config` 事件在**配置被解析时**补进去的（官方 `llm-pi-ai`
 *     自己也挂这个事件，dsh-ops 用它做过同样的事）；
 *   · 停用 / 改名 / 改值后覆盖跟着变，用户自己写的头一个都不碰；
 *   · 0.21.x 及以前写进用户配置的那些头会被**一次性**清掉，且不会误删用户的同名头。
 *
 *   node test/host-header-mirror.mjs
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import { apply } from '../lib/index.js'

// 0.25.0 的探测判据是纯函数（看宿主 pi-ai 里有没有那个模块），所以把它也打成一份来单测
// （与 holiday-sync / subagent-cost 同一套做法：纯逻辑走 `test/pure-entry.ts` 的出口）。
mkdirSync(new URL('./.build/', import.meta.url), { recursive: true })
await build({
  entryPoints: ['test/pure-entry.ts'],
  outfile: 'test/.build/header-mirror.mjs',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['es2022'],
  logLevel: 'warning',
})
const pure = await import(new URL('./.build/header-mirror.mjs', import.meta.url))
/** 「强制指定探测结果」的环境变量名（两端共用，纯模块里定义）。 */
const NATIVE_ENV = pure.NATIVE_SUPPORT_ENV

// 把 $DSH_HOME 指到一个空目录：宿主半启动时会读一次「快捷指令」文件做一次迁移
// （有非内置内容就把 quickEnabled 写进文档）。不隔离的话这里会去读**真实用户**的
// quick-prompts.json，测试结果就取决于跑测试的人机器上有什么。
process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'dsh-hhm-home-'))

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

// ── 假的 settings 服务（路径读写语义与 SettingsPathOp 一致） ──────────────────
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

async function boot(seed) {
  const state = structuredClone(seed)
  const calls = []
  const listeners = []
  /** `internal/config` 的处理器（运行期覆盖就挂在这儿）。 */
  const configHandlers = []
  /** 注册进来的 schema：右键菜单那三个「可选键」的语义就是靠它保证的，见第 18 节。 */
  let schema = null
  const settings = {
    get: ns => state[ns],
    register: (ns, registered) => { schema = registered },
    mutate: async (ns, ops) => {
      calls.push({ ns, ops })
      for (const op of ops) {
        if (op.op === 'set') setPath(state[ns], op.path, op.value)
        else unsetPath(state[ns], op.path)
      }
    },
  }
  /**
   * 假的 loader 服务：0.22.0 的运行期覆盖要挂在它上面。
   * `entries()` 返回空数组（真实环境里用来找 llm-pi-ai 那一行；我们的匹配是看形状，不靠它）。
   */
  const loader = {
    entries: () => [],
    on: (name, listener) => {
      if (name === 'internal/config') configHandlers.push(listener)
    },
  }
  const services = {
    settings,
    loader,
    /** Cordis 的 ctx.effect：执行一次并登记清理函数。 */
    effect: (fn) => {
      const dispose = fn()
      return () => { if (typeof dispose === 'function') dispose() }
    },
    get: (name) => services[name],
    // 真实 Cordis 里 inject 给的是**该服务的 ctx**，它当然带 `on`（运行期覆盖就挂在这上面）。
    on: (name, listener) => { loader.on(name, listener) },
  }
  const ctx = {
    // 只在该服务确实挂载时才进入回调 —— 与 Cordis 的 inject 语义一致。
    // 本用例不提供 webServer/llm/sandbox，因此那几段会被跳过（各自有单独的套件）。
    inject: (deps, callback) => {
      if (!deps.every(dep => services[dep] !== undefined)) return
      callback(services)
    },
    effect: services.effect,
    on: (name, listener) => { listeners.push({ name, listener }) },
  }
  apply(ctx)
  await settle()
  return {
    state,
    calls,
    /** 本插件注册的设置 schema（可当函数调用，得到解析后的值）。 */
    get schema() { return schema },
    /**
     * 把一份 llm-pi-ai 配置"过一遍 internal/config 瀑布"，拿到插件会实际送出去的配置。
     * 真实宿主是倒着跑处理器的；这里只有本插件一个处理器，顺序不影响结果。
     */
    overlay(raw) {
      let out = raw
      for (const listener of configHandlers) out = listener.call(undefined, raw, () => out)
      return out
    },
    /** 模拟设置变更事件，触发宿主半重新对齐。 */
    async touch(ns) {
      calls.length = 0
      for (const entry of listeners) entry.listener(ns)
      await settle()
    },
  }
}

const settle = () => new Promise(resolve => { setTimeout(resolve, 40) })

const baseLlm = () => ({
  providers: {
    'opencode-go': { apiKeyEnv: 'OPENCODE_GO_API_KEY', models: [{ id: 'glm-5.3-flash' }] },
    ds: { apiKeyEnv: 'DS_API_KEY', models: [{ id: 'deepseek-flash' }] },
  },
})

const baseOwn = overrides => ({
  enabled: true,
  headerEnabled: false,
  headerName: 'x-opencode-session',
  headerValue: '',
  headerRoutes: '',
  headerAppliedName: '',
  headerAppliedValue: '',
  headerStatus: '',
  ...overrides,
})

/** 目标路由的请求头字典（**真实用户配置**里的那份）。 */
const headersOf = (state, route) => state[LLM].providers[route]?.headers
/** 覆盖之后实际会被送出去的请求头。 */
const sentHeaders = (app, route) => app.overlay(app.state[LLM]).providers[route]?.headers

// ── 1. 未启用：一个字都不写 ─────────────────────────────────────────────────
{
  console.log('1. 未启用时不产生任何写入，也不生成值')
  const app = await boot({ [NAMESPACE]: baseOwn(), [LLM]: baseLlm() })
  check('llm-pi-ai 未被改动', headersOf(app.state, 'opencode-go') === undefined)
  // 迁移标记会写（清理 0.21.x 的旧写入**与功能开不开无关**，该清就清），但用户配置一个字不碰。
  check('只写了自己的迁移标记，没有别的写入',
    app.calls.every(call => call.ns === NAMESPACE), JSON.stringify(app.calls))
  check('llm-pi-ai 那条链上零写入',
    app.calls.every(call => call.ns !== LLM), JSON.stringify(app.calls.map(call => call.ns)))
  check('也没注入任何头', sentHeaders(app, 'opencode-go') === undefined)
}

// ── 2. 启用（值留空）：自动生成稳定 ID，且**只写本插件自己的命名空间** ──────
{
  console.log('2. 启用（值留空）→ 自动生成稳定 ID；用户配置一个字节都不写')
  const app = await boot({ [NAMESPACE]: baseOwn({ headerEnabled: true }), [LLM]: baseLlm() })
  const value = app.state[NAMESPACE].headerValue
  check('生成了 36 字符 UUID', typeof value === 'string' && value.length === 36, value)
  check('❗用户配置里**没有**任何请求头被写进去', headersOf(app.state, 'opencode-go') === undefined)
  check('❗所有 mutate 都落在本插件自己的命名空间',
    app.calls.every(call => call.ns === NAMESPACE), JSON.stringify(app.calls.map(call => call.ns)))
  check('运行期覆盖把头发给了 opencode-go', sentHeaders(app, 'opencode-go')?.['x-opencode-session'] === value)
  check('非 opencode 路由不注入（ds）', sentHeaders(app, 'ds')?.['x-opencode-session'] === undefined)
  check('记账头名', app.state[NAMESPACE].headerAppliedName === 'x-opencode-session')
  check('状态说清了是运行期注入',
    app.state[NAMESPACE].headerStatus === '运行期注入 opencode-go（只在本插件运行时生效，不改你的配置）',
    app.state[NAMESPACE].headerStatus)
  check('用户模型清单没被动过', app.state[LLM].providers['opencode-go'].models.length === 1)
  check('原配置对象没被就地改动（overlay 返回的是新对象）',
    !Object.hasOwn(app.state[LLM].providers['opencode-go'], 'headers'))

  console.log('3. 幂等：再次同步不产生任何写入')
  await app.touch(LLM)
  check('第二轮零 mutate', app.calls.length === 0, JSON.stringify(app.calls))
}

// ── 3. 停用：不再注入；用户自己写的同名头永远不动 ───────────────────────────
{
  console.log('4. 停用 → 不再注入')
  const app = await boot({ [NAMESPACE]: baseOwn({ headerEnabled: true }), [LLM]: baseLlm() })
  check('先确认在注入', typeof sentHeaders(app, 'opencode-go')?.['x-opencode-session'] === 'string')
  app.state[NAMESPACE].headerEnabled = false
  await app.touch(NAMESPACE)
  check('停用后不再注入', sentHeaders(app, 'opencode-go')?.['x-opencode-session'] === undefined)
  check('用户配置仍然一个字没写', headersOf(app.state, 'opencode-go') === undefined)
  check('记账已清空', app.state[NAMESPACE].headerAppliedName === '')
}

{
  console.log('5. ❗用户自己写的同名头不会被覆盖、也不会被删')
  const seed = { [NAMESPACE]: baseOwn({ headerEnabled: true }), [LLM]: baseLlm() }
  seed[LLM].providers['opencode-go'].headers = { 'x-opencode-session': 'user-owned-value' }
  const app = await boot(seed)
  check('用户值在磁盘上被保留', headersOf(app.state, 'opencode-go')['x-opencode-session'] === 'user-owned-value')
  check('运行期注入用的是插件自己的值（不改用户那份）',
    sentHeaders(app, 'opencode-go')['x-opencode-session'] === app.state[NAMESPACE].headerValue)
}

{
  console.log('6. 覆盖不动同一个 profile 里的其它头')
  const seed = { [NAMESPACE]: baseOwn({ headerEnabled: true }), [LLM]: baseLlm() }
  seed[LLM].providers['opencode-go'].headers = { 'x-custom': 'keep-me' }
  const app = await boot(seed)
  const sent = sentHeaders(app, 'opencode-go')
  check('其它头原样保留', sent['x-custom'] === 'keep-me')
  check('目标头也在（两者共存）', typeof sent['x-opencode-session'] === 'string')
}

// ── 4. 改名 / 改值 ──────────────────────────────────────────────────────────
{
  console.log('7. 改头名 → 送来的是新头名，用户配置依旧干净')
  const app = await boot({ [NAMESPACE]: baseOwn({ headerEnabled: true }), [LLM]: baseLlm() })
  const value = app.state[NAMESPACE].headerValue
  app.state[NAMESPACE].headerName = 'x-session-affinity'
  await app.touch(NAMESPACE)
  const sent = sentHeaders(app, 'opencode-go')
  check('新头名在（同值）', sent['x-session-affinity'] === value)
  check('旧头名不在', sent['x-opencode-session'] === undefined)
  check('记账跟着改名', app.state[NAMESPACE].headerAppliedName === 'x-session-affinity')
  check('用户配置仍然干净', headersOf(app.state, 'opencode-go') === undefined)
}

// ── 5. 路由选择与异常输入 ───────────────────────────────────────────────────
{
  console.log('8. 显式指定不存在的路由 → 不新建 provider')
  const app = await boot({
    [NAMESPACE]: baseOwn({ headerEnabled: true, headerRoutes: 'opencode, opencode-go' }),
    [LLM]: baseLlm(),
  })
  check('opencode-go 注入了', typeof sentHeaders(app, 'opencode-go')?.['x-opencode-session'] === 'string')
  check('覆盖后也没有凭空造出 opencode 路由', app.overlay(app.state[LLM]).providers.opencode === undefined)
  check('状态说明了目标路由',
    app.state[NAMESPACE].headerStatus === '运行期注入 opencode-go（只在本插件运行时生效，不改你的配置）',
    app.state[NAMESPACE].headerStatus)
}

{
  console.log('9. 头名非法 → 拒绝注入并给出原因')
  const app = await boot({
    [NAMESPACE]: baseOwn({ headerEnabled: true, headerName: 'x open code' }),
    [LLM]: baseLlm(),
  })
  check('没有注入', sentHeaders(app, 'opencode-go')?.['x-opencode-session'] === undefined)
  check('状态提示头名不合法', app.state[NAMESPACE].headerStatus === '头名不合法，未注入', app.state[NAMESPACE].headerStatus)
}

{
  console.log('10. llm-pi-ai 未挂载 → 不抛错，只提示')
  const app = await boot({ [NAMESPACE]: baseOwn({ headerEnabled: true }) })
  check('状态提示未挂载', /未挂载/.test(app.state[NAMESPACE].headerStatus), app.state[NAMESPACE].headerStatus)
}

{
  console.log('11. 总开关关闭 → 覆盖也不生效（全局停用 = 全部功能停用）')
  const app = await boot({ [NAMESPACE]: baseOwn({ headerEnabled: true }), [LLM]: baseLlm() })
  check('先确认在注入', typeof sentHeaders(app, 'opencode-go')?.['x-opencode-session'] === 'string')
  app.state[NAMESPACE].enabled = false
  await app.touch(NAMESPACE)
  check('关掉后不再注入', sentHeaders(app, 'opencode-go')?.['x-opencode-session'] === undefined)
  check('用户配置仍然干净', headersOf(app.state, 'opencode-go') === undefined)
}

{
  console.log('12. 自动匹配：按 baseURL 认出改了名字的 OpenCode 路由')
  const seed = {
    [NAMESPACE]: baseOwn({ headerEnabled: true }),
    [LLM]: {
      providers: {
        'opencode-go': { apiKeyEnv: 'OPENCODE_GO_API_KEY', models: [{ id: 'm1' }] },
        go: { apiKeyEnv: 'GO_API_KEY', baseURL: 'https://opencode.ai/zen/go/v1', models: [{ id: 'm2' }] },
        'opencode-zen': { apiKeyEnv: 'K', baseURL: 'https://zen.opencode.ai/v1', models: [{ id: 'm3' }] },
        ds: { apiKeyEnv: 'DS_API_KEY', baseURL: 'https://api.deepseek.com', models: [{ id: 'm4' }] },
        mimic: { apiKeyEnv: 'K2', baseURL: 'https://opencode.ai.evil.example/v1', models: [{ id: 'm5' }] },
      },
    },
  }
  const app = await boot(seed)
  const value = app.state[NAMESPACE].headerValue
  const hit = route => sentHeaders(app, route)?.['x-opencode-session'] === value
  check('内置 opencode-go（按名字）注入', hit('opencode-go'))
  check('自建别名 go（按 URL）注入', hit('go'))
  check('子域 zen.opencode.ai 注入', hit('opencode-zen'))
  check('deepseek 路由不注入', sentHeaders(app, 'ds')?.['x-opencode-session'] === undefined)
  check('仿冒主机 opencode.ai.evil.example 不注入', sentHeaders(app, 'mimic')?.['x-opencode-session'] === undefined)
  check('状态列出全部命中路由',
    app.state[NAMESPACE].headerStatus === '运行期注入 opencode-go、go、opencode-zen（只在本插件运行时生效，不改你的配置）',
    app.state[NAMESPACE].headerStatus)
}

{
  console.log('13. 显式名单优先：只注入名单里且确实存在的路由')
  const seed = {
    [NAMESPACE]: baseOwn({ headerEnabled: true, headerRoutes: 'go, not-there' }),
    [LLM]: {
      providers: {
        'opencode-go': { apiKeyEnv: 'K', models: [{ id: 'm1' }] },
        go: { apiKeyEnv: 'K', baseURL: 'https://opencode.ai/zen/go/v1', models: [{ id: 'm2' }] },
      },
    },
  }
  const app = await boot(seed)
  check('名单里的 go 注入', typeof sentHeaders(app, 'go')?.['x-opencode-session'] === 'string')
  check('未列入的 opencode-go 不注入', sentHeaders(app, 'opencode-go')?.['x-opencode-session'] === undefined)
}

{
  console.log('14. baseURL 不是合法 URL 时退回子串判断')
  const seed = {
    [NAMESPACE]: baseOwn({ headerEnabled: true }),
    [LLM]: { providers: { weird: { apiKeyEnv: 'K', baseURL: 'opencode.ai/zen/go/v1', models: [{ id: 'm1' }] } } },
  }
  const app = await boot(seed)
  check('含 opencode.ai 的裸串仍注入', typeof sentHeaders(app, 'weird')?.['x-opencode-session'] === 'string')
}

// ── 6. 一次性清理（0.22.0 的迁移） ─────────────────────────────────────────
{
  console.log('15. ❗迁移：0.21.x 写进用户配置的头被清掉一次，且不误删用户自己的头')
  const seed = {
    [NAMESPACE]: baseOwn({
      headerEnabled: true,
      headerValue: 'v-old',
      headerAppliedName: 'x-opencode-session',
      headerAppliedValue: 'v-old',
    }),
    [LLM]: baseLlm(),
  }
  seed[LLM].providers['opencode-go'].headers = {
    'x-opencode-session': 'v-old', // 我们以前写的（值等于记账值）⇒ 该清
    'x-user-own': 'mine', // 用户自己写的 ⇒ 不许动
  }
  seed[LLM].providers.ds.headers = { 'x-opencode-session': 'v-old' }
  const app = await boot(seed)
  check('我们写过的那条被清掉', headersOf(app.state, 'opencode-go')['x-opencode-session'] === undefined)
  check('另一条路由上同名的也清掉', headersOf(app.state, 'ds')['x-opencode-session'] === undefined)
  check('用户自己写的头原样保留', headersOf(app.state, 'opencode-go')['x-user-own'] === 'mine')
  check('打了迁移标记', app.state[NAMESPACE].headerCleanupVersion === 1, String(app.state[NAMESPACE].headerCleanupVersion))

  console.log('16. 迁移只跑一次（第二轮不再动用户配置）')
  await app.touch(LLM)
  check('第二轮没有针对 llm-pi-ai 的写入',
    app.calls.every(call => call.ns === NAMESPACE), JSON.stringify(app.calls.map(call => call.ns)))

  console.log('17. 值与被清理的值不同 ⇒ 不清（可能是用户自己改的）')
  const other = {
    [NAMESPACE]: baseOwn({
      headerEnabled: false,
      headerValue: 'v-old',
      headerAppliedName: 'x-opencode-session',
      headerAppliedValue: 'v-old',
    }),
    [LLM]: baseLlm(),
  }
  other[LLM].providers['opencode-go'].headers = { 'x-opencode-session': 'user-changed-it' }
  const app2 = await boot(other)
  check('值对不上就不动它', headersOf(app2.state, 'opencode-go')['x-opencode-session'] === 'user-changed-it')
}

// ── 7. 右键菜单那几个「可选键」的解析语义（迁移全靠它） ─────────────────────
{
  console.log('18. 右键菜单那几个「可选键」的解析语义（迁移全靠它）')
  // 0.5.0 把右键菜单从布尔 menuNative 换成三档 menuMode，迁移要能分清三件事：
  //   ① 文档里根本没有这些键（从没设过 → 新默认档）
  //   ② 明确写成 false（用户关过旧开关 → 保持自定义菜单）
  //   ③ 明确写了新字段（照它来）
  // 这三件事分得清，前提是 schema 把它们声明成**可选且无默认值**。所以这里用
  // 插件真正注册进去的那个 schema 来验，而不是验我们的注释。
  const app = await boot({ [NAMESPACE]: baseOwn({}) })
  const schema = app.schema
  check('插件确实注册了 schema', schema !== null && typeof schema === 'function')

  /**
   * 解开 volatile 引用。
   *
   * 随包的 schemastery 升到 3.18.4 后，被标 `volatile` 的节点在**解析结果里就是引用**
   * （只有 `get()`）而不是普通值；宿主半读值时同样先 `plainConfig` 解一遍。
   * 本节断言的对象是"解析后的值"，所以统一解引用 —— 要分的那三件事（没设过 /
   * 明确写 false / 写了新字段）本身没有变。
   */
  const plain = value => (value !== null && typeof value === 'object'
    ? typeof value.get === 'function'
      ? plain(value.get())
      : Array.isArray(value)
        ? value.map(plain)
        : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]))
    : value)

  const empty = plain(schema({}))
  check('两个键都没有 → 解析后仍然没有（「从没设过」可辨）',
    empty.menuMode === undefined && empty.menuNative === undefined,
    JSON.stringify({ menuMode: empty.menuMode, menuNative: empty.menuNative }))

  const off = plain(schema({ menuNative: false }))
  check('明确写 false → 保留 false（「关过旧开关」可辨）', off.menuNative === false)

  const on = plain(schema({ menuNative: true }))
  check('明确写 true → 保留 true（旧档位不是浏览器菜单）', on.menuNative === true)

  const mode = plain(schema({ menuMode: 'custom' }))
  check('新字段写了就照它来', mode.menuMode === 'custom')

  const other = plain(schema({}))
  check('其它字段的默认值照旧生效（可选键没把整张表带坏）', other.enabled === true)

  const cleanup = plain(schema({}))
  check('迁移标记默认不写（未设置 ⇒ 迁移会跑一次）', cleanup.headerCleanupVersion === undefined)
}

// ── 19. 0.25.0：宿主自己会发这个头时，一律不注入 ──────────────────────────────
{
  console.log('19. 宿主原生支持（pi-ai 自带 opencode-headers）⇒ 不注入、状态说清、开关也没用')
  // 强制开关（两端共用的环境变量名）：这条用例不依赖本机装了哪版 pi-ai —— 探测逻辑本身
  // 在第 20 节用假目录单测。
  process.env[NATIVE_ENV] = '1'
  try {
    const app = await boot({ [NAMESPACE]: baseOwn({ headerEnabled: true }), [LLM]: baseLlm() })
    check('❗原生支持时**一个头都不注入**（补固定值只会顶掉真实 session id）',
      sentHeaders(app, 'opencode-go') === undefined && sentHeaders(app, 'ds') === undefined,
      JSON.stringify(sentHeaders(app, 'opencode-go')))
    check('❗也不生成 UUID（生成的值本来也不会被用到）',
      app.state[NAMESPACE].headerValue === '', JSON.stringify(app.state[NAMESPACE].headerValue))
    check('不记"已注入"的账（记账留着会与状态行自相矛盾）',
      app.state[NAMESPACE].headerAppliedName === '' && app.state[NAMESPACE].headerAppliedValue === '')
    check('状态行以「宿主已原生支持」开头，并说清是按每段对话的真实 id 发',
      app.state[NAMESPACE].headerStatus.startsWith('宿主已原生支持')
      && app.state[NAMESPACE].headerStatus.includes('真实 session id'),
      app.state[NAMESPACE].headerStatus)
    check('用户配置依旧零写入', app.calls.every(call => call.ns === NAMESPACE),
      JSON.stringify(app.calls.map(call => call.ns)))

    // 关掉开关也一样说"原生支持"（这不是没生效，是不需要）—— 客户端据此换卡片文案。
    app.state[NAMESPACE].headerEnabled = false
    await app.touch(NAMESPACE)
    check('关掉开关后状态仍然是「宿主已原生支持」（不是"未启用"那种像故障的话）',
      app.state[NAMESPACE].headerStatus.startsWith('宿主已原生支持'),
      app.state[NAMESPACE].headerStatus)
  } finally {
    delete process.env[NATIVE_ENV]
  }

  // 反面：没有强制、本机也探不到宿主（测试进程就是这种）⇒ 旧行为照旧注入。
  const legacy = await boot({ [NAMESPACE]: baseOwn({ headerEnabled: true }), [LLM]: baseLlm() })
  check('探不到宿主（旧环境）⇒ 仍然按原样注入（失败方向是多做一次旧行为，不是让旧宿主静默失效）',
    typeof sentHeaders(legacy, 'opencode-go')?.['x-opencode-session'] === 'string',
    JSON.stringify(sentHeaders(legacy, 'opencode-go')))
  check('旧环境的状态行仍是"运行期注入 …"',
    legacy.state[NAMESPACE].headerStatus.startsWith('运行期注入'),
    legacy.state[NAMESPACE].headerStatus)
}

// ── 20. 探测判据：看 pi-ai 里有没有那个模块文件，版本号只进证据 ────────────────
{
  console.log('20. 探测判据（纯函数 + 假目录）')
  const tmp = mkdtempSync(join(tmpdir(), 'dsh-header-detect-'))

  /** 造一个假 pi-ai 安装：有/没有 opencode-headers.js。 */
  const fakePiAi = (version, withModule) => {
    const root = join(tmp, `pi-ai-${version}-${withModule ? 'native' : 'plain'}`)
    mkdirSync(join(root, 'dist', 'providers'), { recursive: true })
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: '@earendil-works/pi-ai', version }))
    if (withModule) writeFileSync(join(root, 'dist', 'providers', 'opencode-headers.js'), 'export {}\n')
    return root
  }
  const nativeRoot = fakePiAi('1.1.0', true)
  const plainRoot = fakePiAi('0.87.1', false)

  check('版本比较：1.0.2 ≥ 1.0.2 / 1.1.0 ≥ 1.0.2 / 0.87.1 < 1.0.2',
    pure.versionAtLeast('1.0.2', '1.0.2') && pure.versionAtLeast('1.1.0', '1.0.2')
    && !pure.versionAtLeast('0.87.1', '1.0.2'))
  check('版本比较按数字比，不按字符串（1.10.0 > 1.9.9）', pure.versionAtLeast('1.10.0', '1.9.9'))

  const seenNative = pure.detectNativeSessionHeader({}, [nativeRoot])
  check('目录里有 opencode-headers.js ⇒ native，证据里带 pi-ai 版本',
    seenNative.support === 'native' && seenNative.evidence.includes('1.1.0'),
    JSON.stringify(seenNative))
  const seenPlain = pure.detectNativeSessionHeader({}, [plainRoot])
  check('目录里没有那个模块 ⇒ legacy（版本再新也不算）',
    seenPlain.support === 'legacy' && seenPlain.evidence === '', JSON.stringify(seenPlain))
  check('目录都不存在 ⇒ legacy（按旧宿主处理）',
    pure.detectNativeSessionHeader({}, [join(tmp, 'nope')]).support === 'legacy')
  check('环境变量强制 ' + NATIVE_ENV + '=1 ⇒ native（不依赖文件布局）',
    pure.detectNativeSessionHeader({ [NATIVE_ENV]: '1' }, [plainRoot]).support === 'native')
  check('环境变量强制 =0 ⇒ legacy（即便目录里真有模块）',
    pure.detectNativeSessionHeader({ [NATIVE_ENV]: '0' }, [nativeRoot]).support === 'legacy')
  check('环境变量只认 1/true/0/false，别的值不当强制',
    pure.detectNativeSessionHeader({ [NATIVE_ENV]: 'yes' }, [plainRoot]).support === 'legacy')
  check('状态前缀常量与宿主半写出来的那句话是同一个（客户端靠它认"不需要"）',
    pure.NATIVE_STATUS_PREFIX === '宿主已原生支持' && seenNative.support === 'native')
}

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
