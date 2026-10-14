import { useLayoutEffect, useRef, useState } from 'react'

// Where the main window's content sits (the window with Preview · Screens · Code, under its tab row),
// measured in the box `ref`'s element is placed in: { top, right, bottom } as insets from that box's edges.
// What the page lays over the canvas — the change list, Design Compare — takes this frame, so it docks at
// the canvas's right as the Screens board's list does, and moves with AI Chat as it opens or folds (each
// frame of the ease). (`deps`: what can put another window there — AI Chat opening, the view.)
export function useMainWindowFrame(deps = []) {
  const ref = useRef(null)
  const [frame, setFrame] = useState(null)
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => measure())
    let watched = null
    function measure() {
      const box = ref.current?.offsetParent
      const win = document.querySelector('[data-workspace-views]')?.closest('[data-window]')
      if (!box || !win) return
      if (win !== watched) { if (watched) observer.unobserve(watched); observer.observe(win); watched = win }
      const outer = box.getBoundingClientRect(), at = win.getBoundingClientRect()
      // (Inside the window's 1px border; under its tab row, the window's first row.)
      const head = win.firstElementChild?.getBoundingClientRect().bottom ?? at.top
      const next = { top: Math.round(head - outer.top), right: Math.round(outer.right - at.right + 1), bottom: Math.round(outer.bottom - at.bottom + 1) }
      setFrame((now) => (now && now.top === next.top && now.right === next.right && now.bottom === next.bottom ? now : next))
    }
    measure()
    // (The window's layout settles a frame later when AI Chat comes or goes.)
    const raf = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => { cancelAnimationFrame(raf); observer.disconnect(); window.removeEventListener('resize', measure) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return [ref, frame]
}
