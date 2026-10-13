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
import { readFileSync, writeFileSync } from 'node:fs'

const RECORD = 'test/.last-mutation.json'
const GUARDS = 'test/mutation-guards.mjs'

/**
 * 跑之前先把**所有会被改的文件**的内容记下来，跑完对照。
 *
 * 为什么（2026-10-13 真机踩到，代价很大）：我用 300 秒超时直接跑了一次
 * `node test/mutation-guards.mjs`，被杀在半途 —— 于是 `src/optimize-ledger.ts`
 * **停在了变异后的状态**，而表面上看不出任何异常：后续 npm test 仍然全绿（它跑的是 lib/），
 * 只有下一条锚点的"from 匹配不到"才把线索露出来。
 * 变异测试的价值全押在"改动一定被还原"上，这一条必须自己证明，不能假设。
 */
const snapshot = new Map()
try {
  for (const match of readFileSync(GUARDS, 'utf8').matchAll(/^\s*file: '([^']+)'/gm)) {
    const file = match[1]
    if (!snapshot.has(file)) snapshot.set(file, readFileSync(file, 'utf8'))
  }
} catch {
  /* 守卫脚本自己读不出来 ⇒ 下面那条 cases===0 分支会兜住 */
}

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
const cases = bitten + missed + missing

/**
 * 一条都没跑起来 = 环境/语法坏了，不是"全过"。
 *
 * 2026-10-10 踩过：往 `test/mutation-guards.mjs` 加锚点时引号没转义，守卫脚本当场语法错误、
 * 什么都没输出，而这里照旧把 `{cases: 0, bitten: 0}` 写进记录并打印"咬住 0" ——
 * 一次 4 分钟的空转，记录还是假的（靠 check-docs 比数字才发现）。
 * 所以这种情况**不写记录**、直接非零退出。
 */
if (cases === 0) {
  console.error('\n变异一条都没跑起来（守卫脚本自己出错，或锚点表是空的）—— 不写记录，请看上面的报错')
  process.exit(2)
}

// 还原完整性：任何一个被改过的文件与快照不一致，都说明这次运行**污染了工作区**。
const dirty = []
for (const [file, before] of snapshot) {
  try {
    if (readFileSync(file, 'utf8') !== before) dirty.push(file)
  } catch {
    dirty.push(`${file}（读不到了）`)
  }
}

const record = { at: new Date().toISOString(), cases, bitten, missed, missing, dirty: dirty.length }
writeFileSync(RECORD, `${JSON.stringify(record, null, 2)}\n`)
console.log(`\n变异记录：${record.cases} 条 · 咬住 ${bitten} · 没咬住 ${missed} · 变异点没找到 ${missing}`)
if (dirty.length > 0) {
  console.error(`\n❗有 ${String(dirty.length)} 个文件没还原干净（变异残留会污染后续所有测试）：`)
  for (const file of dirty) console.error(`   - ${file}`)
  console.error('   先 `git checkout` 还原这些文件，再重跑。记录里的 dirty 字段已标记。')
}
console.log(`记录已写入 ${RECORD}（供 check-docs 判漂移）`)
process.exit(ok && missed === 0 && missing === 0 && dirty.length === 0 ? 0 : 1)
