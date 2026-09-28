/**
 * 「官方价格页解析」（0.9.x）的纯逻辑测试。
 *
 *   node test/official-pricing.mjs
 *
 * 夹具是**真实下载下来的官方页面 HTML**（中文页 / 英文页各一份），所以这个测试同时在钉两件事：
 *
 *  1. **数值与页面一致**：flash / v4-pro 两档六项、CNY 与 USD 两币种，逐项对照夹具原文；
 *  2. **坏了就必须承认坏了**：某个格子变成 `—`、某个空单元格、千分位逗号、整行被删、表头模型列
 *     被删、币种说不清 —— 一律 `undefined`。这条比数值更重要：解析器"尽力而为"补零/跳过，
 *     会让一次同步把本地价改错，而且屏幕上一点报错都看不到（见 `src/official-pricing.ts` 文件头
 *     "同步失败绝不能覆盖本地价"）。
 *
 * 打包方式照 `test/pricing.mjs`：esbuild 现场把 TS 打成 ESM 再 import（入口是本模块，
 * 不动 `test/pure-entry.ts`）。
 */
import { mkdirSync, readFileSync } from 'node:fs'
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
  entryPoints: ['src/official-pricing.ts'],
  outfile: 'test/.build/official-pricing.mjs',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['es2022'],
  logLevel: 'warning',
})
const pure = await import(new URL('./.build/official-pricing.mjs', import.meta.url))

const ZH = readFileSync(new URL('./fixtures/official-pricing.zh.html', import.meta.url), 'utf8')
const EN = readFileSync(new URL('./fixtures/official-pricing.en.html', import.meta.url), 'utf8')

/** 取一档单价；模型/档位不存在时返回 undefined（断言里会因此失败）。 */
const rate = (page, model, tier) => {
  const entry = page === undefined ? undefined : page.table[model]
  return entry === undefined ? undefined : entry[tier]
}
/** 三项逐字段比（不依赖对象键顺序）。 */
const sameRate = (actual, expected) => actual !== undefined
  && actual.hit === expected.hit && actual.miss === expected.miss && actual.out === expected.out
const show = (actual) => JSON.stringify(actual)

// ══════════════ 1. 中文页（人民币列）═══════════════════════════════════════════
console.log('1. 中文页（CNY）')
{
  const page = pure.parseOfficialPricingPage(ZH)
  check('解析得出来', page !== undefined)
  check('币种是 CNY', page !== undefined && page.currency === 'CNY', page === undefined ? 'undefined' : page.currency)
  check('正好两个模型列（没有把"说明"之类当成模型）',
    page !== undefined && JSON.stringify(Object.keys(page.table).sort()) === JSON.stringify(['deepseek-flash', 'deepseek-v4-pro']),
    page === undefined ? 'undefined' : JSON.stringify(Object.keys(page.table)))

  check('flash 空闲 {hit:0.02, miss:1, out:4}',
    sameRate(rate(page, 'deepseek-flash', 'offPeak'), { hit: 0.02, miss: 1, out: 4 }),
    show(rate(page, 'deepseek-flash', 'offPeak')))
  check('flash 高峰 {hit:0.04, miss:2, out:8}',
    sameRate(rate(page, 'deepseek-flash', 'peak'), { hit: 0.04, miss: 2, out: 8 }),
    show(rate(page, 'deepseek-flash', 'peak')))
  check('v4-pro 空闲 {hit:0.15, miss:4.5, out:13.5}',
    sameRate(rate(page, 'deepseek-v4-pro', 'offPeak'), { hit: 0.15, miss: 4.5, out: 13.5 }),
    show(rate(page, 'deepseek-v4-pro', 'offPeak')))
  check('v4-pro 高峰 {hit:0.30, miss:9, out:27}',
    sameRate(rate(page, 'deepseek-v4-pro', 'peak'), { hit: 0.30, miss: 9, out: 27 }),
    show(rate(page, 'deepseek-v4-pro', 'peak')))
  // 钉住"页面原值不换算"：命中价比未命中价低两个数量级，若被当成"每千 tokens"式换算就会露馅
  check('页面原值原样（没有任何 ÷1000 / ×1000 之类的换算）',
    rate(page, 'deepseek-flash', 'offPeak').hit === 0.02 && rate(page, 'deepseek-v4-pro', 'peak').out === 27)
}

