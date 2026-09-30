/**
 * 官方持久终端「三件套」挂载层的测试。
 *
 * 这一层**不是源码**，是 `cordis.patch.yml` 里的三行插入（服务 + PTY 后端 + 模型工具）
 * 加三条 `!!js` 表达式。它有四种只在真机上炸的失败模式，源码测试一个都挡不住：
 *
 *   1. **缺行 ⇒ 静默 pending**（2026-09-28 真机踩到）：`@deepseek-ai/dsh-tool-terminal`
 *      声明 `inject = ["terminals", "tools", "systemPrompt"]`，而提供 `terminals` 的
 *      `@deepseek-ai/dsh-terminal` 在 standard 预设与 profile 层都不存在 ⇒ 工具行永远
 *      挂着等依赖，**一个工具都不注册、也不报错**。所以三行必须齐全。
 *   2. **守卫基准找错 ⇒ 工具行被自己的守卫禁掉**（同一天第二次踩到，实测）：
 *      守卫原本拿 `ctx.get('profileContext')?.dir` 当基准，开机时拿不到 ⇒ 返回「装不上」
 *      ⇒ `plugin_manager list_plugins` 里这一行是 `enabled:false, fiberPhase:null`，
 *      而同层前两行是 `active`。失败方向安全（不白屏），但功能静默消失。所以必须有
 *      「基准发现」这一组用例。
 *   3. **守卫写错 ⇒ 白屏或功能静默消失**：DSH 的兼容性预检只处理 peer 版本冲突
 *      （`compatibility-preflight.ts:63-66`），「包装不上」它不管 ⇒ Loader 导入失败 ⇒
 *      整棵树挂；而守卫表达式抛错又算「条目失败」而不是「被禁用」（`app-boot/src/index.ts:914`）。
 *   4. **守卫加错地方 ⇒ 又把功能禁掉**：服务与后端来自**共享层 / 安装目录**，profile 目录的
 *      `createRequire` 未必解析得到它们，给它们加自检守卫 = 可能永远禁用。
 *
 * 所以这里除了结构断言，还用加载器**同一个求值器**
 * （`new Function('ctx','expr','with (ctx) { return eval(expr) }')`，见
 * @deepseek-ai/cordis-plugin-loader 的 interpolate）**真跑**这三条表达式，喂各种环境。
 *
 *   node test/terminal-mount.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'
import { posix } from 'node:path'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'

let failures = 0
let passes = 0

function check(label, condition, detail) {
  if (condition) {
    passes += 1
    console.log(`  ✓ ${label}`)
    return
  }
  failures += 1
  console.log(`  ✗ ${label}${detail === undefined ? '' : ` — ${detail}`}`)
}

const SVC = '@deepseek-ai/dsh-terminal'
const BACKEND = '@deepseek-ai/dsh-terminal-bash'
const TOOL = '@deepseek-ai/dsh-tool-terminal'
const patch = readFileSync('cordis.patch.yml', 'utf8').replace(/\r\n/g, '\n')
const manifest = JSON.parse(readFileSync('package.json', 'utf8').replace(/\r\n/g, '\n'))

// ── 结构：抠出三行与三条表达式 ───────────────────────────────────────────────
/** 转义包名里的正则元字符。 */
const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** 锚行首的「`name: '<pkg>'`」匹配器。**必须锚行首**：注释掉的
 *  `# name: '@deepseek-ai/dsh-terminal'` 依然包含这个子串，不锚行首的话
 *  「服务行被注释掉」这种变异就咬不住（变异测试逮到过）。 */
const nameRe = (pkg, flags = 'm') => new RegExp(`^[ \\t]*name:[ \\t]*'${escapeRe(pkg)}'`, flags)

/** 取某个包名所在的那一条 insert 行（从它的 `- id:` 到下一个同级 `- id:`）。 */
function rowOf(text, pkg) {
  const match = nameRe(pkg).exec(text)
  if (match === null) return null
  const at = match.index
  const start = text.lastIndexOf('- id:', at)
  const next = text.indexOf('\n    - id:', at)
  return text.slice(start === -1 ? at : start, next === -1 ? text.length : next)
}

