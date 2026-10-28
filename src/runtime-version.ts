/**
 * 读宿主运行时（DSH 本体）的版本号（0.26.1）。
 *
 * ## 为什么单独一个文件
 *
 * 自检卡那一行原来固定写 `dshVersion: ''`，于是永远显示「DSH （拿不到）」——
 * 用户 2026-10-28 在新宿主上看到这句，问"为什么拿不到"。不是拿不到，是**从来没去读**。
 *
 * 但"读版本"这件事没法塞进 `host.ts` 里顺手做：宿主有三种装法（源码 workspace / 桌面
 * `app.asar` 解包 / profile 里的 npm 包），每种的可解析路径都不一样；再加上要与官方
 * `@deepseek-ai/dsh-app-boot` 的判据保持一致（它自己就是读**自己的 package.json**）。
 * 写成带注入的纯函数，才能在 node 测试里把"三种布局 + 全失败"逐条钉住。
 *
 * ## 判据（抄官方 `getDshRuntimeVersion()` 的做法）
 *
 *   ① `require.resolve('@deepseek-ai/dsh-app-boot')` → 从入口往上找 `package.json`；
 *   ② 解析不到就扫 `$DSH_HOME/profiles/<name>/node_modules/@deepseek-ai/dsh-app-boot/package.json`
 *      （profile 里的包是扁平安装的，桌面端解包后也在这一层）；
 *   ③ 都失败返回空串 —— 界面照旧显示"拿不到"，**绝不猜一个版本号**（猜错比不写更糟：
 *      兼容性预检正是拿这个版本比区间）。
 */

/** 探测所需的全部外部输入（测试可注入）。 */
export interface RuntimeVersionOptions {
  /** 环境变量（读 `DSH_HOME`）。 */
  readonly env?: Readonly<Record<string, string | undefined>>
  /** 读一个文本文件；读不到抛错。 */
  readonly readFile?: (path: string) => string
  /** 解析 `@deepseek-ai/dsh-app-boot` 的入口路径；解析不到返回 undefined。 */
  readonly resolveAppBoot?: () => string | undefined
  /** 列出 profiles 下的目录名；没有就返回空数组。 */
  readonly listProfiles?: (profilesDir: string) => readonly string[]
  /** 用户主目录（算默认 `DSH_HOME` 用）。 */
  readonly homeDir?: string
  /** 路径拼接（注入只为测试跨平台）。 */
  readonly joinPath?: (...parts: string[]) => string
  /** 取目录名。 */
  readonly dirName?: (path: string) => string
}

/** 从 `package.json` 文本里取 `version`；形状不对就空串。 */
export function versionOfManifest(text: string): string {
  try {
    const parsed = JSON.parse(text) as { version?: unknown }
    return typeof parsed.version === 'string' ? parsed.version.trim() : ''
  } catch {
    return ''
  }
}

/**
 * 探测运行时版本。
 *
 * @param options - 注入点（见 {@link RuntimeVersionOptions}）。
 * @returns 版本号；一处都读不到时为空串。
 */
export function detectRuntimeVersion(options: RuntimeVersionOptions = {}): string {
  const env = options.env ?? process.env
  const readFile = options.readFile ?? (path => defaultReadFile(path))
  const join = options.joinPath ?? ((...parts: string[]): string => parts.join('/').replace(/\/+/g, '/'))
  const dirname = options.dirName ?? (path => path.replace(/[\\/][^\\/]*$/, ''))
  const homeDir = options.homeDir ?? defaultHomeDir()
  const candidates: string[] = []

  const entry = options.resolveAppBoot?.() ?? defaultResolveAppBoot()
  if (entry !== undefined && entry !== '') {
    // 不用 '..'：注入的 join 未必做路径归一（测试里就是朴素拼接），少一层假设。
    candidates.push(join(dirname(dirname(entry)), 'package.json'))
    candidates.push(join(dirname(entry), 'package.json'))
  }

  const home = typeof env.DSH_HOME === 'string' && env.DSH_HOME.length > 0
    ? env.DSH_HOME
    : join(homeDir, '.dsh')
  const profiles = join(home, 'profiles')
  candidates.push(join(profiles, 'node_modules', '@deepseek-ai', 'dsh-app-boot', 'package.json'))
  let names: readonly string[] = []
  try {
    names = options.listProfiles?.(profiles) ?? defaultListProfiles(profiles)
  } catch {
    names = []
  }
  for (const name of names) {
    candidates.push(join(profiles, name, 'node_modules', '@deepseek-ai', 'dsh-app-boot', 'package.json'))
  }

  for (const path of candidates) {
    try {
      const version = versionOfManifest(readFile(path))
      if (version !== '') return version
    } catch {
      /* 读不到就试下一个候选 */
    }
  }
  return ''
}

/** 默认读文件实现（`node:fs`）。 */
function defaultReadFile(path: string): string {
  return process.getBuiltinModule('node:fs').readFileSync(path, 'utf8')
}

/** 默认主目录。 */
function defaultHomeDir(): string {
  return process.getBuiltinModule('node:os').homedir()
}

/** 默认列目录实现（只取目录名；失败返回空数组）。 */
function defaultListProfiles(profilesDir: string): readonly string[] {
  const fs = process.getBuiltinModule('node:fs')
  return fs.readdirSync(profilesDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
}

/** 默认解析实现：从本模块位置解析 `@deepseek-ai/dsh-app-boot`。 */
function defaultResolveAppBoot(): string | undefined {
  try {
    const require_ = process.getBuiltinModule('node:module').createRequire(import.meta.url) as {
      resolve: (id: string) => string
    }
    return require_.resolve('@deepseek-ai/dsh-app-boot')
  } catch {
    return undefined
  }
}
