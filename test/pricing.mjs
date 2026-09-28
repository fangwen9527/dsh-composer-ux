/**
 * 「金额」（0.8.0，0.10.0 大改）的纯逻辑测试。
 *
 *   node test/pricing.mjs
 *
 * 0.10.0 起这块有三处口径变化，旧期望值已全部作废：
 *  1. **人民币列改用官方人民币页原值**（不再由美元 × 6.82 折算）：flash 峰 2/0.04/8、
 *     谷 1/0.02/4；v4-pro 峰 9/0.3/27、谷 4.5/0.15/13.5。旧值 2.05/8.18 是拿美元列
 *     乘 6.82 凑的，比官方 2/8 高约 2.3%。价目表只剩 `deepseek-flash` 与
 *     `deepseek-v4-pro`，`deepseek-v4-flash` 等旧名变成别名（仍可调用，按 Flash 价计费）。
 *  2. **价格历史档**：官方 2026-09-10 调价，同一笔用量按下单时刻的档结算，历史金额
 *     不因现在调价而变（§10）。峰谷规则还多了两条边界：2026-08-23 起周末全天谷价
 *     （08-22 那个周六仍有高峰）、中国法定节假日全天谷价（§2、§11）。
 *  3. **第三方路由未定价就说未定价**：认不出价的模型返回 `unpriced: true`、单价全 0，
 *     **刻意不再**拿 flash 价兜底（编一个价更糟）；有同步价目时按 provider 查（§4）。
 *
 * 会静默算错的两处老风险依旧逐样本钉住：
 *   · **覆盖价下的币种折算**：先整体重建人民币档、美元再从人民币折算。写成"在美元列上
 *     套覆盖价再折算"会差一个汇率量级（≈6.8 倍），而屏幕上只是个漂亮数字（§3/§4）。
 *   · **峰谷/节假日档位**：差一小时就是 2 倍价（§2/§11）。
 *
 * 第 0 节把出处实现的原文（MIT，`dsh-plugin-usage-meter@1.9.1` 的 `lib/client.js`：
 * `PRICING` / `MODEL_ALIASES` / `normalizeModel` / `pricesOf` / `costOf` / `formatMoney` /
 * `formatTokens`）抄进来当基准，逐样本对拍。**0.10.0 只换了 `ORACLE_PRICING` /
 * `ORACLE_ALIASES` 里的数值与键**（官方人民币列改用原值、旧模型名改列别名），算法一个
 * 字符没动 —— 所以"算法对拍"依然成立。`oraclePeakAt` 本来就是唯一改写点（出处内部调
 * `new Date()`，这里换成传入时刻），它仍保留 1.9.1 的"UTC 周一至周五 01–04、06–10"
 * 算法，而新规则多了周末生效点与节假日，所以 §2 的全周扫描只取两者重合的区间。
 *
 * 第 6 节里有一类**有意的差异**：出处金额用 `replace(/0+$/,'')` 收尾，于是"第二位小数恰好是 0"
 * 的值会少一位（`¥0.1`），六位全为零的值更会只剩一个小数点（`¥0.`）。我们按官方金额惯例
 * 至少保留两位（`¥0.10` / `¥0.00`）。这类输入不参与逐字对拍，而是断言"恰好等于把出处结果
 * 补齐两位" —— 免得这条差异日后被谁"顺手改回去"。
 */
import { mkdirSync } from 'node:fs'
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
  outfile: 'test/.build/pricing.mjs',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['es2022'],
  logLevel: 'warning',
})
const ours = await import(new URL('./.build/pricing.mjs', import.meta.url))

// ══════════════ 0. 基准：出处实现的原文抄录 ═══════════════════════════════════
// 以下 ORACLE_* 的**算法**逐字来自 dsh-plugin-usage-meter@1.9.1 的 lib/client.js
// （MIT，Copyright (c) 2026 fancr-code）：normalizeModel / pricesOf / costOf /
// formatMoney / formatTokens 一个字符没改。
//
// 0.10.0 只换了 ORACLE_PRICING 与 ORACLE_ALIASES 的**数值与键**：官方人民币列改用
// 人民币页原值（旧值 2.05/8.18 是拿美元 × 6.82 凑的，与官方 2/8 差约 2.3%），
// 且价目表只剩两个模型、`deepseek-v4-flash` 从"独立模型"变成 Flash 的别名。
// 数值换了、算法没换，所以逐样本对拍依然成立。
const ORACLE_PRICING = {
  'deepseek-flash': {
    peak: { cny: { miss: 2, hit: 0.04, out: 8 }, usd: { miss: 0.30, hit: 0.006, out: 1.20 } },
    offPeak: { cny: { miss: 1, hit: 0.02, out: 4 }, usd: { miss: 0.15, hit: 0.003, out: 0.60 } },
  },
  'deepseek-v4-pro': {
    peak: { cny: { miss: 9, hit: 0.3, out: 27 }, usd: { miss: 1.32, hit: 0.044, out: 3.96 } },
    offPeak: { cny: { miss: 4.5, hit: 0.15, out: 13.5 }, usd: { miss: 0.66, hit: 0.022, out: 1.98 } },
  },
}
const ORACLE_ALIASES = {
  'deepseek-v4-flash': 'deepseek-flash',
  'deepseek-v4-flash-vision-exp': 'deepseek-flash',
  'deepseek-v4.1-flash': 'deepseek-flash',
  'deepseek-chat': 'deepseek-flash',
  'deepseek-reasoner': 'deepseek-v4-pro',
}
const ORACLE_DEFAULT_MODEL = 'deepseek-flash'
const ORACLE_CNY_PER_USD = 6.82

function oracleNum(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}
function oracleNormalizeModel(model) {
  if (typeof model !== 'string' || model.length === 0) return ORACLE_DEFAULT_MODEL
  const m = model.trim().toLowerCase()
  return ORACLE_ALIASES[m] ?? m
}
/**
 * 出处 `beijingPeakNow()` 的规则原文（1.9.1：UTC 周一至周五 01–04、06–10），
 * **唯一改动**：它内部调 `new Date()`，这里换成传入时刻，否则结果会随当天周几漂移。
 * 0.10.0 的新规则在这之上加了"周末生效点"与"节假日"，这里故意**不**跟着改，
 * 于是 §2 的扫描只取两者重合的区间（见那里的注释）。
 */
function oraclePeakAt(at) {
  const ranges = [[1, 4], [6, 10]]
  return at.getUTCDay() >= 1 && at.getUTCDay() <= 5 && ranges.some(([s, e]) => {
    const h = at.getUTCHours() + at.getUTCMinutes() / 60
    return h >= s && h < e
  })
}
function oraclePricesOf(model, currency, overrides, at) {
  const normalized = oracleNormalizeModel(model)
  const base = ORACLE_PRICING[normalized] ?? ORACLE_PRICING[ORACLE_DEFAULT_MODEL]
  const peak = oraclePeakAt(at)
  let tier = peak ? base.peak : base.offPeak
  const ov = overrides?.[normalized] ?? overrides?.[model]
  if (ov) {
    const t = peak ? ov.peak : ov.offPeak
    if (t) {
      const cny = {
        miss: oracleNum(t.cacheMissInput) ?? oracleNum(t.miss) ?? tier.cny.miss,
        hit: oracleNum(t.cacheHitInput) ?? oracleNum(t.hit) ?? tier.cny.hit,
        out: oracleNum(t.output) ?? oracleNum(t.out) ?? tier.cny.out,
      }
      tier = { cny, usd: { miss: cny.miss / ORACLE_CNY_PER_USD, hit: cny.hit / ORACLE_CNY_PER_USD, out: cny.out / ORACLE_CNY_PER_USD } }
    }
  }
  const cur = currency === 'USD' ? 'usd' : 'cny'
  return { model: normalized, peak, currency: currency === 'USD' ? 'USD' : 'CNY', p: tier[cur] }
}
function oracleFormatTokens(n) {
  if (!Number.isFinite(n)) return '0'
  if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(Math.round(n))
}
function oracleFormatMoney(n, currency) {
  const sym = currency === 'USD' ? '$' : '¥'
  if (!Number.isFinite(n)) return sym + '0'
  if (n >= 1) return sym + n.toFixed(2)
  if (n >= 0.01) return sym + n.toFixed(4).replace(/0+$/, '')
  return sym + n.toFixed(6).replace(/0+$/, '')
}
function oracleCostOf(miss, hit, out, p) {
  return miss / 1e6 * p.miss + hit / 1e6 * p.hit + out / 1e6 * p.out
}

/** 固定时刻：2026-09-28 是周一。UTC 01:30 = 高峰；05:00 = 空闲。 */
const MON_PEAK = new Date('2026-09-28T01:30:00Z')
const MON_OFF = new Date('2026-09-28T05:00:00Z')

/** 北京时刻 → 毫秒（直接写 +08:00，免去手算 UTC 偏移；边界都在整分钟上）。 */
const bj = (day, hour, minute = 0) =>
  Date.parse(`${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+08:00`)

/** 逐字段比两个单价三元组。 */
const sameTriple = (a, b) => a.miss === b.miss && a.hit === b.hit && a.out === b.out

