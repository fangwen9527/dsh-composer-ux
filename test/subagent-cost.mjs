/**
 * 「子代理的费用」（0.24.0）的测试。
 *
 *   node test/subagent-cost.mjs
 *
 * 起因（用户 2026-10-17 真机发现）：**金额胶囊不计算子代理的费用** —— 一条主会话派出去的
 * 子代理（含孙代理）花的钱，胶囊与浮层里那一分都没有。这不是"少显示一行"，是**少算钱**：
 * 而它错得很安静，屏幕上只是一个偏小的数字。
 *
 * 这块的错法有五种，每一种都"看着没问题"：
 *
 *  1. **fork 出来的子代理被重复计费** —— `subagent-fork-in-process` 的子会话日志**开头就是
 *     父会话那段历史**（`readSession()` 的 `inheritedEventCount`），整段照折等于把父会话的账
 *     再收一遍，而且金额随上下文大小成倍放大（第 4 节）；
 *  2. **把用户自己 fork 的会话算进来** —— `header.parentSession` 对"用户从某会话 fork 出的
 *     新会话"同样成立；只有 catalog 事件能区分（第 1 节 + `usage-fold.ts` 的孤儿判据）；
 *  3. **顶层字段被污染** —— 客户端拿 `total`/`cost` 与官方 `tokenUsage` 投影对账，投影只有
 *     本会话；一合并就永远对不上，浮层退回估算口径（第 2 节钉住顶层仍是"本会话自己"）；
 *  4. **拿不到的部分被当成 0** —— 外部执行（claude-code 那类，本机没有会话）、日志读不到、
 *     超过递归上限，这三种必须如实计数交给界面去说，不是静默省略（第 5 节）；
 *  5. **递归无界** —— 胶囊每 600ms 就可能问一次，深链会把宿主拖死（第 5 节钉住上限）。
 *
 * 前半是纯逻辑（`usage-fold.ts` 的 `children`），后半是**真宿主半**：走 `lib/index.js` 里
 * 注册的 `/composer-ux/usage` 路由，用假的 `webServer`/`sessions`/`sessionQuery`/`settings` 驱动。
 *
 * ⚠️ 宿主半读的是构建产物，改完源码要先 `node build.mjs`。
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
  outfile: 'test/.build/subagent-cost.mjs',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['es2022'],
  logLevel: 'warning',
})
const pure = await import(new URL('./.build/subagent-cost.mjs', import.meta.url))

// ── 事件夹具（形状照 `src/usage-fold.ts` 文件头那三条）────────────────────────

/** 一个时刻：2026-10-17 20:00 北京时间（空闲档；两个用例用同一个值，金额只比相对大小）。 */
const T = Date.UTC(2026, 9, 17, 12, 0, 0)

/** `request/header`：usage 归属它之前最近的一条。 */
const header = (seq, provider = 'deepseek-account', model = 'deepseek-flash') => ({
  seq, type: 'request/header', time: T, data: { header: { config: { provider, model } } },
})

/** 一次真实的 usage 上报。 */
const usage = (seq, turn, step, inputTokens, outputTokens, cacheReadTokens = 0) => ({
  seq,
  type: 'assistant/message',
  time: T,
  data: { turn, step, usage: { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens: 0 } },
})

/** 父会话记下的直系子会话（官方 `subagent/*` 包的 catalog 事件）。 */
const catalog = (seq, childId, mode = 'one-shot') => ({
  seq,
  type: 'subagent/catalog',
  time: T,
  data: {
    version: mode === 'external' ? 2 : 0,
    childId,
    childCreatedAt: T,
    mode,
    ...(mode === 'continuable' ? { label: 'thread-1' } : {}),
  },
})

/** 档位判定：测试里把"每笔都在同一档"钉死，这样两边的金额只差在用量上。 */
const OFF_PEAK = () => ({ peak: false, era: 'builtin' })
const foldOf = events => pure.foldSessionUsage(events, OFF_PEAK)

