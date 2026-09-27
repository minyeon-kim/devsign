import { ChevronRight, Circle, Component, Frame, Group, Ruler, Type } from 'lucide-react'
import { cn } from 'cn'
import { findCanvasTarget } from '@/data/mockData'

const kindIcons = {
  frame: Frame,
  component: Component,
  group: Group,
  vector: Circle,
  text: Type,
}

function PreviewSwatch({ node }) {
  let content = null
  if (node.type === 'bar') {
    content = <div className="h-full w-full rounded-sm bg-muted" />
  } else if (node.type === 'card') {
    content = <div className="h-full w-full rounded-lg border border-border bg-muted/40" />
  } else if (node.type === 'avatar') {
    content = <div className="size-10 rounded-full bg-muted-foreground/30" />
  } else if (node.type === 'button') {
    content = (
      <div className="flex h-9 items-center justify-center rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground">
        {node.label ?? 'Button'}
      </div>
    )
  } else if (node.kind === 'frame') {
    content = <div className="h-full w-full rounded-md border border-border bg-card" />
  } else {
    content = <div className="h-2.5 w-24 rounded-sm bg-muted-foreground/25" />
  }

  return (
    <div
      className="flex h-32 w-full items-center justify-center rounded-xl border bg-background/60"
      style={{
        backgroundImage:
          'radial-gradient(color-mix(in oklch, var(--foreground) 10%, transparent) 1px, transparent 1px)',
        backgroundSize: '14px 14px',
      }}
    >
      {content}
    </div>
  )
}

function PropertyRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}

// Opened by clicking a frame or layer on the Canvas — a dedicated dockview
// tab docked next to the code editor's file tabs, mirroring "open a file"
// but for a design node instead. Only ever receives `params.targetId`; the
// rest is re-derived live from mockData so it can never show stale data if
// the underlying design changes.
function LayerInspectPanel({ params }) {
  const target = findCanvasTarget(params?.targetId)

  if (!target) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-xs text-muted-foreground">
        This layer no longer exists.
      </div>
    )
  }

  const { page, frame, layer } = target
  const node = layer ?? frame
  const Icon = kindIcons[node.kind] ?? Group

  return (
    <div className="flex h-full flex-col overflow-auto bg-background p-4">
      <div className="mb-3 flex items-center gap-1 text-[11px] text-muted-foreground">
        <span>{page.name}</span>
        <ChevronRight className="size-3" />
        <span className={cn(!layer && 'font-medium text-foreground')}>{frame.name}</span>
        {layer && (
          <>
            <ChevronRight className="size-3" />
            <span className="font-medium text-foreground">{layer.name}</span>
          </>
        )}
      </div>

      <div className="mb-4 flex items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{node.name}</p>
          <p className="text-[11px] text-muted-foreground capitalize">{node.kind}</p>
        </div>
      </div>

      <PreviewSwatch node={node} />

      <div className="mt-4 space-y-3">
        <div className="rounded-xl border bg-card p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            <Ruler className="size-3.5" />
            Position &amp; size
          </div>
          <div className="divide-y divide-border/60">
            <PropertyRow label="X" value={`${node.x}px`} />
            <PropertyRow label="Y" value={`${node.y}px`} />
            <PropertyRow label="Width" value={`${node.width}px`} />
            <PropertyRow label="Height" value={`${node.height}px`} />
            {node.label && <PropertyRow label="Label" value={node.label} />}
          </div>
        </div>
      </div>
    </div>
  )
}

export default LayerInspectPanel
