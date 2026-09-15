/**
 * 快捷指令全局存储（$DSH_HOME/quick-prompts.json）的护栏测试。
 *
 * 全部通过**真实路由**驱动 `lib/index.js`（假 ctx + 假 settings），文件落在临时
 * DSH_HOME 里，断言直接看磁盘上的内容——因为这次改动的价值就在「磁盘上的行为」：
 *
 *  1. 原子写：不留 .tmp、失败不产生半截文件；
 *  2. 坏文件**隔离而不是清空**（参考实现会在这一步静默返回空列表，用户一保存就丢数据）；
 *  3. 迁移只跑一次，且旧值保留；
 *  4. 并发写不会互相截断；
 *  5. 字段映射与参考实现互认（title/text/autoSend/order ↔ label/prompt/always）；
 *  6. v1 平铺与裸数组都能升级；
 *  7. **4000 字以上的提示词不再被截断**（这是把存储搬出设置文档的直接收益）。
 *
 *   node test/quick-store.mjs
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'esbuild'
import { apply } from '../lib/index.js'

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

/**
 * 兜底：变异测试（故意把 bug 放回去）时，断言链可能取到 undefined 而抛错。
 * 抛错要记成一条 ✗ 并正常收尾——**崩溃不是合格的失败报告**。
 */
function bail(error) {
  failures += 1
  console.log(`  ✗ 测试脚本抛异常: ${error && error.message}`)
  console.log(`\n${passes} passed, ${failures} failed`)
  process.exit(1)
}
process.on('uncaughtException', bail)
process.on('unhandledRejection', bail)

// ── 现场打包纯函数出口（只取常量与纯净化函数） ──────────────────────────────
await build({
  entryPoints: ['test/pure-entry.ts'],
  outfile: 'test/.build/pure-store.mjs',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['es2022'],
  logLevel: 'warning',
})
const pure = await import(new URL('./.build/pure-store.mjs', import.meta.url))

/** 每个用例一个干净的临时 DSH_HOME，测完删掉。 */
const homes = []
function tempHome(label) {
  const dir = mkdtempSync(join(tmpdir(), `dsh-qp-${label}-`))
  homes.push(dir)
  return dir
}

/** 造一个假宿主 ctx 并启动插件；返回按路径取到的存储路由。 */
async function boot(home, legacy) {
  process.env.DSH_HOME = home
  const routes = []
  const ns = { enabled: true }
  if (legacy !== undefined) ns[pure.QUICK_PROMPTS_FIELD ?? 'quickPrompts'] = legacy
  const settings = { get: name => (name === 'composer-ux' ? ns : undefined), register: () => {}, mutate: async () => {} }
  const services = {
    settings,
    webServer: { register: route => { routes.push(route); return () => {} } },
    effect: (fn) => { const dispose = fn(); return () => { if (typeof dispose === 'function') dispose() } },
    get: name => services[name],
  }
  const ctx = {
    inject: (deps, callback) => { if (deps.every(dep => services[dep] !== undefined)) callback(services) },
    effect: services.effect,
    on: () => {},
  }
  apply(ctx)
  await new Promise(resolve => { setTimeout(resolve, 15) })
  return {
    route: routes.find(item => item.path === pure.QUICK_PROMPTS_API_PATH),
    routes,
  }
}

function makeReq(method, body) {
  return {
    method,
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield Buffer.from(body, 'utf8')
    },
  }
}
function makeRes() {
  const captured = { status: 0, body: '' }
  return { captured, writeHead(code) { captured.status = code }, end(body) { captured.body = body } }
}
const jsonOf = res => JSON.parse(res.captured.body)
const fileIn = home => join(home, 'quick-prompts.json')
const readJson = path => JSON.parse(readFileSync(path, 'utf8'))
const callGet = async (host) => { const res = makeRes(); await host.route.handler(makeReq('GET'), res); return { res, body: jsonOf(res) } }
const callPost = async (host, payload) => {
  const res = makeRes()
  await host.route.handler(makeReq('POST', JSON.stringify(payload)), res)
  return { res, body: jsonOf(res) }
}
const tmpSiblings = home => readdirSync(home).filter(name => name.endsWith('.tmp'))
const badSiblings = home => readdirSync(home).filter(name => name.includes('.bad-'))

