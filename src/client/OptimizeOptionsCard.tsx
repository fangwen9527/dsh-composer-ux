/**
 * 「优化选项」卡片（0.14.0）：把 dsh-prompt-optimizer 那张卡片搬进「快捷指令」面板的优化那半。
 *
 * 与上游的对应关系（都在下面每行的 tooltip 里写清）：
 *   档位（关闭/轻度/标准/重度）—— 在**面板标题行**（用户 2026-09-30 选的：一眼能看到强度再点 ✨），
 *   所以这张卡片从「协作基调」开始。
 *   协作基调 普通/硬邦邦 · 权限 审查/自动 · 模型 跟随/指定 · 上下文 回合 0–10/全文 ·
 *   只读工具 开/关 · 内置 Bash 开/关 · 详情（改提示词 / 恢复内置）。
 *
 * 三处与上游**刻意不同**（都写在对应行的说明里，免得用户以为漏了）：
 *   ① 权限不是"发送前要不要给你看"（我们不改发送路径）—— 审查 = 成品进结果框等你点插入；
 *      自动 = 跑完自动写回输入框（不自动发送）；
 *   ② 模型是"跟随会话 / 指定"，指定的写法是 `provider/model`（只写模型名则沿用会话 provider）；
 *   ③ 详情只改「任务与风格」那段，输出契约由插件追加、改不掉（改了整套逐字校验就失效）。
 */
import React, { useEffect, useState } from 'react'
import {
  OPTIMIZER_FRAMINGS, OPTIMIZER_PERMISSIONS, OPTIMIZER_TURNS_MAX, OPTIMIZER_TURNS_MIN,
  type ComposerUxSettings, type OptimizerFraming, type OptimizerHistory, type OptimizerPermission,
} from '../settings-contract.ts'
import { fetchModelCatalog, type ModelCatalogResult } from './model-catalog.ts'
import {
  optCard, optCardTitle, optHint, optInput, optLabel, optNumber, optPickerButton, optPickerGroup,
  optPickerItem, optPickerItemActive, optPickerModelId, optPickerPanel, optPromptBox, optRow,
  optSegButton, optSegButtonActive, optSegmented, optSlider,
} from './styles.ts'

/** 卡片要的动作（都是设置写入；字段名由调用方决定，这里只给语义）。 */
export interface OptimizeOptionsActions {
  readonly setFraming: (value: OptimizerFraming) => void
  readonly setPermission: (value: OptimizerPermission) => void
  readonly setModel: (value: string) => void
  readonly setHistory: (value: OptimizerHistory) => void
  readonly setTurns: (value: number) => void
  readonly setReadTools: (on: boolean) => void
  readonly setBash: (on: boolean) => void
  /** 当前档位的自定义提示词；空串 = 恢复内置。 */
  readonly setPrompt: (value: string) => void
}

export interface OptimizeOptionsCardProps {
  readonly settings: ComposerUxSettings
  readonly actions: OptimizeOptionsActions
}

