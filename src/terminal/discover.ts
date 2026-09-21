/**
 * bash 探测（纯函数，零 import，host 与测试共用）。
 *
 * 为什么不能"扫 PATH 里的 bash.exe 就完事"：
 *
 *  1. **Windows 上 `bash.exe` 有两个来源，其中一个必须排除。**
 *     `C:\Windows\System32\bash.exe` 与 `…\Microsoft\WindowsApps\bash.exe` 是 WSL 的
 *     启动器。把它交给模型，等于把 Windows 路径体系换掉：`D:\a\b` 要写成 `/mnt/d/a/b`，
 *     盘符、反斜杠、`%TEMP%` 全都不通，而模型手里还拿着 Windows 风格的路径与工作目录。
 *     所以这里是**硬排除**（`isWslBash`），不是"排序靠后"。
 *
 *  2. **Git for Windows 不一定装在 Program Files。** 安装器以管理员运行时默认落
 *     `C:\Program Files\Git`，**以普通用户运行时默认落 `%LOCALAPPDATA%\Programs\Git`**；
 *     还有 Scoop / Chocolatey / GitHub Desktop 内嵌 / 自解压 PortableGit 等来源。
 *     本机就是反例：Git 装在 `D:\Git`（只有因为 `D:\Git\cmd` 在 PATH 上才被找到）。
 *     所以探测是**先找 git，再由同一个安装反推 bash**，再叠加一份"常见来源"候选表。
 *
 *  3. **Niubash（牛 bash，`niu.exe`）是候选而不是默认。** 它的命令集（winuxcmd）对
 *     非 ASCII 参数的处理有问题（实测：`grep <中文文件名>` 直接 `cannot open` 并以
 *     `0xC0000409` 退出），所以排在真 Git Bash 之后，但仍然列出来 —— 用户可能特意选了它。
 *
 * 覆盖的来源（顺序即优先级，同类内保持这里的先后）：
 *   显式路径 → PATH 上的 git 反推 → Program Files / x86 / W6432 / `%LOCALAPPDATA%\Programs`
 *   → Scoop → Chocolatey 便携包 → GitHub Desktop 内嵌 → 旧 GitHub 的 PortableGit
 *   → Visual Studio 内嵌 → MSYS2 → Cygwin → **各盘符根下的 Git / PortableGit / msys64 / cygwin64**
 *   → Niubash → PATH 兜底。
 *
 * 带版本号的来源（GitHub Desktop 的 `app-*`、旧 GitHub 的 `PortableGit_*`、VS 的
 * `<年份>\<版本>`）需要"列一眼子目录"，所以输入里多了一个可注入的 `listDirs`；
 * **不注入就退化成纯存在性检查**（不读目录）。全程不运行任何进程：版本探测属于宿主半。
 */

/** 候选的种类（决定排序权重与默认标签）。 */
export type BashKind = 'git' | 'msys2' | 'cygwin' | 'niubash' | 'path'

/** 一个候选 shell。 */
export interface BashCandidate {
  /** 归一化后的绝对路径（正斜杠），可直接落盘与回显。 */
  readonly path: string
  readonly kind: BashKind
  /** 给用户看的来源标签（具体来源优先，例如 'Scoop 的 git'，否则用种类标签）。 */
  readonly label: string
  /** 是否是用户在设置里显式指定的（界面标注「你指定的」，且排序永远在最前）。 */
  readonly explicit: boolean
}

/** 被硬排除的路径及原因（设置页要如实说明"为什么不选它"）。 */
export interface ExcludedPath {
  readonly path: string
  readonly reason: string
}

/** 显式路径（设置里填的）的状态。 */
export interface ExplicitState {
  readonly path: string
  readonly state: 'ok' | 'missing' | 'wsl'
}

