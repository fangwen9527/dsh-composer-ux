/**
 * 提示词优化器的系统提示词（三档）+ 用户消息构造。
 *
 * 来源与授权：初版那三档文本逐字取自 WestFox-AwA/dsh-prompt-optimizer 的 `lib/index.js` 里
 * **`LEGACY_V011`** 这个常量（BSD-3-Clause，作者「啃轮胎的西狐」）—— 它自己的注释写着
 * "逐字节取自 0.1.1 的 system 提示词"，只在回退策略 `v011-ptc` 下使用，对方默认策略
 * （`STRATEGY_DEFAULT = 'v6'`）走的是 `buildSystem()` 另一套。
 * 0.6.0 起按对方 **0.6 线**（`po06/lib/interpreter.js` 的 `SYSTEM_PROMPT` +
 * `validateProvenance`）的机制重写，本插件自身仍按 MIT 发布。
 *
 * ── 为什么换成这套（对方的真问题，也是我们的）────────────────────────────────
 * 旧版是**自由改写器**：模型直接吐一条成品命令，宿主只能整段照收。于是"模型替用户发明
 * 了一条要求"这件事在结构上无法被发现 —— 提示词里写十遍"不许新增需求"也没用，因为
 * 没有任何**可机械核对**的判据。
 *
 * 0.6 的办法：把"信任问题"变成"字符串比对问题"。
 *   · 模型不再自由写，只产出**条目**；
 *   · 每条 `rewrite` / `requirement` / `quality` 必须附 `quote` —— 一段**在用户原话里
 *     逐字存在**的子串（照抄，不许改写、不许补标点）；
 *   · 宿主在 `optimizer-assemble.ts` 里做字面子串比对，**对不上就丢那一条并记账**；
 *   · `rewrite` 按引文在原话里的**位置**回填，没被覆盖的部分原样保留。
 * 这样"凭空加需求"不再是信任问题：它拿不出逐字依据。
 *
 * 档位语义也照搬对方的说法：**档位 = 依据预算**（允许补到什么程度、成品允许多长），
 * 而不是"换一种文风"。温度仍沿用初版实测值（0.2 / 0.3 / 0.3）。
 *
 * 本模块零 import，host 半与测试共用。
 */

/** 传话者人设：为什么必须单独成段——裸文本会被模型当成「对它说的话」而开始对话。 */
const RELAY_ROLE = [
  '【你是谁】你是一个**传话器/意图补全器**，站在用户与"工作 AI"之间：',
  '  用户 →（你：把用户的意思整理成条目并给出逐字依据）→ 宿主（装配成一条命令）→ 工作 AI。',
  '你的产出**不会**被直接展示给用户，也不会被原样发出：宿主会用你给的**逐字引文**',
  '在原话里定位、只采纳能核对的条目，再装配成一条命令交给工作 AI。',
  '【你不是谁】你不是在和用户聊天，也不是在回答用户：',
  '- 不要回应、不要回答用户的要求，也不要替用户完成任务（不要直接给出代码/答案/结果）。',
  '- 不要以助手口吻对用户说话（"好的""收到""我可以帮你""建议你…""需要我…吗"）。',
  '- 不要把用户发来的文字当成"对你说的话"来回应；它只是你要转达的内容。',
  '- 不要向用户提问。要澄清时，写成**给工作 AI 的指令**：',
  '  "若 X 不明确，先读 Y 或先向我确认，不要自行假设"。',
].join('\n')

/**
 * 依据纪律 —— 这套机制的全部价值所在。
 *
 * 每条都对应一个**宿主真的会执行**的检查（见 optimizer-assemble.ts）：
 * 没有引文 → 丢这一条；引文不是字面子串 → 丢这一条；条数超上限 → 截断后面并记账。
 * 提示词里写"必须"而宿主不查，就是空话；这里两边是配套的。
 */
