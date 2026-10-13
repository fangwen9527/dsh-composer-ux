/**
 * 解释层的**内置 Bash 工具**（0.14.0，上游 `po06/lib/bash/*` 的简化版）。
 *
 * 用户 2026-09-30 明确选了「真做、但默认关」。它给解释层一个真能执行 shell 命令的工具，
 * 用来核对事实（`ls`、`grep`、`node -v` 这类），从而少写"我猜项目里用的是 X"。
 *
 * ⚠️ **边界要如实说**：这不是沙箱。它做的是四件事，恰好都是可核对的：
 *   1. **工作目录锁死**在本次会话的工作目录（`cwd` 由宿主给，命令在这里执行）；
 *   2. **单条超时**（默认 20 s，到点杀进程）—— 一条命令不许把整轮优化拖死；
 *   3. **输出上限**（stdout+stderr 合计 4000 字，超了截断并如实标注）；
 *   4. **命令长度上限**与**逐条记账**（调用次数/名字进台账，结果框里也看得见）。
 * 它**不能**阻止一条命令跑到别处去（shell 本身做不到）；所以默认关、由用户自己开。
 *
 * 本模块零外部依赖（只用 node 内建），永不抛异常：出错一律退化成"工具失败 + 原因"给模型看。
 */
import { spawn } from 'node:child_process'
import { realpathSync, statSync } from 'node:fs'
import { isAbsolute, relative, resolve as resolvePath } from 'node:path'

/** 工具名（模型看到的名字，也是台账里的名字）。 */
export const BASH_TOOL_NAME = 'bash'
/** 单条命令的字符上限（防手写超长串）。 */
export const BASH_MAX_COMMAND_CHARS = 2_000
/** 单条命令的超时（毫秒）。 */
export const BASH_TIMEOUT_MS = 20_000
/** 允许的最大超时（宿主若传得更大会被夹到这个值）。 */
export const BASH_MAX_TIMEOUT_MS = 60_000
/** stdout+stderr 合计的字符上限。 */
export const BASH_MAX_OUTPUT_CHARS = 4_000

/**
 * 参数名（0.22.0 起 `command` 与 `script_path` **二选一**）。
 *
 * 为什么加 `script_path`（借鉴 dsh-ops 的 `ops_bash`）：长脚本塞进工具调用 JSON 时，模型要为
 * 换行/引号/反斜杠做多层转义，一处漏了就整轮 `MALFORMED_RESPONSE` 作废。让它先用宿主的文件工具
 * **把脚本写成文件**、这里只传路径，就绕开了转义这一层。
 */
export const BASH_COMMAND_FIELD = 'command'
export const BASH_SCRIPT_FIELD = 'script_path'

/** 给模型的工具声明（与 `READ_TOOL_SCHEMAS` 同形状）。 */
export const BASH_TOOL_SCHEMA = {
  name: BASH_TOOL_NAME,
  description: [
    'Run a shell command in the user\'s project working directory and read its output.',
    'Use it to check facts you would otherwise have to guess (file names, versions, git status).',
    'Give either `command` (one line, short) or `script_path` (a file you already wrote inside the',
    'working directory) — never both. Multi-line or quote-heavy scripts belong in a file: put them',
    'there with the file tools first, then pass `script_path`, so no shell text has to survive JSON',
    'escaping. It is time-limited and its output is truncated. Read-only use is expected.',
  ].join(' '),
  parameters: {
    type: 'object',
    properties: {
      [BASH_COMMAND_FIELD]: {
        type: 'string',
        description: 'The shell command line to run (one line, no interactive input). Mutually exclusive with script_path.',
      },
      [BASH_SCRIPT_FIELD]: {
        type: 'string',
        description: 'Path to a script file inside the working directory; it runs through the same shell. Mutually exclusive with command.',
      },
    },
    additionalProperties: false,
  },
} as const

