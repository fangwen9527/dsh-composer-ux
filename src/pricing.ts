/**
 * 「金额」纯模块：DeepSeek 刊例价 + 费用估算 + 金额/Token 格式化。
 *
 * 零 import、零 DOM、零 node API —— host 与 client 两半共用（与 `settings-contract.ts` 同规矩）。
 *
 * ## 为什么金额得自己算
 *
 * DSH 把 token 送到浏览器的那条投影（`tokenUsage`）只有 token 桶：`inputTokens`
 * （未缓存输入）/ `cacheReadTokens`（缓存命中）/ `cacheWriteTokens` / `outputTokens`，
 * **没有任何一处把"钱"送到客户端** —— 官方全库搜不到 cost/price 的客户端出口；
 * `llm-pi-ai` 里那个 `cost` 只活在 provider 的模型目录内部，而且用户自定义的路由
 * （profile 里手写的 provider）拿到的是 `NO_COST`（全 0）。所以：
 *
 *     费用 = 未缓存输入 × miss价 + 缓存命中 × hit价 + 输出 × out价 （每 1M tokens）
 *
 * ## 价目表与算法出处（重要）
 *
 * 下面的刊例价快照、模型别名、峰谷规则、`costOf`/`formatMoney`/`formatTokens` 的**分档规则**
 * 都来自 `dsh-plugin-usage-meter@1.9.1`（**MIT**，Copyright (c) 2026 fancr-code）的
 * `lib/client.js`。那份插件在 DSH 0.1.7 上打不开网页（它的客户端半 inject 了已删除的
 * `settingsScope` 服务），但其**计价部分是独立且正确的**，所以按用户要求把能力搬进本插件，
 * 并在此显式标注出处。逐样本对拍见 `test/pricing.mjs`（那份实现的原文被抄进测试当基准）。
 *
 * ## 与那份实现的一处有意差异
 *
 * `formatMoney` 的尾部去零：原文用 `toFixed(4).replace(/0+$/,'')`，遇到 `0` 会输出 `¥0.`
 * （把小数点后的零全删光）。本文件改成"至少保留两位小数"，`0` 输出 `¥0.00`。
 * 测试里对这一条是**断言我们的行为**，其余样本才与原文对拍。
 */

/** 一档单价：每 1M tokens 的价格（miss = 未缓存输入，hit = 缓存命中，out = 输出）。 */
export interface PriceTriple {
  readonly miss: number
  readonly hit: number
  readonly out: number
}

/** 一个模型的刊例价：高峰/空闲两档 × 人民币/美元两币种。 */
export interface ModelPrice {
  readonly peak: { readonly cny: PriceTriple; readonly usd: PriceTriple }
  readonly offPeak: { readonly cny: PriceTriple; readonly usd: PriceTriple }
}

/** 计费币种。 */
export type Currency = 'CNY' | 'USD'

/**
 * DeepSeek 官方刊例价（每 1M tokens）。
 *
 * 高峰时段（北京时间 09:00–12:00、14:00–18:00，工作日）价格为空闲时段的 2 倍。
 * 2026-09 起 `deepseek-flash`（V4.1-Flash）取代 `v4-flash`/`vision-exp`：旧名退役，
 * 但请求仍由 Flash 服务并按其计费，所以别名表把它们都指到 flash。
 */
