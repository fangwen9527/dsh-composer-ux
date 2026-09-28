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
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

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
  const listeners = look('packages/host/webserver/src/index.ts', /host: '127\.0\.0\.1' \| '0\.0\.0\.0'/)
  check('连接能绑到非回环地址（这就是每条路由都必须过关卡的原因）', listeners.ok, listeners.where)
}

console.log('\n[4] 设置页写的三关（volatile 形状）')
{
  const volatile = look('packages/settings/settings/src/index.ts', /isVolatilePath|volatileForm/)
  check('volatile 字段的处理仍在（我们给动态键字段标了 volatile）', volatile.ok, volatile.where)
  const validate = look('packages/settings/settings/src/index.ts', /validatePaths/)
  check('路径校验仍在（volatile 路径会被跳过）', validate.ok, validate.where)
}

console.log(`\n${failures === 0 ? '形状核对全部通过' : `${failures} 项与源码不符 —— 升级 DSH 后必须逐条看`}`)
if (failures > 0) process.exitCode = 1
