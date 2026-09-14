# 更新日志

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.2.0] — 2026-09-14

> 这一版是**未发布**状态（本地已验证、等实测通过后再发 npm / GitHub Release）。

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
