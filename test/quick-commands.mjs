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
    pure.DEFAULT_SETTINGS.optimizerPromptBasic === '' && pure.DEFAULT_SETTINGS.optimizerPromptAdvanced === ''
    && pure.DEFAULT_SETTINGS.optimizerPromptExtreme === '')
  const kept = pure.sanitizeSettings({ optimizerPromptExtreme: 'x'.repeat(5000) })
  check('自定义提示词原样保留（够长也不截）', kept.optimizerPromptExtreme.length === 5000, String(kept.optimizerPromptExtreme.length))
  const clipped = pure.sanitizeSettings({ optimizerPromptBasic: 'x'.repeat(pure.OPTIMIZER_PROMPT_MAX + 100) })
  check("超上限被截断（不整份丢掉：这是用户自己敲的内容）", clipped.optimizerPromptBasic.length === pure.OPTIMIZER_PROMPT_MAX, String(clipped.optimizerPromptBasic.length))
  check('字段名映射（未知档回落默认档）',
    pure.optimizerPromptFieldOf('basic') === 'optimizerPromptBasic'
    && pure.optimizerPromptFieldOf('extreme') === 'optimizerPromptExtreme'
    && pure.optimizerPromptFieldOf('???') === pure.OPTIMIZER_PROMPT_FIELDS.advanced)
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
  check('未知档位回落到高级', clean.optimizerTier === 'advanced', clean.optimizerTier)
  check('合法档位原样保留', pure.sanitizeSettings({ optimizerTier: 'extreme' }).optimizerTier === 'extreme')
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
    pure.sanitizeSettings({ optimizerTier: 'extreme' }).quickEnabled === true)

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
    optimizerTier: 'advanced',
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
  check('总开关关掉 → 六栏全不生效（哪怕栏开关是开的）',
    Object.values(pure.activeSections({ ...pure.DEFAULT_SETTINGS, enabled: false, keysEnabled: true, headerEnabled: true }))
      .every(value => value === false))
  check('总开关开着 + 栏开 → 生效', pure.activeSections({ ...pure.DEFAULT_SETTINGS, keysEnabled: true }).keys === true)
  check('activeSections 用本栏自己的 headerEnabled，没有第二个请求头开关',
    pure.activeSections({ ...pure.DEFAULT_SETTINGS, headerEnabled: true }).header === true)
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

