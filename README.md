# dsh-composer-ux

> **English summary** — A DeepSeek Harness **Web** plugin that upgrades the composer (chat input) experience:
> configurable **send / newline keys**, a native-style **7-item right-click context menu**, a resizable &
> scrollable **settings panel with persisted size**, a **global on/off switch**, a **quick-command panel**
> (built-in prompts, click-to-insert, per-item "always append on send"), a **prompt optimizer** that runs a
> separate model call before you send, automatic **`x-opencode-session` request-header injection** so
> OpenCode (Go) routes work inside DSH, and — on Windows — a **default-terminal switch** that replaces the
> model's PowerShell tool with **Git Bash** (git-anchored discovery, WSL excluded, per-session tool-surface
> trim, official-identical sandbox/approval/timeout semantics), plus a **one-click "restart DSH"** button
> in the settings-card header (market-proven self-restart: detached node helper, port-release wait,
> hidden-console relaunch, same-origin fence, boot-id reload).
> Install with `dsh plugin --profile <name> add github:fangwen9527/dsh-composer-ux` — the built `lib/`
> ships in this repository, so there is **no build step and no build authorization**. License: MIT.

DeepSeek Harness Web 输入体验增强插件：

![设置页「输入体验」：顶部总开关 + 六张折叠卡，每张卡的标题行右端各有一个卡级开关](https://raw.githubusercontent.com/fangwen9527/dsh-composer-ux/v0.5.0/docs/settings-panel-0.5.0.png)

> 上图即 0.5.0 的设置页（六栏都开着）。注意标题行**只有卡级开关与从属控件** —— 右键菜单那 7 个条目开关已按实测反馈搬进卡内的「自定义」档（见第 0 条）。

0. **两层开关：总开关 + 每栏开关**。设置页顶部「启用输入增强」是**总开关（默认开）**，它是一道总闸；六张折叠卡的标题行右端各有一个**卡级开关（默认关）**，决定「这一栏要不要生效」。两处都满足才生效（`enabled && 该栏开关`）。
   - **兼容性**：同一个产物同时支持 **DSH 0.1.6 与 0.1.7**。两代的设置服务形状不同（`settingsScope.bind` → `configForms.get`、宿主 `settings.register` 被删除、事件名换代），代码按**能力探测**分支，不维护两份产物。
   - ⚠️ **升级 DSH 到 0.1.7 之前先备份 `~/.dsh/settings.yaml`**：0.1.7 的官方升级会把它改名成 `settings.yaml.imported` 并逐节导入 profile patch（一次性、不可逆），而本插件这一段在旧版上**导不进去**（那时还没有 Config 字段表），旧值只会留在那个 `.imported` 文件里。
   - **老用户不会被升级弄坏**：卡级开关的默认值不是硬编码的 `false`，而是按「设置文档里有没有『你在用』的痕迹」迁移 —— 碰过的栏保持开着、没碰过的才是关；全新安装（空白文档）才是六栏全关。「快捷指令」那一栏多一条文件判据（0.3.0 起条目存在 `quick-prompts.json`，设置文档里看不出来）。
   - **升级前可以先看一眼**：`node test/check-sections.mjs` 拿你真实的 `settings.yaml` 跑一遍迁移，打印六栏会变成什么（**只读**，不写任何文件）。
   - **关掉一栏 = 这一块完全不介入**，且栏内的值全部保留（打开即原样恢复）：键位关 → 输入框按 DSH 原生键位；右键菜单关 → 本插件不介入；快捷指令关 → 输入框那枚按钮消失；设置面板关 → 不拖大小；OpenCode 请求头关 → 停止注入并撤销已写入的头；默认终端关 → 保持 PowerShell。
   - 「OpenCode 请求头」那一栏**没有额外的开关**：原来的「附加请求头」本来就是「这一栏要不要生效」，直接搬到了标题行。
1. **设置 → 输入体验**（设置页新增条目）
   - 版式对齐社区插件 `@linxin666/dsh-web-all` 的「Web 插件」页：顶部常显「中文名 + 内嵌英文包名 `dsh-composer-ux` 的一行描述 + 总开关」；其下六个栏目为**可折叠卡片** —— 标题行左侧是「标题 + 一句动态概览 + 展开箭头」，右侧是**这一栏的开关与从属控件**（设置面板的缩放开关、默认终端的三档都在这里），长说明与其余控件在展开后的内容区；**默认全部折叠、不记忆展开状态**，可同时展开多个。标题行**只放卡级开关与从属控件**：右键菜单那 7 个条目开关按用户后来的反馈**搬回了卡内**（它们只对「自定义」档有意义，见下一条）。
   - **键位**：分别配置「发送键」「换行键」——常用预设（Enter / Ctrl+Enter / Alt+Enter / Shift+Enter）+ 点击「自定义…」后直接按任意组合键录制（Esc 取消，Backspace 清除），支持清空为「无」；发送与换行不能设为相同按键；可一键恢复默认。
   - **右键菜单**：三档「菜单来源」（官方不介入 / 浏览器菜单 / 自定义菜单，见下「右键菜单」一节）；卡内**只显示当前选中那一档的说明**（点官方看官方的、点浏览器看浏览器的、点自定义看自定义的；自定义档还带 Chrome / Edge 与 Firefox 的剪贴板授权说明）；那 7 个条目（撤销 / 重做 / 剪切 / 复制 / 粘贴 / 删除 / 全选）**只在「自定义」档显示**、逐个开关（旁边一个「全部开启」）。这三件事有**真渲染测试**盯着（`node test/settings-render.mjs`：把设置页渲染成 HTML，断言三档正文互斥、那 7 行只在自定义档、标题行没有第二个入口）。
   - **快捷指令**：分类增删改 / 条目增删改与上下移 / 跨分类移动 / 每条一个插入模式（关 · 每次 · 仅首次）/ 优化强度三档（详见下节）。
   - **设置面板**：边缘调整大小一个开关（标题行）；尺寸预设与拖拽说明在展开区。**导航列滚动由 DSH 官方的设置页自带**（0.1.7 起 `.navList` 就有 `overflow-y: auto`），所以 0.6.0 把「导航滚动」那个开关整项删掉了 —— 留着就是重复实现。
   - **OpenCode 请求头**：给 OpenCode 的模型请求自动附加 `x-opencode-session`（详见下节）。
   - **默认终端**：Windows 上把模型用的终端工具从 PowerShell 换成 Git Bash（三档在标题行；详见下节）。
   - **重启 DSH**：卡片抬头右端（GitHub 链接左边）那枚按钮，两步确认后原地重启（详见「维护：重启 DSH」）。
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

设置 → 输入体验 → 右键菜单 里是三选一的**菜单来源**（只影响右键，不影响键位与其它功能）：

- **官方**（默认）：本插件完全不介入，DSH 与其它插件自己的右键处理原样生效。DSH 官方输入框本身没有右键菜单，所以通常看到的就是浏览器的菜单。
- **浏览器**：固定使用浏览器自带的菜单（样子随浏览器而变），并在本插件这一层**挡住其它插件的菜单**；好处是**粘贴免授权、零配置**。
- **自定义**：使用本插件固定样式的菜单（未选中文本时「剪切 / 复制 / 删除」置灰）。这一档的「粘贴」要读剪贴板，浏览器会先要一次授权，三家处理不同：

| 浏览器 | 首次/之后 | 改或撤销授权 | 免掉弹窗的办法 |
| --- | --- | --- | --- |
| Chrome / Edge | 弹出后点「允许」即记住这个站点，之后不再问 | 地址栏最左的网站图标 → 网站设置（Edge 叫「此站点的权限」）→ 剪贴板；或 `chrome://settings/content/clipboard`（Edge 是 `edge://settings/content/clipboard`） | 不需要：允许一次即可 |
| Firefox | 每次点「粘贴」都会弹一个只有「粘贴(P)」一项的小窗（约 1 秒后才可点），点它才完成 | 无（没有站点授权面板） | **关不掉**：这是 Firefox 的安全机制，网页不允许静默读剪贴板。不想多这一步就按 Ctrl+V，或把「菜单来源」切成「浏览器 / 官方」档 |

> 0.4.0 实测更正：早先文档里教过「改 `about:config` 里某个剪贴板首选项就不弹窗」——**那是错的**，那个弹窗与任何首选项都无关（用户在 Firefox 上照做后弹窗照旧）。依据：[MDN Clipboard API 的安全说明](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API#security_considerations)（读到不允许的内容时，浏览器弹的临时菜单里只有一个 Paste 项、约 1 秒后才可点）、[caniuse](https://caniuse.com/mdn-api_clipboard_readtext)（只有带 `clipboardRead` 权限的扩展不显示粘贴提示）。能免掉它的设置都属于「允许任何网站静默读剪贴板」那一类，本插件不教、也不建议改。
>
> `chrome://` / `edge://` 这些地址**不能做成网页里的链接**（浏览器禁止页面跳转到内部协议），只能手输或复制粘贴到地址栏。被拒绝授权或无响应时，菜单里会提示「请用 Ctrl+V 粘贴」。

自定义档的细节：

- 样式与系统编辑器菜单一致（深色圆角、三分组、快捷键右对齐）；被关闭的条目不显示（分隔线自动合并）；只在这档下才显示那 7 个条目开关与「全部开启」。
- 撤销 / 重做 / 剪切 / 复制 / 删除 / 全选 走标准编辑命令；**粘贴 读取剪贴板后在光标处插入纯文本**——这是浏览器的安全限制。
- 菜单打开时点击外部、Esc、滚动或窗口变化都会关闭。
- 该档 `preventDefault` 掉浏览器菜单，并和「浏览器」档一样**挡住同一层里其它插件的捕获监听**（否则两边会各弹一个菜单）。

## 快捷指令与提示词优化

输入框工具行里、「展开」按钮的左侧有一个同款胶囊按钮「快捷指令」（槽位 `conversation.input.right`，order 89 < 官方「展开」的 90）。点开展开面板：

- **快捷指令清单（分类两级结构）**：点条目把内容插入输入框（原有内容保留、另起一行）。面板顶部是分类标签（点它切换，`＋` 新增一个分类）；分类的改名 / 排序 / 删除，以及条目的增删改、上下移、恢复内置 9 条，都在 设置 → 输入体验 → 快捷指令清单 里。
- **插入模式（三选一，每条一个）**：「关」只插入不附加；「每次」在你**点发送时**（Enter 或官方发送按钮）自动拼到消息**末尾**一起发出；「仅首次」**只在这个会话的第一条消息**上附加。输入框里都不提前显示；多条按列表顺序拼接、条目间空一行。判定与「每次」一样**跨分类生效**（按条目 id 找，不限于当前分类），原文为空时不附加（交还官方原语义）。
  - 「仅首次」的判据是官方会话快照里的 `blank`（这个会话还没有任何消息）：发完第一条它自己就为 false，所以**不需要插件自己记状态**；刷新页面、切走再切回来都不会重复附加。
  - 两种模式**同时存在**时，新会话的第一条消息里**两批都附**：「每次」的那几条在前、「仅首次」的那几条在后，一起拼到末尾（第二条起就只剩「每次」的了）。
  - 为什么是一个三选一控件、而不是两个勾选框：「每次」与「仅首次」互斥，两个独立勾选框能造出「同时又每次又仅首次」的矛盾状态；三选一只发出一个 mode，由 `withInsertMode` 一次把两个标志写对。
  - 手工编辑文件时若把 `autoSend` 与 `autoSendFirst` 都写成 `true`，按「每次」处理（每次插入本来就包含第一次），并在下次写盘时修正回互斥状态。
- **优化提示词**：把输入框里的话交给**另一个 AI** 整理成一条能直接发给工作 AI 的清晰指令，结果**直接写回输入框**（Ctrl+Z 可还原）。三档强度：普通 / 高级（默认）/ 极端。
  - **0.6.0 起它不再"自由改写"**：模型只产出**条目**，每条 `rewrite`/`requirement`/`quality` 必须附一段**在你原话里逐字存在**的引文；宿主逐条做字面比对，对不上就**只丢那一条**并记账。`rewrite` 按引文位置回填，没被覆盖的原话原样保留，其余条目按节追加在末尾。于是"替你发明一条你没说过的需求"在结构上做不到。
  - 三档的差别是**依据预算**：普通 = 只做语言层修复；高级 = 可以补"能指回原话某一句"的必要要求；极端 = 再加分阶段计划与预案。成品有篇幅预算（普通档 1.4 倍），超了就按固定顺序丢可选的节，并把"省略了几条"写进成品（绝不静默截断）。
  - 状态行会如实交代这一轮的结果：`N 条补全 · 丢弃 M 条 · 重试过一次 · 自定义提示词`；模型没按条目契约输出时走**整段照收**的兜底并标注 `未校验依据`（保证改造不会让原本能用的优化变成失败），输出像条目信封但半截坏掉时**直接失败**、绝不把坏 JSON 写进输入框。

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

出网请求由宿主的模型适配器发出，浏览器侧碰不到模型路由；宿主半与客户端半之间也没有别的受支持通道。所以「优化提示词」是一次往返：浏览器 `POST /composer-ux/optimize` → 宿主用 `ctx.get('llm').stream(...)` 独立跑一次模型调用 → 把装配好的正文回给浏览器填进输入框。这条路径与 [WestFox-AwA/dsh-prompt-optimizer](https://github.com/WestFox-AwA/dsh-prompt-optimizer) 同构。

**提示词的来历（如实写）**：0.5.x 那三档是逐字提取自它 0.5 线的 `lib/index.js`（BSD-3-Clause，作者「啃轮胎的西狐」）。0.6.0 起机制与提示词都改按它 **0.6 线**（`po06/lib/interpreter.js` 的 `SYSTEM_PROMPT` + `validateProvenance`、`po06/lib/compiler.js` 的固定节序与预算丢弃）**重写**，不再是逐字提取 —— 那些文件里没有现成可抄的"三档改写提示词"，能借的是机制本身：条目化产出、逐字引文、只丢单条、降级出声。落在 `src/optimizer-prompt.ts`（提示词）与 `src/optimizer-assemble.ts`（校验 + 装配）两个文件，署名与来源说明保留在各个文件头。

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

## 默认终端（Windows）

Windows 上 DSH 给模型的终端工具是 **PowerShell**（工具名 `pwsh`），而模型的训练语料里 bash 占绝对多数。这一栏把终端换成 **Git Bash**：模型看到的工具就叫 `bash`，`pwsh` 从它的工具列表里消失 —— 一个会话只面对一个终端工具。

- **设置页位置**：设置 → 输入体验 → 「默认终端」（折叠栏目）：档位 / Git Bash 路径 /「自动发现」/ 候选点选，附两行宿主半回写的只读状态（当前生效 shell、状态行）。
- **三档**：`自动`（探测到 Git Bash 就用，找不到就保持 PowerShell —— 默认，开箱即用）/ `Git Bash`（强制换，没探测到会回落并在状态行说明）/ `PowerShell`（保持 DSH 默认，本插件完全不介入终端）。
- **探测顺序**（同一路径只留优先级最高的那一次；多个候选会在卡片里列出来让你点，并标注来源）：
  1. 你在设置里填的路径；
  2. **PATH 上正在用的那份 git**（由 `git.exe` 反推同一个安装根 —— 本机就是这样命中 `D:\Git` 的）；
  3. Git 的官方落点：`Program Files\Git`、`Program Files (x86)\Git`、`%ProgramW6432%\Git`、`%LOCALAPPDATA%\Programs\Git`（**安装器以普通用户身份运行时默认落这里**，以管理员运行才落 Program Files）；
  4. **Scoop**（`%SCOOP%\apps\git\current`）与 **Chocolatey 便携包**（`…\chocolatey\lib\git.portable\tools`）；
  5. **GitHub Desktop 内嵌**（`%LOCALAPPDATA%\GitHubDesktop\app-*\resources\app\git`）、**旧 GitHub for Windows 的 PortableGit**（`%LOCALAPPDATA%\GitHub\PortableGit_*`）、**Visual Studio 内嵌**（`…\Microsoft Visual Studio\<年份>\<版本>\Common7\IDE\…\Team Explorer\Git`）—— 这三处带版本号，靠"列一眼子目录"枚举（新的排前面）；
  6. MSYS2（`C:\msys64\usr\bin`）、Cygwin（`C:\cygwin64\bin`）；
  7. **各盘符根下的 `Git` / `PortableGit` / `msys64` / `cygwin64`**（覆盖装在 `D:\Git`、`D:\PortableGit`、自己解压到任意盘的情况）；
  8. Niubash（`%LOCALAPPDATA%\Programs\Niubash\niu.exe`）；
  9. PATH 兜底（**这里的 `bash.exe` 很可能就是 WSL 的启动器**，见下条）。
- **为什么不"扫全盘"**：探测只做有限次存在性检查 + 极少数目录列举（带版本号的那三处），全程不递归遍历、不跑进程，因此没有"装完卡几秒"这种代价。找不到就如实说找不到，由你手填路径。
- **"裸本体"不列为候选**：同一个 Git 安装根下如果既有 `bin\bash.exe` 又有 `usr\bin\bash.exe`（或 `mingw64\bin\bash.exe`），**只列前者**。本机实测两者的差别：前者会给出 `MSYSTEM=MINGW64`、把 `PATH` 前置成 `/mingw64/bin:/usr/bin`，于是 `head` / `grep` / `uname` 都在、中文文件名当参数也正常；后者 `MSYSTEM` 为空、`PATH` 只有继承来的 Windows PATH（里面只有 `D:\Git\cmd`），**coreutils 全部 command not found** —— 交给模型就是命令大面积失败。没有 `bin\bash.exe` 兄弟的来源（例如 MSYS2 只提供 `usr\bin\bash.exe`）照常列出；**你自己手填的路径不受这条限制**（那是你的选择）。
- **为什么「先找 git」**：Git for Windows 不一定装在 `Program Files`（本机就在 `D:\Git`）。只按固定目录找会一边找不到、一边退到 PATH，而 Windows 上 PATH 里的 `bash.exe` 很可能就是 **WSL 的启动器**。
- **WSL 被硬排除**：`C:\Windows\System32\bash.exe` 与 `…\Microsoft\WindowsApps\bash.exe` 一律不用 —— 它把 `D:\x` 解释成 `/mnt/d/x`，与模型手里的 Windows 路径、工作目录、`%TEMP%` 全都不兼容。只有在它确实存在时，卡片的状态行才会提一句「已排除 N 个 WSL 的 bash.exe」，不会在没装 WSL 的机器上凭空报警。
- **改完立刻生效**：宿主半会在 `agent/created`（新会话）与设置变更时**遍历所有在跑会话**重新下发，不需要开新会话；切回 PowerShell 会把之前下发的限制**撤销**。
- **与官方终端逐字对齐的行为**：工具描述、参数与输出 JSON Schema、`[stderr]` 分段、`(no output)` 兜底、标记顺序（沙箱拒绝 → 升级提示 → 超时 → `[killed by signal: X]` **或** `[exit code: N]` 在最末）、终端卡片（exit 状态拆成 pill，可点开看命令 / cwd / 输出）、后台任务（`run_in_background` + `job_output` / `job_kill`）、超时（默认 120s、上限 600s）、输出截断并把完整输出落盘、沙箱约束与 `sandbox_permissions` 升级审批。非零退出**不是错误**，只是末尾一个标记。
- **失败不伤会话**：探测不到 bash、宿主没有 `subprocess`、某个会话本来就看不到 `pwsh`（此时官方 `restrict` 会拒绝）、非 Windows —— 一律只降级并在状态行写明原因，不抛错、不 veto 别的插件、不影响会话本身。
- **一个诚实的副作用**：会话内工具面会随档位变化，而**会话历史里可能还留着旧工具名**。如果模型按旧名字调用，会拿到 unknown tool 之类的错 —— 让它换成 `bash` 重试即可（卡片上也写了这句）。
- **非 Windows**：直接不接管（官方 bash 工具本来就在），卡片显示一行说明。

## 维护：重启 DSH

装了新插件、改了宿主半代码（比如本插件的「默认终端」、键位 schema）之后，DSH 需要重启才会加载新代码。设置页「输入体验」卡片**抬头右端**（GitHub 链接左边）有一枚「重启 DSH」。

机制照搬插件市场 [dsh-market](https://github.com/dsh-market/dsh-market)（它的 `src/restart.ts` 里挂着一串 issue 号，每条都是"重启按钮按下去没用"的具体死法）：

1. **两步确认**：点按钮先问宿主半"会怎么重启、当前有几个会话在跑"，确认条出现在抬头正下方，点「确认重启」才真重启 —— 重启会打断正在跑的会话（包括正在生成的那一轮）。
2. **分离一个 node 助手进程**（`node -e <源码>`，detached + unref），宿主自己 500ms 后退出（延迟是为了让这个 HTTP 响应先发出去）。
3. **助手等端口真的空出来**：每 250ms `connect` 探一次，最多 30 秒，通了再等 300ms（Windows 的 TIME_WAIT 尾巴）。固定 sleep 会让新宿主 `EADDRINUSE` 当场死掉。
4. **用隐藏控制台的 PowerShell 起新宿主**：Windows 上 `detached` = `DETACHED_PROCESS` = 没有控制台，新宿主之后起的每个控制台子进程都会弹一个黑窗口；`powershell -NoProfile -WindowStyle Hidden` 给它一个隐藏控制台，助手那层再带 `windowsHide`。
5. **起来之后再验证 20 秒**：端口没人监听就把诊断写进日志 —— 本来该记日志的宿主进程已经退出了，重启失败必须留证据。
6. **界面靠 `boot` 号判断成功**：每 1.5 秒问一次状态，号变了（说明新进程接管了端口）就 `location.reload()`；60 秒还没变才报超时，并把日志路径告诉你。

其它几点：

- **日志**：助手写 `<系统临时目录>/composer-ux-restart-<时间戳>.out.log|err.log`（失败时界面会把路径显示出来）。
- **两道关卡**：先过官方 `connection.requestRejection`（Host/Origin 围栏 + 浏览器令牌），再过本插件自己的"回环 peer + 无转发头 + `Origin` 与 `Host` 同源"——这是"杀进程"的接口，跨站页面一定带自己的 `Origin`，挡在这里。
- **不该从界面里杀掉的宿主会拒绝**：宿主正被调试器附着（`--inspect` / `inspector.url()`），或者它在 systemd 下当服务跑（重启权归 supervisor，自己重启会把 cgroup 里的接管进程一起收掉）。这时按钮禁用并说明原因。
- **退出走 `process.emit('SIGTERM')` 而不是 `process.kill(pid,'SIGTERM')`**：DSH 在 `apps/cli/src/profile-boot.ts` 注册了 SIGTERM handler（先 `fiber.dispose()` 再退出，自带 5 秒上限）。而 Windows 上 `process.kill` 等价于 `TerminateProcess` —— 本机实测 handler 一次都跑不到。兜底：10 秒后还活着就 `exit(0)`。
- **第一次点的时候，正在跑的宿主还是上一版**（新路由要重启后才加载）：界面会如实说明"这次走旧机制，重启之后按钮就是新版了"。
- 为什么 DSH 需要插件自己干这件事：官方没有重启宿主的机制（插件市场那边只提示「更改将在下次启动生效」），所以这件事只能由插件做。

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
│   ├── host.ts                    # Host 半：注册 settings namespace + 请求头镜像 + 「默认终端」+ 「重启 DSH」路由
│   ├── settings-contract.ts       # 字段/默认值/菜单元数据 + 栏开关的迁移判据（零依赖共享）
│   ├── restart.ts                 # 「重启 DSH」：助手进程/等端口/隐藏控制台/信任关卡/优雅退出（零 import）
│   ├── client.tsx                 # Browser 半：设置页 + 菜单浮层 + 拦截器
│   ├── terminal/                  # 「默认终端」（Windows：pwsh → Git Bash），全部零官方运行时依赖
│   │   ├── discover.ts            # 探测：git 锚定反推 bash、硬排除 WSL、多候选排序（纯函数）
│   │   ├── render.ts              # 结果渲染与 exit 状态解析（与官方逐字对齐）
│   │   ├── sandbox.ts             # 沙箱策略面 + 升级审批（fail-closed，与官方同语义）
│   │   ├── tool.ts                # bash 工具定义：schema / 执行 / 后台 / 中止 / 终端卡片
│   │   ├── contracts.ts           # 字段、三档、候选净化、生效判定、状态行文案（纯函数）
│   │   └── host.ts                # 宿主半接线：按会话下发 restrict+register+section、立刻覆盖在跑会话
│   └── client/
│       ├── chords.ts              # 键位编码/录制校验
│       ├── interceptors.ts        # keydown/contextmenu 捕获拦截 + 回放
│       ├── SettingsSection.tsx    # 设置页「输入体验」（顶部常显 + 折叠栏目 + 默认终端卡片）
│       ├── settings-style.ts      # 折叠卡片样式表（dsh-ux-* 类名注入）
│       ├── ContextMenuHost.tsx    # shell.overlay 右键菜单
│       └── styles.ts              # --dsw-* 令牌内联样式
├── docs/settings-panel-0.5.0.png  # README 顶部那张设置页截图（用 tag 固定的 raw 链接引用，不进 npm 包）
├── test/
│   ├── host-header-mirror.mjs          # 请求头镜像的行为测试（假 settings 驱动构建产物）
│   ├── host-settings-generations.mjs   # 宿主半两代设置服务（0.1.6 的 get/register 与 0.1.7 的 describe）
│   ├── quick-commands.mjs              # 快捷指令 / 优化接口 / 路由注册 / 重启机制
│   ├── quick-store.mjs                 # 快捷指令文件存储与写回路径
│   ├── terminal-policy.mjs             # 默认终端：探测 / 渲染 / 升级审批 / bash 工具 / 宿主半接线
│   ├── client-registration.mjs         # 客户端注册协议、右键行为、抬头按钮、六栏开关与标题行布局
│   ├── settings-service-adopt.mjs      # 客户端两代设置服务认领（settingsScope / configForms / 都没有）
│   ├── mutation-guards.mjs             # 变异测试（手动跑）：把每条护栏拆掉，测试必须变红（26 条）
│   ├── settings-render.mjs             # 真渲染测试（手动跑）：借 profile 的 react 把设置页渲染成 HTML
│   ├── check-sections.mjs              # 升级前自查（只读）：拿真实 settings.yaml 跑一遍栏开关迁移
│   └── opencode-header-wire-probe.mjs  # 线级探针：本地端点，用来看 DSH 出网请求带了什么头
└── lib/                  # 构建产物（运行所需）
```

## 构建

```sh
node build.mjs                    # 产出 lib/index.js + lib/client.js
npm test                          # 七个套件；当前 669 passed, 0 failed
node test/mutation-guards.mjs     # 手动跑：变异测试，证明那套护栏真的在咬人
node test/settings-render.mjs     # 手动跑：把设置页真渲染成 HTML，断言版式与互斥显示（20 项）
node test/check-sections.mjs      # 只读：升级前看六栏会变成什么
node test/host-header-mirror.mjs  # 只跑宿主半的请求头测试（写入/撤销/改名/幂等/不误删）
node test/host-settings-generations.mjs  # 只跑宿主半的「两代设置服务」兼容（0.1.6 / 0.1.7 形状）
node test/terminal-policy.mjs     # 只跑「默认终端」（探测 / 渲染 / 审批 / 工具 / 接线）
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

除快捷指令之外的设置存在 **profile 的 `cordis.patch.yml`** 里本插件那一行（`$DSH_HOME/profiles/<profile>/cordis.patch.yml` 的 `- id: composer-ux` → `config`）——0.1.7 起上游已废弃 `$DSH_HOME/settings.yaml`（它被改名成 `settings.yaml.imported` 后一次性导入）；0.1.6 及以前才是 `settings.yaml` 的 `composer-ux` 分区。删掉那一项即恢复这些设置的默认值。

快捷指令（分类 + 条目 + 插入模式）**不在**设置文档里，它存 `$DSH_HOME/quick-prompts.json`（见上「数据存在哪」）。设置文档里那份 `quickPrompts` 只是 0.2.x 的**迁移种子**：只在 `quick-prompts.json` **不存在**时被读一次（用来把旧列表搬成「默认」分类），平时不参与任何行为，插件也不会再写它。

- 确认不需要这份回滚兜底后，**可以从设置文档里手动删掉它**（连同 `quickPrompts:` 这一项）——不影响插件运行；之后若 JSON 丢失，只会回落到内置 9 条。删掉后它不会自己长回来。
- 想要**真备份**请复制 `quick-prompts.json`，不要指望这份种子：它是旧快照，不会随你的后续修改更新。

### ⚠️ 设置写不进去 / 点了没反应：两种成因与恢复

**第一层：写入锁成了孤儿锁。** DSH 用 `<profile>/package.json.lock`（`wx` 独占创建 + 内容为持有者 PID）串行化跨进程写入，对争用方的规定是「**绝不删除已存在的锁**——锁的年龄证明不了持有者已经停下；孤儿锁属于操作者动作」。而**硬杀**（`restart-webui.bat` 的 `taskkill /T /F`）只要正好落在一次设置写入中间，这把锁就永久留在磁盘上。后果不是"某次写入失败"，而是**该 profile 此后每一次设置写入都在 2 秒后超时**：读得到、写不进，界面上只表现为"点了没反应"，一句报错都没有（2026-09-23 真机连撞两次，两次都是重启留下的）。

- **0.6.1 起的自动回收**：宿主半在启动时读一次锁里的 PID，**只有确认该进程已不存在**才删（内容认不出、PID 还活着、权限不足无法判定 → 一律不动）。判据与理由见 `src/settings-lock.ts`，逐条钉在测试第 12 节。
- **手工恢复**（自动回收没赶上时）：

```powershell
Get-Content "$env:USERPROFILE\.dsh\profiles\web\package.json.lock"   # 先确认持有者 PID 是否还活着
Remove-Item   "$env:USERPROFILE\.dsh\profiles\web\package.json.lock" -Force
```

**第二层：写入落盘了，但界面还是旧值。** 这说明**运行中的进程没有把这次配置变更接进运行时**（文件里的值是对的）。设置页自 0.6.1 起会在写入被拒、或"写了但运行时没变"时把原因显示在卡片顶部；遇到第二种情况**重启一次 DSH** 即可（重启会按文件里的值启动）。

## 发行包与「装前体检」

插件市场的装前体检会扫描宿主代码里的混淆/动态执行特征（`eval` / `new Function` / 超长 base64 块）。本插件的 `lib/` 里这些特征**为零**：

- 内联的 schemastery 带有一条「字符串回调 → `new Function` 还原」的分支。本插件所有 schema 都传函数回调，从不使用字符串回调，因此 `build.mjs` 在打包后会把该分支替换为等价空实现；若将来依赖升级导致模式失配，构建会**直接报错退出**，不会悄悄带着 `new Function` 发行。
- 构建与测试命令见上文「构建」；`lib/` 为纯 JavaScript，安装时不需要执行任何构建脚本（因此**不需要 pnpm 的构建授权**，也不会在安装期于用户机器上执行代码）。

## 与官方版本兼容提示

- 依赖的稳定接口：`settings.section`、`shell.overlay` 槽位、`ctx.settingsScope`、`ctx.settings`（Host）、`[data-composer-input]` DOM 标记。
- 浏览器包外部依赖仅限平台种子词（react / react/jsx-runtime / react-dom / @deepseek-ai/cordis / dsh-client-store / ui-slots / ui-primitives），其余全部内联。
