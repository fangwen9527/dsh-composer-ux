/**
 * 「自检」与 CLI 的测试（0.22.0）。
 *
 * 三块：
 *  1. 自检报告是**纯函数**：字段缺失必须红、只写用户配置必须红、行必须都带 id/label/detail；
 *  2. 市场清单 `dsh-plugin.json` 与 package.json 不能漂（版本、图标、权限披露）；
 *  3. CLI 真的能跑：help / status / doctor 在**临时 DSH_HOME** 上给出可读结论与正确退出码
 *     （不碰真实 profile：DSH_HOME 指到 mkdtemp 出来的目录）。
 *
 *   node test/doctor.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
    contents: "export { buildDoctorReport, enabledSections, missingSchemaFields } from './src/doctor.ts'\n"
      + "export { detectRuntimeVersion, versionOfManifest } from './src/runtime-version.ts'\n",
    resolveDir: process.cwd(), loader: 'ts',
  },
})
const pure = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)

/** 一份"一切正常"的输入；各用例按需改一处。 */
const healthy = () => ({
  version: '0.22.0',
  enabled: true,
  sections: { 键位: true, 微信通知: false },
  fieldConstants: ['enabled', 'notifyEnabled'],
  schemaKeys: ['enabled', 'notifyEnabled'],
  terminal: { platform: 'win32', rowInstalled: true, bashPath: 'C:/Program Files/Git/bin/bash.exe', status: '', mode: 'workspace-write', hasSandbox: true },
  // 0.22.0 适配 alpha.4：持久终端三件套的版本核对（不匹配 ⇒ 宿主会静默禁用那一行）。
  persistentTerminals: { servicePresent: true, toolVersion: '0.2.1-alpha.4', peerRequired: '0.2.1-alpha.4', peerInstalled: '0.2.1-alpha.4', mismatch: false },
  header: { overlayInstalled: true, hasLoader: true, migrated: true, status: '运行期注入 opencode-go（只在本插件运行时生效，不改你的配置）', writesUserConfig: false },
  quick: { file: 'C:/x/quick-prompts.json', readable: true, custom: true, error: '' },
  notify: { enabled: true, channel: 'pushplus', credentialSet: true },
  optimize: { tier: 'standard', readTools: true, bashOn: true, bashGate: '按会话权限判定' },
  runtime: { node: 'v24.16.0', dshVersion: '' },
})

console.log('1. 纯函数：字段与 schema 的对照')
{
  const missing = pure.missingSchemaFields({ fieldConstants: ['a', 'b', 'c'], schemaKeys: ['a', 'c'] })
  check('漏掉的字段点名列出', missing.length === 1 && missing[0] === 'b', JSON.stringify(missing))
  check('都在时返回空', pure.missingSchemaFields({ fieldConstants: ['a'], schemaKeys: ['a'] }).length === 0)
  check('开着的栏目按字母序列出',
    JSON.stringify(pure.enabledSections({ b: true, a: true, c: false })) === JSON.stringify(['a', 'b']))
}

console.log('2. 报告行：级别与必填字段')
{
  const rows = pure.buildDoctorReport(healthy())
  check('每行都有 id / label / detail',
    rows.every(row => typeof row.id === 'string' && row.id !== '' && typeof row.label === 'string' && row.label !== '' && typeof row.detail === 'string'))
  check('健康输入里没有 fail/warn', rows.every(row => row.level === 'ok' || row.level === 'info'),
    JSON.stringify(rows.filter(row => row.level === 'fail' || row.level === 'warn').map(row => row.id)))
  check('表里覆盖了关键几项', ['settings.schema', 'terminal', 'terminals.persistent', 'header', 'quick', 'notify', 'optimize', 'runtime'].every(id => rows.some(row => row.id === id)),
    JSON.stringify(rows.map(row => row.id)))
}

