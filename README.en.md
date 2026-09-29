# dsh-composer-ux

> **English README.** The Chinese original is [`README.md`](README.md) (far more detailed); a plain-language
> Chinese quick start is [`README.simple.md`](README.simple.md).

A **DeepSeek Harness Web** plugin that upgrades the composer (the chat input) experience. Everything is
opt-in through two layers of switches, and nothing here touches your conversations unless you turn it on.

**What it adds**

1. **Configurable send / newline keys** — presets or press-any-combo recording.
2. **A native-style right-click menu** — 7 items, with three modes (official / browser / custom).
3. **Quick-command panel** — a prompt library with categories, per-item insert mode (off · every send · first
   send of a session), and a **prompt optimizer**.
4. **Prompt optimizer** — sends your draft to a *separate* model call that returns itemized edits, each one
   backed by a **verbatim quote from your own words**; the host verifies every quote literally and drops any
   item it cannot trace. Results land in a **result box** (0.12.0): items stream in one by one as they pass
   verification, the finished prompt is **editable**, and an explicit **“Insert into input”** button decides
   when — and whether — it replaces what you typed.
5. **`x-opencode-session` header injection** so OpenCode (Go) routes work inside DSH.
6. **Default terminal switch (Windows)** — replaces the model's PowerShell tool with **Git Bash**.
7. **Official persistent terminal tools** (`terminal_open/read/send/signal/close/list`).
8. **Stats line upgrade** — renders DSH's built-in cache-hit percentage with **three decimals**.
9. **Cost capsule** — per-session cost from DeepSeek's list price, with per-model peak/off-peak prices you can
   override, **Chinese public holidays fetched automatically**, an account-balance reader, and one-click price
   sync (official page + models.dev).
10. **One-click “restart DSH”** in the settings-card header.

Install with `dsh plugin --profile <name> add dsh-composer-ux`, then **restart DSH** (a page refresh is not
enough for host-side changes). The built `lib/` ships in the package **and** in this repository, so there is
**no build step and no build authorization** at install time.

## Install

```sh
# npm (recommended)
dsh plugin --profile <your-profile> add dsh-composer-ux

# a specific version
dsh plugin --profile <your-profile> add dsh-composer-ux@0.12.0

# from GitHub (identical code; `lib/` is committed, so no prepare script / build approval is needed)
dsh plugin --profile <your-profile> add github:fangwen9527/dsh-composer-ux

# pinned commit (recommended if you want the exact revision you reviewed)
dsh plugin --profile <your-profile> add github:fangwen9527/dsh-composer-ux#<sha>
```