export const PRICE_TABLE: Readonly<Record<string, ModelPrice>> = {
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

/** 已退役/等价模型名 → 现役刊例价键。 */
export const MODEL_ALIASES: Readonly<Record<string, string>> = {
  'deepseek-chat': 'deepseek-flash',
  'deepseek-reasoner': 'deepseek-v4-pro',
  'deepseek-v4-flash-vision-exp': 'deepseek-flash',
}

/** 认不出模型时按谁计价。 */
export const DEFAULT_PRICING_MODEL = 'deepseek-flash'

/** 刊例价快照的核对日期（显示用，不是"实时价"）。 */
export const PRICE_VERIFIED_AT = '2026-09-15'

/** 用户只填人民币覆盖价时，按官方双币比例折算美元。 */
export const CNY_PER_USD = 6.82

/** 高峰时段（UTC 小时对）—— 官方规则：UTC 01–04、06–10，仅周一至周五。 */
export const PEAK_UTC_RANGES: readonly (readonly [number, number])[] = [[1, 4], [6, 10]]

/** 用户覆盖价：按模型给高峰/空闲两档，只写要改的那几档即可（缺的沿用刊例价）。 */
export interface PriceOverrideTier {
  readonly cacheMissInput?: number
  readonly miss?: number
  readonly cacheHitInput?: number
  readonly hit?: number
  readonly output?: number
  readonly out?: number
}

/** 一个模型的覆盖价（单位：人民币/1M）。 */
export interface PriceOverride {
  readonly peak?: PriceOverrideTier
  readonly offPeak?: PriceOverrideTier
}

/** 覆盖价表：键是模型名（别名也可）。 */
export type PriceOverrideTable = Readonly<Record<string, PriceOverride>>

/** 三项单价的键名（设置页那一行六个数字框按这个顺序排：未缓存输入 / 缓存命中 / 输出）。 */
export const PRICE_FIELDS = ['miss', 'hit', 'out'] as const

/** 一项单价的键名。 */
export type PriceField = (typeof PRICE_FIELDS)[number]

/** 内置刊例价里有哪几个模型（顺序即 {@link PRICE_TABLE} 的声明顺序，设置页照这个排）。 */
export const BUILTIN_PRICING_MODELS: readonly string[] = Object.keys(PRICE_TABLE)

/** 解析后的定价结果。 */
export interface ResolvedPrice {
  /** 归一化后的模型键（一定落在 {@link PRICE_TABLE} 里）。 */
  readonly model: string
  /** 计价时是否高峰档。 */
  readonly peak: boolean
  /** 币种。 */
  readonly currency: Currency
  /** 生效单价。 */
  readonly prices: PriceTriple
  /** 单价是否被用户覆盖过。 */
  readonly overridden: boolean
}

/**
 * 一次请求/一个会话的 token 桶。
 *
 * ⚠️ **同一个"未缓存输入"有两个键名，两个都得认**（2026-09-28 真机踩过）：
 *   · 会话日志里的官方 `TokenUsage` → `inputTokens`；
 *   · **客户端 `tokenUsage` 投影**（`token-meter` 的 `projectionSchema`）→ `uncachedInputTokens`。
 * 只认前者的话，面板会把"未缓存输入"读成 0：命中率变成 100%、**金额少算掉那部分输入**，
 * 而且"日志 vs 投影"的一致性判据永远不成立（详见 `client/CostChipEntry.tsx` 文件头）。
 */
export interface UsageBuckets {
  readonly inputTokens?: number
  readonly uncachedInputTokens?: number
  readonly cacheReadTokens?: number
  readonly cacheWriteTokens?: number
  readonly outputTokens?: number
}

/** 归一化模型名：小写、去空格、走别名；空值落到默认模型。 */
export function normalizeModel(model: unknown): string {
  if (typeof model !== 'string' || model.length === 0) return DEFAULT_PRICING_MODEL
  const key = model.trim().toLowerCase()
  if (key.length === 0) return DEFAULT_PRICING_MODEL
  return MODEL_ALIASES[key] ?? key
}

/** 认不认得这个模型（认不出会按 {@link DEFAULT_PRICING_MODEL} 计价）。 */
export function isKnownModel(model: unknown): boolean {
  return normalizeModel(model) in PRICE_TABLE
}

/** 某个时刻是否高峰价（UTC 周一至周五、UTC 01–04 或 06–10）。 */
export function isPeakAt(at: Date): boolean {
  const day = at.getUTCDay()
  if (day < 1 || day > 5) return false
  const hour = at.getUTCHours() + at.getUTCMinutes() / 60
  return PEAK_UTC_RANGES.some(([start, end]) => hour >= start && hour < end)
}

/** 有限数才认，其余当没填。 */
function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** 用覆盖档改一档单价；未提供的档沿用基准。 */
function applyTier(base: PriceTriple, tier: PriceOverrideTier | undefined): { prices: PriceTriple; touched: boolean } {
  if (tier === undefined) return { prices: base, touched: false }
  const miss = finite(tier.cacheMissInput) ?? finite(tier.miss)
  const hit = finite(tier.cacheHitInput) ?? finite(tier.hit)
  const out = finite(tier.output) ?? finite(tier.out)
  const next: PriceTriple = {
    miss: miss ?? base.miss,
    hit: hit ?? base.hit,
    out: out ?? base.out,
  }
  const touched = (miss !== undefined && miss !== base.miss)
    || (hit !== undefined && hit !== base.hit)
    || (out !== undefined && out !== base.out)
  return { prices: next, touched }
}

/**
 * 解析某模型在某时刻的生效单价。
 *
 * 语义**逐字对齐出处实现**（`pricesOf`），两处容易被写错、这里显式记下来：
 *
 *  1. 没有覆盖价时，美元走表里的**美元列**（不是人民币除以汇率 —— 表里那两列是各自四舍五入过的）；
 *  2. **有**覆盖价时，先把人民币档整体重建（未提供的档沿用表里人民币列），
 *     美元再从重建后的人民币折算 —— 也就是覆盖价一定是**人民币口径**。
 *     所以"只覆盖 miss 一项"在美元口径下会顺带把 hit/out 换成 人民币÷6.82，
 *     与表里美元列有千分之一级的差；这是出处实现的行为，移植时保持原样。
 *
 * 优先级：**用户覆盖价 > 内置刊例价**。
 *
 * @param model 模型名（可用别名）。
 * @param options.currency 币种，默认人民币。
 * @param options.at 计价时刻，默认现在（决定峰谷档）。
 * @param options.peak **直接指定档位**，给了就不看时刻。两处需要它：
 *   1. 设置页要同时显示高峰/空闲两档的生效价（不可能同时"是"两个时刻）；
 *   2. 宿主半按**每条事件自己的时间戳**判档后逐档计价（见 `usage-fold.ts`），
 *      分档已经是事实，再让 resolvePrice 去猜时刻只会把整数拆错。
 * @param options.overrides 用户覆盖价（人民币/1M）。
 */
export function resolvePrice(
  model: unknown,
  options: {
    currency?: Currency
    at?: Date
    peak?: boolean
    overrides?: PriceOverrideTable | undefined
  } = {},
): ResolvedPrice {
  const currency = options.currency === 'USD' ? 'USD' : 'CNY'
  const normalized = normalizeModel(model)
  const base = PRICE_TABLE[normalized] ?? PRICE_TABLE[DEFAULT_PRICING_MODEL]!
  const peak = options.peak ?? isPeakAt(options.at ?? new Date())
  const tier = peak ? base.peak : base.offPeak
  const override = options.overrides?.[normalized] ?? options.overrides?.[String(model ?? '')]
  const overrideTier = peak ? override?.peak : override?.offPeak
  if (overrideTier === undefined) {
    return { model: normalized, peak, currency, prices: currency === 'USD' ? tier.usd : tier.cny, overridden: false }
  }
  const applied = applyTier(tier.cny, overrideTier)
  const cny = applied.prices
  const prices = currency === 'USD'
    ? { miss: cny.miss / CNY_PER_USD, hit: cny.hit / CNY_PER_USD, out: cny.out / CNY_PER_USD }
    : cny
  return { model: normalized, peak, currency, prices, overridden: applied.touched }
}

/** 三个桶各自的 token 数（缺的当 0，非有限数当 0）。 */
export interface CostBuckets {
  /** 未缓存输入（= 官方 `inputTokens`）。 */
  readonly miss: number
  /** 缓存命中（= 官方 `cacheReadTokens`）。 */
  readonly hit: number
  /** 输出（= 官方 `outputTokens`）。 */
  readonly out: number
}

/**
 * 从官方 token 桶取出计费用的三个计数。
 *
 * 口径要点：官方 `inputTokens` 就是**未缓存输入**（`billedInput = inputTokens +
 * cacheReadTokens + cacheWriteTokens`，见 `llm/src/types.ts` 的注释），而 DeepSeek 不对
 * 缓存写入单独计价，所以 `cacheWriteTokens` 只参与"计费输入"的**显示**，不进费用。
 * （"计费输入"那个显示用的函数在 `client/stats-line.ts`，不在这里再造一个同义的。）
 *
 * **两个键名都认**：日志里叫 `inputTokens`、客户端投影里叫 `uncachedInputTokens`
 * （见 {@link UsageBuckets} 的注释）—— 只认一个名字就会把未缓存输入读成 0。
 */
export function costBucketsOf(usage: UsageBuckets | undefined | null): CostBuckets {
  return {
    miss: finite(usage?.inputTokens) ?? finite(usage?.uncachedInputTokens) ?? 0,
    hit: finite(usage?.cacheReadTokens) ?? 0,
    out: finite(usage?.outputTokens) ?? 0,
  }
}

/** 按单价算一次费用（每 1M tokens 计价）。 */
export function costOf(buckets: CostBuckets, prices: PriceTriple): number {
  return buckets.miss / 1e6 * prices.miss
    + buckets.hit / 1e6 * prices.hit
    + buckets.out / 1e6 * prices.out
}

/** 三个费用分项（明细用）。 */
export interface CostParts {
  readonly miss: number
  readonly hit: number
  readonly out: number
  readonly total: number
}

/** 拆出三分项与合计。 */
export function costPartsOf(buckets: CostBuckets, prices: PriceTriple): CostParts {
  const miss = buckets.miss / 1e6 * prices.miss
  const hit = buckets.hit / 1e6 * prices.hit
  const out = buckets.out / 1e6 * prices.out
  return { miss, hit, out, total: miss + hit + out }
}

/** 去掉小数尾零，但至少保留 `minDecimals` 位。 */
function trimZeros(text: string, minDecimals: number): string {
  const dot = text.indexOf('.')
  if (dot < 0) return text
  const head = text.slice(0, dot)
  const fraction = text.slice(dot + 1)
  let end = fraction.length
  while (end > minDecimals && fraction[end - 1] === '0') end -= 1
  return end === 0 ? head : `${head}.${fraction.slice(0, end)}`
}

/**
 * 金额格式化：`¥`/`$` + 分档小数位。
 *
 * · ≥ 1        → 两位（`¥4.09`）
 * · ≥ 0.01     → 四位去尾零，至少两位（`¥0.041`）
 * · 其余       → 六位去尾零，至少两位（`¥0.000041`）
 * · 0 / 非有限 → `¥0.00`
 */
export function formatMoney(value: unknown, currency: Currency = 'CNY'): string {
  const symbol = currency === 'USD' ? '$' : '¥'
  const n = finite(value)
  if (n === undefined || n === 0) return `${symbol}0.00`
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1) return `${sign}${symbol}${abs.toFixed(2)}`
  if (abs >= 0.01) return `${sign}${symbol}${trimZeros(abs.toFixed(4), 2)}`
  return `${sign}${symbol}${trimZeros(abs.toFixed(6), 2)}`
}