console.log('3. 报告行：坏消息必须红/黄')
{
  const schemaGap = pure.buildDoctorReport({ ...healthy(), fieldConstants: ['enabled', 'ghostField'] })
  const gapRow = schemaGap.find(row => row.id === 'settings.schema')
  check('❗有字段没进 schema ⇒ fail（这就是"开关拨不动"的根因）',
    gapRow.level === 'fail' && gapRow.detail.includes('ghostField'), JSON.stringify(gapRow))

  const wrote = pure.buildDoctorReport({ ...healthy(), header: { ...healthy().header, writesUserConfig: true } })
  check('❗检测到仍写用户配置 ⇒ fail',
    wrote.find(row => row.id === 'header').level === 'fail')

  const noOverlay = pure.buildDoctorReport({
    ...healthy(),
    header: { ...healthy().header, overlayInstalled: false, status: '没找到 loader 服务，运行期覆盖挂不上，未注入' },
  })
  check('覆盖没挂上但功能开着 ⇒ warn',
    noOverlay.find(row => row.id === 'header').level === 'warn')

  const noTerminal = pure.buildDoctorReport({ ...healthy(), terminal: { ...healthy().terminal, rowInstalled: false } })
  check('终端行没装 ⇒ warn', noTerminal.find(row => row.id === 'terminal').level === 'warn')

  // 0.22.0 适配 alpha.4 的真机教训：tool-terminal 版本与运行时对不上时，宿主只是**静默禁用那一行**
  // （启动日志一句 warning），模型少 6 个 terminal_* 工具而界面无感 ⇒ 自检必须主动报出来。
  const termMismatch = pure.buildDoctorReport({
    ...healthy(),
    persistentTerminals: { servicePresent: true, toolVersion: '0.2.1-alpha.3', peerRequired: '0.2.1-alpha.3', peerInstalled: '0.2.1-alpha.4', mismatch: true },
  })
  const termRow = termMismatch.find(row => row.id === 'terminals.persistent')
  check('❗持久终端版本对不上 ⇒ warn 且给出修法',
    termRow.level === 'warn' && termRow.detail.includes('dsh-tool-terminal@'), JSON.stringify(termRow))

  const termMissing = pure.buildDoctorReport({
    ...healthy(),
    persistentTerminals: { servicePresent: false, toolVersion: '', peerRequired: '', peerInstalled: '', mismatch: false },
  })
  check('三件套没挂 ⇒ info（不是错误：这是可选能力）',
    termMissing.find(row => row.id === 'terminals.persistent').level === 'info')

  const termOk = pure.buildDoctorReport(healthy())
  check('对得上 ⇒ ok 并说清版本',
    termOk.find(row => row.id === 'terminals.persistent').level === 'ok'
    && termOk.find(row => row.id === 'terminals.persistent').detail.includes('0.2.1-alpha.4'))

  const noBash = pure.buildDoctorReport({ ...healthy(), terminal: { ...healthy().terminal, bashPath: '' } })
  check('没探测到 bash 路径 ⇒ warn', noBash.find(row => row.id === 'terminal').level === 'warn')

  const unreadable = pure.buildDoctorReport({ ...healthy(), quick: { ...healthy().quick, readable: false, error: 'corrupt' } })
  check('快捷指令本读不到 ⇒ fail', unreadable.find(row => row.id === 'quick').level === 'fail')

  const noCred = pure.buildDoctorReport({ ...healthy(), notify: { enabled: true, channel: 'pushplus', credentialSet: false } })
  check('通知开着但没凭据 ⇒ fail（开关开着却发不出去）',
    noCred.find(row => row.id === 'notify').level === 'fail')

  const notifyOff = pure.buildDoctorReport({ ...healthy(), notify: { enabled: false, channel: '', credentialSet: false } })
  check('通知没开 ⇒ 只是 info（不是问题）', notifyOff.find(row => row.id === 'notify').level === 'info')

  const otherOs = pure.buildDoctorReport({ ...healthy(), terminal: { ...healthy().terminal, platform: 'linux' } })
  check('非 Windows ⇒ 只是 info（不接管终端是设计）', otherOs.find(row => row.id === 'terminal').level === 'info')
}

console.log('4. 市场清单与包元数据不能漂')
{
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  const manifest = JSON.parse(readFileSync('dsh-plugin.json', 'utf8'))
  check('版本一致', manifest.version === pkg.version, `${String(manifest.version)} vs ${String(pkg.version)}`)
  check('名字一致', manifest.name === pkg.name)
  check('图标文件真的在（宿主 package-manifest 读的就是 package.json 的 icon）',
    pkg.icon === './icon.png' && existsSync('icon.png') && statSync('icon.png').size > 0)
  check('宿主入口与产物一致', manifest.facets.host.entry === 'lib/index.js' && existsSync('lib/index.js'))
  check('客户端入口与产物一致', manifest.facets.client.entry === 'lib/client.js' && existsSync('lib/client.js'))
  check('图标也写进了 files（否则发不出去）', (pkg.files ?? []).includes('icon.png'))
  check('清单也写进了 files', (pkg.files ?? []).includes('dsh-plugin.json'))
  check('清单声明了权限，而且是带理由的', Array.isArray(manifest.permissions) && manifest.permissions.length > 0
    && manifest.permissions.every(row => typeof row.reason === 'string' && row.reason.length > 10),
    JSON.stringify(manifest.permissions ?? null))
  check('bin 指向存在的文件', typeof pkg.bin?.['dsh-composer-ux'] === 'string' && existsSync(pkg.bin['dsh-composer-ux']))
}

