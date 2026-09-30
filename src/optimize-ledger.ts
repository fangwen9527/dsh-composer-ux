/**
 * 逐轮优化台账：**只记元数据，一句原文都不记**。
 *
 * 为什么要有它：优化跑完只留一句状态行（"3 条补全 · 丢弃 1 条"），过一会儿就没了。
 * 「这轮为什么长这样」——读了多少上下文、丢了哪几条、为什么丢、是不是重试过、花了多久 ——
 * 这些是排查的**唯一线索**，现在跑完就蒸发了。上游把每轮台账当一等公民（`recap.mjs`），
 * 我们照做，但**隐私上比它严一档**：他们连意图状态一起落盘，我们只落"数字与原因"。
 *
 * 隐私纪律（用户 2026-09-29 明确选中"只记元数据"）：
 *   · `LedgerInput` 里**没有任何承载用户文本的字段** —— 草稿原文、成品、逐字引文、丢弃条目的正文
 *     全都进不来；只进"字数/条数/原因/耗时"这类数字与机器生成的短串。
 *   · 于是"台账里会不会夹带原文"不是靠自觉，而是**类型上做不到**（`test/optimize-ledger.mjs`
 *     另外用"拿一段独特的话跑一遍，再 grep 台账文件"把它钉死）。
 *   · `droppedReasons` 只收 `DroppedItem.reason` —— 那些是我们自己写的固定短语（"text 是空的"），
 *     不是模型输出、更不是用户输入。
 *
 * 落盘位置：`$DSH_HOME/composer-ux/optimize-log.jsonl`（与 `quick-prompts.json` 同目录，
 * 但它**不含**任何用户文本；那个文件里存着用户自己的提示词，本来就该存）。
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { dshHome } from './quick-store.ts'

/** 台账目录名（`$DSH_HOME` 下）。 */
export const LEDGER_DIR = 'composer-ux'
/** 台账文件名。 */
export const LEDGER_FILE = 'optimize-log.jsonl'
/** 超过这个大小就从**最旧**的行开始丢（保留尾部整行，不做半行截断）。 */
export const LEDGER_MAX_BYTES = 512 * 1024

/** 允许出现在台账里的键 —— 测试拿它当白名单核对（多一个键就要有人解释它为什么不算隐私）。 */
export const LEDGER_RUN_KEYS = [
  'kind', 'at', 'sessionId', 'tier', 'provider', 'model', 'draftChars', 'contextTurns', 'contextChars',
  'items', 'dropped', 'droppedReasons', 'warnings', 'fallback', 'retried',
  'promptSource', 'ms', 'ok', 'failure',
  // 只读工具（0.13.0 ⑤）：全数字/短串，同样不含任何文件内容。
  'toolRounds', 'toolCalls', 'toolNames', 'toolCapped', 'toolFallback', 'toolRejected', 'toolError',
] as const

/** 一轮优化的元数据。注意：**每个字段都是数字、布尔、枚举或机器短串**，没有文本载体。 */
export interface LedgerRunInput {
  readonly sessionId: string
  readonly tier: string
  readonly provider: string
  readonly model: string
  /** 送去模型的那段正文的字数（不是正文）。 */
  readonly draftChars: number
  readonly contextTurns: number
  readonly contextChars: number
  readonly items: number
  readonly dropped: number
  /** 丢弃原因（我们自己写的固定短语），去重后记录。 */
  readonly droppedReasons: readonly string[]
  readonly warnings: number
  readonly fallback: boolean
  readonly retried: boolean
  readonly promptSource: string
  readonly ms: number
  readonly ok: boolean
  /** 失败时记一句**机器**原因（没有失败就不写这个键）。 */
  readonly failure?: string
  /** 只读工具这一路：跑了几轮 / 派了几次 / 派了谁（**工具名**，不是文件内容）。 */
  readonly toolRounds?: number
  readonly toolCalls?: number
  readonly toolNames?: readonly string[]
  readonly toolCapped?: boolean
  readonly toolFallback?: boolean
  readonly toolRejected?: number
  readonly toolError?: string
}

export interface LedgerRun extends LedgerRunInput {
  readonly kind: 'run'
  readonly at: string
}

/** 轮转标记：文件被瘦身过这件事本身也要留证据，否则"怎么少了几百行"无从解释。 */
export interface LedgerRotated {
  readonly kind: 'rotated'
  readonly at: string
  readonly droppedLines: number
  readonly keptLines: number
}

export type LedgerRecord = LedgerRun | LedgerRotated

