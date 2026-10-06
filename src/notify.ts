/**
 * 单向微信通知（0.17.0，用户 2026-10-01 明确：**只要通知、不做双向**）。
 *
 * 为什么不用 OpenClaw：用户的诉求是"DSH 干完活通知我一声"。双向（能在微信里回）目前只有
 * OpenClaw/ClawBot 那条路，而单向通知**不需要任何中间层** —— 现成的微信推送服务都是一次
 * HTTP POST。所以这里只做单向，并且在界面上明说"只能通知、不能回"。
 *
 * 本模块是**纯的**：只负责"算出要发什么请求"和"看懂回什么"，网络由宿主注入。
 * 这样它能被真的跑起来测（仓库里那条纪律：能跑就别只查字符串）。
 *
 * 两个渠道（用户二选一）：
 *   · PushPlus —— POST https://www.pushplus.plus/send，token 推到你关注的公众号对话；
 *   · 企业微信群机器人 —— POST 你的 webhook 地址，消息进那个群。
 */

/** 触发通知的三件事（照 dsh-messager 那套）。 */
export type NotifyKind = 'needs-input' | 'done' | 'error'

/** 渠道。 */
export type NotifyChannel = 'pushplus' | 'wecom'

/** 通知设置（只存本机；凭据绝不回显）。 */
export interface NotifySettings {
  /** 总开关（默认关：不打招呼就联网推送是越界）。 */
  readonly enabled: boolean
  readonly channel: NotifyChannel
  /** PushPlus 的 token。 */
  readonly pushplusToken: string
  /** 企业微信群机器人 webhook 地址。 */
  readonly wecomWebhook: string
  /** 哪些事件要推。 */
  readonly kinds: Readonly<Record<NotifyKind, boolean>>
}

/** 一条通知事件（宿主侧拼好传进来）。 */
export interface NotifyEvent {
  readonly kind: NotifyKind
  /** 会话标题（拿不到就空串，消息里会省略这一行）。 */
  readonly sessionTitle: string
  /** 一句话摘要：等什么、做完了什么、错在哪。 */
  readonly detail: string
}

/** 要发出去的一次 HTTP 请求（宿主照它发）。 */
export interface NotifyRequest {
  readonly url: string
  readonly headers: Readonly<Record<string, string>>
  readonly body: string
}

/** 同类事件在这个窗口内合并（防刷屏）。 */
export const NOTIFY_DEDUPE_MS = 30_000

/** PushPlus 的接口地址。 */
export const PUSHPLUS_ENDPOINT = 'https://www.pushplus.plus/send'

/** 每个事件的中文标题。 */
const KIND_TITLE: Readonly<Record<NotifyKind, string>> = {
  'needs-input': 'DSH 需要你回应',
  done: 'DSH 任务完成',
  error: 'DSH 任务出错',
}

/**
 * 凭据打码。
 *
 * 为什么要它：错误信息、日志、界面提示都可能带出用户填的 token/webhook —— 那是能直接
 * 冒充他发消息的东西。规则：只留头 4 位与尾 2 位，短于 8 位就整个打掉。
 * @param value 原始凭据。
 * @returns 可安全显示/落盘的形式。
 */
export function redactSecret(value: string): string {
  if (value === '') return ''
  if (value.length < 8) return '****'
  return `${value.slice(0, 4)}…${value.slice(-2)}`
}

/** 这个事件该不该发（开关 + 分类开关 + 凭据齐不齐）。 */
export function notifyAllowed(settings: NotifySettings, kind: NotifyKind): boolean {
  if (!settings.enabled) return false
  if (settings.kinds[kind] !== true) return false
  if (settings.channel === 'pushplus') return settings.pushplusToken.trim() !== ''
  return settings.wecomWebhook.trim() !== ''
}

/**
 * 同会话同类事件是否还在合并窗口里（30 秒内只发一条）。
 *
 * 为什么按"会话 + 分类"分桶：长任务会在几十秒里连续报好几次错，但"另一个会话完成了"
 * 是你确实想立刻知道的事 —— 一刀切地全局静音会把后者也吞掉。
 * @param last 上一次发送时间（`会话标题|分类` → 毫秒）。
 * @param event 这次的事件。
 * @param now 当前时间。
 * @returns true = 该压掉。
 */
export function notifySuppressed(
  last: Readonly<Record<string, number>>,
  event: NotifyEvent,
  now = Date.now(),
): boolean {
  const key = `${event.sessionTitle}|${event.kind}`
  const previous = last[key]
  if (previous === undefined) return false
  return now - previous < NOTIFY_DEDUPE_MS
}

/**
 * 消息正文（纯文本，两个渠道都能显示）。
 * @param event 事件。
 * @param at 时间（注入便于测试）。
 * @returns 形如「DSH 任务完成\n会话：… \n详情…\n21:36 · 只能通知，不能回」。
 */
export function notifyText(event: NotifyEvent, at: Date): string {
  const clock = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
  const lines = [KIND_TITLE[event.kind]]
  if (event.sessionTitle !== '') lines.push(`会话：${event.sessionTitle}`)
  if (event.detail !== '') lines.push(event.detail)
  lines.push(`${clock} · 只能通知，不能回（要处理请回 DSH 界面）`)
  return lines.join('\n')
}

/**
 * 算出发给渠道的那一次请求。
 * @param settings 通知设置（必须是 `notifyAllowed` 放行的状态）。
 * @param event 事件。
 * @param at 时间。
 * @returns 请求；设置不完整时返回 null（调用方据此不发送）。
 */
export function buildNotifyRequest(
  settings: NotifySettings,
  event: NotifyEvent,
  at: Date = new Date(),
): NotifyRequest | null {
  const title = KIND_TITLE[event.kind]
  const content = notifyText(event, at)
  if (settings.channel === 'pushplus') {
    const token = settings.pushplusToken.trim()
    if (token === '') return null
    return {
      url: PUSHPLUS_ENDPOINT,
      headers: { 'content-type': 'application/json' },
      // topic 不传：推给该 token 绑定的人（用户自己关注的公众号对话）。
      body: JSON.stringify({ token, title, content, template: 'txt' }),
    }
  }
  const webhook = settings.wecomWebhook.trim()
  if (webhook === '') return null
  return {
    url: webhook,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ msgtype: 'text', text: { content: `${title}\n${content}` } }),
  }
}

/**
 * 看懂渠道的回话。
 *
 * 两个渠道都**用 200 表示"收到了"**，真正的成败在 body 里：PushPlus 看 `code === 200`，
 * 企业微信看 `errcode === 0`。忽略这点会把"token 无效"当成发送成功。
 * @param channel 渠道。
 * @param status HTTP 状态码。
 * @param body 响应正文（原样文本）。
 * @returns 空串 = 成功；否则是给用户看的原因（已打码，不含凭据）。
 */
export function interpretNotifyResponse(channel: NotifyChannel, status: number, body: string): string {
  if (status < 200 || status >= 300) return `HTTP ${String(status)}`
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return '响应不是 JSON（渠道地址可能填错了）'
  }
  const doc = parsed as { code?: unknown, msg?: unknown, errcode?: unknown, errmsg?: unknown }
  if (channel === 'pushplus') {
    if (doc.code === 200) return ''
    const reason = typeof doc.msg === 'string' && doc.msg !== '' ? doc.msg : '未知原因'
    return `PushPlus 拒绝：${reason}`
  }
  if (doc.errcode === 0) return ''
  const reason = typeof doc.errmsg === 'string' && doc.errmsg !== '' ? doc.errmsg : '未知原因'
  return `企业微信拒绝：${reason}`
}
