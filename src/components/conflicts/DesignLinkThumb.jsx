import { useState } from 'react'
import { cn } from 'cn'
import { LocalizedText } from '@/i18n/runtime'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import { designLinkOf } from '@/lib/conflictInsight'
import { useWorkspaceOptional } from '@/state/WorkspaceProvider'
import { ComponentSample, ElementPreviewDialog, ElementView, hasSample } from '@/components/conflicts/ElementPreview'
import { codeOverridesOf, codeSidesOf, cropOf, markOf, targetOf } from '@/lib/elementPreview'
import CodeRender from '@/components/history/CodeRender'
import { viewportOf } from '@/lib/codeRender'

// Which design screen a Conflict Point is about.
//   · In a list row (`size="sm"`): the element itself — its own component cut
//     out of the frame and enlarged, as the code currently renders it, the
//     changed property marked — so rows read apart at a glance. Pressing it
//     opens the element's preview (code beside design, full screen, its
//     place on the screen). A component that isn't on the design frame is
//     drawn alone from the conflict's values; with neither, the whole screen.
//   · In the review (`size="md"`): the frame with the element marked — where
//     it is. Pressing it goes there on the canvas (revealConflictOnCanvas).
// Draws nothing for a conflict that isn't about a screen, or outside a
// workspace.
const SIZES = { sm: { w: 76, h: 56 }, md: { w: 132, h: 120 } }

export function useDesignLink(conflict) {
  const workspace = useWorkspaceOptional()
  const link = workspace ? designLinkOf(conflict, workspace.projectPages) : null
  return { workspace, link }
}

// The screen's name in a list row (a quiet line under the thumbnail — every
// row of a one-frame page said "f1"); "Page 2/4 · Frame 1" and the element's
// name in the review.
export function DesignLinkChip({ conflict, compact = false, className }) {
  const { workspace, link } = useDesignLink(conflict)
  if (!link) return null
  const multiPage = link.pageCount > 1
  const label = `Page ${link.pageNumber}/${link.pageCount} · Frame ${link.frameNumber}`
  return (
    <button
      type="button"
      data-design-link-chip
      aria-label={[label, link.layer?.name].filter(Boolean).join(' · ')}
      title={[label, link.layer?.name].filter(Boolean).join(' · ')}
      onClick={(event) => { event.stopPropagation(); workspace.revealConflictOnCanvas(conflict) }}
      className={cn('ds-intrinsic inline-flex w-fit max-w-full cursor-pointer items-center gap-1 whitespace-nowrap rounded-md tabular-nums transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary', compact ? 'text-[10px] leading-3 text-slate-500' : 'bg-white/[0.06] px-1.5 py-0.5 text-[11px] leading-4 font-medium text-slate-200 hover:bg-white/[0.1]', className)}
    >
      {compact ? (
        <span translate="no" className="max-w-[76px] truncate">{link.frame.name}{link.frameCount > 1 ? ` · ${link.frameNumber}` : ''}</span>
      ) : (
        <>
          <span>{multiPage && <><LocalizedText text="Page" /> {link.pageNumber}/{link.pageCount} · </>}<LocalizedText text="Frame" /> {link.frameNumber}</span>
          {/* (About the screen as a whole: no element to name.) */}
          {link.layer && <span className="truncate text-slate-400">· {link.layer.name}</span>}
        </>
      )}
    </button>
  )
}