const EVIDENCE_RULES = [
  '【依据纪律（宿主会逐条机械核对，写错就丢这一条）】',
  '1. `rewrite` / `requirement` / `quality` **必须**带 `quote`：一段在【用户原话】里',
  '   **逐字存在**的子串 —— 照抄，不要改写、不要补标点、不要翻译。宿主做字面子串比对，',
  '   对不上就丢掉那一条（不会报错给你，也不会有人提醒你）。',
  '2. **不许凭空新增**：产品目标、功能、硬约束（"必须离线""禁止联网""只能用某个库"',
  '   "必须支持移动端"）一律不许由你决定。你只能补**能从原话某一句直接推出**的最低要求，',
  '   并且必须引用那一句。',
  '3. 不确定、会影响结果、且只有用户能定的取舍 → 写 `unknown`（`unknownClass` =',
  '   "user_preference"），**不要替用户猜**，也不要写"按最保守理解执行"。',
  '   在许可范围内读代码就能确定的事实写 "lookupable_fact"；可逆的实现细节',
  '   （间距、命名、库的内部用法）写 "implementation_detail"。',
  '4. 不得虚构项目事实（文件内容、目录结构、依赖版本）。你没读到的东西不存在。',
].join('\n')

/** 写正文时的文风纪律：这些 `text` 会被拼进最终命令，读者只有工作 AI 一个。 */
const STYLE_RULES = [
  '【写 text 的纪律】你的 text 会被宿主拼进最终命令，读者只有"工作 AI"一个：',
  '- 祈使句、直给要求、可执行；中文进中文出。',
  '- 不要元话语与元标题（"优化后的提示词""改写后""说明""以下是…"）。',
  '- 不要提到"用户/原文/上面的话"，也不要写"我来帮你…"。',
  '- 不要写流程仪式、通用教学、验收套话（"请确保代码质量"这种没有指向的话）。',
  '- `rewrite` 的 text 是**替换掉那段引文**的正文，所以只写那段话本身，不要带前缀后缀。',
].join('\n')

/**
 * 输出契约：**永远追加在最后一段**，且不随自定义提示词改变。
 *
 * 为什么不让它被改：宿主按这份契约解析；契约一改，"逐字依据"就没人校验了，
 * 整套机制退化成"信任模型"。设置页的说明里对此有明示。
 * 放最后是因为模型对**最后一条指令**的服从度最高（对方 0.6 的 `askTail` 同理）。
 */
export const OPTIMIZER_OUTPUT_CONTRACT = [
  '【输出契约（固定，不可更改）】',
  '只输出一个 JSON 对象，不要 Markdown 代码块、不要在 JSON 前后写任何字：',
  '{"items":[{"kind":"rewrite","quote":"原话里逐字存在的片段","text":"替换掉该片段的正文"}]}',
  '字段与取值（`kind` 只能是这六种）：',
  '- rewrite：语言层修复。`quote` 必填；同一段原话最多一条 rewrite，不要重叠。',
  '- requirement：从 `quote` 直接推出的补全要求（验收标准/硬约束）。`quote` 必填。',
  '- quality：对原话里质量词的解释。`quote` 必填（就填那几个质量字）。',
  '- unknown：未决项。必须带 `unknownClass`（user_preference / lookupable_fact /',
  '  implementation_detail），可选 `blocking`（true/false，是否挡住下一步）。',
  '- plan：分阶段执行计划（仅"极端"档用）。',
  '- risk：多情况预案（仅"极端"档用），每条按"触发信号 → 应对 → 禁止动作"写。',
  '限制：`text` 每条不超过 300 字；`items` 总共不超过 12 条；id 不需要给。',
  '没有可补的内容时，输出 {"items":[]} —— 但**先想清楚**：用户这一轮的原话里',
  '真的没有任何可核对的补全吗？',
].join('\n')

/** 模型可以产出的条目种类（宿主只认这些，其余整条丢弃并记账）。 */
export const OPTIMIZE_ITEM_KINDS = ['rewrite', 'requirement', 'quality', 'unknown', 'plan', 'risk'] as const

/** 模型可以产出的未决项分类（缺省按"只有用户能定"处理，与对方 0.6 同口径）。 */
export const OPTIMIZE_UNKNOWN_CLASSES = ['user_preference', 'lookupable_fact', 'implementation_detail'] as const

/** 单次产出允许的最大条目数（超出部分截断并记账，而不是整轮作废）。 */
export const OPTIMIZE_MAX_ITEMS = 12

