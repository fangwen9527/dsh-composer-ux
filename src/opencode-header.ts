/**
 * 「宿主是否已经自己发 `x-opencode-session`」的能力探测（0.25.0）。
 *
 * ## 为什么要有这一层
 *
 * 这块能力原本是补上游的缺口：OpenCode Go 的文档要求客户端**为每段对话**发一个稳定的
 * `x-opencode-session`，而早期 DSH 不发，所以本插件把 `providers.<route>.headers.<name>` 补进
 * llm-pi-ai 的配置（一个**固定**的值，设置页写着"所有对话共用这一个值"）。
 *
 * 后来上游补上了：`@earendil-works/pi-ai` 从 1.0.2 起自带 `dist/providers/opencode-headers.js`，
 * `opencode` 与 `opencode-go` 两个 provider 都被 `withOpenCodeSessionHeader()` 包过；它用的是
 * **`options.sessionId`（每段对话的真实会话 id）**，并且在已有同名头时**不覆盖**
 * （`hasHeader()` 命中就返回原样）。
 *
 * 两件事叠起来的后果很具体：插件那把固定 UUID 会**顶掉**真实 session id —— 所有对话上报同一个
 * 会话，正是 OpenCode 拿它优化路由与提示词缓存的那一维。所以 0.25.0 起先把宿主探一遍：
 * 宿主自己会发，就**不注入**；只有旧宿主（没有这个模块）才按原样注入。
 *
 * ## 探测判据为什么是"文件在不在"，不是"版本号够不够"
 *
 * 能力就是那个模块（`withOpenCodeSessionHeader`）。版本号只是旁证：不同发行渠道可能改目录、
 * 也可能裁掉某个模块。所以主判据是**在宿主自己的 pi-ai 安装里看到那个文件**，版本号只用来写
 * 给人看的证据（{@link NativeDetection.evidence}）。
 *
 * 探测不到（找不到宿主安装、读不动 app.asar、测试用的假 ctx）时**按旧宿主处理**（继续注入）：
 * 这条路的失败方向是"多做一次旧行为"，不是"让需要它的旧宿主静默失效"。真要反过来，
 * 用 {@link NATIVE_SUPPORT_ENV} 强制。
 *
 * 本模块只在宿主半用（读了 `node:fs` / `process`），客户端半不要 import 它。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

/** 判定结果：`native` = 宿主自己会发（不注入）；`legacy` = 旧宿主（按原样注入）。 */
export type NativeSupport = 'native' | 'legacy'

/** 判定结果 + 一句给人看的证据（写进设置页状态行与自检卡）。 */
export interface NativeDetection {
  readonly support: NativeSupport
  /** 空串 = 没探到（按旧宿主处理），界面只说"没探到"。 */
  readonly evidence: string
}

/**
 * 强制指定探测结果的环境变量：`1`/`true` = 当原生支持（不注入），`0`/`false` = 当旧宿主（注入）。
 *
 * 存在的理由有两个：① 测试要能在**任何机器**上把两条分支都跑到；② 只认文件的那条判据总有
 * 假阴性（发行渠道改目录、裁包），用户需要一个不依赖文件布局的开关。
 */
export const NATIVE_SUPPORT_ENV = 'DSH_COMPOSER_UX_HEADER_NATIVE'

/** 自带这个能力的 pi-ai 版本（只用于证据文案；主判据仍是模块文件）。 */
export const PI_AI_NATIVE_SINCE = '1.0.2'

/** 一个 `x.y.z` 版本号的前三段数字；解析不出就是全 0。 */
export function versionParts(version: string): readonly [number, number, number] {
  const match = /(\d+)\.(\d+)\.(\d+)/.exec(version)
  if (match === null) return [0, 0, 0]
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/**
 * `version` 是否 ≥ `floor`（只比前三段）。
 * @param version 待比较的版本号（可以带前缀/后缀，例如 `1.0.2-rc.1`）。
 * @param floor 下界。
 */
export function versionAtLeast(version: string, floor: string): boolean {
  const left = versionParts(version)
  const right = versionParts(floor)
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] > right[index]
  }
  return true
}

