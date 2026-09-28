/**
 * 「余额」纯模块：官方余额响应的解析 + 查询端点的白名单。
 *
 * 零 import、零 DOM、零 node API（只用标准全局 `URL`）—— host 与 client 两半共用
 * （与 `pricing.ts` / `settings-contract.ts` 同规矩）。
 *
 * ## 为什么取余额这件事必须在 host 半
 *
 * 官方 `GET https://api.deepseek.com/user/balance` 要带 `Authorization: Bearer <API Key>`。
 * Key 只活在宿主半：它由 `credentials` 服务按**引用**（环境变量名，默认
 * `DEEPSEEK_API_KEY`）在每次请求时解析出来，从不进浏览器。所以这一次 GET 由 host 半发，
 * 客户端只收到**已经解析好的数字**（`BalanceSnapshot`）。一旦把取数放进 client，
 * Key 就得进浏览器 bundle / DOM / 网络面板 —— 那是不可接受的。
 *
 * ## 为什么端点白名单是安全底线
 *
 * `baseURL` 是用户可改的（profile 里手写的 provider 也能指向任何地方）。若照 `baseURL`
 * 拼出 `/user/balance` 再把 Bearer 头发出去，一个被改成 `https://evil.com` 的 baseURL
 * 就能直接收走用户的 API Key —— 这不是"功能出错"，这是把钥匙交出去。
 * 于是这里只认官方裸域 `https://api.deepseek.com`（见 {@link balanceEndpointAllowed}）：
 * 不匹配就不查，宁可界面上没有余额。
 *
 * ## 为什么 total 用分项相加，而不是平台自己的 `total_balance`
 *
 * 官方响应同时给了 `total_balance` 与 `granted_balance` / `topped_up_balance`。前者是
 * **派生字段**，后两者是**账本事实**（赠送了多少、充值了多少）。两者偶有对不上
 * （口径/缓存/四舍五入）的时候，能自证的是分项：
 *
 *     total := granted + topped_up
 *
 * 于是界面上显示的总额永远等于它下面那两行之和，不会冒出第三种数。
 *
 * ## 为什么失败返回 `undefined`（而不是 0、也不是旧值）
 *
 * 「拿不准」在界面上的正确表现是**不显示**：
 *   · 显示 `0` —— 用户会读成"欠费了/没额度了"，这是把一次网络故障说成财务事实；
 *   · 显示旧值 —— 用户会读成"当前余额"，这是把历史说成现在。
 * 两种都是谎报。所以形状不对、连一条可用条目都没有、请求失败，一律 `undefined`，
 * 由调用方把这一块藏起来（或显示"暂时读不到"）。
 *
 * ## 消毒规则（为什么不是"一律当 0"就完了）
 *
 * 金额在 wire 上既可能是字符串（`"110.00"`）也可能是数字，还可能缺字段 / 是 `null` /
 * `NaN` / `Infinity` / 负数。规则：
 *   · 非有限数、认不出的类型、缺字段 ⇒ `0`（余额上"没这一项"与"这一项是 0"等价）；
 *   · **负数保留符号，不抹成 0** —— 负的分项是欠费/退款的真实状态，抹平会让人以为账上没事。
 *     这正是"宁可难看也要如实"的场景（DSH 自己的平台余额 schema 也允许负数：
 *     `packages/credentials/deepseek-account-platform/src/details.ts` 里
 *     `balance: z.string().regex(/^-?\d+(?:\.\d+)?$/)`）；
 *   · 单条坏掉（`currency` 不是非空字符串等）**只丢这一条**，不牵连整份 ——
 *     一份里还有别的币种可用时，界面就该显示那些。
 */

/** 一个币种的余额（金额已消毒：有限数；负数是欠费/退款，保留符号）。 */
export interface BalanceEntry {
  readonly currency: string
  /** 赠送 + 充值之和（**不用**平台自己的 total_balance：两者不一致时以分项为准）。 */
  readonly total: number
  readonly granted: number
  readonly toppedUp: number
}

/** 一次余额查询的结果。 */
export interface BalanceSnapshot {
  readonly available: boolean
  readonly entries: readonly BalanceEntry[]
}

/** 本插件宿主半暴露的余额路由（客户端只从这里取数，理由见文件头"必须在 host 半"）。 */
export const BALANCE_API_PATH = '/composer-ux/balance'
/** 官方余额端点。 */
export const DEEPSEEK_BALANCE_URL = 'https://api.deepseek.com/user/balance'

