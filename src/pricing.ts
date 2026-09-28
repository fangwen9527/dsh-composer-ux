/**
 * 「金额」纯模块：DeepSeek 刊例价（含**历史价档**）+ 峰谷/节假日规则 + 第三方模型价目 + 费用估算 + 金额/Token 格式化。
 *
 * 零 import、零 DOM、零 node API —— host 与 client 两半共用（与 `settings-contract.ts` 同规矩）。
 *
 * ## 为什么金额得自己算
 *
 * DSH 把 token 送到浏览器的那条投影（`tokenUsage`）只有 token 桶：`inputTokens`
 * （未缓存输入）/ `cacheReadTokens`（缓存命中）/ `cacheWriteTokens` / `outputTokens`，
 * **没有任何一处把"钱"送到客户端** —— 官方全库搜不到 cost/price 的客户端出口；
 * `llm-pi-ai` 里那个 `cost` 只活在 provider 的模型目录内部，而且用户自定义的路由
 * （profile 里手写的 provider）拿到的是 `NO_COST`（全 0）。DSH 自己的
 * `llm-deepseek/src/request-pricing.ts` 也不是钱的算法（那是请求图片的 token 估算）。
 * 所以：
 *
 *     费用 = 未缓存输入 × miss价 + 缓存命中 × hit价 + 输出 × out价 （每 1M tokens）
 *
 * `cacheWriteTokens` **不单独计价**：官方价目表只有「缓存命中/未命中」两行输入价，
 * 而 DeepSeek 的 Anthropic 兼容端点回的那个 `cache_creation_input_tokens` 实测恒为 0
 * （2026-09-29 查本机投影缓存 200 处样本，全是 0），所以它只进显示口径、不进费用。
 *
 * ## 0.10.0 起的三件事（每条都改过数字口径，别照旧注释理解）
 *
 * 1. **价格历史档（era）**：官方会调价。2026-09-10 12:00（北京）Flash 未缓存输入
 *    0.22 → 0.15 美元、输出 0.66 → 0.60、命中 0.007 → 0.003（腾讯云 TokenHub 公告，
 *    <https://intl.cloud.tencent.com/ind/announce/detail/101513>）。若一律用"当前价"
 *    重算，8 月跑的会话金额会跟着变，跟当时的真实账单对不上。所以价目表按**生效时刻**
 *    分档（{@link PRICE_ERAS}），折叠时给每条用量打上它发生那一刻的档位 id（见
 *    `usage-fold.ts` 的 `TierAt`），历史金额永不因调价而变。
 * 2. **中国法定节假日全天谷价**：官方规则原文是"北京时间周一至周五（**不含中国法定节假日**）
 *    9:00–12:00、14:00–18:00 为高峰，其余时段包括周末及节假日全天为谷价"。
 *    不认节假日就会在国庆这类日子把工作日的高峰两段按峰价算 —— **整整 2 倍**
 *    （2026 国庆 10-01～10-07，下一个工作日高峰就是它）。周末另有一条更晚的边界：
 *    2026-08-23（周日）00:00 起周六周日才全天谷价，**在那之前的周六周日仍有高峰时段**
 *    （2026-08-22 那个周六就是），见 {@link WEEKEND_OFFPEAK_AT_MS}。
 * 3. **按 provider 定价 + 未定价就说未定价**：同一份"金额"要能算非 DeepSeek 路由
 *    （中转站、自建 provider）。**绝不把 DeepSeek 的 flash 价静默套到别人头上** ——
 *    认不出价的模型返回 `unpriced: true`、单价全 0，界面显示"未定价"并让用户在
 *    「金额」卡里补一行价（这是 `dsh-cost-meter` 的纪律，照抄）。
 *
 * ## 价目表与算法出处（重要）
 *
 * 最早那版刊例价、模型别名、`costOf`/`formatMoney`/`formatTokens` 的**分档规则**
 * 来自 `dsh-plugin-usage-meter@1.9.1`（**MIT**，Copyright (c) 2026 fancr-code）的
 * `lib/client.js`（那份插件在 DSH 0.1.7 上打不开网页，但计价部分是独立且正确的）。
 * 0.9.1 起的人民币列**直接采用官方人民币页的原值**（此前是拿美元列乘 6.82 凑的，
 * 于是 flash 写成 2.05/8.18 而官方是 2/8 —— 高报约 2.3%，0.10.0 修掉）。
 * 历史档的数字、节假日表、周末生效点与 `dsh-cost-meter@1.7.44` 交叉核对过
 * （它的 `lib/pricing.js` 有同样三档与 2026 假期表）。
 *
 * ## 与那份 `usage-meter` 实现的一处有意差异
 *
 * `formatMoney` 的尾部去零：原文用 `toFixed(4).replace(/0+$/,'')`，遇到 `0` 会输出 `¥0.`
 * （把小数点后的零全删光）。本文件改成"至少保留两位小数"，`0` 输出 `¥0.00`。
 * 测试里对这一条是**断言我们的行为**，其余样本才与原文对拍。
 *
 * ## 关于唯一的那一个 import
 *
 * 本模块一直自称"零 import、零 DOM、零 node API"，0.10.0 起多了下面这一行 —— 那是**生成出来的
 * 纯数据**（models.dev 快照，同样零依赖、零副作用），不值得为它把 346 条价目手抄进来。
 * 除此之外仍然零依赖。
 */
import { BUILTIN_PROVIDER_PRICES, PROVIDER_PRICES_SNAPSHOT_AT } from './provider-prices.ts'

/** 把快照的两个常量原样再导出：界面要显示快照日期，测试要直接断言快照内容。 */
export { BUILTIN_PROVIDER_PRICES, PROVIDER_PRICES_SNAPSHOT_AT }