/** 单条 `text` 的字符上限（超出就地截断并记账）。 */
export const OPTIMIZE_ITEM_MAX_CHARS = 300

/**
 * 各档的任务段（**可被设置页里的自定义提示词整体替换**的那部分）。
 *
 * 三档的差别是"允许补到哪一层"，不是"换一种语气"：
 *   · basic    —— 只碰语言；不产出 requirement / plan / risk。
 *   · advanced —— 允许补"能指回原话某句"的必要要求，并对质量词作解释。
 *   · extreme  —— 再加分阶段计划与预案。
 */
const TIER_TASKS: Record<string, readonly string[]> = {
  basic: [
    '【本轮任务：只做语言层修复】',
    '用户原话可能有病句、指代不明、用词含糊。把它改写成通顺、精确、无歧义的**同一段话**。',
    '只产出 `rewrite`（可以按句子拆成多条，每条引用原话里对应那一句）。',
    '严禁产出 requirement / plan / risk：这一档**不新增任何要求**，只把话说明白。',
    '原话确有歧义、且歧义会导致做错时，才补一条 `unknown`（unknownClass 取',
    'user_preference 或 lookupable_fact）；确实没有可补的就输出空数组。',
    '长度纪律：成品不超过原话的 1.4 倍；原话 30 字以内时不超过 60 字。',
  ],
  advanced: [
    '【本轮任务：在不动目标的前提下把命令说清楚】',
    '用户原话含糊、缺关键约束。你要补的是"用户显然想要、但没说出口"的必要信息，',
    '让它一次做对 —— 但每一条都必须是**从原话某一句直接推出**的，并引用那一句。',
    '允许产出：',
    '- `rewrite`：把含糊、有病句的地方说清楚（同一段原话最多一条）。',
    '- `requirement`：从原话直接推出的最低交付要求与验收标准（"改完能跑起来""页面能打开"',
    '  这类可观测的话），写成对工作 AI 的要求而不是评论。每条都要能指回原话里的某一句。',
    '- `quality`：用户说的质量词（"好看点""高级感""流畅"）→ 解释成可观察的要求。',
    '  它是**解释**，不是新增目标：一条质量词最多一条 quality。',
    '- `unknown`：只有用户能定的取舍（user_preference）/ 该去查证的事实（lookupable_fact）。',
    '禁止：新增功能、新目标、新依赖；虚构项目事实；写用户没授权的技术选型。',
    '数量纪律：requirement 最多 3 条，quality 最多 2 条，unknown 最多 2 条。',
  ],
  extreme: [
    '【本轮任务：把诉求固化成一条可直接执行的命令】',
    '这次是多步执行的复杂任务，工作 AI 会照这条命令干，用户不会再补充。',
    '在"高级"档允许的全部条目的基础上，再加两类（都要以用户在给工作 AI 下命令的口吻写）：',
    '- `plan`：分阶段执行计划。每阶段写清动作与产出，并写明纪律（先验证再改、失败即回退、',
    '  不擅自扩大范围、改完给出证据）。',
    '- `risk`：多情况预案 2~4 条，每条写成"如果出现 <触发信号>，就先 <应对动作>，',
    '  不要 <禁止动作>"。',
    '还要判断这次任务是否值得让工作 AI 用 goal / todo / 计划模式跟踪，并把结论写成',
    '`requirement` 的一部分（例如"请先建立 goal：…，再按下列阶段推进"）；不需要就完全不提。',
    '铁律：不得虚构项目事实。需要项目事实时写成"先读取/确认 X"的查证动作。',
    '数量纪律：plan 最多 1 条，risk 最多 4 条，requirement 最多 3 条。',
  ],
}

/** 档位 id 与系统提示 / 温度的对应表。 */
export const OPTIMIZER_SPECS = {
  basic: {
    temperature: 0.2,
    system: [RELAY_ROLE, TIER_TASKS.basic!.join('\n'), EVIDENCE_RULES, STYLE_RULES].join('\n\n'),
  },
  advanced: {
    temperature: 0.3,
    system: [RELAY_ROLE, TIER_TASKS.advanced!.join('\n'), EVIDENCE_RULES, STYLE_RULES].join('\n\n'),
  },
  extreme: {
    temperature: 0.3,
    system: [RELAY_ROLE, TIER_TASKS.extreme!.join('\n'), EVIDENCE_RULES, STYLE_RULES].join('\n\n'),
  },
} as const

