/**
 * 「默认终端」（Windows 上把终端的 pwsh 换成 Git Bash）的行为测试。
 *
 * 这一套只覆盖**纯函数**与**宿主半接线**两部分，因为它们能在这里验：
 *  1. 探测顺序：git 反推 > MSYS2 > Cygwin > Niubash > PATH，且 WSL 硬排除；
 *  2. 宿主半接线：apply() 是否真的 restrict 掉 pwsh、注册 bash 工具、压掉 pwsh 提示词段。
 * 「真会话里模型是不是只剩下 bash」只能在真机上看（重启 + 新会话），这里不做承诺。
 *
 *   node test/terminal-policy.mjs
 */
import { mkdirSync } from 'node:fs'
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

// ── 现场打包纯函数出口（与其它套件同一套做法）────────────────────────────────
mkdirSync(new URL('./.build/', import.meta.url), { recursive: true })
await build({
  entryPoints: ['test/pure-entry.ts'],
  outfile: 'test/.build/pure.mjs',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['es2022'],
  logLevel: 'warning',
})
const pure = await import(new URL('./.build/pure.mjs', import.meta.url))

/** 用一组"存在的文件"造一个假文件系统；**从文件路径反推出目录也存在**（探测会检查安装根是不是目录）。 */
function fakeFs(paths) {
  const files = new Set(paths.map(p => pure.normalizePath(p).toLowerCase()))
  const dirs = new Set()
  for (const path of files) {
    const parts = path.split('/')
    for (let i = 1; i < parts.length; i += 1) dirs.add(parts.slice(0, i).join('/'))
  }
  return {
    exists: p => {
      const key = pure.normalizePath(p).toLowerCase()
      return files.has(key) || dirs.has(key)
    },
    has: p => files.has(pure.normalizePath(p).toLowerCase()),
  }
}

/** 本机的真实环境变量形状（脱敏后照抄）。 */
const LOCAL = 'C:/Users/fangwen/AppData/Local'
const ENV = {
  ProgramFiles: 'C:/Program Files',
  'ProgramFiles(x86)': 'C:/Program Files (x86)',
  ProgramW6432: 'C:/Program Files',
  LOCALAPPDATA: LOCAL,
}
const envOf = name => ENV[name]

// ══════════════ 1. 这台机器的真实形状 ═══════════════════════════════════════
console.log('1. 本机真实形状：Git 在 D:\\Git、Niubash 在 LOCALAPPDATA、WSL 在 System32')
{
  const fs = fakeFs([
    'D:/Git/cmd/git.exe',
    'D:/Git/bin/bash.exe',
    'D:/Git/usr/bin/bash.exe',
    `${LOCAL}/Programs/Niubash/niu.exe`,
    'C:/WINDOWS/system32/bash.exe',
    `${LOCAL}/Microsoft/WindowsApps/bash.exe`,
  ])
  const result = pure.discoverBashCandidates({
    exists: fs.exists,
    // WindowsApps 在真实机器的用户 PATH 上（WSL 的 bash 别名就在那里）。
    pathEntries: [
      'D:/Git/cmd', `${LOCAL}/Programs/Niubash`, 'C:/WINDOWS/system32', 'C:/WINDOWS',
      `${LOCAL}/Microsoft/WindowsApps`,
    ],
    env: envOf,
  })
  const paths = result.candidates.map(c => c.path)
  check('第一个候选是 D:/Git/bin/bash.exe（git 反推，不是猜目录）',
    paths[0] === 'D:/Git/bin/bash.exe', JSON.stringify(paths))
  check('只列会准备环境的 bin\\bash.exe —— 裸本体（usr/bin）不再当候选',
    paths.includes('D:/Git/bin/bash.exe') && !paths.includes('D:/Git/usr/bin/bash.exe'), JSON.stringify(paths))
  check('Niubash 仍是候选（用户可能特意装）',
    paths.includes(`${LOCAL}/Programs/Niubash/niu.exe`), JSON.stringify(paths))
  check('WSL 的 bash 一个都没进候选',
    !paths.some(p => pure.isWslBash(p)), JSON.stringify(paths))
  check('System32 那条被记进 excluded 并带原因',
    result.excluded.some(e => e.path.endsWith('system32/bash.exe') && e.reason === pure.WSL_REASON),
    JSON.stringify(result.excluded))
  check('WindowsApps 那条也被排除',
    result.excluded.some(e => e.path.toLowerCase().includes('windowsapps/bash.exe')),
    JSON.stringify(result.excluded))
  check('默认选的是 Git bash（不是 Niubash、更不是 WSL）',
    pure.defaultBashPath(result) === 'D:/Git/bin/bash.exe', pure.defaultBashPath(result))
  check('Niubash 排在 Git 之后',
    paths.indexOf(`${LOCAL}/Programs/Niubash/niu.exe`) > 0, JSON.stringify(paths))
}
{
  // 反例：只有 WSL 可用时，候选必须为空 —— 宁可"没找到"，也不能把 WSL 交出去。
  const fs = fakeFs(['C:/WINDOWS/system32/bash.exe'])
  const result = pure.discoverBashCandidates({
    exists: fs.exists, pathEntries: ['C:/WINDOWS/system32'], env: envOf,
  })
  check('只有 WSL 时：候选为空（不能退而求其次交给 WSL）',
    result.candidates.length === 0, JSON.stringify(result.candidates))
  check('只有 WSL 时：excluded 里如实记着原因', result.excluded.length === 1, JSON.stringify(result.excluded))
}

// ══════════════ 2. git 安装位置的各种形态 ══════════════════════════════════
console.log('2. git 的常见形态都要能找到')
{
  const cases = [
    { name: 'Program Files 默认安装（PATH 上没有 git）', files: ['C:/Program Files/Git/bin/bash.exe'], entries: [], expect: 'C:/Program Files/Git/bin/bash.exe' },
    { name: 'Program Files (x86)', files: ['C:/Program Files (x86)/Git/bin/bash.exe'], entries: [], expect: 'C:/Program Files (x86)/Git/bin/bash.exe' },
    { name: 'PATH 上是 <root>/bin', files: ['D:/Tools/Git/bin/git.exe', 'D:/Tools/Git/bin/bash.exe'], entries: ['D:/Tools/Git/bin'], expect: 'D:/Tools/Git/bin/bash.exe' },
    { name: 'PATH 上是 <root>/mingw64/bin', files: ['D:/Tools/Git/mingw64/bin/git.exe', 'D:/Tools/Git/mingw64/bin/bash.exe'], entries: ['D:/Tools/Git/mingw64/bin'], expect: 'D:/Tools/Git/mingw64/bin/bash.exe' },
    { name: '只装了 usr/bin 下的 bash', files: ['D:/Git/usr/bin/bash.exe'], entries: ['D:/Git/cmd'], expect: 'D:/Git/usr/bin/bash.exe' },
  ]
  for (const item of cases) {
    const fs = fakeFs([...item.files, 'C:/WINDOWS/system32/bash.exe'])
    const result = pure.discoverBashCandidates({
      exists: fs.exists, pathEntries: item.entries, env: envOf,
    })
    check(item.name, pure.defaultBashPath(result) === item.expect,
      `${pure.defaultBashPath(result)}（候选 ${JSON.stringify(result.candidates.map(c => c.path))}）`)
  }
}

// ══════════════ 3. 显式路径：填了就优先，填错要如实报告 ══════════════════════
console.log('3. 显式路径（设置里填的）')
{
  const fs = fakeFs(['D:/Git/bin/bash.exe', 'E:/custom/bash.exe'])
  const ok = pure.discoverBashCandidates({
    exists: fs.exists, pathEntries: ['D:/Git/cmd'], env: envOf, explicitPath: 'E:\\custom\\bash.exe',
  })
  check('反斜杠写法被归一化后仍能用', ok.explicit?.state === 'ok' && ok.explicit.path === 'E:/custom/bash.exe',
    JSON.stringify(ok.explicit))
  check('显式路径排在 Git 之前（用户自己选的优先）',
    pure.defaultBashPath(ok) === 'E:/custom/bash.exe', pure.defaultBashPath(ok))
  check('显式候选带 explicit 标记（界面据此标注「你指定的」）',
    ok.candidates[0].explicit === true && ok.candidates[1].explicit === false,
    JSON.stringify(ok.candidates.map(c => [c.path, c.explicit])))

  const missing = pure.discoverBashCandidates({
    exists: fs.exists, pathEntries: ['D:/Git/cmd'], env: envOf, explicitPath: 'E:/nope/bash.exe',
  })
  check('填了不存在的路径：状态是 missing，且不混进候选',
    missing.explicit?.state === 'missing' && !missing.candidates.some(c => c.path.includes('nope')),
    JSON.stringify({ explicit: missing.explicit, candidates: missing.candidates.map(c => c.path) }))
  check('填错时仍然给出探测到的 Git（不会因为一个错字就没有可用 shell）',
    pure.defaultBashPath(missing) === 'D:/Git/bin/bash.exe', pure.defaultBashPath(missing))

  const wsl = pure.discoverBashCandidates({
    // 显式填的那条必须是**确实存在**的文件，才会被记进 excluded（否则每台机器都会诈报）。
    exists: fakeFs(['D:/Git/bin/bash.exe', 'C:/WINDOWS/system32/bash.exe']).exists,
    pathEntries: [], env: envOf, explicitPath: 'C:\\WINDOWS\\system32\\bash.exe',
  })
  check('显式填了 WSL：状态是 wsl（后续由宿主半拒绝保存）',
    wsl.explicit?.state === 'wsl', JSON.stringify(wsl.explicit))
  check('显式填了 WSL：它绝不出现在候选里（进 excluded 并带原因）',
    !wsl.candidates.some(candidate => pure.isWslBash(candidate.path)) && wsl.excluded.length === 1,
    JSON.stringify(wsl))
}

