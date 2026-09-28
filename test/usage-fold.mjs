/**
 * 「按 route 分列」的纯逻辑测试（0.8.0）。
 *
 *   node test/usage-fold.mjs
 *
 * 这块逻辑只有宿主半能跑（`session.events` 客户端读不到），但**两条规则错了都会静默算错**：
 *
 *  1. **同一 `(turn, step)` 的上报是累计值**：本版 DSH 里 usage 来自 `assistant/attempt` 的
 *     `stream`（或 `assistant/message` 的 `data.usage`），同一步再次上报时要用"新值 − 旧值"替换，
 *     不做差分就会把同一份 token 反复入账 —— 金额凭空翻好几倍。
 *  2. **归属**：一条 usage 记在它**之前最近一条** `request/header` 的 `(provider, model)` 头上。
 *     归错就把 OpenCode（Zen）的花费记到官方 route 上，而"按 route 分列"正是要看清这件事。
 *
 * 所以这里逐条钉住：差分、归属、未知标签、脏数据、排序，以及与官方投影的一致性判据。
 * **事件形状按本版官方 `SessionEventMap` 的真实声明**（2026-09-28 真机踩过坑：最早照抄的社区
 * 实现折的是 `assistant/chunk`，而本版根本没有这个事件类型，于是分列一行都出不来）；
 * 差分口径对齐官方 `packages/llm/token-meter/src/usage-projection.ts`。
 */
import { mkdirSync } from 'node:fs'
import { build } from 'esbuild'

let failures = 0
let passes = 0

function check(label, condition, detail) {
  if (condition) { passes += 1; console.log(`  ✓ ${label}`); return }
  failures += 1
  console.log(`  ✗ ${label}${detail === undefined ? '' : ` — ${detail}`}`)
}

mkdirSync(new URL('./.build/', import.meta.url), { recursive: true })
await build({
  entryPoints: ['test/pure-entry.ts'],
  outfile: 'test/.build/usage-fold.mjs',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['es2022'],
  logLevel: 'warning',
})
const pure = await import(new URL('./.build/usage-fold.mjs', import.meta.url))

/** 造一条 `request/header`（官方的 provider/model 就藏在这里）。 */
const header = (provider, model) => ({ type: 'request/header', data: { header: { config: { provider, model } } } })
/**
 * 造一条 `assistant/attempt`：**本版 DSH 的真实形状** —— 只有 `stream`，
 * usage 是里面最后一条 `{ type:'chunk', chunk:{ type:'usage' } }`（官方
 * `lastAssistantStreamChunk(stream,'usage')` 的取法）。
 */
const attempt = (turn, step, usage, extraRecords = []) => ({
  type: 'assistant/attempt',
  data: {
    turn,
    step,
    stream: [...extraRecords, { type: 'chunk', time: 0, chunk: { type: 'usage', usage } }],
  },
})
/** 造一条 `assistant/message`（本版常直接带 `data.usage`）。 */
const message = (turn, step, usage) => ({ type: 'assistant/message', data: { turn, step, usage } })
/** 造一条只有 stream、没有 `data.usage` 的 `assistant/message`。 */
const messageWithStream = (turn, step, usage, extraRecords = []) => ({
  type: 'assistant/message',
  data: {
    turn,
    step,
    stream: [...extraRecords, { type: 'text-chunks', time0: 0, index: 0, dt: [1], texts: ['hi'] },
      { type: 'chunk', time: 1, chunk: { type: 'usage', usage } }],
  },
})
/** 造一条重试标记。 */
const retry = (turn, step) => ({ type: 'llm/retry-started', data: { turn, step } })
const usage = (inputTokens, outputTokens, cacheReadTokens = 0, cacheWriteTokens = 0) =>
  ({ inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens })

