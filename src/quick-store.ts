/**
 * 快捷指令的全局存储：`$DSH_HOME/quick-prompts.json`。
 *
 * 为什么不要放在 settings 文档里（0.2.x 的做法）：
 *  1. 设置文档对**数组**是整份替换，且受 schema 长度上限约束——旧上限 4000 字会把
 *     长提示词**静默截断**；
 *  2. 快捷指令是「用户内容」而不是「插件配置」，单独一个文件便于备份、搬迁、
 *     手工编辑，插件被禁用/卸载也不牵连它；
 *  3. 与会话、项目无关（DSH_HOME 级别），换个仓库、换个会话都还在。
 *
 * 与 lnyuqian/dsh-quick-prompts 的两处差别（都往严格的方向走）：
 *  · 它是 `writeFile(...)` 直接覆盖 —— 中途失败会留下**截断的 JSON**；这里用
 *    「临时文件 → fsync → rename」原子替换，读者只会看到旧文件或新文件。
 *  · 它读盘失败时 `catch { return [] }` —— 于是 UI 显示空列表，用户一保存就把
 *    空列表写回去，**真数据被覆盖**；这里解析失败先**隔离**坏文件
 *    （改名成 `.bad-<时间戳>`）再如实报错，绝不返回空本、绝不写入。
 */
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  QUICK_BOOK_VERSION, bookToFile, defaultQuickBook, sanitizeBook,
  type QuickPromptBook,
} from './settings-contract.ts'

/** 文件名。与参考实现同路径，所以两边能读同一份数据。 */
export const QUICK_STORE_FILE = 'quick-prompts.json'

/** 拿锁的重试节奏与总时长。 */
const LOCK_RETRY_MS = 50
const LOCK_RETRY_MAX = 40

/** 超过这个年龄的锁视为「上次写入崩溃留下的」，只提示操作者手工处理，不自动抢占。 */
const LOCK_STALE_MS = 30_000

/** 读盘结果。`missing` = 还没有文件，可以迁移；`broken` = 文件在但读不了（已隔离）。 */
export type ReadOutcome =
  | { readonly kind: 'missing' }
  | { readonly kind: 'ok'; readonly book: QuickPromptBook }
  | { readonly kind: 'broken'; readonly error: string; readonly quarantined?: string }

/** `$DSH_HOME`；环境变量缺失时回退 `~/.dsh`。 */
export function dshHome(): string {
  const fromEnv = process.env.DSH_HOME?.trim()
  return fromEnv !== undefined && fromEnv !== '' ? fromEnv : join(homedir(), '.dsh')
}

/** 快捷指令文件的绝对路径。 */
export function quickStorePath(): string {
  return join(dshHome(), QUICK_STORE_FILE)
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function hasCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === code
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => { setTimeout(resolve, ms) })
}

/** 把坏文件改名隔离，返回新路径（改名失败则返回 undefined，但绝不删除）。 */
async function quarantine(file: string): Promise<string | undefined> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const target = `${file}.bad-${stamp}`
  try {
    await rename(file, target)
    return target
  } catch {
    return undefined
  }
}

/**
 * 读盘。
 * @param file 文件路径。
 * @returns 三种结局之一；**解析失败绝不当成空本**。
 */
export async function readQuickBook(file: string = quickStorePath()): Promise<ReadOutcome> {
  let raw: string
  try {
    raw = await readFile(file, 'utf8')
  } catch (error) {
    if (hasCode(error, 'ENOENT')) return { kind: 'missing' }
    return { kind: 'broken', error: `读取失败：${errorText(error)}` }
  }
  if (raw.trim() === '') return { kind: 'broken', error: '文件是空的', quarantined: await quarantine(file) }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    return { kind: 'broken', error: `不是合法 JSON：${errorText(error)}`, quarantined: await quarantine(file) }
  }
  const book = sanitizeBook(parsed)
  if (book === undefined) {
    return {
      kind: 'broken',
      error: '结构认不出（既不是 categories 也不是平铺 prompts）',
      quarantined: await quarantine(file),
    }
  }
  return { kind: 'ok', book }
}

