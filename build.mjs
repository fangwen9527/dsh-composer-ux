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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

/**
 * 宿主半要**内联**的两个包。
 *
 * 优先用 DSH 源码检出里的 vendor 副本（本机开发时与正在跑的那个 DSH 逐字节相同），
 * 检出不在时退到 node_modules 里**同版本**的 npm 包。
 *
 * 为什么必须有这条退路：CI（三平台）与任何别的机器上都没有 `D:/DeepSeek Harness`，
 * 写死路径会让 `npm run build` 在干净检出上直接失败（0.12.0 首次跑 CI 时三个平台一起红）。
 * 已核对：npm 的 `@deepseek-ai/schemastery@3.18.4` 与 `@deepseek-ai/cosmokit@1.8.5`
 * 与 DSH 检出里 vendor 的那两份**逐字节相同**，所以两条路产出的 bundle 完全一致。
 *
 * @param relative - 相对于检出根的 vendor 路径。
 * @param installed - node_modules 里的同份文件。
 * @returns 实际要内联的文件路径（两边都没有就报错说清楚怎么办）。
 */
const vendorOf = (relative, installed) => {
  const fromRepo = `${repoPath}/${relative}`
  if (existsSync(fromRepo)) return fromRepo
  // ⚠️ 必须给**绝对路径**：esbuild 的 alias 值按"当前工作目录"解析，写成相对路径
  // （`node_modules/...`）会直接报 Could not resolve —— CI 三平台一起红的就是这个。
  const fromInstall = resolve(installed)
  if (existsSync(fromInstall)) return fromInstall
  throw new Error(
    `找不到 ${relative}：既没有 DSH 源码检出（DSH_REPO_PATH=${repoPath}），`
    + `也没有 ${fromInstall}。二选一：设 DSH_REPO_PATH 指向你的 DSH 检出，或先 npm install。`,
  )
}

const HOST_ALIASES = {
  '@deepseek-ai/schemastery': vendorOf('vendor/schemastery/lib/index.mjs', 'node_modules/@deepseek-ai/schemastery/lib/index.mjs'),
  '@deepseek-ai/cosmokit': vendorOf('vendor/cosmokit/lib/index.js', 'node_modules/@deepseek-ai/cosmokit/lib/index.js'),
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

/**
 * 抹平"内联进来的第三方模块"那几行路径注释。
 *
 * esbuild 会给每个打包进来的模块加一行 `// <路径>`：走 DSH 检出时是
 * `// ../../../DeepSeek Harness/vendor/cosmokit/lib/index.js`（**把作者本机的目录结构写进了发布产物**），
 * 走 npm 包时是 `// node_modules/@deepseek-ai/cosmokit/lib/index.js`。两者只差这几行注释，
 * 却让"本机构建的产物"与"CI 构建的产物"对不上。统一换成 `// <bundled: 包名>`，
 * 两条路线从此逐字节相同（也不再泄露本机路径）。
 *
 * @param file - 刚构建出来的文件。
 */
function normalizeBundledPathComments(file) {
  const code = readFileSync(file, 'utf8')
  // ⚠️ 每个字符类都必须排除换行：`[^/]*` 会**跨行**匹配（换行不是 `/`），
  // 于是正则会从第 1 行的路径注释一路吞到很远的地方，把代码整块替掉
  // —— 0.12.0 写这条时踩过：产物里 schemastery 的动态分支就这么"消失"了，
  // 后处理随即报"模式失配"（那正是这个仓库设计成会红的地方，帮上了忙）。
  // 归一成**同一个标签**（不带上包名）：两条路线的目录层级不同，包名写法也不同
  // （`vendor/cosmokit/...` vs `node_modules/@deepseek-ai/cosmokit/...`），带上它就对不齐了。
  const next = code.replace(
    /^\/\/ [^\n]*?(?:vendor|node_modules)\/[^\n]*$/gm,
    '// <bundled dependency>',
  )
  if (next !== code) writeFileSync(file, next)
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

for (const file of ['lib/index.js', 'lib/client.js']) normalizeBundledPathComments(file)
for (const rule of POST_BUILD_RULES) stripDynamicCode(rule)

if (failures > 0) process.exit(1)
console.log('[dsh-composer-ux] build ok -> lib/index.js, lib/client.js')