// ══════════════ 2. 英文页（美元列）═════════════════════════════════════════════
console.log('2. 英文页（USD）')
{
  const page = pure.parseOfficialPricingPage(EN)
  check('解析得出来', page !== undefined)
  check('币种是 USD', page !== undefined && page.currency === 'USD', page === undefined ? 'undefined' : page.currency)
  check('flash 空闲 {hit:0.003, miss:0.15, out:0.6}',
    sameRate(rate(page, 'deepseek-flash', 'offPeak'), { hit: 0.003, miss: 0.15, out: 0.6 }),
    show(rate(page, 'deepseek-flash', 'offPeak')))
  check('flash 高峰 {hit:0.006, miss:0.30, out:1.2}',
    sameRate(rate(page, 'deepseek-flash', 'peak'), { hit: 0.006, miss: 0.30, out: 1.2 }),
    show(rate(page, 'deepseek-flash', 'peak')))
  check('v4-pro 空闲 {hit:0.022, miss:0.66, out:1.98}',
    sameRate(rate(page, 'deepseek-v4-pro', 'offPeak'), { hit: 0.022, miss: 0.66, out: 1.98 }),
    show(rate(page, 'deepseek-v4-pro', 'offPeak')))
  check('v4-pro 高峰 {hit:0.044, miss:1.32, out:3.96}',
    sameRate(rate(page, 'deepseek-v4-pro', 'peak'), { hit: 0.044, miss: 1.32, out: 3.96 }),
    show(rate(page, 'deepseek-v4-pro', 'peak')))
  check('行标签认的是 OFF-PEAK / PEAK（不是靠行号）',
    rate(page, 'deepseek-flash', 'offPeak').miss === 0.15 && rate(page, 'deepseek-flash', 'peak').miss === 0.3)
}

// ══════════════ 3. aliases（脚注里的旧名）═════════════════════════════════════
console.log('3. aliases')
{
  const zh = pure.parseOfficialPricingPage(ZH)
  const en = pure.parseOfficialPricingPage(EN)
  check('中文页：deepseek-v4-flash → deepseek-flash',
    zh !== undefined && zh.aliases['deepseek-v4-flash'] === 'deepseek-flash',
    zh === undefined ? 'undefined' : JSON.stringify(zh.aliases))
  check('中文页：deepseek-v4-flash-vision-exp → deepseek-flash',
    zh !== undefined && zh.aliases['deepseek-v4-flash-vision-exp'] === 'deepseek-flash')
  check('中文页：别名表干干净净（表头里并排的现役名不算别名）',
    zh !== undefined && JSON.stringify(Object.keys(zh.aliases).sort())
      === JSON.stringify(['deepseek-v4-flash', 'deepseek-v4-flash-vision-exp']),
    zh === undefined ? 'undefined' : JSON.stringify(Object.keys(zh.aliases)))
  check('英文页：legacy names 同样抽得到',
    en !== undefined
    && en.aliases['deepseek-v4-flash'] === 'deepseek-flash'
    && en.aliases['deepseek-v4-flash-vision-exp'] === 'deepseek-flash',
    en === undefined ? 'undefined' : JSON.stringify(en.aliases))
  check('别名不指向现役名自己', zh !== undefined && zh.aliases['deepseek-flash'] === undefined)
}

// ══════════════ 4. 缺字段 / 坏值 → undefined（绝不补零）════════════════════════
console.log('4. 缺字段 / 坏值一律 undefined')
{
  check('空串', pure.parseOfficialPricingPage('') === undefined)
  check('没有价格表的 HTML', pure.parseOfficialPricingPage('<html></html>') === undefined)
  check('非字符串输入（防御性）',
    pure.parseOfficialPricingPage(null) === undefined && pure.parseOfficialPricingPage(undefined) === undefined)
  check('某个格子变成 —',
    pure.parseOfficialPricingPage(ZH.replace('0.02元', '—')) === undefined)
  check('某个格子变空（空单元格）',
    pure.parseOfficialPricingPage(ZH.replace('0.02元', '')) === undefined)
  check('千分位逗号（1,000元）安全失败，而不是猜成 1000',
    pure.parseOfficialPricingPage(ZH.replace('0.02元', '1,000元')) === undefined)
  check('金额后面挂单位（0.02元起）也失败',
    pure.parseOfficialPricingPage(ZH.replace('0.02元', '0.02元起')) === undefined)
  check('整条价格行被删掉',
    pure.parseOfficialPricingPage(ZH.replace(
      '<tr><td rowspan="6">价格<sup>(2)</sup></td><td rowspan="2">百万tokens输入<br>（缓存命中）</td><td>空闲时段</td><td>0.02元</td><td>0.15元</td></tr>',
      '',
    )) === undefined)
  check('表头模型列被删掉（没有模型可定位）',
    pure.parseOfficialPricingPage(ZH.replace(
      '<td>deepseek-flash<sup>(1)</sup></td><td>deepseek-v4-pro</td>',
      '',
    )) === undefined)
  check('只留表头、价格行全删',
    pure.parseOfficialPricingPage(ZH.replace(/<tr><td colspan="3">BASE URL[\s\S]*?<\/table>/, '</table>')) === undefined)
  check('币种说不清（人民币格里混进 $）→ 不猜币种',
    pure.parseOfficialPricingPage(ZH.replace('0.02元', '$0.02')) === undefined)
  check('英文页坏一格同样作废',
    pure.parseOfficialPricingPage(EN.replace('$0.003', 'N/A')) === undefined)
}

