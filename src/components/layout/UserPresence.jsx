import { cn } from 'cn'
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
} from '@/components/ui/avatar'
import { WORKSPACE_POPOVER } from '@/components/mergestudio/floatingStyles'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useWorkspace } from '@/state/WorkspaceProvider'

function UserPresence() {
  const {
    followedMemberId,
    followMember,
    memberViewports,
    workspaceFiles: files,
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

  return (
    <AvatarGroup className="ds-user-presence flex w-max flex-nowrap items-center -space-x-0.5 [&>*]:relative [&>*]:shrink-0 [&>*]:ring-2 [&>*]:ring-background [&>[data-following=true]]:ring-primary [&>[data-following=true]]:ring-offset-0">
      {/* (Teammates only: you're the rail's avatar at the bottom left — "Follow me" is in its menu.) */}
        {/* Two teammates at most, then "+N" for the rest. */}
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
                <Avatar size="xs">
                  <AvatarFallback
                    className={cn('font-medium text-white', member.colorClass)}
                  >
                    {member.initials}
                  </AvatarFallback>
                  {member.online && <AvatarBadge className="bg-emerald-500" />}
                </Avatar>
              </PopoverTrigger>
              {/* The workspace's popover (WORKSPACE_POPOVER): who, what they're doing, Follow — then where they are, in
                  a quiet box under it. */}
              <PopoverContent align="end" sideOffset={10} data-member-card className={cn('w-72 gap-1.5', WORKSPACE_POPOVER)}>
                <div className="flex items-center gap-2.5 px-2 pt-1.5 pb-1">
                  <Avatar size="sm">
                    <AvatarFallback className={cn('text-[10px] font-medium text-white', member.colorClass)}>
                      {member.initials}
                    </AvatarFallback>
                    {member.online && <AvatarBadge className="bg-emerald-500" />}
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13px] leading-5 font-medium text-white">{member.name}</span>
                    <span className="truncate text-[11.5px] leading-4 text-slate-400">{member.role} · {currentView.status}</span>
                  </div>
                  <button type="button" onClick={() => followMember(member.id)} aria-pressed={active}
                    className={cn('h-7 shrink-0 rounded-full px-3 text-[12px] font-medium transition-colors', active ? 'bg-white text-slate-950 hover:bg-white/90' : 'bg-white/[0.08] text-white hover:bg-white/[0.12]')}>
                    {active ? 'Stop following' : 'Follow'}
                  </button>
                </div>
                {(currentView.label || currentView?.file) && (
                  <div className="rounded-xl bg-white/[0.03] px-3 py-2.5">
                    {currentView.label && <p className="text-[12.5px] leading-[18px] text-slate-300">{currentView.label}</p>}
                    {currentView?.file && <p translate="no" className="mt-0.5 truncate font-mono text-[11px] text-slate-500">{currentView.file}</p>}
                  </div>
                )}
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
            <PopoverContent align="end" sideOffset={10} className={cn('w-72 gap-0', WORKSPACE_POPOVER)}>
              {teamMembers.slice(2).map((member) => (
                <button key={member.id} type="button" onClick={() => followMember(member.id)} className="flex min-h-11 items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left transition-colors hover:bg-white/[0.05]">
                  <Avatar size="sm"><AvatarFallback className={cn('text-[10px] text-white', member.colorClass)}>{member.initials}</AvatarFallback></Avatar>
                  <span className="flex min-w-0 flex-1 flex-col"><span className="truncate text-[13px] leading-5 font-medium text-white">{member.name}</span><span className="truncate text-[11.5px] leading-4 text-slate-400">{contextFor(member).label ?? member.role}</span></span>
                  <span className="shrink-0 text-[12px] text-slate-300">{followedMemberId === member.id ? 'Stop following' : 'Follow'}</span>
                </button>
              ))}
            </PopoverContent>
          </Popover>
        )}
    </AvatarGroup>
  )
}

export default UserPresence
