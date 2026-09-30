/**
 * 快捷指令 / 默认插入 / 提示词优化 的行为测试。
 *
 * 分三块：
 *  1. 纯函数：设置净化、末尾拼接语义、发送键图形判别（用最小假 DOM）；
 *  2. 提示词资产：三档系统提示词与传话包装确实来自提取到的那一套；
 *  3. 宿主半优化接口：用假的 webServer + llm 驱动 lib/index.js，验证整条往返。
 *
 * 第 3 块是重点：它让「优化提示词」这条最依赖宿主半的能力不用重启 DSH 就能验。
 *
 *   node test/quick-commands.mjs
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import { apply } from '../lib/index.js'

/**
 * **整份套件**把 `$DSH_HOME` 指到临时目录。
 *
 * 为什么必须整份隔离（2026-09-30 真机发现）：这套件里只有 5e/5g 两节自己设了 DSH_HOME，
 * 而**其余各节也会真的调优化路由** —— 那条路由会往 `$DSH_HOME/composer-ux/optimize-log.jsonl`
 * 追加一行台账。于是每次 `npm test`（更别说变异要跑一百多轮）都往**用户的真实状态目录**里写垃圾：
 * 实测攒了 1422 行、465 KB，全是我测试的产物（`provider:"go"`、`sessionId:""`）。
 * 测试不许碰用户的真实目录 —— 这是脏数据，不是"顺便的副作用"。
 */
process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'dsh-quick-commands-home-'))

let failures = 0
let passes = 0

function check(label, condition, detail) {
  if (condition) {
    passes += 1
    console.log(`  ✓ ${label}`)
    return
  }
  failures += 1
  console.log(`  ✗ ${label}${detail === undefined ? '' : ` — ${detail}`}`)
}

/**
 * 解开 volatile 引用。
 *
 * 0.1.7 起设置 schema 里被标 `volatile` 的节点，**解析结果本身是引用**（只有 `get()`），
 * 不再是普通值——宿主半读值时同样先 `plainConfig` 解一遍。本套件第 6 节断言的是
 * "解析后的值"，所以统一从这里解引用。
 *
 * 为什么现在才需要：DSH 今天升级到随包的 schemastery 3.18.4，它开始认 `meta.volatile`
 * 并在解析时把节点包成引用（3.18.2 没有这个分支，那时同样的 schema 返回普通对象）。
 */
function plain(value) {
  if (value !== null && typeof value === 'object') {
    if (typeof value.get === 'function') return plain(value.get())
    if (Array.isArray(value)) return value.map(plain)
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]))
  }
  return value
}

// ── 现场打包纯函数出口 ──────────────────────────────────────────────────────mkdirSync(new URL('./.build/', import.meta.url), { recursive: true })
await build({
  entryPoints: ['test/pure-entry.ts'],
  outfile: 'test/.build/pure.mjs',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['es2022'],
  logLevel: 'warning',
})
const pure = await import(new URL('./.build/pure.mjs', import.meta.url))

// ══════════════ 1. 设置净化 ═════════════════════════════════════════════════
console.log('1. 快捷指令的净化（防脏数据）')
{
  const clean = pure.sanitizeSettings({ quickPrompts: 'not-an-array' })
  check('字段缺失/非数组 → 回落到内置 9 条', clean.quickPrompts.length === 9, String(clean.quickPrompts.length))
  check('内置条目标题正确', clean.quickPrompts[0].label === '一问一答', clean.quickPrompts[0].label)
}
{
  const clean = pure.sanitizeSettings({ quickPrompts: [] })
  check('空数组保持全空（全删光不会自己长回来）', clean.quickPrompts.length === 0)
}
{
  // 0.6.0：三档自定义提示词（留空 = 用内置那份，所以默认必须是空串）。
  check('自定义提示词默认空串（= 用内置）',
    pure.DEFAULT_SETTINGS.optimizerPromptLight === '' && pure.DEFAULT_SETTINGS.optimizerPromptStandard === ''
    && pure.DEFAULT_SETTINGS.optimizerPromptHeavy === '')
  const kept = pure.sanitizeSettings({ optimizerPromptHeavy: 'x'.repeat(5000) })
  check('自定义提示词原样保留（够长也不截）', kept.optimizerPromptHeavy.length === 5000, String(kept.optimizerPromptHeavy.length))
  const clipped = pure.sanitizeSettings({ optimizerPromptLight: 'x'.repeat(pure.OPTIMIZER_PROMPT_MAX + 100) })
  check("超上限被截断（不整份丢掉：这是用户自己敲的内容）", clipped.optimizerPromptLight.length === pure.OPTIMIZER_PROMPT_MAX, String(clipped.optimizerPromptLight.length))
  check('字段名映射（未知档回落默认档）',
    pure.optimizerPromptFieldOf('light') === 'optimizerPromptLight'
    && pure.optimizerPromptFieldOf('heavy') === 'optimizerPromptHeavy'
    && pure.optimizerPromptFieldOf('???') === pure.OPTIMIZER_PROMPT_FIELDS.standard)
}
{
  const clean = pure.sanitizeSettings({
    quickPrompts: [
      { id: 'a', label: '甲', prompt: '内容甲', always: true },
      { id: 'a', label: '重复 id', prompt: '应被丢弃', always: false },
      { id: 'b', label: '', prompt: '没有名称时用正文兜底', always: 'yes' },
      { id: 'c', label: '空正文', prompt: '   ', always: false },
      'not-an-object',
      null,
    ],
  })
  check('重复 id 只保留第一个', clean.quickPrompts.length === 2, JSON.stringify(clean.quickPrompts))
  check('名称留空时用正文兜底', clean.quickPrompts[1].label === '没有名称时用正文兜底', clean.quickPrompts[1].label)
  check('always 只认真正的 true', clean.quickPrompts[1].always === false, String(clean.quickPrompts[1].always))
}
{
  const long = 'x'.repeat(pure.QUICK_TEXT_MAX + 500)
  const clean = pure.sanitizeSettings({ quickPrompts: [{ id: 'a', label: 'l', prompt: long, always: false }] })
  check('超长正文被截断到上限', clean.quickPrompts[0].prompt.length === pure.QUICK_TEXT_MAX, String(clean.quickPrompts[0].prompt.length))
}
{
  const many = Array.from({ length: pure.QUICK_PROMPT_MAX + 12 }, (_, i) => ({
    id: `id-${i}`, label: `l${i}`, prompt: `p${i}`, always: false,
  }))
  const clean = pure.sanitizeSettings({ quickPrompts: many })
  check('条数被截到上限', clean.quickPrompts.length === pure.QUICK_PROMPT_MAX, String(clean.quickPrompts.length))
}
{
  const clean = pure.sanitizeSettings({ optimizerTier: 'nonsense' })
  check('未知档位回落到标准', clean.optimizerTier === 'standard', clean.optimizerTier)
  check('合法档位原样保留', pure.sanitizeSettings({ optimizerTier: 'heavy' }).optimizerTier === 'heavy')
}
{
  // 0.14.0：档位换成上游的四档（关闭/轻度/标准/重度），旧值必须**迁移**而不是丢弃 ——
  // 用户在旧版里选过「极端」，升级后应当仍是最重的那一档。
  check('旧档 basic → 轻度', pure.sanitizeSettings({ optimizerTier: 'basic' }).optimizerTier === 'light')
  check('旧档 advanced → 标准', pure.sanitizeSettings({ optimizerTier: 'advanced' }).optimizerTier === 'standard')
  check('旧档 extreme → 重度', pure.sanitizeSettings({ optimizerTier: 'extreme' }).optimizerTier === 'heavy')
  check('关闭档是合法值（不是「未知值回落」）', pure.sanitizeSettings({ optimizerTier: 'off' }).optimizerTier === 'off')
  check('归一化函数本身也认旧值', pure.normalizeOptimizerTier('extreme') === 'heavy'
    && pure.normalizeOptimizerTier('') === 'standard' && pure.normalizeOptimizerTier('heavy') === 'heavy')
  check('关闭档没有自定义提示词字段（它不调用模型）', pure.optimizerPromptFieldOf('off') === '')

  // 自定义提示词的字段改名也要迁移：新字段为空而旧字段有内容 ⇒ 用旧内容（别把用户改过的弄丢）。
  check('旧提示词字段的值迁移到新字段',
    pure.sanitizeSettings({ optimizerPromptAdvanced: '我改过的提示词' }).optimizerPromptStandard === '我改过的提示词')
  check('新字段有值时优先用新的',
    pure.sanitizeSettings({ optimizerPromptStandard: '新的', optimizerPromptAdvanced: '旧的' }).optimizerPromptStandard === '新的')

  // 0.14.0 优化选项卡片的六项默认值（照上游语义 + 我们的纪律：能花钱/给权限的一律默认关）。
  const d = pure.DEFAULT_SETTINGS
  check('协作基调默认普通', d.optimizerFraming === 'neutral')
  check('权限默认审查（= 成品给你看，你点插入）', d.optimizerPermission === 'review')
  check('模型默认跟随会话（空串）', d.optimizerModel === '')
  check('上下文默认按回合、6 回合', d.optimizerHistory === 'turns' && d.optimizerTurns === 6)
  check('内置 Bash 默认关（与只读工具同一套纪律）', d.optimizeBash === false)
  check('非法枚举落回默认',
    pure.sanitizeSettings({ optimizerFraming: 'x', optimizerPermission: 'y', optimizerHistory: 'z' }).optimizerFraming === 'neutral'
    && pure.sanitizeSettings({ optimizerPermission: 'y' }).optimizerPermission === 'review'
    && pure.sanitizeSettings({ optimizerHistory: 'z' }).optimizerHistory === 'turns')
  check('回合数超范围被夹住',
    pure.sanitizeSettings({ optimizerTurns: 99 }).optimizerTurns === 10
    && pure.sanitizeSettings({ optimizerTurns: -3 }).optimizerTurns === 0
    && pure.sanitizeSettings({ optimizerTurns: 'x' }).optimizerTurns === 6)
  check('模型 id 去空白并截断',
    pure.sanitizeSettings({ optimizerModel: '  go/x  ' }).optimizerModel === 'go/x'
    && pure.sanitizeSettings({ optimizerModel: 'm'.repeat(500) }).optimizerModel.length === pure.OPTIMIZER_MODEL_MAX)
}
{
  // 0.5.0：右键菜单从布尔 menuNative 换成三档字符串 menuMode。
  // 这里钉住迁移的每种情形——尤其「文档里根本没有这个键」与「明确关掉过旧开关」必须分开：
  // 前者落到新默认档（官方不介入），后者要保持用户当初选的自定义菜单。
  check('新字段合法 → 原样',
    pure.sanitizeSettings({ menuMode: 'browser' }).menuMode === 'browser')
  check('新字段优先于旧布尔（两者都在时听新字段）',
    pure.sanitizeSettings({ menuMode: 'official', menuNative: true }).menuMode === 'official')
  check('旧布尔 true → 浏览器档',
    pure.sanitizeSettings({ menuNative: true }).menuMode === 'browser')
  check('旧布尔 false（明确关过那个开关）→ 自定义档',
    pure.sanitizeSettings({ menuNative: false }).menuMode === 'custom')
  check('两个键都没有（从没设过）→ 新默认档「官方不介入」',
    pure.sanitizeSettings({}).menuMode === 'official')
  check('新字段是脏数据 → 落回旧布尔',
    pure.sanitizeSettings({ menuMode: 'nonsense', menuNative: true }).menuMode === 'browser')
  check('三档元数据齐全且顺序为 官方 / 浏览器 / 自定义',
    pure.MENU_MODES.map(item => item.id).join(',') === 'official,browser,custom',
    pure.MENU_MODES.map(item => item.id).join(','))
  check('每档都有给用户看的一句话说明',
    pure.MENU_MODES.every(item => typeof item.label === 'string' && item.label !== ''
      && typeof item.hint === 'string' && item.hint.length > 10))
}
{
  // 0.5.0：「每一栏一个开关」，默认关；总开关默认开。
  //
  // 这一段是整个功能最要紧的护栏 —— 判据写错的方向有两种，而且都很难在界面上看出来：
  //  · 一律默认关 ⇒ 老用户升级那一刻键位失效、OpenCode 路由 400；
  //  · 一律默认开 ⇒ 全新安装六栏全开，与"默认关"正好相反。
  // 所以两个方向都要钉住。
  const blank = pure.sanitizeSettings({})
  check('全新安装（空文档）→ 五栏全关',
    blank.keysEnabled === false && blank.menuEnabled === false && blank.quickEnabled === false
    && blank.panelEnabled === false && blank.terminalEnabled === false,
    JSON.stringify([blank.keysEnabled, blank.menuEnabled, blank.quickEnabled, blank.panelEnabled, blank.terminalEnabled]))
  check('总开关默认开（它是总闸，不是"要不要用这一栏"）', blank.enabled === true)
  check('OpenCode 那一栏沿用 headerEnabled，且默认关', blank.headerEnabled === false)
  // 上下文开关是"默认开"的那一类（与栏开关相反）：它不改任何既有行为，只是让优化多知道
  // 一点上文；所以默认开，且**关掉必须真的关掉**（0.12.0 踩过一次：布尔被 textOf 读成空串，
  // 于是"关"等于"没设置"，永远开着 —— 由 5d 那组用例逮住）。
  check('上下文开关默认开', blank.optimizerContext === true && pure.DEFAULT_SETTINGS.optimizerContext === true)
  check('上下文开关显式关掉就是关',
    pure.sanitizeSettings({ optimizerContext: false }).optimizerContext === false)
  check('上下文开关收到脏值（字符串/数字）回落默认开',
    pure.sanitizeSettings({ optimizerContext: 'no' }).optimizerContext === true
    && pure.sanitizeSettings({ optimizerContext: 0 }).optimizerContext === true)
  check('DEFAULT_SETTINGS 与净化结果一致（两处不许分叉）',
    pure.DEFAULT_SETTINGS.enabled === true && pure.DEFAULT_SETTINGS.keysEnabled === false
    && pure.DEFAULT_SETTINGS.menuEnabled === false && pure.DEFAULT_SETTINGS.quickEnabled === false
    && pure.DEFAULT_SETTINGS.panelEnabled === false && pure.DEFAULT_SETTINGS.terminalEnabled === false)

  // 显式值永远优先（用户表过态就听他的），哪怕信号存在。
  check('显式 false 压过信号（改过键位但明确关了键位栏）',
    pure.sanitizeSettings({ keysEnabled: false, sendKey: 'Ctrl+Enter' }).keysEnabled === false)
  check('显式 true 不需要任何信号',
    pure.sanitizeSettings({ panelEnabled: true }).panelEnabled === true)

  // 老用户：每一栏的"碰过"判据各测一次（值 ≠ 从没碰过的样子）。
  check('改过键位 → 键位栏开',
    pure.sanitizeSettings({ sendKey: 'Ctrl+Enter' }).keysEnabled === true
    && pure.sanitizeSettings({ newlineKey: 'Enter' }).keysEnabled === true)
  check('键位保持默认（Enter / Shift+Enter）→ 仍算没碰过',
    pure.sanitizeSettings({ sendKey: 'Enter', newlineKey: 'Shift+Enter' }).keysEnabled === false)
  check('右键菜单选过浏览器/自定义档 → 开',
    pure.sanitizeSettings({ menuMode: 'browser' }).menuEnabled === true
    && pure.sanitizeSettings({ menuMode: 'custom' }).menuEnabled === true)
  check('右键菜单就是"官方"档 → 算没碰过（官方＝不介入＝等价于关）',
    pure.sanitizeSettings({ menuMode: 'official' }).menuEnabled === false)
  check('设置面板有尺寸记录 → 开',
    pure.sanitizeSettings({ panelWidth: 1007, panelHeight: 746 }).panelEnabled === true)
  check('设置面板全是默认值 → 关',
    pure.sanitizeSettings({ panelScroll: true, panelResize: true }).panelEnabled === false)
  check('终端档位不是自动 / 填了路径 → 开',
    pure.sanitizeSettings({ terminalMode: 'gitbash' }).terminalEnabled === true
    && pure.sanitizeSettings({ terminalBashPath: 'D:/Git/bin/bash.exe' }).terminalEnabled === true)
  check('终端档位保持"自动"且没填路径 → 关',
    pure.sanitizeSettings({ terminalMode: 'auto' }).terminalEnabled === false)
  check('宿主半自持字段不能当判据（候选列表是插件自己写的）',
    pure.sanitizeSettings({
      terminalCandidates: [{ path: 'D:/Git/bin/bash.exe', label: 'Git', kind: 'git', explicit: false }],
      terminalStatus: '已生效：D:/Git/bin/bash.exe',
      terminalEffective: 'bash',
    }).terminalEnabled === false)
  check('快捷指令列表被改过 → 开（文档里的次级信号）',
    pure.sanitizeSettings({ quickPrompts: [{ id: 'x', label: 'x', prompt: 'x', always: false }] }).quickEnabled === true)
  check('优化档位不是默认 → 开',
    pure.sanitizeSettings({ optimizerTier: 'heavy' }).quickEnabled === true)

  // 用户真实文档的回归：这就是他 2026-09-17 那份（headerValue 已换成假 UUID）。
  // 六栏必须全部保持开着 —— 升级不能把他正在用的东西关掉。
  const real = pure.sanitizeSettings({
    enabled: true,
    panelResize: true,
    menuNative: true,
    sendKey: 'Ctrl+Enter',
    newlineKey: 'Enter',
    headerEnabled: true,
    headerValue: '00000000-0000-0000-0000-000000000000',
    headerAppliedName: 'x-opencode-session',
    headerAppliedValue: '00000000-0000-0000-0000-000000000000',
    headerStatus: '已写入 opencode-go、go',
    optimizerTier: 'standard',
    panelWidth: 1007,
    panelHeight: 746,
    panelScroll: true,
    menuMode: 'browser',
    terminalStatus: '已生效：D:/Git/bin/bash.exe（Git for Windows）',
    terminalEffective: 'bash',
    terminalMode: 'gitbash',
    terminalBashPath: 'D:/Git/bin/bash.exe',
  })
  const live = pure.activeSections(real)
  check('真实文档迁移后：键位 / 右键菜单 / 设置面板 / OpenCode / 默认终端 全开',
    live.keys && live.menu && live.panel && live.header && live.terminal,
    JSON.stringify(live))

  // activeSections：总闸 + 栏开关，两处都要看
  check('总开关关掉 → 七栏全不生效（哪怕栏开关是开的）',
    Object.values(pure.activeSections({ ...pure.DEFAULT_SETTINGS, enabled: false, keysEnabled: true, headerEnabled: true }))
      .every(value => value === false))
  check('总开关开着 + 栏开 → 生效', pure.activeSections({ ...pure.DEFAULT_SETTINGS, keysEnabled: true }).keys === true)
  check('activeSections 用本栏自己的 headerEnabled，没有第二个请求头开关',
    pure.activeSections({ ...pure.DEFAULT_SETTINGS, headerEnabled: true }).header === true)

  // 0.7.0「统计行」：**新栏**，规则与上面五栏**相反** —— 默认开，且不走"碰过才开"那套迁移。
  // 这条区别必须钉住：后来的人照抄 sectionEnabledOf 就会把它默认成关，
  // 于是"装完即生效"这个用户明确要的行为会静默消失（界面上只是数字还是整数，很难注意到）。
  check('统计行是新栏、默认开（与五栏默认关方向相反）',
    blank.statsEnabled === true && pure.DEFAULT_SETTINGS.statsEnabled === true)
  check('统计行不参与"碰过才开"的迁移：空文档也是开',
    pure.sanitizeSettings({}).statsEnabled === true
    && pure.sanitizeSettings({ sendKey: 'Ctrl+Enter' }).statsEnabled === true)
  check('显式关掉统计行听用户的',
    pure.sanitizeSettings({ statsEnabled: false }).statsEnabled === false)
  check('activeSections 里统计行走自己的 statsEnabled',
    pure.activeSections(pure.DEFAULT_SETTINGS).stats === true
    && pure.activeSections({ ...pure.DEFAULT_SETTINGS, statsEnabled: false }).stats === false)
}

// ══════════════ 2. 发送时的末尾拼接语义 ════════════════════════════════════
//
// 契约（0.4.0 修正后）：**「这一批里该有谁」由调用方决定**
// （appendBatchForSend(book, blank)），本函数只把给它的这一批拼上去、并把空正文跳过。
// 所以这里传进去的条目**带什么 always / firstOnly 都不影响结果** —— 这正是不该再有
// 第二处模式过滤的意思；模式过滤本身在第 9 节按真实路径测（含「仅首次」）。
console.log('2. 发送附加：把这一批拼到消息末尾')
{
  const batch = [
    { id: '1', label: '甲', prompt: '第一条', always: true, firstOnly: false },
    { id: '2', label: '乙', prompt: '第二条', always: false, firstOnly: true },
    { id: '3', label: '丙', prompt: '第三条', always: false, firstOnly: false },
  ]
  const next = pure.withPromptsAppended('我的问题', batch)
  check('原文在前、传入的按顺序在后', next === '我的问题\n\n第一条\n\n第二条\n\n第三条', JSON.stringify(next))
  check('模式标志不再在这里过滤（哪怕标着「关」也照样附加）',
    next.includes('第三条') && next.includes('第二条'))
}
{
  const list = [{ id: '1', label: '甲', prompt: '甲', always: true, firstOnly: false }]
  check('批次为空 → 不附加', pure.withPromptsAppended('原文', []) === null)
  check('原文为空 → 不附加（交还官方原语义）', pure.withPromptsAppended('', list) === null)
  check('只有空白 → 不附加', pure.withPromptsAppended('   \n  ', list) === null)
  check('原文尾部空白被规整', pure.withPromptsAppended('原文   \n\n', list) === '原文\n\n甲')
  check('正文为空 → 不附加', pure.withPromptsAppended('原文', [{ id: '1', label: '甲', prompt: '  ', always: true, firstOnly: false }]) === null)
}
{
  const list = [
    { id: '1', label: '甲', prompt: '甲', always: true, firstOnly: false },
    { id: '2', label: '乙', prompt: '  ', always: true, firstOnly: false },
    { id: '3', label: '丙', prompt: '丙', always: true, firstOnly: false },
  ]
  check('批次里的空正文被跳过、其余仍拼接', pure.withPromptsAppended('原文', list) === '原文\n\n甲\n\n丙')
}
{
  // 幂等护栏：这是「一直点一直插入」那个 bug 的兜底。
  // 若发送那一步没成，第二次点击不能再叠一遍，而应放行官方发送。
  const list = [{ id: '1', label: '甲', prompt: '甲', always: true, firstOnly: false }]
  const once = pure.withPromptsAppended('原文', list)
  check('第一次正常附加', once === '原文\n\n甲')
  check('已以同一后缀结尾 → 不再附加（幂等）', pure.withPromptsAppended(once, list) === null)
  check('尾部有空白也算已附加', pure.withPromptsAppended(`${once}   \n`, list) === null)
  check('中间出现同样文字不算已附加', pure.withPromptsAppended('甲\n\n原文', list) === '甲\n\n原文\n\n甲')
  check('后缀相同但前面还有别的话 → 仍不再叠（结尾匹配）',
    pure.withPromptsAppended('别的\n\n原文\n\n甲', list) === null)
}

