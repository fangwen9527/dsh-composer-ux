/**
 * 单元测试专用的纯函数出口（不参与发行产物；`files` 白名单里没有 test/）。
 *
 * 为什么不直接 import 产物：`lib/index.js` 是宿主半的完整打包体，只导出 `apply`；
 * 纯函数（净化、拼接、提示词组装）需要以源码形态被测到，于是这里做一个薄出口，
 * 由 test/quick-commands.mjs 用 esbuild 现场打包再 import。
 */
export {
  DEFAULT_SETTINGS, DEFAULT_QUICK_PROMPTS, OPTIMIZER_API_PATH, OPTIMIZER_TIERS,
  QUICK_LABEL_MAX, QUICK_PROMPT_MAX, QUICK_TEXT_MAX, sanitizeSettings,
} from '../src/settings-contract.ts'
export {
  DEFAULT_CATEGORY_NAME, OPTIMIZE_TEXT_MAX, QUICK_BOOK_VERSION, QUICK_CATEGORY_MAX,
  QUICK_CATEGORY_NAME_MAX, QUICK_PROMPTS_API_PATH, INSERT_MODES, MENU_MODES,
  OPTIMIZER_PROMPT_FIELDS, OPTIMIZER_PROMPT_MAX, optimizerPromptFieldOf,
  alwaysQuickPrompts, appendBatchForSend, bookToFile, defaultQuickBook, firstOnlyQuickPrompts,
  flattenQuickPrompts, insertModeOf, menuModeFrom, newQuickCategoryId, sanitizeBook,
} from '../src/settings-contract.ts'
/**
 * 发送路径的三个函数一起出口：`appendBatchForSend`（决定这一批有谁）+ `publishInputBridge`
 * / `applyPromptsForSend`（真正写回编辑器的那一步）能在 node 里串起来跑，才测得到
 * 「点发送时到底写进去了什么」—— 0.4.0 的「仅首次」就是在这两步之间被过滤掉的，
 * 而当时的护栏只匹配了调用处文本，所以没报警。
 */
export {
  applyPromptsForSend, publishInputBridge, sendButtonOf, withPromptsAppended,
} from '../src/client/quick-commands.ts'
export {
  bookCounts, findPrompt, promptsElsewhere,
  withAlwaysToggled, withCategoryAdded, withCategoryMoved, withCategoryRemoved,
  withCategoryRenamed, withInsertMode, withPromptAdded, withPromptMoved,
  withPromptMovedToCategory, withPromptPatched, withPromptRemoved,
} from '../src/client/prompt-book.ts'
export {
  OPTIMIZER_SPECS, OPTIMIZER_OUTPUT_CONTRACT, OPTIMIZE_ITEM_KINDS, OPTIMIZE_ITEM_MAX_CHARS,
  OPTIMIZE_MAX_ITEMS,
  buildOptimizeSystem, buildOptimizeTemperature, buildOptimizeUser, optimizePromptSource,
} from '../src/optimizer-prompt.ts'
/**
 * 依据校验 + 宿主装配（0.6.0 的机制内核）：这些函数是"模型能不能凭空加需求"的唯一防线，
 * 每一条判据都要能在 node 里单独钉住，所以整组出口。
 */
export {
  allowedKindsFor, assembleCommand, extractJson, findQuoteSpan, optimizeBudgetFor,
  parseOptimizeOutput, runOptimizePipeline,
} from '../src/optimizer-assemble.ts'
/** 样式表也当数据测：实色按钮的「填充 + 前景」必须成对（见测试第 7 节）。 */
export * as styles from '../src/client/styles.ts'
/** 入口按钮的注入样式表：只取类名常量（installX 会碰 document，不在 node 里跑）。 */
export { QUICK_BUTTON_CLASS } from '../src/client/quick-style.ts'
/** 设置面板尺寸手柄的定位/描边（纯函数与样式对象，无 DOM 副作用）。 */
export {
  PANEL_SELECTOR, RESIZE_EDGE_CLASS, RESIZE_GRIP_CLASS, RESIZE_LAYER_CLASS,
  RESIZE_OUTLINE_CLASS, RESIZE_OUTLINE_STYLE, handleBox,
} from '../src/client/panel.ts'
/**
 * 终端探测的纯函数出口：探测顺序（git 反推 / WSL 硬排除 / Niubash 降级）是
 * 「默认终端」这块能力里唯一能在 node 里完整验证的部分，其余要真机。
 */