// ══════════════ 1. 刊例价表与出处逐项相等 ═══════════════════════════════════
console.log('1. 刊例价表（0.10.0：官方人民币原值，只有两个模型 + 别名）')
{
  const models = Object.keys(ORACLE_PRICING)
  check('模型集合一致（deepseek-flash / deepseek-v4-pro 两个）',
    models.every(m => m in ours.PRICE_TABLE) && Object.keys(ours.PRICE_TABLE).length === models.length,
    Object.keys(ours.PRICE_TABLE).join(','))
  check('BUILTIN_PRICING_MODELS 就是这两个、顺序与表一致',
    JSON.stringify(ours.BUILTIN_PRICING_MODELS) === JSON.stringify(models)
    && ours.BUILTIN_PRICING_MODELS.length === 2)
  check('deepseek-v4-flash 已不在表里（它现在是别名）', ours.PRICE_TABLE['deepseek-v4-flash'] === undefined)
  for (const model of models) {
    for (const tierName of ['peak', 'offPeak']) {
      for (const cur of ['cny', 'usd']) {
        check(`${model} ${tierName} ${cur}`,
          sameTriple(ours.PRICE_TABLE[model][tierName][cur], ORACLE_PRICING[model][tierName][cur]),
          JSON.stringify(ours.PRICE_TABLE[model][tierName][cur]))
      }
    }
  }
  check('CNY_PER_USD = 6.82', ours.CNY_PER_USD === ORACLE_CNY_PER_USD, String(ours.CNY_PER_USD))
  check('默认模型 = deepseek-flash', ours.DEFAULT_PRICING_MODEL === ORACLE_DEFAULT_MODEL)
  check('别名表一致（v4-flash / vision-exp / v4.1-flash / chat → flash，reasoner → v4-pro）',
    JSON.stringify(ours.MODEL_ALIASES) === JSON.stringify(ORACLE_ALIASES),
    JSON.stringify(ours.MODEL_ALIASES))
  check('PRICE_VERIFIED_AT = 2026-09-29', ours.PRICE_VERIFIED_AT === '2026-09-29', ours.PRICE_VERIFIED_AT)
  // 0.10.0 的口径：人民币列是官方页原值，**不再**由美元 × 6.82 折算
  // （flash 峰 miss：官方 2，而 0.30×6.82 = 2.046 —— 差 2.3%，正是这次要修掉的）。
  const flashPeak = ours.PRICE_TABLE['deepseek-flash'].peak
  check('人民币列是官方原值、不由美元折算（2 ≠ 0.30×6.82）',
    flashPeak.cny.miss === 2 && Math.abs(flashPeak.cny.miss - flashPeak.usd.miss * ours.CNY_PER_USD) > 0.04,
    `${flashPeak.cny.miss} vs ${flashPeak.usd.miss * ours.CNY_PER_USD}`)
  check('flash 峰 2/0.04/8、谷 1/0.02/4；v4-pro 峰 9/0.3/27、谷 4.5/0.15/13.5',
    sameTriple(flashPeak.cny, { miss: 2, hit: 0.04, out: 8 })
    && sameTriple(ours.PRICE_TABLE['deepseek-flash'].offPeak.cny, { miss: 1, hit: 0.02, out: 4 })
    && sameTriple(ours.PRICE_TABLE['deepseek-v4-pro'].peak.cny, { miss: 9, hit: 0.3, out: 27 })
    && sameTriple(ours.PRICE_TABLE['deepseek-v4-pro'].offPeak.cny, { miss: 4.5, hit: 0.15, out: 13.5 }))
}

