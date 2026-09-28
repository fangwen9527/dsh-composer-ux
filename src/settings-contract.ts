/**
 * dsh-composer-ux 公共契约：设置字段、默认值、展示元数据。
 * 本模块必须零 import（host 与 client 两半共用，跨端不共享任何运行时身份）。
 *
 * 唯一的例外是几个**纯函数**模块（零外部依赖、无 DOM、无 node API）：
 * `./terminal/` 下那几个（「默认终端」的字段与判定）与 `./pricing.ts`（金额的刊例价与覆盖价
 * 语义）。两者都满足"两半共用同一份规则"的要求，且不引入任何运行时身份。
 */
import {
  parseHolidays, parsePriceEras, parsePriceOverrides,
  type PriceEra, type PriceOverrideTable,
} from './pricing.ts'
import {
  DEFAULT_TERMINAL_MODE, TERMINAL_BASH_PATH_FIELD, TERMINAL_CANDIDATES_FIELD,
  TERMINAL_EFFECTIVE_FIELD, TERMINAL_MODE_FIELD, TERMINAL_STATUS_FIELD,
  sanitizeTerminalCandidates, terminalModeFrom,
  type TerminalCandidate, type TerminalMode,
} from './terminal/contracts.ts'

/** Host settings namespace（小写字母/数字/连字符）。 */
export const NAMESPACE = 'composer-ux'

/**
 * 仓库地址：设置页抬头那个「GitHub ↗」链接用它。
 *
 * 必须与 `package.json` 的 `repository.url` 一致 —— `test/client-registration.mjs`
 * 有一条护栏盯着两处，免得各写一份然后慢慢分叉（客户端也不许硬编码第二份地址）。
 */
export const REPO_URL = 'https://github.com/fangwen9527/dsh-composer-ux'

// ── 「重启 DSH」按钮 ─────────────────────────────────────────────────────────
//
// 为什么这件事必须落在宿主半：只有宿主进程能把自己重新拉起来（浏览器碰不到进程）。
// 机制照搬插件市场（分离一个 node 助手进程、等端口空闲、用隐藏控制台的 PowerShell 起新宿主），
// 全部细节在 `src/restart.ts`。这里只有两端共用的那一个常量。
// 0.5.0 里那个「可选重启命令」字段已去掉：机制足够可靠之后它只剩"多一个会填错的地方"。

/** 重启接口路径（宿主半注册，客户端半调用）。 */
export const RESTART_API_PATH = '/composer-ux/restart'

/**
 * 「按 route 分列的用量」接口路径（0.8.0）。
 *
 * 为什么必须走宿主半：客户端只有整会话累计的 `tokenUsage` 与"最后一次"的 `modelSelection`，
 * 一个会话里换过 route 之后就无法归因；`session.events` 只有宿主能读。
 * 折叠规则与出处见 `src/usage-fold.ts` 文件头。
 */
export const USAGE_API_PATH = '/composer-ux/usage'

/**
 * 「金额」栏（0.10.0）：价目同步接口。
 *
 * 出网必须在宿主半：浏览器侧发不出跨域请求，也不该让 API Key/页面内容经过前端逻辑。
 * 请求体是一个 `{ target: 'official' | 'modelsDev' }`，两条路分别对应"官方价格页"
 * （两页约 24 KB）与"models.dev 注册表"（5.2 MB，故意做成独立按钮）。
 */
export const SYNC_API_PATH = '/composer-ux/sync-prices'

/** 全局总开关字段名。 */
export const ENABLED_FIELD = 'enabled'

// ── 「每一栏一个开关」 ───────────────────────────────────────────────────────
//
// 六张折叠卡各有一个"这一栏要不要生效"的开关，**默认关**；总开关（`enabled`）默认开，
// 它是一道总闸：`enabled && 该栏开关` 才生效。
//
// 为什么要有"从没碰过的栏才默认关"这条迁移规则（用户拍板 A 方案）：本插件已经发布过，
// 老用户设置文档里全是"我正在用"的痕迹。若一律默认关，升级那一刻他的键位就回到 DSH 原生、
// OpenCode 路由直接 400（请求头不再注入）、Git Bash 换回 PowerShell —— 全是要用到才发现的破坏。
// 所以：**这一栏的值不等于"从没碰过的样子" ⇒ 认定碰过 ⇒ 开**（判据见 `sectionEnabledOf`）。
// 全新安装（什么痕迹都没有）因此是六栏全关。规则的实现在下面 `sectionEnabledOf`。
//
// 「OpenCode 请求头」那一栏**没有新键**：它原来的 `headerEnabled`（默认 false）本来就是
// "这一栏要不要生效"，直接搬到标题行当卡级开关，不再造一个同义的键。

/** 「键位」栏开关。 */
export const KEYS_ENABLED_FIELD = 'keysEnabled'
/** 「右键菜单」栏开关。 */
export const MENU_ENABLED_FIELD = 'menuEnabled'
/** 「快捷指令」栏开关。 */
export const QUICK_ENABLED_FIELD = 'quickEnabled'
/** 「设置面板」栏开关。 */
export const PANEL_ENABLED_FIELD = 'panelEnabled'
/** 「默认终端」栏开关。 */
export const TERMINAL_ENABLED_FIELD = 'terminalEnabled'

