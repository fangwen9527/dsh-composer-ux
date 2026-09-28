/**
 * 真机联网复核（**手动跑，不进 `npm test`**）：拿构建用的同一份源码去打真实网络。
 *
 *   node scripts/live-smoke.mjs
 *
 * 为什么要有它：`npm test` 里的出网路径全部用**假 fetcher**（测试不该依赖网络），所以
 * "同步按钮能抓到价""价目表没抄错"在单测里只是**没被证伪**，不是被证明。这个脚本补上：
 *
 *   [1] 官方价格页两页 → 解析 → 与我们**写死的现役档**逐格对比（这一条等于每天给价目表对账）；
 *   [2] models.dev 注册表 → 压缩 → 与**内置快照**逐条对比，并确认 `deepseek` 整块被丢掉；
 *   [3] 余额端点的白名单与真实状态码（用**假 Key**，只打印状态码，绝不打印 Key）。
 *
 * 只读：**不写** `$DSH_HOME` 下任何文件（`fetchModelsDevPrices` 只返回表，落盘是调用方的事）。
 * 需要网络；失败会如实打印 ✗，不代表插件坏了，只代表这一次没复核成。
 */
import { build } from 'esbuild'
import { mkdirSync } from 'node:fs'

const OUT = 'test/.build/live-smoke'
mkdirSync(OUT, { recursive: true })
await build({
  entryPoints: ['src/price-sync.ts', 'src/pricing.ts', 'src/balance.ts'],
  outdir: OUT,
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['es2022'],
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning',
})

const sync = await import(`../${OUT}/price-sync.mjs`)
const pricing = await import(`../${OUT}/pricing.mjs`)
const balance = await import(`../${OUT}/balance.mjs`)

let failures = 0
const line = (label, ok, detail) => {
  if (!ok) failures += 1
  console.log(`${ok ? '✓' : '✗'} ${label}${detail === undefined ? '' : ' — ' + detail}`)
}

// ── [1] 官方价格页 ─────────────────────────────────────────────────────────
console.log('\n[1] 官方价格页（真实网络）')
const pages = await sync.fetchOfficialPages()
line('两页都抓到并解析出来了', pages !== undefined,
  pages === undefined ? 'undefined' : `zh 表 ${Object.keys(pages.cny.table).length} 个模型 / en 表 ${Object.keys(pages.usd.table).length} 个模型`)
if (pages !== undefined) {
  const era = sync.eraFromOfficial(pages.cny, pages.usd, Date.parse('2026-09-29T00:00:00Z'), 'live-smoke')
  line('能合成一个价格档（两页缺一不可）', era !== undefined, era === undefined ? 'undefined' : `id=${era.id}`)
  if (era !== undefined) {
    const builtin = pricing.eraById(pricing.CURRENT_ERA_ID).table
    line('实时页的模型集合与写死的现役档一致',
      JSON.stringify(Object.keys(era.table).sort()) === JSON.stringify(Object.keys(builtin).sort()),
      `live ${Object.keys(era.table).join(',')} vs builtin ${Object.keys(builtin).join(',')}`)
    const six = side => [side.peak.cny.miss, side.peak.cny.hit, side.peak.cny.out,
      side.offPeak.cny.miss, side.offPeak.cny.hit, side.offPeak.cny.out].map(Number)
    for (const model of Object.keys(builtin)) {
      const live = era.table[model]
      if (live === undefined) { line(`${model} 在实时页里存在`, false); continue }
      const same = JSON.stringify(six(live)) === JSON.stringify(six(builtin[model]))
      line(`${model} 人民币六格（峰 miss/hit/out · 谷 miss/hit/out）与实时页一致`, same,
        same ? `live = ${six(live).join(' / ')}` : `live ${six(live)} vs written ${six(builtin[model])}`)
    }
  }
}

// ── [2] models.dev ─────────────────────────────────────────────────────────
console.log('\n[2] models.dev 注册表（真实网络，5 MB 级）')
const providers = await sync.fetchModelsDevPrices()
if (providers === undefined) {
  line('抓到并压缩', false, 'undefined')
} else {
  let models = 0
  for (const table of Object.values(providers)) models += Object.keys(table).length
  line('抓到并压缩', true,
    `${Object.keys(providers).length} 个 provider / ${models} 个模型 / JSON ${JSON.stringify(providers).length} 字节`)
  line('deepseek 整块被丢掉（那边只有平坦谷价）', providers.deepseek === undefined)
  const snapshot = pricing.BUILTIN_PROVIDER_PRICES
  const shared = Object.keys(snapshot).filter(id => providers[id] !== undefined)
  line('内置快照与实时数据有可比的 provider', shared.length > 0, shared.join(','))
  for (const provider of shared) {
    const ids = Object.keys(snapshot[provider])
    let same = 0
    for (const id of ids) {
      const live = providers[provider][id]
      const mine = snapshot[provider][id]
      if (live !== undefined && live.miss === mine.miss && live.hit === mine.hit && live.out === mine.out) same += 1
    }
    line(`内置快照 ${provider}：${same}/${ids.length} 条与实时一致`, same === ids.length,
      same === ids.length ? '完全一致' : '注册表这段时间改过；用户点一次「同步第三方价目」就会盖上')
  }
  // 快照日期是**北京日期**（与生成器一致），所以这里也按北京时间比，别拿 UTC 的"今天"去比成未来。
  const beijingToday = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)
  line('快照日期不晚于北京今天（不是未来时间）',
    pricing.PROVIDER_PRICES_SNAPSHOT_AT <= beijingToday,
    `快照 ${pricing.PROVIDER_PRICES_SNAPSHOT_AT} / 北京今天 ${beijingToday}`)
}

// ── [3] 余额端点（假 Key）─────────────────────────────────────────────────
console.log('\n[3] 余额端点（假 Key；只看状态码）')
line('白名单只放行 api.deepseek.com（拒子域 / 伪装域）',
  balance.balanceEndpointAllowed('https://api.deepseek.com')
  && !balance.balanceEndpointAllowed('https://api.deepseek.com.evil.com')
  && !balance.balanceEndpointAllowed('https://sub.api.deepseek.com')
  && !balance.balanceEndpointAllowed('http://api.deepseek.com'))
try {
  const res = await fetch(balance.DEEPSEEK_BALANCE_URL, {
    headers: { Authorization: 'Bearer sk-live-smoke-not-a-real-key' },
    signal: AbortSignal.timeout(15_000),
  })
  const text = await res.text()
  line('端点可达，且按预期拒绝假 Key（401/403）', res.status === 401 || res.status === 403,
    `HTTP ${res.status} · ${text.slice(0, 100)}`)
} catch (error) {
  line('端点可达', false, error instanceof Error ? error.message : String(error))
}

console.log(`\n${failures === 0 ? '全部复核通过' : `${failures} 项没通过`}（本次只读：没有写 $DSH_HOME 下任何文件）`)
if (failures > 0) process.exitCode = 1