/** 读一个 package.json 的 version（读不到/不是字符串就空串）。 */
function versionOf(piAiRoot: string): string {
  try {
    const parsed: unknown = JSON.parse(readFileSync(join(piAiRoot, 'package.json'), 'utf8'))
    const version = (parsed as { version?: unknown } | null)?.version
    return typeof version === 'string' ? version : ''
  } catch {
    return ''
  }
}

/** 宿主可能把 pi-ai 装在哪（只列候选，不判断真假）。 */
function piAiRoots(): readonly string[] {
  const roots: string[] = []
  // ① 桌面应用（Electron）：运行时在 resources/app.asar 里，Electron 的 fs 能直接读 asar 路径。
  const resources = (process as { resourcesPath?: unknown }).resourcesPath
  if (typeof resources === 'string' && resources !== '') {
    roots.push(join(resources, 'app.asar', 'dsh', 'node_modules', '@earendil-works', 'pi-ai'))
    roots.push(join(resources, 'app', 'node_modules', '@earendil-works', 'pi-ai'))
  }
  // ② 网页版（node）：从入口往上找 node_modules；pnpm 的依赖在 node_modules/.pnpm 里。
  const entry = process.argv[1]
  if (typeof entry === 'string' && entry !== '') {
    let dir = dirname(resolve(entry))
    for (let depth = 0; depth < 8; depth += 1) {
      roots.push(join(dir, 'node_modules', '@earendil-works', 'pi-ai'))
      const store = join(dir, 'node_modules', '.pnpm')
      try {
        for (const name of readdirSync(store)) {
          if (name.startsWith('@earendil-works+pi-ai@')) {
            roots.push(join(store, name, 'node_modules', '@earendil-works', 'pi-ai'))
          }
        }
      } catch {
        /* 没有 .pnpm 就不是 pnpm 装的，跳过 */
      }
      const up = dirname(dir)
      if (up === dir) break
      dir = up
    }
  }
  return roots
}

/** 一个 pi-ai 安装是否自带原生支持：看那个模块文件（版本号只进证据文案）。 */
function inspectPiAiRoot(piAiRoot: string): NativeDetection | undefined {
  try {
    if (!existsSync(join(piAiRoot, 'dist', 'providers', 'opencode-headers.js'))) return undefined
  } catch {
    return undefined
  }
  const version = versionOf(piAiRoot)
  return {
    support: 'native',
    evidence: version === '' ? 'pi-ai 自带 opencode-headers.js' : `pi-ai ${version} 自带 opencode-headers.js`,
  }
}

/**
 * 探测宿主是否已经自己发 `x-opencode-session`。
 *
 * @param env 环境变量（默认 `process.env`；测试可传假的）。
 * @param roots pi-ai 的候选安装目录（默认按本机布局推算；测试可传假的）。
 * @returns `native` + 证据，或 `legacy`（含"没探到"）。
 */
export function detectNativeSessionHeader(
  env: NodeJS.ProcessEnv = process.env,
  roots: readonly string[] = piAiRoots(),
): NativeDetection {
  const forced = env[NATIVE_SUPPORT_ENV]
  if (forced === '1' || forced === 'true') return { support: 'native', evidence: '环境变量强制' }
  if (forced === '0' || forced === 'false') return { support: 'legacy', evidence: '' }
  for (const root of roots) {
    const found = inspectPiAiRoot(root)
    if (found !== undefined) return found
  }
  return { support: 'legacy', evidence: '' }
}

/** 探测只做一次（宿主启动后布局不变；`internal/config` 会频繁回调，不能每次都读盘）。 */
let cached: NativeDetection | undefined

/** 取缓存的探测结果（第一次调用时真探测）。 */
export function nativeSessionHeader(): NativeDetection {
  cached ??= detectNativeSessionHeader()
  return cached
}

/** 丢掉缓存（测试用：同一进程里换环境变量再探一次）。 */
export function resetNativeSessionHeaderCache(): void {
  cached = undefined
}
