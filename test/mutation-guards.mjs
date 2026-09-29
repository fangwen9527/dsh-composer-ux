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
    from: '    [KEYS_ENABLED_FIELD]: z.boolean().required(false),',
    to: '    [KEYS_ENABLED_FIELD]: z.boolean().default(false),',
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
  // ── 0.1.7 适配（0.6.0）后的新护栏 ────────────────────────────────────────
  // 这一组针对的失败模式是"插件整块不挂载"：静态 inject 绑错代、或某一代的服务
  // 认领被删掉，表现都只是"界面里少了一块"，构建期完全看不出来。
  {
    name: 'W 客户端静态 inject 又绑回某一代的服务名（另一代上整块不挂载）',
    file: 'src/client.tsx',
    from: "export const inject = ['slots']",
    to: "export const inject = ['slots', 'settingsScope']",
    test: 'test/settings-service-adopt.mjs',
    expect: 'inject 只含 slots',
  },
  {
    name: 'X 0.1.7 那条认领整段被删掉（新版的服务永远没人认领 → 设置页只看到默认值）',
    file: 'src/client.tsx',
    from: "  whenService(['configForms'], view => { adoptSettings(view.configForms, 'get') })\n",
    to: '',
    // 单删注入那一行还不够：下面的"直接读一次"兜底仍会认领同一个服务。
    // 真正的失败模式是**两条都删**（认领彻底消失），所以这里一起删。
    //
    // 2026-09-28：这条锚点曾长期失配（`adoptSettings(ctx.configForms, 'get')` 被
    // `peekService` 包起来之后没跟着改），于是整个套件每跑必报"有变异没被咬住"，
    // 分不清是"这条护栏松了"还是"别的哪条真漏了"。锚点已对着当前源码校正。
    also: [{ from: "  adoptSettings(peekService('configForms'), 'get')\n", to: '' }],
    test: 'test/settings-service-adopt.mjs',
    expect: '认领的是 get(composer-ux)',
  },
  {
    name: 'Y register 不再按能力调用（0.1.7 上没有 register ⇒ 宿主半抛异常挂不上）',
    file: 'src/host.ts',
    from: '    if (typeof settings.register === \'function\') settings.register(NAMESPACE, Config)',
    to: '    settings.register(NAMESPACE, Config)',
    test: 'test/host-settings-generations.mjs',
    expect: '0.1.7 形状下 apply 不抛',
  },
  {
    // 标记必须真的落在**字段**上（0.1.7 靠它判定"哪些字段可编辑"）。
    // 变异点选「用方法的那条分支」：随包 schemastery 3.18.4 有 `.volatile()`，
    // 标记走的就是它——所以要让护栏咬得住，必须动这一行（动 meta 兜底那行在
    // 3.18.4 上根本不参与执行，护栏会"咬不住"，2026-09-23 实测过）。
    name: 'Z volatile 标记不再写进字段（0.1.7 认为这一行没有可编辑字段）',
    file: 'src/host.ts',
    from: '  if (typeof withMethod.volatile === \'function\') return withMethod.volatile()',
    to: '  if (typeof withMethod.volatile === \'function\') return node',
    test: 'test/host-settings-generations.mjs',
    expect: '每个字段都带 volatile 标记',
  },
  {
    name: 'AA Config 读不出来时不再退回 describe（自己的行被判成"没有值"）',
    file: 'src/host.ts',
    from: '        if (own !== undefined) return own',
    to: '        return own',
    test: 'test/host-settings-generations.mjs',
    expect: '自己那一行从 describe 读得到',
  },
  // ── 接管前的自检探针（2026-09-25 新增）─────────────────────────────────────
  {
    name: 'AB 自检门控整段拆掉（探针不过也照旧接管 → 受限模式下会把会话的 shell 打死）',
    file: 'src/terminal/host.ts',
    from: "          const confinedMode = probeDeps === undefined ? '' : confinedModeOf(probeDeps, agent)",
    to: "          const confinedMode = ''",
    test: 'test/terminal-policy.mjs',
    expect: '自检不过 → 不 restrict、不注册、不加提示词段',
  },
  {
    name: 'AC 自检不看沙箱模式（danger-full-access 也强行探 → 本来正常的那条路白起一个进程）',
    file: 'src/terminal/host.ts',
    from: "      return mode === 'read-only' || mode === 'workspace-write' ? mode : ''",
    to: '      return mode',
    test: 'test/terminal-policy.mjs',
    expect: 'danger-full-access 下**不做**自检',
  },
  {
    name: 'AD 门控退回"部署默认"（不把 session 交给 resolve → danger-full-access 的会话被误判成受限）',
    file: 'src/terminal/host.ts',
    from: '      const mode = deps.sandboxPolicy.resolve(session === undefined ? {} : { session }).mode',
    to: '      const mode = deps.sandboxPolicy.resolve({}).mode',
    test: 'test/terminal-policy.mjs',
    expect: '门控把 session 交给了 sandboxPolicy.resolve',
  },
  {
    name: 'AE 打包形态下不再补 ELECTRON_RUN_AS_NODE（受限模式的 runner 在桌面版里起不来）',
    file: 'src/terminal/tool.ts',
    from: "      ...(electron ? { ELECTRON_RUN_AS_NODE: '1' } : {}),",
    to: '',
    test: 'test/terminal-policy.mjs',
    expect: 'spawn env 带 ELECTRON_RUN_AS_NODE=1',
  },
  // ── 「统计行」（0.7.0）──────────────────────────────────────────────────────
  {
    name: 'AF 三位小数退化成"照抄社区插件的 toFixed(3)"（会把没满的命中显示成 100.000%）',
    file: 'src/client/stats-line.ts',
    from: '    if (units < scale) return formatUnits(units, width)',
    to: '    return formatUnits(units, width)',
    test: 'test/stats-line.mjs',
    expect: '→ 99.9999（差 1 个 token',
  },
  {
    name: 'AG 文本判据放宽成"任何 xx%"（会误改两个统计弹窗与同排的 token 数、速度）',
    file: 'src/client/stats-line.ts',
    from: 'const CACHE_HIT_NODE = /^(?:缓存命中|Cache hit)\\s+[\\d.]+\\s*%$/',
    to: 'const CACHE_HIT_NODE = /^[\\d.]+\\s*%$/',
    test: 'test/stats-line.mjs',
    expect: '纯数字节点',
  },
  {
    name: 'AH 「统计行」栏开关默认改成关（用户要的"装完即生效"静默消失）',
    file: 'src/settings-contract.ts',
    from: '  statsEnabled: true,',
    to: '  statsEnabled: false,',
    test: 'test/quick-commands.mjs',
    expect: '统计行是新栏、默认开',
  },
  {
    name: 'AI 定位改成扫全页（给整个页面挂一个 MutationObserver）',
    file: 'src/client/stats-dom.ts',
    from: '  let element = anchor?.parentElement ?? null',
    to: '  let element = document.body',
    test: 'test/client-registration.mjs',
    expect: '只在自己的 composer dock 里找统计行',
  },
  {
    name: 'AJ 不再同步 aria-label（读屏用户听到的还是官方整数）',
    file: 'src/client/stats-dom.ts',
    from: '    const next = rewriteCacheHitLabel(label, display)',
    to: '    const next = null',
    test: 'test/client-registration.mjs',
    expect: '同时改写 aria-label',
  },
  {
    name: 'AK 定位没有层数上限（锚点与统计行不同子树时一路走到 body，变成全页监听）',
    file: 'src/client/stats-dom.ts',
    from: '  for (let depth = 0; depth < MAX_HOST_DEPTH && element !== null; depth += 1) {',
    to: '  for (let depth = 0; element !== null; depth += 1) {',
    test: 'test/stats-dom.mjs',
    expect: '放弃，不返回 body',
  },
  {
    name: 'AL 那一行又被写上行内样式（撤掉的"加宽统计行"长回来）',
    file: 'src/client/stats-dom.ts',
    from: '  for (const labelled of stats.querySelectorAll(\'[aria-label]\')) {',
    to: '  stats.style.maxWidth = \'calc(var(--dsh-chat-content-width) + 260px)\'\n  for (const labelled of stats.querySelectorAll(\'[aria-label]\')) {',
    test: 'test/client-registration.mjs',
    expect: '这一半只改文本，不写任何行内样式',
  },
  {
    name: 'AM 加宽相关常量被重新引入契约（撤掉的那一半没删干净）',
    file: 'src/client/stats-line.ts',
    from: "export const HIT_DIGITS = 3",
    to: "export const HIT_DIGITS = 3\nexport const WIDEN_MAX_WIDTH = 'x'",
    test: 'test/client-registration.mjs',
    expect: '加宽相关常量已从契约里删干净',
  },
  // ── 「金额」（0.8.0）───────────────────────────────────────────────────────
  {
    name: 'AN 金额胶囊的字号退回 `font: inherit`（又去继承输入框那一层的 14px，比旁边官方胶囊大）',
    file: 'src/client/CostChipEntry.tsx',
    from: "          fontSize: 'calc(var(--dsh-content-font-size-secondary, 13px) - 1px)',",
    to: "          fontSize: 'inherit',\n          font: 'inherit',",
    test: 'test/client-registration.mjs',
    expect: '胶囊字号照抄官方 .root',
  },
  {
    name: 'AO 计费输入的分母又传 `inputTokens`（`billedInputTokens()` 只认 uncachedInputTokens → 命中率恒 100%）',
    file: 'src/client/CostChipEntry.tsx',
    from: '    uncachedInputTokens: view.miss,',
    to: '    inputTokens: view.miss,',
    test: 'test/client-registration.mjs',
    expect: '计费输入的分母用官方键名 uncachedInputTokens',
  },
  {
    name: 'AP 命中率自己写一套（不再复用输入框下面那一行的 cacheHitText，两处数字会不一致）',
    file: 'src/client/CostChipEntry.tsx',
    from: '  const viewHitRate = cacheHitText(view.hit, viewBilledInput)',
    to: '  const viewHitRate = String(Math.round(view.hit / viewBilledInput * 100))',
    test: 'test/client-registration.mjs',
    expect: '命中率与输入框下面那一行同一套函数',
  },
  // ── 官方持久终端六件套的挂载层（不是源码，是 cordis.patch.yml 里的插入行）──────
  {
    name: 'AQ 拆掉守卫的外层 try/catch（disabled 表达式抛错算「条目失败」⇒ 白屏，不是「被禁用」）',
    file: 'cordis.patch.yml',
    from: "} catch { return true } })()\"",
    to: "} catch { throw new Error('guard exploded') } })()\"",
    test: 'test/terminal-mount.mjs',
    expect: '连 node 内建都拿不到时也不抛',
  },
  {
    name: 'AR 守卫极性写反（解析得到包 → 反而把行禁掉，功能永远不出现）',
    file: 'cordis.patch.yml',
    from: 'return !roots.some((r) =>',
    to: 'return roots.some((r) =>',
    test: 'test/terminal-mount.mjs',
    expect: '包在「当前 profile 的 node_modules」里',
  },
  {
    name: 'AS 挂载行写错包名（copy-paste 漂移，挂到别的官方包上）',
    file: 'cordis.patch.yml',
    from: "      name: '@deepseek-ai/dsh-tool-terminal'",
    to: "      name: '@deepseek-ai/dsh-tool-bash'",
    test: 'test/terminal-mount.mjs',
    expect: '三行齐全',
  },
  {
    name: 'AT 给这一行加 group: true（会迫使加载器初始化 disabled 行，自检守卫当场失效）',
    file: 'cordis.patch.yml',
    from: '      disabled: !!js "(() => {',
    to: '      group: true\n      disabled: !!js "(() => {',
    test: 'test/terminal-mount.mjs',
    expect: 'group',
  },
  {
    name: 'AU 依赖改成通配 *（钉不住官方那套的版本窗口）',
    file: 'package.json',
    from: '"@deepseek-ai/dsh-tool-terminal": ">=0.1.7-rc.1 <0.1.8 || >=0.2.0-rc.1 <0.3.0"',
    to: '"@deepseek-ai/dsh-tool-terminal": "*"',
    test: 'test/terminal-mount.mjs',
    expect: '依赖是区间',
  },
  {
    name: 'AV 依赖改成钉死单版本（runtime 一升级就装不上对应的官方包）',
    file: 'package.json',
    from: '"@deepseek-ai/dsh-tool-terminal": ">=0.1.7-rc.1 <0.1.8 || >=0.2.0-rc.1 <0.3.0"',
    to: '"@deepseek-ai/dsh-tool-terminal": "0.2.0-rc.1"',
    test: 'test/terminal-mount.mjs',
    expect: '依赖是区间',
  },
  {
    name: 'AW 多挂一行 dsh-terminal（服务重复 ⇒ 两个实例）',
    file: 'cordis.patch.yml',
    from: '    - id: composer-ux-tool-terminal',
    to: "    - id: composer-ux-terminal-dup\n      name: '@deepseek-ai/dsh-terminal'\n    - id: composer-ux-tool-terminal",
    test: 'test/terminal-mount.mjs',
    expect: '三行齐全',
  },
  {
    name: 'AY 服务行被删掉（工具行缺少 terminals ⇒ 静默 pending，一个工具都不注册）',
    file: 'cordis.patch.yml',
    from: "      name: '@deepseek-ai/dsh-terminal'\n",
    to: "      # name: '@deepseek-ai/dsh-terminal' （服务行被删）\n",
    test: 'test/terminal-mount.mjs',
    expect: '三行齐全',
  },
  {
    name: 'AZ 探不到 bash 时的方言回落被改成 bash（会拿 pwsh.exe 当 bash 用）',
    file: 'cordis.patch.yml',
    from: "} catch { return 'pwsh' } })()",
    to: "} catch { return 'bash' } })()",
    test: 'test/terminal-mount.mjs',
    expect: 'fs 抛错时不冒泡',
  },
  {
    name: 'BA shellPath 写死 /bin/bash（Windows 上解析不到，官方后端起不来）',
    file: 'cordis.patch.yml',
    from: '        shellPath: !!js "(',
    to: '        shellPath: \'/bin/bash\' # !!js "(',
    test: 'test/terminal-mount.mjs',
    expect: 'shellPath 都是 !!js',
  },
  {
    name: 'BB 给服务行也加自检守卫（profile 目录解析不到安装包 ⇒ 服务永远禁用）',
    file: 'cordis.patch.yml',
    from: "    - id: composer-ux-terminal\n      name: '@deepseek-ai/dsh-terminal'",
    to: "    - id: composer-ux-terminal\n      name: '@deepseek-ai/dsh-terminal'\n      disabled: !!js \"true\"",
    test: 'test/terminal-mount.mjs',
    expect: '服务行不带 !!js 守卫',
  },
  {
    name: 'AX 把自检守卫注释掉（变回无条件挂载 ⇒ 没装包就是白屏）',
    file: 'cordis.patch.yml',
    from: '      disabled: !!js "(() => {',
    to: '      # disabled: !!js "(() => {',
    test: 'test/terminal-mount.mjs',
    expect: '全文只有工具行那一处 disabled',
  },
  {
    name: 'BC 守卫里 `ctx.get` 少了各自的自保（它一抛错，整个守卫就退回"装不上" ⇒ 工具行被禁）',
    file: 'cordis.patch.yml',
    from: "let explicit; try { explicit = ctx.get('profileContext')?.dir } catch { explicit = undefined }",
    to: "let explicit; explicit = ctx.get('profileContext')?.dir",
    test: 'test/terminal-mount.mjs',
    expect: 'ctx.get 抛错也不影响判定',
  },
  {
    name: 'BD 守卫的基准退回只用 ctx.get（就是真机踩的那个坑：拿不到就永远禁用）',
    file: 'cordis.patch.yml',
    from: "const roots = [p.join(profiles, 'node_modules')];",
    to: 'const roots = [];',
    test: 'test/terminal-mount.mjs',
    expect: '包只在共享的 profiles/node_modules 里',
  },
  {
    name: 'BE 探测不再排除 WSL（真机就因此把 PTY 起成了 WSL bash，`D:\\x` 被当成 `/mnt/d/x`）',
    file: 'cordis.patch.yml',
    from: "return a === 'windowsapps' || (a === 'system32' && b === 'windows')",
    to: 'return false',
    test: 'test/terminal-mount.mjs',
    expect: '只有 WSL 的 System32',
  },
  {
    name: 'BF 依赖窗口丢掉 0.2.0（本机升级后会被兼容性预检判掉 ⇒ 工具行静默消失）',
    file: 'package.json',
    from: '">=0.1.7-rc.1 <0.1.8 || >=0.2.0-rc.1 <0.3.0"',
    to: '">=0.1.7-rc.1 <0.1.8"',
    test: 'test/terminal-mount.mjs',
    expect: '依赖窗口覆盖两个已验证过的运行时',
  },
  {
    name: 'BG 非法单价格子被当成"清空"（价格悄悄回到官方价，用户以为改成功了）',
    file: 'src/pricing.ts',
    from: "  if (!Number.isFinite(value) || value < 0) return { kind: 'invalid' }",
    to: "  if (!Number.isFinite(value) || value < 0) return { kind: 'empty' }",
    test: 'test/pricing.mjs',
    expect: '千分位逗号 / 带单位 / 负数 / 非数 → invalid',
  },
  {
    name: 'BH 覆盖价表的空壳不再往上收（设置文件堆空对象、界面多出填不上的空行）',
    file: 'src/pricing.ts',
    from: '  if (entry.peak === undefined && entry.offPeak === undefined) delete next[key]',
    to: '  if (false) delete next[key]',
    test: 'test/pricing.mjs',
    expect: '两档都清空 → 模型那一项消失',
  },
  {
    name: 'BI `resolvePrice` 忽略显式档位（面板两档单价与分档金额全按"现在"算）',
    file: 'src/pricing.ts',
    from: '  const peak = options.peak ?? isPeakAt(atMs, { holidays: options.holidays })',
    to: '  const peak = isPeakAt(atMs, { holidays: options.holidays })',
    test: 'test/pricing.mjs',
    expect: '`peak` 参数直接指定档位',
  },
  {
    name: 'BJ 同一步的替换增量重新判档（一次跨 09:00 的请求被拆成两档，凭空多出高峰用量）',
    file: 'src/usage-fold.ts',
    from: '        const tier = previous?.tier ?? tierAt(Number.isFinite(headerTime) ? headerTime : timeOf(event), provider, model)',
    to: '        const tier = tierAt(Number.isFinite(headerTime) ? headerTime : timeOf(event), provider, model)',
    test: 'test/usage-fold.mjs',
    expect: '同一步的替换增量仍算第一次那档',
  },
  {
    name: 'BK 播种期间不缓冲订阅事件（水位跳过快照中间那些事件 ⇒ 金额永久少算）',
    file: 'src/usage-fold.ts',
    from: '      if (row.seeding) {\n        row.buffered.push(event)\n        return\n      }',
    to: '      if (false) {\n        row.buffered.push(event)\n        return\n      }',
    test: 'test/usage-fold.mjs',
    expect: '播种窗口内追加的事件不会被吞掉',
  },
  {
    name: 'BL 落后了也不重读（会话继续跑，分列与金额停在第一次那个数上）',
    file: 'src/usage-fold.ts',
    from: '        || (liveSeq !== undefined && liveSeq - 1 > row.lastSeq)',
    to: '        || false',
    test: 'test/usage-fold.mjs',
    expect: 'liveSeq 前进 → 重读并把新的补上',
  },
  {
    name: 'BM 金额卡片的空框写成 0（留空不再等于"沿用官方价"，而是一键把所有价改成 0）',
    file: 'src/client/CostCard.tsx',
    from: '                            value={valueOf(key, peak, field)}',
    to: "                            value={valueOf(key, peak, field) === '' ? '0' : valueOf(key, peak, field)}",
    test: 'test/settings-render.mjs',
    expect: '单价格子 value 是空串',
  },
  // ── 0.10.0 新增：峰谷三边界 + 价格档 era + 未定价 + 余额白名单 + 同步保险 ──────
  // 这一组是 0.9.1 大改后补的：每条都对应一处"拆掉之后金额会算错 / 钥匙会交出去"。
  {
    name: 'BN 法定节假日不再全天谷价（十一那天上午被按高峰价计费）',
    file: 'src/pricing.ts',
    from: '  if (ms >= WEEKEND_OFFPEAK_AT_MS && holidays.includes(beijingDayKey(ms))) return false',
    to: '  if (false && holidays.includes(beijingDayKey(ms))) return false',
    test: 'test/pricing.mjs',
    expect: '2026-10-01（周四）09:00–12:00 是谷价',
  },
  {
    name: 'BO 周末全谷丢掉生效时刻（08-22 那个周六也被当成谷价，历史金额被重算）',
    file: 'src/pricing.ts',
    from: '  if (ms >= WEEKEND_OFFPEAK_AT_MS && (weekday === 0 || weekday === 6)) return false',
    to: '  if (weekday === 0 || weekday === 6) return false',
    test: 'test/pricing.mjs',
    expect: '2026-08-22（周六）北京 09:00–12:00 是峰价',
  },
  {
    name: 'BP 峰谷制之前不再判"没有高峰"（08-16 那天凭空多出高峰用量）',
    file: 'src/pricing.ts',
    from: '  if (ms < PEAK_RULE_AT_MS) return false',
    to: '  if (false) return false',
    test: 'test/pricing.mjs',
    expect: '2026-08-16（周日）任何时段都不是峰',
  },
  {
    name: 'BQ 价格档不进 route key（同一模型调价前后的用量被合并，历史金额跟着现在变）',
    file: 'src/usage-fold.ts',
    from: "        const key = `${provider}\\u0000${model}\\u0000${tier.peak ? 'peak' : 'offPeak'}\\u0000${tier.era}`",
    to: "        const key = `${provider}\\u0000${model}\\u0000${tier.peak ? 'peak' : 'offPeak'}`",
    test: 'test/usage-fold.mjs',
    expect: '不同 era → 两条 route',
  },
  {
    name: 'BR 未定价被说成"已定价"（第三方模型显示 0 元/1M 而不是未定价）',
    file: 'src/pricing.ts',
    from: "        prices: ZERO_TRIPLE, overridden: false, unpriced: true, builtin: false, source: 'none',",
    to: "        prices: ZERO_TRIPLE, overridden: false, unpriced: false, builtin: false, source: 'none',",
    test: 'test/pricing.mjs',
    expect: '第三方模型没有价目 → unpriced / source = none / 单价全 0',
  },
  {
    name: 'BS 余额端点白名单拆掉（被改成 evil.com 的 baseURL 能收走 API Key）',
    file: 'src/balance.ts',
    from: "  if (parsed.hostname !== 'api.deepseek.com') return false",
    to: '  if (false) return false',
    test: 'test/balance.mjs',
    expect: '子域名伪装',
  },
  // BT 曾经"没有条目"：`fetchText` 的长度保险在**集成路径上观察不到**（`fetchOfficialPages`
  // 的 minLength 500 与 `fetchModelsDevPrices` 的 1000 之后都还有解析关卡，短正文本来也过不了
  // 解析）。**2026-09-30 已补**：把 `fetchText` 从 `test/pure-entry.ts` 出口，并在
  // `test/price-sync.mjs` 里直接断言"短于 minLength 一律 undefined（哪怕它是完整合法的 JSON）"，
  // 于是这条保险现在咬得住了。这条护栏防的是"CDN/改版返回一页错误 HTML 被当成新价目写进档"。
  {
    name: 'BT 抓取不再做"正文太短就算失败"的保险（一页错误 HTML 会被当成新价目写进档）',
    file: 'src/price-sync.ts',
    from: '    if (options.minLength !== undefined && text.length < options.minLength) return undefined',
    to: '    if (false) return undefined',
    test: 'test/price-sync.mjs',
    expect: '正文短于 minLength 一律当失败',
  },
  {
    name: 'BU models.dev 的 deepseek 整块不再丢掉（留着迟早被误用成 DeepSeek 单价）',
    file: 'src/price-sync.ts',
    from: "    if (id === '' || id === 'deepseek') continue",
    to: "    if (id === '') continue",
    test: 'test/price-sync.mjs',
    expect: 'deepseek 整块被丢掉',
  },
  {
    name: 'BV 用量路由不再问官方信任关卡（任何能访问该端口的人都能读会话用量）',
    file: 'src/host.ts',
    from: '      if (rejectUntrustedRequest(usageCtx as never, req, res)) return',
    to: '      if (false && rejectUntrustedRequest(usageCtx as never, req, res)) return',
    test: 'test/quick-commands.mjs',
    expect: '/composer-ux/usage 也走官方信任关卡',
  },
  {
    name: 'BW 不再用内置第三方价目快照兜底（没点过同步时所有第三方模型都变"未定价"）',
    file: 'src/pricing.ts',
    from: '    const snapshot = synced === undefined ? providerRateOf(BUILTIN_PROVIDER_PRICES, provider, raw) : undefined',
    to: '    const snapshot = undefined',
    test: 'test/pricing.mjs',
    expect: '没同步过时也能查内置快照（精确 provider）',
  },
  {
    name: 'BY 自动同步不再看开关（用户没同意也自己联网抓官方价）',
    file: 'src/price-sync.ts',
    from: '  if (options.enabled !== true) return false\n  if (!Number.isFinite(options.nowMs)) return false',
    to: '  if (false) return false\n  if (!Number.isFinite(options.nowMs)) return false',
    test: 'test/price-sync.mjs',
    expect: '开关没开（undefined / false / 字符串 / 1）一律不跑',
  },
  {
    name: 'BZ 官方价同步完不通知金额规则失效（后台自动同步后金额停在旧价格档，界面上看不出来）',
    file: 'src/host.ts',
    from: "        const saved = await writeSynced({ ...synced, fetchedAt })\n        if (saved) invalidateMoney()\n        return { ok: true, changed: false, fetchedAt, saved, message: '官方价与当前生效的档位一致，没有新增价格档' }",
    to: "        const saved = await writeSynced({ ...synced, fetchedAt })\n        return { ok: true, changed: false, fetchedAt, saved, message: '官方价与当前生效的档位一致，没有新增价格档' }",
    test: 'test/quick-commands.mjs',
    expect: '官方价同步的两条收尾（有变化 / 无变化）写完设置都通知失效',
  },
  {
    name: 'CA 余额 hook 的 alive 不再重置（StrictMode / HMR 重挂后余额永远空白）',
    file: 'src/client/money-admin.ts',
    from: '  React.useEffect(() => {\n    // 同上：StrictMode 下 effect 会重跑，这里必须把 `alive` 重置回 true。\n    alive.current = true\n    return () => { alive.current = false }\n  }, [])',
    to: '  React.useEffect(() => () => { alive.current = false }, [])',
    test: 'test/client-registration.mjs',
    expect: '每个 alive ref 都有对应的重置',
  },
  {
    name: 'CB reasoner 别名映回 Pro（flash 的用量被按 Pro 价算，贵约 3 倍）',
    file: 'src/pricing.ts',
    from: "  'deepseek-reasoner': 'deepseek-flash',",
    to: "  'deepseek-reasoner': 'deepseek-v4-pro',",
    test: 'test/pricing.mjs',
    expect: 'deepseek-reasoner 按 flash 计价',
  },
  {
    name: 'CC 浮层说明里写回 markdown 的 `**加粗**`（用户会在界面上看到字面星号）',
    file: 'src/client/CostChipEntry.tsx',
    from: "                  ? note(`有 ${unpricedCount} 行「未定价」：那是非 DeepSeek 模型，同步价目与内置快照里都没有它，`",
    to: "                  ? note(`有 ${unpricedCount} 行**未定价**：那是非 DeepSeek 模型，同步价目与内置快照里都没有它，`",
    test: 'test/cost-panel-render.mjs',
    expect: '没有 markdown 记号',
  },
  // ── 法定节假日自动获取（0.11.0）────────────────────────────────────────────
  //
  // 这一组的每一处都能把某两天的金额算错 2 倍，或者让插件在用户没同意时联网。
  {
    name: 'CD 补班日（isOffDay:false）被当成放假（2026-10-10 那个周六的金额会变）',
    file: 'src/holiday-sync.ts',
    from: '    if (entry.isOffDay !== true) continue',
    to: '    if (entry.isOffDay === undefined) continue',
    test: 'test/holiday-sync.mjs',
    expect: '补班日 2026-10-10（周六）不在表里',
  },
  {
    name: 'CE 北京年判成 UTC 年（跨年那几天算错，且某一年会永远不再抓）',
    file: 'src/holiday-sync.ts',
    from: '  const year = Number(new Date(safe + 8 * 3_600_000).toISOString().slice(0, 4))',
    to: '  const year = Number(new Date(safe).toISOString().slice(0, 4))',
    test: 'test/holiday-sync.mjs',
    expect: '北京年边界',
  },
  {
    name: 'CF 节假日获取不看开关（用户没同意也自己联网）',
    file: 'src/holiday-sync.ts',
    from: '  if (options.enabled !== true) return []',
    to: '  if (false) return []',
    test: 'test/holiday-sync.mjs',
    expect: '开关 undefined',
  },
  {
    name: 'CG 生效表用"替换"而不是"并集"（跨年后旧年份的节假日丢失，旧会话被按高峰算）',
    file: 'src/pricing.ts',
    from: '  const merged = [...new Set([...DEFAULT_PEAK_HOLIDAYS, ...autoDays])].sort().slice(-400)',
    to: '  const merged = [...new Set(autoDays)].sort().slice(-400)',
    test: 'test/holiday-sync.mjs',
    expect: '取并集',
  },
  {
    name: 'CH 用户手填不再优先（后台抓回来的表把用户那张盖掉）',
    file: 'src/pricing.ts',
    from: "  if (manualCount > 0) {\n    return { days: manualDays, source: 'manual', autoCount, manualCount }",
    to: "  if (false) {\n    return { days: manualDays, source: 'manual', autoCount, manualCount }",
    test: 'test/holiday-sync.mjs',
    expect: '手填非空',
  },
  {
    name: 'CI 节假日同步完不通知金额规则失效（后台取回新表后峰谷仍按旧表判）',
    file: 'src/host.ts',
    from: '      invalidateMoney()\n      const parts: string[] = []',
    to: '      const parts: string[] = []',
    test: 'test/holiday-sync.mjs',
    expect: '写完之后生效表就是并集那份',
  },
  {
    name: 'CJ 抓不到也照写设置（纪律"抓不到就什么都不改"失效）',
    file: 'src/host.ts',
    from: '      if (result.fetched.length === 0 && result.unpublished.length === 0) {',
    to: '      if (false) {',
    test: 'test/holiday-sync.mjs',
    expect: '设置里一个字都没写',
  },
  {
    name: 'CK 去掉 jsDelivr 镜像兜底（GitHub raw 一抽就永远拉不到节假日）',
    file: 'src/holiday-sync.ts',
    from: '  for (const url of [urls.primary, urls.mirror]) {',
    to: '  for (const url of [urls.primary]) {',
    test: 'test/holiday-sync.mjs',
    expect: '退镜像',
  },
  // ── 官方价格页 URL 形状（2026-09-29 真机事故）──────────────────────────────
  {
    name: 'CL 官方页候选兜底只剩一个（站点换形状时"同步官方价"又会整块失败）',
    file: 'src/price-sync.ts',
    from: '  return [canonical, alternate]',
    to: '  return [canonical]',
    test: 'test/price-sync.mjs',
    expect: '退到另一个候选',
  },
  {
    name: 'CM 英文价格页 URL 去掉结尾斜杠（事故原样复现：不带斜杠那页没有价格表）',
    file: 'src/price-sync.ts',
    from: "  usd: 'https://api-docs.deepseek.com/quick_start/pricing/',",
    to: "  usd: 'https://api-docs.deepseek.com/quick_start/pricing',",
    test: 'test/price-sync.mjs',
    expect: '都以 / 结尾',
  },
  // ── 0.11.1：优化路由的信任关卡、斜杠命令、推理档、断连、写回护栏 ──────────
  {
    name: 'CN 优化路由不再问官方信任关卡（谁都能花你的模型额度）',
    file: 'src/host.ts',
    from: '      if (rejectUntrustedRequest(optCtx as never, req, res as never)) return',
    to: '      if (false) return',
    test: 'test/quick-commands.mjs',
    expect: '优化路由先问官方信任关卡',
  },
  {
    name: 'CO 快捷指令存储路由不再问官方信任关卡（跨站能覆盖你的提示词库）',
    file: 'src/host.ts',
    from: '      if (rejectUntrustedRequest(storeCtx as never, req, res as never)) return',
    to: '      if (false) return',
    test: 'test/quick-commands.mjs',
    expect: '快捷指令存储路由同样先问信任关卡',
  },
  {
    name: 'CP 斜杠命令整段交给模型（命令词会被"优化"掉，命令失效）',
    file: 'src/host.ts',
    from: "      const body = slash.prefix === '' ? text : slash.body",
    to: '      const body = text',
    test: 'test/quick-commands.mjs',
    expect: '斜杠命令：前缀不进模型',
  },
  {
    name: 'CQ 只有命令没有正文也照发请求（白花一次调用）',
    file: 'src/host.ts',
    from: "      if (slash.prefix !== '' && slash.body === '') {",
    to: '      if (false) {',
    test: 'test/quick-commands.mjs',
    expect: '只有命令、没有正文 → 400',
  },
  {
    name: 'CR 推理档不再钳最低（推理模型在优化上先空转几十秒）',
    file: 'src/host.ts',
    from: '      const effort = await lowestReasoningEffort(route.provider, route.model)',
    to: "      const effort = ''",
    test: 'test/quick-commands.mjs',
    expect: '钳到路由最省的推理档',
  },
  {
    // 0.11.1 那条"写回前比对草稿"在 0.12.0 换了落点：判定搬进了 optimize-dock.ts 的
    // insertDecision（那条由 CX 守着），这里守**接线** —— 别把它短路成"永远直接插入"。
    name: 'CS 插入的判定被短路（不再调用 insertDecision，直接覆盖）',
    file: 'src/client.tsx',
    from: '      const decision = insertDecision(state, currentDraft(), insertConfirmed)',
    to: "      const decision = 'insert' as const",
    test: 'test/client-registration.mjs',
    expect: '插入前比对草稿',
  },
  {
    name: 'CT 写回时不再拼回斜杠命令前缀（命令被优化稿顶掉）',
    file: 'src/client.tsx',
    from: '      if (!replaceDraft(composeOptimizedDraft(state.slashPrefix, state.text))) {',
    to: '      if (!replaceDraft(state.text)) {',
    test: 'test/client-registration.mjs',
    expect: '写回时把斜杠命令前缀拼回',
  },
  {
    name: 'CU 「快捷指令」按钮挪到官方「展开」右侧（order 89 → 95）',
    file: 'src/client.tsx',
    from: "    id: 'composer-ux-quick',\n    order: 89,",
    to: "    id: 'composer-ux-quick',\n    order: 95,",
    test: 'test/client-registration.mjs',
    expect: '按钮 order = 89',
  },
  {
    name: 'CV 秒表起点不写（面板与按钮永远显示 0s，看不出它是不是还活着）',
    file: 'src/client.tsx',
    from: '    optimizeStartedAt.set(startedAt)',
    to: '    optimizeStartedAt.set(0)',
    test: 'test/client-registration.mjs',
    expect: '秒表起点',
  },
  // ── 0.12.0：结果框的状态机与接线 ─────────────────────────────────────────
  {
    name: 'CW 取消时把已生成的条目一起丢掉（用户等了几十秒的东西一键蒸发）',
    file: 'src/client/optimize-dock.ts',
    from: "      return { ...state, phase: 'cancelled', startedAt: 0, elapsedMs: elapsed(state.startedAt, event.at), error: '' }",
    to: "      return { ...state, phase: 'cancelled', items: [], startedAt: 0, elapsedMs: elapsed(state.startedAt, event.at), error: '' }",
    test: 'test/quick-commands.mjs',
    expect: 'cancel：保留已经生成的部分',
  },
  {
    name: 'CX 插入不再比对草稿（静默覆盖用户刚写的内容）',
    file: 'src/client/optimize-dock.ts',
    from: "  return sameDraft(state.draftAtStart, currentDraft) ? 'insert' : 'confirm'",
    to: "  return 'insert'",
    test: 'test/quick-commands.mjs',
    expect: '先要一次确认',
  },
  {
    name: 'CY Esc 在跑的时候关面板（而不是中止等待）',
    file: 'src/client/QuickCommandsPanel.tsx',
    from: '      if (dockRunning) {\n        actions.dockCancel()\n        return\n      }',
    to: '      if (false) {\n        actions.dockCancel()\n        return\n      }',
    test: 'test/client-registration.mjs',
    expect: '取消时面板不关',
  },
  {
    name: 'CZ 完成后不停秒表（读数一直往上涨）',
    file: 'src/client/optimize-dock.ts',
    from: '        startedAt: 0,\n        elapsedMs: elapsed(state.startedAt, event.at),',
    to: '        elapsedMs: elapsed(state.startedAt, event.at),',
    test: 'test/quick-commands.mjs',
    expect: '停表',
  },
  // ── 0.12.0：会话上下文与记忆链 ───────────────────────────────────────────
  {
    // 这条是**真踩过的 bug**：readOwnSetting 走 textOf，把 false 读成空串，
    // 于是"关掉上下文开关"被读成"没设置"、永远开着。5d 那组用例逮住了它。
    name: 'DA 上下文开关用文本读法（false 读成空串 ⇒ 关不掉）',
    file: 'src/host.ts',
    from: '      const contextOn = readOwnFlag(optCtx, config, OPTIMIZER_CONTEXT_FIELD, DEFAULT_SETTINGS.optimizerContext)',
    to: "      const contextOn = readOwnSetting(optCtx, config, OPTIMIZER_CONTEXT_FIELD) !== '' || true",
    test: 'test/quick-commands.mjs',
    expect: '开关关掉：不读会话',
  },
  {
    name: 'DB 上下文不按角色各取（助手碎片把用户的诉求挤出上下文）',
    file: 'src/prompt-context.ts',
    from: "  const users = collected.filter(item => item.role === 'user').slice(-Math.max(0, turns))\n  const assistants = collected.filter(item => item.role === 'assistant').slice(-Math.max(0, turns))",
    to: "  const users = collected.filter(item => item.role === 'user')\n  const assistants = collected.filter(item => item.role === 'assistant')",
    test: 'test/quick-commands.mjs',
    expect: '两个角色各自只取最近 N 条',
  },
  {
    name: 'DC 上下文把插件注入的 user 消息也当"你说过的话"',
    file: 'src/prompt-context.ts',
    from: "      if (source !== undefined && textOf(source.kind) !== 'user') continue",
    to: '      // mutated: 不再过滤来源',
    test: 'test/quick-commands.mjs',
    expect: '只取真正来自用户的',
  },
  {
    name: 'DD 记忆链门槛拆掉（同文重试/对成品重跑也带上参考，污染模型判断）',
    file: 'src/client/optimize-dock.ts',
    from: "  if (sameDraft(dock.source, nextSource)) return ''",
    to: "  if (false) return ''",
    test: 'test/quick-commands.mjs',
    expect: '同文重试',
  },
  {
    // 0.12.0 引入 typecheck 时抓到的真 bug 原样复现：常量没 import，用到它的路径一点就
    // ReferenceError（设置页「恢复默认」），而当时 18 套件全绿 —— 静态护栏补上了这一课。
    name: 'DE 字段常量少了 import（用到的路径一点就 ReferenceError）',
    file: 'src/client.tsx',
    from: '  PEAK_HOLIDAYS_FIELD, PEAK_ALERT_FIELD, BALANCE_ENABLED_FIELD, PRICE_AUTO_SYNC_FIELD,\n',
    to: '  PEAK_HOLIDAYS_FIELD, PEAK_ALERT_FIELD, BALANCE_ENABLED_FIELD,\n',
    test: 'test/client-registration.mjs',
    expect: '用到的字段常量都 import/定义过',
  },
  {
    // Node 20（CI 的矩阵版本）没有全局 navigator；去掉这句守卫，三个平台的测试步骤会一起崩
    // —— 0.12.0 首次跑三平台 CI 时就是这样，本地 Node 24 反而看不见。
    name: 'DF 预读剪贴板不再判 navigator 是否存在（Node 20 上右键直接 ReferenceError）',
    file: 'src/client/interceptors.ts',
    from: "  if (typeof navigator === 'undefined') return\n  const readText = (navigator as Navigator",
    to: '  const readText = (navigator as Navigator',
    test: 'test/client-registration.mjs',
    expect: '预读剪贴板前先判 navigator 存在',
  },
  {
    // 0.12.0 截图验收抓到的那条：主按钮的填色与前景必须是配对令牌。
    // 这条变异把它退回到"深色主题下白底白字"的写法，2.0f 的对象级断言必须变红。
    name: 'DG 主按钮前景退回不存在的令牌名（深色主题下白底黑字变白字）',
    file: 'src/client/styles.ts',
    from: "  color: 'var(--dsw-alias-label-primary-foreground)',\n  fontWeight: 600,",
    to: "  color: 'var(--dsw-alias-label-inverse, #fff)',\n  fontWeight: 600,",
    test: 'test/client-registration.mjs',
    expect: '填色与前景是配对令牌',
  },
  {
    name: "DH 台账的原因去掉消毒（模型的引文会连带写进磁盘）",
    file: "src/optimize-ledger.ts",
    from: "    droppedReasons: [...new Set(input.droppedReasons.map(reason => ledgerSafeReason(reason)).filter(reason => reason !== ''))].slice(0, 8),",
    to: "    droppedReasons: [...new Set(input.droppedReasons.map(reason => reason).filter(reason => reason !== ''))].slice(0, 8),",
    test: "test/quick-commands.mjs",
    expect: "整份台账（含丢弃原因）搜不到那个独特的词",
  },
  {
    name: "DI 台账写失败改成抛错（旁路失败拖垮已经跑完的优化）",
    file: "src/optimize-ledger.ts",
    from: "  } catch {\n    return { written: false, rotated: false }\n  }\n}",
    to: "  } catch (error) {\n    throw error\n  }\n}",
    test: "test/optimize-ledger.mjs",
    expect: "路径不可写时返回 written=false 且不抛错",
  },
  {
    name: "DJ 轮转保留最旧的行而不是最新的（台账变成\"最早发生的事\"）",
    file: "src/optimize-ledger.ts",
    from: "  const kept = lines.slice(-Math.max(1, target))",
    to: "  const kept = lines.slice(0, Math.max(1, target))",
    test: "test/optimize-ledger.mjs",
    expect: "保留的是最新那几行",
  },
  {
    name: "DK 台账开关的回落值改成关（默认不再记账）",
    file: "src/host.ts",
    from: "      const ledgerOn = readOwnFlag(optCtx, config, OPTIMIZER_LEDGER_FIELD, DEFAULT_SETTINGS.optimizerLedger)",
    to: "      const ledgerOn = readOwnFlag(optCtx, config, OPTIMIZER_LEDGER_FIELD, false)",
    test: "test/quick-commands.mjs",
    expect: "台账文件写出来了",
  },

]

let allBit = true
for (const item of cases) {
  if (item.skip === true) {
    console.log(`— 跳过（没有源码之外的断言）— ${item.name}`)
    continue
  }
  const original = readFileSync(item.file, 'utf8').replace(/\r\n/g, '\n')
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
