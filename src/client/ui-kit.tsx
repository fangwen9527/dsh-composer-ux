/**
 * 设置页的视觉原语：卡片 / 卡片标题 / 分段控件 / 设置行 / 悬停说明 / 卡内小标题。
 *
 * 为什么单独一个文件：设置页有 12 张折叠卡、几十行设置项，观感原本散在三处
 * （settings-style.ts 的类名、styles.ts 的内联对象、各调用点各写一遍的 <button>），
 * 想统一换一次皮就得改十几个地方，而且必然会漏几张。把"这里长什么样"收进这个文件、
 * 调用点只表达"这里是什么"，换皮就只动 settings-style.ts 一份 CSS。
 *
 * 为什么只用宿主的 --dsw-* 令牌：本插件必须跟着 DSH 的深浅主题一起变。
 * 自带一套色板会在某个主题下变成白底白字（0.2.0 踩过一次，见 PillChoice.tsx 文件头）。
 * 参考仓库那套 --ds* 变量是它自己的主题层，这里一个都不引。
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

/** 气泡距视口边缘的留白（与费用浮层同一套口径，见 CostChipEntry.tsx）。 */
const HINT_EDGE = 12
/** 气泡最大宽度：再宽一行字就读不动了，也容易顶到窄设置面板的边。 */
const HINT_WIDTH = 280
/** 下方留这么多像素就不算"放得下"，气泡翻到徽标上方。 */
const HINT_FLIP_ROOM = 120

/**
 * `useLayoutEffect` 在 SSR 里会打一条警告（"does nothing on the server"）。
 * 设置页在 test/settings-render.mjs 里是真的用 renderToStaticMarkup 渲的，
 * 那条警告会混进测试输出里当真红看，所以在没有 window 的环境退化成 useEffect。
 */
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/** 分段控件的选项。 */
export interface SegmentedItem<T extends string> {
  readonly id: T
  readonly label: string
  /** 悬停提示：这一档到底做什么（用原生 title，标题行里空间紧，画不下气泡）。 */
  readonly hint?: string
}

/** 卡片外壳的注入面。 */
export interface CardProps {
  /**
   * 展开态（受控）：设置页每次打开都要回到折叠，所以"开没开"归调用方持有，
   * 卡片自己不留状态（留了就会在两次打开之间"记住"，与约定相反）。
   */
  readonly open?: boolean
  /** 这一栏没启用：描边改虚线 + 正文压暗（语义来自 toggle.checked === false）。 */
  readonly off?: boolean
  /**
   * 标题行。用 CardTitle + 自己的控件区组合，见 SettingsSection 的 FoldCard：
   * 为什么不让 Card 直接收 name/summary/toggle，理由写在那里的注释里
   * （标题行的兄弟结构被 test/client-registration.mjs 钉在 SettingsSection.tsx 上）。
   */
  readonly head: ReactNode
  readonly children: ReactNode
}

/** 卡片外壳：只负责描边 / 圆角 / 底色 / hover / 未启用虚线这一层。 */
export function Card(props: CardProps) {
  const classes = ['dsh-ux-card']
  if (props.open === true) classes.push('dsh-ux-cardOpen')
  if (props.off === true) classes.push('dsh-ux-cardOff')
  return (
    <section className={classes.join(' ')}>
      {props.head}
      {props.children}
    </section>
  )
}

/** 卡头文字：名称 + `?` 说明 + 一句概览。 */
export function CardTitle(props: {
  readonly name: string
  /** 折叠时就该看见的那一句（未启用时调用方已经加好「未启用 · 」前缀）。 */
  readonly summary: string
  /** `?` 悬停说明：写这一栏"管什么、不管什么"，不重复概览。不给就不画徽标。 */
  readonly hint?: string
}) {
  return (
    <span className="dsh-ux-cardHeadText">
      <span className="dsh-ux-cardTitleRow">
        <span className="dsh-ux-cardName">{props.name}</span>
        {props.hint !== undefined && props.hint !== '' && <Hint text={props.hint} insideButton />}
      </span>
      <span className="dsh-ux-cardDescription">{props.summary}</span>
    </span>
  )
}

