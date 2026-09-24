/**
 * 设置页里的「本档提示词」编辑器（0.6.0 起）。
 *
 * 为什么需要它：0.6.0 把提示词优化改成了「模型只产条目、宿主按逐字依据核对后装配」
 * （做法取自 WestFox-AwA/dsh-prompt-optimizer 的 0.6 线）。模型行为不合口味时，
 * 用户唯一能调的就是那份任务提示词 —— 所以必须可编辑、可恢复、且能看见内置那份长什么样。
 *
 * 两条刻意的设计：
 *  · **留空 = 用内置**：空串既是"没自定义"的表示，也是「恢复内置」要写回的值，
 *    不必再多一个"是否自定义"的开关（多一个开关就多一种自相矛盾的状态）。
 *  · **JSON 输出契约不给改**：宿主按它解析条目、做逐字依据比对；契约被改掉，
 *    "不许凭空新增需求"就退化成一句空话。所以这里明说，并把契约留在插件里追加。
 */
import {
  OPTIMIZER_PROMPT_MAX, OPTIMIZER_TIERS,
  type OptimizerTier,
} from '../settings-contract.ts'
import { OPTIMIZER_SPECS, OPTIMIZER_OUTPUT_CONTRACT } from '../optimizer-prompt.ts'
import { pill, row, rowDesc, rowText, rowTitle, textInput } from './styles.ts'

/** 组件入参。 */
export interface OptimizerPromptEditorProps {
  /** 当前档位（决定编辑哪一份、以及"载入内置版"载入哪一份）。 */
  readonly tier: OptimizerTier
  /** 该档位当前的自定义提示词（'' = 用内置）。 */
  readonly value: string
  /** 写回该档位的自定义提示词。 */
  readonly onChange: (next: string) => void
}

/** 内置的任务提示词正文（**不含**输出契约——契约由宿主追加，见文件头注释）。 */
export function builtinTaskPrompt(tier: string): string {
  return OPTIMIZER_SPECS[tier as OptimizerTier]?.system ?? OPTIMIZER_SPECS.advanced.system
}

/**
 * 当前档位的提示词编辑块。
 * @param props - 档位、当前值、写回回调。
 */
export function OptimizerPromptEditor({ tier, value, onChange }: OptimizerPromptEditorProps) {
  const label = OPTIMIZER_TIERS.find(item => item.id === tier)?.label ?? tier
  const custom = value.trim() !== ''
  return (
    <div style={{ ...row, borderTop: 'none', flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
      <div style={rowText}>
        <div style={rowTitle}>
          {`本档提示词（${label}）`}
          <span style={{ marginLeft: 8, opacity: 0.75 }}>{custom ? '自定义' : '内置'}</span>
        </div>
        <div style={rowDesc}>
          留空 = 用插件内置那份。改的是「任务与风格」这段；
          {' '}<strong>JSON 输出契约</strong>由插件在末尾追加、不在这里改 ——
          宿主靠它逐条核对「每条补全都指回你原话里的某句」，契约被改掉这套校验就没了。
        </div>
      </div>
      <textarea
        value={value}
        placeholder={'留空 = 用内置提示词。点下面的「载入内置版」可以先把内置那份抄进来再改。'}
        maxLength={OPTIMIZER_PROMPT_MAX}
        spellCheck={false}
        rows={value.trim() === '' ? 3 : Math.min(16, Math.max(6, Math.ceil(value.length / 60)))}
        onChange={event => { onChange(event.target.value) }}
        style={{ ...textInput, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          style={pill}
          title="把内置那份任务提示词抄进输入框，方便在此基础上改"
          onClick={() => { onChange(builtinTaskPrompt(tier)) }}
        >
          载入内置版
        </button>
        <button
          type="button"
          style={pill}
          disabled={!custom}
          title="清空自定义，改用内置提示词"
          onClick={() => { onChange('') }}
        >
          恢复内置
        </button>
        <span style={{ ...rowDesc, flex: '1 1 auto' }}>
          {`当前字数 ${String(value.length)} / ${String(OPTIMIZER_PROMPT_MAX)}`}
        </span>
      </div>
      <details>
        <summary style={{ ...rowDesc, cursor: 'pointer' }}>看插件固定追加的那段输出契约</summary>
        <pre style={{ ...rowDesc, whiteSpace: 'pre-wrap', margin: '6px 0 0' }}>{OPTIMIZER_OUTPUT_CONTRACT}</pre>
      </details>
    </div>
  )
}
