/**
 * 面板内的「优化结果框」（0.12.0，用户 2026-09-29 定的形状）。
 *
 * 交互契约（与用户逐条确认过）：
 *  - **外部输入框不动**：优化期间你原来写的话还在输入框里，改都还能改；
 *  - 结果进这个框：跑的时候逐条流水（每条都已通过逐字依据校验），跑完把**成品**放进
 *    可编辑的文本框 —— 你觉得哪里不顺可以就地改；
 *  - 旁边「插入输入框」由你决定何时写回（覆盖全文，Ctrl+Z 可还原）；期间输入框被改过时
 *    第一次点只提示、第二次点才覆盖（见 optimize-dock.ts 的 insertDecision）；
 *  - 「重新优化」= 再跑一轮（会覆盖框里的手改，所以先提示）；
 *  - 跑的时候点「取消」（或按 Esc）= 中止并**保留已生成的部分**；成品那时还不存在，
 *    框里如实说是"已生成的部分"。
 *
 * 这个文件只负责画：所有状态判断都在 optimize-dock.ts 的纯函数里（可在 node 里逐例钉住）。
 */
import React, { useState } from 'react'
import {
  dockPhaseText, dockSummary, type OptimizeDockState,
} from './optimize-dock.ts'
import {
  dockBox, dockButton, dockButtonDisabled, dockButtonPrimary, dockButtons, dockDropped, dockEditor,
  dockError, dockHead, dockItemRow, dockItemText, dockKind, dockList, dockMeta, dockPhase, dockSummaryLine,
} from './styles.ts'

/** 条目种类的中文名（与成品里的节标题同一套说法）。 */
const KIND_LABEL: Record<string, string> = {
  rewrite: '改写',
  requirement: '补全·要求',
  quality: '补全·质量',
  unknown: '待你定',
  plan: '分阶段计划',
  risk: '风险与预案',
}

/** 结果框的操作面（由面板注入，全部是 client.tsx 里的动作）。 */
export interface OptimizeDockActions {
  /** 把成品写回输入框（覆盖全文；必要时先要一次确认）。 */
  readonly insert: () => void
  /** 用同一段原文再跑一轮。 */
  readonly retry: () => void
  /** 中止这一轮并保留已生成的部分。 */
  readonly cancel: () => void
  /** 收起结果框（丢弃框里的内容）。 */
  readonly close: () => void
  /** 用户手改了成品。 */
  readonly edit: (text: string) => void
}

export interface OptimizeDockProps {
  readonly state: OptimizeDockState
  /** 秒表读数（跑的时候由面板统一算，两处显示同一个数）。 */
  readonly seconds: number
  readonly actions: OptimizeDockActions
}

/**
 * 把文本复制到剪贴板。
 *
 * 分两条路：`navigator.clipboard` 需要安全上下文（局域网 http 下没有），
 * 所以保留 textarea + `execCommand('copy')` 的兜底 —— 与对方 0.3.17 的做法一致。
 * @param text - 要复制的文本。
 * @returns 是否成功（失败时界面不谎报"已复制"）。
 */
export async function copyText(text: string): Promise<boolean> {
  if (text === '') return false
  try {
    if (navigator.clipboard !== undefined) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 掉到兜底路径。
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', 'readonly')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  } catch {
    return false
  }
}

/** 结果框。 */
export function OptimizeDock({ state, seconds, actions }: OptimizeDockProps) {
  const [copied, setCopied] = useState(false)
  const running = state.phase === 'running'
  const hasText = state.text.trim() !== ''
  const canInsert = state.phase === 'done' && hasText

  const onCopy = (): void => {
    void copyText(state.text).then(ok => {
      // 复制失败就不报"已复制"（界面上不该出现没发生过的事）。
      if (!ok) return
      setCopied(true)
      setTimeout(() => { setCopied(false) }, 1500)
    })
  }

  return (
    <div style={dockBox} role="group" aria-label="优化结果">
      <div style={dockHead}>
        <span style={dockPhase} role="status">{dockPhaseText(state)}</span>
        <span style={dockMeta}>
          {running
            ? `已等待 ${String(seconds)}s`
            : state.elapsedMs > 0 ? `用时 ${(state.elapsedMs / 1000).toFixed(1)} 秒` : ''}
        </span>
        {running
          ? (
            <button
              type="button"
              style={dockButton}
              title="中止这一轮，保留已经生成的部分"
              onMouseDown={event => { event.preventDefault() }}
              onClick={actions.cancel}
            >
              取消
            </button>
          )
          : (
            <button
              type="button"
              style={dockButton}
              aria-label="关闭结果框"
              title="收起结果框（丢弃框里的内容；输入框里已经插入的内容不受影响）"
              onMouseDown={event => { event.preventDefault() }}
              onClick={actions.close}
            >
              ✕
            </button>
          )}
      </div>

      {state.items.length > 0 && (
        <ol style={dockList}>
          {state.items.map(item => (
            <li key={item.id} style={dockItemRow}>
              <span style={dockKind}>{KIND_LABEL[item.kind] ?? item.kind}</span>
              <span style={dockItemText}>{item.text}</span>
              {item.quote !== '' && (
                <span style={dockMeta}>
                  {item.quoteSource === 'none'
                    ? `（模型自己补的，依据不是你原话：「${item.quote}」）`
                    : `（依据："${item.quote}"）`}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      {state.dropped.length > 0 && (
        <div style={dockDropped}>
          {`丢弃 ${String(state.dropped.length)} 条：${state.dropped.map(row => row.reason).join('；')}`}
        </div>
      )}

      {state.phase === 'error' && (
        <div style={dockError} role="alert">{state.error === '' ? '优化失败' : state.error}</div>
      )}

      {(state.phase === 'done' || state.phase === 'cancelled') && (
        <textarea
          value={state.text}
          onChange={event => { actions.edit(event.target.value) }}
          spellCheck={false}
          aria-label="优化后的提示词（可编辑）"
          placeholder={state.phase === 'cancelled'
            ? '取消时还没有成品：上面是已生成的部分。点「重新优化」跑完一轮就能拿到成品。'
            : '（成品为空）'}
          style={dockEditor}
        />
      )}

      {state.phase === 'done' && (
        <div style={dockSummaryLine}>
          {state.route === '' ? dockSummary(state) : `${dockSummary(state)} · ${state.route}`}
        </div>
      )}

      <div style={dockButtons}>
        <button
          type="button"
          disabled={!canInsert}
          style={canInsert ? dockButtonPrimary : dockButtonDisabled}
          title={canInsert ? '把成品写回输入框（覆盖全文，Ctrl+Z 可还原）' : '还没有成品可插入'}
          onMouseDown={event => { event.preventDefault() }}
          onClick={actions.insert}
        >
          插入输入框
        </button>
        <button
          type="button"
          disabled={running}
          style={running ? dockButtonDisabled : dockButton}
          title={state.edited ? '再跑一轮（会覆盖你在框里手改的内容）' : '用同一段原文再跑一轮'}
          onMouseDown={event => { event.preventDefault() }}
          onClick={actions.retry}
        >
          重新优化
        </button>
        <button
          type="button"
          disabled={!hasText}
          style={hasText ? dockButton : dockButtonDisabled}
          title="复制成品"
          onMouseDown={event => { event.preventDefault() }}
          onClick={onCopy}
        >
          {copied ? '已复制 ✓' : '复制'}
        </button>
      </div>
    </div>
  )
}