// ══════════════ 2. 峰谷与节假日判定 ═══════════════════════════════════════════
//
// 0.10.0 的判定顺序（顺序即规则）：峰谷制之前 → 节假日 → 周末（过了 08-23 才生效）
// → UTC 时段 01–04、06–10。周末生效点与节假日这两条边界各是"整整 2 倍价"，
// 所以逐条钉住；扫描段则留给出处算法（那里没有周末/节假日规则，见第 0 节）。
console.log('2. 峰谷与节假日判定（2026-08-16 起启用；周末从 08-23 起全谷、法定节假日全谷）')
{
  // ── 边界一：峰谷制开始之前没有高峰 ──
  check('2026-08-16（周日）任何时段都不是峰（峰谷制还没开始）',
    [9, 10, 14, 15, 23].every(h => ours.isPeakAt(bj('2026-08-16', h)) === false))
  check('PEAK_RULE_AT_MS / WEEKEND_OFFPEAK_AT_MS 的定义（UTC）',
    ours.PEAK_RULE_AT_MS === Date.parse('2026-08-16T16:00:00Z')
    && ours.WEEKEND_OFFPEAK_AT_MS === Date.parse('2026-08-22T16:00:00Z'))
  check('2026-08-17（周一）09:00–12:00 与 14:00–18:00 都是峰（峰谷制刚开始）',
    ours.isPeakAt(bj('2026-08-17', 9)) === true
    && ours.isPeakAt(bj('2026-08-17', 11, 59)) === true
    && ours.isPeakAt(bj('2026-08-17', 14)) === true
    && ours.isPeakAt(bj('2026-08-17', 17, 59)) === true)
  check('…同一周一的 12:00 / 18:00 起转谷（区间右开）',
    ours.isPeakAt(bj('2026-08-17', 12)) === false && ours.isPeakAt(bj('2026-08-17', 18)) === false)

  // ── 边界二：周末全谷从 08-23 00:00（北京）才开始 ──
  check('2026-08-22（周六）北京 09:00–12:00 是峰价（那天周末全谷还没生效）',
    ours.isPeakAt(bj('2026-08-22', 9)) === true
    && ours.isPeakAt(bj('2026-08-22', 10)) === true
    && ours.isPeakAt(bj('2026-08-22', 11, 59)) === true)
  check('2026-08-22（周六）北京 14:00–18:00 也是峰价',
    ours.isPeakAt(bj('2026-08-22', 14)) === true && ours.isPeakAt(bj('2026-08-22', 17, 59)) === true)
  check('2026-08-23（周日）同样两个时段都是谷价',
    [9, 10, 14, 15, 17].every(h => ours.isPeakAt(bj('2026-08-23', h)) === false))
  check('同一个 UTC 02:00：08-22 周六是峰、08-23 周日是谷（分界就在这里）',
    ours.isPeakAt(Date.parse('2026-08-22T02:00:00Z')) === true
    && ours.isPeakAt(Date.parse('2026-08-23T02:00:00Z')) === false)

  // ── 边界三：调休上班的周末仍按谷价 ──
  check('2026-10-10（周六，调休上班）两个时段都是谷价',
    ours.beijingWeekday(bj('2026-10-10', 10)) === 6
    && ours.isPeakAt(bj('2026-10-10', 10)) === false
    && ours.isPeakAt(bj('2026-10-10', 14)) === false)

  // ── 边界四：法定节假日全天谷价 ──
  check('DEFAULT_PEAK_HOLIDAYS = 10 个北京日期（中秋 09-25～27 + 国庆 10-01～07）',
    ours.DEFAULT_PEAK_HOLIDAYS.length === 10
    && JSON.stringify(ours.DEFAULT_PEAK_HOLIDAYS) === JSON.stringify([
      '2026-09-25', '2026-09-26', '2026-09-27',
      '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
      '2026-10-05', '2026-10-06', '2026-10-07',
    ]))
  check('2026-10-01（周四）09:00–12:00 是谷价',
    ours.beijingWeekday(bj('2026-10-01', 10)) === 4
    && ours.isPeakAt(bj('2026-10-01', 9)) === false
    && ours.isPeakAt(bj('2026-10-01', 10)) === false)
  check('2026-10-01（周四）14:00–18:00 也是谷价',
    ours.isPeakAt(bj('2026-10-01', 14)) === false && ours.isPeakAt(bj('2026-10-01', 17)) === false)
  check('同一时刻传 holidays: [] → 按峰价（证明是节假日在起作用，不是别的规则）',
    ours.isPeakAt(bj('2026-10-01', 10), { holidays: [] }) === true
    && ours.isPeakAt(bj('2026-10-01', 14), { holidays: [] }) === true)
  check('国庆中间的周一（10-05）同样是谷价，清空后是峰',
    ours.beijingWeekday(bj('2026-10-05', 10)) === 1
    && ours.isPeakAt(bj('2026-10-05', 10)) === false
    && ours.isPeakAt(bj('2026-10-05', 10), { holidays: [] }) === true)
  check('中秋 09-25（周五）也是谷价，清空后是峰',
    ours.beijingWeekday(bj('2026-09-25', 10)) === 5
    && ours.isPeakAt(bj('2026-09-25', 10)) === false
    && ours.isPeakAt(bj('2026-09-25', 10), { holidays: [] }) === true)
  check('假期结束后第一个工作日（10-08 周四）恢复峰价',
    ours.isPeakAt(bj('2026-10-08', 10)) === true)
  check('自定义节假日表只认表里的日子',
    ours.isPeakAt(bj('2026-10-01', 10), { holidays: ['2026-10-02'] }) === true
    && ours.isPeakAt(bj('2026-10-02', 10), { holidays: ['2026-10-02'] }) === false)

  // ── UTC 时段本身（峰谷制的常态，第一段右开、第二段左闭） ──
  check('周一 01:30 = 峰、05:00 = 谷', ours.isPeakAt(MON_PEAK) === true && ours.isPeakAt(MON_OFF) === false)
  check('周一 03:59 = 峰、04:00 = 谷（第一段右开）',
    ours.isPeakAt(new Date('2026-09-28T03:59:00Z')) === true
    && ours.isPeakAt(new Date('2026-09-28T04:00:00Z')) === false)
  check('周一 06:00 = 峰（第二段左闭）、09:59 = 峰、10:00 = 谷（右开）',
    ours.isPeakAt(new Date('2026-09-28T06:00:00Z')) === true
    && ours.isPeakAt(new Date('2026-09-28T09:59:00Z')) === true
    && ours.isPeakAt(new Date('2026-09-28T10:00:00Z')) === false)
  check('周一 00:30 = 谷（第一段左开）', ours.isPeakAt(new Date('2026-09-28T00:30:00Z')) === false)

  // ── 扫描：只取"新规则与 1.9.1 算法重合"的区间 ──
  // 08-23 00:00Z 起周末全谷已生效（周末两边都给 false），09-25 前没有节假日，
  // 于是新规则 == 出处规则；区间外（08-22 的周六、节假日）由上面的边界用例单独钉。
  let sweep = 0
  let sweepBad = 0
  for (let ms = Date.parse('2026-08-23T00:00:00Z'); ms < Date.parse('2026-09-25T00:00:00Z'); ms += 17 * 60_000) {
    sweep += 1
    if (ours.isPeakAt(ms) !== oraclePeakAt(new Date(ms))) sweepBad += 1
  }
  check(`2026-08-23～09-24 共 ${sweep} 个时刻与出处规则一致`, sweepBad === 0, `${sweep - sweepBad}/${sweep}`)

  // ── beijingDayKey / beijingWeekday ──
  check('beijingDayKey 跨 UTC 日界：UTC 10-01T16:30Z = 北京 10-02 00:30',
    ours.beijingDayKey(Date.parse('2026-10-01T16:30:00Z')) === '2026-10-02')
  check('beijingWeekday 同一时刻 = 周五(5)',
    ours.beijingWeekday(Date.parse('2026-10-01T16:30:00Z')) === 5)
  check('北京日界正好落在 UTC 16:00（09-30T16:00Z = 10-01）',
    ours.beijingDayKey(Date.parse('2026-09-30T16:00:00Z')) === '2026-10-01')
  check('beijingDayKey / beijingWeekday 常规值（周六=6、周日=0、周一=1）',
    ours.beijingDayKey(bj('2026-08-22', 10)) === '2026-08-22'
    && ours.beijingWeekday(bj('2026-08-22', 10)) === 6
    && ours.beijingWeekday(bj('2026-08-23', 0)) === 0
    && ours.beijingWeekday(bj('2026-08-17', 10)) === 1)

  // ── parseHolidays / isDayKey ──
  check('isDayKey 只认 YYYY-MM-DD 的真实日期',
    ours.isDayKey('2026-10-01') === true
    && ours.isDayKey('2026-02-30') === false
    && ours.isDayKey('2026-1-1') === false
    && ours.isDayKey('2026-13-01') === false
    && ours.isDayKey(20261001) === false
    && ours.isDayKey(null) === false
    && ours.isDayKey('2026-10-01T00:00:00Z') === false)
  check('parseHolidays：坏日期逐条丢掉、去重、排序',
    JSON.stringify(ours.parseHolidays(['2026-10-02', '2026-13-01', '2026-1-1', 20261001, null, '2026-10-01', '2026-10-02']))
      === JSON.stringify(['2026-10-01', '2026-10-02']))
  check('parseHolidays：非数组 / 全坏 → undefined',
    ours.parseHolidays('2026-10-01') === undefined && ours.parseHolidays({}) === undefined
    && ours.parseHolidays([]) === undefined && ours.parseHolidays([1, null, 'x']) === undefined)
  check('parseHolidays 吃内置表后保持不变',
    JSON.stringify(ours.parseHolidays(ours.DEFAULT_PEAK_HOLIDAYS)) === JSON.stringify(ours.DEFAULT_PEAK_HOLIDAYS))

  // ── peakPhaseAt（峰谷提醒的倒计时；边界都落在整分钟上） ──
  const phasePeak = ours.peakPhaseAt(Date.parse('2026-09-28T02:00:00Z'))
  check('高峰中：inPeak、下一次切换是"转空闲"、距 04:00Z 还有 120 分钟',
    phasePeak.inPeak === true && phasePeak.nextIntoPeak === false
    && phasePeak.nextAtMs === Date.parse('2026-09-28T04:00:00Z') && phasePeak.minutesUntil === 120)
  check('高峰尾（03:59Z）→ 还有 1 分钟',
    ours.peakPhaseAt(Date.parse('2026-09-28T03:59:00Z')).minutesUntil === 1)
  check('整点刚过（04:01Z）→ 已转空闲、下一次是"进高峰"、还有 119 分钟',
    (() => {
      const p = ours.peakPhaseAt(Date.parse('2026-09-28T04:01:00Z'))
      return p.inPeak === false && p.nextIntoPeak === true && p.minutesUntil === 119
    })())
  check('空闲中（05:00Z）→ 1 小时后进高峰',
    (() => {
      const p = ours.peakPhaseAt(Date.parse('2026-09-28T05:00:00Z'))
      return p.inPeak === false && p.nextIntoPeak === true && p.minutesUntil === 60
    })())
  check('空闲跨夜：周一 10:30Z → 下个高峰在周二 01:00Z（870 分钟）',
    (() => {
      const p = ours.peakPhaseAt(Date.parse('2026-09-28T10:30:00Z'))
      return p.nextAtMs === Date.parse('2026-09-29T01:00:00Z') && p.minutesUntil === 870
    })())
  check('节假日：holiday = true 且 inPeak = false',
    (() => {
      const p = ours.peakPhaseAt(bj('2026-10-01', 10))
      return p.inPeak === false && p.holiday === true && p.weekend === false
    })())
  check('周末：weekend = true 且 inPeak = false',
    (() => {
      const p = ours.peakPhaseAt(bj('2026-10-10', 10))
      return p.inPeak === false && p.weekend === true && p.holiday === false
    })())
  check('周末全谷生效前的周六：weekend = false 且仍是峰',
    (() => {
      const p = ours.peakPhaseAt(bj('2026-08-22', 10))
      return p.weekend === false && p.inPeak === true
    })())
  check('96 小时内找不到切换点（长假）→ nextAtMs 为 NaN、倒计时 0',
    (() => {
      const p = ours.peakPhaseAt(bj('2026-10-01', 10))
      return Number.isNaN(p.nextAtMs) && p.minutesUntil === 0
    })())
}

// ══════════════ 3. DeepSeek 定价解析与出处对拍 ════════════════════════════════
//
// 只有 DeepSeek 路由才走历史档表（§10 单独测档）。这里固定用当前档内的两个时刻，
// 与出处那份"单一当前价目表"的算法逐样本对拍。
console.log('3. DeepSeek 定价解析（模型 × 币种 × 峰谷 × 覆盖）')
{
  const models = ['deepseek-flash', 'deepseek-v4-flash', 'deepseek-v4-flash-vision-exp',
    'deepseek-v4.1-flash', 'deepseek-v4-pro', 'deepseek-chat', 'deepseek-reasoner',
    'deepseek-unknown', 'DeepSeek-Chat']
  const overrides = {
    'deepseek-flash': { offPeak: { cacheMissInput: 1.23, miss: 9.99, cacheHitInput: 0.01, output: 5.55 } },
    'deepseek-v4-pro': { peak: { hit: 0.5 } },
  }
  let compared = 0
  let bad = 0
  for (const model of models) {
    for (const currency of ['CNY', 'USD']) {
      for (const at of [MON_PEAK, MON_OFF]) {
        for (const table of [undefined, overrides]) {
          const mine = ours.resolvePrice(model, { currency, at, overrides: table })
          const theirs = oraclePricesOf(model, currency, table, at)
          compared += 1
          if (!sameTriple(mine.prices, theirs.p)) {
            bad += 1
            console.log(`    ! ${model} ${currency} ${at.toISOString()} ${table ? 'ov' : '-'} → ` +
              `${JSON.stringify(mine.prices)} vs ${JSON.stringify(theirs.p)}`)
          }
        }
      }
    }
  }
  check(`${compared} 组（模型×币种×时段×覆盖）单价与出处逐字相等`, bad === 0, `${compared - bad}/${compared}`)
  check('解析结果带回归一化模型名与峰谷档',
    ours.resolvePrice('DeepSeek-Chat', { at: MON_PEAK }).model === 'deepseek-flash')
  check('未覆盖时 overridden = false', ours.resolvePrice('deepseek-flash', { at: MON_PEAK }).overridden === false)
  check('覆盖了 hit 时 overridden = true',
    ours.resolvePrice('deepseek-v4-pro', { at: MON_PEAK, overrides }).overridden === true)
  check('DeepSeek 路由里未列名的模型按默认模型计价（与 flash 同价）',
    sameTriple(ours.resolvePrice('deepseek-unknown', { at: MON_PEAK }).prices,
      ours.resolvePrice('deepseek-flash', { at: MON_PEAK }).prices))
  check('isKnownModel 认得出别名、认不出未列名',
    ours.isKnownModel('deepseek-reasoner') && ours.isKnownModel('deepseek-v4-flash')
    && ours.isKnownModel('deepseek-unknown') === false && ours.isKnownModel('ds') === false)

  // ── 覆盖价的币种语义（0.8.0 起防复发的老回归） ──
  // 只覆盖 miss、不碰 hit：美元 hit 必须是「人民币 hit ÷ 6.82」，
  // 而不是「表里的美元 hit ÷ 6.82」——两者差一个汇率量级。
  const only = { 'deepseek-flash': { peak: { miss: 3 } } }
  const usd = ours.resolvePrice('deepseek-flash', { currency: 'USD', at: MON_PEAK, overrides: only })
  const cnyHit = ours.PRICE_TABLE['deepseek-flash'].peak.cny.hit
  const expectedHit = cnyHit / ours.CNY_PER_USD
  const wrongHit = ours.PRICE_TABLE['deepseek-flash'].peak.usd.hit / ours.CNY_PER_USD
  check(`有覆盖价时美元 hit = 人民币 hit/6.82（${cnyHit}/6.82，不是表里美元 hit/6.82）`,
    Math.abs(usd.prices.hit - expectedHit) < 1e-12 && Math.abs(expectedHit - wrongHit) > 1e-4,
    `got ${usd.prices.hit}, want ${expectedHit}, 错法 ${wrongHit}`)
  check('有覆盖价时美元 miss = 覆盖价/6.82',
    Math.abs(usd.prices.miss - 3 / ours.CNY_PER_USD) < 1e-12)
  check('有覆盖价时美元 out 也走人民币折算',
    Math.abs(usd.prices.out - ours.PRICE_TABLE['deepseek-flash'].peak.cny.out / ours.CNY_PER_USD) < 1e-12)
  check('人民币口径下覆盖价原样生效',
    ours.resolvePrice('deepseek-flash', { at: MON_PEAK, overrides: only }).prices.miss === 3)
  check('无覆盖时美元用表里那一列（hit 仍是 0.006）',
    ours.resolvePrice('deepseek-flash', { currency: 'USD', at: MON_PEAK }).prices.hit === 0.006,
    String(ours.resolvePrice('deepseek-flash', { currency: 'USD', at: MON_PEAK }).prices.hit))
}

