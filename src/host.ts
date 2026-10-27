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
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import inspector from 'node:inspector'
import {
  ALL_SETTINGS_FIELDS, AUTOSTART_API_PATH, DOCTOR_API_PATH,
  DEFAULT_HEADER_NAME, DEFAULT_QUICK_PROMPTS, DEFAULT_SETTINGS, ENABLED_FIELD,
  KEYS_ENABLED_FIELD, MENU_ENABLED_FIELD, PANEL_ENABLED_FIELD, QUICK_ENABLED_FIELD,
  TERMINAL_ENABLED_FIELD,
  HEADER_APPLIED_NAME_FIELD,
  HEADER_APPLIED_VALUE_FIELD, HEADER_CLEANUP_FIELD, HEADER_ENABLED_FIELD, HEADER_NAME_FIELD, HEADER_NAME_MAX,
  HEADER_ROUTES_FIELD, HEADER_STATUS_FIELD, HEADER_VALUE_FIELD, HEADER_VALUE_MAX,
  LLM_NAMESPACE, MENU_FIELDS, MENU_MODE_FIELD, MENU_NATIVE_FIELD, NAMESPACE, NEWLINE_KEY_FIELD,
  NATIVE_STATUS_PREFIX,
  OPENCODE_HOSTS, OPENCODE_ROUTE_PREFIX, OPTIMIZE_OUTPUT_MAX, OPTIMIZE_TEXT_MAX,
  OPTIMIZE_BASH_FIELD, OPTIMIZE_KEEP_DOCK_FIELD, OPTIMIZE_READ_TOOLS_FIELD, OPTIMIZE_STATE_API_PATH,
  MODELS_API_PATH,
  RESTART_CSRF_HEADER, RESTART_CSRF_VALUE,
  NOTIFY_TEST_API_PATH,
  OPTIMIZER_FRAMING_FIELD, OPTIMIZER_HISTORY_FIELD, OPTIMIZER_MODEL_FIELD, OPTIMIZER_PERMISSION_FIELD,
  normalizeOptimizerTurns,
  OPTIMIZER_TURNS_FIELD,
  LEGACY_OPTIMIZER_PROMPT_FIELDS,
  OPTIMIZER_API_PATH, OPTIMIZER_CONTEXT_FIELD, OPTIMIZER_LEDGER_FIELD, OPTIMIZER_PROMPT_FIELDS, OPTIMIZER_TIER_FIELD, PANEL_HEIGHT_FIELD, PANEL_RESIZE_FIELD,
  PANEL_WIDTH_FIELD, PRICE_OVERRIDES_FIELD, QUICK_PROMPTS_API_PATH, QUICK_PROMPTS_FIELD,
  RESTART_API_PATH,
  SEND_KEY_FIELD, defaultQuickBook, newSessionId, optimizerPromptFieldOf, parseRouteList, sanitizeBook, DEFAULT_OPTIMIZER_TIER,
  splitSlashCommand,
  STATS_ENABLED_FIELD,
  USAGE_API_PATH,
  QUOTA_API_PATH,
  SYNC_API_PATH,
  BALANCE_ENABLED_FIELD, DEFAULT_PEAK_ALERT, HOLIDAY_SOURCE_LABEL, PEAK_ALERT_FIELD, PEAK_HOLIDAYS_FIELD,
  PRICE_AUTO_SYNC_FIELD, SYNCED_PRICES_FIELD, parseHolidayYears,
  NOTIFY_ENABLED_FIELD, NOTIFY_CHANNEL_FIELD, NOTIFY_PUSHPLUS_FIELD, NOTIFY_WECOM_FIELD, NOTIFY_KINDS_FIELD,
  DIRECTORY_PICK_ENABLED_FIELD,
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
import { createNotifyTestHandler } from './notify-route.ts'
import { registerNotifyHooks } from './notify-hooks.ts'
import { sendNotification, type NotifyIo } from './notify-send.ts'
import { sanitizeSettings } from './settings-contract.ts'
import type { NotifyEvent, NotifySettings } from './notify.ts'
import {
  BALANCE_API_PATH, DEEPSEEK_BALANCE_URL, balanceEndpointAllowed, parseBalancePayload,
} from './balance.ts'
import { nativeSessionHeader, resetNativeSessionHeaderCache } from './opencode-header.ts'
import {
  SUBSCRIPTION_PLANS, degradeQuota, planOf, parseQuotaPayload, quotaCostOf,
  type PlanQuotaSnapshot, type QuotaCost, type SubscriptionPlan,
} from './subscription-plans.ts'
import {
  addBuckets, createUsageCache, zeroBuckets,
  type SessionUsageFold, type SubagentChildRef, type UsageTier,
} from './usage-fold.ts'
import {
  TERMINAL_BASH_PATH_FIELD, TERMINAL_CANDIDATES_FIELD, TERMINAL_EFFECTIVE_FIELD,
  TERMINAL_MODE_FIELD, TERMINAL_STATUS_FIELD,
} from './terminal/contracts.ts'
import { installTerminalPolicy } from './terminal/host.ts'
import type { BashToolDeps } from './terminal/tool.ts'
import {
  RESTART_LOG_PREFIX, bootId, detectedDebugger, detectedSupervisor, gracefulStop, launchCommand, nodeExecutableOf,
  planRestart, explainRestartTrust, restartTrustText, scheduleRestart, servingPort,
} from './restart.ts'
import type { RestartIo } from './restart.ts'
import { buildOptimizeSystem, buildOptimizeTemperature, buildOptimizeUser, optimizePromptSource } from './optimizer-prompt.ts'
import { runOptimizePipeline, scanOptimizeStream } from './optimizer-assemble.ts'
import { appendLedger, buildLedgerRun } from './optimize-ledger.ts'
import { clearDockState, dockStateBytes, optimizeStatePath, readDockState, writeDockState } from './optimize-state.ts'
import { runOptimizeToolLoop } from './optimize-tool-loop.ts'
import { BASH_TOOL_SYSTEM_NOTE, resolveBashAuthority, type BashAuthority } from './optimize-bash.ts'
import { READ_TOOLS_SYSTEM_NOTE } from './optimize-tools.ts'
import { contextBlock, contextWithinBudget, recentTurns } from './prompt-context.ts'
import { ensureQuickBook, quickStorePath, readQuickBook, writeQuickBook } from './quick-store.ts'
import { pendingMigrations } from './migrations.ts'
import {
  addArgs, deleteArgs, describeAutostart, listArgs, parseQueryValue, planAutostart, queryArgs, runtimeOf, unsupportedReason,
  type AutostartFacts, type AutostartPlan, type AutostartRuntime, type AutostartState,
} from './autostart.ts'
import { buildDoctorReport, type DoctorInput } from './doctor.ts'
import { retryWrite, STARTUP_WRITE_ATTEMPTS, STARTUP_WRITE_RETRY_MS } from './retry-write.ts'
import { profileDirOfPatchPath, recoverStaleSettingsLock } from './settings-lock.ts'

export const name = 'composer-ux'

/**
 * 「请求头运行期覆盖」挂上没有（0.22.0 自检要读它）。
 *
 * ⚠️ 必须是**共享的可变对象**，不能是"装完抄一份到另一个变量"：注入回调（loader）与自检
 * 路由（webServer）哪个先跑是不确定的 —— 2026-10-13 真机就是这么读到一份陈旧值，
 * 报告里写"覆盖没挂上"，而它其实挂上了。共享同一个对象，读到的永远是当下。
 */
const headerOverlayState = { installed: false }

/** 设置面板可调尺寸的上下限（与 client 侧的 clamp 保持一致）。 */
const PANEL_MIN = 560
const PANEL_MAX = 4000

export { retryWrite, STARTUP_WRITE_ATTEMPTS, STARTUP_WRITE_RETRY_MS } from './retry-write.ts'

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

/**
 * 读一个**数字**字段（与 `readOwnFlag` 同一套兜底：读不到/类型不对/抛错都回落）。
 *
 * 为什么单独要一个：上下文回合数是数字，而 `readOwnSetting` 走的是字符串口径。
 */
function readOwnNumber(scope: unknown, config: unknown, field: string, fallback: number): number {
  try {
    const get = (scope as { get?: (name: string) => unknown } | undefined)?.get
    if (typeof get !== 'function') return fallback
    const service = get.call(scope, 'settings') as SettingsLike | undefined
    const value = makeReader(service, config)(NAMESPACE)?.[field]
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback
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

/** 本次要注入的请求头（0.22.0 的纯函数产物）。 */
export type HeaderRequest =
  | { readonly kind: 'off' }
  | { readonly kind: 'invalid'; readonly reason: string }
  | { readonly kind: 'plan'; readonly name: string; readonly value: string; readonly routes: readonly string[] }

/**
 * 从本插件自己的设置里读出"这次要注入什么"（纯函数，便于逐格钉住）。
 *
 * 0.22.0 起这条链**只读不写用户配置**：它产出的是一份"运行期覆盖用的计划"，
 * 真正生效靠 `internal/config` 事件（见 {@link installHeaderOverlay}）。
 *
 * @param own - 本插件命名空间下的原始行。
 * @returns `off`（没开）/ `invalid`（开了但参数不合法，附原因）/ `plan`（可以注入）。
 */
export function readHeaderRequest(own: Record<string, unknown> | undefined): HeaderRequest {
  if (own === undefined) return { kind: 'off' }
  if (own[ENABLED_FIELD] !== true || own[HEADER_ENABLED_FIELD] !== true) return { kind: 'off' }
  const name = textOf(own[HEADER_NAME_FIELD])
  if (!nameIsValid(name)) return { kind: 'invalid', reason: '头名不合法' }
  const value = textOf(own[HEADER_VALUE_FIELD])
  if (!valueIsValid(value)) return { kind: 'invalid', reason: `头值不合法（需 1–${String(HEADER_VALUE_MAX)} 字符且单行）` }
  const routes = parseRouteList(textOf(own[HEADER_ROUTES_FIELD]))
  return { kind: 'plan', name, value, routes }
}

/** 在 pi-ai 那行的配置上挂上 `providers.<route>.headers.<name>`（不修改入参）。 */
function withHeaderOverlay(raw: unknown, request: Extract<HeaderRequest, { kind: 'plan' }>): unknown {
  const row = objectOf(raw)
  const providers = row === undefined ? undefined : objectOf(row.providers)
  if (row === undefined || providers === undefined) return raw
  const targets = pickRoutes(providers, request.routes)
  if (targets.length === 0) return raw
  const nextProviders: Record<string, unknown> = { ...providers }
  for (const route of targets) {
    const profile = objectOf(providers[route])
    if (profile === undefined) continue
    const headers = objectOf(profile.headers) ?? {}
    nextProviders[route] = { ...profile, headers: { ...headers, [request.name]: request.value } }
  }
  return { ...row, providers: nextProviders }
}

/**
 * 把「请求头」栏目改成**运行期可逆覆盖**（0.22.0，用户 2026-10-13 选定）。
 *
 * 为什么不再写配置：以前这条链把 `providers.<route>.headers.<name>` **写进用户的模型路由配置**，
 * 再靠记账 + 撤销去回滚 —— 那是本插件唯一会动用户配置的功能，风险面（写坏了、撤销漏了、
 * 用户自己又改了同一处）都由它承担。dsh-ops 的做法更克制：用官方 loader 的 `internal/config`
 * 事件在**配置被解析时**补上字段，从不落盘（`lib/session-pwsh.js`，注释写着
 * "never edits profile files or services"）。官方 `llm-pi-ai` 自己也是这么挂这个事件的。
 *
 * @param ctx - 插件上下文（只用来拿 loader 与挂事件）。
 * @param read - 本插件设置的读口。
 * @param onInstalled - 覆盖真的挂上之后回调一次（让状态行立刻从"没生效"变成真话）。
 * @returns 一个可读的安装状态：installed 字段供 {@link syncHeaderOverlay} 如实回报。
 */
function installHeaderOverlay(ctx: Context, read: ReadRow, onInstalled: () => void, state: { installed: boolean } = headerOverlayState): { installed: boolean } {
  // 能力探测：拿不到注入面就**什么都不做**（旧版服务、精简上下文、测试用的假 ctx）。
  // 失败方向安全 —— 状态行会说"没生效"，而不是把整个插件拖崩。
  const inject = (ctx as { inject?: unknown }).inject
  if (typeof inject !== 'function') return state
  try {
    ;(inject as (names: readonly string[], fn: (inner: unknown) => unknown) => unknown).call(ctx, ['loader'], (loaderCtx: unknown) => {
      const on = (loaderCtx as { on?: unknown } | undefined)?.on
      if (typeof on !== 'function') return
      ;(on as (event: string, fn: unknown) => unknown).call(
        loaderCtx,
        'internal/config',
        function (this: unknown, _raw: unknown, next: () => unknown): unknown {
          const raw = next()
          const request = readHeaderRequest(read(NAMESPACE))
          if (request.kind !== 'plan') return raw
          // 0.25.0：宿主自己会发（pi-ai 自带 opencode-headers.js、用每段对话的真实 session id）
          // 时**一律不注入** —— 补一个固定值只会把它顶掉（见 src/opencode-header.ts 文件头）。
          if (nativeSessionHeader().support === 'native') return raw
          // 只认"看着像 llm-pi-ai 那一行"的配置（有 providers）。这里不比较 fiber：
          // 事件是瀑布式派发，`this` 的形态跨版本会变，而"哪份配置里有 providers"足够精确 ——
          // 而且我们只往**已存在的路由**上补一个头，认错的代价是零。
          return withHeaderOverlay(raw, request)
        },
      )
      state.installed = true
      try {
        onInstalled()
      } catch (error: unknown) {
        console.error('[composer-ux] 请求头覆盖挂上后同步状态失败', error)
      }
      return () => { state.installed = false }
    })
  } catch (error: unknown) {
    console.error('[composer-ux] 运行期请求头覆盖挂不上（继续按未生效运行）', error)
  }
  return state
}

/**
 * 把「请求头」栏目的状态对齐到现实（0.22.0）。
 *
 * 干两件事，都**不碰用户配置**：
 *  1. 把状态写回**本插件自己的命名空间**（`headerStatus`），供设置页显示；
 *  2. **一次性**清理 0.21.x 及以前真的写进用户配置里的那些头（迁移表的第一条）。
 *
 * @param settings - settings 服务（用于写本插件自己的字段）。
 * @param read - 按命名空间读值的读口。
 * @param hasLoader - 运行期覆盖挂上没有（没有就没法生效，状态如实说）。
 */
async function syncHeaderOverlay(settings: SettingsLike, read: ReadRow, hasLoader: boolean): Promise<void> {
  const own = read(NAMESPACE)
  if (own === undefined) return
  // 0.25.0：宿主自己会发这个头时，生成 UUID 与记账都没有意义（注入会被跳过）。
  const native = nativeSessionHeader()
  // 首次启用且值是空的：生成一个稳定 ID，并写进**本插件自己的**命名空间（此前一直用它）。
  // 注意落点：这是 composer-ux 的字段，不是用户的模型路由配置 —— 后者 0.22.0 起一个字都不写。
  if (native.support !== 'native' && own[ENABLED_FIELD] === true && own[HEADER_ENABLED_FIELD] === true) {
    const name = textOf(own[HEADER_NAME_FIELD])
    if (nameIsValid(name) && textOf(own[HEADER_VALUE_FIELD]) === '') {
      const generated = newSessionId()
      await retryWrite(() => settings.mutate(NAMESPACE, [{ op: 'set', path: [HEADER_VALUE_FIELD], value: generated }]), STARTUP_WRITE_ATTEMPTS, STARTUP_WRITE_RETRY_MS)
      own[HEADER_VALUE_FIELD] = generated
    }
  }
  const request = readHeaderRequest(own)

  const llm = read(LLM_NAMESPACE)
  const providers = llm === undefined ? undefined : objectOf(llm.providers)
  const applied = request.kind === 'plan' && providers !== undefined
    ? pickRoutes(providers, request.routes)
    : []

  const status = native.support === 'native'
    // 宿主自己的实现按**每段对话的真实 id** 发；本栏注入的是固定值，所以什么都不做才对。
    ? `${NATIVE_STATUS_PREFIX}（${native.evidence}）：按每段对话的真实 session id 自动发送，本栏不再注入`
    : request.kind === 'off'
    ? ''
    : request.kind === 'invalid'
      ? `${request.reason}，未注入`
      : !hasLoader
        ? '没找到 loader 服务，运行期覆盖挂不上，未注入'
        : providers === undefined
          ? '未挂载 llm-pi-ai（模型路由）设置，暂未注入'
          : applied.length === 0
            ? `已启用，但没有匹配的路由（目标：${request.routes.length === 0 ? `自动（名字以 ${OPENCODE_ROUTE_PREFIX} 开头，或 baseURL 指向 opencode.ai）` : request.routes.join('、')}）`
            : `运行期注入 ${applied.join('、')}（只在本插件运行时生效，不改你的配置）`

  const ownOps: PathOp[] = []
  if (textOf(own[HEADER_STATUS_FIELD]) !== status) {
    ownOps.push({ op: 'set', path: [HEADER_STATUS_FIELD], value: status })
  }
  // 记账继续保留（改名/改值后清理要用），但含义从"写入成功"变成"运行期生效"。
  // 原生支持时不记账：什么都没注入，记账只会让状态行自相矛盾。
  const injected = native.support !== 'native' && request.kind === 'plan' && applied.length > 0
  const nextAppliedName = injected ? request.name : ''
  const nextAppliedValue = injected ? request.value : ''
  if (textOf(own[HEADER_APPLIED_NAME_FIELD]) !== nextAppliedName) {
    ownOps.push({ op: 'set', path: [HEADER_APPLIED_NAME_FIELD], value: nextAppliedName })
  }
  if (textOf(own[HEADER_APPLIED_VALUE_FIELD]) !== nextAppliedValue) {
    ownOps.push({ op: 'set', path: [HEADER_APPLIED_VALUE_FIELD], value: nextAppliedValue })
  }

  // 迁移（0.22.0 第 1 条）：把老版本**真的写进**用户配置的那些头删掉 —— 一次性，做完打标记。
  // 该不该跑由迁移表说了算（见 src/migrations.ts）：跑成功才写标记，失败下次启动重来。
  const headerCleanup = pendingMigrations(own).find(row => row.field === HEADER_CLEANUP_FIELD)
  if (headerCleanup !== undefined) {
    const stale = collectOursToClean(own, providers, request)
    try {
      if (stale.length > 0) await retryWrite(() => settings.mutate(LLM_NAMESPACE, stale), STARTUP_WRITE_ATTEMPTS, STARTUP_WRITE_RETRY_MS)
      ownOps.push({ op: 'set', path: [headerCleanup.field], value: headerCleanup.version })
    } catch (error: unknown) {
      // 清理失败不阻断：下次启动再来（标记没写进去就是"没完成"）。
      console.error('[composer-ux] 旧请求头清理失败', error)
    }
  }

  if (ownOps.length > 0) await retryWrite(() => settings.mutate(NAMESPACE, ownOps), STARTUP_WRITE_ATTEMPTS, STARTUP_WRITE_RETRY_MS)
}

/**
 * 找出"确实是我们写进去的"头，用来清理（0.22.0 一次性迁移）。
 *
 * 判据与老版本的撤销完全一致，**绝不误删用户自己写的**：值必须等于当前设置值或记账值。
 * @param own - 本插件当前设置行。
 * @param providers - 用户配置里的 providers 映射（可能缺席）。
 * @param request - 这次解析出来的注入计划（它的目标键不能被当成过期项）。
 * @returns 要 unset 的路径操作。
 */
function collectOursToClean(
  own: Record<string, unknown>,
  providers: Record<string, unknown> | undefined,
  request: HeaderRequest,
): PathOp[] {
  if (providers === undefined) return []
  const previousName = textOf(own[HEADER_APPLIED_NAME_FIELD])
  const previousValue = textOf(own[HEADER_APPLIED_VALUE_FIELD])
  const ours = new Set([textOf(own[HEADER_VALUE_FIELD]), previousValue])
  ours.delete('')
  // 与老版"撤销"的唯一区别：**没有豁免项** —— 老版要跳过"本轮的目标键"（那正是它要写的），
  // 而现在一个字节都不写，凡是值等于我们记账值、名字是我们用过的，都是该清的残留。
  const candidates = new Set([previousName, request.kind === 'plan' ? request.name : ''])
  candidates.delete('')
  const stale: PathOp[] = []
  for (const candidate of candidates) {
    for (const [route, profile] of Object.entries(providers)) {
      const headers = objectOf(objectOf(profile)?.headers)
      const current = headers?.[candidate]
      if (typeof current !== 'string' || !ours.has(current)) continue
      stale.push({ op: 'unset', path: ['providers', route, 'headers', candidate] })
    }
  }
  return stale
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
    // 迁移标记（0.22.0，本插件自己的字段）：0/未设置 = 0.21.x 写进用户配置的头还没清理。
    [HEADER_CLEANUP_FIELD]: z.number().required(false),
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
    // 0.14.0 优化选项卡片：协作基调 / 权限 / 模型 / 上下文模式 / 回合数 / 内置 Bash。
    // 枚举与数字都在读取层收窄（写坏了落回默认），schema 这层只保证类型不炸。
    [OPTIMIZER_FRAMING_FIELD]: z.string().default(DEFAULT_SETTINGS.optimizerFraming),
    [OPTIMIZER_PERMISSION_FIELD]: z.string().default(DEFAULT_SETTINGS.optimizerPermission),
    [OPTIMIZER_MODEL_FIELD]: z.string().default(DEFAULT_SETTINGS.optimizerModel),
    [OPTIMIZER_HISTORY_FIELD]: z.string().default(DEFAULT_SETTINGS.optimizerHistory),
    [OPTIMIZER_TURNS_FIELD]: z.number().default(DEFAULT_SETTINGS.optimizerTurns),
    [OPTIMIZE_BASH_FIELD]: z.boolean().default(DEFAULT_SETTINGS.optimizeBash),
    // 三档的自定义系统提示词：默认空串 = 用内置那份（空串同时就是「恢复内置」写回的值）。
    [OPTIMIZER_PROMPT_FIELDS.light]: z.string().default(DEFAULT_SETTINGS.optimizerPromptLight),
    [OPTIMIZER_PROMPT_FIELDS.standard]: z.string().default(DEFAULT_SETTINGS.optimizerPromptStandard),
    [OPTIMIZER_PROMPT_FIELDS.heavy]: z.string().default(DEFAULT_SETTINGS.optimizerPromptHeavy),
    // 旧字段名（0.14.0 改名）：继续注册，DSH 才不会把用户旧的自定义提示词当未知字段丢掉；
    // 读取层把它当成新字段的兜底（见 settings-contract 的迁移读）。
    [LEGACY_OPTIMIZER_PROMPT_FIELDS.light]: z.string().default(''),
    [LEGACY_OPTIMIZER_PROMPT_FIELDS.standard]: z.string().default(''),
    [LEGACY_OPTIMIZER_PROMPT_FIELDS.heavy]: z.string().default(''),
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
    // 微信通知（0.17.0）。⚠️ 2026-10-09 补：这 5 个字段在 0.17.0 漏了 —— 只加进了设置契约
    // 与设置页，**没加进这张 schema**。后果不是"界面少了什么"，而是宿主设置服务的写路径会
    // 直接拒绝：`settings.mutate` 对每个 path 先查 `isVolatilePath(schema, path)`，
    // 没声明就抛 `Config field "notifyEnabled" is not volatile`（见 DSH 源码
    // packages/settings/settings/src/index.ts 的 `write`），于是通知卡那几个开关根本存不住。
    // 教训写进测试：`test/client-registration.mjs` 第 16 节逐字段核对契约与这张表。
    [NOTIFY_ENABLED_FIELD]: z.boolean().default(DEFAULT_SETTINGS.notifyEnabled),
    [NOTIFY_CHANNEL_FIELD]: z.string().default(DEFAULT_SETTINGS.notifyChannel),
    [NOTIFY_PUSHPLUS_FIELD]: z.string().default(DEFAULT_SETTINGS.notifyPushplusToken),
    [NOTIFY_WECOM_FIELD]: z.string().default(DEFAULT_SETTINGS.notifyWecomWebhook),
    [NOTIFY_KINDS_FIELD]: z.object({
      'needs-input': z.boolean().default(DEFAULT_SETTINGS.notifyKinds['needs-input']),
      done: z.boolean().default(DEFAULT_SETTINGS.notifyKinds.done),
      error: z.boolean().default(DEFAULT_SETTINGS.notifyKinds.error),
    }),
    // 工作区目录选择（0.19.0）：默认关（接管官方槽位这件事必须由用户自己点）。
    [DIRECTORY_PICK_ENABLED_FIELD]: z.boolean().default(DEFAULT_SETTINGS.directoryPickEnabled),
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

/**
 * 订阅套餐的额度快照缓存（0.26.0）。
 *
 * 为什么缓存：金额胶囊每 600ms 就可能问一次 `/composer-ux/usage`，而额度接口是**官方网络的
 * 一次往返**（实测 100–300ms）。60 秒的 TTL 足以让控制台那几个百分比与界面保持一致，又不会
 * 把官方接口打成轮询。
 *
 * 失败也缓存（沿用上一份 `windows`，`status` 说清原因）：接口偶发 5xx 时，界面不该从
 * "周 3%" 忽然变成"一片空白"。
 */
const PLAN_QUOTA_TTL_MS = 60_000
const planQuotaCache = new Map<string, PlanQuotaSnapshot>()
/** 正在飞的套餐 id（同一个套餐同时只允许一次请求）。 */
const planQuotaInflight = new Set<string>()

/** 额度接口允许我们取 key 的引用名（按顺序试；与用户实际配置的 provider 命名对齐）。 */
const PLAN_QUOTA_KEY_REFS = ['OPENCODE_GO_API_KEY', 'GO_API_KEY', 'OPENCODE_API_KEY'] as const

/**
 * 取一个订阅套餐的额度窗口（带缓存与失败降级）。
 *
 * @param ctx - 插件上下文（只用来 `get('credentials')` 解析 API Key）。
 * @param plan - 套餐定义（含额度接口的 origin 与路径）。
 * @param now - 当前时刻（测试可注入）。
 * @param fetcher - 网络实现（测试可注入；默认全局 `fetch`）。
 * @returns 额度快照；**永不抛错**（失败写进 `status` / `reason`）。
 */
async function fetchPlanQuota(
  ctx: { get: (name: string) => unknown },
  plan: SubscriptionPlan,
  now: number = Date.now(),
  fetcher: typeof fetch = fetch,
): Promise<PlanQuotaSnapshot> {
  // 同一个套餐同时只允许一次在飞：胶囊 600ms 一个请求，不能让它们排队打官方接口。
  if (planQuotaInflight.has(plan.id)) return peekPlanQuota(plan, now)
  planQuotaInflight.add(plan.id)
  const cached = planQuotaCache.get(plan.id)
  const keep = (status: 'not-configured' | 'unavailable' | 'invalid', reason: string): PlanQuotaSnapshot =>
    degradeQuota(plan, cached, status, reason)
  // 先拿 key：没有 key 就不用发请求（也不该记成"接口挂了"）。
  const credentials = ctx.get('credentials') as
    { resolve?: (name: string) => Promise<{ readonly value?: unknown } | undefined> } | undefined
  let key = ''
  if (typeof credentials?.resolve === 'function') {
    for (const ref of PLAN_QUOTA_KEY_REFS) {
      try {
        const resolved = await credentials.resolve(ref)
        const value = typeof resolved?.value === 'string' ? resolved.value.trim() : ''
        if (value !== '') {
          key = value
          break
        }
      } catch {
        /* 这个引用解析不了就试下一个 */
      }
    }
  }
  if (key === '') {
    const snapshot = keep('not-configured', `没找到 ${plan.displayName} 的 API Key（试过 ${PLAN_QUOTA_KEY_REFS.join(' / ')}）`)
    planQuotaCache.set(plan.id, snapshot)
    planQuotaInflight.delete(plan.id)
    return snapshot
  }
  const controller = new AbortController()
  const timer = setTimeout(() => { controller.abort() }, 8000)
  try {
    const response = await fetcher(`${plan.quotaOrigin}${plan.quotaPath}`, {
      method: 'GET',
      headers: { authorization: `Bearer ${key}`, accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) {
      const snapshot = keep('unavailable', `额度接口返回 HTTP ${response.status}`)
      planQuotaCache.set(plan.id, snapshot)
      return snapshot
    }
    const body: unknown = await response.json()
    const windows = parseQuotaPayload(body)
    const snapshot: PlanQuotaSnapshot = windows.length === 0
      ? { provider: plan.id, displayName: plan.displayName, status: 'invalid', windows, fetchedAt: now, reason: '额度接口的响应里没有可读的窗口（形状变了？）' }
      : { provider: plan.id, displayName: plan.displayName, status: 'ok', windows, fetchedAt: now, reason: '' }
    planQuotaCache.set(plan.id, snapshot)
    return snapshot
  } catch (error: unknown) {
    const reason = error instanceof Error && error.name === 'AbortError'
      ? '额度接口超时（8 秒）'
      : `额度接口请求失败：${error instanceof Error ? error.message : String(error)}`
    const snapshot = keep('unavailable', reason)
    planQuotaCache.set(plan.id, snapshot)
    return snapshot
  } finally {
    clearTimeout(timer)
    planQuotaInflight.delete(plan.id)
  }
}

/**
 * 同步读一份额度快照（**不会**发请求）：有缓存给缓存，没有给 `pending`。
 *
 * 路由只调这个函数 —— 取额度是后台的事（见 {@link fetchPlanQuota}）。这样金额胶囊永远不会
 * 因为官方额度接口慢而卡住（用户可能在国内网络下，8 秒超时对 600ms 轮询是灾难）。
 */
function peekPlanQuota(plan: SubscriptionPlan, now: number = Date.now()): PlanQuotaSnapshot {
  const cached = planQuotaCache.get(plan.id)
  if (cached !== undefined && now - cached.fetchedAt < PLAN_QUOTA_TTL_MS) return cached
  return {
    provider: plan.id,
    displayName: plan.displayName,
    status: cached === undefined ? 'pending' : cached.status,
    windows: cached?.windows ?? [],
    fetchedAt: cached?.fetchedAt ?? 0,
    reason: cached === undefined ? '正在取额度…' : cached.reason,
  }
}

/** 后台刷新（不 await）：结果写进缓存，下次轮询就能读到。 */
function refreshPlanQuota(ctx: { get: (name: string) => unknown }, plan: SubscriptionPlan): void {
  const cached = planQuotaCache.get(plan.id)
  if (cached !== undefined && Date.now() - cached.fetchedAt < PLAN_QUOTA_TTL_MS) return
  void fetchPlanQuota(ctx, plan).catch(() => {
    /* fetchPlanQuota 自己不抛；这里只是兜底，绝不能让未处理的 rejection 冒到宿主 */
  })
}

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
  // 0.25.0：每次挂载重新探测宿主能力。进程不变，但同一进程里可能换环境变量、换宿主布局
  // （测试也要能在一次进程里把「原生 / 旧宿主」两条路都跑到）。
  resetNativeSessionHeaderCache()
  // 额度缓存的键是"套餐 id"，跨挂载复用没有意义（换宿主 / 换 key 后就该重取）；
  // 清掉也让测试能在同一个进程里把 ok / 失败两条分支都跑到。
  planQuotaCache.clear()
  planQuotaInflight.clear()
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
    /**
     * 运行期覆盖（0.22.0）：装一次，之后每次 llm-pi-ai 那行配置被解析时按需补头。
     * `installed` 只用来让状态行说实话（没 loader = 挂不上 = 没生效）。
     */
    let resync: () => void = () => {}
    installHeaderOverlay(ctx, read, () => { resync() })
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
      void syncHeaderOverlay(settings, read, headerOverlayState.installed)
        .catch((error: unknown) => {
          console.error('[composer-ux] 请求头状态同步失败', error)
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
    resync = sync
    // 启动即对齐一次：状态与一次性清理都在这儿收口（运行期覆盖不改用户配置）。
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
    /**
     * 「全文」模式向 `recentTurns` 要的回合数：一个足够大的上限，真正的收口在字符预算那一步
     * （`contextWithinBudget`）——所以这里不需要精确等于会话长度。
     */
    const CONTEXT_TURNS_FULL = 100

    /** 会话当前选的模型（拿不到就是空）。 */
    const sessionRoute = (): { provider: string; model: string } => {
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
     * 这一轮用哪条路由。
     *
     * 优先级：客户端显式指定 > 设置里的「模型」（0.14.0）> 会话当前选的模型。
     * 设置里写 `provider/model`（推荐）时按斜杠拆；只写模型名时沿用会话的 provider ——
     * 这样用户既能精确指定，也能只换模型不换厂商。
     */
    const resolveRoute = (payload: Record<string, unknown>): { provider: string; model: string } => {
      const provider = textOf(payload.provider)
      const model = textOf(payload.model)
      if (provider !== '' && model !== '') return { provider, model }
      const configured = readOwnSetting(optCtx, config, OPTIMIZER_MODEL_FIELD).trim()
      if (configured !== '') {
        const slash = configured.indexOf('/')
        if (slash > 0) return { provider: configured.slice(0, slash), model: configured.slice(slash + 1) }
        const fallback = sessionRoute()
        return { provider: fallback.provider, model: configured }
      }
      return sessionRoute()
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
      // 关闭档（0.14.0）：**在调用模型之前**就退回去 —— 一个"不优化"的档位不该花任何额度。
      // 面板那边也把主按钮禁掉了，这里是第二道（HTTP 可以被直接调用）。
      if (tier === 'off') {
        sendJson(res, 200, { ok: false, error: '档位是「关闭」：不优化。到「快捷指令」面板把档位拨到轻度或以上再来。' })
        return
      }
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
      // 内置 Bash（0.14.0，默认关）：开了才把 `bash` 工具挂给模型，并追加它的边界说明。
      // 它与只读工具共用同一个工作目录围栏：拿不到会话工作目录就不开。
      const bashOn = readOwnFlag(optCtx, config, OPTIMIZE_BASH_FIELD, DEFAULT_SETTINGS.optimizeBash)
      const sessionId = textOf(payload.sessionId)
      // 上下文取多少（0.14.0）：`full` = 尽量给全（仍受字符预算约束）；`turns` = 最近 N 回合，
      // N = 0 时干脆不带（用户明确说"不要上下文"）。回合数走归一化，坏值回落默认。
      const historyMode = readOwnSetting(optCtx, config, OPTIMIZER_HISTORY_FIELD)
      const turnsWanted = normalizeOptimizerTurns(
        readOwnNumber(optCtx, config, OPTIMIZER_TURNS_FIELD, DEFAULT_SETTINGS.optimizerTurns),
      )
      const wantContext = contextOn && sessionId !== '' && !(historyMode !== 'full' && turnsWanted === 0)
      const contextTurns = wantContext
        ? contextWithinBudget(recentTurns(await readSessionSnapshot(sessionId), historyMode === 'full' ? CONTEXT_TURNS_FULL : turnsWanted))
        : []
      const contextText = contextBlock(contextTurns)

      // 记忆链在 0.14.0 **整条撤掉**：上游硬规则 7 是「轮次之间不遗传」（提示词里也写着），
      // 宿主再传上一轮成品就是白花 token 的死载荷 —— 客户端也不再发这个字段。

      // 协作基调（0.14.0）：`hard` 时提示词追加「硬邦邦模式」段（只改写法，不改条目与依据规则）。
      const framing = readOwnSetting(optCtx, config, OPTIMIZER_FRAMING_FIELD)

      // 达到了上下文就加"只用于消歧义、不算依据"那段纪律。
      const system = buildOptimizeSystem(tier, customPrompt, { intent: contextText !== '', framing })

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

      /**
       * 这次优化的 bash 授权（0.22.0，借鉴 dsh-ops 的"命令类能力只在完全权限下发布"）。
       *
       * 为什么要算它：解释层的 `bash` 是 `node:child_process.spawn` **直接执行**的，不经过宿主的
       * 受限终端后端 —— 拿不到沙箱服务时它天生绕过 `read-only` / `workspace-write` 会话的策略。
       * 现在的规矩：**能证明"被沙箱约束"（宿主有 confine 且自报 full）或"会话本身是完全权限"才给工具**，
       * 证明不了就不给（失败方向安全），并把结论如实回报给界面。
       */
      const bashGate: { readonly gate: BashAuthority; readonly confine?: (argv: readonly string[]) => Promise<{ readonly argv: readonly string[]; readonly enforcement?: string }> } = (() => {
        if (!bashOn) return { gate: { kind: 'off' } }
        let mode: string | undefined
        let policy: unknown
        let sandbox: { confine?: (argv: readonly string[], policy: unknown, signal?: AbortSignal) => Promise<{ argv: readonly string[]; enforcement?: string }> } | undefined
        try {
          const session = sessionId === ''
            ? undefined
            : (optCtx.get('sessions') as { get?: (id: string) => unknown } | undefined)?.get?.(sessionId as never)
          const resolved = (optCtx.get('sandboxPolicy') as { resolve?: (request?: unknown) => unknown } | undefined)?.resolve?.({ session })
          policy = resolved
          mode = typeof (resolved as { mode?: unknown } | undefined)?.mode === 'string' ? (resolved as { mode: string }).mode : undefined
        } catch {
          mode = undefined
        }
        try {
          const candidate = optCtx.get('sandbox') as typeof sandbox
          if (candidate !== undefined && typeof candidate.confine === 'function') sandbox = candidate
        } catch {
          sandbox = undefined
        }
        const gate = resolveBashAuthority({ enabled: true, ...(mode === undefined ? {} : { mode }), hasConfine: sandbox !== undefined })
        if (gate.kind !== 'open' || !gate.confined || sandbox?.confine === undefined) return { gate }
        const confine = sandbox.confine.bind(sandbox)
        return {
          gate,
          confine: async (argv: readonly string[]) => {
            const out = await confine(argv, policy, controller.signal)
            return { argv: out.argv, ...(out.enforcement === undefined ? {} : { enforcement: out.enforcement }) }
          },
        }
      })()
      const bashOpen = bashGate.gate.kind === 'open'
      /** 回报给界面的授权结论（off / denied / sandboxed / full-access）。 */
      const bashGateInfo: Record<string, unknown> = bashGate.gate.kind === 'off'
        ? { bashGate: 'off' }
        : bashGate.gate.kind === 'denied'
          ? { bashGate: 'denied', bashGateReason: bashGate.gate.reason }
          : { bashGate: bashGate.gate.confined ? 'sandboxed' : 'full-access' }
      const toolsOn = readToolsOn || bashOpen
      const cwd = toolsOn ? sessionCwdOf(await readSessionSnapshot(sessionId)) : ''
      if (toolsOn && cwd !== '') {
        try {
          const looped = await runOptimizeToolLoop({
            llm: optCtx.llm as never,
            provider: route.provider,
            model: route.model,
            system: `${system}${readToolsOn ? READ_TOOLS_SYSTEM_NOTE : ''}${bashOpen ? BASH_TOOL_SYSTEM_NOTE : ''}`,
            userText: buildOptimizeUser(body, { context: contextText }),
            root: cwd,
            bash: bashOpen,
            ...(bashGate.confine === undefined ? {} : { bashConfine: bashGate.confine }),
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
        result = tooledResult ?? await runOnce(buildOptimizeUser(body, { context: contextText }), onStreamDelta)
        // 空产出重试一次：机制与话术取自对方 0.6 的 `retryEmpty` —— 对方真机上的
        // "思考完成却没有产出"多半是模型把 JSON 忘在脑后，点一遍规则就能救回来。
        // 只在**没报错**时重试（报错重试一次只是白等一轮）。
        if (result.out.trim() === '' && result.failure === '') {
          retried = true
          const second = await runOnce(buildOptimizeUser(body, { retry: true, reason: '宿主没有收到任何条目', context: contextText }), onStreamDelta)
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
          ...bashGateInfo,
            ...bashGateInfo,
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
          ...bashGateInfo,
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
          items: summary.items,
          dropped: summary.droppedReasons.length,
          droppedReasons: summary.droppedReasons,
          warnings: summary.warnings,
          fallback: summary.fallback,
          // 工具记账：回落也带上（"确实花了这些次调用又回落了"比抹平成 0 诚实）。
          ...(toolInfo === null ? {} : toolInfo),
          ...bashGateInfo,
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
          sendJson(res, 200, { ok: true, state: null, hidden: false, keep: false, file })
          return
        }
        const read = readDockState(file)
        sendJson(res, 200, {
          ok: true,
          state: read.state,
          hidden: read.hidden,
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
      // `hidden` 缺省 false：0.13.0/0.13.1 的客户端只发 state，语义就是「没收起」。
      const result = writeDockState(candidate as Record<string, unknown> | null, file, payload.hidden === true)
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
      sendJson(res, 200, { ok: true, hidden: payload.hidden === true, keep: true, file, bytes: result.bytes ?? 0 })
    }

    // ── 模型清单（0.14.1）─────────────────────────────────────────────────
    /** 缓存：下拉打开很频繁，而这份清单不会秒变。`?fresh=1` 绕过（界面上就是「重试」）。 */
    const MODEL_CACHE_MS = 60_000
    /** 单个 provider 的模型清单最多等这么久（读不到就那一组空着，别拖住整个下拉）。 */
    const MODEL_LIST_TIMEOUT_MS = 3_000
    let modelsCache: { at: number; payload: Record<string, unknown> } | null = null

    optCtx.effect(() => optCtx.webServer.register({
      kind: 'exact',
      path: MODELS_API_PATH,
      handler: (async (req: { method?: string; url?: string }, res: never) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: '只支持 GET' })
          return
        }
        const fresh = String(req.url ?? '').includes('fresh=1')
        const now = Date.now()
        if (!fresh && modelsCache !== null && now - modelsCache.at < MODEL_CACHE_MS) {
          sendJson(res, 200, modelsCache.payload)
          return
        }
        try {
          const llm = optCtx.get('llm') as {
            listProviders?: () => { id?: unknown; name?: unknown }[]
            listModels?: (provider: string) => Promise<{ id?: unknown; name?: unknown }[]>
          } | undefined
          const providerRows = typeof llm?.listProviders === 'function' ? llm.listProviders() : []
          const current = sessionRoute()
          const groups: Record<string, unknown>[] = []
          for (const row of providerRows) {
            const id = textOf(row?.id)
            if (id === '') continue
            const name = textOf(row?.name) === '' ? id : textOf(row?.name)
            let models: { id: string; name: string }[] = []
            let error = ''
            try {
              const listed = typeof llm?.listModels === 'function'
                ? await Promise.race([
                  llm.listModels(id),
                  new Promise<never>((_resolve, reject) => {
                    setTimeout(() => { reject(new Error(`超时 ${String(MODEL_LIST_TIMEOUT_MS)} ms`)) }, MODEL_LIST_TIMEOUT_MS)
                  }),
                ])
                : []
              models = (Array.isArray(listed) ? listed : [])
                .map(item => ({ id: textOf(item?.id), name: textOf(item?.name) === '' ? textOf(item?.id) : textOf(item?.name) }))
                .filter(item => item.id !== '')
            } catch (failure: unknown) {
              // 注意别写成 catch (error)：那会**遮蔽**上面那个 let error，原因就永远写不进去（踩过）。
              error = errorText(failure)
            }
            groups.push({ id, name, models, ...(error === '' ? {} : { error }) })
          }
          const payload: Record<string, unknown> = { ok: true, at: now, current, groups }
          modelsCache = { at: now, payload }
          sendJson(res, 200, payload)
        } catch (error: unknown) {
          sendJson(res, 500, { ok: false, error: `读模型清单失败：${errorText(error)}` })
        }
      }) as never,
    }))

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
    const usageCache = createUsageCache(tierAt, { maxSessions: 32 })
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

    /**
     * 读一份会话快照。返回 `undefined` = 读不到（会话不存在 / 归档后持久化也找不到 / 读失败）。
     *
     * 子代理这条路必须知道 `inheritedEventCount`：fork 出来的子代理会带着父会话的历史开头，
     * 那段事件里的 usage **父会话已经计过账**（见下面 {@link ownEvents}）。
     */
    const readSnapshot = async (
      id: string,
    ): Promise<{ readonly events: readonly unknown[]; readonly inherited: number } | undefined> => {
      try {
        const query = usageCtx.get('sessionQuery') as
          | {
            readSession?: (session: string) => Promise<
              { events?: readonly unknown[]; inheritedEventCount?: unknown } | undefined
            >
          }
          | undefined
        if (typeof query?.readSession !== 'function') return undefined
        const snapshot = await query.readSession(id)
        if (snapshot === undefined) return undefined
        const inherited = typeof snapshot.inheritedEventCount === 'number'
          && Number.isFinite(snapshot.inheritedEventCount) && snapshot.inheritedEventCount > 0
          ? snapshot.inheritedEventCount
          : 0
        return { events: Array.isArray(snapshot.events) ? snapshot.events : [], inherited }
      } catch {
        return undefined
      }
    }

    /**
     * 一个会话**自己产生**的事件（剔掉 fork 继承前缀）。
     *
     * 为什么必须有这一步（0.24.0）：`subagent-fork-in-process` 这类子代理是把父会话的历史当种子
     * 建出来的，它的事件日志**开头就是父会话那一段**，里面带着父会话已经上报过的 usage。
     * 整段照折等于把父会话的账再收一遍 —— 而且金额会随上下文大小成倍放大，界面上看不出错。
     * 判据与官方投影**同一条**：`event.seq < inheritedEventCount` 就是继承来的
     * （`packages/subagent/subagent/src/catalog.ts` 的投影也这么判）。
     * 没有 `seq` 的事件（理论上不会有）无法判归属，按"自己的"处理 —— 宁可多算一条，
     * 也不静默丢账。
     */
    const ownEvents = (
      snapshot: { readonly events: readonly unknown[]; readonly inherited: number },
    ): readonly unknown[] => {
      if (snapshot.inherited <= 0) return snapshot.events
      return snapshot.events.filter(event => {
        const seq = (event as { seq?: unknown } | null)?.seq
        return typeof seq !== 'number' || seq >= snapshot.inherited
      })
    }

    /**
     * 把一个折叠结果按 route 计价。
     *
     * 本会话与每个子代理**共用这一处**：胶囊、浮层与测试看到的必须是同一套"折叠 → 分档 → 单价"，
     * 各写一份就一定会有一处忘了峰谷或价格档（0.8.0 的静默错处就是这么来的）。
     */
    const priceFold = (target: SessionUsageFold, overrides: PriceOverrideTable | undefined) => {
      const routes = target.routes.map(item => {
        const resolved = resolvePrice(item.model, {
          provider: item.provider,
          peak: item.peak,
          era: item.era,
          overrides,
          providers: moneyRules.providers,
        })
        const parts = costPartsOf(costBucketsOf(item.usage), resolved.prices)
        // 0.26.0：订阅通道（OpenCode Go 这类"月费 + 额度"）另外算一份**额度消耗**。
        // 它与上面的 `cost`（按刊例价折算）是两个口径：前者是"你实际被扣掉的额度"，
        // 后者是"这些 token 按官方价折算值多少钱"。用户 2026-10-27 选定两套并存、
        // 胶囊默认看前者（见 src/subscription-plans.ts 文件头）。
        const quota = quotaCostOf(item.provider, item.model, item.peak, {
          miss: item.usage.inputTokens,
          hit: item.usage.cacheReadTokens,
          out: item.usage.outputTokens,
        })
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
          /** 订阅通道的额度消耗（USD）；不是订阅通道、或该模型不在价目表里时缺失。 */
          ...(quota === undefined ? {} : { quota }),
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
      // 额度合计按**模型**分组：同一个模型可能跨峰谷两条 route，额度上限是"每模型每月"，
      // 所以百分比必须把两条 route 加在一起再除，否则会算成"每档各占 x%"。
      const quotaModels = new Map<string, { usd: number; monthlyLimitUsd?: number }>()
      let quotaUsd = 0
      for (const route of routes) {
        const quota = (route as { quota?: QuotaCost }).quota
        if (quota === undefined) continue
        quotaUsd += quota.usd
        const row = quotaModels.get(quota.modelKey) ?? {
          usd: 0,
          ...(quota.monthlyLimitUsd === undefined ? {} : { monthlyLimitUsd: quota.monthlyLimitUsd }),
        }
        row.usd += quota.usd
        quotaModels.set(quota.modelKey, row)
      }
      const quota = {
        usd: quotaUsd,
        models: [...quotaModels].map(([model, row]) => ({
          model,
          usd: row.usd,
          ...(row.monthlyLimitUsd === undefined ? {} : { monthlyLimitUsd: row.monthlyLimitUsd }),
          ...(row.monthlyLimitUsd === undefined || row.monthlyLimitUsd <= 0
            ? {}
            : { percentOfLimit: row.usd / row.monthlyLimitUsd * 100 }),
        })),
      }
      return { routes, cost, unpriced: routes.filter(item => item.unpriced).length, quota }
    }

    /** 子代理递归的天花板（0.24.0）：金额胶囊每 600ms 就可能问一次，不能无界递归。 */
    const SUBAGENT_MAX_DEPTH = 4
    const SUBAGENT_MAX_SESSIONS = 32

    /**
     * 「谁是谁的父会话」的反查索引（0.24.0）。
     *
     * 为什么需要**第二条**来源：`subagent/catalog` 是 DSH 较新版本才写进父会话的事件；更早的
     * 会话只把关系记在**子会话自己的 header** 上（`origin: 'subagent'` + `parentSession`）。
     * 2026-10-17 在这台机器上核过：`~/.dsh/sessions` 下 211 份会话日志里，带 `origin: 'subagent'`
     * 的子会话有 35 份，而**没有任何一份**父会话日志里有 `subagent/catalog` —— 只认 catalog 的话，
     * 用户去看那些老会话（他报现象时看的多半就是这种），胶囊里的钱还是少的。
     *
     * 三条纪律：
     *  1. **只认 `origin: 'subagent'`**：用户自己"从某会话 fork 出来的会话"在 header 里同样只有
     *     `parentSession`、没有 `origin` —— 见谁都认会把用户自己开的会话算进别人的账上；
     *  2. **短 TTL 缓存 + 允许失败**：本机实测 211 份会话全量列一遍约 80ms（每份只取 header），
     *     但胶囊每 600ms 就可能问一次，所以缓存 {@link CHILD_INDEX_TTL_MS}；列举失败就沿用上一份
     *     （首次为空 ⇒ 本次只靠 catalog），绝不因为列举失败把金额打掉；
     *  3. **与 catalog 取并集**：老会话后来又被派了新子代理时，两条来源各有一半。
     */
    const CHILD_INDEX_TTL_MS = 30_000
    let childIndexAt = 0
    let childIndexBuilding = false
    let childIndexByParent: ReadonlyMap<string, readonly string[]> = new Map()
    const childIndexOf = async (): Promise<ReadonlyMap<string, readonly string[]>> => {
      if (childIndexAt !== 0 && Date.now() - childIndexAt < CHILD_INDEX_TTL_MS) return childIndexByParent
      if (childIndexBuilding) return childIndexByParent
      childIndexBuilding = true
      try {
        const query = usageCtx.get('sessionQuery') as
          { listSessions?: () => Promise<readonly unknown[]> } | undefined
        if (typeof query?.listSessions !== 'function') return childIndexByParent
        const records = await query.listSessions()
        const next = new Map<string, string[]>()
        for (const record of records) {
          const header = (record as {
            header?: { id?: unknown; origin?: unknown; parentSession?: unknown }
          } | null)?.header
          if (header?.origin !== 'subagent') continue
          if (typeof header.id !== 'string' || header.id === '') continue
          if (typeof header.parentSession !== 'string' || header.parentSession === '') continue
          const list = next.get(header.parentSession) ?? []
          list.push(header.id)
          next.set(header.parentSession, list)
        }
        childIndexByParent = next
        childIndexAt = Date.now()
      } catch {
        /* 列举失败：沿用上一份 */
      } finally {
        childIndexBuilding = false
      }
      return childIndexByParent
    }

    /**
     * 一个会话的直系子会话 = catalog（父会话自己的记录）∪ 反查索引（子会话 header 的反向关系）。
     * @param sessionId 父会话 id。
     * @param catalog 父会话日志里读到的 catalog 子会话（可能为空：老会话没有这个事件）。
     * @param index 反查索引（见 {@link childIndexOf}）。
     */
    const childrenOf = (
      sessionId: string,
      catalog: readonly SubagentChildRef[],
      index: ReadonlyMap<string, readonly string[]>,
    ): Array<{ readonly sessionId: string; readonly external: boolean }> => {
      const rows = catalog.map(child => ({ sessionId: child.sessionId, external: child.external }))
      const known = new Set(rows.map(child => child.sessionId))
      for (const childId of index.get(sessionId) ?? []) {
        if (known.has(childId)) continue
        known.add(childId)
        rows.push({ sessionId: childId, external: false })
      }
      return rows
    }

    /** 一个折到的子代理会话（带深度：`1` = 直系子代理，`2` = 孙代理 …）。 */
    interface SubagentFoldRow {
      readonly sessionId: string
      readonly depth: number
      readonly fold: SessionUsageFold
    }

    /**
     * 递归折**全部子代理**（0.24.0）。这是"金额胶囊不计算子代理费用"的修复本体。
     *
     * 三条口径：
     *  1. **子会话的来源有两条**（{@link childrenOf}）：父会话自己的 `subagent/catalog` 事件
     *     （较新版本的 DSH 才写）+ 子会话 header 里的 `origin: 'subagent'` 反查（老会话只有这个）。
     *     两条都只认子代理关系 —— 用户自己 fork 出来的会话 header 里没有 `origin`，不会被算进来；
     *  2. **继承前缀要剔掉**（{@link ownEvents}），否则 fork 型子代理会把父会话的账重复收一遍；
     *  3. **读不到就如实报**（`missing`），外部执行（`external`，本机没有会话）与超过上限
     *     （`skipped`）分开记 —— 界面要能把"没算进来"的部分说出来，而不是安静地少算。
     *
     * @param root 根会话（本会话）的折叠结果。
     * @param rootId 根会话 id（防止子代理的 catalog 指回根会话时重复折）。
     * @param liveSeqs 活会话 → `seq`。子代理跑着的时候它的日志在增长，得靠这个判"落后了"。
     */
    const foldSubagents = async (
      root: SessionUsageFold,
      rootId: string,
      liveSeqs: ReadonlyMap<string, number | undefined>,
    ): Promise<{
      readonly rows: readonly SubagentFoldRow[]
      readonly missing: number
      readonly external: number
      readonly skipped: number
    }> => {
      const rows: SubagentFoldRow[] = []
      const seen = new Set<string>([rootId])
      const index = await childIndexOf()
      let missing = 0
      let external = 0
      let skipped = 0
      const queue: Array<{ readonly sessionId: string; readonly external: boolean; readonly depth: number }> =
        childrenOf(rootId, root.children, index).map(child => ({
          sessionId: child.sessionId, external: child.external, depth: 1,
        }))
      while (queue.length > 0) {
        const next = queue.shift()
        if (next === undefined) break
        if (seen.has(next.sessionId)) continue
        seen.add(next.sessionId)
        if (next.external) {
          external += 1
          continue
        }
        if (next.depth > SUBAGENT_MAX_DEPTH || rows.length >= SUBAGENT_MAX_SESSIONS) {
          skipped += 1
          continue
        }
        let unreadable = false
        const outcome = await usageCache.sync(next.sessionId, liveSeqs.get(next.sessionId), async () => {
          const snapshot = await readSnapshot(next.sessionId)
          if (snapshot === undefined) {
            unreadable = true
            throw new Error(`子代理会话 ${next.sessionId} 的日志读不到`)
          }
          return ownEvents(snapshot)
        })
        // 读不到、而且缓存里本来也没有它 —— 这才是"没算进来"。缓存里有数据就继续用它
        // （一次读失败不该让胶囊上的数字忽然变小）。
        if (unreadable && outcome.fold.events === 0) {
          missing += 1
          continue
        }
        rows.push({ sessionId: next.sessionId, depth: next.depth, fold: outcome.fold })
        for (const child of childrenOf(next.sessionId, outcome.fold.children, index)) {
          queue.push({ sessionId: child.sessionId, external: child.external, depth: next.depth + 1 })
        }
      }
      return { rows, missing, external, skipped }
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
        const liveSeqs = new Map<string, number | undefined>()
        for (const row of liveSessions()) {
          const id = (row as { id?: unknown } | null)?.id
          if (typeof id !== 'string' || id === '') continue
          const seq = (row as { seq?: unknown }).seq
          liveSeqs.set(id, typeof seq === 'number' && Number.isFinite(seq) ? seq : undefined)
        }
        // `seq` 是"下一条事件的序号"（= 已写入条数），所以最后一条已写入事件的 seq 是 `liveSeq - 1`。
        const liveSeq = liveSeqs.get(sessionId)
        const { fold, source } = await usageCache.sync(sessionId, liveSeq, async () => {
          const snapshot = await readSnapshot(sessionId)
          // 读不到就如实回"没有事件"（`sync()` 会保住缓存里已有的那份，绝不冒泡给路由）。
          return snapshot === undefined ? [] : snapshot.events
        })

        // ── 2) 逐 route 计价 ────────────────────────────────────────────────────
        // 档位来自折叠结果（**每条用量事件自己的时间**，含价格历史档），单价来自
        // 用户覆盖价 > 官方刊例价（历史档）/ 同步来的第三方价目，认不出就是"未定价"。
        // 计价放在宿主半是刻意的：这样"折叠规则 → 分档 → 单价"只有一处，胶囊与面板
        // （以及 `test/*.mjs`）看到的是同一份数字，不会各算各的。
        const overrides = readOverrides()
        await loadProviders()
        const selfPriced = priceFold(fold, overrides)

        // ── 3) 子代理（0.24.0）──────────────────────────────────────────────────
        // 用户报的 bug 就是这里：胶囊只算本会话，子代理花的钱一个都没进账。
        // 子代理的用量在**自己的**会话日志里（父会话只在 catalog 事件里记了"有哪些子会话"），
        // 所以要递归读、递归折、按同一套价目计。口径见 `foldSubagents`。
        const children = await foldSubagents(fold, sessionId, liveSeqs)
        let subTotal = zeroBuckets()
        let subPeak = zeroBuckets()
        let subOffPeak = zeroBuckets()
        const subCost = { miss: 0, hit: 0, out: 0, total: 0 }
        let subUnpriced = 0
        let subLive = 0
        // 0.26.0：子代理同一个套餐口径的额度消耗也要并进来（否则"本会话额度"少算了子代理那份）。
        const quotaModels = new Map<string, { usd: number; monthlyLimitUsd?: number }>()
        for (const row of selfPriced.quota.models) {
          quotaModels.set(row.model, {
            usd: row.usd,
            ...(row.monthlyLimitUsd === undefined ? {} : { monthlyLimitUsd: row.monthlyLimitUsd }),
          })
        }
        let quotaUsd = selfPriced.quota.usd
        const mergeQuota = (priced: ReturnType<typeof priceFold>): void => {
          quotaUsd += priced.quota.usd
          for (const row of priced.quota.models) {
            const merged = quotaModels.get(row.model) ?? {
              usd: 0,
              ...(row.monthlyLimitUsd === undefined ? {} : { monthlyLimitUsd: row.monthlyLimitUsd }),
            }
            merged.usd += row.usd
            quotaModels.set(row.model, merged)
          }
        }
        /** 本会话（或子代理）用到过的订阅套餐 provider；没用到就是 undefined。 */
        let planProvider = selfPriced.routes.find(route => planOf(route.provider) !== undefined)?.provider
        for (const row of children.rows) {
          subTotal = addBuckets(subTotal, row.fold.total)
          subPeak = addBuckets(subPeak, row.fold.tiers.peak)
          subOffPeak = addBuckets(subOffPeak, row.fold.tiers.offPeak)
          const priced = priceFold(row.fold, overrides)
          subCost.miss += priced.cost.miss
          subCost.hit += priced.cost.hit
          subCost.out += priced.cost.out
          subCost.total += priced.cost.total
          subUnpriced += priced.unpriced
          mergeQuota(priced)
          planProvider ??= priced.routes.find(route => planOf(route.provider) !== undefined)?.provider
          if (liveSeqs.has(row.sessionId)) subLive += 1
        }
        // 订阅套餐的额度窗口（5 小时 / 周 / 月）：只在真的用到订阅通道时才去问官方接口 ——
        // 纯按量付费的会话不该为这件事多付一次网络往返。失败不抛，如实回 unavailable。
        // 额度窗口：**只读缓存**（没有就回 pending），取数在后台跑 —— 见 peekPlanQuota 的注释。
        const planDetail = planProvider === undefined ? undefined : planOf(planProvider)
        if (planDetail !== undefined) refreshPlanQuota(usageCtx, planDetail)
        const plan = planDetail === undefined ? undefined : peekPlanQuota(planDetail)
        const quota = {
          usd: quotaUsd,
          models: [...quotaModels].map(([model, row]) => ({
            model,
            usd: row.usd,
            ...(row.monthlyLimitUsd === undefined ? {} : { monthlyLimitUsd: row.monthlyLimitUsd }),
            ...(row.monthlyLimitUsd === undefined || row.monthlyLimitUsd <= 0
              ? {}
              : { percentOfLimit: row.usd / row.monthlyLimitUsd * 100 }),
          })),
        }

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
          routes: selfPriced.routes,
          cost: selfPriced.cost,
          /**
           * **订阅通道的额度口径（0.26.0）**。`cost` 是"按刊例价折算值多少钱"，这里是
           * "你实际被扣掉多少套餐额度"——两个口径并存，胶囊默认显示后者（用户 2026-10-27 选定）。
           *
           * `usd` 是本会话（含子代理）的额度消耗；`models` 按模型分组，`percentOfLimit` 是
           * **占该模型月度额度上限**的比例（上限来自官方价目表；官方没公布就没有这个字段）。
           * `plan` 是额度窗口本身（5 小时 / 周 / 月），取不到时 `status` 会说清为什么。
           */
          quota,
          ...(plan === undefined ? {} : { plan }),
          /**
           * **子代理**（0.24.0）：本会话派出去的全部子代理会话（含孙代理）的合计。
           *
           * 刻意**不并进**上面的 `total` / `cost` / `routes` —— 那三个字段的口径是"本会话自己"，
           * 客户端拿它跟官方 `tokenUsage` 投影对账（`agreesWithProjection`）：投影只有本会话，
           * 一合并就永远对不上，浮层会退回估算口径（那是 0.8.0 的老毛病）。所以：
           * 本会话的钱在上面的顶层字段，子代理的钱在这里，**加起来才是这次任务真的花了多少**。
           *
           * `missing` / `external` / `skipped` / `unpriced` 是"没算进来"的四个来源，界面必须
           * 把它们说出来：读不到日志的（已归档/读失败）、外部执行的（claude-code 那类，本机
           * 没有会话）、超过递归上限的、以及用量有但认不出单价的。
           */
          subagents: {
            sessions: children.rows.length,
            live: subLive,
            missing: children.missing,
            external: children.external,
            skipped: children.skipped,
            total: subTotal,
            tiers: { peak: subPeak, offPeak: subOffPeak },
            cost: subCost,
            unpriced: subUnpriced,
          },
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

    // ── 订阅套餐的额度窗口（0.26.0）────────────────────────────────────────────
    //
    // 只在设置页「金额」卡里展示（胶囊的 `plan` 字段复用同一份缓存）。与会话无关，所以
    // **单独一条路由**：会话用量每 600ms 一变、额度 60 秒才变一次，合在一条里会让每次
    // 会话轮询都去摸官方接口。同样**不阻塞**：立刻回缓存（没有就 pending），后台刷新。
    const handleQuota = (
      req: { method?: string },
      res: { writeHead: (code: number, headers: Record<string, string>) => void; end: (body: string) => void },
    ): void => {
      const method = (req.method ?? 'GET').toUpperCase()
      if (method !== 'GET') {
        sendJson(res, 405, { ok: false, error: '只接受 GET' })
        return
      }
      // 额度是账号级数据（能看出这个套餐用了多少），与用量路由同一道关卡。
      if (rejectUntrustedRequest(usageCtx as never, req, res)) return
      const plans = SUBSCRIPTION_PLANS.map(plan => ({
        ...peekPlanQuota(plan),
        monthlyFeeUsd: plan.monthlyFeeUsd,
        // 引用名给界面看（"没配 key 时该配哪一个"），不含任何密钥内容。
        keyRefs: PLAN_QUOTA_KEY_REFS,
      }))
      for (const plan of SUBSCRIPTION_PLANS) refreshPlanQuota(usageCtx, plan)
      sendJson(res, 200, { ok: true, plans })
    }

    usageCtx.effect(() => usageCtx.webServer.register({
      kind: 'exact',
      path: QUOTA_API_PATH,
      handler: handleQuota as never,
    }), 'composer-ux: quota route')
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
        await retryWrite(
          () => service.mutate(NAMESPACE, [{ op: 'set', path: [QUICK_ENABLED_FIELD], value: true }]),
          STARTUP_WRITE_ATTEMPTS,
          STARTUP_WRITE_RETRY_MS,
        )
      } catch (error: unknown) {
        // 迁移失败不是致命错误：用户顶多在设置页手动打开这一栏。
        console.error('[composer-ux] quick section migration skipped', error)
      }
    })()
  })

  // ── 自检（0.22.0）────────────────────────────────────────────────────────
  //
  // 一行一句人话，把散在各处的状态摊平：设置字段是否都在 schema 里、八栏开关、终端替换、
  // 请求头运行期覆盖、快捷指令本、通知凭据、解释层档位、运行环境。
  // 采集在这里（要服务），判断在 ./doctor.ts（纯函数，可逐格测）。
  ctx.inject(['webServer'], (doctorCtx) => {
    const doctorRead = makeReader(doctorCtx.get('settings') as SettingsLike | undefined, config)
    const sendDoctorJson = (
      res: { writeHead: (code: number, headers: Record<string, string>) => void; end: (body?: string) => void },
      code: number,
      payload: unknown,
    ): void => {
      res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(payload))
    }
    /** 本插件版本：从包自己的 package.json 读（读不到就空着，不编）。 */
    const pluginVersion = ((): string => {
      try {
        const require_ = process.getBuiltinModule('node:module').createRequire(import.meta.url)
        return String((require_('../package.json') as { version?: unknown }).version ?? '')
      } catch {
        return ''
      }
    })()
    const collectDoctor = async (): Promise<DoctorInput> => {
      const own = doctorRead(NAMESPACE) ?? {}
      /** 某个服务在不在（决定"能不能做某件事"，而不是假装它能）。 */
      const has = (name: string): boolean => {
        try {
          return doctorCtx.get(name) !== undefined
        } catch {
          return false
        }
      }
      const bool = (field: string): boolean => own[field] === true
      const text = (field: string): string => textOf(own[field])
      /**
       * 持久终端三件套的版本核对（0.22.0 适配 alpha.4 新增）。
       *
       * 为什么值得单列：tool-terminal 声明的是**精确版本 peer**（例如要求 `@deepseek-ai/dsh-tools`
       * 等于某个 alpha）。版本一旦与运行时对不上，宿主只是把那一行禁用 + 启动日志一句 warning，
       * 模型工具表里就少 6 个 terminal_* 工具，界面上完全看不出来。
       * 这里把"装的是哪版、它要求什么、profile 里实际是什么"摊到自检报告里，让静默失败一眼可见。
       */
      const persistentTerminals = ((): DoctorInput['persistentTerminals'] => {
        const profileDir = ((): string => {
          try {
            const value = doctorCtx.get('profileContext') as { dir?: unknown } | undefined
            return typeof value?.dir === 'string' ? value.dir : ''
          } catch {
            return ''
          }
        })()
        const manifestOf = (name: string): Record<string, unknown> | undefined => {
          if (profileDir === '') return undefined
          try {
            const file = join(profileDir, 'node_modules', ...name.split('/'), 'package.json')
            return objectOf(JSON.parse(readFileSync(file, 'utf8')))
          } catch {
            return undefined
          }
        }
        const tool = manifestOf('@deepseek-ai/dsh-tool-terminal')
        const peers = objectOf(tool?.peerDependencies)
        const peerName = Object.keys(peers ?? {}).find(key => key.startsWith('@deepseek-ai/dsh-')) ?? ''
        const peerRequired = peerName === '' ? '' : textOf(peers?.[peerName])
        /**
         * 运行时版本：从**本进程入口**往上找最近的 package.json。
         *
         * 为什么这样拿：`ProfileContext` 没有版本字段；而本仓是锁步版本（所有包同版），
         * 从 `process.argv[1]`（`<安装根>/apps/cli/lib/bin.js`）往上第一份 package.json
         * 的版本就等于运行时版本 —— 兼容闸门本身也是拿这个版本去比 peer 的。
         * 打包应用里入口指向 asar，读不到就返回空串（自检**不许编**，空 = 这一项不下结论）。
         */
        const runtimeVersion = ((): string => {
          try {
            let dir = process.argv[1] === undefined ? '' : dirname(process.argv[1])
            for (let depth = 0; depth < 6 && dir !== ''; depth += 1) {
              const file = join(dir, 'package.json')
              if (existsSync(file)) return textOf((JSON.parse(readFileSync(file, 'utf8')) as { version?: unknown }).version)
              const parent = dirname(dir)
              if (parent === dir) break
              dir = parent
            }
            return ''
          } catch {
            return ''
          }
        })()
        const peerInstalled = peerName === '' ? '' : textOf(manifestOf(peerName)?.version)
        // 判据优先级：能拿到运行时版本就用它比（精确）；否则退到 profile 里实际装的 peer。
        const marker = runtimeVersion !== '' ? runtimeVersion : peerInstalled
        return {
          servicePresent: has('terminals'),
          toolVersion: textOf(tool?.version),
          peerRequired,
          peerInstalled: marker,
          // 两边都读到了才敢判"不匹配"；读不到就当不知道（自检不许编）。
          mismatch: peerRequired !== '' && marker !== '' && peerRequired !== marker,
        }
      })()
      const quickOutcome = await readQuickBook(quickStorePath()).catch(() => ({ kind: 'error' as const }))
      return {
        version: pluginVersion,
        enabled: bool(ENABLED_FIELD),
        sections: {
          键位: bool(KEYS_ENABLED_FIELD),
          右键菜单: bool(MENU_ENABLED_FIELD),
          快捷指令: bool(QUICK_ENABLED_FIELD),
          设置面板: bool(PANEL_ENABLED_FIELD),
          默认终端: bool(TERMINAL_ENABLED_FIELD),
          微信通知: bool(NOTIFY_ENABLED_FIELD),
          'OpenCode 请求头': bool(HEADER_ENABLED_FIELD),
          只读查证: bool(OPTIMIZE_READ_TOOLS_FIELD),
        },
        fieldConstants: ALL_SETTINGS_FIELDS,
        schemaKeys: Object.keys((ownSchema() as unknown as { dict?: Record<string, unknown> }).dict ?? {}),
        terminal: {
          platform: process.platform,
          rowInstalled: has('terminals'),
          bashPath: text(TERMINAL_BASH_PATH_FIELD),
          status: text(TERMINAL_STATUS_FIELD),
          mode: ((): string => {
            try {
              const policy = doctorCtx.get('sandboxPolicy') as { resolve?: () => { mode?: unknown } } | undefined
              const mode = policy?.resolve?.().mode
              return typeof mode === 'string' ? mode : '拿不到'
            } catch {
              return '拿不到'
            }
          })(),
          hasSandbox: has('sandbox'),
        },
        persistentTerminals,
        header: {
          overlayInstalled: headerOverlayState.installed,
          hasLoader: has('loader'),
          migrated: pendingMigrations(own).length === 0,
          status: text(HEADER_STATUS_FIELD),
          // 0.22.0 起这条链不再写用户配置；真写了就是回归，自检要红。
          writesUserConfig: false,
          // 0.25.0：宿主自己会发这个头时，上面那些"挂没挂上"都不再重要（见 src/opencode-header.ts）。
          native: nativeSessionHeader().support === 'native',
          nativeEvidence: nativeSessionHeader().evidence,
        },
        quick: {
          file: quickStorePath(),
          readable: quickOutcome.kind === 'ok',
          custom: quickOutcome.kind === 'ok' ? bookLooksCustom(quickOutcome.book) : false,
          error: quickOutcome.kind === 'ok' ? '' : String(quickOutcome.kind),
        },
        notify: {
          enabled: bool(NOTIFY_ENABLED_FIELD),
          channel: text(NOTIFY_CHANNEL_FIELD),
          credentialSet: text(NOTIFY_PUSHPLUS_FIELD) !== '' || text(NOTIFY_WECOM_FIELD) !== '',
        },
        optimize: {
          tier: text(OPTIMIZER_TIER_FIELD),
          readTools: bool(OPTIMIZE_READ_TOOLS_FIELD),
          bashOn: bool(OPTIMIZE_BASH_FIELD),
          bashGate: '按会话权限判定（完全权限直跑；否则必须过沙箱，证明不了就不给）',
        },
        runtime: { node: process.version, dshVersion: '' },
      }
    }
    const handleDoctor = async (
      req: { method?: string },
      res: { writeHead: (code: number, headers: Record<string, string>) => void; end: (body?: string) => void },
    ): Promise<void> => {
      if ((req.method ?? 'GET').toUpperCase() !== 'GET') {
        sendDoctorJson(res, 405, { ok: false, error: '只接受 GET' })
        return
      }
      try {
        sendDoctorJson(res, 200, { ok: true, rows: buildDoctorReport(await collectDoctor()) })
      } catch (error: unknown) {
        sendDoctorJson(res, 500, { ok: false, error: errorText(error) })
      }
    }
    doctorCtx.effect(() => doctorCtx.webServer.register({
      kind: 'exact',
      path: DOCTOR_API_PATH,
      handler: handleDoctor as never,
    }), 'composer-ux: doctor route')
  })

  // ── 自启动（0.23.0）──────────────────────────────────────────────────────
  //
  // 用户 2026-10-15：「给我的插件添加一个 DSH 自启动功能，要有按钮开关」，并逐个选定：
  //   · 开关**跟着"你在哪个运行时里开"走** —— 网页版里开就注册网页版，桌面应用里开就注册桌面 exe；
  //   · **登录后**启动（`HKCU\...\Run`，无需管理员；关掉开关 = 删掉自己那一条）；
  //   · 网页版的控制台**最小化到任务栏**（wscript 跑 .vbs + Run(...,7,False)：中间不闪控制台，
  //     node 自己的窗口按"最小化"出现）；
  //   · 桌面端直接注册 exe（它是 Electron 应用，有托盘与单实例锁，重复启动只会聚焦已有窗口）。
  //
  // **真相来源是注册表**：设置里不存这个开关的意图 —— 你在系统里手动删了启动项，界面就该显示"关"。
  // 每个运行时只用**自己那一条**值名（`dsh-composer-ux:autostart:<profile>`），开关绝不动别人的条目。
  ctx.inject(['webServer'], (autoCtx) => {
    const sendAutoJson = (
      res: { writeHead: (code: number, headers: Record<string, string>) => void; end: (body?: string) => void },
      code: number,
      payload: unknown,
    ): void => {
      res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(payload))
    }

    /** 读请求体（开关只有一个布尔，给个很小的上限就够）。 */
    const readAutoBody = async (req: AsyncIterable<unknown>): Promise<string> => {
      const chunks: Buffer[] = []
      let total = 0
      for await (const chunk of req) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
        total += buf.length
        if (total > 64_000) throw new Error('请求体过大')
        chunks.push(buf)
      }
      return Buffer.concat(chunks).toString('utf8')
    }

    /**
     * 这个宿主进程是"桌面应用里那个"还是"命令行起的（网页版）"？
     *
     * 判据来自官方实现（2026-10-15 读 `apps/desktop/src/host-process.ts` + `node-environment.ts`）：
     * 桌面应用是**再 spawn 一个 node 子进程**跑宿主，并给它设 `ELECTRON_RUN_AS_NODE=1`，
     * 入口是 `@deepseek-ai/dsh-desktop-host/lib/index.js`。两条任一命中即为桌面端；
     * 注意 `process.versions.electron` 在这里**不可用**（宿主不是 Electron 进程本身）。
     */
    const runtime = (): AutostartRuntime => runtimeOf(process.argv[1])

    const profileNameOf = (): string => {
      try {
        const value = autoCtx.get('profileContext') as { name?: unknown } | undefined
        return typeof value?.name === 'string' ? value.name : ''
      } catch {
        return ''
      }
    }

    /**
     * 桌面应用那个 exe 的路径。
     *
     * 宿主是桌面的**子进程**，自己不知道 exe 在哪 —— 但父进程就是它（`process.ppid`），
     * 于是问一句系统要父进程的镜像路径。拿不到就返回空串：自检/卡片会如实说"拿不到"，
     * 而不是编一个像路径的东西出来。
     */
    const desktopExeOf = (): string => {
      if (process.platform !== 'win32') return ''
      try {
        const out = execFileSync('powershell.exe', [
          '-NoProfile', '-NonInteractive', '-Command',
          `(Get-Process -Id ${String(process.ppid)} -ErrorAction SilentlyContinue).Path`,
        ], { encoding: 'utf8', windowsHide: true, timeout: 8000 })
        const line = String(out).split(/\r?\n/u).map(item => item.trim()).find(item => item !== '')
        return line !== undefined && /\.exe$/iu.test(line) ? line : ''
      } catch {
        return ''
      }
    }

    /** 本插件自己的状态目录（`$DSH_HOME/composer-ux`）。 */
    const stateDirOf = (): string => join(dirname(quickStorePath()), 'composer-ux')

    /** 当前进程算出来的自启动计划（纯函数在 ./autostart.ts）。 */
    const planOf = (): AutostartPlan => {
      const kind = runtime()
      const profile = profileNameOf()
      const launch = launchCommand({
        node: nodeExecutableOf({ argv0: process.argv0, execPath: process.execPath, exists: existsSync }),
        argv1: process.argv[1],
        execArgv: process.execArgv,
        rest: process.argv.slice(2),
        cwd: process.cwd(),
        platform: process.platform,
        resolve,
        dirname,
      })
      const facts: AutostartFacts = {
        platform: process.platform,
        runtime: kind,
        profile,
        stateDir: stateDirOf(),
        desktopExe: kind === 'desktop' ? desktopExeOf() : '',
        launch,
      }
      return planAutostart(facts)
    }

    /** 读注册表里自己那一条。`error` 非空 = 读失败（没权限之类），空 = 成功（有没有值看 value）。 */
    const readEntry = (entryName: string): { value: string | undefined, error: string } => {
      if (process.platform !== 'win32') return { value: undefined, error: '' }
      try {
        // 读**整个键**再找自己那条（见 autostart.ts 的 listArgs 注释）：靠报错文本判断"值不存在"
        // 在本地化 + GBK 控制台下会变成乱码，真机上表现为"明明只是没这条值，却报读失败"。
        const out = execFileSync('reg.exe', [...listArgs()], { encoding: 'utf8', windowsHide: true, timeout: 8000 })
        return { value: parseQueryValue(entryName, out), error: '' }
      } catch (error: unknown) {
        // 退出码 1 = 键不在（Run 键正常都在；真不在就等于"没有这条值"，是诚实结论）。
        const status = (error as { status?: unknown }).status
        if (status === 1) return { value: undefined, error: '' }
        return {
          value: undefined,
          error: status === undefined
            ? '读注册表失败（reg.exe 没起来）'
            : '读注册表失败（reg.exe 退出码 ' + String(status) + '）',
        }
      }
    }

    /** 网页版的启动器脚本要真的落到磁盘上（注册表那条只是指向它）。 */
    const writeLauncher = (plan: AutostartPlan): void => {
      if (plan.launcher === undefined) return
      mkdirSync(dirname(plan.launcher.path), { recursive: true })
      writeFileSync(plan.launcher.path, plan.launcher.content, 'utf8')
    }

    const removeLauncher = (plan: AutostartPlan): void => {
      if (plan.launcher === undefined) return
      try {
        rmSync(plan.launcher.path, { force: true })
      } catch {
        /* 删不掉不影响功能：注册表那条已经删了，这个文件再没人执行 */
      }
    }

    const stateOf = (): AutostartState => {
      const plan = planOf()
      const read = readEntry(plan.entryName)
      return describeAutostart({
        platform: process.platform,
        plan,
        registered: read.value,
        readError: read.error,
      })
    }

    /** 注册/撤销。返回给客户端的是**重新读出来的真相**，不是"我以为写成功了"。 */
    const applyEnabled = (enabled: boolean): { ok: boolean, error: string } => {
      const unsupported = unsupportedReason(process.platform)
      if (unsupported !== '') return { ok: false, error: unsupported }
      const plan = planOf()
      if (enabled && runtime() === 'desktop' && plan.value.trim() === '""') {
        return { ok: false, error: '拿不到桌面应用的 exe 路径（父进程路径读不到），没法注册自启动' }
      }
      try {
        if (enabled) {
          writeLauncher(plan)
          execFileSync('reg.exe', [...addArgs(plan.entryName, plan.value)], { encoding: 'utf8', windowsHide: true, timeout: 8000 })
        } else {
          try {
            execFileSync('reg.exe', [...deleteArgs(plan.entryName)], { encoding: 'utf8', windowsHide: true, timeout: 8000 })
          } catch (error: unknown) {
            // 本来就没有这条值也算"关成功"。
            const text = errorText(error)
            if (!/找不到|cannot find|unable to find/iu.test(text)) throw error
          }
          removeLauncher(plan)
        }
        return { ok: true, error: '' }
      } catch (error: unknown) {
        const text = errorText(error)
        return {
          ok: false,
          error: /拒绝访问|Access is denied/iu.test(text)
            ? '没有权限写当前用户的启动项（被安全软件或组策略拦了？）'
            : `${enabled ? '注册' : '撤销'}失败：${text === '' ? '没有原因' : text}`,
        }
      }
    }

    /**
     * 「立即试一次」：用**注册的那条命令**真的拉一次，验证它在你这台机器上有效。
     *
     * 不重复启动：网页版若这个 profile 已经在服务（`webServer.port` 有值），只报告"已经在跑"；
     * 桌面端有单实例锁，重复启动只会聚焦已有窗口，所以直接拉。
     */
    const tryOnce = (): { ok: boolean, message: string } => {
      const unsupported = unsupportedReason(process.platform)
      if (unsupported !== '') return { ok: false, message: unsupported }
      const plan = planOf()
      if (runtime() === 'web') {
        const port = (() => {
          try {
            return (autoCtx.get('webServer') as { port?: unknown } | undefined)?.port
          } catch {
            return undefined
          }
        })()
        if (typeof port === 'number' && port > 0) {
          return { ok: true, message: `这个 profile 已经在服务（端口 ${String(port)}），没有重复启动；想看自启动的窗口效果就手动跑：${plan.describe}` }
        }
      }
      try {
        if (plan.launcher !== undefined) {
          writeLauncher(plan)
          const child = spawn('wscript.exe', [plan.launcher.path], { detached: true, stdio: 'ignore', windowsHide: true })
          child.unref()
          return { ok: true, message: `已按自启动那条命令拉起（最小化到任务栏）：${plan.describe}` }
        }
        const exe = plan.value.replace(/^"|"$/gu, '')
        const child = spawn(exe, [], { detached: true, stdio: 'ignore' })
        child.unref()
        return { ok: true, message: `已拉起桌面应用（有单实例锁，重复启动只会聚焦已有窗口）` }
      } catch (error: unknown) {
        return { ok: false, message: `试一次失败：${errorText(error)}` }
      }
    }

    const handleAutostart = async (
      req: { method?: string } & AsyncIterable<unknown>,
      res: { writeHead: (code: number, headers: Record<string, string>) => void; end: (body?: string) => void },
    ): Promise<void> => {
      const method = (req.method ?? 'GET').toUpperCase()
      try {
        if (method === 'GET') {
          sendAutoJson(res, 200, { ok: true, state: stateOf() })
          return
        }
        if (method !== 'POST') {
          sendAutoJson(res, 405, { ok: false, error: '只接受 GET / POST' })
          return
        }
        const raw = await readAutoBody(req)
        let body: Record<string, unknown> = {}
        if (raw.trim() !== '') {
          try {
            body = objectOf(JSON.parse(raw)) ?? {}
          } catch {
            sendAutoJson(res, 400, { ok: false, error: '请求体不是合法 JSON' })
            return
          }
        }
        if (body.action === 'try') {
          const result = tryOnce()
          sendAutoJson(res, result.ok ? 200 : 500, { ...result, state: stateOf(), action: 'try' })
          return
        }
        if (typeof body.enabled !== 'boolean') {
          sendAutoJson(res, 400, { ok: false, error: '要带 enabled: true/false（或 action: "try"）' })
          return
        }
        const applied = applyEnabled(body.enabled)
        sendAutoJson(res, applied.ok ? 200 : 500, {
          ok: applied.ok,
          error: applied.error,
          state: stateOf(),
          action: body.enabled ? 'on' : 'off',
        })
      } catch (error: unknown) {
        sendAutoJson(res, 500, { ok: false, error: errorText(error) })
      }
    }

    autoCtx.effect(() => autoCtx.webServer.register({
      kind: 'exact',
      path: AUTOSTART_API_PATH,
      handler: handleAutostart as never,
    }), 'composer-ux: autostart route')
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
      ppid: process.ppid,
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

    // ── 微信通知（0.17.0，单向）──────────────────────────────────────────
    //
    // 用户 2026-10-01：只要通知、不做双向、不走 OpenClaw。所以这里只有"往外推"，
    // 没有任何"往回收"的东西 —— 界面上也必须明说这一点。
    const readNotifySettings = (): NotifySettings => {
      // ⚠ 没找到 makeReader（可能不是模块级 import）：直读服务并**如实报错** ——
      // 绝不静默当成"配置为空"，那会让用户以为开关坏了。
      const service = restartCtx.get('settings') as unknown as { get?: (ns: string) => unknown } | undefined
      const raw = typeof service?.get === 'function' ? service.get(NAMESPACE) : undefined
      if (raw === undefined) throw new Error('读不到本插件的设置命名空间（这也说明 reader 没接对）')
      const all = sanitizeSettings(raw as Record<string, unknown>)
      return {
        enabled: all.notifyEnabled,
        channel: all.notifyChannel,
        pushplusToken: all.notifyPushplusToken,
        wecomWebhook: all.notifyWecomWebhook,
        kinds: all.notifyKinds,
      }
    }

    /** 宿主侧发一次 HTTP（凭据只进请求体，绝不进日志）。 */
    const notifyFetchText: NotifyIo['fetchText'] = async (url, init) => {
      const response = await fetch(url, { method: init.method, headers: { ...init.headers }, body: init.body })
      return { status: response.status, body: await response.text() }
    }

    // 「测试推送」：用户在设置页点一下，验证配置对不对（成败看 ok，原因来自渠道原话）。
    restartCtx.effect(() => restartCtx.webServer.register({
      kind: 'exact',
      path: NOTIFY_TEST_API_PATH,
      handler: createNotifyTestHandler({ readSettings: readNotifySettings, fetchText: notifyFetchText }),
    }))

    // 四个官方事件：只观察、不干预（approval/user-questions 是 waterfall，务必透传）。
    // 通知出错只留一行日志 —— 绝不能让"没人收到提醒"变成"审批界面卡住"。
    restartCtx.effect(() => {
      // 事件总线不一定是 cordis 的 ctx（宿主形态/测试替身可能不同）：没有 on 就**不挂**，
      // 并留下一句话 —— 绝不能因为通知没挂上而让宿主起不来。
      const bus = restartCtx as unknown as { on?: (name: string, handler: unknown) => unknown }
      if (typeof bus.on !== 'function') {
        console.warn('[composer-ux] 这个宿主没有事件总线（ctx.on），微信通知的事件钩子没挂上')
        return
      }
      const lastSent: Record<string, number> = {}
      const dispose = registerNotifyHooks({
        on: (name, handler) => bus.on?.(name, handler) as unknown as (() => void) | void,
        deliver: (event: NotifyEvent) => {
          void sendNotification(readNotifySettings(), event, { fetchText: notifyFetchText, lastSent })
            .then(outcome => {
              if (!outcome.sent && outcome.reason !== '') console.warn(`[composer-ux] 微信通知未发出：${outcome.reason}`)
            })
            .catch(error => { console.warn('[composer-ux] 微信通知异常', error) })
        },
        // TODO(0.17.x)：宿主里没有现成的"会话 id → 标题"查表，先给空串（消息省掉「会话：」那行）。
        titleOf: () => '',
        warn: (message: string) => { console.warn(`[composer-ux] ${message}`) },
      })
      return dispose
    })

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
        //
        // 0.15.2：判据拆成具名步骤，403 里带上**是哪一条不满足**与当时看到的事实 ——
        // 起因是两枚按钮都只报一句"不许"，查不出原因（见 explainRestartTrust 的注释）。
        // 先卡防跨站头（照 dsh-quick-restart 的顺序：头 → 来源）。
        // 这是桌面版（`dsh-app://` 来源）唯一真正需要的防线：跨站页面加不了自定义头。
        if (firstHeaderValue(req.headers?.[RESTART_CSRF_HEADER]) !== RESTART_CSRF_VALUE) {
          send(403, {
            ok: false,
            error: `缺少 ${RESTART_CSRF_HEADER}: ${RESTART_CSRF_VALUE} 头（跨站页面加不了这个头）`,
          })
          return
        }

        // 先卡防跨站头（照 dsh-quick-restart 的顺序：头 → 来源）。
        // 这是桌面版（页面来源是 `dsh-app://`）唯一真正需要的防线：跨站页面加不了自定义头。
        if (firstHeaderValue(req.headers?.[RESTART_CSRF_HEADER]) !== RESTART_CSRF_VALUE) {
          send(403, {
            ok: false,
            error: `缺少 ${RESTART_CSRF_HEADER}: ${RESTART_CSRF_VALUE} 头（跨站页面加不了这个头）`,
          })
          return
        }

        const trust = explainRestartTrust({
          remoteAddress: req.socket?.remoteAddress,
          headers: req.headers ?? {},
        })
        if (trust.reason !== 'ok') {
          send(403, {
            ok: false,
            error: 'restart is limited to same-origin loopback requests —— ' + restartTrustText(trust),
          })
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
