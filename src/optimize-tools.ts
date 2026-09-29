/**
 * 优化器的**只读查证工具**（0.13.0 ⑤）：让解释层能读项目里的实际内容再下结论。
 *
 * 为什么要它：草稿里常说"改这个文件里的东西""按现在的写法来" —— 模型只能猜。
 * 有了 `read`/`glob`/`grep`，它至少在**限定会话工作目录内、只读、有上限**的前提下能查一下实际内容。
 *
 * 五条纪律（照抄上游 0.7.8 用真机事故换来的教训 + 我们自己的隐私口径）：
 *  1. **默认关**。工具轮次要花时间与 token，不替用户决定放大成本（上游 0.5 默认开，0.6 改成默认关）。
 *  2. **围栏**：一切路径都必须落在本会话工作目录内 —— `realpath` 之后再比前缀，
 *     所以符号链接也逃不出去；越界**拒绝并记账**，不静默截断成"目录下的同名文件"。
 *  3. **只读**：只 `readdir/stat/readFile`，一个写调用都没有；不执行任何东西。
 *  4. **上限**：单文件 200KB / 单次结果 4000 字 / 遍历 400 文件 / glob 50 命中 / grep 40 命中 /
 *     深度 6 / 每轮 ≤3 次调用 / 总 ≤3 轮 / 总时限 20 秒。超限**如实标注**，不假装查全了。
 *  5. **工具内容不能当引文**：`rewrite`/`requirement`/`quality` 的 `quote` 必须是**用户原话**的逐字片段
 *     （我们装配层就是这么校验的），所以从文件里读到的东西只能用来**消歧义**，不能冒充"你说过的话"。
 *     这条写进了 {@link READ_TOOLS_SYSTEM_NOTE}，模型若违反，装配层会照旧逐条丢弃。
 */
import { existsSync, readdirSync, readFileSync, realpathSync, statSync, type Dirent } from 'node:fs'
import { basename, dirname, join, resolve, sep } from 'node:path'

/** 单文件读取上限（超过直接拒绝，不做"读一半"）。 */
export const TOOL_MAX_FILE_BYTES = 200 * 1024
/** 单次工具结果的字数上限（喂回模型的文本，太长会把草稿挤出上下文）。 */
export const TOOL_MAX_RESULT_CHARS = 4_000
/** 一次遍历最多看多少个文件（防 `glob **` 在大仓库里跑飞）。 */
export const TOOL_MAX_FILES = 400
export const TOOL_MAX_GLOB_HITS = 50
export const TOOL_MAX_GREP_HITS = 40
export const TOOL_MAX_DEPTH = 6
/** 每轮最多几次工具调用。 */
export const TOOL_MAX_CALLS_PER_ROUND = 3
/** 总轮次上限（含第一轮）：3 轮 = 最多两次"查证后再答"。 */
export const TOOL_MAX_ROUNDS = 3
/** 工具环节的总时限：到点就停，带着已有信息继续（而不是把整轮拖死）。 */
export const TOOL_TOTAL_TIMEOUT_MS = 20_000

/** 遍历时跳过的目录（点目录一并跳过：它们是配置/缓存，不是"项目里的东西"）。 */
const SKIP_DIRS = new Set(['node_modules', '.git', '.svn', '.hg', 'dist', 'build', 'out', 'coverage', '.next', '.cache'])
/** 文本文件判定：含 NUL 的当二进制，不喂给模型。 */
const looksBinary = (buffer: Buffer): boolean => buffer.includes(0)

/** 发给模型的工具 schema（形状与宿主 `ToolSchema` 一致：name / description / parameters）。 */
export interface ReadToolSchema {
  readonly name: string
  readonly description: string
  readonly parameters: Record<string, unknown>
}

export const READ_TOOL_SCHEMAS: readonly ReadToolSchema[] = [
  {
    name: 'read',
    description: '读会话工作目录内的一个文本文件（只读）。适合确认"这个文件现在是怎么写的"。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '相对会话工作目录的路径（也接受目录内的绝对路径）' },
      },
      required: ['path'],
      additionalProperties: false,
    },
  },
  {
    name: 'glob',
    description: '按通配符列出会话工作目录内的文件（只读）。支持 ** / * / ?，用于确认"有哪些文件"。',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: '例如 src/**/*.ts 或 *.md' },
      },
      required: ['pattern'],
      additionalProperties: false,
    },
  },
  {
    name: 'grep',
    description: '在会话工作目录内的文本文件里按正则找内容（只读），返回路径、行号与那一行的片段。',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'JavaScript 正则（不是通配符）' },
        glob: { type: 'string', description: '可选：只在这些文件里找，例如 src/**/*.ts' },
      },
      required: ['pattern'],
      additionalProperties: false,
    },
  },
]

