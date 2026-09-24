import { useState } from 'react'
import { FolderKanban, Globe, Lock } from 'lucide-react'
import { cn } from 'cn'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

// Same accent palette ProjectCard cycles through by index — picking one
// here just pins a project to a specific tone instead of leaving it to
// whatever position it lands in in the grid.
const ACCENT_TONES = [
  { id: 'indigo', className: 'bg-indigo-500' },
  { id: 'rose', className: 'bg-rose-500' },
  { id: 'emerald', className: 'bg-emerald-500' },
  { id: 'sky', className: 'bg-sky-500' },
  { id: 'amber', className: 'bg-amber-500' },
]

const initialState = {
  name: '',
  description: '',
  tone: ACCENT_TONES[0].className,
  isPrivate: false,
}

function CreateProjectModal({ open, onOpenChange, onCreate }) {
  const [form, setForm] = useState(initialState)
  const [touched, setTouched] = useState(false)

  const nameError = touched && !form.name.trim()

  function reset() {
    setForm(initialState)
    setTouched(false)
  }

  function handleOpenChange(next) {
    onOpenChange(next)
    if (!next) reset()
  }

  function handleSubmit(event) {
    event.preventDefault()
    setTouched(true)
    if (!form.name.trim()) return

    onCreate({
      name: form.name.trim(),
      description: form.description.trim(),
      accentTone: form.tone,
      isPrivate: form.isPrivate,
    })
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create new project</DialogTitle>
            <DialogDescription>
              Set up a new workspace for your team to track design-code sync.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="project-name" className="text-xs font-medium text-foreground">
                Project name
              </label>
              <Input
                id="project-name"
                autoFocus
                value={form.name}
                onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
                onBlur={() => setTouched(true)}
                placeholder="Enter project name..."
                aria-invalid={nameError || undefined}
                className="rounded-lg"
              />
              {nameError && <p className="text-[11px] text-destructive">Project name is required.</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="project-description" className="text-xs font-medium text-foreground">
                Description <span className="text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id="project-description"
                value={form.description}
                onChange={(event) => setForm((f) => ({ ...f, description: event.target.value }))}
                placeholder="What is this project about?"
                rows={3}
                className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground">Accent color</span>
              <div className="flex items-center gap-2">
                {ACCENT_TONES.map((tone) => (
                  <button
                    key={tone.id}
                    type="button"
                    aria-label={tone.id}
                    aria-pressed={form.tone === tone.className}
                    onClick={() => setForm((f) => ({ ...f, tone: tone.className }))}
                    className={cn(
                      'flex size-8 items-center justify-center rounded-lg ring-2 ring-offset-2 ring-offset-popover transition-shadow',
                      tone.className,
                      form.tone === tone.className ? 'ring-foreground/60' : 'ring-transparent'
                    )}
                  >
                    <FolderKanban className="size-4 text-white" />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                {form.isPrivate ? (
                  <Lock className="size-4 text-muted-foreground" />
                ) : (
                  <Globe className="size-4 text-muted-foreground" />
                )}
                <div>
                  <p className="text-xs font-medium text-foreground">
                    {form.isPrivate ? 'Private' : 'Team'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {form.isPrivate ? 'Only you can see this project' : 'Visible to your whole team'}
                  </p>
                </div>
              </div>
              <Switch
                checked={form.isPrivate}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, isPrivate: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Project</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default CreateProjectModal
