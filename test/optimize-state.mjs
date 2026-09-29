/**
 * 结果框持久化（\$DSH_HOME/composer-ux/optimize-dock.json）的护栏测试（0.13.0 ①）。
 *
 * 这个功能的全部价值是「重启后框里还在」，而它同时**碰用户的内容**（成品正文、条目、引文、
 * 发起时的草稿）。所以这里两头都钉：
 *  · 存/读的机械纪律 —— 原子写、损坏隔离（改名留证据而不是覆盖）、体积上限（拒写而不是截半）、
 *    信封版本不认识就不解析也不动文件；
 *  · 净化的边界 —— 被手工改坏/旧版本写的文件认不出就当"没有可恢复的结果"，宁可空着也不拿脏数据糊界面；
 *    重启前没跑完的那一轮恢复成"已取消"（不假装还在跑）。
 *
 *   node test/optimize-state.mjs
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import { apply } from '../lib/index.js'

let failures = 0
let passes = 0

function check(label, condition, detail) {
  if (condition) {
    passes += 1
    console.log(`  ✓ ${label}`)
    return
  }
  failures += 1
  console.log(`  ✗ ${label}${detail === undefined ? '' : ` — ${detail}`}`)
}

/** 纯函数出口（与其余套件同一套做法：现场打包源码再 import）。 */
const bundled = await build({
  bundle: true, write: false, format: 'esm', platform: 'node', target: ['es2022'], logLevel: 'warning',
  stdin: {
    contents: "export * from './test/pure-entry.ts'\n"
      + "export { clearDockState, dockStateBytes, optimizeStatePath, quarantineDockState, readDockState, writeDockState, OPTIMIZE_STATE_MAX_BYTES, OPTIMIZE_STATE_VERSION } from './src/optimize-state.ts'\n",
    resolveDir: process.cwd(), loader: 'ts',
  },
})
const pure = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)

const homes = []
const tmpHome = () => {
  const dir = mkdtempSync(join(tmpdir(), 'composer-ux-state-'))
  homes.push(dir)
  return dir
}

console.log('1. 原子写与上限')
{
  const file = join(tmpHome(), 'composer-ux', 'optimize-dock.json')
  const write = pure.writeDockState({ phase: 'done', text: '成品' }, file)
  check('写成功', write.written === true && existsSync(file), JSON.stringify(write))
  check('目录自动创建', existsSync(join(file, '..')))
  check('不留临时文件', readdirSync(join(file, '..')).filter(name => name.includes('.tmp-')).length === 0,
    readdirSync(join(file, '..')).join(','))
  const parsed = JSON.parse(readFileSync(file, 'utf8'))
  check('带信封版本号', parsed.version === pure.OPTIMIZE_STATE_VERSION)
  check('带写入时间', typeof parsed.at === 'string' && parsed.at.includes('T'))
  check('state 原样在内', parsed.state.phase === 'done' && parsed.state.text === '成品')

  check('null = 清空（删文件）', pure.writeDockState(null, file).written === true && !existsSync(file))
  check('清空不存在的文件也算成功', pure.writeDockState(null, file).written === true)

  const big = pure.writeDockState({ phase: 'done', text: 'x'.repeat(pure.OPTIMIZE_STATE_MAX_BYTES) }, file)
  check('超上限拒写（不截半）', big.written === false && big.tooBig === true, JSON.stringify({ written: big.written, tooBig: big.tooBig }))
  check('拒写后磁盘上没有文件（而不是半份）', !existsSync(file))

  const blocker = join(tmpHome(), 'not-a-dir')
  writeFileSync(blocker, 'x')
  const bad = pure.writeDockState({ phase: 'done' }, join(blocker, 'sub', 'x.json'))
  check('路径不可写时如实回报（不抛错）', bad.written === false && typeof bad.error === 'string')
  check('dockStateBytes 对不存在的文件返回 0', pure.dockStateBytes(join(tmpHome(), 'nope.json')) === 0)
}