/** 开着 Bash 时追加给系统提示词的一段（说明边界，别让模型以为它是万能终端）。 */
export const BASH_TOOL_SYSTEM_NOTE = [
  '【关于 bash 工具】你可以调用 `bash` 在用户的工作目录里执行命令来**核对事实**：',
  '- 一次一条命令，不接交互输入；超时或输出过长会被截断（截断会如实告诉你）。',
  '- **长脚本、多行、含大量引号/反斜杠/中文的命令**：先用文件工具把它写成工作目录里的一个脚本，',
  '  再把 `script_path` 交给 `bash`（不要塞进 `command`）—— 那样不必在工具调用 JSON 里做多层转义。',
  '- 只能在工作目录里跑：不要 `cd` 到别处、不要写文件、不要装东西 —— 你的任务是**读事实**。',
  '- 命令失败不是灾难：退出码与报错会原样回到你这里，据此改判断即可。',
].join('\n')

/** 工具结果（与 `ToolRunResult` 同形状，便于同一个循环消费）。 */
export interface BashRunResult {
  readonly text: string
  readonly isError: boolean
  readonly meta: {
    readonly tool: string
    readonly files: number
    readonly hits: number
    readonly bytes: number
    readonly rejected?: string
  }
}

/** 收尾：超长截断并**如实标注**（绝不让模型以为它看到了全部输出）。 */
function clamp(text: string): { text: string; truncated: boolean } {
  if (text.length <= BASH_MAX_OUTPUT_CHARS) return { text, truncated: false }
  return { text: `${text.slice(0, BASH_MAX_OUTPUT_CHARS)}\n…（输出超长，只给了前 ${BASH_MAX_OUTPUT_CHARS} 字）`, truncated: true }
}

/** 拒绝一条调用（越界/参数坏），并如实记账。 */
function reject(reason: string): BashRunResult {
  return {
    text: `拒绝：${reason}`,
    isError: true,
    meta: { tool: BASH_TOOL_NAME, files: 0, hits: 0, bytes: 0, rejected: reason },
  }
}

/**
 * 把一个脚本路径解析成"确实落在工作目录里"的绝对路径；越界或不是文件返回 `undefined`。
 *
 * 两层判据：词法相对路径（挡 `..` 与绝对路径越界）＋ `realpath`（挡符号链接指到外面）。
 * 文件还不存在时 realpath 会抛，此时按词法结果返回即可 —— 后面 stat 会给出"脚本不存在"。
 */
function resolveInside(root: string, candidate: string): string | undefined {
  try {
    const abs = isAbsolute(candidate) ? candidate : resolvePath(root, candidate)
    let real = abs
    try { real = realpathSync.native(abs) } catch { real = abs }
    let realRoot = root
    try { realRoot = realpathSync.native(root) } catch { realRoot = root }
    const rel = relative(realRoot, real)
    if (rel === '' || isAbsolute(rel) || rel.startsWith('..')) return undefined
    return real
  } catch {
    return undefined
  }
}

/** 一次调用解析出来的执行意图：要么一条命令行，要么一个脚本文件。 */
export type BashIntent =
  | { readonly kind: 'command'; readonly command: string }
  | { readonly kind: 'script'; readonly scriptPath: string }
  | { readonly kind: 'reject'; readonly reason: string }

/** 声明里允许的参数名（用来点名未知键）。 */
const BASH_ALLOWED_FIELDS: readonly string[] = [BASH_COMMAND_FIELD, BASH_SCRIPT_FIELD]

/**
 * 校验并归一化一次调用（0.22.0，借鉴 dsh-ops 的"严格参数"）。
 *
 * 为什么要在**执行前**逐条点名：模型常把宿主 `bash`/`pwsh` 的参数（比如 `run_in_background`）
 * 套过来，或被 JSON 转义弄出多余键。静默忽略会让它以为参数生效了，下一轮还这么写；
 * 直接拒绝并同时给出"未知键"与"可接受的键"，它一次就能改对。
 *
 * @param args - 工具参数原样。
 * @returns 三选一：命令行 / 脚本路径 / 拒绝原因（原因文案直接给模型看）。
 */
