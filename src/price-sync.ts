/**
 * 价目同步（**宿主半专用**，允许 node API）：官方价格页 → 价格历史档；models.dev → 第三方价目。
 *
 * ## 两条同步路径，两个按钮（不是一次点完）
 *
 * · **官方价**：抓两页（中文页人民币列 + 英文页美元列），合并成一个 {@link PriceEra}。
 *   两页各约 24 KB，秒级完成。
 * · **第三方价目**：models.dev 的 `api.json`（实测 **5.2 MB**、215 个 provider、7831 个模型），
 *   压缩成我们形状后约 **450 KB**。故意做成独立按钮：只想刷官方价的人不该被迫下载 5 MB。
 *
 * ## 三条硬纪律（每条都能把用户的账算错）
 *
 * 1. **同步失败绝不覆盖本地价**。抓不到、页面改版、解析不出来 —— 一律返回失败，
 *    磁盘上的价目与设置原样不动。`test/price-sync.mjs` 用"网络抛错"和"页面被换成垃圾"
 *    两种情形钉住这一条。
 * 2. **新价 = 新档，绝不改旧档**。同步到的数与当前档不同时，**新增**一个从"这次同步时刻"
 *    起生效的档，而不是原地改 `BASE_ERAS`（那是编译进去的常量，改它等于把历史账重算）。
 *    历史档存在设置里（`syncedPrices.eras`，很小），第三方价目存在磁盘上（450 KB，不该进设置）。
 * 3. **models.dev 的 DeepSeek 行一律丢掉**。它那边 DeepSeek 只有"空闲档的平坦美元价"，
 *    没有峰谷、没有历史档语义；留着它迟早会被谁误用成"DeepSeek 单价"，结果是**所有峰价
 *    被静默算成谷价**（差 2 倍）。
 *
 * ## 出处
 *
 * 官方页解析在 `official-pricing.ts`（纯函数，夹具是真实页面快照）。
 * models.dev 的字段名（`cost.input` / `cost.output` / `cost.cache_read`）核对过真实响应；
 * 压缩成 `ProviderPriceTable` 的形状与 `pricing.ts` 的口径一致（美元/1M）。
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { parseOfficialPricingPage, type OfficialPricePage } from './official-pricing.ts'
import type { ModelPrice, PriceEra, PriceTriple, ProviderPriceTable } from './pricing.ts'

/** 官方价格页（中文页给人民币列、英文页给美元列，两页同构）。 */
export const OFFICIAL_PRICING_URLS = {
  cny: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing',
  usd: 'https://api-docs.deepseek.com/quick_start/pricing',
} as const

/** 第三方价目来源（models.dev 的公开注册表，无需 key）。 */
export const MODELS_DEV_URL = 'https://models.dev/api.json'

/** 抓页面的默认超时：官方页小、models.dev 大，分开设。 */
export const PAGE_TIMEOUT_MS = 15_000
export const REGISTRY_TIMEOUT_MS = 60_000

/** 自动同步的默认最小间隔：一天。 */
export const AUTO_SYNC_STALE_MS = 24 * 3_600_000

/**
 * **自动同步该不该跑**（纯函数，宿主半的定时器只调它）。
 *
 * 条件两条：开关**真**开着，且距上次成功同步够久（从没成功过就是 0 → 判定为"该跑"）。
 * 抽成纯函数而不是写在定时器里，是因为"该不该出网"这件事必须能单独钉住 ——
 * 它一旦写错（比如把开关看漏），插件就会**在用户没同意的情况下自己联网**。
 *
 * @param options.enabled 设置里的开关（未知值一律当没开：只有真 `true` 才算开）。
 * @param options.fetchedAt 上次成功同步的时刻（毫秒；未知/非有限数当"从没同步过"）。
 * @param options.nowMs 现在（毫秒）。
 * @param options.staleMs 最小间隔，默认 {@link AUTO_SYNC_STALE_MS}。
 * @returns 该不该现在同步一次。
 */
export function autoSyncDue(options: {
  readonly enabled: unknown
  readonly fetchedAt: unknown
  readonly nowMs: number
  readonly staleMs?: number
}): boolean {
  if (options.enabled !== true) return false
  if (!Number.isFinite(options.nowMs)) return false
  const last = typeof options.fetchedAt === 'number' && Number.isFinite(options.fetchedAt) ? options.fetchedAt : 0
  return options.nowMs - last >= (options.staleMs ?? AUTO_SYNC_STALE_MS)
}

/** 磁盘上的第三方价目文件（`$DSH_HOME/storages/...`）。 */
export const PRICE_STORE_FILE = 'prices.json'

