/**
 * 宿主侧发送器的测试（0.17.0）。
 *
 * 用假 fetcher 真跑：它必须证明四件事 ——
 *   1. **四种"没发出去"的原因要分开说**（总开关关 / 这一类关 / 凭据没填 / 防刷屏），
 *      否则用户只会看到"没反应"，以为功能坏了；
 *   2. **先记账再发**：渠道故障时也不在 30 秒内重试同类（一次故障不该刷屏）；
 *   3. **渠道给的原因原样带回**（用户看到的必须是「token无效」这种真话）；
 *   4. **测试推送绕过防刷屏与分类开关，但不写记账**（否则一次测试会压掉后面真实的通知）。
 */
import { build } from 'esbuild'

const bundled = await build({
  bundle: true, write: false, format: 'esm', platform: 'node', target: ['es2022'], logLevel: 'warning',
  stdin: {
    contents: "export { NOTIFY_TEST_EVENT, sendNotification, sendTestNotification } from './src/notify-send.ts'\n",
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
const event = over => ({ kind: 'done', sessionTitle: '会话 A', detail: '跑完了', ...over })

/** 假 fetcher：记下请求，按脚本返回。 */
function makeIo(reply = { status: 200, body: '{"code":200,"msg":"请求成功"}' }, now = 1_000_000) {
  const calls = []
  return {
    calls,
    fetchText: async (url, init) => { calls.push({ url, init }); return typeof reply === 'function' ? reply(calls.length) : reply },
    lastSent: {},
    now: () => now,
  }
}

// ── 成功路径 ────────────────────────────────────────────────────────────────
{
  const io = makeIo()
  const outcome = await pure.sendNotification(settings(), event(), io)
  check('配置齐全 ⇒ 真的发出去', outcome.sent === true && outcome.reason === '')
  check('打到 PushPlus 官方地址、带 token 的 JSON body',
    io.calls.length === 1 && io.calls[0].url === 'https://www.pushplus.plus/send'
    && JSON.parse(io.calls[0].init.body).token === 'abcdef1234567890')
  check('发出后记账（同会话同分类）', io.lastSent['会话 A|done'] === 1_000_000)
}

// ── 四种"没发出去"的原因要分开 ──────────────────────────────────────────────
{
  const io = makeIo()
  const off = await pure.sendNotification(settings({ enabled: false }), event(), io)
  check('总开关关 ⇒ 说清是总开关', off.sent === false && off.reason.includes('总开关'))
  const kindOff = await pure.sendNotification(settings({ kinds: { 'needs-input': true, done: false, error: true } }), event(), io)
  check('这一类关 ⇒ 说清是这一类', kindOff.sent === false && kindOff.reason.includes('这一类'))
  const noToken = await pure.sendNotification(settings({ pushplusToken: '' }), event(), io)
  check('❗凭据没填 ⇒ 说清是哪一项，并显示打码后的现值',
    noToken.sent === false && noToken.reason.includes('PushPlus token') && noToken.reason.includes('空'))
  check('没发出去时一次请求都没发', io.calls.length === 0)
}

// ── 防刷屏 + 先记账再发 ─────────────────────────────────────────────────────
{
  const io = makeIo()
  await pure.sendNotification(settings(), event(), io)
  const again = await pure.sendNotification(settings(), event(), io)
  check('30 秒内同类 ⇒ 压掉，且说清是防刷屏', again.sent === false && again.reason.includes('30 秒'))
  check('压掉的那条不会再发请求', io.calls.length === 1)

  const failing = makeIo({ status: 500, body: '' })
  const first = await pure.sendNotification(settings(), event(), failing)
  check('渠道 500 ⇒ 带回 HTTP 码', first.sent === false && first.reason.includes('HTTP 500'))
  check('❗失败也要记账（否则一次故障会在 30 秒内反复重试刷屏）', failing.lastSent['会话 A|done'] === 1_000_000)
}

// ── 渠道给的原因原样带回 ────────────────────────────────────────────────────
{
  const io = makeIo({ status: 200, body: '{"code":903,"msg":"token无效"}' })
  const outcome = await pure.sendNotification(settings(), event(), io)
  check('❗渠道拒绝时把它的原话带回（用户看到「token无效」而不是「发送失败」）',
    outcome.sent === false && outcome.reason.includes('token无效'))
  check('原因里不含凭据本身', !outcome.reason.includes('abcdef1234567890'))
}

// ── 连不上渠道 ──────────────────────────────────────────────────────────────
{
  const io = makeIo()
  io.fetchText = async () => { throw new Error('getaddrinfo ENOTFOUND') }
  const outcome = await pure.sendNotification(settings(), event(), io)
  check('连不上渠道 ⇒ 说明是连不上，并带原始原因',
    outcome.sent === false && outcome.reason.includes('连不上渠道') && outcome.reason.includes('ENOTFOUND'))
}

// ── 测试推送：绕过闸门，但不写记账 ──────────────────────────────────────────
{
  const io = makeIo()
  // 分类全关 + 已有一笔记账 ⇒ 真实通知会被两道闸门挡住，测试推送必须照发。
  io.lastSent['|done'] = 1_000_000
  const outcome = await pure.sendTestNotification(settings({ kinds: { 'needs-input': false, done: false, error: false } }), io)
  check('❗测试推送不受分类开关与防刷屏影响', outcome.sent === true && io.calls.length === 1)
  check('❗测试推送不写记账（否则会压掉后面真实的通知）', io.lastSent['|done'] === 1_000_000)
  const off = await pure.sendTestNotification(settings({ enabled: false }), io)
  check('但总开关关着时测试推送也拒绝，并说清原因', off.sent === false && off.reason.includes('总开关'))
  const noCred = await pure.sendTestNotification(settings({ pushplusToken: '' }), io)
  check('没填凭据时测试推送也拒绝', noCred.sent === false && noCred.reason.includes('PushPlus token'))
}

// ── 企业微信通道走同一套逻辑 ────────────────────────────────────────────────
{
  const hook = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abc'
  const io = makeIo({ status: 200, body: '{"errcode":93000,"errmsg":"invalid webhook url"}' })
  const outcome = await pure.sendNotification(settings({ channel: 'wecom', wecomWebhook: hook }), event({ kind: 'error' }), io)
  check('企业微信：打到用户填的 webhook', io.calls[0].url === hook)
  check('企业微信被拒 ⇒ 带回它的 errmsg', outcome.sent === false && outcome.reason.includes('invalid webhook url'))
}

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
