/**
 * 标题栏条上的重启按钮（0.15.3）。
 *
 * **摆放**照 `HHHEEEWWW/dsh-quick-restart`（逐字读它的 `lib/client.js`）：
 *   · 挂在 `shell.overlay`（那张覆盖整帧的绝对层）里，子元素贴顶 ⇒ 落在标题栏条上；
 *   · 靠 `env(titlebar-area-x)` / `env(titlebar-area-width)` 算出原生窗口控件占的宽度，
 *     `right: calc(100% - x - width)` 正好把它摆在**最小化按钮左边**，任何窗口尺寸都不漂；
 *   · 只有在 `data-windows-titlebar` 存在时（Windows 桌面壳）才渲染 —— 浏览器里直接开
 *     `http://127.0.0.1:PORT` 时那个属性不存在，免得浮在页面顶上；
 *   · `-webkit-app-region: no-drag`：否则按钮所在的那条会被当成窗口拖拽区，点不着。
 *
 * **外观与行为仍是我们自己的**（用户交代：「改的是位置与摆放，不是重新设计按钮样式」）：
 * 颜色走主题 token、两步就地确认、确认后进我们的全屏重启页（带 `?restarted=1` 自动刷新）。
 * 几何尺寸照它（28px 高 / 最小 104px 宽 / padding 0 12px），因为那些尺寸是照标题栏定的。
 */
import React, { useEffect, useState } from 'react'
import { enterRestartScreen, requestRestart } from './restart-screen.ts'

/** 样式 id（只注入一次）。 */
const STYLE_ID = 'composer-ux-titlebar-style'
/** 第一次点之后等多久自动复位。 */
const ARMED_RESET_MS = 4_000

/** 它的几何：贴顶 + 靠 env() 让开原生控件；尺寸照标题栏那 40px。 */
const STYLE = [
  '@keyframes composer-ux-titlebar-spin{to{transform:rotate(360deg)}}',
  '.composer-ux-titlebar{position:absolute;top:0;z-index:30;-webkit-app-region:no-drag;',
  'right:calc(100% - env(titlebar-area-x,0px) - env(titlebar-area-width,calc(100% - 138px)));',
  'height:var(--dsh-windows-titlebar-height,40px);display:flex;align-items:center;padding-right:6px}',
  '.composer-ux-titlebar>button{display:inline-flex;align-items:center;gap:6px;height:28px;min-width:104px;',
  'padding:0 12px;border:0.5px solid var(--dsw-alias-border-l2,rgba(255,255,255,.16));border-radius:7px;',
  'background:var(--dsw-alias-bg-layer-1,#0b0b0e);color:var(--dsw-alias-label-primary,#f7f7fa);',
  'font:inherit;font-size:12px;font-weight:600;line-height:1;cursor:pointer;white-space:nowrap}',
  '.composer-ux-titlebar>button:disabled{cursor:default;opacity:.85}',
  '.composer-ux-titlebar>button[data-error]{border-color:rgba(229,72,77,.6);color:#ffb7b9}',
].join('')

/** 只注入一次样式（多个实例也只用一份）。 */
function ensureStyle(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = STYLE
  document.head.append(style)
}

/** 重启图标（与侧边栏那枚同一套线条）。 */
function Icon({ spin }: { readonly spin: boolean }): React.ReactElement {
  return (
    <svg
      width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false"
      style={spin ? { animation: 'composer-ux-titlebar-spin 1s linear infinite' } : undefined}
    >
      <path d="M8 2.5a5.5 5.5 0 1 0 5.2 3.7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M13.4 2.2v4h-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** 标题栏条上那一枚。 */
export function RestartTitlebarButton(): React.ReactElement | null {
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    ensureStyle()
    // 门禁照它：只在 Windows 标题栏叠加（WCO）环境里渲染。
    try {
      setVisible(document.documentElement.hasAttribute('data-windows-titlebar'))
    } catch {
      setVisible(false)
    }
  }, [])

  if (!visible) return null

  const label = busy ? '重启中…' : armed ? '确认重启？' : error === '' ? '重启' : '重试'

  const click = (): void => {
    if (busy) return
    if (!armed) {
      setArmed(true)
      setError('')
      window.setTimeout(() => { setArmed(false) }, ARMED_RESET_MS)
      return
    }
    setArmed(false)
    setBusy(true)
    setError('')
    void requestRestart().then(result => {
      if (!result.ok) {
        setBusy(false)
        setError(result.error)
        return
      }
      // 进重启屏：它自己轮询到新进程回来、然后带 ?restarted=1 自动刷新。
      enterRestartScreen({ oldBoot: result.oldBoot, logPath: result.logPath })
    })
  }

  return (
    <div className="composer-ux-titlebar" data-composer-ux="restart-titlebar">
      <button
        type="button"
        title={error === ''
          ? (armed ? '再点一次确认重启（会打断正在跑的会话）' : '重启 DSH（更新插件后用；确认后显示重启进度并自动回到页面）')
          : `重启失败：${error}`}
        disabled={busy}
        data-error={error === '' ? undefined : true}
        onClick={click}
      >
        <Icon spin={busy} />
        <span>{label}</span>
      </button>
    </div>
  )
}