// ══════════════════════════════ 1. 纯逻辑：catalog → 直系子会话 ══════════════════════════
section('1. 纯逻辑：父会话的 catalog 事件里能读出"有哪些子会话"')
{
  const fold = foldOf([
    header(0),
    usage(1, 0, 0, 1000, 100),
    catalog(2, 'child-a'),
    catalog(3, 'child-b', 'continuable'),
    catalog(4, 'child-ext', 'external'),
    catalog(5, 'child-a'), // 重复登记（同一个子会话被追加两次）：不许出现两行
  ])
  check('三个不同的子会话被登记下来（重复的那条按 id 去重）',
    JSON.stringify(fold.children.map(child => child.sessionId))
      === JSON.stringify(['child-a', 'child-b', 'child-ext']),
    JSON.stringify(fold.children))
  check('只有 `mode: external` 被标成外部执行（其余都当本地会话）',
    fold.children.filter(child => child.external).map(child => child.sessionId).join(',') === 'child-ext',
    JSON.stringify(fold.children))
  check('子会话**不计进**这个会话自己的用量（父会话的 token 只有那 1000/100）',
    JSON.stringify(fold.total) === JSON.stringify({ inputTokens: 1000, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 }),
    JSON.stringify(fold.total))
  check('catalog 事件本身不算 usage 样本（samples 只数了那一条）', fold.samples === 1, String(fold.samples))

  const dirty = foldOf([
    header(0),
    { seq: 1, type: 'subagent/catalog', time: T, data: { childId: '' } },
    { seq: 2, type: 'subagent/catalog', time: T, data: { childId: 42 } },
    { seq: 3, type: 'subagent/catalog', time: T, data: null },
    { seq: 4, type: 'subagent/catalog', time: T },
  ])
  check('childId 不是非空字符串的 catalog 一律忽略（脏数据不许造出一个假子会话）',
    dirty.children.length === 0, JSON.stringify(dirty.children))
  check('没有 catalog 的会话 children 是空数组（不是 undefined）',
    JSON.stringify(pure.emptyFold().children) === '[]', JSON.stringify(pure.emptyFold().children))
}

// ══════════════════════════ 2. 宿主半：子代理的钱要进账，顶层口径不变 ══════════════════════
section('2. 宿主半：本会话 + 一个子代理')

/**
 * 一个"父会话 + 若干子会话"的假宿主。
 *
 * @param options.sessionList `sessionQuery.listSessions()` 的返回（**老会话**的子代理只在这条路上
 *   看得见：父会话日志里没有 catalog 事件，关系记在子会话自己的 header 上）。
 * @param options.listFails 让 `listSessions()` 抛错（断言"列不动也不许把金额打掉"）。
 * @param options.noList 干脆不提供 `listSessions`（更老的宿主）。
 */
