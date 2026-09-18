import { ChevronDown, Headset } from 'lucide-react'
import { cn } from 'cn'
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
import { currentUser, teamMembers } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'

function UserPresence() {
  const {
    followingMe,
    followedMemberId,
    remoteViewportIndex,
    startFollowMe,
    cancelFollowMe,
    followMember,
  } = useWorkspace()

  function toggleFollowMe() {
    if (followingMe) {
      cancelFollowMe()
    } else {
      startFollowMe()
    }
  }

  return (
    <div className="flex items-center gap-1">
      {/* Clicking a teammate's avatar directly toggles following their view —
          no popover in the way, per the Follow Me interaction spec. */}
      <AvatarGroup size="sm">
        {teamMembers.map((member) => {
          const active = followedMemberId === member.id
          const currentView = member.viewportSequence?.[remoteViewportIndex[member.id] ?? 0]
          return (
            <Tooltip key={member.id}>
              <TooltipTrigger
                onClick={() => followMember(member.id)}
                className={cn(
                  'rounded-full transition-transform hover:scale-105',
                  active && 'ring-2 ring-primary ring-offset-1 ring-offset-card'
                )}
              >
                <Avatar>
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
                </p>
                {currentView && (
                  <p className="text-background/70">{currentView.label}</p>
                )}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </AvatarGroup>

      <Popover>
        <PopoverTrigger className="flex items-center gap-0.5 rounded-full transition-opacity hover:opacity-80">
          <Avatar size="sm" className="ring-2 ring-background">
            <AvatarFallback
              className={cn('text-[10px] font-medium text-white', currentUser.colorClass)}
            >
              {currentUser.initials}
            </AvatarFallback>
          </Avatar>
          <ChevronDown className="size-3 text-muted-foreground" />
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

          <Separator />

          <div className="flex flex-col gap-0.5 p-1.5">
            {teamMembers.map((member) => {
              const active = followedMemberId === member.id
              const currentView =
                member.viewportSequence?.[remoteViewportIndex[member.id] ?? 0]
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
                    <div className="truncate text-xs text-muted-foreground">
                      {currentView?.label ?? member.role}
                    </div>
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
    </div>
  )
}

export default UserPresence
