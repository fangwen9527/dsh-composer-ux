/**
 * 「自启动」纯逻辑测试（0.23.0）。
 *
 * 纪律（照着重启那条链的先例，2026-10-15）：
 *   自动化测试**只测纯函数与源码面** —— 绝不真的去写注册表、也绝不真的拉进程。
 *   真机行为（注册一条、核对、删掉）由人工验证覆盖，见 CHANGELOG 的记录。
 *   理由：`npm test` 会被人反复跑（变异测试更要跑两百多轮），它不许改动用户的系统。
 *
 *   node test/autostart.mjs
 */
import { build } from 'esbuild'

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

const bundled = await build({
  bundle: true, write: false, format: 'esm', platform: 'node', target: ['es2022'], logLevel: 'warning',
  stdin: {
    contents: "export { AUTOSTART_ENTRY_PREFIX, RUN_KEY, autostartEntryName, planAutostart, queryArgs, listArgs, addArgs, deleteArgs, parseQueryValue, describeAutostart, unsupportedReason, runtimeOf } from './src/autostart.ts'\n",
    resolveDir: process.cwd(), loader: 'ts',
  },
})
const pure = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)

/** 网页版的启动事实（模拟"这台机器上从源码起的 web profile"）。 */
const webFacts = (overrides = {}) => ({
  platform: 'win32',
  runtime: 'web',
  profile: 'web',
  stateDir: 'C:\\Users\\me\\.dsh\\composer-ux',
  desktopExe: '',
  launch: {
    file: 'D:\\node\\node.exe',
    args: ['D:\\DeepSeek Harness\\apps\\cli\\lib\\bin.js', '--profile', 'web'],
    cwd: 'D:\\DeepSeek Harness',
    viaShell: false,
  },
  ...overrides,
})

/** 桌面端的启动事实。 */
const desktopFacts = (overrides = {}) => ({
  platform: 'win32',
  runtime: 'desktop',
  profile: 'desktop',
  stateDir: 'C:\\Users\\me\\.dsh\\composer-ux',
  desktopExe: 'D:\\deepseekharness\\DeepSeek Harness.exe',
  launch: { file: 'x', args: [], cwd: '.', viaShell: false },
  ...overrides,
})

