/**
 * 逐轮优化台账（`$DSH_HOME/composer-ux/optimize-log.jsonl`）的护栏测试。
 *
 * 这个功能的全部价值在两条：**"这轮为什么长这样"能回看**、**台账里不能有原文**。
 * 所以这里既测纯函数（记录形状、轮转、容错），也用真 CLI 跑一遍 `scripts/recap.mjs`，
 * 并拿 `src/optimize-ledger.ts` 的键白名单跟 recap 自己的字段表对一遍（防两边漂移）。
 *
 *   node test/optimize-ledger.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'

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

/** 把台账模块打包成能在 node 里 import 的 ESM（与其余纯函数套件同一套做法）。 */
async function loadModule() {
  const bundled = await build({
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    target: ['es2022'],
    logLevel: 'warning',
    stdin: {
      contents: "export * from '../src/optimize-ledger.ts'\n",
      resolveDir: join(process.cwd(), 'test'),
      loader: 'ts',
    },
  })
  return import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)
}

const ledger = await loadModule()
const homes = []
const tmpHome = () => {
  const dir = mkdtempSync(join(tmpdir(), 'composer-ux-ledger-'))
  homes.push(dir)
  return dir
}

console.log('1. 记录形状：只有数字与机器短串，没有文本载体')
{
  const record = ledger.buildLedgerRun({
    sessionId: 'x'.repeat(120),
    tier: 'advanced',
    provider: 'go',
    model: 'deepseek-flash',
    draftChars: 42.7,
    contextTurns: 4,
    contextChars: 1234,
    hadPrevious: true,
    items: 3,
    dropped: 2,
    droppedReasons: ['text 是空的', 'text 是空的', 'kind 不在允许列表里（rewrite）'],
    warnings: 1,
    fallback: false,
    retried: true,
    promptSource: 'builtin',
    ms: 17500.9,
    ok: true,
  })
  const keys = Object.keys(record)
  const extra = keys.filter(key => !ledger.LEDGER_RUN_KEYS.includes(key))
  check('键全在白名单里（多一个键就要解释它为什么不算隐私）', extra.length === 0, extra.join(','))
  check('kind 是 run、at 是 ISO 时间', record.kind === 'run' && /^\d{4}-\d{2}-\d{2}T/.test(record.at))
  check('数字都被取整（42.7 → 42、17500.9 → 17500）', record.draftChars === 42 && record.ms === 17500)
  check('hadPrevious / retried 是布尔（不是真值）', record.hadPrevious === true && record.retried === true)
  check('丢弃原因去重', record.droppedReasons.length === 2, record.droppedReasons.join('|'))
  check('sessionId 截到 64 字', record.sessionId.length === 64)
  check('失败时才有 failure 键', !('failure' in record))

  const failed = ledger.buildLedgerRun({
    sessionId: '', tier: 'basic', provider: 'go', model: 'm', draftChars: 0, contextTurns: 0,
    contextChars: 0, hadPrevious: false, items: 0, dropped: 0, droppedReasons: [], warnings: 0,
    fallback: false, retried: false, promptSource: 'builtin', ms: 10, ok: false,
    failure: '优化失败：模型返回错误\n第二行会被压平',
  })
  check('失败原因压平换行并截断', failed.failure === '优化失败：模型返回错误 第二行会被压平', failed.failure)
  const long = ledger.buildLedgerRun({ ...failed, failure: 'x'.repeat(500) })
  check('失败原因最多 200 字', long.failure.length === 200)
}

console.log('1b. 原因消毒：模型给的值不许被写进台账')
{
  // 这是本功能最要紧的一条：装配层的原因模板里嵌着**模型给的引文**（最多 40 字），
  // 而引文很可能就是用户原话的变体 —— 直接落盘就把"只记元数据"的承诺打破了。
  const secret = '独角兽紫罗兰七号'
  const raw = `引文不是原话里的逐字片段：「${secret}」`
  const safe = ledger.ledgerSafeReason(raw)
  check('消毒后保留机器的固定前缀', safe === '引文不是原话里的逐字片段：', safe)
  check('❗消毒后搜不到模型给的那段文字', !safe.includes(secret))

  check('kind 这类模型给的值也刮掉',
    ledger.ledgerSafeReason('kind 不在允许列表里（rewrite / requirement）') === 'kind 不在允许列表里')
  check('档位/kind 混排也能刮干净',
    ledger.ledgerSafeReason(`当前档位（advanced）不产出「${secret}」这一类条目`) === '当前档位不产出这一类条目')
  check('固定短语原样保留（没有引号括号就不动）', ledger.ledgerSafeReason('text 是空的') === 'text 是空的')
  check('固定短语里的数字保留（那是机器算的）',
    ledger.ledgerSafeReason('超过单轮上限 12 条 ⇒ 截断丢弃（整轮照常出成品）') === '超过单轮上限 12 条 ⇒ 截断丢弃')
  check('长度封顶 60', ledger.ledgerSafeReason('长'.repeat(200)).length === 60)

  const record = ledger.buildLedgerRun({
    sessionId: 's', tier: 'advanced', provider: 'go', model: 'm', draftChars: 10, contextTurns: 0,
    contextChars: 0, hadPrevious: false, items: 0, dropped: 1, droppedReasons: [raw], warnings: 0,
    fallback: false, retried: false, promptSource: 'builtin', ms: 5, ok: false,
    failure: `优化失败：模型返回错误「${secret}」`,
  })
  const line = JSON.stringify(record)
  check('❗整条记录里搜不到那段文字（原因与失败原因都过消毒）', !line.includes(secret))
  check('丢弃原因仍能回答"为什么丢"', record.droppedReasons[0] === '引文不是原话里的逐字片段：')
  check('失败原因也只剩固定前缀', record.failure === '优化失败：模型返回错误', record.failure)
}