/** 一档单价：每 1M tokens 的价格（miss = 未缓存输入，hit = 缓存命中，out = 输出）。 */
export interface PriceTriple {
  readonly miss: number
  readonly hit: number
  readonly out: number
}

/** 一档单价的双币种版本（人民币列与美元列都是官方页原值，不互相折算）。 */
export interface PriceTierSet {
  readonly cny: PriceTriple
  readonly usd: PriceTriple
}

/** 一个模型的刊例价：高峰/空闲两档 × 人民币/美元两币种。 */
export interface ModelPrice {
  readonly peak: PriceTierSet
  readonly offPeak: PriceTierSet
}

/** 计费币种。 */
export type Currency = 'CNY' | 'USD'

/** 全 0 单价（未定价模型用；`formatMoney` 会把它显示成 ¥0.00，界面靠 `unpriced` 换文案）。 */
export const ZERO_TRIPLE: PriceTriple = { miss: 0, hit: 0, out: 0 }

/** 名义汇率：只用于「用户只填人民币覆盖价」时折算美元列，**不是**官方两列的换算关系。 */
export const CNY_PER_USD = 6.82

// ─────────────────────────────────────────────────────────────────────────────
// 峰谷与节假日
// ─────────────────────────────────────────────────────────────────────────────

/** 高峰时段（UTC 小时对，半开区间）—— 官方规则：UTC 01–04、06–10。 */
export const PEAK_UTC_RANGES: readonly (readonly [number, number])[] = [[1, 4], [6, 10]]

/**
 * 峰谷两档计价的起始时刻（UTC）：2026-08-16 16:00Z = 北京时间 2026-08-17 00:00。
 * 在此之前官方只有单一档价（见 {@link PRICE_ERAS} 的 `legacy` 档），**没有"高峰"这回事**，
 * 所以 {@link isPeakAt} 在这个时刻之前一律返回 false。
 */
export const PEAK_RULE_AT_MS = Date.parse('2026-08-16T16:00:00Z')

/**
 * 周末全天谷价的生效时刻（UTC）：2026-08-22 16:00Z = 北京时间 2026-08-23（周日）00:00。
 * 官方公告：[DeepSeek 再次调整计费规则](https://www.stcn.com/article/detail/4103775.html)
 * ——"自 2026 年 8 月 23 日（周日）00:00 起……周六、周日全天不再区分峰谷时段，
 * 统一按低谷时段价格计费"。**在这之前的周六周日仍有高峰时段**：2026-08-22（周六）
 * 北京时间 09:00–12:00、14:00–18:00 是峰价，历史账要按那时的规则结算。
 */
export const WEEKEND_OFFPEAK_AT_MS = Date.parse('2026-08-22T16:00:00Z')

/**
 * 内置的中国法定节假日（**北京日历日**，`YYYY-MM-DD`），命中即全天谷价。
 *
 * 来源：国务院办公厅关于 2026 年部分节假日安排的通知 ——
 * 中秋节 9 月 25 日（周五）至 27 日（周日）；国庆节 10 月 1 日（周四）至 7 日（周三）。
 * 注意**调休上班的周末仍按谷价算**（9 月 20 日周日、10 月 10 日周六都是工作日，但
 * 官方规则说的是"周末……全天为谷价"，`dsh-cost-meter` 也这么处理）。
 *
 * ⚠️ 国务院每年底才公布次年安排，这份表**必须跟着发版更新**；用户也能在设置里整份覆盖
 * （见 `settings-contract.ts` 的 `peakHolidays`），所以官方改安排时不必等我们发版。
 */
export const DEFAULT_PEAK_HOLIDAYS: readonly string[] = [
  '2026-09-25', '2026-09-26', '2026-09-27',
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
  '2026-10-05', '2026-10-06', '2026-10-07',
]

/** 北京日历日键（`YYYY-MM-DD`）—— 周末与节假日的判定基准。 */
export function beijingDayKey(ms: number): string {
  const shifted = Number.isFinite(ms) ? ms + 8 * 3_600_000 : 0
  return new Date(shifted).toISOString().slice(0, 10)
}

/** 北京时间的星期（0 = 周日 … 6 = 周六）。 */
export function beijingWeekday(ms: number): number {
  const shifted = Number.isFinite(ms) ? ms + 8 * 3_600_000 : 0
  return new Date(shifted).getUTCDay()
}

/** 只认 `YYYY-MM-DD` 形状的日期串（设置里的节假日表要能挡住脏数据）。 */
export function isDayKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value
}

/** 把设置里的节假日串清洗成日期表：坏项丢掉、去重、排序、至多 400 条。 */
export function parseHolidays(raw: unknown): readonly string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const dates = [...new Set(raw.filter(isDayKey))].sort()
  if (dates.length === 0) return undefined
  return dates.slice(0, 400)
}

/**
 * 某个时刻是否按高峰价计费。
 *
 * 判定顺序（顺序本身就是规则，别调换）：
 *   1. 峰谷制之前 → 没有高峰（{@link PEAK_RULE_AT_MS}）；
 *   2. 法定节假日 → 全天谷价；
 *   3. 周六周日（且已过 {@link WEEKEND_OFFPEAK_AT_MS}）→ 全天谷价；
 *   4. 其余看 UTC 时段是否落在 {@link PEAK_UTC_RANGES}。
 *
 * 第 3 条的时间边界不能省：2026-08-22 那个周六在"周末全谷"生效之前，它是有高峰的。
 *
 * @param at 时刻（`Date` 或毫秒）。
 * @param options.holidays 节假日表（北京日期）；不传用 {@link DEFAULT_PEAK_HOLIDAYS}。
 */
