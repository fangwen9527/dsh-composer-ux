/**
 * 工作区目录选择的「本机走系统框 / 远端走应用内框」自适应（0.18.0）。
 *
 * 为什么需要它：官方把目录选择拆成两个**互斥**的界面 —— `-native`（本机 OS 选择器）与
 * `-browse`（应用内浏览），由 `-auto` 在**宿主启动时**二选一，判定依据只有「绑定地址 /
 * SSH / 平台」，**不看客户端是谁**。于是出现了两个死角：
 *   · 你机器上 dsh-mobile 为了手机端能选目录，钉死了 browse ⇒ 连本机桌面也只能用应用内框；
 *   · 官方把「按客户端自适应（本地浏览器 native / 远端 browse）」明确列为 deferred，
 *     因为 `directoryPicker` 服务只能有一个实现、directory-flow 槽是 `single`。
 *
 * 我们绕开这个死角的依据是**槽位本身的 shadow 能力**（官方 `ui-slots` 源码：
 * 「entries sharing one cell coexist at distinct priorities … the cell's lowest live entry
 * renders」，只有**同优先级**的第二次注册才报错）：
 *   · 桌面应用的 preload 注入了 `window.__DSH_DIRECTORY_PICKER__`（Electron 原生目录框）
 *     ⇒ 本插件在 -1 优先级上接管这两个槽位，渲染成「无界面 + 直接弹系统文件夹框」；
 *   · 手机 / 远端浏览器没有这个桥 ⇒ 本插件**一个槽位都不注册**，官方应用内浏览界面照旧渲染。
 *
 * 结论：不碰官方任何文件、不抄官方那 1000 行界面，远端体验零退化。
 *
 * 本文件是**纯逻辑**（不 import react）：桥探测、一次开门只弹一次的状态机、结果→持有方的
 * 映射都放在这里，便于单测与变异护栏；React 适配层只有 `DirectoryFlowEntry.tsx` 那十几行。
 */

/** 两个目录流程槽位（官方 ui-workspace 声明）；顺序与官方一致：外层 hero、内层 sidebar。 */
export const DIRECTORY_FLOW_SLOTS = [
  'conversation.hero.workspace.directoryFlow',
  'sidebar.workspaces.directoryFlow',
] as const

/**
 * 影子优先级。
 *
 * 官方应用内界面注册在默认优先级 0 上；**最低的活条目渲染**，所以 -1 能把本机这个槽位抢过来，
 * 而 0 上那条仍然合法共存（不会像同优先级那样抛「already has a registration」）。
 * 远端不注册 ⇒ 0 上那条就是最低 ⇒ 官方界面渲染。
 */
export const NATIVE_SHADOW_PRIORITY = -1

/** preload 注入的窄接口（桌面应用）。 */
export interface DirectoryPickBridge {
  pick: () => Promise<string | null>
}

/** 槽位持有方给的对话（官方 DirectoryFlowOwnerProps 的本地副本）。 */
export interface DirectoryFlowOwner {
  open: boolean
  busy: boolean
  onPicked: (path: string) => void
  onCancel: () => void
  onError: (message: string) => void
}

/**
 * 探测 preload 桥。
 *
 * 为什么逐项校验而不是只判 truthy：这个值来自页面全局，被别的脚本写成 `{}` 或 `{pick: 1}`
 * 时，一旦放过去就会在用户点「选择工作区目录」时抛 `pick is not a function`，
 * 而持有方只会把它当"选择失败"。宁可判定"没有桥"（退化成官方应用内界面）。
 * @param scope - 取桥的对象（生产是 `globalThis`，测试注入假对象）。
 * @returns 可用的桥，或 undefined。
 */
export function nativePickBridge(scope: unknown): DirectoryPickBridge | undefined {
  const candidate = (scope as { __DSH_DIRECTORY_PICKER__?: unknown } | null | undefined)?.__DSH_DIRECTORY_PICKER__
  if (candidate === null || typeof candidate !== 'object') return undefined
  if (typeof (candidate as { pick?: unknown }).pick !== 'function') return undefined
  return candidate as DirectoryPickBridge
}

/** 一次选择的结果：三态，恰好回报一个。 */
export type DirectoryFlowOutcome =
  | { kind: 'picked'; path: string }
  | { kind: 'cancel' }
  | { kind: 'error'; message: string }

/**
 * 把结果交给持有方（纯函数：三个分支各只有一条）。
 * @param owner - 持有方给出的三个终局回调。
 * @param outcome - 选择结果。
 */
export function applyOutcome(
  owner: Pick<DirectoryFlowOwner, 'onPicked' | 'onCancel' | 'onError'>,
  outcome: DirectoryFlowOutcome,
): void {
  if (outcome.kind === 'picked') owner.onPicked(outcome.path)
  else if (outcome.kind === 'cancel') owner.onCancel()
  else owner.onError(outcome.message)
}

/** 状态机对外只有两件事：`open` 的每条上升沿，以及（测试用）当前是否已上膛。 */
export interface PickFlow {
  /**
   * 报告 `open` 的当前值。
   * @param open - 持有方是否正在请求一次选择。
   */
  setOpen: (open: boolean) => void
  /**
   * @returns 是否已上膛（已发起、还没被 `open` 落回重新上膛）。
   */
  armed: () => boolean
}

