/**
 * 「自检」卡（0.22.0，借鉴 dsh-ops 的 status/probe）。
 *
 * 为什么要有它：本插件的状态散在五处（设置页写入说明、面板提示、宿主日志、设置文档、
 * 以及"点了没反应"这种什么都不说的情况）。排障时没有一处能一次看全。
 * 这张卡点一下就把宿主半那份报告摊开（路由见 settings-contract 的 DOCTOR_API_PATH）。
 */
import { useCallback, useState } from 'react'
import { DOCTOR_API_PATH } from '../settings-contract.ts'
import { description, optHint } from './styles.ts'

/** 报告里的一行（与宿主半 doctor.ts 的 DoctorRow 同形）。 */
export interface DoctorRow {
  readonly id: string
  readonly label: string
  readonly level: 'ok' | 'info' | 'warn' | 'fail'
  readonly detail: string
}

type State =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'ok'; readonly rows: readonly DoctorRow[] }
  | { readonly kind: 'error'; readonly message: string }

const LEVEL_COLOR: Record<DoctorRow['level'], string> = {
  ok: 'var(--dsw-alias-label-primary)',
  info: 'var(--dsw-alias-label-secondary)',
  warn: '#b26a00',
  fail: '#c62828',
}

const LEVEL_MARK: Record<DoctorRow['level'], string> = { ok: '✓', info: '·', warn: '!', fail: '✗' }

/** 把服务端返回的行收窄成安全形状（坏行直接丢掉，不渲染 undefined）。 */
function sanitizeRows(value: unknown): readonly DoctorRow[] {
  if (!Array.isArray(value)) return []
  const levels: readonly string[] = ['ok', 'info', 'warn', 'fail']
  return value.flatMap((row) => {
    if (typeof row !== 'object' || row === null) return []
    const item = row as Record<string, unknown>
    const level = typeof item.level === 'string' && levels.includes(item.level) ? item.level as DoctorRow['level'] : 'info'
    if (typeof item.label !== 'string' || typeof item.detail !== 'string') return []
    return [{
      id: typeof item.id === 'string' ? item.id : item.label,
      label: item.label,
      level,
      detail: item.detail,
    }]
  })
}

/** 自检卡。 */
export function DoctorCard(): React.ReactElement {
  const [state, setState] = useState<State>({ kind: 'idle' })

  const run = useCallback((): void => {
    setState({ kind: 'loading' })
    void fetch(DOCTOR_API_PATH, { headers: { accept: 'application/json' } })
      .then(async (response) => {
        const raw = await response.text()
        let parsed: unknown
        try {
          parsed = JSON.parse(raw)
        } catch {
          setState({ kind: 'error', message: `服务端返回的不是 JSON（HTTP ${String(response.status)}）` })
          return
        }
        const row = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as Record<string, unknown>
        if (row.ok !== true) {
          setState({ kind: 'error', message: typeof row.error === 'string' ? row.error : '自检失败（没有原因）' })
          return
        }
        setState({ kind: 'ok', rows: sanitizeRows(row.rows) })
      })
      .catch((error: unknown) => {
        setState({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
      })
  }, [])

  return (
    <>
      <p style={description}>
        把插件各处状态摊平成一张表：设置字段是否都在宿主 schema 里（不在的话开关拨不动）、
        八栏开关、终端替换、请求头运行期覆盖、快捷指令本、通知凭据、解释层档位、运行环境。
        这些都是<strong>只读</strong>检查，不会改动任何东西。
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0' }}>
        <button
          type="button"
          className="dsh-ux-restartButton"
          disabled={state.kind === 'loading'}
          onMouseDown={event => { event.preventDefault() }}
          onClick={run}
        >
          {state.kind === 'loading' ? '自检中…' : '运行自检'}
        </button>
      </div>
      {state.kind === 'error' && <p style={optHint}>自检失败：{state.message}</p>}
      {state.kind === 'ok' && (
        <div>
          {state.rows.map(row => (
            <div key={row.id} style={{ display: 'flex', gap: 6, margin: '4px 0' }}>
              <span aria-hidden style={{ color: LEVEL_COLOR[row.level], flex: '0 0 auto' }}>{LEVEL_MARK[row.level]}</span>
              <span style={{ flex: '0 0 auto', color: LEVEL_COLOR[row.level] }}>{row.label}</span>
              <span style={{ color: 'var(--dsw-alias-label-secondary)', minWidth: 0 }}>{row.detail}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