// ── 「统计行」（0.7.0 新增，第 7 栏）─────────────────────────────────────────
//
// 与上面五栏**规则不同**，这一点必须显式写下来，否则后来的人会照抄 sectionEnabledOf：
// 那五栏默认关、靠"用户碰过没"迁移，是因为它们**已经发布过**——一律默认关会把老用户正在
// 用的键位/请求头/终端当场关掉。而「统计行」是新能力，没有任何"碰过"的痕迹可依，
// 且用户 2026-09-28 明确要求"装完就生效"，所以它是**普通布尔字段、默认开**（同
// `headerEnabled` 的写法，只是默认值相反）。因此它不进 SECTION_SIGNALS。
//
// 这一栏**只有这一个键**：曾经还有 `statsPrecision` / `statsWiden` 两个子开关（三位小数 /
// 加宽统计行），但「加宽」做完真机核对后被用户拍板撤掉（前提不成立，理由见
// `src/client/stats-line.ts` 文件头），只剩一个功能就不该再设同义的子开关 ——
// 与「OpenCode 请求头」那一栏同一处理。

/** 「统计行」栏开关：是否把输入框下方那行的缓存命中率改成三位小数。 */
export const STATS_ENABLED_FIELD = 'statsEnabled'

/**
 * 「金额」栏（0.9.1）：用户覆盖价（按模型给高峰/空闲两档的三项单价）。
 *
 * 为什么是**一个**字段而不是每格一个字段：模型名是用户自己加的（中转/自建路由的名字
 * 事先不知道），做成 `priceFlashPeakMiss` 这种平铺字段就没法覆盖任意模型；而 schemastery
 * 对未声明键原样放行、设置服务只要求"路径上的节点 volatile"，所以整张表存成一个键最省事，
 * 也最容易整体备份/清空（键消失 = 全部回到官方价）。
 *
 * 值不符合形状时**整项丢掉**（`parsePriceOverrides`）：与其它字段同一态度，
 * 一个手抖的逗号不该把整页设置打成默认。
 */
export const PRICE_OVERRIDES_FIELD = 'priceOverrides'

/**
 * 「金额」栏（0.10.0）：节假日表 —— **北京日历日**的 `YYYY-MM-DD` 数组，命中的一天全天按谷价。
 *
 * `undefined` = 用内置那份（`pricing.ts` 的 `DEFAULT_PEAK_HOLIDAYS`，来源是国务院办公厅
 * 2026 年安排）。为什么要让用户能改：国务院每年底才公布次年安排，而内置表只跟我们的发版走；
 * 官方临时调整放假安排、或到了下一年而我们还没发版时，他不该干等。
 *
 * 与 `priceOverrides` 不同，这一项是**普通数组字段**（键固定，不是动态键），所以声明得出来，
 * 官方设置页的表单也能直接读写它。
 */
export const PEAK_HOLIDAYS_FIELD = 'peakHolidays'

/** 「金额」栏（0.10.0）：峰谷提醒的开关与提前量。 */
export const PEAK_ALERT_FIELD = 'peakAlert'

/**
 * 「金额」栏（0.10.0）：**自动同步官方价**（默认**关**）。
 *
 * 打开后宿主半每天最多自动抓一次官方价格页：进程启动时先查一次，之后每 30 分钟查一次
 * "距上次同步是否够 24 小时"。默认关的理由：这是个会**自己出网**的开关，不该由插件替用户
 * 决定；而"抓失败绝不覆盖本地价"那条纪律对自动同步同样成立（失败只写日志，界面上仍显示
 * 上次成功的时间）。
 */
export const PRICE_AUTO_SYNC_FIELD = 'priceAutoSync'

/** 「金额」栏（0.10.0）：余额查询开关（关掉就不显示余额行、也不发任何出网请求）。 */
export const BALANCE_ENABLED_FIELD = 'balanceEnabled'

/**
 * 「金额」栏（0.10.0）：**同步来的价目**（官方价历史档 + 第三方价目的元信息）。
 *
 * 为什么用 `z.any()`：`eras` 里的键是官方后来才出现的模型名（动态键），与 `priceOverrides`
 * 同一个理由。第三方价目本身（models.dev 那份，可能几百 KB）**不放在这里**：它落在插件自己的
 * storages 目录（`prices.json`），设置文档里只留"什么时候同步的、有多少条"，
 * 免得把 settings.yaml 撑大、也免得每次设置读写都拖着几百 KB 走。
 */
export const SYNCED_PRICES_FIELD = 'syncedPrices'

/** 峰谷提醒设置。 */
export interface PeakAlertSettings {
  /** 总开关。默认**开**。 */
  readonly enabled: boolean
  /** 提前多少分钟提醒（1–60，默认 5）。 */
  readonly aheadMinutes: number
  /** 进入高峰前提醒。 */
  readonly onPeak: boolean
  /** 离开高峰（进入空闲档）前提醒。 */
  readonly onOffPeak: boolean
  /** 除了胶囊里那行提示，再发一条浏览器系统通知（需用户授权）。默认**关**。 */
  readonly webNotify: boolean
}

/** 峰谷提醒的默认值（提前 5 分钟、两个方向都提醒、不发系统通知）。 */
export const DEFAULT_PEAK_ALERT: PeakAlertSettings = {
  enabled: true,
  aheadMinutes: 5,
  onPeak: true,
  onOffPeak: true,
  webNotify: false,
}

/** 同步来的价目元信息（真正的第三方价目在宿主半的 `prices.json` 里）。 */
export interface SyncedPrices {
  /** 最近一次同步官方价的时刻（毫秒）。 */
  readonly fetchedAt?: number
  /** 同步到的官方价历史档（比内置的更新时才有）。 */
  readonly eras?: readonly PriceEra[]
  /** 最近一次从 models.dev 同步第三方价的时刻（毫秒）。 */
  readonly modelsDevAt?: number
  /** 那次同步拿到多少条第三方模型价。 */
  readonly modelsDevCount?: number
}

