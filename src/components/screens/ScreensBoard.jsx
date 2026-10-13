import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Flag, LocateFixed, Maximize, Minus, PencilRuler, Play, Plus, RotateCcw, X } from 'lucide-react'
import { cn } from 'cn'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { LocalizedText } from '@/i18n/runtime'
import { boardLayout, linksOf, screenOf, transitionsOf } from '@/lib/screens'
import { boardFit, clampZoom, linkPath, visibleCards, zoomAt, ZOOM_MAX, ZOOM_MIN } from '@/lib/screensBoard'
import { useWorkspace } from '@/state/WorkspaceProvider'

// Screens — the project's screens on one board, in the order its flows say
// (lib/screens' boardLayout), with the links between them, and a prototype
// that can be played from any of them.
//
//   · The board pans (drag, the wheel, Space + drag) and zooms (pinch or
//     ⌘/Ctrl + wheel, the toolbar) between 10% and 200%; it opens fitted.
//   · A press selects a screen — the screen in view everywhere else too
//     (Preview, Code, the side panel). A double press, Enter or ▶ plays the
//     prototype from it. "Edit" opens it on the canvas, where its layers,
//     pins and tools are.
//   · The drawings on the cards are the screens themselves, scaled — never
//     interactive, each inside its own error boundary, and only the cards in
//     view are drawn.
// Viewing and playing only: links and hotspots aren't edited here.

const TOOL = 'flex h-7 min-w-7 items-center justify-center gap-1.5 rounded-md px-1.5 text-[11px] text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300 disabled:pointer-events-none disabled:opacity-40'
const BAR = 'flex items-center gap-0.5 rounded-lg border border-white/10 bg-card/95 p-0.5 shadow-lg backdrop-blur-sm'
const DOTS = { backgroundImage: 'radial-gradient(color-mix(in oklch, var(--foreground) 14%, transparent) 1px, transparent 1px)', backgroundSize: '20px 20px' }

// One screen's drawing fails: that card says so and can be tried again — the board carries on.
class CardBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div data-screen-error className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-100 p-4 text-center text-xs text-slate-600">
        <LocalizedText text="This screen couldn’t be drawn." />
        <button type="button" onClick={(event) => { event.stopPropagation(); this.setState({ failed: false }) }} className="rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white">
          <LocalizedText text="Retry" />
        </button>
      </div>
    )
  }
}

function ScreenDrawing({ frame }) {
  return (
    <CardBoundary>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {frame.layers.map((layer) => <StaticLayer key={layer.id} layer={layer} />)}
      </div>
    </CardBoundary>
  )
}

