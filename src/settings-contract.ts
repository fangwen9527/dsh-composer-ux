/**
 * dsh-composer-ux 公共契约：设置字段、默认值、展示元数据。
 * 本模块必须零 import（host 与 client 两半共用，跨端不共享任何运行时身份）。
 */

/** Host settings namespace（小写字母/数字/连字符）。 */
export const NAMESPACE = 'composer-ux'

/** 全局总开关字段名。 */
export const ENABLED_FIELD = 'enabled'

/** 键位字段名。 */
export const SEND_KEY_FIELD = 'sendKey'
export const NEWLINE_KEY_FIELD = 'newlineKey'

/** 设置面板字段名。 */
export const PANEL_SCROLL_FIELD = 'panelScroll'
export const PANEL_RESIZE_FIELD = 'panelResize'
export const PANEL_WIDTH_FIELD = 'panelWidth'
export const PANEL_HEIGHT_FIELD = 'panelHeight'

/** 右键菜单开关字段名。 */
export const MENU_FIELDS = [
  'menuUndo',
  'menuRedo',
  'menuCut',
  'menuCopy',
  'menuPaste',
  'menuDelete',
  'menuSelectAll',
] as const

export type MenuField = (typeof MENU_FIELDS)[number]

/** 右键菜单模式字段名：true = 浏览器原生菜单（粘贴免授权），false = 自定义菜单。 */
export const MENU_NATIVE_FIELD = 'menuNative'

// ── 快捷指令与提示词优化 ─────────────────────────────────────────────────────

/** 快捷指令列表字段名。 */
export const QUICK_PROMPTS_FIELD = 'quickPrompts'

/** 优化强度档位字段名。 */
export const OPTIMIZER_TIER_FIELD = 'optimizerTier'

/** 单个分类内的条数上限。 */
export const QUICK_PROMPT_MAX = 60

/** 分类数上限。 */
export const QUICK_CATEGORY_MAX = 20

/** 分类名的字符上限。 */
export const QUICK_CATEGORY_NAME_MAX = 40

/** 单条「名称」的字符上限。 */
export const QUICK_LABEL_MAX = 40

/**
 * 单条「提示词」的字符上限。
 *
 * 0.3.0 起快捷指令改存 `$DSH_HOME/quick-prompts.json`，不再受设置文档的体积约束，
 * 所以这里从 4000 提到 20 万——只做「别把几百 MB 塞进来」的防呆，正常提示词不再被截断。
 */
export const QUICK_TEXT_MAX = 200_000

/**
 * 送去「优化提示词」的原文上限。
 *
 * 与原 `QUICK_TEXT_MAX * 2`（= 8000）等值：抬高等快捷指令的存储上限时**不能**
 * 顺带把优化请求的输入上限也抬上去，否则超长文本会被丢给模型。
 */
export const OPTIMIZE_TEXT_MAX = 8_000

/**
 * 快捷指令存储的 HTTP 路径（宿主半注册，客户端半读写）。
 *
 * 为什么存储也必须走 HTTP：浏览器侧没有文件系统，而「用户内容」需要一份
 * 全局、与会话/项目无关的落点，只有宿主半能提供。
 */
export const QUICK_PROMPTS_API_PATH = '/composer-ux/prompts'

/** 文件格式版本；与 lnyuqian/dsh-quick-prompts 的 v2 对齐（见 bookToFile 注释）。 */
export const QUICK_BOOK_VERSION = 2

/** 迁移/兜底分类名。 */
export const DEFAULT_CATEGORY_NAME = '默认'

/** 优化结果长度上限（超过视为异常产出，截断并提示）。 */
export const OPTIMIZE_OUTPUT_MAX = 12000

/**
 * 宿主半为「优化提示词」注册的 HTTP 接口路径。
 *
 * 为什么必须走 HTTP：出网请求由宿主的模型适配器发出（浏览器侧碰不到模型路由），
 * 而宿主半 <-> 客户端半之间没有别的受支持通道 —— 与
 * WestFox-AwA/dsh-prompt-optimizer 的做法一致。
 */
export const OPTIMIZER_API_PATH = '/composer-ux/optimize'