// ══════════════ 4. 去重与标签 ═══════════════════════════════════════════════
console.log('4. 去重与标签')
{
  const fs = fakeFs(['D:/Git/bin/bash.exe'])
  const result = pure.discoverBashCandidates({
    exists: fs.exists,
    pathEntries: ['D:/Git/cmd', 'D:/Git/bin', 'd:/git/BIN'],
    env: envOf,
  })
  check('同一路径被多个来源命中时只留一个', result.candidates.length === 1,
    JSON.stringify(result.candidates.map(c => c.path)))
  check('大小写不同算同一个', result.candidates[0].path === 'D:/Git/bin/bash.exe', result.candidates[0].path)
  check('标签是 Git for Windows', result.candidates[0].label === 'Git for Windows', result.candidates[0].label)
  check('MSYS2 路径认得出', pure.candidateKindOf('C:\\msys64\\usr\\bin\\bash.exe') === 'msys2')
  check('Cygwin 路径认得出', pure.candidateKindOf('C:\\cygwin64\\bin\\bash.exe') === 'cygwin')
  check('Niubash 认得出', pure.candidateKindOf('C:/x/Niubash/niu.exe') === 'niubash')
  check('普通 PATH 里的 bash 归到 path', pure.candidateKindOf('D:/tools/bash.exe') === 'path')
  check('没有任何候选时默认路径是空串',
    pure.defaultBashPath({ candidates: [], excluded: [] }) === '')
}

// ══════════════ 5. 渲染层（与官方 dsh-tool-bash 逐字对齐）═══════════════════
console.log('5. 渲染与退出状态（模型看到的行为）')
{
  /** 造一个前台结果。 */
  const result = over => ({
    exitCode: 0, signal: null, timedOut: false, aborted: false, timeoutMs: 120000,
    stdout: { text: '', truncated: false }, stderr: { text: '', truncated: false },
    ...over,
  })
  check('空输出 → (no output)',
    pure.renderBashResult(result({})) === '(no output)', pure.renderBashResult(result({})))
  check('干净退出 0 → 不打任何标记',
    pure.renderBashResult(result({ stdout: { text: 'hi\n', truncated: false } })) === 'hi\n')
  check('非零退出 → [exit code: N] 在末尾',
    pure.renderBashResult(result({ exitCode: 1, stdout: { text: 'boom', truncated: false } }))
      === 'boom\n[exit code: 1]')
  check('stderr 单独成段并带 [stderr] 头',
    pure.renderBashResult(result({ stdout: { text: 'a', truncated: false }, stderr: { text: 'e', truncated: false } }))
      === 'a\n[stderr]\ne')
  check('stdout 已换行时不再补一个空行',
    pure.renderBashResult(result({ stderr: { text: 'e', truncated: false } })) === '[stderr]\ne')
  check('截断 → 附完整输出位置',
    pure.renderBashResult(result({ stdout: { text: 'x', truncated: true, spillPath: 'C:/t/s.txt' } }))
      === 'x\n[output truncated; full output: C:/t/s.txt]')
  check('截断但没有落盘路径 → (unavailable)',
    pure.renderBashResult(result({ stdout: { text: 'x', truncated: true } }))
      === 'x\n[output truncated; full output: (unavailable)]')
  check('信号死亡 → [killed by signal: X]，且不出现 exit 标记',
    pure.renderBashResult(result({ signal: 'SIGKILL', exitCode: null }))
      === '(no output)\n[killed by signal: SIGKILL]')
  check('超时（真实形状：被信号杀掉）→ 超时标记 + 信号标记',
    pure.renderBashResult(result({ timedOut: true, exitCode: null, signal: 'SIGTERM' }))
      === '(no output)\n[timed out after 120000ms]\n[killed by signal: SIGTERM]',
    pure.renderBashResult(result({ timedOut: true, exitCode: null, signal: 'SIGTERM' })))
  check('官方怪癖：exitCode 为 null 且无信号时，会打 [exit code: null]（与官方一致）',
    pure.renderBashResult(result({ exitCode: null })) === '(no output)\n[exit code: null]',
    pure.renderBashResult(result({ exitCode: null })))
  {
    const denied = pure.renderBashResult(
      result({ exitCode: 1, stdout: { text: 'nope', truncated: false }, sandbox: { mode: 'read-only', denied: true } }),
      pure.ESCALATION_TARGETS,
    )
    check('拒绝 → 拒绝标记 + 升级提示 + exit 标记（顺序固定）',
      denied === 'nope\n' + pure.sandboxDenialMarker('read-only') + '\n'
        + pure.escalationHintMarker('command') + '\n[exit code: 1]',
      JSON.stringify(denied))
  }
  check('没有升级面时不打升级提示',
    !pure.renderBashResult(
      result({ sandbox: { mode: 'read-only', denied: true } }), [],
    ).includes('escalation available'))
}

console.log('6. parseExitStatus（终端卡片靠它拆 pill）')
{
  const exit = pure.parseExitStatus('boom\n[exit code: 1]')
  check('拆出 exitCode 并从正文里摘掉', exit.exitCode === 1 && exit.body === 'boom', JSON.stringify(exit))
  const killed = pure.parseExitStatus('x\n[killed by signal: SIGTERM]')
  check('拆出 signal', killed.signal === 'SIGTERM' && killed.body === 'x', JSON.stringify(killed))
  const clean = pure.parseExitStatus('hi\n')
  check('没有标记时 exitCode 视为 0 且正文原样', clean.exitCode === 0 && clean.body === 'hi\n', JSON.stringify(clean))
  const nullish = pure.parseExitStatus('x\n[exit code: null]')
  check('官方怪癖：[exit code: null] 不被识别，留在正文里（不"顺手修好"）',
    nullish.exitCode === 0 && nullish.body === 'x\n[exit code: null]', JSON.stringify(nullish))
  const middle = pure.parseExitStatus('[exit code: 3]\n不在这里')
  check('标记不在末尾时不匹配（按官方用 $ 锚定）',
    middle.exitCode === 0 && middle.body === '[exit code: 3]\n不在这里', JSON.stringify(middle))
}

console.log('7. 后台增量渲染')
{
  const read = { delta: 'out', lossy: false }
  check('无异常时原样返回增量', pure.renderProcessRead(read, undefined) === 'out')
  check('丢了内存输出 → 如实说明且指出落盘位置',
    pure.renderProcessRead({ ...read, lossy: true, stdoutSpillPath: 'C:/t/o.txt' }, undefined)
      === 'out\n[some output was dropped from memory; full output: C:/t/o.txt]')
  check('沙箱 runner 自己失败 → 明确说"命令没跑"，与命令失败区分',
    pure.renderProcessRead(read, { mode: 'workspace-write', denied: false, runnerFailed: true })
      .includes('the sandbox runner itself failed under workspace-write mode'))
  check('被拒绝时附拒绝标记', pure.renderProcessRead(read, { mode: 'read-only', denied: true })
    .includes(pure.sandboxDenialMarker('read-only')))
}

