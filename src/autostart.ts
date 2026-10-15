/**
 * 「自启动」的纯逻辑（0.23.0，用户 2026-10-15：「给我的插件添加一个 DSH 自启动功能，要有按钮开关」）。
 *
 * 语义（用户原话）：**开关跟着"你在哪个运行时里开"走** ——
 *   · 在网页版里开 ⇒ 注册"网页版"的自启（用当前 profile、当前这条启动命令）；
 *   · 在桌面应用里开 ⇒ 注册桌面 exe 的自启。
 * 两个运行时各有自己的 settings 文档，所以开关状态天然分开；而 **Windows 的启动项是全局的**，
 * 因此每个运行时只用**自己那一条**值名（见 {@link autostartEntryName}），开关只碰自己那条。
 *
 * 真相来源：**注册表**。设置里不存这个开关的意图 —— 你在系统里手动删了启动项，界面就该如实显示"关"。
 *
 * 本文件里全是纯函数（可逐格测），真正的 spawn 由 host.ts 注入（与 restart.ts 同一套纪律）。
 */

/** Windows 当前用户的启动项位置（`HKCU\...\Run`，无需管理员）。 */
export const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'

/** 启动项值名的前缀；后面跟 profile 名，做到"每个运行时一条"。 */
export const AUTOSTART_ENTRY_PREFIX = 'dsh-composer-ux:autostart:'

/** 这个运行时的类型。`desktop` = 桌面应用（Electron），`web` = 从源码/CLI 跑起来的网页版。 */
export type AutostartRuntime = 'desktop' | 'web'

/**
 * 启动该项需要的事实（都由宿主进程如实提供）。
 *
 * 网页版那条启动命令**不在这里重写** —— 由 host.ts 调 restart.ts 里那套经过真机打磨的
 * `launchCommand()`（它处理了"桌面壳起宿主用的是 dsh-desktop-host/lib/cli.js"、`.cmd` shim
 * 只能过 shell 等一堆真实死法），这里只负责"把这条命令怎么变成登录项"。
 */
export interface AutostartFacts {
  readonly platform: string
  readonly runtime: AutostartRuntime
  /** profile 名（进值名，保证两个运行时互不覆盖）。 */
  readonly profile: string
  /** 放启动器脚本的目录（网页版会在里面生成 .vbs）。 */
  readonly stateDir: string
  /** 桌面端要拉起的 exe（`DeepSeek Harness.exe`；由宿主从父进程路径取）。 */
  readonly desktopExe: string
  /** 网页版的启动命令（`launchCommand()` 的产物）。 */
  readonly launch: {
    readonly file: string
    readonly args: readonly string[]
    readonly cwd: string
    readonly viaShell: boolean
  }
}

/** 启动项做出来之后的结果。 */
export interface AutostartPlan {
  /** 值名（每个运行时一条）。 */
  readonly entryName: string
  /** 写进注册表的那个字符串（就是登录时会被执行的东西）。 */
  readonly value: string
  /** 需要先生成/更新的启动器脚本（网页版才有；桌面端直接指 exe，没有）。 */
  readonly launcher?: { readonly path: string, readonly content: string }
  /** 给人看的一句话：登录后会执行什么。 */
  readonly describe: string
}

/** 值名：`dsh-composer-ux:autostart:<profile>`。 */
export function autostartEntryName(profile: string): string {
  return `${AUTOSTART_ENTRY_PREFIX}${profile === '' ? 'default' : profile}`
}

/**
 * 这个平台到底支不支持（非 Windows 一律拒绝，返回原因；支持则返回空串）。
 *
 * 为什么要单列成纯函数：**绝对不许在非 Windows 上真去写注册表** —— 这条判断必须能被逐格测、
 * 也必须能被变异守卫咬住（2026-10-15 第一版把它内联在宿主里，锚点去掉判断后测试照样绿，
 * 因为同一句 process.platform 判断在别处还有两处 —— 守望失效）。
 *
 * @param platform - process.platform。
 * @returns 拒绝原因（空串 = 支持）。
 */
