/**
 * 从 models.dev 的 `api.json` 生成 `src/provider-prices.ts`（内置第三方价目快照）。
 *
 *   node scripts/gen-provider-prices.mjs <models-dev-api.json> [快照日期 YYYY-MM-DD]
 *
 * 为什么要生成而不是手抄：第三方价目的**唯一可信来源**是注册表本身；手抄一定会抄错一位、
 * 而且下次想更新时没人敢改。生成脚本让"这次快照到底来自哪份文件、哪天"有据可查
 * （写进产物头部），也顺手做了三件消毒：只收 `cost.input` / `cost.output` 都是有限非负数的
 * 模型；`hit` 缺 `cost.cache_read` 时沿用 miss；**provider id 为 `deepseek` 的整块丢掉**
 * （models.dev 那边 DeepSeek 只有平坦的谷价、没有峰谷与历史档语义，留着迟早被误用
 * ——见 `src/price-sync.ts` 文件头纪律 3）。
 *
 * 收哪些 provider 也是刻意的（不是"全部 215 个"）：只收这个生态里最可能用到的那些，
 * 把产物压在几十 KB 量级 —— 全量快照 7800 多个模型（约 450 KB）适合落盘同步，
 * 不适合塞进源码。
 */
import { readFileSync, writeFileSync } from 'node:fs'

/** 要收进内置快照的 provider（顺序即产物里的声明顺序）。 */
const PROVIDERS = [
  'openai',
  'anthropic',
  'google',
  'moonshotai',
  'zhipuai',
  'minimax',
  'alibaba',
  'xai',
  'xiaomi',
  'opencode',
  'opencode-go',
]

const input = process.argv[2]
if (input === undefined) {
  console.error('用法：node scripts/gen-provider-prices.mjs <models-dev-api.json> [YYYY-MM-DD]')
  process.exit(2)
}
const snapshotAt = process.argv[3] ?? new Date().toISOString().slice(0, 10)

const registry = JSON.parse(readFileSync(input, 'utf8'))
const out = {}
let models = 0
for (const provider of PROVIDERS) {
  const entry = registry[provider]
  if (entry === undefined || typeof entry.models !== 'object' || entry.models === null) {
    console.error(`跳过 ${provider}：注册表里没有`)
    continue
  }
  const rows = {}
  for (const [id, model] of Object.entries(entry.models)) {
    const cost = model?.cost
    if (typeof cost?.input !== 'number' || !Number.isFinite(cost.input) || cost.input < 0) continue
    if (typeof cost.output !== 'number' || !Number.isFinite(cost.output) || cost.output < 0) continue
    const hit = typeof cost.cache_read === 'number' && Number.isFinite(cost.cache_read) && cost.cache_read >= 0
      ? cost.cache_read
      : cost.input
    rows[id.toLowerCase()] = { miss: cost.input, hit, out: cost.output }
  }
  const ids = Object.keys(rows).sort()
  if (ids.length === 0) continue
  out[provider] = Object.fromEntries(ids.map(id => [id, rows[id]]))
  models += ids.length
}

/** 数字写成最短形式（0.003 不写成 0.003000000000000001）。 */
const num = value => String(Number(value))
const lines = []
for (const [provider, rows] of Object.entries(out)) {
  lines.push(`  '${provider}': {`)
  for (const [id, rate] of Object.entries(rows)) {
    lines.push(`    '${id}': { miss: ${num(rate.miss)}, hit: ${num(rate.hit)}, out: ${num(rate.out)} },`)
  }
  lines.push('  },')
}

const file = `/**
 * 内置的第三方价目**快照**（每 1M tokens，美元）—— 数据文件，不含逻辑。
 *
 * ⚠️ 这个文件是**生成**的，别手改：\`node scripts/gen-provider-prices.mjs <models.dev-api.json>\`。
 *
 * 来源：${'https://models.dev/api.json'}（快照日期 ${snapshotAt}）。
 * 收录：${PROVIDERS.length} 个 provider / ${models} 个模型 —— 只收这个生态里最可能用到的那些，
 * 全量快照（7800+ 模型，约 450 KB）属于"一键同步"那条路（落 ${'$'}DSH_HOME/storages/composer-ux/prices.json），
 * 不适合塞进源码。
 *
 * 它在计价里的位置（见 \`pricing.ts\` 的 resolvePrice）：**用户覆盖价 > 已同步的 models.dev 价目
 * > 本快照 > 未定价**。也就是说它只是"没网、还没点过同步"时的兜底；一旦用户点过
 * 「同步第三方价目」，那份新数据会盖住同名条目。界面会标明单价来自"内置快照"还是"已同步"。
 *
 * 为什么不收 \`deepseek\`：models.dev 那边的 DeepSeek 只有平坦的谷价、没有峰谷与历史档语义，
 * 留着迟早被误用成"DeepSeek 单价"，把峰价静默算成谷价（见 price-sync.ts 文件头纪律 3）。
 */
export const PROVIDER_PRICES_SNAPSHOT_AT = '${snapshotAt}'
export const PROVIDER_PRICES_SOURCE = 'https://models.dev/api.json'

/** provider → model → 单价（美元/1M）。形状与 \`pricing.ts\` 的 \`ProviderPriceTable\` 一致。 */
export const BUILTIN_PROVIDER_PRICES: Readonly<Record<string, Readonly<Record<string, { readonly miss: number; readonly hit: number; readonly out: number }>>>> = {
${lines.join('\n')}
}
`

writeFileSync(new URL('../src/provider-prices.ts', import.meta.url), file, 'utf8')
console.log(`已写出 src/provider-prices.ts：${Object.keys(out).length} 个 provider / ${models} 个模型`)
