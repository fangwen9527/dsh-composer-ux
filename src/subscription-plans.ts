/**
 * 订阅型计费通道（OpenCode Go / Zen 这类"月费 + 额度"的套餐）的账目口径（0.26.0）。
 *
 * ## 为什么需要这一层
 *
 * 0.25.0 及以前，本插件只有一种口径：**按 DeepSeek 官方刊例价 × token**折算。对按量付费的
 * API 路由这是对的；但用户 2026-10-27 的实际通道是 `opencode-go` / `go`（OpenCode Go 套餐：
 * **$10/月 + 分档额度**），这类通道**单次调用不扣钱**，扣的是"额度"。
 *
 * 于是同一个会话会出现两个完全不同的数字，"胶囊"上那个到底代表什么就成了问题。用户选定：
 * **默认显示实付口径（本会话吃掉了多少额度）**，展开再给"按刊例价折算多少钱"。
 *
 * ## 额度是怎么算的（官方口径）
 *
 * OpenCode Go 文档的价目表给出每个模型的**每百万 token 单价**与**月度上限**（例如
 * DeepSeek V4.1 Flash：谷 $0.15 / 命中 $0.003 / 输出 $0.60，峰翻倍，月上限 $80）。
 * 这些单价既用于真实扣费（有余额时），也用于计算"这次调用消耗了多少额度"。
 * 所以：**额度消耗(USD) = Σ token × 该模型该档位单价**，与 token 桶一一对应。
 *
 * 峰谷判定沿用 `pricing.ts` 的那一套（工作日 09:00–12:00 / 14:00–18:00 北京时间高峰）——
 * 与 OpenCode 文档里"01:00–04:00 / 06:00–10:00 UTC"是同一段时间。
 *
 * ## 额度窗口（官方接口）
 *
 * `GET https://opencode.ai/zen/go/v1/usage`（Bearer 该通道的 API key）返回三段窗口：
 * `rolling`（5 小时）、`weekly`（周）、`monthly`（月），每段有 `percent`（**已用**百分比）
 * 与 `resetsAt`。控制台界面上那几个进度条就是它。失败时**不猜**：状态如实回 `unavailable`。
 *
 * 本模块零 import（除类型），可被宿主半直接调用、也可在 node 测试里逐条钉住。
 */

/** 每百万 token 的美元单价（三桶）。 */
export interface PlanRate {
  readonly miss: number
  readonly hit: number
  readonly out: number
}

/** 一个模型在套餐里的计费参数。 */
export interface PlanModel {
  /** 高峰档单价（没有峰谷概念的模型只给 `offPeak`）。 */
  readonly peak?: PlanRate
  /** 非高峰 / 平坦价。 */
  readonly offPeak: PlanRate
  /** 该模型的**月度额度上限**（美元）；官方未公布时缺失。 */
  readonly monthlyLimitUsd?: number
}

/** 一个订阅套餐。 */
export interface SubscriptionPlan {
  /** 套餐 id（也是展示用的稳定键）。 */
  readonly id: string
  /** 人话名称。 */
  readonly displayName: string
  /** 归一化后命中本套餐的 provider 名（小写）。 */
  readonly providers: readonly string[]
  /** 月费（美元）；0 = 官方没有公布。 */
  readonly monthlyFeeUsd: number
  /** 额度接口（相对 origin 的路径）；没有接口就是空串。 */
  readonly quotaPath: string
  /** 额度接口所在的 origin。 */
  readonly quotaOrigin: string
  /** 模型计费键 → 参数。键为**归一化模型名**（见 {@link canonicalModelKey}）。 */
  readonly models: Readonly<Record<string, PlanModel>>
}

/**
 * 归一化模型名：去掉 `deepseek-` 之外的前缀、日期后缀、`-latest` 之类。
 *
 * 为什么要它：日志里的模型 id 会带版本尾巴（`deepseek-v4.1-flash-20260910`、`...-exp`），
 * 而套餐价目表只按"基础型号"给价。归一时**只做保守的裁剪**（连字符分段后缀里的纯数字/日期
 * 与 `exp` / `latest`），不认识的原样返回 —— 宁可查不到（界面标未收录），也不要把 A 模型
 * 的价套到 B 模型上。
 *
 * @param model - 原始模型 id。
 * @returns 归一化后的键（小写）。
 */
