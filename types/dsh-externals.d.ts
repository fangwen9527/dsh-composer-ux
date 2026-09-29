/**
 * 外部 API 的类型面（仅供 `npm run typecheck` 使用，**不参与构建与发行**）。
 *
 * 为什么手写而不是装那些包：DSH 的 `@deepseek-ai/*` 客户端包在 npm 上只发布了一部分，
 * 版本线还与应用本体（`0.1.7-rc.1`）不一致（`dsh-client-ui-slots` 停在 `0.0.1-rc.1`）。
 * 追着装一遍会把 typecheck 变成"能不能连上 registry、版本对不对得上"的运气游戏，
 * 而 CI 要在三平台上稳定跑。
 *
 * 所以这里只声明**本插件真正用到的那几个符号**，并且刻意写得比真实类型宽：
 *  - 它们是"运行时由宿主提供、浏览器/进程里已经存在"的东西（react 除外，见下），
 *    类型的作用是让 typecheck 抓得住**拼写与结构错误**（写错字段名、调用不存在的方法），
 *    不是复刻上游类型；
 *  - 真实形状由 `scripts/dsh-shape-check.mjs` 对着 DSH 源码核对（那才是权威）。
 *
 * ⚠️ 任何 `any` 都是**有意的取舍**：本插件从 0.1.0 起就在没有类型检查的情况下开发，
 * 这次引入 typecheck 的目标是"挡住低级错误 + 防止未解析的 import"，不是立刻全量 strict。
 * 真要收紧某个文件，先在那种文件上开更严的开关，别把整仓一次改炸。
 */

declare module '@deepseek-ai/cordis' {
  /** 宿主上下文：本插件只用 `get` / `inject` / `effect` / `on` 与几个服务的**动态**属性。 */
  export interface Context {
    /**
     * 服务需求读法：`ctx.webServer` / `ctx.llm` / `ctx.settings` ……
     *
     * 它们在不同 DSH 版本上有无不一，所以本插件一律**按能力探测**（`ctx.get(...)` + 自己收窄形状）。
     * 这里给 `any` 是有意的：真实类型在宿主侧，而这份垫片只为了让 typecheck 能跑。
     */
    readonly [key: string]: any
    get(name: string): any
    /** 等待依赖就绪后跑回调（本插件每个功能块都用）。 */
    inject(deps: readonly string[], callback: (scope: Context) => void): unknown
    /** 注册随插件回收的副作用。 */
    effect(callback: () => unknown, name?: string): unknown
    /** 事件订阅（真 Context 一定有；个别地方写成 `ctx.on?.()` 也合法）。 */
    on(event: string, listener: (...args: readonly any[]) => void): unknown
  }
}

declare module '@deepseek-ai/schemastery' {
  /**
   * schemastery 的 schema 构造器。
   *
   * 刻意是 `any`：它的链式 API（`z.object({...}).default(...)`、volatile 标记、
   * `z<Config>` 泛型参数）很大，而本插件只是把 schema **交给実体校验**；
   * 重刻一遍只会造出一堆"与真包对不上"的假错误。真实形状由 `scripts/dsh-shape-check.mjs`
   * 对着 DSH 源码核对。
   */
  const z: any
  export default z
  /** 一份不透明的 schema 实例（插件侧只传递不读）。 */
  export type Schema = any
}

declare module '@deepseek-ai/dsh-client-store' {
  /** 客户端快照 store：`getSnapshot()` 读、`set()` 写、`subscribe()` 订阅。 */
  export interface SnapshotStore<T> {
    getSnapshot(): T
    set(next: T): void
    subscribe(listener: (next: T) => void): () => void
  }
  export function createSnapshotStore<T>(initial: T): SnapshotStore<T>
  /**
   * 槽位给的"选择器 hook"：`useLive(item => item.xxx)`。
   *
   * 它由槽位注入（不是我们自己创建的），所以这里只声明调用形状。
   */
  export type SnapshotSelectorHook<T> = <R>(selector: (value: T) => R) => R
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  /**
   * 槽位运行时 props。
   *
   * 本插件按**能力探测**使用它们（`useInput` / `useSession` / `useLive` …），
   * 槽位在不同 DSH 版本上给的东西不一样，所以这里是开放的记录类型：
   * 拼写错了不会被拦（本来就是动态的），但下面声明的接口会被检查。
   */
  export type PropsRuntime<Name extends string> = { readonly [key: string]: any }

  /** 注入面：hooks 会以 `useXxx` 的形式合进 props。 */
  export type InjectFace<T> = { readonly [key: string]: any } & T

  /** 设置页条目从槽位拿到的部分 props（上游各版本字段不同，故开放）。 */
  export type SettingsSectionOwnerProps = { readonly [key: string]: any }
}
