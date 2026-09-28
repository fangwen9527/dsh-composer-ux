/**
 * 「金额」（0.8.0）的纯逻辑测试。
 *
 *   node test/pricing.mjs
 *
 * 这块能力里有两处**会静默算错**的地方，屏幕上只是个数字，看不出来：
 *
 *  1. **覆盖价下的币种折算**：出处实现是"先整体重建人民币档、美元再从人民币折算"。
 *     若写成"在美元列上套覆盖价再折算"，美元 hit 会是 `0.006/6.82`（而不是 `0.041/6.82`），
 *     差一个汇率量级 —— 页面照样显示一个漂亮的金额。
 *  2. **峰谷档位**：差一小时就是 2 倍价格（官方规则：UTC 周一至周五 01–04、06–10）。
 *
 * 所以第 3～5 节把**出处实现的原文**（MIT，`dsh-plugin-usage-meter@1.9.1` 的
 * `lib/client.js`：`PRICING` / `MODEL_ALIASES` / `normalizeModel` / `pricesOf` /
 * `costOf` / `formatMoney` / `formatTokens`）抄进来当基准，逐样本对拍。
 * 唯一改动写在 `oraclePeakAt` 上（出处内部调 `new Date()`，这里换成传入时刻以便定值）。
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
// 以下 ORACLE_* 全部逐字来自 dsh-plugin-usage-meter@1.9.1 的 lib/client.js
// （MIT，Copyright (c) 2026 fancr-code）。除 oraclePeakAt 外不做任何改写。
const ORACLE_PRICING = {
  'deepseek-flash': {
    peak: { cny: { miss: 2.05, hit: 0.041, out: 8.18 }, usd: { miss: 0.30, hit: 0.006, out: 1.20 } },
    offPeak: { cny: { miss: 1.02, hit: 0.020, out: 4.09 }, usd: { miss: 0.15, hit: 0.003, out: 0.60 } },
  },
  'deepseek-v4-flash': {
    peak: { cny: { miss: 3.0, hit: 0.10, out: 9.0 }, usd: { miss: 0.44, hit: 0.014, out: 1.32 } },
    offPeak: { cny: { miss: 1.5, hit: 0.05, out: 4.5 }, usd: { miss: 0.22, hit: 0.007, out: 0.66 } },
  },
  'deepseek-v4-pro': {
    peak: { cny: { miss: 9.0, hit: 0.30, out: 27.0 }, usd: { miss: 1.32, hit: 0.044, out: 3.96 } },
    offPeak: { cny: { miss: 4.5, hit: 0.15, out: 13.5 }, usd: { miss: 0.66, hit: 0.022, out: 1.98 } },
  },
}
const ORACLE_ALIASES = {
  'deepseek-chat': 'deepseek-flash',
  'deepseek-reasoner': 'deepseek-v4-pro',
  'deepseek-v4-flash-vision-exp': 'deepseek-flash',
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
 * 出处 `beijingPeakNow()` 的规则原文，**唯一改动**：它内部调 `new Date()`，
 * 这里换成传入时刻，否则测试结果会随当天周几漂移。
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

/** 固定时刻：2026-09-28 是周一。UTC 01:30 = 高峰；05:00 = 空闲；周六 02:00 = 空闲。 */
const MON_PEAK = new Date('2026-09-28T01:30:00Z')
const MON_OFF = new Date('2026-09-28T05:00:00Z')
const SAT_PEAK_HOUR = new Date('2026-09-26T02:00:00Z')

/** 逐字段比两个单价三元组。 */
const sameTriple = (a, b) => a.miss === b.miss && a.hit === b.hit && a.out === b.out

// ══════════════ 1. 刊例价表与出处逐项相等 ═══════════════════════════════════
console.log('1. 刊例价表（与出处原文逐项相等）')
{
  const models = Object.keys(ORACLE_PRICING)
  check('模型集合一致', models.every(m => m in ours.PRICE_TABLE) && Object.keys(ours.PRICE_TABLE).length === models.length,
    Object.keys(ours.PRICE_TABLE).join(','))
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
  check('别名表一致', JSON.stringify(ours.MODEL_ALIASES) === JSON.stringify(ORACLE_ALIASES),
    JSON.stringify(ours.MODEL_ALIASES))
  // 表内自洽：人民币列 ≈ 美元列 × 汇率（官方两列是各自四舍五入的，容差 1%）
  for (const [model, price] of Object.entries(ours.PRICE_TABLE)) {
    for (const tierName of ['peak', 'offPeak']) {
      const { cny, usd } = price[tierName]
      const ratioOk = Math.abs(cny.miss / usd.miss - ours.CNY_PER_USD) / ours.CNY_PER_USD < 0.01
      check(`${model} ${tierName} 双币种自洽（差 <1%）`, ratioOk, `${cny.miss}/${usd.miss}`)
    }
  }
}

