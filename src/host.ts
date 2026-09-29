/**
 * Host half。两件事：
 *
 *  1. 当 settings 服务存在时，为浏览器侧注册「composer-ux」设置区（schema）；
 *  2. 把设置页的「OpenCode 请求头」镜像进 llm-pi-ai 的 provider profile。
 *     引擎/菜单行为仍全部由 client 半实现。
 *
 * 为什么请求头必须落在宿主半：出网请求由宿主的模型适配器发出，浏览器侧碰不到。
 * 而 DSH 里唯一受支持的请求头入口就是 llm-pi-ai 的 `providers.<route>.headers`
 * —— 它作为 pi-ai 的 optionsHeaders 在最后合并（能覆盖默认头），且该适配器每次
 * 请求都重读配置，所以「改完下一次请求即生效、不用重启」。
 *
 * 写入方式用 `settings.mutate` 的路径寻址：只动我们自己那一个键，
 * 既不重述也不删除用户写在同一个 profile 里的其它字段。
 */
import type { Context } from '@deepseek-ai/cordis'
import z, { type Schema } from '@deepseek-ai/schemastery'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import inspector from 'node:inspector'
import {
  DEFAULT_HEADER_NAME, DEFAULT_QUICK_PROMPTS, DEFAULT_SETTINGS, ENABLED_FIELD,
  KEYS_ENABLED_FIELD, MENU_ENABLED_FIELD, PANEL_ENABLED_FIELD, QUICK_ENABLED_FIELD,
  TERMINAL_ENABLED_FIELD,
  HEADER_APPLIED_NAME_FIELD,
  HEADER_APPLIED_VALUE_FIELD, HEADER_ENABLED_FIELD, HEADER_NAME_FIELD, HEADER_NAME_MAX,
  HEADER_ROUTES_FIELD, HEADER_STATUS_FIELD, HEADER_VALUE_FIELD, HEADER_VALUE_MAX,
  LLM_NAMESPACE, MENU_FIELDS, MENU_MODE_FIELD, MENU_NATIVE_FIELD, NAMESPACE, NEWLINE_KEY_FIELD,
  OPENCODE_HOSTS, OPENCODE_ROUTE_PREFIX, OPTIMIZE_OUTPUT_MAX, OPTIMIZE_TEXT_MAX,
  OPTIMIZE_KEEP_DOCK_FIELD, OPTIMIZE_READ_TOOLS_FIELD, OPTIMIZE_STATE_API_PATH,
  OPTIMIZER_API_PATH, OPTIMIZER_CONTEXT_FIELD, OPTIMIZER_LEDGER_FIELD, OPTIMIZER_PROMPT_FIELDS, OPTIMIZER_TIER_FIELD, PANEL_HEIGHT_FIELD, PANEL_RESIZE_FIELD,
  PANEL_WIDTH_FIELD, PRICE_OVERRIDES_FIELD, QUICK_PROMPTS_API_PATH, QUICK_PROMPTS_FIELD,
  RESTART_API_PATH,
  SEND_KEY_FIELD, defaultQuickBook, newSessionId, optimizerPromptFieldOf, parseRouteList, sanitizeBook, DEFAULT_OPTIMIZER_TIER,
  splitSlashCommand,
  STATS_ENABLED_FIELD,
  USAGE_API_PATH,
  SYNC_API_PATH,
  BALANCE_ENABLED_FIELD, DEFAULT_PEAK_ALERT, HOLIDAY_SOURCE_LABEL, PEAK_ALERT_FIELD, PEAK_HOLIDAYS_FIELD,
  PRICE_AUTO_SYNC_FIELD, SYNCED_PRICES_FIELD, parseHolidayYears,
  type QuickPromptBook,
} from './settings-contract.ts'
import {
  DEFAULT_PEAK_HOLIDAYS, costBucketsOf, costPartsOf, effectiveHolidays, eraAt, eraIdAt, isDeepSeekRoute, isPeakAt,
  parsePriceEras, parsePriceOverrides, resolvePrice,
  type PriceEra, type PriceOverrideTable, type ProviderPriceTable,
} from './pricing.ts'
import {
  AUTO_SYNC_STALE_MS, autoSyncDue, eraFromOfficial, fetchModelsDevPrices, fetchOfficialPages,
  readPriceFile, samePriceTable, writePriceFile,
} from './price-sync.ts'
import { fetchHolidayYears, holidaySyncDue, holidayYearsWanted, mergeHolidayDays } from './holiday-sync.ts'
import {
  BALANCE_API_PATH, DEEPSEEK_BALANCE_URL, balanceEndpointAllowed, parseBalancePayload,
} from './balance.ts'
import { createUsageCache, type UsageTier } from './usage-fold.ts'
import {
  TERMINAL_BASH_PATH_FIELD, TERMINAL_CANDIDATES_FIELD, TERMINAL_EFFECTIVE_FIELD,
  TERMINAL_MODE_FIELD, TERMINAL_STATUS_FIELD,
} from './terminal/contracts.ts'
import { installTerminalPolicy } from './terminal/host.ts'
import type { BashToolDeps } from './terminal/tool.ts'
import {
  RESTART_LOG_PREFIX, bootId, detectedDebugger, detectedSupervisor, gracefulStop, planRestart,
  scheduleRestart, servingPort, trustedRestartRequest,
} from './restart.ts'
import type { RestartIo } from './restart.ts'
import { buildOptimizeSystem, buildOptimizeTemperature, buildOptimizeUser, optimizePromptSource } from './optimizer-prompt.ts'
import { runOptimizePipeline, scanOptimizeStream } from './optimizer-assemble.ts'
import { appendLedger, buildLedgerRun } from './optimize-ledger.ts'
import { clearDockState, dockStateBytes, optimizeStatePath, readDockState, writeDockState } from './optimize-state.ts'
import { runOptimizeToolLoop } from './optimize-tool-loop.ts'
import { READ_TOOLS_SYSTEM_NOTE } from './optimize-tools.ts'
import { contextBlock, contextWithinBudget, recentTurns } from './prompt-context.ts'
import { ensureQuickBook, quickStorePath, readQuickBook, writeQuickBook } from './quick-store.ts'
import { profileDirOfPatchPath, recoverStaleSettingsLock } from './settings-lock.ts'

export const name = 'composer-ux'

/** 设置面板可调尺寸的上下限（与 client 侧的 clamp 保持一致）。 */
const PANEL_MIN = 560
const PANEL_MAX = 4000

/**
 * DeepSeek 官方 provider 的设置命名空间（`packages/llm/llm-deepseek/src/index.ts` 的 `NS`）。
 *
 * 余额查询要从这一行读 `apiKeyEnv`（凭据引用，默认 `DEEPSEEK_API_KEY`）与 `baseURL`
 * （白名单检查用）—— 与官方适配器取 Key 的那条路完全一致，不另造一份配置。
 */
const LLM_DEEPSEEK_NAMESPACE = 'llm-deepseek'

/** 路径寻址写入：与 settings 服务的 SettingsPathOp 结构一致。 */
type PathOp =
  | { op: 'set'; path: readonly string[]; value: unknown }
  | { op: 'unset'; path: readonly string[] }

/**
 * 本插件用到的 settings 能力（保持结构最小，避免依赖具体实现类）。
 *
 * ⚠️ 两代 DSH 的服务形状不同（2026-09 实测）：
 *   · 0.1.6 及以前：有 `get(ns)` 读解析后的值、有 `register(ns, schema)` 注册命名空间。
 *   · 0.1.7 起：`get` 与 `register` 都被删除；命名空间由导出的 Config 推导，
 *     别人的行只能从 `describe()` 的快照里读。
 * 所以三个成员都声明成可选，按能力用 —— 见 {@link makeReader} 与 {@link ownSchema}。
 */
interface SettingsLike {
  get?(ns: string): unknown
  register?(ns: string, schema: unknown): unknown
  describe?(options?: { redactSecrets?: boolean }): readonly { ns?: string; value?: unknown }[]
  mutate(ns: string, ops: readonly PathOp[]): Promise<void>
}

/** 读一个命名空间的普通值。 */
type ReadRow = (ns: string) => Record<string, unknown> | undefined

/** 把 volatile 引用解引用成普通值（0.1.6 的普通值原样返回）。 */
function plainConfig(value: unknown): unknown {
  if (typeof value === 'object' && value !== null
    && typeof (value as { get?: unknown }).get === 'function') {
    return plainConfig((value as { get: () => unknown }).get())
  }
  if (Array.isArray(value)) return value.map(plainConfig)
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, plainConfig(child)]))
  }
  return value
}

/**
 * 造一个「按命名空间读值」的读口，把两代 settings 服务的读取差异收在这一处。
 *
 * - 0.1.6 及以前：服务有 `get(ns)`，直接取解析后的值。
 * - 0.1.7 起：`get` 没了。**自己的行**由导出的 {@link Config} 给出 —— 字段是
 *   volatile 引用，得先解引用（{@link plainConfig}）；**别人的行**（本插件只读
 *   llm-pi-ai 的 providers.headers）只能从 `describe()` 的快照里找。
 *
 * @param settings 设置服务（可能缺席）。
 * @param config 本行的 Config：0.1.7 是 volatile 引用树，0.1.6 是解析后的普通值。
 */
function makeReader(settings: SettingsLike | undefined, config: unknown): ReadRow {
  return (ns: string) => {
    try {
      if (typeof settings?.get === 'function') return objectOf(settings.get(ns))
      if (ns === NAMESPACE) {
        const own = objectOf(plainConfig(config))
        // Config 读不出东西时继续走 describe，而不是当成"这一行没有值"——
        // 这条路径在 Config 缺席（组合没给 config）时是真会走到的。
        if (own !== undefined) return own
      }
      const row = (settings?.describe?.() ?? []).find(candidate => candidate?.ns === ns)
      return objectOf(row?.value)
    } catch {
      // 读不到就当作"没有"：调用方全都按"缺席 ⇒ 不写"处理（幂等、不会误删用户配置）。
      return undefined
    }
  }
}

/** 收窄成普通对象（数组与 null 都不算）。 */
function objectOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

