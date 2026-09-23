import { useState } from 'react'
import { Bell, CheckCheck, Smile } from 'lucide-react'
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

function Person({ id, className, size = 'sm' }) {
  const person = allPeople.find((p) => p.id === id)
  return (
    <Avatar size={size} className={className}>
      <AvatarFallback className={cn('font-semibold text-white', size === 'sm' ? 'text-[9px]' : 'text-[11px]', person?.colorClass)}>
        {person?.initials}
      </AvatarFallback>
    </Avatar>
  )
}

// What the author did, phrased as a verb before the target.
const ACTION = {
  comment: 'commented on',
  approval: 'approved',
  feedback: 'flagged',
}
const EMOJI = ['👍', '🎉', '👀', '🔥', '✅', '💜']

// Keep long labels from stretching the row: "FlowBank - Homepage…Header" style
// middle truncation for targets, and for path-like words in messages only
// the last segment, in quiet monospace (full path on hover).
function shortLabel(label, max = 26) {
  if (!label || label.length <= max) return label
  const keep = max - 1
  return `${label.slice(0, Math.ceil(keep / 2))}…${label.slice(-Math.floor(keep / 2))}`
}
function CondensedText({ text }) {
  return text.split(/(\s+)/).map((part, i) =>
    /^[\w.-]+\/[\w./-]+$/.test(part) ? (
      <code key={i} title={part} className="rounded bg-white/[0.06] px-1 font-mono text-[0.92em] text-slate-300">
        {part.split('/').pop()}
      </code>
    ) : (
      part
    )
  )
}
// "approved the design changes on Hero CTA" → "approved the design changes"
// (the target is rendered separately, as its own inline link).
function stripTarget(text, label) {
  const suffix = ` on ${label}`
  return text.endsWith(suffix) ? text.slice(0, -suffix.length) : text
}
// "AI: …" / "CI: …" → a small source label + the rest of the message.
function splitSource(text) {
  const m = /^([A-Z]{2,4}):\s*(.*)$/.exec(text)
  return m ? { source: m[1], body: m[2] } : { source: null, body: text }
}