/** Token 数格式化：B/M/K 三档（`1.2M`、`45.6K`、`731`）。 */
export function formatTokens(value: unknown): string {
  const n = finite(value)
  if (n === undefined || n === 0) return '0'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1e9) return sign + trimZeros((abs / 1e9).toFixed(2), 0) + 'B'
  if (abs >= 1e6) return sign + trimZeros((abs / 1e6).toFixed(2), 0) + 'M'
  if (abs >= 1e3) return sign + trimZeros((abs / 1e3).toFixed(1), 0) + 'K'
  return sign + String(Math.round(abs))
}

/**
 * 把用户填的覆盖价表解析成结构化表（设置页文本框 → 这里的产物）。
 *
 * 只认形状对的部分：不是对象、模型项不是对象、档位里出现非有限数的键，都**丢掉那一项**
 * 而不是让整份设置失效 —— 与 `sanitizeSettings` 的其它字段同一态度（坏输入退回默认，
 * 不能让一个手抖的逗号把整页设置打成默认）。
 */
export function parsePriceOverrides(raw: unknown): PriceOverrideTable | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const out: Record<string, PriceOverride> = {}
  for (const [model, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) continue
    const tiers: { peak?: PriceOverrideTier; offPeak?: PriceOverrideTier } = {}
    for (const tierName of ['peak', 'offPeak'] as const) {
      const tierRaw = (value as Record<string, unknown>)[tierName]
      if (typeof tierRaw !== 'object' || tierRaw === null || Array.isArray(tierRaw)) continue
      const source = tierRaw as Record<string, unknown>
      const tier: Record<string, number> = {}
      for (const key of ['cacheMissInput', 'miss', 'cacheHitInput', 'hit', 'output', 'out'] as const) {
        const n = finite(source[key])
        if (n !== undefined && n >= 0) tier[key] = n
      }
      if (Object.keys(tier).length > 0) tiers[tierName] = tier as PriceOverrideTier
    }
    if (Object.keys(tiers).length > 0) out[String(model).trim().toLowerCase()] = tiers
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * 官方（刊例）单价里某一档的三项 —— 设置页拿它当输入框的**占位提示**。
 *
 * 认不出的模型按 {@link DEFAULT_PRICING_MODEL} 返回：那正是 `resolvePrice` 对未列名模型的
 * 兜底价，所以占位提示与"不填时会按什么价算"永远一致（差一个模型就是 2 倍价差）。
 */
export function officialTripleOf(model: unknown, peak: boolean): PriceTriple {
  const base = PRICE_TABLE[normalizeModel(model)] ?? PRICE_TABLE[DEFAULT_PRICING_MODEL]!
  return peak ? base.peak.cny : base.offPeak.cny
}

/**
 * 覆盖价表里某模型某档的原始项（没写过就是 undefined）。
 *
 * 键的匹配与 `resolvePrice` **同一套**：先归一化名（别名 → 现役名），再退回原样名字。
 * 两处若分叉，会出现"设置页显示已填、实际计价没生效"这种最难查的偏差。
 */
export function overrideTierOf(
  table: PriceOverrideTable | undefined,
  model: unknown,
  peak: boolean,
): PriceOverrideTier | undefined {
  if (table === undefined) return undefined
  const override = table[normalizeModel(model)] ?? table[String(model ?? '')]
  return peak ? override?.peak : override?.offPeak
}

/** 某一格当前填了什么：没填是 `undefined`（界面要显示成空框，而不是 `0`）。 */
export function overrideValueOf(
  table: PriceOverrideTable | undefined,
  model: unknown,
  peak: boolean,
  field: PriceField,
): number | undefined {
  const tier = overrideTierOf(table, model, peak)
  if (tier === undefined) return undefined
  // 只认 canonical 键：`cacheMissInput` 之类的别名键在写入端已经归一到 miss/hit/out，
  // 手工在设置文件里写别名也能被 resolvePrice 认，但这里不重复一套优先级。
  return finite(tier[field])
}

/**
 * 写入/清空一格，返回**新的**覆盖价表（不可变；原表不动）。
 *
 * 清空的传播规则（不这么写就会留下一堆空壳，设置文件越滚越脏、界面还会多出空行）：
 *   · 一档三项全空 → 删掉这一档；
 *   · 一个模型两档全空 → 删掉这个模型；
 *   · 整表全空 → 返回 `undefined`（调用方据此把这个键从设置里去掉）。
 *
 * @param table 现有覆盖价表（可为空）。
 * @param model 模型名（大小写/空格会被归一；别名按名字原样存，不强行改成现役名）。
 * @param peak 高峰档还是空闲档。
 * @param field 三项里的哪一项。
 * @param value 数字则写入；`undefined`/非有限数/负数都当**清空**（界面只会传合法值）。
 */
export function withOverrideValue(
  table: PriceOverrideTable | undefined,
  model: unknown,
  peak: boolean,
  field: PriceField,
  value: number | undefined,
): PriceOverrideTable | undefined {
  const key = String(model ?? '').trim().toLowerCase()
  if (key.length === 0) return table
  const next: Record<string, PriceOverride> = { ...(table ?? {}) }
  const tierName = peak ? 'peak' : 'offPeak'
  const current = next[key] ?? {}
  const tier: Record<string, number> = { ...(peak ? current.peak : current.offPeak) } as Record<string, number>
  const n = finite(value)
  if (n === undefined || n < 0) delete tier[field]
  else tier[field] = n
  const entry: { peak?: PriceOverrideTier; offPeak?: PriceOverrideTier } = { ...current }
  if (Object.keys(tier).length === 0) delete entry[tierName]
  else entry[tierName] = tier as PriceOverrideTier
  if (entry.peak === undefined && entry.offPeak === undefined) delete next[key]
  else next[key] = entry
  return Object.keys(next).length > 0 ? next : undefined
}

/**
 * 表里**自定义**的模型名（内置刊例价与它的别名之外的那些）—— 设置页据此多渲染几行。
 *
 * 别名不算自定义：`deepseek-chat` 与 `deepseek-flash` 是同一份价，给它单开一行只会让人
 * 以为可以分开调。按表里的键原样返回（保持稳定顺序），不改写大小写。
 */
export function customPricingModels(table: PriceOverrideTable | undefined): readonly string[] {
  if (table === undefined) return []
  return Object.keys(table).filter(key => !isKnownModel(key))
}

/**
 * 把某个模型整个从覆盖价表里删掉（"恢复官方价" / 删掉自定义行），返回新表（不可变）。
 *
 * 与 {@link withOverrideValue} 的分工：那个改一格（并按"空了就往上收"清理空壳），
 * 这个整行删掉 —— 用户点「恢复官方价」时不该只剩一个空对象留在设置里。
 */
export function withoutPricingModel(
  table: PriceOverrideTable | undefined,
  model: unknown,
): PriceOverrideTable | undefined {
  if (table === undefined) return undefined
  const key = String(model ?? '').trim().toLowerCase()
  const next: Record<string, PriceOverride> = { ...table }
  delete next[key]
  return Object.keys(next).length > 0 ? next : undefined
}

/** 设置页数字框的文本解析结果。 */
export type PriceTextParse =
  /** 空框 = 清掉这一格（沿用官方价）。 */
  | { readonly kind: 'empty' }
  /** 合法单价（有限非负数）。 */
  | { readonly kind: 'number'; readonly value: number }
  /** 既不是空也无法当数字（例如 `1,02`、`2元`）——**不要**当成清空，界面要报错。 */
  | { readonly kind: 'invalid' }

/**
 * 数字框文本 → 结果。
 *
 * 为什么要分成三态而不是"非法就当空"：把 `1,02` 静默当成"清空这一格"，用户看到的是
 * **价格悄悄回到官方价**（数字看着还算合理），而真正的问题（千分位逗号）一点提示都没有。
 */
export function parsePriceText(text: string): PriceTextParse {
  const trimmed = text.trim()
  if (trimmed === '') return { kind: 'empty' }
  const value = Number(trimmed)
  if (!Number.isFinite(value) || value < 0) return { kind: 'invalid' }
  return { kind: 'number', value }
}
