import { useState } from 'react'
import { Download, Plus } from 'lucide-react'
import { cn } from 'cn'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import CreateTeamModal from '@/components/modals/CreateTeamModal'
import { allPeople, currentUser, projects } from '@/data/mockData'

function projectTagsFor(personId) {
  return projects.filter((project) => project.memberIds.includes(personId)).map((project) => project.name)
}

function TeamPage() {
  const [selected, setSelected] = useState(() => new Set())
  const [createOpen, setCreateOpen] = useState(false)

  function toggleAll() {
    setSelected((prev) => (prev.size === allPeople.length ? new Set() : new Set(allPeople.map((p) => p.id))))
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Team members</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">People with access to your projects.</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
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
            checked={selected.size === allPeople.length}
            onChange={toggleAll}
            className="size-3.5 shrink-0 accent-primary"
          />
          <span className="w-48 shrink-0">
            {selected.size > 0 ? `${selected.size} selected` : 'Member'}
          </span>
          <span className="w-20 shrink-0">Status</span>
          <span className="flex-1">Email</span>
          <span className="w-20 shrink-0">Role</span>
          <span className="w-56 shrink-0">Teams</span>
        </div>

        <div className="flex flex-col divide-y divide-border/60">
          {allPeople.map((person) => {
            const isOnline = person.id === currentUser.id ? true : Boolean(person.online)
            const tags = projectTagsFor(person.id)
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

                <div className="flex w-20 shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className={cn('size-1.5 shrink-0 rounded-full', isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/40')}
                  />
                  {isOnline ? 'Active' : 'Offline'}
                </div>

                <span className="flex-1 truncate text-xs text-muted-foreground">{person.email}</span>

                <span className="w-20 shrink-0 text-xs text-foreground/80">{person.role}</span>

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
              </div>
            )
          })}
        </div>
      </div>

      <CreateTeamModal open={createOpen} onOpenChange={setCreateOpen} />
    </DashboardLayout>
  )
}

export default TeamPage
