/**
 * Browser half：注册设置页（settings.section）、右键菜单与设置面板拖拽
 * 手柄（shell.overlay），并安装输入框拦截器（键位 + 右键菜单）与面板
 * 滚动样式。
 */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import {
  DEFAULT_SETTINGS, ENABLED_FIELD, HEADER_ENABLED_FIELD, HEADER_NAME_FIELD,
  HEADER_ROUTES_FIELD, HEADER_VALUE_FIELD, MENU_FIELDS, MENU_NATIVE_FIELD, NAMESPACE,
  NEWLINE_KEY_FIELD, PANEL_SCROLL_FIELD, PANEL_RESIZE_FIELD, PANEL_WIDTH_FIELD,
  PANEL_HEIGHT_FIELD, SEND_KEY_FIELD, sanitizeSettings,
  type ComposerUxSettings, type MenuState, type SettingsField,
} from './settings-contract.ts'
import { installInterceptors, runMenuAction } from './client/interceptors.ts'
import { installPanelStyle } from './client/panel.ts'
import { installSettingsCardStyle } from './client/settings-style.ts'
import { ContextMenuHost } from './client/ContextMenuHost.tsx'
import { PanelResizeHandles } from './client/PanelResizeHandles.tsx'
import { SettingsSection } from './client/SettingsSection.tsx'

export const name = 'composer-ux'
export const inject = ['slots', 'settingsScope']

/** 客户端插件入口。 */
export function apply(ctx: any): void {
  const slots = ctx.slots
  const scope = ctx.settingsScope.bind<ComposerUxSettings>({ namespace: NAMESPACE })

  const live = createSnapshotStore<ComposerUxSettings>({ ...DEFAULT_SETTINGS })
  const menu = createSnapshotStore<MenuState | null>(null)

  const sync = (): void => {
    const snapshot = scope.getSnapshot()
    live.set(snapshot.status === 'ready' && snapshot.value !== undefined
      ? { ...DEFAULT_SETTINGS, ...sanitizeSettings(snapshot.value) }
      : { ...DEFAULT_SETTINGS })
  }
  sync()
  ctx.effect(() => scope.subscribe(sync), 'composer-ux: settings sync')

  const setField = (field: SettingsField, value: boolean | string | number): void => {
    void scope.set(field, value).catch((error: unknown) => {
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
      ].map(field => ({ op: 'unset', path: [field] })),
    ).catch((error: unknown) => {
      console.error('[composer-ux] settings reset failed', error)
    })
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

  // 设置页折叠卡片样式（常驻；只管设置页外观，与总开关无关）。
  ctx.effect(() => installSettingsCardStyle(), 'composer-ux: settings card style')

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
      }
      // 原生菜单模式启用瞬间：清掉可能还开着的自定义菜单。
      if (live.getSnapshot().menuNative) menu.set(null)
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
