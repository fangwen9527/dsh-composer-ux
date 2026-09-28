/**
 * 「统计行」（0.7.0）的纯逻辑测试。
 *
 *   node test/stats-line.mjs
 *
 * 这块能力里唯一会"静默算错"的东西就是小数语义：显示成 `12.346%` 看着都对，但
 * "三位小数会不会把没满的命中说成满"是看不出来的。所以这里除了手算的定值，还**把官方
 * `token-format.ts` 里那段源码原样抄进来当基准**（第 5 节），逐例对 `digits = 0` 的输出 ——
 * 那一档既是"关掉开关时写回去的东西"，也是"我们没有另起一套口径"的证据。
 *
 * 两个字符串变换（第 6 / 7 节）决定"改哪一处、哪一处不许碰"：用户 2026-09-28 拍板只改
 * 输入框下方那一行，两处统计弹窗保持官方原样，所以"弹窗那种拼起来没有空白的
 * `缓存命中49.4%` 不许被改"是一条必须钉住的判据。
 */
import { mkdirSync } from 'node:fs'
import { build } from 'esbuild'

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

mkdirSync(new URL('./.build/', import.meta.url), { recursive: true })
await build({
  entryPoints: ['test/pure-entry.ts'],
  outfile: 'test/.build/stats-line.mjs',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['es2022'],
  logLevel: 'warning',
})
const pure = await import(new URL('./.build/stats-line.mjs', import.meta.url))

/** 文本里有几位小数。 */
const decimalsOf = text => {
  const dot = text.indexOf('.')
  return dot < 0 ? 0 : text.length - dot - 1
}

// ══════════════ 1. 常态：三位小数 ════════════════════════════════════════════
console.log('1. 常态三位小数')
{
  check('本插件用的位数就是 3', pure.HIT_DIGITS === 3, String(pure.HIT_DIGITS))
  check('123 / 1123 → 10.953（第 4 位是 8，进位）',
    pure.cacheHitText(123, 1123) === '10.953', pure.cacheHitText(123, 1123))
  check('1 / 3 → 33.333（第 4 位是 3，舍去）',
    pure.cacheHitText(1, 3) === '33.333', pure.cacheHitText(1, 3))
  check('2 / 3 → 66.667（第 4 位是 6，进位）',
    pure.cacheHitText(2, 3) === '66.667', pure.cacheHitText(2, 3))
  check('1 / 8 → 12.500（末尾补零，位数固定）',
    pure.cacheHitText(1, 8) === '12.500', pure.cacheHitText(1, 8))
  check('0 / 100 → 0.000', pure.cacheHitText(0, 100) === '0.000', pure.cacheHitText(0, 100))
  check('满命中 → 100.000（官方此时给 "100"，我们统一成同一位数）',
    pure.cacheHitText(500, 500) === '100.000', pure.cacheHitText(500, 500))
  check('读到的比计费输入还多（脏数据）→ 也按满命中算，不给 >100 的数',
    pure.cacheHitText(600, 500) === '100.000', pure.cacheHitText(600, 500))
}

// ══════════════ 2. 口径：三个桶，且与官方同一份 ══════════════════════════════
console.log('2. 计费输入口径（未缓存输入 + 缓存读 + 缓存写）')
{
  const usage = { uncachedInputTokens: 100, cacheReadTokens: 100, cacheWriteTokens: 800 }
  check('billedInputTokens 是三个桶之和', pure.billedInputTokens(usage) === 1000, String(pure.billedInputTokens(usage)))
  check('缓存写算进分母（官方口径）→ 10.000',
    pure.cacheHitDisplay(usage) === '10.000', pure.cacheHitDisplay(usage))
  check('缺字段当 0：只给 cacheRead 也能算',
    pure.cacheHitDisplay({ cacheReadTokens: 50 }) === '100.000', pure.cacheHitDisplay({ cacheReadTokens: 50 }))
  check('负数 / NaN / 字符串一律当 0（脏数据不炸）',
    pure.billedInputTokens({ uncachedInputTokens: -5, cacheReadTokens: Number.NaN, cacheWriteTokens: '9' }) === 0)
}

// ══════════════ 3. 没有计费输入 ═════════════════════════════════════════════
console.log('3. 没有计费输入时不给数字（官方此时整颗胶囊都不渲染）')
{
  check('undefined / null → null',
    pure.cacheHitDisplay(undefined) === null && pure.cacheHitDisplay(null) === null)
  check('空对象 → null', pure.cacheHitDisplay({}) === null)
  check('三个桶都是 0 → null',
    pure.cacheHitDisplay({ uncachedInputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }) === null)
  check('分母为 0 时 cacheHitText 也返回 null', pure.cacheHitText(0, 0) === null)
}