// ══════════════ 5. 变形 HTML：噪声列 + 模型列换序 + 行序错乱 ═══════════════════
console.log('5. 变形 HTML（噪声列 / 换序 / 行序错乱）')
{
  // 与夹具同构但故意"变形"：模型列顺序反过来、中间多一列"说明"、行序倒着写、
  // 标签里塞 &amp; 与 <sup>、"元"与"¥"混用。列位置完全按表头模型 id 定位才对得上。
  const VARIANT = [
    '<html lang="zh-cn"><body>',
    '<div style="font-size:14px"><b><table style="text-align:center">',
    '<tr><td colspan="3" style="text-align:center">模型</td><td>说明</td><td>deepseek-v4-pro</td><td>deepseek-flash<sup>(1)</sup></td></tr>',
    '<tr><td rowspan="6">价格<sup>(2)</sup></td><td rowspan="2">百万tokens输出</td><td>高峰时段</td><td>—</td><td>27.0元</td><td>8元</td></tr>',
    '<tr><td>空闲时段</td><td>—</td><td>13.5元</td><td>4元</td></tr>',
    '<tr><td rowspan="2">百万tokens输入&amp;（缓存未命中）</td><td>高峰时段</td><td>—</td><td>9.0元</td><td>2元</td></tr>',
    '<tr><td>空闲时段</td><td>—</td><td>4.5元</td><td>1元</td></tr>',
    '<tr><td rowspan="2">百万tokens输入（缓存命中）</td><td>高峰时段</td><td>—</td><td>0.30元</td><td>¥0.04</td></tr>',
    '<tr><td>空闲时段</td><td>—</td><td>0.15元</td><td>0.02元</td></tr>',
    '</table></b></div>',
    '<div style="font-size:14px"><p>(1) 模型名请使用 <code>deepseek-flash</code>。旧模型名 <code>deepseek-v4-flash-old</code> 仍可调用，并按 Flash 价格计费。</p></div>',
    '</body></html>',
  ].join('')
  const page = pure.parseOfficialPricingPage(VARIANT)
  check('变形页解析得出来', page !== undefined)
  check('币种仍是 CNY（元 / ¥ 混用）', page !== undefined && page.currency === 'CNY')
  check('模型列按表头定位（pro 在前、flash 在后也能对上）',
    page !== undefined && JSON.stringify(Object.keys(page.table)) === JSON.stringify(['deepseek-v4-pro', 'deepseek-flash']),
    page === undefined ? 'undefined' : JSON.stringify(Object.keys(page.table)))
  check('换序后 pro 空闲 {hit:0.15, miss:4.5, out:13.5}',
    sameRate(rate(page, 'deepseek-v4-pro', 'offPeak'), { hit: 0.15, miss: 4.5, out: 13.5 }),
    show(rate(page, 'deepseek-v4-pro', 'offPeak')))
  check('换序后 pro 高峰 {hit:0.30, miss:9, out:27}',
    sameRate(rate(page, 'deepseek-v4-pro', 'peak'), { hit: 0.30, miss: 9, out: 27 }))
  check('换序后 flash 空闲 {hit:0.02, miss:1, out:4}（该列里有 ¥0.04 也能读）',
    sameRate(rate(page, 'deepseek-flash', 'offPeak'), { hit: 0.02, miss: 1, out: 4 }),
    show(rate(page, 'deepseek-flash', 'offPeak')))
  check('换序后 flash 高峰 {hit:0.04, miss:2, out:8}',
    sameRate(rate(page, 'deepseek-flash', 'peak'), { hit: 0.04, miss: 2, out: 8 }))
  check('多出来的"说明"列没被当成模型',
    page !== undefined && page.table['说明'] === undefined && Object.keys(page.table).length === 2)
  check('变形页的旧名也抽得到（deepseek-v4-flash-old）',
    page !== undefined && page.aliases['deepseek-v4-flash-old'] === 'deepseek-flash',
    page === undefined ? 'undefined' : JSON.stringify(page.aliases))
  check('变形页别名表里没有 ff-peak 这种切碎的脏键',
    page !== undefined && Object.keys(page.aliases).every(name => name.startsWith('deepseek-')),
    page === undefined ? 'undefined' : JSON.stringify(Object.keys(page.aliases)))
}

// ══════════════ 6. 幂等 / 契约 ════════════════════════════════════════════════
console.log('6. 幂等与返回形状')
{
  const once = pure.parseOfficialPricingPage(ZH)
  const twice = pure.parseOfficialPricingPage(ZH)
  check('同一份输入重复解析结果一致（没有全局正则 lastIndex 之类的脏状态）',
    JSON.stringify(once) === JSON.stringify(twice))
  check('返回形状：currency / table / aliases 三个键都在',
    once !== undefined && 'currency' in once && 'table' in once && 'aliases' in once)
  check('每一档都恰好是 {hit, miss, out} 三个数字',
    once !== undefined && Object.values(once.table).every((tiers) =>
      ['peak', 'offPeak'].every((tier) => {
        const keys = Object.keys(tiers[tier]).sort()
        return JSON.stringify(keys) === JSON.stringify(['hit', 'miss', 'out'])
          && Object.values(tiers[tier]).every((value) => typeof value === 'number' && Number.isFinite(value))
      })))
}

console.log(`\n${passes} passed / ${failures} failed`)
process.exitCode = failures === 0 ? 0 : 1
