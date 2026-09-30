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
import { useOptimizeElapsed } from './optimize-clock.ts'
import { DEFAULT_PANEL_SECTION, sectionForDock, toggleSection, type PanelSection } from './panel-sections.ts'
import { OptimizeDock } from './OptimizeDock.tsx'
import type { OptimizeDockState } from './optimize-dock.ts'
import type { QuickPanelAnchor } from './QuickCommandsButton.tsx'
import {
  quickAlwaysBox, quickAlwaysLabel, quickCategoryAdd, quickCategoryRow, quickCategoryTab,
  quickCategoryTabActive, quickEmpty, quickFootHint, quickItem, quickItemLabel,
  quickItemPreview, quickList, quickNotice, quickPanel, quickPanelFoot, quickPanelHead,
  quickPanelTitle, quickPanelTitleRow, quickPrimaryButton, quickPrimaryButtonDisabled,
  quickTierButton, quickTierButtonActive, quickTierRow,
  quickSectionBody, quickSectionToggle, quickSectionToggleArrow,
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
    /** 这次优化的起始时刻（0 = 没在跑；秒表读数由它算）。 */
    startedAt: SnapshotStore<number>
    /** 面板状态提示（空串 = 无）。 */
    notice: SnapshotStore<string>
    /** 快捷指令本（真相在磁盘那份 quick-prompts.json）。 */
    book: SnapshotStore<QuickPromptBook>
    /** '' = 正常；'saving' = 正在写；其余 = 上一次的错误文案。 */
    bookStatus: SnapshotStore<string>
    /** 优化结果框（0.12.0）；null = 框收起。 */
    dock: SnapshotStore<OptimizeDockState | null>
  }
  actions: {
    /** 关闭面板。 */
    close: () => void
    /** 把一段文本插进输入框。 */
    insert: (text: string) => void
    /** 用当前输入框内容跑一次优化，结果写回输入框。 */
    optimize: () => void
    /** 把结果框里的成品写回输入框（必要时先要一次确认，见 insertDecision）。 */
    dockInsert: () => void
    /** 用同一段原文再跑一轮。 */
    dockRetry: () => void
    /** 中止这一轮并保留已生成的部分。 */
    dockCancel: () => void
    /** 收起结果框（丢弃框里的内容）。 */
    dockClose: () => void
    /** 用户在框里手改了成品。 */
    dockEdit: (text: string) => void
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
  useLive, usePanel, useBusy, useStartedAt, useNotice, useBook, useBookStatus, useDock, actions,
}: QuickCommandsPanelProps) {
  const settings = useLive(item => item)
  const anchor = usePanel(item => item)
  const busy = useBusy(item => item)
  const startedAt = useStartedAt(item => item)
  const notice = useNotice(item => item)
  const book = useBook(item => item)
  const status = useBookStatus(item => item)
  const dock = useDock(item => item)
  const ref = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const [activeId, setActiveId] = useState('')
  /**
   * 面板中部显示哪一半（0.13.1）。
   *
   * 用户 2026-09-30 要的形态：「优化提示词」与「快捷指令」两半，中间一个切换按钮，
   * 默认展开**快捷指令**；点切换按钮就换成优化那半（档位与 ✨ 按钮始终在标题行）。
   * 跑起来或已有结果时**自动切到优化那半** —— 否则刚跑出来的东西会被自己藏在收起状态里。
   */
  const [section, setSection] = useState<PanelSection>(DEFAULT_PANEL_SECTION)
  const dockPresent = dock !== null
  // 秒表：非流式下能显示的最细阶段就是"等待模型响应"，所以这里只报已等待秒数。
  const seconds = useOptimizeElapsed(busy ? startedAt : 0)
  /**
   * 结果框是否正在跑。
   *
   * ⚠️ 必须算在 `useEffect` **之前**：下面的 Escape 处理把 `dockRunning` 放进了依赖数组，
   * 而依赖数组是在渲染期就地求值的 —— 声明在后面会撞上暂时性死区（TDZ）。
   */
  const dockRunning = dock !== null && dock.phase === 'running'
  const dockSeconds = useOptimizeElapsed(dockRunning && dock !== null ? dock.startedAt : 0)

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
    // `section` 也在依赖里：换半时面板高度会变（结果框 vs 列表），位置得跟着重算。
  }, [anchor?.left, anchor?.bottom, counts.prompts, categories.length, busy, section, dock !== null])

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
      // 优化在跑时 Esc = 中止（保留已生成的部分），**不关面板** —— 按 Esc 多半只是想中止
      // 这次等待，把面板连同现场一起收走就过头了（与对方 0.3.17 的 cancel/close 之分同义）。
      if (dockRunning) {
        actions.dockCancel()
        return
      }
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
  }, [anchor === null, actions, dockRunning])

  /**
   * 结果框"从无到有"的那一刻自动切到「优化提示词」那一半 ——
   * 否则用户点了 ✨ 之后，结果被自己藏在收起的那一半里，看起来像"没反应"。
   *
   * 为什么在**渲染期**做而不是 `useEffect`：
   *  · effect 要等提交之后才跑，中间会先渲染一帧"快捷指令"那半 —— 点 ✨ 会看到面板闪一下；
   *  · 而且 SSR 里 effect 根本不跑，于是"有结果框就该显示优化半"这条在渲染测试里测不到
   *    （第一版这么写时，渲染套件里 7 条全红，红的全是这一组）。
   * 这是 React 文档里"props 变化时同步调整 state"的写法：只在**变化的那一次**设置，不会死循环；
   * 用户手动切回快捷指令时 `dockPresent` 没变，也不会被抢回去。
   */
  // ⚠️ 初值必须是 false（默认那一半假设"没有结果框"），不能写成 `useRef(dockPresent)`：
  //   后者让首帧的"变化"永远不成立，于是"面板重开时结果框本来就在"这种情况不会切过去。
  const prevDockPresent = useRef(false)
  if (prevDockPresent.current !== dockPresent) {
    prevDockPresent.current = dockPresent
    const next = sectionForDock(dockPresent, section)
    if (next !== section) setSection(next)
  }

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
          title="把输入框里的话交给另一个 AI 整理成一条可以直接发出去的清晰指令，结果直接写回输入框。它只能产出能指回你原话某一句的补全，指不回去的会被丢掉并记账"
          style={busy ? quickPrimaryButtonDisabled : quickPrimaryButton}
          onMouseDown={event => { event.preventDefault() }}
          onClick={() => { actions.optimize() }}
        >
          <span aria-hidden>✨</span>
          <span>{busy ? `优化中…（${String(seconds)}s）` : '优化提示词'}</span>
        </button>
      </div>

      {/*
        中间那个切换按钮（用户 2026-09-30 要的形态）：点它 = 展开「优化提示词」那一半、
        收起「快捷指令」；再点 = 换回来。标题行的档位与 ✨ 按钮**始终露在外面**，
        所以"跑一次优化"永远是一步（不必先展开）。
      */}
      <button
        type="button"
        style={quickSectionToggle}
        aria-expanded={section === 'optimize'}
        title={section === 'optimize'
          ? '收起「优化提示词」，回到「快捷指令」'
          : '展开「优化提示词」（结果框就在里面；上面点 ✨ 也会自动展开）'}
        onMouseDown={event => { event.preventDefault() }}
        onClick={() => { setSection(toggleSection(section)) }}
      >
        <span style={quickSectionToggleArrow} aria-hidden>{section === 'optimize' ? '▾' : '▸'}</span>
        <span>优化提示词</span>
        <span style={{ marginLeft: 'auto', color: 'var(--dsw-alias-label-tertiary)' }}>
          {section === 'optimize'
            ? '点此回到快捷指令'
            : dockPresent ? '上次的结果在这儿' : '还没有结果'}
        </span>
      </button>

      <div style={quickSectionBody}>
      {dock !== null && section === 'optimize' && (
        <div style={{ padding: '8px 12px 8px', flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <OptimizeDock
            state={dock}
            seconds={dockSeconds}
            actions={{
              insert: actions.dockInsert,
              retry: actions.dockRetry,
              cancel: actions.dockCancel,
              // 关掉结果框顺手切回快捷指令那半：此时优化半已经没内容了。
              close: () => { actions.dockClose(); setSection(DEFAULT_PANEL_SECTION) },
              edit: actions.dockEdit,
            }}
          />
        </div>
      )}
      {section === 'optimize' && dock === null && (
        <div style={quickEmpty}>
          还没跑过优化。<br />
          点上面的「✨ 优化提示词」把输入框里的话交给另一个 AI 整理成一条能直接发的清晰指令 ——
          结果会出现在这里（可编辑、可插入输入框、可复制）。<br />
          强度用标题行那三个档位（普通 / 高级 / 极端）。
        </div>
      )}

      {section === 'quick' && (
        <>
          <div style={{ padding: '8px 12px 0' }}>
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
        </>
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