async function bootHost({
  parentId = 'root', events, children = {}, live = [], sessionList = [], listFails = false, noList = false,
} = {}) {
  process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'dsh-subagent-home-'))
  const realFetch = globalThis.fetch
  const routes = []
  /** 谁被读过日志（断言"外部执行不去读本机会话"用）。 */
  const readCalls = []
  /** `listSessions()` 被调了几次（断言 TTL 缓存真的在挡）。 */
  let listCalls = 0
  const settings = {
    describe: () => [{ ns: 'composer-ux', value: {} }],
    mutate: async () => {},
  }
  const sessionQuery = {
    readSession: async id => {
      readCalls.push(id)
      if (id === parentId) return { events, inheritedEventCount: 0 }
      const child = children[id]
      if (child === undefined) throw new Error(`no such session: ${id}`)
      return { events: child.events, inheritedEventCount: child.inheritedEventCount ?? 0 }
    },
  }
  if (!noList) {
    sessionQuery.listSessions = async () => {
      listCalls += 1
      if (listFails) throw new Error('persistence listing failed')
      return sessionList
    }
  }
  const services = {
    settings,
    sessions: { list: () => live.map(id => ({ id, seq: 99 })) },
    sessionQuery,
    webServer: { register: route => { routes.push(route); return () => {} } },
    effect: fn => { const dispose = fn(); return () => { if (typeof dispose === 'function') dispose() } },
    get: name => services[name],
  }
  globalThis.fetch = async () => ({ ok: false, status: 500, text: async () => '' })
  apply({
    inject: (deps, callback) => { if (deps.every(dep => services[dep] !== undefined)) callback(services) },
    effect: services.effect,
    on: () => {},
  })
  await settle(20)
  return {
    readCalls,
    listCalls: () => listCalls,
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
    get statusCode() { return captured.status },
    set statusCode(code) { captured.status = code },
  }
}
/** 驱动一条路由并等它写完（路由内部是 async 的 fire-and-forget）。 */
const call = async (route, req) => {
  const res = makeRes()
  route.handler(req, res)
  const deadline = Date.now() + 3000
  while (res.captured.body === '' && Date.now() < deadline) await settle(10)
  return { status: res.captured.status, body: res.captured.body === '' ? {} : JSON.parse(res.captured.body) }
}
const usagePath = id => `${pure.USAGE_API_PATH}?sessionId=${encodeURIComponent(id)}`
/** 金额相等（浮点累加会有末位差）。 */
const near = (left, right) => Math.abs(left - right) < 1e-9

{
  // 先量一份**同用量、但没有子代理**的基准：顶层那几个数必须与它逐项相同 ——
  // 这样"没被子代理撑大"就不依赖写死的刊例价（价格档会变，硬编码会假红）。
  const baselineHost = await bootHost({ events: [header(0), usage(1, 0, 0, 1000, 100)] })
  const baseline = (await call(baselineHost.route(pure.USAGE_API_PATH), makeReq(usagePath('root')))).body
  baselineHost.restore()

  const host = await bootHost({
    events: [header(0), usage(1, 0, 0, 1000, 100), catalog(2, 'child-a')],
    // 子代理的用量与父会话**逐项相同** ⇒ 金额必然正好是父会话那一份（不用写死刊例价）
    children: { 'child-a': { events: [header(0), usage(1, 0, 0, 1000, 100)] } },
    live: ['child-a'],
  })
  const result = await call(host.route(pure.USAGE_API_PATH), makeReq(usagePath('root')))
  const body = result.body
  check('路由回 200 且 ok', result.status === 200 && body.ok === true, JSON.stringify(body).slice(0, 200))
  check('顶层 cost 与"没有子代理时"逐项相同（没被子代理撑大）',
    near(body.cost.total, baseline.cost.total) && body.cost.total > 0,
    `${body.cost.total} vs baseline ${baseline.cost.total}`)
  check('顶层 total 仍是本会话自己的四个桶',
    body.total.inputTokens === 1000 && body.total.outputTokens === 100,
    JSON.stringify(body.total))
  check('子代理被折到了（sessions = 1）', body.subagents.sessions === 1, JSON.stringify(body.subagents))
  check('子代理金额 = 与父会话逐项相同的用量 ⇒ 金额正好相等',
    near(body.subagents.cost.total, body.cost.total), `${body.subagents.cost.total} vs ${body.cost.total}`)
  check('子代理的 token 桶也逐项相等',
    JSON.stringify(body.subagents.total) === JSON.stringify(body.total),
    JSON.stringify(body.subagents.total))
  check('三个分项（未缓存/命中/输出）之和 == 子代理合计',
    near(body.subagents.cost.miss + body.subagents.cost.hit + body.subagents.cost.out, body.subagents.cost.total),
    JSON.stringify(body.subagents.cost))
  check('活着的子代理被数出来（live = 1）', body.subagents.live === 1, String(body.subagents.live))
  check('分列（routes）仍只有本会话那一条（子代理不混进 route 行）',
    body.routes.length === 1 && body.routes[0].model === 'deepseek-flash', JSON.stringify(body.routes.map(r => r.model)))
  check('没读到不存在的会话（只读了 root 与 child-a）',
    JSON.stringify(host.readCalls) === JSON.stringify(['root', 'child-a']), JSON.stringify(host.readCalls))
  host.restore()
}

