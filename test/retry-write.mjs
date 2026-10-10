/**
 * 「启动期写重试」（`retryWrite`）的护栏测试。
 *
 * 为什么值得单测：这个函数是为一次**真机事故**加的 —— 2026-10-10 在 0.2.1-alpha.2 的干净
 * profile 上，插件的「快捷指令」迁移在 apply 时写设置，撞上了宿主启动期对 profile 清单的
 * 原子写锁：
 *     atomic-write: timed out waiting for the writer lock at ...package.json.lock
 * 迁移被静默跳过（老用户会发现「快捷指令」入口没了）。锁是短暂的 ⇒ 退避重试就够。
 *
 * 这里钉住四件事：第一次成功只写一次、失败后能重试到成功、全部失败要把**最后一个**错误抛出去
 * （调用方靠它打日志）、退避不是零（否则等于忙等）。
 *
 *   node test/retry-write.mjs
 */
import { QUICK_MIGRATION_ATTEMPTS, QUICK_MIGRATION_RETRY_MS, retryWrite } from '../lib/index.js'

let passes = 0
let failures = 0

function check(label, condition, detail) {
  if (condition) {
    passes += 1
    console.log(`  ✓ ${label}`)
    return
  }
  failures += 1
  console.log(`  ✗ ${label}${detail === undefined ? '' : ` — ${detail}`}`)
}

console.log('\n一、第一次就成功：只写一次，不睡')
{
  let calls = 0
  const started = Date.now()
  await retryWrite(async () => { calls += 1 }, 3, 40)
  check('写了恰好一次', calls === 1, String(calls))
  check('没有退避等待（<30ms）', Date.now() - started < 30, `${Date.now() - started}ms`)
}

console.log('\n二、失败后重试到成功')
{
  let calls = 0
  await retryWrite(async () => {
    calls += 1
    if (calls < 3) throw new Error(`第 ${calls} 次被锁挡住`)
  }, 4, 5)
  check('第 3 次成功（总共 3 次）', calls === 3, String(calls))

  let calls2 = 0
  await retryWrite(async () => {
    calls2 += 1
    if (calls2 < 4) throw new Error('still locked')
  }, 4, 5)
  check('用满最后一个名额也能成（4/4）', calls2 === 4, String(calls2))
}

console.log('\n三、全部失败：把最后一个错误抛出去（调用方要拿它打日志）')
{
  let calls = 0
  let thrown
  try {
    await retryWrite(async () => {
      calls += 1
      throw new Error(`第 ${calls} 次失败`)
    }, 3, 5)
  } catch (error) {
    thrown = error
  }
  check('试满 attempts 次就停', calls === 3, String(calls))
  check('抛出的是最后一次的错误（不是第一次的）',
    thrown instanceof Error && thrown.message === '第 3 次失败', String(thrown))
}

console.log('\n四、默认参数合理（迁移那次用的就是它们）')
{
  check('至少重试一次（attempts ≥ 2）', QUICK_MIGRATION_ATTEMPTS >= 2, String(QUICK_MIGRATION_ATTEMPTS))
  check('退避非零（不然等于忙等锁）', QUICK_MIGRATION_RETRY_MS > 0, String(QUICK_MIGRATION_RETRY_MS))
  // 最坏情况的总等待：基数 × (1+2+…+(n-1))，别把宿主启动拖太久。
  const worst = QUICK_MIGRATION_RETRY_MS * ((QUICK_MIGRATION_ATTEMPTS - 1) * QUICK_MIGRATION_ATTEMPTS) / 2
  check('最坏等待不超过 5 秒（不拖慢启动）', worst <= 5000, `${worst}ms`)
}

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
