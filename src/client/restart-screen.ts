/**
 * 重启屏（0.15.0）：照 `Noah0509/dsh-quick-restart` 的做法补上我们缺的那一环 ——
 * **点下去之后不用你自己刷页面**。
 *
 * 它的做法（读源码得来）：确认重启后脱离 React、直接在 `document` 上重建一张独立重启屏，
 * 用 `stopping → starting → up` 的阶段机轮询，恢复后带 `?restarted=1` 自动刷新，刷新/多标签
 * 都有 localStorage 兜底，进度条按上一次的实际耗时自适应，失败时把日志路径摆出来可一键复制。
 *
 * 我们这边的对应关系：
 *   · 旧 boot 号 = 我们 `restart.ts` 的 `bootId(pid, now)`（GET `/composer-ux/restart` 拿）；
 *   · "服务回来"的判据 = 探测到 **boot 号变了**（不是"能连上" —— 旧进程还在时也连得上）；
 *   · 宿主半**一个字节都不动**（等端口释放、Windows 隐藏控制台那些坑都修过了）。
 *
 * 为了能单测，阶段机与标记读写都是**纯函数**（不碰 document/localStorage），
 * DOM 那层只负责画和定时。
 */

import { RESTART_CSRF_HEADER, RESTART_CSRF_VALUE } from '../settings-contract.ts'

/** 重启屏的阶段。 */
export type RestartPhase = 'stopping' | 'starting' | 'up' | 'stuck'

/** 一次探测的结果。 */
export interface RestartProbe {
  /** 服务在线吗（拿到 boot 号才算在线）。 */
  readonly online: boolean
  /** 在线时的 boot 号；离线时给空串。 */
  readonly boot: string
}

/** 阶段机状态。 */
export interface RestartTrack {
  readonly phase: RestartPhase
  /** 进入重启屏时的旧 boot 号（新进程必须与它不同）。 */
  readonly oldBoot: string
  readonly startedAt: number
  /** 见过服务下线吗 —— `stopping → starting` 的判据。 */
  readonly seenDown: boolean
  readonly attempts: number
}

/** 轮询上限：1 秒一次，两分钟还没回来就当"卡住了"（摆日志路径给人排查）。 */
export const RESTART_SCREEN_MAX_ATTEMPTS = 120
/** 进度条上限：没到 `up` 之前最多画到这里（剩下的留给"完成"那一跳）。 */
export const RESTART_PROGRESS_CAP = 95
/** 上一次重启的实际耗时没有记录时的保守预期（毫秒）。 */
export const RESTART_EXPECTED_DEFAULT_MS = 45_000
/** 标记最多认多久（超了就当过期，不再提示「重启完成」）。 */
export const RESTART_MARK_MAX_AGE_MS = 30 * 60_000

/** 标记与"上次耗时"的存储键。 */
export const RESTART_MARK_KEY = 'composer-ux-restart-mark'
export const RESTART_LAST_MS_KEY = 'composer-ux-restart-last-ms'

/** 开始跟踪一次重启。 */
export function beginRestartTrack(oldBoot: string, startedAt: number): RestartTrack {
  return { phase: 'stopping', oldBoot, startedAt, seenDown: false, attempts: 0 }
}

/**
 * 推进一次。
 *
 * 三种走法都要照顾到：
 *  1. 常见：先探测到**下线**（`seenDown`）→ 再带**新 boot 号**回来 ⇒ `up`；
 *  2. 极快/极慢的重启：可能整个 down 窗口都没被探测到，但 boot 号已经变了 ⇒ 直接 `up`
 *     （不能死等"先下线"，否则服务其实已经起来、屏幕却永远转）；
 *  3. 一直在线且 boot 号没变（重启没生效）或超时 ⇒ `stuck`，把日志路径摆给人看。
 *
 * @param track - 当前状态。
 * @param probe - 这一次探测的结果。
 * @param attemptLimit - 轮询上限（测试可调小）。
 * @returns 推进后的状态（不改原对象）。
 */
export function advanceRestartTrack(
  track: RestartTrack,
  probe: RestartProbe,
  attemptLimit: number = RESTART_SCREEN_MAX_ATTEMPTS,
): RestartTrack {
  const attempts = track.attempts + 1
  // 新进程回来了：boot 号与进入时不同，且确实在线。
  if (probe.online && probe.boot !== track.oldBoot && probe.boot !== '') {
    return { ...track, phase: 'up', attempts }
  }
  // 还没见到下线：要么还在停，要么这个老进程根本没走。
  if (!track.seenDown) {
    if (!probe.online) return { ...track, phase: 'stopping', seenDown: true, attempts }
    return { ...track, phase: attempts >= attemptLimit ? 'stuck' : 'stopping', attempts }
  }
  // 已经见过下线，正在等新进程。
  return { ...track, phase: attempts >= attemptLimit ? 'stuck' : 'starting', attempts }
}

