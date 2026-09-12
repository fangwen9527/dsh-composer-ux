/**
 * 线级探针：一个最小的 OpenAI 兼容端点。
 *
 * 目的：证明「插件写进 llm-pi-ai 的请求头真的出现在了出网请求上」——不是靠读代码推断，
 * 而是让 DSH 真的往这里发一次请求，看它带了什么头。
 *
 *   node test/opencode-header-wire-probe.mjs [port]
 *
 * 它把每个请求里我们关心的头打到 stdout（凭据只报长度、不回显），
 * 回一段最小 SSE 让调用方正常收尾，收到 2 个请求或 90 秒无请求后退出。
 */
import { createServer } from 'node:http'

const port = Number(process.argv[2] ?? 8799)
const idleTimeoutMs = Number(process.argv[3] ?? 90_000)
const WANTED = ['x-opencode-session', 'user-agent', 'content-type']
const SECRETISH = ['authorization', 'x-api-key']

let seen = 0
const finish = () => { server.close(); process.exit(0) }
const timer = setTimeout(() => { console.log('TIMEOUT: 90s 内没有再收到请求'); finish() }, 90_000)

const server = createServer((req, res) => {
  const headers = {}
  for (const [name, value] of Object.entries(req.headers)) {
    if (WANTED.includes(name)) headers[name] = value
    else if (SECRETISH.includes(name)) headers[name] = '<redacted len=' + String(value).length + '>'
  }
  seen += 1
  console.log('REQ#' + seen + ' ' + req.method + ' ' + req.url + ' ' + JSON.stringify(headers))
  // 模型发现走 GET {baseURL}/models：给它一份合法清单，避免设置页报错。
  if (req.url.includes('/models')) {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ object: 'list', data: [{ id: 'probe-model', object: 'model' }] }))
    if (seen >= 2) { clearTimeout(timer); setTimeout(finish, 200) }
    return
  }
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' })
  const base = {
    id: 'probe-chunk',
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: 'probe-model',
  }
  res.write('data: ' + JSON.stringify({ ...base, choices: [{ index: 0, delta: { role: 'assistant', content: 'probe-ok' }, finish_reason: null }] }) + '\n\n')
  res.write('data: ' + JSON.stringify({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }) + '\n\n')
  res.write('data: [DONE]\n\n')
  res.end()
  if (seen >= 2) { clearTimeout(timer); setTimeout(finish, 200) }
})

server.listen(port, '127.0.0.1', () => {
  console.log('wire probe listening on http://127.0.0.1:' + port + '/v1')
})
