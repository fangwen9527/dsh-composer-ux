/**
 * 「测试推送」路由的测试（0.17.0）。
 *
 * 假 req/res 真跑：只认 POST · 必须带防跨站头 · 不打码的东西**一个都不许回显** ·
 * 读设置失败要直说（不假装配置为空）· 成败同时给 `ok` 与渠道原话。
 */
import { build } from 'esbuild'

const bundled = await build({
  bundle: true, write: false, format: 'esm', platform: 'node', target: ['es2022'], logLevel: 'warning',
  stdin: {
    contents: "export { createNotifyTestHandler } from './src/notify-route.ts'\nexport { RESTART_CSRF_HEADER, RESTART_CSRF_VALUE } from './src/settings-contract.ts'\n",
    resolveDir: process.cwd(), loader: 'ts',
  },
})
const pure = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)

let passes = 0
let failures = 0
function check(label, ok, detail = '') {
  if (ok) { passes += 1; console.log(`  ✓ ${label}`) } else { failures += 1; console.log(`  ✗ ${label}${detail === '' ? '' : ` — ${detail}`}`) }
}

const TOKEN = 'abcdef1234567890'
const settings = over => ({
  enabled: true,
  channel: 'pushplus',
  pushplusToken: TOKEN,
  wecomWebhook: '',
  kinds: { 'needs-input': true, done: true, error: true },
  ...over,
})

/** 假 req/res：记下状态码、响应头与响应体。 */
function makeRes() {
  const out = { status: 0, headers: {}, body: '' }
  return {
    out,
    res: {
      writeHead: (code, headers) => { out.status = code; out.headers = headers },
      end: (body) => { out.body = body ?? '' },
    },
  }
}
const okFetch = reply => async () => (typeof reply === 'function' ? reply() : reply)
const CSRF = { [pure.RESTART_CSRF_HEADER]: pure.RESTART_CSRF_VALUE }

// ── 只认 POST ───────────────────────────────────────────────────────────────
{
  const calls = []
  const handler = pure.createNotifyTestHandler({ readSettings: () => settings(), fetchText: async (u, i) => { calls.push([u, i]); return { status: 200, body: '{"code":200}' } } })
  const { out, res } = makeRes()
  await handler({ method: 'GET', headers: CSRF }, res)
  check('GET ⇒ 405（而且一次请求都没发）', out.status === 405 && calls.length === 0)
  check('405 的说明直说要用 POST', JSON.parse(out.body).reason.includes('POST'))
}

// ── 防跨站头 ────────────────────────────────────────────────────────────────
{
  const calls = []
  const handler = pure.createNotifyTestHandler({ readSettings: () => settings(), fetchText: async () => { calls.push(1); return { status: 200, body: '{"code":200}' } } })
  const { out, res } = makeRes()
  await handler({ method: 'POST', headers: {} }, res)
  check('❗缺防跨站头 ⇒ 403（跨站页面加不了自定义头）', out.status === 403 && calls.length === 0)
  const { out: out2, res: res2 } = makeRes()
  await handler({ method: 'POST', headers: { [pure.RESTART_CSRF_HEADER]: '0' } }, res2)
  check('头值不对也 403', out2.status === 403)
}

// ── 成功路径 ────────────────────────────────────────────────────────────────
{
  const calls = []
  const handler = pure.createNotifyTestHandler({ readSettings: () => settings(), fetchText: async (url, init) => { calls.push({ url, init }); return { status: 200, body: '{"code":200,"msg":"请求成功"}' } } })
  const { out, res } = makeRes()
  await handler({ method: 'POST', headers: CSRF }, res)
  const body = JSON.parse(out.body)
  check('配置齐全 ⇒ ok:true、reason 为空', out.status === 200 && body.ok === true && body.reason === '')
  check('真的打到了 PushPlus（且带 token）', calls.length === 1 && calls[0].url === 'https://www.pushplus.plus/send' && JSON.parse(calls[0].init.body).token === TOKEN)
  check('响应带 no-store（这种带凭据的动作不许被缓存）', String(out.headers['cache-control']).includes('no-store'))
  check('响应头是 JSON', String(out.headers['content-type']).includes('application/json'))
}

// ── 没配置 / 渠道拒绝 / 连不上：都要说清原因，且不回显凭据 ────────────────
{
  const handler = pure.createNotifyTestHandler({ readSettings: () => settings({ enabled: false }), fetchText: okFetch({ status: 200, body: '{}' }) })
  const { out, res } = makeRes()
  await handler({ method: 'POST', headers: CSRF }, res)
  const body = JSON.parse(out.body)
  check('总开关关 ⇒ ok:false 且说清是总开关', body.ok === false && body.reason.includes('总开关'))

  const rejecting = pure.createNotifyTestHandler({
    readSettings: () => settings(),
    fetchText: okFetch({ status: 200, body: '{"code":903,"msg":"token无效"}' }),
  })
  const { out: out2, res: res2 } = makeRes()
  await rejecting({ method: 'POST', headers: CSRF }, res2)
  const body2 = JSON.parse(out2.body)
  check('❗渠道拒绝 ⇒ 带回它的原话', body2.ok === false && body2.reason.includes('token无效'))
  check('❗响应体里不含 token 本身', !out2.body.includes(TOKEN))

  const failing = pure.createNotifyTestHandler({
    readSettings: () => settings(),
    fetchText: async () => { throw new Error('ECONNREFUSED') },
  })
  const { out: out3, res: res3 } = makeRes()
  await failing({ method: 'POST', headers: CSRF }, res3)
  check('连不上渠道 ⇒ 区分「连不上」并带原始原因',
    JSON.parse(out3.body).reason.includes('连不上渠道') && JSON.parse(out3.body).reason.includes('ECONNREFUSED'))
}

// ── 读设置失败要直说 ────────────────────────────────────────────────────────
{
  const handler = pure.createNotifyTestHandler({
    readSettings: () => { throw new Error('命名空间没注册') },
    fetchText: okFetch({ status: 200, body: '{}' }),
  })
  const { out, res } = makeRes()
  await handler({ method: 'POST', headers: CSRF }, res)
  check('❗读不到设置 ⇒ 500 且说明原因（不假装配置为空）',
    out.status === 500 && JSON.parse(out.body).reason.includes('命名空间没注册'))
}

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
