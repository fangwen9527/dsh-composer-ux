/**
 * 「余额」纯模块的单元测试。
 *
 *   node test/balance.mjs
 *
 * 这块能力只有两处错是**屏幕上看不出来**的，也正是这份测试盯的两件事：
 *
 *  1. **解析**：金额在 wire 上既可能是字符串也可能是数字，还可能缺字段 / 是负数 /
 *     是 `NaN`。错法有两个相反方向 —— 把负数抹成 0（欠费看成正常），或把"没读到"
 *     渲染成 0（网络故障看成没额度）。所以第 2～4 节把每条输入的归属
 *     （丢该条 / 整份 `undefined` / 消毒成什么数）逐例钉住。
 *  2. **白名单**：{@link balanceEndpointAllowed} 是 API Key 唯一的出口闸门。
 *     漏一个伪装域就等于把 Key 送给第三方，所以第 5 节把放行与拒绝两套用例都列出来。
 *
 * 打包方式与断言风格照抄 `test/pricing.mjs`（esbuild 现场打包源码再 import），
 * 只是入口换成 `src/balance.ts` —— 本模块是纯模块，不需要走 `test/pure-entry.ts`。
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
  entryPoints: ['src/balance.ts'],
  outfile: 'test/.build/balance.mjs',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['es2022'],
  logLevel: 'warning',
})
const ours = await import(new URL('./.build/balance.mjs', import.meta.url))

/** 造一份官方样例形状的响应体（可覆盖顶层字段）。 */
const payload = (overrides = {}) => ({
  is_available: true,
  balance_infos: [{
    currency: 'CNY',
    total_balance: '110.00',
    granted_balance: '10.00',
    topped_up_balance: '100.00',
  }],
  ...overrides,
})

/** 只解析一条时取那一条（解析失败或没条目就是 undefined），省掉满屏的 `?.`。 */
const first = (value) => ours.parseBalancePayload(value)?.entries[0]

/** 把单条 `balance_infos` 成员包成一份合法响应体，再取解析后的那一条。 */
const entry = (item) => first({ is_available: true, balance_infos: [item] })

/** 只关系"整份是不是 undefined"的用例：返回布尔，标签里直接读。 */
const gone = (value) => ours.parseBalancePayload(value) === undefined

// ══════════════ 1. 官方文档样例 ═════════════════════════════════════════════
console.log('1. 官方文档样例（110.00 = 10 + 100，CNY）')
{
  const snapshot = ours.parseBalancePayload({
    is_available: true,
    balance_infos: [{
      currency: 'CNY',
      total_balance: '110.00',
      granted_balance: '10.00',
      topped_up_balance: '100.00',
    }],
  })
  check('available 照抄 is_available', snapshot?.available === true)
  check('恰好一条 CNY', snapshot?.entries.length === 1 && snapshot.entries[0].currency === 'CNY',
    JSON.stringify(snapshot?.entries))
  check('granted 10.00 / toppedUp 100.00（字符串被解析成数字）',
    snapshot?.entries[0].granted === 10 && snapshot.entries[0].toppedUp === 100)
  check('total = 10 + 100 = 110',
    snapshot?.entries[0].total === 110, String(snapshot?.entries[0].total))
  check('三个金额都是有限数',
    snapshot !== undefined && snapshot.entries.every(e =>
      Number.isFinite(e.total) && Number.isFinite(e.granted) && Number.isFinite(e.toppedUp)))

  const both = ours.parseBalancePayload({
    is_available: true,
    balance_infos: [
      { currency: 'CNY', granted_balance: '1.50', topped_up_balance: '2.50' },
      { currency: 'USD', granted_balance: '0.25', topped_up_balance: '9.75' },
    ],
  })
  check('多币种按 wire 顺序各自成条',
    both?.entries.length === 2 && both.entries[0].currency === 'CNY' && both.entries[1].currency === 'USD')
  check('多币种的 total 各自用分项相加',
    both?.entries[0].total === 4 && both.entries[1].total === 10)

  check('is_available=false 也照样带条目（"不可用"与"没有条目"是两码事）',
    ours.parseBalancePayload(payload({ is_available: false }))?.available === false
    && first(payload({ is_available: false }))?.total === 110)

  check('BALANCE_API_PATH 是宿主半约定的路由',
    ours.BALANCE_API_PATH === '/composer-ux/balance', ours.BALANCE_API_PATH)
  check('DEEPSEEK_BALANCE_URL 是官方端点，且能过自己的白名单',
    ours.DEEPSEEK_BALANCE_URL === 'https://api.deepseek.com/user/balance'
    && ours.balanceEndpointAllowed(ours.DEEPSEEK_BALANCE_URL) === true)
}