/**
 * 一条快捷指令。
 *
 * `always` 就是界面上的「默认插入」：勾上之后，点发送时这条提示词会被
 * 自动拼到消息**末尾**一起发出去（输入框里不提前显示），见
 * `client/quick-commands.ts` 的 `appendAlwaysPrompts()`。
 */
export interface QuickPrompt {
  /** 稳定 id：编辑名称/内容时不变，用于勾选状态与列表 diff。 */
  readonly id: string
  /** 按钮上显示的名称。 */
  readonly label: string
  /** 点击后插入输入框的提示词正文。 */
  readonly prompt: string
  /** 默认插入：发送时自动附加到消息末尾。 */
  readonly always: boolean
}

/**
 * 优化强度档位。
 *
 * 三档的系统提示词提取自 WestFox-AwA/dsh-prompt-optimizer（BSD-3-Clause，
 * 作者「啃轮胎的西狐」）的 `lib/index.js`，见 `optimizer-prompt.ts`。
 */
export type OptimizerTier = 'basic' | 'advanced' | 'extreme'

/** 档位元数据（顺序即界面顺序）。 */
export const OPTIMIZER_TIERS: readonly {
  readonly id: OptimizerTier
  readonly label: string
  readonly hint: string
}[] = [
  { id: 'basic', label: '普通', hint: '只做语言层修复：病句、错别字、指代与含糊词，不新增任何需求，篇幅与原文相当。' },
  { id: 'advanced', label: '高级', hint: '在不动目标的前提下，把「你显然想要、但没说出口」的必要要求补成对 AI 的要求，让它一次做对。' },
  { id: 'extreme', label: '极端', hint: '按复杂任务处理：固化命令结构 + 分阶段执行计划 + 2~4 种情况的预案。' },
]

/** 默认档位。 */
export const DEFAULT_OPTIMIZER_TIER: OptimizerTier = 'advanced'

/**
 * 内置的 9 条快捷指令 = 用户口述的 4 条 + 提取自 congyaqwq/dsh-quick-prompts 的 5 条。
 *
 * 说明（如实记录调研结果）：另外两个同名插件 lcsdg / lnyuqian 的
 * dsh-quick-prompts **不带内置指令**（列表默认是空的，靠用户自建），
 * 所以从它们那里没有可提取的条目。
 */
export const DEFAULT_QUICK_PROMPTS: readonly QuickPrompt[] = [
  { id: 'builtin-1', label: '一问一答', prompt: '你不懂的就问我，一问一答；同时说清楚你为什么要问该问题；直到你对我的目标有明确认知后再开始干活。', always: false },
  { id: 'builtin-2', label: '交接文档', prompt: '把这次任务、已完成内容、当前卡点、下一步计划、踩过的坑，整理成一份交接文档，写给新会话看。', always: false },
  { id: 'builtin-3', label: '仅说明原因', prompt: '仅说明原因，不要做其他动作。', always: false },
  { id: 'builtin-4', label: '分析后直接干', prompt: '分析原因，然后直接开始干活，不需要过问我。', always: false },
  { id: 'builtin-5', label: '提交代码', prompt: '请帮我提交代码：检查当前 git 变更，生成规范的 commit message 并执行提交。', always: false },
  { id: 'builtin-6', label: '给方案', prompt: '请针对上面的问题给出一个完整方案，包括思路、步骤、注意事项和风险。', always: false },
  { id: 'builtin-7', label: '解释代码', prompt: '请解释这段代码的作用和实现思路。', always: false },
  { id: 'builtin-8', label: '写测试', prompt: '请为下面的代码编写单元测试。', always: false },
  { id: 'builtin-9', label: '代码审查', prompt: '请对下面的代码进行代码审查，指出问题并给出改进建议。', always: false },
]