export {
  WSL_REASON, candidateKindOf, defaultBashPath, discoverBashCandidates, isWslBash, kindLabel,
  normalizePath, unpreparedBashRoot,
} from '../src/terminal/discover.ts'
/**
 * 终端渲染层：标记顺序与 exit 锚点是**模型可见行为**（终端卡片靠末尾锚点拆 pill），
 * 与官方 `dsh-tool-bash` 逐字对齐，所以逐条断言。
 */
export {
  DSH_ENV_PREFIX, ESCALATION_TARGETS, escalationHintMarker, parseExitStatus,
  renderBashResult, renderProcessRead, sandboxDenialMarker,
} from '../src/terminal/render.ts'
/** 升级审批语义（fail-closed、严格更宽、文案）—— 逐字对齐官方，值得逐条断言。 */
export {
  WIDER_MODES, approveEscalation, validateEscalationArgs,
} from '../src/terminal/sandbox.ts'
/** bash 工具本体：参数/输出 schema、描述、执行路径（argv/cwd/env/confine/后台/中止）。 */
export {
  BASH_SECTION_TEXT, BASH_TOOL_NAME, DEFAULT_TIMEOUT_MS, ENV_OVERRIDES, MAX_TIMEOUT_MS,
  TOOL_ABORTED, TOOL_BASH_SECTION_ORDER, TOOL_PWSH_SECTION_ORDER, bashDescription, bashParameters,
  bashOutputSchema, clampTimeout, createBashTool, escalationModesOf, resolveWorkdir,
} from '../src/terminal/tool.ts'
/** 「默认终端」的契约：字段名、三档、候选净化、生效判定、状态行文案。 */
export {
  DEFAULT_TERMINAL_MODE, TERMINAL_API_PATH, TERMINAL_BASH_PATH_FIELD, TERMINAL_CANDIDATES_FIELD,
  TERMINAL_EFFECTIVE_FIELD, TERMINAL_MODE_FIELD, TERMINAL_MODES, TERMINAL_STATUS_FIELD,
  activeBashPath, candidatesToStored, sanitizeTerminalCandidates, terminalModeFrom, terminalStatusText,
} from '../src/terminal/contracts.ts'
/** 宿主半子系统本体：按会话下发（restrict/register/section）+ 立刻覆盖在跑 agent + 状态回写。 */
export { installTerminalPolicy } from '../src/terminal/host.ts'
/**
 * 「重启 DSH」（机制照搬插件市场）：启动命令重建、spawn 包装、助手源码、信任关卡、
 * 优雅退出、排期（spawn/定时/退出/取路径全部注入）。逐条断言的理由在测试第 10 节。
 */
export {
  RESTART_EXIT_DELAY_MS, RESTART_LOG_PREFIX, RESTART_POLL_MS, RESTART_PORT_WAIT_MS,
  RESTART_STOP_FALLBACK_MS,
  bootId, detectedDebugger, detectedSupervisor, gracefulStop, isLoopbackAddress, launchCommand,
  nodeExecutableOf, planRestart, quotePowerShell, respawnCommand, restartHelperSource,
  scheduleRestart, servingPort, trustedRestartRequest,
} from '../src/restart.ts'
/** 「每一栏一个开关」的判据与总闸合成（两半共用，必须逐条钉住）。 */
export { sectionEnabledOf, activeSections, KEYS_ENABLED_FIELD, MENU_ENABLED_FIELD, PANEL_ENABLED_FIELD, QUICK_ENABLED_FIELD, TERMINAL_ENABLED_FIELD } from '../src/settings-contract.ts'
/** 设置契约里那几个跨端常量（重启接口路径等）。 */
export { REPO_URL, RESTART_API_PATH } from '../src/settings-contract.ts'
/**
 * 孤儿写入锁的判据（0.6.1）。
 *
 * 这段逻辑会**删文件**（`<profile>/package.json.lock`），所以每一条判据都必须能单独
 * 钉住：认不出 PID 不删、持有者活着不删、只有确认持有者已不存在才删。
 * "误删一把活锁"的代价是两个写入者交错提交同一个 profile patch，比不删更糟。
 */
export {
  SETTINGS_LOCK_FILENAME, isProcessAlive, profileDirOfPatchPath, recoverStaleSettingsLock,
  staleLockDecision,
} from '../src/settings-lock.ts'