// ══════════════ 4. 非 DeepSeek 定价 ═══════════════════════════════════════════
//
// 0.10.0 刻意改掉的旧行为：第三方模型**不再**按 flash 估价。认不出价 → unpriced
// （单价全 0、source 'none'），界面显示"未定价"让用户补一行；编一个价更糟。
console.log('4. 非 DeepSeek 定价（provider 感知 / 未定价就说未定价 / provider 价目与覆盖价）')
{
  // ── 路由判定 ──
  check('isDeepSeekRoute：provider 含 deepseek 或 model 以 deepseek 开头',
    ours.isDeepSeekRoute('deepseek-official', 'gpt-x') === true
    && ours.isDeepSeekRoute('', 'deepseek-flash') === true
    && ours.isDeepSeekRoute('opencode', 'deepseek-chat') === true
    && ours.isDeepSeekRoute('opencode', 'gpt-5.6-luna') === false
    && ours.isDeepSeekRoute('', '') === false
    && ours.isDeepSeekRoute(null, undefined) === false)

  // ── 未定价 ──
  // ⚠️ 必须用一个**内置快照里也没有**的名字：0.10.0 起 `gpt-5.6-luna` 之类的常见模型
  // 已由内置快照兜底（见第 12 节），拿它测"未定价"会变成空跑。
  const unpriced = ours.resolvePrice('my-relay-v1', { provider: 'opencode' })
  check('第三方模型没有价目 → unpriced / source = none / 单价全 0',
    unpriced.unpriced === true && unpriced.source === 'none'
    && sameTriple(unpriced.prices, ours.ZERO_TRIPLE))
  check('未定价结果不带峰谷与历史档（peak = false、era = ""）',
    unpriced.peak === false && unpriced.era === '' && unpriced.prices.miss === 0)
  check('旧行为已废弃：第三方模型不再按 flash 估价（0 ≠ flash 峰价 2）',
    unpriced.prices.miss !== ours.resolvePrice('deepseek-flash', { peak: true }).prices.miss
    && ours.resolvePrice('deepseek-flash', { peak: true }).prices.miss === 2)
  check('完全认不出的 route 也是未定价（不给任何模型编价）',
    ours.resolvePrice('whatever', {}).unpriced === true && ours.resolvePrice('whatever', {}).source === 'none')

  // ── 同步来的第三方价目（消毒后的形状：provider → model → 美元/1M） ──
  const PROVIDERS = ours.parseProviderPrices({
    opencode: {
      'gpt-5.6-luna': { miss: 3, hit: 0.3, out: 12, source: 'https://models.dev', checkedAt: '2026-09-29' },
      'glm-5': { miss: 1, out: 4 },
      'gpt-x': { miss: 1, hit: 0.1, out: 2 },
      'broken-item': { miss: 'x' },
    },
    zai: { 'glm-5': { miss: 0.5, hit: 0.1, out: 2 } },
    moonshotai: { 'kimi-k2': { miss: 0.6, hit: 0.15, out: 2.5 } },
    minimax: { 'minimax-m2': { miss: 0.4 } },
    zhipuai: { 'glm-4.6': { miss: 0.6, hit: 0.06, out: 2.2 } },
  })
  check('parseProviderPrices 消毒：坏项丢掉、缺 hit 沿用 miss、缺 out 为 0、键小写',
    ours.providerRateOf(PROVIDERS, 'opencode', 'broken-item') === undefined
    && ours.providerRateOf(PROVIDERS, 'opencode', 'glm-5')?.rate.hit === 1
    && ours.providerRateOf(PROVIDERS, 'opencode', 'gpt-5.6-luna')?.rate.checkedAt === '2026-09-29'
    && PROVIDERS.opencode !== undefined && PROVIDERS.OpenCode === undefined)
  check('parseProviderPrices：非对象 / 全坏 → undefined',
    ours.parseProviderPrices('x') === undefined && ours.parseProviderPrices([]) === undefined
    && ours.parseProviderPrices({ bad: 'not-an-object' }) === undefined
    && ours.parseProviderPrices({ bad: { m: { miss: 'x' } } }) === undefined)

  const cny = ours.resolvePrice('gpt-5.6-luna', { provider: 'opencode', providers: PROVIDERS })
  const usd = ours.resolvePrice('gpt-5.6-luna', { provider: 'opencode', providers: PROVIDERS, currency: 'USD' })
  check('第三方价目命中：source = provider、unpriced = false、人民币单价 = 美元 × 6.82',
    cny.source === 'provider' && cny.unpriced === false && cny.currency === 'CNY'
    && Math.abs(cny.prices.miss - 3 * ours.CNY_PER_USD) < 1e-9
    && Math.abs(cny.prices.hit - 0.3 * ours.CNY_PER_USD) < 1e-9
    && Math.abs(cny.prices.out - 12 * ours.CNY_PER_USD) < 1e-9)
  check('第三方路由的 peak 恒 false、era 恒 ""（它们没有峰谷两档）',
    cny.peak === false && cny.era === '' && usd.peak === false && usd.era === '')
  check('currency = USD 时原样用美元列（不再折算）',
    sameTriple(usd.prices, { miss: 3, hit: 0.3, out: 12 }), JSON.stringify(usd.prices))
  check('provider 原样回显、模型名不被小写化',
    cny.provider === 'opencode' && cny.model === 'gpt-5.6-luna')

  // ── 查价顺序：精确 provider → provider 别名 → 按模型 id 全局唯一匹配 ──
  check('精确 provider 优先（即使该模型在别家也有）',
    ours.providerRateOf(PROVIDERS, 'opencode', 'glm-5')?.provider === 'opencode'
    && ours.providerRateOf(PROVIDERS, 'opencode', 'glm-5')?.rate.hit === 1)
  check('provider 别名：deepseek-official→deepseek、kimi-coding→moonshotai、minimax-cn→minimax、zai-coding-cn→zhipuai',
    ours.PROVIDER_ALIASES['deepseek-official'] === 'deepseek'
    && ours.PROVIDER_ALIASES['kimi-coding'] === 'moonshotai'
    && ours.PROVIDER_ALIASES['minimax-cn'] === 'minimax'
    && ours.PROVIDER_ALIASES['zai-coding-cn'] === 'zhipuai')
  check('provider 别名查得到：kimi-coding → moonshotai',
    ours.providerRateOf(PROVIDERS, 'kimi-coding', 'kimi-k2')?.provider === 'moonshotai')
  check('provider 别名查得到：zai-coding-cn → zhipuai',
    ours.providerRateOf(PROVIDERS, 'zai-coding-cn', 'glm-4.6')?.provider === 'zhipuai')
  check('provider 别名查得到：minimax-cn → minimax（缺 hit 沿用 miss）',
    ours.providerRateOf(PROVIDERS, 'minimax-cn', 'minimax-m2')?.provider === 'minimax'
    && ours.providerRateOf(PROVIDERS, 'minimax-cn', 'minimax-m2')?.rate.hit === 0.4)
  check('按模型 id 全局唯一匹配（provider 名认不出也能查）',
    ours.providerRateOf(PROVIDERS, 'some-relay', 'kimi-k2')?.provider === 'moonshotai')
  check('**两个 provider 都有同名模型 → 拒绝猜**（providerRateOf 返回 undefined）',
    ours.providerRateOf(PROVIDERS, 'some-relay', 'glm-5') === undefined)
  check('查不到 / 空模型名 / 没表 → undefined',
    ours.providerRateOf(PROVIDERS, 'opencode', 'nope') === undefined
    && ours.providerRateOf(PROVIDERS, 'opencode', '') === undefined
    && ours.providerRateOf(undefined, 'opencode', 'gpt-x') === undefined)

  // ── 覆盖价：provider:model 键（也叫 /） ──
  const providerOverrides = ours.withOverrideValue(undefined, 'gpt-x', false, 'miss', 3, 'opencode')
  check('withOverrideValue 带 provider 写出的键是 opencode:gpt-x',
    JSON.stringify(providerOverrides) === JSON.stringify({ 'opencode:gpt-x': { offPeak: { miss: 3 } } }),
    JSON.stringify(providerOverrides))
  const overridden = ours.resolvePrice('gpt-x', { provider: 'opencode', overrides: providerOverrides, providers: PROVIDERS })
  check('provider:model 覆盖价命中：source = override、overridden = true、单价 = 覆盖价',
    overridden.source === 'override' && overridden.overridden === true && overridden.prices.miss === 3)
  check('覆盖价仍是人民币口径（USD 时除以 6.82）',
    Math.abs(ours.resolvePrice('gpt-x', {
      provider: 'opencode', overrides: providerOverrides, providers: PROVIDERS, currency: 'USD',
    }).prices.miss - 3 / ours.CNY_PER_USD) < 1e-12)
  check('没有 provider 价目时，覆盖价单独不能给第三方模型定价（仍是未定价）',
    ours.resolvePrice('gpt-x', { provider: 'opencode', overrides: providerOverrides }).unpriced === true)

  const lookup = {
    'opencode:gpt-x': { offPeak: { miss: 1 } },
    'gpt-x': { offPeak: { miss: 2 } },
    'opencode/other': { offPeak: { miss: 3 } },
  }
  check('overrideEntryOf 顺序：provider:model 优先于裸模型名',
    ours.overrideEntryOf(lookup, 'opencode', 'gpt-x')?.offPeak?.miss === 1
    && ours.overrideEntryOf(lookup, 'elsewhere', 'gpt-x')?.offPeak?.miss === 2)
  check('overrideEntryOf 也认 / 分隔符（models.dev 写法）',
    ours.overrideEntryOf(lookup, 'opencode', 'other')?.offPeak?.miss === 3)
  check('overrideEntryOf 大小写 / 空格归一',
    ours.overrideEntryOf(lookup, ' OpenCode ', ' GPT-X ')?.offPeak?.miss === 1)
  check('overrideEntryOf：没表 / 空模型 → undefined',
    ours.overrideEntryOf(undefined, 'opencode', 'gpt-x') === undefined
    && ours.overrideEntryOf(lookup, 'opencode', '') === undefined)
}