// ══════════════ 4. 「不撒谎」：三位小数不许把部分命中凑成 100 ════════════════
console.log('4. 不撒谎：会凑成 100.000% 时继续加位')
{
  // 阶梯：99.995% 还能用三位；从 99.9995% 起三位就凑成 100.000 了，于是加位。
  check('99.995% → 99.995（三位够用）',
    pure.cacheHitText(19999, 20000) === '99.995', pure.cacheHitText(19999, 20000))
  check('99.999% → 99.999（三位够用）',
    pure.cacheHitText(99999, 100000) === '99.999', pure.cacheHitText(99999, 100000))
  check('99.9995% → 99.9995（三位会成 100.000，加到四位）',
    pure.cacheHitText(199999, 200000) === '99.9995', pure.cacheHitText(199999, 200000))
  check('99.9999% → 99.9999（差 1 个 token，加到四位）',
    pure.cacheHitText(999999, 1000000) === '99.9999', pure.cacheHitText(999999, 1000000))
  check('差 1 个 token 且总量很大 → 位数继续加，仍然 < 100',
    (() => {
      const text = pure.cacheHitText(999999999, 1000000000)
      return text !== null && Number(text) < 100 && decimalsOf(text) >= 3
    })(), String(pure.cacheHitText(999999999, 1000000000)))

  // 属性扫描：只要没满，任何一位的显示都必须严格小于 100（这就是"不撒谎"）。
  let liars = []
  let badDigits = []
  for (let total = 1; total <= 300; total += 1) {
    for (const missed of [1, 2, 3, 7, 29]) {
      if (missed >= total) continue
      const text = pure.cacheHitText(total - missed, total)
      if (text === null || !(Number(text) < 100)) liars.push(`${total - missed}/${total}→${String(text)}`)
      else if (decimalsOf(text) < 3) badDigits.push(`${total - missed}/${total}→${text}`)
    }
  }
  for (const total of [1000, 1234, 9999, 99999, 100000, 999999, 1000000, 12345678, 999999999]) {
    for (const missed of [1, 2, 3, 9, 99]) {
      if (missed >= total) continue
      const text = pure.cacheHitText(total - missed, total)
      if (text === null || !(Number(text) < 100)) liars.push(`${total - missed}/${total}→${String(text)}`)
      else if (decimalsOf(text) < 3) badDigits.push(`${total - missed}/${total}→${text}`)
    }
  }
  check('扫描 1500+ 组「没满」的比例，没有一组显示成 100', liars.length === 0, liars.slice(0, 4).join(' / '))
  check('扫描同样这些组，小数位数一律 ≥ 3', badDigits.length === 0, badDigits.slice(0, 4).join(' / '))
}

