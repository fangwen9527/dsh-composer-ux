/**
 * 「按 route 分列」的纯逻辑测试（0.8.0；0.10.0 起档位判定换 `TierAt`、route key 多一维 era）。
 *
 *   node test/usage-fold.mjs
 *
 * 这块逻辑只有宿主半能跑（`session.events` 客户端读不到），但**几条规则错了都会静默算错**：
 *
 *  1. **同一 `(turn, step)` 的上报是累计值**：本版 DSH 里 usage 来自 `assistant/attempt` 的
 *     `stream`（或 `assistant/message` 的 `data.usage`），同一步再次上报时要用"新值 − 旧值"替换，
 *     不做差分就会把同一份 token 反复入账 —— 金额凭空翻好几倍。
 *  2. **归属**：一条 usage 记在它**之前最近一条** `request/header` 的 `(provider, model)` 头上。
 *     归错就把 OpenCode（Zen）的花费记到官方 route 上，而"按 route 分列"正是要看清这件事。
 *  3. **档位判定是 `TierAt`（0.10.0）**：多收 `provider/model`，回 `{peak, era}`；非 DeepSeek 路由
 *     直接 `{peak:false, era:''}`（第三方价是平坦的）。判定函数由调用方注入，本文件用与
 *     `src/host.ts` **同源**的 `isDeepSeekRoute` 分叉（第 7、10 节）。
 *  4. **`era` 是 route key 的一维**（第 10 节）：官调价后，同一 `(provider, model, peak)` 下
 *     不同 `era` 必须是两条 route —— 这是"历史金额不跟着新价变"的前提。
 *  5. **`UsageCache.clear()`**（第 11 节）：折叠结果固化了判定当时的事实，改了节假日表/同步了
 *     新价档之后不清缓存，金额会一直停在旧规则上（而且看不出来）。
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
/** 给事件补上官方信封里的 `time`（毫秒）与 `seq`。 */
const stamped = (event, time, seq) => ({ ...event, time, seq })
/** 两个定死的时刻（UTC 02:00 = 高峰、UTC 12:00 = 空闲）。 */
const T_PEAK = Date.UTC(2026, 8, 28, 2, 0)
const T_OFF = Date.UTC(2026, 8, 28, 12, 0)
/** 只按 UTC 小时判峰（比真规则窄一档，够用且与 `pricing.ts` 解耦）。 */
const peakByUtc = ms => {
  const hour = new Date(ms).getUTCHours()
  return hour >= 1 && hour < 4
}

/**
 * 本文件的老用例（1–6 节）只关心归属、差分与诊断计数，所以默认**全判空闲档**
 * —— 那样每条 route 的桶与 0.8.0 完全一样，只有多出来的 `peak`/`era` 标记不同。
 */
const offPeakOnly = () => false
/** 默认价格档 id（本文件不依赖 `pricing.ts` 的真实档表，只要是个稳定字符串）。 */
const DEFAULT_ERA = 'flash-2026-09-10'
/**
 * 档位判定（0.10.0 的 `TierAt`）：比 0.9.1 的 `PeakAt` **多收 provider/model**，
 * 而且要回 `{ peak, era }` 两个字段。
 *
 * 分叉判据照 `src/host.ts` 的 `tierAt`：**非 DeepSeek 路由直接 `{ peak: false, era: '' }`**
 * （第三方价是平坦的，没有峰谷也没有历史档），所以这里复用 `pure.isDeepSeekRoute` 与宿主同源。
 * `era` 传字符串就是固定档，传函数就按时刻取档（第 10 节模拟官方调价）。
 */
const tierAt = (peakByUtc, era = DEFAULT_ERA) => (ms, provider = '', model = '') => (
  !pure.isDeepSeekRoute(provider, model)
    ? { peak: false, era: '' }
    : { peak: peakByUtc(ms), era: typeof era === 'function' ? era(ms) : era }
)
/** 一次性折叠。第二个参数是 `TierAt`（不再是布尔判定）。 */
const fold = (events, tier = tierAt(offPeakOnly)) => pure.foldSessionUsage(events, tier)