// ══════════════ 5. 费用计算与费用拆分 ═════════════════════════════════════════
console.log('5. 费用计算')
{
  const bucketsList = [
    { miss: 0, hit: 0, out: 0 },
    { miss: 1000000, hit: 0, out: 0 },
    { miss: 4871235, hit: 199005312, out: 676799 },
    { miss: 1, hit: 1, out: 1 },
    { miss: 123456, hit: 654321, out: 999 },
  ]
  let compared = 0
  let bad = 0
  for (const b of bucketsList) {
    for (const model of ['deepseek-flash', 'deepseek-v4-pro', 'deepseek-v4-flash']) {
      for (const at of [MON_PEAK, MON_OFF]) {
        const price = ours.resolvePrice(model, { at })
        const mine = ours.costOf(b, price.prices)
        const theirs = oracleCostOf(b.miss, b.hit, b.out, oraclePricesOf(model, 'CNY', undefined, at).p)
        compared += 1
        if (mine !== theirs) { bad += 1; console.log(`    ! ${model} ${JSON.stringify(b)} ${mine} vs ${theirs}`) }
      }
    }
  }
  check(`${compared} 组费用与出处逐字相等`, bad === 0, `${compared - bad}/${compared}`)
  // 手算一条：flash 高峰 1M miss + 1M hit + 1M out = 2 + 0.04 + 8
  const peak = ours.resolvePrice('deepseek-flash', { at: MON_PEAK })
  check('手算：1M/1M/1M 高峰 = 10.04',
    Math.abs(ours.costOf({ miss: 1e6, hit: 1e6, out: 1e6 }, peak.prices) - 10.04) < 1e-9)
  const parts = ours.costPartsOf({ miss: 1e6, hit: 1e6, out: 1e6 }, peak.prices)
  check('三分项与合计自洽',
    Math.abs(parts.miss + parts.hit + parts.out - parts.total) < 1e-12)
  check('三分项分别等于单价（2 / 0.04 / 8）',
    Math.abs(parts.miss - 2) < 1e-9 && Math.abs(parts.hit - 0.04) < 1e-9 && Math.abs(parts.out - 8) < 1e-9)
  // 桶的取法
  check('costBucketsOf：inputTokens 就是未缓存输入',
    JSON.stringify(ours.costBucketsOf({ inputTokens: 10, cacheReadTokens: 20, cacheWriteTokens: 30, outputTokens: 40 }))
      === JSON.stringify({ miss: 10, hit: 20, out: 40 }))
  // 2026-09-28 真机踩过：**客户端 `tokenUsage` 投影用的是 `uncachedInputTokens`**
  // （官方 token-meter 的 projectionSchema），而会话日志里的 `TokenUsage` 用 `inputTokens`。
  // 只认一个名字 → 未缓存输入读成 0 → 命中率 100%、金额少算、连"日志 vs 投影"判据都永远不成立。
  check('costBucketsOf：投影的 uncachedInputTokens 也认（客户端口径）',
    JSON.stringify(ours.costBucketsOf({ uncachedInputTokens: 10, cacheReadTokens: 20, cacheWriteTokens: 30, outputTokens: 40 }))
      === JSON.stringify({ miss: 10, hit: 20, out: 40 }))
  check('两个名字同时出现时以日志口径 inputTokens 为准',
    ours.costBucketsOf({ inputTokens: 7, uncachedInputTokens: 9 }).miss === 7)
  check('两个名字都没有 → 0（不产生 NaN）',
    ours.costBucketsOf({ cacheReadTokens: 5 }).miss === 0)
  check('cacheWrite 不进费用（只是显示口径）', ours.costBucketsOf({ cacheWriteTokens: 999 }).miss === 0)
  check('null / undefined / 脏数据都当 0',
    JSON.stringify(ours.costBucketsOf(null)) === JSON.stringify({ miss: 0, hit: 0, out: 0 })
      && JSON.stringify(ours.costBucketsOf({ inputTokens: Number.NaN, outputTokens: '12' }))
        === JSON.stringify({ miss: 0, hit: 0, out: 0 }))
}

// ══════════════ 6. 金额格式（与出处对拍 + 钉住有意的差异）════════════════════
console.log('6. 金额格式')
{
  /** 小数部分有几位（没有小数点算 0 位）。 */
  const decimalsOf = text => {
    const dot = text.indexOf('.')
    return dot < 0 ? 0 : text.length - dot - 1
  }
  /** 把出处丢掉的第二位小数补回来（`¥0.1`→`¥0.10`、`¥0.`→`¥0.00`、`¥0`→`¥0.00`）。 */
  const padTo2 = text => {
    const dot = text.indexOf('.')
    const head = dot < 0 ? text : text.slice(0, dot)
    const fraction = dot < 0 ? '' : text.slice(dot + 1)
    return `${head}.${fraction.padEnd(2, '0').slice(0, 2)}`
  }
  const values = [0.0000005, 0.000041, 0.0001234, 0.005, 0.0099, 0.01, 0.02, 0.04, 0.05,
    0.0999, 0.1, 0.1234, 0.5, 0.9999, 1, 1.005, 4, 8, 10.04, 12.345, 100]
  // 出处那一支用 `replace(/0+$/,'')` 收尾，于是"第二位小数恰好是 0"的值会少一位（`¥0.1`），
  // 六位全为零的值更会只剩一个小数点（`¥0.`）。我们按官方金额惯例至少保留两位，
  // 所以这些输入**不参与逐字对拍**，改为断言"恰好等于把出处结果补齐两位"。
  const divergent = values.filter(v => decimalsOf(oracleFormatMoney(v, 'CNY')) < 2)
  const compared = values.filter(v => !divergent.includes(v))
  let bad = 0
  for (const v of compared) {
    for (const cur of ['CNY', 'USD']) {
      if (ours.formatMoney(v, cur) !== oracleFormatMoney(v, cur)) {
        bad += 1
        console.log(`    ! ${v} ${cur} → ${ours.formatMoney(v, cur)} vs ${oracleFormatMoney(v, cur)}`)
      }
    }
  }
  check(`${compared.length * 2} 个金额与出处逐字相等`, bad === 0, `${compared.length - bad}/${compared.length}`)
  check(`${divergent.length} 个"尾零"输入 = 出处结果补齐两位（有意的差异）`,
    divergent.length > 0 && divergent.every(v =>
      ours.formatMoney(v, 'CNY') === padTo2(oracleFormatMoney(v, 'CNY'))
      && ours.formatMoney(v, 'USD') === padTo2(oracleFormatMoney(v, 'USD'))),
    divergent.map(v => `${v}: ${ours.formatMoney(v, 'CNY')} vs ${oracleFormatMoney(v, 'CNY')}`).join(' | '))
  check('≥1 两位小数：¥4.00', ours.formatMoney(4, 'CNY') === '¥4.00')
  check('≥0.01 去尾零：¥0.04', ours.formatMoney(0.04, 'CNY') === '¥0.04')
  check('≥0.01 保留两位：¥0.05', ours.formatMoney(0.05, 'CNY') === '¥0.05')
  check('0.1 → ¥0.10（出处是 ¥0.1：我们保留第二位）', ours.formatMoney(0.1, 'CNY') === '¥0.10')
  check('极小值六位：¥0.000041', ours.formatMoney(0.000041, 'CNY') === '¥0.000041')
  check('美元符号 $', ours.formatMoney(4, 'USD') === '$4.00')
  check('0 → ¥0.00（有意的差异：出处输出 ¥0.）', ours.formatMoney(0, 'CNY') === '¥0.00')
  check('极小到 6 位全为零 → ¥0.00（不出现 ¥0.）', ours.formatMoney(1e-9, 'CNY') === '¥0.00')
  check('非有限数 → ¥0.00', ours.formatMoney(Number.NaN, 'CNY') === '¥0.00')
  check('负数把符号放最前：-¥0.50', ours.formatMoney(-0.5, 'CNY') === '-¥0.50')
  check('负数大额：-¥3.00', ours.formatMoney(-3, 'CNY') === '-¥3.00')
}