// ══════════════ 5. 与官方源码逐例一致（digits = 0 那一档）════════════════════
//
// 下面 4 个函数**原样抄自** DSH 检出
// `packages/client/ui-chat/src/client/chat/token-format.ts`（rc.1）。
// 抄而不是 import，是因为它是官方包内部实现、不对插件导出；抄一份就是"独立基准"。
console.log('5. digits = 0 与官方 formatCacheHitPercent 逐例一致')
{
  function roundedPercentUnits(cacheReadTokens, denominator, decimalPlaces) {
    const unitsPerPercent = decimalPlaces === 0 ? 1 : 10
    const scale = unitsPerPercent * 100
    const doubledScale = scale * 2
    const denominatorQuotient = Math.floor(denominator / doubledScale)
    const denominatorRemainder = denominator % doubledScale
    let lower = 0
    let upper = scale
    while (lower < upper) {
      const candidate = Math.floor((lower + upper + 1) / 2)
      const factor = candidate * 2 - 1
      const threshold = factor * denominatorQuotient
        + Math.ceil(factor * denominatorRemainder / doubledScale)
      if (cacheReadTokens >= threshold) lower = candidate
      else upper = candidate - 1
    }
    return lower
  }
  function displayPercentUnits(units, decimalPlaces) {
    if (decimalPlaces === 0) return String(units)
    const whole = Math.floor(units / 10)
    const tenths = units % 10
    return tenths === 0 ? String(whole) : `${whole}.${tenths}`
  }
  function officialCacheHitPercent(cacheReadTokens, promptTokens, decimalPlaces = 0) {
    if (promptTokens === 0) return null
    const missedInputTokens = promptTokens - cacheReadTokens
    if (missedInputTokens === 0) return '100'
    const roundedUnits = roundedPercentUnits(cacheReadTokens, promptTokens, decimalPlaces)
    const fullHitUnits = decimalPlaces === 0 ? 100 : 1000
    if (roundedUnits < fullHitUnits) return displayPercentUnits(roundedUnits, decimalPlaces)
    let distinguishingPlaces = 1
    let scaledDoubleGap = missedInputTokens * 200
    const denominatorTens = Math.floor(promptTokens / 10)
    while (scaledDoubleGap <= denominatorTens) {
      scaledDoubleGap *= 10
      distinguishingPlaces += 1
    }
    const denominatorOnes = promptTokens % 10
    let roundedLoss = 5
    for (let loss = 1; loss < 5; loss += 1) {
      const factor = loss * 2 + 1
      const threshold = factor * denominatorTens + Math.floor(factor * denominatorOnes / 10)
      if (scaledDoubleGap <= threshold) {
        roundedLoss = loss
        break
      }
    }
    return `99.${'9'.repeat(distinguishingPlaces - 1)}${10 - roundedLoss}`
  }

  const mismatches = []
  const compare = (read, total) => {
    const mine = pure.cacheHitText(read, total, 0)
    const theirs = officialCacheHitPercent(read, total, 0)
    if (mine !== theirs) mismatches.push(`${read}/${total}: 我=${String(mine)} 官方=${String(theirs)}`)
  }

  // 全量小分母 + 一批"贴着满命中"的分母（加位分支最容易在这里露出来）。
  for (let total = 1; total <= 400; total += 1) {
    compare(total, total)
    for (let read = 0; read < total; read += 1) compare(read, total)
  }
  for (const total of [1000, 1234, 9999, 100000, 200000, 999999, 1000000, 12345678, 999999999]) {
    for (const missed of [1, 2, 3, 5, 9, 99, 999]) {
      if (missed >= total) continue
      compare(total - missed, total)
    }
    for (const read of [0, Math.floor(total / 3), Math.floor(total / 2), total - 1]) compare(read, total)
  }
  // 伪随机（固定种子，失败可复现）。
  let seed = 20260928
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed
  }
  for (let index = 0; index < 3000; index += 1) {
    const total = 1 + (next() % 5000000)
    compare(next() % (total + 1), total)
  }

  check('400 个分母全量 + 大分母边界 + 3000 组伪随机，逐例与官方一致',
    mismatches.length === 0, mismatches.slice(0, 4).join(' / '))
  check('官方那段在"会凑成 100"时给 99.xx（基准自身是对的，不是我们抄错了）',
    officialCacheHitPercent(999999, 1000000, 0) === '99.9999',
    String(officialCacheHitPercent(999999, 1000000, 0)))
  check('满命中两边都给 100', officialCacheHitPercent(7, 7, 0) === '100'
    && pure.cacheHitText(7, 7, 0) === '100')
  check('没有计费输入两边都给 null', officialCacheHitPercent(0, 0, 0) === null
    && pure.cacheHitText(0, 0, 0) === null)
}

// ══════════════ 6. 文本节点：只认整段那一段 ═════════════════════════════════
console.log('6. 文本节点改写（只改输入框下面那一行）')
{
  check('中文整段：缓存命中 12% → 缓存命中 12.346%',
    pure.rewriteCacheHitText('缓存命中 12%', '12.346') === '缓存命中 12.346%',
    String(pure.rewriteCacheHitText('缓存命中 12%', '12.346')))
  check('已经是两位小数（官方"不撒谎"档）也能换',
    pure.rewriteCacheHitText('缓存命中 99.95%', '99.9999') === '缓存命中 99.9999%',
    String(pure.rewriteCacheHitText('缓存命中 99.95%', '99.9999')))
  check('英文整段：Cache hit 12% → Cache hit 12.346%',
    pure.rewriteCacheHitText('Cache hit 12%', '12.346') === 'Cache hit 12.346%',
    String(pure.rewriteCacheHitText('Cache hit 12%', '12.346')))
  check('值本来就一样 → null（不写，保证观察器收敛）',
    pure.rewriteCacheHitText('缓存命中 12.346%', '12.346') === null)
  check('还原档：三位小数 → 官方整数',
    pure.rewriteCacheHitText('缓存命中 12.346%', '12') === '缓存命中 12%',
    String(pure.rewriteCacheHitText('缓存命中 12.346%', '12')))

  // 下面这几条是"不许碰"的判据。
  check('统计弹窗那种拼起来没有空白的「缓存命中49.4%」不改（用户拍板只改那一行）',
    pure.rewriteCacheHitText('缓存命中49.4%', '12.346') === null)
  check('「缓存命中」单独一个节点（弹窗的 <dt>）不改',
    pure.rewriteCacheHitText('缓存命中', '12.346') === null)
  check('纯数字节点（弹窗的 <dd>12.3%</dd>）不改',
    pure.rewriteCacheHitText('12.3%', '12.346') === null
    && pure.rewriteCacheHitText('49.4%', '12.346') === null)
  check('同一行其它数字（token 数 / 速度）不被误改',
    pure.rewriteCacheHitText('8.2K tok', '12.346') === null
    && pure.rewriteCacheHitText('24.5 tok/s', '12.346') === null
    && pure.rewriteCacheHitText('缓存命中 12% · 24.5 tok/s', '12.346') === null)
  check('别种语言的"命中"字样不被误改',
    pure.rewriteCacheHitText('Cache hit rate 12%', '12.346') === null)
}