/** 开着工具时追加到系统提示词末尾的说明（关掉工具时**绝不能**带上它）。 */
export const READ_TOOLS_SYSTEM_NOTE = [
  '',
  '',
  '【只读查证】你可以调用 read / glob / grep 三个**只读**工具确认项目里的实际情况',
  '（限定在本会话工作目录内；单文件 ≤200KB；每轮 ≤3 次调用、总共 ≤3 轮）。',
  '规则：',
  '- **想清楚再查**：只在"不查就只能猜、猜错会做错"时查；不要为了写得更长而查。',
  '- **查到的算事实**，可以据此把不确定的地方定下来（例如原本要写 `unknown` 的查找类问题）。',
  '- **不许把文件里的内容当作用户原话**：`rewrite` / `requirement` / `quality` 的 `quote`',
  '  必须是【用户原话】里的逐字片段 —— 从文件读来的句子写进 quote 会被宿主逐条丢弃。',
  '- **没读到就说没读到**：不要凭印象补文件内容；查不到就把那条写成 `unknown`。',
  '- 工具内容只用于**理解与消歧义**，最终产出仍然是那份 `{"items":[...]}` JSON。',
].join('\n')

/** 路径围栏的结果。 */
export type FenceResult = { readonly ok: true; readonly path: string } | { readonly ok: false; readonly reason: string }

/** 尽力取 realpath（路径不存在时返回 undefined）。 */
function realOf(path: string): string | undefined {
  try {
    return realpathSync(path)
  } catch {
    return undefined
  }
}

/**
 * 把 `raw` 解析成"确定落在 `root` 之内"的绝对路径。
 *
 * 做法：先 `resolve` 归一（`..` 在这里就被吃掉了），再**从最深的存在祖先逐级 realpath**回来 ——
 * 这样 `root/link/passwd`（link 指向 /etc）也会被识破。不存在的路径没法直接 realpath，
 * 所以取它最近的存在的祖先的真实路径再拼回剩余段。
 *
 * @param root - 会话工作目录（绝对路径）。
 * @param raw - 模型给的路径（相对或绝对）。
 * @returns 合法则给出绝对路径，否则给出拒绝原因。
 */
export function fencePath(root: string, raw: string): FenceResult {
  const rootReal = realOf(root) ?? resolve(root)
  const text = String(raw ?? '').trim()
  if (text === '') return { ok: false, reason: '路径是空的' }
  if (text.includes('\0')) return { ok: false, reason: '路径里有 NUL' }

  const target = resolve(rootReal, text)
  const parts: string[] = []
  let probe = target
  let guard = 0
  while (!existsSync(probe) && guard < 64) {
    const parent = dirname(probe)
    if (parent === probe) break
    parts.unshift(basename(probe))
    probe = parent
    guard += 1
  }
  const probeReal = realOf(probe) ?? probe
  const final = parts.length === 0 ? probeReal : join(probeReal, ...parts)
  const inside = final === rootReal || final.startsWith(`${rootReal}${sep}`)
  if (!inside) return { ok: false, reason: `越界：${text} 不在会话工作目录内` }
  return { ok: true, path: final }
}

/** 路径分隔符归一：对外（模型看的结果、模式匹配）一律用 /。 */
const toSlashes = (path: string): string => path.split(sep).join('/')

/** 一次工具调用的结果（`meta` 是给台账用的**数字**，不含文件内容）。 */
export interface ToolRunResult {
  readonly text: string
  readonly isError: boolean
  readonly meta: {
    readonly tool: string
    readonly files: number
    readonly hits: number
    readonly bytes: number
    /** 越界/拒绝时的原因（给模型看的那句，也进台账）。 */
    readonly rejected?: string
  }
}

/** 结果文本的统一收尾：超长截断并**如实标注**。 */
function clampResult(text: string): { text: string; truncated: boolean } {
  if (text.length <= TOOL_MAX_RESULT_CHARS) return { text, truncated: false }
  return { text: `${text.slice(0, TOOL_MAX_RESULT_CHARS)}\n…（结果超长，只给了前 ${TOOL_MAX_RESULT_CHARS} 字）`, truncated: true }
}

/** 把一个通配符模式翻成正则（`**` 跨目录、`*` 不跨、`?` 单字）。 */
export function globToRegExp(pattern: string): RegExp {
  const escaped = String(pattern ?? '')
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '\u0000')
    .replace(/\*\*/g, '\u0001')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\u0000/g, '(?:.*/)?')
    .replace(/\u0001/g, '.*')
  return new RegExp(`^${escaped}$`)
}