// ══════════════ 7. Token 格式与峰谷倒计时文案 ═════════════════════════════════
console.log('7. Token 格式与倒计时文案')
{
  const values = [0, 1, 999, 1000, 1234, 1500, 9999, 10000, 999999, 1000000, 1234567,
    1.2e6, 1e9, 1.5e9, 2.345e9, 1e12]
  let bad = 0
  for (const v of values) {
    if (ours.formatTokens(v) !== oracleFormatTokens(v)) {
      bad += 1
      console.log(`    ! ${v} → ${ours.formatTokens(v)} vs ${oracleFormatTokens(v)}`)
    }
  }
  check(`${values.length} 个 Token 数与出处逐字相等`, bad === 0)
  check('0 → 0', ours.formatTokens(0) === '0')
  check('999 → 999', ours.formatTokens(999) === '999')
  check('1000 → 1K', ours.formatTokens(1000) === '1K')
  check('1500 → 1.5K', ours.formatTokens(1500) === '1.5K')
  check('1.2M → 1.2M', ours.formatTokens(1.2e6) === '1.2M')
  check('1e6 → 1M（去掉 .00）', ours.formatTokens(1e6) === '1M')
  check('1.5e9 → 1.5B', ours.formatTokens(1.5e9) === '1.5B')
  check('非有限数 → 0', ours.formatTokens(Number.NaN) === '0')

  // ── formatCountdown（峰谷提醒） ──
  check('0 / 负数 / NaN → 不到 1 分钟',
    ours.formatCountdown(0) === '不到 1 分钟'
    && ours.formatCountdown(-5) === '不到 1 分钟'
    && ours.formatCountdown(Number.NaN) === '不到 1 分钟')
  check('45 → 45 分钟', ours.formatCountdown(45) === '45 分钟')
  check('60 → 1 小时', ours.formatCountdown(60) === '1 小时')
  check('135 → 2 小时 15 分钟', ours.formatCountdown(135) === '2 小时 15 分钟')
  // 1500 分钟 = 25 小时 = 1 天 1 小时（按实现的整除口径，不是 1 天 2 小时）
  check('1500 → 1 天 1 小时（25 小时 = 1 天 + 1 小时）', ours.formatCountdown(1500) === '1 天 1 小时')
}

// ══════════════ 8. 覆盖价的解析（设置页文本框 → 结构化表）═════════════════════
console.log('8. 覆盖价解析')
{
  const parsed = ours.parsePriceOverrides({
    'DeepSeek-Flash': { peak: { miss: 3, cacheHitInput: 0.02, output: 9 } },
    'dsh-v4-pro': { offPeak: { hit: 0.5 } },
    'bad': 'not-an-object',
    'bad2': { peak: 'nope' },
    'bad3': { peak: { miss: 'x', hit: -1 } },
  })
  check('模型名小写化', parsed['deepseek-flash'] !== undefined && parsed['dsh-v4-pro'] !== undefined)
  check('档位内的数字键保留', parsed['deepseek-flash'].peak.miss === 3 && parsed['deepseek-flash'].peak.cacheHitInput === 0.02)
  check('坏项丢掉、不连坐（bad/bad2 不在结果里）', parsed.bad === undefined && parsed.bad2 === undefined)
  check('非有限数与负数被忽略（bad3 整档为空 → 该模型不进结果）', parsed.bad3 === undefined)
  check('全空 → undefined', ours.parsePriceOverrides({}) === undefined)
  check('非对象 → undefined', ours.parsePriceOverrides('x') === undefined && ours.parsePriceOverrides([1]) === undefined)
  check('解析结果能直接喂 resolvePrice（人民币口径）',
    ours.resolvePrice('deepseek-flash', { at: MON_PEAK, overrides: parsed }).prices.miss === 3)
}

