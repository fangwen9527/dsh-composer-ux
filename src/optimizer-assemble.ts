/**
 * 提示词优化器的「依据校验 + 宿主装配」层（纯函数：无 IO、无 LLM、无宿主依赖）。
 *
 * 这一层是 0.6.0 引入的**机制内核**，做法取自 WestFox-AwA/dsh-prompt-optimizer 的
 * 0.6 线（BSD-3-Clause，作者「啃轮胎的西狐」）：
 *
 *   `po06/lib/interpreter.js`  —— 模型只产条目；`validateProvenance` 要求
 *                                 user_requirement 的引文必须是**字面子串**，
 *                                 对不上就丢那一条并记账（绝不整轮作废）。
 *   `po06/lib/compiler.js`     —— 宿主按固定节序渲染、**超预算按固定顺序丢弃**
 *                                 并写明丢了什么（绝不静默截断）。
 *
 * 本插件在此基础上把"条目 → 成品"这一步做成**结构化的搬运**而不是又一次自由改写：
 *   · `rewrite` 条目按引文在原话里的**位置**回填（右侧先动，下标不会串位）；
 *   · 没被任何 rewrite 覆盖的原话**原样保留**；
 *   · 其余条目按节追加在末尾，每条带自己的逐字依据。
 * 于是"模型凭空发明一条要求"在结构上不可能：它拿不出逐字引文。
 *
 * 三条纪律（与对方一致，逐条都有对应代码）：
 *   ① 单点不得废整轮 —— 引文对不上/超上限/字段写坏，只丢那一条并记账；
 *   ② 只丢不编 —— 补不出的东西不会出现在成品里；
 *   ③ 降级要出声 —— 省略多少条、为什么，成品与面板都要看得见。
 */
import { OPTIMIZE_ITEM_MAX_CHARS, OPTIMIZE_MAX_ITEMS, OPTIMIZE_ITEM_KINDS, OPTIMIZE_UNKNOWN_CLASSES } from './optimizer-prompt.ts'
import { OPTIMIZE_OUTPUT_MAX } from './settings-contract.ts'

/** 条目种类。 */
export type OptimizeItemKind = (typeof OPTIMIZE_ITEM_KINDS)[number]

/** 未决项分类。 */
export type OptimizeUnknownClass = (typeof OPTIMIZE_UNKNOWN_CLASSES)[number]

/** 原话里的一段位置（左闭右开）。 */
export interface QuoteSpan {
  readonly start: number
  readonly end: number
}

/** 一条通过校验的条目。 */
export interface OptimizeItem {
  /** 稳定序号（模型不给 id，宿主自己编：`item#1`）。 */
  readonly id: string
  readonly kind: OptimizeItemKind
  /** 拼进成品的正文。 */
  readonly text: string
  /** 逐字引文（`rewrite`/`requirement`/`quality` 必有且已核对通过）。 */
  readonly quote?: string
  /** 引文在原话里的位置（核对通过时才有）。 */
  readonly span?: QuoteSpan
  /** 引文来自原话还是模型自己补的（`unknown`/`plan`/`risk` 允许没有引文）。 */
  readonly quoteSource?: 'user' | 'none'
  readonly unknownClass?: OptimizeUnknownClass
  readonly blocking?: boolean
}

/** 一条被丢掉的条目（记账用：面板会显示条数与原因）。 */
export interface DroppedItem {
  readonly id: string
  readonly kind: string
  readonly reason: string
}

/** 解析结果。 */
export type ParseResult =
  | { readonly ok: true; readonly items: readonly OptimizeItem[]; readonly dropped: readonly DroppedItem[]; readonly warnings: readonly string[] }
  | { readonly ok: false; readonly code: 'NO_JSON' | 'BAD_JSON' | 'BAD_SHAPE' | 'NOT_ENVELOPE'; readonly reason: string }

