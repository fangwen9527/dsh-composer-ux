/**
 * 「价目同步」（0.10.0）的纯逻辑测试。
 *
 *   node test/price-sync.mjs
 *
 * 这块能力会**出网**并**写盘**，所以最贵的错误不是"数字算错"，而是**把本地价覆盖成垃圾**：
 * 页面改版、CDN 挡了、网络断了、响应是半个 JSON —— 任何一种都不许动本地那份价目。
 * 所以这里的断言分两半：
 *
 *  1. **消毒**：`compactModelsDev` / `eraFromOfficial` / `samePriceTable` 对脏输入的行为
 *     （坏项丢掉、两页缺一不可、一条都收不到就是 undefined）；
 *  2. **失败路径**：`fetchOfficialPages` / `fetchModelsDevPrices` 在"抛错 / 非 2xx /
 *     正文过短"三种情况下必须回 undefined —— 调用方（`src/host.ts` 的同步路由）据此
 *     回 `ok:false` 并且**不改任何东西**。
 *
 * 官方页解析本身的正确性由 `test/official-pricing.mjs` 对着真页面夹具钉住（45 条）；
 * 这里只保证"两页合成一档"的规则对，所以直接复用 `parseOfficialPricingPage` 读同一份夹具。
 */
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'

let failures = 0
let passes = 0

function check(label, condition, detail) {
  if (condition) { passes += 1; console.log(`  ✓ ${label}`); return }
  failures += 1
  console.log(`  ✗ ${label}${detail === undefined ? '' : ` — ${detail}`}`)
}

mkdirSync(new URL('./.build/', import.meta.url), { recursive: true })
await build({
  entryPoints: ['test/pure-entry.ts'],
  outfile: 'test/.build/price-sync.mjs',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['es2022'],
  logLevel: 'warning',
})
const ours = await import(new URL('./.build/price-sync.mjs', import.meta.url))

/** 真页面夹具（2026-09-29 抓的官方中英文页）。 */
const ZH_HTML = readFileSync(new URL('./fixtures/official-pricing.zh.html', import.meta.url), 'utf8')
const EN_HTML = readFileSync(new URL('./fixtures/official-pricing.en.html', import.meta.url), 'utf8')
const ZH_PAGE = ours.parseOfficialPricingPage(ZH_HTML)
const EN_PAGE = ours.parseOfficialPricingPage(EN_HTML)

/** 造一个假 fetch：按 URL 回指定结果（用来测"失败路径"，不真的出网）。 */
function fakeFetch(handler) {
  return async (url, init) => handler(String(url), init)
}
/** 造一个成功响应。 */
function okResponse(text) {
  return { ok: true, status: 200, text: async () => text }
}

console.log('1. 来源常量')
check('官方两页 URL 都在 api-docs.deepseek.com',
  ours.OFFICIAL_PRICING_URLS.cny.startsWith('https://api-docs.deepseek.com/')
  && ours.OFFICIAL_PRICING_URLS.usd.startsWith('https://api-docs.deepseek.com/'))
check('中文页与英文页不是同一个 URL', ours.OFFICIAL_PRICING_URLS.cny !== ours.OFFICIAL_PRICING_URLS.usd)
check('models.dev 注册表 URL', ours.MODELS_DEV_URL === 'https://models.dev/api.json')
check('价目文件落在 storages/composer-ux 下', ours.priceStorePath().replace(/\\/g, '/').endsWith('/storages/composer-ux/prices.json'))

