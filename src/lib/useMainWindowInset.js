import { useLayoutEffect, useRef, useState } from 'react'

// How far the main window (the one with Preview · Screens · Code) sits in from
// the right of the box `ref`'s element is placed in: what floats over the
// canvas from the page — the change list, Design Compare — keeps to the
// canvas's right edge, so AI Chat opening or folding moves it along (each
// frame of the ease) instead of covering it.
// (`deps`: what can put another window there — AI Chat opening, the view.)
export function useMainWindowInset(deps = []) {
  const ref = useRef(null)
  const [inset, setInset] = useState(0)
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => measure())
    let watched = null
    function measure() {
      const box = ref.current?.offsetParent
      const win = document.querySelector('[data-workspace-views]')?.closest('[data-window]')
      if (!box || !win) return
      if (win !== watched) { if (watched) observer.unobserve(watched); observer.observe(win); watched = win }
      setInset(Math.max(0, Math.round(box.getBoundingClientRect().right - win.getBoundingClientRect().right)))
    }
    measure()
    // (The window's layout settles a frame later when AI Chat comes or goes.)
    const frame = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', measure) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return [ref, inset]
}
