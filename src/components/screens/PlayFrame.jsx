import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { cn } from 'cn'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import { motionOf } from '@/lib/boardPrototype'

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
// Two frames: the layer has been laid out and painted (once, unseen) by then.
const painted = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
const fontsReady = () => (typeof document !== 'undefined' && document.fonts?.ready ? document.fonts.ready.catch(() => {}) : Promise.resolve())
const imagesReady = (root) => Promise.all([...(root?.querySelectorAll('img') ?? [])].map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve())))

// The frame a prototype plays in on the Screens board — the card it was
// started from, in that card's place and at its size. The screen showing
// changes inside it and nothing shows through while it does:
//
//   · Two layers, never one swapped for another. The screen to come is drawn
//     in a layer of its own — in the frame, unseen (opacity 0, under the
//     one showing) — and only when its fonts are in, its images decoded and
//     it has been laid out and painted does anything move.
//   · The screen showing stays whole until then, and through the change: a
//     fade brings the new one up over it (it's never see-through itself); a
//     slide moves the two as one strip, edge to edge. Only transform and
//     opacity are animated, `will-change` only for as long.
//   · When the change is over the old layer goes, in the same commit the new
//     one becomes the one showing: there's no frame with neither.
//   · The frame is the screen's own background throughout, so even a missed
//     frame would show paper, not the board.
//   · One change at a time: a press while one is under way is let go.
//   · Slow (over 800ms to get ready): the screen showing stays, with a small
//     mark over the frame. Failed: it stays, and says so.
//
// `go(screen, animation)` (by ref) changes the screen; `onArrive(id)` says
// when it has. `overlay(screen)`: what's laid over the screen showing, in the
// screen's own units (its hotspots).
function ScreenLayer({ screen }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0" style={{ width: screen.size.width, height: screen.size.height }}>
      {screen.frame.layers.map((layer) => <StaticLayer key={layer.id} layer={layer} />)}
    </div>
  )
}

function PlayFrame({ ref, screen, overlay, onArrive, className, style }) {
  // `shown`: the screen showing; `coming`: the one being got ready, then brought in.
  const [shown, setShown] = useState(screen)
  const [coming, setComing] = useState(null)
  const [slow, setSlow] = useState(false)
  const [failed, setFailed] = useState(false)
  const shownRef = useRef(null)
  const comingRef = useRef(null)
  const busy = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  useImperativeHandle(ref, () => ({
    busy: () => busy.current,
    // → true when the change was taken, false when one is already under way.
    go(next, animation = 'none') {
      if (busy.current || !next) return false
      busy.current = true
      setFailed(false)
      setComing({ screen: next, animation })
      return true
    },
    // (At once, no animation: stepping back, starting over.)
    show(next) { if (!busy.current && next) setShown(next) },
  }), [])

  // The layer to come is in the document: ready it, then bring it in.
  useLayoutEffect(() => {
    if (!coming) return undefined
    const incoming = comingRef.current
    const outgoing = shownRef.current
    let cancelled = false
    const late = window.setTimeout(() => { if (!cancelled) setSlow(true) }, 800)
    const settle = () => {
      window.clearTimeout(late)
      if (!alive.current) return
      // One commit: the new layer is the one showing and the old one is gone.
      setShown(coming.screen)
      setComing(null)
      setSlow(false)
      busy.current = false
      onArrive?.(coming.screen.id)
    }
    Promise.all([fontsReady(), imagesReady(incoming)]).then(painted).then(() => {
      if (cancelled || !alive.current) return
      const motion = motionOf(coming.animation, reducedMotion())
      if (!motion || !incoming?.animate) { settle(); return }
      const options = { duration: motion.duration, easing: motion.easing, fill: 'both' }
      for (const layer of [incoming, outgoing]) if (layer) layer.style.willChange = 'transform, opacity'
      incoming.style.opacity = '1'
      const runs = [incoming.animate(motion.incoming, options), motion.outgoing && outgoing ? outgoing.animate(motion.outgoing, options) : null].filter(Boolean)
      Promise.all(runs.map((run) => run.finished)).then(() => {
        if (cancelled) return
        // (The old layer keeps its last frame until the commit that removes it: nothing snaps back in between.)
        for (const layer of [incoming, outgoing]) if (layer) layer.style.willChange = ''
        settle()
      }).catch(() => {})
    }).catch(() => {
      window.clearTimeout(late)
      if (!alive.current) return
      setComing(null)
      setSlow(false)
      setFailed(true)
      busy.current = false
    })
    return () => { cancelled = true; window.clearTimeout(late) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coming])

  return (
    <div data-play-frame data-play-showing={shown.id} data-play-busy={coming ? '' : undefined} className={cn('relative overflow-hidden bg-white', className)} style={{ ...style, width: shown.size.width, height: shown.size.height }}>
      {/* Keyed by screen, so the layer that was coming is the same element once it's the one showing — never remounted. */}
      <div key={shown.id} ref={shownRef} data-play-layer="shown" className="absolute inset-0 bg-white">
        <ScreenLayer screen={shown} />
        {!coming && overlay?.(shown)}
      </div>
      {coming && coming.screen.id !== shown.id && (
        <div key={coming.screen.id} ref={comingRef} data-play-layer="coming" className="pointer-events-none absolute inset-0 bg-white" style={{ opacity: 0 }}>
          <ScreenLayer screen={coming.screen} />
        </div>
      )}
      {slow && <span data-play-loading role="status" className="absolute top-2 right-2 size-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600 motion-reduce:animate-none" />}
      {failed && <p data-play-failed role="alert" className="absolute inset-x-2 bottom-2 rounded-md bg-slate-900/90 px-2 py-1 text-center text-[11px] text-white">That screen couldn’t be shown.</p>}
    </div>
  )
}

export default PlayFrame