// ══════════════ 3. 发送键 / 停止键的图形判别 ════════════════════════════════
console.log('3. 发送按钮识别（不依赖界面文案）')
{
  class FakeElement {
    constructor(options = {}) {
      this.isCard = options.card === true
      this.buttons = options.buttons ?? []
      this.nodes = options.nodes ?? []
      this.svgRect = options.svgRect === true
      this.svgPath = options.svgPath === true
      this.disabled = options.disabled === true
      this.parent = null
    }

    /** 真 DOM 的 closest：沿父链向上找最近的匹配祖先。 */
    closest(selector) {
      if (selector !== '[data-composer-card]') return null
      let el = this
      while (el !== null) {
        if (el.isCard === true) return el
        el = el.parent
      }
      return null
    }

    querySelectorAll(selector) {
      return selector === 'button' ? this.buttons : []
    }

    querySelector(selector) {
      if (selector === 'svg rect') return this.svgRect ? {} : null
      if (selector === 'svg path') return this.svgPath ? {} : null
      return null
    }

    contains(other) {
      return other === this || this.nodes.includes(other)
    }
  }
  /** 真 <button>：有 click()（重放靠它）。 */
  class FakeButtonElement extends FakeElement {
    constructor(options) {
      super(options)
      this.clickCalls = 0
      this.click = () => { this.clickCalls += 1 }
    }
  }
  /**
   * 按钮内部的图标节点：**故意不给 click()**，与真 SVG 一致
   * （SVGElement 不继承 HTMLElement.click）。0.2.0 的 bug 正是把这种节点
   * 当成按钮去 .click()，抛 TypeError → 已插入但没发送。
   */
  class FakeSvgNode extends FakeElement {}

  globalThis.Element = FakeElement
  globalThis.HTMLButtonElement = FakeButtonElement

  const card = (options) => {
    const shell = new FakeElement({ card: true })
    const tools = [
      new FakeButtonElement({ svgPath: true }),
      new FakeButtonElement({ svgPath: true }),
    ]
    const innerSvg = options?.innerSvg
    const primary = new FakeButtonElement({
      svgRect: options?.stop === true,
      svgPath: options?.stop !== true,
      disabled: options?.disabled === true,
      nodes: innerSvg === undefined ? [] : [innerSvg],
    })
    shell.buttons = [...tools, primary]
    // 挂父链：closest 必须能从按钮走到卡片。
    for (const child of [...tools, primary]) child.parent = shell
    if (innerSvg !== undefined) innerSvg.parent = primary
    return { shell, tools, primary, innerSvg }
  }

  const send = card()
  check('箭头图标 → 认作发送键', pure.sendButtonOf(send.primary) === send.primary)
  const stop = card({ stop: true })
  check('方块图标（停止）→ 不认', pure.sendButtonOf(stop.primary) === null)
  check('被禁用的发送键 → 不认', pure.sendButtonOf(card({ disabled: true }).primary) === null)
  check('工具行里靠前的按钮 → 不认', pure.sendButtonOf(send.tools[0]) === null)
  check('卡片本身 → 不认', pure.sendButtonOf(send.shell) === null)
  check('卡片外的元素 → 不认', pure.sendButtonOf(new FakeElement()) === null)
  check('非元素（null）→ 不认', pure.sendButtonOf(null) === null)

  const withInner = card({ innerSvg: new FakeSvgNode() })
  const resolved = pure.sendButtonOf(withInner.innerSvg)
  check('点在内层 svg 上 → 仍认作发送键', resolved === withInner.primary)
  // 关键回归：拿到的必须是**真按钮**，否则重放点击会抛 TypeError（0.2.0 的 bug）。
  check('返回的是真 <button>（有 click），而不是 svg',
    typeof resolved?.click === 'function' && resolved.clickCalls === 0)
  check('停止键里点内层图标也不认',
    pure.sendButtonOf(card({ stop: true, innerSvg: new FakeSvgNode() }).innerSvg) === null)
}

// ══════════════ 3b. 斜杠命令 / 秒表 / 写回前比对（0.11.1） ═══════════════════
console.log('3b. 斜杠命令拆分、秒表读数、写回前比对（纯函数）')

{
  // 斜杠命令：只把命令**后面的正文**交出去，前缀原样保留。
  const cases = [
    ['/goal 帮我写周报', '/goal', '帮我写周报'],
    ['/goal   帮我写周报  ', '/goal', '帮我写周报'],
    ['/compact', '/compact', ''],
    ['帮我写周报', '', '帮我写周报'],
    // `/path/to/file` 是路径不是命令（第二段以 `/` 开头，`\s+` 匹配不上）——必须整段照旧优化。
    ['/path/to/file 这个报错怎么修', '', '/path/to/file 这个报错怎么修'],
    ['//双斜杠 不是命令', '', '//双斜杠 不是命令'],
    ['/goal\n多行正文', '/goal', '多行正文'],
  ]
  for (const [input, prefix, body] of cases) {
    const got = pure.splitSlashCommand(input)
    check(`拆分「${input.replace('\n', '\\n')}」→ 前缀 ${prefix === '' ? '(无)' : prefix}`,
      got.prefix === prefix && got.body === body, JSON.stringify(got))
  }
  check('命令后面只有空白 → 正文为空（调用方据此不发请求）',
    pure.splitSlashCommand('/goal   ').body === '')
  check('前缀拼回：命令原样保留',
    pure.composeOptimizedDraft('/goal', '写一份周报') === '/goal 写一份周报')
  check('没有前缀时拼回就是成品本身',
    pure.composeOptimizedDraft('', '写一份周报') === '写一份周报')
}

{
  // 秒表：读数只依赖起始时刻；"跑没跑"由 startedAt 是否为 0 表示。
  check('没在跑（startedAt = 0）→ 0 秒', pure.elapsedSeconds(0, 12_345) === 0)
  check('刚起步不到 1 秒 → 0 秒（不虚报）', pure.elapsedSeconds(1_000, 1_800) === 0)
  check('3.4 秒 → 3 秒（向下取整）', pure.elapsedSeconds(1_000, 4_400) === 3)
  check('起始时刻在未来（时钟回拨）→ 0，绝不出现负数读数', pure.elapsedSeconds(9_000, 1_000) === 0)
  check('耗时文案保留一位小数（0.4 秒不会被显示成 0 秒）', pure.elapsedText(1_000, 1_400) === '0.4')
  check('耗时文案：没有起点时给一个破折号', pure.elapsedText(0, 1_400) === '—')
}

{
  // 写回前比对：只有**实质**改动才算"改过"。
  check('一字不差 → 可以写回', pure.sameDraft('把页面弄好看点', '把页面弄好看点') === true)
  check('只差首尾空白 → 仍算没改（不白扔一次花了钱的优化）',
    pure.sameDraft('把页面弄好看点', '  把页面弄好看点\n') === true)
  check('用户又打了字 → 算改过（不许覆盖）',
    pure.sameDraft('把页面弄好看点', '把页面弄好看点，另外加个导出') === false)
  check('用户清空了输入框 → 算改过（覆盖与否交给调用方决定）',
    pure.sameDraft('把页面弄好看点', '') === false)
}

// ══════════════ 3c. 流式传输层（SSE 帧切分 + 载荷收窄 + 假 fetch 端到端） ═════
console.log('3c. 流式传输层：帧切分 / 载荷收窄 / 取消与坏流')

{
  // 帧边界会跨 chunk 落在任意位置（网络怎么切完全不受控）—— 整条链路里最容易错的一步。
  const first = pure.parseSseChunk('data: {"type":"item","text":"A"}\n\ndata: {"type":"it')
  check('只切出完整帧，半截尾巴留在 rest 里',
    first.events.length === 1 && first.events[0].text === 'A' && first.rest.startsWith('data: {"type":"it'),
    JSON.stringify(first))
  const second = pure.parseSseChunk(`${first.rest}em","text":"B"}\n\n`)
  check('拿着上一帧的尾巴能拼出第二条', second.events.length === 1 && second.events[0].text === 'B' && second.rest === '',
    JSON.stringify(second))
  check('一个 chunk 里的多帧都收下',
    pure.parseSseChunk('data: {"type":"a"}\n\ndata: {"type":"b"}\n\n').events.length === 2)
  check('CRLF 与多余空白不影响切帧', pure.parseSseChunk('data: {"type":"a"}\r\n\r\n').events.length === 1)
  check('注释行 / event: 行被忽略（我们只认载荷里的 type）',
    pure.parseSseChunk(': keep-alive\n\nevent: item\ndata: {"type":"a"}\n\n').events.length === 1)
  check('坏帧跳过，不炸掉整条流',
    pure.parseSseChunk('data: {不是 JSON}\n\ndata: {"type":"ok"}\n\n').events.length === 1)
  check('非对象载荷（数组 / 数字）不进事件',
    pure.parseSseChunk('data: [1,2]\n\ndata: 42\n\n').events.length === 0)
}

{
  const view = pure.itemViewOf({ index: 2, id: 'item#2', kind: 'requirement', text: '改完能打开', quote: '弄好看点', quoteSource: 'user' })
  check('itemViewOf：字段逐个收窄',
    view?.index === 2 && view.kind === 'requirement' && view.quoteSource === 'user', JSON.stringify(view))
  check('itemViewOf：没有 text 的事件不当成条目（不显示空行）',
    pure.itemViewOf({ index: 1, kind: 'x' }) === undefined)
  check('itemViewOf：非对象一律拒绝', pure.itemViewOf(null) === undefined && pure.itemViewOf('x') === undefined)
  check('itemViewOf：多余的未知字段不会被带进状态',
    Object.keys(pure.itemViewOf({ text: 'x', evil: 'payload' }) ?? {}).includes('evil') === false)

  const ok = pure.outcomeOf({ ok: true, text: ' 成品 ', provider: 'go', model: 'm', itemCount: 2, truncated: true })
  check('outcomeOf：成功时给出成品与路由', ok.ok === true && ok.text === '成品' && ok.route === 'go/m', JSON.stringify(ok))
  check('outcomeOf：读 truncated（宿主 0.6.0 就在回，此前客户端一直没读）', ok.truncated === true)
  const bad = pure.outcomeOf({ ok: false, error: '模型没有产出任何内容', retried: true })
  check('outcomeOf：失败时如实带原因与重试标记',
    bad.ok === false && bad.error === '模型没有产出任何内容' && bad.retried === true)
  check('outcomeOf：脏载荷不抛（ok 不是 true 就当失败）', pure.outcomeOf('boom').ok === false)
}

{
  const realFetch = globalThis.fetch
  const frames = [
    'data: {"type":"item","index":1,"id":"item#1","kind":"user_requirement","text":"把设置页做得好看点","quote":"把那个页面弄好看点","quoteSource":"user"}\n\n',
    'data: {"type":"dropped","id":"item#2","kind":"requirement","reason":"引文不是原话里的逐字片段"}\n\n',
    'data: {"type":"done","ok":true,"text":"把设置页做得好看点","provider":"go","model":"deepseek-flash","itemCount":1}\n\n',
  ]
  // 故意把帧切得很难看：跨帧、一次多帧混着来（模拟真实的网络分块）。
  const pieces = [frames[0].slice(0, 17), frames[0].slice(17) + frames[1].slice(0, 5), frames[1].slice(5) + frames[2]]
  globalThis.fetch = async () => new Response(new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      for (const piece of pieces) controller.enqueue(encoder.encode(piece))
      controller.close()
    },
  }), { status: 200 })

  const items = []
  const dropped = []
  const outcome = await pure.optimizeDraftStream('把那个页面弄好看点', 'standard', {
    onItem: item => items.push(item),
    onDropped: row => dropped.push(row),
  })
  check('端到端：逐条回调收到条目（跨 chunk 切帧也不丢）',
    items.length === 1 && items[0].text === '把设置页做得好看点', JSON.stringify(items))
  check('端到端：丢弃回调收到记账',
    dropped.length === 1 && /引文不是原话/.test(dropped[0].reason), JSON.stringify(dropped))
  check('端到端：最终结果来自 done 事件',
    outcome.ok === true && outcome.route === 'go/deepseek-flash' && outcome.itemCount === 1, JSON.stringify(outcome))

  // 预校验失败：宿主回普通 JSON + 400，客户端要把原因透出来（而不是只说 HTTP 400）。
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, error: '输入框是空的，没有可优化的内容' }), { status: 400 })
  const rejected = await pure.optimizeDraftStream('x', 'standard')
  check('端到端：预校验 400 时透出宿主那句原因',
    rejected.ok === false && rejected.error === '输入框是空的，没有可优化的内容', JSON.stringify(rejected))

  // 流断了却没有 done：如实说"没有结论"，绝不假装成功。
  globalThis.fetch = async () => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('data: {"type":"item","text":"半截"}\n\n'))
      controller.close()
    },
  }), { status: 200 })
  const noDone = await pure.optimizeDraftStream('把那个页面弄好看点', 'standard', {})
  check('端到端：流结束却没有 done → 如实报错（不假装成功）',
    noDone.ok === false && /没有给出结论/.test(String(noDone.error)), JSON.stringify(noDone))

  // 取消：signal 已 abort 时如实说"已取消"，不冒充网络故障。
  globalThis.fetch = async () => { throw new Error('aborted') }
  const aborter = new AbortController()
  aborter.abort()
  const cancelled = await pure.optimizeDraftStream('把那个页面弄好看点', 'standard', {}, aborter.signal)
  check('端到端：取消时回报「已取消」（不冒充网络故障）',
    cancelled.ok === false && cancelled.error === '已取消', JSON.stringify(cancelled))

  globalThis.fetch = realFetch
  check('端到端：真 fetch 已还原（后面的用例不受影响）', globalThis.fetch === realFetch)
}

// ══════════════ 3d. 优化结果框的状态机（0.12.0） ══════════════════════════════
console.log('3d. 结果框状态机：单轮、取消保留、插入前比对')

{
  const item = (id, text) => ({ index: Number(id.slice(5)), id, kind: 'requirement', text, quote: '弄好看点', quoteSource: 'user' })
  const start = (at = 1_000) => pure.dockReducer(null, { type: 'start', source: '把那个页面弄好看点', draft: '把那个页面弄好看点', prefix: '', startedAt: at })
  const done = (state, at = 4_400, extra = {}) => pure.dockReducer(state, {
    type: 'done',
    at,
    outcome: { ok: true, text: '成品正文', route: 'go/m', itemCount: 2, ...extra },
  })

  const fresh = start()
  check('start：开新一轮，流水与成品都清空',
    fresh.phase === 'running' && fresh.items.length === 0 && fresh.text === '' && fresh.startedAt === 1_000,
    JSON.stringify(fresh))
  check('start：记住这一轮的原文与发起时的草稿（插入前比对要用）',
    fresh.source === '把那个页面弄好看点' && fresh.draftAtStart === '把那个页面弄好看点')

  const withOne = pure.dockReducer(fresh, { type: 'item', item: item('item#1', 'A') })
  check('item：逐条追加', withOne.items.length === 1 && withOne.items[0].text === 'A')
  const again = pure.dockReducer(withOne, { type: 'item', item: item('item#1', 'A') })
  check('item：同一个 id 只收一次（重放/重连不会出现两行）', again.items.length === 1, String(again.items.length))
  check('dropped：同一 id 也只收一次',
    ((s) => pure.dockReducer(s, { type: 'dropped', row: { id: 'item#2', kind: 'requirement', reason: 'X' } }))(
      pure.dockReducer(withOne, { type: 'dropped', row: { id: 'item#2', kind: 'requirement', reason: 'X' } })).dropped.length === 1)

  const finished = done(withOne)
  check('done：填成品、路由与记账，并停表',
    finished.phase === 'done' && finished.text === '成品正文' && finished.route === 'go/m'
    && finished.startedAt === 0 && finished.elapsedMs === 3_400,
    JSON.stringify({ phase: finished.phase, text: finished.text, elapsedMs: finished.elapsedMs }))
  check('done：记下宿主的条目数（篇幅闸门可能比流水少）', finished.itemCount === 2)
  check('done：新一轮把上一轮的手改标记清掉', pure.dockReducer({ ...finished, edited: true }, { type: 'done', at: 5_000, outcome: { ok: true, text: 'X' } }).edited === false)

  const failed = pure.dockReducer(withOne, { type: 'done', at: 2_000, outcome: { ok: false, error: '模型没有产出任何内容', retried: true } })
  check('done：失败进 error 阶段并留下原因',
    failed.phase === 'error' && failed.error === '模型没有产出任何内容' && failed.retried === true,
    JSON.stringify({ phase: failed.phase, error: failed.error }))
  check('done：失败时不留下半截成品', failed.text === '')

  const cancelled = pure.dockReducer(withOne, { type: 'cancel', at: 3_000 })
  check('cancel：保留已经生成的部分（条目不蒸发）', cancelled.phase === 'cancelled' && cancelled.items.length === 1)
  check('cancel：成品留空 —— 取消时它本来就不存在（不假装有）',
    cancelled.text === '' && cancelled.elapsedMs === 2_000)

  const edited = pure.dockReducer(finished, { type: 'edit', text: '我改过的成品' })
  check('edit：更新成品并置手改标记', edited.text === '我改过的成品' && edited.edited === true)
  check('clear：收起结果框', pure.dockReducer(edited, { type: 'clear' }) === null)
  check('未知状态下的事件不炸（null 上收到 item/done/cancel 都返回 null）',
    pure.dockReducer(null, { type: 'item', item: item('item#1', 'A') }) === null
    && pure.dockReducer(null, { type: 'cancel', at: 1 }) === null)
}

{
  const state = pure.dockReducer(null, { type: 'start', source: 'X', draft: '把页面弄好看点', prefix: '', startedAt: 1 })
  const finished = pure.dockReducer(state, { type: 'done', at: 2, outcome: { ok: true, text: '成品' } })
  check('insertDecision：没成品 → empty', pure.insertDecision(state, '随便', false) === 'empty')
  check('insertDecision：跑到一半 → empty（没有东西可插）',
    pure.insertDecision({ ...state, phase: 'running' }, '随便', false) === 'empty')
  check('insertDecision：输入框没被动过 → 直接插入',
    pure.insertDecision(finished, '把页面弄好看点', false) === 'insert')
  check('insertDecision：输入框被动过 → 先要一次确认',
    pure.insertDecision(finished, '把页面弄好看点，另外加个导出', false) === 'confirm')
  check('insertDecision：用户点过第二下 → 覆盖',
    pure.insertDecision(finished, '把页面弄好看点，另外加个导出', true) === 'insert')
  check('insertDecision：只差首尾空白不算被动过（不白拦一次）',
    pure.insertDecision(finished, '  把页面弄好看点\n', false) === 'insert')
  check('insertDecision：框收起时 → empty', pure.insertDecision(null, 'x', true) === 'empty')
}

{
  const base = {
    phase: 'done', items: [], dropped: [], text: 'x', edited: false, error: '', route: 'go/m',
    truncated: false, fallback: false, retried: false, promptSource: 'builtin', itemCount: 3,
    startedAt: 0, elapsedMs: 1_000, draftAtStart: '', source: '', slashPrefix: '',
  }
  check('dockSummary：条数 + 路由之外的记账齐全',
    pure.dockSummary(base) === '3 条补全', pure.dockSummary(base))
  check('dockSummary：降级路径优先说明（不数条数）',
    pure.dockSummary({ ...base, fallback: true, itemCount: 0 }) === '模型没按条目契约输出，已整段照收（未校验依据）',
    pure.dockSummary({ ...base, fallback: true, itemCount: 0 }))
  check('dockSummary：丢弃 / 自定义 / 重试 / 篇幅 / 手改都出声',
    pure.dockSummary({ ...base, dropped: [{ id: 'a', kind: 'k', reason: 'r' }], promptSource: 'custom', retried: true, truncated: true, edited: true })
      === '3 条补全 · 丢弃 1 条 · 自定义提示词 · 重试过一次 · 篇幅闸门动过手（省略了可选的节） · 你手改过',
    pure.dockSummary({ ...base, dropped: [{ id: 'a', kind: 'k', reason: 'r' }], promptSource: 'custom', retried: true, truncated: true, edited: true }))
  check('dockSummary：取消时按流水条数说（没有宿主记账）',
    pure.dockSummary({ ...base, phase: 'cancelled', itemCount: 0, items: [{ index: 1, id: 'item#1', kind: 'requirement', text: 'A', quote: '', quoteSource: 'none' }] })
      === '1 条补全')

  check('dockPhaseText：四个阶段各有一句话',
    pure.dockPhaseText({ ...base, phase: 'running' }).includes('等待模型响应')
    && pure.dockPhaseText(base) === '优化完成'
    && pure.dockPhaseText({ ...base, phase: 'cancelled' }).includes('已取消')
    && pure.dockPhaseText({ ...base, phase: 'error' }) === '出错了')
}

// ══════════════ 3e. 会话上下文与记忆链（0.12.0） ═════════════════════════════
console.log('3e. 会话上下文：挑往来 / 收敛预算 / 渲染成块；记忆链门槛')

{
  // 快照形状照真实会话日志：user/message 的 data 就是消息本身，assistant/message 在 data.message 里。
  const snapshot = {
    events: [
      { type: 'user/message', data: { id: 'u1', role: 'user', content: [{ type: 'text', text: '帮我改一下设置页' }], source: { kind: 'user' } } },
      { type: 'assistant/message', data: { message: { id: 'a1', role: 'assistant', content: [{ type: 'text', text: '好的，改了标题' }] } } },
      // 插件注入的 user 角色消息：不算"你说过的话"。
      { type: 'user/message', data: { id: 'u2', role: 'user', content: [{ type: 'text', text: '<goal>内部注入</goal>' }], source: { kind: 'plugin' } } },
      // 只承载 usage 的空壳助手消息（没有正文）。
      { type: 'assistant/message', data: { message: { id: 'a2', role: 'assistant', content: [] } } },
      { type: 'user/message', data: { id: 'u3', role: 'user', content: [{ type: 'text', text: '它那个也顺手改一下' }], source: { kind: 'user' } } },
      // 助手思考块不算对话正文。
      { type: 'assistant/message', data: { message: { id: 'a3', role: 'assistant', content: [{ type: 'reasoning', text: '我在想……' }, { type: 'text', text: '改好了' }] } } },
    ],
  }
  const turns = pure.recentTurns(snapshot)
  check('挑往来：只取真正来自用户的（插件注入的不算）',
    turns.filter(turn => turn.role === 'user').map(turn => turn.text).join('|') === '帮我改一下设置页|它那个也顺手改一下',
    JSON.stringify(turns))
  check('挑往来：助手空壳不算一条', turns.filter(turn => turn.role === 'assistant').length === 2, JSON.stringify(turns))
  check('挑往来：助手的思考块不进上下文',
    turns.filter(turn => turn.role === 'assistant').map(turn => turn.text).join('|') === '好的，改了标题|改好了',
    JSON.stringify(turns))
  check('挑往来：按发生顺序合并（不是先排完用户再排助手）',
    turns.map(turn => turn.role).join(',') === 'user,assistant,user,assistant', turns.map(turn => turn.role).join(','))
  check('挑往来：垃圾快照不抛', pure.recentTurns(null).length === 0 && pure.recentTurns({ events: 'x' }).length === 0)

  check('messageTextOf：多块按换行拼；非文本块忽略',
    pure.messageTextOf({ content: [{ type: 'text', text: 'A' }, { type: 'image' }, { type: 'text', text: 'B' }] }) === 'A\nB')
  check('messageTextOf：content 是老式字符串也认', pure.messageTextOf({ content: ' 就一句话 ' }) === '就一句话')
  check('messageTextOf：认不出的输入返回空串', pure.messageTextOf(undefined) === '' && pure.messageTextOf({}) === '')

  // 每角色各自取最近 N 条：助手碎片多的时候，用户的诉求不能被挤出去。
  const many = {
    events: [
      ...Array.from({ length: 10 }, (_, i) => ({ type: 'assistant/message', data: { message: { content: [{ type: 'text', text: `助手${String(i)}` }] } } })),
      { type: 'user/message', data: { content: [{ type: 'text', text: '我的诉求' }], source: { kind: 'user' } } },
      ...Array.from({ length: 10 }, (_, i) => ({ type: 'assistant/message', data: { message: { content: [{ type: 'text', text: `后段助手${String(i)}` }] } } })),
    ],
  }
  const picked = pure.recentTurns(many, 2)
  check('用户消息优先保底：助手再多也挤不掉你的那一句',
    picked.some(turn => turn.text === '我的诉求'), JSON.stringify(picked))
  check('两个角色各自只取最近 N 条',
    picked.filter(turn => turn.role === 'assistant').length === 2, String(picked.length))
}

