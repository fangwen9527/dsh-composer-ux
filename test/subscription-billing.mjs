/**
 * 订阅通道的额度计费（0.26.0）测试。
 *
 *   node test/subscription-billing.mjs
 *
 * 背景：用户 2026-10-27 的实际通道是 `opencode-go` / `go`（OpenCode Go 套餐：$10/月 + 分档额度），
 * 这类通道**单次调用不扣钱、扣额度**。于是同一个会话有两个口径：
 *   · `cost`   = 按 DeepSeek 官方刊例价折算值多少钱（旧口径，保留）；
 *   · `quota`  = 这次调用吃掉了多少套餐额度（**实付口径**，胶囊默认显示的就是它）。
 *
 * 这块最贵的三个错法都是"屏幕上看不出来"的：
 *  1. **把额度当成钱**：同一批 token 两套价混着加，得出的数既不是钱也不是额度；
 *  2. **模型名归错**：`deepseek-chat` / `deepseek-flash` 是旧名，价目表里只有 V4.1 Flash；
 *     归错就是按错误的单价算额度（或者干脆算成"未收录"）；
 *  3. **月度百分比按档位拆**：同一个模型跨峰谷两条 route，上限是"每模型每月"，
 *     必须两条加起来再除 —— 拆开算会得出"每档各 0.5%"这种假数。
 *  另外还有一条**性能契约**：额度接口要不要 await 到路由响应里？不能 —— 胶囊 600ms 一轮，
 *  网络卡住就会把金额显示卡死。第 5 节用一个"永不 resolve 的 fetch"把这条钉住。
 *
 * ⚠️ 宿主半那半读的是构建产物，改完源码要先 `node build.mjs`。
 */
import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import { apply } from '../lib/index.js'

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

function section(title) {
  console.log(`\n${title}`)
}

const settle = (ms = 15) => new Promise(resolve => { setTimeout(resolve, ms) })

mkdirSync(new URL('./.build/', import.meta.url), { recursive: true })
await build({
  entryPoints: ['test/pure-entry.ts'],
  outfile: 'test/.build/subscription-billing.mjs',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['es2022'],
  logLevel: 'warning',
})
const pure = await import(new URL('./.build/subscription-billing.mjs', import.meta.url))

const buckets = (miss, hit, out) => ({ miss, hit, out })

// ═════════════════════════ 1. 纯逻辑：模型名归一 + 套餐识别 ═════════════════════════
section('1. 模型名归一与套餐识别')
{
  check('基础型号原样返回', pure.canonicalModelKey('deepseek-v4.1-flash') === 'deepseek-v4.1-flash')
  check('日期尾巴去掉（deepseek-v4.1-flash-20260910）',
    pure.canonicalModelKey('deepseek-v4.1-flash-20260910') === 'deepseek-v4.1-flash',
    pure.canonicalModelKey('deepseek-v4.1-flash-20260910'))
  check('exp / latest 尾巴去掉',
    pure.canonicalModelKey('DeepSeek-V4.1-Flash-EXP') === 'deepseek-v4.1-flash',
    pure.canonicalModelKey('DeepSeek-V4.1-Flash-EXP'))
  check('认不出的模型不做"猜"（原样返回，后面查不到就是未收录）',
    pure.canonicalModelKey('some-private-model') === 'some-private-model')

  check('provider 归一：GO / opencode-go / opencode 都命中 Go 套餐',
    pure.planOf('GO')?.id === 'opencode-go'
    && pure.planOf('opencode-go')?.id === 'opencode-go'
    && pure.planOf(' OpenCode ')?.id === 'opencode-go',
    JSON.stringify([pure.planOf('GO')?.id, pure.planOf(' OpenCode ')?.id]))
  check('按量付费的 provider 不是订阅通道（deepseek-official / openrouter）',
    pure.planOf('deepseek-official') === undefined && pure.planOf('openrouter') === undefined)
}