// ══════════════ 8. 升级审批语义（fail-closed，逐字对齐官方）═══════════════════
console.log('8. 沙箱升级审批')
{
  const throws = (fn) => { try { fn(); return '' } catch (error) { return String(error.message ?? error) } }
  check('sandbox_permissions 没配 justification → 报错',
    throws(() => pure.validateEscalationArgs('workspace-write', undefined))
      === 'invalid escalation: sandbox_permissions requires a justification')
  check('justification 单独出现 → 报错',
    throws(() => pure.validateEscalationArgs(undefined, '理由'))
      === 'invalid escalation: justification is only valid together with sandbox_permissions')
  check('justification 全是空白 → 报错',
    throws(() => pure.validateEscalationArgs('workspace-write', '   '))
      === 'invalid justification: expected a non-empty sentence')
  check('两个都不给 → 合法（不升级）', pure.validateEscalationArgs(undefined, undefined) === undefined)

  /** 记账用的假审批服务。 */
  const approver = (outcome) => {
    const calls = []
    return {
      calls,
      request: async (req) => { calls.push(req); return outcome },
    }
  }
  const run = (request, approval) => pure.approveEscalation(request, approval)
    .then(mode => ({ mode }), error => ({ error: String(error.message ?? error) }))
  const base = { requestedMode: 'workspace-write', justification: '要写文件', effectiveMode: 'read-only', subject: 'command' }

  {
    const spy = approver('allowed-once')
    const got = await run({ ...base, requestedMode: 'read-only', effectiveMode: 'read-only' }, { approver: spy, agent: {}, callId: 'c1', toolName: 'bash' })
    check('目标模式与当前相同 → 直接放行且**不打扰用户**', got.mode === 'read-only' && spy.calls.length === 0,
      JSON.stringify({ got, calls: spy.calls.length }))
  }
  {
    const got = await run({ ...base, requestedMode: 'workspace-write', effectiveMode: 'danger-full-access' },
      { approver: approver('allowed-once'), agent: {}, callId: 'c1', toolName: 'bash' })
    check('不是严格更宽 → 报错（不是空操作）',
      got.error === 'sandbox escalation to "workspace-write" is not strictly wider than this call\'s current "danger-full-access" mode',
      JSON.stringify(got))
  }
  {
    const got = await run(base, { approver: undefined, agent: {}, callId: 'c1', toolName: 'bash' })
    check('没有审批服务 → fail-closed（绝不放行）',
      got.error === 'sandbox escalation to "workspace-write" requires approval, but no approval service is composed',
      JSON.stringify(got))
  }
  {
    const got = await run(base, { approver: approver('allowed-once'), agent: undefined, callId: 'c1', toolName: 'bash' })
    check('没有 agent 可路由 → fail-closed',
      got.error === 'sandbox escalation to "workspace-write" requires approval, but the call has no agent to route it through',
      JSON.stringify(got))
  }
  {
    const spy = approver('allowed-once')
    const got = await run(base, { approver: spy, agent: { id: 'a' }, callId: 'c1', toolName: 'bash' })
    check('获批 → 返回目标模式', got.mode === 'workspace-write', JSON.stringify(got))
    check('审批理由带模式与用户理由（审计可读）',
      spy.calls[0].reason === 'escalate sandbox to workspace-write: 要写文件', JSON.stringify(spy.calls[0]))
    check('审批请求带 toolName 与 callId（UI 能挂到那次调用上）',
      spy.calls[0].toolName === 'bash' && spy.calls[0].callId === 'c1', JSON.stringify(spy.calls[0]))
  }
  for (const [outcome, expected] of [
    ['rejected', 'the user rejected escalating this command to "workspace-write"'],
    ['cancelled', 'approval for escalating to "workspace-write" was cancelled'],
    ['unavailable', 'sandbox escalation to "workspace-write" requires approval, but no approval channel is available'],
  ]) {
    const got = await run(base, { approver: approver(outcome), agent: {}, callId: 'c1', toolName: 'bash' })
    check(`审批结果 ${outcome} → 拒绝并如实说明`, got.error === expected, JSON.stringify(got))
  }
}

// ══════════════ 9. bash 工具：与官方同契约 ══════════════════════════════════
console.log('9. bash 工具定义（名 / 描述 / schema）')
{
  const dead = { spawn: () => { throw new Error('这一步不该 spawn') } }
  const bare = pure.createBashTool({ subprocess: dead }, { bashPath: 'D:/Git/bin/bash.exe' })
  check('工具名固定为 bash（模型可见名）', bare.name === 'bash' && pure.BASH_TOOL_NAME === 'bash', bare.name)
  check('描述首句与官方逐字一致',
    bare.description.startsWith('Execute a bash command (`bash -c`) and return its stdout/stderr. '))
  check('描述含 $DSH_* 与沙箱拒绝说明（官方逐字片段）',
    bare.description.includes('managed `$DSH_*` variables')
    && bare.description.includes('[sandbox: file access denied under <mode> mode]'))
  check('背景任务那句在（默认暴露 run_in_background）',
    bare.description.includes('Set `run_in_background: true` for long-running commands'))
  check('没有沙箱服务时不暴露升级参数', !('sandbox_permissions' in bare.parameters.properties))
  check('参数必填只有 command / description',
    JSON.stringify(bare.parameters.required) === '["command","description"]',
    JSON.stringify(bare.parameters.required))
  check('对象参数显式 additionalProperties:false（DSH schema 子集要求）',
    bare.parameters.additionalProperties === false && bare.parameters.type === 'object')
  check('输出 schema 是前台/后台 two-branch oneOf',
    Array.isArray(bare.output.schema.oneOf) && bare.output.schema.oneOf.length === 2)
  check('输出 schema 两支的 const 正确',
    bare.output.schema.oneOf[0].properties.kind.const === 'background'
    && bare.output.schema.oneOf[1].properties.kind.const === 'foreground')
  check('前台支必填字段齐全（缺一个 registry 就会拒绝）',
    JSON.stringify(bare.output.schema.oneOf[1].required)
      === '["kind","exitCode","signal","timedOut","aborted","timeoutMs","stdout","stderr"]',
    JSON.stringify(bare.output.schema.oneOf[1].required))

  const boxed = pure.createBashTool(
    { subprocess: dead, sandbox: { confine: async () => ({}) }, sandboxPolicy: { resolve: () => ({}) } },
    { bashPath: 'D:/Git/bin/bash.exe' },
  )
  check('有沙箱服务时暴露升级参数（枚举=官方两档）',
    JSON.stringify(boxed.parameters.properties.sandbox_permissions.enum) === '["workspace-write","danger-full-access"]',
    JSON.stringify(boxed.parameters.properties.sandbox_permissions?.enum))
  check('有升级面时描述带上"同一轮内立刻升级"那段',
    boxed.description.includes('escalate immediately in the same turn'))
  check('升级参数只在有工作目录说明时才出现 justification',
    typeof boxed.parameters.properties.justification.description === 'string')
}

console.log('10. 超时收敛（官方 clamp 语义）')
{
  check('不给 → 默认 120s', pure.clampTimeout(undefined, pure.DEFAULT_TIMEOUT_MS, pure.MAX_TIMEOUT_MS) === 120000)
  check('给的比默认小 → 抬到默认', pure.clampTimeout(10, 120000, 600000) === 120000)
  check('给的比上限大 → 压到上限', pure.clampTimeout(9_999_999, 120000, 600000) === 600000)
  check('区间内 → 原样', pure.clampTimeout(300000, 120000, 600000) === 300000)
  check('非数/负数/0 → 默认', pure.clampTimeout(-5, 120000, 600000) === 120000
    && pure.clampTimeout(Number.NaN, 120000, 600000) === 120000)
}