/** 生成一条新快捷指令的 id（时间戳 + 随机后缀，避免与既有 id 碰撞）。 */
export function newQuickPromptId(): string {
  return `qp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// ── 快捷指令：分类结构与文件映射 ─────────────────────────────────────────────
//
// 0.3.0 起快捷指令不再存在设置文档里，而是存在 `$DSH_HOME/quick-prompts.json`。
// 原因是设置文档对**数组**是「整份替换」、且受 schema 长度上限约束（旧 4000 字会静默
// 截断），而快捷指令是用户内容、会写很长的提示词。专用文件还便于单独备份与迁移。
//
// 文件字段名与 lnyuqian/dsh-quick-prompts 对齐（categories / name / title / text /
// autoSend / order），这样同一个文件两边都读得懂：内部用 label/prompt/always，
// 只在文件边界映射（见 bookToFile / asPromptRow）。
// ⚠️ 但**不要同时装两个插件**——同一个文件两个写者会互相覆盖，而它那边是非原子写。

/** 生成一个新分类 id。 */
export function newQuickCategoryId(): string {
  return `qc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** 一个分类：名字 + 它自己的条目列表（顺序即显示顺序）。 */
export interface QuickPromptCategory {
  readonly id: string
  readonly name: string
  readonly prompts: readonly QuickPrompt[]
}

/** 全局快捷指令本：分类两级结构，落盘成一份 JSON 文件。 */
export interface QuickPromptBook {
  readonly version: number
  readonly categories: readonly QuickPromptCategory[]
}

/** 内置默认本：一个「默认」分类装那 9 条。 */
export function defaultQuickBook(): QuickPromptBook {
  return {
    version: QUICK_BOOK_VERSION,
    categories: [{ id: 'cat-default', name: DEFAULT_CATEGORY_NAME, prompts: DEFAULT_QUICK_PROMPTS }],
  }
}

/** 文件里的分类形状（写盘用；与参考实现同名字段）。 */
export interface QuickCategoryFileRow {
  readonly id: string
  readonly name: string
  readonly prompts: readonly {
    readonly id: string
    readonly title: string
    readonly text: string
    readonly autoSend: boolean
    readonly order: number
  }[]
}

/** 收窄一条：内部字段名（label/prompt/always）与文件字段名（title/text/autoSend）都认。 */
function asPromptRow(value: unknown): { readonly prompt: QuickPrompt; readonly order?: number } | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const row = value as Record<string, unknown>
  const either = (first: unknown, second: unknown): string => {
    const picked = typeof first === 'string' && first !== '' ? first : second
    return typeof picked === 'string' ? picked : ''
  }
  const prompt = either(row.prompt, row.text).slice(0, QUICK_TEXT_MAX).trim()
  if (prompt === '') return undefined
  const label = either(row.label, row.title).slice(0, QUICK_LABEL_MAX).trim()
  const id = typeof row.id === 'string' && row.id !== '' ? row.id.slice(0, 64) : newQuickPromptId()
  const order = typeof row.order === 'number' && Number.isFinite(row.order)
    ? Math.max(1, Math.round(row.order))
    : undefined
  return {
    prompt: { id, label: label === '' ? prompt.slice(0, 12) : label, prompt, always: row.always === true || row.autoSend === true },
    order,
  }
}

/** 收窄一个列表：按 id 去重保序、按 order 升序（没有 order 的保持原相对位置）、限量。 */
function toPromptList(values: readonly unknown[]): readonly QuickPrompt[] {
  const rows: { prompt: QuickPrompt; order?: number; index: number }[] = []
  for (const value of values) {
    const row = asPromptRow(value)
    if (row !== undefined) rows.push({ ...row, index: rows.length })
  }
  rows.sort((a, b) => {
    const left = a.order ?? Number.MAX_SAFE_INTEGER
    const right = b.order ?? Number.MAX_SAFE_INTEGER
    return left === right ? a.index - b.index : left - right
  })
  const seen = new Set<string>()
  const out: QuickPrompt[] = []
  for (const row of rows) {
    if (out.length >= QUICK_PROMPT_MAX) break
    if (seen.has(row.prompt.id)) continue
    seen.add(row.prompt.id)
    out.push(row.prompt)
  }
  return out
}

/**
 * 把任意来源收窄成一本（文件内容、HTTP 请求体都走这里）。
 * @param value 任意值。
 * @returns 收窄后的本；**认不出的形状返回 undefined** —— 调用方必须把它当成损坏，
 *          绝不能回退成空本再写回去（那会把用户数据抹掉）。
 */
