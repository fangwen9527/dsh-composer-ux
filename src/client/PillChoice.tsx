/**
 * 通用「N 选一」胶囊控件：一行互斥小胶囊，选中态只改边框与文字色。
 *
 * 为什么抽出来共用：插入模式（关 / 每次 / 仅首次）与右键菜单模式（官方 / 浏览器 / 自定义）
 * 是同一种交互——一组互斥选项、当前项高亮、每项用悬停提示说清它做什么。让两处渲染同一个
 * 组件，样式与无障碍行为就不会各写一遍然后慢慢分叉。
 *
 * 选中态为什么不用实色填充：实色要配「填充 + 前景」两个令牌，0.2.0 就因为只写了一半而在
 * 深色主题下变成白底白字。只改边框和文字色就不必配对，也就不会重演。
 */
import React from 'react'
import type { CSSProperties } from 'react'

/** 一个选项。 */
export interface PillChoiceItem<T extends string> {
  readonly id: T
  readonly label: string
  /** 悬停提示：这一档到底做什么。 */
  readonly hint: string
}

/** 组件注入面。 */
export interface PillChoiceProps<T extends string> {
  /** 选项（数组顺序即界面顺序）。 */
  readonly items: readonly PillChoiceItem<T>[]
  /** 当前选中的那个。 */
  readonly value: T
  /** 用户选了另一个。 */
  readonly onChange: (value: T) => void
  /** 无障碍组名（同一屏可能有多个这样的控件，要能分辨）。 */
  readonly ariaLabel: string
  /** 面板里更紧凑（空间紧张）。 */
  readonly compact?: boolean
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

/** 选中态只改边框与文字色，不用实色填充（见文件头说明）。 */
const active: CSSProperties = {
  ...base,
  border: '0.5px solid var(--dsw-alias-brand-primary)',
  color: 'var(--dsw-alias-label-primary)',
  fontWeight: 600,
}

/** 渲染一组互斥胶囊。 */
export function PillChoice<T extends string>({
  items, value, onChange, ariaLabel, compact = false,
}: PillChoiceProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flex: '0 0 auto' }}
    >
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          title={item.hint}
          aria-pressed={value === item.id}
          style={{
            ...(value === item.id ? active : base),
            fontSize: compact ? 10 : 11,
            padding: compact ? '3px 5px' : '4px 7px',
          }}
          // 不让按钮抢走输入框里可能存在的选区（与工具行其它按钮一致）。
          onMouseDown={event => { event.preventDefault() }}
          onClick={() => { onChange(item.id) }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
