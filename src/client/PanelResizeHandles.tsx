/**
 * 设置面板尺寸手柄：四边可拖 + 右下角抓手。
 *
 * **为什么用 `createPortal` 挂进面板内部，而不是在 `shell.overlay` 里对准坐标画**
 * （0.2.0 整段功能失效的原因，务必别改回去）：
 *   `shell.overlay` 被官方封在 `ui-layout` 的
 *   `.overlayLayer { position:absolute; inset:0; z-index:20 }` 里。`position` +
 *   `z-index` 让它**自成层叠上下文**，里面的元素无论 z-index 写多大都出不去，
 *   永远排在设置弹窗（`.overlay` z-index:1000）下面，被全屏遮罩
 *   （`.mask { position:absolute; inset:0 }`）吃掉鼠标 ⇒ 手柄根本抓不到。
 *   挂进面板内部就完全不需要比层叠：它在最高那一层的**里面**。
 *
 * 附带好处：定位由「视口坐标 + 轮询重算」变成「面板内的绝对定位」，面板移动/
 * 滚动/改尺寸都自动跟随，不再需要 250ms 的矩形重算（轮询只用来发现面板出现）。
 *
 * 本组件仍注册在 `shell.overlay`——它只是**渲染出口**在那里（为了拿到
 * `useLive` 与写入动作），实际 DOM 通过 portal 落在面板内。
 */
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import { PANEL_HEIGHT_FIELD, PANEL_WIDTH_FIELD, activeSections, type ComposerUxSettings } from '../settings-contract.ts'
import {
  RESIZE_EDGE_CLASS, RESIZE_GRIP_CLASS, RESIZE_LAYER_CLASS, RESIZE_OUTLINE_CLASS,
  RESIZE_OUTLINE_STYLE, clampPanelHeight, clampPanelWidth, findSettingsPanel, handleBox,
  type ResizeEdge,
} from './panel.ts'

export interface PanelResizeInjected {
  hooks: { live: SnapshotStore<ComposerUxSettings> }
  actions: {
    /** 写一个字段（boolean 或 number）。 */
    setField: (field: string, value: boolean | number) => void
  }
}

export type PanelResizeProps = PropsRuntime<'shell.overlay'> & InjectFace<PanelResizeInjected>

/** 拖拽起始状态（move/up 闭包共享）。 */
interface DragStart {
  readonly edge: ResizeEdge
  readonly x: number
  readonly y: number
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

/** 可拖拽的四边 + 右下角。 */
const EDGES: readonly ResizeEdge[] = ['left', 'right', 'top', 'bottom', 'br']

/** 渲染设置面板尺寸手柄；无面板或开关关闭时不渲染。 */
export function PanelResizeHandles({ useLive, actions }: PanelResizeProps) {
  const settings = useLive(value => ({
    // 「设置面板」栏（或总开关）关着时整块停用 —— 与导航滚动那处用同一个判据。
    sectionOn: activeSections(value).panel,
    panelResize: value.panelResize,
    panelWidth: value.panelWidth,
    panelHeight: value.panelHeight,
  }))
  const enabled = settings.sectionOn === true && settings.panelResize === true
  const [panel, setPanel] = useState<HTMLElement | null>(null)
  const [active, setActive] = useState<ResizeEdge | null>(null)
  const dragRef = useRef<DragStart | null>(null)

  // 发现/失去设置对话框（官方 shell 元素挂载 React 感知不到，故轮询；
  // 只在「有没有面板」真的变化时才 setState，避免无谓重渲染）。
  useEffect(() => {
    if (!enabled) {
      setPanel(null)
      return
    }
    let current: HTMLElement | null = null
    const probe = (): void => {
      const found = findSettingsPanel()
      if (found === current) return
      current = found
      setPanel(found)
    }
    probe()
    const timer = setInterval(probe, 250)
    return () => { clearInterval(timer) }
  }, [enabled])

  // 套用持久化尺寸：面板出现时、以及**尺寸设置变化时**（这样设置页里点
  // 「尺寸预设」当场就变，不必关掉设置再重开）。设置被清空时移除内联样式，
  // 回落到官方默认 800。
  useEffect(() => {
    if (panel === null) return
    const width = settings.panelWidth
    const height = settings.panelHeight
    if (width === undefined) panel.style.removeProperty('width')
    else panel.style.width = `${clampPanelWidth(width)}px`
    if (height === undefined) panel.style.removeProperty('height')
    else panel.style.height = `${clampPanelHeight(height)}px`
  }, [panel, settings.panelWidth, settings.panelHeight])

  if (!enabled || panel === null) return null

  const onPointerDown = (edge: ResizeEdge, event: React.PointerEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    const el = panel
    const rect = el.getBoundingClientRect()
    // 把「居中 flex 子项」转成固定定位后再拖：居中的元素一改宽度会**两侧同时
    // 伸缩**，拖右边左边也跟着动，手感是错的。转成 fixed 之后拖哪边就只动哪边。
    el.style.position = 'fixed'
    el.style.margin = '0'
    el.style.left = `${rect.left}px`
    el.style.top = `${rect.top}px`
    el.style.width = `${rect.width}px`
    el.style.height = `${rect.height}px`

    const start: DragStart = {
      edge, x: event.clientX, y: event.clientY,
      left: rect.left, top: rect.top, width: rect.width, height: rect.height,
    }
    dragRef.current = start
    setActive(edge)
    document.body.style.cursor = String(handleBox(edge).cursor ?? 'default')
    document.body.style.userSelect = 'none'

    const onMove = (move: PointerEvent): void => {
      if (dragRef.current !== start) return
      move.preventDefault()
      const dx = move.clientX - start.x
      const dy = move.clientY - start.y
      let { left, top, width, height } = start
      if (edge === 'right' || edge === 'br') width = clampPanelWidth(start.width + dx)
      if (edge === 'bottom' || edge === 'br') height = clampPanelHeight(start.height + dy)
      if (edge === 'left') {
        width = clampPanelWidth(start.width - dx)
        left = start.left + (start.width - width)
      }
      if (edge === 'top') {
        height = clampPanelHeight(start.height - dy)
        top = start.top + (start.height - height)
      }
      el.style.left = `${Math.round(left)}px`
      el.style.top = `${Math.round(top)}px`
      el.style.width = `${Math.round(width)}px`
      el.style.height = `${Math.round(height)}px`
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      dragRef.current = null
      setActive(null)
      const box = el.getBoundingClientRect()
      actions.setField(PANEL_WIDTH_FIELD, Math.round(clampPanelWidth(box.width)))
      actions.setField(PANEL_HEIGHT_FIELD, Math.round(clampPanelHeight(box.height)))
      document.body.style.removeProperty('cursor')
      document.body.style.removeProperty('user-select')
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return createPortal(
    <div className={RESIZE_LAYER_CLASS} data-composer-ux-resize>
      <div className={RESIZE_OUTLINE_CLASS} style={RESIZE_OUTLINE_STYLE} />
      {EDGES.map(edge => (
        <div
          key={edge}
          className={edge === 'br' ? RESIZE_GRIP_CLASS : RESIZE_EDGE_CLASS}
          data-active={active === edge ? 'true' : undefined}
          title={edge === 'br' ? '拖动改面板大小' : undefined}
          style={handleBox(edge)}
          onPointerDown={event => { onPointerDown(edge, event) }}
        >
          {edge === 'br' && (
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
              <path
                d="M11 1 1 11M11 6 6 11"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          )}
        </div>
      ))}
    </div>,
    panel,
  )
}
