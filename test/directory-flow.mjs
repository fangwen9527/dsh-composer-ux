/**
 * 工作区目录选择自适应（0.18.0）的护栏测试。
 *
 * 这个功能的全部价值是**两条路各归各位**：桌面应用里弹系统文件夹框、手机/远端仍旧用官方
 * 应用内浏览界面；而它用的手段是槽位的 shadow（比官方更低的优先级接管），一旦写错就会出现
 * 两种真事故：
 *   · 远端也注册 ⇒ 手机上的应用内界面被一个"什么都不渲染"的占用者挤掉，用户点「选择工作区目录」
 *     屏幕上什么都不会发生（也没有报错）；
 *   · 优先级写成 0（或正整数）⇒ 与官方那条同优先级，安装期直接抛
 *     `single slot "…" already has a registration`，整块客户端插件挂不上。
 * 所以这里把「有没有桥」「注册几条、多高优先级、注入的 pick 绑到谁」全部钉住，
 * 另外把状态机的四件事钉住：一条上升沿只弹一次、落回后重新上膛、三态恰好回报一个、
 * 卸载后迟到的结果必须丢弃（否则会凭空多出一个工作区）。
 *
 *   node test/directory-flow.mjs
 */
import { build } from 'esbuild'

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

/** 纯函数出口（与其余套件同一套做法：现场打包源码再 import）。 */
const bundled = await build({
  bundle: true, write: false, format: 'esm', platform: 'node', target: ['es2022'], logLevel: 'warning',
  stdin: {
    contents: "export * from './src/client/directory-flow.ts'\n",
    resolveDir: process.cwd(), loader: 'ts',
  },
})
const mod = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)

const {
  DIRECTORY_FLOW_SLOTS, NATIVE_SHADOW_PRIORITY,
  nativePickBridge, createPickFlow, applyOutcome, installDirectoryFlow, createDirectoryFlowController,
} = mod

/** 让 microtask 队列跑干净（pick 的 then 是微任务）。 */
const tick = () => new Promise(resolve => setTimeout(resolve, 0))

console.log('\n一、桥探测：形状不对就当"没有桥"（宁可退化成官方界面，也不要在点击时抛 pick is not a function）')
check('全局没有该属性 → undefined', nativePickBridge({}) === undefined)
check('值为 null → undefined', nativePickBridge({ __DSH_DIRECTORY_PICKER__: null }) === undefined)
check('值为字符串 → undefined', nativePickBridge({ __DSH_DIRECTORY_PICKER__: 'yes' }) === undefined)
check('值为数字 → undefined', nativePickBridge({ __DSH_DIRECTORY_PICKER__: 42 }) === undefined)
check('对象但没有 pick → undefined', nativePickBridge({ __DSH_DIRECTORY_PICKER__: {} }) === undefined)
check('pick 不是函数 → undefined', nativePickBridge({ __DSH_DIRECTORY_PICKER__: { pick: 1 } }) === undefined)
check('scope 是 undefined → undefined', nativePickBridge(undefined) === undefined)
const bridge = { pick: async () => 'D:\\x' }
check('形状正确 → 返回同一个对象', nativePickBridge({ __DSH_DIRECTORY_PICKER__: bridge }) === bridge)

console.log('\n二、状态机：一条上升沿只弹一次，落回才重新上膛')
{
  let picks = 0
  const outcomes = []
  const flow = createPickFlow({ pick: async () => { picks += 1; return 'C:\\a' }, report: o => outcomes.push(o) })
  check('初始未上膛', flow.armed() === false)
  flow.setOpen(true)
  check('上升沿后已上膛', flow.armed() === true)
  check('弹了一次', picks === 1, `picks=${picks}`)
  flow.setOpen(true)
  check('保持 true 不再弹（busy 采纳期间重渲染）', picks === 1, `picks=${picks}`)
  await tick()
  check('结果只回报一次', outcomes.length === 1, JSON.stringify(outcomes))
  flow.setOpen(true)
  check('结果落地后仍未落回 ⇒ 不重复弹', picks === 1, `picks=${picks}`)
  flow.setOpen(false)
  check('落回后重新上膛', flow.armed() === false)
  flow.setOpen(true)
  check('再次请求 → 弹第二次', picks === 2, `picks=${picks}`)
  await tick()
}