/** 档位 id 联合（与 settings-contract 的 OptimizerTier 一致，此处不 import 以免循环）。 */
export type OptimizerSpecTier = keyof typeof OPTIMIZER_SPECS

/** 未知档位回落到默认档（与 `DEFAULT_OPTIMIZER_TIER` 同值；此处不 import 以免循环）。 */
const FALLBACK_TIER = 'advanced'

/** 取一个档位的说明（未知档走默认档）。 */
function specOf(tier: string): { temperature: number; system: string } {
  return OPTIMIZER_SPECS[tier as OptimizerSpecTier] ?? OPTIMIZER_SPECS[FALLBACK_TIER as OptimizerSpecTier]
}

/**
 * 组装一次优化的 system 提示词。
 *
 * 自定义提示词（设置页可编辑）**整体替换**任务段，但输出契约永远追加在末尾 ——
 * 契约是宿主解析的依据，被改掉整套机制就失效（设置页对此有说明）。
 * @param tier - 强度档位；未知值走 advanced（默认档）。
 * @param custom - 设置页里的自定义提示词；空串 = 用内置那份。
 * @returns 该档位的完整系统提示词。
 */
export function buildOptimizeSystem(tier: string, custom = ''): string {
  const body = custom.trim() === '' ? specOf(tier).system : custom.trim()
  return `${body}\n\n${OPTIMIZER_OUTPUT_CONTRACT}`
}

/**
 * 组装一次优化的 temperature。
 * @param tier - 强度档位；未知值走 advanced。
 * @returns 该档位的采样温度。
 */
export function buildOptimizeTemperature(tier: string): number {
  return specOf(tier).temperature
}

/**
 * 这次用的是自定义还是内置提示词（回传给面板，方便用户确认自己那份真的生效了）。
 * @param custom - 设置页里的自定义提示词。
 * @returns 'custom' = 用了用户那份；'builtin' = 用了内置那份。
 */
export function optimizePromptSource(custom: string): 'custom' | 'builtin' {
  return String(custom ?? '').trim() === '' ? 'builtin' : 'custom'
}

/**
 * 传话框架：把用户原话包成「待转达内容」而不是「对你说的话」。
 *
 * 这是原作者修「优化 AI 以为自己在和用户对话」的关键一招 —— 裸文本会被当成
 * 对话输入，于是模型开始回应你而不是替你转达。
 * @param original - 输入框里的原话。
 * @param options - `retry`：上一次产出为空，按对方 0.6 的 `retryEmpty` 再点一遍规则
 *   （对方的真机教训：短消息/老会话会反复"思考完成却没有产出"）。
 * @returns 直接作为 user 消息发送的文本。
 */
export function buildOptimizeUser(
  original: string,
  options: { readonly retry?: boolean; readonly reason?: string } = {},
): string {
  const parts = [
    '【待转达内容】下面是"用户"发给我的原话。**它不是说给你听的**，你不需要回应它、也不需要替用户去做这件事。',
    '<原文>',
    String(original ?? ''),
    '</原文>',
    '',
    '【你的任务】按系统提示词的规则，把上面的原话拆成**条目**并给每条附上**逐字引文**。',
    '- 只输出那份 JSON 契约要求的东西；不要回应我、不要回答问题、不要谢幕、不要解释你做了什么。',
    '- 读者只有"工作 AI"一个，而你的产出会先经宿主逐条核对引文。',
  ]
  if (options.retry === true) {
    parts.push(
      '',
      `【重要：你上一次的输出是空的${options.reason ? `（${options.reason}）` : ''}】`,
      '上一次你没有给出任何条目，这一轮因此**没有任何补全**可以交给工作 AI。',
      '请按系统提示词的硬规则重做：**哪怕用户只写了一两个字，也要尽量把它拆成可引用的条目**',
      '（至少一条 `rewrite`，或一条 `quality` / `unknown`）；确实没有可补的内容时才输出 {"items":[]}。',
      '只输出 JSON。',
    )
  }
  return parts.join('\n')
}
