/**
 * 「法定节假日自动获取」（0.11.0）的测试。
 *
 *   node test/holiday-sync.mjs
 *
 * 这块能力的错法都很**安静**，而且每一种都能把账算错：
 *
 *  1. **补班日混进"放假"里** → 2026-10-10（周六，调休上班）会被当成峰价 / 或反过来把该谷价的
 *     日子当峰价，差 2 倍；
 *  2. **年份判错**（拿 UTC 年当北京年）→ 跨年那几天算错，且某一年会**永远不再抓**；
 *  3. **覆盖语义写反** → 用户手填的表被后台悄悄盖掉（或相反：自动获取白拉）；
 *  4. **"抓不到"与"还没公布"混为一谈** → 界面说"网络失败"，其实只是国务院还没发通知；
 *  5. **该不该出网判错** → 插件在用户没点头时自己联网。
 *
 * 所以分两半：前半是纯函数（解析 / 到期判定 / 并集 / 优先级），后半是**真宿主半**
 * （`lib/index.js` 的同步路由 + 用量路由 + 自动同步 tick），用假的 `webServer`/`settings`
 * 与**打桩的 `globalThis.fetch`**驱动。夹具是 2026-09-29 抓的真响应
 * （`test/fixtures/holidays-{2026,2027}.json`，后者当时还是空的 —— 正好钉住第 4 条）。
 *
 * ⚠️ 宿主半那半读的是 `lib/index.js`（构建产物），所以改完源码要先 `node build.mjs`。
 */
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs'
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

function section(title) {
  console.log(`\n${title}`)
}

const settle = (ms = 15) => new Promise(resolve => { setTimeout(resolve, ms) })

/** 轮询等一个条件成立（宿主半的自动同步是 fire-and-forget，不能只靠固定 sleep）。 */
async function waitFor(predicate, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return true
    await settle(10)
  }
  return predicate()
}

mkdirSync(new URL('./.build/', import.meta.url), { recursive: true })
await build({
  entryPoints: ['test/pure-entry.ts'],
  outfile: 'test/.build/holiday-sync.mjs',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['es2022'],
  logLevel: 'warning',
})
const pure = await import(new URL('./.build/holiday-sync.mjs', import.meta.url))

/** 真响应夹具：2026 那份已公布、2027 那份当时还是 `days: []`。 */
const FIXTURE_2026 = readFileSync(new URL('./fixtures/holidays-2026.json', import.meta.url), 'utf8')
const FIXTURE_2027 = readFileSync(new URL('./fixtures/holidays-2027.json', import.meta.url), 'utf8')
const JSON_2026 = JSON.parse(FIXTURE_2026)
const JSON_2027 = JSON.parse(FIXTURE_2027)

/**
 * 2026 年**峰谷制开始之后**（2026-08-16 起）的全部放假日 —— 也是内置表那份。
 * 09-20 与 10-10 是补班日（`isOffDay:false`），**不在这里**。
 */
const AUTUMN_2026 = [
  '2026-09-25', '2026-09-26', '2026-09-27',
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
  '2026-10-05', '2026-10-06', '2026-10-07',
]

/**
 * 夹具里 2026 年**全部**放假日（33 天，含峰谷制开始之前的那几个）与"内置 ∪ 自动"的并集。
 *
 * 峰谷制开始（2026-08-16）之前的日期**不影响任何金额**（`isPeakAt` 第一条就返回"没有高峰"），
 * 但它们会进表 —— 所以断言要按这个真实形状写，而不是"只有 10 天"。
 */
const ALL_2026 = JSON_2026.days.filter(item => item.isOffDay === true).map(item => item.date).sort()
const UNION_2026 = [...new Set([...AUTUMN_2026, ...ALL_2026])].sort()