/** 键位字段名。 */
export const SEND_KEY_FIELD = 'sendKey'
export const NEWLINE_KEY_FIELD = 'newlineKey'

/**
 * 设置面板字段名。
 *
 * 0.6.0 起**没有** `panelScroll`：DSH 0.1.7 的官方设置页给导航列自带
 * `overflow-y: auto`（`ui-settings-general` 的 `.navList`），我们那套
 * `html.dsh-ux-panel-scroll` 注入样式已被官方取代，故整项删除。
 */
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

/**
 * 右键菜单模式字段名（0.5.0 起三档）。
 *
 * 0.2.x～0.4.0 用的是布尔 `menuNative`：true = 浏览器原生菜单、false = 自定义菜单。
 * 布尔只有两位，表达不了「插件完全不介入」（不挡别的插件的菜单）这一档，所以换成
 * 字符串三档。旧字段**只作为迁移线索保留**：本字段为空时按旧字段推断（见 `menuModeFrom`）。
 */
export const MENU_MODE_FIELD = 'menuMode'

/** 0.2.x～0.4.0 的旧字段名：迁移线索，0.5.0 起不再写它。 */
export const MENU_NATIVE_FIELD = 'menuNative'

/** 右键菜单模式：官方不介入 / 浏览器菜单 / 自定义菜单。 */
export type MenuMode = 'official' | 'browser' | 'custom'

/** 三档的元数据（数组顺序即界面顺序）。 */
export const MENU_MODES: readonly {
  readonly id: MenuMode
  readonly label: string
  readonly hint: string
}[] = [
  {
    id: 'official',
    label: '官方',
    hint: '本插件完全不介入：DSH 与其它插件自己的右键处理原样生效（DSH 官方输入框本身没有右键菜单，通常看到的就是浏览器的菜单）',
  },
  {
    id: 'browser',
    label: '浏览器',
    hint: '固定使用浏览器自带的菜单，并在本插件这一层挡住其它插件的菜单；粘贴免授权、零配置',
  },
  {
    id: 'custom',
    label: '自定义',
    hint: '使用本插件的固定样式菜单；未选中文本时「剪切 / 复制 / 删除」置灰，粘贴需要浏览器剪贴板授权',
  },
]

/**
 * 定出右键菜单模式：新字段优先，其次按旧布尔推断，都没有就用默认档。
 *
 * 三种情况判断得出来，是因为宿主半把旧字段声明成**可选**（没有 `.default(false)`）：
 * 「从没碰过那个开关」与「明确关了它」在文档里长得不一样（键不存在 / 键为 false），
 * 前者落到新默认档（官方不介入），后者保持原来的自定义菜单。
 * @param storedMode - 文档里的新字段值（可能是脏数据）。
 * @param legacyNative - 文档里的旧布尔值（可能不存在）。
 * @returns 三档之一。
 */
export function menuModeFrom(storedMode: unknown, legacyNative: unknown): MenuMode {
  if (storedMode === 'official' || storedMode === 'browser' || storedMode === 'custom') return storedMode
  if (legacyNative === true) return 'browser'
  if (legacyNative === false) return 'custom'
  return DEFAULT_SETTINGS.menuMode
}

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
  /** 「每次」：每次发送都自动附加到消息末尾。与 `firstOnly` 互斥。 */
  readonly always: boolean
  /**
   * 「仅首次」：只在**这个会话的第一条消息**上附加。
   *
   * 判据是会话快照的 `blank`（会话还没有任何消息）——发完第一条它自己就变成 false，
   * 所以不需要我们自己记「这次会话附加过没有」，刷新页面也不会重复附加。
   * 与 `always` 互斥（界面上是三选一）。
   */
  readonly firstOnly: boolean
}

/** 插入模式：界面上那条三选一。 */
export type InsertMode = 'never' | 'always' | 'first'

/** 三选一的元数据（数组顺序即界面顺序）。 */
export const INSERT_MODES: readonly {
  readonly id: InsertMode
  readonly label: string
  readonly hint: string
}[] = [
  { id: 'never', label: '关', hint: '点条目只插入输入框，发送时不附加' },
  { id: 'always', label: '每次', hint: '每次发送都把这条附加到消息末尾' },
  { id: 'first', label: '仅首次', hint: '只在当前会话的第一条消息上附加' },
]

/**
 * 读一条的插入模式。
 *
 * 两个标志都是 true 时按「每次」处理（手工编辑的文件可能写成这样；「每次」本来就
 * 包含第一次），并且下一次写盘会把互斥性修正回来。
 */
export function insertModeOf(prompt: Pick<QuickPrompt, 'always' | 'firstOnly'>): InsertMode {
  if (prompt.always) return 'always'
  if (prompt.firstOnly) return 'first'
  return 'never'
}

/**
 * 优化强度档位。
 *
 * 提示词初版逐字提取自 WestFox-AwA/dsh-prompt-optimizer（BSD-3-Clause，作者「啃轮胎的西狐」）；
 * 0.6.0 起按对方 **0.6 线**（`po06/lib/interpreter.js`）的机制重写：模型不再自由改写，
 * 而是产出「可定位到原话某一段」的条目，由宿主逐条做字面比对后再装配成一条命令。
 * 档位语义也随之对齐对方「档位 = 依据预算」的说法（见 `optimizer-prompt.ts`）。
 */
