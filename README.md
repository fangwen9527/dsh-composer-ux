# dsh-composer-ux

> **English summary** — A DeepSeek Harness **Web** plugin that upgrades the composer (chat input) experience:
> configurable **send / newline keys**, a native-style **7-item right-click context menu**, a resizable &
> scrollable **settings panel with persisted size**, a **global on/off switch**, a **quick-command panel**
> (built-in prompts, click-to-insert, per-item "always append on send"), a **prompt optimizer** that runs a
> separate model call before you send, and automatic **`x-opencode-session` request-header injection** so
> OpenCode (Go) routes work inside DSH.
> Install with `dsh plugin --profile <name> add github:fangwen9527/dsh-composer-ux` — the built `lib/`
> ships in this repository, so there is **no build step and no build authorization**. License: MIT.

DeepSeek Harness Web 输入体验增强插件：

0. **全局开关**：设置页顶部「启用输入增强」总开关——关闭后键位、右键菜单、快捷指令、设置面板滚动/缩放全部停用（输入框恢复 DSH 原生行为），设置页保留用于一键恢复；开关状态持久保存。
1. **设置 → 输入体验**（设置页新增条目）
   - 版式对齐社区插件 `@linxin666/dsh-web-all` 的「Web 插件」页：顶部常显「中文名 + 内嵌英文包名 `dsh-composer-ux` 的一行描述 + 总开关」；其下五个栏目为**可折叠卡片**（标题行只放标题 + 一句动态概览，长说明与控件都在展开后的内容区），**默认全部折叠、不记忆展开状态**，可同时展开多个。
   - **键位**：分别配置「发送键」「换行键」——常用预设（Enter / Ctrl+Enter / Alt+Enter / Shift+Enter）+ 点击「自定义…」后直接按任意组合键录制（Esc 取消，Backspace 清除），支持清空为「无」；发送与换行不能设为相同按键；可一键恢复默认。
   - **右键菜单**：输入框右键菜单的 7 个条目（撤销 / 重做 / 剪切 / 复制 / 粘贴 / 删除 / 全选）可单独开关；可切换「使用系统原生菜单」（浏览器自带菜单，粘贴免授权）。
   - **快捷指令**：分类增删改 / 条目增删改与上下移 / 跨分类移动 / 每条一个插入模式（关 · 每次 · 仅首次）/ 优化强度三档（详见下节）。
   - **设置面板**：导航可滚动开关；边缘拖拽调整面板大小（尺寸记忆持久化）与尺寸预设。
   - **OpenCode 请求头**：给 OpenCode 的模型请求自动附加 `x-opencode-session`（详见下节）。
2. **快捷指令按钮**：输入框工具行里、「展开」按钮左侧的胶囊按钮，点开是常备提示词清单 + 「优化提示词」。
3. **键位生效**（仅主聊天输入框）：默认值 = 现状（Enter 发送、Shift+Enter 换行、Ctrl+Enter 加速提交），改动即时生效并持久保存。

## 安装

```sh
# 安装
dsh plugin --profile web add dsh-composer-ux

# 更新到最新版
dsh plugin --profile web update dsh-composer-ux
```

