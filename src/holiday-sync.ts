/**
 * 法定节假日**自动获取**（0.11.0，宿主半专用：允许 node API 与网络请求）。
 *
 * ## 为什么"自动检测节假日"必须是"拉一份表"
 *
 * 中国的法定节假日**算不出来**：
 *
 *  · 清明 / 端午 / 中秋 走农历，纯公历算法给不出来；
 *  · "放几天、哪天调休补班"是**政策决定** —— 国务院办公厅每年年底才发次年安排，
 *    连"春节从除夕放到初几"都逐年不同。
 *
 * 所以本插件的做法是：**日期表来自公开数据源，判定规则留在自己手里**。规则（工作日的
 * 09:00–12:00、14:00–18:00 为高峰，周末/节假日全天谷价）在 `pricing.ts` 里，是官方口径；
 * 数据源只负责回答"哪几天算节假日"。
 *
 * ## 数据源：`holiday-cn`
 *
 * · 仓库 `NateScarlet/holiday-cn`（MIT），每年一个 `{year}.json`，字段是
 *   `{"name":"中秋节","date":"2026-09-25","isOffDay":true}`；
 * · 它自己带 `papers` 字段指向**国务院办公厅通知原文**（2026 那份指到
 *   `www.gov.cn/zhengce/zhengceku/202511/content_7047091.htm`），所以数据可核；
 * · 主用 GitHub raw，失败退 jsDelivr 镜像（同一份文件的两个入口，实测都通）。
 *
 * ## 四条纪律（每条都对应一种"把账算错"的方式）
 *
 * 1. **只认 `isOffDay:true`**。`isOffDay:false` 是**调休补班日**（本该休息的周末被调成
 *    上班），2026 年就有 09-20、10-10 两天。官方公告的原文是"**周六、周日**全天不再区分
 *    峰谷时段"，按字面补班日也是周六/周日 —— 所以补班日**照样全天谷价**，这条是用户
 *    2026-09-29 拍板的（`dsh-cost-meter` 也是这么处理的）。把补班日当工作日算高峰会让那两天
 *    的金额**翻倍**。
 * 2. **抓不到就什么都不改**。网络失败、响应不是 JSON、`year` 对不上 —— 一律返回失败，
 *    缓存里那份与内置表原样不动（与 `price-sync.ts` 同一条纪律）。
 * 3. **"没公布"不是"失败"**。2027 那份文件现在就存在但只有 `{"year":2027}`（国务院年底
 *    才发），此时 `parseHolidayYear` 回**空数组**（= 还没公布）而不是 `undefined`（= 抓不到）
 *    —— 两者在界面上说的话完全不同，混起来会让用户以为网络坏了。
 * 4. **年份只增不减**。抓回来的日期**并进**已有表（`mergeHolidayDays`），不替换：
 *    "今年 + 明年"这个抓取范围会随时间推移把老年份挤出去，而老会话的历史金额要靠老日期表。
 */

import { isDayKey } from './pricing.ts'
import { fetchText } from './price-sync.ts'

/** 抓一个年份的超时。文件只有几 KB，15 秒足够。 */
export const HOLIDAY_YEAR_TIMEOUT_MS = 15_000

/**
 * 每个年份的**复核**间隔：30 天。
 *
 * 为什么不是 24 小时（价格那份的间隔）：节假日安排一年只发一次，而次年的安排通常在
 * 前一年 11 月前后公布 —— 每个月复核一次，最坏情况下新安排晚 30 天生效，代价是每月
 * 两次几 KB 的请求。也没有"必须更快"的理由：真急着用的人在设置页点一次「立即获取」。
 */
export const HOLIDAY_STALE_MS = 30 * 24 * 3_600_000

/** 生效表最多保留多少个日期（与 `parseHolidays` 的上限一致）。 */
export const HOLIDAY_MAX_DAYS = 400

