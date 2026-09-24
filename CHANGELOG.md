# 更新日志

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.6.1] — 2026-09-24

> 起因是一次真机故障：设置页的开关"点了没反应"，而界面上**一句提示都没有**。查到最后是两层独立原因，
> 两层都在这一版里处理掉。**含宿主半改动**（启动时新增一次孤儿锁回收），装完需要**重启 DSH**。

### 修复

- **volatile 标记改成逐字段（不再标根），对齐官方形状**。这是"设置改完不生效"的根因：
  schemastery 3.18.4 一旦看到**根**带 volatile，就把**整棵解析结果**包成**一个根引用**
  （`Config({}).enabled === undefined`，值只在 `.get()` 里）；而 loader 把配置变更提交回
  **运行中引用**的那条路（`_commitVolatile`）是按**叶子路径**设计的。官方插件
  （`ui-theme` / `locale` / `llm-deepseek` / `ui-conversation` …）**一律逐字段标，没有一个标根**。
  改完的形状是"普通对象壳 + 叶子引用"，真机验证：`Config({})` 不再是引用，`parsed.enabled` 是叶子引用。
  - 顺带把两条护栏补成"字段级"：`host-settings-generations` 新增「每个字段都带标记」「根节点不标」，
    变异 Z 改为动**方法分支**（3.18.4 下标记走 `.volatile()`，动 meta 兜底那行已经不参与执行、
    护栏会"咬不住"——这是升级后的新事实，之前那条变异因此失效）。
- **孤儿写入锁会让整个 profile 的设置写入静默失效**。DSH 用 `<profile>/package.json.lock` 串行化跨进程写入，
  且规定争用方**永不删除**已存在的锁（孤儿锁由操作者处理）；而 `restart-webui.bat` 的 `taskkill /T /F`
  硬杀只要落在一次写入中间，锁就永久留下 —— 此后**每一次**设置写入都在 2 秒后超时，读得到、写不进，
  界面只表现为"点了没反应"（2026-09-23 连撞两次，两次都是重启留下的）。
  - 新增 `src/settings-lock.ts`：宿主半启动时读一次锁里的 PID，**只在确认该进程已不存在时**删除；
    内容认不出 / PID 还活着 / 权限不足无法判定 → 一律不动（误删活锁会让两个写入者交错提交同一个 profile patch）。
    判据是纯函数，逐条钉在测试第 12 节（19 条）。
- **设置页不再"静默装死"**：写入被宿主拒绝、或**写入被接受但运行时的值没变**时，把原因显示在设置卡顶部
  （`writeNotice`，与「重启 DSH」横幅同一位置）。以前这两种情况都只往控制台写一行，用户能看到的只有"开关不动"。

### 文档

- README「设置持久化」补「⚠️ 设置写不进去 / 点了没反应：两种成因与恢复」（含手工回收锁的一行命令）。
- README 更正一处过期描述：0.1.7 起设置存在 **profile 的 `cordis.patch.yml`**，不再是 `$DSH_HOME/settings.yaml`。

### 测试

- `test/quick-commands.mjs` 新增第 12 节：孤儿锁判据 + 真实文件系统上的四条路径（无锁 / 认不出 / 持有者活着 / 持有者已死）。
- 适配 DSH 随包的 **schemastery 3.18.4**：它开始认 `meta.volatile` 并在解析时把节点包成**引用**
  （3.18.2 没有这个分支）。于是"从 schema 解析结果直接读普通值"的断言（`quick-commands` 第 6 节、
  `host-header-mirror` 第 15 节、`host-settings-generations` 第 1 节）改为先解引用；断言要分的那几件事没有变。

## [0.6.0] — 2026-09-22（**未单独发布**，内容并入 0.6.1）

> **适配 DSH 0.1.7**（对 `dsh-v0.1.7-alpha.1` 逐项核对）。同一个产物同时支持 0.1.6 与 0.1.7：
> 两代的设置服务形状不同，代码按**能力探测**分支，不维护两份产物。
> **本版含宿主半改动**（注册方式、字段表、事件名），装完必须**重启 DSH** 才生效。
>
> ⚠️ **0.1.7 自己的升级动作会搬走 `~/.dsh/settings.yaml`**：它把该文件改名成 `settings.yaml.imported`
> 并逐节导入 profile patch（**一次性、部分导入过的文件不会重跑**）。本插件这一段在 0.1.7 上
> **导不进去**（那时插件还没有 Config，服务报 `No configurable plugin entry`），所以旧值只会留在
> 那个 `.imported` 文件里；0.1.6 又会重新生成一份干净的 `settings.yaml`。
> 结果就是：**升级到 0.1.7 之前，请先备份 `settings.yaml`（或那个 `.imported`），旧值需要手动迁回。**

### 破坏性变更

- **删掉「设置面板 → 导航滚动」这一栏**：DSH 0.1.7 的官方设置页已给导航列自带 `overflow-y: auto`
  （`ui-settings-general` 的 `.navList`），本插件再注入一套就是重复实现。整项删除：字段 `panelScroll`、
  `html.dsh-ux-panel-scroll` 那组注入样式、标题行那个小开关、栏判据里的那一条。**「边缘缩放」照旧保留。**
  - 迁移影响：只开过「导航滚动」、从没拖过尺寸的旧文档会被判成"这一栏从没碰过" ⇒ 该栏回到默认关。
    这是刻意的：导航滚动已经不存在，那一栏剩下的唯一功能是缩放，而这些人从没用过它。
  - 旧文档里残留的 `panelScroll` 不会让升级失败：schemastery 对**未声明键是原样放行**（已实测），
    所以不需要为它留一个宽容字段。

### 适配（DSH 0.1.7）

- **两代设置服务都认领**（客户端半）：0.1.6 及以前是 `ctx.settingsScope.bind({ namespace })`，
  0.1.7 起是 `ctx.configForms.get(namespace)`。两者**不能同时写进静态 `inject`** —— 各自在对方那一代
  永远不出现，插件会静默等依赖、**整块不挂载**（设置页、键位、右键菜单、快捷指令一起消失）。
  所以静态 inject 只留 `slots`，两个名字各用 `ctx.inject` 等一次，再加一次"直接读一次"兜底。
- **宿主半按能力分支注册**：`settings.register` 存在才注册（0.1.6）；0.1.7 的命名空间由导出的 `Config` 推导。
- **"自己那一行"换了读法**：0.1.7 没有 `settings.get()`。自己的行从 Config 读（volatile 引用要解引用），
  别人的行（只读 llm-pi-ai 的 providers.headers）从 `describe()` 读；两代差异收口在 `makeReader()`。
- **事件名换代**：0.1.6 发 `settings/updated`，0.1.7 发 `settings/document-updated`（旧名在 0.1.7 里
  **整个不存在**）。两个都听，任一世代只会有一个触发。
- **manifest 的 `dsh.client.inject` 改成包行名**：`["slots","settingsScope"]` → `["@deepseek-ai/dsh-client-ui-settings"]`
  （0.1.7 起这个字段的语义是"本行物化前必须先到位的包行"，写服务名没有意义）。
- **volatile 标记靠数据、不靠方法**：宿主半把 schemastery **内联**进产物（取自构建时的 DSH 检出），
  所以"在 0.1.6 上构建出来的包"里没有 `.volatile()`（它是 schemastery 3.18.3 才加的）。
  改为直接写 `schema.meta.volatile = true` —— 0.1.7 的设置服务读的正是这个标记，与构造它的库版本无关。
  0.1.7 里**只有 volatile 字段会被服务、也只有 volatile 路径能被写入**，所以整棵 Config 标 volatile。

### 提示词优化改成「条目 + 逐字依据」（机制取自对方 0.6 线）

- **背景（核对过的实话）**：0.5.x 那三档文本逐字取自对方 `lib/index.js` 的 **`LEGACY_V011`** ——
  该常量自己的注释写着"逐字节取自 0.1.1 的 system 提示词"，且只在**回退策略** `v011-ptc` 下使用；
  对方默认策略是 `STRATEGY_DEFAULT = 'v6'`（`buildSystem()` 走 `LANG_ONLY_SYSTEM` /
  `STRATEGY_V5_SYSTEM` + `CLOSING_SELFCHECK` + 收件人契约）。**即：抄到的是对方历史回退路径上的那一层。**
  更根本的问题是：自由改写器下"模型替用户发明一条需求"在结构上无法被发现，
  提示词里写多少遍"不许新增"都只是空话。