// ══════════════ 1. parseHolidayYear：只认"放假"，且年份必须对得上 ═══════════
section('1. parseHolidayYear（真响应夹具）')
{
  const days = pure.parseHolidayYear(JSON_2026, 2026)
  check('2026 那份解析得出来', Array.isArray(days))
  const autumn = (days ?? []).filter(date => date >= '2026-08-16')
  check('峰谷制之后的放假日与内置表逐字相同', JSON.stringify(autumn) === JSON.stringify(AUTUMN_2026),
    JSON.stringify(autumn))
  check('补班日 2026-09-20（周日）不在表里', !(days ?? []).includes('2026-09-20'))
  check('补班日 2026-10-10（周六）不在表里', !(days ?? []).includes('2026-10-10'))
  /** 逐条回查夹具：凡收进来的都必须 `isOffDay === true`（这是"不翻倍"的唯一保证）。 */
  const byDate = new Map(JSON_2026.days.map(item => [item.date, item.isOffDay]))
  check('收进来的每一条在夹具里都是 isOffDay:true',
    (days ?? []).every(date => byDate.get(date) === true),
    (days ?? []).filter(date => byDate.get(date) !== true).join('、'))
  check('升序且无重复',
    JSON.stringify(days) === JSON.stringify([...new Set(days ?? [])].sort()))
  check('2027 那份（days 为空）判成"还没公布"= 空数组，不是失败',
    JSON.stringify(pure.parseHolidayYear(JSON_2027, 2027)) === '[]')
  check('年份对不上就是 undefined（防止串年份的文件被采纳）',
    pure.parseHolidayYear(JSON_2026, 2027) === undefined)
  check('字符串年份也认（"2026"）', Array.isArray(pure.parseHolidayYear({ year: '2026', days: [] }, 2026)))
}

section('2. parseHolidayYear（脏输入）')
{
  check('非对象 → undefined', pure.parseHolidayYear('nope', 2026) === undefined)
  check('数组 → undefined', pure.parseHolidayYear([], 2026) === undefined)
  check('null → undefined', pure.parseHolidayYear(null, 2026) === undefined)
  check('days 不是数组 → undefined', pure.parseHolidayYear({ year: 2026, days: 'x' }, 2026) === undefined)
  check('days 缺失 → 空数组（旧版文件形状）', JSON.stringify(pure.parseHolidayYear({ year: 2026 }, 2026)) === '[]')
  const messy = pure.parseHolidayYear({
    year: 2026,
    days: [
      { date: '2026-10-01', isOffDay: true },
      { date: '2026-10-01', isOffDay: true },        // 重复
      { date: '2026-10-01', isOffDay: false },       // 同一天的补班条目：不算
      { date: '2026-10-02', isOffDay: 'true' },      // 字符串 true：**不认**
      { date: '2026-10-03', isOffDay: 1 },           // 数字 1：**不认**
      { date: '2026-13-40', isOffDay: true },        // 非法日期
      { date: '2025-10-04', isOffDay: true },        // 别的年份
      { date: '2026-10-05' },                        // 缺 isOffDay
      { isOffDay: true },                            // 缺 date
      null, 'x', 42,                                 // 垃圾项
    ],
  }, 2026)
  check('脏输入只留下一条合法日期', JSON.stringify(messy) === JSON.stringify(['2026-10-01']),
    JSON.stringify(messy))
  const many = Array.from({ length: 500 }, (_, index) => ({
    date: `2026-${String(1 + Math.floor(index / 28)).padStart(2, '0')}-${String(1 + (index % 28)).padStart(2, '0')}`,
    isOffDay: true,
  }))
  const capped = pure.parseHolidayYear({ year: 2026, days: many }, 2026)
  check(`超过 ${pure.HOLIDAY_MAX_DAYS} 条会被截断`, (capped ?? []).length <= pure.HOLIDAY_MAX_DAYS,
    String((capped ?? []).length))
}