/** 装配结果。 */
export interface AssembleResult {
  /** 最终写回输入框的正文。 */
  readonly text: string
  /** 实际渲染出来的节（顺序即出现顺序）。 */
  readonly sections: readonly string[]
  /** 因篇幅预算被丢掉的条目。 */
  readonly dropped: readonly DroppedItem[]
  readonly warnings: readonly string[]
  readonly chars: number
  readonly budget: number
  readonly overBudget: boolean
  readonly overBy: number
  /** 被 rewrite 覆盖掉的原话字符数（面板用它说明"改了多少"）。 */
  readonly rewrittenChars: number
  /** 通过校验、真的进入了成品的条目数。 */
  readonly itemCount: number
}

/**
 * 各档的篇幅预算 = 原话长度的倍数，并有**下限**与上限。
 *
 * 下限为什么给这么大（普通 400 / 高级 700 / 极端 1400）：装配形态下成品**必然**比原话长——
 * 除了回填过的正文，还要带上各节的标题与逐字依据。拿"1.4 倍"去卡一个 23 字的原话（= 32 字符），
 * 连一条带依据的补全都放不下，闸门会常态性触发、成品里塞满"因篇幅预算省略 N 条"——
 * 那是把机制噪声当成了产出。所以下限是"装得下正常一轮补全"的量，倍数只在长原文上起作用。
 *
 * 上限取 `OPTIMIZE_OUTPUT_MAX`，与宿主返回给客户端的截断口径同一个数。
 * （对方 0.6 的做法同源：`compiler.js` 的 `DEFAULT_BUDGET = 1200` 是个固定量，不是输入的倍数。）
 */
const TIER_BUDGET: Record<string, { readonly factor: number; readonly floor: number }> = {
  basic: { factor: 1.4, floor: 400 },
  advanced: { factor: 2.6, floor: 700 },
  extreme: { factor: 4, floor: 1_400 },
}

/**
 * 各档允许出现的条目种类 —— **档位承诺的机械执行**。
 *
 * 为什么要在代码里再拦一道：提示词里写了"普通档不许产出 requirement"，但那是**请求**，
 * 不是保证；模型不照做时，用户看到的"普通档"就会莫名其妙多出补全要求。档位既然是用户
 * 亲手选的语义（普通 = 只修语言），就必须由宿主保证，而不是指望模型听话。
 */
const TIER_KINDS: Record<string, readonly OptimizeItemKind[]> = {
  basic: ['rewrite', 'unknown'],
  advanced: ['rewrite', 'requirement', 'quality', 'unknown'],
  extreme: ['rewrite', 'requirement', 'quality', 'unknown', 'plan', 'risk'],
}

/**
 * 这一档允许哪些条目种类。
 * @param tier - 档位；未知档按 advanced。
 * @returns 允许的种类（顺序不表意）。
 */
export function allowedKindsFor(tier: string): readonly OptimizeItemKind[] {
  return TIER_KINDS[tier] ?? TIER_KINDS.advanced!
}

/**
 * 算这一档的篇幅预算。
 * @param tier - 档位；未知档按 advanced。
 * @param originalChars - 原话字符数。
 * @returns 允许的成品字符上限。
 */
export function optimizeBudgetFor(tier: string, originalChars: number): number {
  const spec = TIER_BUDGET[tier] ?? TIER_BUDGET.advanced!
  const scaled = Math.ceil(Math.max(0, originalChars) * spec.factor)
  return Math.min(OPTIMIZE_OUTPUT_MAX, Math.max(spec.floor, scaled))
}

/**
 * 判断这段输出**像不像**本插件要的那份信封（`{"items":…}` / `{"ops":…}`）。
 *
 * 这个判据只用来决定"解析失败时该怎么办"，是本次改造里最要紧的一条安全边界：
 *   · 像信封 → **失败**（宁可不写回，也绝不把半截 JSON 塞进输入框）；
 *   · 不像信封（旧行为的自由文本）→ 整段照收兜底。
 * 所以它刻意偏向"判成像"：把一段普通文本误判成信封的代价只是"这一次优化失败、
 * 草稿原封不动"；反过来判错的代价是把 `{"items":[{"kind":"rew` 这种垃圾写进输入框。
 * @param raw - 模型原始输出。
 * @returns 像信封则为 true。
 */
