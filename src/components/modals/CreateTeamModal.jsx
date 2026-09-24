import { useState } from 'react'
import { toast } from 'sonner'
import { ChevronDown, Search } from 'lucide-react'
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { allPeople, currentUser } from '@/data/mockData'

const APPEARANCE_COLORS = [
  'bg-zinc-900',
  'bg-violet-500',
  'bg-indigo-600',
  'bg-blue-600',
  'bg-sky-500',
  'bg-teal-600',
  'bg-emerald-600',
]

const ROLE_OPTIONS = ['Owner', 'Editor', 'Viewer']

const initialRoles = Object.fromEntries(
  allPeople.map((person) => [person.id, person.id === currentUser.id ? 'Owner' : 'Editor'])
)

function CreateTeamModal({ open, onOpenChange }) {
  const [name, setName] = useState('')
  const [touched, setTouched] = useState(false)
  const [color, setColor] = useState(APPEARANCE_COLORS[1])
  const [roles, setRoles] = useState(initialRoles)

  const nameError = touched && !name.trim()

  function reset() {
    setName('')
    setTouched(false)
    setColor(APPEARANCE_COLORS[1])
    setRoles(initialRoles)
  }

  function handleOpenChange(next) {
    onOpenChange(next)
    if (!next) reset()
  }

  function handleSubmit(event) {
    event.preventDefault()
    setTouched(true)
    if (!name.trim()) return

    toast('Team created', { description: name.trim() })
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create a new team</DialogTitle>
            <DialogDescription>Group people together to share projects and access.</DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="team-name" className="text-xs font-medium text-foreground">
                Team name
              </label>
              <Input
                id="team-name"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                onBlur={() => setTouched(true)}
                placeholder="e.g. Design Team"
                aria-invalid={nameError || undefined}
                className="rounded-lg"
              />
              {nameError && <p className="text-[11px] text-destructive">Team name is required.</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground">Appearance</span>
              <div className="flex flex-wrap items-center gap-2">
                {APPEARANCE_COLORS.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    aria-label={swatch}
                    aria-pressed={color === swatch}
                    onClick={() => setColor(swatch)}
                    className={cn(
                      'size-7 shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-popover transition-shadow',
                      swatch,
                      color === swatch ? 'ring-foreground/60' : 'ring-transparent'
                    )}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground">Members</span>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Add members by name or email" className="h-9 rounded-lg pl-8 text-sm" />
              </div>

              <div className="mt-1 flex flex-col divide-y divide-border/60 rounded-lg border border-border">
                {allPeople.map((person) => (
                  <div key={person.id} className="flex items-center gap-2.5 px-3 py-2.5">
                    <Avatar size="sm">
                      <AvatarFallback className={cn('text-[10px] font-medium text-white', person.colorClass)}>
                        {person.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-xs font-medium text-foreground">
                        {person.name}
                        {person.id === currentUser.id && (
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                            You
                          </span>
                        )}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">{person.email}</p>
                    </div>

                    {person.id === currentUser.id ? (
                      <span className="shrink-0 text-xs text-muted-foreground">Owner</span>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
                          {roles[person.id]}
                          <ChevronDown className="size-3" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {ROLE_OPTIONS.map((option) => (
                            <DropdownMenuItem
                              key={option}
                              onClick={() => setRoles((prev) => ({ ...prev, [person.id]: option }))}
                            >
                              {option}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="items-center sm:justify-between">
            <button
              type="button"
              onClick={reset}
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Reset to default
            </button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Create team</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default CreateTeamModal