export function sanitizeBook(value: unknown): QuickPromptBook | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const source = value as Record<string, unknown>

  // v1 平铺（裸数组，或 { prompts: [...] }）：升级成一个「默认」分类。
  const flat = Array.isArray(value) ? value : (Array.isArray(source.prompts) ? source.prompts : undefined)
  if (flat !== undefined) {
    const prompts = toPromptList(flat)
    return {
      version: QUICK_BOOK_VERSION,
      categories: prompts.length === 0
        ? []
        : [{ id: 'cat-default', name: DEFAULT_CATEGORY_NAME, prompts }],
    }
  }

  if (!Array.isArray(source.categories)) return undefined
  const seen = new Set<string>()
  const categories: QuickPromptCategory[] = []
  for (const raw of source.categories) {
    if (categories.length >= QUICK_CATEGORY_MAX) break
    if (typeof raw !== 'object' || raw === null) continue
    const row = raw as Record<string, unknown>
    const prompts = toPromptList(Array.isArray(row.prompts) ? row.prompts : [])
    if (prompts.length === 0) continue // 与参考实现一致：空分类不保留
    const wanted = typeof row.id === 'string' && row.id !== '' ? row.id.slice(0, 64) : newQuickCategoryId()
    const id = seen.has(wanted) ? newQuickCategoryId() : wanted
    seen.add(id)
    const name = (typeof row.name === 'string' ? row.name : '').slice(0, QUICK_CATEGORY_NAME_MAX).trim()
    categories.push({ id, name: name === '' ? DEFAULT_CATEGORY_NAME : name, prompts })
  }
  return { version: QUICK_BOOK_VERSION, categories }
}

/** 内部结构 → 文件结构（写盘时用；顺序即 order）。 */
export function bookToFile(book: QuickPromptBook): { version: number; categories: readonly QuickCategoryFileRow[] } {
  return {
    version: QUICK_BOOK_VERSION,
    categories: book.categories.map(category => ({
      id: category.id,
      name: category.name,
      prompts: category.prompts.map((prompt, index) => ({
        id: prompt.id,
        title: prompt.label,
        text: prompt.prompt,
        autoSend: prompt.always,
        order: index + 1,
      })),
    })),
  }
}

/** 跨分类拍平（面板列表、总条数统计用）。 */
export function flattenQuickPrompts(book: QuickPromptBook): readonly QuickPrompt[] {
  return book.categories.flatMap(category => category.prompts)
}

/** 只取勾了「默认插入」的那些（发送时自动附加；跨所有分类）。 */
export function alwaysQuickPrompts(book: QuickPromptBook): readonly QuickPrompt[] {
  return flattenQuickPrompts(book).filter(prompt => prompt.always)
}

// ── OpenCode 请求头 ─────────────────────────────────────────────────────────
//
// OpenCode 的接口要求客户端每次请求都带一个稳定的会话 ID 请求头
// （官方 Go 文档「可以在哪里使用？」第 3 条）。DSH 的 Models 设置页明确不提供
// 请求头编辑器，所以本插件把这一项写进 llm-pi-ai 的 provider profile.headers ——
// 那是 DSH 里唯一受支持的出网请求头入口（会在 pi-ai 侧最后合并，下一次请求生效）。

/** 请求头栏目字段名。 */
export const HEADER_ENABLED_FIELD = 'headerEnabled'
export const HEADER_NAME_FIELD = 'headerName'
export const HEADER_VALUE_FIELD = 'headerValue'
/** 作用路由名单（逗号/空格分隔）；留空 = 自动匹配 OpenCode 路由（见 OPENCODE_ROUTE_PREFIX / OPENCODE_HOSTS）。 */
export const HEADER_ROUTES_FIELD = 'headerRoutes'

/** 宿主半记账：上次实际写入的头名与值（决定停用/改名时撤销哪些键）。 */
export const HEADER_APPLIED_NAME_FIELD = 'headerAppliedName'
export const HEADER_APPLIED_VALUE_FIELD = 'headerAppliedValue'

