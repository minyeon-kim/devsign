import { Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Flag, Maximize, Minus, MousePointerClick, PencilRuler, Play, Plus, RotateCcw, TriangleAlert, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import PlayFrame from '@/components/screens/PlayFrame'
import { cameraFor, hotspotLine, interactionsOf, pathAhead, readProto, tierOf, withProto } from '@/lib/boardPrototype'
import { canStepBack, currentOf, follow, isEnd, positionOf, restart as restartSession, startSession, stepBack } from '@/lib/prototypeEngine'
import { cn } from 'cn'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ConflictCountPin } from '@/components/conflicts/ConflictPins'
import { useLanguage } from '@/i18n/language'
import { conflictsByScreen, countLabel } from '@/lib/screenConflicts'
import { LocalizedText } from '@/i18n/runtime'
import { boardLayout, linksOf, screenOf, transitionsOf } from '@/lib/screens'
import { boardFit, clampZoom, linkPath, visibleCards, zoomAt, ZOOM_MAX, ZOOM_MIN } from '@/lib/screensBoard'
import { useWorkspace } from '@/state/WorkspaceProvider'

// Screens — the project's screens on one board, in the order its flows say
// (lib/screens' boardLayout), with the links between them and how many open
// changes each has.
//
//   · The board pans (drag, the wheel, Space + drag) and zooms (pinch or
//     ⌘/Ctrl + wheel, the toolbar) between 10% and 200%; it opens fitted.
//   · A press selects a screen — the screen in view everywhere else too
//     (Preview, Code, the side panel). ▶ shows it in Preview; "Edit" opens
//     it on the canvas, where its layers, pins and tools are.
//   · A double press (or Enter) plays the prototype in that card's place:
//     the card becomes the frame (PlayFrame), the camera moves once to show
//     it and where it leads, and from then on only what's in the frame
//     changes. Lines run from the screen's hotspots to the cards they lead
//     to; those cards stay bright, the rest of the flow dims a little and
//     everything else a lot. It's a session of its own (the same engine as
//     Preview — lib/prototypeEngine — but not Preview's session), in the
//     address as ?proto=<card>&at=<screen>. Esc ends it.
//   · A screen with open changes carries the change pin with their number,
//     the same size at any zoom; pressing it opens them in the pane beside
//     the Workspace (the change list, narrowed to that screen). The toolbar has the project's total and steps through
//     the screens that have any.
//   · The drawings on the cards are the screens themselves, scaled — never
//     interactive, each inside its own error boundary, and only the cards in
//     view are drawn.
// Viewing and playing only: links and hotspots aren't edited here.

