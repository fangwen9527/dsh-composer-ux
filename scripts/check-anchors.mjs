/**
 * 静态校验每个变异锚点：`from` 在目标文件里**恰好**能匹配到一处。
 *
 * 为什么需要它（2026-10-13 踩到）：重构把 `retryWrite` 抽到新模块后，锚点仍指向旧位置 ——
 * 那种锚点跑出来的结论是"变异点没找到"，不跑不知道，而跑一次要十几分钟。
 * 这个脚本一秒就能把这类漂移全列出来。
 */
import { readFileSync } from 'node:fs'

const norm = text => text.replace(/\r\n/g, '\n')
const src = norm(readFileSync('test/mutation-guards.mjs', 'utf8'))
const head = 'const cases = ['
const start = src.indexOf(head) + head.length - 1

let depth = 0
let quote = null
let escaped = false
let end = -1
for (let i = start; i < src.length; i += 1) {
  const ch = src[i]
  if (quote !== null) {
    if (escaped) { escaped = false; continue }
    if (ch === '\\') { escaped = true; continue }
    if (ch === quote) quote = null
    continue
  }
  if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue }
  if (ch === '[') depth += 1
  else if (ch === ']') {
    depth -= 1
    if (depth === 0) { end = i; break }
  }
}

const literal = src.slice(start, end + 1)
let cases
try {
  // 锚点表是纯数据字面量，直接求值最省事（也能容忍里面的正则字面量）。
  cases = new Function(`return ${literal}`)()
} catch (error) {
  console.log(`无法求值锚点表：${error.message}`)
  process.exit(1)
}

const escapeRe = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const stale = []
for (const item of cases) {
  let text
  try {
    text = norm(readFileSync(item.file, 'utf8'))
  } catch {
    stale.push([item.name, item.file, '文件读不到'])
    continue
  }
  const hits = text.split(norm(item.from)).length - 1
  if (hits === 0) stale.push([item.name, item.file, 'from 匹配不到'])
  else if (hits > 1) stale.push([item.name, item.file, `from 匹配 ${String(hits)} 处（歧义）`])
  void escapeRe
}

console.log(`锚点总数 ${String(cases.length)}；有问题 ${String(stale.length)}`)
for (const [name, file, why] of stale) console.log(` - ${name} | ${file} | ${why}`)
process.exit(stale.length === 0 ? 0 : 1)
