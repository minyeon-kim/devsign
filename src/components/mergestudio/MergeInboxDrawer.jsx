import { useState } from 'react'
import { Bell, CheckCheck, ChevronDown, CircleCheck, MessageSquare, Send, Sparkles } from 'lucide-react'
import { cn } from 'cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { allPeople } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'
import MergeDrawer from '@/components/mergestudio/MergeDrawer'

const tabs = [
  ['all', 'All'],
  ['approval', 'Approvals'],
  ['comment', 'Comments'],
  ['feedback', 'Feedback'],
]

const kindIcon = {
  approval: { Icon: CircleCheck, className: 'text-emerald-400' },
  comment: { Icon: MessageSquare, className: 'text-indigo-400' },
  feedback: { Icon: Sparkles, className: 'text-violet-400' },
}

function Person({ id, className }) {
  const person = allPeople.find((p) => p.id === id)
  return (
    <Avatar size="sm" className={className}>
      <AvatarFallback className={cn('text-[9px] font-semibold text-white', person?.colorClass)}>
        {person?.initials}
      </AvatarFallback>
    </Avatar>
  )
}

function InboxItem({ n, onJump }) {
  const { markNotificationRead, replyToNotification } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const author = allPeople.find((p) => p.id === n.authorId)
  const { Icon, className } = kindIcon[n.kind] ?? kindIcon.feedback
  const isThread = n.kind === 'comment'

  function send(e) {
    e.preventDefault()
    if (!draft.trim()) return
    replyToNotification(n.id, draft.trim())
    setDraft('')
  }

  return (
    <div className={cn('rounded-2xl border p-3 transition-colors', n.unread ? 'border-indigo-500/40 bg-indigo-500/10' : 'border-white/10 bg-background/30')}>
      <button
        type="button"
        onClick={() => {
          markNotificationRead(n.id)
          onJump(n)
        }}
        className="flex w-full items-start gap-2.5 text-left"
      >
        <Person id={n.authorId} />
        <span className="min-w-0 flex-1">
          <span className="block text-xs leading-snug text-foreground">
            <span className="font-semibold">{author?.name}</span>{' '}
            <span className="text-foreground/85">{n.text}</span>
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
            <Icon className={cn('size-3', className)} />
            {n.timeLabel}
            <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground/80">{n.target.label}</span>
          </span>
        </span>
        {n.unread && <span className="mt-1 size-2 shrink-0 rounded-full bg-violet-500" />}
      </button>

      {isThread && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronDown className={cn('size-3 transition-transform', open && 'rotate-180')} />
            {(n.replies?.length ?? 0) === 0 ? 'Reply' : `${n.replies.length} repl${n.replies.length === 1 ? 'y' : 'ies'}`}
          </button>
          {open && (
            <div className="mt-2 space-y-2 border-l border-white/10 pl-3">
              {(n.replies ?? []).map((r) => (
                <div key={r.id} className="flex items-start gap-2 text-[11px]">
                  <Person id={r.authorId} className="size-5" />
                  <p className="text-foreground/90">
                    <span className="font-semibold">{allPeople.find((p) => p.id === r.authorId)?.name}</span> {r.text}
                  </p>
                </div>
              ))}
              <form onSubmit={send} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-background/40 py-1 pr-1 pl-3 focus-within:border-violet-500">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Reply…"
                  className="min-w-0 flex-1 bg-transparent text-[11px] text-foreground outline-none placeholder:text-muted-foreground"
                />
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  className="flex size-6 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white disabled:opacity-40"
                >
                  <Send className="size-3" />
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Unified notification + comment inbox. Clicking an item marks it read and
// asks the workspace to pan the infinite canvas to its target element.
function MergeInboxDrawer({ onJump, onClose }) {
  const { notifications, markAllNotificationsRead } = useWorkspace()
  const [tab, setTab] = useState('all')
  const unread = notifications.filter((n) => n.unread).length
  const visible = notifications.filter((n) => tab === 'all' || n.kind === tab)

  return (
    <MergeDrawer
      icon={Bell}
      title="Inbox"
      onClose={onClose}
      aside={
        <button
          type="button"
          onClick={markAllNotificationsRead}
          disabled={unread === 0}
          className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          <CheckCheck className="size-3" />
          Mark all read
        </button>
      }
    >
      <div className="flex shrink-0 items-center gap-1 px-4 pt-3">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
              tab === id ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
        {unread > 0 && <span className="ml-auto text-[10px] text-muted-foreground">{unread} unread</span>}
      </div>

      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
        {visible.map((n) => (
          <InboxItem key={n.id} n={n} onJump={onJump} />
        ))}
        {visible.length === 0 && <p className="p-6 text-center text-xs text-muted-foreground">Nothing here yet.</p>}
      </div>
    </MergeDrawer>
  )
}

export default MergeInboxDrawer
