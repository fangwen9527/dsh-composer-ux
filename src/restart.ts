/**
 * 「重启 DSH」的宿主半：**把自己重新拉起来**。
 *
 * 机制照搬插件市场（GitHub `dsh-market/dsh-market` 的 `src/restart.ts` 与 `src/dsh-cli.ts`，
 * 本机 profile 里有它的源码）。为什么抄它而不是自己发明：它是在真实用户里被打磨出来的 ——
 * 文件顶部的注释里挂着一条条 issue 号，每一条都是"重启按钮按下去没用"的具体死法。
 *
 * 它做的事（也是这里做的事）：
 *  1. 分离一个 **node 助手进程**（`node -e <源码>`，detached + unref + stdio ignore）——
 *     宿主自己马上就要退出，所以"等端口、起新进程、验证"必须由一个活得比它久的进程来做；
 *  2. 助手**等端口真的空出来**（每 250ms connect 探一次，最多 30 秒），而不是睡固定时长：
 *     旧进程退出 ≠ 端口立刻释放（Windows 上还有 TIME_WAIT），固定睡 1500ms 曾让新宿主
 *     `EADDRINUSE` 当场死掉、而失败还被 `catch {}` 吞了（issue #177）；
 *  3. 助手用 **隐藏控制台的 PowerShell** 起新宿主（Windows 上 `detached` = `DETACHED_PROCESS`
 *     = 没有控制台，新宿主之后起的每个控制台子进程都会弹一个黑窗口，issue #40；而
 *     `-WindowStyle Hidden` 又管不到 spawn 交给 PowerShell 的那个控制台，所以助手这一层
 *     还得自己带 `windowsHide`，issue #624）；
 *  4. 助手起完进程再等最多 20 秒确认端口有人监听，没起来就把诊断**写进日志文件** ——
 *     本来该记日志的那个进程（宿主）已经退出了，重启失败必须留证据；
 *  5. 宿主自己退出，**延迟 500ms**，好让 HTTP 响应先发出去（市场用
 *     `process.kill(pid,'SIGTERM')`；本插件改用 `process.emit('SIGTERM')`，理由见
 *     {@link gracefulStop}）。
 *
 * 与市场的两处刻意分歧（都在下面注释里写明理由）：退出方式，以及没有"写一个脚本到磁盘"。
 * 全部外部动作（spawn / 定时 / 退出 / 取路径 / 判存在）都注入，便于单测。
 */

/** 助手探测端口是否被占用的间隔。 */
export const RESTART_POLL_MS = 250
/** 助手等旧进程释放端口的上限。 */
export const RESTART_PORT_WAIT_MS = 30_000
/** 端口刚空出来后的额外等待（Windows 的 TIME_WAIT 尾巴）。 */
export const RESTART_PORT_SETTLE_MS = 300
/** 宿主收到重启请求后、真正退出前的延迟（让 HTTP 响应先发出去）。 */
export const RESTART_EXIT_DELAY_MS = 500
/** 助手在新宿主起来后确认端口的上限。 */
export const RESTART_REPLACEMENT_WAIT_MS = 20_000
/** 助手单次 connect 探测的超时。 */
export const RESTART_PROBE_TIMEOUT_MS = 500
/** 端口未知时助手起新进程前睡的时长（市场原值）。 */
export const RESTART_NO_PORT_DELAY_MS = 1_500
/** 端口未知时助手起完进程后多活一会儿，免得把还没 detach 完的替换进程带走。 */
export const RESTART_HELPER_LINGER_MS = 3_000
/**
 * 优雅退出后、强制退出的兜底时长。
 *
 * 比 DSH 自己的上限长：`createProcessShutdown` 内部是 5 秒（`PROCESS_SHUTDOWN_TIMEOUT_MS`），
 * 我们只负责"连那个都没生效"的情况（比如没有注册 SIGTERM handler 的嵌入形态）。
 */
export const RESTART_STOP_FALLBACK_MS = 10_000
/** 助手日志文件名前缀（落在系统临时目录）。 */
export const RESTART_LOG_PREFIX = 'composer-ux-restart-'

/** 一次重启要重放的启动命令。 */
export interface Launch {
  readonly file: string
  readonly args: readonly string[]
  readonly cwd: string
  /** 裸命令（Windows 上 `dsh` 是 .cmd shim）必须过一层 shell 才能起。 */
  readonly viaShell: boolean
}