// ══════════════ 3. 到期判定：北京年 + 只有开关真开着才出网 ══════════════════
section('3. holidayYearsWanted / holidaySyncDue')
{
  const now = Date.parse('2026-09-29T03:00:00Z')
  check('2026-09-29（北京）要抓今年与明年',
    JSON.stringify(pure.holidayYearsWanted(now)) === JSON.stringify([2026, 2027]))
  /**
   * 北京年边界：`2025-12-31T16:00Z` 已经是北京时间 2026-01-01 00:00 —— 用 UTC 年就会
   * 在这一刻仍然去抓 2025（而 2026 的元旦安排已经该抓了），跨年那几天全错。
   */
  check('北京年边界（2025-12-31T16:00Z = 北京 2026-01-01）算 2026 年',
    JSON.stringify(pure.holidayYearsWanted(Date.parse('2025-12-31T16:00:00Z'))) === JSON.stringify([2026, 2027]))
  check('差一分钟（北京时间还是 2025）算 2025 年',
    JSON.stringify(pure.holidayYearsWanted(Date.parse('2025-12-31T15:59:00Z'))) === JSON.stringify([2025, 2026]))
  check('非有限数兜到今天（不抛）', pure.holidayYearsWanted(Number.NaN).length === 2)

  const due = options => pure.holidaySyncDue({ nowMs: now, ...options })
  check('开关 undefined → 一个年份都不抓', due({ enabled: undefined }).length === 0)
  check('开关 false → 一个年份都不抓', due({ enabled: false }).length === 0)
  check('开关是字符串 "true" → 不抓（只认真布尔）', due({ enabled: 'true' }).length === 0)
  check('开关是 1 → 不抓', due({ enabled: 1 }).length === 0)
  check('开关真 + 从没抓过 → 今年与明年都要',
    JSON.stringify(due({ enabled: true })) === JSON.stringify([2026, 2027]))
  check('开关真 + 两年都有且刚抓过 → 不再出网',
    due({ enabled: true, yearsHave: [2026, 2027], lastAt: now }).length === 0)
  check('开关真 + 只差明年 → 只抓明年',
    JSON.stringify(due({ enabled: true, yearsHave: [2026], lastAt: now })) === JSON.stringify([2027]))
  check('开关真 + 两年都有但超过 30 天 → 重新复核（次年安排可能刚公布）',
    JSON.stringify(due({ enabled: true, yearsHave: [2026, 2027], lastAt: now - 31 * 86_400_000 }))
    === JSON.stringify([2026, 2027]))
  check('刚好 30 天也算到期（>=）',
    due({ enabled: true, yearsHave: [2026, 2027], lastAt: now - pure.HOLIDAY_STALE_MS }).length === 2)
  check('lastAt 是垃圾值 → 当"从没抓过"',
    due({ enabled: true, yearsHave: [2026, 2027], lastAt: 'x' }).length === 2)
  check('nowMs 非有限 → 不出网', due({ enabled: true, nowMs: Number.NaN }).length === 0)
}

// ══════════════ 4. 并集：年份只增不减，越界丢最早的 ═════════════════════════
section('4. mergeHolidayDays')
{
  check('两边都空 → undefined（调用方用内置表）', pure.mergeHolidayDays(undefined, undefined) === undefined)
  check('空数组也算空', pure.mergeHolidayDays([], []) === undefined)
  check('去重 + 升序',
    JSON.stringify(pure.mergeHolidayDays(['2027-01-01'], ['2026-10-01', '2027-01-01']))
    === JSON.stringify(['2026-10-01', '2027-01-01']))
  check('坏项丢掉（只认 YYYY-MM-DD）',
    JSON.stringify(pure.mergeHolidayDays(['2026-10-01', 'x', '2026-13-01', 5], []))
    === JSON.stringify(['2026-10-01']))
  check('非数组当空（设置里被写成字符串时不炸）',
    JSON.stringify(pure.mergeHolidayDays('2026-10-01', ['2026-10-02'])) === JSON.stringify(['2026-10-02']))
  const old = Array.from({ length: pure.HOLIDAY_MAX_DAYS }, (_, i) =>
    new Date(Date.UTC(2010, 0, 1 + i)).toISOString().slice(0, 10))
  const merged = pure.mergeHolidayDays(old, ['2027-01-01'])
  check('超限时丢掉最早的、保住刚抓回来的',
    merged.length === pure.HOLIDAY_MAX_DAYS && merged[merged.length - 1] === '2027-01-01',
    `${merged.length} / ${merged[merged.length - 1]}`)
}

