/**
 * 「统计行」的纯逻辑层：命中率的三位小数文本 + 就地改写用的两个字符串变换。
 *
 * 0.7.0 新增。这一层**刻意不碰 React、也不碰 DOM**，理由有两条：
 *  1. 小数语义是这块能力唯一会"静默算错"的地方（见下面 `cacheHitText` 的注释），
 *     必须能在 node 里逐条钉住，而不是靠真机上看一眼；
 *  2. 定位与改写是 DOM 那半的事（`stats-dom.ts`），混在一起会让上面这条没法测。
 *
 * ── 为什么是"三位小数"而不是照抄官方 ─────────────────────────────────────────
 *
 * 官方 `StatsPills.tsx` 调 `cacheHitPercent(usage)` → `formatCacheHitPercent(read, D)`
 * 的默认档 `decimalPlaces = 0`，也就是**整数**（`缓存命中 12%`）；只有当整数四舍五入
 * 会把"没满"显示成 100% 时，它才自动多给几位（`99.95%`）——源码注释原话是
 * "without rounding a partial hit to 100%"。
 *
 * 本插件把这个默认档抬到三位（`缓存命中 12.346%`），但**保留**官方那条"绝不把部分命中
 * 说成满命中"的规则：三位小数一旦会凑成 100.000%，就继续加位，宁可显示 `99.9999%`。
 * 如果直接 `toFixed(3)`（社区插件 dsh-cache-precision 的做法），99.9999% 会显示成
 * `100.000%` —— 那是把"差一点"说成"满"，与官方口径相反。所以这里不是"照搬那个仓库"，
 * 而是"用它的位数 + 官方的诚实性"（用户 2026-09-28 拍板）。
 *
 * ── 那个仓库的第二半（加宽统计行）**没有**移植 ───────────────────────────────
 *
 * 参考实现还给那一行写了行内 `max-width`，想把统计行放宽 260px。0.7.0 做完真机核对后
 * 由用户拍板**撤掉**，原因是它的前提在 DSH 0.1.7 上不成立：
 *  · 约束统计行的是外层容器，而 `--dsh-chat-content-width` 只作用在**消息列与输入卡片**上
 *    （`ui-conversation` 的 `.card` 与 `.composerHero`）；
 *  · 真正包着统计行的 `.composerStack` **没有任何宽度上限**——而 `.composerHero` 只在
 *    空白会话（hero）生效，统计行却只在**活动会话**里渲染（`InputBar` 要求
 *    `sessionId !== undefined`），两者永不同时出现；
 *  · 于是官方那一行本来就能比聊天列宽得多，参考实现那个 `+260px` 上限反而**比可用宽度小**
 *    ——平时不生效，内容极长时还会比官方更早截断。
 * 结论写在 `CHANGELOG.md` 的 `[0.7.0]` 节；这里只留"改数字"这一半。
 */
import { activeSections, type ComposerUxSettings } from '../settings-contract.ts'

/** 官方统计行容器的属性定位：`StatsPills` 的根元素上，紧凑与详细两档都有。 */
export const STATS_ROOT_SELECTOR = '[data-composer-stats]'

/** 官方 `tokenUsage` 投影里本插件要用的三个桶（其余字段不碰）。 */
export interface TokenUsageLike {
  readonly uncachedInputTokens?: number
  readonly cacheReadTokens?: number
  readonly cacheWriteTokens?: number
}

/**
 * 本插件使用的起始小数位数。
 *
 * 「关掉这一栏」时用的不是"什么都不写"，而是**官方那一档** `0` —— 判据见 `cacheHitText`：
 * 它在 `0` 位下的输出与官方 `formatCacheHitPercent(read, D)`（默认档）逐字一致，
 * 所以"关掉"= 把官方原样写回去，而不是留下一份没人收的三位小数。
 */
export const HIT_DIGITS = 3

/** 小数位数的搜索上限。命中率是安全整数之比，15 位足够覆盖到 2^53 个 token。 */
const MAX_DIGITS = 15