console.log('2. 读：损坏隔离而不是覆盖')
{
  const dir = tmpHome()
  const file = join(dir, 'composer-ux', 'optimize-dock.json')
  mkdirSync(join(file, '..'), { recursive: true })
  check('文件不在 = 没有可恢复的状态（不是损坏）',
    JSON.stringify(pure.readDockState(file)) === JSON.stringify({ state: null, corrupt: false }))

  writeFileSync(file, '{"version":1,"state":{"phase":"done"}}')
  const good = pure.readDockState(file)
  check('正常文件读得出来', good.corrupt === false && good.state?.phase === 'done')

  writeFileSync(file, '{这不是 JSON')
  const broken = pure.readDockState(file)
  check('坏 JSON 判为损坏', broken.corrupt === true && broken.state === null)
  check('原文件被**改名**留证据（不是覆盖/删除）',
    broken.quarantined !== undefined && existsSync(broken.quarantined) && !existsSync(file),
    String(broken.quarantined))
  check('隔离文件名带 corrupt 与时间戳', /corrupt-\d{4}-/.test(broken.quarantined ?? ''), String(broken.quarantined))
  check('被隔离的那份内容还在（用户唯一一份成品不能丢）',
    readFileSync(broken.quarantined ?? file, 'utf8') === '{这不是 JSON')

  writeFileSync(file, JSON.stringify({ version: 1, state: [1, 2, 3] }))
  const arrayState = pure.readDockState(file)
  check('state 是数组也判为损坏（形状不对）', arrayState.corrupt === true)

  writeFileSync(file, JSON.stringify({ version: 99, state: { phase: 'done' } }))
  const future = pure.readDockState(file)
  check('版本不认识：不解析、也不动文件', future.state === null && future.corrupt === false && future.unknownVersion === 99)
  check('版本不认识时文件还在（可能是从新版降级回来）', existsSync(file))

  writeFileSync(file, JSON.stringify({ state: { phase: 'done' } }))
  const noVersion = pure.readDockState(file)
  check('没有版本号按"不认识"处理（不硬解析）', noVersion.state === null && noVersion.corrupt === false)
}

console.log('3. 净化：脏数据不糊界面')
{
  const good = pure.sanitizeDockSnapshot({
    phase: 'done',
    items: [{ index: 1, id: 'i1', kind: 'rewrite', text: '改写后的句子', quote: '原话片段', quoteSource: 'user' }],
    dropped: [{ id: 'i2', kind: 'requirement', reason: '缺少 quote（这一类条目必须有逐字引文）' }],
    text: '成品正文',
    edited: true,
    route: 'go/deepseek-flash',
    truncated: false,
    fallback: true,
    retried: true,
    promptSource: 'custom',
    itemCount: 3,
    elapsedMs: 17_500,
    draftAtStart: '原始草稿',
    source: '送去优化的正文',
    slashPrefix: '/goal ',
  })
  check('正常快照能恢复', good !== null && good.phase === 'done' && good.items.length === 1 && good.text === '成品正文')
  check('条目字段逐个复原', good.items[0].quote === '原话片段' && good.items[0].quoteSource === 'user')
  check('丢弃记录也复原', good.dropped.length === 1 && good.dropped[0].reason.startsWith('缺少 quote'))
  check('记账字段复原', good.itemCount === 3 && good.elapsedMs === 17_500 && good.fallback === true && good.retried === true)
  check('斜杠前缀与草稿都复原', good.slashPrefix === '/goal ' && good.draftAtStart === '原始草稿' && good.source === '送去优化的正文')
  check('startedAt 归零（恢复的框不该有秒表在跑）', good.startedAt === 0)
  check('多余的键不会被带进来', !('whatever' in good))

  const running = pure.sanitizeDockSnapshot({ phase: 'running', text: '', items: [] })
  check('重启前没跑完的那一轮 → 已取消（不假装还在跑）', running.phase === 'cancelled')
  check('恢复后耗时字段仍在（0 也是合法值）', running.elapsedMs === 0 && running.startedAt === 0)

  check('不是对象 → null', pure.sanitizeDockSnapshot('字符串') === null && pure.sanitizeDockSnapshot(null) === null && pure.sanitizeDockSnapshot([1]) === null)
  check('phase 不认识 → null', pure.sanitizeDockSnapshot({ phase: '别的东西' }) === null)
  check('缺 phase → null', pure.sanitizeDockSnapshot({ text: 'x' }) === null)

  const messy = pure.sanitizeDockSnapshot({
    phase: 'done',
    items: [
      ...Array.from({ length: 40 }, (_, index) => ({ id: `i${index}`, kind: 'rewrite', text: 't', quote: 'q', quoteSource: 'user' })),
      'not-an-object',
      { id: '', text: '' },
    ],
    dropped: Array.from({ length: 40 }, (_, index) => ({ id: `d${index}`, kind: 'k', reason: `r${index}` })),
    text: 'x'.repeat(999_999),
    itemCount: -5,
    elapsedMs: Number.NaN,
    edited: 'yes',
    quoteSource: 'user',
  })
  check('条目数封顶（坏文件塞再多也只恢复这么多）', messy.items.length === pure.DOCK_RESTORE_MAX_ITEMS, String(messy.items.length))
  check('非对象条目被丢掉', messy.items.every(item => typeof item.id === 'string' && item.id !== ''))
  check('丢弃记录也封顶', messy.dropped.length === pure.DOCK_RESTORE_MAX_ITEMS * 2, String(messy.dropped.length))
  check('超长正文被截断', messy.text.length === 60_000, String(messy.text.length))
  check('负数/NaN 归零', messy.itemCount === 0 && messy.elapsedMs === 0)
  check('非布尔一律当 false', messy.edited === false)

  check('条目上限与宿主的 OPTIMIZE_MAX_ITEMS 对齐',
    pure.DOCK_RESTORE_MAX_ITEMS === pure.OPTIMIZE_MAX_ITEMS,
    `${pure.DOCK_RESTORE_MAX_ITEMS} vs ${pure.OPTIMIZE_MAX_ITEMS}`)
}

