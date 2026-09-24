/**
 * 孤儿写入锁的回收。
 *
 * 背景（2026-09-23 真机事故，两个进程各留一把）：
 * DSH 的 `atomic-write` 用 `<file>.lock`（`wx` 独占创建 + 内含持有者 PID）串行化
 * **跨进程**写入，对争议方的规定是「**绝不删除已存在的锁**，锁的年龄证明不了持有者
 * 已经停下；孤儿锁属于操作者动作」。而设置页写入用的那把锁是
 * `<profile>/package.json.lock`（`configEditor.edit` 对 profile 的 `package.json` 加锁）。
 *
 * 于是只要有一次硬杀（例如 `restart-webui.bat` 的 `taskkill /T /F`）正好落在一次
 * 设置写入中间，锁就永远留在磁盘上 —— 后果不是"某次写入失败"，而是：
 * **该 profile 此后每一次设置写入都在 2 秒后超时**，界面上只表现为"点了没反应"，
 * 连一句报错都没有（读路径不受影响，因为读是不加锁的）。
 *
 * 这里做的正是文档交给操作者的那一步，但把判据收紧到**能证明持有者已经不存在**：
 *   · 锁内容必须是一个正整数 PID（认不出来就绝不动手）；
 *   · 该 PID 必须确认不存在（活着、或权限不足无法判定 → 保持不动）。
 * 取"活着/不可判定就保留"这个方向：宁可不回收（用户按文档手工删），也不误删一把
 * 正被持有的锁——误删会让两个写入者交错提交。
 */

import { readFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'

/** 设置写入用的锁文件名（`configEditor` 加锁的对象是 profile 的 `package.json`）。 */
export const SETTINGS_LOCK_FILENAME = 'package.json.lock'

/** 对一把锁的处置结论。 */
export type StaleLockDecision =
  | { readonly action: 'remove'; readonly pid: number }
  | { readonly action: 'keep'; readonly pid: number }
  | { readonly action: 'ignore'; readonly reason: 'unreadable-holder' }

/** 回收结果（也是测试的断言点）。 */
export type LockRecovery = 'removed' | 'kept' | 'absent' | 'ignored'

/**
 * 纯决策：给锁文件内容与"PID 是否存活"的判据，得出该不该回收。
 *
 * 抽成纯函数是为了能在 node 里逐条钉死——**误删一把活锁**的代价（两个写入者交错
 * 提交同一个 profile patch）比"没删掉"大得多，所以这个判据必须有护栏。
 * @param content 锁文件原文（正常是 `<pid>\n`）。
 * @param alive PID 存活判据（注入以便测试；真机传 {@link isProcessAlive}）。
 * @returns 该锁的处置结论。
 */
export function staleLockDecision(content: string, alive: (pid: number) => boolean): StaleLockDecision {
  const text = content.trim()
  // 只认纯十进制正整数：多一行、带注释、空文件一律当作"认不出来"，保持不动。
  if (!/^[1-9][0-9]{0,9}$/.test(text)) return { action: 'ignore', reason: 'unreadable-holder' }
  const pid = Number(text)
  return alive(pid) ? { action: 'keep', pid } : { action: 'remove', pid }
}

/**
 * PID 是否仍存在。
 *
 * `process.kill(pid, 0)` 只做存在性探测（Windows 上由 libuv 走 OpenProcess）：
 * `ESRCH` = 不存在；`EPERM` = 存在但无权操作——**后者按"活着"处理**，因为
 * "无权判定"绝不能退化成"可以删"。
 * @param pid 待探测的进程号。
 * @returns 是否仍存在（或无法排除存在）。
 */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException | null)?.code === 'EPERM'
  }
}

/**
 * profile patch 路径 → profile 目录（`configEditor.documentPath` 的父目录）。
 * @param patchPath profile 的 `cordis.patch.yml` 绝对路径。
 * @returns 该 profile 的目录。
 */
export function profileDirOfPatchPath(patchPath: string): string {
  return dirname(patchPath)
}

/**
 * 检查并回收孤儿锁；任何失败都只记录、绝不抛出（它是启动路径上的旁路动作）。
 * @param profileDir profile 目录（`package.json` 与锁都在这里）。
 * @param log 记录一行结果（调用方接 console）。
 * @returns 处置结果。
 */
export async function recoverStaleSettingsLock(
  profileDir: string,
  log: (message: string) => void,
): Promise<LockRecovery> {
  const path = join(profileDir, SETTINGS_LOCK_FILENAME)
  let content: string
  try {
    content = await readFile(path, 'utf8')
  } catch (error) {
    // 没有锁是常态（锁只在写入的那几毫秒里存在）。
    if ((error as NodeJS.ErrnoException | null)?.code === 'ENOENT') return 'absent'
    log(`读取写入锁失败（${path}）：${String(error)}`)
    return 'ignored'
  }
  const decision = staleLockDecision(content, isProcessAlive)
  if (decision.action === 'keep') {
    log(`写入锁由 PID ${decision.pid} 持有且该进程仍在，保持不动（${path}）。`)
    return 'kept'
  }
  if (decision.action === 'ignore') {
    log(`写入锁内容不是 PID，保持不动（${path}）。`)
    return 'ignored'
  }
  try {
    await rm(path, { force: true })
  } catch (error) {
    log(`回收孤儿写入锁失败（${path}）：${String(error)}`)
    return 'ignored'
  }
  log(
    `已回收孤儿写入锁（持有者 PID ${decision.pid} 不存在）：${path}。`
    + '在此之前该 profile 的每一次设置写入都会超时失败（界面表现为"点了没反应"）。',
  )
  return 'removed'
}