// ═════════════════════════════════ 3. 宿主半：孙代理（递归）═════════════════════════════
section('3. 宿主半：孙代理也要算（递归）')
{
  const host = await bootHost({
    events: [header(0), usage(1, 0, 0, 1000, 100), catalog(2, 'child-a')],
    children: {
      'child-a': {
        events: [header(0), usage(1, 0, 0, 1000, 100), catalog(2, 'grand-a')],
      },
      'grand-a': { events: [header(0), usage(1, 0, 0, 1000, 100)] },
    },
  })
  const body = (await call(host.route(pure.USAGE_API_PATH), makeReq(usagePath('root')))).body
  check('两个子会话都折到了（子 + 孙）', body.subagents.sessions === 2, String(body.subagents.sessions))
  check('金额 = 2 倍本会话（三层各一份逐项相同的用量）',
    near(body.subagents.cost.total, body.cost.total * 2), `${body.subagents.cost.total} vs ${body.cost.total}`)
  check('token 桶 = 2 倍本会话',
    body.subagents.total.inputTokens === 2000 && body.subagents.total.outputTokens === 200,
    JSON.stringify(body.subagents.total))
  host.restore()
}

// ═══════════════════ 4. 宿主半：fork 型子代理的继承前缀不许重复计费 ═══════════════════
section('4. 宿主半：fork 型子代理（日志开头带着父会话那段）')
{
  /**
   * 这一节是**这次修复里最容易做错的一条**：fork 出来的子会话，事件日志开头就是父会话的历史，
   * 里面带着父会话已经上报过的 usage。`inheritedEventCount` 指向"自己的事件从哪开始"。
   *
   * 夹具刻意让继承前缀里那一笔用量**巨大**（99 万输入）：如果没剔掉，子代理的金额会变成
   * 父会话的几百倍 —— 屏幕上却只是一个数字。
   */
  const host = await bootHost({
    events: [header(0), usage(1, 0, 0, 1000, 100), catalog(2, 'fork-child')],
    children: {
      'fork-child': {
        inheritedEventCount: 2,
        events: [
          header(0),
          usage(1, 0, 0, 990_000, 99_000), // ← 父会话那一段（继承来的，**不许**算进子代理）
          header(2),
          // ⚠️ 这一笔必须是**另一个 (turn, step)**：同一步的二次上报在折叠口径里是"替换"而不是
          // "累加"，写成 (0, 0) 的话继承那笔会被替换掉 —— 于是一个"没剔前缀"的实现**也能过**，
          // 这条断言就成了假绿（第一版夹具正是这么写的，变异 SA 当场漏咬）。
          usage(3, 1, 0, 2000, 200), // ← 子代理自己的（父会话的 2 倍）
        ],
      },
    },
  })
  const body = (await call(host.route(pure.USAGE_API_PATH), makeReq(usagePath('root')))).body
  check('继承前缀里那 99 万 token 没进子代理的账',
    body.subagents.total.inputTokens === 2000,
    JSON.stringify(body.subagents.total))
  check('子代理金额 = 它自己那 2 倍用量（不是几百倍）',
    near(body.subagents.cost.total, body.cost.total * 2), `${body.subagents.cost.total} vs ${body.cost.total}`)
  host.restore()
}

