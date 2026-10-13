/**
 * 「自检」报告（0.22.0，借鉴 dsh-ops 的 `status` / `probe` 那套诊断面）。
 *
 * 为什么要有它：本插件的状态散在五个地方 —— 设置页的写入说明行、面板里的提示、
 * 宿主日志、设置文档、以及"点了没反应"这种什么都不说的情况。用户排障时没有一处
 * 能一次看全；我自己找到过好几次问题（字段漏进 schema、终端行被守卫禁掉、
 * 请求头写了但没生效），全靠翻日志。这一节把所有结论摊平成一张表。
 *
 * 这里是**纯函数**：输入是各处已经读好的事实，输出是行。真正的采集在 host.ts 里
 * （那边才有服务），所以这一节能被逐格测。
 */

/** 一行的严重级别：`ok` 正常 / `info` 只是信息 / `warn` 能用但有隐患 / `fail` 已经坏了。 */
export type DoctorLevel = 'ok' | 'info' | 'warn' | 'fail'

/** 报告里的一行。 */
export interface DoctorRow {
  readonly id: string
  readonly label: string
  readonly level: DoctorLevel
  readonly detail: string
}

/** 采集到的全部事实（缺什么就按缺的算，绝不假装知道）。 */
export interface DoctorInput {
  readonly version: string
  /** 总开关。 */
  readonly enabled: boolean
  /** 八个栏目的开关（名字 → 值）。 */
  readonly sections: Readonly<Record<string, boolean>>
  /** 设置契约里声明的 `*_FIELD` 常量名（用来和 schema 键对照）。 */
  readonly fieldConstants: readonly string[]
  /** 导出的 Config（ownSchema）里的顶层键。 */
  readonly schemaKeys: readonly string[]
  /** 终端那一栏。 */
  readonly terminal: {
    readonly platform: string
    readonly rowInstalled: boolean
    readonly bashPath: string
    readonly status: string
    readonly mode: string
    readonly hasSandbox: boolean
  }
  /** 请求头那一栏。 */
  readonly header: {
    readonly overlayInstalled: boolean
    readonly hasLoader: boolean
    readonly migrated: boolean
    readonly status: string
    readonly writesUserConfig: boolean
  }
  /** 快捷指令本。 */
  readonly quick: {
    readonly file: string
    readonly readable: boolean
    readonly custom: boolean
    readonly error: string
  }
  /** 微信通知。 */
  readonly notify: {
    readonly enabled: boolean
    readonly channel: string
    readonly credentialSet: boolean
  }
  /** 解释层。 */
  readonly optimize: {
    readonly tier: string
    readonly readTools: boolean
    readonly bashOn: boolean
    readonly bashGate: string
  }
  /** 运行环境。 */
  readonly runtime: {
    readonly node: string
    readonly dshVersion: string
  }
}

/** 所有 `*_FIELD` 常量里有、而 schema 里没有的（这就是"开关拨不动"的根因）。 */
export function missingSchemaFields(input: Pick<DoctorInput, 'fieldConstants' | 'schemaKeys'>): readonly string[] {
  const keys = new Set(input.schemaKeys)
  return input.fieldConstants.filter(name => !keys.has(name)).slice().sort()
}

/** 栏目开关里"开着"的那几个（用于一句话概览）。 */
export function enabledSections(sections: Readonly<Record<string, boolean>>): readonly string[] {
  return Object.entries(sections).filter(([, on]) => on === true).map(([name]) => name).sort()
}

/**
 * 生成报告行。
 *
 * 顺序按"用户最可能先踩到的坑"排：设置能不能写 → 各栏目 → 终端 → 请求头 → 通知 → 解释层。
 * @param input - 采集到的事实。
 * @returns 报告行（永远非空）。
 */
