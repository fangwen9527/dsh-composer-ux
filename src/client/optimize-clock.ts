/**
 * 优化秒表：面板里的主按钮与工具行里的独立按钮共用的一个「已用 N 秒」读数。
 *
 * 为什么单独一个文件：两个组件都要显示同一个读数，而它们拿不到对方的本地状态；
 * 读数只依赖"起始时刻"这一个数字，所以把它做成只吃 `startedAt` 的 hook，谁都能算。
 *
 * 非流式下的边界（如实记）：宿主现在一次性返回结果，所以能显示的最细阶段就是
 * 「等待模型响应」；"正在校验装配"那种阶段要等流式接口（0.12.0 的逐条流式）。
 */
import { useEffect, useState } from 'react'
import { elapsedSeconds } from './quick-commands.ts'

/** 滴答间隔：1 秒足够，面板每次只重渲染按钮文案。 */
const TICK_MS = 1_000

/**
 * 优化已用秒数。
 *
 * @param startedAt - 这次优化的起始时刻（`Date.now()`；0 = 没有在跑）。
 * @returns 已用整秒数；没有在跑时恒为 0，也不起计时器。
 */
export function useOptimizeElapsed(startedAt: number): number {
  const running = startedAt > 0
  const [seconds, setSeconds] = useState(() => elapsedSeconds(startedAt, Date.now()))

  useEffect(() => {
    // 起始时刻变了先立刻对齐一次，否则会先显示上一轮的读数。
    setSeconds(elapsedSeconds(startedAt, Date.now()))
    if (!running) return undefined
    const timer = setInterval(() => { setSeconds(elapsedSeconds(startedAt, Date.now())) }, TICK_MS)
    return () => { clearInterval(timer) }
  }, [startedAt, running])

  return running ? seconds : 0
}