const TOOL = 'flex h-7 min-w-7 items-center justify-center gap-1.5 rounded-md px-1.5 text-[11px] text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300 disabled:pointer-events-none disabled:opacity-40'
const BAR = 'flex items-center gap-0.5 rounded-lg border border-white/10 bg-card/95 p-0.5 shadow-lg backdrop-blur-sm'
const PANEL_KEY = 'devsign.protoPanel'
// ①②③… for the interactions, as they're numbered in the frame, on the lines and in the panel.
const NUMERAL = (n) => (n >= 1 && n <= 20 ? String.fromCharCode(0x2460 + n - 1) : `(${n})`)
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
  const { prototype, activePageId, setActivePageId, setWorkspaceView, showScreenIn, boardView, dockApi, conflicts, requestConflictDrawer, setChangesOfScreenOnly } = useWorkspace()
  const language = useLanguage()
  const layout = useMemo(() => boardLayout(prototype), [prototype])
  const links = useMemo(() => linksOf(prototype, layout.cards), [prototype, layout])
  const order = layout.cards.map((card) => card.id)
  // The open changes, by screen (the workspace's own list: it changes as they're decided, and so does this).
  const changes = useMemo(() => conflictsByScreen(prototype, conflicts), [prototype, conflicts])
  const withChanges = order.filter((id) => changes.byScreen.has(id))
  const [marking, setMarking] = useState(false)
  const openLabel = (count) => (language === 'ko' ? `미해결 충돌 ${count}건` : `${count} open ${count === 1 ? 'change' : 'changes'}`)
  const cardOf = (id) => layout.cards.find((card) => card.id === id) ?? null

  // The prototype playing in a card's place: { frameId, session } — null when none is.
  const navigate = useNavigate()
  const location = useLocation()
  const [proto, setProtoState] = useState(() => {
    const said = readProto(location.search, prototype.screens.map((screen) => screen.id))
    return said ? { frameId: said.frameId, session: said.current === said.frameId ? startSession(said.frameId) : { history: [said.frameId, said.current] } } : null
  })
  const at = useRef(location)
  at.current = location
  const setProto = useCallback((next) => {
    setProtoState(next)
    const search = withProto(at.current.search, next ? { frameId: next.frameId, current: currentOf(next.session) } : null)
    if (search !== at.current.search) navigate({ pathname: at.current.pathname, search }, { replace: true, state: at.current.state })
  }, [navigate])
  const frameRef = useRef(null)
  // (The panel sits over the board's left: in a board wide enough, the camera centres on what's clear of it.)
  const cameraOf = (frameId, zoomNow) => {
    const inset = room.width >= 900 ? 312 : 0
    const camera = cameraFor(layout.cards, frameId, interactionsOf(prototype, frameId).map((entry) => entry.target).filter(Boolean), { width: room.width - inset, height: room.height }, zoomNow)
    return camera && { ...camera, x: camera.x + inset }
  }
  const cameraSet = useRef(!proto)
  const starter = useRef(null)
  const current = proto ? currentOf(proto.session) : null
  const interactions = proto ? interactionsOf(prototype, current) : []
  const [hot, setHot] = useState(null)
  const [marks, setMarks] = useState(true)
  const [panelOpen, setPanelOpen] = useState(() => { try { return localStorage.getItem(PANEL_KEY) !== '0' } catch { return true } })
  const togglePanel = () => setPanelOpen((on) => { try { localStorage.setItem(PANEL_KEY, on ? '0' : '1') } catch { /* not kept */ } return !on })

  const rootRef = useRef(null)
  const [room, setRoom] = useState({ width: 0, height: 0 })
  // { x, y, zoom }: where the board's top-left sits in the view, and its scale (1 = 100%).
  const [view, setViewState] = useState(() => (boardView.current?.projectId === prototype.id ? boardView.current.view : null))
  // (`fitted`: the view is the whole board fitted, as it opens or after "Fit all" — it stays fitted as
  // the room changes, until the board is moved or zoomed by hand.)
  const fitted = useRef(!view)
  const setView = useCallback((next, { keepFitted = false } = {}) => {
    if (!keepFitted) fitted.current = false
    setViewState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next
      boardView.current = { projectId: prototype.id, view: value }
      return value
    })
  }, [boardView, prototype.id])
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return undefined
    // (The board's room changing — a pane opening beside it, the window resized — keeps what was at
    // its centre at its centre: nothing is refitted, the zoom is left alone.)
    let last = null
    const measure = () => {
      const next = { width: el.clientWidth, height: el.clientHeight }
      if (last && !fitted.current && (last.width !== next.width || last.height !== next.height)) {
        const dx = (next.width - last.width) / 2
        const dy = (next.height - last.height) / 2
        setView((prev) => (prev ? { ...prev, x: prev.x + dx, y: prev.y + dy } : prev))
        fitted.current = false
      }
      last = next
      setRoom(next)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const fit = useCallback((box = layout) => { setView(boardFit(box, room), { keepFitted: true }); fitted.current = box === layout }, [layout, room, setView])
  // Fitted the first time there's room to fit into (and whenever the project changes).
  useLayoutEffect(() => {
    // (Not into a sliver: on arrival the window can be a few px wide for a frame while the panes take their places.)
    if (room.width < 240 || room.height < 200 || !layout.cards.length) return
    // (Opened from an address that says a prototype is playing: the camera goes to its frame, once, as if it had just been started.)
    if (proto && !cameraSet.current) {
      cameraSet.current = true
      const camera = cameraOf(proto.frameId, 0.5)
      if (camera) { setView(camera); return }
    }
    if (!view || fitted.current) fit()
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
      if (event.target.closest('[data-board-chrome]')) return
      event.preventDefault()
      // (Over the frame a plain wheel is the screen's — it never moves the board, even at the content's end. ⌘/Ctrl + wheel still zooms.)
      if (event.target.closest('[data-proto-frame]') && !(event.ctrlKey || event.metaKey)) return
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

  // Shown in Preview: the prototype plays from that screen there.
  const play = (id = prototype.startScreenId) => { if (screenOf(prototype, id)) showScreenIn('preview', id) }
  // Played here, in the card's place. The camera goes once — to the frame at a size that reads, with
  // where its screen leads in view when that fits — and stays there.
  const enter = (id) => {
    if (!screenOf(prototype, id) || proto) return
    starter.current = id
    setActivePageId(id)
    setProto({ frameId: id, session: startSession(id) })
    const camera = cameraOf(id, shown.zoom)
    if (camera) setView(camera)
  }
  const focusFrame = () => requestAnimationFrame(() => (rootRef.current?.querySelector('[data-proto-frame] [data-hotspot]') ?? rootRef.current?.querySelector('[data-proto-frame]'))?.focus({ preventScroll: true }))
  useEffect(() => { if (proto) focusFrame() }, [proto?.frameId]) // eslint-disable-line react-hooks/exhaustive-deps
  // A hotspot pressed (or its row in the panel): the engine says where it leads; the frame brings it in.
  // While a change is under way a press is let go — changes never stack.
  const press = (transition) => {
    if (!proto || frameRef.current?.busy()) return
    const result = follow(prototype, proto.session, transition)
    if (result.broken) { console.warn(`[prototype] "${transition?.id}" on "${current}" can't be followed: its hotspot or its target doesn't exist.`); return }
    if (!result.moved) return
    const target = screenOf(prototype, currentOf(result.session))
    if (frameRef.current?.go(target, transition.animation)) setProto({ ...proto, session: result.session })
  }
  const jump = (session) => {
    if (!proto || frameRef.current?.busy() || currentOf(session) === current) return
    frameRef.current?.show(screenOf(prototype, currentOf(session)))
    setProto({ ...proto, session })
    focusFrame()
  }
  const exit = () => {
    if (!proto) return
    const last = current
    setProto(null)
    setHot(null)
    setActivePageId(last)
    requestAnimationFrame(() => (rootRef.current?.querySelector(`[data-screen-card="${last}"]`) ?? rootRef.current)?.focus({ preventScroll: true }))
  }
  // Esc: out of a field first, then out of the prototype. (A menu that's open closes itself.)
  const exitNow = useRef(exit)
  exitNow.current = exit
  useEffect(() => {
    if (!proto) return undefined
    const onKey = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('[role="menu"], [data-slot="dialog-content"], [data-review-overlay], [data-history-overlay]')) return
      const el = document.activeElement
      if (el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) { el.blur(); return }
      event.preventDefault()
      exitNow.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [Boolean(proto)]) // eslint-disable-line react-hooks/exhaustive-deps
  const reveal = (id) => {
    const card = cardOf(id)
    if (!card) return
    setView((prev) => { const zoom = prev?.zoom ?? 1; return { zoom, x: room.width / 2 - (card.x + card.width / 2) * zoom, y: room.height / 2 - (card.y + card.height / 2) * zoom } })
  }
  // The next (or the one before) of the screens with open changes, in board order, from the one selected.
  const stepChange = (step) => {
    if (!withChanges.length) return
    const at = withChanges.indexOf(activePageId)
    const from = at === -1 ? (step > 0 ? -1 : 0) : at
    const next = withChanges[(from + step + withChanges.length) % withChanges.length]
    setActivePageId(next)
    reveal(next)
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
      enter(activePageId)
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
              <g key={link.id} data-screen-link={link.kind} data-lit={lit ? '' : undefined} opacity={proto ? 0.12 : 1}>
                <path d={path.d} fill="none" markerEnd="url(#screens-arrow)" stroke={lit ? '#6ee7b7' : '#64748b'} strokeWidth={lit ? 2.5 : 1.5} strokeDasharray={link.kind === 'back' ? '6 5' : undefined} opacity={lit ? 1 : 0.7} />
                {lit && link.label && (
                  <text x={path.label.x} y={path.label.y} textAnchor="middle" fontSize="12" fill="#d1fae5" stroke="#18181b" strokeWidth="4" paintOrder="stroke">{link.label}</text>
                )}
              </g>
            )
          })}
          {/* Playing: from each hotspot of the screen showing to the card it leads to, numbered as in the
              panel. Redrawn — faded in — as the screen changes; the one pointed at is lit. */}
          {proto && marks && (
            <g key={current} data-proto-lines className="animate-in fade-in duration-200 motion-reduce:animate-none">
              {interactions.filter((entry) => entry.layer && entry.target && entry.target !== proto.frameId && cardOf(entry.target)).map((entry) => {
                const path = hotspotLine(cardOf(proto.frameId), entry.layer, cardOf(entry.target))
                const lit = hot === entry.transition.id
                return (
                  <g key={entry.transition.id} data-proto-line={entry.transition.id} data-lit={lit ? '' : undefined} style={{ pointerEvents: 'stroke' }} onMouseEnter={() => setHot(entry.transition.id)} onMouseLeave={() => setHot(null)}>
                    <path d={path.d} fill="none" stroke="transparent" strokeWidth="14" />
                    <path d={path.d} fill="none" markerEnd="url(#screens-arrow)" stroke={lit ? '#7dd3fc' : '#38bdf8'} strokeWidth={lit ? 3 : 2} opacity={lit ? 1 : 0.85} />
                    <text x={path.label.x} y={path.label.y} textAnchor="middle" fontSize="12" fontWeight={lit ? 600 : 500} fill="#e0f2fe" stroke="#18181b" strokeWidth="4" paintOrder="stroke">
                      {/* (Between neighbours there's only room for the number: the rest is in the panel, and on hover.) */}
                      {path.short && !lit ? NUMERAL(entry.n) : `${NUMERAL(entry.n)} ${entry.transition.label ?? entry.layer.name} → ${screenOf(prototype, entry.target).name}`}
                    </text>
                  </g>
                )
              })}
            </g>
          )}
        </svg>

        {layout.cards.map((card) => {
          const screen = screenOf(prototype, card.id)
          const selected = card.id === activePageId
          const out = new Set(transitionsOf(prototype, card.id).live.filter((t) => t.targetScreenId !== card.id).map((t) => t.targetScreenId)).size
          const open = changes.byScreen.get(card.id) ?? []
          const dim = marking && !open.length
          // (Playing: what this card is to the screen showing — lib/boardPrototype's tierOf.)
          const tier = proto ? tierOf(prototype, { frameId: proto.frameId, current }, card.id) : null
          const leads = tier === 'next' ? interactions.filter((entry) => entry.target === card.id) : []
          return (
            <div key={card.id} data-screen-dim={dim ? '' : undefined} data-proto-tier={tier ?? undefined} className={cn('absolute transition-opacity duration-150 motion-reduce:transition-none', dim && 'opacity-30', tier === 'later' && 'opacity-60', tier === 'rest' && 'opacity-25', tier === 'frame' && 'z-10')} style={{ left: card.x, top: card.y - 32, width: card.width }}>
              <div className="flex h-8 items-center gap-1.5 text-[13px] text-slate-300">
                <span className="tabular-nums text-slate-500">{card.n}</span>
                <span aria-hidden className="text-slate-600">·</span>
                <span className={cn('min-w-0 truncate font-medium', selected ? 'text-white' : 'text-slate-300')}><LocalizedText text={screen.name} /></span>
                {card.start && (
                  <span data-screen-start className="ml-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] leading-none font-medium text-slate-200">
                    <Flag className="size-2.5" /><LocalizedText text="Start" />
                  </span>
                )}
                {tier === 'frame' && <span data-proto-badge className="ml-auto shrink-0 rounded-full bg-sky-400/20 px-1.5 py-0.5 text-[10px] leading-none font-semibold text-sky-200"><LocalizedText text="Prototype" /></span>}
                {tier === 'current' && <span data-proto-now className="ml-auto shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] leading-none font-medium text-slate-200"><LocalizedText text="Showing now" /></span>}
                {leads.length > 0 && <span data-proto-leads translate="no" className="ml-auto shrink-0 rounded-full bg-sky-400/20 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-sky-200">{leads.map((entry) => NUMERAL(entry.n)).join(' ')}</span>}
                {selected && !proto && (
                  <span data-board-chrome className="ml-auto flex shrink-0 items-center gap-0.5">
                    <button type="button" data-screen-play title="View from this screen in Preview" aria-label="View from this screen in Preview" onClick={() => play(card.id)} className={TOOL}><Play className="size-3.5" /></button>
                    <button type="button" data-screen-edit title="Edit on the canvas" aria-label="Edit on the canvas" onClick={() => dockApi?.getPanel('canvas')?.api.setActive()} className={TOOL}><PencilRuler className="size-3.5" /></button>
                  </span>
                )}
              </div>
              {tier === 'frame' ? (
                // The frame: this card's place, the prototype's screen. Nothing pressed in it reaches the board.
                <div
                  data-proto-frame={card.id}
                  tabIndex={-1}
                  role="group"
                  aria-label={`${screenOf(prototype, current)?.name ?? ''}, prototype, ${interactions.length} ${interactions.length === 1 ? 'interaction' : 'interactions'}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => { if (event.key !== 'Escape') event.stopPropagation() }}
                  className="relative w-max overflow-hidden rounded-xl shadow-xl shadow-black/50 ring-[3px] ring-sky-400 outline-none"
                >
                  <PlayFrame
                    ref={frameRef}
                    screen={screenOf(prototype, current)}
                    onArrive={focusFrame}
                    overlay={(showing) => interactionsOf(prototype, showing.id).map((entry) => entry.layer && (
                      <button
                        key={entry.transition.id}
                        type="button"
                        data-hotspot={entry.transition.hotspotId}
                        aria-label={`${entry.n}. ${entry.transition.label ?? entry.layer.name}`}
                        title={entry.transition.label ?? entry.layer.name}
                        onClick={() => press(entry.transition)}
                        onMouseEnter={() => setHot(entry.transition.id)}
                        onMouseLeave={() => setHot(null)}
                        onFocus={() => setHot(entry.transition.id)}
                        onBlur={() => setHot(null)}
                        className={cn('absolute z-20 cursor-pointer rounded-md outline-none transition-shadow duration-150 focus-visible:ring-2 focus-visible:ring-sky-500', hot === entry.transition.id ? 'bg-sky-400/20 ring-2 ring-sky-500' : marks ? 'ring-1 ring-sky-400/60' : 'hover:ring-2 hover:ring-sky-500/40')}
                        style={{ left: entry.layer.x, top: entry.layer.y, width: entry.layer.width, height: entry.layer.height }}
                      >
                        {marks && <span aria-hidden translate="no" className="absolute -top-2 -left-2 flex size-4 items-center justify-center rounded-full bg-sky-500 text-[9px] leading-none font-bold text-white">{entry.n}</span>}
                      </button>
                    ))}
                  />
                </div>
              ) : (
              <button
                type="button"
                data-screen-card={card.id}
                aria-pressed={selected}
                aria-label={`Screen ${card.n}, ${screen.name}, goes to ${out} ${out === 1 ? 'screen' : 'screens'}${open.length ? `, ${openLabel(open.length)}` : ''}`}
                onClick={() => { if (!proto) { setActivePageId(card.id); rootRef.current?.focus() } }}
                onDoubleClick={() => enter(card.id)}
                // (Playing: pointing at a card the screen leads to lights the hotspot that goes there.)
                onMouseEnter={leads.length ? () => setHot(leads[0].transition.id) : undefined}
                onMouseLeave={leads.length ? () => setHot(null) : undefined}
                className={cn('relative block overflow-hidden rounded-xl bg-white text-left shadow-xl shadow-black/40 outline-none transition-shadow', proto ? (leads.some((entry) => entry.transition.id === hot) ? 'ring-[3px] ring-sky-400' : 'ring-1 ring-white/15') : selected ? 'ring-[3px] ring-emerald-300' : 'ring-1 ring-white/15 hover:ring-2 hover:ring-white/40')}
                style={{ width: card.width, height: card.height }}
              >
                {drawn.has(card.id) && <ScreenDrawing frame={screen.frame} />}
              </button>
              )}
              {/* Its open changes: the change pin with their number, at the card's top right — kept the
                  size it is on screen whatever the zoom. Its presses are its own: they never reach the
                  card (no select-then-preview) or the board (no drag). */}
              {open.length > 0 && (
                <div data-board-chrome className="absolute z-10" style={{ top: 32 - 10, right: -6, transform: `scale(${1 / shown.zoom})`, transformOrigin: 'top right' }} onPointerDown={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    data-screen-changes={card.id}
                    data-count={open.length}
                    aria-label={openLabel(open.length)}
                    title={openLabel(open.length)}
                    translate="no"
                    // (Its changes, in the pane beside the Workspace — the list narrowed to this screen.)
                    onClick={(event) => { event.stopPropagation(); setActivePageId(card.id); setChangesOfScreenOnly(true); requestConflictDrawer() }}
                    className="ds-intrinsic flex cursor-pointer rounded-full p-1 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                  >
                    <ConflictCountPin label={countLabel(open.length)} />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {proto && (() => {
        const showing = screenOf(prototype, current)
        const position = positionOf(prototype, current)
        const ahead = pathAhead(prototype, current)
        const end = isEnd(prototype, current)
        return (
          <div data-board-chrome onPointerDown={(event) => event.stopPropagation()} className="absolute top-3 left-3 z-20 flex max-h-[calc(100%-1.5rem)] w-72 max-w-[calc(100%-1.5rem)] flex-col gap-2">
            <div data-proto-toolbar role="toolbar" aria-label="Prototype" className={cn(BAR, 'min-w-0')}>
              <p data-proto-where className="mx-1.5 flex min-w-0 flex-1 items-center gap-1.5 text-xs text-slate-100">
                <span className="min-w-0 truncate font-medium"><LocalizedText text={position.flow?.name ?? showing.name} /></span>
                {position.step && <span className="shrink-0 tabular-nums text-slate-500">{position.step} / {position.total}</span>}
              </p>
              <button type="button" data-proto-back title="Back" aria-label="Back" disabled={!canStepBack(proto.session)} onClick={() => jump(stepBack(proto.session))} className={TOOL}><ArrowLeft className="size-3.5" /></button>
              <button type="button" data-proto-restart title="Start over" aria-label="Start over" onClick={() => jump(restartSession(prototype, proto.session))} className={TOOL}><RotateCcw className="size-3.5" /></button>
              <button type="button" data-proto-marks aria-pressed={marks} title="Show interactions" aria-label="Show interactions" onClick={() => setMarks((on) => !on)} className={cn(TOOL, marks && 'bg-white/[0.12] text-white')}><MousePointerClick className="size-3.5" /></button>
              <button type="button" data-proto-preview title="Open this screen in Preview" aria-label="Open this screen in Preview" onClick={() => showScreenIn('preview', current)} className={TOOL}><Play className="size-3.5" /></button>
              <button type="button" data-proto-exit title="Exit · Esc" aria-label="Exit" onClick={exit} className={TOOL}><X className="size-4" /></button>
            </div>
            {/* (Said as the screen changes.) */}
            <span role="status" aria-live="polite" className="sr-only"><LocalizedText text={showing.name} /></span>
            {/* What can be pressed on this screen, and where the flow goes from here. A row does what its
                hotspot does — the whole flow can be walked from here without the pointer. */}
            <section data-proto-panel aria-label="Next interactions" className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-card/95 text-xs shadow-lg backdrop-blur-sm">
              <button type="button" aria-expanded={panelOpen} onClick={togglePanel} className="flex h-8 shrink-0 items-center gap-1.5 px-2.5 text-left font-medium text-slate-200 hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-emerald-300">
                <span className="min-w-0 flex-1 truncate"><LocalizedText text="Next interactions" /> · <LocalizedText text={showing.name} /></span>
                <ChevronDown className={cn('size-3.5 shrink-0 transition-transform duration-150 motion-reduce:transition-none', !panelOpen && '-rotate-90')} />
              </button>
              {panelOpen && (
                <div className="min-h-0 overflow-y-auto border-t border-white/[0.08] p-1">
                  {interactions.map((entry) => (
                    <button key={entry.transition.id} type="button" data-proto-row={entry.transition.id} disabled={!entry.target} onClick={() => press(entry.transition)} onMouseEnter={() => setHot(entry.transition.id)} onMouseLeave={() => setHot(null)} onFocus={() => setHot(entry.transition.id)} onBlur={() => setHot(null)}
                      className={cn('flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-emerald-300 disabled:opacity-60', hot === entry.transition.id ? 'bg-sky-400/15' : 'hover:bg-white/[0.05]')}>
                      <span translate="no" className="mt-px flex size-4 shrink-0 items-center justify-center rounded-full bg-sky-500 text-[9px] leading-none font-bold text-white">{entry.n}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-slate-100"><LocalizedText text={entry.transition.label ?? entry.layer?.name ?? ''} /> → <LocalizedText text={entry.target ? screenOf(prototype, entry.target).name : showing.name} /></span>
                        <span className="block text-[10.5px] text-slate-500"><LocalizedText text="Tap" /> · <span translate="no">{entry.transition.scrollTo ? 'scroll' : entry.transition.animation ?? 'none'}</span></span>
                      </span>
                    </button>
                  ))}
                  {end && (
                    <p data-proto-end className="flex items-center justify-between gap-2 px-2 py-1.5 text-slate-300">
                      <LocalizedText text="This is the end of the flow." />
                      <button type="button" onClick={() => jump(restartSession(prototype, proto.session))} className="shrink-0 rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-white/20"><LocalizedText text="Start over" /></button>
                    </p>
                  )}
                  {ahead.length > 0 && (
                    <p data-proto-ahead className="mt-1 border-t border-white/[0.08] px-2 pt-1.5 pb-1 text-[10.5px] leading-4 text-slate-500">
                      {ahead.map((id, index) => <span key={id}>{index > 0 && ' → '}<LocalizedText text={screenOf(prototype, id).name} /></span>)}
                    </p>
                  )}
                </div>
              )}
            </section>
          </div>
        )
      })()}

      {single && !proto && (
        <div data-board-chrome data-single-page className="absolute top-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-white/10 bg-card/95 py-1.5 pr-1.5 pl-3 text-xs text-slate-200 shadow-lg">
          <LocalizedText text="This project is a single page." />
          <button type="button" onClick={() => setWorkspaceView('preview')} className="rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-emerald-300">
            <LocalizedText text="View in Preview" />
          </button>
        </div>
      )}

      <div data-board-chrome data-board-toolbar role="toolbar" aria-label="Board" onPointerDown={(event) => event.stopPropagation()} className={cn(BAR, 'absolute top-3 right-3 z-20')}>
        {/* The project's open changes: pressed, the screens without any step back; ‹ › walk the ones with. */}
        {changes.total > 0 && (
          <>
            <button type="button" data-board-changes aria-pressed={marking} aria-label={openLabel(changes.total)} title={openLabel(changes.total)} translate="no" onClick={() => setMarking((on) => !on)} className={cn(TOOL, 'gap-1 px-2 tabular-nums', marking && 'bg-white/[0.12] text-white')}>
              <TriangleAlert className="size-3.5 text-amber-300" />{countLabel(changes.total)}
            </button>
            <button type="button" data-board-change-prev title="Previous screen with changes" aria-label="Previous screen with changes" disabled={!withChanges.length} onClick={() => stepChange(-1)} className={TOOL}><ChevronLeft className="size-3.5" /></button>
            <button type="button" data-board-change-next title="Next screen with changes" aria-label="Next screen with changes" disabled={!withChanges.length} onClick={() => stepChange(1)} className={TOOL}><ChevronRight className="size-3.5" /></button>
            <span aria-hidden className="mx-0.5 h-4 w-px bg-white/10" />
          </>
        )}
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

    </div>
  )
}

export default ScreensBoard