// ══════════════ 4. 提示词资产（0.6 线机制：条目 + 逐字依据） ══════════════════
console.log('4. 优化提示词：三档、依据纪律与输出契约')
{
  const advanced = pure.buildOptimizeSystem('advanced')
  check('三档齐全', Object.keys(pure.OPTIMIZER_SPECS).join(',') === 'basic,advanced,extreme')
  check('人设段在（传话器）', advanced.includes('传话器/意图补全器'))
  check('依据纪律段在（要求逐字引文）', advanced.includes('依据纪律') && advanced.includes('逐字存在'))
  check('禁元话语段在', advanced.includes('不要元话语'))
  check('高级档要求补全没说出口的必要要求', advanced.includes('没说出口'))
  check('普通档只修语言、不添需求', pure.buildOptimizeSystem('basic').includes('只做语言层修复'))
  check('极端档要求分阶段计划与预案', pure.buildOptimizeSystem('extreme').includes('多情况预案'))
  check('未知档位回落到高级', pure.buildOptimizeSystem('???') === advanced)
  check('温度：普通 0.2', pure.buildOptimizeTemperature('basic') === 0.2)
  check('温度：高级 0.3', pure.buildOptimizeTemperature('advanced') === 0.3)
  check('温度：未知回落高级', pure.buildOptimizeTemperature('???') === 0.3)
  // 输出契约必须**永远在最后**（模型对最后一条指令服从度最高），且不可能被自定义提示词顶掉。
  check('输出契约在末尾', advanced.endsWith(pure.OPTIMIZER_OUTPUT_CONTRACT))
  check('契约里给出 items/kind 的取值', advanced.includes('"items"') && advanced.includes('rewrite'))
  check('自定义提示词整体替换任务段，契约仍追加',
    pure.buildOptimizeSystem('advanced', '我的任务段').startsWith('我的任务段')
    && pure.buildOptimizeSystem('advanced', '我的任务段').includes(pure.OPTIMIZER_OUTPUT_CONTRACT))
  check('空白的自定义提示词 = 用内置', pure.buildOptimizeSystem('advanced', '   ') === advanced)
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
      { kind: 'rewrite', quote: '弄好看点', text: '做得更好看' },
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
  const opsJson = JSON.stringify({ ops: [{ op: 'add_item', item: { kind: 'rewrite', quote: '弄好看点', text: '更精致' } }, { op: 'set_item_status', id: 'x', status: 'superseded' }] })
  const opsParsed = pure.parseOptimizeOutput(opsJson, original)
  check('认得 ops[].item 形态', opsParsed.ok === true && opsParsed.items.length === 1)
  check('不支持的 op 如实记账', opsParsed.warnings.some(w => w.includes('add_item')))

  // ── 装配：原话为骨架
  const assembled = pure.assembleCommand(original, parsed.items, { tier: 'advanced' })
  check('rewrite 按位置回填，未被覆盖的原文原样保留',
    assembled.text.startsWith('把那个页面做得更好看，动画也加上'), assembled.text)
  check('补全要求带逐字依据',
    assembled.text.includes('【补全要求') && assembled.text.includes('（依据："动画也加上"）'))
  check('成品在预算内', assembled.chars <= assembled.budget, `${String(assembled.chars)}/${String(assembled.budget)}`)
  check('记账：被改写的原话字符数', assembled.rewrittenChars === '弄好看点'.length)
  check('记账：进入成品的条目数', assembled.itemCount === 2)

  // ── 同一段原话被两条 rewrite 引用 → 只留一条（回填顺序才可解释）
  const dup = pure.parseOptimizeOutput(JSON.stringify({
    items: [
      { kind: 'rewrite', quote: '弄好看点', text: '甲' },
      { kind: 'rewrite', quote: '弄好看点', text: '乙' },
    ],
  }), original)
  check('重复引用同一段原话 → 第二条被丢',
    dup.items.length === 1 && dup.dropped.some(d => d.reason.includes('同一段原话')))

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
    pure.optimizeBudgetFor('basic', 10) === 400 && pure.optimizeBudgetFor('basic', 1_000) === 1_400,
    JSON.stringify([pure.optimizeBudgetFor('basic', 10), pure.optimizeBudgetFor('basic', 1_000)]))
  check('advanced 预算比 basic 宽', pure.optimizeBudgetFor('advanced', 100) > pure.optimizeBudgetFor('basic', 100))
  check('预算有绝对上限（不随档位无限涨）',
    pure.optimizeBudgetFor('extreme', 1_000_000) <= 12_000)
  // 档位门：普通档不该出现 requirement / quality / plan / risk（提示词是请求，这里是保证）
  check('档位允许的条目种类',
    pure.allowedKindsFor('basic').join(',') === 'rewrite,unknown'
    && pure.allowedKindsFor('advanced').includes('requirement')
    && pure.allowedKindsFor('advanced').includes('plan') === false
    && pure.allowedKindsFor('extreme').includes('risk')
    && pure.allowedKindsFor('???').join(',') === pure.allowedKindsFor('advanced').join(','))
  const tierGated = pure.assembleCommand(original, parsed.items, { tier: 'basic' })
  check('普通档即使拿到 requirement 也不渲染（档位承诺由宿主保证）',
    !tierGated.text.includes('【补全要求')
    && tierGated.dropped.some(d => d.reason.includes('当前档位')))
  const bulky = pure.assembleCommand(original, [
    { id: 'u1', kind: 'unknown', text: 'u'.repeat(400), unknownClass: 'lookupable_fact', quoteSource: 'none' },
    { id: 'u2', kind: 'unknown', text: 'v'.repeat(400), unknownClass: 'lookupable_fact', quoteSource: 'none' },
    { id: 'r1', kind: 'risk', text: 'r'.repeat(400) },
    { id: 'r2', kind: 'risk', text: 'q'.repeat(400) },
  ], { tier: 'extreme' })
  check('超预算时按固定顺序丢可选的节（risk 先于 unknown）',
    bulky.dropped.length > 0
    && bulky.dropped.every(d => d.kind === 'risk' && d.reason.includes('budget'))
    && !bulky.dropped.some(d => d.kind === 'unknown'))
  check('还没被丢的节照常渲染', bulky.text.includes('【不明确处'))
  check('降级写明省略了几条', bulky.text.includes('因篇幅预算省略'))
  check('预算警告进了 warnings', bulky.warnings.some(w => w.includes('篇幅预算')))

  // ── 兜底口径：新机制永不比旧行为更差
  const fb = pure.runOptimizePipeline('优化后的指令', original, { tier: 'advanced' })
  check('模型没给 JSON → 按旧行为整段照收（fallback）',
    fb.ok === true && fb.fallback === true && fb.text === '优化后的指令')
  const broken = pure.runOptimizePipeline('{"items":[', original, { tier: 'advanced' })
  check('半截 JSON → 失败，绝不把坏 JSON 写进输入框',
    broken.ok === false && broken.code === 'BAD_JSON')
  const shape = pure.runOptimizePipeline('{"items":"not-an-array"}', original, { tier: 'advanced' })
  check('有 items 键但类型不对 → 也判失败', shape.ok === false && shape.code === 'BAD_SHAPE')
  const other = pure.runOptimizePipeline('把这段配置写进 config.json：\n\n{"port":8080}', original, { tier: 'advanced' })
  check('旧式自由文本里夹着 JSON → 仍走兜底照收（不误判成信封）',
    other.ok === true && other.fallback === true)
  const braceOnly = pure.runOptimizePipeline('{"port":8080}', original, { tier: 'advanced' })
  check('整段就是一个不相干的 JSON 对象 → 也走兜底，不当成信封写坏',
    braceOnly.ok === true && braceOnly.fallback === true)
  const empty = pure.runOptimizePipeline('{"items":[]}', original, { tier: 'advanced' })
  check('空数组 → 原话原样写回（每一轮必有成品）', empty.ok === true && empty.text === original)
  const viaPipeline = pure.runOptimizePipeline(json, original, { tier: 'advanced' })
  check('整条流水线：解析→核对→装配一次跑通',
    viaPipeline.ok === true && viaPipeline.fallback === false
    && viaPipeline.text.startsWith('把那个页面做得更好看') && viaPipeline.dropped.length === 3)
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
          { kind: 'rewrite', quote: '把那个页面弄好看点', text: '把设置页做得好看点' },
          { kind: 'requirement', quote: '弄好看点', text: '改完页面能正常打开' },
        ],
      }),
    },
    { type: 'finish', reason: { kind: 'stop' } },
  ]
  let callIndex = 0
  const llm = {
    stream: (callOptions) => {
      llmCalls.push(callOptions)
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
    ...(options.connection === undefined ? {} : { connection: options.connection }),
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
 * 宿主半现在注册三条 exact 路由（提示词优化 + 快捷指令存储 + 终端状态），
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
  check('注册了四条 exact 路由（优化 + 快捷指令存储 + 终端状态 + 重启）',
    host.routes.length === 4
    && host.routes.every(route => route.kind === 'exact')
    && [pure.OPTIMIZER_API_PATH, pure.QUICK_PROMPTS_API_PATH, pure.TERMINAL_API_PATH, pure.RESTART_API_PATH]
      .every(path => host.routes.some(route => route.path === path)),
    JSON.stringify(host.routes.map(route => `${route.path}:${route.kind}`)))
  check('优化路由路径与客户端约定一致', optimizerRoute(host)?.path === pure.OPTIMIZER_API_PATH, optimizerRoute(host)?.path)
  check('存储路由路径与客户端约定一致', storeRoute(host)?.path === pure.QUICK_PROMPTS_API_PATH, storeRoute(host)?.path)

  const handler = optimizerRoute(host).handler
  const res = makeRes()
  await handler(makeReq('POST', JSON.stringify({ text: '把那个页面弄好看点', tier: 'advanced' })), res)
  const body = json(res)
  check('HTTP 200', res.captured.status === 200, String(res.captured.status))
  check('按条目装配：rewrite 回填原话', body.ok === true && body.text.startsWith('把设置页做得好看点'), JSON.stringify(body.text))
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
  check('system 是高级档提示词', call.system.includes('没说出口'))
  check('system 末尾是固定的输出契约', call.system.endsWith(pure.OPTIMIZER_OUTPUT_CONTRACT))
  check('user 消息包了传话框架', call.messages[0].content[0].text.includes('【待转达内容】'))
  check('消息来源标为 user', call.messages[0].source.kind === 'user')
}
{
  // 自定义提示词（设置页里那份）必须真的被用上，且契约仍然追加在末尾。
  const host = await bootHost({
    model: { currentSelection: () => ({ provider: 'go', model: 'm' }) },
    settings: { optimizerPromptAdvanced: '我的自定义任务段' },
  })
  const res = makeRes()
  await handler0(host, makeReq('POST', JSON.stringify({ text: '把那个页面弄好看点', tier: 'advanced' })), res)
  check('用了设置里的自定义提示词', host.llmCalls[0].system.startsWith('我的自定义任务段'))
  check('自定义提示词不顶掉输出契约', host.llmCalls[0].system.endsWith(pure.OPTIMIZER_OUTPUT_CONTRACT))
  check('回报 promptSource=custom', json(res).promptSource === 'custom', JSON.stringify(json(res).promptSource))
}
{
  // DSH 0.1.7 那一代没有 `settings.get`：自定义提示词必须能从 describe() 里读到。
  const host = await bootHost({
    model: { currentSelection: () => ({ provider: 'go', model: 'm' }) },
    modernSettings: true,
    settings: { optimizerPromptExtreme: '一代新版用的任务段' },
  })
  const res = makeRes()
  await handler0(host, makeReq('POST', JSON.stringify({ text: '把那个页面弄好看点', tier: 'extreme' })), res)
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
  await handler0(host, makeReq('POST', JSON.stringify({ text: '把那个页面弄好看点', tier: 'advanced' })), res)
  const body = json(res)
  check('读设置抛异常 → 回落内置提示词，优化照常成功',
    body.ok === true && body.promptSource === 'builtin'
    && host.llmCalls[0].system.includes('没说出口'), JSON.stringify({ ok: body.ok, src: body.promptSource }))
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
      { type: 'text-delta', index: 0, text: '{"items":[{"kind":"rewrite",' },
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
        { type: 'text-delta', index: 0, text: JSON.stringify({ items: [{ kind: 'rewrite', quote: '原文', text: '改过的原文' }] }) },
        { type: 'finish', reason: { kind: 'stop' } },
      ],
    ],
  })
  const res = makeRes()
  await handler0(host, makeReq('POST', JSON.stringify({ text: '原文' })), res)
  const body = json(res)
  check('空产出重试一次后成功', body.ok === true && body.retried === true && body.text === '改过的原文', JSON.stringify(body))
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
            { kind: 'rewrite', quote: '原文', text: '改过的原文' },
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
  check('其余条目照常成成品', body.itemCount === 1 && body.text === '改过的原文')
}
{
  const host = await bootHost({ model: { currentSelection: () => ({ provider: 'go', model: 'm' }) } })
  const handler = optimizerRoute(host).handler
  const res = makeRes()
  await handler(makeReq('POST', JSON.stringify({ text: 'x', tier: 'basic' })), res)
  check('basic 档温度 0.2', host.llmCalls[0].temperature === 0.2)
  check('basic 档 system 正确', host.llmCalls[0].system.includes('只做语言层修复'))
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
  check('旧文档 → 档位回落高级', fresh.optimizerTier === 'advanced', fresh.optimizerTier)
  check('旧文档 → 三档自定义提示词回落空串（= 内置）',
    fresh.optimizerPromptBasic === '' && fresh.optimizerPromptAdvanced === '' && fresh.optimizerPromptExtreme === '',
    JSON.stringify([fresh.optimizerPromptBasic, fresh.optimizerPromptAdvanced, fresh.optimizerPromptExtreme]))
  check('自定义提示词能透过 schema 原样回来',
    plain(schema({ optimizerPromptAdvanced: '我的任务段' })).optimizerPromptAdvanced === '我的任务段')
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
  const SOURCE = readFileSync('src/client/PanelResizeHandles.tsx', 'utf8')

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
  const PANEL_SRC = readFileSync('src/client/panel.ts', 'utf8')
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
  check('cwd 取入口所在目录（源码启动的 --import tsx/esm 才解析得到）',
    winLaunch.cwd === 'D:\\DeepSeek Harness\\apps\\cli\\lib', winLaunch.cwd)
  check('execArgv 排在入口之前',
    pure.launchCommand(facts({ execArgv: ['--import', 'tsx/esm'] })).args.join('|')
      === '--import|tsx/esm|D:\\DeepSeek Harness\\apps\\cli\\lib\\bin.js|web')
  check('相对入口先 resolve 成绝对（否则子进程按自己的 cwd 找 → MODULE_NOT_FOUND）',
    pure.launchCommand(facts({ argv1: 'apps/cli/lib/bin.js', resolve: p => 'D:\\DSH\\' + p }))
      .args.includes('D:\\DSH\\apps/cli/lib/bin.js'))
  const bare = pure.launchCommand(facts({ argv1: 'D:\\tools\\other.js' }))
  check('入口不像 dsh → 退回裸 dsh', bare.file === 'dsh' && bare.args.join('|') === 'web', JSON.stringify(bare))
  check('裸 dsh 在 Windows 上必须过 shell（它是 .cmd shim）', bare.viaShell === true)
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
  check('裸 dsh 在 Windows 上补成 dsh.cmd（PowerShell 会优先选被策略拒绝的 .ps1）',
    pure.respawnCommand(bare, 'win32').args[4].startsWith("& 'dsh.cmd'"))
  check('已经是 .cmd 就不重复补',
    pure.respawnCommand({ ...bare, file: 'dsh.cmd' }, 'win32').args[4].startsWith("& 'dsh.cmd'"))
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
    ['forwarded', 'x-forwarded-for', 'x-real-ip'].every(name =>
      pure.trustedRestartRequest(trust({ headers: { ...trust().headers, [name]: 'x' } })) === false))
  check('缺 Origin 或 Host → 拒',
    pure.trustedRestartRequest(trust({ headers: { host: '127.0.0.1:3080' } })) === false
    && pure.trustedRestartRequest(trust({ headers: { origin: 'http://127.0.0.1:3080' } })) === false)
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
      const errText = () => (fsMod.existsSync(err) ? fsMod.readFileSync(err, 'utf8') : '')
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
        && fsMod.readFileSync(errPath, 'utf8').includes('could not start the replacement'),
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

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