{
  const many = turns => turns
  const long = 'x'.repeat(900)
  const budgeted = pure.contextWithinBudget([
    { role: 'user', text: '最早的' },
    { role: 'assistant', text: '中间的' },
    { role: 'user', text: '最新的' },
  ], { maxChars: 5, turnMaxChars: 600 })
  check('收敛：超总量时从最旧的开始整条丢，最新那条永远留着',
    budgeted.length === 1 && budgeted[0].text === '最新的', JSON.stringify(budgeted))
  const clipped = pure.contextWithinBudget([{ role: 'user', text: long }], { maxChars: 100, turnMaxChars: 40 })
  check('收敛：单条先截断到上限、保留末尾（问题通常在最后）',
    clipped[0].text.length === 40 && clipped[0].text.startsWith('…') && clipped[0].text.endsWith('x'), String(clipped[0].text.length))
  const single = pure.contextWithinBudget([{ role: 'user', text: long }], { maxChars: 30, turnMaxChars: 600 })
  check('收敛：只剩最新一条还超预算 → 再截一次（不是丢掉它）',
    single.length === 1 && single[0].text.length <= 30, JSON.stringify(single.map(t => t.text.length)))
  check('收敛：空数组进空数组出', pure.contextWithinBudget([]).length === 0)
  check('收敛：默认参数下 4+4 条短往来全保留',
    pure.contextWithinBudget(many(Array.from({ length: 8 }, () => ({ role: 'user', text: '短句' })))).length === 8)

  check('渲染：空数组 → 空串（调用方据此不加块）', pure.contextBlock([]) === '')
  check('渲染：每条一行，标明谁说的',
    pure.contextBlock([{ role: 'user', text: 'A' }, { role: 'assistant', text: 'B' }]) === '用户：A\n工作 AI：B')
}

{
  const withIntent = pure.buildOptimizeSystem('standard', '', { intent: true })
  const without = pure.buildOptimizeSystem('standard')
  check('system：带上下文时追加"只用于理解、不算依据"那段纪律',
    withIntent.includes('不算依据') && withIntent.includes('会话上下文'), withIntent.slice(-160))
  check('system：不带上下文时没有那段', without.includes('不算依据') === false)
  check('system：两种情况都仍以输出契约结尾（契约永远是最后一块）',
    withIntent.endsWith(pure.OPTIMIZER_OUTPUT_CONTRACT) && without.endsWith(pure.OPTIMIZER_OUTPUT_CONTRACT))
  check('system：自定义提示词 + 上下文也照加纪律',
    pure.buildOptimizeSystem('standard', '我的任务段', { intent: true }).startsWith('我的任务段')
    && pure.buildOptimizeSystem('standard', '我的任务段', { intent: true }).includes('不算依据'))

  const user = pure.buildOptimizeUser('把那个页面弄好看点', { context: '用户：改一下设置页\n工作 AI：好了', previous: '上一版成品' })
  check('user：上下文与上一轮成品都有各自的块',
    user.includes('<会话上下文>') && user.includes('</会话上下文>') && user.includes('<上一轮成品>'), user.slice(0, 120))
  check('user：原文永远排在最后（紧贴任务说明）',
    user.indexOf('<原文>') > user.indexOf('</上一轮成品>') && user.indexOf('【待转达内容】') > user.indexOf('</上一轮成品>'))
  check('user：空上下文/空上一轮时不留空块',
    pure.buildOptimizeUser('X', { context: '  ', previous: '' }).includes('<会话上下文>') === false)
  check('user：没有上下文时与旧形状一致（老用例仍应通过）',
    pure.buildOptimizeUser('X').startsWith('【待转达内容】') && pure.buildOptimizeUser('X').includes('<原文>'))
}

{
  const base = {
    phase: 'done', items: [], dropped: [], text: '成品正文', edited: false, error: '', route: 'go/m',
    truncated: false, fallback: false, retried: false, promptSource: 'builtin', itemCount: 1,
    startedAt: 0, elapsedMs: 1, draftAtStart: '原文', source: '原文', slashPrefix: '',
  }
  // 0.14.0：记忆链**整条撤销**（上游硬规则 7「轮次之间不遗传」）。所以这里不再测"什么时候带"，
  // 而是钉住"怎么都不带"：请求体里不许再出现 previous 字段，宿主也不再读它。
  check('记忆链已撤销：请求体里没有 previous 字段',
    pure.optimizeDraftStream.toString().includes('previous') === false)
}

// ══════════════ 4. 提示词资产（0.6 线机制：条目 + 逐字依据） ══════════════════
console.log('4. 优化提示词：三档、依据纪律与输出契约')
{
  const advanced = pure.buildOptimizeSystem('standard')
  // 三档**提示词**规格（off 档不调用模型，没有提示词）；名字已按 0.14.0 的新档位。
  check('三档齐全', Object.keys(pure.OPTIMIZER_SPECS).join(',') === 'light,standard,heavy')
  check('人设段在（传话器）', advanced.includes('传话器/意图补全器'))
  // 0.14.0：提示词换成上游那套（硬规则 1–8 + 档位策略 + 领域维度），断言跟着改。
  check('硬规则段在（要求逐字引文）', advanced.includes('硬规则') && advanced.includes('逐字存在'))
  check('禁元话语段在', advanced.includes('不要元话语'))
  check('上游最硬的一条在（不改写你的话）', advanced.includes('你不改写它'))
  check('标准档策略在（条目内并列 + 8 条上限）',
    advanced.includes('条目内并列') && advanced.includes('最多 8 条条目'))
  check('轻度档策略在（单一解读 + 4 条上限）',
    pure.buildOptimizeSystem('light').includes('单一解读') && pure.buildOptimizeSystem('light').includes('最多 4 条条目'))
  check('重度档策略在（多假设分支 + 候选≤3 + 12 条上限）',
    pure.buildOptimizeSystem('heavy').includes('多假设分支') && pure.buildOptimizeSystem('heavy').includes('最多 3 个')
    && pure.buildOptimizeSystem('heavy').includes('最多 12 条条目'))
  check('轮次之间不遗传（上游硬规则 7）在', advanced.includes('轮次之间不遗传'))
  check('领域质量维度在（含具体维度）', advanced.includes('领域质量维度') && advanced.includes('间距与层级'))
  check('硬邦邦基调**只在** framing=hard 时追加',
    advanced.includes('硬邦邦模式') === false
    && pure.buildOptimizeSystem('standard', '', { framing: 'hard' }).includes('硬邦邦模式 · 整份辅助包的写法')
    && pure.buildOptimizeSystem('standard', '', { framing: 'hard' }).includes('不许因为口气变了而改动内容'))
  check('未知档位回落到高级', pure.buildOptimizeSystem('???') === advanced)
  check('温度：普通 0.2', pure.buildOptimizeTemperature('light') === 0.2)
  check('温度：高级 0.3', pure.buildOptimizeTemperature('standard') === 0.3)
  check('温度：未知回落高级', pure.buildOptimizeTemperature('???') === 0.3)
  // 输出契约必须**永远在最后**（模型对最后一条指令服从度最高），且不可能被自定义提示词顶掉。
  check('输出契约在末尾', advanced.endsWith(pure.OPTIMIZER_OUTPUT_CONTRACT))
  check('契约里给出 items/kind 的取值（六类都要出现）',
    advanced.includes('"items"')
    && ['user_requirement', 'quality_interpretation', 'observed_fact', 'implementation_option', 'proposal', 'unknown']
      .every(kind => advanced.includes(kind)))
  check('契约写清了各类的必填字段', advanced.includes('`quote` **必填**')
    && advanced.includes('`rationale` **必填**') && advanced.includes('`sourceRefs` **必填**'))
  check('自定义提示词整体替换任务段，契约仍追加',
    pure.buildOptimizeSystem('standard', '我的任务段').startsWith('我的任务段')
    && pure.buildOptimizeSystem('standard', '我的任务段').includes(pure.OPTIMIZER_OUTPUT_CONTRACT))
  check('空白的自定义提示词 = 用内置', pure.buildOptimizeSystem('standard', '   ') === advanced)
  check('promptSource 判定', pure.optimizePromptSource('') === 'builtin'
    && pure.optimizePromptSource('x') === 'custom')
  const user = pure.buildOptimizeUser('把那个页面弄好看点')
  check('用户消息包成「待转达内容」', user.includes('【待转达内容】') && user.includes('<原文>'))
  check('原文原样在内', user.includes('把那个页面弄好看点'))
  check('要求只输出契约要求的东西', user.includes('只输出那份 JSON 契约要求的东西'))
  check('重试话术只在 retry=true 时出现',
    !user.includes('你上一次的输出是空的')
    && pure.buildOptimizeUser('x', { retry: true }).includes('你上一次的输出是空的'))
}

// ══════════════ 4b. 依据校验与宿主装配（0.6.0 的机制内核） ════════════════════
console.log('4b. 依据校验与装配：模型能不能凭空加需求')
{
  const original = '把那个页面弄好看点，动画也加上'

  // ── 逐字定位
  const exact = pure.findQuoteSpan(original, '弄好看点')
  check('逐字引文能定位到原话', exact !== undefined && original.slice(exact.start, exact.end) === '弄好看点')
  const wrapped = '第一行\n第二行   带多空格'
  const loose = pure.findQuoteSpan(wrapped, '第二行 带多空格')
  check('空白差异（折行/多空格）也能定位并映射回真实下标',
    loose !== undefined && wrapped.slice(loose.start, loose.end).replace(/\s+/g, ' ') === '第二行 带多空格')
  check('对不上的引文 → undefined', pure.findQuoteSpan(original, '改成深色主题') === undefined)
  check('空引文 → undefined', pure.findQuoteSpan(original, '   ') === undefined)

  // ── 解析：单点不得废整轮
  const json = JSON.stringify({
    items: [
      { kind: 'user_requirement', quote: '弄好看点', text: '做得更好看' },
      { kind: 'requirement', quote: '动画也加上', text: '动画不要拖慢交互' },
      { kind: 'requirement', quote: '必须离线可用', text: '必须离线可用' },
      { kind: 'quality', text: '好看=界面精致' },
      { kind: 'bogus', text: '种类不对' },
    ],
  })
  const parsed = pure.parseOptimizeOutput(json, original)
  check('整轮不作废（ok=true）', parsed.ok === true)
  check('只保留能核对的条目', parsed.items.length === 2, JSON.stringify(parsed.items?.map(i => i.kind)))
  check('被丢的条目全都有原因', parsed.dropped.length === 3 && parsed.dropped.every(d => d.reason !== ''))
  check('引文对不上 → 丢掉并写明原因',
    parsed.dropped.some(d => d.reason.includes('逐字片段')))
  check('缺 quote → 丢掉', parsed.dropped.some(d => d.reason.includes('缺少 quote')))
  check('kind 不在白名单 → 丢掉', parsed.dropped.some(d => d.reason.includes('kind 不在允许列表')))
  check('通过校验的条目带上引文位置', parsed.items[0].span !== undefined && parsed.items[0].quoteSource === 'user')
  check('容忍 ```json 围栏', pure.parseOptimizeOutput('```json\n' + json + '\n```', original).ok === true)
  check('容忍前后废话', pure.parseOptimizeOutput('好的，这是结果：\n' + json + '\n希望有帮助', original).ok === true)
  // 兼容对方 0.6 的 ops 形态（模型见过那份契约时会写成这样）
  const opsJson = JSON.stringify({ ops: [{ op: 'add_item', item: { kind: 'user_requirement', quote: '弄好看点', text: '更精致' } }, { op: 'set_item_status', id: 'x', status: 'superseded' }] })
  const opsParsed = pure.parseOptimizeOutput(opsJson, original)
  check('认得 ops[].item 形态', opsParsed.ok === true && opsParsed.items.length === 1)
  check('不支持的 op 如实记账', opsParsed.warnings.some(w => w.includes('add_item')))

  // ── 装配：原话为骨架
  const assembled = pure.assembleCommand(original, parsed.items, { tier: 'standard' })
  // 0.14.0 ③：成品**以你的原话开头、一个字不改写**，辅助内容只作为小节追加在后面。
  check('❗原话原样保留（不再回填改写）',
    assembled.text.startsWith('把那个页面弄好看点，动画也加上'), assembled.text)
  check('补全要求带逐字依据',
    assembled.text.includes('【补全要求') && assembled.text.includes('（依据："动画也加上"）'))
  check('成品在预算内', assembled.chars <= assembled.budget, `${String(assembled.chars)}/${String(assembled.budget)}`)
  check('记账：被改写的原话字符数恒为 0', assembled.rewrittenChars === 0)
  check('记账：进入成品的条目数', assembled.itemCount === 2)

  // ── 同一段原话被两条 rewrite 引用 → 只留一条（回填顺序才可解释）
  const dup = pure.parseOptimizeOutput(JSON.stringify({
    items: [
      { kind: 'user_requirement', quote: '弄好看点', text: '甲' },
      { kind: 'user_requirement', quote: '弄好看点', text: '乙' },
    ],
  }), original)
  // 0.14.0：回填撤掉之后，同一段原话被两条引用不再有"顺序不可解释"的问题 ——
  // 两条都留着（它们会各自成为一条要求），不再互相丢弃。
  check('同一段原话的两条都保留（不再互相丢弃）',
    dup.items.length === 2 && dup.dropped.length === 0)

  // ── 上限：截断并记账，而不是整轮作废
  const many = pure.parseOptimizeOutput(JSON.stringify({
    items: Array.from({ length: pure.OPTIMIZE_MAX_ITEMS + 2 }, (_, i) => ({ kind: 'plan', text: `第 ${String(i)} 条` })),
  }), original)
  check('超出单轮上限 → 截断保留前 N 条', many.items.length === pure.OPTIMIZE_MAX_ITEMS)
  check('截断同样记账', many.dropped.some(d => d.reason.includes('截断丢弃')))
  const long = pure.parseOptimizeOutput(JSON.stringify({
    items: [{ kind: 'plan', text: 'x'.repeat(pure.OPTIMIZE_ITEM_MAX_CHARS + 50) }],
  }), original)
  check('单条超长 → 就地截断并记账',
    long.items[0].text.length === pure.OPTIMIZE_ITEM_MAX_CHARS && long.warnings.some(w => w.includes('截断')))

  // ── 篇幅闸门：预算按档位给，降级要出声
  check('basic 预算：短原话走下限、长原话走倍数',
    pure.optimizeBudgetFor('light', 10) === 400 && pure.optimizeBudgetFor('light', 1_000) === 1_400,
    JSON.stringify([pure.optimizeBudgetFor('light', 10), pure.optimizeBudgetFor('light', 1_000)]))
  check('advanced 预算比 basic 宽', pure.optimizeBudgetFor('standard', 100) > pure.optimizeBudgetFor('light', 100))
  check('预算有绝对上限（不随档位无限涨）',
    pure.optimizeBudgetFor('heavy', 1_000_000) <= 12_000)
  // 档位门：普通档不该出现 requirement / quality / plan / risk（提示词是请求，这里是保证）
  check('档位允许的条目种类（旧本体 + 0.14.0 上游六类的三级放开）',
    pure.allowedKindsFor('light').join(',') === 'rewrite,unknown,user_requirement'
    && pure.allowedKindsFor('standard').includes('requirement')
    && pure.allowedKindsFor('standard').includes('user_requirement')
    && pure.allowedKindsFor('standard').includes('plan') === false
    && pure.allowedKindsFor('heavy').includes('risk')
    && pure.allowedKindsFor('heavy').includes('proposal')
    && pure.allowedKindsFor('light').includes('proposal') === false
    && pure.allowedKindsFor('???').join(',') === pure.allowedKindsFor('standard').join(','))
  const tierGated = pure.assembleCommand(original, parsed.items, { tier: 'light' })
  check('普通档即使拿到 requirement 也不渲染（档位承诺由宿主保证）',
    !tierGated.text.includes('【补全要求')
    && tierGated.dropped.some(d => d.reason.includes('当前档位')))
  const bulky = pure.assembleCommand(original, [
    { id: 'u1', kind: 'unknown', text: 'u'.repeat(400), unknownClass: 'lookupable_fact', quoteSource: 'none' },
    { id: 'u2', kind: 'unknown', text: 'v'.repeat(400), unknownClass: 'lookupable_fact', quoteSource: 'none' },
    { id: 'r1', kind: 'risk', text: 'r'.repeat(400) },
    { id: 'r2', kind: 'risk', text: 'q'.repeat(400) },
  ], { tier: 'heavy' })
  check('超预算时按固定顺序丢可选的节（risk 先于 unknown）',
    bulky.dropped.length > 0
    && bulky.dropped.every(d => d.kind === 'risk' && d.reason.includes('budget'))
    && !bulky.dropped.some(d => d.kind === 'unknown'))
  check('还没被丢的节照常渲染', bulky.text.includes('【不明确处'))
  check('降级写明省略了几条', bulky.text.includes('因篇幅预算省略'))
  check('预算警告进了 warnings', bulky.warnings.some(w => w.includes('篇幅预算')))

  // ── 兜底口径：新机制永不比旧行为更差
  const fb = pure.runOptimizePipeline('优化后的指令', original, { tier: 'standard' })
  check('模型没给 JSON → 按旧行为整段照收（fallback）',
    fb.ok === true && fb.fallback === true && fb.text === '优化后的指令')
  const broken = pure.runOptimizePipeline('{"items":[', original, { tier: 'standard' })
  check('半截 JSON → 失败，绝不把坏 JSON 写进输入框',
    broken.ok === false && broken.code === 'BAD_JSON')
  const shape = pure.runOptimizePipeline('{"items":"not-an-array"}', original, { tier: 'standard' })
  check('有 items 键但类型不对 → 也判失败', shape.ok === false && shape.code === 'BAD_SHAPE')
  const other = pure.runOptimizePipeline('把这段配置写进 config.json：\n\n{"port":8080}', original, { tier: 'standard' })
  check('旧式自由文本里夹着 JSON → 仍走兜底照收（不误判成信封）',
    other.ok === true && other.fallback === true)
  const braceOnly = pure.runOptimizePipeline('{"port":8080}', original, { tier: 'standard' })
  check('整段就是一个不相干的 JSON 对象 → 也走兜底，不当成信封写坏',
    braceOnly.ok === true && braceOnly.fallback === true)
  const empty = pure.runOptimizePipeline('{"items":[]}', original, { tier: 'standard' })
  check('空数组 → 原话原样写回（每一轮必有成品）', empty.ok === true && empty.text === original)
  const viaPipeline = pure.runOptimizePipeline(json, original, { tier: 'standard' })
  check('整条流水线：解析→核对→装配一次跑通',
    viaPipeline.ok === true && viaPipeline.fallback === false
    && viaPipeline.text.startsWith('把那个页面弄好看点') && viaPipeline.dropped.length === 3)
}


// ══════════════ 4c. 逐条流式扫描（0.12.0 的「边写边看」） ═════════════════════
console.log('4c. 逐条流式：只交出已闭合且已通过校验的条目')

{
  const original = '把那个页面弄好看点，另外加个导出'
  // 手写 JSON（不用 JSON.stringify）是为了能精确知道"第几个 } 闭合了第几条"。
  const raw = '{"items":['
    + '{"kind":"user_requirement","quote":"把那个页面弄好看点","text":"把设置页做得好看点"},'
    + '{"kind":"requirement","quote":"弄好看点","text":"改完页面能正常打开"},'
    + '{"kind":"requirement","quote":"我没说过这句话","text":"顺便把数据库也换了"}'
    + ']}'
  const closeOfFirst = raw.indexOf('},') + 1
  const closeOfSecond = raw.indexOf('},', closeOfFirst) + 1

  const beforeFirstClose = pure.scanOptimizeStream(raw.slice(0, closeOfFirst - 1), original, 'standard')
  check('第一条还没闭合 → 一条都不显示（半截对象绝不外泄）',
    beforeFirstClose.items.length === 0, JSON.stringify(beforeFirstClose.items.map(i => i.id)))

  const afterFirstClose = pure.scanOptimizeStream(raw.slice(0, closeOfFirst), original, 'standard')
  check('第一条一闭合就出现（而且只有它）',
    afterFirstClose.items.length === 1 && afterFirstClose.items[0].id === 'item#1',
    JSON.stringify(afterFirstClose.items.map(i => i.id)))
  check('第一条的内容与引文来自原话',
    afterFirstClose.items[0].text === '把设置页做得好看点'
    && afterFirstClose.items[0].quote === '把那个页面弄好看点')

  const afterSecond = pure.scanOptimizeStream(raw.slice(0, closeOfSecond), original, 'standard')
  check('第二条闭合后依次追加（顺序稳定、只增不减）',
    afterSecond.items.map(i => i.id).join(',') === 'item#1,item#2',
    JSON.stringify(afterSecond.items.map(i => i.id)))

  // 逐字符喂一遍：任何一帧里都不许出现"引文对不上"的那条（item#3）。
  let leaked = 0
  let maxSeen = 0
  for (let n = 1; n <= raw.length; n += 1) {
    const scan = pure.scanOptimizeStream(raw.slice(0, n), original, 'standard')
    if (scan.items.some(item => item.id === 'item#3')) leaked += 1
    maxSeen = Math.max(maxSeen, scan.items.length)
  }
  check('整段逐字符喂：引文对不上的条目一次都没闪过', leaked === 0, String(leaked))
  check('逐字符喂的最大可见条数是 2（第 3 条始终被挡）', maxSeen === 2, String(maxSeen))

  const full = pure.scanOptimizeStream(raw, original, 'standard')
  check('数组闭合后 closed = true', full.closed === true)
  check('被丢的那条如实进 dropped（与批次同记账）',
    full.dropped.length === 1 && full.dropped[0].id === 'item#3' && /引文不是原话/.test(full.dropped[0].reason),
    JSON.stringify(full.dropped))

  // ── 纪律的核心断言：流式显示的条目 = 批次解析采用的条目（同一个校验函数、同一口径）。
  const batch = pure.parseOptimizeOutput(raw, original)
  const shape = list => list.map(i => `${i.id}|${i.kind}|${i.text}|${i.quote ?? ''}|${i.quoteSource}`).join('\n')
  check('流式条目与批次条目逐项相同（同判据，不是两套规则）',
    shape(full.items) === shape(batch.items), `${shape(full.items)}\n---\n${shape(batch.items)}`)
  check('流式的丢弃记账也与批次相同',
    shape(full.dropped) === shape(batch.dropped), `${JSON.stringify(full.dropped)} vs ${JSON.stringify(batch.dropped)}`)
}

