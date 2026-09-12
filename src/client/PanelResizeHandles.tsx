/**
 * 设置面板边缘拖拽手柄：注册进 shell.overlay（root 级），仅在设置对话框
 * 打开且「边缘调整大小」开关开启时渲染 8 条手柄（四边 + 四角）。
 * 拖拽只改对话框内联 width/height（面板由 overlay flex 居中，无需移动
 * 定位）；松手时把尺寸写入设置持久化。
 */
import React, { useEffect, useRef, useState } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import { PANEL_HEIGHT_FIELD, PANEL_WIDTH_FIELD, type ComposerUxSettings } from '../settings-contract.ts'
import {
  clampPanelHeight, clampPanelWidth, findSettingsPanel,
} from './panel.ts'

export interface PanelResizeInjected {
  hooks: { live: SnapshotStore<ComposerUxSettings> }
  actions: {
    /** 写一个字段（boolean 或 number）。 */
    setField: (field: string, value: boolean | number) => void
  }
}

export type PanelResizeProps = PropsRuntime<'shell.overlay'> & InjectFace<PanelResizeInjected>

type Edge = 'left' | 'right' | 'top' | 'bottom' | 'tl' | 'tr' | 'bl' | 'br'

interface StripRect {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
  readonly cursor: string
}

function stripRect(edge: Edge, rect: DOMRect): StripRect {
  const horizontal = (left: number, width: number): StripRect => ({
    left, top: rect.top + 12, width, height: Math.max(0, rect.height - 24), cursor: 'ew-resize',
  })
  const vertical = (top: number, height: number): StripRect => ({
    left: rect.left + 16, top, width: Math.max(0, rect.width - 32), height, cursor: 'ns-resize',
  })
  const corner = (left: number, top: number, horizontalCursor: string, verticalCursor: string): StripRect => ({
    left, top, width: 18, height: 18, cursor: horizontalCursor,
  })
  const corners: Record<'tl' | 'tr' | 'bl' | 'br', string> = {
    tl: 'nwse-resize', tr: 'nesw-resize', bl: 'nesw-resize', br: 'nwse-resize',
  }
  switch (edge) {
    case 'left': return horizontal(rect.left - 4, 8)
    case 'right': return horizontal(rect.right - 4, 8)
    case 'top': return vertical(rect.top - 4, 8)
    case 'bottom': return vertical(rect.bottom - 4, 8)
    case 'tl': return corner(rect.left - 6, rect.top - 6, corners.tl, 'nwse')
    case 'tr': return corner(rect.right - 12, rect.top - 6, corners.tr, 'nesw')
    case 'bl': return corner(rect.left - 6, rect.bottom - 14, corners.bl, 'nesw')
    case 'br': return corner(rect.right - 12, rect.bottom - 14, corners.br, 'nwse')
  }
}

