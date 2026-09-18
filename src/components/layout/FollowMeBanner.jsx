import { Radio, UserRound, X } from 'lucide-react'
import { cn } from 'cn'
import { teamMembers } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'

function PulsingDot({ className }) {
  return (
    <span className="relative flex size-2">
      <span
        className={cn(
          'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
          className
        )}
      />
      <span className={cn('relative inline-flex size-2 rounded-full', className)} />
    </span>
  )
}

function FollowMeBanner() {
  const { followingMe, cancelFollowMe, followedMemberId, remoteViewportIndex, stopFollowingMember } =
    useWorkspace()

  if (!followingMe && !followedMemberId) return null

  const followedMember = followedMemberId
    ? teamMembers.find((m) => m.id === followedMemberId)
    : null
  const target = followedMember?.viewportSequence?.[remoteViewportIndex[followedMemberId] ?? 0]

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[52px] z-50 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border bg-card/95 py-1.5 pr-1.5 pl-3 text-xs shadow-xl shadow-black/20 backdrop-blur-md">
        {followingMe ? (
          <>
            <PulsingDot className="bg-primary" />
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Radio className="size-3.5 text-primary" />
              Waiting for followers...
            </span>
            <button
              type="button"
              onClick={cancelFollowMe}
              className="flex items-center gap-1 rounded-full px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3" />
              Cancel
            </button>
          </>
        ) : (
          <>
            <PulsingDot className="bg-emerald-400" />
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <UserRound className="size-3.5 text-emerald-400" />
              Following {followedMember?.name}
              {target && (
                <span className="hidden font-normal text-muted-foreground sm:inline">
                  · {target.label}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={stopFollowingMember}
              className="flex items-center gap-1 rounded-full px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3" />
              Stop
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default FollowMeBanner
