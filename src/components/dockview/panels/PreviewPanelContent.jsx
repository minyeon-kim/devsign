import { useEffect, useRef, useState } from 'react'
import { cn } from 'cn'
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
// `fit` shows every frame at once: they're scaled to fit the panel's height
// as well as its width (side by side or stacked, whichever leaves them
// larger), so nothing has to be scrolled to — zooming in still can.
function PreviewPanelContent({ previewProps: snapshotProps, prototypeEdits: snapshotEdits, activePageId: snapshotPageId, frames: snapshotFrames, conflictPreview, conflictPreviewSide, caption, historical = false, showZoomControl = false, fit = false, snapshotKey } = {}) {
  const { activePageId, projectPages, prototypeEdits: liveEdits, previewProps: liveProps, previewVersion } = useWorkspace()
  const previewProps = snapshotProps ?? (historical ? {} : liveProps)
  const pageId = snapshotPageId ?? (historical ? projectPages[0]?.id : activePageId)
  const page = projectPages.find((p) => p.id === pageId) ?? projectPages[0]
  const frames = Array.isArray(snapshotFrames) && snapshotFrames.length ? snapshotFrames : page.frames
  const renderedEdits = snapshotEdits ?? (historical ? {} : liveEdits)
  const file = prototypeFileForPage(page.id)
  const boxRef = useRef(null)
  const [box, setBox] = useState({ width: 320, height: 240 })
  const { width } = box
  const [zoom, setZoom] = useState(100)

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

  // Fit mode: one scale for every frame, from whichever arrangement — a row
  // or a column — shows them larger in the space there is.
  const gaps = FRAME_GAP * (frames.length - 1)
  const sum = (key) => frames.reduce((total, frame) => total + frame[key], 0)
  const max = (key) => Math.max(...frames.map((frame) => frame[key]))
  // 2px short of the box, so rounding never tips it into a scrollbar.
  const room = { width: box.width - 2, height: box.height - 2 }
  const rowScale = Math.min((room.width - gaps) / sum('width'), room.height / max('height'))
  const columnScale = Math.min(room.width / max('width'), (room.height - gaps) / sum('height'))
  const inRow = fit && !conflictPreview && rowScale >= columnScale
  const fitScale = Math.max(0.05, Math.min(1, Math.max(rowScale, columnScale)))

  return (
    <div className={cn('flex h-full flex-col overflow-hidden', !fit && 'bg-card')}>
      <div className={cn('flex shrink-0 items-center justify-between gap-2 px-4 pb-2 text-[11px] text-muted-foreground', fit ? 'pt-0' : 'pt-3')}>
        <span className="min-w-0 truncate">Synced from {file?.path}</span>
        <div className="flex shrink-0 items-center gap-2">
          {caption}
          {showZoomControl && <CanvasZoomControl zoom={zoom} onZoomBy={zoomBy} />}
        </div>
      </div>

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
        <div key={historical ? snapshotKey : previewVersion} style={{ gap: FRAME_GAP }} className={cn('m-auto flex items-center animate-in fade-in duration-500', inRow ? 'flex-row' : 'w-full flex-col')}>
          {conflictPreview ? (
            <div className="w-full max-w-2xl rounded-xl bg-white/[0.03] p-4">
              <ChangePreview preview={conflictPreview} side={conflictPreviewSide} />
            </div>
          ) : frames.map((frame) => {
            const scale = (fit ? fitScale : Math.min(1, width / frame.width)) * (zoom / 100)
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
                  {frame.layers.map((layer) => {
                    const override = overrideFromEdit(renderedEdits[layer.id])
                    const withPadding =
                      layer.id === 'primary-button' && buttonPadding ? { ...override, padding: buttonPadding } : override
                    return <StaticLayer key={layer.id} layer={layer} override={withPadding} onSelect={() => {}} />
                  })}
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
