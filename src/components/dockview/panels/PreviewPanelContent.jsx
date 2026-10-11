import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Crosshair, Maximize2, MonitorSmartphone, PenTool, Smartphone, TriangleAlert, X } from 'lucide-react'
import { cn } from 'cn'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { LocalizedText } from '@/i18n/runtime'
import { DEVICES, focusBox, frameOnDevice, isPhoneFrame } from '@/lib/devicePreview'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import ChangePreview from '@/components/conflicts/ChangePreview'
import CanvasZoomControl, { MAX_CANVAS_ZOOM, MIN_CANVAS_ZOOM } from '@/components/workspace/CanvasZoomControl'
import { overrideFromEdit, prototypeFileForPage } from '@/lib/prototypeSync'
import { useWorkspace } from '@/state/WorkspaceProvider'
import CodeRender from '@/components/history/CodeRender'
import { VIEWPORTS, layoutAt, layoutChanged, viewportOf, viewportsChanged } from '@/lib/codeRender'

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
// The screen's width is picked from lib/codeRender's viewports (the one the
// change is about first); the design prototype is a toggle beside the
// render, never in its place.
const VIEWPORT_KEY = 'devsign.previewViewport'
const DEVICE_KEY = 'devsign.previewDevice'
const VIEW_KEY = 'devsign.previewView'
const stored = (key, fallback) => { try { return localStorage.getItem(key) ?? fallback } catch { return fallback } }
const store = (key, value) => { try { localStorage.setItem(key, value) } catch { /* this visit only */ } }
const VIEW_TAB = 'ds-intrinsic inline-flex h-6 items-center gap-1 rounded px-2 text-[11px] font-medium whitespace-nowrap transition-colors'
function PreviewPanelContent({ previewProps: snapshotProps, prototypeEdits: snapshotEdits, activePageId: snapshotPageId, frames: snapshotFrames, conflictPreview, conflictPreviewSide, caption, historical = false, embedded = false, snapshotKey, highlightLayerId, highlightKey = '', viewControls = false, focusLayerIds = [], codeRender = null } = {}) {
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
  const [viewportPick, setViewportPickState] = useState(() => stored(VIEWPORT_KEY, null))
  const setViewportPick = (id) => { setViewportPickState(id); store(VIEWPORT_KEY, id) }
  const [designShown, setDesignShown] = useState(false)

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
  const viewport = viewportOf(viewportPick ?? codeRender?.defaultViewport)
  // What's marked on it, worked out for the screen width in view — never
  // carried over from another one: the grid, where this checkpoint lays it
  // out differently from the one before (or, in a conflict's replay with no
  // step before, from the design — `reference`); and the parts the conflict
  // is about (`parts`), which are theirs at any width.
  const against = rendering ? (rendering.previous && viewportsChanged(rendering.spec, rendering.previous).length ? rendering.previous : rendering.reference ?? rendering.previous) : null
  const renderChanged = rendering ? layoutChanged(rendering.spec, against, viewport.id) : false
  const renderParts = rendering?.parts ?? []
  const canMarkRender = renderChanged || renderParts.length > 0
  // Changed, but not at this width (a tablet-only rule on a phone): where it is.
  const changedElsewhere = rendering && !canMarkRender ? viewportsChanged(rendering.spec, against) : []
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

  const panel = (
    <div data-preview-panel className={cn('flex h-full flex-col overflow-hidden', !embedded && !fullscreen && 'bg-card', fullscreen && 'pt-3')}>
      <div className={cn('flex shrink-0 items-center justify-between gap-2 px-4 pb-2 text-[11px] text-muted-foreground', embedded && !fullscreen ? 'pt-0' : 'pt-3')}>
        {rendering ? (
          // Which checkpoint's code this is, and the file it's read from.
          <span data-preview-source="code" className="flex min-w-0 items-baseline gap-1.5">
            <span className="shrink-0 font-semibold text-slate-100"><LocalizedText text={rendering.title} /></span>
            <span translate="no" className="min-w-0 truncate font-mono text-[10.5px]">{rendering.file}</span>
          </span>
        ) : codeRender ? (
          <span data-preview-source="design" className="min-w-0 truncate"><LocalizedText text="Design prototype" /> · <span translate="no">{file?.path}</span></span>
        ) : (
          <span data-preview-source="prototype" className="min-w-0 truncate">Synced from {file?.path}</span>
        )}
        <div className="flex shrink-0 items-center gap-2">
          {caption}
          <CanvasZoomControl zoom={zoom} onZoomBy={zoomBy} />
          {fullscreen && (
            <button type="button" data-preview-fullscreen-close onClick={() => setFullscreen(false)} className="ds-intrinsic inline-flex h-7 items-center gap-1.5 rounded-md bg-white/[0.08] px-2.5 text-[11px] font-medium text-white transition-colors hover:bg-white/[0.14]">
              <X className="size-3.5 shrink-0" />
              <LocalizedText text="Exit full screen" />
              <kbd className="rounded bg-white/[0.1] px-1 font-sans text-[10px] text-slate-300">Esc</kbd>
            </button>
          )}
        </div>
      </div>
      {viewControls && (
        <div data-preview-controls className="flex shrink-0 flex-wrap items-center gap-2 px-4 pb-2">
          {/* Always there (a step with nothing changed on the screen can't
              show any: it waits, disabled). */}
          {changedElsewhere.length > 0 ? (
            // Not hidden without a word: this width isn't affected, and
            // here's the one that is.
            <span data-preview-no-effect role="status" className="inline-flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-amber-400/10 px-2 py-1 text-[11px] text-amber-100 ring-1 ring-amber-300/25 ring-inset">
              <span>이 변경은 <LocalizedText text={viewport.label} />({viewport.width}px)에는 영향이 없어요</span>
              <button type="button" data-preview-go-viewport={changedElsewhere[0].id} onClick={() => setViewportPick(changedElsewhere[0].id)} className="ds-intrinsic inline-flex h-5 items-center rounded bg-amber-300/20 px-1.5 font-medium text-amber-50 transition-colors hover:bg-amber-300/30">
                <LocalizedText text={changedElsewhere[0].label} />({changedElsewhere[0].width}px)에서 보기
              </button>
            </span>
          ) : rendering?.unchanged && !canMarkRender ? (
            // (A checkpoint that recorded no code change has nothing to mark.)
            <span data-preview-unchanged className="inline-flex h-7 items-center rounded-md bg-white/[0.04] px-2 text-[11px] text-slate-400"><LocalizedText text="No code change in this version" /></span>
          ) : (
          <button type="button" data-preview-changed aria-pressed={marking} disabled={rendering ? !canMarkRender : !focus} onClick={() => setViewPick(marking ? 'full' : 'changed')}
            title={(rendering ? canMarkRender : focus) ? undefined : rendering ? 'Nothing changed at this screen width' : 'Nothing on the screen changed in this step'}
            className={cn(VIEW_TAB, 'h-7 disabled:cursor-not-allowed disabled:opacity-40', marking ? 'bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/40 ring-inset' : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.09] hover:text-white')}>
            <Crosshair className="size-3 shrink-0" />
            <LocalizedText text="Show changed elements" />
          </button>
          )}
          {marking && rendering && (
            <span data-preview-changed-names className="min-w-0 truncate text-[11px] text-slate-400">
              <LocalizedText text="Changed" /> · <span translate="no">{[renderChanged && `DashboardGrid · ${layoutAt(against, viewport.id).template} → ${layoutAt(rendering.spec, viewport.id).template}`, ...renderParts.map((part) => ({ cards: 'StatCard', cta: 'PurchaseCTA', title: 'Title', subtitle: 'Subtitle' })[part] ?? part)].filter(Boolean).join(' · ')}</span>
            </span>
          )}
          {marking && !rendering && (
            <span data-preview-changed-names className="min-w-0 truncate text-[11px] text-slate-400">
              <LocalizedText text="Changed" /> · <span translate="no">{focus.box.layers.map((layer) => layer.name ?? layer.id).join(', ')}</span>
            </span>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {rendering && (
              <>
                <button type="button" data-preview-design aria-pressed={designShown} onClick={() => setDesignShown((current) => !current)} className={cn(VIEW_TAB, 'h-7', designShown ? 'bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/40 ring-inset' : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.09] hover:text-white')}>
                  <PenTool className="size-3 shrink-0" />
                  <LocalizedText text="Design original" />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger data-preview-viewport={viewport.id} className="ds-intrinsic inline-flex h-7 items-center gap-1.5 rounded-md bg-white/[0.05] px-2 text-[11px] font-medium text-slate-200 transition-colors hover:bg-white/[0.09] hover:text-white">
                    <MonitorSmartphone className="size-3.5 shrink-0 text-slate-400" />
                    <LocalizedText text={viewport.label} />
                    <span className="text-slate-500 tabular-nums">{viewport.width}px</span>
                    <ChevronDown className="size-3 shrink-0 text-slate-400" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-44">
                    {VIEWPORTS.map((entry) => (
                      <DropdownMenuItem key={entry.id} data-viewport-option={entry.id} onClick={() => setViewportPick(entry.id)} className="gap-2 text-xs">
                        <Check className={cn('size-3.5', entry.id === viewport.id ? 'opacity-100' : 'opacity-0')} />
                        <LocalizedText text={entry.label} />
                        <span className="ml-auto pl-3 text-slate-500 tabular-nums">{entry.width}px</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
            {phone && !rendering && (
              <DropdownMenu>
                <DropdownMenuTrigger data-preview-device={device.id} className="ds-intrinsic inline-flex h-7 items-center gap-1.5 rounded-md bg-white/[0.05] px-2 text-[11px] font-medium text-slate-200 transition-colors hover:bg-white/[0.09] hover:text-white">
                  <Smartphone className="size-3.5 shrink-0 text-slate-400" />
                  <LocalizedText text={device.label} />
                  {device.width && <span className="text-slate-500 tabular-nums">{device.width}×{device.height}</span>}
                  <ChevronDown className="size-3 shrink-0 text-slate-400" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-52">
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
            {!fullscreen && (
              <button type="button" data-preview-fullscreen onClick={() => setFullscreen(true)} className={cn(VIEW_TAB, 'h-7 bg-white/[0.05] text-slate-200 hover:bg-white/[0.09] hover:text-white')}>
                <Maximize2 className="size-3 shrink-0" />
                <LocalizedText text="View full screen" />
              </button>
            )}
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
      <div ref={boxRef} className="flex min-h-0 flex-1 flex-col overflow-auto px-4 pb-4">
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
        <div key={historical ? snapshotKey : previewVersion} style={{ gap: FRAME_GAP }} className={cn('m-auto flex items-center animate-in fade-in duration-500', inRow ? 'flex-row' : 'w-full flex-col')}>
          {conflictPreview ? (
            <div className="w-full max-w-2xl rounded-xl bg-white/[0.03] p-4">
              <ChangePreview preview={conflictPreview} side={conflictPreviewSide} />
            </div>
          ) : rendering ? (() => {
            // This checkpoint's render — beside the latest's when comparing,
            // and the design original when asked for — each under its name,
            // all at one scale.
            const design = designShown ? frames[0] : null
            const count = 1 + (rendering.compare ? 1 : 0) + (design ? 1 : 0)
            const paneWidth = (room.width - 16 * (count - 1)) / count
            const paneHeight = room.height - 24
            const scale = Math.max(0.05, Math.min(1, paneWidth / viewport.width, paneHeight / viewport.height)) * (zoom / 100)
            const pane = (key, label, tone, node) => (
              <figure key={key} data-render-pane={key} className="m-0 flex min-w-0 flex-col items-center gap-1.5">
                {node}
                <figcaption className={cn('text-[11px] font-medium', tone)}><LocalizedText text={label} /> <span className="font-normal text-slate-500 tabular-nums">· {key === 'design' ? design.name : `${viewport.width}px`}</span></figcaption>
              </figure>
            )
            const designScale = design ? Math.max(0.05, Math.min(1.5, paneWidth / design.width, paneHeight / design.height)) * (zoom / 100) : 1
            return (
              <div className="flex items-start justify-center gap-4">
                {pane('checkpoint', rendering.title, 'text-slate-100', <CodeRender spec={rendering.spec} viewportId={viewport.id} scale={scale} marked={marking && renderChanged} parts={marking ? renderParts : []} />)}
                {rendering.compare && pane('latest', rendering.compare.title, 'text-emerald-300', <CodeRender spec={rendering.compare.spec} viewportId={viewport.id} scale={scale} />)}
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