{
  const original = '把那个页面弄好看点'
  // 字符串里的 `}`、引号、反斜杠都不能打断扫描（纯文本级状态机的边界用例）。
  const trickyText = '输出要包含 } 与 "引号" 与 \\ 反斜杠，还要换行\n第二行'
  const tricky = JSON.stringify({
    items: [{ kind: 'requirement', quote: '把那个页面弄好看点', text: trickyText }],
  })
  const scan = pure.scanOptimizeStream(tricky, original, 'standard')
  check('text 里带 } 与引号、反斜杠、换行也能正确闭合与解析',
    scan.items.length === 1 && scan.items[0].text === trickyText, JSON.stringify(scan.items.map(i => i.text)))

  // 档位门：basic 只做语言层修复，quality 不属于这一档 ⇒ 实时流水里也不该出现。
  const quality = JSON.stringify({
    items: [{ kind: 'quality', quote: '把那个页面弄好看点', text: '改完能正常打开' }],
  })
  check('basic 档不显示 quality 条目（与装配期的档位门同判据）',
    pure.scanOptimizeStream(quality, original, 'light').items.length === 0)
  check('advanced 档显示同一条', pure.scanOptimizeStream(quality, original, 'standard').items.length === 1)

  // ops 形态（对方 0.6 的信封）与"不支持的 op"。
  const ops = JSON.stringify({
    ops: [
      { op: 'add_item', item: { kind: 'requirement', quote: '把那个页面弄好看点', text: '改完能正常打开' } },
      { op: 'set_item_status', id: 'x', status: 'done' },
    ],
  })
  const opsScan = pure.scanOptimizeStream(ops, original, 'standard')
  check('ops 信封里只认 add_item，条目照常出现',
    opsScan.items.length === 1 && opsScan.items[0].id === 'item#1', JSON.stringify(opsScan.items.map(i => i.id)))
  check('不支持的 op 如实记一条警告',
    opsScan.warnings.some(w => w.includes('set_item_status')), JSON.stringify(opsScan.warnings))

  // 半截/坏 JSON：不抛错、不产出（失败由批次解析判）。
  check('坏 JSON 前缀不抛错、不产出',
    pure.scanOptimizeStream('{"items":[{"kind":', original, 'standard').items.length === 0)
  check('空数组：没有条目也没有丢弃，且数组已闭合',
    (() => {
      const scan = pure.scanOptimizeStream('{"items":[]}', original, 'standard')
      return scan.items.length === 0 && scan.dropped.length === 0 && scan.closed === true
    })())
  check('没有信封（自由文本）时不产出任何条目',
    pure.scanOptimizeStream('我来帮你把这句话理顺一下。', original, 'standard').items.length === 0)

  // 思考块里复述了一份假信封：扫描取**最后**一个信封 ⇒ 认的是真产出。
  const think = '<think>{"items":[{"kind":"requirement","quote":"这句在原话里不存在","text":"假的"}]}</think>'
    + JSON.stringify({ items: [{ kind: 'requirement', quote: '把那个页面弄好看点', text: '改完能正常打开' }] })
  const thinkScan = pure.scanOptimizeStream(think, original, 'standard')
  check('思考块里复述的假信封不会被当成产出（取最后一个信封）',
    thinkScan.items.length === 1 && thinkScan.items[0].quote === '把那个页面弄好看点',
    JSON.stringify(thinkScan.items.map(i => `${i.id}|${i.quote ?? ''}`)))

  // rewrite 重复段只留一条（与批次同判据）。
  const dup = JSON.stringify({
    items: [
      { kind: 'user_requirement', quote: '把那个页面', text: 'A' },
      { kind: 'user_requirement', quote: '把那个页面', text: 'B' },
    ],
  })
  const dupScan = pure.scanOptimizeStream(dup, original, 'standard')
  check('同一段原话的两条（流式）：两条都收下、不误丢',
    dupScan.items.length === 2 && dupScan.dropped.length === 0, JSON.stringify(dupScan.dropped))

  // 单轮上限（12 条）：与批次同口径。
  const many = JSON.stringify({
    items: Array.from({ length: 13 }, () => ({ kind: 'requirement', quote: '把那个页面弄好看点', text: 'X' })),
  })
  const manyScan = pure.scanOptimizeStream(many, original, 'standard')
  check('超过单轮上限的条目在流里也不出现（12 条封顶）',
    manyScan.items.length === 12 && manyScan.dropped.some(d => /上限/.test(d.reason)),
    `${String(manyScan.items.length)} / ${String(manyScan.dropped.length)}`)
}

// ══════════════ 5. 宿主半的优化接口 ═════════════════════════════════════════
console.log('5. 宿主半优化接口（假的 webServer + llm）')

/** 造一个假的宿主 ctx，并返回捕获到的路由与 llm 调用。 */
async function bootHost(options = {}) {
  const routes = []
  const llmCalls = []
  let schema = null
  const settingsState = { 'composer-ux': { enabled: true, ...(options.settings ?? {}) } }
  const settings = {
    // `modernSettings: true` 模拟 DSH 0.1.7：**没有 `get`**，自己的行只能从 `describe()` 读。
    // 自定义提示词是 0.6.0 新增的读设置路径，两代都得验（readOwnSetting → makeReader）。
    // `settingsThrows: true` 模拟"裸读服务就抛"（cordis Proxy 上没 inject 的读会这样）：
    // 优化路由只 inject 了 webServer/llm，读设置必须自己兜住，不能让整条路由挂掉。
    ...(options.settingsThrows === true
      ? {
        get: () => { throw new Error('service not injected') },
        describe: () => { throw new Error('service not injected') },
      }
      : options.modernSettings === true
        ? { describe: () => Object.entries(settingsState).map(([ns, value]) => ({ ns, value })) }
        : { get: ns => settingsState[ns] }),
    // 捕获宿主半真实注册的那一个 schema —— 它的默认值决定旧设置文档读出来是什么。
    register: (_ns, registered) => { schema = registered },
    mutate: async () => {},
  }
  /**
   * 假模型：默认吐**符合 0.6 契约的条目 JSON**（这才是产品路径）。
   * `options.chunksSeq` 让"第一次空、第二次有"这种重试用例也能造假。
   */
  const defaultChunks = [
    {
      type: 'text-delta',
      index: 0,
      text: JSON.stringify({
        items: [
          { kind: 'user_requirement', quote: '把那个页面弄好看点', text: '把设置页做得好看点' },
          { kind: 'requirement', quote: '弄好看点', text: '改完页面能正常打开' },
        ],
      }),
    },
    { type: 'finish', reason: { kind: 'stop' } },
  ]
  let callIndex = 0
  const llm = {
    // `options.resolveModelInfo` 让「钳推理档」的用例能造出路由真实暴露的档位表；
    // 不传就与过去完全一样（服务上没有这个方法）。
    ...(options.resolveModelInfo === undefined ? {} : { resolveModelInfo: options.resolveModelInfo }),
    // 0.14.1：模型清单路由用它们（不传 = 服务上没有这两个方法 ⇒ 路由给空清单）。
    ...(options.listProviders === undefined ? {} : { listProviders: options.listProviders }),
    ...(options.listModels === undefined ? {} : { listModels: options.listModels }),
    stream: (callOptions) => {
      llmCalls.push(callOptions)
      // `options.stream` 让"断连中止"这类用例自己控制流的节奏（默认是同步吐完）。
      if (typeof options.stream === 'function') return options.stream(callOptions)
      const seq = options.chunksSeq
      const chunks = Array.isArray(seq)
        ? (seq[Math.min(callIndex, seq.length - 1)] ?? [])
        : (options.chunks ?? defaultChunks)
      callIndex += 1
      return (async function* stream() {
        for (const chunk of chunks) yield chunk
      })()
    },
  }
  const services = {
    settings,
    llm,
    webServer: {
      register: (route) => {
        routes.push(route)
        return () => {}
      },
    },
    ...(options.model === undefined ? {} : { agentDefaultModel: options.model }),
    // 重启路由的第一道关卡是官方 connection.requestRejection：用它验证"先问官方那道"。
    // 0.10.0 起另三条金额路由（用量 / 价目同步 / 余额）走的是同一个关卡：用量那条还要
    // `sessions` 才会注册，所以这里让它也能按需注入（不传 ⇒ 与过去完全一样）。
    ...(options.connection === undefined ? {} : { connection: options.connection }),
    ...(options.sessions === undefined ? {} : { sessions: options.sessions }),
    // 0.12.0：会话上下文走 sessionQuery.readSession（读不到就当没上下文）。
    ...(options.sessionQuery === undefined ? {} : { sessionQuery: options.sessionQuery }),
    effect: (fn) => {
      const dispose = fn()
      return () => { if (typeof dispose === 'function') dispose() }
    },
    get: name => services[name],
  }
  const ctx = {
    inject: (deps, callback) => {
      if (!deps.every(dep => services[dep] !== undefined)) return
      callback(services)
    },
    effect: services.effect,
    on: () => {},
  }
  apply(ctx)
  await new Promise(resolve => { setTimeout(resolve, 15) })
  return { routes, llmCalls, schema: () => schema }
}

/**
 * 宿主半现在注册**六条** exact 路由（提示词优化 + 快捷指令存储 + 价目同步 + 余额 + 终端状态 + 重启），
 * 所以按**路径**取用，不要再按下标——加一条路由不该让别的用例集体改下标。
 */
const optimizerRoute = host => host.routes.find(route => route.path === pure.OPTIMIZER_API_PATH)
const storeRoute = host => host.routes.find(route => route.path === pure.QUICK_PROMPTS_API_PATH)

/** 直接驱动优化路由（后面的用例只关心这一条路由，不必每次写两遍）。 */
const handler0 = (host, req, res) => optimizerRoute(host).handler(req, res)

/**
 * 假请求：可被 for-await 读取的 body。
 * @param extra 额外的请求事实（重启用它伪造 headers / socket.remoteAddress）。
 */
function makeReq(method, body, extra = {}) {
  return {
    method,
    url: pure.OPTIMIZER_API_PATH,
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield Buffer.from(body, 'utf8')
    },
    ...extra,
  }
}

/**
 * 假响应：捕获状态码与主体。
 * `statusCode` 那个设值器是刻意的：真实 ServerResponse 两种写法都行，路由里官方那道
 * 信任关卡用的是 `res.statusCode = rejection`，harness 少这一个设值器就会把它读成 0。
 */
function makeRes() {
  const captured = { status: 0, body: '' }
  return {
    captured,
    writeHead(code) { captured.status = code },
    end(body) { captured.body = body },
    get statusCode() { return captured.status },
    set statusCode(code) { captured.status = code },
  }
}

const json = res => JSON.parse(res.captured.body)

{
  const host = await bootHost({ model: { currentSelection: () => ({ provider: 'go', model: 'deepseek-flash' }) } })
  // 0.10.0 起是六条（多了「价目同步」与「余额」），0.13.0 起是七条（多了「结果框状态」）。这条断言的价值就是
  // **新增路由必须在测试里登记**：所以既数总条数（多一条就红），又逐条比对契约里的路径常量
  // （路径改名也红）。绝不放宽成"至少 N 条"——那等于把这道登记关卡拆掉。
  const contract = readFileSync('src/settings-contract.ts', 'utf8').replace(/\r\n/g, '\n')
  const syncPath = /SYNC_API_PATH = '([^']+)'/.exec(contract)?.[1]
  const expectedPaths = [
    pure.OPTIMIZER_API_PATH, pure.OPTIMIZE_STATE_API_PATH, pure.QUICK_PROMPTS_API_PATH, syncPath,
    pure.BALANCE_API_PATH, pure.TERMINAL_API_PATH, pure.RESTART_API_PATH,
    pure.MODELS_API_PATH,
  ]
  check('注册了八条 exact 路由（优化 + 结果框状态 + 快捷指令存储 + 价目同步 + 余额 + 终端状态 + 重启 + 模型清单）',
    host.routes.length === 8
    && host.routes.every(route => route.kind === 'exact')
    && expectedPaths.every(path => typeof path === 'string' && host.routes.some(route => route.path === path)),
    JSON.stringify(host.routes.map(route => `${route.path}:${route.kind}`)))
  check('六条路由的路径两两不同（没有两条抢同一个 path）',
    new Set(host.routes.map(route => route.path)).size === host.routes.length,
    JSON.stringify(host.routes.map(route => route.path)))
  check('优化路由路径与客户端约定一致', optimizerRoute(host)?.path === pure.OPTIMIZER_API_PATH, optimizerRoute(host)?.path)
  check('存储路由路径与客户端约定一致', storeRoute(host)?.path === pure.QUICK_PROMPTS_API_PATH, storeRoute(host)?.path)
  check('价目同步路由用的就是契约里的 SYNC_API_PATH',
    syncPath !== undefined && host.routes.some(route => route.path === syncPath), String(syncPath))
  check('余额路由用的就是 balance.ts 里的 BALANCE_API_PATH',
    host.routes.some(route => route.path === pure.BALANCE_API_PATH), String(pure.BALANCE_API_PATH))

  // 新路由里"不做出网就能验"的那部分行为：参数校验在任何出网之前，以及拿不准时如实回报。
  const syncRoute = host.routes.find(route => route.path === syncPath)
  const badTarget = makeRes()
  await syncRoute.handler(makeReq('POST', JSON.stringify({ target: 'nonsense' })), badTarget)
  await new Promise(resolve => { setTimeout(resolve, 20) })
  check('价目同步：target 不是 official / modelsDev → 400（校验在任何出网之前）',
    badTarget.captured.status === 400 && json(badTarget).ok === false, badTarget.captured.body)

  const balanceRoute = host.routes.find(route => route.path === pure.BALANCE_API_PATH)
  const noCred = makeRes()
  await balanceRoute.handler(makeReq('GET'), noCred)
  await new Promise(resolve => { setTimeout(resolve, 20) })
  check('余额：宿主没有凭据服务时如实回报，绝不用 0 冒充余额',
    noCred.captured.status === 200 && json(noCred).ok === false && /凭据服务/.test(json(noCred).error),
    noCred.captured.body)

  const handler = optimizerRoute(host).handler
  const res = makeRes()
  await handler(makeReq('POST', JSON.stringify({ text: '把那个页面弄好看点', tier: 'standard' })), res)
  const body = json(res)
  check('HTTP 200', res.captured.status === 200, String(res.captured.status))
  check('按条目装配：成品以原话开头（原话原样）',
    body.ok === true && body.text.startsWith('把那个页面弄好看点'), JSON.stringify(body.text).slice(0, 120))
  check('装配出的条目落在【你要的】小节的正文里', body.text.includes('把设置页做得好看点'))
  check('补全要求带逐字依据', body.text.includes('（依据："弄好看点"）'), JSON.stringify(body.text))
  check('回报实际路由', body.provider === 'go' && body.model === 'deepseek-flash')
  check('回报记账信息（条数/丢弃/降级/重试/提示词来源）',
    body.itemCount === 2 && body.dropped.length === 0 && body.fallback === false
    && body.retried === false && body.promptSource === 'builtin',
    JSON.stringify({ itemCount: body.itemCount, dropped: body.dropped, fallback: body.fallback, promptSource: body.promptSource }))
  check('回报篇幅预算与成品长度', typeof body.budget === 'number' && body.chars === body.text.length)

  const call = host.llmCalls[0]
  check('用的是当前默认模型的 provider/model', call.provider === 'go' && call.model === 'deepseek-flash')
  check('高级档温度 0.3', call.temperature === 0.3, String(call.temperature))
  check('system 是标准档提示词（移植后的策略段）', call.system.includes('条目内并列'))
  check('system 末尾是固定的输出契约', call.system.endsWith(pure.OPTIMIZER_OUTPUT_CONTRACT))
  check('user 消息包了传话框架', call.messages[0].content[0].text.includes('【待转达内容】'))
  check('消息来源标为 user', call.messages[0].source.kind === 'user')
}
{
  // 自定义提示词（设置页里那份）必须真的被用上，且契约仍然追加在末尾。
  const host = await bootHost({
    model: { currentSelection: () => ({ provider: 'go', model: 'm' }) },
    settings: { optimizerPromptStandard: '我的自定义任务段' },
  })
  const res = makeRes()
  await handler0(host, makeReq('POST', JSON.stringify({ text: '把那个页面弄好看点', tier: 'standard' })), res)
  check('用了设置里的自定义提示词', host.llmCalls[0].system.startsWith('我的自定义任务段'))
  check('自定义提示词不顶掉输出契约', host.llmCalls[0].system.endsWith(pure.OPTIMIZER_OUTPUT_CONTRACT))
  check('回报 promptSource=custom', json(res).promptSource === 'custom', JSON.stringify(json(res).promptSource))
}
{
  // DSH 0.1.7 那一代没有 `settings.get`：自定义提示词必须能从 describe() 里读到。
  const host = await bootHost({
    model: { currentSelection: () => ({ provider: 'go', model: 'm' }) },
    modernSettings: true,
    settings: { optimizerPromptHeavy: '一代新版用的任务段' },
  })
  const res = makeRes()
  await handler0(host, makeReq('POST', JSON.stringify({ text: '把那个页面弄好看点', tier: 'heavy' })), res)
  check('0.1.7 形状（没有 get）也能读到自定义提示词',
    host.llmCalls[0].system.startsWith('一代新版用的任务段'), host.llmCalls[0].system.slice(0, 30))
}
{
  // 设置服务读一下就抛（cordis Proxy 上裸读会这样）：不该因此不注册路由，更不该让优化失败。
  const host = await bootHost({
    model: { currentSelection: () => ({ provider: 'go', model: 'm' }) },
    settingsThrows: true,
  })
  check('设置读不动也照常注册优化路由', optimizerRoute(host) !== undefined)
  const res = makeRes()
  await handler0(host, makeReq('POST', JSON.stringify({ text: '把那个页面弄好看点', tier: 'standard' })), res)
  const body = json(res)
  check('读设置抛异常 → 回落内置提示词，优化照常成功',
    body.ok === true && body.promptSource === 'builtin'
    && host.llmCalls[0].system.includes('条目内并列'), JSON.stringify({ ok: body.ok, src: body.promptSource }))
}
{
  // 模型没按契约输出 → 按旧行为整段照收（保证这次改造不会让原本能用的优化变成失败）。
  const host = await bootHost({
    model: { currentSelection: () => ({ provider: 'go', model: 'm' }) },
    chunks: [
      { type: 'text-delta', index: 0, text: '优化' },
      { type: 'text-delta', index: 0, text: '后的指令' },
      { type: 'finish', reason: { kind: 'stop' } },
    ],
  })
  const res = makeRes()
  await handler0(host, makeReq('POST', JSON.stringify({ text: '原文' })), res)
  const body = json(res)
  check('没给 JSON → 整段照收（fallback）', body.ok === true && body.text === '优化后的指令' && body.fallback === true, JSON.stringify(body))
}
{
  // 半截 JSON 绝不能写进输入框。
  const host = await bootHost({
    model: { currentSelection: () => ({ provider: 'go', model: 'm' }) },
    chunks: [
      { type: 'text-delta', index: 0, text: '{"items":[{"kind":"user_requirement",' },
      { type: 'finish', reason: { kind: 'stop' } },
    ],
  })
  const res = makeRes()
  await handler0(host, makeReq('POST', JSON.stringify({ text: '原文' })), res)
  const body = json(res)
  check('半截 JSON → ok:false，不写回坏内容', body.ok === false && body.error.includes('BAD_JSON'), JSON.stringify(body))
}
{
  // 空产出重试一次（对方 0.6 的 retryEmpty）：第一次空、第二次给出条目。
  const host = await bootHost({
    model: { currentSelection: () => ({ provider: 'go', model: 'm' }) },
    chunksSeq: [
      [{ type: 'finish', reason: { kind: 'stop' } }],
      [
        { type: 'text-delta', index: 0, text: JSON.stringify({ items: [{ kind: 'user_requirement', quote: '原文', text: '改过的原文' }] }) },
        { type: 'finish', reason: { kind: 'stop' } },
      ],
    ],
  })
  const res = makeRes()
  await handler0(host, makeReq('POST', JSON.stringify({ text: '原文' })), res)
  const body = json(res)
  check('空产出重试一次后成功（成品 = 原话 + 小节）',
    body.ok === true && body.retried === true
    && body.text.startsWith('原文') && body.text.includes('改过的原文'), JSON.stringify(body).slice(0, 140))
  check('确实调了两次模型', host.llmCalls.length === 2, String(host.llmCalls.length))
  check('第二次的用户消息点明了"上一次是空的"',
    host.llmCalls[1].messages[0].content[0].text.includes('你上一次的输出是空的'))
}
{
  // 两次都空 → 仍按原来的失败口径（ok:false），不空手写回。
  const host = await bootHost({
    model: { currentSelection: () => ({ provider: 'go', model: 'm' }) },
    chunks: [{ type: 'finish', reason: { kind: 'stop' } }],
  })
  const res = makeRes()
  await handler0(host, makeReq('POST', JSON.stringify({ text: '原文' })), res)
  const body = json(res)
  check('两次都空 → ok:false 且带重试标记', body.ok === false && body.retried === true, JSON.stringify(body))
}
{
  // 引文对不上原话 → 只丢那一条，其余照常成成品（这是这套机制的核心断言）。
  const host = await bootHost({
    model: { currentSelection: () => ({ provider: 'go', model: 'm' }) },
    chunks: [
      {
        type: 'text-delta',
        index: 0,
        text: JSON.stringify({
          items: [
            { kind: 'user_requirement', quote: '原文', text: '改过的原文' },
            { kind: 'requirement', quote: '用户根本没说过的话', text: '凭空加的需求' },
          ],
        }),
      },
      { type: 'finish', reason: { kind: 'stop' } },
    ],
  })
  const res = makeRes()
  await handler0(host, makeReq('POST', JSON.stringify({ text: '原文' })), res)
  const body = json(res)
  check('凭空加的需求进不了成品', body.ok === true && !body.text.includes('凭空加的需求'), JSON.stringify(body.text))
  check('那条被丢弃并记账', body.dropped.length === 1 && body.dropped[0].reason.includes('逐字片段'))
  check('其余条目照常成成品（原话原样 + 小节）',
    body.itemCount === 1 && body.text.startsWith('原文') && body.text.includes('改过的原文'))
}
{
  const host = await bootHost({ model: { currentSelection: () => ({ provider: 'go', model: 'm' }) } })
  const handler = optimizerRoute(host).handler
  const res = makeRes()
  await handler(makeReq('POST', JSON.stringify({ text: 'x', tier: 'light' })), res)
  check('basic 档温度 0.2', host.llmCalls[0].temperature === 0.2)
  check('轻度档 system 正确', host.llmCalls[0].system.includes('单一解读'))
}
{
  const host = await bootHost({
    model: { currentSelection: () => ({ provider: 'default', model: 'default-model' }) },
  })
  const handler = optimizerRoute(host).handler
  const res = makeRes()
  await handler(makeReq('POST', JSON.stringify({ text: 'x', provider: 'explicit', model: 'explicit-model' })), res)
  check('请求体里的路由优先于默认模型', host.llmCalls[0].provider === 'explicit' && host.llmCalls[0].model === 'explicit-model')
}
{
  const host = await bootHost()
  check('没有默认模型时路由照常注册（失败发生在调用时）', optimizerRoute(host) !== undefined)
  const handler = optimizerRoute(host).handler
  const res = makeRes()
  await handler(makeReq('POST', JSON.stringify({ text: 'x' })), res)
  const body = json(res)
  check('没有路由 → ok:false 且给出指引', body.ok === false && /模型路由/.test(body.error), JSON.stringify(body))
  check('没有路由时不调模型', host.llmCalls.length === 0)
}
{
  const host = await bootHost({ model: { currentSelection: () => ({ provider: 'go', model: 'm' }) } })
  const handler = optimizerRoute(host).handler

  const getRes = makeRes()
  await handler(makeReq('GET'), getRes)
  check('GET → 405', getRes.captured.status === 405, String(getRes.captured.status))

  const emptyRes = makeRes()
  await handler(makeReq('POST', JSON.stringify({ text: '   ' })), emptyRes)
  check('空文本 → 400', emptyRes.captured.status === 400, String(emptyRes.captured.status))

  const badJsonRes = makeRes()
  await handler(makeReq('POST', '{not json'), badJsonRes)
  check('非法 JSON → 400', badJsonRes.captured.status === 400, String(badJsonRes.captured.status))

  const longRes = makeRes()
  await handler(makeReq('POST', JSON.stringify({ text: 'x'.repeat(pure.QUICK_TEXT_MAX * 2 + 10) })), longRes)
  check('超长原文 → 400', longRes.captured.status === 400, String(longRes.captured.status))
}
{
  const host = await bootHost({
    model: { currentSelection: () => ({ provider: 'go', model: 'm' }) },
    chunks: [
      { type: 'text-delta', index: 0, text: '写了一半' },
      { type: 'finish', reason: { kind: 'error', failure: { message: '上游 502', code: 'upstream' } } },
    ],
  })
  const res = makeRes()
  await optimizerRoute(host).handler(makeReq('POST', JSON.stringify({ text: '原文' })), res)
  const body = json(res)
  check('模型报错但已有文本 → 仍返回该文本', body.ok === true && body.text === '写了一半', JSON.stringify(body))
}
{
  const host = await bootHost({
    model: { currentSelection: () => ({ provider: 'go', model: 'm' }) },
    chunks: [{ type: 'finish', reason: { kind: 'error', failure: { message: '上游 502', code: 'upstream' } } }],
  })
  const res = makeRes()
  await optimizerRoute(host).handler(makeReq('POST', JSON.stringify({ text: '原文' })), res)
  const body = json(res)
  check('模型零产出 → ok:false 并带原因', body.ok === false && body.error.includes('上游 502'), JSON.stringify(body))
}

// ══════════════ 5b. 信任关卡 / 斜杠命令 / 推理档 / 断连中止（0.11.1） ═══════
console.log('5b. 0.11.1：信任关卡、斜杠命令、推理强度、断连中止')