// ══════════════ 11. 执行路径（假 subprocess 驱动）═══════════════════════════
console.log('11. 执行路径：argv / cwd / env / 渲染')
{
  /** 一个把固定文本当作 stdout 的 reader。 */
  const reader = (text) => ({ readFrom: (from) => ({ text: text.slice(from), nextOffset: text.length, lossy: false }) })
  /** 立刻结束的假 handle。 */
  const doneHandle = (text, outcome) => ({
    collected: { stdout: reader(text), stderr: reader('') },
    done: Promise.resolve(outcome),
    terminate: () => {},
  })
  /** 记录 spawn 规格的假 subprocess。 */
  const fakeSpawn = (make) => {
    const spawns = []
    return { spawns, spawn: (spec) => { spawns.push(spec); return make(spec) } }
  }
  const exec = (over = {}) => ({
    callId: 'c1', signal: new AbortController().signal,
    agent: { session: { header: { cwd: 'D:/work' } } }, ...over,
  })
  const newTool = (deps, options = {}) => pure.createBashTool(deps, {
    bashPath: 'D:/Git/bin/bash.exe', sep: '\\', isAbsolute: p => /^[A-Za-z]:[\\/]/.test(p), ...options,
  })

  {
    const sub = fakeSpawn(() => doneHandle('hello\n', { exitCode: 0, signal: null }))
    const tool = newTool({ subprocess: sub })
    const value = await tool.execute({ command: 'echo hello', description: 'say hi' }, exec())
    check('argv = [bash, -c, command]（shell 形状交给 bash -c）',
      JSON.stringify(sub.spawns[0].argv) === '["D:/Git/bin/bash.exe","-c","echo hello"]',
      JSON.stringify(sub.spawns[0].argv))
    check('cwd 取自会话 cwd', sub.spawns[0].cwd === 'D:/work', sub.spawns[0].cwd)
    check('env 带官方三条压制项（NoColor/TERM/PAGER）',
      sub.spawns[0].env.NO_COLOR === '1' && sub.spawns[0].env.TERM === 'dumb' && sub.spawns[0].env.PAGER === 'cat')
    check('stdio 用 collect + spill（有上限，不会无限吃内存）',
      sub.spawns[0].stdio.stdout.maxBytes === 64000 && sub.spawns[0].stdio.stdout.spill.maxBytes === 64 * 1024 * 1024)
    check('返回值带 kind:foreground 与官方字段',
      value.kind === 'foreground' && value.exitCode === 0 && value.timedOut === false && value.aborted === false
      && value.timeoutMs === 120000, JSON.stringify(value))
    check('渲染就是 stdout 原文（干净退出不打标记）', tool.output.render({}, value)[0].text === 'hello\n')
  }
  {
    const sub = fakeSpawn(() => doneHandle('boom', { exitCode: 3, signal: null }))
    const tool = newTool({ subprocess: sub })
    const value = await tool.execute({ command: 'false', description: 'fail' }, exec())
    check('非零退出不是错误，只是末尾标记',
      tool.output.render({}, value)[0].text === 'boom\n[exit code: 3]',
      tool.output.render({}, value)[0].text)
  }
  {
    const sub = fakeSpawn(() => doneHandle('hi', { exitCode: 0, signal: null }))
    const tool = newTool({ subprocess: sub })
    const call = tool.presentCall({ command: 'ls', description: 'list' })
    check('presentCall 用官方 terminal 卡片形状',
      call.card === 'terminal' && call.title === 'ls' && call.description === 'list',
      JSON.stringify(call))
    const value = await tool.execute({ command: 'ls', description: 'list' }, exec())
    const shown = tool.presentResult({ command: 'ls', description: 'list' }, { content: tool.output.render({}, value), isError: false })
    check('presentResult 把 exit 状态拆成 pill（正文里不再有标记）',
      shown.card === 'terminal' && shown.exitCode === 0 && shown.output === 'hi', JSON.stringify(shown))
  }
  {
    // 参数校验：官方逐字文案
    const tool = newTool({ subprocess: fakeSpawn(() => doneHandle('', { exitCode: 0, signal: null })) })
    const fails = async (args) => { try { await tool.execute(args, exec()); return '' } catch (error) { return String(error.message ?? error) } }
    check('空 command → 官方文案', await fails({ command: '  ', description: 'x' })
      === 'invalid command: expected a non-empty string')
    check('空 description → 官方文案', await fails({ command: 'ls', description: '' })
      === 'invalid description: expected a non-empty string')
    check('非法 timeoutMs → 官方文案', await fails({ command: 'ls', description: 'x', timeoutMs: -1 })
      === 'invalid timeoutMs: expected a positive number, got -1')
    check('sandbox_permissions 缺 justification → 官方文案',
      await fails({ command: 'ls', description: 'x', sandbox_permissions: 'workspace-write' })
      === 'invalid escalation: sandbox_permissions requires a justification')
  }
}

console.log('12. confine 必须 await（装在你机器上的 B 就栽在这里）')
{
  const seen = []
  const sub = {
    spawns: [],
    spawn(spec) { this.spawns.push(spec); return {
      collected: { stdout: { readFrom: () => ({ text: 'ok', nextOffset: 2, lossy: false }) }, stderr: { readFrom: () => ({ text: '', nextOffset: 0, lossy: false }) } },
      done: Promise.resolve({ exitCode: 0, signal: null }), terminate() {},
    } },
  }
  const sandbox = {
    confine: async (argv, policy) => {
      seen.push({ argv, policy })
      // 模拟真实实现：**返回 Promise**，argv 是包了 runner 之后的
      return { argv: ['RUNNER', '--profile', ...argv], enforcement: 'full', denialSignatures: ['EROFS'], runnerFailureRules: [] }
    },
  }
  const sandboxPolicy = { resolve: () => ({ mode: 'read-only', workspaceRoot: 'D:/ws' }) }
  const tool = pure.createBashTool({ subprocess: sub, sandbox, sandboxPolicy }, {
    bashPath: 'D:/Git/bin/bash.exe', sep: '\\', isAbsolute: p => /^[A-Za-z]:[\\/]/.test(p),
  })
  const value = await tool.execute({ command: 'cat a', description: 'read a' }, {
    callId: 'c1', signal: new AbortController().signal, agent: { session: { header: { cwd: 'D:/sess' } } },
  })
  check('confine 被调用，且拿到的是 shell 形状的 argv',
    JSON.stringify(seen[0].argv) === '["D:/Git/bin/bash.exe","-c","cat a"]', JSON.stringify(seen[0]?.argv))
  check('实际 spawn 的是 **confine 返回的** argv（没 await 就会是 undefined/原 argv）',
    JSON.stringify(sub.spawns[0].argv) === '["RUNNER","--profile","D:/Git/bin/bash.exe","-c","cat a"]',
    JSON.stringify(sub.spawns[0].argv))
  check('受限模式下工作目录用策略的 workspaceRoot（官方行为）',
    sub.spawns[0].cwd === 'D:/ws', sub.spawns[0].cwd)
  check('策略 mode 传进 confine', seen[0].policy.mode === 'read-only', JSON.stringify(seen[0]?.policy))
  check('无拒绝特征时不带 sandbox 字段', value.sandbox === undefined, JSON.stringify(value.sandbox))
}
{
  // 拒绝：stderr 命中 denialSignatures 且退出非 0 → 带 sandbox.denied
  const sub = {
    spawn: () => ({
      collected: {
        stdout: { readFrom: () => ({ text: '', nextOffset: 0, lossy: false }) },
        stderr: { readFrom: () => ({ text: 'EROFS: read-only', nextOffset: 16, lossy: false }) },
      },
      done: Promise.resolve({ exitCode: 1, signal: null }), terminate() {},
    }),
  }
  const tool = pure.createBashTool({
    subprocess: sub,
    sandbox: { confine: async argv => ({ argv, enforcement: 'full', denialSignatures: ['EROFS'], runnerFailureRules: [] }) },
    sandboxPolicy: { resolve: () => ({ mode: 'workspace-write', workspaceRoot: 'D:/ws' }) },
  }, { bashPath: 'D:/Git/bin/bash.exe', sep: '\\', isAbsolute: p => /^[A-Za-z]:[\\/]/.test(p) })
  const value = await tool.execute({ command: 'rm -rf /', description: 'delete' }, { callId: 'c', signal: new AbortController().signal })
  check('命中拒绝特征 → sandbox.denied 且 mode 是本次策略',
    value.sandbox?.denied === true && value.sandbox.mode === 'workspace-write', JSON.stringify(value.sandbox))
  check('拒绝时渲染出拒绝标记 + 升级提示（顺序在 exit 之前）',
    tool.output.render({}, value)[0].text.includes('file access denied under workspace-write mode')
    && tool.output.render({}, value)[0].text.endsWith('[exit code: 1]'))
}

console.log('13. 升级路径（真的走审批）')
{
  const sub = {
    spawns: [],
    spawn(spec) { this.spawns.push(spec); return {
      collected: { stdout: { readFrom: () => ({ text: 'wrote', nextOffset: 5, lossy: false }) }, stderr: { readFrom: () => ({ text: '', nextOffset: 0, lossy: false }) } },
      done: Promise.resolve({ exitCode: 0, signal: null }), terminate() {},
    } },
  }
  const asked = []
  const sandboxPolicy = { resolve: () => ({ mode: 'read-only', workspaceRoot: 'D:/ws' }) }
  const sandbox = { confine: async (argv, policy) => ({ argv, enforcement: 'full', denialSignatures: [], runnerFailureRules: [] }) }
  const tool = pure.createBashTool({
    subprocess: sub, sandbox, sandboxPolicy,
    approval: { request: async (req) => { asked.push(req); return 'allowed-once' } },
  }, { bashPath: 'D:/Git/bin/bash.exe', sep: '\\', isAbsolute: p => /^[A-Za-z]:[\\/]/.test(p) })
  const exec = { callId: 'call-9', signal: new AbortController().signal, agent: { session: { header: { cwd: 'D:/w' } } } }
  await tool.execute({ command: 'echo hi > a', description: 'write', sandbox_permissions: 'workspace-write', justification: '要写工作区文件' }, exec)
  check('审批理由用官方格式', asked[0]?.reason === 'escalate sandbox to workspace-write: 要写工作区文件', JSON.stringify(asked[0]))
  check('审批挂到这次调用（toolName/callId）',
    asked[0]?.toolName === 'bash' && asked[0]?.callId === 'call-9', JSON.stringify(asked[0]))

  const denied = pure.createBashTool({
    subprocess: sub, sandbox, sandboxPolicy,
    approval: { request: async () => 'rejected' },
  }, { bashPath: 'D:/Git/bin/bash.exe', sep: '\\', isAbsolute: p => /^[A-Za-z]:[\\/]/.test(p) })
  const failed = await denied.execute(
    { command: 'echo hi > a', description: 'write', sandbox_permissions: 'workspace-write', justification: '理由' }, exec,
  ).then(() => '', error => String(error.message ?? error))
  check('被拒 → 抛出官方文案（不执行）',
    failed === 'the user rejected escalating this command to "workspace-write"', failed)
}