/** 只接受字符串，其余一律视为空串。 */
function textOf(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * 读本插件自己那一行里的一个字符串字段（读不到一律返回空串）。
 *
 * ⚠️ 为什么不用 `ctx.settings` 那种裸属性读：不在 `inject` 列表里的服务，
 * 裸属性读会在 cordis 的 Proxy 上抛（本插件踩过一次，见 client.tsx 的 peekService）；
 * 而 `get(name)` 不抛。提示词优化路由只 inject 了 webServer / llm ——
 * 自定义提示词属于"锦上添花"，不该让整条路由因为 settings 缺席而干脆不注册，
 * 所以这里走 `get` + try/catch：读不到就退回内置提示词。
 *
 * @param scope - 任意带 `get` 的上下文（宿主 ctx 或注入后的子 ctx）。
 * @param config - 本行的 Config（0.1.7 是 volatile 引用树，解引用后即当前值）。
 * @param field - 字段名。
 * @returns 字段值；任何异常都归一成空串。
 */
function readOwnSetting(scope: unknown, config: unknown, field: string): string {
  try {
    const get = (scope as { get?: (name: string) => unknown } | undefined)?.get
    if (typeof get !== 'function') return ''
    const service = get.call(scope, 'settings') as SettingsLike | undefined
    return textOf(makeReader(service, config)(NAMESPACE)?.[field])
  } catch {
    return ''
  }
}

/**
 * 读一个**布尔**设置。
 *
 * 为什么不能用 {@link readOwnSetting}：那个函数走 `textOf`，而 `textOf(false) === ''`
 * —— 于是"关掉开关"会被读成"没设置"（0.12.0 的上下文开关就是这么踩的，
 * 是 5d 那组用例逮住的）。认不出类型就回退到给定的默认值。
 */
/**
 * 从会话快照里取本会话的工作目录（只读工具围栏的根）。
 *
 * 取不到就返回空串 —— 那意味着**一个工具都不派**：没有根就没法判断"在不在工作目录内"，
 * 与其猜一个路径（可能读到别处的东西），不如让这一轮退化成纯文本优化。
 */
function sessionCwdOf(snapshot: unknown): string {
  const header = objectOf(objectOf(snapshot)?.header)
  return textOf(header?.cwd)
}

function readOwnFlag(scope: unknown, config: unknown, field: string, fallback: boolean): boolean {
  try {
    const get = (scope as { get?: (name: string) => unknown } | undefined)?.get
    if (typeof get !== 'function') return fallback
    const service = get.call(scope, 'settings') as SettingsLike | undefined
    const value = makeReader(service, config)(NAMESPACE)?.[field]
    return typeof value === 'boolean' ? value : fallback
  } catch {
    return fallback
  }
}

/** 取头值的第一个（Node 对重复头会给出数组）。 */
function firstHeaderValue(value: string | readonly string[] | undefined): string | undefined {
  if (value === undefined) return undefined
  return typeof value === 'string' ? value : value[0]
}

/**
 * 书本里有没有"非内置"的内容 —— 「快捷指令」栏迁移的判据（见 apply 里那段说明）。
 * @param book 读到的书本。
 * @returns 与内置默认本不同则为 true。
 */
function bookLooksCustom(book: QuickPromptBook): boolean {
  return JSON.stringify(sanitizeBook(book)) !== JSON.stringify(defaultQuickBook())
}

/** 头名是否合法：与 llm-pi-ai 的 assertValidHeaders 同规则（Fetch 接受才算）。 */
function nameIsValid(name: string): boolean {
  if (name === '' || name.length > HEADER_NAME_MAX) return false
  try {
    new Headers([[name, 'probe']])
    return true
  } catch {
    return false
  }
}

/** 头值是否合法：非空、不超长、单行且可表示为字节（Fetch 接受才算）。 */
function valueIsValid(value: string): boolean {
  if (value === '' || value.length > HEADER_VALUE_MAX) return false
  try {
    new Headers([['x-dsh-probe', value]])
    return true
  } catch {
    return false
  }
}

/**
 * provider 的 baseURL 是否指向 OpenCode（含子域）。
 * 用户自建路由的名字可以是任意字符串（例如 `go`），端点却仍是 OpenCode，
 * 所以「按 URL 认」比「按名字认」可靠；URL 解析失败时退回子串判断。
 */
function isOpencodeBaseUrl(value: unknown): boolean {
  const raw = textOf(value).trim()
  if (raw === '') return false
  let host = ''
  try {
    host = new URL(raw).hostname.toLowerCase()
  } catch {
    return raw.toLowerCase().includes('opencode.ai')
  }
  return OPENCODE_HOSTS.some(name => host === name || host.endsWith(`.${name}`))
}

/**
 * 本次要写的目标路由。
 * 显式名单只保留 llm-pi-ai 里**已存在**的路由——profile 的 `models` 是必填项，
 * 凭空造一个只有 headers 的 profile 会让整份配置校验失败。
 * 留空时的自动匹配：路由名以 `opencode` 开头（内置 `opencode-go` 走这条，它的
 * baseURL 由 pi-ai 目录内置、配置里没有），**或**该路由的 `baseURL` 指向 opencode.ai
 * （自建路由常起别名，按 URL 认更准）。
 * @param providers - llm-pi-ai 当前的 providers 字典。
 * @param listed - 设置里的「作用路由」名单（留空表示自动匹配）。
 * @returns 目标路由名，顺序跟随 providers 的键顺序。
 */
function pickRoutes(
  providers: Record<string, unknown>,
  listed: readonly string[],
): readonly string[] {
  const keys = Object.keys(providers)
  if (listed.length === 0) {
    return keys.filter(key => key.startsWith(OPENCODE_ROUTE_PREFIX)
      || isOpencodeBaseUrl(objectOf(providers[key])?.baseURL))
  }
  return listed.filter(key => Object.prototype.hasOwnProperty.call(providers, key))
}

/** 错误转一行可读文本（写进 headerStatus，供设置页展示）。 */
function errorText(error: unknown): string {
  if (error instanceof Error && error.message !== '') return error.message
  return String(error)
}

/**
 * 把「请求头」栏目对齐到 llm-pi-ai 配置。幂等：算出的目标与现状一致时不写任何东西，
 * 因此本函数既可在插件启动时跑一次，也可在每次 settings 变更后被反复调用。
 * @param settings - settings 服务（用于写入）。
 * @param read - 按命名空间读值的读口（两代服务差异在 {@link makeReader} 里收口）。
 */
async function mirrorHeader(settings: SettingsLike, read: ReadRow): Promise<void> {
  const own = read(NAMESPACE)
  if (own === undefined) return

  const enabled = own[ENABLED_FIELD] === true && own[HEADER_ENABLED_FIELD] === true
  const name = textOf(own[HEADER_NAME_FIELD])
  const nameOk = nameIsValid(name)
  const routesText = parseRouteList(textOf(own[HEADER_ROUTES_FIELD]))

  // 首次启用且值为空：生成一个稳定 ID 并落盘，此后每次都用同一个。
  let value = textOf(own[HEADER_VALUE_FIELD])
  if (enabled && nameOk && value === '') {
    value = newSessionId()
    await settings.mutate(NAMESPACE, [{ op: 'set', path: [HEADER_VALUE_FIELD], value }])
  }

  const llm = read(LLM_NAMESPACE)
  const providers = llm === undefined ? undefined : objectOf(llm.providers)

  const writes: PathOp[] = []
  const applied: string[] = []
  let status = ''

  if (!enabled) {
    status = ''
  } else if (providers === undefined) {
    status = '未挂载 llm-pi-ai（模型路由）设置，暂未写入'
  } else if (!nameOk) {
    status = '头名不合法，未写入'
  } else if (!valueIsValid(value)) {
    status = `头值不合法（需 1–${HEADER_VALUE_MAX} 字符且单行），未写入`
  } else {
    for (const route of pickRoutes(providers, routesText)) {
      const headers = objectOf(objectOf(providers[route])?.headers)
      if (headers?.[name] !== value) {
        writes.push({ op: 'set', path: ['providers', route, 'headers', name], value })
      }
      applied.push(route)
    }
    status = applied.length === 0
      ? `已启用，但没有可写入的路由（目标：${routesText.length === 0 ? `自动（名字以 ${OPENCODE_ROUTE_PREFIX} 开头，或 baseURL 指向 opencode.ai）` : routesText.join('、')}）`
      : `已写入 ${applied.join('、')}`
  }

  // 撤销：上次写入过、这次不再是目标的位置（停用、改名、值被换、路由被移除）。
  // 只删「确实是我们写的」：值必须等于当前配置值或记账值，否则视为用户自己写的，不碰。
  const stale: PathOp[] = []
  if (providers !== undefined) {
    const previousName = textOf(own[HEADER_APPLIED_NAME_FIELD])
    const previousValue = textOf(own[HEADER_APPLIED_VALUE_FIELD])
    const ours = new Set([textOf(own[HEADER_VALUE_FIELD]), previousValue])
    ours.delete('')
    // 本轮的目标键（哪怕值已经对、不需要写）——它们绝不能被当成过期项撤销。
    const targets = new Set(applied.map(route => `${route}\u0000${name}`))
    const candidates = new Set([previousName, nameOk ? name : ''])
    candidates.delete('')
    for (const candidate of candidates) {
      for (const [route, profile] of Object.entries(providers)) {
        if (targets.has(`${route}\u0000${candidate}`)) continue
        const headers = objectOf(objectOf(profile)?.headers)
        const current = headers?.[candidate]
        if (typeof current !== 'string' || !ours.has(current)) continue
        stale.push({ op: 'unset', path: ['providers', route, 'headers', candidate] })
      }
    }
  }

  const providerOps = [...writes, ...stale]
  let failed = false
  if (providerOps.length > 0) {
    try {
      await settings.mutate(LLM_NAMESPACE, providerOps)
    } catch (error: unknown) {
      failed = true
      status = `写入失败：${errorText(error)}`
    }
  }

  // 记账 + 状态回写：只有真正写成功才记账，且值不变时不写（保证幂等、不产生回环）。
  const nextAppliedName = !failed && applied.length > 0 ? name : ''
  const nextAppliedValue = !failed && applied.length > 0 ? value : ''
  const ownOps: PathOp[] = []
  if (textOf(own[HEADER_APPLIED_NAME_FIELD]) !== nextAppliedName) {
    ownOps.push({ op: 'set', path: [HEADER_APPLIED_NAME_FIELD], value: nextAppliedName })
  }
  if (textOf(own[HEADER_APPLIED_VALUE_FIELD]) !== nextAppliedValue) {
    ownOps.push({ op: 'set', path: [HEADER_APPLIED_VALUE_FIELD], value: nextAppliedValue })
  }
  if (textOf(own[HEADER_STATUS_FIELD]) !== status) {
    ownOps.push({ op: 'set', path: [HEADER_STATUS_FIELD], value: status })
  }
  if (ownOps.length > 0) await settings.mutate(NAMESPACE, ownOps)
}

/**
 * 本插件的字段表 —— 设置页可编辑的字段全在这里。
 *
 * 抽成函数是为了让模块级常量 {@link Config} 与旧版的显式注册共用一份真相
 * （0.1.6 及以前必须 `settings.register(NAMESPACE, schema)`）。
 */
function ownSchema(): Schema {
  return z.object({
    [ENABLED_FIELD]: z.boolean().default(DEFAULT_SETTINGS.enabled),
    // 五栏开关。**故意不给默认值、声明成可选**：迁移要用的信息就是"文档里有没有这个键"
    // —— 没有 ⇒ 从没碰过这一栏 ⇒ 关闭；有 ⇒ 用户碰过 ⇒ 保持他写下的值。
    // 给了静态默认值就再也分不出这两种情况了（净化的 sectionEnabledOf 靠它）。
    [KEYS_ENABLED_FIELD]: z.boolean().required(false),
    [MENU_ENABLED_FIELD]: z.boolean().required(false),
    [QUICK_ENABLED_FIELD]: z.boolean().required(false),
    [PANEL_ENABLED_FIELD]: z.boolean().required(false),
    [TERMINAL_ENABLED_FIELD]: z.boolean().required(false),
    [SEND_KEY_FIELD]: z.string().default(DEFAULT_SETTINGS.sendKey),
    [NEWLINE_KEY_FIELD]: z.string().default(DEFAULT_SETTINGS.newlineKey),
    ...Object.fromEntries(MENU_FIELDS.map(field => [
      field,
      z.boolean().default(DEFAULT_SETTINGS[field]),
    ])),
    // 右键菜单模式（0.5.0 起三档）。**故意不给默认值、且声明成可选**：
    // 「文档里没有这个键」本身就是迁移要用的信息——净化据此按旧布尔 menuNative
    // 推断（见 menuModeFrom）。给了默认值就再也分不出「从没设置过」与「明确设成了它」。
    [MENU_MODE_FIELD]: z.string().required(false),
    // 旧的布尔字段：只作迁移线索，故同样不给默认值——旧文档里的 true / false
    // 都要保住原意（true = 浏览器菜单、false = 明确选过自定义菜单）。
    [MENU_NATIVE_FIELD]: z.boolean().required(false),
    // 「导航滚动」在 0.6.0 随功能一起删掉了（DSH 0.1.7 的官方设置页自带导航列滚动）。
    // 旧文档里可能仍留着 panelScroll：schemastery 对未声明键是**原样放行**（已实测），
    // 所以不需要为它保留一个宽容字段，升级时也不会因此判非法。
    [PANEL_RESIZE_FIELD]: z.boolean().default(DEFAULT_SETTINGS.panelResize),
    // schemastery 无 .optional()：可选键用 .required(false)。
    [PANEL_WIDTH_FIELD]: z.number().min(PANEL_MIN).max(PANEL_MAX).required(false),
    [PANEL_HEIGHT_FIELD]: z.number().min(320).max(PANEL_MAX).required(false),
    // OpenCode 请求头栏目（值由宿主半按 llm-pi-ai 的 Fetch 规则自校验后再写入）。
    [HEADER_ENABLED_FIELD]: z.boolean().default(DEFAULT_SETTINGS.headerEnabled),
    [HEADER_NAME_FIELD]: z.string().default(DEFAULT_HEADER_NAME),
    [HEADER_VALUE_FIELD]: z.string().default(DEFAULT_SETTINGS.headerValue),
    [HEADER_ROUTES_FIELD]: z.string().default(DEFAULT_SETTINGS.headerRoutes),
    [HEADER_APPLIED_NAME_FIELD]: z.string().default(DEFAULT_SETTINGS.headerAppliedName),
    [HEADER_APPLIED_VALUE_FIELD]: z.string().default(DEFAULT_SETTINGS.headerAppliedValue),
    [HEADER_STATUS_FIELD]: z.string().default(DEFAULT_SETTINGS.headerStatus),
    // 快捷指令列表：结构固定为 {id,label,prompt,always}，逐条自带默认值，
    // 让旧设置文档（没有这个键）在读取时直接得到内置 9 条。
    [QUICK_PROMPTS_FIELD]: z.array(z.object({
      id: z.string().default(''),
      label: z.string().default(''),
      prompt: z.string().default(''),
      always: z.boolean().default(false),
    })).default(DEFAULT_QUICK_PROMPTS.map(item => ({ ...item }))),
    [OPTIMIZER_TIER_FIELD]: z.string().default(DEFAULT_SETTINGS.optimizerTier),
    // 优化时是否携带当前会话的近期往来（0.12.0；默认开，见契约里的说明）。
    [OPTIMIZER_CONTEXT_FIELD]: z.boolean().default(DEFAULT_SETTINGS.optimizerContext),
    // 逐轮台账（0.13.0；默认开）。只记元数据，见契约里的说明。
    [OPTIMIZER_LEDGER_FIELD]: z.boolean().default(DEFAULT_SETTINGS.optimizerLedger),
    // 重启后保留结果框（0.13.0；默认开）。这份状态文件里**有内容**，见契约里的说明。
    [OPTIMIZE_KEEP_DOCK_FIELD]: z.boolean().default(DEFAULT_SETTINGS.optimizeKeepDock),
    // 只读查证工具（0.13.0；默认关）。开了解释层才会派 read/glob/grep。
    [OPTIMIZE_READ_TOOLS_FIELD]: z.boolean().default(DEFAULT_SETTINGS.optimizeReadTools),
    // 三档的自定义系统提示词：默认空串 = 用内置那份（空串同时就是「恢复内置」写回的值）。
    [OPTIMIZER_PROMPT_FIELDS.basic]: z.string().default(DEFAULT_SETTINGS.optimizerPromptBasic),
    [OPTIMIZER_PROMPT_FIELDS.advanced]: z.string().default(DEFAULT_SETTINGS.optimizerPromptAdvanced),
    [OPTIMIZER_PROMPT_FIELDS.extreme]: z.string().default(DEFAULT_SETTINGS.optimizerPromptExtreme),
    // 「默认终端」（0.5.0 起）：用户档位与可选路径。
    [TERMINAL_MODE_FIELD]: z.string().default(DEFAULT_SETTINGS.terminalMode),
    [TERMINAL_BASH_PATH_FIELD]: z.string().default(DEFAULT_SETTINGS.terminalBashPath),
    // 宿主半自持的三项：探测候选、状态行、当前生效 shell（见 HOST_OWNED_FIELDS）。
    [TERMINAL_CANDIDATES_FIELD]: z.array(z.object({
      path: z.string().default(''),
      label: z.string().default(''),
      kind: z.string().default('path'),
      explicit: z.boolean().default(false),
    })).default([]),
    [TERMINAL_STATUS_FIELD]: z.string().default(DEFAULT_SETTINGS.terminalStatus),
    [TERMINAL_EFFECTIVE_FIELD]: z.string().default(DEFAULT_SETTINGS.terminalEffective),
    // 「统计行」（0.7.0）。这一项**故意用 `.default(true)`**（与上面五栏的 `.required(false)`
    // 相反）：它没有"碰过才开"的迁移需求，默认就是开，且必须能被设置页写入
    // （写不进去 = 开关点了没反应，本插件为此专门有一条回读校验）。
    [STATS_ENABLED_FIELD]: z.boolean().default(DEFAULT_SETTINGS.statsEnabled),
    // 「金额」（0.9.1）：用户覆盖价整张表（按模型 → 档 → 三项单价）。
    //
    // **故意用 `z.any()`**：键是用户自己加的模型名，schemastery 的对象 schema 表达不了动态键。
    // 形状检查交给 `parsePriceOverrides`（逐项宽容、坏项丢掉），schema 再拦一道反而会造出
    // "设置页写不进去"这种最难解释的故障 —— 写入路径只需这一项是 volatile（整个字段一起写，
    // 不做嵌套路径写），所以逐字段标记那一套照旧成立。
    [PRICE_OVERRIDES_FIELD]: z.any().required(false),
    // 「金额」（0.10.0）节假日表：北京日历日的 `YYYY-MM-DD` 数组。**普通数组字段**（键固定，
    // 不是动态键），所以声明得出来；不填 = 用内置那份（`pricing.ts` 的 DEFAULT_PEAK_HOLIDAYS）。
    [PEAK_HOLIDAYS_FIELD]: z.array(z.string()).required(false),
    // 「金额」（0.10.0）峰谷提醒：逐项给默认值，坏值由 `sanitizePeakAlert` 兜（不整份丢）。
    [PEAK_ALERT_FIELD]: z.object({
      enabled: z.boolean().default(DEFAULT_PEAK_ALERT.enabled),
      aheadMinutes: z.number().default(DEFAULT_PEAK_ALERT.aheadMinutes),
      onPeak: z.boolean().default(DEFAULT_PEAK_ALERT.onPeak),
      onOffPeak: z.boolean().default(DEFAULT_PEAK_ALERT.onOffPeak),
      webNotify: z.boolean().default(DEFAULT_PEAK_ALERT.webNotify),
    }).required(false),
    // 「金额」（0.10.0）余额开关：默认开。关掉 = 界面不显示余额行、也不发出网请求
    // （用户不想让插件碰官方接口时的总闸；**不等于**"查了但不显示"）。
    [BALANCE_ENABLED_FIELD]: z.boolean().default(DEFAULT_SETTINGS.balanceEnabled),
    // 「金额」（0.10.0）同步来的价目元信息：`eras` 的键是官方后来才出现的模型名（动态键），
    // 与 priceOverrides 同一个理由用 `z.any()`。第三方价目本体不进设置（见 price-sync.ts）。
    [SYNCED_PRICES_FIELD]: z.any().required(false),
    // 「金额」（0.10.0）自动同步官方价：默认关（会自动出网的开关不默认开）。
    [PRICE_AUTO_SYNC_FIELD]: z.boolean().default(DEFAULT_SETTINGS.priceAutoSync),
  })
}

/**
 * 给一个 schema 节点打 volatile 标记。
 *
 * ⚠️ 为什么不无条件调 `.volatile()`：宿主半把 schemastery **内联**进 lib/index.js
 * （见 build.mjs 的 HOST_ALIASES，取自 DSH 检出的 vendor/ 目录），所以"这个方法存不存在"
 * 取决于**构建时**那份 DSH —— 在 0.1.6 上构建出来的包拿到的是 schemastery 3.18.2，
 * 它根本没有 `volatile()`（3.18.3 才加的）。而标记真正起作用的形态是
 * `schema.meta.volatile` 这个**数据**：0.1.7 的设置服务读的就是它
 * （`volatileForm` 判根、`isVolatilePath` 判路径），跟这棵树是谁构造的无关。
 * 所以：有方法就用方法，没有就直接写 meta —— 两条路的结果一致，
 * 于是同一个产物在 0.1.6 与 0.1.7 上都能被正确识别。
 * @param node 待标记的 schema 节点（`ownSchema()` 的一个字段）。
 * @returns 带标记的节点（有 `.volatile()` 时是它的克隆，否则是原节点）。
 */
function markVolatileField(node: Schema): Schema {
  const withMethod = node as unknown as { volatile?: () => Schema }
  if (typeof withMethod.volatile === 'function') return withMethod.volatile()
  const target = node as unknown as { meta?: { volatile?: boolean } }
  if (target.meta !== undefined) target.meta.volatile = true
  return node
}

/**
 * 逐字段打标记：**标字段，不标根**。
 *
 * ⚠️ 为什么不能标根（2026-09-23 实测，DSH 0.1.7 + 随包 schemastery 3.18.4）：
 * 解析时一旦看到**根**带 volatile，schemastery 就把**整棵解析结果**包成**一个根引用** ——
 * `Config({}).enabled === undefined`，值只在 `.get()` 里。官方形状则是"普通对象壳 +
 * 叶子引用"：`ui-theme` / `locale` / `llm-deepseek` / `ui-conversation` …
 * **一律逐字段标，没有一个标根**。根引用与本插件对不上的是运行时把配置变更提交回
 * **运行中引用**的那条路（loader 的 `_commitVolatile`，按**叶子路径**设计）：
 * 真机表现就是**写入落了盘、界面却还是旧值**（开关"点了没反应"）。
 * @param schema `ownSchema()` 的结果。
 * @returns 同一棵 schema（形状不变，只给每个字段补上 volatile 数据）。
 */
function markVolatile(schema: Schema): Schema {
  const dict = (schema as unknown as { dict?: Record<string, Schema> }).dict
  if (dict === undefined) return schema
  for (const key of Object.keys(dict)) dict[key] = markVolatileField(dict[key]!)
  return schema
}

/**
 * 第三方价目（models.dev）的**进程内缓存**。
 *
 * 为什么放在模块级而不是某个 `inject` 作用域里：写它的是"同步"那条路由、读它的是"用量"那条
 * 路由，两者是两个独立的 inject 作用域，变量拿不过去。走文件又不行 —— 每次取价都解析
 * 450 KB（215 个 provider / 7831 个模型）不现实，所以进程内留一份，
 * 同步成功后把 `loaded` 置回 false 让它下次重读。
 */
const priceCache: { loaded: boolean; providers: ProviderPriceTable | undefined } = { loaded: false, providers: undefined }

/** 取第三方价目（首次问磁盘，之后走缓存；读不到就是 `undefined` —— 界面显示"未定价"）。 */
async function ensureProviderPrices(): Promise<ProviderPriceTable | undefined> {
  if (priceCache.loaded) return priceCache.providers
  priceCache.loaded = true
  try {
    const file = await readPriceFile()
    priceCache.providers = file.providers
  } catch {
    priceCache.providers = undefined
  }
  return priceCache.providers
}

/** 作废第三方价目缓存（同步路由写完文件后调）。 */
function invalidateProviderPrices(): void {
  priceCache.loaded = false
  priceCache.providers = undefined
}

/**
 * 「金额规则变了」的失效回调注册表（模块级，理由同上：写的人与读的人在不同 inject 作用域）。
 *
 * 注册方是用量路由（它持有 `moneyRules` 与折叠缓存），触发方是同步路由与自动同步。
 * **为什么不能只靠设置变更事件**：0.1.7 的 `settings/document-updated` 只在 `describe()` 里
 * 比对 raw 变化后发出，而我们自己 `mutate` 写设置时并不调 `describe()` —— 设置页没开着时
 * （自动同步就是这种情形）事件不会发，金额会停在旧价格档上而界面上看不出来。
 */
const moneyInvalidators = new Set<() => void>()

/** 通知所有失效回调（单个回调抛错不影响别人，也绝不冒泡给出网路径）。 */
function invalidateMoney(): void {
  for (const invalidate of moneyInvalidators) {
    try {
      invalidate()
    } catch (error: unknown) {
      console.warn('[composer-ux] 金额规则失效回调出错', error)
    }
  }
}

/**
 * 官方信任关卡：`webServer` 可以绑 `0.0.0.0`（`webserver/src/index.ts` 的 bind host），
 * 所以**每条自己开的路由**都要先问 `connection.requestRejection(request)` ——
 * 它同时管 Host/Origin 围栏（防 DNS rebinding、跨站）与浏览器登录令牌。
 * 返回 true = 已被拒并结束响应（调用方立刻 return，连数据都不读）。
 *
 * 2026-09-29 补上：`金额` 这一批新路由（用量分列、价目同步、余额）起初漏了这道关卡 ——
 * 余额那条最严重（任何能访问该端口的人都能读走账号余额），所以三条一起挂。
 * @param ctx 宿主上下文（用 `get`，不在 inject 列表里也不抛）。
 * @param req 原始请求（`IncomingMessage`）。
 * @param res 响应（只用到 `statusCode` 与 `end`；用 rest 参数是为了同时吃下
 *   `end(body: string)` 与 `end(body?: string)` 两种声明 —— 本文件里两套路由各自声明不同）。
 */
function rejectUntrustedRequest(
  ctx: { get: (name: string) => unknown },
  req: unknown,
  res: { statusCode?: number; end: (...args: string[]) => void },
): boolean {
  try {
    const connection = ctx.get('connection') as
      { requestRejection?: (request: unknown) => number | undefined } | undefined
    const rejection = connection?.requestRejection?.(req)
    if (rejection === undefined) return false
    res.statusCode = rejection
    res.end()
    return true
  } catch {
    // `get` 不抛；万一这一版的 connection 形状不同，也不该让整条路由挂掉。
    return false
  }
}

/**
 * 插件 Config —— DSH 0.1.7 起，`settings.register()` 被删除，命名空间改由
 * **插件导出的 Config** 推导。
 *
 * ⚠️ 关键在于 volatile：新版**只有** volatile 字段会被服务（`volatileForm`）、
 * 也**只有** volatile 路径能被设置页写入（`isVolatilePath`）。本节字段全部是用户可编辑项
 * （含宿主半回写的状态字段），所以**一个不漏地逐字段标**——漏一个，那个字段在设置页上
 * 就读不到 / 写不进去。标记放在**字段**上而不是整棵对象上，理由见 {@link markVolatile}。
 *
 * 0.1.6 没有 volatile：那时 Config 只是一份同形状的 schema，
 * 命名空间仍由 `apply` 里的 `settings.register(NAMESPACE, Config)` 显式注册。
 */
export const Config: Schema = markVolatile(ownSchema())

/**
 * 注册 durable section；settings 服务缺席（无 provider）时静默跳过。
 *
 * 两代 DSH 的差别（2026-09 实测，见文件头与 {@link Config}）：
 *   · 0.1.6 及以前：`settings.register(命名空间, schema)` 是**唯一**的注册入口。
 *   · 0.1.7 起：没有 register，命名空间由导出的 {@link Config} 自动被服务。
 * 所以这里按能力分支，两代都能挂上。
 *
 * @param ctx 宿主半上下文。
 * @param config 本行的 Config：0.1.7 是 volatile 引用树；0.1.6 是解析后的普通值
 *   （那时读值仍走 `settings.get`，这个参数只用作兜底）。
 */
export function apply(ctx: Context, config?: unknown): void {
  /** 把「读口」包成终端子系统期望的形状：只替换 `get`，`mutate` 原样转发。 */
  const readView = (
    service: unknown,
  ): { get: (ns: string) => unknown; mutate: (ns: string, ops: readonly PathOp[]) => Promise<void> } | undefined => {
    if (service === null || service === undefined) return undefined
    const real = service as SettingsLike
    return { get: makeReader(real, config), mutate: (ns, ops) => real.mutate(ns, ops) }
  }

  /**
   * 孤儿写入锁的回收（背景与判据见 `src/settings-lock.ts`）。
   *
   * 为什么放在启动路径上：设置写入用的锁是 `<profile>/package.json.lock`，而**硬杀**
   * （`restart-webui.bat` 的 `taskkill /T /F`）正好落在一次设置写入中间时会把它留下；
   * 此后该 profile 的**每一次**设置写入都超时失败，界面上只表现为"点了没反应"，
   * 一句报错都没有。写入失败之后再做就已经晚了，所以这件事只在启动时做一次。
   *
   * 判据收紧到"能证明持有者已不存在"：认不出 PID、PID 还活着、权限不足无法判定
   * → 一律保持不动。误删一把活锁会让两个写入者交错提交同一个 profile patch，
   * 比不删更糟（真机事故见 `README.md`「设置写不进去」一节）。
   */
  ctx.inject(['configEditor'], (lockCtx) => {
    try {
      const documentPath = (lockCtx.configEditor as { documentPath?: unknown }).documentPath
      if (typeof documentPath !== 'string' || documentPath === '') return
      void recoverStaleSettingsLock(profileDirOfPatchPath(documentPath), message => {
        console.warn(`[composer-ux] ${message}`)
      }).catch((error: unknown) => {
        console.error('[composer-ux] 孤儿写入锁检查失败', error)
      })
    } catch (error: unknown) {
      console.error('[composer-ux] 孤儿写入锁检查失败', error)
    }
  })

  ctx.inject(['settings'], (settingsCtx) => {
    const settings = settingsCtx.settings as unknown as SettingsLike
    // 0.1.6 及以前：命名空间必须显式注册。0.1.7 起 register 不存在，什么都不做。
    if (typeof settings.register === 'function') settings.register(NAMESPACE, Config)
    const read = makeReader(settings, config)
    // 串行化：本插件自己的写入也会再触发 settings/updated，用 busy/again 保证
    // 一次只跑一轮镜像，且不漏掉期间到达的变更。
    let busy = false
    let again = false
    const sync = (): void => {
      if (busy) {
        again = true
        return
      }
      busy = true
      void mirrorHeader(settings, read)
        .catch((error: unknown) => {
          console.error('[composer-ux] 请求头镜像失败', error)
        })
        .finally(() => {
          busy = false
          if (again) {
            again = false
            sync()
          }
        })
    }

    /**
     * 设置变化后重跑镜像。
     *
     * ⚠️ 事件名也换代了：0.1.7 起是 `settings/document-updated`（参数是 `(ns, revision)`），
     * 而旧名 `settings/updated` 在 0.1.7 里**整个不存在**（服务已经不发它了）。
     * 两个都听：任一世代只会有一个真的触发，且 `sync()` 本身幂等、不产生回环。
     */
    const onSettingsUpdated = (ns: unknown): void => {
      if (ns === NAMESPACE || ns === LLM_NAMESPACE) sync()
    }
    for (const event of ['settings/updated', 'settings/document-updated']) {
      ctx.on(event as never, onSettingsUpdated as never)
    }
    // 启动即对齐一次：启用状态下的头即使在别处被抹掉，也会在此补回。
    sync()
  })

  // ── 提示词优化接口 ────────────────────────────────────────────────────────
  //
  // 为什么必须在宿主半：出网请求由宿主的模型适配器发出，浏览器侧碰不到模型路由。
  // 所以「优化提示词」是一次「浏览器 POST 原文 -> 宿主独立跑一次模型调用 ->
  // 把优化后的正文回给浏览器填进输入框」的往返。这与
  // WestFox-AwA/dsh-prompt-optimizer 的架构一致（它的系统提示词也已提取到
  // ./optimizer-prompt.ts）。
  ctx.inject(['webServer', 'llm'], (optCtx) => {
    /** 单次优化的墙钟上限：够慢模型跑完，但不会让请求永远挂着。 */
    const LLM_TIMEOUT_MS = 180_000
    /** 记忆链里"上一轮成品"的长度上限（再多就本末倒置了）。 */
    const PREVIOUS_MAX = 1_500
    /** 请求体上限（输入框里的原文，正常都是几 KB）。 */
    const BODY_MAX_BYTES = 1_000_000
    /**
     * 直接送去优化的原文长度上限。
     *
     * 与旧实现等值（旧 `QUICK_TEXT_MAX * 2` = 8000）：快捷指令的存储上限已经提到
     * 20 万，但**优化请求**的输入上限必须留在原地，否则超长文本会被丢给模型。
     */
    const TEXT_MAX = OPTIMIZE_TEXT_MAX

    const sendJson = (
      res: { writeHead: (code: number, headers: Record<string, string>) => void; end: (body: string) => void },
      code: number,
      payload: unknown,
    ): void => {
      res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(payload))
    }

    const readBody = async (req: AsyncIterable<unknown>): Promise<string> => {
      const chunks: Buffer[] = []
      let total = 0
      for await (const chunk of req) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
        total += buf.length
        if (total > BODY_MAX_BYTES) throw new Error('请求体过大')
        chunks.push(buf)
      }
      return Buffer.concat(chunks).toString('utf8')
    }

    /** 解析本次优化用哪条路由：请求体优先，其次当前默认模型。 */
    const resolveRoute = (payload: Record<string, unknown>): { provider: string; model: string } => {
      const provider = textOf(payload.provider)
      const model = textOf(payload.model)
      if (provider !== '' && model !== '') return { provider, model }
      try {
        const selector = optCtx.get('agentDefaultModel') as
          { currentSelection?: () => { provider?: unknown; model?: unknown } } | undefined
        const current = selector?.currentSelection?.()
        return { provider: textOf(current?.provider), model: textOf(current?.model) }
      } catch {
        return { provider: '', model: '' }
      }
    }

    /**
     * 该路由能选的最省推理档。
     *
     * 为什么需要：优化是"给它一条草稿、让它吐条目"的短任务，而用户当前的默认模型
     * 可能是推理模型 —— 不指定档位时它按自己的默认档先想很久，首 token 前纯空转
     * （对方 0.3.17 实测"推理模型首 token 前的空转显著缩短"，做法也是钳最低档）。
     * 所以这里按路由**真实暴露**的档位选最省的那一档；**查不到就什么都不传**
     * ——绝不乱造一个适配器不认的值，拿不准时不冒险。
     */
    const EFFORT_MIN_RE = /none|minimal|low|低|off/i
    /** 解析结果缓存（同一个 provider/model 只问一次；失败不缓存，下次再试）。 */
    const effortCache = new Map<string, { id: string; at: number }>()
    const EFFORT_CACHE_MS = 10 * 60_000

    const lowestReasoningEffort = async (provider: string, model: string): Promise<string> => {
      const key = `${provider}\u0000${model}`
      const hit = effortCache.get(key)
      if (hit !== undefined && Date.now() - hit.at < EFFORT_CACHE_MS) return hit.id
      try {
        const llm = optCtx.llm as unknown as {
          resolveModelInfo?: (p: string, m: string, signal?: AbortSignal) => Promise<unknown>
        }
        const info = objectOf(await llm.resolveModelInfo?.(provider, model))
        const reasoning = objectOf(info?.reasoning)
        const raw = Array.isArray(reasoning?.efforts) ? reasoning.efforts : []
        const rows = raw
          .map(row => objectOf(row))
          .filter((row): row is Record<string, unknown> => row !== undefined)
        if (rows.length === 0) return ''
        // 名字里带 none/minimal/low/off/低 的就是最省那档；都没有就取适配器展示顺序的首位。
        const picked = rows.find(row => EFFORT_MIN_RE.test(textOf(row.id)) || EFFORT_MIN_RE.test(textOf(row.name)))
          ?? rows[0]
        const id = textOf(picked?.id)
        if (id === '') return ''
        effortCache.set(key, { id, at: Date.now() })
        return id
      } catch {
        return ''
      }
    }

    /**
     * 读一份会话日志快照（0.12.0 的会话上下文用）。
     *
     * 上下文是**加分项**：宿主没装 sessionQuery、会话 id 认不出、快照读失败……一律返回
     * undefined 并按"没有上下文"继续优化 —— 绝不因为读不到上文就让整轮失败。
     */
    const readSessionSnapshot = async (sessionId: string): Promise<unknown> => {
      try {
        const query = optCtx.get('sessionQuery') as
          { readSession?: (id: string) => Promise<unknown> } | undefined
        if (query?.readSession === undefined) return undefined
        return await query.readSession(sessionId as never)
      } catch {
        return undefined
      }
    }

    const handle = async (
      req: { method?: string; [key: string]: unknown },
      res: {
        writeHead: (code: number, headers: Record<string, string>) => void
        end: (body?: string) => void
        write?: (chunk: string) => void
        statusCode?: number
        on?: (event: string, listener: () => void) => unknown
      },
    ): Promise<void> => {
      if ((req.method ?? 'GET').toUpperCase() !== 'POST') {
        sendJson(res, 405, { ok: false, error: '只接受 POST' })
        return
      }
      // 官方信任关卡（见 rejectUntrustedRequest）：这条路由动的是**用户的模型额度**
      // 和**用户的原话**，是"钱 + 数据"两样都碰的接口，必须挡在最前面 ——
      // 位置刻意在读请求体之前：被拒的请求连 body 都不读。
      if (rejectUntrustedRequest(optCtx as never, req, res as never)) return
      // 台账计时起点：只统计**真正被处理**的请求（被信任关卡挡掉的连 body 都没读）。
      const startedAt = Date.now()
      let payload: Record<string, unknown>
      try {
        payload = objectOf(JSON.parse(await readBody(req as unknown as AsyncIterable<unknown>)))
          ?? {}
      } catch (error: unknown) {
        sendJson(res, 400, { ok: false, error: `请求体不是合法 JSON：${errorText(error)}` })
        return
      }

      const text = textOf(payload.text).trim()
      if (text === '') {
        sendJson(res, 400, { ok: false, error: '输入框是空的，没有可优化的内容' })
        return
      }
      // 斜杠命令（`/goal 帮我写周报`）：只优化命令**后面的正文**，前缀由调用方拼回。
      // 客户端已经拆过一次，这里是第二道门 —— 真收到"只有命令、没有正文"就如实拒绝，
      // 别把一条命令词丢给模型去"优化"（那只会把命令词改坏）。
      const slash = splitSlashCommand(text)
      if (slash.prefix !== '' && slash.body === '') {
        sendJson(res, 400, { ok: false, error: `「${slash.prefix}」后面没有正文，没有可优化的内容` })
        return
      }
      /** 真正送去模型的那段正文（命令前缀不进模型）。 */
      const body = slash.prefix === '' ? text : slash.body
      if (body.length > TEXT_MAX) {
        sendJson(res, 400, { ok: false, error: `原文过长（上限 ${TEXT_MAX} 字符）` })
        return
      }

      const tier = textOf(payload.tier) === '' ? DEFAULT_OPTIMIZER_TIER : textOf(payload.tier)
      const route = resolveRoute(payload)
      if (route.provider === '' || route.model === '') {
        sendJson(res, 200, { ok: false, error: '拿不到当前的模型路由，无法优化（请先在输入框旁的模型选择器里选一个模型）' })
        return
      }

      // 本档的系统提示词：设置页里写过就用用户那份，否则用内置那份。
      // 读设置走 `optCtx.get('settings')`（**不在 inject 列表**里也安全：`get` 不抛，
      // 裸属性读才会抛）。读不到就当作"没有自定义"——内置那份永远可用。
      const customPrompt = readOwnSetting(optCtx, config, optimizerPromptFieldOf(tier))

      // 会话上下文（0.12.0）：设置里默认开；关了、或没送 sessionId、或读不到快照，都按
      // "没有上下文"走（优化本身不依赖它）。
      const contextOn = readOwnFlag(optCtx, config, OPTIMIZER_CONTEXT_FIELD, DEFAULT_SETTINGS.optimizerContext)
      // 台账开关（默认开）：只记元数据，不记原文；关掉就一条都不写。
      const ledgerOn = readOwnFlag(optCtx, config, OPTIMIZER_LEDGER_FIELD, DEFAULT_SETTINGS.optimizerLedger)
      // 只读查证工具（0.13.0 ⑤；默认**关**）：工具轮次要花时间与 token，不替用户决定放大成本。
      const readToolsOn = readOwnFlag(optCtx, config, OPTIMIZE_READ_TOOLS_FIELD, DEFAULT_SETTINGS.optimizeReadTools)
      const sessionId = textOf(payload.sessionId)
      const contextTurns = contextOn && sessionId !== ''
        ? contextWithinBudget(recentTurns(await readSessionSnapshot(sessionId)))
        : []
      const contextText = contextBlock(contextTurns)

      // 记忆链（0.12.0）：上一轮成品。客户端只在"用户在上一版基础上又改了原文"时才带它。
      const previous = textOf(payload.previous).trim().slice(0, PREVIOUS_MAX)

      // 达到了上下文就加"只用于消歧义、不算依据"那段纪律。
      const system = buildOptimizeSystem(tier, customPrompt, { intent: contextText !== '' })

      const controller = new AbortController()
      const timer = setTimeout(() => { controller.abort() }, LLM_TIMEOUT_MS)

      /**
       * 客户端断连（关页面/切走）就中止这次调用，不再白烧额度。
       *
       * 用 `res` 的 close 而**不是** `req` 的：`req` 的 close 在请求体读完就触发，
       * 那时客户端还好端端连着（对方 0.3.17 的注释里记着同一个坑）。
       * `settled` 是必须的：正常回完响应后 close 同样会触发，那时不该再 abort。
       */
      let settled = false
      res.on?.('close', () => { if (!settled) controller.abort() })

      // 钳到该路由最省的推理档（查不到就是空串 = 什么都不传）。
      const effort = await lowestReasoningEffort(route.provider, route.model)

      /**
       * 是不是要流式（0.12.0）：看 `Accept`。
       *
       * 为什么用协商而不是换一条新路径：旧客户端（浏览器里缓存的 0.11.x bundle）与
       * 新宿主可能短暂并存 —— 它发的还是不带 Accept 的 POST，那就照旧一次给 JSON；
       * 新客户端明确要 `text/event-stream` 才走流。**校验失败一律回普通 JSON + 4xx**
       * （流还没开始，谈不上事件），这条与对方 0.3.17 的"预校验 400/405/409/413"同口径。
       */
      const wantsStream = /text\/event-stream/i.test(String((req.headers as Record<string, unknown> | undefined)?.accept ?? ''))
      const emit = (payload: Record<string, unknown>): void => {
        if (!wantsStream) return
        try {
          res.write?.(`data: ${JSON.stringify(payload)}\n\n`)
        } catch {
          // 客户端已经断开：写不进去就算了 —— 模型那边会由 close → abort 收尾。
        }
      }
      if (wantsStream) {
        res.writeHead(200, {
          'content-type': 'text/event-stream; charset=utf-8',
          'cache-control': 'no-cache, no-transform',
          connection: 'keep-alive',
        })
      }

      /**
       * 逐条流式：只在流式请求下做，且**只在可能闭合元素时才重扫**。
       *
       * 为什么要有这个预筛：逐 token 全量重扫一个不断变长的缓冲是 O(n²)（一条 12 条的
       * 输出有几 KB，真机上是白烧 CPU）。只有 `}` / `]` 才可能闭合一个数组元素。
       * 重扫本身走 `scanOptimizeStream` —— 与批次解析**同一个校验函数**，所以流里出现的
       * 每条都已通过逐字依据核对，绝不会"先闪一下再消失"。
       */
      let seenItems = 0
      let seenDropped = 0
      const onStreamDelta = (out: string, delta: string): void => {
        if (!wantsStream) return
        if (!delta.includes('}') && !delta.includes(']')) return
        const scan = scanOptimizeStream(out, body, tier)
        for (const item of scan.items.slice(seenItems)) {
          emit({
            type: 'item',
            index: seenItems + 1,
            id: item.id,
            kind: item.kind,
            text: item.text,
            quote: item.quote ?? '',
            quoteSource: item.quoteSource,
          })
          seenItems += 1
        }
        for (const row of scan.dropped.slice(seenDropped)) {
          emit({ type: 'dropped', ...row })
        }
        seenDropped = scan.dropped.length
      }

      /** 跑一次模型调用，返回原始正文与失败原因（重试时会被调用第二次）。 */
      const runOnce = async (
        userText: string,
        onDelta: (out: string, delta: string) => void,
      ): Promise<{ out: string; failure: string }> => {
        let out = ''
        let failure = ''
        try {
          const stream = optCtx.llm.stream({
            provider: route.provider,
            model: route.model,
            system,
            temperature: buildOptimizeTemperature(tier),
            ...(effort === '' ? {} : { reasoningEffort: effort }),
            signal: controller.signal,
            messages: [{
              id: `optimize-${Date.now().toString(36)}`,
              role: 'user',
              content: [{ type: 'text', text: userText }],
              source: { kind: 'user' },
            }],
          })
          for await (const chunk of stream as AsyncIterable<Record<string, unknown>>) {
            if (chunk.type === 'text-delta') {
              const delta = String(chunk.text ?? '')
              out += delta
              onDelta(out, delta)
              // 原始 JSON 会比成品长不少（每条都带引文与字段名），上限按成品的 4 倍给。
              if (out.length > OPTIMIZE_OUTPUT_MAX * 4) break
            } else if (chunk.type === 'finish') {
              const reason = objectOf(chunk.reason)
              if (reason?.kind === 'error' || reason?.kind === 'aborted') {
                const detail = objectOf(reason.failure)
                failure = textOf(detail?.message) || (reason.kind === 'aborted' ? '优化被中断' : '模型返回错误')
              }
            }
          }
        } catch (error: unknown) {
          failure = errorText(error)
        }
        return { out, failure }
      }

      /**
       * 只读工具路径（0.13.0 ⑤）：开关开 ∧ 拿得到本会话工作目录才走。
       *
       * 产出还必须过**同一份装配校验** —— 模型查完文件常爱写散文而不是那份 JSON，
       * 那样就当工具路径没成功，回落成不带工具的单次调用（上游真机实测就是这么翻车的）。
       * 回落时 `toolFallback` 为真、轮次与次数保留**真实数字**：那几次调用是真花了钱的。
       */
      let toolInfo: Record<string, unknown> | null = null
      let tooledResult: { out: string; failure: string } | null = null
      const cwd = readToolsOn ? sessionCwdOf(await readSessionSnapshot(sessionId)) : ''
      if (readToolsOn && cwd !== '') {
        try {
          const looped = await runOptimizeToolLoop({
            llm: optCtx.llm as never,
            provider: route.provider,
            model: route.model,
            system: `${system}${READ_TOOLS_SYSTEM_NOTE}`,
            userText: buildOptimizeUser(body, { context: contextText, previous }),
            root: cwd,
            signal: controller.signal,
            onDelta: onStreamDelta,
            maxChars: OPTIMIZE_OUTPUT_MAX * 4,
            temperature: buildOptimizeTemperature(tier),
            reasoningEffort: effort,
          })
          // ⚠ 判据必须是"**真的解析出了条目**"，不能只看 `ok`：装配层对非 JSON 有"整段照收"兜底
          //   （`fallback: true`、`itemCount: 0`），只看 ok 的话模型查完文件写的散文会被当成成功产出，
          //   "查证后回落"就永远不会发生 —— 那正是上游真机翻车过的那条路（开着工具就必定出散文）。
          const assembledByTool = runOptimizePipeline(looped.out, body, { tier })
          const accepted = looped.failure === '' && looped.out.trim() !== ''
            && assembledByTool.ok && assembledByTool.fallback === false
          toolInfo = {
            toolRounds: looped.rounds,
            toolCalls: looped.calls,
            toolNames: [...new Set(looped.names)],
            toolCapped: looped.capped,
            toolRejected: looped.rejected,
            toolFallback: !accepted,
          }
          if (accepted) tooledResult = { out: looped.out, failure: '' }
        } catch (error: unknown) {
          // 工具路径绝不该有能力把整轮弄死：任何抛出都只是"这一路失败"，下面照常回落。
          toolInfo = {
            toolRounds: 0, toolCalls: 0, toolNames: [], toolCapped: false, toolRejected: 0,
            toolFallback: true, toolError: errorText(error),
          }
        }
      }

      let retried = false
      let result: { out: string; failure: string }
      try {
        result = tooledResult ?? await runOnce(buildOptimizeUser(body, { context: contextText, previous }), onStreamDelta)
        // 空产出重试一次：机制与话术取自对方 0.6 的 `retryEmpty` —— 对方真机上的
        // "思考完成却没有产出"多半是模型把 JSON 忘在脑后，点一遍规则就能救回来。
        // 只在**没报错**时重试（报错重试一次只是白等一轮）。
        if (result.out.trim() === '' && result.failure === '') {
          retried = true
          const second = await runOnce(buildOptimizeUser(body, { retry: true, reason: '宿主没有收到任何条目', context: contextText, previous }), onStreamDelta)
          if (second.out.trim() !== '') result = second
          else if (result.failure === '') result = second
        }
      } finally {
        // 模型那一段结束了：此后的装配是本机计算，客户端再断连也没有东西可中止。
        settled = true
        clearTimeout(timer)
      }

      /**
       * 这一轮的最终结果 —— 两条路径共用同一份字段（旧路径一次给 JSON，流式在 done 事件里给），
       * 于是"流式与否"只影响**送达方式**，不影响任何判定。
       */
      /** 台账要的这几个数字：在 outcome 构造里填；失败分支保持 0/空。 */
      let summary = { items: 0, droppedReasons: [] as string[], warnings: 0, fallback: false }

      const outcome = ((): Record<string, unknown> => {
        if (result.out.trim() === '') {
          return {
            ok: false,
            error: result.failure === '' ? '模型没有产出任何内容' : `优化失败：${result.failure}`,
            retried,
            ...(toolInfo === null ? {} : toolInfo),
          }
        }
        // 解析 → 逐条核对逐字依据 → 装配成成品（见 optimizer-assemble.ts）。
        const assembled = runOptimizePipeline(result.out, body, { tier })
        if (!assembled.ok) {
          return {
            ok: false,
            error: `模型输出不是可用的条目 JSON（${assembled.code}）：${assembled.reason}`,
            retried,
          }
        }
        const optimized = assembled.text.trim()
        if (optimized === '') return { ok: false, error: '装配后是空的（模型没有给出可核实的条目）', retried }
        // 只有真正装配成功才记条目数与丢弃原因（否则台账会把"模型没产出"记成"0 条"）。
        summary = {
          items: assembled.itemCount,
          // ⚠️ 只收我们自己写的固定短语（reason），**不收**被丢弃条目的 text（那可能是用户原话）。
          droppedReasons: assembled.dropped.map(item => item.reason),
          warnings: assembled.warnings.length,
          fallback: assembled.fallback,
        }
        return {
          ok: true,
          text: optimized,
          // 语义收窄：`truncated` 现在专指"篇幅闸门真的动过手"（装了必保节仍超预算）。
          truncated: assembled.overBudget,
          provider: route.provider,
          model: route.model,
          // ── 以下为 0.6.0 新增的**附加**字段：老客户端不读它们也不会坏。
          promptSource: optimizePromptSource(customPrompt),
          // 这一轮带了几个往来（0 = 没带上下文：关了开关 / 没有会话 / 读不到快照）。
          contextTurns: contextTurns.length,
          hadPrevious: previous !== '',
          retried,
          fallback: assembled.fallback,
          itemCount: assembled.itemCount,
          rewrittenChars: assembled.rewrittenChars,
          dropped: assembled.dropped,
          warnings: assembled.warnings,
          budget: assembled.budget,
          chars: assembled.chars,
          // 只读查证这一路的记账（没派过工具时就一个键都没有）。
          ...(toolInfo === null ? {} : toolInfo),
        }
      })()

      // 台账（0.13.0）：只记元数据 —— 字数、条数、丢弃原因、上下文规模、耗时、路由、成败。
      // 一段用户原文都不进这个文件（类型上就没有承载它的字段）；写失败也只少一条记录。
      if (ledgerOn) {
        appendLedger(buildLedgerRun({
          sessionId,
          tier,
          provider: route.provider,
          model: route.model,
          draftChars: body.length,
          contextTurns: contextTurns.length,
          contextChars: contextText.length,
          hadPrevious: previous !== '',
          items: summary.items,
          dropped: summary.droppedReasons.length,
          droppedReasons: summary.droppedReasons,
          warnings: summary.warnings,
          fallback: summary.fallback,
          // 工具记账：回落也带上（"确实花了这些次调用又回落了"比抹平成 0 诚实）。
          ...(toolInfo === null ? {} : toolInfo),
          retried,
          promptSource: optimizePromptSource(customPrompt),
          ms: Date.now() - startedAt,
          ok: outcome.ok === true,
          failure: outcome.ok === true ? undefined : textOf(outcome.error),
        }))
      }

      if (!wantsStream) {
        sendJson(res, 200, outcome)
        return
      }
      // 流式的收尾：done 事件带的就是旧路径那份 JSON（含失败情形），随后关流。
      emit({ type: 'done', ...outcome })
      try {
        res.end()
      } catch {
        // 已经断开：无所谓，这一轮的账已经在 outcome 里算清了。
      }
    }

    /**
     * 结果框状态（0.13.0 ①）：`GET` 读上一轮、`POST` 存这一轮。
     *
     * 与其余路由一样**先过官方信任关卡**；只读写**固定路径**那一份文件
     * （不接受调用方给路径，避免这条路由变成"任意文件读写"）。
     */
    const handleState = async (
      req: { method?: string; [key: string]: unknown },
      res: {
        writeHead: (code: number, headers: Record<string, string>) => void
        end: (body?: string) => void
        statusCode?: number
      },
    ): Promise<void> => {
      if (rejectUntrustedRequest(optCtx as never, req, res as never)) return
      const method = (req.method ?? 'GET').toUpperCase()
      // 开关（默认开）：关掉就既不读也不写，并把已存的那份删掉。
      const keep = readOwnFlag(optCtx, config, OPTIMIZE_KEEP_DOCK_FIELD, DEFAULT_SETTINGS.optimizeKeepDock)
      const file = optimizeStatePath()
      if (method === 'GET') {
        if (!keep) {
          sendJson(res, 200, { ok: true, state: null, keep: false, file })
          return
        }
        const read = readDockState(file)
        sendJson(res, 200, {
          ok: true,
          state: read.state,
          keep: true,
          file,
          bytes: dockStateBytes(file),
          ...(read.corrupt ? { corrupt: true } : {}),
          ...(read.quarantined === undefined ? {} : { quarantined: read.quarantined }),
          ...(read.unknownVersion === undefined ? {} : { unknownVersion: read.unknownVersion }),
        })
        return
      }
      if (method !== 'POST') {
        sendJson(res, 405, { ok: false, error: '只接受 GET / POST' })
        return
      }
      let payload: Record<string, unknown>
      try {
        payload = objectOf(JSON.parse(await readBody(req as unknown as AsyncIterable<unknown>))) ?? {}
      } catch (error: unknown) {
        sendJson(res, 400, { ok: false, error: `请求体不是合法 JSON：${errorText(error)}` })
        return
      }
      if (!Object.prototype.hasOwnProperty.call(payload, 'state')) {
        sendJson(res, 400, { ok: false, error: '缺少 state 字段（null = 清空）' })
        return
      }
      const candidate = payload.state
      if (candidate !== null && (typeof candidate !== 'object' || Array.isArray(candidate))) {
        sendJson(res, 400, { ok: false, error: 'state 必须是对象或 null' })
        return
      }
      if (!keep) {
        clearDockState(file)
        sendJson(res, 200, { ok: true, cleared: true, keep: false, file })
        return
      }
      const result = writeDockState(candidate as Record<string, unknown> | null, file)
      if (!result.written) {
        // 太大（或写不进去）：如实回报，**不截半**、也不假装存上了。
        sendJson(res, 200, {
          ok: false,
          keep: true,
          file,
          ...(result.tooBig === true ? { tooBig: true, bytes: result.bytes, error: `状态超过上限（${result.bytes} 字节），没有写盘` } : {}),
          ...(result.error === undefined ? {} : { error: result.error }),
        })
        return
      }
      sendJson(res, 200, { ok: true, keep: true, file, bytes: result.bytes ?? 0 })
    }

    optCtx.effect(() => optCtx.webServer.register({
      kind: 'exact',
      path: OPTIMIZE_STATE_API_PATH,
      handler: handleState as never,
    }), 'composer-ux: optimize dock state route')

    optCtx.effect(() => optCtx.webServer.register({
      kind: 'exact',
      path: OPTIMIZER_API_PATH,
      handler: handle as never,
    }), 'composer-ux: prompt optimizer route')
  })

  // ── 快捷指令的全局存储 ────────────────────────────────────────────────────
  //
  // 0.3.0 起快捷指令不再写入 settings 文档，改存 `$DSH_HOME/quick-prompts.json`：
  // 设置文档对数组是整份替换、且受 schema 长度上限截断，而快捷指令是**用户内容**
  // （长提示词是常态），并且需要一份与会话、项目无关、可以单独备份的落点。
  //
  // 本块只负责「读、迁移、整本写回」；原子写、写锁、坏文件隔离都在
  // ./quick-store.ts，客户端半通过这条路由读写（见 client/prompt-book.ts）。
  ctx.inject(['webServer'], (storeCtx) => {
    /** 请求体上限：整本快捷指令都在里面，给足余量（正常只有几十 KB）。 */
    const BODY_MAX_BYTES = 8_000_000

    const sendJson = (
      res: { writeHead: (code: number, headers: Record<string, string>) => void; end: (body: string) => void },
      code: number,
      payload: unknown,
    ): void => {
      res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify(payload))
    }

    const readBody = async (req: AsyncIterable<unknown>): Promise<string> => {
      const chunks: Buffer[] = []
      let total = 0
      for await (const chunk of req) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
        total += buf.length
        if (total > BODY_MAX_BYTES) throw new Error('请求体过大')
        chunks.push(buf)
      }
      return Buffer.concat(chunks).toString('utf8')
    }

    /**
     * 迁移种子：0.2.x 存在 settings 里的平铺列表。
     *
     * 取不到就是 undefined —— 那时用内置 9 条初始化（见 quick-store 的 ensureQuickBook）。
     * 旧值**保留在设置文档里、不清空**：万一回滚到旧版本，用户还能看到自己那几条。
     */
    const legacyPrompts = (): readonly unknown[] | undefined => {
      try {
        const settings = storeCtx.get('settings') as SettingsLike | undefined
        const row = makeReader(settings, config)(NAMESPACE)
        const list = row?.[QUICK_PROMPTS_FIELD]
        return Array.isArray(list) ? list as readonly unknown[] : undefined
      } catch {
        return undefined
      }
    }

    const handle = async (
      req: { method?: string; [key: string]: unknown },
      res: {
        writeHead: (code: number, headers: Record<string, string>) => void
        end: (body: string) => void
        statusCode?: number
      },
    ): Promise<void> => {
      const method = (req.method ?? 'GET').toUpperCase()
      if (method !== 'GET' && method !== 'POST') {
        sendJson(res, 405, { ok: false, error: '只接受 GET / POST' })
        return
      }
      // 官方信任关卡（见 rejectUntrustedRequest）：这条路由会**把用户的提示词库写盘**，
      // POST 就是一次覆盖写 —— 与"金额"那一批同样不许裸奔。
      if (rejectUntrustedRequest(storeCtx as never, req, res as never)) return

      const file = quickStorePath()
      // 每次请求都尝试一次「缺失即迁移」；文件存在时它什么也不做。
      const outcome = await ensureQuickBook(legacyPrompts(), file)
      if (outcome.kind === 'broken') {
        // 坏文件已被改名隔离，这里**不做任何写入**，如实把原因交给 UI 显示。
        sendJson(res, 200, {
          ok: false,
          file,
          error: `快捷指令文件读不了：${outcome.error}`,
          quarantined: outcome.quarantined ?? '',
        })
        return
      }
      if (method === 'GET') {
        sendJson(res, 200, { ok: true, file, book: outcome.book })
        return
      }

      let payload: Record<string, unknown>
      try {
        payload = objectOf(JSON.parse(await readBody(req as unknown as AsyncIterable<unknown>))) ?? {}
      } catch (error: unknown) {
        sendJson(res, 400, { ok: false, error: `请求体不是合法 JSON：${errorText(error)}` })
        return
      }

      const candidate = payload.book !== undefined ? payload.book : payload
      const next = sanitizeBook(candidate)
      if (next === undefined) {
        sendJson(res, 400, {
          ok: false,
          error: '提交的结构认不出（期望 { book: { categories: [...] } } 或 { categories: [...] }）',
        })
        return
      }
      try {
        await writeQuickBook(next, file)
      } catch (error: unknown) {
        sendJson(res, 500, { ok: false, error: `写入失败：${errorText(error)}` })
        return
      }
      // 写完重读一遍：回给客户端的是**磁盘上的真实内容**，不是我们以为写进去的东西，
      // 这样任何被收窄/丢弃的字段都会立刻在 UI 上暴露出来。
      const verified = await readQuickBook(file)
      sendJson(res, 200, { ok: true, file, book: verified.kind === 'ok' ? verified.book : next })
    }

    storeCtx.effect(() => storeCtx.webServer.register({
      kind: 'exact',
      path: QUICK_PROMPTS_API_PATH,
      handler: handle as never,
    }), 'composer-ux: quick prompt store route')
  })

  // ── 按 route 分列的用量（0.8.0）────────────────────────────────────────────
  //
  // 「金额」面板要把本会话的费用按 route 拆开（用户 2026-09-28 选的就是这一档），而这件事
  // **只能在宿主半做**：客户端拿到的 `tokenUsage` 只有整会话累计的四个桶、`modelSelection`
  // 只有"最后一次"，会话里换过 route 之后就归不了因；`session.events` 只有宿主能读。
  // 折叠规则（尤其是"同一 turn/step 的上报是累计值，要相减"）与出处见 `src/usage-fold.ts`。
  //
  // 这条路由**只读**：读会话事件、回 JSON，不写任何文件、不碰设置。方法与另外几条一样，
  // 只接受 GET（POST 也放行只是为了一致，实际上没有写入路径）。
  ctx.inject(['webServer', 'sessions'], (usageCtx) => {
    const sendJson = (
      res: { writeHead: (code: number, headers: Record<string, string>) => void; end: (body: string) => void },
      code: number,
      payload: unknown,
    ): void => {
      res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(payload))
    }

    /** 当前活着的会话（读不到就是空数组：宿主没装 sessions 也不该让路由炸掉）。 */
    const liveSessions = (): readonly unknown[] => {
      try {
        const sessions = usageCtx.get('sessions') as { list?: () => readonly unknown[] } | undefined
        const list = sessions?.list?.()
        return Array.isArray(list) ? list : []
      } catch {
        return []
      }
    }

    /**
     * 金额规则（0.10.0）：档位判定要用的三样东西 —— 节假日表、价格历史档、第三方价目。
     *
     * 放在一个可变的 `moneyRules` 里而不是"每次取价重读设置"：折叠是**逐事件**调判定的
     * （一次播种可能几千条），每条都去问设置服务太贵。所以改成"设置一变就重读 + 把折叠缓存
     * 整份作废"（见下面的 settings 订阅）—— 档位是折进去的，不重折就永远停在旧规则上。
     */
    const moneyRules: {
      holidays: readonly string[]
      eras: readonly PriceEra[]
      providers?: ProviderPriceTable
    } = { holidays: DEFAULT_PEAK_HOLIDAYS, eras: [] }

    /** 第三方价目走进程内缓存（见模块级 `priceCache`）；这里只把它抄进本轮规则。 */
    const loadProviders = async (): Promise<void> => {
      moneyRules.providers = await ensureProviderPrices()
    }

    /**
     * 读本插件自己那一行 —— **必须走 `makeReader`，不能用 `settings.get(ns)`**。
     *
     * ⚠️ 这是一个 0.9.1 就存在、0.10.0 才发现并修掉的真 bug（2026-09-29）：本机跑的是
     * DSH **0.1.7-rc.1**，它的设置服务**只有 `describe()`**（`packages/settings/settings/src/index.ts`
     * 里根本没有 `get(ns)`）—— 而旧代码写的是 `service?.get?.(NAMESPACE)`，于是**永远读不到值**：
     * 用户在设置页「金额」里填的单价**根本没进宿主半的计价**（胶囊与明细页用的是没有覆盖价的数字），
     * 节假日表与同步来的价格档 likewise。测试没抓到是因为宿主测试的假 settings 服务**有** `get`。
     * `makeReader` 两代都兼容（0.1.7 走 `describe()`，本行还能直接解引用导出的 volatile `Config` 树）。
     */
    const readOwn = makeReader(usageCtx.get('settings') as unknown as SettingsLike, config)

    /** 重读金额相关设置（读不到就退回内置，一次读失败不该把金额算成全 0 或算错档）。 */
    const readMoneySettings = (): void => {
      try {
        const row = readOwn(NAMESPACE)
        const synced = row?.[SYNCED_PRICES_FIELD] as Record<string, unknown> | undefined
        // 节假日（0.11.0）：**手填 > 自动获取 ∪ 内置**。并集那一步的理由见
        // `pricing.ts` 的 `effectiveHolidays`：拿自动那份替换内置表会在跨年后丢掉老年份，
        // 让旧会话被重新按高峰价显示（2 倍）。
        moneyRules.holidays = effectiveHolidays(row?.[PEAK_HOLIDAYS_FIELD], synced?.holidays).days
        moneyRules.eras = parsePriceEras(synced?.eras) ?? []
      } catch {
        moneyRules.holidays = DEFAULT_PEAK_HOLIDAYS
        moneyRules.eras = []
      }
    }

    /**
     * 档位判定（0.9.1 判峰谷、0.10.0 加价格档）：按**每条用量事件自己的时间戳**判，
     * 而不是"看面板的那一秒"。
     *
     * 这就是 0.8.0 的一个静默错处：昨晚（空闲档）跑的会话，今天上午 10 点看会整份按高峰档
     * 显示 —— 差 2 倍，而屏幕上只是个数字。事件没有可用时间戳时退回"现在"（＝旧行为），
     * 但绝不静默把一切判成空闲档。
     *
     * 第三方路由**没有**峰谷与历史档概念（它们的价是平坦的、也就没有"哪一档"），
     * 所以那里直接给 `{peak: false, era: ''}` —— 否则界面会多出两行假的"高峰用量"。
     */
    const tierAt = (ms: number, provider: string, model: string): UsageTier => {
      const at = Number.isFinite(ms) ? ms : Date.now()
      if (!isDeepSeekRoute(provider, model)) return { peak: false, era: '' }
      return { peak: isPeakAt(at, { holidays: moneyRules.holidays }), era: eraIdAt(at, moneyRules.eras) }
    }

    readMoneySettings()

    /**
     * 每个被问过的会话一个**增量**折叠缓存（`createUsageCache`，纯逻辑在 `usage-fold.ts`）。
     *
     * 为什么要缓存：金额胶囊要跟着流式用量刷新，而 `sessionQuery.readSession()` 会深拷贝整份
     * 日志并重新校验（几千条事件也要几百毫秒），每次取价都重读不可接受。缓存靠两条腿走路：
     *   · 下面的 `session/event` 订阅 —— 活会话的事件一条条喂进来，取价时是 O(1)；
     *   · `sync()` 里的 `seq` 落后检测 —— 首次（或发现落后）时完整读一次播种，
     *     播种期间订阅来的事件由缓存内部攒着、读完按 seq 补上（细节见 `usage-fold.ts`）。
     */
    const usageCache = createUsageCache(tierAt)
    usageCtx.on?.('session/event', ((session: unknown, event: unknown) => {
      try {
        const id = (session as { id?: unknown } | null)?.id
        if (typeof id !== 'string' || id === '') return
        usageCache.event(id, event)
      } catch (error: unknown) {
        // 折叠失败绝不能影响会话本身：这里只记一条日志。
        console.warn('[composer-ux] 会话用量折叠失败', error)
      }
    }) as never)

    /**
     * 金额规则一变就要跑的那套失效（重读规则 + 作废第三方价目缓存 + 作废折叠缓存）。
     *
     * ⚠️ **不能只靠设置变更事件**（2026-09-29 复查时发现）：0.1.7 的
     * `settings/document-updated` 只在 `describe()` 里比对 raw 变化后发出
     * （`packages/settings/settings/src/index.ts`），而**我们自己**用 `mutate` 写设置时并不调
     * `describe()` —— 设置页开着时它会被界面的刷新顺带触发，但**设置页没开着**（典型场景：
     * 后台的「自动同步官方价」跑完）那条事件根本不会发。而折叠缓存是按 `seq` 去重的，
     * 改规则不会让旧事件重折 —— 金额会静静地停在旧价格档上，界面上完全看不出来。
     *
     * 所以：**写完设置的人自己通知失效**（见模块级 `invalidateMoney`），事件只是补充。
     */
    const onMoneySettingsUpdated = (): void => {
      readMoneySettings()
      invalidateProviderPrices()
      usageCache.clear()
    }
    for (const event of ['settings/updated', 'settings/document-updated']) {
      usageCtx.on?.(event as never, ((ns: unknown): void => {
        if (ns !== NAMESPACE) return
        onMoneySettingsUpdated()
      }) as never)
    }
    // 登记给同步路由用（模块级注册表，因为它俩不在同一个 inject 闭包里）。
    usageCtx.effect(() => {
      moneyInvalidators.add(onMoneySettingsUpdated)
      return () => {
        moneyInvalidators.delete(onMoneySettingsUpdated)
      }
    }, 'composer-ux: 金额规则失效登记')

    /** 当前生效的用户覆盖价（读不到就当没填：一次设置读失败不该把金额算成全 0）。 */
    const readOverrides = (): PriceOverrideTable | undefined => {
      try {
        const row = readOwn(NAMESPACE)
        return parsePriceOverrides(row?.[PRICE_OVERRIDES_FIELD])
      } catch {
        return undefined
      }
    }

    const handle = (
      req: { method?: string; url?: string },
      res: { writeHead: (code: number, headers: Record<string, string>) => void; end: (body: string) => void },
    ): void => {
      const method = (req.method ?? 'GET').toUpperCase()
      if (method !== 'GET' && method !== 'POST') {
        sendJson(res, 405, { ok: false, error: '只接受 GET / POST' })
        return
      }
      // 官方信任关卡（见 rejectUntrustedRequest）：会话用量也是数据，同样不许裸奔。
      if (rejectUntrustedRequest(usageCtx as never, req, res)) return
      const url = typeof req.url === 'string' ? req.url : ''
      const queryAt = url.indexOf('?')
      const params = new URLSearchParams(queryAt < 0 ? '' : url.slice(queryAt + 1))
      const sessionId = params.get('sessionId') ?? ''
      if (sessionId.length === 0) {
        sendJson(res, 400, { ok: false, error: '缺 sessionId' })
        return
      }
      void (async (): Promise<void> => {
        // ── 1) 把折叠器同步到最新 ───────────────────────────────────────────────
        // 第一次被问（缓存里还没有这个会话）与"落后检测"命中时，缓存内部会用
        // `sessionQuery.readSession()` 完整读一次播种；之后全靠 `session/event` 订阅增量喂。
        // **2026-09-28 真机踩坑**：这一版没有 `assistant/chunk` 事件，usage 藏在
        // `assistant/attempt` 的 stream 里（见 src/usage-fold.ts 文件头），所以"一条都没读到"
        // 必须如实回报，绝不编一份空分列糊上去。
        const live = liveSessions().find(row => (row as { id?: unknown } | null)?.id === sessionId) as
          { seq?: unknown } | undefined
        // `seq` 是"下一条事件的序号"（= 已写入条数），所以最后一条已写入事件的 seq 是 `liveSeq - 1`。
        const liveSeq = typeof live?.seq === 'number' && Number.isFinite(live.seq) ? live.seq : undefined
        const { fold, source } = await usageCache.sync(sessionId, liveSeq, async () => {
          const query = usageCtx.get('sessionQuery') as
            { readSession?: (id: string) => Promise<{ events?: readonly unknown[] } | undefined> } | undefined
          const snapshot = typeof query?.readSession === 'function' ? await query.readSession(sessionId) : undefined
          return Array.isArray(snapshot?.events) ? snapshot.events : []
        })

        // ── 2) 逐 route 计价 ────────────────────────────────────────────────────
        // 档位来自折叠结果（**每条用量事件自己的时间**，含价格历史档），单价来自
        // 用户覆盖价 > 官方刊例价（历史档）/ 同步来的第三方价目，认不出就是"未定价"。
        // 计价放在宿主半是刻意的：这样"折叠规则 → 分档 → 单价"只有一处，胶囊与面板
        // （以及 `test/*.mjs`）看到的是同一份数字，不会各算各的。
        const overrides = readOverrides()
        await loadProviders()
        const routes = fold.routes.map(item => {
          const resolved = resolvePrice(item.model, {
            provider: item.provider,
            peak: item.peak,
            era: item.era,
            overrides,
            providers: moneyRules.providers,
          })
          const parts = costPartsOf(costBucketsOf(item.usage), resolved.prices)
          return {
            ...item,
            cost: parts.total,
            parts,
            /** 这一条实际用的单价（界面要原样显示"按什么价算的"）。 */
            price: resolved.prices,
            priceCurrency: resolved.currency,
            priceSource: resolved.source,
            priceEra: resolved.era,
            overridden: resolved.overridden,
            unpriced: resolved.unpriced,
            /** 单价来自**内置快照**（没点过同步时的兜底）：界面会如实标明。 */
            priceBuiltin: resolved.builtin,
          }
        })
        const cost = routes.reduce(
          (sum, item) => ({
            miss: sum.miss + item.parts.miss,
            hit: sum.hit + item.parts.hit,
            out: sum.out + item.parts.out,
            total: sum.total + item.cost,
          }),
          { miss: 0, hit: 0, out: 0, total: 0 },
        )
        sendJson(res, 200, {
          ok: true,
          sessionId,
          source,
          // 诊断字段：分列出不来时，界面靠 events/samples 区分"没事件"和"事件形状不对"。
          events: fold.events,
          samples: fold.samples,
          total: fold.total,
          /** 高峰 / 空闲两档的小计（界面按档显示，也是"逐笔准时"看得见的地方）。 */
          tiers: fold.tiers,
          routes,
          cost,
          /**
           * 生效的节假日表（北京日期）。客户端算"下一次峰谷切换"用的是**同一份**规则
           * —— 两边各拿一份自己的表就会出现"胶囊说还有 3 分钟进峰、面板说不是"这种
           * 无法解释的分歧，所以由宿主半回给客户端。
           */
          holidays: moneyRules.holidays,
        })
      })()
    }

    usageCtx.effect(() => usageCtx.webServer.register({
      kind: 'exact',
      path: USAGE_API_PATH,
      handler: handle as never,
    }), 'composer-ux: usage route')
  })

  // ── 金额：官方价同步 + 第三方价目（models.dev）（0.10.0）────────────────────
  //
  // 两条**独立**的同步路径，因为代价差两个数量级：
  //   · `official`：官方价格页两页各约 24 KB，秒级；同步到的数若与当前档不同，
  //     **新增一个从"这次同步时刻"起生效的价格档**（绝不改编译进去的那三档 ——
  //     改它等于把历史账重算）。
  //   · `modelsDev`：models.dev 的 `api.json` 5.2 MB，压成 450 KB 落盘
  //     （`$DSH_HOME/storages/composer-ux/prices.json`），设置里只记"什么时候同步的、多少条"。
  //
  // 两条路都遵守同一条纪律：**失败绝不覆盖本地价**（见 price-sync.ts 文件头）。
  ctx.inject(['webServer', 'settings'], (syncCtx) => {
    const sendJson = (
      res: { writeHead: (code: number, headers: Record<string, string>) => void; end: (body: string) => void },
      code: number,
      payload: unknown,
    ): void => {
      res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(payload))
    }
    const readBody = async (req: AsyncIterable<unknown>): Promise<string> => {
      const chunks: Buffer[] = []
      let total = 0
      for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
        total += buffer.length
        if (total > 64_000) break
        chunks.push(buffer)
      }
      return Buffer.concat(chunks).toString('utf8')
    }
    const settingsService = (): {
      mutate?: (ns: string, ops: readonly unknown[]) => Promise<unknown>
    } | undefined => syncCtx.get('settings') as never

    /** 读本插件那一行：走 `makeReader`（0.1.7 没有 `get`，见用量路由里那段说明）。 */
    const readOwn = makeReader(syncCtx.get('settings') as unknown as SettingsLike, config)

    /** 读当前同步元信息（认不出就是空对象）。 */
    const readSynced = (): Record<string, unknown> => {
      try {
        const synced = readOwn(NAMESPACE)?.[SYNCED_PRICES_FIELD]
        return typeof synced === 'object' && synced !== null ? { ...(synced as Record<string, unknown>) } : {}
      } catch {
        return {}
      }
    }

    /** 把同步元信息写回设置（写不进去就如实回报 —— 界面上的"已同步"不能是假的）。 */
    const writeSynced = async (next: Record<string, unknown>): Promise<boolean> => {
      const service = settingsService()
      if (typeof service?.mutate !== 'function') return false
      try {
        await service.mutate(NAMESPACE, [{ op: 'set', path: [SYNCED_PRICES_FIELD], value: next }])
        return true
      } catch (error: unknown) {
        console.warn('[composer-ux] 价目同步元信息写入失败', error)
        return false
      }
    }

    /**
     * 同步一次**官方价**（路由与自动同步共用同一份逻辑 —— 两处各写一遍迟早分叉）。
     *
     * 纪律（与 `price-sync.ts` 文件头一致）：抓不到、解析不出都**什么都不改**；
     * 数与当前生效档不同就**新增一个档**（绝不原地改档，那等于把历史账重算）。
     * @returns 直接可以回给界面的结果对象（`message` 是给用户看的一句话）。
     */
    const syncOfficial = async (): Promise<{
      ok: boolean
      changed?: boolean
      fetchedAt?: number
      era?: { readonly id: string; readonly label: string; readonly models: readonly string[] }
      saved?: boolean
      message: string
      error?: string
    }> => {
      const pages = await fetchOfficialPages()
      if (pages === undefined) {
        return { ok: false, message: '抓官方价格页失败', error: '抓取官方价格页失败（网络不可达或页面改版），本地价目未改动' }
      }
      const fetchedAt = Date.now()
      const era = eraFromOfficial(pages.cny, pages.usd, fetchedAt, '一键同步：https://api-docs.deepseek.com/zh-cn/quick_start/pricing')
      if (era === undefined) {
        return { ok: false, message: '官方页解析不出价格', error: '官方价格页解析不出价格（页面结构可能变了），本地价目未改动' }
      }
      const synced = readSynced()
      const existing = parsePriceEras(synced.eras) ?? []
      const currentTable = eraAt(fetchedAt, existing).table
      if (samePriceTable(currentTable, era.table)) {
        const saved = await writeSynced({ ...synced, fetchedAt })
        if (saved) invalidateMoney()
        return { ok: true, changed: false, fetchedAt, saved, message: '官方价与当前生效的档位一致，没有新增价格档' }
      }
      // 新档只保留最近 20 个：设置文档不该无限长，而"比 20 次调价还早"的档
      // 早就在编译进去的三档里了。
      const eras = [...existing, era].slice(-20)
      const saved = await writeSynced({ ...synced, fetchedAt, eras })
      if (saved) invalidateMoney()
      if (!saved) {
        return { ok: false, message: '设置服务不可写', error: '设置服务不可写，新价格档没有保存（本地价目未改动）' }
      }
      return {
        ok: true,
        changed: true,
        fetchedAt,
        era: { id: era.id, label: era.label, models: Object.keys(era.table) },
        saved,
        message: `官方价有变化，已新增价格档「${era.label}」（${Object.keys(era.table).join('、')}）；历史用量仍按发生时刻的旧档结算`,
      }
    }

    /** 同步一次**第三方价目**（models.dev，约 5.2 MB → 压缩后 450 KB 落盘）。 */
    const syncModelsDev = async (): Promise<{
      ok: boolean
      providers?: number
      models?: number
      fetchedAt?: number
      saved?: boolean
      message: string
      error?: string
    }> => {
      const providers = await fetchModelsDevPrices()
      if (providers === undefined) {
        // 纪律 1：抓不到就是抓不到，磁盘上那份原样不动。
        return { ok: false, message: '抓取 models.dev 失败', error: '抓取 models.dev 失败（网络不可达或响应异常），本地第三方价目未改动' }
      }
      const fetchedAt = Date.now()
      let models = 0
      for (const table of Object.values(providers)) models += Object.keys(table).length
      try {
        await writePriceFile({ fetchedAt, providers })
      } catch (error: unknown) {
        return {
          ok: false,
          message: '价目写盘失败',
          error: `价目写盘失败：${error instanceof Error ? error.message : String(error)}`,
        }
      }
      invalidateProviderPrices()
      const saved = await writeSynced({ ...readSynced(), modelsDevAt: fetchedAt, modelsDevCount: models })
      invalidateMoney()
      return {
        ok: true,
        providers: Object.keys(providers).length,
        models,
        fetchedAt,
        saved,
        message: `已同步 ${Object.keys(providers).length} 个 provider / ${models} 个模型的价目${saved ? '' : '（设置里没记下时间戳：设置服务不可写）'}`,
      }
    }

    /**
     * **获取一次法定节假日**（0.11.0）：每年一个 JSON，只取 `isOffDay:true` 的日期。
     *
     * 纪律（与 `holiday-sync.ts` 文件头一致）：
     *  · **补班日不参与**（`isOffDay:false` 的条目直接丢掉）—— 官方公告说的是"周六、周日
     *    全天谷价"，补班日仍是周六/周日（2026-09-29 用户拍板）；
     *  · **抓不到就什么都不改**（年份全失败 = `ok:false`，本地表原样不动）；
     *  · **"还没公布"不是失败**（次年那份文件现在只有 `{"year":2027}`），界面上要说成
     *    "还没公布"，不能让用户以为网络坏了；
     *  · **年份只增不减**（并进已有表，见 `mergeHolidayDays`）。
     *
     * 到期判定交给纯函数 `holidaySyncDue`（"该不该出网"必须能单独钉住）：自动这条路
     * **只有开关真开着**且该年份没数据 / 距上次获取够 30 天才会发请求；用户在设置页点
     * 「立即获取」走 `force`，因为那一年可能刚公布而复核窗口还没到。
     *
     * @param options.force 忽略到期判定，强制抓"今年 + 明年"（设置页按钮 / 同步接口）。
     * @returns 直接可以回给界面的结果对象（`message` 是给用户看的一句话）。
     */
    const syncHolidays = async (options: { force?: boolean } = {}): Promise<{
      ok: boolean
      changed?: boolean
      days?: number
      years?: readonly number[]
      fetchedAt?: number
      saved?: boolean
      message: string
      error?: string
    }> => {
      const synced = readSynced()
      const have = parseHolidayYears(synced.holidayYears) ?? []
      const now = Date.now()
      let years: readonly number[]
      if (options.force === true) {
        years = holidayYearsWanted(now)
      } else {
        let enabled: unknown = false
        try {
          enabled = readOwn(NAMESPACE)?.[PRICE_AUTO_SYNC_FIELD]
        } catch {
          /* 设置读不到 = 当没开（绝不在"读不到开关"时出网） */
        }
        years = holidaySyncDue({ enabled, nowMs: now, yearsHave: have, lastAt: synced.holidaysAt })
      }
      if (years.length === 0) {
        return { ok: true, changed: false, message: '节假日表刚获取过，这次不用再拉' }
      }
      const result = await fetchHolidayYears(years)
      // 纪律 2：一年都没拿到（网络不可达、响应形状不对、两个入口都失败）→ 什么都不改。
      if (result.fetched.length === 0 && result.unpublished.length === 0) {
        return {
          ok: false,
          message: '抓取节假日失败',
          error: `抓取 ${years.join('、')} 年的节假日失败（两个数据源都没拿到），本地节假日表未改动`,
        }
      }
      const merged = mergeHolidayDays(synced.holidays, result.days)
      const yearsNext = [...new Set([...have, ...result.fetched])].sort((left, right) => left - right).slice(-12)
      const fetchedAt = Date.now()
      const saved = await writeSynced({
        ...synced,
        ...(merged === undefined ? {} : { holidays: merged }),
        holidaysAt: fetchedAt,
        holidayYears: yearsNext,
      })
      if (!saved) {
        // 写不进去 = 生效表其实没变，不能报成功（否则界面上"已获取"是假的）。
        return {
          ok: false,
          message: '设置服务不可写',
          error: '设置服务不可写，节假日表没有保存（本地节假日表未改动）',
        }
      }
      invalidateMoney()
      const parts: string[] = []
      if (result.fetched.length > 0) {
        parts.push(`已获取 ${result.fetched.join('、')} 年的法定节假日（当前生效 ${merged?.length ?? 0} 个日期，来源 ${HOLIDAY_SOURCE_LABEL}）`)
      }
      if (result.unpublished.length > 0) {
        parts.push(`${result.unpublished.join('、')} 年的安排还没公布（国务院年底才发，之后会自动再取）`)
      }
      if (result.failed.length > 0) {
        parts.push(`${result.failed.join('、')} 年没取到（网络或数据源问题，下次复核再试）`)
      }
      return {
        ok: true,
        changed: result.fetched.length > 0,
        days: merged?.length ?? 0,
        years: yearsNext,
        fetchedAt,
        saved,
        message: parts.join('；'),
      }
    }

    /**
     * **自动同步官方价**（0.10.0，默认关）：每天最多一次。
     *
     * 节奏：进程启动时先查一次，之后每 {@link AUTO_SYNC_CHECK_MS} 分钟查一次
     * "距上次成功同步是否够 {@link AUTO_SYNC_STALE_MS}"。为什么不是"设一个 24 小时的定时器"：
     * 桌面版随时可能被关掉/重启，定时器会永远等不到点火；按"到期就补"的写法，
     * 无论进程活了多久，只要开了开关且距上次同步超过一天，下一次检查就会补上。
     *
     * 0.11.0 起同一个 tick 里还管**节假日**（`syncHolidays`，每个年份最多 30 天复核一次）：
     * 两件事共用一把开关（"这个插件可以自己出网"），也共用同一次检查。
     *
     * 失败只写日志：界面上仍显示"上次成功同步的时间"，不会因为一次网络抖动假装同步过。
     */
    const AUTO_SYNC_CHECK_MS = 30 * 60_000
    const autoSyncIfDue = async (): Promise<void> => {
      try {
        const own = readOwn(NAMESPACE) ?? {}
        // 该不该出网由纯函数判定（见 price-sync.ts 的 autoSyncDue）：只有开关真开着、
        // 且距上次成功同步够久才会发请求。
        const due = autoSyncDue({
          enabled: own[PRICE_AUTO_SYNC_FIELD],
          fetchedAt: readSynced().fetchedAt,
          nowMs: Date.now(),
          staleMs: AUTO_SYNC_STALE_MS,
        })
        if (due) {
          const result = await syncOfficial()
          console.log(`[composer-ux] 自动同步官方价${result.ok ? '成功' : '失败'}：${result.message}`)
        }
      } catch (error: unknown) {
        // 自动同步绝不能让插件炸掉：这一轮失败，下一轮（30 分钟后）再来。
        console.warn('[composer-ux] 自动同步官方价异常', error)
      }
      // 节假日单独一段 try：它失败不该吞掉上面那次价格同步的结果，反之亦然。
      try {
        const holiday = await syncHolidays()
        if (holiday.changed === true) console.log(`[composer-ux] 自动获取节假日：${holiday.message}`)
      } catch (error: unknown) {
        console.warn('[composer-ux] 自动获取节假日异常', error)
      }
    }
    syncCtx.effect(() => {
      const timer = setInterval(() => { void autoSyncIfDue() }, AUTO_SYNC_CHECK_MS)
      void autoSyncIfDue()
      return () => { clearInterval(timer) }
    }, 'composer-ux: 官方价与节假日自动同步（默认关）')

    const handle = (
      req: { method?: string; url?: string } & AsyncIterable<unknown>,
      res: { writeHead: (code: number, headers: Record<string, string>) => void; end: (body: string) => void },
    ): void => {
      const method = (req.method ?? 'GET').toUpperCase()
      if (method !== 'POST' && method !== 'GET') {
        sendJson(res, 405, { ok: false, error: '只接受 GET / POST' })
        return
      }
      // 官方信任关卡（见 rejectUntrustedRequest）：这条会出网、会写设置，必须挡在最前面。
      if (rejectUntrustedRequest(syncCtx as never, req, res)) return
      void (async (): Promise<void> => {
        let target = ''
        try {
          const url = typeof req.url === 'string' ? req.url : ''
          const queryAt = url.indexOf('?')
          const params = new URLSearchParams(queryAt < 0 ? '' : url.slice(queryAt + 1))
          target = params.get('target') ?? ''
          if (method === 'POST') {
            const body = await readBody(req)
            if (body.length > 0) {
              const parsed: unknown = JSON.parse(body)
              const wanted = (parsed as { target?: unknown } | null)?.target
              if (typeof wanted === 'string' && wanted.length > 0) target = wanted
            }
          }
        } catch {
          /* 请求体不是 JSON：按 target 为空处理，下面如实报错 */
        }
        if (target !== 'official' && target !== 'modelsDev' && target !== 'holidays') {
          sendJson(res, 400, { ok: false, error: 'target 必须是 official、modelsDev 或 holidays' })
          return
        }
        // 三条路各一个函数（自动同步走的是同一个 `syncOfficial` / `syncHolidays`），
        // 这里只负责回话。节假日那条是用户点的，所以走 `force`（不看 30 天的复核窗口）。
        const result = target === 'modelsDev'
          ? await syncModelsDev()
          : target === 'holidays'
            ? await syncHolidays({ force: true })
            : await syncOfficial()
        sendJson(res, 200, { target, ...result })
      })()
    }

    syncCtx.effect(() => syncCtx.webServer.register({
      kind: 'exact',
      path: SYNC_API_PATH,
      handler: handle as never,
    }), 'composer-ux: price sync route')
  })

  // ── 金额：DeepSeek 账号余额（0.10.0）─────────────────────────────────────
  //
  // 为什么必须在宿主半：官方 `GET /user/balance` 要带 `Authorization: Bearer <Key>`，
  // 而 Key 只该活在宿主侧。客户端只收到**解析好的数字**（见 `balance.ts`）。
  //
  // 三条纪律（都在这里落地）：
  //   1. **端点白名单**：baseURL 不是 `api.deepseek.com` 就**不发请求**（用户把 baseURL
  //      指向第三方时，照它拼 URL 再把 Bearer 发出去等于把 Key 交出去）；
  //   2. **Key 从凭据服务按引用解析**：`llm-deepseek` 那一行的 `apiKeyEnv`
  //      （默认 `DEEPSEEK_API_KEY`）→ `credentials.resolve(ref)`，与官方适配器同一条路；
  //   3. **失败如实回报**：Key 没配、凭据服务缺席、网络失败 —— 各回各的话，
  //      绝不用 0 或旧值冒充余额（`parseBalancePayload` 也是这个态度）。
  ctx.inject(['webServer', 'settings'], (balanceCtx) => {
    const sendJson = (
      res: { writeHead: (code: number, headers: Record<string, string>) => void; end: (body: string) => void },
      code: number,
      payload: unknown,
    ): void => {
      res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(payload))
    }
    const read = makeReader(balanceCtx.get('settings') as unknown as SettingsLike, config)

    /** 取 DeepSeek 的 API Key；任何一步不成立都回一句人话（不抛给路由）。 */
    const resolveKey = async (): Promise<{ readonly key: string } | { readonly error: string }> => {
      const row = read(LLM_DEEPSEEK_NAMESPACE) ?? {}
      const baseUrl = typeof row.baseURL === 'string' && row.baseURL.length > 0 ? row.baseURL : DEEPSEEK_BALANCE_URL
      if (!balanceEndpointAllowed(baseUrl)) {
        // ⚠️ 只回 hostname，不回 baseURL 原文：用户可能在那里塞了 query/userinfo 之类的东西，
        // 把它原样送到浏览器等于多开一条泄露面（2026-09-29 采纳的评审意见）。
        let hostname = '(解析不出主机名)'
        try {
          hostname = new URL(baseUrl).hostname
        } catch {
          /* 解析不出就保持占位文案 */
        }
        return { error: `llm-deepseek 的 baseURL 主机是 ${hostname}，不是官方 api.deepseek.com，拒绝把 API Key 发出去；请改回官方端点再查余额` }
      }
      const ref = typeof row.apiKeyEnv === 'string' && row.apiKeyEnv.length > 0 ? row.apiKeyEnv : 'DEEPSEEK_API_KEY'
      // 凭据引用必须是合法环境变量名，否则 `credentials.resolve` 内部会抛 TypeError
      // （`credentials/src/index.ts` 的 `credentialRef`）—— 先自己挡住，回一句人话。
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(ref)) {
        return { error: `llm-deepseek 的 apiKeyEnv「${ref}」不是合法的环境变量名，改成一个合法名字（例如 DEEPSEEK_API_KEY）` }
      }
      const credentials = balanceCtx.get('credentials') as
        { resolve?: (name: string) => Promise<{ readonly value?: unknown } | undefined> } | undefined
      if (typeof credentials?.resolve !== 'function') {
        return { error: '宿主没有凭据服务，读不到 API Key（把 DEEPSEEK_API_KEY 放进环境变量也不行：没有服务就没人去读它）' }
      }
      try {
        const resolved = await credentials.resolve(ref)
        const key = typeof resolved?.value === 'string' ? resolved.value : ''
        if (key === '') return { error: `凭据 ${ref} 没有配置，先在设置页把 DeepSeek 的 API Key 填上` }
        return { key }
      } catch (error: unknown) {
        return { error: `解析凭据 ${ref} 失败：${error instanceof Error ? error.message : String(error)}` }
      }
    }

    const handle = (
      req: { method?: string },
      res: { writeHead: (code: number, headers: Record<string, string>) => void; end: (body: string) => void },
    ): void => {
      const method = (req.method ?? 'GET').toUpperCase()
      if (method !== 'GET' && method !== 'POST') {
        sendJson(res, 405, { ok: false, error: '只接受 GET / POST' })
        return
      }
      // 官方信任关卡（见 rejectUntrustedRequest）：余额是账号级数据，**这条最不能漏**。
      if (rejectUntrustedRequest(balanceCtx as never, req, res)) return
      void (async (): Promise<void> => {
        // 开关关掉时连凭据都不去读（宿主侧也拦一道，别只靠界面）。
        const own = read(NAMESPACE) ?? {}
        if (own[BALANCE_ENABLED_FIELD] === false) {
          sendJson(res, 200, { ok: false, error: '余额查询已在设置里关闭' })
          return
        }
        const key = await resolveKey()
        if ('error' in key) {
          sendJson(res, 200, { ok: false, error: key.error })
          return
        }
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 10_000)
        try {
          // 白名单已保证主机是官方的，所以这里直接用常量端点（不按 baseURL 拼路径 ——
          // 官方的 baseURL 可能带 `/anthropic` 这类前缀，拼出来就不是余额接口了）。
          const response = await fetch(DEEPSEEK_BALANCE_URL, {
            headers: { accept: 'application/json', authorization: `Bearer ${key.key}` },
            signal: controller.signal,
          })
          if (response.ok !== true) {
            sendJson(res, 200, { ok: false, error: `官方余额接口返回 ${response.status}` })
            return
          }
          const payload: unknown = await response.json()
          const snapshot = parseBalancePayload(payload)
          if (snapshot === undefined) {
            sendJson(res, 200, { ok: false, error: '官方余额响应形状不对（解析不出余额，绝不用 0 冒充）' })
            return
          }
          sendJson(res, 200, { ok: true, available: snapshot.available, entries: snapshot.entries })
        } catch (error: unknown) {
          // 细节只写日志、不送到浏览器：这条请求带着 `Bearer`，虽然 Key 在请求头里、
          // 正常不会出现在 message 里，但"凭据相关的东西一个字都不出宿主"这条纪律
          // 值得用最保守的写法（评审意见，2026-09-29）。
          console.warn('[composer-ux] 查余额失败', error)
          sendJson(res, 200, { ok: false, error: '查余额失败（网络不可达或超时）；详情见 DSH 日志' })
        } finally {
          clearTimeout(timer)
        }
      })()
    }

    balanceCtx.effect(() => balanceCtx.webServer.register({
      kind: 'exact',
      path: BALANCE_API_PATH,
      handler: handle as never,
    }), 'composer-ux: balance route')
  })

  // ── 默认终端（Windows：把终端的 pwsh 换成 Git Bash）────────────────────────
  //
  // 机制：**按 agent 会话下发**。官方 `tools.restrict()` 在全局上下文会抛错
  // （"a context-global restriction would mask every agent"），所以压制 pwsh 必须发生在
  // 该 agent 自己的 scope 里；为了让"改完设置立刻生效"，这里在设置变化时遍历
  // `ctx.agents.list()` 对每个在跑会话重新下发（见 terminal/host.ts 的注释）。
  //
  // 平台：非 Windows 直接不接管（官方 bash 工具本来就在），只把状态如实回报给设置页。
  ctx.inject(['settings', 'webServer'], (termCtx) => {
    /** 采集工具运行所需的宿主服务；缺 subprocess 就没法跑命令（只降级为压制 pwsh）。 */
    const readToolDeps = (): BashToolDeps | undefined => {
      const subprocess = termCtx.get('subprocess')
      if (subprocess === undefined) return undefined
      const sandbox = termCtx.get('sandbox')
      const sandboxPolicy = termCtx.get('sandboxPolicy')
      const approval = termCtx.get('approval')
      const jobs = termCtx.get('jobs')
      const shellEnv = termCtx.get('shellEnv')
      return {
        subprocess: subprocess as never,
        ...(sandbox === undefined ? {} : { sandbox: sandbox as never }),
        ...(sandboxPolicy === undefined ? {} : { sandboxPolicy: sandboxPolicy as never }),
        ...(approval === undefined ? {} : { approval: approval as never }),
        ...(jobs === undefined ? {} : { jobs: jobs as never }),
        ...(shellEnv === undefined ? {} : { shellEnv: shellEnv as never }),
      }
    }
    // 终端子系统只用到「读自己这一行 + mutate」两件事，而读口按世代不同（见 makeReader），
    // 所以这里把它包成该子系统期望的 get/mutate 形状 —— terminal/host.ts 一行都不用改。
    installTerminalPolicy(
      termCtx as never,
      NAMESPACE,
      readView(termCtx.get('settings')) as never,
      readToolDeps,
    )
  })

  // ── 迁移：「快捷指令」栏对老用户保持开着（一次性写回文档）──────────────────
  //
  // 为什么这一栏不能只靠设置文档判断：0.3.0 起条目搬到了 `quick-prompts.json`，
  // **"用过快捷指令的人"和"从没碰过的人"的设置文档可以一模一样**（都是内置 9 条 + 默认档位），
  // 纯净函数那套"值不等于默认值"的判据在他身上会得出"没碰过 ⇒ 关"，把入口按钮收掉。
  // 所以这里读一次书本文件：有非内置内容 ⇒ 认定他在用 ⇒ 写回 `quickEnabled: true`。
  // 写回之后两端都只需要看那一个布尔，不必各自知道文件的存在。
  // **只在文档里还没有这个键时写**：用户明确关掉之后文档里就是 `false`，不会被重新打开。
  ctx.inject(['settings'], (migrateCtx) => {
    void (async () => {
      const service = migrateCtx.get('settings') as SettingsLike | undefined
      if (service === undefined) return
      const row = makeReader(service, config)(NAMESPACE)
      if (row === undefined || row[QUICK_ENABLED_FIELD] !== undefined) return
      try {
        const outcome = await readQuickBook(quickStorePath())
        if (outcome.kind !== 'ok' || !bookLooksCustom(outcome.book)) return
        await service.mutate(NAMESPACE, [
          { op: 'set', path: [QUICK_ENABLED_FIELD], value: true },
        ])
      } catch (error: unknown) {
        // 迁移失败不是致命错误：用户顶多在设置页手动打开这一栏。
        console.error('[composer-ux] quick section migration skipped', error)
      }
    })()
  })

  // ── 重启 DSH ──────────────────────────────────────────────────────────────
  //
  // 只有宿主进程能把自己重新拉起来（浏览器碰不到进程），DSH 也没有官方重启机制
  // （插件市场那边只说「更改将在下次启动生效」）。机制照搬插件市场：分离一个 node 助手
  // 进程 → 自己退出 → 助手等端口真的空出来 → 用隐藏控制台的 PowerShell 起新宿主 →
  // 20 秒内确认端口有人监听，没起来把诊断写进日志。细节与理由全在 `src/restart.ts`。
  //
  // 这一整块是**宿主半**，所以改完必须重启 DSH 才会生效（这也正是它要解决的问题）。
  ctx.inject(['webServer'], (restartCtx) => {
    /** 这次启动的标识：界面靠"号变了"判断新进程真的起来了。 */
    const BOOT_ID = bootId(process.pid, Date.now())
    /** 当前宿主是否处于"不该被从界面里杀掉"的状态。 */
    const blockedBy = (): string | null => {
      const supervisor = detectedSupervisor({
        env: process.env,
        ppid: process.ppid,
        parentComm: (pid) => {
          try {
            return readFileSync(`/proc/${String(pid)}/comm`, 'utf8').trim()
          } catch {
            // /proc 只在 Linux 上有；读不到就说明"不是 systemd 的主进程"。
            return null
          }
        },
      })
      if (supervisor !== null) return `supervised:${supervisor}`
      if (detectedDebugger({
        inspectorUrl: inspector.url(),
        execArgv: process.execArgv,
        nodeOptions: process.env.NODE_OPTIONS,
      }) !== null) return 'debugger'
      return null
    }
    /** 组装注入面（真实实现；测试里换假的）。 */
    const buildIo = (): RestartIo => ({
      platform: process.platform,
      pid: process.pid,
      argv0: process.argv0,
      execPath: process.execPath,
      argv1: process.argv[1],
      execArgv: process.execArgv,
      // argv[0] 是 node 自己、argv[1] 是入口；重放的是"入口 + 之后的参数"。
      rest: process.argv.slice(2),
      cwd: process.cwd(),
      env: process.env,
      tmpdir: tmpdir(),
      stamp: new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19),
      exists: (path) => existsSync(path),
      resolve: (path) => resolve(path),
      dirname: (path) => dirname(path),
      join: (...parts) => join(...parts),
      spawn: (command, args, options) => spawn(command, [...args], {
        detached: options.detached,
        stdio: options.stdio,
        windowsHide: options.windowsHide,
        env: options.env as NodeJS.ProcessEnv,
      }),
      stop: () => {
        gracefulStop({
          emitSignal: (signal) => { process.emit(signal as 'SIGTERM') },
          exit: (code) => { process.exit(code) },
          timer: (ms, run) => { setTimeout(run, ms) },
        })
      },
      wait: (ms) => new Promise<void>((done) => { setTimeout(done, ms) }),
    })
    /** 已经排过一次重启：防止界面重复点 / 两个标签页同时点。 */
    let restarting = false
    /** GET 只读展示：会怎么重启、日志落在哪。 */
    const planForDisplay = (): { command: string; execPath: string; logHint: string } => {
      const io = buildIo()
      const plan = planRestart(io, null)
      return {
        command: [plan.respawn.file, ...plan.respawn.args].join(' '),
        execPath: plan.node,
        logHint: join(io.tmpdir, `${RESTART_LOG_PREFIX}*.err.log`),
      }
    }

    restartCtx.effect(() => restartCtx.webServer.register({
      kind: 'exact',
      path: RESTART_API_PATH,
      handler: (req: {
        method?: string
        headers?: Readonly<Record<string, string | readonly string[] | undefined>>
        socket?: { remoteAddress?: string }
      }, res: {
        statusCode?: number
        writeHead: (code: number, headers: Record<string, string>) => void
        end: (body?: string) => void
      }): void => {
        const send = (code: number, payload: unknown): void => {
          res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
          res.end(JSON.stringify(payload))
        }
        // 第一道：官方那道信任关卡（本机 webServer 绑 0.0.0.0：Host/Origin 围栏 + 浏览器令牌）。
        // 与另外两条路由一致，先问它，被拒就直接结束。
        const connection = restartCtx.get('connection') as
          { requestRejection?: (request: unknown) => number | undefined } | undefined
        const rejection = connection?.requestRejection?.(req)
        if (rejection !== undefined) {
          res.statusCode = rejection
          res.end()
          return
        }

        const agents = restartCtx.get('agents') as { list?: () => readonly unknown[] } | undefined
        const running = agents?.list?.().length ?? 0
        const blocked = blockedBy()
        const method = (req.method ?? 'GET').toUpperCase()

        if (method !== 'GET' && method !== 'POST') {
          res.writeHead(405, { allow: 'GET, POST' })
          res.end()
          return
        }
        if (method === 'GET') {
          const plan = planForDisplay()
          send(200, { ok: true, ...plan, running, blocked, boot: BOOT_ID })
          return
        }

        // 第二道：这是"杀进程"的接口，所以额外要求请求确实来自本机同源页面 ——
        // 回环 peer、无转发痕迹、Origin 与 Host 同源。跨站页面一定带自己的 Origin，挡在这里。
        if (!trustedRestartRequest({
          remoteAddress: req.socket?.remoteAddress,
          headers: req.headers ?? {},
        })) {
          send(403, { ok: false, error: 'restart is limited to same-origin loopback requests' })
          return
        }
        if (blocked !== null) {
          send(403, { ok: false, error: blocked === 'debugger'
            ? 'self-restart is disabled while the host is under a debugger'
            : `restart belongs to the ${blocked.slice('supervised:'.length)} supervisor on this host` })
          return
        }
        if (restarting) {
          send(409, { ok: false, error: 'restart already scheduled' })
          return
        }
        restarting = true
        try {
          const scheduled = scheduleRestart(buildIo(), servingPort(firstHeaderValue(req.headers?.host)))
          // `ok` 由 `scheduled` 自己带（写在前面的会被展开覆盖 —— typecheck 直接指出来了）。
          send(202, { boot: BOOT_ID, running, ...scheduled })
        } catch (error: unknown) {
          restarting = false
          send(500, { ok: false, error: error instanceof Error ? error.message : String(error) })
        }
      },
    }), 'composer-ux: restart route')
  })
}
