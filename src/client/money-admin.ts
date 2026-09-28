/**
 * 「金额」的宿主调用封装（0.10.0）：价目同步 + 余额查询。
 *
 * ## 为什么这些必须在宿主半
 *
 * 浏览器侧发不出跨域请求（官方价格页、models.dev、DeepSeek 余额接口都是别家的域），
 * 而且余额要用 API Key —— 那是**绝不能进浏览器**的东西（宿主半从凭据服务取，见 `host.ts`）。
 * 所以客户端只做两件事：发一条指令、把宿主回的结果摆出来。
 *
 * ## 三条界面纪律
 *
 * 1. **失败要如实说**：同步失败时宿主回的是 `ok:false` + 一句人话，界面照抄，
 *    绝不自作主张显示"已同步"。这条对应宿主的纪律"抓不到就不覆盖本地价"。
 * 2. **忙碌期不许重复点**：同步要出网（models.dev 那份 5.2 MB），重复点击只会排队。
 * 3. **余额不缓存到设置里**：它是账户级、每分钟都可能变，所以只在内存里留着本次会话的值，
 *    刷新按钮按需再取（宿主那边无缓存、每次请求都是一次真实读取）。
 */
import React from 'react'
import { SYNC_API_PATH } from '../settings-contract.ts'
import type { ComposerUxSettings } from '../settings-contract.ts'
import { BALANCE_API_PATH } from '../balance.ts'

/** 余额里的一个币种。 */
export interface BalanceEntry {
  readonly currency?: string
  readonly total?: number
  readonly granted?: number
  readonly toppedUp?: number
}

/** 余额查询状态。 */
export interface BalanceState {
  /** `off` = 用户在设置里关掉了余额查询（这时一个请求都不发）。 */
  readonly status: 'off' | 'idle' | 'loading' | 'ok' | 'error'
  readonly available?: boolean
  readonly entries?: readonly BalanceEntry[]
  /** 失败原因或宿主的一句话（如实显示）。 */
  readonly message?: string
}

/** 宿主半余额路由的形状（结构对齐，不 import 宿主模块）。 */
interface BalanceResponse {
  readonly ok?: boolean
  readonly error?: string
  readonly available?: boolean
  readonly entries?: readonly BalanceEntry[]
  readonly message?: string
}

/** 价目同步的状态。 */
export interface SyncState {
  readonly busy: 'official' | 'modelsDev' | null
  /** 最近一次同步的结果（成功/失败都如实显示）。 */
  readonly note: string
  readonly ok: boolean
}

/**
 * 价目同步：两条独立的路（官方价 vs models.dev），每次点只同步一条。
 *
 * @param onDone 同步成功后的回调（宿主会写设置，但设置推送有延迟；调用方通常用它触发一次重读）。
 * @returns 当前状态与 `sync()`。
 */
export function usePriceSync(onDone?: () => void): SyncState & { readonly sync: (target: 'official' | 'modelsDev') => void } {
  const [busy, setBusy] = React.useState<'official' | 'modelsDev' | null>(null)
  const [note, setNote] = React.useState('')
  const [ok, setOk] = React.useState(true)
  const alive = React.useRef(true)
  /** 忙碌标记放 ref 而不是只靠 state：state 更新是异步的，连点两下会在同一帧里都通过检查。 */
  const busyRef = React.useRef(false)
  React.useEffect(() => () => { alive.current = false }, [])

  const sync = React.useCallback((target: 'official' | 'modelsDev'): void => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(target)
    setNote(target === 'official' ? '正在抓官方价格页…' : '正在抓 models.dev（约 5 MB，稍等）…')
    setOk(true)
    void fetch(SYNC_API_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ target }),
    })
      .then(response => response.json() as Promise<{ ok?: boolean; message?: string; error?: string }>)
      .then(next => {
        if (!alive.current) return
        setOk(next.ok === true)
        setNote(next.ok === true ? (next.message ?? '同步完成') : (next.error ?? '同步失败（本地价目未改动）'))
        if (next.ok === true) onDone?.()
      })
      .catch((error: unknown) => {
        if (!alive.current) return
        setOk(false)
        setNote(`同步请求失败：${error instanceof Error ? error.message : String(error)}`)
      })
      .finally(() => {
        busyRef.current = false
        if (alive.current) setBusy(null)
      })
  }, [onDone])

  return { busy, note, ok, sync }
}

/**
 * 余额查询：只在开关打开时取一次（挂载 + 手动刷新），不复用设置里的值。
 *
 * @param settings 当前设置（读 `balanceEnabled`）。
 * @returns 余额状态与 `refresh()`。
 */
export function useBalance(settings: ComposerUxSettings): BalanceState & { readonly refresh: () => void } {
  const enabled = settings.balanceEnabled === true
  const [state, setState] = React.useState<BalanceState>({ status: enabled ? 'idle' : 'off' })
  const [nonce, setNonce] = React.useState(0)
  const alive = React.useRef(true)
  React.useEffect(() => () => { alive.current = false }, [])

  React.useEffect(() => {
    if (!enabled) {
      setState({ status: 'off' })
      return
    }
    setState(current => ({ ...current, status: 'loading' }))
    void fetch(BALANCE_API_PATH, { headers: { accept: 'application/json' } })
      .then(response => response.json() as Promise<BalanceResponse>)
      .then(next => {
        if (!alive.current) return
        if (next.ok !== true) {
          setState({ status: 'error', message: next.error ?? '查询失败' })
          return
        }
        setState({
          status: 'ok',
          available: next.available === true,
          entries: Array.isArray(next.entries) ? next.entries : [],
          ...(next.message === undefined ? {} : { message: next.message }),
        })
      })
      .catch((error: unknown) => {
        if (!alive.current) return
        setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
      })
  }, [enabled, nonce])

  return { ...state, refresh: () => { setNonce(current => current + 1) } }
}