export type OptimizerTier = 'basic' | 'advanced' | 'extreme'

/** 档位元数据（顺序即界面顺序）。 */
export const OPTIMIZER_TIERS: readonly {
  readonly id: OptimizerTier
  readonly label: string
  readonly hint: string
}[] = [
  { id: 'basic', label: '普通', hint: '只做语言层修复：病句、错别字、指代与含糊词，不新增任何需求，篇幅约为原文 1.4 倍。' },
  { id: 'advanced', label: '高级', hint: '在不动目标的前提下，把「你显然想要、但没说出口」的必要要求补成对 AI 的要求，每条都要指回你原话里的某一句。' },
  { id: 'extreme', label: '极端', hint: '按复杂任务处理：在上面基础上再加分阶段执行计划与 2~4 种情况的预案。' },
]

/** 默认档位。 */
export const DEFAULT_OPTIMIZER_TIER: OptimizerTier = 'advanced'

/**
 * 每个档位的「自定义系统提示词」字段名。
 *
 * 为什么是三个平铺字符串而不是一个对象：与本插件其它可编辑项一致（设置页按字段名读写、
 * 宿主半的 schema 也是平铺 key），且**留空 = 用内置那份**这个语义用空串表达最直接 ——
 * 不需要额外一个"是否自定义"的布尔（多一个布尔就多一种自相矛盾的状态）。
 */
export const OPTIMIZER_PROMPT_FIELDS = {
  basic: 'optimizerPromptBasic',
  advanced: 'optimizerPromptAdvanced',
  extreme: 'optimizerPromptExtreme',
} as const

/** 全部档位的自定义提示词字段名（顺序即档位顺序）。 */
export const OPTIMIZER_PROMPT_FIELD_LIST: readonly string[] =
  OPTIMIZER_TIERS.map(item => OPTIMIZER_PROMPT_FIELDS[item.id])

/**
 * 自定义提示词的字数上限。
 *
 * 与 `QUICK_TEXT_MAX` 不同：这里存的是**模型指令**而不是用户内容，内置那三份都在 3–5 KB，
 * 给 2 万字符足够容纳用户的改写，又能挡住"把设置文档撑成一本书"。
 */
export const OPTIMIZER_PROMPT_MAX = 20_000

/**
 * 按档位取自定义提示词的字段名。
 * @param tier - 档位 id；未知值回落到默认档（与 `buildOptimizeSystem` 同一口径）。
 * @returns 该档位对应的设置字段名。
 */
export function optimizerPromptFieldOf(tier: string): string {
  return OPTIMIZER_PROMPT_FIELDS[tier as OptimizerTier] ?? OPTIMIZER_PROMPT_FIELDS[DEFAULT_OPTIMIZER_TIER]
}

/**
 * 内置的 9 条快捷指令 = 用户口述的 4 条 + 提取自 congyaqwq/dsh-quick-prompts 的 5 条。
 *
 * 说明（如实记录调研结果）：另外两个同名插件 lcsdg / lnyuqian 的
 * dsh-quick-prompts **不带内置指令**（列表默认是空的，靠用户自建），
 * 所以从它们那里没有可提取的条目。
 */
export const DEFAULT_QUICK_PROMPTS: readonly QuickPrompt[] = [
  { id: 'builtin-1', label: '一问一答', prompt: '你不懂的就问我，一问一答；同时说清楚你为什么要问该问题；直到你对我的目标有明确认知后再开始干活。', always: false, firstOnly: false },
  { id: 'builtin-2', label: '交接文档', prompt: '把这次任务、已完成内容、当前卡点、下一步计划、踩过的坑，整理成一份交接文档，写给新会话看。', always: false, firstOnly: false },
  { id: 'builtin-3', label: '仅说明原因', prompt: '仅说明原因，不要做其他动作。', always: false, firstOnly: false },
  { id: 'builtin-4', label: '分析后直接干', prompt: '分析原因，然后直接开始干活，不需要过问我。', always: false, firstOnly: false },
  { id: 'builtin-5', label: '提交代码', prompt: '请帮我提交代码：检查当前 git 变更，生成规范的 commit message 并执行提交。', always: false, firstOnly: false },
  { id: 'builtin-6', label: '给方案', prompt: '请针对上面的问题给出一个完整方案，包括思路、步骤、注意事项和风险。', always: false, firstOnly: false },
  { id: 'builtin-7', label: '解释代码', prompt: '请解释这段代码的作用和实现思路。', always: false, firstOnly: false },
  { id: 'builtin-8', label: '写测试', prompt: '请为下面的代码编写单元测试。', always: false, firstOnly: false },
  { id: 'builtin-9', label: '代码审查', prompt: '请对下面的代码进行代码审查，指出问题并给出改进建议。', always: false, firstOnly: false },
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
    /** 「仅首次」标志（我们的扩展键；参考实现会忽略它，写回时可能丢掉）。 */
    readonly autoSendFirst?: boolean
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
    prompt: {
      id,
      label: label === '' ? prompt.slice(0, 12) : label,
      prompt,
      always: row.always === true || row.autoSend === true,
      firstOnly: row.firstOnly === true || row.autoSendFirst === true,
    },
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
    // 空分类**保留**（这点与参考实现不同）：面板的「＋」只是新建一个分类，用户接下来
    // 才会往里放条目；若在这里丢掉，点「＋」就会看起来毫无反应（0.3.0 真机上踩到）。
    // 空分类在文件里也是合法状态，数量上限由 QUICK_CATEGORY_MAX 兜住。
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
        // 「仅首次」是我们加的键，只在为真时写出来：文件形状尽量贴近参考实现。
        ...(prompt.firstOnly ? { autoSendFirst: true } : {}),
        order: index + 1,
      })),
    })),
  }
}