/**
 * 某个年份的数据源入口。
 *
 * 两个 URL 指向**同一份文件**：GitHub raw 是权威入口，jsDelivr 是 CDN 镜像。镜像存在的
 * 唯一理由是 raw.githubusercontent.com 在某些网络下会抽 —— 两条都试，先成的算数。
 */
export function holidayYearUrls(year: number): { readonly primary: string; readonly mirror: string } {
  const tag = String(year)
  return {
    primary: `https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${tag}.json`,
    mirror: `https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${tag}.json`,
  }
}

/**
 * 该抓哪几年：**今年 + 明年**（按**北京**年份算）。
 *
 * 为什么带明年：国务院年底公布的正是次年安排，而"明年"这一份现在多半还空着 ——
 * 空着就会被 `parseHolidayYear` 判成"未公布"，下一次复核（30 天后）再来。
 * 为什么不带往年：往年安排不会再变，抓到就没有再抓的理由（老日期由内置表 + 缓存里的
 * 并集保底，见 `pricing.ts` 的 `effectiveHolidays`）。
 *
 * @param nowMs 现在（毫秒）。
 * @returns 年份数组（升序，两个元素）。
 */
export function holidayYearsWanted(nowMs: number): readonly number[] {
  const safe = Number.isFinite(nowMs) ? nowMs : Date.now()
  const year = Number(new Date(safe + 8 * 3_600_000).toISOString().slice(0, 4))
  return [year, year + 1]
}

/**
 * 解析**一个年份**的响应（纯函数）。
 *
 * @param payload 解析后的 JSON（未消毒的 wire 输入）。
 * @param expectedYear 期望的年份（与 URL 里的年份一致，防止 CDN 串年份 / 拿到别的年份的文件）。
 * @returns 该年**放假**日期表（升序去重）；`[]` = 这一年还没公布；`undefined` = 形状不对/抓不到。
 */
export function parseHolidayYear(payload: unknown, expectedYear: number): readonly string[] | undefined {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return undefined
  const row = payload as Record<string, unknown>
  // 年份必须对得上：CDN 缓存串了年份、或对方改了文件名规则时，宁可判失败也不要往表里掺数据。
  const year = typeof row.year === 'number' ? row.year : Number(row.year)
  if (year !== expectedYear) return undefined
  const days = row.days
  // `days` 缺失 = 这一年还没公布（文件里只有 `{"year":2027}`），**不是**失败。
  if (days === undefined || days === null) return []
  if (!Array.isArray(days)) return undefined
  const out: string[] = []
  for (const item of days) {
    if (typeof item !== 'object' || item === null) continue
    const entry = item as Record<string, unknown>
    // 纪律 1：只认"放假"，补班日（isOffDay:false）不参与峰谷判定。
    if (entry.isOffDay !== true) continue
    const date = entry.date
    if (!isDayKey(date)) continue
    // 只看本年份：混进别的年份说明数据串了，宁可不收（parseHolidays 会再消毒一遍）。
    if (date.slice(0, 4) !== String(expectedYear)) continue
    out.push(date)
  }
  return [...new Set(out)].sort().slice(0, HOLIDAY_MAX_DAYS)
}

/**
 * 该不该为哪些年份发请求（纯函数，宿主半的定时器只调它）。
 *
 * 与 `price-sync.ts` 的 `autoSyncDue` 同一套态度：**只有开关真 `true` 才算开**
 * （开关未知/为假 → 一律回空数组，也就是一个请求都不发）。抽成纯函数是因为
 * "该不该出网"这件事必须能单独钉住 —— 它一旦写错，插件就会在用户没同意的情况下联网。
 *
 * @param options.enabled 设置里的开关（复用「自动同步官方价」那个）。
 * @param options.nowMs 现在（毫秒）。
 * @param options.yearsHave 缓存里已经有的年份。
 * @param options.lastAt 上次成功获取的时刻（毫秒）。
 * @param options.staleMs 复核间隔，默认 {@link HOLIDAY_STALE_MS}。
 * @returns 需要抓的年份（空数组 = 不用出网）。
 */