function looksLikeEnvelope(raw: string): boolean {
  const text = String(raw ?? '').trim()
  if (text.startsWith('{') || text.startsWith('```')) return true
  return /"(items|ops)"\s*:/.test(text)
}

/**
 * 从模型输出里抽出 JSON（容忍 ```json 围栏与前后废话）。
 *
 * 为什么容错：对方真机台账里最常见的失败就是"模型在 JSON 前后多说了两句话"，
 * 而这不该让整轮白跑。
 * @param raw - 模型原始输出。
 * @returns 解析出的对象；抽不到时给出可记账的原因。
 */
export function extractJson(raw: string): { ok: true; value: unknown } | { ok: false; code: 'NO_JSON' | 'BAD_JSON'; reason: string } {
  const text = String(raw ?? '')
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced ? fenced[1]! : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  const envelope = looksLikeEnvelope(text)
  if (start < 0 || end <= start) {
    return envelope
      ? { ok: false, code: 'BAD_JSON', reason: '输出看起来是本插件的条目 JSON，但括号不完整（可能被截断）' }
      : { ok: false, code: 'NO_JSON', reason: '输出里没有 JSON 对象' }
  }
  try {
    return { ok: true, value: JSON.parse(candidate.slice(start, end + 1)) }
  } catch (error: unknown) {
    return {
      ok: false,
      code: envelope ? 'BAD_JSON' : 'NO_JSON',
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * 在原话里找一段引文，返回它在原话中的位置。
 *
 * 先做**逐字**比对（对方的口径）；逐字找不到时退一步做**空白归一**比对 ——
 * 模型把原话里的换行/多空格复述成单空格是常见现象，不该因此丢掉一条好条目。
 * 归一路径会把匹配区间映射回原话的真实下标，所以回填仍然落在正确位置。
 * @param original - 用户原话（逐字）。
 * @param quote - 模型给的引文。
 * @returns 位置；对不上时 undefined。
 */
export function findQuoteSpan(original: string, quote: string): QuoteSpan | undefined {
  const q = String(quote ?? '').trim()
  if (q === '') return undefined
  const exact = original.indexOf(q)
  if (exact >= 0) return { start: exact, end: exact + q.length }

  // ── 空白归一比对：把原话压成"单空格分隔"的串，同时记住每个字符的原下标。
  const target = q.replace(/\s+/g, ' ')
  let acc = ''
  const map: number[] = []
  for (let i = 0; i < original.length; i += 1) {
    const ch = original[i]!
    if (/\s/.test(ch)) {
      if (acc === '' || acc.endsWith(' ')) continue
      acc += ' '
      map.push(i)
      continue
    }
    acc += ch
    map.push(i)
  }
  const at = acc.indexOf(target)
  if (at < 0) return undefined
  const start = map[at]!
  const last = map[at + target.length - 1] ?? start
  return { start, end: last + 1 }
}

/** 把模型的 `{items:[...]}` / 参考实现的 `{ops:[{op:'add_item',item}]}` 都归一成条目数组。 */
function itemsOf(value: unknown, warnings: string[]): readonly unknown[] | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const row = value as Record<string, unknown>
  if (Array.isArray(row.items)) return row.items
  // 兼容对方 0.6 的 ops 形态（模型见过那份契约时很容易写成这样）——
  // 与其整轮作废，不如认下来；`set_item_status` 这类跨轮 op 本插件没有状态可销，如实记账忽略。
  if (Array.isArray(row.ops)) {
    const out: unknown[] = []
    for (const op of row.ops) {
      if (typeof op !== 'object' || op === null) continue
      const entry = op as Record<string, unknown>
      if (entry.op === 'add_item' && typeof entry.item === 'object' && entry.item !== null) { out.push(entry.item); continue }
      warnings.push(`忽略了不支持的 op「${String(entry.op ?? '(空)')}」：本插件不做跨轮状态，只认 add_item`)
    }
    return out
  }
  return undefined
}

/** 这份 JSON 里**出现了** items / ops 键（不管类型对不对）—— 用来区分"信封写坏了"与"根本不是信封"。 */
function hasEnvelopeKey(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  return 'items' in row || 'ops' in row
}

/** 读一个条目的 `unknownClass`（缺省按"只有用户能定"处理，与对方 0.6 同口径）。 */
function unknownClassOf(value: unknown): OptimizeUnknownClass {
  return OPTIMIZE_UNKNOWN_CLASSES.includes(value as OptimizeUnknownClass)
    ? value as OptimizeUnknownClass
    : 'user_preference'
}

/**
 * 解析并**逐条核对**模型输出。
 *
 * 判据（全部只丢单条、绝不整轮作废 —— 对方 2026-09-22 的真机教训：
 * "一条引文对不上 ⇒ 整轮一个包都产不出来"）：
 *   · `kind` 不在白名单 → 丢；
 *   · `text` 空 → 丢；超 300 字 → 截断并记账；
 *   · `rewrite`/`requirement`/`quality` 的 `quote` 缺失或在原话里找不到 → 丢；
 *   · `unknown`/`plan`/`risk` 允许没有引文；给了引文但对不上 → 保留条目、如实标 `quoteSource:'none'`。
 * @param raw - 模型原始输出。
 * @param original - 用户原话（逐字，用于字面比对）。
 * @returns 通过校验的条目 + 被丢掉的条目 + 警告。
 */
export function parseOptimizeOutput(raw: string, original: string): ParseResult {
  const extracted = extractJson(raw)
  if (!extracted.ok) return { ok: false, code: extracted.code, reason: extracted.reason }
  const warnings: string[] = []
  const raw_items = itemsOf(extracted.value, warnings)
  if (raw_items === undefined) {
    // 有 items/ops 键但类型不对 ⇒ 信封写坏了（失败）；压根没有这两个键 ⇒ 这只是一段恰好是
    // JSON 的旧式自由文本（交回兜底照收，不算错）。
    return hasEnvelopeKey(extracted.value)
      ? { ok: false, code: 'BAD_SHAPE', reason: '期望 {"items":[...]} 或 {"ops":[{"op":"add_item","item":{...}}]}' }
      : { ok: false, code: 'NOT_ENVELOPE', reason: '这是一段 JSON，但不是本插件的条目信封' }
  }

  const items: OptimizeItem[] = []
  const dropped: DroppedItem[] = []
  const seenRewrite = new Set<string>()

  for (let index = 0; index < raw_items.length; index += 1) {
    const id = `item#${index + 1}`
    const entry = raw_items[index]
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      dropped.push({ id, kind: '(非对象)', reason: '条目不是对象' })
      continue
    }
    const row = entry as Record<string, unknown>
    const kind = String(row.kind ?? '')
    if (!OPTIMIZE_ITEM_KINDS.includes(kind as OptimizeItemKind)) {
      dropped.push({ id, kind: kind === '' ? '(空)' : kind, reason: `kind 不在允许列表里（${OPTIMIZE_ITEM_KINDS.join(' / ')}）` })
      continue
    }
    let text = typeof row.text === 'string' ? row.text.trim() : ''
    if (text === '') {
      dropped.push({ id, kind, reason: 'text 是空的' })
      continue
    }
    if (text.length > OPTIMIZE_ITEM_MAX_CHARS) {
      warnings.push(`${id}：text 超 ${OPTIMIZE_ITEM_MAX_CHARS} 字，已截断`)
      text = text.slice(0, OPTIMIZE_ITEM_MAX_CHARS)
    }
    if (items.length >= OPTIMIZE_MAX_ITEMS) {
      dropped.push({ id, kind, reason: `超过单轮上限 ${OPTIMIZE_MAX_ITEMS} 条 ⇒ 截断丢弃（整轮照常出成品）` })
      continue
    }

    const needsQuote = kind === 'rewrite' || kind === 'requirement' || kind === 'quality'
    const quote = typeof row.quote === 'string' ? row.quote.trim() : ''
    if (needsQuote) {
      if (quote === '') {
        dropped.push({ id, kind, reason: '缺少 quote（这一类条目必须有逐字引文）' })
        continue
      }
      const span = findQuoteSpan(original, quote)
      if (span === undefined) {
        dropped.push({ id, kind, reason: `引文不是原话里的逐字片段：「${quote.slice(0, 40)}」` })
        continue
      }
      if (kind === 'rewrite') {
        // 同一段原话只允许一条 rewrite：重叠的两条会让回填顺序变得不可解释。
        const key = `${String(span.start)}-${String(span.end)}`
        if (seenRewrite.has(key)) {
          dropped.push({ id, kind, reason: '与另一条 rewrite 引用了同一段原话（重复）' })
          continue
        }
        seenRewrite.add(key)
      }
      items.push({ id, kind: kind as OptimizeItemKind, text, quote, span, quoteSource: 'user' })
      continue
    }

    // unknown / plan / risk：引文可选。给了但对不上就如实记成"模型自己补的"，条目照常保留。
    const span = quote === '' ? undefined : findQuoteSpan(original, quote)
    if (quote !== '' && span === undefined) {
      warnings.push(`${id}：引文对不上原话，已按"模型自己补的"记账（不冒充你说过的话）`)
    }
    items.push({
      id, kind: kind as OptimizeItemKind, text, quoteSource: span === undefined ? 'none' : 'user',
      ...(span === undefined ? {} : { span, quote }),
      ...(kind === 'unknown' ? { unknownClass: unknownClassOf(row.unknownClass), blocking: row.blocking === true } : {}),
    })
  }

  if (items.length === 0 && dropped.length === 0 && raw_items.length === 0) warnings.push('模型交回空数组：这一轮没有可核实的补全')
  return { ok: true, items, dropped, warnings }
}

/** 节的顺序即渲染顺序；`required` 的节**永不**因篇幅被丢（对方 compiler.js 的同一条纪律）。 */
const SECTIONS: readonly { readonly key: OptimizeItemKind; readonly label: string; readonly required: boolean }[] = [
  { key: 'requirement', label: '补全要求（每条都指回你原话里的某句）', required: true },
  { key: 'quality', label: '对质量词的理解', required: false },
  { key: 'plan', label: '分阶段执行计划', required: false },
  { key: 'risk', label: '多情况预案', required: false },
  { key: 'unknown', label: '不明确处', required: false },
]

/** 超预算时的丢弃顺序：越靠前越先丢（与渲染顺序相反：越"附加"的越先丢）。 */
const DROP_ORDER: readonly OptimizeItemKind[] = ['risk', 'plan', 'quality', 'unknown']

/** 未决项的分类后缀：把对方 0.6 的三分类语义直接写进成品，工作 AI 才知道该怎么办。 */
const UNKNOWN_SUFFIX: Record<OptimizeUnknownClass, string> = {
  user_preference: '（只有我能定：先问我，不要自行假设）',
  lookupable_fact: '（可查证的事实：先读代码/文档确认，不要猜）',
  implementation_detail: '（实现细节：你自己定）',
}

/** 渲染一条条目为列表项。 */
function lineFor(item: OptimizeItem): string {
  if (item.kind === 'unknown') {
    const cls = item.unknownClass ?? 'user_preference'
    const blocking = item.blocking === true ? '[挡住下一步] ' : ''
    return `- ${blocking}${item.text}${UNKNOWN_SUFFIX[cls]}`
  }
  const evidence = item.quote === undefined ? '' : `（依据："${item.quote}"）`
  return `- ${item.text}${evidence}`
}

/**
 * 把校验通过的条目**装配**成最终命令。
 *
 * 步骤（每一步都可单独解释）：
 *   1. `rewrite` 按引文位置从右往左回填 —— 右侧先动，左侧的下标才不会串位；
 *      与原话其它 rewrite 重叠的那条已在解析期丢掉，所以这里只需按 start 排序；
 *   2. 其余条目按固定节序追加在末尾，每条带自己的逐字依据；
 *   3. 超过篇幅预算就按 `DROP_ORDER` 逐条丢**可选的节**，并把"丢了几条"写进成品
 *      （对方的态度：降级要出声，不能静默截断）。
 *
 * @param original - 用户原话（逐字）。
 * @param items - 已通过校验的条目。
 * @param options - `tier` 决定篇幅预算。
 * @returns 成品与全部记账信息。
 */
export function assembleCommand(
  original: string,
  items: readonly OptimizeItem[],
  options: { readonly tier: string },
): AssembleResult {
  const body0 = String(original ?? '')
  const warnings: string[] = []
  const dropped: DroppedItem[] = []

  // ── 0) 档位门：不属于这一档的条目一律不渲染（见 TIER_KINDS 的说明）。
  const allowed = allowedKindsFor(options.tier)
  const usable: OptimizeItem[] = []
  for (const item of items) {
    if (allowed.includes(item.kind)) { usable.push(item); continue }
    dropped.push({ id: item.id, kind: item.kind, reason: `当前档位（${options.tier}）不产出「${item.kind}」这一类条目` })
  }

  // ── 1) rewrite 回填
  const rewrites = usable
    .filter(item => item.kind === 'rewrite' && item.span !== undefined)
    .slice()
    .sort((a, b) => (a.span!.start - b.span!.start) || (a.span!.end - b.span!.end))
  const keptRewrites: OptimizeItem[] = []
  let cursor = -1
  for (const item of rewrites) {
    if (item.span!.start < cursor) {
      dropped.push({ id: item.id, kind: item.kind, reason: '改写区间与另一条 rewrite 重叠，只保留靠前的那条' })
      continue
    }
    cursor = item.span!.end
    keptRewrites.push(item)
  }
  let body = body0
  let rewrittenChars = 0
  for (let i = keptRewrites.length - 1; i >= 0; i -= 1) {
    const span = keptRewrites[i]!.span!
    body = body.slice(0, span.start) + keptRewrites[i]!.text + body.slice(span.end)
    rewrittenChars += span.end - span.start
  }

  // ── 2) 其余条目按节装桶
  const included: Record<string, OptimizeItem[]> = {}
  for (const section of SECTIONS) included[section.key] = []
  for (const item of usable) {
    if (item.kind === 'rewrite') continue
    if (included[item.kind] === undefined) continue
    included[item.kind]!.push(item)
  }

  const renderBlocks = (): string[] => {
    const blocks: string[] = []
    for (const section of SECTIONS) {
      const bucket = included[section.key] ?? []
      if (bucket.length === 0) continue
      blocks.push(`【${section.label}】\n${bucket.map(lineFor).join('\n')}`)
    }
    return blocks
  }

  const compose = (blocks: string[], removed: DroppedItem[], overBy: number): string => {
    const tail: string[] = []
    if (removed.length > 0) {
      tail.push(`【说明】因篇幅预算省略 ${removed.length} 条补全（${removed.map(d => d.kind).join('、')}）；`
        + '如果其中有用信息影响判断，请先向我确认。')
    }
    if (overBy > 0) {
      tail.push(`【预算不足】已省略全部可省略项，仍超出约 ${overBy} 字符；本轮先按下达的这些做，需要保留被省略的内容请缩小范围。`)
    }
    const head = blocks.length === 0 ? '' : `${body}\n\n${blocks.join('\n\n')}`
    if (tail.length === 0) return blocks.length === 0 ? body : head
    return head === '' ? tail.join('\n\n') : `${head}\n\n${tail.join('\n\n')}`
  }

  // ── 3) 篇幅闸门（把"省略声明"自身也算进预算，否则声明会把预算又撑破一次）
  const budget = optimizeBudgetFor(options.tier, body0.length)
  const removed: DroppedItem[] = []
  let blocks = renderBlocks()
  let overBy = 0
  let text = compose(blocks, removed, 0)
  for (let guard = 0; guard < 200; guard += 1) {
    const bare = compose(blocks, [], 0)
    overBy = bare.length > budget ? bare.length - budget : 0
    text = compose(blocks, removed, overBy)
    if (bare.length <= budget) break
    const victim = DROP_ORDER.find(key => (included[key] ?? []).length > 0)
    if (victim === undefined) break
    const taken = included[victim]!.pop()!
    removed.push({ id: taken.id, kind: taken.kind, reason: 'budget（篇幅预算）' })
    blocks = renderBlocks()
  }
  if (removed.length > 0) {
    warnings.push(`篇幅预算 ${budget} 字符：省略了 ${removed.length} 条（${removed.map(d => d.id).join('、')}）`)
  }
  if (overBy > 0) warnings.push(`装了必保节后仍超出预算约 ${overBy} 字符，已在成品里如实说明`)

  const itemCount = keptRewrites.length + SECTIONS.reduce((sum, section) => sum + (included[section.key] ?? []).length, 0)
  return {
    text,
    sections: SECTIONS.filter(section => (included[section.key] ?? []).length > 0).map(section => section.label),
    dropped: [...dropped, ...removed],
    warnings,
    chars: text.length,
    budget,
    overBudget: overBy > 0,
    overBy,
    rewrittenChars,
    itemCount,
  }
}

/** 一次完整流水线的结果。 */
export type PipelineResult =
  | {
    readonly ok: true
    /** 写回输入框的正文。 */
    readonly text: string
    /** true = 模型没按 JSON 契约输出，已按"整段照收"的旧行为兜底（成品未经依据校验）。 */
    readonly fallback: boolean
    readonly itemCount: number
    readonly dropped: readonly DroppedItem[]
    readonly warnings: readonly string[]
    readonly sections: readonly string[]
    readonly chars: number
    readonly budget: number
    readonly overBudget: boolean
    readonly rewrittenChars: number
  }
  | { readonly ok: false; readonly code: string; readonly reason: string }

/**
 * 跑完整条流水线：解析 → 逐条核对 → 装配。
 *
 * **兜底口径（两条，都是为了让"新机制"永不比旧行为更差）**：
 *   · 模型压根没按信封输出（`NO_JSON` / `NOT_ENVELOPE`）→ 按旧行为整段照收
 *     （`fallback: true`）。这条兜底保证了本次改造**不会让任何一次原本能用的优化变成失败**。
 *   · 输出**像信封但坏了**（`BAD_JSON` / `BAD_SHAPE`）→ **失败**，绝不把半截 JSON
 *     写进输入框（真机上这是最伤人的一种"优化"）。
 * @param raw - 模型原始输出。
 * @param original - 用户原话（逐字）。
 * @param options - `tier` 决定篇幅预算。
 * @returns 成品或失败原因。
 */
export function runOptimizePipeline(raw: string, original: string, options: { readonly tier: string }): PipelineResult {
  const parsed = parseOptimizeOutput(raw, original)
  if (!parsed.ok) {
    if (parsed.code === 'NO_JSON' || parsed.code === 'NOT_ENVELOPE') {
      return {
        ok: true,
        text: raw.trim(),
        fallback: true,
        itemCount: 0,
        dropped: [],
        warnings: ['模型没有按 JSON 契约输出：已按原样写回（这一轮没有做依据校验）'],
        sections: [],
        chars: raw.trim().length,
        budget: optimizeBudgetFor(options.tier, original.length),
        overBudget: false,
        rewrittenChars: 0,
      }
    }
    return { ok: false, code: parsed.code, reason: parsed.reason }
  }
  const assembled = assembleCommand(original, parsed.items, options)
  const warnings = [...parsed.warnings, ...assembled.warnings]
  if (parsed.items.length === 0 && parsed.dropped.length === 0) warnings.push('这一轮没有可核实的补全，原话原样写回')
  return {
    ok: true,
    text: assembled.text,
    fallback: false,
    itemCount: assembled.itemCount,
    dropped: [...parsed.dropped, ...assembled.dropped],
    warnings,
    sections: assembled.sections,
    chars: assembled.chars,
    budget: assembled.budget,
    overBudget: assembled.overBudget,
    rewrittenChars: assembled.rewrittenChars,
  }
}