export function isPeakAt(at: Date | number, options: { holidays?: readonly string[] } = {}): boolean {
  const ms = typeof at === 'number' ? at : at.getTime()
  if (!Number.isFinite(ms)) return false
  if (ms < PEAK_RULE_AT_MS) return false
  const holidays = options.holidays ?? DEFAULT_PEAK_HOLIDAYS
  if (ms >= WEEKEND_OFFPEAK_AT_MS && holidays.includes(beijingDayKey(ms))) return false
  const weekday = beijingWeekday(ms)
  if (ms >= WEEKEND_OFFPEAK_AT_MS && (weekday === 0 || weekday === 6)) return false
  const date = new Date(ms)
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60
  return PEAK_UTC_RANGES.some(([start, end]) => hour >= start && hour < end)
}

/** 当前峰谷相位（「峰谷提醒」用它算倒计时）。 */
export interface PeakPhase {
  /** 现在是不是高峰档。 */
  readonly inPeak: boolean
  /** 下一次档位切换的时刻（毫秒）；96 小时内找不到切换点就是 `NaN`。 */
  readonly nextAtMs: number
  /** 那次切换是不是"进入高峰"。 */
  readonly nextIntoPeak: boolean
  /** 距切换还有几分钟（向上取整；找不到切换点就是 0）。 */
  readonly minutesUntil: number
  /** 现在算谷价是不是因为法定节假日。 */
  readonly holiday: boolean
  /** 现在算谷价是不是因为周末。 */
  readonly weekend: boolean
}

/**
 * 算当前相位与下一次切换点。
 *
 * 实现就是"从整分钟起按分钟步进，找第一个档位发生变化的一分钟"：规则里的所有边界
 * （时段起止、北京日界）都落在整分钟上，所以这个扫描既简单又准；96 小时的上界保证
 * 周末＋节假日也一定能扫到下一个工作日高峰（客户端每 10 秒调一次，成本可忽略）。
 */
