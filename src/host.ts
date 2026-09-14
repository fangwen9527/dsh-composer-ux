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
import z from '@deepseek-ai/schemastery'
import {
  DEFAULT_HEADER_NAME, DEFAULT_SETTINGS, ENABLED_FIELD, HEADER_APPLIED_NAME_FIELD,
  HEADER_APPLIED_VALUE_FIELD, HEADER_ENABLED_FIELD, HEADER_NAME_FIELD, HEADER_NAME_MAX,
  HEADER_ROUTES_FIELD, HEADER_STATUS_FIELD, HEADER_VALUE_FIELD, HEADER_VALUE_MAX,
  LLM_NAMESPACE, MENU_FIELDS, MENU_NATIVE_FIELD, NAMESPACE, NEWLINE_KEY_FIELD,
  OPENCODE_HOSTS, OPENCODE_ROUTE_PREFIX, PANEL_HEIGHT_FIELD, PANEL_RESIZE_FIELD, PANEL_SCROLL_FIELD,
  PANEL_WIDTH_FIELD, SEND_KEY_FIELD, newSessionId, parseRouteList,
} from './settings-contract.ts'

export const name = 'composer-ux'

/** 设置面板可调尺寸的上下限（与 client 侧的 clamp 保持一致）。 */
const PANEL_MIN = 560
const PANEL_MAX = 4000

/** 路径寻址写入：与 settings 服务的 SettingsPathOp 结构一致。 */
type PathOp =
  | { op: 'set'; path: readonly string[]; value: unknown }
  | { op: 'unset'; path: readonly string[] }

/** 本插件用到的 settings 能力（保持结构最小，避免依赖具体实现类）。 */
interface SettingsLike {
  get(ns: string): unknown
  mutate(ns: string, ops: readonly PathOp[]): Promise<void>
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
 * @param settings - settings 服务。
 */
async function mirrorHeader(settings: SettingsLike): Promise<void> {
  const own = objectOf(settings.get(NAMESPACE))
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

  const llm = objectOf(settings.get(LLM_NAMESPACE))
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

/** 注册 durable section；settings 服务缺席（无 provider）时静默跳过。 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(
      NAMESPACE,
      z.object({
        [ENABLED_FIELD]: z.boolean().default(DEFAULT_SETTINGS.enabled),
        [SEND_KEY_FIELD]: z.string().default(DEFAULT_SETTINGS.sendKey),
        [NEWLINE_KEY_FIELD]: z.string().default(DEFAULT_SETTINGS.newlineKey),
        ...Object.fromEntries(MENU_FIELDS.map(field => [
          field,
          z.boolean().default(DEFAULT_SETTINGS[field]),
        ])),
        [MENU_NATIVE_FIELD]: z.boolean().default(DEFAULT_SETTINGS.menuNative),
        [PANEL_SCROLL_FIELD]: z.boolean().default(DEFAULT_SETTINGS.panelScroll),
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
      }),
    )

    const settings = settingsCtx.settings as unknown as SettingsLike
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
      void mirrorHeader(settings)
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

    const onSettingsUpdated = (ns: unknown): void => {
      if (ns === NAMESPACE || ns === LLM_NAMESPACE) sync()
    }
    ctx.on('settings/updated' as never, onSettingsUpdated as never)
    // 启动即对齐一次：启用状态下的头即使在别处被抹掉，也会在此补回。
    sync()
  })
}
