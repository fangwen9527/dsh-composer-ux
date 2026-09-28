/**
 * 「官方价格页解析」纯模块：把 DeepSeek 官方价格页（中文 / 英文）的刊例价抽成结构化数据，
 * 供"一键从官方价格页同步刊例价"使用。
 *
 * ## 这个模块解决什么
 *
 * 官方中的刊例价会变，而 `pricing.ts` 里的 `PRICE_TABLE` 只是一份人工快照。用户希望不必等插件
 * 发版就能把页面上的价同步进来。本模块只干一件事：**HTML 进、数值出**。抓网页、比新旧、写设置、
 * 弹提示全在调用方（宿主半），这里不碰网络也不碰存储。
 *
 * ## 为什么不依赖 DOM
 *
 * 与 `pricing.ts` / `usage-fold.ts` 同规矩：零 import、零 DOM、零 node API。同一份源码要被宿主半
 * （node）与客户端半（浏览器 bundle）共用：`DOMParser` 在 node 里不存在，而一旦在这里引用它，
 * 整个模块就变成"只能在浏览器里跑"。好在官方价格页是服务端渲染的静态 HTML，结构只有
 * `table/tr/td` + `colspan/rowspan`，所以我们用手写的标签扫描 + 网格重建就够：
 * 只关心"哪一格落在哪一列"，不需要一个完整的 HTML 解析器。
 *
 * ## 为什么解析失败必须返回 `undefined`，绝不补零、绝不猜
 *
 * 这是硬纪律：**同步失败绝不能覆盖本地价**。官方页可能改版、可能被 CDN 换成登录页/风控页、
 * 可能抓到一半被截断，也可能某个格子变成 `—` 或空。此时如果"尽力而为"地补 0、沿用旧值，
 * 或者只同步认出来的那几个模型，用户拿到的是一份**看起来正常、实际错得离谱**的价目表
 * （补 0 = 白嫖，漏一列 = 某个模型永远按别人的价算），而且不会报错，只会安静地算错钱。
 * 所以判据是：表头列出的每个模型、每档、三项都必须是**有限非负数**；缺任何一个，整页作废，
 * 让调用方保留本地价并提示"同步失败"。
 *
 * ## 为什么只回数值、不回生效时间
 *
 * 官方价格页上**没有生效时间**（只有"(2) 空闲时段价格为高峰时段价格的一半"这类规则说明）。
 * 抓取时刻 ≠ 生效时刻：编一个"现在生效"塞给用户，会在官方提前公示或延迟上线时把账算错。
 * 生效时间是调用方的策略（用户点同步的那一刻？手工指定？），本模块不替它决定。
 *
 * ## 解析口径（对着真实页面写，不靠想象）
 *
 *  · **列按表头模型 id 定位**：表头行里 `模型 / MODEL` 那一格右边、长得像模型 id 的单元格才是
 *    价格列；取值时按这些列号去取。**不假设"第 4 列是 flash"**（官方加一列说明、把模型顺序
 *    调一下，硬编码列号就全错位了）。
 *  · **语义匹配行标签**：单元格取文本后按 `缓存命中 / 缓存未命中 / 输出`（`CACHE HIT /
 *    CACHE MISS / OUTPUT`）与 `空闲 / 高峰`（`OFF-PEAK / PEAK`）判定，不依赖 class、
 *    `style`、属性顺序或行的先后。
 *  · `colspan/rowspan` 展开成网格后按列取值；`<br>`、`<sup>(1)</sup>`、`&amp;`、零宽字符
 *    这类噪声在取文本时清掉。
 *  · `aliases` 从整页纯文本里按"现役名 + 旧名标记（旧模型名 / legacy / deprecated…）+
 *    同族旧名"抽；抽不到就是空对象 —— 它是**可选**字段，**不**因此作废整页。
 */

/** 一档三项单价（每 1M tokens，页面原值不做任何换算）。 */
export interface OfficialRate {
  readonly hit: number
  readonly miss: number
  readonly out: number
}

/** 一张官方价格页解析出的一列价格。 */
export interface OfficialPricePage {
  /** 页面用的是哪种币种：中文页 CNY、英文页 USD。 */
  readonly currency: 'CNY' | 'USD'
  /** 模型 id（页面原样，如 `deepseek-flash`）→ 高峰/空闲两档。 */
  readonly table: Readonly<Record<string, { readonly peak: OfficialRate; readonly offPeak: OfficialRate }>>
  /** 页面上被标注为旧名/等价的模型名（例如 `deepseek-v4-flash`）→ 现役模型 id。 */
  readonly aliases: Readonly<Record<string, string>>
}

