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
import { mkdirSync } from 'node:fs'

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

if (failures > 0) process.exit(1)
console.log('[dsh-composer-ux] build ok -> lib/index.js, lib/client.js')