// ═══════════════ 5. 宿主半：拿不到的要如实计数（外部执行 / 读不到 / 超上限）═══════════════
section('5. 宿主半：没算进来的部分要如实报')
{
  const host = await bootHost({
    events: [
      header(0), usage(1, 0, 0, 1000, 100),
      catalog(2, 'child-a'),
      catalog(3, 'child-ext', 'external'),
      catalog(4, 'child-gone'), // 已归档且持久化里也没有 ⇒ readSession 抛错
    ],
    children: { 'child-a': { events: [header(0), usage(1, 0, 0, 1000, 100)] } },
  })
  const result = await call(host.route(pure.USAGE_API_PATH), makeReq(usagePath('root')))
  const body = result.body
  check('整个路由仍然 ok（一个子会话读不到，不许把整份金额打掉）', result.status === 200 && body.ok === true)
  check('外部执行单独记 1 个（它本机没有会话）', body.subagents.external === 1, String(body.subagents.external))
  check('读不到日志的记 1 个（已归档 / 读失败）', body.subagents.missing === 1, String(body.subagents.missing))
  check('外部执行**没有**被拿去读本机会话（读了它只会白抛一次）',
    !host.readCalls.includes('child-ext'), JSON.stringify(host.readCalls))
  check('能算的照算（金额只有 child-a 那一份）',
    near(body.subagents.cost.total, body.cost.total), `${body.subagents.cost.total} vs ${body.cost.total}`)
  host.restore()
}

{
  /** 深链：n1 → n2 → … → n7，是骡子是马要看它会不会无界递归。 */
  const children = {}
  for (let index = 1; index <= 7; index += 1) {
    children[`n${index}`] = {
      events: [
        header(0),
        usage(1, 0, 0, 1000, 100),
        ...(index < 7 ? [catalog(2, `n${index + 1}`)] : []),
      ],
    }
  }
  const host = await bootHost({
    events: [header(0), usage(1, 0, 0, 1000, 100), catalog(2, 'n1')],
    children,
  })
  const body = (await call(host.route(pure.USAGE_API_PATH), makeReq(usagePath('root')))).body
  check('递归到上限就停（折到 4 个），超出的记 skipped',
    body.subagents.sessions === 4 && body.subagents.skipped === 1,
    JSON.stringify({ sessions: body.subagents.sessions, skipped: body.subagents.skipped }))
  check('没被拖死：金额 = 4 倍本会话',
    near(body.subagents.cost.total, body.cost.total * 4), `${body.subagents.cost.total} vs ${body.cost.total}`)
  host.restore()
}

// ═════════════ 5b. 宿主半：老会话（父会话日志里没有 catalog）靠 header 反查 ═════════════
section('5b. 宿主半：老会话的子代理（父会话没有 catalog 事件，关系只记在子会话 header 上）')
{
  /**
   * 真机核过的事实（2026-10-17，`~/.dsh/sessions`）：211 份会话日志里有 35 份是子代理子会话
   * （header 带 `origin: 'subagent'` + `parentSession`），但**没有任何一份父会话日志**里有
   * `subagent/catalog` —— 那个事件是较新版本才有的。所以只靠 catalog 的实现在老会话上会"算不到"。
   *
   * 这里也顺手钉住两件不能错的事：
   *  · **用户自己 fork 出来的会话不算**（header 有 `parentSession`、但 `origin` 不是 `subagent`）；
   *  · **TTL 缓存真的在挡**（胶囊每 600ms 就可能问一次，不能每次都全量列一遍）。
   */
  const records = [
    // 子代理（要算）
    { header: { id: 'child-x', origin: 'subagent', parentSession: 'root' } },
    // 用户自己 fork 出来的会话：有 parentSession、没有 origin（**不算**）
    { header: { id: 'user-fork', parentSession: 'root' } },
    // 别人家的子代理（**不算**）
    { header: { id: 'other-child', origin: 'subagent', parentSession: 'somebody-else' } },
    { header: { id: 'root' } },
  ]
  const host = await bootHost({
    events: [header(0), usage(1, 0, 0, 1000, 100)], // ← 没有 catalog
    children: {
      'child-x': { events: [header(0), usage(1, 0, 0, 1000, 100)] },
      'user-fork': { events: [header(0), usage(1, 0, 0, 7000, 700)] },
    },
    sessionList: records,
  })
  const body = (await call(host.route(pure.USAGE_API_PATH), makeReq(usagePath('root')))).body
  check('老会话也能折到子代理（sessions = 1）', body.subagents.sessions === 1, String(body.subagents.sessions))
  check('金额 = 那一份子代理的用量（不是 0）',
    near(body.subagents.cost.total, body.cost.total), `${body.subagents.cost.total} vs ${body.cost.total}`)
  check('用户自己 fork 出来的会话**没被**算进子代理',
    !host.readCalls.includes('user-fork'), JSON.stringify(host.readCalls))
  check('别人家的子代理也没被算进来', !host.readCalls.includes('other-child'), JSON.stringify(host.readCalls))
  // 同一个会话连问两次：第二次必须走 TTL 缓存，不再列一遍。
  await call(host.route(pure.USAGE_API_PATH), makeReq(usagePath('root')))
  check('反查索引有 TTL 缓存（连问两次只列一遍会话）', host.listCalls() === 1, String(host.listCalls()))
  host.restore()
}

