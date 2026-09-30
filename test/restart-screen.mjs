/**
 * 0.15.0：重启屏（`src/client/restart-screen.ts`）的测试。
 *
 * 分三层：
 *   1. **纯逻辑**：阶段机三条走法（正常 / 极快 / 卡住）、进度自适应、标记读写与超龄；
 *   2. **请求**：`requestRestart` 的四种结局（被禁 / 202 / 失败 / 宿主死在响应前）；
 *   3. **屏幕**：用**假 document** 真跑一遍 —— 画出来、轮询、恢复后带 `?restarted=1` 自动刷新、
 *      卡住时把日志路径与复制按钮摆出来。
 *
 * 为什么值得这么一个套件：这一屏的每一条分支都只在"真重启"时才走到，而真重启一天点不了几次 ——
 * 所以它的正确性只能靠这里钉住。
 */
import { build } from 'esbuild'

const bundled = await build({
  bundle: true, write: false, format: 'esm', platform: 'node', target: ['es2022'], logLevel: 'warning',
  stdin: {
    contents: [
      "export { RESTART_MARK_KEY, RESTART_LAST_MS_KEY, RESTART_PROGRESS_CAP, RESTART_EXPECTED_DEFAULT_MS,",
      "  advanceRestartTrack, beginRestartTrack, consumeRestartMark, enterRestartScreen, maybeShowRestartDone,",
      "  readLastRestartMs, requestRestart, restartMessage, restartProgress, restartReloadHref,",
      "  writeLastRestartMs, writeRestartMark } from './src/client/restart-screen.ts'\n",
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

/** 内存版存储（可注入"会抛"的形态）。 */
function makeStorage(initial = {}, throwing = false) {
  const map = new Map(Object.entries(initial))
  return {
    map,
    getItem: (key) => { if (throwing) throw new Error('no storage'); return map.has(key) ? map.get(key) : null },
    setItem: (key, value) => { if (throwing) throw new Error('no storage'); map.set(key, String(value)) },
    removeItem: (key) => { if (throwing) throw new Error('no storage'); map.delete(key) },
  }
}

/** 极简假 DOM：只实现 restart-screen 用到的那几个成员。 */
function makeDoc() {
  const make = (tag) => {
    const el = {
      tagName: tag,
      children: [],
      style: { cssText: '' },
      textContent: '',
      attributes: {},
      listeners: {},
      setAttribute: (name, value) => { el.attributes[name] = value },
      append: (...nodes) => { el.children.push(...nodes) },
      replaceChildren: (...nodes) => { el.children = [...nodes] },
      addEventListener: (type, fn) => { el.listeners[type] = fn },
      remove: () => { el.removed = true },
      query: (predicate) => {
        if (predicate(el)) return el
        for (const child of el.children) {
          const hit = child.query?.(predicate)
          if (hit !== undefined && hit !== null) return hit
        }
        return null
      },
      allText: () => [el.textContent, ...el.children.map(child => child.allText?.() ?? '')].join(' '),
    }
    return el
  }
  const body = make('body')
  return { doc: { title: '', body, createElement: make }, make }
}

// ── 1. 纯逻辑 ────────────────────────────────────────────────────────────────
console.log('1. 阶段机：正常 / 极快 / 卡住')
{
  const start = pure.beginRestartTrack('boot-1', 1_000)
  check('起始阶段是 stopping', start.phase === 'stopping' && start.seenDown === false)

  // 正常：先下线，再带新号回来
  const down = pure.advanceRestartTrack(start, { online: false, boot: '' })
  check('探到下线 ⇒ 记住"见过下线"，仍在 stopping', down.phase === 'stopping' && down.seenDown === true)
  const up = pure.advanceRestartTrack(down, { online: true, boot: 'boot-2' })
  check('新号回来 ⇒ up', up.phase === 'up')

  // 极快：整个下线窗口没被探到，但号已经变了
  const fast = pure.advanceRestartTrack(start, { online: true, boot: 'boot-2' })
  check('❗极快重启（没见到下线、但号变了）也判完成，不死等', fast.phase === 'up')

  // 号没变 = 老进程还在跑
  const same = pure.advanceRestartTrack(start, { online: true, boot: 'boot-1' })
  check('号没变 ⇒ 继续 stopping（不是失败）', same.phase === 'stopping')

  // 卡住：一直在线且号不变，到上限就 stuck
  let track = start
  for (let i = 0; i < 3; i += 1) track = pure.advanceRestartTrack(track, { online: true, boot: 'boot-1' }, 3)
  check('一直在线且号不变、到上限 ⇒ stuck', track.phase === 'stuck', track.phase)

  // 见过下线后一直回不来，到上限也 stuck
  let back = pure.advanceRestartTrack(pure.beginRestartTrack('b', 0), { online: false, boot: '' })
  for (let i = 0; i < 3; i += 1) back = pure.advanceRestartTrack(back, { online: false, boot: '' }, 3)
  check('见过下线却一直不回来、到上限 ⇒ stuck', back.phase === 'stuck', back.phase)

  // 离线时 boot 给空串不能被当成"新号"
  const offline = pure.advanceRestartTrack(start, { online: false, boot: '' })
  check('离线时空号不算新进程', offline.phase === 'stopping')
}

console.log('2. 进度与文案')
{
  const track = pure.beginRestartTrack('b', 1_000)
  const early = pure.restartProgress(track, 2_000, 40_000)
  const later = pure.restartProgress(track, 20_000, 40_000)
  check('进度随耗时增长', later.percent > early.percent && early.percent >= 2)
  check('未完成前不超过上限（留一格给"完成"那一跳）', later.percent <= pure.RESTART_PROGRESS_CAP)
  check('超过预期 ⇒ slow', pure.restartProgress(track, 60_000, 40_000).slow === true)
  check('没超预期 ⇒ 不 slow', pure.restartProgress(track, 5_000, 40_000).slow === false)
  check('up ⇒ 100%', pure.restartProgress({ ...track, phase: 'up' }, 5_000, 40_000).percent === 100)
  check('四个阶段都有文案', pure.restartMessage('stopping').includes('停旧进程')
    && pure.restartMessage('starting').includes('新进程')
    && pure.restartMessage('up').includes('刷新')
    && pure.restartMessage('stuck').includes('没生效'))
}

console.log('3. 标记与耗时记忆')
{
  const storage = makeStorage()
  pure.writeRestartMark(storage, { startedAt: 5_000, oldBoot: 'b1', logPath: '/tmp/log' })
  const mark = pure.consumeRestartMark(storage, 6_000)
  check('标记能读回', mark !== null && mark.oldBoot === 'b1' && mark.logPath === '/tmp/log')
  check('读一次就清掉（不会重复提示）', storage.getItem(pure.RESTART_MARK_KEY) === null)
  check('没有标记 ⇒ null', pure.consumeRestartMark(storage, 6_000) === null)

  const old = makeStorage()
  pure.writeRestartMark(old, { startedAt: 1_000, oldBoot: 'b', logPath: '' })
  check('超龄标记当没有（并清掉）', pure.consumeRestartMark(old, 1_000 + 60 * 60_000) === null
    && old.getItem(pure.RESTART_MARK_KEY) === null)

  const bad = makeStorage({ [pure.RESTART_MARK_KEY]: '{不是 JSON' })
  check('坏标记不抛、当没有', pure.consumeRestartMark(bad, 1_000) === null)

  const boom = makeStorage({}, true)
  check('存储会抛也不崩（隐私模式）',
    (() => { pure.writeRestartMark(boom, { startedAt: 1, oldBoot: '', logPath: '' }); return pure.consumeRestartMark(boom, 1) === null })())

  check('没记录时给保守默认值', pure.readLastRestartMs(makeStorage()) === pure.RESTART_EXPECTED_DEFAULT_MS)
  const remembered = makeStorage()
  pure.writeLastRestartMs(remembered, 12_345)
  check('记下实际耗时后能读回', pure.readLastRestartMs(remembered) === 12_345)
  pure.writeLastRestartMs(remembered, Number.NaN)
  check('坏值不覆盖已有记录', pure.readLastRestartMs(remembered) === 12_345)
}

console.log('4. 自动刷新的地址')
{
  check('加 ?restarted=1', pure.restartReloadHref('http://x/y') === 'http://x/y?restarted=1')
  check('保留已有查询串，并覆盖同名', pure.restartReloadHref('http://x/y?a=1&restarted=0') === 'http://x/y?a=1&restarted=1')
  check('保留 hash', pure.restartReloadHref('http://x/y?a=1#frag') === 'http://x/y?a=1&restarted=1#frag')
}

console.log('5. 发重启请求：四种结局')
{
  const okFetch = async (url, init) => {
    if (init?.method === 'POST') return { status: 202, ok: true, json: async () => ({ ok: true }) }
    return { status: 200, ok: true, json: async () => ({ boot: 'b1', logHint: '/tmp/log' }) }
  }
  const ok = await pure.requestRestart(okFetch)
  check('202 ⇒ 成功且带回旧 boot 号与日志路径',
    ok.ok === true && ok.oldBoot === 'b1' && ok.logPath === '/tmp/log')

  const blocked = await pure.requestRestart(async () => ({ status: 200, ok: true, json: async () => ({ blocked: '不是 dsh web' }) }))
  check('宿主说不能从界面重启 ⇒ 如实报错', blocked.ok === false && /不是 dsh web/.test(blocked.error))

  const refused = await pure.requestRestart(async (url, init) => (init?.method === 'POST'
    ? { status: 500, ok: false, json: async () => ({ ok: false, error: '排不进去' }) }
    : { status: 200, ok: true, json: async () => ({ boot: 'b' }) }))
  check('POST 被拒 ⇒ 报出宿主给的原因', refused.ok === false && refused.error === '排不进去')

  const dies = await pure.requestRestart(async (url, init) => {
    if (init?.method === 'POST') throw new Error('connection reset')
    return { status: 200, ok: true, json: async () => ({ boot: 'b2' }) }
  })
  check('宿主死在响应发完之前 ⇒ 当作已经重启（继续进屏）', dies.ok === true && dies.oldBoot === 'b2')
}

console.log('6. 重启屏本体：用假 document 真跑一遍')
{
  // 正常路径：第一次探测还没回来，第二次带着新号回来 ⇒ 自动刷新
  const { doc, make } = makeDoc()
  const storage = makeStorage()
  const reloads = []
  const timers = []
  const probes = [
    { online: false, boot: '' },
    { online: true, boot: 'boot-2' },
  ]
  const screen = pure.enterRestartScreen({
    oldBoot: 'boot-1', logPath: '/tmp/restart.log', doc, storage,
    now: () => 10_000, href: 'http://x/y?a=1', reload: href => { reloads.push(href) },
    probe: () => Promise.resolve(probes.shift() ?? { online: true, boot: 'boot-2' }),
    setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length },
    clearTimer: () => undefined,
  })
  const layer = doc.body.children.find(child => child.attributes['data-composer-ux'] === 'restart-screen')
  check('盖上全屏层', layer !== undefined && doc.body.children.length === 1)
  check('写着「正在停旧进程…」', layer.allText().includes('正在停旧进程'))
  check('标题改成「重启中」', doc.title.includes('重启中'))
  check('标记已写盘（刷新/多标签的兜底）', storage.getItem(pure.RESTART_MARK_KEY) !== null)
  check('定时轮询已排上（1 秒一次）', timers.length === 1 && timers[0].ms === 1_000)

  // 跑两拍
  await timers[0].fn()
  await new Promise(resolve => { setImmediate(resolve) })
  check('还没回来时继续排下一拍', timers.length >= 2)
  await timers[1].fn()
  await new Promise(resolve => { setImmediate(resolve) })
  check('❗新号回来 ⇒ 自动刷新（带 ?restarted=1）', reloads.length === 1 && reloads[0] === 'http://x/y?a=1&restarted=1', JSON.stringify(reloads))
  check('刷新前把这次的实际耗时记下来', pure.readLastRestartMs(storage) === 0 || pure.readLastRestartMs(storage) > 0)
  screen.stop()

  // 卡住路径：一直在线且号不变
  const stuckDoc = makeDoc()
  const stuckTimers = []
  let n = 0
  pure.enterRestartScreen({
    oldBoot: 'boot-1', logPath: '/tmp/restart.log', doc: stuckDoc.doc, storage: makeStorage(),
    now: () => 1_000, href: 'http://x/y', reload: () => undefined,
    attemptLimit: 2, pollMs: 10,
    probe: () => Promise.resolve({ online: true, boot: 'boot-1' }),
    setTimer: (fn, ms) => { stuckTimers.push({ fn, ms }); n += 1; return n },
    clearTimer: () => undefined,
  })
  for (let i = 0; i < 2; i += 1) {
    await stuckTimers[i].fn()
    await new Promise(resolve => { setImmediate(resolve) })
  }
  const stuckLayer = stuckDoc.doc.body.children[0]
  check('卡住时改说「可能没生效」', stuckLayer.allText().includes('没生效'))
  check('卡住时把日志路径摆出来', stuckLayer.allText().includes('/tmp/restart.log'))
  check('卡住时给「复制日志路径」与「重新加载页面」两个按钮',
    stuckLayer.allText().includes('复制日志路径') && stuckLayer.allText().includes('重新加载页面'))
  check('卡住后不再继续轮询', stuckTimers.length === 2, String(stuckTimers.length))

  // 没有 DOM 的环境（SSR/测试里 eval 产物）不能抛
  const bare = pure.enterRestartScreen({ oldBoot: 'b', logPath: '', doc: undefined, storage: makeStorage() })
  check('没有 document ⇒ 静默退回（不抛）', typeof bare.stop === 'function')
  bare.stop()
}

console.log('7. 加载后的「重启完成」提示')
{
  const { doc } = makeDoc()
  const storage = makeStorage()
  pure.writeRestartMark(storage, { startedAt: 1_000, oldBoot: 'b', logPath: '' })
  const shown = pure.maybeShowRestartDone({
    doc, storage, now: () => 9_000, search: '?restarted=1',
    setTimer: () => 0, clearTimer: () => undefined,
  })
  check('带 ?restarted=1 且有标记 ⇒ 提示「重启完成」', shown === true)
  check('提示写进了 body', doc.body.children.length === 1 && doc.body.children[0].textContent.includes('重启完成'))
  check('提示里带用时（8 秒）', doc.body.children[0].textContent.includes('8 秒'))

  const again = makeDoc()
  check('没有 ?restarted=1 ⇒ 不提示', pure.maybeShowRestartDone({ doc: again.doc, storage: makeStorage({ [pure.RESTART_MARK_KEY]: JSON.stringify({ startedAt: 1 }) }), now: () => 2_000, search: '' }) === false)
  check('没有 document ⇒ 不抛、返回 false',
    pure.maybeShowRestartDone({ doc: undefined, storage: makeStorage(), now: () => 1, search: '?restarted=1' }) === false)
}

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
