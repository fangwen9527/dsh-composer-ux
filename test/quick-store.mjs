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
 * 剥掉注释再匹配：护栏盯的必须是**代码**。
 *
 * 教训（0.4.0 当场踩到两次）：护栏匹配到注释里的字眼就会误报——先是面板里过时的注释
 * 命中「默认插入」，接着修完「仅首次」后，我在说明里写的 `always === true` 又把新护栏
 * 弄红了。注释里必须能自由记录踩过的坑，所以统一先剥注释。
 * @param src - 源文件全文。
 * @returns 去掉了块注释与行注释的文本（字符串里的 `//` 可能被误伤，本仓用不到那种写法）。
 */
function codeOnly(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
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
    '拦截器拿到的批次由 appendBatchForSend 决定（「仅首次」的判据在里面）',
    /promptsForSend:\s*\(\)\s*=>\s*appendBatchForSend\(book\.getSnapshot\(\),\s*currentBlankSession\(\)\)/.test(clientSrc),
    'client.tsx 里应把 promptsForSend 接到 appendBatchForSend(book, currentBlankSession())',
  )
  check('面板已不再从设置里读条目列表', !/settings\.quickPrompts/.test(panelSrc))
  check('设置页已不再写旧的 quickPrompts 设置字段', !/setField\(QUICK_PROMPTS_FIELD/.test(sectionSrc))
  check('设置页的保存走整本写回', /actions\.saveBook\(/.test(sectionSrc))

  // 0.4.0 的回归点：批次算对了，却在「写回编辑器」那一步被按插入模式**又过滤一遍**，
  // 于是新会话第一条里只剩「每次」的。这里钉住两件事：写回处原样用这一批，
  // 以及 quick-commands.ts 里不再存在第二处模式判断。
  const adaptSrc = codeOnly(readFileSync(new URL('../src/client/interceptors.ts', import.meta.url), 'utf8'))
  const qcSrc = codeOnly(readFileSync(new URL('../src/client/quick-commands.ts', import.meta.url), 'utf8'))
  check(
    '写回那一步原样使用 promptsForSend() 给的批次（未再过滤）',
    /applyPromptsForSend\(deps\.promptsForSend\(\)\)/.test(adaptSrc),
    'interceptors.ts 里应调用 applyPromptsForSend(deps.promptsForSend())',
  )
  check(
    '写回路径里不存在按插入模式的二次过滤',
    // 语义形态而不是精确代码形状：只要这里出现对 always / firstOnly 的判断，就是回退。
    !/always\s*===\s*true/.test(qcSrc) && !/firstOnly\s*===\s*true/.test(qcSrc),
    'quick-commands.ts 不得再按 always/firstOnly 过滤（该有谁已由 appendBatchForSend 决定）',
  )
  check(
    '客户端两处都不再引用旧设置字段（0.3.0 搬家时留下的死导入已清）',
    !codeOnly(clientSrc).includes('QUICK_PROMPTS_FIELD') && !codeOnly(sectionSrc).includes('QUICK_PROMPTS_FIELD'),
    'client.tsx 与 SettingsSection.tsx 里不应再出现 QUICK_PROMPTS_FIELD（只有宿主半的迁移种子读它）',
  )
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

// ══════════════ 11. 跨分类移动条目（「＋ → 移动到这里」） ════════════════════
console.log('11. 跨分类移动条目')
{
  const two = {
    version: 2,
    categories: [
      { id: 'a', name: '甲', prompts: [
        { id: 'p1', label: '一', prompt: 'X', always: true },
        { id: 'p2', label: '二', prompt: 'Y', always: false },
      ] },
      { id: 'b', name: '乙', prompts: [
        { id: 'p3', label: '三', prompt: 'Z', always: false },
      ] },
    ],
  }

  const moved = pure.withPromptMovedToCategory(two, 'p1', 'b')
  check('源分类里移除了它', moved.categories[0].prompts.map(p => p.id).join(',') === 'p2', JSON.stringify(moved.categories[0].prompts.map(p => p.id)))
  check('目标分类追加到**末尾**', moved.categories[1].prompts.map(p => p.id).join(',') === 'p3,p1', JSON.stringify(moved.categories[1].prompts.map(p => p.id)))
  const carried = moved.categories[1].prompts[1]
  check('搬的是同一条（id / 正文 / 默认插入都跟着走）', carried.id === 'p1' && carried.prompt === 'X' && carried.always === true, JSON.stringify(carried))
  check('不可变：原对象没被改', two.categories[0].prompts.length === 2 && two.categories[1].prompts.length === 1)

  check('目标就是源分类 → 原样返回', pure.withPromptMovedToCategory(two, 'p1', 'a') === two)
  check('条目不存在 → 原样返回', pure.withPromptMovedToCategory(two, 'nope', 'b') === two)
  check('目标分类不存在 → 原样返回', pure.withPromptMovedToCategory(two, 'p1', 'nope') === two)

  const single = {
    version: 2,
    categories: [
      { id: 'a', name: '甲', prompts: [{ id: 'p', label: 'l', prompt: 't', always: false }] },
      { id: 'b', name: '乙', prompts: [{ id: 'q', label: 'l', prompt: 't', always: false }] },
    ],
  }
  const emptied = pure.withPromptMovedToCategory(single, 'p', 'b')
  check('移走最后一条后源分类**留空但不消失**（空分类是合法状态）', emptied.categories.length === 2 && emptied.categories[0].prompts.length === 0)

  const full = {
    version: 2,
    categories: [
      { id: 'a', name: '甲', prompts: [{ id: 'p', label: 'l', prompt: 't', always: false }] },
      { id: 'b', name: '乙', prompts: Array.from({ length: pure.QUICK_PROMPT_MAX }, (_, index) => ({ id: `f${String(index)}`, label: 'l', prompt: 't', always: false })) },
    ],
  }
  check('目标分类已满 → 原样返回（不越界）', pure.withPromptMovedToCategory(full, 'p', 'b') === full)

  const candidates = pure.promptsElsewhere(two, 'a')
  check('候选项只列别的分类', candidates.map(item => `${item.categoryName}:${item.prompt.id}`).join(',') === '乙:p3', JSON.stringify(candidates.map(item => item.prompt.id)))
  check('候选项带来源分类名（菜单上要显示它）', candidates[0].categoryName === '乙')
  check('当前分类的条目不出现在候选里', !candidates.some(item => item.prompt.id === 'p1' || item.prompt.id === 'p2'))

  // 新建出来的条目正文必须非空：空正文会被净化丢掉，而面板的「新建」是立即写盘的，
  // 给空串就会当场消失、看起来像坏掉了。
  const fresh = pure.defaultQuickBook()
  const withNew = pure.withPromptAdded(fresh, fresh.categories[0].id)
  check('新建的条目带非空占位正文（否则写盘时消失）', (withNew.categories[0].prompts.at(-1)?.prompt ?? '').trim() !== '')

  // 接缝：用户明确要求「设置页和面板」两处都有这一行。
  const panelSrc = readFileSync(new URL('../src/client/QuickCommandsPanel.tsx', import.meta.url), 'utf8')
  const sectionSrc = readFileSync(new URL('../src/client/SettingsSection.tsx', import.meta.url), 'utf8')
  check('面板里渲染了这一行，并接上了移动动作', /<AddPromptRow/.test(panelSrc) && /actions\.movePrompt\(/.test(panelSrc))
  check('设置页里渲染了同一行，并接上了移动动作', /<AddPromptRow/.test(sectionSrc) && /withPromptMovedToCategory\(/.test(sectionSrc))
  check('设置页不再留旧的「+ 添加一条」独立按钮', !/添加一条/.test(sectionSrc))
  check('两处用的是同一个组件（行为不会分叉）', /from '\.\/AddPromptRow\.tsx'/.test(panelSrc) && /from '\.\/AddPromptRow\.tsx'/.test(sectionSrc))
}

// ══════════════ 12. 插入模式三选一（关 / 每次 / 仅首次） ═════════════════════
console.log('12. 插入模式（关 / 每次 / 仅首次）')
{
  const promptOf = (always, firstOnly) => ({ always, firstOnly })
  check("两个标志都关 → 'never'", pure.insertModeOf(promptOf(false, false)) === 'never')
  check("只 always → 'always'", pure.insertModeOf(promptOf(true, false)) === 'always')
  check("只 firstOnly → 'first'", pure.insertModeOf(promptOf(false, true)) === 'first')
  check(
    "手改文件把两个都写成 true → 按 'always'（每次都插本来就包含第一次）",
    pure.insertModeOf(promptOf(true, true)) === 'always',
  )

  const book = () => ({
    version: 2,
    categories: [{ id: 'c', name: '默认', prompts: [{ id: 'p', label: 'l', prompt: 't', always: false, firstOnly: false }] }],
  })
  const mode = b => pure.insertModeOf(b.categories[0].prompts[0])

  const asFirst = pure.withInsertMode(book(), 'p', 'first')
  check('设成「仅首次」后 only firstOnly 为真', mode(asFirst) === 'first' && asFirst.categories[0].prompts[0].always === false)
  const asAlways = pure.withInsertMode(asFirst, 'p', 'always')
  check('从「仅首次」切到「每次」：老的标志被清掉（不会两个都真）', mode(asAlways) === 'always' && asAlways.categories[0].prompts[0].firstOnly === false)
  const asNever = pure.withInsertMode(asAlways, 'p', 'never')
  check('切回「关」：两个都清掉', mode(asNever) === 'never' && asNever.categories[0].prompts[0].always === false && asNever.categories[0].prompts[0].firstOnly === false)
  check('模式没变化 → 原样返回（不做无意义写盘）', pure.withInsertMode(asNever, 'p', 'never') === asNever)
  check('条目不存在 → 原样返回', pure.withInsertMode(asNever, 'nope', 'always') === asNever)

  // 文件映射与向后兼容
  const fileRow = pure.bookToFile(asFirst).categories[0].prompts[0]
  check('「仅首次」写进文件是 autoSendFirst（autoSend 仍为 false）', fileRow.autoSend === false && fileRow.autoSendFirst === true, JSON.stringify(fileRow))
  const neverRow = pure.bookToFile(asNever).categories[0].prompts[0]
  check('「关」不写 autoSendFirst 键（文件形状贴近参考实现）', neverRow.autoSendFirst === undefined, JSON.stringify(neverRow))
  const legacy = pure.sanitizeBook({ prompts: [{ id: 'a', title: '旧', text: 'x', autoSend: true }] })
  check('读得懂参考实现的旧文件（autoSend: true → 每次）', pure.insertModeOf(legacy.categories[0].prompts[0]) === 'always')
  const roundTrip = pure.sanitizeBook(pure.bookToFile(asFirst))
  check('「仅首次」能往返（写出去再读回来还是仅首次）', pure.insertModeOf(roundTrip.categories[0].prompts[0]) === 'first')

  // 发送批次：这就是「仅首次」的全部语义
  const batch = {
    version: 2,
    categories: [
      { id: 'a', name: '甲', prompts: [
        { id: 'every', label: '每次', prompt: 'E', always: true, firstOnly: false },
        { id: 'first', label: '仅首次', prompt: 'F', always: false, firstOnly: true },
        { id: 'none', label: '关', prompt: 'N', always: false, firstOnly: false },
      ] },
      { id: 'b', name: '乙', prompts: [
        { id: 'first2', label: '仅首次2', prompt: 'F2', always: false, firstOnly: true },
      ] },
    ],
  }
  check('会话已有消息（blank=false）→ 只带「每次」', pure.appendBatchForSend(batch, false).map(p => p.id).join(',') === 'every')
  check('会话还没有消息（blank=true）→ 「每次」+「仅首次」，跨分类', pure.appendBatchForSend(batch, true).map(p => p.id).join(',') === 'every,first,first2')
  check('「关」的永远不进批次', !pure.appendBatchForSend(batch, true).some(p => p.id === 'none'))
  const bothTrue = { version: 2, categories: [{ id: 'c', name: 'x', prompts: [{ id: 'p', label: 'l', prompt: 't', always: true, firstOnly: true }] }] }
  check('两个标志都为真时只出现一次（不重复附加）', pure.appendBatchForSend(bothTrue, true).length === 1)

  // ★ 端到端：批次算对 ≠ 写进去对。0.4.0 就是在这两步之间丢的「仅首次」，而当时的护栏
  //   只匹配调用处文本，所以全绿。这里跑**拦截器点发送时真正调用的那个函数**
  //   （applyPromptsForSend），断言最终写回编辑器的整段文本。
  const writeSend = (book, blank, draft) => {
    let written = null
    pure.publishInputBridge({
      actions: { setDraft: text => { written = text } },
      draft,
      sessionId: 's-insert-mode-test',
      blank,
    })
    const wrote = pure.applyPromptsForSend(pure.appendBatchForSend(book, blank))
    return { wrote, written }
  }
  const firstSend = writeSend(batch, true, '我的问题')
  check('新会话第一条：写回编辑器的文本里「每次」和「仅首次」都在',
    firstSend.wrote === true && firstSend.written === '我的问题\n\nE\n\nF\n\nF2',
    JSON.stringify(firstSend.written))
  const secondSend = writeSend(batch, false, '我的问题')
  check('第二条起：写回的只有「每次」',
    secondSend.wrote === true && secondSend.written === '我的问题\n\nE',
    JSON.stringify(secondSend.written))
  const onlyFirstBook = {
    version: 2,
    categories: [{ id: 'c', name: 'x', prompts: [
      { id: 'first', label: '仅首次', prompt: 'F', always: false, firstOnly: true },
    ] }],
  }
  const onlyFirstSend = writeSend(onlyFirstBook, true, '我的问题')
  check('只有「仅首次」时，第一条仍然附加上（不因「没有每次条目」而被丢掉）',
    onlyFirstSend.wrote === true && onlyFirstSend.written === '我的问题\n\nF',
    JSON.stringify(onlyFirstSend.written))
  const onlyFirstSecond = writeSend(onlyFirstBook, false, '我的问题')
  check('只有「仅首次」时，第二条不写（也没有别的可附）',
    onlyFirstSecond.wrote === false && onlyFirstSecond.written === null)
  check('原文为空时一条都不写（交还官方发送语义）', writeSend(batch, true, '').wrote === false)

  // 接缝：blank 只能来自槽位快照；三选一控件两处共用
  const buttonSrc = readFileSync(new URL('../src/client/QuickCommandsButton.tsx', import.meta.url), 'utf8')
  const panelSrc = readFileSync(new URL('../src/client/QuickCommandsPanel.tsx', import.meta.url), 'utf8')
  const sectionSrc = readFileSync(new URL('../src/client/SettingsSection.tsx', import.meta.url), 'utf8')
  check(
    '「会话还是空的」取自槽位快照的 blank 并投递给桥接',
    /useSession\(state => state\?\.blank === true\)/.test(buttonSrc) && /blank: blank === true/.test(buttonSrc),
    'QuickCommandsButton 里应有 useSession(state => state?.blank === true) 与 blank: blank === true',
  )
  check(
    '面板换成了三选一控件（旧的单个勾选框已移除）',
    /<InsertModeControl/.test(panelSrc) && !/type="checkbox"/.test(panelSrc),
    '面板里不应再出现 type="checkbox"（那是旧的「默认插入」勾选框）',
  )
  check('设置页也用三选一控件', /<InsertModeControl/.test(sectionSrc))
  check('两处共用同一个三选一组件（行为不会分叉）', /InsertModeControl\.tsx/.test(panelSrc) && /InsertModeControl\.tsx/.test(sectionSrc))
}

// ── 收尾 ────────────────────────────────────────────────────────────────────
delete process.env.DSH_HOME
for (const dir of homes) rmSync(dir, { recursive: true, force: true })
console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