/** 重建启动命令所需的进程事实。 */
export interface LaunchFacts {
  /** 跑得起来的 node 可执行文件（见 {@link nodeExecutableOf}）。 */
  readonly node: string
  /** `process.argv[1]`：入口脚本。 */
  readonly argv1: string | undefined
  /** `process.execArgv`：启动参数里的 loader/import 之类。 */
  readonly execArgv: readonly string[]
  /** `process.argv.slice(2)`：命令与命令自己的参数（如 `web`）。 */
  readonly rest: readonly string[]
  readonly cwd: string
  readonly platform: string
  readonly resolve: (path: string) => string
  readonly dirname: (path: string) => string
}

/**
 * 该用哪个 node 来 spawn 子进程。
 *
 * Android 上内核通过动态链接器跑 node，`process.execPath` 是 `/apex/.../linker64`，
 * 拿它去 spawn 会让链接器把 flag 当成程序路径。`process.argv0` 才是真正的 node。
 * @param input `process.argv0` / `process.execPath` / 判存在的注入面。
 * @returns 一个绝对路径的 node；两者都不像时退回 execPath。
 */
export function nodeExecutableOf(input: {
  readonly argv0: string | undefined
  readonly execPath: string
  readonly exists: (path: string) => boolean
}): string {
  const { argv0, execPath, exists } = input
  if (argv0 !== undefined && argv0 !== '' && isAbsolutePath(argv0) && exists(argv0)) return argv0
  return execPath
}

/** 绝对路径判定（不引 node:path，保持本模块零 import）。 */
function isAbsolutePath(value: string): boolean {
  return value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value) || value.startsWith('\\\\')
}

/**
 * 重放"当初是怎么把 DSH 起来的"。
 *
 * `argv[1]` 长得像 dsh 入口（`bin.js` / `bin.ts` / `dsh`）时，直接 `node <绝对入口> …`：
 * 必须有绝对路径，因为源码启动（`pnpm dsh`）给的是相对入口，子进程会拿**自己的** cwd 去
 * 解析然后 `MODULE_NOT_FOUND`；cwd 取入口所在目录，`--import tsx/esm` 这类 execArgv 才解析得到。
 * 否则退回裸 `dsh`（Windows 上是 .cmd，只能过 shell）。
 */
export function launchCommand(facts: LaunchFacts): Launch {
  const { argv1, execArgv, rest, cwd, platform, resolve, dirname } = facts
  if (argv1 !== undefined && /[\\/](?:bin\.(?:js|ts)|dsh)$/.test(argv1)) {
    const absolute = resolve(argv1)
    return { file: facts.node, args: [...execArgv, absolute, ...rest], cwd: dirname(absolute), viaShell: false }
  }
  return { file: 'dsh', args: [...rest], cwd, viaShell: platform === 'win32' }
}

/** 助手最终要 spawn 什么。 */
export interface Respawn {
  readonly file: string
  readonly args: readonly string[]
  readonly viaShell: boolean
  readonly detached: boolean
}