console.log('4. 状态机：restore 是整份替换')
{
  const snapshot = pure.sanitizeDockSnapshot({ phase: 'done', text: '上一轮的成品', items: [{ id: 'i1', kind: 'rewrite', text: 't', quote: 'q', quoteSource: 'user' }] })
  const restored = pure.dockReducer(null, { type: 'restore', snapshot })
  check('空框 → 直接拿到这份快照', restored === snapshot)
  check('restore 不走增量规则（不会被当成 start 清空）', restored.items.length === 1 && restored.text === '上一轮的成品')

  // 恢复后「重新优化」用的正文与记忆链都对得上（否则恢复等于白恢复）。
  check('恢复后能算出记忆链要的上一轮成品', pure.previousForChain(restored, '新草稿').includes('上一轮的成品'))
  const fromRunning = pure.dockReducer(null, { type: 'restore', snapshot: pure.sanitizeDockSnapshot({ phase: 'running' }) })
  check('恢复被中断的那一轮后，文案说的是"已取消"而不是"在跑"',
    pure.dockPhaseText(fromRunning).includes('取消'), pure.dockPhaseText(fromRunning))
}

console.log('5. 宿主路由：真注册 + 真读写（假 webServer）')
{
  const dir = tmpHome()
  const previousHome = process.env.DSH_HOME
  process.env.DSH_HOME = dir
  const loadApply = async () => {
    const mod = await import(`../lib/index.js?v=${Date.now()}`)
    return mod.apply
  }
  const boot = async (settings) => {
    const routes = []
    const state = { 'composer-ux': { enabled: true, ...(settings ?? {}) } }
    const services = {
      settings: { get: ns => state[ns], register: () => {}, mutate: async () => {} },
      llm: { stream: () => (async function* empty() {})() },
      webServer: { register: route => { routes.push(route); return () => {} } },
      effect: fn => { const dispose = fn(); return () => { if (typeof dispose === 'function') dispose() } },
      get: name => services[name],
    }
    const ctx = {
      inject: (deps, callback) => { if (deps.every(dep => services[dep] !== undefined)) callback(services) },
      effect: services.effect,
      on: () => {},
    }
    ;(await loadApply())(ctx)
    await new Promise(resolve => { setTimeout(resolve, 15) })
    return routes
  }
  const makeReq = (method, body) => ({
    method,
    async *[Symbol.asyncIterator]() { if (body !== undefined) yield Buffer.from(body, 'utf8') },
  })
  const makeRes = () => {
    const captured = { status: 0, body: '' }
    return {
      captured,
      writeHead(code) { captured.status = code },
      end(body) { captured.body = body },
      get statusCode() { return captured.status },
      set statusCode(code) { captured.status = code },
    }
  }
  const path = pure.OPTIMIZE_STATE_API_PATH
  const routeOf = routes => routes.find(route => route.path === path)
  const call = async (routes, method, body) => {
    const res = makeRes()
    await routeOf(routes).handler(makeReq(method, body), res)
    // 被信任关卡拒掉时官方那道只设状态码、不带 body（res.end() 无参）—— 解析要容得下这种应答。
    const text = typeof res.captured.body === 'string' ? res.captured.body : ''
    let json = null
    try { json = JSON.parse(text) } catch { json = null }
    return { status: res.captured.status, json, text }
  }

  try {
    const routes = await boot()
    check('结果框状态路由注册为 exact', routes.length === 7 && routeOf(routes)?.kind === 'exact', String(routes.length))

    const file = join(dir, 'composer-ux', 'optimize-dock.json')
    const empty = await call(routes, 'GET')
    check('GET 空的时候返回 state: null', empty.json.ok === true && empty.json.state === null && empty.json.keep === true)

    const written = await call(routes, 'POST', JSON.stringify({ state: { phase: 'done', text: '成品' } }))
    check('POST 存下来', written.json.ok === true && existsSync(file), JSON.stringify(written.json))

    const read = await call(routes, 'GET')
    check('再 GET 读回来是同一份', read.json.state?.phase === 'done' && read.json.state?.text === '成品')
    check('GET 顺带回文件大小（排查用）', typeof read.json.bytes === 'number' && read.json.bytes > 0)

    const bad = await call(routes, 'POST', JSON.stringify({ state: 'not-an-object' }))
    check('state 不是对象 → 400', bad.status === 400 && bad.json.ok === false)
    const missing = await call(routes, 'POST', JSON.stringify({ text: 'x' }))
    check('缺 state 字段 → 400（不默认清空）', missing.status === 400)
    const wrongMethod = await call(routes, 'DELETE')
    check('其它方法 → 405', wrongMethod.status === 405)

    const tooBig = await call(routes, 'POST', JSON.stringify({ state: { phase: 'done', text: 'x'.repeat(pure.OPTIMIZE_STATE_MAX_BYTES) } }))
    check('太大如实回报且没写盘', tooBig.json.ok === false && tooBig.json.tooBig === true, JSON.stringify(tooBig.json).slice(0, 80))
    check('拒写后磁盘上还是上一次那份', JSON.parse(readFileSync(file, 'utf8')).state.text === '成品')

    const cleared = await call(routes, 'POST', JSON.stringify({ state: null }))
    check('state: null = 清空', cleared.json.ok === true && !existsSync(file))

    // 开关关掉：不读、不写，并把旧的删掉
    const offRoutes = await boot({ optimizeKeepDock: false })
    await call(offRoutes, 'POST', JSON.stringify({ state: { phase: 'done', text: '不该被存' } }))
    check('开关关掉时不写盘', !existsSync(file))
    const offRead = await call(offRoutes, 'GET')
    check('开关关掉时 GET 返回 null 且 keep: false', offRead.json.state === null && offRead.json.keep === false)

    // 损坏文件：GET 如实报告，并把原文件隔离
    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(file, '半截 JSON')
    const corrupt = await call(routes, 'GET')
    check('损坏时如实报告（不静默吞掉）', corrupt.json.corrupt === true && typeof corrupt.json.quarantined === 'string')
    check('原文件被隔离后，正常路径上没有文件', !existsSync(file) && existsSync(corrupt.json.quarantined))

    // 官方信任关卡：被拒的请求不能读也不能写
    const rejectedRoutes = []
    const rejectedServices = {
      settings: { get: () => ({ 'composer-ux': { enabled: true } }), register: () => {}, mutate: async () => {} },
      llm: { stream: () => (async function* empty() {})() },
      webServer: { register: route => { rejectedRoutes.push(route); return () => {} } },
      connection: { requestRejection: () => 403 },
      effect: fn => { const dispose = fn(); return () => { if (typeof dispose === 'function') dispose() } },
      get: name => rejectedServices[name],
    }
    const rejectedCtx = {
      inject: (deps, callback) => { if (deps.every(dep => rejectedServices[dep] !== undefined)) callback(rejectedServices) },
      effect: rejectedServices.effect,
      on: () => {},
    }
    ;(await loadApply())(rejectedCtx)
    await new Promise(resolve => { setTimeout(resolve, 15) })
    const before = existsSync(file)
    const rejected = await call(rejectedRoutes, 'POST', JSON.stringify({ state: { phase: 'done', text: 'x' } }))
    check('被信任关卡拒掉的写入不落盘', rejected.status === 403 && existsSync(file) === before, String(rejected.status))
  } finally {
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
  }
}