/** 折叠箭头（内联 SVG，展开时靠父级 class 旋转 180°）。 */
export function CardChevron(props: { readonly open: boolean }) {
  return (
    <span
      className={props.open ? 'dsh-ux-cardChevron dsh-ux-cardChevronOpen' : 'dsh-ux-cardChevron'}
      aria-hidden="true"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M3.25 5.5L7 9.25L10.75 5.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

/** 气泡摆位：贴边夹紧，下方放不下就翻到上方。 */
interface HintPlacement {
  readonly left: number
  readonly width: number
  readonly top?: number
  readonly bottom?: number
}

/**
 * `?` 徽标 + 悬停/点击气泡。
 *
 * 为什么自己画而不是用 `title`：这一层的说明往往有两三句（"只影响本插件估算，
 * 不改账单"这种），`title` 在某些 WebView 里会被截断、也不能换行。
 *
 * 为什么用 portal：设置面板自己有 `overflow` 与层叠上下文，气泡画在卡片里会被裁掉
 * （费用浮层同一个坑，见 CostChipEntry.tsx 的 createPortal）。
 *
 * 为什么气泡是 `pointer-events: none`：它只是一段只读说明；能挡住鼠标的话，从徽标
 * 移到气泡上的那一瞬会触发徽标的 mouseleave，气泡自己把自己关掉，看起来像在闪。
 */
export function Hint(props: {
  readonly text: string
  /**
   * 徽标压在"展开"按钮里面时传 true：HTML 不允许按钮套按钮，
   * 那里退化成 span（点击仍然能开气泡，只是键盘焦点落在整张卡上）。
   */
  readonly insideButton?: boolean
}) {
  const { text, insideButton = false } = props
  const badge = useRef<HTMLElement | null>(null)
  const [hover, setHover] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [placement, setPlacement] = useState<HintPlacement | null>(null)
  const open = hover || pinned

  const measure = useCallback((): void => {
    const rect = badge.current?.getBoundingClientRect()
    if (rect === undefined) { setPlacement(null); return }
    const width = Math.min(HINT_WIDTH, Math.max(160, window.innerWidth - HINT_EDGE * 2))
    // 横向按徽标左边缘对齐，再夹进视口：贴着右边的那颗徽标不能把气泡顶出屏幕。
    const left = Math.min(
      Math.max(rect.left - 4, HINT_EDGE),
      Math.max(HINT_EDGE, window.innerWidth - HINT_EDGE - width),
    )
    // 竖直方向不量气泡高度（还没渲染）：下方留得够就贴下沿，否则翻到上方并贴底。
    // 比"渲染后再量一次重新定位"少一次跳变。
    setPlacement(
      window.innerHeight - rect.bottom >= HINT_FLIP_ROOM
        ? { left, width, top: rect.bottom + 6 }
        : { left, width, bottom: window.innerHeight - rect.top + 6 },
    )
  }, [])

  useIsoLayoutEffect(() => {
    if (!open) { setPlacement(null); return }
    measure()
  }, [open, measure])

  // 气泡是 fixed 定位，不跟着内容滚：滚动/缩放后必须重算，否则会停在旧位置。
  useEffect(() => {
    if (!open) return
    const relayout = (): void => { measure() }
    window.addEventListener('scroll', relayout, true)
    window.addEventListener('resize', relayout)
    return () => {
      window.removeEventListener('scroll', relayout, true)
      window.removeEventListener('resize', relayout)
    }
  }, [open, measure])

  // 点住（pinned）之后：点别处 / 按 Esc 收起来，与官方弹层同一行为。
  useEffect(() => {
    if (!pinned) return
    const onPointerDown = (event: MouseEvent): void => {
      const target = event.target as Node | null
      if (target !== null && badge.current?.contains(target) === true) return
      if (target !== null && (target as Element).closest?.('[data-dsh-ux-hint]') !== null) return
      setPinned(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => { if (event.key === 'Escape') setPinned(false) }
    document.addEventListener('mousedown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [pinned])

  /**
   * 点徽标：开/关气泡，并且**不能**把这一下让给外层。
   * 徽标在"展开"按钮里，不拦住的话点问号会顺手把卡片合上，人就看不到正文了。
   */
  const toggle = (event: React.MouseEvent): void => {
    event.preventDefault()
    event.stopPropagation()
    setPinned(current => !current)
  }

  const shared = {
    className: open ? 'dsh-ux-hint dsh-ux-hintOpen' : 'dsh-ux-hint',
    title: text,
    onClick: toggle,
    onMouseEnter: () => { setHover(true) },
    onMouseLeave: () => { setHover(false) },
  }

  const bubble = open && placement !== null
    ? createPortal(
      <div
        data-dsh-ux-hint=""
        role="tooltip"
        className="dsh-ux-hintBubble"
        style={{
          left: placement.left,
          width: placement.width,
          top: placement.top,
          bottom: placement.bottom,
        }}
      >
        {text}
      </div>,
      document.body,
    )
    : null

  return (
    <>
      {insideButton
        ? (
          // 外层已经是 <button>：这里只能是 span，否则按钮套按钮（无效 HTML，点击也会打架）。
          <span
            ref={node => { badge.current = node }}
            {...shared}
            aria-hidden="true"
          >
            ?
          </span>
        )
        : (
          <button
            ref={node => { badge.current = node }}
            type="button"
            {...shared}
            aria-label={`说明：${text}`}
            aria-expanded={open}
          >
            ?
          </button>
        )}
      {bubble}
    </>
  )
}

/**
 * 分段控件：一行互斥选项，装在一个描边容器里。
 *
 * 与 PillChoice 的分工：PillChoice 是"一排独立小胶囊"（输入框工具行那种），
 * 这里是"一个控件被分成几段"（设置页里的三档），选中项只换成更浅的一层底色 + 描边，
 * 不做实色填充 —— 实色要配「填充 + 前景」两个令牌，只写一半就会在深色主题下白底白字。
 */
export function Segmented<T extends string>(props: {
  readonly items: readonly SegmentedItem<T>[]
  readonly value: T
  readonly onChange: (value: T) => void
  /** 无障碍组名：同一屏上有好几个分段控件，读屏要分得清。 */
  readonly ariaLabel: string
  /** 标题行那一档（字号小一号）。 */
  readonly compact?: boolean
}) {
  return (
    <div
      role="group"
      aria-label={props.ariaLabel}
      className={props.compact === true ? 'dsh-ux-segmented dsh-ux-segmentedCompact' : 'dsh-ux-segmented'}
    >
      {props.items.map(item => (
        <button
          key={item.id}
          type="button"
          title={item.hint}
          aria-pressed={props.value === item.id}
          className={props.value === item.id ? 'dsh-ux-segment dsh-ux-segmentOn' : 'dsh-ux-segment'}
          // 不让按钮抢走输入框里可能存在的选区（与 PillChoice 同一做法）。
          onMouseDown={event => { event.preventDefault() }}
          onClick={() => { props.onChange(item.id) }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

/**
 * 设置行：左侧标题 + 说明，右侧控件。
 *
 * 行与行之间统一用 1px 细分隔线（不用"只靠间距"那一套）：设置页一行里常常既有说明
 * 又有两三个控件，没有分隔线时一行到下一行的归属会看不清。
 * 卡内第一行传 `first`（上面就是卡片自己的那条分隔线，再画一条会变成双线）。
 */
export function Row(props: {
  readonly title: string
  readonly desc?: string
  /** 标题旁的 `?` 说明。 */
  readonly hint?: string
  readonly first?: boolean
  /** 控件换到下一行（输入框、分段控件这类占满宽度的）。 */
  readonly stacked?: boolean
  readonly children?: ReactNode
}) {
  const classes = ['dsh-ux-row']
  if (props.first === true) classes.push('dsh-ux-rowFirst')
  if (props.stacked === true) classes.push('dsh-ux-rowStacked')
  return (
    <div className={classes.join(' ')}>
      <div className="dsh-ux-rowText">
        <div className="dsh-ux-rowTitle">
          {props.title}
          {props.hint !== undefined && props.hint !== '' && <Hint text={props.hint} />}
        </div>
        {props.desc !== undefined && props.desc !== '' && (
          <div className="dsh-ux-rowDesc">{props.desc}</div>
        )}
      </div>
      {props.children !== undefined && <div className="dsh-ux-rowControl">{props.children}</div>}
    </div>
  )
}

/** 卡内小标题：把一张卡里的几段分开（不抢卡片标题的层级）。 */
export function GroupLabel(props: {
  readonly children: ReactNode
  readonly hint?: string
}) {
  return (
    <div className="dsh-ux-groupLabel">
      <span>{props.children}</span>
      {props.hint !== undefined && props.hint !== '' && <Hint text={props.hint} />}
    </div>
  )
}