/** 宿主半写入的执行结果；设置页只读展示。 */
export const HEADER_STATUS_FIELD = 'headerStatus'

/**
 * 只在宿主半维护的字段：设置页「恢复默认」不得清空它们，
 * 否则已写入的头会失去记账、永远撤销不掉。
 */
export const HOST_OWNED_FIELDS = [
  HEADER_APPLIED_NAME_FIELD,
  HEADER_APPLIED_VALUE_FIELD,
  HEADER_STATUS_FIELD,
] as const

/** 请求头最终落地的设置命名空间（由 llm-pi-ai 注册）。 */
export const LLM_NAMESPACE = 'llm-pi-ai'

/**
 * 自动匹配的两条判据（满足其一即算 OpenCode 路由）：
 *  1. 路由名以 `opencode` 开头——DSH 内置的 `opencode-go` 就属于这种，
 *     它的 baseURL 由 pi-ai 目录内置，配置里读不到，只能靠名字。
 *  2. 该路由的 `baseURL` 主机是 opencode.ai（含子域）——用户自建路由常起任意名字
 *     （例如 `go`），但端点照样是 OpenCode，按 URL 认比按名字认可靠。
 */
export const OPENCODE_ROUTE_PREFIX = 'opencode'

/** 判据 2 用的主机名（含子域）。 */
export const OPENCODE_HOSTS = ['opencode.ai'] as const

/** 头名默认值 = OpenCode 官方要求的那一个。 */
export const DEFAULT_HEADER_NAME = 'x-opencode-session'

/** 头值长度上限（HTTP 头与设置文档都不宜过长）。 */
export const HEADER_VALUE_MAX = 200

/** 头名长度上限。 */
export const HEADER_NAME_MAX = 64

/** 全部可持久化字段。 */
export type SettingsField =
  | typeof ENABLED_FIELD
  | typeof SEND_KEY_FIELD
  | typeof NEWLINE_KEY_FIELD
  | typeof PANEL_SCROLL_FIELD
  | typeof PANEL_RESIZE_FIELD
  | typeof PANEL_WIDTH_FIELD
  | typeof PANEL_HEIGHT_FIELD
  | typeof MENU_NATIVE_FIELD
  | typeof HEADER_ENABLED_FIELD
  | typeof HEADER_NAME_FIELD
  | typeof HEADER_VALUE_FIELD
  | typeof HEADER_ROUTES_FIELD
  | typeof QUICK_PROMPTS_FIELD
  | typeof OPTIMIZER_TIER_FIELD
  | MenuField

/** 鼠标右键菜单打开时的一次快照（含位置与选择状态）。 */
export interface MenuState {
  /** 视口坐标。 */
  readonly x: number
  readonly y: number
  /** 右键时输入框内是否有非折叠选区（决定剪切/复制/删除是否可用）。 */
  readonly hasSelection: boolean
  /** 粘贴失败时的短暂提示。 */
  readonly note?: string
}

/** 解析后的设置。 */
export interface ComposerUxSettings {
  /** 全局总开关：false 时本插件所有功能停用。 */
  enabled: boolean
  /** 发送键位规范串（如 'Enter'、'Ctrl+Enter'、''=无）。 */
  sendKey: string
  /** 换行键位规范串。 */
  newlineKey: string
  menuUndo: boolean
  menuRedo: boolean
  menuCut: boolean
  menuCopy: boolean
  menuPaste: boolean
  menuDelete: boolean
  menuSelectAll: boolean
  /** true = 浏览器原生右键菜单（粘贴免授权）；false = 自定义菜单。 */
  menuNative: boolean
  /** 设置面板：条目过多时导航列可滚动。 */
  panelScroll: boolean
  /** 设置面板：允许拖拽边缘调整大小。 */
  panelResize: boolean
  /** 设置面板宽（px）；缺省使用官方默认 800。 */
  panelWidth?: number
  /** 设置面板高（px）；缺省使用官方默认 min(800, 视口-48)。 */
  panelHeight?: number
  /** OpenCode 请求头：启用后写进 llm-pi-ai 的 opencode 系路由。 */
  headerEnabled: boolean
  /** 头名（默认 x-opencode-session）。 */
  headerName: string
  /** 头值；留空时首次启用由宿主半生成一个稳定 ID 并落盘沿用。 */
  headerValue: string
  /** 作用路由名单；留空 = 自动匹配 opencode 系路由（只动已存在的路由）。 */
  headerRoutes: string
  /** 宿主半记账字段（设置页只读）。 */
  headerAppliedName: string
  headerAppliedValue: string
  /** 宿主半写入结果（设置页只读）。 */
  headerStatus: string
  /** 快捷指令列表（顺序即面板与设置页里的显示顺序）。 */
  quickPrompts: readonly QuickPrompt[]
  /** 提示词优化强度档位。 */
  optimizerTier: OptimizerTier
}

