/**
 * 右键菜单宿主：注册进 shell.overlay（root 级 list 槽），菜单打开时渲染
 * 一个 fixed 定位的浮层；关闭时渲染 null。
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import {
  MENU_ITEMS, type ComposerUxSettings, type MenuState, type MenuField,
} from '../settings-contract.ts'
import type { MenuActionId } from './interceptors.ts'
import { menu, menuItem, menuItemDim, menuNote, menuSeparator, menuShortcut } from './styles.ts'

/** 右键菜单注入面。 */
export interface ContextMenuInjected {
  hooks: {
    /** 菜单打开状态（null = 关闭）。 */
    menu: SnapshotStore<MenuState | null>
    /** 当前设置（决定哪些菜单项启用）。 */
    live: SnapshotStore<ComposerUxSettings>
  }
  actions: {
    /** 执行一个菜单动作；resolve 成功与否。 */
    run: (id: MenuActionId) => Promise<{ ok: boolean; message?: string }>
    /** 关闭菜单。 */
    close: () => void
    /** 在菜单上挂一段短暂提示（保留菜单打开）。 */
    note: (message: string | undefined) => void
  }
}

export type ContextMenuHostProps =
  PropsRuntime<'shell.overlay'>
  & InjectFace<ContextMenuInjected>

/** 菜单组：与图片一致的三组分隔布局。 */
const GROUPS: readonly { readonly label: string; readonly shortcut: string; readonly field: MenuField; readonly id: MenuActionId | 'disabledOnly' }[][] = [
  [
    { label: '撤销', shortcut: 'Ctrl+Z', field: 'menuUndo', id: 'undo' },
    { label: '重做', shortcut: 'Ctrl+Y', field: 'menuRedo', id: 'redo' },
  ],
  [
    { label: '剪切', shortcut: 'Ctrl+X', field: 'menuCut', id: 'cut' },
    { label: '复制', shortcut: 'Ctrl+C', field: 'menuCopy', id: 'copy' },
    { label: '粘贴', shortcut: 'Ctrl+V', field: 'menuPaste', id: 'paste' },
    { label: '删除', shortcut: '', field: 'menuDelete', id: 'delete' },
  ],
  [
    { label: '全选', shortcut: 'Ctrl+A', field: 'menuSelectAll', id: 'selectAll' },
  ],
]

const ITEM_STYLES: Record<MenuActionId, 'always' | 'selection'> = {
  undo: 'always',
  redo: 'always',
  cut: 'selection',
  copy: 'selection',
  paste: 'always',
  delete: 'selection',
  selectAll: 'always',
}

/** 与视口边界保持 8px。 */
function clamp(value: number, size: number, viewport: number): number {
  return Math.max(8, Math.min(value, viewport - size - 8))
}

/** 渲染右键菜单；无菜单时返回 null。 */
export function ContextMenuHost({ useMenu, useLive, actions }: ContextMenuHostProps) {
  const menuState = useMenu(item => item)
  const settings = useLive(item => item)
  const ref = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)

  // 打开后按实际尺寸钳制在视口内。
  useLayoutEffect(() => {
    if (menuState === null) {
      setPosition(null)
      return
    }
    const el = ref.current
    if (el === null) return
    const rect = el.getBoundingClientRect()
    setPosition({
      x: clamp(menuState.x, rect.width, window.innerWidth),
      y: clamp(menuState.y, rect.height, window.innerHeight),
    })
  }, [menuState?.x, menuState?.y])

  // 外部点击 / Escape / 滚动 / 窗口变化时关闭。
  useEffect(() => {
    if (menuState === null) return
    const onPointerDown = (event: PointerEvent): void => {
      if (ref.current !== null && event.target instanceof Node && ref.current.contains(event.target)) return
      actions.close()
    }
    const onEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      actions.close()
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onEscape, true)
    window.addEventListener('scroll', actions.close, true)
    window.addEventListener('resize', actions.close)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onEscape, true)
      window.removeEventListener('scroll', actions.close, true)
      window.removeEventListener('resize', actions.close)
    }
  }, [menuState === null, actions])

  // 提示 3 秒后清除。
  useEffect(() => {
    if (menuState?.note === undefined) return
    const timer = setTimeout(() => { actions.note(undefined) }, 3000)
    return () => { clearTimeout(timer) }
  }, [menuState?.note])

  if (menuState === null) return null

  const onItemClick = (id: MenuActionId): void => {
    // 粘贴若缓存未命中会实时读取剪贴板，可能短暂等待授权，给出进行中反馈。
    if (id === 'paste') actions.note('正在读取剪贴板…')
    // 不让按钮抢走焦点，保留输入框选区。
    void actions.run(id).then((result) => {
      if (result.ok) actions.close()
      else actions.note(result.message ?? '操作失败')
    })
  }

  const groups = GROUPS
    .map(group => group.filter(item => settings[item.field] === true))
    .filter(group => group.length > 0)

  return (
    <div
      ref={ref}
      role="menu"
      style={{
        ...menu,
        left: position?.x ?? menuState.x,
        top: position?.y ?? menuState.y,
      }}
    >
      {groups.map((group, groupIndex) => (
        <React.Fragment key={group[0]!.field}>
          {groupIndex > 0 && <div role="separator" style={menuSeparator} />}
          {group.map(item => {
            const needsSelection = ITEM_STYLES[item.id] === 'selection'
            const disabled = needsSelection && !menuState.hasSelection
            const style = disabled ? menuItemDim : menuItem
            return (
              <button
                key={item.field}
                type="button"
                role="menuitem"
                disabled={disabled}
                style={style}
                onMouseDown={(event) => { event.preventDefault() }}
                onClick={() => { onItemClick(item.id) }}
              >
                <span>{item.label}</span>
                {item.shortcut !== '' && <span style={menuShortcut}>{item.shortcut}</span>}
              </button>
            )
          })}
        </React.Fragment>
      ))}
      {menuState.note !== undefined && <div style={menuNote}>{menuState.note}</div>}
    </div>
  )
}
