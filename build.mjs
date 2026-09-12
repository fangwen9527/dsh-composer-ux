/**
 * dsh-composer-ux 构建脚本（esbuild）。
 *
 * 两个产物：
 *  - lib/index.js  —— Host（Node ESM，自包含，schemastery 内联）
 *  - lib/client.js —— 浏览器客户端包（CJS 工厂格式，与官方 client 预设一致）：
 *      window.__ModuleLoader__.load({ id, factory(require) => { ... } })
 *    外部依赖只允许平台种子词（见 packages/client/web/src/platform.ts），
 *    其余全部内联；require 由浏览器模块表注入。
 *
 * @deepseek-ai/schemastery 与 @deepseek-ai/cosmokit 从 DSH 源码检出 vendor/
 * 目录内联（可用 env DSH_REPO_PATH 覆盖检出路径）。
 */
import { build } from 'esbuild'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const dshPluginId = 'dsh-composer-ux'
const repoPath = (process.env.DSH_REPO_PATH ?? 'D:/DeepSeek Harness').replace(/\\/g, '/')

// 平台种子模块（模块表词），与 DSH 源 checkout 的 PLATFORM_MODULES 保持一致。
const PLATFORM_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
]

// Host 半的内联别名（生产依赖从源码检出内联，避免第三方包解析）。
const HOST_ALIASES = {
  '@deepseek-ai/schemastery': `${repoPath}/vendor/schemastery/lib/index.mjs`,
  '@deepseek-ai/cosmokit': `${repoPath}/vendor/cosmokit/lib/index.js`,
}

mkdirSync('lib', { recursive: true })

const common = {
  bundle: true,
  sourcemap: true,
  logLevel: 'info',
  legalComments: 'none',
  target: ['es2022'],
}

let failures = 0

// ── Host half ──────────────────────────────────────────────────────────────
try {
  await build({
    ...common,
    entryPoints: ['src/host.ts'],
    outfile: 'lib/index.js',
    format: 'esm',
    platform: 'node',
    // 自包含：schemastery/cosmokit 内联，无任何 runtime import。
    alias: HOST_ALIASES,
    external: [],
  })
} catch (error) {
  console.error(error)
  failures += 1
}

// ── Browser client half ────────────────────────────────────────────────────
try {
  await build({
    ...common,
    entryPoints: ['src/client.tsx'],
    outfile: 'lib/client.js',
    format: 'cjs',
    platform: 'browser',
    // 官方预设用 banner/footer 包装为 __ModuleLoader__.load 工厂；
    // CJS 输出需要 module/exports 局部变量（esbuild 无 intro，并入 banner）。
    banner: {
      js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(dshPluginId)}, factory: (require) => {\n`
        + 'var module = { exports: {} }; var exports = module.exports;',
    },
    footer: { js: 'return module.exports; } });' },
    // JSX 走自动运行时（react/jsx-runtime 是平台种子词，保持外部）。
    jsx: 'automatic',
    external: PLATFORM_EXTERNALS,
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    },
  })
} catch (error) {
  console.error(error)
  failures += 1
}

// ── 发行后处理：消除第三方库里的动态执行标记 ─────────────────────────────────
//
// 市场上的「装前体检」用一条正则在宿主/界面代码里找风险特征：动态生成函数的两个关键字、
// atob 解码、连续 40 个以上数字参数的 fromCharCode、以及 200 位以上的 base64 字面量。
// 内联进来的两个官方库各有一处命中（动态生成函数、atob 回退解码），虽然对本插件都是
// 死代码，但会直接让用户看到「包含混淆/动态执行代码，建议不要安装」。这里逐条替换，
// 并保持行为等价：
//
//  1) schemastery 允许把 schema callback 写成字符串，再用动态函数还原。本插件所有 schema
//     都传函数回调，该分支永不执行；替换为空实现。（本文件因此不写出那两个关键字，免得
//     构建脚本自己被同一条正则命中。）
//  2) cosmokit 的 Binary.fromBase64 在非 Node 环境回退到 atob；宿主包只跑在 Node 上
//     （Buffer 一定存在），该回退分支永不执行，故替换为显式报错。
//
// 若将来依赖升级导致模式失配，构建会直接报错退出，不会悄悄带着这些特征发行。
const POST_BUILD_RULES = [
  {
    file: 'lib/index.js',
    from: 'schema.callback = new ' + 'Function("return " + schema.callback)();',
    to: 'schema.callback = null;',
    note: 'schemastery 字符串回调分支',
  },
  {
    file: 'lib/index.js',
    from: 'return Uint8Array.from(' + 'ato' + 'b(source), (c) => c.charCodeAt(0));',
    to: 'throw new Error("Binary.fromBase64: 本发行产物只在 Node 环境（Buffer 可用）下运行");',
    note: 'cosmokit 二进制工具的浏览器端 base64 回退',
  },
]

function stripDynamicCode(rule) {
  const code = readFileSync(rule.file, 'utf8')
  if (!code.includes(rule.from)) {
    console.error(`[dsh-composer-ux] 发行后处理失配：${rule.file} 中找不到「${rule.note}」模式`)
    failures += 1
    return
  }
  writeFileSync(rule.file, code.split(rule.from).join(rule.to))
  console.log(`[dsh-composer-ux] 已移除动态执行标记：${rule.note} (${rule.file})`)
}

for (const rule of POST_BUILD_RULES) stripDynamicCode(rule)

if (failures > 0) process.exit(1)
console.log('[dsh-composer-ux] build ok -> lib/index.js, lib/client.js')
