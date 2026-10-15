/**
 * 「自启动」卡的客户端半（0.23.0）。
 *
 * 为什么开关**不写 settings 字段**：这个开关的真相是**注册表里那条启动项**。
 * 如果把它也存成"意图+镜像"，就会出现"设置说开着、注册表里没有"这种自相矛盾的状态
 * （你在系统里手删了启动项、或换了个 profile 跑就会这样）。所以：
 *   · 开关按下 ⇒ 直接让宿主去改注册表；
 *   · 界面上的 checked **一律**用宿主读回来的事实（GET 拿到什么就显示什么）。
 */
import { useCallback, useEffect, useState } from 'react'
import { AUTOSTART_API_PATH } from '../settings-contract.ts'

/** 宿主读出来的自启动状态（与宿主半 autostart.ts 的 AutostartState 同形）。 */
export interface AutostartState {
  readonly supported: boolean
  readonly enabled: boolean
  readonly entryName: string
  readonly registeredValue: string
  readonly expectedValue: string
  readonly describe: string
  readonly note: string
}

/** 卡的状态机。 */
export interface AutostartView {
  readonly state: AutostartState | undefined
  readonly busy: boolean
  /** 上一次动作的结果（人话）。 */
  readonly message: string
  /** 失败原因（空 = 没失败）。 */
  readonly error: string
  /** 切开关：宿主返回的**真相**会覆盖本地状态。 */
  readonly set: (next: boolean) => void
  /** 读一次状态（打开设置页时、以及动作之后）。 */
  readonly refresh: () => void
  /** 立即试一次。 */
  readonly tryOnce: () => void
}

const EMPTY: AutostartState = {
  supported: false,
  enabled: false,
  entryName: '',
  registeredValue: '',
  expectedValue: '',
  describe: '',
  note: '',
}

/** 收窄服务端返回的状态（坏值一律当"不知道"，绝不编）。 */
function sanitizeState(value: unknown): AutostartState {
  if (typeof value !== 'object' || value === null) return EMPTY
  const row = value as Record<string, unknown>
  const text = (key: string): string => (typeof row[key] === 'string' ? row[key] as string : '')
  return {
    supported: row.supported === true,
    enabled: row.enabled === true,
    entryName: text('entryName'),
    registeredValue: text('registeredValue'),
    expectedValue: text('expectedValue'),
    describe: text('describe'),
    note: text('note'),
  }
}

/** 发一次请求，把 ok/error/state/message 揉平。 */
async function call(body?: Record<string, unknown>): Promise<{ state: AutostartState, message: string, error: string }> {
  try {
    const response = await fetch(AUTOSTART_API_PATH, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? { accept: 'application/json' } : { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    const raw = await response.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return { state: EMPTY, message: '', error: `服务端返回的不是 JSON（HTTP ${String(response.status)}）` }
    }
    const row = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as Record<string, unknown>
    return {
      state: sanitizeState(row.state),
      message: typeof row.message === 'string' ? row.message : '',
      error: row.ok === true ? '' : (typeof row.error === 'string' ? row.error : '操作失败（没有原因）'),
    }
  } catch (error: unknown) {
    return { state: EMPTY, message: '', error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * 自启动卡的状态与动作。
 * @param onEnabledChange - checked 变化时通知外层（卡头的开关在 FoldCard 里，需要外层知道）。
 * @returns 上面那套视图状态与动作。
 */
export function useAutostart(onEnabledChange?: (enabled: boolean) => void): AutostartView {
  const [state, setState] = useState<AutostartState | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const apply = useCallback((next: { state: AutostartState, message: string, error: string }) => {
    setState(next.state)
    setMessage(next.message)
    setError(next.error)
    onEnabledChange?.(next.state.enabled)
  }, [onEnabledChange])

  const refresh = useCallback((): void => {
    setBusy(true)
    void call()
      .then(result => { apply({ ...result, message: result.error === '' ? result.message : '' }) })
      .finally(() => { setBusy(false) })
  }, [apply])

  const set = useCallback((next: boolean): void => {
    setBusy(true)
    setMessage(next ? '正在注册…' : '正在撤销…')
    void call({ enabled: next })
      .then(result => { apply(result) })
      .finally(() => { setBusy(false) })
  }, [apply])

  const tryOnce = useCallback((): void => {
    setBusy(true)
    void call({ action: 'try' })
      .then(result => { apply(result) })
      .finally(() => { setBusy(false) })
  }, [apply])

  useEffect(() => { refresh() }, [refresh])

  return { state, busy, message, error, set, refresh, tryOnce }
}
