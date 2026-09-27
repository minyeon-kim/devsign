import { useState } from 'react'
import { Loader2 } from 'lucide-react'
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
import { currentUser } from '@/data/mockData'

const PROJECT_TYPES = ['Design', 'Development', 'Design + Development']

function slugFor(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const emptyForm = { name: '', description: '', type: PROJECT_TYPES[0] }

// `existingNames` drives the duplicate-name guard — case/whitespace
// insensitive, checked against whatever ProjectsSection currently holds
// (seed projects plus any already created this session).
function CreateProjectModal({ open, onOpenChange, onCreate, existingNames }) {
  const [form, setForm] = useState(emptyForm)
  const [touched, setTouched] = useState(false)
  const [duplicate, setDuplicate] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const trimmedName = form.name.trim()
  const nameError = touched && !trimmedName

  function reset() {
    setForm(emptyForm)
    setTouched(false)
    setDuplicate(false)
    setSubmitting(false)
  }

  function handleOpenChange(next) {
    if (submitting) return
    onOpenChange(next)
    if (!next) reset()
  }

  function handleSubmit(event) {
    event.preventDefault()
    setTouched(true)
    if (!trimmedName) return

    const isDuplicate = existingNames.some((name) => name.toLowerCase() === trimmedName.toLowerCase())
    if (isDuplicate) {
      setDuplicate(true)
      return
    }
    setDuplicate(false)
    setSubmitting(true)

    // No backend to actually hit — the brief short delay is here purely so
    // the Create button's loading state (spinner + disabled) is visible
    // instead of the modal closing instantly.
    setTimeout(() => {
      onCreate({
        id: `${slugFor(trimmedName)}-${Math.random().toString(36).slice(2, 6)}`,
        name: trimmedName,
        description: form.description.trim(),
        type: form.type,
        ownerId: currentUser.id,
        memberIds: [currentUser.id],
        updatedAtLabel: 'just now',
        conflicts: 0,
        pendingMerges: 0,
        filesCount: 0,
        thumbnailType: null,
        activityCount: 0,
        syncProgress: 0,
      })
      reset()
      onOpenChange(false)
    }, 450)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create new project</DialogTitle>
            <DialogDescription>Set up a new workspace for your team.</DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="project-name" className="text-xs font-medium text-foreground">
                Project name
              </label>
              <Input
                id="project-name"
                autoFocus
                disabled={submitting}
                value={form.name}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                  setDuplicate(false)
                }}
                onBlur={() => setTouched(true)}
                placeholder="e.g. Checkout Redesign"
                aria-invalid={(nameError || duplicate) || undefined}
                className="rounded-lg"
              />
              {nameError && <p className="text-[11px] text-destructive">Project name is required.</p>}
              {duplicate && <p className="text-[11px] text-destructive">A project with this name already exists.</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="project-description" className="text-xs font-medium text-foreground">
                Description <span className="text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id="project-description"
                disabled={submitting}
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="What's this project for?"
                rows={3}
                className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground">Project type</span>
              <div className="flex flex-wrap gap-1.5">
                {PROJECT_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    disabled={submitting}
                    aria-pressed={form.type === type}
                    onClick={() => setForm((prev) => ({ ...prev, type }))}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                      form.type === type
                        ? 'border-transparent bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={submitting} onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!trimmedName || submitting} className="gap-1.5">
              {submitting && <Loader2 className="size-3.5 animate-spin" />}
              {submitting ? 'Creating…' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default CreateProjectModal
