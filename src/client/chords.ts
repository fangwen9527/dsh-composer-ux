/**
 * 键位规范串：修饰键按 Ctrl+Alt+Shift+Meta 顺序 + 主键，用 '+' 连接。
 * 主键取值优先物理码（KeyJ→J、Digit3→3），其余用标准按键名（Enter、Space、F2...）。
 */

/** 一次按键事件的只读投影（KeyboardEvent 的最小形状）。 */
export interface ChordEvent {
  readonly ctrlKey: boolean
  readonly altKey: boolean
  readonly shiftKey: boolean
  readonly metaKey: boolean
  readonly code: string
  readonly key: string
}

/** 修饰键本身（不应作为主键参与绑定）。 */
const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Shift', 'Meta', 'AltGraph'])

/** 常见标点主键的友好名。 */
const CODE_LABELS: Readonly<Record<string, string>> = {
  Slash: '/',
  Backslash: '\\',
  BracketLeft: '[',
  BracketRight: ']',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  Space: 'Space',
}

/** 把一次按键事件编码为规范串；纯修饰键返回 ''。 */
export function encodeChord(event: ChordEvent): string {
  const parts: string[] = []
  if (event.ctrlKey) parts.push('Ctrl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  if (event.metaKey) parts.push('Meta')
  const mainKey = normalizeMainKey(event)
  if (mainKey === '') return ''
  parts.push(mainKey)
  return parts.join('+')
}

/** 主键名：字母/数字用物理码归一，其余用标准名。 */
function normalizeMainKey(event: ChordEvent): string {
  const code = event.code
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (CODE_LABELS[code] !== undefined) return CODE_LABELS[code] as string
  // F1..F24 及 Enter/Tab/Arrow* /Backspace/Delete 等 code 本身即标准名。
  return code !== '' ? code : event.key
}

/** 是否纯修饰键按下（用于忽略 Ctrl/Alt/Shift 单独按下）。 */
export function isModifierOnly(event: ChordEvent): boolean {
  return MODIFIER_KEYS.has(event.key)
}

/** 主键是否属于「打字类」按键（未被记录规则允许的裸键）。 */
const BARE_ALLOWED = new Set([
  'Enter', 'Space', 'Tab', 'Backspace', 'Delete', 'Insert', 'Home', 'End',
  'PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
])

/** 裸键（无任何修饰键）是否允许绑定。 */
export function isBareKeyAllowed(chord: string): boolean {
  if (chord.includes('+')) return true
  if (BARE_ALLOWED.has(chord)) return true
  return /^F\d{1,2}$/.test(chord)
}

/** 解析规范串 → 反向事件初始化参数（用于合成回放）。 */
export function chordToInit(chord: string): KeyboardEventInit {
  const parts = chord.split('+').filter(Boolean)
  const init: KeyboardEventInit = {
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    bubbles: true,
    cancelable: true,
  }
  const key = parts.pop() ?? ''
  init.key = key
  // 主键的 code 反推（尽力还原；仅影响 IME/物理码读取，不属关键路径）。
  init.code = key.length === 1 ? (/^[A-Z]$/.test(key) ? `Key${key}` : key) : key
  for (const part of parts) {
    if (part === 'Ctrl') init.ctrlKey = true
    else if (part === 'Alt') init.altKey = true
    else if (part === 'Shift') init.shiftKey = true
    else if (part === 'Meta') init.metaKey = true
  }
  return init
}

/** 键位是否属于 Enter 家族（拦截器只接管这些组合）。 */
export function isEnterFamily(chord: string): boolean {
  return chord === 'Enter' || chord.endsWith('+Enter')
}

/** 记录时合法性检查结果。 */
export type RecordResult =
  | { kind: 'ok'; chord: string }
  | { kind: 'cancel' }
  | { kind: 'clear' }
  | { kind: 'ignore' }
  | { kind: 'reject'; message: string }

/** 检查录制按键：结果为 ok 时返回可写入的规范串。 */
export function evaluateRecordedKey(event: ChordEvent): RecordResult {
  if (isModifierOnly(event)) return { kind: 'ignore' }
  if (event.code === 'Escape' || event.key === 'Escape') return { kind: 'cancel' }
  // Backspace/Delete = 清除绑定（与「无」等价，但语义更明显）。
  if (event.code === 'Backspace' || event.code === 'Delete') return { kind: 'clear' }
  const chord = encodeChord(event)
  if (chord === '') return { kind: 'ignore' }
  if (!isBareKeyAllowed(chord)) {
    return {
      kind: 'reject',
      message: '单个字母/数字键会与打字冲突，请配合 Ctrl / Alt / Shift 使用，或选择 Enter。',
    }
  }
  return { kind: 'ok', chord }
}

/** 键位显示文本：'' → 无。 */
export function displayChord(chord: string): string {
  return chord === '' ? '无' : chord
}
