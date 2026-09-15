/**
 * 设置页「输入体验」。
 *
 * 版式对齐社区插件 @linxin666/dsh-web-all 的「Web 插件」页：
 *   顶部常显：中文名 + 一行描述（内嵌英文包名 dsh-composer-ux）+ 总开关；
 *   其下三个栏目（键位 / 右键菜单 / 设置面板）为折叠卡，标题行只放一句
 *   概览，长说明与具体控件都在展开后的内容区里；默认全部折叠、不记忆。
 */
import React, { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsSectionOwnerProps } from '@deepseek-ai/dsh-client-ui-slots'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import {
  DEFAULT_CATEGORY_NAME, DEFAULT_HEADER_NAME, ENABLED_FIELD, HEADER_ENABLED_FIELD,
  HEADER_NAME_FIELD, HEADER_NAME_MAX, HEADER_ROUTES_FIELD, HEADER_VALUE_FIELD, HEADER_VALUE_MAX,
  MENU_ITEMS, MENU_NATIVE_FIELD, NEWLINE_PRESETS, OPTIMIZER_TIERS, OPTIMIZER_TIER_FIELD,
  PANEL_HEIGHT_FIELD,
  PANEL_RESIZE_FIELD, PANEL_SCROLL_FIELD, PANEL_WIDTH_FIELD, QUICK_CATEGORY_MAX,
  QUICK_CATEGORY_NAME_MAX, QUICK_LABEL_MAX,
  QUICK_PROMPTS_FIELD, QUICK_PROMPT_MAX, QUICK_TEXT_MAX, SEND_PRESETS,
  newQuickPromptId, newSessionId,
  type ComposerUxSettings, type MenuField, type OptimizerTier, type QuickPrompt,
  type QuickPromptBook, type SettingsField,
} from '../settings-contract.ts'
import {
  bookCounts, withCategoryAdded, withCategoryMoved, withCategoryRemoved, withCategoryRenamed,
  withPromptAdded, withPromptMoved, withPromptMovedToCategory, withPromptPatched, withPromptRemoved,
} from './prompt-book.ts'
import { AddPromptRow } from './AddPromptRow.tsx'
import {
  evaluateRecordedKey, displayChord, type ChordEvent,
} from './chords.ts'
import {
  description, hintError, hintInfo, kbd, pill, pillActive, row, rowDesc, rowText, rowTitle,
  textInput,
} from './styles.ts'

/** 设置页注入面。 */
export interface SettingsSectionInjected {
  hooks: {
    /** 当前解析后的设置快照。 */
    live: SnapshotStore<ComposerUxSettings>
    /** 快捷指令本（真相在磁盘那份 quick-prompts.json；这里只是它的客户端快照）。 */
    book: SnapshotStore<QuickPromptBook>
    /** '' = 正常；'saving' = 正在写；其余 = 上一次的错误文案。 */
    bookStatus: SnapshotStore<string>
  }
  actions: {
    /** 写一个字段（键位为规范串，开关为布尔，尺寸为数字）。 */
    setField: (field: SettingsField, value: unknown) => void
    /** 清空一个字段（回落到 schema 默认）。 */
    clearField: (field: SettingsField) => void
    /** 全部恢复默认（清空用户覆盖，回落到 schema 默认；快捷指令另见 resetBook）。 */
    resetAll: () => void
    /** 整本写回（编辑器里的「保存修改」）。 */
    saveBook: (next: QuickPromptBook) => void
    /** 从磁盘重新读取（别的窗口改过时的兜底）。 */
    reloadBook: () => void
    /** 恢复内置 9 条（写回默认本）。 */
    resetBook: () => void
  }
}

export type SettingsSectionProps =
  PropsRuntime<'settings.section'>
  & SettingsSectionOwnerProps
  & InjectFace<SettingsSectionInjected>

/** 展开区内的导语。 */
const bodyLead: CSSProperties = { ...description, margin: '12px 0' }