export function readBashIntent(args: unknown): BashIntent {
  const row = (typeof args === 'object' && args !== null ? args : {}) as Record<string, unknown>
  const unknown = Object.keys(row).filter(key => !BASH_ALLOWED_FIELDS.includes(key))
  if (unknown.length > 0) {
    return {
      kind: 'reject',
      reason: `不认识的参数 ${unknown.map(key => `\`${key}\``).join('、')}（本工具只接受 ${BASH_ALLOWED_FIELDS.map(key => `\`${key}\``).join(' 与 ')}）`,
    }
  }
  const rawCommand = typeof row[BASH_COMMAND_FIELD] === 'string' ? row[BASH_COMMAND_FIELD].trim() : ''
  const rawScript = typeof row[BASH_SCRIPT_FIELD] === 'string' ? row[BASH_SCRIPT_FIELD].trim() : ''
  const hasCommand = rawCommand !== ''
  const hasScript = rawScript !== ''
  if (hasCommand && hasScript) return { kind: 'reject', reason: '`command` 与 `script_path` 只能给一个' }
  if (!hasCommand && !hasScript) return { kind: 'reject', reason: `缺少 \`${BASH_COMMAND_FIELD}\`，或者给 \`${BASH_SCRIPT_FIELD}\`（二选一）` }
  if (hasCommand) {
    if (rawCommand.length > BASH_MAX_COMMAND_CHARS) {
      return { kind: 'reject', reason: `命令超过 ${String(BASH_MAX_COMMAND_CHARS)} 字（长脚本请先写成文件再给 \`${BASH_SCRIPT_FIELD}\`）` }
    }
    return { kind: 'command', command: rawCommand }
  }
  return { kind: 'script', scriptPath: rawScript }
}

/** 这次调用允许到什么程度（0.22.0）。 */
export type BashAuthority =
  | { readonly kind: 'off' }
  | { readonly kind: 'denied'; readonly reason: string }
  /** 放开：`confined` 为真表示**必须**由宿主沙箱包住 argv 才准执行。 */
  | { readonly kind: 'open'; readonly confined: boolean }

/**
 * 决定这次优化能不能给模型 `bash` 工具（纯函数，便于逐格钉住）。
 *
 * 为什么需要它：这个工具是 `node:child_process.spawn` **直接执行**的，不经过宿主的受限终端后端
 * —— 也就是说它天生绕过会话策略（`read-only` / `workspace-write`）。dsh-ops 对同类工具的纪律是
 * "只在完全权限下发布"；我们进一步：能拿到宿主沙箱服务时用 `sandbox.confine()` 把 argv 包起来
 * （各模式都安全可用），拿不到就退回"只在完全权限下发布"，**证明不了安全就不给**。
 *
 * @param input.enabled - 用户设置里这一栏开没开。
 * @param input.mode - 该会话解析出来的权限模式；`undefined` = 拿不到。
 * @param input.hasConfine - 宿主沙箱服务（`ctx.sandbox.confine`）在不在。
 * @returns `off`（没开）/ `denied`（证明不了安全，附原因）/ `open`（`confined` 表示要不要包沙箱）。
 */
export function resolveBashAuthority(input: {
  readonly enabled: boolean
  readonly mode?: string
  readonly hasConfine: boolean
}): BashAuthority {
  if (!input.enabled) return { kind: 'off' }
  if (input.mode === 'danger-full-access') return { kind: 'open', confined: false }
  if (input.mode !== 'read-only' && input.mode !== 'workspace-write') {
    return { kind: 'denied', reason: '拿不到这个会话的权限模式，无法证明命令会被约束' }
  }
  if (!input.hasConfine) {
    return { kind: 'denied', reason: `会话是 ${input.mode}（不是完全权限），而宿主没有可用的沙箱服务` }
  }
  return { kind: 'open', confined: true }
}

/**
 * 跑一条命令或一个脚本文件。
 *
 * @param root - 会话工作目录（绝对路径）。命令只在这里执行；脚本路径也必须落在这里面。
 * @param args - 工具参数：`{ command }` 或 `{ script_path }` 二选一。
 * @param options.timeoutMs - 覆盖默认超时（会被夹到 `BASH_MAX_TIMEOUT_MS` 以内）。
 * @param options.signal - 整轮优化被中止时一并杀掉命令。
 * @param options.confine - 宿主沙箱的 `confine`（0.22.0）：给了就**必须**成功包住 argv 才执行。
 * @returns 结果文本 + isError + 记账；**任何情况都不抛异常**。
 */