// ══════════════ 9. 设置页「金额」那一栏的纯逻辑（0.9.1）═════════════════════════
//
// 卡片本身只是几个输入框，真正会出错的是"怎么把六格变成覆盖价表"和"怎么把文本变成数字"：
//   · 留空必须**清掉**这一格（沿用官方价），而不是写成 0 —— 写成 0 的话金额会变成 0，
//     屏幕上看不出任何异常；
//   · 非法文本（`1,02`、`2元`）必须**拒绝**，不能当清空 —— 静默清空等于价格悄悄回到官方价，
//     而用户以为改成功了；
//   · 空壳要往上收（一档三项全空 → 删档；一个模型两档全空 → 删模型；整表全空 → undefined），
//     否则设置文件里会堆满空对象、界面还会多出永远填不上的空行。
console.log('9. 金额栏的纯逻辑')
{
  check('内置模型与字段顺序就是界面上的行与列',
    JSON.stringify(ours.BUILTIN_PRICING_MODELS) === JSON.stringify(Object.keys(ours.PRICE_TABLE))
    && JSON.stringify(ours.PRICE_FIELDS) === JSON.stringify(['miss', 'hit', 'out']))

  // ── 文本三态 ──
  check('空串 / 只有空白 → empty', ours.parsePriceText('').kind === 'empty'
    && ours.parsePriceText('   ').kind === 'empty')
  check('合法数字（含小数、0）→ number',
    ours.parsePriceText(' 1.02 ').kind === 'number' && ours.parsePriceText(' 1.02 ').value === 1.02
    && ours.parsePriceText('0').value === 0)
  check('千分位逗号 / 带单位 / 负数 / 非数 → invalid（绝不静默清空）',
    ours.parsePriceText('1,02').kind === 'invalid'
    && ours.parsePriceText('2元').kind === 'invalid'
    && ours.parsePriceText('-1').kind === 'invalid'
    && ours.parsePriceText('abc').kind === 'invalid')

  // ── 改一格 ──
  const base = ours.withOverrideValue(undefined, 'deepseek-flash', true, 'miss', 3)
  check('第一次写入就建出表与档', base['deepseek-flash'].peak.miss === 3)
  const twoCells = ours.withOverrideValue(base, 'deepseek-flash', true, 'out', 9)
  check('同档第二格不覆盖第一格', twoCells['deepseek-flash'].peak.miss === 3 && twoCells['deepseek-flash'].peak.out === 9)
  const cleared = ours.withOverrideValue(twoCells, 'deepseek-flash', true, 'out', undefined)
  check('清空一格 = 删掉那个键（不是写 0）',
    cleared['deepseek-flash'].peak.out === undefined && cleared['deepseek-flash'].peak.miss === 3)
  check('一档三项全清 → 整档消失', ours.withOverrideValue(
    ours.withOverrideValue(cleared, 'deepseek-flash', true, 'miss', undefined),
    'deepseek-flash', true, 'hit', undefined,
  ) === undefined)
  const bothTiers = ours.withOverrideValue(
    ours.withOverrideValue(undefined, 'deepseek-flash', true, 'miss', 3),
    'deepseek-flash', false, 'miss', 1.5,
  )
  check('两档各留一格 → 模型那一项还活着',
    bothTiers['deepseek-flash'].peak.miss === 3 && bothTiers['deepseek-flash'].offPeak.miss === 1.5)
  check('两档都清空 → 模型那一项消失',
    ours.withOverrideValue(
      ours.withOverrideValue(bothTiers, 'deepseek-flash', true, 'miss', undefined),
      'deepseek-flash', false, 'miss', undefined,
    ) === undefined)
  const twoModels = ours.withOverrideValue(base, 'My-Relay', true, 'miss', 7)
  check('键归一化（大小写/空格）', twoModels['my-relay'] !== undefined && twoModels['deepseek-flash'] !== undefined)
  check('改一个模型不动另一个', twoModels['deepseek-flash'].peak.miss === 3)
  check('负数 = 清空（不是写进表里）',
    ours.withOverrideValue(twoModels, 'my-relay', true, 'miss', -5)['my-relay'] === undefined)
  check('原表不被改动（不可变）', base['deepseek-flash'].peak.miss === 3 && base['my-relay'] === undefined)

  // ── 删整行 / 读一格 ──
  check('读一格：没填 → undefined（界面要显示空框，不是 0）',
    ours.overrideValueOf(undefined, 'deepseek-flash', true, 'miss') === undefined
    && ours.overrideValueOf(base, 'deepseek-flash', true, 'hit') === undefined)
  check('读一格：填了 → 数字', ours.overrideValueOf(base, 'deepseek-flash', true, 'miss') === 3)
  check('删整行（恢复官方价）', ours.withoutPricingModel(twoModels, 'deepseek-flash')['deepseek-flash'] === undefined)
  check('删最后一行 → undefined（设置里那个键就该消失）',
    ours.withoutPricingModel(base, 'deepseek-flash') === undefined)
  check('删不存在的键是空操作', JSON.stringify(ours.withoutPricingModel(base, 'nope')) === JSON.stringify(base))

  // ── 占位提示 = "不填时会按什么价算" ──
  check('内置模型的官方占位价（高峰/空闲）',
    ours.officialTripleOf('deepseek-flash', true).miss === ours.PRICE_TABLE['deepseek-flash'].peak.cny.miss
    && ours.officialTripleOf('deepseek-flash', false).out === ours.PRICE_TABLE['deepseek-flash'].offPeak.cny.out)
  check('DeepSeek 路由里认不出的模型按 deepseek-flash 的价当占位（与 resolvePrice 的兜底一致）',
    ours.officialTripleOf('deepseek-mini', true).miss === ours.PRICE_TABLE['deepseek-flash'].peak.cny.miss)
  check('第三方模型没有占位价（未定价 → 全 0，不套 flash 价）',
    ours.officialTripleOf('gpt-x', true).miss === 0)

  // ── 与计价接上：填了就必须真的生效（自定义模型走 DeepSeek 路由） ──
  const card = ours.parsePriceOverrides(
    ours.withOverrideValue(ours.withOverrideValue(undefined, 'deepseek-mini', true, 'miss', 12), 'deepseek-mini', false, 'miss', 6),
  )
  check('自定义模型的高峰/空闲两档都被计价采纳',
    ours.resolvePrice('deepseek-mini', { peak: true, overrides: card }).prices.miss === 12
    && ours.resolvePrice('deepseek-mini', { peak: false, overrides: card }).prices.miss === 6)
  check('没填的项沿用官方价（那两档的 hit/out 还是 flash 的）',
    ours.resolvePrice('deepseek-mini', { peak: true, overrides: card }).prices.out
      === ours.PRICE_TABLE['deepseek-flash'].peak.cny.out)
  check('`peak` 参数直接指定档位（不看时刻）',
    ours.resolvePrice('deepseek-flash', { at: MON_PEAK, peak: false }).prices.miss
      === ours.PRICE_TABLE['deepseek-flash'].offPeak.cny.miss
    && ours.resolvePrice('deepseek-flash', { peak: true }).prices.miss
      === ours.PRICE_TABLE['deepseek-flash'].peak.cny.miss)
  // 两个键都要认（0.9.1 的行为）：设置页写的是**行名**（现役名），但手改 settings.yaml 的人
  // 可能写别名（deepseek-chat）。只认归一化名的话，那一行会**静默不生效** —— 金额照旧按
  // 官方价算，界面上看不出任何异常。归一化名优先（两个键都写了时以现役名为准）。
  check('覆盖价两个键都认：现役名（deepseek-flash）与别名（deepseek-chat）都能命中',
    ours.resolvePrice('deepseek-chat', {
      peak: true,
      overrides: ours.withOverrideValue(undefined, 'deepseek-flash', true, 'miss', 5),
    }).prices.miss === 5
    && ours.resolvePrice('deepseek-chat', {
      peak: true,
      overrides: ours.withOverrideValue(undefined, 'deepseek-chat', true, 'miss', 5),
    }).prices.miss === 5)
  check('两个键都写了时以**归一化后的现役名**为准',
    ours.resolvePrice('deepseek-chat', {
      peak: true,
      overrides: {
        'deepseek-flash': { peak: { miss: 7 } },
        'deepseek-chat': { peak: { miss: 5 } },
      },
    }).prices.miss === 7)
  check('自定义行列表：内置与别名都不算自定义',
    JSON.stringify(ours.customPricingModels({
      ...card,
      'deepseek-flash': { peak: { miss: 1 } },
      'deepseek-chat': { peak: { miss: 1 } },
    })) === JSON.stringify(['deepseek-mini'])
    && JSON.stringify(ours.customPricingModels(undefined)) === JSON.stringify([]))
  check('provider:model 键也算自定义行（设置页要给它一行）',
    JSON.stringify(ours.customPricingModels({ 'opencode:gpt-x': { offPeak: { miss: 1 } } }))
      === JSON.stringify(['opencode:gpt-x']))
}

// ══════════════ 10. 价格历史档与节假日 ════════════════════════════════════════
//
// 官方 2026-09-10（北京 12:00）调价。若一律用"当前价"重算，8 月跑的历史会话金额会跟着
// 变、与当时的真实账单对不上，所以按下单时刻分档结算（usage-fold 把档 id 并进 route key）。
console.log('10. 价格历史档（era）')
{
  check('恰好三档、id 顺序 = legacy → peak-2026-08 → flash-2026-09-10',
    JSON.stringify(ours.PRICE_ERAS.map(e => e.id))
      === JSON.stringify(['legacy', 'peak-2026-08', 'flash-2026-09-10']))
  check('fromMs 严格升序',
    ours.PRICE_ERAS.length === 3
    && ours.PRICE_ERAS.every((era, i) => i === 0 || era.fromMs > ours.PRICE_ERAS[i - 1].fromMs))
  check('legacy.fromMs = 0（峰谷制之前）', ours.PRICE_ERAS[0].fromMs === 0)
  check('peak-2026-08.fromMs = PEAK_RULE_AT_MS',
    ours.eraById('peak-2026-08').fromMs === ours.PEAK_RULE_AT_MS)
  check('flash-2026-09-10.fromMs = 2026-09-10T04:00Z，且就是当前档',
    ours.eraById('flash-2026-09-10').fromMs === Date.parse('2026-09-10T04:00:00Z')
    && ours.CURRENT_ERA_ID === 'flash-2026-09-10')
  check('PRICE_TABLE 就是当前档的表',
    JSON.stringify(ours.PRICE_TABLE) === JSON.stringify(ours.eraById(ours.CURRENT_ERA_ID).table))
  check('legacy 档峰 = 谷（那时还没有峰谷两档）',
    JSON.stringify(ours.eraById('legacy').table['deepseek-flash'].peak)
      === JSON.stringify(ours.eraById('legacy').table['deepseek-flash'].offPeak))

  const SEA = Date.parse('2026-09-10T04:00:00Z')
  check('eraAt 边界前 → peak-2026-08、边界起 → flash-2026-09-10',
    ours.eraAt(SEA - 1).id === 'peak-2026-08' && ours.eraAt(SEA).id === 'flash-2026-09-10')
  check('eraAt 峰谷制边界前 → legacy、边界起 → peak-2026-08',
    ours.eraAt(ours.PEAK_RULE_AT_MS - 1).id === 'legacy'
    && ours.eraAt(ours.PEAK_RULE_AT_MS).id === 'peak-2026-08')
  check('eraAt(0) = legacy（最久远的时刻也有档，不崩）', ours.eraAt(0).id === 'legacy')
  check('eraIdAt 与 eraAt 同源',
    ours.eraIdAt(SEA - 1) === 'peak-2026-08' && ours.eraIdAt(SEA) === ours.CURRENT_ERA_ID)
  check('eraById 认不出（nope / 非字符串）就退回当前档，不抛',
    ours.eraById('nope').id === ours.CURRENT_ERA_ID
    && ours.eraById(undefined).id === ours.CURRENT_ERA_ID
    && ours.eraById(123).id === ours.CURRENT_ERA_ID
    && ours.eraById('legacy').id === 'legacy')

  // 指定 era 与按 at 判档必须给同一结果
  const byEra = ours.resolvePrice('deepseek-flash', { era: 'peak-2026-08', peak: true })
  const byAt = ours.resolvePrice('deepseek-flash', { at: ours.PEAK_RULE_AT_MS + 1, peak: true })
  check('resolvePrice 指定 era 与按 at 判档结果一致',
    byEra.era === 'peak-2026-08' && byEra.era === byAt.era && sameTriple(byEra.prices, byAt.prices)
    && byEra.prices.miss === 3)
  check('era 认不出 → 退回当前档（与 eraById 同规矩）',
    ours.resolvePrice('deepseek-flash', { era: 'nope', peak: true }).era === ours.CURRENT_ERA_ID)

  // 同一笔用量在调价前后单价不同 —— 历史不会被现在改掉
  const before = ours.resolvePrice('deepseek-flash', { at: Date.parse('2026-09-09T02:00:00Z') })
  const after = ours.resolvePrice('deepseek-flash', { at: Date.parse('2026-09-11T02:00:00Z') })
  check('同一笔高峰用量在 09-10 前后落在不同档',
    before.era === 'peak-2026-08' && after.era === ours.CURRENT_ERA_ID)
  check('同一笔 1M 未缓存输入：调价前 3 元、调价后 2 元（历史单价不会被现在改掉）',
    before.peak === true && after.peak === true
    && before.prices.miss === 3 && after.prices.miss === 2)
  check('查历史档不会改现在的表（PRICE_TABLE flash 峰 miss 仍是 2）',
    ours.PRICE_TABLE['deepseek-flash'].peak.cny.miss === 2)
  check('Pro 那次没调价（08 档与当前档的 Pro 价完全相同）',
    JSON.stringify(ours.eraById('peak-2026-08').table['deepseek-v4-pro'])
      === JSON.stringify(ours.eraById('flash-2026-09-10').table['deepseek-v4-pro']))

  // 同步来的额外档
  const extraEra = {
    id: 'synced-2026-10',
    fromMs: Date.parse('2026-10-20T00:00:00Z'),
    label: '同步档',
    source: 'test',
    table: {
      'deepseek-flash': {
        peak: { cny: { miss: 5, hit: 0.5, out: 20 }, usd: { miss: 0.7, hit: 0.07, out: 2.9 } },
        offPeak: { cny: { miss: 2.5, hit: 0.25, out: 10 }, usd: { miss: 0.35, hit: 0.035, out: 1.45 } },
      },
    },
  }
  check('allEras(extra) 按 fromMs 合并排序',
    JSON.stringify(ours.allEras([extraEra]).map(e => e.id))
      === JSON.stringify(['legacy', 'peak-2026-08', 'flash-2026-09-10', 'synced-2026-10']))
  check('eraIdAt(ms, extra) 支持额外档（同步来的）',
    ours.eraIdAt(Date.parse('2026-10-21T00:00:00Z'), [extraEra]) === 'synced-2026-10'
    && ours.eraIdAt(Date.parse('2026-10-19T00:00:00Z'), [extraEra]) === ours.CURRENT_ERA_ID)
  check('resolvePrice 用额外档的价',
    ours.resolvePrice('deepseek-flash', { at: Date.parse('2026-10-21T02:00:00Z'), eras: [extraEra] }).prices.miss === 5)

  // parsePriceEras 消毒
  const eraTable = {
    'deepseek-flash': {
      peak: { cny: { miss: 1, hit: 0.1, out: 2 }, usd: { miss: 0.2, hit: 0.02, out: 0.4 } },
      offPeak: { cny: { miss: 1, hit: 0.1, out: 2 }, usd: { miss: 0.2, hit: 0.02, out: 0.4 } },
    },
  }
  const parsedEras = ours.parsePriceEras([
    { id: 'sync-a', fromMs: 1, table: eraTable },
    { id: '', fromMs: 2, table: eraTable },
    { id: 'sync-b', fromMs: 'x', table: eraTable },
    { id: 'sync-c', fromMs: 3, table: {} },
    { id: 'sync-d', fromMs: 4, table: { m: { peak: { cny: { miss: 1, hit: 1, out: 1 } } } } },
    { id: 'legacy', fromMs: 5, table: eraTable },
    'nope',
    null,
  ])
  check('parsePriceEras：坏项/坏档丢掉、内置 id 跳过，只留形状对的那一条',
    parsedEras !== undefined && parsedEras.length === 1 && parsedEras[0].id === 'sync-a'
    && parsedEras[0].fromMs === 1 && parsedEras[0].label === 'sync-a' && parsedEras[0].source === '')
  check('parsePriceEras：非数组 / 全坏 → undefined',
    ours.parsePriceEras('x') === undefined && ours.parsePriceEras([]) === undefined
    && ours.parsePriceEras([1, null]) === undefined)
}

