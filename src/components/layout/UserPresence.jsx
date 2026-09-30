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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
    <AvatarGroup className="ds-user-presence flex w-max flex-nowrap items-center -space-x-1.5 [&>*]:relative [&>*]:shrink-0 [&>*]:ring-2 [&>*]:ring-background [&>[data-following=true]]:ring-primary [&>[data-following=true]]:ring-offset-0">
      {/* Clicking a teammate's avatar directly toggles following their view —
          no popover in the way, per the Follow Me interaction spec. */}
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
          <div className="flex items-center gap-2 p-3">
            <Avatar>
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
            <Button variant="ghost" size="icon-sm">
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
          <div className="flex items-center gap-1.5 px-3 pb-2.5">
            <span className="text-[10.5px] font-medium tracking-wide text-muted-foreground uppercase">Switch user</span>
            <span className="flex flex-1 items-center justify-end gap-1">
              {viewerPersonas.map(({ projectId, person }) => (
                <Tooltip key={projectId}>
                  <TooltipTrigger
                    onClick={() => navigate(`/projects/${projectId}`)}
                    className={cn(
                      'flex size-6 items-center justify-center rounded-full ring-1 ring-inset transition-opacity hover:opacity-80',
                      person.id === currentUser.id ? 'ring-primary' : 'ring-transparent'
                    )}
                  >
                    <Avatar size="sm" className="size-5">
                      <AvatarFallback className={cn('text-[9px] font-medium text-white', person.colorClass)}>
                        {person.initials}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{person.name}</TooltipContent>
                </Tooltip>
              ))}
            </span>
          </div>

          <Separator />

          <div className="flex flex-col gap-0.5 p-1.5">
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
          <p className="border-t px-3 py-2 text-[10.5px] text-muted-foreground">
            Teammate activity is simulated in this prototype.
          </p>
        </PopoverContent>
      </Popover>

        {teamMembers.slice(0, 2).map((member) => {
          const active = followedMemberId === member.id
          const currentView = contextFor(member)
          return (
            <Tooltip key={member.id}>
              <TooltipTrigger
                onClick={() => followMember(member.id)}
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
              </TooltipTrigger>
              <TooltipContent side="bottom" className="flex-col items-start gap-0.5">
                <p className="font-medium">
                  {active ? `Following ${member.name}` : member.name}
                  <span className="font-normal text-background/70"> · {currentView.status}</span>
                </p>
                {currentView.label && <p>{currentView.label}</p>}
                {currentView?.file && <p className="font-mono text-background/70">{currentView.file}</p>}
              </TooltipContent>
            </Tooltip>
          )
        })}
        {teamMembers.length > 2 && (
          <Tooltip>
            <TooltipTrigger
              aria-label={`${teamMembers.length - 2} more teammates`}
              className="relative z-20 flex size-5 items-center justify-center rounded-full bg-white/[0.1] text-[9px] font-medium text-slate-300"
            >
              +{teamMembers.length - 2}
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {teamMembers.slice(2).map((member) => `${member.name} · ${contextFor(member).status}`).join('  /  ')}
            </TooltipContent>
          </Tooltip>
        )}
    </AvatarGroup>
  )
}

export default UserPresence
