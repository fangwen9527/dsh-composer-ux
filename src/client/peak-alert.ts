/**
 * 峰谷提醒（0.10.0）：胶囊/明细里那行"还有多久进峰/离峰"，外加可选的浏览器系统通知。
 *
 * ## 提醒什么（这是这个功能唯一的价值）
 *
 * 高峰价是空闲价的 2 倍，而时段是**固定**的（北京时间工作日 09:00–12:00、14:00–18:00）。
 * 用户真正需要知道的是"我这一大活该不该现在跑" —— 所以提醒的是**距下一次切换还有多久**，
 * 而不是"现在是不是高峰"（后者看一眼金额就知道）。
 *
 * ## 三个已踩过的坑（照 `dsh-cost-meter` 的血泪注释抄下来）
 *
 * 1. **去重必须放模块级**，按切换点时刻记。放组件里（`useRef`/`useState`）的话，
 *    设置一变、组件一重挂，同一个切换点会**再通知一次** —— 用户会连着收到几条同样的通知。
 * 2. **系统通知要用户授权**，可能被拒、也可能在非安全上下文里整个不存在。
 *    所以：先判 `typeof Notification !== 'undefined'`，再看 `permission === 'granted'`，
 *    任何一步不满足就**静默跳过**（胶囊里那行提示照常显示，功能不残废）。
 * 3. **相位用宿主半同一份规则**：节假日表由 `/composer-ux/usage` 回给客户端（见 `host.ts`），
 *    这样"胶囊说还有 3 分钟进峰、面板说没有"这种无法解释的分歧不会出现。
 */
import React from 'react'
import { DEFAULT_PEAK_HOLIDAYS, formatCountdown, peakPhaseAt, type PeakPhase } from '../pricing.ts'
import type { ComposerUxSettings } from '../settings-contract.ts'

/** 重算间隔：所有切换点都落在整分钟上，10 秒的粒度足够贴上（也够便宜）。 */
const TICK_MS = 10_000

/** 已经为哪个切换点发过系统通知（模块级：跨组件生命周期去重，见文件头第 1 条）。 */
let notifiedSwitchAt = Number.NaN

/**
 * 当前峰谷相位（每 {@link TICK_MS} 秒重算一次）。
 * @param holidays 生效的节假日表；不传用内置那份。
 * @returns 相位（含"下一次切换在哪、还有几分钟"）。
 */
export function usePeakPhase(holidays: readonly string[] | undefined): PeakPhase {
  const table = holidays ?? DEFAULT_PEAK_HOLIDAYS
  const [phase, setPhase] = React.useState<PeakPhase>(() => peakPhaseAt(Date.now(), { holidays: table }))
  const tableKey = table.join(',')
  React.useEffect(() => {
    const compute = (): void => { setPhase(peakPhaseAt(Date.now(), { holidays: table })) }
    compute()
    const timer = setInterval(compute, TICK_MS)
    return () => { clearInterval(timer) }
    // `tableKey` 而不是数组本身：父层每次渲染都可能新建一个同内容数组，按内容比才不白重挂。
  }, [tableKey])
  return phase
}

/**
 * 一行峰谷提示文案。
 * @param phase 相位。
 * @returns 中文短句（例如 `空闲档 · 2 小时 15 分钟后转高峰`）。
 */
export function peakNoticeText(phase: PeakPhase): string {
  const tier = phase.inPeak ? '高峰档' : '空闲档'
  const reason = !phase.inPeak && phase.holiday ? '（法定节假日谷价）' : !phase.inPeak && phase.weekend ? '（周末谷价）' : ''
  if (!Number.isFinite(phase.nextAtMs)) return `${tier}${reason}`
  const target = phase.nextIntoPeak ? '转高峰' : '转空闲'
  return `${tier}${reason} · ${formatCountdown(phase.minutesUntil)}后${target}`
}

/**
 * 峰谷相位 + 按设置触发系统通知。
 *
 * @param settings 当前设置（读 `peakAlert`）。
 * @param holidays 生效的节假日表。
 * @returns 相位与提示文案（界面直接显示，不需要再判断）。
 */
export function usePeakAlert(
  settings: ComposerUxSettings,
  holidays: readonly string[] | undefined,
): { readonly phase: PeakPhase; readonly text: string } {
  const phase = usePeakPhase(holidays)
  const alert = settings.peakAlert
  const text = peakNoticeText(phase)

  React.useEffect(() => {
    if (!alert.enabled || !alert.webNotify) return
    if (!Number.isFinite(phase.nextAtMs)) return
    if (phase.minutesUntil > alert.aheadMinutes) return
    // 进峰前提醒由 onPeak 管、离峰前提醒由 onOffPeak 管（两者默认都开）。
    const wanted = phase.nextIntoPeak ? alert.onPeak : alert.onOffPeak
    if (!wanted) return
    if (notifiedSwitchAt === phase.nextAtMs) return
    notifiedSwitchAt = phase.nextAtMs
    try {
      if (typeof Notification === 'undefined') return
      if (Notification.permission !== 'granted') return
      const title = phase.nextIntoPeak ? '即将进入高峰时段（2 倍价）' : '即将进入空闲时段（半价）'
      // eslint-disable-next-line no-new
      new Notification(title, { body: `${formatCountdown(phase.minutesUntil)}后切换。DeepSeek 峰谷按时段计价，不急的活可以等等。` })
    } catch {
      /* 通知失败与金额无关，静默：胶囊里那行提示照常显示 */
    }
  }, [alert.enabled, alert.webNotify, alert.aheadMinutes, alert.onPeak, alert.onOffPeak, phase.nextAtMs, phase.minutesUntil, phase.nextIntoPeak])

  return { phase, text }
}
