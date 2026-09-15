/**
 * 插入模式的三选一控件（关 / 每次 / 仅首次）：面板与设置页共用。
 *
 * 为什么是**一个**控件而不是两个勾选框：「每次」与「仅首次」互相排斥，两个独立勾选框
 * 就能造出「同时又每次又仅首次」的矛盾状态。这里只发出一个 mode，由
 * `withInsertMode` 一次把两个标志写对。
 */
import React from 'react'
import type { CSSProperties } from 'react'
import { INSERT_MODES, type InsertMode } from '../settings-contract.ts'

/** 组件注入面。 */
export interface InsertModeControlProps {
  /** 当前模式。 */
  readonly mode: InsertMode
  /** 用户选了另一个模式。 */
  readonly onChange: (mode: InsertMode) => void
  /** 面板里更紧凑（空间紧张）。 */
  readonly compact?: boolean
  /** 无障碍标签：列表里区分是哪一条（同一屏会有很多个）。 */
  readonly label?: string
}

const base: CSSProperties = {
  border: '0.5px solid var(--dsw-alias-border-l2)',
  background: 'transparent',
  color: 'var(--dsw-alias-label-tertiary)',
  borderRadius: 999,
  cursor: 'pointer',
  lineHeight: 1,
  whiteSpace: 'nowrap',
}

/** 选中态只改边框与文字色，不用实色填充：这样不必配「填/前景」成对令牌，
 *  也就不会重演 0.2.0 那次深色主题白底白字。 */
const active: CSSProperties = {
  ...base,
  border: '0.5px solid var(--dsw-alias-brand-primary)',
  color: 'var(--dsw-alias-label-primary)',
  fontWeight: 600,
}

/** 「关 / 每次 / 仅首次」。 */
export function InsertModeControl({ mode, onChange, compact = false, label }: InsertModeControlProps) {
  return (
    <div
      role="group"
      aria-label={label === undefined ? '发送时插入' : `发送时插入（${label}）`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flex: '0 0 auto' }}
    >
      {INSERT_MODES.map(item => (
        <button
          key={item.id}
          type="button"
          title={item.hint}
          aria-pressed={mode === item.id}
          style={{
            ...(mode === item.id ? active : base),
            fontSize: compact ? 10 : 11,
            padding: compact ? '3px 5px' : '4px 7px',
          }}
          onMouseDown={event => { event.preventDefault() }}
          onClick={() => { onChange(item.id) }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