/**
 * 进度条：按上一次的实际耗时自适应。
 *
 * 为什么要自适应：重启耗时在不同机器上差好几倍（本项目实测里 3 秒到 40 秒都有），
 * 固定进度会让快的机器"卡在 90%"、慢的机器"早早就满了"。所以用上次的实际值当分母。
 *
 * @param track - 当前状态。
 * @param now - 当前时刻。
 * @param expectedMs - 预期总耗时（默认取上次实际值/保守值）。
 * @returns 0–95 的百分比，以及"比预期慢"标记。
 */
export function restartProgress(
  track: RestartTrack,
  now: number,
  expectedMs: number = RESTART_EXPECTED_DEFAULT_MS,
): { readonly percent: number; readonly slow: boolean } {
  if (track.phase === 'up') return { percent: 100, slow: false }
  const expected = expectedMs > 0 ? expectedMs : RESTART_EXPECTED_DEFAULT_MS
  const elapsed = Math.max(0, now - track.startedAt)
  const raw = Math.round((elapsed / expected) * RESTART_PROGRESS_CAP)
  return { percent: Math.max(2, Math.min(RESTART_PROGRESS_CAP, raw)), slow: elapsed > expected }
}

/** 每个阶段给人看的一句话（重启屏上那行大字）。 */
export function restartMessage(phase: RestartPhase): string {
  if (phase === 'stopping') return '正在停旧进程…'
  if (phase === 'starting') return '新进程正在起来…'
  if (phase === 'up') return '重启完成，正在刷新页面…'
  return '服务一直在线，这次重启可能没生效'
}

/** 「重启中」期间的兜底标记（刷新/多标签都用它）。 */
export interface RestartMark {
  readonly startedAt: number
  readonly oldBoot: string
  readonly logPath: string
}

/** 最小的存储接口（`localStorage` 的可用子集，便于测试注入）。 */
export interface RestartStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

/** 写标记。**不抛**：隐私模式等场景下 localStorage 会直接抛，重启流程不能被它拖死。 */
export function writeRestartMark(storage: RestartStorage | undefined, mark: RestartMark): void {
  try {
    storage?.setItem(RESTART_MARK_KEY, JSON.stringify(mark))
  } catch {
    /* 存不了就算了：屏幕照样能用，只是刷新后不再提示"重启完成" */
  }
}

/** 读并清掉标记（页面加载后调用一次）。超龄/坏数据一律当没有。 */
export function consumeRestartMark(
  storage: RestartStorage | undefined,
  now: number,
  maxAgeMs: number = RESTART_MARK_MAX_AGE_MS,
): RestartMark | null {
  try {
    const raw = storage?.getItem(RESTART_MARK_KEY)
    if (raw === null || raw === undefined || raw === '') return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const startedAt = typeof parsed.startedAt === 'number' ? parsed.startedAt : 0
    if (startedAt <= 0 || now - startedAt > maxAgeMs) {
      storage?.removeItem(RESTART_MARK_KEY)
      return null
    }
    const mark: RestartMark = {
      startedAt,
      oldBoot: typeof parsed.oldBoot === 'string' ? parsed.oldBoot : '',
      logPath: typeof parsed.logPath === 'string' ? parsed.logPath : '',
    }
    storage?.removeItem(RESTART_MARK_KEY)
    return mark
  } catch {
    return null
  }
}

/** 上次重启的实际耗时（毫秒）；没有记录时给保守默认值。 */
export function readLastRestartMs(storage: RestartStorage | undefined): number {
  try {
    const raw = storage?.getItem(RESTART_LAST_MS_KEY)
    const value = raw === null || raw === undefined ? Number.NaN : Number(raw)
    return Number.isFinite(value) && value > 0 ? value : RESTART_EXPECTED_DEFAULT_MS
  } catch {
    return RESTART_EXPECTED_DEFAULT_MS
  }
}

/** 记下这次的实际耗时（下次进度条用它当分母）。 */
export function writeLastRestartMs(storage: RestartStorage | undefined, ms: number): void {
  try {
    if (Number.isFinite(ms) && ms > 0) storage?.setItem(RESTART_LAST_MS_KEY, String(Math.round(ms)))
  } catch {
    /* 同上：存不了不影响功能 */
  }
}

