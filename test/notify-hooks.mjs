/**
 * 事件挂载层的测试（0.17.0）。
 *
 * 三条最该被钉住的：
 *   1. **审批/提问是透传** —— 处理器必须原样把 `next()` 的结果还回去（红线的机器可验证形式）；
 *   2. **通知出错不连累 DSH** —— 交付函数抛异常时，waterfall 的结果照旧返回，只多一行日志；
 *   3. **只在 running→idle 报完成**，且按会话隔离（别的会话的完成不会被吞、也不会串台）。
 */
import { build } from 'esbuild'

const bundled = await build({
  bundle: true, write: false, format: 'esm', platform: 'node', target: ['es2022'], logLevel: 'warning',
  stdin: {
    contents: "export { NOTIFY_EVENTS, registerNotifyHooks } from './src/notify-hooks.ts'\n",
    resolveDir: process.cwd(), loader: 'ts',
  },
})
const pure = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)

let passes = 0
let failures = 0
function check(label, ok, detail = '') {
  if (ok) { passes += 1; console.log(`  ✓ ${label}`) } else { failures += 1; console.log(`  ✗ ${label}${detail === '' ? '' : ` — ${detail}`}`) }
}

/** 假注入面：记下注册的处理器，手动触发它们。 */
function makeIo(options = {}) {
  const handlers = new Map()
  const delivered = []
  const warned = []
  const io = {
    handlers,
    delivered,
    warned,
    on: (name, handler) => {
      handlers.set(name, handler)
      return () => { handlers.delete(name) }
    },
    deliver: options.deliver ?? (event => { delivered.push(event) }),
    titleOf: id => (id === undefined ? '' : `会话 ${id}`),
    warn: message => { warned.push(message) },
    toolNameOf: payload => (payload && typeof payload === 'object' && 'toolName' in payload ? String(payload.toolName) : undefined),
    questionOf: payload => (payload && typeof payload === 'object' && 'question' in payload ? String(payload.question) : undefined),
    sessionIdOf: payload => (payload && typeof payload === 'object' && 'sessionId' in payload ? String(payload.sessionId) : undefined),
  }
  return io
}

check('注册了四个事件（与目录里的名字一致）',
  pure.NOTIFY_EVENTS.length === 4 && pure.NOTIFY_EVENTS.includes('approval/request')
  && pure.NOTIFY_EVENTS.includes('user-questions/request')
  && pure.NOTIFY_EVENTS.includes('agent/status') && pure.NOTIFY_EVENTS.includes('agent/error'))

// ── ① 红线：审批与提问必须原样透传 ──────────────────────────────────────────
{
  const io = makeIo()
  pure.registerNotifyHooks(io)
  const decision = { approved: true, marker: '原样返回' }
  const result = await io.handlers.get('approval/request')({ sessionId: 's1', toolName: 'Bash' }, async () => decision)
  check('❗审批：原样返回 next() 的结果（不干预决策）', result === decision)
  check('审批：顺带发了一条「等你审批」', io.delivered.length === 1 && io.delivered[0].kind === 'needs-input')
  check('审批消息里带工具名', io.delivered[0].detail.includes('Bash'))

  const answer = { answer: '选 A' }
  const questionResult = await io.handlers.get('user-questions/request')({ sessionId: 's1', question: '选哪个？' }, async () => answer)
  check('❗提问：原样返回 next() 的结果', questionResult === answer)
  check('提问消息里带问题正文', io.delivered[1].detail.includes('选哪个？'))
}

// ── ② 通知出错不能连累 DSH ─────────────────────────────────────────────────
{
  const io = makeIo({ deliver: () => { throw new Error('渠道炸了') } })
  pure.registerNotifyHooks(io)
  const decision = { approved: false }
  let result
  let threw = false
  try {
    result = await io.handlers.get('approval/request')({ sessionId: 's2' }, async () => decision)
  } catch {
    threw = true
  }
  check('❗交付抛异常时，waterfall 的结果照旧返回（审批界面不会卡住）', !threw && result === decision)
  check('❗交付抛异常时留了一行日志（可诊断，不静默）',
    io.warned.length === 1 && io.warned[0].includes('[notify]'))
}

// ── ③ 完成判定：只在 running→idle，且按会话隔离 ─────────────────────────────
{
  const io = makeIo()
  pure.registerNotifyHooks(io)
  const status = io.handlers.get('agent/status')
  status({ sessionId: 'a', status: 'running' })
  check('开始干活（idle→running）不通知', io.delivered.length === 0)
  status({ sessionId: 'a', status: 'idle' })
  check('跑完（running→idle）通知一条「完成」',
    io.delivered.length === 1 && io.delivered[0].kind === 'done' && io.delivered[0].sessionTitle === '会话 a')
  status({ sessionId: 'a', status: 'idle' })
  check('反复 idle→idle 不再通知', io.delivered.length === 1)
  status({ sessionId: 'b', status: 'running' })
  status({ sessionId: 'b', status: 'idle' })
  check('❗另一个会话的完成不会被吞（按会话记状态）',
    io.delivered.length === 2 && io.delivered[1].sessionTitle === '会话 b')
}

// ── ④ 出错事件 ──────────────────────────────────────────────────────────────
{
  const io = makeIo()
  pure.registerNotifyHooks(io)
  io.handlers.get('agent/error')({ sessionId: 'c', error: { message: '模型超时' } })
  check('出错事件推一条 error 且带原因',
    io.delivered.length === 1 && io.delivered[0].kind === 'error' && io.delivered[0].detail.includes('模型超时'))
}

// ── ⑤ 注销 ──────────────────────────────────────────────────────────────────
{
  const io = makeIo()
  const dispose = pure.registerNotifyHooks(io)
  check('注册后四个处理器都在', io.handlers.size === 4)
  dispose()
  check('注销后一个都不留（插件卸载时不残留监听器）', io.handlers.size === 0)
}

// ── ⑥ payload 形状不可信也不能抛 ────────────────────────────────────────────
{
  const io = makeIo()
  pure.registerNotifyHooks(io)
  let threw = false
  try {
    io.handlers.get('agent/status')(undefined)
    io.handlers.get('agent/error')(null)
    io.handlers.get('approval/request')({}, async () => 'x')
  } catch {
    threw = true
  }
  check('❗payload 是 undefined/null/空对象也不抛', !threw)
}

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