// ═══════════════════════ 2. 纯逻辑：额度消耗 = token × 套餐单价 ═══════════════════════
section('2. 额度消耗（美元）与月度上限占比')
{
  // Go 价目表：V4.1 Flash 谷 0.15 / 0.003 / 0.60，峰 0.30 / 0.006 / 1.20（每百万 token）
  const off = pure.quotaCostOf('opencode-go', 'deepseek-v4.1-flash', false, buckets(1_000_000, 1_000_000, 1_000_000))
  check('谷时：1M 未缓存 + 1M 命中 + 1M 输出 = $0.753',
    off !== undefined && Math.abs(off.usd - 0.753) < 1e-9, JSON.stringify(off))
  const peak = pure.quotaCostOf('opencode-go', 'deepseek-v4.1-flash', true, buckets(1_000_000, 1_000_000, 1_000_000))
  check('峰时正好翻倍（$1.506）', peak !== undefined && Math.abs(peak.usd - 1.506) < 1e-9, JSON.stringify(peak))
  check('月度上限来自官方价目表（V4.1 Flash = $80）',
    off?.monthlyLimitUsd === 80, String(off?.monthlyLimitUsd))
  check('占月度上限的百分比 = usd / 上限',
    off?.percentOfLimit !== undefined && Math.abs(off.percentOfLimit - 0.753 / 80 * 100) < 1e-9,
    String(off?.percentOfLimit))
  check('旧名 deepseek-chat 按 V4.1 Flash 计价（与官方"旧名仍按 Flash 计"一致）',
    pure.quotaCostOf('go', 'deepseek-chat', false, buckets(1_000_000, 0, 0))?.modelKey === 'deepseek-v4.1-flash')

  check('❗按量付费的通道没有额度口径（不会凭空造一个 $）',
    pure.quotaCostOf('deepseek-official', 'deepseek-v4.1-flash', false, buckets(1e6, 0, 0)) === undefined)
  check('❗订阅通道里不认识的模型返回 undefined（界面标"未收录"，不套别的模型的价）',
    pure.quotaCostOf('opencode-go', 'some-private-model', false, buckets(1e6, 0, 0)) === undefined)
  check('未公布的月度上限 ⇒ 不给百分比（不拿 0 冒充）',
    pure.quotaCostOf('opencode-go', 'glm-5.3-flash', false, buckets(0, 0, 1e6))?.monthlyLimitUsd === 60)

  const v4pro = pure.quotaCostOf('opencode-go', 'deepseek-v4-pro', false, buckets(1e6, 0, 0))
  check('V4 Pro 谷时未缓存 $0.66 / 上限 $15',
    v4pro !== undefined && Math.abs(v4pro.usd - 0.66) < 1e-9 && v4pro.monthlyLimitUsd === 15,
    JSON.stringify(v4pro))
  // 这一条专门盯"上限取错"：Flash 的上限是 $80，V4 Pro 是 $15 —— 用固定 80 去掉，
  // Flash 那几条断言仍然全绿（0.66/80 与 0.66/15 只差在这个百分比上）。
  check('V4 Pro 的月度百分比按它自己的 $15 算（不是套 Flash 的 $80）',
    v4pro?.percentOfLimit !== undefined && Math.abs(v4pro.percentOfLimit - 0.66 / 15 * 100) < 1e-9,
    String(v4pro?.percentOfLimit))
}