/** 探测服务是否回来（默认打宿主的重启路由 GET）。 */
export async function probeRestart(fetcher: typeof fetch = fetch): Promise<RestartProbe> {
  try {
    const response = await fetcher('/composer-ux/restart', { cache: 'no-store' })
    if (!response.ok) return { online: false, boot: '' }
    const body = (await response.json()) as Record<string, unknown>
    const boot = typeof body.boot === 'string' ? body.boot : ''
    return { online: boot !== '', boot }
  } catch {
    // 进程正在退出/还没起来：网络层失败就是"离线"，不是错误。
    return { online: false, boot: '' }
  }
}

// ── 屏幕那一层（薄：只负责画与定时；判据全在上面那些纯函数里）────────────────────

/** 重启屏的注入点（默认用浏览器环境，测试可整体替换）。 */
export interface RestartScreenDeps {
  /** 进入时的旧 boot 号（调用方刚从状态口拿到的那一个）。 */
  readonly oldBoot: string
  readonly logPath: string
  readonly probe: () => Promise<RestartProbe>
  readonly now: () => number
  readonly storage: RestartStorage | undefined
  readonly doc: Document
  readonly reload: (href: string) => void
  readonly href: string
  readonly setTimer: (fn: () => void, ms: number) => unknown
  readonly clearTimer: (id: unknown) => void
  /** 轮询间隔（默认 1 秒）。 */
  readonly pollMs?: number
  /** 轮询上限（默认两分钟）。 */
  readonly attemptLimit?: number
}

/** 取默认注入（浏览器）。 */
function browserDefaults(oldBoot: string, logPath: string): RestartScreenDeps {
  // 环境安全：没有 window/document 的形态（SSR、以及测试里直接 eval 客户端产物）
  // 不能在这里抛 —— 入口自己会判断 "拿不到宿主环境就不做事"。
  const win = typeof window === 'undefined' ? undefined : window
  const doc = typeof document === 'undefined' ? undefined : document
  let storage: RestartStorage | undefined
  try {
    storage = win?.localStorage
  } catch {
    storage = undefined
  }
  return {
    oldBoot,
    logPath,
    probe: () => probeRestart(),
    now: () => Date.now(),
    storage,
    // 这两个只在真的用得到时才会被碰（enterRestartScreen 会先判断 doc）。
    doc: doc as Document,
    // 测试/嵌入形态里  可能存在但  没有：可选链必须再深一层。
    reload: href => { win?.location?.replace?.(href) },
    href: win?.location?.href ?? '',
    setTimer: (fn, ms) => (typeof win?.setTimeout === 'function' ? win.setTimeout(fn, ms) : 0),
    clearTimer: id => { if (typeof win?.clearTimeout === 'function') win.clearTimeout(id as number) },
  }
}

/** 加 `?restarted=1`（保留原有查询串）。 */
export function restartReloadHref(href: string): string {
  const [base, hash = ''] = href.split('#')
  const [path, query = ''] = (base ?? '').split('?')
  const params = new URLSearchParams(query)
  params.set('restarted', '1')
  return `${path ?? ''}?${params.toString()}${hash === '' ? '' : `#${hash}`}`
}

/**
 * 进入重启屏：全屏覆盖一层，轮询到新进程回来就自动刷新。
 *
 * 为什么直接往 body 上挂、不改 React 树：这一屏要活到"页面即将被替换"为止，
 * 而重启期间任何一次 React 重渲染（会话事件、断线重连）都可能把它冲掉。
 *
 * @param overrides - 注入点覆盖（`oldBoot`/`logPath` 必有）。
 * @returns 一个 `stop()`（组件卸载/用户放弃时收尾）。
 */