console.log('14. 后台任务')
{
  const sub = {
    spawns: [],
    spawn(spec) {
      this.spawns.push(spec)
      return {
        collected: {
          stdout: { readFrom: (from) => ({ text: 'tick\n'.slice(from), nextOffset: 5, lossy: false }) },
          stderr: { readFrom: () => ({ text: '', nextOffset: 0, lossy: false }) },
        },
        done: Promise.resolve({ exitCode: 0, signal: null }), terminate() {},
      }
    },
  }
  const started = []
  const jobs = { start: (spec) => { started.push(spec); return 'bash-7' } }
  const tool = pure.createBashTool({ subprocess: sub, jobs }, {
    bashPath: 'D:/Git/bin/bash.exe', sep: '\\', isAbsolute: p => /^[A-Za-z]:[\\/]/.test(p),
  })
  const value = await tool.execute({ command: 'long', description: 'run long', run_in_background: true }, {
    callId: 'c', signal: new AbortController().signal, agent: { session: { header: { cwd: 'D:/w' } } },
  })
  check('返回 kind:background + jobId（官方形状）',
    value.kind === 'background' && value.jobId === 'bash-7', JSON.stringify(value))
  check('job 用官方 kind/label（kind 用内置的 bash）',
    started[0].kind === 'bash' && started[0].label === 'long', JSON.stringify({ kind: started[0].kind, label: started[0].label }))
  check('渲染成交付给模型的那句', tool.output.render({}, value)[0].text === 'started background job bash-7')
  const hooks = started[0].run()
  check('hooks 形状完整（cancel/done/readOutput）',
    typeof hooks.cancel === 'function' && typeof hooks.readOutput === 'function' && typeof hooks.done.then === 'function')
  check('readOutput 读得到增量', hooks.readOutput() === 'tick\n', JSON.stringify(hooks.readOutput()))
  const outcome = await hooks.done
  check('done 报 exit code（官方 detail 形状）', outcome.status === 'completed' && outcome.detail === 'exit code: 0', JSON.stringify(outcome))

  const noJobs = pure.createBashTool({ subprocess: sub }, { bashPath: 'D:/Git/bin/bash.exe' })
  const failed = await noJobs.execute({ command: 'x', description: 'y', run_in_background: true },
    { callId: 'c', signal: new AbortController().signal })
    .then(() => '', error => String(error.message ?? error))
  check('没有 jobs 服务 → 官方文案（不静默降级）',
    failed === 'background jobs unavailable: load @deepseek-ai/dsh-jobs and @deepseek-ai/dsh-tool-jobs', failed)
}

console.log('15. 中止与超时')
{
  const exec = (signal) => ({ callId: 'c', signal, agent: { session: { header: { cwd: 'D:/w' } } } })
  {
    // 中止：caller 的 signal 已 abort，spawn 出来的 handle 结束 → 抛 AbortError
    const controller = new AbortController()
    const sub = {
      spawn: () => ({
        collected: { stdout: { readFrom: () => ({ text: '', nextOffset: 0, lossy: false }) }, stderr: { readFrom: () => ({ text: '', nextOffset: 0, lossy: false }) } },
        done: (async () => { controller.abort(); return { exitCode: null, signal: 'SIGTERM' } })(),
        terminate: () => {},
      }),
    }
    const tool = pure.createBashTool({ subprocess: sub }, { bashPath: 'D:/Git/bin/bash.exe', sep: '\\', isAbsolute: p => /^[A-Za-z]:[\\/]/.test(p) })
    const error = await tool.execute({ command: 'sleep 9', description: 'wait' }, exec(controller.signal))
      .then(() => undefined, e => e)
    check('调用方中止 → 抛错', error !== undefined)
    check('错误带 name=AbortError 与 code=ABORTED（registry 靠这两个字段收尾）',
      error?.name === 'AbortError' && error?.code === 'ABORTED',
      JSON.stringify({ name: error?.name, code: error?.code }))
    check('错误文案是官方那句', String(error?.message) === 'tool call aborted', String(error?.message))
  }
  {
    // 超时：注入 5ms 下限，假 handle 不主动结束，由 terminate 解决
    let resolveDone
    const sub = {
      spawn: () => ({
        collected: { stdout: { readFrom: () => ({ text: '', nextOffset: 0, lossy: false }) }, stderr: { readFrom: () => ({ text: '', nextOffset: 0, lossy: false }) } },
        done: new Promise(resolve => { resolveDone = resolve }),
        terminate: () => resolveDone({ exitCode: null, signal: 'SIGTERM' }),
      }),
    }
    const tool = pure.createBashTool({ subprocess: sub }, {
      bashPath: 'D:/Git/bin/bash.exe', sep: '\\', isAbsolute: p => /^[A-Za-z]:[\\/]/.test(p),
      timeoutMs: 5, maxTimeoutMs: 5,
    })
    const value = await tool.execute({ command: 'sleep 9', description: 'wait' }, exec(new AbortController().signal))
    check('超时 → timedOut=true、timeoutMs 是收敛值', value.timedOut === true && value.timeoutMs === 5, JSON.stringify({ timedOut: value.timedOut, timeoutMs: value.timeoutMs }))
    const text = tool.output.render({}, value)[0].text
    check('超时渲染带 [timed out after 5ms] 与信号标记',
      text.includes('[timed out after 5ms]') && text.includes('[killed by signal: SIGTERM]'), JSON.stringify(text))
    check('超时**不是**错误（不抛）', value.kind === 'foreground')
  }
}

