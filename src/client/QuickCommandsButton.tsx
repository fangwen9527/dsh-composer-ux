/**
 * 「快捷指令」按钮：坐在官方输入卡片工具行里「展开」按钮的旁边
 * （槽位 `conversation.input.right`，order 89 < 展开的 90），形状与它同款胶囊。
 *
 * 本组件只做三件事：
 *  1. 把官方的 `inputActions` 与当前草稿投递给 quick-commands 桥接
 *     （「默认插入」的发送拦截必须拿到它们，拦截器活在 React 之外）；
 *  2. 渲染按钮、点击后把自身矩形交给面板做锚点；
 *  3. 把面板的开合状态反射到 `aria-expanded`。
 */
import React, { useEffect, useRef } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ComposerUxSettings } from '../settings-contract.ts'
import { publishInputBridge, releaseInputBridge, type InputActionsLike } from './quick-commands.ts'
import { QUICK_BUTTON_CLASS } from './quick-style.ts'

/** 面板锚点：按钮的视口矩形（面板据此贴在上方）。 */
export interface QuickPanelAnchor {
  readonly left: number
  readonly bottom: number
  readonly width: number
}

/** 「快捷指令」注入面。 */
export interface QuickCommandsInjected {
  hooks: {
    /** 当前设置（总开关与快捷指令列表）。 */
    live: SnapshotStore<ComposerUxSettings>
    /** 面板锚点；null = 面板关闭。 */
    panel: SnapshotStore<QuickPanelAnchor | null>
  }
  actions: {
    /** 以给定锚点打开面板；已开则关闭（点按钮即开合）。 */
    toggle: (anchor: QuickPanelAnchor) => void
  }
}

export type QuickCommandsButtonProps =
  PropsRuntime<'conversation.input.right'>
  & InjectFace<QuickCommandsInjected>

/** 「快捷指令」入口按钮。 */
export function QuickCommandsButton({
  useInput, inputActions, sessionId, useSession, useLive, usePanel, actions,
}: QuickCommandsButtonProps) {
  const settings = useLive(item => item)
  const anchor = usePanel(item => item)
  const draft = useInput(state => state.draft)
  /**
   * 会话是不是还没有任何消息 —— 「仅首次插入」的判据。
   *
   * `useSession` 是 `conversation.input.right`（scope: session）的标准 props，与本组件
   * 已经在用的 `useInput` 来自同一份契约，所以无条件调用它；选择器里再挡一层 undefined
   * （选择器抛错会直接把 React 渲染打断，这里不值得冒险）。
   */
  const blank = useSession(state => state?.blank === true)
  const ref = useRef<HTMLButtonElement | null>(null)

  // 每次渲染把官方输入动作、草稿与「会话还是空的」投递给桥接：
  // 拦截器要在 React 之外读它们，而这些只有槽位能拿到。
  useEffect(() => {
    const sid = typeof sessionId === 'string' ? sessionId : ''
    publishInputBridge({
      actions: (inputActions ?? null) as InputActionsLike | null,
      draft: typeof draft === 'string' ? draft : '',
      sessionId: sid,
      blank: blank === true,
    })
    return () => { releaseInputBridge(sid) }
  }, [inputActions, draft, sessionId, blank])

  if (settings.enabled !== true) return null

  const open = anchor !== null

  return (
    <button
      ref={ref}
      type="button"
      className={QUICK_BUTTON_CLASS}
      aria-haspopup="dialog"
      aria-expanded={open}
      title="快捷指令：一键插入常用提示词，或把输入框里的话优化成一条清晰的指令"
      // 样式全部来自注入的样式表（见 quick-style.ts）：与旁边官方「展开」按钮
      // 逐项对齐，且 hover / 展开态只有样式表能表达。
      // 不让按钮抢走拖动时可能存在的输入框选区（与官方工具行一致）。
      onMouseDown={event => { event.preventDefault() }}
      onClick={() => {
        const rect = ref.current?.getBoundingClientRect()
        actions.toggle({
          left: rect?.left ?? 0,
          bottom: rect?.bottom ?? 0,
          width: rect?.width ?? 0,
        })
      }}
    >
      <svg
        viewBox="0 0 16 16"
        width="12"
        height="12"
        aria-hidden
      >
        <path
          d="M9.2 1.2 3.4 9.1h3.5l-0.9 5.7 6-8.1H8.4l0.8-5.5Z"
          fill="currentColor"
        />
      </svg>
      <span>快捷指令</span>
    </button>
  )
}