// ══════════════════════════ 3. 纯逻辑：额度接口响应解析 ══════════════════════════
section('3. 额度接口（/zen/go/v1/usage）响应解析')
{
  const real = {
    usage: {
      rolling: { status: 'ok', percent: 0, resetsAt: '2026-10-27T17:35:17.000Z' },
      weekly: { status: 'ok', percent: 3, resetsAt: '2026-11-02T00:00:00.000Z' },
      monthly: { status: 'ok', percent: 54, resetsAt: '2026-11-08T10:25:37.000Z' },
    },
  }
  const windows = pure.parseQuotaPayload(real)
  check('三段窗口按 5h / 周 / 月 的顺序解析（与官方控制台一致）',
    JSON.stringify(windows.map(window => window.id)) === JSON.stringify(['rolling', 'weekly', 'monthly']),
    JSON.stringify(windows))
  check('percent 是**已用**百分比，原样保留（3 / 54）',
    windows[1]?.percent === 3 && windows[2]?.percent === 54, JSON.stringify(windows))
  check('resetsAt 原样保留（界面用它算"几天后重置"）',
    windows[2]?.resetsAt === '2026-11-08T10:25:37.000Z')

  const partial = pure.parseQuotaPayload({ usage: { weekly: { percent: 12 } } })
  check('缺段就少一段（不补 0：补 0 会让人以为"一点没用"）',
    partial.length === 1 && partial[0].id === 'weekly' && partial[0].resetsAt === '',
    JSON.stringify(partial))
  check('百分比钳到 0–100',
    pure.parseQuotaPayload({ usage: { rolling: { percent: 140 }, weekly: { percent: -3 } } })
      .map(window => window.percent).join(',') === '100,0')
  check('垃圾输入返回空数组（不抛）',
    pure.parseQuotaPayload(null).length === 0 && pure.parseQuotaPayload({ usage: { rolling: {} } }).length === 0)

  // 取数失败的降级：**不许把上一次的窗口擦掉**（否则界面从「周 3%」忽然变空白，
  // 用户会以为额度被清零了）。这一条单独盯一个纯函数，因为要造"先成功、后失败"
  // 的时序在路由层要等 60 秒 TTL。
  const previous = {
    provider: 'opencode-go',
    displayName: 'OpenCode Go',
    status: 'ok',
    windows: [{ id: 'weekly', percent: 3, resetsAt: '2026-11-02T00:00:00.000Z' }],
    fetchedAt: 1793110730311,
    reason: '',
  }
  const degraded = pure.degradeQuota({ id: 'opencode-go', displayName: 'OpenCode Go' }, previous, 'unavailable', '额度接口返回 HTTP 500')
  check('额度接口失败保留上一次的窗口（界面不能从「周 3%」忽然变空白）',
    degraded.windows.length === 1
    && degraded.windows[0].percent === 3
    && degraded.fetchedAt === previous.fetchedAt
    && degraded.status === 'unavailable',
    JSON.stringify(degraded))
  check('上一次就没有窗口时也不编数据（空数组 + 失败状态）',
    pure.degradeQuota({ id: 'opencode-go', displayName: 'OpenCode Go' }, undefined, 'not-configured', '没找到 key').windows.length === 0)
}

// ═════════════════════ 4. 宿主半：响应里带上 quota 与 plan ═════════════════════
section('4. 宿主半：/composer-ux/usage 的额度口径')

/** 一个"父会话 + 子代理"的假宿主；credentials 返回一把假 key，fetch 由用例注入。 */
async function bootHost({ parentId = 'root', events, children = {}, quotaBody, quotaStatus = 200, neverResolve = false } = {}) {
  process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'dsh-sub-billing-'))
  const realFetch = globalThis.fetch
  const routes = []
  const fetchCalls = []
  const settings = { describe: () => [{ ns: 'composer-ux', value: {} }], mutate: async () => {} }
  const services = {
    settings,
    sessions: { list: () => [] },
    sessionQuery: {
      readSession: async id => {
        if (id === parentId) return { events, inheritedEventCount: 0 }
        const child = children[id]
        if (child === undefined) throw new Error(`no such session: ${id}`)
        return { events: child.events, inheritedEventCount: child.inheritedEventCount ?? 0 }
      },
    },
    // 凭据：按引用名返回同一把假 key（额度接口只认 Bearer，内容不重要）。
    credentials: { resolve: async () => ({ value: 'oc_sk_test_key' }) },
    webServer: { register: route => { routes.push(route); return () => {} } },
    effect: fn => { const dispose = fn(); return () => { if (typeof dispose === 'function') dispose() } },
    get: name => services[name],
  }
  globalThis.fetch = async url => {
    fetchCalls.push(String(url))
    if (neverResolve) return new Promise(() => {})
    return {
      ok: quotaStatus === 200,
      status: quotaStatus,
      json: async () => quotaBody,
    }
  }
  apply({
    inject: (deps, callback) => { if (deps.every(dep => services[dep] !== undefined)) callback(services) },
    effect: services.effect,
    on: () => {},
  })
  await settle(20)
  return {
    fetchCalls,
    route: path => routes.find(candidate => candidate.path === path),
    restore: () => { globalThis.fetch = realFetch },
  }
}

