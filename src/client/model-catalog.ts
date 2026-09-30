/**
 * 模型清单的客户端取数（0.14.1）。
 *
 * 面板的「优化选项 → 模型」下拉要按 provider 分组列出可用模型；这份清单只有宿主知道
 * （客户端拿不到 `llm` 服务），所以走只读路由 `GET /composer-ux/models`。
 *
 * 纪律：取数失败**不抛**，一律变成一句能显示给用户的话（下拉里那一行 + 「重试」）。
 */
import { MODELS_API_PATH } from '../settings-contract.ts'

/** 一条可选模型（`provider/model` 就是设置里存的值）。 */
export interface ModelOption {
  readonly provider: string
  readonly model: string
  readonly name: string
}

/** 一个 provider 分组。 */
export interface ModelGroup {
  readonly id: string
  readonly name: string
  readonly models: readonly { readonly id: string; readonly name: string }[]
  /** 这一组读不到时的原因（其它组照常显示 —— 单点失败不废整份清单）。 */
  readonly error?: string
}

/** 取数结果。 */
export type ModelCatalogResult =
  | { readonly kind: 'ok'; readonly groups: readonly ModelGroup[]; readonly current: { readonly provider: string; readonly model: string } }
  | { readonly kind: 'error'; readonly error: string }

const textOf = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

/**
 * 读一次模型清单。
 *
 * @param options.fresh - 绕过宿主那 60 秒缓存（界面上的「重试」用它）。
 * @param options.signal - 组件卸载/关闭下拉时中止。
 * @returns 分组清单，或一句失败原因。
 */
export async function fetchModelCatalog(
  options: { readonly fresh?: boolean; readonly signal?: AbortSignal } = {},
): Promise<ModelCatalogResult> {
  const url = options.fresh === true ? `${MODELS_API_PATH}?fresh=1` : MODELS_API_PATH
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    })
    if (!response.ok) return { kind: 'error', error: `宿主回了 ${String(response.status)}` }
    const body = (await response.json()) as Record<string, unknown>
    if (body.ok !== true) return { kind: 'error', error: textOf(body.error) === '' ? '宿主没给出原因' : textOf(body.error) }
    const rawGroups = Array.isArray(body.groups) ? body.groups : []
    const groups: ModelGroup[] = []
    for (const raw of rawGroups) {
      if (typeof raw !== 'object' || raw === null) continue
      const row = raw as Record<string, unknown>
      const id = textOf(row.id)
      if (id === '') continue
      const models = (Array.isArray(row.models) ? row.models : [])
        .map(item => {
          const one = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>
          const model = textOf(one.id)
          const name = textOf(one.name)
          return { id: model, name: name === '' ? model : name }
        })
        .filter(item => item.id !== '')
      const error = textOf(row.error)
      groups.push({
        id,
        name: textOf(row.name) === '' ? id : textOf(row.name),
        models,
        ...(error === '' ? {} : { error }),
      })
    }
    const currentRow = (typeof body.current === 'object' && body.current !== null ? body.current : {}) as Record<string, unknown>
    return { kind: 'ok', groups, current: { provider: textOf(currentRow.provider), model: textOf(currentRow.model) } }
  } catch (error: unknown) {
    return { kind: 'error', error: error instanceof Error ? error.message : String(error) }
  }
}
