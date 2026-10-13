/**
 * 启动期写的退避重试（0.20.0 引入，0.22.0 抽成共享模块）。
 *
 * 为什么需要：插件 `apply` 时宿主**自己也在写这个 profile**（注册插件行会动 profile 清单），
 * 两边的原子写锁会撞上。2026-10-10 在 0.2.1-alpha.2 上撞掉过「快捷指令」迁移；
 * 2026-10-13 真机又在同一处撞掉了「终端状态写入」—— 两次都是"日志里一句、功能静默降级"。
 * 所以规矩是：**凡是启动期（或迁移期）的写，都走这里**。
 *
 * @param write - 要做的那次写。
 * @param attempts - 最多试几次（含第一次）。
 * @param baseDelayMs - 退避基数；第 n 次失败后等 `baseDelayMs * n`。
 * @returns 第一次成功就 resolve；全部失败则抛出最后一次的错误。
 */
export async function retryWrite(write: () => Promise<void>, attempts: number, baseDelayMs: number): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await write()
      return
    } catch (error: unknown) {
      if (attempt === attempts) throw error
      await new Promise(resolve => setTimeout(resolve, baseDelayMs * attempt))
    }
  }
}

/** 启动期写默认试几次。 */
export const STARTUP_WRITE_ATTEMPTS = 4
/** 启动期写的退避基数（毫秒）。 */
export const STARTUP_WRITE_RETRY_MS = 300