/** 网格里的一格（colspan/rowspan 展开后同一格对象会出现在多个列/行上）。 */
interface Cell {
  /** 去标签、去 `<sup>`、解实体的可见文本（空白已折叠）。 */
  readonly text: string
  readonly colspan: number
  readonly rowspan: number
}

/** 展开后的网格：一行 = 一格数组，下标就是列号。 */
type GridRow = readonly (Cell | undefined)[]

/** 表头定位结果。 */
interface HeaderInfo {
  /** 模型价格列的列号（升序）。 */
  readonly modelCols: readonly number[]
  /** 列号 → 模型 id（页面原样）。 */
  readonly modelNames: Readonly<Record<number, string>>
}

/** 命名实体表：官方页里会出现的那些（大小写不敏感）。 */
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ensp: ' ',
  emsp: ' ',
  thinsp: ' ',
  yen: '¥',
  dollar: '$',
  middot: '·',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  times: '×',
}

/** 解 HTML 实体（`&amp;` / `&#39;` / `&#x27;`）；认不出的原样保留。 */
function decodeEntities(text: string): string {
  return text.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole: string, body: string) => {
    if (body.charAt(0) === '#') {
      const hex = body.charAt(1) === 'x' || body.charAt(1) === 'X'
      const code = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole
  })
}

