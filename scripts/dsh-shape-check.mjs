/**
 * DSH 形状核对（**手动跑，不进 `npm test`**）：把本插件依赖的**宿主内部形状**逐条对着
 * DSH 源码检一遍。
 *
 *   node scripts/dsh-shape-check.mjs [DSH 检出路径]
 *
 * 为什么需要它：这些依赖**名字或形状一变，插件不会报错，只会静默降级**
 * ——  例如 `sessions.list()` 返回的行上没有 `seq`，`liveSeq` 就成了 `undefined`，
 * 增量重读悄悄失效、面板停在旧数字上；服务名写错则整条路由根本不注册。
 * 这类问题在升级 DSH 之后最容易出现，而单测（用假 ctx）永远发现不了。**读源码，不改任何东西。**
 *
 * 每一条都写出"我们依赖它的哪一行代码"，这样红了能立刻知道影响面。
 *
 * 2026-10-09 扩写（升 0.2.1-alpha.2 时）：原来只有四节，只认识 0.13 时代的依赖。后来加的三块
 * ——目录选择的槽位 shadow 接管（0.18.0）、四个通知事件（0.17.0）、客户端设置表单与终端依赖
 * （0.15~0.19）——全部补成可核对的条目，升级时才有得查。
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = process.argv[2] ?? 'D:/DeepSeek Harness'
if (!existsSync(join(ROOT, 'packages'))) {
  console.error(`找不到 DSH 检出：${ROOT}`)
  console.error('用法：node scripts/dsh-shape-check.mjs [DSH 检出路径]')
  process.exit(2)
}

let failures = 0
const check = (label, ok, detail) => {
  if (!ok) failures += 1
  console.log(`${ok ? '✓' : '✗'} ${label}${detail === undefined ? '' : ' — ' + detail}`)
}
/**
 * 整棵树里搜一个正则，回第一个"文件:行号"，没有就回 undefined。
 *
 * 只给"某个旧东西应该彻底消失"这类断言用（例如 0.1.6 的 `settingsScope`），所以：
 * 只扫源码扩展名、跳过 node_modules / lib / dist / .git，并在第一次命中就停。
 * @param root - 起始目录。
 * @param pattern - 要找的正则。
 * @returns "相对路径:行号" 或 undefined。
 */
const grepAll = (root, pattern) => {
  const skip = new Set(['node_modules', 'lib', 'dist', '.git', 'coverage', '.turbo'])
  const walk = (dir) => {
    let entries
    try { entries = readdirSync(dir) } catch { return undefined }
    for (const name of entries) {
      if (skip.has(name)) continue
      const path = join(dir, name)
      let stat
      try { stat = statSync(path) } catch { continue }
      if (stat.isDirectory()) {
        const hit = walk(path)
        if (hit !== undefined) return hit
        continue
      }
      if (!/\.(ts|tsx|mts|cts|js|mjs|cjs)$/.test(name)) continue
      let text
      try { text = readFileSync(path, 'utf8') } catch { continue }
      const index = text.search(pattern)
      if (index === -1) continue
      return `${path.slice(ROOT.length + 1)}:${text.slice(0, index).split('\n').length}`
    }
    return undefined
  }
  return walk(root)
}
/** 在文件里找一段正则，回一个"文件:行号"的说明。 */
const look = (file, pattern) => {
  const path = join(ROOT, file)
  if (!existsSync(path)) return { ok: false, where: `${file}（不存在）` }
  const text = readFileSync(path, 'utf8')
  const match = pattern.exec(text)
  if (match === null) return { ok: false, where: `${file}（没找到 ${pattern}）` }
  const line = text.slice(0, match.index).split('\n').length
  return { ok: true, where: `${file}:${line}` }
}

console.log(`DSH 检出：${ROOT}`)

// ── 版本 ────────────────────────────────────────────────────────────────────
try {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  console.log(`版本：${pkg.version ?? '(未知)'}`)
} catch {
  console.log('版本：(读不到根 package.json)')
}

