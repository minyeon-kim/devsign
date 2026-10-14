import { useEffect, useState } from 'react'

// A value that follows `value` one painted frame later. For what animates
// when something opens or closes (a pane's width, a panel's fold): the
// content that comes with it renders — and is painted — first, and only then
// does the size start to move. A CSS transition's clock starts when the value
// changes; started in the same commit as a heavy render, its first painted
// frame is already a good part of the way through — a lunge, then the rest.
export function useAfterPaint(value) {
  const [shown, setShown] = useState(value)
  useEffect(() => {
    if (Object.is(shown, value)) return undefined
    let second = 0
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => setShown(value)) })
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second) }
  }, [value, shown])
  return shown
}

// How the app's panes and panels open and close: 260ms, easing in gently and settling softly.
export const PANE_MOTION = 'duration-[260ms] ease-[cubic-bezier(0.2,0,0,1)]'
