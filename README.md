# dsh-composer-ux

> **English summary** — A DeepSeek Harness **Web** plugin that upgrades the composer (chat input) experience:
> configurable **send / newline keys**, a native-style **7-item right-click context menu**, a resizable &
> scrollable **settings panel with persisted size**, a **global on/off switch**, and automatic
> **`x-opencode-session` request-header injection** so OpenCode (Go) routes work inside DSH.
> Install with `dsh plugin --profile <name> add github:fangwen9527/dsh-composer-ux` — the built `lib/`
> ships in this repository, so there is **no build step and no build authorization**. License: MIT.

DeepSeek Harness Web 输入体验增强插件：

0. **全局开关**：设置页顶部「启用输入增强」总开关——关闭后键位、右键菜单、设置面板滚动/缩放全部停用（输入框恢复 DSH 原生行为），设置页保留用于一键恢复；开关状态持久保存。
1. **设置 → 输入体验**（设置页新增条目）
   - 版式对齐社区插件 `@linxin666/dsh-web-all` 的「Web 插件」页：顶部常显「中文名 + 内嵌英文包名 `dsh-composer-ux` 的一行描述 + 总开关」；其下四个栏目为**可折叠卡片**（标题行只放标题 + 一句动态概览，长说明与控件都在展开后的内容区），**默认全部折叠、不记忆展开状态**，可同时展开多个。
   - **键位**：分别配置「发送键」「换行键」——常用预设（Enter / Ctrl+Enter / Alt+Enter / Shift+Enter）+ 点击「自定义…」后直接按任意组合键录制（Esc 取消，Backspace 清除），支持清空为「无」；发送与换行不能设为相同按键；可一键恢复默认。
   - **右键菜单**：输入框右键菜单的 7 个条目（撤销 / 重做 / 剪切 / 复制 / 粘贴 / 删除 / 全选）可单独开关；可切换「使用系统原生菜单」（浏览器自带菜单，粘贴免授权）。
   - **设置面板**：导航可滚动开关；边缘拖拽调整面板大小（尺寸记忆持久化）与尺寸预设。
   - **OpenCode 请求头**：给 OpenCode 的模型请求自动附加 `x-opencode-session`（详见下节）。
2. **键位生效**（仅主聊天输入框）：默认值 = 现状（Enter 发送、Shift+Enter 换行、Ctrl+Enter 加速提交），改动即时生效并持久保存。

## 安装

