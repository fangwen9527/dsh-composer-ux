#!/usr/bin/env node
/**
 * `dsh-composer-ux` 命令行（0.22.0）。
 *
 * 为什么要有它（借鉴 dsh-ops 的 install/status/uninstall）：
 *   · 安装：官方 CLI 的用法与"保留 profile"的坑（桌面端得用应用自带的那个 CLI）对新手不友好，
 *     这里把探测与提示做掉，**但绝不自己实现一套 profile 锁与回滚** —— 一律委托官方 CLI；
 *   · 排障：`status` / `doctor` 把"装到哪了、版本对不对、依赖在不在"直接打出来。
 *     更完整的运行时报告（设置字段、终端替换、请求头覆盖…）在设置页那张「自检」卡里 ——
 *     那需要跑在宿主进程里读服务，CLI 拿不到。
 *
 * 用法：
 *   npx dsh-composer-ux status  [--profile desktop]
 *   npx dsh-composer-ux doctor  [--profile desktop] [--dsh-cli <path>]
 *   npx dsh-composer-ux install [--profile desktop] [--dsh-cli <path>] [--version 0.22.0]
 *   npx dsh-composer-ux uninstall [--profile desktop] [--dsh-cli <path>]
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const PACKAGE = 'dsh-composer-ux'
const SELF = dirname(dirname(fileURLToPath(import.meta.url)))
const own = JSON.parse(readFileSync(join(SELF, 'package.json'), 'utf8'))

/** 解析 `--flag value` 风格的参数（不做花哨的短选项）。 */
function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token.startsWith('--')) {
      const key = token.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) out[key] = true
      else { out[key] = next; i += 1 }
    } else out._.push(token)
  }
  return out
}

const dshHome = () => (typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME !== ''
  ? process.env.DSH_HOME
  : join(homedir(), '.dsh'))

/** 列出所有 profile 及其是否装了本插件。 */
function listProfiles() {
  const root = join(dshHome(), 'profiles')
  const rows = []
  let names = []
  try {
    names = readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name)
  } catch {
    return rows
  }
  for (const name of names) {
    const dir = join(root, name)
    const manifest = join(dir, 'package.json')
    let declared = false
    let installed = ''
    try {
      const parsed = JSON.parse(readFileSync(manifest, 'utf8'))
      declared = parsed?.dependencies?.[PACKAGE] !== undefined
        || (parsed?.dsh?.profile?.bundles ?? []).includes(PACKAGE)
    } catch { /* 没有 package.json 就当作没装 */ }
    const versionFile = join(dir, 'node_modules', PACKAGE, 'package.json')
    if (existsSync(versionFile)) {
      try { installed = JSON.parse(readFileSync(versionFile, 'utf8')).version ?? '' } catch { installed = '' }
    }
    if (declared || installed !== '') rows.push({ name, dir, declared, installed })
  }
  return rows
}

/**
 * 找官方 CLI。
 *
 * 桌面端必须用它自带的那个（普通 CLI 管不了保留的 `desktop` profile）——这与 dsh-ops 的说明一致。
 */
function findDshCli(explicit) {
  const candidates = []
  if (typeof explicit === 'string') candidates.push(explicit)
  if (typeof process.env.DSH_CLI === 'string' && process.env.DSH_CLI !== '') candidates.push(process.env.DSH_CLI)
  const localAppData = process.env.LOCALAPPDATA ?? ''
  if (localAppData !== '') {
    candidates.push(join(localAppData, 'Programs', 'DeepSeek Harness', 'resources', 'runtime', 'cli', 'bin', 'dsh.cmd'))
  }
  for (const base of ['C:/Program Files/DeepSeek Harness', 'D:/deepseekharness', 'D:/DeepSeek Harness']) {
    candidates.push(join(base, 'resources', 'runtime', 'cli', 'bin', 'dsh.cmd'))
    candidates.push(join(base, 'apps', 'cli', 'lib', 'bin.js'))
  }
  candidates.push('dsh')
  for (const candidate of candidates) {
    if (candidate === 'dsh') return { cli: candidate, how: 'PATH 上的 dsh' }
    if (existsSync(candidate)) return { cli: candidate, how: candidate }
  }
  return undefined
}

