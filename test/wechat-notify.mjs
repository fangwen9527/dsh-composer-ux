/**
 * 单向微信通知（0.17.0）的核心逻辑测试。
 *
 * 为什么单独一套：`src/notify.ts` 是纯的、能真跑 —— 消息正文、请求形状、成败判定、合并窗口、
 * 凭据打码全在这里被钉住。真正的"消息到没到手机"只能由用户点「测试推送」验（README 里标注待验收）。
 */
import { build } from 'esbuild'

const bundled = await build({
  bundle: true, write: false, format: 'esm', platform: 'node', target: ['es2022'], logLevel: 'warning',
  stdin: {
    contents: [
      "export { NOTIFY_DEDUPE_MS, PUSHPLUS_ENDPOINT, buildNotifyRequest, interpretNotifyResponse, notifyAllowed, notifySuppressed, notifyText, redactSecret } from './src/notify.ts'",
      "export { NOTIFY_DETAIL_MAX, describeError, notifyForAgentError, notifyForApproval, notifyForQuestion, notifyForStatus, summarize } from './src/notify-events.ts'",
    ].join('\n'),
    resolveDir: process.cwd(), loader: 'ts',
  },
})
const pure = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)

let passes = 0
let failures = 0
function check(label, ok, detail = '') {
  if (ok) { passes += 1; console.log(`  ✓ ${label}`) } else { failures += 1; console.log(`  ✗ ${label}${detail === '' ? '' : ` — ${detail}`}`) }
}

const settings = over => ({
  enabled: true,
  channel: 'pushplus',
  pushplusToken: 'abcdef1234567890',
  wecomWebhook: '',
  kinds: { 'needs-input': true, done: true, error: true },
  ...over,
})
const event = over => ({ kind: 'done', sessionTitle: '测试与问答需求确认', detail: '3 个套件通过', ...over })
const at = new Date(2026, 9, 1, 21, 36)

// ── 凭据打码（红线：token 不许出现在界面/日志里）────────────────────────────
check('打码只留头 4 尾 2', pure.redactSecret('abcdef1234567890') === 'abcd…90')
check('太短就整个打掉', pure.redactSecret('short') === '****')
check('空串还是空串', pure.redactSecret('') === '')
check('打码后看不到中段', !pure.redactSecret('abcdef1234567890').includes('ef1234'))

// ── 该不该发 ────────────────────────────────────────────────────────────────
check('总开关关 ⇒ 一律不发', pure.notifyAllowed(settings({ enabled: false }), 'done') === false)
check('分类开关关 ⇒ 那一类不发', pure.notifyAllowed(settings({ kinds: { 'needs-input': true, done: false, error: true } }), 'done') === false)
check('PushPlus 没填 token ⇒ 不发（不是发个空 token 出去）', pure.notifyAllowed(settings({ pushplusToken: '  ' }), 'done') === false)
check('企业微信没填 webhook ⇒ 不发', pure.notifyAllowed(settings({ channel: 'wecom', wecomWebhook: '' }), 'done') === false)
check('配置齐全 ⇒ 发', pure.notifyAllowed(settings(), 'done') === true)

// ── 防刷屏：30 秒内同会话同类合并 ────────────────────────────────────────────
const last = { '测试与问答需求确认|done': 1_000_000 }
check('30 秒内同会话同类 ⇒ 压掉', pure.notifySuppressed(last, event(), 1_000_000 + 29_999) === true)
check('超过 30 秒 ⇒ 放行', pure.notifySuppressed(last, event(), 1_000_000 + pure.NOTIFY_DEDUPE_MS) === false)
check('❗别的会话完成不被牵连（不全局静音）',
  pure.notifySuppressed(last, event({ sessionTitle: '另一个会话' }), 1_000_000 + 1) === false)
check('❗同会话但不同类（完成 vs 出错）也放行',
  pure.notifySuppressed(last, event({ kind: 'error' }), 1_000_000 + 1) === false)

// ── 消息正文 ────────────────────────────────────────────────────────────────
const text = pure.notifyText(event({ kind: 'needs-input', detail: '等你批准执行命令' }), at)
check('正文带事件标题、会话、详情、时间', text.includes('DSH 需要你回应')
  && text.includes('会话：测试与问答需求确认') && text.includes('等你批准执行命令') && text.includes('21:36'))
check('❗正文里明说只能通知不能回（不暗示双向）',
  text.includes('只能通知，不能回'))
check('拿不到会话标题就不留空行', !pure.notifyText(event({ sessionTitle: '' }), at).includes('会话：'))