console.log('5. CLI 冒烟：help / status / doctor（临时 DSH_HOME，不碰真实 profile）')
{
  const home = mkdtempSync(join(tmpdir(), 'cux-cli-home-'))
  // 造一个"装了本插件"的假 profile：声明 + node_modules 里放一份带版本的 package.json。
  const profileDir = join(home, 'profiles', 'fakeapp')
  mkdirSync(join(profileDir, 'node_modules', 'dsh-composer-ux'), { recursive: true })
  writeFileSync(join(profileDir, 'package.json'), JSON.stringify({
    name: 'fakeapp',
    dependencies: { 'dsh-composer-ux': '0.22.0' },
  }))
  writeFileSync(join(profileDir, 'node_modules', 'dsh-composer-ux', 'package.json'), JSON.stringify({ name: 'dsh-composer-ux', version: '0.22.0' }))
  const env = { ...process.env, DSH_HOME: home }

  const run = (args) => {
    try {
      const out = execFileSync(process.execPath, ['bin/dsh-composer-ux.mjs', ...args], { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] })
      return { code: 0, out }
    } catch (error) {
      return { code: error.status ?? 1, out: `${String(error.stdout ?? '')}${String(error.stderr ?? '')}` }
    }
  }

  const help = run(['help'])
  check('help 退出码 0 且列出四个子命令',
    help.code === 0 && ['status', 'doctor', 'install', 'uninstall'].every(word => help.out.includes(word)),
    help.out.slice(0, 120))

  const status = run(['status'])
  check('status 退出码 0', status.code === 0, status.out.slice(0, 120))
  check('status 认出了那个 profile 与版本',
    status.out.includes('fakeapp') && status.out.includes('0.22.0'), status.out.slice(0, 200))
  check('status 用临时 DSH_HOME（没去读真实 profile）', status.out.includes(home), status.out.slice(0, 200))

  const doctor = run(['doctor'])
  check('doctor 退出码 0（本机产物与清单都在）', doctor.code === 0, doctor.out.slice(0, 300))
  check('doctor 逐项打了结论（版本 / 产物 / 清单 / profile）',
    doctor.out.includes('本机 CLI 版本') && doctor.out.includes('宿主半产物在')
    && doctor.out.includes('市场清单版本与包版本一致') && doctor.out.includes('装到哪个 profile'),
    doctor.out.slice(0, 300))

  const bad = run(['install'])
  check('install 不指定 profile ⇒ 退出码 2 并给出用法', bad.code === 2 && bad.out.includes('--profile'), bad.out.slice(0, 120))

  const unknown = run(['nope'])
  check('不认识的子命令 ⇒ 退出码 2', unknown.code === 2, String(unknown.code))
}

console.log(`\n${passes} passed, ${failures} failed`)
console.log('\n运行时版本探测（0.26.1：自检卡那一行不该永远写「拿不到」）')
{
  const manifest = version => JSON.stringify({ name: '@deepseek-ai/dsh-app-boot', version })
  const mapRead = files => (path) => {
    if (!Object.hasOwn(files, path)) throw new Error('ENOENT: ' + path)
    return files[path]
  }
  const dirName = path => path.replace(/[\\/][^\\/]*$/, '')
  // ① 源码 workspace / 桌面解包：从 app-boot 入口往上找 package.json
  const fromResolve = pure.detectRuntimeVersion({
    resolveAppBoot: () => 'D:/repo/packages/boot/app-boot/lib/index.js',
    readFile: mapRead({ 'D:/repo/packages/boot/app-boot/package.json': manifest('0.2.2-alpha.2') }),
    env: { DSH_HOME: 'D:/home/.dsh' },
    listProfiles: () => [],
    joinPath: (...parts) => parts.join('/'),
    dirName,
    homeDir: 'C:/Users/x',
  })
  check('从 app-boot 入口解析出版本（0.2.2-alpha.2）', fromResolve === '0.2.2-alpha.2', fromResolve)

  // ② 入口解析不到就走 profiles 扫描（profile 里是扁平安装）
  const fromProfiles = pure.detectRuntimeVersion({
    resolveAppBoot: () => undefined,
    readFile: mapRead({ 'D:/home/.dsh/profiles/web/node_modules/@deepseek-ai/dsh-app-boot/package.json': manifest('0.2.1-rc.4') }),
    env: { DSH_HOME: 'D:/home/.dsh' },
    listProfiles: () => ['web', 'desktop'],
    joinPath: (...parts) => parts.join('/'),
    dirName,
    homeDir: 'C:/Users/x',
  })
  check('入口解析不到时扫 profiles（0.2.1-rc.4）', fromProfiles === '0.2.1-rc.4', fromProfiles)

  // ③ 全失败 ⇒ 空串（绝不猜一个版本号：兼容性预检正是拿它比区间）
  const none = pure.detectRuntimeVersion({
    resolveAppBoot: () => undefined,
    readFile: () => { throw new Error('ENOENT') },
    env: {},
    listProfiles: () => { throw new Error('no dir') },
    joinPath: (...parts) => parts.join('/'),
    dirName: path => path,
    homeDir: 'C:/Users/x',
  })
  check('一处都读不到 ⇒ 空串（界面照旧写「拿不到」）', none === '', JSON.stringify(none))
  check('package.json 形状不对 ⇒ 空串（不把垃圾当版本）',
    pure.versionOfManifest('{not json') === '' && pure.versionOfManifest('{"version":123}') === '')
}

process.exit(failures === 0 ? 0 : 1)