/** 非负整数计数（脏数据一律当 0，与官方对可选字段的处理一致）。 */
function countOf(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

/**
 * 计费输入总量：三个**互不重叠**的桶之和。
 *
 * 必须与官方 `billedInputTokens()` 同一口径 —— 只差一个桶，屏幕上两个百分比就会对不上
 * （官方那颗胶囊仍然显示它自己算的那份）。
 * @param usage - `tokenUsage` 投影值。
 * @returns 计费输入 token 数。
 */
export function billedInputTokens(usage: TokenUsageLike | null | undefined): number {
  if (usage === null || typeof usage !== 'object') return 0
  return countOf(usage.uncachedInputTokens)
    + countOf(usage.cacheReadTokens)
    + countOf(usage.cacheWriteTokens)
}

/**
 * 四舍五入到整单位的除法（`.5` 进位），全整数、无浮点误差。
 * @param numerator - 分子（缓存读 token）。
 * @param denominator - 分母（计费输入 token）。
 * @param scale - 放大倍数（`100 * 10^digits`，即"百分之一单位的多少分之一"）。
 * @returns `round(numerator / denominator * scale)`。
 */
function halfUpUnits(numerator: bigint, denominator: bigint, scale: bigint): bigint {
  return (numerator * scale * 2n + denominator) / (denominator * 2n)
}

/** 把"放大了 digits 位的百分数"还原成小数文本（`12346` + 3 → `12.346`）。 */
function formatUnits(units: bigint, digits: number): string {
  const text = units.toString().padStart(digits + 1, '0')
  // `digits = 0` 是"官方那一档"：官方此时直接给整数（`12`），不带小数点也不补 `.0`。
  if (digits === 0) return text
  return `${text.slice(0, text.length - digits)}.${text.slice(text.length - digits)}`
}

/**
 * 命中率文本：`digits` 位小数起步，且**绝不把部分命中凑成 100**。
 *
 * 官方那条规则的复现方式：从 `digits` 位开始试，只有当"放大后的整数"严格小于
 * `100 * 10^digits`（也就是没满）时才采用；否则加一位再试。因为分子严格小于分母，
 * 位数够多时一定能落到 100 以下（对安全整数而言 15 位足够），所以循环必然收敛。
 *
 * `digits = 0` 这一档与官方 `formatCacheHitPercent(read, D)` 的默认档**逐字一致**
 * （含"满命中给 `100`"和"会凑成 100 时自动加位"两条），`test/stats-line.mjs` 拿官方那段
 * 源码当基准逐例交叉验证过 —— 这既是"关掉开关能还原"的依据，也是"我们没有另起一套口径"的证据。
 * @param readTokens - 缓存的提示词 token 数。
 * @param totalTokens - 计费输入 token 数（`billedInputTokens`）。
 * @param digits - 起始小数位数。
 * @returns 形如 `12.346` / `99.9999` / `100.000` 的文本；没有计费输入时 null。
 */
export function cacheHitText(
  readTokens: number,
  totalTokens: number,
  digits: number = HIT_DIGITS,
): string | null {
  const read = countOf(readTokens)
  const total = countOf(totalTokens)
  if (total === 0) return null
  const places = Math.max(0, Math.floor(digits))
  const n = BigInt(read)
  const d = BigInt(total)
  // 真满命中：官方此时直接给 '100'（不带小数）；本插件统一成同一位数，免得同一行两种写法。
  if (n >= d) return formatUnits(BigInt(100) * BigInt(10) ** BigInt(places), places)
  for (let width = places; width <= MAX_DIGITS; width += 1) {
    const scale = BigInt(100) * BigInt(10) ** BigInt(width)
    const units = halfUpUnits(n, d, scale)
    if (units < scale) return formatUnits(units, width)
  }
  // 走不到：安全整数范围内位数够多时必然收敛。真到了这里，宁可不改（返回 null）
  // 也不给出一个可能撒谎的数字。
  return null
}

/**
 * 命中率文本：直接吃 `tokenUsage` 投影值。
 * @param usage - `tokenUsage` 投影值。
 * @param digits - 起始小数位数（默认三位）。
 * @returns 百分比数字文本（不含 `%`）；没有计费输入时 null。
 */
export function cacheHitDisplay(
  usage: TokenUsageLike | null | undefined,
  digits: number = HIT_DIGITS,
): string | null {
  return cacheHitText(countOf(usage?.cacheReadTokens), billedInputTokens(usage), digits)
}

/** 官方 `stats.cacheHit` 渲染出来的**整段**文本：`缓存命中 12%` / `Cache hit 12%`（两种语言）。 */
const CACHE_HIT_NODE = /^(?:缓存命中|Cache hit)\s+[\d.]+\s*%$/

/** 同一段文本出现在别处（最主要的是 pill 的 `aria-label`：`8.2K tok · 缓存命中 12%`）。 */
const CACHE_HIT_TAIL = /((?:缓存命中|Cache hit)\s+)[\d.]+\s*%/g

/**
 * 改写一个文本节点。
 *
 * **只认整段就是官方那一段**（首尾锚定 + 要求前缀后有空白）。两个真实约束决定了这一点：
 *  · 同一个会话里还有两处百分比：统计弹窗与每轮用量弹窗，它们的 `textContent` 拼起来是
 *    `缓存命中49.4%`（`<dt>` 与 `<dd>` 两个节点，中间没有空白），要求空白就天然放过了它们
 *    —— 用户 2026-09-28 拍板"只改输入框下面那一行"；
 *  · 放宽成"任何 `xx%`"会误改同一行的 token 数、速度等其它数字。
 * @param text - 原始文本节点内容。
 * @param display - 新的百分比数字文本（不含 `%`）。
 * @returns 改写后的文本；不是那一段（或本来就一样）时 null，调用方据此不做写入。
 */
export function rewriteCacheHitText(text: string, display: string): string | null {
  if (!CACHE_HIT_NODE.test(text)) return null
  const next = text.replace(/[\d.]+(?=\s*%$)/, display)
  return next === text ? null : next
}

/**
 * 改写一个 `aria-label`。
 *
 * 官方那颗胶囊的无障碍名字是 `` `${totalText} · ${cacheHitText}` ``，所以这里**不能**首尾锚定
 * —— 段落藏在中间。不同步它的后果很具体：**读屏用户听到的还是整数**，与屏幕上看到的三位
 * 小数对不上（社区插件 dsh-cache-precision 就没管这一处）。
 * @param label - 原始 `aria-label`。
 * @param display - 新的百分比数字文本（不含 `%`）。
 * @returns 改写后的名字；不含那一段（或本来就一样）时 null。
 */
export function rewriteCacheHitLabel(label: string, display: string): string | null {
  // 用 `replace` 而不是先 `test` 再 `replace`：带 `g` 的正则用 `test` 会推进 `lastIndex`，
  // 两处共享同一个常量就成了隐式状态（这正是"改了 A 处 B 处失效"那类难查的 bug）。
  // `String.prototype.replace` 自己从 0 开始扫、结束把 `lastIndex` 归零，没有这个副作用。
  const next = label.replace(CACHE_HIT_TAIL, `$1${display}%`)
  return next === label ? null : next
}

/**
 * 这一栏是否生效。
 *
 * 单独抽成函数是为了让"总闸 + 栏开关"这条合成只发生在 `activeSections` 一处
 * （组件里再写一遍 `settings.enabled && …` 是这套两层开关最容易漏的地方）。
 *
 * 0.7.0 撤掉「加宽」之后这一栏只剩一个开关，所以**不再另设子开关** —— 与「OpenCode 请求头」
 * 那一栏同一处理（那里的注释：「原来的『附加请求头』本来就是『这一栏要不要生效』，
 * 直接搬到了标题行」）。
 * @param settings - 当前设置快照。
 * @returns 是否把那一行改成三位小数。
 */
export function statsLineEnabled(settings: ComposerUxSettings): boolean {
  return activeSections(settings).stats
}
