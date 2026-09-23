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

// Name, then a quiet role pill (from the shared people data), on their own
// line — so the author reads independently of what they wrote below.
function Byline({ person, className }) {
  return (
    <span className={cn('flex min-w-0 items-center gap-1.5', className)}>
      <span className="truncate text-[13px] font-semibold text-foreground">{person?.name}</span>
      {person?.role && (
        <span className="shrink-0 rounded-full bg-white/5 px-1.5 py-px text-[10px] font-medium text-muted-foreground ring-1 ring-inset ring-white/10">
          {person.role}
        </span>
      )}
    </span>
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
    // Solid neutral cards (no tint): unread is just a touch brighter, with a
    // stronger edge and the violet dot; read items sit back slightly.
    <div className={cn('rounded-2xl border p-4 transition-colors', n.unread ? 'border-white/15 bg-slate-800' : 'border-white/[0.07] bg-slate-800/60')}>
      <button
        type="button"
        onClick={() => {
          markNotificationRead(n.id)
          onJump(n)
        }}
        className="flex w-full items-start gap-3 text-left"
      >
        <Person id={n.authorId} className="mt-0.5" />
        <span className="min-w-0 flex-1">
          {/* Header row: who (name + role) · when, with the unread dot. */}
          <span className="flex items-center gap-2">
            <Byline person={author} className="flex-1" />
            <span className="shrink-0 text-[11px] text-slate-400">{n.timeLabel}</span>
            {n.unread && <span className="size-2 shrink-0 rounded-full bg-violet-500" />}
          </span>
          {/* What they said, on its own line below the byline. */}
          <span className="mt-1.5 block text-[13px] leading-relaxed text-white">{n.text}</span>
          <span className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
            <Icon className={cn('size-3.5', className)} />
            <span className="flex h-5 items-center rounded-full bg-white/[0.06] px-2 font-medium text-slate-300 ring-1 ring-inset ring-white/10">{n.target.label}</span>
          </span>
        </span>
      </button>

      {isThread && (
        <div className="mt-3 border-t border-white/[0.06] pt-2.5">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center justify-center gap-1 rounded-full px-2 h-6 text-[11px] font-medium text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <ChevronDown className={cn('size-3 transition-transform', open && 'rotate-180')} />
            {(n.replies?.length ?? 0) === 0 ? 'Reply' : `${n.replies.length} repl${n.replies.length === 1 ? 'y' : 'ies'}`}
          </button>
          {open && (
            <div className="mt-2.5 space-y-3 border-l border-white/10 pl-3.5">
              {(n.replies ?? []).map((r) => (
                <div key={r.id} className="flex items-start gap-2">
                  <Person id={r.authorId} className="mt-0.5 size-5" />
                  <div className="min-w-0 flex-1">
                    <Byline person={allPeople.find((p) => p.id === r.authorId)} />
                    <p className="mt-1 text-xs leading-relaxed text-white/95">{r.text}</p>
                  </div>
                </div>
              ))}
              <form onSubmit={send} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-800/70 py-1 pr-1 pl-3 focus-within:border-violet-500">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Reply…"
                  className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  className="flex size-6 items-center justify-center rounded-full bg-slate-700 text-white transition-colors hover:bg-slate-600 disabled:opacity-40"
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
          className="flex items-center justify-center gap-1 rounded-full px-2 h-6 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
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
              'inline-flex items-center justify-center rounded-full px-2.5 h-6 text-[11px] font-medium transition-colors',
              tab === id ? 'bg-slate-700 text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
        {unread > 0 && <span className="ml-auto text-[10px] text-muted-foreground">{unread} unread</span>}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {visible.map((n) => (
          <InboxItem key={n.id} n={n} onJump={onJump} />
        ))}
        {visible.length === 0 && <p className="p-6 text-center text-xs text-muted-foreground">Nothing here yet.</p>}
      </div>
    </MergeDrawer>
  )
}

export default MergeInboxDrawer