console.log('16. 宿主半接线：按会话下发 + 立刻覆盖在跑会话')
{
  /** 一个假 agent：捕获它 scope 上发生的每件事。 */
  const makeAgent = () => {
    const capture = { restricts: [], registers: [], sections: [], waterfalls: [], lifted: 0 }
    return {
      capture,
      ctx: {
        tools: {
          restrict: (filter) => { capture.restricts.push(filter); return () => { capture.lifted += 1 } },
          register: (definition) => { capture.registers.push(definition); return () => {} },
        },
        systemPrompt: { section: (section) => { capture.sections.push(section); return () => {} } },
        on: (event, listener) => { capture.waterfalls.push({ event, listener }); return () => {} },
      },
    }
  }
  /** 一个假宿主 ctx（只提供子系统真正会用到的那几样）。 */
  const makeCtx = (agents) => {
    const listeners = new Map()
    const services = { agents: { list: () => agents }, connection: { requestRejection: () => undefined } }
    return {
      get: name => services[name],
      on: (event, fn) => { const list = listeners.get(event) ?? []; list.push(fn); listeners.set(event, list); return () => {} },
      effect: (fn) => { const dispose = fn(); return () => { if (typeof dispose === 'function') dispose() } },
      webServer: { register: () => () => {} },
      emit: (event, payload) => { for (const fn of listeners.get(event) ?? []) fn(payload) },
    }
  }
  /** 一份探测结果。 */
  const found = (paths) => ({
    candidates: paths.map(path => ({ path, kind: path.includes('/Git/') ? 'git' : 'niubash', label: path.includes('/Git/') ? 'Git for Windows' : 'Niubash（牛 bash）', explicit: false })),
    excluded: [],
  })
  const settingsWith = (row) => {
    const writes = []
    return {
      writes,
      get: () => row,
      mutate: async (_ns, ops) => {
        for (const op of ops) {
          if (op.op === 'set') { row[op.path[0]] = op.value; writes.push({ path: op.path[0], value: op.value }) }
        }
      },
    }
  }
  const writeOf = (settings, field) => settings.writes.filter(write => write.path === field).at(-1)?.value

  {
    // 用户选了"自动"，机器上有 Git Bash，且已经有两个在跑的会话
    const agents = [makeAgent(), makeAgent()]
    const ctx = makeCtx(agents)
    const settings = settingsWith({ terminalEnabled: true, terminalMode: 'auto', terminalBashPath: '' })
    pure.installTerminalPolicy(ctx, 'composer-ux', settings, () => ({ subprocess: { spawn: () => { throw new Error('不该 spawn') } } }), {
      platform: 'win32',
      discover: () => found(['D:/Git/bin/bash.exe', 'C:/x/Niubash/niu.exe']),
      exists: () => true,
    })
    await new Promise(resolve => setTimeout(resolve, 0))
    check('在跑的两个会话**当场**就拿到了限制（不用等新会话）',
      agents.every(agent => agent.capture.restricts.length === 1), JSON.stringify(agents.map(a => a.capture.restricts.length)))
    check('限制内容是 deny pwsh',
      agents.every(agent => JSON.stringify(agent.capture.restricts[0]) === '{"deny":["pwsh"]}'),
      JSON.stringify(agents[0].capture.restricts[0]))
    check('每个会话都注册了 bash 工具',
      agents.every(agent => agent.capture.registers.length === 1 && agent.capture.registers[0].name === 'bash'),
      JSON.stringify(agents.map(a => a.capture.registers.map(r => r.name))))
    check('注册的工具用的是探测到的那条路径（Git Bash 优先）',
      agents[0].capture.registers[0].parameters.properties.command.type === 'string'
      && JSON.stringify(agents[0].capture.registers[0].parameters.required) === '["command","description"]')
    check('提示词段：tool:bash 在官方顺序 1000 上',
      agents.every(agent => agent.capture.sections.some(s => s.name === 'tool:bash' && s.order === 1000)),
      JSON.stringify(agents[0].capture.sections.map(s => [s.name, s.order])))
    check('提示词段：注册了作用域内的装配钩子（用来摘掉 tool:pwsh 段）',
      agents.every(agent => agent.capture.waterfalls.some(w => w.event === 'system-prompt/assemble')))
    {
      const hook = agents[0].capture.waterfalls.find(w => w.event === 'system-prompt/assemble').listener
      const assembly = { sections: [{ name: 'tool:pwsh' }, { name: 'tool:bash' }, { name: 'x' }], tools: [], contexts: [], variables: {} }
      const out = await hook(assembly, {}, async () => assembly)
      check('该钩子只摘掉 tool:pwsh，别的段一个不动',
        JSON.stringify(out.sections.map(s => s.name)) === '["tool:bash","x"]',
        JSON.stringify(out.sections.map(s => s.name)))
    }
    check('状态回写：生效 bash', writeOf(settings, 'terminalEffective') === 'bash', String(writeOf(settings, 'terminalEffective')))
    check('状态行给出路径与来源',
      String(writeOf(settings, 'terminalStatus')).includes('已生效：D:/Git/bin/bash.exe（Git for Windows）'),
      String(writeOf(settings, 'terminalStatus')))
    check('候选表被落盘（设置页可以列出来）',
      JSON.stringify(writeOf(settings, 'terminalCandidates')?.map(c => c.path))
        === '["D:/Git/bin/bash.exe","C:/x/Niubash/niu.exe"]',
      JSON.stringify(writeOf(settings, 'terminalCandidates')))
  }
  {
    // 新会话出现 → 立刻拿到同样的下发
    const agents = [makeAgent()]
    const ctx = makeCtx(agents)
    const settings = settingsWith({ terminalEnabled: true, terminalMode: 'auto', terminalBashPath: '' })
    pure.installTerminalPolicy(ctx, 'composer-ux', settings, () => ({ subprocess: {} }), {
      platform: 'win32', discover: () => found(['D:/Git/bin/bash.exe']), exists: () => true,
    })
    await new Promise(resolve => setTimeout(resolve, 0))
    const fresh = makeAgent()
    agents.push(fresh)
    ctx.emit('agent/created', { agent: fresh })
    check('新会话创建时也会被下发（agent/created）',
      fresh.capture.restricts.length === 1 && fresh.capture.registers.length === 1,
      JSON.stringify({ restricts: fresh.capture.restricts.length, registers: fresh.capture.registers.length }))
    ctx.emit('agent/created', { agent: fresh })
    check('同一个会话不会重复下发（幂等）', fresh.capture.restricts.length === 1, String(fresh.capture.restricts.length))
  }
  {
    // 用户选"保持 PowerShell" → 一条都不下，并如实回写
    const agents = [makeAgent()]
    const ctx = makeCtx(agents)
    const settings = settingsWith({ terminalMode: 'pwsh', terminalBashPath: '' })
    pure.installTerminalPolicy(ctx, 'composer-ux', settings, () => ({ subprocess: {} }), {
      platform: 'win32', discover: () => found(['D:/Git/bin/bash.exe']), exists: () => true,
    })
    await new Promise(resolve => setTimeout(resolve, 0))
    check('选 PowerShell 时完全不介入（不 restrict、不注册）',
      agents[0].capture.restricts.length === 0 && agents[0].capture.registers.length === 0
      && agents[0].capture.sections.length === 0,
      JSON.stringify(agents[0].capture))
    check('状态回写：生效 pwsh', writeOf(settings, 'terminalEffective') === 'pwsh', String(writeOf(settings, 'terminalEffective')))
    check('状态行说明本插件不介入',
      String(writeOf(settings, 'terminalStatus')).includes('保持 DSH 默认'), String(writeOf(settings, 'terminalStatus')))
  }
  {
    // 切到 PowerShell 之后，之前下发过的会话要**被撤销**
    const agents = [makeAgent()]
    const ctx = makeCtx(agents)
    const row = { terminalEnabled: true, terminalMode: 'auto', terminalBashPath: '' }
    const settings = settingsWith(row)
    pure.installTerminalPolicy(ctx, 'composer-ux', settings, () => ({ subprocess: {} }), {
      platform: 'win32', discover: () => found(['D:/Git/bin/bash.exe']), exists: () => true,
    })
    await new Promise(resolve => setTimeout(resolve, 0))
    row.terminalMode = 'pwsh'
    ctx.emit('settings/updated', 'composer-ux')
    await new Promise(resolve => setTimeout(resolve, 0))
    check('切回 PowerShell → 之前下发的限制被撤销（lift 被调用）',
      agents[0].capture.lifted === 1, String(agents[0].capture.lifted))
    check('撤销后状态回写 pwsh', writeOf(settings, 'terminalEffective') === 'pwsh', String(writeOf(settings, 'terminalEffective')))
  }
  {
    // 「默认终端」这一栏关着（拉到 off）→ 一条都不下，并把先前下发的撤销掉。
    // 这是 0.5.0「每一栏一个开关」的核心行为：栏关 = 这一块完全不介入。
    const agents = [makeAgent()]
    const ctx = makeCtx(agents)
    const row = { terminalEnabled: true, terminalMode: 'auto', terminalBashPath: '' }
    const settings = settingsWith(row)
    pure.installTerminalPolicy(ctx, 'composer-ux', settings, () => ({ subprocess: {} }), {
      platform: 'win32', discover: () => found(['D:/Git/bin/bash.exe']), exists: () => true,
    })
    await new Promise(resolve => setTimeout(resolve, 0))
    check('前置：栏开着时确实接管了', agents[0].capture.restricts.length === 1,
      JSON.stringify({ restricts: agents[0].capture.restricts.length }))

    row.terminalEnabled = false
    ctx.emit('settings/updated', 'composer-ux')
    await new Promise(resolve => setTimeout(resolve, 0))
    check('关掉这一栏 → 先前下发的限制被撤销', agents[0].capture.lifted === 1, String(agents[0].capture.lifted))
    check('关掉这一栏 → 状态行写明「未启用」',
      String(writeOf(settings, 'terminalStatus')).includes('未启用'), String(writeOf(settings, 'terminalStatus')))
    check('关掉这一栏 → effective 回到 pwsh', writeOf(settings, 'terminalEffective') === 'pwsh',
      String(writeOf(settings, 'terminalEffective')))
    check('关掉这一栏 → 候选清空（不留一堆看起来已生效的路径）',
      Array.isArray(writeOf(settings, 'terminalCandidates'))
      && writeOf(settings, 'terminalCandidates').length === 0,
      JSON.stringify(writeOf(settings, 'terminalCandidates')))
  }
  {
    // 总开关是总闸：它一关，终端这一栏也必须停（栏开关还开着也没用）。
    const agents = [makeAgent()]
    const ctx = makeCtx(agents)
    const row = { enabled: true, terminalEnabled: true, terminalMode: 'auto', terminalBashPath: '' }
    const settings = settingsWith(row)
    pure.installTerminalPolicy(ctx, 'composer-ux', settings, () => ({ subprocess: {} }), {
      platform: 'win32', discover: () => found(['D:/Git/bin/bash.exe']), exists: () => true,
    })
    await new Promise(resolve => setTimeout(resolve, 0))
    row.enabled = false
    ctx.emit('settings/updated', 'composer-ux')
    await new Promise(resolve => setTimeout(resolve, 0))
    check('总开关关掉 → 终端接管同样被撤销（栏开关开着也不算数）',
      agents[0].capture.lifted === 1, String(agents[0].capture.lifted))
  }
  {
    // 找不到 bash（或只有 WSL 被排除）→ 保持 pwsh，并说明原因
    const agents = [makeAgent()]
    const ctx = makeCtx(agents)
    const settings = settingsWith({ terminalEnabled: true, terminalMode: 'auto', terminalBashPath: '' })
    pure.installTerminalPolicy(ctx, 'composer-ux', settings, () => ({ subprocess: {} }), {
      platform: 'win32',
      discover: () => ({ candidates: [], excluded: [{ path: 'C:/WINDOWS/system32/bash.exe', reason: pure.WSL_REASON }] }),
      exists: () => true,
    })
    await new Promise(resolve => setTimeout(resolve, 0))
    check('没有可用 bash → 不下发任何东西',
      agents[0].capture.restricts.length === 0 && agents[0].capture.registers.length === 0)
    check('状态行如实说明"没找到"与"已排除 WSL"',
      String(writeOf(settings, 'terminalStatus')).includes('没找到可用的 bash')
      && String(writeOf(settings, 'terminalStatus')).includes('已排除 1 个 WSL'),
      String(writeOf(settings, 'terminalStatus')))
  }
  {
    // 非 Windows → 不接管，状态说明平台
    const agents = [makeAgent()]
    const ctx = makeCtx(agents)
    const settings = settingsWith({ terminalEnabled: true, terminalMode: 'auto', terminalBashPath: '' })
    pure.installTerminalPolicy(ctx, 'composer-ux', settings, () => ({}), {
      platform: 'darwin', discover: () => found([]), exists: () => true,
    })
    await new Promise(resolve => setTimeout(resolve, 0))
    check('非 Windows：不介入会话',
      agents[0].capture.restricts.length === 0 && agents[0].capture.registers.length === 0
      && agents[0].capture.sections.length === 0)
    check('非 Windows：状态写 unsupported', writeOf(settings, 'terminalEffective') === 'unsupported',
      String(writeOf(settings, 'terminalEffective')))
  }
  {
    // 宿主没有 subprocess（拿不到命令执行服务）→ 只压制 pwsh，并如实说明
    const agents = [makeAgent()]
    const ctx = makeCtx(agents)
    const settings = settingsWith({ terminalEnabled: true, terminalMode: 'auto', terminalBashPath: '' })
    pure.installTerminalPolicy(ctx, 'composer-ux', settings, () => undefined, {
      platform: 'win32', discover: () => found(['D:/Git/bin/bash.exe']), exists: () => true,
    })
    await new Promise(resolve => setTimeout(resolve, 0))
    check('没有 subprocess：仍然压制 pwsh（先保住"只留一个 shell"）',
      agents[0].capture.restricts.length === 1 && agents[0].capture.registers.length === 0,
      JSON.stringify({ restricts: agents[0].capture.restricts.length, registers: agents[0].capture.registers.length }))
    check('并在状态行写明降级原因',
      String(writeOf(settings, 'terminalStatus')).includes('宿主没有 subprocess 服务'),
      String(writeOf(settings, 'terminalStatus')))
  }
}