/** 渲染设置面板边缘手柄；无面板、总开关关闭或开关关闭时返回 null。 */
export function PanelResizeHandles({ useLive, actions }: PanelResizeProps) {
  const settings = useLive(value => ({
    enabled: value.enabled,
    panelResize: value.panelResize,
    panelWidth: value.panelWidth,
    panelHeight: value.panelHeight,
  }))
  // 探测轮询闭包只挂在 enabled 上，需经 ref 读最新值，避免捕获陈旧快照。
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const enabled = settings.enabled === true && settings.panelResize === true
  const [rect, setRect] = useState<DOMRect | null>(null)
  const appliedRef = useRef(false)

  // 探测设置对话框出现/消失（250ms 轮询足够便宜，且规避 React 无法感知
  // 的 shell 元素挂载事件）；窗口尺寸变化时同步刷新。
  useEffect(() => {
    if (!enabled) {
      setRect(null)
      return
    }
    const probe = (): void => {
      const panel = findSettingsPanel()
      if (panel === null) {
        appliedRef.current = false
        setRect(current => (current === null ? null : null))
        return
      }
      // 打开瞬间套用一次持久化尺寸。
      if (!appliedRef.current) {
        appliedRef.current = true
        const width = settingsRef.current.panelWidth
        const height = settingsRef.current.panelHeight
        if (width !== undefined) panel.style.width = `${clampPanelWidth(width)}px`
        if (height !== undefined) panel.style.height = `${clampPanelHeight(height)}px`
      }
      setRect(panel.getBoundingClientRect())
    }
    probe()
    const timer = setInterval(probe, 250)
    const onResize = (): void => { setRect(current => current === null ? null : findSettingsPanel()?.getBoundingClientRect() ?? null) }
    window.addEventListener('resize', onResize)
    return () => { clearInterval(timer); window.removeEventListener('resize', onResize) }
  }, [enabled])

  if (!enabled || rect === null) return null

  const onPointerDown = (edge: Edge, event: React.PointerEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    const panel = findSettingsPanel()
    if (panel === null) return
    const start = {
      edge,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: panel.clientWidth,
      startHeight: panel.clientHeight,
    }
    const onMove = (move: PointerEvent): void => {
      if (dragStartRef.current !== start || dragStartRef.current === null) return
      move.preventDefault()
      const panelEl = findSettingsPanel()
      if (panelEl === null) return
      const dx = move.clientX - start.startX
      const dy = move.clientY - start.startY
      let width = start.startWidth
      let height = start.startHeight
      if (edge === 'left' || edge === 'right' || edge === 'tl' || edge === 'bl' || edge === 'tr' || edge === 'br') {
        width = start.startWidth + (edge === 'left' || edge === 'tl' || edge === 'bl' ? -dx : dx)
      }
      if (edge === 'top' || edge === 'bottom' || edge === 'tl' || edge === 'bl' || edge === 'tr' || edge === 'br') {
        height = start.startHeight + (edge === 'top' || edge === 'tl' || edge === 'tr' ? -dy : dy)
      }
      panelEl.style.width = `${Math.round(clampPanelWidth(width))}px`
      panelEl.style.height = `${Math.round(clampPanelHeight(height))}px`
      setRect(panelEl.getBoundingClientRect())
    }
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      dragStartRef.current = null
      const panelEl = findSettingsPanel()
      if (panelEl !== null) {
        actions.setField(PANEL_WIDTH_FIELD, Math.round(clampPanelWidth(panelEl.clientWidth)))
        actions.setField(PANEL_HEIGHT_FIELD, Math.round(clampPanelHeight(panelEl.clientHeight)))
      }
      document.body.style.removeProperty('cursor')
      document.body.style.removeProperty('user-select')
    }
    dragStartRef.current = start
    document.body.style.cursor = stripRect(edge, rect).cursor
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const edges: readonly Edge[] = ['left', 'right', 'top', 'bottom', 'tl', 'tr', 'bl', 'br']

  return (
    <>
      {edges.map(edge => {
        const pos = stripRect(edge, rect)
        return (
          <div
            key={edge}
            onPointerDown={event => { onPointerDown(edge, event) }}
            onPointerEnter={event => { event.currentTarget.style.background = 'var(--dsw-alias-state-business-primary)'; event.currentTarget.style.opacity = '0.75' }}
            onPointerLeave={event => { event.currentTarget.style.background = 'transparent'; event.currentTarget.style.opacity = '0' }}
            style={{
              position: 'fixed',
              zIndex: 9998,
              left: pos.left,
              top: pos.top,
              width: pos.width,
              height: pos.height,
              cursor: pos.cursor,
              background: 'transparent',
              opacity: 0,
              borderRadius: 6,
              pointerEvents: 'auto',
              touchAction: 'none',
            }}
          />
        )
      })}
    </>
  )
}

/** 拖拽起始状态（onMove/onUp 闭包共享）。 */
const dragStartRef: { current: null | { edge: Edge; startX: number; startY: number; startWidth: number; startHeight: number } } = { current: null }
