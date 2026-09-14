window.__ModuleLoader__.load({ id: "dsh-composer-ux", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.tsx
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(client_exports);
var import_dsh_client_store = require("@deepseek-ai/dsh-client-store");

// src/settings-contract.ts
var NAMESPACE = "composer-ux";
var ENABLED_FIELD = "enabled";
var SEND_KEY_FIELD = "sendKey";
var NEWLINE_KEY_FIELD = "newlineKey";
var PANEL_SCROLL_FIELD = "panelScroll";
var PANEL_RESIZE_FIELD = "panelResize";
var PANEL_WIDTH_FIELD = "panelWidth";
var PANEL_HEIGHT_FIELD = "panelHeight";
var MENU_FIELDS = [
  "menuUndo",
  "menuRedo",
  "menuCut",
  "menuCopy",
  "menuPaste",
  "menuDelete",
  "menuSelectAll"
];
var MENU_NATIVE_FIELD = "menuNative";
var QUICK_PROMPTS_FIELD = "quickPrompts";
var OPTIMIZER_TIER_FIELD = "optimizerTier";
var QUICK_PROMPT_MAX = 60;
var QUICK_LABEL_MAX = 40;
var QUICK_TEXT_MAX = 4e3;
var OPTIMIZER_API_PATH = "/composer-ux/optimize";
var OPTIMIZER_TIERS = [
  { id: "basic", label: "\u666E\u901A", hint: "\u53EA\u505A\u8BED\u8A00\u5C42\u4FEE\u590D\uFF1A\u75C5\u53E5\u3001\u9519\u522B\u5B57\u3001\u6307\u4EE3\u4E0E\u542B\u7CCA\u8BCD\uFF0C\u4E0D\u65B0\u589E\u4EFB\u4F55\u9700\u6C42\uFF0C\u7BC7\u5E45\u4E0E\u539F\u6587\u76F8\u5F53\u3002" },
  { id: "advanced", label: "\u9AD8\u7EA7", hint: "\u5728\u4E0D\u52A8\u76EE\u6807\u7684\u524D\u63D0\u4E0B\uFF0C\u628A\u300C\u4F60\u663E\u7136\u60F3\u8981\u3001\u4F46\u6CA1\u8BF4\u51FA\u53E3\u300D\u7684\u5FC5\u8981\u8981\u6C42\u8865\u6210\u5BF9 AI \u7684\u8981\u6C42\uFF0C\u8BA9\u5B83\u4E00\u6B21\u505A\u5BF9\u3002" },
  { id: "extreme", label: "\u6781\u7AEF", hint: "\u6309\u590D\u6742\u4EFB\u52A1\u5904\u7406\uFF1A\u56FA\u5316\u547D\u4EE4\u7ED3\u6784 + \u5206\u9636\u6BB5\u6267\u884C\u8BA1\u5212 + 2~4 \u79CD\u60C5\u51B5\u7684\u9884\u6848\u3002" }
];
var DEFAULT_OPTIMIZER_TIER = "advanced";
var DEFAULT_QUICK_PROMPTS = [
  { id: "builtin-1", label: "\u4E00\u95EE\u4E00\u7B54", prompt: "\u4F60\u4E0D\u61C2\u7684\u5C31\u95EE\u6211\uFF0C\u4E00\u95EE\u4E00\u7B54\uFF1B\u540C\u65F6\u8BF4\u6E05\u695A\u4F60\u4E3A\u4EC0\u4E48\u8981\u95EE\u8BE5\u95EE\u9898\uFF1B\u76F4\u5230\u4F60\u5BF9\u6211\u7684\u76EE\u6807\u6709\u660E\u786E\u8BA4\u77E5\u540E\u518D\u5F00\u59CB\u5E72\u6D3B\u3002", always: false },
  { id: "builtin-2", label: "\u4EA4\u63A5\u6587\u6863", prompt: "\u628A\u8FD9\u6B21\u4EFB\u52A1\u3001\u5DF2\u5B8C\u6210\u5185\u5BB9\u3001\u5F53\u524D\u5361\u70B9\u3001\u4E0B\u4E00\u6B65\u8BA1\u5212\u3001\u8E29\u8FC7\u7684\u5751\uFF0C\u6574\u7406\u6210\u4E00\u4EFD\u4EA4\u63A5\u6587\u6863\uFF0C\u5199\u7ED9\u65B0\u4F1A\u8BDD\u770B\u3002", always: false },
  { id: "builtin-3", label: "\u4EC5\u8BF4\u660E\u539F\u56E0", prompt: "\u4EC5\u8BF4\u660E\u539F\u56E0\uFF0C\u4E0D\u8981\u505A\u5176\u4ED6\u52A8\u4F5C\u3002", always: false },
  { id: "builtin-4", label: "\u5206\u6790\u540E\u76F4\u63A5\u5E72", prompt: "\u5206\u6790\u539F\u56E0\uFF0C\u7136\u540E\u76F4\u63A5\u5F00\u59CB\u5E72\u6D3B\uFF0C\u4E0D\u9700\u8981\u8FC7\u95EE\u6211\u3002", always: false },
  { id: "builtin-5", label: "\u63D0\u4EA4\u4EE3\u7801", prompt: "\u8BF7\u5E2E\u6211\u63D0\u4EA4\u4EE3\u7801\uFF1A\u68C0\u67E5\u5F53\u524D git \u53D8\u66F4\uFF0C\u751F\u6210\u89C4\u8303\u7684 commit message \u5E76\u6267\u884C\u63D0\u4EA4\u3002", always: false },
  { id: "builtin-6", label: "\u7ED9\u65B9\u6848", prompt: "\u8BF7\u9488\u5BF9\u4E0A\u9762\u7684\u95EE\u9898\u7ED9\u51FA\u4E00\u4E2A\u5B8C\u6574\u65B9\u6848\uFF0C\u5305\u62EC\u601D\u8DEF\u3001\u6B65\u9AA4\u3001\u6CE8\u610F\u4E8B\u9879\u548C\u98CE\u9669\u3002", always: false },
  { id: "builtin-7", label: "\u89E3\u91CA\u4EE3\u7801", prompt: "\u8BF7\u89E3\u91CA\u8FD9\u6BB5\u4EE3\u7801\u7684\u4F5C\u7528\u548C\u5B9E\u73B0\u601D\u8DEF\u3002", always: false },
  { id: "builtin-8", label: "\u5199\u6D4B\u8BD5", prompt: "\u8BF7\u4E3A\u4E0B\u9762\u7684\u4EE3\u7801\u7F16\u5199\u5355\u5143\u6D4B\u8BD5\u3002", always: false },
  { id: "builtin-9", label: "\u4EE3\u7801\u5BA1\u67E5", prompt: "\u8BF7\u5BF9\u4E0B\u9762\u7684\u4EE3\u7801\u8FDB\u884C\u4EE3\u7801\u5BA1\u67E5\uFF0C\u6307\u51FA\u95EE\u9898\u5E76\u7ED9\u51FA\u6539\u8FDB\u5EFA\u8BAE\u3002", always: false }
];
function newQuickPromptId() {
  return `qp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
var HEADER_ENABLED_FIELD = "headerEnabled";
var HEADER_NAME_FIELD = "headerName";
var HEADER_VALUE_FIELD = "headerValue";
var HEADER_ROUTES_FIELD = "headerRoutes";
var HEADER_APPLIED_NAME_FIELD = "headerAppliedName";
var HEADER_APPLIED_VALUE_FIELD = "headerAppliedValue";
var HEADER_STATUS_FIELD = "headerStatus";
var DEFAULT_HEADER_NAME = "x-opencode-session";
var HEADER_VALUE_MAX = 200;
var HEADER_NAME_MAX = 64;
var DEFAULT_SETTINGS = {
  enabled: true,
  sendKey: "Enter",
  newlineKey: "Shift+Enter",
  menuUndo: true,
  menuRedo: true,
  menuCut: true,
  menuCopy: true,
  menuPaste: true,
  menuDelete: true,
  menuSelectAll: true,
  menuNative: false,
  panelScroll: true,
  panelResize: true,
  headerEnabled: false,
  headerName: DEFAULT_HEADER_NAME,
  headerValue: "",
  headerRoutes: "",
  headerAppliedName: "",
  headerAppliedValue: "",
  headerStatus: "",
  quickPrompts: DEFAULT_QUICK_PROMPTS,
  optimizerTier: DEFAULT_OPTIMIZER_TIER
};
var SEND_PRESETS = ["Enter", "Ctrl+Enter", "Alt+Enter", "Shift+Enter"];
var NEWLINE_PRESETS = ["Shift+Enter", "Enter", "Ctrl+Enter", "Alt+Enter"];
var MENU_ITEMS = [
  { field: "menuUndo", label: "\u64A4\u9500", shortcut: "Ctrl+Z" },
  { field: "menuRedo", label: "\u91CD\u505A", shortcut: "Ctrl+Y" },
  { field: "menuCut", label: "\u526A\u5207", shortcut: "Ctrl+X" },
  { field: "menuCopy", label: "\u590D\u5236", shortcut: "Ctrl+C" },
  { field: "menuPaste", label: "\u7C98\u8D34", shortcut: "Ctrl+V" },
  { field: "menuDelete", label: "\u5220\u9664", shortcut: "" },
  { field: "menuSelectAll", label: "\u5168\u9009", shortcut: "Ctrl+A" }
];
function newSessionId() {
  const bag = globalThis;
  if (typeof bag.crypto?.randomUUID === "function") return bag.crypto.randomUUID();
  const hex = (count) => Array.from(
    { length: count },
    () => Math.floor(Math.random() * 16).toString(16)
  ).join("");
  return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
}
function sanitizeSettings(value) {
  const source = typeof value === "object" && value !== null ? value : {};
  const asString = (field) => {
    const v = source[field];
    return typeof v === "string" && v.length > 0 && v.length <= 64 ? v : "";
  };
  const asText = (field, max) => {
    const v = source[field];
    return typeof v === "string" && v.length <= max ? v : "";
  };
  const asBool = (field) => {
    const v = source[field];
    return typeof v === "boolean" ? v : DEFAULT_SETTINGS[field];
  };
  const asSize = (field) => {
    const v = source[field];
    return typeof v === "number" && Number.isFinite(v) && v >= 320 && v <= 4e3 ? Math.round(v) : void 0;
  };
  const asQuickPrompts = () => {
    const raw = source[QUICK_PROMPTS_FIELD];
    if (!Array.isArray(raw)) return DEFAULT_QUICK_PROMPTS;
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const item of raw) {
      if (out.length >= QUICK_PROMPT_MAX) break;
      if (typeof item !== "object" || item === null) continue;
      const row2 = item;
      const prompt = typeof row2.prompt === "string" ? row2.prompt.slice(0, QUICK_TEXT_MAX).trim() : "";
      if (prompt === "") continue;
      const label = typeof row2.label === "string" ? row2.label.slice(0, QUICK_LABEL_MAX).trim() : "";
      const id = typeof row2.id === "string" && row2.id !== "" ? row2.id.slice(0, 64) : newQuickPromptId();
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ id, label: label === "" ? prompt.slice(0, 12) : label, prompt, always: row2.always === true });
    }
    return out;
  };
  const asTier = () => {
    const v = source[OPTIMIZER_TIER_FIELD];
    return v === "basic" || v === "advanced" || v === "extreme" ? v : DEFAULT_OPTIMIZER_TIER;
  };
  return {
    enabled: asBool(ENABLED_FIELD),
    sendKey: asString(SEND_KEY_FIELD),
    newlineKey: asString(NEWLINE_KEY_FIELD),
    menuUndo: asBool("menuUndo"),
    menuRedo: asBool("menuRedo"),
    menuCut: asBool("menuCut"),
    menuCopy: asBool("menuCopy"),
    menuPaste: asBool("menuPaste"),
    menuDelete: asBool("menuDelete"),
    menuSelectAll: asBool("menuSelectAll"),
    menuNative: asBool(MENU_NATIVE_FIELD),
    panelScroll: asBool(PANEL_SCROLL_FIELD),
    panelResize: asBool(PANEL_RESIZE_FIELD),
    panelWidth: asSize(PANEL_WIDTH_FIELD),
    panelHeight: asSize(PANEL_HEIGHT_FIELD),
    headerEnabled: asBool(HEADER_ENABLED_FIELD),
    // 头名留空是不合法状态（宿主半会拒绝写入并把原因写进 headerStatus），
    // 故净化只做长度收窄、保留原样，让用户看得见自己输错了什么。
    headerName: asText(HEADER_NAME_FIELD, HEADER_NAME_MAX),
    headerValue: asText(HEADER_VALUE_FIELD, HEADER_VALUE_MAX),
    headerRoutes: asText(HEADER_ROUTES_FIELD, HEADER_VALUE_MAX),
    headerAppliedName: asText(HEADER_APPLIED_NAME_FIELD, HEADER_NAME_MAX),
    headerAppliedValue: asText(HEADER_APPLIED_VALUE_FIELD, HEADER_VALUE_MAX),
    headerStatus: asText(HEADER_STATUS_FIELD, HEADER_VALUE_MAX),
    quickPrompts: asQuickPrompts(),
    optimizerTier: asTier()
  };
}

// src/client/chords.ts
var MODIFIER_KEYS = /* @__PURE__ */ new Set(["Control", "Alt", "Shift", "Meta", "AltGraph"]);
var CODE_LABELS = {
  Slash: "/",
  Backslash: "\\",
  BracketLeft: "[",
  BracketRight: "]",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  Space: "Space"
};
function encodeChord(event) {
  const parts = [];
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  if (event.metaKey) parts.push("Meta");
  const mainKey = normalizeMainKey(event);
  if (mainKey === "") return "";
  parts.push(mainKey);
  return parts.join("+");
}
function normalizeMainKey(event) {
  const code = event.code;
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (CODE_LABELS[code] !== void 0) return CODE_LABELS[code];
  return code !== "" ? code : event.key;
}
function isModifierOnly(event) {
  return MODIFIER_KEYS.has(event.key);
}
var BARE_ALLOWED = /* @__PURE__ */ new Set([
  "Enter",
  "Space",
  "Tab",
  "Backspace",
  "Delete",
  "Insert",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight"
]);
function isBareKeyAllowed(chord) {
  if (chord.includes("+")) return true;
  if (BARE_ALLOWED.has(chord)) return true;
  return /^F\d{1,2}$/.test(chord);
}
function chordToInit(chord) {
  const parts = chord.split("+").filter(Boolean);
  const init = {
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    bubbles: true,
    cancelable: true
  };
  const key = parts.pop() ?? "";
  init.key = key;
  init.code = key.length === 1 ? /^[A-Z]$/.test(key) ? `Key${key}` : key : key;
  for (const part of parts) {
    if (part === "Ctrl") init.ctrlKey = true;
    else if (part === "Alt") init.altKey = true;
    else if (part === "Shift") init.shiftKey = true;
    else if (part === "Meta") init.metaKey = true;
  }
  return init;
}
function isEnterFamily(chord) {
  return chord === "Enter" || chord.endsWith("+Enter");
}
function evaluateRecordedKey(event) {
  if (isModifierOnly(event)) return { kind: "ignore" };
  if (event.code === "Escape" || event.key === "Escape") return { kind: "cancel" };
  if (event.code === "Backspace" || event.code === "Delete") return { kind: "clear" };
  const chord = encodeChord(event);
  if (chord === "") return { kind: "ignore" };
  if (!isBareKeyAllowed(chord)) {
    return {
      kind: "reject",
      message: "\u5355\u4E2A\u5B57\u6BCD/\u6570\u5B57\u952E\u4F1A\u4E0E\u6253\u5B57\u51B2\u7A81\uFF0C\u8BF7\u914D\u5408 Ctrl / Alt / Shift \u4F7F\u7528\uFF0C\u6216\u9009\u62E9 Enter\u3002"
    };
  }
  return { kind: "ok", chord };
}
function displayChord(chord) {
  return chord === "" ? "\u65E0" : chord;
}

// src/client/quick-commands.ts
var COMPOSER_SELECTOR = "[data-composer-input]";
var CARD_SELECTOR = "[data-composer-card]";
var state = { actions: null, draft: "", sessionId: "" };
function publishInputBridge(next) {
  state.actions = next.actions;
  state.draft = next.draft;
  state.sessionId = next.sessionId;
}
function releaseInputBridge(sessionId) {
  if (state.sessionId !== sessionId) return;
  state.actions = null;
  state.draft = "";
  state.sessionId = "";
}
function draftFromDom() {
  const el = document.querySelector(COMPOSER_SELECTOR);
  if (!(el instanceof HTMLElement)) return "";
  return el.innerText.replace(/\n+$/, "");
}
function currentDraft() {
  return state.actions === null ? draftFromDom() : state.draft;
}
function alwaysPrompts(prompts) {
  return prompts.filter((item) => item.always === true && item.prompt.trim() !== "");
}
function withAlwaysPrompts(draft, prompts) {
  const picked = alwaysPrompts(prompts);
  if (picked.length === 0) return null;
  const base = draft.replace(/\s+$/, "");
  if (base === "") return null;
  const suffix = picked.map((item) => item.prompt.trim()).join("\n\n");
  if (base.endsWith(suffix)) return null;
  return `${base}

${suffix}`;
}
function applyAlwaysPrompts(prompts) {
  const actions = state.actions;
  if (actions === null) return false;
  const next = withAlwaysPrompts(currentDraft(), prompts);
  if (next === null) return false;
  actions.setDraft(next);
  return true;
}
function insertIntoDraft(text) {
  const actions = state.actions;
  const body = text.trim();
  if (actions === null || body === "") return false;
  const draft = currentDraft();
  const next = draft.trim() === "" ? body : `${draft.replace(/\s+$/, "")}
${body}`;
  actions.setDraft(next);
  return true;
}
function replaceDraft(text) {
  const actions = state.actions;
  if (actions === null) return false;
  actions.setDraft(text);
  return true;
}
function focusComposer() {
  const el = document.querySelector(COMPOSER_SELECTOR);
  if (el instanceof HTMLElement) el.focus({ preventScroll: true });
}
function sendButtonOf(target) {
  if (!(target instanceof Element)) return null;
  const card = target.closest(CARD_SELECTOR);
  if (card === null) return null;
  const buttons = card.querySelectorAll("button");
  if (buttons.length === 0) return null;
  const last = buttons[buttons.length - 1];
  if (!(last instanceof HTMLButtonElement)) return null;
  if (last !== target && !last.contains(target)) return null;
  if (last.disabled) return null;
  if (last.querySelector("svg rect") !== null) return null;
  if (last.querySelector("svg path") === null) return null;
  return last;
}
async function optimizeDraft(text, tier) {
  const body = text.trim();
  if (body === "") return { ok: false, error: "\u8F93\u5165\u6846\u662F\u7A7A\u7684\uFF0C\u5148\u5199\u70B9\u4EC0\u4E48\u518D\u4F18\u5316" };
  let response;
  try {
    response = await fetch(OPTIMIZER_API_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: body, tier })
    });
  } catch (error) {
    return { ok: false, error: `\u8FDE\u4E0D\u4E0A\u5BBF\u4E3B\u534A\u7684\u4F18\u5316\u63A5\u53E3\uFF1A${error instanceof Error ? error.message : String(error)}` };
  }
  if (!response.ok) {
    return { ok: false, error: `\u5BBF\u4E3B\u534A\u8FD4\u56DE HTTP ${response.status}\uFF08\u63D2\u4EF6\u53EF\u80FD\u8FD8\u6CA1\u91CD\u542F\u751F\u6548\uFF09` };
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, error: "\u5BBF\u4E3B\u534A\u8FD4\u56DE\u7684\u4E0D\u662F JSON" };
  }
  const record = typeof payload === "object" && payload !== null ? payload : {};
  if (record.ok !== true) {
    const message = typeof record.error === "string" && record.error !== "" ? record.error : "\u4F18\u5316\u5931\u8D25";
    return { ok: false, error: message };
  }
  const optimized = typeof record.text === "string" ? record.text.trim() : "";
  if (optimized === "") return { ok: false, error: "\u6A21\u578B\u6CA1\u6709\u4EA7\u51FA\u4EFB\u4F55\u5185\u5BB9" };
  const route = `${String(record.provider ?? "")}/${String(record.model ?? "")}`;
  return { ok: true, text: optimized, route };
}

// src/client/interceptors.ts
var INPUT_SELECTOR = "[data-composer-input]";
var OVERLAY_SELECTOR = "[data-trigger-menu], [data-conversation-composer-overlay]";
function findComposerRoot(target) {
  if (!(target instanceof Element)) return null;
  return target.closest(INPUT_SELECTOR);
}
function overlayOpen() {
  return document.querySelector(OVERLAY_SELECTOR) !== null;
}
var replaying = false;
var replayingSendClick = false;
var pasteCache = null;
function prefetchClipboard() {
  pasteCache = null;
  const readText = navigator.clipboard?.readText;
  if (typeof readText !== "function") return;
  readText.call(navigator.clipboard).then(
    (text) => {
      pasteCache = text;
    },
    () => {
      pasteCache = null;
    }
  );
}
function dispatchKey(root, init) {
  replaying = true;
  try {
    root.dispatchEvent(new KeyboardEvent("keydown", init));
  } finally {
    replaying = false;
  }
}
function composing(event) {
  return event.isComposing || event.keyCode === 229;
}
function installInterceptors(deps) {
  const onKeyDown = (event) => {
    if (replaying) return;
    const root = findComposerRoot(event.target);
    if (root === null) return;
    if (composing(event)) return;
    const chord = encodeChord(event);
    if (!isEnterFamily(chord)) return;
    if (overlayOpen()) return;
    const settings = deps.settings();
    const gesture = chord === settings.sendKey ? "send" : chord === settings.newlineKey ? "newline" : chord === "Ctrl+Enter" || chord === "Meta+Enter" ? "accelerated" : "none";
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat) return;
    if (gesture === "send") {
      applyAlwaysPrompts(settings.quickPrompts);
      dispatchKey(root, chordToInit("Enter"));
    } else if (gesture === "newline") {
      dispatchKey(root, chordToInit("Shift+Enter"));
    } else if (gesture === "accelerated") {
      dispatchKey(root, chordToInit("Ctrl+Enter"));
    }
  };
  const onContextMenu = (event) => {
    const root = findComposerRoot(event.target);
    if (root === null) return;
    if (deps.settings().menuNative) {
      if (deps.menuOpen()) deps.setMenu(null);
      event.stopImmediatePropagation();
      event.stopPropagation();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const selection = window.getSelection();
    const hasSelection = selection !== null && !selection.isCollapsed && selection.anchorNode !== null && root.contains(selection.anchorNode);
    deps.setMenu({ x: event.clientX, y: event.clientY, hasSelection });
    prefetchClipboard();
  };
  const onClickSend = (event) => {
    if (replayingSendClick) return;
    const button = sendButtonOf(event.target);
    if (button === null) return;
    if (!applyAlwaysPrompts(deps.settings().quickPrompts)) return;
    event.preventDefault();
    event.stopPropagation();
    replayingSendClick = true;
    try {
      button.click();
    } finally {
      replayingSendClick = false;
    }
  };
  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("contextmenu", onContextMenu, true);
  window.addEventListener("click", onClickSend, true);
  return () => {
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("contextmenu", onContextMenu, true);
    window.removeEventListener("click", onClickSend, true);
  };
}
async function runMenuAction(id) {
  const root = document.querySelector(INPUT_SELECTOR);
  if (root === null) return { ok: false, message: "\u627E\u4E0D\u5230\u8F93\u5165\u6846" };
  if (!document.activeElement || !root.contains(document.activeElement)) {
    if (root.isConnected) {
      root.focus({ preventScroll: true });
    }
  }
  switch (id) {
    case "undo":
      dispatchKey(root, chordToInit("Ctrl+Z"));
      return { ok: true };
    case "redo":
      dispatchKey(root, chordToInit("Ctrl+Y"));
      return { ok: true };
    case "copy":
      return { ok: document.execCommand("copy") };
    case "cut":
      return { ok: document.execCommand("cut") };
    case "delete":
      return { ok: document.execCommand("delete") };
    case "selectAll":
      return { ok: document.execCommand("selectAll") };
    case "paste":
      return pasteText(root);
  }
}
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("clipboard-read timeout"));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
function isClipboardTimeout(error) {
  return error instanceof Error && error.message === "clipboard-read timeout";
}
function isFirefox() {
  return typeof navigator !== "undefined" && /Firefox\//.test(navigator.userAgent);
}
var FIREFOX_TIP = "Firefox \u6BCF\u6B21\u8BFB\u526A\u8D34\u677F\u90FD\u8981\u70B9\u300C\u7C98\u8D34(P)\u300D\u786E\u8BA4\uFF1A\u5730\u5740\u680F\u8F93\u5165 about:config \u2192 \u63A5\u53D7\u98CE\u9669\u7EE7\u7EED \u2192 \u53F3\u952E\u65B0\u5EFA\u300C\u6574\u6570\u300D\u2192 \u540D\u79F0\u586B permissions.default.clipboard-read \u2192 \u503C\u586B 1 \u2192 \u91CD\u8FDB DSH\uFF1B\u4E4B\u540E\u70B9\u4E00\u6B21\u7C98\u8D34\u5373\u6210\u529F\uFF08\u6216\u76F4\u63A5 Ctrl+V\uFF09";
async function pasteText(root) {
  const insertText = (text2) => {
    if (!document.activeElement || !root.contains(document.activeElement)) {
      root.focus({ preventScroll: true });
    }
    if (text2 === "") return { ok: true };
    return { ok: document.execCommand("insertText", false, text2) };
  };
  if (pasteCache !== null && pasteCache !== "") {
    const text2 = pasteCache;
    pasteCache = null;
    return insertText(text2);
  }
  if (typeof navigator === "undefined" || navigator.clipboard === void 0 || typeof navigator.clipboard.readText !== "function") {
    return { ok: false, message: "\u5F53\u524D\u6D4F\u89C8\u5668\u4E0D\u652F\u6301\u8BFB\u53D6\u526A\u8D34\u677F\uFF0C\u8BF7\u7528 Ctrl+V \u7C98\u8D34" };
  }
  const permissions = navigator.permissions;
  if (permissions?.query) {
    try {
      const result = await permissions.query({ name: "clipboard-read" });
      if (result.state === "denied") {
        if (isFirefox()) return { ok: false, message: FIREFOX_TIP };
        return {
          ok: false,
          message: "\u6D4F\u89C8\u5668\u5DF2\u62D2\u7EDD\u526A\u8D34\u677F\u8BFB\u53D6\uFF1A\u70B9\u51FB\u5730\u5740\u680F\u5DE6\u4FA7\u56FE\u6807 \u2192 \u7AD9\u70B9\u8BBE\u7F6E \u2192 \u526A\u8D34\u677F \u2192 \u5141\u8BB8\uFF1B\u6216\u76F4\u63A5\u6309 Ctrl+V"
        };
      }
    } catch {
    }
  }
  let text;
  try {
    text = await withTimeout(navigator.clipboard.readText(), 15e3);
  } catch (error) {
    if (isFirefox()) {
      return { ok: false, message: FIREFOX_TIP };
    }
    if (isClipboardTimeout(error)) {
      return {
        ok: false,
        message: "\u7B49\u5F85\u6D4F\u89C8\u5668\u6388\u6743\u8D85\u65F6\uFF1A\u8BF7\u5728\u5F39\u51FA\u63D0\u793A\u4E2D\u9009\u62E9\u300C\u5141\u8BB8\u300D\uFF08\u82E5\u672A\u51FA\u73B0\uFF0C\u70B9\u5730\u5740\u680F\u5DE6\u4FA7\u56FE\u6807\u5F00\u542F\uFF09\uFF0C\u6216\u6309 Ctrl+V"
      };
    }
    return {
      ok: false,
      message: "\u672A\u83B7\u526A\u8D34\u677F\u8BFB\u53D6\u6388\u6743\uFF1A\u70B9\u51FB\u5730\u5740\u680F\u5DE6\u4FA7\u56FE\u6807 \u2192 \u7AD9\u70B9\u8BBE\u7F6E \u2192 \u526A\u8D34\u677F \u2192 \u5141\u8BB8\uFF1B\u6216\u76F4\u63A5\u6309 Ctrl+V \u7C98\u8D34"
    };
  }
  if (!document.activeElement || !root.contains(document.activeElement)) {
    root.focus({ preventScroll: true });
  }
  if (text === "") return { ok: true };
  return { ok: document.execCommand("insertText", false, text) };
}

// src/client/panel.ts
var PANEL_SELECTOR = '[role="dialog"][aria-modal="true"]:has(> nav)';
var RESIZE_LAYER_CLASS = "dsh-ux-resize-layer";
var RESIZE_OUTLINE_CLASS = "dsh-ux-resize-outline";
var RESIZE_EDGE_CLASS = "dsh-ux-resize-edge";
var RESIZE_GRIP_CLASS = "dsh-ux-resize-grip";
var BAND = 8;
var INSET = 14;
var GRIP = 26;
function handleBox(edge) {
  switch (edge) {
    case "left":
      return { left: 0, top: INSET, bottom: INSET, width: BAND, cursor: "ew-resize" };
    case "right":
      return { right: 0, top: INSET, bottom: INSET, width: BAND, cursor: "ew-resize" };
    case "top":
      return { top: 0, left: INSET, right: INSET, height: BAND, cursor: "ns-resize" };
    case "bottom":
      return { bottom: 0, left: INSET, right: INSET, height: BAND, cursor: "ns-resize" };
    case "br":
      return { right: 8, bottom: 8, width: GRIP, height: GRIP, cursor: "nwse-resize" };
  }
}
var RESIZE_OUTLINE_STYLE = {
  position: "absolute",
  inset: 0,
  // 跟随面板自身的圆角（官方 .panel 是 32px）——用 inherit 而不是写死数字，
  // 官方改圆角时这里自动跟上。
  borderRadius: "inherit",
  border: "1px solid rgba(127, 127, 137, .28)",
  pointerEvents: "none"
};
var PANEL_CSS = `
html.dsh-ux-panel-scroll [role="dialog"][aria-modal="true"]:has(> nav) { min-height: 320px; }
html.dsh-ux-panel-scroll [role="dialog"][aria-modal="true"]:has(> nav) > nav {
  min-height: 0;
}
html.dsh-ux-panel-scroll [role="dialog"][aria-modal="true"]:has(> nav) > nav > div:last-child {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}
html.dsh-ux-panel-scroll [role="dialog"][aria-modal="true"]:has(> nav) > nav > div:last-child::-webkit-scrollbar {
  width: 8px;
}
html.dsh-ux-panel-scroll [role="dialog"][aria-modal="true"]:has(> nav) > nav > div:last-child::-webkit-scrollbar-thumb {
  background: var(--dsh-scrollbar-thumb, var(--dsw-alias-scrollbar-bg-l2));
  border-radius: 8px;
}
html.dsh-ux-panel-scroll [role="dialog"][aria-modal="true"]:has(> nav) > nav > div:last-child::-webkit-scrollbar-thumb:hover {
  background: var(--dsh-scrollbar-thumb-hover, var(--dsw-alias-scrollbar-hover-l2));
}
`;
var RESIZE_CSS = `
.${RESIZE_LAYER_CLASS} { position: absolute; inset: 0; pointer-events: none; }
.${RESIZE_EDGE_CLASS}, .${RESIZE_GRIP_CLASS} {
  position: absolute;
  pointer-events: auto;
  background: transparent;
  border-radius: 6px;
  transition: background-color .12s ease, color .12s ease;
  touch-action: none;
}
.${RESIZE_EDGE_CLASS}:hover { background: rgba(127, 127, 137, .22); }
.${RESIZE_EDGE_CLASS}[data-active="true"] { background: rgba(127, 127, 137, .3); }
.${RESIZE_GRIP_CLASS} {
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 3px;
  color: rgba(127, 127, 137, .55);
}
.${RESIZE_GRIP_CLASS}:hover { color: rgba(127, 127, 137, .95); background: rgba(127, 127, 137, .16); }
`;
function installPanelStyle(settings, subscribe) {
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-composer-ux-panel";
  tag.textContent = `${PANEL_CSS}
${RESIZE_CSS}`;
  document.head.appendChild(tag);
  const applyClass = () => {
    document.documentElement.classList.toggle("dsh-ux-panel-scroll", settings());
  };
  applyClass();
  const unsubscribe = subscribe(applyClass);
  return () => {
    unsubscribe();
    tag.remove();
    document.documentElement.classList.remove("dsh-ux-panel-scroll");
  };
}
function findSettingsPanel() {
  return document.querySelector(PANEL_SELECTOR);
}
function clampPanelWidth(width) {
  return Math.max(560, Math.min(width, Math.max(800, window.innerWidth - 48)));
}
function clampPanelHeight(height) {
  return Math.max(320, Math.min(height, Math.max(400, window.innerHeight - 48)));
}

// src/client/settings-style.ts
var CARD_CSS = `
.dsh-ux-card {
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-3);
  border-radius: 12px;
  margin-bottom: 12px;
  transition: border-color .16s, background .16s;
}
.dsh-ux-card:hover { border-color: var(--dsw-alias-label-dimmed); }
.dsh-ux-cardOpen {
  background: var(--dsw-alias-bg-layer-2);
  border-color: var(--dsw-alias-label-dimmed);
}
.dsh-ux-cardHeader {
  appearance: none;
  box-sizing: border-box;
  width: 100%;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  background: 0 0;
  border: 0;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
}
.dsh-ux-cardHeader:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: -2px;
}
.dsh-ux-cardHeaderStatic {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
}
.dsh-ux-cardHeadText {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 4px;
  min-width: 0;
}
.dsh-ux-cardName {
  color: var(--dsw-alias-label-primary);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  margin: 0;
}
.dsh-ux-cardDescription {
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
}
.dsh-ux-cardChevron {
  color: var(--dsw-alias-label-tertiary);
  flex: none;
  transition: transform .16s;
}
.dsh-ux-cardChevronOpen { transform: rotate(180deg); }
.dsh-ux-cardBody {
  border-top: 1px solid var(--dsw-alias-border-l2);
  margin: 0 16px;
  padding-bottom: 8px;
}
`;
function installSettingsCardStyle() {
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-composer-ux-settings";
  tag.textContent = CARD_CSS;
  document.head.appendChild(tag);
  return () => {
    tag.remove();
  };
}

// src/client/quick-style.ts
var QUICK_BUTTON_CLASS = "composer-ux-quick-button";
var QUICK_BUTTON_CSS = `
.${QUICK_BUTTON_CLASS} {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  border: 1px solid rgba(127, 127, 137, .35);
  background: transparent;
  color: inherit;
  border-radius: 999px;
  padding: 0 9px;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  opacity: .75;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  transition: opacity .12s ease, background-color .12s ease;
}
.${QUICK_BUTTON_CLASS}:hover { opacity: 1; background: rgba(127, 127, 137, .12); }
.${QUICK_BUTTON_CLASS}[aria-expanded="true"] {
  opacity: 1;
  background: rgba(127, 127, 137, .18);
  border-color: rgba(127, 127, 137, .6);
}
.${QUICK_BUTTON_CLASS} svg { flex: 0 0 auto; }
`;
function installQuickButtonStyle() {
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-composer-ux-quick-button";
  tag.textContent = QUICK_BUTTON_CSS;
  document.head.appendChild(tag);
  return () => {
    tag.remove();
  };
}

// src/client/ContextMenuHost.tsx
var import_react = __toESM(require("react"), 1);

// src/client/styles.ts
var description = {
  color: "var(--dsw-alias-label-tertiary)",
  fontSize: 12,
  lineHeight: 1.6,
  margin: "0 0 12px"
};
var row = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  minHeight: 40,
  padding: "7px 0",
  borderTop: "0.5px solid var(--dsw-alias-border-l2)"
};
var rowText = {
  minWidth: 0,
  flex: 1
};
var rowTitle = {
  color: "var(--dsw-alias-label-primary)",
  fontSize: 13,
  lineHeight: 1.4
};
var rowDesc = {
  color: "var(--dsw-alias-label-tertiary)",
  fontSize: 11,
  lineHeight: 1.4,
  marginTop: 2
};
var kbd = {
  color: "var(--dsw-alias-label-primary)",
  background: "var(--dsw-alias-bg-layer-1)",
  border: "0.5px solid var(--dsw-alias-border-l2)",
  borderRadius: 6,
  padding: "3px 8px",
  fontSize: 12,
  fontFamily: "var(--dsw-font-family)",
  whiteSpace: "nowrap"
};
var pill = {
  background: "var(--dsw-alias-interactive-bg-hover)",
  color: "var(--dsw-alias-label-secondary)",
  border: "0.5px solid var(--dsw-alias-border-l2)",
  borderRadius: 999,
  padding: "4px 10px",
  fontSize: 12,
  cursor: "pointer",
  whiteSpace: "nowrap"
};
var pillActive = {
  ...pill,
  color: "var(--dsw-alias-button-primary-fill)",
  borderColor: "var(--dsw-alias-button-primary-fill)"
};
var textInput = {
  background: "var(--dsw-alias-bg-layer-1)",
  color: "var(--dsw-alias-label-primary)",
  border: "0.5px solid var(--dsw-alias-border-l2)",
  borderRadius: 8,
  padding: "6px 9px",
  fontSize: 12,
  lineHeight: 1.4,
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  flex: 1
};
var hintError = {
  color: "var(--dsw-alias-state-error-primary)",
  fontSize: 12,
  lineHeight: 1.5,
  margin: "6px 0 0"
};
var hintInfo = {
  color: "var(--dsw-alias-label-secondary)",
  fontSize: 12,
  lineHeight: 1.5,
  margin: "6px 0 0"
};
var menu = {
  position: "fixed",
  zIndex: 9999,
  minWidth: 200,
  background: "var(--dsw-specific-menu)",
  border: "0.5px solid var(--dsw-alias-border-l1)",
  borderRadius: 10,
  boxShadow: "var(--dsw-elevation-prominent)",
  padding: 5,
  pointerEvents: "auto",
  userSelect: "none"
};
var menuItem = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 24,
  padding: "6px 10px",
  borderRadius: 6,
  fontSize: 13,
  color: "var(--dsw-alias-label-primary)",
  cursor: "pointer",
  background: "transparent",
  border: "none",
  width: "100%",
  textAlign: "left"
};
var menuItemDim = {
  ...menuItem,
  color: "var(--dsw-alias-label-dimmed)",
  cursor: "default"
};
var menuShortcut = {
  color: "var(--dsw-alias-label-tertiary)",
  fontSize: 12,
  fontFamily: "var(--dsw-font-family)"
};
var menuSeparator = {
  height: 0,
  borderTop: "0.5px solid var(--dsw-alias-border-l2)",
  margin: "4px 8px"
};
var menuNote = {
  color: "var(--dsw-alias-state-warn-label)",
  fontSize: 11,
  lineHeight: 1.4,
  padding: "4px 10px 2px"
};
var quickPanel = {
  position: "fixed",
  zIndex: 9999,
  width: 420,
  maxWidth: "calc(100vw - 24px)",
  maxHeight: "min(60vh, 520px)",
  display: "flex",
  flexDirection: "column",
  background: "var(--dsw-specific-menu)",
  border: "0.5px solid var(--dsw-alias-border-l1)",
  borderRadius: 12,
  boxShadow: "var(--dsw-elevation-prominent)",
  pointerEvents: "auto",
  overflow: "hidden"
};
var quickPanelHead = {
  padding: "10px 12px 8px",
  borderBottom: "0.5px solid var(--dsw-alias-border-l2)",
  display: "flex",
  flexDirection: "column",
  gap: 8
};
var quickPanelTitleRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8
};
var quickPanelTitle = {
  color: "var(--dsw-alias-label-primary)",
  fontSize: 13,
  fontWeight: 600
};
var quickTierRow = {
  display: "inline-flex",
  gap: 2,
  padding: 2,
  borderRadius: 999,
  background: "var(--dsw-alias-bg-layer-1)",
  border: "0.5px solid var(--dsw-alias-border-l2)"
};
var quickTierButton = {
  border: "none",
  background: "transparent",
  color: "var(--dsw-alias-label-tertiary)",
  fontSize: 11,
  lineHeight: 1,
  padding: "4px 8px",
  borderRadius: 999,
  cursor: "pointer",
  whiteSpace: "nowrap"
};
var quickTierButtonActive = {
  ...quickTierButton,
  background: "var(--dsw-alias-button-primary-fill)",
  color: "var(--dsw-alias-label-primary-foreground)"
};
var quickPrimaryButton = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  width: "100%",
  padding: "7px 12px",
  borderRadius: 8,
  border: "0.5px solid var(--dsw-alias-button-primary-fill)",
  background: "var(--dsw-alias-button-primary-fill)",
  color: "var(--dsw-alias-label-primary-foreground)",
  fontSize: 12,
  cursor: "pointer"
};
var quickPrimaryButtonDisabled = {
  ...quickPrimaryButton,
  opacity: 0.4,
  cursor: "default"
};
var quickList = {
  overflowY: "auto",
  padding: "6px 6px 8px",
  display: "flex",
  flexDirection: "column",
  gap: 2
};
var quickItem = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "5px 8px",
  borderRadius: 7,
  cursor: "pointer",
  background: "transparent",
  border: "none",
  flex: "1 1 auto",
  minWidth: 0,
  textAlign: "left"
};
var quickItemLabel = {
  color: "var(--dsw-alias-label-primary)",
  fontSize: 12,
  flex: "0 0 auto",
  whiteSpace: "nowrap"
};
var quickItemPreview = {
  color: "var(--dsw-alias-label-tertiary)",
  fontSize: 11,
  flex: "1 1 auto",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};
var quickAlwaysLabel = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  flex: "0 0 auto",
  color: "var(--dsw-alias-label-tertiary)",
  fontSize: 11,
  whiteSpace: "nowrap",
  cursor: "pointer"
};
var quickAlwaysBox = {
  margin: 0,
  cursor: "pointer"
};
var quickPanelFoot = {
  padding: "5px 12px 7px",
  borderTop: "0.5px solid var(--dsw-alias-border-l2)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8
};
var quickNotice = {
  color: "var(--dsw-alias-state-warn-label)",
  fontSize: 11,
  lineHeight: 1.4,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis"
};
var quickFootHint = {
  color: "var(--dsw-alias-label-tertiary)",
  fontSize: 11,
  whiteSpace: "nowrap",
  flex: "0 0 auto"
};
var quickEmpty = {
  color: "var(--dsw-alias-label-tertiary)",
  fontSize: 12,
  lineHeight: 1.6,
  padding: "14px 10px",
  textAlign: "center"
};

// src/client/ContextMenuHost.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var GROUPS = [
  [
    { label: "\u64A4\u9500", shortcut: "Ctrl+Z", field: "menuUndo", id: "undo" },
    { label: "\u91CD\u505A", shortcut: "Ctrl+Y", field: "menuRedo", id: "redo" }
  ],
  [
    { label: "\u526A\u5207", shortcut: "Ctrl+X", field: "menuCut", id: "cut" },
    { label: "\u590D\u5236", shortcut: "Ctrl+C", field: "menuCopy", id: "copy" },
    { label: "\u7C98\u8D34", shortcut: "Ctrl+V", field: "menuPaste", id: "paste" },
    { label: "\u5220\u9664", shortcut: "", field: "menuDelete", id: "delete" }
  ],
  [
    { label: "\u5168\u9009", shortcut: "Ctrl+A", field: "menuSelectAll", id: "selectAll" }
  ]
];
var ITEM_STYLES = {
  undo: "always",
  redo: "always",
  cut: "selection",
  copy: "selection",
  paste: "always",
  delete: "selection",
  selectAll: "always"
};
function clamp(value, size, viewport) {
  return Math.max(8, Math.min(value, viewport - size - 8));
}
function ContextMenuHost({ useMenu, useLive, actions }) {
  const menuState = useMenu((item) => item);
  const settings = useLive((item) => item);
  const ref = (0, import_react.useRef)(null);
  const [position, setPosition] = (0, import_react.useState)(null);
  (0, import_react.useLayoutEffect)(() => {
    if (menuState === null) {
      setPosition(null);
      return;
    }
    const el = ref.current;
    if (el === null) return;
    const rect = el.getBoundingClientRect();
    setPosition({
      x: clamp(menuState.x, rect.width, window.innerWidth),
      y: clamp(menuState.y, rect.height, window.innerHeight)
    });
  }, [menuState?.x, menuState?.y]);
  (0, import_react.useEffect)(() => {
    if (menuState === null) return;
    const onPointerDown = (event) => {
      if (ref.current !== null && event.target instanceof Node && ref.current.contains(event.target)) return;
      actions.close();
    };
    const onEscape = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      actions.close();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onEscape, true);
    window.addEventListener("scroll", actions.close, true);
    window.addEventListener("resize", actions.close);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onEscape, true);
      window.removeEventListener("scroll", actions.close, true);
      window.removeEventListener("resize", actions.close);
    };
  }, [menuState === null, actions]);
  (0, import_react.useEffect)(() => {
    if (menuState?.note === void 0) return;
    const timer = setTimeout(() => {
      actions.note(void 0);
    }, 3e3);
    return () => {
      clearTimeout(timer);
    };
  }, [menuState?.note]);
  if (menuState === null) return null;
  const onItemClick = (id) => {
    if (id === "paste") actions.note("\u6B63\u5728\u8BFB\u53D6\u526A\u8D34\u677F\u2026");
    void actions.run(id).then((result) => {
      if (result.ok) actions.close();
      else actions.note(result.message ?? "\u64CD\u4F5C\u5931\u8D25");
    });
  };
  const groups = GROUPS.map((group) => group.filter((item) => settings[item.field] === true)).filter((group) => group.length > 0);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      ref,
      role: "menu",
      style: {
        ...menu,
        left: position?.x ?? menuState.x,
        top: position?.y ?? menuState.y
      },
      children: [
        groups.map((group, groupIndex) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react.default.Fragment, { children: [
          groupIndex > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { role: "separator", style: menuSeparator }),
          group.map((item) => {
            const needsSelection = ITEM_STYLES[item.id] === "selection";
            const disabled = needsSelection && !menuState.hasSelection;
            const style = disabled ? menuItemDim : menuItem;
            return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "button",
              {
                type: "button",
                role: "menuitem",
                disabled,
                style,
                onMouseDown: (event) => {
                  event.preventDefault();
                },
                onClick: () => {
                  onItemClick(item.id);
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.label }),
                  item.shortcut !== "" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: menuShortcut, children: item.shortcut })
                ]
              },
              item.field
            );
          })
        ] }, group[0].field)),
        menuState.note !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: menuNote, children: menuState.note })
      ]
    }
  );
}

// src/client/PanelResizeHandles.tsx
var import_react2 = require("react");
var import_react_dom = require("react-dom");
var import_jsx_runtime2 = require("react/jsx-runtime");
var EDGES = ["left", "right", "top", "bottom", "br"];
function PanelResizeHandles({ useLive, actions }) {
  const settings = useLive((value) => ({
    enabled: value.enabled,
    panelResize: value.panelResize,
    panelWidth: value.panelWidth,
    panelHeight: value.panelHeight
  }));
  const enabled = settings.enabled === true && settings.panelResize === true;
  const [panel, setPanel] = (0, import_react2.useState)(null);
  const [active, setActive] = (0, import_react2.useState)(null);
  const dragRef = (0, import_react2.useRef)(null);
  (0, import_react2.useEffect)(() => {
    if (!enabled) {
      setPanel(null);
      return;
    }
    let current = null;
    const probe = () => {
      const found = findSettingsPanel();
      if (found === current) return;
      current = found;
      setPanel(found);
    };
    probe();
    const timer = setInterval(probe, 250);
    return () => {
      clearInterval(timer);
    };
  }, [enabled]);
  (0, import_react2.useEffect)(() => {
    if (panel === null) return;
    const width = settings.panelWidth;
    const height = settings.panelHeight;
    if (width === void 0) panel.style.removeProperty("width");
    else panel.style.width = `${clampPanelWidth(width)}px`;
    if (height === void 0) panel.style.removeProperty("height");
    else panel.style.height = `${clampPanelHeight(height)}px`;
  }, [panel, settings.panelWidth, settings.panelHeight]);
  if (!enabled || panel === null) return null;
  const onPointerDown = (edge, event) => {
    event.preventDefault();
    event.stopPropagation();
    const el = panel;
    const rect = el.getBoundingClientRect();
    el.style.position = "fixed";
    el.style.margin = "0";
    el.style.left = `${rect.left}px`;
    el.style.top = `${rect.top}px`;
    el.style.width = `${rect.width}px`;
    el.style.height = `${rect.height}px`;
    const start = {
      edge,
      x: event.clientX,
      y: event.clientY,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    };
    dragRef.current = start;
    setActive(edge);
    document.body.style.cursor = String(handleBox(edge).cursor ?? "default");
    document.body.style.userSelect = "none";
    const onMove = (move) => {
      if (dragRef.current !== start) return;
      move.preventDefault();
      const dx = move.clientX - start.x;
      const dy = move.clientY - start.y;
      let { left, top, width, height } = start;
      if (edge === "right" || edge === "br") width = clampPanelWidth(start.width + dx);
      if (edge === "bottom" || edge === "br") height = clampPanelHeight(start.height + dy);
      if (edge === "left") {
        width = clampPanelWidth(start.width - dx);
        left = start.left + (start.width - width);
      }
      if (edge === "top") {
        height = clampPanelHeight(start.height - dy);
        top = start.top + (start.height - height);
      }
      el.style.left = `${Math.round(left)}px`;
      el.style.top = `${Math.round(top)}px`;
      el.style.width = `${Math.round(width)}px`;
      el.style.height = `${Math.round(height)}px`;
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      dragRef.current = null;
      setActive(null);
      const box = el.getBoundingClientRect();
      actions.setField(PANEL_WIDTH_FIELD, Math.round(clampPanelWidth(box.width)));
      actions.setField(PANEL_HEIGHT_FIELD, Math.round(clampPanelHeight(box.height)));
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  return (0, import_react_dom.createPortal)(
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: RESIZE_LAYER_CLASS, "data-composer-ux-resize": true, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: RESIZE_OUTLINE_CLASS, style: RESIZE_OUTLINE_STYLE }),
      EDGES.map((edge) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "div",
        {
          className: edge === "br" ? RESIZE_GRIP_CLASS : RESIZE_EDGE_CLASS,
          "data-active": active === edge ? "true" : void 0,
          title: edge === "br" ? "\u62D6\u52A8\u6539\u9762\u677F\u5927\u5C0F" : void 0,
          style: handleBox(edge),
          onPointerDown: (event) => {
            onPointerDown(edge, event);
          },
          children: edge === "br" && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { width: "12", height: "12", viewBox: "0 0 12 12", "aria-hidden": true, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "path",
            {
              d: "M11 1 1 11M11 6 6 11",
              stroke: "currentColor",
              strokeWidth: "1.3",
              strokeLinecap: "round"
            }
          ) })
        },
        edge
      ))
    ] }),
    panel
  );
}

// src/client/SettingsSection.tsx
var import_react3 = require("react");
var import_jsx_runtime3 = require("react/jsx-runtime");
var bodyLead = { ...description, margin: "12px 0" };
function Chevron() {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("svg", { width: "14", height: "14", viewBox: "0 0 14 14", fill: "none", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "path",
    {
      d: "M3.25 5.5L7 9.25L10.75 5.5",
      stroke: "currentColor",
      strokeWidth: "1.4",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }
  ) });
}
function FoldCard(props) {
  const [open, setOpen] = (0, import_react3.useState)(false);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: open ? "dsh-ux-card dsh-ux-cardOpen" : "dsh-ux-card", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      "button",
      {
        type: "button",
        className: "dsh-ux-cardHeader",
        "aria-expanded": open,
        onClick: () => {
          setOpen((current) => !current);
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dsh-ux-cardHeadText", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-ux-cardName", children: props.name }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dsh-ux-cardDescription", children: props.summary })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: open ? "dsh-ux-cardChevron dsh-ux-cardChevronOpen" : "dsh-ux-cardChevron", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Chevron, {}) })
        ]
      }
    ),
    open && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dsh-ux-cardBody", children: props.children })
  ] });
}
function KeyRow(props) {
  const { title, desc, value, presets, conflict, onChange, first } = props;
  const [recording, setRecording] = (0, import_react3.useState)(false);
  const [error, setError] = (0, import_react3.useState)(null);
  (0, import_react3.useEffect)(() => {
    if (!recording) return;
    const onKeyDown = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.isComposing) return;
      const result = evaluateRecordedKey(event);
      if (result.kind === "ignore") return;
      if (result.kind === "cancel") {
        setRecording(false);
        setError(null);
        return;
      }
      if (result.kind === "clear") {
        setRecording(false);
        setError(null);
        onChange("");
        return;
      }
      if (result.kind === "reject") {
        setError(result.message);
        return;
      }
      if (conflict(result.chord)) {
        setRecording(false);
        setError("\u53D1\u9001\u4E0E\u6362\u884C\u4E0D\u80FD\u8BBE\u4E3A\u76F8\u540C\u6309\u952E\uFF08\u53EF\u5148\u7ED9\u53E6\u4E00\u4FA7\u6362\u952E\uFF0C\u518D\u7ED1\u5B9A\u8BE5\u952E\uFF09\u3002");
        return;
      }
      setRecording(false);
      setError(null);
      onChange(result.chord);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [recording, conflict, onChange]);
  const base = first === true ? { ...row, borderTop: "none" } : row;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { ...base, flexDirection: "column", alignItems: "stretch", gap: 8 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: rowText, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: rowTitle, children: title }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: rowDesc, children: desc })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: kbd, children: displayChord(value) }),
      !recording && presets.map((preset) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "button",
        {
          type: "button",
          style: value === preset ? pillActive : pill,
          onClick: () => {
            setError(null);
            onChange(preset);
          },
          children: displayChord(preset)
        },
        preset
      )),
      !recording && value !== "" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", style: pill, onClick: () => {
        setError(null);
        onChange("");
      }, children: "\u6E05\u9664" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "button",
        {
          type: "button",
          style: recording ? pillActive : pill,
          onClick: () => {
            setRecording(true);
            setError(null);
          },
          children: recording ? "\u8BF7\u6309\u4E0B\u65B0\u7EC4\u5408\u952E\u2026" : "\u81EA\u5B9A\u4E49\u2026"
        }
      ),
      recording && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", style: pill, onClick: () => {
        setRecording(false);
        setError(null);
      }, children: "Esc \u53D6\u6D88" }),
      error !== null && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { color: "var(--dsw-alias-state-error-primary)", fontSize: 12 }, children: error })
    ] })
  ] });
}
function ToggleRow(props) {
  const { label, desc, checked, onChange, first } = props;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: first === true ? { ...row, borderTop: "none" } : row, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: rowText, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: rowTitle, children: label }),
      desc !== void 0 && desc !== "" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: rowDesc, children: desc })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "button",
      {
        type: "button",
        role: "switch",
        "aria-checked": checked,
        onClick: () => {
          onChange(!checked);
        },
        style: {
          width: 36,
          height: 20,
          borderRadius: 999,
          border: "0.5px solid var(--dsw-alias-border-l2)",
          cursor: "pointer",
          background: checked ? "var(--dsw-alias-button-primary-fill)" : "var(--dsw-alias-interactive-bg-hover)",
          position: "relative",
          flex: "0 0 auto",
          padding: 0
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "span",
          {
            style: {
              position: "absolute",
              top: 2,
              left: checked ? 18 : 2,
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: checked ? "var(--dsw-alias-label-primary-foreground)" : "var(--dsw-alias-label-secondary)",
              transition: "left 0.12s ease"
            }
          }
        )
      }
    )
  ] });
}
function TextFieldRow(props) {
  const { title, desc, value, placeholder, maxLength, onChange, action, first } = props;
  const [draft, setDraft] = (0, import_react3.useState)(value);
  const focused = (0, import_react3.useRef)(false);
  (0, import_react3.useEffect)(() => {
    if (!focused.current) setDraft(value);
  }, [value]);
  const commit = () => {
    if (draft === value) return;
    onChange(draft.trim());
  };
  const base = first === true ? { ...row, borderTop: "none" } : row;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { ...base, flexDirection: "column", alignItems: "stretch", gap: 8 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: rowText, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: rowTitle, children: title }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: rowDesc, children: desc })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "input",
        {
          type: "text",
          value: draft,
          placeholder: placeholder ?? "",
          maxLength,
          spellCheck: false,
          autoCorrect: "off",
          autoCapitalize: "off",
          onFocus: () => {
            focused.current = true;
          },
          onChange: (event) => {
            setDraft(event.target.value);
          },
          onBlur: () => {
            focused.current = false;
            commit();
          },
          onKeyDown: (event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            commit();
            event.currentTarget.blur();
          },
          style: textInput
        }
      ),
      action !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", style: pill, onClick: action.onClick, children: action.label })
    ] })
  ] });
}
function QuickPromptsEditor(props) {
  const [rows, setRows] = (0, import_react3.useState)(() => props.items.map((item) => ({ ...item })));
  const [dirty, setDirty] = (0, import_react3.useState)(false);
  const update = (id, patch) => {
    setDirty(true);
    setRows((current) => current.map((row2) => row2.id === id ? { ...row2, ...patch } : row2));
  };
  const remove = (id) => {
    setDirty(true);
    setRows((current) => current.filter((row2) => row2.id !== id));
  };
  const add = () => {
    if (rows.length >= QUICK_PROMPT_MAX) return;
    setDirty(true);
    setRows((current) => current.concat([{
      id: newQuickPromptId(),
      label: "",
      prompt: "",
      always: false
    }]));
  };
  const move = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    setDirty(true);
    setRows((current) => {
      const next = [...current];
      const [row2] = next.splice(index, 1);
      next.splice(target, 0, row2);
      return next;
    });
  };
  const save = () => {
    const cleaned = rows.map((row2) => ({
      ...row2,
      prompt: row2.prompt.trim(),
      label: row2.label.trim() === "" ? row2.prompt.trim().slice(0, 12) : row2.label.trim()
    })).filter((row2) => row2.prompt !== "");
    props.onSave(cleaned);
    setRows(cleaned);
    setDirty(false);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: [
    rows.map((row2, index) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 6,
          padding: 8,
          borderRadius: 8,
          border: "0.5px solid var(--dsw-alias-border-l2)",
          background: "var(--dsw-alias-bg-layer-1)"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 6 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "input",
              {
                type: "text",
                value: row2.label,
                placeholder: "\u540D\u79F0\uFF0C\u5982\uFF1A\u4EC5\u8BF4\u660E\u539F\u56E0",
                maxLength: QUICK_LABEL_MAX,
                spellCheck: false,
                onChange: (event) => {
                  update(row2.id, { label: event.target.value });
                },
                style: { ...textInput, flex: "0 0 150px" }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("label", { style: { display: "inline-flex", alignItems: "center", gap: 4, ...rowDesc, margin: 0, flex: "0 0 auto" }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                "input",
                {
                  type: "checkbox",
                  checked: row2.always,
                  style: { margin: 0, cursor: "pointer" },
                  onChange: (event) => {
                    update(row2.id, { always: event.target.checked });
                  }
                }
              ),
              "\u9ED8\u8BA4\u63D2\u5165"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { flex: 1 } }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", style: pill, title: "\u4E0A\u79FB", onClick: () => {
              move(index, -1);
            }, children: "\u2191" }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", style: pill, title: "\u4E0B\u79FB", onClick: () => {
              move(index, 1);
            }, children: "\u2193" }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", style: pill, title: "\u5220\u9664\u8FD9\u6761", onClick: () => {
              remove(row2.id);
            }, children: "\u2715" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "textarea",
            {
              value: row2.prompt,
              placeholder: "\u63D0\u793A\u8BCD\u6B63\u6587\uFF1A\u70B9\u51FB\u8BE5\u6761\u76EE\u65F6\u63D2\u5165\u8F93\u5165\u6846\uFF1B\u52FE\u4E86\u300C\u9ED8\u8BA4\u63D2\u5165\u300D\u5219\u5728\u53D1\u9001\u65F6\u81EA\u52A8\u9644\u52A0\u5230\u6D88\u606F\u672B\u5C3E",
              maxLength: QUICK_TEXT_MAX,
              spellCheck: false,
              rows: Math.min(4, Math.max(2, Math.ceil(row2.prompt.length / 46))),
              onChange: (event) => {
                update(row2.id, { prompt: event.target.value });
              },
              style: { ...textInput, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }
            }
          )
        ]
      },
      row2.id
    )),
    rows.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { style: rowDesc, children: "\u8FD8\u6CA1\u6709\u6761\u76EE\u3002\u70B9\u4E0B\u9762\u7684\u300C+ \u6DFB\u52A0\u4E00\u6761\u300D\u5F00\u59CB\u5EFA\u81EA\u5DF1\u7684\u5FEB\u6377\u6307\u4EE4\u3002" }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", style: pill, onClick: add, children: "+ \u6DFB\u52A0\u4E00\u6761" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "button",
        {
          type: "button",
          style: dirty ? pillActive : pill,
          onClick: save,
          disabled: !dirty,
          children: dirty ? "\u4FDD\u5B58\u4FEE\u6539" : "\u5DF2\u4FDD\u5B58"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { style: rowDesc, children: [
        "\u5171 ",
        rows.length,
        " / ",
        QUICK_PROMPT_MAX,
        " \u6761 \xB7 \u52FE\u4E86\u300C\u9ED8\u8BA4\u63D2\u5165\u300D\u7684\uFF1A",
        rows.filter((row2) => row2.always).length,
        " \u6761"
      ] })
    ] })
  ] });
}
function SettingsSection({ useLive, actions }) {
  const settings = useLive((item) => item);
  const [conflict, setConflict] = (0, import_react3.useState)(null);
  const setKey = (side, chord) => {
    const other = side === "send" ? settings.newlineKey : settings.sendKey;
    if (chord !== "" && chord === other) {
      setConflict(chord);
      return;
    }
    setConflict(null);
    actions.setField(side === "send" ? "sendKey" : "newlineKey", chord);
  };
  const conflictHint = conflict !== null ? `\u300C${displayChord(conflict)}\u300D\u5DF2\u88AB\u53E6\u4E00\u4FA7\u5360\u7528\uFF0C\u8BF7\u5148\u4E3A\u53E6\u4E00\u4FA7\u9009\u62E9\u5176\u5B83\u6309\u952E\u3002` : null;
  const menuEnabled = MENU_ITEMS.filter((item) => settings[item.field]).length;
  const keySummary = `\u53D1\u9001 ${displayChord(settings.sendKey)} \xB7 \u6362\u884C ${displayChord(settings.newlineKey)}`;
  const menuSummary = settings.menuNative ? "\u5F53\u524D\uFF1A\u7CFB\u7EDF\u539F\u751F\u83DC\u5355\uFF08\u7C98\u8D34\u514D\u6388\u6743\uFF09" : `\u5F53\u524D\uFF1A\u81EA\u5B9A\u4E49\u83DC\u5355 \xB7 ${menuEnabled} / ${MENU_ITEMS.length} \u9879\u5F00\u542F`;
  const panelSummary = `\u5BFC\u822A\u6EDA\u52A8 ${settings.panelScroll ? "\u5F00" : "\u5173"} \xB7 \u8FB9\u7F18\u7F29\u653E ${settings.panelResize ? "\u5F00" : "\u5173"} \xB7 ${settings.panelWidth}\xD7${settings.panelHeight}`;
  const headerSummary = settings.headerEnabled ? settings.headerStatus === "" ? "\u5DF2\u542F\u7528" : settings.headerStatus : "\u672A\u542F\u7528";
  const alwaysCount = settings.quickPrompts.filter((item) => item.always).length;
  const quickSummary = `${settings.quickPrompts.length} \u6761 \xB7 \u9ED8\u8BA4\u63D2\u5165 ${alwaysCount} \u6761 \xB7 \u4F18\u5316\u6863\u4F4D ${OPTIMIZER_TIERS.find((item) => item.id === settings.optimizerTier)?.label ?? "\u9AD8\u7EA7"}`;
  const headerStatusText = settings.headerEnabled ? settings.headerStatus === "" ? "\u7B49\u5F85\u9996\u6B21\u5199\u5165\u2026" : settings.headerStatus : "\u672A\u542F\u7528\uFF08\u6253\u5F00\u4E0A\u65B9\u5F00\u5173\u5373\u5199\u5165\uFF09";
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { padding: "4px 2px" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "dsh-ux-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dsh-ux-cardHeaderStatic", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "dsh-ux-cardHeadText", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h2", { className: "dsh-ux-cardName", children: "\u8F93\u5165\u4F53\u9A8C" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dsh-ux-cardDescription", children: "dsh-composer-ux \xB7 \u4E3B\u804A\u5929\u8F93\u5165\u6846\u7684\u952E\u4F4D\u3001\u53F3\u952E\u83DC\u5355\u4E0E\u8BBE\u7F6E\u9762\u677F\uFF1B\u8BBE\u7F6E\u5373\u65F6\u751F\u6548\u5E76\u6301\u4E45\u4FDD\u5B58\u3002" })
      ] }) }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dsh-ux-cardBody", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          ToggleRow,
          {
            first: true,
            label: "\u542F\u7528\u8F93\u5165\u589E\u5F3A",
            desc: "\u5173\u95ED\u540E\u952E\u4F4D\u3001\u53F3\u952E\u83DC\u5355\u4E0E\u8BBE\u7F6E\u9762\u677F\u6EDA\u52A8/\u7F29\u653E\u5168\u90E8\u505C\u7528\uFF08\u672C\u9875\u4FDD\u7559\u7528\u4E8E\u91CD\u65B0\u5F00\u542F\uFF09",
            checked: settings.enabled,
            onChange: (next) => {
              actions.setField(ENABLED_FIELD, next);
            }
          }
        ),
        !settings.enabled && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { style: hintInfo, children: "\u5DF2\u505C\u7528\uFF1A\u53D1\u9001/\u6362\u884C\u952E\u4F4D\u3001\u53F3\u952E\u83DC\u5355\u3001\u8BBE\u7F6E\u9762\u677F\u6EDA\u52A8\u4E0E\u8FB9\u7F18\u7F29\u653E\u5747\u4E0D\u518D\u751F\u6548\uFF0C\u8F93\u5165\u6846\u6062\u590D DSH \u539F\u751F\u884C\u4E3A\u3002 \u6253\u5F00\u4E0A\u65B9\u5F00\u5173\u5373\u53EF\u4E00\u952E\u6062\u590D\uFF1B\u6240\u6709\u8BBE\u7F6E\u503C\u4ECD\u4FDD\u7559\u3002" })
      ] })
    ] }),
    settings.enabled && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(FoldCard, { name: "\u952E\u4F4D", summary: keySummary, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { style: bodyLead, children: "\u652F\u6301\u5E38\u7528\u9884\u8BBE\uFF0C\u4E5F\u53EF\u4EE5\u70B9\u51FB\u300C\u81EA\u5B9A\u4E49\u2026\u300D\u540E\u76F4\u63A5\u6309\u4E0B\u4EFB\u610F\u7EC4\u5408\u952E\u5F55\u5236\uFF08Esc \u53D6\u6D88\uFF0CBackspace \u6E05\u9664\uFF09\u3002 \u672A\u7ED1\u5B9A\u7684 Enter \u7CFB\u6309\u952E\u4E0D\u4F1A\u89E6\u53D1\u53D1\u9001\u6216\u6362\u884C\uFF1BCtrl+Enter / \u2318+Enter \u672A\u88AB\u7ED1\u5B9A\u65F6\u4FDD\u7559\u539F\u300C\u52A0\u901F\u63D0\u4EA4\u300D\u884C\u4E3A\uFF1B \u4E2D\u6587\u8F93\u5165\u6CD5\u7EC4\u5408\u671F\u95F4\u4E0D\u53D7\u5F71\u54CD\u3002" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          KeyRow,
          {
            first: true,
            title: "\u53D1\u9001\u952E",
            desc: "\u6309\u4E0B\u540E\u53D1\u9001\u5F53\u524D\u8F93\u5165",
            value: settings.sendKey,
            presets: SEND_PRESETS,
            conflict: (chord) => chord !== "" && chord === settings.newlineKey,
            onChange: (chord) => {
              setKey("send", chord);
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          KeyRow,
          {
            title: "\u6362\u884C\u952E",
            desc: "\u6309\u4E0B\u540E\u5728\u8F93\u5165\u5185\u6362\u884C",
            value: settings.newlineKey,
            presets: NEWLINE_PRESETS,
            conflict: (chord) => chord !== "" && chord === settings.sendKey,
            onChange: (chord) => {
              setKey("newline", chord);
            }
          }
        ),
        conflictHint !== null && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { style: hintError, children: conflictHint }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { marginTop: 10 }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "button",
          {
            type: "button",
            style: pill,
            onClick: () => {
              setConflict(null);
              actions.resetAll();
            },
            children: "\u6062\u590D\u9ED8\u8BA4"
          }
        ) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(FoldCard, { name: "\u53F3\u952E\u83DC\u5355", summary: menuSummary, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { style: bodyLead, children: "\u53F3\u952E\u70B9\u51FB\u8F93\u5165\u6846\u65F6\u7684\u884C\u4E3A\u3002\u7CFB\u7EDF\u539F\u751F\u6A21\u5F0F\u4E0B\u7531\u6D4F\u89C8\u5668\u5F39\u51FA\u81EA\u5DF1\u7684\u83DC\u5355\uFF08\u6837\u5F0F\u968F\u6D4F\u89C8\u5668\u800C\u53D8\u5316\uFF0C \u7C98\u8D34\u514D\u6388\u6743\u3001\u96F6\u914D\u7F6E\uFF09\uFF1B\u81EA\u5B9A\u4E49\u6A21\u5F0F\u4F7F\u7528\u56FA\u5B9A\u6837\u5F0F\u83DC\u5355\uFF08\u672A\u9009\u4E2D\u6587\u672C\u65F6\u300C\u526A\u5207 / \u590D\u5236 / \u5220\u9664\u300D\u7F6E\u7070\uFF0C \u7C98\u8D34\u9700\u8981\u6D4F\u89C8\u5668\u526A\u8D34\u677F\u6388\u6743\uFF0CFirefox \u8981\u5728 about:config \u4E2D\u8BBE\u7F6E permissions.default.clipboard-read = 1 \u624D\u80FD\u514D\u5F39\u7A97\uFF09\u3002" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          ToggleRow,
          {
            first: true,
            label: "\u4F7F\u7528\u7CFB\u7EDF\u539F\u751F\u83DC\u5355",
            desc: "\u6253\u5F00\u540E\u53F3\u952E\u7C98\u8D34\u514D\u6388\u6743\uFF08\u70B9\u51FB\u6D4F\u89C8\u5668\u83DC\u5355\u7684\u7C98\u8D34\u76F4\u63A5\u6210\u529F\uFF09\uFF1B\u5173\u95ED\u540E\u6062\u590D\u81EA\u5B9A\u4E49\u83DC\u5355",
            checked: settings.menuNative,
            onChange: (next) => {
              actions.setField(MENU_NATIVE_FIELD, next);
            }
          }
        ),
        !settings.menuNative && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
          MENU_ITEMS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            ToggleRow,
            {
              label: item.label,
              desc: item.shortcut !== "" ? `\u5FEB\u6377\u952E ${item.shortcut}` : "",
              checked: settings[item.field],
              onChange: (next) => {
                actions.setField(item.field, next);
              }
            },
            item.field
          )),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { marginTop: 10 }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "button",
            {
              type: "button",
              style: pill,
              onClick: () => {
                for (const item of MENU_ITEMS) actions.setField(item.field, true);
              },
              children: "\u5168\u90E8\u5F00\u542F"
            }
          ) })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(FoldCard, { name: "\u5FEB\u6377\u6307\u4EE4", summary: quickSummary, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { style: bodyLead, children: "\u8F93\u5165\u6846\u5DE5\u5177\u884C\u91CC\u90A3\u4E2A\u300C\u5FEB\u6377\u6307\u4EE4\u300D\u6309\u94AE\u70B9\u5F00\u5C31\u662F\u8FD9\u5F20\u6E05\u5355\uFF1A\u70B9\u6761\u76EE\u628A\u5185\u5BB9\u63D2\u5165\u8F93\u5165\u6846\uFF1B \u6761\u76EE\u53F3\u4FA7\u52FE\u4E0A\u300C\u9ED8\u8BA4\u63D2\u5165\u300D\uFF0C\u5219\u5728\u4F60**\u70B9\u53D1\u9001\u65F6**\u628A\u8FD9\u6761\u63D0\u793A\u8BCD\u81EA\u52A8\u9644\u52A0\u5230\u6D88\u606F**\u672B\u5C3E** \u4E00\u8D77\u53D1\u51FA\u53BB\uFF08\u591A\u6761\u6309\u5217\u8868\u987A\u5E8F\u62FC\u63A5\uFF0C\u8F93\u5165\u6846\u91CC\u4E0D\u63D0\u524D\u663E\u793A\uFF09\u3002 \u300C\u4F18\u5316\u63D0\u793A\u8BCD\u300D\u4F1A\u7528\u53E6\u4E00\u4E2A AI \u628A\u8F93\u5165\u6846\u91CC\u7684\u8BDD\u6574\u7406\u6210\u4E00\u6761\u80FD\u76F4\u63A5\u53D1\u51FA\u53BB\u7684\u6E05\u6670\u6307\u4EE4\uFF0C \u7ED3\u679C\u76F4\u63A5\u5199\u56DE\u8F93\u5165\u6846\uFF08Ctrl+Z \u53EF\u8FD8\u539F\uFF09\u2014\u2014\u4E0D\u4F1A\u6C61\u67D3\u5F53\u524D\u5BF9\u8BDD\uFF0C\u4E5F\u4E0D\u5360\u4F60\u7684\u5BF9\u8BDD\u8F6E\u6B21\u3002" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { ...row, borderTop: "none", flexDirection: "column", alignItems: "stretch", gap: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: rowText, children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: rowTitle, children: "\u4F18\u5316\u5F3A\u5EA6" }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: rowDesc, children: OPTIMIZER_TIERS.find((item) => item.id === settings.optimizerTier)?.hint ?? "" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }, children: OPTIMIZER_TIERS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "button",
            {
              type: "button",
              title: item.hint,
              style: settings.optimizerTier === item.id ? pillActive : pill,
              onClick: () => {
                actions.setField(OPTIMIZER_TIER_FIELD, item.id);
              },
              children: item.label
            },
            item.id
          )) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { ...row, borderTop: "none", flexDirection: "column", alignItems: "stretch", gap: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: rowText, children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: rowTitle, children: "\u5FEB\u6377\u6307\u4EE4\u6E05\u5355" }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: rowDesc, children: "\u5185\u7F6E 9 \u6761\u53EF\u4EE5\u76F4\u63A5\u7528\uFF1B\u6539\u5B8C\u8BB0\u5F97\u70B9\u300C\u4FDD\u5B58\u4FEE\u6539\u300D\u3002" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            QuickPromptsEditor,
            {
              items: settings.quickPrompts,
              onSave: (next) => {
                actions.setField(QUICK_PROMPTS_FIELD, next);
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { display: "flex", gap: 8 }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "button",
            {
              type: "button",
              style: pill,
              onClick: () => {
                actions.clearField(QUICK_PROMPTS_FIELD);
              },
              children: "\u6062\u590D\u5185\u7F6E 9 \u6761"
            }
          ) })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(FoldCard, { name: "\u8BBE\u7F6E\u9762\u677F", summary: panelSummary, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { style: bodyLead, children: "\u63D2\u4EF6\u88C5\u5F97\u591A\u65F6\u8BBE\u7F6E\u6761\u76EE\u5F88\u957F\uFF1A\u5F00\u542F\u300C\u5BFC\u822A\u53EF\u6EDA\u52A8\u300D\u540E\uFF0C\u5DE6\u4FA7\u5BFC\u822A\u5728\u6EA2\u51FA\u65F6\u4F1A\u51FA\u73B0\u6EDA\u52A8\u6761\u3002 \u5F00\u542F\u300C\u8FB9\u7F18\u8C03\u6574\u5927\u5C0F\u300D\u540E\uFF0C\u628A\u9F20\u6807\u79FB\u5230\u8BBE\u7F6E\u9762\u677F\u7684\u8FB9\u6216\u89D2\u4E0A\uFF08\u51FA\u73B0\u9AD8\u4EAE\u6216\u5149\u6807\u53D8\u5316\uFF09\u62D6\u52A8\u5373\u53EF\u6539\u53D8\u9762\u677F\u5927\u5C0F\uFF0C \u5C3A\u5BF8\u4F1A\u8BB0\u4F4F\uFF0C\u4E0B\u6B21\u6253\u5F00\u4FDD\u6301\u3002" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          ToggleRow,
          {
            first: true,
            label: "\u5BFC\u822A\u53EF\u6EDA\u52A8",
            desc: "\u8BBE\u7F6E\u6761\u76EE\u8D85\u51FA\u9762\u677F\u9AD8\u5EA6\u65F6\u663E\u793A\u6EDA\u52A8\u6761",
            checked: settings.panelScroll,
            onChange: (next) => {
              actions.setField(PANEL_SCROLL_FIELD, next);
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          ToggleRow,
          {
            label: "\u8FB9\u7F18\u8C03\u6574\u5927\u5C0F",
            desc: "\u62D6\u52A8\u9762\u677F\u56DB\u8FB9 / \u56DB\u89D2\u6539\u53D8\u9762\u677F\u5C3A\u5BF8",
            checked: settings.panelResize,
            onChange: (next) => {
              actions.setField(PANEL_RESIZE_FIELD, next);
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 10 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: rowDesc, children: "\u5C3A\u5BF8\u9884\u8BBE\uFF1A" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "button",
            {
              type: "button",
              style: pill,
              onClick: () => {
                actions.clearField(PANEL_WIDTH_FIELD);
                actions.clearField(PANEL_HEIGHT_FIELD);
              },
              children: "\u9ED8\u8BA4\uFF08800\uFF09"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "button",
            {
              type: "button",
              style: settings.panelWidth === 640 && settings.panelHeight === 600 ? pillActive : pill,
              onClick: () => {
                actions.setField(PANEL_WIDTH_FIELD, 640);
                actions.setField(PANEL_HEIGHT_FIELD, 600);
              },
              children: "\u7D27\u51D1\uFF08640\xD7600\uFF09"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "button",
            {
              type: "button",
              style: settings.panelWidth === 1040 && settings.panelHeight === 760 ? pillActive : pill,
              onClick: () => {
                actions.setField(PANEL_WIDTH_FIELD, 1040);
                actions.setField(PANEL_HEIGHT_FIELD, 760);
              },
              children: "\u5BBD\u655E\uFF081040\xD7760\uFF09"
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(FoldCard, { name: "OpenCode \u8BF7\u6C42\u5934", summary: headerSummary, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { style: bodyLead, children: "OpenCode \u7684\u63A5\u53E3\u8981\u6C42\u5BA2\u6237\u7AEF\u6BCF\u6B21\u8BF7\u6C42\u90FD\u5E26\u4E0A\u4E00\u4E2A\u7A33\u5B9A\u7684\u4F1A\u8BDD ID \u8BF7\u6C42\u5934\uFF08\u5B98\u65B9 Go \u6587\u6863 \u300C\u53EF\u4EE5\u5728\u54EA\u91CC\u4F7F\u7528\uFF1F\u300D\u7B2C 3 \u6761\uFF1A\u4E3A\u6BCF\u6BB5\u5BF9\u8BDD\u5728 x-opencode-session \u4E2D\u53D1\u9001\u4F1A\u8BDD ID\uFF0C \u4EE5\u4FBF\u5176\u4F18\u5316\u8DEF\u7531\u4E0E\u63D0\u793A\u8BCD\u7F13\u5B58\uFF09\u3002DSH \u7684\u8BBE\u7F6E\u9875\u4E0D\u63D0\u4F9B\u8BF7\u6C42\u5934\u7F16\u8F91\u5668\uFF0C\u6240\u4EE5\u8FD9\u91CC\u76F4\u63A5\u628A\u5B83\u5199\u8FDB llm-pi-ai \u7684 provider \u914D\u7F6E\u2014\u2014\u4E0B\u4E00\u6B21\u6A21\u578B\u8BF7\u6C42\u5C31\u751F\u6548\uFF0C\u4E0D\u7528\u91CD\u542F\uFF0C\u4E5F\u4E0D\u7528\u624B\u5DE5\u6539 settings.yaml\u3002 \u53EA\u5BF9 llm-pi-ai \u91CC\u300C\u5DF2\u5B58\u5728\u300D\u7684 opencode \u7CFB\u8DEF\u7531\u751F\u6548\uFF0C\u4E0D\u4F1A\u51ED\u7A7A\u65B0\u5EFA provider\uFF1B \u603B\u5F00\u5173\u5173\u95ED\u6216\u672C\u680F\u76EE\u505C\u7528\u65F6\uFF0C\u5199\u5165\u7684\u5934\u4F1A\u81EA\u52A8\u64A4\u9500\u3002" }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          ToggleRow,
          {
            first: true,
            label: "\u9644\u52A0\u8BF7\u6C42\u5934",
            desc: "\u6253\u5F00\u5373\u5199\u5165\uFF0C\u5E76\u5728\u6BCF\u6B21\u542F\u52A8\u65F6\u8865\u9F50\uFF1B\u5173\u95ED\u5373\u64A4\u9500",
            checked: settings.headerEnabled,
            onChange: (next) => {
              actions.setField(HEADER_ENABLED_FIELD, next);
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          TextFieldRow,
          {
            title: "\u5934\u540D",
            desc: `\u9ED8\u8BA4 ${DEFAULT_HEADER_NAME}\uFF08OpenCode \u5B98\u65B9\u8981\u6C42\u7684\u90A3\u4E00\u4E2A\uFF09`,
            value: settings.headerName,
            placeholder: DEFAULT_HEADER_NAME,
            maxLength: HEADER_NAME_MAX,
            onChange: (next) => {
              actions.setField(HEADER_NAME_FIELD, next);
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          TextFieldRow,
          {
            title: "\u503C",
            desc: "\u6240\u6709\u5BF9\u8BDD\u5171\u7528\u8FD9\u4E00\u4E2A\u503C\uFF1B\u7559\u7A7A\u65F6\u9996\u6B21\u542F\u7528\u4F1A\u81EA\u52A8\u751F\u6210\u4E00\u4E2A UUID \u5E76\u4FDD\u5B58\u6CBF\u7528",
            value: settings.headerValue,
            placeholder: "\u7559\u7A7A = \u81EA\u52A8\u751F\u6210",
            maxLength: HEADER_VALUE_MAX,
            onChange: (next) => {
              actions.setField(HEADER_VALUE_FIELD, next);
            },
            action: {
              label: "\u91CD\u65B0\u751F\u6210",
              onClick: () => {
                actions.setField(HEADER_VALUE_FIELD, newSessionId());
              }
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          TextFieldRow,
          {
            title: "\u4F5C\u7528\u8DEF\u7531",
            desc: "\u9017\u53F7\u6216\u7A7A\u683C\u5206\u9694\uFF1B\u7559\u7A7A = \u81EA\u52A8\u5339\u914D OpenCode \u8DEF\u7531\uFF08\u540D\u5B57\u4EE5 opencode \u5F00\u5934\uFF0C\u6216 baseURL \u6307\u5411 opencode.ai\uFF09",
            value: settings.headerRoutes,
            placeholder: "\u7559\u7A7A = \u81EA\u52A8\uFF08opencode* \u6216 opencode.ai \u7AEF\u70B9\uFF09",
            maxLength: HEADER_VALUE_MAX,
            onChange: (next) => {
              actions.setField(HEADER_ROUTES_FIELD, next);
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("p", { style: hintInfo, children: [
          "\u72B6\u6001\uFF1A",
          headerStatusText
        ] })
      ] })
    ] })
  ] });
}

// src/client/QuickCommandsButton.tsx
var import_react4 = require("react");
var import_jsx_runtime4 = require("react/jsx-runtime");
function QuickCommandsButton({
  useInput,
  inputActions,
  sessionId,
  useLive,
  usePanel,
  actions
}) {
  const settings = useLive((item) => item);
  const anchor = usePanel((item) => item);
  const draft = useInput((state2) => state2.draft);
  const ref = (0, import_react4.useRef)(null);
  (0, import_react4.useEffect)(() => {
    const sid = typeof sessionId === "string" ? sessionId : "";
    publishInputBridge({
      actions: inputActions ?? null,
      draft: typeof draft === "string" ? draft : "",
      sessionId: sid
    });
    return () => {
      releaseInputBridge(sid);
    };
  }, [inputActions, draft, sessionId]);
  if (settings.enabled !== true) return null;
  const open = anchor !== null;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
    "button",
    {
      ref,
      type: "button",
      className: QUICK_BUTTON_CLASS,
      "aria-haspopup": "dialog",
      "aria-expanded": open,
      title: "\u5FEB\u6377\u6307\u4EE4\uFF1A\u4E00\u952E\u63D2\u5165\u5E38\u7528\u63D0\u793A\u8BCD\uFF0C\u6216\u628A\u8F93\u5165\u6846\u91CC\u7684\u8BDD\u4F18\u5316\u6210\u4E00\u6761\u6E05\u6670\u7684\u6307\u4EE4",
      onMouseDown: (event) => {
        event.preventDefault();
      },
      onClick: () => {
        const rect = ref.current?.getBoundingClientRect();
        actions.toggle({
          left: rect?.left ?? 0,
          bottom: rect?.bottom ?? 0,
          width: rect?.width ?? 0
        });
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "svg",
          {
            viewBox: "0 0 16 16",
            width: "12",
            height: "12",
            "aria-hidden": true,
            children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
              "path",
              {
                d: "M9.2 1.2 3.4 9.1h3.5l-0.9 5.7 6-8.1H8.4l0.8-5.5Z",
                fill: "currentColor"
              }
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: "\u5FEB\u6377\u6307\u4EE4" })
      ]
    }
  );
}

// src/client/QuickCommandsPanel.tsx
var import_react5 = require("react");
var import_jsx_runtime5 = require("react/jsx-runtime");
var MARGIN = 8;
var GAP = 8;
function QuickCommandsPanel({
  useLive,
  usePanel,
  useBusy,
  useNotice,
  actions
}) {
  const settings = useLive((item) => item);
  const anchor = usePanel((item) => item);
  const busy = useBusy((item) => item);
  const notice = useNotice((item) => item);
  const ref = (0, import_react5.useRef)(null);
  const [position, setPosition] = (0, import_react5.useState)(null);
  (0, import_react5.useLayoutEffect)(() => {
    if (anchor === null) {
      setPosition(null);
      return;
    }
    const el = ref.current;
    const height = el === null ? 320 : el.getBoundingClientRect().height;
    const width = el === null ? 420 : el.getBoundingClientRect().width;
    const left = Math.max(MARGIN, Math.min(anchor.left, window.innerWidth - width - MARGIN));
    const above = anchor.bottom - height - GAP;
    const top = above >= MARGIN ? above : Math.min(anchor.bottom + GAP, window.innerHeight - height - MARGIN);
    setPosition({ left, top: Math.max(MARGIN, top) });
  }, [anchor?.left, anchor?.bottom, settings.quickPrompts.length, busy]);
  (0, import_react5.useEffect)(() => {
    if (anchor === null) return;
    const onPointerDown = (event) => {
      if (ref.current !== null && event.target instanceof Node && ref.current.contains(event.target)) return;
      if (event.target instanceof Element && event.target.closest(".composer-ux-quick-button") !== null) return;
      actions.close();
    };
    const onEscape = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      actions.close();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onEscape, true);
    window.addEventListener("resize", actions.close);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onEscape, true);
      window.removeEventListener("resize", actions.close);
    };
  }, [anchor === null, actions]);
  if (anchor === null) return null;
  const items = settings.quickPrompts;
  const tier = settings.optimizerTier;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    "div",
    {
      ref,
      role: "dialog",
      "aria-label": "\u5FEB\u6377\u6307\u4EE4",
      style: { ...quickPanel, left: position?.left ?? anchor.left, top: position?.top ?? anchor.bottom },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: quickPanelHead, children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: quickPanelTitleRow, children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: quickPanelTitle, children: "\u5FEB\u6377\u6307\u4EE4" }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: quickTierRow, role: "group", "aria-label": "\u4F18\u5316\u5F3A\u5EA6", children: OPTIMIZER_TIERS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              "button",
              {
                type: "button",
                title: item.hint,
                "aria-pressed": tier === item.id,
                style: tier === item.id ? quickTierButtonActive : quickTierButton,
                onMouseDown: (event) => {
                  event.preventDefault();
                },
                onClick: () => {
                  actions.setTier(item.id);
                },
                children: item.label
              },
              item.id
            )) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
            "button",
            {
              type: "button",
              disabled: busy,
              title: "\u628A\u8F93\u5165\u6846\u91CC\u7684\u8BDD\u4EA4\u7ED9\u53E6\u4E00\u4E2A AI \u6574\u7406\u6210\u4E00\u6761\u53EF\u4EE5\u76F4\u63A5\u53D1\u51FA\u53BB\u7684\u6E05\u6670\u6307\u4EE4\uFF0C\u7ED3\u679C\u76F4\u63A5\u5199\u56DE\u8F93\u5165\u6846",
              style: busy ? quickPrimaryButtonDisabled : quickPrimaryButton,
              onMouseDown: (event) => {
                event.preventDefault();
              },
              onClick: () => {
                actions.optimize();
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { "aria-hidden": true, children: "\u2728" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: busy ? "\u4F18\u5316\u4E2D\u2026" : "\u4F18\u5316\u63D0\u793A\u8BCD" })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: quickList, children: [
          items.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: quickEmpty, children: [
            "\u8FD8\u6CA1\u6709\u5FEB\u6377\u6307\u4EE4\u3002",
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("br", {}),
            "\u5728\u300C\u8BBE\u7F6E \u2192 \u8F93\u5165\u4F53\u9A8C \u2192 \u5FEB\u6377\u6307\u4EE4\u300D\u91CC\u6DFB\u52A0\u3002"
          ] }),
          items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 4 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
              "button",
              {
                type: "button",
                title: item.prompt,
                style: quickItem,
                onMouseDown: (event) => {
                  event.preventDefault();
                },
                onClick: () => {
                  actions.insert(item.prompt);
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: quickItemLabel, children: item.label }),
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: quickItemPreview, children: item.prompt.replace(/\s+/g, " ") })
                ]
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { style: quickAlwaysLabel, title: "\u52FE\u4E0A\u540E\uFF0C\u70B9\u53D1\u9001\u65F6\u8FD9\u6761\u63D0\u793A\u8BCD\u4F1A\u81EA\u52A8\u9644\u52A0\u5230\u4F60\u7684\u6D88\u606F\u672B\u5C3E", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                "input",
                {
                  type: "checkbox",
                  style: quickAlwaysBox,
                  checked: item.always,
                  onChange: (event) => {
                    actions.setAlways(item.id, event.target.checked);
                  }
                }
              ),
              "\u9ED8\u8BA4\u63D2\u5165"
            ] })
          ] }, item.id))
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: quickPanelFoot, children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: quickNotice, role: "status", children: notice }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: quickFootHint, children: "\u8BBE\u7F6E \u2192 \u8F93\u5165\u4F53\u9A8C" })
        ] })
      ]
    }
  );
}

// src/client.tsx
var name = "composer-ux";
var inject = ["slots", "settingsScope"];
function apply(ctx) {
  const slots = ctx.slots;
  const scope = ctx.settingsScope.bind({ namespace: NAMESPACE });
  const live = (0, import_dsh_client_store.createSnapshotStore)({ ...DEFAULT_SETTINGS });
  const menu2 = (0, import_dsh_client_store.createSnapshotStore)(null);
  const panel = (0, import_dsh_client_store.createSnapshotStore)(null);
  const optimizing = (0, import_dsh_client_store.createSnapshotStore)(false);
  const panelNotice = (0, import_dsh_client_store.createSnapshotStore)("");
  const sync = () => {
    const snapshot = scope.getSnapshot();
    live.set(snapshot.status === "ready" && snapshot.value !== void 0 ? { ...DEFAULT_SETTINGS, ...sanitizeSettings(snapshot.value) } : { ...DEFAULT_SETTINGS });
  };
  sync();
  ctx.effect(() => scope.subscribe(sync), "composer-ux: settings sync");
  const setField = (field, value) => {
    void scope.set(field, value).catch((error) => {
      console.error("[composer-ux] settings write failed", error);
    });
  };
  const clearField = (field) => {
    void scope.unset(field).catch((error) => {
      console.error("[composer-ux] settings clear failed", error);
    });
  };
  const resetAll = () => {
    void scope.mutate(
      [
        ENABLED_FIELD,
        SEND_KEY_FIELD,
        NEWLINE_KEY_FIELD,
        ...MENU_FIELDS,
        MENU_NATIVE_FIELD,
        PANEL_SCROLL_FIELD,
        PANEL_RESIZE_FIELD,
        PANEL_WIDTH_FIELD,
        PANEL_HEIGHT_FIELD,
        HEADER_ENABLED_FIELD,
        HEADER_NAME_FIELD,
        HEADER_VALUE_FIELD,
        HEADER_ROUTES_FIELD,
        QUICK_PROMPTS_FIELD,
        OPTIMIZER_TIER_FIELD
      ].map((field) => ({ op: "unset", path: [field] }))
    ).catch((error) => {
      console.error("[composer-ux] settings reset failed", error);
    });
  };
  let noticeTimer;
  const note = (message, ms = 4500) => {
    panelNotice.set(message);
    if (noticeTimer !== void 0) clearTimeout(noticeTimer);
    if (message === "") return;
    noticeTimer = setTimeout(() => {
      panelNotice.set("");
    }, ms);
  };
  ctx.effect(() => () => {
    if (noticeTimer !== void 0) clearTimeout(noticeTimer);
  }, "composer-ux: quick notice timer");
  const writeQuickPrompts = (next) => {
    setField(QUICK_PROMPTS_FIELD, next);
  };
  const quickActions = {
    toggle: (anchor) => {
      if (panel.getSnapshot() !== null) {
        panel.set(null);
        panelNotice.set("");
        return;
      }
      panelNotice.set("");
      panel.set(anchor);
    },
    close: () => {
      panel.set(null);
      panelNotice.set("");
    },
    insert: (text) => {
      if (insertIntoDraft(text)) focusComposer();
    },
    optimize: () => {
      if (optimizing.getSnapshot()) return;
      const draft = currentDraft();
      if (draft.trim() === "") {
        note("\u8F93\u5165\u6846\u662F\u7A7A\u7684\uFF1A\u5148\u5199\u70B9\u4EC0\u4E48\uFF0C\u518D\u70B9\u4F18\u5316");
        return;
      }
      optimizing.set(true);
      note("\u6B63\u5728\u4F18\u5316\u2026");
      void optimizeDraft(draft, live.getSnapshot().optimizerTier).then(
        (result) => {
          optimizing.set(false);
          if (!result.ok) {
            note(`\u4F18\u5316\u5931\u8D25\uFF1A${result.error ?? "\u672A\u77E5\u539F\u56E0"}`);
            return;
          }
          replaceDraft(result.text ?? "");
          focusComposer();
          note(`\u5DF2\u5199\u56DE\u8F93\u5165\u6846\uFF08${result.route}\uFF09\xB7 Ctrl+Z \u53EF\u8FD8\u539F`);
        },
        (error) => {
          optimizing.set(false);
          note(`\u4F18\u5316\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`);
        }
      );
    },
    setTier: (tier) => {
      setField(OPTIMIZER_TIER_FIELD, tier);
    },
    setAlways: (id, value) => {
      writeQuickPrompts(live.getSnapshot().quickPrompts.map(
        (item) => item.id === id ? { ...item, always: value } : item
      ));
    }
  };
  slots.inject("settings.section", () => slots.register({
    name: "settings.section",
    id: "composer-ux",
    order: 40,
    label: "\u8F93\u5165\u4F53\u9A8C",
    inject: () => ({
      hooks: { live },
      actions: { setField, clearField, resetAll }
    })
  }, SettingsSection));
  slots.inject("shell.overlay", () => slots.register({
    name: "shell.overlay",
    id: "composer-ux-menu",
    inject: () => ({
      hooks: { menu: menu2, live },
      actions: {
        run: runMenuAction,
        close: () => {
          menu2.set(null);
        },
        note: (message) => {
          const current = menu2.getSnapshot();
          if (current === null) return;
          menu2.set({ ...current, note: message });
        }
      }
    })
  }, ContextMenuHost));
  slots.inject("shell.overlay", () => slots.register({
    name: "shell.overlay",
    id: "composer-ux-panel-resize",
    inject: () => ({ hooks: { live }, actions: { setField } })
  }, PanelResizeHandles));
  slots.inject("conversation.input.right", () => slots.register({
    name: "conversation.input.right",
    id: "composer-ux-quick",
    order: 89,
    label: "\u5FEB\u6377\u6307\u4EE4",
    inject: () => ({
      hooks: { live, panel },
      actions: { toggle: quickActions.toggle }
    })
  }, QuickCommandsButton));
  slots.inject("shell.overlay", () => slots.register({
    name: "shell.overlay",
    id: "composer-ux-quick-panel",
    inject: () => ({
      hooks: { live, panel, busy: optimizing, notice: panelNotice },
      actions: quickActions
    })
  }, QuickCommandsPanel));
  ctx.effect(() => installSettingsCardStyle(), "composer-ux: settings card style");
  ctx.effect(() => installQuickButtonStyle(), "composer-ux: quick button style");
  ctx.effect(
    () => installPanelStyle(
      () => {
        const settings = live.getSnapshot();
        return settings.enabled && settings.panelScroll;
      },
      (listener) => live.subscribe(listener)
    ),
    "composer-ux: panel style"
  );
  ctx.effect(() => {
    let dispose = null;
    const syncInterceptors = () => {
      const enabled = live.getSnapshot().enabled;
      if (enabled && dispose === null) {
        dispose = installInterceptors({
          settings: () => live.getSnapshot(),
          setMenu: (state2) => {
            menu2.set(state2);
          },
          menuOpen: () => menu2.getSnapshot() !== null
        });
      } else if (!enabled) {
        dispose?.();
        dispose = null;
        menu2.set(null);
        panel.set(null);
      }
      if (live.getSnapshot().menuNative) menu2.set(null);
      if (!live.getSnapshot().enabled) panel.set(null);
    };
    syncInterceptors();
    const unsubscribe = live.subscribe(syncInterceptors);
    return () => {
      unsubscribe();
      dispose?.();
      dispose = null;
    };
  }, "composer-ux: input interceptors");
}
return module.exports; } });
//# sourceMappingURL=client.js.map
