#!/usr/bin/env node
/**
 * `recap`：把逐轮优化台账（`$DSH_HOME/composer-ux/optimize-log.jsonl`）打成一张表。
 *
 * 用途：优化跑完只剩一句状态行，过一会儿就没了。"这轮为什么长这样" —— 读了多少上下文、
 * 丢了哪几条、为什么丢、是不是重试过、花了多久、走的哪条路由 —— 这里能回看。
 *
 * 用法：
 *   node scripts/recap.mjs                  # 最近 20 轮
 *   node scripts/recap.mjs --last 5         # 最近 5 轮
 *   node scripts/recap.mjs --session 6f2a   # 只某会话（sessionId 前缀）
 *   node scripts/recap.mjs --json           # 机器读（原始记录数组）
 *   node scripts/recap.mjs --clear          # 清空（不可撤销）
 *   node scripts/recap.mjs --file <path>    # 指别的台账文件（默认 $DSH_HOME 下那份）
 *
 * 为什么是**自包含**的：它是排查工具，不该为了跑它去装构建依赖（esbuild 是 devDependency）。
 * 所以这里手写字段表；`test/optimize-ledger.mjs` 会拿 `src/optimize-ledger.ts` 的键白名单
 * 跟这里的字段表对一遍，防止两边漂移。
 */
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** 与 src/optimize-ledger.ts 的 LEDGER_RUN_KEYS 保持同步（有测试盯着）。 */
const RUN_KEYS = [
  'kind', 'at', 'sessionId', 'tier', 'provider', 'model', 'draftChars', 'contextTurns', 'contextChars',
  'hadPrevious', 'items', 'dropped', 'droppedReasons', 'warnings', 'fallback', 'retried',
  'promptSource', 'ms', 'ok', 'failure',
  'toolRounds', 'toolCalls', 'toolNames', 'toolCapped', 'toolFallback', 'toolRejected', 'toolError',
]

const argv = process.argv.slice(2)
const flag = name => {
  const index = argv.indexOf(`--${name}`)
  return index >= 0 ? (argv[index + 1] ?? '') : undefined
}
const has = name => argv.includes(`--${name}`)

const dshHome = () => {
  const fromEnv = (process.env.DSH_HOME ?? '').trim()
  return fromEnv !== '' ? fromEnv : join(homedir(), '.dsh')
}
const file = flag('file') || join(dshHome(), 'composer-ux', 'optimize-log.jsonl')

if (has('clear')) {
  if (!existsSync(file)) {
    console.log(`没有台账文件（${file}），无需清空`)
    process.exit(0)
  }
  try {
    unlinkSync(file)
    console.log(`已清空：${file}`)
  } catch (error) {
    // 删不掉就写空 —— 至少内容没了，而不是骗用户说清空了。
    writeFileSync(file, '')
    console.log(`删不掉（${String(error)}），已改写为空文件：${file}`)
  }
  process.exit(0)
}

if (!existsSync(file)) {
  console.log(`还没有台账（${file}）`)
  console.log('· 台账默认开：跑一次「优化提示词」就会有一条；也可以在设置页 → 输入快捷指令卡片里检查那个开关。')
  process.exit(0)
}

const lines = readFileSync(file, 'utf8').split('\n')
const records = []
let badLines = 0
for (const line of lines) {
  const trimmed = line.trim()
  if (trimmed === '') continue
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed === 'object' && typeof parsed.kind === 'string') records.push(parsed)
    else badLines += 1
  } catch {
    badLines += 1
  }
}

const sessionPrefix = flag('session')
const filtered = sessionPrefix ? records.filter(record => String(record.sessionId ?? '').startsWith(sessionPrefix)) : records
const runs = filtered.filter(record => record.kind === 'run')
const rotations = filtered.filter(record => record.kind === 'rotated')
const last = Number(flag('last') ?? 20)
const shown = Number.isFinite(last) && last > 0 ? runs.slice(-last) : runs

if (has('json')) {
  console.log(JSON.stringify({ file, badLines, rotations: rotations.length, records: shown }, null, 2))
  process.exit(0)
}

const pad = (text, width) => {
  // 中文按两格宽算，否则表格对不齐。
  const widthOf = value => [...String(value)].reduce((sum, char) => sum + (/[\u4e00-\u9fff\uff00-\uffef]/.test(char) ? 2 : 1), 0)
  const raw = String(text)
  return raw + ' '.repeat(Math.max(0, width - widthOf(raw)))
}
const clock = iso => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '(时间无法解析)'
  const two = value => String(value).padStart(2, '0')
  return `${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}`
}

console.log(`台账：${file}`)
if (sessionPrefix) console.log(`过滤：sessionId 前缀 ${sessionPrefix}`)
console.log('')
console.log(`  ${pad('时间', 12)}${pad('档位', 8)}${pad('草稿', 7)}${pad('上下文', 12)}${pad('条目', 7)}${pad('丢弃', 7)}${pad('工具', 7)}${pad('耗时', 9)}${pad('结果', 6)}路由`)
console.log(`  ${'-'.repeat(86)}`)
for (const record of shown) {
  const context = `${record.contextTurns ?? 0}轮/${record.contextChars ?? 0}字`
  const tools = record.toolCalls ? `${record.toolRounds ?? 0}轮/${record.toolCalls}次` : '—'
  const result = record.ok ? '成功' : `失败`
  const note = record.ok
    ? (record.fallback ? '（整段照收）' : record.retried ? '（重试过）' : '')
      + (record.toolFallback ? '（查证后回落）' : record.toolCapped ? '（查证触顶）' : '')
    : ` ${String(record.failure ?? '').slice(0, 40)}`
  console.log(`  ${pad(clock(record.at), 12)}${pad(record.tier ?? '-', 8)}${pad(record.draftChars ?? 0, 7)}${pad(context, 12)}${pad(record.items ?? 0, 7)}${pad(record.dropped ?? 0, 7)}${pad(tools, 7)}${pad(`${record.ms ?? 0}ms`, 9)}${pad(result, 6)}${record.provider ?? ''}/${record.model ?? ''}${note}`)
  if (Array.isArray(record.droppedReasons) && record.droppedReasons.length > 0) {
    console.log(`  ${' '.repeat(12)}↳ 丢弃原因：${record.droppedReasons.join(' · ')}`)
  }
}

const ok = runs.filter(record => record.ok).length
const durations = runs.map(record => Number(record.ms ?? 0)).sort((a, b) => a - b)
const median = durations.length === 0 ? 0 : durations[Math.floor(durations.length / 2)]
console.log('')
console.log(`共 ${runs.length} 轮（成功 ${ok} / 失败 ${runs.length - ok}）· 中位耗时 ${median}ms · 条目合计 ${runs.reduce((sum, r) => sum + Number(r.items ?? 0), 0)} · 丢弃合计 ${runs.reduce((sum, r) => sum + Number(r.dropped ?? 0), 0)}`)
if (rotations.length > 0) console.log(`（台账被轮转过 ${rotations.length} 次，更早的行已按上限丢掉）`)
if (badLines > 0) console.log(`（有 ${badLines} 行读不出来，已跳过 —— 台账逐行容错，不因为一行坏掉就整份作废）`)
console.log('· 台账只记元数据（数字与原因），不含任何原文。')