console.log('1. 值名：每个运行时一条，互不覆盖')
{
  check('profile 进值名', pure.autostartEntryName('web') === 'dsh-composer-ux:autostart:web', pure.autostartEntryName('web'))
  check('两个 profile 的值名不同',
    pure.autostartEntryName('web') !== pure.autostartEntryName('desktop'))
  check('空 profile 也有名字（不会生成只有前缀的裸名）',
    pure.autostartEntryName('') === 'dsh-composer-ux:autostart:default', pure.autostartEntryName(''))
  check('启动项位置是当前用户（不需要管理员）',
    pure.RUN_KEY === 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', pure.RUN_KEY)
}

console.log('2. 桌面端：直接指 exe')
{
  const plan = pure.planAutostart(desktopFacts())
  check('值就是那个 exe（带引号）',
    plan.value === '"D:\\deepseekharness\\DeepSeek Harness.exe"', plan.value)
  check('不生成启动器脚本（桌面端自己管窗口/托盘）', plan.launcher === undefined)
  check('说明是给人看的人话', plan.describe.includes('DeepSeek Harness.exe'), plan.describe)
}

console.log('3. 网页版：注册的是"登录时最小化拉起"的启动器（用户选的：最小化到任务栏）')
{
  const plan = pure.planAutostart(webFacts())
  check('注册表值指向 .vbs 启动器', plan.value === 'wscript.exe "C:\\Users\\me\\.dsh\\composer-ux\\autostart-web.vbs"', plan.value)
  check('启动器路径带上 profile（两个运行时不会互相覆盖）',
    plan.launcher?.path.endsWith('autostart-web.vbs') === true, plan.launcher?.path)
  const content = plan.launcher?.content ?? ''
  /** VBScript 把 shell.Run "…" 里的双引号翻倍写成 ""；比之前还原回来。 */
  const plain = content.replace(/""/gu, '"')
  check('启动器无控制台冒出来：用 wscript + WScript.Shell',
    content.includes('CreateObject("WScript.Shell")'))
  check('❗最小化且不抢焦点（Run 的第二个参数必须是 7、第三个 false）',
    content.includes('shell.Run "', 0) && content.includes('", 7, False'), content.split('\r\n').slice(-2).join(' | '))
  check('工作目录是启动时的 cwd（相对入口靠它才解析得到）',
    content.includes('shell.CurrentDirectory = "D:\\DeepSeek Harness"'))
  check('命令行是逐字重放（node + 入口 + 参数都在）',
    plain.includes('"D:\\node\\node.exe" "D:\\DeepSeek Harness\\apps\\cli\\lib\\bin.js" "--profile" "web"'),
    content.slice(-200))
  check('说明里也说清了最小化与具体命令',
    plan.describe.includes('最小化') && plan.describe.includes('--profile'), plan.describe)
}

console.log('4. 网页版：引号与 shell 边界')
{
  const spaced = pure.planAutostart(webFacts({
    launch: { file: 'C:\\Program Files\\nodejs\\node.exe', args: ['C:\\My App\\bin.js', '--profile', 'my app'], cwd: 'C:\\My App', viaShell: false },
  }))
  check('带空格的路径都被引号包住',
    ((spaced.launcher?.content ?? '').replace(/""/gu, '"')).includes('"C:\\Program Files\\nodejs\\node.exe" "C:\\My App\\bin.js" "--profile" "my app"'),
    spaced.launcher?.content.split('\r\n').slice(-2).join(' | '))
  const shell = pure.planAutostart(webFacts({
    launch: { file: 'dsh.cmd', args: ['--profile', 'web'], cwd: 'C:\\x', viaShell: true },
  }))
  check('.cmd shim 过一层 shell（node 跑不了 .cmd）',
    ((shell.launcher?.content ?? '').replace(/""/gu, '"')).includes('cmd.exe /c "dsh.cmd" "--profile" "web"'),
    shell.launcher?.content.split('\r\n').slice(-2).join(' | '))
}

console.log('5. reg.exe 的三个动作')
{
  const q = pure.queryArgs('entry')
  check('query 指向 HKCU 的 Run 且带值名',
    q[0] === 'query' && q[1] === pure.RUN_KEY && q.includes('entry'), JSON.stringify(q))
  const a = pure.addArgs('entry', 'some value')
  check('add 用 REG_SZ 且 /f 覆盖（重复打开开关不会失败）',
    a[0] === 'add' && a.includes('REG_SZ') && a.includes('/f') && a.includes('some value'), JSON.stringify(a))
  const d = pure.deleteArgs('entry')
  check('delete 带 /f（值不存在时也不弹确认）', d[0] === 'delete' && d.includes('/f'), JSON.stringify(d))
}

console.log('6. 读 reg query 的输出')
{
  const out = [
    '',
    'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
    '    dsh-composer-ux:autostart:web    REG_SZ    wscript.exe "C:\\a b\\autostart-web.vbs"',
    '',
  ].join('\r\n')
  check('值里有空格也能完整取出来',
    pure.parseQueryValue('dsh-composer-ux:autostart:web', out) === 'wscript.exe "C:\\a b\\autostart-web.vbs"',
    pure.parseQueryValue('dsh-composer-ux:autostart:web', out))
  check('要的是别人那条 ⇒ 读不到（不会串台）',
    pure.parseQueryValue('dsh-composer-ux:autostart:desktop', out) === undefined)
  check('空输出 ⇒ undefined', pure.parseQueryValue('entry', '') === undefined)
}

console.log('7. 设置页看到的状态：以注册表为准')
{
  const plan = pure.planAutostart(webFacts())
  const on = pure.describeAutostart({ platform: 'win32', plan, registered: plan.value, readError: '' })
  check('注册表里有且一致 ⇒ 开着，且没有提示', on.enabled === true && on.note === '', JSON.stringify(on))
  check('支持标记正确', on.supported === true)
  check('把"登录后会执行什么"给出来', on.describe.includes('登录后'), on.describe)

  const off = pure.describeAutostart({ platform: 'win32', plan, registered: undefined, readError: '' })
  check('注册表里没有 ⇒ 关着', off.enabled === false && off.note === '')

  const stale = pure.describeAutostart({ platform: 'win32', plan, registered: 'wscript.exe "D:\\old\\autostart-compat021.vbs"', readError: '' })
  check('❗条目在、但值对不上（别的 profile/旧版本留下的）⇒ 显示开 + 提示不一致',
    stale.enabled === true && stale.note.includes('不一致'), JSON.stringify(stale.note))

  const broken = pure.describeAutostart({ platform: 'win32', plan, registered: undefined, readError: '没有权限读写当前用户的启动项' })
  check('读失败 ⇒ 如实说读不到（不假装关着）',
    broken.note.includes('读不到') && broken.note.includes('权限'), broken.note)

  const other = pure.describeAutostart({ platform: 'linux', plan, registered: undefined, readError: '' })
  check('非 Windows ⇒ 标记不支持并说明', other.supported === false && other.note.includes('Windows'), other.note)
}

console.log('8. 平台闸门与运行时判定')
{
  check('Windows 上不拦（返回空串）', pure.unsupportedReason('win32') === '')
  check('❗非 Windows 一律拒绝（绝不真去写注册表）',
    pure.unsupportedReason('linux') !== '' && pure.unsupportedReason('darwin') !== ''
    && pure.unsupportedReason('linux').includes('Windows'), pure.unsupportedReason('linux'))

  // 2026-10-15 真机踩到：靠 ELECTRON_RUN_AS_NODE 判运行时，结果在带该变量的 shell 里
  // 把网页版认成桌面端，注册出一条指向 bash.exe 的启动项。判据只能是入口路径。
  check('桌面端入口 ⇒ desktop',
    pure.runtimeOf('C:\\app\\node_modules\\@deepseek-ai\\dsh-desktop-host\\lib\\index.js') === 'desktop')
  check('命令行入口 ⇒ web',
    pure.runtimeOf('D:\\DeepSeek Harness\\apps\\cli\\lib\\bin.js') === 'web')
  check('拿不到入口 ⇒ 保守当 web（桌面端一定有那个入口）', pure.runtimeOf(undefined) === 'web')

  check('读注册表用整键查询（不靠本地化报错判断值存不存在）',
    JSON.stringify(pure.listArgs()) === JSON.stringify(['query', pure.RUN_KEY]), JSON.stringify(pure.listArgs()))
}
{
  check('Windows 上不拦（返回空串）', pure.unsupportedReason('win32') === '')
  check('❗非 Windows 一律拒绝（绝不真去写注册表）',
    pure.unsupportedReason('linux') !== '' && pure.unsupportedReason('darwin') !== ''
    && pure.unsupportedReason('linux').includes('Windows'), pure.unsupportedReason('linux'))
}
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