// ══════════════ 1. 路由与首次迁移 ═══════════════════════════════════════════
console.log('1. 路由注册与首次迁移')
{
  const home = tempHome('migrate')
  const legacy = [
    { id: 'builtin-1', label: '一问一答', prompt: '你不懂的就问我，一问一答。', always: false },
    { id: 'qp-x', label: '环境避坑', prompt: '中文不进命令行。', always: false },
  ]
  const host = await boot(home, legacy)
  check('注册了存储路由且 kind=exact', host.route !== undefined && host.route.kind === 'exact', JSON.stringify(host.routes.map(r => `${r.path}:${r.kind}`)))
  check('路由路径与契约一致', host.route.path === pure.QUICK_PROMPTS_API_PATH, host.route.path)
  check('迁移前磁盘上没有文件', !existsSync(fileIn(home)))

  const { body } = await callGet(host)
  check('GET → ok:true', body.ok === true, JSON.stringify(body).slice(0, 200))
  check('GET 回报文件路径', body.file === fileIn(home), body.file)
  check('迁移出一个默认分类', body.book.categories.length === 1 && body.book.categories[0].name === pure.DEFAULT_CATEGORY_NAME)
  check('旧列表 2 条都搬进来了', body.book.categories[0].prompts.map(p => p.id).join(',') === 'builtin-1,qp-x', JSON.stringify(body.book.categories[0].prompts.map(p => p.id)))
  check('落盘文件已存在', existsSync(fileIn(home)))
  check('落盘不留 .tmp', tmpSiblings(home).length === 0, tmpSiblings(home).join(','))

  // 迁移只跑一次：改动文件后再 GET，内容必须保持我改的
  const onDisk = readJson(fileIn(home))
  onDisk.categories.push({ id: 'qc-later', name: '后来加的', prompts: [{ id: 'p1', title: 'T', text: 'X', autoSend: false, order: 1 }] })
  writeFileSync(fileIn(home), JSON.stringify(onDisk, null, 2), 'utf8')
  const second = await callGet(host)
  check('再次 GET 不会重跑迁移（尊重磁盘现状）', second.body.book.categories.length === 2, JSON.stringify(second.body.book.categories.map(c => c.name)))
}

// ══════════════ 2. 文件字段名（与参考实现互认） ═════════════════════════════
console.log('2. 字段映射：内部 label/prompt/always ↔ 文件 title/text/autoSend/order')
{
  const home = tempHome('map')
  const host = await boot(home, undefined)
  const book = {
    version: 2,
    categories: [{
      id: 'qc-a',
      name: '我的',
      prompts: [
        { id: 'p2', label: '第二条', prompt: 'B', always: true },
        { id: 'p1', label: '第一条', prompt: 'A', always: false },
      ],
    }],
  }
  const { body } = await callPost(host, { book })
  check('POST → ok:true', body.ok === true, JSON.stringify(body).slice(0, 200))
  const onDisk = readJson(fileIn(home))
  const rows = onDisk.categories[0].prompts
  check('文件用参考实现的字段名', rows[0].title === '第二条' && rows[0].text === 'B' && rows[0].autoSend === true, JSON.stringify(rows[0]))
  check('文件带 order（1 起、跟随数组顺序）', rows[0].order === 1 && rows[1].order === 2, rows.map(r => r.order).join(','))
  check('文件里没有内部字段名', rows[0].label === undefined && rows[0].prompt === undefined && rows[0].always === undefined)
  check('分类名写在 name 上', onDisk.categories[0].name === '我的')

  // 反向：读一个「参考实现风格」的文件，order 乱序 → 应按 order 排好
  writeFileSync(fileIn(home), JSON.stringify({
    version: 2,
    categories: [{ id: 'c1', name: '默认', prompts: [
      { id: 'z', title: '后', text: '第二', autoSend: true, order: 9 },
      { id: 'a', title: '前', text: '第一', autoSend: false, order: 2 },
    ] }],
  }, null, 2), 'utf8')
  const readBack = await callGet(host)
  const prompts = readBack.body.book.categories[0].prompts
  check('按 order 升序读回', prompts.map(p => p.id).join(',') === 'a,z', JSON.stringify(prompts.map(p => p.id)))
  check('autoSend → always 映射正确', prompts[1].always === true && prompts[0].always === false)
}