{
  // 列不动（持久化炸了 / 更老的宿主根本没有 listSessions）：catalog 那条腿照走，金额不许打掉。
  const host = await bootHost({
    events: [header(0), usage(1, 0, 0, 1000, 100), catalog(2, 'child-a')],
    children: { 'child-a': { events: [header(0), usage(1, 0, 0, 1000, 100)] } },
    listFails: true,
  })
  const body = (await call(host.route(pure.USAGE_API_PATH), makeReq(usagePath('root')))).body
  check('listSessions 抛错：路由仍 ok，catalog 那条腿照算',
    body.ok === true && body.subagents.sessions === 1
    && near(body.subagents.cost.total, body.cost.total),
    JSON.stringify({ ok: body.ok, sessions: body.subagents.sessions }))
  host.restore()

  const legacy = await bootHost({
    events: [header(0), usage(1, 0, 0, 1000, 100), catalog(2, 'child-a')],
    children: { 'child-a': { events: [header(0), usage(1, 0, 0, 1000, 100)] } },
    noList: true,
  })
  const legacyBody = (await call(legacy.route(pure.USAGE_API_PATH), makeReq(usagePath('root')))).body
  check('宿主根本没有 listSessions：不炸，catalog 照算',
    legacyBody.ok === true && legacyBody.subagents.sessions === 1,
    JSON.stringify({ ok: legacyBody.ok, sessions: legacyBody.subagents.sessions }))
  legacy.restore()
}

// ═════════════════════ 6. 宿主半：没有子代理时，老字段一个字节都不许变 ═════════════════════
section('6. 宿主半：没有子代理时（回归）')
{
  const host = await bootHost({ events: [header(0), usage(1, 0, 0, 1000, 100)] })
  const body = (await call(host.route(pure.USAGE_API_PATH), makeReq(usagePath('root')))).body
  check('subagents 仍在，但全零（客户端据此判断"没有子代理"）',
    body.subagents.sessions === 0 && body.subagents.live === 0 && body.subagents.missing === 0
    && body.subagents.external === 0 && body.subagents.skipped === 0
    && body.subagents.cost.total === 0 && body.subagents.unpriced === 0,
    JSON.stringify(body.subagents))
  check('本会话那三个老字段照旧（total / routes / cost 都在且形状没变）',
    body.total.inputTokens === 1000 && body.routes.length === 1 && typeof body.cost.total === 'number',
    JSON.stringify({ total: body.total, routes: body.routes.length }))
  check('只读了一次日志（没因为子代理那一步多读）',
    JSON.stringify(host.readCalls) === JSON.stringify(['root']), JSON.stringify(host.readCalls))
  host.restore()
}

console.log(`\n${passes} passed / ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