/** 磁盘上的价目。 */
export interface PriceFile {
  /** 最近一次同步第三方价目的时刻（毫秒）。 */
  readonly fetchedAt?: number
  /** provider → model → 单价（美元/1M）。 */
  readonly providers?: ProviderPriceTable
}

/** `$DSH_HOME`；环境变量缺失时回退 `~/.dsh`（与 `quick-store.ts` 同一套）。 */
function dshHome(): string {
  const fromEnv = process.env.DSH_HOME?.trim()
  return fromEnv !== undefined && fromEnv !== '' ? fromEnv : join(homedir(), '.dsh')
}

/** 第三方价目文件路径。 */
export function priceStorePath(): string {
  return join(dshHome(), 'storages', 'composer-ux', PRICE_STORE_FILE)
}

/** 读价目文件；读不到/坏掉都当"没有第三方价目"（**绝不抛给路由**）。 */
export async function readPriceFile(file: string = priceStorePath()): Promise<PriceFile> {
  let raw: string
  try {
    raw = await readFile(file, 'utf8')
  } catch {
    return {}
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    const value = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as Record<string, unknown>
    const fetchedAt = typeof value.fetchedAt === 'number' && Number.isFinite(value.fetchedAt) ? value.fetchedAt : undefined
    const providers = parseProviderPricesLoose(value.providers)
    return {
      ...(fetchedAt === undefined ? {} : { fetchedAt }),
      ...(providers === undefined ? {} : { providers }),
    }
  } catch {
    return {}
  }
}

/**
 * 写价目文件：先写临时文件再 `rename`（原子替换），避免半个文件被下次启动读到。
 * 目录不存在就建（`storages/composer-ux/` 首次运行肯定不存在）。
 */
