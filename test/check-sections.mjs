/**
 * 「升级前先看一眼」：拿**真实的** `$DSH_HOME/settings.yaml` 跑一遍「每一栏一个开关」的迁移，
 * 打印六栏会变成什么。**只读，不写任何文件**。
 *
 * 为什么需要它：这次改动的默认值是"关"，而它对老用户是靠"你碰过这一栏吗"来迁移的。
 * 迁移判据写在纯函数里，用户没法自己验证 —— 那就用他自己那份文档跑一遍给他看，
 * 而不是让他重启 DSH 之后才发现入口按钮没了。
 *
 *   node test/check-sections.mjs            # 默认读 $DSH_HOME/settings.yaml
 *   DSH_HOME=... node test/check-sections.mjs
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'

const home = process.env.DSH_HOME?.trim() !== undefined && process.env.DSH_HOME?.trim() !== ''
  ? process.env.DSH_HOME.trim()
  : join(homedir(), '.dsh')
const file = join(home, 'settings.yaml')

let raw
try {
  raw = readFileSync(file, 'utf8')
} catch (error) {
  console.error(`读不到 ${file}：${error instanceof Error ? error.message : String(error)}`)
  process.exit(2)
}

/** 取出 `composer-ux:` 那一段（到下一个顶格键为止）。 */
const lines = raw.split(/\r?\n/)
const start = lines.findIndex(line => /^composer-ux\s*:/.test(line))
if (start < 0) {
  console.log(`settings.yaml 里没有 composer-ux 段（${file}）—— 相当于全新安装：六栏全关。`)
  process.exit(0)
}
let end = start + 1
while (end < lines.length && !/^\S/.test(lines[end])) end += 1
const block = lines.slice(start + 1, end).join('\n')

/**
 * 按行取值：这一段是 YAML 流式映射，键都独占一行的开头。
 * 只取本工具要显示的那几个键 —— 不引 YAML 库，免得"解析器替我做了判断"。
 */