/** 拿写锁：`<file>.lock` 用 `wx` 独占创建，拿到才算进入临界区。 */
async function acquireLock(file: string): Promise<() => Promise<void>> {
  const lock = `${file}.lock`
  for (let attempt = 0; attempt < LOCK_RETRY_MAX; attempt += 1) {
    try {
      const handle = await open(lock, 'wx', 0o600)
      await handle.close()
      return async () => { try { await unlink(lock) } catch { /* 已被释放 */ } }
    } catch (error) {
      if (!hasCode(error, 'EEXIST')) throw error
      // 遗留锁不自动抢占：锁的新旧无法区分「崩溃的所有者」与「只是被暂停的写者」，
      // 所以只把处置办法说清楚，交给操作者。
      let ageMs: number | undefined
      try {
        const info = await open(lock, 'r')
        try {
          const stat = await info.stat()
          ageMs = Date.now() - stat.mtimeMs
        } finally {
          await info.close()
        }
      } catch { /* 锁刚好被释放，下一轮重试 */ }
      if (ageMs !== undefined && ageMs > LOCK_STALE_MS) {
        throw new Error(
          `写入锁 ${lock} 已存在 ${Math.round(ageMs / 1000)} 秒，像是上次写入崩溃留下的；`
          + '确认没有正在运行的 DSH 后删除它再重试',
        )
      }
      await delay(LOCK_RETRY_MS)
    }
  }
  throw new Error(`另一个进程正在写入 ${file}（等待 ${String((LOCK_RETRY_MS * LOCK_RETRY_MAX) / 1000)} 秒仍未拿到锁）`)
}

/**
 * 原子写：临时文件 → fsync → rename。
 * @param book 待写入的本（写前仍会收窄一次）。
 * @param file 目标路径。
 */
export async function writeQuickBook(book: QuickPromptBook, file: string = quickStorePath()): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  const release = await acquireLock(file)
  try {
    await writeLocked(book, file)
  } finally {
    await release()
  }
}

/** 真正的写入动作；调用方必须已经持锁。 */
async function writeLocked(book: QuickPromptBook, file: string): Promise<void> {
  const safe = sanitizeBook(book) ?? { version: QUICK_BOOK_VERSION, categories: [] }
  const tmp = `${file}.${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.tmp`
  const handle = await open(tmp, 'w', 0o600)
  try {
    await handle.writeFile(`${JSON.stringify(bookToFile(safe), null, 2)}\n`, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  // 同目录 rename 是原子的：并发读者要么看到旧文件、要么看到新文件，不会看到半截。
  await rename(tmp, file)
}

/**
 * 取当前这本；文件不存在时做一次迁移。
 *
 * @param seed settings 里旧的平铺列表（0.2.x 的 `quickPrompts`）；缺失或为空则用内置 9 条。
 * @param file 文件路径。
 * @returns 读盘结果（迁移成功后为 `ok`）。
 */
export async function ensureQuickBook(
  seed: readonly unknown[] | undefined,
  file: string = quickStorePath(),
): Promise<ReadOutcome> {
  const current = await readQuickBook(file)
  if (current.kind !== 'missing') return current

  // 「文件不存在」是一个需要**复核**的判断：并发请求可能同时看到缺失，如果各自
  // 就地初始化，后到的那个会把先到的用户数据覆盖成默认本。所以在写锁里再读一次，
  // 只有仍然缺失才初始化。
  await mkdir(dirname(file), { recursive: true })
  const release = await acquireLock(file)
  try {
    const again = await readQuickBook(file)
    if (again.kind !== 'missing') return again
    const migrated = seed === undefined ? undefined : sanitizeBook({ prompts: seed })
    const book = migrated !== undefined && migrated.categories.length > 0 ? migrated : defaultQuickBook()
    await writeLocked(book, file)
    return { kind: 'ok', book }
  } finally {
    await release()
  }
}