export function enterRestartScreen(
  overrides: Partial<RestartScreenDeps> & { readonly oldBoot: string; readonly logPath: string },
): { readonly stop: () => void } {
  const deps: RestartScreenDeps = { ...browserDefaults(overrides.oldBoot, overrides.logPath), ...overrides }
  const doc = deps.doc
  // 没有 DOM 就什么都不做（SSR/测试环境）：重启屏是纯界面，拿不到宿主环境时静默退回。
  if (doc === undefined || doc.body === undefined) return { stop: () => undefined }
  const pollMs = deps.pollMs ?? 1_000
  const limit = deps.attemptLimit ?? RESTART_SCREEN_MAX_ATTEMPTS

  writeRestartMark(deps.storage, { startedAt: deps.now(), oldBoot: deps.oldBoot, logPath: deps.logPath })
  try {
    doc.title = '⟳ 重启中…'
  } catch {
    /* 某些嵌入形态没有 title：忽略 */
  }

  const layer = doc.createElement('div')
  layer.setAttribute('data-composer-ux', 'restart-screen')
  layer.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:2147483000', 'display:flex', 'flex-direction:column',
    'align-items:center', 'justify-content:center', 'gap:14px', 'padding:24px',
    'background:var(--dsw-alias-bg-layer-0,rgba(20,20,22,0.96))',
    'color:var(--dsw-alias-label-primary,#fff)', 'text-align:center',
    'font-family:inherit', 'font-size:13px',
  ].join(';')
  const spinner = doc.createElement('div')
  spinner.style.cssText = [
    'width:28px', 'height:28px', 'border-radius:50%',
    'border:3px solid var(--dsw-alias-border-l2,rgba(255,255,255,0.25))',
    'border-top-color:var(--dsw-alias-label-primary,#fff)', 'animation:composer-ux-restart-spin 0.9s linear infinite',
  ].join(';')
  const title = doc.createElement('div')
  title.textContent = '正在重启 DSH 服务…'
  title.style.cssText = 'font-size:15px;font-weight:600'
  const phase = doc.createElement('div')
  phase.style.cssText = 'opacity:0.8'
  const track = doc.createElement('div')
  track.style.cssText = [
    'width:min(320px,70vw)', 'height:4px', 'border-radius:999px',
    'background:var(--dsw-alias-border-l2,rgba(255,255,255,0.18))', 'overflow:hidden',
  ].join(';')
  const bar = doc.createElement('div')
  bar.style.cssText = 'height:100%;width:2%;border-radius:999px;background:var(--dsw-alias-label-primary,#fff);transition:width 0.4s ease'
  track.append(bar)
  const detail = doc.createElement('div')
  detail.style.cssText = 'opacity:0.6;font-size:11.5px;max-width:min(520px,86vw);line-height:1.6'
  const actions = doc.createElement('div')
  actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center'

  const style = doc.createElement('style')
  style.textContent = '@keyframes composer-ux-restart-spin{to{transform:rotate(360deg)}}'
  layer.append(style, spinner, title, phase, track, detail, actions)
  doc.body.append(layer)

  const button = (label: string, onClick: () => void): HTMLButtonElement => {
    const el = doc.createElement('button')
    el.type = 'button'
    el.textContent = label
    el.style.cssText = [
      'font:inherit', 'cursor:pointer', 'padding:5px 12px', 'border-radius:999px',
      'border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,0.3))',
      'background:transparent', 'color:inherit',
    ].join(';')
    el.addEventListener('click', onClick)
    return el
  }

  let state = beginRestartTrack(deps.oldBoot, deps.now())
  const expected = readLastRestartMs(deps.storage)
  let timer: unknown = null
  let stopped = false

  const paint = (): void => {
    const { percent, slow } = restartProgress(state, deps.now(), expected)
    phase.textContent = restartMessage(state.phase)
    bar.style.width = `${String(percent)}%`
    detail.textContent = slow && state.phase !== 'up'
      ? `比预期慢一些（预期约 ${String(Math.round(expected / 1000))} 秒）… 再等等，不要关掉这个页面。`
      : '旧进程退出后会自动把新进程拉起来，服务一回来这个页面就会自己刷新。'
    if (state.phase === 'stuck') {
      spinner.style.display = 'none'
      title.textContent = '这次重启可能没生效'
      detail.textContent = deps.logPath === ''
        ? '服务一直在线，且没有观察到新进程。可以手动刷新页面看看。'
        : `服务一直在线，且没有观察到新进程。重启日志：${deps.logPath}`
      actions.replaceChildren(
        button('复制日志路径', () => {
          void navigator.clipboard?.writeText(deps.logPath).catch(() => undefined)
        }),
        button('重新加载页面', () => { deps.reload(deps.href) }),
      )
    }
  }

  const finish = (): void => {
    writeLastRestartMs(deps.storage, deps.now() - state.startedAt)
    paint()
    deps.reload(restartReloadHref(deps.href))
    stop()
  }

  const tick = (): void => {
    if (stopped) return
    void deps.probe().then(probe => {
      if (stopped) return
      state = advanceRestartTrack(state, probe, limit)
      paint()
      if (state.phase === 'up') { finish(); return }
      if (state.phase === 'stuck') return
      timer = deps.setTimer(tick, pollMs)
    })
  }

  const stop = (): void => {
    stopped = true
    if (timer !== null) deps.clearTimer(timer)
  }

  paint()
  timer = deps.setTimer(tick, pollMs)
  return { stop }
}