const svcRow = rowOf(patch, SVC)
const backendRow = rowOf(patch, BACKEND)
const toolRow = rowOf(patch, TOOL)
/** 全文按出现顺序取 `key: !!js "…"`。**必须锚行首**（同上：注释掉的行会骗过子串匹配）。 */
const exprs = [...patch.matchAll(/^[ \t]*(shellDialect|shellPath|disabled):[ \t]*!!js[ \t]*"((?:[^"\\]|\\.)*)"/gm)]
  .map((m) => ({ key: m[1], expr: m[2] }))
const exprOf = (key) => exprs.find((e) => e.key === key)?.expr ?? ''

const countOf = (pkg) => [...patch.matchAll(nameRe(pkg, 'gm'))].length

check('三行齐全：服务 + PTY 后端 + 模型工具各恰好一条',
  countOf(SVC) === 1 && countOf(BACKEND) === 1 && countOf(TOOL) === 1,
  `dsh-terminal=${countOf(SVC)} terminal-bash=${countOf(BACKEND)} tool-terminal=${countOf(TOOL)}`)

check('三行都在同一个 insert 列表里（同一层，缺一层就静默 pending）',
  svcRow !== null && backendRow !== null && toolRow !== null
  && patch.indexOf(svcRow) > patch.indexOf('- insert:')
  && patch.indexOf(backendRow) > patch.indexOf('- insert:')
  && patch.indexOf(toolRow) > patch.indexOf('- insert:'))

check('服务行不带 !!js 守卫（它来自共享层，profile 目录解析不到，加了可能永远禁用）',
  svcRow !== null && !/disabled:/.test(svcRow), svcRow === null ? '没找到行' : svcRow.slice(0, 60))

check('后端行不带 !!js 守卫（同上）',
  backendRow !== null && !/disabled:/.test(backendRow))

check('全文只有工具行那一处 disabled（守卫不能在别处冒出来）',
  exprs.filter((e) => e.key === 'disabled').length === 1
  && toolRow !== null && /^[ \t]*disabled:[ \t]*!!js/m.test(toolRow),
  `disabled 出现 ${exprs.filter((e) => e.key === 'disabled').length} 处`)

check('工具行的守卫 resolve 的包名与行里的包名逐字一致',
  exprOf('disabled').includes(`resolve('${TOOL}')`),
  exprOf('disabled').slice(0, 80))

check('工具行不带 group: true（会迫使加载器初始化 disabled 行，自检当场失效）',
  toolRow !== null && !/^\s*group:\s*true\s*$/m.test(toolRow))
check('后端行也不带 group: true',
  backendRow !== null && !/^\s*group:\s*true\s*$/m.test(backendRow))

check('后端行声明 backendType=shell 与 timeoutMs（对齐官方 minimal 预设）',
  backendRow !== null && /backendType:\s*shell/.test(backendRow) && /timeoutMs:\s*\d+/.test(backendRow))

check('后端行的 shellDialect / shellPath 都是 !!js（不能写死 /bin/bash）',
  exprs.some((e) => e.key === 'shellDialect') && exprs.some((e) => e.key === 'shellPath'))

check('注释里留了「必须同层 / 会静默 pending / inject」这条教训（防后来人删掉服务行）',
  /pending/.test(patch) && /inject/.test(patch) && /terminals/.test(patch))

check('守卫的基准不依赖 DSH 内部上下文（要认 DSH_HOME / os.homedir() + profiles 扫描）',
  exprOf('disabled').includes('DSH_HOME') && exprOf('disabled').includes('homedir')
  && exprOf('disabled').includes(`'profiles'`))

// ── 用加载器同一个求值器真跑这三条表达式 ─────────────────────────────────────
// 逐字照抄 @deepseek-ai/cordis-plugin-loader 的 evaluate()：
// `with (ctx)` 让裸标识符先解析到 ctx 属性，所以测试能把 process 也换掉。
const evaluate = new Function('ctx', 'expr', 'with (ctx) { return eval(expr) }')

/** 抛错也如实返回，方便断言「不冒泡」。 */
function safeRun(expr, env) {
  const ctx = {
    ...(env.process === undefined ? {} : { process: env.process }),
    get: env.get ?? (() => undefined),
  }
  try {
    return { ok: true, value: evaluate(ctx, expr) }
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error) }
  }
}

/** 假 path：用 posix 语义归一化，让 `..` 真的能走上去（断言就能咬住具体路径）。
 *  探测里还用 `basename` / `dirname` 识别 WSL 启动器，所以也要提供。 */
