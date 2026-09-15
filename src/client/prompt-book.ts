/**
 * 快捷指令的**客户端**读写层。
 *
 * 两件事：
 *  1. 经宿主路由 `/composer-ux/prompts` 读、写整本（浏览器没有文件系统，只能走 HTTP）；
 *  2. 一组**纯**编辑函数（增删改移），全部不可变——列表操作最容易出「原地改坏」的
 *     bug，纯函数让它能在 node 里直接测（见 test/quick-store.mjs 第 10 节）。
 *
 * 保存策略：先乐观更新本地快照让 UI 立刻响应，再把整本 POST 上去；**失败就以磁盘
 * 为准回滚**——绝不让「界面显示的」和「文件里的」长期不一致。
 */
import {
  DEFAULT_CATEGORY_NAME, QUICK_CATEGORY_MAX, QUICK_CATEGORY_NAME_MAX, QUICK_LABEL_MAX,
  QUICK_PROMPTS_API_PATH, QUICK_PROMPT_MAX, QUICK_TEXT_MAX,
  newQuickCategoryId, newQuickPromptId, sanitizeBook,
  type QuickPrompt, type QuickPromptBook, type QuickPromptCategory,
} from '../settings-contract.ts'

/** 路由应答（成功与失败都走同一形状，便于统一处理）。 */
export interface PromptBookReply {
  readonly ok: boolean
  readonly book?: QuickPromptBook
  readonly error?: string
  /** 磁盘上的真实路径（展示给用户，便于手工编辑/备份）。 */
  readonly file?: string
  /** 坏文件被隔离后的路径（非空说明出了问题、且原文件已保住）。 */
  readonly quarantined?: string
}

