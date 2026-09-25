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
  MENU_ITEMS, MENU_MODES, MENU_MODE_FIELD, NEWLINE_PRESETS, OPTIMIZER_TIERS, OPTIMIZER_TIER_FIELD,
  PANEL_HEIGHT_FIELD,
  PANEL_RESIZE_FIELD, PANEL_WIDTH_FIELD, QUICK_CATEGORY_MAX,
  QUICK_CATEGORY_NAME_MAX, QUICK_LABEL_MAX,
  QUICK_PROMPT_MAX, QUICK_TEXT_MAX, REPO_URL, RESTART_API_PATH, SEND_PRESETS,
  KEYS_ENABLED_FIELD, MENU_ENABLED_FIELD, PANEL_ENABLED_FIELD, QUICK_ENABLED_FIELD,
  TERMINAL_ENABLED_FIELD, activeSections,
  insertModeOf, newQuickPromptId, newSessionId, optimizerPromptFieldOf,
  type ComposerUxSettings, type MenuField, type OptimizerTier, type QuickPrompt,
  type QuickPromptBook, type SettingsField,
} from '../settings-contract.ts'
import {
  bookCounts, withCategoryAdded, withCategoryMoved, withCategoryRemoved, withCategoryRenamed,
  withInsertMode, withPromptAdded, withPromptMoved, withPromptMovedToCategory, withPromptPatched,
  withPromptRemoved,
} from './prompt-book.ts'
import {
  TERMINAL_API_PATH, TERMINAL_BASH_PATH_FIELD, TERMINAL_MODES, TERMINAL_MODE_FIELD,
  sanitizeTerminalCandidates,
} from '../terminal/contracts.ts'
import { AddPromptRow } from './AddPromptRow.tsx'
import { OptimizerPromptEditor } from './OptimizerPromptEditor.tsx'
import { InsertModeControl } from './InsertModeControl.tsx'
import { PillChoice } from './PillChoice.tsx'
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
    /**
     * 设置写入的说明行：'' = 正常；其余是"被拒 / 写了但没生效"的原因。
     * 存在的意义就是让「点了没反应」这种故障至少说得出话（见 client.tsx 的 setField）。
     */
    writeNotice: SnapshotStore<string>
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
    /** 关掉顶部那条写入失败/未生效的说明。 */
    dismissNotice: () => void
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
 * 可折叠栏目：标题行左侧是展开按钮（整块可点），右侧是**这一栏的开关**与从属控件；
 * 默认折叠且不记忆展开状态（每次打开设置页都回到折叠）。
 */
