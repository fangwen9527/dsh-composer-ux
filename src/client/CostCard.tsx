/**
 * 「金额」卡片的内容区（0.10.0）：按模型改单价 + 节假日表 + 价目同步 + 余额查询。
 *
 * ## 用户要的是什么（2026-09-28 一问一答定下来的，0.9.1 先做单价，0.10.0 补齐 A–E）
 *
 * 最初那句"调峰谷价格之类的"最后选定的范围是：**按模型的峰/谷单价**（内置模型常显 +
 * 自己添任意模型名）。0.10.0 他选了再补五件事：节假日、峰谷提醒、余额、官方价同步、
 * 非 DeepSeek 定价。于是这一张卡变成"金额"这一域的唯一入口，分四段：
 *
 *   1. **单价**：内置 DeepSeek 两个模型（峰谷两档）+ 用户自己加的行；
 *   2. **节假日**：北京日期表，命中即全天谷价（默认用内置那份）；
 *   3. **同步**：官方价 / 第三方价目两个独立按钮（代价差两个数量级，见 `price-sync.ts`）；
 *   4. **余额**：DeepSeek 官方余额（Key 只在宿主半读，浏览器拿不到）。
 *   5. **峰谷提醒**：进峰/离峰前多久提醒、要不要发系统通知。
 *
 * ## 三件容易做错的事（0.9.1 就在处理，别改坏）
 *
 * 1. **留空 = 沿用官方价**，而不是 0。所以输入框的 `value` 来自覆盖价、`placeholder`
 *    来自官方刊例价（`officialTripleOf`）；写成 `value={值 ?? 0}` 的话，用户一打开就会
 *    把所有模型的价格改成 0 —— 屏幕上还是个数字，看不出来。
 * 2. **非法文本不能当清空**（`parsePriceText` 三态）：`1,02` 和 `2元` 都留在框里标红，
 *    不写进设置。静默清空会让价格悄悄回到官方价，用户以为改成功了。
 * 3. **写设置要合并**：一列六个格子、连改几格不该发六次写请求，所以本地先落值、300ms
 *    合并写一次整表；同时用 `lastWritten` 分辨"设置里来的新值"与"自己刚写进去的回声"。
 *
 * ## 平坦价 vs 峰谷两档（0.10.0）
 *
 * DeepSeek 路由有峰谷两档（价差 2 倍），第三方路由**没有**这个概念 —— 给它们也摆两档
 * 会让人以为"谷价时段还能再省一半"。所以按模型名判断：`deepseek*` 走两档，
 * 其余走"平坦价"一档（写入时落在 `offPeak` 那一格，与 `pricing.ts` 的 resolvePrice 一致）。
 * 行名里带 `provider:model` 时按 provider 处理（同名模型在不同渠道价不同）。
 */
import React from 'react'
import {
  BUILTIN_PRICING_MODELS, CNY_PER_USD, DEFAULT_PEAK_HOLIDAYS, MODEL_ALIASES, PRICE_FIELDS,
  customPricingModels, isDayKey, isDeepSeekRoute, isKnownModel, officialTripleOf, overrideValueOf,
  parsePriceText, withOverrideValue, withoutPricingModel,
  type PriceField, type PriceOverrideTable,
} from '../pricing.ts'
import {
  BALANCE_ENABLED_FIELD, PEAK_ALERT_FIELD, PEAK_HOLIDAYS_FIELD, PRICE_OVERRIDES_FIELD,
  type ComposerUxSettings, type SettingsField,
} from '../settings-contract.ts'
import { useBalance, usePriceSync } from './money-admin.ts'
import { hintError, hintInfo, pill, row, rowDesc, rowText, rowTitle, textInput } from './styles.ts'

/** 三项单价的中文名（输入框上方的小标签）。 */
const FIELD_LABELS: Record<PriceField, string> = {
  miss: '未缓存输入',
  hit: '缓存命中',
  out: '输出',
}

