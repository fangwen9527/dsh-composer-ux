/**
 * 宿主半「OpenCode 请求头镜像」的行为测试。
 *
 * 它直接 import 构建产物 lib/index.js，用一个假的 settings/Cordis 上下文驱动，
 * 因此不需要重启 DSH 就能验证：写入、撤销、改名、幂等、以及「绝不误删用户自己写的头」。
 *
 *   node test/host-header-mirror.mjs
 */
import { apply } from '../lib/index.js'

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
  const settings = {
    get: ns => state[ns],
    register: () => {},
    mutate: async (ns, ops) => {
      calls.push({ ns, ops })
      for (const op of ops) {
        if (op.op === 'set') setPath(state[ns], op.path, op.value)
        else unsetPath(state[ns], op.path)
      }
    },
  }
  const ctx = {
    inject: (_deps, callback) => { callback({ settings }) },
    on: (name, listener) => { listeners.push({ name, listener }) },
  }
  apply(ctx)
  await settle()
  return {
    state,
    calls,
    /** 模拟设置变更事件，触发宿主半重新对齐。 */
    async touch(ns) {
      calls.length = 0
      for (const entry of listeners) entry.listener(ns)
      await settle()
    },
  }
}

const settle = () => new Promise(resolve => { setTimeout(resolve, 15) })

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

/** 目标路由的请求头字典。 */
const headersOf = (state, route) => state[LLM].providers[route]?.headers

// ── 1. 未启用：一个字都不写 ─────────────────────────────────────────────────
{
  console.log('1. 未启用时不产生任何写入')
  const app = await boot({ [NAMESPACE]: baseOwn(), [LLM]: baseLlm() })
  check('llm-pi-ai 未被改动', headersOf(app.state, 'opencode-go') === undefined)
  check('没有 mutate 调用', app.calls.length === 0, JSON.stringify(app.calls))
}

// ── 2. 启用且值为空：自动生成并写入 opencode 系路由 ──────────────────────────
{
  console.log('2. 启用（值留空）→ 自动生成稳定 ID 并只写 opencode 系路由')
  const app = await boot({ [NAMESPACE]: baseOwn({ headerEnabled: true }), [LLM]: baseLlm() })
  const value = app.state[NAMESPACE].headerValue
  check('生成了 36 字符 UUID', typeof value === 'string' && value.length === 36, value)
  check('写进 opencode-go', headersOf(app.state, 'opencode-go')?.['x-opencode-session'] === value)
  check('没碰非 opencode 路由（ds）', headersOf(app.state, 'ds') === undefined)
  check('记账头名', app.state[NAMESPACE].headerAppliedName === 'x-opencode-session')
  check('状态可读', app.state[NAMESPACE].headerStatus === '已写入 opencode-go', app.state[NAMESPACE].headerStatus)
  check('用户模型清单没被动过', app.state[LLM].providers['opencode-go'].models.length === 1)

  console.log('3. 幂等：再次同步不产生任何写入')
  await app.touch(LLM)
  check('第二轮零 mutate', app.calls.length === 0, JSON.stringify(app.calls))
}

// ── 3. 停用：撤销自己写的，且不动别人 ───────────────────────────────────────
{
  console.log('4. 停用 → 撤销写入')
  const app = await boot({ [NAMESPACE]: baseOwn({ headerEnabled: true }), [LLM]: baseLlm() })
  const written = app.state[NAMESPACE].headerValue
  check('先确认已写入', headersOf(app.state, 'opencode-go')['x-opencode-session'] === written)
  app.state[NAMESPACE].headerEnabled = false
  await app.touch(NAMESPACE)
  check('头已撤销', headersOf(app.state, 'opencode-go')['x-opencode-session'] === undefined)
  check('记账已清空', app.state[NAMESPACE].headerAppliedName === '')
}

{
  console.log('5. 停用时不动「用户自己写的」同名头')
  const seed = { [NAMESPACE]: baseOwn({ headerEnabled: false }), [LLM]: baseLlm() }
  seed[LLM].providers['opencode-go'].headers = { 'x-opencode-session': 'user-owned-value' }
  const app = await boot(seed)
  check('用户值被保留', headersOf(app.state, 'opencode-go')['x-opencode-session'] === 'user-owned-value')
}

{
  console.log('6. 启用时不动同一个 profile 里的其它头')
  const seed = { [NAMESPACE]: baseOwn({ headerEnabled: true }), [LLM]: baseLlm() }
  seed[LLM].providers['opencode-go'].headers = { 'x-custom': 'keep-me' }
  const app = await boot(seed)
  check('其它头保留', headersOf(app.state, 'opencode-go')['x-custom'] === 'keep-me')
  check('目标头已写入', typeof headersOf(app.state, 'opencode-go')['x-opencode-session'] === 'string')
}

// ── 4. 改名：旧键撤销、新键写入 ─────────────────────────────────────────────
{
  console.log('7. 改头名 → 旧键撤销、新键写入')
  const app = await boot({ [NAMESPACE]: baseOwn({ headerEnabled: true }), [LLM]: baseLlm() })
  const value = app.state[NAMESPACE].headerValue
  app.state[NAMESPACE].headerName = 'x-session-affinity'
  await app.touch(NAMESPACE)
  const headers = headersOf(app.state, 'opencode-go')
  check('旧头名已撤销', headers['x-opencode-session'] === undefined)
  check('新头名已写入同值', headers['x-session-affinity'] === value)
  check('记账跟着改名', app.state[NAMESPACE].headerAppliedName === 'x-session-affinity')
}

// ── 5. 路由选择与异常输入 ───────────────────────────────────────────────────
{
  console.log('8. 显式指定不存在的路由 → 不新建 provider')
  const app = await boot({
    [NAMESPACE]: baseOwn({ headerEnabled: true, headerRoutes: 'opencode, opencode-go' }),
    [LLM]: baseLlm(),
  })
  check('opencode-go 写入了', typeof headersOf(app.state, 'opencode-go')?.['x-opencode-session'] === 'string')
  check('没有凭空造出 opencode 路由', app.state[LLM].providers.opencode === undefined)
  check('状态说明了目标路由', app.state[NAMESPACE].headerStatus === '已写入 opencode-go', app.state[NAMESPACE].headerStatus)
}

{
  console.log('9. 头名非法 → 拒绝写入并给出原因')
  const app = await boot({
    [NAMESPACE]: baseOwn({ headerEnabled: true, headerName: 'x open code' }),
    [LLM]: baseLlm(),
  })
  check('没有写入', headersOf(app.state, 'opencode-go') === undefined)
  check('状态提示头名不合法', app.state[NAMESPACE].headerStatus === '头名不合法，未写入', app.state[NAMESPACE].headerStatus)
}

{
  console.log('10. llm-pi-ai 未挂载 → 不抛错，只提示')
  const app = await boot({ [NAMESPACE]: baseOwn({ headerEnabled: true }) })
  check('状态提示未挂载', /未挂载/.test(app.state[NAMESPACE].headerStatus), app.state[NAMESPACE].headerStatus)
}

{
  console.log('11. 总开关关闭时一并撤销（全局停用 = 全部功能停用）')
  const app = await boot({ [NAMESPACE]: baseOwn({ headerEnabled: true }), [LLM]: baseLlm() })
  check('先确认已写入', typeof headersOf(app.state, 'opencode-go')?.['x-opencode-session'] === 'string')
  app.state[NAMESPACE].enabled = false
  await app.touch(NAMESPACE)
  check('头已撤销', headersOf(app.state, 'opencode-go')['x-opencode-session'] === undefined)
}

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