console.log('17. 常见安装来源（联网查到的那批，逐条覆盖）')
{
  const S = 'C:/Users/u/AppData/Local'
  const BASE_ENV = {
    ProgramFiles: 'C:/Program Files',
    'ProgramFiles(x86)': 'C:/Program Files (x86)',
    ProgramW6432: 'C:/Program Files',
    LOCALAPPDATA: S,
    USERPROFILE: 'C:/Users/u',
    ProgramData: 'C:/ProgramData',
  }
  /** 跑一次探测：files = 存在的文件；dirs = 目录列举结果（模拟 listDirs）。 */
  const run = (files, dirs = {}, options = {}) => pure.discoverBashCandidates({
    exists: fakeFs(files).exists,
    pathEntries: options.pathEntries ?? [],
    env: name => (options.env ?? {})[name] ?? BASE_ENV[name],
    ...(options.noListDirs === true ? {} : { listDirs: parent => dirs[pure.normalizePath(parent)] ?? [] }),
    ...(options.explicitPath === undefined ? {} : { explicitPath: options.explicitPath }),
  })

  {
    const r = run(['C:/scoop/apps/git/current/bin/bash.exe'], {}, { env: { SCOOP: 'C:/scoop' } })
    const hit = r.candidates.find(c => c.path.includes('scoop'))
    check('Scoop 的 git 被找到（标签写明来源）',
      hit !== undefined && hit.label === 'Scoop 的 git' && hit.kind === 'git', JSON.stringify(hit))
  }
  {
    const r = run(['C:/ProgramData/chocolatey/lib/git.portable/tools/bin/bash.exe'])
    check('Chocolatey 便携包被找到',
      r.candidates[0]?.label === 'Chocolatey 便携包', JSON.stringify(r.candidates[0]))
    const viaEnv = run(['D:/choco/lib/git.portable/tools/usr/bin/bash.exe'], {}, { env: { ChocolateyInstall: 'D:/choco' } })
    check('Chocolatey 自定义安装目录（ChocolateyInstall）也认',
      viaEnv.candidates[0]?.label === 'Chocolatey 便携包', JSON.stringify(viaEnv.candidates[0]))
  }
  {
    const root = `${S}/GitHubDesktop`
    const r = run(
      [`${root}/app-3.4.3/resources/app/git/bin/bash.exe`, `${root}/app-3.3.0/resources/app/git/bin/bash.exe`],
      { [root]: ['app-3.3.0', 'app-3.4.3'] },
    )
    const hits = r.candidates.filter(c => c.label === 'GitHub Desktop 内嵌')
    check('GitHub Desktop 内嵌（带版本号）两个版本都找到', hits.length === 2, JSON.stringify(hits.map(c => c.path)))
    check('版本按名字倒序：新的排在前面', hits[0]?.path.includes('app-3.4.3'), JSON.stringify(hits.map(c => c.path)))
  }
  {
    const root = `${S}/GitHub`
    const r = run([`${root}/PortableGit_abc123/bin/bash.exe`, `${root}/PortableGit_abc123/usr/bin/bash.exe`],
      { [root]: ['PortableGit_abc123', 'something-else'] })
    const hits = r.candidates.filter(c => c.label === 'GitHub PortableGit')
    check('旧 GitHub 的 PortableGit_<哈希> 被找到（只认 PortableGit 前缀，且只留 bin 那个）',
      hits.length === 1 && hits[0].path.endsWith('PortableGit_abc123/bin/bash.exe'),
      JSON.stringify(r.candidates.map(c => [c.path, c.label])))
  }
  {
    const vs = 'C:/Program Files/Microsoft Visual Studio'
    const r = run([`${vs}/2022/Community/Common7/IDE/CommonExtensions/Microsoft/TeamFoundation/Team Explorer/Git/usr/bin/bash.exe`],
      { [vs]: ['2022'], [`${vs}/2022`]: ['Community', 'Professional'] })
    check('Visual Studio 内嵌 Git 被找到',
      r.candidates[0]?.label === 'Visual Studio 内嵌', JSON.stringify(r.candidates[0]))
  }
  {
    const r = run(['E:/PortableGit/bin/bash.exe'])
    check('盘符根下的 PortableGit 被找到（E:\\PortableGit）',
      r.candidates[0]?.path === 'E:/PortableGit/bin/bash.exe'
      && r.candidates[0]?.label === 'PortableGit（自解压）' && r.candidates[0]?.kind === 'git',
      JSON.stringify(r.candidates[0]))
    const msys = run(['F:/msys64/usr/bin/bash.exe'])
    check('盘符根下的 msys64 被找到且归类为 MSYS2',
      msys.candidates[0]?.kind === 'msys2' && msys.candidates[0]?.label === 'MSYS2', JSON.stringify(msys.candidates[0]))
  }
  {
    const r = run(['D:/Git/bin/bash.exe'])
    check('盘符根下的 Git（D:\\Git，不在 PATH 上也能找到）',
      r.candidates[0]?.path === 'D:/Git/bin/bash.exe' && r.candidates[0]?.label === 'Git for Windows',
      JSON.stringify(r.candidates[0]))
  }
  {
    // A:/B: 是软驱位，不扫；没有权限的目录列举也不能让它崩
    const r = run(['A:/Git/bin/bash.exe'], {}, {
      noListDirs: false,
    })
    check('A: 盘不被当作可扫盘符', r.candidates.length === 0, JSON.stringify(r.candidates.map(c => c.path)))
    const throwing = pure.discoverBashCandidates({
      exists: fakeFs(['C:/Git/bin/bash.exe']).exists,
      pathEntries: [],
      env: name => BASE_ENV[name],
      listDirs: () => { throw new Error('EACCES') },
    })
    check('列目录抛错时探测不崩、仍返回候选',
      throwing.candidates.some(c => c.path === 'C:/Git/bin/bash.exe'), JSON.stringify(throwing.candidates.map(c => c.path)))
    const without = run([`${S}/GitHubDesktop/app-1.0.0/resources/app/git/bin/bash.exe`], {}, { noListDirs: true })
    check('没注入 listDirs 时退化成纯存在性检查（版本化的来源找不到，但不崩）',
      without.candidates.length === 0, JSON.stringify(without.candidates.map(c => c.path)))
  }
  {
    // 优先级：PATH 上正在用的 git > 其它来源；显式路径永远第一
    const r = run(
      ['D:/Git/bin/bash.exe', 'C:/Program Files/Git/bin/bash.exe', 'C:/scoop/apps/git/current/bin/bash.exe'],
      {},
      { pathEntries: ['D:/Git/cmd'], env: { SCOOP: 'C:/scoop' } },
    )
    check('PATH 上在用的 git 排在最前（不会被别的来源挤掉）',
      r.candidates[0]?.path === 'D:/Git/bin/bash.exe', JSON.stringify(r.candidates.map(c => c.path)))
    const withExplicit = run(['D:/Git/bin/bash.exe', 'E:/mine/bash.exe'], {}, { explicitPath: 'E:/mine/bash.exe' })
    check('显式路径仍然永远第一',
      withExplicit.candidates[0]?.path === 'E:/mine/bash.exe' && withExplicit.candidates[0]?.explicit === true,
      JSON.stringify(withExplicit.candidates.map(c => [c.path, c.explicit])))
  }
}