console.log('2. compactModelsDev：models.dev 响应 → 我们的价目表')
const registry = {
  deepinfra: { models: { 'tencent/Hy3': { cost: { input: 0.13, output: 0.53, cache_read: 0.033 } } } },
  openai: {
    models: {
      'gpt-x': { cost: { input: 2, output: 10, cache_read: 0.2 } },
      'no-cache': { cost: { input: 1, output: 4 } },
      'bad-missing-output': { cost: { input: 1 } },
      'bad-nan': { cost: { input: Number.NaN, output: 1 } },
      'bad-negative': { cost: { input: -1, output: 1 } },
      'bad-string': { cost: { input: '2', output: 1 } },
      'no-cost': { name: 'x' },
    },
  },
  // 纪律 3：models.dev 的 DeepSeek 行必须整块丢掉（它只有平坦的谷价，没有峰谷与历史档）
  deepseek: { models: { 'deepseek-flash': { cost: { input: 0.15, output: 0.6, cache_read: 0.003 } } } },
  empty: { models: {} },
  broken: 42,
  // 把 payload 撑过 1000 字符：实现里有一条保险——正文短于 1000 字符一律当失败
  // （防止 CDN 塞一页错误 HTML 进来被当成价目），所以成功的用例必须先过这一关。
  padding: {
    models: Object.fromEntries(Array.from({ length: 60 }, (_, i) => [
      `model-${i}`,
      { cost: { input: i + 1, output: i + 2 } },
    ])),
  },
}
const compact = ours.compactModelsDev(registry)
check('收得到', compact !== undefined)
check('deepseek 整块被丢掉（留在表里迟早被误用成 DeepSeek 单价）', compact.deepseek === undefined)
check('空 provider 不收', compact.empty === undefined)
check('非对象 provider 不收', compact.broken === undefined)
check('正常条目按 input/output/cache_read 映射',
  JSON.stringify(compact.deepinfra['tencent/hy3']) === JSON.stringify({ miss: 0.13, hit: 0.033, out: 0.53 }))
check('缺 cache_read → hit 沿用 miss（"没公布缓存价就按普通输入计"）',
  JSON.stringify(compact.openai['no-cache']) === JSON.stringify({ miss: 1, hit: 1, out: 4 }))
check('模型 id 归一小写', compact.openai['gpt-x'] !== undefined)
check('缺 output 的丢掉', compact.openai['bad-missing-output'] === undefined)
check('NaN 丢掉', compact.openai['bad-nan'] === undefined)
check('负数丢掉', compact.openai['bad-negative'] === undefined)
check('字符串数字丢掉（不猜类型）', compact.openai['bad-string'] === undefined)
check('没有 cost 的丢掉', compact.openai['no-cost'] === undefined)
check('全空输入 → undefined', ours.compactModelsDev({}) === undefined)
check('非对象输入 → undefined',
  ours.compactModelsDev(null) === undefined
  && ours.compactModelsDev('x') === undefined
  && ours.compactModelsDev([1]) === undefined)

/** 逐字段比一个单价三元组（**不**用 JSON.stringify 比：键序由来源对象决定，比不出对错）。 */
function tripleEq(actual, miss, hit, out) {
  return actual !== undefined && actual.miss === miss && actual.hit === hit && actual.out === out
}

console.log('3. eraFromOfficial：两页 → 一个价格档')
const era = ours.eraFromOfficial(ZH_PAGE, EN_PAGE, Date.parse('2026-09-29T01:00:00Z'), 'test')
check('合成得出', era !== undefined)
check('两个模型都在（deepseek-flash / deepseek-v4-pro）',
  Object.keys(era.table).sort().join(',') === 'deepseek-flash,deepseek-v4-pro',
  Object.keys(era.table).join(','))
check('人民币列取自中文页', tripleEq(era.table['deepseek-flash'].peak.cny, 2, 0.04, 8),
  JSON.stringify(era.table['deepseek-flash'].peak.cny))
check('美元列取自英文页', tripleEq(era.table['deepseek-flash'].peak.usd, 0.3, 0.006, 1.2),
  JSON.stringify(era.table['deepseek-flash'].peak.usd))
check('Pro 谷价两列都对',
  tripleEq(era.table['deepseek-v4-pro'].offPeak.cny, 4.5, 0.15, 13.5)
  && tripleEq(era.table['deepseek-v4-pro'].offPeak.usd, 0.66, 0.022, 1.98),
  JSON.stringify(era.table['deepseek-v4-pro'].offPeak))
check('生效时刻与出处写进档里',
  era.fromMs === Date.parse('2026-09-29T01:00:00Z') && era.source === 'test' && era.id.startsWith('sync-'))
// 只有一页认得某个模型 → 那个模型不许进表（少一个模型只是它退回内置价；编一个价会让账单错）
const zhOnly = { currency: 'CNY', table: { 'deepseek-flash': ZH_PAGE.table['deepseek-flash'], 'deepseek-new': ZH_PAGE.table['deepseek-v4-pro'] }, aliases: {} }
const merged = ours.eraFromOfficial(zhOnly, EN_PAGE, 1, 'test')
check('只有一页认得的模型被跳过', merged !== undefined && merged.table['deepseek-new'] === undefined)
check('两页都认得的仍在', merged !== undefined && merged.table['deepseek-flash'] !== undefined)
check('没有任何共同模型 → undefined',
  ours.eraFromOfficial(zhOnly, { currency: 'USD', table: {}, aliases: {} }, 1, 'test') === undefined)

