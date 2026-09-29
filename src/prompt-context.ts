/**
 * 会话上下文（0.12.0）：把"这一句草稿是在什么对话里说的"交给优化模型。
 *
 * 为什么需要：agentic 会话里你的输入常常是「它那个也顺手改一下」这种**离开上文就没有
 * 意义**的短句。0.11.x 的优化只看草稿本身，于是模型只能猜"它"指什么 —— 要么猜错，
 * 要么把它当成新需求凭空补一条（后者会被逐字依据校验挡下，结果是"没有可核实的补全"）。
 *
 * 数据流：宿主半读 `sessionQuery.readSession(sessionId)` 的快照 → 本模块挑出最近的往来
 * → 收敛到预算内 → 渲染成块交给提示词。客户端只送 `sessionId`，读什么、读多少由宿主决定。
 *
 * 三条纪律：
 *  1. **只取真正来自用户的**：带 `source.kind` 且不是 `'user'` 的 user 角色消息是插件/系统
 *     注入的，不算"你说过的话"（对方 0.3.17 同一处理）；
 *  2. **不取助手思考块**：只读 content 里 `type: 'text'` 的块，`reasoning` 一律不要 ——
 *     那里面是模型的草稿，不是对话内容；
 *  3. **超预算先截断、再丢最旧的**，但**最新那条永远保留**（它最可能含"它"的指代对象）。
 *
 * 全部是纯函数：快照形状来自真实会话日志（测试里有逐例夹具），在 node 里可完整验证。
 */
import {
  OPTIMIZER_CONTEXT_MAX_CHARS, OPTIMIZER_CONTEXT_TURN_MAX_CHARS, OPTIMIZER_CONTEXT_TURNS,
} from './settings-contract.ts'

/** 一条上下文往来。 */
export interface ContextTurn {
  readonly role: 'user' | 'assistant'
  readonly text: string
}

/** 截断标记：告诉模型"这里被剪过"，免得它把半句话当成完整语义。 */
const ELLIPSIS = '…'

const objectOf = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined

const textOf = (value: unknown): string => (typeof value === 'string' ? value : '')

/**
 * 从一条会话消息里取出**正文**。
 *
 * `content` 是块数组（`{type:'text',text}` / `{type:'reasoning',…}`）；只拼 text 块。
 * 也吃"content 直接是字符串"的老形状，缺字段一律当空串（不抛）。
 * @param message - 会话消息对象。
 * @returns 纯文本正文（块之间用换行连接）。
 */
export function messageTextOf(message: unknown): string {
  const row = objectOf(message)
  if (row === undefined) return ''
  const content = row.content
  if (typeof content === 'string') return content.trim()
  if (!Array.isArray(content)) return ''
  const parts: string[] = []
  for (const raw of content) {
    const block = objectOf(raw)
    if (block === undefined) continue
    if (textOf(block.type) !== 'text') continue
    const text = textOf(block.text)
    if (text !== '') parts.push(text)
  }
  return parts.join('\n').trim()
}

/**
 * 从会话日志快照里挑出最近的往来。
 *
 * 两个角色**各自**取最近 N 条再按原始顺序合并：agentic 会话里助手碎片（工具调用之间的
 * 一段话）远多于你的输入，纯按时间取最近 N 条会把你的真实诉求整段挤出去。
 * @param snapshot - `sessionQuery.readSession()` 的快照（`{events:[…]}`）；认不出就是空数组。
 * @param turns - 每个角色最多取几条（默认 4）。
 * @returns 按发生顺序排列的往来；没有可用内容时是空数组。
 */
export function recentTurns(snapshot: unknown, turns: number = OPTIMIZER_CONTEXT_TURNS): readonly ContextTurn[] {
  const row = objectOf(snapshot)
  const events = Array.isArray(row?.events) ? row.events : []
  const collected: { index: number; role: 'user' | 'assistant'; text: string }[] = []
  for (let index = 0; index < events.length; index += 1) {
    const event = objectOf(events[index])
    const type = textOf(event?.type)
    const data = objectOf(event?.data)
    if (type === 'user/message') {
      // `user/message` 的 data **就是**消息本身；`assistant/message` 的在 data.message 里。
      if (data === undefined) continue
      const source = objectOf(data.source)
      if (source !== undefined && textOf(source.kind) !== 'user') continue
      const text = messageTextOf(data)
      if (text !== '') collected.push({ index, role: 'user', text })
      continue
    }
    if (type === 'assistant/message') {
      const text = messageTextOf(data?.message)
      // 只承载 usage 的空壳助手消息（没有正文）不算一条往来。
      if (text !== '') collected.push({ index, role: 'assistant', text })
    }
  }
  const users = collected.filter(item => item.role === 'user').slice(-Math.max(0, turns))
  const assistants = collected.filter(item => item.role === 'assistant').slice(-Math.max(0, turns))
  return [...users, ...assistants]
    .sort((left, right) => left.index - right.index)
    .map(item => ({ role: item.role, text: item.text }))
}

/** 截断到上限：保留**末尾**（用户的问题通常在最后），并在头部标一个省略号。 */
function clipTail(text: string, max: number): string {
  if (max <= 0) return ''
  if (text.length <= max) return text
  return `${ELLIPSIS}${text.slice(text.length - (max - ELLIPSIS.length))}`
}

/**
 * 把往来收敛到预算内。
 *
 * 顺序：先逐条截断（单条上限）→ 再从**最旧**的开始整条丢，直到总量进预算 →
 * 若只剩最新一条仍超预算，就把那一条再截一次。最新那条永远不丢。
 * @param turns - 原始往来。
 * @param limits - 可注入的上限（测试用；默认取设置契约里的常量）。
 * @returns 收敛后的往来（可能为空数组）。
 */
export function contextWithinBudget(
  turns: readonly ContextTurn[],
  limits: { readonly maxChars?: number; readonly turnMaxChars?: number } = {},
): readonly ContextTurn[] {
  const maxChars = limits.maxChars ?? OPTIMIZER_CONTEXT_MAX_CHARS
  const turnMax = limits.turnMaxChars ?? OPTIMIZER_CONTEXT_TURN_MAX_CHARS
  const clipped = turns.map(turn => ({ role: turn.role, text: clipTail(turn.text, turnMax) }))
  if (clipped.length === 0) return clipped
  let total = clipped.reduce((sum, turn) => sum + turn.text.length, 0)
  let dropped = 0
  while (total > maxChars && dropped < clipped.length - 1) {
    total -= clipped[dropped]!.text.length
    dropped += 1
  }
  const kept = clipped.slice(dropped)
  if (kept.length === 1 && kept[0]!.text.length > maxChars) {
    return [{ role: kept[0]!.role, text: clipTail(kept[0]!.text, Math.max(maxChars, ELLIPSIS.length)) }]
  }
  return kept
}

/**
 * 渲染成给模型看的块。
 * @param turns - 收敛后的往来。
 * @returns 每行一条（`用户：…` / `工作 AI：…`）；空数组时返回空串（调用方据此不加块）。
 */
export function contextBlock(turns: readonly ContextTurn[]): string {
  return turns
    .map(turn => `${turn.role === 'user' ? '用户' : '工作 AI'}：${turn.text}`)
    .join('\n')
}