export function canonicalModelKey(model: unknown): string {
  if (typeof model !== 'string') return ''
  let key = model.trim().toLowerCase()
  if (key === '') return ''
  // 去掉末尾的 `-vision` / `-exp` / `-latest` / `-preview` 与形如 `-20260910` 的日期段（可叠加）。
  for (let round = 0; round < 4; round += 1) {
    const next = key.replace(/-(?:vision|exp|experimental|latest|preview|beta|alpha)$/, '')
    const dated = next.replace(/-(?:19|20)\d{6}$/, '')
    const versioned = dated.replace(/^(.+)-v(\d+(?:\.\d+)?)$/, (whole, head: string) => (head === '' ? whole : head))
    if (versioned === key) break
    key = versioned
  }
  return key
}

/** 套餐里的模型别名（同一份价，多个 id）。 */
type ModelAliases = Readonly<Record<string, string>>

/** OpenCode Go / Zen 的模型别名：归一键 → 价目表里的键。 */
const OPENCODE_MODEL_ALIASES: ModelAliases = {
  // DeepSeek（官方价目表里 V4.1 Flash 与 V4 Pro 是两档；旧名仍按 Flash 计）
  'deepseek-v4.1-flash': 'deepseek-v4.1-flash',
  'deepseek-v4-flash': 'deepseek-v4.1-flash',
  'deepseek-flash': 'deepseek-v4.1-flash',
  'deepseek-chat': 'deepseek-v4.1-flash',
  'deepseek-reasoner': 'deepseek-v4.1-flash',
  'deepseek-v4-pro': 'deepseek-v4-pro',
  'deepseek-pro': 'deepseek-v4-pro',
  'deepseek-reasoner-pro': 'deepseek-v4-pro',
  // 其它常见 Coding 模型（价目表来自 Go 文档；没有峰谷）
  'glm-5.3-flash': 'glm-5.3-flash',
  'glm-5.3': 'glm-5.3',
  'glm-5.2': 'glm-5.2',
  'kimi-k3': 'kimi-k3',
  'kimi-k2.7-code': 'kimi-k2.7-code',
  'minimax-m3': 'minimax-m3',
  'longcat-2.0': 'longcat-2.0',
  'qwen3.8-flash': 'qwen3.8-flash',
  'qwen3.8-max': 'qwen3.8-max',
  'qwen3.7-plus': 'qwen3.7-plus',
  'mimo-v2.6-flash': 'mimo-v2.6-flash',
  'mimo-v2.6-pro': 'mimo-v2.6-pro',
  'grok-4.7': 'grok-4.7',
  'gpt-6-luna': 'gpt-6-luna',
  'gpt-5.6-luna': 'gpt-5.6-luna',
  'claude-haiku-5.5': 'claude-haiku-5-5',
}

/**
 * OpenCode Go 套餐（$10/月）。
 *
 * 单价逐项抄自官方文档的 Go 价目表（2026-10 抓取）；DeepSeek 两个型号**分峰谷**，
 * 其余是平坦价。月度上限只填官方公布了的那几个（V4.1 Flash $80 / V4 Pro $15 /
 * 其它见文档表格），没公布的不填 —— 界面据此说"额度上限未公布"而不是瞎算百分比。
 */
export const OPENCODE_GO_PLAN: SubscriptionPlan = {
  id: 'opencode-go',
  displayName: 'OpenCode Go',
  providers: ['opencode-go', 'opencode', 'go', 'opencode-zen', 'zen'],
  monthlyFeeUsd: 10,
  quotaPath: '/zen/go/v1/usage',
  quotaOrigin: 'https://opencode.ai',
  models: {
    'deepseek-v4.1-flash': {
      peak: { miss: 0.30, hit: 0.006, out: 1.20 },
      offPeak: { miss: 0.15, hit: 0.003, out: 0.60 },
      monthlyLimitUsd: 80,
    },
    'deepseek-v4-pro': {
      peak: { miss: 1.32, hit: 0.044, out: 3.96 },
      offPeak: { miss: 0.66, hit: 0.022, out: 1.98 },
      monthlyLimitUsd: 15,
    },
    'glm-5.3-flash': { offPeak: { miss: 0.15, hit: 0.03, out: 0.50 }, monthlyLimitUsd: 60 },
    'glm-5.3': { offPeak: { miss: 1.40, hit: 0.26, out: 4.40 }, monthlyLimitUsd: 15 },
    'glm-5.2': { offPeak: { miss: 1.40, hit: 0.26, out: 4.40 }, monthlyLimitUsd: 60 },
    'kimi-k3': { offPeak: { miss: 3.00, hit: 0.30, out: 15.00 }, monthlyLimitUsd: 15 },
    'kimi-k2.7-code': { offPeak: { miss: 0.95, hit: 0.19, out: 4.00 }, monthlyLimitUsd: 60 },
    'minimax-m3': { offPeak: { miss: 0.30, hit: 0.06, out: 1.20 }, monthlyLimitUsd: 60 },
    'longcat-2.0': { offPeak: { miss: 0.30, hit: 0.006, out: 1.20 }, monthlyLimitUsd: 60 },
    'qwen3.8-flash': { offPeak: { miss: 0.15, hit: 0.016, out: 0.47 }, monthlyLimitUsd: 30 },
    'qwen3.8-max': { offPeak: { miss: 2.00, hit: 0.25, out: 6.00 }, monthlyLimitUsd: 15 },
    'qwen3.7-plus': { offPeak: { miss: 0.40, hit: 0.04, out: 1.60 }, monthlyLimitUsd: 60 },
    'mimo-v2.6-flash': { offPeak: { miss: 0.14, hit: 0.0028, out: 0.28 }, monthlyLimitUsd: 60 },
    'mimo-v2.6-pro': { offPeak: { miss: 0.435, hit: 0.003625, out: 0.87 }, monthlyLimitUsd: 15 },
    'grok-4.7': { offPeak: { miss: 2.00, hit: 0.50, out: 6.00 }, monthlyLimitUsd: 15 },
    'gpt-6-luna': { offPeak: { miss: 0.10, hit: 0.01, out: 0.50 }, monthlyLimitUsd: 15 },
    'gpt-5.6-luna': { offPeak: { miss: 0.20, hit: 0.02, out: 1.20 }, monthlyLimitUsd: 15 },
    'claude-haiku-5-5': { offPeak: { miss: 0.10, hit: 0.01, out: 0.50 }, monthlyLimitUsd: 15 },
  },
}