const fakePath = {
  delimiter: ';',
  join: (...parts) => posix.normalize(parts.map((x) => x.replace(/\\/g, '/')).join('/')),
  basename: (x) => posix.basename(x.replace(/\\/g, '/')),
  dirname: (x) => posix.dirname(x.replace(/\\/g, '/')),
}

// ── 两条探测（shellPath / shellDialect）─────────────────────────────────────
/**
 * 造一个探测环境。
 * @param platform - `process.platform`。
 * @param path - `PATH`（原始 Windows 写法）。
 * @param exists - 「存在的文件」集合；`fs.existsSync` 只认它们。
 * @param fsThrows - true 时 `existsSync` 抛错。
 */
function probeEnv({ platform = 'win32', path = 'D:\\Git\\cmd', exists = [], fsThrows = false } = {}) {
  const set = new Set(exists)
  const fs = { existsSync: (x) => { if (fsThrows) throw new Error('EACCES'); return set.has(x) } }
  return {
    process: {
      platform,
      env: { PATH: path, LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local' },
      getBuiltinModule: (spec) => (spec === 'node:fs' ? fs : fakePath),
    },
  }
}

const bashPath = exprOf('shellPath')
const dialect = exprOf('shellDialect')

const withBash = {
  path: safeRun(bashPath, probeEnv({ exists: ['D:/Git/bin/bash.exe'] })),
  dialect: safeRun(dialect, probeEnv({ exists: ['D:/Git/bin/bash.exe'] })),
}
check('探测：PATH 上那份 Git（`…\\Git\\cmd`）能推出 `…/Git/bin/bash.exe`',
  withBash.path.ok === true && withBash.path.value === 'D:/Git/bin/bash.exe',
  withBash.path.ok ? String(withBash.path.value) : withBash.path.error)
check('探测：有 bash 时 shellDialect=bash',
  withBash.dialect.ok === true && withBash.dialect.value === 'bash',
  withBash.dialect.ok ? String(withBash.dialect.value) : withBash.dialect.error)

const noBash = { path: safeRun(bashPath, probeEnv({ exists: [] })), dialect: safeRun(dialect, probeEnv({ exists: [] })) }
check('探测：找不到 bash 时 shellPath 留空（让官方用方言默认值）',
  noBash.path.ok === true && noBash.path.value === '',
  noBash.path.ok ? String(noBash.path.value) : noBash.path.error)
check('探测：找不到 bash 时回落官方 pwsh 方言',
  noBash.dialect.ok === true && noBash.dialect.value === 'pwsh',
  noBash.dialect.ok ? String(noBash.dialect.value) : noBash.dialect.error)

const onPosix = {
  path: safeRun(bashPath, probeEnv({ platform: 'linux' })),
  dialect: safeRun(dialect, probeEnv({ platform: 'linux' })),
}
check('探测：非 Windows 时 shellPath 留空（官方默认 /bin/bash）',
  onPosix.path.ok === true && onPosix.path.value === '')
check('探测：非 Windows 时 shellDialect=bash',
  onPosix.dialect.ok === true && onPosix.dialect.value === 'bash')

const throwing = {
  path: safeRun(bashPath, probeEnv({ fsThrows: true })),
  dialect: safeRun(dialect, probeEnv({ fsThrows: true })),
}
check('探测：fs 抛错时不冒泡（shellPath 空、方言回落 pwsh）',
  throwing.path.ok === true && throwing.path.value === ''
  && throwing.dialect.ok === true && throwing.dialect.value === 'pwsh',
  `${JSON.stringify(throwing.path)} / ${JSON.stringify(throwing.dialect)}`)

// WSL 必须被排除：`…\Windows\System32\bash.exe` 与 `…\Microsoft\WindowsApps\bash.exe`
// 会把 `D:\x` 解释成 `/mnt/d/x`，与模型手里的 Windows 路径/工作目录全不兼容。
// 插件自己那条 bash 工具也硬排除它；真机上就是因为漏了这条，PTY 起成了 WSL bash。
const wslOnly = {
  path: safeRun(bashPath, probeEnv({ path: 'C:\\Windows\\System32', exists: ['C:/Windows/System32/bash.exe'] })),
  dialect: safeRun(dialect, probeEnv({ path: 'C:\\Windows\\System32', exists: ['C:/Windows/System32/bash.exe'] })),
}
check('探测：只有 WSL 的 System32\\bash.exe 时算「没找到 bash」（不能拿它当 bash 用）',
  wslOnly.path.ok === true && wslOnly.path.value === ''
  && wslOnly.dialect.ok === true && wslOnly.dialect.value === 'pwsh',
  `${JSON.stringify(wslOnly.path.value)} / ${wslOnly.dialect.value}`)

const wslWindowsApps = safeRun(bashPath, probeEnv({
  path: 'C:\\Users\\u\\AppData\\Local\\Microsoft\\WindowsApps',
  exists: ['C:/Users/u/AppData/Local/Microsoft/WindowsApps/bash.exe'],
}))
check('探测：WindowsApps 里的 bash.exe（也是 WSL 启动器）同样被排除',
  wslWindowsApps.ok === true && wslWindowsApps.value === '',
  String(wslWindowsApps.value))

const wslAndGit = {
  path: safeRun(bashPath, probeEnv({
    path: 'C:\\Windows\\System32;D:\\Git\\cmd',
    exists: ['C:/Windows/System32/bash.exe', 'D:/Git/bin/bash.exe'],
  })),
  dialect: safeRun(dialect, probeEnv({
    path: 'C:\\Windows\\System32;D:\\Git\\cmd',
    exists: ['C:/Windows/System32/bash.exe', 'D:/Git/bin/bash.exe'],
  })),
}
check('探测：PATH 里 WSL 排在 Git 前面时，仍然跳过 WSL 选中 Git Bash',
  wslAndGit.path.ok === true && wslAndGit.path.value === 'D:/Git/bin/bash.exe'
  && wslAndGit.dialect.ok === true && wslAndGit.dialect.value === 'bash',
  `${JSON.stringify(wslAndGit.path.value)} / ${wslAndGit.dialect.value}`)

check('探测：两条表达式始终自洽（Windows 上 path 非空 ⇔ dialect=bash；非 Windows 一律空 + bash）',
  [[withBash], [noBash], [throwing]].every(
    ([pair]) => pair.path.ok && pair.dialect.ok
      && (pair.path.value !== '') === (pair.dialect.value === 'bash'))
  && onPosix.path.ok && onPosix.dialect.ok
  && onPosix.path.value === '' && onPosix.dialect.value === 'bash',
  `有 bash=${JSON.stringify(withBash.path.value)}/${withBash.dialect.value}；`
  + `无 bash=${JSON.stringify(noBash.path.value)}/${noBash.dialect.value}；`
  + `非 Windows=${JSON.stringify(onPosix.path.value)}/${onPosix.dialect.value}`)

check('探测：表达式是同步的，值都是字符串而不是 Promise（await 会让配置变成 Promise）',
  [withBash, noBash, onPosix, throwing].every(
    (pair) => typeof pair.path.value === 'string' && typeof pair.dialect.value === 'string'))
check('探测里没有 await（加载器的求值器是同步 return eval）',
  !/\bawait\b/.test(bashPath) && !/\bawait\b/.test(dialect))

// ── 守卫：基准发现（八种环境）───────────────────────────────────────────────
const guard = exprOf('disabled')

/** 某个 profile 根目录的 node_modules 基准文件。 */
const baseOf = (dir) => `${dir}/node_modules/package.json`
const HOME = 'C:/Users/u/.dsh'

/**
 * 造一个守卫环境。
 * @param presentBases - 「能解析到工具包」的 createRequire 基准文件集合；只有守卫算出来的
 *   root 命中这里才会返回 enabled。**这组用例的核心就是"有没有找对目录"**。
 * @param dirs - `readdirSync(<profiles>)` 返回的目录名；`null` 表示抛错。
 * @param homedir - `os.homedir()`；`null` 表示抛错。
 * @param homeEnv - `DSH_HOME`。
 * @param profileDir - 假 `ctx.get('profileContext').dir`。
 * @param envDir - `DSH_PROFILE_DIR`。
 * @param errorCode - 解析失败的错误码。
 * @param getThrows - `ctx.get` 抛错（复现第一版踩的坑）。
 * @param builtinThrows - `process.getBuiltinModule` 直接抛错：这时**只有**守卫最外层那道
 *   try/catch 能兜住（其它路径都各自包了自保），用来钉住「最外层必须存在」。
 */
function guardEnv({
  presentBases = [], dirs = ['desktop', 'web'], homedir: home = 'C:\\Users\\u', homeEnv,
  profileDir, envDir, errorCode = 'MODULE_NOT_FOUND', getThrows = false, builtinThrows = false,
} = {}) {
  const present = new Set(presentBases)
  const fakeModule = {
    createRequire: (baseFile) => ({
      resolve: (spec) => {
        if (present.has(baseFile) && spec === TOOL) return `/fake${baseFile}`
        const error = new Error(`Cannot find module '${spec}'`)
        error.code = errorCode
        throw error
      },
    }),
  }
  const fakeOs = { homedir: () => { if (home === null) throw new Error('no home dir'); return home } }
  const fakeFs = {
    readdirSync: () => {
      if (dirs === null) throw new Error('ENOENT')
      return dirs.map((name) => ({ name, isDirectory: () => true }))
    },
  }
  return {
    process: {
      env: { DSH_HOME: homeEnv, DSH_PROFILE_DIR: envDir },
      getBuiltinModule: (spec) => {
        if (builtinThrows) throw new Error('no builtins here')
        return spec === 'node:module' ? fakeModule
          : spec === 'node:fs' ? fakeFs
            : spec === 'node:os' ? fakeOs : fakePath
      },
    },
    get: (key) => {
      if (getThrows) throw new Error('service unavailable')
      return key === 'profileContext' ? (profileDir === undefined ? undefined : { dir: profileDir }) : undefined
    },
  }
}

const inActiveProfile = safeRun(guard, guardEnv({ presentBases: [baseOf(`${HOME}/profiles/desktop`)] }))
check('守卫：包在「当前 profile 的 node_modules」里 → disabled=false（真机就是这个情形）',
  inActiveProfile.ok === true && inActiveProfile.value === false,
  inActiveProfile.ok ? String(inActiveProfile.value) : inActiveProfile.error)

const inShared = safeRun(guard, guardEnv({ presentBases: [baseOf(`${HOME}/profiles`)] }))
check('守卫：包只在共享的 profiles/node_modules 里 → disabled=false',
  inShared.ok === true && inShared.value === false, inShared.ok ? String(inShared.value) : inShared.error)

const getThrowsCase = safeRun(guard, guardEnv({ getThrows: true, presentBases: [baseOf(`${HOME}/profiles/desktop`)] }))
check('守卫：ctx.get 抛错也不影响判定（不再依赖 profileContext —— 第一版就死在这）',
  getThrowsCase.ok === true && getThrowsCase.value === false,
  getThrowsCase.ok ? String(getThrowsCase.value) : getThrowsCase.error)

const viaEnv = safeRun(guard, guardEnv({ dirs: [], presentBases: [baseOf('/other/desk')], envDir: '/other/desk' }))
check('守卫：DSH_PROFILE_DIR 作为额外候选也能认出来',
  viaEnv.ok === true && viaEnv.value === false, viaEnv.ok ? String(viaEnv.value) : viaEnv.error)

const viaHomeEnv = safeRun(guard, guardEnv({
  homedir: null, homeEnv: 'D:/dshome', presentBases: [baseOf('D:/dshome/profiles/desktop')],
}))
check('守卫：os.homedir() 不可用时，DSH_HOME 顶上',
  viaHomeEnv.ok === true && viaHomeEnv.value === false,
  viaHomeEnv.ok ? String(viaHomeEnv.value) : viaHomeEnv.error)

const nowhere = safeRun(guard, guardEnv({ dirs: ['desktop'], presentBases: [] }))
check('守卫：哪都没有 → disabled=true（退化而不是崩）',
  nowhere.ok === true && nowhere.value === true, nowhere.ok ? String(nowhere.value) : nowhere.error)

const noRead = safeRun(guard, guardEnv({ dirs: null, presentBases: [] }))
check('守卫：readdirSync 抛错时不冒泡（退化成「找不到」）',
  noRead.ok === true && noRead.value === true, noRead.ok ? String(noRead.value) : noRead.error)

const hardError = safeRun(guard, guardEnv({ presentBases: [], errorCode: 'EACCES' }))
check('守卫：解析器抛非 MODULE_NOT_FOUND（如权限错）→ disabled=true 且不抛',
  hardError.ok === true && hardError.value === true, hardError.ok ? String(hardError.value) : hardError.error)

const builtinDown = safeRun(guard, guardEnv({ builtinThrows: true, presentBases: [baseOf(`${HOME}/profiles/desktop`)] }))
check('守卫：连 node 内建都拿不到时也不抛（退回 disabled —— 只有最外层 try/catch 能兜住）',
  builtinDown.ok === true && builtinDown.value === true,
  builtinDown.ok ? String(builtinDown.value) : builtinDown.error)

const guardAll = [
  inActiveProfile, inShared, getThrowsCase, viaEnv, viaHomeEnv, nowhere, noRead, hardError, builtinDown,
]
check('守卫：九种环境一律返回真 boolean（Promise 会恒真）',
  guardAll.every((r) => r.ok === true && typeof r.value === 'boolean'),
  guardAll.map((r) => (r.ok ? typeof r.value : `throw:${r.error}`)).join(', '))
check('守卫里没有 await（同理）', !/\bawait\b/.test(guard))

// 真环境一致性：测试自己按同样的候选算一遍真相，守卫的答案必须与之一致。
const realHome = (typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME.length > 0)
  ? process.env.DSH_HOME
  : posix.join(homedir().replace(/\\/g, '/'), '.dsh')
const realProfiles = `${realHome}/profiles`
const realRoots = [`${realProfiles}/node_modules`]
try {
  for (const entry of readdirSync(realProfiles, { withFileTypes: true })) {
    if (entry.isDirectory()) realRoots.push(`${realProfiles}/${entry.name}/node_modules`)
  }
} catch { /* 没有 profiles 目录：realRoots 只有共享那一个 */ }
// ⚠️ 候选必须与守卫**完全一致**（0.13.1 修）：守卫除了 `DSH_HOME` 下的 profiles，还会看
//   `DSH_PROFILE_DIR`（环境变量）与 `profileContext`。第一版只查了前者 —— 于是当运行环境里
//   `DSH_HOME` 被指向空目录、而 `DSH_PROFILE_DIR` 仍指向真实 profile 时，守卫说「能解析」、
//   测试自己算的却是「解析不到」，这条断言就红了（**是测试镜像不完整，不是守卫错**）。
const envProfileDir = (typeof process.env.DSH_PROFILE_DIR === 'string' && process.env.DSH_PROFILE_DIR.length > 0)
  ? process.env.DSH_PROFILE_DIR.replace(/\\/g, '/')
  : ''
if (envProfileDir !== '') realRoots.push(`${envProfileDir}/node_modules`)
const realPresent = realRoots.some((root) => {
  try { createRequire(`${root}/package.json`).resolve(TOOL); return true } catch { return false }
})
const realGuard = safeRun(guard, { get: () => undefined })
check('真环境一致性：守卫的答案与「测试自己按同样候选查一遍」的结果一致',
  realGuard.ok === true && realGuard.value === !realPresent,
  `守卫=${realGuard.ok ? String(realGuard.value) : realGuard.error}，真机解析到=${realPresent}`)

// ── 依赖 & 没有自己实现 ──────────────────────────────────────────────────────
const range = manifest.dependencies?.[TOOL]
check('dependencies 里声明了工具包（否则守卫永远禁用 ⇒ 功能静默消失）',
  typeof range === 'string' && range.length > 0, JSON.stringify(manifest.dependencies ?? null))
check('依赖是区间（每个窗口都带 pre 比较器与独占上界，不是钉死 / 通配）',
  typeof range === 'string' && !range.includes('*') && range !== 'latest'
  && range.split('||').every((part) => /^\s*>=\S+ <\S+\s*$/.test(part)),
  String(range))
check('依赖窗口覆盖两个已验证过的运行时（0.1.7 与 0.2.0 —— 后者是本机升级后的实际版本）',
  typeof range === 'string' && range.includes('>=0.1.7-rc.1 <0.1.8')
  && range.includes('>=0.2.0-rc.1 <0.3.0'),
  `实际 ${String(range)}`)

check('没有在 lib 里自己实现这 6 个工具（这一档是官方包提供的）',
  !readFileSync('lib/index.js', 'utf8').replace(/\r\n/g, '\n').includes('terminal_open')
  && !readFileSync('lib/client.js', 'utf8').replace(/\r\n/g, '\n').includes('terminal_open'))

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