/**
 * 把一个 wire 上的金额消毒成有限数。
 *
 * 认字符串（`"110.00"`；空串/纯空白 ⇒ 0）与数字；**负数原样保留**（理由见文件头）。
 * 其余（`null`/`undefined`/布尔/对象/数组/`NaN`/`Infinity`/非数字字符串）一律 0。
 *
 * @param value 任意值（未消毒的 wire 输入）。
 * @returns 有限数。
 */
function amountOf(value: unknown): number {
  if (typeof value === 'string') {
    const text = value.trim()
    if (text.length === 0) return 0
    const parsed = Number(text)
    return Number.isFinite(parsed) ? withoutNegativeZero(parsed) : 0
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return withoutNegativeZero(value)
}

/**
 * 把 `-0` 归一成 `0`。
 *
 * 两者在显示上没区别，但 `Object.is(-0, 0)` 为假、`String(-0)` 会印出 `-0`，
 * 留着只会让下游的相等判断和快照对比莫名其妙。
 */
function withoutNegativeZero(value: number): number {
  return value === 0 ? 0 : value
}

/**
 * 解析 `balance_infos` 里的一条。
 *
 * @param value 任意值（未消毒的 wire 输入）。
 * @returns 该条目；`currency` 不是非空字符串时 `undefined` —— 丢这一条，不丢整份。
 */
function entryOf(value: unknown): BalanceEntry | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (typeof raw.currency !== 'string') return undefined
  const currency = raw.currency.trim()
  if (currency.length === 0) return undefined
  const granted = amountOf(raw.granted_balance)
  const toppedUp = amountOf(raw.topped_up_balance)
  const sum = granted + toppedUp
  return {
    currency,
    // 分项相加的理由见文件头；极端溢出（1e308 + 1e308 ⇒ Infinity）不是余额，当 0 更诚实。
    total: Number.isFinite(sum) ? sum : 0,
    granted,
    toppedUp,
  }
}

/**
 * 解析官方余额响应体。
 *
 * @param value 任意值（未消毒的 wire 输入）。
 * @returns 快照；形状不对/没有任何可用条目就是 `undefined`。
 */
export function parseBalancePayload(value: unknown): BalanceSnapshot | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  // `is_available` 缺失或不是布尔 ⇒ 形状不对。这一位是"账号能不能用"的唯一真值来源，
  // 猜它（比如"有条目就算可用"）等于用编出来的事实渲染界面，所以整份作废。
  const available = raw.is_available
  if (typeof available !== 'boolean') return undefined
  if (!Array.isArray(raw.balance_infos)) return undefined
  const entries: BalanceEntry[] = []
  for (const item of raw.balance_infos) {
    const entry = entryOf(item)
    if (entry !== undefined) entries.push(entry)
  }
  // 一条可用的都没有 ⇒ 整份 undefined（而不是"可用但没有币种"的空快照）。
  if (entries.length === 0) return undefined
  return { available, entries }
}

/**
 * 这个 baseURL 能不能拿来查余额。
 * **安全底线**：只有 `api.deepseek.com`（含 https）放行 —— 用户的 baseURL 一旦被指向第三方，
 * 我们绝不把 API Key 发出去。
 *
 * 放行 `https://api.deepseek.com`、带路径/尾斜杠、大小写不同的写法（`URL` 会把 hostname
 * 规范成小写）。拒绝 `http://`、子域名（`sub.api.deepseek.com`）、伪装域
 * （`api.deepseek.com.evil.com`、`evil.com/api.deepseek.com`）、显式端口、带用户名密码、
 * 空串、非字符串、以及所有解析不出 URL 的输入。宁严勿松：被误拒的代价是界面上少一行余额，
 * 被误放的代价是 API Key 泄露。
 *
 * @param baseUrl 用户配置里的 baseURL（运行时可能不是字符串，所以内部仍做类型检查）。
 * @returns 是否允许把 Bearer 头发往这个 baseURL。
 */
export function balanceEndpointAllowed(baseUrl: string): boolean {
  if (typeof baseUrl !== 'string' || baseUrl.length === 0) return false
  let parsed: URL
  try {
    parsed = new URL(baseUrl)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:') return false
  // 逐字比较规范化后的 hostname：`api.deepseek.com.evil.com` 在这里不等（拒），
  // `https://evil.com/api.deepseek.com` 的 hostname 是 `evil.com`（也拒）。
  if (parsed.hostname !== 'api.deepseek.com') return false
  // 官方端点是 443 且不带 userinfo；多出任意一样，就说明这不是官方的那个 baseURL。
  // （`https://host:443` 会被 URL 规范化成无端口，所以这一条不误伤显式写了 443 的配置。）
  if (parsed.port !== '' && parsed.port !== '443') return false
  if (parsed.username !== '' || parsed.password !== '') return false
  return true
}
