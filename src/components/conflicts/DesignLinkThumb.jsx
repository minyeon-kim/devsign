import { useState } from 'react'
import { cn } from 'cn'
import { LocalizedText } from '@/i18n/runtime'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import { designLinkOf } from '@/lib/conflictInsight'
import { useWorkspaceOptional } from '@/state/WorkspaceProvider'
import { ComponentSample, ElementPreviewDialog, ElementView, SAMPLES, hasSample } from '@/components/conflicts/ElementPreview'
import { codeOverridesOf, codeSidesOf, cropOf, markOf, targetOf } from '@/lib/elementPreview'
import CodeRender from '@/components/history/CodeRender'
import { ALL_DEVICES, BREAKPOINT_LABEL, breakpointOf, referencePick, screenOf } from '@/lib/devicePresets'

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
      const viewport = screenOf(referencePick(codeSides.category), codeSides.category)
      drawing = <CodeRender spec={codeSides.before} screen={viewport} scale={Math.min(box.w / viewport.width, box.h / viewport.height)} marked />
    } else if (mode === 'element') {
      const region = cropOf(target.frame, [target.mainId], 8)
      const scale = Math.min(3, box.w / region.width, box.h / region.height)
      drawing = <ElementView frame={target.frame} region={region} scale={scale} overrides={codeOverridesOf(conflict, target.frame)} markIds={[target.mainId]} mark={markOf(conflict, target.frame, 'before')} tone={resolved ? 'done' : 'open'} />
    } else if (mode === 'sample') {
      drawing = <ComponentSample conflict={conflict} side="before" marked zoom={conflict.sample === 'legend' ? 0.72 : SAMPLES.includes(conflict.sample) ? 0.6 : 0.33} />
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
    <>
    <button
      type="button"
      data-design-link-thumb
      aria-label={`${label} · 전체 화면으로 보기`}
      title={`${label} · 전체 화면으로 보기`}
      // (Where it is on the screen; pressed, the full-screen viewer opens on it.)
      onClick={(event) => { event.stopPropagation(); setPreviewOpen(true) }}
      className={cn('ds-intrinsic relative block shrink-0 cursor-zoom-in overflow-hidden rounded-md bg-white ring-1 ring-white/15 transition-shadow hover:ring-2 hover:ring-emerald-300/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary', className)}
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
          // (A 2px line around it, and everything else stepped back a little.)
          className={cn('absolute rounded-[2px] border-2 shadow-[0_0_0_9999px_rgba(15,23,42,0.28)]', resolved ? 'border-emerald-400' : 'border-amber-400')}
          style={{ left: layer.x * scale - 2, top: layer.y * scale - 2, width: Math.max(layer.width * scale + 4, 6), height: Math.max(layer.height * scale + 4, 6) }}
        />
      )}
    </button>
    {previewOpen && <ElementPreviewDialog conflict={conflict} link={link} open startFullscreen onOpenChange={setPreviewOpen} onReveal={() => workspace.revealConflictOnCanvas(conflict)} />}
    </>
  )
}

// ── A layout change's screen: at the width it's about ──────────────────
// The change's own breakpoint decides the viewport (768 → 768 × 1024, a 3:4
// tablet held upright) — never a fixed phone frame. Drawn as the screen
// stands after the fix: the cards in a grid that fits, no overlap, the
// purchase button under them. Without a breakpoint, or a device at that
// width, nothing is guessed: "미리보기 없음".
const BREAKPOINT_KO = { mobile: '모바일', tablet: '태블릿', desktop: '데스크톱' }
const THUMB_WIDTH = 132

export function BreakpointScreen({ conflict }) {
  const { link } = useDesignLink(conflict)
  const [previewOpen, setPreviewOpen] = useState(false)
  const width = Number(conflict.breakpoint)
  const device = Number.isFinite(width) ? ALL_DEVICES.find((entry) => entry.width === width) : null
  if (!device) {
    return <span data-breakpoint-missing className="text-[11px] text-slate-500"><LocalizedText text="미리보기 없음" /></span>
  }
  const columns = conflict.layouts?.original?.columns ?? 2
  const template = conflict.layouts?.original?.template ?? `repeat(${columns}, minmax(0, 1fr))`
  const scale = THUMB_WIDTH / device.width
  const label = `프레임 ${link?.frameNumber ?? 1} · ${device.width}px ${BREAKPOINT_KO[breakpointOf(device.width)] ?? BREAKPOINT_LABEL[breakpointOf(device.width)]}`
  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5">
      <span data-breakpoint-label className="inline-flex w-fit max-w-full items-center rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] leading-4 font-medium tabular-nums text-slate-200">{label}</span>
      <button
        type="button"
        data-breakpoint-thumb={`${device.width}x${device.height}`}
        aria-label={`${label} · 전체 화면으로 보기`}
        title="전체 화면으로 보기"
        onClick={() => setPreviewOpen(true)}
        className="ds-intrinsic relative block shrink-0 cursor-zoom-in overflow-hidden rounded-md bg-white ring-1 ring-white/15 transition-shadow hover:ring-2 hover:ring-emerald-300/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        // (Where it is, not what it looks like — the renders are the main
        // view's: the top of the screen, with the cards, is enough.)
        style={{ width: THUMB_WIDTH, height: Math.min(Math.round(device.height * scale), 96) }}
      >
        {/* The design's screen as it renders (CodeRender), its top. */}
        <span aria-hidden className="pointer-events-none absolute top-0 left-0 block">
          <CodeRender spec={{ component: 'dashboard-grid', tablet: template, base: template }} screen={device} scale={scale} crop={Math.ceil(96 / scale)} labels={false} className="!rounded-none !shadow-none !ring-0" />
        </span>
      </button>
      {previewOpen && <ElementPreviewDialog conflict={conflict} link={link} open startFullscreen onOpenChange={setPreviewOpen} />}
    </div>
  )
}