console.log('4. samePriceTable：决定"要不要建新档"')
const current = ours.eraFromOfficial(ZH_PAGE, EN_PAGE, 1, 'x')
const same = ours.eraFromOfficial(ZH_PAGE, EN_PAGE, 2, 'y')
check('同样的数 → true（不建新档）', ours.samePriceTable(current.table, same.table) === true)
check('自己比自己 → true', ours.samePriceTable(current.table, current.table) === true)
const changed = { ...current.table, 'deepseek-flash': { peak: { cny: { miss: 3, hit: 0.04, out: 8 }, usd: { miss: 0.3, hit: 0.006, out: 1.2 } }, offPeak: current.table['deepseek-flash'].offPeak } }
check('有一个数字变了 → false（建新档）', ours.samePriceTable(current.table, changed) === false)
const fewer = { 'deepseek-flash': current.table['deepseek-flash'] }
check('少一个模型 → false', ours.samePriceTable(current.table, fewer) === false)
const hitDiff = { ...current.table, 'deepseek-flash': { peak: { cny: { miss: 2, hit: 0.05, out: 8 }, usd: current.table['deepseek-flash'].peak.usd }, offPeak: current.table['deepseek-flash'].offPeak } }
check('只差 hit 也认得出来', ours.samePriceTable(current.table, hitDiff) === false)

console.log('5. 抓取失败路径（纪律：失败绝不覆盖本地价）')
check('官方两页正常 → 两页都解析出来',
  (await ours.fetchOfficialPages({ fetcher: fakeFetch(url => okResponse(url.includes('/zh-cn/') ? ZH_HTML : EN_HTML)) })) !== undefined)
check('网络抛错 → undefined',
  (await ours.fetchOfficialPages({ fetcher: fakeFetch(() => { throw new Error('offline') }) })) === undefined)
check('非 2xx → undefined',
  (await ours.fetchOfficialPages({ fetcher: fakeFetch(() => ({ ok: false, status: 503, text: async () => ZH_HTML })) })) === undefined)
check('正文过短（被 CDN 挡了/改版成错误页）→ undefined',
  (await ours.fetchOfficialPages({ fetcher: fakeFetch(() => okResponse('<html>nope</html>')) })) === undefined)
// 长度保险本身：`fetchText` 是**唯一**一处能观察它的地方 —— `fetchOfficialPages` /
// `fetchModelsDevPrices` 在它之后还有解析关卡，短正文本来也过不了解析，所以"拆掉保险"
// 在那两个函数上看不出来（2026-09-29 变异测试实测：拆掉后 test/price-sync.mjs 仍全绿）。
// 这条保险防的是"CDN/改版返回一页错误 HTML 被当成新价目写进档"，必须能咬住。
check('正文短于 minLength 一律当失败（哪怕它是完整合法的 JSON）',
  (await ours.fetchText('https://example.com/x.json', {
    fetcher: fakeFetch(() => okResponse('{"ok":1}')),
    minLength: 100,
  })) === undefined)
check('正文够长时照常返回（保险不是把一切都挡掉）',
  (await ours.fetchText('https://example.com/x.json', {
    fetcher: fakeFetch(() => okResponse(`{"ok":1,"pad":"${'x'.repeat(120)}"}`)),
    minLength: 100,
  })) !== undefined)
check('不给 minLength 就不做长度判断（调用方按需从严）',
  (await ours.fetchText('https://example.com/x.json', {
    fetcher: fakeFetch(() => okResponse('{"ok":1}')),
  })) !== undefined)
check('只有一页成功 → undefined（缺一边就不猜）',
  (await ours.fetchOfficialPages({ fetcher: fakeFetch(url => (url.includes('/zh-cn/') ? okResponse(ZH_HTML) : { ok: false, status: 500, text: async () => '' })) })) === undefined)
check('正文是垃圾 HTML → undefined（解析不出来）',
  (await ours.fetchOfficialPages({ fetcher: fakeFetch(() => okResponse('<html>' + 'x'.repeat(2000) + '</html>')) })) === undefined)
check('models.dev 正常 → 压成表',
  (await ours.fetchModelsDevPrices({ fetcher: fakeFetch(() => okResponse(JSON.stringify(registry))) })) !== undefined)
check('payload 本身够长（否则上面那条是被长度保险放过去的假通过）',
  JSON.stringify(registry).length >= 1000, String(JSON.stringify(registry).length))
