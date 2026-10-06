/**
 * 宿主侧发送器（0.17.0）：一次调用完成"该不该发 → 构造请求 → 发出去 → 看懂回话"。
 *
 * 为什么把网络**注入**进来：这一层要能被真的跑起来测（假 fetcher 记下请求形状与返回的
 * 失败原因），而不是靠肉眼。真机上只有一次请求，出错时必须把渠道给的原因**原样**带回来 ——
 * 用户在设置页看到的就是那一句，所以我不能把它换成"发送失败"这种没信息量的话。
 *
 * 红线：凭据只进请求体，**不进日志、不进返回的原因**（原因来自渠道回话，且经渠道自己说明）。
 */
import {
  buildNotifyRequest, interpretNotifyResponse, notifyAllowed, notifySuppressed, redactSecret,
  type NotifyEvent, type NotifySettings,
} from './notify.ts'

/** 一次发送的结果。 */
export interface NotifyOutcome {
  /** 真的发出去了（渠道也认了）。 */
  readonly sent: boolean
  /** 为什么没发 / 为什么失败；成功时是空串。 */
  readonly reason: string
}

/** 注入面。 */
export interface NotifyIo {
  /** 发一次 HTTP；返回状态码与正文。 */
  readonly fetchText: (url: string, init: {
    readonly method: 'POST'
    readonly headers: Readonly<Record<string, string>>
    readonly body: string
  }) => Promise<{ readonly status: number, readonly body: string }>
  /** 上一次发送时间表（`会话|分类` → 毫秒）；调用方持有，便于跨事件复用。 */
  readonly lastSent: Record<string, number>
  /** 当前时间（注入便于测试）。 */
  readonly now?: () => number
}

/**
 * 发一条通知。
 * @param settings 通知设置。
 * @param event 事件。
 * @param io 注入面。
 * @returns 是否发出、以及没发/失败的原因（可直接显示给用户，不含凭据）。
 */
export async function sendNotification(
  settings: NotifySettings,
  event: NotifyEvent,
  io: NotifyIo,
): Promise<NotifyOutcome> {
  const now = io.now?.() ?? Date.now()
  if (!notifyAllowed(settings, event.kind)) {
    // 分开说清"为什么没发"，否则用户会以为功能坏了：
    // 总开关关 / 这一类关 / 凭据没填，是三种完全不同的处置。
    if (!settings.enabled) return { sent: false, reason: '通知总开关是关的' }
    if (settings.kinds[event.kind] !== true) return { sent: false, reason: '这一类事件你没开' }
    const field = settings.channel === 'pushplus' ? 'PushPlus token' : '企业微信 webhook'
    return { sent: false, reason: `没填 ${field}（现在填的值：${redactSecret(settings.channel === 'pushplus' ? settings.pushplusToken : settings.wecomWebhook) || '空'}）` }
  }
  if (notifySuppressed(io.lastSent, event, now)) {
    return { sent: false, reason: '同类通知 30 秒内已发过一条（防刷屏）' }
  }

  const request = buildNotifyRequest(settings, event, new Date(now))
  if (request === null) return { sent: false, reason: '配置不完整，没有可发的请求' }

  // 先记账再发：发送失败时也不该在 30 秒内立刻重试同一类（否则一次故障会刷屏）。
  io.lastSent[`${event.sessionTitle}|${event.kind}`] = now
  let response: { status: number, body: string }
  try {
    response = await io.fetchText(request.url, { method: 'POST', headers: request.headers, body: request.body })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { sent: false, reason: `连不上渠道：${message}` }
  }
  const problem = interpretNotifyResponse(settings.channel, response.status, response.body)
  return problem === '' ? { sent: true, reason: '' } : { sent: false, reason: problem }
}

/** 测试推送用的事件（用户在设置页点「测试推送」时发的那条）。 */
export const NOTIFY_TEST_EVENT: NotifyEvent = {
  kind: 'done',
  sessionTitle: '',
  detail: '这是一条测试推送 —— 看到它说明配置生效了',
}

/**
 * 「测试推送」：**绕过防刷屏与分类开关**，但仍然要求总开关开着、凭据填了。
 *
 * 为什么要单独一条路：测试推送的用途是"验证配置对不对"，如果被"这一类没开"或
 * "30 秒内已发过"挡回去，用户看到的是一句拒绝 —— 他会以为功能坏了，其实是闸门在正常工作。
 * 但它**不应该**写进 `lastSent`：否则一次测试会把紧接着的真实通知压掉。
 * @param settings 通知设置。
 * @param io 注入面（只用它的 `fetchText`）。
 * @returns 与真实发送同样的结果形状。
 */
export async function sendTestNotification(
  settings: NotifySettings,
  io: Pick<NotifyIo, 'fetchText'>,
): Promise<NotifyOutcome> {
  if (!settings.enabled) return { sent: false, reason: '通知总开关是关的（打开它再点测试推送）' }
  const field = settings.channel === 'pushplus' ? 'PushPlus token' : '企业微信 webhook'
  const credential = settings.channel === 'pushplus' ? settings.pushplusToken : settings.wecomWebhook
  if (credential.trim() === '') return { sent: false, reason: `还没填 ${field}` }
  const request = buildNotifyRequest(settings, NOTIFY_TEST_EVENT, new Date())
  if (request === null) return { sent: false, reason: '配置不完整，没有可发的请求' }
  let response: { status: number, body: string }
  try {
    response = await io.fetchText(request.url, { method: 'POST', headers: request.headers, body: request.body })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { sent: false, reason: `连不上渠道：${message}` }
  }
  const problem = interpretNotifyResponse(settings.channel, response.status, response.body)
  return problem === '' ? { sent: true, reason: '' } : { sent: false, reason: problem }
}