/** 默认值 = DSH Web 现状（Enter 发送、Shift+Enter 换行、右键菜单全开）。 */
export const DEFAULT_SETTINGS: ComposerUxSettings = {
  enabled: true,
  sendKey: 'Enter',
  newlineKey: 'Shift+Enter',
  menuUndo: true,
  menuRedo: true,
  menuCut: true,
  menuCopy: true,
  menuPaste: true,
  menuDelete: true,
  menuSelectAll: true,
  menuNative: false,
  panelScroll: true,
  panelResize: true,
  headerEnabled: false,
  headerName: DEFAULT_HEADER_NAME,
  headerValue: '',
  headerRoutes: '',
  headerAppliedName: '',
  headerAppliedValue: '',
  headerStatus: '',
  quickPrompts: DEFAULT_QUICK_PROMPTS,
  optimizerTier: DEFAULT_OPTIMIZER_TIER,
}

/** 设置页「键位」一节的预设。 */
export const SEND_PRESETS: readonly string[] = ['Enter', 'Ctrl+Enter', 'Alt+Enter', 'Shift+Enter']
export const NEWLINE_PRESETS: readonly string[] = ['Shift+Enter', 'Enter', 'Ctrl+Enter', 'Alt+Enter']

/** 右键菜单条目（顺序即显示顺序；shortcut 与图片一致）。 */
export const MENU_ITEMS: readonly {
  readonly field: MenuField
  readonly label: string
  readonly shortcut: string
}[] = [
  { field: 'menuUndo', label: '撤销', shortcut: 'Ctrl+Z' },
  { field: 'menuRedo', label: '重做', shortcut: 'Ctrl+Y' },
  { field: 'menuCut', label: '剪切', shortcut: 'Ctrl+X' },
  { field: 'menuCopy', label: '复制', shortcut: 'Ctrl+C' },
  { field: 'menuPaste', label: '粘贴', shortcut: 'Ctrl+V' },
  { field: 'menuDelete', label: '删除', shortcut: '' },
  { field: 'menuSelectAll', label: '全选', shortcut: 'Ctrl+A' },
]

/**
 * 生成一个稳定的会话 ID（UUID v4；无 crypto 时退回等价的随机十六进制）。
 * 值本身不参与鉴权，只用于让网关把同一段对话固定到同一个上游，故 Math.random 兜底可接受。
 * @returns 36 字符的 UUID 字符串。
 */
