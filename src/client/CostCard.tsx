/**
 * 「金额」卡片的内容区（0.9.1）：按模型改**高峰 / 空闲两档**的单价。
 *
 * ## 用户要的是什么（2026-09-28 一问一答定下来的）
 *
 * 他要"调峰谷价格之类的"，最后选定的范围是：**按模型的峰/谷单价**，内置三个模型常显，
 * 另外能自己添任意模型名（中转 / 自建路由那些名字不在刊例表里，不覆盖就只能按
 * `deepseek-flash` 估价）。不做整体系数、不改币种、不动时段规则、不加这一栏的总开关
 * —— 没选的那些一项都不加，免得界面上出现"没人要的旋钮"。
 *
 * ## 三件容易做错的事（都在这里处理）
 *
 * 1. **留空 = 沿用官方价**，而不是 0。所以输入框的 `value` 来自覆盖价、`placeholder`
 *    来自官方刊例价（`officialTripleOf`）；写成 `value={值 ?? 0}` 的话，用户一打开就会
 *    把所有模型的价格改成 0 —— 屏幕上还是个数字，看不出来。
 * 2. **非法文本不能当清空**（`parsePriceText` 三态）：`1,02` 和 `2元` 都留在框里标红，
 *    不写进设置。静默清空会让价格悄悄回到官方价，用户以为改成功了。
 * 3. **写设置要合并**：一列六个格子、连改几格不该发六次写请求，所以本地先落值、300ms
 *    合并写一次整表；同时用 `lastWritten` 分辨"设置里来的新值"与"自己刚写进去的回声"，
 *    否则回声会把还没写完的第二格编辑冲掉。
 *
 * 组件本身很薄：所有判断（怎么改一格、空壳怎么收、什么算合法数字）都在 `pricing.ts`
 * 那几个纯函数里，由 `test/pricing.mjs` 逐个钉住。
 */
