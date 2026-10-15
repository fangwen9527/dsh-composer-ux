/**
 * 第九栏「自启动」的正文（0.23.0）。
 *
 * 开关本身在卡头（与其余八栏一致，由 SettingsSection 拿着 `useAutostart` 的状态渲染）；
 * 这里只放：会注册什么（人话）、注册表值名与实际值、失败/提示、以及「立即试一次」。
 */
import type { AutostartView } from './autostart.ts'
import { description, optHint } from './styles.ts'

/** 自启动卡正文。 */
export function AutostartCard(props: { readonly view: AutostartView }): React.ReactElement {
  const { view } = props
  const state = view.state
  // ⚠️ 说明与按钮**常显**：状态还没回来就把整张卡换成"正在读…"的话，用户会看到一片空白，
  // 而且按钮（唯一的操作）会消失一下 —— 2026-10-15 的渲染测试就是这么抓到的。
  // 只有"登录后会执行什么 / 值名 / 系统里的值"这一段等状态。
  return (
    <>
      <p style={description}>
        打开后，<strong>登录 Windows 时自动把 DSH 拉起来</strong>。注册的是
        <strong>当前这个运行时</strong>：在网页版里打开就注册网页版（用当前 profile、当前这条启动命令），
        在桌面应用里打开就注册桌面应用。两个运行时各用自己那一条启动项，互不覆盖。
        <br />
        <span style={{ opacity: 0.75 }}>
          只写 `HKEY_CURRENT_USER\...\Run`（当前用户，**不需要管理员**）；关掉开关就是删掉自己那一条。
          状态以**系统里实际有没有**为准 —— 你在注册表里手动删了，这里就显示关。
        </span>
      </p>

      {state === undefined
        ? <p style={optHint}>{view.error !== '' ? `读不到启动项状态：${view.error}` : '正在读启动项状态…'}</p>
        : (
            <div style={{ margin: '10px 0', fontSize: 12, lineHeight: 1.7 }}>
              <div><span style={{ opacity: 0.7 }}>登录后会执行：</span>{state.describe === '' ? '（拿不到，见下面的提示）' : state.describe}</div>
              <div><span style={{ opacity: 0.7 }}>启动项值名：</span>{state.entryName === '' ? '（拿不到）' : state.entryName}</div>
              {state.supported && state.registeredValue !== '' && (
                <div><span style={{ opacity: 0.7 }}>系统里现在是：</span>{state.registeredValue}</div>
              )}
              {!state.supported && (
                <div style={{ color: '#b26a00' }}>这一栏只在 Windows 上有意义，当前平台不生效。</div>
              )}
            </div>
          )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0' }}>
        <button
          type="button"
          className="dsh-ux-restartButton"
          disabled={view.busy || state === undefined}
          onMouseDown={event => { event.preventDefault() }}
          onClick={view.tryOnce}
        >
          {view.busy ? '处理中…' : '立即试一次'}
        </button>
        <span style={{ fontSize: 12, opacity: 0.75 }}>
          用自启动那条命令真的拉一次（网页版会最小化到任务栏），验证它在你这台机器上确实有效。
        </span>
      </div>

      {state !== undefined && state.note !== '' && <p style={optHint}>{state.note}</p>}
      {view.error !== '' && <p style={optHint}>操作失败：{view.error}</p>}
      {view.error === '' && view.message !== '' && <p style={optHint}>{view.message}</p>}
    </>
  )
}