console.log('2. 轮转：超上限保留尾部整行，并留一条轮转标记')
{
  check('没超上限就不轮转', ledger.rotateLedger('{"kind":"run"}\n', 1024) === null)
  const lines = Array.from({ length: 10 }, (_, index) => JSON.stringify({
    kind: 'run',
    // 补零：`0${10}` 会写成 `010`，而 `2026-01-010` 里**包含**子串 `2026-01-01` —— 这正是本次要断言的，
    // 夹具写错会把"尾部保留对不对"判成假的失败（第一次就是这么红的一条）。
    at: `2026-01-${String(index + 1).padStart(2, '0')}`,
    ms: index,
  }))
  const slim = ledger.rotateLedger(`${lines.join('\n')}\n`, 80)
  check('超上限时返回瘦身结果', slim !== null)
  check('丢掉的是最旧的（保留尾部）', slim.keptLines < 10 && slim.droppedLines === 10 - slim.keptLines)
  check('保留的是最新那几行', slim.text.includes('2026-01-10') && !slim.text.includes('2026-01-01'))

  const file = join(tmpHome(), 'composer-ux', 'optimize-log.jsonl')
  mkdirSync(join(file, '..'), { recursive: true })
  const big = `${Array.from({ length: 400 }, (_, i) => JSON.stringify({ kind: 'run', at: '2026-01-01T00:00:00.000Z', pad: 'x'.repeat(2000), i })).join('\n')}\n`
  writeFileSync(file, big)
  const result = ledger.appendLedger(ledger.buildLedgerRun({
    sessionId: 's', tier: 'basic', provider: 'p', model: 'm', draftChars: 1, contextTurns: 0, contextChars: 0,
    hadPrevious: false, items: 1, dropped: 0, droppedReasons: [], warnings: 0, fallback: false, retried: false,
    promptSource: 'builtin', ms: 5, ok: true,
  }), file)
  check('追加时触发轮转', result.written === true && result.rotated === true)
  const after = readFileSync(file, 'utf8')
  check('轮转写了一条 rotated 标记', after.includes('"kind":"rotated"'))
  check('文件变小了（真的瘦了身）', Buffer.byteLength(after) < Buffer.byteLength(big), `${Buffer.byteLength(after)} vs ${Buffer.byteLength(big)}`)
  check('新记录在文件里', after.trim().split('\n').at(-1).includes('"kind":"run"'))
}

console.log('3. 读：逐行容错（一行坏掉不判整份作废）')
{
  const text = [
    '{"kind":"run","at":"2026-01-01T00:00:00.000Z","ok":true}',
    '这不是 JSON',
    '',
    '{"kind":"rotated","at":"2026-01-02T00:00:00.000Z","droppedLines":5,"keptLines":5}',
    '{"没有kind":1}',
  ].join('\n')
  const { records, badLines } = ledger.readLedger(text)
  check('读到 2 条合法记录', records.length === 2, String(records.length))
  check('坏行计数（非 JSON + 缺 kind）', badLines === 2, String(badLines))
  check('rotated 标记也能读出来', records.some(record => record.kind === 'rotated'))
}

console.log('4. 写：绝不抛错（台账是旁路，不能拖垮已经花钱跑完的优化）')
{
  const dir = tmpHome()
  const blocker = join(dir, 'not-a-dir')
  writeFileSync(blocker, 'x')
  // 必须**显式接住**：变异把它改成抛错时，若这里不接，套件会直接崩掉、
  // 那条断言根本不会打出来 ——（变异检验就会如实判成'没咬住'，它第一次就是这么报的）。
  let threw = null
  let result = { written: true }
  try {
    result = ledger.appendLedger({ kind: 'rotated', at: '2026-01-01T00:00:00.000Z', droppedLines: 0, keptLines: 0 }, join(blocker, 'sub', 'log.jsonl'))
  } catch (error) {
    threw = error
  }
  check('路径不可写时返回 written=false 且不抛错', threw === null && result.written === false, threw === null ? '' : String(threw))
  check('clearLedger 对不存在的文件也算成功', ledger.clearLedger(join(dir, 'nope.jsonl')) === true)

  const file = join(tmpHome(), 'composer-ux', 'optimize-log.jsonl')
  ledger.appendLedger({ kind: 'rotated', at: '2026-01-01T00:00:00.000Z', droppedLines: 1, keptLines: 1 }, file)
  check('目录会自动创建', existsSync(file))
  check('清空后文件没了', ledger.clearLedger(file) === true && !existsSync(file))
}