// ══════════════ 7. aria-label：段落藏在中间也要换 ════════════════════════════
console.log('7. aria-label 同步（读屏听到的也得是三位）')
{
  check('官方那颗胶囊的名字：8.2K tok · 缓存命中 12% → 换成三位',
    pure.rewriteCacheHitLabel('8.2K tok · 缓存命中 12%', '12.346') === '8.2K tok · 缓存命中 12.346%',
    String(pure.rewriteCacheHitLabel('8.2K tok · 缓存命中 12%', '12.346')))
  check('英文同理',
    pure.rewriteCacheHitLabel('8.2K tok · Cache hit 12%', '12.346') === '8.2K tok · Cache hit 12.346%',
    String(pure.rewriteCacheHitLabel('8.2K tok · Cache hit 12%', '12.346')))
  check('同一串里出现两次也只改那两段，其它数字不动',
    pure.rewriteCacheHitLabel('缓存命中 12% · 12.5 tok/s', '12.346') === '缓存命中 12.346% · 12.5 tok/s',
    String(pure.rewriteCacheHitLabel('缓存命中 12% · 12.5 tok/s', '12.346')))
  check('不含那一段 → null', pure.rewriteCacheHitLabel('8.2K tok', '12.346') === null)
  check('已经同步过 → null（不写）',
    pure.rewriteCacheHitLabel('8.2K tok · 缓存命中 12.346%', '12.346') === null)
  // 连续调用必须稳定：带 g 的正则如果留了 lastIndex 状态，第二次就会漏改。
  const first = pure.rewriteCacheHitLabel('缓存命中 12%', '12.346')
  const second = pure.rewriteCacheHitLabel('缓存命中 12%', '12.346')
  check('连续两次调用结果一致（公共正则不留 lastIndex 状态）',
    first === '缓存命中 12.346%' && second === first, `${String(first)} / ${String(second)}`)
}

// ══════════════ 8. 开关合成与定位常量 ═══════════════════════════════════════
console.log('8. 开关合成（总闸 + 栏开关）与定位常量')
{
  const base = pure.DEFAULT_SETTINGS
  check('默认：这一栏开着', pure.statsLineEnabled(base) === true)
  check('栏关掉 ⇒ 不生效', pure.statsLineEnabled({ ...base, statsEnabled: false }) === false)
  check('总闸关掉 ⇒ 不生效（栏开着也一样）', pure.statsLineEnabled({ ...base, enabled: false }) === false)
  // 只剩一个功能之后**不再有子开关**：与「OpenCode 请求头」那一栏同一处理。
  check('这一栏只有一个键（没有同义的子开关）',
    pure.DEFAULT_SETTINGS.statsPrecision === undefined && pure.DEFAULT_SETTINGS.statsWiden === undefined,
    Object.keys(pure.DEFAULT_SETTINGS).filter(key => key.startsWith('stats')).join(','))
  check('activeSections 里有 stats 这一栏，且默认开着',
    pure.activeSections(base).stats === true)
  check('全新安装（空文档）也是开着的（新栏不参与"碰过才开"的迁移）',
    pure.sanitizeSettings({}).statsEnabled === true)
  check('显式关掉听用户的', pure.sanitizeSettings({ statsEnabled: false }).statsEnabled === false)
  check('脏数据（字符串）回落到默认开',
    pure.sanitizeSettings({ statsEnabled: 'no' }).statsEnabled === true)
  check('定位走官方属性而不是 CSS Modules 类名',
    pure.STATS_ROOT_SELECTOR === '[data-composer-stats]', pure.STATS_ROOT_SELECTOR)
}

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
