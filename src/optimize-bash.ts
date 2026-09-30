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
import { statSync } from 'node:fs'

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

/** 给模型的工具声明（与 `READ_TOOL_SCHEMAS` 同形状）。 */
export const BASH_TOOL_SCHEMA = {
  name: BASH_TOOL_NAME,
  description: [
    'Run a shell command in the user\'s project working directory and read its output.',
    'Use it to check facts you would otherwise have to guess (file names, versions, git status).',
    'One command per call; it is time-limited and its output is truncated. Read-only use is expected.',
  ].join(' '),
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The shell command line to run (one line, no interactive input).' },
    },
    required: ['command'],
    additionalProperties: false,
  },
} as const

/** 开着 Bash 时追加给系统提示词的一段（说明边界，别让模型以为它是万能终端）。 */
export const BASH_TOOL_SYSTEM_NOTE = [
  '【关于 bash 工具】你可以调用 `bash` 在用户的工作目录里执行命令来**核对事实**：',
  '- 一次一条命令，不接交互输入；超时或输出过长会被截断（截断会如实告诉你）。',
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
 * 跑一条命令。
 *
 * @param root - 会话工作目录（绝对路径）。命令只在这里执行。
 * @param args - 工具参数（`{ command }`）。
 * @param options.timeoutMs - 覆盖默认超时（会被夹到 `BASH_MAX_TIMEOUT_MS` 以内）。
 * @param options.signal - 整轮优化被中止时一并杀掉命令。
 * @returns 结果文本 + isError + 记账；**任何情况都不抛异常**。
 */
export function runBashTool(
  root: string,
  args: unknown,
  options: { readonly timeoutMs?: number; readonly signal?: AbortSignal } = {},
): Promise<BashRunResult> {
  return new Promise<BashRunResult>((resolve) => {
    const row = (typeof args === 'object' && args !== null ? args : {}) as Record<string, unknown>
    const command = typeof row.command === 'string' ? row.command.trim() : ''
    if (command === '') return resolve(reject('缺少 command'))
    if (command.length > BASH_MAX_COMMAND_CHARS) {
      return resolve(reject(`命令超过 ${BASH_MAX_COMMAND_CHARS} 字（一条命令不该这么长）`))
    }
    if (root === '') return resolve(reject('拿不到会话工作目录，拒绝执行'))
    try {
      if (!statSync(root).isDirectory()) return resolve(reject('会话工作目录不是一个目录'))
    } catch {
      return resolve(reject('会话工作目录不存在'))
    }

    const wantTimeout = options.timeoutMs ?? BASH_TIMEOUT_MS
    const timeoutMs = Math.max(1_000, Math.min(BASH_MAX_TIMEOUT_MS, Math.round(wantTimeout)))
    const started = Date.now()
    const isWindows = process.platform === 'win32'
    // Windows 用 `cmd /d /s /c`；其它平台用 `/bin/sh -c`。两边都**不拼字符串**，
    // 把命令作为**一个参数**交给 shell（避免我们自己引入一层注入面）。
    const shell = isWindows ? (process.env.ComSpec ?? 'cmd.exe') : '/bin/sh'
    // Windows 的 cmd /d /s /c 有个经典陷阱：命令**以引号开头**时，cmd 会把整个串的首尾
    // 引号各剥掉一个，于是 "C:\p\node.exe" -e "…" 会被啃坏、跑不起来。
    // 官方绕法：这种时候把整条命令再包一层引号（外层被 /s 规则剥掉，内层原样留给 cmd）。
    const winCommand = command.startsWith('"') ? `"${command}"` : command
    const shellArgs = isWindows ? ['/d', '/s', '/c', winCommand] : ['-c', command]

    let child: ReturnType<typeof spawn>
    try {
      child = spawn(shell, shellArgs, {
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
      return resolve(reject(`启动命令失败：${error instanceof Error ? error.message : String(error)}`))
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
      const head = killed
        ? `超时 ${String(elapsed)} ms（或本轮已中止）：命令已被杀掉`
        : errorText !== undefined
          ? `执行失败：${errorText}`
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
  })
}