{
  // 1) 两条路由都要先问官方那道信任关卡，且**被拒时连请求体都不读**。
  const readFlag = { consumed: false }
  const guardReq = () => ({
    method: 'POST',
    url: pure.OPTIMIZER_API_PATH,
    async *[Symbol.asyncIterator]() {
      readFlag.consumed = true
      yield Buffer.from('{"text":"x"}', 'utf8')
    },
  })
  const host = await bootHost({
    model: { currentSelection: () => ({ provider: 'go', model: 'm' }) },
    connection: { requestRejection: () => 403 },
  })

  readFlag.consumed = false
  const rejected = makeRes()
  await handler0(host, guardReq(), rejected)
  check('优化路由先问官方信任关卡：被拒就回官方给的状态码',
    rejected.captured.status === 403, String(rejected.captured.status))
  check('被拒时连请求体都不读（关卡摆在读 body 之前）', readFlag.consumed === false)
  check('被拒时不发起任何模型调用', host.llmCalls.length === 0, String(host.llmCalls.length))

  readFlag.consumed = false
  const storeRejected = makeRes()
  await storeRoute(host).handler(guardReq(), storeRejected)
  check('快捷指令存储路由同样先问信任关卡（它会写用户提示词库）',
    storeRejected.captured.status === 403, String(storeRejected.captured.status))
  check('存储路由被拒时也不读请求体', readFlag.consumed === false)

  // 宿主没有 connection 服务（老宿主/未注入）时，关卡缺席 ≠ 拒绝：照常工作。
  const bare = await bootHost({ model: { currentSelection: () => ({ provider: 'go', model: 'm' }) } })
  const bareRes = makeRes()
  await handler0(bare, makeReq('POST', JSON.stringify({ text: '把那个页面弄好看点', tier: 'standard' })), bareRes)
  check('没有 connection 服务时照常优化（缺席不等于拒绝）', json(bareRes).ok === true, bareRes.captured.body)
}

{
  // 2) 斜杠命令：只把正文送去模型；前缀由调用方拼回。
  const host = await bootHost({ model: { currentSelection: () => ({ provider: 'go', model: 'm' }) } })
  const res = makeRes()
  await handler0(host, makeReq('POST', JSON.stringify({ text: '/goal 把那个页面弄好看点', tier: 'standard' })), res)
  const body = json(res)
  const sent = host.llmCalls[0].messages[0].content[0].text
  check('斜杠命令：送去模型的是命令后面的正文', sent.includes('把那个页面弄好看点') && sent.includes('【待转达内容】'), sent.slice(0, 60))
  check('斜杠命令：前缀不进模型（不然命令词会被改坏）', sent.includes('/goal') === false, sent.slice(0, 60))
  check('斜杠命令：返回的成品不含前缀（拼回由调用方负责）',
    body.ok === true && body.text.includes('/goal') === false, JSON.stringify(body.text))
  check('斜杠命令：引文按正文比对，成品以原话开头（原话原样）',
    body.ok === true && body.text.startsWith('把那个页面弄好看点'), JSON.stringify(body.text))

  const onlyCmd = makeRes()
  await handler0(host, makeReq('POST', JSON.stringify({ text: '/goal', tier: 'standard' })), onlyCmd)
  check('只有命令、没有正文 → 400，并说明原因',
    onlyCmd.captured.status === 400 && /没有正文/.test(json(onlyCmd).error), onlyCmd.captured.body)
  check('只有命令时确实没有发起模型调用', host.llmCalls.length === 1, String(host.llmCalls.length))

  const pathLike = makeRes()
  await handler0(host, makeReq('POST', JSON.stringify({ text: '/path/to/file 这个报错怎么修', tier: 'standard' })), pathLike)
  check('`/path/...` 不是命令：整段照旧送去优化（不误拆）',
    host.llmCalls[1].messages[0].content[0].text.includes('/path/to/file 这个报错怎么修'),
    host.llmCalls[1].messages[0].content[0].text.slice(0, 80))
}

{
  // 3) 推理强度：按路由真实暴露的档位钳最低；拿不准就什么都不传。
  const infoWith = efforts => () => Promise.resolve({ provider: 'go', model: 'm', name: 'm', reasoning: { efforts } })
  const run = async host => {
    const res = makeRes()
    await handler0(host, makeReq('POST', JSON.stringify({ text: '把那个页面弄好看点', tier: 'standard' })), res)
    return res
  }

  const byName = await bootHost({
    model: { currentSelection: () => ({ provider: 'go', model: 'm' }) },
    resolveModelInfo: infoWith([{ id: 'high', name: '高' }, { id: 'low', name: '低' }]),
  })
  await run(byName)
  check('钳到路由最省的推理档（按 name 里的「低」）',
    byName.llmCalls[0].reasoningEffort === 'low', String(byName.llmCalls[0].reasoningEffort))

  const byId = await bootHost({
    model: { currentSelection: () => ({ provider: 'go', model: 'm' }) },
    resolveModelInfo: infoWith([{ id: 'xhigh', name: '最高' }, { id: 'off', name: '关闭' }]),
  })
  await run(byId)
  check('按 id 里的 off 也能认出来最低档',
    byId.llmCalls[0].reasoningEffort === 'off', String(byId.llmCalls[0].reasoningEffort))

  const fallbackFirst = await bootHost({
    model: { currentSelection: () => ({ provider: 'go', model: 'm' }) },
    resolveModelInfo: infoWith([{ id: 'xhigh', name: '最高' }, { id: 'mid', name: '中' }]),
  })
  await run(fallbackFirst)
  check('没有像「低」的档 → 取适配器展示顺序首位',
    fallbackFirst.llmCalls[0].reasoningEffort === 'xhigh', String(fallbackFirst.llmCalls[0].reasoningEffort))

  const none = await bootHost({ model: { currentSelection: () => ({ provider: 'go', model: 'm' }) } })
  await run(none)
  check('路由不暴露档位表 → 不传 reasoningEffort（绝不乱造值）',
    Object.prototype.hasOwnProperty.call(none.llmCalls[0], 'reasoningEffort') === false,
    JSON.stringify(Object.keys(none.llmCalls[0])))

  const throwing = await bootHost({
    model: { currentSelection: () => ({ provider: 'go', model: 'm' }) },
    resolveModelInfo: () => { throw new Error('adapter exploded') },
  })
  const thrownRes = await run(throwing)
  check('档位解析抛错也不拖垮这次优化',
    json(thrownRes).ok === true
    && Object.prototype.hasOwnProperty.call(throwing.llmCalls[0], 'reasoningEffort') === false,
    thrownRes.captured.body)
}

{
  // 4) 断连即中止：客户端关页面/切走时不再白烧额度。
  let release
  const gate = new Promise(resolve => { release = resolve })
  const host = await bootHost({
    model: { currentSelection: () => ({ provider: 'go', model: 'm' }) },
    stream: (callOptions) => (async function* () {
      yield { type: 'text-delta', index: 0, text: '{"items":[' }
      await gate
      // 真实适配器 signal 被 abort 后会停止产出、并以 aborted 收尾 —— 这里如实照做，
      // 于是"断连"这一路走的就是真机的路径（半截 JSON → BAD_JSON → 不写回）。
      if (callOptions.signal?.aborted === true) {
        yield { type: 'finish', reason: { kind: 'aborted' } }
        return
      }
      yield { type: 'text-delta', index: 0, text: ']}' }
      yield { type: 'finish', reason: { kind: 'stop' } }
    })(),
  })
  const captured = { status: 0, body: '' }
  const listeners = []
  const res = {
    writeHead(code) { captured.status = code },
    end(body) { captured.body = body },
    on(event, listener) { listeners.push([event, listener]); return this },
    get statusCode() { return captured.status },
    set statusCode(code) { captured.status = code },
  }

  const pending = handler0(host, makeReq('POST', JSON.stringify({ text: '把那个页面弄好看点', tier: 'standard' })), res)
  await new Promise(resolve => { setTimeout(resolve, 20) })
  check('优化进行中在 res 上挂了 close 监听（用 res 而不是 req）',
    listeners.some(([event]) => event === 'close'), JSON.stringify(listeners.map(([event]) => event)))
  const signal = host.llmCalls[0]?.signal
  check('模型调用带上了 abort signal（这次调用可被打断）', signal !== undefined && signal.aborted === false)

  for (const [event, listener] of listeners) if (event === 'close') listener()
  release()
  await pending
  check('客户端断连 → 这次模型调用被 abort', signal.aborted === true)
  check('断连后不假装成功：如实回失败',
    captured.status === 200 && json({ captured }).ok === false, captured.body)
}

// ══════════════ 5c. 流式（SSE）优化接口（0.12.0） ═══════════════════════════
console.log('5c. 流式优化接口：逐条事件 + done 给结论（旧 JSON 路径不变）')

/** 能收下 SSE 的假响应：把 `data:` 行解析成事件数组。 */
function makeStreamRes() {
  const captured = { status: 0, headers: {}, body: '', events: [] }
  return {
    captured,
    writeHead(code, headers) { captured.status = code; captured.headers = headers ?? {} },
    write(chunk) {
      captured.body += String(chunk)
      for (const frame of String(chunk).split('\n\n')) {
        const line = frame.split('\n').find(row => row.startsWith('data: '))
        if (line !== undefined) captured.events.push(JSON.parse(line.slice(6)))
      }
    },
    end(body) { if (typeof body === 'string') captured.body += body },
    get statusCode() { return captured.status },
    set statusCode(code) { captured.status = code },
  }
}

/** 明确要流式的请求（`Accept: text/event-stream`）。 */
const streamReq = body => makeReq('POST', body, { headers: { accept: 'text/event-stream' } })

{
  const host = await bootHost({ model: { currentSelection: () => ({ provider: 'go', model: 'deepseek-flash' }) } })
  const res = makeStreamRes()
  await handler0(host, streamReq(JSON.stringify({ text: '把那个页面弄好看点', tier: 'standard' })), res)
  const events = res.captured.events

  check('SSE：回 200 且 content-type 是 text/event-stream',
    res.captured.status === 200 && /text\/event-stream/.test(res.captured.headers['content-type'] ?? ''),
    JSON.stringify(res.captured.headers))
  check('SSE：声明不缓存（中间层不许把流缓存起来）',
    /no-cache/.test(res.captured.headers['cache-control'] ?? ''), String(res.captured.headers['cache-control']))

  const items = events.filter(event => event.type === 'item')
  check('SSE：逐条事件按数组顺序给出已校验的条目',
    items.length === 2 && items[0].index === 1 && items[1].index === 2 && items[0].kind === 'user_requirement',
    JSON.stringify(items.map(row => `${String(row.index)}|${row.kind}`)))
  check('SSE：条目带逐字引文（与成品里的「依据」同源）',
    items[0].quote === '把那个页面弄好看点' && items[0].quoteSource === 'user', JSON.stringify(items[0]))

  const done = events.find(event => event.type === 'done')
  check('SSE：done 带完整结论（与一次给 JSON 的字段同形）',
    done?.ok === true && typeof done.text === 'string' && done.provider === 'go' && done.model === 'deepseek-flash',
    JSON.stringify(done))
  check('SSE：done 是最后一个事件', events[events.length - 1]?.type === 'done',
    JSON.stringify(events.map(event => event.type)))

  // 两条路径必须给出一模一样的成品 —— 流式只改"送达方式"，不改任何判定。
  const once = makeRes()
  await handler0(host, makeReq('POST', JSON.stringify({ text: '把那个页面弄好看点', tier: 'standard' })), once)
  check('SSE：成品与旧 JSON 路径逐字相同', done.text === json(once).text,
    `${String(done.text)} vs ${String(json(once).text)}`)
}

{
  // 真·边写边看：第一条在模型**还没写完**的时候就已经推给客户端了。
  let sawItemBeforeFinish = false
  let resRef = null
  const host = await bootHost({
    model: { currentSelection: () => ({ provider: 'go', model: 'm' }) },
    stream: () => (async function* () {
      yield { type: 'text-delta', index: 0, text: '{"items":[{"kind":"user_requirement","quote":"把那个页面弄好看点","text":"把设置页做得好看点"}' }
      sawItemBeforeFinish = resRef !== null && resRef.captured.events.some(event => event.type === 'item')
      yield { type: 'text-delta', index: 0, text: ']}' }
      yield { type: 'finish', reason: { kind: 'stop' } }
    })(),
  })
  const res = makeStreamRes()
  resRef = res
  await handler0(host, streamReq(JSON.stringify({ text: '把那个页面弄好看点', tier: 'standard' })), res)
  check('SSE：条目在模型还没写完时就已推给客户端（真·边写边看）', sawItemBeforeFinish)
  check('SSE：闭合后不重复推送', res.captured.events.filter(event => event.type === 'item').length === 1,
    String(res.captured.events.filter(event => event.type === 'item').length))
}

{
  // 引文对不上原话的条目：一次都不许闪出来（与批次同一判据），但要走 dropped 如实记账。
  const host = await bootHost({
    model: { currentSelection: () => ({ provider: 'go', model: 'm' }) },
    chunks: [
      { type: 'text-delta', index: 0, text: '{"items":[' },
      { type: 'text-delta', index: 0, text: '{"kind":"requirement","quote":"我在思考里编的","text":"假的"},' },
      { type: 'text-delta', index: 0, text: '{"kind":"requirement","quote":"把那个页面弄好看点","text":"真的"}' },
      { type: 'text-delta', index: 0, text: ']}' },
      { type: 'finish', reason: { kind: 'stop' } },
    ],
  })
  const res = makeStreamRes()
  await handler0(host, streamReq(JSON.stringify({ text: '把那个页面弄好看点', tier: 'standard' })), res)
  const items = res.captured.events.filter(event => event.type === 'item')
  check('SSE：引文对不上原话的条目一次都没出现',
    items.length === 1 && items[0].quote === '把那个页面弄好看点', JSON.stringify(items))
  check('SSE：被丢的那条走 dropped 事件如实记账',
    res.captured.events.some(event => event.type === 'dropped' && /引文不是原话/.test(String(event.reason))),
    JSON.stringify(res.captured.events.filter(event => event.type === 'dropped')))
}

{
  // 预校验失败：流还没开始，照旧普通 JSON + 4xx（与对方 0.3.17 的"预校验走状态码"同口径）。
  const host = await bootHost({ model: { currentSelection: () => ({ provider: 'go', model: 'm' }) } })
  const res = makeStreamRes()
  await handler0(host, streamReq(JSON.stringify({ text: '   ', tier: 'standard' })), res)
  check('SSE：预校验失败仍回普通 JSON + 400（不是事件流）',
    res.captured.status === 400 && res.captured.events.length === 0 && JSON.parse(res.captured.body).ok === false,
    res.captured.body)

  const onlyCmd = makeStreamRes()
  await handler0(host, streamReq(JSON.stringify({ text: '/goal', tier: 'standard' })), onlyCmd)
  check('SSE：只有命令没有正文也是 400（不发请求）',
    onlyCmd.captured.status === 400 && /没有正文/.test(json({ captured: { body: onlyCmd.captured.body } }).error),
    onlyCmd.captured.body)
}

// ══════════════ 5d. 会话上下文与记忆链（宿主半，0.12.0） ═════════════════════
console.log('5d. 宿主半：上下文进提示词、开关能真关、记忆链透传')

{
  const snapshot = {
    events: [
      { type: 'user/message', data: { content: [{ type: 'text', text: '帮我改一下设置页' }], source: { kind: 'user' } } },
      { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: '好了，标题改了' }] } } },
    ],
  }
  const readCalls = []
  const boot = (extra = {}) => bootHost({
    model: { currentSelection: () => ({ provider: 'go', model: 'm' }) },
    sessionQuery: { readSession: async id => { readCalls.push(id); return snapshot } },
    ...extra,
  })

  readCalls.length = 0
  const withContext = await boot()
  const res1 = makeRes()
  await handler0(withContext, makeReq('POST', JSON.stringify({ text: '它那个也顺手改一下', tier: 'standard', sessionId: 's-1' })), res1)
  const user1 = withContext.llmCalls[0].messages[0].content[0].text
  check('上下文：送到模型的 user 里有会话往来块',
    user1.includes('<会话上下文>') && user1.includes('帮我改一下设置页') && user1.includes('工作 AI：好了，标题改了'),
    user1.slice(0, 120))
  check('上下文：system 里有"只用于理解、不算依据"那段纪律',
    withContext.llmCalls[0].system.includes('不算依据'), withContext.llmCalls[0].system.slice(-120))
  check('上下文：按 sessionId 读会话', readCalls.length === 1 && readCalls[0] === 's-1', JSON.stringify(readCalls))
  check('上下文：回报带了几个往来（可观测）', json(res1).contextTurns === 2, String(json(res1).contextTurns))
  check('上下文：原文仍排在最后，引文仍按原文校验',
    user1.indexOf('</会话上下文>') < user1.indexOf('<原文>') && json(res1).ok === true, JSON.stringify(json(res1).text))

  readCalls.length = 0
  const off = await boot({ settings: { optimizerContext: false } })
  const res2 = makeRes()
  await handler0(off, makeReq('POST', JSON.stringify({ text: '它那个也顺手改一下', tier: 'standard', sessionId: 's-1' })), res2)
  check('开关关掉：不读会话（连快照都不读）', readCalls.length === 0, JSON.stringify(readCalls))
  check('开关关掉：提示词里没有上下文块与那段纪律',
    off.llmCalls[0].messages[0].content[0].text.includes('<会话上下文>') === false
    && off.llmCalls[0].system.includes('不算依据') === false)
  check('开关关掉：回报 contextTurns = 0', json(res2).contextTurns === 0, String(json(res2).contextTurns))

  readCalls.length = 0
  const noSession = await boot()
  const res3 = makeRes()
  await handler0(noSession, makeReq('POST', JSON.stringify({ text: '把那个页面弄好看点', tier: 'standard' })), res3)
  check('没送 sessionId：不读会话、照常优化',
    readCalls.length === 0 && json(res3).ok === true && json(res3).contextTurns === 0, JSON.stringify(json(res3).contextTurns))

  const noService = await bootHost({ model: { currentSelection: () => ({ provider: 'go', model: 'm' }) } })
  const res4 = makeRes()
  await handler0(noService, makeReq('POST', JSON.stringify({ text: '把那个页面弄好看点', tier: 'standard', sessionId: 's-1' })), res4)
  check('宿主没有 sessionQuery：按"没有上下文"继续，不失败',
    json(res4).ok === true && json(res4).contextTurns === 0, res4.captured.body.slice(0, 80))

  const broken = await bootHost({
    model: { currentSelection: () => ({ provider: 'go', model: 'm' }) },
    sessionQuery: { readSession: async () => { throw new Error('log corrupt') } },
  })
  const res5 = makeRes()
  await handler0(broken, makeReq('POST', JSON.stringify({ text: '把那个页面弄好看点', tier: 'standard', sessionId: 's-1' })), res5)
  check('读会话抛错：上下文当没有，优化照常完成',
    json(res5).ok === true && json(res5).contextTurns === 0, res5.captured.body.slice(0, 80))
}

{
  // 记忆链：客户端只在"接着改"时才带 previous；宿主如实透传、并截断到 1500。
  const host = await bootHost({ model: { currentSelection: () => ({ provider: 'go', model: 'm' }) } })
  const res = makeRes()
  await handler0(host, makeReq('POST', JSON.stringify({
    text: '把那个页面弄好看点，另外加个导出', tier: 'standard', previous: '上一版成品：把设置页做得好看点',
  })), res)
  const user = host.llmCalls[0].messages[0].content[0].text
  // 0.14.0：记忆链整条撤销（上游硬规则 7）。所以这里钉的是「**就算客户端还发 previous，宿主也不认**」。
  check('记忆链已撤销：previous 不再进 user 块', user.includes('上一轮成品') === false, user.slice(0, 120))
  check('记忆链已撤销：回报里不再有 hadPrevious 字段', json(res).hadPrevious === undefined)
}

// ══════════════ 5e. 逐轮台账（0.13.0）：真路由跑一轮，磁盘上只有元数据 ══════════════════
console.log('5e. 逐轮台账：真路由跑一轮 → 磁盘上一条元数据，且搜不到原文')
{
  const dir = mkdtempSync(join(tmpdir(), 'composer-ux-ledger-'))
  const previousHome = process.env.DSH_HOME
  process.env.DSH_HOME = dir
  try {
    const host = await bootHost({ model: { currentSelection: () => ({ provider: 'go', model: 'deepseek-flash' }) } })
    // 一个**只可能来自草稿**的词：台账里出现它就说明原文泄进去了。
    const secret = '独角兽紫罗兰七号'
    const draft = `把那个页面弄好看点：${secret}`
    const res = makeRes()
    await handler0(host, makeReq('POST', JSON.stringify({ text: draft, tier: 'standard', sessionId: 'sess-ledger-1' })), res)
    check('这一轮成功（假模型吐 2 条）', json(res).ok === true && json(res).itemCount === 2, JSON.stringify(json(res)).slice(0, 90))

    const file = join(dir, 'composer-ux', 'optimize-log.jsonl')
    check('台账文件写出来了', existsSync(file))
    const text1 = readFileSync(file, 'utf8')
    check('落了一条记录', text1.trim().split('\n').length === 1)
    const record = JSON.parse(text1.trim())
    check('是成功的 run 记录', record.kind === 'run' && record.ok === true)
    check('记的是草稿**字数**而不是草稿', record.draftChars === draft.length, `${record.draftChars} vs ${draft.length}`)
    check('记了条目数/档位/路由',
      record.items === 2 && record.tier === 'standard' && record.provider === 'go' && record.model === 'deepseek-flash',
      JSON.stringify([record.items, record.tier, record.provider, record.model]))
    check('记了会话与耗时', record.sessionId === 'sess-ledger-1' && Number.isFinite(record.ms))
    check('❗台账里搜不到草稿里那个独特的词', !text1.includes(secret))
    check('❗台账里也没有成品的句子', !text1.includes('把设置页做得好看点'))

    // 第二轮：追加而不是覆盖（台账是流水，不是"最后一次状态"）
    const res2 = makeRes()
    await handler0(host, makeReq('POST', JSON.stringify({ text: '把那个页面弄好看点', tier: 'light', sessionId: 'sess-ledger-2' })), res2)
    const lines2 = readFileSync(file, 'utf8').trim().split('\n')
    check('第二轮是追加', lines2.length === 2 && JSON.parse(lines2[1]).tier === 'light', String(lines2.length))
    check('两条记录的 sessionId 各自正确',
      JSON.parse(lines2[0]).sessionId === 'sess-ledger-1' && JSON.parse(lines2[1]).sessionId === 'sess-ledger-2')

    // 丢弃原因：装配层那条模板里嵌着**模型给的引文**（这里故意让它包含那个独特的词）。
    // 台账必须只留机器前缀 —— 这是"只记元数据"这条承诺最容易被打破的一处。
    const dropHost = await bootHost({
      model: { currentSelection: () => ({ provider: 'go', model: 'm' }) },
      chunks: [{
        type: 'text-delta',
        index: 0,
        text: JSON.stringify({
          items: [
            { kind: 'user_requirement', quote: '把那个页面弄好看点', text: '把设置页做得好看点' },
            // 引文**不是**原话里的逐字片段（多了一个字） ⇒ 整条丢弃，原因里带它前 40 字。
            { kind: 'user_requirement', quote: `${secret}要更好看`, text: '随便写点什么' },
          ],
        }),
      }, { type: 'finish', reason: { kind: 'stop' } }],
    })
    const dropRes = makeRes()
    await handler0(dropHost, makeReq('POST', JSON.stringify({ text: draft, tier: 'standard', sessionId: 'sess-ledger-3' })), dropRes)
    // 注意：路由返回的 `dropped` 是**条目数组**，台账里记的才是条数。
    check('这条用例真的触发了丢弃', json(dropRes).dropped.length === 1, JSON.stringify(json(dropRes).dropped))
    const lines3 = readFileSync(file, 'utf8').trim().split('\n')
    const dropped = JSON.parse(lines3[2])
    check('台账记了丢弃条数与原因', dropped.dropped === 1 && dropped.droppedReasons.length === 1, JSON.stringify(dropped.droppedReasons))
    check('❗丢弃原因只剩机器前缀（引文那一段被刮掉）',
      dropped.droppedReasons[0] === '引文不是原话里的逐字片段：', dropped.droppedReasons[0])
    check('❗整份台账（含丢弃原因）搜不到那个独特的词', !readFileSync(file, 'utf8').includes(secret))

    // 开关关掉：一条都不写
    const offHost = await bootHost({
      model: { currentSelection: () => ({ provider: 'go', model: 'm' }) },
      settings: { optimizerLedger: false },
    })
    const before = readFileSync(file, 'utf8').trim().split('\n').length
    await handler0(offHost, makeReq('POST', JSON.stringify({ text: '把那个页面弄好看点', tier: 'light' })), makeRes())
    check('开关关掉后一条都不写', readFileSync(file, 'utf8').trim().split('\n').length === before, String(before))

    // 被官方信任关卡拒掉的请求不该进台账（连 body 都不读，当然也不该记账）
    const rejectedHost = await bootHost({
      model: { currentSelection: () => ({ provider: 'go', model: 'm' }) },
      connection: { requestRejection: () => 403 },
    })
    await handler0(rejectedHost, makeReq('POST', JSON.stringify({ text: '把那个页面弄好看点', tier: 'light' })), makeRes())
    check('被信任关卡拒掉的请求不进台账',
      readFileSync(file, 'utf8').trim().split('\n').length === before)
  } finally {
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
    rmSync(dir, { recursive: true, force: true })
  }
}

