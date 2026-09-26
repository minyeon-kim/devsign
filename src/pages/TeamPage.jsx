import { useMemo, useState } from 'react'
import { Archive, Download, Lock, MoreVertical, Pencil, Plus, Search, Trash2, UserRound } from 'lucide-react'
import { cn } from 'cn'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import CreateTeamModal from '@/components/modals/CreateTeamModal'
import { allPeople, currentUser, teams } from '@/data/mockData'

function teamTagsFor(personId) {
  return teams.filter((team) => team.memberIds.includes(personId)).map((team) => team.name)
}

function TeamPage() {
  const [selected, setSelected] = useState(() => new Set())
  const [createOpen, setCreateOpen] = useState(false)
  const [query, setQuery] = useState('')

  const people = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allPeople
    return allPeople.filter(
      (person) =>
        person.name.toLowerCase().includes(q) ||
        person.id.toLowerCase().includes(q) ||
        person.email.toLowerCase().includes(q)
    )
  }, [query])

  const allVisibleSelected = people.length > 0 && people.every((p) => selected.has(p.id))

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        people.forEach((p) => next.delete(p.id))
      } else {
        people.forEach((p) => next.add(p.id))
      }
      return next
    })
  }

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <DashboardLayout>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Team members</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">People with access to your projects.</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="h-8 w-48 pl-8 text-sm"
            />
          </div>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="size-3.5" />
            Download CSV
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            New team
          </Button>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-2.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleAll}
            className="size-3.5 shrink-0 accent-primary"
          />
          <span className="w-48 shrink-0">
            {selected.size > 0 ? `${selected.size} selected` : 'Member'}
          </span>
          <span className="w-24 shrink-0">Status</span>
          <span className="flex-1">Email address</span>
          <span className="w-56 shrink-0">Teams</span>
          <span className="w-16 shrink-0" />
        </div>

        <div className="flex flex-col divide-y divide-border/60">
          {people.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">No members match your search.</p>
          ) : (
            people.map((person) => {
              const isOnline = person.id === currentUser.id ? true : Boolean(person.online)
              const tags = teamTagsFor(person.id)
              return (
                <div key={person.id} className="flex items-center gap-3 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(person.id)}
                    onChange={() => toggleOne(person.id)}
                    className="size-3.5 shrink-0 accent-primary"
                  />

                  <div className="flex w-48 shrink-0 items-center gap-2.5">
                    <Avatar size="sm">
                      <AvatarFallback className={cn('text-[10px] font-medium text-white', person.colorClass)}>
                        {person.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{person.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">@{person.id}</p>
                    </div>
                  </div>

                  <div className="w-24 shrink-0">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
                        isOnline ? 'border-emerald-500/30 text-foreground' : 'border-border text-muted-foreground'
                      )}
                    >
                      <span
                        className={cn(
                          'size-1.5 shrink-0 rounded-full',
                          isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                        )}
                      />
                      {isOnline ? 'Active' : 'Offline'}
                    </span>
                  </div>

                  <span className="flex-1 truncate text-xs text-muted-foreground">{person.email}</span>

                  <div className="flex w-56 shrink-0 flex-wrap gap-1.5">
                    {tags.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="rounded-full font-normal">
                          {tag}
                        </Badge>
                      ))
                    )}
                  </div>

                  <div className="flex w-16 shrink-0 items-center justify-end gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label="Edit member">
                      <Pencil className="size-3.5" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon-sm" aria-label="More actions">
                            <MoreVertical className="size-3.5" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <UserRound />
                          View profile
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive">
                          <Trash2 />
                          Delete
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Archive />
                          Archive
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Lock />
                          Permissions
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <CreateTeamModal open={createOpen} onOpenChange={setCreateOpen} />
    </DashboardLayout>
  )
}

export default TeamPage