/** 跨分类拍平（面板列表、总条数统计用）。 */
export function flattenQuickPrompts(book: QuickPromptBook): readonly QuickPrompt[] {
  return book.categories.flatMap(category => category.prompts)
}

/** 只取「每次」的那些（每次发送都附加；跨所有分类）。 */
export function alwaysQuickPrompts(book: QuickPromptBook): readonly QuickPrompt[] {
  return flattenQuickPrompts(book).filter(prompt => insertModeOf(prompt) === 'always')
}

/** 只取「仅首次」的那些（跨所有分类）。 */
export function firstOnlyQuickPrompts(book: QuickPromptBook): readonly QuickPrompt[] {
  return flattenQuickPrompts(book).filter(prompt => insertModeOf(prompt) === 'first')
}

/**
 * 这一次发送要附加的批次。
 *
 * @param book 当前这本。
 * @param blank 会话快照的 `blank`：true = 这个会话还没有任何消息（也就是第一条）。
 * @returns 顺序 = 「每次」的那些，再跟上「仅首次」的那些（仅首次只在第一条上出现）。
 */
export function appendBatchForSend(book: QuickPromptBook, blank: boolean): readonly QuickPrompt[] {
  const every = alwaysQuickPrompts(book)
  if (!blank) return every
  return [...every, ...firstOnlyQuickPrompts(book)]
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
 *
 * 「默认终端」的三个自持字段同理：候选表与状态是**宿主半的探测结果**，
 * 清掉之后界面会变成"没探测过"的样子（而实际还在用某个 bash），
 * 用户点一次「恢复默认」就会看到自相矛盾的状态。
 */
export const HOST_OWNED_FIELDS = [
  HEADER_APPLIED_NAME_FIELD,
  HEADER_APPLIED_VALUE_FIELD,
  HEADER_STATUS_FIELD,
  TERMINAL_CANDIDATES_FIELD,
  TERMINAL_STATUS_FIELD,
  TERMINAL_EFFECTIVE_FIELD,
  // 「金额」（0.10.0）：同步来的价目元信息由宿主半在"一键同步"里写（界面只读展示）。
  SYNCED_PRICES_FIELD,
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
  | typeof KEYS_ENABLED_FIELD
  | typeof MENU_ENABLED_FIELD
  | typeof QUICK_ENABLED_FIELD
  | typeof PANEL_ENABLED_FIELD
  | typeof TERMINAL_ENABLED_FIELD
  | typeof SEND_KEY_FIELD
  | typeof NEWLINE_KEY_FIELD
  | typeof PANEL_RESIZE_FIELD
  | typeof PANEL_WIDTH_FIELD
  | typeof PANEL_HEIGHT_FIELD
  | typeof MENU_NATIVE_FIELD
  | typeof MENU_MODE_FIELD
  | typeof HEADER_ENABLED_FIELD
  | typeof HEADER_NAME_FIELD
  | typeof HEADER_VALUE_FIELD
  | typeof HEADER_ROUTES_FIELD
  | typeof QUICK_PROMPTS_FIELD
  | typeof OPTIMIZER_TIER_FIELD
  | typeof OPTIMIZER_PROMPT_FIELDS.basic
  | typeof OPTIMIZER_PROMPT_FIELDS.advanced
  | typeof OPTIMIZER_PROMPT_FIELDS.extreme
  | typeof TERMINAL_MODE_FIELD
  | typeof TERMINAL_BASH_PATH_FIELD
  | typeof STATS_ENABLED_FIELD
  | typeof PRICE_OVERRIDES_FIELD
  | typeof PEAK_HOLIDAYS_FIELD
  | typeof PEAK_ALERT_FIELD
  | typeof BALANCE_ENABLED_FIELD
  | typeof SYNCED_PRICES_FIELD
  | typeof PRICE_AUTO_SYNC_FIELD
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
  /** 全局总开关：false 时本插件所有功能停用。默认**开**。 */
  enabled: boolean
  /**
   * 六栏各自的开关：`enabled && 该栏开关` 才生效。默认**关**（老用户按"碰过没"迁移，见
   * `sectionEnabledOf`）。「OpenCode 请求头」那一栏直接用 `headerEnabled`，没有单独的键。
   */
  keysEnabled: boolean
  menuEnabled: boolean
  quickEnabled: boolean
  panelEnabled: boolean
  terminalEnabled: boolean
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
  /**
   * 右键菜单模式（官方不介入 / 浏览器菜单 / 自定义菜单）。
   * 文档里没有这个字段时按旧布尔 `menuNative` 推断，见 `menuModeFrom`。
   */
  menuMode: MenuMode
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
  /**
   * 三档的**自定义**系统提示词；留空 = 用 `optimizer-prompt.ts` 里的内置那份。
   *
   * 改的是「任务与风格」那一段；JSON 输出契约由插件在末尾追加、不由这里控制
   * （它的作用是让宿主能按逐字依据校验每一条，被改掉整个机制就失效了）。
   */
  optimizerPromptBasic: string
  optimizerPromptAdvanced: string
  optimizerPromptExtreme: string
  /**
   * 「默认终端」档位：自动 / Git Bash / PowerShell。只对 Windows 生效
   * （非 Windows 上宿主半直接跳过，卡片显示"不需要"）。
   */
  terminalMode: TerminalMode
  /** 用户指定的 Git Bash 路径；留空 = 用探测到的第一个候选。 */
  terminalBashPath: string
  /** 宿主半探测到的候选（只读展示，见 HOST_OWNED_FIELDS）。 */
  terminalCandidates: readonly TerminalCandidate[]
  /** 宿主半写的状态行：当前生效 shell / 为什么没生效（只读展示）。 */
  terminalStatus: string
  /** 宿主半写的当前生效 shell：'bash' / 'pwsh'（只读展示）。 */
  terminalEffective: string
  /**
   * 「统计行」栏开关（0.7.0）：默认**开**。
   *
   * 与上面五栏的迁移规则不同：那五栏默认关是因为它们已发布过、默认关会打断正在用的人；
   * 这一栏是新能力，用户要求装完即生效，所以按普通布尔字段处理（同 `headerEnabled`）。
   */
  statsEnabled: boolean
  /**
   * 「金额」栏（0.9.1）：用户覆盖价 —— 按模型给高峰/空闲两档的三项单价（人民币 / 1M tokens）。
   *
   * `undefined` = 全部沿用内置刊例价（**默认**，也是"清空"的终态）。键是模型名：既可以是
   * 内置的三个，也可以用户自己加（中转/自建路由的名字，那些名字不在刊例表里，
   * 不覆盖就只能按 `deepseek-flash` 估价）。
   */
  priceOverrides?: PriceOverrideTable
  /** 「金额」（0.10.0）：节假日表；`undefined` = 用内置那份（`DEFAULT_PEAK_HOLIDAYS`）。 */
  peakHolidays?: readonly string[]
  /** 「金额」（0.10.0）：峰谷提醒的开关与提前量。 */
  peakAlert: PeakAlertSettings
  /** 「金额」（0.10.0）：是否查询并显示余额（默认开；关掉就不发出网请求）。 */
  balanceEnabled: boolean
  /** 「金额」（0.10.0）：同步来的价目元信息（宿主半写、界面只读展示）。 */
  syncedPrices?: SyncedPrices
  /** 「金额」（0.10.0）：自动同步官方价（每天最多一次）。默认**关** —— 会自己出网的开关不该默认开。 */
  priceAutoSync: boolean
}

/** 默认值 = DSH Web 现状（Enter 发送、Shift+Enter 换行、右键菜单全开）。 */
export const DEFAULT_SETTINGS: ComposerUxSettings = {
  // 总开关默认开：它只是总闸，真正"要不要用这一栏"由下面五个开关决定（默认关）。
  enabled: true,
  // 五栏默认关（老文档由 sectionEnabledOf 迁移成"碰过就开"）。
  keysEnabled: false,
  menuEnabled: false,
  quickEnabled: false,
  panelEnabled: false,
  terminalEnabled: false,
  sendKey: 'Enter',
  newlineKey: 'Shift+Enter',
  menuUndo: true,
  menuRedo: true,
  menuCut: true,
  menuCopy: true,
  menuPaste: true,
  menuDelete: true,
  menuSelectAll: true,
  menuMode: 'official',
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
  // 空串 = 用内置提示词。默认必须是空串：它同时就是「恢复内置」要写回去的值。
  optimizerPromptBasic: '',
  optimizerPromptAdvanced: '',
  optimizerPromptExtreme: '',
  terminalMode: DEFAULT_TERMINAL_MODE,
  terminalBashPath: '',
  terminalCandidates: [],
  terminalStatus: '',
  terminalEffective: '',
  // 「统计行」（0.7.0）：默认开 —— 用户 2026-09-28 要的是"装完立刻看得到效果"，
  // 所以这一栏不参与下面那套"碰过才开"的迁移（见 STATS_ENABLED_FIELD 上方的说明）。
  statsEnabled: true,
  // 「金额」（0.9.1）：默认没有覆盖价 = 全部按内置刊例价估算（与 0.8.0 的行为一致）。
  priceOverrides: undefined,
  // 「金额」（0.10.0）：节假日表留空 = 用内置（国务院 2026 年安排那份）。
  peakHolidays: undefined,
  peakAlert: DEFAULT_PEAK_ALERT,
  // 余额默认开：它是"看一眼就知道还能不能跑"的东西；关掉是给不想出网的人留的开关。
  balanceEnabled: true,
  syncedPrices: undefined,
  // 自动同步默认**关**：用户没点过就不该有定时出网。
  priceAutoSync: false,
}

/**
 * 七栏里哪几栏生效：**总开关 +（OpenCode / 统计行那两栏用自己的字段）+ 该栏开关**。
 *
 * 宿主半与客户端半都走这一个函数，免得有人只看了栏开关、忘了总闸（或者反过来）。
 */export function activeSections(settings: ComposerUxSettings): {
  readonly keys: boolean
  readonly menu: boolean
  readonly quick: boolean
  readonly panel: boolean
  readonly header: boolean
  readonly terminal: boolean
  readonly stats: boolean
} {
  const on = settings.enabled
  return {
    keys: on && settings.keysEnabled,
    menu: on && settings.menuEnabled,
    quick: on && settings.quickEnabled,
    panel: on && settings.panelEnabled,
    header: on && settings.headerEnabled,
    terminal: on && settings.terminalEnabled,
    stats: on && settings.statsEnabled,
  }
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

/**
 * 每栏的"用户碰过没"判据（迁移规则用，见文件上方那段说明）。
 *
 * ⚠️ 判据必须是「**值不等于"从没碰过"的样子**」，不能是「键存在」：
 * `settings.get()` 给的是**已解析**的值（schema 默认值 + 组合 base + 用户层），
 * 所以从没碰过的人的文档里也照样有 `sendKey: 'Enter'`、`panelScroll: true` 这些默认值 ——
 * 按"键存在"判断会让全新安装六栏全开，与"默认关"正好相反。
 * （第一版就写成了"键存在"，是推理 + 测试当场逮住的，注释留在这里防复发。）
 *
 * 另外：宿主半自持字段（`terminalStatus` / `terminalCandidates` / `terminalEffective` /
 * `headerApplied*`）**不许**当判据 —— 它们是插件自己写的，全新安装也会出现。
 *
 * 「快捷指令」栏还有一个文档里看不出来的信号：0.3.0 起条目搬到了 `quick-prompts.json`，
 * 用过的人和没用过的人的设置文档可以一模一样。那一条由宿主半读文件后**一次性写回文档**
 * （见 `src/host.ts` 的 `migrateQuickSection`），所以这里只剩"文档里的列表被改过"这一次级信号。
 */
const SECTION_SIGNALS: Readonly<Record<string, (source: Record<string, unknown>) => boolean>> = {
  [KEYS_ENABLED_FIELD]: source =>
    touched(source, SEND_KEY_FIELD, DEFAULT_SETTINGS.sendKey)
    || touched(source, NEWLINE_KEY_FIELD, DEFAULT_SETTINGS.newlineKey),
  // 「官方」＝本插件不介入，等价于关；所以只有选过另外两档才算"碰过"。
  // （`menuModeFrom` 对"两个键都没有"给的就是 'official'，天然满足"缺省 = 默认"。）
  [MENU_ENABLED_FIELD]: source =>
    menuModeFrom(source[MENU_MODE_FIELD], source[MENU_NATIVE_FIELD]) !== 'official',
  [QUICK_ENABLED_FIELD]: source =>
    (Array.isArray(source[QUICK_PROMPTS_FIELD])
      && source[QUICK_PROMPTS_FIELD].length !== DEFAULT_QUICK_PROMPTS.length)
    || touched(source, OPTIMIZER_TIER_FIELD, DEFAULT_OPTIMIZER_TIER),
  [PANEL_ENABLED_FIELD]: source =>
    touched(source, PANEL_RESIZE_FIELD, true)
    || source[PANEL_WIDTH_FIELD] !== undefined
    || source[PANEL_HEIGHT_FIELD] !== undefined,
  [TERMINAL_ENABLED_FIELD]: source =>
    touched(source, TERMINAL_MODE_FIELD, DEFAULT_TERMINAL_MODE)
    || touched(source, TERMINAL_BASH_PATH_FIELD, ''),
}

/**
 * 这个键在文档里**出现过**，且值不等于"从没碰过的样子"。
 *
 * 两个条件缺一不可，而且第二半极易漏：文档里没有这个键时值是 `undefined`，
 * 拿它去比默认值会得出"不相等 ⇒ 碰过"（`'' !== 'Enter'`、`undefined !== true` 都是真），
 * 于是全新安装六栏全开 —— 与"默认关"正好相反。第一版就是这么写的，被测试当场逮住。
 */
function touched(source: Record<string, unknown>, field: string, untouched: unknown): boolean {
  const value = source[field]
  return value !== undefined && value !== untouched
}

/**
 * 算出一栏开关的值：显式写过就听它的，否则按"用户碰过没"推断。
 * @param field 栏开关字段名。
 * @param source 设置文档（解析后的值；缺省的键会被 schemastery 省掉，所以 undefined 就是"没写过"）。
 * @returns 该栏是否生效。
 */
export function sectionEnabledOf(field: string, source: Record<string, unknown>): boolean {
  const explicit = source[field]
  if (typeof explicit === 'boolean') return explicit
  const signal = SECTION_SIGNALS[field]
  return signal === undefined ? false : signal(source)
}

/**
 * 峰谷提醒净化：逐项收窄，坏值退回默认（**不整份丢** —— 用户只是把提前量填歪了，
 * 不该顺手把他关掉的系统通知又打开）。
 */
export function sanitizePeakAlert(raw: unknown): PeakAlertSettings {
  const row = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const bool = (key: keyof PeakAlertSettings, fallback: boolean): boolean =>
    typeof row[key] === 'boolean' ? (row[key] as boolean) : fallback
  const ahead = typeof row.aheadMinutes === 'number' && Number.isFinite(row.aheadMinutes)
    ? Math.min(60, Math.max(1, Math.round(row.aheadMinutes)))
    : DEFAULT_PEAK_ALERT.aheadMinutes
  return {
    enabled: bool('enabled', DEFAULT_PEAK_ALERT.enabled),
    aheadMinutes: ahead,
    onPeak: bool('onPeak', DEFAULT_PEAK_ALERT.onPeak),
    onOffPeak: bool('onOffPeak', DEFAULT_PEAK_ALERT.onOffPeak),
    webNotify: bool('webNotify', DEFAULT_PEAK_ALERT.webNotify),
  }
}

/**
 * 同步元信息净化：时间戳只认正的有限数、计数只认非负有限数，价档交给 `parsePriceEras`
 * （那个会逐条消毒，坏档丢掉）。整份什么都没有就是 `undefined`（= 从没同步过）。
 */
export function parseSyncedPrices(raw: unknown): SyncedPrices | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const row = raw as Record<string, unknown>
  const stamp = (key: string): number | undefined => {
    const value = row[key]
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : undefined
  }
  const count = (key: string): number | undefined => {
    const value = row[key]
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined
  }
  const fetchedAt = stamp('fetchedAt')
  const modelsDevAt = stamp('modelsDevAt')
  const modelsDevCount = count('modelsDevCount')
  const eras = parsePriceEras(row.eras)
  const out: SyncedPrices = {
    ...(fetchedAt === undefined ? {} : { fetchedAt }),
    ...(eras === undefined ? {} : { eras }),
    ...(modelsDevAt === undefined ? {} : { modelsDevAt }),
    ...(modelsDevCount === undefined ? {} : { modelsDevCount }),
  }
  return Object.keys(out).length > 0 ? out : undefined
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
  /**
   * 自定义提示词专用：**超上限就截断**，而不是像 `asText` 那样整份丢掉。
   *
   * 为什么这里与 headerName 那条相反：头名非法是"写进去会出网出错"，丢掉是对的；
   * 而提示词是**用户自己敲的内容**，静默丢弃等于把他的工作弄没了。截断至少留得下大半，
   * 且设置页里当场看得见被截断后的样子（textarea 有 maxLength，正常根本走不到这里，
   * 只有手改 settings.yaml 才会）。
   */
  const asPrompt = (field: string, max: number): string => {
    const v = source[field]
    return typeof v === 'string' ? v.slice(0, max) : ''
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
      out.push({
        id,
        label: label === '' ? prompt.slice(0, 12) : label,
        prompt,
        always: row.always === true,
        firstOnly: row.firstOnly === true,
      })
    }
    return out
  }
  const asTier = (): OptimizerTier => {
    const v = source[OPTIMIZER_TIER_FIELD]
    return v === 'basic' || v === 'advanced' || v === 'extreme' ? v : DEFAULT_OPTIMIZER_TIER
  }
  return {
    enabled: asBool(ENABLED_FIELD),
    // 五栏开关：显式写过听它的，否则按"用户碰过没"迁移（见 sectionEnabledOf）。
    keysEnabled: sectionEnabledOf(KEYS_ENABLED_FIELD, source),
    menuEnabled: sectionEnabledOf(MENU_ENABLED_FIELD, source),
    quickEnabled: sectionEnabledOf(QUICK_ENABLED_FIELD, source),
    panelEnabled: sectionEnabledOf(PANEL_ENABLED_FIELD, source),
    terminalEnabled: sectionEnabledOf(TERMINAL_ENABLED_FIELD, source),
    sendKey: asString(SEND_KEY_FIELD),
    newlineKey: asString(NEWLINE_KEY_FIELD),
    menuUndo: asBool('menuUndo'),
    menuRedo: asBool('menuRedo'),
    menuCut: asBool('menuCut'),
    menuCopy: asBool('menuCopy'),
    menuPaste: asBool('menuPaste'),
    menuDelete: asBool('menuDelete'),
    menuSelectAll: asBool('menuSelectAll'),
    menuMode: menuModeFrom(source[MENU_MODE_FIELD], source[MENU_NATIVE_FIELD]),
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
    optimizerPromptBasic: asPrompt(OPTIMIZER_PROMPT_FIELDS.basic, OPTIMIZER_PROMPT_MAX),
    optimizerPromptAdvanced: asPrompt(OPTIMIZER_PROMPT_FIELDS.advanced, OPTIMIZER_PROMPT_MAX),
    optimizerPromptExtreme: asPrompt(OPTIMIZER_PROMPT_FIELDS.extreme, OPTIMIZER_PROMPT_MAX),
    terminalMode: terminalModeFrom(source[TERMINAL_MODE_FIELD]),
    // 路径只做长度与归一化收窄，不在这里判"存不存在"——那是宿主半的探测结论，
    // 由状态行告诉用户（用户看得见自己填了什么，比悄悄清空好）。
    terminalBashPath: asText(TERMINAL_BASH_PATH_FIELD, 400),
    terminalCandidates: sanitizeTerminalCandidates(source[TERMINAL_CANDIDATES_FIELD]),
    terminalStatus: asText(TERMINAL_STATUS_FIELD, 400),
    terminalEffective: asText(TERMINAL_EFFECTIVE_FIELD, 16),
    // 「统计行」（0.7.0）：普通布尔字段、默认开 —— **不走** sectionEnabledOf（那套是给
    // 已发布的五栏做"碰过才开"迁移用的；新栏没有痕迹可依，且用户要求默认生效）。
    statsEnabled: asBool(STATS_ENABLED_FIELD),
    // 「金额」（0.9.1）：整张覆盖价表，形状不对的项由 parsePriceOverrides 逐项丢掉。
    priceOverrides: parsePriceOverrides(source[PRICE_OVERRIDES_FIELD]),
    // 「金额」（0.10.0）：节假日表（坏日期逐条丢）、峰谷提醒、余额开关、同步元信息。
    peakHolidays: parseHolidays(source[PEAK_HOLIDAYS_FIELD]),
    peakAlert: sanitizePeakAlert(source[PEAK_ALERT_FIELD]),
    balanceEnabled: asBool(BALANCE_ENABLED_FIELD),
    syncedPrices: parseSyncedPrices(source[SYNCED_PRICES_FIELD]),
    priceAutoSync: asBool(PRICE_AUTO_SYNC_FIELD),
  }
}