export function newSessionId(): string {
  const bag = globalThis as unknown as { crypto?: { randomUUID?: () => string } }
  if (typeof bag.crypto?.randomUUID === 'function') return bag.crypto.randomUUID()
  const hex = (count: number): string => Array.from(
    { length: count },
    () => Math.floor(Math.random() * 16).toString(16),
  ).join('')
  return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`
}

/** 解析「作用路由」文本：逗号 / 空格 / 换行分隔，去重保序。 */
export function parseRouteList(text: string): readonly string[] {
  const parts = text.split(/[\s,，、]+/).map(item => item.trim()).filter(item => item !== '')
  return [...new Set(parts)]
}

/** 设置数据净化：把线上值收窄为安全形状（防脏数据）。 */
export function sanitizeSettings(value: unknown): ComposerUxSettings {
  const source = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
  const asString = (field: string): string => {
    const v = source[field]
    return typeof v === 'string' && v.length > 0 && v.length <= 64 ? v : ''
  }
  const asText = (field: string, max: number): string => {
    const v = source[field]
    return typeof v === 'string' && v.length <= max ? v : ''
  }
  const asBool = (field: string): boolean => {
    const v = source[field]
    return typeof v === 'boolean' ? v : (DEFAULT_SETTINGS as unknown as Record<string, unknown>)[field] as boolean
  }
  const asSize = (field: string): number | undefined => {
    const v = source[field]
    return typeof v === 'number' && Number.isFinite(v) && v >= 320 && v <= 4000 ? Math.round(v) : undefined
  }
  /**
   * 净化快捷指令列表：逐条收窄形状，丢掉残缺项，并按 id 去重保序。
   * 字段缺失 / 不是数组（首次启用）→ 回落到内置 9 条；字段是数组就照它来，
   * 空数组也是合法状态（用户把条目全删光，就应当保持全空，不再自动冒出来）。
   */
  const asQuickPrompts = (): readonly QuickPrompt[] => {
    const raw = source[QUICK_PROMPTS_FIELD]
    if (!Array.isArray(raw)) return DEFAULT_QUICK_PROMPTS
    const seen = new Set<string>()
    const out: QuickPrompt[] = []
    for (const item of raw) {
      if (out.length >= QUICK_PROMPT_MAX) break
      if (typeof item !== 'object' || item === null) continue
      const row = item as Record<string, unknown>
      const prompt = typeof row.prompt === 'string' ? row.prompt.slice(0, QUICK_TEXT_MAX).trim() : ''
      if (prompt === '') continue
      const label = typeof row.label === 'string' ? row.label.slice(0, QUICK_LABEL_MAX).trim() : ''
      const id = typeof row.id === 'string' && row.id !== '' ? row.id.slice(0, 64) : newQuickPromptId()
      if (seen.has(id)) continue
      seen.add(id)
      out.push({ id, label: label === '' ? prompt.slice(0, 12) : label, prompt, always: row.always === true })
    }
    return out
  }
  const asTier = (): OptimizerTier => {
    const v = source[OPTIMIZER_TIER_FIELD]
    return v === 'basic' || v === 'advanced' || v === 'extreme' ? v : DEFAULT_OPTIMIZER_TIER
  }
  return {
    enabled: asBool(ENABLED_FIELD),
    sendKey: asString(SEND_KEY_FIELD),
    newlineKey: asString(NEWLINE_KEY_FIELD),
    menuUndo: asBool('menuUndo'),
    menuRedo: asBool('menuRedo'),
    menuCut: asBool('menuCut'),
    menuCopy: asBool('menuCopy'),
    menuPaste: asBool('menuPaste'),
    menuDelete: asBool('menuDelete'),
    menuSelectAll: asBool('menuSelectAll'),
    menuNative: asBool(MENU_NATIVE_FIELD),
    panelScroll: asBool(PANEL_SCROLL_FIELD),
    panelResize: asBool(PANEL_RESIZE_FIELD),
    panelWidth: asSize(PANEL_WIDTH_FIELD),
    panelHeight: asSize(PANEL_HEIGHT_FIELD),
    headerEnabled: asBool(HEADER_ENABLED_FIELD),
    // 头名留空是不合法状态（宿主半会拒绝写入并把原因写进 headerStatus），
    // 故净化只做长度收窄、保留原样，让用户看得见自己输错了什么。
    headerName: asText(HEADER_NAME_FIELD, HEADER_NAME_MAX),
    headerValue: asText(HEADER_VALUE_FIELD, HEADER_VALUE_MAX),
    headerRoutes: asText(HEADER_ROUTES_FIELD, HEADER_VALUE_MAX),
    headerAppliedName: asText(HEADER_APPLIED_NAME_FIELD, HEADER_NAME_MAX),
    headerAppliedValue: asText(HEADER_APPLIED_VALUE_FIELD, HEADER_VALUE_MAX),
    headerStatus: asText(HEADER_STATUS_FIELD, HEADER_VALUE_MAX),
    quickPrompts: asQuickPrompts(),
    optimizerTier: asTier(),
  }
}