export function peakPhaseAt(atMs: number, options: { holidays?: readonly string[]; maxHours?: number } = {}): PeakPhase {
  const ms = Number.isFinite(atMs) ? atMs : Date.now()
  const holidays = options.holidays ?? DEFAULT_PEAK_HOLIDAYS
  const inPeak = isPeakAt(ms, { holidays })
  const weekday = beijingWeekday(ms)
  const weekend = ms >= WEEKEND_OFFPEAK_AT_MS && (weekday === 0 || weekday === 6)
  const holiday = ms >= WEEKEND_OFFPEAK_AT_MS && holidays.includes(beijingDayKey(ms))
  const step = 60_000
  const limit = ms + (options.maxHours ?? 96) * 3_600_000
  let nextAtMs = Number.NaN
  for (let t = Math.floor(ms / step) * step + step; t <= limit; t += step) {
    if (isPeakAt(t, { holidays }) !== inPeak) {
      nextAtMs = t
      break
    }
  }
  return {
    inPeak,
    nextAtMs,
    nextIntoPeak: !inPeak,
    minutesUntil: Number.isFinite(nextAtMs) ? Math.max(0, Math.ceil((nextAtMs - ms) / 60_000)) : 0,
    holiday,
    weekend,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 价目表：历史档（era）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 一个**价格历史档**：自 `fromMs` 起生效的整份官方价目表。
 *
 * 为什么要按档存整份表而不是"每模型一条生效时间"：官方可能同时动多个模型/多列，
 * 而且折叠时的 key 要稳定（`usage-fold.ts` 把档 id 并进 route key），按档切最省心。
 * 表里**只放当时在售的模型**（Pro 在 2026-09-10 那次没调价，所以两档里 Pro 的值相同
 * ——那是事实，不是复制粘贴失误）。
 */
export interface PriceEra {
  /** 稳定 id（会进折叠 key 与客户端返回体，改名等于让历史账重算）。 */
  readonly id: string
  /** 生效时刻（毫秒，含）。 */
  readonly fromMs: number
  /** 展示用标签。 */
  readonly label: string
  /** 出处（官方页/公告链接）。 */
  readonly source: string
  /** 该档的官方价目表。 */
  readonly table: Readonly<Record<string, ModelPrice>>
}

/** 峰谷制之前（单一档价）：两档填同一份值，`isPeakAt` 在那时也返回 false。 */
const ERA_LEGACY: PriceEra = {
  id: 'legacy',
  fromMs: 0,
  label: '峰谷制之前（单一档价）',
  source: 'https://api-docs.deepseek.com/zh-cn/updates（2026-07-31 V4-Flash-0731 上线时的价目；'
    + '2026-08-13 涨价公告的"涨前价"逐项对上：Flash 命中 0.02 / 未命中 1 / 输出 2，'
    + 'Pro 命中 0.025 / 未命中 3 / 输出 6）',
  table: {
    'deepseek-flash': {
      peak: { cny: { miss: 1, hit: 0.02, out: 2 }, usd: { miss: 0.14, hit: 0.0028, out: 0.28 } },
      offPeak: { cny: { miss: 1, hit: 0.02, out: 2 }, usd: { miss: 0.14, hit: 0.0028, out: 0.28 } },
    },
    'deepseek-v4-pro': {
      peak: { cny: { miss: 3, hit: 0.025, out: 6 }, usd: { miss: 0.435, hit: 0.003625, out: 0.87 } },
      offPeak: { cny: { miss: 3, hit: 0.025, out: 6 }, usd: { miss: 0.435, hit: 0.003625, out: 0.87 } },
    },
  },
}

/** 峰谷两档制（2026-08-16 16:00Z 起）的 8 月价。 */
const ERA_2026_08: PriceEra = {
  id: 'peak-2026-08',
  fromMs: PEAK_RULE_AT_MS,
  label: '峰谷两档（2026-08 价）',
  source: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing（2026-08 版）',
  table: {
    'deepseek-flash': {
      offPeak: { cny: { miss: 1.5, hit: 0.05, out: 4.5 }, usd: { miss: 0.22, hit: 0.007, out: 0.66 } },
      peak: { cny: { miss: 3, hit: 0.1, out: 9 }, usd: { miss: 0.44, hit: 0.014, out: 1.32 } },
    },
    'deepseek-v4-pro': {
      offPeak: { cny: { miss: 4.5, hit: 0.15, out: 13.5 }, usd: { miss: 0.66, hit: 0.022, out: 1.98 } },
      peak: { cny: { miss: 9, hit: 0.3, out: 27 }, usd: { miss: 1.32, hit: 0.044, out: 3.96 } },
    },
  },
}

/**
 * Flash 降价档（2026-09-10 12:00 北京起）。**这就是当前档。**
 *
 * 未缓存输入 0.22→0.15、输出 0.66→0.60、缓存命中 0.007→0.003（美元/1M，
 * 高峰同步减半），人民币列 0.05→0.02、1.5→1、4.5→4。
 * Pro **没动**（官方页今天仍单列 4.5/0.15/13.5 与 9/0.30/27）。
 * ⚠️ `dsh-cost-meter` 的注释里有一条"2026-09-14 起 V4 Pro 转按 Flash 价"的推断，
 * 腾讯云那份公告与官方页都不支持它（公告只列 V4-Flash-0731 与 Vision-Exp），
 * 所以这里**不采信**：Pro 按自己的价算。
 */
const ERA_2026_09: PriceEra = {
  id: 'flash-2026-09-10',
  fromMs: Date.parse('2026-09-10T04:00:00Z'),
  label: 'Flash 降价后（2026-09-10 起）',
  source: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing + https://intl.cloud.tencent.com/ind/announce/detail/101513',
  table: {
    'deepseek-flash': {
      offPeak: { cny: { miss: 1, hit: 0.02, out: 4 }, usd: { miss: 0.15, hit: 0.003, out: 0.6 } },
      peak: { cny: { miss: 2, hit: 0.04, out: 8 }, usd: { miss: 0.3, hit: 0.006, out: 1.2 } },
    },
    'deepseek-v4-pro': {
      offPeak: { cny: { miss: 4.5, hit: 0.15, out: 13.5 }, usd: { miss: 0.66, hit: 0.022, out: 1.98 } },
      peak: { cny: { miss: 9, hit: 0.3, out: 27 }, usd: { miss: 1.32, hit: 0.044, out: 3.96 } },
    },
  },
}

/** 内置的三档（从早到晚）。 */
export const PRICE_ERAS: readonly PriceEra[] = [ERA_LEGACY, ERA_2026_08, ERA_2026_09]

/** 当前档 id（设置页占位提示、无时间信息时的兜底都看它）。 */
export const CURRENT_ERA_ID = ERA_2026_09.id

/** **当前**档的价目表 —— 设置页占位、别名判定、`isKnownModel` 都以它为准。 */
export const PRICE_TABLE: Readonly<Record<string, ModelPrice>> = ERA_2026_09.table

/** 已退役/等价模型名 → 现役刊例价键。 */
export const MODEL_ALIASES: Readonly<Record<string, string>> = {
  // 官方脚注：`deepseek-v4-flash`、`deepseek-v4-flash-vision-exp` 仍可调用，
  // 但对应模型已下线、请求由 V4.1-Flash 服务，**并按 Flash 价计费**。
  'deepseek-v4-flash': 'deepseek-flash',
  'deepseek-v4-flash-vision-exp': 'deepseek-flash',
  'deepseek-v4.1-flash': 'deepseek-flash',
  // 更早的两代名（V4 首发时的兼容名），只作历史日志的兜底映射。
  // ⚠️ 官方更新日志（2026-04-24，中英两版都写了）：`deepseek-chat` 与 `deepseek-reasoner`
  // **都指向 `deepseek-v4-flash`** —— 前者是非思考模式、后者是思考模式，
  // 与 `deepseek-v4-pro` **没有**对应关系，且这两个名字已于 2026-07-24 停用。
  // （0.10.0 一度把 reasoner 映到 Pro，那会把 flash 的用量按 Pro 价算，约 3 倍；已修。）
  'deepseek-chat': 'deepseek-flash',
  'deepseek-reasoner': 'deepseek-flash',
}

/** 认不出模型时按谁计价（**仅限 DeepSeek 路由**，第三方路由绝不套这个价）。 */
export const DEFAULT_PRICING_MODEL = 'deepseek-flash'

/** 内置刊例价里有哪几个模型（顺序即当前档表的声明顺序，设置页照这个排）。 */
export const BUILTIN_PRICING_MODELS: readonly string[] = Object.keys(PRICE_TABLE)

/** 刊例价快照的核对日期（显示用，不是"实时价"）。 */
export const PRICE_VERIFIED_AT = '2026-09-29'

/** 把"内置档 + 同步来的额外档"合成一张按生效时刻排好的表。 */
export function allEras(extra?: readonly PriceEra[]): readonly PriceEra[] {
  if (extra === undefined || extra.length === 0) return PRICE_ERAS
  return [...PRICE_ERAS, ...extra].sort((left, right) => left.fromMs - right.fromMs)
}

/** 某个时刻生效的价格档。 */
export function eraAt(timeMs: number, extra?: readonly PriceEra[]): PriceEra {
  const eras = allEras(extra)
  const ms = Number.isFinite(timeMs) ? timeMs : Date.now()
  let found = eras[0]!
  for (const era of eras) {
    if (era.fromMs <= ms) found = era
  }
  return found
}

/** 某个时刻生效的价格档 id（折叠时把它并进 route key）。 */
export function eraIdAt(timeMs: number, extra?: readonly PriceEra[]): string {
  return eraAt(timeMs, extra).id
}

/** 按 id 找档；认不出（旧同步数据/被删掉的档）就退回当前档，绝不抛。 */
export function eraById(id: unknown, extra?: readonly PriceEra[]): PriceEra {
  const eras = allEras(extra)
  const key = typeof id === 'string' ? id : ''
  return eras.find(era => era.id === key) ?? eraAt(Date.now(), extra)
}

/** 消毒同步进来的额外历史档（形状不对的整条丢掉）。 */
export function parsePriceEras(raw: unknown): readonly PriceEra[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: PriceEra[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const row = item as Record<string, unknown>
    const id = typeof row.id === 'string' && row.id.length > 0 ? row.id : ''
    const fromMs = finite(row.fromMs)
    const table = parsePriceTable(row.table)
    if (id === '' || fromMs === undefined || table === undefined) continue
    if (PRICE_ERAS.some(era => era.id === id)) continue
    out.push({
      id,
      fromMs,
      label: typeof row.label === 'string' ? row.label : id,
      source: typeof row.source === 'string' ? row.source : '',
      table,
    })
  }
  return out.length > 0 ? out : undefined
}

/** 消毒一张价目表（模型 → 峰谷两档 × 两币种，每一项都必须是有限非负数）。 */
function parsePriceTable(raw: unknown): Readonly<Record<string, ModelPrice>> | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const out: Record<string, ModelPrice> = {}
  for (const [model, value] of Object.entries(raw as Record<string, unknown>)) {
    const entry = parseModelPrice(value)
    if (entry !== undefined) out[model.trim().toLowerCase()] = entry
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** 消毒一个模型的两档双币种价。 */
function parseModelPrice(raw: unknown): ModelPrice | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const row = raw as Record<string, unknown>
  const peak = parseTierSet(row.peak)
  const offPeak = parseTierSet(row.offPeak)
  return peak === undefined || offPeak === undefined ? undefined : { peak, offPeak }
}

/** 消毒一档的双币种价。 */
function parseTierSet(raw: unknown): PriceTierSet | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const row = raw as Record<string, unknown>
  const cny = parseTriple(row.cny)
  const usd = parseTriple(row.usd)
  return cny === undefined || usd === undefined ? undefined : { cny, usd }
}

/** 消毒三项单价。 */
function parseTriple(raw: unknown): PriceTriple | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const row = raw as Record<string, unknown>
  const miss = finite(row.miss)
  const hit = finite(row.hit)
  const out = finite(row.out)
  if (miss === undefined || hit === undefined || out === undefined) return undefined
  if (miss < 0 || hit < 0 || out < 0) return undefined
  return { miss, hit, out }
}

