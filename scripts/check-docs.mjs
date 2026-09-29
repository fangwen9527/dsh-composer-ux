/**
 * 发版门禁 ③：**状态类文档里的数字必须与事实一致**（文档漂移检查）。
 *
 * 上游 `check-docs.mjs` 的两条教训我都照抄了，因为它们都是踩出来的：
 *   ① **别查历史日志**：CHANGELOG 里“当时是 1736 条”是**正确的历史记录**，把它一起查会把对的判成错的
 *      ⇒ 这里只查 CHANGELOG 的**首行版本号**，正文一个字都不查。
 *   ② **判据要收窄**：用 `(\d+)\s*项` 这种宽正则会把绝大多数正常数字都当成漂移
 *      ⇒ 这里只认 README 里那两句**固定措辞**（套件数/条数、变异条数），别处一律不看。
 *
 * 事实来源：`package.json` 的版本与套件清单、`test/.last-run.json`、`test/.last-mutation.json`
 * （后两份由 `npm test` / `npm run test:mutations` 写入 —— 所以本脚本判的是"文档 vs 最近一次真实运行"）。
 *
 * 用法：node scripts/check-docs.mjs
 */
import { existsSync, readFileSync } from 'node:fs'

const read = path => readFileSync(path, 'utf8')
const readJson = path => JSON.parse(read(path))

const pkg = readJson('package.json')
const version = pkg.version
const suiteCount = [...String(pkg.scripts?.['test:suites'] ?? '').matchAll(/node\s+(\S+\.mjs)/g)].length

const problems = []
const ok = message => console.log(`✓ ${message}`)
const bad = message => { console.log(`✗ ${message}`); problems.push(message) }

// ① 版本：CHANGELOG 首行版本号 == package.json
{
  const head = read('CHANGELOG.md')
  const match = /^##\s*\[([^\]]+)\]/m.exec(head)
  if (match === null) bad('CHANGELOG.md 里找不到 `## [x.y.z]` 这样的版本行')
  else if (match[1] !== version) bad(`CHANGELOG 首行版本 ${match[1]} ≠ package.json 的 ${version}`)
  else ok(`CHANGELOG 首行版本与 package.json 一致（${version}）`)
}

// ② 套件数 + 条数：README 那句固定措辞 == 事实（事实来自最近一次 npm test）
{
  const readme = read('README.md')
  const claim = /(\d+)\s*个套件；当前\s*(\d+)\s*passed,\s*(\d+)\s*failed/.exec(readme)
  if (claim === null) {
    bad('README.md 里找不到「N 个套件；当前 N passed, N failed」这句（改措辞就要同步改本脚本的判据）')
  } else {
    const [, suites, passed, failed] = claim.map(Number)
    if (suites !== suiteCount) bad(`README 说 ${suites} 个套件，package.json 的 test:suites 里是 ${suiteCount} 个`)
    else ok(`套件数与 test:suites 一致（${suites}）`)

    if (!existsSync('test/.last-run.json')) {
      console.log('· 没有 test/.last-run.json —— 先跑 `npm test` 才能核对条数（本次跳过这半条）')
    } else {
      const last = readJson('test/.last-run.json')
      if (last.total !== passed) bad(`README 说 ${passed} 条，最近一次 npm test 实际 ${last.total} 条`)
      else if (failed !== 0 || last.failed !== 0) bad(`README 说失败 ${failed}，最近一次实际失败 ${last.failed}`)
      else ok(`测试条数与最近一次 npm test 一致（${passed} 条，0 失败）`)
    }
  }
}

// ③ 变异条数：README 那句固定措辞 == 事实（事实来自最近一次 npm run test:mutations）
{
  const readme = read('README.md')
  const claim = /（(\d+)\s*条，须单独跑）/.exec(readme)
  if (claim === null) {
    bad('README.md 里找不到「（N 条，须单独跑）」这句')
  } else if (!existsSync('test/.last-mutation.json')) {
    console.log('· 没有 test/.last-mutation.json —— 先跑 `npm run test:mutations` 才能核对（本次跳过）')
  } else {
    const last = readJson('test/.last-mutation.json')
    const claimed = Number(claim[1])
    if (claimed !== last.bitten) bad(`README 说变异 ${claimed} 条，最近一次实际咬住 ${last.bitten} 条`)
    else if (last.missed > 0 || last.missing > 0) bad(`最近一次变异：没咬住 ${last.missed} · 变异点没找到 ${last.missing}`)
    else ok(`变异条数与最近一次运行一致（${claimed} 条，全部咬住）`)
  }
}

// ④ 文档里引用的实机截图，本地文件必须存在（图挂了是"看起来正常"的另一类漂移）
{
  for (const file of ['README.md', 'README.en.md', 'README.simple.md']) {
    const text = read(file)
    const refs = [...text.matchAll(/raw\.githubusercontent\.com\/[^)\s]+\/v[^/]+\/(docs\/[^)\s]+\.png)/g)].map(m => m[1])
    const missing = [...new Set(refs)].filter(ref => !existsSync(ref))
    if (refs.length === 0) console.log(`· ${file} 没有引用实机截图（跳过）`)
    else if (missing.length > 0) bad(`${file} 引用了不存在的图：${missing.join(', ')}`)
    else ok(`${file} 引用的 ${new Set(refs).size} 张实机截图本地都在`)
  }
}

if (problems.length === 0) {
  console.log('\n文档数字与事实一致')
} else {
  console.error(`\n文档漂移 ${problems.length} 处 —— 改文档或改事实，别让它俩各说一套`)
}
process.exit(problems.length === 0 ? 0 : 1)