/** 探测的输入（全部可注入，测试里给假实现即可）。 */
export interface DiscoverInput {
  /** 路径是否存在。 */
  readonly exists: (path: string) => boolean
  /** 按顺序的 PATH 条目（未清洗）。 */
  readonly pathEntries: readonly string[]
  /** 环境变量取值。 */
  readonly env: (name: string) => string | undefined
  /** 设置里显式填的 bash 路径（可空）。 */
  readonly explicitPath?: string
  /**
   * 列出某个目录下的**子目录名**（只用于带版本号的来源：GitHub Desktop / 旧 GitHub / VS）。
   * 不注入、目录不存在或没有权限时都当作"空"，探测退化成纯存在性检查。
   */
  readonly listDirs?: (parent: string) => readonly string[]
}

/** 探测结果。 */
export interface DiscoverResult {
  /** 按优先级排好序、已去重、已剔除 WSL 的候选。 */
  readonly candidates: readonly BashCandidate[]
  /** 被硬排除的路径（当前只有 WSL）。 */
  readonly excluded: readonly ExcludedPath[]
  /** 显式路径的状态；没填就是 undefined。 */
  readonly explicit?: ExplicitState
}

/** WSL 排除原因（设置页直接展示这句话）。 */
export const WSL_REASON = 'WSL 的 bash：它按 Linux 规则解释路径（D:\\x 要写成 /mnt/d/x），'
  + '与模型手里的 Windows 工作目录不兼容，故不采用'

/** 归一化：反斜杠转正斜杠、去掉包裹引号与结尾斜杠、合并重复分隔符。 */
export function normalizePath(value: string): string {
  const trimmed = value.trim().replace(/^"|"$/g, '')
  const slashed = trimmed.replace(/\\/g, '/').replace(/\/{2,}/g, '/')
  return slashed.length > 1 ? slashed.replace(/\/+$/, '') : slashed
}

/** 是否 WSL 的 bash（System32 的启动器与 WindowsApps 的别名）。 */
export function isWslBash(value: string): boolean {
  const path = normalizePath(value).toLowerCase()
  return /\/windows\/system32\/bash\.exe$/.test(path) || /\/windowsapps\/bash\.exe$/.test(path)
}

/** 按路径形态判断种类（显式路径也能因此拿到正确的标签与优先级）。 */
export function candidateKindOf(value: string): BashKind {
  const path = normalizePath(value).toLowerCase()
  if (path.endsWith('/niu.exe') || path.includes('/niubash/')) return 'niubash'
  if (path.includes('/msys64/') || path.includes('/msys32/') || path.includes('/msys2/')) return 'msys2'
  if (path.includes('/cygwin')) return 'cygwin'
  // `PortableGit` 也算 git（正则里把可选前缀写上），只是标签不同。
  if (/(^|\/)(portable)?git(\/|$)/.test(path)) return 'git'
  return 'path'
}

/** 种类 → 界面标签（具体来源没给时用它）。 */
export function kindLabel(kind: BashKind): string {
  switch (kind) {
    case 'git': return 'Git for Windows'
    case 'msys2': return 'MSYS2'
    case 'cygwin': return 'Cygwin'
    case 'niubash': return 'Niubash（牛 bash）'
    default: return 'PATH'
  }
}

/** 种类排序权重（数字越小越优先）；niubash 低于 MSYS2/Cygwin，高于杂项 PATH。 */
const KIND_RANK: Record<BashKind, number> = { git: 0, msys2: 1, cygwin: 2, niubash: 3, path: 4 }

/** 盘符扫描的字母（跳过 A:/B: 软驱位）。 */
const DRIVE_LETTERS = 'CDEFGHIJKLMNOPQRSTUVWXYZ'

/** 从 PATH 条目里认出 git 安装根（`<root>\cmd` / `<root>\bin` / `<root>\mingw64\bin` 都归到 root）。 */
function gitRootOf(entry: string): string | undefined {
  const path = normalizePath(entry)
  if (path === '') return undefined
  const lower = path.toLowerCase()
  for (const suffix of ['/mingw64/bin', '/mingw32/bin', '/usr/bin', '/cmd', '/bin']) {
    if (lower.endsWith(suffix)) return path.slice(0, path.length - suffix.length)
  }
  return path
}