check('models.dev 抛错 → undefined',
  (await ours.fetchModelsDevPrices({ fetcher: fakeFetch(() => { throw new Error('offline') }) })) === undefined)
check('models.dev 不是 JSON → undefined',
  (await ours.fetchModelsDevPrices({ fetcher: fakeFetch(() => okResponse('x'.repeat(2000))) })) === undefined)
check('models.dev 响应过短 → undefined',
  (await ours.fetchModelsDevPrices({ fetcher: fakeFetch(() => okResponse('{}')) })) === undefined)

console.log('6. 价目文件读写的失败路径')
const dir = join(tmpdir(), `composer-ux-price-test-${process.pid}`)
const file = join(dir, 'prices.json')
check('文件不存在 → 空对象（不抛）', JSON.stringify(await ours.readPriceFile(file)) === '{}')
await ours.writePriceFile({ fetchedAt: 123, providers: compact }, file)
const round = await ours.readPriceFile(file)
check('写进去能读回来（含 fetchedAt）', round.fetchedAt === 123)
check('provider/model 都回来了（键小写）', round.providers?.openai?.['gpt-x']?.miss === 2)
const { writeFileSync } = await import('node:fs')
writeFileSync(file, '{ this is not json', 'utf8')
check('文件坏了 → 空对象（当"没有第三方价目"，绝不抛给路由）', JSON.stringify(await ours.readPriceFile(file)) === '{}')
writeFileSync(file, JSON.stringify({ fetchedAt: 'x', providers: { openai: { 'gpt-x': { miss: 'bad' } } } }), 'utf8')
const dirty = await ours.readPriceFile(file)
check('坏字段被消毒掉', dirty.fetchedAt === undefined && dirty.providers === undefined)
rmSync(dir, { recursive: true, force: true })

console.log('7. autoSyncDue：该不该自己出网（默认关，纯函数）')
const DAY = ours.AUTO_SYNC_STALE_MS
check('默认最小间隔是一天', DAY === 24 * 3_600_000)
check('开关没开（undefined / false / 字符串 / 1）一律不跑',
  ours.autoSyncDue({ enabled: undefined, fetchedAt: 0, nowMs: 1e12 }) === false
  && ours.autoSyncDue({ enabled: false, fetchedAt: 0, nowMs: 1e12 }) === false
  && ours.autoSyncDue({ enabled: 'true', fetchedAt: 0, nowMs: 1e12 }) === false
  && ours.autoSyncDue({ enabled: 1, fetchedAt: 0, nowMs: 1e12 }) === false)
check('开关开着 + 从没同步过 → 该跑', ours.autoSyncDue({ enabled: true, fetchedAt: 0, nowMs: 1e12 }) === true)
check('开关开着 + fetchedAt 认不出（脏数据）→ 当从没同步过 → 该跑',
  ours.autoSyncDue({ enabled: true, fetchedAt: 'x', nowMs: 1e12 }) === true
  && ours.autoSyncDue({ enabled: true, fetchedAt: Number.NaN, nowMs: 1e12 }) === true)
check('刚同步过 → 不跑', ours.autoSyncDue({ enabled: true, fetchedAt: 1e12, nowMs: 1e12 }) === false)
check('差 1 毫秒不到一天 → 不跑', ours.autoSyncDue({ enabled: true, fetchedAt: 1e12 - DAY + 1, nowMs: 1e12 }) === false)
check('正好满一天 → 跑（边界含等号）', ours.autoSyncDue({ enabled: true, fetchedAt: 1e12 - DAY, nowMs: 1e12 }) === true)
check('超过一天 → 跑', ours.autoSyncDue({ enabled: true, fetchedAt: 1e12 - DAY * 3, nowMs: 1e12 }) === true)
check('nowMs 不是有限数 → 不跑（绝不因为时钟读不到就出网）',
  ours.autoSyncDue({ enabled: true, fetchedAt: 0, nowMs: Number.NaN }) === false)
check('staleMs 可覆盖（测试与将来"改频率"都靠它）',
  ours.autoSyncDue({ enabled: true, fetchedAt: 1e12 - 60_000, nowMs: 1e12, staleMs: 60_000 }) === true
  && ours.autoSyncDue({ enabled: true, fetchedAt: 1e12 - 59_999, nowMs: 1e12, staleMs: 60_000 }) === false)

console.log(`\n${passes} passed / ${failures} failed`)
if (failures > 0) process.exitCode = 1
