/**
 * 变异测试：把每条新规则从代码里拿掉，看测试会不会变红。
 *
 * 为什么需要它：全绿的测试也可能什么都没盯着（0.5.0 就出现过"两条断言靠别的原因
 * 碰巧通过"）。这里每一条都是"把护栏拆掉 → 测试必须变红"。
 *
 * 只在本地手动跑（不在 npm test 里）：它会重建产物、并且要真的 spawn 进程。
 *   node test/mutation-guards.mjs
 *
 * 注意：宿主半的用例打的是 **lib/index.js**（构建产物），所以每次变异前都要
 * `node build.mjs` —— 否则改 src 根本不进被测对象，会得到假的"没咬住"。
 * 变异 A 还会让测试真的走到"排一次重启"：所以它额外把 scheduleRestart 换成空实现，
 * 免得变异测试本身在后台拉起一个助手进程。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const cases = [
  {
    name: 'A 去掉同源回环那道关卡（host.ts）',
    file: 'src/host.ts',
    from: '        if (!trustedRestartRequest({',
    to: '        if (false && !trustedRestartRequest({',
    // 只拆关卡、不真的排重启：否则这个测试会 spawn 一个后台助手。
    also: [{
      from: 'const scheduled = scheduleRestart(buildIo(), servingPort(firstHeaderValue(req.headers?.host)))',
      to: 'const scheduled = { ok: true, pid: 0, helperPid: 0, logOut: \'\', logErr: \'\', port: null, command: \'\' }',
    }],
    test: 'test/quick-commands.mjs',
    expect: 'POST 跨站 Origin',
  },
  {
    name: 'B 去掉官方信任关卡（host.ts）',
    file: 'src/host.ts',
    from: '        const rejection = connection?.requestRejection?.(req)',
    to: '        const rejection = undefined',
    test: 'test/quick-commands.mjs',
    expect: '官方 connection.requestRejection',
  },
  {
    name: 'C 抬头里去掉重启按钮（SettingsSection.tsx）',
    file: 'src/client/SettingsSection.tsx',
    from: '            <RestartButton restart={restart} />\n',
    to: '',
    test: 'test/client-registration.mjs',
    expect: '按钮与 GitHub 链接同组',
  },
  {
    name: 'D 助手起进程不带 windowsHide（restart.ts）',
    file: 'src/restart.ts',
    from: 'shell: viaShell, windowsHide: true })',
    to: 'shell: viaShell, windowsHide: false })',
    test: 'test/quick-commands.mjs',
    expect: '起新宿主带 windowsHide',
  },
  {
    name: 'E 助手改回固定 sleep 而不等端口（restart.ts）',
    file: 'src/restart.ts',
    from: '    while (Date.now() < until && await listening()) await sleep(pollMs)',
    to: '    await sleep(1500)',
    test: 'test/quick-commands.mjs',
    expect: '助手等的是端口而不是固定时长',
  },
  {
    name: 'G 「可选重启命令」字段被加回设置契约（settings-contract.ts）',
    file: 'src/settings-contract.ts',
    from: "export const RESTART_API_PATH = '/composer-ux/restart'",
    to: "export const RESTART_API_PATH = '/composer-ux/restart'\nexport const RESTART_COMMAND_FIELD = 'restartCommand'",
    test: 'test/client-registration.mjs',
    expect: '设置契约里不再有「可选重启命令」字段',
  },
  {
    name: 'H GET 与 POST 不再区分（host.ts）',
    file: 'src/host.ts',
    from: "        if (method !== 'GET' && method !== 'POST') {",
    to: '        if (false) {',
    test: 'test/quick-commands.mjs',
    expect: '非 GET/POST → 405',
  },
  // ── 「每一栏一个开关」（默认关 + 迁移 + 门控）────────────────────────────
  {
    name: 'I 栏开关一律返回 true（默认关这条规则失效）',
    file: 'src/settings-contract.ts',
    from: '  const signal = SECTION_SIGNALS[field]\n  return signal === undefined ? false : signal(source)',
    to: '  return true',
    test: 'test/quick-commands.mjs',
    expect: '全新安装（空文档）→ 五栏全关',
  },
  {
    name: 'J 判据丢掉"键出现过"那一半（缺省值和"碰过"混为一谈）',
    file: 'src/settings-contract.ts',
    from: '  return value !== undefined && value !== untouched',
    to: '  return value !== untouched',
    test: 'test/quick-commands.mjs',
    expect: '全新安装（空文档）→ 五栏全关',
  },
  {
    name: 'K 宿主半终端策略不再看栏开关（关掉也照样接管）',
    file: 'src/terminal/host.ts',
    from: "      const sectionOn = row?.['enabled'] !== false && sectionEnabledOf(TERMINAL_ENABLED_FIELD, row ?? {})",
    to: '      const sectionOn = true',
    test: 'test/terminal-policy.mjs',
    expect: '关掉这一栏 → 先前下发的限制被撤销',
  },
  {
    name: 'L 拦截器不再看栏开关（键盘照样被接管）',
    file: 'src/client/interceptors.ts',
    from: '    if (!activeSections(deps.settings()).keys) return',
    to: '    if (false) return',
    test: 'test/client-registration.mjs',
    expect: '键位：拦截器按「键位」栏判断',
  },
  {
    name: 'M 五栏开关改成带默认值（"从没碰过"与"明确关掉"再也分不出来）',
    file: 'src/host.ts',
    from: '        [KEYS_ENABLED_FIELD]: z.boolean().required(false),',
    to: '        [KEYS_ENABLED_FIELD]: z.boolean().default(false),',
    test: 'test/quick-commands.mjs',
    expect: '五栏开关在 schema 里是可缺省的',
  },
  {
    name: 'N 去掉「快捷指令」栏的文件迁移（老用户的入口按钮消失）',
    file: 'src/host.ts',
    from: "        const outcome = await readQuickBook(quickStorePath())",
    to: "        const outcome = { kind: 'missing' as const }",
    test: 'test/quick-store.mjs',
    expect: '书本有非内置内容 → 写回 quickEnabled: true',
  },
  // ── 右键菜单卡：三档说明互斥 + 那 7 项搬回卡内 ─────────────────────────────
  {
    name: 'O 那 7 个条目开关不再由「自定义」档门控（三档都显示）',
    file: 'src/client/SettingsSection.tsx',
    from: "        {settings.menuMode === 'custom' && (",
    to: '        {true && (',
    test: 'test/client-registration.mjs',
    expect: '在「自定义」分支里',
  },
  {
    name: 'P 三档说明不再互斥（点哪档都三段全铺开）',
    file: 'src/client/SettingsSection.tsx',
    from: "        {settings.menuMode === 'official' && (",
    to: '        {true && (',
    test: 'test/client-registration.mjs',
    expect: '点哪档只显示哪档',
  },
  {
    name: 'Q strip 那条死掉的路又接回来（标题行第二个入口复活）',
    file: 'src/client/SettingsSection.tsx',
    from: '      {open && <div className="dsh-ux-cardBody">{props.children}</div>}',
    to: '      {false && <div className="dsh-ux-cardStrip" />}\n'
      + '      {open && <div className="dsh-ux-cardBody">{props.children}</div>}',
    test: 'test/client-registration.mjs',
    expect: 'strip 那一套',
  },
  {
    name: 'R 标题行下又重复一遍当前档位的 hint（说明变成两份）',
    file: 'src/client/SettingsSection.tsx',
    from: '            <div style={rowTitle}>菜单来源</div>\n          </div>',
    to: '            <div style={rowTitle}>菜单来源</div>\n'
      + '            <div style={rowDesc}>'
      + '{MENU_MODES.find(item => item.id === settings.menuMode)?.hint ?? \'\'}'
      + '</div>\n          </div>',
    test: 'test/client-registration.mjs',
    expect: '不再重复当前档位的 hint',
  },
  {
    name: 'S 那 7 个条目开关整段删掉（自定义档里再也改不了条目）',
    file: 'src/client/SettingsSection.tsx',
    from: '            {MENU_ITEMS.map((item, index) => (',
    to: '            {false && [].map((item, index) => (',
    test: 'test/client-registration.mjs',
    expect: '在「自定义」分支里',
  },
  // ── 真渲染那一层（`test/settings-render.mjs`）：源码字符串还在、只是渲染不出来 ──────
  // T/U/V 这三条是**只有渲染层能抓到**的：源码里条件与那 7 行都原样在，搜字符串的护栏照样绿。
  {
    name: 'T 那 7 行渲染被短路掉（源码里还在，页面上没有）',
    file: 'src/client/SettingsSection.tsx',
    from: '            {MENU_ITEMS.map((item, index) => (',
    to: '            {false && MENU_ITEMS.map((item, index) => (',
    test: 'test/settings-render.mjs',
    expect: '自定义：7 行都在',
  },
  {
    name: 'U 浏览器档的说明被短路掉（那一档看不到任何说明）',
    file: 'src/client/SettingsSection.tsx',
    from: "        {settings.menuMode === 'browser' && (",
    to: '        {false && (',
    test: 'test/settings-render.mjs',
    expect: '浏览器：只有浏览器那段',
  },
  {
    name: 'V 三档说明全铺开（把自定义那段的互斥条件去掉）',
    file: 'src/client/SettingsSection.tsx',
    from: "        {settings.menuMode === 'custom' && (",
    to: '        {true && (',
    test: 'test/settings-render.mjs',
    expect: '一行条目开关都没有',
  },
]

let allBit = true
for (const item of cases) {
  if (item.skip === true) {
    console.log(`— 跳过（没有源码之外的断言）— ${item.name}`)
    continue
  }
  const original = readFileSync(item.file, 'utf8')
  if (!original.includes(item.from)) {
    console.log(`!! 变异点没找到：${item.name}`)
    allBit = false
    continue
  }
  let mutated = original
  let missing = null
  for (const patch of [{ from: item.from, to: item.to }, ...(item.also ?? [])]) {
    if (!mutated.includes(patch.from)) { missing = patch.from; break }
    mutated = mutated.replace(patch.from, patch.to)
  }
  if (missing !== null) {
    console.log(`!! 附加变异点没找到：${item.name} — ${missing.slice(0, 60)}`)
    allBit = false
    continue
  }
  writeFileSync(item.file, mutated, 'utf8')
  let output = ''
  try {
    // 先重建产物：宿主半的用例打的是 lib/index.js（构建产物），客户端护栏打的是
    // lib/client.js。只改 src 不重建，变异根本进不了被测对象 —— 那会得到假的"没咬住"。
    execSync('node build.mjs', { stdio: 'ignore' })
    output = execSync(`node ${item.test}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    output = `${String(error.stdout ?? '')}${String(error.stderr ?? '')}`
  }
  writeFileSync(item.file, original, 'utf8')
  execSync('node build.mjs', { stdio: 'ignore' })
  const red = output.split('\n').filter(line => line.includes('✗'))
  const bit = red.some(line => line.includes(item.expect))
  console.log(`${bit ? '✓ 咬住了' : '✗ 没咬住'} — ${item.name} → ${(red[0] ?? '(没有红)').trim().slice(0, 100)}`)
  if (!bit) allBit = false
}
console.log(allBit ? '\n全部变异都被测试咬住（改动已还原）' : '\n有变异没被咬住（改动已还原）')