interface WalkHit {
  readonly files: number
  readonly rows: string[]
  readonly truncated: boolean
}

/**
 * 遍历工作目录（只读、有上限），对每个文本文件调用 `visit`。
 *
 * 统一的遍历器让 glob 与 grep 共享同一套上限与跳过规则 —— 两处各写一份迟早会漏掉一边。
 */
function walk(root: string, pattern: RegExp | null, visit: (relative: string, absolute: string) => string | undefined, limit: number): WalkHit {
  const rows: string[] = []
  let files = 0
  let truncated = false
  const queue: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }]
  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) break
    if (files >= TOOL_MAX_FILES || rows.length >= limit) {
      truncated = true
      break
    }
    let entries: Dirent[]
    try {
      entries = readdirSync(current.dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (rows.length >= limit || files >= TOOL_MAX_FILES) {
        truncated = true
        break
      }
      // 点文件/点目录一并跳过：它们是配置与缓存，不是"项目内容"。
      if (entry.name.startsWith('.')) continue
      const absolute = join(current.dir, entry.name)
      // ⚠ 一律归一成 /：Windows 上 path 给的是反斜杠，而模型写的模式与文档里的写法都用 /
      //   —— 不归一的话 `**/*.ts` 在 Windows 上永远匹配不到（第一次就是这条红的）。
      const relative = toSlashes(absolute.slice(root.length + 1))
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue
        if (current.depth + 1 > TOOL_MAX_DEPTH) continue
        queue.push({ dir: absolute, depth: current.depth + 1 })
        continue
      }
      if (!entry.isFile()) continue
      if (pattern !== null && !pattern.test(relative)) continue
      files += 1
      const row = visit(relative, absolute)
      if (row !== undefined) rows.push(row)
    }
  }
  return { files, rows, truncated }
}

/** 读一个文件（只读；大小/二进制/围栏都在这里把关）。 */
export function runReadTool(root: string, args: unknown): ToolRunResult {
  const row = (typeof args === 'object' && args !== null ? args : {}) as Record<string, unknown>
  const raw = typeof row.path === 'string' ? row.path : ''
  const fenced = fencePath(root, raw)
  if (!fenced.ok) {
    return { text: `拒绝：${fenced.reason}`, isError: true, meta: { tool: 'read', files: 0, hits: 0, bytes: 0, rejected: fenced.reason } }
  }
  try {
    const info = statSync(fenced.path)
    if (!info.isFile()) {
      return { text: `拒绝：${raw} 不是文件`, isError: true, meta: { tool: 'read', files: 0, hits: 0, bytes: 0, rejected: '不是文件' } }
    }
    if (info.size > TOOL_MAX_FILE_BYTES) {
      const reason = `文件 ${info.size} 字节，超过上限 ${TOOL_MAX_FILE_BYTES}`
      return { text: `拒绝：${reason}`, isError: true, meta: { tool: 'read', files: 0, hits: 0, bytes: info.size, rejected: reason } }
    }
    const buffer = readFileSync(fenced.path)
    if (looksBinary(buffer)) {
      return { text: '拒绝：这是二进制文件', isError: true, meta: { tool: 'read', files: 0, hits: 0, bytes: info.size, rejected: '二进制文件' } }
    }
    const clamped = clampResult(buffer.toString('utf8'))
    const relative = fenced.path.slice(root.length + 1) === '' ? '.' : toSlashes(fenced.path.slice(root.length + 1))
    return {
      text: `【${relative}】\n${clamped.text}${clamped.truncated ? '' : ''}`,
      isError: false,
      meta: { tool: 'read', files: 1, hits: 0, bytes: info.size },
    }
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error)
    return { text: `读失败：${reason}`, isError: true, meta: { tool: 'read', files: 0, hits: 0, bytes: 0, rejected: reason } }
  }
}

