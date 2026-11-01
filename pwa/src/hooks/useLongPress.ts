/**
 * Press and hold, the same with a finger and a mouse: fires after HOLD_MS when
 * the pointer stayed put. Moving further than TAP_SLOP_PX (a scroll or a drag),
 * lifting or leaving cancels. The browser's own long-press menu (save image,
 * copy) is held back while this is active.
 */
import { useEffect, useRef, type PointerEvent } from 'react'
import { TAP_SLOP_PX } from './useDoubleTap'

export const HOLD_MS = 500

export function useLongPress(onHold: (() => void) | undefined) {
  const timer = useRef<number | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
    start.current = null
  }
  useEffect(() => cancel, [])
  if (!onHold) return {}
  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.button !== 0) return
      cancel()
      start.current = { x: e.clientX, y: e.clientY }
      timer.current = window.setTimeout(() => {
        timer.current = null
        start.current = null
        onHold()
      }, HOLD_MS)
    },
    onPointerMove: (e: PointerEvent) => {
      const s = start.current
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > TAP_SLOP_PX) cancel()
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    onDragStart: (e: { preventDefault: () => void }) => e.preventDefault()
  }
}