// ══════════════ 1. 空与单条 ══════════════════════════════════════════════════
console.log('1. 基本折叠')
{
  const empty = fold([])
  check('空事件 → 全零、无 route',
    pure.bucketTotal(empty.total) === 0 && empty.routes.length === 0)
  check('零桶形状完整',
    JSON.stringify(pure.zeroBuckets()) === JSON.stringify({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }))

  const one = fold([header('deepseek-account', 'deepseek-flash'), attempt(1, 1, usage(100, 20, 30, 5))])
  check('一条 usage → 一个 route',
    one.routes.length === 1 && one.routes[0].provider === 'deepseek-account' && one.routes[0].model === 'deepseek-flash')
  check('四个桶原样入账',
    JSON.stringify(one.routes[0].usage) === JSON.stringify(usage(100, 20, 30, 5)))
  check('total 与唯一 route 相等',
    JSON.stringify(one.total) === JSON.stringify(one.routes[0].usage))
  check('route 上带着档位与价格档（0.10.0：`era` 要能读到）',
    one.routes[0].peak === false && one.routes[0].era === DEFAULT_ERA,
    JSON.stringify({ peak: one.routes[0].peak, era: one.routes[0].era }))
}

// ══════════════ 2. 同一 (turn, step) 是累计值，必须相减 ═════════════════════════
console.log('2. 同一步的累计上报（不减就会重复计费）')
{
  const folded = fold([
    header('go', 'deepseek-flash'),
    attempt(1, 1, usage(100, 10)),
    attempt(1, 1, usage(100, 50)),   // 累计：这一步最终 100/50
    attempt(1, 1, usage(100, 50)),   // 重复上报同一份：增量 0
  ])
  check('只算最终值（100/50），不是三次相加',
    JSON.stringify(folded.total) === JSON.stringify(usage(100, 50)),
    JSON.stringify(folded.total))
  check('重复上报不产生第二条 route', folded.routes.length === 1)

  const twoSteps = fold([
    header('go', 'deepseek-flash'),
    attempt(1, 1, usage(100, 10)),
    attempt(1, 2, usage(120, 30)),
  ])
  check('不同 step 相加（100+120 / 10+30）',
    JSON.stringify(twoSteps.total) === JSON.stringify(usage(220, 40)), JSON.stringify(twoSteps.total))

  const twoTurns = fold([
    header('go', 'deepseek-flash'),
    attempt(1, 1, usage(100, 10)),
    attempt(2, 1, usage(100, 10)),
  ])
  check('不同 turn 也相加（100+100）',
    twoTurns.total.inputTokens === 200, String(twoTurns.total.inputTokens))

  // `assistant/message` 与 `assistant/attempt` 是同一套差分口径
  const mixed = fold([
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
  const folded = fold([
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

  const beforeHeader = fold([attempt(1, 1, usage(100, 10))])
  check('没有 request/header → 记成未知，不猜',
    beforeHeader.routes.length === 1
    && beforeHeader.routes[0].provider === pure.UNKNOWN_ROUTE
    && beforeHeader.routes[0].model === pure.UNKNOWN_ROUTE,
    JSON.stringify(beforeHeader.routes))

  const partial = fold([header('', ''), attempt(1, 1, usage(5, 5))])
  check('provider/model 为空串也记成未知', partial.routes[0].provider === pure.UNKNOWN_ROUTE)
}

// ══════════════ 4. 脏数据不许把数字算成 NaN ══════════════════════════════════
console.log('4. 脏数据')
{
  const dirty = fold([
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
  // 未知 route 不是 DeepSeek 官方（`isDeepSeekRoute('未知','未知')` 为假），所以按宿主同源判据
  // 拿不到价格档 —— 这是新语义：脏数据不许被套上"官方某一档"的价。
  check('未知 route 没有价格档（era 为空串，不会被套上官方档价）',
    dirty.routes[0].era === '', JSON.stringify(dirty.routes[0].era))
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

  const folded = fold([header('go', 'deepseek-flash'), attempt(1, 1, usage(100, 20, 30, 5))])
  check('与投影一致 → true', pure.agreesWithProjection(folded, usage(100, 20, 30, 5)) === true)
  check('投影里缓存写那一项对不上 → false',
    pure.agreesWithProjection(folded, { inputTokens: 100, outputTokens: 20, cacheReadTokens: 30, cacheWriteTokens: 0 }) === false)
  check('对不上 → false', pure.agreesWithProjection(folded, usage(999, 20, 30, 5)) === false)
  check('没有投影（还没读到）→ true（不因此拒绝分列）',
    pure.agreesWithProjection(folded, undefined) === true)
}

// ══════════════ 6. 本版真实形状的两个细节（踩过坑的地方）═══════════════════════
console.log('6. attempt 的 stream / 重试 / 诊断计数')
{
  // 官方 `lastAssistantStreamChunk` 是从后往前找**最后**一条 usage 原始块：前面带别的记录不影响，
  // 后面若还有一条 usage（不该出现）也以最后一条为准。这里把这两种情况都钉住。
  const withRecords = fold([
    header('go', 'deepseek-flash'),
    attempt(1, 1, usage(100, 20), [
      { type: 'text-chunks', time0: 0, index: 0, dt: [1, 2], texts: ['你', '好'] },
      { type: 'chunk', time: 3, chunk: { type: 'text-delta', index: 0, text: '好' } },
    ]),
  ])
  check('stream 里有文本记录也不影响取 usage（100/20）',
    withRecords.total.inputTokens === 100 && withRecords.total.outputTokens === 20,
    JSON.stringify(withRecords.total))

  const twoUsage = fold([
    header('go', 'deepseek-flash'),
    { type: 'assistant/attempt', data: { turn: 1, step: 1, stream: [
      { type: 'chunk', time: 0, chunk: { type: 'usage', usage: usage(100, 10) } },
      { type: 'chunk', time: 1, chunk: { type: 'usage', usage: usage(100, 30) } },
    ] } },
  ])
  check('stream 里有多条 usage → 取最后一条（30，不是 10 也不是 40）',
    twoUsage.total.outputTokens === 30, String(twoUsage.total.outputTokens))

  const fromMessageStream = fold([
    header('go', 'deepseek-flash'),
    messageWithStream(1, 1, usage(50, 5)),
  ])
  check('assistant/message 没有 data.usage 时退回它的 stream（50/5）',
    fromMessageStream.total.inputTokens === 50 && fromMessageStream.total.outputTokens === 5,
    JSON.stringify(fromMessageStream.total))

  // 重试：重试那次的用量应当**加**上去，而不是在替换时被减掉。
  const retried = fold([
    header('go', 'deepseek-flash'),
    attempt(1, 1, usage(1000, 10)),   // 第一次尝试
    retry(1, 1),                       // 重试：清掉替换槽
    attempt(1, 1, usage(800, 8)),      // 重试后的尝试：应当是加，不是减
  ])
  check('重试后的同一步用量是加（1000+800 / 10+8）',
    retried.total.inputTokens === 1800 && retried.total.outputTokens === 18,
    JSON.stringify(retried.total))
  const notRetried = fold([
    header('go', 'deepseek-flash'),
    attempt(1, 1, usage(1000, 10)),
    attempt(1, 1, usage(800, 8)),      // 没有重试标记 = 同一步替换 → 以 800/8 为准
  ])
  check('没有重试标记时同一步是替换（800/8，不是 1800/18）',
    notRetried.total.inputTokens === 800 && notRetried.total.outputTokens === 8,
    JSON.stringify(notRetried.total))
  const retryOtherStep = fold([
    header('go', 'deepseek-flash'),
    attempt(1, 1, usage(1000, 10)),
    retry(2, 1),                       // 别的步重试，不该清掉这一步的槽
    attempt(1, 1, usage(800, 8)),
  ])
  check('别的步的重试不影响这一步的替换（800/8）',
    retryOtherStep.total.inputTokens === 800, String(retryOtherStep.total.inputTokens))

  // 诊断计数：分列出不来时界面靠这两个数区分"没事件"和"形状不对"。
  const diag = fold([
    header('go', 'deepseek-flash'),
    attempt(1, 1, usage(10, 1)),
    attempt(1, 2, usage(20, 2)),
    { type: 'tool/call', data: { turn: 1, step: 2 } },
  ])
  check('events 数 = 输入条数', diag.events === 4, String(diag.events))
  check('samples 数 = 折到 usage 的条数（2）', diag.samples === 2, String(diag.samples))
  check('只有一条 usage 时 samples = 1',
    fold([attempt(1, 1, usage(1, 1))]).samples === 1)
}

// ══════════════ 7. 峰谷按"每笔用量发生的时间"判定（0.9.1 的规则 + 0.10.0 的 `TierAt`）════
//
// 这一节钉的是 0.8.0 的一个静默错处与 0.9.1 的两条新规则（0.10.0 只是把判定函数的签名换成
// `TierAt`：多收 provider/model、多回 era）：
//   · 官方按**请求发生时刻**计费，而"看面板的那一秒"不是那个时刻 —— 昨晚跑的会话今天上午看
//     会整份按高峰价显示（差 2 倍，屏幕上只是个数字）；
//   · 同一步的**替换增量**必须沿用该步第一次判定的档（连 era 一起），否则一次跨过 09:00
//     或跨过调价时刻的请求会被拆成两档/两档价，凭空多出用量；
//   · 宿主半要用的**增量**折叠器必须与一次性折叠逐字节同结果，且重复喂同一批事件不会重复计费
//     （`seq` 幂等 —— 缓存能安全复用的前提）。
console.log('7. 逐笔按时间分峰谷档')
{

  // 同一模型、两档各一次 → 拆成两条 route，`peak` 标记不同。
  const both = fold([
    stamped(header('go', 'deepseek-flash'), T_PEAK, 1),
    stamped(attempt(1, 1, usage(100, 10)), T_PEAK, 2),
    stamped(header('go', 'deepseek-flash'), T_OFF, 3),
    stamped(attempt(2, 1, usage(200, 20)), T_OFF, 4),
  ], tierAt(peakByUtc))
  const peakRow = both.routes.find(row => row.peak === true)
  const offRow = both.routes.find(row => row.peak === false)
  check('高峰那一条只记高峰用量（100/10）',
    peakRow !== undefined && peakRow.usage.inputTokens === 100 && peakRow.usage.outputTokens === 10,
    JSON.stringify(both.routes))
  check('空闲那一条只记空闲用量（200/20）',
    offRow !== undefined && offRow.usage.inputTokens === 200 && offRow.usage.outputTokens === 20,
    JSON.stringify(both.routes))
  check('两条 route 的 provider/model 相同，只有档位不同',
    both.routes.length === 2 && peakRow.provider === offRow.provider && peakRow.model === offRow.model)
  check('两条 route 的 era 相同（这一节只差峰谷；era 分维见第 10 节）',
    peakRow.era === DEFAULT_ERA && offRow.era === DEFAULT_ERA)
  check('两档小计相加恰好等于 total',
    JSON.stringify(pure.addBuckets(both.tiers.peak, both.tiers.offPeak)) === JSON.stringify(both.total))
  check('tiers 各自对得上（高峰 100/10、空闲 200/20）',
    both.tiers.peak.inputTokens === 100 && both.tiers.offPeak.inputTokens === 200)

  // 同一步的替换增量沿用第一次的档（哪怕其后来了新 header、时间跨到高峰）。
  const replaced = fold([
    stamped(header('go', 'deepseek-flash'), T_OFF, 1),
    stamped(attempt(1, 1, usage(100, 10)), T_OFF, 2),
    stamped(header('go', 'deepseek-flash'), T_PEAK, 3),
    stamped(attempt(1, 1, usage(100, 50)), T_PEAK, 4),
  ], tierAt(peakByUtc))
  check('同一步的替换增量仍算第一次那档（空闲），高峰档为 0',
    replaced.routes.length === 1 && replaced.routes[0].peak === false
    && replaced.tiers.peak.inputTokens === 0 && replaced.total.outputTokens === 50,
    JSON.stringify(replaced.routes))
  check('替换增量也沿用第一次判定的 era（不会被后来的 header 改档）',
    replaced.routes[0].era === DEFAULT_ERA, JSON.stringify(replaced.routes[0]))

  // 没有 request/header 时间、事件自己也没有 time → 判定函数收到 NaN（由调用方兜底），
  // 同时把"provider/model 也一起传进来了"钉住（`TierAt` 比旧 `PeakAt` 多这两个参数）。
  const seen = []
  const offAll = tierAt(offPeakOnly)
  fold([attempt(1, 1, usage(5, 5))], (ms, provider, model) => {
    seen.push({ ms, provider, model })
    return offAll(ms, provider, model)
  })
  check('既没有 header 时间也没有事件 time → 判定函数收到 NaN（不瞎猜成 0 时刻）',
    seen.length === 1 && Number.isNaN(seen[0].ms), String(seen[0]?.ms))
  check('判定函数同时收到这条 usage 归属的 route（provider/model 一起传）',
    seen.length === 1 && seen[0].provider === pure.UNKNOWN_ROUTE && seen[0].model === pure.UNKNOWN_ROUTE,
    JSON.stringify(seen[0]))
  // 没有 header 时 route 是"未知"，按宿主同源判据不是 DeepSeek 官方 → 拿不到峰谷与价档。
  check('未知 route 用宿主同源判定 → 没有价格档（era 空串）',
    fold([attempt(1, 1, usage(5, 5))], tierAt(peakByUtc)).routes[0].era === '')
  // 事件自己有 time、没有 header → 用事件自己的时间。这里用一个只钉"时间来源"的自定义判定：
  // 因为按宿主判据"未知 route"没有峰谷档（上一条），用正规判定就测不到时间这条线了。
  const eventTime = []
  const peakByEventTime = (ms) => { eventTime.push(ms); return { peak: peakByUtc(ms), era: DEFAULT_ERA } }
  const byEventTime = fold([stamped(attempt(1, 1, usage(5, 5)), T_PEAK, 1)], peakByEventTime)
  check('没有 header 时用事件自己的 time',
    eventTime.length === 1 && eventTime[0] === T_PEAK
    && byEventTime.routes[0].peak === true,
    String(eventTime[0]))

  // 增量折叠器：分两批喂 == 一次性折；再喂一遍同一批不会重复计费。
  const events = [
    stamped(header('go', 'deepseek-flash'), T_PEAK, 1),
    stamped(attempt(1, 1, usage(100, 10)), T_PEAK, 2),
    stamped(header('go', 'deepseek-flash'), T_OFF, 3),
    stamped(attempt(2, 1, usage(200, 20)), T_OFF, 4),
  ]
  const folder = pure.createUsageFolder(tierAt(peakByUtc))
  folder.feed(events.slice(0, 2))
  const midway = folder.snapshot()
  folder.feed(events.slice(2))
  const incremental = folder.snapshot()
  const oneShot = fold(events, tierAt(peakByUtc))
  check('增量折叠：中途快照只有高峰那条',
    midway.routes.length === 1 && midway.routes[0].peak === true && midway.total.inputTokens === 100)
  check('增量折叠与一次性折叠结果逐字节一致',
    JSON.stringify(incremental) === JSON.stringify(oneShot),
    JSON.stringify(incremental))
  folder.feed(events)   // 整批重喂（宿主半"落后就重读一次"的补齐路径）
  check('重复喂同一批（seq 幂等）不会重复计费',
    JSON.stringify(folder.snapshot()) === JSON.stringify(oneShot),
    JSON.stringify(folder.snapshot()))
  check('诊断计数也不因重喂而翻倍',
    folder.snapshot().events === oneShot.events && folder.snapshot().samples === oneShot.samples)
  // 没有 seq 的事件无法去重（宿主半那条路的事件一定有 seq，这里只钉住"有 seq 才幂等"）。
  const noSeq = pure.createUsageFolder(tierAt(offPeakOnly))
  noSeq.feed([attempt(7, 7, usage(1, 1))])
  noSeq.feed([attempt(7, 7, usage(1, 1))])
  check('没有 seq：两条事件都算（第一遍折出 1/1，第二遍同一步同值 → 差异为 0，所以仍是 1/1）',
    noSeq.snapshot().total.inputTokens === 1, String(noSeq.snapshot().total.inputTokens))
}

// ══════════════ 8. 增量缓存：播种窗口 / 落后检测 / 淘汰（宿主半那条路）═══════════
//
// 这一段钉的是**宿主半唯一会"静默少算"的地方**：`feed()` 的去重是 seq 水位式的，一旦折过
// seq=12，再喂 seq=5 会被整条跳过。而播种要先 `await read()`（深拷贝整份日志，几百毫秒），
// 这期间追加的事件订阅会先看到 —— 若不缓冲，水位跳到快照之后，快照里那些中间事件**永久**
// 算不进来（补也补不进去）。所以用"读的时候顺手追加两条事件"的假 read 把它钉死。
console.log('8. 增量缓存 createUsageCache')
{
  const snapshot = () => [
    stamped(header('go', 'deepseek-flash'), T_PEAK, 1),
    stamped(attempt(1, 1, usage(100, 10)), T_PEAK, 2),
  ]

  // ── 首次读、之后走缓存 ──
  let reads = 0
  const cache = pure.createUsageCache(tierAt(peakByUtc))
  const first = await cache.sync('s1', 3, async () => { reads += 1; return snapshot() })
  check('首次 sync 读日志并折出用量',
    first.source === 'sessionQuery' && first.fold.total.inputTokens === 100, JSON.stringify(first.fold.total))
  const second = await cache.sync('s1', 3, async () => { reads += 1; return snapshot() })
  check('没落后就不读日志（source=cache，读次数仍是 1）', second.source === 'cache' && reads === 1)
  check('缓存保住了档位（高峰那条仍在）',
    second.fold.routes.length === 1 && second.fold.routes[0].peak === true)
  check('缓存也保住了价格档（era 跟着 route 一起缓存）',
    second.fold.routes[0].era === DEFAULT_ERA, JSON.stringify(second.fold.routes[0].era))

  // ── 落后检测：liveSeq 前进 → 重读补齐（只补新的那部分）──
  const grown = [...snapshot(), stamped(attempt(2, 1, usage(50, 5)), T_PEAK, 3)]
  const third = await cache.sync('s1', 4, async () => { reads += 1; return grown })
  check('liveSeq 前进 → 重读并把新的补上（150/15，不是 200/20 也不是 100/10）',
    third.source === 'sessionQuery' && third.fold.total.inputTokens === 150 && third.fold.total.outputTokens === 15,
    JSON.stringify(third.fold.total))
  check('补齐不会把已经折过的重复计费（samples 只加了新的那条）',
    reads === 2 && third.fold.samples === 2, String(third.fold.samples))

  // ── 播种窗口：读日志期间追加的事件 ──
  const windowCache = pure.createUsageCache(tierAt(peakByUtc))
  const late = [stamped(attempt(2, 1, usage(7, 7)), T_PEAK, 3)]
  const windowed = await windowCache.sync('s2', 4, async () => {
    // 模拟"读还没回来、会话又追加了事件"：此刻订阅先看到它们。
    for (const event of late) windowCache.event('s2', event)
    return snapshot()
  })
  check('播种窗口内追加的事件不会被吞掉（100/10 + 7/7）',
    windowed.fold.total.inputTokens === 107 && windowed.fold.total.outputTokens === 17,
    JSON.stringify(windowed.fold.total))
  check('播种窗口内的事件只算一次（两条 usage，不是三条）',
    windowed.fold.samples === 2 && windowed.fold.events === 3, `${windowed.fold.samples}/${windowed.fold.events}`)

  // ── 读失败不冒泡，且下次仍会重试 ──
  const failing = pure.createUsageCache(tierAt(peakByUtc))
  const bad = await failing.sync('s3', undefined, async () => { throw new Error('boom') })
  check('read 抛错不冒泡（返回空折、source=cache）',
    bad.source === 'cache' && bad.fold.total.inputTokens === 0)
  const retry = await failing.sync('s3', undefined, async () => snapshot())
  check('上次没读成功过 → 下次仍会重试（不会永久空着）',
    retry.source === 'sessionQuery' && retry.fold.total.inputTokens === 100)

  // ── 归档会话（拿不到 liveSeq）：只在首次读 ──
  let archivedReads = 0
  const archived = pure.createUsageCache(tierAt(peakByUtc))
  await archived.sync('a1', undefined, async () => { archivedReads += 1; return snapshot() })
  const again = await archived.sync('a1', undefined, async () => { archivedReads += 1; return snapshot() })
  check('没有 liveSeq（归档会话）时只在首次读一次', archivedReads === 1 && again.source === 'cache')

  // ── 没被问过的会话：订阅事件要被忽略，也不能因此建行 ──
  const cold = pure.createUsageCache(tierAt(peakByUtc))
  cold.event('nope', stamped(attempt(1, 1, usage(9, 9)), T_PEAK, 1))
  const coldFold = await cold.sync('nope', undefined, async () => [])
  check('没被问过的会话：先到的订阅事件被忽略（不凭空多出用量）',
    coldFold.fold.total.inputTokens === 0, JSON.stringify(coldFold.fold.total))

  // ── 上限淘汰：回来了就重读 ──
  let evictReads = 0
  const evict = pure.createUsageCache(tierAt(peakByUtc), { maxSessions: 2 })
  const rd = async () => { evictReads += 1; return snapshot() }
  await evict.sync('a', undefined, rd)
  await evict.sync('b', undefined, rd)
  await evict.sync('c', undefined, rd)
  await evict.sync('a', undefined, rd)
  check('超过上限按"最先被问的"淘汰（回来要重读）', evictReads === 4, String(evictReads))
}

// ══════════════ 9. 接口路径（两半必须用同一个常量）═════════════════════════════
console.log('9. 接口路径')
{
  check('USAGE_API_PATH 在 composer-ux 命名空间下',
    pure.USAGE_API_PATH === '/composer-ux/usage', String(pure.USAGE_API_PATH))
}

// ══════════════ 10. 价格档（era）是 route key 的一维（0.10.0）════════════════════
//
// 官方 2026-09-10 调过 Flash 的价。若新旧用量折进同一条 route，"每一档各花了多少"就只能
// 按**现在**的价结算 —— 历史金额会跟着变。所以 `era` 进 key：同一 `(provider, model, peak)`
// 下不同 `era` 必须是两条 route。这一节把这一维、以及"第三方路由没有峰谷/价档"一起钉住。
console.log('10. 价格档 era 作为 route key 的一维')
{
  const T_CUT = Date.UTC(2026, 8, 10, 4, 0)       // 官方调价时刻（UTC）
  const T_BEFORE = Date.UTC(2026, 7, 15, 12, 0)   // 调价前（UTC 12:00 = 空闲档）
  const T_AFTER = Date.UTC(2026, 8, 20, 12, 0)    // 调价后（同一时刻，仍空闲档）
  /** 按事件时刻取价格档：调价前 `peak-2026-08`、之后 `flash-2026-09-10`。 */
  const eraByTime = ms => (Number.isFinite(ms) && ms < T_CUT ? 'peak-2026-08' : 'flash-2026-09-10')
  const byEra = tierAt(peakByUtc, eraByTime)

  // ── 同一 (provider, model, peak)、不同 era → 两条 route ──
  const split = fold([
    stamped(header('deepseek-account', 'deepseek-flash'), T_BEFORE, 1),
    stamped(attempt(1, 1, usage(100, 10)), T_BEFORE, 2),
    stamped(header('deepseek-account', 'deepseek-flash'), T_AFTER, 3),
    stamped(attempt(2, 1, usage(200, 20)), T_AFTER, 4),
  ], byEra)
  const eraOf = tokens => split.routes.find(row => row.usage.inputTokens === tokens)?.era
  check('同一 (provider, model, peak) 下不同 era → 两条 route（"官调价后历史金额不变"的前提）',
    split.routes.length === 2, JSON.stringify(split.routes.map(r => [r.era, r.usage.inputTokens])))
  check('两条 route 的 era 各是各的（调价前 100 对应 peak-2026-08，调价后 200 对应 flash-2026-09-10）',
    eraOf(100) === 'peak-2026-08' && eraOf(200) === 'flash-2026-09-10',
    JSON.stringify(split.routes.map(r => [r.era, r.usage.inputTokens])))
  check('两条 route 只有 era 这一维不同（provider/model/peak 都一样）',
    split.routes.every(row => row.provider === 'deepseek-account' && row.model === 'deepseek-flash' && row.peak === false),
    JSON.stringify(split.routes))
  check('total 仍是两条之和（300/30），不会因为分了两条就少算',
    JSON.stringify(split.total) === JSON.stringify(usage(300, 30)) && pure.bucketTotal(split.total) === 330,
    JSON.stringify(split.total))

  // ── 同一档同一 era 的多次上报合并成一条 ──
  const merged = fold([
    stamped(header('deepseek-account', 'deepseek-flash'), T_BEFORE, 1),
    stamped(attempt(1, 1, usage(100, 10)), T_BEFORE, 2),
    stamped(header('deepseek-account', 'deepseek-flash'), T_BEFORE + 60_000, 3),
    stamped(attempt(2, 1, usage(50, 5)), T_BEFORE + 60_000, 4),
  ], byEra)
  check('同一档同一 era 的多次上报合并成一条 route（150/15，不是两条）',
    merged.routes.length === 1 && merged.total.inputTokens === 150 && merged.total.outputTokens === 15,
    JSON.stringify(merged.routes.map(r => [r.era, r.usage.inputTokens])))
  check('合并后仍是那一档的 era', merged.routes[0].era === 'peak-2026-08', String(merged.routes[0].era))

  // ── 第三方路由：与宿主半同一个判据（`isDeepSeekRoute`）分叉 ──
  // 第三方价是平坦的，没有峰谷也没有历史档，所以即便判定那一刻是高峰，也必须给 `{peak:false, era:''}`
  // —— 否则界面会多出两行假的"高峰用量"，还会被套上官方某一档的价。
  const host = tierAt(peakByUtc)
  const third = fold([
    stamped(header('opencode-go', 'glm-5'), T_PEAK, 1),          // provider 不含 deepseek、model 不以 deepseek 开头
    stamped(attempt(1, 1, usage(300, 30)), T_PEAK, 2),           // 上报时刻正是高峰
  ], host)
  check('第三方路由即便在高峰时刻也判 {peak:false, era:""}',
    third.routes.length === 1 && third.routes[0].peak === false && third.routes[0].era === '',
    JSON.stringify(third.routes))
  check('第三方路由不会出现"高峰档"的桶（tiers.peak 全 0，用量全在空闲档）',
    pure.bucketTotal(third.tiers.peak) === 0 && third.tiers.offPeak.inputTokens === 300
    && pure.bucketTotal(third.tiers.offPeak) === 330,
    JSON.stringify(third.tiers))
  // 对照：判据是"route 像不像 DeepSeek 官方"，中转站上跑的 deepseek-* 仍按官方峰谷与价档算。
  const relay = fold([
    stamped(header('opencode-go', 'deepseek-v4-pro'), T_PEAK, 1),
    stamped(attempt(1, 1, usage(300, 30)), T_PEAK, 2),
  ], host)
  check('中转站上的 deepseek-* 仍按官方判据拿到峰谷档与价格档',
    relay.routes.length === 1 && relay.routes[0].peak === true && relay.routes[0].era === DEFAULT_ERA,
    JSON.stringify(relay.routes))
  check('分叉判据与宿主半同源（`isDeepSeekRoute`：provider 含 deepseek 或 model 以 deepseek 开头）',
    pure.isDeepSeekRoute('opencode-go', 'deepseek-v4-pro') === true
    && pure.isDeepSeekRoute('deepseek-account', 'anything') === true
    && pure.isDeepSeekRoute('opencode-go', 'glm-5') === false
    && pure.isDeepSeekRoute(pure.UNKNOWN_ROUTE, pure.UNKNOWN_ROUTE) === false)
}

// ══════════════ 11. `UsageCache.clear()`：判定规则变了必须整份作废（0.10.0）════════
//
// 折叠结果里**固化了判定当时的事实**：峰谷档与价格档。所以"用户改了节假日表""同步来新的官方
// 价档"这类**规则本身**的变化不能靠"下次再折一遍"生效 —— `feed()` 的 seq 水位去重会把旧事件
// 整条跳过，金额会一直停在旧规则上（而且看不出来）。宿主半因此在这些设置变化时调 `clear()`：
// 下次取价重新读日志、按新规则重折。
console.log('11. UsageCache.clear()')
{
  let reads = 0
  /** 可变的判定规则：先"全谷价"，`clear()` 后改成"全峰价"（模拟节假日表/价档变了）。 */
  let allPeak = false
  const mutableTierAt = (ms, provider = '', model = '') => (
    !pure.isDeepSeekRoute(provider, model)
      ? { peak: false, era: '' }
      : { peak: allPeak, era: DEFAULT_ERA }
  )
  const log = () => [
    stamped(header('deepseek-account', 'deepseek-flash'), T_OFF, 1),
    stamped(attempt(1, 1, usage(100, 10)), T_OFF, 2),
  ]
  const cache = pure.createUsageCache(mutableTierAt)

  const first = await cache.sync('c1', 3, async () => { reads += 1; return log() })
  check('clear 前：按"全谷价"折，用量落在空闲档',
    first.source === 'sessionQuery' && first.fold.tiers.offPeak.inputTokens === 100
    && pure.bucketTotal(first.fold.tiers.peak) === 0,
    JSON.stringify(first.fold.tiers))

  const cached = await cache.sync('c1', 3, async () => { reads += 1; return log() })
  check('没 clear 时不重读，直接用缓存里那份',
    cached.source === 'cache' && reads === 1 && cached.fold.tiers.offPeak.inputTokens === 100)

  // 规则变了但**不清缓存** → 结果不动。这正是要防的静默错：金额一直停在旧规则上。
  allPeak = true
  const stale = await cache.sync('c1', 3, async () => { reads += 1; return log() })
  check('规则变了但不清缓存：结果仍停在旧规则（空闲档，读次数仍 1）—— 所以必须 clear()',
    stale.source === 'cache' && reads === 1
    && stale.fold.tiers.offPeak.inputTokens === 100 && pure.bucketTotal(stale.fold.tiers.peak) === 0,
    JSON.stringify(stale.fold.tiers))

  // clear()：整份作废 → 重新读一次日志，并按**新的** tierAt 规则重算。
  cache.clear()
  const redone = await cache.sync('c1', 3, async () => { reads += 1; return log() })
  check('clear() 之后同一会话再 sync() 会重新读一次日志（读计数 +1、source=sessionQuery）',
    reads === 2 && redone.source === 'sessionQuery', `${reads}/${redone.source}`)
  check('clear() 之后按新的 tierAt 规则重算：用量落到高峰档（旧规则下它在空闲档）',
    redone.fold.tiers.peak.inputTokens === 100 && pure.bucketTotal(redone.fold.tiers.offPeak) === 0,
    JSON.stringify(redone.fold.tiers))
  check('clear() 只改档位归属，总量不变（100/10）',
    JSON.stringify(redone.fold.total) === JSON.stringify(first.fold.total),
    JSON.stringify(redone.fold.total))
  check('clear() 之后 route 也带上新规则下的档位标记',
    redone.fold.routes.length === 1 && redone.fold.routes[0].peak === true
    && redone.fold.routes[0].era === DEFAULT_ERA,
    JSON.stringify(redone.fold.routes))
  check('clear() 之后再次 sync 又能走缓存（不每次重读）',
    (await cache.sync('c1', 3, async () => { reads += 1; return log() })).source === 'cache' && reads === 2,
    String(reads))
}

console.log(`\n${passes} passed / ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