const makeReq = path => ({ method: 'GET', url: path })
const makeRes = () => {
  const captured = { status: 0, body: '' }
  return {
    captured,
    writeHead: code => { captured.status = code },
    end: payload => { captured.body = payload ?? '' },
  }
}
const call = async (route, req) => {
  const res = makeRes()
  const startedAt = Date.now()
  route.handler(req, res)
  const deadline = Date.now() + 3000
  while (res.captured.body === '' && Date.now() < deadline) await settle(10)
  return {
    status: res.captured.status,
    body: res.captured.body === '' ? {} : JSON.parse(res.captured.body),
    elapsedMs: Date.now() - startedAt,
  }
}
const usagePath = id => `${pure.USAGE_API_PATH}?sessionId=${encodeURIComponent(id)}`

const T = Date.UTC(2026, 9, 27, 12, 0, 0)
const header = (seq, provider, model) => ({ seq, type: 'request/header', time: T, data: { header: { config: { provider, model } } } })
const usage = (seq, turn, step, inputTokens, outputTokens) => ({
  seq,
  type: 'assistant/message',
  time: T,
  data: { turn, step, usage: { inputTokens, outputTokens, cacheReadTokens: 0, cacheWriteTokens: 0 } },
})
const catalog = (seq, childId) => ({
  seq, type: 'subagent/catalog', time: T, data: { version: 0, childId, childCreatedAt: T, mode: 'one-shot' },
})

{
  const quotaBody = {
    usage: {
      rolling: { status: 'ok', percent: 0, resetsAt: '2026-10-27T17:35:17.000Z' },
      weekly: { status: 'ok', percent: 3, resetsAt: '2026-11-02T00:00:00.000Z' },
      monthly: { status: 'ok', percent: 54, resetsAt: '2026-11-08T10:25:37.000Z' },
    },
  }
  const host = await bootHost({
    events: [
      header(0, 'opencode-go', 'deepseek-v4.1-flash'),
      usage(1, 0, 0, 1_000_000, 0), // 1M 未缓存 → 谷时 $0.15
      catalog(2, 'child-a'),
    ],
    children: {
      'child-a': { events: [header(0, 'opencode-go', 'deepseek-v4.1-flash'), usage(1, 0, 0, 1_000_000, 0)] },
    },
    quotaBody,
  })
  // 第一次：额度接口的结果还没回来 —— 路由必须立刻回（pending），不能卡住。
  const first = await call(host.route(pure.USAGE_API_PATH), makeReq(usagePath('root')))
  check('第一次调用立刻返回（不等额度接口）', first.elapsedMs < 1500, `${first.elapsedMs}ms`)
  check('第一次的 plan 是 pending（界面显示"正在取额度…"）',
    first.body.plan?.status === 'pending', JSON.stringify(first.body.plan))
  check('❗额度金额不依赖额度接口：本会话 $0.15 + 子代理 $0.15 = $0.30',
    Math.abs(first.body.quota.usd - 0.30) < 1e-9, JSON.stringify(first.body.quota))

  // 第二次：后台已经把额度取回来了。
  await settle(60)
  const second = await call(host.route(pure.USAGE_API_PATH), makeReq(usagePath('root')))
  check('第二次拿到真实窗口（周 3% / 月 54%）',
    second.body.plan?.status === 'ok'
    && second.body.plan.windows.find(w => w.id === 'weekly')?.percent === 3
    && second.body.plan.windows.find(w => w.id === 'monthly')?.percent === 54,
    JSON.stringify(second.body.plan))
  check('额度按模型分组，且百分比 = 该模型本次消耗 / 月度上限',
    second.body.quota.models.length === 1
    && second.body.quota.models[0].model === 'deepseek-v4.1-flash'
    && Math.abs(second.body.quota.models[0].usd - 0.30) < 1e-9
    && Math.abs(second.body.quota.models[0].percentOfLimit - 0.30 / 80 * 100) < 1e-9,
    JSON.stringify(second.body.quota.models))
  check('刊例价折算的 cost 仍在（两套口径并存）',
    typeof second.body.cost?.total === 'number' && second.body.cost.total > 0,
    JSON.stringify(second.body.cost))
  check('额度接口只被问过一次（60 秒 TTL 缓存）',
    host.fetchCalls.length === 1, JSON.stringify(host.fetchCalls))
  host.restore()
}

