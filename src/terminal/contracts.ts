/**
 * 「默认终端」的公共契约：设置字段、三档元数据、候选形状、净化与"最终用谁"的判定。
 *
 * 零 import（host 与 client 两半共用，跨端不共享任何运行时身份）。
 *
 * 这里的字段分两类，**不要混**：
 *  - 用户配置：`terminalMode` / `terminalBashPath` —— 由设置页写，宿主半读；
 *  - 宿主半自持：`terminalCandidates` / `terminalStatus` / `terminalEffective` ——
 *    只由宿主半写（探测结果与运行状态），设置页只读展示；「恢复默认」不得清空它们
 *    （见 settings-contract 的 HOST_OWNED_FIELDS），否则界面会失去探测结果与状态。
 */
import type { BashCandidate, BashKind, DiscoverResult, ExplicitState } from './discover.ts'
import { defaultBashPath, discoverBashCandidates, normalizePath } from './discover.ts'

/** 用户配置字段：终端档位。 */
export const TERMINAL_MODE_FIELD = 'terminalMode'

/** 用户配置字段：Git Bash 路径（留空 = 用探测到的第一个候选）。 */
export const TERMINAL_BASH_PATH_FIELD = 'terminalBashPath'

/** 宿主半自持：探测到的候选列表。 */
export const TERMINAL_CANDIDATES_FIELD = 'terminalCandidates'

/** 宿主半自持：状态行（当前生效 shell / 为什么没生效）。 */
export const TERMINAL_STATUS_FIELD = 'terminalStatus'

/** 宿主半自持：当前实际生效的 shell（'bash' / 'pwsh'）。 */
export const TERMINAL_EFFECTIVE_FIELD = 'terminalEffective'

/** 宿主半注册的状态/发现接口路径（客户端半读写）。 */
export const TERMINAL_API_PATH = '/composer-ux/terminal'

/** 档位。 */
export type TerminalMode = 'auto' | 'gitbash' | 'pwsh'

/** 三档元数据（数组顺序即界面顺序）。 */
export const TERMINAL_MODES: readonly {
  readonly id: TerminalMode
  readonly label: string
  readonly hint: string
}[] = [
  {
    id: 'auto',
    label: '自动',
    hint: '探测到 Git Bash 就用它（找不到则保持 PowerShell）；开箱即用，不用手填路径',
  },
  {
    id: 'gitbash',
    label: 'Git Bash',
    hint: '强制换成 Git Bash；没探测到就回落 PowerShell，并在状态行写明原因',
  },
  {
    id: 'pwsh',
    label: 'PowerShell',
    hint: '保持 DSH 默认（本插件完全不碰终端工具面）',
  },
]

/** 默认档位：自动（零配置即得收益，且找不到 bash 时不会把环境弄坏）。 */
export const DEFAULT_TERMINAL_MODE: TerminalMode = 'auto'

/** 落盘的候选形状（比探测结果多一点：kind 与 explicit 供界面标注）。 */
export interface TerminalCandidate {
  readonly path: string
  readonly label: string
  readonly kind: BashKind
  readonly explicit: boolean
}

/** 收窄档位。 */
export function terminalModeFrom(value: unknown): TerminalMode {
  return value === 'auto' || value === 'gitbash' || value === 'pwsh' ? value : DEFAULT_TERMINAL_MODE
}

/** 探测结果 → 落盘候选（去掉运行期才知道的字段）。 */
export function candidatesToStored(candidates: readonly BashCandidate[]): readonly TerminalCandidate[] {
  return candidates.map(candidate => ({
    path: candidate.path,
    label: candidate.label,
    kind: candidate.kind,
    explicit: candidate.explicit,
  }))
}

/** 收窄落盘候选（防脏数据；上限 20 条够用）。 */
export function sanitizeTerminalCandidates(value: unknown): readonly TerminalCandidate[] {
  if (!Array.isArray(value)) return []
  const out: TerminalCandidate[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (out.length >= 20) break
    if (typeof item !== 'object' || item === null) continue
    const row = item as Record<string, unknown>
    const path = typeof row.path === 'string' ? normalizePath(row.path).slice(0, 400) : ''
    if (path === '') continue
    const key = path.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const label = typeof row.label === 'string' ? row.label.slice(0, 40) : ''
    const kind = row.kind === 'git' || row.kind === 'msys2' || row.kind === 'cygwin'
      || row.kind === 'niubash' || row.kind === 'path' ? row.kind : 'path'
    out.push({ path, label: label === '' ? 'PATH' : label, kind, explicit: row.explicit === true })
  }
  return out
}

