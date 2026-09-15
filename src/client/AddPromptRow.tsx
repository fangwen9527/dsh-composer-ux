/**
 * 条目列表**最下边**那一行「＋」：点开分「新建 / 移动」。
 *
 * 「移动」列出**其它分类**里的全部条目（`分类名 · 条目名`），点它就把那条移进
 * 当前分类（追加到末尾，「默认插入」标记跟着走）。菜单内容是跟着分类变的，所以
 * 切换分类时会自动收起；点外面或按 Escape 也收起。
 *
 * 面板与设置页共用同一个组件：面板空间紧张（variant='panel' 更紧凑），设置页用
 * 卡片风格（variant='settings'）。两边行为必须一致，所以不让它们各写一套。
 */
import React, { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { QuickPromptBook } from '../settings-contract.ts'
import { promptsElsewhere } from './prompt-book.ts'

/** 组件的注入面（放在两边各自的数据源之上：设置页传草稿，面板传线上本）。 */
export interface AddPromptRowProps {
  /** 当前这本；「移动」菜单要从中列出其它分类的条目。 */
  book: QuickPromptBook
  /** 条目将落到这个分类。 */
  categoryId: string
  /** 新建一条（由调用方决定怎么落盘：设置页进草稿，面板直接写）。 */
  onAdd: () => void
  /** 把这条从它所在分类移到这里。 */
  onMove: (promptId: string) => void
  /** 视觉变体：面板更紧凑。 */
  variant?: 'panel' | 'settings'
}

const rowBase: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  width: '100%',
  borderRadius: 8,
  border: '0.5px dashed var(--dsw-alias-border-l2)',
  background: 'transparent',
  color: 'var(--dsw-alias-label-tertiary)',
  cursor: 'pointer',
  textAlign: 'left',
}

const choiceBase: CSSProperties = {
  padding: '4px 9px',
  borderRadius: 999,
  border: '0.5px solid var(--dsw-alias-border-l2)',
  background: 'transparent',
  color: 'var(--dsw-alias-label-primary)',
  fontSize: 11,
  lineHeight: 1.2,
  cursor: 'pointer',
}

const candidateBase: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  width: '100%',
  padding: '4px 6px',
  borderRadius: 6,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  textAlign: 'left',
}

/** 「＋ 新建 / 移动」那一行。 */
export function AddPromptRow({
  book, categoryId, onAdd, onMove, variant = 'settings',
}: AddPromptRowProps) {
  const [mode, setMode] = useState<'closed' | 'choose' | 'move'>('closed')
  const ref = useRef<HTMLDivElement | null>(null)

  // 换分类就收起：菜单里的候选是「其它分类」，留着会显示上一个分类判断出来的列表。
  useEffect(() => { setMode('closed') }, [categoryId])

  useEffect(() => {
    if (mode === 'closed') return
    const onPointerDown = (event: PointerEvent): void => {
      if (ref.current !== null && event.target instanceof Node && ref.current.contains(event.target)) return
      setMode('closed')
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setMode('closed')
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [mode])

  const compact = variant === 'panel'
  const candidates = mode === 'move' ? promptsElsewhere(book, categoryId) : []

  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button
        type="button"
        aria-expanded={mode !== 'closed'}
        title="新建一条，或把别的分类里的条目移动到这里"
        style={{
          ...rowBase,
          padding: compact ? '4px 8px' : '7px 9px',
          fontSize: compact ? 11 : 12,
        }}
        onMouseDown={event => { event.preventDefault() }}
        onClick={() => { setMode(mode === 'closed' ? 'choose' : 'closed') }}
      >
        <span aria-hidden>＋</span>
        <span>{mode === 'closed' ? '新建 / 移动' : '收起'}</span>
      </button>

      {mode !== 'closed' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            style={choiceBase}
            onMouseDown={event => { event.preventDefault() }}
            onClick={() => { setMode('closed'); onAdd() }}
          >
            ＋ 新建一条
          </button>
          <button
            type="button"
            style={mode === 'move' ? { ...choiceBase, borderColor: 'var(--dsw-alias-brand-primary)' } : choiceBase}
            onMouseDown={event => { event.preventDefault() }}
            onClick={() => { setMode(mode === 'move' ? 'choose' : 'move') }}
          >
            → 把别的分类的条目移动到这里
          </button>
        </div>
      )}

      {mode === 'move' && (
        <div
          style={{
            display: 'flex', flexDirection: 'column', gap: 2,
            maxHeight: 190, overflowY: 'auto',
            border: '0.5px solid var(--dsw-alias-border-l2)',
            borderRadius: 8, padding: 4,
          }}
        >
          {candidates.length === 0 && (
            <span style={{ color: 'var(--dsw-alias-label-tertiary)', fontSize: 11, padding: '4px 6px' }}>
              别的分类里还没有条目可以移动。
            </span>
          )}
          {candidates.map(candidate => (
            <button
              key={candidate.prompt.id}
              type="button"
              title={`${candidate.categoryName} · ${candidate.prompt.prompt}`}
              style={candidateBase}
              onMouseDown={event => { event.preventDefault() }}
              onClick={() => {
                setMode('closed')
                onMove(candidate.prompt.id)
              }}
            >
              <span style={{ color: 'var(--dsw-alias-label-tertiary)', fontSize: 11, flex: '0 0 auto' }}>
                {candidate.categoryName}
              </span>
              <span style={{ color: 'var(--dsw-alias-label-tertiary)', flex: '0 0 auto' }}>·</span>
              <span
                style={{
                  color: 'var(--dsw-alias-label-primary)', fontSize: 12,
                  minWidth: 0, flex: '1 1 auto', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {candidate.prompt.label}
              </span>
              {candidate.prompt.always && (
                <span style={{ color: 'var(--dsw-alias-label-tertiary)', fontSize: 10, flex: '0 0 auto' }}>
                  默认插入
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
