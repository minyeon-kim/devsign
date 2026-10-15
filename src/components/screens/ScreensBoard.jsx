import { Component, Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Flag, Maximize, Minus, PencilRuler, Play, Plus, RotateCcw, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import PlayFrame from '@/components/screens/PlayFrame'
import { cameraFor, interactionsOf, pathAhead, readProto, tierOf, withProto } from '@/lib/boardPrototype'
import { canStepBack, currentOf, follow, isEnd, positionOf, restart as restartSession, startSession, stepBack } from '@/lib/prototypeEngine'
import { cn } from 'cn'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { HEAD_COLOR, PinShape } from '@/components/conflicts/ConflictPins'
import { assemblyToOverride, mergeOverride } from '@/components/mergestudio/mergeEffects'
import { overrideFromEdit } from '@/lib/prototypeSync'
import BoardConflicts, { BOARD_PANEL_WIDTH, BOARD_DETAIL_WIDTH } from '@/components/screens/BoardConflicts'
import { layerIdsOf } from '@/lib/conflictInsight'
import { reviewForDesign } from '@/lib/designReview'
import { useLanguage } from '@/i18n/language'
import { conflictSequence, conflictsByScreen, countLabel } from '@/lib/screenConflicts'
import { LocalizedText } from '@/i18n/runtime'
import { boardLayout, screenOf, transitionsOf } from '@/lib/screens'
import { resizeShift } from '@/lib/canvasCamera'
import { boardFit, clampZoom, focusView, glideAt, visibleCards, zoomAt, ZOOM_MAX, ZOOM_MIN } from '@/lib/screensBoard'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { liveOverridesOf, useCanvasPreview } from '@/lib/canvasPreview'

// Screens — the project's screens on one board, in the order its flows say
// (lib/screens' boardLayout), each flow in one row, in a region of its own
// under its name, with how many open changes each screen has. No lines between the cards:
// where a screen leads is what playing it shows.
//
//   · The board pans (drag, the wheel, Space + drag) and zooms (pinch or
//     ⌘/Ctrl + wheel, the toolbar) between 10% and 400%; it opens fitted.
//   · A press selects a screen — the screen in view everywhere else too
//     (Preview, Code, the side panel). ▶ shows it in Preview; "Edit" opens
//     it on the canvas, where its layers, pins and tools are.
//   · A double press (or Enter) plays the prototype in that card's place:
//     the card becomes the frame (PlayFrame), the camera moves once to show
//     it and where it leads, and from then on only what's in the frame
//     changes. The cards it leads to stay bright, the rest of the flow dims a
//     little and everything else a lot. ‹ ›, fixed at the board's bottom
//     centre, move the frame itself to the card before or after it on the
//     board (1 → 2 → 3 …), the camera gliding along, and play from there.
//   · The board's tools sit in the main window's tab row, at its right end. It's a session of its own (the same engine as
//     Preview — lib/prototypeEngine — but not Preview's session), in the
//     address as ?proto=<card>&at=<screen>. Esc ends it.
//   · A screen with open changes carries the change pin with their number,
//     the same size at any zoom; pressing it opens them in the pane beside
//     the Workspace (the change list, narrowed to that screen). The toolbar has the project's total, and its
//     ‹ › (J/K, [ ]) step through the changes one by one — screen by screen, top to bottom on each — the camera
//     gliding in on each one's element and the panel at the right showing its detail; Esc or ⛶ go back to
//     where the camera was before.
//   · The drawings on the cards are the screens themselves, scaled — never
//     interactive, each inside its own error boundary, and only the cards in
//     view are drawn.
// Viewing and playing only: links and hotspots aren't edited here.

const TOOL = 'flex h-7 min-w-7 items-center justify-center gap-1.5 rounded-full px-1.5 text-[11px] text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300 disabled:pointer-events-none disabled:opacity-40'
// (iOS: the tools as one floating capsule.)
const BAR = 'flex items-center gap-0.5 rounded-full border border-white/10 bg-card/95 p-0.5 shadow-lg backdrop-blur-sm'
// The zoom from which a screen's changes are shown on their elements rather than counted.
const DETAIL_ZOOM = 0.55

// A screen's changes by element: [{ layer, conflicts }] — one marker per element (several changes on one say how many).
function markersOf(screen, conflicts) {
  const byLayer = new Map()
  for (const conflict of conflicts) {
    for (const layerId of layerIdsOf(conflict)) {
      const layer = screen.frame.layers.find((entry) => entry.id === layerId)
      if (!layer) continue
      const marker = byLayer.get(layer.id) ?? { layer, conflicts: [] }
      if (!marker.conflicts.includes(conflict)) marker.conflicts.push(conflict)
      byLayer.set(layer.id, marker)
    }
  }
  return [...byLayer.values()]
}

// One element's marker: the canvas's change pin (its tip on the element's corner). Pressed, the board
// closes in on its change and the panel at the right shows it — several on one element: a number on the
// pin, and each press goes to the next of them. The one the board is on is bigger; while it's on one,
// every other is faded.
// (The board's markers: a size up from the canvas's pins — PIN — so they read over a screen's drawing.)
// (A little smaller than before — 19px heads, 22 when picked — so they mark without crowding the screens.)
const BOARD_PIN = { head: 19, height: 25, headSelected: 22, heightSelected: 29, inset: 8 }
function MarkerButton({ marker, lit, faded, onHover, onPress }) {
  const many = marker.conflicts.length > 1
  const label = many ? `${marker.conflicts.length} changes · ${marker.layer.name ?? ''}` : marker.conflicts[0].title
  const head = lit ? BOARD_PIN.headSelected : BOARD_PIN.head
  const height = lit ? BOARD_PIN.heightSelected : BOARD_PIN.height
  return (
    <button
      type="button"
      data-screen-marker={marker.layer.id}
      data-count={marker.conflicts.length}
      data-current={lit ? '' : undefined}
      aria-label={label}
      aria-current={lit ? 'true' : undefined}
      title={label}
      onClick={onPress}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      className="ds-intrinsic ds-pin absolute block cursor-pointer rounded-full outline-none transition-opacity duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 motion-reduce:transition-none"
      // (Its tip at the anchor: just above the element's top edge, over its middle — it marks the element without
      // covering any of it.)
      style={{ left: -head / 2, top: -height, width: head, height, opacity: faded ? 0.4 : 1 }}
    >
      <PinShape head={head} height={height} color={lit ? HEAD_COLOR.selected : HEAD_COLOR.default} />
      {many && <span data-pin-badge className="absolute flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-900 px-1 text-[10px] leading-none font-semibold text-white tabular-nums ring-1 ring-white" style={{ top: -6, right: -10 }}>{marker.conflicts.length}</span>}
    </button>
  )
}

// Far: how many changes a screen has, as a soft spreading circle over where they are (their elements'
// middle — the screen's, when none is on an element), the same size on screen at any zoom.
function CountBubble({ count, label, onOpen, cardId }) {
  return (
    <button
      type="button"
      data-screen-changes={cardId}
      data-count={count}
      aria-label={label}
      title={label}
      translate="no"
      onClick={onOpen}
      className="ds-intrinsic group/bubble relative flex size-6 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300"
    >
      {/* Its halo, and ripples that keep spreading out to its edge and fading (ds-ripple: two, half a beat
          apart) — still under reduced motion. */}
      <span aria-hidden className="pointer-events-none absolute -inset-2 rounded-full bg-[#F04E5A]/[0.12]" />
      <span aria-hidden data-ripple className="ds-ripple pointer-events-none absolute inset-0 rounded-full bg-[#F04E5A]/40" />
      <span aria-hidden data-ripple className="ds-ripple ds-ripple-late pointer-events-none absolute inset-0 rounded-full bg-[#F04E5A]/40" />
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full bg-[#F04E5A] shadow-md shadow-[#F04E5A]/40 transition-transform group-hover/bubble:scale-105" />
      <span className="relative text-[11px] leading-none font-bold text-white tabular-nums">+{count}</span>
    </button>
  )
}

// The ‹ › at the bottom of the board while a prototype plays.
const STEP = 'flex size-10 items-center justify-center rounded-xl border border-white/10 bg-card/95 text-slate-200 shadow-lg transition-colors hover:bg-white/[0.1] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300 disabled:pointer-events-none disabled:opacity-30'
// How far a flow's region reaches past its cards, on the board's scale.
const REGION_PAD = 40
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

// `overrides`: a fix previewed in place (lib/canvasPreview) — values put over what's built, by layer id.
function ScreenDrawing({ frame, overrides = null }) {
  return (
    <CardBoundary>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {frame.layers.map((layer) => <StaticLayer key={layer.id} layer={layer} override={overrides?.[layer.id]} />)}
      </div>
    </CardBoundary>
  )
}

function ScreensBoard() {
  const { prototype, activePageId, setActivePageId, setWorkspaceView, showScreenIn, boardView, dockApi, conflicts, continuePrototype, boardConflicts, setBoardConflicts, mergeItems, compareItemId, openCompareView, boardDockHost, setBoardDockShown, assetAssemblies, assetAdded, selectedLayerId, selectCanvasLayer, prototypeEdits, editPrototypeLayer, setFilesWindow, setSidePanel, scopedConflicts } = useWorkspace()
  // The screen being edited in its card's place (the card's ✎): its layers picked and its text typed right on the
  // board — the rest of the board stays round it. Esc, or ✎ again, and it's a card again.
  const [editing, setEditing] = useState(null)
  const editingRef = useRef(null)
  editingRef.current = editing
  // A layer picked on the screen being edited: selected, its properties in the tool panel's Inspect.
  const pickLayer = (id) => {
    selectCanvasLayer(id)
    setFilesWindow({ tab: 'inspect' })
    setSidePanel({ open: true })
  }
  // Text typed in place: into the edits the code file follows (a cancel — null — leaves it as it was).
  const editText = (layerId, slot, value, how) => { if (value !== null && !how?.live) editPrototypeLayer(layerId, { copy: { [slot]: value } }) }
  // What the Assets panel did to a screen (outside Merge Studio): components added to it, and layers given a
  // component's look — drawn with the screen's own.
  const withAssets = (frame, pageId) => (assetAdded?.[pageId]?.length ? { ...frame, layers: [...frame.layers, ...assetAdded[pageId]] } : frame)
  const overridesFor = (frame, pageId, base) => {
    const layers = withAssets(frame, pageId).layers
    let out = base
    // (What was typed or styled on it — the same edits the code file follows.)
    for (const layer of layers) {
      const o = prototypeEdits?.[layer.id] && overrideFromEdit(prototypeEdits[layer.id])
      if (o) out = { ...out, [layer.id]: mergeOverride(out?.[layer.id], o) }
    }
    for (const layer of layers) {
      const assembly = assetAssemblies?.[layer.id]
      const o = assembly && assemblyToOverride(assembly, layer)
      if (o) out = { ...out, [layer.id]: mergeOverride(out?.[layer.id], o) }
    }
    return out
  }
  const language = useLanguage()
  const layout = useMemo(() => boardLayout(prototype), [prototype])
  const order = layout.cards.map((card) => card.id)
  // The open changes, by screen (the workspace's own list: it changes as they're decided, and so does this).
  // (The viewer's own by default — the list's 내 할 일 / 전체 says which: the marks follow it.)
  const changes = useMemo(() => conflictsByScreen(prototype, scopedConflicts), [prototype, scopedConflicts])
  // …and one by one, in the order ‹ › walk them (lib/screenConflicts' conflictSequence).
  const sequence = useMemo(() => conflictSequence(prototype, conflicts, order), [prototype, conflicts, order.join()]) // eslint-disable-line react-hooks/exhaustive-deps
  const marking = boardConflicts.open
  // (Which element's marker is pointed at — its outline shows.)
  const [hotMarker, setHotMarker] = useState(null)
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
  // Left while it plays (another tab — Preview — or another view): it carries on there, from the screen it
  // was showing, with the screens passed through (WorkspaceProvider's continuePrototype).
  const playing = useRef(null)
  playing.current = proto
  const carryOn = useRef(continuePrototype)
  carryOn.current = continuePrototype
  useEffect(() => () => { if (playing.current) carryOn.current?.(playing.current.session) }, [])
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
  const [marks] = useState(true)

  const rootRef = useRef(null)
  const [room, setRoom] = useState({ width: 0, height: 0 })
  // { x, y, zoom }: where the board's top-left sits in the view, and its scale (1 = 100%).
  const [view, setViewState] = useState(() => (boardView.current?.projectId === prototype.id ? boardView.current.view : null))
  // (`fitted`: the view is the whole board fitted, as it opens or after "Fit all" — it stays fitted as
  // the room changes, until the board is moved or zoomed by hand.)
  const fitted = useRef(!view)
  // (A glide under way — glideTo — is let go of the moment anything else moves the board: a drag, the wheel, the toolbar.)
  const glideFrame = useRef(null)
  const setView = useCallback((next, { keepFitted = false, glide = false } = {}) => {
    if (!glide && glideFrame.current) { cancelAnimationFrame(glideFrame.current); glideFrame.current = null }
    if (!keepFitted) fitted.current = false
    setViewState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next
      boardView.current = { projectId: prototype.id, view: value }
      return value
    })
  }, [boardView, prototype.id])
  // (What the camera looks after when the room changes: the change the board is on, else the screen selected.)
  const watchedCards = useRef([])
  const windowResizedAt = useRef(-Infinity)
  useEffect(() => {
    const mark = () => { windowResizedAt.current = performance.now() }
    window.addEventListener('resize', mark)
    return () => window.removeEventListener('resize', mark)
  }, [])
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return undefined
    // (The board's room changing — a panel opening or closing beside it, the sidebar, the tool panel; every frame
    // of its easing — keeps what was at its centre at its centre: nothing is refitted, the zoom is left alone.
    // Only the window itself being resized, or the room settling as the board first appears, refits a board that
    // is still fitted.)
    let last = null
    const born = performance.now()
    const measure = () => {
      const next = { width: el.clientWidth, height: el.clientHeight }
      if (last && (last.width !== next.width || last.height !== next.height)) {
        const byPanel = performance.now() - born > 1200 && performance.now() - windowResizedAt.current > 300
        if (byPanel || !fitted.current) {
          const card = watchedCards.current.map((id) => id && el.querySelector(`[data-screen-card="${CSS.escape(id)}"]`)).find(Boolean)
          const origin = el.getBoundingClientRect()
          const rect = card?.getBoundingClientRect()
          const dx = resizeShift({ box: rect && { left: rect.left - origin.left, right: rect.right - origin.left }, before: last.width, after: next.width })
          const dy = (next.height - last.height) / 2
          setView((prev) => (prev ? { ...prev, x: prev.x + dx, y: prev.y + dy } : prev))
          fitted.current = false
        }
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
  const shownRef = useRef(shown)
  shownRef.current = shown
  // The camera gliding to a view in 300ms, eased in and out (lib/screensBoard's glideAt: backing out a
  // little on the way when it's going far). `area`: the part of the board it centres in.
  const glideTo = (target, area) => {
    if (glideFrame.current) cancelAnimationFrame(glideFrame.current)
    const from = shownRef.current
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { glideFrame.current = null; setView(target); return }
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 300)
      glideFrame.current = t < 1 ? requestAnimationFrame(tick) : null
      setView(t < 1 ? glideAt(from, target, t, area) : target, { glide: true })
    }
    glideFrame.current = requestAnimationFrame(tick)
  }
  useEffect(() => () => { if (glideFrame.current) cancelAnimationFrame(glideFrame.current) }, [])
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
  // ‹ ›: the frame moves to the card before or after it, in the board's order, and plays from that
  // screen; the camera glides to it at the zoom it's at (clear of the panel, as when it started).
  const [gliding, setGliding] = useState(false)
  const frameAt = proto ? order.indexOf(proto.frameId) : -1
  const moveFrame = (direction) => {
    const target = order[frameAt + direction]
    const card = cardOf(target)
    if (!proto || !card || frameRef.current?.busy()) return
    setProto({ frameId: target, session: startSession(target) })
    setHot(null)
    const inset = room.width >= 900 ? 312 : 0
    setGliding(true)
    window.setTimeout(() => setGliding(false), 360)
    setView((prev) => { const zoom = prev?.zoom ?? 1; return { zoom, x: inset + (room.width - inset) / 2 - (card.x + card.width / 2) * zoom, y: room.height / 2 - (card.y + card.height / 2) * zoom } })
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
  // In on one screen, near enough to see its changes' markers: the whole card in view, never under the
  // markers' zoom (DETAIL_ZOOM) nor past 120% — gliding there, and the screen selected.
  // (`inset`: what's floating over the board's right — the change list — so the card centres in what's clear of it.)
  const zoomToCard = (card, inset = 0) => {
    const width = room.width - inset
    const zoom = Math.min(1.2, Math.max(DETAIL_ZOOM + 0.1, Math.min((room.height - 120) / (card.height + 64), (width - 160) / card.width)))
    setActivePageId(card.id)
    setGliding(true)
    window.setTimeout(() => setGliding(false), 360)
    setView({ zoom, x: width / 2 - (card.x + card.width / 2) * zoom, y: room.height / 2 - (card.y - 16 + card.height / 2) * zoom })
  }
  // The change list floating over the board's right (Conflict Points, pressed while Screens shows — BoardConflicts):
  // screen by screen, in the board's order, then what's about no screen. Picking one glides in on its screen,
  // its element lit, and shows its detail in the panel.
  const listOpen = boardConflicts.open && !proto
  const boardGroups = [
    ...order.filter((id) => changes.byScreen.has(id)).map((id) => ({ id, n: cardOf(id)?.n ?? null, name: screenOf(prototype, id).name, conflicts: changes.byScreen.get(id) })),
    ...(changes.unplaced.length ? [{ id: null, n: null, name: 'Not on a screen', conflicts: changes.unplaced }] : []),
  ]
  // (The list is docked at the right of the work area, so the board is only as wide as what's left of it: the
  // panel is no longer over the board, and the camera has nothing of it to keep clear — `docked`.)
  const docked = Boolean(boardDockHost)
  // Design Compare's pick is marked in the list; the picked change's design set has its comparison one press away.
  const comparedConflictId = (() => { const item = mergeItems.find((entry) => entry.id === compareItemId); return item ? reviewForDesign(item, conflicts)?.id ?? null : null })()
  const pickedConflict = boardConflicts.conflictId ? conflicts.find((conflict) => conflict.id === boardConflicts.conflictId) ?? null : null
  useEffect(() => {
    setBoardDockShown(listOpen ? (pickedConflict ? 'detail' : 'list') : false)
    return () => setBoardDockShown(false)
  }, [listOpen, Boolean(pickedConflict), setBoardDockShown]) // eslint-disable-line react-hooks/exhaustive-deps
  // The change the board is on: the one whose detail the panel shows (one state for both — the panel and
  // the board can't disagree). -1: none.
  const focusAt = listOpen && pickedConflict ? sequence.findIndex((entry) => entry.conflict.id === pickedConflict.id) : -1
  const focused = focusAt === -1 ? null : sequence[focusAt]
  watchedCards.current = [focused?.screenId, activePageId]
  // (Where the camera was before it first closed in — Esc and ⛶ go back there.)
  const homeView = useRef(null)
  useEffect(() => { if (focusAt === -1) homeView.current = null }, [focusAt])
  // (Bumped on each arrival, so the outline's pulse plays again; and on going round, so the count flashes.)
  const [arrival, setArrival] = useState(0)
  // What's clear of the panel at the right (it floats over the board, 8px in): where the camera centres.
  const focusArea = () => {
    const width = room.width - (docked ? 0 : BOARD_DETAIL_WIDTH + 16)
    return width >= 240 ? { x: 0, y: 0, width, height: room.height } : { x: 0, y: 0, width: room.width, height: room.height }
  }
  // In on a change: the panel shows it, its screen is the one selected, the camera glides in on its
  // element(s) — about 40% of what's clear, 150%–400%, 48px of what's around it at least (lib/screensBoard's focusView).
  const focusOn = (entry) => {
    if (!entry || proto) return
    setBoardConflicts({ open: true, conflictId: entry.conflict.id })
    setArrival((n) => n + 1)
    const card = entry.screenId ? cardOf(entry.screenId) : null
    // (About no screen: nothing to close in on — the camera goes back out to where it was, the detail shows.)
    if (!card) { if (homeView.current) glideTo(homeView.current, { x: 0, y: 0, width: room.width, height: room.height }); return }
    if (!homeView.current) homeView.current = shownRef.current
    setActivePageId(entry.screenId)
    const area = focusArea()
    glideTo(focusView({ x: card.x + entry.box.x, y: card.y + entry.box.y, width: entry.box.width, height: entry.box.height }, area), area)
  }
  // ‹ ›: the next change (or the one before), one at a time; past the last, the first again — the count says so.
  const stepChange = (step) => {
    if (!sequence.length || proto) return
    const next = focusAt === -1 ? (step > 0 ? 0 : sequence.length - 1) : (focusAt + step + sequence.length) % sequence.length
    focusOn(sequence[next])
  }
  // Out: the camera back to where it was before it closed in (the change stays the one ‹ › go on from).
  const focusOut = () => {
    if (!homeView.current) return false
    const home = homeView.current
    homeView.current = null
    glideTo(home, { x: 0, y: 0, width: room.width, height: room.height })
    return true
  }
  // A change picked in the list: the board closes in on it and its detail shows in the panel — the Screens view stays.
  const pickBoardConflict = (conflict) => focusOn(sequence.find((entry) => entry.conflict.id === conflict.id))
  // A pin pressed: its change — several on it, the next of them after the one the board is on.
  const pressMarker = (screenId, marker) => {
    const ids = new Set(marker.conflicts.map((conflict) => conflict.id))
    const here = sequence.filter((entry) => entry.screenId === screenId && ids.has(entry.conflict.id))
    const at = focused ? here.findIndex((entry) => entry.conflict.id === focused.conflict.id) : -1
    focusOn(here[(at + 1) % here.length])
  }
  const reveal = (id) => {
    const card = cardOf(id)
    if (!card) return
    setView((prev) => { const zoom = prev?.zoom ?? 1; return { zoom, x: room.width / 2 - (card.x + card.width / 2) * zoom, y: room.height / 2 - (card.y + card.height / 2) * zoom } })
  }
  // J / K and ] / [ step through the changes from anywhere on the page while the board shows (not while
  // typing, not in a dialog or a menu); Esc takes the camera back out.
  const keys = useRef(null)
  keys.current = { stepChange, focusOut }
  useEffect(() => {
    const onKey = (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
      const el = rootRef.current
      if (!el || !el.getClientRects().length || document.querySelector('[role="menu"], [data-slot="dialog-content"], [data-review-overlay], [data-history-overlay], [data-picture-viewer]')) return
      const typing = document.activeElement instanceof HTMLElement && (document.activeElement.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName))
      if (typing) return
      const step = { j: 1, J: 1, ']': 1, k: -1, K: -1, '[': -1 }[event.key]
      if (step) { event.preventDefault(); keys.current.stepChange(step) }
      else if (event.key === 'Escape' && editingRef.current) { event.preventDefault(); setEditing(null) }
      else if (event.key === 'Escape' && keys.current.focusOut()) event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
  // A fix previewed in place: the way picked in the detail drawn on the screens it reaches, the cards
  // dashed green and saying it isn't applied. (Picking a way never moves the board.)
  const preview = useCanvasPreview()
  const previewOverrides = liveOverridesOf(preview)
  const previewWay = preview?.ways.find((way) => way.id === preview.picked) ?? null
  // Near enough to read a screen (55% and up): its changes are markers on their elements.
  const detailed = shown.zoom >= DETAIL_ZOOM

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
      <div data-board-surface className={cn('absolute top-0 left-0 origin-top-left', gliding && 'transition-transform duration-300 ease-out motion-reduce:transition-none')} style={{ width: layout.width, height: layout.height, transform: `translate(${shown.x}px, ${shown.y}px) scale(${shown.zoom})` }}>
        {/* The flows, each a region of its own with its name above it (the board's pad and the gap
            between flows leave the room). */}
        {layout.groups.map((group) => (
          <div key={group.id} data-flow-region={group.id} aria-hidden className="pointer-events-none absolute" style={{ left: group.x - REGION_PAD, top: group.y + 12, width: group.width + REGION_PAD * 2, height: group.height - 12 + REGION_PAD }}>
            <div className="absolute inset-0 rounded-2xl border border-white/[0.06] bg-white/[0.035]" />
            {group.name && (
              <p data-flow-group={group.id} className="absolute -top-11 left-0 m-0 rounded-lg bg-white/[0.07] px-3 py-1.5 text-[15px] leading-5 font-semibold tracking-tight text-slate-200">
                <LocalizedText text={group.name} />
              </p>
            )}
          </div>
        ))}

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
                    <button type="button" data-screen-edit aria-pressed={editing === card.id} title={editing === card.id ? 'Done editing · Esc' : 'Edit this screen'} aria-label={editing === card.id ? 'Done editing' : 'Edit this screen'} onClick={() => { if (editing === card.id) { setEditing(null); return } setEditing(card.id); if (shown.zoom < DETAIL_ZOOM) zoomToCard(card) }} className={cn(TOOL, editing === card.id && 'bg-emerald-400/15 text-emerald-200')}><PencilRuler className="size-3.5" /></button>
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
              ) : editing === card.id && !proto ? (
                // Editing in the card's place: the screen's own layers, each picked with a click (its properties open
                // in Inspect), its text typed with a double-click. Nothing pressed here reaches the board.
                <div
                  data-edit-frame={card.id}
                  onPointerDown={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => event.stopPropagation()}
                  onClick={(event) => { event.stopPropagation(); pickLayer(card.id) }}
                  className="relative overflow-hidden rounded-xl bg-white shadow-xl shadow-black/50 ring-[3px] ring-emerald-300"
                  style={{ width: card.width, height: card.height }}
                >
                  {(() => {
                    const frame = withAssets(screen.frame, card.id)
                    const overrides = overridesFor(screen.frame, card.id, null)
                    return frame.layers.map((layer) => (
                      <StaticLayer
                        key={layer.id}
                        layer={layer}
                        override={overrides?.[layer.id]}
                        selected={selectedLayerId === layer.id}
                        onSelect={() => pickLayer(layer.id)}
                        onEditText={editText}
                      />
                    ))
                  })()}
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
                {drawn.has(card.id) && <ScreenDrawing frame={withAssets(screen.frame, card.id)} overrides={overridesFor(screen.frame, card.id, preview?.pages.includes(card.id) ? previewOverrides : null)} />}
                {/* The layer selected (Layers, Assets): outlined where it is, so what Replace / Insert acts on — or what
                    was just added — is seen on the screen. */}
                {!proto && selectedLayerId && (() => {
                  const layer = withAssets(screen.frame, card.id).layers.find((entry) => entry.id === selectedLayerId)
                  return layer ? <span aria-hidden data-selected-layer={layer.id} className="pointer-events-none absolute z-10 rounded-[3px]" style={{ left: layer.x - 2, top: layer.y - 2, width: layer.width + 4, height: layer.height + 4, boxShadow: `0 0 0 ${1.5 / shown.zoom}px #5EEAB5` }} /> : null
                })()}
              </button>
              )}
              {previewWay && !proto && preview.pages.includes(card.id) && (
                <>
                  <span aria-hidden data-preview-border={card.id} className="pointer-events-none absolute rounded-[16px]" style={{ left: -6, right: -6, top: 32 - 6, height: card.height + 12, outline: `${2 / shown.zoom}px dashed var(--ds-accent)` }} />
                  {/* (Kept one size whatever the zoom, standing on the card's top right.) */}
                  <span data-preview-badge={card.id} className="pointer-events-none absolute z-20 flex origin-bottom-right items-center gap-1.5 rounded-full border border-[var(--ds-accent-border)] bg-[#0f1a15] px-2.5 py-1 text-[11.5px] leading-4 font-medium whitespace-nowrap text-[var(--ds-accent-text)] shadow-lg" style={{ right: 0, bottom: `calc(100% - 32px + 8px)`, transform: `scale(${1 / shown.zoom})` }}>
                    <span aria-hidden className="size-1.5 rounded-full bg-[var(--ds-accent)]" />옵션 {previewWay.n} 미리보기 · 적용 안 됨
                  </span>
                </>
              )}
              {/* Its open changes: the change pin with their number, at the card's top right — kept the
                  size it is on screen whatever the zoom. Its presses are its own: they never reach the
                  card (no select-then-preview) or the board (no drag). */}
              {/* Its open changes — by distance. Far (under 55%): "+3" at the card's top right, how many. Near:
                  a marker on every element a change is about (pointing at it outlines the element; pressing it
                  opens the change — or, several on one element, a list of them), and "+N" only for changes
                  about the screen as a whole. Kept the size they are on screen whatever the zoom; their
                  presses are their own — they never reach the card or the board. */}
              {(() => {
                if (!open.length) return null
                const markers = detailed && !proto ? markersOf(screen, open) : []
                // (Near, only the markers: the count is the far view's.)
                const rest = detailed && !proto ? [] : open
                const stop = { onPointerDown: (event) => event.stopPropagation(), onDoubleClick: (event) => event.stopPropagation() }
                return (
                  <>
                    {/* The change the board is on: its element(s) — the whole screen, when it names only the screen —
                        outlined in red, pulsing once as the camera arrives. */}
                    {focused?.screenId === card.id && (
                      <span key={arrival} aria-hidden data-focus-outline={focused.conflict.id} className="pointer-events-none absolute z-10 rounded-[4px]" style={{ left: focused.box.x - 4 / shown.zoom, top: 32 + focused.box.y - 4 / shown.zoom, width: focused.box.width + 8 / shown.zoom, height: focused.box.height + 8 / shown.zoom, boxShadow: `0 0 0 ${2 / shown.zoom}px #F04E5A` }}>
                        <span className="ds-focus-pulse absolute inset-0 rounded-[4px]" style={{ boxShadow: `0 0 0 ${3 / shown.zoom}px #F04E5A` }} />
                      </span>
                    )}
                    {/* (The pins a size down on a screen drawn small — its width under 420px on screen — so a dense
                    screen at a low zoom isn't covered by them: full size from 420px, 65% at the least.) */}
                {markers.map((marker) => {
                      // (Always above the element, over its middle — its tip just clear of the element's top edge, so it
                      // never covers the element it marks.)
                      const pinScale = Math.max(0.65, Math.min(1, (card.width * shown.zoom) / 420)) / shown.zoom
                      const anchor = { left: marker.layer.x + Math.min(marker.layer.width - BOARD_PIN.inset, Math.max(BOARD_PIN.inset, marker.layer.width / 2)), top: 32 + marker.layer.y - 6 / shown.zoom }
                      const current = Boolean(focused) && focused.screenId === card.id && marker.conflicts.some((conflict) => conflict.id === focused.conflict.id)
                      const lit = current || hotMarker === `${card.id}:${marker.layer.id}`
                      return (
                        <Fragment key={marker.layer.id}>
                          {lit && !current && <span aria-hidden data-marker-outline className="pointer-events-none absolute z-10 rounded-[4px]" style={{ left: marker.layer.x - 4 / shown.zoom, top: 32 + marker.layer.y - 4 / shown.zoom, width: marker.layer.width + 8 / shown.zoom, height: marker.layer.height + 8 / shown.zoom, boxShadow: `0 0 0 ${1.5 / shown.zoom}px #F04E5A` }} />}
                          <div data-board-chrome className={cn('absolute', current ? 'z-20' : 'z-10')} style={{ ...anchor, transform: `scale(${pinScale})`, transformOrigin: '0 0' }} {...stop}>
                            <MarkerButton
                              marker={marker}
                              lit={current}
                              faded={Boolean(focused) && !current}
                              onHover={(on) => setHotMarker(on ? `${card.id}:${marker.layer.id}` : null)}
                              onPress={() => pressMarker(card.id, marker)}
                            />
                          </div>
                        </Fragment>
                      )
                    })}
                    {rest.length > 0 && (() => {
                      // (Over where they are: the middle of their elements on this screen — the screen's middle when none is.)
                      const boxes = markersOf(screen, rest).map((marker) => marker.layer)
                      const cx = boxes.length ? boxes.reduce((sum, b) => sum + b.x + b.width / 2, 0) / boxes.length : card.width / 2
                      const cy = boxes.length ? boxes.reduce((sum, b) => sum + b.y + b.height / 2, 0) / boxes.length : card.height / 2
                      return (
                        <div data-board-chrome className="absolute z-10" style={{ left: cx, top: 32 + cy, transform: `translate(-50%, -50%) scale(${1 / shown.zoom})`, transformOrigin: 'center' }} {...stop}>
                          <CountBubble count={countLabel(rest.length)} label={openLabel(rest.length)} cardId={card.id}
                            // (Pressed: the board glides in on that screen, near enough for its markers.)
                            // (…and the change list comes up with it, on that screen's changes.)
                            onOpen={(event) => { event.stopPropagation(); zoomToCard(card, docked ? 0 : BOARD_PANEL_WIDTH + 64); setBoardConflicts({ open: true, conflictId: null, screenId: card.id }) }} />
                        </div>
                      )
                    })()}
                  </>
                )
              })()}
            </div>
          )
        })}
      </div>

      {/* (Prototyping: no panel of its own over the board — the screen's numbered marks are what can be pressed,
          and the flow's controls are the capsule at the foot.) */}
      {proto && <span role="status" aria-live="polite" className="sr-only"><LocalizedText text={screenOf(prototype, current).name} /></span>}


      {/* Prototyping, one capsule at the board's bottom centre — the frame moves, it stays: the flow and where in it,
          back and start over, the screens before and after, and leaving. */}
      {proto && (() => {
        const showing = screenOf(prototype, current)
        const position = positionOf(prototype, current)
        return (
          <div className={cn('pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center')}>
            <div data-board-chrome data-proto-steps data-proto-toolbar role="toolbar" aria-label="Prototype" onPointerDown={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()} className={cn(BAR, 'pointer-events-auto')}>
              <p data-proto-where className="mx-2 flex min-w-0 items-center gap-1.5 text-xs whitespace-nowrap text-slate-100">
                <span className="max-w-40 min-w-0 truncate font-medium"><LocalizedText text={position.flow?.name ?? showing.name} /></span>
                {position.step && <span className="shrink-0 tabular-nums text-slate-500">{position.step} / {position.total}</span>}
              </p>
              <span aria-hidden className="mx-0.5 h-4 w-px bg-white/10" />
              <button type="button" data-proto-back title="Back" aria-label="Back" disabled={!canStepBack(proto.session)} onClick={() => jump(stepBack(proto.session))} className={TOOL}><ArrowLeft className="size-3.5" /></button>
              <button type="button" data-proto-restart title="Start over" aria-label="Start over" onClick={() => jump(restartSession(prototype, proto.session))} className={TOOL}><RotateCcw className="size-3.5" /></button>
              <span aria-hidden className="mx-0.5 h-4 w-px bg-white/10" />
              <button type="button" data-proto-prev title="Previous screen" aria-label="Previous screen" disabled={frameAt <= 0} onClick={() => moveFrame(-1)} className={TOOL}><ChevronLeft className="size-4" /></button>
              <button type="button" data-proto-next title="Next screen" aria-label="Next screen" disabled={frameAt === -1 || frameAt >= order.length - 1} onClick={() => moveFrame(1)} className={TOOL}><ChevronRight className="size-4" /></button>
              <span aria-hidden className="mx-0.5 h-4 w-px bg-white/10" />
              <button type="button" data-proto-exit title="Exit · Esc" aria-label="Exit" onClick={exit} className={TOOL}><X className="size-4" /></button>
            </div>
          </div>
        )
      })()}

      {listOpen && (
        <BoardConflicts
          groups={boardGroups}
          total={changes.total}
          focusScreenId={boardConflicts.screenId ?? null}
          currentScreenId={activePageId}
          picked={pickedConflict}
          host={boardDockHost}
          marked={comparedConflictId}
          compareItem={pickedConflict ? mergeItems.find((item) => item.hasDesign && reviewForDesign(item, conflicts)?.id === pickedConflict.id) ?? null : null}
          onOpenCompare={(item) => openCompareView(item.id)}
          onPick={pickBoardConflict}
          onBack={() => setBoardConflicts({ conflictId: null })}
          onClose={() => setBoardConflicts({ open: false, conflictId: null })}
        />
      )}

      {/* The board's tools: a floating capsule at the bottom centre of the board — in one place, whatever opens
          at the right (they moved with the tab row's end before). */}
      {/* (While a prototype plays, its ‹ n / total › hold the bottom centre: the tools sit just above them.) */}
      <div className={cn('pointer-events-none absolute inset-x-0 z-20 flex justify-center', proto ? 'bottom-[72px]' : 'bottom-4')}>
      <div data-board-chrome data-board-toolbar role="toolbar" aria-label="Board" onPointerDown={(event) => event.stopPropagation()} className={cn('pointer-events-auto flex items-center gap-0.5', BAR)}>
        {/* (No flow menu: the board's flows are its regions, each named on it — fit and zoom are all it needs here.) */}
        <button type="button" data-board-fit title={focusAt !== -1 ? 'Back to the full view · Esc' : 'Fit all'} aria-label="Fit all" onClick={() => { if (!focusOut()) fit() }} className={TOOL}><Maximize className="size-3.5" /></button>
        <button type="button" title="Zoom out" aria-label="Zoom out" disabled={shown.zoom <= ZOOM_MIN} onClick={() => zoomBy(1 / 1.25)} className={TOOL}><Minus className="size-3.5" /></button>
        <button type="button" data-board-zoom title="Zoom to 100%" aria-label="Zoom to 100%" onClick={() => zoomTo(1)} className={cn(TOOL, 'w-11 tabular-nums')}>{Math.round(shown.zoom * 100)}%</button>
        <button type="button" title="Zoom in" aria-label="Zoom in" disabled={shown.zoom >= ZOOM_MAX} onClick={() => zoomBy(1.25)} className={TOOL}><Plus className="size-3.5" /></button>
      </div>
      </div>

    </div>
  )
}

export default ScreensBoard