// ══════════════ 2. 峰谷判定 ══════════════════════════════════════════════════
console.log('2. 峰谷判定（UTC 周一至周五 01–04、06–10）')
{
  check('周一 01:30 UTC = 高峰', ours.isPeakAt(MON_PEAK) === true)
  check('周一 05:00 UTC = 空闲', ours.isPeakAt(MON_OFF) === false)
  check('周六 02:00 UTC = 空闲（周末不打折高峰）', ours.isPeakAt(SAT_PEAK_HOUR) === false)
  check('周一 04:00 UTC = 空闲（区间右开）', ours.isPeakAt(new Date('2026-09-28T04:00:00Z')) === false)
  check('周一 03:59 UTC = 高峰', ours.isPeakAt(new Date('2026-09-28T03:59:00Z')) === true)
  check('周一 06:00 UTC = 高峰（第二段左闭）', ours.isPeakAt(new Date('2026-09-28T06:00:00Z')) === true)
  check('周一 09:59 UTC = 高峰', ours.isPeakAt(new Date('2026-09-28T09:59:00Z')) === true)
  check('周一 10:00 UTC = 空闲（第二段右开）', ours.isPeakAt(new Date('2026-09-28T10:00:00Z')) === false)
  check('周一 00:30 UTC = 空闲（第一段左开）', ours.isPeakAt(new Date('2026-09-28T00:30:00Z')) === false)
  // 全周扫描：与出处规则逐点一致（每 17 分钟一个点，避开整点边界噪声也覆盖边界）
  let sweep = 0
  let sweepBad = 0
  for (let minutes = 0; minutes < 7 * 24 * 60; minutes += 17) {
    const at = new Date(Date.UTC(2026, 8, 21, 0, 0, 0) + minutes * 60_000)
    sweep += 1
    if (ours.isPeakAt(at) !== oraclePeakAt(at)) sweepBad += 1
  }
  check(`一周 593 个时刻与出处规则一致`, sweepBad === 0, `${sweep - sweepBad}/${sweep}`)
}

