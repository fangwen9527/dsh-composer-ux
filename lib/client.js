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
  headerStatus: ""
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
    headerStatus: asText(HEADER_STATUS_FIELD, HEADER_VALUE_MAX)
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
  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("contextmenu", onContextMenu, true);
  return () => {
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("contextmenu", onContextMenu, true);
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
function installPanelStyle(settings, subscribe) {
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-composer-ux-panel";
  tag.textContent = PANEL_CSS;
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
var import_jsx_runtime2 = require("react/jsx-runtime");
function stripRect(edge, rect) {
  const horizontal = (left, width) => ({
    left,
    top: rect.top + 12,
    width,
    height: Math.max(0, rect.height - 24),
    cursor: "ew-resize"
  });
  const vertical = (top, height) => ({
    left: rect.left + 16,
    top,
    width: Math.max(0, rect.width - 32),
    height,
    cursor: "ns-resize"
  });
  const corner = (left, top, horizontalCursor, verticalCursor) => ({
    left,
    top,
    width: 18,
    height: 18,
    cursor: horizontalCursor
  });
  const corners = {
    tl: "nwse-resize",
    tr: "nesw-resize",
    bl: "nesw-resize",
    br: "nwse-resize"
  };
  switch (edge) {
    case "left":
      return horizontal(rect.left - 4, 8);
    case "right":
      return horizontal(rect.right - 4, 8);
    case "top":
      return vertical(rect.top - 4, 8);
    case "bottom":
      return vertical(rect.bottom - 4, 8);
    case "tl":
      return corner(rect.left - 6, rect.top - 6, corners.tl, "nwse");
    case "tr":
      return corner(rect.right - 12, rect.top - 6, corners.tr, "nesw");
    case "bl":
      return corner(rect.left - 6, rect.bottom - 14, corners.bl, "nesw");
    case "br":
      return corner(rect.right - 12, rect.bottom - 14, corners.br, "nwse");
  }
}
function PanelResizeHandles({ useLive, actions }) {
  const settings = useLive((value) => ({
    enabled: value.enabled,
    panelResize: value.panelResize,
    panelWidth: value.panelWidth,
    panelHeight: value.panelHeight
  }));
  const settingsRef = (0, import_react2.useRef)(settings);
  settingsRef.current = settings;
  const enabled = settings.enabled === true && settings.panelResize === true;
  const [rect, setRect] = (0, import_react2.useState)(null);
  const appliedRef = (0, import_react2.useRef)(false);
  (0, import_react2.useEffect)(() => {
    if (!enabled) {
      setRect(null);
      return;
    }
    const probe = () => {
      const panel = findSettingsPanel();
      if (panel === null) {
        appliedRef.current = false;
        setRect((current) => current === null ? null : null);
        return;
      }
      if (!appliedRef.current) {
        appliedRef.current = true;
        const width = settingsRef.current.panelWidth;
        const height = settingsRef.current.panelHeight;
        if (width !== void 0) panel.style.width = `${clampPanelWidth(width)}px`;
        if (height !== void 0) panel.style.height = `${clampPanelHeight(height)}px`;
      }
      setRect(panel.getBoundingClientRect());
    };
    probe();
    const timer = setInterval(probe, 250);
    const onResize = () => {
      setRect((current) => current === null ? null : findSettingsPanel()?.getBoundingClientRect() ?? null);
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearInterval(timer);
      window.removeEventListener("resize", onResize);
    };
  }, [enabled]);
  if (!enabled || rect === null) return null;
  const onPointerDown = (edge, event) => {
    event.preventDefault();
    event.stopPropagation();
    const panel = findSettingsPanel();
    if (panel === null) return;
    const start = {
      edge,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: panel.clientWidth,
      startHeight: panel.clientHeight
    };
    const onMove = (move) => {
      if (dragStartRef.current !== start || dragStartRef.current === null) return;
      move.preventDefault();
      const panelEl = findSettingsPanel();
      if (panelEl === null) return;
      const dx = move.clientX - start.startX;
      const dy = move.clientY - start.startY;
      let width = start.startWidth;
      let height = start.startHeight;
      if (edge === "left" || edge === "right" || edge === "tl" || edge === "bl" || edge === "tr" || edge === "br") {
        width = start.startWidth + (edge === "left" || edge === "tl" || edge === "bl" ? -dx : dx);
      }
      if (edge === "top" || edge === "bottom" || edge === "tl" || edge === "bl" || edge === "tr" || edge === "br") {
        height = start.startHeight + (edge === "top" || edge === "tl" || edge === "tr" ? -dy : dy);
      }
      panelEl.style.width = `${Math.round(clampPanelWidth(width))}px`;
      panelEl.style.height = `${Math.round(clampPanelHeight(height))}px`;
      setRect(panelEl.getBoundingClientRect());
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      dragStartRef.current = null;
      const panelEl = findSettingsPanel();
      if (panelEl !== null) {
        actions.setField(PANEL_WIDTH_FIELD, Math.round(clampPanelWidth(panelEl.clientWidth)));
        actions.setField(PANEL_HEIGHT_FIELD, Math.round(clampPanelHeight(panelEl.clientHeight)));
      }
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };
    dragStartRef.current = start;
    document.body.style.cursor = stripRect(edge, rect).cursor;
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const edges = ["left", "right", "top", "bottom", "tl", "tr", "bl", "br"];
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_jsx_runtime2.Fragment, { children: edges.map((edge) => {
    const pos = stripRect(edge, rect);
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "div",
      {
        onPointerDown: (event) => {
          onPointerDown(edge, event);
        },
        onPointerEnter: (event) => {
          event.currentTarget.style.background = "var(--dsw-alias-state-business-primary)";
          event.currentTarget.style.opacity = "0.75";
        },
        onPointerLeave: (event) => {
          event.currentTarget.style.background = "transparent";
          event.currentTarget.style.opacity = "0";
        },
        style: {
          position: "fixed",
          zIndex: 9998,
          left: pos.left,
          top: pos.top,
          width: pos.width,
          height: pos.height,
          cursor: pos.cursor,
          background: "transparent",
          opacity: 0,
          borderRadius: 6,
          pointerEvents: "auto",
          touchAction: "none"
        }
      },
      edge
    );
  }) });
}
var dragStartRef = { current: null };

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

// src/client.tsx
var name = "composer-ux";
var inject = ["slots", "settingsScope"];
function apply(ctx) {
  const slots = ctx.slots;
  const scope = ctx.settingsScope.bind({ namespace: NAMESPACE });
  const live = (0, import_dsh_client_store.createSnapshotStore)({ ...DEFAULT_SETTINGS });
  const menu2 = (0, import_dsh_client_store.createSnapshotStore)(null);
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
        HEADER_ROUTES_FIELD
      ].map((field) => ({ op: "unset", path: [field] }))
    ).catch((error) => {
      console.error("[composer-ux] settings reset failed", error);
    });
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
  ctx.effect(() => installSettingsCardStyle(), "composer-ux: settings card style");
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
          setMenu: (state) => {
            menu2.set(state);
          },
          menuOpen: () => menu2.getSnapshot() !== null
        });
      } else if (!enabled) {
        dispose?.();
        dispose = null;
        menu2.set(null);
      }
      if (live.getSnapshot().menuNative) menu2.set(null);
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