const valueOf = (key) => {
  const match = new RegExp(`^\\s*${key}:\\s*(.*?),?\\s*$`, 'm').exec(block)
  return match === null ? undefined : match[1]
}
const textOf = (key) => {
  const value = valueOf(key)
  return value === undefined ? undefined : value.replace(/^["']|["']$/g, '')
}
const boolOf = (key) => {
  const value = valueOf(key)
  return value === undefined ? undefined : value === 'true'
}

// 判据只吃这几个键（与 src/settings-contract.ts 的 SECTION_SIGNALS 一一对应）。
const source = {
  ...(textOf('sendKey') === undefined ? {} : { sendKey: textOf('sendKey') }),
  ...(textOf('newlineKey') === undefined ? {} : { newlineKey: textOf('newlineKey') }),
  ...(textOf('menuMode') === undefined ? {} : { menuMode: textOf('menuMode') }),
  ...(boolOf('menuNative') === undefined ? {} : { menuNative: boolOf('menuNative') }),
  ...(textOf('optimizerTier') === undefined ? {} : { optimizerTier: textOf('optimizerTier') }),
  ...(boolOf('panelScroll') === undefined ? {} : { panelScroll: boolOf('panelScroll') }),
  ...(boolOf('panelResize') === undefined ? {} : { panelResize: boolOf('panelResize') }),
  ...(valueOf('panelWidth') === undefined ? {} : { panelWidth: Number(valueOf('panelWidth')) }),
  ...(valueOf('panelHeight') === undefined ? {} : { panelHeight: Number(valueOf('panelHeight')) }),
  ...(textOf('terminalMode') === undefined ? {} : { terminalMode: textOf('terminalMode') }),
  ...(textOf('terminalBashPath') === undefined ? {} : { terminalBashPath: textOf('terminalBashPath') }),
  ...(boolOf('headerEnabled') === undefined ? {} : { headerEnabled: boolOf('headerEnabled') }),
  ...(boolOf('enabled') === undefined ? {} : { enabled: boolOf('enabled') }),
}

// 用构建产物里那一份契约（客户端真正加载的就是它，不是另抄一遍源码）。
await build({
  entryPoints: ['src/settings-contract.ts'],
  outfile: 'test/.build/contract.mjs',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['es2022'],
  logLevel: 'warning',
})
const contract = await import(new URL('./.build/contract.mjs', import.meta.url))

const settings = contract.sanitizeSettings(source)
const sections = contract.activeSections(settings)
const explicit = {
  keys: valueOf('keysEnabled'),
  menu: valueOf('menuEnabled'),
  quick: valueOf('quickEnabled'),
  panel: valueOf('panelEnabled'),
  terminal: valueOf('terminalEnabled'),
}
// 「快捷指令」栏还有一条文件判据（书本里有非内置内容 → 宿主半写回 true），这里单独说明。
let bookNote = ''
let bookCustom = false
try {
  const book = JSON.parse(readFileSync(join(home, 'quick-prompts.json'), 'utf8'))
  const categories = Array.isArray(book.categories) ? book.categories : []
  const builtin = categories.length === 1 && categories[0]?.name === '默认'
    && Array.isArray(categories[0]?.prompts) && categories[0].prompts.length === 9
  bookCustom = !builtin
  bookNote = builtin
    ? '书本是内置默认本 → 迁移不会替你打开「快捷指令」'
    : `书本里有非内置内容（${String(categories.length)} 个分类）→ 宿主半会把「快捷指令」写回开着`
} catch {
  bookNote = '还没有书本文件 → 迁移不会替你打开「快捷指令」'
}

/** 按显示宽度补空格（中文算 2 列，否则表格参差不齐）。 */
const pad = (text, width) => {
  let shown = 0
  for (const char of text) shown += /[\u2E80-\uFFFD]/u.test(char) ? 2 : 1
  return text + ' '.repeat(Math.max(1, width - shown))
}

const rows = [
  ['键位', 'keys', contract.KEYS_ENABLED_FIELD, false],
  ['右键菜单', 'menu', contract.MENU_ENABLED_FIELD, false],
  ['快捷指令', 'quick', contract.QUICK_ENABLED_FIELD, true],
  ['设置面板', 'panel', contract.PANEL_ENABLED_FIELD, false],
  ['默认终端', 'terminal', contract.TERMINAL_ENABLED_FIELD, false],
]
console.log(`settings.yaml：${file}`)
console.log(`总开关 enabled = ${String(settings.enabled)}（默认开；关着时六栏一律不生效）\n`)
console.log(`${pad('栏目', 12)}${pad('迁移后', 10)}来源`)
for (const [label, key, field, hasFileSignal] of rows) {
  // 「快捷指令」栏多一条文件判据：文档里没痕迹、但书本里有非内置内容时，宿主半会写回 true。
  const on = hasFileSignal && explicit[field] === undefined && sections[key] === false
    ? bookCustom
    : sections[key]
  const how = explicit[field] !== undefined
    ? '文档里写死的值'
    : (sections[key]
        ? '文档里有"你在用"的痕迹'
        : (hasFileSignal && bookCustom
            ? '文档里没痕迹，但书本文件里有你的内容（宿主半写回）'
            : '文档里没有痕迹 ⇒ 默认关'))
  console.log(`${pad(label, 12)}${pad(on ? '开' : '关', 10)}${how}`)
}
const headerExplicit = valueOf('headerEnabled')
console.log(`${pad('OpenCode', 12)}${pad(sections.header ? '开' : '关', 10)}`
  + `${headerExplicit === undefined ? 'headerEnabled 缺省（默认关）' : 'headerEnabled 写死的值'}`)
console.log(`\n「快捷指令」的文件判据：${bookNote}`)
console.log('（本工具只读；迁移真正发生在重启 DSH 之后）')