/** 一个安装根下所有可能的 bash 位置（顺序即优先级）。 */
function bashPathsUnder(root: string): readonly string[] {
  return [`${root}/bin/bash.exe`, `${root}/usr/bin/bash.exe`, `${root}/mingw64/bin/bash.exe`]
}

/**
 * `usr/bin` / `mingw64/bin` 下的 bash 是**裸本体**：直接跑它不会准备 MSYS 环境。
 *
 * 本机实测（`D:\Git` 两个都跑了一遍）：`bin\bash.exe` 给出 `MSYSTEM=MINGW64`、
 * `PATH` 前置 `/mingw64/bin:/usr/bin`，`head` / `grep` / `uname` 都在（中文文件名当参数也正常）；
 * 而 `usr\bin\bash.exe` 的 `MSYSTEM` 为空、`PATH` 只有继承来的 Windows PATH（里面只有 `D:\Git\cmd`），
 * 于是 `head` / `grep` / `uname` **全部 command not found** —— 交给模型就是大面积失败。
 *
 * 所以：同一个根下只要有 `bin/bash.exe`，就不再列这个裸本体（用户仍可手填）。
 * 没有 `bin/bash.exe` 兄弟的（例如 MSYS2 只提供 `usr\bin\bash.exe`）照常列出。
 * @param value 候选路径。
 * @returns 安装根；不是裸本体时 undefined。
 */
export function unpreparedBashRoot(value: string): string | undefined {
  const match = /^(.*)\/(usr|mingw32|mingw64)\/bin\/bash\.exe$/i.exec(normalizePath(value))
  return match?.[1]
}

/** 一个候选来源：一组安装根 + 可选的具体标签。 */
interface SourceGroup {
  readonly roots: readonly string[]
  readonly label?: string
}

/**
 * 探测候选 bash。
 * @param input 注入的 exists/PATH/环境变量，以及可选的 listDirs（列子目录）。
 * @returns 候选、被排除的路径、显式路径状态。
 */