/**
 * 页面加载后调用一次：如果这次加载是"重启后自动刷新"回来的，提示一句「重启完成」。
 *
 * 为什么要它：自动刷新是**整页替换**，屏幕上不会留下任何"刚才重启过"的痕迹 ——
 * 不说一句的话，用户看到的是"页面闪了一下"，不确定到底成没成。
 *
 * @param overrides - 注入点覆盖（测试用）。
 */
export function maybeShowRestartDone(
  overrides: Partial<RestartScreenDeps> & { readonly search?: string } = {},
): boolean {
  const deps = { ...browserDefaults('', ''), ...overrides }
  const search = overrides.search
    ?? (typeof window === 'undefined' ? '' : (window.location?.search ?? ''))
  if (!new URLSearchParams(search).has('restarted')) return false
  if (deps.doc === undefined || deps.doc.body === undefined) return false
  const mark = consumeRestartMark(deps.storage, deps.now())
  if (mark === null) return false
  const seconds = Math.max(1, Math.round((deps.now() - mark.startedAt) / 1000))
  const toast = deps.doc.createElement('div')
  toast.setAttribute('data-composer-ux', 'restart-done')
  toast.textContent = `重启完成（用时约 ${String(seconds)} 秒）`
  toast.style.cssText = [
    'position:fixed', 'left:50%', 'bottom:28px', 'transform:translateX(-50%)',
    'z-index:2147483000', 'padding:7px 14px', 'border-radius:999px',
    'background:var(--dsw-specific-menu,rgba(28,28,30,0.96))',
    'color:var(--dsw-alias-label-primary,#fff)', 'border:0.5px solid var(--dsw-alias-border-l2,rgba(255,255,255,0.2))',
    'font-size:12px', 'font-family:inherit', 'box-shadow:0 6px 24px rgba(0,0,0,0.28)',
  ].join(';')
  deps.doc.body.append(toast)
  deps.setTimer(() => { toast.remove() }, 4_000)
  return true
}

/** 发一次重启请求的结果（两个入口共用）。 */
export type RestartRequestResult =
  | { readonly ok: true; readonly oldBoot: string; readonly logPath: string }
  | { readonly ok: false; readonly error: string }

/**
 * 发一次重启请求：先读一次状态（拿旧 boot 号与日志路径），再 POST 排重启。
 *
 * 为什么要先读：重启屏判断"新进程回来了"的唯一依据是 **boot 号变了**，
 * 而启动之后那个号就再也读不到了 —— 必须在进程退出前先把它记下来。
 *
 * @param fetcher - 注入的 fetch（测试用）。
 * @returns 成功时给出旧 boot 号与日志路径；失败给一句能显示的话。
 */
export async function requestRestart(fetcher: typeof fetch = fetch): Promise<RestartRequestResult> {
  let oldBoot = ''
  let logPath = ''
  try {
    const status = await fetcher('/composer-ux/restart', {
      cache: 'no-store',
      headers: { [RESTART_CSRF_HEADER]: RESTART_CSRF_VALUE },
    })
    if (status.ok) {
      const facts = (await status.json()) as Record<string, unknown>
      oldBoot = typeof facts.boot === 'string' ? facts.boot : ''
      logPath = typeof facts.logHint === 'string' ? facts.logHint : ''
      if (typeof facts.blocked === 'string' && facts.blocked !== '') {
        return { ok: false, error: `这个宿主当前不允许从界面重启（${facts.blocked}）` }
      }
    }
  } catch {
    // 读不到状态也照样可以试着发重启（下面的 POST 会给出结论）。
  }
  try {
    const response = await fetcher('/composer-ux/restart', {
      method: 'POST',
      headers: { 'content-type': 'application/json', [RESTART_CSRF_HEADER]: RESTART_CSRF_VALUE },
      body: '{}',
    })
    const parsed = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string }
    if (response.status !== 202 && parsed.ok !== true) {
      return { ok: false, error: parsed.error ?? `HTTP ${String(response.status)}` }
    }
    return { ok: true, oldBoot, logPath }
  } catch {
    // 宿主可能死在响应发完之前：那不是失败（进程已经按请求走了），继续进重启屏。
    return { ok: true, oldBoot, logPath }
  }
}