/** `createPickFlow` 的依赖。 */
export interface PickFlowOptions {
  /** 打开一次选择器；取消时 resolve 成 null。 */
  pick: () => Promise<string | null>
  /** 唯一终局回调（每个 open 上升沿恰好一次）。 */
  report: (outcome: DirectoryFlowOutcome) => void
  /**
   * 结果回来时还算不算数。
   *
   * 为什么必须有：原生对话框没有按请求中止的能力，HMR 换掉占用者后旧实例的请求仍会落地；
   * 让死掉的实例去 `onPicked` 会凭空给用户加一个工作区（或驱动一个不存在的错误界面）。
   */
  isAlive?: () => boolean
}

/**
 * 一次开门只弹一次选择器的状态机。
 *
 * 签名行为（官方原生界面同一套语义，我们把它做成纯函数以便钉住）：
 *  · 上升沿开一次；`open` 保持 true（比如持有方正在 busy 采纳）时重渲染**不再开**；
 *  · `open` 落回 false 就重新上膛，下一次请求才会再开；
 *  · 取消（null）报 cancel、拿到路径报 picked、抛异常报 error（Error 取 message）。
 * @param options - pick / report / isAlive。
 * @returns 状态机。
 */
export function createPickFlow(options: PickFlowOptions): PickFlow {
  let armed = false
  const settle = (outcome: DirectoryFlowOutcome): void => {
    if (options.isAlive !== undefined && !options.isAlive()) return
    options.report(outcome)
  }
  return {
    setOpen(open) {
      if (!open) {
        armed = false
        return
      }
      if (armed) return
      armed = true
      options.pick().then(
        path => { settle(path === null ? { kind: 'cancel' } : { kind: 'picked', path }) },
        reason => { settle({ kind: 'error', message: reason instanceof Error ? reason.message : String(reason) }) },
      )
    },
    armed: () => armed,
  }
}

/** 注册所需的最小槽位接口（生产是 `ctx.slots`，测试用假对象）。 */
export interface SlotsLike {
  inject: (name: string, callback: () => unknown) => unknown
  register: (options: unknown, component: unknown) => () => void
}

/**
 * 按「有没有 preload 桥」决定要不要影子接管这两个槽位。
 *
 * 没有桥就**一个槽位都不注册** —— 这是远端体验不退化的一半（另一半是 profile 里让官方
 * 应用内界面继续挂着）。
 * @param slots - `ctx.slots` 或测试替身。
 * @param scope - 取桥的对象（生产 `globalThis`）。
 * @param component - 占用者组件（无界面：弹系统框）。
 * @returns 卸载句柄；**没有桥时返回 undefined**（远端一点都不装）。
 */
export function installDirectoryFlow(slots: SlotsLike, scope: unknown, component: unknown): (() => void) | undefined {
  const bridge = nativePickBridge(scope)
  if (bridge === undefined) return undefined
  const pick = (): Promise<string | null> => bridge.pick()
  const injected = (): { pick: () => Promise<string | null> } => ({ pick })
  // 两个声明期都要在才装：生成器让两条注册成为一次事务性效果（官方界面同一套嵌套写法）。
  // 返回的卸载句柄由 `slots.inject` 提供（框架的"卸载时连子声明一起收"由它负责）。
  const dispose = slots.inject(DIRECTORY_FLOW_SLOTS[0], () => slots.inject(DIRECTORY_FLOW_SLOTS[1], function* () {
    yield slots.register({ name: DIRECTORY_FLOW_SLOTS[0], inject: injected, priority: NATIVE_SHADOW_PRIORITY }, component)
    yield slots.register({ name: DIRECTORY_FLOW_SLOTS[1], inject: injected, priority: NATIVE_SHADOW_PRIORITY }, component)
  }))
  return typeof dispose === 'function' ? (dispose as () => void) : undefined
}

/** 开关 → 影子接管的控制器（0.19.0 设置项「工作区目录选择」）。 */
export interface DirectoryFlowController {
  /**
   * 报告开关当前值：开就装、关就卸。
   * @param enabled - 设置页那个开关的值。
   */
  sync: (enabled: boolean) => void
  /** 卸载（插件卸载 / HMR 换掉整个客户端半）。 */
  dispose: () => void
}

/** `createDirectoryFlowController` 的依赖。 */
export interface DirectoryFlowControllerOptions {
  slots: SlotsLike
  scope: unknown
  component: unknown
}

/**
 * 让设置页那个开关真的能开能关。
 *
 * 为什么要单独一个控制器而不是在 `apply` 里直接调：开关是**运行时**值，用户会在不重启的
 * 情况下反复拨它。这里把两件容易出错的事收在一处：
 *  · **幂等**：已经装着时再 `sync(true)` 什么都不做 —— 同一个槽位同优先级重复注册会当场抛
 *    `single slot "…" already has a registration`（会连累整个客户端半挂不上）；
 *  · **可反复**：关掉即卸载（官方那条 0 优先级条目立刻成为最低者、界面回到官方对话框），
 *    再打开能重新装上。
 * @param options - slots / scope / component。
 * @returns 控制器。
 */
export function createDirectoryFlowController(options: DirectoryFlowControllerOptions): DirectoryFlowController {
  let installed: (() => void) | undefined
  const dispose = (): void => {
    installed?.()
    installed = undefined
  }
  return {
    sync(enabled) {
      if (enabled) {
        if (installed === undefined) installed = installDirectoryFlow(options.slots, options.scope, options.component)
        return
      }
      dispose()
    },
    dispose,
  }
}

