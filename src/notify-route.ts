/**
 * 「测试推送」的 HTTP 处理器（0.17.0）。
 *
 * 为什么把它做成**独立模块、设置从参数喂进来**：宿主里读设置走的是 DSH 的 settings 服务
 * （`host.ts` 里的 `settingsService()`），那条 API 我不想靠猜去接 —— 所以这里只要一个
 * `readSettings()` 函数，宿主那边怎么取数都行。处理器本身可以注入假 fetch 真跑测试。
 *
 * 与「重启」那条路由同一套防护：
 *   · 只认 POST（GET 拿不到任何东西，也不会触发发送）；
 *   · 必须带防跨站头（跨站页面加不了自定义头，这是桌面版与网页版共用的那道防线）；
 *   · 响应体只回 `{ ok, reason }`，reason 已打码 —— **绝不回显 token/webhook**。
 */
import { RESTART_CSRF_HEADER, RESTART_CSRF_VALUE } from './settings-contract.ts'
import { sendTestNotification, type NotifyIo } from './notify-send.ts'
import type { NotifySettings } from './notify.ts'

/** 请求/响应只看我们真正用到的部分（与重启路由同一风格）。 */
export interface NotifyRouteRequest {
  readonly method?: string
  readonly headers?: Readonly<Record<string, string | readonly string[] | undefined>>
}

/** 响应。 */
export interface NotifyRouteResponse {
  statusCode?: number
  writeHead: (code: number, headers: Record<string, string>) => void
  end: (body?: string) => void
}

/** 注入面。 */
export interface NotifyRouteIo {
  /** 读当前通知设置（宿主决定怎么读）。 */
  readonly readSettings: () => NotifySettings
  /** 发一次 HTTP（宿主注入；测试里传假的）。 */
  readonly fetchText: NotifyIo['fetchText']
}

/** 取一个头值（可能是数组）。 */
function firstHeader(value: string | readonly string[] | undefined): string {
  if (value === undefined) return ''
  return Array.isArray(value) ? String(value[0] ?? '') : String(value)
}

/**
 * 造出那条路由的处理器。
 * @param io 注入面。
 * @returns 一个 (req, res) → Promise<void> 的处理器。
 */
export function createNotifyTestHandler(
  io: NotifyRouteIo,
): (req: NotifyRouteRequest, res: NotifyRouteResponse) => Promise<void> {
  return async (req, res) => {
    const send = (code: number, payload: unknown): void => {
      res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(payload))
    }
    if (req.method !== 'POST') {
      send(405, { ok: false, reason: '测试推送要用 POST' })
      return
    }
    if (firstHeader(req.headers?.[RESTART_CSRF_HEADER]) !== RESTART_CSRF_VALUE) {
      send(403, { ok: false, reason: `缺少 ${RESTART_CSRF_HEADER}: ${RESTART_CSRF_VALUE} 头（跨站页面加不了这个头）` })
      return
    }
    let settings: NotifySettings
    try {
      settings = io.readSettings()
    } catch (error) {
      // 读设置都可能失败（服务还没起来 / 命名空间没注册）；这种情况直说，不要装作配置为空。
      send(500, { ok: false, reason: `读不到通知设置：${error instanceof Error ? error.message : String(error)}` })
      return
    }
    const outcome = await sendTestNotification(settings, { fetchText: io.fetchText })
    // 200 表示"这次请求处理完了"，成败看 ok —— 前端按 ok 显示绿/红，不靠 HTTP 码猜。
    send(200, { ok: outcome.sent, reason: outcome.reason })
  }
}