// ══════════════ 2. total 以分项为准 ═════════════════════════════════════════
console.log('2. total_balance 与分项不一致时以分项为准')
{
  check('total_balance 离谱也不采信（999 但分项 10 + 100 ⇒ 110）',
    first(payload({ balance_infos: [{
      currency: 'CNY', total_balance: '999', granted_balance: '10.00', topped_up_balance: '100.00',
    }] }))?.total === 110)
  check('total_balance 缺失 ⇒ 仍由分项算出 110',
    first(payload({ balance_infos: [{
      currency: 'CNY', granted_balance: '10.00', topped_up_balance: '100.00',
    }] }))?.total === 110)
  check('total_balance 是 NaN 也照样由分项算出 110',
    first(payload({ balance_infos: [{
      currency: 'CNY', total_balance: NaN, granted_balance: '10.00', topped_up_balance: '100.00',
    }] }))?.total === 110)
  check('字符串与数字混用（granted 数字 10 + topped_up 字符串 "100.00"）⇒ 110',
    first(payload({ balance_infos: [{
      currency: 'CNY', granted_balance: 10, topped_up_balance: '100.00',
    }] }))?.total === 110)
  check('total 恒等于 granted + toppedUp（浮点也成立：0.1 + 0.2）',
    first(payload({ balance_infos: [{
      currency: 'CNY', granted_balance: '0.1', topped_up_balance: '0.2',
    }] }))?.total === 0.1 + 0.2)
  check('total_balance 为负也不采信（-500 但分项 10 + 100 ⇒ 110）',
    first(payload({ balance_infos: [{
      currency: 'CNY', total_balance: '-500', granted_balance: '10.00', topped_up_balance: '100.00',
    }] }))?.total === 110)
}

// ══════════════ 3. 形状：丢该条还是整份 undefined ═══════════════════════════
console.log('3. 形状不对的输入：逐例钉住归属')
{
  // ── 整份作废的 ──
  check('整体不是对象：42 ⇒ undefined', gone(42))
  check('整体不是对象：字符串 ⇒ undefined', gone('balance'))
  check('整体不是对象：布尔 ⇒ undefined', gone(true))
  check('整体是 null ⇒ undefined', gone(null))
  check('整体是 undefined ⇒ undefined', gone(undefined))
  check('整体是空串 ⇒ undefined', gone(''))
  check('整体是数组（空 / 有内容）⇒ undefined', gone([]) && gone([{ currency: 'CNY' }]))
  check('空对象（没有 is_available / balance_infos）⇒ undefined', gone({}))
  check('is_available 不是布尔（字符串 "true"）⇒ undefined', gone({ is_available: 'true', balance_infos: [] }))
  check('is_available 缺失、但有合法条目 ⇒ 仍然 undefined（不猜可用性）',
    gone({ balance_infos: [{ currency: 'CNY', granted_balance: '1', topped_up_balance: '2' }] }))
  check('balance_infos 不是数组（对象）⇒ undefined',
    gone({ is_available: true, balance_infos: { currency: 'CNY' } }))
  check('balance_infos 是字符串 ⇒ undefined', gone({ is_available: true, balance_infos: 'CNY' }))
  check('balance_infos 缺失 ⇒ undefined', gone({ is_available: true }))
  check('balance_infos 为 null ⇒ undefined', gone({ is_available: true, balance_infos: null }))
  check('balance_infos 是空数组 ⇒ undefined（"一条都没有"不是"余额为 0"）',
    gone({ is_available: true, balance_infos: [] }))
  check('唯一一条缺 currency ⇒ 整份 undefined（坏条被丢后没剩下）',
    gone({ is_available: true, balance_infos: [{ total_balance: '110.00' }] }))

  // ── 只丢该条、整份还在的 ──
  const withJunk = ours.parseBalancePayload({
    is_available: true,
    balance_infos: [
      { total_balance: '110.00', granted_balance: '10.00', topped_up_balance: '100.00' },
      { currency: '', granted_balance: '1', topped_up_balance: '2' },
      { currency: '   ', granted_balance: '1', topped_up_balance: '2' },
      { currency: 42, granted_balance: '1', topped_up_balance: '2' },
      { currency: null, granted_balance: '1', topped_up_balance: '2' },
      null,
      'CNY',
      [],
      { currency: 'USD', granted_balance: '1.00', topped_up_balance: '2.00' },
    ],
  })
  check('坏条只丢自己：8 条里只剩 1 条 USD',
    withJunk?.entries.length === 1 && withJunk.entries[0].currency === 'USD',
    JSON.stringify(withJunk?.entries))
  check('坏条被丢时整份还在（available 照抄）', withJunk?.available === true)

  const mixed = ours.parseBalancePayload({
    is_available: true,
    balance_infos: [
      { currency: 'CNY', granted_balance: '10.00', topped_up_balance: '100.00' },
      { granted_balance: '1', topped_up_balance: '2' },
      { currency: 'USD', granted_balance: '1.00' },
    ],
  })
  check('好条的顺序与内容不受坏条影响',
    mixed?.entries.length === 2
    && mixed.entries[0].currency === 'CNY' && mixed.entries[0].total === 110
    && mixed.entries[1].currency === 'USD' && mixed.entries[1].total === 1)

  // ── 缺字段与类型杂音 ⇒ 该字段当 0 ──
  const sparse = entry({ currency: 'CNY' })
  check('三个金额全缺 ⇒ 三个都是 0（而不是 undefined/NaN）',
    sparse !== undefined && sparse.granted === 0 && sparse.toppedUp === 0 && sparse.total === 0)
  check('缺 granted_balance ⇒ granted 0，total 等于 topped_up',
    entry({ currency: 'CNY', topped_up_balance: '100.00' })?.granted === 0
    && entry({ currency: 'CNY', topped_up_balance: '100.00' })?.total === 100)
  check('金额是 null / 布尔 / 对象 / 数组 / 认不出的字符串 ⇒ 0',
    entry({ currency: 'CNY', granted_balance: null, topped_up_balance: true })?.total === 0
    && entry({ currency: 'CNY', granted_balance: {}, topped_up_balance: [] })?.total === 0
    && entry({ currency: 'CNY', granted_balance: 'abc', topped_up_balance: '1O0' })?.total === 0)
  check('currency 前后空白被裁掉（" CNY " ⇒ "CNY"）',
    entry({ currency: ' CNY ', granted_balance: '1', topped_up_balance: '2' })?.currency === 'CNY')
  check('多余字段被忽略，不污染条目',
    JSON.stringify(entry({ currency: 'CNY', granted_balance: '1', topped_up_balance: '2', extra: 'x' }))
      === JSON.stringify({ currency: 'CNY', total: 3, granted: 1, toppedUp: 2 }))
}