// ══════════════ 1. 空与单条 ══════════════════════════════════════════════════
console.log('1. 基本折叠')
{
  const empty = pure.foldSessionUsage([])
  check('空事件 → 全零、无 route',
    pure.bucketTotal(empty.total) === 0 && empty.routes.length === 0)
  check('零桶形状完整',
    JSON.stringify(pure.zeroBuckets()) === JSON.stringify({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }))

  const one = pure.foldSessionUsage([header('deepseek-account', 'deepseek-flash'), attempt(1, 1, usage(100, 20, 30, 5))])
  check('一条 usage → 一个 route',
    one.routes.length === 1 && one.routes[0].provider === 'deepseek-account' && one.routes[0].model === 'deepseek-flash')
  check('四个桶原样入账',
    JSON.stringify(one.routes[0].usage) === JSON.stringify(usage(100, 20, 30, 5)))
  check('total 与唯一 route 相等',
    JSON.stringify(one.total) === JSON.stringify(one.routes[0].usage))
}

// ══════════════ 2. 同一 (turn, step) 是累计值，必须相减 ═════════════════════════
console.log('2. 同一步的累计上报（不减就会重复计费）')
{
  const folded = pure.foldSessionUsage([
    header('go', 'deepseek-flash'),
    attempt(1, 1, usage(100, 10)),
    attempt(1, 1, usage(100, 50)),   // 累计：这一步最终 100/50
    attempt(1, 1, usage(100, 50)),   // 重复上报同一份：增量 0
  ])
  check('只算最终值（100/50），不是三次相加',
    JSON.stringify(folded.total) === JSON.stringify(usage(100, 50)),
    JSON.stringify(folded.total))
  check('重复上报不产生第二条 route', folded.routes.length === 1)

  const twoSteps = pure.foldSessionUsage([
    header('go', 'deepseek-flash'),
    attempt(1, 1, usage(100, 10)),
    attempt(1, 2, usage(120, 30)),
  ])
  check('不同 step 相加（100+120 / 10+30）',
    JSON.stringify(twoSteps.total) === JSON.stringify(usage(220, 40)), JSON.stringify(twoSteps.total))

  const twoTurns = pure.foldSessionUsage([
    header('go', 'deepseek-flash'),
    attempt(1, 1, usage(100, 10)),
    attempt(2, 1, usage(100, 10)),
  ])
  check('不同 turn 也相加（100+100）',
    twoTurns.total.inputTokens === 200, String(twoTurns.total.inputTokens))

  // `assistant/message` 与 `assistant/attempt` 是同一套差分口径
  const mixed = pure.foldSessionUsage([
    header('go', 'deepseek-flash'),
    attempt(1, 1, usage(100, 10)),
    message(1, 1, usage(100, 12)),
  ])
  check('attempt 与 message 混用仍按同一步差分（10 → 12）',
    mixed.total.outputTokens === 12, String(mixed.total.outputTokens))
}

// ══════════════ 3. 归属：usage 记在它之前最近那条 request/header 头上 ════════════
console.log('3. 按 route 归因')
{
  const folded = pure.foldSessionUsage([
    header('deepseek-account', 'deepseek-flash'),
    attempt(1, 1, usage(1000, 100)),
    header('go', 'deepseek-flash'),
    attempt(2, 1, usage(2000, 200)),
    header('opencode-go', 'deepseek-v4-pro'),
    attempt(3, 1, usage(3000, 300)),
  ])
  check('三条 route 各一条', folded.routes.length === 3, JSON.stringify(folded.routes.map(r => r.provider)))
  const byProvider = Object.fromEntries(folded.routes.map(r => [r.provider, r]))
  check('官方那条只拿到自己的 1000/100',
    byProvider['deepseek-account'].usage.inputTokens === 1000 && byProvider['deepseek-account'].usage.outputTokens === 100)
  check('go 那条拿到 2000/200', byProvider.go.usage.inputTokens === 2000)
  check('opencode-go 那条拿到 3000/300，且模型是 v4-pro',
    byProvider['opencode-go'].usage.inputTokens === 3000 && byProvider['opencode-go'].model === 'deepseek-v4-pro')
  check('total = 三条之和（6000/600）',
    folded.total.inputTokens === 6000 && folded.total.outputTokens === 600,
    JSON.stringify(folded.total))
  check('按 token 总量降序（opencode-go > go > 官方）',
    folded.routes[0].provider === 'opencode-go' && folded.routes[2].provider === 'deepseek-account')

  const beforeHeader = pure.foldSessionUsage([attempt(1, 1, usage(100, 10))])
  check('没有 request/header → 记成未知，不猜',
    beforeHeader.routes.length === 1
    && beforeHeader.routes[0].provider === pure.UNKNOWN_ROUTE
    && beforeHeader.routes[0].model === pure.UNKNOWN_ROUTE,
    JSON.stringify(beforeHeader.routes))

  const partial = pure.foldSessionUsage([header('', ''), attempt(1, 1, usage(5, 5))])
  check('provider/model 为空串也记成未知', partial.routes[0].provider === pure.UNKNOWN_ROUTE)
}

