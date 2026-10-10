import { cn } from 'cn'
import { LocalizedText } from '@/i18n/runtime'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import { designLinkOf } from '@/lib/conflictInsight'
import { useWorkspaceOptional } from '@/state/WorkspaceProvider'

// Which design screen a Conflict Point is about: a thumbnail of its frame
// with the element marked, and its place on the canvas (page 2/4 · frame 1).
// Pressing either goes there — the canvas page, the element selected and
// pulsing (WorkspaceProvider's revealConflictOnCanvas). Draws nothing for a
// conflict that isn't about a screen, or outside a workspace.
const SIZES = { sm: { w: 44, h: 52 }, md: { w: 132, h: 120 } }

export function useDesignLink(conflict) {
  const workspace = useWorkspaceOptional()
  const link = workspace ? designLinkOf(conflict, workspace.projectPages) : null
  return { workspace, link }
}

// "p2 · f1" in a list row; "Page 2/4 · Frame 1" and the element's name in the review.
export function DesignLinkChip({ conflict, compact = false, className }) {
  const { workspace, link } = useDesignLink(conflict)
  if (!link) return null
  const multiPage = link.pageCount > 1
  const label = `Page ${link.pageNumber}/${link.pageCount} · Frame ${link.frameNumber}`
  return (
    <button
      type="button"
      data-design-link-chip
      aria-label={`${label} · ${link.layer.name}`}
      title={`${label} · ${link.layer.name}`}
      onClick={(event) => { event.stopPropagation(); workspace.revealConflictOnCanvas(conflict) }}
      className={cn('ds-intrinsic inline-flex w-fit max-w-full cursor-pointer items-center gap-1 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] leading-4 font-medium text-slate-200 tabular-nums transition-colors hover:bg-white/[0.1] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary', className)}
    >
      {compact ? (
        <span>{multiPage ? `p${link.pageNumber} · ` : ''}f{link.frameNumber}</span>
      ) : (
        <>
          <span>{multiPage && <><LocalizedText text="Page" /> {link.pageNumber}/{link.pageCount} · </>}<LocalizedText text="Frame" /> {link.frameNumber}</span>
          <span className="truncate text-slate-400">· {link.layer.name}</span>
        </>
      )}
    </button>
  )
}

export default function DesignLinkThumb({ conflict, size = 'sm', className, placeholder = false }) {
  const { workspace, link } = useDesignLink(conflict)
  // The element is gone from the canvas: say so where the screen is the point.
  if (!link) return placeholder && conflict?.layerId ? <span data-design-link-missing className={cn('text-[11px] text-slate-500', className)}><LocalizedText text="Screen not available" /></span> : null
  const { frame, layer } = link
  const box = SIZES[size]
  const scale = Math.min(box.w / frame.width, box.h / frame.height)
  const width = frame.width * scale
  const height = frame.height * scale
  const resolved = conflict.resolved || conflict.reviewStage === 'resolved'
  const label = `Page ${link.pageNumber}/${link.pageCount} · Frame ${link.frameNumber} · ${layer.name}`
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
      <span
        aria-hidden
        data-design-link-mark
        className={cn('absolute rounded-[2px] border-2', resolved ? 'border-emerald-400 bg-emerald-400/20' : 'border-amber-400 bg-amber-400/25')}
        style={{ left: layer.x * scale - 1, top: layer.y * scale - 1, width: Math.max(layer.width * scale + 2, 5), height: Math.max(layer.height * scale + 2, 5) }}
      />
    </button>
  )
}
