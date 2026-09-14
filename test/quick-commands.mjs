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
import { mkdirSync } from 'node:fs'
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

// ── 现场打包纯函数出口 ──────────────────────────────────────────────────────
mkdirSync(new URL('./.build/', import.meta.url), { recursive: true })
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

// ══════════════ 2. 「默认插入」的末尾拼接语义 ═══════════════════════════════
console.log('2. 默认插入：发送时拼到消息末尾')
{
  const list = [
    { id: '1', label: '甲', prompt: '第一条', always: true },
    { id: '2', label: '乙', prompt: '第二条', always: false },
    { id: '3', label: '丙', prompt: '第三条', always: true },
  ]
  const next = pure.withAlwaysPrompts('我的问题', list)
  check('原文在前、勾选的按列表顺序在后', next === '我的问题\n\n第一条\n\n第三条', JSON.stringify(next))
  check('未勾选的不参与', next.includes('第二条') === false)
}
{
  const list = [{ id: '1', label: '甲', prompt: '甲', always: true }]
  check('一条都没勾 → 不附加', pure.withAlwaysPrompts('原文', [{ ...list[0], always: false }]) === null)
  check('原文为空 → 不附加（交还官方原语义）', pure.withAlwaysPrompts('', list) === null)
  check('只有空白 → 不附加', pure.withAlwaysPrompts('   \n  ', list) === null)
  check('原文尾部空白被规整', pure.withAlwaysPrompts('原文   \n\n', list) === '原文\n\n甲')
  check('勾了但正文为空 → 不附加', pure.withAlwaysPrompts('原文', [{ id: '1', label: '甲', prompt: '  ', always: true }]) === null)
}
{
  const list = [
    { id: '1', label: '甲', prompt: '甲', always: true },
    { id: '2', label: '乙', prompt: '  ', always: true },
    { id: '3', label: '丙', prompt: '丙', always: true },
  ]
  check('勾选区里的空正文被跳过、其余仍拼接', pure.withAlwaysPrompts('原文', list) === '原文\n\n甲\n\n丙')
}
{
  // 幂等护栏：这是「一直点一直插入」那个 bug 的兜底。
  // 若发送那一步没成，第二次点击不能再叠一遍，而应放行官方发送。
  const list = [{ id: '1', label: '甲', prompt: '甲', always: true }]
  const once = pure.withAlwaysPrompts('原文', list)
  check('第一次正常附加', once === '原文\n\n甲')
  check('已以同一后缀结尾 → 不再附加（幂等）', pure.withAlwaysPrompts(once, list) === null)
  check('尾部有空白也算已附加', pure.withAlwaysPrompts(`${once}   \n`, list) === null)
  check('中间出现同样文字不算已附加', pure.withAlwaysPrompts('甲\n\n原文', list) === '甲\n\n原文\n\n甲')
  check('后缀相同但前面还有别的话 → 仍不再叠（结尾匹配）',
    pure.withAlwaysPrompts('别的\n\n原文\n\n甲', list) === null)
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

// ══════════════ 4. 提示词资产（提取自 WestFox 的插件） ══════════════════════
console.log('4. 优化提示词：三档与传话包装')
{
  const advanced = pure.buildOptimizeSystem('advanced')
  check('三档齐全', Object.keys(pure.OPTIMIZER_SPECS).join(',') === 'basic,advanced,extreme')
  check('人设段在（传话器）', advanced.includes('传话器/改写器'))
  check('禁元话语段在', advanced.includes('绝对禁止'))
  check('高级档要求补全没说出口的必要要求', advanced.includes('没说出口'))
  check('普通档只修语言、不添需求', pure.buildOptimizeSystem('basic').includes('只做语言层修复'))
  check('极端档要求分阶段计划与预案', pure.buildOptimizeSystem('extreme').includes('多情况预案'))
  check('未知档位回落到高级', pure.buildOptimizeSystem('???') === advanced)
  check('温度：普通 0.2', pure.buildOptimizeTemperature('basic') === 0.2)
  check('温度：高级 0.3', pure.buildOptimizeTemperature('advanced') === 0.3)
  check('温度：未知回落高级', pure.buildOptimizeTemperature('???') === 0.3)
  const user = pure.buildOptimizeUser('把那个页面弄好看点')
  check('用户消息包成「待转达内容」', user.includes('【待转达内容】') && user.includes('<原文>'))
  check('原文原样在内', user.includes('把那个页面弄好看点'))
  check('明确要求只输出命令本身', user.includes('只输出这条命令本身'))
}

// ══════════════ 5. 宿主半的优化接口 ═════════════════════════════════════════
console.log('5. 宿主半优化接口（假的 webServer + llm）')

/** 造一个假的宿主 ctx，并返回捕获到的路由与 llm 调用。 */
async function bootHost(options = {}) {
  const routes = []
  const llmCalls = []
  let schema = null
  const settingsState = { 'composer-ux': { enabled: true } }
  const settings = {
    get: ns => settingsState[ns],
    // 捕获宿主半真实注册的那一个 schema —— 它的默认值决定旧设置文档读出来是什么。
    register: (_ns, registered) => { schema = registered },
    mutate: async () => {},
  }
  const llm = {
    stream: (callOptions) => {
      llmCalls.push(callOptions)
      const chunks = options.chunks ?? [
        { type: 'text-delta', index: 0, text: '优化' },
        { type: 'text-delta', index: 0, text: '后的指令' },
        { type: 'finish', reason: { kind: 'stop' } },
      ]
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

/** 假请求：可被 for-await 读取的 body。 */
function makeReq(method, body) {
  return {
    method,
    url: pure.OPTIMIZER_API_PATH,
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield Buffer.from(body, 'utf8')
    },
  }
}

/** 假响应：捕获状态码与主体。 */
function makeRes() {
  const captured = { status: 0, body: '' }
  return {
    captured,
    writeHead(code) { captured.status = code },
    end(body) { captured.body = body },
  }
}

const json = res => JSON.parse(res.captured.body)

{
  const host = await bootHost({ model: { currentSelection: () => ({ provider: 'go', model: 'deepseek-flash' }) } })
  check('注册了一条 exact 路由', host.routes.length === 1 && host.routes[0].kind === 'exact', JSON.stringify(host.routes.map(r => r.kind)))
  check('路由路径与客户端约定一致', host.routes[0].path === pure.OPTIMIZER_API_PATH, host.routes[0].path)

  const handler = host.routes[0].handler
  const res = makeRes()
  await handler(makeReq('POST', JSON.stringify({ text: '把那个页面弄好看点', tier: 'advanced' })), res)
  const body = json(res)
  check('HTTP 200', res.captured.status === 200, String(res.captured.status))
  check('返回拼好的优化正文', body.ok === true && body.text === '优化后的指令', JSON.stringify(body))
  check('回报实际路由', body.provider === 'go' && body.model === 'deepseek-flash')

  const call = host.llmCalls[0]
  check('用的是当前默认模型的 provider/model', call.provider === 'go' && call.model === 'deepseek-flash')
  check('高级档温度 0.3', call.temperature === 0.3, String(call.temperature))
  check('system 是高级档提示词', call.system.includes('没说出口'))
  check('user 消息包了传话框架', call.messages[0].content[0].text.includes('【待转达内容】'))
  check('消息来源标为 user', call.messages[0].source.kind === 'user')
}
{
  const host = await bootHost({ model: { currentSelection: () => ({ provider: 'go', model: 'm' }) } })
  const handler = host.routes[0].handler
  const res = makeRes()
  await handler(makeReq('POST', JSON.stringify({ text: 'x', tier: 'basic' })), res)
  check('basic 档温度 0.2', host.llmCalls[0].temperature === 0.2)
  check('basic 档 system 正确', host.llmCalls[0].system.includes('只做语言层修复'))
}
{
  const host = await bootHost({
    model: { currentSelection: () => ({ provider: 'default', model: 'default-model' }) },
  })
  const handler = host.routes[0].handler
  const res = makeRes()
  await handler(makeReq('POST', JSON.stringify({ text: 'x', provider: 'explicit', model: 'explicit-model' })), res)
  check('请求体里的路由优先于默认模型', host.llmCalls[0].provider === 'explicit' && host.llmCalls[0].model === 'explicit-model')
}
{
  const host = await bootHost()
  check('拿不到默认模型时路由为空', host.routes.length === 1)
  const handler = host.routes[0].handler
  const res = makeRes()
  await handler(makeReq('POST', JSON.stringify({ text: 'x' })), res)
  const body = json(res)
  check('没有路由 → ok:false 且给出指引', body.ok === false && /模型路由/.test(body.error), JSON.stringify(body))
  check('没有路由时不调模型', host.llmCalls.length === 0)
}
{
  const host = await bootHost({ model: { currentSelection: () => ({ provider: 'go', model: 'm' }) } })
  const handler = host.routes[0].handler

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
  await host.routes[0].handler(makeReq('POST', JSON.stringify({ text: '原文' })), res)
  const body = json(res)
  check('模型报错但已有文本 → 仍返回该文本', body.ok === true && body.text === '写了一半', JSON.stringify(body))
}
{
  const host = await bootHost({
    model: { currentSelection: () => ({ provider: 'go', model: 'm' }) },
    chunks: [{ type: 'finish', reason: { kind: 'error', failure: { message: '上游 502', code: 'upstream' } } }],
  })
  const res = makeRes()
  await host.routes[0].handler(makeReq('POST', JSON.stringify({ text: '原文' })), res)
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
  const fresh = schema({})
  check('旧文档 → 快捷指令回落内置 9 条', fresh.quickPrompts?.length === 9, String(fresh.quickPrompts?.length))
  check('旧文档 → 档位回落高级', fresh.optimizerTier === 'advanced', fresh.optimizerTier)
  check('旧文档 → 原有字段仍齐', fresh.enabled === true && fresh.sendKey === 'Enter' && fresh.headerName === 'x-opencode-session')
  check('内置条目结构正确', fresh.quickPrompts[0].id === 'builtin-1' && fresh.quickPrompts[0].always === false)

  const custom = schema({ quickPrompts: [{ id: 'x', label: 'L', prompt: 'P', always: true }] })
  check('已有列表原样保留', custom.quickPrompts.length === 1 && custom.quickPrompts[0].id === 'x')

  const empty = schema({ quickPrompts: [] })
  check('空列表是合法值（被尊重，不回落）', empty.quickPrompts.length === 0)
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

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