// ══════════════ 4. 脏数据不许把数字算成 NaN ══════════════════════════════════
console.log('4. 脏数据')
{
  const dirty = pure.foldSessionUsage([
    null,
    42,
    'nope',
    { type: 'request/header' },                                  // 没有 data
    { type: 'request/header', data: { header: { config: { provider: 7, model: null } } } }, // 类型不对
    { type: 'assistant/attempt', data: { turn: 1, step: 1 } },   // 没有 stream
    { type: 'assistant/attempt', data: { turn: 1, step: 1, stream: [{ type: 'chunk', time: 0, chunk: { type: 'text-delta' } }] } }, // stream 里没有 usage
    { type: 'assistant/attempt', data: { turn: 1, step: 1, stream: ['nope', null] } }, // stream 项不是对象
    attempt(1, 1, { inputTokens: Number.NaN, outputTokens: -5, cacheReadTokens: '12', cacheWriteTokens: null }),
    attempt(2, 1, usage(10, 4)),
  ])
  check('非对象/缺字段的事件被跳过，不抛', true)
  check('脏 usage 全当 0，后面那条正常入账',
    dirty.total.inputTokens === 10 && dirty.total.outputTokens === 4, JSON.stringify(dirty.total))
  check('脏 usage 不产生 NaN', Number.isFinite(dirty.total.outputTokens) && !Number.isNaN(dirty.total.inputTokens))
  check('provider 类型不对 → 归到未知 route',
    dirty.routes[0].provider === pure.UNKNOWN_ROUTE, JSON.stringify(dirty.routes[0]))
}

// ══════════════ 5. 桶运算与"与投影一致"的判据 ═════════════════════════════════
console.log('5. 桶运算与一致性判据')
{
  const a = { inputTokens: 1, outputTokens: 2, cacheReadTokens: 3, cacheWriteTokens: 4 }
  const b = { inputTokens: 10, outputTokens: 20, cacheReadTokens: 30, cacheWriteTokens: 40 }
  check('addBuckets 逐项相加',
    JSON.stringify(pure.addBuckets(a, b)) === JSON.stringify({ inputTokens: 11, outputTokens: 22, cacheReadTokens: 33, cacheWriteTokens: 44 }))
  check('subBuckets 逐项相减',
    JSON.stringify(pure.subBuckets(b, a)) === JSON.stringify({ inputTokens: 9, outputTokens: 18, cacheReadTokens: 27, cacheWriteTokens: 36 }))
  check('bucketTotal 是四项之和', pure.bucketTotal(a) === 10)

  const fold = pure.foldSessionUsage([header('go', 'deepseek-flash'), attempt(1, 1, usage(100, 20, 30, 5))])
  check('与投影一致 → true', pure.agreesWithProjection(fold, usage(100, 20, 30, 5)) === true)
  check('投影里缓存写那一项对不上 → false',
    pure.agreesWithProjection(fold, { inputTokens: 100, outputTokens: 20, cacheReadTokens: 30, cacheWriteTokens: 0 }) === false)
  check('对不上 → false', pure.agreesWithProjection(fold, usage(999, 20, 30, 5)) === false)
  check('没有投影（还没读到）→ true（不因此拒绝分列）',
    pure.agreesWithProjection(fold, undefined) === true)
}