本插件按官方「[打包与安装插件](https://deepseek-harness.github.io/deepseek-harness/develop/basic/publish)」规范打包为可安装**组合包**（bundle）：`package.json` 声明 `dsh.bundle.patch → ./cordis.patch.yml`，该层以**包名**插入插件行 `dsh-composer-ux`，装进 profile 后由 pnpm/Node 从 `node_modules` 解析到 `lib/index.js`。

```sh
# npm 安装（推荐）：已是预构建产物，没有构建脚本，安装时不会在本地执行任何代码
dsh plugin --profile <你的 profile> add dsh-composer-ux

# 从 GitHub 安装（等价；lib/ 构建产物已提交，没有 prepare 脚本，因此不需要 pnpm 的构建授权）
dsh plugin --profile <你的 profile> add github:fangwen9527/dsh-composer-ux

# 锁定 commit 安装（更安全：后续推送无法悄悄改变实际运行的内容）
dsh plugin --profile <你的 profile> add github:fangwen9527/dsh-composer-ux#<commit-sha>

# 本地目录安装（开发用，等价于 link）
dsh plugin --profile <你的 profile> add D:/1zcode/dsh插件/输入体验
```

npm 包：<https://www.npmjs.com/package/dsh-composer-ux>（`repository` 指回本仓库，市场据此关联下载量）。

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

## OpenCode 请求头

OpenCode 的接口要求客户端在每次请求里带上一个稳定的会话 ID 请求头（官方 Go 文档「可以在哪里使用？」第 3 条：为每段对话在 `x-opencode-session` 中发送会话 ID，以便其优化路由与提示词缓存）。DSH 的 Models 设置页明确不提供请求头编辑器（源码注释与 `README.zh.md` 都写明 profile `headers` 属于部署配置），所以本插件把这一项代办了。

- **设置页位置**：设置 → 输入体验 → 「OpenCode 请求头」（折叠栏目）：开关 / 头名 / 值 / 作用路由，附一行宿主半回写的「状态」。
- **落点**：`llm-pi-ai` 的 provider profile —— `providers.<路由>.headers.<头名>`。这是 DSH 里唯一受支持的出网请求头入口：它作为 pi-ai 的 `optionsHeaders` **最后合并**（能覆盖默认头），且该适配器每次请求都重读配置，所以改完**下一次请求即生效**，不用重启、不用手工改 `settings.yaml`。
- **写入方式**：`settings.mutate` 的路径寻址——只动我们那一个键，绝不重述或删除你写在同一个 profile 里的其它字段（`models` / `apiKeyEnv` / 其它 headers 都不碰）。
- **只写已存在的路由**：profile 的 `models` 是必填项，凭空造一个只有 headers 的路由会让整份配置校验失败；所以「作用路由」留空时只匹配 `providers` 里以 `opencode` 开头的路由，显式写了名单也只保留其中**已存在**的。
- **撤销**：关栏目开关、关插件总开关、或改头名，都会自动清掉此前写入的那一个键；并且只清「值等于当前配置值或记账值」的，用户自己手写的同名头不会被误删。
- **值**：所有对话共用同一个值（栏目里可改、可「重新生成」）；第一次启用若留空，会自动生成一个 UUID 并保存沿用。OpenCode 文档原话是要「每段对话」一个 ID——按会话变化的头 DSH 的配置层做不到（`llm/stream` 钩子被设计成只能读不能改，`GenerateOptions` 里没有 `headers` 字段），所以这里退一步用固定值。已知代价：所有对话挤同一个上游（没有负载分散）；单段对话内的缓存命中不受影响。另外它**不保证**缓存一定命中（还取决于上游模型与网关策略）。
- **自校验**：写入前用与 llm-pi-ai 相同的规则（`new Headers()`）校验头名与头值；非法值被拒绝，原因写进栏目的「状态」行，而不是把整条路由弄坏。
- **实测结论（本机验证过，不是推断）**：
  - **它是硬门槛，不是优化项。** 同一端点、同一模型，只把这条请求头去掉，OpenCode Go 直接返回 **HTTP 400 `MissingSessionID`**：*"Request is missing x-opencode-session and cannot be routed efficiently."* —— 没有它，DSH 里的 opencode-go 完全不可用。
  - **带着它时真实调用成功，且前缀缓存在工作**：同一段前缀连发两次，`input` 174 → 46、`cacheRead` 192 → 320（总前缀 366 不变），第二次有更多内容直接命中缓存。
  - **线级证据**：用 `test/opencode-header-wire-probe.mjs` 起一个本地端点，DSH 发过去的推理请求上确实带着 `x-opencode-session: <值>`，以及它自己的 `user-agent: deepseek-harness/0.1.5-rc.2 (+https://github.com/deepseek-ai/deepseek-harness)`（正好满足 OpenCode 文档对客户端标识的第 2 条要求）。

## 结构

项目根目录：`D:\1zcode\dsh插件\输入体验\`（构建产物与被挂载的 `cordis.patch.yml` 都在这里）。

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
cd D:\DeepSeek Harness
pnpm dsh web --patch D:/1zcode/dsh插件/输入体验/cordis.dev.patch.yml
```

替换为你的真实路径即可；插件行的 `name` 必须是 `file:///` 形式的绝对 URL（Windows 下 `D:/...` 裸路径无法被 ESM loader 导入）。该文件只在本机存在（已 gitignore），内容如下：

```yaml
- insert:
    - id: composer-ux
      name: 'file:///D:/1zcode/dsh插件/输入体验/lib/index.js'
```

## 开发时热更新

- 改完 `src/` 后执行 `node build.mjs`；
- **Client 半**（`lib/client.js`）：客户端包在激活时读进内存，之后要靠 bundle 重新扫描（rev 变化）才会下发新内容；刷新浏览器即生效。
- **Host 半**（`lib/index.js`）：**必须重启 DSH 进程**。Cordis 加载器只在插件行的 `name` 变化时才重新 `import`（`vendor/loader/lib/index.js`），而 ESM 按 URL 缓存模块，改了文件内容不会失效——实测加临时探针并改动插件行 `name` 触发重载，探针都没有出现在启动日志里。所以：功能开关是随点随生效的，但**宿主半代码的更新要重启一次**。
- 加/删/改插件**行**本身（`cordis.patch.yml`）是 live 的（profile 的 `patchReload: live`），不用重启。

## 设置持久化

设置存在 Host 用户设置文档（默认 `$DSH_HOME/settings.yaml`）的 `composer-ux` 分区，随工作区/机器生效；删除该分区即恢复全部默认。

## 发行包与「装前体检」

插件市场的装前体检会扫描宿主代码里的混淆/动态执行特征（`eval` / `new Function` / 超长 base64 块）。本插件的 `lib/` 里这些特征**为零**：

- 内联的 schemastery 带有一条「字符串回调 → `new Function` 还原」的分支。本插件所有 schema 都传函数回调，从不使用字符串回调，因此 `build.mjs` 在打包后会把该分支替换为等价空实现；若将来依赖升级导致模式失配，构建会**直接报错退出**，不会悄悄带着 `new Function` 发行。
- 构建与测试命令见上文「构建」；`lib/` 为纯 JavaScript，安装时不需要执行任何构建脚本（因此**不需要 pnpm 的构建授权**，也不会在安装期于用户机器上执行代码）。

## 与官方版本兼容提示

- 依赖的稳定接口：`settings.section`、`shell.overlay` 槽位、`ctx.settingsScope`、`ctx.settings`（Host）、`[data-composer-input]` DOM 标记。
- 浏览器包外部依赖仅限平台种子词（react / react/jsx-runtime / react-dom / @deepseek-ai/cordis / dsh-client-store / ui-slots / ui-primitives），其余全部内联。