export function runBashTool(
  root: string,
  args: unknown,
  options: {
    readonly timeoutMs?: number
    readonly signal?: AbortSignal
    readonly confine?: (argv: readonly string[]) => Promise<{ readonly argv: readonly string[]; readonly enforcement?: string }>
  } = {},
): Promise<BashRunResult> {
  const intent = readBashIntent(args)
  if (intent.kind === 'reject') return Promise.resolve(reject(intent.reason))
  if (root === '') return Promise.resolve(reject('拿不到会话工作目录，拒绝执行'))
  try {
    if (!statSync(root).isDirectory()) return Promise.resolve(reject('会话工作目录不是一个目录'))
  } catch {
    return Promise.resolve(reject('会话工作目录不存在'))
  }

  const isWindows = process.platform === 'win32'
  // Windows 用 `cmd /d /s /c`；其它平台用 `/bin/sh`。两边都**不拼字符串**：
  // 命令行作为**一个参数**交给 shell，脚本路径作为 shell 的**位置参数**。
  const shell = isWindows ? (process.env.ComSpec ?? 'cmd.exe') : '/bin/sh'
  let baseArgv: string[]
  if (intent.kind === 'command') {
    // Windows 的 cmd /d /s /c 有个经典陷阱：命令**以引号开头**时，cmd 会把整个串的首尾
    // 引号各剥掉一个，于是 "C:\p\node.exe" -e "…" 会被啃坏、跑不起来。
    // 官方绕法：这种时候把整条命令再包一层引号（外层被 /s 规则剥掉，内层原样留给 cmd）。
    const winCommand = intent.command.startsWith('"') ? `"${intent.command}"` : intent.command
    baseArgv = isWindows ? [shell, '/d', '/s', '/c', winCommand] : [shell, '-c', intent.command]
  } else {
    const inside = resolveInside(root, intent.scriptPath)
    if (inside === undefined) {
      return Promise.resolve(reject(`脚本必须在会话工作目录里：${intent.scriptPath}`))
    }
    try {
      if (!statSync(inside).isFile()) return Promise.resolve(reject(`不是文件：${intent.scriptPath}`))
    } catch {
      return Promise.resolve(reject(`脚本不存在：${intent.scriptPath}`))
    }
    // 脚本走 shell 的**位置参数**（不再把内容塞进命令行）：这是引入 script_path 的全部意义。
    baseArgv = isWindows
      ? [shell, '/d', '/s', '/c', `"${inside}"`]
      : [shell, inside]
  }

  return new Promise<BashRunResult>((resolve) => {
    const wantTimeout = options.timeoutMs ?? BASH_TIMEOUT_MS
    const timeoutMs = Math.max(1_000, Math.min(BASH_MAX_TIMEOUT_MS, Math.round(wantTimeout)))
    const started = Date.now()

    /** 真正 spawn 的那一步（约束成功后才走）。 */
    const launch = (argv: readonly string[]): void => {
      if (argv.length === 0) {
        resolve(reject('沙箱返回了空的 argv，没有执行'))
        return
      }
      const [file, ...rest] = argv
      let child: ReturnType<typeof spawn>
      try {
        child = spawn(file as string, rest, {
          cwd: root,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          // Windows 上必须**原样**把 argv 交给 cmd：Node 默认会再转义一遍参数，
          // 那会把上面刚拼好的引号又改坏（实测：报"文件名、目录名或卷标语法不正确"）。
          ...(isWindows ? { windowsVerbatimArguments: true } : {}),
          // POSIX 上让子进程自成**进程组**：超时时要能整组杀掉（见 killTree）。
          ...(isWindows ? {} : { detached: true }),
        })
      } catch (error: unknown) {
        resolve(reject(`启动命令失败（${file ?? ''}）：${error instanceof Error ? error.message : String(error)}`))
        return
      }

      let collected = ''
      let bytes = 0
      let killed = false
      const append = (chunk: Buffer): void => {
        bytes += chunk.byteLength
        // 到了上限就不再累积（但继续 drain，避免管道堵死子进程）。
        if (collected.length >= BASH_MAX_OUTPUT_CHARS) return
        collected += chunk.toString('utf8')
      }
      child.stdout?.on('data', append)
      child.stderr?.on('data', append)

      /**
       * 超时要杀**整棵进程树**，不能只杀直接子进程。
       *
       * 实测（Windows）：`cmd /c "node -e setTimeout(…)"` 里真正干活的是 cmd 的**孙进程**，
       * 只 `child.kill()` 会留下它继续跑到自然结束 —— 那条 30 秒的命令就是这么把测试拖到 30 秒的。
       * 做法：Windows 用 `taskkill /t /f`；POSIX 上子进程自成进程组，整组 SIGKILL。
       */
      const kill = (): void => {
        killed = true
        const pid = child.pid ?? 0
        try {
          if (isWindows) {
            spawn('taskkill', ['/pid', String(pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' })
          } else if (pid > 0) {
            process.kill(-pid, 'SIGKILL')
          } else {
            child.kill('SIGKILL')
          }
        } catch {
          try {
            child.kill('SIGKILL')
          } catch {
            // 进程可能已经退出：忽略。
          }
        }
      }
      const timer = setTimeout(kill, timeoutMs)
      const onAbort = (): void => { kill() }
      if (options.signal !== undefined) {
        if (options.signal.aborted) kill()
        else options.signal.addEventListener('abort', onAbort, { once: true })
      }

      const finish = (code: number | null, errorText?: string): void => {
        clearTimeout(timer)
        options.signal?.removeEventListener('abort', onAbort)
        const { text, truncated } = clamp(collected.trimEnd())
        const elapsed = Date.now() - started
        // 缺口可读化（0.22.0）：spawn 的 ENOENT 原来会原样抛给模型，模型看不出"是执行器没装"。
        const readable = errorText === undefined
          ? undefined
          : /ENOENT/i.test(errorText)
            ? `找不到执行器 ${file ?? ''}（ENOENT）：这台机器上没有它，或路径不对`
            : errorText
        const head = killed
          ? `超时 ${String(elapsed)} ms（或本轮已中止）：命令已被杀掉`
          : readable !== undefined
            ? `执行失败：${readable}`
            : `退出码 ${String(code ?? 'null')}`
        const note = truncated ? '\n（输出已截断）' : ''
        const lines = text === '' ? 0 : text.split('\n').length
        resolve({
          text: `${head}\n${text}${note}`.trimEnd(),
          isError: killed || errorText !== undefined || (code ?? 0) !== 0,
          meta: {
            tool: BASH_TOOL_NAME,
            files: 0,
            hits: lines,
            bytes,
            ...(killed ? { rejected: `超时 ${String(timeoutMs)} ms 被杀` } : {}),
          },
        })
      }

      child.on('error', (error: Error) => { finish(null, error.message) })
      child.on('close', (code: number | null) => { finish(code) })
    }

    if (options.confine === undefined) {
      launch(baseArgv)
      return
    }
    // 约束失败 = 不执行。**失败方向必须是安全的**：证明不了"命令被关在工作区里"就不跑。
    void Promise.resolve()
      .then(() => options.confine?.(baseArgv))
      .then((confined) => {
        if (confined === undefined || !Array.isArray(confined.argv) || confined.argv.length === 0) {
          resolve(reject('沙箱没有返回可执行的 argv，没有执行'))
          return
        }
        // 后端自报"约束不完整"（例如 Linux 上没装 bwrap）时不当它是边界 —— 宁可拒绝。
        if (confined.enforcement !== undefined && confined.enforcement !== 'full') {
          resolve(reject(`宿主沙箱只提供部分约束（enforcement=${confined.enforcement}），本会话不是完全权限，拒绝执行`))
          return
        }
        launch(confined.argv)
      })
      .catch((error: unknown) => {
        resolve(reject(`沙箱约束失败，没有执行：${error instanceof Error ? error.message : String(error)}`))
      })
  })
}