/**
 * 这一轮实际该用哪个 bash。
 *
 * 三档的差别只在这里，别在调用处再判一次：
 *  - `pwsh`：不用 bash（返回空串）；
 *  - `gitbash` / `auto`：优先用户填的路径，其次候选表第一个（探测顺序已排好：
 *    显式 → Git Bash → MSYS2/Cygwin → Niubash → PATH）；
 *  - 两者都不要求"必须找到"：找不到时返回空串，由调用方回落 PowerShell
 *    （`auto` 静默回落，`gitbash` 会在状态行里说明——差别只是"要不要解释"）。
 * @param mode 当前档位。
 * @param bashPath 用户填的路径（可空）。
 * @param candidates 宿主半上次探测到的候选。
 * @returns 可执行文件路径；空串表示这一轮不用 bash。
 */
export function activeBashPath(
  mode: TerminalMode,
  bashPath: string,
  candidates: readonly TerminalCandidate[],
  explicitState?: ExplicitState,
): string {
  if (mode === 'pwsh') return ''
  const explicit = normalizePath(bashPath)
  // 显式路径只有在"确实存在"（或调用方已经验证过、没给状态）时才压过探测结果。
  if (explicit !== '' && (explicitState === undefined || explicitState.state === 'ok')) return explicit
  return defaultBashPath({ candidates, excluded: [] })
}

/** 探测（把写死的环境读取集中在这里，其余逻辑都在纯函数里）。 */
export function probeBash(
  explicitPath: string,
  pathValue: string,
  env: (name: string) => string | undefined,
  exists: (path: string) => boolean,
  listDirs?: (parent: string) => readonly string[],
): DiscoverResult {
  return discoverBashCandidates({
    exists,
    pathEntries: pathValue.split(';'),
    env,
    explicitPath,
    ...(listDirs === undefined ? {} : { listDirs }),
  })
}

/** 状态行的输入（宿主半算好这些事实，文案本身是纯函数，便于单测）。 */
export interface StatusInput {
  /** `process.platform`。 */
  readonly platform: string
  readonly mode: TerminalMode
  /** 探测到的候选（已排序）。 */
  readonly candidates: readonly TerminalCandidate[]
  /** 被硬排除的 WSL 路径条数。 */
  readonly excludedCount: number
  /** 用户显式填的路径状态（没填则 undefined）。 */
  readonly explicit?: ExplicitState
  /** 这一轮实际生效的 shell。 */
  readonly effective: 'bash' | 'pwsh' | 'unsupported'
  /** 生效时用的具体路径（effective 为 bash 时给出）。 */
  readonly effectivePath?: string
  /** 下发到 agent 时遇到的失败原因（restrict/register 失败）。 */
  readonly failure?: string
}

/**
 * 生成状态行（设置页直接展示这句话）。
 *
 * 原则：**只说事实，不给建议**。生效时给出路径与来源；不生效时解释为什么
 * （没找到 / 路径不存在 / 平台不对），并且明确说出"已排除 WSL"这种我们主动做的决定。
 * @param input 事实。
 * @returns 一行中文状态（最长 400 字符，与 schema 上限一致）。
 */
export function terminalStatusText(input: StatusInput): string {
  const text = (() => {
    if (input.platform !== 'win32') {
      return `本插件只在 Windows 上接管终端（当前平台 ${input.platform}），此处不生效`
    }
    if (input.mode === 'pwsh') {
      return '保持 DSH 默认（PowerShell）——本插件不介入终端工具面'
    }
    if (input.effective === 'bash') {
      const path = input.effectivePath ?? ''
      const candidate = input.candidates.find(item => item.path === path)
      const suffix = input.explicit?.state === 'missing'
        ? `（你填的路径不存在：${input.explicit.path}）`
        : input.explicit?.state === 'wsl'
          ? `（你填的是 WSL 的 bash：${input.explicit.path}）`
          : ''
      return `已生效：${path}${candidate === undefined ? '' : `（${candidate.label}）`}${suffix}`
    }
    if (input.candidates.length === 0) {
      const excluded = input.excludedCount > 0 ? `（已排除 ${input.excludedCount} 个 WSL 的 bash.exe）` : ''
      return `没找到可用的 bash${excluded}，暂时保持 PowerShell`
    }
    return `候选不可用，暂时保持 PowerShell`
  })()
  const failure = input.failure === undefined || input.failure === '' ? '' : `；下发失败：${input.failure}`
  return `${text}${failure}`.slice(0, 400)
}