// ══════════════ 3. 定价解析与出处对拍（含别名、币种、峰谷）════════════════════
console.log('3. 定价解析（模型 × 币种 × 峰谷 × 覆盖）')
{
  const models = ['deepseek-flash', 'deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-chat',
    'deepseek-reasoner', 'deepseek-v4-flash-vision-exp', 'unknown-model', '', undefined]
  const overrides = {
    'deepseek-flash': { offPeak: { cacheMissInput: 1.23, miss: 9.99, cacheHitInput: 0.01, output: 5.55 } },
    'deepseek-v4-pro': { peak: { hit: 0.5 } },
  }
  let compared = 0
  let bad = 0
  for (const model of models) {
    for (const currency of ['CNY', 'USD']) {
      for (const at of [MON_PEAK, MON_OFF, SAT_PEAK_HOUR]) {
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
  check('未知模型按默认模型计价（与 flash 同价）',
    sameTriple(ours.resolvePrice('unknown-model', { at: MON_PEAK }).prices,
      ours.resolvePrice('deepseek-flash', { at: MON_PEAK }).prices))
  check('isKnownModel 认得出别名、认不出未知',
    ours.isKnownModel('deepseek-reasoner') && ours.isKnownModel('ds') === false)
}

// ══════════════ 4. 覆盖价的币种语义（防那次差点写错的回归）══════════════════════
console.log('4. 覆盖价的币种语义：先重建人民币档，美元再从人民币折算')
{
  // 只覆盖 miss，不碰 hit：美元 hit 必须等于「人民币 hit ÷ 6.82」，而不是「表里美元 hit ÷ 6.82」
  const only = { 'deepseek-flash': { peak: { miss: 3 } } }
  const usd = ours.resolvePrice('deepseek-flash', { currency: 'USD', at: MON_PEAK, overrides: only })
  const expectedHit = 0.041 / ours.CNY_PER_USD
  const wrongHit = 0.006 / ours.CNY_PER_USD
  check('美元 hit = 0.041/6.82（不是 0.006/6.82）',
    Math.abs(usd.prices.hit - expectedHit) < 1e-12,
    `got ${usd.prices.hit}, want ${expectedHit}, 错法 ${wrongHit}`)
  check('美元 miss = 覆盖价/6.82', Math.abs(usd.prices.miss - 3 / ours.CNY_PER_USD) < 1e-12)
  check('人民币口径下覆盖价原样生效',
    ours.resolvePrice('deepseek-flash', { at: MON_PEAK, overrides: only }).prices.miss === 3)
  // 无覆盖时美元用表里那一列（两者差千分之一，是官方两列各自四舍五入的结果）
  const plain = ours.resolvePrice('deepseek-flash', { currency: 'USD', at: MON_PEAK })
  check('无覆盖时美元 hit 用表里那一列（0.006）', plain.prices.hit === 0.006, String(plain.prices.hit))
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
  // 手算一条：flash 高峰 1M miss + 1M hit + 1M out = 2.05 + 0.041 + 8.18
  const peak = ours.resolvePrice('deepseek-flash', { at: MON_PEAK })
  check('手算：1M/1M/1M 高峰 = 10.271',
    Math.abs(ours.costOf({ miss: 1e6, hit: 1e6, out: 1e6 }, peak.prices) - 10.271) < 1e-9)
  const parts = ours.costPartsOf({ miss: 1e6, hit: 1e6, out: 1e6 }, peak.prices)
  check('三分项与合计自洽',
    Math.abs(parts.miss + parts.hit + parts.out - parts.total) < 1e-12)
  check('三分项分别等于单价', Math.abs(parts.miss - 2.05) < 1e-9 && Math.abs(parts.hit - 0.041) < 1e-9 && Math.abs(parts.out - 8.18) < 1e-9)
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
  const values = [0.0000005, 0.000041, 0.0001234, 0.005, 0.0099, 0.01, 0.02, 0.041, 0.05,
    0.0999, 0.1, 0.1234, 0.5, 0.9999, 1, 1.005, 4.09, 8.18, 10.271, 12.345, 100]
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
  check('≥1 两位小数：¥4.09', ours.formatMoney(4.09, 'CNY') === '¥4.09')
  check('≥0.01 去尾零：¥0.041', ours.formatMoney(0.041, 'CNY') === '¥0.041')
  check('≥0.01 保留两位：¥0.05', ours.formatMoney(0.05, 'CNY') === '¥0.05')
  check('0.1 → ¥0.10（出处是 ¥0.1：我们保留第二位）', ours.formatMoney(0.1, 'CNY') === '¥0.10')
  check('极小值六位：¥0.000041', ours.formatMoney(0.000041, 'CNY') === '¥0.000041')
  check('美元符号 $', ours.formatMoney(4.09, 'USD') === '$4.09')
  check('0 → ¥0.00（有意的差异：出处输出 ¥0.）', ours.formatMoney(0, 'CNY') === '¥0.00')
  check('极小到 6 位全为零 → ¥0.00（不出现 ¥0.）', ours.formatMoney(1e-9, 'CNY') === '¥0.00')
  check('非有限数 → ¥0.00', ours.formatMoney(Number.NaN, 'CNY') === '¥0.00')
  check('负数把符号放最前：-¥0.50', ours.formatMoney(-0.5, 'CNY') === '-¥0.50')
  check('负数大额：-¥3.00', ours.formatMoney(-3, 'CNY') === '-¥3.00')
}

// ══════════════ 7. Token 格式（与出处对拍）════════════════════════════════════
console.log('7. Token 格式')
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
  check('认不出的模型按 deepseek-flash 的价当占位（与 resolvePrice 的兜底一致）',
    ours.officialTripleOf('my-relay', true).miss === ours.PRICE_TABLE['deepseek-flash'].peak.cny.miss)

  // ── 与计价接上：填了就必须真的生效 ──
  const card = ours.parsePriceOverrides(
    ours.withOverrideValue(ours.withOverrideValue(undefined, 'my-relay', true, 'miss', 12), 'my-relay', false, 'miss', 6),
  )
  check('自定义模型的高峰/空闲两档都被计价采纳',
    ours.resolvePrice('my-relay', { peak: true, overrides: card }).prices.miss === 12
    && ours.resolvePrice('my-relay', { peak: false, overrides: card }).prices.miss === 6)
  check('没填的项沿用官方价（那两档的 hit/out 还是 flash 的）',
    ours.resolvePrice('my-relay', { peak: true, overrides: card }).prices.out
      === ours.PRICE_TABLE['deepseek-flash'].peak.cny.out)
  check('`peak` 参数直接指定档位（不看时刻）',
    ours.resolvePrice('deepseek-flash', { at: MON_PEAK, peak: false }).prices.miss
      === ours.PRICE_TABLE['deepseek-flash'].offPeak.cny.miss
    && ours.resolvePrice('deepseek-flash', { peak: true }).prices.miss
      === ours.PRICE_TABLE['deepseek-flash'].peak.cny.miss)
  check('按别名键写的覆盖价也能被 resolvePrice 认到（原样名兜底）',
    ours.resolvePrice('deepseek-chat', {
      peak: true,
      overrides: ours.withOverrideValue(undefined, 'deepseek-chat', true, 'miss', 5),
    }).prices.miss === 5)
  check('自定义行列表：内置与别名都不算自定义',
    JSON.stringify(ours.customPricingModels({
      ...card,
      'deepseek-flash': { peak: { miss: 1 } },
      'deepseek-chat': { peak: { miss: 1 } },
    })) === JSON.stringify(['my-relay'])
    && JSON.stringify(ours.customPricingModels(undefined)) === JSON.stringify([]))
}

console.log(`\n${passes} passed / ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