/** 跑官方 CLI（一律委托，不自己动 profile）。 */
function runOfficial(cli, args, options) {
  const isNodeScript = cli.endsWith('.js')
  const command = isNodeScript ? process.execPath : cli
  const argv = isNodeScript ? [cli, ...args] : args
  console.log(`> ${command} ${argv.join(' ')}`)
  // Windows 上的 .cmd/.bat 包装器必须经 shell 才能起（否则 spawnSync 直接 ENOENT）。
  const needsShell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(command)
  const result = spawnSync(command, argv, {
    stdio: 'inherit',
    windowsHide: true,
    ...(needsShell ? { shell: true } : {}),
    ...options,
  })
  return result.status ?? 1
}

function cmdStatus(args) {
  console.log(`${PACKAGE} ${own.version}（本机 CLI）`)
  console.log(`DSH_HOME: ${dshHome()}`)
  const profiles = listProfiles()
  const only = typeof args.profile === 'string' ? args.profile : undefined
  const rows = only === undefined ? profiles : profiles.filter(row => row.name === only)
  const cliForStatus = findDshCli(args['dsh-cli'])
  const runtimeForStatus = cliForStatus === undefined ? '' : dshRuntimeVersion(cliForStatus.cli)
  if (rows.length === 0) {
    console.log(only === undefined ? '没有找到任何装过本插件的 profile。' : `profile ${only} 里没装本插件。`)
  }
  for (const row of rows) {
    console.log(`· profile ${row.name}：${row.declared ? '已在 package.json 里声明' : '只在 node_modules 里'}；装上的是 ${row.installed === '' ? '（读不到版本）' : row.installed}`)
    const term = toolTerminalState(row.dir, runtimeForStatus)
    if (term.toolVersion === '') {
      console.log('    · 持久终端：profile 里没有 @deepseek-ai/dsh-tool-terminal（模型那 6 个 terminal_* 工具会缺）')
    } else if (term.mismatch) {
      console.log(`    · ❗持久终端：tool-terminal ${term.toolVersion} 要求 ${term.peerRequired}，profile 里实际 ${term.peerInstalled} ⇒ 宿主会禁用那一行`)
      console.log(`      修法：dsh plugin --profile ${row.name} add @deepseek-ai/dsh-tool-terminal@<运行时版本>`)
    } else if (runtimeForStatus !== '' && term.toolVersion !== runtimeForStatus) {
      // 只是提示：这个 profile 可能属于**另一个安装**（例如桌面应用的 profile），那就正常。
      console.log(`    · 持久终端：tool-terminal ${term.toolVersion}；与本次所用 CLI 的运行时 ${runtimeForStatus} 不同`)
      console.log('      （若该 profile 属于另一个安装，这是正常的；要确认就换成那个安装的 CLI 再跑一次 —— 宿主自检那张卡会直接说）')
    } else {
      console.log(`    · 持久终端：tool-terminal ${term.toolVersion}（要求 ${term.peerRequired || '无'}，profile 里 ${term.peerInstalled || '读不到'}）`)
    }
  }
  console.log(`官方 CLI：${cliForStatus === undefined ? '没找到（安装/卸载时用 --dsh-cli 指定）' : cliForStatus.how}`)
  console.log(`运行时版本：${runtimeForStatus || '（读不到）'}`)
  return 0
}

/**
 * 读一个 profile 里「持久终端三件套」的实际状态。
 *
 * 为什么 CLI 也要管这件事（2026-10-15 真机踩到）：`@deepseek-ai/dsh-tool-terminal` 声明的是
 * **精确版本 peer**。若 profile 里装的版本与运行时对不上，宿主只会把那一行禁用 + 启动日志一句
 * warning，模型工具表里少 6 个 terminal_* 工具，界面上完全看不出来。所以安装时按运行时版本钉住它，
 * 并在 status/doctor 里核对（判据与宿主半自检那张卡一致：拿 peer 要求比 profile 里实际装的版本）。
 */