// ══════════════ 3. 坏文件隔离（关键：绝不清空） ═════════════════════════════
console.log('3. 坏文件：隔离而不是清空')
{
  const home = tempHome('broken')
  const host = await boot(home, undefined)
  const brokenText = '{ "version": 2, "categories": [ { "id": "c1", "name": "重要"'
  writeFileSync(fileIn(home), brokenText, 'utf8')

  const { res, body } = await callGet(host)
  check('GET 仍是 HTTP 200（不炸路由）', res.captured.status === 200, String(res.captured.status))
  check('但 ok:false 并说明原因', body.ok === false && /读不了/.test(body.error), JSON.stringify(body).slice(0, 200))
  check('报出隔离后的路径', typeof body.quarantined === 'string' && body.quarantined.includes('.bad-'), body.quarantined)
  check('原文件已被改名（不再躺在原处）', !existsSync(fileIn(home)))
  const bad = badSiblings(home)
  const badText = bad.length === 1 ? readFileSync(join(home, bad[0]), 'utf8') : ''
  check('坏文件内容**原样保留**在 .bad- 里', bad.length === 1 && badText === brokenText, bad.join(','))

  // 修复：把好内容写回原路径后必须能读
  writeFileSync(fileIn(home), JSON.stringify({ version: 2, categories: [{ id: 'c1', name: '修好了', prompts: [{ id: 'p', title: 't', text: 'x', autoSend: false, order: 1 }] }] }), 'utf8')
  const fixed = await callGet(host)
  check('修好文件后恢复正常', fixed.body.ok === true && fixed.body.book.categories[0].name === '修好了', JSON.stringify(fixed.body).slice(0, 160))
}
{
  const home = tempHome('shape')
  const host = await boot(home, undefined)
  writeFileSync(fileIn(home), JSON.stringify({ hello: 'world' }), 'utf8')
  const { body } = await callGet(host)
  check('认不出的结构也当损坏（不当空本）', body.ok === false && /结构认不出/.test(body.error), JSON.stringify(body).slice(0, 160))
  check('认不出时也不写入', !existsSync(fileIn(home)))
}
{
  const home = tempHome('emptyfile')
  const host = await boot(home, undefined)
  writeFileSync(fileIn(home), '', 'utf8')
  const { body } = await callGet(host)
  check('空文件也当损坏（不当空本）', body.ok === false, JSON.stringify(body).slice(0, 160))
}

// ══════════════ 4. v1 平铺 / 裸数组升级 ═════════════════════════════════════
console.log('4. v1 数据升级')
{
  const home = tempHome('v1')
  const host = await boot(home, undefined)
  writeFileSync(fileIn(home), JSON.stringify({ prompts: [{ id: 'a', title: '旧甲', text: '甲', autoSend: true }, { id: 'b', title: '旧乙', text: '乙' }] }), 'utf8')
  const { body } = await callGet(host)
  check('{prompts:[...]} 升成一个默认分类', body.ok === true && body.book.categories.length === 1 && body.book.categories[0].name === pure.DEFAULT_CATEGORY_NAME, JSON.stringify(body.book).slice(0, 200))
  check('两条都在、autoSend 映射过来', body.book.categories[0].prompts.map(p => `${p.id}:${String(p.always)}`).join(',') === 'a:true,b:false')
}
{
  const home = tempHome('bare')
  const host = await boot(home, undefined)
  writeFileSync(fileIn(home), JSON.stringify([{ id: 'a', title: '甲', text: '甲' }]), 'utf8')
  const { body } = await callGet(host)
  check('裸数组也能读', body.ok === true && body.book.categories[0].prompts.length === 1, JSON.stringify(body).slice(0, 160))
}