npm 包：[dsh-composer-ux](https://www.npmjs.com/package/dsh-composer-ux) —— 预构建产物，安装期不在本地执行任何代码，也不需要 pnpm 的构建授权。（`--profile web` 换成你自己的 profile 名即可。）

<details>
<summary>其它安装方式（GitHub 源码 / 锁定 commit / 本地目录）</summary>

```sh
# 从 GitHub 安装（等价；lib/ 构建产物已提交，没有 prepare 脚本，因此不需要 pnpm 的构建授权）
dsh plugin --profile web add github:fangwen9527/dsh-composer-ux

# 锁定 commit 安装（更安全：后续推送无法悄悄改变实际运行的内容）
dsh plugin --profile web add github:fangwen9527/dsh-composer-ux#<commit-sha>

# 本地目录 / 源码开发（等价于 link；改完 src/ 先跑 node build.mjs）
dsh plugin --profile web add <你克隆或解压出来的目录>
```

本插件按官方「[打包与安装插件](https://deepseek-harness.github.io/deepseek-harness/develop/basic/publish)」规范打包为可安装**组合包**（bundle）：`package.json` 声明 `dsh.bundle.patch → ./cordis.patch.yml`，该层以**包名**插入插件行 `dsh-composer-ux`，装进 profile 后由 pnpm/Node 从 `node_modules` 解析到 `lib/index.js`。

</details>

装完按 DSH 提示重启一次（Host 半的插件代码只在进程启动时 import），客户端半刷新页面即生效。

**发现渠道**：仓库已打官方发现用的 [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic（另带 `deepseek-harness` / `cordis` / `dsh` / `opencode` 等关键词）；社区目录（mydsh.dev、dshbase.com、dsplugin.app）按该 topic 自动同步收录。仓库里的 `cordis.patch.yml` 就是随包发布的组合层文件，`dsh.bundle.patch` 指向它即可。

从 DSH 源码检出直接 `--patch` 挂载的本地开发方式见下文「加载」一节。

## 键位规则

- 目标限定在 DSH Web 主聊天输入框（`[data-composer-input]`）；其他输入框不受影响。
- **IME 安全**：中文/日文输入法组合期间（`isComposing` / `keyCode 229`）一律放行，绝不误发、误换行。
- 发送/换行通过回放官方按键管线实现（发送 = 普通 Enter，换行 = Shift+Enter），因此所有官方保护均保留：忙时排队 / 油门（steer）、连发防重、空草稿不发送、`/` `@` 触发器菜单打开时 Enter 仍优先选择菜单项。
- 未绑定的 Enter 系按键（如把「发送」清空后按 Enter）不会触发任何动作；**Ctrl+Enter / ⌘+Enter 未被绑定时保留官方「加速提交」行为**（绑定为空闲草稿的队列推进等）。
- 单个字母/数字键不允许裸绑定（会与打字冲突）；纯修饰键不会触发录制。
- 部分 Ctrl/Meta 组合被浏览器占用（如 Ctrl+L、Ctrl+W、Ctrl+J），录制时无法在页面捕获——建议使用 Alt/Shift 组合或 Enter 系键位。

## 右键菜单

- 样式与系统编辑器菜单一致（深色圆角、三分组、快捷键右对齐）；未选中文本时「剪切 / 复制 / 删除」置灰；被关闭的条目不显示（分隔线自动合并）。
- 撤销 / 重做 / 剪切 / 复制 / 删除 / 全选 走标准编辑命令；**粘贴 读取剪贴板后在光标处插入纯文本**——这是浏览器的安全限制：首次使用可能出现一次授权提示，被拒绝或无响应时会提示「请用 Ctrl+V 粘贴」。
- 菜单打开时点击外部、Esc、滚动或窗口变化都会关闭。

## 快捷指令与提示词优化

输入框工具行里、「展开」按钮的左侧有一个同款胶囊按钮「快捷指令」（槽位 `conversation.input.right`，order 89 < 官方「展开」的 90）。点开展开面板：

- **快捷指令清单（分类两级结构）**：点条目把内容插入输入框（原有内容保留、另起一行）。面板顶部是分类标签（点它切换，`＋` 新增一个分类）；分类的改名 / 排序 / 删除，以及条目的增删改、上下移、恢复内置 9 条，都在 设置 → 输入体验 → 快捷指令清单 里。
- **插入模式（三选一，每条一个）**：「关」只插入不附加；「每次」在你**点发送时**（Enter 或官方发送按钮）自动拼到消息**末尾**一起发出；「仅首次」**只在这个会话的第一条消息**上附加。输入框里都不提前显示；多条按列表顺序拼接、条目间空一行。判定与「每次」一样**跨分类生效**（按条目 id 找，不限于当前分类），原文为空时不附加（交还官方原语义）。
  - 「仅首次」的判据是官方会话快照里的 `blank`（这个会话还没有任何消息）：发完第一条它自己就为 false，所以**不需要插件自己记状态**；刷新页面、切走再切回来都不会重复附加。
  - 两种模式**同时存在**时，新会话的第一条消息里**两批都附**：「每次」的那几条在前、「仅首次」的那几条在后，一起拼到末尾（第二条起就只剩「每次」的了）。
  - 为什么是一个三选一控件、而不是两个勾选框：「每次」与「仅首次」互斥，两个独立勾选框能造出「同时又每次又仅首次」的矛盾状态；三选一只发出一个 mode，由 `withInsertMode` 一次把两个标志写对。
  - 手工编辑文件时若把 `autoSend` 与 `autoSendFirst` 都写成 `true`，按「每次」处理（每次插入本来就包含第一次），并在下次写盘时修正回互斥状态。
- **优化提示词**：把输入框里的话交给**另一个 AI** 整理成一条能直接发给工作 AI 的清晰指令，结果**直接写回输入框**（Ctrl+Z 可还原）。三档强度：普通 / 高级（默认）/ 极端。

### 数据存在哪

快捷指令（分类 + 条目 + 每条的插入模式）存在 **`$DSH_HOME/quick-prompts.json`**（默认 `~/.dsh/quick-prompts.json`）：

- **与会话、项目无关**：换仓库、换会话都在；可以直接备份、搬迁、手工编辑（改完在设置页点「重新读取」）。
- 宿主半用「临时文件 → `fsync` → `rename`」**原子替换**，并用 `<file>.lock` 串行化写入；写到一半断电不会留下半截 JSON，并发保存也不会互相截断。
- 文件读不动（不是合法 JSON / 结构认不出 / 空文件）时，**先把坏文件改名隔离**成 `quick-prompts.json.bad-<时间戳>` 再如实报错，**绝不静默返回空列表**。这一条是刻意的：若回退成「读不懂就当空列表」，用户下一次保存就会把空列表写回去，**真数据被覆盖**。
- 文件字段名与 [lnyuqian/dsh-quick-prompts](https://github.com/lnyuqian/dsh-quick-prompts) 对齐（`categories` / `name` / `title` / `text` / `autoSend` / `order`），同一个文件两边都读得懂。⚠️ 但**不要同时装两个插件**——同一个文件两个写者会互相覆盖（对方还是非原子写）。
  - 「仅首次」是我们加的**扩展键** `autoSendFirst: true`（只在为真时写出来）。对方的插件会忽略它，并在它重新保存时丢掉这个键——也就是说「仅首次」在那边会退化成「关」。
- 0.2.x 存在设置文档里的那份旧列表会在**首次读取时自动迁移**成「默认」分类；旧值**保留在设置文档里不清空**，万一回滚到 0.2.x 还能看到自己那几条。
- 单条提示词上限从 4000 字提到 **20 万字**（只做防呆，不再截断正常提示词）；送去「优化」的原文仍限 8000 字（那是给模型的输入，不能跟着涨）。

### 为什么优化要走宿主的 HTTP 接口

出网请求由宿主的模型适配器发出，浏览器侧碰不到模型路由；宿主半与客户端半之间也没有别的受支持通道。所以「优化提示词」是一次往返：浏览器 `POST /composer-ux/optimize` → 宿主用 `ctx.get('llm').stream(...)` 独立跑一次模型调用 → 把优化后的正文回给浏览器填进输入框。这条路径与 [WestFox-AwA/dsh-prompt-optimizer](https://github.com/WestFox-AwA/dsh-prompt-optimizer) 同构，系统提示词也逐字提取自它（BSD-3-Clause，作者「啃轮胎的西狐」），落在 `src/optimizer-prompt.ts` 并保留署名。

优化用的模型**跟随你当前的默认模型**（`agentDefaultModel.currentSelection()`），不额外配置；每次优化会花一次模型调用，但**不占对话轮次、不进会话历史**。

### 「发送时附加」为什么不自造提交

Enter 那一路沿用既有的合成 Enter 回放；**官方发送按钮**那一路在捕获阶段认下点击、先把附加内容写回编辑器、再用同一个按钮重放一次点击。这样官方对「发送 / 排队 / 打断」的判定原样生效，本插件不做第二套提交语义。发送键与停止键共用同一个位置，靠图形区分——停止渲染 `<rect>`（方块），发送渲染 `<path>`（箭头），与界面文案、语言无关。

## OpenCode 请求头

OpenCode 的接口要求客户端在每次请求里带上一个稳定的会话 ID 请求头（官方 Go 文档「可以在哪里使用？」第 3 条：为每段对话在 `x-opencode-session` 中发送会话 ID，以便其优化路由与提示词缓存）。DSH 的 Models 设置页明确不提供请求头编辑器（源码注释与 `README.zh.md` 都写明 profile `headers` 属于部署配置），所以本插件把这一项代办了。

- **设置页位置**：设置 → 输入体验 → 「OpenCode 请求头」（折叠栏目）：开关 / 头名 / 值 / 作用路由，附一行宿主半回写的「状态」。
- **落点**：`llm-pi-ai` 的 provider profile —— `providers.<路由>.headers.<头名>`。这是 DSH 里唯一受支持的出网请求头入口：它作为 pi-ai 的 `optionsHeaders` **最后合并**（能覆盖默认头），且该适配器每次请求都重读配置，所以改完**下一次请求即生效**，不用重启、不用手工改 `settings.yaml`。
- **写入方式**：`settings.mutate` 的路径寻址——只动我们那一个键，绝不重述或删除你写在同一个 profile 里的其它字段（`models` / `apiKeyEnv` / 其它 headers 都不碰）。
- **目标路由怎么选**：profile 的 `models` 是必填项，凭空造一个只有 headers 的路由会让整份配置校验失败，所以只写**已存在**的路由。判据：
  - 「作用路由」**留空**时自动匹配——路由名以 `opencode` 开头（DSH 内置的 `opencode-go` 走这条，它的 baseURL 由 pi-ai 目录内置、配置里读不到），**或**该路由的 `baseURL` 主机是 `opencode.ai`（含子域）。后一条是为自建别名路由准备的：例如把 OpenCode 端点配成 `go: { baseURL: https://opencode.ai/zen/go/v1 }`，名字里没有 opencode 也能被认出来。
  - 「作用路由」**填了名单**时只看名单（逗号或空格分隔），且只保留其中确实存在的路由。
  - 判据只看主机名：`https://opencode.ai.evil.example/v1` 这类仿冒主机不会被匹配。
- **撤销**：关栏目开关、关插件总开关、或改头名，都会自动清掉此前写入的那一个键；并且只清「值等于当前配置值或记账值」的，用户自己手写的同名头不会被误删。
- **值**：所有对话共用同一个值（栏目里可改、可「重新生成」）；第一次启用若留空，会自动生成一个 UUID 并保存沿用。OpenCode 文档原话是要「每段对话」一个 ID——按会话变化的头 DSH 的配置层做不到（`llm/stream` 钩子被设计成只能读不能改，`GenerateOptions` 里没有 `headers` 字段），所以这里退一步用固定值。已知代价：所有对话挤同一个上游（没有负载分散）；单段对话内的缓存命中不受影响。另外它**不保证**缓存一定命中（还取决于上游模型与网关策略）。
- **自校验**：写入前用与 llm-pi-ai 相同的规则（`new Headers()`）校验头名与头值；非法值被拒绝，原因写进栏目的「状态」行，而不是把整条路由弄坏。
- **实测结论（本机验证过，不是推断）**：
  - **它是硬门槛，不是优化项。** 同一端点、同一模型，只把这条请求头去掉，OpenCode Go 直接返回 **HTTP 400 `MissingSessionID`**：*"Request is missing x-opencode-session and cannot be routed efficiently."* —— 没有它，DSH 里的 opencode-go 完全不可用。
  - **带着它时真实调用成功，且前缀缓存在工作**：同一段前缀连发两次，`input` 174 → 46、`cacheRead` 192 → 320（总前缀 366 不变），第二次有更多内容直接命中缓存。
  - **线级证据**：用 `test/opencode-header-wire-probe.mjs` 起一个本地端点，DSH 发过去的推理请求上确实带着 `x-opencode-session: <值>`，以及它自己的 `user-agent: deepseek-harness/0.1.5-rc.2 (+https://github.com/deepseek-ai/deepseek-harness)`（正好满足 OpenCode 文档对客户端标识的第 2 条要求）。

## 结构

仓库根目录（克隆或解压出来即是）：

```
dsh-composer-ux/
├── package.json                  # dsh.client 清单（platform: web）+ exports["./client"] + dsh.bundle.patch 清单
├── cordis.patch.yml              # 组合包层（随包发布）：按包名 dsh-composer-ux 插入插件行
├── cordis.dev.patch.yml          # 本地开发覆盖层（file:/// 绝对路径，已 gitignore，不随包发布）
├── CHANGELOG.md                  # 版本更新日志
├── build.mjs                     # esbuild 构建：lib/index.js（Host）+ lib/client.js（浏览器），并做发行后处理
├── src/
│   ├── host.ts                    # Host 半：注册 settings namespace + 把请求头镜像进 llm-pi-ai
│   ├── settings-contract.ts       # 字段/默认值/菜单元数据（零依赖共享）
│   ├── client.tsx                 # Browser 半：设置页 + 菜单浮层 + 拦截器
│   └── client/
│       ├── chords.ts              # 键位编码/录制校验
│       ├── interceptors.ts        # keydown/contextmenu 捕获拦截 + 回放
│       ├── SettingsSection.tsx    # 设置页「输入体验」（顶部常显 + 折叠栏目）
│       ├── settings-style.ts      # 折叠卡片样式表（dsh-ux-* 类名注入）
│       ├── ContextMenuHost.tsx    # shell.overlay 右键菜单
│       └── styles.ts              # --dsw-* 令牌内联样式
├── test/
│   ├── host-header-mirror.mjs          # 请求头镜像的行为测试（假 settings 驱动构建产物）
│   └── opencode-header-wire-probe.mjs  # 线级探针：本地端点，用来看 DSH 出网请求带了什么头
└── lib/                  # 构建产物（运行所需）
```

## 构建

```sh
node build.mjs                    # 产出 lib/index.js + lib/client.js
node test/host-header-mirror.mjs  # 宿主半行为测试（写入/撤销/改名/幂等/不误删）
# 线级探针（可选）：起一个本地端点，再把某条路由临时指过来，即可看到真实出网请求头
node test/opencode-header-wire-probe.mjs 8799 600000
# 若 DSH 源码检出不在默认路径：
$env:DSH_REPO_PATH='D:/DeepSeek Harness'; node build.mjs
```

## 加载（从 DSH 源码检出）

```sh
cd <你的 DeepSeek Harness 检出目录>
pnpm dsh web --patch <本仓库的绝对路径>/cordis.dev.patch.yml
```

把尖括号替换成你的真实路径；插件行的 `name` 必须是 `file:///` 形式的绝对 URL（Windows 下 `D:/...` 裸路径无法被 ESM loader 导入）。该文件只在本机存在（已 gitignore），内容如下：

```yaml
- insert:
    - id: composer-ux
      name: 'file:///<本仓库的绝对路径>/lib/index.js'
```

## 开发时热更新

- 改完 `src/` 后执行 `node build.mjs`；
- **Client 半**（`lib/client.js`）：客户端包在激活时读进内存，之后要靠 bundle 重新扫描（rev 变化）才会下发新内容；刷新浏览器即生效。
- **Host 半**（`lib/index.js`）：**必须重启 DSH 进程**。Cordis 加载器只在插件行的 `name` 变化时才重新 `import`（`vendor/loader/lib/index.js`），而 ESM 按 URL 缓存模块，改了文件内容不会失效——实测加临时探针并改动插件行 `name` 触发重载，探针都没有出现在启动日志里。所以：功能开关是随点随生效的，但**宿主半代码的更新要重启一次**。
- 加/删/改插件**行**本身（`cordis.patch.yml`）是 live 的（profile 的 `patchReload: live`），不用重启。

## 设置持久化

除快捷指令之外的设置存在 Host 用户设置文档（默认 `$DSH_HOME/settings.yaml`）的 `composer-ux` 分区，随工作区/机器生效；删除该分区即恢复这些设置的默认值。

快捷指令（分类 + 条目 + 插入模式）**不在**设置文档里，它存 `$DSH_HOME/quick-prompts.json`（见上「数据存在哪」）。设置文档里那份 `quickPrompts` 只是 0.2.x 的**迁移种子**：只在 `quick-prompts.json` **不存在**时被读一次（用来把旧列表搬成「默认」分类），平时不参与任何行为，插件也不会再写它。

- 确认不需要这份回滚兜底后，**可以从设置文档里手动删掉它**（连同 `quickPrompts:` 这一项）——不影响插件运行；之后若 JSON 丢失，只会回落到内置 9 条。删掉后它不会自己长回来。
- 想要**真备份**请复制 `quick-prompts.json`，不要指望这份种子：它是旧快照，不会随你的后续修改更新。

## 发行包与「装前体检」

插件市场的装前体检会扫描宿主代码里的混淆/动态执行特征（`eval` / `new Function` / 超长 base64 块）。本插件的 `lib/` 里这些特征**为零**：

- 内联的 schemastery 带有一条「字符串回调 → `new Function` 还原」的分支。本插件所有 schema 都传函数回调，从不使用字符串回调，因此 `build.mjs` 在打包后会把该分支替换为等价空实现；若将来依赖升级导致模式失配，构建会**直接报错退出**，不会悄悄带着 `new Function` 发行。
- 构建与测试命令见上文「构建」；`lib/` 为纯 JavaScript，安装时不需要执行任何构建脚本（因此**不需要 pnpm 的构建授权**，也不会在安装期于用户机器上执行代码）。

## 与官方版本兼容提示

- 依赖的稳定接口：`settings.section`、`shell.overlay` 槽位、`ctx.settingsScope`、`ctx.settings`（Host）、`[data-composer-input]` DOM 标记。
- 浏览器包外部依赖仅限平台种子词（react / react/jsx-runtime / react-dom / @deepseek-ai/cordis / dsh-client-store / ui-slots / ui-primitives），其余全部内联。
