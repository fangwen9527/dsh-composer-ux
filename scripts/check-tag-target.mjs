/**
 * 发版门禁 ①：**tag 指向的提交，其 package.json 版本必须与 tag 名里的版本一致**。
 *
 * 为什么需要（照抄上游 `check-tag-target.mjs` 的问题意识）：
 * 手工打 tag 时很容易**指到另一条线的提交** —— tag 消息、名字、页面全都"看起来完全正常"，
 * 只有去读"那个提交里的 package.json"才看得出来。0.12.0 那次我是手工核的，
 * 现在固化成脚本：人眼会漏，脚本不会。
 *
 * 判据（不看分支名、不看 tag 消息，只看那个提交里的代码）：
 *   tag 名里的版本号  ==  该 tag 所指提交的 `package.json` 里的 version
 *
 * 用法：
 *   node scripts/check-tag-target.mjs                # 默认查 v<当前 package.json 版本>
 *   node scripts/check-tag-target.mjs v0.12.0 v0.11.0
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const versionOf = text => {
  const match = /"version"\s*:\s*"([^"]+)"/.exec(text)
  return match ? match[1] : null
}

const localVersion = versionOf(readFileSync('package.json', 'utf8'))
const tags = process.argv.slice(2)
const targets = tags.length > 0 ? tags : [`v${localVersion}`]

const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim()

let failed = 0
console.log(`检查 ${targets.length} 个 tag（当前 package.json 版本：${localVersion}）`)
for (const tag of targets) {
  const wanted = tag.replace(/^v/, '')
  let committed = null
  let exists = true
  try {
    committed = versionOf(git(['show', `${tag}:package.json`]))
  } catch {
    exists = false
  }
  if (!exists) {
    console.log(`✗ ${tag} —— 仓库里没有这个 tag（或那个提交里没有 package.json）`)
    failed += 1
    continue
  }
  if (committed === null) {
    console.log(`✗ ${tag} —— 该提交的 package.json 里读不出 version`)
    failed += 1
    continue
  }
  const same = committed === wanted
  console.log(`${same ? '✓' : '✗'} ${tag} —— tag 名说 ${wanted}，该提交里的 package.json 说 ${committed}`)
  if (!same) failed += 1
}

if (failed === 0) {
  console.log('\ntag 指向全部正确')
} else {
  console.error(`\n有 ${failed} 个 tag 的指向不对 —— 别拿它发版`)
}
process.exit(failed === 0 ? 0 : 1)
