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
  QUICK_CATEGORY_NAME_MAX, QUICK_PROMPTS_API_PATH,
  alwaysQuickPrompts, bookToFile, defaultQuickBook, flattenQuickPrompts,
  newQuickCategoryId, sanitizeBook,
} from '../src/settings-contract.ts'
export { alwaysPrompts, sendButtonOf, withAlwaysPrompts } from '../src/client/quick-commands.ts'
export {
  bookCounts, findPrompt, promptsElsewhere,
  withAlwaysToggled, withCategoryAdded, withCategoryMoved, withCategoryRemoved,
  withCategoryRenamed, withPromptAdded, withPromptMoved, withPromptMovedToCategory,
  withPromptPatched, withPromptRemoved,
} from '../src/client/prompt-book.ts'
export {
  OPTIMIZER_SPECS, buildOptimizeSystem, buildOptimizeTemperature, buildOptimizeUser,
} from '../src/optimizer-prompt.ts'
/** 样式表也当数据测：实色按钮的「填充 + 前景」必须成对（见测试第 7 节）。 */
export * as styles from '../src/client/styles.ts'
/** 入口按钮的注入样式表：只取类名常量（installX 会碰 document，不在 node 里跑）。 */
export { QUICK_BUTTON_CLASS } from '../src/client/quick-style.ts'
/** 设置面板尺寸手柄的定位/描边（纯函数与样式对象，无 DOM 副作用）。 */
export {
  PANEL_SELECTOR, RESIZE_EDGE_CLASS, RESIZE_GRIP_CLASS, RESIZE_LAYER_CLASS,
  RESIZE_OUTLINE_CLASS, RESIZE_OUTLINE_STYLE, handleBox,
} from '../src/client/panel.ts'