/** 全部内置套餐（后续要加 Kimi / 智谱的 coding plan，往这里塞）。 */
export const SUBSCRIPTION_PLANS: readonly SubscriptionPlan[] = [OPENCODE_GO_PLAN]

/** 归一化 provider 名（小写、去空白）。 */
export function canonicalProvider(provider: unknown): string {
  return typeof provider === 'string' ? provider.trim().toLowerCase() : ''
}

/**
 * 这个 provider 走的是哪个订阅套餐。
 * @param provider - 路由里的 provider 名（大小写不敏感）。
 * @returns 命中的套餐；不是订阅通道时 `undefined`（按量付费）。
 */
export function planOf(provider: unknown): SubscriptionPlan | undefined {
  const key = canonicalProvider(provider)
  if (key === '') return undefined
  return SUBSCRIPTION_PLANS.find(plan => plan.providers.includes(key))
}

/** 额度窗口 id（与控制台三段进度条一一对应）。 */
export type QuotaWindowId = 'rolling' | 'weekly' | 'monthly'

/** 一段额度窗口。 */
export interface QuotaWindow {
  readonly id: QuotaWindowId
  /** **已用**百分比（0–100）；接口给的是已用值，界面不要反着读。 */
  readonly percent: number
  /** 重置时刻（ISO 字符串）；接口没给就是空串。 */
  readonly resetsAt: string
}

/** 一个通道的额度快照。 */
export interface PlanQuotaSnapshot {
  readonly provider: string
  readonly displayName: string
  /**
   * `ok` = 拿到了；`pending` = 第一次取、结果还没回来（界面显示"正在取额度…"而不是空）；
   * `not-configured` = 没 key；`unavailable` = 请求失败；`invalid` = 形状不对。
   *
   * 为什么有 `pending`：额度接口要不要 await 到路由响应里，是个 UX 取舍。胶囊每 600ms 就可能
   * 问一次，如果第一次请求卡在网络上，整个金额显示就会跟着卡 8 秒。所以宿主半**不阻塞**：
   * 先回缓存（没有就回 pending），后台再刷新 —— 下一次轮询就有数了。
   */
  readonly status: 'ok' | 'pending' | 'not-configured' | 'unavailable' | 'invalid'
  readonly windows: readonly QuotaWindow[]
  /** 取到时刻（毫秒）；失败时是上次成功的时刻（没有就是 0）。 */
  readonly fetchedAt: number
  /** 失败原因（给人看的一句话，可能为空）。 */
  readonly reason: string
}

/** 一次 token 用量在套餐里的额度消耗。 */
export interface QuotaCost {
  /** 归一键（套餐价目表里的 key）。 */
  readonly modelKey: string
  /** 消耗的额度（美元）。 */
  readonly usd: number
  /** 该模型的月度额度上限（美元）；官方没公布就是 undefined。 */
  readonly monthlyLimitUsd?: number
  /** 占该模型月度额度的百分比（0–100）；没上限就是 undefined。 */
  readonly percentOfLimit?: number
}