console.log('\n三、三态映射：取消 / 拿到路径 / 失败各一条，恰好一个')
{
  const run = async (impl) => {
    const outcomes = []
    const flow = createPickFlow({ pick: impl, report: o => outcomes.push(o) })
    flow.setOpen(true)
    await tick()
    return outcomes
  }
  const cancel = await run(async () => null)
  check('null → cancel', cancel.length === 1 && cancel[0].kind === 'cancel', JSON.stringify(cancel))
  const picked = await run(async () => 'E:\\项目\\新文件夹')
  check('路径 → picked 且原样带上', picked.length === 1 && picked[0].kind === 'picked' && picked[0].path === 'E:\\项目\\新文件夹', JSON.stringify(picked))
  const failed = await run(async () => { throw new Error('对话框被系统拒绝') })
  check('Error → error 且取 message', failed.length === 1 && failed[0].kind === 'error' && failed[0].message === '对话框被系统拒绝', JSON.stringify(failed))
  const thrown = await run(async () => { throw 'bare-string' })
  check('非 Error 抛出 → error 且 String()', thrown.length === 1 && thrown[0].kind === 'error' && thrown[0].message === 'bare-string', JSON.stringify(thrown))
}

console.log('\n四、存活判定：卸载后迟到的结果必须丢弃')
{
  let alive = true
  const outcomes = []
  const flow = createPickFlow({
    pick: async () => 'D:\\late',
    report: o => outcomes.push(o),
    isAlive: () => alive,
  })
  flow.setOpen(true)
  alive = false
  await tick()
  check('死实例的结果被丢弃', outcomes.length === 0, JSON.stringify(outcomes))
  alive = true
  flow.setOpen(false)
  flow.setOpen(true)
  await tick()
  check('复活后（StrictMode 重放）结果正常回报', outcomes.length === 1 && outcomes[0].path === 'D:\\late', JSON.stringify(outcomes))
}

console.log('\n五、结果 → 持有方：三个终局回调各接一条')
{
  const calls = []
  const owner = {
    onPicked: p => calls.push(['picked', p]),
    onCancel: () => calls.push(['cancel']),
    onError: m => calls.push(['error', m]),
  }
  applyOutcome(owner, { kind: 'picked', path: 'D:\\w' })
  applyOutcome(owner, { kind: 'cancel' })
  applyOutcome(owner, { kind: 'error', message: 'x' })
  check('三条各命中一次且不串', JSON.stringify(calls) === JSON.stringify([['picked', 'D:\\w'], ['cancel'], ['error', 'x']]), JSON.stringify(calls))
}

console.log('\n六、注册：有桥才装，装就装两条，优先级低于官方（最低者渲染）')
{
  const makeSlots = () => {
    const injects = []
    const registers = []
    const disposed = []
    return {
      injects, registers, disposed,
      // 与真实签名一致：`slots.inject(...)` 返回卸载句柄（框架负责连子声明一起收）。
      inject: (name, callback) => {
        const id = injects.length
        injects.push({ name, callback })
        return () => { disposed.push(id) }
      },
      register: (options, component) => { registers.push({ options, component }); return () => {} },
    }
  }
  const slots = makeSlots()
  const installed = installDirectoryFlow(slots, {}, 'COMPONENT')
  check('没有桥 → 返回 undefined（一个槽位都不装）', installed === undefined, String(installed))
  check('没有桥 → 一个槽位都不 inject', slots.injects.length === 0, String(slots.injects.length))
  check('没有桥 → 一条都不注册', slots.registers.length === 0)
  check('优先级常量必须是负数（0 会与官方同优先级而抛错）', NATIVE_SHADOW_PRIORITY < 0, String(NATIVE_SHADOW_PRIORITY))

  const slots2 = makeSlots()
  const ok = installDirectoryFlow(slots2, { __DSH_DIRECTORY_PICKER__: bridge }, 'COMPONENT')
  check('有桥 → 返回卸载句柄', typeof ok === 'function')
  check('第一层只等 hero 槽位声明', slots2.injects.length === 1 && slots2.injects[0].name === DIRECTORY_FLOW_SLOTS[0], JSON.stringify(slots2.injects.map(i => i.name)))
  // 模拟框架：hero 槽位声明后跑回调 → 它接着去等 sidebar。
  slots2.injects[0].callback()
  check('第二层接 sidebar 槽位', slots2.injects.length === 2 && slots2.injects[1].name === DIRECTORY_FLOW_SLOTS[1], JSON.stringify(slots2.injects.map(i => i.name)))
  // 模拟框架：sidebar 声明后跑回调 → 拿到生成器；两个声明都到齐前一条都不注册。
  const iterable = slots2.injects[1].callback()
  check('两个声明都到齐前不注册', slots2.registers.length === 0, String(slots2.registers.length))
  for (const _ of iterable) { /* 消费生成器 = 完成两条注册 */ }
  check('两条注册：两个槽位各一条', slots2.registers.length === 2, String(slots2.registers.length))
  check('两条都带 shadow 优先级', slots2.registers.every(r => r.options.priority === NATIVE_SHADOW_PRIORITY), JSON.stringify(slots2.registers.map(r => r.options.priority)))
  check('两条各自注册到正确槽位', JSON.stringify(slots2.registers.map(r => r.options.name)) === JSON.stringify([...DIRECTORY_FLOW_SLOTS]), JSON.stringify(slots2.registers.map(r => r.options.name)))
  check('两条都用同一个占用者组件', slots2.registers.every(r => r.component === 'COMPONENT'))
  const face = slots2.registers[0].options.inject()
  check('注入面给出 pick', typeof face.pick === 'function')
  check('pick 返回值就是桥的返回值', await face.pick() === 'D:\\x')
  // 卸载句柄要真的把外层等待撤掉（否则关掉开关后仍留着一条 0 优先级的影子注册）。
  ok()
  check('卸载句柄撤掉外层 inject', slots2.disposed.length === 1, JSON.stringify(slots2.disposed))
}