function toolTerminalState(profileDir, runtimeVersion) {
  const read = name => {
    try {
      return JSON.parse(readFileSync(join(profileDir, 'node_modules', ...name.split('/'), 'package.json'), 'utf8'))
    } catch {
      return undefined
    }
  }
  const tool = read('@deepseek-ai/dsh-tool-terminal')
  const peers = tool?.peerDependencies ?? {}
  const peerName = Object.keys(peers).find(key => key.startsWith('@deepseek-ai/dsh-')) ?? ''
  const required = peerName === '' ? '' : String(peers[peerName])
  /**
   * ⚠️ 只用 **profile 自己**能证明的东西判"不匹配"。
   *
   * 为什么不直接和运行时版本比：一个 profile 属于哪个安装（桌面应用 / 源码检出 / 另一个版本）
   * 从 profile 目录本身看不出来 —— 2026-10-15 试过，拿检出的 alpha.4 去比桌面 profile 立刻是假阳性
   * （桌面 profile 的 tool-terminal 是 0.2.0-rc.2，跟它自己的运行时才是对的）。
   * 所以：profile 里能读到 peer 实际版本时才算"证实的越界"；否则只输出提示（见调用方）。
   */
  const installed = required === '' ? '' : String(read(peerName)?.version ?? '')
  void runtimeVersion
  return {
    toolVersion: String(tool?.version ?? ''),
    peerRequired: required,
    peerInstalled: installed,
    mismatch: required !== '' && installed !== '' && required !== installed,
  }
}

/** 问官方 CLI 要运行时版本（用于把 tool-terminal 钉到同一版）。 */
function dshRuntimeVersion(cli) {
  const isNodeScript = cli.endsWith('.js')
  const command = isNodeScript ? process.execPath : cli
  const argv = isNodeScript ? [cli, '--version'] : ['--version']
  try {
    const needsShell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(command)
    const out = spawnSync(command, argv, {
      encoding: 'utf8',
      windowsHide: true,
      ...(needsShell ? { shell: true } : {}),
    })
    const match = /\d+\.\d+\.\d+[-\w.]*/.exec(String(out.stdout ?? '').trim())
    return match === null ? '' : match[0]
  } catch {
    return ''
  }
}

function cmdDoctor(args) {
  let bad = 0
  const report = (ok, label, detail) => {
    console.log(`${ok === true ? '✓' : ok === 'warn' ? '!' : '✗'} ${label}${detail === undefined ? '' : ` — ${detail}`}`)
    if (ok === false) bad += 1
  }
  report(true, '本机 CLI 版本', own.version)
  const manifestPath = join(SELF, 'dsh-plugin.json')
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
      report(manifest.version === own.version, '市场清单版本与包版本一致',
        `${String(manifest.version)} vs ${own.version}`)
    } catch (error) {
      report(false, '市场清单可解析', String(error))
    }
  } else {
    report('warn', '市场清单', '没有 dsh-plugin.json（不影响运行）')
  }
  report(existsSync(join(SELF, 'lib', 'index.js')), '宿主半产物在', 'lib/index.js')
  report(existsSync(join(SELF, 'lib', 'client.js')), '客户端半产物在', 'lib/client.js')
  report(existsSync(join(SELF, 'cordis.patch.yml')), '组合补丁在', 'cordis.patch.yml')
  const cli = findDshCli(args['dsh-cli'])
  report(cli !== undefined, '找得到官方 CLI', cli === undefined ? '用 --dsh-cli 指定' : cli.how)
  const profiles = listProfiles()
  report(profiles.length > 0 ? true : 'warn', '装到哪个 profile',
    profiles.length === 0 ? '没有任何 profile 装了它' : profiles.map(row => `${row.name}@${row.installed === '' ? '?' : row.installed}`).join('、'))
  report('warn', '更完整的运行时自检', '在 DSH 的「设置 → 输入体验 → 自检」里点「运行自检」（需要宿主进程）')
  console.log(bad === 0 ? '\n结论：本机安装看起来是好的。' : `\n结论：有 ${String(bad)} 项需要处理。`)
  return bad === 0 ? 0 : 1
}