/**
 * 一次用量折算成"额度消耗"。
 *
 * @param provider - 路由 provider（大小写不敏感）。
 * @param model - 模型 id（会先归一到套餐价目表的键）。
 * @param peak - 是否按高峰价（DeepSeek 系分峰谷；其它模型忽略）。
 * @param tokens - 三桶 token（未缓存输入 / 缓存命中 / 输出）。
 * @returns 额度消耗；不是订阅通道、或该模型不在价目表里时 `undefined`（界面标"未收录"）。
 */
export function quotaCostOf(
  provider: unknown,
  model: unknown,
  peak: boolean,
  tokens: { readonly miss: number; readonly hit: number; readonly out: number },
): QuotaCost | undefined {
  const plan = planOf(provider)
  if (plan === undefined) return undefined
  const key = canonicalModelKey(model)
  const alias = OPENCODE_MODEL_ALIASES[key]
  const priced = alias === undefined ? plan.models[key] : plan.models[alias]
  if (priced === undefined) return undefined
  const rate = peak && priced.peak !== undefined ? priced.peak : priced.offPeak
  const usd = tokens.miss / 1e6 * rate.miss + tokens.hit / 1e6 * rate.hit + tokens.out / 1e6 * rate.out
  const limit = priced.monthlyLimitUsd
  return {
    modelKey: alias ?? key,
    usd,
    ...(limit === undefined ? {} : { monthlyLimitUsd: limit }),
    ...(limit === undefined || limit <= 0 ? {} : { percentOfLimit: usd / limit * 100 }),
  }
}

/**
 * 解析额度接口的响应。
 *
 * 形状（2026-10 实测）：`{ usage: { rolling: { status, percent, resetsAt }, weekly: {...}, monthly: {...} } }`。
 * 缺段就少一段 —— 不补 0（补 0 会让人以为"一点没用"）。百分比钳到 0–100。
 *
 * @param body - 接口 JSON。
 * @returns 窗口数组（可能为空）。
 */
export function parseQuotaPayload(body: unknown): QuotaWindow[] {
  const root = body === null || typeof body !== 'object' ? undefined : body as { usage?: unknown }
  const usage = (root?.usage ?? body) as Record<string, unknown> | null | undefined
  if (usage === null || typeof usage !== 'object') return []
  const windows: QuotaWindow[] = []
  for (const id of ['rolling', 'weekly', 'monthly'] as const) {
    const entry = usage[id] as { percent?: unknown; resetsAt?: unknown } | undefined
    if (entry === null || typeof entry !== 'object') continue
    const percent = typeof entry.percent === 'number' && Number.isFinite(entry.percent)
      ? Math.min(100, Math.max(0, entry.percent))
      : undefined
    if (percent === undefined) continue
    windows.push({
      id,
      percent,
      resetsAt: typeof entry.resetsAt === 'string' ? entry.resetsAt : '',
    })
  }
  return windows
}

/** 额度窗口的中文标签（两端共用一处，别各写一份）。 */
export const QUOTA_WINDOW_LABEL: Readonly<Record<QuotaWindowId, string>> = {
  rolling: '5 小时',
  weekly: '本周',
  monthly: '本月',
}

/**
 * 取额度失败时的降级快照：**保留上一次拿到的窗口**。
 *
 * 为什么值得单独一个函数：接口偶发 5xx 时，如果直接回一份空窗口，界面会从「本周 3%」
 * 忽然变成一片空白 —— 用户会以为额度被清零了。所以失败只改 `status` / `reason`，
 * 窗口沿用上一份，`fetchedAt` 也留着（界面据此说"这是 x 分钟前的数据"）。
 *
 * @param plan - 套餐（只用到 id 与名称）。
 * @param previous - 上一次成功的快照（没有就是 undefined）。
 * @param status - 失败类型。
 * @param reason - 给人看的一句话。
 * @returns 降级快照（**永不抛**）。
 */
export function degradeQuota(
  plan: { readonly id: string; readonly displayName: string },
  previous: PlanQuotaSnapshot | undefined,
  status: 'not-configured' | 'unavailable' | 'invalid',
  reason: string,
): PlanQuotaSnapshot {
  return {
    provider: plan.id,
    displayName: plan.displayName,
    status,
    windows: previous?.windows ?? [],
    fetchedAt: previous?.fetchedAt ?? 0,
    reason,
  }
}

/** 把美元金额写成给人看的形式（额度都很小，固定 4 位小数以内）。 */
export function formatUsd(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return '$0.00'
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  if (usd < 1) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(2)}`
}
