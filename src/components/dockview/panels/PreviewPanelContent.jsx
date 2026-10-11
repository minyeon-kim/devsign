import { Fragment, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Check, ChevronDown, ChevronsLeftRight, Crosshair, LayoutGrid, Maximize2, Minus, PenTool, Plus, Smartphone, TriangleAlert, X } from 'lucide-react'
import { cn } from 'cn'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { LocalizedText } from '@/i18n/runtime'
import { DEVICES, focusBox, frameOnDevice, isPhoneFrame } from '@/lib/devicePreview'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import ChangePreview from '@/components/conflicts/ChangePreview'
import CanvasZoomControl, { CANVAS_ZOOM_STEP, MAX_CANVAS_ZOOM, MIN_CANVAS_ZOOM } from '@/components/workspace/CanvasZoomControl'
import { overrideFromEdit, prototypeFileForPage } from '@/lib/prototypeSync'
import { useWorkspace } from '@/state/WorkspaceProvider'
import CodeRender, { INSPECT_TONE } from '@/components/history/CodeRender'
import { inspectionsFor, layoutAt, layoutChanged, screensChanged } from '@/lib/codeRender'
import { BREAKPOINT_LABEL, DEVICE_PRESETS, referencePick, screenOf } from '@/lib/devicePresets'
import DevicePicker from '@/components/history/DevicePicker'

// Space between frames, in px.
const FRAME_GAP = 24

// "12px 24px" → { y: 12, x: 24 }
function parsePadding(value) {
  const [y, x = y] = String(value ?? '')
    .split(/\s+/)
    .map((v) => parseFloat(v))
  return Number.isFinite(y) ? { y, x } : undefined
}

// The running prototype: the active canvas page rendered read-only at a
// size that fits the panel, from the same model as the canvas and its
// code file (see lib/prototypeSync) — so a text, fill or radius change on
// either side shows up here too. The AI chat's padding fix still applies
// to the primary button through `previewProps`.
// History renders it at a past version: `previewProps` then comes from that
// checkpoint's snapshot, and `caption` adds a label to its header.
// Every frame shows at once: they're scaled to fit the panel's height as
// well as its width (side by side or stacked, whichever leaves them
// larger), so nothing has to be scrolled to — the zoom control goes closer.
// `embedded` drops the panel's own surface and top inset, for a preview
// placed inside another card (the conflict review's change replay).
// `viewControls` (History, and a conflict's replay): the controls over the
// preview —
//   · "Show changed elements": the elements that changed since the step
//     before (`focusLayerIds`) ringed on the screen, on by default;
//   · which phone it's drawn on (lib/devicePreview);
//   · full screen: the same preview over the whole app, so the screen reads
//     at a real size whatever room its pane has — Esc or Close goes back,
//     and playback carries on under it.
// `codeRender` (History, a conflict's replay — a file lib/codeRender can
// read): the preview is that checkpoint's *code* on a screen, not the design
// prototype. `{ title, file, spec, previous, unchanged, compare, error }`:
//   · `spec` — what the checkpoint's code lays out; `title` says which
//     checkpoint ("Checkpoint #3 render"), `file` the code it's read from;
//   · `previous` — the checkpoint before it, for "Show changed elements";
//     `unchanged`: its code is the same as that one's (a decision request,
//     a detection) — said in place of the toggle;
//   · `compare` ({ title, spec }) — a second render beside it (the latest,
//     with "Compare latest" on);
//   · `error` — its code couldn't be rendered: said over the prototype,
//     which is then shown labelled as the design, never as the render.
// The screen it's on is a device of the kind the change is about
// (`category`; lib/devicePresets) — its reference device upright to start,
// then any other, on its side, or a width typed in (DevicePicker). "All
// devices" lays the kind's devices out together, the ones the layout breaks
// on flagged. The design prototype is a toggle beside the render, never in
// its place.
// `variant="compare"` (History's version comparison — and only there; a
// conflict's replay keeps the preview as it was): the renders sit on a canvas
// with room around them (never against its edge, never against each other),
// the zoom is in the toolbar, and a problem is inspected rather than drawn
// over the content — one hatched area where it is, its label outside the
// frame on a thin line (lib/codeRender's inspectionsFor). Inspection is off
// until the toolbar's button turns it on (kept for the session), and on in
// "Differences only" — except a problem on this version's own render
// (`codeRender.thisSide`: which of the two it is), which is marked from the
// start, one area. `toolbarExtra`: a control of the caller's, before the
// comparison modes. `emphasizeMark`: the id of a mark to draw stronger (the
// caller's line about it is hovered).
const INSPECT_KEY = 'devsign.previewInspect'
const sessionFlag = (key) => { try { return sessionStorage.getItem(key) === '1' } catch { return false } }
const LABEL_ROW = 24
const COMPARE_KEY = 'devsign.previewCompare'
// How two renders are compared (this version against the current one):
// side by side, one over the other with a divider to drag, or side by side
// with what differs marked.
const COMPARE_MODES = [['side', 'Renders side by side'], ['slider', 'Slider'], ['diff', 'Differences only']]
// At or under this window width, two renders side by side are too small to
// read: side by side becomes the slider.
const NARROW_WINDOW = 1280

