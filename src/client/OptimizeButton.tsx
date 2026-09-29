/**
 * 「优化提示词」独立按钮（0.11.1 新增）。
 *
 * 坐在官方输入卡片工具行里、「快捷指令」按钮的**左侧**
 * （槽位 `conversation.input.right`，order 88 < 快捷指令的 89 < 官方「展开」的 90）。
 *
 * 为什么要有它：优化原来藏在快捷指令面板里，点两下才到（开面板 → 点面板里的按钮），
 * 而"把这句话理顺了再发"是高频动作。独立按钮把它变成一下：点它 = 打开面板（结果与
 * 状态行显示在那儿）+ 立即开跑。位置与对方 0.3.17 的发送栏按钮一致。
 *
 * 本组件只做三件事：读草稿决定能不能点、显示秒表、把自身矩形交给面板当锚点。
 */
import React, { useRef } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import { activeSections, splitSlashCommand, type ComposerUxSettings } from '../settings-contract.ts'
import { QUICK_BUTTON_CLASS } from './quick-style.ts'
import { useOptimizeElapsed } from './optimize-clock.ts'
import type { QuickPanelAnchor } from './QuickCommandsButton.tsx'

/** 「优化提示词」注入面。 */
export interface OptimizeButtonInjected {
  hooks: {
    /** 当前设置（「快捷指令」栏开关关着时这枚按钮不出现）。 */
    live: SnapshotStore<ComposerUxSettings>
    /** 是否有一次优化在飞。 */
    busy: SnapshotStore<boolean>
    /** 这次优化的起始时刻（0 = 没在跑）。 */
    startedAt: SnapshotStore<number>
  }
  actions: {
    /** 打开面板并立刻用输入框里的内容跑一次优化（面板负责显示状态与结果）。 */
    openAndOptimize: (anchor: QuickPanelAnchor) => void
  }
}

export type OptimizeButtonProps =
  PropsRuntime<'conversation.input.right'>
  & InjectFace<OptimizeButtonInjected>

/** 工具行里的「优化」按钮。 */
export function OptimizeButton({ useInput, useLive, useBusy, useStartedAt, actions }: OptimizeButtonProps) {
  const settings = useLive(item => item)
  const busy = useBusy(item => item)
  const startedAt = useStartedAt(item => item)
  const draft = useInput(state => state.draft)
  const seconds = useOptimizeElapsed(busy ? startedAt : 0)
  const ref = useRef<HTMLButtonElement | null>(null)

  // 与「快捷指令」按钮同一个开关：关着时整个入口都不出现，不给老用户平白加一枚按钮。
  if (!activeSections(settings).quick) return null

  const text = typeof draft === 'string' ? draft : ''
  // 只有命令没有正文（`/goal`）时也没什么可优化的 —— 与 optimize() 里的判定同一套。
  const slash = splitSlashCommand(text)
  const noContent = text.trim() === '' || (slash.prefix !== '' && slash.body === '')
  const disabled = busy || noContent

  return (
    <button
      ref={ref}
      type="button"
      className={QUICK_BUTTON_CLASS}
      disabled={disabled}
      aria-busy={busy}
      title={noContent
        ? '输入框里还没有可优化的内容'
        : '把输入框里的话交给另一个 AI 整理成一条可以直接发出去的清晰指令（结果写回输入框，Ctrl+Z 可还原）'}
      // 与旁边按钮一致：不让按钮抢走输入框里的选区。
      onMouseDown={event => { event.preventDefault() }}
      onClick={() => {
        const rect = ref.current?.getBoundingClientRect()
        actions.openAndOptimize({
          left: rect?.left ?? 0,
          bottom: rect?.bottom ?? 0,
          width: rect?.width ?? 0,
        })
      }}
    >
      <span aria-hidden>✨</span>
      <span>{busy ? `优化中…（${String(seconds)}s）` : '优化'}</span>
    </button>
  )
}