// ── 请求形状：PushPlus ──────────────────────────────────────────────────────
{
  const built = pure.buildNotifyRequest(settings(), event(), at)
  const body = JSON.parse(built.body)
  check('PushPlus 打到官方地址', built.url === pure.PUSHPLUS_ENDPOINT && built.url === 'https://www.pushplus.plus/send')
  check('PushPlus body 带 token / title / content / template=txt',
    body.token === 'abcdef1234567890' && body.title === 'DSH 任务完成'
    && body.content.includes('DSH 任务完成') && body.template === 'txt')
  check('PushPlus 带 json content-type', built.headers['content-type'] === 'application/json')
}

// ── 请求形状：企业微信 ──────────────────────────────────────────────────────
{
  const hook = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abc'
  const built = pure.buildNotifyRequest(settings({ channel: 'wecom', wecomWebhook: hook }), event({ kind: 'error', detail: '模型调用失败' }), at)
  const body = JSON.parse(built.body)
  check('企业微信打到用户填的 webhook', built.url === hook)
  check('企业微信 body 是 msgtype=text + content',
    body.msgtype === 'text' && body.text.content.includes('DSH 任务出错') && body.text.content.includes('模型调用失败'))
}

// ── 空凭据不构造请求 ────────────────────────────────────────────────────────
check('PushPlus 空 token ⇒ 不构造请求', pure.buildNotifyRequest(settings({ pushplusToken: '' }), event(), at) === null)
check('企业微信空 webhook ⇒ 不构造请求',
  pure.buildNotifyRequest(settings({ channel: 'wecom', wecomWebhook: ' ' }), event(), at) === null)

// ── 看懂回话：两个渠道都用 200 表示"收到"，成败在 body 里 ───────────────────
check('PushPlus code=200 ⇒ 成功', pure.interpretNotifyResponse('pushplus', 200, '{"code":200,"msg":"请求成功"}') === '')
check('❗PushPlus HTTP 200 但 code!=200 ⇒ 必须报错（否则"token 无效"会被当成发送成功）',
  pure.interpretNotifyResponse('pushplus', 200, '{"code":903,"msg":"token无效"}').includes('token无效'))
check('企业微信 errcode=0 ⇒ 成功', pure.interpretNotifyResponse('wecom', 200, '{"errcode":0,"errmsg":"ok"}') === '')
check('企业微信 errcode!=0 ⇒ 报错并带原因',
  pure.interpretNotifyResponse('wecom', 200, '{"errcode":93000,"errmsg":"invalid webhook url"}').includes('invalid webhook url'))
check('HTTP 500 ⇒ 报 HTTP 码', pure.interpretNotifyResponse('pushplus', 500, '') === 'HTTP 500')
check('响应不是 JSON ⇒ 提示地址可能填错',
  pure.interpretNotifyResponse('wecom', 200, '<html>404</html>').includes('不是 JSON'))
check('❗错误信息里不含凭据本身（不会把 token 回显出去）',
  !pure.interpretNotifyResponse('pushplus', 200, '{"code":1,"msg":"bad"}').includes('abcdef1234567890'))

// ── 官方事件 → 微信消息的适配层（0.17.0）────────────────────────────────────
check(`摘要去掉换行并截断到 ${pure.NOTIFY_DETAIL_MAX} 字`,
  pure.summarize('a\n\nb'.padEnd(300, 'x')).length === pure.NOTIFY_DETAIL_MAX)
check('error 是对象就取 message', pure.describeError(new Error('模型调用失败')) === '模型调用失败')
check('error 形状陌生也不抛（给中性文案）', pure.describeError({ weird: 1 }) === '原因未知（error 不是常见形状）')
check('error 是 undefined 也给一句人话', pure.describeError(undefined).includes('原因未知'))
check('审批 → needs-input，并明说回界面处理',
  pure.notifyForApproval('会话 A', 'Bash').kind === 'needs-input'
  && pure.notifyForApproval('会话 A', 'Bash').detail.includes('Bash')
  && pure.notifyForApproval('会话 A', 'Bash').detail.includes('回 DSH 界面处理'))
check('提问 → needs-input（拿不到问题正文也给中性文案）',
  pure.notifyForQuestion('会话 A', undefined).kind === 'needs-input'
  && pure.notifyForQuestion('会话 A', undefined).detail.includes('回 DSH 界面处理'))
check('❗只有 running→idle 才算「完成」（开始干活不通知）',
  pure.notifyForStatus('idle', 'running', 'A') === null
  && pure.notifyForStatus(undefined, 'idle', 'A') === null
  && pure.notifyForStatus('running', 'idle', 'A')?.kind === 'done')
check('❗反复 idle→idle 不发（防刷屏的第一道）', pure.notifyForStatus('idle', 'idle', 'A') === null)
check('出错 → error，且摘要里带原因',
  pure.notifyForAgentError('会话 A', 'unexpected end').kind === 'error'
  && pure.notifyForAgentError('会话 A', 'unexpected end').detail.includes('unexpected end'))

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