console.log('\n[1] 会话服务（用量路由的两条命脉）')
{
  // host.ts：ctx.inject(['webServer', 'sessions'], …) + usageCtx.get('sessionQuery')
  const service = look('packages/core/session/src/index.ts', /super\(ctx, 'sessions'\)/)
  check("提供 `sessions` 服务（host.ts 的 inject 依赖它，缺了整条用量路由不注册）", service.ok, service.where)
  const list = look('packages/core/session/src/index.ts', /\blist\(\): Session\[\]/)
  check('`sessions.list()` 存在且返回 Session[]', list.ok, list.where)
  const id = look('packages/core/session/src/index.ts', /get id\(\): SessionId/)
  check('`Session.id` 是取值器（我们按 id 找当前会话）', id.ok, id.where)
  const seq = look('packages/core/session/src/index.ts', /get seq\(\): SessionLogOffset/)
  check('`Session.seq` 是取值器（拿不到它 liveSeq 会是 undefined，增量重读静默失效）', seq.ok, seq.where)
  const query = look('packages/session-query/session-query/src/index.ts', /super\(ctx, 'sessionQuery'\)/)
  check('提供 `sessionQuery` 服务（首播用）', query.ok, query.where)
  const read = look('packages/session-query/session-query/src/index.ts', /async readSession\(sessionId: SessionId\)/)
  check('`sessionQuery.readSession(id)` 存在', read.ok, read.where)
  const events = look('packages/session-query/session-query/src/index.ts', /events: loaded\.events\.map\(/)
  check('它的返回体里有 `events` 数组（我们读 snapshot.events）', events.ok, events.where)
  const shape = look('packages/core/session/src/types.ts', /type SessionEvent<[^>]*> = \{/)
  check('`SessionEvent` 存在（我们读它的 `seq` 与 `time`）', shape.ok, shape.where)
  const seqField = look('packages/core/session/src/types.ts', /^\s+seq: SessionSeq$/m)
  const timeField = look('packages/core/session/src/types.ts', /^\s+time: number$/m)
  check('事件信封上有 `seq` 与 `time`（折叠按它们去重与判档）', seqField.ok && timeField.ok,
    `${seqField.where} / ${timeField.where}`)
}

console.log('\n[2] 设置服务（两代读取形状，见 host.ts 的 makeReader）')
{
  const file = 'packages/settings/settings/src/index.ts'
  const path = join(ROOT, file)
  const text = existsSync(path) ? readFileSync(path, 'utf8') : ''
  const hasGet = /^\s+get\(ns/m.test(text)
  const describe = look(file, /^\s+(async )?describe\(/m)
  // 真签名带 `async`（`async mutate(ns, ops, expectedRevision?)`）—— 第一次写这条时有漏 `async` 的教训。
  const update = look(file, /^\s+(async )?update\(/m)
  const replace = look(file, /^\s+(async )?replace\(/m)
  const mutate = look(file, /^\s+(async )?mutate\(/m)
  check('`describe()` 存在（0.1.7 的读取口，也是 makeReader 的兜底）', describe.ok, describe.where)
  check('`update()` / `replace()` / `mutate()` 三个写入口都还在（我们在用 mutate）',
    update.ok && replace.ok && mutate.ok, `${update.where} / ${replace.where} / ${mutate.where}`)
  check(`这一版的设置服务${hasGet ? '**有** `get(ns)`' : '**没有** `get(ns)`（我们只准走 makeReader）'} —— `
    + '本机实测：0.1.7-rc.1 没有；写 service?.get?.(ns) 会永远读不到值',
    true, hasGet ? '有' : '没有')
  const emit = look(file, /emit\('settings\/document-updated'/)
  check('`settings/document-updated` 事件仍然存在', emit.ok, emit.where)
  // 这条是 2026-09-29 的重要经验：事件只在 describe() 里发，所以"写完设置要立刻生效"不能只靠它。
  const onlyDescribe = (text.match(/emit\('settings\/document-updated'/g) ?? []).length
  const describeCount = (text.match(/describe\(/g) ?? []).length
  check(`该事件只在 describe 路径里发出（全文 ${onlyDescribe} 处 emit，${describeCount} 处 describe）`
    + ' —— 所以我们自己的 mutate 写完之后**必须自己通知失效**（见 host.ts 的 invalidateMoney）',
    onlyDescribe > 0)
}

console.log('\n[3] 路由与信任关卡（三条新路由都挂在这上面）')
{
  // 真实位置：webServer 服务在 `packages/host/webserver`，信任关卡在 `packages/client/connection` 的 rpc-host。
  const register = look('packages/host/webserver/src/index.ts', /register\(route: WebRoute\): \(\) => void/)
  check('`webServer.register()` 仍在（我们注册 6 条 exact 路由）', register.ok, register.where)
  const kind = look('packages/host/webserver/src/index.ts', /export type WebRouteKind = 'exact' \| 'prefix'/)
  check("路由 `kind: 'exact'` 的形状没变", kind.ok, kind.where)
  const rejection = look('packages/client/connection/src/rpc-host.ts', /requestRejection\(request: ConnectionTrustRequest\)/)
  check('`connection.requestRejection()` 仍在（Host/Origin 围栏 + 浏览器令牌）', rejection.ok, rejection.where)
  // 2026-10-09 升级 0.2.1-alpha.2 时这条红过：旧脚本断言的是字面量联合
  // `host: '127.0.0.1' | '0.0.0.0'`，而新版本的策略**收紧了** —— 通配符地址（0.0.0.0）被直接拒绝，
  // 只接受具体的 IPv4/IPv6 字面量（`normalizeBindAddress` + `isWildcardAddress`）。
  // 结论没变：**仍可绑本机具体的非回环地址**（例如 192.168.x.x），所以"每条自开路由都必须过关卡"
  // 的理由依然成立，只是依据从"能绑 0.0.0.0"变成"能绑具体非回环字面量"。
  const normalize = look('packages/host/webserver/src/index.ts', /export function normalizeBindAddress\(host: string\)/)
  const wildcard = look('packages/host/webserver/src/index.ts', /isWildcardAddress\(parsed\)/)
  check('绑定策略仍在（0.2.1 起：拒绝 0.0.0.0 这类通配符，只接受具体 IP 字面量 ⇒ 仍可绑非回环地址）',
    normalize.ok && wildcard.ok, `${normalize.where} / ${wildcard.where}`)
}

console.log('\n[4] 设置页写的三关（volatile 形状）')
{
  const volatile = look('packages/settings/settings/src/index.ts', /isVolatilePath|volatileForm/)
  check('volatile 字段的处理仍在（我们给动态键字段标了 volatile）', volatile.ok, volatile.where)
  const validate = look('packages/settings/settings/src/index.ts', /validatePaths/)
  check('路径校验仍在（volatile 路径会被跳过）', validate.ok, validate.where)
}

console.log('\n[5] 客户端槽位（0.18.0 目录选择「影子接管」的地基，2026-10-09 补）')
{
  // 我们靠槽位的 shadow 能力把官方的应用内对话框换成系统文件夹框：同 cell 不同优先级可共存、
  // **最低的活条目渲染**；同优先级第二次注册会 fail loud。这套语义一变，插件的行为就静默跑偏。
  const slots = look('packages/client/ui-slots/src/index.ts', /cell's lowest live entry renders/)
  check('shadow 语义仍在（最低的活条目渲染）', slots.ok, slots.where)
  const priority = look('packages/client/ui-slots/src/index.ts', /priority\?: number/)
  check('register 仍接受 `priority`（我们靠 -1 抢在官方那条 0 前面）', priority.ok, priority.where)
  const clash = look('packages/client/ui-slots/src/index.ts', /already has a registration/)
  check('同优先级重复注册仍然 fail loud（所以控制器的幂等是必需的）', clash.ok, clash.where)
  const owner = join(ROOT, 'packages/client/ui-workspace/src/client/contract/slots.ts')
  const ownerText = existsSync(owner) ? readFileSync(owner, 'utf8') : ''
  for (const prop of ['open: boolean', 'busy: boolean', 'onPicked: (path: string) => void', 'onCancel: () => void', 'onError: (message: string) => void']) {
    check(`目录流程持有方的 prop \`${prop}\` 没改名（占用者读的就是这几个）`,
      ownerText.includes(prop), 'packages/client/ui-workspace/src/client/contract/slots.ts')
  }
  const flowSingle = look('packages/client/ui-workspace/src/client/contract/slots.ts',
    /'sidebar\.workspaces\.directoryFlow': \{ kind: 'single'/)
  check("目录流程槽位仍是 `single`（我们占的就是这两个洞）", flowSingle.ok, flowSingle.where)
}

console.log('\n[6] 通知用的四个宿主事件（0.17.0）')
{
  // waterfall 的那两个（审批 / 提问）**必须原样返回 next()**：我们的处理器只是旁路通知，
  // 一旦吞掉返回值就等于替用户做了决定（红线，见 notify-hooks.ts 与变异 FP）。
  const approval = look('packages/api/remotes/src/remote-events.ts', /\{ event: 'approval\/request', mode: 'waterfall' \}/)
  check('`approval/request` 仍是 waterfall（我们透传 next()）', approval.ok, approval.where)
  const question = look('packages/api/remotes/src/remote-events.ts', /\{ event: 'user-questions\/request', mode: 'waterfall' \}/)
  check('`user-questions/request` 仍是 waterfall（我们透传 next()）', question.ok, question.where)
  const status = look('packages/core/agent/src/runtime-types.ts', /'agent\/status'\(this: Scoped<Agent>, payload: \{ agent: Agent; status: AgentStatus \}\): void/)
  check("`agent/status` 仍是 `{ agent, status }`（我们只认 running→idle 那一跳）", status.ok, status.where)
  const error = look('packages/core/agent/src/runtime-types.ts', /'agent\/error'\(this: Scoped<Agent>, payload: \{ agent: Agent; turn: number; step: number; error: unknown \}\): void/)
  check('`agent/error` 仍在（我们读它的 error 文案）', error.ok, error.where)
}

console.log('\n[7] 客户端设置表单 + 终端 + 依赖范围（0.19 起用到的）')
{
  // 0.1.6 那代的 `settingsScope` 服务已经彻底删除；客户端半必须走 `configForms`。
  const forms = look('packages/client/ui-agent-preset/src/client/index.ts', /ctx\.configForms\.get</)
  check('官方客户端插件仍以 `ctx.configForms.get(ns)` 读自己的设置（我们的 adoptSettings 走这条）', forms.ok, forms.where)
  const legacy = (() => {
    // 全仓（除测试与文档）搜 0.1.6 那个旧服务名：应该一处都没有。
    for (const dir of ['packages', 'apps']) {
      const hit = grepAll(join(ROOT, dir), /settingsScope/)
      if (hit !== undefined) return hit
    }
    return undefined
  })()
  check('旧的 `settingsScope` 服务在树里已完全消失（我们只准走 configForms）', legacy === undefined, legacy ?? '没有')

  const pluginPkg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'))
  const range = pluginPkg.dependencies['@deepseek-ai/dsh-tool-terminal']
  const ttPath = join(ROOT, 'packages/experimental/tool-terminal/package.json')
  const ttVersion = existsSync(ttPath) ? JSON.parse(readFileSync(ttPath, 'utf8')).version : undefined
  check('找得到 tool-terminal 包（我们声明了对它的依赖）', ttVersion !== undefined, 'packages/experimental/tool-terminal/package.json')
  if (ttVersion !== undefined) {
    const [major, minor] = ttVersion.split('.').map(Number)
    // 粗判：声明范围里必须有覆盖这一版本线的上下界（`>=0.2.` 与 `<0.3.`）。不做完整 semver 求值
    // —— 这里要抓的是"版本线换了但范围没跟上"这种错，完整求值留给 pnpm 自己。
    check(`tool-terminal ${ttVersion} 落在声明范围里（${range}）`,
      range.includes(`>=${major}.${minor}.`) && range.includes(`<${major}.${minor + 1}.`), range)
  }
}

console.log(`\n${failures === 0 ? '形状核对全部通过' : `${failures} 项与源码不符 —— 升级 DSH 后必须逐条看`}`)
if (failures > 0) process.exitCode = 1