// ─────────────────────────────────────────────────────────────────────────────
// 第三方（非 DeepSeek）价目
// ─────────────────────────────────────────────────────────────────────────────

/** 一条第三方模型价（美元 / 1M tokens，与 models.dev 口径一致）。 */
export interface ProviderRate {
  readonly miss: number
  readonly hit: number
  readonly out: number
  /** 出处 URL（同步来源带上，界面能点）。 */
  readonly source?: string
  /** 核对日期（同步来源带上）。 */
  readonly checkedAt?: string
}

/** 第三方价目：provider → model → 单价。 */
export type ProviderPriceTable = Readonly<Record<string, Readonly<Record<string, ProviderRate>>>>

/**
 * DSH 的 provider id → models.dev 的 provider id。
 *
 * 只映射**能确定**的那几条（官方 DeepSeek 的 id 是 `deepseek-official`，见 DSH
 * `packages/llm/llm-deepseek/src/index.ts` 的 `PROVIDER` 常量；其余几条沿用
 * `dsh-context` 的 `shared/providers.ts` 重命名表）。未列出的 provider **原样透传**，
 * 再靠"按模型 id 反查"兜底 —— 乱映射比不映射更糟。
 */
export const PROVIDER_ALIASES: Readonly<Record<string, string>> = {
  'deepseek-official': 'deepseek',
  'llm-deepseek': 'deepseek',
  'kimi-coding': 'moonshotai',
  'minimax-cn': 'minimax',
  'zai-coding-cn': 'zhipuai',
}

/**
 * 这条 route 是不是 DeepSeek 官方（决定"要不要用峰谷两档 + 历史档"）。
 *
 * 认 provider 名里含 `deepseek`，或者模型名以 `deepseek` 开头。**这是刻意的宽松**：
 * 用户的 profile 里可能把官方 provider 改过 id，而模型名不会骗人；反过来，
 * 第三方 provider 上跑的 `deepseek-*` 也确实是 DeepSeek 模型（中转站同样按官方价结算）。
 */
export function isDeepSeekRoute(provider: unknown, model: unknown): boolean {
  const providerText = typeof provider === 'string' ? provider.trim().toLowerCase() : ''
  if (providerText.includes('deepseek')) return true
  const modelText = typeof model === 'string' ? model.trim().toLowerCase() : ''
  return modelText.startsWith('deepseek')
}

/**
 * 在第三方价目里找一条价。
 *
 * 查法（顺序即优先级）：精确 provider → provider 别名 → **按模型 id 全局唯一匹配**。
 * 最后那条是为"用户自定义的 provider id"准备的（中转站的名字官方不可能认识）；
 * 但**多个 provider 都有同一个模型 id 就拒绝**（例如 `glm-5` 在 z-ai 与 opencode-go
 * 下价不同，猜哪家都是在编数字）。
 */
