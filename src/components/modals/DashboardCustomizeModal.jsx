import { useState } from 'react'
import { Eye, EyeOff, GripVertical, RotateCcw } from 'lucide-react'
import { cn } from 'cn'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { projects } from '@/data/mockData'

const SIZE_OPTIONS = ['small', 'medium', 'large']
const SIZE_LABEL = { small: 'S', medium: 'M', large: 'L' }
const CONFLICT_LIMIT_OPTIONS = [3, 5, 7, 'All']
const MEMBER_LIMIT_OPTIONS = [1, 2, 'All']
const ACTIVITY_PERIOD_OPTIONS = [
  { key: 'thisWeek', label: 'This week' },
  { key: 'lastWeek', label: 'Last week' },
  { key: 'thisMonth', label: 'This month' },
]

function PillGroup({ options, value, onChange, getLabel = (o) => o, getKey = (o) => o }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const key = getKey(option)
        const active = key === value
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(key)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              active
                ? 'border-transparent bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {getLabel(option)}
          </button>
        )
      })}
    </div>
  )
}

// A right-anchored panel (an off-center Dialog, not a new primitive) so
// the dashboard stays visible and updates live behind it as settings
// change — every control here writes straight into `config` via
// `onConfigChange`, no staged save/cancel.
function DashboardCustomizeModal({ open, onOpenChange, config, onConfigChange, onReset, widgetMeta }) {
  const [draggedId, setDraggedId] = useState(null)

  function updateConfig(patch) {
    onConfigChange((prev) => ({ ...prev, ...patch }))
  }

  function toggleVisible(id) {
    updateConfig({ visibility: { ...config.visibility, [id]: !config.visibility[id] } })
  }

  function setSize(id, size) {
    updateConfig({ sizes: { ...config.sizes, [id]: size } })
  }

  function toggleProject(id) {
    const next = config.selectedProjectIds.includes(id)
      ? config.selectedProjectIds.filter((p) => p !== id)
      : [...config.selectedProjectIds, id]
    updateConfig({ selectedProjectIds: next })
  }

  function reorder(overId) {
    if (!draggedId || draggedId === overId) return
    const next = [...config.order]
    const from = next.indexOf(draggedId)
    const to = next.indexOf(overId)
    next.splice(from, 1)
    next.splice(to, 0, draggedId)
    updateConfig({ order: next })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="top-0 right-0 bottom-0 left-auto h-full max-h-full w-full translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-l-2xl rounded-r-none p-0 sm:max-w-sm"
      >
        <DialogHeader className="border-b border-border p-4">
          <DialogTitle>Customize dashboard</DialogTitle>
          <DialogDescription>Changes apply immediately.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4">
          <section>
            <h3 className="text-xs font-semibold text-foreground">Widgets</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Drag to reorder, toggle to show or hide.</p>
            <div className="mt-2 flex flex-col gap-1.5">
              {config.order.map((id) => {
                const visible = config.visibility[id]
                return (
                  <div
                    key={id}
                    draggable
                    onDragStart={() => setDraggedId(id)}
                    onDragOver={(e) => {
                      e.preventDefault()
                      reorder(id)
                    }}
                    onDragEnd={() => setDraggedId(null)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 transition-opacity',
                      draggedId === id && 'opacity-50'
                    )}
                  >
                    <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground/60 active:cursor-grabbing" />
                    <span className={cn('min-w-0 flex-1 truncate text-xs font-medium', visible ? 'text-foreground' : 'text-muted-foreground/50')}>
                      {widgetMeta[id].title}
                    </span>
                    <PillGroup
                      options={SIZE_OPTIONS}
                      value={config.sizes[id]}
                      onChange={(size) => setSize(id, size)}
                      getLabel={(o) => SIZE_LABEL[o]}
                    />
                    <button
                      type="button"
                      onClick={() => toggleVisible(id)}
                      aria-pressed={visible}
                      title={visible ? 'Hide widget' : 'Show widget'}
                      className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="mt-5">
            <h3 className="text-xs font-semibold text-foreground">Projects shown</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Pick which projects appear as project cards.</p>
            <div className="mt-2 flex flex-col gap-1 rounded-lg border border-border">
              {projects.map((project) => (
                <label
                  key={project.id}
                  className="flex cursor-pointer items-center gap-2.5 border-b border-border/60 px-2.5 py-2 text-xs last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={config.selectedProjectIds.includes(project.id)}
                    onChange={() => toggleProject(project.id)}
                    className="size-3.5 shrink-0 accent-primary"
                  />
                  <span className="truncate text-foreground/90">{project.name}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="mt-5">
            <h3 className="text-xs font-semibold text-foreground">Active conflicts count</h3>
            <div className="mt-2">
              <PillGroup
                options={CONFLICT_LIMIT_OPTIONS}
                value={config.conflictLimit}
                onChange={(v) => updateConfig({ conflictLimit: v })}
              />
            </div>
          </section>

          <section className="mt-5">
            <h3 className="text-xs font-semibold text-foreground">Members count</h3>
            <div className="mt-2">
              <PillGroup
                options={MEMBER_LIMIT_OPTIONS}
                value={config.memberLimit}
                onChange={(v) => updateConfig({ memberLimit: v })}
              />
            </div>
          </section>

          <section className="mt-5">
            <h3 className="text-xs font-semibold text-foreground">Conflict activity period</h3>
            <div className="mt-2">
              <PillGroup
                options={ACTIVITY_PERIOD_OPTIONS}
                value={config.activityPeriod}
                onChange={(v) => updateConfig({ activityPeriod: v })}
                getKey={(o) => o.key}
                getLabel={(o) => o.label}
              />
            </div>
          </section>
        </div>

        <div className="flex items-center justify-between border-t border-border p-4">
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
            Reset to default
          </button>
          <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default DashboardCustomizeModal