{
  // 性能契约：额度接口永远不返回时，路由也不许卡住。
  const host = await bootHost({
    events: [header(0, 'opencode-go', 'deepseek-v4.1-flash'), usage(1, 0, 0, 1000, 100)],
    neverResolve: true,
  })
  const response = await call(host.route(pure.USAGE_API_PATH), makeReq(usagePath('root')))
  check('❗额度接口挂住时，路由照样立刻返回（胶囊不会被网络拖死）',
    response.body.ok === true && response.elapsedMs < 1500,
    `${response.elapsedMs}ms / ${JSON.stringify(response.body.plan)}`)
  host.restore()
}

{
  // 失败降级：接口 500 时状态如实说，金额口径不受影响。
  const host = await bootHost({
    events: [header(0, 'opencode-go', 'deepseek-v4.1-flash'), usage(1, 0, 0, 1_000_000, 0)],
    quotaStatus: 500,
  })
  await call(host.route(pure.USAGE_API_PATH), makeReq(usagePath('root')))
  await settle(60)
  const body = (await call(host.route(pure.USAGE_API_PATH), makeReq(usagePath('root')))).body
  check('额度接口 500 ⇒ plan.status = unavailable + 原因里带状态码',
    body.plan?.status === 'unavailable' && String(body.plan.reason).includes('500'),
    JSON.stringify(body.plan))
  check('额度金额照旧能算（额度接口失败不影响本会话的额度消耗）',
    Math.abs(body.quota.usd - 0.15) < 1e-9, JSON.stringify(body.quota))
  host.restore()
}

{
  // 纯按量付费的会话：不该为额度接口付一次网络往返。
  const host = await bootHost({
    events: [header(0, 'deepseek-official', 'deepseek-v4.1-flash'), usage(1, 0, 0, 1000, 100)],
  })
  const body = (await call(host.route(pure.USAGE_API_PATH), makeReq(usagePath('root')))).body
  check('按量付费会话：没有 plan、quota.usd = 0、也没有网络请求',
    body.plan === undefined && body.quota.usd === 0 && host.fetchCalls.length === 0,
    JSON.stringify({ plan: body.plan, quota: body.quota, calls: host.fetchCalls }))
  host.restore()
}