export function unsupportedReason(platform: string): string {
  return platform === 'win32' ? '' : '只在 Windows 上支持（其它平台没有登录启动项）'
}

/** Windows 路径里的单引号/双引号都要挡住（进命令行会断）。 */
function quote(value: string): string {
  return `"${value.replace(/"/g, '')}"`
}

/**
 * 算出"登录后执行什么"。
 *
 * 网页版为什么要绕一层 .vbs（用户选的是"最小化到任务栏"，2026-10-15）：
 *   · 直接把 `node …` 写进 Run 键 ⇒ 登录时**弹一个控制台**（用户不想被挡视线）；
 *   · `powershell -WindowStyle Hidden -Command "Start-Process …"` 也会先闪一个 PowerShell 控制台；
 *   · `wscript` 跑一个 .vbs、里面 `Run(cmd, 7, False)`（7 = 最小化且不抢焦点）**中间没有任何控制台**，
 *     node 自己的窗口按你要的"最小化到任务栏"出现。这是唯一"无闪烁 + 最小化"的组合。
 *
 * 桌面端不绕：它是 Electron 应用，有自己的窗口/托盘，还有单实例锁（重复启动只会聚焦已有窗口）。
 *
 * @param facts - 如上。
 * @returns 值名 + 要写入的字符串 + （网页版）启动器脚本内容。
 */