// ══════════════ 4. 负数 / Infinity / NaN ════════════════════════════════════
console.log('4. 负数保留符号；非有限数当 0')
{
  const owed = entry({ currency: 'CNY', granted_balance: '-10.00', topped_up_balance: '100.00' })
  check('负的 granted 保留符号（欠费如实显示）', owed?.granted === -10, String(owed?.granted))
  check('total 跟着变 90（-10 + 100）', owed?.total === 90, String(owed?.total))

  const negativeTotal = entry({ currency: 'CNY', granted_balance: '0', topped_up_balance: '-5.50' })
  check('分项之和为负 ⇒ total 也是负的（不抹成 0，也不取绝对值）',
    negativeTotal?.toppedUp === -5.5 && negativeTotal.total === -5.5, String(negativeTotal?.total))

  check('两个分项都负 ⇒ 负得更负',
    entry({ currency: 'CNY', granted_balance: '-1.25', topped_up_balance: '-2.25' })?.total === -3.5)
  check('负数当数字传入（-7 而不是 "-7"）同样保留',
    entry({ currency: 'CNY', granted_balance: -7, topped_up_balance: 0 })?.granted === -7)

  check('Infinity（数字）⇒ 0', entry({ currency: 'CNY', granted_balance: Infinity, topped_up_balance: 0 })?.granted === 0)
  check('"Infinity"（字符串）⇒ 0', entry({ currency: 'CNY', granted_balance: 'Infinity', topped_up_balance: 0 })?.granted === 0)
  check('-Infinity ⇒ 0（不是负号保留：无穷大不是余额）',
    entry({ currency: 'CNY', granted_balance: -Infinity, topped_up_balance: 0 })?.granted === 0
    && entry({ currency: 'CNY', granted_balance: '-Infinity', topped_up_balance: 0 })?.granted === 0)
  check('NaN（数字与字符串）⇒ 0',
    entry({ currency: 'CNY', granted_balance: NaN, topped_up_balance: 'NaN' })?.total === 0)
  check('非有限数被当 0 后，total 仍等于可见的分项之和',
    entry({ currency: 'CNY', granted_balance: Infinity, topped_up_balance: '100.00' })?.total === 100)

  check('"-0" / -0 归一成 +0（避免下游 Object.is 与显示出 "−0"）',
    Object.is(entry({ currency: 'CNY', granted_balance: '-0', topped_up_balance: 0 })?.granted, 0)
    && Object.is(entry({ currency: 'CNY', granted_balance: -0, topped_up_balance: 0 })?.granted, 0))
  check('溢出（1e308 + 1e308）不产生 Infinity：total 当 0，分项仍是有限数',
    entry({ currency: 'CNY', granted_balance: 1e308, topped_up_balance: 1e308 })?.total === 0)
  check('科学计数法与空白字符串照常解析（"1e3" ⇒ 1000，" 12 " ⇒ 12）',
    entry({ currency: 'CNY', granted_balance: '1e3', topped_up_balance: ' 12 ' })?.total === 1012)
}