// ═════════════════════ 5. 宿主半：/composer-ux/quota（设置页那张卡用） ═════════════════════
section('4b. 同一模型跨峰谷：额度按模型合并，月度百分比只除一次')
{
  // 一个会话里同一模型既有高峰用量又有空闲用量 ⇒ 折出来是**两条 route**。
  // 月度上限是"每模型每月"，所以必须合并成一行再除；拆成两行会得出"每档各 0.19%"这种
  // 既不能跟控制台对账、也不能相加的数。
  const PEAK_T = Date.UTC(2026, 9, 27, 2, 0, 0) // 北京 10:00 → 高峰
  const OFF_T = Date.UTC(2026, 9, 27, 12, 0, 0) // 北京 20:00 → 空闲
  const host = await bootHost({
    events: [
      { seq: 0, type: 'request/header', time: OFF_T, data: { header: { config: { provider: 'opencode-go', model: 'deepseek-v4.1-flash' } } } },
      { seq: 1, type: 'assistant/message', time: OFF_T, data: { turn: 0, step: 0, usage: { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 } } },
      // 档位按**请求头**的时刻判（`usage-fold.ts`：一步只有第一次上报时判档），所以换档必须先来一个
      // 新的 request/header —— 只把 usage 事件的 time 改到高峰，折出来仍然全是谷价。
      { seq: 2, type: 'request/header', time: PEAK_T, data: { header: { config: { provider: 'opencode-go', model: 'deepseek-v4.1-flash' } } } },
      { seq: 3, type: 'assistant/message', time: PEAK_T, data: { turn: 1, step: 0, usage: { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 } } },
    ],
  })
  const body = (await call(host.route(pure.USAGE_API_PATH), makeReq(usagePath('root')))).body
  check('两条 route（峰 / 谷）确实都折出来了',
    (body.routes ?? []).length === 2 && (body.routes ?? []).some(route => route.peak === true),
    JSON.stringify((body.routes ?? []).map(route => route.peak)))
  check('❗额度按模型合并成一行：谷 $0.15 + 峰 $0.30 = $0.45',
    body.quota.models.length === 1 && Math.abs(body.quota.usd - 0.45) < 1e-9,
    JSON.stringify(body.quota))
  check('月度百分比只除一次（0.45 / 80 = 0.5625%），不是两档各算一遍',
    Math.abs(body.quota.models[0].percentOfLimit - 0.45 / 80 * 100) < 1e-9,
    String(body.quota.models[0].percentOfLimit))
  host.restore()
}

section('5. 宿主半：/composer-ux/quota 单独一条路由')
{
  const quotaBody = {
    usage: {
      rolling: { status: 'ok', percent: 7, resetsAt: '2026-10-27T17:35:17.000Z' },
      weekly: { status: 'ok', percent: 21, resetsAt: '2026-11-02T00:00:00.000Z' },
      monthly: { status: 'ok', percent: 61, resetsAt: '2026-11-08T10:25:37.000Z' },
    },
  }
  const host = await bootHost({
    events: [header(0, 'opencode-go', 'deepseek-v4.1-flash'), usage(1, 0, 0, 1000, 100)],
    quotaBody,
  })
  check('额度路由注册了', host.route(pure.QUOTA_API_PATH) !== undefined)
  const first = await call(host.route(pure.QUOTA_API_PATH), makeReq(pure.QUOTA_API_PATH))
  check('第一次立刻回 pending（不等官方接口）',
    first.body.ok === true && first.body.plans?.[0]?.status === 'pending',
    JSON.stringify(first.body.plans?.[0]))
  check('同时给出套餐月费与应配的凭据引用名（界面要告诉用户配哪个 key）',
    first.body.plans?.[0]?.monthlyFeeUsd === 10
    && JSON.stringify(first.body.plans?.[0]?.keyRefs) === JSON.stringify(['OPENCODE_GO_API_KEY', 'GO_API_KEY', 'OPENCODE_API_KEY']),
    JSON.stringify({ fee: first.body.plans?.[0]?.monthlyFeeUsd, refs: first.body.plans?.[0]?.keyRefs }))
  await settle(60)
  const second = await call(host.route(pure.QUOTA_API_PATH), makeReq(pure.QUOTA_API_PATH))
  check('第二次拿到真实窗口（7 / 21 / 61）',
    second.body.plans?.[0]?.status === 'ok'
    && second.body.plans[0].windows.map(window => window.percent).join(',') === '7,21,61',
    JSON.stringify(second.body.plans?.[0]?.windows))
  check('只接受 GET（POST 回 405）',
    (await call(host.route(pure.QUOTA_API_PATH), { method: 'POST', url: pure.QUOTA_API_PATH })).status === 405)
  host.restore()
}

console.log(`\n${passes} passed / ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