Then restart `dsh web` (or use the plugin's own **Restart DSH** button once it is running).

## Features

### Two layers of switches

The settings page has a **master switch** (default: on) plus one switch per card for the first seven cards.
A section is active only when *both* are on (`enabled && sectionSwitch`). The first six cards default to
**off**; the **stats line** card defaults to on (it is the only exception); the **cost** card has no card-level
switch because the capsule is always visible.

The same build supports **DSH 0.1.6 and 0.1.7** — the settings service changed shape between those releases
(`settingsScope.bind` → `configForms.get`, host-side `settings.register` removed, new event names), so the code
branches on **capability detection** instead of shipping two builds.

> ⚠️ Back up `~/.dsh/settings.yaml` before upgrading DSH to 0.1.7: the official upgrade renames it to
> `settings.yaml.imported` and imports it section by section (one-shot, irreversible).

Section defaults are not hard-coded `false`: they migrate from "is there a trace in the settings document that
you were using this?" — sections you touched stay on, untouched ones start off, and a brand-new install starts
with all six off.

### Prompt optimizer (the interesting part)

The optimizer is a **separate model call** routed through the host (`ctx.llm`), so nothing leaves your machine
except what goes to the model route you already configured. Its contract:

- The model may only emit **items** (`rewrite` / `requirement` / `quality` / `unknown` / `plan` / `risk`).
- Every `rewrite` / `requirement` / `quality` item must carry a **quote that exists verbatim in your draft**.
  The host compares character by character (with a whitespace-normalising fallback) and **drops only the
  offending item** — never the whole round.
- Items that cannot be traced are **not silently invented**: `unknown`/`plan`/`risk` may go without a quote,
  but they are labelled as model-supplied, and the finished text shows each item's evidence.
- If the model ignores the JSON envelope entirely, the raw text is passed through **and labelled** as
  unverified; if it looks like an envelope but is truncated, the round **fails** rather than writing broken
  JSON into your input box.

Three intensity tiers differ in **evidence budget** (basic = language-level fixes only; advanced = may add
requirements traceable to your words; extreme = adds a staged plan and contingencies). Each tier's prompt can be
edited in settings; the JSON output contract is always appended and cannot be overridden.

**0.12.0 result box**

- Your draft **stays in the input box** while the optimizer runs — edit it freely.
- Items appear one by one as the host verifies them; the box never shows unverified content.
- The finished prompt is editable; **Insert into input** replaces the draft (`Ctrl+Z` restores it) and puts a
  leading slash command (`/goal …`) back in place.
- If you changed the input box while the round was running, the first click only warns; the second click
  overwrites.
- `Esc` while running **cancels and keeps what was generated**; the assembled prompt only exists once the
  whole output has been assembled, and the box says so instead of pretending.
- **Re-optimize** re-runs the *same source* (not whatever is in the input box now — by then you may have
  inserted the result).
- **Session context** (on by default): the host reads the recent turns of the current session (up to 4 of your
  messages and 4 replies, ~1600 characters) so that "change that one too" has a referent. The context is used
  for disambiguation only, is explicitly **not** a source of quotes, and can be switched off.
- **Memory chain**: when you edit the previous result and optimize again, the previous version is passed along
  so the model adjusts rather than rewriting from scratch. Same-draft retries and re-running an unmodified
  result do not carry it.

### Cost capsule and money settings

- Per-session cost from DeepSeek's list price; click the capsule for a breakdown.
- **Peak / off-peak prices per model** (empty field = official list price; you can add arbitrary model names).
- Peak/off-peak is decided by **each usage event's own timestamp**, not by when you look at the panel, and the
  price era is resolved the same way — so historical sessions keep the price they actually ran at.
- **Chinese public holidays are fetched automatically** (State Council schedule via `holiday-cn`, GitHub raw
  with a jsDelivr mirror, built-in table as offline fallback). Manual dates always win; "not published yet" is
  reported as such rather than as a failure. Settlement days (调休) are still off-peak — the official wording is
  "Saturdays and Sundays are off-peak all day".
- Third-party (non-DeepSeek) models get their prices from a models.dev snapshot with a one-click sync.

### Everything else

- **Context menu**: three modes — official (do not interfere), browser default, or the plugin's own menu with
  seven items; clipboard read permission is explained in the card.
- **Quick commands**: categories, cross-category moves, per-item insert mode, and a JSON file you can back up
  or edit by hand (`$DSH_HOME/quick-prompts.json`, atomic writes with a lock file; a corrupt file is quarantined
  rather than silently replaced by an empty list).
- **OpenCode header**: writes `providers.<route>.headers` in the `llm-pi-ai` profile — the only supported
  outbound-header entry point in DSH — so it takes effect on the next request without a restart.
- **Default terminal (Windows)**: git-anchored discovery, WSL excluded, per-session tool-surface trim, with the
  official sandbox/approval/timeout semantics preserved.
- **Restart DSH**: two-step confirmation, detached helper process, waits for the port to be released, hidden
  console relaunch, same-origin fence.

## Privacy and trust

- No API keys are read, stored, or logged by this plugin; model calls go through DSH's own `ctx.llm` routing.
- Your draft and (if enabled) the session context are sent **only** to the model route you configured.
- Every HTTP route the plugin registers goes through DSH's official trust gate
  (`connection.requestRejection` — Host/Origin fence and browser token) **before** the request body is read.
- Settings are stored in DSH's own settings document; quick prompts live in `$DSH_HOME/quick-prompts.json`.

## Development

```sh
npm ci             # install from the lockfile
npm run typecheck  # tsc --noEmit (type surface for @deepseek-ai/* lives in types/dsh-externals.d.ts)
node build.mjs     # emit lib/index.js + lib/client.js
npm test           # 18 suites
node test/mutation-guards.mjs   # mutation testing (each guard must fail when its rule is removed)
```

CI runs on **ubuntu / windows / macos × node 20**: `npm ci` → `typecheck` → `build` → `npm test`
(the tests exercise the **built artifacts**, so the build runs first on purpose).

Building the host bundle inlines `@deepseek-ai/schemastery` and `@deepseek-ai/cosmokit`: it prefers the copies
vendored in a DSH source checkout (`DSH_REPO_PATH`) and otherwise falls back to the identical npm packages, so
a clean clone builds without a DSH checkout.

## Credits and license

MIT. Prompt-optimizer mechanics were adapted from the community plugins
[WestFox-AwA/dsh-prompt-optimizer](https://github.com/WestFox-AwA/dsh-prompt-optimizer) (BSD-3-Clause,
item/provenance design) and cross-checked against
[Y1X1n/dsh-prompt-optimizer](https://github.com/Y1X1n/dsh-prompt-optimizer) (streaming UX); pricing rules and
model aliases were cross-checked against `dsh-plugin-usage-meter` and `dsh-cost-meter`; holiday data comes from
[`NateScarlet/holiday-cn`](https://github.com/NateScarlet/holiday-cn) (MIT). See `README.md` for the full
provenance notes.