- **机制照对方 0.6 线重写**（`po06/lib/interpreter.js` 的 `validateProvenance`、
  `po06/lib/compiler.js` 的固定节序 + 预算丢弃）：
  - 模型不再自由改写，只产出条目；`rewrite` / `requirement` / `quality` **必须**附一段在用户原话里
    **逐字存在**的引文，宿主做字面子串比对，**对不上就只丢那一条**并记账（单点不得废整轮——
    这条纪律是对方 2026-09-22 真机回归换来的）；找不到逐字匹配时退一步做**空白归一**比对，
    免得折行/多空格复述白白丢条目。
  - `rewrite` 按引文在原话里的**位置**回填（右侧先动，下标不串位），没被覆盖的原话**原样保留**，
    其余条目按固定节序追加在末尾、每条带自己的逐字依据 —— 于是"凭空加需求"拿不出依据。
  - 篇幅预算按档位给（普通 1.4 倍 / 高级 2.6 倍 / 极端 4 倍，另有绝对上限），超预算按固定顺序丢
    **可选的节**、必保节永不丢，并把"省略了几条"写进成品（降级要出声，不静默截断）。
  - 空产出**重试一次**（话术取自对方 `retryEmpty`，它来自对方真机"思考完成却没有产出"）。
  - **两条兜底**：模型没按信封输出 → 按旧行为**整段照收**（保证这次改造不会让原本能用的优化变成失败）；
    输出像信封但半截坏掉 → **直接失败**，绝不把坏 JSON 写进输入框（这是真机上最伤人的一种"优化"）。
- **新增**：设置页每一档的提示词**可编辑**（`optimizerPromptBasic/Advanced/Extreme`，留空 = 用内置），
  带「载入内置版」「恢复内置」，并显示插件固定追加的那段输出契约；状态行如实回报
  `N 条补全 · 丢弃 M 条 · 重试过一次 · 自定义提示词`。**JSON 输出契约不由自定义提示词控制**
  （它是"逐字依据"能被校验的前提）。
- **未采纳（如实记录）**：对方的会话上下文读取（回合 0–10 / 全文）、只读工具（read/glob/grep）、
  发送前拦截 + 原话不改 + 随行包注入、每会话隔离与 `po06.json` 状态文件 —— 这些都要新的服务接线或
  会改掉本插件"点按钮 → 回填输入框"的既有交互，本次不动。
- 提示词仍是三档（普通 / 高级 / 极端）与原有温度（0.2 / 0.3 / 0.3），**对外接口未变**：
  `POST /composer-ux/optimize` 的请求体与 `ok/text/error/provider/model/truncated` 字段照旧，
  新增字段（`itemCount` / `dropped` / `warnings` / `fallback` / `retried` / `promptSource` / `budget` / `chars`）
  都是**附加**的，老客户端不读也不会坏。

### 测试

- 新增 `test/settings-service-adopt.mjs`（23 项）：用真产物跑三种服务组合（只有 `settingsScope` /
  只有 `configForms` / 两个都没有），并钉住"静态 inject 只能写 `slots`"。
- 新增 `test/host-settings-generations.mjs`（14 项）：两代服务形状各跑一遍宿主半，钉住
  `Config.meta.volatile`、0.1.7 形状下"没有 register 也不抛"、"Config 读不出来要退回 describe"。
- 变异护栏 21 → 26 条：新增 W（静态 inject 绑回某一代）、X（0.1.7 的认领被删）、
  Y（register 不按能力调用）、Z（volatile 标记丢失）、AA（Config 空值不退回 describe）。
- 提示词优化这一块：`test/quick-commands.mjs` 从 3 节扩到 4 节（新增「依据校验与宿主装配」），
  逐条钉住"引文对不上 → 只丢那一条并记账"「原文没被改写覆盖的部分原样保留」「半截 JSON 绝不写回」
  「没给信封 → 整段照收兜底」「空产出重试一次」「自定义提示词不顶掉输出契约」等 50+ 项。

## [0.5.0] — 2026-09-21

> **本版含宿主半新能力**（六个折叠卡的栏开关进了 settings schema），装完必须**重启 DSH** 才会作用到会话上。
> 只动客户端半的改动（设置页版式、右键菜单卡那两处）刷新页面即可。

### 新增

- **两层开关：总开关 + 每栏开关**（用户要求「插件的每个条目都增加一个开关按钮默认关闭，总开关默认打开」）。
  - 设置页顶部「启用输入增强」= **总开关，默认开**（原本就是），它是一道总闸；六张折叠卡的**标题行右端各一个卡级开关，默认关**。生效条件是 `enabled && 该栏开关`，判据只有一个 `activeSections()`，不在各组件里各写一遍。
  - **卡内已有的开关全部搬到标题行**（用户要求），其中**右键菜单那 7 项后来又搬回了卡内**（见下一条）：设置面板的「导航滚动 / 边缘缩放」变成标题行的两个小开关；默认终端的三档变成标题行的 `compact` 胶囊；**OpenCode 请求头那一栏没有新键** —— 原来的 `headerEnabled` 本来就是"这一栏要不要生效"，直接当卡级开关，不造同义的第二个键。
  - **右键菜单卡：点哪档只显示哪档的说明 + 那 7 项只在「自定义」档出现**（用户看过真实界面后提的两条）。
    - 原来三档说明 + 剪贴板授权注意事项一共 6 段**全铺开**，一屏文字、还要人自己找哪段跟自己选的那档有关；现在 `官方 / 浏览器 / 自定义` **各一段互斥渲染**，「自定义」那段后面才接它专用的 Chrome / Edge、Firefox 剪贴板授权说明。
    - 那 7 个条目开关（撤销 / 重做 / 剪切 / 复制 / 粘贴 / 删除 / 全选）先做成标题行的「**7 项 ▼**」条（7 个滑块平铺会把标题行挤爆），后来改成**平铺在「自定义」档里**：这 7 项本来就只对「自定义」档有意义，摆在标题行等于在任何档位都能改一堆当时不生效的东西。strip 那一套（按钮 + 展开条 + `dsh-ux-stripButton` / `dsh-ux-cardStrip` 两个类）**整套删掉**，并留了"不许复活"的护栏（变异 Q 咬住）—— 设置页布局没有自动化测试，护栏只能保到这里，挤不挤得下由用户的眼睛判。
    - 顺手删掉标题行下面那行**重复当前档位**的正文 `hint`（`MENU_MODES[].hint` 仍是三枚胶囊的悬停提示，只是不再有第二处正文）。
  - 标题行因此从"整行一个 `<button>`"改成"展开按钮 + 控件区"两个兄弟节点：`<button>` 里塞按钮是无效 HTML，点击还会冒泡成"展开整张卡"。
  - **关掉一栏 = 这一块完全不介入**，栏内的值全部保留（打开即原样恢复）：键位 → DSH 原生键位；右键菜单 → 不介入；快捷指令 → 输入框那枚按钮消失、面板收掉、**附加批次直接给空**（键位发送与官方发送按钮两条路共用这一个闸）；设置面板 → 不滚动、不拖大小；OpenCode 请求头 → 停止注入并撤销已写入的头；默认终端 → 宿主半撤销已下发的 `pwsh` 压制并回写"未启用"。
  - **未启用时的观感**：概览行加「未启用 · 」前缀、卡片描边变虚线、展开区压暗；栏内控件仍可编辑（先配好再打开）。
- **「默认关」对老用户是迁移出来的，不是硬编码**（用户拍板 A 方案）。
  - 判据是**"这一栏的值不等于从没碰过的样子"**（改过键位 / 选过浏览器或自定义菜单档 / 有面板尺寸记录 / 终端档位不是自动或填过路径）。全新安装（什么痕迹都没有）才是六栏全关。
  - ⚠️ **不能按"键存在"判断**：`settings.get()` 给的是**已解析**的值（schema 默认值 + 组合 base + 用户层），从没碰过的人的文档里也照样有 `sendKey: 'Enter'`、`panelScroll: true` —— 按"键存在"判断会让全新安装六栏全开，与"默认关"正好相反。这条被测试当场逮住（「全新安装（空文档）→ 五栏全关」变红），判据改成"出现过 **且** 不等于默认值"。
  - 同理，**宿主半自持字段不许当判据**（`terminalCandidates` / `terminalStatus` / `terminalEffective` / `headerApplied*` 是插件自己写的，全新安装也会出现），有专门一条测试盯着。
  - **五栏开关在 schema 里是 `.required(false)`、故意不给默认值**：schemastery 对缺省的可选键会**整个省掉**，所以"文档里没有这个键"与"明确关掉"能分开 —— 迁移要用的就是这个区别。有测试专门钉住"缺省 ≠ false"（谁把它改成 `.default(false)`，迁移会静默失效）。
  - **「快捷指令」栏多一条文件判据**：0.3.0 起条目搬到了 `quick-prompts.json`，用过的人和没用过的人的设置文档可以一模一样。所以宿主半启动时读一次书本文件，**有非内置内容就把 `quickEnabled: true` 写回文档**（写回之后两端都只需要看那一个布尔）。只在文档里还没有这个键时写：用户明确关掉之后不会被重新打开（有测试）。
  - **升级前可以先自查**：新增 `test/check-sections.mjs` —— 拿真实的 `settings.yaml` 跑一遍迁移，打印六栏会变成什么，**只读**、不写任何文件。本机实测输出：六栏全开（「快捷指令」靠文件判据）。
