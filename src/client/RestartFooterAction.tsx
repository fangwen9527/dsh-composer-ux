/**
 * 侧边栏脚注的「重启」入口（0.15.0，照 `Noah0509/dsh-quick-restart`：它在
 * `sidebar.footer.action` 放了一枚 —— 宽栏显示文字、窄栏（56px 轨道）只显示图标，
 * 这样"随手就能点"）。
 *
 * 这里只做三件事：两步确认（第一次点变成「确认重启？」）、发请求、进**重启屏**
 * （轮询 + 恢复后自动刷新，见 `restart-screen.ts`）。重启机制本身（宿主半）不动。
 *
 * 确认用**就地两步**而不是弹窗：与设置页那枚、以及「丢弃」按钮同一套做法 ——
 * 不抢焦点、不打断正在跑的会话，点错一次也不会真的重启。
 */
import React, { useState } from 'react'
import { enterRestartScreen, requestRestart } from './restart-screen.ts'

/** 第一次点之后等多久自动复位（免得"确认"状态一直留着）。 */
const ARMED_RESET_MS = 4_000

export interface RestartFooterActionProps {
  /** 侧边栏是不是宽栏（窄栏 = 56px 轨道，只放图标）。 */
  readonly wide?: boolean
}

/** 重启图标（与设置页那枚同一套线条，避免自造图形）。 */
function RestartIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M8 2.5a5.5 5.5 0 1 0 5.2 3.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path d="M13.4 2.2v4h-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** 侧边栏脚注那一枚。 */
export function RestartFooterAction({ wide = false }: RestartFooterActionProps): React.ReactElement {
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  let resetTimer: number | null = null

  const arm = (): void => {
    setArmed(true)
    setNote('')
    if (resetTimer !== null) window.clearTimeout(resetTimer)
    resetTimer = window.setTimeout(() => { setArmed(false) }, ARMED_RESET_MS)
  }

  const go = (): void => {
    setArmed(false)
    setBusy(true)
    setNote('')
    void requestRestart().then(result => {
      setBusy(false)
      if (!result.ok) {
        setNote(result.error)
        return
      }
      // 进重启屏：它会自己轮询到新进程回来、然后自动刷新这个页面。
      enterRestartScreen({ oldBoot: result.oldBoot, logPath: result.logPath })
    })
  }

  const label = busy ? '重启中…' : armed ? '确认重启？' : '重启'
  const title = note !== ''
    ? `重启失败：${note}`
    : armed
      ? '再点一次确认重启（会把正在跑的会话打断）'
      : '重启 DSH 服务（会打断正在跑的会话；确认后会显示重启进度并自动回到页面）'

  return (
    <button
      type="button"
      data-composer-ux="restart-footer"
      aria-label="重启 DSH"
      title={title}
      disabled={busy}
      style={wide ? wideStyle(armed) : railStyle(armed)}
      onMouseDown={event => { event.preventDefault() }}
      onClick={() => { if (armed) go(); else arm() }}
    >
      <RestartIcon />
      {wide ? <span>{label}</span> : null}
    </button>
  )
}

/** 宽栏：跟着脚注那一排的胶囊按钮走。 */
function wideStyle(armed: boolean): React.CSSProperties {
  return {
    font: 'inherit',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 32,
    padding: '0 14px',
    borderRadius: 999,
    whiteSpace: 'nowrap',
    flexShrink: 0,
    fontSize: 12,
    border: `1px solid ${armed ? 'var(--dsw-alias-label-primary, #111)' : 'var(--dsw-alias-border-l2, #d1d5db)'}`,
    background: armed ? 'var(--dsw-alias-bg-layer-2, rgba(0,0,0,0.06))' : 'var(--dsw-alias-bg-layer-1, #fff)',
    color: 'var(--dsw-alias-label-primary, inherit)',
  }
}

/** 窄栏（56px 轨道）：只留图标。 */
function railStyle(armed: boolean): React.CSSProperties {
  return {
    font: 'inherit',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 8,
    flexShrink: 0,
    border: 'none',
    background: armed ? 'var(--dsw-alias-bg-layer-2, rgba(0,0,0,0.06))' : 'transparent',
    color: armed ? 'var(--dsw-alias-label-primary, #111)' : 'var(--dsw-alias-label-secondary, #4b5563)',
  }
}
