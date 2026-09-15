/**
 * 插入模式的三选一控件（关 / 每次 / 仅首次）：面板与设置页共用。
 *
 * 为什么是**一个**控件而不是两个勾选框：「每次」与「仅首次」互相排斥，两个独立勾选框
 * 就能造出「同时又每次又仅首次」的矛盾状态。这里只发出一个 mode，由
 * `withInsertMode` 一次把两个标志写对。
 *
 * 渲染交给通用的 `PillChoice`（右键菜单模式也用同一个，见该文件）。
 */
import React from 'react'
import { INSERT_MODES, type InsertMode } from '../settings-contract.ts'
import { PillChoice } from './PillChoice.tsx'

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

/** 「关 / 每次 / 仅首次」。 */
export function InsertModeControl({ mode, onChange, compact = false, label }: InsertModeControlProps) {
  return (
    <PillChoice
      items={INSERT_MODES}
      value={mode}
      onChange={onChange}
      compact={compact}
      ariaLabel={label === undefined ? '发送时插入' : `发送时插入（${label}）`}
    />
  )
}