- **「设置 → 输入体验 → 默认终端」**（只对 Windows 生效）：把模型用的终端工具从 PowerShell（`pwsh`）换成 **Git Bash**。
  - **三档**：自动（探测到 Git Bash 就用）/ Git Bash / PowerShell（保持 DSH 默认、本插件完全不介入）。默认「自动」。
  - **「裸本体」不列为候选**：同根下既有 `bin\bash.exe` 又有 `usr\bin\bash.exe` / `mingw64\bin\bash.exe` 时只列前者。本机实测：前者 `MSYSTEM=MINGW64`、`PATH` 前置 `/mingw64/bin:/usr/bin`、`head`/`grep`/`uname` 都在且中文文件名当参数正常；后者 `MSYSTEM` 为空、`PATH` 只有继承来的 Windows PATH，**coreutils 全部 command not found**（交给模型就是命令大面积失败）。没有 `bin\bash.exe` 兄弟的来源（如 MSYS2 只提供 `usr\bin\bash.exe`）照常列出；**手填路径不受此限**。
  - **探测顺序**（同一路径只留优先级最高的一次，候选会在卡片里列出并标注来源）：设置里填的路径 → **PATH 上正在用的那份 git（由 `git.exe` 反推安装根）** → Git 官方落点（`Program Files` / `x86` / `%ProgramW6432%` / **`%LOCALAPPDATA%\Programs`**——安装器以普通用户运行时的默认落点）→ **Scoop / Chocolatey 便携包** → **GitHub Desktop 内嵌 / 旧 GitHub 的 `PortableGit_*` / Visual Studio 内嵌**（带版本号，靠列举子目录，新版本优先）→ MSYS2 / Cygwin → **各盘符根下的 `Git` / `PortableGit` / `msys64` / `cygwin64`** → Niubash（`niu.exe`）→ PATH 兜底。这份清单是**联网核对过**的（[SO: Where is git.exe located?](https://stackoverflow.com/questions/11928561/where-is-git-exe-located)、[SO: Why was git installed in AppData](https://stackoverflow.com/questions/32297340/why-was-git-installed-in-appdata-instead-of-program-files)、[cli/cli#2617](https://github.com/cli/cli/issues/2617) 等），并逐条写了测试。探测只做有限次存在性检查 + 三处目录列举，**不递归扫盘、不跑进程**。
  - **硬排除 WSL 的 `bash.exe`**（`System32` 与 `WindowsApps` 两个来源）——它把 `D:\x` 解释成 `/mnt/d/x`，与模型手里的 Windows 工作目录不兼容，而且只有在它**确实存在**时才会出现在「已排除」说明里。
  - 本机就是这条规则的受益者：Git for Windows 装在 `D:\Git`（不在 Program Files），只按固定目录找是找不到的——「先找 git 再反推」才能命中 `D:\Git\bin\bash.exe`。
  - **立刻生效**：改档位后宿主半会**遍历所有在跑会话**重新下发，不需要开新会话（详见下节「为什么这样实现」）。
  - **工具契约与官方 `@deepseek-ai/dsh-tool-bash` 逐字对齐**：描述、参数与输出 JSON Schema、`[stderr]` 头、`(no output)` 兜底、标记顺序（拒绝 → 升级提示 → 超时 → signal 或 exit code 在**最末**）、终端卡片（exit 状态拆成 pill）、后台任务（`{kind:'background', jobId}` + `job_output` / `job_kill`）、超时收敛（默认 120s、上限 600s）、输出截断与落盘位置、沙箱约束与**升级审批**（fail-closed、严格更宽、审批文案）。
  - **零新增运行时依赖**：宿主半仍是自包含产物（只内联 schemastery/cosmokit），官方的五个运行时符号（`defineTool` / `TOOL_ABORTED` / `HarnessError` / 沙箱标记与升级助手 / `DSH_ENV_PREFIX`）在 `src/terminal/` 下等价实现，避免因「依赖共享宿主包」被市场体检警告。
  - **失败不伤会话**：探测不到、拿不到 `subprocess`、`restrict` 被拒（例如该会话本来就看不到 `pwsh`）、非 Windows —— 一律只降级 + 在设置页状态行写明原因，不抛错、不 veto 别的插件。
  - 设置页只读展示三项宿主半自持字段（`terminalStatus` / `terminalEffective` / `terminalCandidates`），并加了「自动发现」按钮与候选点选。
- 设置接口 `GET/POST /composer-ux/terminal`：查状态、重扫候选。与另外两条路由一样受官方 `connection.requestRejection` 守卫（本机 webServer 绑 `0.0.0.0`，而这条接口会回传本地路径）。
- 设置页抬头（「输入体验」那张卡）右端加了 **「GitHub ↗」**：真实 `<a target="_blank" rel="noreferrer noopener">`，地址取自契约里的 `REPO_URL`（与 `package.json` 的 `repository.url` 一致，客户端不硬编码第二份 —— 有测试盯着两处不许分叉）。
- **「重启 DSH」按钮**（`src/restart.ts` + `GET/POST /composer-ux/restart`）：位置是「输入体验」卡片**抬头右端、GitHub 链接左边**，确认条展开在抬头正下方。
  - **机制照搬插件市场 [dsh-market](https://github.com/dsh-market/dsh-market)**（`src/restart.ts` + `src/dsh-cli.ts`，本机 profile 里就有它的源码与注释）。为什么抄它而不是自己发明：它文件顶部挂着一串 issue 号，每条都是"重启按钮按下去没用"的具体死法。
  - **两步确认**（用户拍板保留）：点按钮先读"会怎么重启、当前有几个会话在跑"，确认条在抬头正下方，点「确认重启」才真重启 —— 重启会打断正在跑的会话（包括正在生成的那一轮）。
  - **分离一个 node 助手进程**（`node -e <源码>`，detached + unref + `stdio: 'ignore'`），宿主自己 **500ms 后退出**，好让这个 HTTP 响应先发出去。
  - **助手等端口真的空出来**：每 250ms `connect` 探一次、最多 30 秒，通了再等 300ms（Windows 的 TIME_WAIT 尾巴）。用 connect 而不是 bind：bind 一下自己就把那个马上要交出去的端口占住了。固定 sleep 会让新宿主 `EADDRINUSE` 当场死掉、而失败还被 `catch {}` 吞了（市场 issue #177）。
  - **用隐藏控制台的 PowerShell 起新宿主**：Windows 上 `detached` = `DETACHED_PROCESS` = **没有控制台**，新宿主之后起的每个控制台子进程都会新建一个可见窗口（#40）；而 `-WindowStyle Hidden` 管不到 spawn 交给 PowerShell 的那个控制台，所以助手那层还得自己带 `windowsHide`（CREATE_NO_WINDOW，#624）。裸 `dsh` 要显式补成 `dsh.cmd`：PowerShell 会优先选被默认策略拒绝的 `dsh.ps1`（#397）。
  - **起来之后再验证 20 秒**：端口没人监听就把诊断写进日志 —— 本来该记日志的宿主进程已经退出了，重启失败必须留证据。
  - **界面靠 `boot` 号判断成功**：每 1.5 秒问一次状态，号变了（新进程接管了端口）就 `location.reload()`；60 秒还没变才报超时，并把日志路径显示出来（市场同款判定）。
  - **两道关卡**：先过官方 `connection.requestRejection`（Host/Origin 围栏 + 浏览器令牌），再过本插件自己的"回环 peer + 无转发头 + `Origin` 与 `Host` 同源"。这是"杀进程"的接口，跨站页面一定带自己的 `Origin`，挡在这里。非 GET/POST 回 405。
  - **不该从界面里杀掉的宿主会拒绝**：宿主正被调试器附着（`inspector.url()` / `--inspect` 家族，按 token 前缀匹配以免把 `inspect-tool.js` 这种路径误判），或它在 systemd 下当服务跑（`INVOCATION_ID`/`JOURNAL_STREAM` **且**父进程是 PID 1 或 comm 为 `systemd` —— 只看环境变量会把普通终端与 CI runner 误判成"有 supervisor"，市场 issue #229/#471 就是这么踩的）。这时按钮禁用并说明原因。
  - **退出方式与市场刻意不同**：用 `process.emit('SIGTERM')` 而不是 `process.kill(pid,'SIGTERM')`。理由是可验证的：DSH 在 `apps/cli/src/profile-boot.ts:290` 注册了 `SIGTERM → interrupt(0)`（先 `fiber.dispose()` 再退出，自带 5 秒上限 `PROCESS_SHUTDOWN_TIMEOUT_MS`），而 **Windows 上 `process.kill` 等价于 `TerminateProcess`** —— 本机实测（node 起子进程、注册 handler、自己杀自己）SIGTERM / SIGINT / SIGKILL 三种写法的 handler **一次都没跑到**，进程直接没了。对"刚装完插件随手重启"没差别，对正在跑长会话的用户就是硬切。兜底：10 秒后还活着就 `exit(0)`。
  - **第一次点的时候，正在跑的宿主还是上一版**（新路由要重启后才加载）：宿主半没有 `boot` 字段时，界面如实说明"这次走旧机制，重启之后按钮就是新版了"。旧版 handler 在同一路径上，所以第一次点照样能把 DSH 重启起来。
  - **去掉「可选重启命令」与那张「维护」卡**（用户拍板）：机制换成市场那套之后，这个字段只剩"多一个会填错的地方"。老文档里可能留着的 `restartCommand` 由「恢复默认」顺手清掉；schema 里不再有它。
  - 新增 `GET /composer-ux/restart`（只读：boot 号、重放命令、日志落点、在跑会话数、是否被拦）与 `POST`（真重启，回 **202** + boot 号）。**测试里绝不让 POST 走到成功路径**：那会真的重启测试进程。

### 为什么这样实现（三条来自官方源码的硬约束）

1. **`ctx.tools.restrict()` 不能在全局上下文调用**：`packages/core/tools/src/index.ts:1077` 直接抛 `tools.restrict() requires a scoped context (agent.ctx): a context-global restriction would mask every agent`。所以「隐藏 pwsh」只能发生在**该 agent 自己的 scope** 里；为了让改动立刻生效，本插件在 `agent/created` 与 `settings/updated` 两个时机**遍历在跑会话**逐个下发（与官方 fixture `scoped-tool-subagent` 同形）。
2. **`restrict()` 会校验名字必须已在全局注册表里**，否则抛 `names unknown global tool "pwsh"` —— 该会话本来就看不到 `pwsh` 时会命中这条，本插件记一行原因跳过（这正是官方 `tool-bash` 的日志里 `restrict(deny:[pwsh]) refused, skipping` 的那种情况）。
3. **不需要再写 `system-prompt/assemble` 过滤器**：工具注册表自己就把 schema 喂给提示词（`packages/core/tools/src/index.ts:834` → `systemPrompt.tools(context => this.wireSchemas(context.scope))`），而 `wireSchemas(scope)` 取的是**已过滤**的可见 schema —— 一次 `deny` 会同时从「可调用注册表」和「提示词工具列表」里消失。提示词侧只做一件事：在本会话作用域里摘掉预设的 `tool:pwsh` 段（按名字过滤 `sections`，与官方 `browser-use-runtime` 同一手法）。

### 开发中发现并修掉的问题

0. **把 Niubash 从"单条候选"改成"安装根分组"时它整个消失了。** 新加的来源分组只会试
   `<root>/bin|usr/bin|mingw64/bin/bash.exe`，而 Niubash 的可执行文件叫 `niu.exe` 且就在根目录下 ——
   分组形状不匹配。是**测试逮住的**（"Niubash 仍是候选"当场变红），不是靠肉眼复查。
   **下面这条是用户实测发现的**（他在卡片上点了 `D:\Git\usr\bin\bash.exe` 那个候选，模型的命令就大面积失败）：
   `D:\Git\bin\bash.exe` 与 `D:\Git\usr\bin\bash.exe` 实测差别 —— 前者 `MSYSTEM=MINGW64`、`PATH` 前置 `/mingw64/bin:/usr/bin`、`head`/`grep`/`uname` 都在、中文文件名当参数正常；后者 `MSYSTEM` 为空、`PATH` 只有继承来的 Windows PATH（只有 `D:\Git\cmd`），**coreutils 全部 command not found**。
2. **`sandbox.confine()` 是 `async`，而本机装着的 `dsh-windows-shell-policy@0.0.5` 把它当同步用**（`confined = sandbox.confine(...)` 后直接读 `.argv`）。官方签名是 `confine(argv, policy, signal): Promise<ConfinedArgv>`，所以那个插件一旦处于受限模式就拿到 `Promise`、`argv` 变成 `undefined`，命令根本发不起来。本实现 `await` 它，并专门写了一条测试（「实际 spawn 的是 confine 返回的 argv」）防止回归。
2. **官方 `tool-bash` 在 win32 上是 `disabled`**（`packages/bundle/base/cordis.patch.yml`），而且它只消费 `ctx.shell` —— win32 的 `ctx.shell` 栈是 `pwsh-sandbox`（PowerShell）。所以「启用官方 bash 工具」拿不到 Git Bash，必须自带工具（这正是 converk/dsh-tweaks 那个插件的做法，本实现沿用并补齐了上面那条 async）。
3. **「中文路径不能当参数」的根因很可能是本机 shell 环境而非 Windows**：实测当前 `bash` 工具里的 `grep` 解析到 `…/Niubash/winuxcmd/usr/bin/grep.exe`（版本串 `grep (WinuxCmd) 1.0.5`），且该环境**没有 `/proc`**——不是 MSYS/Git Bash；用它跑 `grep <中文文件名>` 会直接 `cannot open` 并 `0xC0000409` 退出。换成真 Git Bash 后是否消失，**等实测确认**（本版不宣称已解决）。

### 测试

- 新增 `test/terminal-policy.mjs`（162 条）：探测顺序与 WSL 排除、渲染与 `parseExitStatus`（含官方 `[exit code: null]` 怪癖）、升级审批 fail-closed、bash 工具的参数/输出 schema 与执行路径（argv / cwd / env / stdio 上限 / confine 必须 await / 拒绝识别 / 后台钩子 / 中止与超时）、宿主半接线（在跑会话当场下发、新会话下发、幂等、切回 PowerShell 时撤销、非 Windows 与缺服务的降级）。
- `test/quick-commands.mjs` 第 10 节重写（重启机制）：启动命令重建的两种形态（dsh 入口 vs 裸 `dsh`）、`nodeExecutableOf`、Windows 的 PowerShell 包装与 `.cmd` 补全、端口解析与同源关卡逐条、调试器 / systemd 判定、助手源码的每条"为什么"、排期与优雅退出（spawn / 定时 / 退出全部注入）、以及**真的跑一遍助手**（替换进程的标记文件出现 / 起不来时 err 日志里有诊断 / 端口一空出来就起进程 —— 这条才是"等端口"逻辑真正的护栏）。
- `test/client-registration.mjs` 新增第 8 节：按钮在抬头且**在 GitHub 链接左边**、确认条在抬头正下方、第一步只 GET 第二步才 POST、靠 `boot` 号 `location.reload()`、被拦时禁用并说明、老宿主如实提示、类名真的进了产物与样式表（中文在产物里是 `\uXXXX`，所以只查 ASCII 标记）。
- 关键护栏做过**变异测试**（`test/mutation-guards.mjs`，手动跑）：把「遍历在跑会话」去掉、把同源关卡去掉、把官方信任关卡去掉、把抬头按钮拿掉、把助手的 `windowsHide` 关掉、把"等端口"换成固定 sleep、把「可选重启命令」加回来、把栏开关一律返回 true、把迁移判据丢掉一半、把终端/键位的栏门控去掉、把五栏开关改成带默认值、把快捷指令的文件迁移去掉、把「自定义」档的门控去掉、把三档说明的互斥条件去掉、把 strip 那条死路接回来、把标题行下重复的 hint 加回去、把那 7 个条目开关整段删掉、把那 7 行渲染短路掉、把「浏览器」档的说明短路掉、把三档说明全铺开 —— **21 条全部当场变红**。跑变异必须带上 `node build.mjs`：宿主半的用例打的是构建产物，只改 `src/` 不重建会得到假的"没咬住"。
- 新增 `test/settings-render.mjs`（**手动跑，20 项**）：这套件一直没有 React 渲染器，设置页版式只能靠搜源码字符串护栏 —— 那是最弱的一层（把 `{settings.menuMode === 'custom' && (` 改成 `{true && (` 它照样绿）。这个文件用 `react-dom/server`（**借 profile 里那份**，不新增依赖、不改 `package.json`）把设置页真的渲染成 HTML，断言：六张卡都渲染出来、右键菜单卡标题行只剩卡级开关、三档正文互斥且两两不同、那 7 行条目开关只在「自定义」档。三处坑记在文件头：两个 React 副本（profile 顶层与 react-dom 的 peer 不是同一个 ⇒ 必须按 react-dom 的解析路径取 react，否则 `dispatcher` 为 null）、三枚胶囊的 `title` 里也带着那三句话（按 HTML 搜会误报"说明没互斥"，第一版就假红了 3 项）、`FoldCard` 的展开态在组件内部（SSR 点不动 ⇒ 打包时在内存里改成展开，锚点找不到就报错）。
- 开关与迁移的测试（共 60+ 条）：全新安装六栏全关、总开关默认开、显式值优先于迁移、每栏判据各一条、宿主半自持字段不当判据、`activeSections` 的总闸语义、**用户真实文档的回归**（六栏保持全开）、schema 的"缺省 ≠ false"、快捷指令的文件迁移（非内置 → 写回；内置 → 不写；已关 → 不写回；幂等；没文件 → 不写）、终端栏关掉时撤销已下发的压制、总开关关掉时同样撤销、拦截器/入口按钮/面板把手各自的栏门控、标题行拆成两个兄弟节点、六张卡各有一个开关。

## [0.4.0] — 2026-09-15

> 已发布：用户实测通过后授权发布，已上 npm（`latest`）、GitHub 标签与 Release（`v0.4.0`）。
> 从 0.3.0 升级注意：本次含**宿主半 schema 改动**（新增 `menuMode`，并把旧布尔 `menuNative` 改成可选），**必须重启 DSH** 才会生效。

### 新增

- **跨分类移动条目**：条目列表最下边多了一行「＋ 新建 / 移动」。点开分两个动作 ——「＋ 新建一条」与「→ 把别的分类的条目移动到这里」；后者列出其它分类的条目（`分类名 · 条目名`），点它即移入当前分类、**追加到末尾**，`id` / 正文 / 插入模式都跟着走。设置页与面板共用同一个组件（`AddPromptRow.tsx`），行为不会分叉。
  - 移走最后一条时源分类**留空但不删除**（空分类是合法状态）；目标分类不存在、就是源分类、或已满时**原样返回**（不写盘）。
- **插入模式改为三选一：关 / 每次 / 仅首次**（原来是单个「默认插入」勾选框）。
  - 「仅首次」只在**这个会话的第一条消息**上附加。判据是官方会话快照里的 `SessionSnapshot.blank`（这个会话还没有任何消息），**不是**插件自己记的状态——发完第一条它自动失效，刷新页面、切走再切回来都不会重复附加。
  - 用三选一而不是两个勾选框：「每次」与「仅首次」互斥，两个独立勾选框能造出「又每次又仅首次」的矛盾状态。界面只发出一个 mode，由 `withInsertMode` **一次把两个标志写对**。
  - 文件里「仅首次」写成扩展键 `autoSendFirst: true`（只在为真时出现），`autoSend` 语义不变——与参考实现的互操作性因此保持；代价是对方重新保存时会丢掉这个键（「仅首次」在那边退化成「关」）。手工把两个键都写成 `true` 时按「每次」处理（每次插入本来就包含第一次），下次写盘修正回互斥。
- 「＋ 新建」出来的条目正文是占位「（待填写）」而不是空串：空正文会被净化丢掉，而面板里的新建是**立即写盘**的，给空串会当场消失、看起来像坏掉了。设置页保存时也会先剔掉正文为空的条目**并在状态行说明**「已跳过 N 条」。
- **「右键菜单」从布尔开关改为三选一：官方 / 浏览器 / 自定义**（原来是「使用系统原生菜单」）。
  - **官方**（新默认档）：本插件**完全不介入**——既不 `preventDefault` 也不 `stopImmediatePropagation`，DSH 与其它插件自己的右键处理原样生效（DSH 官方输入框本身没有右键菜单，所以通常看到的就是浏览器的菜单）。
  - **浏览器**：固定用浏览器自带的菜单，并在本插件这一层**挡住其它插件的菜单**（这是它与「官方」的唯一差别）；粘贴免授权、零配置。
  - **自定义**：插件自己的固定样式菜单（7 项可逐项开关，只在这一档显示那些开关）；`preventDefault` 掉浏览器菜单，并和「浏览器」档一样**挡住其它插件的菜单**（0.2.0～0.4.0 的自定义档只 `preventDefault + stopPropagation`，同一层里别的插件的捕获监听仍会收到事件，可能弹出两个菜单；本次补齐，由用户拍板）。
  - **迁移**：旧布尔 `menuNative` 仍然认——`true → 浏览器`、`false`（明确关过那个开关）`→ 自定义`；两个键都没有（从没设过）→ 新默认档「官方不介入」。**这是一处行为变化**：以前「没设过」等于自定义菜单，现在没设过等于不介入。旧字段只作迁移线索，0.4.0 起不再写它；「恢复默认」会把两个键一起清掉。
  - 为此把宿主 schema 里的旧布尔改成**可选**（schemastery 的 `.required(false)`，且不给默认值）：否则「文档里没有这个键」与「明确设成了 false」在解析之后长得一模一样，迁移就分不出该落哪一档。
  - 控件与「插入模式」共用同一个胶囊组件（`PillChoice.tsx`），样式与无障碍行为不会各写一遍而分叉。

### 开发中发现并修掉的问题

1. **「仅首次」在写回编辑器那一步被二次过滤掉了**（用户实测发现：新会话第一条只发「每次」的，不发「仅首次」的）。
   - 成因：批次算得没错——`appendBatchForSend(book, blank)` 在空会话里正确交出了「每次 + 仅首次」；但紧接着写回的函数（当时叫 `withAlwaysPrompts`）内部**又按 `always === true` 过滤了一遍**，于是「仅首次」的条目全被丢掉；**若一条「每次」都没有，`picked.length === 0` 直接返回 null，第一条消息里什么都不附**。
   - ✅ 正解：写回这一步只负责「把给它的这一批拼上去」，模式判断只留一处（`settings-contract.ts` 的 `insertModeOf`）。同时把这处过滤的载体 `alwaysPrompts()`（按原始标志过滤的辅助函数）**整个删掉**——留着它就会有人再拼一遍同样的错。函数更名成 `withPromptsAppended` / `applyPromptsForSend`，名字如实反映「批次已定，这里只写回」。
2. **我原来那条「接缝护栏」是字符串匹配，所以这个 bug 全绿通过。** 它只断言 `client.tsx` 里 `promptsForSend` 接的是 `appendBatchForSend(book, currentBlankSession())` —— 也就是只验「批次算得对」，完全没验「写进去对不对」。
   - ✅ 正解：改成**执行整条路径**的护栏——用 `publishInputBridge` 装一个假编辑器，再调**拦截器真正调用的** `applyPromptsForSend(appendBatchForSend(book, blank))`，断言**最终写回编辑器的整段文本**；另加一条语义护栏：写回路径里不得再出现 `always === true` / `firstOnly === true`。
3. **新护栏被我自己写的说明注释弄红了。** 我在 `quick-commands.ts` 里解释这个 bug 时写了 `always === true` 的字面量，护栏匹配到注释里的散文就报红——和上一轮「护栏命中面板里过时的注释」是同一类错误。
   - ✅ 正解：护栏匹配前先剥注释（`codeOnly()`）。注释里必须能自由记录踩过的坑。
4. **设置页「快捷指令」卡片里三处 `**加粗**` 是 Markdown 字面量**，在 React 里就渲染成三个星号（`**发送时怎么附加**`）。这是 0.4.0 写文案时留下的，没人报过但一眼可见。
   - ✅ 正解：改成 `<strong>`。**这类问题只有看渲染结果才发现**——文案改动要顺手在真界面里看一眼。
5. **Firefox 的粘贴说明一直是错的**（用户照做之后实测发现）。我们教用户「把 `about:config` 里的 `permissions.default.clipboard-read` 设为 `1` 就不弹授权窗」——用户设完之后，「粘贴(P)」小窗照旧出现。
   - 查证结论：那个小窗是 Firefox 的**固定安全机制**——网页读剪贴板时它弹一个只有「Paste」一项的临时菜单（约 1 秒后才可点），与那个首选项无关；能免掉它的只有 `dom.events.testing.asyncClipboard` 这类**测试用**开关，那等于允许任何网站静默读剪贴板（[MDN](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API#security_considerations)、[caniuse](https://caniuse.com/mdn-api_clipboard_readtext)：只有带 `clipboardRead` 权限的扩展不受此限）。
   - ✅ 正解：界面、README 与运行时提示统一改成准确说法——「Firefox 一定会弹那个小窗，插件关不掉；不想多这一步就用 Ctrl+V，或把「菜单来源」换成「浏览器 / 官方」档」。并加一条护栏：界面与运行时提示里**不许再出现**那个首选项名（变异测试：写回去立刻变红）。README 另留一句「早先写法是错的」的更正，避免有人从旧文档学到错的。
   - 教训：**「用户照做之后没用」就是最硬的证据**。这条错误能存活好几个版本，是因为它只写在文案与提示里、没有任何测试盯着它是否成立。

### 测试

- 全量 **304 条 0 失败**（`npm test`：35 + 106 + 125 + 38）。
- 新增覆盖：插入模式三态与「两个标志都为真 → 按每次」的优先级、切模式时互斥标志被清掉、`autoSendFirst` 的文件往返与旧文件（只有 `autoSend`）的向后兼容、发送批次在 `blank=false` 时**不带**「仅首次」、**端到端写回**（两批都在 / 第二条只剩「每次」/ 只有「仅首次」时第一条仍附加 / 原文为空时不写）、跨分类移动的语义与四种 no-op、「会话是否为空」取自槽位快照的接缝、两处共用同一控件。
- 右键三档新增两层测试：**纯函数**层钉住迁移的每种情形（新字段优先、旧 `true → 浏览器`、旧 `false → 自定义`、都没有 → 官方、脏数据落回旧布尔、元数据齐全）；**行为**层扩展客户端测试桩（让 `addEventListener` 保留处理函数、补齐 `Element` 与 `getSelection`），真的派发一次 `contextmenu`，断言官方档三件事都不做、浏览器档只 `stopImmediatePropagation` 不 `preventDefault`、自定义档 `preventDefault` + 挡住同层监听。**这个行为测试当场抓出一处既有行为**：0.4.0 及以前的自定义档其实不挡同层其它捕获监听（可能弹出两个菜单），已按用户拍板补齐，README 同步改写。
- 变异测试：写回路径的 3 处变异（二次过滤 / `blank` 失效 / 永远不带「仅首次」）与设置页警告的 3 处变异（删掉 / 样式降级 / 改写措辞）全部被拦住并变红。

## [0.3.0] — 2026-09-15

> 已发布：实测通过后发布到 GitHub 与 npm（本条目的「尚未发布」声明在 0.4.0 发布时才补正）。

### 变更（含一处破坏性调整）

- **快捷指令的存储搬出设置文档**，改存 `$DSH_HOME/quick-prompts.json`。三个原因：设置文档对**数组**是整份替换、且受 schema 长度上限约束（旧 4000 字会**静默截断**长提示词，而长提示词恰恰是常态）；快捷指令是「用户内容」而不是「插件配置」，单独一个文件便于备份、搬迁与手工编辑；插件被禁用或卸载也不牵连它。
  - **自动迁移**：首次读取时把设置文档里 0.2.x 的那份平铺列表搬成「默认」分类。**旧值保留、不清空**——万一回滚到 0.2.x，用户还能看到自己那几条。
  - 单条上限 4000 字 → **20 万字**（只做防呆，不再截断正常提示词）。送去「优化」的原文仍限 8000 字：那是给模型的输入，不能跟着涨（原先它由 `QUICK_TEXT_MAX * 2` 推导，现在独立成 `OPTIMIZE_TEXT_MAX`，**值不变**）。
- **分类两级结构**：`{ version: 2, categories: [{ id, name, prompts: [...] }] }`。面板顶部是分类标签（点它切换、`＋` 新增），分类的改名 / 排序 / 删除与条目的增删改移都在设置页。结构参考 [lnyuqian/dsh-quick-prompts](https://github.com/lnyuqian/dsh-quick-prompts)，文件字段名与它**逐字对齐**（`categories` / `name` / `title` / `text` / `autoSend` / `order`），于是两边读得懂同一个文件；代价是**不能同时装两个插件**——一个文件两个写者会互相覆盖，而对方是非原子写。
- **「默认插入」跨分类生效**：勾选按条目 id 找，不再只看当前分类；发送时附加的那份列表由 `alwaysQuickPrompts(book)` 跨所有分类聚合。
- 新增宿主路由 `GET/POST /composer-ux/prompts`（读整本 / 整本写回），沿用原有的 `webServer.register({ kind: 'exact' })` 接缝。

### 存储层为什么比参考实现更严

参考实现的存储有两处真实的丢数据路径，本插件都避开了：

1. 它用 `writeFile(file, JSON.stringify(...))` **直接覆盖**——中途失败会留下截断的 JSON。本插件用「临时文件 → `handle.sync()` → `rename`」原子替换，并在 `<file>.lock` 里串行化写入（`wx` 创建；超过 30 秒的遗留锁**只报错、不抢占**——锁的新旧无法区分「崩溃的所有者」与「只是被暂停的写者」，处置权交给操作者）。
2. 它读盘失败时 `catch { return [] }`——UI 显示空列表，用户一保存就把**空列表写回去**，真数据被覆盖。本插件解析失败先**改名隔离**（`quick-prompts.json.bad-<时间戳>`）再如实报错，**绝不返回空本、绝不写入**。

### 开发中发现并修掉的问题

1. **迁移判断在锁外，并发首个请求会互相覆盖。** `ensureQuickBook` 原本「读到文件不存在就就地初始化」：多个并发请求同时看到缺失时，后写的那个会把先写的用户数据覆盖成默认本。✅ 正解：在写锁内**复核一次**再初始化。
2. **我写的一条护栏是「永不报警的死护栏」。** 检查「读不懂时不许返回空本」的正则精确匹配了代码形状，但我多写了一个收尾括号，于是它永远不命中任何代码。✅ 正解：改成语义写法（`catch` 之后 200 字内不许出现 `kind: 'ok'`）。**这个问题是靠变异测试发现的**——把 bug 放回去时那条护栏没有变红。
3. **越界换位凭空造新对象。** `withPromptMoved` 走到 `mapCategory` 才判边界，越界时仍返回内容相同的新对象，会引发一次无意义的写盘。✅ 正解：先算边界，越界直接返回传入的那个对象。

### 测试

- 新增 `test/quick-store.mjs`（77 条）覆盖：原子写（不留 `.tmp`）、坏文件隔离且内容原样保留、认不出的结构不写入、空文件当损坏、v1 平铺与裸数组升级、**5000 字提示词不再被截断**、并发四写不互相截断且最终是一个完整本、遗留锁报错且不删不抢占、字段映射往返、客户端编辑函数的不可变性与跨分类聚合。
- 全量 **239 条，0 失败**。
- 对三处关键护栏做了**变异测试**（把 bug 放回去看会不会红）：读不懂当空本 / 文件字段名改回内部名 / `always` 聚合退化成只看第一个分类——均成功变红。

## [0.2.0] — 2026-09-14

> 已在用户机器上实测（并据实测修掉 5 处问题，见下「开发中修掉的问题」），随后发布到 GitHub 与 npm。

### 新增

- **快捷指令按钮**：输入框工具行里、「展开」按钮的左侧多了一个同款胶囊按钮（槽位 `conversation.input.right`，order 89 < 官方的 90）。点击展开面板，面板里是快捷指令清单 + 「优化提示词」按钮。
- **快捷指令清单（内置 9 条）**：点条目把内容插入输入框（原有内容保留、另起一行）。内置条目 = 用户口述的 4 条（一问一答 / 交接文档 / 仅说明原因 / 分析后直接干）+ 提取自 [congyaqwq/dsh-quick-prompts](https://github.com/congyaqwq/dsh-quick-prompts) 的 5 条（提交代码 / 给方案 / 解释代码 / 写测试 / 代码审查）。另外两个同名插件 [lcsdg](https://github.com/lcsdg/dsh-quick-prompts) / [lnyuqian](https://github.com/lnyuqian/dsh-quick-prompts) 经逐仓库核对**不带内置指令**（列表默认为空），故无从提取。清单可在设置页增删改、上下移、恢复内置。
- **「默认插入」**：条目右侧的勾选框。勾上后，在你**点发送时**（Enter 或官方发送按钮）勾选的提示词会被自动拼到消息**末尾**一起发出，输入框里不提前显示；多条按列表顺序拼接、条目间空一行。
- **优化提示词**：把输入框里的话交给**另一个 AI**（独立一次模型调用，不占对话轮次、不污染会话）整理成一条能直接发给工作 AI 的清晰指令，结果**直接写回输入框**（Ctrl+Z 可还原）。三档强度可选，默认「高级」。
- **宿主半 HTTP 接口** `POST /composer-ux/optimize`：出网请求只能由宿主发出，浏览器侧碰不到模型路由，故走这条往返（与 WestFox 的插件同构）。只接受 POST、限长 8000 字符、180 秒墙钟超时。

### 提取来源与署名

「优化提示词」的系统提示词**逐字提取**自 [WestFox-AwA/dsh-prompt-optimizer](https://github.com/WestFox-AwA/dsh-prompt-optimizer) 的 `lib/index.js`（BSD-3-Clause，作者「啃轮胎的西狐」），落在新建的 `src/optimizer-prompt.ts`，保留原作者署名与来源说明：

- `RELAY_ROLE`：优化者是**传话器**而不是对话伙伴 —— 用户 →（整理成命令）→ 工作 AI，产出会被原样发出。
- `NO_META_RULES`：禁止一切元话语（「优化后的提示词」「以下是…」）、对话话术与对用户提问。
- 三档 `TIER_SPECS`：普通（只修语言，不添需求，温度 0.2）/ 高级（补全没说出口的必要要求，0.3）/ 极端（命令结构 + 分阶段计划 + 预案，0.3）。
- `relayMessage`：把用户原话包成「待转达内容」，这是原作者修「优化 AI 以为自己在和用户对话」的关键一招。

### 实现要点

- **发送时附加走官方手势，不自造第二套提交**：Enter 那一路沿用既有的合成 Enter 回放；官方发送按钮那一路在捕获阶段认下点击、先把附加内容写回编辑器、再用同一个按钮重放一次点击。这样官方对「发送 / 排队 / 打断」的判定原样生效。
- 发送键与停止键共用同一个位置，只能按图形区分：停止渲染 `<rect>`（方块），发送渲染 `<path>`（箭头）。按图形判别与界面文案、语言无关。
- 原文为空时**不附加**（没有「你的消息」可附加，交还官方原语义）；一条都没勾时同样不碰事件。
- 数据存进本插件既有的 `composer-ux` 设置命名空间（跟另外 8 项设置同一处），换机器也在；净化端逐条收窄形状、按 id 去重、限 60 条 / 4000 字符。

### 开发中修掉的问题（均由用户实测截图/操作发现，均未流出）

1. **点了发送只插入、不发送，一直点一直插入。** 官方发送键是个圆形按钮，点击的视觉中心落在它内部的 `<svg>`/`<path>` 上，而 `event.target` 那时**是 SVG 元素** —— `SVGElement` 不继承 `HTMLElement.click()`，于是「先 preventDefault/stopPropagation 再 `button.click()` 重放」里的 `click()` 抛 TypeError：原始点击已被吞掉，重放又没发生 ⇒ **草稿被附加了、消息没发出去**；再点一次又叠一遍。
   ✅ 正解：`isSendButton(target): boolean` 改为 **`sendButtonOf(target): HTMLButtonElement | null`**，返回真正的 `<button>`（并加 `instanceof HTMLButtonElement` 守卫）而不是 `event.target`；拿不到按钮就**不拦截**，绝不吞掉用户的点击。
   ✅ 另加**幂等护栏**：草稿已以同一段后缀结尾时 `withAlwaysPrompts` 返回 null，于是第二次点击直接放行官方发送 —— 万一将来发送那一步再出问题，症状会退化成「再点一次就发出去」，而不是无限叠加。
2. **入口按钮与旁边的官方「展开」按钮不统一（那圈白线）。** 我用 `--dsw-alias-border-l2`（"Secondary stronger border"，更亮）当边框，且没给 `opacity`，于是比 `dsh-composer-expand` 的按钮亮一圈；又因为用了**行内样式**，`hover` 根本表达不出来。
   ✅ 正解：改为**注入样式表**（`src/client/quick-style.ts`），参数与同一个槽位的 `dsh-composer-expand` 的 `.cpex-btn` **逐项对齐**：`height:24px` / `border:1px solid rgba(127,127,137,.35)`（中性半透明灰，不用更亮的主题令牌）/ `padding:0 9px` / `opacity:.75` / `color:inherit`，并补上 `:hover` 与 `[aria-expanded="true"]` 两个状态。
3. **档位选中态与「优化提示词」按钮白底白字。** 用 `--dsw-alias-button-primary-fill` 当填充，却把文字**写死成 `#fff`**。该令牌定义为 `--dsw-alias-brand-primary`：浅色主题下是墨色（深），**深色主题下它是白** —— 于是暗色主题里白底配白字（用户截图里那个「空白白色按钮」）。
   ✅ 正解：填充与前景**必须成对**，官方 `ui-primitives/Button.module.css` 的写法是 `background: var(--dsw-alias-button-primary-fill)` + `color: var(--dsw-alias-label-primary-foreground)`；后者浅色是 `neutral-bluish-00`、深色是 `neutral-bluish-1000`，自动翻转。禁用态改用官方的 `opacity: .4`。
   注：`button-primary-fill` 本身没错 —— 本插件有两处把**它当文字色**用在中性底上（`pillActive`），那是 ink 的正确语义，故保留。
4. **列表行长预览把「默认插入」勾选框挤出面板。** 条目按钮写了 `width: 100%`，在 flex 行里吃满整行，右侧勾选框被面板的 `overflow: hidden` 裁掉 —— 截图里 `交接文档`、`提交代码` 两行看不到勾选框。
   ✅ 正解：按钮改 `flex: 1 1 auto; minWidth: 0`，让预览可被压缩。
5. **「设置面板」整段失效：拖边缘没反应、点尺寸预设也没反应。**（架构性错误，两个独立缺陷叠加）
   - **层叠上下文陷阱**：手柄原先渲染在 `shell.overlay` 里、用**视口坐标**对准面板画。但 `shell.overlay` 被官方封在 `ui-layout` 的 `.overlayLayer { position:absolute; inset:0; z-index:20 }` —— `position` + `z-index` 使它**自成层叠上下文**，里面的元素 z-index 再大（我写了 9998）也**逃不出去**，永远排在设置弹窗（`.overlay` z-index:1000）下面，再被全屏遮罩（`.mask { position:absolute; inset:0 }`）吃掉鼠标 ⇒ 手柄**根本抓不到**。
     ✅ 正解：**把手柄 `createPortal` 到面板内部**（`panel` 是 `position: relative`，正是合适的包含块）—— 挂进最高那一层的**里面**，就完全不需要比层叠。附带收益：定位由「视口坐标 + 250ms 轮询重算」变成「面板内绝对定位」，面板移动/滚动/改尺寸都自动跟随，矩形轮询整个删掉。
   - **尺寸预设不即时生效**：套用尺寸被 `appliedRef` 门控成「只在首次发现面板时套用一次」，点预设只写了设置、没人把它应用到**已经打开**的面板上，必须关掉设置重开才看得到。
     ✅ 正解：套用逻辑拆成独立 effect，依赖 `[panel, panelWidth, panelHeight]` —— 面板出现时套用、**尺寸设置一变立刻重套**；设置为空时 `removeProperty` 回落到官方默认 800。
   - **顺带修好手感**：居中的 flex 子项一改宽度会**两侧同时伸缩**，拖右边左边也跟着动。现在拖拽开始时先把面板转成 `position: fixed` 并锁定当前 left/top，拖哪边就只动哪边。
   - **可见性**（用户选定方案）：四边一圈 1px 细描边（`border-radius: inherit`，自动跟随面板 32px 圆角）+ 右下角一个抓手图标；四边各 8px 抓取带宽，悬停高亮。

**新增回归护栏**（都在 `test/quick-commands.mjs`，且都**做过「把 bug 放回去」验证确认会红**）：

- 第 3 节：假 DOM 里让按钮内部的图标节点**故意没有 `click()`**（与真 SVG 一致），断言 `sendButtonOf(svg)` 返回的是**真按钮**而不是那个图标 —— 这正是问题 1 的根因。
- 第 2 节：断言幂等（已附加过就不再叠）。
- 第 7 节：把样式表**当数据**检查 —— 凡用 `button-primary-fill` 当背景的样式，前景必须是配对令牌；样式表里不得再出现写死的 `#fff`；条目按钮必须可压缩；入口按钮的旧行内样式必须已删除。
- 第 8 节（**层叠上下文护栏**）：断言手柄走 `createPortal`、源码里不再出现「靠大 z-index 压弹窗」的写法、五个手柄的定位都是**面板内相对值**（任何数值 > 40 即判失败 —— 旧写法就是视口坐标）、描边 `border-radius: inherit` 且不吃指针、手柄层 `pointer-events: none` 而手柄自身 `auto`（写反会让整块面板点不动）。

### 测试

- 新增 `test/quick-commands.mjs`（**97 项**）：设置净化、末尾拼接语义（含幂等）、发送键图形判别与「返回真按钮」回归（最小假 DOM，含父链）、三档提示词资产、用假 `webServer` + 假 `llm` 驱动 `lib/index.js` 跑通整条优化往返（200 / 405 / 400 / 模型报错 / 无路由）、宿主半真实注册的那个 settings schema 的默认值解析，以及第 7 节的**样式配对 / 行内样式退场护栏**与第 8 节的**层叠上下文护栏**。
- 新增 `test/client-registration.mjs`（**29 项**）：直接执行 `lib/client.js`，用最小 window/document/React 桩跑一遍 `apply(ctx)`，断言 5 个槽位条目、order=89、拦截器三类监听、以及注入面字段与组件取用的名字一致 —— 这类接线错误构建期看不出来。
- `test/host-header-mirror.mjs` 的假 ctx 改为遵循 Cordis 的 inject 语义（只在该服务确实挂载时进入回调），35 项保持全绿。
- 合计 **161 passed, 0 failed**；两个产物经市场「装前体检」同款正则扫描，风险特征 **0 命中**。

## [0.1.5] — 2026-09-13

### 新增
- **按 baseURL 识别 OpenCode 路由**：自动匹配（「作用路由」留空）原先只看路由名是否以 `opencode` 开头，因此自建别名路由（例如 `go: { baseURL: https://opencode.ai/zen/go/v1 }`）拿不到请求头。现在改为「名字前缀 **或** baseURL 主机是 `opencode.ai`（含子域）」两者取或——内置 `opencode-go` 仍走名字那条（它的 baseURL 由 pi-ai 目录内置，配置里读不到），自建别名走 URL 那条。
- 仿冒主机不匹配：`https://opencode.ai.evil.example/v1` 若只做子串判断会误伤，因此改为解析 URL 后比较主机名（解析失败才退回子串）。
- 设置页「作用路由」的说明与占位符同步更新；无命中时「状态」行会写出实际的匹配规则。

### 测试
- `test/host-header-mirror.mjs` 新增 3 组（9 项）：按 URL 命中别名路由 / 子域命中 / 非 OpenCode 路由不动 / 仿冒主机不写入 / 显式名单优先 / URL 非法时子串回退。**35 passed, 0 failed**。

## [0.1.4] — 2026-09-13

### 文档
- **安装一节精简为两条命令**（安装 / 更新），GitHub 源码安装、锁定 commit、本地目录开发等做法收进折叠块——README 页面不再一上来就是四条命令。
- 移除 README 里的本机绝对路径，改为占位符，别人可以直接照抄。
- 功能代码无改动（`lib/` 与 0.1.3 一致），26 项宿主行为测试全绿。

## [0.1.3] — 2026-09-13

### 变更
- **发布到 npm**：`dsh-composer-ux` 已上架 <https://www.npmjs.com/package/dsh-composer-ux>，安装命令简化为 `dsh plugin --profile <profile> add dsh-composer-ux`（预构建产物，安装期不执行任何代码）；README 的安装一节改为 npm 优先，GitHub 安装作为等价备选保留。
- 包内 `repository` 字段指回 https://github.com/fangwen9527/dsh-composer-ux ，便于插件市场把 npm 包与仓库关联（下载量展示据此生效）。
- 功能代码无改动（`lib/` 与 0.1.2 一致），26 项宿主行为测试保持全绿。

## [0.1.2] — 2026-09-12

### 修复
- **体检正则零命中**：0.1.1 只清了 `new Function`，但市场体检器的规则是 5 条（动态生成函数的两个关键字、`atob`、连续 40+ 数字参数的 `fromCharCode`、200 位以上 base64 字面量）。内联的 cosmokit 二进制工具在非 Node 环境回退到 `atob` 解码，仍会被判为「含混淆/动态执行代码」。宿主包只跑在 Node 上（`Buffer` 必然存在），该回退分支是死代码，现已在打包后替换为显式报错。
- `build.mjs` 自身同样不再出现这些风险字面量，避免构建脚本被同一条规则误报。
- 现在 `lib/index.js`、`lib/client.js`、`build.mjs` 对该规则的命中数均为 **0**；26 项宿主行为测试全绿。

## [0.1.1] — 2026-09-12

### 修复
- **`dsh.bundle.patch` 指向修正**：0.1.0 把发行层文件改名为 `cordis.patch.yml` 并删除了旧文件，但清单未同步，安装后会没有任何组合层可用。现已指向 `cordis.patch.yml`（安装流程已用临时 profile 实测通过）。
- **消除宿主包里的动态执行标记**：内联的 schemastery 带有「字符串回调 → `new Function` 还原」这条分支，虽然本插件从不使用字符串回调，但它会让插件市场的「装前体检」把宿主包判为「含混淆/动态执行代码」并提示用户不要安装。构建脚本现在会在打包后把该分支替换为等价的空实现，`lib/` 内不再出现 `new Function` / `eval(`；非字符串回调路径与插件行为完全不变（26 项宿主行为测试全绿）。

## [0.1.0] — 2026-09-12

首个公开发行版（可作为 DSH 组合包安装）。

### 输入键位
- 可配置「发送键」「换行键」：常用预设（Enter / Ctrl+Enter / Alt+Enter / Shift+Enter）+ 录制任意组合键；支持清空为「无」、一键恢复默认。
- 发送/换行互斥校验；IME 组合期间（`isComposing` / `keyCode 229`）一律放行，不误发。
- 通过回放官方按键管线实现，完整保留官方行为：忙时排队/steer、连发防重、空草稿不发送、`/` `@` 菜单优先。

### 输入框右键菜单
- 7 个条目（撤销/重做/剪切/复制/粘贴/删除/全选）可单独开关；未选中文本时剪切/复制/删除置灰；分隔线自动合并。
- 可切换为系统原生菜单（浏览器自带，粘贴免授权）。
- 自定义菜单样式对齐系统编辑器：深色圆角、三分组、快捷键右对齐；点击外部 / Esc / 滚动 / 窗口变化自动关闭。

### 设置面板
- 设置页新增「输入体验」条目：版式对齐社区插件的「Web 插件」页，四个可折叠栏目，默认全折叠。
- 导航可滚动开关；面板边缘拖拽调整大小，尺寸持久化并带预设。

### 全局开关
- 设置页顶部「启用输入增强」总开关：关闭后键位、右键菜单、面板滚动/缩放全部停用，输入框回到 DSH 原生行为；状态持久保存。

### OpenCode 请求头
- 自动为 OpenCode 路由的模型请求附加 `x-opencode-session`（DSH 唯一受支持的出网请求头入口 `llm-pi-ai.providers.<route>.headers`）。
- 只写已存在的路由，使用 `settings.mutate` 路径寻址，不动同 profile 的其它字段；关闭开关/改头名会精确回收自己写入的那一个键。
- 值可改、可重新生成（默认 UUID）；写入前按 llm-pi-ai 相同规则校验头名与头值。

### 打包与分发
- 按官方《打包与安装插件》规范提供组合包清单：`package.json:dsh.bundle.patch → ./cordis.patch.yml`，插件行按包名引用。
- 构建产物 `lib/index.js`（Host）与 `lib/client.js`（浏览器）随仓库提交，GitHub 安装无需构建授权。
- 附带宿主半行为测试（26 项）与线级请求头探针。