console.log('5. 摘要（recap 用的统计）')
{
  const runs = [
    { kind: 'run', at: 'a', tier: 'basic', ms: 100, ok: true, items: 2, dropped: 1 },
    { kind: 'run', at: 'b', tier: 'basic', ms: 300, ok: false, items: 0, dropped: 0 },
    { kind: 'run', at: 'c', tier: 'advanced', ms: 200, ok: true, items: 1, dropped: 0 },
    { kind: 'rotated', at: 'd', droppedLines: 3, keptLines: 3 },
  ]
  const summary = ledger.summarizeLedger(runs)
  check('轮数/成功/失败', summary.runs === 3 && summary.ok === 2 && summary.failed === 1, JSON.stringify(summary))
  check('中位耗时（排序后取中）', summary.medianMs === 200, String(summary.medianMs))
  check('条目与丢弃合计', summary.items === 3 && summary.dropped === 1)
  check('按档位计数', summary.tiers.basic === 2 && summary.tiers.advanced === 1)
}

console.log('6. recap CLI：真进程跑，能看能清，坏行如实说')
{
  const file = join(tmpHome(), 'composer-ux', 'optimize-log.jsonl')
  mkdirSync(join(file, '..'), { recursive: true })
  writeFileSync(file, [
    JSON.stringify({ kind: 'run', at: '2026-09-29T12:00:00.000Z', sessionId: 'abc123', tier: 'advanced', provider: 'go', model: 'deepseek-flash', draftChars: 42, contextTurns: 4, contextChars: 1600, hadPrevious: false, items: 3, dropped: 1, droppedReasons: ['text 是空的'], warnings: 0, fallback: false, retried: true, promptSource: 'builtin', ms: 17500, ok: true }),
    '半截坏行',
    JSON.stringify({ kind: 'run', at: '2026-09-29T12:05:00.000Z', sessionId: 'def456', tier: 'basic', provider: 'go', model: 'deepseek-flash', draftChars: 8, contextTurns: 0, contextChars: 0, hadPrevious: false, items: 0, dropped: 0, droppedReasons: [], warnings: 1, fallback: true, retried: false, promptSource: 'custom', ms: 900, ok: false, failure: '模型返回错误' }),
  ].join('\n') + '\n')

  const run = args => execFileSync(process.execPath, ['scripts/recap.mjs', '--file', file, ...args], { encoding: 'utf8' })
  const table = run([])
  check('表格有表头与两行', table.includes('档位') && table.includes('advanced') && table.includes('basic'))
  check('丢弃原因单独一行显示', table.includes('text 是空的'))
  check('失败行的原因如实显示', table.includes('模型返回错误'))
  check('坏行被计数而不是整份作废', table.includes('有 1 行读不出来'))
  check('落款写清"不含任何原文"', table.includes('不含任何原文'))
  check('合计行有轮数与中位耗时', /共 2 轮（成功 1 \/ 失败 1）/.test(table) && table.includes('中位耗时'))

  const parsed = JSON.parse(run(['--json']))
  check('--json 是机器可读的', Array.isArray(parsed.records) && parsed.records.length === 2 && parsed.badLines === 1)

  const filtered = run(['--session', 'abc'])
  check('--session 前缀过滤', filtered.includes('advanced') && !filtered.includes('basic'))

  const limited = JSON.parse(run(['--last', '1', '--json']))
  check('--last 只取最后 N 轮', limited.records.length === 1 && limited.records[0].tier === 'basic')

  const cleared = run(['--clear'])
  check('--clear 清空', cleared.includes('已清空') && !existsSync(file))

  const missing = run([])
  check('文件不在时给的是"还没有台账"而不是报错', missing.includes('还没有台账'))
}

console.log('7. 字段表同步：recap 手写的字段表 == 模块的键白名单')
{
  const source = readFileSync('scripts/recap.mjs', 'utf8').replace(/\r\n/g, '\n')
  const block = /const RUN_KEYS = \[([\s\S]*?)\]/.exec(source)
  const names = [...(block?.[1] ?? '').matchAll(/'([^']+)'/g)].map(match => match[1])
  check('recap 的 RUN_KEYS 与 optimize-ledger.ts 一致',
    names.length === ledger.LEDGER_RUN_KEYS.length
    && names.every((name, index) => name === ledger.LEDGER_RUN_KEYS[index]),
    `${names.join(',')} vs ${ledger.LEDGER_RUN_KEYS.join(',')}`)
}

for (const dir of homes) rmSync(dir, { recursive: true, force: true })
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