export function planAutostart(facts: AutostartFacts): AutostartPlan {
  const entryName = autostartEntryName(facts.profile)
  if (facts.runtime === 'desktop') {
    return {
      entryName,
      value: quote(facts.desktopExe),
      describe: `登录后启动桌面应用：${facts.desktopExe}`,
    }
  }
  const { file, args, cwd, viaShell } = facts.launch
  const parts: string[] = []
  if (viaShell) parts.push('cmd.exe', '/c')
  parts.push(quote(file))
  for (const arg of args) parts.push(quote(arg))
  const command = parts.join(' ')
  const launcherPath = `${facts.stateDir}\\autostart-${facts.profile === '' ? 'default' : facts.profile}.vbs`
  // VBScript 里双引号要写成两个。
  const escaped = command.replace(/"/g, '""')
  const content = [
    "' dsh-composer-ux：登录自启动（网页版）。由设置页「自启动」开关生成/删除，别手改 ——",
    "' 关掉开关时这个文件会被删除；想换启动参数请在设置页里改，不要直接编辑这里。",
    'Set shell = CreateObject("WScript.Shell")',
    `shell.CurrentDirectory = "${cwd.replace(/"/g, '')}"`,
    "' 7 = 最小化且不抢焦点；False = 不等它结束",
    `shell.Run "${escaped}", 7, False`,
    '',
  ].join('\r\n')
  return {
    entryName,
    value: `wscript.exe ${quote(launcherPath)}`,
    launcher: { path: launcherPath, content },
    describe: `登录后最小化启动网页版：${command}`,
  }
}

/**
 * 这个宿主进程是"桌面应用里那个"还是"命令行起的（网页版）"？
 *
 * **只看入口路径**：桌面端是把宿主作为子进程拉起来的，入口固定是
 * `@deepseek-ai/dsh-desktop-host/lib/index.js`（见官方 apps/desktop/src/host-process.ts）。
 *
 * 为什么不信 `ELECTRON_RUN_AS_NODE=1`（2026-10-15 真机踩到）：那个环境变量会**泄漏**到别的进程里 ——
 * 我在带它的 shell 里起网页版，插件就把网页版认成了桌面端，注册出一条指向 bash.exe 的启动项。
 * 环境变量是"猜"，入口路径是"事实"。
 *
 * @param argv1 - process.argv[1]。
 * @returns 运行时类型。
 */
export function runtimeOf(argv1: string | undefined): AutostartRuntime {
  return /dsh-desktop-host/iu.test(argv1 ?? '') ? 'desktop' : 'web'
}

/** `reg query` **整个** Run 键：这样"没有这条值"表现为"输出里找不到"，而不是一个本地化的报错。 */
export function listArgs(): readonly string[] {
  return ['query', RUN_KEY]
}
/** `reg query` 的参数（读自己那一条）。 */
export function queryArgs(entryName: string): readonly string[] {
  return ['query', RUN_KEY, '/v', entryName]
}

/** `reg add` 的参数（覆盖写自己那一条）。 */
export function addArgs(entryName: string, value: string): readonly string[] {
  return ['add', RUN_KEY, '/v', entryName, '/t', 'REG_SZ', '/d', value, '/f']
}

/** `reg delete` 的参数（删自己那一条）。 */
export function deleteArgs(entryName: string): readonly string[] {
  return ['delete', RUN_KEY, '/v', entryName, '/f']
}

/**
 * 从 `reg query` 的输出里读出那条值。
 *
 * 输出形如：
 *   HKEY_CURRENT_USER\Software\...\Run
 *       dsh-composer-ux:autostart:web    REG_SZ    wscript.exe "D:\...\autostart-web.vbs"
 * 值本身可能含空格，所以按"值名 + 类型"之后剩余部分取。
 *
 * @param entryName - 值名。
 * @param stdout - `reg query` 的标准输出。
 * @returns 值字符串；没有这条值（或输出不可解析）时 undefined。
 */
export function parseQueryValue(entryName: string, stdout: string): string | undefined {
  for (const rawLine of stdout.split(/\r?\n/u)) {
    const line = rawLine.trim()
    if (!line.startsWith(entryName)) continue
    const rest = line.slice(entryName.length).trim()
    const match = /^REG_[A-Z_]+\s+([\s\S]*)$/u.exec(rest)
    if (match === null) continue
    return match[1].trim()
  }
  return undefined
}

/** 注册表条目的状态（给设置页看的形状）。 */
export interface AutostartState {
  /** 这个平台支不支持（只在 Windows 上有意义）。 */
  readonly supported: boolean
  /** 注册表里到底有没有（**真相**：设置页不记意图）。 */
  readonly enabled: boolean
  /** 值名。 */
  readonly entryName: string
  /** 注册表里那条的实际值（有的话）。 */
  readonly registeredValue: string
  /** 期望的值（当前进程会算出来的那份）。 */
  readonly expectedValue: string
  /** 与人话说明：登录后会执行什么。 */
  readonly describe: string
  /** 平台不支持 / 读注册表失败之类的原因（空 = 没毛病）。 */
  readonly note: string
}

/**
 * 把"读到的注册表状态 + 当前算出来的计划"揉成设置页要的形状。
 *
 * 为什么单列一个纯函数：这里有一条**必须**判准的分支 —— 注册表里那条值如果是**旧版本/别的 profile**
 * 留下的（值与本机当前期望不一致），开关该显示"开"（条目确实在）但同时给出提示，而不是假装一切正常。
 *
 * @param input - 平台、计划、读到的值与读失败的原因。
 * @returns 设置页状态。
 */
export function describeAutostart(input: {
  readonly platform: string
  readonly plan: AutostartPlan
  readonly registered: string | undefined
  readonly readError: string
}): AutostartState {
  const supported = input.platform === 'win32'
  const enabled = input.registered !== undefined && input.registered !== ''
  const stale = enabled && input.registered !== input.plan.value
  const note = !supported
    ? '只在 Windows 上有意义（其它平台没有登录启动项这个概念，本栏不生效）'
    : input.readError !== ''
      ? `读不到启动项：${input.readError}`
      : stale
        ? '❗注册表里那条与当前进程算出来的不一致（可能是别的 profile 或旧版本留下的）：登录后会跑旧命令，建议关掉再打开一次'
        : ''
  return {
    supported,
    enabled,
    entryName: input.plan.entryName,
    registeredValue: input.registered ?? '',
    expectedValue: input.plan.value,
    describe: input.plan.describe,
    note,
  }
}
