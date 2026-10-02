import { Headset } from 'lucide-react'
import { cn } from 'cn'
import { useNavigate } from 'react-router-dom'
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
} from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { viewerPersonas } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'

function UserPresence() {
  const navigate = useNavigate()
  const {
    followingMe,
    followedMemberId,
    startFollowMe,
    cancelFollowMe,
    followMember,
    memberViewports,
    workspaceFiles: files,
    currentUser,
    otherMembers: teamMembers,
  } = useWorkspace()

  // Each teammate's current screen / file / element — from this project's
  // simulated collaboration timeline (mock data, not a live connection).
  function contextFor(member) {
    const viewport = memberViewports.find((m) => m.member.id === member.id)?.viewport
    return {
      status: viewport?.status ?? (member.online ? 'Online' : 'Offline'),
      label: viewport?.label,
      file: viewport && files.find((f) => f.id === viewport.fileId)?.name,
    }
  }

  function toggleFollowMe() {
    if (followingMe) {
      cancelFollowMe()
    } else {
      startFollowMe()
    }
  }

  return (
    <AvatarGroup className="ds-user-presence flex w-max flex-nowrap items-center -space-x-0.5 [&>*]:relative [&>*]:shrink-0 [&>*]:ring-2 [&>*]:ring-background [&>[data-following=true]]:ring-primary [&>[data-following=true]]:ring-offset-0">
      {/* Avatars open profile details; following is an explicit action inside. */}
      <Popover>
        <PopoverTrigger
          aria-label={`${currentUser.name} profile`}
          className="relative z-40 flex size-5 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-80"
        >
          <Avatar size="sm" className="size-5">
            <AvatarFallback className={cn('text-[9px] font-medium text-white', currentUser.colorClass)}>
              {currentUser.initials}
            </AvatarFallback>
          </Avatar>
        </PopoverTrigger>

        <PopoverContent align="end" sideOffset={10} className="w-64 gap-0 p-0">
          {/* You — same avatar size as everyone else below (Switch user,
              Team activity): only the ring on the Switch user row marks
              you out, not a bigger icon. */}
          <div className="flex items-center gap-2 p-3">
            <Avatar size="sm">
              <AvatarFallback
                className={cn('text-xs font-medium text-white', currentUser.colorClass)}
              >
                {currentUser.initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-sm">
              <span className="font-medium">{currentUser.name}</span>{' '}
              <span className="text-muted-foreground">({currentUser.role})</span>
            </div>
            <Button variant="ghost" size="icon-sm" title="Voice chat" aria-label="Voice chat">
              <Headset className="size-4" />
            </Button>
            <Button
              size="sm"
              variant={followingMe ? 'default' : 'outline'}
              onClick={toggleFollowMe}
            >
              {followingMe ? 'Following' : 'Follow me'}
            </Button>
          </div>

          {/* UT-only: each persona has a fully scripted project — picking
              one takes you straight there instead of leaving you to find
              the right project for the role you're testing. */}
          <div className="border-t px-3 py-2.5">
            <p className="mb-1.5 text-[10.5px] font-medium tracking-wide text-muted-foreground uppercase">Switch user</p>
            <div className="flex items-center gap-1.5">
              {viewerPersonas.map(({ projectId, person }) => (
                <button
                  key={projectId}
                  type="button"
                  aria-label={person.name}
                  title={person.name}
                  onClick={() => navigate(`/projects/${projectId}`)}
                  className={cn(
                    'flex size-7 items-center justify-center rounded-full ring-1 ring-inset transition-opacity hover:opacity-80',
                    person.id === currentUser.id ? 'ring-primary' : 'ring-transparent'
                  )}
                >
                  <Avatar size="sm">
                    <AvatarFallback className={cn('text-xs font-medium text-white', person.colorClass)}>
                      {person.initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-0.5 p-1.5">
            <p className="px-1.5 pt-0.5 pb-1 text-[10.5px] font-medium tracking-wide text-muted-foreground uppercase">Team activity</p>
            {teamMembers.map((member) => {
              const active = followedMemberId === member.id
              const currentView = contextFor(member)
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => followMember(member.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-1.5 py-1.5 text-left transition-colors hover:bg-muted',
                    active && 'bg-primary/10'
                  )}
                >
                  <Avatar size="sm">
                    <AvatarFallback
                      className={cn('text-[10px] font-medium text-white', member.colorClass)}
                    >
                      {member.initials}
                    </AvatarFallback>
                    {member.online && <AvatarBadge className="bg-emerald-500" />}
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{member.name}</div>
                    <div className="truncate text-xs text-muted-foreground" title={currentView?.label}>
                      {currentView?.label ?? member.role}
                    </div>
                    {currentView?.file && (
                      <div className="truncate font-mono text-[10.5px] text-muted-foreground/70">{currentView.file}</div>
                    )}
                  </span>
                  {active && (
                    <span className="shrink-0 text-[10px] font-medium text-primary">
                      Following
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>

        {teamMembers.slice(0, 2).map((member) => {
          const active = followedMemberId === member.id
          const currentView = contextFor(member)
          return (
            <Popover key={member.id}>
              <PopoverTrigger
                aria-label={`${member.name} profile`}
                data-following={active || undefined}
                className={cn(
                  'relative z-30 size-5 rounded-full ring-2 ring-background transition-transform hover:scale-105',
                  active && 'ring-2 ring-primary ring-offset-0 ring-offset-card'
                )}
              >
                <Avatar size="sm" className="size-5">
                  <AvatarFallback
                    className={cn('text-[10px] font-medium text-white', member.colorClass)}
                  >
                    {member.initials}
                  </AvatarFallback>
                  {member.online && <AvatarBadge className="bg-emerald-500" />}
                </Avatar>
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={10} className="w-64 gap-2 rounded-2xl p-3">
                <p className="font-medium">
                  {active ? `Following ${member.name}` : member.name}
                  <span className="font-normal text-muted-foreground"> · {currentView.status}</span>
                </p>
                {currentView.label && <p>{currentView.label}</p>}
                {currentView?.file && <p className="font-mono text-muted-foreground">{currentView.file}</p>}
                <p className="text-xs text-muted-foreground">{member.role}</p>
                <Button size="sm" variant={active ? 'secondary' : 'outline'} className="mt-1 w-full" onClick={() => followMember(member.id)}>
                  {active ? 'Stop following' : 'Follow'}
                </Button>
              </PopoverContent>
            </Popover>
          )
        })}
        {teamMembers.length > 2 && (
          <Popover>
            <PopoverTrigger
              aria-label={`${teamMembers.length - 2} more teammates`}
              className="relative z-20 flex size-5 items-center justify-center rounded-full bg-white/[0.1] text-[9px] font-medium text-slate-300"
            >
              +{teamMembers.length - 2}
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={10} className="w-64 rounded-2xl p-2">
              {teamMembers.slice(2).map((member) => (
                <button key={member.id} type="button" onClick={() => followMember(member.id)} className="flex items-center gap-2 rounded-lg p-2 text-left hover:bg-muted">
                  <Avatar size="sm"><AvatarFallback className={cn('text-[10px] text-white', member.colorClass)}>{member.initials}</AvatarFallback></Avatar>
                  <span className="flex-1"><span className="block text-xs font-medium">{member.name}</span><span className="block text-[11px] text-muted-foreground">{contextFor(member).label ?? member.role}</span></span>
                  <span className="text-[11px]">{followedMemberId === member.id ? 'Stop following' : 'Follow'}</span>
                </button>
              ))}
            </PopoverContent>
          </Popover>
        )}
    </AvatarGroup>
  )
}

export default UserPresence
