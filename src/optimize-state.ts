/**
 * 结果框状态的**磁盘**一侧（0.13.0 ①）：重启/刷新后，上一轮优化结果还在框里。
 *
 * 现状：结果框只在内存里 —— 关面板不清空，但**重启即清**。重启一次 DSH 就丢了刚跑出来的成品，
 * 想看只能再花一次模型调用。
 *
 * ⚠️ **隐私边界（用户 2026-09-29 明确选 A）**：这份文件里**有内容** —— 成品正文、条目、逐字引文、
 * 发起时的草稿，因为"重启后结果框还在"本质就是把这些存下来。它与 `quick-prompts.json` 同级
 * （都是插件自己的状态文件，那个文件里本来就存着用户自己的提示词）。**逐轮台账（optimize-log.jsonl）
 * 才是只记元数据的那一份**，两者刻意分开。
 *
 * 三条硬纪律（照抄上游 `store.js` 踩出来的做法）：
 *  1. **原子写**：先写临时文件再 `rename`，避免半份 JSON 被读成"状态损坏"；
 *  2. **损坏隔离而不是覆盖**：读不出来（JSON 坏 / 形状不对）就把原文件改名成
 *     `<名>.corrupt-<时间戳>.json` 留证据 —— 那里面可能是用户唯一的一份成品；
 *  3. **体积上限**：超过上限就**不写**（而不是截半），并如实回报 `tooBig`。
 */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { dshHome } from './quick-store.ts'

/** 文件名（`$DSH_HOME/composer-ux/` 下）。 */
export const OPTIMIZE_STATE_FILE = 'optimize-dock.json'
/** 单份状态的字节上限：结果框是一份东西，不可能正常长到 64 KB；超了就是不写。 */
export const OPTIMIZE_STATE_MAX_BYTES = 64 * 1024
/** 信封版本：将来换形状时，老版本文件要被**如实忽略**而不是硬解析成乱码。 */
export const OPTIMIZE_STATE_VERSION = 1

/** 状态文件绝对路径。 */
export function optimizeStatePath(home: string = dshHome()): string {
  return join(home, 'composer-ux', OPTIMIZE_STATE_FILE)
}

/** 读盘结果。`state === null` 表示"没有可恢复的状态"（首次运行、被关掉、或文件已损坏被隔离）。 */
export interface DockStateRead {
  readonly state: Record<string, unknown> | null
  /** 文件读不出来（已隔离留证据）。 */
  readonly corrupt: boolean
  /** 被隔离到哪（非空说明原文件保住了）。 */
  readonly quarantined?: string
  /** 版本不认识（比如将来降级运行）—— 不算损坏，只是不认。 */
  readonly unknownVersion?: number
}

/** 把读不出来的状态文件**改名留证据**，绝不静默覆盖。 */
export function quarantineDockState(file: string, at: number = Date.now()): string | undefined {
  try {
    const target = `${file}.corrupt-${new Date(at).toISOString().replace(/[:.]/g, '-')}.json`
    renameSync(file, target)
    return target
  } catch {
    return undefined
  }
}

/**
 * 读状态文件。
 *
 * @param file - 状态文件路径。
 * @returns 读盘结果（任何异常都退化成"没有可恢复的状态"，不让插件起不来）。
 */
export function readDockState(file: string = optimizeStatePath()): DockStateRead {
  if (!existsSync(file)) return { state: null, corrupt: false }
  let text = ''
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    return { state: null, corrupt: false }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { state: null, corrupt: true, quarantined: quarantineDockState(file) }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { state: null, corrupt: true, quarantined: quarantineDockState(file) }
  }
  const envelope = parsed as Record<string, unknown>
  const version = Number(envelope.version)
  if (version !== OPTIMIZE_STATE_VERSION) {
    // 版本不认识：**不动文件**（可能是用户从新版降级回来，那份状态还在），只是这次不恢复。
    return { state: null, corrupt: false, ...(Number.isFinite(version) ? { unknownVersion: version } : {}) }
  }
  const state = envelope.state
  if (typeof state !== 'object' || state === null || Array.isArray(state)) {
    return { state: null, corrupt: true, quarantined: quarantineDockState(file) }
  }
  return { state: state as Record<string, unknown>, corrupt: false }
}

/** 写盘结果。 */
export interface DockStateWrite {
  readonly written: boolean
  /** 状态太大（超上限）⇒ 拒写，而不是截半。 */
  readonly tooBig?: boolean
  readonly bytes?: number
  readonly error?: string
}

/**
 * 原子写状态（`null` = 清掉这份状态）。
 *
 * @param state - 要存的形状（调用方已经过净化）；`null` 表示删除文件。
 * @param file - 状态文件路径。
 */
export function writeDockState(state: Record<string, unknown> | null, file: string = optimizeStatePath()): DockStateWrite {
  try {
    if (state === null) {
      if (existsSync(file)) rmSync(file)
      return { written: true, bytes: 0 }
    }
    const payload = `${JSON.stringify({ version: OPTIMIZE_STATE_VERSION, at: new Date().toISOString(), state })}\n`
    const bytes = Buffer.byteLength(payload, 'utf8')
    if (bytes > OPTIMIZE_STATE_MAX_BYTES) return { written: false, tooBig: true, bytes }
    mkdirSync(dirname(file), { recursive: true })
    const tmp = `${file}.tmp-${process.pid}`
    writeFileSync(tmp, payload)
    renameSync(tmp, file)
    return { written: true, bytes }
  } catch (error: unknown) {
    return { written: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** 清空（设置页「清空结果框状态」与 CLI 共用）。文件不存在也算成功。 */
export function clearDockState(file: string = optimizeStatePath()): boolean {
  try {
    if (existsSync(file)) rmSync(file)
    return true
  } catch {
    return false
  }
}

/** 当前状态文件的大小（给设置页/排查用；不存在是 0）。 */
export function dockStateBytes(file: string = optimizeStatePath()): number {
  try {
    return existsSync(file) ? statSync(file).size : 0
  } catch {
    return 0
  }
}
