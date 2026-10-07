import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Crosshair, Maximize2, Smartphone } from 'lucide-react'
import { cn } from 'cn'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { LocalizedText } from '@/i18n/runtime'
import { DEVICES, focusBox, frameOnDevice, isPhoneFrame } from '@/lib/devicePreview'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import ChangePreview from '@/components/conflicts/ChangePreview'
import CanvasZoomControl, { MAX_CANVAS_ZOOM, MIN_CANVAS_ZOOM } from '@/components/workspace/CanvasZoomControl'
import { overrideFromEdit, prototypeFileForPage } from '@/lib/prototypeSync'
import { useWorkspace } from '@/state/WorkspaceProvider'

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
// `viewControls` (History): what to look at — the element that changed
// (`focusLayerIds`, zoomed in and ringed; the first view when there is one)
// or the full screen — and on which phone (lib/devicePreview), as tabs and
// a dropdown over the preview.
const DEVICE_KEY = 'devsign.previewDevice'
const VIEW_KEY = 'devsign.previewView'
const stored = (key, fallback) => { try { return localStorage.getItem(key) ?? fallback } catch { return fallback } }
const store = (key, value) => { try { localStorage.setItem(key, value) } catch { /* this visit only */ } }
const VIEW_TAB = 'ds-intrinsic inline-flex h-6 items-center gap-1 rounded px-2 text-[11px] font-medium whitespace-nowrap transition-colors'
function PreviewPanelContent({ previewProps: snapshotProps, prototypeEdits: snapshotEdits, activePageId: snapshotPageId, frames: snapshotFrames, conflictPreview, conflictPreviewSide, caption, historical = false, embedded = false, snapshotKey, highlightLayerId, highlightKey = '', viewControls = false, focusLayerIds = [] } = {}) {
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

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setBox({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

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
  const view = focus && viewPick === 'changed' ? 'changed' : 'full'

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

  return (
    <div className={cn('flex h-full flex-col overflow-hidden', !embedded && 'bg-card')}>
      <div className={cn('flex shrink-0 items-center justify-between gap-2 px-4 pb-2 text-[11px] text-muted-foreground', embedded ? 'pt-0' : 'pt-3')}>
        <span className="min-w-0 truncate">Synced from {file?.path}</span>
        <div className="flex shrink-0 items-center gap-2">
          {caption}
          <CanvasZoomControl zoom={zoom} onZoomBy={zoomBy} />
        </div>
      </div>
      {viewControls && (
        <div data-preview-controls className="flex shrink-0 items-center gap-2 px-4 pb-2">
          {/* Always both tabs (a version with nothing changed on the screen
              can't show "Changed element": that tab waits, disabled). */}
          <div role="tablist" aria-label="Preview view" className="inline-flex h-7 items-center gap-0.5 rounded-md bg-white/[0.05] p-0.5">
              {[['changed', 'Changed element', Crosshair], ['full', 'Full screen', Maximize2]].map(([id, label, Icon]) => (
                <button key={id} type="button" role="tab" data-preview-view={id} aria-selected={view === id} disabled={id === 'changed' && !focus} onClick={() => setViewPick(id)}
                  className={cn(VIEW_TAB, 'disabled:cursor-not-allowed disabled:opacity-40', view === id ? 'bg-white/[0.12] text-white' : 'text-slate-400 hover:text-slate-200')}>
                  <Icon className="size-3 shrink-0" />
                  <LocalizedText text={label} />
                </button>
              ))}
          </div>
          {phone && (
            <DropdownMenu>
              <DropdownMenuTrigger data-preview-device={device.id} className="ds-intrinsic ml-auto inline-flex h-7 items-center gap-1.5 rounded-md bg-white/[0.05] px-2 text-[11px] font-medium text-slate-200 transition-colors hover:bg-white/[0.09] hover:text-white">
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
        </div>
      )}

      {/* `m-auto` on the frame wrapper centers it in the space below the
          header instead of it sitting flush against it — the frame is
          usually much shorter than this panel, so without it the preview
          reads as crammed into the top-left corner. `overflow-auto` still
          scrolls to the full content when a frame is taller than the
          panel (auto margins collapse to 0 once there's no extra room). */}
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
          ) : view === 'changed' ? (() => {
            // The changed element, close up: its box (with room around
            // it) scaled to the space — up to 3×, then the zoom — and
            // ringed; the rest of the screen is cut off at the box.
            const { frame, box } = focus
            const scale = Math.max(0.05, Math.min(3, room.width / box.width, (room.height - 24) / box.height)) * (zoom / 100)
            return (
              <figure data-preview-focus className="m-0 flex flex-col items-center gap-2">
                <div className="relative shrink-0 overflow-hidden rounded-xl bg-white shadow-xl shadow-black/40 ring-1 ring-slate-200/80" style={{ width: box.width * scale, height: box.height * scale }}>
                  <div className="absolute" style={{ left: -box.x * scale, top: -box.y * scale, width: frame.width, height: frame.height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                    {frame.layers.map((layer) => <StaticLayer key={layer.id} layer={layer} override={layerOverride(layer)} onSelect={() => {}} />)}
                    {box.layers.map((layer) => (
                      <span key={`ring-${layer.id}`} aria-hidden className="pointer-events-none absolute rounded-md" style={{ left: layer.x - 3, top: layer.y - 3, width: layer.width + 6, height: layer.height + 6, boxShadow: `0 0 0 ${2 / scale}px rgb(52 211 153)` }} />
                    ))}
                  </div>
                </div>
                <figcaption className="text-[11px] text-slate-400">
                  <LocalizedText text="Changed" /> · <span translate="no">{box.layers.map((layer) => layer.name ?? layer.id).join(', ')}</span>
                </figcaption>
              </figure>
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
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default PreviewPanelContent