// ══════════════ 11. 节假日对金额的影响 ═════════════════════════════════════════
console.log('11. 节假日对金额的影响（国庆 10-01 vs 普通周二 10-13）')
{
  const holidayAt = bj('2026-10-01', 10)
  const workdayAt = bj('2026-10-13', 10)
  const holiday = ours.resolvePrice('deepseek-flash', { at: holidayAt })
  const workday = ours.resolvePrice('deepseek-flash', { at: workdayAt })
  const usage = { miss: 1e6, hit: 0, out: 0 }
  const holidayCost = ours.costOf(usage, holiday.prices)
  const workdayCost = ours.costOf(usage, workday.prices)
  check('2026-10-01（周四）10:00 北京 = 谷价（不认节假日就会算成峰价）',
    holiday.peak === false && ours.isPeakAt(holidayAt) === false)
  check('2026-10-13（周二）10:00 北京 = 峰价',
    workday.peak === true && ours.beijingWeekday(workdayAt) === 2)
  check('同一笔 1M 未缓存输入：谷价 1 元、峰价 2 元',
    Math.abs(holidayCost - 1) < 1e-12 && Math.abs(workdayCost - 2) < 1e-12,
    `${holidayCost} / ${workdayCost}`)
  check('金额之比恰好 2（节假日漏判就是整整 2 倍）', workdayCost / holidayCost === 2)
  check('把节假日表清空后 2026-10-01 变成峰价、金额翻倍',
    ours.resolvePrice('deepseek-flash', { at: holidayAt, holidays: [] }).peak === true
    && Math.abs(ours.costOf(usage, ours.resolvePrice('deepseek-flash', { at: holidayAt, holidays: [] }).prices) - 2) < 1e-12)
  check('清空节假日表不影响普通工作日（10-13 仍是峰价）',
    ours.resolvePrice('deepseek-flash', { at: workdayAt, holidays: [] }).peak === true)
}

console.log('12. 内置第三方价目快照（0.10.0：没点过同步时的兜底）')
{
  const snap = ours.BUILTIN_PROVIDER_PRICES
  check('快照不是空的，并带快照日期', snap !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(ours.PROVIDER_PRICES_SNAPSHOT_AT),
    ours.PROVIDER_PRICES_SNAPSHOT_AT)
  check('收了 11 个 provider', Object.keys(snap).length === 11, String(Object.keys(snap).length))
  check('每个 provider 都有模型，且单价都是有限非负数',
    Object.values(snap).every(rows => Object.keys(rows).length > 0
      && Object.values(rows).every(rate => Number.isFinite(rate.miss) && Number.isFinite(rate.hit)
        && Number.isFinite(rate.out) && rate.miss >= 0 && rate.hit >= 0 && rate.out >= 0)))
  check('快照里没有 deepseek（models.dev 那边只有平坦谷价，会误导成"DeepSeek 单价"）',
    snap.deepseek === undefined)
  check('模型 id 都是小写（查价前统一归一）',
    Object.values(snap).every(rows => Object.keys(rows).every(id => id === id.toLowerCase())))

  // 精确 provider 命中：gpt-3.5-turbo 只在 openai 下
  const solo = ours.resolvePrice('gpt-3.5-turbo', { provider: 'openai', currency: 'USD' })
  check('没同步过时也能查内置快照（精确 provider）',
    solo.unpriced === false && solo.source === 'provider' && solo.builtin === true
    && solo.prices.miss === 0.5 && solo.prices.out === 1.5, JSON.stringify(solo.prices))
  check('内置快照价也按同一个汇率折人民币',
    ours.resolvePrice('gpt-3.5-turbo', { provider: 'openai' }).prices.miss === 0.5 * ours.CNY_PER_USD)
  check('第三方路由仍然没有峰谷与价格档', solo.peak === false && solo.era === '')

  // provider 别名也要能命中快照（kimi-coding → moonshotai）
  check('provider 别名能命中快照（kimi-coding → moonshotai）',
    ours.providerRateOf(snap, 'kimi-coding', Object.keys(snap.moonshotai)[0]) !== undefined)

  // 已同步的价目**盖住**快照（同一模型、不同价）
  const synced = { openai: { 'gpt-3.5-turbo': { miss: 9, hit: 1, out: 99 } } }
  const over = ours.resolvePrice('gpt-3.5-turbo', { provider: 'openai', currency: 'USD', providers: synced })
  check('已同步的价目优先于内置快照（并把 builtin 置回 false）',
    over.builtin === false && over.prices.miss === 9 && over.prices.out === 99, JSON.stringify(over.prices))

  // 跨 provider 同名 → 拒绝猜（快照把这种歧义放大了，所以规则必须还在）
  const dupIds = Object.keys(ours.BUILTIN_PROVIDER_PRICES.openai)
    .filter(id => ours.providerRateOf(snap, 'no-such-provider', id) === undefined)
  check('确实存在跨 provider 同名的模型（否则下面那条断言是空跑）', dupIds.length > 0, String(dupIds.length))
  const ambiguous = ours.resolvePrice(dupIds[0], { provider: 'no-such-provider' })
  check('认不出的 provider + 多家同名 → 未定价（绝不猜一家）',
    ambiguous.unpriced === true && ambiguous.source === 'none', dupIds[0])
  check('但用户自己填一行 provider:model 就能定价（诚实出口）',
    ours.resolvePrice('gpt-3.5-turbo', {
      provider: 'my-relay',
      overrides: { 'my-relay:gpt-3.5-turbo': { offPeak: { miss: 3, hit: 0.3, out: 6 } } },
    }).prices.miss === 3)
}

console.log(`\n${passes} passed / ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