export async function writePriceFile(data: PriceFile, file: string = priceStorePath()): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`
  await writeFile(temp, JSON.stringify(data), 'utf8')
  await rename(temp, file)
}

/**
 * 把 models.dev 的 `api.json` 压成 {@link ProviderPriceTable}（纯函数）。
 *
 * 规则：
 *  · 只收 `cost.input` 与 `cost.output` 都是有限非负数的模型；
 *  · `hit` 缺 `cost.cache_read` 时**沿用 miss**（"没公布缓存价就按普通输入计" ——
 *    与 `dsh-cost-meter` 的补齐规则一致）；
 *  · **provider id 为 `deepseek` 的整块丢掉**（见文件头纪律 3）。
 *
 * @param payload 解析后的 `api.json`（未消毒的 wire 输入）。
 * @returns 价目表；一条都收不到就是 `undefined`。
 */
export function compactModelsDev(payload: unknown): ProviderPriceTable | undefined {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return undefined
  const out: Record<string, Record<string, PriceTriple>> = {}
  for (const [providerId, provider] of Object.entries(payload as Record<string, unknown>)) {
    const id = providerId.trim().toLowerCase()
    if (id === '' || id === 'deepseek') continue
    if (typeof provider !== 'object' || provider === null || Array.isArray(provider)) continue
    const models = (provider as Record<string, unknown>).models
    if (typeof models !== 'object' || models === null || Array.isArray(models)) continue
    const kept: Record<string, PriceTriple> = {}
    for (const [modelId, model] of Object.entries(models as Record<string, unknown>)) {
      if (typeof model !== 'object' || model === null || Array.isArray(model)) continue
      const cost = (model as Record<string, unknown>).cost
      if (typeof cost !== 'object' || cost === null || Array.isArray(cost)) continue
      const row = cost as Record<string, unknown>
      const miss = rate(row.input)
      const out_ = rate(row.output)
      if (miss === undefined || out_ === undefined) continue
      const hit = rate(row.cache_read)
      const key = modelId.trim().toLowerCase()
      if (key === '') continue
      kept[key] = { miss, hit: hit ?? miss, out: out_ }
    }
    if (Object.keys(kept).length > 0) out[id] = kept
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** 有限非负数才认。 */
function rate(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

/** 宽消毒：只认我们形状的 `{provider: {model: {miss,hit,out}}}`，坏项丢掉。 */
function parseProviderPricesLoose(raw: unknown): ProviderPriceTable | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const out: Record<string, Record<string, PriceTriple>> = {}
  for (const [providerId, models] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof models !== 'object' || models === null || Array.isArray(models)) continue
    const kept: Record<string, PriceTriple> = {}
    for (const [modelId, value] of Object.entries(models as Record<string, unknown>)) {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) continue
      const row = value as Record<string, unknown>
      const miss = rate(row.miss)
      if (miss === undefined) continue
      kept[modelId.trim().toLowerCase()] = { miss, hit: rate(row.hit) ?? miss, out: rate(row.out) ?? 0 }
    }
    if (Object.keys(kept).length > 0) out[providerId.trim().toLowerCase()] = kept
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * 把两页官方解析结果合并成一个价格档（纯函数）。
 *
 * 合并规则：**只有两页都认得的模型才进表**（人民币列与美元列必须配套，缺一边就不猜 ——
 * 少一个模型只是那个模型退回内置价，编一个美元价则会让所有人的账单错）。模型的
 * 旧名/别名不进表（`pricing.ts` 的 `MODEL_ALIASES` 是编译进去的，同步不该动它）。
 *
 * @param cnyPage 中文页解析结果（人民币列）。
 * @param usdPage 英文页解析结果（美元列）；缺了就用不了。
 * @param fromMs 这一档的生效时刻（调用方给"本次同步时刻"）。
 * @param source 出处说明（写进档里，界面会显示）。
 * @returns 价格档；两页没有共同模型就是 `undefined`。
 */
export function eraFromOfficial(
  cnyPage: OfficialPricePage,
  usdPage: OfficialPricePage,
  fromMs: number,
  source: string,
): PriceEra | undefined {
  const table: Record<string, ModelPrice> = {}
  for (const [model, cny] of Object.entries(cnyPage.table)) {
    const usd = usdPage.table[model]
    if (usd === undefined) continue
    table[model.trim().toLowerCase()] = { peak: { cny: cny.peak, usd: usd.peak }, offPeak: { cny: cny.offPeak, usd: usd.offPeak } }
  }
  if (Object.keys(table).length === 0) return undefined
  return {
    id: `sync-${new Date(fromMs).toISOString().replace(/[:.]/g, '-')}`,
    fromMs,
    label: `同步于 ${new Date(fromMs).toLocaleString('zh-CN')}`,
    source,
    table,
  }
}

/** 两份价目表是否逐项相同（决定"要不要建新档"）。 */
export function samePriceTable(
  left: Readonly<Record<string, ModelPrice>>,
  right: Readonly<Record<string, ModelPrice>>,
): boolean {
  const keys = Object.keys(left)
  if (keys.length !== Object.keys(right).length) return false
  for (const key of keys) {
    const a = left[key]
    const b = right[key]
    if (a === undefined || b === undefined) return false
    for (const tier of ['peak', 'offPeak'] as const) {
      for (const currency of ['cny', 'usd'] as const) {
        const x = a[tier][currency]
        const y = b[tier][currency]
        if (x.miss !== y.miss || x.hit !== y.hit || x.out !== y.out) return false
      }
    }
  }
  return true
}

/** 抓一个 URL 的正文（带超时与 AbortController；失败返回 `undefined`，不抛）。 */
export async function fetchText(
  url: string,
  options: { fetcher?: typeof fetch; timeoutMs?: number; minLength?: number } = {},
): Promise<string | undefined> {
  const doFetch = options.fetcher ?? fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? PAGE_TIMEOUT_MS)
  try {
    const response = await doFetch(url, { signal: controller.signal, headers: { accept: 'text/html,application/json' } })
    if (response.ok !== true) return undefined
    const text = await response.text()
    // 页面改版/被 CDN 挡了会返回一小段错误页 —— 太短一律当失败（纪律 1）。
    if (options.minLength !== undefined && text.length < options.minLength) return undefined
    return text
  } catch {
    return undefined
  } finally {
    clearTimeout(timer)
  }
}

/** 抓官方两页并解析（任一页失败就是失败）。 */
export async function fetchOfficialPages(
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {},
): Promise<{ cny: OfficialPricePage; usd: OfficialPricePage } | undefined> {
  const [cnyText, usdText] = await Promise.all([
    fetchText(OFFICIAL_PRICING_URLS.cny, { ...options, minLength: 500 }),
    fetchText(OFFICIAL_PRICING_URLS.usd, { ...options, minLength: 500 }),
  ])
  if (cnyText === undefined || usdText === undefined) return undefined
  const cny = parseOfficialPricingPage(cnyText)
  const usd = parseOfficialPricingPage(usdText)
  if (cny === undefined || usd === undefined) return undefined
  return { cny, usd }
}

/** 抓 models.dev 并压成价目表。 */
export async function fetchModelsDevPrices(
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {},
): Promise<ProviderPriceTable | undefined> {
  const text = await fetchText(MODELS_DEV_URL, { ...options, timeoutMs: options.timeoutMs ?? REGISTRY_TIMEOUT_MS, minLength: 1000 })
  if (text === undefined) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return undefined
  }
  return compactModelsDev(parsed)
}
