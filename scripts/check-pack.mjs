/**
 * 发版门禁 ②：**包里装的东西必须正好是白名单那一份**。
 *
 * 为什么需要（上游 `check-install` / `npm pack` 清单核对的问题意识）：
 * `files` 白名单写错、或者根目录多出个不该发的目录（`docs/`、`scripts/`、`test/`、`src/`），
 * 都会以"装完也没报错"的方式悄悄发出去 —— 发布是**不可撤回**的，所以发之前先核对。
 *
 * 判据：
 *   ① 必需项齐全（lib 两份产物、补丁层、三版 README、CHANGELOG、LICENSE、package.json）
 *   ② 不许出现开发用目录与文件（src/ test/ scripts/ docs/ .github/ types/ tsconfig.json）
 *   ③ 包里的 version 与工作区 package.json 一致
 *
 * 用法：node scripts/check-pack.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * 跨平台找到 npm 本身：Windows 上 `npm` 是 `.cmd` 垫片，`execFileSync('npm')` 会 ENOENT。
 * 优先用 npm 自己给的环境变量（在 npm script 里跑时一定有），否则从 node 同目录找 npm-cli.js。
 */
function npmInvocation() {
  const fromEnv = process.env.npm_execpath
  if (fromEnv && existsSync(fromEnv)) return { file: process.execPath, args: [fromEnv] }
  const beside = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  if (existsSync(beside)) return { file: process.execPath, args: [beside] }
  return { file: process.platform === 'win32' ? 'npm.cmd' : 'npm', args: [] }
}

const REQUIRED = [
  'package.json',
  'cordis.patch.yml',
  'lib/index.js',
  'lib/client.js',
  'README.md',
  'README.en.md',
  'README.simple.md',
  'CHANGELOG.md',
  'LICENSE',
]
/** 开发用目录/文件：一个都不该进包（`docs/` 里的截图与 PPT 只走 GitHub 链接）。 */
const FORBIDDEN = ['src/', 'test/', 'scripts/', 'docs/', '.github/', 'types/', 'tsconfig.json', 'node_modules/']

const npm = npmInvocation()
const raw = execFileSync(npm.file, [...npm.args, 'pack', '--dry-run', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
const parsed = JSON.parse(raw)
const pack = Array.isArray(parsed) ? parsed[0] : parsed
const paths = (pack.files ?? []).map(file => file.path)
const localVersion = JSON.parse(readFileSync('package.json', 'utf8')).version

let failed = 0
const missing = REQUIRED.filter(item => !paths.includes(item))
if (missing.length > 0) {
  console.log(`✗ 缺必需项：${missing.join(', ')}`)
  failed += missing.length
} else {
  console.log(`✓ 必需项齐全（${REQUIRED.length} 项）`)
}

const leaked = paths.filter(path => FORBIDDEN.some(prefix => path === prefix || path.startsWith(prefix)))
if (leaked.length > 0) {
  console.log(`✗ 夹带了开发用文件：${leaked.join(', ')}`)
  failed += leaked.length
} else {
  console.log('✓ 没有夹带 src/ test/ scripts/ docs/ .github/ types/')
}

if (pack.version !== localVersion) {
  console.log(`✗ 包里的版本 ${pack.version} ≠ 工作区 ${localVersion}`)
  failed += 1
} else {
  console.log(`✓ 版本一致：${pack.version}`)
}

console.log(`\n包内容 ${paths.length} 个文件、解包 ${(pack.unpackedSize / 1024).toFixed(0)} KB：`)
for (const path of paths.slice().sort()) console.log(`  · ${path}`)

if (failed === 0) {
  console.log('\n包内容核对通过')
} else {
  console.error(`\n包内容核对失败（${failed} 处）—— 别发`)
}
process.exit(failed === 0 ? 0 : 1)
