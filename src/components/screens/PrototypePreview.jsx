import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, LocateFixed, MousePointerClick, RotateCcw } from 'lucide-react'
import { cn } from 'cn'
import PreviewPanelContent from '@/components/dockview/panels/PreviewPanelContent'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { LocalizedText } from '@/i18n/runtime'
import { canStepBack, isEnd, positionOf } from '@/lib/prototypeEngine'
import { screenOf, screenOrder, transitionsOf } from '@/lib/screens'
import { useWorkspace } from '@/state/WorkspaceProvider'

// Preview, as the prototype it is: the screen in view with its hotspots live.
// A press on one goes where its transition says, the way it says (slide,
// fade, or at once — at once under reduced motion); a link to a section of
// the same page scrolls to it. The session — the screens passed through — is
// the Workspace's (lib/prototypeEngine, in WorkspaceProvider), so the screen
// it's on is the screen in view everywhere, and one picked on the Screens
// board starts it from there.
//
// It adds to Preview's own toolbar (the device, the zoom and full screen
// stay as they are): Back, Start over, the flows, where it is ("Product
// detail · 3 / 6"), Show hotspots, and Show on Screens. On a single page the
// flow controls step aside. ⌥←: back · R: start over · H: hotspots — not
// while typing, and only while Preview is what's showing.
const TOOL = 'ds-intrinsic flex h-7 min-w-7 shrink-0 items-center justify-center gap-1.5 rounded-full px-1.5 text-[11px] text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300 disabled:pointer-events-none disabled:opacity-40'
const STEP = 'ds-intrinsic flex size-10 items-center justify-center rounded-xl border border-white/10 bg-card/95 text-slate-200 shadow-lg transition-colors hover:bg-white/[0.1] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300 disabled:pointer-events-none disabled:opacity-30'
const MAC = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)
const HOTSPOTS_KEY = 'devsign.previewHotspots'
const isTyping = (target) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function PrototypePreview(props) {
  const { prototype, activePageId, workspaceView, prototypeSession, prototypeFollow, prototypeBack, prototypeRestart, prototypeGo, showScreenIn } = useWorkspace()
  const screen = screenOf(prototype, activePageId)
  const { live, broken } = transitionsOf(prototype, activePageId)
  const single = prototype.kind === 'single-page'
  const position = positionOf(prototype, activePageId)
  const end = !single && isEnd(prototype, activePageId)
  const [hotspots, setHotspots] = useState(() => { try { return sessionStorage.getItem(HOTSPOTS_KEY) === '1' } catch { return false } })
  const toggleHotspots = () => setHotspots((on) => { try { sessionStorage.setItem(HOTSPOTS_KEY, on ? '0' : '1') } catch { /* not kept */ } return !on })
  // How the screen in view arrived: the last transition's animation, keyed so it plays once per arrival.
  const [motion, setMotion] = useState({ key: 0, how: 'none' })
  const byKeyboard = useRef(false)
  const rootRef = useRef(null)

  // (A link that can't be followed is said once, for whoever keeps the data.)
  useEffect(() => {
    for (const transition of broken) console.warn(`[prototype] "${transition.id}" on "${activePageId}" can't be followed: its hotspot or its target doesn't exist.`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePageId])

  function press(transition, event) {
    byKeyboard.current = event?.detail === 0
    const result = prototypeFollow(transition)
    if (result.scrollTo) {
      rootRef.current?.querySelector(`[data-anchor="${result.scrollTo}"]`)?.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' })
      return
    }
    if (result.moved) setMotion((prev) => ({ key: prev.key + 1, how: reducedMotion() ? 'none' : transition.animation ?? 'none' }))
  }
  // ‹ ›: the screen before or after this one in the board's order (1 → 2 → 3 …), as the Screens board's
  // frame steps — by its hotspot when one goes there (its own animation), else with a slide.
  const order = single ? [] : screenOrder(prototype)
  const at = order.indexOf(activePageId)
  const stepTo = (direction) => {
    const target = order[at + direction]
    if (!target) return
    const via = live.find((transition) => transition.targetScreenId === target && !transition.scrollTo)
    if (direction > 0 && via) { press(via); return }
    if (direction < 0 && prototypeSession.history[prototypeSession.history.length - 2] === target) { back(); return }
    setMotion((prev) => ({ key: prev.key + 1, how: reducedMotion() ? 'none' : 'slide' }))
    prototypeGo(target)
  }
  const back = () => { if (!canStepBack(prototypeSession)) return; setMotion((prev) => ({ key: prev.key + 1, how: 'none' })); prototypeBack() }
  const startOver = (flowId = null) => { setMotion((prev) => ({ key: prev.key + 1, how: 'none' })); prototypeRestart(flowId) }

  // Arrived by the keyboard: the focus goes on to the new screen's first hotspot.
  useEffect(() => {
    if (!byKeyboard.current) return
    byKeyboard.current = false
    requestAnimationFrame(() => rootRef.current?.querySelector('[data-hotspot]')?.focus())
  }, [activePageId, motion.key])

  const showing = workspaceView === 'preview'
  useEffect(() => {
    if (!showing) return undefined
    const onKey = (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || isTyping(event.target)) return
      // (Not under a layer or a dialog: those have the keys.)
      if (document.querySelector('[data-history-overlay], [data-review-overlay], [data-docs-overlay], [data-slot="dialog-content"], [role="menu"]')) return
      if (event.altKey && event.key === 'ArrowLeft') { event.preventDefault(); back() }
      else if (event.altKey) return
      else if (event.key.toLowerCase() === 'r' && !single) { event.preventDefault(); startOver() }
      else if (event.key.toLowerCase() === 'h') { event.preventDefault(); toggleHotspots() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const toolbar = screen && (
    <div data-prototype-toolbar role="toolbar" aria-label="Prototype" className="flex h-8 min-w-0 shrink items-center gap-0.5 rounded-full bg-white/[0.06] p-0.5">
      {!single && (
        <>
          <button type="button" data-proto-back title={`Back · ${MAC ? '⌥←' : 'Alt+←'}`} aria-label="Back" disabled={!canStepBack(prototypeSession)} onClick={back} className={TOOL}><ArrowLeft className="size-3.5" /></button>
          <button type="button" data-proto-restart title="Start over · R" aria-label="Start over" onClick={() => startOver()} className={TOOL}><RotateCcw className="size-3.5" /></button>
          {prototype.flows.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger data-proto-flows title="Start a flow from its first screen" className={cn(TOOL, 'px-2')}><LocalizedText text={position.flow?.name ?? 'Flows'} /></DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-40">
                {prototype.flows.map((flow) => (
                  <DropdownMenuItem key={flow.id} data-proto-flow={flow.id} onClick={() => startOver(flow.id)} className="text-xs"><LocalizedText text={flow.name} /></DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <p data-proto-position className="mx-1.5 flex min-w-0 items-center gap-1.5 text-xs text-slate-100">
            <span className="min-w-0 truncate font-medium"><LocalizedText text={screen.name} /></span>
            {position.step && <span className="shrink-0 tabular-nums text-slate-500">· {position.step} / {position.total}</span>}
          </p>
        </>
      )}
      <button type="button" data-proto-hotspots aria-pressed={hotspots} title="Show hotspots · H" aria-label="Show hotspots" onClick={toggleHotspots} className={cn(TOOL, hotspots && 'bg-white/[0.12] text-white')}><MousePointerClick className="size-3.5" /></button>
      <button type="button" data-proto-locate title="Show on Screens" aria-label="Show on Screens" onClick={() => showScreenIn('screens', activePageId)} className={TOOL}><LocateFixed className="size-3.5" /></button>
    </div>
  )

  return (
    <div ref={rootRef} data-prototype-preview className="h-full min-h-0">
      <PreviewPanelContent
        {...props}
        toolbarExtra={toolbar}
        devicePicker
        frameMotion={{ key: motion.key, className: cn('motion-reduce:animate-none', motion.how === 'slide' && 'animate-in fade-in slide-in-from-right-8 duration-200', motion.how === 'fade' && 'animate-in fade-in duration-200') }}
        frameOverlay={(frame) => frame.id === screen?.frame.id && (
          <>
            {/* (Where a page's own links land.) */}
            {live.filter((transition) => transition.scrollTo).map((transition) => {
              const target = frame.layers.find((layer) => layer.id === transition.scrollTo)
              return target && <span key={`anchor-${transition.id}`} aria-hidden data-anchor={transition.scrollTo} className="pointer-events-none absolute left-0 size-px" style={{ top: Math.max(0, target.y - 24) }} />
            })}
            {live.map((transition) => {
              const layer = frame.layers.find((entry) => entry.id === transition.hotspotId)
              return layer && (
                <button
                  key={transition.id}
                  type="button"
                  data-hotspot={transition.hotspotId}
                  aria-label={transition.label ?? layer.name}
                  title={transition.label ?? layer.name}
                  onClick={(event) => press(transition, event)}
                  className={cn('absolute z-20 cursor-pointer rounded-md outline-none transition-shadow duration-150 focus-visible:ring-2 focus-visible:ring-sky-500', hotspots ? 'bg-sky-400/15 ring-2 ring-sky-500' : 'hover:ring-2 hover:ring-sky-500/40')}
                  style={{ left: layer.x, top: layer.y, width: layer.width, height: layer.height }}
                />
              )
            })}
          </>
        )}
        canvasExtra={(
          <>
            {/* (Said as the screen changes.) */}
            <span role="status" aria-live="polite" className="sr-only">{screen && <LocalizedText text={screen.name} />}</span>
            {/* ‹ n / total ›, fixed at the bottom centre — the same as the Screens board's while it plays. */}
            {at !== -1 && (
              <div data-preview-steps role="group" aria-label="Screens" className="pointer-events-auto absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2">
                <button type="button" data-preview-prev title="Previous screen" aria-label="Previous screen" disabled={at <= 0} onClick={() => stepTo(-1)} className={STEP}><ChevronLeft className="size-5" /></button>
                <span translate="no" className="min-w-12 text-center text-xs tabular-nums text-slate-400">{at + 1} / {order.length}</span>
                <button type="button" data-preview-next title="Next screen" aria-label="Next screen" disabled={at >= order.length - 1} onClick={() => stepTo(1)} className={STEP}><ChevronRight className="size-5" /></button>
              </div>
            )}
            {end && (
              <div data-proto-end className="pointer-events-auto absolute bottom-[72px] left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-white/10 bg-card/95 py-1.5 pr-1.5 pl-3 text-xs text-slate-200 shadow-lg">
                <LocalizedText text="This is the end of the flow." />
                <button type="button" onClick={() => startOver()} className="rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-emerald-300"><LocalizedText text="Start over" /></button>
              </div>
            )}
          </>
        )}
      />
    </div>
  )
}

export default PrototypePreview
