window.__ModuleLoader__.load({ id: "dsh-composer-ux", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
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

// src/provider-prices.ts
var PROVIDER_PRICES_SNAPSHOT_AT, BUILTIN_PROVIDER_PRICES;
var init_provider_prices = __esm({
  "src/provider-prices.ts"() {
    PROVIDER_PRICES_SNAPSHOT_AT = "2026-09-29";
    BUILTIN_PROVIDER_PRICES = {
      "openai": {
        "gpt-3.5-turbo": { miss: 0.5, hit: 0, out: 1.5 },
        "gpt-4": { miss: 30, hit: 30, out: 60 },
        "gpt-4-turbo": { miss: 10, hit: 10, out: 30 },
        "gpt-4.1": { miss: 2, hit: 0.5, out: 8 },
        "gpt-4.1-mini": { miss: 0.4, hit: 0.1, out: 1.6 },
        "gpt-4.1-nano": { miss: 0.1, hit: 0.025, out: 0.4 },
        "gpt-4o": { miss: 2.5, hit: 1.25, out: 10 },
        "gpt-4o-2024-05-13": { miss: 5, hit: 5, out: 15 },
        "gpt-4o-2024-08-06": { miss: 2.5, hit: 1.25, out: 10 },
        "gpt-4o-2024-11-20": { miss: 2.5, hit: 1.25, out: 10 },
        "gpt-4o-mini": { miss: 0.15, hit: 0.075, out: 0.6 },
        "gpt-5": { miss: 1.25, hit: 0.125, out: 10 },
        "gpt-5-mini": { miss: 0.25, hit: 0.025, out: 2 },
        "gpt-5-nano": { miss: 0.05, hit: 5e-3, out: 0.4 },
        "gpt-5-pro": { miss: 15, hit: 15, out: 120 },
        "gpt-5.1": { miss: 1.25, hit: 0.125, out: 10 },
        "gpt-5.2": { miss: 1.75, hit: 0.175, out: 14 },
        "gpt-5.2-chat-latest": { miss: 1.75, hit: 0.175, out: 14 },
        "gpt-5.2-pro": { miss: 21, hit: 21, out: 168 },
        "gpt-5.3-chat-latest": { miss: 1.75, hit: 0.175, out: 14 },
        "gpt-5.3-codex": { miss: 1.75, hit: 0.175, out: 14 },
        "gpt-5.3-codex-spark": { miss: 1.75, hit: 0.175, out: 14 },
        "gpt-5.4": { miss: 2.5, hit: 0.25, out: 15 },
        "gpt-5.4-mini": { miss: 0.75, hit: 0.075, out: 4.5 },
        "gpt-5.4-nano": { miss: 0.2, hit: 0.02, out: 1.25 },
        "gpt-5.4-pro": { miss: 30, hit: 30, out: 180 },
        "gpt-5.5": { miss: 5, hit: 0.5, out: 30 },
        "gpt-5.5-pro": { miss: 30, hit: 30, out: 180 },
        "gpt-5.6": { miss: 4, hit: 0.4, out: 20 },
        "gpt-5.6-luna": { miss: 0.2, hit: 0.02, out: 1.2 },
        "gpt-5.6-sol": { miss: 4, hit: 0.4, out: 20 },
        "gpt-5.6-terra": { miss: 2, hit: 0.2, out: 12 },
        "gpt-6-astra": { miss: 10, hit: 1, out: 50 },
        "gpt-6-luna": { miss: 0.1, hit: 0.01, out: 0.5 },
        "gpt-6-sol": { miss: 2, hit: 0.2, out: 10 },
        "gpt-daybreak-blue-latest": { miss: 4, hit: 0.4, out: 20 },
        "gpt-daybreak-red-latest": { miss: 12.5, hit: 1.25, out: 75 },
        "gpt-image-2": { miss: 5, hit: 1.25, out: 30 },
        "gpt-realtime-2.1": { miss: 4, hit: 0.4, out: 24 },
        "o1": { miss: 15, hit: 7.5, out: 60 },
        "o1-pro": { miss: 150, hit: 150, out: 600 },
        "o3": { miss: 2, hit: 0.5, out: 8 },
        "o3-mini": { miss: 1.1, hit: 0.55, out: 4.4 },
        "o3-pro": { miss: 20, hit: 20, out: 80 },
        "o4-mini": { miss: 1.1, hit: 0.275, out: 4.4 },
        "text-embedding-3-large": { miss: 0.13, hit: 0.13, out: 0 },
        "text-embedding-3-small": { miss: 0.02, hit: 0.02, out: 0 },
        "text-embedding-ada-002": { miss: 0.1, hit: 0.1, out: 0 }
      },
      "anthropic": {
        "claude-fable-5": { miss: 10, hit: 1, out: 50 },
        "claude-fable-5-1": { miss: 10, hit: 0.25, out: 50 },
        "claude-haiku-4-5": { miss: 1, hit: 0.1, out: 5 },
        "claude-haiku-4-5-20251001": { miss: 1, hit: 0.1, out: 5 },
        "claude-opus-4-5": { miss: 5, hit: 0.5, out: 25 },
        "claude-opus-4-5-20251101": { miss: 5, hit: 0.5, out: 25 },
        "claude-opus-4-6": { miss: 5, hit: 0.5, out: 25 },
        "claude-opus-4-7": { miss: 5, hit: 0.5, out: 25 },
        "claude-opus-4-8": { miss: 5, hit: 0.5, out: 25 },
        "claude-opus-5": { miss: 5, hit: 0.5, out: 25 },
        "claude-opus-5-5": { miss: 4, hit: 0.2, out: 20 },
        "claude-sonnet-4-5": { miss: 3, hit: 0.3, out: 15 },
        "claude-sonnet-4-5-20250929": { miss: 3, hit: 0.3, out: 15 },
        "claude-sonnet-4-6": { miss: 3, hit: 0.3, out: 15 },
        "claude-sonnet-5": { miss: 2, hit: 0.2, out: 10 }
      },
      "google": {
        "deep-research-max-preview-04-2026": { miss: 2, hit: 0.2, out: 12 },
        "deep-research-preview-04-2026": { miss: 2, hit: 0.2, out: 12 },
        "gemini-2.5-computer-use-preview-10-2025": { miss: 1.25, hit: 1.25, out: 10 },
        "gemini-2.5-flash": { miss: 0.3, hit: 0.03, out: 2.5 },
        "gemini-2.5-flash-image": { miss: 0.3, hit: 0.075, out: 30 },
        "gemini-2.5-flash-lite": { miss: 0.1, hit: 0.01, out: 0.4 },
        "gemini-2.5-flash-preview-tts": { miss: 0.5, hit: 0.5, out: 10 },
        "gemini-2.5-pro": { miss: 1.25, hit: 0.125, out: 10 },
        "gemini-2.5-pro-preview-tts": { miss: 1, hit: 1, out: 20 },
        "gemini-3-flash-preview": { miss: 0.5, hit: 0.05, out: 3 },
        "gemini-3-pro-image": { miss: 2, hit: 2, out: 120 },
        "gemini-3-pro-image-preview": { miss: 2, hit: 2, out: 120 },
        "gemini-3.1-flash-image": { miss: 0.5, hit: 0.5, out: 60 },
        "gemini-3.1-flash-image-preview": { miss: 0.5, hit: 0.5, out: 60 },
        "gemini-3.1-flash-lite": { miss: 0.25, hit: 0.025, out: 1.5 },
        "gemini-3.1-flash-lite-image": { miss: 0.25, hit: 0.25, out: 30 },
        "gemini-3.1-flash-lite-preview": { miss: 0.25, hit: 0.025, out: 1.5 },
        "gemini-3.1-flash-live-preview": { miss: 0.75, hit: 0.75, out: 4.5 },
        "gemini-3.1-flash-tts-preview": { miss: 1, hit: 1, out: 20 },
        "gemini-3.1-pro-preview": { miss: 2, hit: 0.2, out: 12 },
        "gemini-3.1-pro-preview-customtools": { miss: 2, hit: 0.2, out: 12 },
        "gemini-3.5-flash": { miss: 1.5, hit: 0.15, out: 9 },
        "gemini-3.5-flash-lite": { miss: 0.3, hit: 0.03, out: 2.5 },
        "gemini-3.5-live-translate-preview": { miss: 3.5, hit: 3.5, out: 21 },
        "gemini-3.6-flash": { miss: 0.75, hit: 0.075, out: 3.75 },
        "gemini-3.7-flash": { miss: 0.75, hit: 0.075, out: 3.75 },
        "gemini-3.8-flash": { miss: 0.75, hit: 0.075, out: 3.75 },
        "gemini-embedding-001": { miss: 0.15, hit: 0.15, out: 0 },
        "gemini-embedding-2": { miss: 0.2, hit: 0.2, out: 0 },
        "gemini-flash-latest": { miss: 0.75, hit: 0.075, out: 3.75 },
        "gemini-flash-lite-latest": { miss: 0.3, hit: 0.03, out: 2.5 },
        "gemini-omni-flash-preview": { miss: 1.5, hit: 1.5, out: 17.5 },
        "lyria-3-clip-preview": { miss: 0, hit: 0, out: 0 },
        "lyria-3-pro-preview": { miss: 0, hit: 0, out: 0 }
      },
      "moonshotai": {
        "kimi-k2.6": { miss: 0.95, hit: 0.16, out: 4 },
        "kimi-k2.7-code": { miss: 0.95, hit: 0.19, out: 4 },
        "kimi-k2.7-code-highspeed": { miss: 1.9, hit: 0.38, out: 8 },
        "kimi-k3": { miss: 3, hit: 0.3, out: 15 }
      },
      "zhipuai": {
        "glm-4.5": { miss: 0.6, hit: 0.11, out: 2.2 },
        "glm-4.5-air": { miss: 0.2, hit: 0.03, out: 1.1 },
        "glm-4.5-flash": { miss: 0, hit: 0, out: 0 },
        "glm-4.5v": { miss: 0.6, hit: 0.6, out: 1.8 },
        "glm-4.6": { miss: 0.6, hit: 0.11, out: 2.2 },
        "glm-4.6v": { miss: 0.3, hit: 0.3, out: 0.9 },
        "glm-4.6v-flash": { miss: 0, hit: 0, out: 0 },
        "glm-4.7": { miss: 0.6, hit: 0.11, out: 2.2 },
        "glm-4.7-flash": { miss: 0, hit: 0, out: 0 },
        "glm-4.7-flashx": { miss: 0.07, hit: 0.01, out: 0.4 },
        "glm-5": { miss: 1, hit: 0.2, out: 3.2 },
        "glm-5.1": { miss: 1.4, hit: 0.26, out: 4.4 },
        "glm-5.2": { miss: 1.4, hit: 0.26, out: 4.4 },
        "glm-5.3": { miss: 1.4, hit: 0.26, out: 4.4 },
        "glm-5.3-flash": { miss: 0.15, hit: 0.03, out: 0.5 },
        "glm-5.3-flashx": { miss: 0.37, hit: 0.075, out: 1.25 },
        "glm-5v-turbo": { miss: 5, hit: 1.2, out: 22 }
      },
      "minimax": {
        "minimax-m2": { miss: 0.3, hit: 0.3, out: 1.2 },
        "minimax-m2.1": { miss: 0.3, hit: 0.03, out: 1.2 },
        "minimax-m2.5": { miss: 0.3, hit: 0.03, out: 1.2 },
        "minimax-m2.5-highspeed": { miss: 0.6, hit: 0.06, out: 2.4 },
        "minimax-m2.7": { miss: 0.3, hit: 0.06, out: 1.2 },
        "minimax-m2.7-highspeed": { miss: 0.6, hit: 0.06, out: 2.4 },
        "minimax-m3": { miss: 0.3, hit: 0.06, out: 1.2 }
      },
      "alibaba": {
        "deepseek-v4-flash-0731": { miss: 0.2, hit: 0.04, out: 0.4 },
        "glm-5.2": { miss: 1.4, hit: 0.28, out: 4.4 },
        "kimi-k3": { miss: 3, hit: 0.3, out: 15 },
        "qvq-max": { miss: 1.2, hit: 1.2, out: 4.8 },
        "qwen-flash": { miss: 0.05, hit: 0.05, out: 0.4 },
        "qwen-max": { miss: 1.6, hit: 1.6, out: 6.4 },
        "qwen-mt-plus": { miss: 2.46, hit: 2.46, out: 7.37 },
        "qwen-mt-turbo": { miss: 0.16, hit: 0.16, out: 0.49 },
        "qwen-omni-turbo": { miss: 0.07, hit: 0.07, out: 0.27 },
        "qwen-omni-turbo-realtime": { miss: 0.27, hit: 0.27, out: 1.07 },
        "qwen-plus": { miss: 0.4, hit: 0.4, out: 1.2 },
        "qwen-plus-character-ja": { miss: 0.5, hit: 0.5, out: 1.4 },
        "qwen-turbo": { miss: 0.05, hit: 0.05, out: 0.2 },
        "qwen-vl-max": { miss: 0.8, hit: 0.8, out: 3.2 },
        "qwen-vl-ocr": { miss: 0.72, hit: 0.72, out: 0.72 },
        "qwen-vl-plus": { miss: 0.21, hit: 0.21, out: 0.63 },
        "qwen2-5-14b-instruct": { miss: 0.35, hit: 0.35, out: 1.4 },
        "qwen2-5-32b-instruct": { miss: 0.7, hit: 0.7, out: 2.8 },
        "qwen2-5-72b-instruct": { miss: 1.4, hit: 1.4, out: 5.6 },
        "qwen2-5-7b-instruct": { miss: 0.175, hit: 0.175, out: 0.7 },
        "qwen2-5-omni-7b": { miss: 0.1, hit: 0.1, out: 0.4 },
        "qwen2-5-vl-72b-instruct": { miss: 2.8, hit: 2.8, out: 8.4 },
        "qwen2-5-vl-7b-instruct": { miss: 0.35, hit: 0.35, out: 1.05 },
        "qwen3-14b": { miss: 0.35, hit: 0.35, out: 1.4 },
        "qwen3-235b-a22b": { miss: 0.7, hit: 0.7, out: 2.8 },
        "qwen3-32b": { miss: 0.7, hit: 0.7, out: 2.8 },
        "qwen3-8b": { miss: 0.18, hit: 0.18, out: 0.7 },
        "qwen3-asr-flash": { miss: 0.035, hit: 0.035, out: 0.035 },
        "qwen3-coder-30b-a3b-instruct": { miss: 0.45, hit: 0.45, out: 2.25 },
        "qwen3-coder-480b-a35b-instruct": { miss: 1.5, hit: 1.5, out: 7.5 },
        "qwen3-coder-flash": { miss: 0.3, hit: 0.3, out: 1.5 },
        "qwen3-coder-plus": { miss: 1, hit: 1, out: 5 },
        "qwen3-livetranslate-flash-realtime": { miss: 10, hit: 10, out: 10 },
        "qwen3-max": { miss: 1.2, hit: 1.2, out: 6 },
        "qwen3-next-80b-a3b-instruct": { miss: 0.5, hit: 0.5, out: 2 },
        "qwen3-next-80b-a3b-thinking": { miss: 0.5, hit: 0.5, out: 6 },
        "qwen3-omni-flash": { miss: 0.43, hit: 0.43, out: 1.66 },
        "qwen3-omni-flash-realtime": { miss: 0.52, hit: 0.52, out: 1.99 },
        "qwen3-vl-235b-a22b": { miss: 0.7, hit: 0.7, out: 2.8 },
        "qwen3-vl-30b-a3b": { miss: 0.2, hit: 0.2, out: 0.8 },
        "qwen3-vl-plus": { miss: 0.2, hit: 0.2, out: 1.6 },
        "qwen3.5-122b-a10b": { miss: 0.4, hit: 0.4, out: 3.2 },
        "qwen3.5-27b": { miss: 0.3, hit: 0.3, out: 2.4 },
        "qwen3.5-35b-a3b": { miss: 0.25, hit: 0.25, out: 2 },
        "qwen3.5-397b-a17b": { miss: 0.6, hit: 0.6, out: 3.6 },
        "qwen3.5-flash": { miss: 0.1, hit: 0.01, out: 0.4 },
        "qwen3.5-plus": { miss: 0.4, hit: 0.4, out: 2.4 },
        "qwen3.6-27b": { miss: 0.6, hit: 0.6, out: 3.6 },
        "qwen3.6-35b-a3b": { miss: 0.248, hit: 0.248, out: 1.485 },
        "qwen3.6-flash": { miss: 0.1875, hit: 0.1875, out: 1.125 },
        "qwen3.6-max-preview": { miss: 1.3, hit: 0.13, out: 7.8 },
        "qwen3.6-plus": { miss: 0.5, hit: 0.05, out: 3 },
        "qwen3.7-flash": { miss: 0.03, hit: 3e-3, out: 0.13 },
        "qwen3.7-max": { miss: 2.5, hit: 0.5, out: 7.5 },
        "qwen3.7-plus": { miss: 0.4, hit: 0.04, out: 1.6 },
        "qwen3.8-flash": { miss: 0.15, hit: 0.016, out: 0.47 },
        "qwen3.8-max": { miss: 2, hit: 0.25, out: 6 },
        "qwen3.8-omni-flash": { miss: 0.15, hit: 0.016, out: 0.47 },
        "qwq-plus": { miss: 0.8, hit: 0.8, out: 2.4 }
      },
      "xai": {
        "grok-4.20-0309-non-reasoning": { miss: 1.25, hit: 0.2, out: 2.5 },
        "grok-4.20-0309-reasoning": { miss: 1.25, hit: 0.2, out: 2.5 },
        "grok-4.20-multi-agent-0309": { miss: 1.25, hit: 0.2, out: 2.5 },
        "grok-4.3": { miss: 1.25, hit: 0.2, out: 2.5 },
        "grok-4.5": { miss: 2, hit: 0.3, out: 6 },
        "grok-4.6": { miss: 2, hit: 0.5, out: 6 },
        "grok-4.7": { miss: 2, hit: 0.5, out: 6 },
        "grok-build-0.1": { miss: 1, hit: 0.2, out: 2 }
      },
      "xiaomi": {
        "mimo-v2-flash": { miss: 0.14, hit: 28e-4, out: 0.28 },
        "mimo-v2-omni": { miss: 0.14, hit: 28e-4, out: 0.28 },
        "mimo-v2-pro": { miss: 0.435, hit: 36e-4, out: 0.87 },
        "mimo-v2.5": { miss: 0.14, hit: 28e-4, out: 0.28 },
        "mimo-v2.5-pro": { miss: 0.435, hit: 36e-4, out: 0.87 },
        "mimo-v2.5-pro-ultraspeed": { miss: 1.305, hit: 0.0108, out: 2.61 },
        "mimo-v2.6-flash": { miss: 0.14, hit: 28e-4, out: 0.28 },
        "mimo-v2.6-pro": { miss: 0.435, hit: 36e-4, out: 0.87 },
        "mimo-v2.6-pro-ultraspeed": { miss: 4.35, hit: 0.036, out: 8.7 }
      },
      "opencode": {
        "big-pickle": { miss: 0, hit: 0, out: 0 },
        "claude-3-5-haiku": { miss: 0.8, hit: 0.08, out: 4 },
        "claude-fable-5": { miss: 10, hit: 1, out: 50 },
        "claude-fable-5-1": { miss: 10, hit: 0.25, out: 50 },
        "claude-haiku-4-5": { miss: 1, hit: 0.1, out: 5 },
        "claude-opus-4-1": { miss: 15, hit: 1.5, out: 75 },
        "claude-opus-4-5": { miss: 5, hit: 0.5, out: 25 },
        "claude-opus-4-6": { miss: 5, hit: 0.5, out: 25 },
        "claude-opus-4-7": { miss: 5, hit: 0.5, out: 25 },
        "claude-opus-4-8": { miss: 5, hit: 0.5, out: 25 },
        "claude-opus-5": { miss: 5, hit: 0.5, out: 25 },
        "claude-opus-5-5": { miss: 4, hit: 0.2, out: 20 },
        "claude-sonnet-4": { miss: 3, hit: 0.3, out: 15 },
        "claude-sonnet-4-5": { miss: 3, hit: 0.3, out: 15 },
        "claude-sonnet-4-6": { miss: 3, hit: 0.3, out: 15 },
        "claude-sonnet-5": { miss: 2, hit: 0.2, out: 10 },
        "deepseek-v4-flash": { miss: 0.14, hit: 0.028, out: 0.28 },
        "deepseek-v4-flash-free": { miss: 0, hit: 0, out: 0 },
        "deepseek-v4-flash-vision-exp": { miss: 0.14, hit: 0.028, out: 0.28 },
        "deepseek-v4-pro": { miss: 1.74, hit: 0.145, out: 3.84 },
        "deepseek-v4.1-flash": { miss: 0.3, hit: 6e-3, out: 1.2 },
        "gemini-3-flash": { miss: 0.5, hit: 0.05, out: 3 },
        "gemini-3-pro": { miss: 2, hit: 0.2, out: 12 },
        "gemini-3.1-pro": { miss: 2, hit: 0.2, out: 12 },
        "gemini-3.5-flash": { miss: 1.5, hit: 0.15, out: 9 },
        "gemini-3.5-flash-lite": { miss: 0.3, hit: 0.03, out: 2.5 },
        "gemini-3.6-flash": { miss: 1.5, hit: 0.15, out: 7.5 },
        "gemini-3.7-flash": { miss: 1.5, hit: 0.15, out: 7.5 },
        "gemini-3.8-flash": { miss: 1.5, hit: 0.15, out: 7.5 },
        "glm-4.6": { miss: 0.6, hit: 0.1, out: 2.2 },
        "glm-4.7": { miss: 0.6, hit: 0.1, out: 2.2 },
        "glm-4.7-free": { miss: 0, hit: 0, out: 0 },
        "glm-5": { miss: 1, hit: 0.2, out: 3.2 },
        "glm-5-free": { miss: 0, hit: 0, out: 0 },
        "glm-5.1": { miss: 1.4, hit: 0.26, out: 4.4 },
        "glm-5.2": { miss: 1.4, hit: 0.26, out: 4.4 },
        "glm-5.3": { miss: 1.4, hit: 0.26, out: 4.4 },
        "glm-5.3-flash": { miss: 0.15, hit: 0.03, out: 0.5 },
        "gpt-5": { miss: 1.07, hit: 0.107, out: 8.5 },
        "gpt-5-codex": { miss: 1.07, hit: 0.107, out: 8.5 },
        "gpt-5-nano": { miss: 0.05, hit: 5e-3, out: 0.4 },
        "gpt-5.1": { miss: 1.07, hit: 0.107, out: 8.5 },
        "gpt-5.1-codex": { miss: 1.07, hit: 0.107, out: 8.5 },
        "gpt-5.1-codex-max": { miss: 1.25, hit: 0.125, out: 10 },
        "gpt-5.1-codex-mini": { miss: 0.25, hit: 0.025, out: 2 },
        "gpt-5.2": { miss: 1.75, hit: 0.175, out: 14 },
        "gpt-5.2-codex": { miss: 1.75, hit: 0.175, out: 14 },
        "gpt-5.3-codex": { miss: 1.75, hit: 0.175, out: 14 },
        "gpt-5.3-codex-spark": { miss: 1.75, hit: 0.175, out: 14 },
        "gpt-5.4": { miss: 2.5, hit: 0.25, out: 15 },
        "gpt-5.4-mini": { miss: 0.75, hit: 0.075, out: 4.5 },
        "gpt-5.4-nano": { miss: 0.2, hit: 0.02, out: 1.25 },
        "gpt-5.4-pro": { miss: 30, hit: 30, out: 180 },
        "gpt-5.5": { miss: 5, hit: 0.5, out: 30 },
        "gpt-5.5-pro": { miss: 30, hit: 30, out: 180 },
        "gpt-5.6-luna": { miss: 0.2, hit: 0.02, out: 1.2 },
        "gpt-5.6-sol": { miss: 4, hit: 0.4, out: 20 },
        "gpt-5.6-terra": { miss: 2.5, hit: 0.25, out: 15 },
        "gpt-6-astra": { miss: 10, hit: 1, out: 50 },
        "gpt-6-luna": { miss: 0.1, hit: 0.01, out: 0.5 },
        "gpt-6-sol": { miss: 2, hit: 0.2, out: 10 },
        "grok-4.5": { miss: 2, hit: 0.3, out: 6 },
        "grok-4.6": { miss: 2, hit: 0.5, out: 6 },
        "grok-4.7": { miss: 1.4, hit: 0.35, out: 4.2 },
        "grok-build-0.1": { miss: 1, hit: 0.2, out: 2 },
        "grok-code": { miss: 0, hit: 0, out: 0 },
        "hy3-free": { miss: 0, hit: 0, out: 0 },
        "hy3-preview-free": { miss: 0, hit: 0, out: 0 },
        "kimi-k2": { miss: 0.4, hit: 0.4, out: 2.5 },
        "kimi-k2-thinking": { miss: 0.4, hit: 0.4, out: 2.5 },
        "kimi-k2.5": { miss: 0.6, hit: 0.08, out: 3 },
        "kimi-k2.5-free": { miss: 0, hit: 0, out: 0 },
        "kimi-k2.6": { miss: 0.95, hit: 0.16, out: 4 },
        "kimi-k2.7-code": { miss: 0.95, hit: 0.19, out: 4 },
        "kimi-k3": { miss: 3, hit: 0.3, out: 15 },
        "laguna-s-2.1-free": { miss: 0, hit: 0, out: 0 },
        "ling-2.6-flash-free": { miss: 0, hit: 0, out: 0 },
        "ling-3.0-flash-fin-free": { miss: 0, hit: 0, out: 0 },
        "ling-3.0-flash-free": { miss: 0, hit: 0, out: 0 },
        "ling-3.0-tiny-free": { miss: 0, hit: 0, out: 0 },
        "longcat-2.0-free": { miss: 0, hit: 0, out: 0 },
        "longcat-2.5-preview-free": { miss: 0, hit: 0, out: 0 },
        "mimo-v2-flash-free": { miss: 0, hit: 0, out: 0 },
        "mimo-v2-omni-free": { miss: 0, hit: 0, out: 0 },
        "mimo-v2-pro-free": { miss: 0, hit: 0, out: 0 },
        "mimo-v2.5-free": { miss: 0, hit: 0, out: 0 },
        "mimo-v2.6-flash-free": { miss: 0, hit: 0, out: 0 },
        "minimax-m2.1": { miss: 0.3, hit: 0.1, out: 1.2 },
        "minimax-m2.1-free": { miss: 0, hit: 0, out: 0 },
        "minimax-m2.5": { miss: 0.3, hit: 0.06, out: 1.2 },
        "minimax-m2.5-free": { miss: 0, hit: 0, out: 0 },
        "minimax-m2.7": { miss: 0.3, hit: 0.06, out: 1.2 },
        "minimax-m3": { miss: 0.3, hit: 0.06, out: 1.2 },
        "minimax-m3-free": { miss: 0, hit: 0, out: 0 },
        "muse-spark-1.2": { miss: 1.25, hit: 0.15, out: 4.25 },
        "muse-spark-1.2-contributor-free": { miss: 0, hit: 0, out: 0 },
        "muse-spark-1.3": { miss: 1.25, hit: 0.15, out: 4.25 },
        "muse-spark-1.3-contributor-free": { miss: 0, hit: 0, out: 0 },
        "nemotron-3-super-free": { miss: 0, hit: 0, out: 0 },
        "nemotron-3-ultra-free": { miss: 0, hit: 0, out: 0 },
        "nemotron-3.5-lightning-free": { miss: 0, hit: 0, out: 0 },
        "north-mini-code-free": { miss: 0, hit: 0, out: 0 },
        "qwen3-coder": { miss: 0.45, hit: 0.45, out: 1.8 },
        "qwen3.5-plus": { miss: 0.2, hit: 0.02, out: 1.2 },
        "qwen3.6-plus": { miss: 0.5, hit: 0.05, out: 3 },
        "qwen3.6-plus-free": { miss: 0, hit: 0, out: 0 },
        "qwen3.8-flash": { miss: 0.15, hit: 0.016, out: 0.47 },
        "qwen3.8-max": { miss: 2, hit: 0.25, out: 6 },
        "ring-2.6-1t-free": { miss: 0, hit: 0, out: 0 },
        "space-bunny-free": { miss: 0, hit: 0, out: 0 },
        "trinity-large-preview-free": { miss: 0, hit: 0, out: 0 },
        "x-preview-f-free": { miss: 0, hit: 0, out: 0 }
      },
      "opencode-go": {
        "deepseek-v4-flash": { miss: 0.15, hit: 3e-3, out: 0.6 },
        "deepseek-v4-flash-vision-exp": { miss: 0.15, hit: 3e-3, out: 0.6 },
        "deepseek-v4-pro": { miss: 0.66, hit: 0.022, out: 1.98 },
        "deepseek-v4.1-flash": { miss: 0.15, hit: 3e-3, out: 0.6 },
        "glm-5.2": { miss: 1.4, hit: 0.26, out: 4.4 },
        "glm-5.3": { miss: 1.4, hit: 0.26, out: 4.4 },
        "glm-5.3-flash": { miss: 0.15, hit: 0.03, out: 0.5 },
        "gpt-5.6-luna": { miss: 0.2, hit: 0.02, out: 1.2 },
        "gpt-6-luna": { miss: 0.1, hit: 0.01, out: 0.5 },
        "grok-4.5": { miss: 2, hit: 0.3, out: 6 },
        "grok-4.6": { miss: 2, hit: 0.5, out: 6 },
        "grok-4.7": { miss: 2, hit: 0.5, out: 6 },
        "hy3": { miss: 0.14, hit: 0.035, out: 0.58 },
        "hy4-preview": { miss: 0.834, hit: 0.042, out: 2.501 },
        "kimi-k2.6": { miss: 0.95, hit: 0.16, out: 4 },
        "kimi-k2.7-code": { miss: 0.95, hit: 0.19, out: 4 },
        "kimi-k3": { miss: 3, hit: 0.3, out: 15 },
        "longcat-2.0": { miss: 0.3, hit: 6e-3, out: 1.2 },
        "longcat-2.5-preview-free": { miss: 0, hit: 0, out: 0 },
        "mimo-v2.5": { miss: 0.14, hit: 28e-4, out: 0.28 },
        "mimo-v2.5-pro": { miss: 0.435, hit: 3625e-6, out: 0.87 },
        "mimo-v2.6-flash": { miss: 0.14, hit: 28e-4, out: 0.28 },
        "mimo-v2.6-pro": { miss: 0.435, hit: 3625e-6, out: 0.87 },
        "minimax-m2.7": { miss: 0.3, hit: 0.06, out: 1.2 },
        "minimax-m3": { miss: 0.3, hit: 0.06, out: 1.2 },
        "muse-spark-1.2-contributor": { miss: 0.1, hit: 2e-3, out: 0.2 },
        "muse-spark-1.3-contributor": { miss: 0.1, hit: 2e-3, out: 0.2 },
        "qwen3.6-plus": { miss: 0.5, hit: 0.05, out: 3 },
        "qwen3.7-max": { miss: 2.5, hit: 0.5, out: 7.5 },
        "qwen3.7-plus": { miss: 0.4, hit: 0.04, out: 1.6 },
        "qwen3.8-flash": { miss: 0.15, hit: 0.016, out: 0.47 },
        "qwen3.8-max": { miss: 2, hit: 0.25, out: 6 },
        "space-bunny-free": { miss: 0, hit: 0, out: 0 }
      }
    };
  }
});

// src/pricing.ts
function beijingDayKey(ms) {
  const shifted = Number.isFinite(ms) ? ms + 8 * 36e5 : 0;
  return new Date(shifted).toISOString().slice(0, 10);
}
function beijingWeekday(ms) {
  const shifted = Number.isFinite(ms) ? ms + 8 * 36e5 : 0;
  return new Date(shifted).getUTCDay();
}
function isDayKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}
function parseHolidays(raw) {
  if (!Array.isArray(raw)) return void 0;
  const dates = [...new Set(raw.filter(isDayKey))].sort();
  if (dates.length === 0) return void 0;
  return dates.slice(0, 400);
}
function effectiveHolidays(manual, auto) {
  const manualDays = parseHolidays(manual) ?? [];
  const autoDays = parseHolidays(auto) ?? [];
  const manualCount = manualDays.length;
  const autoCount = autoDays.length;
  if (manualCount > 0) {
    return { days: manualDays, source: "manual", autoCount, manualCount };
  }
  if (autoCount === 0) {
    return { days: DEFAULT_PEAK_HOLIDAYS, source: "builtin", autoCount, manualCount };
  }
  const merged = [.../* @__PURE__ */ new Set([...DEFAULT_PEAK_HOLIDAYS, ...autoDays])].sort().slice(-400);
  return { days: merged, source: "auto", autoCount, manualCount };
}
function isPeakAt(at, options = {}) {
  const ms = typeof at === "number" ? at : at.getTime();
  if (!Number.isFinite(ms)) return false;
  if (ms < PEAK_RULE_AT_MS) return false;
  const holidays = options.holidays ?? DEFAULT_PEAK_HOLIDAYS;
  if (ms >= WEEKEND_OFFPEAK_AT_MS && holidays.includes(beijingDayKey(ms))) return false;
  const weekday = beijingWeekday(ms);
  if (ms >= WEEKEND_OFFPEAK_AT_MS && (weekday === 0 || weekday === 6)) return false;
  const date = new Date(ms);
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60;
  return PEAK_UTC_RANGES.some(([start, end]) => hour >= start && hour < end);
}
function peakPhaseAt(atMs, options = {}) {
  const ms = Number.isFinite(atMs) ? atMs : Date.now();
  const holidays = options.holidays ?? DEFAULT_PEAK_HOLIDAYS;
  const inPeak = isPeakAt(ms, { holidays });
  const weekday = beijingWeekday(ms);
  const weekend = ms >= WEEKEND_OFFPEAK_AT_MS && (weekday === 0 || weekday === 6);
  const holiday = ms >= WEEKEND_OFFPEAK_AT_MS && holidays.includes(beijingDayKey(ms));
  const step = 6e4;
  const limit = ms + (options.maxHours ?? 96) * 36e5;
  let nextAtMs = Number.NaN;
  for (let t = Math.floor(ms / step) * step + step; t <= limit; t += step) {
    if (isPeakAt(t, { holidays }) !== inPeak) {
      nextAtMs = t;
      break;
    }
  }
  return {
    inPeak,
    nextAtMs,
    nextIntoPeak: !inPeak,
    minutesUntil: Number.isFinite(nextAtMs) ? Math.max(0, Math.ceil((nextAtMs - ms) / 6e4)) : 0,
    holiday,
    weekend
  };
}
function allEras(extra) {
  if (extra === void 0 || extra.length === 0) return PRICE_ERAS;
  return [...PRICE_ERAS, ...extra].sort((left, right) => left.fromMs - right.fromMs);
}
function eraAt(timeMs, extra) {
  const eras = allEras(extra);
  const ms = Number.isFinite(timeMs) ? timeMs : Date.now();
  let found = eras[0];
  for (const era of eras) {
    if (era.fromMs <= ms) found = era;
  }
  return found;
}
function eraIdAt(timeMs, extra) {
  return eraAt(timeMs, extra).id;
}
function eraById(id, extra) {
  const eras = allEras(extra);
  const key = typeof id === "string" ? id : "";
  return eras.find((era) => era.id === key) ?? eraAt(Date.now(), extra);
}
function parsePriceEras(raw) {
  if (!Array.isArray(raw)) return void 0;
  const out = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const row2 = item;
    const id = typeof row2.id === "string" && row2.id.length > 0 ? row2.id : "";
    const fromMs = finite(row2.fromMs);
    const table = parsePriceTable(row2.table);
    if (id === "" || fromMs === void 0 || table === void 0) continue;
    if (PRICE_ERAS.some((era) => era.id === id)) continue;
    out.push({
      id,
      fromMs,
      label: typeof row2.label === "string" ? row2.label : id,
      source: typeof row2.source === "string" ? row2.source : "",
      table
    });
  }
  return out.length > 0 ? out : void 0;
}
function parsePriceTable(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return void 0;
  const out = {};
  for (const [model, value] of Object.entries(raw)) {
    const entry = parseModelPrice(value);
    if (entry !== void 0) out[model.trim().toLowerCase()] = entry;
  }
  return Object.keys(out).length > 0 ? out : void 0;
}
function parseModelPrice(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return void 0;
  const row2 = raw;
  const peak = parseTierSet(row2.peak);
  const offPeak = parseTierSet(row2.offPeak);
  return peak === void 0 || offPeak === void 0 ? void 0 : { peak, offPeak };
}
function parseTierSet(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return void 0;
  const row2 = raw;
  const cny = parseTriple(row2.cny);
  const usd = parseTriple(row2.usd);
  return cny === void 0 || usd === void 0 ? void 0 : { cny, usd };
}
function parseTriple(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return void 0;
  const row2 = raw;
  const miss = finite(row2.miss);
  const hit = finite(row2.hit);
  const out = finite(row2.out);
  if (miss === void 0 || hit === void 0 || out === void 0) return void 0;
  if (miss < 0 || hit < 0 || out < 0) return void 0;
  return { miss, hit, out };
}
function isDeepSeekRoute(provider, model) {
  const providerText = typeof provider === "string" ? provider.trim().toLowerCase() : "";
  if (providerText.includes("deepseek")) return true;
  const modelText = typeof model === "string" ? model.trim().toLowerCase() : "";
  return modelText.startsWith("deepseek");
}
function providerRateOf(table, provider, model) {
  if (table === void 0) return void 0;
  const rawProvider = typeof provider === "string" ? provider.trim().toLowerCase() : "";
  const rawModel = typeof model === "string" ? model.trim().toLowerCase() : "";
  if (rawModel === "") return void 0;
  const candidates = [rawProvider, PROVIDER_ALIASES[rawProvider] ?? ""].filter((key) => key.length > 0);
  for (const key of candidates) {
    const rate = table[key]?.[rawModel];
    if (rate !== void 0) return { provider: key, model: rawModel, rate };
  }
  const matches = [];
  for (const [key, models] of Object.entries(table)) {
    const rate = models[rawModel];
    if (rate !== void 0 && !matches.some((hit) => hit.provider === key)) matches.push({ provider: key, rate });
  }
  return matches.length === 1 ? { provider: matches[0].provider, model: rawModel, rate: matches[0].rate } : void 0;
}
function finite(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
function overrideEntryOf(table, provider, model) {
  if (table === void 0) return void 0;
  const providerKey = typeof provider === "string" ? provider.trim().toLowerCase() : "";
  const modelKey = String(model ?? "").trim().toLowerCase();
  if (modelKey === "") return void 0;
  const normalized = normalizeModel(modelKey);
  const modelKeys = normalized === modelKey ? [modelKey] : [normalized, modelKey];
  const keys = [];
  for (const key of modelKeys) {
    if (providerKey !== "") keys.push(`${providerKey}:${key}`, `${providerKey}/${key}`);
    keys.push(key);
  }
  for (const key of keys) {
    const entry = table[key];
    if (entry !== void 0) return entry;
  }
  return void 0;
}
function normalizeModel(model) {
  if (typeof model !== "string" || model.length === 0) return DEFAULT_PRICING_MODEL;
  const key = model.trim().toLowerCase();
  if (key.length === 0) return DEFAULT_PRICING_MODEL;
  return MODEL_ALIASES[key] ?? key;
}
function isKnownModel(model) {
  return normalizeModel(model) in PRICE_TABLE;
}
function applyTier(base2, tier) {
  if (tier === void 0) return { prices: base2, touched: false };
  const miss = finite(tier.cacheMissInput) ?? finite(tier.miss);
  const hit = finite(tier.cacheHitInput) ?? finite(tier.hit);
  const out = finite(tier.output) ?? finite(tier.out);
  const next = {
    miss: miss ?? base2.miss,
    hit: hit ?? base2.hit,
    out: out ?? base2.out
  };
  const touched2 = miss !== void 0 && miss !== base2.miss || hit !== void 0 && hit !== base2.hit || out !== void 0 && out !== base2.out;
  return { prices: next, touched: touched2 };
}
function msOf(at) {
  if (at instanceof Date) return at.getTime();
  if (typeof at === "number" && Number.isFinite(at)) return at;
  return Date.now();
}
function resolvePrice(model, options = {}) {
  const currency = options.currency === "USD" ? "USD" : "CNY";
  const provider = typeof options.provider === "string" ? options.provider : "";
  const atMs = msOf(options.at);
  const deepseek = isDeepSeekRoute(provider, model);
  if (!deepseek) {
    const raw = typeof model === "string" ? model.trim() : "";
    const synced = providerRateOf(options.providers, provider, raw);
    const snapshot = synced === void 0 ? providerRateOf(BUILTIN_PROVIDER_PRICES, provider, raw) : void 0;
    const found = synced ?? snapshot;
    if (found === void 0) {
      return {
        model: raw,
        provider,
        peak: false,
        era: "",
        currency,
        prices: ZERO_TRIPLE,
        overridden: false,
        unpriced: true,
        builtin: false,
        source: "none"
      };
    }
    const fromSnapshot = synced === void 0;
    const usd = { miss: found.rate.miss, hit: found.rate.hit, out: found.rate.out };
    const cny2 = {
      miss: usd.miss * CNY_PER_USD,
      hit: usd.hit * CNY_PER_USD,
      out: usd.out * CNY_PER_USD
    };
    const override2 = overrideEntryOf(options.overrides, provider, raw);
    const overrideTier2 = override2?.offPeak ?? override2?.peak;
    if (overrideTier2 === void 0) {
      return {
        model: raw,
        provider,
        peak: false,
        era: "",
        currency,
        prices: currency === "USD" ? usd : cny2,
        overridden: false,
        unpriced: false,
        builtin: fromSnapshot,
        source: "provider"
      };
    }
    const applied2 = applyTier(cny2, overrideTier2);
    const prices2 = currency === "USD" ? { miss: applied2.prices.miss / CNY_PER_USD, hit: applied2.prices.hit / CNY_PER_USD, out: applied2.prices.out / CNY_PER_USD } : applied2.prices;
    return {
      model: raw,
      provider,
      peak: false,
      era: "",
      currency,
      prices: prices2,
      overridden: applied2.touched,
      unpriced: false,
      builtin: fromSnapshot,
      source: "override"
    };
  }
  const era = options.era !== void 0 ? eraById(options.era, options.eras) : eraAt(atMs, options.eras);
  const normalized = normalizeModel(model);
  const base2 = era.table[normalized] ?? era.table[DEFAULT_PRICING_MODEL];
  const peak = options.peak ?? isPeakAt(atMs, { holidays: options.holidays });
  const tier = peak ? base2.peak : base2.offPeak;
  const override = overrideEntryOf(options.overrides, provider, model);
  const overrideTier = peak ? override?.peak : override?.offPeak;
  if (overrideTier === void 0) {
    return {
      model: normalized,
      provider,
      peak,
      era: era.id,
      currency,
      prices: currency === "USD" ? tier.usd : tier.cny,
      overridden: false,
      unpriced: false,
      builtin: false,
      source: "official"
    };
  }
  const applied = applyTier(tier.cny, overrideTier);
  const cny = applied.prices;
  const prices = currency === "USD" ? { miss: cny.miss / CNY_PER_USD, hit: cny.hit / CNY_PER_USD, out: cny.out / CNY_PER_USD } : cny;
  return {
    model: normalized,
    provider,
    peak,
    era: era.id,
    currency,
    prices,
    overridden: applied.touched,
    unpriced: false,
    builtin: false,
    source: "override"
  };
}
function costBucketsOf(usage) {
  return {
    miss: finite(usage?.inputTokens) ?? finite(usage?.uncachedInputTokens) ?? 0,
    hit: finite(usage?.cacheReadTokens) ?? 0,
    out: finite(usage?.outputTokens) ?? 0
  };
}
function costPartsOf(buckets, prices) {
  const miss = buckets.miss / 1e6 * prices.miss;
  const hit = buckets.hit / 1e6 * prices.hit;
  const out = buckets.out / 1e6 * prices.out;
  return { miss, hit, out, total: miss + hit + out };
}
function trimZeros(text, minDecimals) {
  const dot = text.indexOf(".");
  if (dot < 0) return text;
  const head = text.slice(0, dot);
  const fraction = text.slice(dot + 1);
  let end = fraction.length;
  while (end > minDecimals && fraction[end - 1] === "0") end -= 1;
  return end === 0 ? head : `${head}.${fraction.slice(0, end)}`;
}
function formatMoney(value, currency = "CNY") {
  const symbol = currency === "USD" ? "$" : "\xA5";
  const n = finite(value);
  if (n === void 0 || n === 0) return `${symbol}0.00`;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1) return `${sign}${symbol}${abs.toFixed(2)}`;
  if (abs >= 0.01) return `${sign}${symbol}${trimZeros(abs.toFixed(4), 2)}`;
  return `${sign}${symbol}${trimZeros(abs.toFixed(6), 2)}`;
}
function formatTokens(value) {
  const n = finite(value);
  if (n === void 0 || n === 0) return "0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return sign + trimZeros((abs / 1e9).toFixed(2), 0) + "B";
  if (abs >= 1e6) return sign + trimZeros((abs / 1e6).toFixed(2), 0) + "M";
  if (abs >= 1e3) return sign + trimZeros((abs / 1e3).toFixed(1), 0) + "K";
  return sign + String(Math.round(abs));
}
function formatCountdown(minutes) {
  const n = finite(minutes);
  if (n === void 0 || n <= 0) return "\u4E0D\u5230 1 \u5206\u949F";
  const total = Math.round(n);
  if (total < 60) return `${total} \u5206\u949F`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours >= 24) return `${Math.floor(hours / 24)} \u5929 ${hours % 24} \u5C0F\u65F6`;
  return rest === 0 ? `${hours} \u5C0F\u65F6` : `${hours} \u5C0F\u65F6 ${rest} \u5206\u949F`;
}
function parsePriceOverrides(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return void 0;
  const out = {};
  for (const [model, value] of Object.entries(raw)) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) continue;
    const tiers = {};
    for (const tierName of ["peak", "offPeak"]) {
      const tierRaw = value[tierName];
      if (typeof tierRaw !== "object" || tierRaw === null || Array.isArray(tierRaw)) continue;
      const source = tierRaw;
      const tier = {};
      for (const key of ["cacheMissInput", "miss", "cacheHitInput", "hit", "output", "out"]) {
        const n = finite(source[key]);
        if (n !== void 0 && n >= 0) tier[key] = n;
      }
      if (Object.keys(tier).length > 0) tiers[tierName] = tier;
    }
    if (Object.keys(tiers).length > 0) out[String(model).trim().toLowerCase()] = tiers;
  }
  return Object.keys(out).length > 0 ? out : void 0;
}
function officialTripleOf(model, peak, options = {}) {
  return resolvePrice(model, { ...options, peak }).prices;
}
function overrideTierOf(table, model, peak, provider) {
  const entry = overrideEntryOf(table, provider, model);
  return peak ? entry?.peak : entry?.offPeak;
}
function overrideValueOf(table, model, peak, field, provider) {
  const tier = overrideTierOf(table, model, peak, provider);
  if (tier === void 0) return void 0;
  return finite(tier[field]);
}
function withOverrideValue(table, model, peak, field, value, provider) {
  const providerKey = typeof provider === "string" ? provider.trim().toLowerCase() : "";
  const modelKey = String(model ?? "").trim().toLowerCase();
  if (modelKey.length === 0) return table;
  const key = providerKey === "" ? modelKey : `${providerKey}:${modelKey}`;
  const next = { ...table ?? {} };
  const tierName = peak ? "peak" : "offPeak";
  const current = next[key] ?? {};
  const tier = { ...peak ? current.peak : current.offPeak };
  const n = finite(value);
  if (n === void 0 || n < 0) delete tier[field];
  else tier[field] = n;
  const entry = { ...current };
  if (Object.keys(tier).length === 0) delete entry[tierName];
  else entry[tierName] = tier;
  if (entry.peak === void 0 && entry.offPeak === void 0) delete next[key];
  else next[key] = entry;
  return Object.keys(next).length > 0 ? next : void 0;
}
function customPricingModels(table) {
  if (table === void 0) return [];
  return Object.keys(table).filter((key) => !isKnownModel(key));
}
function withoutPricingModel(table, model, provider) {
  if (table === void 0) return void 0;
  const providerKey = typeof provider === "string" ? provider.trim().toLowerCase() : "";
  const modelKey = String(model ?? "").trim().toLowerCase();
  const key = providerKey === "" ? modelKey : `${providerKey}:${modelKey}`;
  const next = { ...table };
  delete next[key];
  return Object.keys(next).length > 0 ? next : void 0;
}
function parsePriceText(text) {
  const trimmed = text.trim();
  if (trimmed === "") return { kind: "empty" };
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return { kind: "invalid" };
  return { kind: "number", value };
}
var ZERO_TRIPLE, CNY_PER_USD, PEAK_UTC_RANGES, PEAK_RULE_AT_MS, WEEKEND_OFFPEAK_AT_MS, DEFAULT_PEAK_HOLIDAYS, ERA_LEGACY, ERA_2026_08, ERA_2026_09, PRICE_ERAS, CURRENT_ERA_ID, PRICE_TABLE, MODEL_ALIASES, DEFAULT_PRICING_MODEL, BUILTIN_PRICING_MODELS, PRICE_VERIFIED_AT, PROVIDER_ALIASES, PRICE_FIELDS;
var init_pricing = __esm({
  "src/pricing.ts"() {
    init_provider_prices();
    ZERO_TRIPLE = { miss: 0, hit: 0, out: 0 };
    CNY_PER_USD = 6.82;
    PEAK_UTC_RANGES = [[1, 4], [6, 10]];
    PEAK_RULE_AT_MS = Date.parse("2026-08-16T16:00:00Z");
    WEEKEND_OFFPEAK_AT_MS = Date.parse("2026-08-22T16:00:00Z");
    DEFAULT_PEAK_HOLIDAYS = [
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
      "2026-10-07"
    ];
    ERA_LEGACY = {
      id: "legacy",
      fromMs: 0,
      label: "\u5CF0\u8C37\u5236\u4E4B\u524D\uFF08\u5355\u4E00\u6863\u4EF7\uFF09",
      source: 'https://api-docs.deepseek.com/zh-cn/updates\uFF082026-07-31 V4-Flash-0731 \u4E0A\u7EBF\u65F6\u7684\u4EF7\u76EE\uFF1B2026-08-13 \u6DA8\u4EF7\u516C\u544A\u7684"\u6DA8\u524D\u4EF7"\u9010\u9879\u5BF9\u4E0A\uFF1AFlash \u547D\u4E2D 0.02 / \u672A\u547D\u4E2D 1 / \u8F93\u51FA 2\uFF0CPro \u547D\u4E2D 0.025 / \u672A\u547D\u4E2D 3 / \u8F93\u51FA 6\uFF09',
      table: {
        "deepseek-flash": {
          peak: { cny: { miss: 1, hit: 0.02, out: 2 }, usd: { miss: 0.14, hit: 28e-4, out: 0.28 } },
          offPeak: { cny: { miss: 1, hit: 0.02, out: 2 }, usd: { miss: 0.14, hit: 28e-4, out: 0.28 } }
        },
        "deepseek-v4-pro": {
          peak: { cny: { miss: 3, hit: 0.025, out: 6 }, usd: { miss: 0.435, hit: 3625e-6, out: 0.87 } },
          offPeak: { cny: { miss: 3, hit: 0.025, out: 6 }, usd: { miss: 0.435, hit: 3625e-6, out: 0.87 } }
        }
      }
    };
    ERA_2026_08 = {
      id: "peak-2026-08",
      fromMs: PEAK_RULE_AT_MS,
      label: "\u5CF0\u8C37\u4E24\u6863\uFF082026-08 \u4EF7\uFF09",
      source: "https://api-docs.deepseek.com/zh-cn/quick_start/pricing\uFF082026-08 \u7248\uFF09",
      table: {
        "deepseek-flash": {
          offPeak: { cny: { miss: 1.5, hit: 0.05, out: 4.5 }, usd: { miss: 0.22, hit: 7e-3, out: 0.66 } },
          peak: { cny: { miss: 3, hit: 0.1, out: 9 }, usd: { miss: 0.44, hit: 0.014, out: 1.32 } }
        },
        "deepseek-v4-pro": {
          offPeak: { cny: { miss: 4.5, hit: 0.15, out: 13.5 }, usd: { miss: 0.66, hit: 0.022, out: 1.98 } },
          peak: { cny: { miss: 9, hit: 0.3, out: 27 }, usd: { miss: 1.32, hit: 0.044, out: 3.96 } }
        }
      }
    };
    ERA_2026_09 = {
      id: "flash-2026-09-10",
      fromMs: Date.parse("2026-09-10T04:00:00Z"),
      label: "Flash \u964D\u4EF7\u540E\uFF082026-09-10 \u8D77\uFF09",
      source: "https://api-docs.deepseek.com/zh-cn/quick_start/pricing + https://intl.cloud.tencent.com/ind/announce/detail/101513",
      table: {
        "deepseek-flash": {
          offPeak: { cny: { miss: 1, hit: 0.02, out: 4 }, usd: { miss: 0.15, hit: 3e-3, out: 0.6 } },
          peak: { cny: { miss: 2, hit: 0.04, out: 8 }, usd: { miss: 0.3, hit: 6e-3, out: 1.2 } }
        },
        "deepseek-v4-pro": {
          offPeak: { cny: { miss: 4.5, hit: 0.15, out: 13.5 }, usd: { miss: 0.66, hit: 0.022, out: 1.98 } },
          peak: { cny: { miss: 9, hit: 0.3, out: 27 }, usd: { miss: 1.32, hit: 0.044, out: 3.96 } }
        }
      }
    };
    PRICE_ERAS = [ERA_LEGACY, ERA_2026_08, ERA_2026_09];
    CURRENT_ERA_ID = ERA_2026_09.id;
    PRICE_TABLE = ERA_2026_09.table;
    MODEL_ALIASES = {
      // 官方脚注：`deepseek-v4-flash`、`deepseek-v4-flash-vision-exp` 仍可调用，
      // 但对应模型已下线、请求由 V4.1-Flash 服务，**并按 Flash 价计费**。
      "deepseek-v4-flash": "deepseek-flash",
      "deepseek-v4-flash-vision-exp": "deepseek-flash",
      "deepseek-v4.1-flash": "deepseek-flash",
      // 更早的两代名（V4 首发时的兼容名），只作历史日志的兜底映射。
      // ⚠️ 官方更新日志（2026-04-24，中英两版都写了）：`deepseek-chat` 与 `deepseek-reasoner`
      // **都指向 `deepseek-v4-flash`** —— 前者是非思考模式、后者是思考模式，
      // 与 `deepseek-v4-pro` **没有**对应关系，且这两个名字已于 2026-07-24 停用。
      // （0.10.0 一度把 reasoner 映到 Pro，那会把 flash 的用量按 Pro 价算，约 3 倍；已修。）
      "deepseek-chat": "deepseek-flash",
      "deepseek-reasoner": "deepseek-flash"
    };
    DEFAULT_PRICING_MODEL = "deepseek-flash";
    BUILTIN_PRICING_MODELS = Object.keys(PRICE_TABLE);
    PRICE_VERIFIED_AT = "2026-09-29";
    PROVIDER_ALIASES = {
      "deepseek-official": "deepseek",
      "llm-deepseek": "deepseek",
      "kimi-coding": "moonshotai",
      "minimax-cn": "minimax",
      "zai-coding-cn": "zhipuai"
    };
    PRICE_FIELDS = ["miss", "hit", "out"];
  }
});

// src/terminal/discover.ts
function normalizePath(value) {
  const trimmed = value.trim().replace(/^"|"$/g, "");
  const slashed = trimmed.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  return slashed.length > 1 ? slashed.replace(/\/+$/, "") : slashed;
}
var init_discover = __esm({
  "src/terminal/discover.ts"() {
  }
});

// src/terminal/contracts.ts
function terminalModeFrom(value) {
  return value === "auto" || value === "gitbash" || value === "pwsh" ? value : DEFAULT_TERMINAL_MODE;
}
function sanitizeTerminalCandidates(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const item of value) {
    if (out.length >= 20) break;
    if (typeof item !== "object" || item === null) continue;
    const row2 = item;
    const path = typeof row2.path === "string" ? normalizePath(row2.path).slice(0, 400) : "";
    if (path === "") continue;
    const key = path.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const label = typeof row2.label === "string" ? row2.label.slice(0, 40) : "";
    const kind = row2.kind === "git" || row2.kind === "msys2" || row2.kind === "cygwin" || row2.kind === "niubash" || row2.kind === "path" ? row2.kind : "path";
    out.push({ path, label: label === "" ? "PATH" : label, kind, explicit: row2.explicit === true });
  }
  return out;
}
var TERMINAL_MODE_FIELD, TERMINAL_BASH_PATH_FIELD, TERMINAL_CANDIDATES_FIELD, TERMINAL_STATUS_FIELD, TERMINAL_EFFECTIVE_FIELD, TERMINAL_API_PATH, TERMINAL_MODES, DEFAULT_TERMINAL_MODE;
var init_contracts = __esm({
  "src/terminal/contracts.ts"() {
    init_discover();
    TERMINAL_MODE_FIELD = "terminalMode";
    TERMINAL_BASH_PATH_FIELD = "terminalBashPath";
    TERMINAL_CANDIDATES_FIELD = "terminalCandidates";
    TERMINAL_STATUS_FIELD = "terminalStatus";
    TERMINAL_EFFECTIVE_FIELD = "terminalEffective";
    TERMINAL_API_PATH = "/composer-ux/terminal";
    TERMINAL_MODES = [
      {
        id: "auto",
        label: "\u81EA\u52A8",
        hint: "\u63A2\u6D4B\u5230 Git Bash \u5C31\u7528\u5B83\uFF08\u627E\u4E0D\u5230\u5219\u4FDD\u6301 PowerShell\uFF09\uFF1B\u5F00\u7BB1\u5373\u7528\uFF0C\u4E0D\u7528\u624B\u586B\u8DEF\u5F84"
      },
      {
        id: "gitbash",
        label: "Git Bash",
        hint: "\u5F3A\u5236\u6362\u6210 Git Bash\uFF1B\u6CA1\u63A2\u6D4B\u5230\u5C31\u56DE\u843D PowerShell\uFF0C\u5E76\u5728\u72B6\u6001\u884C\u5199\u660E\u539F\u56E0"
      },
      {
        id: "pwsh",
        label: "PowerShell",
        hint: "\u4FDD\u6301 DSH \u9ED8\u8BA4\uFF08\u672C\u63D2\u4EF6\u5B8C\u5168\u4E0D\u78B0\u7EC8\u7AEF\u5DE5\u5177\u9762\uFF09"
      }
    ];
    DEFAULT_TERMINAL_MODE = "auto";
  }
});

// src/settings-contract.ts
function normalizeOptimizerTurns(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_OPTIMIZER_TURNS;
  return Math.min(OPTIMIZER_TURNS_MAX, Math.max(OPTIMIZER_TURNS_MIN, Math.round(value)));
}
function splitSlashCommand(text) {
  const matched = SLASH_COMMAND_RE.exec(text);
  if (matched === null) return { prefix: "", body: text };
  return { prefix: matched[1] ?? "", body: (matched[2] ?? "").trim() };
}
function insertModeOf(prompt) {
  if (prompt.always) return "always";
  if (prompt.firstOnly) return "first";
  return "never";
}
function normalizeOptimizerTier(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (raw === "off" || raw === "light" || raw === "standard" || raw === "heavy") return raw;
  return LEGACY_OPTIMIZER_TIERS[raw] ?? DEFAULT_OPTIMIZER_TIER;
}
function optimizerPromptFieldOf(tier) {
  if (tier === "off") return "";
  return OPTIMIZER_PROMPT_FIELDS[tier] ?? OPTIMIZER_PROMPT_FIELDS[DEFAULT_OPTIMIZER_TIER];
}
function newQuickPromptId() {
  return `qp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function newQuickCategoryId() {
  return `qc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function defaultQuickBook() {
  return {
    version: QUICK_BOOK_VERSION,
    categories: [{ id: "cat-default", name: DEFAULT_CATEGORY_NAME, prompts: DEFAULT_QUICK_PROMPTS }]
  };
}
function asPromptRow(value) {
  if (typeof value !== "object" || value === null) return void 0;
  const row2 = value;
  const either = (first, second) => {
    const picked = typeof first === "string" && first !== "" ? first : second;
    return typeof picked === "string" ? picked : "";
  };
  const prompt = either(row2.prompt, row2.text).slice(0, QUICK_TEXT_MAX).trim();
  if (prompt === "") return void 0;
  const label = either(row2.label, row2.title).slice(0, QUICK_LABEL_MAX).trim();
  const id = typeof row2.id === "string" && row2.id !== "" ? row2.id.slice(0, 64) : newQuickPromptId();
  const order = typeof row2.order === "number" && Number.isFinite(row2.order) ? Math.max(1, Math.round(row2.order)) : void 0;
  return {
    prompt: {
      id,
      label: label === "" ? prompt.slice(0, 12) : label,
      prompt,
      always: row2.always === true || row2.autoSend === true,
      firstOnly: row2.firstOnly === true || row2.autoSendFirst === true
    },
    order
  };
}
function toPromptList(values) {
  const rows = [];
  for (const value of values) {
    const row2 = asPromptRow(value);
    if (row2 !== void 0) rows.push({ ...row2, index: rows.length });
  }
  rows.sort((a, b) => {
    const left = a.order ?? Number.MAX_SAFE_INTEGER;
    const right = b.order ?? Number.MAX_SAFE_INTEGER;
    return left === right ? a.index - b.index : left - right;
  });
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const row2 of rows) {
    if (out.length >= QUICK_PROMPT_MAX) break;
    if (seen.has(row2.prompt.id)) continue;
    seen.add(row2.prompt.id);
    out.push(row2.prompt);
  }
  return out;
}
function sanitizeBook(value) {
  if (typeof value !== "object" || value === null) return void 0;
  const source = value;
  const flat = Array.isArray(value) ? value : Array.isArray(source.prompts) ? source.prompts : void 0;
  if (flat !== void 0) {
    const prompts = toPromptList(flat);
    return {
      version: QUICK_BOOK_VERSION,
      categories: prompts.length === 0 ? [] : [{ id: "cat-default", name: DEFAULT_CATEGORY_NAME, prompts }]
    };
  }
  if (!Array.isArray(source.categories)) return void 0;
  const seen = /* @__PURE__ */ new Set();
  const categories = [];
  for (const raw of source.categories) {
    if (categories.length >= QUICK_CATEGORY_MAX) break;
    if (typeof raw !== "object" || raw === null) continue;
    const row2 = raw;
    const prompts = toPromptList(Array.isArray(row2.prompts) ? row2.prompts : []);
    const wanted = typeof row2.id === "string" && row2.id !== "" ? row2.id.slice(0, 64) : newQuickCategoryId();
    const id = seen.has(wanted) ? newQuickCategoryId() : wanted;
    seen.add(id);
    const name2 = (typeof row2.name === "string" ? row2.name : "").slice(0, QUICK_CATEGORY_NAME_MAX).trim();
    categories.push({ id, name: name2 === "" ? DEFAULT_CATEGORY_NAME : name2, prompts });
  }
  return { version: QUICK_BOOK_VERSION, categories };
}
function flattenQuickPrompts(book) {
  return book.categories.flatMap((category) => category.prompts);
}
function alwaysQuickPrompts(book) {
  return flattenQuickPrompts(book).filter((prompt) => insertModeOf(prompt) === "always");
}
function firstOnlyQuickPrompts(book) {
  return flattenQuickPrompts(book).filter((prompt) => insertModeOf(prompt) === "first");
}
function appendBatchForSend(book, blank) {
  const every = alwaysQuickPrompts(book);
  if (!blank) return every;
  return [...every, ...firstOnlyQuickPrompts(book)];
}
function activeSections(settings) {
  const on = settings.enabled;
  return {
    keys: on && settings.keysEnabled,
    quick: on && settings.quickEnabled,
    panel: on && settings.panelEnabled,
    terminal: on && settings.terminalEnabled,
    stats: on && settings.statsEnabled
  };
}
function touched(source, field, untouched) {
  const value = source[field];
  return value !== void 0 && value !== untouched;
}
function sectionEnabledOf(field, source) {
  const explicit = source[field];
  if (typeof explicit === "boolean") return explicit;
  const signal = SECTION_SIGNALS[field];
  return signal === void 0 ? false : signal(source);
}
function sanitizePeakAlert(raw) {
  const row2 = typeof raw === "object" && raw !== null ? raw : {};
  const bool = (key, fallback) => typeof row2[key] === "boolean" ? row2[key] : fallback;
  const ahead = typeof row2.aheadMinutes === "number" && Number.isFinite(row2.aheadMinutes) ? Math.min(60, Math.max(1, Math.round(row2.aheadMinutes))) : DEFAULT_PEAK_ALERT.aheadMinutes;
  return {
    enabled: bool("enabled", DEFAULT_PEAK_ALERT.enabled),
    aheadMinutes: ahead,
    onPeak: bool("onPeak", DEFAULT_PEAK_ALERT.onPeak),
    onOffPeak: bool("onOffPeak", DEFAULT_PEAK_ALERT.onOffPeak),
    webNotify: bool("webNotify", DEFAULT_PEAK_ALERT.webNotify)
  };
}
function parseSyncedPrices(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return void 0;
  const row2 = raw;
  const stamp = (key) => {
    const value = row2[key];
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : void 0;
  };
  const count2 = (key) => {
    const value = row2[key];
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : void 0;
  };
  const fetchedAt = stamp("fetchedAt");
  const modelsDevAt = stamp("modelsDevAt");
  const modelsDevCount = count2("modelsDevCount");
  const eras = parsePriceEras(row2.eras);
  const holidays = parseHolidays(row2.holidays);
  const holidaysAt = stamp("holidaysAt");
  const holidayYears = parseHolidayYears(row2.holidayYears);
  const out = {
    ...fetchedAt === void 0 ? {} : { fetchedAt },
    ...eras === void 0 ? {} : { eras },
    ...modelsDevAt === void 0 ? {} : { modelsDevAt },
    ...modelsDevCount === void 0 ? {} : { modelsDevCount },
    ...holidays === void 0 ? {} : { holidays },
    ...holidaysAt === void 0 ? {} : { holidaysAt },
    ...holidayYears === void 0 ? {} : { holidayYears }
  };
  return Object.keys(out).length > 0 ? out : void 0;
}
function parseHolidayYears(raw) {
  if (!Array.isArray(raw)) return void 0;
  const years = [...new Set(raw.filter(
    (item) => typeof item === "number" && Number.isInteger(item) && item >= 2e3 && item <= 2100
  ))].sort((left, right) => left - right);
  return years.length === 0 ? void 0 : years.slice(0, 12);
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
  const asPrompt = (field, max) => {
    const v = source[field];
    return typeof v === "string" ? v.slice(0, max) : "";
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
      out.push({
        id,
        label: label === "" ? prompt.slice(0, 12) : label,
        prompt,
        always: row2.always === true,
        firstOnly: row2.firstOnly === true
      });
    }
    return out;
  };
  const asTier = () => normalizeOptimizerTier(source[OPTIMIZER_TIER_FIELD]);
  return {
    enabled: asBool(ENABLED_FIELD),
    // 各栏开关：显式写过听它的，否则按"用户碰过没"迁移（见 sectionEnabledOf）。
    keysEnabled: sectionEnabledOf(KEYS_ENABLED_FIELD, source),
    quickEnabled: sectionEnabledOf(QUICK_ENABLED_FIELD, source),
    panelEnabled: sectionEnabledOf(PANEL_ENABLED_FIELD, source),
    terminalEnabled: sectionEnabledOf(TERMINAL_ENABLED_FIELD, source),
    sendKey: asString(SEND_KEY_FIELD),
    newlineKey: asString(NEWLINE_KEY_FIELD),
    panelResize: asBool(PANEL_RESIZE_FIELD),
    panelWidth: asSize(PANEL_WIDTH_FIELD),
    panelHeight: asSize(PANEL_HEIGHT_FIELD),
    quickPrompts: asQuickPrompts(),
    optimizerTier: asTier(),
    optimizerContext: asBool(OPTIMIZER_CONTEXT_FIELD),
    optimizerLedger: asBool(OPTIMIZER_LEDGER_FIELD),
    optimizeKeepDock: asBool(OPTIMIZE_KEEP_DOCK_FIELD),
    optimizeReadTools: asBool(OPTIMIZE_READ_TOOLS_FIELD),
    // 枚举只认白名单里的值：写坏了就落回默认（与其它枚举字段同一做法）。
    optimizerFraming: source[OPTIMIZER_FRAMING_FIELD] === "hard" ? "hard" : DEFAULT_OPTIMIZER_FRAMING,
    optimizerPermission: source[OPTIMIZER_PERMISSION_FIELD] === "auto" ? "auto" : DEFAULT_OPTIMIZER_PERMISSION,
    optimizerModel: typeof source[OPTIMIZER_MODEL_FIELD] === "string" ? source[OPTIMIZER_MODEL_FIELD].trim().slice(0, OPTIMIZER_MODEL_MAX) : "",
    optimizerHistory: source[OPTIMIZER_HISTORY_FIELD] === "full" ? "full" : "turns",
    optimizerTurns: normalizeOptimizerTurns(source[OPTIMIZER_TURNS_FIELD]),
    optimizeBash: asBool(OPTIMIZE_BASH_FIELD),
    // 0.14.0 改名迁移：新字段为空而旧字段有内容 ⇒ 用旧内容（用户改过的提示词不该因为改名丢掉）。
    optimizerPromptLight: asPrompt(OPTIMIZER_PROMPT_FIELDS.light, OPTIMIZER_PROMPT_MAX) || asPrompt(LEGACY_OPTIMIZER_PROMPT_FIELDS.light, OPTIMIZER_PROMPT_MAX),
    optimizerPromptStandard: asPrompt(OPTIMIZER_PROMPT_FIELDS.standard, OPTIMIZER_PROMPT_MAX) || asPrompt(LEGACY_OPTIMIZER_PROMPT_FIELDS.standard, OPTIMIZER_PROMPT_MAX),
    optimizerPromptHeavy: asPrompt(OPTIMIZER_PROMPT_FIELDS.heavy, OPTIMIZER_PROMPT_MAX) || asPrompt(LEGACY_OPTIMIZER_PROMPT_FIELDS.heavy, OPTIMIZER_PROMPT_MAX),
    terminalMode: terminalModeFrom(source[TERMINAL_MODE_FIELD]),
    // 路径只做长度与归一化收窄，不在这里判"存不存在"——那是宿主半的探测结论，
    // 由状态行告诉用户（用户看得见自己填了什么，比悄悄清空好）。
    terminalBashPath: asText(TERMINAL_BASH_PATH_FIELD, 400),
    terminalCandidates: sanitizeTerminalCandidates(source[TERMINAL_CANDIDATES_FIELD]),
    terminalStatus: asText(TERMINAL_STATUS_FIELD, 400),
    terminalEffective: asText(TERMINAL_EFFECTIVE_FIELD, 16),
    // 「统计行」（0.7.0）：普通布尔字段、默认开 —— **不走** sectionEnabledOf（那套是给
    // 已发布的五栏做"碰过才开"迁移用的；新栏没有痕迹可依，且用户要求默认生效）。
    statsEnabled: asBool(STATS_ENABLED_FIELD),
    // 「金额」（0.9.1）：整张覆盖价表，形状不对的项由 parsePriceOverrides 逐项丢掉。
    priceOverrides: parsePriceOverrides(source[PRICE_OVERRIDES_FIELD]),
    // 「金额」（0.10.0）：节假日表（坏日期逐条丢）、峰谷提醒、余额开关、同步元信息。
    peakHolidays: parseHolidays(source[PEAK_HOLIDAYS_FIELD]),
    peakAlert: sanitizePeakAlert(source[PEAK_ALERT_FIELD]),
    balanceEnabled: asBool(BALANCE_ENABLED_FIELD),
    syncedPrices: parseSyncedPrices(source[SYNCED_PRICES_FIELD]),
    priceAutoSync: asBool(PRICE_AUTO_SYNC_FIELD)
  };
}
var NAMESPACE, REPO_URL, SITE_URL, RESTART_API_PATH, USAGE_API_PATH, QUOTA_API_PATH, NAV_FOLD_API_PATH, MODELS_API_PATH, RESTART_CSRF_HEADER, RESTART_CSRF_VALUE, SYNC_API_PATH, ENABLED_FIELD, KEYS_ENABLED_FIELD, QUICK_ENABLED_FIELD, PANEL_ENABLED_FIELD, TERMINAL_ENABLED_FIELD, STATS_ENABLED_FIELD, PRICE_OVERRIDES_FIELD, PEAK_HOLIDAYS_FIELD, HOLIDAY_SOURCE_LABEL, PEAK_ALERT_FIELD, PRICE_AUTO_SYNC_FIELD, BALANCE_ENABLED_FIELD, SYNCED_PRICES_FIELD, DEFAULT_PEAK_ALERT, SEND_KEY_FIELD, NEWLINE_KEY_FIELD, PANEL_RESIZE_FIELD, PANEL_WIDTH_FIELD, PANEL_HEIGHT_FIELD, QUICK_PROMPTS_FIELD, OPTIMIZER_TIER_FIELD, OPTIMIZER_CONTEXT_FIELD, OPTIMIZER_LEDGER_FIELD, OPTIMIZE_KEEP_DOCK_FIELD, OPTIMIZE_READ_TOOLS_FIELD, OPTIMIZER_FRAMING_FIELD, OPTIMIZER_FRAMINGS, DEFAULT_OPTIMIZER_FRAMING, OPTIMIZER_PERMISSION_FIELD, OPTIMIZER_PERMISSIONS, DEFAULT_OPTIMIZER_PERMISSION, OPTIMIZER_MODEL_FIELD, OPTIMIZER_MODEL_MAX, OPTIMIZER_HISTORY_FIELD, OPTIMIZER_TURNS_FIELD, OPTIMIZER_TURNS_MIN, OPTIMIZER_TURNS_MAX, DEFAULT_OPTIMIZER_TURNS, OPTIMIZE_BASH_FIELD, QUICK_PROMPT_MAX, QUICK_CATEGORY_MAX, QUICK_CATEGORY_NAME_MAX, QUICK_LABEL_MAX, QUICK_TEXT_MAX, QUICK_PROMPTS_API_PATH, QUICK_BOOK_VERSION, DEFAULT_CATEGORY_NAME, OPTIMIZE_STATE_API_PATH, OPTIMIZER_API_PATH, SLASH_COMMAND_RE, INSERT_MODES, OPTIMIZER_TIERS, DEFAULT_OPTIMIZER_TIER, LEGACY_OPTIMIZER_TIERS, OPTIMIZER_PROMPT_FIELDS, LEGACY_OPTIMIZER_PROMPT_FIELDS, OPTIMIZER_PROMPT_FIELD_LIST, OPTIMIZER_PROMPT_MAX, DEFAULT_QUICK_PROMPTS, DEFAULT_SETTINGS, SEND_PRESETS, NEWLINE_PRESETS, SECTION_SIGNALS, AUTOSTART_API_PATH, DOCTOR_API_PATH;
var init_settings_contract = __esm({
  "src/settings-contract.ts"() {
    init_pricing();
    init_contracts();
    NAMESPACE = "composer-ux";
    REPO_URL = "https://github.com/fangwen9527/dsh-composer-ux";
    SITE_URL = "https://www.deepseek.com/harness/";
    RESTART_API_PATH = "/composer-ux/restart";
    USAGE_API_PATH = "/composer-ux/usage";
    QUOTA_API_PATH = "/composer-ux/quota";
    NAV_FOLD_API_PATH = "/composer-ux/nav-fold";
    MODELS_API_PATH = "/composer-ux/models";
    RESTART_CSRF_HEADER = "x-composer-ux-restart";
    RESTART_CSRF_VALUE = "1";
    SYNC_API_PATH = "/composer-ux/sync-prices";
    ENABLED_FIELD = "enabled";
    KEYS_ENABLED_FIELD = "keysEnabled";
    QUICK_ENABLED_FIELD = "quickEnabled";
    PANEL_ENABLED_FIELD = "panelEnabled";
    TERMINAL_ENABLED_FIELD = "terminalEnabled";
    STATS_ENABLED_FIELD = "statsEnabled";
    PRICE_OVERRIDES_FIELD = "priceOverrides";
    PEAK_HOLIDAYS_FIELD = "peakHolidays";
    HOLIDAY_SOURCE_LABEL = "holiday-cn\uFF08\u6570\u636E\u53D6\u81EA\u56FD\u52A1\u9662\u529E\u516C\u5385\u901A\u77E5\uFF09";
    PEAK_ALERT_FIELD = "peakAlert";
    PRICE_AUTO_SYNC_FIELD = "priceAutoSync";
    BALANCE_ENABLED_FIELD = "balanceEnabled";
    SYNCED_PRICES_FIELD = "syncedPrices";
    DEFAULT_PEAK_ALERT = {
      enabled: true,
      aheadMinutes: 5,
      onPeak: true,
      onOffPeak: true,
      webNotify: false
    };
    SEND_KEY_FIELD = "sendKey";
    NEWLINE_KEY_FIELD = "newlineKey";
    PANEL_RESIZE_FIELD = "panelResize";
    PANEL_WIDTH_FIELD = "panelWidth";
    PANEL_HEIGHT_FIELD = "panelHeight";
    QUICK_PROMPTS_FIELD = "quickPrompts";
    OPTIMIZER_TIER_FIELD = "optimizerTier";
    OPTIMIZER_CONTEXT_FIELD = "optimizerContext";
    OPTIMIZER_LEDGER_FIELD = "optimizerLedger";
    OPTIMIZE_KEEP_DOCK_FIELD = "optimizeKeepDock";
    OPTIMIZE_READ_TOOLS_FIELD = "optimizeReadTools";
    OPTIMIZER_FRAMING_FIELD = "optimizerFraming";
    OPTIMIZER_FRAMINGS = [
      { id: "neutral", label: "\u666E\u901A", hint: "\u7167\u5E38\u7684\u4E66\u9762\u8BED\u57DF\u3002" },
      { id: "hard", label: "\u786C\u90A6\u90A6", hint: "\u6574\u4EFD\u8F85\u52A9\u5305\u90FD\u7528\u53E3\u8BED\u3001\u76F4\u7ED9\u3001\u5E26\u52B2\u7684\u5199\u6CD5\uFF08\u53EA\u6539\u5199\u6CD5\uFF0C\u6761\u76EE\u4E0E\u4F9D\u636E\u89C4\u5219\u4E0D\u53D8\uFF09\u3002" }
    ];
    DEFAULT_OPTIMIZER_FRAMING = "neutral";
    OPTIMIZER_PERMISSION_FIELD = "optimizerPermission";
    OPTIMIZER_PERMISSIONS = [
      { id: "review", label: "\u5BA1\u67E5", hint: "\u6210\u54C1\u8FDB\u7ED3\u679C\u6846\uFF0C\u4F60\u770B\u8FC7\u518D\u70B9\u300C\u63D2\u5165\u8F93\u5165\u6846\u300D\u5199\u56DE\u3002" },
      { id: "auto", label: "\u81EA\u52A8", hint: "\u8DD1\u5B8C\u81EA\u52A8\u628A\u6210\u54C1\u5199\u56DE\u8F93\u5165\u6846\uFF08\u8986\u76D6\u5168\u6587\uFF0CCtrl+Z \u53EF\u8FD8\u539F\uFF09\uFF1B\u4E0D\u4F1A\u81EA\u52A8\u53D1\u9001\u3002" }
    ];
    DEFAULT_OPTIMIZER_PERMISSION = "review";
    OPTIMIZER_MODEL_FIELD = "optimizerModel";
    OPTIMIZER_MODEL_MAX = 120;
    OPTIMIZER_HISTORY_FIELD = "optimizerHistory";
    OPTIMIZER_TURNS_FIELD = "optimizerTurns";
    OPTIMIZER_TURNS_MIN = 0;
    OPTIMIZER_TURNS_MAX = 10;
    DEFAULT_OPTIMIZER_TURNS = 6;
    OPTIMIZE_BASH_FIELD = "optimizeBash";
    QUICK_PROMPT_MAX = 60;
    QUICK_CATEGORY_MAX = 20;
    QUICK_CATEGORY_NAME_MAX = 40;
    QUICK_LABEL_MAX = 40;
    QUICK_TEXT_MAX = 2e5;
    QUICK_PROMPTS_API_PATH = "/composer-ux/prompts";
    QUICK_BOOK_VERSION = 2;
    DEFAULT_CATEGORY_NAME = "\u9ED8\u8BA4";
    OPTIMIZE_STATE_API_PATH = "/composer-ux/optimize-state";
    OPTIMIZER_API_PATH = "/composer-ux/optimize";
    SLASH_COMMAND_RE = /^(\/[A-Za-z][\w-]*)(?:\s+([\s\S]+))?$/;
    INSERT_MODES = [
      { id: "never", label: "\u5173", hint: "\u70B9\u6761\u76EE\u53EA\u63D2\u5165\u8F93\u5165\u6846\uFF0C\u53D1\u9001\u65F6\u4E0D\u9644\u52A0" },
      { id: "always", label: "\u6BCF\u6B21", hint: "\u6BCF\u6B21\u53D1\u9001\u90FD\u628A\u8FD9\u6761\u9644\u52A0\u5230\u6D88\u606F\u672B\u5C3E" },
      { id: "first", label: "\u4EC5\u9996\u6B21", hint: "\u53EA\u5728\u5F53\u524D\u4F1A\u8BDD\u7684\u7B2C\u4E00\u6761\u6D88\u606F\u4E0A\u9644\u52A0" }
    ];
    OPTIMIZER_TIERS = [
      { id: "off", label: "\u5173\u95ED", hint: "\u5B8C\u5168\u4E0D\u4F18\u5316\uFF1A\u4E0D\u8C03\u7528\u6A21\u578B\u3001\u4E0D\u78B0\u4F60\u7684\u8F93\u5165\u6846\uFF08\u7B49\u4E8E\u6CA1\u88C5\u8FD9\u4E2A\u529F\u80FD\uFF09\u3002" },
      { id: "light", label: "\u8F7B\u5EA6", hint: "\u5355\u4E00\u89E3\u8BFB\uFF1A\u53EA\u628A\u300C\u4F60\u8FD9\u4E00\u8F6E\u5230\u5E95\u8981\u4EC0\u4E48\u300D\u7406\u6E05\u695A\uFF0C\u6700\u591A 4 \u6761\uFF0C\u4E0D\u4EA7\u51FA\u5E76\u5217\u5019\u9009\u3002" },
      { id: "standard", label: "\u6807\u51C6", hint: "\u6761\u76EE\u5185\u5E76\u5217\uFF1A\u8D28\u91CF\u8BCD\u843D\u5230\u53EF\u68C0\u7EF4\u5EA6\uFF08\u81F3\u5C11 1 \u6761\uFF09\uFF0C\u6700\u591A 8 \u6761\u3002" },
      { id: "heavy", label: "\u91CD\u5EA6", hint: "\u591A\u5047\u8BBE\u5206\u652F\uFF1A\u540C\u4E00\u53E5\u8BDD\u6709\u51E0\u79CD\u8BFB\u6CD5\u5C31\u5217\u5019\u9009\uFF08\u6700\u591A 3 \u4E2A\uFF09\uFF0C\u8D28\u91CF\u7EF4\u5EA6\u81F3\u5C11 2 \u6761\uFF0C\u6700\u591A 12 \u6761\uFF0C\u601D\u8003\u66F4\u6DF1\u3002" }
    ];
    DEFAULT_OPTIMIZER_TIER = "standard";
    LEGACY_OPTIMIZER_TIERS = Object.freeze({
      basic: "light",
      advanced: "standard",
      extreme: "heavy"
    });
    OPTIMIZER_PROMPT_FIELDS = {
      light: "optimizerPromptLight",
      standard: "optimizerPromptStandard",
      heavy: "optimizerPromptHeavy"
    };
    LEGACY_OPTIMIZER_PROMPT_FIELDS = {
      light: "optimizerPromptBasic",
      standard: "optimizerPromptAdvanced",
      heavy: "optimizerPromptExtreme"
    };
    OPTIMIZER_PROMPT_FIELD_LIST = OPTIMIZER_TIERS.filter((item) => item.id !== "off").map((item) => OPTIMIZER_PROMPT_FIELDS[item.id]);
    OPTIMIZER_PROMPT_MAX = 2e4;
    DEFAULT_QUICK_PROMPTS = [
      { id: "builtin-1", label: "\u4E00\u95EE\u4E00\u7B54", prompt: "\u4F60\u4E0D\u61C2\u7684\u5C31\u95EE\u6211\uFF0C\u4E00\u95EE\u4E00\u7B54\uFF1B\u540C\u65F6\u8BF4\u6E05\u695A\u4F60\u4E3A\u4EC0\u4E48\u8981\u95EE\u8BE5\u95EE\u9898\uFF1B\u76F4\u5230\u4F60\u5BF9\u6211\u7684\u76EE\u6807\u6709\u660E\u786E\u8BA4\u77E5\u540E\u518D\u5F00\u59CB\u5E72\u6D3B\u3002", always: false, firstOnly: false },
      { id: "builtin-2", label: "\u4EA4\u63A5\u6587\u6863", prompt: "\u628A\u8FD9\u6B21\u4EFB\u52A1\u3001\u5DF2\u5B8C\u6210\u5185\u5BB9\u3001\u5F53\u524D\u5361\u70B9\u3001\u4E0B\u4E00\u6B65\u8BA1\u5212\u3001\u8E29\u8FC7\u7684\u5751\uFF0C\u6574\u7406\u6210\u4E00\u4EFD\u4EA4\u63A5\u6587\u6863\uFF0C\u5199\u7ED9\u65B0\u4F1A\u8BDD\u770B\u3002", always: false, firstOnly: false },
      { id: "builtin-3", label: "\u4EC5\u8BF4\u660E\u539F\u56E0", prompt: "\u4EC5\u8BF4\u660E\u539F\u56E0\uFF0C\u4E0D\u8981\u505A\u5176\u4ED6\u52A8\u4F5C\u3002", always: false, firstOnly: false },
      { id: "builtin-4", label: "\u5206\u6790\u540E\u76F4\u63A5\u5E72", prompt: "\u5206\u6790\u539F\u56E0\uFF0C\u7136\u540E\u76F4\u63A5\u5F00\u59CB\u5E72\u6D3B\uFF0C\u4E0D\u9700\u8981\u8FC7\u95EE\u6211\u3002", always: false, firstOnly: false },
      { id: "builtin-5", label: "\u63D0\u4EA4\u4EE3\u7801", prompt: "\u8BF7\u5E2E\u6211\u63D0\u4EA4\u4EE3\u7801\uFF1A\u68C0\u67E5\u5F53\u524D git \u53D8\u66F4\uFF0C\u751F\u6210\u89C4\u8303\u7684 commit message \u5E76\u6267\u884C\u63D0\u4EA4\u3002", always: false, firstOnly: false },
      { id: "builtin-6", label: "\u7ED9\u65B9\u6848", prompt: "\u8BF7\u9488\u5BF9\u4E0A\u9762\u7684\u95EE\u9898\u7ED9\u51FA\u4E00\u4E2A\u5B8C\u6574\u65B9\u6848\uFF0C\u5305\u62EC\u601D\u8DEF\u3001\u6B65\u9AA4\u3001\u6CE8\u610F\u4E8B\u9879\u548C\u98CE\u9669\u3002", always: false, firstOnly: false },
      { id: "builtin-7", label: "\u89E3\u91CA\u4EE3\u7801", prompt: "\u8BF7\u89E3\u91CA\u8FD9\u6BB5\u4EE3\u7801\u7684\u4F5C\u7528\u548C\u5B9E\u73B0\u601D\u8DEF\u3002", always: false, firstOnly: false },
      { id: "builtin-8", label: "\u5199\u6D4B\u8BD5", prompt: "\u8BF7\u4E3A\u4E0B\u9762\u7684\u4EE3\u7801\u7F16\u5199\u5355\u5143\u6D4B\u8BD5\u3002", always: false, firstOnly: false },
      { id: "builtin-9", label: "\u4EE3\u7801\u5BA1\u67E5", prompt: "\u8BF7\u5BF9\u4E0B\u9762\u7684\u4EE3\u7801\u8FDB\u884C\u4EE3\u7801\u5BA1\u67E5\uFF0C\u6307\u51FA\u95EE\u9898\u5E76\u7ED9\u51FA\u6539\u8FDB\u5EFA\u8BAE\u3002", always: false, firstOnly: false }
    ];
    DEFAULT_SETTINGS = {
      // 总开关默认开：它只是总闸，真正"要不要用这一栏"由下面五个开关决定（默认关）。
      enabled: true,
      // 五栏默认关（老文档由 sectionEnabledOf 迁移成"碰过就开"）。
      keysEnabled: false,
      quickEnabled: false,
      panelEnabled: false,
      terminalEnabled: false,
      sendKey: "Enter",
      newlineKey: "Shift+Enter",
      panelResize: true,
      quickPrompts: DEFAULT_QUICK_PROMPTS,
      optimizerTier: DEFAULT_OPTIMIZER_TIER,
      optimizerContext: true,
      // 台账默认开：只写数字与原因，不写一个字原文，所以默认开不冒隐私风险。
      optimizerLedger: true,
      // 默认开：重启/刷新后上一轮结果还在框里（关掉就每次都要重跑一遍模型）。
      optimizeKeepDock: true,
      // 只读工具默认**关**：它会真的多花时间与 token（开了才走工具轮次）。
      optimizeReadTools: false,
      optimizerFraming: DEFAULT_OPTIMIZER_FRAMING,
      optimizerPermission: DEFAULT_OPTIMIZER_PERMISSION,
      optimizerModel: "",
      optimizerHistory: "turns",
      optimizerTurns: DEFAULT_OPTIMIZER_TURNS,
      optimizeBash: false,
      // 空串 = 用内置提示词。默认必须是空串：它同时就是「恢复内置」要写回去的值。
      optimizerPromptLight: "",
      optimizerPromptStandard: "",
      optimizerPromptHeavy: "",
      terminalMode: DEFAULT_TERMINAL_MODE,
      terminalBashPath: "",
      terminalCandidates: [],
      terminalStatus: "",
      terminalEffective: "",
      // 「统计行」（0.7.0）：默认开 —— 用户 2026-09-28 要的是"装完立刻看得到效果"，
      // 所以这一栏不参与下面那套"碰过才开"的迁移（见 STATS_ENABLED_FIELD 上方的说明）。
      statsEnabled: true,
      // 「金额」（0.9.1）：默认没有覆盖价 = 全部按内置刊例价估算（与 0.8.0 的行为一致）。
      priceOverrides: void 0,
      // 「金额」（0.10.0）：节假日表留空 = 用内置（国务院 2026 年安排那份）。
      peakHolidays: void 0,
      peakAlert: DEFAULT_PEAK_ALERT,
      // 余额默认开：它是"看一眼就知道还能不能跑"的东西；关掉是给不想出网的人留的开关。
      balanceEnabled: true,
      syncedPrices: void 0,
      // 自动同步默认**关**：用户没点过就不该有定时出网。
      priceAutoSync: false
    };
    SEND_PRESETS = ["Enter", "Ctrl+Enter", "Alt+Enter", "Shift+Enter"];
    NEWLINE_PRESETS = ["Shift+Enter", "Enter", "Ctrl+Enter", "Alt+Enter"];
    SECTION_SIGNALS = {
      [KEYS_ENABLED_FIELD]: (source) => touched(source, SEND_KEY_FIELD, DEFAULT_SETTINGS.sendKey) || touched(source, NEWLINE_KEY_FIELD, DEFAULT_SETTINGS.newlineKey),
      [QUICK_ENABLED_FIELD]: (source) => Array.isArray(source[QUICK_PROMPTS_FIELD]) && source[QUICK_PROMPTS_FIELD].length !== DEFAULT_QUICK_PROMPTS.length || touched(source, OPTIMIZER_TIER_FIELD, DEFAULT_OPTIMIZER_TIER),
      [PANEL_ENABLED_FIELD]: (source) => touched(source, PANEL_RESIZE_FIELD, true) || source[PANEL_WIDTH_FIELD] !== void 0 || source[PANEL_HEIGHT_FIELD] !== void 0,
      [TERMINAL_ENABLED_FIELD]: (source) => touched(source, TERMINAL_MODE_FIELD, DEFAULT_TERMINAL_MODE) || touched(source, TERMINAL_BASH_PATH_FIELD, "")
    };
    AUTOSTART_API_PATH = "/composer-ux/autostart";
    DOCTOR_API_PATH = "/composer-ux/doctor";
  }
});

// src/client/nav-fold-store.ts
var nav_fold_store_exports = {};
__export(nav_fold_store_exports, {
  DEFAULT_NAV_FOLD: () => DEFAULT_NAV_FOLD,
  NAV_FOLD_MODES: () => NAV_FOLD_MODES,
  loadNavFold: () => loadNavFold,
  navFoldSnapshot: () => navFoldSnapshot,
  sanitizeNavFold: () => sanitizeNavFold,
  saveNavFold: () => saveNavFold,
  subscribeNavFold: () => subscribeNavFold,
  useNavFold: () => useNavFold
});
function navFoldSnapshot() {
  return state2;
}
function subscribeNavFold(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function setLocal(next) {
  const merged = { ...state2, ...next };
  if (merged.mode === state2.mode && merged.collapsed === state2.collapsed) return;
  state2 = merged;
  for (const listener of listeners) listener();
}
function sanitizeNavFold(value) {
  const raw = value ?? {};
  const mode = raw.mode === "off" || raw.mode === "icons" || raw.mode === "bar" ? raw.mode : DEFAULT_NAV_FOLD.mode;
  return { mode, collapsed: typeof raw.collapsed === "boolean" ? raw.collapsed : DEFAULT_NAV_FOLD.collapsed };
}
async function loadNavFold() {
  try {
    const response = await fetch(NAV_FOLD_API_PATH, { headers: { accept: "application/json" } });
    if (!response.ok) return;
    const payload = await response.json();
    setLocal(sanitizeNavFold(payload));
  } catch {
  }
}
async function saveNavFold(patch) {
  setLocal(patch);
  try {
    const response = await fetch(NAV_FOLD_API_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch)
    });
    if (!response.ok) return `\u4FDD\u5B58\u6298\u53E0\u72B6\u6001\u5931\u8D25\uFF1A\u5BBF\u4E3B\u8FD4\u56DE HTTP ${response.status}`;
    const payload = await response.json();
    if (payload.ok === true) return "";
    return `\u4FDD\u5B58\u6298\u53E0\u72B6\u6001\u5931\u8D25\uFF1A${payload.error === void 0 || payload.error === "" ? "\u5BBF\u4E3B\u62D2\u7EDD" : payload.error}`;
  } catch (error) {
    return `\u4FDD\u5B58\u6298\u53E0\u72B6\u6001\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`;
  }
}
function useNavFold() {
  const [snapshot, setSnapshot] = (0, import_react2.useState)(state2);
  (0, import_react2.useEffect)(() => subscribeNavFold(() => {
    setSnapshot(state2);
  }), []);
  return snapshot;
}
var import_react2, NAV_FOLD_MODES, DEFAULT_NAV_FOLD, state2, listeners;
var init_nav_fold_store = __esm({
  "src/client/nav-fold-store.ts"() {
    import_react2 = require("react");
    init_settings_contract();
    NAV_FOLD_MODES = [
      { id: "off", label: "\u4E0D\u6298\u53E0" },
      { id: "bar", label: "\u6536\u6210\u4E00\u6761" },
      { id: "icons", label: "\u53EA\u7559\u56FE\u6807" }
    ];
    DEFAULT_NAV_FOLD = { mode: "bar", collapsed: true };
    state2 = DEFAULT_NAV_FOLD;
    listeners = /* @__PURE__ */ new Set();
  }
});

// src/client.tsx
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(client_exports);
var import_dsh_client_store = require("@deepseek-ai/dsh-client-store");
init_settings_contract();
init_contracts();

// src/client/prompt-book.ts
init_settings_contract();
async function requestBook(method, body) {
  try {
    const response = await fetch(QUICK_PROMPTS_API_PATH, {
      method,
      headers: body === void 0 ? void 0 : { "content-type": "application/json" },
      body: body === void 0 ? void 0 : JSON.stringify(body)
    });
    const text = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, error: `\u670D\u52A1\u7AEF\u8FD4\u56DE\u7684\u4E0D\u662F JSON\uFF08HTTP ${String(response.status)}\uFF09` };
    }
    const row2 = typeof parsed === "object" && parsed !== null ? parsed : {};
    const book = sanitizeBook(row2.book);
    const textOf3 = (value) => typeof value === "string" && value !== "" ? value : void 0;
    return {
      ok: row2.ok === true,
      ...book === void 0 ? {} : { book },
      ...textOf3(row2.error) === void 0 ? {} : { error: textOf3(row2.error) },
      ...textOf3(row2.file) === void 0 ? {} : { file: textOf3(row2.file) },
      ...textOf3(row2.quarantined) === void 0 ? {} : { quarantined: textOf3(row2.quarantined) }
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
function loadPromptBook() {
  return requestBook("GET");
}
function savePromptBook(book) {
  return requestBook("POST", { book });
}
function categoryOf(book, categoryId) {
  return book.categories.find((category) => category.id === categoryId);
}
function findPrompt(book, promptId) {
  for (const category of book.categories) {
    const prompt = category.prompts.find((item) => item.id === promptId);
    if (prompt !== void 0) return { category, prompt };
  }
  return void 0;
}
function bookCounts(book) {
  const prompts = book.categories.flatMap((category) => category.prompts);
  return {
    categories: book.categories.length,
    prompts: prompts.length,
    always: prompts.filter((prompt) => insertModeOf(prompt) === "always").length,
    first: prompts.filter((prompt) => insertModeOf(prompt) === "first").length
  };
}
function mapCategory(book, categoryId, edit) {
  return {
    version: book.version,
    categories: book.categories.map((category) => category.id === categoryId ? edit(category) : category)
  };
}
function withCategoryAdded(book, name2) {
  if (book.categories.length >= QUICK_CATEGORY_MAX) return book;
  const clean = name2.trim().slice(0, QUICK_CATEGORY_NAME_MAX);
  return {
    version: book.version,
    categories: [...book.categories, { id: newQuickCategoryId(), name: clean === "" ? DEFAULT_CATEGORY_NAME : clean, prompts: [] }]
  };
}
function withCategoryRenamed(book, categoryId, name2) {
  const clean = name2.trim().slice(0, QUICK_CATEGORY_NAME_MAX);
  return mapCategory(book, categoryId, (category) => ({ ...category, name: clean === "" ? DEFAULT_CATEGORY_NAME : clean }));
}
function withCategoryRemoved(book, categoryId) {
  return { version: book.version, categories: book.categories.filter((category) => category.id !== categoryId) };
}
function withCategoryMoved(book, categoryId, delta) {
  const index = book.categories.findIndex((category) => category.id === categoryId);
  const next = index + delta;
  if (index < 0 || next < 0 || next >= book.categories.length) return book;
  const categories = [...book.categories];
  const [moved] = categories.splice(index, 1);
  categories.splice(next, 0, moved);
  return { version: book.version, categories };
}
function withPromptAdded(book, categoryId) {
  return mapCategory(book, categoryId, (category) => {
    if (category.prompts.length >= QUICK_PROMPT_MAX) return category;
    return {
      ...category,
      prompts: [...category.prompts, {
        id: newQuickPromptId(),
        label: "\u65B0\u6307\u4EE4",
        prompt: "\uFF08\u5F85\u586B\u5199\uFF09",
        always: false,
        firstOnly: false
      }]
    };
  });
}
function withPromptPatched(book, categoryId, promptId, patch) {
  return mapCategory(book, categoryId, (category) => ({
    ...category,
    prompts: category.prompts.map((prompt) => {
      if (prompt.id !== promptId) return prompt;
      const label = patch.label === void 0 ? prompt.label : patch.label.slice(0, QUICK_LABEL_MAX);
      const text = patch.prompt === void 0 ? prompt.prompt : patch.prompt.slice(0, QUICK_TEXT_MAX);
      const always = patch.always === void 0 ? prompt.always : patch.always;
      const firstOnly = patch.firstOnly === void 0 ? prompt.firstOnly : patch.firstOnly;
      return { id: prompt.id, label, prompt: text, always, firstOnly };
    })
  }));
}
function withInsertMode(book, promptId, mode) {
  const hit = findPrompt(book, promptId);
  if (hit === void 0) return book;
  if (insertModeOf(hit.prompt) === mode) return book;
  return withPromptPatched(book, hit.category.id, promptId, {
    always: mode === "always",
    firstOnly: mode === "first"
  });
}
function withPromptRemoved(book, categoryId, promptId) {
  return mapCategory(book, categoryId, (category) => ({
    ...category,
    prompts: category.prompts.filter((prompt) => prompt.id !== promptId)
  }));
}
function withPromptMoved(book, categoryId, promptId, delta) {
  const category = categoryOf(book, categoryId);
  if (category === void 0) return book;
  const index = category.prompts.findIndex((prompt) => prompt.id === promptId);
  const next = index + delta;
  if (index < 0 || next < 0 || next >= category.prompts.length) return book;
  const prompts = [...category.prompts];
  const [moved] = prompts.splice(index, 1);
  prompts.splice(next, 0, moved);
  return mapCategory(book, categoryId, (target) => ({ ...target, prompts }));
}
function promptsElsewhere(book, categoryId) {
  return book.categories.filter((category) => category.id !== categoryId).flatMap((category) => category.prompts.map((prompt) => ({
    categoryId: category.id,
    categoryName: category.name,
    prompt
  })));
}
function withPromptMovedToCategory(book, promptId, toCategoryId) {
  const hit = findPrompt(book, promptId);
  if (hit === void 0 || hit.category.id === toCategoryId) return book;
  const target = categoryOf(book, toCategoryId);
  if (target === void 0 || target.prompts.length >= QUICK_PROMPT_MAX) return book;
  return {
    version: book.version,
    categories: book.categories.map((category) => {
      if (category.id === hit.category.id) {
        return { ...category, prompts: category.prompts.filter((prompt) => prompt.id !== promptId) };
      }
      if (category.id === toCategoryId) {
        return { ...category, prompts: [...category.prompts, hit.prompt] };
      }
      return category;
    })
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
init_settings_contract();
var COMPOSER_SELECTOR = "[data-composer-input]";
var CARD_SELECTOR = "[data-composer-card]";
var state = { actions: null, draft: "", sessionId: "", blank: false };
function publishInputBridge(next) {
  state.actions = next.actions;
  state.draft = next.draft;
  state.sessionId = next.sessionId;
  state.blank = next.blank;
}
function releaseInputBridge(sessionId) {
  if (state.sessionId !== sessionId) return;
  state.actions = null;
  state.draft = "";
  state.sessionId = "";
  state.blank = false;
}
function currentBlankSession() {
  return state.blank === true;
}
function draftFromDom() {
  const el = document.querySelector(COMPOSER_SELECTOR);
  if (!(el instanceof HTMLElement)) return "";
  return el.innerText.replace(/\n+$/, "");
}
function currentDraft() {
  return state.actions === null ? draftFromDom() : state.draft;
}
function currentSessionId() {
  return state.sessionId;
}
function withPromptsAppended(draft, prompts) {
  const picked = prompts.filter((item) => item.prompt.trim() !== "");
  if (picked.length === 0) return null;
  const base2 = draft.replace(/\s+$/, "");
  if (base2 === "") return null;
  const suffix = picked.map((item) => item.prompt.trim()).join("\n\n");
  if (base2.endsWith(suffix)) return null;
  return `${base2}

${suffix}`;
}
function applyPromptsForSend(prompts) {
  const actions = state.actions;
  if (actions === null) return false;
  const next = withPromptsAppended(currentDraft(), prompts);
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
function elapsedSeconds(startedAt, now) {
  const ms = now - startedAt;
  if (!Number.isFinite(ms) || startedAt <= 0 || ms <= 0) return 0;
  return Math.floor(ms / 1e3);
}
function elapsedText(startedAt, now) {
  const ms = now - startedAt;
  if (!Number.isFinite(ms) || startedAt <= 0 || ms < 0) return "\u2014";
  return (ms / 1e3).toFixed(1);
}
function sameDraft(before, after) {
  return before.trim() === after.trim();
}
function composeOptimizedDraft(prefix, optimized) {
  return prefix === "" ? optimized : `${prefix} ${optimized}`;
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
function droppedOf(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const row2 = entry;
    out.push({
      id: typeof row2.id === "string" ? row2.id : "",
      kind: typeof row2.kind === "string" ? row2.kind : "",
      reason: typeof row2.reason === "string" ? row2.reason : ""
    });
  }
  return out;
}
function warningsOf(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => typeof entry === "string");
}
function itemViewOf(value) {
  if (typeof value !== "object" || value === null) return void 0;
  const row2 = value;
  const text = typeof row2.text === "string" ? row2.text : "";
  if (text === "") return void 0;
  return {
    index: typeof row2.index === "number" ? row2.index : 0,
    id: typeof row2.id === "string" ? row2.id : "",
    kind: typeof row2.kind === "string" ? row2.kind : "",
    text,
    quote: typeof row2.quote === "string" ? row2.quote : "",
    quoteSource: typeof row2.quoteSource === "string" ? row2.quoteSource : ""
  };
}
function outcomeOf(payload) {
  const record = typeof payload === "object" && payload !== null ? payload : {};
  const retried = record.retried === true;
  if (record.ok !== true) {
    const message = typeof record.error === "string" && record.error !== "" ? record.error : "\u4F18\u5316\u5931\u8D25";
    return { ok: false, error: message, retried };
  }
  const optimized = typeof record.text === "string" ? record.text.trim() : "";
  if (optimized === "") return { ok: false, error: "\u6A21\u578B\u6CA1\u6709\u4EA7\u51FA\u4EFB\u4F55\u5185\u5BB9", retried };
  return {
    ok: true,
    text: optimized,
    route: `${String(record.provider ?? "")}/${String(record.model ?? "")}`,
    itemCount: typeof record.itemCount === "number" ? record.itemCount : 0,
    dropped: droppedOf(record.dropped),
    warnings: warningsOf(record.warnings),
    fallback: record.fallback === true,
    retried,
    promptSource: typeof record.promptSource === "string" ? record.promptSource : "",
    rewrittenChars: typeof record.rewrittenChars === "number" ? record.rewrittenChars : 0,
    truncated: record.truncated === true
  };
}
function parseSseChunk(buffer) {
  const events = [];
  const text = buffer.replace(/\r\n/g, "\n");
  const parts = text.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const frame of parts) {
    for (const rawLine of frame.split("\n")) {
      const line = rawLine.replace(/\r$/, "");
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "") continue;
      try {
        const value = JSON.parse(payload);
        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
          events.push(value);
        }
      } catch {
      }
    }
  }
  return { events, rest };
}
async function optimizeDraftStream(text, tier, handlers = {}, signal) {
  const body = text.trim();
  if (body === "") return { ok: false, error: "\u8F93\u5165\u6846\u662F\u7A7A\u7684\uFF0C\u5148\u5199\u70B9\u4EC0\u4E48\u518D\u4F18\u5316" };
  let response;
  try {
    response = await fetch(OPTIMIZER_API_PATH, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      // sessionId: the host uses it to read conversation context (0.12.0);
      // unavailable session just means "no context", never a failed round.
      body: JSON.stringify({
        text: body,
        tier,
        sessionId: currentSessionId()
      }),
      ...signal === void 0 ? {} : { signal }
    });
  } catch (error) {
    if (signal?.aborted === true) return { ok: false, error: "\u5DF2\u53D6\u6D88" };
    return { ok: false, error: `\u8FDE\u4E0D\u4E0A\u5BBF\u4E3B\u534A\u7684\u4F18\u5316\u63A5\u53E3\uFF1A${error instanceof Error ? error.message : String(error)}` };
  }
  if (!response.ok) {
    let detail2 = "";
    try {
      const payload = await response.json();
      const row2 = typeof payload === "object" && payload !== null ? payload : {};
      if (typeof row2.error === "string") detail2 = row2.error;
    } catch {
    }
    return { ok: false, error: detail2 === "" ? `\u5BBF\u4E3B\u534A\u8FD4\u56DE HTTP ${response.status}\uFF08\u63D2\u4EF6\u53EF\u80FD\u8FD8\u6CA1\u91CD\u542F\u751F\u6548\uFF09` : detail2 };
  }
  const reader = response.body?.getReader();
  if (reader === void 0) return { ok: false, error: "\u5BBF\u4E3B\u534A\u6CA1\u6709\u8FD4\u56DE\u53EF\u8BFB\u7684\u4E8B\u4EF6\u6D41" };
  const decoder = new TextDecoder();
  let buffer = "";
  let outcome;
  try {
    for (; ; ) {
      const { value, done } = await reader.read();
      if (done === true) break;
      buffer += decoder.decode(value, { stream: true });
      const parsed = parseSseChunk(buffer);
      buffer = parsed.rest;
      for (const event of parsed.events) {
        const type = String(event.type ?? "");
        if (type === "item") {
          const item = itemViewOf(event);
          if (item !== void 0) handlers.onItem?.(item);
          continue;
        }
        if (type === "dropped") {
          const [row2] = droppedOf([event]);
          if (row2 !== void 0) handlers.onDropped?.(row2);
          continue;
        }
        if (type === "done") {
          outcome = outcomeOf(event);
          continue;
        }
      }
    }
  } catch (error) {
    if (signal?.aborted === true) return outcome ?? { ok: false, error: "\u5DF2\u53D6\u6D88" };
    return outcome ?? { ok: false, error: `\u4E8B\u4EF6\u6D41\u4E2D\u65AD\uFF1A${error instanceof Error ? error.message : String(error)}` };
  }
  if (outcome !== void 0) return outcome;
  return { ok: false, error: "\u4E8B\u4EF6\u6D41\u7ED3\u675F\u4E86\uFF0C\u4F46\u5BBF\u4E3B\u6CA1\u6709\u7ED9\u51FA\u7ED3\u8BBA\uFF08done \u4E8B\u4EF6\u7F3A\uFF09" };
}

// src/client/interceptors.ts
init_settings_contract();
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
    if (!activeSections(deps.settings()).keys) return;
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
      applyPromptsForSend(deps.promptsForSend());
      dispatchKey(root, chordToInit("Enter"));
    } else if (gesture === "newline") {
      dispatchKey(root, chordToInit("Shift+Enter"));
    } else if (gesture === "accelerated") {
      dispatchKey(root, chordToInit("Ctrl+Enter"));
    }
  };
  const onClickSend = (event) => {
    if (replayingSendClick) return;
    const button = sendButtonOf(event.target);
    if (button === null) return;
    if (!applyPromptsForSend(deps.promptsForSend())) return;
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
  window.addEventListener("click", onClickSend, true);
  return () => {
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("click", onClickSend, true);
  };
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
function installPanelResizeStyle() {
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-composer-ux-panel";
  tag.textContent = RESIZE_CSS;
  document.head.appendChild(tag);
  return () => {
    tag.remove();
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
/* \u2500\u2500 \u8BBE\u7F6E\u9875\u6839 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
/* \u6570\u5B57\u4E00\u5F8B\u7B49\u5BBD\uFF1A\u5C3A\u5BF8 / \u5355\u4EF7 / \u5929\u6570\u90FD\u5728\u5361\u7247\u91CC\uFF0C\u8DF3\u52A8\u65F6\u4E0D\u80FD\u8BA9\u5C0F\u6570\u70B9\u6765\u56DE\u632A\u3002 */
.dsh-ux-settings { font-variant-numeric: tabular-nums; }

/* \u2500\u2500 \u5361\u7247\u5916\u58F3 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dsh-ux-card {
  border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-3);
  border-radius: 12px;
  margin-bottom: 12px;
  transition: border-color .16s, background-color .16s;
}
.dsh-ux-card:hover { border-color: var(--dsw-alias-label-dimmed); }
/* \u5C55\u5F00\u65F6\u53EA\u52A0\u6DF1\u63CF\u8FB9\u3001**\u4E0D\u6362\u5E95\u8272**\uFF1A\u5361\u91CC\u7684\u5206\u6BB5\u63A7\u4EF6\u9009\u4E2D\u9879\u753B\u5728 layer-2 \u4E0A\uFF0C
   \u5361\u7247\u672C\u8EAB\u4E5F\u6389\u5230 layer-2 \u7684\u8BDD\uFF0C\u9009\u4E2D\u9879\u5C31\u6CA1\u5E95\u4E86\uFF08\u6362\u76AE\u6700\u5BB9\u6613\u6F0F\u7684\u4E00\u5904\uFF09\u3002 */
.dsh-ux-cardOpen { border-color: var(--dsw-alias-label-dimmed); }
/* \u672A\u542F\u7528\uFF1A\u63CF\u8FB9\u6539\u865A\u7EBF\uFF0C\u4E00\u773C\u770B\u51FA"\u8FD9\u4E00\u680F\u73B0\u5728\u4E0D\u751F\u6548"\u3002 */
.dsh-ux-cardOff { border-style: dashed; }
.dsh-ux-cardOff .dsh-ux-cardBody { opacity: .62; }
/* \u9876\u90E8\u8FD9\u5F20\u5361\u5728 DOM \u4E0A\u8FD8\u5305\u7740\u300C\u5FAE\u4FE1\u901A\u77E5 / \u76EE\u5F55\u9009\u62E9 / \u81EA\u68C0 / \u81EA\u542F\u52A8\u300D\u4E0E\u603B\u5F00\u5173\u90A3\u4E00\u884C
   \uFF08\u90A3\u51E0\u5757\u7684\u5148\u540E\u987A\u5E8F\u88AB test/client-registration.mjs \u9489\u7740\uFF0C\u8FD9\u4E00\u8F6E\u4E0D\u52A8\u7ED3\u6784\uFF09\u3002
   \u6240\u4EE5\u5B83\u81EA\u5DF1**\u4E0D\u753B\u5361\u7247**\uFF1A\u753B\u4E86\u5C31\u662F"\u5361\u7247\u5957\u5361\u7247"\uFF0C\u5185\u5916\u4E24\u5C42\u63CF\u8FB9\u4F1A\u8D34\u5728\u4E00\u8D77\u53D8\u6210\u53CC\u7EBF\u3002
   \u5B83\u9000\u5316\u6210\u4E00\u5757\u9875\u5934 \u2014\u2014 \u6807\u9898 + \u4E00\u884C\u63CF\u8FF0 + \u5237\u65B0/\u91CD\u542F/\u94FE\u63A5\uFF0C\u4E0E\u53C2\u8003\u4ED3\u5E93\u7684\u8BBE\u7F6E\u9875\u4E00\u81F4\u3002 */
.dsh-ux-cardTop {
  background: transparent;
  border: 0;
  margin-bottom: 0;
}
.dsh-ux-cardTop:hover { border-color: transparent; }
.dsh-ux-cardTop .dsh-ux-cardHeaderStatic { padding: 2px 0 14px; }
.dsh-ux-cardTop > .dsh-ux-restartBanner { margin: 0 0 12px; }
/* \u603B\u5F00\u5173\u90A3\u4E00\u884C\u662F\u9875\u5934\u7684\u5C3E\u5DF4\uFF08DOM \u4E0A\u5B83\u6392\u5728\u90A3\u51E0\u5F20\u5361\u4E4B\u540E\uFF09\uFF0C\u5355\u72EC\u8BFB\u6210\u4E00\u5F20\u5C0F\u5361\uFF0C
   \u5426\u5219\u5B83\u4F1A\u5939\u5728\u4E24\u5F20\u5361\u4E2D\u95F4\u3001\u53EA\u6709\u4E00\u6761\u5B64\u96F6\u96F6\u7684\u6A2A\u7EBF\u3002 */
.dsh-ux-cardTop > .dsh-ux-cardBody {
  background: var(--dsw-alias-bg-layer-3);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  margin: 0 0 12px;
  padding: 0 16px;
}
/* \u9876\u90E8\u90A3\u5F20\u680F\u76EE\u5934\u5361\uFF1A\u5B83\u4E0D\u662F\u6298\u53E0\u5361\uFF0C\u6807\u9898\u6BD4\u5176\u4ED6 11 \u5F20\u9AD8\u4E00\u53F7\u3002 */
.dsh-ux-cardTop .dsh-ux-cardName { font-size: 15px; }

/* \u2500\u2500 \u6807\u9898\u884C \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
/* \u6807\u9898\u884C = \u5DE6\u8FB9"\u5C55\u5F00"\u6309\u94AE\uFF08\u5360\u6EE1\u5269\u4F59\u5BBD\u5EA6\uFF09+ \u53F3\u8FB9\u4ECE\u5C5E\u63A7\u4EF6\u4E0E\u672C\u680F\u5F00\u5173\u3002
   \u4E0D\u80FD\u5728 <button> \u91CC\u585E\u6309\u94AE\uFF0C\u6240\u4EE5\u4E24\u8005\u662F\u5144\u5F1F\u8282\u70B9\u3002 */
.dsh-ux-cardHeaderRow {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding-right: 12px;
}
.dsh-ux-cardHeader {
  appearance: none;
  box-sizing: border-box;
  flex: 1;
  min-width: 0;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  background: 0 0;
  border: 0;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
}
.dsh-ux-cardHeader:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: -2px;
}
.dsh-ux-cardHeaderStatic {
  box-sizing: border-box;
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 12px;
  padding: 14px 16px;
}
.dsh-ux-cardHeadText {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 3px;
  min-width: 0;
}
.dsh-ux-cardTitleRow {
  align-items: center;
  display: flex;
  gap: 6px;
  min-width: 0;
}
.dsh-ux-cardName {
  color: var(--dsw-alias-label-primary);
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.35;
  margin: 0;
}
.dsh-ux-cardDescription {
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 1.5;
  margin: 0;
}
.dsh-ux-cardControls {
  align-items: center;
  display: inline-flex;
  flex: none;
  flex-wrap: wrap;
  gap: 8px;
}
/* \u6807\u9898\u884C\u91CC\u7684"\u6587\u5B57 + \u5C0F\u5F00\u5173"\uFF08\u8FB9\u7F18\u7F29\u653E\u8FD9\u7C7B\uFF09\u3002 */
.dsh-ux-miniToggle {
  align-items: center;
  color: var(--dsw-alias-label-secondary);
  display: inline-flex;
  flex: none;
  font-size: 11px;
  gap: 5px;
  white-space: nowrap;
}
.dsh-ux-cardChevron {
  color: var(--dsw-alias-label-tertiary);
  flex: none;
  transition: transform .16s;
}
.dsh-ux-cardChevronOpen { transform: rotate(180deg); }

/* \u2500\u2500 \u5361\u5185\u6B63\u6587 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dsh-ux-cardBody {
  border-top: 1px solid var(--dsw-alias-border-l2);
  margin: 0 16px;
  padding: 2px 0 14px;
}
/* \u5BFC\u8BED\uFF1A\u5361\u7247\u5F00\u5934\u90A3\u6BB5"\u8FD9\u4E00\u680F\u5E72\u4EC0\u4E48"\u7684\u957F\u8BF4\u660E\uFF08\u7A84\u9762\u677F\u91CC\u8981\u8BFB\u5F97\u4E0B\u53BB\uFF09\u3002 */
.dsh-ux-lead {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 1.7;
  margin: 12px 0;
}
.dsh-ux-lead strong { color: var(--dsw-alias-label-primary); font-weight: 600; }

/* \u2500\u2500 \u8BBE\u7F6E\u884C \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dsh-ux-row {
  align-items: center;
  border-top: 1px solid var(--dsw-alias-border-l2);
  display: flex;
  gap: 12px;
  padding: 10px 0;
}
.dsh-ux-rowFirst { border-top: none; }
.dsh-ux-rowStacked { align-items: stretch; flex-direction: column; gap: 8px; }
.dsh-ux-rowText { flex: 1; min-width: 0; }
.dsh-ux-rowTitle {
  align-items: center;
  color: var(--dsw-alias-label-primary);
  display: flex;
  font-size: 12.5px;
  gap: 6px;
  line-height: 1.45;
}
.dsh-ux-rowDesc {
  color: var(--dsw-alias-label-tertiary);
  font-size: 11.5px;
  line-height: 1.55;
  margin-top: 2px;
}
.dsh-ux-rowControl {
  align-items: center;
  display: inline-flex;
  flex: none;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}
.dsh-ux-rowStacked .dsh-ux-rowControl { justify-content: flex-start; }

/* \u2500\u2500 \u5206\u6BB5\u63A7\u4EF6 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dsh-ux-segmented {
  align-items: center;
  background: transparent;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  display: inline-flex;
  flex: none;
  gap: 2px;
  padding: 2px;
}
.dsh-ux-segment {
  appearance: none;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--dsw-alias-label-tertiary);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  line-height: 1;
  padding: 5px 10px;
  transition: background-color .14s, border-color .14s, color .14s;
  white-space: nowrap;
}
.dsh-ux-segment:hover { color: var(--dsw-alias-label-primary); }
.dsh-ux-segmentOn {
  background: var(--dsw-alias-bg-layer-2);
  border-color: var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-primary);
  font-weight: 600;
}
.dsh-ux-segmentedCompact .dsh-ux-segment { font-size: 11px; padding: 4px 8px; }

/* \u6807\u9898\u884C/\u5361\u5185\u7684 PillChoice\uFF08role=group\uFF09\uFF1A\u5B83\u662F\u4E2A\u72EC\u7ACB\u7EC4\u4EF6\u3001\u5185\u8054\u6837\u5F0F\u5199\u5728\u90A3\u8FB9\uFF0C
   \u8FD9\u4E00\u8F6E\u4E0D\u80FD\u6539\u90A3\u4E2A\u6587\u4EF6\uFF0C\u800C\u6807\u9898\u884C\u8981\u7684\u662F"\u4E00\u4E2A\u63A7\u4EF6\u5206\u6210\u51E0\u6BB5"\u7684\u89C2\u611F\uFF0C\u6240\u4EE5\u53EA\u5728
   \u672C\u63D2\u4EF6\u7684\u5BB9\u5668\u91CC\u3001\u5BF9\u5B83\u90A3\u51E0\u4E2A\u5185\u8054\u5C5E\u6027\u7528 !important \u76D6\u4F4F\uFF08\u5185\u8054\u6837\u5F0F\u662F\u666E\u901A\u4F18\u5148\u7EA7\uFF09\u3002
   :not(.dsh-ux-segmented) \u662F\u4E3A\u4E86\u4E0D\u91CD\u590D\u547D\u4E2D\u672C\u6587\u4EF6\u81EA\u5DF1\u7684\u5206\u6BB5\u63A7\u4EF6\u3002 */
.dsh-ux-cardControls > [role='group']:not(.dsh-ux-segmented),
.dsh-ux-cardBody [role='group']:not(.dsh-ux-segmented) {
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  padding: 2px;
}
.dsh-ux-cardControls > [role='group']:not(.dsh-ux-segmented) > button,
.dsh-ux-cardBody [role='group']:not(.dsh-ux-segmented) > button {
  background: transparent !important;
  border: 1px solid transparent !important;
  border-radius: 6px !important;
  color: var(--dsw-alias-label-tertiary) !important;
  font-size: 11px !important;
  line-height: 1 !important;
  padding: 4px 8px !important;
  transition: background-color .14s, border-color .14s, color .14s;
}
.dsh-ux-cardControls > [role='group']:not(.dsh-ux-segmented) > button:hover,
.dsh-ux-cardBody [role='group']:not(.dsh-ux-segmented) > button:hover {
  color: var(--dsw-alias-label-primary) !important;
}
.dsh-ux-cardControls > [role='group']:not(.dsh-ux-segmented) > button[aria-pressed='true'],
.dsh-ux-cardBody [role='group']:not(.dsh-ux-segmented) > button[aria-pressed='true'] {
  background: var(--dsw-alias-bg-layer-2) !important;
  border-color: var(--dsw-alias-border-l2) !important;
  color: var(--dsw-alias-label-primary) !important;
  font-weight: 600;
}

/* \u2500\u2500 ? \u60AC\u505C\u8BF4\u660E \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
/* \u5FBD\u6807\u53EA\u5360 14px\uFF1A\u8BF4\u660E\u6587\u5B57\u653E\u8FDB\u6D6E\u5C42\uFF0C\u5361\u9762\u624D\u6536\u5F97\u56DE"\u4E00\u53E5\u6982\u89C8"\u7684\u5BC6\u5EA6\u3002 */
.dsh-ux-hint {
  align-items: center;
  appearance: none;
  background: transparent;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 50%;
  color: var(--dsw-alias-label-tertiary);
  cursor: help;
  display: inline-flex;
  flex: none;
  font: inherit;
  font-size: 10px;
  height: 14px;
  justify-content: center;
  line-height: 1;
  padding: 0;
  transition: border-color .14s, color .14s;
  width: 14px;
}
.dsh-ux-hint:hover,
.dsh-ux-hintOpen {
  border-color: var(--dsw-alias-label-dimmed);
  color: var(--dsw-alias-label-primary);
}
/* \u6D6E\u5C42\uFF1A\u5B98\u65B9\u83DC\u5355\u9762 + \u6BDB\u73BB\u7483\uFF08\u53EA\u6284\u534A\u900F\u660E\u4F1A\u51FA\u73B0"\u4E00\u5757\u6CA1\u78E8\u7802\u7684\u73BB\u7483"\uFF0C0.1.7 \u8E29\u8FC7\uFF09\u3002
   \u56FA\u5B9A\u5B9A\u4F4D + \u7531 JS \u5939\u8FDB\u89C6\u53E3\uFF0C\u89C1 ui-kit.tsx \u7684 Hint\u3002 */
.dsh-ux-hintBubble {
  background: var(--dsw-specific-menu);
  backdrop-filter: var(--dsw-menu-backdrop-filter);
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  box-shadow: var(--dsw-elevation-prominent);
  box-sizing: border-box;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 1.6;
  padding: 8px 10px;
  pointer-events: none;
  position: fixed;
  white-space: pre-wrap;
  z-index: 1200;
}

/* \u2500\u2500 \u5361\u5185\u5C0F\u6807\u9898 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dsh-ux-groupLabel {
  align-items: center;
  color: var(--dsw-alias-label-tertiary);
  display: flex;
  font-size: 11.5px;
  font-weight: 600;
  gap: 6px;
  letter-spacing: .04em;
  margin: 14px 0 2px;
}

/* \u2500\u2500 \u62AC\u5934\uFF1A\u52A8\u4F5C\u6309\u94AE\u4E0E\u94FE\u63A5 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */
.dsh-ux-cardLink {
  align-items: center;
  color: var(--dsw-alias-label-secondary);
  display: inline-flex;
  flex: none;
  font-size: 12px;
  gap: 4px;
  text-decoration: none;
  white-space: nowrap;
}
.dsh-ux-cardLink:hover {
  color: var(--dsw-alias-brand-primary);
  text-decoration: underline;
}
/* \u62AC\u5934\u53F3\u7AEF\u90A3\u4E00\u7EC4\uFF1A\u5237\u65B0 + \u91CD\u542F + \u4E24\u4E2A\u94FE\u63A5\uFF0C\u56DB\u679A\u90FD\u4E0D\u53C2\u4E0E\u6536\u7F29\u3002 */
.dsh-ux-cardActions {
  align-items: center;
  display: inline-flex;
  flex: none;
  flex-wrap: wrap;
  gap: 8px;
}
.dsh-ux-restartButton {
  appearance: none;
  background: 0 0;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
  flex: none;
  font: inherit;
  font-size: 12px;
  line-height: 1;
  padding: 6px 12px;
  transition: border-color .16s, color .16s, background .16s;
  white-space: nowrap;
}
.dsh-ux-restartButton:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
  border-color: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-brand-primary);
}
.dsh-ux-restartButton:disabled {
  color: var(--dsw-alias-label-tertiary);
  cursor: default;
  opacity: .7;
}
/* \u786E\u8BA4\u6761\uFF1A\u62AC\u5934\u6B63\u4E0B\u65B9\u7684\u4E00\u6761\uFF0C\u4F4D\u7F6E\u5BF9\u9F50\u5E02\u573A\u7684\u300CN \u9879\u53D8\u66F4\u9700\u91CD\u542F\u300D\u6A2A\u5E45\u3002 */
.dsh-ux-restartBanner {
  align-items: center;
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  display: flex;
  gap: 10px;
  margin: 0 16px 12px;
  padding: 10px 12px;
}
.dsh-ux-restartBannerFailed { border-color: var(--dsw-alias-state-error-primary); }
.dsh-ux-restartBannerText {
  color: var(--dsw-alias-label-secondary);
  flex: 1;
  font-size: 12px;
  line-height: 1.5;
  min-width: 0;
}
.dsh-ux-restartBannerFailed .dsh-ux-restartBannerText { color: var(--dsw-alias-state-error-primary); }
.dsh-ux-restartBannerActions {
  align-items: center;
  display: inline-flex;
  flex: none;
  gap: 8px;
}
.dsh-ux-restartGo {
  appearance: none;
  background: var(--dsw-alias-button-primary-fill);
  border: 0;
  border-radius: 999px;
  color: var(--dsw-alias-label-primary-foreground);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  line-height: 1;
  padding: 7px 14px;
  white-space: nowrap;
}
.dsh-ux-restartGo:hover { background: var(--dsw-alias-brand-primary); }
.dsh-ux-restartCancel {
  appearance: none;
  background: 0 0;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  line-height: 1;
  padding: 7px 14px;
  white-space: nowrap;
}
.dsh-ux-restartCancel:hover {
  border-color: var(--dsw-alias-label-dimmed);
  color: var(--dsw-alias-label-primary);
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
/* \u4E0D\u53EF\u70B9\uFF08\u8F93\u5165\u6846\u7A7A / \u6B63\u5728\u4F18\u5316\uFF09\uFF1A\u538B\u6697\u5E76\u64A4\u6389 hover \u53CD\u9988\uFF0C\u8BA9"\u70B9\u4E0D\u52A8"\u4E00\u773C\u53EF\u89C1\u3002 */
.${QUICK_BUTTON_CLASS}[disabled] { opacity: .4; cursor: default; }
.${QUICK_BUTTON_CLASS}[disabled]:hover { opacity: .4; background: transparent; }
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

// src/client/PanelResizeHandles.tsx
var import_react = require("react");
var import_react_dom = require("react-dom");
init_settings_contract();
var import_jsx_runtime = require("react/jsx-runtime");
var EDGES = ["left", "right", "top", "bottom", "br"];
function PanelResizeHandles({ useLive, actions }) {
  const settings = useLive((value) => ({
    // 「设置面板」栏（或总开关）关着时整块停用 —— 与导航滚动那处用同一个判据。
    sectionOn: activeSections(value).panel,
    panelResize: value.panelResize,
    panelWidth: value.panelWidth,
    panelHeight: value.panelHeight
  }));
  const enabled = settings.sectionOn === true && settings.panelResize === true;
  const [panel, setPanel] = (0, import_react.useState)(null);
  const [active2, setActive] = (0, import_react.useState)(null);
  const dragRef = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
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
  (0, import_react.useEffect)(() => {
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
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: RESIZE_LAYER_CLASS, "data-composer-ux-resize": true, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: RESIZE_OUTLINE_CLASS, style: RESIZE_OUTLINE_STYLE }),
      EDGES.map((edge) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          className: edge === "br" ? RESIZE_GRIP_CLASS : RESIZE_EDGE_CLASS,
          "data-active": active2 === edge ? "true" : void 0,
          title: edge === "br" ? "\u62D6\u52A8\u6539\u9762\u677F\u5927\u5C0F" : void 0,
          style: handleBox(edge),
          onPointerDown: (event) => {
            onPointerDown(edge, event);
          },
          children: edge === "br" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: "12", height: "12", viewBox: "0 0 12 12", "aria-hidden": true, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
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

// src/client/NavFoldHost.tsx
var import_react3 = require("react");
init_nav_fold_store();

// src/client/sidebar-nav.ts
var NAV_LABELS = ["\u5168\u5C40\u9762\u677F", "Global panels"];
var PANEL_HINTS = ["\u63D2\u4EF6", "Plugins", "\u81EA\u52A8\u5316\u4EFB\u52A1", "\u4E0A\u4E0B\u6587\u6D1E\u5BDF", "MCP\u8FDE\u63A5\u5668", "\u66F4\u591A", "More"];
var NAV_FOLD_HEADER_TEXT = "\u5168\u5C40\u9762\u677F";
var NAV_FOLD_ATTR = "data-ux-nav-fold";
var NAV_FOLD_HEAD_ATTR = "data-ux-nav-fold-head";
var NAV_FOLD_STYLE_ATTR = "data-ux-nav-fold-style";
var NAV_FOLD_TITLE_ATTR = "data-ux-nav-title";
var NAV_FOLD_ROW_ATTR = "data-ux-nav-row";
function navFoldAttrOf(state3) {
  if (state3.mode === "off") return null;
  if (state3.mode === "icons") return "icons";
  return state3.collapsed ? "bar-collapsed" : "bar-open";
}
var NAV_FOLD_CSS = `
/* \u26A0\uFE0F \u6240\u6709\u89C4\u5219\u90FD\u53EA\u8BA4 [${NAV_FOLD_ROW_ATTR}]\uFF08\u6211\u4EEC\u6807\u51FA\u6765\u7684\u9762\u677F\u884C\uFF09\uFF0C
   \u4E0D\u5199 nav > button \u2014\u2014 \u522B\u7684\u63D2\u4EF6\u5F80\u8FD9\u4E00\u7EC4\u91CC\u6CE8\u5165\u7684\u6309\u94AE/\u5305\u88C5\u5C42\u5FC5\u987B\u539F\u6837\u4E0D\u52A8\u3002 */
nav[${NAV_FOLD_ATTR}='bar-collapsed'] > [${NAV_FOLD_ROW_ATTR}] { display: none !important; }
nav[${NAV_FOLD_ATTR}='icons'] { flex-direction: row; flex-wrap: wrap; gap: 4px; }
nav[${NAV_FOLD_ATTR}='icons'] > [${NAV_FOLD_ROW_ATTR}] {
  width: 34px;
  min-width: 34px;
  padding-left: 0;
  padding-right: 0;
  justify-content: center;
}
/* \u56FE\u6807\u90A3\u4E00\u9897\u5E26 aria-hidden\uFF0C\u6587\u5B57\u90A3\u9897\u4E0D\u5E26 \u2014\u2014 \u9760\u8BED\u4E49\u85CF\u6587\u5B57\uFF0C\u4E0D\u8BA4\u54C8\u5E0C\u7C7B\u540D\u3002 */
nav[${NAV_FOLD_ATTR}='icons'] > [${NAV_FOLD_ROW_ATTR}] > span:not([aria-hidden='true']) { display: none !important; }
/* \u300C\u66F4\u591A\u300D\u90A3\u9897\u6309\u94AE\u7684\u6807\u7B7E\u662F**\u88F8\u6587\u672C\u8282\u70B9**\uFF08\u6CA1\u6709 span\uFF09\uFF0C\u4E0A\u9762\u90A3\u6761\u89C4\u5219\u7BA1\u4E0D\u5230\u5B83\uFF1B
   \u6240\u4EE5\u56FE\u6807\u6A21\u5F0F\u518D\u8865\u4E00\u5200 fontSize:0\uFF08\u56FE\u6807\u662F SVG\uFF0C\u4E0D\u53D7\u5B57\u53F7\u5F71\u54CD\uFF09\u3002 */
nav[${NAV_FOLD_ATTR}='icons'] > [${NAV_FOLD_ROW_ATTR}] { font-size: 0; }
[${NAV_FOLD_HEAD_ATTR}] {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  box-sizing: border-box;
  padding: 6px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
}
[${NAV_FOLD_HEAD_ATTR}]:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-secondary); }
[${NAV_FOLD_HEAD_ATTR}]:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
[${NAV_FOLD_HEAD_ATTR}] > span[data-ux-nav-fold-chevron] { margin-left: auto; opacity: .7; }
`;
function findPanelNav(doc) {
  const navs = [...doc.querySelectorAll("nav")];
  for (const nav of navs) {
    const label = (nav.getAttribute("aria-label") ?? "").trim();
    if (NAV_LABELS.includes(label)) return nav;
  }
  for (const nav of navs) {
    const texts = [...nav.querySelectorAll("button")].map((button) => (button.getAttribute("aria-label") ?? button.textContent ?? "").trim());
    if (texts.some((text) => PANEL_HINTS.includes(text))) return nav;
  }
  return null;
}
function ensureStyle(doc) {
  let tag = doc.querySelector(`style[${NAV_FOLD_STYLE_ATTR}]`);
  if (tag === null) {
    tag = doc.createElement("style");
    tag.setAttribute(NAV_FOLD_STYLE_ATTR, "");
    doc.head.appendChild(tag);
  }
  if (tag.textContent !== NAV_FOLD_CSS) tag.textContent = NAV_FOLD_CSS;
}
function applyTitles(rows, on) {
  for (const button of rows) {
    if (on) {
      const label = (button.getAttribute("aria-label") ?? "").trim();
      if (label !== "" && button.getAttribute(NAV_FOLD_TITLE_ATTR) !== label) {
        button.setAttribute("title", label);
        button.setAttribute(NAV_FOLD_TITLE_ATTR, label);
      }
      for (const span of [...button.querySelectorAll("span")]) {
        if (span.querySelector("svg") !== null) continue;
        span.style.display = "none";
      }
      continue;
    }
    if (button.hasAttribute(NAV_FOLD_TITLE_ATTR)) {
      button.removeAttribute("title");
      button.removeAttribute(NAV_FOLD_TITLE_ATTR);
    }
    for (const span of [...button.querySelectorAll("span")]) {
      if (span.style.display === "none") span.style.display = "";
    }
  }
}
function splitPanelRows(nav, mark = true) {
  const rows = [];
  const foreign = [];
  for (const child of [...nav.children]) {
    const label = (child.getAttribute("aria-label") ?? "").trim();
    const isRow = child.tagName === "BUTTON" && label !== "" && child.querySelector('[aria-hidden="true"]') !== null;
    const shouldMark = isRow && mark;
    if (!shouldMark) {
      if (child.hasAttribute(NAV_FOLD_ROW_ATTR)) child.removeAttribute(NAV_FOLD_ROW_ATTR);
    } else if (!child.hasAttribute(NAV_FOLD_ROW_ATTR)) {
      child.setAttribute(NAV_FOLD_ROW_ATTR, "");
    }
    if (isRow) rows.push(child);
    else foreign.push(child);
  }
  return { rows, foreign };
}
function ensureHeader(doc, nav, state3, onToggle) {
  const want = state3.mode === "bar";
  let head = doc.querySelector(`button[${NAV_FOLD_HEAD_ATTR}]`);
  if (!want) {
    head?.remove();
    return;
  }
  if (head === null) {
    head = doc.createElement("button");
    head.type = "button";
    head.setAttribute(NAV_FOLD_HEAD_ATTR, "");
    nav.parentElement?.insertBefore(head, nav);
  }
  const open = !state3.collapsed;
  head.setAttribute("aria-expanded", open ? "true" : "false");
  head.setAttribute("title", open ? "\u6536\u8D77\u5168\u5C40\u9762\u677F" : "\u5C55\u5F00\u5168\u5C40\u9762\u677F");
  head.textContent = "";
  const label = doc.createElement("span");
  label.textContent = NAV_FOLD_HEADER_TEXT;
  const chevron = doc.createElement("span");
  chevron.setAttribute("data-ux-nav-fold-chevron", "");
  chevron.setAttribute("aria-hidden", "true");
  chevron.textContent = open ? "\u25B4" : "\u25BE";
  head.append(label, chevron);
  head.onclick = () => {
    onToggle(!state3.collapsed);
  };
}
function applyNavFold(doc, state3, onToggle) {
  ensureStyle(doc);
  const nav = findPanelNav(doc);
  if (nav === null) return false;
  const attr = navFoldAttrOf(state3);
  if (attr === null) nav.removeAttribute(NAV_FOLD_ATTR);
  else if (nav.getAttribute(NAV_FOLD_ATTR) !== attr) nav.setAttribute(NAV_FOLD_ATTR, attr);
  const { rows, foreign } = splitPanelRows(nav, state3.mode !== "off");
  applyTitles(rows, state3.mode === "icons");
  const hideWhole = state3.mode === "bar" && state3.collapsed && foreign.length === 0;
  if (hideWhole) {
    if (nav.style.display !== "none") nav.style.display = "none";
  } else if (nav.style.display === "none") {
    nav.style.display = "";
  }
  ensureHeader(doc, nav, state3, onToggle);
  return true;
}

// src/client/NavFoldHost.tsx
function NavFoldHost() {
  const { mode, collapsed } = useNavFold();
  (0, import_react3.useEffect)(() => {
    let frame = 0;
    const apply2 = () => {
      applyNavFold(document, { mode, collapsed }, (next) => {
        void Promise.resolve().then(() => (init_nav_fold_store(), nav_fold_store_exports)).then((store) => store.saveNavFold({ collapsed: next }));
      });
    };
    apply2();
    const nav = findPanelNav(document);
    const scope = nav?.parentElement ?? document.body;
    if (scope === null) return void 0;
    const observer = new MutationObserver(() => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        apply2();
      });
    });
    observer.observe(scope, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [mode, collapsed]);
  return null;
}

// src/client.tsx
init_nav_fold_store();

// src/client/RestartTitlebarButton.tsx
var import_react4 = require("react");

// src/client/restart-screen.ts
init_settings_contract();
var RESTART_SCREEN_MAX_ATTEMPTS = 120;
var RESTART_PROGRESS_CAP = 95;
var RESTART_EXPECTED_DEFAULT_MS = 45e3;
var RESTART_MARK_MAX_AGE_MS = 30 * 6e4;
var RESTART_MARK_KEY = "composer-ux-restart-mark";
var RESTART_LAST_MS_KEY = "composer-ux-restart-last-ms";
function beginRestartTrack(oldBoot, startedAt) {
  return { phase: "stopping", oldBoot, startedAt, seenDown: false, attempts: 0 };
}
function advanceRestartTrack(track, probe, attemptLimit = RESTART_SCREEN_MAX_ATTEMPTS) {
  const attempts = track.attempts + 1;
  if (probe.online && probe.boot !== track.oldBoot && probe.boot !== "") {
    return { ...track, phase: "up", attempts };
  }
  if (!track.seenDown) {
    if (!probe.online) return { ...track, phase: "stopping", seenDown: true, attempts };
    return { ...track, phase: attempts >= attemptLimit ? "stuck" : "stopping", attempts };
  }
  return { ...track, phase: attempts >= attemptLimit ? "stuck" : "starting", attempts };
}
function restartProgress(track, now, expectedMs = RESTART_EXPECTED_DEFAULT_MS) {
  if (track.phase === "up") return { percent: 100, slow: false };
  const expected = expectedMs > 0 ? expectedMs : RESTART_EXPECTED_DEFAULT_MS;
  const elapsed2 = Math.max(0, now - track.startedAt);
  const raw = Math.round(elapsed2 / expected * RESTART_PROGRESS_CAP);
  return { percent: Math.max(2, Math.min(RESTART_PROGRESS_CAP, raw)), slow: elapsed2 > expected };
}
function restartMessage(phase) {
  if (phase === "stopping") return "\u6B63\u5728\u505C\u65E7\u8FDB\u7A0B\u2026";
  if (phase === "starting") return "\u65B0\u8FDB\u7A0B\u6B63\u5728\u8D77\u6765\u2026";
  if (phase === "up") return "\u91CD\u542F\u5B8C\u6210\uFF0C\u6B63\u5728\u5237\u65B0\u9875\u9762\u2026";
  return "\u670D\u52A1\u4E00\u76F4\u5728\u7EBF\uFF0C\u8FD9\u6B21\u91CD\u542F\u53EF\u80FD\u6CA1\u751F\u6548";
}
function writeRestartMark(storage, mark) {
  try {
    storage?.setItem(RESTART_MARK_KEY, JSON.stringify(mark));
  } catch {
  }
}
function consumeRestartMark(storage, now, maxAgeMs = RESTART_MARK_MAX_AGE_MS) {
  try {
    const raw = storage?.getItem(RESTART_MARK_KEY);
    if (raw === null || raw === void 0 || raw === "") return null;
    const parsed = JSON.parse(raw);
    const startedAt = typeof parsed.startedAt === "number" ? parsed.startedAt : 0;
    if (startedAt <= 0 || now - startedAt > maxAgeMs) {
      storage?.removeItem(RESTART_MARK_KEY);
      return null;
    }
    const mark = {
      startedAt,
      oldBoot: typeof parsed.oldBoot === "string" ? parsed.oldBoot : "",
      logPath: typeof parsed.logPath === "string" ? parsed.logPath : ""
    };
    storage?.removeItem(RESTART_MARK_KEY);
    return mark;
  } catch {
    return null;
  }
}
function readLastRestartMs(storage) {
  try {
    const raw = storage?.getItem(RESTART_LAST_MS_KEY);
    const value = raw === null || raw === void 0 ? Number.NaN : Number(raw);
    return Number.isFinite(value) && value > 0 ? value : RESTART_EXPECTED_DEFAULT_MS;
  } catch {
    return RESTART_EXPECTED_DEFAULT_MS;
  }
}
function writeLastRestartMs(storage, ms) {
  try {
    if (Number.isFinite(ms) && ms > 0) storage?.setItem(RESTART_LAST_MS_KEY, String(Math.round(ms)));
  } catch {
  }
}
async function probeRestart(fetcher = fetch) {
  try {
    const response = await fetcher("/composer-ux/restart", { cache: "no-store" });
    if (!response.ok) return { online: false, boot: "" };
    const body = await response.json();
    const boot = typeof body.boot === "string" ? body.boot : "";
    return { online: boot !== "", boot };
  } catch {
    return { online: false, boot: "" };
  }
}
function browserDefaults(oldBoot, logPath) {
  const win = typeof window === "undefined" ? void 0 : window;
  const doc = typeof document === "undefined" ? void 0 : document;
  let storage;
  try {
    storage = win?.localStorage;
  } catch {
    storage = void 0;
  }
  return {
    oldBoot,
    logPath,
    probe: () => probeRestart(),
    now: () => Date.now(),
    storage,
    // 这两个只在真的用得到时才会被碰（enterRestartScreen 会先判断 doc）。
    doc,
    // 测试/嵌入形态里  可能存在但  没有：可选链必须再深一层。
    reload: (href) => {
      win?.location?.replace?.(href);
    },
    href: win?.location?.href ?? "",
    setTimer: (fn, ms) => typeof win?.setTimeout === "function" ? win.setTimeout(fn, ms) : 0,
    clearTimer: (id) => {
      if (typeof win?.clearTimeout === "function") win.clearTimeout(id);
    }
  };
}
function restartReloadHref(href) {
  const [base2, hash = ""] = href.split("#");
  const [path, query = ""] = (base2 ?? "").split("?");
  const params = new URLSearchParams(query);
  params.set("restarted", "1");
  return `${path ?? ""}?${params.toString()}${hash === "" ? "" : `#${hash}`}`;
}
function enterRestartScreen(overrides) {
  const deps = { ...browserDefaults(overrides.oldBoot, overrides.logPath), ...overrides };
  const doc = deps.doc;
  if (doc === void 0 || doc.body === void 0) return { stop: () => void 0 };
  const pollMs = deps.pollMs ?? 1e3;
  const limit = deps.attemptLimit ?? RESTART_SCREEN_MAX_ATTEMPTS;
  writeRestartMark(deps.storage, { startedAt: deps.now(), oldBoot: deps.oldBoot, logPath: deps.logPath });
  try {
    doc.title = "\u27F3 \u91CD\u542F\u4E2D\u2026";
  } catch {
  }
  const layer = doc.createElement("div");
  layer.setAttribute("data-composer-ux", "restart-screen");
  layer.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:2147483000",
    "display:flex",
    "flex-direction:column",
    "align-items:center",
    "justify-content:center",
    "gap:14px",
    "padding:24px",
    "background:var(--dsw-alias-bg-layer-0,rgba(20,20,22,0.96))",
    "color:var(--dsw-alias-label-primary,#fff)",
    "text-align:center",
    "font-family:inherit",
    "font-size:13px"
  ].join(";");
  const spinner = doc.createElement("div");
  spinner.style.cssText = [
    "width:28px",
    "height:28px",
    "border-radius:50%",
    "border:3px solid var(--dsw-alias-border-l2,rgba(255,255,255,0.25))",
    "border-top-color:var(--dsw-alias-label-primary,#fff)",
    "animation:composer-ux-restart-spin 0.9s linear infinite"
  ].join(";");
  const title = doc.createElement("div");
  title.textContent = "\u6B63\u5728\u91CD\u542F DSH \u670D\u52A1\u2026";
  title.style.cssText = "font-size:15px;font-weight:600";
  const phase = doc.createElement("div");
  phase.style.cssText = "opacity:0.8";
  const track = doc.createElement("div");
  track.style.cssText = [
    "width:min(320px,70vw)",
    "height:4px",
    "border-radius:999px",
    "background:var(--dsw-alias-border-l2,rgba(255,255,255,0.18))",
    "overflow:hidden"
  ].join(";");
  const bar = doc.createElement("div");
  bar.style.cssText = "height:100%;width:2%;border-radius:999px;background:var(--dsw-alias-label-primary,#fff);transition:width 0.4s ease";
  track.append(bar);
  const detail2 = doc.createElement("div");
  detail2.style.cssText = "opacity:0.6;font-size:11.5px;max-width:min(520px,86vw);line-height:1.6";
  const actions = doc.createElement("div");
  actions.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;justify-content:center";
  const style = doc.createElement("style");
  style.textContent = "@keyframes composer-ux-restart-spin{to{transform:rotate(360deg)}}";
  layer.append(style, spinner, title, phase, track, detail2, actions);
  doc.body.append(layer);
  const button = (label, onClick) => {
    const el = doc.createElement("button");
    el.type = "button";
    el.textContent = label;
    el.style.cssText = [
      "font:inherit",
      "cursor:pointer",
      "padding:5px 12px",
      "border-radius:999px",
      "border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,0.3))",
      "background:transparent",
      "color:inherit"
    ].join(";");
    el.addEventListener("click", onClick);
    return el;
  };
  let state3 = beginRestartTrack(deps.oldBoot, deps.now());
  const expected = readLastRestartMs(deps.storage);
  let timer = null;
  let stopped = false;
  const paint = () => {
    const { percent, slow } = restartProgress(state3, deps.now(), expected);
    phase.textContent = restartMessage(state3.phase);
    bar.style.width = `${String(percent)}%`;
    detail2.textContent = slow && state3.phase !== "up" ? `\u6BD4\u9884\u671F\u6162\u4E00\u4E9B\uFF08\u9884\u671F\u7EA6 ${String(Math.round(expected / 1e3))} \u79D2\uFF09\u2026 \u518D\u7B49\u7B49\uFF0C\u4E0D\u8981\u5173\u6389\u8FD9\u4E2A\u9875\u9762\u3002` : "\u65E7\u8FDB\u7A0B\u9000\u51FA\u540E\u4F1A\u81EA\u52A8\u628A\u65B0\u8FDB\u7A0B\u62C9\u8D77\u6765\uFF0C\u670D\u52A1\u4E00\u56DE\u6765\u8FD9\u4E2A\u9875\u9762\u5C31\u4F1A\u81EA\u5DF1\u5237\u65B0\u3002";
    if (state3.phase === "stuck") {
      spinner.style.display = "none";
      title.textContent = "\u8FD9\u6B21\u91CD\u542F\u53EF\u80FD\u6CA1\u751F\u6548";
      detail2.textContent = deps.logPath === "" ? "\u670D\u52A1\u4E00\u76F4\u5728\u7EBF\uFF0C\u4E14\u6CA1\u6709\u89C2\u5BDF\u5230\u65B0\u8FDB\u7A0B\u3002\u53EF\u4EE5\u624B\u52A8\u5237\u65B0\u9875\u9762\u770B\u770B\u3002" : `\u670D\u52A1\u4E00\u76F4\u5728\u7EBF\uFF0C\u4E14\u6CA1\u6709\u89C2\u5BDF\u5230\u65B0\u8FDB\u7A0B\u3002\u91CD\u542F\u65E5\u5FD7\uFF1A${deps.logPath}`;
      actions.replaceChildren(
        button("\u590D\u5236\u65E5\u5FD7\u8DEF\u5F84", () => {
          void navigator.clipboard?.writeText(deps.logPath).catch(() => void 0);
        }),
        button("\u91CD\u65B0\u52A0\u8F7D\u9875\u9762", () => {
          deps.reload(deps.href);
        })
      );
    }
  };
  const finish = () => {
    writeLastRestartMs(deps.storage, deps.now() - state3.startedAt);
    paint();
    deps.reload(restartReloadHref(deps.href));
    stop();
  };
  const tick = () => {
    if (stopped) return;
    void deps.probe().then((probe) => {
      if (stopped) return;
      state3 = advanceRestartTrack(state3, probe, limit);
      paint();
      if (state3.phase === "up") {
        finish();
        return;
      }
      if (state3.phase === "stuck") return;
      timer = deps.setTimer(tick, pollMs);
    });
  };
  const stop = () => {
    stopped = true;
    if (timer !== null) deps.clearTimer(timer);
  };
  paint();
  timer = deps.setTimer(tick, pollMs);
  return { stop };
}
function maybeShowRestartDone(overrides = {}) {
  const deps = { ...browserDefaults("", ""), ...overrides };
  const search = overrides.search ?? (typeof window === "undefined" ? "" : window.location?.search ?? "");
  if (!new URLSearchParams(search).has("restarted")) return false;
  if (deps.doc === void 0 || deps.doc.body === void 0) return false;
  const mark = consumeRestartMark(deps.storage, deps.now());
  if (mark === null) return false;
  const seconds = Math.max(1, Math.round((deps.now() - mark.startedAt) / 1e3));
  const toast = deps.doc.createElement("div");
  toast.setAttribute("data-composer-ux", "restart-done");
  toast.textContent = `\u91CD\u542F\u5B8C\u6210\uFF08\u7528\u65F6\u7EA6 ${String(seconds)} \u79D2\uFF09`;
  toast.style.cssText = [
    "position:fixed",
    "left:50%",
    "bottom:28px",
    "transform:translateX(-50%)",
    "z-index:2147483000",
    "padding:7px 14px",
    "border-radius:999px",
    "background:var(--dsw-specific-menu,rgba(28,28,30,0.96))",
    "color:var(--dsw-alias-label-primary,#fff)",
    "border:0.5px solid var(--dsw-alias-border-l2,rgba(255,255,255,0.2))",
    "font-size:12px",
    "font-family:inherit",
    "box-shadow:0 6px 24px rgba(0,0,0,0.28)"
  ].join(";");
  deps.doc.body.append(toast);
  deps.setTimer(() => {
    toast.remove();
  }, 4e3);
  return true;
}
async function requestRestart(fetcher = fetch) {
  let oldBoot = "";
  let logPath = "";
  try {
    const status = await fetcher("/composer-ux/restart", {
      cache: "no-store",
      headers: { [RESTART_CSRF_HEADER]: RESTART_CSRF_VALUE }
    });
    if (status.ok) {
      const facts = await status.json();
      oldBoot = typeof facts.boot === "string" ? facts.boot : "";
      logPath = typeof facts.logHint === "string" ? facts.logHint : "";
      if (typeof facts.blocked === "string" && facts.blocked !== "") {
        return { ok: false, error: `\u8FD9\u4E2A\u5BBF\u4E3B\u5F53\u524D\u4E0D\u5141\u8BB8\u4ECE\u754C\u9762\u91CD\u542F\uFF08${facts.blocked}\uFF09` };
      }
    }
  } catch {
  }
  try {
    const response = await fetcher("/composer-ux/restart", {
      method: "POST",
      headers: { "content-type": "application/json", [RESTART_CSRF_HEADER]: RESTART_CSRF_VALUE },
      body: "{}"
    });
    const parsed = await response.json().catch(() => ({}));
    if (response.status !== 202 && parsed.ok !== true) {
      return { ok: false, error: parsed.error ?? `HTTP ${String(response.status)}` };
    }
    return { ok: true, oldBoot, logPath };
  } catch {
    return { ok: true, oldBoot, logPath };
  }
}

// src/client/RestartTitlebarButton.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var STYLE_ID = "composer-ux-titlebar-style";
var ARMED_RESET_MS = 4e3;
var STYLE = [
  "@keyframes composer-ux-titlebar-spin{to{transform:rotate(360deg)}}",
  ".composer-ux-titlebar{position:absolute;top:0;z-index:30;-webkit-app-region:no-drag;",
  "right:calc(100% - env(titlebar-area-x,0px) - env(titlebar-area-width,calc(100% - 138px)));",
  "height:var(--dsh-windows-titlebar-height,40px);display:flex;align-items:center;padding-right:6px}",
  ".composer-ux-titlebar>button{display:inline-flex;align-items:center;gap:6px;height:28px;min-width:104px;",
  "padding:0 12px;border:0.5px solid var(--dsw-alias-border-l2,rgba(255,255,255,.16));border-radius:7px;",
  "background:var(--dsw-alias-bg-layer-1,#0b0b0e);color:var(--dsw-alias-label-primary,#f7f7fa);",
  "font:inherit;font-size:12px;font-weight:600;line-height:1;cursor:pointer;white-space:nowrap}",
  ".composer-ux-titlebar>button:disabled{cursor:default;opacity:.85}",
  ".composer-ux-titlebar>button[data-error]{border-color:rgba(229,72,77,.6);color:#ffb7b9}"
].join("");
function ensureStyle2() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID) !== null) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLE;
  document.head.append(style);
}
function Icon({ spin }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "svg",
    {
      width: "14",
      height: "14",
      viewBox: "0 0 16 16",
      "aria-hidden": "true",
      focusable: "false",
      style: spin ? { animation: "composer-ux-titlebar-spin 1s linear infinite" } : void 0,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M8 2.5a5.5 5.5 0 1 0 5.2 3.7", fill: "none", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M13.4 2.2v4h-4", fill: "none", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round", strokeLinejoin: "round" })
      ]
    }
  );
}
function RestartTitlebarButton() {
  const [armed, setArmed] = (0, import_react4.useState)(false);
  const [busy, setBusy] = (0, import_react4.useState)(false);
  const [error, setError] = (0, import_react4.useState)("");
  const [visible, setVisible] = (0, import_react4.useState)(false);
  (0, import_react4.useEffect)(() => {
    ensureStyle2();
    try {
      setVisible(document.documentElement.hasAttribute("data-windows-titlebar"));
    } catch {
      setVisible(false);
    }
  }, []);
  if (!visible) return null;
  const label = busy ? "\u91CD\u542F\u4E2D\u2026" : armed ? "\u786E\u8BA4\u91CD\u542F\uFF1F" : error === "" ? "\u91CD\u542F" : "\u91CD\u8BD5";
  const click = () => {
    if (busy) return;
    if (!armed) {
      setArmed(true);
      setError("");
      window.setTimeout(() => {
        setArmed(false);
      }, ARMED_RESET_MS);
      return;
    }
    setArmed(false);
    setBusy(true);
    setError("");
    void requestRestart().then((result) => {
      if (!result.ok) {
        setBusy(false);
        setError(result.error);
        return;
      }
      enterRestartScreen({ oldBoot: result.oldBoot, logPath: result.logPath });
    });
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "composer-ux-titlebar", "data-composer-ux": "restart-titlebar", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "button",
    {
      type: "button",
      title: error === "" ? armed ? "\u518D\u70B9\u4E00\u6B21\u786E\u8BA4\u91CD\u542F\uFF08\u4F1A\u6253\u65AD\u6B63\u5728\u8DD1\u7684\u4F1A\u8BDD\uFF09" : "\u91CD\u542F DSH\uFF08\u66F4\u65B0\u63D2\u4EF6\u540E\u7528\uFF1B\u786E\u8BA4\u540E\u663E\u793A\u91CD\u542F\u8FDB\u5EA6\u5E76\u81EA\u52A8\u56DE\u5230\u9875\u9762\uFF09" : `\u91CD\u542F\u5931\u8D25\uFF1A${error}`,
      disabled: busy,
      "data-error": error === "" ? void 0 : true,
      onClick: click,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Icon, { spin: busy }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: label })
      ]
    }
  ) });
}

// src/client/SettingsSection.tsx
var import_react11 = require("react");

// src/client/DoctorCard.tsx
var import_react5 = require("react");
init_settings_contract();

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
  padding: "10px 0",
  borderTop: "1px solid var(--dsw-alias-border-l2)"
};
var rowText = {
  minWidth: 0,
  flex: 1
};
var rowTitle = {
  color: "var(--dsw-alias-label-primary)",
  fontSize: 12.5,
  lineHeight: 1.45
};
var rowDesc = {
  color: "var(--dsw-alias-label-tertiary)",
  fontSize: 11.5,
  lineHeight: 1.55,
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
var quickPanel = {
  position: "fixed",
  // 同 `menu`：刻意保留 9999，理由见那里。
  zIndex: 9999,
  width: 420,
  maxWidth: "calc(100vw - 24px)",
  maxHeight: "min(60vh, 520px)",
  display: "flex",
  flexDirection: "column",
  background: "var(--dsw-specific-menu)",
  backdropFilter: "var(--dsw-menu-backdrop-filter)",
  border: 0,
  borderRadius: "var(--dsw-radius-lg)",
  boxShadow: "var(--dsw-elevation-prominent)",
  "--dsw-elevation-stroke-color": "var(--dsw-alias-border-l1)",
  pointerEvents: "auto",
  // 0.16.4（用户原话「让这个页面可以滑动，使其一些按钮不被遮挡」）：**整块面板一起滚** ——
  // 之前这里是 `overflow: hidden`，把超出 60vh 的内容（含结果框那排按钮）直接裁掉。
  overflowY: "auto",
  overflowX: "hidden",
  overscrollBehavior: "contain"
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
  // `flex: 1 1 auto` + `minHeight: 0`：这一半被压时**自己滚**，而不是把内容顶出去。
  flex: "1 1 auto",
  minHeight: 0,
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
var quickSectionBody = {
  flex: "1 1 auto",
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  // 0.14.1：**这一半要能滚**。以前是 overflow: hidden —— 卡片（七行 + 详情 + 提示词框）
  // 比面板还高时，下面的内容就被面板底部裁掉、够不到（用户报的「点完看不到下边」）。
  // 横轴仍然不滚（面板宽度固定），纵轴给滑动条；overscroll 收敛，免得滚到页面上。
  overflowX: "hidden",
  overflowY: "auto",
  overscrollBehavior: "contain"
};
var quickSectionToggle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  width: "100%",
  padding: "6px 12px",
  border: 0,
  borderTop: "0.5px solid var(--dsw-alias-border-l2)",
  borderBottom: "0.5px solid var(--dsw-alias-border-l2)",
  background: "transparent",
  color: "var(--dsw-alias-label-secondary)",
  fontSize: 11.5,
  textAlign: "left",
  cursor: "pointer"
};
var quickSectionToggleArrow = {
  width: 10,
  flex: "0 0 auto"
};
var quickCategoryRow = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  flexWrap: "wrap"
};
var quickCategoryTab = {
  border: "0.5px solid var(--dsw-alias-border-l2)",
  background: "transparent",
  color: "var(--dsw-alias-label-tertiary)",
  fontSize: 11,
  lineHeight: 1,
  padding: "4px 8px",
  borderRadius: 999,
  cursor: "pointer",
  whiteSpace: "nowrap",
  maxWidth: 160,
  overflow: "hidden",
  textOverflow: "ellipsis"
};
var quickCategoryTabActive = {
  ...quickCategoryTab,
  border: "0.5px solid var(--dsw-alias-brand-primary)",
  color: "var(--dsw-alias-label-primary)",
  fontWeight: 600
};
var quickCategoryAdd = {
  ...quickCategoryTab,
  color: "var(--dsw-alias-label-tertiary)",
  padding: "4px 7px",
  cursor: "pointer"
};
var dockBox = {
  // 0.16.4：整块面板滚动之后，这里改为**按内容自然高度**排（不再 flex 撑满、不再自己裁），
  // 否则它会把内容压缩到面板高度内，滚动条永远等不到溢出。
  flex: "0 0 auto",
  minHeight: "auto",
  overflow: "visible",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: "8px 12px 8px",
  // 0.13.2：**不再画成一张独立卡片**（用户原话「提示词优化是悬浮的」）。
  // 去掉自己的背景与圆角边框，只留一条细分隔线 —— 它就是面板里的一段，而不是浮在上面的小窗。
  borderTop: "0.5px solid var(--dsw-alias-border-l2)"
};
var dockBody = {
  flex: "1 1 auto",
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  gap: 6,
  // 0.16.4：交给根容器统一滚（内层再滚会出现双层滚动条）。
  overflowY: "visible"
};
var dockButtonsPinned = {
  flex: "0 0 auto"
};
var dockButtonGhost = {
  border: 0,
  background: "transparent",
  color: "var(--dsw-alias-label-tertiary)",
  borderRadius: 999,
  padding: "3px 8px",
  fontSize: 11,
  lineHeight: 1.6,
  cursor: "pointer",
  whiteSpace: "nowrap"
};
var dockButtonWarn = {
  ...dockButtonGhost,
  color: "var(--dsw-alias-label-error, #d33)",
  border: "0.5px solid var(--dsw-alias-label-error, #d33)"
};
var dockHead = {
  display: "flex",
  alignItems: "center",
  gap: 6
};
var dockPhase = {
  color: "var(--dsw-alias-label-primary)",
  fontSize: 12,
  fontWeight: 600
};
var dockMeta = {
  color: "var(--dsw-alias-label-tertiary)",
  fontSize: 11,
  lineHeight: 1.5,
  // 顶到右边：`marginLeft: auto` 让秒表贴着取消按钮。
  marginLeft: "auto"
};
var dockList = {
  margin: 0,
  padding: 0,
  listStyle: "none",
  display: "flex",
  flexDirection: "column",
  gap: 4,
  maxHeight: "18vh",
  overflowY: "auto"
};
var dockItemRow = {
  display: "flex",
  flexDirection: "column",
  gap: 1,
  fontSize: 12,
  lineHeight: 1.5
};
var dockKind = {
  color: "var(--dsw-alias-brand-primary)",
  fontSize: 10,
  fontWeight: 600
};
var dockItemText = {
  color: "var(--dsw-alias-label-primary)",
  wordBreak: "break-word"
};
var dockDropped = {
  color: "var(--dsw-alias-label-tertiary)",
  fontSize: 11,
  lineHeight: 1.5
};
var dockError = {
  color: "var(--dsw-alias-label-error, #d33)",
  fontSize: 12,
  lineHeight: 1.5,
  wordBreak: "break-word"
};
var dockEditor = {
  width: "100%",
  minHeight: 88,
  maxHeight: "30vh",
  resize: "vertical",
  boxSizing: "border-box",
  padding: "6px 8px",
  borderRadius: 8,
  border: "0.5px solid var(--dsw-alias-border-l2)",
  background: "var(--dsw-specific-menu)",
  color: "var(--dsw-alias-label-primary)",
  fontSize: 12,
  lineHeight: 1.6,
  fontFamily: "inherit"
};
var dockSummaryLine = {
  color: "var(--dsw-alias-label-tertiary)",
  fontSize: 11,
  lineHeight: 1.5,
  wordBreak: "break-word"
};
var dockButtons = {
  display: "flex",
  gap: 6,
  alignItems: "center"
};
var dockButton = {
  border: "0.5px solid var(--dsw-alias-border-l2)",
  background: "transparent",
  color: "var(--dsw-alias-label-secondary)",
  borderRadius: 999,
  padding: "3px 10px",
  fontSize: 11,
  lineHeight: 1.6,
  cursor: "pointer",
  whiteSpace: "nowrap"
};
var dockButtonDisabled = {
  ...dockButton,
  opacity: 0.45,
  cursor: "default"
};
var dockButtonPrimary = {
  ...dockButton,
  background: "var(--dsw-alias-button-primary-fill)",
  borderColor: "var(--dsw-alias-button-primary-fill)",
  color: "var(--dsw-alias-label-primary-foreground)",
  fontWeight: 600
};
var optCard = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: "8px 12px 10px",
  borderBottom: "0.5px solid var(--dsw-alias-border-l2)"
};
var optCardTitle = {
  color: "var(--dsw-alias-label-primary)",
  fontSize: 12,
  fontWeight: 600
};
var optFoldHead = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  width: "100%",
  padding: 0,
  border: "none",
  background: "none",
  textAlign: "left",
  cursor: "pointer",
  color: "inherit",
  font: "inherit"
};
var optFoldArrow = {
  color: "var(--dsw-alias-label-tertiary)",
  fontSize: 10,
  lineHeight: 1,
  flex: "0 0 auto"
};
var optFoldSummary = {
  color: "var(--dsw-alias-label-tertiary)",
  fontSize: 11,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};
var optRow = {
  display: "flex",
  alignItems: "center",
  gap: 8
};
var optLabel = {
  color: "var(--dsw-alias-label-secondary)",
  fontSize: 11.5,
  flex: "0 0 52px"
};
var optSegmented = {
  display: "flex",
  alignItems: "center",
  gap: 2,
  flex: "1 1 auto",
  minWidth: 0
};
var optSegButton = {
  flex: "1 1 auto",
  minWidth: 0,
  padding: "3px 6px",
  border: "0.5px solid var(--dsw-alias-border-l2)",
  background: "transparent",
  color: "var(--dsw-alias-label-secondary)",
  borderRadius: 6,
  fontSize: 11,
  lineHeight: 1.6,
  cursor: "pointer",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis"
};
var optSegButtonActive = {
  ...optSegButton,
  background: "var(--dsw-alias-bg-layer-1)",
  color: "var(--dsw-alias-label-primary)",
  borderColor: "var(--dsw-alias-label-primary)",
  fontWeight: 600
};
var optInput = {
  flex: "1 1 auto",
  minWidth: 0,
  boxSizing: "border-box",
  padding: "3px 8px",
  border: "0.5px solid var(--dsw-alias-border-l2)",
  borderRadius: 6,
  background: "transparent",
  color: "var(--dsw-alias-label-primary)",
  fontSize: 11.5
};
var optSlider = {
  flex: "1 1 auto",
  minWidth: 0,
  accentColor: "var(--dsw-alias-label-primary)"
};
var optNumber = {
  color: "var(--dsw-alias-label-tertiary)",
  fontSize: 11,
  flex: "0 0 auto",
  minWidth: 34,
  textAlign: "right"
};
var optPromptBox = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: 96,
  maxHeight: "22vh",
  resize: "vertical",
  padding: "6px 8px",
  border: "0.5px solid var(--dsw-alias-border-l2)",
  borderRadius: 8,
  background: "transparent",
  color: "var(--dsw-alias-label-primary)",
  fontSize: 11.5,
  lineHeight: 1.6,
  fontFamily: "inherit"
};
var optHint = {
  color: "var(--dsw-alias-label-tertiary)",
  fontSize: 10.5,
  lineHeight: 1.5
};
var optPickerButton = {
  flex: "1 1 auto",
  minWidth: 0,
  textAlign: "left",
  padding: "3px 8px",
  border: "0.5px solid var(--dsw-alias-border-l2)",
  borderRadius: 6,
  background: "transparent",
  color: "var(--dsw-alias-label-primary)",
  fontSize: 11.5,
  lineHeight: 1.7,
  cursor: "pointer",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis"
};
var optPickerPanel = {
  maxHeight: 260,
  overflowY: "auto",
  overscrollBehavior: "contain",
  border: "0.5px solid var(--dsw-alias-border-l2)",
  borderRadius: 8,
  background: "var(--dsw-alias-bg-layer-1)",
  padding: 4,
  display: "flex",
  flexDirection: "column",
  gap: 1
};
var optPickerGroup = {
  position: "sticky",
  top: 0,
  zIndex: 1,
  background: "var(--dsw-alias-bg-layer-1)",
  color: "var(--dsw-alias-label-tertiary)",
  fontSize: 10.5,
  fontWeight: 600,
  padding: "4px 6px 2px"
};
var optPickerItem = {
  display: "flex",
  alignItems: "baseline",
  gap: 6,
  width: "100%",
  textAlign: "left",
  padding: "4px 8px",
  border: "none",
  borderRadius: 6,
  background: "transparent",
  color: "var(--dsw-alias-label-primary)",
  fontSize: 11.5,
  lineHeight: 1.6,
  cursor: "pointer"
};
var optPickerItemActive = {
  ...optPickerItem,
  background: "var(--dsw-alias-bg-layer-2)",
  fontWeight: 600
};
var optPickerModelId = {
  color: "var(--dsw-alias-label-tertiary)",
  fontSize: 10.5
};

// src/client/DoctorCard.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var LEVEL_COLOR = {
  ok: "var(--dsw-alias-label-primary)",
  info: "var(--dsw-alias-label-secondary)",
  warn: "#b26a00",
  fail: "#c62828"
};
var LEVEL_MARK = { ok: "\u2713", info: "\xB7", warn: "!", fail: "\u2717" };
function sanitizeRows(value) {
  if (!Array.isArray(value)) return [];
  const levels = ["ok", "info", "warn", "fail"];
  return value.flatMap((row2) => {
    if (typeof row2 !== "object" || row2 === null) return [];
    const item = row2;
    const level = typeof item.level === "string" && levels.includes(item.level) ? item.level : "info";
    if (typeof item.label !== "string" || typeof item.detail !== "string") return [];
    return [{
      id: typeof item.id === "string" ? item.id : item.label,
      label: item.label,
      level,
      detail: item.detail
    }];
  });
}
function DoctorCard() {
  const [state3, setState] = (0, import_react5.useState)({ kind: "idle" });
  const run = (0, import_react5.useCallback)(() => {
    setState({ kind: "loading" });
    void fetch(DOCTOR_API_PATH, { headers: { accept: "application/json" } }).then(async (response) => {
      const raw = await response.text();
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        setState({ kind: "error", message: `\u670D\u52A1\u7AEF\u8FD4\u56DE\u7684\u4E0D\u662F JSON\uFF08HTTP ${String(response.status)}\uFF09` });
        return;
      }
      const row2 = typeof parsed === "object" && parsed !== null ? parsed : {};
      if (row2.ok !== true) {
        setState({ kind: "error", message: typeof row2.error === "string" ? row2.error : "\u81EA\u68C0\u5931\u8D25\uFF08\u6CA1\u6709\u539F\u56E0\uFF09" });
        return;
      }
      setState({ kind: "ok", rows: sanitizeRows(row2.rows) });
    }).catch((error) => {
      setState({ kind: "error", message: error instanceof Error ? error.message : String(error) });
    });
  }, []);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("p", { style: description, children: [
      "\u628A\u63D2\u4EF6\u5404\u5904\u72B6\u6001\u644A\u5E73\u6210\u4E00\u5F20\u8868\uFF1A\u8BBE\u7F6E\u5B57\u6BB5\u662F\u5426\u90FD\u5728\u5BBF\u4E3B schema \u91CC\uFF08\u4E0D\u5728\u7684\u8BDD\u5F00\u5173\u62E8\u4E0D\u52A8\uFF09\u3001 \u516B\u680F\u5F00\u5173\u3001\u7EC8\u7AEF\u66FF\u6362\u3001\u8BF7\u6C42\u5934\u8FD0\u884C\u671F\u8986\u76D6\u3001\u5FEB\u6377\u6307\u4EE4\u672C\u3001\u901A\u77E5\u51ED\u636E\u3001\u89E3\u91CA\u5C42\u6863\u4F4D\u3001\u8FD0\u884C\u73AF\u5883\u3002 \u8FD9\u4E9B\u90FD\u662F",
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: "\u53EA\u8BFB" }),
      "\u68C0\u67E5\uFF0C\u4E0D\u4F1A\u6539\u52A8\u4EFB\u4F55\u4E1C\u897F\u3002"
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { display: "flex", alignItems: "center", gap: 8, margin: "10px 0" }, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      "button",
      {
        type: "button",
        className: "dsh-ux-restartButton",
        disabled: state3.kind === "loading",
        onMouseDown: (event) => {
          event.preventDefault();
        },
        onClick: run,
        children: state3.kind === "loading" ? "\u81EA\u68C0\u4E2D\u2026" : "\u8FD0\u884C\u81EA\u68C0"
      }
    ) }),
    state3.kind === "error" && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("p", { style: optHint, children: [
      "\u81EA\u68C0\u5931\u8D25\uFF1A",
      state3.message
    ] }),
    state3.kind === "ok" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { children: state3.rows.map((row2) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", gap: 6, margin: "4px 0" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { "aria-hidden": true, style: { color: LEVEL_COLOR[row2.level], flex: "0 0 auto" }, children: LEVEL_MARK[row2.level] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { flex: "0 0 auto", color: LEVEL_COLOR[row2.level] }, children: row2.label }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { color: "var(--dsw-alias-label-secondary)", minWidth: 0 }, children: row2.detail })
    ] }, row2.id)) })
  ] });
}

// src/client/AutostartCard.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
function AutostartCard(props) {
  const { view } = props;
  const state3 = view.state;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("p", { style: description, children: [
      "\u6253\u5F00\u540E\uFF0C",
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: "\u767B\u5F55 Windows \u65F6\u81EA\u52A8\u628A DSH \u62C9\u8D77\u6765" }),
      "\u3002\u6CE8\u518C\u7684\u662F",
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: "\u5F53\u524D\u8FD9\u4E2A\u8FD0\u884C\u65F6" }),
      "\uFF1A\u5728\u7F51\u9875\u7248\u91CC\u6253\u5F00\u5C31\u6CE8\u518C\u7F51\u9875\u7248\uFF08\u7528\u5F53\u524D profile\u3001\u5F53\u524D\u8FD9\u6761\u542F\u52A8\u547D\u4EE4\uFF09\uFF0C \u5728\u684C\u9762\u5E94\u7528\u91CC\u6253\u5F00\u5C31\u6CE8\u518C\u684C\u9762\u5E94\u7528\u3002\u4E24\u4E2A\u8FD0\u884C\u65F6\u5404\u7528\u81EA\u5DF1\u90A3\u4E00\u6761\u542F\u52A8\u9879\uFF0C\u4E92\u4E0D\u8986\u76D6\u3002",
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("br", {}),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { style: { opacity: 0.75 }, children: [
        "\u53EA\u5199 `HKEY_CURRENT_USER\\...\\Run`\uFF08\u5F53\u524D\u7528\u6237\uFF0C",
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: "\u4E0D\u9700\u8981\u7BA1\u7406\u5458" }),
        "\uFF09\uFF1B\u5173\u6389\u5F00\u5173\u5C31\u662F\u5220\u6389\u81EA\u5DF1\u90A3\u4E00\u6761\u3002 \u72B6\u6001\u4EE5",
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("strong", { children: "\u7CFB\u7EDF\u91CC\u5B9E\u9645\u6709\u6CA1\u6709" }),
        "\u4E3A\u51C6 \u2014\u2014 \u4F60\u5728\u6CE8\u518C\u8868\u91CC\u624B\u52A8\u5220\u4E86\uFF0C\u8FD9\u91CC\u5C31\u663E\u793A\u5173\u3002"
      ] })
    ] }),
    state3 === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: optHint, children: view.error !== "" ? `\u8BFB\u4E0D\u5230\u542F\u52A8\u9879\u72B6\u6001\uFF1A${view.error}` : "\u6B63\u5728\u8BFB\u542F\u52A8\u9879\u72B6\u6001\u2026" }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { margin: "10px 0", fontSize: 12, lineHeight: 1.7 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { opacity: 0.7 }, children: "\u767B\u5F55\u540E\u4F1A\u6267\u884C\uFF1A" }),
        state3.describe === "" ? "\uFF08\u62FF\u4E0D\u5230\uFF0C\u89C1\u4E0B\u9762\u7684\u63D0\u793A\uFF09" : state3.describe
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { opacity: 0.7 }, children: "\u542F\u52A8\u9879\u503C\u540D\uFF1A" }),
        state3.entryName === "" ? "\uFF08\u62FF\u4E0D\u5230\uFF09" : state3.entryName
      ] }),
      state3.supported && state3.registeredValue !== "" && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { opacity: 0.7 }, children: "\u7CFB\u7EDF\u91CC\u73B0\u5728\u662F\uFF1A" }),
        state3.registeredValue
      ] }),
      !state3.supported && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { color: "#b26a00" }, children: "\u8FD9\u4E00\u680F\u53EA\u5728 Windows \u4E0A\u6709\u610F\u4E49\uFF0C\u5F53\u524D\u5E73\u53F0\u4E0D\u751F\u6548\u3002" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8, margin: "10px 0" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "button",
        {
          type: "button",
          className: "dsh-ux-restartButton",
          disabled: view.busy || state3 === void 0,
          onMouseDown: (event) => {
            event.preventDefault();
          },
          onClick: view.tryOnce,
          children: view.busy ? "\u5904\u7406\u4E2D\u2026" : "\u7ACB\u5373\u8BD5\u4E00\u6B21"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { fontSize: 12, opacity: 0.75 }, children: "\u7528\u81EA\u542F\u52A8\u90A3\u6761\u547D\u4EE4\u771F\u7684\u62C9\u4E00\u6B21\uFF08\u7F51\u9875\u7248\u4F1A\u6700\u5C0F\u5316\u5230\u4EFB\u52A1\u680F\uFF09\uFF0C\u9A8C\u8BC1\u5B83\u5728\u4F60\u8FD9\u53F0\u673A\u5668\u4E0A\u786E\u5B9E\u6709\u6548\u3002" })
    ] }),
    state3 !== void 0 && state3.note !== "" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: optHint, children: state3.note }),
    view.error !== "" && /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("p", { style: optHint, children: [
      "\u64CD\u4F5C\u5931\u8D25\uFF1A",
      view.error
    ] }),
    view.error === "" && view.message !== "" && /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { style: optHint, children: view.message })
  ] });
}

// src/client/autostart.ts
var import_react6 = require("react");
init_settings_contract();
var EMPTY = {
  supported: false,
  enabled: false,
  entryName: "",
  registeredValue: "",
  expectedValue: "",
  describe: "",
  note: ""
};
function sanitizeState(value) {
  if (typeof value !== "object" || value === null) return EMPTY;
  const row2 = value;
  const text = (key) => typeof row2[key] === "string" ? row2[key] : "";
  return {
    supported: row2.supported === true,
    enabled: row2.enabled === true,
    entryName: text("entryName"),
    registeredValue: text("registeredValue"),
    expectedValue: text("expectedValue"),
    describe: text("describe"),
    note: text("note")
  };
}
async function call(body) {
  try {
    const response = await fetch(AUTOSTART_API_PATH, {
      method: body === void 0 ? "GET" : "POST",
      headers: body === void 0 ? { accept: "application/json" } : { "content-type": "application/json" },
      ...body === void 0 ? {} : { body: JSON.stringify(body) }
    });
    const raw = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { state: EMPTY, message: "", error: `\u670D\u52A1\u7AEF\u8FD4\u56DE\u7684\u4E0D\u662F JSON\uFF08HTTP ${String(response.status)}\uFF09` };
    }
    const row2 = typeof parsed === "object" && parsed !== null ? parsed : {};
    return {
      state: sanitizeState(row2.state),
      message: typeof row2.message === "string" ? row2.message : "",
      error: row2.ok === true ? "" : typeof row2.error === "string" ? row2.error : "\u64CD\u4F5C\u5931\u8D25\uFF08\u6CA1\u6709\u539F\u56E0\uFF09"
    };
  } catch (error) {
    return { state: EMPTY, message: "", error: error instanceof Error ? error.message : String(error) };
  }
}
function useAutostart(onEnabledChange) {
  const [state3, setState] = (0, import_react6.useState)(void 0);
  const [busy, setBusy] = (0, import_react6.useState)(false);
  const [message, setMessage] = (0, import_react6.useState)("");
  const [error, setError] = (0, import_react6.useState)("");
  const apply2 = (0, import_react6.useCallback)((next) => {
    setState(next.state);
    setMessage(next.message);
    setError(next.error);
    onEnabledChange?.(next.state.enabled);
  }, [onEnabledChange]);
  const refresh = (0, import_react6.useCallback)(() => {
    setBusy(true);
    void call().then((result) => {
      apply2({ ...result, message: result.error === "" ? result.message : "" });
    }).finally(() => {
      setBusy(false);
    });
  }, [apply2]);
  const set = (0, import_react6.useCallback)((next) => {
    setBusy(true);
    setMessage(next ? "\u6B63\u5728\u6CE8\u518C\u2026" : "\u6B63\u5728\u64A4\u9500\u2026");
    void call({ enabled: next }).then((result) => {
      apply2(result);
    }).finally(() => {
      setBusy(false);
    });
  }, [apply2]);
  const tryOnce = (0, import_react6.useCallback)(() => {
    setBusy(true);
    void call({ action: "try" }).then((result) => {
      apply2(result);
    }).finally(() => {
      setBusy(false);
    });
  }, [apply2]);
  (0, import_react6.useEffect)(() => {
    refresh();
  }, [refresh]);
  return { state: state3, busy, message, error, set, refresh, tryOnce };
}

// src/client/SettingsSection.tsx
init_settings_contract();
init_nav_fold_store();
init_contracts();

// src/client/AddPromptRow.tsx
var import_react7 = require("react");
var import_jsx_runtime5 = require("react/jsx-runtime");
var rowBase = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  width: "100%",
  borderRadius: 8,
  border: "0.5px dashed var(--dsw-alias-border-l2)",
  background: "transparent",
  color: "var(--dsw-alias-label-tertiary)",
  cursor: "pointer",
  textAlign: "left"
};
var choiceBase = {
  padding: "4px 9px",
  borderRadius: 999,
  border: "0.5px solid var(--dsw-alias-border-l2)",
  background: "transparent",
  color: "var(--dsw-alias-label-primary)",
  fontSize: 11,
  lineHeight: 1.2,
  cursor: "pointer"
};
var candidateBase = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  width: "100%",
  padding: "4px 6px",
  borderRadius: 6,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  textAlign: "left"
};
function AddPromptRow({
  book,
  categoryId,
  onAdd,
  onMove,
  variant = "settings"
}) {
  const [mode, setMode] = (0, import_react7.useState)("closed");
  const ref = (0, import_react7.useRef)(null);
  (0, import_react7.useEffect)(() => {
    setMode("closed");
  }, [categoryId]);
  (0, import_react7.useEffect)(() => {
    if (mode === "closed") return;
    const onPointerDown = (event) => {
      if (ref.current !== null && event.target instanceof Node && ref.current.contains(event.target)) return;
      setMode("closed");
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setMode("closed");
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [mode]);
  const compact = variant === "panel";
  const candidates = mode === "move" ? promptsElsewhere(book, categoryId) : [];
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { ref, style: { display: "flex", flexDirection: "column", gap: 4 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "button",
      {
        type: "button",
        "aria-expanded": mode !== "closed",
        title: "\u65B0\u5EFA\u4E00\u6761\uFF0C\u6216\u628A\u522B\u7684\u5206\u7C7B\u91CC\u7684\u6761\u76EE\u79FB\u52A8\u5230\u8FD9\u91CC",
        style: {
          ...rowBase,
          padding: compact ? "4px 8px" : "7px 9px",
          fontSize: compact ? 11 : 12
        },
        onMouseDown: (event) => {
          event.preventDefault();
        },
        onClick: () => {
          setMode(mode === "closed" ? "choose" : "closed");
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { "aria-hidden": true, children: "\uFF0B" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: mode === "closed" ? "\u65B0\u5EFA / \u79FB\u52A8" : "\u6536\u8D77" })
        ]
      }
    ),
    mode !== "closed" && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "button",
        {
          type: "button",
          style: choiceBase,
          onMouseDown: (event) => {
            event.preventDefault();
          },
          onClick: () => {
            setMode("closed");
            onAdd();
          },
          children: "\uFF0B \u65B0\u5EFA\u4E00\u6761"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "button",
        {
          type: "button",
          style: mode === "move" ? { ...choiceBase, borderColor: "var(--dsw-alias-brand-primary)" } : choiceBase,
          onMouseDown: (event) => {
            event.preventDefault();
          },
          onClick: () => {
            setMode(mode === "move" ? "choose" : "move");
          },
          children: "\u2192 \u628A\u522B\u7684\u5206\u7C7B\u7684\u6761\u76EE\u79FB\u52A8\u5230\u8FD9\u91CC"
        }
      )
    ] }),
    mode === "move" && /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 2,
          maxHeight: 190,
          overflowY: "auto",
          border: "0.5px solid var(--dsw-alias-border-l2)",
          borderRadius: 8,
          padding: 4
        },
        children: [
          candidates.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { color: "var(--dsw-alias-label-tertiary)", fontSize: 11, padding: "4px 6px" }, children: "\u522B\u7684\u5206\u7C7B\u91CC\u8FD8\u6CA1\u6709\u6761\u76EE\u53EF\u4EE5\u79FB\u52A8\u3002" }),
          candidates.map((candidate) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
            "button",
            {
              type: "button",
              title: `${candidate.categoryName} \xB7 ${candidate.prompt.prompt}`,
              style: candidateBase,
              onMouseDown: (event) => {
                event.preventDefault();
              },
              onClick: () => {
                setMode("closed");
                onMove(candidate.prompt.id);
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { color: "var(--dsw-alias-label-tertiary)", fontSize: 11, flex: "0 0 auto" }, children: candidate.categoryName }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { color: "var(--dsw-alias-label-tertiary)", flex: "0 0 auto" }, children: "\xB7" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "span",
                  {
                    style: {
                      color: "var(--dsw-alias-label-primary)",
                      fontSize: 12,
                      minWidth: 0,
                      flex: "1 1 auto",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    },
                    children: candidate.prompt.label
                  }
                ),
                candidate.prompt.always && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { color: "var(--dsw-alias-label-tertiary)", fontSize: 10, flex: "0 0 auto" }, children: "\u9ED8\u8BA4\u63D2\u5165" })
              ]
            },
            candidate.prompt.id
          ))
        ]
      }
    )
  ] });
}

// src/client/CostCard.tsx
var import_react9 = __toESM(require("react"), 1);
init_pricing();
init_settings_contract();

// src/subscription-plans.ts
var QUOTA_WINDOW_LABEL = {
  rolling: "5 \u5C0F\u65F6",
  weekly: "\u672C\u5468",
  monthly: "\u672C\u6708"
};
function formatUsd(usd) {
  if (!Number.isFinite(usd) || usd <= 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

// src/client/CostCard.tsx
init_provider_prices();

// src/client/money-admin.ts
var import_react8 = __toESM(require("react"), 1);
init_settings_contract();

// src/balance.ts
var BALANCE_API_PATH = "/composer-ux/balance";

// src/client/money-admin.ts
function usePriceSync(onDone) {
  const [busy, setBusy] = import_react8.default.useState(null);
  const [note2, setNote] = import_react8.default.useState("");
  const [ok, setOk] = import_react8.default.useState(true);
  const alive = import_react8.default.useRef(true);
  const busyRef = import_react8.default.useRef(false);
  import_react8.default.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const sync = import_react8.default.useCallback((target) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(target);
    setNote(target === "official" ? "\u6B63\u5728\u6293\u5B98\u65B9\u4EF7\u683C\u9875\u2026" : target === "holidays" ? "\u6B63\u5728\u6293\u6CD5\u5B9A\u8282\u5047\u65E5\uFF08\u6BCF\u5E74\u4E00\u4E2A\u51E0 KB \u7684 JSON\uFF09\u2026" : "\u6B63\u5728\u6293 models.dev\uFF08\u7EA6 5 MB\uFF0C\u7A0D\u7B49\uFF09\u2026");
    setOk(true);
    void fetch(SYNC_API_PATH, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ target })
    }).then((response) => response.json()).then((next) => {
      if (!alive.current) return;
      setOk(next.ok === true);
      setNote(next.ok === true ? next.message ?? "\u540C\u6B65\u5B8C\u6210" : next.error ?? "\u540C\u6B65\u5931\u8D25\uFF08\u672C\u5730\u4EF7\u76EE\u672A\u6539\u52A8\uFF09");
      if (next.ok === true) onDone?.();
    }).catch((error) => {
      if (!alive.current) return;
      setOk(false);
      setNote(`\u540C\u6B65\u8BF7\u6C42\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`);
    }).finally(() => {
      busyRef.current = false;
      if (alive.current) setBusy(null);
    });
  }, [onDone]);
  return { busy, note: note2, ok, sync };
}
function useBalance(settings) {
  const enabled = settings.balanceEnabled === true;
  const [state3, setState] = import_react8.default.useState({ status: enabled ? "idle" : "off" });
  const [nonce, setNonce] = import_react8.default.useState(0);
  const alive = import_react8.default.useRef(true);
  import_react8.default.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  import_react8.default.useEffect(() => {
    if (!enabled) {
      setState({ status: "off" });
      return;
    }
    setState((current) => ({ ...current, status: "loading" }));
    void fetch(BALANCE_API_PATH, { headers: { accept: "application/json" } }).then((response) => response.json()).then((next) => {
      if (!alive.current) return;
      if (next.ok !== true) {
        setState({ status: "error", message: next.error ?? "\u67E5\u8BE2\u5931\u8D25" });
        return;
      }
      setState({
        status: "ok",
        available: next.available === true,
        entries: Array.isArray(next.entries) ? next.entries : [],
        ...next.message === void 0 ? {} : { message: next.message }
      });
    }).catch((error) => {
      if (!alive.current) return;
      setState({ status: "error", message: error instanceof Error ? error.message : String(error) });
    });
  }, [enabled, nonce]);
  return { ...state3, refresh: () => {
    setNonce((current) => current + 1);
  } };
}

// src/client/CostCard.tsx
var import_jsx_runtime6 = require("react/jsx-runtime");
var FIELD_LABELS = {
  miss: "\u672A\u7F13\u5B58\u8F93\u5165",
  hit: "\u7F13\u5B58\u547D\u4E2D",
  out: "\u8F93\u51FA"
};
var WRITE_DEBOUNCE_MS = 300;
function cellKey(key, peak, field) {
  return `${key}|${peak ? "peak" : "offPeak"}|${field}`;
}
function splitRowKey(key) {
  const at = key.indexOf(":");
  if (at <= 0) return { provider: "", model: key };
  return { provider: key.slice(0, at), model: key.slice(at + 1) };
}
function canonical(table) {
  if (table === void 0) return "";
  return Object.keys(table).sort().map((model) => {
    const entry = table[model] ?? {};
    const tiers = ["peak", "offPeak"].map((tierName) => {
      const tier = entry[tierName];
      if (tier === void 0) return "";
      return `${tierName}(${PRICE_FIELDS.map((field) => `${field}=${tier[field] ?? ""}`).join(",")})`;
    }).join("");
    return `${model}{${tiers}}`;
  }).join(";");
}
function aliasNote(model) {
  const aliases = Object.keys(MODEL_ALIASES).filter((alias) => MODEL_ALIASES[alias] === model);
  return aliases.length === 0 ? "" : ` \xB7 \u522B\u540D ${aliases.join(" / ")}`;
}
function stampText(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? new Date(value).toLocaleString("zh-CN") : "\u4ECE\u6CA1\u540C\u6B65\u8FC7";
}
function resetText(iso) {
  if (typeof iso !== "string" || iso === "") return "";
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "";
  const ms = at - Date.now();
  if (ms <= 0) return " \xB7 \u5373\u5C06\u91CD\u7F6E";
  const hours = Math.floor(ms / 36e5);
  if (hours < 1) return ` \xB7 ${Math.max(1, Math.round(ms / 6e4))} \u5206\u949F\u540E\u91CD\u7F6E`;
  if (hours < 48) return ` \xB7 ${hours} \u5C0F\u65F6\u540E\u91CD\u7F6E`;
  return ` \xB7 ${Math.round(hours / 24)} \u5929\u540E\u91CD\u7F6E`;
}
function usePlanQuota() {
  const [state3, setState] = import_react9.default.useState({ plans: [], error: "" });
  import_react9.default.useEffect(() => {
    let alive = true;
    const load = () => {
      void fetch(QUOTA_API_PATH, { headers: { accept: "application/json" } }).then((response) => response.json()).then((next) => {
        if (!alive) return;
        setState({
          plans: Array.isArray(next.plans) ? next.plans : [],
          error: next.ok === true ? "" : typeof next.error === "string" ? next.error : "\u53D6\u4E0D\u5230\u989D\u5EA6\u7A97\u53E3"
        });
      }).catch(() => {
        if (alive) setState((current) => ({ plans: current.plans, error: "\u53D6\u4E0D\u5230\u989D\u5EA6\u7A97\u53E3\uFF08\u7F51\u7EDC\u6216\u5BBF\u4E3B\u4E0D\u53EF\u8FBE\uFF09" }));
      });
    };
    load();
    const timer = setInterval(load, 6e4);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  return state3;
}
function QuotaBars(props) {
  const windows = props.plan.windows ?? [];
  if (windows.length === 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }, children: windows.map((window2) => {
    const percent = typeof window2.percent === "number" && Number.isFinite(window2.percent) ? Math.min(100, Math.max(0, window2.percent)) : 0;
    const id = window2.id ?? "weekly";
    const hot = percent >= 90;
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { width: 52, flex: "none", fontSize: 12, color: "var(--dsw-alias-label-tertiary)" }, children: QUOTA_WINDOW_LABEL[id] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: {
        flex: 1,
        height: 6,
        borderRadius: 3,
        background: "var(--dsw-alias-border-l2)",
        overflow: "hidden"
      }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: {
        display: "block",
        width: `${String(percent)}%`,
        height: "100%",
        borderRadius: 3,
        background: hot ? "var(--dsw-alias-label-error, #d33)" : "var(--dsw-alias-brand-primary)"
      } }) }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: {
        width: 130,
        flex: "none",
        textAlign: "right",
        fontSize: 12,
        fontVariantNumeric: "tabular-nums",
        color: hot ? "var(--dsw-alias-label-error, #d33)" : "var(--dsw-alias-label-secondary)"
      }, children: `${percent.toFixed(0)}%${resetText(window2.resetsAt)}` })
    ] }, id);
  }) });
}
function CostCardBody(props) {
  const { settings, setField, clearField } = props;
  const [table, setTable] = import_react9.default.useState(settings.priceOverrides);
  const [drafts, setDrafts] = import_react9.default.useState({});
  const [invalid, setInvalid] = import_react9.default.useState({});
  const [name2, setName] = import_react9.default.useState("");
  const [addNote, setAddNote] = import_react9.default.useState("");
  const [pending, setPending] = import_react9.default.useState([]);
  const [holidayText, setHolidayText] = import_react9.default.useState(() => (settings.peakHolidays ?? []).join("\n"));
  const [holidayNote, setHolidayNote] = import_react9.default.useState("");
  const lastWritten = import_react9.default.useRef(settings.priceOverrides);
  const tableRef = import_react9.default.useRef(table);
  const timer = import_react9.default.useRef(null);
  tableRef.current = table;
  const sync = usePriceSync();
  const balance = useBalance(settings);
  const syncedEras = settings.syncedPrices?.eras;
  import_react9.default.useEffect(() => {
    if (canonical(settings.priceOverrides) === canonical(lastWritten.current)) return;
    lastWritten.current = settings.priceOverrides;
    tableRef.current = settings.priceOverrides;
    setTable(settings.priceOverrides);
  }, [settings.priceOverrides]);
  const savedHolidayText = (settings.peakHolidays ?? []).join("\n");
  import_react9.default.useEffect(() => {
    setHolidayText(savedHolidayText);
  }, [savedHolidayText]);
  import_react9.default.useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);
  const commit = (next) => {
    tableRef.current = next;
    lastWritten.current = next;
    setTable(next);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      if (next === void 0) clearField(PRICE_OVERRIDES_FIELD);
      else setField(PRICE_OVERRIDES_FIELD, next);
    }, WRITE_DEBOUNCE_MS);
  };
  const valueOf = (key, peak, field) => {
    const draft = drafts[cellKey(key, peak, field)];
    if (draft !== void 0) return draft;
    const { provider, model } = splitRowKey(key);
    const flat = !isDeepSeekRoute(provider, model);
    const value = overrideValueOf(table, model, peak, field, provider) ?? (flat ? overrideValueOf(table, model, true, field, provider) : void 0);
    return value === void 0 ? "" : String(value);
  };
  const commitCell = (key, peak, field, text) => {
    const cell = cellKey(key, peak, field);
    const parsed = parsePriceText(text);
    if (parsed.kind === "invalid") {
      setDrafts((current) => ({ ...current, [cell]: text }));
      setInvalid((current) => ({ ...current, [cell]: true }));
      return;
    }
    setDrafts((current) => {
      const next2 = { ...current };
      delete next2[cell];
      return next2;
    });
    setInvalid((current) => {
      const next2 = { ...current };
      delete next2[cell];
      return next2;
    });
    const { provider, model } = splitRowKey(key);
    const flat = !isDeepSeekRoute(provider, model);
    let next = withOverrideValue(
      tableRef.current,
      model,
      peak,
      field,
      parsed.kind === "empty" ? void 0 : parsed.value,
      provider === "" ? void 0 : provider
    );
    if (flat && parsed.kind === "empty") {
      for (const stale of PRICE_FIELDS) {
        next = withOverrideValue(next, model, true, stale, void 0, provider === "" ? void 0 : provider);
      }
    }
    commit(next);
    setPending((current) => current.filter((item) => item !== key));
  };
  const addModel = () => {
    const trimmed = name2.trim().toLowerCase();
    setName("");
    if (trimmed === "") {
      setAddNote("\u5148\u5199\u4E00\u4E2A\u6A21\u578B\u540D");
      return;
    }
    if (isKnownModel(trimmed)) {
      setAddNote(`\u300C${trimmed}\u300D\u5DF2\u5728\u4E0B\u9762\u7684\u5185\u7F6E\u4EF7\u8868\u91CC\uFF08\u522B\u540D\u7B97\u540C\u4E00\u4E2A\u6A21\u578B\uFF09\uFF0C\u76F4\u63A5\u6539\u90A3\u4E00\u884C\u5373\u53EF`);
      return;
    }
    if (customPricingModels(table).includes(trimmed) || pending.includes(trimmed)) {
      setAddNote(`\u300C${trimmed}\u300D\u5DF2\u7ECF\u6709\u4E00\u884C\u4E86`);
      return;
    }
    setAddNote("");
    setPending((current) => [...current, trimmed]);
  };
  const removeModel = (key) => {
    setPending((current) => current.filter((item) => item !== key));
    setDrafts((current) => {
      const next = {};
      for (const cell of Object.keys(current)) {
        if (!cell.startsWith(`${key}|`)) next[cell] = current[cell];
      }
      return next;
    });
    const { provider, model } = splitRowKey(key);
    commit(withoutPricingModel(tableRef.current, model, provider === "" ? void 0 : provider));
  };
  const rows = [
    ...BUILTIN_PRICING_MODELS,
    ...customPricingModels(table).filter((model) => !BUILTIN_PRICING_MODELS.includes(model)),
    ...pending
  ];
  const anyOverride = rows.some((key) => PRICE_FIELDS.some((field) => overrideValueOf(table, splitRowKey(key).model, true, field, splitRowKey(key).provider) !== void 0 || overrideValueOf(table, splitRowKey(key).model, false, field, splitRowKey(key).provider) !== void 0));
  const saveHolidays = () => {
    const lines = holidayText.split(/[\s,;]+/).map((item) => item.trim()).filter((item) => item.length > 0);
    const bad = lines.filter((item) => !isDayKey(item));
    if (bad.length > 0) {
      setHolidayNote(`\u8FD9\u4E9B\u4E0D\u662F\u5408\u6CD5\u65E5\u671F\uFF08\u8981 YYYY-MM-DD\uFF0C\u4F8B\u5982 2026-10-01\uFF09\uFF1A${bad.slice(0, 4).join("\u3001")}`);
      return;
    }
    if (lines.length === 0) {
      clearField(PEAK_HOLIDAYS_FIELD);
      setHolidayNote("\u5DF2\u6E05\u7A7A = \u7528\u5185\u7F6E\u90A3\u4EFD\u8282\u5047\u65E5\u8868");
      return;
    }
    const dates = [...new Set(lines)].sort();
    setField(PEAK_HOLIDAYS_FIELD, dates);
    setHolidayNote(`\u5DF2\u4FDD\u5B58 ${dates.length} \u4E2A\u65E5\u671F\uFF08\u547D\u4E2D\u7684\u4E00\u5929\u5168\u5929\u6309\u8C37\u4EF7\uFF09`);
  };
  const synced = settings.syncedPrices;
  const alert = settings.peakAlert;
  const holidayInfo = effectiveHolidays(settings.peakHolidays, synced?.holidays);
  const quota = usePlanQuota();
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { children: [
    quota.plans.length > 0 || quota.error !== "" ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: {
      marginBottom: 12,
      padding: "10px 12px",
      border: "0.5px solid var(--dsw-alias-border-l2)",
      borderRadius: 8
    }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { style: { fontSize: 12.5 }, children: "\u8BA2\u9605\u989D\u5EA6" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { fontSize: 11.5, color: "var(--dsw-alias-label-tertiary)" }, children: quota.error !== "" ? quota.error : "\u6BCF 60 \u79D2\u5237\u65B0" })
      ] }),
      quota.plans.map((plan) => {
        const status = plan.status ?? "pending";
        const fee = typeof plan.monthlyFeeUsd === "number" && plan.monthlyFeeUsd > 0 ? ` \xB7 $${String(plan.monthlyFeeUsd)}/\u6708` : "";
        return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { marginTop: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary)" }, children: [
            plan.displayName ?? plan.provider ?? "\u8BA2\u9605\u5957\u9910",
            fee,
            status === "pending" ? " \xB7 \u6B63\u5728\u53D6\u989D\u5EA6\u2026" : ""
          ] }),
          status === "ok" ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(QuotaBars, { plan }) : null,
          status !== "ok" && status !== "pending" ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { style: { ...hintInfo, marginTop: 6 }, children: status === "not-configured" ? `\u6CA1\u627E\u5230\u8FD9\u628A key\uFF1A\u5728\u51ED\u636E\u91CC\u914D\u4E0A ${(plan.keyRefs ?? []).join(" \u6216 ")}\uFF08\u4E0E\u6A21\u578B\u8DEF\u7531\u91CC apiKeyEnv \u7684\u5199\u6CD5\u4E00\u81F4\uFF09\u5C31\u80FD\u770B\u5230\u989D\u5EA6\u3002` : `\u989D\u5EA6\u7A97\u53E3\u53D6\u4E0D\u5230\uFF1A${plan.reason === void 0 || plan.reason === "" ? status : plan.reason}` }) : null
        ] }, plan.provider ?? plan.displayName ?? "plan");
      }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("p", { style: { ...hintInfo, marginTop: 8 }, children: [
        "\u8BA2\u9605\u901A\u9053\uFF08OpenCode Go \u8FD9\u7C7B\u300C\u6708\u8D39 + \u989D\u5EA6\u300D\uFF09",
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: "\u5355\u6B21\u8C03\u7528\u4E0D\u6263\u94B1\u3001\u6263\u989D\u5EA6" }),
        "\uFF1A\u91D1\u989D\u80F6\u56CA\u4E0A\u663E\u793A\u7684 \u90A3\u4E2A $ \u5C31\u662F\u672C\u4F1A\u8BDD\u5403\u6389\u7684\u989D\u5EA6\uFF08\u542B\u5B50\u4EE3\u7406\uFF09\uFF1B\u4E0B\u9762\u300C\u5355\u4EF7\u300D\u90A3\u5F20\u8868\u662F\u53E6\u4E00\u5957\u53E3\u5F84 \u2014\u2014 \u8FD9\u4E9B token \u6309\u5B98\u65B9\u520A\u4F8B\u4EF7\u6298\u7B97\u503C\u591A\u5C11\u94B1\uFF0C\u4E24\u8005\u4E0D\u51B2\u7A81\u3001\u4E5F\u4E0D\u8981\u76F8\u52A0\u3002"
      ] })
    ] }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("p", { style: hintInfo, children: [
      "\u8FD9\u91CC\u6539\u7684",
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: "\u53EA\u662F\u672C\u63D2\u4EF6\u663E\u793A\u7684\u8D39\u7528\u4F30\u7B97" }),
      "\uFF1A\u4E0D\u52A8 DSH \u7684\u8BA1\u8D39\uFF0C\u4E5F\u4E0D\u6539\u6A21\u578B\u8BF7\u6C42\u3002",
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: "\u7559\u7A7A\uFF1D\u6CBF\u7528\u5B98\u65B9\u4EF7" }),
      "\uFF08\u8F93\u5165\u6846\u91CC\u7684\u7070\u5B57\u5C31\u662F\u5B98\u65B9\u4EF7\uFF09\uFF0C\u586B\u4E86\u624D\u7B97\u8986\u76D6\u3002 \u5355\u4F4D\u662F",
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: "\u5143 / 1M tokens" }),
      "\uFF1BDeepSeek \u9AD8\u5CF0\u4EF7\u662F\u7A7A\u95F2\u4EF7\u7684 2 \u500D\u3002"
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { ...row, alignItems: "flex-start", marginTop: 6 }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: rowText, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: rowTitle, children: "\u8BA1\u4EF7\u8BF4\u660E" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: rowDesc, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: "\u520A\u4F8B\u4EF7\u5FEB\u7167\uFF1A" }),
        PRICE_VERIFIED_AT,
        "\uFF08\u5B98\u65B9\u4EF7\u683C\u9875\u7684\u6838\u5BF9\u65E5\u671F\uFF1B\u4F60\u586B\u4E86\u8986\u76D6\u4EF7\u5C31\u4EE5\u4F60\u586B\u7684\u4E3A\u51C6\uFF09\u3002",
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("br", {}),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: "\u4EF7\u683C\u6863\uFF1A" }),
        "\u6309\u6BCF\u7B14\u7528\u91CF",
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: "\u53D1\u751F\u65F6\u523B" }),
        '\u751F\u6548\u7684\u6863\u7ED3\u7B97 \u2014\u2014 \u5B98\u65B9 2026-09-10 \u8C03\u8FC7\u4E00\u6B21 Flash \u7684\u4EF7\uFF0C\u6240\u4EE5 8 \u6708\u8DD1\u7684\u4F1A\u8BDD\u6C38\u8FDC\u6309 8 \u6708\u7684\u4EF7\u7B97\uFF0C\u4E0D\u4F1A\u56E0\u4E3A\u4F60\u4ECA\u5929 \u540C\u6B65\u4E86\u65B0\u4EF7\u800C\u53D8\u3002\u8DE8\u4E86\u6863\u7684\u4F1A\u8BDD\u5728\u91D1\u989D\u80F6\u56CA\u91CC\u4F1A\u591A\u4E00\u884C"\u6309\u5404\u81EA\u53D1\u751F\u65F6\u523B"\u7684\u8BF4\u660E\u3002',
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("br", {}),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: "\u5CF0\u8C37\uFF1A" }),
        "\u5317\u4EAC\u65F6\u95F4\u5DE5\u4F5C\u65E5 09:00\u201312:00\u300114:00\u201318:00 \u4E3A\u9AD8\u5CF0\uFF08",
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: "\u4E0D\u542B\u6CD5\u5B9A\u8282\u5047\u65E5" }),
        "\uFF09\uFF1B\u5468\u672B\u4E0E\u6CD5\u5B9A\u8282\u5047\u65E5",
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: "\u5168\u5929\u8C37\u4EF7" }),
        "\u3002",
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("br", {}),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: "\u975E DeepSeek\uFF1A" }),
        "\u6309\u540C\u6B65\u6765\u7684\u7B2C\u4E09\u65B9\u4EF7\u76EE\u7B97\uFF0C\u672A\u542B\u4E2D\u8F6C\u52A0\u4EF7\uFF0C",
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: "\u5B9E\u9645\u6263\u8D39\u4EE5\u5404\u5BB6\u8D26\u5355\u4E3A\u51C6" }),
        "\uFF1B\u4EF7\u76EE\u91CC\u6CA1\u6709\u7684\u6A21\u578B\u4F1A\u663E\u793A\u300C\u672A\u5B9A\u4EF7\u300D\uFF08\u6309 0 \u8BA1\uFF09\uFF0C \u70B9\u4E0B\u9762\u300C\u540C\u6B65\u7B2C\u4E09\u65B9\u4EF7\u76EE\u300D\u6216\u76F4\u63A5\u7ED9\u90A3\u4E00\u884C\u586B\u4EF7\u5373\u53EF\u3002"
      ] })
    ] }) }),
    rows.map((key) => {
      const builtin = BUILTIN_PRICING_MODELS.includes(key);
      const { provider, model } = splitRowKey(key);
      const twoTier = isDeepSeekRoute(provider, model);
      return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { ...row, alignItems: "flex-start", flexWrap: "wrap" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: rowText, children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: rowTitle, children: [
            key,
            builtin ? aliasNote(model) : ""
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: rowDesc, children: twoTier ? builtin ? "DeepSeek \u520A\u4F8B\u4EF7\uFF08\u5CF0\u8C37\u4E24\u6863\uFF09" : "DeepSeek \u7CFB\u6A21\u578B\uFF08\u5CF0\u8C37\u4E24\u6863\uFF09" : '\u5E73\u5766\u4EF7\uFF08\u7B2C\u4E09\u65B9\u6A21\u578B\u6CA1\u6709\u5CF0\u8C37\u4E24\u6863\uFF1B\u4E0D\u586B\u5C31\u6309\u540C\u6B65\u6765\u7684\u4EF7\u76EE\u7B97\uFF0C\u8BA4\u4E0D\u51FA\u4F1A\u5199"\u672A\u5B9A\u4EF7"\uFF09' })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { display: "flex", gap: 14, flexWrap: "wrap" }, children: (twoTier ? [true, false] : [false]).map((peak) => {
          const official = officialTripleOf(model, peak, syncedEras === void 0 ? {} : { eras: syncedEras });
          return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "grid", gap: 2 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { style: { color: "var(--dsw-alias-label-tertiary)" }, children: [
              twoTier ? peak ? "\u9AD8\u5CF0" : "\u7A7A\u95F2" : "\u5E73\u5766\u4EF7",
              "\uFF08\u5143 / 1M\uFF09"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: { display: "flex", gap: 6 }, children: PRICE_FIELDS.map((field) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("label", { style: { display: "grid", gap: 2 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { color: "var(--dsw-alias-label-tertiary)", fontSize: 11 }, children: FIELD_LABELS[field] }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                "input",
                {
                  type: "text",
                  inputMode: "decimal",
                  "aria-label": `${key} ${twoTier ? peak ? "\u9AD8\u5CF0" : "\u7A7A\u95F2" : "\u5E73\u5766"} ${FIELD_LABELS[field]}\u5355\u4EF7`,
                  placeholder: twoTier ? String(official[field]) : "",
                  value: valueOf(key, peak, field),
                  onChange: (event) => {
                    const text = event.target.value;
                    setDrafts((current) => ({ ...current, [cellKey(key, peak, field)]: text }));
                    setInvalid((current) => {
                      const next = { ...current };
                      delete next[cellKey(key, peak, field)];
                      return next;
                    });
                  },
                  onBlur: (event) => {
                    commitCell(key, peak, field, event.target.value);
                  },
                  onKeyDown: (event) => {
                    if (event.key === "Enter") commitCell(key, peak, field, event.currentTarget.value);
                  },
                  style: {
                    ...textInput,
                    width: 92,
                    flex: "none",
                    ...invalid[cellKey(key, peak, field)] === true ? { borderColor: "var(--dsw-alias-state-error-primary)" } : {}
                  }
                }
              )
            ] }, field)) })
          ] }, peak ? "peak" : "offPeak");
        }) }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "button",
          {
            type: "button",
            style: pill,
            title: builtin ? "\u628A\u8FD9\u4E00\u884C\u6539\u56DE\u5B98\u65B9\u520A\u4F8B\u4EF7" : "\u5220\u6389\u8FD9\u4E00\u884C",
            onClick: () => {
              removeModel(key);
            },
            children: builtin ? "\u6062\u590D\u5B98\u65B9\u4EF7" : "\u5220\u9664"
          }
        )
      ] }, key);
    }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { ...row, alignItems: "center", flexWrap: "wrap" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: rowText, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: rowTitle, children: "\u518D\u52A0\u4E00\u4E2A\u6A21\u578B" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: rowDesc, children: [
          "\u4E2D\u8F6C / \u81EA\u5EFA\u8DEF\u7531\u7684\u6A21\u578B\u540D\u90FD\u884C\uFF08\u4F8B\u5982 my-relay-v1\uFF09\uFF1B\u540C\u540D\u6A21\u578B\u5728\u4E0D\u540C\u6E20\u9053\u4EF7\u4E0D\u540C\u65F6\uFF0C \u5199\u6210 ",
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("code", { children: "provider:model" }),
          "\uFF08\u4F8B\u5982 opencode:gpt-5.6-luna\uFF09\u3002"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "input",
        {
          type: "text",
          style: { ...textInput, width: 220, flex: "none" },
          placeholder: "\u6A21\u578B\u540D\uFF08\u4E0E DSH \u91CC\u663E\u793A\u7684\u5B8C\u5168\u4E00\u81F4\uFF09",
          value: name2,
          "aria-label": "\u8981\u65B0\u589E\u7684\u6A21\u578B\u540D",
          onChange: (event) => {
            setName(event.target.value);
            setAddNote("");
          },
          onKeyDown: (event) => {
            if (event.key === "Enter") addModel();
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", style: pill, onClick: addModel, children: "\u6DFB\u52A0" })
    ] }),
    addNote !== "" && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { style: hintError, children: addNote }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { ...row, alignItems: "flex-start", flexWrap: "wrap", marginTop: 6 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: rowText, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: rowTitle, children: "\u6CD5\u5B9A\u8282\u5047\u65E5\uFF08\u5317\u4EAC\u65E5\u671F\uFF0C\u4E00\u884C\u4E00\u4E2A\uFF09" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: rowDesc, children: [
          "\u547D\u4E2D\u7684\u4E00\u5929",
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: "\u5168\u5929\u6309\u8C37\u4EF7" }),
          "\u3002\u5B98\u65B9\u89C4\u5219\u628A\u4E2D\u56FD\u6CD5\u5B9A\u8282\u5047\u65E5\u6392\u9664\u5728\u9AD8\u5CF0\u4E4B\u5916\uFF0C \u4E0D\u7B97\u7684\u8BDD\u56FD\u5E86\u90A3\u79CD\u65E5\u5B50\u4F1A\u628A\u5DE5\u4F5C\u65E5\u7684\u9AD8\u5CF0\u4E24\u6BB5\u6309\u5CF0\u4EF7\u7B97\u2014\u2014",
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: "\u6574\u6574 2 \u500D" }),
          "\u3002",
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("br", {}),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: "\u7559\u7A7A = \u7528\u81EA\u52A8\u83B7\u53D6\u7684\u90A3\u4EFD" }),
          "\uFF08",
          HOLIDAY_SOURCE_LABEL,
          '\uFF0C\u6BCF\u6B21\u53D6"\u4ECA\u5E74 + \u660E\u5E74"\uFF0C\u56FD\u52A1\u9662\u5E74\u5E95\u4E00\u516C\u5E03\u6B21\u5E74\u5B89\u6392\u5C31\u4F1A\u88AB\u53D6\u56DE\uFF09\uFF1B\u6CA1\u53D6\u5230\u8FC7\u5C31\u7528',
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: "\u5185\u7F6E" }),
          "\u90A3\u4EFD \uFF082026 \u4E2D\u79CB 09-25\uFF5E27\u3001\u56FD\u5E86 10-01\uFF5E07\uFF09\u3002\u8FD9\u91CC\u586B\u4E86\u5219",
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: "\u6574\u4EFD\u8986\u76D6" }),
          "\u81EA\u52A8\u83B7\u53D6\u4E0E\u5185\u7F6E\u90A3\u4E24\u4EFD\u3002",
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("br", {}),
          "\u6CE8\uFF1A",
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: "\u8C03\u4F11\u8865\u73ED\u7684\u5468\u672B\u4ECD\u6309\u8C37\u4EF7" }),
          '\uFF08\u5B98\u65B9\u8BF4\u7684\u662F"\u5468\u516D\u3001\u5468\u65E5\u5168\u5929\u8C37\u4EF7"\uFF0C 2026-10-10 \u90A3\u4E2A\u5468\u516D\u4E5F\u7B97\u8C37\u4EF7\uFF09\uFF0C\u6240\u4EE5\u81EA\u52A8\u83B7\u53D6\u53EA\u6536"\u653E\u5047"\u7684\u90A3\u51E0\u5929\u3002'
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "textarea",
        {
          style: { ...textInput, width: 260, height: 96, flex: "none", fontFamily: "monospace" },
          "aria-label": "\u6CD5\u5B9A\u8282\u5047\u65E5\u65E5\u671F\u8868",
          placeholder: "\u7559\u7A7A = \u7528\u81EA\u52A8\u83B7\u53D6\u7684\u90A3\u4EFD\uFF08\u6CA1\u53D6\u5230\u5C31\u7528\u5185\u7F6E\uFF09",
          value: holidayText,
          onChange: (event) => setHolidayText(event.target.value),
          spellCheck: false
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", style: pill, onClick: saveHolidays, children: "\u4FDD\u5B58" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "button",
          {
            type: "button",
            style: pill,
            onClick: () => {
              clearField(PEAK_HOLIDAYS_FIELD);
              setHolidayNote("\u5DF2\u6E05\u7A7A = \u7528\u81EA\u52A8\u83B7\u53D6\u7684\u90A3\u4EFD\u8282\u5047\u65E5\u8868");
            },
            children: "\u6062\u590D\u9ED8\u8BA4"
          }
        )
      ] })
    ] }),
    holidayNote !== "" && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { style: hintInfo, children: holidayNote }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("p", { style: hintInfo, children: [
      "\u5F53\u524D\u751F\u6548\uFF1A",
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("strong", { children: [
        holidayInfo.days.length,
        " \u4E2A\u65E5\u671F"
      ] }),
      " \u2014\u2014 \u6765\u6E90\uFF1A",
      holidayInfo.source === "manual" ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
        "\u4F60\u4E0A\u9762\u586B\u7684\u90A3\u4EFD\uFF08\u81EA\u5B9A\u4E49\uFF1B\u81EA\u52A8\u83B7\u53D6\u90A3\u4EFD\u6709 ",
        holidayInfo.autoCount,
        " \u4E2A\u65E5\u671F\uFF0C\u73B0\u5728\u4E0D\u53C2\u4E0E\uFF09"
      ] }) : holidayInfo.source === "auto" ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
        "\u81EA\u52A8\u83B7\u53D6\uFF08",
        stampText(synced?.holidaysAt),
        "\uFF0C\u5171 ",
        holidayInfo.autoCount,
        " \u4E2A\u65E5\u671F\uFF1B \u4E0E\u5185\u7F6E\u8868\u53D6\u5E76\u96C6\u540E\u662F ",
        holidayInfo.days.length,
        " \u4E2A\uFF09"
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_jsx_runtime6.Fragment, { children: "\u5185\u7F6E\uFF08\u56FD\u52A1\u9662\u529E\u516C\u5385 2026 \u5E74\u5B89\u6392\uFF09" }),
      holidayInfo.source !== "manual" && settings.priceAutoSync !== true ? "\uFF1B\u6253\u5F00\u4E0B\u9762\u300C\u540C\u6B65\u4EF7\u76EE\u300D\u91CC\u7684\u81EA\u52A8\u540C\u6B65\u540E\uFF0C\u63D2\u4EF6\u4F1A\u81EA\u5DF1\u53D6\u6B21\u5E74\u5B89\u6392" : ""
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("details", { style: { ...rowDesc, cursor: "pointer" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("summary", { children: "\u770B\u5F53\u524D\u751F\u6548\u7684\u65E5\u671F" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { fontFamily: "monospace", wordBreak: "break-all" }, children: holidayInfo.days.join("\u3001") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { ...row, alignItems: "flex-start", flexWrap: "wrap", marginTop: 6 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: rowText, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: rowTitle, children: "\u5CF0\u8C37\u63D0\u9192" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: rowDesc, children: '\u660E\u7EC6\u9875\u4F1A\u5E38\u663E"\u73B0\u5728\u54EA\u4E00\u6863\u3001\u8FD8\u6709\u591A\u4E45\u5207\u6362"\u3002\u52FE\u4E0A\u7CFB\u7EDF\u901A\u77E5\u540E\uFF0C\u5207\u6362\u524D\u4F1A\u989D\u5916\u5F39\u4E00\u6761 \u6D4F\u89C8\u5668\u901A\u77E5\uFF08\u9700\u8981\u6388\u6743\uFF09\u2014\u2014\u4E0D\u6025\u7684\u6D3B\u53EF\u4EE5\u7B49\u5230\u8C37\u4EF7\u518D\u8DD1\u3002' })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("label", { style: { display: "flex", gap: 6, alignItems: "center" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "input",
            {
              type: "checkbox",
              checked: alert.enabled,
              "aria-label": "\u542F\u7528\u5CF0\u8C37\u63D0\u9192",
              onChange: (event) => setField(PEAK_ALERT_FIELD, { ...alert, enabled: event.target.checked })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: "\u542F\u7528" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("label", { style: { display: "flex", gap: 6, alignItems: "center" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: "\u63D0\u524D" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "input",
            {
              type: "text",
              inputMode: "numeric",
              style: { ...textInput, width: 56, flex: "none" },
              "aria-label": "\u63D0\u524D\u591A\u5C11\u5206\u949F\u63D0\u9192",
              value: String(alert.aheadMinutes),
              onChange: (event) => {
                const value = Number(event.target.value.trim());
                if (!Number.isFinite(value)) return;
                setField(PEAK_ALERT_FIELD, { ...alert, aheadMinutes: Math.min(60, Math.max(1, Math.round(value))) });
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: "\u5206\u949F" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("label", { style: { display: "flex", gap: 6, alignItems: "center" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "input",
            {
              type: "checkbox",
              checked: alert.onPeak,
              "aria-label": "\u8FDB\u5165\u9AD8\u5CF0\u524D\u63D0\u9192",
              onChange: (event) => setField(PEAK_ALERT_FIELD, { ...alert, onPeak: event.target.checked })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: "\u8FDB\u5CF0\u524D" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("label", { style: { display: "flex", gap: 6, alignItems: "center" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "input",
            {
              type: "checkbox",
              checked: alert.onOffPeak,
              "aria-label": "\u79BB\u5F00\u9AD8\u5CF0\u524D\u63D0\u9192",
              onChange: (event) => setField(PEAK_ALERT_FIELD, { ...alert, onOffPeak: event.target.checked })
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: "\u79BB\u5CF0\u524D" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("label", { style: { display: "flex", gap: 6, alignItems: "center" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "input",
            {
              type: "checkbox",
              checked: alert.webNotify,
              "aria-label": "\u989D\u5916\u53D1\u6D4F\u89C8\u5668\u901A\u77E5",
              onChange: (event) => {
                const wanted = event.target.checked;
                if (wanted && typeof Notification !== "undefined" && Notification.permission === "default") {
                  void Notification.requestPermission();
                }
                setField(PEAK_ALERT_FIELD, { ...alert, webNotify: wanted });
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: "\u7CFB\u7EDF\u901A\u77E5" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { ...row, alignItems: "flex-start", flexWrap: "wrap", marginTop: 6 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: rowText, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: rowTitle, children: "\u8D26\u53F7\u4F59\u989D" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { role: "note", style: rowDesc, children: [
          "\u67E5 DeepSeek \u5B98\u65B9\u4F59\u989D\u63A5\u53E3\uFF08",
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("code", { children: "GET /user/balance" }),
          "\uFF09\u3002",
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: "API Key \u53EA\u5728\u5BBF\u4E3B\u534A\u8BFB\u53D6" }),
          "\uFF0C\u6D4F\u89C8\u5668\u62FF\u4E0D\u5230\uFF1B\u5BBF\u4E3B\u53EA\u653E\u884C",
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("code", { children: "api.deepseek.com" }),
          "\uFF0C\u4F60\u7684 baseURL \u88AB\u6307\u5411\u7B2C\u4E09\u65B9\u65F6\u4E0D\u4F1A\u628A Key \u53D1\u51FA\u53BB\u3002"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("label", { style: { display: "flex", gap: 6, alignItems: "center" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "input",
            {
              type: "checkbox",
              checked: settings.balanceEnabled,
              "aria-label": "\u542F\u7528\u4F59\u989D\u67E5\u8BE2",
              onChange: (event) => setField(BALANCE_ENABLED_FIELD, event.target.checked)
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: "\u542F\u7528" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", style: pill, onClick: balance.refresh, disabled: !settings.balanceEnabled, children: "\u5237\u65B0" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { color: "var(--dsw-alias-label-secondary)" }, children: balance.status === "off" ? "\u5DF2\u5173\u95ED\uFF08\u4E0D\u4F1A\u53D1\u51FA\u4EFB\u4F55\u8BF7\u6C42\uFF09" : balance.status === "loading" ? "\u67E5\u8BE2\u4E2D\u2026" : balance.status === "error" ? `\u67E5\u8BE2\u5931\u8D25\uFF1A${balance.message ?? ""}` : balance.status === "ok" ? (balance.entries ?? []).length === 0 ? "\u63A5\u53E3\u6CA1\u6709\u8FD4\u56DE\u4F59\u989D\u6761\u76EE" : (balance.entries ?? []).map((entry) => `${entry.currency ?? "?"} ${entry.total ?? 0}\uFF08\u8D60\u9001 ${entry.granted ?? 0} + \u5145\u503C ${entry.toppedUp ?? 0}\uFF09`).join(" \xB7 ") : "\u8FD8\u6CA1\u67E5\u8FC7" })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { ...row, alignItems: "flex-start", flexWrap: "wrap", marginTop: 6 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: rowText, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { style: rowTitle, children: "\u540C\u6B65" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: rowDesc, children: [
          "\u300C\u5B98\u65B9\u4EF7\u300D\u6293\u5B98\u65B9\u4EF7\u683C\u9875\u4E24\u9875\uFF08\u7EA6 24 KB\uFF09\uFF1A",
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: "\u6709\u53D8\u5316\u624D\u65B0\u589E\u4E00\u4E2A\u4EF7\u683C\u6863" }),
          "\uFF0C \u5386\u53F2\u7528\u91CF\u4ECD\u6309\u53D1\u751F\u65F6\u523B\u7684\u65E7\u6863\u7ED3\u7B97\u3002\u300C\u7B2C\u4E09\u65B9\u4EF7\u76EE\u300D\u6293 models.dev\uFF08\u7EA6 5 MB\uFF0C \u538B\u7F29\u540E\u7EA6 450 KB \u843D\u76D8\uFF09\uFF0C\u7ED9\u975E DeepSeek \u6A21\u578B\u7528\u3002\u300C\u6CD5\u5B9A\u8282\u5047\u65E5\u300D\u6293",
          HOLIDAY_SOURCE_LABEL,
          '\uFF08\u6BCF\u5E74\u4E00\u4E2A\u51E0 KB \u7684 JSON\uFF0C\u53EA\u6536"\u653E\u5047"\u90A3\u51E0\u5929\uFF09\u3002',
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: "\u4E09\u4E2A\u90FD\u662F\u6293\u5931\u8D25\u4E0D\u4F1A\u8986\u76D6\u672C\u5730\u6570\u636E\u3002" }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("br", {}),
          "\u6CA1\u70B9\u8FC7\u300C\u540C\u6B65\u7B2C\u4E09\u65B9\u4EF7\u76EE\u300D\u65F6\uFF0C\u975E DeepSeek \u6A21\u578B\u4F1A\u7528",
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: "\u5185\u7F6E\u5FEB\u7167\u4EF7" }),
          "\uFF08models.dev \u5FEB\u7167 ",
          PROVIDER_PRICES_SNAPSHOT_AT,
          "\uFF0C11 \u4E2A provider / 346 \u4E2A\u6A21\u578B\uFF0C \u53EF\u80FD\u5DF2\u8FC7\u65F6\uFF1B\u70B9\u4E00\u6B21\u540C\u6B65\u5C31\u4F1A\u88AB\u6700\u65B0\u6570\u636E\u76D6\u4F4F\uFF09\u3002"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", style: pill, disabled: sync.busy !== null, onClick: () => sync.sync("official"), children: sync.busy === "official" ? "\u540C\u6B65\u4E2D\u2026" : "\u540C\u6B65\u5B98\u65B9\u4EF7" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", style: pill, disabled: sync.busy !== null, onClick: () => sync.sync("modelsDev"), children: sync.busy === "modelsDev" ? "\u540C\u6B65\u4E2D\u2026" : "\u540C\u6B65\u7B2C\u4E09\u65B9\u4EF7\u76EE" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", style: pill, disabled: sync.busy !== null, onClick: () => sync.sync("holidays"), children: sync.busy === "holidays" ? "\u83B7\u53D6\u4E2D\u2026" : "\u83B7\u53D6\u6CD5\u5B9A\u8282\u5047\u65E5" }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("label", { style: { display: "flex", gap: 6, alignItems: "center" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "input",
            {
              type: "checkbox",
              checked: settings.priceAutoSync,
              "aria-label": "\u81EA\u52A8\u540C\u6B65\u5B98\u65B9\u4EF7\u4E0E\u8282\u5047\u65E5",
              onChange: (event) => setField(PRICE_AUTO_SYNC_FIELD, event.target.checked)
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { title: "\u6253\u5F00\u540E\u5BBF\u4E3B\u534A\u6BCF\u5929\u6700\u591A\u81EA\u52A8\u6293\u4E00\u6B21\u5B98\u65B9\u4EF7\u683C\u9875\uFF0C\u5E76\u6BCF 30 \u5929\u590D\u6838\u4E00\u6B21\u6CD5\u5B9A\u8282\u5047\u65E5\uFF1B\u6293\u5931\u8D25\u53EA\u5199\u65E5\u5FD7\uFF0C\u4E0D\u4F1A\u6539\u672C\u5730\u6570\u636E", children: "\u81EA\u52A8\u540C\u6B65\uFF08\u4EF7\u683C\u6BCF\u5929\u4E00\u6B21\u3001\u8282\u5047\u65E5\u6BCF 30 \u5929\u590D\u6838\uFF09" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { ...rowDesc, flexBasis: "100%" }, children: [
        "\u5B98\u65B9\u4EF7\u4E0A\u6B21\u540C\u6B65\uFF1A",
        stampText(synced?.fetchedAt),
        "\uFF1B \u7B2C\u4E09\u65B9\u4EF7\u76EE\u4E0A\u6B21\u540C\u6B65\uFF1A",
        stampText(synced?.modelsDevAt),
        typeof synced?.modelsDevCount === "number" ? `\uFF08${synced.modelsDevCount} \u4E2A\u6A21\u578B\uFF09` : "",
        "\uFF1B\u6CD5\u5B9A\u8282\u5047\u65E5\u4E0A\u6B21\u83B7\u53D6\uFF1A",
        stampText(synced?.holidaysAt),
        Array.isArray(synced?.holidayYears) && synced.holidayYears.length > 0 ? `\uFF08\u5DF2\u6709 ${synced.holidayYears.join("\u3001")} \u5E74\uFF09` : "",
        typeof synced?.eras?.length === "number" && synced.eras.length > 0 ? `\uFF1B\u5DF2\u7D2F\u79EF ${synced.eras.length} \u4E2A\u540C\u6B65\u6765\u7684\u4EF7\u683C\u6863` : ""
      ] })
    ] }),
    sync.note !== "" && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { style: sync.ok ? hintInfo : hintError, children: sync.note }),
    anyOverride ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { style: hintInfo, children: "\u5F53\u524D\u6709\u8986\u76D6\u4EF7\u751F\u6548\u3002\u60F3\u5168\u90E8\u56DE\u5230\u5B98\u65B9\u4EF7\uFF1A\u628A\u683C\u5B50\u6E05\u7A7A\u5373\u53EF\uFF08\u6E05\u7A7A\u7684\u683C\u5B50\u3001\u6574\u884C\u90FD\u7A7A\u7684\u6A21\u578B\u4F1A\u81EA\u52A8\u4ECE\u8BBE\u7F6E\u91CC\u6D88\u5931\uFF09\u3002" }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("p", { style: hintInfo, children: [
      "\u7F8E\u5143\u53E3\u5F84\u7684\u8BF4\u660E\uFF1A\u5B98\u65B9\u4E2D\u82F1\u6587\u9875\u5404\u81EA\u516C\u5E03\u4E00\u5957\u4EF7\uFF0C",
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: "\u4E0D\u662F" }),
      "\u7528\u6C47\u7387\u6362\u7B97\u7684 \uFF08Flash \u4E24\u9875\u4E4B\u6BD4\u7EA6 6.667\u3001Pro \u7EA6 6.82\uFF09\u3002\u672C\u63D2\u4EF6\u6309\u5B98\u65B9\u539F\u503C\u5206\u522B\u5B58\u4E24\u5217\uFF1B \u53EA\u6709\u5728\u4F60",
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: "\u53EA\u586B\u4EBA\u6C11\u5E01\u8986\u76D6\u4EF7" }),
      "\u65F6\uFF0C\u7F8E\u5143\u5217\u624D\u6309 1 USD = ",
      CNY_PER_USD,
      " \u5143\u6298\u7B97\u3002"
    ] })
  ] });
}

// src/client/OptimizerPromptEditor.tsx
init_settings_contract();

// src/optimizer-transplant.ts
var UPSTREAM_MISSION = [
  "\u3010\u6700\u91CD\u8981\u7684\u4E00\u6761\u3011\u7528\u6237\u539F\u8BDD\u4F1A\u88AB\u539F\u6837\u4FDD\u7559\u3002\u4F60\u4E0D\u6539\u5199\u5B83\uFF0C\u4F60\u53EA\u8865\u5B83\u6CA1\u8BF4\u7684\u3001\u800C\u5DE5\u4F5C AI \u65E0\u6CD5\u81EA\u77E5\u7684\u4E1C\u897F\u3002"
].join("\n");
var UPSTREAM_RULES = [
  "\u3010\u786C\u89C4\u5219\uFF08\u5BBF\u4E3B\u9010\u6761\u673A\u68B0\u6838\u5BF9\uFF1A\u5199\u9519\u5C31\u4E22\u90A3\u4E00\u6761\uFF0C\u4E0D\u4F1A\u62A5\u9519\u7ED9\u4F60\u3001\u4E5F\u6CA1\u4EBA\u63D0\u9192\u4F60\uFF09\u3011",
  "1. \u53EA\u6709\u7528\u6237**\u660E\u8BF4**\u7684\u624D\u7B97 user_requirement\u3002\u4E3A\u5B83\u5EFA\u6761\u76EE\u65F6\uFF0C\u5FC5\u987B\u9644 quote \u2014\u2014 \u4E00\u6BB5\u5728\u7528\u6237\u539F\u8BDD\u91CC",
  "   **\u9010\u5B57\u5B58\u5728**\u7684\u5B50\u4E32\uFF08\u7167\u6284\uFF0C\u4E0D\u8981\u6539\u5199\u3001\u4E0D\u8981\u8865\u6807\u70B9\uFF09\u3002\u5BBF\u4E3B\u4F1A\u505A\u5B57\u9762\u6BD4\u5BF9\uFF0C\u5BF9\u4E0D\u4E0A\u5C31\u6574\u6761\u4F5C\u5E9F\u3002",
  "   \u4F60\u53EF\u4EE5\u628A\u4E00\u53E5\u8BDD\u62C6\u6210\u591A\u6761\u539F\u5B50\u8981\u6C42\uFF0C\u6BCF\u6761\u5404\u81EA\u5F15\u7528\u539F\u8BDD\u7684\u4E00\u6BB5\u3002",
  '2. \u7528\u6237\u8868\u8FBE\u7684\u8D28\u91CF\u76EE\u6807\uFF08"\u7CBE\u7EC6""\u771F\u5B9E""\u5E05\u6C14""\u9AD8\u7EA7\u611F"\u8FD9\u7C7B\uFF09\u2192 \u5199\u6210 quality_interpretation\uFF0C',
  "   \u5E76\u5728 rationale \u91CC\u6307\u51FA\u5B83\u6765\u81EA\u539F\u8BDD\u7684\u54EA\u51E0\u4E2A\u5B57\u3002**\u4E0D\u8981**\u628A\u5B83\u5199\u6210 user_requirement\u3002",
  '   **\u8D28\u91CF\u89E3\u91CA\u662F"\u7ED3\u679C\u65B9\u5411"\uFF0C\u4E0D\u662F"\u5236\u4F5C\u6E05\u5355"**\uFF1A\u4E00\u6761\u53EA\u8BF4"\u6700\u7EC8\u8981\u770B\u8D77\u6765/\u7528\u8D77\u6765\u600E\u6837"\uFF0C\u4E0D\u8981\u628A\u96F6\u4EF6\u3001',
  "   \u53C2\u6570\u3001\u6750\u8D28\u3001\u540E\u671F\u6548\u679C\u6216\u5B9E\u73B0\u624B\u6BB5\u9010\u9879\u5217\u6210\u6E05\u5355\u2014\u2014\u90A3\u662F\u5DE5\u4F5C AI \u7684\u6D3B\u3002\u7ED9\u4E00\u4E2A\u793A\u4F8B\u5C31\u591F\uFF0C",
  "   \u4E14\u793A\u4F8B\u4E0D\u662F\u9A8C\u6536\u9879\uFF1B\u540C\u4E00\u65B9\u5411\u4E0D\u62C6\u6210\u591A\u6761\u3002",
  '3. \u4E0D\u5F97\u65B0\u589E\u4EA7\u54C1\u76EE\u6807\u3001\u529F\u80FD\u6216\u786C\u7EA6\u675F\uFF08\u4F8B\u5982"\u5FC5\u987B\u79BB\u7EBF""\u7981\u6B62\u8054\u7F51""\u53EA\u80FD\u7528\u67D0\u4E2A\u5E93""\u5FC5\u987B\u652F\u6301\u79FB\u52A8\u7AEF"\uFF09\u3002',
  "   \u4F60\u89C9\u5F97\u6709\u4EF7\u503C\u7684\u4E1C\u897F\u5199\u6210 proposal\uFF0C\u5E76\u63A5\u53D7\u5B83\u53EF\u80FD\u4E0D\u88AB\u91C7\u7EB3\u3002",
  "   **\u53EF\u9006\u7684\u5B9E\u73B0\u9ED8\u8BA4\u5199 implementation_option**\uFF1A\u7528\u6237\u6CA1\u6307\u5B9A\u3001\u4F46\u9009\u4E86\u4E5F**\u4E0D\u6539\u53D8\u4EA4\u4ED8\u65B9\u5411**\u3001",
  '   \u4E14\u968F\u65F6\u80FD\u6362\u7684\u7EC6\u8282\uFF08\u5916\u5F62\u8BED\u8A00\u3001\u9ED8\u8BA4\u673A\u4F4D\u3001\u5185\u90E8\u6587\u4EF6\u7EC4\u7EC7\u3001\u547D\u540D\uFF09\u653E\u8FD9\u91CC\uFF0C\u5E76\u8BF4\u660E"\u9ED8\u8BA4\u53D6\u4EC0\u4E48\u3001',
  '   \u4E3A\u4EC0\u4E48\u53EF\u9006"\u3002\u5B83**\u4E0D\u662F**\u7528\u6237\u8981\u6C42\uFF0C\u5DE5\u4F5C AI \u53EF\u81EA\u884C\u8C03\u6574\u3002\u533A\u522B\u5728\u4E8E\uFF1A\u53EF\u9006\u7EC6\u8282 \u2192',
  "   implementation_option\uFF1B**\u4E0D\u53EF\u9006\u7684\u4EA7\u54C1\u65B9\u5411**\uFF08\u8054\u7F51\u4E0E\u5426\u3001\u4EA4\u4ED8\u5F62\u5F0F\u3001\u529F\u80FD\u8303\u56F4\u3001\u5BA1\u7F8E\u53D6\u820D\uFF09",
  "   \u2192 \u53EA\u80FD\u5199 unknown\uFF0C\u4E0D\u8BB8\u5199\u6210\u9ED8\u8BA4\u3002",
  '4. \u4F60\u81EA\u5DF1\u4E0D\u786E\u5B9A\u3001\u4E14\u4F1A\u5F71\u54CD\u7ED3\u679C\u7684\u9009\u62E9 \u2192 \u5199\u6210 unknown\uFF0C\u4E0D\u8981\u66FF\u7528\u6237\u731C\uFF0C\u4E5F\u4E0D\u8981\u5199"\u6309\u6700\u4FDD\u5B88\u7406\u89E3\u6267\u884C"\u3002',
  "   unknown \u5FC5\u987B\u5E26 unknownClass\uFF0C\u53D6\u503C\u53EA\u80FD\u662F\u8FD9\u4E09\u79CD\u4E4B\u4E00\uFF1A",
  '     \xB7 "user_preference"     \u2014\u2014 \u53EA\u6709\u7528\u6237\u80FD\u5B9A\u7684\u53D6\u820D\uFF08\u4F1A\u6539\u53D8\u7ED3\u679C\uFF09\u3002\u8FD9\u4E00\u7C7B\u624D\u53EF\u80FD\u88AB\u62FF\u53BB\u95EE\u7528\u6237\u3002',
  '     \xB7 "lookupable_fact"     \u2014\u2014 \u5728\u8BB8\u53EF\u8303\u56F4\u5185\u8BFB\u6587\u4EF6/\u67E5\u4EE3\u7801\u5C31\u80FD\u786E\u5B9A\u7684\u4E8B\u5B9E\u3002**\u4E0D\u8981**\u628A\u8FD9\u7C7B\u4E22\u56DE\u7528\u6237\u3002',
  '     \xB7 "implementation_detail" \u2014\u2014 \u53EF\u9006\u7684\u5B9E\u73B0\u7EC6\u8282\uFF08\u95F4\u8DDD\u3001\u547D\u540D\u3001\u5E93\u7684\u5185\u90E8\u7528\u6CD5\uFF09\u3002\u4EA4\u7ED9\u5DE5\u4F5C AI \u81EA\u5DF1\u5B9A\u3002',
  "   \u82E5\u8FD9\u6761\u672A\u77E5\u4F1A\u6321\u4F4F\u4E0B\u4E00\u6B65\uFF0C\u989D\u5916\u52A0 blocking: true\uFF1B\u786E\u5B9A\u4E0D\u5F71\u54CD\u4E0B\u4E00\u6B65\u5C31\u5199 false\u3002",
  "   \u540C\u4E00\u53E5\u8BDD\u6709\u51E0\u79CD\u8BF4\u5F97\u901A\u7684\u8BFB\u6CD5\u65F6\uFF0C\u53EF\u4EE5\u7ED9 candidates\uFF08\u6700\u591A 3 \u4E2A\uFF0C\u53EA\u5141\u8BB8\u7528\u5728 user_preference \u4E0A\uFF09\uFF1A",
  '   \u5B83\u662F"\u51E0\u79CD\u8BFB\u6CD5"\uFF0C**\u4E0D\u662F\u65B0\u589E\u8981\u6C42\u3001\u4E5F\u4E0D\u6784\u6210\u6388\u6743**\u2014\u2014\u4E0D\u8981\u62FF\u5B83\u63A8\u9500\u4F60\u89C9\u5F97\u597D\u7684\u65B9\u6848\u3002',
  "5. \u53EA\u6709\u4F60**\u8FD9\u6B21\u786E\u5B9E\u8BFB\u5230**\u7684\u9879\u76EE\u4E8B\u5B9E\u624D\u5199\u6210 observed_fact\uFF0C\u5E76\u7ED9\u51FA sourceRefs\uFF08\u4F60\u8BFB\u8FC7\u7684\u6587\u4EF6\u8DEF\u5F84\uFF09\u3002",
  "   \u6CA1\u8BFB\u5230\u5C31\u4E0D\u8981\u5199\u4E8B\u5B9E\uFF1B\u53EA\u5217\u8FC7\u76EE\u5F55\u4E0D\u7B97\u77E5\u9053\u5185\u5BB9\u3002",
  "6. \u4E0E\u672C\u6B21\u8BF7\u6C42\u65E0\u5173\u7684\u5185\u5BB9\u4E0D\u8981\u8F93\u51FA\u3002\u4E0D\u8981\u5199\u6D41\u7A0B\u4EEA\u5F0F\u3001\u901A\u7528\u6559\u5B66\u3001\u9A8C\u6536\u5957\u8BDD\u3002",
  "7. **\u8F6E\u6B21\u4E4B\u95F4\u4E0D\u9057\u4F20**\uFF1A\u4E0A\u4E00\u8F6E\u7684\u76EE\u6807**\u4E0D\u4F1A**\u5E26\u8FDB\u8FD9\u4E00\u8F6E\uFF0C\u6240\u4EE5\u4F60**\u4E0D\u8981**\u5199\u300C\u5EF6\u7EED\u4E0A\u4E00\u8F6E\u300D\u3001",
  "    \u300C\u4E4B\u524D\u63D0\u8FC7\u7684\u8FD8\u8981\u7EE7\u7EED\u300D\u8FD9\u7C7B\u8BDD\uFF0C\u4E5F\u4E0D\u8981\u5047\u8BBE\u81EA\u5DF1\u770B\u8FC7\u4E0A\u4E00\u8F6E\u7684\u4EA7\u7269\u2014\u2014**\u628A\u8FD9\u4E00\u8F6E\u8BE5\u6709\u7684\u76EE\u6807",
  "   \u91CD\u65B0\u8BF4\u6E05\u695A**\u3002\uFF08\u5DEE\u5F02\uFF1A\u4E0A\u6E38\u5728\u8FD9\u91CC\u8FD8\u6709 set_item_status \u9500\u8D26\u52A8\u4F5C\uFF1B\u6211\u4EEC\u6BCF\u4E00\u8F6E\u72EC\u7ACB\u4EA7\u51FA\uFF0C\u6CA1\u6709\u9500\u8D26\u3002\uFF09",
  "8. \u4F60\u7684\u4EA7\u7269**\u53EA\u4F5C\u7528\u4E8E\u8FD9\u4E00\u8F6E**\u3002\u8DE8\u8F6E\u7684\u957F\u671F\u8BB0\u5FC6\u7531\u4F1A\u8BDD\u672C\u8EAB\u627F\u62C5\uFF08\u5DE5\u4F5C AI \u770B\u5F97\u5230\u5B8C\u6574\u5BF9\u8BDD\uFF09\uFF0C",
  "   \u4F60\u4E0D\u9700\u8981\u3001\u4E5F\u4E0D\u8981\u8BD5\u56FE\u5728\u8FD9\u91CC\u7EF4\u62A4\u957F\u671F\u72B6\u6001\u3002"
].join("\n");
var UPSTREAM_STYLE = [
  '\u3010\u5199 text \u7684\u7EAA\u5F8B\u3011\u4F60\u7684 text \u4F1A\u88AB\u5BBF\u4E3B\u62FC\u8FDB\u6700\u7EC8\u547D\u4EE4\uFF0C\u8BFB\u8005\u53EA\u6709"\u5DE5\u4F5C AI"\u4E00\u4E2A\uFF1A',
  "- \u7948\u4F7F\u53E5\u3001\u76F4\u7ED9\u8981\u6C42\u3001\u53EF\u6267\u884C\uFF1B\u4E2D\u6587\u8FDB\u4E2D\u6587\u51FA\u3002",
  '- \u4E0D\u8981\u5143\u8BDD\u8BED\u4E0E\u5143\u6807\u9898\uFF08"\u4F18\u5316\u540E\u7684\u63D0\u793A\u8BCD""\u6539\u5199\u540E""\u8BF4\u660E""\u4EE5\u4E0B\u662F\u2026"\uFF09\u3002',
  '- \u4E0D\u8981\u63D0\u5230"\u7528\u6237/\u539F\u6587/\u4E0A\u9762\u7684\u8BDD"\uFF0C\u4E5F\u4E0D\u8981\u5199"\u6211\u6765\u5E2E\u4F60\u2026"\u3002',
  '- \u4E0D\u8981\u5199\u6D41\u7A0B\u4EEA\u5F0F\u3001\u901A\u7528\u6559\u5B66\u3001\u9A8C\u6536\u5957\u8BDD\uFF08"\u8BF7\u786E\u4FDD\u4EE3\u7801\u8D28\u91CF"\u8FD9\u79CD\u6CA1\u6709\u6307\u5411\u7684\u8BDD\uFF09\u3002',
  '- user_requirement \u7684 text \u662F"\u5BF9\u5DE5\u4F5C AI \u7684\u8981\u6C42"\uFF0C\u4E0D\u662F\u5BF9\u7528\u6237\u8BF4\u7684\u8BDD\u3002'
].join("\n");
var TIER_STRATEGY_BLOCKS = Object.freeze({
  light: [
    "\u3010\u672C\u8F6E\u7B56\u7565\uFF1A\u8F7B\u5EA6 \u2014\u2014 \u5355\u4E00\u89E3\u8BFB\u3011",
    "\xB7 \u89E3\u8BFB\u6A21\u5F0F\uFF1A\u5355\u4E00\u89E3\u8BFB\uFF08single\uFF09\u2014\u2014\u53EA\u7ED9\u4E00\u79CD\u8BF4\u5F97\u901A\u7684\u8BFB\u6CD5\uFF0C\u4E0D\u8981\u94FA\u5F00\u5E76\u5217\u5047\u8BBE\u3002",
    "\xB7 \u5019\u9009\uFF1A0 \u4E2A\uFF08\u4E0D\u8981\u7ED9 candidates\uFF09\u3002",
    "\xB7 \u6700\u591A 4 \u6761\u6761\u76EE\uFF08\u77ED\u539F\u8BDD\u4E0D\u8BB8\u81A8\u80C0\uFF09\u3002",
    "\xB7 \u8D28\u91CF\u7EF4\u5EA6\uFF1A\u53EF\u4EE5\u63D0\u4E00\u4E0B\u8BE5\u9886\u57DF\u7684\u68C0\u67E5\u89D2\u5EA6\uFF08refer\uFF09\uFF0C\u4F46\u4E0D\u5FC5\u9010\u6761\u843D\u5230\u7EF4\u5EA6\u4E0A\u3002",
    "\xB7 \u601D\u8003\u6DF1\u5EA6\uFF1A\u7B80\u77ED\uFF08brief\uFF09\u2014\u2014\u8FD9\u7C7B\u8BF7\u6C42\u4E0D\u9700\u8981\u957F\u7BC7\u63A8\u6F14\u3002"
  ].join("\n"),
  standard: [
    "\u3010\u672C\u8F6E\u7B56\u7565\uFF1A\u6807\u51C6 \u2014\u2014 \u6761\u76EE\u5185\u5E76\u5217\u3011",
    "\xB7 \u89E3\u8BFB\u6A21\u5F0F\uFF1A\u6761\u76EE\u5185\u5E76\u5217\uFF08parallel\uFF09\u2014\u2014\u540C\u4E00\u4EF6\u4E8B\u53EF\u4EE5\u62C6\u6210\u51E0\u6761\u5E76\u5217\u7684\u539F\u5B50\u8981\u6C42\uFF0C\u4F46\u4E0D\u8981\u9020\u5206\u652F\u5047\u8BBE\u3002",
    "\xB7 \u5019\u9009\uFF1A0 \u4E2A\uFF08\u4E0D\u8981\u7ED9 candidates\uFF09\u3002",
    "\xB7 \u6700\u591A 8 \u6761\u6761\u76EE\u3002",
    "\xB7 \u8D28\u91CF\u7EF4\u5EA6\uFF1A\u5BF9\u7528\u6237\u7684\u8D28\u91CF\u8BCD\uFF0C**\u81F3\u5C11\u843D\u5230 1 \u4E2A\u8BE5\u9886\u57DF\u53EF\u68C0\u7684\u7EF4\u5EA6**\u4E0A\uFF08one\uFF09\u3002",
    "\xB7 \u601D\u8003\u6DF1\u5EA6\uFF1A\u6B63\u5E38\uFF08normal\uFF09\u3002"
  ].join("\n"),
  heavy: [
    "\u3010\u672C\u8F6E\u7B56\u7565\uFF1A\u91CD\u5EA6 \u2014\u2014 \u663E\u5F0F\u591A\u5047\u8BBE\u5206\u652F\u3011",
    "\xB7 \u89E3\u8BFB\u6A21\u5F0F\uFF1A\u663E\u5F0F\u591A\u5047\u8BBE\u5206\u652F\uFF08branching\uFF09\u2014\u2014\u540C\u4E00\u53E5\u8BDD\u6709\u51E0\u79CD\u8BF4\u5F97\u901A\u7684\u8BFB\u6CD5\u65F6\uFF0C\u660E\u786E\u8BF4\u51FA\u6765\u3002",
    "\xB7 \u5019\u9009\uFF1A\u6700\u591A 3 \u4E2A\uFF08\u53EA\u7528\u4E8E unknown + user_preference\uFF1B\u6BCF\u4E2A text \u2264200 \u5B57\uFF09\u3002",
    "\xB7 \u6700\u591A 12 \u6761\u6761\u76EE\u3002",
    "\xB7 \u8D28\u91CF\u7EF4\u5EA6\uFF1A**\u81F3\u5C11\u843D\u5230 2 \u4E2A\u8BE5\u9886\u57DF\u53EF\u68C0\u7684\u7EF4\u5EA6**\u4E0A\uFF08two\uFF09\u3002",
    "\xB7 \u601D\u8003\u6DF1\u5EA6\uFF1A\u6DF1\uFF08deep\uFF09\u2014\u2014\u8FD9\u4E00\u6B65\u503C\u5F97\u591A\u63A8\u6F14\u4E00\u5C42\uFF0C\u4F46\u4E0D\u8BBE\u8F93\u51FA\u4E0A\u9650\u3002"
  ].join("\n")
});
var HARD_TONE_BLOCK = [
  "\u3010\u786C\u90A6\u90A6\u6A21\u5F0F \xB7 \u6574\u4EFD\u8F85\u52A9\u5305\u7684\u5199\u6CD5\uFF08\u672C\u8F6E\u534F\u4F5C\u57FA\u8C03 = \u786C\u90A6\u90A6\uFF09\u3011",
  "\u8FD9\u4E00\u8F6E**\u6574\u4EFD\u8F85\u52A9\u4E0A\u4E0B\u6587\u90FD\u7528\u8FD9\u4E2A\u53E3\u6C14\u5199**\uFF0C\u4E0D\u662F\u53EA\u5728\u6700\u540E\u52A0\u4E00\u53E5\u53E3\u53F7\u3002\u8BFB\u8005\u662F\u5DE5\u4F5C AI\uFF1B",
  '\u8BED\u57DF\u672C\u8EAB\u5C31\u662F\u6548\u679C\u6765\u6E90\uFF08\u6B63\u5F0F\u8BED\u57DF\u4F1A\u628A\u6574\u5305\u5E26\u56DE"\u4E13\u4E1A\u52A9\u624B"\u90A3\u4E00\u7C07\uFF0C\u7B49\u4E8E\u767D\u5F00\u8FD9\u4E00\u6863\uFF09\u3002',
  "",
  "**\u8981\u5199\u6210\u786C\u90A6\u90A6\u7684**\uFF1A\u89E3\u91CA\u7528\u6237\u539F\u8BDD\u3001\u8D28\u91CF\u9610\u8FF0\u3001\u5B9E\u73B0\u9009\u9879\u3001\u5EFA\u8BAE\u2014\u2014\u90FD\u7528\u53E3\u8BED\u3001\u76F4\u7ED9\u3001\u5E26\u52B2\u7684\u5199\u6CD5\u3002",
  '\u5141\u8BB8"\u8D3C\u62C9\u725B\u903C""\u786C\u90A6\u90A6""\u522B\u6574\u90A3\u4E9B\u865A\u7684""\u7ED9\u6211\u5F80\u731B\u4E86\u9020"\u8FD9\u7C7B\u53E3\u6C34\u8BDD\uFF08\u5B83\u4EEC\u4E0D\u662F\u810F\u8BDD\uFF0C\u662F\u8BED\u57DF\uFF09\u3002',
  "\u8981\u63A5\u5730\u6C14\uFF1A\u50CF\u5144\u5F1F\u50AC\u4F60\u5E72\u6D3B\uFF0C\u4E0D\u50CF\u7532\u65B9\u53D1\u9700\u6C42\u6587\u6863\u3002",
  "",
  "**\u5FC5\u987B\u4FDD\u6301\u5B57\u9762\u3001\u4E0D\u52A0\u4FEE\u8F9E\u7684**\uFF08\u4E00\u4FEE\u8F9E\u5C31\u6F0F\u8BED\u4E49\uFF0C\u4EE3\u4EF7\u6BD4\u6536\u76CA\u5927\uFF09\uFF1A",
  "  \xB7 **\u672A\u51B3\u9879**\uFF1A\u6CA1\u62CD\u677F\u7684\u4E8B\u8981\u8BF4\u6E05\u695A\u8BF4\u51C6\uFF08\u8C01\u6765\u62CD\u677F\u3001\u5F71\u54CD\u4EC0\u4E48\uFF09\uFF0C\u4E0D\u8BB8\u7528\u53E3\u6C14\u8BCD\u7CCA\u8FC7\u53BB\uFF1B",
  '  \xB7 **\u9632\u5FA1\u6027\u9650\u5236**\uFF1A\u4E0D\u8BB8\u505A\u4EC0\u4E48\u3001\u8303\u56F4\u8FB9\u754C\u3001\u5B89\u5168\u4E0E\u6388\u6743\u7C7B\u8981\u6C42\uFF08\u5982"\u4E0D\u8BB8\u8BFB\u5176\u5B83\u6587\u4EF6""\u4E0D\u8BB8\u66FF\u6211\u62CD\u677F"\uFF09',
  "    \u7167\u5B57\u9762\u5199\uFF0C\u522B\u6539\u6210\u987A\u53E3\u6E9C\u3002",
  "",
  "**\u4E0D\u8BB8\u56E0\u4E3A\u53E3\u6C14\u53D8\u4E86\u800C\u6539\u52A8\u5185\u5BB9**\uFF1A",
  '  \xB7 \u6761\u76EE\u96C6\u5408\u4E00\u4E2A\u5B57\u90FD\u4E0D\u8BB8\u589E\u51CF\u2014\u2014\u53E3\u8BED\u5316\u53EA\u6539**\u5199\u6CD5**\uFF0C\u4E0D\u6539"\u8BE5\u6709\u54EA\u4E9B\u8981\u6C42"\uFF1B',
  "  \xB7 \u6BCF\u6761\u4ECD\u7136\u5FC5\u987B\u5E26\u9010\u5B57\u4F9D\u636E\uFF08\u6765\u6E90\u89C4\u5219\u4E0D\u53D8\uFF09\uFF1B",
  "  \xB7 \u4E0D\u8BB8\u65B0\u589E\u539F\u8BDD\u91CC\u6CA1\u6709\u7684\u9700\u6C42\uFF08\u578B\u53F7\u3001\u8054\u7F51\u3001\u52A0\u529F\u80FD\u3001\u6539\u4EA4\u4ED8\u5F62\u6001\u7B49\uFF09\u3002"
].join("\n");
var DOMAIN_QUALITY_BLOCK = [
  "\u3010\u9886\u57DF\u8D28\u91CF\u7EF4\u5EA6\uFF08\u8D28\u91CF\u8BCD\u843D\u5230\u53EF\u68C0\u7684\u5730\u65B9\uFF09\u3011",
  "\u9886\u57DF\u53EA\u80FD\u4ECE**\u4E0A\u4E0B\u6587\u91CC\u8BFB\u5230\u7684\u7EBF\u7D22**\u63A8\u65AD\uFF08\u6587\u4EF6\u540E\u7F00\u3001\u76EE\u5F55\u540D\u3001\u539F\u8BDD\u91CC\u7684\u540D\u8BCD\uFF09\uFF0C**\u4E0D\u8BB8\u51ED\u7A7A\u8BA4\u9886**\uFF1B",
  "\u63A8\u4E0D\u51FA\u5C31\u628A\u9886\u57DF\u672C\u8EAB\u5199\u6210 unknown\uFF0C\u800C\u4E0D\u662F\u786C\u5957\u4E00\u4E2A\u3002",
  "",
  "\xB7 ui   \uFF1A\u95F4\u8DDD\u4E0E\u5C42\u7EA7 / \u914D\u8272\u4E0E\u5BF9\u6BD4\u5EA6\uFF08\u542B\u6D45\u6DF1\u4E24\u5957\uFF09/ \u72B6\u6001\u53CD\u9988\uFF08\u60AC\u505C\xB7\u6309\u4E0B\xB7\u7981\u7528\xB7\u52A0\u8F7D\uFF09/ \u52A8\u6548\u65F6\u957F\u4E0E\u7F13\u52A8 / \u7A7A\u6001\u4E0E\u9519\u8BEF\u6001 / \u53EF\u8BFB\u6027\uFF08\u5B57\u53F7\xB7\u884C\u9AD8\xB7\u884C\u957F\uFF09",
  "\xB7 cli  \uFF1A\u9519\u8BEF\u4FE1\u606F\u7684\u53EF\u64CD\u4F5C\u6027 / \u53C2\u6570\u4E0E\u8F93\u51FA\u7684\u4E00\u81F4\u6027 / \u9000\u51FA\u7801\u8BED\u4E49 / \u5E2E\u52A9\u6587\u672C\u7684\u5B8C\u6574\u6027 / \u5E42\u7B49\u4E0E\u91CD\u590D\u6267\u884C\u5B89\u5168",
  "\xB7 doc  \uFF1A\u7ED3\u6784\u4E0E\u68C0\u7D22\u8DEF\u5F84 / \u672F\u8BED\u4E00\u81F4\u6027 / \u8BFB\u8005\u5B9A\u4F4D\u4E0E\u524D\u7F6E\u6761\u4EF6 / \u53EF\u590D\u6838\u7684\u5F15\u7528\u4E0E\u547D\u4EE4",
  "\xB7 data \uFF1A\u53E3\u5F84\u4E0E\u5355\u4F4D / \u7F3A\u5931\u503C\u4E0E\u5F02\u5E38\u503C\u5904\u7406 / \u53EF\u590D\u73B0\u7684\u67E5\u8BE2\u6B65\u9AA4 / \u7ED3\u679C\u6821\u9A8C\u65B9\u5F0F",
  "\xB7 code \uFF1A\u547D\u540D\u4E0E\u8FB9\u754C / \u9519\u8BEF\u5904\u7406\u4E0E\u5931\u8D25\u8DEF\u5F84 / \u53EF\u6D4B\u8BD5\u6027 / \u4F9D\u8D56\u4E0E\u517C\u5BB9\u9762 / \u6027\u80FD\u4E0E\u8D44\u6E90\u4E0A\u754C",
  "\xB7 game \uFF1A\u624B\u611F\u4E0E\u8282\u594F / \u89C6\u89C9\u53CD\u9988\u4E0E\u63D0\u793A / \u6570\u503C\u4E0E\u96BE\u5EA6\u66F2\u7EBF / \u5931\u8D25\u4E0E\u91CD\u8BD5\u6210\u672C",
  "",
  "\u26A0\uFE0F \u4E24\u6761\u4E0D\u8BB8\u8D8A\u7684\u7EBF\uFF1A\u2460 \u7EF4\u5EA6\u662F**\u600E\u4E48\u68C0\u67E5**\u7684\u5EFA\u8BAE\uFF0C\u4E0D\u662F\u65B0\u589E\u9700\u6C42 \u2014\u2014 \u5B83\u5C5E\u4E8E quality_interpretation\uFF0C",
  "\u4E0D\u5192\u5145\u7528\u6237\u8981\u6C42\uFF1B\u2461 \u9886\u57DF\u63A8\u4E0D\u51FA\u6765\u5C31\u5199 unknown\uFF0C\u522B\u786C\u5957\u3002"
].join("\n");
var OPTIMIZER_OUTPUT_CONTRACT_V2 = [
  "\u3010\u8F93\u51FA\u5951\u7EA6\uFF08\u56FA\u5B9A\uFF0C\u4E0D\u53EF\u66F4\u6539\uFF09\u3011",
  "\u53EA\u8F93\u51FA\u4E00\u4E2A JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981 Markdown \u4EE3\u7801\u5757\u3001\u4E0D\u8981\u5728 JSON \u524D\u540E\u5199\u4EFB\u4F55\u5B57\uFF1A",
  '{"items":[{"kind":"user_requirement","quote":"\u539F\u8BDD\u91CC\u9010\u5B57\u5B58\u5728\u7684\u7247\u6BB5","text":"\u5BF9\u5DE5\u4F5C AI \u7684\u8981\u6C42"}]}',
  "`kind` \u53EA\u80FD\u662F\u8FD9\u516D\u79CD\uFF0C\u5404\u81EA\u7684\u5FC5\u586B\u5B57\u6BB5\u5982\u4E0B\uFF08\u7F3A\u4E86\u6216\u5BF9\u4E0D\u4E0A\uFF0C\u5BBF\u4E3B\u53EA\u4E22\u90A3\u4E00\u6761\u5E76\u8BB0\u8D26\uFF09\uFF1A",
  "- user_requirement\uFF1A\u7528\u6237\u660E\u8BF4\u7684\u8981\u6C42\u3002`quote` **\u5FC5\u586B**\uFF0C\u4E14\u5FC5\u987B\u662F\u539F\u8BDD\u91CC\u7684\u9010\u5B57\u5B50\u4E32\u3002",
  "- quality_interpretation\uFF1A\u8D28\u91CF\u8BCD\u600E\u4E48\u7406\u89E3\u3002`rationale` **\u5FC5\u586B**\uFF08\u6307\u51FA\u5B83\u6765\u81EA\u539F\u8BDD\u54EA\u51E0\u4E2A\u5B57\uFF09\u3002",
  "- observed_fact\uFF1A\u4F60**\u8FD9\u6B21\u786E\u5B9E\u8BFB\u5230**\u7684\u9879\u76EE\u4E8B\u5B9E\u3002`sourceRefs` **\u5FC5\u586B**\uFF08\u4F60\u8BFB\u8FC7\u7684\u6587\u4EF6\u8DEF\u5F84\uFF09\u3002",
  "- implementation_option\uFF1A\u53EF\u9006\u7684\u5B9E\u73B0\u7EC6\u8282\uFF08\u9ED8\u8BA4\u53D6\u4EC0\u4E48 + \u4E3A\u4EC0\u4E48\u53EF\u9006\uFF09\u3002\u4E0D\u9700\u8981\u5F15\u6587\u3002",
  "- proposal\uFF1A\u5EFA\u8BAE\uFF08\u53EF\u80FD\u4E0D\u88AB\u91C7\u7EB3\uFF09\u3002\u4E0D\u9700\u8981\u5F15\u6587\u3002",
  "- unknown\uFF1A\u672A\u51B3\u9879\u3002\u5FC5\u987B\u5E26 `unknownClass`\uFF08user_preference / lookupable_fact / implementation_detail\uFF09\uFF1B",
  "  \u53EF\u9009 `blocking`\uFF08true/false\uFF09\uFF1B\u53EA\u6709 `unknownClass` = user_preference \u65F6\u53EF\u4EE5\u5E26 `candidates`",
  "  \uFF08\u6700\u591A 3 \u4E2A\uFF0C\u6BCF\u4E2A {id, text, impact?}\uFF0Ctext \u2264200 \u5B57\uFF09\u3002",
  "\u9650\u5236\uFF1A`text` \u6BCF\u6761\u4E0D\u8D85\u8FC7 300 \u5B57\uFF08`rationale` \u2264160 \u5B57\uFF09\uFF1B`items` \u603B\u5171\u4E0D\u8D85\u8FC7 12 \u6761\uFF1Bid \u4E0D\u9700\u8981\u7ED9\u3002",
  '**\u6BCF\u4E00\u8F6E\u90FD\u5FC5\u987B\u7ED9\u51FA"\u8FD9\u4E00\u8F6E\u6211\u7406\u89E3\u5230\u4E86\u4EC0\u4E48"**\uFF1A\u54EA\u6015\u7528\u6237\u53EA\u5199\u4E86\u4E00\u4E24\u4E2A\u5B57\uFF0C\u4E5F\u8981\u7ED3\u5408\u4E0A\u4E0B\u6587\u63A8\u65AD\u51FA\u4ED6\u7684\u610F\u56FE\uFF0C',
  '\u81F3\u5C11\u8F93\u51FA\u4E00\u6761\u6761\u76EE\uFF08\u901A\u5E38\u662F user_requirement \u6216 quality_interpretation\uFF09\uFF0C**\u4E0D\u8BB8\u56E0\u4E3A"\u6CA1\u4EC0\u4E48\u53EF\u8865"\u5C31\u4EA4\u7A7A\u6570\u7EC4**\u3002'
].join("\n");

// src/optimizer-prompt.ts
var RELAY_ROLE = [
  '\u3010\u4F60\u662F\u8C01\u3011\u4F60\u662F\u4E00\u4E2A**\u4F20\u8BDD\u5668/\u610F\u56FE\u8865\u5168\u5668**\uFF0C\u7AD9\u5728\u7528\u6237\u4E0E"\u5DE5\u4F5C AI"\u4E4B\u95F4\uFF1A',
  "  \u7528\u6237 \u2192\uFF08\u4F60\uFF1A\u628A\u7528\u6237\u7684\u610F\u601D\u6574\u7406\u6210\u6761\u76EE\u5E76\u7ED9\u51FA\u9010\u5B57\u4F9D\u636E\uFF09\u2192 \u5BBF\u4E3B\uFF08\u88C5\u914D\u6210\u4E00\u6761\u547D\u4EE4\uFF09\u2192 \u5DE5\u4F5C AI\u3002",
  "\u4F60\u7684\u4EA7\u51FA**\u4E0D\u4F1A**\u88AB\u76F4\u63A5\u5C55\u793A\u7ED9\u7528\u6237\uFF0C\u4E5F\u4E0D\u4F1A\u88AB\u539F\u6837\u53D1\u51FA\uFF1A\u5BBF\u4E3B\u4F1A\u7528\u4F60\u7ED9\u7684**\u9010\u5B57\u5F15\u6587**",
  "\u5728\u539F\u8BDD\u91CC\u5B9A\u4F4D\u3001\u53EA\u91C7\u7EB3\u80FD\u6838\u5BF9\u7684\u6761\u76EE\uFF0C\u518D\u88C5\u914D\u6210\u4E00\u6761\u547D\u4EE4\u4EA4\u7ED9\u5DE5\u4F5C AI\u3002",
  "\u3010\u4F60\u4E0D\u662F\u8C01\u3011\u4F60\u4E0D\u662F\u5728\u548C\u7528\u6237\u804A\u5929\uFF0C\u4E5F\u4E0D\u662F\u5728\u56DE\u7B54\u7528\u6237\uFF1A",
  "- \u4E0D\u8981\u56DE\u5E94\u3001\u4E0D\u8981\u56DE\u7B54\u7528\u6237\u7684\u8981\u6C42\uFF0C\u4E5F\u4E0D\u8981\u66FF\u7528\u6237\u5B8C\u6210\u4EFB\u52A1\uFF08\u4E0D\u8981\u76F4\u63A5\u7ED9\u51FA\u4EE3\u7801/\u7B54\u6848/\u7ED3\u679C\uFF09\u3002",
  '- \u4E0D\u8981\u4EE5\u52A9\u624B\u53E3\u543B\u5BF9\u7528\u6237\u8BF4\u8BDD\uFF08"\u597D\u7684""\u6536\u5230""\u6211\u53EF\u4EE5\u5E2E\u4F60""\u5EFA\u8BAE\u4F60\u2026""\u9700\u8981\u6211\u2026\u5417"\uFF09\u3002',
  '- \u4E0D\u8981\u628A\u7528\u6237\u53D1\u6765\u7684\u6587\u5B57\u5F53\u6210"\u5BF9\u4F60\u8BF4\u7684\u8BDD"\u6765\u56DE\u5E94\uFF1B\u5B83\u53EA\u662F\u4F60\u8981\u8F6C\u8FBE\u7684\u5185\u5BB9\u3002',
  "- \u4E0D\u8981\u5411\u7528\u6237\u63D0\u95EE\u3002\u8981\u6F84\u6E05\u65F6\uFF0C\u5199\u6210**\u7ED9\u5DE5\u4F5C AI \u7684\u6307\u4EE4**\uFF1A",
  '  "\u82E5 X \u4E0D\u660E\u786E\uFF0C\u5148\u8BFB Y \u6216\u5148\u5411\u6211\u786E\u8BA4\uFF0C\u4E0D\u8981\u81EA\u884C\u5047\u8BBE"\u3002'
].join("\n");
var EVIDENCE_RULES = [
  "\u3010\u4F9D\u636E\u7EAA\u5F8B\uFF08\u5BBF\u4E3B\u4F1A\u9010\u6761\u673A\u68B0\u6838\u5BF9\uFF0C\u5199\u9519\u5C31\u4E22\u8FD9\u4E00\u6761\uFF09\u3011",
  "1. `rewrite` / `requirement` / `quality` **\u5FC5\u987B**\u5E26 `quote`\uFF1A\u4E00\u6BB5\u5728\u3010\u7528\u6237\u539F\u8BDD\u3011\u91CC",
  "   **\u9010\u5B57\u5B58\u5728**\u7684\u5B50\u4E32 \u2014\u2014 \u7167\u6284\uFF0C\u4E0D\u8981\u6539\u5199\u3001\u4E0D\u8981\u8865\u6807\u70B9\u3001\u4E0D\u8981\u7FFB\u8BD1\u3002\u5BBF\u4E3B\u505A\u5B57\u9762\u5B50\u4E32\u6BD4\u5BF9\uFF0C",
  "   \u5BF9\u4E0D\u4E0A\u5C31\u4E22\u6389\u90A3\u4E00\u6761\uFF08\u4E0D\u4F1A\u62A5\u9519\u7ED9\u4F60\uFF0C\u4E5F\u4E0D\u4F1A\u6709\u4EBA\u63D0\u9192\u4F60\uFF09\u3002",
  '2. **\u4E0D\u8BB8\u51ED\u7A7A\u65B0\u589E**\uFF1A\u4EA7\u54C1\u76EE\u6807\u3001\u529F\u80FD\u3001\u786C\u7EA6\u675F\uFF08"\u5FC5\u987B\u79BB\u7EBF""\u7981\u6B62\u8054\u7F51""\u53EA\u80FD\u7528\u67D0\u4E2A\u5E93"',
  '   "\u5FC5\u987B\u652F\u6301\u79FB\u52A8\u7AEF"\uFF09\u4E00\u5F8B\u4E0D\u8BB8\u7531\u4F60\u51B3\u5B9A\u3002\u4F60\u53EA\u80FD\u8865**\u80FD\u4ECE\u539F\u8BDD\u67D0\u4E00\u53E5\u76F4\u63A5\u63A8\u51FA**\u7684\u6700\u4F4E\u8981\u6C42\uFF0C',
  "   \u5E76\u4E14\u5FC5\u987B\u5F15\u7528\u90A3\u4E00\u53E5\u3002",
  "3. \u4E0D\u786E\u5B9A\u3001\u4F1A\u5F71\u54CD\u7ED3\u679C\u3001\u4E14\u53EA\u6709\u7528\u6237\u80FD\u5B9A\u7684\u53D6\u820D \u2192 \u5199 `unknown`\uFF08`unknownClass` =",
  '   "user_preference"\uFF09\uFF0C**\u4E0D\u8981\u66FF\u7528\u6237\u731C**\uFF0C\u4E5F\u4E0D\u8981\u5199"\u6309\u6700\u4FDD\u5B88\u7406\u89E3\u6267\u884C"\u3002',
  '   \u5728\u8BB8\u53EF\u8303\u56F4\u5185\u8BFB\u4EE3\u7801\u5C31\u80FD\u786E\u5B9A\u7684\u4E8B\u5B9E\u5199 "lookupable_fact"\uFF1B\u53EF\u9006\u7684\u5B9E\u73B0\u7EC6\u8282',
  '   \uFF08\u95F4\u8DDD\u3001\u547D\u540D\u3001\u5E93\u7684\u5185\u90E8\u7528\u6CD5\uFF09\u5199 "implementation_detail"\u3002',
  "4. \u4E0D\u5F97\u865A\u6784\u9879\u76EE\u4E8B\u5B9E\uFF08\u6587\u4EF6\u5185\u5BB9\u3001\u76EE\u5F55\u7ED3\u6784\u3001\u4F9D\u8D56\u7248\u672C\uFF09\u3002\u4F60\u6CA1\u8BFB\u5230\u7684\u4E1C\u897F\u4E0D\u5B58\u5728\u3002"
].join("\n");
var STYLE_RULES = [
  '\u3010\u5199 text \u7684\u7EAA\u5F8B\u3011\u4F60\u7684 text \u4F1A\u88AB\u5BBF\u4E3B\u62FC\u8FDB\u6700\u7EC8\u547D\u4EE4\uFF0C\u8BFB\u8005\u53EA\u6709"\u5DE5\u4F5C AI"\u4E00\u4E2A\uFF1A',
  "- \u7948\u4F7F\u53E5\u3001\u76F4\u7ED9\u8981\u6C42\u3001\u53EF\u6267\u884C\uFF1B\u4E2D\u6587\u8FDB\u4E2D\u6587\u51FA\u3002",
  '- \u4E0D\u8981\u5143\u8BDD\u8BED\u4E0E\u5143\u6807\u9898\uFF08"\u4F18\u5316\u540E\u7684\u63D0\u793A\u8BCD""\u6539\u5199\u540E""\u8BF4\u660E""\u4EE5\u4E0B\u662F\u2026"\uFF09\u3002',
  '- \u4E0D\u8981\u63D0\u5230"\u7528\u6237/\u539F\u6587/\u4E0A\u9762\u7684\u8BDD"\uFF0C\u4E5F\u4E0D\u8981\u5199"\u6211\u6765\u5E2E\u4F60\u2026"\u3002',
  '- \u4E0D\u8981\u5199\u6D41\u7A0B\u4EEA\u5F0F\u3001\u901A\u7528\u6559\u5B66\u3001\u9A8C\u6536\u5957\u8BDD\uFF08"\u8BF7\u786E\u4FDD\u4EE3\u7801\u8D28\u91CF"\u8FD9\u79CD\u6CA1\u6709\u6307\u5411\u7684\u8BDD\uFF09\u3002',
  "- `rewrite` \u7684 text \u662F**\u66FF\u6362\u6389\u90A3\u6BB5\u5F15\u6587**\u7684\u6B63\u6587\uFF0C\u6240\u4EE5\u53EA\u5199\u90A3\u6BB5\u8BDD\u672C\u8EAB\uFF0C\u4E0D\u8981\u5E26\u524D\u7F00\u540E\u7F00\u3002"
].join("\n");
var buildTierSystem = (tier) => [
  RELAY_ROLE,
  UPSTREAM_MISSION,
  TIER_STRATEGY_BLOCKS[tier],
  UPSTREAM_RULES,
  UPSTREAM_STYLE,
  DOMAIN_QUALITY_BLOCK
].join("\n\n");
var OPTIMIZER_SPECS = {
  light: { temperature: 0.2, system: buildTierSystem("light") },
  standard: { temperature: 0.3, system: buildTierSystem("standard") },
  heavy: { temperature: 0.3, system: buildTierSystem("heavy") }
};
var OPTIMIZER_OUTPUT_CONTRACT = OPTIMIZER_OUTPUT_CONTRACT_V2;

// src/client/OptimizerPromptEditor.tsx
var import_jsx_runtime7 = require("react/jsx-runtime");
function builtinTaskPrompt(tier) {
  return OPTIMIZER_SPECS[tier]?.system ?? OPTIMIZER_SPECS.standard.system;
}
function OptimizerPromptEditor({ tier, value, onChange }) {
  const label = OPTIMIZER_TIERS.find((item) => item.id === tier)?.label ?? tier;
  const custom = value.trim() !== "";
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: { ...row, borderTop: "none", flexDirection: "column", alignItems: "stretch", gap: 8 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: rowText, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: rowTitle, children: [
        `\u672C\u6863\u63D0\u793A\u8BCD\uFF08${label}\uFF09`,
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { style: { marginLeft: 8, opacity: 0.75 }, children: custom ? "\u81EA\u5B9A\u4E49" : "\u5185\u7F6E" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: rowDesc, children: [
        "\u7559\u7A7A = \u7528\u63D2\u4EF6\u5185\u7F6E\u90A3\u4EFD\u3002\u6539\u7684\u662F\u300C\u4EFB\u52A1\u4E0E\u98CE\u683C\u300D\u8FD9\u6BB5\uFF1B",
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("strong", { children: "JSON \u8F93\u51FA\u5951\u7EA6" }),
        "\u7531\u63D2\u4EF6\u5728\u672B\u5C3E\u8FFD\u52A0\u3001\u4E0D\u5728\u8FD9\u91CC\u6539 \u2014\u2014 \u5BBF\u4E3B\u9760\u5B83\u9010\u6761\u6838\u5BF9\u300C\u6BCF\u6761\u8865\u5168\u90FD\u6307\u56DE\u4F60\u539F\u8BDD\u91CC\u7684\u67D0\u53E5\u300D\uFF0C\u5951\u7EA6\u88AB\u6539\u6389\u8FD9\u5957\u6821\u9A8C\u5C31\u6CA1\u4E86\u3002"
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
      "textarea",
      {
        value,
        placeholder: "\u7559\u7A7A = \u7528\u5185\u7F6E\u63D0\u793A\u8BCD\u3002\u70B9\u4E0B\u9762\u7684\u300C\u8F7D\u5165\u5185\u7F6E\u7248\u300D\u53EF\u4EE5\u5148\u628A\u5185\u7F6E\u90A3\u4EFD\u6284\u8FDB\u6765\u518D\u6539\u3002",
        maxLength: OPTIMIZER_PROMPT_MAX,
        spellCheck: false,
        rows: value.trim() === "" ? 3 : Math.min(16, Math.max(6, Math.ceil(value.length / 60))),
        onChange: (event) => {
          onChange(event.target.value);
        },
        style: { ...textInput, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        "button",
        {
          type: "button",
          style: pill,
          title: "\u628A\u5185\u7F6E\u90A3\u4EFD\u4EFB\u52A1\u63D0\u793A\u8BCD\u6284\u8FDB\u8F93\u5165\u6846\uFF0C\u65B9\u4FBF\u5728\u6B64\u57FA\u7840\u4E0A\u6539",
          onClick: () => {
            onChange(builtinTaskPrompt(tier));
          },
          children: "\u8F7D\u5165\u5185\u7F6E\u7248"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        "button",
        {
          type: "button",
          style: pill,
          disabled: !custom,
          title: "\u6E05\u7A7A\u81EA\u5B9A\u4E49\uFF0C\u6539\u7528\u5185\u7F6E\u63D0\u793A\u8BCD",
          onClick: () => {
            onChange("");
          },
          children: "\u6062\u590D\u5185\u7F6E"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { style: { ...rowDesc, flex: "1 1 auto" }, children: `\u5F53\u524D\u5B57\u6570 ${String(value.length)} / ${String(OPTIMIZER_PROMPT_MAX)}` })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("details", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("summary", { style: { ...rowDesc, cursor: "pointer" }, children: "\u770B\u63D2\u4EF6\u56FA\u5B9A\u8FFD\u52A0\u7684\u90A3\u6BB5\u8F93\u51FA\u5951\u7EA6" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("pre", { style: { ...rowDesc, whiteSpace: "pre-wrap", margin: "6px 0 0" }, children: OPTIMIZER_OUTPUT_CONTRACT })
    ] })
  ] });
}

// src/client/InsertModeControl.tsx
init_settings_contract();

// src/client/PillChoice.tsx
var import_jsx_runtime8 = require("react/jsx-runtime");
var base = {
  border: "0.5px solid var(--dsw-alias-border-l2)",
  background: "transparent",
  color: "var(--dsw-alias-label-tertiary)",
  borderRadius: 999,
  cursor: "pointer",
  lineHeight: 1,
  whiteSpace: "nowrap"
};
var active = {
  ...base,
  border: "0.5px solid var(--dsw-alias-brand-primary)",
  color: "var(--dsw-alias-label-primary)",
  fontWeight: 600
};
function PillChoice({
  items,
  value,
  onChange,
  ariaLabel,
  compact = false
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
    "div",
    {
      role: "group",
      "aria-label": ariaLabel,
      style: { display: "inline-flex", alignItems: "center", gap: 2, flex: "0 0 auto" },
      children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
        "button",
        {
          type: "button",
          title: item.hint,
          "aria-pressed": value === item.id,
          style: {
            ...value === item.id ? active : base,
            fontSize: compact ? 10 : 11,
            padding: compact ? "3px 5px" : "4px 7px"
          },
          onMouseDown: (event) => {
            event.preventDefault();
          },
          onClick: () => {
            onChange(item.id);
          },
          children: item.label
        },
        item.id
      ))
    }
  );
}

// src/client/InsertModeControl.tsx
var import_jsx_runtime9 = require("react/jsx-runtime");
function InsertModeControl({ mode, onChange, compact = false, label }) {
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
    PillChoice,
    {
      items: INSERT_MODES,
      value: mode,
      onChange,
      compact,
      ariaLabel: label === void 0 ? "\u53D1\u9001\u65F6\u63D2\u5165" : `\u53D1\u9001\u65F6\u63D2\u5165\uFF08${label}\uFF09`
    }
  );
}

// src/client/stats-line.ts
init_settings_contract();
var STATS_ROOT_SELECTOR = "[data-composer-stats]";
var HIT_DIGITS = 3;
var MAX_DIGITS = 15;
function countOf(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}
function billedInputTokens(usage) {
  if (usage === null || typeof usage !== "object") return 0;
  return countOf(usage.uncachedInputTokens) + countOf(usage.cacheReadTokens) + countOf(usage.cacheWriteTokens);
}
function halfUpUnits(numerator, denominator, scale) {
  return (numerator * scale * 2n + denominator) / (denominator * 2n);
}
function formatUnits(units, digits) {
  const text = units.toString().padStart(digits + 1, "0");
  if (digits === 0) return text;
  return `${text.slice(0, text.length - digits)}.${text.slice(text.length - digits)}`;
}
function cacheHitText(readTokens, totalTokens, digits = HIT_DIGITS) {
  const read = countOf(readTokens);
  const total = countOf(totalTokens);
  if (total === 0) return null;
  const places = Math.max(0, Math.floor(digits));
  const n = BigInt(read);
  const d = BigInt(total);
  if (n >= d) return formatUnits(BigInt(100) * BigInt(10) ** BigInt(places), places);
  for (let width = places; width <= MAX_DIGITS; width += 1) {
    const scale = BigInt(100) * BigInt(10) ** BigInt(width);
    const units = halfUpUnits(n, d, scale);
    if (units < scale) return formatUnits(units, width);
  }
  return null;
}
function cacheHitDisplay(usage, digits = HIT_DIGITS) {
  return cacheHitText(countOf(usage?.cacheReadTokens), billedInputTokens(usage), digits);
}
var CACHE_HIT_NODE = /^(?:缓存命中|Cache hit)\s+[\d.]+\s*%$/;
var CACHE_HIT_TAIL = /((?:缓存命中|Cache hit)\s+)[\d.]+\s*%/g;
function rewriteCacheHitText(text, display) {
  if (!CACHE_HIT_NODE.test(text)) return null;
  const next = text.replace(/[\d.]+(?=\s*%$)/, display);
  return next === text ? null : next;
}
function rewriteCacheHitLabel(label, display) {
  const next = label.replace(CACHE_HIT_TAIL, `$1${display}%`);
  return next === label ? null : next;
}
function statsLineEnabled(settings) {
  return activeSections(settings).stats;
}

// src/client/SettingsSection.tsx
init_pricing();

// src/client/ui-kit.tsx
var import_react10 = require("react");
var import_react_dom2 = require("react-dom");
var import_jsx_runtime10 = require("react/jsx-runtime");
var HINT_EDGE = 12;
var HINT_WIDTH = 280;
var HINT_FLIP_ROOM = 120;
var useIsoLayoutEffect = typeof window === "undefined" ? import_react10.useEffect : import_react10.useLayoutEffect;
function Card(props) {
  const classes = ["dsh-ux-card"];
  if (props.open === true) classes.push("dsh-ux-cardOpen");
  if (props.off === true) classes.push("dsh-ux-cardOff");
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("section", { className: classes.join(" "), children: [
    props.head,
    props.children
  ] });
}
function CardTitle(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { className: "dsh-ux-cardHeadText", children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { className: "dsh-ux-cardTitleRow", children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "dsh-ux-cardName", children: props.name }),
      props.hint !== void 0 && props.hint !== "" && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Hint, { text: props.hint, insideButton: true })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "dsh-ux-cardDescription", children: props.summary })
  ] });
}
function CardChevron(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
    "span",
    {
      className: props.open ? "dsh-ux-cardChevron dsh-ux-cardChevronOpen" : "dsh-ux-cardChevron",
      "aria-hidden": "true",
      children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("svg", { width: "14", height: "14", viewBox: "0 0 14 14", fill: "none", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
        "path",
        {
          d: "M3.25 5.5L7 9.25L10.75 5.5",
          stroke: "currentColor",
          strokeWidth: "1.4",
          strokeLinecap: "round",
          strokeLinejoin: "round"
        }
      ) })
    }
  );
}
function Hint(props) {
  const { text, insideButton = false } = props;
  const badge = (0, import_react10.useRef)(null);
  const [hover, setHover] = (0, import_react10.useState)(false);
  const [pinned, setPinned] = (0, import_react10.useState)(false);
  const [placement, setPlacement] = (0, import_react10.useState)(null);
  const open = hover || pinned;
  const measure = (0, import_react10.useCallback)(() => {
    const rect = badge.current?.getBoundingClientRect();
    if (rect === void 0) {
      setPlacement(null);
      return;
    }
    const width = Math.min(HINT_WIDTH, Math.max(160, window.innerWidth - HINT_EDGE * 2));
    const left = Math.min(
      Math.max(rect.left - 4, HINT_EDGE),
      Math.max(HINT_EDGE, window.innerWidth - HINT_EDGE - width)
    );
    setPlacement(
      window.innerHeight - rect.bottom >= HINT_FLIP_ROOM ? { left, width, top: rect.bottom + 6 } : { left, width, bottom: window.innerHeight - rect.top + 6 }
    );
  }, []);
  useIsoLayoutEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }
    measure();
  }, [open, measure]);
  (0, import_react10.useEffect)(() => {
    if (!open) return;
    const relayout = () => {
      measure();
    };
    window.addEventListener("scroll", relayout, true);
    window.addEventListener("resize", relayout);
    return () => {
      window.removeEventListener("scroll", relayout, true);
      window.removeEventListener("resize", relayout);
    };
  }, [open, measure]);
  (0, import_react10.useEffect)(() => {
    if (!pinned) return;
    const onPointerDown = (event) => {
      const target = event.target;
      if (target !== null && badge.current?.contains(target) === true) return;
      if (target !== null && target.closest?.("[data-dsh-ux-hint]") !== null) return;
      setPinned(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setPinned(false);
    };
    document.addEventListener("mousedown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [pinned]);
  const toggle = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setPinned((current) => !current);
  };
  const shared = {
    className: open ? "dsh-ux-hint dsh-ux-hintOpen" : "dsh-ux-hint",
    title: text,
    onClick: toggle,
    onMouseEnter: () => {
      setHover(true);
    },
    onMouseLeave: () => {
      setHover(false);
    }
  };
  const bubble = open && placement !== null ? (0, import_react_dom2.createPortal)(
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
      "div",
      {
        "data-dsh-ux-hint": "",
        role: "tooltip",
        className: "dsh-ux-hintBubble",
        style: {
          left: placement.left,
          width: placement.width,
          top: placement.top,
          bottom: placement.bottom
        },
        children: text
      }
    ),
    document.body
  ) : null;
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_jsx_runtime10.Fragment, { children: [
    insideButton ? (
      // 外层已经是 <button>：这里只能是 span，否则按钮套按钮（无效 HTML，点击也会打架）。
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
        "span",
        {
          ref: (node) => {
            badge.current = node;
          },
          ...shared,
          "aria-hidden": "true",
          children: "?"
        }
      )
    ) : /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
      "button",
      {
        ref: (node) => {
          badge.current = node;
        },
        type: "button",
        ...shared,
        "aria-label": `\u8BF4\u660E\uFF1A${text}`,
        "aria-expanded": open,
        children: "?"
      }
    ),
    bubble
  ] });
}
function Segmented(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
    "div",
    {
      role: "group",
      "aria-label": props.ariaLabel,
      className: props.compact === true ? "dsh-ux-segmented dsh-ux-segmentedCompact" : "dsh-ux-segmented",
      children: props.items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
        "button",
        {
          type: "button",
          title: item.hint,
          "aria-pressed": props.value === item.id,
          className: props.value === item.id ? "dsh-ux-segment dsh-ux-segmentOn" : "dsh-ux-segment",
          onMouseDown: (event) => {
            event.preventDefault();
          },
          onClick: () => {
            props.onChange(item.id);
          },
          children: item.label
        },
        item.id
      ))
    }
  );
}
function Row(props) {
  const classes = ["dsh-ux-row"];
  if (props.first === true) classes.push("dsh-ux-rowFirst");
  if (props.stacked === true) classes.push("dsh-ux-rowStacked");
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: classes.join(" "), children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "dsh-ux-rowText", children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "dsh-ux-rowTitle", children: [
        props.title,
        props.hint !== void 0 && props.hint !== "" && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Hint, { text: props.hint })
      ] }),
      props.desc !== void 0 && props.desc !== "" && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "dsh-ux-rowDesc", children: props.desc })
    ] }),
    props.children !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "dsh-ux-rowControl", children: props.children })
  ] });
}
function GroupLabel(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "dsh-ux-groupLabel", children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { children: props.children }),
    props.hint !== void 0 && props.hint !== "" && /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Hint, { text: props.hint })
  ] });
}

// src/client/SettingsSection.tsx
var import_jsx_runtime11 = require("react/jsx-runtime");
function FoldCard(props) {
  const [open, setOpen] = (0, import_react11.useState)(false);
  const off = props.toggle !== void 0 && props.toggle.checked === false;
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
    Card,
    {
      open,
      off,
      head: /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dsh-ux-cardHeaderRow", children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
          "button",
          {
            type: "button",
            className: "dsh-ux-cardHeader",
            "aria-expanded": open,
            onClick: () => {
              setOpen((current) => !current);
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
                CardTitle,
                {
                  name: props.name,
                  hint: props.hint,
                  summary: off ? `\u672A\u542F\u7528 \xB7 ${props.summary}` : props.summary
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(CardChevron, { open })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "dsh-ux-cardControls", children: [
          props.controls,
          props.toggle !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
            Switch,
            {
              small: true,
              label: `${props.name}\uFF1A\u542F\u7528\u8FD9\u4E00\u680F`,
              checked: props.toggle.checked,
              disabled: props.toggle.disabled === true,
              onChange: props.toggle.onChange
            }
          )
        ] })
      ] }),
      children: open && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { className: "dsh-ux-cardBody", children: props.children })
    }
  );
}
function KeyRow(props) {
  const { title, desc, value, presets, conflict, onChange, first } = props;
  const [recording, setRecording] = (0, import_react11.useState)(false);
  const [error, setError] = (0, import_react11.useState)(null);
  (0, import_react11.useEffect)(() => {
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
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(Row, { title, desc, first, stacked: true, children: [
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { style: kbd, children: displayChord(value) }),
    !recording && presets.map((preset) => /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
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
    !recording && value !== "" && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("button", { type: "button", style: pill, onClick: () => {
      setError(null);
      onChange("");
    }, children: "\u6E05\u9664" }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
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
    recording && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("button", { type: "button", style: pill, onClick: () => {
      setRecording(false);
      setError(null);
    }, children: "Esc \u53D6\u6D88" }),
    error !== null && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { style: { color: "var(--dsw-alias-state-error-primary)", fontSize: 12 }, children: error })
  ] });
}
function Switch(props) {
  const { checked, onChange, label, small = false, disabled = false } = props;
  const width = small ? 30 : 36;
  const height = small ? 16 : 20;
  const knob = small ? 12 : 14;
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
    "button",
    {
      type: "button",
      role: "switch",
      "aria-checked": checked,
      "aria-label": label,
      title: label,
      onClick: () => {
        onChange(!checked);
      },
      style: {
        width,
        height,
        borderRadius: 999,
        border: "0.5px solid var(--dsw-alias-border-l2)",
        cursor: "pointer",
        background: checked ? "var(--dsw-alias-button-primary-fill)" : "var(--dsw-alias-interactive-bg-hover)",
        position: "relative",
        flex: "0 0 auto",
        padding: 0
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
        "span",
        {
          style: {
            position: "absolute",
            top: small ? 1 : 2,
            left: checked ? width - knob - (small ? 1 : 2) : small ? 1 : 2,
            width: knob,
            height: knob,
            borderRadius: "50%",
            background: checked ? "var(--dsw-alias-label-primary-foreground)" : "var(--dsw-alias-label-secondary)",
            transition: "left 0.12s ease"
          }
        }
      )
    }
  );
}
function MiniToggle(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "dsh-ux-miniToggle", children: [
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dsh-ux-miniToggleLabel", children: props.label }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Switch, { small: true, label: props.label, checked: props.checked, onChange: props.onChange })
  ] });
}
function ToggleRow(props) {
  const { label, desc, checked, onChange, action, first } = props;
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(Row, { title: label, desc, first, children: [
    action !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("button", { type: "button", style: pill, onClick: action.onClick, children: action.label }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Switch, { label, checked, onChange })
  ] });
}
function TextFieldRow(props) {
  const { title, desc, value, placeholder, maxLength, onChange, action, first } = props;
  const [draft, setDraft] = (0, import_react11.useState)(value);
  const focused = (0, import_react11.useRef)(false);
  (0, import_react11.useEffect)(() => {
    if (!focused.current) setDraft(value);
  }, [value]);
  const commit = () => {
    if (draft === value) return;
    onChange(draft.trim());
  };
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Row, { title, desc, first, stacked: true, children: /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8, width: "100%" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
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
    action !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("button", { type: "button", style: pill, onClick: action.onClick, children: action.label })
  ] }) });
}
function QuickPromptsEditor(props) {
  const [draft, setDraft] = (0, import_react11.useState)(() => props.book);
  const [activeId, setActiveId] = (0, import_react11.useState)(() => props.book.categories[0]?.id ?? "");
  const [dirty, setDirty] = (0, import_react11.useState)(false);
  const [newName, setNewName] = (0, import_react11.useState)("");
  const [note2, setNote] = (0, import_react11.useState)("");
  (0, import_react11.useEffect)(() => {
    if (dirty) return;
    setDraft(props.book);
    if (!props.book.categories.some((category) => category.id === activeId)) {
      setActiveId(props.book.categories[0]?.id ?? "");
    }
  }, [props.book, dirty, activeId]);
  const edit = (next) => {
    setDirty(true);
    setDraft(next);
  };
  const current = draft.categories.find((category) => category.id === activeId) ?? draft.categories[0];
  const counts = bookCounts(draft);
  const saving = props.status === "saving";
  const failed = props.status !== "" && props.status !== "saving";
  const rowBox = {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: 8,
    borderRadius: 8,
    border: "0.5px solid var(--dsw-alias-border-l2)",
    background: "var(--dsw-alias-bg-layer-1)"
  };
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }, children: [
      draft.categories.map((category) => /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
        "button",
        {
          type: "button",
          style: category.id === current?.id ? pillActive : pill,
          onClick: () => {
            setActiveId(category.id);
          },
          children: [
            category.name,
            "\uFF08",
            category.prompts.length,
            "\uFF09"
          ]
        },
        category.id
      )),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
        "input",
        {
          type: "text",
          value: newName,
          placeholder: "\u65B0\u5206\u7C7B\u540D",
          maxLength: QUICK_CATEGORY_NAME_MAX,
          spellCheck: false,
          onChange: (event) => {
            setNewName(event.target.value);
          },
          style: { ...textInput, flex: "0 0 110px" }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
        "button",
        {
          type: "button",
          style: pill,
          disabled: draft.categories.length >= QUICK_CATEGORY_MAX,
          onClick: () => {
            edit(withCategoryAdded(draft, newName === "" ? DEFAULT_CATEGORY_NAME : newName));
            setNewName("");
          },
          children: "+ \u52A0\u5206\u7C7B"
        }
      )
    ] }),
    current === void 0 && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { style: rowDesc, children: "\u8FD8\u6CA1\u6709\u5206\u7C7B\u3002\u5148\u52A0\u4E00\u4E2A\u5206\u7C7B\uFF0C\u518D\u5F80\u91CC\u653E\u6761\u76EE\u3002" }),
    current !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(import_jsx_runtime11.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
          "input",
          {
            type: "text",
            value: current.name,
            "aria-label": "\u5206\u7C7B\u540D",
            maxLength: QUICK_CATEGORY_NAME_MAX,
            spellCheck: false,
            onChange: (event) => {
              edit(withCategoryRenamed(draft, current.id, event.target.value));
            },
            style: { ...textInput, flex: "0 0 150px" }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("button", { type: "button", style: pill, title: "\u5206\u7C7B\u4E0A\u79FB", onClick: () => {
          edit(withCategoryMoved(draft, current.id, -1));
        }, children: "\u2191" }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("button", { type: "button", style: pill, title: "\u5206\u7C7B\u4E0B\u79FB", onClick: () => {
          edit(withCategoryMoved(draft, current.id, 1));
        }, children: "\u2193" }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
          "button",
          {
            type: "button",
            style: pill,
            title: "\u5220\u9664\u8FD9\u4E2A\u5206\u7C7B\uFF08\u8FDE\u540C\u5B83\u91CC\u9762\u7684\u6761\u76EE\uFF09",
            onClick: () => {
              edit(withCategoryRemoved(draft, current.id));
            },
            children: "\u2715 \u5220\u9664\u5206\u7C7B"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { style: rowDesc, children: [
          current.prompts.length,
          " / ",
          QUICK_PROMPT_MAX,
          " \u6761"
        ] })
      ] }),
      current.prompts.map((prompt) => /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { style: rowBox, children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
            "input",
            {
              type: "text",
              value: prompt.label,
              placeholder: "\u540D\u79F0\uFF0C\u5982\uFF1A\u4EC5\u8BF4\u660E\u539F\u56E0",
              maxLength: QUICK_LABEL_MAX,
              spellCheck: false,
              onChange: (event) => {
                edit(withPromptPatched(draft, current.id, prompt.id, { label: event.target.value }));
              },
              style: { ...textInput, flex: "0 0 150px" }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
            InsertModeControl,
            {
              label: prompt.label,
              mode: insertModeOf(prompt),
              onChange: (mode) => {
                edit(withInsertMode(draft, prompt.id, mode));
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { style: { flex: 1 } }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("button", { type: "button", style: pill, title: "\u4E0A\u79FB", onClick: () => {
            edit(withPromptMoved(draft, current.id, prompt.id, -1));
          }, children: "\u2191" }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("button", { type: "button", style: pill, title: "\u4E0B\u79FB", onClick: () => {
            edit(withPromptMoved(draft, current.id, prompt.id, 1));
          }, children: "\u2193" }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("button", { type: "button", style: pill, title: "\u5220\u9664\u8FD9\u6761", onClick: () => {
            edit(withPromptRemoved(draft, current.id, prompt.id));
          }, children: "\u2715" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
          "textarea",
          {
            value: prompt.prompt,
            placeholder: "\u63D0\u793A\u8BCD\u6B63\u6587\uFF1A\u70B9\u51FB\u8BE5\u6761\u76EE\u65F6\u63D2\u5165\u8F93\u5165\u6846\uFF1B\u52FE\u4E86\u300C\u9ED8\u8BA4\u63D2\u5165\u300D\u5219\u5728\u53D1\u9001\u65F6\u81EA\u52A8\u9644\u52A0\u5230\u6D88\u606F\u672B\u5C3E",
            maxLength: QUICK_TEXT_MAX,
            spellCheck: false,
            rows: Math.min(4, Math.max(2, Math.ceil(prompt.prompt.length / 46))),
            onChange: (event) => {
              edit(withPromptPatched(draft, current.id, prompt.id, { prompt: event.target.value }));
            },
            style: { ...textInput, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }
          }
        )
      ] }, prompt.id)),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
        AddPromptRow,
        {
          book: draft,
          categoryId: current.id,
          onAdd: () => {
            edit(withPromptAdded(draft, current.id));
          },
          onMove: (promptId) => {
            edit(withPromptMovedToCategory(draft, promptId, current.id));
          }
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
        "button",
        {
          type: "button",
          style: dirty ? pillActive : pill,
          disabled: !dirty || saving,
          onClick: () => {
            const next = {
              version: draft.version,
              categories: draft.categories.map((category) => ({
                ...category,
                prompts: category.prompts.filter((prompt) => prompt.prompt.trim() !== "")
              }))
            };
            const skipped = counts.prompts - bookCounts(next).prompts;
            setNote(skipped > 0 ? `\u5DF2\u8DF3\u8FC7 ${String(skipped)} \u6761\u6B63\u6587\u4E3A\u7A7A\u7684\u6761\u76EE` : "");
            props.onSave(next);
            setDirty(false);
          },
          children: saving ? "\u4FDD\u5B58\u4E2D\u2026" : dirty ? "\u4FDD\u5B58\u4FEE\u6539" : "\u5DF2\u4FDD\u5B58"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("button", { type: "button", style: pill, onClick: () => {
        props.onReload();
      }, children: "\u91CD\u65B0\u8BFB\u53D6" }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("button", { type: "button", style: pill, onClick: () => {
        props.onReset();
      }, children: "\u6062\u590D\u5185\u7F6E 9 \u6761" }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { style: rowDesc, children: [
        "\u5171 ",
        counts.categories,
        " \u4E2A\u5206\u7C7B \xB7 ",
        counts.prompts,
        " \u6761 \xB7 \u6BCF\u6B21 ",
        counts.always,
        " \u6761 \xB7 \u4EC5\u9996\u6B21 ",
        counts.first,
        " \u6761",
        note2 === "" ? "" : ` \xB7 ${note2}`,
        failed ? ` \xB7 ${props.status}` : ""
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("p", { style: rowDesc, children: [
      "\u6570\u636E\u5B58\u5728 ",
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("code", { children: "~/.dsh/quick-prompts.json" }),
      "\uFF08\u4E0E\u4F1A\u8BDD\u3001\u9879\u76EE\u65E0\u5173\uFF0C\u53EF\u5355\u72EC\u5907\u4EFD\u6216\u624B\u5DE5\u7F16\u8F91\uFF0C \u6539\u5B8C\u70B9\u300C\u91CD\u65B0\u8BFB\u53D6\u300D\u5373\u53EF\u52A0\u8F7D\uFF09\u3002"
    ] })
  ] });
}
var candidatePill = {
  ...pill,
  textAlign: "left",
  maxWidth: "100%",
  overflowWrap: "anywhere",
  lineHeight: 1.4
};
function DefaultTerminalBody(props) {
  const { settings, setField, hideMode = false } = props;
  const [note2, setNote] = (0, import_react11.useState)("");
  const [busy, setBusy] = (0, import_react11.useState)(false);
  const candidates = settings.terminalCandidates;
  if (settings.terminalEffective === "unsupported") {
    return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { style: hintInfo, children: "\u672C\u63D2\u4EF6\u53EA\u5728 Windows \u4E0A\u63A5\u7BA1\u7EC8\u7AEF\uFF08Windows \u4E0A DSH \u9ED8\u8BA4\u7ED9\u6A21\u578B\u7684\u662F PowerShell\uFF09\u3002\u5F53\u524D\u5E73\u53F0\u4E0D\u9700\u8981\u5B83\uFF0C \u8FD9\u91CC\u7684\u8BBE\u7F6E\u4E0D\u4F1A\u751F\u6548\u3002" });
  }
  const discover = async () => {
    setBusy(true);
    setNote("");
    try {
      const response = await fetch(TERMINAL_API_PATH, { method: "POST" });
      const parsed = await response.json();
      const found = sanitizeTerminalCandidates(parsed.candidates);
      setNote(found.length === 0 ? "\u6CA1\u6709\u627E\u5230\u53EF\u7528\u7684 bash\uFF08WSL \u7684 bash.exe \u4F1A\u88AB\u5FFD\u7565\uFF0C\u5B83\u6309 Linux \u89C4\u5219\u89E3\u91CA\u8DEF\u5F84\uFF09" : `\u627E\u5230 ${String(found.length)} \u4E2A\u5019\u9009\uFF0C\u5DF2\u5217\u5728\u4E0B\u65B9`);
    } catch (error) {
      setNote(`\u81EA\u52A8\u53D1\u73B0\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(import_jsx_runtime11.Fragment, { children: [
    !hideMode && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
      Row,
      {
        title: "\u7EC8\u7AEF\u5DE5\u5177",
        desc: TERMINAL_MODES.find((item) => item.id === settings.terminalMode)?.hint ?? "",
        first: true,
        stacked: true,
        children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
          Segmented,
          {
            items: TERMINAL_MODES,
            value: settings.terminalMode,
            onChange: (mode) => {
              setField(TERMINAL_MODE_FIELD, mode);
            },
            ariaLabel: "\u7EC8\u7AEF\u5DE5\u5177"
          }
        )
      }
    ),
    settings.terminalMode !== "pwsh" && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(import_jsx_runtime11.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
        TextFieldRow,
        {
          title: "Git Bash \u8DEF\u5F84",
          desc: "\u7559\u7A7A = \u7528\u81EA\u52A8\u63A2\u6D4B\u5230\u7684\u90A3\u4E00\u4E2A\uFF08\u5148\u627E git\uFF0C\u518D\u7531\u540C\u4E00\u4E2A\u5B89\u88C5\u53CD\u63A8 bash\uFF09",
          value: settings.terminalBashPath,
          placeholder: "\u7559\u7A7A = \u81EA\u52A8",
          maxLength: 400,
          onChange: (next) => {
            setField(TERMINAL_BASH_PATH_FIELD, next);
          },
          action: { label: busy ? "\u63A2\u6D4B\u4E2D\u2026" : "\u81EA\u52A8\u53D1\u73B0", onClick: () => {
            void discover();
          } }
        }
      ),
      candidates.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { style: { display: "flex", flexDirection: "column", gap: 6, marginTop: 2 }, children: candidates.map((candidate) => /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
        "button",
        {
          type: "button",
          title: candidate.path,
          style: candidate.path === settings.terminalBashPath ? { ...candidatePill, ...pillActive } : candidatePill,
          onClick: () => {
            setField(TERMINAL_BASH_PATH_FIELD, candidate.path);
          },
          children: [
            candidate.label,
            "\uFF1A",
            candidate.path,
            candidate.explicit ? "\uFF08\u4F60\u586B\u7684\uFF09" : ""
          ]
        },
        candidate.path
      )) }),
      note2 !== "" && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { style: hintInfo, children: note2 })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("p", { style: hintInfo, children: [
      "\u72B6\u6001\uFF1A",
      settings.terminalStatus === "" ? "\u7B49\u5F85\u5BBF\u4E3B\u534A\u63A2\u6D4B\u2026" : settings.terminalStatus
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { style: hintInfo, children: "\xB7 \u6362\u6210 Git Bash \u540E\uFF0C\u6A21\u578B\u770B\u5230\u7684\u7EC8\u7AEF\u5DE5\u5177\u5C31\u53EB bash\uFF08\u547D\u4EE4\u6309 bash/POSIX \u5199\uFF09\uFF0CPowerShell \u90A3\u4E2A\u5DE5\u5177 \u4F1A\u4ECE\u5B83\u7684\u5DE5\u5177\u5217\u8868\u91CC\u6D88\u5931 \u2014\u2014 \u4E00\u4E2A\u4F1A\u8BDD\u53EA\u9762\u5BF9\u4E00\u4E2A\u7EC8\u7AEF\u5DE5\u5177\u3002" }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { style: hintInfo, children: "\xB7 \u6539\u6863\u4F4D\u4F1A\u7ACB\u523B\u91CD\u65B0\u4E0B\u53D1\u7ED9\u6B63\u5728\u8DD1\u7684\u4F1A\u8BDD\u3002\u4F46\u4F1A\u8BDD\u5386\u53F2\u91CC\u53EF\u80FD\u8FD8\u7559\u7740\u65E7\u5DE5\u5177\u540D\uFF1A\u5982\u679C\u54EA\u513F\u62A5\u4E86 unknown tool \u4E4B\u7C7B\u7684\u9519\uFF0C\u8BA9\u6A21\u578B\u6539\u7528 bash \u91CD\u8BD5\u5373\u53EF\uFF0C\u4E0D\u5F71\u54CD\u4F1A\u8BDD\u672C\u8EAB\u3002" }),
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { style: hintInfo, children: "\xB7 \u53EA\u5BF9 Windows \u751F\u6548\uFF1BWSL \u7684 bash.exe \u4F1A\u88AB\u4E3B\u52A8\u6392\u9664\uFF08\u5B83\u628A D:\\ \u8FD9\u7C7B\u8DEF\u5F84\u89E3\u91CA\u6210 /mnt/d\uFF0C\u4E0E\u6A21\u578B\u624B\u91CC\u7684 Windows \u5DE5\u4F5C\u76EE\u5F55\u4E0D\u517C\u5BB9\uFF09\u3002\u6C99\u7BB1\u3001\u5BA1\u6279\u3001\u8D85\u65F6\u4E0E\u8F93\u51FA\u622A\u65AD\u7684\u884C\u4E3A\u4E0E DSH \u81EA\u5E26\u7EC8\u7AEF\u4E00\u81F4\u3002" })
  ] });
}
var RESTART_WAIT_MS = 6e4;
var RESTART_POLL_MS = 1500;
function blockedText(blocked) {
  if (blocked === "debugger") {
    return "\u8FD9\u4E2A\u5BBF\u4E3B\u6B63\u88AB\u8C03\u8BD5\u5668\u9644\u7740\uFF1A\u4ECE\u754C\u9762\u91CC\u6740\u6389\u5B83\u53EA\u4F1A\u8FDE\u8C03\u8BD5\u4F1A\u8BDD\u4E00\u8D77\u4E22\u6389\uFF0C\u8BF7\u4ECE IDE \u6216\u7EC8\u7AEF\u505C\u6B62\u5B83\u518D\u542F\u52A8\u3002";
  }
  if (blocked.startsWith("supervised:")) {
    return `\u8FD9\u4E2A\u5BBF\u4E3B\u7531 ${blocked.slice("supervised:".length)} \u5F53\u670D\u52A1\u5728\u8DD1\uFF0C\u91CD\u542F\u8BE5\u5F52\u5B83\u7BA1\uFF08\u5B83\u4F1A\u8FDE\u540C\u6574\u4E2A cgroup \u4E00\u8D77\u6536\u6389\uFF0C\u63D2\u4EF6\u81EA\u5DF1\u91CD\u542F\u53EA\u4F1A\u8BA9\u670D\u52A1\u518D\u4E5F\u8D77\u4E0D\u6765\uFF09\u3002`;
  }
  return `\u8FD9\u4E2A\u5BBF\u4E3B\u5F53\u524D\u4E0D\u5141\u8BB8\u4ECE\u754C\u9762\u91CD\u542F\uFF08${blocked}\uFF09\u3002`;
}
function useRestart() {
  const [stage, setStage] = (0, import_react11.useState)("idle");
  const [detail2, setDetail] = (0, import_react11.useState)("");
  const [blocked, setBlocked] = (0, import_react11.useState)(null);
  const readFacts = async () => {
    const response = await fetch(RESTART_API_PATH, {
      cache: "no-store",
      headers: { [RESTART_CSRF_HEADER]: RESTART_CSRF_VALUE }
    });
    if (!response.ok) return { error: `HTTP ${String(response.status)}` };
    const parsed = await response.json();
    return {
      running: typeof parsed.running === "number" ? parsed.running : 0,
      command: typeof parsed.command === "string" ? parsed.command : "",
      logHint: typeof parsed.logHint === "string" ? parsed.logHint : "",
      blocked: typeof parsed.blocked === "string" ? parsed.blocked : null,
      boot: typeof parsed.boot === "string" ? parsed.boot : null
    };
  };
  const awaitNewBoot = async (previousBoot, logHint) => {
    const deadline = Date.now() + RESTART_WAIT_MS;
    while (Date.now() < deadline) {
      await new Promise((done) => {
        setTimeout(done, RESTART_POLL_MS);
      });
      try {
        const facts = await readFacts();
        if ("error" in facts) continue;
        if (facts.boot !== null && facts.boot !== previousBoot) {
          location.reload();
          return;
        }
      } catch {
      }
    }
    setStage("failed");
    setDetail("\u7B49\u4E86 60 \u79D2\u4E5F\u6CA1\u7B49\u5230\u65B0\u8FDB\u7A0B\u3002\u8BF7\u624B\u52A8\u8FD0\u884C restart-webui.bat \u91CD\u542F\u4E00\u6B21\u3002" + (logHint === "" ? "" : `\u5BBF\u4E3B\u534A\u7684\u8BCA\u65AD\u65E5\u5FD7\u5728 ${logHint}\u3002`));
  };
  const ask = () => {
    setStage("asking");
    setDetail("\u6B63\u5728\u8BFB\u53D6\u91CD\u542F\u65B9\u5F0F\u2026");
    void (async () => {
      try {
        const facts = await readFacts();
        if ("error" in facts) {
          setStage("failed");
          setDetail(`\u8BFB\u4E0D\u5230\u91CD\u542F\u72B6\u6001\uFF08${facts.error}\uFF09\u2014\u2014 \u5BBF\u4E3B\u534A\u53EF\u80FD\u8FD8\u6CA1\u6362\u5230\u5E26\u8FD9\u6761\u8DEF\u7531\u7684\u7248\u672C\uFF0C\u8BF7\u5148\u624B\u52A8\u8FD0\u884C\u4E00\u6B21 restart-webui.bat\u3002`);
          return;
        }
        setBlocked(facts.blocked);
        if (facts.blocked !== null) {
          setStage("failed");
          setDetail(blockedText(facts.blocked));
          return;
        }
        setStage("asking");
        setDetail((facts.boot === null ? "\u5BBF\u4E3B\u534A\u8FD8\u662F\u4E0A\u4E00\u7248\uFF1A\u8FD9\u6B21\u91CD\u542F\u4F1A\u8D70\u65E7\u673A\u5236\uFF08\u5199\u811A\u672C + \u81EA\u5DF1\u9000\u51FA\uFF09\uFF0C\u91CD\u542F\u4E4B\u540E\u6309\u94AE\u5C31\u662F\u65B0\u7248\u4E86\u3002" : `\u91CD\u542F\u65B9\u5F0F\uFF1A${facts.command}\u3002`) + `\u5F53\u524D\u6709 ${String(facts.running)} \u4E2A\u4F1A\u8BDD\u5728\u8DD1 \u2014\u2014 \u91CD\u542F\u4F1A\u6253\u65AD\u5B83\u4EEC\uFF08\u5305\u62EC\u6B63\u5728\u751F\u6210\u7684\u90A3\u4E00\u8F6E\uFF09\u3002`);
      } catch (error) {
        setStage("failed");
        setDetail(`\u8BFB\u4E0D\u5230\u91CD\u542F\u72B6\u6001\uFF1A${error instanceof Error ? error.message : String(error)}`);
      }
    })();
  };
  const confirm = () => {
    setStage("restarting");
    setDetail("\u5DF2\u53D1\u51FA\u91CD\u542F\u8BF7\u6C42 \u2014\u2014 \u6B63\u5728\u7B49\u65B0\u8FDB\u7A0B\u8D77\u6765\uFF08\u8FD9\u4E2A\u9875\u9762\u4F1A\u81EA\u5DF1\u56DE\u6765\uFF09\u2026");
    void (async () => {
      let previousBoot = null;
      let logHint = "";
      try {
        const before = await readFacts();
        if (!("error" in before)) {
          previousBoot = before.boot;
          logHint = before.logHint;
        }
      } catch {
      }
      try {
        const response = await fetch(RESTART_API_PATH, {
          method: "POST",
          headers: { "content-type": "application/json", [RESTART_CSRF_HEADER]: RESTART_CSRF_VALUE },
          body: "{}"
        });
        const parsed = await response.json();
        if (response.status !== 202 && parsed.ok !== true) {
          setStage("failed");
          setDetail(`\u91CD\u542F\u6CA1\u6210\u529F\uFF1A${parsed.error ?? `HTTP ${String(response.status)}`} \u2014\u2014 \u8BF7\u624B\u52A8\u8FD0\u884C restart-webui.bat\u3002`);
          return;
        }
      } catch {
      }
      if (previousBoot === null) {
        await awaitNewBoot(previousBoot, logHint);
        return;
      }
      enterRestartScreen({ oldBoot: previousBoot, logPath: logHint });
    })();
  };
  const cancel = () => {
    setStage("idle");
    setDetail("");
  };
  return { stage, detail: detail2, blocked, ask, confirm, cancel };
}
function RestartButton({ restart }) {
  const busy = restart.stage === "restarting" || restart.stage === "asking";
  const blocked = restart.blocked;
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
    "button",
    {
      type: "button",
      className: "dsh-ux-restartButton",
      disabled: busy || blocked !== null,
      title: blocked === null ? "\u91CD\u542F DSH\uFF1A\u8BA9\u5BBF\u4E3B\u534A\u7684\u65B0\u4EE3\u7801\uFF08\u9ED8\u8BA4\u7EC8\u7AEF\u3001\u952E\u4F4D schema\uFF09\u751F\u6548\u3002\u70B9\u4E00\u4E0B\u4F1A\u5148\u8BA9\u4F60\u786E\u8BA4\u4E00\u6B21\u3002" : blockedText(blocked),
      onClick: () => {
        restart.ask();
      },
      children: restart.stage === "restarting" ? "\u91CD\u542F\u4E2D\u2026" : "\u91CD\u542F DSH"
    }
  );
}
function RefreshButton({ busy }) {
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
    "button",
    {
      type: "button",
      className: "dsh-ux-restartButton",
      disabled: busy,
      title: "\u5237\u65B0\u9875\u9762\uFF1A\u8BA9\u63D2\u4EF6\u5BA2\u6237\u7AEF\u534A\u7684\u65B0\u4EE3\u7801\uFF08\u8BBE\u7F6E\u9875 / \u53F3\u952E\u83DC\u5355 / \u952E\u4F4D / \u5FEB\u6377\u6307\u4EE4\u9762\u677F\uFF09\u751F\u6548\u3002\u4E0D\u91CD\u542F DSH\u3001\u4E0D\u6253\u65AD\u6B63\u5728\u8DD1\u7684\u4F1A\u8BDD\u3002",
      onClick: () => {
        window.location.reload();
      },
      children: "\u5237\u65B0"
    }
  );
}
function RestartBanner({ restart }) {
  if (restart.stage === "idle") return null;
  const failed = restart.stage === "failed";
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: failed ? "dsh-ux-restartBanner dsh-ux-restartBannerFailed" : "dsh-ux-restartBanner", children: [
    /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dsh-ux-restartBannerText", children: restart.detail }),
    restart.stage === "asking" && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "dsh-ux-restartBannerActions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("button", { type: "button", className: "dsh-ux-restartGo", onClick: () => {
        restart.confirm();
      }, children: "\u786E\u8BA4\u91CD\u542F" }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("button", { type: "button", className: "dsh-ux-restartCancel", onClick: () => {
        restart.cancel();
      }, children: "\u53D6\u6D88" })
    ] }),
    failed && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dsh-ux-restartBannerActions", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("button", { type: "button", className: "dsh-ux-restartCancel", onClick: () => {
      restart.cancel();
    }, children: "\u77E5\u9053\u4E86" }) })
  ] });
}
function SettingsSection({ useLive, useBook, useBookStatus, useWriteNotice, actions }) {
  const settings = useLive((item) => item);
  const book = useBook((item) => item);
  const bookStatus = useBookStatus((item) => item);
  const writeNotice = useWriteNotice((item) => item);
  const [conflict, setConflict] = (0, import_react11.useState)(null);
  const restart = useRestart();
  const sections = activeSections(settings);
  const [autostartEnabled, setAutostartEnabled] = (0, import_react11.useState)(false);
  const autostart = useAutostart(setAutostartEnabled);
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
  const keySummary = `\u53D1\u9001 ${displayChord(settings.sendKey)} \xB7 \u6362\u884C ${displayChord(settings.newlineKey)}`;
  const panelSize = typeof settings.panelWidth === "number" && typeof settings.panelHeight === "number" ? `${settings.panelWidth}\xD7${settings.panelHeight}` : "\u5C3A\u5BF8\u7528\u5B98\u65B9\u9ED8\u8BA4";
  const panelSummary = `\u8FB9\u7F18\u7F29\u653E ${settings.panelResize ? "\u5F00" : "\u5173"} \xB7 ${panelSize}`;
  const navFold = useNavFold();
  const quickCounts = bookCounts(book);
  const quickSummary = `${quickCounts.categories} \u4E2A\u5206\u7C7B \xB7 ${quickCounts.prompts} \u6761 \xB7 \u6BCF\u6B21 ${quickCounts.always} \xB7 \u4EC5\u9996\u6B21 ${quickCounts.first} \xB7 \u4F18\u5316\u6863\u4F4D ${OPTIMIZER_TIERS.find((item) => item.id === settings.optimizerTier)?.label ?? "\u9AD8\u7EA7"}`;
  const terminalSummary = sections.terminal === false ? settings.terminalMode === "pwsh" ? "\u4FDD\u6301 PowerShell" : "\u6253\u5F00\u540E\u63A5\u7BA1\u7EC8\u7AEF" : settings.terminalEffective === "unsupported" ? "\u975E Windows\uFF1A\u4E0D\u9700\u8981" : settings.terminalMode === "pwsh" ? "\u5F53\u524D\uFF1A\u4FDD\u6301 PowerShell" : settings.terminalEffective === "bash" ? "\u5F53\u524D\uFF1AGit Bash" : "\u5F53\u524D\uFF1APowerShell\uFF08\u672A\u63A5\u7BA1\uFF09";
  const statsSummary = `${HIT_DIGITS} \u4F4D\u5C0F\u6570`;
  const costSummary = (() => {
    const models = settings.priceOverrides === void 0 ? [] : Object.keys(settings.priceOverrides);
    const price = models.length === 0 ? "\u6309\u5B98\u65B9\u520A\u4F8B\u4EF7\u4F30\u7B97" : `\u5DF2\u8986\u76D6 ${models.length} \u4E2A\u6A21\u578B\u7684\u5355\u4EF7`;
    const holidays = effectiveHolidays(settings.peakHolidays, settings.syncedPrices?.holidays);
    const holidayText = holidays.source === "manual" ? ` \xB7 \u81EA\u5B9A\u4E49\u8282\u5047\u65E5 ${holidays.days.length} \u5929` : holidays.source === "auto" ? ` \xB7 \u8282\u5047\u65E5\u81EA\u52A8 ${holidays.autoCount} \u5929` : "";
    const synced = settings.syncedPrices;
    const count2 = synced?.modelsDevCount;
    const sync = count2 === void 0 ? synced?.eras === void 0 || synced.eras.length === 0 ? "" : ` \xB7 \u5DF2\u540C\u6B65 ${synced.eras.length} \u4E2A\u4EF7\u683C\u6863` : ` \xB7 \u7B2C\u4E09\u65B9\u4EF7\u76EE ${count2} \u4E2A\u6A21\u578B`;
    return `${price}${holidayText}${sync}`;
  })();
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dsh-ux-settings", style: { padding: "4px 2px" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("section", { className: "dsh-ux-card dsh-ux-cardTop", children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dsh-ux-cardHeaderStatic", children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "dsh-ux-cardHeadText", children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("h2", { className: "dsh-ux-cardName", children: "\u8F93\u5165\u4F53\u9A8C" }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { className: "dsh-ux-cardDescription", children: "dsh-composer-ux \xB7 \u4E3B\u804A\u5929\u8F93\u5165\u6846\u7684\u952E\u4F4D\u3001\u5FEB\u6377\u6307\u4EE4\u4E0E\u8BBE\u7F6E\u9762\u677F\uFF1B\u8BBE\u7F6E\u5373\u65F6\u751F\u6548\u5E76\u6301\u4E45\u4FDD\u5B58\u3002" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "dsh-ux-cardActions", children: [
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(RefreshButton, { busy: restart.stage === "restarting" || restart.stage === "asking" }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(RestartButton, { restart }),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
            "a",
            {
              className: "dsh-ux-cardLink",
              href: REPO_URL,
              target: "_blank",
              rel: "noreferrer noopener",
              title: "\u5728 GitHub \u4E0A\u67E5\u770B\u8FD9\u4E2A\u63D2\u4EF6\uFF08\u65B0\u6807\u7B7E\u6253\u5F00\uFF09",
              children: [
                "GitHub ",
                /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { "aria-hidden": "true", children: "\u2197" })
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
            "a",
            {
              className: "dsh-ux-cardLink",
              href: SITE_URL,
              target: "_blank",
              rel: "noreferrer noopener",
              title: "\u6253\u5F00 DSH \u5B98\u7F51\uFF08\u65B0\u6807\u7B7E\uFF09",
              children: [
                "\u5B98\u7F51 ",
                /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { "aria-hidden": "true", children: "\u2197" })
              ]
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(RestartBanner, { restart }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
        FoldCard,
        {
          name: "\u81EA\u68C0",
          hint: "\u53EA\u8BFB\u53D6\u3001\u4E0D\u6539\u4EFB\u4F55\u8BBE\u7F6E\uFF1B\u8868\u91CC\u7684\u6BCF\u4E00\u884C\u90FD\u80FD\u5728\u6E90\u7801\u91CC\u627E\u5230\u5BF9\u5E94\u4F4D\u7F6E\u3002",
          summary: "\u628A\u63D2\u4EF6\u5404\u5904\u72B6\u6001\u644A\u6210\u4E00\u5F20\u8868\uFF08\u5B57\u6BB5 / \u5F00\u5173 / \u7EC8\u7AEF / \u5FEB\u6377\u6307\u4EE4 / \u73AF\u5883\uFF09",
          children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(DoctorCard, {})
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
        FoldCard,
        {
          name: "\u81EA\u542F\u52A8",
          hint: "\u4EE5\u6CE8\u518C\u8868\u4E3A\u51C6\uFF1A\u8FD9\u91CC\u663E\u793A\u7684\u662F\u5BBF\u4E3B\u5F53\u524D\u8BFB\u5230\u7684\u72B6\u6001\uFF0C\u4E0D\u662F\u4E0A\u6B21\u70B9\u4E86\u4EC0\u4E48\u3002\u4E24\u4E2A\u8FD0\u884C\u65F6\u5404\u5199\u5404\u7684\u542F\u52A8\u9879\uFF0C\u4E92\u4E0D\u8986\u76D6\u3002",
          summary: autostart.state?.supported === false ? "\u4EC5 Windows \u652F\u6301\uFF08\u767B\u5F55\u65F6\u81EA\u52A8\u62C9\u8D77\u5F53\u524D\u8FD9\u4E2A\u8FD0\u884C\u65F6\uFF09" : autostartEnabled ? "\u5F00\u542F\u4E2D \xB7 \u767B\u5F55 Windows \u65F6\u81EA\u52A8\u62C9\u8D77\u5F53\u524D\u8FD9\u4E2A\u8FD0\u884C\u65F6" : "\u767B\u5F55\u65F6\u81EA\u52A8\u62C9\u8D77\u5F53\u524D\u8FD9\u4E2A\u8FD0\u884C\u65F6",
          toggle: {
            checked: autostartEnabled,
            disabled: autostart.state?.supported === false,
            onChange: (next) => {
              autostart.set(next);
            }
          },
          children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(AutostartCard, { view: autostart })
        }
      ),
      writeNotice !== "" && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dsh-ux-restartBanner dsh-ux-restartBannerFailed", role: "status", children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("span", { className: "dsh-ux-restartBannerText", children: [
          "\u8BBE\u7F6E\u672A\u751F\u6548\uFF1A",
          writeNotice
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { className: "dsh-ux-restartBannerActions", children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("button", { type: "button", className: "dsh-ux-restartCancel", onClick: () => {
          actions.dismissNotice();
        }, children: "\u77E5\u9053\u4E86" }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { className: "dsh-ux-cardBody", children: [
        /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
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
        !settings.enabled && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { style: hintInfo, children: "\u5DF2\u505C\u7528\uFF1A\u53D1\u9001/\u6362\u884C\u952E\u4F4D\u3001\u53F3\u952E\u83DC\u5355\u3001\u8BBE\u7F6E\u9762\u677F\u6EDA\u52A8\u4E0E\u8FB9\u7F18\u7F29\u653E\u5747\u4E0D\u518D\u751F\u6548\uFF0C\u8F93\u5165\u6846\u6062\u590D DSH \u539F\u751F\u884C\u4E3A\u3002 \u6253\u5F00\u4E0A\u65B9\u5F00\u5173\u5373\u53EF\u4E00\u952E\u6062\u590D\uFF1B\u6240\u6709\u8BBE\u7F6E\u503C\u4ECD\u4FDD\u7559\u3002" })
      ] })
    ] }),
    settings.enabled && /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(import_jsx_runtime11.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
        FoldCard,
        {
          name: "\u952E\u4F4D",
          hint: "\u53EA\u7BA1\u8F93\u5165\u6846\u91CC\u7684\u53D1\u9001\u4E0E\u6362\u884C\u3002\u672A\u7ED1\u5B9A\u7684 Enter \u7CFB\u6309\u952E\u4E0D\u4F1A\u89E6\u53D1\u53D1\u9001\u6216\u6362\u884C\uFF1B\u4E2D\u6587\u8F93\u5165\u6CD5\u7EC4\u5408\u671F\u95F4\u4E0D\u53D7\u5F71\u54CD\u3002",
          summary: keySummary,
          toggle: {
            checked: sections.keys,
            onChange: (next) => {
              actions.setField(KEYS_ENABLED_FIELD, next);
            }
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { className: "dsh-ux-lead", children: "\u652F\u6301\u5E38\u7528\u9884\u8BBE\uFF0C\u4E5F\u53EF\u4EE5\u70B9\u51FB\u300C\u81EA\u5B9A\u4E49\u2026\u300D\u540E\u76F4\u63A5\u6309\u4E0B\u4EFB\u610F\u7EC4\u5408\u952E\u5F55\u5236\uFF08Esc \u53D6\u6D88\uFF0CBackspace \u6E05\u9664\uFF09\u3002 \u672A\u7ED1\u5B9A\u7684 Enter \u7CFB\u6309\u952E\u4E0D\u4F1A\u89E6\u53D1\u53D1\u9001\u6216\u6362\u884C\uFF1BCtrl+Enter / \u2318+Enter \u672A\u88AB\u7ED1\u5B9A\u65F6\u4FDD\u7559\u539F\u300C\u52A0\u901F\u63D0\u4EA4\u300D\u884C\u4E3A\uFF1B \u4E2D\u6587\u8F93\u5165\u6CD5\u7EC4\u5408\u671F\u95F4\u4E0D\u53D7\u5F71\u54CD\u3002" }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
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
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
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
            conflictHint !== null && /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { style: hintError, children: conflictHint }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { style: { marginTop: 10 }, children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
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
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
        FoldCard,
        {
          name: "\u5FEB\u6377\u6307\u4EE4",
          hint: "\u8FD9\u91CC\u7BA1\u6E05\u5355\u5185\u5BB9\u4E0E\u9644\u52A0\u89C4\u5219\uFF1B\u8F93\u5165\u6846\u5DE5\u5177\u884C\u91CC\u90A3\u4E2A\u6309\u94AE\u53EA\u662F\u5165\u53E3\u3002\u9644\u52A0\u89C4\u5219\u6309\u5217\u8868\u987A\u5E8F\u62FC\u63A5\uFF0C\u8F93\u5165\u6846\u91CC\u4E0D\u63D0\u524D\u663E\u793A\u3002",
          summary: quickSummary,
          toggle: {
            checked: sections.quick,
            onChange: (next) => {
              actions.setField(QUICK_ENABLED_FIELD, next);
            }
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("p", { className: "dsh-ux-lead", children: [
              "\u8F93\u5165\u6846\u5DE5\u5177\u884C\u91CC\u90A3\u4E2A\u300C\u5FEB\u6377\u6307\u4EE4\u300D\u6309\u94AE\u70B9\u5F00\u5C31\u662F\u8FD9\u5F20\u6E05\u5355\uFF1A\u70B9\u6761\u76EE\u628A\u5185\u5BB9\u63D2\u5165\u8F93\u5165\u6846\u3002 \u6BCF\u6761\u53F3\u4FA7\u7684\u4E09\u9009\u4E00\u51B3\u5B9A",
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("strong", { children: "\u53D1\u9001\u65F6\u600E\u4E48\u9644\u52A0" }),
              "\uFF1A \u300C\u5173\u300D= \u53EA\u63D2\u5165\u4E0D\u9644\u52A0\uFF1B\u300C\u6BCF\u6B21\u300D= \u6BCF\u6B21\u53D1\u9001\u90FD\u9644\u52A0\u5230\u6D88\u606F",
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("strong", { children: "\u672B\u5C3E" }),
              "\uFF1B \u300C\u4EC5\u9996\u6B21\u300D= \u53EA\u5728",
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("strong", { children: "\u8FD9\u4E2A\u4F1A\u8BDD\u7684\u7B2C\u4E00\u6761\u6D88\u606F" }),
              '\u4E0A\u9644\u52A0\uFF08\u4E4B\u540E\u4E0D\u518D\u9644\u52A0\uFF0C\u5237\u65B0\u9875\u9762\u4E5F\u4E0D\u4F1A\u91CD\u590D\uFF09\u3002 \u591A\u6761\u6309\u5217\u8868\u987A\u5E8F\u62FC\u63A5\uFF0C\u8F93\u5165\u6846\u91CC\u4E0D\u63D0\u524D\u663E\u793A\u3002 \u300C\u4F18\u5316\u63D0\u793A\u8BCD\u300D\u4F1A\u7528\u53E6\u4E00\u4E2A AI \u628A\u8F93\u5165\u6846\u91CC\u7684\u8BDD\u6574\u7406\u6210\u4E00\u6761\u80FD\u76F4\u63A5\u53D1\u51FA\u53BB\u7684\u6E05\u6670\u6307\u4EE4\uFF0C \u7ED3\u679C\u76F4\u63A5\u5199\u56DE\u8F93\u5165\u6846\uFF08Ctrl+Z \u53EF\u8FD8\u539F\uFF09\u2014\u2014\u4E0D\u4F1A\u6C61\u67D3\u5F53\u524D\u5BF9\u8BDD\uFF0C\u4E5F\u4E0D\u5360\u4F60\u7684\u5BF9\u8BDD\u8F6E\u6B21\u3002 0.6.0 \u8D77\u5B83\u4E0D\u518D"\u81EA\u7531\u6539\u5199"\uFF1A\u5B83\u53EA\u80FD\u4EA7\u51FA',
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("strong", { children: "\u80FD\u6307\u56DE\u4F60\u539F\u8BDD\u67D0\u4E00\u53E5\u8BDD" }),
              '\u7684\u6761\u76EE\uFF0C \u5BBF\u4E3B\u9010\u6761\u505A\u5B57\u9762\u6BD4\u5BF9\uFF0C\u5BF9\u4E0D\u4E0A\u5C31\u4E22\u6389\u90A3\u4E00\u6761\u5E76\u5728\u72B6\u6001\u884C\u91CC\u8BB0\u8D26 \u2014\u2014 \u6240\u4EE5"\u66FF\u4F60\u53D1\u660E\u4E00\u6761\u4F60\u6CA1\u8BF4\u8FC7\u7684\u9700\u6C42"\u5728\u7ED3\u6784\u4E0A\u505A\u4E0D\u5230\u3002\u4E0B\u9762\u53EF\u4EE5\u6539\u6BCF\u4E00\u6863\u7528\u7684\u63D0\u793A\u8BCD\u3002'
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
              Row,
              {
                title: "\u4F18\u5316\u5F3A\u5EA6",
                desc: OPTIMIZER_TIERS.find((item) => item.id === settings.optimizerTier)?.hint ?? "",
                first: true,
                stacked: true,
                children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
                  Segmented,
                  {
                    items: OPTIMIZER_TIERS,
                    value: settings.optimizerTier,
                    onChange: (tier) => {
                      actions.setField(OPTIMIZER_TIER_FIELD, tier);
                    },
                    ariaLabel: "\u4F18\u5316\u5F3A\u5EA6"
                  }
                )
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
              ToggleRow,
              {
                label: "\u643A\u5E26\u4F1A\u8BDD\u4E0A\u4E0B\u6587",
                desc: "\u4F18\u5316\u65F6\u628A\u5F53\u524D\u4F1A\u8BDD\u6700\u8FD1\u7684\u5F80\u6765\uFF08\u5404 4 \u6761\u3001\u5171\u7EA6 1600 \u5B57\uFF09\u4E00\u5E76\u4EA4\u7ED9\u6A21\u578B\uFF0C\u7528\u6765\u6D88\u6B67\u4E49 \u2014\u2014 \u6BD4\u5982\u201C\u5B83\u90A3\u4E2A\u4E5F\u6539\u4E00\u4E0B\u201D\u91CC\u7684\u201C\u5B83\u201D\u6307\u8C01\u3002\u5173\u6389\u5C31\u53EA\u6309\u8349\u7A3F\u672C\u8EAB\u4F18\u5316\u3002\u4E0A\u4E0B\u6587\u53EA\u53D1\u7ED9\u4F60\u81EA\u5DF1\u914D\u7F6E\u7684\u90A3\u6761\u6A21\u578B\u8DEF\u7531\uFF1B\u5B83\u53EA\u7528\u4E8E\u7406\u89E3\uFF0C\u4E0D\u80FD\u5F53\u5F15\u6587\u4F9D\u636E\u3002",
                checked: settings.optimizerContext,
                onChange: (next) => {
                  actions.setField(OPTIMIZER_CONTEXT_FIELD, next);
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
              ToggleRow,
              {
                label: "\u8BB0\u5F55\u6BCF\u8F6E\u4F18\u5316\u53F0\u8D26",
                desc: "\u6BCF\u8F6E\u5F80 $DSH_HOME/composer-ux/optimize-log.jsonl \u8FFD\u52A0\u4E00\u6761\u5143\u6570\u636E\uFF1A\u6863\u4F4D\u3001\u8349\u7A3F\u5B57\u6570\u3001\u4E0A\u4E0B\u6587\u89C4\u6A21\u3001\u6761\u76EE\u6570\u3001\u4E22\u5F03\u6761\u6570\u4E0E\u539F\u56E0\u3001\u662F\u5426\u91CD\u8BD5\u6216\u56DE\u843D\u3001\u8017\u65F6\u3001\u8DEF\u7531\u3001\u6210\u8D25 \u2014\u2014 \u53EA\u8BB0\u6570\u5B57\u4E0E\u539F\u56E0\uFF0C\u4E0D\u8BB0\u4E00\u4E2A\u5B57\u539F\u6587\u3002\u770B\uFF1Anode scripts/recap.mjs\uFF1B\u6E05\u7A7A\uFF1Anode scripts/recap.mjs --clear",
                checked: settings.optimizerLedger,
                onChange: (next) => {
                  actions.setField(OPTIMIZER_LEDGER_FIELD, next);
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
              ToggleRow,
              {
                label: "\u91CD\u542F\u540E\u4FDD\u7559\u7ED3\u679C\u6846",
                desc: "\u6253\u5F00\u540E\uFF0C\u7ED3\u679C\u6846\u8FD9\u4E00\u4EFD\u72B6\u6001\uFF08\u6210\u54C1\u6B63\u6587\u3001\u6761\u76EE\u3001\u9010\u5B57\u5F15\u6587\u3001\u53D1\u8D77\u65F6\u7684\u8349\u7A3F\uFF09\u4F1A\u5B58\u8FDB $DSH_HOME/composer-ux/optimize-dock.json\uFF0C\u4E0B\u6B21\u542F\u52A8\u6216\u5237\u65B0\u9875\u9762\u65F6\u6062\u590D \u2014\u2014 \u5426\u5219\u91CD\u542F\u4E00\u6B21 DSH \u5C31\u4E22\u4E86\u521A\u8DD1\u51FA\u6765\u7684\u6210\u54C1\uFF0C\u518D\u770B\u8981\u518D\u82B1\u4E00\u6B21\u6A21\u578B\u8C03\u7528\u3002\u26A0 \u8FD9\u4EFD\u6587\u4EF6\u91CC**\u6709\u5185\u5BB9**\uFF08\u4E0E quick-prompts.json \u540C\u6027\u8D28\uFF09\uFF1B\u53EA\u8BB0\u5143\u6570\u636E\u7684\u90A3\u4EFD\u662F\u4E0A\u9762\u7684\u9010\u8F6E\u53F0\u8D26\u3002",
                checked: settings.optimizeKeepDock,
                onChange: (next) => {
                  actions.setField(OPTIMIZE_KEEP_DOCK_FIELD, next);
                },
                action: { label: "\u6E05\u7A7A\u7ED3\u679C\u6846\u72B6\u6001", onClick: actions.clearDockState }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
              ToggleRow,
              {
                label: "\u4F18\u5316\u65F6\u5141\u8BB8\u53EA\u8BFB\u67E5\u8BC1\u9879\u76EE\u6587\u4EF6",
                desc: "\u6253\u5F00\u540E\u89E3\u91CA\u5C42\u53EF\u4EE5\u8C03 read / glob / grep \u770B\u4E00\u773C\u9879\u76EE\u7684\u5B9E\u9645\u5185\u5BB9\uFF08\u9650\u5B9A\u672C\u4F1A\u8BDD\u5DE5\u4F5C\u76EE\u5F55\u5185\u3001\u53EA\u8BFB\u3001\u5355\u6587\u4EF6 \u2264200KB\u3001\u6BCF\u8F6E \u22643 \u6B21\u8C03\u7528\u3001\u603B\u5171 \u22643 \u8F6E\u3001\u603B\u65F6\u9650 20 \u79D2\uFF0C\u8D8A\u754C\u76F4\u63A5\u62D2\u7EDD\uFF09\u3002\u9ED8\u8BA4\u5173\uFF1A\u5DE5\u5177\u8F6E\u6B21\u8981\u82B1\u65F6\u95F4\u4E0E token\u3002\u26A0 \u67E5\u5230\u7684\u5185\u5BB9**\u4E0D\u80FD\u5F53\u5F15\u6587**\uFF1A\u6761\u76EE\u7684 quote \u4ECD\u5FC5\u987B\u51FA\u81EA\u4F60\u7684\u539F\u8BDD\uFF0C\u88C5\u914D\u5C42\u4F1A\u9010\u6761\u6821\u9A8C\u3002",
                checked: settings.optimizeReadTools,
                onChange: (next) => {
                  actions.setField(OPTIMIZE_READ_TOOLS_FIELD, next);
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
              OptimizerPromptEditor,
              {
                tier: settings.optimizerTier,
                value: settings[optimizerPromptFieldOf(settings.optimizerTier)],
                onChange: (next) => {
                  actions.setField(optimizerPromptFieldOf(settings.optimizerTier), next);
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
              Row,
              {
                title: "\u5FEB\u6377\u6307\u4EE4\u6E05\u5355",
                desc: "\u5206\u7C7B\u5728\u8FD9\u91CC\u7BA1\u7406\uFF08\u9762\u677F\u91CC\u53EA\u505A\u5207\u6362\uFF09\uFF1B\u5185\u7F6E 9 \u6761\u53EF\u4EE5\u76F4\u63A5\u7528\uFF0C\u6539\u5B8C\u8BB0\u5F97\u70B9\u300C\u4FDD\u5B58\u4FEE\u6539\u300D\u3002",
                stacked: true,
                children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("div", { style: { width: "100%" }, children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
                  QuickPromptsEditor,
                  {
                    book,
                    status: bookStatus,
                    onSave: (next) => {
                      actions.saveBook(next);
                    },
                    onReload: () => {
                      actions.reloadBook();
                    },
                    onReset: () => {
                      actions.resetBook();
                    }
                  }
                ) })
              }
            )
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
        FoldCard,
        {
          name: "\u8BBE\u7F6E\u9762\u677F",
          hint: "\u53EA\u7BA1\u8FD9\u4E2A\u8BBE\u7F6E\u9762\u677F\u7684\u5927\u5C0F\u4E0E\u8FB9\u7F18\u7F29\u653E\u3002\u5BFC\u822A\u5217\u7684\u6EDA\u52A8\u7531 DSH \u5B98\u65B9\u8D1F\u8D23\uFF0C\u672C\u63D2\u4EF6\u4E0D\u4ECB\u5165\u3002",
          summary: panelSummary,
          toggle: {
            checked: sections.panel,
            onChange: (next) => {
              actions.setField(PANEL_ENABLED_FIELD, next);
            }
          },
          controls: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
            MiniToggle,
            {
              label: "\u8FB9\u7F18\u7F29\u653E",
              checked: settings.panelResize,
              onChange: (next) => {
                actions.setField(PANEL_RESIZE_FIELD, next);
              }
            }
          ),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { className: "dsh-ux-lead", children: "\u5BFC\u822A\u5217\u7684\u6EDA\u52A8\u7531 DSH \u5B98\u65B9\u7684\u8BBE\u7F6E\u9875\u81EA\u5DF1\u8D1F\u8D23\uFF0C\u672C\u63D2\u4EF6\u4E0D\u518D\u4ECB\u5165\u3002 \u5F00\u542F\u300C\u8FB9\u7F18\u8C03\u6574\u5927\u5C0F\u300D\u540E\uFF0C\u628A\u9F20\u6807\u79FB\u5230\u8BBE\u7F6E\u9762\u677F\u7684\u8FB9\u6216\u89D2\u4E0A\uFF08\u51FA\u73B0\u9AD8\u4EAE\u6216\u5149\u6807\u53D8\u5316\uFF09\u62D6\u52A8\u5373\u53EF\u6539\u53D8\u9762\u677F\u5927\u5C0F\uFF0C \u5C3A\u5BF8\u4F1A\u8BB0\u4F4F\uFF0C\u4E0B\u6B21\u6253\u5F00\u4FDD\u6301\u3002\uFF08\u8FD9\u4E2A\u5F00\u5173\u5728\u6807\u9898\u884C\u4E0A\u3002\uFF09" }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 10 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { style: rowDesc, children: "\u5C3A\u5BF8\u9884\u8BBE\uFF1A" }),
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
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
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
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
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
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
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(GroupLabel, { hint: "\u6298\u53E0\u7684\u662F\u5DE6\u4FA7\u90A3\u4E00\u7EC4\u5165\u53E3\uFF08\u63D2\u4EF6 / \u81EA\u52A8\u5316\u4EFB\u52A1 / \u4E0A\u4E0B\u6587\u6D1E\u5BDF / MCP\u8FDE\u63A5\u5668 / \u66F4\u591A\uFF09\u3002\u4F1A\u8BDD\u5217\u8868\u4E0D\u53D7\u5F71\u54CD\uFF0CDSH \u81EA\u5E26\u7684\u300C\u6536\u8D77\u4FA7\u8FB9\u680F\u300D\u4E5F\u4E0D\u53D7\u5F71\u54CD\u3002", children: "\u4FA7\u8FB9\u680F" }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(Row, { title: "\u5168\u5C40\u9762\u677F", desc: "\u90A3\u4E00\u7EC4\u5165\u53E3\u600E\u4E48\u6446", first: true, stacked: true, children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
              Segmented,
              {
                ariaLabel: "\u5168\u5C40\u9762\u677F\u6298\u53E0\u5F62\u6001",
                items: NAV_FOLD_MODES.map((mode) => ({
                  id: mode.id,
                  label: mode.label,
                  hint: mode.id === "off" ? "\u4FDD\u6301 DSH \u539F\u6837" : mode.id === "bar" ? "\u6536\u6210\u4E00\u6761\u300C\u5168\u5C40\u9762\u677F\u300D\uFF0C\u70B9\u4E00\u4E0B\u5C55\u5F00" : "\u53EA\u7559\u4E00\u884C\u56FE\u6807\uFF0C\u60AC\u505C\u51FA\u540D\u5B57"
                })),
                value: navFold.mode,
                onChange: (mode) => {
                  void saveNavFold({ mode });
                }
              }
            ) }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
              Row,
              {
                title: "\u73B0\u5728\u6536\u8D77",
                desc: navFold.mode === "off" ? "\u5F62\u6001\u662F\u300C\u4E0D\u6298\u53E0\u300D\uFF0C\u8FD9\u4E2A\u5F00\u5173\u4E0D\u8D77\u4F5C\u7528" : "\u8BB0\u4F4F\u8FD9\u4E2A\u72B6\u6001\uFF1A\u4E0B\u6B21\u6253\u5F00 DSH \u6CBF\u7528",
                children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
                  Switch,
                  {
                    small: true,
                    label: "\u73B0\u5728\u6536\u8D77\u5168\u5C40\u9762\u677F",
                    checked: navFold.collapsed,
                    disabled: navFold.mode === "off",
                    onChange: (next) => {
                      void saveNavFold({ collapsed: next });
                    }
                  }
                )
              }
            )
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
        FoldCard,
        {
          name: "\u9ED8\u8BA4\u7EC8\u7AEF",
          hint: "\u53EA\u5728 Windows \u4E0A\u63A5\u7BA1\u3002\u6362\u6863\u4F1A\u7ACB\u523B\u91CD\u65B0\u4E0B\u53D1\u7ED9\u6B63\u5728\u8DD1\u7684\u4F1A\u8BDD\uFF0C\u4F46\u4F1A\u8BDD\u5386\u53F2\u91CC\u53EF\u80FD\u8FD8\u7559\u7740\u65E7\u5DE5\u5177\u540D\u3002",
          summary: terminalSummary,
          toggle: {
            checked: sections.terminal,
            onChange: (next) => {
              actions.setField(TERMINAL_ENABLED_FIELD, next);
            }
          },
          controls: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
            PillChoice,
            {
              compact: true,
              items: TERMINAL_MODES,
              value: settings.terminalMode,
              onChange: (mode) => {
                actions.setField(TERMINAL_MODE_FIELD, mode);
              },
              ariaLabel: "\u7EC8\u7AEF\u5DE5\u5177"
            }
          ),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { className: "dsh-ux-lead", children: "Windows \u4E0A DSH \u7ED9\u6A21\u578B\u7684\u7EC8\u7AEF\u5DE5\u5177\u662F PowerShell\uFF0C\u800C\u6A21\u578B\u5BF9 bash \u8BED\u6CD5\u7684\u628A\u63E1\u660E\u663E\u66F4\u597D\u3002\u8FD9\u4E00\u680F\u628A\u7EC8\u7AEF \u6362\u6210 Git Bash\uFF1A\u6A21\u578B\u770B\u5230\u7684\u5DE5\u5177\u5C31\u53EB bash\u3001PowerShell \u90A3\u4E2A\u5DE5\u5177\u4F1A\u4ECE\u5B83\u7684\u5DE5\u5177\u5217\u8868\u91CC\u6D88\u5931\uFF0C \u547D\u4EE4\u91CC\u7684\u8DEF\u5F84\u4E0E\u5F15\u53F7\u6309 bash \u89C4\u5219\u5199\u3002\u672C\u673A\u4E0D\u9700\u8981\u88C5 Git for Windows \u5230\u9ED8\u8BA4\u76EE\u5F55\u2014\u2014\u63A2\u6D4B\u4F1A\u5148\u627E git\uFF0C\u518D\u7531\u540C\u4E00\u4E2A\u5B89\u88C5\u53CD\u63A8 bash\u3002\uFF08\u6863\u4F4D\u5728\u6807\u9898\u884C\u4E0A\uFF1A\u81EA\u52A8 / Git Bash / PowerShell\u3002\uFF09" }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(DefaultTerminalBody, { settings, setField: actions.setField, hideMode: true })
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(
        FoldCard,
        {
          name: "\u7EDF\u8BA1\u884C",
          hint: "\u53EA\u6539\u8F93\u5165\u6846\u4E0B\u9762\u90A3\u4E00\u884C\u6587\u5B57\u7684\u5C0F\u6570\u4F4D\u6570\uFF08\u8FDE\u5B83\u7684\u65E0\u969C\u788D\u540D\u5B57\u4E00\u8D77\u6539\uFF09\uFF1B\u6BCF\u8F6E\u7528\u91CF\u5F39\u7A97\u4FDD\u6301\u5B98\u65B9\u539F\u6837\u3002",
          summary: statsSummary,
          toggle: {
            checked: sections.stats,
            onChange: (next) => {
              actions.setField(STATS_ENABLED_FIELD, next);
            }
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)("p", { className: "dsh-ux-lead", children: [
              "\u8F93\u5165\u6846\u4E0B\u65B9\u90A3\u884C\u7528\u91CF\u7EDF\u8BA1\u91CC\u7684\u300C\u7F13\u5B58\u547D\u4E2D xx%\u300D\u3002\u5B98\u65B9\u5E73\u65F6\u7ED9\u6574\u6570\uFF08\u300C\u7F13\u5B58\u547D\u4E2D 12%\u300D\uFF09\uFF0C \u53EA\u5728\u300C\u6574\u6570\u56DB\u820D\u4E94\u5165\u4F1A\u628A\u6CA1\u6EE1\u8BF4\u6210\u6EE1\u300D\u65F6\u624D\u81EA\u52A8\u591A\u7ED9\u51E0\u4F4D\uFF08\u300C99.95%\u300D\uFF09\u3002 \u6253\u5F00\u540E\u5E38\u6001\u7ED9 ",
              HIT_DIGITS,
              " \u4F4D\u5C0F\u6570\uFF08\u300C\u7F13\u5B58\u547D\u4E2D 12.346%\u300D\uFF09\uFF0C\u5E76",
              /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("strong", { children: "\u6CBF\u7528\u5B98\u65B9\u90A3\u6761 \u4E0D\u6492\u8C0E\u7684\u89C4\u5219" }),
              "\uFF1A\u4E00\u65E6 ",
              HIT_DIGITS,
              " \u4F4D\u5C0F\u6570\u4F1A\u51D1\u6210\u300C100.000%\u300D\u5C31\u7EE7\u7EED\u52A0\u4F4D\uFF0C \u5B81\u53EF\u663E\u793A\u300C99.9999%\u300D\uFF0C\u4E5F\u4E0D\u628A\u300C\u5DEE\u4E00\u70B9\u300D\u8BF4\u6210\u300C\u6EE1\u300D\u3002"
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("p", { style: hintInfo, children: "\u53E3\u5F84\u4E0E\u5B98\u65B9\u4E00\u81F4\uFF1A\u7F13\u5B58\u8BFB \xF7\uFF08\u672A\u7F13\u5B58\u8F93\u5165 + \u7F13\u5B58\u8BFB + \u7F13\u5B58\u5199\uFF09\u3002\u53EA\u6539\u8F93\u5165\u6846\u4E0B\u9762\u8FD9\u4E00\u884C\uFF0C \u8FDE\u5B83\u7684\u65E0\u969C\u788D\u540D\u5B57\u4E00\u8D77\u6539\uFF08\u8BFB\u5C4F\u542C\u5230\u7684\u4E5F\u662F\u4E09\u4F4D\u5C0F\u6570\uFF09\uFF1B\u70B9\u5F00\u7EDF\u8BA1\u884C\u7684\u5F39\u7A97\u3001\u6BCF\u8F6E\u7528\u91CF\u5F39\u7A97\u91CC\u7684 \u767E\u5206\u6BD4\u4FDD\u6301\u5B98\u65B9\u539F\u6837\u3002\u5173\u6389\u4E0A\u65B9\u7684\u5F00\u5173\uFF0C\u672C\u63D2\u4EF6\u4F1A\u628A\u5B98\u65B9\u90A3\u4E00\u7248\u539F\u6837\u5199\u56DE\u53BB\u3002" })
          ]
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(
        FoldCard,
        {
          name: "\u91D1\u989D",
          hint: "\u53EA\u5F71\u54CD\u672C\u63D2\u4EF6\u663E\u793A\u7684\u8D39\u7528\u4F30\u7B97\uFF0C\u4E0D\u6539\u8D26\u5355\uFF1B\u7559\u7A7A\uFF1D\u6CBF\u7528\u5B98\u65B9\u4EF7\u3002\u5CF0\u8C37\u6309\u6BCF\u7B14\u7528\u91CF\u53D1\u751F\u65F6\u523B\u7684\u6863\u7ED3\u7B97\u3002",
          summary: costSummary,
          children: /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(CostCardBody, { settings, setField: actions.setField, clearField: actions.clearField })
        }
      )
    ] })
  ] });
}

// src/client/StatsLineEntry.tsx
var import_react12 = __toESM(require("react"), 1);

// src/client/stats-dom.ts
var MAX_HOST_DEPTH = 6;
function hostOf(anchor) {
  let element = anchor?.parentElement ?? null;
  for (let depth = 0; depth < MAX_HOST_DEPTH && element !== null; depth += 1) {
    if (element.querySelector(STATS_ROOT_SELECTOR) !== null) return element;
    element = element.parentElement;
  }
  return null;
}
function rewriteCacheHit(stats, display) {
  const walker = document.createTreeWalker(stats, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node !== null) {
    const text = node.nodeValue ?? "";
    const next = rewriteCacheHitText(text, display);
    if (next !== null) node.nodeValue = next;
    node = walker.nextNode();
  }
  for (const labelled of stats.querySelectorAll("[aria-label]")) {
    const label = labelled.getAttribute("aria-label");
    if (label === null) continue;
    const next = rewriteCacheHitLabel(label, display);
    if (next !== null) labelled.setAttribute("aria-label", next);
  }
}

// src/client/StatsLineEntry.tsx
var import_jsx_runtime12 = require("react/jsx-runtime");
var SCAN_DEBOUNCE_MS = 80;
function StatsLineEntry({ useLive, useProjection }) {
  const settings = useLive((item) => item);
  const active2 = statsLineEnabled(settings);
  const usage = typeof useProjection === "function" ? useProjection("tokenUsage") : void 0;
  const target = cacheHitDisplay(usage, active2 ? HIT_DIGITS : 0);
  const anchor = import_react12.default.useRef(null);
  import_react12.default.useLayoutEffect(() => {
    const host = hostOf(anchor.current);
    if (host === null) return;
    let timer;
    const apply2 = () => {
      const stats = host.querySelector(STATS_ROOT_SELECTOR);
      if (stats === null) return;
      if (target !== null) rewriteCacheHit(stats, target);
    };
    apply2();
    if (!active2) return;
    const schedule = () => {
      if (timer !== void 0) return;
      timer = setTimeout(() => {
        timer = void 0;
        apply2();
      }, SCAN_DEBOUNCE_MS);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(host, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["aria-label"]
    });
    return () => {
      observer.disconnect();
      if (timer !== void 0) clearTimeout(timer);
    };
  }, [active2, target]);
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(
    "span",
    {
      ref: anchor,
      hidden: true,
      "aria-hidden": "true",
      "data-composer-ux-stats-anchor": "",
      style: { display: "none" }
    }
  );
}

// src/client/CostChipEntry.tsx
var import_react15 = __toESM(require("react"), 1);
var import_react_dom3 = require("react-dom");
init_pricing();

// src/usage-fold.ts
var UNKNOWN_ROUTE = "\u672A\u77E5";
function zeroBuckets() {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
}
function sameBuckets(left, right) {
  return left.inputTokens === right.inputTokens && left.outputTokens === right.outputTokens && left.cacheReadTokens === right.cacheReadTokens && left.cacheWriteTokens === right.cacheWriteTokens;
}
function count(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}
function bucketsOf(usage) {
  const source = usage;
  if (source === void 0 || source === null || typeof source !== "object") return zeroBuckets();
  return {
    inputTokens: count(source.inputTokens),
    outputTokens: count(source.outputTokens),
    cacheReadTokens: count(source.cacheReadTokens),
    cacheWriteTokens: count(source.cacheWriteTokens)
  };
}
function agreesWithProjection(fold, projection) {
  if (projection === void 0) return true;
  return sameBuckets(fold.total, bucketsOf(projection));
}

// src/client/peak-alert.ts
var import_react13 = __toESM(require("react"), 1);
init_pricing();
var TICK_MS = 1e4;
var notifiedSwitchAt = Number.NaN;
function usePeakPhase(holidays) {
  const table = holidays ?? DEFAULT_PEAK_HOLIDAYS;
  const [phase, setPhase] = import_react13.default.useState(() => peakPhaseAt(Date.now(), { holidays: table }));
  const tableKey = table.join(",");
  import_react13.default.useEffect(() => {
    const compute = () => {
      setPhase(peakPhaseAt(Date.now(), { holidays: table }));
    };
    compute();
    const timer = setInterval(compute, TICK_MS);
    return () => {
      clearInterval(timer);
    };
  }, [tableKey]);
  return phase;
}
function peakNoticeText(phase) {
  const tier = phase.inPeak ? "\u9AD8\u5CF0\u6863" : "\u7A7A\u95F2\u6863";
  const reason = !phase.inPeak && phase.holiday ? "\uFF08\u6CD5\u5B9A\u8282\u5047\u65E5\u8C37\u4EF7\uFF09" : !phase.inPeak && phase.weekend ? "\uFF08\u5468\u672B\u8C37\u4EF7\uFF09" : "";
  if (!Number.isFinite(phase.nextAtMs)) return `${tier}${reason}`;
  const target = phase.nextIntoPeak ? "\u8F6C\u9AD8\u5CF0" : "\u8F6C\u7A7A\u95F2";
  return `${tier}${reason} \xB7 ${formatCountdown(phase.minutesUntil)}\u540E${target}`;
}
function usePeakAlert(settings, holidays) {
  const phase = usePeakPhase(holidays);
  const alert = settings.peakAlert;
  const text = peakNoticeText(phase);
  import_react13.default.useEffect(() => {
    if (!alert.enabled || !alert.webNotify) return;
    if (!Number.isFinite(phase.nextAtMs)) return;
    if (phase.minutesUntil > alert.aheadMinutes) return;
    const wanted = phase.nextIntoPeak ? alert.onPeak : alert.onOffPeak;
    if (!wanted) return;
    if (notifiedSwitchAt === phase.nextAtMs) return;
    notifiedSwitchAt = phase.nextAtMs;
    try {
      if (typeof Notification === "undefined") return;
      if (Notification.permission !== "granted") return;
      const title = phase.nextIntoPeak ? "\u5373\u5C06\u8FDB\u5165\u9AD8\u5CF0\u65F6\u6BB5\uFF082 \u500D\u4EF7\uFF09" : "\u5373\u5C06\u8FDB\u5165\u7A7A\u95F2\u65F6\u6BB5\uFF08\u534A\u4EF7\uFF09";
      new Notification(title, { body: `${formatCountdown(phase.minutesUntil)}\u540E\u5207\u6362\u3002DeepSeek \u5CF0\u8C37\u6309\u65F6\u6BB5\u8BA1\u4EF7\uFF0C\u4E0D\u6025\u7684\u6D3B\u53EF\u4EE5\u7B49\u7B49\u3002` });
    } catch {
    }
  }, [alert.enabled, alert.webNotify, alert.aheadMinutes, alert.onPeak, alert.onOffPeak, phase.nextAtMs, phase.minutesUntil, phase.nextIntoPeak]);
  return { phase, text };
}

// src/client/CostChipEntry.tsx
init_provider_prices();

// src/client/session-cost.ts
var import_react14 = __toESM(require("react"), 1);
init_settings_contract();
var MIN_INTERVAL_MS = 600;
function useSessionCost(sessionId, fingerprint, force) {
  const [entry, setEntry] = import_react14.default.useState(null);
  const [loading, setLoading] = import_react14.default.useState(false);
  const lastAt = import_react14.default.useRef(0);
  const timer = import_react14.default.useRef(null);
  const inflight = import_react14.default.useRef(false);
  const again = import_react14.default.useRef(false);
  const serial = import_react14.default.useRef(0);
  const alive = import_react14.default.useRef(true);
  const runRef = import_react14.default.useRef(() => {
  });
  import_react14.default.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);
  const run = import_react14.default.useCallback(() => {
    if (typeof sessionId !== "string" || sessionId === "") return;
    if (inflight.current) {
      again.current = true;
      return;
    }
    inflight.current = true;
    again.current = false;
    lastAt.current = Date.now();
    const mine = serial.current + 1;
    serial.current = mine;
    setLoading(true);
    fetch(`${USAGE_API_PATH}?sessionId=${encodeURIComponent(sessionId)}`, {
      headers: { accept: "application/json" }
    }).then((response) => response.json()).then((next) => {
      if (!alive.current || mine !== serial.current) return;
      setEntry({ sessionId, data: next });
    }).catch(() => {
      if (!alive.current || mine !== serial.current) return;
      setEntry({ sessionId, data: { ok: false, error: "\u53D6\u4E0D\u5230\u4F1A\u8BDD\u8D39\u7528" } });
    }).finally(() => {
      inflight.current = false;
      if (!alive.current) return;
      setLoading(false);
      if (again.current) {
        again.current = false;
        runRef.current();
      }
    });
  }, [sessionId]);
  runRef.current = run;
  import_react14.default.useEffect(() => {
    if (typeof sessionId !== "string" || sessionId === "") return;
    const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastAt.current));
    if (wait === 0 || force) {
      run();
      return;
    }
    if (timer.current !== null) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      runRef.current();
    }, wait);
  }, [sessionId, fingerprint, force, run]);
  return {
    data: entry !== null && entry.sessionId === sessionId ? entry.data : null,
    loading
  };
}

// src/client/CostChipEntry.tsx
var import_jsx_runtime13 = require("react/jsx-runtime");
var VIEWPORT_MARGIN = 12;
var PANEL_MIN_WIDTH = "min(300px, calc(100vw - 24px))";
var PANEL_MAX_WIDTH = "min(440px, calc(100vw - 24px))";
function num(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
function tokenTotal(buckets) {
  if (buckets === void 0) return 0;
  return num(buckets.inputTokens) + num(buckets.outputTokens) + num(buckets.cacheReadTokens) + num(buckets.cacheWriteTokens);
}
function detail(label, value, key) {
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(import_react15.default.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("dt", { style: { minWidth: 0, margin: 0, color: "var(--dsw-alias-label-tertiary)", overflowWrap: "anywhere" }, children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("dd", { style: {
      minWidth: 0,
      margin: 0,
      color: "var(--dsw-alias-label-secondary)",
      fontVariantNumeric: "tabular-nums",
      textAlign: "right"
    }, children: value })
  ] }, key ?? label);
}
function note(text, key) {
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { style: { gridColumn: "1 / -1", color: "var(--dsw-alias-label-tertiary)" }, children: text }, key ?? text);
}
function priceText(triple) {
  return `${triple.miss} / ${triple.hit} / ${triple.out}`;
}
function CostChipEntry({ useLive, sessionId, useProjection }) {
  const settings = useLive((item) => item);
  const overrides = settings.priceOverrides;
  const project = typeof useProjection === "function" ? useProjection : () => void 0;
  const usage = project("tokenUsage");
  const selection = project("modelSelection");
  const [open, setOpen] = import_react15.default.useState(false);
  const [hover, setHover] = import_react15.default.useState(false);
  const [anchor, setAnchor] = import_react15.default.useState(null);
  const chip = import_react15.default.useRef(null);
  const buckets = costBucketsOf(usage);
  const write = num(usage?.cacheWriteTokens);
  const model = selection?.lastUsed?.model;
  const billed = buckets.miss + buckets.hit + buckets.out + write;
  const fingerprint = `${buckets.miss}|${buckets.hit}|${write}|${buckets.out}`;
  const { data, loading } = useSessionCost(sessionId, fingerprint, open);
  const lastProvider = selection?.lastUsed?.provider;
  const eras = settings.syncedPrices?.eras;
  const estimate = resolvePrice(model, { overrides, ...lastProvider === void 0 ? {} : { provider: lastProvider }, ...eras === void 0 ? {} : { eras } });
  const estimateParts = costPartsOf(buckets, estimate.prices);
  const { text: peakText } = usePeakAlert(settings, data?.holidays ?? settings.peakHolidays ?? DEFAULT_PEAK_HOLIDAYS);
  const close = import_react15.default.useCallback(() => {
    setOpen(false);
    setAnchor(null);
  }, []);
  const toggle = () => {
    if (open) {
      close();
      return;
    }
    const rect = chip.current?.getBoundingClientRect();
    if (rect === void 0) return;
    const panelWidth = Math.min(440, Math.max(300, window.innerWidth - VIEWPORT_MARGIN * 2));
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - panelWidth / 2, VIEWPORT_MARGIN),
      Math.max(VIEWPORT_MARGIN, window.innerWidth - VIEWPORT_MARGIN - panelWidth)
    );
    setAnchor({ left, top: rect.top - 8 });
    setOpen(true);
  };
  import_react15.default.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event) => {
      const target = event.target;
      if (target !== null && chip.current?.contains(target) === true) return;
      if (target !== null && target.closest?.("[data-composer-ux-cost-panel]") !== null) return;
      close();
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, close]);
  if (billed === 0 && buckets.out === 0) return null;
  const hostRoutes = data?.ok === true && Array.isArray(data.routes) ? data.routes : [];
  const foldTotal = data?.ok === true ? {
    inputTokens: num(data.total?.inputTokens),
    outputTokens: num(data.total?.outputTokens),
    cacheReadTokens: num(data.total?.cacheReadTokens),
    cacheWriteTokens: num(data.total?.cacheWriteTokens)
  } : null;
  const foldAgrees = foldTotal !== null && agreesWithProjection(
    { total: foldTotal },
    {
      inputTokens: buckets.miss,
      outputTokens: buckets.out,
      cacheReadTokens: buckets.hit,
      cacheWriteTokens: write
    }
  );
  const routeRows = hostRoutes.filter((route) => tokenTotal(route.usage) > 0).map((route) => {
    const row2 = {
      inputTokens: num(route.usage?.inputTokens),
      outputTokens: num(route.usage?.outputTokens),
      cacheReadTokens: num(route.usage?.cacheReadTokens),
      cacheWriteTokens: num(route.usage?.cacheWriteTokens)
    };
    const rowProvider = route.provider === void 0 || route.provider === "" ? UNKNOWN_ROUTE : route.provider;
    const rowModel = route.model === void 0 || route.model === "" ? UNKNOWN_ROUTE : route.model;
    return {
      provider: rowProvider,
      model: rowModel,
      peak: route.peak === true,
      era: typeof route.era === "string" ? route.era : "",
      /** DeepSeek 路由才有峰谷两档与价格历史档（见 `pricing.ts` 的 isDeepSeekRoute）。 */
      deepseek: isDeepSeekRoute(rowProvider, rowModel),
      /** 认不出价：金额是 0，界面必须写"未定价"而不是 ¥0.00。 */
      unpriced: route.unpriced === true,
      /** 单价来自内置快照（没点过「同步第三方价目」时的兜底）。 */
      builtin: route.priceBuiltin === true,
      priceSource: typeof route.priceSource === "string" ? route.priceSource : "",
      overridden: route.overridden === true,
      tokens: tokenTotal(row2),
      cost: num(route.cost),
      parts: { miss: num(route.parts?.miss), hit: num(route.parts?.hit), out: num(route.parts?.out) }
    };
  });
  const tierOf = (peak) => routeRows.filter((route) => route.deepseek && route.peak === peak).reduce((sum, route) => ({ tokens: sum.tokens + route.tokens, cost: sum.cost + route.cost }), { tokens: 0, cost: 0 });
  const peakTier = tierOf(true);
  const offTier = tierOf(false);
  const otherTier = routeRows.filter((route) => !route.deepseek).reduce((sum, route) => ({ tokens: sum.tokens + route.tokens, cost: sum.cost + route.cost }), { tokens: 0, cost: 0 });
  const builtinCount = routeRows.filter((route) => route.builtin && !route.unpriced).length;
  const unpricedCount = routeRows.filter((route) => route.unpriced).length;
  const erasUsed = [...new Set(routeRows.filter((route) => route.deepseek && route.era !== "").map((route) => route.era))];
  const routeParts = routeRows.reduce(
    (sum, route) => ({
      miss: sum.miss + route.parts.miss,
      hit: sum.hit + route.parts.hit,
      out: sum.out + route.parts.out
    }),
    { miss: 0, hit: 0, out: 0 }
  );
  const useBreakdown = routeRows.length > 0 && foldAgrees && foldTotal !== null;
  const subRaw = useBreakdown ? data?.subagents : void 0;
  const subSessions = num(subRaw?.sessions);
  const sub = subSessions > 0 ? subRaw : void 0;
  const subMissing = num(sub?.missing);
  const subExternal = num(sub?.external);
  const subSkipped = num(sub?.skipped);
  const subUnpriced = num(sub?.unpriced);
  const subCost = num(sub?.cost?.total);
  const subTokens = tokenTotal(sub?.total);
  const subParts = {
    miss: num(sub?.total?.inputTokens),
    hit: num(sub?.total?.cacheReadTokens),
    write: num(sub?.total?.cacheWriteTokens),
    out: num(sub?.total?.outputTokens)
  };
  const peakTierTokens = peakTier.tokens + (peakTier.tokens > 0 ? tokenTotal(sub?.tiers?.peak) : 0);
  const offTierTokens = offTier.tokens + (offTier.tokens > 0 ? tokenTotal(sub?.tiers?.offPeak) : 0);
  const subTierMerged = peakTierTokens > peakTier.tokens || offTierTokens > offTier.tokens;
  const subGapParts = [];
  if (subMissing > 0) subGapParts.push(`${subMissing} \u4E2A\u8BFB\u4E0D\u5230\u4F1A\u8BDD\u65E5\u5FD7\uFF08\u5DF2\u5F52\u6863\uFF0C\u6216\u672C\u673A\u6CA1\u6709\u5B83\u7684\u65E5\u5FD7\uFF09`);
  if (subExternal > 0) subGapParts.push(`${subExternal} \u4E2A\u662F\u5916\u90E8\u6267\u884C\uFF08\u672C\u673A\u6CA1\u6709\u8FD9\u4E2A\u4F1A\u8BDD\uFF0C\u7528\u91CF\u62FF\u4E0D\u5230\uFF09`);
  if (subSkipped > 0) subGapParts.push(`${subSkipped} \u4E2A\u8D85\u51FA\u5355\u6B21\u8BFB\u53D6\u4E0A\u9650`);
  if (subUnpriced > 0) subGapParts.push(`${subUnpriced} \u884C\u6CA1\u8BA4\u51FA\u4EF7\uFF0C\u6309 0 \u8BA1`);
  const subUnaccounted = subMissing + subExternal + subSkipped;
  const subGapText = subGapParts.length === 0 ? null : subUnaccounted > 0 ? `\u53E6\u6709 ${subUnaccounted} \u4E2A\u5B50\u4EE3\u7406\u7684\u8D39\u7528\u6CA1\u7B97\u8FDB\u6765\uFF1A${subGapParts.join("\u3001")}` : `\u5B50\u4EE3\u7406\u91CC\u6709\u8D39\u7528\u6CA1\u7B97\u8FDB\u6765\uFF1A${subGapParts.join("\u3001")}`;
  const view = useBreakdown && foldTotal !== null ? {
    // 子代理的四桶并进展示桶（`sub` 为 undefined 时每一项都是 0，即原样）：
    // 这样"分项之和 = 合计 = 全额"与命中率都是同一份量，见文件头 0.24.0 第三条。
    miss: foldTotal.inputTokens + subParts.miss,
    hit: foldTotal.cacheReadTokens + subParts.hit,
    write: foldTotal.cacheWriteTokens + subParts.write,
    out: foldTotal.outputTokens + subParts.out,
    // ⚠️ 三个分项**也要**并钱：只并桶不并钱，"未缓存输入 + 缓存命中 + 输出 = 合计"当场破。
    parts: {
      miss: num(data?.cost?.miss) + num(sub?.cost?.miss),
      hit: num(data?.cost?.hit) + num(sub?.cost?.hit),
      out: num(data?.cost?.out) + num(sub?.cost?.out)
    },
    total: num(data?.cost?.total) + subCost
  } : {
    miss: buckets.miss,
    hit: buckets.hit,
    write,
    out: buckets.out,
    parts: estimateParts,
    total: estimateParts.total
  };
  const viewBilledInput = billedInputTokens({
    uncachedInputTokens: view.miss,
    cacheReadTokens: view.hit,
    cacheWriteTokens: view.write
  });
  const viewHitRate = cacheHitText(view.hit, viewBilledInput);
  const viewUnpriced = !useBreakdown && estimate.unpriced;
  const quotaUsd = useBreakdown ? num(data?.quota?.usd) : 0;
  const hasQuota = quotaUsd > 0;
  const planInfo = data?.plan;
  const planWindows = Array.isArray(planInfo?.windows) ? planInfo.windows : [];
  const headline = hasQuota ? formatUsd(quotaUsd) : viewUnpriced ? "\u672A\u5B9A\u4EF7" : formatMoney(view.total);
  const expanded = hover || open;
  const peakPrice = resolvePrice(model, { peak: true, overrides, ...lastProvider === void 0 ? {} : { provider: lastProvider }, ...eras === void 0 ? {} : { eras } });
  const offPrice = resolvePrice(model, { peak: false, overrides, ...lastProvider === void 0 ? {} : { provider: lastProvider }, ...eras === void 0 ? {} : { eras } });
  const overridden = peakPrice.overridden || offPrice.overridden || overrideTierOf(overrides, model, true) !== void 0 || overrideTierOf(overrides, model, false) !== void 0;
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(import_jsx_runtime13.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(
      "button",
      {
        ref: chip,
        type: "button",
        "data-composer-ux-cost": "",
        "aria-expanded": open,
        title: (useBreakdown ? hasQuota ? "\u672C\u4F1A\u8BDD\u989D\u5EA6\u6D88\u8017\uFF08\u8BA2\u9605\u5185\uFF0C\u6309\u5957\u9910\u5355\u4EF7\u8BA1\uFF0C\u542B\u5B50\u4EE3\u7406\uFF09" : sub !== void 0 ? "\u672C\u4F1A\u8BDD\u8D39\u7528\uFF08\u542B\u5B50\u4EE3\u7406\uFF0C\u6309\u6BCF\u7B14\u7528\u91CF\u53D1\u751F\u7684\u65F6\u95F4\u8BA1\u4EF7\uFF09" : "\u672C\u4F1A\u8BDD\u8D39\u7528\uFF08\u6309\u6BCF\u7B14\u7528\u91CF\u53D1\u751F\u7684\u65F6\u95F4\u8BA1\u4EF7\uFF09" : "\u672C\u4F1A\u8BDD\u8D39\u7528\uFF08\u4F30\u7B97\uFF09") + ` \xB7 ${peakText}`,
        onClick: toggle,
        onMouseEnter: () => setHover(true),
        onMouseLeave: () => setHover(false),
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          boxSizing: "border-box",
          maxWidth: "100%",
          padding: "1px 8px",
          border: "none",
          borderRadius: 24,
          background: expanded ? "var(--dsw-alias-interactive-bg-hover)" : "transparent",
          color: expanded ? "var(--dsw-alias-label-secondary)" : "var(--dsw-alias-label-tertiary)",
          // 字号/行高来自官方 **`.root`**（不是 `.pill`）：本条目是同一槽位里的另一条记录，
          // 不在那颗 `.root` 里，只写 `font: inherit` 就会拿到输入框那一层的 14px
          // —— 那正是"比旁边大"的原因。`font: inherit` 的本意只是抵消 button 的 UA 字体，
          // 所以这里拆成等价的长写，再把官方的两条显式写上去。
          fontFamily: "inherit",
          fontWeight: "inherit",
          fontStyle: "inherit",
          fontSize: "calc(var(--dsh-content-font-size-secondary, 13px) - 1px)",
          lineHeight: "calc(20px + var(--dsh-content-font-delta-secondary, 0px))",
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
          cursor: "pointer"
        },
        children: [
          headline,
          hasQuota ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { style: {
            fontSize: 9,
            lineHeight: "12px",
            padding: "0 4px",
            borderRadius: 6,
            border: "0.5px solid var(--dsw-alias-border-l2)",
            color: "var(--dsw-alias-label-tertiary)",
            fontVariantNumeric: "normal"
          }, children: "\u8BA2\u9605\u5185" }) : null
        ]
      }
    ),
    open && anchor !== null ? (0, import_react_dom3.createPortal)(
      /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(
        "div",
        {
          "data-composer-ux-cost-panel": "",
          role: "dialog",
          "aria-label": "\u672C\u4F1A\u8BDD\u8D39\u7528",
          style: {
            position: "fixed",
            left: anchor.left,
            bottom: Math.max(VIEWPORT_MARGIN, window.innerHeight - anchor.top),
            zIndex: 1100,
            boxSizing: "border-box",
            width: "max-content",
            minWidth: PANEL_MIN_WIDTH,
            maxWidth: PANEL_MAX_WIDTH,
            padding: 16,
            border: 0,
            borderRadius: 12,
            background: "var(--dsw-specific-menu)",
            backdropFilter: "var(--dsw-menu-backdrop-filter)",
            boxShadow: "var(--dsw-elevation-prominent)",
            ["--dsw-elevation-stroke-color"]: "var(--dsw-alias-border-l1)",
            fontSize: 12,
            lineHeight: "18px",
            color: "var(--dsw-alias-label-secondary)",
            cursor: "default"
            // 自定义属性（`--dsw-*`）不在 React 的 CSSProperties 里，必须显式断言 ——
            // 与 styles.ts 里那些样式对象同一做法（那边也是 `as CSSProperties`）。
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { style: {
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              marginBottom: 8,
              color: "var(--dsw-alias-label-primary)",
              fontWeight: 500
            }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { children: hasQuota ? "\u672C\u4F1A\u8BDD\u989D\u5EA6\u6D88\u8017" : "\u672C\u4F1A\u8BDD\u8D39\u7528" }),
              /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("span", { style: { fontVariantNumeric: "tabular-nums" }, children: headline })
            ] }),
            hasQuota ? note(`\u8BA2\u9605\u5185 \xB7 \u6309\u520A\u4F8B\u4EF7\u6298\u7B97 ${formatMoney(view.total)}\uFF08\u4E24\u5957\u53E3\u5F84\u5E76\u5B58\uFF1A\u4E0A\u9762\u662F\u5B9E\u9645\u88AB\u6263\u7684\u5957\u9910\u989D\u5EA6\uFF0C\u8FD9\u91CC\u662F\u8FD9\u4E9B token \u6309\u5B98\u65B9\u4EF7\u6298\u7B97\u503C\u591A\u5C11\u94B1\uFF09`, "__quota_head__") : null,
            /* @__PURE__ */ (0, import_jsx_runtime13.jsx)("div", { style: { marginBottom: 10, borderTop: "0.5px solid var(--dsw-alias-border-l2)" } }),
            data?.ok === true && typeof data.readError === "string" && data.readError !== "" ? note(`\u8BFB\u4E0D\u5230\u4F1A\u8BDD\u65E5\u5FD7\uFF1A${data.readError}\uFF08\u91D1\u989D\u6309 0 \u8BA1\uFF09`, "__read_error__") : null,
            /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)("div", { style: {
              display: "grid",
              gridTemplateColumns: "minmax(76px, auto) minmax(0, 1fr)",
              gap: "6px 16px",
              margin: 0
            }, children: [
              hasQuota ? /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(import_jsx_runtime13.Fragment, { children: [
                detail("\u989D\u5EA6\u6D88\u8017\uFF08\u542B\u5B50\u4EE3\u7406\uFF09", formatUsd(quotaUsd), "__quota__"),
                (data?.quota?.models ?? []).map((row2) => detail(
                  `\u5176\u4E2D ${row2.model === void 0 || row2.model === "" ? "\u672A\u77E5\u6A21\u578B" : row2.model}`,
                  `${formatUsd(num(row2.usd))}${row2.percentOfLimit === void 0 ? "" : ` \xB7 \u5360\u6708\u989D\u5EA6 ${num(row2.percentOfLimit).toFixed(2)}%`}`,
                  `__quota_${row2.model ?? ""}`
                )),
                planWindows.length > 0 ? detail(
                  "\u989D\u5EA6\u7A97\u53E3",
                  planWindows.map((window2) => `${window2.id === void 0 ? "" : QUOTA_WINDOW_LABEL[window2.id]} ${num(window2.percent).toFixed(0)}%`).filter((text) => text !== "").join(" \xB7 "),
                  "__quota_windows__"
                ) : null,
                planInfo?.status === "pending" ? note('\u989D\u5EA6\u7A97\u53E3\u6B63\u5728\u53D6\uFF08\u5B98\u65B9\u63A5\u53E3\u7B2C\u4E00\u6B21\u8FD4\u56DE\u524D\u5148\u663E\u793A"\u2014"\uFF1B\u4E0D\u5F71\u54CD\u4E0A\u9762\u7684\u989D\u5EA6\u6D88\u8017\uFF09', "__quota_pending__") : null,
                planInfo !== void 0 && planInfo.status !== void 0 && planInfo.status !== "ok" && planInfo.status !== "pending" ? note(`\u989D\u5EA6\u7A97\u53E3\u53D6\u4E0D\u5230\uFF1A${planInfo.reason === void 0 || planInfo.reason === "" ? planInfo.status : planInfo.reason}`, "__quota_gap__") : null
              ] }) : null,
              useBreakdown ? /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(import_jsx_runtime13.Fragment, { children: [
                routeRows.map((route) => detail(
                  `${route.provider} \xB7 ${route.model}` + (route.deepseek ? route.peak ? "\uFF08\u9AD8\u5CF0\uFF09" : "\uFF08\u7A7A\u95F2\uFF09" : "\uFF08\u5E73\u5766\u4EF7\uFF09"),
                  `${formatTokens(route.tokens)} \xB7 ${route.unpriced ? "\u672A\u5B9A\u4EF7" : formatMoney(route.cost)}`,
                  `${route.provider}|${route.model}|${String(route.peak)}|${route.era}`
                )),
                sub !== void 0 ? detail(
                  `\u5B50\u4EE3\u7406\uFF08${subSessions} \u4E2A\u4F1A\u8BDD\uFF09`,
                  `${formatTokens(subTokens)} \xB7 ${subUnpriced > 0 ? "\u672A\u5B9A\u4EF7" : formatMoney(subCost)}`,
                  "__subagents__"
                ) : null,
                detail("\u5408\u8BA1", `${formatTokens(view.miss + view.hit + view.write + view.out)} \xB7 ${formatMoney(view.total)}`, "__total__"),
                peakTier.tokens > 0 ? detail("\u9AD8\u5CF0\u6863", `${formatTokens(peakTierTokens)} \xB7 ${formatMoney(peakTier.cost)}`, "__peak__") : null,
                offTier.tokens > 0 ? detail("\u7A7A\u95F2\u6863", `${formatTokens(offTierTokens)} \xB7 ${formatMoney(offTier.cost)}`, "__off__") : null,
                otherTier.tokens > 0 ? detail("\u5176\u4ED6\u8DEF\u7531\uFF08\u65E0\u5CF0\u8C37\uFF09", `${formatTokens(otherTier.tokens)} \xB7 ${formatMoney(otherTier.cost)}`, "__other__") : null,
                subTierMerged ? note("\u9AD8\u5CF0 / \u7A7A\u95F2\u4E24\u6863\u7684 token \u5DF2\u542B\u5B50\u4EE3\u7406\uFF0C\u91D1\u989D\u53EA\u542B\u672C\u4F1A\u8BDD\uFF08\u5BBF\u4E3B\u534A\u6CA1\u628A\u5B50\u4EE3\u7406\u7684\u94B1\u6309\u5CF0\u8C37\u62C6\u5F00\uFF0C\u6240\u4EE5\u4E0D\u62FF token \u4E58\u5355\u4EF7\u7F16\u4E00\u4E2A\u6309\u6863\u91D1\u989D\u51FA\u6765\uFF09\u3002", "__sub_tier__") : null,
                detail("\u672A\u7F13\u5B58\u8F93\u5165", `${formatTokens(view.miss)} \xB7 ${formatMoney(view.parts.miss)}`, "__miss__"),
                detail("\u7F13\u5B58\u547D\u4E2D", `${formatTokens(view.hit)} \xB7 ${formatMoney(view.parts.hit)}`, "__hit__"),
                detail("\u8F93\u51FA", `${formatTokens(view.out)} \xB7 ${formatMoney(view.parts.out)}`, "__out__"),
                builtinCount > 0 ? note(`\u6709 ${builtinCount} \u884C\u7528\u7684\u662F\u5185\u7F6E\u5FEB\u7167\u4EF7\uFF08models.dev \u5FEB\u7167 ${PROVIDER_PRICES_SNAPSHOT_AT}\uFF09\u2014\u2014\u60F3\u6362\u6210\u6700\u65B0\u4EF7\uFF0C\u53BB\u8BBE\u7F6E\u9875\u300C\u91D1\u989D\u300D\u70B9\u4E00\u6B21\u300C\u540C\u6B65\u7B2C\u4E09\u65B9\u4EF7\u76EE\u300D\u3002`, "__builtin__") : null,
                unpricedCount > 0 ? note(`\u6709 ${unpricedCount} \u884C\u300C\u672A\u5B9A\u4EF7\u300D\uFF1A\u90A3\u662F\u975E DeepSeek \u6A21\u578B\uFF0C\u540C\u6B65\u4EF7\u76EE\u4E0E\u5185\u7F6E\u5FEB\u7167\u91CC\u90FD\u6CA1\u6709\u5B83\uFF0C\u6240\u4EE5\u90A3\u90E8\u5206\u6309 0 \u8BA1\u3002\u53BB\u8BBE\u7F6E\u9875\u300C\u91D1\u989D\u300D\u5237\u65B0\u4E00\u6B21\u300C\u540C\u6B65\u7B2C\u4E09\u65B9\u4EF7\u76EE\u300D\uFF0C\u6216\u7ED9\u90A3\u884C\u76F4\u63A5\u586B\u4E2A\u4EF7\u3002`, "__unpriced__") : null,
                subGapText !== null ? note(subGapText, "__sub_gap__") : null
              ] }) : /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(import_jsx_runtime13.Fragment, { children: [
                detail("\u672A\u7F13\u5B58\u8F93\u5165", `${formatTokens(buckets.miss)} \xB7 ${formatMoney(estimateParts.miss)}`),
                detail("\u7F13\u5B58\u547D\u4E2D", `${formatTokens(buckets.hit)} \xB7 ${formatMoney(estimateParts.hit)}`),
                detail("\u8F93\u51FA", `${formatTokens(buckets.out)} \xB7 ${formatMoney(estimateParts.out)}`),
                note(loading ? "\u6B63\u5728\u6309 route \u5F52\u56E0\u2026" : routeRows.length > 0 && !foldAgrees ? "\u65E5\u5FD7\u4E0E\u6295\u5F71\u5BF9\u4E0D\u4E0A\uFF08\u4F1A\u8BDD\u53EF\u80FD\u521A\u5199\u5165\uFF09\uFF0C\u8FD9\u91CC\u5148\u6309\u5F53\u524D\u6863\u4F4D\u4F30\u7B97\u603B\u989D" : data?.ok === true ? `\u8FD9\u4E2A\u4F1A\u8BDD\u8FD8\u6CA1\u6709\u53EF\u5F52\u56E0\u7684\u7528\u91CF\uFF08\u8BFB\u4E86 ${data.events ?? 0} \u6761\u4E8B\u4EF6\u3001${data.samples ?? 0} \u6761 usage\uFF0C\u6765\u6E90 ${data.source ?? "\u672A\u77E5"}\uFF09` : data?.ok === false ? `\u6309 route \u5206\u5217\u53D6\u4E0D\u5230\uFF1A${data.error ?? "\u672A\u77E5\u539F\u56E0"}` : "\u6309 route \u5206\u5217\u9700\u8981\u5BBF\u4E3B\u534A\u8BFB\u4F1A\u8BDD\u65E5\u5FD7", "__fold__")
              ] }),
              detail("\u7F13\u5B58\u547D\u4E2D\u7387", viewHitRate === null ? "\u2014" : `${viewHitRate}%`),
              detail("\u5CF0\u8C37", peakText),
              detail(`\u9AD8\u5CF0\u5355\u4EF7\uFF08\u6BCF 1M${overridden ? " \xB7 \u5DF2\u81EA\u5B9A\u4E49" : ""}\uFF09`, peakPrice.unpriced ? "\u672A\u5B9A\u4EF7" : priceText(peakPrice.prices)),
              detail(`\u7A7A\u95F2\u5355\u4EF7\uFF08\u6BCF 1M${overridden ? " \xB7 \u5DF2\u81EA\u5B9A\u4E49" : ""}\uFF09`, offPrice.unpriced ? "\u672A\u5B9A\u4EF7" : priceText(offPrice.prices)),
              viewUnpriced ? note("\u8FD9\u4E2A\u6A21\u578B\u4E0D\u662F DeepSeek \u7CFB\u3001\u540C\u6B65\u6765\u7684\u7B2C\u4E09\u65B9\u4EF7\u76EE\u91CC\u4E5F\u6CA1\u6709\u5B83\uFF0C\u6240\u4EE5\u91D1\u989D\u7ED9\u4E0D\u51FA\u6765\u3002\u53BB\u8BBE\u7F6E\u9875\u300C\u91D1\u989D\u300D\u70B9\u4E00\u6B21\u300C\u540C\u6B65\u7B2C\u4E09\u65B9\u4EF7\u76EE\u300D\uFF0C\u6216\u7ED9\u8FD9\u4E2A\u6A21\u578B\u76F4\u63A5\u586B\u4E00\u884C\u5355\u4EF7\u3002", "__unpriced__") : null,
              erasUsed.length > 0 && (erasUsed.length > 1 || erasUsed[0] !== eraIdAt(Date.now(), eras)) ? note("\u8FD9\u6279\u7528\u91CF\u6309\u5404\u81EA\u53D1\u751F\u65F6\u523B\u7684\u4EF7\u683C\u6863\u7ED3\u7B97\uFF1A" + erasUsed.map((id) => eraById(id, eras).label).join(" \xB7 ") + "\uFF08\u5B98\u65B9\u8C03\u4EF7\u4E0D\u4F1A\u6539\u52A8\u5386\u53F2\u91D1\u989D\uFF09", "__eras__") : null
            ] })
          ]
        }
      ),
      document.body
    ) : null
  ] });
}

// src/client/QuickCommandsButton.tsx
var import_react16 = require("react");
init_settings_contract();
var import_jsx_runtime14 = require("react/jsx-runtime");
function QuickCommandsButton({
  useInput,
  inputActions,
  sessionId,
  useSession,
  useLive,
  usePanel,
  actions
}) {
  const settings = useLive((item) => item);
  const anchor = usePanel((item) => item);
  const draft = useInput((state3) => state3.draft);
  const blank = useSession((state3) => state3?.blank === true);
  const ref = (0, import_react16.useRef)(null);
  (0, import_react16.useEffect)(() => {
    const sid = typeof sessionId === "string" ? sessionId : "";
    publishInputBridge({
      actions: inputActions ?? null,
      draft: typeof draft === "string" ? draft : "",
      sessionId: sid,
      blank: blank === true
    });
    return () => {
      releaseInputBridge(sid);
    };
  }, [inputActions, draft, sessionId, blank]);
  if (!activeSections(settings).quick) return null;
  const open = anchor !== null;
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsxs)(
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
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
          "svg",
          {
            viewBox: "0 0 16 16",
            width: "12",
            height: "12",
            "aria-hidden": true,
            children: /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
              "path",
              {
                d: "M9.2 1.2 3.4 9.1h3.5l-0.9 5.7 6-8.1H8.4l0.8-5.5Z",
                fill: "currentColor"
              }
            )
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { children: "\u5FEB\u6377\u6307\u4EE4" })
      ]
    }
  );
}

// src/client/QuickCommandsPanel.tsx
var import_react20 = require("react");
init_settings_contract();

// src/client/OptimizeOptionsCard.tsx
var import_react17 = __toESM(require("react"), 1);
init_settings_contract();

// src/client/model-catalog.ts
init_settings_contract();
var textOf = (value) => typeof value === "string" ? value.trim() : "";
async function fetchModelCatalog(options = {}) {
  const url = options.fresh === true ? `${MODELS_API_PATH}?fresh=1` : MODELS_API_PATH;
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
      ...options.signal === void 0 ? {} : { signal: options.signal }
    });
    if (!response.ok) return { kind: "error", error: `\u5BBF\u4E3B\u56DE\u4E86 ${String(response.status)}` };
    const body = await response.json();
    if (body.ok !== true) return { kind: "error", error: textOf(body.error) === "" ? "\u5BBF\u4E3B\u6CA1\u7ED9\u51FA\u539F\u56E0" : textOf(body.error) };
    const rawGroups = Array.isArray(body.groups) ? body.groups : [];
    const groups = [];
    for (const raw of rawGroups) {
      if (typeof raw !== "object" || raw === null) continue;
      const row2 = raw;
      const id = textOf(row2.id);
      if (id === "") continue;
      const models = (Array.isArray(row2.models) ? row2.models : []).map((item) => {
        const one = typeof item === "object" && item !== null ? item : {};
        const model = textOf(one.id);
        const name2 = textOf(one.name);
        return { id: model, name: name2 === "" ? model : name2 };
      }).filter((item) => item.id !== "");
      const error = textOf(row2.error);
      groups.push({
        id,
        name: textOf(row2.name) === "" ? id : textOf(row2.name),
        models,
        ...error === "" ? {} : { error }
      });
    }
    const currentRow = typeof body.current === "object" && body.current !== null ? body.current : {};
    return { kind: "ok", groups, current: { provider: textOf(currentRow.provider), model: textOf(currentRow.model) } };
  } catch (error) {
    return { kind: "error", error: error instanceof Error ? error.message : String(error) };
  }
}

// src/client/OptimizeOptionsCard.tsx
var import_jsx_runtime15 = require("react/jsx-runtime");
function Segmented2(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { style: optRow, children: [
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { style: optLabel, title: props.hint, children: props.label }),
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("div", { style: optSegmented, role: "group", "aria-label": props.label, children: props.options.map((item) => /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
      "button",
      {
        type: "button",
        "aria-pressed": props.value === item.id,
        title: item.hint ?? "",
        style: props.value === item.id ? optSegButtonActive : optSegButton,
        onMouseDown: (event) => {
          event.preventDefault();
        },
        onClick: () => {
          props.onPick(item.id);
        },
        children: item.label
      },
      item.id
    )) })
  ] });
}
function Toggle(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
    Segmented2,
    {
      label: props.label,
      hint: props.hint,
      value: props.on ? "on" : "off",
      options: [{ id: "off", label: "\u5173", hint: props.hint }, { id: "on", label: "\u5F00", hint: props.hint }],
      onPick: (value) => {
        props.onToggle(value === "on");
      }
    }
  );
}
function currentPrompt(settings) {
  if (settings.optimizerTier === "light") return settings.optimizerPromptLight;
  if (settings.optimizerTier === "heavy") return settings.optimizerPromptHeavy;
  return settings.optimizerPromptStandard;
}
function OptimizeOptionsCard({ settings, actions, open, onToggle }) {
  const [detailOpen, setDetailOpen] = (0, import_react17.useState)(false);
  const [modelText, setModelText] = (0, import_react17.useState)(settings.optimizerModel);
  const [pickerOpen, setPickerOpen] = (0, import_react17.useState)(false);
  const [catalog, setCatalog] = (0, import_react17.useState)(null);
  const [manual, setManual] = (0, import_react17.useState)(false);
  const [retrySeq, setRetrySeq] = (0, import_react17.useState)(0);
  (0, import_react17.useEffect)(() => {
    if (!pickerOpen) return;
    let alive = true;
    setCatalog({ kind: "loading" });
    const controller = new AbortController();
    void fetchModelCatalog({ fresh: retrySeq > 0, signal: controller.signal }).then((result) => {
      if (alive) setCatalog(result);
    });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [pickerOpen, retrySeq]);
  const prompt = currentPrompt(settings);
  const tierOff = settings.optimizerTier === "off";
  const summary = [
    `\u6743\u9650 ${settings.optimizerPermission === "auto" ? "\u81EA\u52A8" : "\u5BA1\u67E5"}`,
    `\u4E0A\u4E0B\u6587 ${settings.optimizerHistory === "full" ? "\u5168\u6587" : `\u56DE\u5408 ${String(settings.optimizerTurns)}`}`,
    `\u53EA\u8BFB\u5DE5\u5177 ${settings.optimizeReadTools ? "\u5F00" : "\u5173"}`,
    `Bash ${settings.optimizeBash ? "\u5F00" : "\u5173"}`,
    ...settings.optimizerModel === "" ? [] : [`\u6A21\u578B ${settings.optimizerModel}`]
  ].join(" \xB7 ");
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { style: optCard, role: "group", "aria-label": "\u4F18\u5316\u9009\u9879", children: [
    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
      "button",
      {
        type: "button",
        "aria-expanded": open,
        style: optFoldHead,
        title: open ? "\u6536\u8D77\u8FD9\u4E9B\u8BBE\u7F6E\uFF08\u5B83\u4EEC\u90FD\u5C5E\u4E8E\u300C\u4F18\u5316\u63D0\u793A\u8BCD\u300D\u8FD9\u4E00\u8F6E\uFF1B\u6863\u4F4D\u5728\u9762\u677F\u6807\u9898\u884C\uFF09" : `\u5C55\u5F00\u8FD9\u4E9B\u8BBE\u7F6E\uFF1A${summary}`,
        onMouseDown: (event) => {
          event.preventDefault();
        },
        onClick: onToggle,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { style: optFoldArrow, "aria-hidden": true, children: open ? "\u25BE" : "\u25B8" }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { style: optCardTitle, title: "\u8FD9\u4E9B\u5F00\u5173\u90FD\u5C5E\u4E8E\u300C\u4F18\u5316\u63D0\u793A\u8BCD\u300D\u8FD9\u4E00\u8F6E\uFF1B\u6863\u4F4D\u5728\u9762\u677F\u6807\u9898\u884C", children: "\u4F18\u5316\u9009\u9879" }),
          !open && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { style: optFoldSummary, children: summary })
        ]
      }
    ),
    open && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_jsx_runtime15.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
        Segmented2,
        {
          label: "\u6743\u9650",
          hint: "\u5BA1\u67E5 = \u6210\u54C1\u8FDB\u7ED3\u679C\u6846\uFF0C\u4F60\u770B\u8FC7\u518D\u70B9\u300C\u63D2\u5165\u8F93\u5165\u6846\u300D\uFF1B\u81EA\u52A8 = \u8DD1\u5B8C\u81EA\u52A8\u5199\u56DE\u8F93\u5165\u6846\uFF08\u90FD\u4E0D\u4F1A\u81EA\u52A8\u53D1\u9001\u6D88\u606F\uFF09",
          value: settings.optimizerPermission,
          options: OPTIMIZER_PERMISSIONS.map((item) => ({ id: item.id, label: item.label, hint: item.hint })),
          onPick: actions.setPermission
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
        Segmented2,
        {
          label: "\u534F\u4F5C\u57FA\u8C03",
          hint: "\u786C\u90A6\u90A6 = \u6574\u4EFD\u8F85\u52A9\u5305\u6539\u7528\u53E3\u8BED\u76F4\u7ED9\u7684\u5199\u6CD5\uFF08\u53EA\u6539\u5199\u6CD5\uFF1A\u6761\u76EE\u96C6\u5408\u4E0E\u9010\u5B57\u4F9D\u636E\u89C4\u5219\u4E0D\u53D8\uFF09",
          value: settings.optimizerFraming,
          options: OPTIMIZER_FRAMINGS.map((item) => ({ id: item.id, label: item.label, hint: item.hint })),
          onPick: actions.setFraming
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { style: optRow, children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { style: optLabel, title: "\u89E3\u91CA\u5C42\u7528\u54EA\u4E2A\u6A21\u578B\uFF1A\u8DDF\u968F\u4F1A\u8BDD\u5F53\u524D\u9009\u7684\uFF0C\u6216\u4ECE\u6E05\u5355\u91CC\u6307\u5B9A\u4E00\u6761", children: "\u6A21\u578B" }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
          "button",
          {
            type: "button",
            "aria-label": "\u6A21\u578B",
            "aria-expanded": pickerOpen,
            title: "\u70B9\u5F00\u9009\u6A21\u578B\uFF1A\u7B2C\u4E00\u9879\u662F\u8DDF\u968F\u4F1A\u8BDD\uFF1B\u4E0B\u9762\u6309 provider \u5206\u7EC4\u5217\u51FA\u53EF\u7528\u6A21\u578B\uFF08\u6E05\u5355\u957F\u4E86\u53EF\u4EE5\u6EDA\uFF09",
            style: optPickerButton,
            onMouseDown: (event) => {
              event.preventDefault();
            },
            onClick: () => {
              setPickerOpen(!pickerOpen);
            },
            children: [
              settings.optimizerModel === "" ? "\u8DDF\u968F\u4F1A\u8BDD\u6A21\u578B" : settings.optimizerModel,
              " \u25BE"
            ]
          }
        )
      ] }),
      pickerOpen && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { style: optPickerPanel, role: "listbox", "aria-label": "\u6A21\u578B\u6E05\u5355", children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
          "button",
          {
            type: "button",
            style: settings.optimizerModel === "" ? optPickerItemActive : optPickerItem,
            onMouseDown: (event) => {
              event.preventDefault();
            },
            onClick: () => {
              setModelText("");
              actions.setModel("");
              setManual(false);
              setPickerOpen(false);
            },
            children: [
              "\u8DDF\u968F\u4F1A\u8BDD\u6A21\u578B",
              catalog !== null && catalog.kind === "ok" && catalog.current.model !== "" && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { style: optPickerModelId, children: [
                "\u5F53\u524D\uFF1A",
                catalog.current.model
              ] })
            ]
          }
        ),
        catalog === null || catalog.kind === "loading" ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { style: optHint, children: "\u6B63\u5728\u8BFB\u6A21\u578B\u6E05\u5355\u2026" }) : catalog.kind === "error" ? /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_jsx_runtime15.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("span", { style: optHint, children: [
            "\u8BFB\u4E0D\u5230\u6A21\u578B\u6E05\u5355\uFF1A",
            catalog.error
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
            "button",
            {
              type: "button",
              style: optPickerItem,
              onMouseDown: (event) => {
                event.preventDefault();
              },
              onClick: () => {
                setRetrySeq(retrySeq + 1);
              },
              children: "\u91CD\u8BD5"
            }
          )
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_jsx_runtime15.Fragment, { children: [
          catalog.groups.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { style: optHint, children: "\u5BBF\u4E3B\u6CA1\u62A5\u51FA\u4EFB\u4F55 provider\uFF08\u5728\u8BBE\u7F6E\u91CC\u770B\u8FC7\u6A21\u578B\u8DEF\u7531\u5417\uFF1F\uFF09" }),
          catalog.groups.map((group) => /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_react17.default.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { style: optPickerGroup, children: group.name }),
            group.models.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { style: optHint, children: group.error === void 0 ? "\u8FD9\u4E00\u7EC4\u6CA1\u6709\u6A21\u578B" : `\u8FD9\u4E00\u7EC4\u8BFB\u4E0D\u5230\uFF1A${group.error}` }),
            group.models.map((model) => {
              const value = `${group.id}/${model.id}`;
              return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(
                "button",
                {
                  type: "button",
                  style: settings.optimizerModel === value ? optPickerItemActive : optPickerItem,
                  onMouseDown: (event) => {
                    event.preventDefault();
                  },
                  onClick: () => {
                    actions.setModel(value);
                    setModelText(value);
                    setPickerOpen(false);
                  },
                  children: [
                    model.name,
                    model.name === model.id ? null : /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { style: optPickerModelId, children: model.id })
                  ]
                },
                value
              );
            })
          ] }, group.id))
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
          "button",
          {
            type: "button",
            style: optPickerItem,
            onMouseDown: (event) => {
              event.preventDefault();
            },
            onClick: () => {
              setManual(!manual);
            },
            children: "\u624B\u52A8\u8F93\u5165 provider/model\u2026"
          }
        ),
        manual && /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
          "input",
          {
            "aria-label": "\u624B\u52A8\u8F93\u5165\u6A21\u578B",
            title: "\u5199 provider/model\uFF0C\u4F8B\u5982 go/deepseek-flash",
            value: modelText,
            onChange: (event) => {
              setModelText(event.target.value);
            },
            onBlur: () => {
              const next = modelText.trim();
              actions.setModel(next);
              setModelText(next);
            },
            style: optInput,
            spellCheck: false
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
        Segmented2,
        {
          label: "\u4E0A\u4E0B\u6587",
          hint: "\u56DE\u5408 = \u53EA\u5E26\u6700\u8FD1 N \u8F6E\u5F80\u6765\uFF080 = \u4E0D\u5E26\uFF09\uFF1B\u5168\u6587 = \u5C3D\u91CF\u7ED9\u5168\uFF08\u4ECD\u53D7\u5B57\u7B26\u9884\u7B97\u7EA6\u675F\uFF09",
          value: settings.optimizerHistory,
          options: [
            { id: "turns", label: "\u56DE\u5408", hint: "\u53EA\u5E26\u6700\u8FD1 N \u8F6E\u5F80\u6765\uFF08\u7701 token\u3001\u4E5F\u591F\u6D88\u6B67\u4E49\uFF09" },
            { id: "full", label: "\u5168\u6587", hint: "\u628A\u4F1A\u8BDD\u5F80\u6765\u5C3D\u91CF\u90FD\u7ED9\u89E3\u91CA\u5C42\uFF08\u66F4\u61C2\u4F60\uFF0C\u4E5F\u66F4\u6162\u66F4\u8D35\uFF09" }
          ],
          onPick: actions.setHistory
        }
      ),
      settings.optimizerHistory === "turns" && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { style: optRow, children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { style: optLabel }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
          "input",
          {
            "aria-label": "\u4E0A\u4E0B\u6587\u56DE\u5408\u6570",
            title: `\u6700\u8FD1\u51E0\u8F6E\u5F80\u6765\uFF08${String(OPTIMIZER_TURNS_MIN)}\u2013${String(OPTIMIZER_TURNS_MAX)}\uFF1B0 = \u4E0D\u5E26\u4E0A\u4E0B\u6587\uFF09`,
            type: "range",
            min: OPTIMIZER_TURNS_MIN,
            max: OPTIMIZER_TURNS_MAX,
            step: 1,
            value: settings.optimizerTurns,
            onChange: (event) => {
              actions.setTurns(Number(event.target.value));
            },
            style: optSlider
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { style: optNumber, children: settings.optimizerTurns === 0 ? "\u4E0D\u5E26" : `${String(settings.optimizerTurns)} \u8F6E` })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
        Toggle,
        {
          label: "\u53EA\u8BFB\u5DE5\u5177",
          hint: "\u5141\u8BB8\u89E3\u91CA\u5C42\u8BFB\u9879\u76EE\u6587\u4EF6\u6838\u5BF9\u4E8B\u5B9E\uFF08read/glob/grep\uFF09\uFF1A\u9650\u5B9A\u4F1A\u8BDD\u5DE5\u4F5C\u76EE\u5F55\u3001\u53EA\u8BFB\u3001\u6709\u4E0A\u9650",
          on: settings.optimizeReadTools,
          onToggle: actions.setReadTools
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
        Toggle,
        {
          label: "\u5185\u7F6E Bash",
          hint: "\u5141\u8BB8\u89E3\u91CA\u5C42\u6267\u884C shell \u547D\u4EE4\u6838\u5BF9\u4E8B\u5B9E\uFF1A\u9501\u5B9A\u4F1A\u8BDD\u5DE5\u4F5C\u76EE\u5F55\u3001\u5355\u6761\u8D85\u65F6 20 \u79D2\u3001\u8F93\u51FA\u622A\u65AD\u3001\u9010\u6761\u8BB0\u8D26\uFF08\u9ED8\u8BA4\u5173\uFF09",
          on: settings.optimizeBash,
          onToggle: actions.setBash
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { style: optRow, children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { style: optLabel, title: "\u6539\u89E3\u91CA\u5C42\u300C\u4EFB\u52A1\u4E0E\u98CE\u683C\u300D\u90A3\u4E00\u6BB5\u63D0\u793A\u8BCD\uFF1B\u8F93\u51FA\u5951\u7EA6\u7531\u63D2\u4EF6\u8FFD\u52A0\uFF0C\u6539\u4E0D\u6389", children: "\u8BE6\u60C5" }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
          "button",
          {
            type: "button",
            "aria-expanded": detailOpen,
            title: "\u5C55\u5F00/\u6536\u8D77\u63D0\u793A\u8BCD\u7F16\u8F91",
            style: optSegButton,
            onMouseDown: (event) => {
              event.preventDefault();
            },
            onClick: () => {
              setDetailOpen(!detailOpen);
            },
            children: detailOpen ? "\u6536\u8D77 \u25BE" : "\u5C55\u5F00 \u25B8"
          }
        )
      ] }),
      detailOpen && /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_jsx_runtime15.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { style: optHint, children: "\u6539\u7684\u662F**\u8FD9\u4E00\u6863**\u7684\u300C\u4EFB\u52A1\u4E0E\u98CE\u683C\u300D\u6BB5\uFF1B\u7559\u7A7A = \u7528\u5185\u7F6E\u90A3\u4EFD\u3002\u8F93\u51FA\u5951\u7EA6\uFF08\u516D\u7C7B\u6761\u76EE\u4E0E\u5FC5\u586B\u4F9D\u636E\uFF09\u7531\u63D2\u4EF6\u8FFD\u52A0\uFF0C\u6539\u4E0D\u6389 \u2014\u2014 \u5B83\u6B63\u662F\u5BBF\u4E3B\u9010\u6761\u6821\u9A8C\u5F15\u6587\u7684\u4F9D\u636E\u3002" }),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
          "textarea",
          {
            "aria-label": "\u81EA\u5B9A\u4E49\u63D0\u793A\u8BCD",
            value: prompt,
            placeholder: tierOff ? "\u6863\u4F4D\u662F\u300C\u5173\u95ED\u300D\uFF1A\u8FD9\u4E00\u6863\u4E0D\u8C03\u7528\u6A21\u578B\uFF0C\u6CA1\u6709\u63D0\u793A\u8BCD" : "\u7559\u7A7A = \u7528\u5185\u7F6E\u90A3\u4EFD",
            disabled: tierOff,
            onChange: (event) => {
              actions.setPrompt(event.target.value);
            },
            style: optPromptBox,
            spellCheck: false
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)("div", { style: optRow, children: [
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)("span", { style: optLabel }),
          /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(
            "button",
            {
              type: "button",
              title: "\u6E05\u7A7A\u81EA\u5B9A\u4E49\u63D0\u793A\u8BCD\uFF0C\u56DE\u5230\u63D2\u4EF6\u5185\u7F6E\u90A3\u4E00\u4EFD",
              style: optSegButton,
              disabled: prompt === "",
              onMouseDown: (event) => {
                event.preventDefault();
              },
              onClick: () => {
                actions.setPrompt("");
              },
              children: "\u6062\u590D\u5185\u7F6E"
            }
          )
        ] })
      ] })
    ] })
  ] });
}

// src/client/optimize-clock.ts
var import_react18 = require("react");
var TICK_MS2 = 1e3;
function useOptimizeElapsed(startedAt) {
  const running = startedAt > 0;
  const [seconds, setSeconds] = (0, import_react18.useState)(() => elapsedSeconds(startedAt, Date.now()));
  (0, import_react18.useEffect)(() => {
    setSeconds(elapsedSeconds(startedAt, Date.now()));
    if (!running) return void 0;
    const timer = setInterval(() => {
      setSeconds(elapsedSeconds(startedAt, Date.now()));
    }, TICK_MS2);
    return () => {
      clearInterval(timer);
    };
  }, [startedAt, running]);
  return running ? seconds : 0;
}

// src/client/panel-sections.ts
var DEFAULT_PANEL_SECTION = "quick";
var PANEL_OPEN_SECTION = DEFAULT_PANEL_SECTION;
var OPTIONS_FOLD_DEFAULT_OPEN = false;
function sectionOnPanelOpen(running) {
  return running ? "optimize" : PANEL_OPEN_SECTION;
}
function toggleSection(current) {
  return current === "quick" ? "optimize" : "quick";
}
function sectionForDock(dockPresent, current) {
  return dockPresent ? "optimize" : current;
}

// src/client/OptimizeDock.tsx
var import_react19 = require("react");

// src/client/optimize-dock.ts
function dockReducer(state3, event) {
  switch (event.type) {
    case "restore":
      return event.snapshot;
    case "start":
      return {
        phase: "running",
        items: [],
        dropped: [],
        text: "",
        edited: false,
        error: "",
        route: "",
        truncated: false,
        fallback: false,
        retried: false,
        promptSource: "",
        itemCount: 0,
        startedAt: event.startedAt,
        elapsedMs: 0,
        draftAtStart: event.draft,
        source: event.source,
        slashPrefix: event.prefix
      };
    case "item": {
      if (state3 === null) return state3;
      if (state3.items.some((row2) => row2.id === event.item.id)) return state3;
      return { ...state3, items: [...state3.items, event.item] };
    }
    case "dropped": {
      if (state3 === null) return state3;
      if (state3.dropped.some((row2) => row2.id === event.row.id)) return state3;
      return { ...state3, dropped: [...state3.dropped, event.row] };
    }
    case "done": {
      if (state3 === null) return state3;
      const outcome = event.outcome;
      const ok = outcome.ok === true;
      return {
        ...state3,
        phase: ok ? "done" : "error",
        text: ok ? outcome.text ?? "" : "",
        edited: false,
        error: ok ? "" : outcome.error ?? "\u4F18\u5316\u5931\u8D25",
        route: outcome.route ?? "",
        truncated: outcome.truncated === true,
        fallback: outcome.fallback === true,
        retried: outcome.retried === true,
        promptSource: outcome.promptSource ?? "",
        itemCount: typeof outcome.itemCount === "number" ? outcome.itemCount : state3.items.length,
        startedAt: 0,
        elapsedMs: elapsed(state3.startedAt, event.at)
      };
    }
    case "cancel": {
      if (state3 === null) return state3;
      return { ...state3, phase: "cancelled", startedAt: 0, elapsedMs: elapsed(state3.startedAt, event.at), error: "" };
    }
    case "edit": {
      if (state3 === null) return state3;
      return { ...state3, text: event.text, edited: true };
    }
    case "clear":
      return null;
  }
}
function elapsed(startedAt, at) {
  if (startedAt <= 0 || !Number.isFinite(at)) return 0;
  return at > startedAt ? at - startedAt : 0;
}
function insertDecision(state3, currentDraft2, confirmed) {
  if (state3 === null || state3.phase !== "done" || state3.text.trim() === "") return "empty";
  if (confirmed) return "insert";
  return sameDraft(state3.draftAtStart, currentDraft2) ? "insert" : "confirm";
}
function dockSummary(state3) {
  const bits = [];
  if (state3.fallback) bits.push("\u6A21\u578B\u6CA1\u6309\u6761\u76EE\u5951\u7EA6\u8F93\u51FA\uFF0C\u5DF2\u6574\u6BB5\u7167\u6536\uFF08\u672A\u6821\u9A8C\u4F9D\u636E\uFF09");
  else {
    const count2 = state3.phase === "done" && state3.itemCount > 0 ? state3.itemCount : state3.items.length;
    bits.push(`${String(count2)} \u6761\u8865\u5168`);
  }
  if (state3.dropped.length > 0) bits.push(`\u4E22\u5F03 ${String(state3.dropped.length)} \u6761`);
  if (state3.promptSource === "custom") bits.push("\u81EA\u5B9A\u4E49\u63D0\u793A\u8BCD");
  if (state3.retried) bits.push("\u91CD\u8BD5\u8FC7\u4E00\u6B21");
  if (state3.truncated) bits.push("\u7BC7\u5E45\u95F8\u95E8\u52A8\u8FC7\u624B\uFF08\u7701\u7565\u4E86\u53EF\u9009\u7684\u8282\uFF09");
  if (state3.edited) bits.push("\u4F60\u624B\u6539\u8FC7");
  return bits.join(" \xB7 ");
}
function dockPhaseText(state3) {
  switch (state3.phase) {
    case "running":
      return "\u6B63\u5728\u4F18\u5316\u2026\uFF08\u7B49\u5F85\u6A21\u578B\u54CD\u5E94\uFF09";
    case "done":
      return "\u4F18\u5316\u5B8C\u6210";
    case "cancelled":
      return "\u5DF2\u53D6\u6D88\uFF1A\u4E0B\u9762\u662F\u5DF2\u7ECF\u751F\u6210\u7684\u90E8\u5206";
    case "error":
      return "\u51FA\u9519\u4E86";
  }
}
var DOCK_RESTORE_MAX_ITEMS = 12;
var DOCK_RESTORE_MAX_TEXT = 6e4;
var restoreStr = (value, max) => typeof value === "string" ? value.slice(0, max) : "";
var restoreNum = (value) => typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
function sanitizeDockSnapshot(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const row2 = raw;
  const phase = row2.phase;
  if (phase !== "running" && phase !== "done" && phase !== "error" && phase !== "cancelled") return null;
  const items = [];
  for (const entry of Array.isArray(row2.items) ? row2.items : []) {
    if (items.length >= DOCK_RESTORE_MAX_ITEMS) break;
    if (typeof entry !== "object" || entry === null) continue;
    const item = entry;
    const id = restoreStr(item.id, 80);
    const body = restoreStr(item.text, 6e3);
    if (id === "" && body === "") continue;
    items.push({
      index: restoreNum(item.index) || items.length + 1,
      id,
      kind: restoreStr(item.kind, 40),
      text: body,
      quote: restoreStr(item.quote, 6e3),
      quoteSource: restoreStr(item.quoteSource, 16) === "user" ? "user" : "none"
    });
  }
  const dropped = [];
  for (const entry of Array.isArray(row2.dropped) ? row2.dropped : []) {
    if (dropped.length >= DOCK_RESTORE_MAX_ITEMS * 2) break;
    if (typeof entry !== "object" || entry === null) continue;
    const item = entry;
    const reason = restoreStr(item.reason, 200);
    if (reason === "") continue;
    dropped.push({
      id: restoreStr(item.id, 80),
      kind: restoreStr(item.kind, 40),
      reason
    });
  }
  return {
    // 重启前那一轮没跑完：如实当"已取消"，不假装还在跑（秒表也不再走）。
    phase: phase === "running" ? "cancelled" : phase,
    items,
    dropped,
    text: restoreStr(row2.text, DOCK_RESTORE_MAX_TEXT),
    edited: row2.edited === true,
    error: restoreStr(row2.error, 400),
    route: restoreStr(row2.route, 200),
    truncated: row2.truncated === true,
    fallback: row2.fallback === true,
    retried: row2.retried === true,
    promptSource: restoreStr(row2.promptSource, 32),
    itemCount: restoreNum(row2.itemCount),
    // 恢复的框不该有秒表在跑：起点归零，耗时用存下来的值。
    startedAt: 0,
    elapsedMs: restoreNum(row2.elapsedMs),
    draftAtStart: restoreStr(row2.draftAtStart, 2e4),
    source: restoreStr(row2.source, 2e4),
    slashPrefix: restoreStr(row2.slashPrefix, 40)
  };
}

// src/client/OptimizeDock.tsx
var import_jsx_runtime16 = require("react/jsx-runtime");
var KIND_LABEL = {
  // 0.14.0（上游本体）六类
  user_requirement: "\u4F60\u8981\u7684",
  quality_interpretation: "\u8D28\u91CF\u89E3\u8BFB",
  observed_fact: "\u5DF2\u6838\u5B9E",
  implementation_option: "\u53EF\u9006\u7EC6\u8282",
  proposal: "\u5EFA\u8BAE",
  // 0.13.x 旧本体（装配仍认，标签保留）
  rewrite: "\u6539\u5199",
  requirement: "\u8865\u5168\xB7\u8981\u6C42",
  quality: "\u8865\u5168\xB7\u8D28\u91CF",
  unknown: "\u5F85\u4F60\u5B9A",
  plan: "\u5206\u9636\u6BB5\u8BA1\u5212",
  risk: "\u98CE\u9669\u4E0E\u9884\u6848"
};
async function copyText(text) {
  if (text === "") return false;
  try {
    if (navigator.clipboard !== void 0) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "readonly");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}
function OptimizeDock({ state: state3, seconds, actions }) {
  const [copied, setCopied] = (0, import_react19.useState)(false);
  const [discardArmed, setDiscardArmed] = (0, import_react19.useState)(false);
  const running = state3.phase === "running";
  const hasText = state3.text.trim() !== "";
  const canInsert = state3.phase === "done" && hasText;
  const onCopy = () => {
    void copyText(state3.text).then((ok) => {
      if (!ok) return;
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 1500);
    });
  };
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { style: dockBox, role: "group", "aria-label": "\u4F18\u5316\u7ED3\u679C", children: [
    /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { style: dockHead, children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { style: dockPhase, role: "status", children: dockPhaseText(state3) }),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { style: dockMeta, children: running ? `\u5DF2\u7B49\u5F85 ${String(seconds)}s` : state3.elapsedMs > 0 ? `\u7528\u65F6 ${(state3.elapsedMs / 1e3).toFixed(1)} \u79D2` : "" }),
      !running && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
        "button",
        {
          type: "button",
          style: discardArmed ? dockButtonWarn : dockButtonGhost,
          title: discardArmed ? "\u518D\u70B9\u4E00\u6B21\u5C31\u771F\u7684\u4E22\u6389\u8FD9\u4EFD\u7ED3\u679C\uFF08\u4E0D\u53EF\u6062\u590D\uFF09" : "\u4E22\u5F03\u8FD9\u4EFD\u7ED3\u679C\uFF08\u4E0D\u53EF\u6062\u590D\uFF1B\u53EA\u60F3\u6536\u8D77\u6765\u5C31\u70B9\u53F3\u8FB9\u7684 \u2715\uFF09",
          onMouseDown: (event) => {
            event.preventDefault();
          },
          onClick: () => {
            if (!discardArmed) {
              setDiscardArmed(true);
              setTimeout(() => {
                setDiscardArmed(false);
              }, 4e3);
              return;
            }
            setDiscardArmed(false);
            actions.discard();
          },
          children: discardArmed ? "\u70B9\u7B2C\u4E8C\u6B21\u4E22\u5F03" : "\u4E22\u5F03"
        }
      ),
      running ? /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
        "button",
        {
          type: "button",
          style: dockButton,
          title: "\u4E2D\u6B62\u8FD9\u4E00\u8F6E\uFF0C\u4FDD\u7559\u5DF2\u7ECF\u751F\u6210\u7684\u90E8\u5206",
          onMouseDown: (event) => {
            event.preventDefault();
          },
          onClick: actions.cancel,
          children: "\u53D6\u6D88"
        }
      ) : /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
        "button",
        {
          type: "button",
          style: dockButton,
          "aria-label": "\u6536\u8D77\u7ED3\u679C\u6846",
          title: "\u6536\u8D77\u7ED3\u679C\u6846\uFF080.13.2 \u8D77\u53EA\u662F\u6536\u8D77\uFF1A\u7ED3\u679C\u7559\u7740\uFF0C\u70B9\u300C\u4F18\u5316\u63D0\u793A\u8BCD\u300D\u90A3\u4E00\u534A\u5C31\u80FD\u518D\u770B\u5230\uFF1B\u60F3\u5220\u6389\u7528\u65C1\u8FB9\u7684\u300C\u4E22\u5F03\u300D\uFF09",
          onMouseDown: (event) => {
            event.preventDefault();
          },
          onClick: actions.close,
          children: "\u2715"
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { style: dockBody, children: [
      state3.items.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("ol", { style: dockList, children: state3.items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("li", { style: dockItemRow, children: [
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { style: dockKind, children: KIND_LABEL[item.kind] ?? item.kind }),
        /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { style: dockItemText, children: item.text }),
        item.quote !== "" && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("span", { style: dockMeta, children: item.quoteSource === "none" ? `\uFF08\u6A21\u578B\u81EA\u5DF1\u8865\u7684\uFF0C\u4F9D\u636E\u4E0D\u662F\u4F60\u539F\u8BDD\uFF1A\u300C${item.quote}\u300D\uFF09` : `\uFF08\u4F9D\u636E\uFF1A"${item.quote}"\uFF09` })
      ] }, item.id)) }),
      state3.dropped.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { style: dockDropped, children: `\u4E22\u5F03 ${String(state3.dropped.length)} \u6761\uFF1A${state3.dropped.map((row2) => row2.reason).join("\uFF1B")}` }),
      state3.phase === "error" && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { style: dockError, role: "alert", children: state3.error === "" ? "\u4F18\u5316\u5931\u8D25" : state3.error }),
      (state3.phase === "done" || state3.phase === "cancelled") && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
        "textarea",
        {
          value: state3.text,
          onChange: (event) => {
            actions.edit(event.target.value);
          },
          spellCheck: false,
          "aria-label": "\u4F18\u5316\u540E\u7684\u63D0\u793A\u8BCD\uFF08\u53EF\u7F16\u8F91\uFF09",
          placeholder: state3.phase === "cancelled" ? "\u53D6\u6D88\u65F6\u8FD8\u6CA1\u6709\u6210\u54C1\uFF1A\u4E0A\u9762\u662F\u5DF2\u751F\u6210\u7684\u90E8\u5206\u3002\u70B9\u300C\u91CD\u65B0\u4F18\u5316\u300D\u8DD1\u5B8C\u4E00\u8F6E\u5C31\u80FD\u62FF\u5230\u6210\u54C1\u3002" : "\uFF08\u6210\u54C1\u4E3A\u7A7A\uFF09",
          style: dockEditor
        }
      ),
      state3.phase === "done" && /* @__PURE__ */ (0, import_jsx_runtime16.jsx)("div", { style: dockSummaryLine, children: state3.route === "" ? dockSummary(state3) : `${dockSummary(state3)} \xB7 ${state3.route}` })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)("div", { style: { ...dockButtons, ...dockButtonsPinned }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
        "button",
        {
          type: "button",
          disabled: !canInsert,
          style: canInsert ? dockButtonPrimary : dockButtonDisabled,
          title: canInsert ? "\u628A\u6210\u54C1\u5199\u56DE\u8F93\u5165\u6846\uFF08\u8986\u76D6\u5168\u6587\uFF0CCtrl+Z \u53EF\u8FD8\u539F\uFF09" : "\u8FD8\u6CA1\u6709\u6210\u54C1\u53EF\u63D2\u5165",
          onMouseDown: (event) => {
            event.preventDefault();
          },
          onClick: actions.insert,
          children: "\u63D2\u5165\u8F93\u5165\u6846"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
        "button",
        {
          type: "button",
          disabled: running,
          style: running ? dockButtonDisabled : dockButton,
          title: state3.edited ? "\u518D\u8DD1\u4E00\u8F6E\uFF08\u4F1A\u8986\u76D6\u4F60\u5728\u6846\u91CC\u624B\u6539\u7684\u5185\u5BB9\uFF09" : "\u7528\u540C\u4E00\u6BB5\u539F\u6587\u518D\u8DD1\u4E00\u8F6E",
          onMouseDown: (event) => {
            event.preventDefault();
          },
          onClick: actions.retry,
          children: "\u91CD\u65B0\u4F18\u5316"
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(
        "button",
        {
          type: "button",
          disabled: !hasText,
          style: hasText ? dockButton : dockButtonDisabled,
          title: "\u590D\u5236\u6210\u54C1",
          onMouseDown: (event) => {
            event.preventDefault();
          },
          onClick: onCopy,
          children: copied ? "\u5DF2\u590D\u5236 \u2713" : "\u590D\u5236"
        }
      )
    ] })
  ] });
}

// src/client/QuickCommandsPanel.tsx
var import_jsx_runtime17 = require("react/jsx-runtime");
var MARGIN = 8;
var GAP = 8;
function QuickCommandsPanel({
  useLive,
  usePanel,
  useBusy,
  useStartedAt,
  useNotice,
  useBook,
  useBookStatus,
  useDock,
  useDockHidden,
  actions
}) {
  const settings = useLive((item) => item);
  const anchor = usePanel((item) => item);
  const busy = useBusy((item) => item);
  const startedAt = useStartedAt((item) => item);
  const notice = useNotice((item) => item);
  const book = useBook((item) => item);
  const status = useBookStatus((item) => item);
  const dock = useDock((item) => item);
  const dockHidden = useDockHidden((item) => item);
  const ref = (0, import_react20.useRef)(null);
  const [position, setPosition] = (0, import_react20.useState)(null);
  const [activeId, setActiveId] = (0, import_react20.useState)("");
  const [section, setSection] = (0, import_react20.useState)(DEFAULT_PANEL_SECTION);
  const [optionsOpen, setOptionsOpen] = (0, import_react20.useState)(OPTIONS_FOLD_DEFAULT_OPEN);
  const dockPresent = dock !== null;
  const tierOff = settings.optimizerTier === "off";
  const seconds = useOptimizeElapsed(busy ? startedAt : 0);
  const dockRunning = dock !== null && dock.phase === "running";
  const dockSeconds = useOptimizeElapsed(dockRunning && dock !== null ? dock.startedAt : 0);
  const counts = bookCounts(book);
  const categories = book.categories;
  const active2 = categories.find((category) => category.id === activeId) ?? categories[0];
  (0, import_react20.useLayoutEffect)(() => {
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
  }, [anchor?.left, anchor?.bottom, counts.prompts, categories.length, busy, section, dock !== null]);
  (0, import_react20.useEffect)(() => {
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
      if (dockRunning) {
        actions.dockCancel();
        return;
      }
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
  }, [anchor === null, actions, dockRunning]);
  const panelOpen = anchor !== null;
  const dockVisible = dockPresent && !dockHidden;
  const prevOpen = (0, import_react20.useRef)(false);
  const prevDockVisible = (0, import_react20.useRef)(false);
  if (prevOpen.current !== panelOpen) {
    prevOpen.current = panelOpen;
    if (panelOpen) {
      const next = sectionOnPanelOpen(dockRunning);
      if (next !== section) setSection(next);
      if (optionsOpen !== OPTIONS_FOLD_DEFAULT_OPEN) setOptionsOpen(OPTIONS_FOLD_DEFAULT_OPEN);
      prevDockVisible.current = dockVisible;
    }
  }
  if (panelOpen && prevDockVisible.current !== dockVisible) {
    prevDockVisible.current = dockVisible;
    const next = sectionForDock(dockVisible, section);
    if (next !== section) setSection(next);
  }
  if (anchor === null) return null;
  const tier = settings.optimizerTier;
  const items = active2?.prompts ?? [];
  const failure = status !== "" && status !== "saving" ? status : "";
  return /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(
    "div",
    {
      ref,
      role: "dialog",
      "aria-label": "\u5FEB\u6377\u6307\u4EE4",
      style: { ...quickPanel, left: position?.left ?? anchor.left, top: position?.top ?? anchor.bottom },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { style: quickPanelHead, children: [
          /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { style: quickPanelTitleRow, children: [
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { style: quickPanelTitle, children: "\u5FEB\u6377\u6307\u4EE4" }),
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { style: quickTierRow, role: "group", "aria-label": "\u4F18\u5316\u5F3A\u5EA6", children: OPTIMIZER_TIERS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
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
          /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(
            "button",
            {
              type: "button",
              disabled: busy || tierOff,
              title: tierOff ? "\u6863\u4F4D\u662F\u300C\u5173\u95ED\u300D\uFF1A\u4E0D\u4F18\u5316\uFF08\u5230\u4E0B\u9762\u7684\u300C\u4F18\u5316\u9009\u9879\u300D\u628A\u6863\u4F4D\u62E8\u5230\u8F7B\u5EA6\u6216\u4EE5\u4E0A\uFF09" : "\u628A\u8F93\u5165\u6846\u91CC\u7684\u8BDD\u4EA4\u7ED9\u53E6\u4E00\u4E2A AI \u6574\u7406\u6210\u4E00\u6761\u53EF\u4EE5\u76F4\u63A5\u53D1\u51FA\u53BB\u7684\u6E05\u6670\u6307\u4EE4\uFF0C\u7ED3\u679C\u76F4\u63A5\u5199\u56DE\u8F93\u5165\u6846\u3002\u5B83\u53EA\u80FD\u4EA7\u51FA\u80FD\u6307\u56DE\u4F60\u539F\u8BDD\u67D0\u4E00\u53E5\u7684\u8865\u5168\uFF0C\u6307\u4E0D\u56DE\u53BB\u7684\u4F1A\u88AB\u4E22\u6389\u5E76\u8BB0\u8D26",
              style: busy || tierOff ? quickPrimaryButtonDisabled : quickPrimaryButton,
              onMouseDown: (event) => {
                event.preventDefault();
              },
              onClick: () => {
                actions.optimize();
                if (section !== "optimize") setSection("optimize");
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { "aria-hidden": true, children: "\u2728" }),
                /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { children: tierOff ? "\u4F18\u5316\u5DF2\u5173\u95ED" : busy ? `\u4F18\u5316\u4E2D\u2026\uFF08${String(seconds)}s\uFF09` : "\u4F18\u5316\u63D0\u793A\u8BCD" })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(
          "button",
          {
            type: "button",
            style: quickSectionToggle,
            "aria-expanded": section === "optimize",
            title: section === "optimize" ? "\u6536\u8D77\u300C\u4F18\u5316\u63D0\u793A\u8BCD\u300D\uFF0C\u56DE\u5230\u300C\u5FEB\u6377\u6307\u4EE4\u300D" : "\u5C55\u5F00\u300C\u4F18\u5316\u63D0\u793A\u8BCD\u300D\uFF08\u7ED3\u679C\u6846\u5C31\u5728\u91CC\u9762\uFF1B\u4E0A\u9762\u70B9 \u2728 \u4E5F\u4F1A\u81EA\u52A8\u5C55\u5F00\uFF09",
            onMouseDown: (event) => {
              event.preventDefault();
            },
            onClick: () => {
              const next = toggleSection(section);
              if (next === "optimize") actions.dockShow();
              setSection(next);
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { style: quickSectionToggleArrow, "aria-hidden": true, children: section === "optimize" ? "\u25BE" : "\u25B8" }),
              /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { children: "\u4F18\u5316\u63D0\u793A\u8BCD" }),
              /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { style: { marginLeft: "auto", color: "var(--dsw-alias-label-tertiary)" }, children: section === "optimize" ? "\u70B9\u6B64\u56DE\u5230\u5FEB\u6377\u6307\u4EE4" : dockPresent ? "\u4E0A\u6B21\u7684\u7ED3\u679C\u5728\u8FD9\u513F" : "\u8FD8\u6CA1\u6709\u7ED3\u679C" })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { style: quickSectionBody, children: [
          section === "optimize" && /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
            OptimizeOptionsCard,
            {
              settings,
              open: optionsOpen,
              onToggle: () => {
                setOptionsOpen((value) => !value);
              },
              actions: {
                setFraming: (value) => {
                  actions.setField(OPTIMIZER_FRAMING_FIELD, value);
                },
                setPermission: (value) => {
                  actions.setField(OPTIMIZER_PERMISSION_FIELD, value);
                },
                setModel: (value) => {
                  actions.setField(OPTIMIZER_MODEL_FIELD, value);
                },
                setHistory: (value) => {
                  actions.setField(OPTIMIZER_HISTORY_FIELD, value);
                },
                setTurns: (value) => {
                  actions.setField(OPTIMIZER_TURNS_FIELD, value);
                },
                setReadTools: (on) => {
                  actions.setField(OPTIMIZE_READ_TOOLS_FIELD, on);
                },
                setBash: (on) => {
                  actions.setField(OPTIMIZE_BASH_FIELD, on);
                },
                setPrompt: (value) => {
                  const field = optimizerPromptFieldOf(settings.optimizerTier);
                  if (field !== "") actions.setField(field, value);
                }
              }
            }
          ),
          dock !== null && section === "optimize" && /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { style: { padding: "8px 12px 8px", flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }, children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
            OptimizeDock,
            {
              state: dock,
              seconds: dockSeconds,
              actions: {
                insert: actions.dockInsert,
                retry: actions.dockRetry,
                cancel: actions.dockCancel,
                // 关掉结果框顺手切回快捷指令那半：此时优化半已经没内容了。
                close: () => {
                  actions.dockClose();
                  setSection(DEFAULT_PANEL_SECTION);
                },
                discard: () => {
                  actions.dockDiscard();
                  setSection(DEFAULT_PANEL_SECTION);
                },
                edit: actions.dockEdit
              }
            }
          ) }),
          section === "optimize" && dock === null && /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { style: quickEmpty, children: [
            "\u8FD8\u6CA1\u8DD1\u8FC7\u4F18\u5316\u3002",
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("br", {}),
            "\u70B9\u4E0A\u9762\u7684\u300C\u2728 \u4F18\u5316\u63D0\u793A\u8BCD\u300D\u628A\u8F93\u5165\u6846\u91CC\u7684\u8BDD\u4EA4\u7ED9\u53E6\u4E00\u4E2A AI \u6574\u7406\u6210\u4E00\u6761\u80FD\u76F4\u63A5\u53D1\u7684\u6E05\u6670\u6307\u4EE4 \u2014\u2014 \u7ED3\u679C\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\uFF08\u53EF\u7F16\u8F91\u3001\u53EF\u63D2\u5165\u8F93\u5165\u6846\u3001\u53EF\u590D\u5236\uFF09\u3002",
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("br", {}),
            "\u5F3A\u5EA6\u7528\u6807\u9898\u884C\u90A3\u4E09\u4E2A\u6863\u4F4D\uFF08\u666E\u901A / \u9AD8\u7EA7 / \u6781\u7AEF\uFF09\u3002"
          ] }),
          section === "quick" && /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(import_jsx_runtime17.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("div", { style: { padding: "8px 12px 0" }, children: /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { style: quickCategoryRow, children: [
              categories.map((category) => /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
                "button",
                {
                  type: "button",
                  title: `${category.name}\uFF08${String(category.prompts.length)} \u6761\uFF09`,
                  "aria-pressed": category.id === active2?.id,
                  style: category.id === active2?.id ? quickCategoryTabActive : quickCategoryTab,
                  onMouseDown: (event) => {
                    event.preventDefault();
                  },
                  onClick: () => {
                    setActiveId(category.id);
                  },
                  children: category.name
                },
                category.id
              )),
              /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
                "button",
                {
                  type: "button",
                  style: quickCategoryAdd,
                  disabled: categories.length >= QUICK_CATEGORY_MAX,
                  title: "\u65B0\u589E\u4E00\u4E2A\u5206\u7C7B\uFF08\u540D\u5B57\u5230\u300C\u8BBE\u7F6E \u2192 \u8F93\u5165\u4F53\u9A8C\u300D\u91CC\u6539\uFF09",
                  onMouseDown: (event) => {
                    event.preventDefault();
                  },
                  onClick: () => {
                    actions.addCategory(DEFAULT_CATEGORY_NAME);
                  },
                  children: "\uFF0B"
                }
              )
            ] }) }),
            /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { style: quickList, children: [
              items.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { style: quickEmpty, children: [
                "\u8FD9\u4E2A\u5206\u7C7B\u91CC\u8FD8\u6CA1\u6709\u6761\u76EE\u3002",
                /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("br", {}),
                "\u5728\u300C\u8BBE\u7F6E \u2192 \u8F93\u5165\u4F53\u9A8C \u2192 \u5FEB\u6377\u6307\u4EE4\u6E05\u5355\u300D\u91CC\u6DFB\u52A0\u3002"
              ] }),
              items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 4 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(
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
                      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { style: quickItemLabel, children: item.label }),
                      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { style: quickItemPreview, children: item.prompt.replace(/\s+/g, " ") })
                    ]
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
                  InsertModeControl,
                  {
                    compact: true,
                    label: item.label,
                    mode: insertModeOf(item),
                    onChange: (mode) => {
                      actions.setInsertMode(item.id, mode);
                    }
                  }
                )
              ] }, item.id)),
              active2 !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(
                AddPromptRow,
                {
                  variant: "panel",
                  book,
                  categoryId: active2.id,
                  onAdd: () => {
                    actions.addPrompt(active2.id);
                  },
                  onMove: (promptId) => {
                    actions.movePrompt(promptId, active2.id);
                  }
                }
              )
            ] })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)("div", { style: quickPanelFoot, children: [
          /* @__PURE__ */ (0, import_jsx_runtime17.jsx)("span", { style: quickNotice, role: "status", children: notice !== "" ? notice : failure }),
          /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(
            "span",
            {
              style: quickFootHint,
              title: "\u6570\u636E\u5728 ~/.dsh/quick-prompts.json",
              children: [
                counts.categories,
                " \u5206\u7C7B \xB7 ",
                counts.prompts,
                " \u6761"
              ]
            }
          )
        ] })
      ]
    }
  );
}

// src/client/optimize-state.ts
init_settings_contract();
var textOf2 = (value) => typeof value === "string" && value !== "" ? value : void 0;
async function request(method, body) {
  try {
    const response = await fetch(OPTIMIZE_STATE_API_PATH, {
      method,
      headers: body === void 0 ? void 0 : { "content-type": "application/json" },
      body: body === void 0 ? void 0 : JSON.stringify(body)
    });
    const raw = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, state: null, hidden: false, keep: true, error: `\u670D\u52A1\u7AEF\u8FD4\u56DE\u7684\u4E0D\u662F JSON\uFF08HTTP ${String(response.status)}\uFF09` };
    }
    const row2 = typeof parsed === "object" && parsed !== null ? parsed : {};
    return {
      ok: row2.ok === true,
      state: sanitizeDockSnapshot(row2.state),
      hidden: row2.hidden === true,
      keep: row2.keep !== false,
      ...textOf2(row2.file) === void 0 ? {} : { file: textOf2(row2.file) },
      ...textOf2(row2.error) === void 0 ? {} : { error: textOf2(row2.error) },
      ...textOf2(row2.quarantined) === void 0 ? {} : { quarantined: textOf2(row2.quarantined) },
      ...row2.tooBig === true ? { tooBig: true } : {}
    };
  } catch (error) {
    return { ok: false, state: null, hidden: false, keep: true, error: error instanceof Error ? error.message : String(error) };
  }
}
function loadDockState() {
  return request("GET");
}
function saveDockState(state3, hidden = false) {
  return request("POST", { state: state3, hidden: hidden === true });
}
function clearDockStateOnHost() {
  return saveDockState(null);
}

// src/client.tsx
var name = "composer-ux";
var inject = ["slots"];
var NULL_SCOPE = {
  getSnapshot: () => ({ status: "unavailable", value: void 0 }),
  subscribe: () => () => {
  },
  set: async () => false,
  unset: async () => false,
  mutate: async () => false
};
function apply(ctx) {
  const slots = ctx.slots;
  const live = (0, import_dsh_client_store.createSnapshotStore)({ ...DEFAULT_SETTINGS });
  const panel = (0, import_dsh_client_store.createSnapshotStore)(null);
  const optimizing = (0, import_dsh_client_store.createSnapshotStore)(false);
  const optimizeStartedAt = (0, import_dsh_client_store.createSnapshotStore)(0);
  const dock = (0, import_dsh_client_store.createSnapshotStore)(null);
  const dockHidden = (0, import_dsh_client_store.createSnapshotStore)(false);
  const keepDockOn = () => live.getSnapshot().optimizeKeepDock === true;
  const DOCK_SAVE_DEBOUNCE_MS = 1200;
  const persistDock = () => {
    if (!keepDockOn()) return;
    void saveDockState(dock.getSnapshot(), dockHidden.getSnapshot());
  };
  const clearPersistedDock = () => {
    void clearDockStateOnHost();
  };
  const panelNotice = (0, import_dsh_client_store.createSnapshotStore)("");
  const writeNotice = (0, import_dsh_client_store.createSnapshotStore)("");
  let scope = NULL_SCOPE;
  const sync = () => {
    const snapshot = scope.getSnapshot();
    live.set(snapshot.status === "ready" && snapshot.value !== void 0 ? { ...DEFAULT_SETTINGS, ...sanitizeSettings(snapshot.value) } : { ...DEFAULT_SETTINGS });
  };
  sync();
  let adopted = false;
  const adoptSettings = (service, shape) => {
    if (adopted || service === null || service === void 0) return;
    const api = service;
    const next = shape === "get" ? api.get?.(NAMESPACE) : api.bind?.({ namespace: NAMESPACE });
    if (next === null || next === void 0) return;
    if (typeof next.getSnapshot !== "function") return;
    adopted = true;
    scope = next;
    sync();
    ctx.effect(() => scope.subscribe(sync), "composer-ux: settings sync");
    ctx.effect(() => {
      let alive = true;
      void loadDockState().then((reply) => {
        if (!alive || !reply.ok || reply.state === null) return;
        dockHidden.set(reply.hidden === true);
        if (dock.getSnapshot() === null) dock.set(dockReducer(null, { type: "restore", snapshot: reply.state }));
      });
      return () => {
        alive = false;
      };
    }, "composer-ux: restore optimize dock");
    ctx.effect(() => {
      let timer = null;
      const schedule = () => {
        if (timer !== null) clearTimeout(timer);
        timer = setTimeout(() => {
          timer = null;
          persistDock();
        }, DOCK_SAVE_DEBOUNCE_MS);
      };
      const unsubscribe = dock.subscribe(schedule);
      const unsubscribeHidden = dockHidden.subscribe(schedule);
      return () => {
        if (timer !== null) clearTimeout(timer);
        unsubscribe();
        unsubscribeHidden();
      };
    }, "composer-ux: persist optimize dock");
  };
  const whenService = (deps, callback) => {
    if (typeof ctx.inject !== "function") return;
    try {
      ctx.inject(deps, callback);
    } catch (error) {
      console.warn("[composer-ux] settings service inject failed", error);
    }
  };
  whenService(["configForms"], (view) => {
    adoptSettings(view.configForms, "get");
  });
  whenService(["settingsScope"], (view) => {
    adoptSettings(view.settingsScope, "bind");
  });
  const peekService = (name2) => {
    try {
      return ctx[name2];
    } catch {
      return void 0;
    }
  };
  adoptSettings(peekService("configForms"), "get");
  adoptSettings(peekService("settingsScope"), "bind");
  const WRITE_READBACK_MS = 1200;
  const WRITE_RETRY_MS = 120;
  const setField = (field, value) => {
    writeNotice.set("");
    const verify = typeof value === "boolean";
    const attempt = (remaining) => {
      void scope.set(field, value).then((accepted) => {
        if (accepted === false) {
          if (remaining > 0) {
            setTimeout(() => {
              attempt(remaining - 1);
            }, WRITE_RETRY_MS);
            return;
          }
          console.warn("[composer-ux] settings write refused", field);
          writeNotice.set(
            `\u5199\u5165\u300C${field}\u300D\u88AB\u5BBF\u4E3B\u62D2\u7EDD\u3002\u5E38\u89C1\u539F\u56E0\uFF1A\u8BBE\u7F6E\u7248\u672C\u521A\u88AB\u6539\u8FC7\uFF08\u542F\u52A8\u65F6\u5BBF\u4E3B\u534A\u4F1A\u81EA\u5DF1\u5199\u4E00\u6B21\uFF09\u3001profile \u7684\u5199\u5165\u9501\u88AB\u5360\u7528\uFF0C\u6216\u662F\u4E00\u628A\u5B64\u513F\u9501\uFF08\u786C\u6740\u91CD\u542F\u7559\u4E0B\u7684\uFF09\u2014\u2014\u89C1 README\u300C\u8BBE\u7F6E\u5199\u4E0D\u8FDB\u53BB\u300D\u4E00\u8282\uFF1B\u91CD\u542F DSH \u540E\u4ECD\u65E0\u6548\uFF0C\u5C31\u624B\u5DE5\u5220\u6389 profiles/<\u4F60\u7684 profile>/package.json.lock\u3002`
          );
          return;
        }
        if (!verify) return;
        setTimeout(() => {
          const now = live.getSnapshot()[field];
          if (now === value) return;
          console.warn("[composer-ux] settings write had no visible effect", field, now, value);
          writeNotice.set(
            `\u5199\u5165\u300C${field}\u300D\u5DF2\u88AB\u5BBF\u4E3B\u63A5\u53D7\uFF0C\u4F46\u8FD0\u884C\u65F6\u7684\u503C\u6CA1\u6709\u53D8\u5316\uFF08\u4ECD\u662F ${String(now)}\uFF09\u3002\u914D\u7F6E\u53EF\u80FD\u5DF2\u7ECF\u843D\u76D8\uFF0C\u53EA\u662F\u8FD9\u4E2A\u8FDB\u7A0B\u6CA1\u63A5\u4F4F\u2014\u2014\u91CD\u542F DSH \u5373\u53EF\u751F\u6548\u3002`
          );
        }, WRITE_READBACK_MS);
      }, (error) => {
        console.error("[composer-ux] settings write failed", error);
        writeNotice.set(`\u5199\u5165\u300C${field}\u300D\u5931\u8D25\uFF1A${error instanceof Error ? error.message : String(error)}`);
      }).catch((error) => {
        console.warn("[composer-ux] settings write threw", field, error);
        writeNotice.set("\u5199\u5165\u300C" + field + "\u300D\u5931\u8D25\uFF1A" + (error instanceof Error ? error.message : String(error)));
      });
    };
    attempt(1);
  };
  const clearField = (field) => {
    void scope.unset(field).then((accepted) => {
      if (accepted === false) console.warn("[composer-ux] settings clear refused", field);
    }, (error) => {
      console.error("[composer-ux] settings clear failed", error);
    });
  };
  const book = (0, import_dsh_client_store.createSnapshotStore)(defaultQuickBook());
  const bookStatus = (0, import_dsh_client_store.createSnapshotStore)("");
  const reloadBook = async () => {
    const reply = await loadPromptBook();
    if (reply.ok && reply.book !== void 0) {
      book.set(reply.book);
      bookStatus.set("");
      return;
    }
    bookStatus.set(reply.error ?? "\u8BFB\u53D6\u5FEB\u6377\u6307\u4EE4\u5931\u8D25");
  };
  const commitBook = (next) => {
    book.set(next);
    bookStatus.set("saving");
    void savePromptBook(next).then(
      (reply) => {
        if (reply.ok && reply.book !== void 0) {
          book.set(reply.book);
          bookStatus.set("");
          return;
        }
        bookStatus.set(reply.error ?? "\u4FDD\u5B58\u5931\u8D25");
        void reloadBook();
      },
      (error) => {
        bookStatus.set(error instanceof Error ? error.message : String(error));
        void reloadBook();
      }
    );
  };
  void reloadBook();
  const bookActions = {
    reload: () => {
      void reloadBook();
    },
    addCategory: (name2) => {
      commitBook(withCategoryAdded(book.getSnapshot(), name2));
    },
    renameCategory: (id, name2) => {
      commitBook(withCategoryRenamed(book.getSnapshot(), id, name2));
    },
    removeCategory: (id) => {
      commitBook(withCategoryRemoved(book.getSnapshot(), id));
    },
    moveCategory: (id, delta) => {
      commitBook(withCategoryMoved(book.getSnapshot(), id, delta));
    },
    addPrompt: (categoryId) => {
      commitBook(withPromptAdded(book.getSnapshot(), categoryId));
    },
    patchPrompt: (categoryId, id, patch) => {
      commitBook(withPromptPatched(book.getSnapshot(), categoryId, id, patch));
    },
    removePrompt: (categoryId, id) => {
      commitBook(withPromptRemoved(book.getSnapshot(), categoryId, id));
    },
    movePrompt: (categoryId, id, delta) => {
      commitBook(withPromptMoved(book.getSnapshot(), categoryId, id, delta));
    },
    resetBook: () => {
      commitBook(defaultQuickBook());
    },
    /** 把某条从它所在分类移到目标分类（「移动到这里」：追加到目标末尾）。 */
    movePromptToCategory: (promptId, toCategoryId) => {
      commitBook(withPromptMovedToCategory(book.getSnapshot(), promptId, toCategoryId));
    },
    /** 设置页「保存」：把编辑器里的整本一次写回（而不是每敲一个字就写盘）。 */
    saveBook: (next) => {
      commitBook(next);
    }
  };
  const resetAll = () => {
    void scope.mutate(
      [
        ENABLED_FIELD,
        SEND_KEY_FIELD,
        NEWLINE_KEY_FIELD,
        PANEL_RESIZE_FIELD,
        PANEL_WIDTH_FIELD,
        PANEL_HEIGHT_FIELD,
        OPTIMIZER_TIER_FIELD,
        // 0.5.0 新增的用户配置：终端档位/路径（「恢复默认」也该把它们恢复）。
        TERMINAL_MODE_FIELD,
        TERMINAL_BASH_PATH_FIELD,
        // 各栏开关也清掉：清掉 = 回到"从没碰过这一栏"⇒ 全关（新装默认的样子）。
        // 若不清，恢复默认之后还会保持之前打开的状态，与"默认关"的语义不符。
        KEYS_ENABLED_FIELD,
        QUICK_ENABLED_FIELD,
        PANEL_ENABLED_FIELD,
        TERMINAL_ENABLED_FIELD,
        // 「统计行」（0.7.0）清掉 = 回到 schema 默认 = 开。这一栏的默认本身就是"开"，
        // 所以"恢复默认"看到的仍是开着的——与上面五栏（清掉即关）方向相反，但各自都对：
        // 清掉的定义是"回到从没碰过的样子"，而这一栏从没碰过的样子就是开。
        STATS_ENABLED_FIELD,
        // 「金额」（0.9.1）的覆盖价也清掉：清掉 = 回到 schema 默认 = 没有覆盖价（全按官方刊例价）。
        // 不清的话，"恢复默认"之后金额还会按用户之前填的价算——那是用户唯一能看出
        // "恢复默认到底生没生效"的数字。
        PRICE_OVERRIDES_FIELD,
        // 「金额」（0.10.0）的另外三项用户偏好也清掉：节假日表（回到内置那份）、峰谷提醒
        // （回到默认：开 + 提前 5 分钟 + 两个方向都提醒）、余额开关（回到默认开）。
        //
        // **但 `SYNCED_PRICES_FIELD` 故意不清**：那是一份"同步来的价格历史档 + 第三方价目元信息"，
        // 清掉等于让 9-10 之前那些会话按今天的价重算 —— "恢复默认"恢复的是**偏好**，
        // 不该动历史账单（与下面那句"宿主半记账字段不清"同一个道理）。
        PEAK_HOLIDAYS_FIELD,
        PEAK_ALERT_FIELD,
        BALANCE_ENABLED_FIELD,
        PRICE_AUTO_SYNC_FIELD,
        // 0.5.0 里那个「可选重启命令」字段已经删掉，但老文档里可能还留着值：
        // 顺手清掉，免得它永远躺在设置文件里没人认识。
        "restartCommand"
      ].map((field) => ({ op: "unset", path: [field] }))
    ).catch((error) => {
      console.error("[composer-ux] settings reset failed", error);
    });
    bookActions.resetBook();
  };
  let noticeTimer;
  const note2 = (message, ms = 4500) => {
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
  let optimizeAbort;
  let insertConfirmed = false;
  const startOptimize = (input) => {
    if (optimizing.getSnapshot()) return;
    const startedAt = Date.now();
    optimizing.set(true);
    optimizeStartedAt.set(startedAt);
    insertConfirmed = false;
    optimizeAbort?.abort();
    const controller = new AbortController();
    optimizeAbort = controller;
    dockHidden.set(false);
    dock.set(dockReducer(dock.getSnapshot(), {
      type: "start",
      source: input.source,
      draft: input.draftAtStart,
      prefix: input.prefix,
      startedAt
    }));
    note2("\u6B63\u5728\u4F18\u5316\u2026\uFF1A\u9010\u6761\u663E\u793A\u5728\u7ED3\u679C\u6846\u91CC\uFF0C\u8DD1\u5B8C\u70B9\u300C\u63D2\u5165\u8F93\u5165\u6846\u300D\u5199\u56DE");
    void optimizeDraftStream(input.source, live.getSnapshot().optimizerTier, {
      onItem: (item) => {
        dock.set(dockReducer(dock.getSnapshot(), { type: "item", item }));
      },
      onDropped: (row2) => {
        dock.set(dockReducer(dock.getSnapshot(), { type: "dropped", row: row2 }));
      }
    }, controller.signal).then(
      (result) => {
        if (controller.signal.aborted) return;
        optimizing.set(false);
        optimizeStartedAt.set(0);
        const next = dockReducer(dock.getSnapshot(), { type: "done", outcome: result, at: Date.now() });
        dock.set(next);
        const used = elapsedText(startedAt, Date.now());
        if (!result.ok) {
          note2(`\u4F18\u5316\u5931\u8D25\uFF08\u7528\u65F6 ${used} \u79D2\uFF09\uFF1A${result.error ?? "\u672A\u77E5\u539F\u56E0"}`);
          return;
        }
        if (live.getSnapshot().optimizerPermission === "auto") {
          if (currentDraft() === input.draftAtStart) {
            quickActions.dockInsert();
          } else {
            note2(`\u6210\u54C1\u5DF2\u5C31\u7EEA\uFF08\u7528\u65F6 ${used} \u79D2\uFF09\uFF1A\u4F60\u5728\u4F18\u5316\u671F\u95F4\u6539\u8FC7\u8F93\u5165\u6846\uFF0C\u6240\u4EE5\u6CA1\u6709\u81EA\u52A8\u5199\u56DE \u2014\u2014 \u70B9\u300C\u63D2\u5165\u8F93\u5165\u6846\u300D\u5373\u53EF`);
          }
          return;
        }
        note2(`\u4F18\u5316\u5B8C\u6210\uFF08${result.route ?? ""}\uFF09\xB7 ${next === null ? "" : dockSummary(next)} \xB7 \u7528\u65F6 ${used} \u79D2 \xB7 \u5728\u7ED3\u679C\u6846\u91CC\u70B9\u300C\u63D2\u5165\u8F93\u5165\u6846\u300D\u5199\u56DE`);
      },
      (error) => {
        if (controller.signal.aborted) return;
        optimizing.set(false);
        optimizeStartedAt.set(0);
        const message = error instanceof Error ? error.message : String(error);
        dock.set(dockReducer(dock.getSnapshot(), { type: "done", outcome: { ok: false, error: message }, at: Date.now() }));
        note2(`\u4F18\u5316\u5931\u8D25\uFF1A${message}`);
      }
    );
  };
  const runOptimize = () => {
    const draft = currentDraft();
    if (draft.trim() === "") {
      note2("\u8F93\u5165\u6846\u662F\u7A7A\u7684\uFF1A\u5148\u5199\u70B9\u4EC0\u4E48\uFF0C\u518D\u70B9\u4F18\u5316");
      return;
    }
    const slash = splitSlashCommand(draft);
    if (slash.prefix !== "" && slash.body === "") {
      note2(`${slash.prefix} \u540E\u9762\u6CA1\u6709\u6B63\u6587\uFF1A\u547D\u4EE4\u672C\u8EAB\u4E0D\u9700\u8981\u4F18\u5316`);
      return;
    }
    const source = slash.prefix === "" ? draft : slash.body;
    startOptimize({ source, draftAtStart: draft, prefix: slash.prefix });
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
    optimize: runOptimize,
    /**
     * 把结果框里的成品写回输入框。
     *
     * 「先问一次」的两步确认（见 insertDecision）：优化是一次往返，期间用户完全可能又打了字，
     * 直接覆盖会静默吃掉他刚写的内容。所以第一次点只提示，第二次点才覆盖 —— 不用浏览器
     * `confirm`（那会打断输入、在桌面壳里还可能被拦）。
     */
    dockInsert: () => {
      const state3 = dock.getSnapshot();
      const decision = insertDecision(state3, currentDraft(), insertConfirmed);
      if (decision === "empty" || state3 === null) {
        note2("\u7ED3\u679C\u6846\u91CC\u8FD8\u6CA1\u6709\u6210\u54C1\u53EF\u63D2\u5165\uFF08\u7B49\u8FD9\u4E00\u8F6E\u8DD1\u5B8C\uFF09");
        return;
      }
      if (decision === "confirm") {
        insertConfirmed = true;
        note2("\u8F93\u5165\u6846\u5728\u4F18\u5316\u671F\u95F4\u88AB\u6539\u8FC7\uFF1A\u518D\u70B9\u4E00\u6B21\u300C\u63D2\u5165\u8F93\u5165\u6846\u300D\u5C31\u8986\u76D6\u5B83\uFF08Ctrl+Z \u53EF\u8FD8\u539F\uFF09");
        return;
      }
      insertConfirmed = false;
      if (!replaceDraft(composeOptimizedDraft(state3.slashPrefix, state3.text))) {
        note2("\u5199\u56DE\u8F93\u5165\u6846\u5931\u8D25\uFF1A\u6CA1\u62FF\u5230\u8F93\u5165\u6846\u7684\u63A7\u5236\u6743\uFF08\u5237\u65B0\u9875\u9762\u518D\u8BD5\uFF09");
        return;
      }
      focusComposer();
      note2(state3.slashPrefix === "" ? "\u5DF2\u63D2\u5165\u8F93\u5165\u6846 \xB7 Ctrl+Z \u53EF\u8FD8\u539F" : `\u5DF2\u63D2\u5165\u8F93\u5165\u6846\uFF08\u4FDD\u7559\u547D\u4EE4 ${state3.slashPrefix}\uFF09\xB7 Ctrl+Z \u53EF\u8FD8\u539F`);
    },
    /** 用**框里那一轮的原文**再跑一轮（不是拿输入框现在的内文 —— 那时你多半已经插进去了）。 */
    dockRetry: () => {
      const state3 = dock.getSnapshot();
      if (state3 === null) return;
      if (state3.edited) note2("\u91CD\u65B0\u4F18\u5316\u4F1A\u8986\u76D6\u4F60\u5728\u7ED3\u679C\u6846\u91CC\u624B\u6539\u7684\u5185\u5BB9");
      startOptimize({
        source: state3.source,
        draftAtStart: currentDraft(),
        prefix: state3.slashPrefix
      });
    },
    /** 中止这一轮并保留已生成的部分（条目流水留着，成品本来就不存在）。 */
    dockCancel: () => {
      const state3 = dock.getSnapshot();
      if (state3 === null || state3.phase !== "running") return;
      optimizeAbort?.abort();
      optimizeAbort = void 0;
      optimizing.set(false);
      optimizeStartedAt.set(0);
      dock.set(dockReducer(state3, { type: "cancel", at: Date.now() }));
      note2("\u5DF2\u53D6\u6D88\u8FD9\u4E00\u8F6E\uFF1A\u4E0A\u9762\u662F\u5DF2\u7ECF\u751F\u6210\u7684\u90E8\u5206");
    },
    /**
     * 收起结果框（0.13.2 起**不再丢内容**）。
     *
     * 内容一直在 dock 里（也一直在盘上），只是标记成「先别显示」；面板那一半的切换按钮会写
     * 「上次的结果在这儿」，点它就能再展开。想真丢掉用 `dockDiscard`。
     */
    dockClose: () => {
      dockHidden.set(true);
      note2("\u5DF2\u6536\u8D77\u7ED3\u679C\u6846 \u2014\u2014 \u7ED3\u679C\u7559\u7740\uFF0C\u70B9\u300C\u4F18\u5316\u63D0\u793A\u8BCD\u300D\u90A3\u4E00\u534A\u5C31\u80FD\u518D\u770B\u5230");
    },
    /** 丢弃结果框（真的清掉，磁盘那份也删）。 */
    dockDiscard: () => {
      dock.set(dockReducer(dock.getSnapshot(), { type: "clear" }));
      dockHidden.set(false);
      note2("\u5DF2\u4E22\u5F03\u8FD9\u4EFD\u7ED3\u679C");
    },
    /** 展开结果框（收起状态的对面）。 */
    dockShow: () => {
      dockHidden.set(false);
    },
    /** 用户在框里手改了成品。 */
    dockEdit: (text) => {
      dock.set(dockReducer(dock.getSnapshot(), { type: "edit", text }));
    },
    setTier: (tier) => {
      setField(OPTIMIZER_TIER_FIELD, tier);
    },
    /**
     * 设置某条的插入模式（关 / 每次 / 仅首次）。
     *
     * 界面上只有这一个入口：两个互斥标志由 `withInsertMode` **一次写对**，
     * 不给「又每次又仅首次」留缝。
     */
    setInsertMode: (promptId, mode) => {
      commitBook(withInsertMode(book.getSnapshot(), promptId, mode));
    }
  };
  slots.inject("shell.overlay", () => slots.register({
    name: "shell.overlay",
    id: "composer-ux-restart-titlebar",
    order: 12,
    label: "\u91CD\u542F"
  }, RestartTitlebarButton));
  maybeShowRestartDone();
  slots.inject("settings.section", () => slots.register({
    name: "settings.section",
    id: "composer-ux",
    order: 40,
    label: "\u8F93\u5165\u4F53\u9A8C",
    inject: () => ({
      hooks: { live, book, bookStatus, writeNotice },
      actions: {
        setField,
        clearField,
        resetAll,
        saveBook: bookActions.saveBook,
        reloadBook: bookActions.reload,
        resetBook: bookActions.resetBook,
        dismissNotice: () => {
          writeNotice.set("");
        },
        clearDockState: () => {
          clearPersistedDock();
          dock.set(null);
          dockHidden.set(false);
        }
      }
    })
  }, SettingsSection));
  slots.inject("shell.overlay", () => slots.register({
    name: "shell.overlay",
    id: "composer-ux-panel-resize",
    inject: () => ({ hooks: { live }, actions: { setField } })
  }, PanelResizeHandles));
  void loadNavFold();
  slots.inject("shell.overlay", () => slots.register({
    name: "shell.overlay",
    id: "composer-ux-nav-fold"
  }, NavFoldHost));
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
      hooks: { live, panel, busy: optimizing, startedAt: optimizeStartedAt, notice: panelNotice, book, bookStatus, dock, dockHidden },
      actions: {
        toggle: quickActions.toggle,
        close: quickActions.close,
        insert: quickActions.insert,
        optimize: quickActions.optimize,
        dockInsert: quickActions.dockInsert,
        dockRetry: quickActions.dockRetry,
        dockCancel: quickActions.dockCancel,
        dockClose: quickActions.dockClose,
        dockDiscard: quickActions.dockDiscard,
        dockShow: quickActions.dockShow,
        // 0.14.0「优化选项」卡片：面板直接写设置字段（与设置页同一个写入路径）。
        setField,
        dockEdit: quickActions.dockEdit,
        setTier: quickActions.setTier,
        setInsertMode: quickActions.setInsertMode,
        addCategory: bookActions.addCategory,
        renameCategory: bookActions.renameCategory,
        removeCategory: bookActions.removeCategory,
        moveCategory: bookActions.moveCategory,
        addPrompt: bookActions.addPrompt,
        movePrompt: bookActions.movePromptToCategory,
        reloadBook: bookActions.reload
      }
    })
  }, QuickCommandsPanel));
  slots.inject("conversation.composer.dock", () => slots.register({
    name: "conversation.composer.dock",
    id: "composer-ux-stats-line",
    order: 99,
    label: "\u7EDF\u8BA1\u884C",
    inject: () => ({ hooks: { live } })
  }, StatsLineEntry));
  slots.inject("conversation.composer.dock", () => slots.register({
    name: "conversation.composer.dock",
    id: "composer-ux-cost",
    order: 100,
    label: "\u91D1\u989D",
    inject: () => ({ hooks: { live } })
  }, CostChipEntry));
  ctx.effect(() => installSettingsCardStyle(), "composer-ux: settings card style");
  ctx.effect(() => installQuickButtonStyle(), "composer-ux: quick button style");
  ctx.effect(() => installPanelResizeStyle(), "composer-ux: panel resize style");
  ctx.effect(() => {
    let dispose = null;
    const syncInterceptors = () => {
      const sections = activeSections(live.getSnapshot());
      const wanted = sections.keys || sections.quick;
      if (wanted && dispose === null) {
        dispose = installInterceptors({
          settings: () => live.getSnapshot(),
          // 「仅首次」由这里决定是否算进这一批：会话还是空的（blank）才带上。
          // 「快捷指令」栏关掉时这里直接给空批次 —— 这是唯一一处"关掉就不附加"的闸，
          // 键位发送与官方按钮两条路都从这里取批次，不需要各写一遍。
          promptsForSend: () => activeSections(live.getSnapshot()).quick ? appendBatchForSend(book.getSnapshot(), currentBlankSession()) : []
        });
      } else if (!wanted) {
        dispose?.();
        dispose = null;
      }
      if (!sections.quick) panel.set(null);
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