// ══════════════ 5. 不截断长提示词（本次改动的直接收益） ═════════════════════
console.log('5. 长提示词不再被截断')
{
  const home = tempHome('long')
  const host = await boot(home, undefined)
  const long = '长'.repeat(5000)
  const { body } = await callPost(host, { book: { categories: [{ id: 'c', name: '默认', prompts: [{ id: 'p', label: '长文', prompt: long, always: false }] }] } })
  check('POST 长文成功', body.ok === true, JSON.stringify(body).slice(0, 160))
  check('回读长度不缩水', body.book.categories[0].prompts[0].prompt.length === 5000, String(body.book.categories[0].prompts[0].prompt.length))
  const diskText = readJson(fileIn(home)).categories[0].prompts[0].text
  check('磁盘上也是 5000 字', diskText.length === 5000, String(diskText.length))
  const again = await callGet(host)
  check('再次读取仍是 5000 字', again.body.book.categories[0].prompts[0].prompt.length === 5000)
}

// ══════════════ 6. 收窄与合法边界 ═══════════════════════════════════════════
console.log('6. 收窄边界')
{
  const home = tempHome('shape2')
  const host = await boot(home, undefined)
  const empty = await callPost(host, { book: { categories: [] } })
  check('空本（categories: []）是合法状态', empty.body.ok === true && empty.body.book.categories.length === 0, JSON.stringify(empty.body).slice(0, 160))
  const reread = await callGet(host)
  check('空本能往返（不会被当成损坏）', reread.body.ok === true && reread.body.book.categories.length === 0)

  const bad = await callPost(host, { hello: 'world' })
  check('POST 认不出的结构 → 400', bad.res.captured.status === 400, String(bad.res.captured.status))

  const notJson = makeRes()
  await host.route.handler(makeReq('POST', '{ oops'), notJson)
  check('POST 非法 JSON → 400', notJson.captured.status === 400, String(notJson.captured.status))

  const del = makeRes()
  await host.route.handler(makeReq('DELETE'), del)
  check('DELETE → 405', del.captured.status === 405, String(del.captured.status))

  const dup = await callPost(host, { book: { categories: [
    { id: 'same', name: '甲', prompts: [{ id: 'p', label: 'l', prompt: 'x', always: false }] },
    { id: 'same', name: '乙', prompts: [{ id: 'p', label: 'l', prompt: 'y', always: false }] },
  ] } })
  check('重复 id 会被重新分配（分类与条目各去重）', dup.body.book.categories.length === 2 && dup.body.book.categories[0].id !== dup.body.book.categories[1].id, JSON.stringify(dup.body.book.categories.map(c => c.id)))

  const blank = await callPost(host, { book: { categories: [{ id: 'c', name: '空分类', prompts: [] }] } })
  check(
    '空分类被保留（面板「＋」新建后、还没放条目的中间态）',
    blank.body.book.categories.length === 1 && blank.body.book.categories[0].prompts.length === 0,
    JSON.stringify(blank.body.book.categories),
  )
  const blankAgain = await callGet(host)
  check('空分类能往返（不会被二次丢掉）', blankAgain.body.book.categories.length === 1, JSON.stringify(blankAgain.body.book.categories.map(c => c.name)))
}

// ══════════════ 7. 并发写 ═══════════════════════════════════════════════════
console.log('7. 并发写不互相截断')
{
  const home = tempHome('concurrent')
  const host = await boot(home, undefined)
  const makeBook = (tag) => ({ book: { categories: [{ id: `c-${tag}`, name: tag, prompts: [{ id: `p-${tag}`, label: tag, prompt: tag.repeat(2000), always: false }] }] } })
  const results = await Promise.all(['a', 'b', 'c', 'd'].map(tag => callPost(host, makeBook(tag))))
  check('四个并发写都成功', results.every(r => r.body.ok === true), results.map(r => r.body.ok).join(','))
  const onDisk = readJson(fileIn(home))
  check('最终文件是**某一个**完整本（不是混合体）', onDisk.categories.length === 1 && ['a', 'b', 'c', 'd'].includes(onDisk.categories[0].name), JSON.stringify(onDisk.categories.map(c => c.name)))
  check('并发写后没有残留 .tmp', tmpSiblings(home).length === 0, tmpSiblings(home).join(','))
  check('并发写后没有残留 .lock', !existsSync(`${fileIn(home)}.lock`))
}

