/**
 * 真的把「桌面形态的助手」跑一遍（0.16.0 起）。
 *
 * 为什么值得单独一个套件：`restartHelperSource()` 产出的是**字符串源码**，所以很容易写成
 * "查文本"的断言 —— 这一版之前已经栽过三次（FN / FO / D：注释掉一行、或在别处加一处同类代码，
 * 查文本的断言照样能过）。这里改成**注入假实现真的执行它**，只认副作用：
 *   · 只杀壳（/F /PID），**绝不 /T**（/T 会把负责重启的助手自己一起带走）
 *   · 绝不按映像名扫（/IM 会误杀自己）
 *   · 重建前**真的**把 ELECTRON_RUN_AS_NODE 从子进程环境里删掉
 *   · 旧宿主一直没死时反复探测，但超时也要继续重建
 *   · web 形态一个进程都不杀（只重拉）
 */
import { build } from 'esbuild'

const bundled = await build({
  bundle: true, write: false, format: 'esm', platform: 'node', target: ['es2022'], logLevel: 'warning',
  stdin: {
    contents: "export { restartHelperSource } from './src/restart.ts'\n",
    resolveDir: process.cwd(), loader: 'ts',
  },
})
const pure = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)
const { restartHelperSource } = pure

let passes = 0
let failures = 0
function check(label, ok, detail = '') {
  if (ok) { passes += 1; console.log(`  ✓ ${label}`) } else { failures += 1; console.log(`  ✗ ${label}${detail === '' ? '' : ` — ${detail}`}`) }
}

const EMPTY_TASKLIST = 'INFO: No tasks are running which match the specified criteria.\r\n'

/**
 * 跑一次助手源码（注入假的 child_process / fs / net）。
 * @param source `restartHelperSource()` 的产物。
 * @param tasklistOutput `tasklist` 的输出（默认"没找到那个 pid" = 旧宿主已退）。
 * @returns 记录下来的每一次 spawn。
 */
async function runHelper(source, tasklistOutputs = [EMPTY_TASKLIST]) {
  const calls = []
  const notes = []
  let probes = 0
  const fakeRequire = (name) => {
    if (name === 'node:child_process') {
      return {
        spawn: (file, args, options) => {
          calls.push({ file, args, options })
          const output = file === 'tasklist'
            ? (tasklistOutputs[Math.min(probes, tasklistOutputs.length - 1)] ?? EMPTY_TASKLIST)
            : ''
          if (file === 'tasklist') probes += 1
          return {
            stdout: { on: (event, listener) => { if (event === 'data') listener(output) } },
            // `close` 与 `error` 都可能被监听；两者都排到下一个 tick，避免同步回调时监听器还没挂上。
            on: (event, listener) => { if (event === 'close') setTimeout(() => { listener(0) }, 0) },
            unref: () => {},
          }
        },
      }
    }
    if (name === 'node:fs') {
      return {
        openSync: () => 1,
        appendFileSync: (path, line) => { notes.push(String(line)) },
        existsSync: (path) => !String(path).includes('missing'),
      }
    }
    if (name === 'node:net') {
      // 端口探针：下一个 tick 就报"连不上"（= 端口空了、可以起替换进程了）。
      return { connect: () => ({ on: (event, listener) => { if (event === 'error') setTimeout(() => { listener(new Error('ECONNREFUSED')) }, 0) }, destroy: () => {} }) }
    }
    throw new Error(`助手不该 require 这个：${name}`)
  }
  const fakeProcess = { env: { ELECTRON_RUN_AS_NODE: '1', PATH: 'x' }, pid: 222 }
  // 助手源码最后一行会自己调 main() / desktopMain()；等它把 async 链走完。
  // eslint-disable-next-line no-new-func
  new Function('require', 'process', 'setTimeout', 'Date', source)(fakeRequire, fakeProcess, setTimeout, Date)
  await new Promise(resolve => { setTimeout(resolve, 1200) })
  return { calls, notes }
}

