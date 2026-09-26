import { useState } from 'react'
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
import { teams } from '@/data/mockData'

const AVATAR_COLORS = ['bg-indigo-500', 'bg-sky-500', 'bg-emerald-500', 'bg-orange-500', 'bg-pink-500', 'bg-violet-500']

function initialsFor(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '??'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function colorFor(name) {
  const sum = Array.from(name).reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

function slugFor(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const emptyForm = { name: '', email: '', status: 'Active', teamNames: [] }

// Shared by both "Add user" and the row-level pencil edit — `initialValues`
// (a member object) switches it into edit mode and pre-fills the form;
// null means a fresh add. Identity fields (handle/initials/colorClass) are
// only generated once, on first add, and preserved across edits. The parent
// remounts this (via a changing `key`) each time it's opened, so the form
// re-seeds from `initialValues` without needing an effect.
function AddUserModal({ open, onOpenChange, onSubmit, initialValues }) {
  const [form, setForm] = useState(() =>
    initialValues
      ? { name: initialValues.name, email: initialValues.email, status: initialValues.status, teamNames: initialValues.teams }
      : emptyForm
  )
  const [touched, setTouched] = useState(false)
  const isEditing = Boolean(initialValues)

  const nameError = touched && !form.name.trim()
  const emailError = touched && !form.email.trim().includes('@')

  function toggleTeam(name) {
    setForm((prev) => ({
      ...prev,
      teamNames: prev.teamNames.includes(name) ? prev.teamNames.filter((t) => t !== name) : [...prev.teamNames, name],
    }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    setTouched(true)
    const name = form.name.trim()
    const email = form.email.trim()
    if (!name || !email.includes('@')) return

    onSubmit({
      id: isEditing ? initialValues.id : `${slugFor(name)}-${Math.random().toString(36).slice(2, 6)}`,
      handle: isEditing ? initialValues.handle : slugFor(name),
      initials: isEditing ? initialValues.initials : initialsFor(name),
      colorClass: isEditing ? initialValues.colorClass : colorFor(name),
      name,
      email,
      status: form.status,
      teams: form.teamNames,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit member' : 'Add user'}</DialogTitle>
            <DialogDescription>
              {isEditing ? "Update this person's details and team assignments." : 'Invite a new person to your workspace.'}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="user-name" className="text-xs font-medium text-foreground">
                Name
              </label>
              <Input
                id="user-name"
                autoFocus
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                onBlur={() => setTouched(true)}
                placeholder="e.g. Alex Kim"
                aria-invalid={nameError || undefined}
                className="rounded-lg"
              />
              {nameError && <p className="text-[11px] text-destructive">Name is required.</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="user-email" className="text-xs font-medium text-foreground">
                Email
              </label>
              <Input
                id="user-email"
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                onBlur={() => setTouched(true)}
                placeholder="e.g. alex@devsign.app"
                aria-invalid={emailError || undefined}
                className="rounded-lg"
              />
              {emailError && <p className="text-[11px] text-destructive">A valid email is required.</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground">Status</span>
              <div className="flex items-center gap-1.5">
                {['Active', 'Offline'].map((status) => (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={form.status === status}
                    onClick={() => setForm((prev) => ({ ...prev, status }))}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      form.status === status
                        ? 'border-transparent bg-foreground text-background'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <span
                      className={cn('size-1.5 rounded-full', status === 'Active' ? 'bg-emerald-500' : 'bg-muted-foreground/40')}
                    />
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground">Teams</span>
              <div className="flex flex-wrap gap-1.5">
                {teams.map((team) => (
                  <button
                    key={team.id}
                    type="button"
                    aria-pressed={form.teamNames.includes(team.name)}
                    onClick={() => toggleTeam(team.name)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      form.teamNames.includes(team.name)
                        ? 'border-transparent bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {team.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{isEditing ? 'Save changes' : 'Add user'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default AddUserModal