/** 两次写设置的合并窗口：改一列六个格子只写一次。 */
const WRITE_DEBOUNCE_MS = 300

/** 一格的键（本地草稿与报错都按它索引）。 */
function cellKey(key: string, peak: boolean, field: PriceField): string {
  return `${key}|${peak ? 'peak' : 'offPeak'}|${field}`
}

/** 行键拆成 `(provider, model)`：`opencode:gpt-x` → `{provider:'opencode', model:'gpt-x'}`。 */
export function splitRowKey(key: string): { readonly provider: string; readonly model: string } {
  const at = key.indexOf(':')
  if (at <= 0) return { provider: '', model: key }
  return { provider: key.slice(0, at), model: key.slice(at + 1) }
}

/**
 * 覆盖价表的规范化文本（键排序 + 固定字段顺序）。
 *
 * 用来回答"设置里现在的值是不是我刚写进去的那个" —— 直接比对象不行（键序可能不同），
 * 而按内容规范化之后可以逐字比较。比错的后果是安全的那一侧：判成"不是我写的"就采纳它，
 * 内容本来就一样，等价于没动。
 */
function canonical(table: PriceOverrideTable | undefined): string {
  if (table === undefined) return ''
  return Object.keys(table).sort().map(model => {
    const entry = table[model] ?? {}
    const tiers = (['peak', 'offPeak'] as const).map(tierName => {
      const tier = entry[tierName]
      if (tier === undefined) return ''
      return `${tierName}(${PRICE_FIELDS.map(field => `${field}=${tier[field] ?? ''}`).join(',')})`
    }).join('')
    return `${model}{${tiers}}`
  }).join(';')
}

/** 内置模型的别名提示（`deepseek-flash` ← `deepseek-chat`）。 */
function aliasNote(model: string): string {
  const aliases = Object.keys(MODEL_ALIASES).filter(alias => MODEL_ALIASES[alias] === model)
  return aliases.length === 0 ? '' : ` · 别名 ${aliases.join(' / ')}`
}

/** 时间戳 → 本地时间文案。 */
function stampText(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? new Date(value).toLocaleString('zh-CN')
    : '从没同步过'
}