function cmdInstall(args) {
  const profile = typeof args.profile === 'string' ? args.profile : ''
  if (profile === '') {
    console.error('必须显式指定 profile：--profile desktop（或 web / 其它已初始化的 profile）')
    console.error('桌面端要用桌面应用自带的 CLI；本机若探测不到，用 --dsh-cli <path> 指定。')
    return 2
  }
  const cli = findDshCli(args['dsh-cli'])
  if (cli === undefined) {
    console.error('找不到官方 DSH CLI。用 --dsh-cli "<安装目录>/resources/runtime/cli/bin/dsh.cmd" 指定。')
    return 2
  }
  if (profile === 'desktop') {
    console.log('提示：`desktop` 是保留 profile，普通 CLI 管不了它；这里用的是探测到的官方 CLI（桌面自带那个）。')
  }
  const spec = typeof args.version === 'string' ? `${PACKAGE}@${args.version}` : `${PACKAGE}@${own.version}`
  const first = runOfficial(cli.cli, ['plugin', '--profile', profile, 'add', spec])
  if (first !== 0) return first

  /**
   * 顺手把持久终端那件「必须与运行时同版」的包按运行时版本钉进 profile。
   *
   * 为什么不用插件自己的依赖范围拉（2026-10-15 真机踩到）：范围会被 pnpm 解析成"当前发布的最新
   * alpha"，一旦比运行时新（或本地元数据缓存旧而选了旧版），宿主就判定不兼容并把那一行禁掉 ——
   * 模型少 6 个工具，界面无感。profile 层显式钉版本才是确定的（桌面 profile 一直是这么做的）。
   */
  const runtime = typeof args['dsh-version'] === 'string' ? args['dsh-version'] : dshRuntimeVersion(cli.cli)
  if (runtime === '') {
    console.log('提示：读不到运行时版本，跳过持久终端的版本对齐（可用 --dsh-version <版本> 指定）。')
    return 0
  }
  const pinned = runOfficial(cli.cli, [
    'plugin', '--profile', profile, 'add', `@deepseek-ai/dsh-tool-terminal@${runtime}`,
  ])
  if (pinned !== 0) {
    console.log(`提示：@deepseek-ai/dsh-tool-terminal@${runtime} 没装上；模型那 6 个 terminal_* 工具会缺（设置页「自检」会显示）。`)
  }
  return 0
}

function cmdUninstall(args) {
  const profile = typeof args.profile === 'string' ? args.profile : ''
  if (profile === '') {
    console.error('必须显式指定 profile：--profile desktop')
    return 2
  }
  const cli = findDshCli(args['dsh-cli'])
  if (cli === undefined) {
    console.error('找不到官方 DSH CLI。用 --dsh-cli <path> 指定。')
    return 2
  }
  return runOfficial(cli.cli, ['plugin', '--profile', profile, 'remove', PACKAGE])
}

function usage() {
  console.log(`dsh-composer-ux ${own.version}

  status    [--profile <name>] [--dsh-cli <path>]   看装在哪、装的什么版本
  doctor    [--profile <name>] [--dsh-cli <path>]   本机自检（产物、清单、官方 CLI、profile）
  install   --profile <name>  [--dsh-cli <path>] [--version <v>]
  uninstall --profile <name>  [--dsh-cli <path>]
  help

安装与卸载一律**委托官方 DSH CLI**（不自己动 profile）；运行时自检在
DSH 的「设置 → 输入体验 → 自检」里那张卡（它需要跑在宿主进程里读服务）。`)
}

const argv = process.argv.slice(2)
const args = parseArgs(argv)
const command = args._[0] ?? 'help'
let code = 0
if (command === 'status') code = cmdStatus(args)
else if (command === 'doctor') code = cmdDoctor(args)
else if (command === 'install') code = cmdInstall(args)
else if (command === 'uninstall') code = cmdUninstall(args)
else if (command === 'help' || command === '--help' || command === '-h') usage()
else {
  console.error(`不认识的子命令：${command}`)
  usage()
  code = 2
}
process.exit(code)