export function discoverBashCandidates(input: DiscoverInput): DiscoverResult {
  const seen = new Set<string>()
  const excluded: ExcludedPath[] = []
  const ordered: BashCandidate[] = []

  /** 列子目录；没有注入、目录不存在或没权限都当空。 */
  const dirsOf = (parent: string): readonly string[] => {
    if (input.listDirs === undefined) return []
    try {
      return input.listDirs(parent)
    } catch {
      return []
    }
  }

  /** 记一个候选；WSL 一律转成排除项，重复路径只留第一次（即优先级最高的那一次）。 */
  const consider = (raw: string, label?: string, isExplicit = false): void => {
    const path = normalizePath(raw)
    if (path === '') return
    if (isWslBash(path)) {
      // 只在它**确实存在**时报"已排除"：否则每台机器都会凭空多出一条 WSL 警告。
      if (!input.exists(path)) return
      if (!excluded.some(item => item.path.toLowerCase() === path.toLowerCase())) {
        excluded.push({ path, reason: WSL_REASON })
      }
      return
    }
    // 裸本体（usr/bin、mingw64/bin）：同根下已有会准备环境的 `bin/bash.exe` 时不再作为候选，
    // 免得用户点到一个"命令全找不到"的 shell。**显式路径不受此限**：那是用户自己的选择。
    if (!isExplicit) {
      const root = unpreparedBashRoot(path)
      if (root !== undefined && input.exists(`${root}/bin/bash.exe`)) return
    }
    const key = path.toLowerCase()
    if (seen.has(key)) return
    if (!input.exists(path)) return
    seen.add(key)
    const kind = candidateKindOf(path)
    ordered.push({ path, kind, label: label ?? kindLabel(kind), explicit: isExplicit })
  }

  /** 一组来源：只试存在的安装根，再把该根下所有可能的 bash 位置丢给 consider。 */
  const addGroup = (group: SourceGroup): void => {
    for (const root of group.roots) {
      if (root === '' || !input.exists(root)) continue
      for (const path of bashPathsUnder(root)) consider(path, group.label)
    }
  }

  // 1) 显式路径：用户自己填的，优先级最高（填错也会如实报告）。
  const explicitRaw = normalizePath(input.explicitPath ?? '')
  let explicit: ExplicitState | undefined
  if (explicitRaw !== '') {
    if (isWslBash(explicitRaw)) {
      explicit = { path: explicitRaw, state: 'wsl' }
      // 用户明确填了 WSL：要让他看到"为什么不采用"，而不是看到候选里悄悄少了一条。
      if (input.exists(explicitRaw)) excluded.push({ path: explicitRaw, reason: WSL_REASON })
    } else if (input.exists(explicitRaw)) explicit = { path: explicitRaw, state: 'ok' }
    else explicit = { path: explicitRaw, state: 'missing' }
  }

  const entries = input.pathEntries
    .map(entry => normalizePath(entry))
    .filter(entry => entry !== '')
  const env = (name: string): string | undefined => {
    const value = input.env(name)
    return value === undefined || value === '' ? undefined : normalizePath(value)
  }

  const programFiles = env('ProgramFiles') ?? 'C:/Program Files'
  const programFilesX86 = env('ProgramFiles(x86)') ?? 'C:/Program Files (x86)'
  const programW6432 = env('ProgramW6432')
  const localAppData = env('LOCALAPPDATA')
  const home = env('USERPROFILE') ?? env('HOME')
  const scoop = env('SCOOP') ?? (home === undefined ? undefined : `${home}/scoop`)
  const choco = env('ChocolateyInstall')
    ?? (env('ProgramData') === undefined ? 'C:/ProgramData/chocolatey' : `${env('ProgramData') as string}/chocolatey`)

  // 带版本号的来源：列一眼子目录，按名字**倒序**（`app-3.4.3` 这种名字，新的排在前面）。
  const versioned: string[] = []
  if (localAppData !== undefined) {
    const desktop = `${localAppData}/GitHubDesktop`
    for (const dir of [...dirsOf(desktop)].sort().reverse()) {
      if (dir.startsWith('app-')) versioned.push(`${desktop}/${dir}/resources/app/git`)
    }
    const github = `${localAppData}/GitHub`
    for (const dir of [...dirsOf(github)].sort().reverse()) {
      if (dir.startsWith('PortableGit')) versioned.push(`${github}/${dir}`)
    }
  }
  const vsRoot = `${programFiles}/Microsoft Visual Studio`
  for (const year of dirsOf(vsRoot)) {
    const yearRoot = `${vsRoot}/${year}`
    for (const edition of dirsOf(yearRoot)) {
      versioned.push(`${yearRoot}/${edition}/Common7/IDE/CommonExtensions/Microsoft/TeamFoundation/Team Explorer/Git`)
    }
  }

  // 各盘符根下的常见名字：覆盖"装在 D:\Git / D:\PortableGit / 自己解压"的情况。
  const drives: string[] = []
  for (const letter of DRIVE_LETTERS) {
    const root = `${letter}:`
    if (input.exists(`${root}/`)) drives.push(root)
  }
  const driveRoots = (names: readonly string[]): readonly string[] =>
    drives.flatMap(root => names.map(name => `${root}/${name}`))

  const groups: readonly SourceGroup[] = [
    // 2) PATH 上认出来的 git 根 —— 那才是用户实际在用的那份。
    ...entries.map(entry => gitRootOf(entry))
      .filter((root): root is string => root !== undefined)
      .map(root => ({ roots: [root] })),
    // 3) 官方安装器的两个默认落点 + 32 位 / 重定向后的 Program Files。
    { roots: [programFiles, programFilesX86, programW6432, localAppData === undefined ? undefined : `${localAppData}/Programs`]
      .filter((base): base is string => base !== undefined)
      .map(base => `${base}/Git`) },
    // 4) Scoop（`scoop install git` 会带一份 bash）。
    ...(scoop === undefined ? [] : [{ roots: [`${scoop}/apps/git/current`, `${scoop}/apps/git`], label: 'Scoop 的 git' }]),
    // 5) Chocolatey 的便携包（`git.install` 装的仍在 Program Files，上面那条已覆盖）。
    { roots: [`${choco}/lib/git.portable/tools`, `${choco}/lib/git.portable/tools/git`], label: 'Chocolatey 便携包' },
    // 6) GitHub Desktop / 旧 GitHub for Windows / Visual Studio 自带（都带版本号，靠 listDirs）。
    { roots: versioned.filter(path => path.includes('GitHubDesktop')), label: 'GitHub Desktop 内嵌' },
    { roots: versioned.filter(path => path.includes('/GitHub/PortableGit')), label: 'GitHub PortableGit' },
    { roots: versioned.filter(path => path.includes('/Microsoft Visual Studio/')), label: 'Visual Studio 内嵌' },
    // 7) MSYS2 / Cygwin 的常见位置（含各盘符根下的同名目录）。
    { roots: [`${programFiles}/msys64`, 'C:/msys64', ...driveRoots(['msys64'])], label: 'MSYS2' },
    { roots: [`${programFiles}/cygwin64`, 'C:/cygwin64', 'C:/cygwin', ...driveRoots(['cygwin64', 'cygwin'])], label: 'Cygwin' },
    // 8) 各盘符根下的 Git / PortableGit（装在 D:\Git、D:\PortableGit 这类）。
    { roots: driveRoots(['Git', 'Program Files/Git', 'Program Files (x86)/Git']), label: 'Git for Windows' },
    { roots: driveRoots(['PortableGit']), label: 'PortableGit（自解压）' },
  ]
  for (const group of groups) addGroup(group)

  // 9) Niubash（用户可能特意装的 bash 兼容环境）。它的可执行文件叫 `niu.exe` 且就在根目录，
  //    不符合"安装根 / bin|usr/bin|mingw64/bin"的形状，所以单独考虑，不能塞进分组。
  if (localAppData !== undefined) consider(`${localAppData}/Programs/Niubash/niu.exe`, 'Niubash（牛 bash）')

  // 10) PATH 兜底：最容易命中的是 WSL，靠 consider() 里的 isWslBash 拦掉。
  for (const entry of entries) consider(`${entry}/bash.exe`)

  // 显式路径也交给 consider 参与去重；它靠 `explicit` 标记在排序里拿第一，
  // 而不是靠在数组里插队 —— 否则同一条路径可能出现两次。
  if (explicit?.state === 'ok') consider(explicit.path, undefined, true)

  // 排序：显式优先 → 种类权重 → 同一组内保持上面的搜索先后。
  const ranked = ordered
    .map((candidate, index) => ({ candidate, index }))
    .sort((a, b) => {
      if (a.candidate.explicit !== b.candidate.explicit) return a.candidate.explicit ? -1 : 1
      const rank = KIND_RANK[a.candidate.kind] - KIND_RANK[b.candidate.kind]
      return rank !== 0 ? rank : a.index - b.index
    })
    .map(item => item.candidate)

  return {
    candidates: ranked,
    excluded,
    ...(explicit === undefined ? {} : { explicit }),
  }
}

/**
 * 默认选谁：候选表里的第一个（探测顺序已经把"显式路径 → 真 Git Bash → 其它"排好了）。
 * @param result 探测结果。
 * @returns 路径；一个候选都没有时返回空串。
 */
export function defaultBashPath(result: DiscoverResult): string {
  return result.candidates[0]?.path ?? ''
}