async function requestBook(method: 'GET' | 'POST', body?: unknown): Promise<PromptBookReply> {
  try {
    const response = await fetch(QUICK_PROMPTS_API_PATH, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await response.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      return { ok: false, error: `服务端返回的不是 JSON（HTTP ${String(response.status)}）` }
    }
    const row = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as Record<string, unknown>
    const book = sanitizeBook(row.book)
    const textOf = (value: unknown): string | undefined => (typeof value === 'string' && value !== '' ? value : undefined)
    return {
      ok: row.ok === true,
      ...(book === undefined ? {} : { book }),
      ...(textOf(row.error) === undefined ? {} : { error: textOf(row.error) }),
      ...(textOf(row.file) === undefined ? {} : { file: textOf(row.file) }),
      ...(textOf(row.quarantined) === undefined ? {} : { quarantined: textOf(row.quarantined) }),
    }
  } catch (error: unknown) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** 读整本（首次读取会触发宿主半的一次性迁移）。 */
export function loadPromptBook(): Promise<PromptBookReply> {
  return requestBook('GET')
}

/** 写整本（宿主半会做原子写；坏文件时它会拒绝写入并报错）。 */
export function savePromptBook(book: QuickPromptBook): Promise<PromptBookReply> {
  return requestBook('POST', { book })
}

// ── 纯编辑函数（全部不可变，返回新本） ──────────────────────────────────────

/** 按 id 找分类。 */
export function categoryOf(book: QuickPromptBook, categoryId: string): QuickPromptCategory | undefined {
  return book.categories.find(category => category.id === categoryId)
}

/** 按 id 找条目（跨分类：面板里的「默认插入」勾选不带分类上下文）。 */
export function findPrompt(
  book: QuickPromptBook,
  promptId: string,
): { readonly category: QuickPromptCategory; readonly prompt: QuickPrompt } | undefined {
  for (const category of book.categories) {
    const prompt = category.prompts.find(item => item.id === promptId)
    if (prompt !== undefined) return { category, prompt }
  }
  return undefined
}

/** 统计（面板头部与设置页用）。 */
export function bookCounts(book: QuickPromptBook): { readonly categories: number; readonly prompts: number; readonly always: number } {
  const prompts = book.categories.flatMap(category => category.prompts)
  return {
    categories: book.categories.length,
    prompts: prompts.length,
    always: prompts.filter(prompt => prompt.always).length,
  }
}

function mapCategory(
  book: QuickPromptBook,
  categoryId: string,
  edit: (category: QuickPromptCategory) => QuickPromptCategory,
): QuickPromptBook {
  return {
    version: book.version,
    categories: book.categories.map(category => (category.id === categoryId ? edit(category) : category)),
  }
}

/** 新增分类（名字去空白；超过上限则不动作并返回原本）。 */
export function withCategoryAdded(book: QuickPromptBook, name: string): QuickPromptBook {
  if (book.categories.length >= QUICK_CATEGORY_MAX) return book
  const clean = name.trim().slice(0, QUICK_CATEGORY_NAME_MAX)
  return {
    version: book.version,
    categories: [...book.categories, { id: newQuickCategoryId(), name: clean === '' ? DEFAULT_CATEGORY_NAME : clean, prompts: [] }],
  }
}

/** 改分类名（空名回落到默认名，避免出现点不中的空标签）。 */
export function withCategoryRenamed(book: QuickPromptBook, categoryId: string, name: string): QuickPromptBook {
  const clean = name.trim().slice(0, QUICK_CATEGORY_NAME_MAX)
  return mapCategory(book, categoryId, category => ({ ...category, name: clean === '' ? DEFAULT_CATEGORY_NAME : clean }))
}

/** 删分类（连带它里面的条目一起删）。 */
export function withCategoryRemoved(book: QuickPromptBook, categoryId: string): QuickPromptBook {
  return { version: book.version, categories: book.categories.filter(category => category.id !== categoryId) }
}

/** 分类换位（delta = -1 上移 / +1 下移）；越界时原样返回。 */
export function withCategoryMoved(book: QuickPromptBook, categoryId: string, delta: number): QuickPromptBook {
  const index = book.categories.findIndex(category => category.id === categoryId)
  const next = index + delta
  if (index < 0 || next < 0 || next >= book.categories.length) return book
  const categories = [...book.categories]
  const [moved] = categories.splice(index, 1)
  categories.splice(next, 0, moved)
  return { version: book.version, categories }
}

/** 在指定分类里加一条空条目（名字与正文留空，由用户在设置页填）。 */
export function withPromptAdded(book: QuickPromptBook, categoryId: string): QuickPromptBook {
  return mapCategory(book, categoryId, (category) => {
    if (category.prompts.length >= QUICK_PROMPT_MAX) return category
    return { ...category, prompts: [...category.prompts, { id: newQuickPromptId(), label: '新指令', prompt: '', always: false }] }
  })
}

/**
 * 改条目字段。
 *
 * `prompt` 空串是**合法中间态**（用户正在编辑），故这里不做「空就丢掉」的收窄——
 * 收窄发生在写盘与净化时（`sanitizeBook` 会丢掉空正文的条目），界面上会表现为
 * 「保存后空条目消失」，这是期望行为。
 */
export function withPromptPatched(
  book: QuickPromptBook,
  categoryId: string,
  promptId: string,
  patch: Partial<Pick<QuickPrompt, 'label' | 'prompt' | 'always'>>,
): QuickPromptBook {
  return mapCategory(book, categoryId, (category) => ({
    ...category,
    prompts: category.prompts.map((prompt) => {
      if (prompt.id !== promptId) return prompt
      const label = patch.label === undefined ? prompt.label : patch.label.slice(0, QUICK_LABEL_MAX)
      const text = patch.prompt === undefined ? prompt.prompt : patch.prompt.slice(0, QUICK_TEXT_MAX)
      const always = patch.always === undefined ? prompt.always : patch.always
      return { id: prompt.id, label, prompt: text, always }
    }),
  }))
}

/** 删条目。 */
export function withPromptRemoved(book: QuickPromptBook, categoryId: string, promptId: string): QuickPromptBook {
  return mapCategory(book, categoryId, category => ({
    ...category,
    prompts: category.prompts.filter(prompt => prompt.id !== promptId),
  }))
}

/** 条目换位；越界时**返回传入的那个对象**（调用方据此避免无意义的写盘）。 */
export function withPromptMoved(book: QuickPromptBook, categoryId: string, promptId: string, delta: number): QuickPromptBook {
  const category = categoryOf(book, categoryId)
  if (category === undefined) return book
  const index = category.prompts.findIndex(prompt => prompt.id === promptId)
  const next = index + delta
  if (index < 0 || next < 0 || next >= category.prompts.length) return book
  const prompts = [...category.prompts]
  const [moved] = prompts.splice(index, 1)
  prompts.splice(next, 0, moved)
  return mapCategory(book, categoryId, target => ({ ...target, prompts }))
}

/** 勾选/取消「默认插入」（按 id 跨分类找）。 */
export function withAlwaysToggled(book: QuickPromptBook, promptId: string, value: boolean): QuickPromptBook {
  const hit = findPrompt(book, promptId)
  if (hit === undefined) return book
  return withPromptPatched(book, hit.category.id, promptId, { always: value })
}