/** 一行两选一（或几选一）的分段控件。 */
function Segmented<T extends string>(props: {
  readonly label: string
  readonly hint: string
  readonly value: T
  readonly options: readonly { readonly id: T; readonly label: string; readonly hint?: string }[]
  readonly onPick: (value: T) => void
}): React.ReactElement {
  return (
    <div style={optRow}>
      <span style={optLabel} title={props.hint}>{props.label}</span>
      <div style={optSegmented} role="group" aria-label={props.label}>
        {props.options.map(item => (
          <button
            key={item.id}
            type="button"
            aria-pressed={props.value === item.id}
            title={item.hint ?? ''}
            style={props.value === item.id ? optSegButtonActive : optSegButton}
            onMouseDown={event => { event.preventDefault() }}
            onClick={() => { props.onPick(item.id) }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** 一行开关（关/开）。 */
function Toggle(props: {
  readonly label: string
  readonly hint: string
  readonly on: boolean
  readonly onToggle: (next: boolean) => void
}): React.ReactElement {
  return (
    <Segmented<string>
      label={props.label}
      hint={props.hint}
      value={props.on ? 'on' : 'off'}
      options={[{ id: 'off', label: '关', hint: props.hint }, { id: 'on', label: '开', hint: props.hint }]}
      onPick={value => { props.onToggle(value === 'on') }}
    />
  )
}

/** 当前档位的自定义提示词。 */
function currentPrompt(settings: ComposerUxSettings): string {
  if (settings.optimizerTier === 'light') return settings.optimizerPromptLight
  if (settings.optimizerTier === 'heavy') return settings.optimizerPromptHeavy
  return settings.optimizerPromptStandard
}

/** 优化选项卡片。 */
export function OptimizeOptionsCard({ settings, actions }: OptimizeOptionsCardProps): React.ReactElement {
  const [detailOpen, setDetailOpen] = useState(false)
  const [modelText, setModelText] = useState(settings.optimizerModel)
  // 模型下拉（0.14.1）：打开时才去问宿主要清单（省一次请求），清单本身宿主会缓存 60 秒。
  const [pickerOpen, setPickerOpen] = useState(false)
  const [catalog, setCatalog] = useState<ModelCatalogResult | { kind: 'loading' } | null>(null)
  const [manual, setManual] = useState(false)
  const [retrySeq, setRetrySeq] = useState(0)

  useEffect(() => {
    if (!pickerOpen) return
    let alive = true
    setCatalog({ kind: 'loading' })
    const controller = new AbortController()
    void fetchModelCatalog({ fresh: retrySeq > 0, signal: controller.signal }).then(result => {
      if (alive) setCatalog(result)
    })
    return () => { alive = false; controller.abort() }
  }, [pickerOpen, retrySeq])
  const prompt = currentPrompt(settings)
  const tierOff = settings.optimizerTier === 'off'

  return (
    <div style={optCard} role="group" aria-label="优化选项">
      <span style={optCardTitle} title="这些开关都属于「优化提示词」这一轮；档位在面板标题行">优化选项</span>

      <Segmented<OptimizerPermission>
        label="权限"
        hint="审查 = 成品进结果框，你看过再点「插入输入框」；自动 = 跑完自动写回输入框（都不会自动发送消息）"
        value={settings.optimizerPermission}
        options={OPTIMIZER_PERMISSIONS.map(item => ({ id: item.id, label: item.label, hint: item.hint }))}
        onPick={actions.setPermission}
      />

      <Segmented<OptimizerFraming>
        label="协作基调"
        hint="硬邦邦 = 整份辅助包改用口语直给的写法（只改写法：条目集合与逐字依据规则不变）"
        value={settings.optimizerFraming}
        options={OPTIMIZER_FRAMINGS.map(item => ({ id: item.id, label: item.label, hint: item.hint }))}
        onPick={actions.setFraming}
      />

      <div style={optRow}>
        <span style={optLabel} title="解释层用哪个模型：跟随会话当前选的，或从清单里指定一条">模型</span>
        <button
          type="button"
          aria-label="模型"
          aria-expanded={pickerOpen}
          title="点开选模型：第一项是跟随会话；下面按 provider 分组列出可用模型（清单长了可以滚）"
          style={optPickerButton}
          onMouseDown={event => { event.preventDefault() }}
          onClick={() => { setPickerOpen(!pickerOpen) }}
        >
          {settings.optimizerModel === '' ? '跟随会话模型' : settings.optimizerModel} ▾
        </button>
      </div>
      {pickerOpen && (
        <div style={optPickerPanel} role="listbox" aria-label="模型清单">
          <button
            type="button"
            style={settings.optimizerModel === '' ? optPickerItemActive : optPickerItem}
            onMouseDown={event => { event.preventDefault() }}
            onClick={() => { setModelText(''); actions.setModel(''); setManual(false); setPickerOpen(false) }}
          >
            跟随会话模型
            {catalog !== null && catalog.kind === 'ok' && catalog.current.model !== '' && (
              <span style={optPickerModelId}>当前：{catalog.current.model}</span>
            )}
          </button>
          {catalog === null || catalog.kind === 'loading' ? (
            <span style={optHint}>正在读模型清单…</span>
          ) : catalog.kind === 'error' ? (
            <>
              <span style={optHint}>读不到模型清单：{catalog.error}</span>
              <button
                type="button"
                style={optPickerItem}
                onMouseDown={event => { event.preventDefault() }}
                onClick={() => { setRetrySeq(retrySeq + 1) }}
              >
                重试
              </button>
            </>
          ) : (
            <>
              {catalog.groups.length === 0 && <span style={optHint}>宿主没报出任何 provider（在设置里看过模型路由吗？）</span>}
              {catalog.groups.map(group => (
                <React.Fragment key={group.id}>
                  <span style={optPickerGroup}>{group.name}</span>
                  {group.models.length === 0 && (
                    <span style={optHint}>{group.error === undefined ? "这一组没有模型" : `这一组读不到：${group.error}`}</span>
                  )}
                  {group.models.map(model => {
                    const value = `${group.id}/${model.id}`
                    return (
                      <button
                        key={value}
                        type="button"
                        style={settings.optimizerModel === value ? optPickerItemActive : optPickerItem}
                        onMouseDown={event => { event.preventDefault() }}
                        onClick={() => { actions.setModel(value); setModelText(value); setPickerOpen(false) }}
                      >
                        {model.name}
                        {model.name === model.id ? null : <span style={optPickerModelId}>{model.id}</span>}
                      </button>
                    )
                  })}
                </React.Fragment>
              ))}
            </>
          )}
          <button
            type="button"
            style={optPickerItem}
            onMouseDown={event => { event.preventDefault() }}
            onClick={() => { setManual(!manual) }}
          >
            手动输入 provider/model…
          </button>
          {manual && (
            <input
              aria-label="手动输入模型"
              title="写 provider/model，例如 go/deepseek-flash"
              value={modelText}
              onChange={event => { setModelText(event.target.value) }}
              onBlur={() => {
                const next = modelText.trim()
                actions.setModel(next)
                setModelText(next)
              }}
              style={optInput}
              spellCheck={false}
            />
          )}
        </div>
      )}

      <Segmented<OptimizerHistory>
        label="上下文"
        hint="回合 = 只带最近 N 轮往来（0 = 不带）；全文 = 尽量给全（仍受字符预算约束）"
        value={settings.optimizerHistory}
        options={[
          { id: 'turns', label: '回合', hint: '只带最近 N 轮往来（省 token、也够消歧义）' },
          { id: 'full', label: '全文', hint: '把会话往来尽量都给解释层（更懂你，也更慢更贵）' },
        ]}
        onPick={actions.setHistory}
      />
      {settings.optimizerHistory === 'turns' && (
        <div style={optRow}>
          <span style={optLabel} />
          <input
            aria-label="上下文回合数"
            title={`最近几轮往来（${String(OPTIMIZER_TURNS_MIN)}–${String(OPTIMIZER_TURNS_MAX)}；0 = 不带上下文）`}
            type="range"
            min={OPTIMIZER_TURNS_MIN}
            max={OPTIMIZER_TURNS_MAX}
            step={1}
            value={settings.optimizerTurns}
            onChange={event => { actions.setTurns(Number(event.target.value)) }}
            style={optSlider}
          />
          <span style={optNumber}>{settings.optimizerTurns === 0 ? '不带' : `${String(settings.optimizerTurns)} 轮`}</span>
        </div>
      )}

      <Toggle
        label="只读工具"
        hint="允许解释层读项目文件核对事实（read/glob/grep）：限定会话工作目录、只读、有上限"
        on={settings.optimizeReadTools}
        onToggle={actions.setReadTools}
      />
      <Toggle
        label="内置 Bash"
        hint="允许解释层执行 shell 命令核对事实：锁定会话工作目录、单条超时 20 秒、输出截断、逐条记账（默认关）"
        on={settings.optimizeBash}
        onToggle={actions.setBash}
      />

      <div style={optRow}>
        <span style={optLabel} title="改解释层「任务与风格」那一段提示词；输出契约由插件追加，改不掉">详情</span>
        <button
          type="button"
          aria-expanded={detailOpen}
          title="展开/收起提示词编辑"
          style={optSegButton}
          onMouseDown={event => { event.preventDefault() }}
          onClick={() => { setDetailOpen(!detailOpen) }}
        >
          {detailOpen ? '收起 ▾' : '展开 ▸'}
        </button>
      </div>
      {detailOpen && (
        <>
          <span style={optHint}>
            改的是**这一档**的「任务与风格」段；留空 = 用内置那份。输出契约（六类条目与必填依据）由插件追加，改不掉 ——
            它正是宿主逐条校验引文的依据。
          </span>
          <textarea
            aria-label="自定义提示词"
            value={prompt}
            placeholder={tierOff ? '档位是「关闭」：这一档不调用模型，没有提示词' : '留空 = 用内置那份'}
            disabled={tierOff}
            onChange={event => { actions.setPrompt(event.target.value) }}
            style={optPromptBox}
            spellCheck={false}
          />
          <div style={optRow}>
            <span style={optLabel} />
            <button
              type="button"
              title="清空自定义提示词，回到插件内置那一份"
              style={optSegButton}
              disabled={prompt === ''}
              onMouseDown={event => { event.preventDefault() }}
              onClick={() => { actions.setPrompt('') }}
            >
              恢复内置
            </button>
          </div>
        </>
      )}
    </div>
  )
}