export default function DesignLinkThumb({ conflict, size = 'sm', className, placeholder = false, onOpenReview }) {
  const { workspace, link } = useDesignLink(conflict)
  const [previewOpen, setPreviewOpen] = useState(false)
  if (size === 'sm' && workspace && (link || hasSample(conflict))) {
    const target = targetOf(conflict, link)
    const box = SIZES.sm
    const resolved = conflict.resolved || conflict.reviewStage === 'resolved'
    // The element alone → the component drawn alone → the whole screen.
    const codeSides = target ? null : codeSidesOf(conflict)
    const mode = target ? 'element' : codeSides ? 'render' : hasSample(conflict) ? 'sample' : 'screen'
    let drawing
    if (mode === 'render') {
      // A layout the code decides: its code on the screen it's about, the grid marked.
      const viewport = viewportOf(codeSides.defaultViewport)
      drawing = <CodeRender spec={codeSides.before} viewportId={viewport.id} scale={Math.min(box.w / viewport.width, box.h / viewport.height)} marked />
    } else if (mode === 'element') {
      const region = cropOf(target.frame, [target.mainId], 8)
      const scale = Math.min(3, box.w / region.width, box.h / region.height)
      drawing = <ElementView frame={target.frame} region={region} scale={scale} overrides={codeOverridesOf(conflict, target.frame)} markIds={[target.mainId]} mark={markOf(conflict, target.frame, 'before')} tone={resolved ? 'done' : 'open'} />
    } else if (mode === 'sample') {
      drawing = <ComponentSample conflict={conflict} side="before" marked zoom={conflict.sample === 'legend' ? 0.72 : 0.33} />
    } else {
      const scale = Math.min(box.w / link.frame.width, box.h / link.frame.height)
      drawing = <ElementView frame={link.frame} region={{ x: 0, y: 0, width: link.frame.width, height: link.frame.height }} scale={scale} />
    }
    const label = [link?.frame.name, link?.layer?.name ?? conflict.impact?.components?.[0]].filter(Boolean).join(' · ')
    return (
      // (The dialog is this row's child: its clicks and keys stay its own.)
      <span className="contents" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
        <button
          type="button"
          data-design-link-thumb={mode}
          aria-label={`Open the element preview · ${label}`}
          title={label}
          onClick={() => setPreviewOpen(true)}
          className={cn('ds-intrinsic relative flex shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded-md ring-1 ring-white/15 transition-shadow hover:ring-2 hover:ring-emerald-300/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary', mode === 'sample' && conflict.sample !== 'legend' ? 'bg-[#1c1c1f]' : 'bg-white', className)}
          style={{ width: box.w, height: box.h }}
        >
          {drawing}
        </button>
        {previewOpen && <ElementPreviewDialog conflict={conflict} link={link} open onOpenChange={setPreviewOpen} onReveal={link ? () => workspace.revealConflictOnCanvas(conflict) : undefined} onOpenReview={onOpenReview} />}
      </span>
    )
  }
  // The element is gone from the canvas: say so where the screen is the point.
  if (!link) return placeholder && conflict?.layerId ? <span data-design-link-missing className={cn('text-[11px] text-slate-500', className)}><LocalizedText text="Screen not available" /></span> : null
  const { frame, layer } = link
  const box = SIZES[size]
  const scale = Math.min(box.w / frame.width, box.h / frame.height)
  const width = frame.width * scale
  const height = frame.height * scale
  const resolved = conflict.resolved || conflict.reviewStage === 'resolved'
  const label = [`Page ${link.pageNumber}/${link.pageCount} · Frame ${link.frameNumber}`, layer?.name].filter(Boolean).join(' · ')
  return (
    <button
      type="button"
      data-design-link-thumb
      aria-label={label}
      title={label}
      onClick={(event) => { event.stopPropagation(); workspace.revealConflictOnCanvas(conflict) }}
      className={cn('ds-intrinsic relative block shrink-0 cursor-pointer overflow-hidden rounded-md bg-white ring-1 ring-white/15 transition-shadow hover:ring-2 hover:ring-emerald-300/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary', className)}
      style={{ width, height }}
    >
      {/* The frame drawn at its real size, then scaled down; never interactive. */}
      <span aria-hidden className="pointer-events-none absolute top-0 left-0 block origin-top-left" style={{ width: frame.width, height: frame.height, transform: `scale(${scale})` }}>
        {frame.layers.map((item) => <StaticLayer key={item.id} layer={item} />)}
      </span>
      {/* The element it's about, marked — when it's about one. */}
      {layer && (
        <span
          aria-hidden
          data-design-link-mark
          className={cn('absolute rounded-[2px] border-2', resolved ? 'border-emerald-400 bg-emerald-400/20' : 'border-amber-400 bg-amber-400/25')}
          style={{ left: layer.x * scale - 1, top: layer.y * scale - 1, width: Math.max(layer.width * scale + 2, 5), height: Math.max(layer.height * scale + 2, 5) }}
        />
      )}
    </button>
  )
}