/** 折叠空白、去掉零宽字符（官方页锚点后面挂着一堆 `\u200b`）。 */
function normalize(text: string): string {
  return decodeEntities(text)
    .replace(/[\u200b-\u200d\u2060\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 把一段 HTML 片段取成纯文本。
 *
 * 两个有意的处理：
 *  · `<sup>(1)</sup>` 整块丢掉 —— 它是脚注上标，不是内容（留着会把模型 id 变成 `deepseek-flash(1)`）；
 *  · `<br>` 变空格 —— "百万tokens输入<br>（缓存命中）" 折成一行后仍含关键词，语义匹配照样过。
 */
function toText(html: string): string {
  return normalize(
    html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
      .replace(/<sup\b[^>]*>[\s\S]*?<\/sup\s*>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]*>/g, ' '),
  )
}

/** 整页纯文本（别名抽取用；同样先去掉脚本/样式/上标）。 */
function documentText(html: string): string {
  return toText(html)
}

/** 读 `colspan` / `rowspan`（不带引号、单引号、双引号都认）；缺省或坏值当 1。 */
function readSpan(attrs: string, name: string): number {
  const match = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i').exec(attrs)
  const raw = match === null ? undefined : (match[1] ?? match[2] ?? match[3])
  const span = raw === undefined ? 1 : Number.parseInt(raw, 10)
  return Number.isFinite(span) && span > 0 ? Math.min(span, 64) : 1
}

/**
 * 把 `<table>` 片段展开成网格。
 *
 * rowspan 用"挂账"实现：某格跨 2 行时，把它记在 `carry[列]` 里，下一行对应列先把它取回来，
 * 再放本行自己的格。这样"价格"跨 6 行、"缓存命中"跨 2 行这类结构才能按列对齐。
 */
function buildGrid(tableHtml: string): readonly GridRow[] {
  const rows: (Cell | undefined)[][] = []
  const carry: ({ cell: Cell; remaining: number } | undefined)[] = []
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi
  let rowMatch: RegExpExecArray | null
  while ((rowMatch = rowRe.exec(tableHtml)) !== null) {
    const out: (Cell | undefined)[] = []
    let col = 0
    /** 把上一行挂下来的 rowspan 格子取回本行（可能连续好几列）。 */
    const drain = (): void => {
      while (carry[col] !== undefined && carry[col]!.remaining > 0) {
        out[col] = carry[col]!.cell
        carry[col]!.remaining -= 1
        col += 1
      }
    }
    const cellRe = /<t[dh]\b([^>]*)>([\s\S]*?)<\/t[dh]\s*>/gi
    let cellMatch: RegExpExecArray | null
    while ((cellMatch = cellRe.exec(rowMatch[1] ?? '')) !== null) {
      drain()
      const attrs = cellMatch[1] ?? ''
      const cell: Cell = {
        text: toText(cellMatch[2] ?? ''),
        colspan: readSpan(attrs, 'colspan'),
        rowspan: readSpan(attrs, 'rowspan'),
      }
      for (let k = 0; k < cell.colspan; k += 1) {
        out[col + k] = cell
        if (cell.rowspan > 1) carry[col + k] = { cell, remaining: cell.rowspan - 1 }
      }
      col += cell.colspan
    }
    drain()
    rows.push(out)
  }
  return rows
}

/** 表头里的"模型"标签（中英文）。 */
const MODEL_LABEL_RE = /^(?:模型|model)$/i

/**
 * 模型 id 的形状：小写字母开头、至少带一个 `-` / `_` / `.` 分隔段。
 *
 * 故意收紧：表头右边可能还挂着"说明/NOTES"这种非模型列，形状过滤能把它挡在外面
 * （按 id 形状过滤，比维护一张"非模型列"黑名单稳）。
 */
const MODEL_ID_RE = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+$/

/** 去掉单元格末尾的脚注标记（`deepseek-flash(1)` → `deepseek-flash`），以防上标没包在 `<sup>` 里。 */
function withoutFootnoteMark(text: string): string {
  return text.replace(/[\s\u00a0]*[（(]\d+[)）]\s*$/, '').trim()
}

/** 在网格里找表头行：`模型 / MODEL` 那一格右边、形状像模型 id 的列就是价格列。 */
function findHeader(rows: readonly GridRow[]): HeaderInfo | undefined {
  for (const row of rows) {
    for (let start = 0; start < row.length; start += 1) {
      const labelCell = row[start]
      if (labelCell === undefined || !MODEL_LABEL_RE.test(withoutFootnoteMark(labelCell.text))) continue
      // 同一个格对象因 colspan 会连续出现在多列上，取到它占的最后一列
      let end = start
      while (end + 1 < row.length && row[end + 1] === labelCell) end += 1
      const modelNames: Record<number, string> = {}
      for (let col = end + 1; col < row.length; col += 1) {
        const candidate = row[col]
        if (candidate === undefined) continue
        const name = withoutFootnoteMark(candidate.text)
        if (MODEL_ID_RE.test(name)) modelNames[col] = name
      }
      const modelCols = Object.keys(modelNames).map(Number).sort((a, b) => a - b)
      if (modelCols.length > 0) return { modelCols, modelNames }
    }
  }
  return undefined
}

/** 行标签的三项语义（按这个顺序判：命中 / 未命中 / 输出）。 */
const CATEGORY_RULES: readonly { readonly field: keyof OfficialRate; readonly re: RegExp }[] = [
  { field: 'hit', re: /缓存命中|CACHE\s*HIT/i },
  { field: 'miss', re: /缓存未命中|CACHE\s*MISS/i },
  { field: 'out', re: /输出|OUTPUT/i },
]

/** 空闲档（`OFF-PEAK` 里也含 `PEAK`，所以先判它）。 */
const OFF_PEAK_RE = /空闲|OFF\s*-?\s*PEAK/i
/** 高峰档。 */
const PEAK_RE = /高峰|PEAK/i

/**
 * 一格金额：`0.02元` / `1元` / `$0.003` / `US$0.15` / `0.15 美元` / `¥0.04`。
 *
 * **故意不认千分位**：`1,000元` 直接判失败（而不是猜成 1000）。带逗号的数字在"元"口径里
 * 本来就少见，猜错的代价是价格差三个数量级，宁可让调用方知道同步失败了。
 */
const MONEY_RE = /^(?:(?:US)?\$|[¥￥]|USD|CNY|RMB)?\s*(\d+(?:\.\d+)?)\s*(?:元|人民币|美元|USD|CNY|RMB)?$/i

/** 读一格的钱；空、`—`、千分位、区间、负号等一律 `undefined`（**不补零**）。 */
function readMoney(text: string): number | undefined {
  const match = MONEY_RE.exec(text)
  if (match === null) return undefined
  const value = Number(match[1])
  return Number.isFinite(value) && value >= 0 ? value : undefined
}

/** 币种符号。`元/¥/￥/人民币/RMB/CNY` → CNY；`$/美元/USD` → USD。 */
const CNY_RE = /[¥￥]|元|人民币|\bRMB\b|\bCNY\b/i
const USD_RE = /\$|美元|\bUSD\b/i

/**
 * 从一组文本里定币种。
 *
 * 两个方向都有（或都没有）= 页面没把币种说清楚 → `undefined`。宁可同步失败，也不要拿人民币的
 * 数字当美元写进设置（那会让所有金额差约 7 倍）。
 */
function currencyOf(texts: readonly string[]): 'CNY' | 'USD' | undefined {
  let cny = false
  let usd = false
  for (const text of texts) {
    if (CNY_RE.test(text)) cny = true
    if (USD_RE.test(text)) usd = true
  }
  if (cny === usd) return undefined
  return cny ? 'CNY' : 'USD'
}

/** 三项都齐、都是有限非负数才算一档。 */
function completeRate(parts: Partial<OfficialRate>): OfficialRate | undefined {
  const hit = parts.hit
  const miss = parts.miss
  const out = parts.out
  if (
    typeof hit !== 'number' || !Number.isFinite(hit) || hit < 0
    || typeof miss !== 'number' || !Number.isFinite(miss) || miss < 0
    || typeof out !== 'number' || !Number.isFinite(out) || out < 0
  ) return undefined
  return { hit, miss, out }
}

/** 一张表解析出的东西（不含 aliases —— 脚注在表外）。 */
interface ParsedTable {
  readonly currency: 'CNY' | 'USD'
  readonly table: Record<string, { peak: OfficialRate; offPeak: OfficialRate }>
}

/**
 * 逐格填写用的**可变**草稿形状。
 *
 * 为什么不直接 `Partial<OfficialRate>`：`OfficialRate` 的字段是对外契约里的 readonly，
 * `Partial<>` 会把这层只读一起带过来，于是 `draft[field] = value` 直接是类型错误
 * （2026-09-29 由 `tsc` 抓到；esbuild 不查类型所以构建期看不出来）。
 */
type MutableRate = { hit?: number; miss?: number; out?: number }

/** 表头已经认定是价格表之后再解析；**坏一格就整页作废**。 */
function parsePricingRows(rows: readonly GridRow[], header: HeaderInfo): ParsedTable | undefined {
  const firstModelCol = header.modelCols[0]!
  const drafts: Record<string, { peak: MutableRate; offPeak: MutableRate }> = {}
  for (const col of header.modelCols) drafts[header.modelNames[col]!] = { peak: {}, offPeak: {} }

  const moneyTexts: string[] = []
  for (const row of rows) {
    if (row.length <= firstModelCol) continue
    // 行标签 = 价格列左边所有格的文本拼起来（"价格" + "百万tokens输入（缓存命中）" + "空闲时段"）
    const label = row.slice(0, firstModelCol).map(cell => (cell === undefined ? '' : cell.text)).join(' ')
    const category = CATEGORY_RULES.find(rule => rule.re.test(label))
    if (category === undefined) continue
    const tier = OFF_PEAK_RE.test(label) ? 'offPeak' : (PEAK_RE.test(label) ? 'peak' : undefined)
    if (tier === undefined) continue
    for (const col of header.modelCols) {
      const name = header.modelNames[col]!
      const raw = row[col] === undefined ? '' : row[col]!.text
      const value = readMoney(raw)
      // 认出来的价格行必须每列都是合法的钱：少一格 → 整页 undefined，绝不补零
      if (value === undefined) return undefined
      drafts[name]![tier][category.field] = value
      moneyTexts.push(raw)
    }
  }

  const table: Record<string, { peak: OfficialRate; offPeak: OfficialRate }> = {}
  for (const [name, tiers] of Object.entries(drafts)) {
    const peak = completeRate(tiers.peak)
    const offPeak = completeRate(tiers.offPeak)
    if (peak === undefined || offPeak === undefined) return undefined
    table[name] = { peak, offPeak }
  }
  if (Object.keys(table).length === 0) return undefined

  const allTexts = rows.flatMap(row => row.map(cell => (cell === undefined ? '' : cell.text)))
  const currency = currencyOf(moneyTexts) ?? currencyOf(allTexts)
  if (currency === undefined) return undefined
  return { currency, table }
}

/** 旧名句式的标记词：中英文各一套。 */
const LEGACY_MARKER_RE = /旧模型名|旧名|已下线|已退役|legacy|deprecated|renamed|still accepted|仍可调用/i

/** 旧名 token：小写开头、至少一个分隔段；前面不能紧挨字母/数字（否则 "Off-peak" 会切出 "ff-peak"）。 */
const ALIAS_TOKEN_RE = /(?<![A-Za-z0-9_])[a-z][a-z0-9]*(?:[._-][a-z0-9]+)+/g

/** 旧名标记与旧名之间最远隔多少字符（防跨段落乱配）。 */
const ALIAS_WINDOW = 400

/** 找 `limit` 之前最后一次出现的旧名标记词。 */
function lastMarkerBefore(text: string, limit: number): { index: number; length: number } | undefined {
  const re = new RegExp(LEGACY_MARKER_RE.source, 'gi')
  let found: { index: number; length: number } | undefined
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    if (match.index >= limit) break
    found = { index: match.index, length: match[0].length }
    if (match[0].length === 0) re.lastIndex += 1
  }
  return found
}

/**
 * 抽"旧模型名 → 现役模型名"。
 *
 * 逐 token 判句式：**现役名 → 旧名标记（`旧模型名` / `legacy` / `deprecated`…）→ 同族旧名**。
 * 归属取"这个旧名之前**最近**出现的现役名"，而不是"我们正从哪个现役名往后看" ——
 * 后者会把表头里并排的另一个现役名（`deepseek-v4-pro`）当成旧名的归属。
 * 同族判据（第一段相同，如 `deepseek`）+ 排除现役名本身，顺手挡掉 `off-peak`、`zh-cn` 这类
 * 长得像模型名却不是的东西。抽不到就返回空对象：这是可选字段，不因此作废整页。
 */
function extractAliases(html: string, models: readonly string[]): Readonly<Record<string, string>> {
  const aliases: Record<string, string> = {}
  if (models.length === 0) return aliases
  const text = documentText(html)
  const known = new Set(models)
  const families = new Set(models.map(model => model.split(/[._-]/)[0] ?? ''))

  const marks: { at: number; model: string }[] = []
  for (const model of models) {
    const finder = new RegExp(model.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    let found: RegExpExecArray | null
    while ((found = finder.exec(text)) !== null) marks.push({ at: found.index, model })
  }
  marks.sort((a, b) => (a.at === b.at ? (a.model < b.model ? -1 : 1) : a.at - b.at))

  ALIAS_TOKEN_RE.lastIndex = 0
  let token: RegExpExecArray | null
  while ((token = ALIAS_TOKEN_RE.exec(text)) !== null) {
    const name = token[0]
    if (known.has(name)) continue
    if (!families.has(name.split(/[._-]/)[0] ?? '')) continue
    const at = token.index
    let owner: string | undefined
    let ownerAt = -1
    for (const mark of marks) {
      if (mark.at >= at) break
      owner = mark.model
      ownerAt = mark.at
    }
    if (owner === undefined) continue
    const marker = lastMarkerBefore(text, at)
    if (marker === undefined || ownerAt >= marker.index) continue
    if (at - marker.index > ALIAS_WINDOW) continue
    if (aliases[name] === undefined) aliases[name] = owner
  }
  return aliases
}

/**
 * 解析官方价格页 HTML。
 * @param html 页面 HTML。
 * @returns 解析结果；**任何一个必需字段缺失/不是有限非负数就返回 `undefined`**，绝不猜、绝不补零。
 */
export function parseOfficialPricingPage(html: string): OfficialPricePage | undefined {
  if (typeof html !== 'string' || html.length === 0) return undefined
  const tables = html.match(/<table\b[^>]*>[\s\S]*?<\/table\s*>/gi)
  if (tables === null) return undefined
  for (const tableHtml of tables) {
    const rows = buildGrid(tableHtml)
    const header = findHeader(rows)
    // 不是价格表（没有"模型"表头）就换下一张
    if (header === undefined) continue
    // 已经认定这张是价格表：它坏了就是整页解析失败，不去别的表里碰运气
    const parsed = parsePricingRows(rows, header)
    if (parsed === undefined) return undefined
    return {
      currency: parsed.currency,
      table: parsed.table,
      aliases: extractAliases(html, Object.keys(parsed.table)),
    }
  }
  return undefined
}
