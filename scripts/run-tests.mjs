/**
 * 跑全部测试套件，并把结果**记成可机读的事实**（`test/.last-run.json`）。
 *
 * 为什么要包一层：`scripts/check-docs.mjs` 要判"README 里写的『18 个套件 / N 条』
 * 是不是真的"。判据不能是"再数一遍文档里的数字"，而要有**一份可信的事实来源** ——
 * 就是最近一次真实运行的结果。直接跑 `node test/*.mjs` 不会留下这份记录。
 *
 * 用法：
 *   npm test                    # = node scripts/run-tests.mjs
 *   node scripts/run-tests.mjs --json   # 只打 JSON
 *
 * 失败语义：任一套件非零退出或出现 "✗" 行 ⇒ 整体非零退出（CI 就是靠这个红的）。
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const JSON_ONLY = process.argv.includes('--json')
const RECORD = 'test/.last-run.json'

/** 从 package.json 的 `test:suites` 脚本里解析套件清单（单一事实来源，不另抄一份列表）。
 *  注意读的是 `test:suites` 而不是 `test`：后者就是本脚本自己，读它会自我指涉。 */
function suiteList() {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  const script = String(pkg.scripts?.['test:suites'] ?? '')
  return [...script.matchAll(/node\s+(\S+\.mjs)/g)].map(match => match[1])
}

const suites = suiteList()
if (suites.length === 0) {
  console.error('解析不出套件清单：package.json 的 scripts["test:suites"] 里应当是一串 `node test/x.mjs`')
  process.exit(2)
}

let total = 0
let failed = 0
const rows = []
for (const suite of suites) {
  let out = ''
  let ok = true
  try {
    out = execFileSync(process.execPath, [suite], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    ok = false
    out = `${String(error.stdout ?? '')}${String(error.stderr ?? '')}`
  }
  // 两种既有小结格式都要认：`N passed, 0 failed` 与 `N passed / 0 failed`。
  const tail = out.split('\n').reverse().find(line => /passed\s*[,/]/.test(line)) ?? ''
  const match = /(\d+)\s*passed\s*[,/]\s*(\d+)\s*failed/.exec(tail)
  const passed = match ? Number(match[1]) : 0
  const suiteFailed = match ? Number(match[2]) : 1
  const reds = (out.match(/^\s*✗/gm) ?? []).length
  total += passed
  failed += suiteFailed + reds
  rows.push({ suite, passed, failed: suiteFailed, reds, ok })
  if (!JSON_ONLY) {
    console.log(`${ok && suiteFailed === 0 && reds === 0 ? '✓' : '✗'} ${suite.padEnd(38)} ${passed} 条`)
  }
}

const record = {
  at: new Date().toISOString(),
  suites: suites.length,
  total,
  failed,
  rows,
}
writeFileSync(RECORD, `${JSON.stringify(record, null, 2)}\n`)

if (JSON_ONLY) {
  console.log(JSON.stringify(record, null, 2))
} else {
  console.log(`\n合计 ${suites.length} 个套件 · ${total} 条 · 失败 ${failed}`)
  console.log(`记录已写入 ${RECORD}（供 check-docs 判漂移）`)
}
process.exit(failed === 0 ? 0 : 1)