export function holidaySyncDue(options: {
  readonly enabled: unknown
  readonly nowMs: number
  readonly yearsHave?: readonly number[]
  readonly lastAt?: unknown
  readonly staleMs?: number
}): readonly number[] {
  if (options.enabled !== true) return []
  if (!Number.isFinite(options.nowMs)) return []
  const have = new Set((options.yearsHave ?? []).filter(year => Number.isFinite(year)))
  const last = typeof options.lastAt === 'number' && Number.isFinite(options.lastAt) ? options.lastAt : 0
  const stale = options.staleMs ?? HOLIDAY_STALE_MS
  const grown = options.nowMs - last >= stale
  return holidayYearsWanted(options.nowMs).filter(year => grown || !have.has(year))
}

/**
 * 把抓回来的日期并进已有表（纯函数）：去重、升序、最多 {@link HOLIDAY_MAX_DAYS} 条。
 *
 * 超限时丢的是**最早的**日期（`slice(-MAX)`）：自动获取只覆盖今年与明年，越界的年份
 * 不可能来自它，只可能来自别处塞进来的脏数据 —— 保住近期的安排更有用。
 *
 * @param existing 缓存里已有的日期。
 * @param incoming 这次抓到的日期。
 * @returns 并集；两边都没有就是 `undefined`（= 表还是空的，调用方用内置表）。
 */
export function mergeHolidayDays(
  existing: unknown,
  incoming: unknown,
): readonly string[] | undefined {
  const list = (value: unknown): readonly string[] => (Array.isArray(value) ? value.filter(isDayKey) : [])
  const merged = [...new Set([...list(existing), ...list(incoming)])].sort()
  return merged.length === 0 ? undefined : merged.slice(-HOLIDAY_MAX_DAYS)
}

/** 抓一年假期数据：先主入口、失败退镜像；两次都失败就是 `undefined`。 */
export async function fetchHolidayYear(
  year: number,
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {},
): Promise<readonly string[] | undefined> {
  const urls = holidayYearUrls(year)
  for (const url of [urls.primary, urls.mirror]) {
    const text = await fetchText(url, {
      ...(options.fetcher === undefined ? {} : { fetcher: options.fetcher }),
      timeoutMs: options.timeoutMs ?? HOLIDAY_YEAR_TIMEOUT_MS,
      minLength: 20,
    })
    if (text === undefined) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      continue
    }
    const days = parseHolidayYear(parsed, year)
    if (days === undefined) continue
    return days
  }
  return undefined
}

/** {@link fetchHolidayYears} 的结果。 */
export interface HolidayFetchResult {
  /** 抓到的全部日期（去重升序；含空年份的贡献为零）。 */
  readonly days: readonly string[]
  /** 成功拿到数据的年份。 */
  readonly fetched: readonly number[]
  /** 数据源说"还没公布"的年份（**不是**失败）。 */
  readonly unpublished: readonly number[]
  /** 两个入口都失败的年份。 */
  readonly failed: readonly number[]
}

/**
 * 抓若干年份的假期数据（逐年份独立成败，一年失败不影响另一年）。
 *
 * @param years 要抓的年份。
 * @param options.fetcher 注入的 fetch（测试用）。
 * @returns 见 {@link HolidayFetchResult}。
 */
export async function fetchHolidayYears(
  years: readonly number[],
  options: { fetcher?: typeof fetch; timeoutMs?: number } = {},
): Promise<HolidayFetchResult> {
  const days: string[] = []
  const fetched: number[] = []
  const unpublished: number[] = []
  const failed: number[] = []
  for (const year of years) {
    const result = await fetchHolidayYear(year, options)
    if (result === undefined) failed.push(year)
    else if (result.length === 0) unpublished.push(year)
    else {
      fetched.push(year)
      days.push(...result)
    }
  }
  return { days: [...new Set(days)].sort(), fetched, unpublished, failed }
}