// ══════════════ 8. 写锁：遗留锁要报错而不是抢占 ═════════════════════════════
console.log('8. 遗留写锁')
{
  const home = tempHome('lock')
  const host = await boot(home, undefined)
  // 先正常写一次，确保文件存在
  await callPost(host, { book: { categories: [{ id: 'c', name: '默认', prompts: [{ id: 'p', label: 'l', prompt: 'x', always: false }] }] } })
  // 造一个「很久以前」的锁文件
  writeFileSync(`${fileIn(home)}.lock`, 'stale', 'utf8')
  const past = Date.now() / 1000 - 120
  const { utimesSync } = await import('node:fs')
  utimesSync(`${fileIn(home)}.lock`, past, past)
  const { res, body } = await callPost(host, { book: { categories: [] } })
  check('遗留锁 → 500 并说明处置办法', res.captured.status === 500 && /锁/.test(body.error), JSON.stringify(body).slice(0, 200))
  check('遗留锁不会被自动删除（交给操作者）', existsSync(`${fileIn(home)}.lock`))
  check('拒绝写入时原文件未被改动', readJson(fileIn(home)).categories.length === 1)
}

// ══════════════ 9. 原子写的实现形状 ═════════════════════════════════════════
//
// 「写到一半断电」在测试里造不出来，所以这一节不测行为，改成**盯住实现**：
// 一旦有人把它改回 `writeFile(file, ...)` 直接覆盖，或者把「读不懂」改回返回空本，
// 这里必须变红。（行为侧的护栏见第 3、7 节。）
console.log('9. 原子写的实现形状')
{
  const src = readFileSync(new URL('../src/quick-store.ts', import.meta.url), 'utf8')
  check('先写临时文件，再 rename 提交', /const tmp = `\$\{file\}\./.test(src) && /await rename\(tmp, file\)/.test(src))
  check('rename 之前 fsync（否则断电仍可能丢内容）', /handle\.sync\(\)/.test(src))
  check('写入发生在持锁之后', /await acquireLock\(file\)[\s\S]{0,120}writeLocked\(/.test(src))
  check('迁移在锁内复核（并发首写不覆盖彼此）', /await acquireLock\(file\)[\s\S]{0,200}again = await readQuickBook/.test(src))
  check(
    '读不懂时**不允许**返回空本（参考实现的丢数据写法）',
    // 写成语义而不是精确代码形状：精确匹配会被格式变动悄悄搞死
    // （这种「永不报警的死护栏」用变异测试才能发现）。
    !/catch[\s\S]{0,200}?kind: 'ok'/.test(src),
  )
  check('坏文件走隔离而不是删除', /await quarantine\(file\)/.test(src) && !/unlink\(file\)/.test(src))

  // 接缝护栏：防止以后有人**部分**回退到旧存储——那会让「界面读的」和「盘上存的」
  // 悄悄分家：面板还能显示，但保存进的是没人读的那份。
  const clientSrc = readFileSync(new URL('../src/client.tsx', import.meta.url), 'utf8')
  const panelSrc = readFileSync(new URL('../src/client/QuickCommandsPanel.tsx', import.meta.url), 'utf8')
  const sectionSrc = readFileSync(new URL('../src/client/SettingsSection.tsx', import.meta.url), 'utf8')
  check(
    '拦截器拿到的是跨分类的 always 取值函数（不是设置里的旧字段）',
    /alwaysPrompts:\s*\(\)\s*=>\s*alwaysQuickPrompts\(book\.getSnapshot\(\)\)/.test(clientSrc),
  )
  check('面板已不再从设置里读条目列表', !/settings\.quickPrompts/.test(panelSrc))
  check('设置页已不再写旧的 quickPrompts 设置字段', !/setField\(QUICK_PROMPTS_FIELD/.test(sectionSrc))
  check('设置页的保存走整本写回', /actions\.saveBook\(/.test(sectionSrc))
}

// ══════════════ 10. 客户端纯编辑函数（不可变） ═══════════════════════════════
//
// 面板与设置页改的都是这套函数；它们必须**不可变**（返回新本、不动入参），
// 否则 React 快照不会更新、乐观更新也会把上一份数据改坏。
console.log('10. 客户端编辑函数（不可变）与跨分类语义')
{
  const base = pure.defaultQuickBook()
  const first = base.categories[0].id
  const firstCount = base.categories[0].prompts.length

  const added = pure.withCategoryAdded(base, '工作')
  check('加分类', added.categories.length === 2 && added.categories[1].name === '工作', JSON.stringify(added.categories.map(c => c.name)))
  check('加分类不改原本', base.categories.length === 1)

  const renamed = pure.withCategoryRenamed(base, first, '  我的  ')
  check('分类改名去空白', renamed.categories[0].name === '我的', renamed.categories[0].name)
  check('空白分类名回落默认名', pure.withCategoryRenamed(base, first, '   ').categories[0].name === pure.DEFAULT_CATEGORY_NAME)

  const two = pure.withCategoryAdded(added, '生活')
  const swapped = pure.withCategoryMoved(two, two.categories[2].id, -1)
  check('分类换位', swapped.categories[1].name === '生活', swapped.categories.map(c => c.name).join(','))
  check('越界换位原样返回', pure.withCategoryMoved(two, two.categories[0].id, -1) === two)

  const removed = pure.withCategoryRemoved(two, two.categories[1].id)
  check('删分类连带它的条目', removed.categories.length === 2 && removed.categories[0].prompts.length === firstCount, JSON.stringify(removed.categories.map(c => `${c.name}:${String(c.prompts.length)}`)))

  const withNew = pure.withPromptAdded(base, first)
  check('加条目（新条目在末尾）', withNew.categories[0].prompts.length === firstCount + 1)
  check('加条目不改原本', base.categories[0].prompts.length === firstCount)

  const target = base.categories[0].prompts[0].id
  const patched = pure.withPromptPatched(base, first, target, { prompt: '改了', label: '改了名' })
  check('改条目字段', patched.categories[0].prompts[0].prompt === '改了' && patched.categories[0].prompts[0].label === '改了名')
  check('改条目不改原本', base.categories[0].prompts[0].prompt !== '改了')

  const moved = pure.withPromptMoved(base, first, target, 1)
  check('条目换位', moved.categories[0].prompts[1].id === target, JSON.stringify(moved.categories[0].prompts.map(p => p.id)))
  check('越界条目换位原样返回', pure.withPromptMoved(base, first, target, -1) === base)

  const removedPrompt = pure.withPromptRemoved(base, first, target)
  check('删条目', removedPrompt.categories[0].prompts.length === firstCount - 1)

  // 跨分类是本特性的关键语义：勾选按 id 找（面板里不带分类上下文），
  // 聚合要覆盖所有分类（发送时自动附加的依据）。
  const spread = pure.withPromptAdded(two, two.categories[1].id)
  const foreign = spread.categories[1].prompts[0].id
  const toggled = pure.withAlwaysToggled(spread, foreign, true)
  check('按 id 跨分类勾选「默认插入」', toggled.categories[1].prompts[0].always === true)
  check('勾选不改原本', spread.categories[1].prompts[0].always === false)

  const book2 = {
    version: 2,
    categories: [
      { id: 'a', name: 'A', prompts: [{ id: 'p1', label: '一', prompt: 'x', always: true }] },
      { id: 'b', name: 'B', prompts: [{ id: 'p2', label: '二', prompt: 'y', always: false }, { id: 'p3', label: '三', prompt: 'z', always: true }] },
    ],
  }
  check('always 聚合覆盖所有分类', pure.alwaysQuickPrompts(book2).map(p => p.id).join(',') === 'p1,p3', pure.alwaysQuickPrompts(book2).map(p => p.id).join(','))
  check('拍平覆盖所有分类', pure.flattenQuickPrompts(book2).length === 3)
  const counts = pure.bookCounts(book2)
  check('计数正确', counts.categories === 2 && counts.prompts === 3 && counts.always === 2, JSON.stringify(counts))
  check('按 id 找条目能报出所属分类', pure.findPrompt(book2, 'p3')?.category.id === 'b')
}

// ── 收尾 ────────────────────────────────────────────────────────────────────
delete process.env.DSH_HOME
for (const dir of homes) rmSync(dir, { recursive: true, force: true })
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