// ══════════════ 5g. 只读查证工具（0.13.0 ⑤）：开关、真派工具、查完不是 JSON 就回落 ══════════════
console.log('5g. 只读查证工具：默认关、开了才派、查完不是条目 JSON 就回落')
{
  const dir = mkdtempSync(join(tmpdir(), 'composer-ux-tools-host-'))
  const previousHome = process.env.DSH_HOME
  process.env.DSH_HOME = dir
  try {
    writeFileSync(join(dir, 'README.md'), '项目说明：这一行是文件内容，不该出现在台账里\n')
    const sessionQuery = { readSession: async () => ({ header: { cwd: dir } }) }
    const selection = { currentSelection: () => ({ provider: 'go', model: 'deepseek-flash' }) }
    const draft = '把那个页面弄好看点'
    const finalJson = JSON.stringify({ items: [{ kind: 'user_requirement', quote: '弄好看点', text: '把这一页做得好看点' }] })
    const readCall = [
      { type: 'text-delta', index: 0, text: '我先看一眼。' },
      { type: 'tool-call-delta', index: 1, id: 'call-1', name: 'read', argumentsDelta: '{"path":"README.md"}' },
      { type: 'finish', reason: { kind: 'stop' } },
    ]
    const ledgerFile = join(dir, 'composer-ux', 'optimize-log.jsonl')

    // ① 默认关：一次调用，调用里没有 tools
    const off = await bootHost({ model: selection, sessionQuery })
    await handler0(off, makeReq('POST', JSON.stringify({ text: draft, tier: 'standard', sessionId: 's-tools-1' })), makeRes())
    check('默认关：只调一次模型', off.llmCalls.length === 1, String(off.llmCalls.length))
    check('默认关：调用里不带 tools', off.llmCalls[0].tools === undefined)

    // ② 开着：第 1 轮请求读文件，第 2 轮给条目 JSON
    const host = await bootHost({
      model: selection,
      sessionQuery,
      settings: { optimizeReadTools: true },
      chunksSeq: [readCall, [{ type: 'text-delta', index: 0, text: finalJson }, { type: 'finish', reason: { kind: 'stop' } }]],
    })
    const res = makeRes()
    await handler0(host, makeReq('POST', JSON.stringify({ text: draft, tier: 'standard', sessionId: 's-tools-1' })), res)
    check('开着：调了两次模型（查证 + 收尾）', host.llmCalls.length === 2, String(host.llmCalls.length))
    check('开着：第一次调用带三个只读工具', host.llmCalls[0].tools?.length === 3, String(host.llmCalls[0].tools?.length))
    check('开着：系统提示里带了只读查证说明', String(host.llmCalls[0].system).includes('只读查证'))
    check('开着：第二轮带上了 role:tool 的结果消息（含工具真读到的内容）',
      host.llmCalls[1].messages.some(m => m.role === 'tool' && String(m.content?.[0]?.text).includes('这一行是文件内容')))
    check('开着：这一轮成功（工具路径的产出被认可）', json(res).ok === true, JSON.stringify(json(res)).slice(0, 80))
    check('开着：结果里报出工具轮次/次数，并说明没有回落',
      json(res).toolRounds === 2 && json(res).toolCalls === 1 && json(res).toolFallback === false,
      JSON.stringify({ r: json(res).toolRounds, c: json(res).toolCalls, f: json(res).toolFallback }))
    const ledgerText = existsSync(ledgerFile) ? readFileSync(ledgerFile, 'utf8') : ''
    const ledgerRow = ledgerText.trim().split('\n').map(line => JSON.parse(line)).filter(row => row.kind === 'run').at(-1)
    check('台账记了工具轮次与次数', ledgerRow?.toolRounds === 2 && ledgerRow?.toolCalls === 1, JSON.stringify(ledgerRow?.toolNames))
    check('❗台账里没有工具读到的文件内容（只记数字与工具名）', !ledgerText.includes('这一行是文件内容'))
    check('❗工具名进台账但只有名字', JSON.stringify(ledgerRow?.toolNames) === '["read"]', JSON.stringify(ledgerRow?.toolNames))

    // ③ 工具路径查完却吐散文（不是那份 JSON）⇒ 必须回落成不带工具的单次调用
    const prose = await bootHost({
      model: selection,
      sessionQuery,
      settings: { optimizeReadTools: true },
      chunksSeq: [
        readCall,
        [{ type: 'text-delta', index: 0, text: '我看过 README，所以建议你把这一页做得好看点。' }, { type: 'finish', reason: { kind: 'stop' } }],
        [{ type: 'text-delta', index: 0, text: finalJson }, { type: 'finish', reason: { kind: 'stop' } }],
      ],
    })
    const res3 = makeRes()
    await handler0(prose, makeReq('POST', JSON.stringify({ text: draft, tier: 'standard', sessionId: 's-tools-2' })), res3)
    check('回落：那次不带工具的调用确实发生了（第 3 次）', prose.llmCalls.length === 3, String(prose.llmCalls.length))
    check('回落：不带工具那次**换掉了系统提示**（否则模型还在等工具）',
      !String(prose.llmCalls[2].system).includes('只读查证') && prose.llmCalls[2].tools === undefined)
    check('回落：结果如实标注「查证后回落」，并保留真实的轮次',
      json(res3).toolFallback === true && json(res3).toolRounds === 2 && json(res3).ok === true,
      JSON.stringify({ f: json(res3).toolFallback, r: json(res3).toolRounds, ok: json(res3).ok }))

    // ④ 拿不到会话工作目录 ⇒ 一个工具都不派（没有围栏的根就不猜路径）
    const noCwd = await bootHost({
      model: selection,
      sessionQuery: { readSession: async () => ({ header: {} }) },
      settings: { optimizeReadTools: true },
    })
    await handler0(noCwd, makeReq('POST', JSON.stringify({ text: draft, tier: 'standard', sessionId: 's-tools-3' })), makeRes())
    check('拿不到工作目录就不派工具', noCwd.llmCalls.length === 1 && noCwd.llmCalls[0].tools === undefined)
  } finally {
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
    rmSync(dir, { recursive: true, force: true })
  }
}

// ══════════════ 6. 宿主半真实注册的 settings schema ═════════════════════════
console.log('6. settings schema（宿主半真实注册的那一个）')
{
  const host = await bootHost({ model: { currentSelection: () => ({ provider: 'go', model: 'm' }) } })
  const schema = host.schema()
  check('schema 已被注册', schema !== null && typeof schema === 'function')

  // 旧设置文档（没有 quickPrompts 键）读出来必须直接得到内置 9 条 —— 否则升级后
  // 面板是空的，用户会以为功能没做出来。
  const fresh = plain(schema({}))
  check('旧文档 → 快捷指令回落内置 9 条', fresh.quickPrompts?.length === 9, String(fresh.quickPrompts?.length))
  check('旧文档 → 档位回落高级', fresh.optimizerTier === 'standard', fresh.optimizerTier)
  check('旧文档 → 三档自定义提示词回落空串（= 内置）',
    fresh.optimizerPromptLight === '' && fresh.optimizerPromptStandard === '' && fresh.optimizerPromptHeavy === '',
    JSON.stringify([fresh.optimizerPromptLight, fresh.optimizerPromptStandard, fresh.optimizerPromptHeavy]))
  check('自定义提示词能透过 schema 原样回来',
    plain(schema({ optimizerPromptStandard: '我的任务段' })).optimizerPromptStandard === '我的任务段')
  check('旧文档 → 原有字段仍齐', fresh.enabled === true && fresh.sendKey === 'Enter' && fresh.headerName === 'x-opencode-session')
  check('内置条目结构正确', fresh.quickPrompts[0].id === 'builtin-1' && fresh.quickPrompts[0].always === false)

  const custom = plain(schema({ quickPrompts: [{ id: 'x', label: 'L', prompt: 'P', always: true }] }))
  check('已有列表原样保留', custom.quickPrompts.length === 1 && custom.quickPrompts[0].id === 'x')

  const empty = plain(schema({ quickPrompts: [] }))
  check('空列表是合法值（被尊重，不回落）', empty.quickPrompts.length === 0)

  // 0.5.0 五栏开关：schema 里**故意不给默认值**（`.required(false)`）。
  // 迁移要用的信息就是"文档里到底有没有这个键"：schemastery 对缺省的 required(false)
  // 键会**整个省掉**（返回 undefined），一旦有人给它补上 `.default(false)`，
  // "从没碰过"与"明确关掉"就再也分不出来，迁移会静默失效。
  check('五栏开关在 schema 里是可缺省的（缺省 ≠ false，迁移靠这个区分）',
    empty.keysEnabled === undefined && empty.menuEnabled === undefined && empty.quickEnabled === undefined
    && empty.panelEnabled === undefined && empty.terminalEnabled === undefined,
    JSON.stringify([empty.keysEnabled, empty.menuEnabled, empty.quickEnabled, empty.panelEnabled, empty.terminalEnabled]))
  check('用户写过的 false 原样解析回来（不会被默认值顶掉）',
    plain(schema({ menuEnabled: false })).menuEnabled === false
    && plain(schema({ panelEnabled: false, panelScroll: true })).panelEnabled === false)
  // 0.10.0 新增的三个字段：节假日表 / 峰谷提醒 / 自动同步价目。
  // 「自动同步」是**会自己出网**的开关，所以它必须"默认关 + 用户写 true 才生效"，
  // 且两条路径（schema 解析 / sanitizeSettings）必须给同一个默认值。
  check('金额 0.10.0 字段在 schema 里（节假日 / 峰谷提醒 / 自动同步）',
    'peakHolidays' in empty && 'peakAlert' in empty && 'priceAutoSync' in empty,
    JSON.stringify(Object.keys(empty).filter(key => key.startsWith('peak') || key.startsWith('price'))))
  check('自动同步默认关（schema 与净化结果一致）',
    empty.priceAutoSync === false && pure.DEFAULT_SETTINGS.priceAutoSync === false
    && pure.sanitizeSettings({}).priceAutoSync === false)
  check('自动同步：用户写了 true 就照收（不会被默认值顶掉）',
    pure.sanitizeSettings({ priceAutoSync: true }).priceAutoSync === true
    && plain(schema({ priceAutoSync: true })).priceAutoSync === true)
  check('自动同步：脏值（字符串 / 数字）落回关',
    pure.sanitizeSettings({ priceAutoSync: 'yes' }).priceAutoSync === false
    && pure.sanitizeSettings({ priceAutoSync: 1 }).priceAutoSync === false)
  check('节假日表：坏日期丢掉、好的留下、空数组 = 明确"没有节假日"（不是内置）',
    JSON.stringify(pure.sanitizeSettings({ peakHolidays: ['2026-10-01', 'bad', '2026-13-01'] }).peakHolidays)
      === JSON.stringify(['2026-10-01'])
    && pure.sanitizeSettings({ peakHolidays: [] }).peakHolidays === undefined)
  check('峰谷提醒：坏值逐项退回默认（提前量被钳在 1–60）',
    (() => {
      const alert = pure.sanitizeSettings({ peakAlert: { aheadMinutes: 999, enabled: 'x' } }).peakAlert
      return alert.aheadMinutes === 60 && alert.enabled === true && alert.webNotify === false
    })())
}

// ══════════════ 7. 样式：实色按钮的「填充 + 前景」必须成对 ═══════════════════
//
// 这一节是一次真实事故的回归护栏：`--dsw-alias-button-primary-fill` 取自
// `--dsw-alias-brand-primary`，浅色主题是墨色（深），**深色主题却是白**。
// 一旦给它配写死的 `#fff`，暗色主题下就是白底白字 —— 组件渲染不出来，
// 任何行为测试都发现不了，只有把样式对象当数据查才能提前拦住。
console.log('7. 样式配对（fill 必须配 label-primary-foreground）')
{
  const FILL = 'var(--dsw-alias-button-primary-fill)'
  const FOREGROUND = 'var(--dsw-alias-label-primary-foreground)'
  const solid = Object.entries(pure.styles)
    .filter(([, style]) => typeof style?.background === 'string' && style.background.includes(FILL))

  check('确实存在用到该填充的样式（防止本测试空跑）', solid.length >= 2, `命中 ${solid.length} 条`)
  for (const [name, style] of solid) {
    check(`${name}: 前景用配对令牌而非写死白`, style.color === FOREGROUND, String(style.color))
  }

  // 反向：整个样式表里不该再出现写死的 #fff（本插件没有需要固定白字的实色块）。
  const hardWhite = Object.entries(pure.styles)
    .filter(([, style]) => typeof style?.color === 'string' && /^#fff(f{0,2})?$/i.test(style.color.trim()))
    .map(([name]) => name)
  check('没有样式把文字写死成 #fff', hardWhite.length === 0, hardWhite.join(', '))

  // 列表行必须可压缩，否则「默认插入」勾选框会被长预览挤出面板。
  const item = pure.styles.quickItem
  check('条目按钮可被压缩（flex 1 1 auto + minWidth 0）',
    item.flex === '1 1 auto' && item.minWidth === 0, `flex=${item.flex} minWidth=${item.minWidth}`)
  check('条目按钮不再吃满整行（width 已移除）', item.width === undefined, String(item.width))

  // 入口按钮样式改用注入样式表，且**不能再有行内样式**（行内表达不了 hover）。
  check('入口按钮有稳定类名', pure.QUICK_BUTTON_CLASS === 'composer-ux-quick-button', pure.QUICK_BUTTON_CLASS)
  check('入口按钮的旧行内样式已删除',
    pure.styles.quickButton === undefined && pure.styles.quickButtonActive === undefined
    && pure.styles.quickButtonIcon === undefined)
}

// ══════════════ 8. 设置面板尺寸手柄：层叠上下文陷阱的护栏 ═══════════════════
//
// 背景（0.2.0 整段功能失效）：手柄原先渲染在 shell.overlay 里、用视口坐标对准
// 面板画。但 shell.overlay 被官方封在
// `.overlayLayer { position:absolute; inset:0; z-index:20 }` —— position + z-index
// 使它自成层叠上下文，里面的 z-index 再大也出不去，永远排在设置弹窗
// （.overlay z-index:1000）下面，被全屏遮罩吃掉鼠标。
// 修法：把手柄 createPortal 到面板内部。下面的断言守住这个修法。
console.log('8. 设置面板尺寸手柄（挂进面板内部，不比层叠）')
{
  const SOURCE = readFileSync('src/client/PanelResizeHandles.tsx', 'utf8').replace(/\r\n/g, '\n')

  check('手柄通过 createPortal 挂进面板', SOURCE.includes('createPortal('))

  // 反例：靠"大 z-index"压在弹窗上是无效的（层叠上下文封死了），必须不许再出现。
  const zIndexEscapes = SOURCE.match(/zIndex:\s*\d{3,}/g) ?? []
  check('不再靠大 z-index 压弹窗（层叠上下文里无效）', zIndexEscapes.length === 0, zIndexEscapes.join(','))

  // 定位必须相对面板，而不是视口坐标。
  const boxes = ['left', 'right', 'top', 'bottom', 'br'].map(edge => [edge, pure.handleBox(edge)])
  check('五个位置都有定位盒', boxes.length === 5)
  const malformed = boxes.filter(([edge, box]) => {
    const anchors = ['left', 'right', 'top', 'bottom'].filter(k => typeof box[k] === 'number')
    const hasSize = typeof box.width === 'number' || typeof box.height === 'number'
    return anchors.length === 0 || !hasSize || typeof box.cursor !== 'string' || box.cursor === ''
  }).map(([edge]) => String(edge))
  check('每个手柄都有锚边 + 尺寸 + 光标', malformed.length === 0, malformed.join(', '))
  const huge = boxes.flatMap(([edge, box]) => Object.entries(box)
    .filter(([key, value]) => key !== 'cursor' && typeof value === 'number' && value > 40)
    .map(([key, value]) => `${edge}.${key}=${value}`))
  check('定位是面板内相对值（没有视口级大坐标）', huge.length === 0, huge.join(', '))
  check('四边各自贴对应的一边', pure.handleBox('left').left === 0 && pure.handleBox('right').right === 0
    && pure.handleBox('top').top === 0 && pure.handleBox('bottom').bottom === 0)
  check('四边带对应方向的缩放光标',
    pure.handleBox('left').cursor === 'ew-resize' && pure.handleBox('right').cursor === 'ew-resize'
    && pure.handleBox('top').cursor === 'ns-resize' && pure.handleBox('bottom').cursor === 'ns-resize')
  check('右下角抓手带对角缩放光标', pure.handleBox('br').cursor === 'nwse-resize')

  // 描边：贴面板圆角、纯视觉、不吃指针。
  const outline = pure.RESIZE_OUTLINE_STYLE
  check('描边圆角跟随面板（inherit，不写死数字）', outline.borderRadius === 'inherit', String(outline.borderRadius))
  check('描边铺满面板且不吃指针', outline.inset === 0 && outline.pointerEvents === 'none')

  // 指针事件的开关方向必须对：层不吃指针、手柄才吃。写反了会让整个面板点不动。
  const PANEL_SRC = readFileSync('src/client/panel.ts', 'utf8').replace(/\r\n/g, '\n')
  const layerRule = PANEL_SRC.match(new RegExp(`\\.\\$\\{RESIZE_LAYER_CLASS\\}[^}]*\\}`))?.[0] ?? ''
  check('手柄层 pointer-events: none（否则整块面板点不动）',
    layerRule.includes('pointer-events: none'), layerRule.replace(/\s+/g, ' ').slice(0, 90))
  const interactiveRule = PANEL_SRC.match(/\.\$\{RESIZE_EDGE_CLASS\}, \.\$\{RESIZE_GRIP_CLASS\}[^}]*\}/)?.[0] ?? ''
  check('手柄自身 pointer-events: auto', interactiveRule.includes('pointer-events: auto'),
    interactiveRule.replace(/\s+/g, ' ').slice(0, 90))

  // 面板选择器得对得上官方面板结构（role/aria + 直接子 nav）。
  check('面板选择器仍是官方面板结构',
    pure.PANEL_SELECTOR === '[role="dialog"][aria-modal="true"]:has(> nav)', pure.PANEL_SELECTOR)
}

