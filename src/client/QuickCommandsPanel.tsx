/**
 * 「快捷指令」展开面板：注册进 shell.overlay（root 级浮层，不受输入卡片裁剪）。
 *
 * 面板形态（与用户确认过的语义一致）：
 *  - 顶部：「✨ 优化提示词」主按钮 + 三档强度分段控件；
 *  - 中部：快捷指令条目列表 —— 点条目把内容插入输入框，条目右侧的勾选框就是
 *    「默认插入」（勾上后点发送时自动附加到消息末尾）；
 *  - 底部：状态提示 + 指路设置页。
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import {
  OPTIMIZER_TIERS, type ComposerUxSettings, type OptimizerTier,
} from '../settings-contract.ts'
import type { QuickPanelAnchor } from './QuickCommandsButton.tsx'
import {
  quickAlwaysBox, quickAlwaysLabel, quickEmpty, quickFootHint, quickItem, quickItemLabel,
  quickItemPreview, quickList, quickNotice, quickPanel, quickPanelFoot, quickPanelHead,
  quickPanelTitle, quickPanelTitleRow, quickPrimaryButton, quickPrimaryButtonDisabled,
  quickTierButton, quickTierButtonActive, quickTierRow,
} from './styles.ts'

/** 面板注入面。 */
export interface QuickPanelInjected {
  hooks: {
    /** 当前设置（快捷指令列表 + 档位 + 总开关）。 */
    live: SnapshotStore<ComposerUxSettings>
    /** 面板锚点；null = 面板关闭。 */
    panel: SnapshotStore<QuickPanelAnchor | null>
    /** 是否有一次优化在飞。 */
    busy: SnapshotStore<boolean>
    /** 面板状态提示（空串 = 无）。 */
    notice: SnapshotStore<string>
  }
  actions: {
    /** 关闭面板。 */
    close: () => void
    /** 把一段文本插进输入框。 */
    insert: (text: string) => void
    /** 用当前输入框内容跑一次优化，结果写回输入框。 */
    optimize: () => void
    /** 切换优化档位。 */
    setTier: (tier: OptimizerTier) => void
    /** 切换某条快捷指令的「默认插入」。 */
    setAlways: (id: string, value: boolean) => void
  }
}

export type QuickCommandsPanelProps =
  PropsRuntime<'shell.overlay'>
  & InjectFace<QuickPanelInjected>

/** 与视口边界保持的间距。 */
const MARGIN = 8
/** 面板与锚点按钮之间的间距。 */
const GAP = 8

/** 展开面板。 */
export function QuickCommandsPanel({
  useLive, usePanel, useBusy, useNotice, actions,
}: QuickCommandsPanelProps) {
  const settings = useLive(item => item)
  const anchor = usePanel(item => item)
  const busy = useBusy(item => item)
  const notice = useNotice(item => item)
  const ref = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  // 贴锚点按钮上方；放不下就翻到下方；左右钳制在视口内。
  useLayoutEffect(() => {
    if (anchor === null) {
      setPosition(null)
      return
    }
    const el = ref.current
    const height = el === null ? 320 : el.getBoundingClientRect().height
    const width = el === null ? 420 : el.getBoundingClientRect().width
    const left = Math.max(MARGIN, Math.min(anchor.left, window.innerWidth - width - MARGIN))
    const above = anchor.bottom - height - GAP
    const top = above >= MARGIN ? above : Math.min(anchor.bottom + GAP, window.innerHeight - height - MARGIN)
    setPosition({ left, top: Math.max(MARGIN, top) })
  }, [anchor?.left, anchor?.bottom, settings.quickPrompts.length, busy])

  // 外部点击 / Escape / 滚动 / 缩放时关闭（与右键菜单同一套规则）。
  useEffect(() => {
    if (anchor === null) return
    const onPointerDown = (event: PointerEvent): void => {
      if (ref.current !== null && event.target instanceof Node && ref.current.contains(event.target)) return
      // 点入口按钮本身由它自己 toggle，这里让路，免得「关了又开」。
      if (event.target instanceof Element && event.target.closest('.composer-ux-quick-button') !== null) return
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
    window.addEventListener('resize', actions.close)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onEscape, true)
      window.removeEventListener('resize', actions.close)
    }
  }, [anchor === null, actions])

  if (anchor === null) return null

  const items = settings.quickPrompts
  const tier = settings.optimizerTier

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="快捷指令"
      style={{ ...quickPanel, left: position?.left ?? anchor.left, top: position?.top ?? anchor.bottom }}
    >
      <div style={quickPanelHead}>
        <div style={quickPanelTitleRow}>
          <span style={quickPanelTitle}>快捷指令</span>
          <div style={quickTierRow} role="group" aria-label="优化强度">
            {OPTIMIZER_TIERS.map(item => (
              <button
                key={item.id}
                type="button"
                title={item.hint}
                aria-pressed={tier === item.id}
                style={tier === item.id ? quickTierButtonActive : quickTierButton}
                onMouseDown={event => { event.preventDefault() }}
                onClick={() => { actions.setTier(item.id) }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          title="把输入框里的话交给另一个 AI 整理成一条可以直接发出去的清晰指令，结果直接写回输入框"
          style={busy ? quickPrimaryButtonDisabled : quickPrimaryButton}
          onMouseDown={event => { event.preventDefault() }}
          onClick={() => { actions.optimize() }}
        >
          <span aria-hidden>✨</span>
          <span>{busy ? '优化中…' : '优化提示词'}</span>
        </button>
      </div>

      <div style={quickList}>
        {items.length === 0 && (
          <div style={quickEmpty}>
            还没有快捷指令。<br />
            在「设置 → 输入体验 → 快捷指令」里添加。
          </div>
        )}
        {items.map(item => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              type="button"
              title={item.prompt}
              style={quickItem}
              onMouseDown={event => { event.preventDefault() }}
              onClick={() => { actions.insert(item.prompt) }}
            >
              <span style={quickItemLabel}>{item.label}</span>
              <span style={quickItemPreview}>{item.prompt.replace(/\s+/g, ' ')}</span>
            </button>
            <label style={quickAlwaysLabel} title="勾上后，点发送时这条提示词会自动附加到你的消息末尾">
              <input
                type="checkbox"
                style={quickAlwaysBox}
                checked={item.always}
                onChange={event => { actions.setAlways(item.id, event.target.checked) }}
              />
              默认插入
            </label>
          </div>
        ))}
      </div>

      <div style={quickPanelFoot}>
        <span style={quickNotice} role="status">{notice}</span>
        <span style={quickFootHint}>设置 → 输入体验</span>
      </div>
    </div>
  )
}
