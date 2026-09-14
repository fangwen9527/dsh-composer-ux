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
  PANEL_WIDTH_FIELD, PANEL_HEIGHT_FIELD, QUICK_PROMPTS_FIELD, SEND_KEY_FIELD, sanitizeSettings,
  type ComposerUxSettings, type MenuState, type OptimizerTier, type QuickPrompt,
  type SettingsField,
} from './settings-contract.ts'
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
  focusComposer, insertIntoDraft, optimizeDraft, replaceDraft, currentDraft,
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
  const resetAll = (): void => {
    // 注意：宿主半的记账字段（HOST_OWNED_FIELDS）故意不在名单里——清掉它们会让
    // 已经写入 llm-pi-ai 的请求头失去记账，从而永远撤销不掉。
    void scope.mutate(
      [
        ENABLED_FIELD, SEND_KEY_FIELD, NEWLINE_KEY_FIELD, ...MENU_FIELDS,
        MENU_NATIVE_FIELD,
        PANEL_SCROLL_FIELD, PANEL_RESIZE_FIELD, PANEL_WIDTH_FIELD, PANEL_HEIGHT_FIELD,
        HEADER_ENABLED_FIELD, HEADER_NAME_FIELD, HEADER_VALUE_FIELD, HEADER_ROUTES_FIELD,
        QUICK_PROMPTS_FIELD, OPTIMIZER_TIER_FIELD,
      ].map(field => ({ op: 'unset', path: [field] })),
    ).catch((error: unknown) => {
      console.error('[composer-ux] settings reset failed', error)
    })
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

  /** 写回整份快捷指令列表（编辑「默认插入」用；读当前值再改一条，避免覆盖并发编辑）。 */
  const writeQuickPrompts = (next: readonly QuickPrompt[]): void => {
    setField(QUICK_PROMPTS_FIELD, next)
  }

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
    setAlways: (id: string, value: boolean): void => {
      writeQuickPrompts(live.getSnapshot().quickPrompts.map(
        item => (item.id === id ? { ...item, always: value } : item),
      ))
    },
  }

  // 设置页条目。
  slots.inject('settings.section', () => slots.register({
    name: 'settings.section',
    id: 'composer-ux',
    order: 40,
    label: '输入体验',
    inject: () => ({
      hooks: { live },
      actions: { setField, clearField, resetAll },
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
      hooks: { live, panel, busy: optimizing, notice: panelNotice },
      actions: quickActions,
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