import React from 'react'
import {
  BUILTIN_PRICING_MODELS, MODEL_ALIASES, PRICE_FIELDS, customPricingModels,
  isKnownModel, officialTripleOf, overrideValueOf, parsePriceText, withOverrideValue,
  withoutPricingModel,
  type PriceField, type PriceOverrideTable,
} from '../pricing.ts'
import { PRICE_OVERRIDES_FIELD, type ComposerUxSettings, type SettingsField } from '../settings-contract.ts'
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
function cellKey(model: string, peak: boolean, field: PriceField): string {
  return `${model}|${peak ? 'peak' : 'offPeak'}|${field}`
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
  /** 最近一次写进设置的那份表（用来识别回声）。 */
  const lastWritten = React.useRef<PriceOverrideTable | undefined>(settings.priceOverrides)
  /** `commitCell` 可能在同一帧里被连调（换格 + 失焦），所以改表一律基于这个 ref。 */
  const tableRef = React.useRef<PriceOverrideTable | undefined>(table)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  tableRef.current = table

  // 外部的值要采纳（别的窗口改的、「恢复默认」清掉的）；自己刚写的回声不采纳。
  React.useEffect(() => {
    if (canonical(settings.priceOverrides) === canonical(lastWritten.current)) return
    lastWritten.current = settings.priceOverrides
    tableRef.current = settings.priceOverrides
    setTable(settings.priceOverrides)
  }, [settings.priceOverrides])

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

  const valueOf = (model: string, peak: boolean, field: PriceField): string => {
    const draft = drafts[cellKey(model, peak, field)]
    if (draft !== undefined) return draft
    const value = overrideValueOf(table, model, peak, field)
    return value === undefined ? '' : String(value)
  }

  const commitCell = (model: string, peak: boolean, field: PriceField, text: string): void => {
    const key = cellKey(model, peak, field)
    const parsed = parsePriceText(text)
    if (parsed.kind === 'invalid') {
      // 保留用户写的内容并标红：静默清空等于"价格悄悄回到官方价"，那是更坏的体验。
      setDrafts(current => ({ ...current, [key]: text }))
      setInvalid(current => ({ ...current, [key]: true }))
      return
    }
    setDrafts(current => {
      const next = { ...current }
      delete next[key]
      return next
    })
    setInvalid(current => {
      const next = { ...current }
      delete next[key]
      return next
    })
    commit(withOverrideValue(
      tableRef.current, model, peak, field,
      parsed.kind === 'empty' ? undefined : parsed.value,
    ))
    setPending(current => current.filter(item => item !== model))
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

  const removeModel = (model: string): void => {
    setPending(current => current.filter(item => item !== model))
    setDrafts(current => {
      const next: Record<string, string> = {}
      for (const key of Object.keys(current)) {
        if (!key.startsWith(`${model}|`)) next[key] = current[key]!
      }
      return next
    })
    commit(withoutPricingModel(tableRef.current, model))
  }

  const rows = [
    ...BUILTIN_PRICING_MODELS,
    ...customPricingModels(table).filter(model => !BUILTIN_PRICING_MODELS.includes(model)),
    ...pending,
  ]
  const anyOverride = rows.some(model => overrideValueOf(table, model, true, 'miss') !== undefined
    || overrideValueOf(table, model, true, 'hit') !== undefined
    || overrideValueOf(table, model, true, 'out') !== undefined
    || overrideValueOf(table, model, false, 'miss') !== undefined
    || overrideValueOf(table, model, false, 'hit') !== undefined
    || overrideValueOf(table, model, false, 'out') !== undefined)

  return (
    <div>
      <p style={hintInfo}>
        这里改的<strong>只是本插件显示的费用估算</strong>：不动 DSH 的计费，也不改模型请求。
        <strong>留空＝沿用官方刊例价</strong>（输入框里的灰字就是官方价），填了才算覆盖。
        单位是<strong>元 / 1M tokens</strong>；高峰价通常是空闲价的 2 倍。
      </p>
      <p style={hintInfo}>
        峰谷按<strong>每笔用量真正发生的时间</strong>判定（官方规则：UTC 周一至周五 01–04、
        06–10，即北京时间工作日的 09:00–12:00 与 14:00–18:00），所以昨晚跑的会话不会因为
        你现在是白天就按高峰价算。改了价，输入框下面那颗金额胶囊与它的明细页立刻跟着变，
        不需要刷新页面。
      </p>

      {rows.map(model => {
        const builtin = BUILTIN_PRICING_MODELS.includes(model)
        return (
          <div key={model} style={{ ...row, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={rowText}>
              <div style={rowTitle}>{model}{aliasNote(model)}</div>
              <div style={rowDesc}>
                {builtin ? '内置刊例价' : '自定义模型（不在官方价表里，不填就按 deepseek-flash 估）'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {[true, false].map(peak => {
                const official = officialTripleOf(model, peak)
                return (
                  <div key={peak ? 'peak' : 'offPeak'} style={{ display: 'grid', gap: 2 }}>
                    <span style={{ color: 'var(--dsw-alias-label-tertiary)' }}>
                      {peak ? '高峰' : '空闲'}（元 / 1M）
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
                            aria-label={`${model} ${peak ? '高峰' : '空闲'} ${FIELD_LABELS[field]}单价`}
                            placeholder={String(official[field])}
                            value={valueOf(model, peak, field)}
                            onChange={event => {
                              const text = event.target.value
                              setDrafts(current => ({ ...current, [cellKey(model, peak, field)]: text }))
                              setInvalid(current => {
                                const next = { ...current }
                                delete next[cellKey(model, peak, field)]
                                return next
                              })
                            }}
                            onBlur={event => { commitCell(model, peak, field, event.target.value) }}
                            onKeyDown={event => { if (event.key === 'Enter') commitCell(model, peak, field, event.currentTarget.value) }}
                            style={{
                              ...textInput,
                              width: 92,
                              flex: 'none',
                              ...(invalid[cellKey(model, peak, field)] === true
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
              title={builtin ? '把这一行改回官方刊例价' : '删掉这一行（回到按 deepseek-flash 估）'}
              onClick={() => { removeModel(model) }}
            >{builtin ? '恢复官方价' : '删除'}</button>
          </div>
        )
      })}

      <div style={{ ...row, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={rowText}>
          <div style={rowTitle}>再加一个模型</div>
          <div style={rowDesc}>
            中转 / 自建路由的模型名都行（例如 my-relay-v1）；名字一次定好，要改就删了重加。
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
      {anyOverride
        ? (
            <p style={hintInfo}>
              当前有覆盖价生效。想全部回到官方价：把格子清空即可（清空的格子、整行都空的模型会自动从设置里消失）。
            </p>
          )
        : null}
    </div>
  )
}