/** 台账文件绝对路径。 */
export function ledgerPath(home: string = dshHome()): string {
  return join(home, LEDGER_DIR, LEDGER_FILE)
}

/**
 * 把"给人看的丢弃原因"擦成"能进台账的固定短语"。
 *
 * ⚠️ 这一条不是洁癖，是**必须**：装配层那几条原因里嵌着**模型给的**内容 ——
 *   · ``引文不是原话里的逐字片段：「${quote.slice(0, 40)}」``（引文很可能就是你原话的变体！）
 *   · ``kind 不在允许列表里（${...}）`` / ``当前档位（${tier}）不产出「${kind}」``（`kind` 也是模型给的）
 * 直接把它们写进磁盘，等于**把你的文字落盘**，而用户明确要的是"台账只记元数据、不落原文"。
 * 所以这里刮掉所有成对引号/括号里的内容（`「…」`/`“…”`/`"…"`/`'…'`/`（…）`/`(…)`），
 * 只留机器写的固定前缀 —— 台账仍然能回答"为什么丢的"，但一个字的用户内容都带不出去。
 *
 * @param reason - 给人看的原因。
 * @param max - 消毒后的长度上限（丢弃原因 60，失败原因 200）。
 * @returns 消毒后的短语。
 */
export function ledgerSafeReason(reason: string, max = 60): string {
  return String(reason ?? '')
    .replace(/「[^」]*」/g, '')
    .replace(/“[^”]*”/g, '')
    .replace(/"[^"]*"/g, '')
    .replace(/'[^']*'/g, '')
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

/** 失败原因同样要消毒（它可能带着模型/适配器的原文报错），上限放宽到 200。 */
function safeFailure(failure: string): string {
  return ledgerSafeReason(String(failure ?? ''), 200)
}

/** 把一轮的元数据拼成一条记录（纯函数：只做取值与去重，不碰磁盘）。 */
export function buildLedgerRun(input: LedgerRunInput, at: string = new Date().toISOString()): LedgerRun {
  // 失败原因可能很长（模型返回的报错），先消毒（刮掉引号里的内容）再截断：台账要能被人一眼读完，
  // 且**不能**把模型/用户的文字带进来。
  const failure = safeFailure(input.failure ?? '')
  return {
    kind: 'run',
    at,
    sessionId: input.sessionId.slice(0, 64),
    tier: input.tier,
    provider: input.provider,
    model: input.model,
    draftChars: Math.max(0, Math.trunc(input.draftChars)),
    contextTurns: Math.max(0, Math.trunc(input.contextTurns)),
    contextChars: Math.max(0, Math.trunc(input.contextChars)),
    items: Math.max(0, Math.trunc(input.items)),
    dropped: Math.max(0, Math.trunc(input.dropped)),
    // 原因先消毒再去重（见 ledgerSafeReason：那几条模板里嵌着模型给的值）。
    // ⚠️ 必须写成箭头函数：`map(ledgerSafeReason)` 会把**下标**当成第二个参数（`max`），
    // 而下标 0 会把原因整条截成空串 —— 测试当场抓住了它（"丢弃原因仍能回答为什么丢"红了）。
    droppedReasons: [...new Set(input.droppedReasons.map(reason => ledgerSafeReason(reason)).filter(reason => reason !== ''))].slice(0, 8),
    warnings: Math.max(0, Math.trunc(input.warnings)),
    fallback: input.fallback === true,
    retried: input.retried === true,
    promptSource: input.promptSource,
    ms: Math.max(0, Math.trunc(input.ms)),
    ok: input.ok === true,
    ...(failure === '' ? {} : { failure }),
    // 工具字段：只收数字/布尔/工具名；`toolError` 同样过消毒（它可能带着模型的原文报错）。
    ...(input.toolRounds === undefined ? {} : { toolRounds: Math.max(0, Math.trunc(input.toolRounds)) }),
    ...(input.toolCalls === undefined ? {} : { toolCalls: Math.max(0, Math.trunc(input.toolCalls)) }),
    ...(input.toolNames === undefined ? {} : { toolNames: [...new Set(input.toolNames.map(name => ledgerSafeReason(String(name), 24)))].filter(name => name !== '').slice(0, 8) }),
    ...(input.toolCapped === undefined ? {} : { toolCapped: input.toolCapped === true }),
    ...(input.toolFallback === undefined ? {} : { toolFallback: input.toolFallback === true }),
    ...(input.toolRejected === undefined ? {} : { toolRejected: Math.max(0, Math.trunc(input.toolRejected)) }),
    ...((input.toolError ?? '') === '' ? {} : { toolError: ledgerSafeReason(String(input.toolError), 120) }),
  }
}

/** 一行 JSONL（末尾带换行）。 */
export function ledgerLine(record: LedgerRecord): string {
  return `${JSON.stringify(record)}\n`
}

/**
 * 读台账：**逐行容错**。坏行（半截写、手工编辑写坏、编码意外）跳过并计数，
 * 不因为一行坏掉就把整份台账判成"读不出来" —— 台账是排查工具，能读多少算多少。
 */
export function readLedger(text: string): { records: LedgerRecord[]; badLines: number } {
  const records: LedgerRecord[] = []
  let badLines = 0
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '') continue
    try {
      const parsed = JSON.parse(trimmed) as LedgerRecord
      if (parsed !== null && typeof parsed === 'object' && typeof parsed.kind === 'string') records.push(parsed)
      else badLines += 1
    } catch {
      badLines += 1
    }
  }
  return { records, badLines }
}

