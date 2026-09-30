# PLAN 0.14.0 —— 把 dsh-prompt-optimizer 的 UI 与内部提示词移植进「快捷指令」面板

## 起因（用户原话）

> **「https://github.com/WestFox-AwA/dsh-prompt-optimizer 全面模仿他的UI和UI中的所有功能，效果是与快捷指令部分ui拼接在一起，也模仿他的内部提示词」**

## 决策（开工前逐条问过用户，2026-09-30）

| 问题 | 用户选择 | 含义 |
|---|---|---|
| 机制要不要换成他的 | **C** | **不换机制**：仍是「跑一轮 → 成品进结果框 → 你点「插入输入框」」；他的**发送前拦截 + 随行注入 + 审查浮层**本版**不做** |
| 提示词搬多少 | **A** | **本体也换成他的**（六类 + `unknownClass` + 候选），硬规则 1–8 **逐字搬**（只把【输出格式】改成我们的成品契约）；**撤掉记忆链**（他的硬规则 7「轮次之间不遗传」） |
| 内置 Bash | **A** | **真做、默认关**（与只读工具同一套纪律：限定会话工作目录、超时/输出上限、记账） |

## 目标清单

1. **UI**：把「优化选项」卡片搬进「快捷指令」面板的**优化提示词那一半**（结果框之上）：
   - 档位 `关闭/轻度/标准/重度`（替换我们的 `普通/高级/极端`；**关闭 ⇒ 不优化**，主按钮变灰写明原因）
   - 协作基调 `普通/硬邦邦`（`framing: neutral|hard`）
   - 权限 `审查/自动`（审查 = 成品进结果框等你点插入；自动 = 跑完**自动插入输入框**，**不自动发送**）
   - 模型 `跟随会话模型（默认）/ 指定`
   - 上下文 `回合 0–10 / 全文`（替换我们写死的"最近 4 条、约 1600 字"）
   - 只读工具 `开/关`（默认关，已有）
   - 内置 Bash `开/关`（默认关，新做）
   - 详情：改解释层提示词 + 撤销 + 恢复内置（复用已有的 `OptimizerPromptEditor`）
2. **提示词**：`optimizer-prompt.ts` 换成他的体系：
   - 硬规则 1–8 逐字搬（含 `【最重要的一条】不改写`），**只把【输出格式】一节改成我们的条目契约**；
   - 档位策略照搬 `strategy.js`：`off{maxItems:0}` / `light{single,4,refer,brief}` / `standard{parallel,8,one,normal}` / `heavy{branching,12,two,deep,candidates≤3}`；
   - 「硬邦邦模式」块（`HARD_NOTE_SYSTEM`）照搬；
   - **领域质量维度**（ui/cli/doc/data/code/game）照搬，含它的两条纪律（维度是"怎么检查"、领域只能从上下文线索推断，推不出就把领域写成 unknown）。
3. **本体**：条目类型换成他的六类：
   `user_requirement` / `quality_interpretation` / `observed_fact` / `implementation_option` / `proposal` / `unknown`
   （`unknown` 带 `unknownClass: user_preference|lookupable_fact|implementation_detail`，`user_preference` 可带 ≤3 个 `candidates`）。
   校验规则对应搬：**要逐字引文的是 `user_requirement`**；`quality_interpretation` 要 `rationale` 指回原话字眼；
   `observed_fact` 要 `sourceRefs`（真读过）；其余不许冒充要求。
4. **成品形态**：**不再改写用户的句子** ⇒ 成品 = **用户原话原样 + 辅助小节**（用户要求 / 质量解读 / 未决项 / 可逆实现选项 / 建议 / 已核事实）。
   旧的 `rewrite` 回填逻辑（按引文位置覆盖原话）随之撤掉。
5. **撤记忆链**：不再把上一轮成品带给模型（他的规则 7）；`previousForChain` 相关的行为、界面文案、测试一并改。
6. **内置 Bash**：给解释层注册一个真 bash 工具（默认关）。纪律：
   - 只在**当前会话工作目录**内执行；越界路径拒绝；
   - 单条命令超时（20 s）与总时长上限、输出字符上限（分别与只读工具同量级）；
   - 每轮最多 N 次调用；失败原样回报给模型（不吞）；
   - 结果框与台账如实记账（调用了几次、是否被截断/拒绝）。
7. **许可**：BSD-3-Clause 要求保留版权声明 ⇒ `README.md` 增加「来源与许可」小节 + 新增 `NOTICE` 文件：
   提示词与 UI 设计借鉴自 `WestFox-AwA/dsh-prompt-optimizer`（© 2026 啃轮胎的西狐），BSD-3-Clause。

## 本版**不做**（明确边界，免得被当成漏了）

- 他的**发送前拦截**与**随行注入**、**拦截浮层**（思维层/产出层）、**审查档的发送前编辑**（用户选 C 排除）；
- `verifier-html`（答案核验页）、`answer-audit`、`control-api`、`migration`、`assembly-gate`、eval/评测体系；
- token 三分量显示（属于拦截浮层的 UI）；
- 他 bash 那一整套进程治理（我们只做"够用的执行 + 上限 + 记账"）。

## 施工顺序（内部阶段，一次交付 0.14.0）

| 阶段 | 内容 | 主要文件 |
|---|---|---|
| S1 | 设置与类型：四档、`framing/permission/model/historyMode/turns/bash` 字段、六类本体类型 | `settings-contract.ts` |
| S2 | 提示词移植：硬规则逐字 + 档位策略 + 硬邦邦块 + 领域维度 + 输出格式改写 | `optimizer-prompt.ts` |
| S3 | 装配与校验：六类的引文/依据规则、成品=原话+小节、撤 `rewrite` 回填 | `optimizer-assemble.ts` |
| S4 | 宿主流水线：模型选择、上下文回合/全文、撤记忆链、台账字段 | `host.ts`、`optimize-ledger.ts` |
| S5 | 内置 Bash 工具 | `optimize-bash.ts`（新）、`optimize-tool-loop.ts` |
| S6 | UI：优化选项卡片 + 详情编辑器接入面板 | `QuickCommandsPanel.tsx`、`OptimizeDock.tsx`、`styles.ts`、`OptimizerPromptEditor.tsx` |
| S7 | 测试/变异/文档/NOTICE/发版 | `test/*`、`README*`、`CHANGELOG.md` |

## 验收标准

- **测试**：全量套件绿；新增 S1–S6 各自的正反用例；变异全部咬住（新规则每条至少一个变异）。
- **真机**：重启后打开面板 → 优化那半出现「优化选项」卡片；八个控件都能改、改完立刻生效；
  跑一轮：成品是「原话 + 小节」形态；档位=关闭时主按钮不可点并写明原因；
  只读工具/Bash 关着时模型看不到它们、打开后能工作；详情里改提示词能立刻用上、能恢复内置。
- **如实说明**：本版**没有**他的发送前拦截，所以"审查/自动"指的是**成品出现后**的两种处理，不是发送时。

## 未纳入的保真差距（写给将来的自己）

他的插件还包含：发送前拦截与随行注入、拦截浮层与 token 显示、答案核验与评测体系、
bash 进程治理与运行时完整性校验。本版只搬了**界面与提示词**这一层。