const desktopSource = restartHelperSource({
  spawned: { file: 'C:\\node\\node.exe', args: ['x.js'], viaShell: false, detached: true },
  cwd: 'D:\\work',
  logs: { out: 'o.log', err: 'e.log' },
  port: 19387,
  desktop: { shellPid: 111, hostPid: 222, appExe: 'C:\\app\\DeepSeek Harness.exe' },
})

{
  const { calls } = await runHelper(desktopSource)
  const killer = calls.find(call => call.file === 'taskkill')
  check('桌面形态真的会去杀壳，且只给 /PID', killer !== undefined
    && killer.args.join('|') === '/F|/PID|111', JSON.stringify(killer === undefined ? null : killer.args))
  check('❗绝不带 /T（递归杀会把负责重启的助手自己一起带走）',
    calls.every(call => !call.args.includes('/T')))
  check('❗绝不按映像名扫（/IM 会误杀自己）',
    calls.every(call => !call.args.includes('/IM')))
  check('杀之前先探一次旧宿主还在不在（tasklist + PID 过滤器）',
    calls.some(call => call.file === 'tasklist' && call.args.includes('PID eq 222')))
  const relaunch = calls.find(call => call.file === 'C:\\app\\DeepSeek Harness.exe')
  check('旧宿主没了之后用应用 exe 重建（不带参数、detached）',
    relaunch !== undefined && relaunch.args.length === 0 && relaunch.options.detached === true,
    JSON.stringify(relaunch === undefined ? null : relaunch.args))
  check('❗重建时子进程环境里**真的**没有 ELECTRON_RUN_AS_NODE（否则拉起的是又一个 node）',
    relaunch !== undefined && relaunch.options.env.ELECTRON_RUN_AS_NODE === undefined
    && relaunch.options.env.PATH === 'x')
  check('壳 pid 与宿主 pid 各自用对（杀 111、探 222）',
    killer !== undefined && killer.args[2] === '111'
    && calls.some(call => call.file === 'tasklist' && call.args.includes('PID eq 222')))
}

{
  // 旧宿主先"还活着"两次、然后"没了" ⇒ 既验证反复探测，也验证最终仍然重建。
  const aliveCsv = '"node.exe","222","Console","1","1,234 K"\r\n'
  const { calls } = await runHelper(desktopSource, [aliveCsv, aliveCsv, EMPTY_TASKLIST])
  const probes = calls.filter(call => call.file === 'tasklist')
  check('旧宿主还活着时反复探测（不是探一次就放弃）', probes.length >= 2, String(probes.length))
  check('探测不到退出也照样重建（超时继续）',
    calls.some(call => call.file === 'C:\\app\\DeepSeek Harness.exe'))
}

{
  const webSource = restartHelperSource({
    spawned: { file: 'dsh', args: ['web'], viaShell: true, detached: true },
    cwd: 'D:\\work',
    logs: { out: 'o.log', err: 'e.log' },
    port: 3080,
    desktop: null,
  })
  const { calls } = await runHelper(webSource)
  check('web 形态一个进程都不杀（没有 taskkill）', calls.every(call => call.file !== 'taskkill'))
  check('web 形态照旧重拉同一条命令',
    calls.some(call => call.file === 'dsh' && call.args.join('|') === 'web'))
}

{
  // ❗起飞前检查：exe 不在 ⇒ 绝不杀壳，退回「只换宿主」（否则杀完没人回来）。
  const missingExe = restartHelperSource({
    spawned: { file: 'C:\\node\\node.exe', args: ['host.js'], viaShell: false, detached: true },
    cwd: 'D:\\work',
    logs: { out: 'o.log', err: 'e.log' },
    port: 19387,
    desktop: { shellPid: 111, hostPid: 222, appExe: 'C:\\nope\\missing.exe' },
  })
  const { calls, notes } = await runHelper(missingExe)
  check('❗应用 exe 不在 ⇒ **绝不杀壳**（杀完没人能把它拉回来）',
    calls.every(call => call.file !== 'taskkill'))
  check('❗exe 不在时退回「只换宿主」：照旧把宿主命令拉起来',
    calls.some(call => call.file === 'C:\\node\\node.exe'))
  check('退回时留下证据（日志里写明为什么没杀壳）',
    notes.some(line => line.includes('app executable missing')))
}

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