/**
 * 瘦身：超过上限时**保留尾部**（最新的），丢掉最旧的那些整行。
 * 返回 `null` = 不需要瘦身。
 */
export function rotateLedger(text: string, maxBytes: number = LEDGER_MAX_BYTES): { text: string; droppedLines: number; keptLines: number } | null {
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) return null
  const lines = text.split('\n').filter(line => line.trim() !== '')
  // 目标是降到上限的一半，免得每次追加都要瘦一次。
  const target = Math.floor(lines.length / 2)
  const kept = lines.slice(-Math.max(1, target))
  return {
    text: kept.length === 0 ? '' : `${kept.join('\n')}\n`,
    droppedLines: lines.length - kept.length,
    keptLines: kept.length,
  }
}

/**
 * 追加一条记录（轮转 + 容错）。
 *
 * **绝不抛错**：台账是旁路，写不进去（磁盘满、权限、路径怪）只能少一条记录，
 * 绝不能让一次已经花钱跑完的优化因为记账失败而报错。
 */
export function appendLedger(record: LedgerRecord, file: string = ledgerPath()): { written: boolean; rotated: boolean } {
  try {
    mkdirSync(dirname(file), { recursive: true })
    const line = ledgerLine(record)
    let rotated = false
    if (existsSync(file)) {
      const current = readFileSync(file, 'utf8')
      const slim = rotateLedger(current, LEDGER_MAX_BYTES - Buffer.byteLength(line, 'utf8'))
      if (slim !== null) {
        // 原子替换：临时文件 → rename（半份台账比少几行更糟）。
        const tmp = `${file}.tmp-${process.pid}`
        writeFileSync(tmp, slim.text)
        renameSync(tmp, file)
        rotated = true
        appendFileSync(file, ledgerLine({
          kind: 'rotated',
          at: new Date().toISOString(),
          droppedLines: slim.droppedLines,
          keptLines: slim.keptLines,
        }))
      }
    }
    appendFileSync(file, line)
    return { written: true, rotated }
  } catch {
    return { written: false, rotated: false }
  }
}

/** 清空台账（设置页/CLI 的"一键清空"）。文件不存在也算成功。 */
export function clearLedger(file: string = ledgerPath()): boolean {
  try {
    if (existsSync(file)) unlinkSync(file)
    return true
  } catch {
    // 删不掉就退一步：写空（至少内容没了）。
    try {
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, '')
      return true
    } catch {
      return false
    }
  }
}

/** 台账的统计摘要（给 recap 用；纯函数）。 */
export function summarizeLedger(records: readonly LedgerRecord[]): {
  runs: number
  ok: number
  failed: number
  items: number
  dropped: number
  medianMs: number
  tiers: Record<string, number>
} {
  const runs = records.filter((record): record is LedgerRun => record.kind === 'run')
  const durations = runs.map(run => run.ms).sort((a, b) => a - b)
  const tiers: Record<string, number> = {}
  for (const run of runs) tiers[run.tier] = (tiers[run.tier] ?? 0) + 1
  return {
    runs: runs.length,
    ok: runs.filter(run => run.ok).length,
    failed: runs.filter(run => !run.ok).length,
    items: runs.reduce((sum, run) => sum + run.items, 0),
    dropped: runs.reduce((sum, run) => sum + run.dropped, 0),
    medianMs: durations.length === 0 ? 0 : durations[Math.floor(durations.length / 2)],
    tiers,
  }
}