console.log('6. 客户端接线（源码级：组件行为在浏览器，这里盯接线是否还在）')
{
  const client = readFileSync('src/client.tsx', 'utf8').replace(/\r\n/g, '\n')
  check('启动时会读一次并恢复', client.includes("loadDockState()") && client.includes("type: 'restore'"))
  check('只在框还空着时恢复', client.includes("if (dock.getSnapshot() === null) dock.set("))
  check('结果框变化会（去抖）存盘', client.includes('DOCK_SAVE_DEBOUNCE_MS') && client.includes('saveDockState(dock.getSnapshot())'))
  check('关掉开关就不再白发请求', client.includes('if (!keepDockOn()) return'))
  check('设置页动作接了清空', client.includes('clearDockState: () =>') && client.includes('clearDockStateOnHost()'))

  const section = readFileSync('src/client/SettingsSection.tsx', 'utf8')
  check('设置页有开关与清空按钮',
    section.includes('OPTIMIZE_KEEP_DOCK_FIELD') && section.includes('清空结果框状态'))

  const layer = readFileSync('src/client/optimize-state.ts', 'utf8')
  check('客户端读回来的 state 一定过净化', layer.includes('state: sanitizeDockSnapshot(row.state)'))
  check('失败不弹错、退化成"没有可恢复的状态"', layer.includes('state: null, keep: true, error:'))
}

for (const dir of homes) rmSync(dir, { recursive: true, force: true })
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
