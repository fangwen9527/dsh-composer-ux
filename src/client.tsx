/**
 * Browser half：注册设置页（settings.section）、右键菜单与设置面板拖拽
 * 手柄（shell.overlay），并安装输入框拦截器（键位 + 右键菜单）与面板
 * 滚动样式。
 */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import {
  DEFAULT_SETTINGS, ENABLED_FIELD, HEADER_ENABLED_FIELD, HEADER_NAME_FIELD,
  HEADER_ROUTES_FIELD, HEADER_VALUE_FIELD, KEYS_ENABLED_FIELD, MENU_ENABLED_FIELD,
  MENU_FIELDS, MENU_MODE_FIELD, MENU_NATIVE_FIELD, NAMESPACE,
  NEWLINE_KEY_FIELD, OPTIMIZER_TIER_FIELD, PANEL_ENABLED_FIELD, PANEL_RESIZE_FIELD,
  PANEL_WIDTH_FIELD, PANEL_HEIGHT_FIELD, QUICK_ENABLED_FIELD, SEND_KEY_FIELD, TERMINAL_ENABLED_FIELD,
  activeSections, sanitizeSettings,
  alwaysQuickPrompts, appendBatchForSend, defaultQuickBook,
  type ComposerUxSettings, type InsertMode, type MenuState, type OptimizerTier, type QuickPrompt,
  type QuickPromptBook, type SettingsField,
} from './settings-contract.ts'
// 终端字段的常量住在终端契约里（settings-contract 只是把它们并进设置契约）。
import { TERMINAL_BASH_PATH_FIELD, TERMINAL_MODE_FIELD } from './terminal/contracts.ts'
import {
  loadPromptBook, savePromptBook, withCategoryAdded, withCategoryMoved,
  withCategoryRemoved, withCategoryRenamed, withInsertMode, withPromptAdded, withPromptMoved,
  withPromptMovedToCategory, withPromptPatched, withPromptRemoved,
} from './client/prompt-book.ts'
import { installInterceptors, runMenuAction } from './client/interceptors.ts'
import { installPanelResizeStyle } from './client/panel.ts'
import { installSettingsCardStyle } from './client/settings-style.ts'
import { installQuickButtonStyle } from './client/quick-style.ts'
import { ContextMenuHost } from './client/ContextMenuHost.tsx'
import { PanelResizeHandles } from './client/PanelResizeHandles.tsx'
import { SettingsSection } from './client/SettingsSection.tsx'
import { QuickCommandsButton, type QuickPanelAnchor } from './client/QuickCommandsButton.tsx'
import { QuickCommandsPanel } from './client/QuickCommandsPanel.tsx'
import {
  focusComposer, insertIntoDraft, optimizeDraft, replaceDraft, currentBlankSession, currentDraft,
} from './client/quick-commands.ts'

export const name = 'composer-ux'
/**
 * 只硬依赖 `slots`。
 *
 * 设置服务换了名字与形状，而且**不能同时写进 `inject`**：
 *   0.1.6 及以前 = `ctx.settingsScope.bind({ namespace })`
 *   0.1.7 起     = `ctx.configForms.get(namespace)`
 * 谁在对方那一代都不存在，静态 inject 一旦写错，插件就永远等不到依赖而整块不挂载
 * （设置页、键位、右键菜单、快捷指令一起消失）。所以这里只硬依赖 slots，
 * 两个名字各用 `ctx.inject` 等一次，谁先到就用谁（见 `adoptSettings`）。
 */
export const inject = ['slots']

/** 一个设置作用域的最小用法：两代 `SettingsScope` / `ConfigForm` 的交集。 */
interface SettingsScopeLike {
  getSnapshot(): { status: string; value?: unknown }
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<unknown>
  unset(field: string): Promise<unknown>
  mutate(ops: readonly { op: 'set' | 'unset'; path: readonly string[]; value?: unknown }[]): Promise<unknown>
}

/**
 * 设置服务缺席时的替身：界面以默认值照常可用。
 *
 * 存在的意义是"降级而不是消失"——两代 DSH 都有这个服务，所以它只在
 * 组合里根本没有设置 provider 时兜底。
 */
const NULL_SCOPE: SettingsScopeLike = {
  getSnapshot: () => ({ status: 'unavailable', value: undefined }),
  subscribe: () => () => {},
  set: async () => false,
  unset: async () => false,
  mutate: async () => false,
}