export function providerRateOf(
  table: ProviderPriceTable | undefined,
  provider: unknown,
  model: unknown,
): { readonly provider: string; readonly model: string; readonly rate: ProviderRate } | undefined {
  if (table === undefined) return undefined
  const rawProvider = typeof provider === 'string' ? provider.trim().toLowerCase() : ''
  const rawModel = typeof model === 'string' ? model.trim().toLowerCase() : ''
  if (rawModel === '') return undefined
  const candidates = [rawProvider, PROVIDER_ALIASES[rawProvider] ?? ''].filter(key => key.length > 0)
  for (const key of candidates) {
    const rate = table[key]?.[rawModel]
    if (rate !== undefined) return { provider: key, model: rawModel, rate }
  }
  const matches: { provider: string; rate: ProviderRate }[] = []
  for (const [key, models] of Object.entries(table)) {
    const rate = models[rawModel]
    if (rate !== undefined && !matches.some(hit => hit.provider === key)) matches.push({ provider: key, rate })
  }
  return matches.length === 1 ? { provider: matches[0]!.provider, model: rawModel, rate: matches[0]!.rate } : undefined
}

/** 消毒第三方价目（坏项丢掉，不整份失败）。 */
export function parseProviderPrices(raw: unknown): ProviderPriceTable | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const out: Record<string, Record<string, ProviderRate>> = {}
  for (const [provider, models] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof models !== 'object' || models === null || Array.isArray(models)) continue
    const kept: Record<string, ProviderRate> = {}
    for (const [model, value] of Object.entries(models as Record<string, unknown>)) {
      const rate = parseProviderRate(value)
      if (rate !== undefined) kept[model.trim().toLowerCase()] = rate
    }
    if (Object.keys(kept).length > 0) out[provider.trim().toLowerCase()] = kept
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** 消毒一条第三方价（缺 hit/out 就沿用 miss —— "没公布缓存价就按普通输入计"）。 */
function parseProviderRate(raw: unknown): ProviderRate | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const row = raw as Record<string, unknown>
  const miss = finite(row.miss)
  if (miss === undefined || miss < 0) return undefined
  const hit = finite(row.hit)
  const out = finite(row.out)
  return {
    miss,
    hit: hit !== undefined && hit >= 0 ? hit : miss,
    out: out !== undefined && out >= 0 ? out : 0,
    ...(typeof row.source === 'string' ? { source: row.source } : {}),
    ...(typeof row.checkedAt === 'string' ? { checkedAt: row.checkedAt } : {}),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 用户覆盖价
// ─────────────────────────────────────────────────────────────────────────────

/** 用户覆盖价：按模型给高峰/空闲两档，只写要改的那几档即可（缺的沿用基准）。 */
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

/**
 * 覆盖价表：键是模型名（别名也可），**也支持 `provider:model`**。
 *
 * `provider:model` 那一套是为第三方路由准备的：同名模型在不同 provider 下价不同
 * （`glm-5` 在 z-ai 与 opencode-go 下不是一个价）。查价时先试 `provider:model`、
 * 再退回裸模型名（见 {@link overrideEntryOf}），两处共用同一个 helper，
 * 免得出现"设置页显示已填、实际计价没生效"。
 */
export type PriceOverrideTable = Readonly<Record<string, PriceOverride>>

/** 三项单价的键名（设置页那一行六个数字框按这个顺序排：未缓存输入 / 缓存命中 / 输出）。 */
export const PRICE_FIELDS = ['miss', 'hit', 'out'] as const

/** 一项单价的键名。 */
export type PriceField = (typeof PRICE_FIELDS)[number]

/** 有限数才认，其余当没填。 */
function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/**
 * 取某条 route 的覆盖项。
 *
 * 查法：`provider:model` → `model`；模型键**先试归一化后的现役名（别名 → 现役），再试原样名字**。
 *
 * 为什么两个都试（0.9.1 的行为，0.10.0 一度丢掉、被测试抓回来）：设置页写出来的键是**行名**，
 * 而手改 `settings.yaml` 的人可能写的是别名（`deepseek-chat`）。只认归一化名的话，
 * 那一行会**静默不生效**（金额照旧按官方价算，界面上看不出任何异常）。两代键都认的代价
 * 只是一个多出来的 Map 查找；归一化名优先，所以"两个键都写了"时以现役名为准。
 * 分隔符同时认 `:` 与 `/`（用户可能按 models.dev 的写法填 `openai/gpt-x`）。
 */
export function overrideEntryOf(
  table: PriceOverrideTable | undefined,
  provider: unknown,
  model: unknown,
): PriceOverride | undefined {
  if (table === undefined) return undefined
  const providerKey = typeof provider === 'string' ? provider.trim().toLowerCase() : ''
  const modelKey = String(model ?? '').trim().toLowerCase()
  if (modelKey === '') return undefined
  const normalized = normalizeModel(modelKey)
  const modelKeys = normalized === modelKey ? [modelKey] : [normalized, modelKey]
  const keys: string[] = []
  for (const key of modelKeys) {
    if (providerKey !== '') keys.push(`${providerKey}:${key}`, `${providerKey}/${key}`)
    keys.push(key)
  }
  for (const key of keys) {
    const entry = table[key]
    if (entry !== undefined) return entry
  }
  return undefined
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

// ─────────────────────────────────────────────────────────────────────────────
// 解析
// ─────────────────────────────────────────────────────────────────────────────

/** 一条单价是从哪来的（界面要如实说，不能让"编的价"看着像"官方价"）。 */
export type PriceSource =
  /** 官方刊例价（含历史档）。 */
  | 'official'
  /** 用户覆盖价。 */
  | 'override'
  /** 同步来的第三方价目（models.dev）。 */
  | 'provider'
  /** 认不出：单价全 0，界面显示"未定价"。 */
  | 'none'

/** 解析后的定价结果。 */
export interface ResolvedPrice {
  /** 归一化后的模型键（DeepSeek 路由一定落在价目表里；第三方路由是原样的模型名）。 */
  readonly model: string
  /** 参与判定的 provider（原样回显，界面/日志用）。 */
  readonly provider: string
  /** 计价时是否高峰档（第三方路由恒 false：它们没有峰谷两档）。 */
  readonly peak: boolean
  /** 生效的价格档 id（第三方路由是空串）。 */
  readonly era: string
  /** 币种。 */
  readonly currency: Currency
  /** 生效单价。 */
  readonly prices: PriceTriple
  /** 单价是否被用户覆盖价改过。 */
  readonly overridden: boolean
  /** 认不出价（第三方路由且**同步价目与内置快照里都没有它**）。 */
  readonly unpriced: boolean
  /**
   * 单价来自**内置快照**（而不是用户点过一次的「同步第三方价目」）。
   * 界面据此如实标明"这是内置快照价（可能过时）"。
   */
  readonly builtin: boolean
  /** 单价来源。 */
  readonly source: PriceSource
}

/** {@link resolvePrice} 的入参。 */
export interface ResolveOptions {
  readonly currency?: Currency
  /** 计价时刻（决定峰谷档与价格档）；默认现在。 */
  readonly at?: Date | number
  /** 直接指定档位，给了就不看时刻。 */
  readonly peak?: boolean
  /** 直接指定价格档 id（折叠时已按每条用量自己的时间判好档）。 */
  readonly era?: string
  /** 路由的 provider（第三方价目与 `provider:model` 覆盖价都要它）。 */
  readonly provider?: string
  readonly overrides?: PriceOverrideTable | undefined
  /** 同步来的第三方价目（美元/1M）。 */
  readonly providers?: ProviderPriceTable | undefined
  /** 同步来的额外历史档。 */
  readonly eras?: readonly PriceEra[] | undefined
  /** 节假日表（不传用内置那份）。 */
  readonly holidays?: readonly string[] | undefined
}

/** 把 `at` 归一成毫秒。 */
function msOf(at: Date | number | undefined): number {
  if (at instanceof Date) return at.getTime()
  if (typeof at === 'number' && Number.isFinite(at)) return at
  return Date.now()
}

/**
 * 解析某模型在某时刻（或某价格档）的生效单价。
 *
 * 语义**逐字对齐出处实现**（`pricesOf`），两处容易被写错、这里显式记下来：
 *
 *  1. 没有覆盖价时，美元走表里的**美元列**（不是人民币除以汇率 —— 表里那两列是各自官方原值）；
 *  2. **有**覆盖价时，先把人民币档整体重建（未提供的档沿用表里人民币列），
 *     美元再从重建后的人民币折算 —— 也就是覆盖价一定是**人民币口径**。
 *     所以"只覆盖 miss 一项"在美元口径下会顺带把 hit/out 换成 人民币÷6.82，
 *     与表里美元列有千分之一级的差；这是出处实现的行为，移植时保持原样。
 *
 * 优先级：**用户覆盖价 > 官方刊例价（或同步来的第三方价）**。
 *
 * 路由类型决定走哪条路（见 {@link isDeepSeekRoute}）：
 *  · DeepSeek 路由 → 历史档表（峰谷两档、双币种）；
 *  · 第三方路由 → 同步价目（平坦价，只有美元），**认不出就是 `unpriced`**。
 */
export function resolvePrice(model: unknown, options: ResolveOptions = {}): ResolvedPrice {
  const currency: Currency = options.currency === 'USD' ? 'USD' : 'CNY'
  const provider = typeof options.provider === 'string' ? options.provider : ''
  const atMs = msOf(options.at)
  const deepseek = isDeepSeekRoute(provider, model)

  if (!deepseek) {
    // 第三方：平坦价（没有峰谷概念）。查价顺序：**已同步的 models.dev 价目 → 内置快照**；
    // 两边都没有才是"未定价"（单价全 0 + 界面写明怎么补），绝不套 DeepSeek 的价。
    const raw = typeof model === 'string' ? model.trim() : ''
    const synced = providerRateOf(options.providers, provider, raw)
    const snapshot = synced === undefined ? providerRateOf(BUILTIN_PROVIDER_PRICES, provider, raw) : undefined
    const found = synced ?? snapshot
    if (found === undefined) {
      return {
        model: raw, provider, peak: false, era: '', currency,
        prices: ZERO_TRIPLE, overridden: false, unpriced: true, builtin: false, source: 'none',
      }
    }
    const fromSnapshot = synced === undefined
    const usd: PriceTriple = { miss: found.rate.miss, hit: found.rate.hit, out: found.rate.out }
    const cny: PriceTriple = {
      miss: usd.miss * CNY_PER_USD,
      hit: usd.hit * CNY_PER_USD,
      out: usd.out * CNY_PER_USD,
    }
    const override = overrideEntryOf(options.overrides, provider, raw)
    const overrideTier = override?.offPeak ?? override?.peak
    if (overrideTier === undefined) {
      return {
        model: raw, provider, peak: false, era: '', currency,
        prices: currency === 'USD' ? usd : cny, overridden: false, unpriced: false,
        builtin: fromSnapshot, source: 'provider',
      }
    }
    const applied = applyTier(cny, overrideTier)
    const prices = currency === 'USD'
      ? { miss: applied.prices.miss / CNY_PER_USD, hit: applied.prices.hit / CNY_PER_USD, out: applied.prices.out / CNY_PER_USD }
      : applied.prices
    return {
      model: raw, provider, peak: false, era: '', currency,
      prices, overridden: applied.touched, unpriced: false, builtin: fromSnapshot, source: 'override',
    }
  }

  const era = options.era !== undefined ? eraById(options.era, options.eras) : eraAt(atMs, options.eras)
  const normalized = normalizeModel(model)
  const base = era.table[normalized] ?? era.table[DEFAULT_PRICING_MODEL]!
  const peak = options.peak ?? isPeakAt(atMs, { holidays: options.holidays })
  const tier = peak ? base.peak : base.offPeak
  // ⚠️ 传**原样**的模型名：`overrideEntryOf` 内部先试归一化名、再试原样名
  // （0.9.1 的 `table[normalizeModel(model)] ?? table[String(model)]` 语义）。
  // 传 `normalized` 的话，手写在设置里的别名键（`deepseek-chat`）就永远查不到了。
  const override = overrideEntryOf(options.overrides, provider, model)
  const overrideTier = peak ? override?.peak : override?.offPeak
  if (overrideTier === undefined) {
    return {
      model: normalized, provider, peak, era: era.id, currency,
      prices: currency === 'USD' ? tier.usd : tier.cny,
      overridden: false, unpriced: false, builtin: false, source: 'official',
    }
  }
  const applied = applyTier(tier.cny, overrideTier)
  const cny = applied.prices
  const prices = currency === 'USD'
    ? { miss: cny.miss / CNY_PER_USD, hit: cny.hit / CNY_PER_USD, out: cny.out / CNY_PER_USD }
    : cny
  return {
    model: normalized, provider, peak, era: era.id, currency,
    prices, overridden: applied.touched, unpriced: false, builtin: false, source: 'override',
  }
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
 * 缓存写入单独计价、且实测 `cacheWriteTokens` 恒为 0，所以它只参与"计费输入"的**显示**，
 * 不进费用。（"计费输入"那个显示用的函数在 `client/stats-line.ts`，不在这里再造一个同义的。）
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

// ─────────────────────────────────────────────────────────────────────────────
// 格式化
// ─────────────────────────────────────────────────────────────────────────────

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
 * · ≥ 1        → 两位（`¥4.00`）
 * · ≥ 0.01     → 四位去尾零，至少两位（`¥0.04`）
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

/** 「还有多久」的中文短文案（峰谷提醒用）：`2 小时 15 分钟`、`45 分钟`、`不到 1 分钟`。 */
export function formatCountdown(minutes: unknown): string {
  const n = finite(minutes)
  if (n === undefined || n <= 0) return '不到 1 分钟'
  const total = Math.round(n)
  if (total < 60) return `${total} 分钟`
  const hours = Math.floor(total / 60)
  const rest = total % 60
  if (hours >= 24) return `${Math.floor(hours / 24)} 天 ${hours % 24} 小时`
  return rest === 0 ? `${hours} 小时` : `${hours} 小时 ${rest} 分钟`
}

// ─────────────────────────────────────────────────────────────────────────────
// 覆盖价表的读/写（设置页用）
// ─────────────────────────────────────────────────────────────────────────────

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
export function officialTripleOf(
  model: unknown,
  peak: boolean,
  options: Omit<ResolveOptions, 'peak' | 'overrides'> = {},
): PriceTriple {
  return resolvePrice(model, { ...options, peak }).prices
}

/**
 * 覆盖价表里某模型某档的原始项（没写过就是 undefined）。
 *
 * 键的匹配与 `resolvePrice` **同一套**（`provider:model` → `model`），两处若分叉，
 * 会出现"设置页显示已填、实际计价没生效"这种最难查的偏差。
 */
export function overrideTierOf(
  table: PriceOverrideTable | undefined,
  model: unknown,
  peak: boolean,
  provider?: string,
): PriceOverrideTier | undefined {
  const entry = overrideEntryOf(table, provider, model)
  return peak ? entry?.peak : entry?.offPeak
}

/** 某一格当前填了什么：没填是 `undefined`（界面要显示成空框，而不是 `0`）。 */
export function overrideValueOf(
  table: PriceOverrideTable | undefined,
  model: unknown,
  peak: boolean,
  field: PriceField,
  provider?: string,
): number | undefined {
  const tier = overrideTierOf(table, model, peak, provider)
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
 * @param peak 高峰档还是空闲档（**第三方"平坦价"模型用空闲档那一格**）。
 * @param field 三项里的哪一项。
 * @param value 数字则写入；`undefined`/非有限数/负数都当**清空**（界面只会传合法值）。
 * @param provider 给了就写 `provider:model` 这个键（第三方路由用）。
 */
export function withOverrideValue(
  table: PriceOverrideTable | undefined,
  model: unknown,
  peak: boolean,
  field: PriceField,
  value: number | undefined,
  provider?: string,
): PriceOverrideTable | undefined {
  const providerKey = typeof provider === 'string' ? provider.trim().toLowerCase() : ''
  const modelKey = String(model ?? '').trim().toLowerCase()
  if (modelKey.length === 0) return table
  const key = providerKey === '' ? modelKey : `${providerKey}:${modelKey}`
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
  provider?: string,
): PriceOverrideTable | undefined {
  if (table === undefined) return undefined
  const providerKey = typeof provider === 'string' ? provider.trim().toLowerCase() : ''
  const modelKey = String(model ?? '').trim().toLowerCase()
  const key = providerKey === '' ? modelKey : `${providerKey}:${modelKey}`
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