// ══════════════ 5. 生效表：手填 > 自动 ∪ 内置 ══════════════════════════════
section('5. effectiveHolidays')
{
  const manual = pure.effectiveHolidays(['2027-01-01'], ['2026-10-01'])
  check('手填非空 → 用手填那份', JSON.stringify(manual.days) === JSON.stringify(['2027-01-01']))
  check('手填生效时来源标 manual', manual.source === 'manual')
  check('手填生效时也如实报告自动那份有多少天', manual.autoCount === 1)

  const auto = pure.effectiveHolidays(undefined, ['2027-01-01'])
  check('没有手填 + 有自动 → 来源标 auto', auto.source === 'auto')
  check('自动那份与内置表**取并集**（2026 中秋/国庆那 10 天仍在）',
    JSON.stringify(auto.days) === JSON.stringify([...AUTUMN_2026, '2027-01-01']),
    JSON.stringify(auto.days))

  const fallback = pure.effectiveHolidays(undefined, undefined)
  check('两边都没有 → 内置那份', fallback.source === 'builtin'
    && JSON.stringify(fallback.days) === JSON.stringify(AUTUMN_2026))
  check('手填全是坏日期 → 退回自动/内置（不当成"用户想要空表"）',
    pure.effectiveHolidays(['x', '2026-13-01'], ['2027-01-01']).source === 'auto')
  check('手填重复/乱序 → 消毒后再用',
    JSON.stringify(pure.effectiveHolidays(['2027-01-02', '2026-10-01', '2027-01-02'], []).days)
    === JSON.stringify(['2026-10-01', '2027-01-02']))
  check('自动那份是脏数据 → 等于没有自动',
    pure.effectiveHolidays(undefined, 'nope').source === 'builtin')
}

// ══════════════ 6. fetchHolidayYear：主入口、镜像、失败、未公布 ═════════════
section('6. fetchHolidayYear / fetchHolidayYears（注入 fetcher）')
{
  const urls = pure.holidayYearUrls(2026)
  check('两个入口都指向同一份文件（GitHub raw 主、jsDelivr 备）',
    urls.primary.includes('raw.githubusercontent.com') && urls.mirror.includes('jsdelivr.net')
    && urls.primary.endsWith('/2026.json') && urls.mirror.endsWith('/2026.json'),
    JSON.stringify(urls))
  const response = (ok, text) => ({ ok, text: async () => text })
  const record = (handler) => {
    const calls = []
    return {
      calls,
      fetcher: async (url) => {
        calls.push(String(url))
        return handler(String(url))
      },
    }
  }
  {
    const stub = record(() => response(true, FIXTURE_2026))
    const days = await pure.fetchHolidayYear(2026, { fetcher: stub.fetcher })
    check('主入口成功就用它（不碰镜像）', Array.isArray(days) && stub.calls.length === 1, String(stub.calls.length))
  }
  {
    const stub = record(url => (url.includes('raw.githubusercontent') ? response(false, '') : response(true, FIXTURE_2026)))
    const days = await pure.fetchHolidayYear(2026, { fetcher: stub.fetcher })
    check('主入口非 2xx → 退镜像', (days ?? []).length > 0 && stub.calls.length === 2, JSON.stringify(stub.calls))
  }
  {
    const stub = record(url => {
      if (url.includes('raw.githubusercontent')) throw new Error('network down')
      return response(true, FIXTURE_2026)
    })
    const days = await pure.fetchHolidayYear(2026, { fetcher: stub.fetcher })
    check('主入口抛错 → 退镜像（不把异常抛给调用方）', (days ?? []).length > 0)
  }
  {
    const stub = record(() => response(false, ''))
    const days = await pure.fetchHolidayYear(2026, { fetcher: stub.fetcher })
    check('两个入口都失败 → undefined（调用方据此"什么都不改"）', days === undefined)
    check('两个入口都试过了', stub.calls.length === 2)
  }
  {
    const stub = record(() => response(true, '<html>Cloudflare 挡了</html>'))
    check('返回 HTML 错误页 → undefined（不是 JSON）',
      await pure.fetchHolidayYear(2026, { fetcher: stub.fetcher }) === undefined)
  }
  {
    const stub = record(() => response(true, '{}'))
    check('正文过短 → undefined', await pure.fetchHolidayYear(2026, { fetcher: stub.fetcher }) === undefined)
  }
  {
    const stub = record(() => response(true, FIXTURE_2027))
    check('2027 那份就是"还没公布"= 空数组',
      JSON.stringify(await pure.fetchHolidayYear(2027, { fetcher: stub.fetcher })) === '[]')
  }
  {
    const stub = record(url => response(true, url.includes('2027') ? FIXTURE_2027 : FIXTURE_2026))
    const result = await pure.fetchHolidayYears([2026, 2027], { fetcher: stub.fetcher })
    check('多年份：2026 进 fetched、2027 进 unpublished',
      JSON.stringify(result.fetched) === JSON.stringify([2026])
      && JSON.stringify(result.unpublished) === JSON.stringify([2027])
      && result.failed.length === 0,
      JSON.stringify(result))
    check('返回的日期就是 2026 那份夹具里的全部放假日（含峰谷制之前的，它们不影响金额）',
      JSON.stringify(result.days) === JSON.stringify(ALL_2026), JSON.stringify(result.days.slice(0, 4)))
  }
  {
    const stub = record(() => response(false, ''))
    const result = await pure.fetchHolidayYears([2026, 2027], { fetcher: stub.fetcher })
    check('全部失败：failed 两年都有、days 为空',
      JSON.stringify(result.failed) === JSON.stringify([2026, 2027]) && result.days.length === 0,
      JSON.stringify(result))
  }
}