/** 折叠箭头（内联 SVG，展开时靠父级 class 旋转 180°）。 */
function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M3.25 5.5L7 9.25L10.75 5.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * 可折叠栏目：整行标题就是按钮，默认折叠且不记忆展开状态
 * （每次打开设置页都回到折叠）。
 */
function FoldCard(props: { name: string; summary: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <section className={open ? 'dsh-ux-card dsh-ux-cardOpen' : 'dsh-ux-card'}>
      <button
        type="button"
        className="dsh-ux-cardHeader"
        aria-expanded={open}
        onClick={() => { setOpen(current => !current) }}
      >
        <span className="dsh-ux-cardHeadText">
          <span className="dsh-ux-cardName">{props.name}</span>
          <span className="dsh-ux-cardDescription">{props.summary}</span>
        </span>
        <span className={open ? 'dsh-ux-cardChevron dsh-ux-cardChevronOpen' : 'dsh-ux-cardChevron'}>
          <Chevron />
        </span>
      </button>
      {open && <div className="dsh-ux-cardBody">{props.children}</div>}
    </section>
  )
}

/** 键位行：当前值 + 预设 + 录制 + 清除。 */
function KeyRow(props: {
  title: string
  desc: string
  value: string
  presets: readonly string[]
  conflict: (chord: string) => boolean
  onChange: (chord: string) => void
  /** 展开区里的第一行：不画上边框（内容区自己有一条分隔线）。 */
  first?: boolean
}) {
  const { title, desc, value, presets, conflict, onChange, first } = props
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!recording) return
    const onKeyDown = (event: KeyboardEvent): void => {
      // 录制期间吞掉所有按键，避免污染输入框或页面。
      event.preventDefault()
      event.stopPropagation()
      if (event.isComposing) return
      const result = evaluateRecordedKey(event as unknown as ChordEvent)
      if (result.kind === 'ignore') return
      if (result.kind === 'cancel') {
        setRecording(false)
        setError(null)
        return
      }
      if (result.kind === 'clear') {
        setRecording(false)
        setError(null)
        onChange('')
        return
      }
      if (result.kind === 'reject') {
        setError(result.message)
        return
      }
      if (conflict(result.chord)) {
        setRecording(false)
        setError('发送与换行不能设为相同按键（可先给另一侧换键，再绑定该键）。')
        return
      }
      setRecording(false)
      setError(null)
      onChange(result.chord)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => { window.removeEventListener('keydown', onKeyDown, true) }
  }, [recording, conflict, onChange])

  const base = first === true ? { ...row, borderTop: 'none' } : row

  return (
    <div style={{ ...base, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      <div style={rowText}>
        <div style={rowTitle}>{title}</div>
        <div style={rowDesc}>{desc}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={kbd}>{displayChord(value)}</span>
        {!recording && presets.map(preset => (
          <button
            key={preset}
            type="button"
            style={value === preset ? pillActive : pill}
            onClick={() => { setError(null); onChange(preset) }}
          >
            {displayChord(preset)}
          </button>
        ))}
        {!recording && value !== '' && (
          <button type="button" style={pill} onClick={() => { setError(null); onChange('') }}>
            清除
          </button>
        )}
        <button
          type="button"
          style={recording ? pillActive : pill}
          onClick={() => { setRecording(true); setError(null) }}
        >
          {recording ? '请按下新组合键…' : '自定义…'}
        </button>
        {recording && (
          <button type="button" style={pill} onClick={() => { setRecording(false); setError(null) }}>
            Esc 取消
          </button>
        )}
        {error !== null && (
          <span style={{ color: 'var(--dsw-alias-state-error-primary)', fontSize: 12 }}>{error}</span>
        )}
      </div>
    </div>
  )
}

/** 开关行。 */
function ToggleRow(props: {
  label: string
  desc?: string
  checked: boolean
  onChange: (next: boolean) => void
  /** 展开区里的第一行：不画上边框。 */
  first?: boolean
}) {
  const { label, desc, checked, onChange, first } = props
  return (
    <div style={first === true ? { ...row, borderTop: 'none' } : row}>
      <div style={rowText}>
        <div style={rowTitle}>{label}</div>
        {desc !== undefined && desc !== '' && <div style={rowDesc}>{desc}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => { onChange(!checked) }}
        style={{
          width: 36,
          height: 20,
          borderRadius: 999,
          border: '0.5px solid var(--dsw-alias-border-l2)',
          cursor: 'pointer',
          background: checked
            ? 'var(--dsw-alias-button-primary-fill)'
            : 'var(--dsw-alias-interactive-bg-hover)',
          position: 'relative',
          flex: '0 0 auto',
          padding: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 18 : 2,
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: checked
              ? 'var(--dsw-alias-label-primary-foreground)'
              : 'var(--dsw-alias-label-secondary)',
            transition: 'left 0.12s ease',
          }}
        />
      </button>
    </div>
  )
}

/** 文本字段行：标题 + 说明 + 输入框（可选动作按钮）。
 *  输入过程中只改本地草稿，失焦或回车才落盘——避免每敲一个字就写一次配置文件。 */
function TextFieldRow(props: {
  title: string
  desc: string
  value: string
  placeholder?: string
  maxLength: number
  onChange: (next: string) => void
  action?: { label: string; onClick: () => void }
  /** 展开区里的第一行：不画上边框。 */
  first?: boolean
}) {
  const { title, desc, value, placeholder, maxLength, onChange, action, first } = props
  const [draft, setDraft] = useState(value)
  const focused = useRef(false)

  // 只在没有焦点时跟随外部值：写盘是异步往返，输入中同步会把用户正在打的字回滚。
  useEffect(() => {
    if (!focused.current) setDraft(value)
  }, [value])

  const commit = (): void => {
    if (draft === value) return
    onChange(draft.trim())
  }

  const base = first === true ? { ...row, borderTop: 'none' } : row

  return (
    <div style={{ ...base, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      <div style={rowText}>
        <div style={rowTitle}>{title}</div>
        <div style={rowDesc}>{desc}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="text"
          value={draft}
          placeholder={placeholder ?? ''}
          maxLength={maxLength}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          onFocus={() => { focused.current = true }}
          onChange={event => { setDraft(event.target.value) }}
          onBlur={() => { focused.current = false; commit() }}
          onKeyDown={event => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            commit()
            event.currentTarget.blur()
          }}
          style={textInput}
        />
        {action !== undefined && (
          <button type="button" style={pill} onClick={action.onClick}>{action.label}</button>
        )}
      </div>
    </div>
  )
}

/** 快捷指令编辑区：本地草稿 + 显式保存（避免每敲一个字就写一次配置文件）。 */
/**
 * 快捷指令编辑器（0.3.0 起的分类两级结构）。
 *
 * 编辑在**本地草稿**上做：草稿用 `prompt-book.ts` 那套纯函数改（与服务端同一套逻辑），
 * 只有点「保存修改」才整本写回 —— 否则每敲一个字就是一次 HTTP + 一次原子写。
 *
 * 保存后宿主会回读磁盘真实内容并覆盖本地快照，草稿跟着它走：于是「空正文的条目被
 * 净化丢弃」这类收窄会在界面上立刻显现，而不是等到下次打开设置才发现不一样。
 */
function QuickPromptsEditor(props: {
  book: QuickPromptBook
  status: string
  onSave: (next: QuickPromptBook) => void
  onReset: () => void
  onReload: () => void
}) {
  const [draft, setDraft] = useState<QuickPromptBook>(() => props.book)
  const [activeId, setActiveId] = useState(() => props.book.categories[0]?.id ?? '')
  const [dirty, setDirty] = useState(false)
  const [newName, setNewName] = useState('')
  /** 上一次保存时跳过空条目的说明（空串 = 无）。 */
  const [note, setNote] = useState('')

  // 本地没有未保存修改时跟随外部快照。
  useEffect(() => {
    if (dirty) return
    setDraft(props.book)
    if (!props.book.categories.some(category => category.id === activeId)) {
      setActiveId(props.book.categories[0]?.id ?? '')
    }
  }, [props.book, dirty, activeId])

  const edit = (next: QuickPromptBook): void => {
    setDirty(true)
    setDraft(next)
  }
  const current = draft.categories.find(category => category.id === activeId) ?? draft.categories[0]
  const counts = bookCounts(draft)
  const saving = props.status === 'saving'
  const failed = props.status !== '' && props.status !== 'saving'

  const rowBox: CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: 6,
    padding: 8, borderRadius: 8,
    border: '0.5px solid var(--dsw-alias-border-l2)',
    background: 'var(--dsw-alias-bg-layer-1)',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* 分类切换 + 新增 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        {draft.categories.map(category => (
          <button
            key={category.id}
            type="button"
            style={category.id === current?.id ? pillActive : pill}
            onClick={() => { setActiveId(category.id) }}
          >
            {category.name}（{category.prompts.length}）
          </button>
        ))}
        <input
          type="text"
          value={newName}
          placeholder="新分类名"
          maxLength={QUICK_CATEGORY_NAME_MAX}
          spellCheck={false}
          onChange={event => { setNewName(event.target.value) }}
          style={{ ...textInput, flex: '0 0 110px' }}
        />
        <button
          type="button"
          style={pill}
          disabled={draft.categories.length >= QUICK_CATEGORY_MAX}
          onClick={() => {
            edit(withCategoryAdded(draft, newName === '' ? DEFAULT_CATEGORY_NAME : newName))
            setNewName('')
          }}
        >
          + 加分类
        </button>
      </div>

      {current === undefined && (
        <p style={rowDesc}>还没有分类。先加一个分类，再往里放条目。</p>
      )}

      {current !== undefined && (
        <>
          {/* 当前分类：改名 / 换位 / 删除 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <input
              type="text"
              value={current.name}
              aria-label="分类名"
              maxLength={QUICK_CATEGORY_NAME_MAX}
              spellCheck={false}
              onChange={event => { edit(withCategoryRenamed(draft, current.id, event.target.value)) }}
              style={{ ...textInput, flex: '0 0 150px' }}
            />
            <button type="button" style={pill} title="分类上移" onClick={() => { edit(withCategoryMoved(draft, current.id, -1)) }}>↑</button>
            <button type="button" style={pill} title="分类下移" onClick={() => { edit(withCategoryMoved(draft, current.id, 1)) }}>↓</button>
            <button
              type="button"
              style={pill}
              title="删除这个分类（连同它里面的条目）"
              onClick={() => { edit(withCategoryRemoved(draft, current.id)) }}
            >
              ✕ 删除分类
            </button>
            <span style={rowDesc}>{current.prompts.length} / {QUICK_PROMPT_MAX} 条</span>
          </div>

          {current.prompts.map(prompt => (
            <div key={prompt.id} style={rowBox}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="text"
                  value={prompt.label}
                  placeholder="名称，如：仅说明原因"
                  maxLength={QUICK_LABEL_MAX}
                  spellCheck={false}
                  onChange={event => { edit(withPromptPatched(draft, current.id, prompt.id, { label: event.target.value })) }}
                  style={{ ...textInput, flex: '0 0 150px' }}
                />
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, ...rowDesc, margin: 0, flex: '0 0 auto' }}>
                  <input
                    type="checkbox"
                    checked={prompt.always}
                    style={{ margin: 0, cursor: 'pointer' }}
                    onChange={event => { edit(withPromptPatched(draft, current.id, prompt.id, { always: event.target.checked })) }}
                  />
                  默认插入
                </label>
                <span style={{ flex: 1 }} />
                <button type="button" style={pill} title="上移" onClick={() => { edit(withPromptMoved(draft, current.id, prompt.id, -1)) }}>↑</button>
                <button type="button" style={pill} title="下移" onClick={() => { edit(withPromptMoved(draft, current.id, prompt.id, 1)) }}>↓</button>
                <button type="button" style={pill} title="删除这条" onClick={() => { edit(withPromptRemoved(draft, current.id, prompt.id)) }}>✕</button>
              </div>
              <textarea
                value={prompt.prompt}
                placeholder="提示词正文：点击该条目时插入输入框；勾了「默认插入」则在发送时自动附加到消息末尾"
                maxLength={QUICK_TEXT_MAX}
                spellCheck={false}
                rows={Math.min(4, Math.max(2, Math.ceil(prompt.prompt.length / 46)))}
                onChange={event => { edit(withPromptPatched(draft, current.id, prompt.id, { prompt: event.target.value })) }}
                style={{ ...textInput, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
              />
            </div>
          ))}

          {/* 列表最下边的「＋」：新建 / 把别的分类的条目移动到这里（与面板同一组件） */}
          <AddPromptRow
            book={draft}
            categoryId={current.id}
            onAdd={() => { edit(withPromptAdded(draft, current.id)) }}
            onMove={promptId => { edit(withPromptMovedToCategory(draft, promptId, current.id)) }}
          />
        </>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          style={dirty ? pillActive : pill}
          disabled={!dirty || saving}
          onClick={() => {
            // 先把正文为空的条目剔掉**并说明**：净化端也会丢它们，但若让用户自己发现
            // 「我加的这条怎么没了」，那是一次说不清的静默丢失。
            const next: QuickPromptBook = {
              version: draft.version,
              categories: draft.categories.map(category => ({
                ...category,
                prompts: category.prompts.filter(prompt => prompt.prompt.trim() !== ''),
              })),
            }
            const skipped = counts.prompts - bookCounts(next).prompts
            setNote(skipped > 0 ? `已跳过 ${String(skipped)} 条正文为空的条目` : '')
            props.onSave(next)
            setDirty(false)
          }}
        >
          {saving ? '保存中…' : (dirty ? '保存修改' : '已保存')}
        </button>
        <button type="button" style={pill} onClick={() => { props.onReload() }}>重新读取</button>
        <button type="button" style={pill} onClick={() => { props.onReset() }}>恢复内置 9 条</button>
        <span style={rowDesc}>
          共 {counts.categories} 个分类 · {counts.prompts} 条 · 默认插入 {counts.always} 条
          {note === '' ? '' : ` · ${note}`}
          {failed ? ` · ${props.status}` : ''}
        </span>
      </div>
      <p style={rowDesc}>
        数据存在 <code>~/.dsh/quick-prompts.json</code>（与会话、项目无关，可单独备份或手工编辑，
        改完点「重新读取」即可加载）。
      </p>
    </div>
  )
}

/** 设置页主体。 */
export function SettingsSection({ useLive, useBook, useBookStatus, actions }: SettingsSectionProps) {
  const settings = useLive(item => item)
  const book = useBook(item => item)
  const bookStatus = useBookStatus(item => item)
  const [conflict, setConflict] = useState<string | null>(null)

  const setKey = (side: 'send' | 'newline', chord: string): void => {
    const other = side === 'send' ? settings.newlineKey : settings.sendKey
    if (chord !== '' && chord === other) {
      setConflict(chord)
      return
    }
    setConflict(null)
    actions.setField(side === 'send' ? 'sendKey' : 'newlineKey', chord)
  }

  const conflictHint = conflict !== null
    ? `「${displayChord(conflict)}」已被另一侧占用，请先为另一侧选择其它按键。`
    : null

  const menuEnabled = MENU_ITEMS.filter(item => settings[item.field]).length
  const keySummary = `发送 ${displayChord(settings.sendKey)} · 换行 ${displayChord(settings.newlineKey)}`
  const menuSummary = settings.menuNative
    ? '当前：系统原生菜单（粘贴免授权）'
    : `当前：自定义菜单 · ${menuEnabled} / ${MENU_ITEMS.length} 项开启`
  const panelSummary = `导航滚动 ${settings.panelScroll ? '开' : '关'}`
    + ` · 边缘缩放 ${settings.panelResize ? '开' : '关'}`
    + ` · ${settings.panelWidth}×${settings.panelHeight}`
  // 请求头栏目的概览直接复用宿主半写回来的执行结果（'已写入 opencode-go' 这类）。
  const headerSummary = settings.headerEnabled
    ? (settings.headerStatus === '' ? '已启用' : settings.headerStatus)
    : '未启用'
  const quickCounts = bookCounts(book)
  const quickSummary = `${quickCounts.categories} 个分类 · ${quickCounts.prompts} 条`
    + ` · 默认插入 ${quickCounts.always} 条`
    + ` · 优化档位 ${OPTIMIZER_TIERS.find(item => item.id === settings.optimizerTier)?.label ?? '高级'}`
  const headerStatusText = settings.headerEnabled
    ? (settings.headerStatus === '' ? '等待首次写入…' : settings.headerStatus)
    : '未启用（打开上方开关即写入）'

  return (
    <div style={{ padding: '4px 2px' }}>
      {/* 顶部常显区：中文名 + 内嵌英文包名的一行描述 + 总开关。 */}
      <section className="dsh-ux-card">
        <div className="dsh-ux-cardHeaderStatic">
          <span className="dsh-ux-cardHeadText">
            <h2 className="dsh-ux-cardName">输入体验</h2>
            <p className="dsh-ux-cardDescription">
              dsh-composer-ux · 主聊天输入框的键位、右键菜单与设置面板；设置即时生效并持久保存。
            </p>
          </span>
        </div>
        <div className="dsh-ux-cardBody">
          <ToggleRow
            first
            label="启用输入增强"
            desc="关闭后键位、右键菜单与设置面板滚动/缩放全部停用（本页保留用于重新开启）"
            checked={settings.enabled}
            onChange={next => { actions.setField(ENABLED_FIELD, next) }}
          />
          {!settings.enabled && (
            <p style={hintInfo}>
              已停用：发送/换行键位、右键菜单、设置面板滚动与边缘缩放均不再生效，输入框恢复 DSH 原生行为。
              打开上方开关即可一键恢复；所有设置值仍保留。
            </p>
          )}
        </div>
      </section>

      {settings.enabled && (<>
      <FoldCard name="键位" summary={keySummary}>
        <p style={bodyLead}>
          支持常用预设，也可以点击「自定义…」后直接按下任意组合键录制（Esc 取消，Backspace 清除）。
          未绑定的 Enter 系按键不会触发发送或换行；Ctrl+Enter / ⌘+Enter 未被绑定时保留原「加速提交」行为；
          中文输入法组合期间不受影响。
        </p>
        <KeyRow
          first
          title="发送键"
          desc="按下后发送当前输入"
          value={settings.sendKey}
          presets={SEND_PRESETS}
          conflict={chord => chord !== '' && chord === settings.newlineKey}
          onChange={chord => { setKey('send', chord) }}
        />
        <KeyRow
          title="换行键"
          desc="按下后在输入内换行"
          value={settings.newlineKey}
          presets={NEWLINE_PRESETS}
          conflict={chord => chord !== '' && chord === settings.sendKey}
          onChange={chord => { setKey('newline', chord) }}
        />
        {conflictHint !== null && <p style={hintError}>{conflictHint}</p>}
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            style={pill}
            onClick={() => { setConflict(null); actions.resetAll() }}
          >
            恢复默认
          </button>
        </div>
      </FoldCard>

      <FoldCard name="右键菜单" summary={menuSummary}>
        <p style={bodyLead}>
          右键点击输入框时的行为。系统原生模式下由浏览器弹出自己的菜单（样式随浏览器而变化，
          粘贴免授权、零配置）；自定义模式使用固定样式菜单（未选中文本时「剪切 / 复制 / 删除」置灰，
          粘贴需要浏览器剪贴板授权，Firefox 要在 about:config 中设置
          permissions.default.clipboard-read = 1 才能免弹窗）。
        </p>
        <ToggleRow
          first
          label="使用系统原生菜单"
          desc="打开后右键粘贴免授权（点击浏览器菜单的粘贴直接成功）；关闭后恢复自定义菜单"
          checked={settings.menuNative}
          onChange={next => { actions.setField(MENU_NATIVE_FIELD, next) }}
        />
        {!settings.menuNative && (<>
        {MENU_ITEMS.map(item => (
          <ToggleRow
            key={item.field}
            label={item.label}
            desc={item.shortcut !== '' ? `快捷键 ${item.shortcut}` : ''}
            checked={settings[item.field]}
            onChange={next => { actions.setField(item.field as MenuField, next) }}
          />
        ))}
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            style={pill}
            onClick={() => { for (const item of MENU_ITEMS) actions.setField(item.field as MenuField, true) }}
          >
            全部开启
          </button>
        </div>
        </>)}
      </FoldCard>

      <FoldCard name="快捷指令" summary={quickSummary}>
        <p style={bodyLead}>
          输入框工具行里那个「快捷指令」按钮点开就是这张清单：点条目把内容插入输入框；
          条目右侧勾上「默认插入」，则在你**点发送时**把这条提示词自动附加到消息**末尾**
          一起发出去（多条按列表顺序拼接，输入框里不提前显示）。
          「优化提示词」会用另一个 AI 把输入框里的话整理成一条能直接发出去的清晰指令，
          结果直接写回输入框（Ctrl+Z 可还原）——不会污染当前对话，也不占你的对话轮次。
        </p>
        <div style={{ ...row, borderTop: 'none', flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
          <div style={rowText}>
            <div style={rowTitle}>优化强度</div>
            <div style={rowDesc}>
              {OPTIMIZER_TIERS.find(item => item.id === settings.optimizerTier)?.hint ?? ''}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {OPTIMIZER_TIERS.map(item => (
              <button
                key={item.id}
                type="button"
                title={item.hint}
                style={settings.optimizerTier === item.id ? pillActive : pill}
                onClick={() => { actions.setField(OPTIMIZER_TIER_FIELD, item.id as OptimizerTier) }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ ...row, borderTop: 'none', flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
          <div style={rowText}>
            <div style={rowTitle}>快捷指令清单</div>
            <div style={rowDesc}>
              分类在这里管理（面板里只做切换）；内置 9 条可以直接用，改完记得点「保存修改」。
            </div>
          </div>
          <QuickPromptsEditor
            book={book}
            status={bookStatus}
            onSave={next => { actions.saveBook(next) }}
            onReload={() => { actions.reloadBook() }}
            onReset={() => { actions.resetBook() }}
          />
        </div>
      </FoldCard>

      <FoldCard name="设置面板" summary={panelSummary}>
        <p style={bodyLead}>
          插件装得多时设置条目很长：开启「导航可滚动」后，左侧导航在溢出时会出现滚动条。
          开启「边缘调整大小」后，把鼠标移到设置面板的边或角上（出现高亮或光标变化）拖动即可改变面板大小，
          尺寸会记住，下次打开保持。
        </p>
        <ToggleRow
          first
          label="导航可滚动"
          desc="设置条目超出面板高度时显示滚动条"
          checked={settings.panelScroll}
          onChange={next => { actions.setField(PANEL_SCROLL_FIELD, next) }}
        />
        <ToggleRow
          label="边缘调整大小"
          desc="拖动面板四边 / 四角改变面板尺寸"
          checked={settings.panelResize}
          onChange={next => { actions.setField(PANEL_RESIZE_FIELD, next) }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <span style={rowDesc}>尺寸预设：</span>
          <button
            type="button"
            style={pill}
            onClick={() => { actions.clearField(PANEL_WIDTH_FIELD); actions.clearField(PANEL_HEIGHT_FIELD) }}
          >
            默认（800）
          </button>
          <button
            type="button"
            style={settings.panelWidth === 640 && settings.panelHeight === 600 ? pillActive : pill}
            onClick={() => {
              actions.setField(PANEL_WIDTH_FIELD, 640)
              actions.setField(PANEL_HEIGHT_FIELD, 600)
            }}
          >
            紧凑（640×600）
          </button>
          <button
            type="button"
            style={settings.panelWidth === 1040 && settings.panelHeight === 760 ? pillActive : pill}
            onClick={() => {
              actions.setField(PANEL_WIDTH_FIELD, 1040)
              actions.setField(PANEL_HEIGHT_FIELD, 760)
            }}
          >
            宽敞（1040×760）
          </button>
        </div>
      </FoldCard>

      <FoldCard name="OpenCode 请求头" summary={headerSummary}>
        <p style={bodyLead}>
          OpenCode 的接口要求客户端每次请求都带上一个稳定的会话 ID 请求头（官方 Go 文档
          「可以在哪里使用？」第 3 条：为每段对话在 x-opencode-session 中发送会话 ID，
          以便其优化路由与提示词缓存）。DSH 的设置页不提供请求头编辑器，所以这里直接把它写进
          llm-pi-ai 的 provider 配置——下一次模型请求就生效，不用重启，也不用手工改 settings.yaml。
          只对 llm-pi-ai 里「已存在」的 opencode 系路由生效，不会凭空新建 provider；
          总开关关闭或本栏目停用时，写入的头会自动撤销。
        </p>
        <ToggleRow
          first
          label="附加请求头"
          desc="打开即写入，并在每次启动时补齐；关闭即撤销"
          checked={settings.headerEnabled}
          onChange={next => { actions.setField(HEADER_ENABLED_FIELD, next) }}
        />
        <TextFieldRow
          title="头名"
          desc={`默认 ${DEFAULT_HEADER_NAME}（OpenCode 官方要求的那一个）`}
          value={settings.headerName}
          placeholder={DEFAULT_HEADER_NAME}
          maxLength={HEADER_NAME_MAX}
          onChange={next => { actions.setField(HEADER_NAME_FIELD, next) }}
        />
        <TextFieldRow
          title="值"
          desc="所有对话共用这一个值；留空时首次启用会自动生成一个 UUID 并保存沿用"
          value={settings.headerValue}
          placeholder="留空 = 自动生成"
          maxLength={HEADER_VALUE_MAX}
          onChange={next => { actions.setField(HEADER_VALUE_FIELD, next) }}
          action={{
            label: '重新生成',
            onClick: () => { actions.setField(HEADER_VALUE_FIELD, newSessionId()) },
          }}
        />
        <TextFieldRow
          title="作用路由"
          desc="逗号或空格分隔；留空 = 自动匹配 OpenCode 路由（名字以 opencode 开头，或 baseURL 指向 opencode.ai）"
          value={settings.headerRoutes}
          placeholder="留空 = 自动（opencode* 或 opencode.ai 端点）"
          maxLength={HEADER_VALUE_MAX}
          onChange={next => { actions.setField(HEADER_ROUTES_FIELD, next) }}
        />
        <p style={hintInfo}>状态：{headerStatusText}</p>
      </FoldCard>
      </>)}
    </div>
  )
}