// Two renders of one size, one over the other: the left one shows up to the
// divider, the right one past it. The divider drags, and moves with ← / →
// (Shift: further; Home / End: all the way).
function CompareSlider({ width, height, left, right }) {
  const [position, setPosition] = useState(50)
  const ref = useRef(null)
  const moveTo = (clientX) => {
    const bounds = ref.current.getBoundingClientRect()
    setPosition(Math.max(0, Math.min(100, ((clientX - bounds.left) / bounds.width) * 100)))
  }
  return (
    <div
      ref={ref}
      data-compare-slider
      className="relative shrink-0 cursor-ew-resize touch-none select-none"
      style={{ width, height }}
      onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); moveTo(event.clientX) }}
      onPointerMove={(event) => { if (event.buttons === 1) moveTo(event.clientX) }}
    >
      <div data-slider-side="right" className="absolute inset-0">{right}</div>
      <div data-slider-side="left" className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${position}%` }}>{left}</div>
      <div
        role="slider"
        tabIndex={0}
        data-slider-handle
        aria-label="Comparison divider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(position)}
        aria-valuetext={`${Math.round(position)}%`}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 10 : 2
          const next = event.key === 'ArrowLeft' ? position - step : event.key === 'ArrowRight' ? position + step : event.key === 'Home' ? 0 : event.key === 'End' ? 100 : null
          if (next === null) return
          event.preventDefault()
          event.stopPropagation()
          setPosition(Math.max(0, Math.min(100, next)))
        }}
        className="absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 bg-emerald-300 outline-none focus-visible:bg-white"
        style={{ left: `${position}%` }}
      >
        <span className="absolute top-1/2 left-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-emerald-300 text-slate-950 shadow-lg ring-2 ring-black/30"><ChevronsLeftRight className="size-4" /></span>
      </div>
    </div>
  )
}

const DEVICE_KEY = 'devsign.previewDevice'
const VIEW_KEY = 'devsign.previewView'
const stored = (key, fallback) => { try { return localStorage.getItem(key) ?? fallback } catch { return fallback } }
const store = (key, value) => { try { localStorage.setItem(key, value) } catch { /* this visit only */ } }
function PreviewPanelContent({ previewProps: snapshotProps, prototypeEdits: snapshotEdits, activePageId: snapshotPageId, frames: snapshotFrames, conflictPreview, conflictPreviewSide, caption, historical = false, embedded = false, snapshotKey, highlightLayerId, highlightKey = '', viewControls = false, focusLayerIds = [], codeRender = null, variant = null, toolbarExtra = null, emphasizeMark = null } = {}) {
  const { activePageId, projectPages, prototypeEdits: liveEdits, previewProps: liveProps, previewVersion } = useWorkspace()
  const previewProps = snapshotProps ?? (historical ? {} : liveProps)
  const pageId = snapshotPageId ?? (historical ? projectPages[0]?.id : activePageId)
  const page = projectPages.find((p) => p.id === pageId) ?? projectPages[0]
  const frames = Array.isArray(snapshotFrames) && snapshotFrames.length ? snapshotFrames : page.frames
  const renderedEdits = snapshotEdits ?? (historical ? {} : liveEdits)
  const file = prototypeFileForPage(page.id)
  const boxRef = useRef(null)
  const [box, setBox] = useState({ width: 320, height: 240 })
  const [zoom, setZoom] = useState(100)
  // The view and the phone picked — kept between visits (like the diff
  // layout) and through playback, which moves from step to step under them.
  const [viewPick, setViewPickState] = useState(() => stored(VIEW_KEY, 'changed'))
  const setViewPick = (view) => { setViewPickState(view); store(VIEW_KEY, view) }
  const [deviceId, setDeviceIdState] = useState(() => stored(DEVICE_KEY, 'design'))
  const setDeviceId = (id) => { setDeviceIdState(id); store(DEVICE_KEY, id) }
  // The last element that changed: a step that changes nothing on the
  // screen stays on it (rather than jumping to the full screen).
  const [lastFocus, setLastFocus] = useState([])
  const [fullscreen, setFullscreen] = useState(false)
  // A code render's screen width (the change's own first, then the one
  // picked), and whether the design prototype is shown beside it.
  // (Not kept between visits: a change opens on its own reference device.)
  const category = codeRender?.category ?? 'tablet'
  const [devicePick, setDevicePick] = useState(() => referencePick(category))
  const [pickedFor, setPickedFor] = useState(category)
  if (pickedFor !== category) { setPickedFor(category); setDevicePick(referencePick(category)) }
  const [designShown, setDesignShown] = useState(false)
  const [overview, setOverview] = useState(false)
  const compareView = variant === 'compare'
  const [inspectPick, setInspectPickState] = useState(() => sessionFlag(INSPECT_KEY))
  const setInspectPick = (on) => { setInspectPickState(on); try { sessionStorage.setItem(INSPECT_KEY, on ? '1' : '0') } catch { /* this view only */ } }
  // The inspection mark whose label is under the pointer (drawn stronger).
  const [hoverMark, setHoverMark] = useState(null)
  const [comparePick, setComparePickState] = useState(() => stored(COMPARE_KEY, 'side'))
  const setComparePick = (mode) => { setComparePickState(mode); store(COMPARE_KEY, mode) }

  // (Full screen moves the preview to another element: measured again.)
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setBox({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(el)
    return () => observer.disconnect()
  }, [fullscreen])

  // Esc leaves full screen — and only that: whatever is under it (the
  // review overlay closes on Esc too) doesn't hear the key.
  useEffect(() => {
    if (!fullscreen) return undefined
    function onKey(event) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setFullscreen(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [fullscreen])

  const buttonPadding = parsePadding(previewProps?.buttonPadding)
  function zoomBy(step) {
    setZoom((current) => Math.min(MAX_CANVAS_ZOOM, Math.max(MIN_CANVAS_ZOOM, current + step)))
  }

  // A layer as this version draws it: its edits, the button's padding and —
  // for a tab bar — the preview props a History checkpoint recorded.
  function layerOverride(layer) {
    const override = overrideFromEdit(renderedEdits[layer.id])
    const withPadding = layer.id === 'primary-button' && buttonPadding ? { ...override, padding: buttonPadding } : override
    return layer.type === 'tabs' && previewProps?.iconSize ? { ...withPadding, nav: previewProps } : withPadding
  }
  // On the phone picked (frames that aren't a phone's stay as drawn).
  const phone = viewControls && frames.some(isPhoneFrame)
  const device = phone ? DEVICES.find((entry) => entry.id === deviceId) ?? DEVICES[0] : DEVICES[0]
  const shownFrames = phone ? frames.map((frame) => frameOnDevice(frame, device.id)) : frames
  // The changed element, when there's one to show — this version's, else
  // the last one shown.
  const boxFor = (ids) => (ids.length ? shownFrames.map((frame) => ({ frame, box: focusBox(frame, ids) })).find((entry) => entry.box) ?? null : null)
  const ownFocus = viewControls ? boxFor(focusLayerIds) : null
  if (ownFocus && focusLayerIds.join() !== lastFocus.join()) setLastFocus(focusLayerIds)
  const focus = ownFocus ?? (viewControls ? boxFor(lastFocus) : null)
  // A code render: the checkpoint's code on a screen of the width picked.
  const rendering = codeRender?.spec ? codeRender : null
  const viewport = screenOf(devicePick, category)
  // What's marked on it, worked out for the screen width in view — never
  // carried over from another one: the grid, where this checkpoint lays it
  // out differently from the one before (or, in a conflict's replay with no
  // step before, from the design — `reference`); and the parts the conflict
  // is about (`parts`), which are theirs at any width.
  const against = rendering ? (rendering.previous && screensChanged(rendering.spec, rendering.previous, category).length ? rendering.previous : rendering.reference ?? rendering.previous) : null
  const renderChanged = rendering ? layoutChanged(rendering.spec, against, viewport) : false
  const renderParts = rendering?.parts ?? []
  const canMarkRender = renderChanged || renderParts.length > 0
  // Changed, but not at this width (a tablet-only rule on a phone): where it is.
  const changedElsewhere = rendering && !canMarkRender ? screensChanged(rendering.spec, against, category) : []
  // Whether the changed elements are ringed (there are some, and it's on).
  const marking = rendering ? canMarkRender && viewPick === 'changed' : Boolean(focus) && viewPick === 'changed'
  const changedIds = marking && focus && !rendering ? focus.box.layers.map((layer) => layer.id) : []

  // One scale for every frame, from whichever arrangement — a row
  // or a column — shows them larger in the space there is.
  const gaps = FRAME_GAP * (shownFrames.length - 1)
  const sum = (key) => shownFrames.reduce((total, frame) => total + frame[key], 0)
  const max = (key) => Math.max(...shownFrames.map((frame) => frame[key]))
  // 2px short of the box, so rounding never tips it into a scrollbar.
  const room = { width: box.width - 2, height: box.height - 2 }
  const rowScale = Math.min((room.width - gaps) / sum('width'), room.height / max('height'))
  const columnScale = Math.min(room.width / max('width'), (room.height - gaps) / sum('height'))
  const inRow = !conflictPreview && rowScale >= columnScale
  const fitScale = Math.max(0.05, Math.min(1, Math.max(rowScale, columnScale)))

  // Two renders compared: how (side by side unless the window's too narrow
  // for two to read — then the slider), and whether they differ on this screen.
  const comparing = Boolean(rendering?.compare) && !overview
  const narrow = typeof window !== 'undefined' && window.innerWidth <= NARROW_WINDOW && !fullscreen
  const compareMode = !comparing ? null : comparePick === 'side' && narrow ? 'slider' : COMPARE_MODES.some(([id]) => id === comparePick) ? comparePick : 'side'
  const versionsDiffer = comparing ? layoutChanged(rendering.spec, rendering.compare.spec, viewport) : false

  // The comparison's inspection: what's marked (per side), and whether it's on.
  const inspectable = compareView && rendering && !overview
  const inspecting = inspectable && (compareMode === 'diff' || inspectPick)
  const inspection = inspectable ? inspectionsFor(rendering.spec, comparing ? rendering.compare.spec : null, viewport, { difference: compareMode === 'diff' }) : { mine: [], other: [] }
  const inspectCount = inspection.mine.length + inspection.other.length
  // Compared, but the same on this screen (a tablet-only rule on a phone): where they do differ.
  const elsewhere = compareView && rendering ? (comparing && !versionsDiffer ? screensChanged(rendering.spec, rendering.compare.spec, category) : []) : changedElsewhere

  // What "Show changed elements" can't do here, as its tooltip: nothing
  // changed in the code at all, or nothing at this width.
  const canMark = rendering ? canMarkRender : Boolean(focus)
  const changedTitle = canMark ? 'Show changed elements'
    : rendering?.unchanged ? 'No code change since the version before'
      : rendering ? 'Nothing changed at this screen width' : 'Nothing on the screen changed in this step'
  // One icon button of the toolbar: named by its tooltip, lit while on.
  const tool = ({ id, label, Icon, on = false, disabled = false, onClick }) => (
    <button key={id} type="button" {...{ [`data-preview-${id}`]: '' }} aria-label={label} title={label} aria-pressed={on} disabled={disabled} onClick={onClick}
      className={cn('ds-intrinsic flex size-7 shrink-0 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-35', on ? 'bg-emerald-400/20 text-emerald-200 ring-1 ring-emerald-300/40 ring-inset' : 'text-slate-300 hover:bg-white/[0.09] hover:text-white')}>
      <Icon className="size-3.5" />
    </button>
  )

  const panel = (
    <div data-preview-panel className={cn('flex h-full flex-col overflow-hidden', !embedded && !fullscreen && 'bg-card', fullscreen && 'pt-3')}>
      {viewControls ? (
        // One line, whatever the pane's width: the device on the left (it
        // gives way first — its name truncates), the views as icon buttons
        // on the right. What's being rendered is said under the frame, once.
        <div data-preview-controls className={cn('flex shrink-0 flex-nowrap items-center gap-1.5 px-3 pb-2', embedded && !fullscreen ? 'pt-0' : 'pt-2.5')}>
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {toolbarExtra}
            {/* Comparing: how, first; the device moves to the right, with the views. */}
            {comparing && (
              <div role="tablist" aria-label="Comparison mode" data-compare-modes className="inline-flex h-7 shrink-0 items-center gap-0.5 rounded-md bg-white/[0.05] p-0.5">
                {COMPARE_MODES.map(([id, label]) => (
                  <button key={id} type="button" role="tab" data-compare-mode={id} aria-selected={compareMode === id} title={id === 'side' && narrow ? 'Shown as a slider in a narrow window' : undefined} onClick={() => setComparePick(id)}
                    className={cn('ds-intrinsic inline-flex h-6 items-center rounded px-2 text-[11px] font-medium whitespace-nowrap transition-colors', compareMode === id ? 'bg-white/[0.12] text-white' : 'text-slate-400 hover:text-slate-200')}>
                    <LocalizedText text={label} />
                  </button>
                ))}
              </div>
            )}
            {rendering && !comparing && !compareView && <DevicePicker compact category={category} pick={devicePick} onPick={(next) => { setDevicePick(next); setOverview(false) }} screen={viewport} />}
            {phone && !rendering && (
              <DropdownMenu>
                <DropdownMenuTrigger data-preview-device={device.id} className="ds-intrinsic inline-flex h-7 min-w-0 items-center gap-1.5 rounded-md bg-white/[0.05] px-2 text-[11px] font-medium text-slate-200 transition-colors hover:bg-white/[0.09] hover:text-white">
                  <Smartphone className="size-3.5 shrink-0 text-slate-400" />
                  <span className="min-w-0 truncate"><LocalizedText text={device.label} /></span>
                  {device.width && <span className="shrink-0 text-slate-500 tabular-nums">{device.width}</span>}
                  <ChevronDown className="size-3 shrink-0 text-slate-400" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-52">
                  {DEVICES.map((entry) => (
                    <DropdownMenuItem key={entry.id} data-device-option={entry.id} onClick={() => setDeviceId(entry.id)} className="gap-2 text-xs">
                      <Check className={cn('size-3.5', entry.id === device.id ? 'opacity-100' : 'opacity-0')} />
                      <LocalizedText text={entry.label} />
                      {entry.width && <span className="ml-auto pl-3 text-slate-500 tabular-nums">{entry.width}×{entry.height}</span>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {(comparing || (compareView && rendering)) && <span className="mr-1 flex min-w-0 items-center gap-1.5"><DevicePicker compact category={category} pick={devicePick} onPick={(next) => { setDevicePick(next); setOverview(false) }} screen={viewport} /></span>}
            {rendering && tool({ id: 'design', label: 'Compare with the design original', Icon: PenTool, on: designShown, onClick: () => setDesignShown((current) => !current) })}
            {rendering && tool({ id: 'overview', label: 'All devices', Icon: LayoutGrid, on: overview, onClick: () => setOverview((current) => !current) })}
            {compareView && rendering
              // Inspection: the problems on the screen(s), marked where they are.
              ? tool({ id: 'inspect', label: compareMode === 'diff' ? 'Inspection marks are always on in Differences only' : inspectCount ? 'Inspection marks' : 'Nothing to mark on this screen', Icon: Crosshair, on: inspecting && inspectCount > 0, disabled: !inspectable || compareMode === 'diff' || !inspectCount, onClick: () => setInspectPick(!inspectPick) })
              : tool({ id: 'changed', label: changedTitle, Icon: Crosshair, on: marking, disabled: !canMark, onClick: () => setViewPick(marking ? 'full' : 'changed') })}
            {fullscreen
              ? (
                <button type="button" data-preview-fullscreen-close aria-label="Exit full screen" title="Exit full screen" onClick={() => setFullscreen(false)} className="ds-intrinsic ml-1 inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md bg-white/[0.08] px-2 text-[11px] font-medium text-white transition-colors hover:bg-white/[0.14]">
                  <X className="size-3.5 shrink-0" />
                  <kbd className="rounded bg-white/[0.1] px-1 font-sans text-[10px] text-slate-300">Esc</kbd>
                </button>
              )
              : tool({ id: 'fullscreen', label: 'View full screen', Icon: Maximize2, onClick: () => setFullscreen(true) })}
            {/* The zoom, with the rest of the tools (not floating over the canvas). */}
            {compareView && (
              <span data-preview-zoom className="ml-1 inline-flex h-7 shrink-0 items-center rounded-md bg-white/[0.05]">
                <button type="button" aria-label="Zoom out" title="Zoom out" disabled={zoom <= MIN_CANVAS_ZOOM} onClick={() => zoomBy(-CANVAS_ZOOM_STEP)} className="ds-intrinsic flex size-7 items-center justify-center rounded-md text-slate-300 hover:bg-white/[0.09] hover:text-white disabled:opacity-35"><Minus className="size-3" /></button>
                <span className="w-9 text-center text-[10.5px] text-slate-200 tabular-nums">{zoom}%</span>
                <button type="button" aria-label="Zoom in" title="Zoom in" disabled={zoom >= MAX_CANVAS_ZOOM} onClick={() => zoomBy(CANVAS_ZOOM_STEP)} className="ds-intrinsic flex size-7 items-center justify-center rounded-md text-slate-300 hover:bg-white/[0.09] hover:text-white disabled:opacity-35"><Plus className="size-3" /></button>
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className={cn('flex shrink-0 items-center justify-between gap-2 px-4 pb-2 text-[11px] text-muted-foreground', embedded ? 'pt-0' : 'pt-3')}>
          <span data-preview-source="prototype" className="min-w-0 truncate">Synced from {file?.path}</span>
          <div className="flex shrink-0 items-center gap-2">
            {caption}
            <CanvasZoomControl zoom={zoom} onZoomBy={zoomBy} />
          </div>
        </div>
      )}

      {/* `m-auto` on the frame wrapper centers it in the space below the
          header instead of it sitting flush against it — the frame is
          usually much shorter than this panel, so without it the preview
          reads as crammed into the top-left corner. `overflow-auto` still
          scrolls to the full content when a frame is taller than the
          panel (auto margins collapse to 0 once there's no extra room). */}
      {/* (Its code couldn't be rendered: said — the prototype under it is the
          design, labelled so above.) */}
      {codeRender?.error && (
        <p data-preview-render-error role="status" className="mx-4 mb-2 flex shrink-0 items-start gap-1.5 rounded-lg bg-amber-400/10 px-3 py-2 text-[11.5px] leading-4 text-amber-100 ring-1 ring-amber-300/25 ring-inset">
          <TriangleAlert className="mt-px size-3.5 shrink-0 text-amber-300" />
          <span><LocalizedText text={codeRender.error} /> <LocalizedText text="Showing the design prototype instead." /></span>
        </p>
      )}
      <div className="relative flex min-h-0 flex-1 flex-col">
      {viewControls && (
        <>
          {/* What the marks are, or why there are none here — over the
              canvas, so the toolbar stays one line. */}
          {elsewhere.length > 0 ? (
            <span data-preview-status data-preview-no-effect role="status" className="absolute top-1 left-3 z-20 inline-flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-[#2a2415]/95 px-2 py-1 text-[11px] text-amber-100 shadow-lg ring-1 ring-amber-300/25 ring-inset">
              <span>이 변경은 <span translate="no">{viewport.custom ? '' : viewport.label}</span>({viewport.width}px · <LocalizedText text={BREAKPOINT_LABEL[viewport.breakpoint]} />)에는 영향이 없어요</span>
              <button type="button" data-preview-go-viewport={elsewhere[0].id} onClick={() => setDevicePick({ ...devicePick, deviceId: elsewhere[0].id, orientation: 'portrait' })} className="ds-intrinsic inline-flex h-5 items-center rounded bg-amber-300/20 px-1.5 font-medium text-amber-50 transition-colors hover:bg-amber-300/30">
                <span translate="no">{elsewhere[0].label}</span>({elsewhere[0].width}px)에서 보기
              </button>
            </span>
          ) : compareMode === 'diff' && !versionsDiffer && !inspectCount ? (
            <span data-preview-status data-compare-same role="status" className="absolute bottom-3 left-3 z-20 max-w-[55%] truncate rounded-md bg-black/60 px-2 py-1 text-[10.5px] text-slate-300">
              <LocalizedText text="Both versions render the same on this screen." />
            </span>
          ) : marking && !overview && !compareView && (
            <span data-preview-status data-preview-changed-names className="pointer-events-none absolute bottom-3 left-3 z-20 max-w-[55%] truncate rounded-md bg-black/60 px-2 py-1 text-[10.5px] text-slate-300">
              <LocalizedText text="Changed" /> · <span translate="no">{rendering
                ? [renderChanged && `DashboardGrid · ${layoutAt(against, viewport).template} → ${layoutAt(rendering.spec, viewport).template}`, ...renderParts.map((part) => ({ cards: 'StatCard', cta: 'PurchaseCTA', title: 'Title', subtitle: 'Subtitle' })[part] ?? part)].filter(Boolean).join(' · ')
                : focus.box.layers.map((layer) => layer.name ?? layer.id).join(', ')}</span>
            </span>
          )}
          {/* (A design-frame preview says which version it shows here; a code render says so under its frame.) */}
          {caption && !rendering && <span data-preview-caption className="pointer-events-none absolute top-1 right-3 z-20 rounded-md bg-black/60 px-2 py-1 text-[10.5px]">{caption}</span>}
          {!compareView && <div data-preview-zoom className="absolute right-3 bottom-3 z-20 origin-bottom-right scale-90"><CanvasZoomControl zoom={zoom} onZoomBy={zoomBy} /></div>}
        </>
      )}
      <div ref={boxRef} className={cn('flex min-h-0 flex-1 flex-col overflow-auto', compareView && rendering ? '' : 'pb-4', compareView && rendering ? '' : viewControls ? 'px-3' : 'px-4')}>
        {/* Keyed on the snapshot itself in historical mode (History's
            playback and version compare), not the live `previewVersion` —
            otherwise scrubbing/replaying through checkpoints swaps this
            content with no transition at all, reading as an abrupt jump
            instead of the design settling into its next state. */}
        {/* `highlightLayerId`: the element this step changed, ringed for a
            moment as the new state comes in. */}
        {highlightLayerId && (
          // The keyframes are named per `highlightKey`, so each step's ring
          // is a new animation and plays even on the same element.
          <style>{`
            @keyframes preview-changed-${String(highlightKey).replace(/[^a-zA-Z0-9_-]/g, '')} { 0% { box-shadow: 0 0 0 3px rgb(52 211 153 / 90%), 0 0 0 10px rgb(52 211 153 / 28%); } 100% { box-shadow: 0 0 0 3px rgb(52 211 153 / 0%), 0 0 0 10px rgb(52 211 153 / 0%); } }
            [data-layer-id="${CSS.escape(highlightLayerId)}"] { animation: preview-changed-${String(highlightKey).replace(/[^a-zA-Z0-9_-]/g, '')} 1200ms ease-out backwards; border-radius: 6px; z-index: 5; }
          `}</style>
        )}
        <div key={historical ? snapshotKey : previewVersion} style={{ gap: FRAME_GAP }} className={cn('flex items-center animate-in fade-in duration-500', compareView && rendering ? 'w-full' : viewControls ? 'mx-auto' : 'm-auto', inRow ? 'flex-row' : 'w-full flex-col')}>
          {conflictPreview ? (
            <div className="w-full max-w-2xl rounded-xl bg-white/[0.03] p-4">
              <ChangePreview preview={conflictPreview} side={conflictPreviewSide} />
            </div>
          ) : rendering && overview ? (() => {
            // Every device of the kind at once (in the orientation picked):
            // which breakpoint each falls in, and whether the layout holds.
            const screens = DEVICE_PRESETS[category].devices.map((device) => screenOf({ deviceId: device.id, orientation: devicePick.orientation }, category))
            const columns = Math.min(screens.length, room.width > 900 ? 6 : 3)
            const cell = (room.width - 12 * (columns - 1)) / columns
            const rows = Math.ceil(screens.length / columns)
            const cellHeight = (room.height - 12 * (rows - 1)) / rows - 40
            return (
              <div data-render-overview className="grid w-full justify-center gap-3" style={{ gridTemplateColumns: `repeat(${columns}, ${cell}px)` }}>
                {screens.map((screen) => {
                  const layout = layoutAt(rendering.spec, screen)
                  const scale = Math.max(0.03, Math.min(1, cell / screen.width, cellHeight / screen.height))
                  return (
                    <button key={screen.id} type="button" data-overview-device={screen.id} data-overview-status={layout.overlap ? 'overlap' : layout.squeezed != null ? 'squeezed' : 'ok'} onClick={() => { setDevicePick({ ...devicePick, deviceId: screen.id }); setOverview(false) }}
                      className="ds-intrinsic flex min-w-0 flex-col items-center gap-1 rounded-lg p-1 text-center transition-colors hover:bg-white/[0.05]">
                      <CodeRender spec={rendering.spec} screen={screen} scale={scale} />
                      <span translate="no" className="max-w-full truncate text-[11px] font-medium text-slate-200">{screen.label} <span className="font-normal text-slate-500 tabular-nums">{screen.width}</span></span>
                      <span className={cn('rounded px-1 text-[10px] font-medium', layout.overlap ? 'bg-rose-500/20 text-rose-200' : layout.squeezed != null ? 'bg-amber-400/20 text-amber-100' : 'bg-white/[0.06] text-slate-400')}>
                        <LocalizedText text={BREAKPOINT_LABEL[screen.breakpoint]} /> · {layout.columns}열{layout.overlap ? ` · 겹침 ${layout.overlap}px` : layout.squeezed != null ? ` · 간격 ${layout.squeezed}px` : ''}
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          })() : rendering && compareView ? (() => {
            // The comparison on its canvas: this version, an arrow, the other
            // version — fitted with room on every side (32px; 24px in a
            // narrow window) and at least 48px between them, the arrow in the
            // middle of that. Each frame's name is its caption, right above
            // it; what's inspected is hatched on the screen and named under
            // the frame, on a thin line.
            const pad = narrow ? 24 : 32
            const between = 48
            const captionHeight = 24
            const design = designShown ? frames[0] : null
            const other = rendering.compare
            const slider = compareMode === 'slider'
            // Inspecting: every mark. Otherwise just the problem on this
            // version's own render — one area, there from the start.
            const thisSide = rendering.thisSide ?? 'mine'
            const own = inspection[thisSide].filter((mark) => mark.tone !== 'info').slice(0, 1)
            const shared = own.length ? [] : inspection.mine.filter((mark) => mark.shared).slice(0, 1)
            const marks = inspecting ? inspection : { mine: thisSide === 'mine' ? own : shared, other: thisSide === 'other' ? own : [] }
            const labelRows = slider ? marks.mine.length + marks.other.length : Math.max(marks.mine.length, marks.other.length)
            const labelSpace = labelRows ? labelRows * LABEL_ROW + 8 : 0
            const count = 1 + (other && !slider ? 1 : 0) + (design ? 1 : 0)
            const paneWidth = (room.width - pad * 2 - between * (count - 1)) / count
            const paneHeight = room.height - pad * 2 - captionHeight - labelSpace
            // (One height for both, so they line up — and can lie over each other.)
            const contentHeight = Math.min(viewport.height, Math.max(layoutAt(rendering.spec, viewport).contentHeight, other ? layoutAt(other.spec, viewport).contentHeight : 0))
            const scale = Math.max(0.05, Math.min(1, paneWidth / viewport.width, paneHeight / contentHeight)) * (zoom / 100)
            const frameWidth = viewport.width * scale
            const frameHeight = contentHeight * scale
            const emphasisOf = (side) => (hoverMark?.side === side ? hoverMark.id : emphasizeMark)
            // A mark's name, outside the frame: under it, at the marked area,
            // on a 1px line from the area. Several stack downwards.
            const labels = (list, side, offset = 0) => list.map((item, index) => {
              const tone = INSPECT_TONE[item.tone] ?? INSPECT_TONE.info
              const x = (item.region.x + item.region.width / 2) * scale
              const from = Math.min(frameHeight, (item.region.y + item.region.height) * scale)
              const top = frameHeight + 8 + (index + offset) * LABEL_ROW
              return (
                <Fragment key={`${side}:${item.id}`}>
                  <span aria-hidden data-inspect-line={item.id} className="pointer-events-none absolute z-20 w-px" style={{ left: x, top: from, height: top - from, background: tone.line }} />
                  <span data-inspect-label={item.id} data-inspect-side={side} onMouseEnter={() => setHoverMark({ side, id: item.id })} onMouseLeave={() => setHoverMark(null)}
                    className="absolute z-20 -translate-x-1/2 cursor-default rounded-full px-2 text-[10.5px] leading-[18px] font-medium whitespace-nowrap text-slate-100"
                    style={{ left: x, top, border: `1px solid ${tone.line}`, background: 'color-mix(in oklab, var(--background) 82%, transparent)' }}>
                    {item.label}
                  </span>
                </Fragment>
              )
            })
            const caption = (key, label, tone) => (
              <figcaption className={cn('flex items-baseline justify-center gap-1 text-[11px] font-medium whitespace-nowrap', tone)} style={{ height: captionHeight }}>
                <LocalizedText text={label} /> <span className="font-normal text-slate-500 tabular-nums">· {key === 'design' ? design.name : `${viewport.width}px`}</span>
                {/* (A width outside the kind's breakpoint: the layout it gets.) */}
                {key !== 'design' && viewport.breakpoint !== category && <span data-render-breakpoint className="font-normal text-amber-200"> · <LocalizedText text={BREAKPOINT_LABEL[viewport.breakpoint]} /> <LocalizedText text="layout" /></span>}
              </figcaption>
            )
            const mine = <CodeRender spec={rendering.spec} screen={viewport} scale={scale} crop={contentHeight} inspect={marks.mine} emphasis={emphasisOf('mine')} />
            const theirs = other ? <CodeRender spec={other.spec} screen={viewport} scale={scale} crop={contentHeight} inspect={marks.other} emphasis={emphasisOf('other')} /> : null
            const framed = (node, list, side) => <div className="relative" style={{ width: frameWidth, height: frameHeight }}>{node}{labels(list, side)}</div>
            const designScale = design ? Math.max(0.05, Math.min(1.5, paneWidth / design.width, (paneHeight + labelSpace) / design.height)) * (zoom / 100) : 1
            return (
              <div data-render-compare={compareMode ?? 'single'} data-render-canvas className="flex w-full items-start justify-center" style={{ padding: pad, paddingBottom: pad + labelSpace }}>
                {slider ? (
                  <figure data-render-pane="slider" className="m-0 flex min-w-0 flex-col items-center">
                    {/* The two names over their own sides (never over the screen itself). */}
                    <figcaption className="flex items-baseline justify-between gap-3 text-[11px] font-medium" style={{ width: frameWidth, height: captionHeight }}>
                      <span data-slider-label="left" className="min-w-0 truncate text-slate-100"><LocalizedText text={rendering.title} /></span>
                      <span className="shrink-0 font-normal text-slate-500"><span className="tabular-nums">{viewport.width}px</span> · <LocalizedText text="Drag the divider, or press ← →" /></span>
                      <span data-slider-label="right" className="min-w-0 truncate text-emerald-300"><LocalizedText text={other.title} /></span>
                    </figcaption>
                    <div className="relative" style={{ width: frameWidth, height: frameHeight }}>
                      <CompareSlider width={frameWidth} height={frameHeight} left={mine} right={theirs} />
                      {labels(marks.mine, 'mine')}
                      {labels(marks.other, 'other', marks.mine.length)}
                    </div>
                  </figure>
                ) : (
                  <>
                    <figure data-render-pane="checkpoint" className="m-0 flex min-w-0 flex-col items-center">{caption('checkpoint', rendering.title, 'text-slate-100')}{framed(mine, marks.mine, 'mine')}</figure>
                    {other && (
                      // (The space between the frames, the arrow in its middle.)
                      <div aria-hidden data-render-arrow className="flex shrink-0 items-center justify-center text-slate-500" style={{ width: between, height: frameHeight, marginTop: captionHeight }}><ArrowRight className="size-5" /></div>
                    )}
                    {other && <figure data-render-pane="latest" className="m-0 flex min-w-0 flex-col items-center">{caption('latest', other.title, 'text-emerald-300')}{framed(theirs, marks.other, 'other')}</figure>}
                  </>
                )}
                {design && (
                  <figure data-render-pane="design" className="m-0 flex min-w-0 flex-col items-center" style={{ marginLeft: between }}>
                    {caption('design', 'Design original', 'text-sky-300')}
                    <div className="relative shrink-0 overflow-hidden rounded-xl bg-white shadow-xl shadow-black/40 ring-1 ring-slate-200/80" style={{ width: design.width * designScale, height: design.height * designScale }}>
                      <div className="relative" style={{ width: design.width, height: design.height, transform: `scale(${designScale})`, transformOrigin: 'top left' }}>
                        {design.layers.map((layer) => <StaticLayer key={layer.id} layer={layer} onSelect={() => {}} />)}
                      </div>
                    </div>
                  </figure>
                )}
              </div>
            )
          })() : rendering ? (() => {
            // This version's render — and, comparing, the current version's:
            // this version always on the left, an arrow, the current one on
            // the right (the way the code under it reads). Each stops at its
            // content, so the layout is read at a size, not a thumbnail. The
            // design original joins on the right when asked for.
            const design = designShown ? frames[0] : null
            const other = rendering.compare
            const slider = compareMode === 'slider'
            const count = 1 + (other && !slider ? 1 : 0) + (design ? 1 : 0)
            const arrow = other && !slider ? 32 : 0
            const paneWidth = (room.width - 16 * (count - 1) - arrow) / count
            const paneHeight = room.height - 28
            // (One height for both, so they line up — and can lie over each other.)
            const contentHeight = Math.min(viewport.height, Math.max(layoutAt(rendering.spec, viewport).contentHeight, other ? layoutAt(other.spec, viewport).contentHeight : 0))
            const scale = Math.max(0.05, Math.min(1, paneWidth / viewport.width, paneHeight / contentHeight)) * (zoom / 100)
            const marks = compareMode === 'diff' && versionsDiffer
            const pane = (key, label, tone, node) => (
              <figure key={key} data-render-pane={key} className="m-0 flex min-w-0 flex-col items-center gap-1.5">
                <figcaption className={cn('text-[11px] font-medium', tone)}>
                  <LocalizedText text={label} /> <span className="font-normal text-slate-500 tabular-nums">· {key === 'design' ? design.name : `${viewport.width}px`}</span>
                  {/* (A width outside the kind's breakpoint: the layout it gets.) */}
                  {key !== 'design' && viewport.breakpoint !== category && <span data-render-breakpoint className="font-normal text-amber-200"> · <LocalizedText text={BREAKPOINT_LABEL[viewport.breakpoint]} /> <LocalizedText text="layout" /></span>}
                </figcaption>
                {node}
              </figure>
            )
            const mine = <CodeRender spec={rendering.spec} screen={viewport} scale={scale} crop={contentHeight} marked={marks || (marking && renderChanged)} parts={marking ? renderParts : []} />
            const theirs = other ? <CodeRender spec={other.spec} screen={viewport} scale={scale} crop={contentHeight} marked={marks} /> : null
            const designScale = design ? Math.max(0.05, Math.min(1.5, paneWidth / design.width, paneHeight / design.height)) * (zoom / 100) : 1
            return (
              <div data-render-compare={compareMode ?? 'single'} className="flex items-start justify-center gap-4">
                {slider ? (
                  <figure data-render-pane="slider" className="m-0 flex min-w-0 flex-col items-center gap-1.5">
                    {/* The two names over their own sides (never over the screen itself). */}
                    <figcaption className="flex items-baseline justify-between gap-3 text-[11px] font-medium" style={{ width: viewport.width * scale }}>
                      <span data-slider-label="left" className="min-w-0 truncate text-slate-100"><LocalizedText text={rendering.title} /></span>
                      <span className="shrink-0 font-normal text-slate-500"><span className="tabular-nums">{viewport.width}px</span> · <LocalizedText text="Drag the divider, or press ← →" /></span>
                      <span data-slider-label="right" className="min-w-0 truncate text-emerald-300"><LocalizedText text={other.title} /></span>
                    </figcaption>
                    <CompareSlider width={viewport.width * scale} height={contentHeight * scale} left={mine} right={theirs} />
                  </figure>
                ) : (
                  <>
                    {pane('checkpoint', rendering.title, 'text-slate-100', mine)}
                    {other && <ArrowRight aria-hidden data-render-arrow className="mt-[72px] size-5 shrink-0 text-slate-500" />}
                    {other && pane('latest', other.title, 'text-emerald-300', theirs)}
                  </>
                )}
                {design && pane('design', 'Design original', 'text-sky-300', (
                  <div className="relative shrink-0 overflow-hidden rounded-xl bg-white shadow-xl shadow-black/40 ring-1 ring-slate-200/80" style={{ width: design.width * designScale, height: design.height * designScale }}>
                    <div className="relative" style={{ width: design.width, height: design.height, transform: `scale(${designScale})`, transformOrigin: 'top left' }}>
                      {design.layers.map((layer) => <StaticLayer key={layer.id} layer={layer} onSelect={() => {}} />)}
                    </div>
                  </div>
                ))}
              </div>
            )
          })() : shownFrames.map((frame) => {
            const scale = fitScale * (zoom / 100)
            return (
              <div
                key={frame.id}
                className="relative shrink-0 overflow-hidden rounded-xl bg-white shadow-xl shadow-black/40 ring-1 ring-slate-200/80"
                style={{ width: frame.width * scale, height: frame.height * scale }}
              >
                <div
                  className="relative"
                  style={{ width: frame.width, height: frame.height, transform: `scale(${scale})`, transformOrigin: 'top left' }}
                >
                  {frame.layers.map((layer) => <StaticLayer key={layer.id} layer={layer} override={layerOverride(layer)} onSelect={() => {}} />)}
                  {/* What changed since the step before, ringed where it
                      sits on the screen (the ring keeps its weight at any
                      scale). */}
                  {frame.layers.filter((layer) => changedIds.includes(layer.id)).map((layer) => (
                    <span key={`ring-${layer.id}`} data-preview-ring={layer.id} aria-hidden className="pointer-events-none absolute z-10 rounded-md" style={{ left: layer.x - 3, top: layer.y - 3, width: layer.width + 6, height: layer.height + 6, boxShadow: `0 0 0 ${2 / scale}px rgb(52 211 153), 0 0 0 ${6 / scale}px rgb(52 211 153 / 22%)` }} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      </div>
    </div>
  )

  if (!fullscreen) return panel
  // Over the whole app: above the review overlay, under menus and dialogs
  // (the phone dropdown still opens over it).
  return (
    <>
      <div data-preview-away className="flex h-full items-center justify-center text-[11px] text-slate-500"><LocalizedText text="Showing in full screen" /></div>
      {createPortal(
        <div data-preview-fullscreen-layer role="dialog" aria-modal="true" aria-label="Preview, full screen" className="fixed inset-0 z-[900] bg-background text-foreground animate-in fade-in duration-150 motion-reduce:animate-none">{panel}</div>,
        document.body
      )}
    </>
  )
}

export default PreviewPanelContent
