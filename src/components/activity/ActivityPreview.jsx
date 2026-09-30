import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Maximize2 } from 'lucide-react'
import { canvasPages, forProject, projects } from '@/data/mockData'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

// Render the same seeded layers and detailed content as the workspace canvas.
// This is the current mock design, not a historical snapshot of the event.
function Frame({ frame, scale }) {
  return (
    <div className="relative shrink-0 overflow-hidden rounded-lg bg-white text-slate-900 shadow-sm" style={{ width: frame.width * scale, height: frame.height * scale }}>
      <div aria-hidden="true" className="pointer-events-none absolute origin-top-left" style={{ width: frame.width, height: frame.height, transform: `scale(${scale})` }} inert>
        {frame.layers.map((layer) => <StaticLayer key={layer.id} layer={layer} />)}
      </div>
    </div>
  )
}

export default function ActivityPreview({ activity }) {
  const [open, setOpen] = useState(false)
  const project = projects.find((entry) => entry.id === activity.projectId)
  const pages = forProject(canvasPages, activity.projectId)
  const frames = pages.flatMap((page) => page.frames)
  const frame = frames[0]
  if (!frame) return null
  const scale = Math.min(104 / frame.width, 68 / frame.height)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Open design preview" className="group/preview relative flex h-20 w-28 items-center justify-center overflow-hidden rounded-lg border border-border/70 bg-muted/30 transition-colors hover:border-foreground/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground">
        <Frame frame={frame} scale={scale} />
        <Maximize2 className="absolute right-1.5 bottom-1.5 size-3 text-muted-foreground opacity-0 group-hover/preview:opacity-100 group-focus-visible/preview:opacity-100" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogTitle>{project?.name ?? 'Design preview'}</DialogTitle>
          <DialogDescription>Current mock design · Not an activity snapshot</DialogDescription>
          <div className="flex flex-wrap items-start justify-center gap-6 rounded-xl border border-border bg-muted/30 p-4 sm:p-6">
            {frames.map((item) => (
              <figure key={item.id} className="flex max-w-full flex-col items-center gap-3">
                <Frame frame={item} scale={Math.min(1, 240 / item.width, 520 / item.height)} />
                <figcaption className="text-xs text-muted-foreground">{item.name}</figcaption>
              </figure>
            ))}
          </div>
          {project && <Link to={`/projects/${project.id}/workspace`} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Open Workspace<ArrowUpRight className="size-4" /></Link>}
        </DialogContent>
      </Dialog>
    </>
  )
}
