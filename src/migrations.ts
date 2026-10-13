/**
 * 版本化的一次性配置迁移（0.22.0，借鉴 dsh-ops 的 `lib/config-updates.js`）。
 *
 * 为什么要有这张表：本插件以前的做法是"靠判据猜"——比如「快捷指令」那次是"文档里有没有
 * `quickEnabled` 这个键"。判据写在业务代码里，加第二条迁移时就得再想一遍"怎么区分
 * 没跑过 / 跑过了 / 用户后来又改回来了"，很容易写成"每次启动都覆盖用户的显式选择"。
 *
 * 现在统一成：**每条迁移一行、带一个版本号字段**；跑成功就把版本号写进本插件自己的命名空间。
 * 于是三件事都变得显然：
 *   · 只会跑一次（版本号 ≥ 目标版本 ⇒ 跳过）；
 *   · 跑失败的**不写标记**，下次启动自动重来（不静默漏掉）；
 *   · 用户之后手动改回去的值不会被覆盖（迁移不再跑）。
 *
 * ⚠️ 只写**本插件自己的命名空间**。迁移不许改用户其它插件的配置 —— 那条纪律是有代价换来的
 * （见 `host.ts` 里请求头那条链的注释：0.21.x 及以前真的往用户模型路由配置里写过东西）。
 */

/** 一条迁移的元数据（不含动作，动作由调用方按 version 分派，便于逐条测试）。 */
export interface MigrationRow {
  /** 目标版本；标记值 ≥ 它即为已完成。 */
  readonly version: number
  /** 记录在本插件命名空间里的字段名。 */
  readonly field: string
  /** 人话说明（进日志与设置页的自检报告）。 */
  readonly label: string
}

/** 迁移表：新迁移追加在末尾，version 递增。 */
export const MIGRATIONS: readonly MigrationRow[] = [
  {
    version: 1,
    field: 'headerCleanupVersion',
    label: '清理 0.21.x 及以前写进用户模型路由配置里的请求头（改成运行期覆盖后不再需要落盘）',
  },
]

/** 读一个迁移当前的进度（字段缺失 / 不是数字 ⇒ 0 = 没跑过）。 */
export function migrationVersionOf(own: Record<string, unknown> | undefined, field: string): number {
  const value = own === undefined ? undefined : own[field]
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

/**
 * 列出还没跑完的迁移（按 version 升序）。
 *
 * @param own - 本插件命名空间下的原始行。
 * @param rows - 迁移表（默认 {@link MIGRATIONS}；测试注入用）。
 * @returns 需要跑的行；空数组 = 全跑完了。
 */
export function pendingMigrations(
  own: Record<string, unknown> | undefined,
  rows: readonly MigrationRow[] = MIGRATIONS,
): readonly MigrationRow[] {
  return rows
    .filter(row => migrationVersionOf(own, row.field) < row.version)
    .slice()
    .sort((left, right) => left.version - right.version)
}