/** 客户端插件入口。 */
export function apply(ctx: any): void {
  const slots = ctx.slots

  const live = createSnapshotStore<ComposerUxSettings>({ ...DEFAULT_SETTINGS })
  const menu = createSnapshotStore<MenuState | null>(null)
  const panel = createSnapshotStore<QuickPanelAnchor | null>(null)
  const optimizing = createSnapshotStore<boolean>(false)
  const panelNotice = createSnapshotStore<string>('')
  /**
   * 设置写入的说明行；'' = 正常。渲染在设置卡片顶部（与「重启 DSH」横幅同位置）。
   *
   * 存在的理由：`ConfigForm.set` 返回 `true` 只代表宿主**收下**了这次写入，不保证运行时
   * 的活值跟着变。真机事故（2026-09-23）里，设置写入被一把孤儿锁挡住，用户能看到的
   * 只有"开关不动"——一句提示都没有。所以布尔字段写完回读一次，对不上就把话说出来。
   */
  const writeNotice = createSnapshotStore<string>('')

  /** 当前设置作用域；真的那个到了之后被 `adoptSettings` 换掉（见文件上方 inject 那段）。 */
  let scope: SettingsScopeLike = NULL_SCOPE

  const sync = (): void => {
    const snapshot = scope.getSnapshot()
    live.set(snapshot.status === 'ready' && snapshot.value !== undefined
      ? { ...DEFAULT_SETTINGS, ...sanitizeSettings(snapshot.value) }
      : { ...DEFAULT_SETTINGS })
  }
  sync()

  /**
   * 认领第一个出现的设置服务。
   *
   * 0.1.7 的 `ConfigForm.set/unset/mutate` 返回 `Promise<boolean>`（`false` = 宿主拒绝，
   * 例如字段不是 volatile、或修订号被别人抢先）；0.1.6 返回 `Promise<void>`。
   * 所以这里只在明确拿到 `false` 时记一条警告，两代都不会误报。
   */
  let adopted = false
  const adoptSettings = (service: unknown, shape: 'get' | 'bind'): void => {
    if (adopted || service === null || service === undefined) return
    const api = service as {
      get?: (namespace: string) => unknown
      bind?: (spec: { namespace: string }) => unknown
    }
    const next = shape === 'get' ? api.get?.(NAMESPACE) : api.bind?.({ namespace: NAMESPACE })
    if (next === null || next === undefined) return
    if (typeof (next as SettingsScopeLike).getSnapshot !== 'function') return
    adopted = true
    scope = next as SettingsScopeLike
    sync()
    ctx.effect(() => scope.subscribe(sync), 'composer-ux: settings sync')
  }
  /**
   * 等一个服务出现（cordis 的 `inject` 语义）。
   *
   * `ctx.inject` 理论上一定在（宿主半也在用），但它是这一块唯一会让 apply 抛出的调用 ——
   * 抛出意味着整块消失，所以缺席时静默跳过：下面的"直接读一次"兜底仍会认领已到位的服务。
   */
  const whenService = (deps: string[], callback: (view: Record<string, unknown>) => void): void => {
    if (typeof ctx.inject !== 'function') return
    try {
      ctx.inject(deps, callback)
    } catch (error: unknown) {
      console.warn('[composer-ux] settings service inject failed', error)
    }
  }
  whenService(['configForms'], view => { adoptSettings(view.configForms, 'get') })
  whenService(['settingsScope'], view => { adoptSettings(view.settingsScope, 'bind') })
  /**
   * 直接读一次属性，两代各试一次（`adoptSettings` 内部有 `adopted` 闸，不会重复认领）。
   *
   * 必须包 try：cordis 的上下文代理对**未出现在 inject 里**的服务名直接抛出
   * `cannot get property "X" without inject`。本插件只声明 `inject = ['slots']`，
   * 所以在缺这一代服务的 DSH 上（0.1.6 没有 `configForms`、0.1.7 没有
   * `settingsScope`），裸读属性会让整个 apply 抛出 —— 设置页、键位、右键菜单、
   * 快捷指令一起消失，正是上面注释要避免的那种"整块不挂载"。
   */
  const peekService = (name: string): unknown => {
    try {
      return (ctx as Record<string, unknown>)[name]
    } catch {
      return undefined
    }
  }
  adoptSettings(peekService('configForms'), 'get')
  adoptSettings(peekService('settingsScope'), 'bind')

  /**
   * 写入一个字段；被宿主拒绝（新版返回 false）时在控制台留痕，并把原因留给设置页。
   *
   * 为什么还要**回读校验**：`ConfigForm.set` 返回 `true` 只说明宿主收下了写入，不保证
   * 运行时的活值跟着变。真机上出现过两种"点了没反应"：
   *   · 写入被拒（false）—— profile 的写入锁被占/是孤儿锁，等 2 秒超时；
   *   · 写入落盘、但进程里的活值没接住 —— 界面继续显示旧值。
   * 两种都要重启（或手工回收锁）才能恢复，而用户唯一的线索就是"开关不动"。所以这里
   * 回读一次，对不上就把说明挂到设置页顶部。
   *
   * 为什么只校验布尔字段：布尔不会被净化层夹取，也没有"写入同一个值"的正常场景，
   * 于是"回读仍不等于刚写的值"就是明确异常；尺寸/文本有夹取与截断，拿它们判等会误报。
   */
  const WRITE_READBACK_MS = 1200
  const setField = (field: SettingsField, value: unknown): void => {
    writeNotice.set('')
    const verify = typeof value === 'boolean'
    void scope.set(field, value as never).then((accepted: unknown) => {
      if (accepted === false) {
        console.warn('[composer-ux] settings write refused', field)
        writeNotice.set(
          `写入「${field}」被宿主拒绝。常见原因：profile 的写入锁被占用，或是一把孤儿锁`
          + '（硬杀重启留下的）——见 README「设置写不进去」一节；重启 DSH 后仍无效，'
          + '就手工删掉 profiles/<你的 profile>/package.json.lock。',
        )
        return
      }
      if (!verify) return
      setTimeout(() => {
        const now = (live.getSnapshot() as unknown as Record<string, unknown>)[field]
        if (now === value) return
        console.warn('[composer-ux] settings write had no visible effect', field, now, value)
        writeNotice.set(
          `写入「${field}」已被宿主接受，但运行时的值没有变化（仍是 ${String(now)}）。`
          + '配置可能已经落盘，只是这个进程没接住——重启 DSH 即可生效。',
        )
      }, WRITE_READBACK_MS)
    }, (error: unknown) => {
      console.error('[composer-ux] settings write failed', error)
      writeNotice.set(`写入「${field}」失败：${error instanceof Error ? error.message : String(error)}`)
    })
  }
  const clearField = (field: SettingsField): void => {
    void scope.unset(field).then((accepted: unknown) => {
      if (accepted === false) console.warn('[composer-ux] settings clear refused', field)
    }, (error: unknown) => {
      console.error('[composer-ux] settings clear failed', error)
    })
  }

  // ── 快捷指令存储（分类结构；真相在 $DSH_HOME/quick-prompts.json） ──────────
  //
  // 读：apply 时拉一次。写：先乐观更新本地快照让界面立刻响应，再把整本 POST 上去；
  // 失败就以磁盘为准回滚——不让「界面显示的」和「文件里的」长期不一致。
  const book = createSnapshotStore<QuickPromptBook>(defaultQuickBook())
  /** '' = 正常；'saving' = 正在写；其余 = 上一次的错误文案。 */
  const bookStatus = createSnapshotStore<string>('')

  const reloadBook = async (): Promise<void> => {
    const reply = await loadPromptBook()
    if (reply.ok && reply.book !== undefined) {
      book.set(reply.book)
      bookStatus.set('')
      return
    }
    bookStatus.set(reply.error ?? '读取快捷指令失败')
  }

  const commitBook = (next: QuickPromptBook): void => {
    book.set(next)
    bookStatus.set('saving')
    void savePromptBook(next).then(
      (reply) => {
        if (reply.ok && reply.book !== undefined) {
          // 用宿主回读的**磁盘真实内容**覆盖本地：任何被收窄/丢弃的字段立刻可见。
          book.set(reply.book)
          bookStatus.set('')
          return
        }
        bookStatus.set(reply.error ?? '保存失败')
        void reloadBook()
      },
      (error: unknown) => {
        bookStatus.set(error instanceof Error ? error.message : String(error))
        void reloadBook()
      },
    )
  }

  void reloadBook()

  const bookActions = {
    reload: (): void => { void reloadBook() },
    addCategory: (name: string): void => { commitBook(withCategoryAdded(book.getSnapshot(), name)) },
    renameCategory: (id: string, name: string): void => {
      commitBook(withCategoryRenamed(book.getSnapshot(), id, name))
    },
    removeCategory: (id: string): void => { commitBook(withCategoryRemoved(book.getSnapshot(), id)) },
    moveCategory: (id: string, delta: number): void => {
      commitBook(withCategoryMoved(book.getSnapshot(), id, delta))
    },
    addPrompt: (categoryId: string): void => { commitBook(withPromptAdded(book.getSnapshot(), categoryId)) },
    patchPrompt: (categoryId: string, id: string, patch: { label?: string; prompt?: string }): void => {
      commitBook(withPromptPatched(book.getSnapshot(), categoryId, id, patch))
    },
    removePrompt: (categoryId: string, id: string): void => {
      commitBook(withPromptRemoved(book.getSnapshot(), categoryId, id))
    },
    movePrompt: (categoryId: string, id: string, delta: number): void => {
      commitBook(withPromptMoved(book.getSnapshot(), categoryId, id, delta))
    },
    resetBook: (): void => { commitBook(defaultQuickBook()) },
    /** 把某条从它所在分类移到目标分类（「移动到这里」：追加到目标末尾）。 */
    movePromptToCategory: (promptId: string, toCategoryId: string): void => {
      commitBook(withPromptMovedToCategory(book.getSnapshot(), promptId, toCategoryId))
    },
    /** 设置页「保存」：把编辑器里的整本一次写回（而不是每敲一个字就写盘）。 */
    saveBook: (next: QuickPromptBook): void => { commitBook(next) },
  }

  const resetAll = (): void => {
    // 注意：宿主半的记账字段（HOST_OWNED_FIELDS）故意不在名单里——清掉它们会让
    // 已经写入 llm-pi-ai 的请求头失去记账，从而永远撤销不掉。
    // 快捷指令也不在名单里：它的真相已经搬到 quick-prompts.json（见 bookActions.resetBook），
    // 而设置文档里那份 0.2.x 的旧值是**迁移的种子**，故意留着不清——万一回滚到旧版还能看到。
    void scope.mutate(
      [
        ENABLED_FIELD, SEND_KEY_FIELD, NEWLINE_KEY_FIELD, ...MENU_FIELDS,
        MENU_MODE_FIELD,
        // 旧的布尔字段也一并清掉：它只是迁移线索，留着会把「恢复默认」后的档位又拉回旧值。
        MENU_NATIVE_FIELD,
        PANEL_RESIZE_FIELD, PANEL_WIDTH_FIELD, PANEL_HEIGHT_FIELD,
        HEADER_ENABLED_FIELD, HEADER_NAME_FIELD, HEADER_VALUE_FIELD, HEADER_ROUTES_FIELD,
        OPTIMIZER_TIER_FIELD,
        // 0.5.0 新增的用户配置：终端档位/路径（「恢复默认」也该把它们恢复）。
        TERMINAL_MODE_FIELD, TERMINAL_BASH_PATH_FIELD,
        // 五栏开关也清掉：清掉 = 回到"从没碰过这一栏"⇒ 全关（新装默认的样子）。
        // 若不清，恢复默认之后六栏还会保持之前打开的状态，与"默认关"的语义不符。
        KEYS_ENABLED_FIELD, MENU_ENABLED_FIELD, QUICK_ENABLED_FIELD,
        PANEL_ENABLED_FIELD, TERMINAL_ENABLED_FIELD,
        // 0.5.0 里那个「可选重启命令」字段已经删掉，但老文档里可能还留着值：
        // 顺手清掉，免得它永远躺在设置文件里没人认识。
        'restartCommand',
      ].map(field => ({ op: 'unset', path: [field] })),
    ).catch((error: unknown) => {
      console.error('[composer-ux] settings reset failed', error)
    })
    bookActions.resetBook()
  }

  // ── 快捷指令与提示词优化 ──────────────────────────────────────────────────

  /** 面板底部的短提示；到时自动消失（与右键菜单的 note 同一套路）。 */
  let noticeTimer: ReturnType<typeof setTimeout> | undefined
  const note = (message: string, ms = 4500): void => {
    panelNotice.set(message)
    if (noticeTimer !== undefined) clearTimeout(noticeTimer)
    if (message === '') return
    noticeTimer = setTimeout(() => { panelNotice.set('') }, ms)
  }
  ctx.effect(() => () => {
    if (noticeTimer !== undefined) clearTimeout(noticeTimer)
  }, 'composer-ux: quick notice timer')

  const quickActions = {
    toggle: (anchor: { left: number; bottom: number; width: number }): void => {
      if (panel.getSnapshot() !== null) {
        panel.set(null)
        panelNotice.set('')
        return
      }
      panelNotice.set('')
      panel.set(anchor)
    },
    close: (): void => {
      panel.set(null)
      panelNotice.set('')
    },
    insert: (text: string): void => {
      if (insertIntoDraft(text)) focusComposer()
    },
    optimize: (): void => {
      if (optimizing.getSnapshot()) return
      const draft = currentDraft()
      if (draft.trim() === '') {
        note('输入框是空的：先写点什么，再点优化')
        return
      }
      optimizing.set(true)
      note('正在优化…')
      void optimizeDraft(draft, live.getSnapshot().optimizerTier).then(
        (result) => {
          optimizing.set(false)
          if (!result.ok) {
            note(`优化失败：${result.error ?? '未知原因'}`)
            return
          }
          replaceDraft(result.text ?? '')
          focusComposer()
          // 状态行如实交代这一轮到底发生了什么（0.6.0 起宿主会回报记账信息）：
          // 用了几个条目、丢了几条、走没走降级/重试 —— 用户据此判断这次优化可不可信。
          const bits: string[] = []
          if (result.fallback === true) bits.push('模型没按条目契约输出，已整段照收（未校验依据）')
          else bits.push(`${String(result.itemCount ?? 0)} 条补全`)
          const lost = result.dropped?.length ?? 0
          if (lost > 0) bits.push(`丢弃 ${String(lost)} 条`)
          if (result.promptSource === 'custom') bits.push('自定义提示词')
          if (result.retried === true) bits.push('重试过一次')
          note(`已写回输入框（${result.route}）· ${bits.join(' · ')} · Ctrl+Z 可还原`)
        },
        (error: unknown) => {
          optimizing.set(false)
          note(`优化失败：${error instanceof Error ? error.message : String(error)}`)
        },
      )
    },
    setTier: (tier: OptimizerTier): void => { setField(OPTIMIZER_TIER_FIELD, tier) },
    /**
     * 设置某条的插入模式（关 / 每次 / 仅首次）。
     *
     * 界面上只有这一个入口：两个互斥标志由 `withInsertMode` **一次写对**，
     * 不给「又每次又仅首次」留缝。
     */
    setInsertMode: (promptId: string, mode: InsertMode): void => {
      commitBook(withInsertMode(book.getSnapshot(), promptId, mode))
    },
  }

  // 设置页条目。
  slots.inject('settings.section', () => slots.register({
    name: 'settings.section',
    id: 'composer-ux',
    order: 40,
    label: '输入体验',
    inject: () => ({
      hooks: { live, book, bookStatus, writeNotice },
      actions: {
        setField, clearField, resetAll,
        saveBook: bookActions.saveBook,
        reloadBook: bookActions.reload,
        resetBook: bookActions.resetBook,
        dismissNotice: () => { writeNotice.set('') },
      },
    }),
  }, SettingsSection))

  // 右键菜单浮层（shell.overlay 是 root 级 list 槽；光标层本身点击穿透，菜单自营 pointer-events）。
  slots.inject('shell.overlay', () => slots.register({
    name: 'shell.overlay',
    id: 'composer-ux-menu',
    inject: () => ({
      hooks: { menu, live },
      actions: {
        run: runMenuAction,
        close: () => { menu.set(null) },
        note: (message: string | undefined) => {
          const current = menu.getSnapshot()
          if (current === null) return
          menu.set({ ...current, note: message })
        },
      },
    }),
  }, ContextMenuHost))

  // 设置面板边缘拖拽手柄。
  slots.inject('shell.overlay', () => slots.register({
    name: 'shell.overlay',
    id: 'composer-ux-panel-resize',
    inject: () => ({ hooks: { live }, actions: { setField } }),
  }, PanelResizeHandles))

  // 「快捷指令」入口按钮：与官方「展开」按钮同排（order 89 < 展开的 90）。
  slots.inject('conversation.input.right', () => slots.register({
    name: 'conversation.input.right',
    id: 'composer-ux-quick',
    order: 89,
    label: '快捷指令',
    inject: () => ({
      hooks: { live, panel },
      actions: { toggle: quickActions.toggle },
    }),
  }, QuickCommandsButton))

  // 「快捷指令」展开面板：走 root 级浮层，不受输入卡片裁剪。
  slots.inject('shell.overlay', () => slots.register({
    name: 'shell.overlay',
    id: 'composer-ux-quick-panel',
    inject: () => ({
      hooks: { live, panel, busy: optimizing, notice: panelNotice, book, bookStatus },
      actions: {
        toggle: quickActions.toggle,
        close: quickActions.close,
        insert: quickActions.insert,
        optimize: quickActions.optimize,
        setTier: quickActions.setTier,
        setInsertMode: quickActions.setInsertMode,
        addCategory: bookActions.addCategory,
        renameCategory: bookActions.renameCategory,
        removeCategory: bookActions.removeCategory,
        moveCategory: bookActions.moveCategory,
        addPrompt: bookActions.addPrompt,
        movePrompt: bookActions.movePromptToCategory,
        reloadBook: bookActions.reload,
      },
    }),
  }, QuickCommandsPanel))

  // 设置页折叠卡片样式（常驻；只管设置页外观，与总开关无关）。
  ctx.effect(() => installSettingsCardStyle(), 'composer-ux: settings card style')

  // 「快捷指令」入口按钮样式表（与旁边官方「展开」按钮逐项对齐）。
  ctx.effect(() => installQuickButtonStyle(), 'composer-ux: quick button style')

  // 设置面板尺寸手柄样式（常驻；「设置面板」栏关掉时手柄组件自己返回 null，样式留着无副作用）。
  // 0.6.0 起这里只剩尺寸手柄：导航列滚动由 DSH 0.1.7 的官方设置页自带。
  ctx.effect(() => installPanelResizeStyle(), 'composer-ux: panel resize style')

  // 键位拦截 + 右键菜单打开 + 官方发送按钮上的条目附加（三件事共用这一组捕获监听）。
  // 安装条件放宽成"三栏里任意一栏开着"，各自在自己的处理函数里按栏判断 ——
  // 免得只开「快捷指令」时连官方发送按钮那条路都不装（那样附加就失效了）。
  ctx.effect(() => {
    let dispose: (() => void) | null = null
    const syncInterceptors = (): void => {
      const settings = live.getSnapshot()
      const sections = activeSections(settings)
      const wanted = sections.keys || sections.menu || sections.quick
      if (wanted && dispose === null) {
        dispose = installInterceptors({
          settings: () => live.getSnapshot(),
          // 「仅首次」由这里决定是否算进这一批：会话还是空的（blank）才带上。
          // 「快捷指令」栏关掉时这里直接给空批次 —— 这是唯一一处"关掉就不附加"的闸，
          // 键位发送与官方按钮两条路都从这里取批次，不需要各写一遍。
          promptsForSend: () => (activeSections(live.getSnapshot()).quick
            ? appendBatchForSend(book.getSnapshot(), currentBlankSession())
            : []),
          setMenu: state => { menu.set(state) },
          menuOpen: () => menu.getSnapshot() !== null,
        })
      } else if (!wanted) {
        dispose?.()
        dispose = null
      }
      // 只要不是「自定义」档，就清掉可能还开着的自定义菜单（官方 / 浏览器两档都不该留下它）。
      if (settings.menuMode !== 'custom' || !sections.menu) menu.set(null)
      // 快捷指令栏关掉时按钮本身也会消失（组件里按开关返回 null），
      // 浮层必须跟着一起收，否则会留下一个没有锚点的面板。
      if (!sections.quick) panel.set(null)
    }
    syncInterceptors()
    const unsubscribe = live.subscribe(syncInterceptors)
    return () => {
      unsubscribe()
      dispose?.()
      dispose = null
    }
  }, 'composer-ux: input interceptors')
}
