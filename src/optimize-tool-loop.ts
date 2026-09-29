/**
 * 优化器的**工具循环**（0.13.0 ⑤）：带上 read/glob/grep 跑模型，收到工具调用就执行、
 * 把结果作为 `role:'tool'` 消息回给模型，直到它给出最终 JSON 或触顶。
 *
 * 为什么单独一个文件：这条循环有一堆容易写错的地方（工具结果的**消息形状**、轮次/次数/时限三重封顶、
 * 任何异常都必须能回落到"不带工具的单次调用"），把依赖注入进来就能用假 llm 在 node 里逐例钉住。
 *
 * 上游 0.7.8 用真机事故换来的四条教训，这里全部照抄：
 *  1. **工具路径绝不该有能力把整轮弄死**：真机实测里开着工具时解释步骤 7 毫秒就抛了，
 *     连模型都没调上 ⇒ 整轮 no-packet。所以这里任何抛出都返回 `failure`，由调用方回落。
 *  2. **模型常给散文而不是 JSON**：查完文件后它爱写"我看过 xxx，所以建议……"。
 *     所以"产出像不像那份 JSON"由调用方判（这里只如实把文本交出去）。
 *  3. **回落必须换掉系统提示词**：开着工具时系统提示里带着"你可以调工具"的整段说明，
 *     回落那次要换成不带它的版本（否则模型还在等着调工具）。
 *  4. **不谎报**：回落时把**真实发生过**的轮次/次数交出去 —— 那几次调用是真花了钱的。
 */
import { READ_TOOL_SCHEMAS, parseToolArguments, runReadToolByName, TOOL_MAX_CALLS_PER_ROUND, TOOL_MAX_ROUNDS, TOOL_TOTAL_TIMEOUT_MS } from './optimize-tools.ts'

/** 依赖（注入的 llm 与配置；不 import 宿主模块，便于用假 llm 测）。 */
export interface ToolLoopDeps {
  readonly llm: { stream: (options: Record<string, unknown>) => AsyncIterable<Record<string, unknown>> }
  readonly provider: string
  readonly model: string
  /** 开着工具的系统提示词（含只读查证说明）。 */
  readonly system: string
  readonly userText: string
  /** 会话工作目录的绝对路径（围栏的根）。 */
  readonly root: string
  readonly signal?: AbortSignal
  readonly onDelta?: (out: string, delta: string) => void
  /** 单轮文本上限（防模型啰嗦到把预算烧光）。 */
  readonly maxChars?: number
  readonly temperature?: number
  readonly reasoningEffort?: string
}

/** 循环结果（`meta` 全是数字/短串，可直接进台账）。 */
export interface ToolLoopOutcome {
  readonly out: string
  readonly failure: string
  readonly rounds: number
  readonly calls: number
  readonly names: readonly string[]
  /** 触到轮次/时限上限（如实标注，不假装查全了）。 */
  readonly capped: boolean
  /** 被围栏拒绝的次数（越界、超大小、不认识的工具）。 */
  readonly rejected: number
  readonly elapsedMs: number
}

/** 从流里收集出来的一次工具调用。 */
interface PendingCall {
  id: string
  name: string
  args: string
}

const freezeMessages = (messages: unknown[]): unknown[] => messages

/**
 * 跑一次"带只读工具"的优化调用。
 *
 * @param deps - 依赖与配置。
 * @returns 结果（`failure` 非空表示这一路失败，调用方应回落到无工具路径）。
 */
