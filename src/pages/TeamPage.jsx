import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Archive, ArrowDown, ArrowUp, ArrowUpDown, Download, Lock, MoreVertical, Pencil, Plus, Search, Trash2, UserRound } from 'lucide-react'
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
import AddUserModal from '@/components/modals/AddUserModal'
import { allPeople, currentUser, teams } from '@/data/mockData'

function teamNamesFor(personId) {
  return teams.filter((team) => team.memberIds.includes(personId)).map((team) => team.name)
}

function toMember(person) {
  return {
    id: person.id,
    handle: person.id,
    name: person.name,
    email: person.email,
    initials: person.initials,
    colorClass: person.colorClass,
    status: person.id === currentUser.id || person.online ? 'Active' : 'Offline',
    teams: teamNamesFor(person.id),
  }
}

function csvField(value) {
  const str = String(value ?? '')
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

const STATUS_SORT_CYCLE = { none: 'active', active: 'offline', offline: 'none' }

function TeamPage() {
  const [members, setMembers] = useState(() => allPeople.map(toMember))
  const [selected, setSelected] = useState(() => new Set())
  const [query, setQuery] = useState('')
  const [statusSort, setStatusSort] = useState('none')
  const [createTeamOpen, setCreateTeamOpen] = useState(false)
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [editingMember, setEditingMember] = useState(null)
  const [userModalKey, setUserModalKey] = useState(0)

  const visibleMembers = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = !q
      ? members
      : members.filter(
          (m) =>
            m.name.toLowerCase().includes(q) || m.handle.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
        )

    if (statusSort !== 'none') {
      const rank = (m) => (m.status === 'Active' ? 0 : 1)
      list = [...list].sort((a, b) => {
        const diff = rank(a) - rank(b)
        return statusSort === 'active' ? diff : -diff
      })
    }
    return list
  }, [members, query, statusSort])

  const allVisibleSelected = visibleMembers.length > 0 && visibleMembers.every((m) => selected.has(m.id))

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        visibleMembers.forEach((m) => next.delete(m.id))
      } else {
        visibleMembers.forEach((m) => next.add(m.id))
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

  function handleExportCsv() {
    const header = ['Name', 'Handle', 'Status', 'Email address', 'Teams']
    const rows = visibleMembers.map((m) => [m.name, `@${m.handle}`, m.status, m.email, m.teams.join('; ')])
    const csv = [header, ...rows].map((row) => row.map(csvField).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'team-members.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    toast('Exported CSV', { description: `${visibleMembers.length} member${visibleMembers.length === 1 ? '' : 's'}` })
  }

  function handleDelete(member) {
    setMembers((prev) => prev.filter((m) => m.id !== member.id))
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(member.id)
      return next
    })
    toast('Member deleted', { description: member.name })
  }

  function openAddModal() {
    setEditingMember(null)
    setUserModalKey((n) => n + 1)
    setUserModalOpen(true)
  }

  function openEditModal(member) {
    setEditingMember(member)
    setUserModalKey((n) => n + 1)
    setUserModalOpen(true)
  }

  function handleUserModalOpenChange(next) {
    setUserModalOpen(next)
    if (!next) setEditingMember(null)
  }

  function handleSubmitMember(payload) {
    setMembers((prev) => (prev.some((m) => m.id === payload.id) ? prev.map((m) => (m.id === payload.id ? payload : m)) : [...prev, payload]))
    toast(editingMember ? 'Member updated' : 'Member added', { description: payload.name })
    handleUserModalOpenChange(false)
  }

  const StatusSortIcon = statusSort === 'active' ? ArrowUp : statusSort === 'offline' ? ArrowDown : ArrowUpDown

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
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportCsv}>
            <Download className="size-3.5" />
            Download CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCreateTeamOpen(true)}>
            <Plus className="size-3.5" />
            New team
          </Button>
          <Button size="sm" className="gap-1.5" onClick={openAddModal}>
            <Plus className="size-3.5" />
            Add user
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
          <button
            type="button"
            onClick={() => setStatusSort((prev) => STATUS_SORT_CYCLE[prev])}
            className="flex w-24 shrink-0 items-center gap-1 transition-colors hover:text-foreground"
          >
            Status
            <StatusSortIcon className="size-3" />
          </button>
          <span className="flex-1">Email address</span>
          <span className="w-56 shrink-0">Teams</span>
          <span className="w-16 shrink-0" />
        </div>

        <div className="flex flex-col divide-y divide-border/60">
          {visibleMembers.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">No members match your search.</p>
          ) : (
            visibleMembers.map((member) => {
              const isActive = member.status === 'Active'
              return (
                <div key={member.id} className="flex items-center gap-3 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(member.id)}
                    onChange={() => toggleOne(member.id)}
                    className="size-3.5 shrink-0 accent-primary"
                  />

                  <div className="flex w-48 shrink-0 items-center gap-2.5">
                    <Avatar size="sm">
                      <AvatarFallback className={cn('text-[10px] font-medium text-white', member.colorClass)}>
                        {member.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{member.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">@{member.handle}</p>
                    </div>
                  </div>

                  <div className="w-24 shrink-0">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
                        isActive ? 'border-emerald-500/30 text-foreground' : 'border-border text-muted-foreground'
                      )}
                    >
                      <span className={cn('size-1.5 shrink-0 rounded-full', isActive ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
                      {member.status}
                    </span>
                  </div>

                  <span className="flex-1 truncate text-xs text-muted-foreground">{member.email}</span>

                  <div className="flex w-56 shrink-0 flex-wrap gap-1.5">
                    {member.teams.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      member.teams.map((tag) => (
                        <Badge key={tag} variant="secondary" className="rounded-full font-normal">
                          {tag}
                        </Badge>
                      ))
                    )}
                  </div>

                  <div className="flex w-16 shrink-0 items-center justify-end gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label="Edit member" onClick={() => openEditModal(member)}>
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
                        <DropdownMenuItem
                          onClick={() => toast('Viewing profile', { description: member.name })}
                        >
                          <UserRound />
                          View profile
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => handleDelete(member)}>
                          <Trash2 />
                          Delete
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast('Member archived', { description: member.name })}>
                          <Archive />
                          Archive
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => toast('Permissions', { description: `Manage access for ${member.name}` })}
                        >
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

      <CreateTeamModal open={createTeamOpen} onOpenChange={setCreateTeamOpen} />
      <AddUserModal
        key={userModalKey}
        open={userModalOpen}
        onOpenChange={handleUserModalOpenChange}
        onSubmit={handleSubmitMember}
        initialValues={editingMember}
      />
    </DashboardLayout>
  )
}

export default TeamPage