// ══════════════ 7. 真宿主半：开关、路由、写入、优先级 ══════════════════════
section('7. 宿主半（lib/index.js + 假 webServer/settings + 打桩 fetch）')
{
  const NAMESPACE = 'composer-ux'
  const SYNC_PATH = pure.SYNC_API_PATH
  const USAGE_PATH = pure.USAGE_API_PATH

  process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'dsh-holiday-home-'))
  const realFetch = globalThis.fetch

  const setPath = (root, path, value) => {
    let cursor = root
    for (let i = 0; i < path.length - 1; i += 1) {
      if (typeof cursor[path[i]] !== 'object' || cursor[path[i]] === null) cursor[path[i]] = {}
      cursor = cursor[path[i]]
    }
    cursor[path[path.length - 1]] = value
  }

  /**
   * 造一个假宿主并跑 `apply`（打桩必须发生在 `apply` **之前**：申请求是在 tick 里发的）。
   *
   * @param seed 初始的「命名空间 → 值」。
   * @param urlBodies URL 片段 → 正文（按插入顺序第一个命中的生效；没命中的当 500）。
   */
  async function bootHost(seed = {}, urlBodies = {}) {
    const routes = []
    const fetchCalls = []
    const state = structuredClone(seed)
    const settings = {
      describe: () => Object.entries(state).map(([ns, value]) => ({ ns, value })),
      mutate: async (ns, ops) => {
        if (state[ns] === undefined) state[ns] = {}
        for (const op of ops) {
          if (op.op === 'set') setPath(state[ns], op.path, op.value)
          else delete state[ns][op.path[op.path.length - 1]]
        }
      },
    }
    const services = {
      settings,
      // 用量路由（生效节假日表就是它回给界面的）需要 sessions；sessionQuery 走 `get` 读。
      sessions: { list: () => [{ id: 's1', seq: 0 }] },
      sessionQuery: { readSession: async () => ({ events: [] }) },
      webServer: { register: route => { routes.push(route); return () => {} } },
      effect: (fn) => { const dispose = fn(); return () => { if (typeof dispose === 'function') dispose() } },
      get: name => services[name],
    }
    globalThis.fetch = async (url) => {
      const target = String(url)
      fetchCalls.push(target)
      const hit = Object.keys(urlBodies).find(needle => target.includes(needle))
      const body = hit === undefined ? undefined : urlBodies[hit]
      return body === undefined
        ? { ok: false, status: 500, text: async () => '' }
        : { ok: true, status: 200, text: async () => body }
    }
    apply({
      inject: (deps, callback) => { if (deps.every(dep => services[dep] !== undefined)) callback(services) },
      effect: services.effect,
      on: () => {},
    })
    await settle(20)
    return {
      state,
      fetchCalls,
      routeOf: path => routes.find(route => route.path === path),
      restore: () => { globalThis.fetch = realFetch },
    }
  }

  const makeReq = (path, body) => ({
    method: body === undefined ? 'GET' : 'POST',
    url: path,
    async *[Symbol.asyncIterator]() { if (body !== undefined) yield Buffer.from(JSON.stringify(body), 'utf8') },
  })
  const makeRes = () => {
    const captured = { status: 0, body: '' }
    return {
      captured,
      writeHead: code => { captured.status = code },
      end: payload => { captured.body = payload ?? '' },
      get statusCode() { return captured.status },
      set statusCode(code) { captured.status = code },
    }
  }
  /** 驱动一条路由并等它写完（路由内部有时是 fire-and-forget 的 async）。 */
  const call = async (route, req) => {
    const res = makeRes()
    route.handler(req, res)
    const deadline = Date.now() + 2000
    while (res.captured.body === '' && Date.now() < deadline) await settle(10)
    return { status: res.captured.status, body: res.captured.body === '' ? {} : JSON.parse(res.captured.body) }
  }

  // 两个年份的正文按年份片段匹配（主入口与镜像都带年份）。
  const BOTH_YEARS = { '2026.json': FIXTURE_2026, '2027.json': FIXTURE_2027 }

  // ── 7.1 开关默认关 ⇒ 一个请求都不发 ────────────────────────────────────────
  {
    const host = await bootHost({ [NAMESPACE]: { enabled: true } }, BOTH_YEARS)
    await settle(150)
    check('开关默认关时，启动后一个网络请求都没发（"要联网先让你点头"）',
      host.fetchCalls.length === 0, JSON.stringify(host.fetchCalls))
    check('也没写任何同步元信息', host.state[NAMESPACE].syncedPrices === undefined)
    host.restore()
  }

  // ── 7.2 开关打开 ⇒ 同一个 tick 里连节假日一起抓 ─────────────────────────────
  {
    const host = await bootHost({ [NAMESPACE]: { enabled: true, priceAutoSync: true } }, BOTH_YEARS)
    const ok = await waitFor(() => host.state[NAMESPACE]?.syncedPrices?.holidays !== undefined)
    const synced = host.state[NAMESPACE].syncedPrices ?? {}
    check('开关打开后，启动 tick 自动把节假日抓回来并写进设置', ok, JSON.stringify(host.fetchCalls))
    check('写进去的就是"内置 ∪ 自动"那份（2026 全年 33 天，含峰谷制之前的）',
      JSON.stringify(synced.holidays) === JSON.stringify(UNION_2026), JSON.stringify(synced.holidays.slice(0, 4)))
    check('补班日没有被写进去',
      !(synced.holidays ?? []).includes('2026-09-20') && !(synced.holidays ?? []).includes('2026-10-10'))
    check('年份元信息只记已公布的 2026（2027 未公布）',
      JSON.stringify(synced.holidayYears) === JSON.stringify([2026]), JSON.stringify(synced.holidayYears))
    check('写下了获取时刻', typeof synced.holidaysAt === 'number' && synced.holidaysAt > 0)
    check('同一次 tick 也去抓了官方价格页（一把开关管两件事）',
      host.fetchCalls.some(url => url.includes('api-docs.deepseek.com')), JSON.stringify(host.fetchCalls))
    check('也从没碰过 models.dev（那是另一条独立的路）',
      !host.fetchCalls.some(url => url.includes('models.dev')))
    host.restore()
  }

  // ── 7.3 手动「获取法定节假日」：路由 + 生效表 + 补班日 ──────────────────────
  {
    const host = await bootHost({ [NAMESPACE]: { enabled: true } }, BOTH_YEARS)
    const sync = host.routeOf(SYNC_PATH)
    const usage = host.routeOf(USAGE_PATH)
    check('同步路由注册了', sync !== undefined)
    check('用量路由注册了', usage !== undefined)
    const before = await call(usage, makeReq(`${USAGE_PATH}?sessionId=s1`))
    check('同步之前，生效表就是内置那 10 天（没开自动同步）',
      JSON.stringify(before.body.holidays) === JSON.stringify(AUTUMN_2026), JSON.stringify(before.body.holidays))

    const result = await call(sync, makeReq(SYNC_PATH, { target: 'holidays' }))
    check('target=holidays 回 200 且 ok',
      result.status === 200 && result.body.ok === true, JSON.stringify(result.body))
    check('回复里说清了拿到哪些年、以及 2027 还没公布',
      String(result.body.message).includes('2026') && String(result.body.message).includes('还没公布'),
      String(result.body.message))
    check(`回复里的天数是并集后的 ${UNION_2026.length} 天`, result.body.days === UNION_2026.length, String(result.body.days))
    check('设置里写下了 2026 这年',
      JSON.stringify(host.state[NAMESPACE].syncedPrices.holidayYears) === JSON.stringify([2026]))
    check('只点了这一条路（没给 models.dev / 官方价页发请求）',
      host.fetchCalls.every(url => url.includes('holiday-cn')), JSON.stringify(host.fetchCalls))

    const after = await call(usage, makeReq(`${USAGE_PATH}?sessionId=s1`))
    check('写完之后生效表就是并集那份（33 天：内置 10 ∪ 自动 33）',
      JSON.stringify(after.body.holidays) === JSON.stringify(UNION_2026), JSON.stringify(after.body.holidays.slice(0, 4)))
    check('补班日没进生效表（否则 10-10 那天金额会翻倍）',
      !(after.body.holidays ?? []).includes('2026-09-20') && !(after.body.holidays ?? []).includes('2026-10-10'))

    const bad = await call(sync, makeReq(SYNC_PATH, { target: 'nonsense' }))
    check('target 不合法回 400', bad.status === 400 && bad.body.ok === false, JSON.stringify(bad.body))
    host.restore()
  }

  // ── 7.4 手填优先：自动获取盖不过用户那张表 ─────────────────────────────────
  {
    const host = await bootHost({ [NAMESPACE]: { enabled: true, peakHolidays: ['2027-01-01', '2027-01-02'] } }, BOTH_YEARS)
    const sync = host.routeOf(SYNC_PATH)
    const usage = host.routeOf(USAGE_PATH)
    const result = await call(sync, makeReq(SYNC_PATH, { target: 'holidays' }))
    check('自动获取照样成功、也照样写进设置', result.body.ok === true
      && Array.isArray(host.state[NAMESPACE].syncedPrices.holidays))
    const after = await call(usage, makeReq(`${USAGE_PATH}?sessionId=s1`))
    check('但生效表仍然逐字等于用户手填的那份',
      JSON.stringify(after.body.holidays) === JSON.stringify(['2027-01-01', '2027-01-02']),
      JSON.stringify(after.body.holidays))
    host.restore()
  }

  // ── 7.5 抓不到 ⇒ 什么都不改 ────────────────────────────────────────────────
  {
    const host = await bootHost({ [NAMESPACE]: { enabled: true } }, {})
    const sync = host.routeOf(SYNC_PATH)
    const result = await call(sync, makeReq(SYNC_PATH, { target: 'holidays' }))
    check('两个入口都失败 → ok:false', result.body.ok === false, JSON.stringify(result.body))
    check('失败文案说清"未改动"', String(result.body.error).includes('未改动'), String(result.body.error))
    check('设置里一个字都没写（syncedPrices 仍是 undefined）',
      host.state[NAMESPACE].syncedPrices === undefined, JSON.stringify(host.state[NAMESPACE].syncedPrices))
    check('两个入口都试过了（主 + 镜像）', host.fetchCalls.length === 4, String(host.fetchCalls.length))
    host.restore()
  }

  // ── 7.6 镜像兜底 ───────────────────────────────────────────────────────────
  {
    const host = await bootHost({ [NAMESPACE]: { enabled: true } }, { jsdelivr: FIXTURE_2026 })
    const sync = host.routeOf(SYNC_PATH)
    const result = await call(sync, makeReq(SYNC_PATH, { target: 'holidays' }))
    check('GitHub raw 挂了时由 jsDelivr 兜住', result.body.ok === true && result.body.days === UNION_2026.length,
      JSON.stringify(result.body))
    check('确实试过镜像', host.fetchCalls.some(url => url.includes('jsdelivr')), JSON.stringify(host.fetchCalls))
    host.restore()
  }
}

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