// ══════════════ 18. 裸本体（usr/bin、mingw64/bin）不再当候选 ═══════════════════
// 这一节在 section 17 的作用域之外，所以自带一个最小 run（只服务本节的夹具）。
console.log('18. 裸本体规则：同根有 bin 就不列 usr/bin（实测裸本体缺 head/grep/uname）')
const envOf18 = name => ({
  ProgramFiles: 'C:/Program Files',
  'ProgramFiles(x86)': 'C:/Program Files (x86)',
  ProgramW6432: 'C:/Program Files',
  LOCALAPPDATA: 'C:/Users/u/AppData/Local',
  USERPROFILE: 'C:/Users/u',
  ProgramData: 'C:/ProgramData',
})[name]
const run = (files, options = {}) => pure.discoverBashCandidates({
  exists: fakeFs(files).exists,
  pathEntries: options.pathEntries ?? [],
  env: name => (options.env ?? {})[name] ?? envOf18(name),
  listDirs: () => [],
  ...(options.explicitPath === undefined ? {} : { explicitPath: options.explicitPath }),
})
{
    // 「裸本体」规则：同根下有 bin/bash.exe 时，usr/bin 那份不再当候选（实测它缺 head/grep/uname）
    const both = run(['D:/Git/bin/bash.exe', 'D:/Git/usr/bin/bash.exe'], { pathEntries: ['D:/Git/cmd'] })
    check('同根有 bin → 不列 usr/bin 的裸本体',
      both.candidates.map(c => c.path).join(',') === 'D:/Git/bin/bash.exe',
      JSON.stringify(both.candidates.map(c => c.path)))
    const viaPath = run(['D:/Git/bin/bash.exe', 'D:/Git/usr/bin/bash.exe'], { pathEntries: ['D:/Git/usr/bin'] })
    check('PATH 上写的正是 usr/bin 时也不列裸本体（同一规则对 PATH 兜底同样生效）',
      viaPath.candidates.map(c => c.path).join(',') === 'D:/Git/bin/bash.exe',
      JSON.stringify(viaPath.candidates.map(c => c.path)))
    const msys = run(['C:/msys64/usr/bin/bash.exe'])
    check('没有 bin 兄弟的（MSYS2 只有 usr/bin）仍然列出',
      msys.candidates[0]?.path === 'C:/msys64/usr/bin/bash.exe' && msys.candidates[0]?.kind === 'msys2',
      JSON.stringify(msys.candidates.map(c => c.path)))
    const manual = run(['D:/Git/bin/bash.exe', 'D:/Git/usr/bin/bash.exe'], { explicitPath: 'D:/Git/usr/bin/bash.exe' })
    check('手填裸本体仍然生效（显式路径不受这条规则限制）',
      manual.candidates[0]?.path === 'D:/Git/usr/bin/bash.exe' && manual.candidates[0]?.explicit === true,
      JSON.stringify(manual.candidates.map(c => [c.path, c.explicit])))
    check('unpreparedBashRoot 只认裸本体',
      pure.unpreparedBashRoot('D:/Git/usr/bin/bash.exe') === 'D:/Git'
      && pure.unpreparedBashRoot('D:\\Git\\mingw64\\bin\\bash.exe') === 'D:/Git'
      && pure.unpreparedBashRoot('D:/Git/bin/bash.exe') === undefined
      && pure.unpreparedBashRoot('C:/msys64/usr/bin/bash.exe') === 'C:/msys64')
  }

// ══════════════ 19. 「要么整套换上、要么一点不换」：注册失败必须回滚 restrict ════════
// 这一节是从 A（converk/dsh-tweaks 的 git-bash-terminal-tool）的 `src/host/replace.ts`
// 里抄回来的纪律：它注册失败时调 `releaseRestriction()`，注释原话是「避免留下
// 『两个都看不见』的坏状态」。我们原来的实现只记一行 notes，restrict 留在那儿 →
// 该会话变成「pwsh 被挡住 + bash 不在」= 一个 shell 工具都调不到，而状态行还说"已生效"。
console.log('19. 注册失败要回滚 restrict（否则该会话没有任何 shell 工具）')
{
  /** 一个假 agent：可注入"注册抛错 / 注册不返回 disposer / restrict 抛错"三种故障。 */
  const makeAgent = (options = {}) => {
    const capture = { restricts: [], registers: [], sections: [], waterfalls: [], lifted: 0 }
    return {
      capture,
      ctx: {
        tools: {
          restrict: options.restrictThrows === true
            ? () => { throw new Error('names unknown global tool "pwsh"') }
            : (filter) => { capture.restricts.push(filter); return () => { capture.lifted += 1 } },
          register: options.register === 'throws'
            ? () => { throw new Error('unsupported JSON schema') }
            : options.register === 'no-disposer'
              ? (definition) => { capture.registers.push(definition); return undefined }
              : (definition) => { capture.registers.push(definition); return () => {} },
        },
        systemPrompt: { section: (section) => { capture.sections.push(section); return () => {} } },
        on: (event, listener) => { capture.waterfalls.push({ event, listener }); return () => {} },
      },
    }
  }
  const makeCtx = (agents) => ({
    get: name => (name === 'agents'
      ? { list: () => agents }
      : name === 'connection' ? { requestRejection: () => undefined } : undefined),
    on: () => () => {},
    effect: (fn) => { const dispose = fn(); return () => { if (typeof dispose === 'function') dispose() } },
    webServer: { register: () => () => {} },
  })
  const settingsWith = (row) => {
    const writes = []
    return {
      writes,
      get: () => row,
      mutate: async (_ns, ops) => {
        for (const op of ops) {
          if (op.op === 'set') { row[op.path[0]] = op.value; writes.push({ path: op.path[0], value: op.value }) }
        }
      },
    }
  }
  const writeOf = (settings, field) => settings.writes.filter(write => write.path === field).at(-1)?.value
  const found = {
    candidates: [{ path: 'D:/Git/bin/bash.exe', kind: 'git', label: 'Git for Windows', explicit: false }],
    excluded: [],
  }
  const deps = () => ({ subprocess: {} })
  const boot = (agent, settings) => {
    pure.installTerminalPolicy(makeCtx([agent]), 'composer-ux', settings, deps, {
      platform: 'win32', discover: () => found, exists: () => true,
    })
    return new Promise(resolve => setTimeout(resolve, 0))
  }

  {
    const agent = makeAgent({ register: 'throws' })
    const settings = settingsWith({ terminalEnabled: true, terminalMode: 'gitbash', terminalBashPath: '' })
    await boot(agent, settings)
    check('注册抛错时：restrict 被回滚（该会话保住 pwsh 可用）',
      agent.capture.lifted === 1, String(agent.capture.lifted))
    check('注册抛错时：terminalEffective 不谎报已生效',
      writeOf(settings, 'terminalEffective') === 'pwsh', String(writeOf(settings, 'terminalEffective')))
    check('注册抛错时：状态行说的是"没能换上"（不是"没找到 bash"）',
      String(writeOf(settings, 'terminalStatus')).includes('没能换上'), String(writeOf(settings, 'terminalStatus')))
    check('注册抛错时：原因如实回传（下发失败：…）',
      String(writeOf(settings, 'terminalStatus')).includes('下发失败'), String(writeOf(settings, 'terminalStatus')))
  }
  {
    const agent = makeAgent({ register: 'no-disposer' })
    const settings = settingsWith({ terminalEnabled: true, terminalMode: 'gitbash', terminalBashPath: '' })
    await boot(agent, settings)
    check('register 不返回 disposer（这一版注册面不可用）同样回滚 restrict',
      agent.capture.lifted === 1, String(agent.capture.lifted))
    check('register 不返回 disposer 时：状态回落 pwsh',
      writeOf(settings, 'terminalEffective') === 'pwsh', String(writeOf(settings, 'terminalEffective')))
  }
  {
    // 子代理已继承父层的处理结果 → restrict 抛错，但注册成功：这是**良性跳过**，不是失败。
    // 这条用来防止上面那次回滚"改过头"，把正常的子代理也判成失败。
    const agent = makeAgent({ restrictThrows: true })
    const settings = settingsWith({ terminalEnabled: true, terminalMode: 'gitbash', terminalBashPath: '' })
    await boot(agent, settings)
    check('restrict 抛错（子代理已继承）不算失败：bash 照样注册',
      agent.capture.registers.length === 1, String(agent.capture.registers.length))
    check('restrict 抛错（子代理已继承）不算失败：状态照旧报已生效',
      writeOf(settings, 'terminalEffective') === 'bash', String(writeOf(settings, 'terminalEffective')))
  }
}

console.log(`\n${passes} passed, ${failures} failed`)
process.exitCode = failures === 0 ? 0 : 1