/** PowerShell 单引号：内部的单引号写两遍。 */
export function quotePowerShell(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

/**
 * 把启动命令包成"平台正确"的 spawn 参数。
 *
 * POSIX 就是原来的命令 + `detached: true`。
 *
 * Windows 上必须换成 `powershell.exe -NoProfile -WindowStyle Hidden -Command "& '…'"`：
 *  - 隐藏控制台：新宿主如果直接 detached 启动就没有控制台，它之后起的每个控制台子进程
 *    都会**新建一个可见窗口**；PowerShell 这层给它一个隐藏的控制台，子进程继承它；
 *  - 显式点名 `.cmd`：裸 `dsh` 会让 PowerShell 优先选 `dsh.ps1`，默认 Restricted 策略下
 *    直接拒绝执行（issue #397），而 `dsh.cmd` 不受脚本策略管辖。
 *
 * 注意 `detached: false`：真正的隐藏靠助手那一层的 `windowsHide`（CREATE_NO_WINDOW）。
 */
export function respawnCommand(launch: Launch, platform: string): Respawn {
  if (platform !== 'win32') {
    return { file: launch.file, args: launch.args, viaShell: launch.viaShell, detached: true }
  }
  const file = launch.viaShell && !/\.(?:cmd|bat)$/iu.test(launch.file) ? `${launch.file}.cmd` : launch.file
  return {
    file: 'powershell.exe',
    args: [
      '-NoProfile', '-WindowStyle', 'Hidden', '-Command',
      [`& ${quotePowerShell(file)}`, ...launch.args.map(quotePowerShell)].join(' '),
    ],
    viaShell: false,
    detached: false,
  }
}

/**
 * 浏览器实际访问的那个端口，从请求的 `Host` 头里读。
 *
 * 比解析启动参数可靠：绑哪个端口可能来自配置或环境变量，而 `Host` 就是浏览器真正到达的地址，
 * 也就是替换进程必须接管的那一个（而且它已经被信任关卡校验过了）。
 * @returns 端口号；默认端口（头里没写）时返回 null。
 */
export function servingPort(hostHeader: string | undefined): number | null {
  if (hostHeader === undefined) return null
  const match = /:(\d{1,5})$/u.exec(hostHeader)
  if (match === null) return null
  const port = Number(match[1])
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : null
}

/** 回环地址判定（含 IPv4 映射形态）。 */
export function isLoopbackAddress(address: string | undefined): boolean {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

/** 进程控制请求的信任事实。 */
export interface TrustRequest {
  readonly remoteAddress: string | undefined
  readonly headers: Readonly<Record<string, string | readonly string[] | undefined>>
}

/**
 * 这个"杀进程"的请求是不是来自本机的同源页面。
 *
 * 四道同时成立：回环 peer、没有任何转发痕迹（有转发说明中间站着代理而不是用户）、
 * `Origin` 与 `Host` 同源、两者都在。跨站页面发起的 POST 一定带自己的 `Origin`，
 * 所以 DNS rebinding / 跨站调用在这里被挡住 —— 这是官方 `connection.requestRejection`
 * 之外的第二道，而不是替代它。
 */
export function trustedRestartRequest(request: TrustRequest): boolean {
  if (!isLoopbackAddress(request.remoteAddress)) return false
  const headers = request.headers
  if (headers.forwarded !== undefined
    || headers['x-forwarded-for'] !== undefined
    || headers['x-real-ip'] !== undefined) return false
  const origin = firstHeader(headers.origin)
  const host = firstHeader(headers.host)
  if (origin === undefined || host === undefined) return false
  try {
    const parsed = new URL(origin)
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.host === host
  } catch {
    return false
  }
}

/** 头值可能是数组（Node 对重复头的行为），只取第一个。 */
function firstHeader(value: string | readonly string[] | undefined): string | undefined {
  if (value === undefined) return undefined
  return typeof value === 'string' ? value : value[0]
}

const INSPECT_ARG_PREFIXES = ['--inspect', '--inspect-brk', '--inspect-port', '--inspect-wait'] as const

/** 这个 argv 里有没有 inspector 家族的 flag（按前缀匹配，不看子串）。 */
function tokenHasInspectFlag(token: string): boolean {
  for (const prefix of INSPECT_ARG_PREFIXES) {
    if (token === prefix || token.startsWith(`${prefix}=`)) return true
  }
  if (token === '--debug-brk' || token.startsWith('--debug-brk=')) return true
  if (token === '--debug' || token.startsWith('--debug=')) return true
  return false
}

/**
 * 宿主是不是正被调试器附着（能被识别出来时返回 `'inspector'`，否则 null）。
 *
 * 为什么这种时候不给重启：把正在被调试的宿主从界面里杀掉，你不会得到任何东西，
 * 只会丢掉那个调试会话。三个信号：`inspector.url()`（覆盖 `--inspect` 启动、
 * `inspector.open()`、SIGUSR1 附着）、`process.execArgv`、`NODE_OPTIONS`。
 *
 * 按 token 前缀匹配而不是 `/inspect/` 子串：否则路径里带 `inspect-tool.js` 的宿主会被误判。
 */
export function detectedDebugger(input: {
  readonly inspectorUrl: string | undefined
  readonly execArgv: readonly string[]
  readonly nodeOptions: string | undefined
}): 'inspector' | null {
  const { inspectorUrl, execArgv, nodeOptions } = input
  if (inspectorUrl !== undefined && inspectorUrl !== '') return 'inspector'
  if (execArgv.some(tokenHasInspectFlag)) return 'inspector'
  const options = (nodeOptions ?? '').trim()
  if (options !== '' && options.split(/\s+/u).some(tokenHasInspectFlag)) return 'inspector'
  return null
}

/**
 * 宿主是不是被某个进程管理器（systemd）当服务在跑 —— 是的话重启权归它。
 *
 * 为什么这值得一段代码：systemd 默认 `KillMode=control-group`，整个 cgroup 会跟着主进程一起死，
 * 包括那个本该把替换进程拉起来的分离助手。于是"重启"杀掉了一个生产服务，什么都没回来
 * （市场 issue #229）。
 *
 * 为什么要**两个**信号：`INVOCATION_ID` 是**继承**的，Linux 上一个普通桌面终端和 CI runner
 * 都带着它；只看它会把一大片本来能正常重启的宿主误判成"有 supervisor"（比原 bug 更糟）。
 * 父进程才是区分"我就是这个 unit 的主进程"和"我只是它的后代"的地方：父进程是 PID 1
 * 或者 comm 是 `systemd`（两种 manager 实例唯一的共同点）才算。
 *
 * 只认 systemd：pm2 的 `pm_id` 同样会被继承，而 launchd 根本没有标记 —— 那两种请用户
 * 显式配置，猜测只会重新引入这里要避免的误判。
 * @returns 识别到的 supervisor 名（目前只有 `'systemd'`），没有则 null。
 */
export function detectedSupervisor(input: {
  readonly env: Readonly<Record<string, string | undefined>>
  readonly ppid: number
  readonly parentComm: (pid: number) => string | null
}): string | null {
  const set = (name: string): boolean => (input.env[name] ?? '') !== ''
  if (!set('INVOCATION_ID') && !set('JOURNAL_STREAM')) return null
  if (input.ppid === 1 || input.parentComm(input.ppid) === 'systemd') return 'systemd'
  return null
}

/** 助手源码的注入面。 */
export interface HelperInput {
  readonly spawned: Respawn
  readonly cwd: string
  readonly logs: { readonly out: string; readonly err: string }
  readonly port: number | null
}

/**
 * 分离出去的助手进程源码（`node -e <它>`）。
 *
 * 单独抽出来是为了**能真的跑它来测**：这类 bug 只会在运行时露出来（"等待"这种代码，
 * 每一部分单看都是对的，合起来才错）。它的职责只有三件：等端口 → 起新宿主 → 验证并留证据。
 */
export function restartHelperSource(input: HelperInput): string {
  const { spawned, cwd, logs, port } = input
  return [
    "const { spawn } = require('node:child_process')",
    "const fs = require('node:fs')",
    "const net = require('node:net')",
    `const file = ${JSON.stringify(spawned.file)}`,
    `const args = ${JSON.stringify(spawned.args)}`,
    `const cwd = ${JSON.stringify(cwd)}`,
    `const viaShell = ${JSON.stringify(spawned.viaShell)}`,
    `const detached = ${JSON.stringify(spawned.detached)}`,
    `const logOut = ${JSON.stringify(logs.out)}`,
    `const logErr = ${JSON.stringify(logs.err)}`,
    `const port = ${JSON.stringify(port)}`,
    `const pollMs = ${String(RESTART_POLL_MS)}`,
    `const portWaitMs = ${String(RESTART_PORT_WAIT_MS)}`,
    `const settleMs = ${String(RESTART_PORT_SETTLE_MS)}`,
    `const probeMs = ${String(RESTART_PROBE_TIMEOUT_MS)}`,
    `const noPortDelayMs = ${String(RESTART_NO_PORT_DELAY_MS)}`,
    `const lingerMs = ${String(RESTART_HELPER_LINGER_MS)}`,
    `const replacementWaitMs = ${String(RESTART_REPLACEMENT_WAIT_MS)}`,
    'const sleep = (ms) => new Promise(r => setTimeout(r, ms))',
    // 失败必须留证据，而且这些行只能在"宿主已经退出"之后写 —— 所以由助手写。
    "const note = (line) => { try { fs.appendFileSync(logErr, '[dsh-composer-ux] ' + line + '\\n') } catch {} }",
    // "空闲" = 没人接受连接。用 connect 探而不是 bind：bind 一下自己就把端口占住了，
    // 而那正是替换进程马上要用的东西。
    'const listening = () => new Promise((resolve) => {',
    '  const probe = net.connect({ host: "127.0.0.1", port })',
    '  const done = (value) => { probe.destroy(); resolve(value) }',
    '  probe.on("connect", () => done(true))',
    '  probe.on("error", () => done(false))',
    '  setTimeout(() => done(false), probeMs)',
    '})',
    'const main = async () => {',
    '  if (port) {',
    '    const until = Date.now() + portWaitMs',
    '    while (Date.now() < until && await listening()) await sleep(pollMs)',
    '    if (await listening()) note("port " + port + " was still in use after " + portWaitMs + "ms; starting anyway")',
    '    await sleep(settleMs)',
    '  } else {',
    '    await sleep(noPortDelayMs)',
    '  }',
    '  let child',
    '  try {',
    '    const out = fs.openSync(logOut, "a")',
    '    const err = fs.openSync(logErr, "a")',
    // windowsHide：助手自己是 detached 的，Windows 上它没有控制台，而一个没有控制台的
    // 父进程 spawn 控制台程序会**新建一个可见控制台** —— 就是那个关掉就把宿主带走的黑窗口。
    '    child = spawn(file, args, { cwd, detached, stdio: ["ignore", out, err], env: process.env, shell: viaShell, windowsHide: true })',
    // spawn 报"文件不存在/不可执行"是**异步**的，下面的 try/catch 只接同步抛出，
    // 所以少了这个监听，失败会和被修的那个 bug 一样安静。
    '    child.on("error", (error) => note("could not start the replacement: " + (error && error.message ? error.message : String(error))))',
    '    child.unref()',
    '  } catch (error) {',
    '    note("could not start the replacement: " + (error && error.message ? error.message : String(error)))',
    '    return',
    '  }',
    // 多活一会儿在 Windows 上是有意义的：spawn 完立刻退出的助手可能把还没 detach 完的
    // 替换进程一起带走。有端口可探的那条路本来就要多待，这条是给没有端口的情况补上同样的保证。
    '  if (!port) { await sleep(lingerMs); return }',
    '  const upBy = Date.now() + replacementWaitMs',
    '  while (Date.now() < upBy && !(await listening())) await sleep(500)',
    '  if (!(await listening())) note("the replacement did not bind port " + port + " within " + replacementWaitMs + "ms — see the output log beside this one")',
    '}',
    'main()',
  ].join('\n')
}

/** 被 spawn 出来的进程（只取本模块要用的部分）。 */
export interface SpawnedLike {
  readonly pid?: number | undefined
  unref?: () => void
  once(event: string, listener: (arg?: unknown) => void): unknown
}

/** spawn 选项（只取本模块用到的）。 */
export interface SpawnOptionsLike {
  readonly detached: boolean
  readonly stdio: 'ignore'
  readonly windowsHide: boolean
  readonly env: Readonly<Record<string, string | undefined>>
}

/** 注入的外部动作。 */
export interface RestartIo {
  readonly platform: string
  readonly pid: number
  readonly argv0: string | undefined
  readonly execPath: string
  readonly argv1: string | undefined
  readonly execArgv: readonly string[]
  readonly rest: readonly string[]
  readonly cwd: string
  readonly env: Readonly<Record<string, string | undefined>>
  readonly tmpdir: string
  /** 日志文件名里的时间戳（测试里固定）。 */
  readonly stamp: string
  readonly exists: (path: string) => boolean
  readonly resolve: (path: string) => string
  readonly dirname: (path: string) => string
  readonly join: (...parts: readonly string[]) => string
  readonly spawn: (command: string, args: readonly string[], options: SpawnOptionsLike) => SpawnedLike
  /** 让宿主自己退出（真实实现见 {@link gracefulStop}）。 */
  readonly stop: () => void
  readonly wait: (ms: number) => Promise<void>
}

/** 计划好的重启（纯计算结果，不做任何动作）。 */
export interface RestartPlan {
  readonly node: string
  readonly launch: Launch
  readonly respawn: Respawn
  readonly helper: string
  readonly logOut: string
  readonly logErr: string
  readonly port: number | null
}

/** 算出这次重启要怎么做。 */
export function planRestart(io: RestartIo, port: number | null): RestartPlan {
  const node = nodeExecutableOf({ argv0: io.argv0, execPath: io.execPath, exists: io.exists })
  const launch = launchCommand({
    node,
    argv1: io.argv1,
    execArgv: io.execArgv,
    rest: io.rest,
    cwd: io.cwd,
    platform: io.platform,
    resolve: io.resolve,
    dirname: io.dirname,
  })
  const respawn = respawnCommand(launch, io.platform)
  const logOut = io.join(io.tmpdir, `${RESTART_LOG_PREFIX}${io.stamp}.out.log`)
  const logErr = io.join(io.tmpdir, `${RESTART_LOG_PREFIX}${io.stamp}.err.log`)
  return {
    node,
    launch,
    respawn,
    helper: restartHelperSource({ spawned: respawn, cwd: launch.cwd, logs: { out: logOut, err: logErr }, port }),
    logOut,
    logErr,
    port,
  }
}

/** 排好一次重启之后回给界面的信息。 */
export interface RestartScheduled {
  readonly ok: true
  readonly pid: number
  readonly helperPid: number | undefined
  readonly logOut: string
  readonly logErr: string
  readonly port: number | null
  /** 重放用的启动命令，给界面展示"会怎么重启"。 */
  readonly command: string
}

/**
 * 排一次重启：分离起助手 → 延迟 500ms 让自己退出。
 *
 * 返回时**宿主还没退出**：退出是延迟之后的异步动作，好让调用方把 HTTP 响应发出去。
 * @param io 注入的外部动作。
 * @param port 浏览器实际访问的端口（助手靠它判断旧进程什么时候真的让出了端口）。
 * @throws 助手进程起不来时抛出（连助手都没起来就退出自己 = 服务彻底没了，必须让界面知道）。
 */
export function scheduleRestart(io: RestartIo, port: number | null): RestartScheduled {
  const plan = planRestart(io, port)
  const helper = io.spawn(plan.node, ['-e', plan.helper], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: io.env,
  })
  helper.unref?.()
  void io.wait(RESTART_EXIT_DELAY_MS).then(() => { io.stop() })
  return {
    ok: true,
    pid: io.pid,
    helperPid: helper.pid,
    logOut: plan.logOut,
    logErr: plan.logErr,
    port: plan.port,
    command: [plan.respawn.file, ...plan.respawn.args].join(' '),
  }
}

/** 退出动作的注入面。 */
export interface StopIo {
  readonly emitSignal: (signal: string) => void
  readonly exit: (code: number) => void
  readonly timer: (ms: number, run: () => void) => void
}

/**
 * 让宿主优雅退出：把 `SIGTERM` **当事件发给自己**，而不是真的发信号。
 *
 * 这一条是本插件与市场唯一的实质分歧，值得写清理由：
 * `dsh web` 在 `apps/cli/src/profile-boot.ts` 里注册了 `process.on('SIGTERM', () => interrupt(0))`
 * —— 这是"supervisor 的普通停止请求"，会先 `fiber.dispose()` 把整棵插件树拆干净再退出，
 * 而且自带 5 秒上限（`createProcessShutdown`）。
 *
 * 但市场用的 `process.kill(pid,'SIGTERM')` 在 **Windows** 上等价于 `TerminateProcess`：
 * 本机实测（node 起子进程、注册 handler、自己杀自己）handler 一次都没跑到，进程直接没了。
 * 对"刚装完插件随手重启一下"没差别，对**正在跑长会话**的用户就是硬切。所以这里走 emit：
 * 复刻 supervisor 的语义，任何平台都真的执行 DSH 自己的关停路径。
 *
 * 兜底：10 秒后进程还在（比如宿主形态里没人注册 handler）就 `exit(0)` —— 不能让用户面对
 * 一个"点了重启但什么都没发生"的界面。
 */
export function gracefulStop(io: StopIo, signal = 'SIGTERM'): void {
  try {
    io.emitSignal(signal)
  } catch {
    // 没有 handler / emit 本身出错都不影响下面的兜底。
  }
  io.timer(RESTART_STOP_FALLBACK_MS, () => { io.exit(0) })
}

/** 这次启动的标识（界面靠"号变了"判断新进程真的起来了）。 */
export function bootId(pid: number, now: number): string {
  return `${String(pid)}-${String(now)}`
}