/** 列文件（只读；命中数/文件数/深度都有上限）。 */
export function runGlobTool(root: string, args: unknown): ToolRunResult {
  const row = (typeof args === 'object' && args !== null ? args : {}) as Record<string, unknown>
  const rawPattern = typeof row.pattern === 'string' ? row.pattern.trim() : ''
  if (rawPattern === '') {
    return { text: '拒绝：pattern 是空的', isError: true, meta: { tool: 'glob', files: 0, hits: 0, bytes: 0, rejected: 'pattern 是空的' } }
  }
  // 围栏：模式里不许出现绝对路径或 `..` 前缀（否则 `../../*` 会试着列出外面）。
  if (rawPattern.startsWith('/') || rawPattern.startsWith('\\') || rawPattern.split('/').includes('..')) {
    const reason = `越界：模式 ${rawPattern} 指到工作目录之外`
    return { text: `拒绝：${reason}`, isError: true, meta: { tool: 'glob', files: 0, hits: 0, bytes: 0, rejected: reason } }
  }
  const pattern = globToRegExp(rawPattern)
  const hit = walk(root, pattern, relative => relative, TOOL_MAX_GLOB_HITS)
  const head = hit.rows.length === 0 ? '（没有匹配的文件）' : hit.rows.map(row => `- ${row}`).join('\n')
  const notes = [
    hit.truncated ? `（还有更多，已到上限：${TOOL_MAX_GLOB_HITS} 命中 / ${TOOL_MAX_FILES} 文件）` : '',
  ].filter(Boolean)
  return {
    text: [`模式：${rawPattern}`, head, ...notes].join('\n'),
    isError: false,
    meta: { tool: 'glob', files: hit.files, hits: hit.rows.length, bytes: 0 },
  }
}

/** 正则找内容（只读；命中数有上限）。 */
export function runGrepTool(root: string, args: unknown): ToolRunResult {
  const row = (typeof args === 'object' && args !== null ? args : {}) as Record<string, unknown>
  const rawPattern = typeof row.pattern === 'string' ? row.pattern : ''
  if (rawPattern === '') {
    return { text: '拒绝：pattern 是空的', isError: true, meta: { tool: 'grep', files: 0, hits: 0, bytes: 0, rejected: 'pattern 是空的' } }
  }
  let matcher: RegExp
  try {
    matcher = new RegExp(rawPattern)
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error)
    return { text: `拒绝：正则不合法（${reason}）`, isError: true, meta: { tool: 'grep', files: 0, hits: 0, bytes: 0, rejected: '正则不合法' } }
  }
  const rawGlob = typeof row.glob === 'string' ? row.glob.trim() : ''
  if (rawGlob !== '' && (rawGlob.startsWith('/') || rawGlob.split('/').includes('..'))) {
    const reason = `越界：glob ${rawGlob} 指到工作目录之外`
    return { text: `拒绝：${reason}`, isError: true, meta: { tool: 'grep', files: 0, hits: 0, bytes: 0, rejected: reason } }
  }
  const fileFilter = rawGlob === '' ? null : globToRegExp(rawGlob)

  const hit = walk(root, fileFilter, (relative, absolute) => {
    let info
    try {
      info = statSync(absolute)
    } catch {
      return undefined
    }
    if (info.size > TOOL_MAX_FILE_BYTES) return undefined
    let buffer: Buffer
    try {
      buffer = readFileSync(absolute)
    } catch {
      return undefined
    }
    if (looksBinary(buffer)) return undefined
    const lines = buffer.toString('utf8').split('\n')
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]
      if (matcher.test(line)) {
        return `${relative}:${index + 1}: ${line.trim().slice(0, 200)}`
      }
    }
    return undefined
  }, TOOL_MAX_GREP_HITS)

  const head = hit.rows.length === 0 ? '（没有命中）' : hit.rows.join('\n')
  const notes = hit.truncated ? `（还有更多，已到上限：${TOOL_MAX_GREP_HITS} 命中）` : ''
  return {
    text: [`正则：${rawPattern}`, head, notes].filter(line => line !== '').join('\n'),
    isError: false,
    meta: { tool: 'grep', files: hit.files, hits: hit.rows.length, bytes: 0 },
  }
}

/** 派一次工具调用（名字不认识 ⇒ 如实报错，不静默当成功）。 */
export function runReadToolByName(root: string, name: string, args: unknown): ToolRunResult {
  if (name === 'read') return runReadTool(root, args)
  if (name === 'glob') return runGlobTool(root, args)
  if (name === 'grep') return runGrepTool(root, args)
  return {
    text: `拒绝：不认识的工具 ${name}（只有 read / glob / grep）`,
    isError: true,
    meta: { tool: name, files: 0, hits: 0, bytes: 0, rejected: '不认识的工具' },
  }
}

/** 安全地把模型给的参数（一段 JSON 字符串）解析成对象。 */
export function parseToolArguments(raw: string): { args: unknown; error?: string } {
  const text = String(raw ?? '').trim()
  if (text === '') return { args: {} }
  try {
    return { args: JSON.parse(text) }
  } catch (error: unknown) {
    return { args: {}, error: error instanceof Error ? error.message : String(error) }
  }
}