/** 卡片内容区。 */
export function CostCardBody(props: {
  readonly settings: ComposerUxSettings
  readonly setField: (field: SettingsField, value: unknown) => void
  readonly clearField: (field: SettingsField) => void
}): React.ReactElement {
  const { settings, setField, clearField } = props
  /** 本地编辑副本：界面立刻响应，写入合并到 {@link WRITE_DEBOUNCE_MS} 后一次。 */
  const [table, setTable] = React.useState<PriceOverrideTable | undefined>(settings.priceOverrides)
  /** 正在编辑、还没提交的格子（键 → 文本）；提交后交还给设置里的值。 */
  const [drafts, setDrafts] = React.useState<Record<string, string>>({})
  /** 非法格子的标记（红框 + 一句话）。 */
  const [invalid, setInvalid] = React.useState<Record<string, boolean>>({})
  /** 「添加模型」输入框的内容与提示。 */
  const [name, setName] = React.useState('')
  const [addNote, setAddNote] = React.useState('')
  /** 刚加进来、还没填任何数字的行（填了第一格就落进覆盖价表，不再需要它）。 */
  const [pending, setPending] = React.useState<readonly string[]>([])
  /** 节假日文本框（一行一个北京日期）。 */
  const [holidayText, setHolidayText] = React.useState(() => (settings.peakHolidays ?? DEFAULT_PEAK_HOLIDAYS).join('\n'))
  const [holidayNote, setHolidayNote] = React.useState('')
  /** 最近一次写进设置的那份表（用来识别回声）。 */
  const lastWritten = React.useRef<PriceOverrideTable | undefined>(settings.priceOverrides)
  /** `commitCell` 可能在同一帧里被连调（换格 + 失焦），所以改表一律基于这个 ref。 */
  const tableRef = React.useRef<PriceOverrideTable | undefined>(table)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  tableRef.current = table

  const sync = usePriceSync()
  const balance = useBalance(settings)
  /**
   * 同步来的额外价格档：占位价与"当前生效"的判定都要带上它，否则同步出新档之后，
   * 设置页里那些灰字占位会停在**旧档**（用户看到"官方价"以为没变，实际已经在按新档算了）。
   */
  const syncedEras = settings.syncedPrices?.eras

  // 外部的值要采纳（别的窗口改的、「恢复默认」清掉的）；自己刚写的回声不采纳。
  React.useEffect(() => {
    if (canonical(settings.priceOverrides) === canonical(lastWritten.current)) return
    lastWritten.current = settings.priceOverrides
    tableRef.current = settings.priceOverrides
    setTable(settings.priceOverrides)
  }, [settings.priceOverrides])

  // 节假日表被别处清掉时，文本框跟着回到"内置那份"。
  //
  // ⚠️ 依赖必须是**内容字符串**而不是数组引用：设置一被写入，`settings.peakHolidays` 就是一个
  // 新数组，按引用做依赖会让这个 effect 在**任何**设置写入后都跑一遍 —— 用户在文本框里敲了
  // 半天还没点保存，随手勾一下"余额开关"就把他的输入清掉了。
  const savedHolidayText = (settings.peakHolidays ?? DEFAULT_PEAK_HOLIDAYS).join('\n')
  React.useEffect(() => {
    setHolidayText(savedHolidayText)
  }, [savedHolidayText])

  React.useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current) }, [])

  /** 提交整表：下一帧界面就是新值，写设置合并成一次。 */
  const commit = (next: PriceOverrideTable | undefined): void => {
    tableRef.current = next
    lastWritten.current = next
    setTable(next)
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      if (next === undefined) clearField(PRICE_OVERRIDES_FIELD)
      else setField(PRICE_OVERRIDES_FIELD, next)
    }, WRITE_DEBOUNCE_MS)
  }

  const valueOf = (key: string, peak: boolean, field: PriceField): string => {
    const draft = drafts[cellKey(key, peak, field)]
    if (draft !== undefined) return draft
    const { provider, model } = splitRowKey(key)
    const flat = !isDeepSeekRoute(provider, model)
    // 平坦价行读的是**计价端实际用的那一档**（`offPeak ?? peak`，见 pricing.ts）：只读 offPeak 的话，
    // 0.9.1 留下的 `{ peak: {…} }` 会"金额按它算、界面显示空框"——两个文件对同一份设置给出不同答案。
    const value = overrideValueOf(table, model, peak, field, provider)
      ?? (flat ? overrideValueOf(table, model, true, field, provider) : undefined)
    return value === undefined ? '' : String(value)
  }

  const commitCell = (key: string, peak: boolean, field: PriceField, text: string): void => {
    const cell = cellKey(key, peak, field)
    const parsed = parsePriceText(text)
    if (parsed.kind === 'invalid') {
      // 保留用户写的内容并标红：静默清空等于"价格悄悄回到官方价"，那是更坏的体验。
      setDrafts(current => ({ ...current, [cell]: text }))
      setInvalid(current => ({ ...current, [cell]: true }))
      return
    }
    setDrafts(current => {
      const next = { ...current }
      delete next[cell]
      return next
    })
    setInvalid(current => {
      const next = { ...current }
      delete next[cell]
      return next
    })
    const { provider, model } = splitRowKey(key)
    const flat = !isDeepSeekRoute(provider, model)
    let next = withOverrideValue(
      tableRef.current, model, peak, field,
      parsed.kind === 'empty' ? undefined : parsed.value,
      provider === '' ? undefined : provider,
    )
    // 平坦价（第三方模型）行：0.9.1 的界面给**所有**模型都摆过两档，所以老设置里可能留着
    // `{ peak: {…} }` 这种键。计价端认它（见 `pricing.ts` 的 `override?.offPeak ?? override?.peak`），
    // 但平坦价行只读写 `offPeak` —— 于是会出现"金额按它算、设置页却是空框"，
    // 而且把框清空也删不掉那条 peak（只有点「删除」整行才行）。
    // 这里：清空一格时顺手把 peak 档也清掉（对平坦价模型来说那一档本来就不该存在）。
    if (flat && parsed.kind === 'empty') {
      for (const stale of PRICE_FIELDS) {
        next = withOverrideValue(next, model, true, stale, undefined, provider === '' ? undefined : provider)
      }
    }
    commit(next)
    setPending(current => current.filter(item => item !== key))
  }

  const addModel = (): void => {
    const trimmed = name.trim().toLowerCase()
    setName('')
    if (trimmed === '') { setAddNote('先写一个模型名'); return }
    if (isKnownModel(trimmed)) {
      // 内置模型与它的别名已经有行（别名同一份价），不必再造一行 —— 造了也只会在重载后消失。
      setAddNote(`「${trimmed}」已在下面的内置价表里（别名算同一个模型），直接改那一行即可`)
      return
    }
    if (customPricingModels(table).includes(trimmed) || pending.includes(trimmed)) {
      setAddNote(`「${trimmed}」已经有一行了`)
      return
    }
    setAddNote('')
    setPending(current => [...current, trimmed])
  }

  const removeModel = (key: string): void => {
    setPending(current => current.filter(item => item !== key))
    setDrafts(current => {
      const next: Record<string, string> = {}
      for (const cell of Object.keys(current)) {
        if (!cell.startsWith(`${key}|`)) next[cell] = current[cell]!
      }
      return next
    })
    const { provider, model } = splitRowKey(key)
    commit(withoutPricingModel(tableRef.current, model, provider === '' ? undefined : provider))
  }

  const rows = [
    ...BUILTIN_PRICING_MODELS,
    ...customPricingModels(table).filter(model => !BUILTIN_PRICING_MODELS.includes(model)),
    ...pending,
  ]
  const anyOverride = rows.some(key => PRICE_FIELDS.some(field =>
    overrideValueOf(table, splitRowKey(key).model, true, field, splitRowKey(key).provider) !== undefined
    || overrideValueOf(table, splitRowKey(key).model, false, field, splitRowKey(key).provider) !== undefined))

  /** 保存节假日：只收 `YYYY-MM-DD`，其它行逐条点名报错（不静默丢）。 */
  const saveHolidays = (): void => {
    const lines = holidayText.split(/[\s,;]+/).map(item => item.trim()).filter(item => item.length > 0)
    const bad = lines.filter(item => !isDayKey(item))
    if (bad.length > 0) {
      setHolidayNote(`这些不是合法日期（要 YYYY-MM-DD，例如 2026-10-01）：${bad.slice(0, 4).join('、')}`)
      return
    }
    if (lines.length === 0) {
      clearField(PEAK_HOLIDAYS_FIELD)
      setHolidayNote('已清空 = 用内置那份节假日表')
      return
    }
    const dates = [...new Set(lines)].sort()
    setField(PEAK_HOLIDAYS_FIELD, dates)
    setHolidayNote(`已保存 ${dates.length} 个日期（命中的一天全天按谷价）`)
  }

  const synced = settings.syncedPrices
  const alert = settings.peakAlert

  return (
    <div>
      <p style={hintInfo}>
        这里改的<strong>只是本插件显示的费用估算</strong>：不动 DSH 的计费，也不改模型请求。
        <strong>留空＝沿用官方价</strong>（输入框里的灰字就是官方价），填了才算覆盖。
        单位是<strong>元 / 1M tokens</strong>；DeepSeek 高峰价是空闲价的 2 倍。
      </p>
      <p style={hintInfo}>
        峰谷按<strong>每笔用量真正发生的时间</strong>判定（官方规则：北京时间工作日
        09:00–12:00、14:00–18:00 为高峰，<strong>不含法定节假日</strong>；周末与节假日全天谷价），
        而且按<strong>当时生效的价格档</strong>结算 —— 官方 2026-09-10 调过一次 Flash 的价，
        所以 8 月跑的会话永远按 8 月的价算，不会因为你今天同步了新价而变。
      </p>

      {rows.map(key => {
        const builtin = BUILTIN_PRICING_MODELS.includes(key)
        const { provider, model } = splitRowKey(key)
        const twoTier = isDeepSeekRoute(provider, model)
        return (
          <div key={key} style={{ ...row, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={rowText}>
              <div style={rowTitle}>{key}{builtin ? aliasNote(model) : ''}</div>
              <div style={rowDesc}>
                {twoTier
                  ? (builtin ? 'DeepSeek 刊例价（峰谷两档）' : 'DeepSeek 系模型（峰谷两档）')
                  : '平坦价（第三方模型没有峰谷两档；不填就按同步来的价目算，认不出会写"未定价"）'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {(twoTier ? [true, false] : [false]).map(peak => {
                const official = officialTripleOf(model, peak, syncedEras === undefined ? {} : { eras: syncedEras })
                return (
                  <div key={peak ? 'peak' : 'offPeak'} style={{ display: 'grid', gap: 2 }}>
                    <span style={{ color: 'var(--dsw-alias-label-tertiary)' }}>
                      {twoTier ? (peak ? '高峰' : '空闲') : '平坦价'}（元 / 1M）
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {PRICE_FIELDS.map(field => (
                        <label key={field} style={{ display: 'grid', gap: 2 }}>
                          <span style={{ color: 'var(--dsw-alias-label-tertiary)', fontSize: 11 }}>
                            {FIELD_LABELS[field]}
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            aria-label={`${key} ${twoTier ? (peak ? '高峰' : '空闲') : '平坦'} ${FIELD_LABELS[field]}单价`}
                            placeholder={twoTier ? String(official[field]) : ''}
                            value={valueOf(key, peak, field)}
                            onChange={event => {
                              const text = event.target.value
                              setDrafts(current => ({ ...current, [cellKey(key, peak, field)]: text }))
                              setInvalid(current => {
                                const next = { ...current }
                                delete next[cellKey(key, peak, field)]
                                return next
                              })
                            }}
                            onBlur={event => { commitCell(key, peak, field, event.target.value) }}
                            onKeyDown={event => { if (event.key === 'Enter') commitCell(key, peak, field, event.currentTarget.value) }}
                            style={{
                              ...textInput,
                              width: 92,
                              flex: 'none',
                              ...(invalid[cellKey(key, peak, field)] === true
                                ? { borderColor: 'var(--dsw-alias-state-error-primary)' }
                                : {}),
                            }}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            <button
              type="button"
              style={pill}
              title={builtin ? '把这一行改回官方刊例价' : '删掉这一行'}
              onClick={() => { removeModel(key) }}
            >{builtin ? '恢复官方价' : '删除'}</button>
          </div>
        )
      })}

      <div style={{ ...row, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={rowText}>
          <div style={rowTitle}>再加一个模型</div>
          <div style={rowDesc}>
            中转 / 自建路由的模型名都行（例如 my-relay-v1）；同名模型在不同渠道价不同时，
            写成 <code>provider:model</code>（例如 opencode:gpt-5.6-luna）。
          </div>
        </div>
        <input
          type="text"
          style={{ ...textInput, width: 220, flex: 'none' }}
          placeholder="模型名（与 DSH 里显示的完全一致）"
          value={name}
          aria-label="要新增的模型名"
          onChange={event => { setName(event.target.value); setAddNote('') }}
          onKeyDown={event => { if (event.key === 'Enter') addModel() }}
        />
        <button type="button" style={pill} onClick={addModel}>添加</button>
      </div>
      {addNote !== '' && <p style={hintError}>{addNote}</p>}

      {/* ── 节假日（0.10.0）────────────────────────────────────────────── */}
      <div style={{ ...row, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 6 }}>
        <div style={rowText}>
          <div style={rowTitle}>法定节假日（北京日期，一行一个）</div>
          <div style={rowDesc}>
            命中的一天<strong>全天按谷价</strong>。官方规则把中国法定节假日排除在高峰之外，
            不算的话国庆那种日子会把工作日的高峰两段当峰价——<strong>整整 2 倍</strong>。
            留空就用内置那份（2026 中秋 09-25～27、国庆 10-01～07）。
            <br />
            注：调休上班的周末<strong>仍然按谷价</strong>（官方说的是"周末全天谷价"）。
          </div>
        </div>
        <textarea
          style={{ ...textInput, width: 260, height: 96, flex: 'none', fontFamily: 'monospace' }}
          aria-label="法定节假日日期表"
          value={holidayText}
          onChange={event => setHolidayText(event.target.value)}
          spellCheck={false}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button type="button" style={pill} onClick={saveHolidays}>保存</button>
          <button
            type="button"
            style={pill}
            onClick={() => { clearField(PEAK_HOLIDAYS_FIELD); setHolidayNote('已恢复为内置那份节假日表') }}
          >恢复内置</button>
        </div>
      </div>
      {holidayNote !== '' && <p style={hintInfo}>{holidayNote}</p>}
      <p style={hintInfo}>
        当前生效：{(settings.peakHolidays ?? DEFAULT_PEAK_HOLIDAYS).length} 个日期
        {settings.peakHolidays === undefined ? '（内置）' : '（自定义）'}
      </p>

      {/* ── 峰谷提醒（0.10.0）──────────────────────────────────────────── */}
      <div style={{ ...row, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 6 }}>
        <div style={rowText}>
          <div style={rowTitle}>峰谷提醒</div>
          <div style={rowDesc}>
            明细页会常显"现在哪一档、还有多久切换"。勾上系统通知后，切换前会额外弹一条
            浏览器通知（需要授权）——不急的活可以等到谷价再跑。
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={alert.enabled}
              aria-label="启用峰谷提醒"
              onChange={event => setField(PEAK_ALERT_FIELD, { ...alert, enabled: event.target.checked })}
            />
            <span>启用</span>
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span>提前</span>
            <input
              type="text"
              inputMode="numeric"
              style={{ ...textInput, width: 56, flex: 'none' }}
              aria-label="提前多少分钟提醒"
              value={String(alert.aheadMinutes)}
              onChange={event => {
                const value = Number(event.target.value.trim())
                if (!Number.isFinite(value)) return
                setField(PEAK_ALERT_FIELD, { ...alert, aheadMinutes: Math.min(60, Math.max(1, Math.round(value))) })
              }}
            />
            <span>分钟</span>
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={alert.onPeak}
              aria-label="进入高峰前提醒"
              onChange={event => setField(PEAK_ALERT_FIELD, { ...alert, onPeak: event.target.checked })}
            />
            <span>进峰前</span>
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={alert.onOffPeak}
              aria-label="离开高峰前提醒"
              onChange={event => setField(PEAK_ALERT_FIELD, { ...alert, onOffPeak: event.target.checked })}
            />
            <span>离峰前</span>
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={alert.webNotify}
              aria-label="额外发浏览器通知"
              onChange={event => {
                const wanted = event.target.checked
                if (wanted && typeof Notification !== 'undefined' && Notification.permission === 'default') {
                  void Notification.requestPermission()
                }
                setField(PEAK_ALERT_FIELD, { ...alert, webNotify: wanted })
              }}
            />
            <span>系统通知</span>
          </label>
        </div>
      </div>

      {/* ── 余额（0.10.0）──────────────────────────────────────────────── */}
      <div style={{ ...row, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 6 }}>
        <div style={rowText}>
          <div style={rowTitle}>账号余额</div>
          <div role="note" style={rowDesc}>
            查 DeepSeek 官方余额接口（<code>GET /user/balance</code>）。
            <strong>API Key 只在宿主半读取</strong>，浏览器拿不到；宿主只放行
            <code>api.deepseek.com</code>，你的 baseURL 被指向第三方时不会把 Key 发出去。
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={settings.balanceEnabled}
              aria-label="启用余额查询"
              onChange={event => setField(BALANCE_ENABLED_FIELD, event.target.checked)}
            />
            <span>启用</span>
          </label>
          <button type="button" style={pill} onClick={balance.refresh} disabled={!settings.balanceEnabled}>刷新</button>
          <span style={{ color: 'var(--dsw-alias-label-secondary)' }}>
            {balance.status === 'off'
              ? '已关闭（不会发出任何请求）'
              : balance.status === 'loading'
                ? '查询中…'
                : balance.status === 'error'
                  ? `查询失败：${balance.message ?? ''}`
                  : balance.status === 'ok'
                    ? (balance.entries ?? []).length === 0
                      ? '接口没有返回余额条目'
                      : (balance.entries ?? []).map(entry =>
                          `${entry.currency ?? '?'} ${entry.total ?? 0}（赠送 ${entry.granted ?? 0} + 充值 ${entry.toppedUp ?? 0}）`).join(' · ')
                    : '还没查过'}
          </span>
        </div>
      </div>

      {/* ── 价目同步（0.10.0）──────────────────────────────────────────── */}
      <div style={{ ...row, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 6 }}>
        <div style={rowText}>
          <div style={rowTitle}>同步价目</div>
          <div style={rowDesc}>
            「官方价」抓官方价格页两页（约 24 KB）：<strong>有变化才新增一个价格档</strong>，
            历史用量仍按发生时刻的旧档结算。「第三方价目」抓 models.dev（约 5 MB，
            压缩后约 450 KB 落盘），给非 DeepSeek 模型用。<strong>抓失败不会覆盖本地价。</strong>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button type="button" style={pill} disabled={sync.busy !== null} onClick={() => sync.sync('official')}>
            {sync.busy === 'official' ? '同步中…' : '同步官方价'}
          </button>
          <button type="button" style={pill} disabled={sync.busy !== null} onClick={() => sync.sync('modelsDev')}>
            {sync.busy === 'modelsDev' ? '同步中…' : '同步第三方价目'}
          </button>
        </div>
        <div style={{ ...rowDesc, flexBasis: '100%' }}>
          官方价上次同步：{stampText(synced?.fetchedAt)}；
          第三方价目上次同步：{stampText(synced?.modelsDevAt)}
          {typeof synced?.modelsDevCount === 'number' ? `（${synced.modelsDevCount} 个模型）` : ''}
          {typeof synced?.eras?.length === 'number' && synced.eras.length > 0 ? `；已累积 ${synced.eras.length} 个同步来的价格档` : ''}
        </div>
      </div>
      {sync.note !== '' && (
        <p style={sync.ok ? hintInfo : hintError}>{sync.note}</p>
      )}

      {anyOverride
        ? (
            <p style={hintInfo}>
              当前有覆盖价生效。想全部回到官方价：把格子清空即可（清空的格子、整行都空的模型会自动从设置里消失）。
            </p>
          )
        : null}
      <p style={hintInfo}>
        美元口径的说明：官方中英文页各自公布一套价，<strong>不是</strong>用汇率换算的
        （Flash 两页之比约 6.667、Pro 约 6.82）。本插件按官方原值分别存两列；
        只有在你<strong>只填人民币覆盖价</strong>时，美元列才按 1 USD = {CNY_PER_USD} 元折算。
      </p>
    </div>
  )
}