function FoldCard(props: {
  name: string
  summary: string
  /** 这一栏的开关（六栏都有）。关掉时概览前会加「未启用 · 」，卡片描边变虚线。 */
  toggle?: { readonly checked: boolean; readonly onChange: (next: boolean) => void }
  /** 标题行右侧、开关左边的从属控件（三档 / 小开关）。 */
  controls?: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const off = props.toggle !== undefined && props.toggle.checked === false
  return (
    <section className={[
      'dsh-ux-card',
      open ? 'dsh-ux-cardOpen' : '',
      off ? 'dsh-ux-cardOff' : '',
    ].filter(part => part !== '').join(' ')}>
      {/*
        标题行分成两块：左边整块是"展开"按钮（整行可点，键盘可达），右边是从属控件 + 本栏开关。
        不能在 <button> 里塞按钮（HTML 不允许、点击也会冒泡成"展开"），所以拆成兄弟节点。
      */}
      <div className="dsh-ux-cardHeaderRow">
        <button
          type="button"
          className="dsh-ux-cardHeader"
          aria-expanded={open}
          onClick={() => { setOpen(current => !current) }}
        >
          <span className="dsh-ux-cardHeadText">
            <span className="dsh-ux-cardName">{props.name}</span>
            <span className="dsh-ux-cardDescription">
              {off ? `未启用 · ${props.summary}` : props.summary}
            </span>
          </span>
          <span className={open ? 'dsh-ux-cardChevron dsh-ux-cardChevronOpen' : 'dsh-ux-cardChevron'}>
            <Chevron />
          </span>
        </button>
        <span className="dsh-ux-cardControls">
          {props.controls}
          {props.toggle !== undefined && (
            <Switch
              small
              label={`${props.name}：启用这一栏`}
              checked={props.toggle.checked}
              onChange={props.toggle.onChange}
            />
          )}
        </span>
      </div>
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

/**
 * 开关（胶囊滑块）。
 *
 * 抽出来是因为它现在有两个尺码：卡片内容区里用 `md`（36×20），折叠卡**标题行**里
 * 用 `sm`（30×16，跟 11px 的标题字一行放得下）。开关画两遍迟早会分叉。
 */
function Switch(props: {
  checked: boolean
  onChange: (next: boolean) => void
  /** 无障碍名字（标题行里的开关没有可见文字，必须给）。 */
  label: string
  small?: boolean
}) {
  const { checked, onChange, label, small = false } = props
  const width = small ? 30 : 36
  const height = small ? 16 : 20
  const knob = small ? 12 : 14
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={() => { onChange(!checked) }}
      style={{
        width,
        height,
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
          top: small ? 1 : 2,
          left: checked ? width - knob - (small ? 1 : 2) : (small ? 1 : 2),
          width: knob,
          height: knob,
          borderRadius: '50%',
          background: checked
            ? 'var(--dsw-alias-label-primary-foreground)'
            : 'var(--dsw-alias-label-secondary)',
          transition: 'left 0.12s ease',
        }}
      />
    </button>
  )
}

/** 标题行里的"文字 + 小开关"（「导航滚动」「边缘缩放」这类）。 */
function MiniToggle(props: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <span className="dsh-ux-miniToggle">
      <span className="dsh-ux-miniToggleLabel">{props.label}</span>
      <Switch small label={props.label} checked={props.checked} onChange={props.onChange} />
    </span>
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
      <Switch label={label} checked={checked} onChange={onChange} />
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={prompt.label}
                  placeholder="名称，如：仅说明原因"
                  maxLength={QUICK_LABEL_MAX}
                  spellCheck={false}
                  onChange={event => { edit(withPromptPatched(draft, current.id, prompt.id, { label: event.target.value })) }}
                  style={{ ...textInput, flex: '0 0 150px' }}
                />
                <InsertModeControl
                  label={prompt.label}
                  mode={insertModeOf(prompt)}
                  onChange={mode => { edit(withInsertMode(draft, prompt.id, mode)) }}
                />
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
          共 {counts.categories} 个分类 · {counts.prompts} 条 · 每次 {counts.always} 条 · 仅首次 {counts.first} 条
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

/** 候选按钮的样式：与胶囊同源，但要能显示长路径。 */
const candidatePill: CSSProperties = {
  ...pill,
  textAlign: 'left',
  maxWidth: '100%',
  overflowWrap: 'anywhere',
  lineHeight: 1.4,
}

/**
 * 「默认终端」卡片内容（Windows：把终端的 pwsh 换成 Git Bash）。
 *
 * 与其它卡片的区别：状态、候选表、当前生效 shell 三项都是**宿主半**写的
 * （settings 里的 terminalStatus / terminalCandidates / terminalEffective，见 HOST_OWNED_FIELDS），
 * 这里只读展示；用户能改的只有「档位」与「路径」两项。
 */
function DefaultTerminalBody(props: {
  readonly settings: ComposerUxSettings
  readonly setField: (field: SettingsField, value: unknown) => void
  /** 档位胶囊已经搬到折叠卡标题行时传 true（内容区不再重复一份）。 */
  readonly hideMode?: boolean
}) {
  const { settings, setField, hideMode = false } = props
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const candidates = settings.terminalCandidates

  if (settings.terminalEffective === 'unsupported') {
    return (
      <p style={hintInfo}>
        本插件只在 Windows 上接管终端（Windows 上 DSH 默认给模型的是 PowerShell）。当前平台不需要它，
        这里的设置不会生效。
      </p>
    )
  }

  /** 点「自动发现」：让宿主半重新扫一遍本机（浏览器碰不到文件系统）。 */
  const discover = async (): Promise<void> => {
    setBusy(true)
    setNote('')
    try {
      const response = await fetch(TERMINAL_API_PATH, { method: 'POST' })
      const parsed = await response.json() as { candidates?: unknown }
      const found = sanitizeTerminalCandidates(parsed.candidates)
      setNote(found.length === 0
        ? '没有找到可用的 bash（WSL 的 bash.exe 会被忽略，它按 Linux 规则解释路径）'
        : `找到 ${String(found.length)} 个候选，已列在下方`)
    } catch (error: unknown) {
      setNote(`自动发现失败：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {!hideMode && (
      <div style={{ ...row, borderTop: 'none', flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        <div style={rowText}>
          <div style={rowTitle}>终端工具</div>
          <div style={rowDesc}>
            {TERMINAL_MODES.find(item => item.id === settings.terminalMode)?.hint ?? ''}
          </div>
        </div>
        <PillChoice
          items={TERMINAL_MODES}
          value={settings.terminalMode}
          onChange={mode => { setField(TERMINAL_MODE_FIELD, mode) }}
          ariaLabel="终端工具"
        />
      </div>
      )}

      {settings.terminalMode !== 'pwsh' && (<>
        <TextFieldRow
          title="Git Bash 路径"
          desc="留空 = 用自动探测到的那一个（先找 git，再由同一个安装反推 bash）"
          value={settings.terminalBashPath}
          placeholder="留空 = 自动"
          maxLength={400}
          onChange={next => { setField(TERMINAL_BASH_PATH_FIELD, next) }}
          action={{ label: busy ? '探测中…' : '自动发现', onClick: () => { void discover() } }}
        />
        {candidates.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
            {candidates.map(candidate => (
              <button
                key={candidate.path}
                type="button"
                title={candidate.path}
                style={candidate.path === settings.terminalBashPath ? { ...candidatePill, ...pillActive } : candidatePill}
                onClick={() => { setField(TERMINAL_BASH_PATH_FIELD, candidate.path) }}
              >
                {candidate.label}：{candidate.path}{candidate.explicit ? '（你填的）' : ''}
              </button>
            ))}
          </div>
        )}
        {note !== '' && <p style={hintInfo}>{note}</p>}
      </>)}

      <p style={hintInfo}>
        状态：{settings.terminalStatus === '' ? '等待宿主半探测…' : settings.terminalStatus}
      </p>
      <p style={hintInfo}>
        · 换成 Git Bash 后，模型看到的终端工具就叫 bash（命令按 bash/POSIX 写），PowerShell 那个工具
        会从它的工具列表里消失 —— 一个会话只面对一个终端工具。
      </p>
      <p style={hintInfo}>
        · 改档位会立刻重新下发给正在跑的会话。但会话历史里可能还留着旧工具名：如果哪儿报了
        unknown tool 之类的错，让模型改用 bash 重试即可，不影响会话本身。
      </p>
      <p style={hintInfo}>
        · 只对 Windows 生效；WSL 的 bash.exe 会被主动排除（它把 D:\ 这类路径解释成 /mnt/d，与模型手里的
        Windows 工作目录不兼容）。沙箱、审批、超时与输出截断的行为与 DSH 自带终端一致。
      </p>
    </>
  )
}

/**
 * 「重启 DSH」：抬头右端一枚按钮 + 抬头正下方的确认条。
 *
 * 机制（宿主半，见 `src/restart.ts`）照搬插件市场：分离一个 node 助手进程 → 自己退出 →
 * 助手等端口真的空出来 → 用隐藏控制台的 PowerShell 起新宿主 → 20 秒内确认端口有人监听。
 * 界面这一侧只管三件事：**两步确认**、把"会怎么重启 / 有几个会话在跑"说清楚、
 * 重启后靠 `boot` 号变了判断新进程真的起来了，然后刷新页面。
 *
 * 为什么是两步确认而不是市场那样一点就走：市场那枚按钮只出现在「有待重启的东西」的横幅里
 * （那一刻你手里没别的事），而这枚常驻在抬头，任何时候都能点到 —— 包括你正跑着一轮长生成。
 */

/** 宿主半告诉界面的事实。 */
interface RestartFacts {
  /** 当前有几个会话在跑（重启会把它们打断）。 */
  readonly running: number
  /** 会怎么重启（重放用的命令，给用户看一眼）。 */
  readonly command: string
  /** 诊断日志落点（失败时告诉用户去哪看）。 */
  readonly logHint: string
  /** 非 null = 这个宿主不该被从界面里杀掉（调试器 / systemd）。 */
  readonly blocked: string | null
  /** 这次启动的标识；null = 宿主半还是 0.5.0 之前那版（没有这个字段）。 */
  readonly boot: string | null
}

type RestartStage = 'idle' | 'asking' | 'restarting' | 'failed'

interface RestartController {
  readonly stage: RestartStage
  readonly detail: string
  readonly blocked: string | null
  ask(): void
  confirm(): void
  cancel(): void
}

/** 最多等 60 秒：新宿主起来约 7 秒，但慢了也不该让用户对着"正在重启"无限干等。 */
const RESTART_WAIT_MS = 60_000
/** 轮询间隔（对齐插件市场：1.5 秒问一次状态）。 */
const RESTART_POLL_MS = 1_500

/** 「不该从界面里杀掉」的原因文案。 */
function blockedText(blocked: string): string {
  if (blocked === 'debugger') {
    return '这个宿主正被调试器附着：从界面里杀掉它只会连调试会话一起丢掉，请从 IDE 或终端停止它再启动。'
  }
  if (blocked.startsWith('supervised:')) {
    return `这个宿主由 ${blocked.slice('supervised:'.length)} 当服务在跑，重启该归它管`
      + '（它会连同整个 cgroup 一起收掉，插件自己重启只会让服务再也起不来）。'
  }
  return `这个宿主当前不允许从界面重启（${blocked}）。`
}

/** 重启按钮的状态机：读状态 → 确认 → 排重启 → 等新进程。 */
function useRestart(): RestartController {
  const [stage, setStage] = useState<RestartStage>('idle')
  const [detail, setDetail] = useState('')
  const [blocked, setBlocked] = useState<string | null>(null)

  /** 读宿主半的状态；`{ error }` = 读不到（HTTP 失败 / 连接断了）。 */
  const readFacts = async (): Promise<RestartFacts | { error: string }> => {
    const response = await fetch(RESTART_API_PATH, { cache: 'no-store' })
    if (!response.ok) return { error: `HTTP ${String(response.status)}` }
    const parsed = await response.json() as Record<string, unknown>
    return {
      running: typeof parsed.running === 'number' ? parsed.running : 0,
      command: typeof parsed.command === 'string' ? parsed.command : '',
      logHint: typeof parsed.logHint === 'string' ? parsed.logHint : '',
      blocked: typeof parsed.blocked === 'string' ? parsed.blocked : null,
      boot: typeof parsed.boot === 'string' ? parsed.boot : null,
    }
  }

  /** 等新进程起来：`boot` 号一变就刷新页面。 */
  const awaitNewBoot = async (previousBoot: string | null, logHint: string): Promise<void> => {
    const deadline = Date.now() + RESTART_WAIT_MS
    while (Date.now() < deadline) {
      await new Promise<void>(done => { setTimeout(done, RESTART_POLL_MS) })
      try {
        const facts = await readFacts()
        if ('error' in facts) continue
        // 旧版宿主没有 boot 字段：只要拿到任何一个号，就说明新进程已经接管了这个端口。
        if (facts.boot !== null && facts.boot !== previousBoot) {
          location.reload()
          return
        }
      } catch {
        // 新进程还没起来（连接被拒）：正常，继续等。
      }
    }
    setStage('failed')
    setDetail('等了 60 秒也没等到新进程。请手动运行 restart-webui.bat 重启一次。'
      + (logHint === '' ? '' : `宿主半的诊断日志在 ${logHint}。`))
  }

  /** 第一步：读"会怎么重启、现在有几个会话在跑"。 */
  const ask = (): void => {
    setStage('asking')
    setDetail('正在读取重启方式…')
    void (async () => {
      try {
        const facts = await readFacts()
        if ('error' in facts) {
          setStage('failed')
          setDetail(`读不到重启状态（${facts.error}）—— 宿主半可能还没换到带这条路由的版本，`
            + '请先手动运行一次 restart-webui.bat。')
          return
        }
        setBlocked(facts.blocked)
        if (facts.blocked !== null) {
          setStage('failed')
          setDetail(blockedText(facts.blocked))
          return
        }
        setStage('asking')
        // 宿主半没有 boot 字段 = 还是上一版（新路由要重启后才加载）。这时如实说明：
        // 这一次会走旧机制，而且重启之后按钮才变成新版 —— 别让用户以为没生效。
        setDetail((facts.boot === null
          ? '宿主半还是上一版：这次重启会走旧机制（写脚本 + 自己退出），重启之后按钮就是新版了。'
          : `重启方式：${facts.command}。`)
          + `当前有 ${String(facts.running)} 个会话在跑 —— 重启会打断它们（包括正在生成的那一轮）。`)
      } catch (error: unknown) {
        setStage('failed')
        setDetail(`读不到重启状态：${error instanceof Error ? error.message : String(error)}`)
      }
    })()
  }

  /** 第二步：确认后让宿主半排重启，然后等新进程。 */
  const confirm = (): void => {
    setStage('restarting')
    setDetail('已发出重启请求 —— 正在等新进程起来（这个页面会自己回来）…')
    void (async () => {
      let previousBoot: string | null = null
      let logHint = ''
      try {
        const before = await readFacts()
        if (!('error' in before)) {
          previousBoot = before.boot
          logHint = before.logHint
        }
      } catch {
        // 读不到也无所谓：下面的轮询只需要"号变了"这一个条件。
      }
      try {
        const response = await fetch(RESTART_API_PATH, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        })
        const parsed = await response.json() as { ok?: boolean; error?: string }
        if (response.status !== 202 && parsed.ok !== true) {
          setStage('failed')
          setDetail(`重启没成功：${parsed.error ?? `HTTP ${String(response.status)}`}`
            + ' —— 请手动运行 restart-webui.bat。')
          return
        }
      } catch {
        // 宿主可能死在响应发完之前：那不是失败，继续等新进程。
      }
      await awaitNewBoot(previousBoot, logHint)
    })()
  }

  const cancel = (): void => {
    setStage('idle')
    setDetail('')
  }

  return { stage, detail, blocked, ask, confirm, cancel }
}

/** 抬头右端那枚按钮（在 GitHub 链接左边）。 */
function RestartButton({ restart }: { readonly restart: RestartController }) {
  const busy = restart.stage === 'restarting' || restart.stage === 'asking'
  const blocked = restart.blocked
  return (
    <button
      type="button"
      className="dsh-ux-restartButton"
      disabled={busy || blocked !== null}
      title={blocked === null
        ? '重启 DSH：让宿主半的新代码（默认终端、键位 schema）生效。点一下会先让你确认一次。'
        : blockedText(blocked)}
      onClick={() => { restart.ask() }}
    >
      {restart.stage === 'restarting' ? '重启中…' : '重启 DSH'}
    </button>
  )
}

/**
 * 抬头右端那枚「刷新」按钮（在「重启 DSH」左边）。
 *
 * 为什么值得有一枚：插件的**客户端半**（设置页 / 右键菜单 / 键位拦截 / 快捷指令面板）
 * 是随页面 bundle 走的，改完只要重新加载页面就生效，**根本不需要重启宿主**。
 * 而「重启 DSH」在官方安装的桌面版里不可能生效 —— 宿主是 Electron 应用，
 * 重放不出可用的启动命令（2026-09-25 实测：`_boot.log` 反复报「无法定位 dsh CLI」，
 * 重启helper 的日志自 09-23 起一条没有）。于是"想让改动生效"这件事在桌面版里
 * 就没了下手处，这枚按钮补的正是这个缺口。
 *
 * 它只做一件事：`location.reload()`。不发请求、不碰宿主、**不打断正在跑的会话**
 * （会话在宿主侧活着，刷新只重建界面）。
 *
 * 复用 `.dsh-ux-restartButton` 的观感：那是"抬头小胶囊"这一套样式，类名被
 * `test/client-registration.mjs` 钉着（改名会撞护栏），而且两枚并排必须长得一样。
 */
function RefreshButton({ busy }: { readonly busy: boolean }) {
  return (
    <button
      type="button"
      className="dsh-ux-restartButton"
      disabled={busy}
      title="刷新页面：让插件客户端半的新代码（设置页 / 右键菜单 / 键位 / 快捷指令面板）生效。不重启 DSH、不打断正在跑的会话。"
      onClick={() => { window.location.reload() }}
    >
      刷新
    </button>
  )
}

/** 抬头正下方的确认条（市场那个「N 项变更需重启」横幅的位置）。 */
function RestartBanner({ restart }: { readonly restart: RestartController }) {
  if (restart.stage === 'idle') return null
  const failed = restart.stage === 'failed'
  return (
    <div className={failed ? 'dsh-ux-restartBanner dsh-ux-restartBannerFailed' : 'dsh-ux-restartBanner'}>
      <span className="dsh-ux-restartBannerText">{restart.detail}</span>
      {restart.stage === 'asking' && (
        <span className="dsh-ux-restartBannerActions">
          <button type="button" className="dsh-ux-restartGo" onClick={() => { restart.confirm() }}>确认重启</button>
          <button type="button" className="dsh-ux-restartCancel" onClick={() => { restart.cancel() }}>取消</button>
        </span>
      )}
      {failed && (
        <span className="dsh-ux-restartBannerActions">
          <button type="button" className="dsh-ux-restartCancel" onClick={() => { restart.cancel() }}>知道了</button>
        </span>
      )}
    </div>
  )
}

/** 设置页主体。 */
export function SettingsSection({ useLive, useBook, useBookStatus, useWriteNotice, actions }: SettingsSectionProps) {
  const settings = useLive(item => item)
  const book = useBook(item => item)
  const bookStatus = useBookStatus(item => item)
  /** '' = 写入正常；其余是"被拒 / 写了但运行时没变"的说明（见 client.tsx 的 setField）。 */
  const writeNotice = useWriteNotice(item => item)
  const [conflict, setConflict] = useState<string | null>(null)
  // 重启按钮在抬头、确认条在抬头正下方 —— 两处要读同一份状态，所以状态提到这一层。
  const restart = useRestart()
  /**
   * 六栏各自的开关状态（总开关 + 栏开关），六张卡的标题行与内容都读它。
   *
   * 单项都走 `activeSections` 而不是在这里各写一遍 `settings.enabled && …`：
   * 漏掉总闸是这套两层级开关最容易犯的错，判据只能有一处。
   */
  const sections = activeSections(settings)

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
  // 三档各自的摘要：一眼看出右键会弹哪一种菜单，以及自定义档当前开了几项。
  const menuSummary = settings.menuMode === 'official'
    ? '当前：官方不介入'
    : settings.menuMode === 'browser'
      ? '当前：浏览器菜单（粘贴免授权）'
      : `当前：自定义菜单 · ${menuEnabled} / ${MENU_ITEMS.length} 项开启`
  const panelSummary = `边缘缩放 ${settings.panelResize ? '开' : '关'}`
    + ` · ${settings.panelWidth}×${settings.panelHeight}`
  // 请求头栏目的概览直接复用宿主半写回来的执行结果（'已写入 opencode-go' 这类）。
  const headerSummary = settings.headerEnabled
    ? (settings.headerStatus === '' ? '已启用' : settings.headerStatus)
    : '未启用'
  const quickCounts = bookCounts(book)
  const quickSummary = `${quickCounts.categories} 个分类 · ${quickCounts.prompts} 条`
    + ` · 每次 ${quickCounts.always} · 仅首次 ${quickCounts.first}`
    + ` · 优化档位 ${OPTIMIZER_TIERS.find(item => item.id === settings.optimizerTier)?.label ?? '高级'}`
  const headerStatusText = settings.headerEnabled
    ? (settings.headerStatus === '' ? '等待首次写入…' : settings.headerStatus)
    : '未启用（打开上方开关即写入）'
  // 终端卡片的概览：直接复用宿主半写回来的状态（'已生效：…' / '没找到可用的 bash' 这类）。
  // 「这一栏没启用」优先于宿主半的状态 —— 没开的时候状态行写的是"未启用"，但那句话在概览里
  // 不如「未启用」四个字直白（FoldCard 会再加一次前缀，所以这里只给被关掉时的档位描述）。
  const terminalSummary = sections.terminal === false
    ? (settings.terminalMode === 'pwsh' ? '保持 PowerShell' : '打开后接管终端')
    : settings.terminalEffective === 'unsupported'
      ? '非 Windows：不需要'
      : settings.terminalMode === 'pwsh'
        ? '当前：保持 PowerShell'
        : (settings.terminalEffective === 'bash' ? '当前：Git Bash' : '当前：PowerShell（未接管）')

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
          {/*
            「重启 DSH」放在抬头右端、GitHub 链接左边：这是设置页第一眼就扫到的位置，
            而它要解决的问题（宿主半改了要重启才生效）恰好是用户点进设置页时最想做的事。
            确认条在抬头正下方（见下面的 RestartBanner），跟市场的「待重启」横幅同一个位置。
          */}
          <span className="dsh-ux-cardActions">
            {/*
              顺序：刷新 → 重启 → GitHub。轻的在前、重的在后（刷新只需重新加载页面，
              重启会真的换掉宿主进程），与两枚按钮各自的风险一致。
              重启在确认中 / 重启中时刷新一起禁用：那时用户手上有一件未决的事，
              刷新会把它连同确认条一起冲掉。
            */}
            <RefreshButton busy={restart.stage === 'restarting' || restart.stage === 'asking'} />
            <RestartButton restart={restart} />
            {/*
              仓库入口：用真实的 <a>（新标签打开、不带 referrer），地址来自契约里的 REPO_URL ——
              客户端不许硬编码第二份地址，否则改了仓库两处会分叉（有测试盯着）。
            */}
            <a
              className="dsh-ux-cardLink"
              href={REPO_URL}
              target="_blank"
              rel="noreferrer noopener"
              title="在 GitHub 上查看这个插件（新标签打开）"
            >
              GitHub <span aria-hidden="true">↗</span>
            </a>
          </span>
        </div>
        <RestartBanner restart={restart} />
        {/*
          写入失败 / 写了但没生效的说明条：与「重启 DSH」横幅同一个位置、同一套样式。
          为什么值得占这个位置：2026-09-23 的真机事故里，设置写入被一把孤儿写入锁挡住，
          用户看到的只有"开关不动"，**一句提示都没有**，排查只能靠翻宿主日志。
          所以这条横幅的作用是让下一次同类故障当场说得出话（判据见 client.tsx 的 setField）。
        */}
        {writeNotice !== '' && (
          <div className="dsh-ux-restartBanner dsh-ux-restartBannerFailed" role="status">
            <span className="dsh-ux-restartBannerText">设置未生效：{writeNotice}</span>
            <span className="dsh-ux-restartBannerActions">
              <button type="button" className="dsh-ux-restartCancel" onClick={() => { actions.dismissNotice() }}>
                知道了
              </button>
            </span>
          </div>
        )}
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
      <FoldCard
        name="键位"
        summary={keySummary}
        toggle={{
          checked: sections.keys,
          onChange: next => { actions.setField(KEYS_ENABLED_FIELD, next) },
        }}
      >
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

      {/*
        三档说明与那 7 个条目开关**都在卡内**，且按当前档位只显示相关的那部分
        （用户要求：点官方看官方的、点浏览器看浏览器的、点自定义看自定义的）。
        0.5.0 先做的是「7 项开关搬到标题行的『7 项 ▼』条」，用户看过真实界面后改回卡内：
        那 7 项本来就只对「自定义」档有意义，摆在标题行等于在任何档位都能改一堆当时不生效的东西。
      */}
      <FoldCard
        name="右键菜单"
        summary={menuSummary}
        toggle={{
          checked: sections.menu,
          onChange: next => { actions.setField(MENU_ENABLED_FIELD, next) },
        }}
      >
        <p style={bodyLead}>
          右键点击输入框时弹出哪一种菜单。只影响右键，不影响键位与其它功能。
        </p>
        <div style={{ ...row, borderTop: 'none', flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
          <div style={rowText}>
            <div style={rowTitle}>菜单来源</div>
          </div>
          <PillChoice
            items={MENU_MODES}
            value={settings.menuMode}
            onChange={mode => { actions.setField(MENU_MODE_FIELD, mode) }}
            ariaLabel="右键菜单来源"
          />
        </div>
        {settings.menuMode === 'official' && (
          <p style={hintInfo}>
            <strong>官方</strong>：本插件完全不介入，DSH 与其它插件自己的右键处理原样生效
            （DSH 官方输入框本身没有右键菜单，所以通常看到的就是浏览器的菜单）。
          </p>
        )}
        {settings.menuMode === 'browser' && (
          <p style={hintInfo}>
            <strong>浏览器</strong>：固定用浏览器自带的菜单（样子随浏览器而变），并在本插件这一层
            挡住其它插件的菜单；好处是粘贴免授权、零配置。
          </p>
        )}
        {settings.menuMode === 'custom' && (
          <>
            <p style={hintInfo}>
              <strong>自定义</strong>：用本插件固定样式的菜单（未选中文本时「剪切 / 复制 / 删除」置灰）。
              这一档的「粘贴」要读剪贴板，浏览器会先要一次授权——三家浏览器的处理不一样：
            </p>
            <p style={hintInfo}>
              · Chrome / Edge（谷歌 / 微软浏览器）：弹出后点「允许」即可，之后会记住这个站点、不再问。
              要改或撤销授权：点地址栏最左边的网站图标 → 网站设置（Edge 叫「此站点的权限」）→ 剪贴板；
              也可以直接在地址栏输入 chrome://settings/content/clipboard（Edge 输入
              edge://settings/content/clipboard）。
            </p>
            <p style={hintInfo}>
              · Firefox：不允许网页静默读剪贴板——你点本插件的「粘贴」后，它会先弹一个只有「粘贴(P)」
              一项的小窗（约 1 秒后才可点），点它才完成这次粘贴。这是 Firefox 的安全机制，插件关不掉
              （实测：about:config 里的剪贴板首选项对它无效）。不想多这一步就直接按 Ctrl+V，
              或把上面的「菜单来源」换成「浏览器 / 官方」档——那两档用的是浏览器自己的粘贴。
            </p>
            <p style={hintInfo}>
              注意：chrome://、edge:// 这些地址浏览器不允许做成网页里的链接，只能手输，
              或复制上面那串粘贴到地址栏。
            </p>
            <div style={{ ...row, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
              <div style={rowText}>
                <div style={rowTitle}>菜单条目</div>
                <div style={rowDesc}>这 7 个开关决定自定义菜单里出现哪些条目，关掉的不显示。</div>
              </div>
            </div>
            {MENU_ITEMS.map((item, index) => (
              <ToggleRow
                key={item.field}
                first={index === 0}
                label={item.label}
                desc={item.shortcut !== '' ? `快捷键 ${item.shortcut}` : ''}
                checked={settings[item.field]}
                onChange={next => { actions.setField(item.field as MenuField, next) }}
              />
            ))}
            <div style={{ padding: '8px 0 2px' }}>
              <button
                type="button"
                style={pill}
                onClick={() => { for (const item of MENU_ITEMS) actions.setField(item.field as MenuField, true) }}
              >
                全部开启
              </button>
            </div>
          </>
        )}
      </FoldCard>

      <FoldCard
        name="快捷指令"
        summary={quickSummary}
        toggle={{
          checked: sections.quick,
          onChange: next => { actions.setField(QUICK_ENABLED_FIELD, next) },
        }}
      >
        <p style={bodyLead}>
          输入框工具行里那个「快捷指令」按钮点开就是这张清单：点条目把内容插入输入框。
          每条右侧的三选一决定<strong>发送时怎么附加</strong>：
          「关」= 只插入不附加；「每次」= 每次发送都附加到消息<strong>末尾</strong>；
          「仅首次」= 只在<strong>这个会话的第一条消息</strong>上附加（之后不再附加，刷新页面也不会重复）。
          多条按列表顺序拼接，输入框里不提前显示。
          「优化提示词」会用另一个 AI 把输入框里的话整理成一条能直接发出去的清晰指令，
          结果直接写回输入框（Ctrl+Z 可还原）——不会污染当前对话，也不占你的对话轮次。
          0.6.0 起它不再"自由改写"：它只能产出<strong>能指回你原话某一句话</strong>的条目，
          宿主逐条做字面比对，对不上就丢掉那一条并在状态行里记账 ——
          所以"替你发明一条你没说过的需求"在结构上做不到。下面可以改每一档用的提示词。
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
        <OptimizerPromptEditor
          tier={settings.optimizerTier}
          value={settings[optimizerPromptFieldOf(settings.optimizerTier) as keyof ComposerUxSettings] as string}
          onChange={next => { actions.setField(optimizerPromptFieldOf(settings.optimizerTier) as SettingsField, next) }}
        />
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

      <FoldCard
        name="设置面板"
        summary={panelSummary}
        toggle={{
          checked: sections.panel,
          onChange: next => { actions.setField(PANEL_ENABLED_FIELD, next) },
        }}
        // 只留「边缘缩放」：导航滚动已由 DSH 0.1.7 官方设置页自带，本插件不再提供那个开关。
        controls={(
          <MiniToggle
            label="边缘缩放"
            checked={settings.panelResize}
            onChange={next => { actions.setField(PANEL_RESIZE_FIELD, next) }}
          />
        )}
      >
        <p style={bodyLead}>
          导航列的滚动由 DSH 官方的设置页自己负责，本插件不再介入。
          开启「边缘调整大小」后，把鼠标移到设置面板的边或角上（出现高亮或光标变化）拖动即可改变面板大小，
          尺寸会记住，下次打开保持。（这个开关在标题行上。）
        </p>
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

      <FoldCard
        name="OpenCode 请求头"
        summary={headerSummary}
        // 这一栏没有新键：原来的「附加请求头」本来就是"这一栏要不要生效"，直接当卡级开关。
        toggle={{
          checked: sections.header,
          onChange: next => { actions.setField(HEADER_ENABLED_FIELD, next) },
        }}
      >
        {/* 用户实测踩过的坑，放区块最前面：这一栏是为了 OpenCode 的 API 地址服务的，
            用 DSH 自带的地址配置发图片会报错。 */}
        <p style={hintError}>
          ⚠️ 请使用自定义的 OpenCode API 地址，不要用 DSH 自带的 API 地址配置：
          用自带的配置无法上传图片，一旦发送图片就会报错。
        </p>
        <p style={bodyLead}>
          OpenCode 的接口要求客户端每次请求都带上一个稳定的会话 ID 请求头（官方 Go 文档
          「可以在哪里使用？」第 3 条：为每段对话在 x-opencode-session 中发送会话 ID，
          以便其优化路由与提示词缓存）。DSH 的设置页不提供请求头编辑器，所以这里直接把它写进
          llm-pi-ai 的 provider 配置——下一次模型请求就生效，不用重启，也不用手工改 settings.yaml。
          只对 llm-pi-ai 里「已存在」的 opencode 系路由生效，不会凭空新建 provider；
          总开关关闭或本栏目停用时，写入的头会自动撤销。
        </p>
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

      <FoldCard
        name="默认终端"
        summary={terminalSummary}
        toggle={{
          checked: sections.terminal,
          onChange: next => { actions.setField(TERMINAL_ENABLED_FIELD, next) },
        }}
        // 三档从内容区搬到标题行（它比开关更适合当"这一栏当前是什么状态"的展示）。
        controls={(
          <PillChoice
            compact
            items={TERMINAL_MODES}
            value={settings.terminalMode}
            onChange={mode => { actions.setField(TERMINAL_MODE_FIELD, mode) }}
            ariaLabel="终端工具"
          />
        )}
      >
        <p style={bodyLead}>
          Windows 上 DSH 给模型的终端工具是 PowerShell，而模型对 bash 语法的把握明显更好。这一栏把终端
          换成 Git Bash：模型看到的工具就叫 bash、PowerShell 那个工具会从它的工具列表里消失，
          命令里的路径与引号按 bash 规则写。本机不需要装 Git for Windows 到默认目录——探测会先找
          git，再由同一个安装反推 bash。（档位在标题行上：自动 / Git Bash / PowerShell。）
        </p>
        <DefaultTerminalBody settings={settings} setField={actions.setField} hideMode />
      </FoldCard>
      </>)}
    </div>
  )
}