export async function runOptimizeToolLoop(deps: ToolLoopDeps): Promise<ToolLoopOutcome> {
  const started = Date.now()
  const maxChars = deps.maxChars ?? 48_000
  const messages: unknown[] = [{
    id: `optimize-${started.toString(36)}`,
    role: 'user',
    content: [{ type: 'text', text: deps.userText }],
    source: { kind: 'user' },
  }]
  const names: string[] = []
  let calls = 0
  let rejected = 0
  let rounds = 0
  let capped = false
  let out = ''
  let failure = ''

  for (let round = 1; round <= TOOL_MAX_ROUNDS; round += 1) {
    if (Date.now() - started > TOOL_TOTAL_TIMEOUT_MS) {
      capped = true
      break
    }
    rounds = round
    let text = ''
    const pending = new Map<number, PendingCall>()
    try {
      const stream = deps.llm.stream({
        provider: deps.provider,
        model: deps.model,
        system: deps.system,
        ...(deps.temperature === undefined ? {} : { temperature: deps.temperature }),
        ...(deps.reasoningEffort === undefined || deps.reasoningEffort === '' ? {} : { reasoningEffort: deps.reasoningEffort }),
        tools: READ_TOOL_SCHEMAS,
        ...(deps.signal === undefined ? {} : { signal: deps.signal }),
        messages: freezeMessages(messages),
      })
      for await (const chunk of stream) {
        if (chunk.type === 'text-delta') {
          const delta = String(chunk.text ?? '')
          text += delta
          deps.onDelta?.(text, delta)
          if (text.length > maxChars) break
        } else if (chunk.type === 'tool-call-delta') {
          const index = Number(chunk.index ?? 0)
          const current = pending.get(index) ?? { id: '', name: '', args: '' }
          if (typeof chunk.id === 'string' && chunk.id !== '') current.id = chunk.id
          if (typeof chunk.name === 'string' && chunk.name !== '') current.name = chunk.name
          current.args += String(chunk.argumentsDelta ?? '')
          pending.set(index, current)
        } else if (chunk.type === 'block-end') {
          // 收尾的块是权威形状：有它就以它为准（deltas 可能有缺字段）。
          const block = chunk.block as Record<string, unknown> | undefined
          if (block !== undefined && block.type === 'tool-call') {
            const index = Number(chunk.index ?? 0)
            pending.set(index, {
              id: String(block.id ?? ''),
              name: String(block.name ?? ''),
              args: String(block.arguments ?? ''),
            })
          }
        } else if (chunk.type === 'finish') {
          const reason = (typeof chunk.reason === 'object' && chunk.reason !== null ? chunk.reason : {}) as Record<string, unknown>
          if (reason.kind === 'error' || reason.kind === 'aborted') {
            const detail = (typeof reason.failure === 'object' && reason.failure !== null ? reason.failure : {}) as Record<string, unknown>
            failure = String(detail.message ?? (reason.kind === 'aborted' ? '优化被中断' : '模型返回错误'))
          }
        }
      }
    } catch (error: unknown) {
      // 异常一律降级成"这一路失败"，由调用方回落；绝不让工具路径把整轮弄死。
      return {
        out,
        failure: error instanceof Error ? error.message : String(error),
        rounds,
        calls,
        names,
        capped,
        rejected,
        elapsedMs: Date.now() - started,
      }
    }
    out = text
    if (failure !== '') break

    const ordered = [...pending.entries()].sort(([a], [b]) => a - b).map(([, call]) => call).filter(call => call.name !== '')
    if (ordered.length === 0) break // 没有工具调用了：这一轮的文本就是最终产出
    if (round >= TOOL_MAX_ROUNDS) {
      capped = true
      break
    }

    // 1) 回放助手消息（含它请求的工具调用），否则工具结果没有可对应的发起方。
    //    只声明**这次真的会执行**的那几次：如果声明了却不回答，适配器/服务端会因为
    //    "tool_call 没有对应结果"而整轮报错 —— 那正是"工具路径不该有能力弄死整轮"的反面。
    if (ordered.length > TOOL_MAX_CALLS_PER_ROUND) capped = true
    const batch = ordered.slice(0, TOOL_MAX_CALLS_PER_ROUND)
    messages.push({
      id: `optimize-assistant-${round}-${started.toString(36)}`,
      role: 'assistant',
      source: { kind: 'model', provider: deps.provider, model: deps.model },
      content: [
        ...(text === '' ? [] : [{ type: 'text', text }]),
        ...batch.map(call => ({ type: 'tool-call', id: call.id, name: call.name, arguments: call.args })),
      ],
    })

    // 2) 执行（每次调用都过围栏与上限），并把结果作为 role:'tool' 消息回给模型。
    for (const call of batch) {
      if (calls >= TOOL_MAX_CALLS_PER_ROUND * TOOL_MAX_ROUNDS) {
        capped = true
        break
      }
      calls += 1
      names.push(call.name)
      const parsed = parseToolArguments(call.args)
      const result = parsed.error === undefined
        ? runReadToolByName(deps.root, call.name, parsed.args)
        : {
          text: `拒绝：工具参数不是合法 JSON（${parsed.error}）`,
          isError: true,
          meta: { tool: call.name, files: 0, hits: 0, bytes: 0, rejected: '参数不是合法 JSON' as string | undefined },
        }
      if (result.meta.rejected !== undefined) rejected += 1
      messages.push({
        id: `optimize-tool-${round}-${calls}-${started.toString(36)}`,
        role: 'tool',
        source: { kind: 'tool', callId: call.id },
        toolCallId: call.id,
        content: [{ type: 'text', text: result.text }],
        ...(result.isError ? { isError: true } : {}),
      })
    }
  }

  return { out, failure, rounds, calls, names, capped, rejected, elapsedMs: Date.now() - started }
}
