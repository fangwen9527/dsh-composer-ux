/**
 * Browser half：注册设置页（settings.section）、右键菜单与设置面板拖拽
 * 手柄（shell.overlay），并安装输入框拦截器（键位 + 右键菜单）与面板
 * 滚动样式。
 */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import {
  DEFAULT_SETTINGS, ENABLED_FIELD, HEADER_ENABLED_FIELD, HEADER_NAME_FIELD,
  HEADER_ROUTES_FIELD, HEADER_VALUE_FIELD, MENU_FIELDS, MENU_NATIVE_FIELD, NAMESPACE,
  NEWLINE_KEY_FIELD, OPTIMIZER_TIER_FIELD, PANEL_SCROLL_FIELD, PANEL_RESIZE_FIELD,
  PANEL_WIDTH_FIELD, PANEL_HEIGHT_FIELD, SEND_KEY_FIELD, sanitizeSettings,
  alwaysQuickPrompts, appendBatchForSend, defaultQuickBook,
  type ComposerUxSettings, type InsertMode, type MenuState, type OptimizerTier, type QuickPrompt,
  type QuickPromptBook, type SettingsField,
} from './settings-contract.ts'
import {
  loadPromptBook, savePromptBook, withCategoryAdded, withCategoryMoved,
  withCategoryRemoved, withCategoryRenamed, withInsertMode, withPromptAdded, withPromptMoved,
  withPromptMovedToCategory, withPromptPatched, withPromptRemoved,
} from './client/prompt-book.ts'
import { installInterceptors, runMenuAction } from './client/interceptors.ts'
import { installPanelStyle } from './client/panel.ts'
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
export const inject = ['slots', 'settingsScope']

/** 客户端插件入口。 */
export function apply(ctx: any): void {
  const slots = ctx.slots
  const scope = ctx.settingsScope.bind<ComposerUxSettings>({ namespace: NAMESPACE })

  const live = createSnapshotStore<ComposerUxSettings>({ ...DEFAULT_SETTINGS })
  const menu = createSnapshotStore<MenuState | null>(null)
  const panel = createSnapshotStore<QuickPanelAnchor | null>(null)
  const optimizing = createSnapshotStore<boolean>(false)
  const panelNotice = createSnapshotStore<string>('')

  const sync = (): void => {
    const snapshot = scope.getSnapshot()
    live.set(snapshot.status === 'ready' && snapshot.value !== undefined
      ? { ...DEFAULT_SETTINGS, ...sanitizeSettings(snapshot.value) }
      : { ...DEFAULT_SETTINGS })
  }
  sync()
  ctx.effect(() => scope.subscribe(sync), 'composer-ux: settings sync')

  const setField = (field: SettingsField, value: unknown): void => {
    void scope.set(field, value as never).catch((error: unknown) => {
      console.error('[composer-ux] settings write failed', error)
    })
  }
  const clearField = (field: SettingsField): void => {
    void scope.unset(field).catch((error: unknown) => {
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
        MENU_NATIVE_FIELD,
        PANEL_SCROLL_FIELD, PANEL_RESIZE_FIELD, PANEL_WIDTH_FIELD, PANEL_HEIGHT_FIELD,
        HEADER_ENABLED_FIELD, HEADER_NAME_FIELD, HEADER_VALUE_FIELD, HEADER_ROUTES_FIELD,
        OPTIMIZER_TIER_FIELD,
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
          note(`已写回输入框（${result.route}）· Ctrl+Z 可还原`)
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
      hooks: { live, book, bookStatus },
      actions: {
        setField, clearField, resetAll,
        saveBook: bookActions.saveBook,
        reloadBook: bookActions.reload,
        resetBook: bookActions.resetBook,
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

  // 设置面板导航滚动样式（随 panelScroll 开关切换；总开关关闭时一并停用）。
  ctx.effect(
    () => installPanelStyle(
      () => {
        const settings = live.getSnapshot()
        return settings.enabled && settings.panelScroll
      },
      listener => live.subscribe(listener),
    ),
    'composer-ux: panel style',
  )

  // 键位拦截 + 右键菜单打开（受总开关控制：关闭时卸载监听并关闭已开菜单）。
  ctx.effect(() => {
    let dispose: (() => void) | null = null
    const syncInterceptors = (): void => {
      const enabled = live.getSnapshot().enabled
      if (enabled && dispose === null) {
        dispose = installInterceptors({
          settings: () => live.getSnapshot(),
          // 「仅首次」由这里决定是否算进这一批：会话还是空的（blank）才带上。
          promptsForSend: () => appendBatchForSend(book.getSnapshot(), currentBlankSession()),
          setMenu: state => { menu.set(state) },
          menuOpen: () => menu.getSnapshot() !== null,
        })
      } else if (!enabled) {
        dispose?.()
        dispose = null
        menu.set(null)
        panel.set(null)
      }
      // 原生菜单模式启用瞬间：清掉可能还开着的自定义菜单。
      if (live.getSnapshot().menuNative) menu.set(null)
      // 总开关关掉时按钮本身也会消失（组件里按 enabled 返回 null），
      // 浮层必须跟着一起收，否则会留下一个没有锚点的面板。
      if (!live.getSnapshot().enabled) panel.set(null)
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