console.log('\n七、开关控制器：开就装、关就卸、反复拨不出事（同优先级重复注册会当场抛错）')
{
  const makeSlots = () => {
    const injects = []
    const registers = []
    const disposed = []
    return {
      injects, registers, disposed,
      inject: (name, callback) => {
        const id = injects.length
        injects.push({ name, callback })
        return () => { disposed.push(id) }
      },
      register: (options, component) => { registers.push({ options, component }); return () => {} },
    }
  }
  const withBridge = { __DSH_DIRECTORY_PICKER__: bridge }

  const off = makeSlots()
  const c1 = createDirectoryFlowController({ slots: off, scope: withBridge, component: 'COMPONENT' })
  c1.sync(false)
  check('默认关：sync(false) 什么都不装', off.injects.length === 0 && off.disposed.length === 0, JSON.stringify([off.injects.length, off.disposed.length]))
  c1.sync(true)
  check('打开：装一层等待', off.injects.length === 1, String(off.injects.length))
  c1.sync(true)
  check('重复同步不会装第二遍（幂等）', off.injects.length === 1, String(off.injects.length))
  c1.sync(false)
  check('关掉：把已装的卸载掉', off.disposed.length === 1 && off.injects.length === 1, JSON.stringify([off.disposed.length, off.injects.length]))
  c1.sync(false)
  check('再关一次不重复卸载', off.disposed.length === 1, JSON.stringify(off.disposed))
  c1.sync(true)
  check('重新打开：重新装一层（可反复）', off.injects.length === 2, String(off.injects.length))
  c1.sync(true)
  check('重新打开后依旧幂等', off.injects.length === 2, String(off.injects.length))
  c1.dispose()
  check('卸载控制器：撤掉当前那层', off.disposed.length === 2, JSON.stringify(off.disposed))
  c1.dispose()
  check('重复 dispose 不重复卸载', off.disposed.length === 2, JSON.stringify(off.disposed))

  // 远端：开着开关也没有桥 ⇒ 永远不装，且不会因此报警/抛错。
  const remote = makeSlots()
  const c2 = createDirectoryFlowController({ slots: remote, scope: {}, component: 'COMPONENT' })
  c2.sync(true)
  c2.sync(true)
  check('远端（没桥）即便开关是开的也不装', remote.injects.length === 0, String(remote.injects.length))
  c2.sync(false)
  check('远端关掉是空操作', remote.disposed.length === 0, JSON.stringify(remote.disposed))
  c2.dispose()
}

console.log(`\n${passes} passed, ${failures} failed`)
process.exit(failures === 0 ? 0 : 1)