// ══════════════ 6. 本版真实形状的两个细节（踩过坑的地方）═══════════════════════
console.log('6. attempt 的 stream / 重试 / 诊断计数')
{
  // 官方 `lastAssistantStreamChunk` 是从后往前找**最后**一条 usage 原始块：前面带别的记录不影响，
  // 后面若还有一条 usage（不该出现）也以最后一条为准。这里把这两种情况都钉住。
  const withRecords = pure.foldSessionUsage([
    header('go', 'deepseek-flash'),
    attempt(1, 1, usage(100, 20), [
      { type: 'text-chunks', time0: 0, index: 0, dt: [1, 2], texts: ['你', '好'] },
      { type: 'chunk', time: 3, chunk: { type: 'text-delta', index: 0, text: '好' } },
    ]),
  ])
  check('stream 里有文本记录也不影响取 usage（100/20）',
    withRecords.total.inputTokens === 100 && withRecords.total.outputTokens === 20,
    JSON.stringify(withRecords.total))

  const twoUsage = pure.foldSessionUsage([
    header('go', 'deepseek-flash'),
    { type: 'assistant/attempt', data: { turn: 1, step: 1, stream: [
      { type: 'chunk', time: 0, chunk: { type: 'usage', usage: usage(100, 10) } },
      { type: 'chunk', time: 1, chunk: { type: 'usage', usage: usage(100, 30) } },
    ] } },
  ])
  check('stream 里有多条 usage → 取最后一条（30，不是 10 也不是 40）',
    twoUsage.total.outputTokens === 30, String(twoUsage.total.outputTokens))

  const fromMessageStream = pure.foldSessionUsage([
    header('go', 'deepseek-flash'),
    messageWithStream(1, 1, usage(50, 5)),
  ])
  check('assistant/message 没有 data.usage 时退回它的 stream（50/5）',
    fromMessageStream.total.inputTokens === 50 && fromMessageStream.total.outputTokens === 5,
    JSON.stringify(fromMessageStream.total))

  // 重试：重试那次的用量应当**加**上去，而不是在替换时被减掉。
  const retried = pure.foldSessionUsage([
    header('go', 'deepseek-flash'),
    attempt(1, 1, usage(1000, 10)),   // 第一次尝试
    retry(1, 1),                       // 重试：清掉替换槽
    attempt(1, 1, usage(800, 8)),      // 重试后的尝试：应当是加，不是减
  ])
  check('重试后的同一步用量是加（1000+800 / 10+8）',
    retried.total.inputTokens === 1800 && retried.total.outputTokens === 18,
    JSON.stringify(retried.total))
  const notRetried = pure.foldSessionUsage([
    header('go', 'deepseek-flash'),
    attempt(1, 1, usage(1000, 10)),
    attempt(1, 1, usage(800, 8)),      // 没有重试标记 = 同一步替换 → 以 800/8 为准
  ])
  check('没有重试标记时同一步是替换（800/8，不是 1800/18）',
    notRetried.total.inputTokens === 800 && notRetried.total.outputTokens === 8,
    JSON.stringify(notRetried.total))
  const retryOtherStep = pure.foldSessionUsage([
    header('go', 'deepseek-flash'),
    attempt(1, 1, usage(1000, 10)),
    retry(2, 1),                       // 别的步重试，不该清掉这一步的槽
    attempt(1, 1, usage(800, 8)),
  ])
  check('别的步的重试不影响这一步的替换（800/8）',
    retryOtherStep.total.inputTokens === 800, String(retryOtherStep.total.inputTokens))

  // 诊断计数：分列出不来时界面靠这两个数区分"没事件"和"形状不对"。
  const diag = pure.foldSessionUsage([
    header('go', 'deepseek-flash'),
    attempt(1, 1, usage(10, 1)),
    attempt(1, 2, usage(20, 2)),
    { type: 'tool/call', data: { turn: 1, step: 2 } },
  ])
  check('events 数 = 输入条数', diag.events === 4, String(diag.events))
  check('samples 数 = 折到 usage 的条数（2）', diag.samples === 2, String(diag.samples))
  check('只有一条 usage 时 samples = 1',
    pure.foldSessionUsage([attempt(1, 1, usage(1, 1))]).samples === 1)
}

// ══════════════ 7. 接口路径（两半必须用同一个常量）═════════════════════════════
console.log('7. 接口路径')
{
  check('USAGE_API_PATH 在 composer-ux 命名空间下',
    pure.USAGE_API_PATH === '/composer-ux/usage', String(pure.USAGE_API_PATH))
}

console.log(`\n${passes} passed / ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