function ScreensBoard() {
  const { prototype, activePageId, setActivePageId, setWorkspaceView, boardView, dockApi } = useWorkspace()
  const layout = useMemo(() => boardLayout(prototype), [prototype])
  const links = useMemo(() => linksOf(prototype, layout.cards), [prototype, layout])
  const order = layout.cards.map((card) => card.id)
  const cardOf = (id) => layout.cards.find((card) => card.id === id) ?? null

  const rootRef = useRef(null)
  const [room, setRoom] = useState({ width: 0, height: 0 })
  // { x, y, zoom }: where the board's top-left sits in the view, and its scale (1 = 100%).
  const [view, setViewState] = useState(() => (boardView.current?.projectId === prototype.id ? boardView.current.view : null))
  const setView = useCallback((next) => setViewState((prev) => {
    const value = typeof next === 'function' ? next(prev) : next
    boardView.current = { projectId: prototype.id, view: value }
    return value
  }), [boardView, prototype.id])
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return undefined
    const measure = () => setRoom({ width: el.clientWidth, height: el.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const fit = useCallback((box = layout) => setView(boardFit(box, room)), [layout, room, setView])
  // Fitted the first time there's room to fit into (and whenever the project changes).
  useLayoutEffect(() => {
    if (!view && room.width > 0 && layout.cards.length) fit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.width, room.height, prototype.id])
  const shown = view ?? { x: 0, y: 0, zoom: 1 }
  const zoomBy = (factor) => setView((prev) => zoomAt(prev ?? shown, clampZoom((prev ?? shown).zoom * factor), { x: room.width / 2, y: room.height / 2 }))
  const zoomTo = (zoom) => setView((prev) => zoomAt(prev ?? shown, zoom, { x: room.width / 2, y: room.height / 2 }))

  // Wheel: pans — with ⌘/Ctrl (a trackpad pinch arrives that way) it zooms about the pointer.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return undefined
    const onWheel = (event) => {
      if (event.target.closest('[data-board-chrome], [data-prototype-player]')) return
      event.preventDefault()
      const box = el.getBoundingClientRect()
      if (event.ctrlKey || event.metaKey) setView((prev) => zoomAt(prev ?? { x: 0, y: 0, zoom: 1 }, clampZoom((prev?.zoom ?? 1) * Math.exp(-event.deltaY * 0.01)), { x: event.clientX - box.left, y: event.clientY - box.top }))
      else setView((prev) => ({ ...(prev ?? { x: 0, y: 0, zoom: 1 }), x: (prev?.x ?? 0) - event.deltaX, y: (prev?.y ?? 0) - event.deltaY }))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [setView])

  // Drag the board (anywhere that isn't a card's own button), or with Space held.
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [dragging, setDragging] = useState(false)
  function startPan(event) {
    if (event.button !== 0 && event.button !== 1) return
    if (event.target.closest('button, [data-board-chrome]')) return
    const onCard = event.target.closest('[data-screen-card]')
    if (onCard && !spaceHeld && event.button === 0) return
    event.preventDefault()
    const start = { x: event.clientX, y: event.clientY, view: shown }
    setDragging(true)
    const onMove = (move) => setView({ ...start.view, x: start.view.x + move.clientX - start.x, y: start.view.y + move.clientY - start.y })
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); setDragging(false) }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Playing: { history: [screenId, …] } — the screens passed through, the last one showing.
  const [playing, setPlaying] = useState(null)
  const starter = useRef(null)
  const play = (id = prototype.startScreenId) => {
    if (!screenOf(prototype, id)) return
    starter.current = document.activeElement
    setActivePageId(id)
    setPlaying({ history: [id] })
  }
  const stop = (last) => {
    setPlaying(null)
    if (last) setActivePageId(last)
    requestAnimationFrame(() => (starter.current?.isConnected ? starter.current : rootRef.current)?.focus?.())
  }
  const reveal = (id) => {
    const card = cardOf(id)
    if (!card) return
    setView((prev) => { const zoom = prev?.zoom ?? 1; return { zoom, x: room.width / 2 - (card.x + card.width / 2) * zoom, y: room.height / 2 - (card.y + card.height / 2) * zoom } })
  }

  function onKeyDown(event) {
    if (event.target !== event.currentTarget && !event.target.closest('[data-screen-card]')) return
    if (event.code === 'Space' && !event.repeat) { setSpaceHeld(true); event.preventDefault(); return }
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const at = order.indexOf(activePageId)
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
    if (step) {
      event.preventDefault()
      const next = order[Math.max(0, Math.min(order.length - 1, (at === -1 ? 0 : at + step)))]
      if (next) { setActivePageId(next); reveal(next) }
    } else if (event.key === 'Enter' && activePageId) {
      event.preventDefault()
      play(activePageId)
    }
  }

  const drawn = useMemo(() => new Set(visibleCards(layout.cards, shown, room).map((card) => card.id)), [layout, shown, room])
  const single = prototype.kind === 'single-page'

  if (!prototype.screens.length) {
    return (
      <div data-screens-board data-empty className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-slate-400" style={DOTS}>
        <p className="font-medium text-slate-200"><LocalizedText text="No screens yet" /></p>
        <p className="text-xs"><LocalizedText text="Screens show here once the project has a design page." /></p>
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      data-screens-board
      tabIndex={0}
      role="application"
      aria-label="Screens board"
      aria-roledescription="board"
      onKeyDown={onKeyDown}
      onKeyUp={(event) => { if (event.code === 'Space') setSpaceHeld(false) }}
      onBlur={() => setSpaceHeld(false)}
      onPointerDown={startPan}
      className={cn('relative h-full w-full touch-none overflow-hidden outline-none select-none focus-visible:ring-2 focus-visible:ring-emerald-300/60 focus-visible:ring-inset', dragging ? 'cursor-grabbing' : spaceHeld ? 'cursor-grab' : 'cursor-default')}
      style={{ ...DOTS, backgroundPosition: `${shown.x}px ${shown.y}px` }}
    >
      <div data-board-surface className="absolute top-0 left-0 origin-top-left" style={{ width: layout.width, height: layout.height, transform: `translate(${shown.x}px, ${shown.y}px) scale(${shown.zoom})` }}>
        {/* The flows' names, over their rows. */}
        {layout.groups.filter((group) => group.name).map((group) => (
          <p key={group.id} data-flow-group={group.id} className="absolute m-0 text-[15px] font-semibold tracking-tight text-slate-200" style={{ left: group.x, top: group.y }}>
            <LocalizedText text={group.name} />
          </p>
        ))}

        {/* The links: a straight line to the next screen of a row, a curve for a branch or a way back; the selected screen's are lit. */}
        <svg aria-hidden className="pointer-events-none absolute top-0 left-0 overflow-visible" width={layout.width} height={layout.height}>
          <defs>
            <marker id="screens-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" fill="context-stroke" /></marker>
          </defs>
          {links.map((link) => {
            const lit = link.from === activePageId || link.to === activePageId
            const path = linkPath(link, cardOf(link.from), cardOf(link.to), layout)
            return (
              <g key={link.id} data-screen-link={link.kind} data-lit={lit ? '' : undefined}>
                <path d={path.d} fill="none" markerEnd="url(#screens-arrow)" stroke={lit ? '#6ee7b7' : '#64748b'} strokeWidth={lit ? 2.5 : 1.5} strokeDasharray={link.kind === 'back' ? '6 5' : undefined} opacity={lit ? 1 : 0.7} />
                {lit && link.label && (
                  <text x={path.label.x} y={path.label.y} textAnchor="middle" fontSize="12" fill="#d1fae5" stroke="#18181b" strokeWidth="4" paintOrder="stroke">{link.label}</text>
                )}
              </g>
            )
          })}
        </svg>

        {layout.cards.map((card) => {
          const screen = screenOf(prototype, card.id)
          const selected = card.id === activePageId
          const out = new Set(transitionsOf(prototype, card.id).live.filter((t) => t.targetScreenId !== card.id).map((t) => t.targetScreenId)).size
          return (
            <div key={card.id} className="absolute" style={{ left: card.x, top: card.y - 32, width: card.width }}>
              <div className="flex h-8 items-center gap-1.5 text-[13px] text-slate-300">
                <span className="tabular-nums text-slate-500">{card.n}</span>
                <span aria-hidden className="text-slate-600">·</span>
                <span className={cn('min-w-0 truncate font-medium', selected ? 'text-white' : 'text-slate-300')}><LocalizedText text={screen.name} /></span>
                {card.start && (
                  <span data-screen-start className="ml-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] leading-none font-medium text-slate-200">
                    <Flag className="size-2.5" /><LocalizedText text="Start" />
                  </span>
                )}
                {selected && (
                  <span data-board-chrome className="ml-auto flex shrink-0 items-center gap-0.5">
                    <button type="button" data-screen-play title="Play from this screen" aria-label="Play from this screen" onClick={() => play(card.id)} className={TOOL}><Play className="size-3.5" /></button>
                    <button type="button" data-screen-edit title="Edit on the canvas" aria-label="Edit on the canvas" onClick={() => dockApi?.getPanel('canvas')?.api.setActive()} className={TOOL}><PencilRuler className="size-3.5" /></button>
                  </span>
                )}
              </div>
              <button
                type="button"
                data-screen-card={card.id}
                aria-pressed={selected}
                aria-label={`Screen ${card.n}, ${screen.name}, goes to ${out} ${out === 1 ? 'screen' : 'screens'}`}
                onClick={() => { setActivePageId(card.id); rootRef.current?.focus() }}
                onDoubleClick={() => play(card.id)}
                className={cn('relative block overflow-hidden rounded-xl bg-white text-left shadow-xl shadow-black/40 outline-none transition-shadow', selected ? 'ring-[3px] ring-emerald-300' : 'ring-1 ring-white/15 hover:ring-2 hover:ring-white/40')}
                style={{ width: card.width, height: card.height }}
              >
                {drawn.has(card.id) && <ScreenDrawing frame={screen.frame} />}
              </button>
            </div>
          )
        })}
      </div>

      {single && (
        <div data-board-chrome data-single-page className="absolute top-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-white/10 bg-card/95 py-1.5 pr-1.5 pl-3 text-xs text-slate-200 shadow-lg">
          <LocalizedText text="This project is a single page." />
          <button type="button" onClick={() => setWorkspaceView('preview')} className="rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-emerald-300">
            <LocalizedText text="View in Preview" />
          </button>
        </div>
      )}

      <div data-board-chrome data-board-toolbar role="toolbar" aria-label="Board" onPointerDown={(event) => event.stopPropagation()} className={cn(BAR, 'absolute top-3 right-3 z-20')}>
        <button type="button" data-board-play title="Play from the start" aria-label="Play from the start" onClick={() => play()} className={cn(TOOL, 'bg-white/10 px-2 font-medium text-white')}><Play className="size-3.5" /><LocalizedText text="Play" /></button>
        {prototype.flows.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger data-board-flows title="Go to a flow" className={cn(TOOL, 'px-2')}><LocalizedText text="Flows" /></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              {layout.groups.map((group) => (
                <DropdownMenuItem key={group.id} onClick={() => fit(group)} className="text-xs"><LocalizedText text={group.name ?? 'Screens'} /></DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <span aria-hidden className="mx-0.5 h-4 w-px bg-white/10" />
        <button type="button" data-board-fit title="Fit all" aria-label="Fit all" onClick={() => fit()} className={TOOL}><Maximize className="size-3.5" /></button>
        <button type="button" title="Zoom out" aria-label="Zoom out" disabled={shown.zoom <= ZOOM_MIN} onClick={() => zoomBy(1 / 1.25)} className={TOOL}><Minus className="size-3.5" /></button>
        <button type="button" data-board-zoom title="Zoom to 100%" aria-label="Zoom to 100%" onClick={() => zoomTo(1)} className={cn(TOOL, 'w-11 tabular-nums')}>{Math.round(shown.zoom * 100)}%</button>
        <button type="button" title="Zoom in" aria-label="Zoom in" disabled={shown.zoom >= ZOOM_MAX} onClick={() => zoomBy(1.25)} className={TOOL}><Plus className="size-3.5" /></button>
      </div>

      {playing && <PrototypePlayer prototype={prototype} order={order} playing={playing} setPlaying={setPlaying} onScreen={setActivePageId} onStop={stop} onReveal={(id) => { stop(id); reveal(id) }} />}
    </div>
  )
}

// The prototype, playing: the screen at its real size in a frame (smaller
// only when the view can't hold it; a long page scrolls inside it). A press
// on a hotspot goes where its transition says, the way it says (slide, fade
// or at once — at once under reduced motion); a press anywhere else shows
// where the hotspots are. Back steps through the screens passed; Esc ends it.
function PrototypePlayer({ prototype, order, playing, setPlaying, onScreen, onStop, onReveal }) {
  const current = playing.history[playing.history.length - 1]
  const screen = screenOf(prototype, current)
  const { live, broken } = transitionsOf(prototype, current)
  const frameRef = useRef(null)
  const scrollRef = useRef(null)
  const [room, setRoom] = useState({ width: 0, height: 0 })
  const [hint, setHint] = useState(false)
  const [how, setHow] = useState('none')

  useLayoutEffect(() => {
    const el = frameRef.current
    if (!el) return undefined
    const measure = () => setRoom({ width: el.clientWidth, height: el.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  // (A link that can't be followed is said once, for whoever keeps the data.)
  useEffect(() => {
    for (const t of broken) console.warn(`[prototype] "${t.id}" on "${current}" can't be followed: its hotspot or its target doesn't exist.`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current])
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('[role="menu"]')) return
      event.preventDefault()
      event.stopPropagation()
      onStop(current)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [current, onStop])
  const closeRef = useRef(null)
  useEffect(() => { closeRef.current?.focus() }, [])

  if (!screen) return null
  // Tall pages keep their width and scroll; a screen that fits is shown whole.
  const long = screen.size.height > screen.size.width * 1.6 && prototype.kind === 'single-page'
  const scale = room.width ? Math.min(1, (room.width - 48) / screen.size.width, long ? 1 : (room.height - 48) / screen.size.height) : 1
  const go = (transition) => {
    if (transition.scrollTo) {
      const target = screen.frame.layers.find((layer) => layer.id === transition.scrollTo)
      scrollRef.current?.scrollTo({ top: Math.max(0, (target?.y ?? 0) - 24) * scale, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
      return
    }
    setHow(transition.animation ?? 'none')
    setPlaying({ history: [...playing.history, transition.targetScreenId] })
    onScreen(transition.targetScreenId)
  }
  const back = () => { if (playing.history.length < 2) return; const history = playing.history.slice(0, -1); setHow('none'); setPlaying({ history }); onScreen(history[history.length - 1]) }
  const restart = (id = prototype.startScreenId) => { setHow('none'); setPlaying({ history: [id] }); onScreen(id) }
  const flash = () => { setHint(true); window.setTimeout(() => setHint(false), 700) }
  const hotspots = live.map((transition) => ({ transition, layer: screen.frame.layers.find((layer) => layer.id === transition.hotspotId) }))

  return (
    <div data-prototype-player role="dialog" aria-label="Prototype" onPointerDown={(event) => event.stopPropagation()} className="absolute inset-0 z-30 flex flex-col bg-[#101012]/95 animate-in fade-in duration-150 motion-reduce:animate-none">
      <div data-board-chrome role="toolbar" aria-label="Prototype" className="flex h-12 shrink-0 items-center gap-1 border-b border-white/[0.08] px-3">
        <button type="button" data-play-back title="Back" aria-label="Back" disabled={playing.history.length < 2} onClick={back} className={TOOL}><ArrowLeft className="size-3.5" /></button>
        <button type="button" data-play-restart title="Start over" aria-label="Start over" onClick={() => restart()} className={TOOL}><RotateCcw className="size-3.5" /></button>
        <p data-play-position className="mx-2 flex min-w-0 items-center gap-2 text-[13px] text-slate-100">
          <span className="min-w-0 truncate font-medium"><LocalizedText text={screen.name} /></span>
          <span className="shrink-0 tabular-nums text-slate-500">{order.indexOf(current) + 1} / {order.length}</span>
        </p>
        {prototype.flows.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger data-play-flows title="Play a flow from its first screen" className={cn(TOOL, 'px-2')}><LocalizedText text="Flows" /></DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-40">
              {prototype.flows.map((flow) => (
                <DropdownMenuItem key={flow.id} onClick={() => restart(flow.screenIds[0])} className="text-xs"><LocalizedText text={flow.name} /></DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <span className="ml-auto" />
        <button type="button" data-play-reveal onClick={() => onReveal(current)} className={cn(TOOL, 'px-2')}><LocateFixed className="size-3.5" /><LocalizedText text="Show on board" /></button>
        <button ref={closeRef} type="button" data-play-exit title="Exit · Esc" aria-label="Exit" onClick={() => onStop(current)} className={TOOL}><X className="size-4" /></button>
      </div>
      {/* (Said as the screen changes.) */}
      <span role="status" aria-live="polite" className="sr-only"><LocalizedText text={screen.name} /></span>
      <div ref={frameRef} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-6">
        <div ref={scrollRef} data-play-frame className={cn('relative max-h-full shrink-0 rounded-2xl bg-white shadow-2xl shadow-black/60 ring-1 ring-white/20', long ? 'overflow-y-auto' : 'overflow-hidden')} style={{ width: screen.size.width * scale, height: long ? undefined : screen.size.height * scale }}>
          <div style={{ width: screen.size.width * scale, height: screen.size.height * scale }}>
            <div
              key={`${current}:${playing.history.length}`}
              data-play-screen={current}
              onClick={flash}
              className={cn('relative origin-top-left motion-reduce:animate-none', how === 'slide' && 'animate-in fade-in slide-in-from-right-8 duration-200', how === 'fade' && 'animate-in fade-in duration-200')}
              style={{ width: screen.size.width, height: screen.size.height, transform: `scale(${scale})` }}
            >
              <ScreenDrawing frame={screen.frame} />
              {hotspots.map(({ transition, layer }) => layer && (
                <button
                  key={transition.id}
                  type="button"
                  data-hotspot={transition.hotspotId}
                  aria-label={transition.label ?? layer.name}
                  title={transition.label ?? layer.name}
                  onClick={(event) => { event.stopPropagation(); go(transition) }}
                  className={cn('absolute cursor-pointer rounded-md outline-none transition-shadow duration-150 focus-visible:ring-2 focus-visible:ring-sky-500', hint ? 'bg-sky-400/25 ring-2 ring-sky-500' : 'hover:ring-2 hover:ring-sky-500/50')}
                  style={{ left: layer.x, top: layer.y, width: layer.width, height: layer.height }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ScreensBoard
