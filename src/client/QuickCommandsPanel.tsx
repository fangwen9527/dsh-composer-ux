/**
 * 「快捷指令」展开面板：注册进 shell.overlay（root 级浮层，不受输入卡片裁剪）。
 *
 * 面板形态（0.3.0 起是**分类两级**结构）：
 *  - 顶部：「✨ 优化提示词」主按钮 + 三档强度分段控件；
 *  - 分类行：一个分类一个标签，点它切换；「＋ 新分类」直接加一个（改名/删除在设置页，
 *    面板保持轻量，避免在这里塞一套重命名 UI）；
 *  - 中部：当前分类的条目 —— 点条目把内容插入输入框，右侧三选一是插入模式
 *    （关 / 每次 / 仅首次）；列表最下边那一行「＋」负责新建与跨分类移动。
 *    （勾上后点发送时自动附加到消息末尾，**跨分类生效**）；
 *  - 底部：状态提示 + 指路设置页。
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import {
  DEFAULT_CATEGORY_NAME, OPTIMIZER_TIERS, QUICK_CATEGORY_MAX, insertModeOf,
  type ComposerUxSettings, type InsertMode, type OptimizerTier, type QuickPromptBook,
} from '../settings-contract.ts'
import { bookCounts } from './prompt-book.ts'
import { AddPromptRow } from './AddPromptRow.tsx'
import { InsertModeControl } from './InsertModeControl.tsx'
import type { QuickPanelAnchor } from './QuickCommandsButton.tsx'
import {
  quickAlwaysBox, quickAlwaysLabel, quickCategoryAdd, quickCategoryRow, quickCategoryTab,
  quickCategoryTabActive, quickEmpty, quickFootHint, quickItem, quickItemLabel,
  quickItemPreview, quickList, quickNotice, quickPanel, quickPanelFoot, quickPanelHead,
  quickPanelTitle, quickPanelTitleRow, quickPrimaryButton, quickPrimaryButtonDisabled,
  quickTierButton, quickTierButtonActive, quickTierRow,
} from './styles.ts'

/** 面板注入面。 */
export interface QuickPanelInjected {
  hooks: {
    /** 当前设置（档位 + 总开关）。 */
    live: SnapshotStore<ComposerUxSettings>
    /** 面板锚点；null = 面板关闭。 */
    panel: SnapshotStore<QuickPanelAnchor | null>
    /** 是否有一次优化在飞。 */
    busy: SnapshotStore<boolean>
    /** 面板状态提示（空串 = 无）。 */
    notice: SnapshotStore<string>
    /** 快捷指令本（真相在磁盘那份 quick-prompts.json）。 */
    book: SnapshotStore<QuickPromptBook>
    /** '' = 正常；'saving' = 正在写；其余 = 上一次的错误文案。 */
    bookStatus: SnapshotStore<string>
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
    /** 设置某条的插入模式（关 / 每次 / 仅首次；按 id 跨分类找）。 */
    setInsertMode: (promptId: string, mode: InsertMode) => void
    /** 新增一个分类（名字由设置页再改）。 */
    addCategory: (name: string) => void
    /** 在当前分类里新建一条（占位正文，具体内容到设置页改）。 */
    addPrompt: (categoryId: string) => void
    /** 把某条从它所在分类移到目标分类（「移动到这里」）。 */
    movePrompt: (promptId: string, toCategoryId: string) => void
    /** 从磁盘重读（文件被手工改过时的兜底）。 */
    reloadBook: () => void
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
  useLive, usePanel, useBusy, useNotice, useBook, useBookStatus, actions,
}: QuickCommandsPanelProps) {
  const settings = useLive(item => item)
  const anchor = usePanel(item => item)
  const busy = useBusy(item => item)
  const notice = useNotice(item => item)
  const book = useBook(item => item)
  const status = useBookStatus(item => item)
  const ref = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const [activeId, setActiveId] = useState('')

  const counts = bookCounts(book)
  const categories = book.categories
  const active = categories.find(category => category.id === activeId) ?? categories[0]

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
  }, [anchor?.left, anchor?.bottom, counts.prompts, categories.length, busy])

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

  const tier = settings.optimizerTier
  const items = active?.prompts ?? []
  const failure = status !== '' && status !== 'saving' ? status : ''

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
        <div style={quickCategoryRow}>
          {categories.map(category => (
            <button
              key={category.id}
              type="button"
              title={`${category.name}（${String(category.prompts.length)} 条）`}
              aria-pressed={category.id === active?.id}
              style={category.id === active?.id ? quickCategoryTabActive : quickCategoryTab}
              onMouseDown={event => { event.preventDefault() }}
              onClick={() => { setActiveId(category.id) }}
            >
              {category.name}
            </button>
          ))}
          <button
            type="button"
            style={quickCategoryAdd}
            disabled={categories.length >= QUICK_CATEGORY_MAX}
            title="新增一个分类（名字到「设置 → 输入体验」里改）"
            onMouseDown={event => { event.preventDefault() }}
            onClick={() => {
              actions.addCategory(DEFAULT_CATEGORY_NAME)
            }}
          >
            ＋
          </button>
        </div>
      </div>

      <div style={quickList}>
        {items.length === 0 && (
          <div style={quickEmpty}>
            这个分类里还没有条目。<br />
            在「设置 → 输入体验 → 快捷指令清单」里添加。
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
            <InsertModeControl
              compact
              label={item.label}
              mode={insertModeOf(item)}
              onChange={mode => { actions.setInsertMode(item.id, mode) }}
            />
          </div>
        ))}
        {active !== undefined && (
          <AddPromptRow
            variant="panel"
            book={book}
            categoryId={active.id}
            onAdd={() => { actions.addPrompt(active.id) }}
            onMove={promptId => { actions.movePrompt(promptId, active.id) }}
          />
        )}
      </div>

      <div style={quickPanelFoot}>
        <span style={quickNotice} role="status">{notice !== '' ? notice : failure}</span>
        <span
          style={quickFootHint}
          title="数据在 ~/.dsh/quick-prompts.json"
        >
          {counts.categories} 分类 · {counts.prompts} 条
        </span>
      </div>
    </div>
  )
}