console.log('10. 重启 DSH（机制照搬插件市场；spawn/定时/退出/取路径全部注入）')
{
  // ── 启动命令重建（dshArgv 的两种形态）────────────────────────────────────
  const facts = over => ({
    node: 'D:\\node\\node.exe',
    argv1: 'D:\\DeepSeek Harness\\apps\\cli\\lib\\bin.js',
    execArgv: [],
    rest: ['web'],
    cwd: 'D:\\DeepSeek Harness',
    platform: 'win32',
    resolve: p => p,
    dirname: p => p.slice(0, p.lastIndexOf('\\')),
    ...over,
  })
  const winLaunch = pure.launchCommand(facts())
  check('入口像 dsh 入口 → node + 绝对入口 + 之后的参数（如 web）',
    winLaunch.file === 'D:\\node\\node.exe'
    && winLaunch.args.join('|') === 'D:\\DeepSeek Harness\\apps\\cli\\lib\\bin.js|web',
    JSON.stringify(winLaunch))
  // 0.15.5：cwd 改成**原 cwd**（逐字重放的一部分）—— 相对入口靠它解析，
  // 而不是靠「入口所在目录」（那是旧启发式的产物）。
  check('cwd 用原 cwd（逐字重放）', winLaunch.cwd === 'D:\\DeepSeek Harness', winLaunch.cwd)
  check('execArgv 排在入口之前',
    pure.launchCommand(facts({ execArgv: ['--import', 'tsx/esm'] })).args.join('|')
      === '--import|tsx/esm|D:\\DeepSeek Harness\\apps\\cli\\lib\\bin.js|web')
  check('相对入口原样重放（子进程继承同一个 cwd，所以解析得到）',
    pure.launchCommand(facts({ argv1: 'apps/cli/lib/bin.js' })).args.join('|')
      === 'apps/cli/lib/bin.js|web')
  // ❗这条就是真机那个 bug 的回归：桌面壳起宿主用的是 dsh-desktop-host/lib/cli.js，
  // 旧实现「入口不像 dsh 就退回裸 dsh」、把 argv1 丢掉 ⇒ 替换进程报 invalid profile name
  // 当场退出（助手日志里就是这条，一直没成功过）。现在必须**逐字重放**。
  const others = pure.launchCommand(facts({
    argv1: 'D:\\deepseekharness\\resources\\app.asar\\dsh\\node_modules\\@deepseek-ai\\dsh-desktop-host\\lib\\cli.js',
    rest: ['D:\\deepseekharness\\resources\\app.asar\\dsh'],
  }))
  check('❗入口不像 dsh（桌面壳那条路）也逐字重放，绝不退化成裸 dsh',
    others.file === 'D:\\node\\node.exe'
    && others.args.join('|') === 'D:\\deepseekharness\\resources\\app.asar\\dsh\\node_modules\\@deepseek-ai\\dsh-desktop-host\\lib\\cli.js|D:\\deepseekharness\\resources\\app.asar\\dsh',
    JSON.stringify(others))
  check('重放不带 shell（node 直接跑入口）', others.viaShell === false)
  const shim = pure.launchCommand(facts({ argv1: 'C:\\npm\\dsh.cmd', rest: ['web'] }))
  check('argv1 是 .cmd shim ⇒ 交给 shell（node 跑不了它）',
    shim.file === 'C:\\npm\\dsh.cmd' && shim.viaShell === true && shim.args.join('|') === 'web', JSON.stringify(shim))
  check('裸 dsh 在 POSIX 上不过 shell',
    pure.launchCommand(facts({ argv1: undefined, platform: 'linux' })).viaShell === false)
  check('node 可执行文件优先用 argv0（Android 上 execPath 是动态链接器）',
    pure.nodeExecutableOf({ argv0: 'D:\\node\\node.exe', execPath: 'X', exists: () => true }) === 'D:\\node\\node.exe')
  check('argv0 不是绝对路径或不存在 → 退回 execPath',
    pure.nodeExecutableOf({ argv0: 'node', execPath: 'D:\\node\\node.exe', exists: () => true }) === 'D:\\node\\node.exe'
    && pure.nodeExecutableOf({ argv0: 'D:\\ghost.exe', execPath: 'D:\\node\\node.exe', exists: () => false }) === 'D:\\node\\node.exe')

  // ── Windows 的 spawn 包装（唯一目的是给它一个隐藏控制台）────────────────
  const winSpawn = pure.respawnCommand(winLaunch, 'win32')
  check('Windows 改用 powershell -NoProfile -WindowStyle Hidden',
    winSpawn.file === 'powershell.exe'
    && winSpawn.args.slice(0, 4).join(' ') === '-NoProfile -WindowStyle Hidden -Command',
    JSON.stringify(winSpawn.args.slice(0, 5)))
  check('命令串里每一段都用 PowerShell 单引号包住',
    winSpawn.args[4].startsWith("& 'D:\\node\\node.exe' 'D:\\DeepSeek Harness\\apps\\cli\\lib\\bin.js' 'web'"),
    winSpawn.args[4])
  check('detached=false：真正的隐藏交给助手那层的 windowsHide（CREATE_NO_WINDOW）',
    winSpawn.detached === false && winSpawn.viaShell === false)
  const bareDsh = pure.launchCommand(facts({ argv1: undefined }))
  check('没有 argv1 ⇒ 退回裸 dsh（Windows 上过 shell）',
    bareDsh.file === 'dsh' && bareDsh.viaShell === true, JSON.stringify(bareDsh))
  check('裸 dsh 在 Windows 上补成 dsh.cmd（PowerShell 会优先选被策略拒绝的 .ps1）',
    pure.respawnCommand(bareDsh, 'win32').args[4].startsWith("& 'dsh.cmd'"))
  check('已经是 .cmd 就不重复补',
    pure.respawnCommand({ ...bareDsh, file: 'dsh.cmd' }, 'win32').args[4].startsWith("& 'dsh.cmd'"))
  const posixSpawn = pure.respawnCommand(winLaunch, 'linux')
  check('POSIX 就是原命令 + detached',
    posixSpawn.file === winLaunch.file && posixSpawn.detached === true && posixSpawn.viaShell === false)
  check('单引号里的单引号写两遍（路径带引号不会破）',
    pure.quotePowerShell("C:\\it's here\\a b.exe") === "'C:\\it''s here\\a b.exe'",
    pure.quotePowerShell("C:\\it's here\\a b.exe"))

  // ── 端口与信任关卡（这是"杀进程"的接口，所以逐条断言）──────────────────
  check('端口从 Host 头里读（含 IPv6 字面量）',
    pure.servingPort('127.0.0.1:3080') === 3080 && pure.servingPort('[::1]:3080') === 3080)
  check('Host 里没有端口 → null（默认端口，助手退回固定等待）',
    pure.servingPort('localhost') === null && pure.servingPort(undefined) === null
    && pure.servingPort('a:0') === null && pure.servingPort('a:70000') === null)
  check('回环地址三种写法都认', ['127.0.0.1', '::1', '::ffff:127.0.0.1'].every(pure.isLoopbackAddress))
  check('非回环不认', !pure.isLoopbackAddress('192.168.1.5') && !pure.isLoopbackAddress(undefined))

  const trust = over => ({
    remoteAddress: '127.0.0.1',
    headers: { host: '127.0.0.1:3080', origin: 'http://127.0.0.1:3080' },
    ...over,
  })
  check('本机同源 POST → 放行', pure.trustedRestartRequest(trust()) === true)
  check('非回环 peer → 拒', pure.trustedRestartRequest(trust({ remoteAddress: '10.0.0.9' })) === false)
  check('任何转发痕迹 → 拒（说明中间站着代理，不是用户）',
    ['forwarded', 'x-forwarded-for', 'x-forwarded-host', 'x-real-ip'].every(name =>
      pure.trustedRestartRequest(trust({ headers: { ...trust().headers, [name]: 'x' } })) === false))
  // 0.15.3：判据对齐 HHHEEEWWW/dsh-quick-restart —— **放行**缺 Origin（桌面版壳就是这样）
  // 与 `dsh-app://`；http 来源才要求与 Host 同源（且 Host 缺了就算不同源）。
  check('缺 Origin ⇒ 放行（桌面版壳的原生来源）',
    pure.trustedRestartRequest(trust({ headers: { host: '127.0.0.1:3080' } })) === true)
  check('`dsh-app://` 来源 ⇒ 放行',
    pure.trustedRestartRequest(trust({ headers: { origin: 'dsh-app://dsh' } })) === true)
  check('`Origin: null` ⇒ 放行',
    pure.trustedRestartRequest(trust({ headers: { origin: 'null' } })) === true)
  check('http 来源但缺 Host ⇒ 拒（算不同源）',
    pure.trustedRestartRequest(trust({ headers: { origin: 'http://127.0.0.1:3080' } })) === false)

  // 0.15.2：403 要说清是哪一条不满足（用户截图里两枚按钮只报一句「不许」，查不出原因）。
  check('放行时 reason = ok', pure.explainRestartTrust(trust()).reason === 'ok')
  check('非回环 ⇒ peer-not-loopback',
    pure.explainRestartTrust(trust({ remoteAddress: '10.0.0.9' })).reason === 'peer-not-loopback')
  check('带转发头 ⇒ forwarded-header',
    pure.explainRestartTrust(trust({ headers: { ...trust().headers, 'x-forwarded-for': '1.1.1.1' } })).reason === 'forwarded-header')
  check('缺 Origin ⇒ reason 仍是 ok（放行）',
    pure.explainRestartTrust(trust({ headers: { host: '127.0.0.1:3080' } })).reason === 'ok')
  check('`dsh-app://` ⇒ ok（这一条就是用户那两枚按钮的根因）',
    pure.explainRestartTrust(trust({ headers: { origin: 'dsh-app://dsh', host: '127.0.0.1:3080' } })).reason === 'ok')
  check('http 来源但缺 Host ⇒ origin-host-mismatch',
    pure.explainRestartTrust(trust({ headers: { origin: 'http://127.0.0.1:3080' } })).reason === 'origin-host-mismatch')
  check('Origin 指向非回环地址 ⇒ origin-not-loopback',
    pure.explainRestartTrust(trust({ headers: { origin: 'http://10.0.0.9:3080', host: '10.0.0.9:3080' } })).reason === 'origin-not-loopback')
  check('❗localhost 与 127.0.0.1 不算同源（原因写得明明白白，不是一句「不许」）',
    pure.explainRestartTrust(trust({ headers: { host: '127.0.0.1:3080', origin: 'http://localhost:3080' } })).reason === 'origin-host-mismatch')
  check('Origin 解析不出来 ⇒ origin-unparsable',
    pure.explainRestartTrust(trust({ headers: { host: '127.0.0.1:3080', origin: 'not a url' } })).reason === 'origin-unparsable')
  check('给用户的那句话带原因与当时看到的事实',
    (() => {
      const facts = pure.explainRestartTrust(trust({ remoteAddress: '10.0.0.9' }))
      const text = pure.restartTrustText(facts)
      return text.includes('不是从本机回环地址') && text.includes('peer=10.0.0.9')
        && text.includes('origin=http://127.0.0.1:3080') && text.includes('转发头=无')
    })())
  check('放行时不啰嗦（空串）', pure.restartTrustText(pure.explainRestartTrust(trust())) === '')

  // ---- 桌面形态（0.16.0）：连壳一起换掉，壳就看不到子进程退出、不会弹恢复框 ----
  check('桌面形态判定：Electron 二进制 + Node 模式',
    pure.desktopKindOf({ env: { ELECTRON_RUN_AS_NODE: '1' }, execPath: 'C:\\app\\DeepSeek Harness.exe' }) === true)
  check('web 形态判定：普通 node（不带那个变量）',
    pure.desktopKindOf({ env: {}, execPath: 'C:\\node\\node.exe' }) === false)
  check('web 形态判定：有变量但 execPath 不是 .exe',
    pure.desktopKindOf({ env: { ELECTRON_RUN_AS_NODE: '1' }, execPath: '/usr/bin/node' }) === false)

  const desktopHelper = pure.restartHelperSource({
    spawned: { file: 'C:\\node\\node.exe', args: ['x.js'], viaShell: false, detached: true },
    cwd: 'D:\\work', logs: { out: 'o.log', err: 'e.log' }, port: 19387,
    desktop: { shellPid: 111, hostPid: 222, appExe: 'C:\\app\\DeepSeek Harness.exe' },
  })
  check('桌面形态的助手：杀壳只用 /PID（/T 会把助手自己一起带走）',
    desktopHelper.includes('taskkill') && desktopHelper.includes('"/PID"') && !desktopHelper.includes('"/T"'))
  check('桌面形态的助手：绝不按映像名扫（/IM 会误杀自己）', !desktopHelper.includes('"/IM"'))
  check('❗桌面形态的助手：重建前必须删掉 ELECTRON_RUN_AS_NODE（否则拉起的是又一个 node）',
    desktopHelper.includes('delete env.ELECTRON_RUN_AS_NODE'))
  check('桌面形态的助手：用应用 exe 重建、且不传参数',
    desktopHelper.includes('spawn(desktop.appExe, []'))
  check('桌面形态的助手：等旧宿主真的没了才重建',
    desktopHelper.includes('alive(desktop.hostPid)'))
  const webHelper = pure.restartHelperSource({
    spawned: { file: 'dsh', args: ['web'], viaShell: true, detached: true },
    cwd: 'D:\\work', logs: { out: 'o.log', err: 'e.log' }, port: 3080, desktop: null,
  })
  check('web 形态的助手：桌面事实是 null ⇒ 那段换壳代码永远不会被调用',
    webHelper.includes('const desktop = null')
    && webHelper.includes('if (desktop === null) main()'))
  check('跨站 Origin → 拒（DNS rebinding / 跨站调用挡在这里）',
    pure.trustedRestartRequest(trust({ headers: { host: '127.0.0.1:3080', origin: 'http://evil.example' } })) === false)
  check('非 http(s) 的 Origin → 拒',
    pure.trustedRestartRequest(trust({ headers: { host: 'x', origin: 'file:///etc/passwd' } })) === false)
  check('Origin 不是合法 URL → 拒',
    pure.trustedRestartRequest(trust({ headers: { host: 'x', origin: 'not a url' } })) === false)
  check('重复 Host 头取第一个',
    pure.trustedRestartRequest(trust({
      headers: { host: ['127.0.0.1:3080', 'evil.example'], origin: 'http://127.0.0.1:3080' },
    })) === true)

  // ── 调试器 / supervisor（两种"不该从界面里杀掉"的宿主）──────────────────
  const dbg = over => ({ inspectorUrl: undefined, execArgv: [], nodeOptions: undefined, ...over })
  check('inspector 已开 → 不给重启', pure.detectedDebugger(dbg({ inspectorUrl: 'ws://127.0.0.1:9229/x' })) === 'inspector')
  check('execArgv 里的 --inspect / --inspect-brk=9229 认出来',
    pure.detectedDebugger(dbg({ execArgv: ['--inspect'] })) === 'inspector'
    && pure.detectedDebugger(dbg({ execArgv: ['--inspect-brk=9229'] })) === 'inspector')
  check('NODE_OPTIONS 里的 --inspect 也认',
    pure.detectedDebugger(dbg({ nodeOptions: '--max-old-space-size=4096 --inspect' })) === 'inspector')
  check('按 token 前缀匹配：路径里带 inspect 的脚本名不误判',
    pure.detectedDebugger(dbg({ execArgv: ['C:\\tools\\inspect-tool.js'] })) === null
    && pure.detectedDebugger(dbg({ nodeOptions: '--inspection-mode' })) === null)
  check('都没有 → null', pure.detectedDebugger(dbg()) === null)

  const sup = over => ({ env: {}, ppid: 500, parentComm: () => 'bash', ...over })
  check('没有 systemd 标记 → null', pure.detectedSupervisor(sup()) === null)
  check('有 INVOCATION_ID 但父进程是普通 shell → null（继承不等于拥有）',
    pure.detectedSupervisor(sup({ env: { INVOCATION_ID: 'abc' } })) === null)
  check('INVOCATION_ID + 父进程是 PID 1 → systemd',
    pure.detectedSupervisor(sup({ env: { INVOCATION_ID: 'abc' }, ppid: 1 })) === 'systemd')
  check('INVOCATION_ID + 父进程 comm 是 systemd → systemd',
    pure.detectedSupervisor(sup({ env: { INVOCATION_ID: 'abc' }, parentComm: () => 'systemd' })) === 'systemd')
  check('JOURNAL_STREAM 同样算标记',
    pure.detectedSupervisor(sup({ env: { JOURNAL_STREAM: '8:1' }, ppid: 1 })) === 'systemd')

  // ── 助手源码（把每条"为什么"都变成断言）────────────────────────────────
  const helperOf = port => pure.restartHelperSource({
    spawned: pure.respawnCommand(winLaunch, 'win32'),
    cwd: 'D:\\DeepSeek Harness',
    logs: { out: 'C:\\Temp\\a.out.log', err: 'C:\\Temp\\a.err.log' },
    port,
  })
  const helper = helperOf(3080)
  check('等端口而不是睡死时间：connect 探测 + 250ms 轮询 + 30 秒上限',
    helper.includes('net.connect') && helper.includes('const pollMs = 250')
    && helper.includes('const portWaitMs = 30000'))
  check('用 connect 探而不是 bind（bind 会自己占住那个马上要交出去的端口）',
    helper.includes('probe.destroy()') && !helper.includes('.listen('))
  check('端口空出来后还多等 300ms（Windows 的 TIME_WAIT 尾巴）', helper.includes('const settleMs = 300'))
  check('起新宿主带 windowsHide（没控制台的助手 spawn 控制台程序会新建可见窗口）',
    helper.includes('windowsHide: true'))
  check('stdout/stderr 各一个日志文件',
    helper.includes('fs.openSync(logOut, "a")') && helper.includes('fs.openSync(logErr, "a")'))
  check('spawn 的失败单独接住（异步报错，try/catch 抓不到）', helper.includes('child.on("error"'))
  check('起完再验证端口 20 秒，没起来写一行诊断',
    helper.includes('const replacementWaitMs = 20000') && helper.includes('did not bind port'))
  check('诊断落进 err 日志并带插件名前缀', helper.includes("'[dsh-composer-ux] '"))
  check('注入值一律 JSON 串（路径带引号/空格不会破）',
    helper.includes('const file = "powershell.exe"')
    && helper.includes('const cwd = "D:\\\\DeepSeek Harness"'))
  check('没有端口时先等 1500ms、起完再活 3000ms（别把还没 detach 完的替换进程带走）',
    helperOf(null).includes('const noPortDelayMs = 1500') && helperOf(null).includes('const lingerMs = 3000'))

  // ── 真跑一遍助手：这类 bug 只在运行时露出来 ──────────────────────────────
  {
    const { spawn } = await import('node:child_process')
    const fsMod = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const dir = fsMod.mkdtempSync(join(tmpdir(), 'composer-ux-helper-'))
    /**
     * 跑一次助手。轮询到证据出现就杀掉它 —— 别让测试真去等它自然结束。
     * @param port 传 null 时跳过"等端口"那一段；给真端口才会走那段逻辑。
     */
    const runHelper = async (spawned, evidence, budgetMs, port = null) => {
      const out = join(dir, 'out.log')
      const err = join(dir, 'err.log')
      const child = spawn(process.execPath, ['-e', pure.restartHelperSource({
        spawned, cwd: dir, logs: { out, err }, port,
      })], { stdio: 'ignore' })
      const until = Date.now() + budgetMs
      let hit = false
      while (Date.now() < until) {
        if (evidence()) { hit = true; break }
        await new Promise(resolve => { setTimeout(resolve, 100) })
      }
      child.kill()
      const errText = () => (fsMod.existsSync(err) ? fsMod.readFileSync(err, 'utf8').replace(/\r\n/g, '\n') : '')
      return { hit, out, errText }
    }
    /** 让"替换进程"留下一个标记文件。 */
    const writeMarker = target =>
      `require('node:fs').writeFileSync(${JSON.stringify(target)}, 'REPLACEMENT-UP')`

    // 真测"等端口"：先把端口占住（助手必须等），200ms 后放掉 —— 助手应当**立刻**起进程，
    // 远早于"固定 sleep 1500ms"那种实现。这条断言才是这段逻辑真正的护栏，
    // 只查源码里有没有 net.connect 是咬不住"把 while 换成 sleep"那种改动的。
    {
      const { createServer } = await import('node:net')
      const held = createServer(() => {})
      await new Promise(resolve => { held.listen(0, '127.0.0.1', resolve) })
      const heldPort = held.address().port
      const fastMarker = join(dir, 'port-wait.txt')
      const startedAt = Date.now()
      const slowStart = runHelper(
        { file: process.execPath, args: ['-e', writeMarker(fastMarker)], viaShell: false, detached: false },
        () => fsMod.existsSync(fastMarker),
        5000,
        heldPort,
      )
      setTimeout(() => { held.close() }, 200)
      const waited = await slowStart
      const elapsed = Date.now() - startedAt
      check('助手等的是端口而不是固定时长：端口一空出来就起进程（远早于固定 sleep 的 1500ms）',
        waited.hit && elapsed < 1400, `marker=${String(waited.hit)} elapsed=${String(elapsed)}ms`)
    }

    const marker = join(dir, 'replacement-ran.txt')
    const okRan = await runHelper(
      { file: process.execPath, args: ['-e', writeMarker(marker)], viaShell: false, detached: false },
      () => fsMod.existsSync(marker),
      8000,
    )
    check('助手真的把替换进程起来了（替换进程自己留下的标记文件出现）', okRan.hit,
      fsMod.existsSync(marker) ? '' : '标记文件没出现')
    check('助手开了输出日志（stdio 接的是文件而不是管道）', fsMod.existsSync(okRan.out))

    const errPath = join(dir, 'err.log')
    const badRan = await runHelper(
      { file: join(dir, 'no-such-binary-xyz.exe'), args: [], viaShell: false, detached: false },
      () => fsMod.existsSync(errPath)
        && fsMod.readFileSync(errPath, 'utf8').replace(/\r\n/g, '\n').includes('could not start the replacement'),
      8000,
    )
    check('替换进程起不来 → 助手把原因写进 err 日志（会记日志的宿主已经退出了，只能它写）',
      badRan.hit, badRan.errText().slice(0, 200))
    fsMod.rmSync(dir, { recursive: true, force: true })
  }

  // ── 排期：分离起助手 + 延迟退出自己 ─────────────────────────────────────
  const fakeRestartIo = over => {
    const calls = { spawn: [], waited: [], stopped: 0 }
    let unrefed = 0
    let releaseWait
    const helperChild = { pid: 4242, unref: () => { unrefed += 1 }, once: () => {} }
    const io = {
      platform: 'win32',
      pid: 1111,
      argv0: 'D:\\node\\node.exe',
      execPath: 'D:\\node\\node.exe',
      argv1: 'D:\\DeepSeek Harness\\apps\\cli\\lib\\bin.js',
      execArgv: [],
      rest: ['web'],
      cwd: 'D:\\DeepSeek Harness',
      env: { PATH: 'x' },
      tmpdir: 'C:\\Temp',
      stamp: '2026-01-01T00-00-00',
      exists: () => true,
      resolve: p => p,
      dirname: () => 'D:\\DeepSeek Harness\\apps\\cli',
      join: (...parts) => parts.join('\\'),
      spawn: (command, args, options) => {
        calls.spawn.push({ command, args, options })
        return helperChild
      },
      stop: () => { calls.stopped += 1 },
      wait: ms => {
        calls.waited.push(ms)
        return new Promise(resolve => { releaseWait = resolve })
      },
      ...over,
    }
    return { io, calls, release: () => releaseWait?.(), unrefed: () => unrefed }
  }

  {
    const { io, calls, release, unrefed } = fakeRestartIo()
    const scheduled = pure.scheduleRestart(io, 3080)
    check('助手用 node -e <源码> 起（不留脚本文件在磁盘上）',
      calls.spawn[0]?.command === 'D:\\node\\node.exe' && calls.spawn[0]?.args[0] === '-e'
      && calls.spawn[0].args[1].includes('net.connect'), JSON.stringify(calls.spawn[0]?.command))
    check('助手 detached + 忽略 stdio + windowsHide',
      calls.spawn[0]?.options?.detached === true && calls.spawn[0]?.options?.stdio === 'ignore'
      && calls.spawn[0]?.options?.windowsHide === true)
    check('助手 unref（不然它拖着宿主不退出）', unrefed() === 1)
    check('回给界面：helperPid / 两个日志路径 / 端口 / 重放命令',
      scheduled.ok === true && scheduled.helperPid === 4242
      && scheduled.logOut.includes(pure.RESTART_LOG_PREFIX)
      && scheduled.logErr.includes(pure.RESTART_LOG_PREFIX)
      && scheduled.port === 3080 && scheduled.command.includes('powershell.exe'),
      JSON.stringify(scheduled))
    check('退出是延迟的（先把 HTTP 响应发出去）',
      calls.waited[0] === pure.RESTART_EXIT_DELAY_MS && calls.stopped === 0, JSON.stringify(calls))
    release()
    await new Promise(resolve => { setTimeout(resolve, 0) })
    check('延迟到点才 stop 自己', calls.stopped === 1, String(calls.stopped))
  }
  {
    const { io, calls } = fakeRestartIo()
    io.spawn = () => { throw new Error('spawn 失败') }
    let threw = null
    try { pure.scheduleRestart(io, null) } catch (error) { threw = error }
    check('助手都起不来 → 抛错（路由回 500）而不是先把自己退出',
      threw !== null && calls.stopped === 0, String(threw))
  }

  // ── 优雅退出：emit 而不是真发信号 ────────────────────────────────────────
  {
    const calls = { signals: [], timers: [], exits: [] }
    pure.gracefulStop({
      emitSignal: signal => calls.signals.push(signal),
      exit: code => calls.exits.push(code),
      timer: (ms, run) => calls.timers.push({ ms, run }),
    })
    check('走 emit(SIGTERM)：Windows 上 process.kill 等价于 TerminateProcess，DSH 的 handler 不会跑',
      calls.signals[0] === 'SIGTERM' && calls.timers.length === 1)
    check('兜底定时器比 DSH 自己的 5 秒上限长（不抢它的优雅关停）',
      calls.timers[0].ms === pure.RESTART_STOP_FALLBACK_MS && calls.timers[0].ms > 5000)
    calls.timers[0].run()
    check('兜底到点就 exit(0)', calls.exits[0] === 0, JSON.stringify(calls.exits))

    const safe = { timers: [] }
    pure.gracefulStop({
      emitSignal: () => { throw new Error('没有 handler') },
      exit: () => {},
      timer: ms => safe.timers.push(ms),
    })
    check('emit 抛错也照常武装兜底（不能让它变成"点了没反应"）',
      safe.timers[0] === pure.RESTART_STOP_FALLBACK_MS)
    check('boot 号 = pid-时间戳（界面靠它判断新进程）', pure.bootId(7, 8) === '7-8')
  }

  // ── 接口：GET 只读展示；POST 的真路径绝不在测试里走通 ─────────────────────
  {
    const host = await bootHost()
    const route = host.routes.find(item => item.path === pure.RESTART_API_PATH)
    check('重启路由挂上了（exact）', route !== undefined && route.kind === 'exact',
      JSON.stringify(host.routes.map(r => r.path)))
    const res = makeRes()
    await route.handler(makeReq('GET'), res)
    const body = json(res)
    check('GET 回报 boot 号（界面靠"号变了"判断新进程起来了）',
      typeof body.boot === 'string' && body.boot.includes('-'), String(body.boot))
    check('GET 回报"会怎么重启"（重放命令；测试进程的 argv[1] 不是 dsh 入口 → 走裸 dsh 那条路）',
      body.ok === true && String(body.command).length > 0
      && String(body.command).includes(process.platform === 'win32' ? 'powershell.exe' : 'dsh'),
      String(body.command))
    check('GET 回报日志落点（失败时界面告诉用户去哪看）',
      String(body.logHint).includes(pure.RESTART_LOG_PREFIX), String(body.logHint))
    check('GET 回报在跑会话数，且当前没被拦',
      body.running === 0 && body.blocked === null, JSON.stringify(body))

    const wrong = makeRes()
    await route.handler(makeReq('PUT'), wrong)
    check('非 GET/POST → 405（不把 PUT 当成读状态）', wrong.captured.status === 405, String(wrong.captured.status))

    const rejectedHost = await bootHost({ connection: { requestRejection: () => 403 } })
    const rejectedRoute = rejectedHost.routes.find(item => item.path === pure.RESTART_API_PATH)
    const r1 = makeRes()
    await rejectedRoute.handler(makeReq('GET'), r1)
    check('官方 connection.requestRejection 在第一位，被拒就直接结束',
      r1.captured.status === 403 && !r1.captured.body, `${String(r1.captured.status)} ${String(r1.captured.body)}`)

    // 0.10.0 新增的三条金额路由（用量 / 价目同步 / 余额）走的是**同一个**官方信任关卡
    // （见 host.ts 的 rejectUntrustedRequest）。这里照重启路由那条的做法逐条验：
    // 被拒就结束响应，且绝不让请求走到业务逻辑（用假 webServer 就够，不需要真起会话）。
    const guardedHost = await bootHost({
      sessions: { list: () => [] },
      connection: { requestRejection: () => 403 },
    })
    const guardedReq = makeReq('GET')
    // `syncPath` 是上面那节的块内常量，这里从契约里重读一次（路径改名这条也会跟着红）。
    const guardedSyncPath = /SYNC_API_PATH = '([^']+)'/.exec(readFileSync('src/settings-contract.ts', 'utf8').replace(/\r\n/g, '\n'))?.[1]
    const rejectedOf = (path) => {
      const route = guardedHost.routes.find(item => item.path === path)
      check(`信任关卡：${path} 这条路由挂上了`, route !== undefined, JSON.stringify(guardedHost.routes.map(r => r.path)))
      return route
    }
    const usageRejected = makeRes()
    await rejectedOf(pure.USAGE_API_PATH).handler(guardedReq, usageRejected)
    check('官方信任关卡：/composer-ux/usage 也走官方信任关卡（被拒就直接结束、不读会话）',
      usageRejected.captured.status === 403 && !usageRejected.captured.body,
      `${String(usageRejected.captured.status)} ${String(usageRejected.captured.body)}`)
    const syncRejected = makeRes()
    await rejectedOf(guardedSyncPath).handler(guardedReq, syncRejected)
    check('官方信任关卡：/composer-ux/sync-prices 也走官方信任关卡（被拒就直接结束、不出网）',
      syncRejected.captured.status === 403 && !syncRejected.captured.body,
      `${String(syncRejected.captured.status)} ${String(syncRejected.captured.body)}`)
    const balanceRejected = makeRes()
    await rejectedOf(pure.BALANCE_API_PATH).handler(guardedReq, balanceRejected)
    check('官方信任关卡：/composer-ux/balance 也走官方信任关卡（被拒就直接结束、不读凭据）',
      balanceRejected.captured.status === 403 && !balanceRejected.captured.body,
      `${String(balanceRejected.captured.status)} ${String(balanceRejected.captured.body)}`)

    // 第二道关卡：本机同源。被拒的 POST **不会**走到 spawn（否则这个测试会真的重启自己）。
    const r2 = makeRes()
    await route.handler(makeReq('POST', '{}'), r2)
    check('POST 缺 Origin/Host → 403',
      r2.captured.status === 403 && json(r2).ok === false, r2.captured.body)
    const r3 = makeRes()
    await route.handler(makeReq('POST', '{}', {
      headers: { host: '127.0.0.1:3080', origin: 'http://evil.example' },
      socket: { remoteAddress: '127.0.0.1' },
    }), r3)
    check('POST 跨站 Origin → 403', r3.captured.status === 403, r3.captured.body)
    const r4 = makeRes()
    await route.handler(makeReq('POST', '{}', {
      headers: { host: '127.0.0.1:3080', origin: 'http://127.0.0.1:3080', 'x-forwarded-for': '10.0.0.1' },
      socket: { remoteAddress: '127.0.0.1' },
    }), r4)
    check('POST 带转发头 → 403', r4.captured.status === 403, r4.captured.body)
  }
}