// ══════════════ 5. balanceEndpointAllowed：API Key 的出口闸门 ═══════════════
console.log('5. balanceEndpointAllowed：真假两套用例')
{
  // ── 放行 ──
  check('官方裸域', ours.balanceEndpointAllowed('https://api.deepseek.com') === true)
  check('尾斜杠', ours.balanceEndpointAllowed('https://api.deepseek.com/') === true)
  check('带路径', ours.balanceEndpointAllowed('https://api.deepseek.com/v1') === true)
  check('带多段路径', ours.balanceEndpointAllowed('https://api.deepseek.com/user/balance') === true)
  check('大小写混写（URL 规范化 hostname）', ours.balanceEndpointAllowed('https://API.DeepSeek.com') === true)
  check('显式 443（等价于默认端口）', ours.balanceEndpointAllowed('https://api.deepseek.com:443') === true)

  // ── 拒绝：协议 ──
  check('http:// 明文不放行（Key 会裸奔）', ours.balanceEndpointAllowed('http://api.deepseek.com') === false)
  check('其它协议（ftp / ws）不放行',
    ours.balanceEndpointAllowed('ftp://api.deepseek.com') === false
    && ours.balanceEndpointAllowed('ws://api.deepseek.com') === false)

  // ── 拒绝：伪装域（本模块存在的理由）──
  check('子域名伪装：api.deepseek.com.evil.com',
    ours.balanceEndpointAllowed('https://api.deepseek.com.evil.com') === false)
  check('路径伪装：https://evil.com/api.deepseek.com',
    ours.balanceEndpointAllowed('https://evil.com/api.deepseek.com') === false)
  check('真子域也不放行：sub.api.deepseek.com',
    ours.balanceEndpointAllowed('https://sub.api.deepseek.com') === false)
  check('前缀伪装：api.deepseek.com.evil.com/user/balance',
    ours.balanceEndpointAllowed('https://api.deepseek.com.evil.com/user/balance') === false)
  check('userinfo 伪装：https://api.deepseek.com@evil.com',
    ours.balanceEndpointAllowed('https://api.deepseek.com@evil.com') === false)
  check('userinfo 反向：https://evil.com@api.deepseek.com 也不放行（多一样就不认）',
    ours.balanceEndpointAllowed('https://evil.com@api.deepseek.com') === false)
  check('尾点 FQDN 不放行（宁严勿松：误拒只是少一行余额）',
    ours.balanceEndpointAllowed('https://api.deepseek.com.') === false)

  // ── 拒绝：其它域 / 端口 / 非 URL ──
  check('第三方域', ours.balanceEndpointAllowed('https://evil.com') === false)
  check('本地回环（自建中转）不放行',
    ours.balanceEndpointAllowed('http://127.0.0.1:8080') === false
    && ours.balanceEndpointAllowed('https://localhost') === false)
  check('非 443 端口不放行', ours.balanceEndpointAllowed('https://api.deepseek.com:8443') === false)
  check('空串', ours.balanceEndpointAllowed('') === false)
  check('纯空白', ours.balanceEndpointAllowed('   ') === false)
  check('没有 scheme 的裸域名', ours.balanceEndpointAllowed('api.deepseek.com') === false)
  check('相对路径 / 垃圾串',
    ours.balanceEndpointAllowed('/user/balance') === false
    && ours.balanceEndpointAllowed('api.deepseek.com.evil.com') === false)
  check('非字符串一律 false（运行时可能传进来的 undefined / null / 数字 / 对象）',
    ours.balanceEndpointAllowed(undefined) === false
    && ours.balanceEndpointAllowed(null) === false
    && ours.balanceEndpointAllowed(42) === false
    && ours.balanceEndpointAllowed({ href: 'https://api.deepseek.com' }) === false)
}

// ══════════════ 6. 纯函数卫生 ═══════════════════════════════════════════════
console.log('6. 纯函数卫生：不篡改输入、结果稳定')
{
  const input = payload()
  const before = JSON.stringify(input)
  const a = ours.parseBalancePayload(input)
  const b = ours.parseBalancePayload(input)
  check('不篡改调用方传入的对象', JSON.stringify(input) === before)
  check('同一输入两次解析结果相等（无隐藏状态）', JSON.stringify(a) === JSON.stringify(b))
  check('每次返回新的条目数组（调用方改不动内部状态）',
    a.entries !== b.entries && a.entries !== input.balance_infos)
  check('解析结果只含约定的三个数字字段与币种',
    JSON.stringify(a.entries[0]) === JSON.stringify({ currency: 'CNY', total: 110, granted: 10, toppedUp: 100 }))
}

console.log(`\n${passes} passed / ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
