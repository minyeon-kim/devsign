import { useEffect, useRef, useState } from 'react'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import CanvasZoomControl, { MAX_CANVAS_ZOOM, MIN_CANVAS_ZOOM } from '@/components/workspace/CanvasZoomControl'
import { overrideFromEdit, prototypeFileForPage } from '@/lib/prototypeSync'
import { useWorkspace } from '@/state/WorkspaceProvider'

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
function PreviewPanelContent({ previewProps: snapshotProps, prototypeEdits: snapshotEdits, activePageId: snapshotPageId, caption, showZoomControl = false } = {}) {
  const { activePageId, projectPages, prototypeEdits: liveEdits, previewProps: liveProps, previewVersion } = useWorkspace()
  const previewProps = snapshotProps ?? liveProps
  const pageId = snapshotPageId ?? activePageId
  const page = projectPages.find((p) => p.id === pageId) ?? projectPages[0]
  const renderedEdits = snapshotEdits ?? liveEdits
  const file = prototypeFileForPage(page.id)
  const boxRef = useRef(null)
  const [width, setWidth] = useState(320)
  const [zoom, setZoom] = useState(100)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const buttonPadding = parsePadding(previewProps?.buttonPadding)
  function zoomBy(step) {
    setZoom((current) => Math.min(MAX_CANVAS_ZOOM, Math.max(MIN_CANVAS_ZOOM, current + step)))
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-card">
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-3 pb-2 text-[11px] text-muted-foreground">
        <span className="min-w-0 truncate">Synced from {file?.path}</span>
        <div className="flex shrink-0 items-center gap-2">
          {caption}
          {showZoomControl && <CanvasZoomControl zoom={zoom} onZoomBy={zoomBy} />}
        </div>
      </div>

      <div ref={boxRef} className="min-h-0 flex-1 overflow-auto px-4 pb-4">
        <div key={previewVersion} className="flex flex-col items-center gap-6 animate-in fade-in duration-300">
          {page.frames.map((frame) => {
            const scale = Math.min(1, width / frame.width) * (zoom / 100)
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
