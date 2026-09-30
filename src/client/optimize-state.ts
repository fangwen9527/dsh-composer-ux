/**
 * 结果框状态的**客户端**读写层（0.13.0 ①）。
 *
 * 浏览器没有文件系统，只能走宿主那条路由：`GET /composer-ux/optimize-state` 读上一轮、
 * `POST` 存这一轮。存的是**整份快照**（成品正文、条目、丢几条、档位路由、发起时的草稿），
 * 所以它跟 `quick-prompts.json` 同性质 —— 都是插件自己的状态文件。
 *
 * 三条失败语义：
 *  · 读失败/没有 → 返回 `state: null`（**不报错、不弹提示**：重启后没有可恢复的结果是正常状态）；
 *  · 写失败（含"状态太大"）→ 返回 `ok: false` 与原因，**不重试、不报错弹窗**（它只是让人方便一点的功能）；
 *  · 关掉开关（设置页 `optimizeKeepDock`）→ 宿主会拒写并删掉旧文件，这里如实回报。
 */
import { OPTIMIZE_STATE_API_PATH } from '../settings-contract.ts'
import { sanitizeDockSnapshot, type OptimizeDockState } from './optimize-dock.ts'

/** 路由应答（成功失败同一形状，便于统一处理）。 */
export interface DockStateReply {
  readonly ok: boolean
  /** 可恢复的状态（`null` = 没有 / 关掉了 / 认不出）。 */
  readonly state: OptimizeDockState | null
  /**
   * 结果框当时是**收起**的吗（0.13.2）。
   *
   * ✕ 从 0.13.2 起是「收起」而不是「丢弃」，这个标记要跟着状态一起跨重启 —— 否则重启后结果
   * 会自己弹回来，用户会以为 ✕ 没生效。
   */
  readonly hidden: boolean
  /** 宿主侧的开关当前是什么。 */
  readonly keep: boolean
  readonly file?: string
  readonly error?: string
  /** 原文件读不出来、已被隔离（非空说明原文件保住了）。 */
  readonly quarantined?: string
  /** 状态太大，宿主拒写（没截半）。 */
  readonly tooBig?: boolean
}

const textOf = (value: unknown): string | undefined => (typeof value === 'string' && value !== '' ? value : undefined)

async function request(method: 'GET' | 'POST', body?: unknown): Promise<DockStateReply> {
  try {
    const response = await fetch(OPTIMIZE_STATE_API_PATH, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const raw = await response.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return { ok: false, state: null, hidden: false, keep: true, error: `服务端返回的不是 JSON（HTTP ${String(response.status)}）` }
    }
    const row = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as Record<string, unknown>
    return {
      ok: row.ok === true,
      state: sanitizeDockSnapshot(row.state),
      hidden: row.hidden === true,
      keep: row.keep !== false,
      ...(textOf(row.file) === undefined ? {} : { file: textOf(row.file) }),
      ...(textOf(row.error) === undefined ? {} : { error: textOf(row.error) }),
      ...(textOf(row.quarantined) === undefined ? {} : { quarantined: textOf(row.quarantined) }),
      ...(row.tooBig === true ? { tooBig: true } : {}),
    }
  } catch (error: unknown) {
    return { ok: false, state: null, hidden: false, keep: true, error: error instanceof Error ? error.message : String(error) }
  }
}

/** 读上一轮结果框（没有就 `state: null`）。 */
export function loadDockState(): Promise<DockStateReply> {
  return request('GET')
}

/**
 * 存这一轮结果框；`null` = 清掉那份状态。
 *
 * @param state - 结果框状态（`null` = 清空）。
 * @param hidden - 是否处于「收起」（0.13.2）。缺省 false = 显示中，与旧版语义一致。
 */
export function saveDockState(state: OptimizeDockState | null, hidden = false): Promise<DockStateReply> {
  return request('POST', { state, hidden: hidden === true })
}

/** 清空（设置页「清空结果框状态」用）。 */
export function clearDockStateOnHost(): Promise<DockStateReply> {
  return saveDockState(null)
}