// One feed item. The layout follows what the item *is*, so the stream has
// a natural rhythm instead of identical blocks:
//   comment  — a conversation: name · role ··· time, "commented on Target",
//              the message in white, replies, and the comment bar;
//   approval — a compact one-line event ("Min approved … Hero CTA");
//   feedback — AI / CI notes: a small source label and the note as
//              secondary text, paths condensed.
// No pills in the header: role and target are plain inline text. Unread is
// carried by a bolder name and the violet dot. Clicking the item jumps the
// canvas to the target (with the pulse).
function InboxItem({ n, onJump }) {
  const { markNotificationRead, replyToNotification } = useWorkspace()
  const [draft, setDraft] = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)
  const author = allPeople.find((p) => p.id === n.authorId)
  const isThread = n.kind === 'comment'
  const isEvent = n.kind === 'approval'
  const replies = n.replies ?? []
  const { source, body } = splitSource(n.text)

  function jump() {
    markNotificationRead(n.id)
    onJump(n)
  }

  function send(e) {
    e.preventDefault()
    if (!draft.trim()) return
    replyToNotification(n.id, draft.trim())
    setDraft('')
    setEmojiOpen(false)
  }

  const name = (
    <span className={cn('text-[13px]', n.unread ? 'font-semibold text-[#FFFFFF]' : 'font-medium text-slate-200')}>{author?.name}</span>
  )
  const target = (
    <span title={n.target.label} className="font-medium text-[#FFFFFF] underline-offset-2 group-hover:underline">
      {shortLabel(n.target.label)}
    </span>
  )
  const meta = (
    <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
      <span className="text-[11px] text-slate-500 tabular-nums">{n.timeLabel}</span>
      <span aria-label={n.unread ? 'Unread' : undefined} className={cn('size-1.5 rounded-full', n.unread ? 'bg-violet-500' : 'bg-transparent')} />
    </span>
  )

  return (
    <div className={cn('group', isEvent ? 'py-3.5' : 'py-5')}>
      <button type="button" title={`Jump to ${n.target.label} on the canvas`} onClick={jump} className="flex w-full items-start gap-3 text-left">
        {/* Fixed avatar slot so every text column lines up. */}
        <span className="flex w-8 shrink-0 justify-center">
          <Person id={n.authorId} size={isEvent ? 'sm' : 'default'} />
        </span>
        <span className="min-w-0 flex-1">
          {isEvent ? (
            // Approval: one quiet line.
            <span className="flex items-start gap-2">
              <span className="min-w-0 flex-1 text-[13px] leading-6 text-slate-400">
                {name} {stripTarget(n.text, n.target.label)} on {target}
              </span>
              {meta}
            </span>
          ) : (
            <>
              <span className="flex items-start gap-2">
                <span className="min-w-0 flex-1 truncate leading-6">
                  {name}
                  {author?.role && <span className="ml-1.5 text-xs text-slate-500">{author.role}</span>}
                </span>
                {meta}
              </span>
              <span className="block truncate text-xs text-slate-400">
                {ACTION[n.kind] ?? 'mentioned'} {target}
              </span>
              {isThread ? (
                <span className="mt-2.5 block text-[13px] leading-relaxed text-[#FFFFFF]">
                  <CondensedText text={n.text} />
                </span>
              ) : (
                <span className="mt-2 flex items-baseline gap-2 text-[13px] leading-relaxed text-slate-300">
                  {source && <span className="shrink-0 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">{source}</span>}
                  <span className="min-w-0">
                    <CondensedText text={body} />
                  </span>
                </span>
              )}
            </>
          )}
        </span>
      </button>

      {/* Replies flow on in the message column — no boxes, no rail. */}
      {replies.length > 0 && (
        <div className="mt-4 ml-11 space-y-3.5">
          {replies.map((r) => {
            const who = allPeople.find((p) => p.id === r.authorId)
            return (
              <div key={r.id} className="flex items-start gap-2.5">
                <Person id={r.authorId} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-6 font-medium text-slate-200">
                    {who?.name}
                    {who?.role && <span className="ml-1.5 text-xs font-normal text-slate-500">{who.role}</span>}
                  </p>
                  <p className="text-[13px] leading-relaxed text-[#FFFFFF]">
                    <CondensedText text={r.text} />
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pill input: Write a comment · emoji · solid dark Send. */}
      {isThread && (
        <form onSubmit={send} className="relative mt-4 ml-11">
          <div className="flex h-10 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] pr-1 pl-4 transition-colors focus-within:border-white/25">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a comment"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-slate-500"
            />
            <button
              type="button"
              title="Add emoji"
              aria-expanded={emojiOpen}
              onClick={() => setEmojiOpen((v) => !v)}
              className={cn('flex size-8 items-center justify-center rounded-full transition-colors', emojiOpen ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white')}
            >
              <Smile className="size-4" />
            </button>
            <button
              type="submit"
              disabled={!draft.trim()}
              className="flex h-8 items-center justify-center rounded-full bg-[#2c2c31] px-4 text-xs font-semibold text-white ring-1 ring-inset ring-white/10 transition-colors hover:bg-[#38383e] disabled:text-slate-500 disabled:hover:bg-[#2c2c31]"
            >
              Send
            </button>
          </div>
          {emojiOpen && (
            <div className="absolute right-16 bottom-full z-10 mb-2 flex gap-0.5 rounded-full border border-white/10 bg-[#1c1c1f] p-1 shadow-xl shadow-black/50">
              {EMOJI.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setDraft((d) => d + e)}
                  className="flex size-8 items-center justify-center rounded-full text-base transition-colors hover:bg-white/10"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </form>
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
      <div className="flex shrink-0 items-center gap-1 border-b border-white/[0.06] px-5 py-3">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'inline-flex h-7 items-center justify-center rounded-full px-3 text-xs font-medium transition-colors',
              // Subtle secondary control: the active filter is a hairline
              // outline, so the comment stream stays the loudest thing here.
              tab === id ? 'text-slate-100 ring-1 ring-inset ring-white/25' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
            )}
          >
            {label}
          </button>
        ))}
        {unread > 0 && <span className="ml-auto text-[11px] text-slate-400">{unread} unread</span>}
      </div>

      <div className="min-h-0 flex-1 divide-y divide-white/[0.06] overflow-y-auto px-5 pb-2">
        {visible.map((n) => (
          <InboxItem key={n.id} n={n} onJump={onJump} />
        ))}
        {visible.length === 0 && <p className="p-6 text-center text-xs text-muted-foreground">Nothing here yet.</p>}
      </div>
    </MergeDrawer>
  )
}

export default MergeInboxDrawer