export function buildDoctorReport(input: DoctorInput): readonly DoctorRow[] {
  const rows: DoctorRow[] = []
  const missing = missingSchemaFields(input)
  rows.push({
    id: 'settings.schema',
    label: '设置字段都在宿主 schema 里',
    level: missing.length === 0 ? 'ok' : 'fail',
    detail: missing.length === 0
      ? `${String(input.fieldConstants.length)} 个字段全部声明（不然写设置会被 settings.mutate 拒绝）`
      : `缺 ${missing.join('、')} —— 写这些字段会被宿主拒绝（Config field is not volatile）`,
  })

  rows.push({
    id: 'plugin.switch',
    label: '插件总开关',
    level: input.enabled ? 'ok' : 'info',
    detail: input.enabled ? '开启中' : '已关闭（栏内设置全部保留）',
  })

  const on = enabledSections(input.sections)
  rows.push({
    id: 'sections',
    label: '各栏目开关',
    level: 'info',
    detail: on.length === 0 ? '八栏全关（本插件目前完全不介入）' : `开着：${on.join('、')}`,
  })

  rows.push({
    id: 'terminal',
    label: '默认终端',
    level: input.terminal.platform !== 'win32'
      ? 'info'
      : input.terminal.rowInstalled
        ? (input.terminal.bashPath === '' ? 'warn' : 'ok')
        : 'warn',
    detail: input.terminal.platform !== 'win32'
      ? `非 Windows（${input.terminal.platform}）：不接管，用官方 bash`
      : input.terminal.rowInstalled
        ? `宿主终端服务在（ctx.terminals）；bash=${input.terminal.bashPath === '' ? '没探测到（会用官方默认）' : input.terminal.bashPath}；会话模式=${input.terminal.mode}；沙箱服务=${input.terminal.hasSandbox ? '有' : '没有'}${input.terminal.status === '' ? '' : `；${input.terminal.status}`}`
        : '宿主没有终端服务（ctx.terminals 不在）：这一栏即便开着也接管不了',
  })

  rows.push({
    id: 'header',
    label: 'OpenCode 请求头',
    level: input.header.writesUserConfig
      ? 'fail'
      : !input.header.overlayInstalled && input.header.status !== ''
        ? 'warn'
        : 'ok',
    detail: input.header.writesUserConfig
      ? '❗检测到它仍在写用户配置（0.22.0 起应改为运行期覆盖）'
      : `${input.header.overlayInstalled ? '运行期覆盖已挂上' : input.header.hasLoader ? '覆盖没挂上' : '没有 loader 服务，挂不上'}；旧写入清理=${input.header.migrated ? '已完成' : '未完成'}${input.header.status === '' ? '；当前未启用' : `；${input.header.status}`}`,
  })

  rows.push({
    id: 'quick',
    label: '快捷指令本',
    level: input.quick.readable ? 'ok' : 'fail',
    detail: input.quick.readable
      ? `${input.quick.file}${input.quick.custom ? '（有自定义内容）' : '（内置 9 条）'}`
      : `读不到 ${input.quick.file}：${input.quick.error === '' ? '未知原因' : input.quick.error}`,
  })

  rows.push({
    id: 'notify',
    label: '微信通知',
    level: input.notify.enabled ? (input.notify.credentialSet ? 'ok' : 'fail') : 'info',
    detail: input.notify.enabled
      ? `${input.notify.channel}：${input.notify.credentialSet ? '凭据已设置' : '缺凭据（开关是开的，但发不出去）'}`
      : '未启用',
  })

  rows.push({
    id: 'optimize',
    label: '提示词优化',
    level: 'info',
    detail: `档位=${input.optimize.tier}；只读查证=${input.optimize.readTools ? '开' : '关'}；内置 Bash=${input.optimize.bashOn ? `开（${input.optimize.bashGate}）` : '关'}`,
  })

  rows.push({
    id: 'runtime',
    label: '运行环境',
    level: 'info',
    detail: `dsh-composer-ux ${input.version}；DSH ${input.runtime.dshVersion === '' ? '（拿不到）' : input.runtime.dshVersion}；node ${input.runtime.node}`,
  })

  return rows
}