// ══════════════ 12. 孤儿写入锁的回收（0.6.1） ═══════════════════════════════
//
// 这段逻辑会删文件，所以逐条钉住"什么情况下**不许**删"。
// 真机事故（2026-09-23）：硬杀重启留下 <profile>/package.json.lock，
// 此后整个 profile 的每一次设置写入都 2 秒超时，界面只表现为"点了没反应"。
console.log('12. 孤儿写入锁：判据与回收')
{
  const never = () => false
  const always = () => true

  const remove = pure.staleLockDecision('16684\n', never)
  check('持有者已不存在 → 回收', remove.action === 'remove' && remove.pid === 16684, JSON.stringify(remove))
  const keep = pure.staleLockDecision('45564\n', always)
  check('持有者还活着 → 保持不动', keep.action === 'keep' && keep.pid === 45564, JSON.stringify(keep))

  for (const junk of ['', '\n', 'abc', '0', '-1', '12 34', '16684\n16685\n', '0x10', '99999999999999']) {
    const decision = pure.staleLockDecision(junk, never)
    check(`认不出的锁内容一律不动（${JSON.stringify(junk)}）`,
      decision.action === 'ignore', JSON.stringify(decision))
  }

  // 真机判据：自己的进程在，已退出的子进程不在。
  check('isProcessAlive(自己) === true', pure.isProcessAlive(process.pid) === true)
  const dead = spawnSync(process.execPath, ['-e', ''], { stdio: 'ignore' })
  check('isProcessAlive(已退出的子进程) === false',
    typeof dead.pid === 'number' && pure.isProcessAlive(dead.pid) === false,
    `pid=${String(dead.pid)}`)

  check('profile 目录 = patch 的父目录',
    pure.profileDirOfPatchPath(join('C:', 'u', '.dsh', 'profiles', 'web', 'cordis.patch.yml'))
      === join('C:', 'u', '.dsh', 'profiles', 'web'),
    pure.profileDirOfPatchPath(join('C:', 'u', '.dsh', 'profiles', 'web', 'cordis.patch.yml')))

  // 真实文件系统上的四条路径。
  const dir = mkdtempSync(join(tmpdir(), 'composer-ux-lock-'))
  const lock = join(dir, pure.SETTINGS_LOCK_FILENAME)
  const notes = []
  const log = message => { notes.push(message) }

  check('没有锁 → absent', await pure.recoverStaleSettingsLock(dir, log) === 'absent')

  writeFileSync(lock, 'not-a-pid\n')
  check('内容认不出 → ignored 且不删',
    await pure.recoverStaleSettingsLock(dir, log) === 'ignored' && existsSync(lock))

  writeFileSync(lock, `${process.pid}\n`)
  check('持有者活着 → kept 且不删',
    await pure.recoverStaleSettingsLock(dir, log) === 'kept' && existsSync(lock))

  writeFileSync(lock, `${dead.pid}\n`)
  const removed = await pure.recoverStaleSettingsLock(dir, log)
  check('持有者已死 → removed 且文件消失',
    removed === 'removed' && !existsSync(lock), `${removed} exists=${String(existsSync(lock))}`)
  check('回收时留下一行可追溯的说明', notes.some(note => note.includes(String(dead.pid))), notes.join(' | '))

  rmSync(dir, { recursive: true, force: true })
}

console.log('13. 金额规则失效：写完设置的人自己通知，不靠设置变更事件（0.10.0 复查发现的真问题）')
{
  // 为什么这里是**源码级**护栏而不是行为断言：触发它的是「同步价目」那条宿主路由，
  // 而那条路会真的出网抓官方页（`fetchOfficialPages` 没有注入点，测试不该打网络）。
  // 行为面由 `test/pricing.mjs` / `test/price-sync.mjs` 覆盖，这里只钉住"接线"：
  // 一旦谁把 `invalidateMoney()` 从同步路径里删掉，这条就红。
  const host = readFileSync('src/host.ts', 'utf8').replace(/\r\n/g, '\n')
  check('模块级失效注册表 + 通知函数都在（跨 inject 作用域只能这么传）',
    host.includes('const moneyInvalidators = new Set<() => void>()')
    && host.includes('function invalidateMoney(): void {')
    && host.includes('for (const invalidate of moneyInvalidators)'))
  check('通知函数逐个 try：一个回调抛错不影响别人，也不冒泡到出网路径',
    /function invalidateMoney\(\): void \{[\s\S]{0,300}catch \(error: unknown\)/.test(host))
  const calls = host.match(/if \(saved\) invalidateMoney\(\)/g) ?? []
  check('官方价同步的两条收尾（有变化 / 无变化）写完设置都通知失效', calls.length === 2, String(calls.length))
  check('第三方价目同步写盘后也通知失效',
    /invalidateProviderPrices\(\)[\s\S]{0,220}invalidateMoney\(\)/.test(host))
  check('用量路由把失效回调登记进注册表，并在回收时摘掉（reload 不残留）',
    host.includes('moneyInvalidators.add(onMoneySettingsUpdated)')
    && host.includes('moneyInvalidators.delete(onMoneySettingsUpdated)')
    && /moneyInvalidators\.add\(onMoneySettingsUpdated\)[\s\S]{0,200}moneyInvalidators\.delete\(onMoneySettingsUpdated\)/.test(host))
  check('失效回调做三件事：重读规则 / 作废第三方价目缓存 / 作废折叠缓存',
    /const onMoneySettingsUpdated = \(\): void => \{[\s\S]{0,200}readMoneySettings\(\)[\s\S]{0,120}invalidateProviderPrices\(\)[\s\S]{0,120}usageCache\.clear\(\)/.test(host))
  check('文档里写清了"不能只靠事件"的理由（0.1.7 的事件只在 describe 里发）',
    host.includes('settings/document-updated') && host.includes('describe()'))
}

console.log('5h. 关闭档（0.14.0）：不优化就是**一次模型调用都不发生**')
{
  // 可观测证据两样：`llmCalls` 为空（假模型桩记着每次调用），且没有落台账行。
  const dir = mkdtempSync(join(tmpdir(), 'composer-ux-off-'))
  const previousHome = process.env.DSH_HOME
  process.env.DSH_HOME = dir
  try {
    const host = await bootHost({ model: { currentSelection: () => ({ provider: 'go', model: 'deepseek-flash' }) } })
    const res = makeRes()
    await handler0(host, makeReq('POST', JSON.stringify({ text: '把那个页面弄好看点', tier: 'off', sessionId: 'sess-off-1' })), res)
    const body = json(res)
    check('关闭档被挡下来（ok=false，不会假装优化过）', body.ok === false, JSON.stringify(body).slice(0, 90))
    check('错误信息说清是「关闭」并指路', /关闭/.test(String(body.error)) && /档位/.test(String(body.error)))
    check('❗一次模型调用都没发生（不花额度）', host.llmCalls.length === 0, String(host.llmCalls.length))
    check('❗没有落台账（这轮根本没跑）', !existsSync(join(dir, 'composer-ux', 'optimize-log.jsonl')))
  } finally {
    if (previousHome === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = previousHome
  }
}

console.log('5i. 上游六类本体（0.14.0 S3a）：必填字段与装配')
{
  const original = '帮我做个坦克模型，要真实帅气，单个 html 文件。'
  const parse = rows => pure.parseOptimizeOutput(JSON.stringify({ items: rows }), original)

  // user_requirement：必须有逐字引文（上游硬规则 1）
  const reqNoQuote = parse([{ kind: 'user_requirement', text: '要单个 html 文件' }])
  check('user_requirement 缺 quote ⇒ 只丢这一条',
    reqNoQuote.items.length === 0 && reqNoQuote.dropped.length === 1 && /quote/.test(reqNoQuote.dropped[0].reason))
  const reqBadQuote = parse([{ kind: 'user_requirement', text: '要单个 html 文件', quote: '这句话不在原话里' }])
  check('user_requirement 引文不是逐字 ⇒ 丢掉', reqBadQuote.items.length === 0 && reqBadQuote.dropped.length === 1)
  const reqOk = parse([{ kind: 'user_requirement', text: '要单个 html 文件', quote: '单个 html 文件' }])
  check('user_requirement 引文逐字 ⇒ 收下', reqOk.items.length === 1 && reqOk.items[0].kind === 'user_requirement')

  // quality_interpretation：必须有 rationale（上游硬规则 2）
  const qiNo = parse([{ kind: 'quality_interpretation', text: '视觉上要像照片' }])
  check('quality_interpretation 缺 rationale ⇒ 丢掉', qiNo.items.length === 0 && /rationale/.test(qiNo.dropped[0].reason))
  const qiOk = parse([{ kind: 'quality_interpretation', text: '视觉上要像照片', rationale: '真实、帅气' }])
  check('quality_interpretation 给了 rationale ⇒ 收下并保留它',
    qiOk.items.length === 1 && qiOk.items[0].rationale === '真实、帅气')

  // observed_fact：必须有 sourceRefs（上游硬规则 5：只列过目录不算）
  const ofNo = parse([{ kind: 'observed_fact', text: '项目里用的是 Vite' }])
  check('observed_fact 缺 sourceRefs ⇒ 丢掉', ofNo.items.length === 0 && /sourceRefs/.test(ofNo.dropped[0].reason))
  const ofOk = parse([{ kind: 'observed_fact', text: '项目里用的是 Vite', sourceRefs: ['package.json'] }])
  check('observed_fact 有来源 ⇒ 收下', ofOk.items.length === 1 && ofOk.items[0].sourceRefs[0] === 'package.json')

  // implementation_option / proposal：不需要引文（它们**不是**用户要求）
  const soft = parse([
    { kind: 'implementation_option', text: '默认用浅色主题，可逆' },
    { kind: 'proposal', text: '也可以顺手加个导出按钮' },
  ])
  check('可逆细节与建议不需要引文就不被丢', soft.items.length === 2 && soft.dropped.length === 0)

  // unknown 的候选：只允许 user_preference，最多 3 个
  const cand = parse([{
    kind: 'unknown', unknownClass: 'user_preference', blocksAction: true, text: '「真实」指渲染还是材质？',
    candidates: [{ id: 'a', text: '按 A 读', impact: '做成 A' }, { id: 'b', text: '按 B 读' }, { id: 'c', text: 'C' }, { id: 'd', text: 'D' }],
  }])
  check('候选最多保留 3 个（多的忽略并记账）',
    cand.items.length === 1 && cand.items[0].candidates.length === 3
    && cand.warnings.some(w => /候选超过/.test(w)))
  const candWrong = parse([{
    kind: 'user_requirement', text: '要单个 html 文件', quote: '单个 html 文件',
    candidates: [{ id: 'a', text: '不该有' }],
  }])
  check('候选给在非 unknown 上 ⇒ 忽略并记警告（不冒充授权）',
    candWrong.items.length === 1 && (candWrong.items[0].candidates ?? []).length === 0
    && candWrong.warnings.some(w => /user_preference/.test(w)))

  // 装配：上游本体**不改写原话**，只把辅助小节追加在后面
  const assembled = pure.assembleCommand(original, [...reqOk.items, ...qiOk.items, ...soft.items], { tier: 'heavy' })
  check('❗原话在成品里**逐字**保留（上游最硬的一条：不改写）',
    assembled.text.startsWith(original), assembled.text.slice(0, 40))
  check('成品里带上了辅助小节',
    assembled.text.includes('【你要的') && assembled.text.includes('【对质量词的理解】')
    && assembled.text.includes('【可逆的实现选择') && assembled.text.includes('【建议'))
  check('质量解读把小节里带上 rationale（指回原话字眼）', assembled.text.includes('真实、帅气'))
}

console.log('5j. 模型选择与协作基调（0.14.0 S4）：设置真的生效')
{
  // 模型选择：设置里写 `provider/model` ⇒ 这一轮走它，而不是会话当前选的模型。
  const host = await bootHost({
    settings: { optimizerModel: 'other/some-model' },
    model: { currentSelection: () => ({ provider: 'go', model: 'deepseek-flash' }) },
  })
  const res = makeRes()
  await handler0(host, makeReq('POST', JSON.stringify({ text: '把那个页面弄好看点', tier: 'standard' })), res)
  check('设置里的模型生效（provider/model 拆开用）',
    json(res).provider === 'other' && json(res).model === 'some-model', JSON.stringify({ p: json(res).provider, m: json(res).model }))

  // 只写模型名 ⇒ 沿用会话的 provider（既精确指定，也只换模型不换厂商）
  const host2 = await bootHost({
    settings: { optimizerModel: 'another-model' },
    model: { currentSelection: () => ({ provider: 'go', model: 'deepseek-flash' }) },
  })
  await handler0(host2, makeReq('POST', JSON.stringify({ text: '把那个页面弄好看点', tier: 'standard' })), makeRes())
  check('只写模型名时沿用会话 provider',
    host2.llmCalls[0].model === 'another-model', String(host2.llmCalls[0].model))

  // 协作基调：设置成 hard ⇒ 系统提示词里出现「硬邦邦模式」段；默认不出现。
  const hard = await bootHost({
    settings: { optimizerFraming: 'hard' },
    model: { currentSelection: () => ({ provider: 'go', model: 'deepseek-flash' }) },
  })
  await handler0(hard, makeReq('POST', JSON.stringify({ text: '把那个页面弄好看点', tier: 'standard' })), makeRes())
  check('基调=硬邦邦 ⇒ 系统提示词里有那一段',
    hard.llmCalls[0].system.includes('硬邦邦模式 · 整份辅助包的写法'))
  check('默认（普通）⇒ 没有那一段', host.llmCalls[0].system.includes('硬邦邦模式') === false)
}

console.log('5k. 内置 Bash 的开关（0.14.0 S5）：关着时模型**看不到**这个工具')
{
  // 关（默认）：工具表里没有 bash；也不追加那一段边界说明。
  const bashDir = mkdtempSync(join(tmpdir(), 'composer-ux-bash-switch-'))
  const bashQuery = { readSession: async () => ({ header: { cwd: bashDir } }) }
  const bashFinal = JSON.stringify({ items: [{ kind: 'user_requirement', quote: '弄好看点', text: '把这一页做得好看点' }] })
  const off = await bootHost({
    settings: { optimizeReadTools: true },
    sessionQuery: bashQuery,
    model: { currentSelection: () => ({ provider: 'go', model: 'deepseek-flash' }) },
    chunksSeq: [[{ type: 'text-delta', index: 0, text: bashFinal }, { type: 'finish', reason: { kind: 'stop' } }]],
  })
  await handler0(off, makeReq('POST', JSON.stringify({ text: '把那个页面弄好看点', tier: 'standard', sessionId: 'sess-bash-off' })), makeRes())
  const offTools = (off.llmCalls[0].tools ?? []).map(tool => tool.name)
  check('关着时工具表里没有 bash（不是软拦截）',
    offTools.includes('read') && offTools.includes('bash') === false, JSON.stringify(offTools))
  check('关着时系统提示词里也没有 bash 那段',
    off.llmCalls[0].system.includes('关于 bash 工具') === false)

  // 开：工具表里有 bash，并追加边界说明。
  const on = await bootHost({
    settings: { optimizeReadTools: true, optimizeBash: true },
    sessionQuery: bashQuery,
    model: { currentSelection: () => ({ provider: 'go', model: 'deepseek-flash' }) },
    chunksSeq: [[{ type: 'text-delta', index: 0, text: bashFinal }, { type: 'finish', reason: { kind: 'stop' } }]],
  })
  await handler0(on, makeReq('POST', JSON.stringify({ text: '把那个页面弄好看点', tier: 'standard', sessionId: 'sess-bash-on' })), makeRes())
  const onTools = (on.llmCalls[0].tools ?? []).map(tool => tool.name)
  check('开着时 bash 才挂给模型', onTools.includes('bash'), JSON.stringify(onTools))
  check('开着时系统提示词里有边界说明（只在工作目录/不写文件）',
    on.llmCalls[0].system.includes('关于 bash 工具') && on.llmCalls[0].system.includes('不要写文件'))
}

console.log('5l. 上下文「回合 0–10 / 全文」（0.14.0 S6）：设置真的改变发出去的内容')
{
  // 造 8 轮往来：第 i 轮的原话里带一个可识别记号 R<i>。
  const events = []
  for (let i = 1; i <= 8; i += 1) {
    events.push({ type: 'user/message', data: { id: `u${String(i)}`, role: 'user', content: [{ type: 'text', text: `第 ${String(i)} 轮原话 R${String(i)}` }], source: { kind: 'user' } } })
    events.push({ type: 'assistant/message', data: { message: { id: `a${String(i)}`, role: 'assistant', content: [{ type: 'text', text: `第 ${String(i)} 轮回复` }] } } })
  }
  const snapshot = { events }
  const query = { readSession: async () => snapshot }
  const selection = { currentSelection: () => ({ provider: 'go', model: 'deepseek-flash' }) }
  const draft = '把那个页面弄好看点'
  const sent = async (extraSettings) => {
    const host = await bootHost({ model: selection, sessionQuery: query, settings: extraSettings })
    await handler0(host, makeReq('POST', JSON.stringify({ text: draft, tier: 'standard', sessionId: 's-ctx' })), makeRes())
    return String(host.llmCalls[0].messages[0].content[0].text)
  }

  const byDefault = await sent({})
  check('默认：带最近几轮（出现会话上下文块）', byDefault.includes('会话上下文'))

  // 回合 = 2：只带最后两轮（R8 在、R1 不在）
  const two = await sent({ optimizerHistory: 'turns', optimizerTurns: 2 })
  check('回合=2 ⇒ 只带最后两轮', two.includes('R8') && two.includes('R1') === false)

  // 回合 = 0：干脆不带上下文
  const zero = await sent({ optimizerHistory: 'turns', optimizerTurns: 0 })
  check('回合=0 ⇒ 不带上下文（用户明确说不要）',
    zero.includes('会话上下文') === false && zero.includes('R8') === false)

  // 全文：连最早的 R1 也带上
  const full = await sent({ optimizerHistory: 'full' })
  check('全文 ⇒ 最早的几轮也带上', full.includes('R1') && full.includes('R8'))
}

console.log('5m. 模型清单路由（0.14.1）：按 provider 分组、单点失败不废整份、有缓存')
{
  const host = await bootHost({
    listProviders: () => [
      { id: 'go', name: 'go' },
      { id: 'deepseek-official', name: 'DeepSeek 官方' },
      { id: 'broken', name: '坏的' },
    ],
    listModels: async (provider) => {
      if (provider === 'broken') throw new Error('端点没响应')
      if (provider === 'go') return [{ id: 'deepseek-flash', name: 'DeepSeek V4 Flash' }]
      return [{ id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro' }, { id: 'x', name: 'x' }]
    },
    model: { currentSelection: () => ({ provider: 'go', model: 'deepseek-flash' }) },
  })
  const route = host.routes.find(entry => entry.path === pure.MODELS_API_PATH)
  check('模型清单路由注册了', route !== undefined)

  const call = async (url) => {
    const req = { method: 'GET', url }
    let payload = null
    const res = { writeHead: () => {}, end: (body) => { payload = JSON.parse(body) } }
    await route.handler(req, res)
    return payload
  }

  const body = await call(pure.MODELS_API_PATH)
  check('返回按 provider 分组的三组', body.ok === true && body.groups.length === 3, JSON.stringify(body.groups?.map(g => g.id)))
  check('组里带模型（id + 名字）',
    body.groups[0].models.length === 1 && body.groups[0].models[0].name === 'DeepSeek V4 Flash')
  check('provider 的中文名照搬（图 1 那种分组标题）', body.groups[1].name === 'DeepSeek 官方')
  check('❗单个 provider 读不到 ⇒ 只有那一组带原因，其余照常',
    body.groups[2].models.length === 0 && /端点没响应/.test(body.groups[2].error)
    && body.groups[0].models.length === 1, JSON.stringify(body.groups))
  check('带上会话当前选的那条 route（下拉里给"跟随会话"显示）',
    body.current.provider === 'go' && body.current.model === 'deepseek-flash')

  // 缓存：60 秒内第二次不再问 provider（?fresh=1 才绕过）
  let asked = 0
  const cached = await bootHost({
    listProviders: () => [{ id: 'go', name: 'go' }],
    listModels: async () => { asked += 1; return [{ id: 'm', name: 'M' }] },
  })
  const cachedRoute = cached.routes.find(entry => entry.path === pure.MODELS_API_PATH)
  const callCached = async (url) => {
    let payload = null
    await cachedRoute.handler({ method: 'GET', url }, { writeHead: () => {}, end: (b) => { payload = JSON.parse(b) } })
    return payload
  }
  await callCached(pure.MODELS_API_PATH)
  await callCached(pure.MODELS_API_PATH)
  check('60 秒缓存：第二次不再问 provider', asked === 1, String(asked))
  await callCached(`${pure.MODELS_API_PATH}?fresh=1`)
  check('?fresh=1 绕过缓存', asked === 2, String(asked))

  // 方法不对 ⇒ 405（只读路由不收 POST）
  let code = 0
  await cachedRoute.handler({ method: 'POST', url: pure.MODELS_API_PATH }, { writeHead: (c) => { code = c }, end: () => {} })
  check('非 GET ⇒ 405', code === 405, String(code))
}

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
