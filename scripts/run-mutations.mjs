/**
 * 跑变异守卫，并把结果记成可机读的事实（`test/.last-mutation.json`）。
 *
 * 与 `run-tests.mjs` 同一个理由：`scripts/check-docs.mjs` 要判"README 里写的变异条数
 * 是不是真的"，判据得来自**最近一次真实运行**，而不是再数一遍文档。
 *
 * 用法：
 *   npm run test:mutations            # 会重建产物、逐条变异、逐条还原，慢（数分钟）
 *   node scripts/run-mutations.mjs     # 同上
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const RECORD = 'test/.last-mutation.json'

let out = ''
let ok = true
try {
  out = execFileSync(process.execPath, ['test/mutation-guards.mjs'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
} catch (error) {
  ok = false
  out = `${String(error.stdout ?? '')}${String(error.stderr ?? '')}`
}
process.stdout.write(out)

const bitten = (out.match(/^✓ 咬住了/gm) ?? []).length
const missed = (out.match(/^✗ 没咬住/gm) ?? []).length
const missing = (out.match(/变异点没找到/g) ?? []).length
const record = { at: new Date().toISOString(), cases: bitten + missed + missing, bitten, missed, missing }
writeFileSync(RECORD, `${JSON.stringify(record, null, 2)}\n`)
console.log(`\n变异记录：${record.cases} 条 · 咬住 ${bitten} · 没咬住 ${missed} · 变异点没找到 ${missing}`)
console.log(`记录已写入 ${RECORD}（供 check-docs 判漂移）`)
process.exit(ok && missed === 0 && missing === 0 ? 0 : 1)
