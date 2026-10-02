import { useState } from 'react'
import { ArrowLeft, Bell, CheckCheck, ChevronRight, MessageSquare, Smile } from 'lucide-react'
import { cn } from 'cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { allPeople } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { commentGroupSummary, groupInboxNotifications } from '@/lib/inboxNotifications'
import { needsReviewFrom } from '@/lib/conflicts'
import { RiskBadge } from '@/components/conflicts/ConflictRow'
import MergeDrawer from '@/components/mergestudio/MergeDrawer'
import { CATEGORY_TAB, CATEGORY_TAB_ACTIVE, CATEGORY_TAB_IDLE } from '@/components/mergestudio/floatingStyles'
import { useLanguage } from '@/i18n/language'
import { translateText } from '@/i18n/translate'
import { LocalizedText } from '@/i18n/runtime'

// The bell that opens this same drawer everywhere it appears (the
// Workspace/Merge Studio header, a project's own overview) — same content
// and design in every host, not a separate simpler notifications widget
// per page. Each host owns its own open/close state and passes it in.
export function InboxButton({ open, onToggle }) {
  const { notifications } = useWorkspace()
  const unreadCount = notifications.filter((n) => n.unread).length

  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label={unreadCount ? `Inbox (${unreadCount} unread)` : 'Inbox'}
        aria-expanded={open}
        onClick={onToggle}
        className={cn(
          'relative flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground',
          open && 'bg-emerald-400/20 text-emerald-300'
        )}
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex min-w-3 items-center justify-center rounded-full bg-emerald-400 px-0.5 text-[8px] leading-[12px] font-semibold text-slate-950 ring-2 ring-card">
            {unreadCount}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent>Inbox{unreadCount ? ` · ${unreadCount} unread` : ''}</TooltipContent>
    </Tooltip>
  )
}

// Filter tabs. "Unread" is a filter too (Linear / Slack style), with its
// count as a badge.
const tabs = [
  ['unread', 'Unread'],
  ['all', 'All'],
  ['approval', 'Approvals'],
  ['comment', 'Comments'],
]

function Person({ id, className, size = 'sm' }) {
  const person = allPeople.find((p) => p.id === id)
  return (
    <Avatar size={size} className={className}>
      <AvatarFallback className={cn('font-semibold text-white', size === 'sm' ? 'text-[9px]' : 'text-[11px]', person?.colorClass)}>
        <LocalizedText text={person?.initials ?? ''} />
      </AvatarFallback>
    </Avatar>
  )
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
// Text passed here bypasses the JSX-boundary translator below (it's split
// into path-aware segments, a raw prop rather than an isolated child), so
// it's translated explicitly first.
function CondensedText({ text }) {
  const language = useLanguage()
  return translateText(text, language).split(/(\s+)/).map((part, i) =>
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
//   approval — a compact one-line event ("Alex approved … Hero CTA");
//   feedback — AI / CI notes: a small source label and the note as
//              secondary text, paths condensed.
// No pills in the header: role and target are plain inline text. Unread is
// carried by a bolder name and the mint dot. Clicking the item jumps the
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
    <span className={cn('text-[13px]', n.unread ? 'font-semibold text-[#FFFFFF]' : 'font-medium text-slate-200')}><LocalizedText text={author?.name ?? ''} /></span>
  )
  const target = (
    <span title={n.target.label} className="font-medium text-[#FFFFFF] underline-offset-2 group-hover:underline">
      {n.target.conflictId ? <LocalizedText text={n.target.label} /> : shortLabel(n.target.label)}
    </span>
  )
  const meta = (
    <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
      <span className="text-[11px] text-slate-500 tabular-nums"><LocalizedText text={n.timeLabel} /></span>
      <span aria-label={n.unread ? 'Unread' : undefined} className={cn('ds-status-dot rounded-full', n.unread ? 'bg-emerald-400' : 'bg-transparent')} />
    </span>
  )

  return (
    <div className={cn('group', isEvent ? 'py-2.5' : 'py-3')}>
      <button
        type="button"
        title={n.target.conflictId ? `Open the review of ${n.target.label}` : `Jump to ${n.target.label} on the canvas`}
        onClick={jump} className="flex w-full items-start gap-3 text-left">
        {/* Fixed avatar slot so every text column lines up. */}
        <span className="flex w-8 shrink-0 justify-center">
          <Person id={n.authorId} size={isEvent ? 'sm' : 'default'} />
        </span>
        <span className="min-w-0 flex-1">
          {isEvent ? (
            // Approval: one quiet line.
            <span className="flex items-start gap-2">
              <span className="min-w-0 flex-1 text-[13px] leading-6 text-slate-400">
                {name}{' '}
                {n.target.conflictId
                  ? <LocalizedText text={n.text} />
                  : <><LocalizedText text={stripTarget(n.text, n.target.label)} /> on {target}</>}
              </span>
              {meta}
            </span>
          ) : (
            <>
              <span className="flex items-start gap-2">
                <span className="min-w-0 flex-1 truncate leading-6">
                  {name}
                  {author?.role && <span className="ml-1.5 text-xs text-slate-500"><LocalizedText text={author.role} /></span>}
                </span>
                {meta}
              </span>
              <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs">
                {isThread && <span className="shrink-0 rounded bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">Comment</span>}
                {!isThread && source && <span className="shrink-0 text-slate-500">{source}</span>}
                <span className="truncate text-slate-400">· {target}</span>
              </span>
              {isThread ? (
                <span className="mt-2 block rounded-lg border-l-2 border-emerald-400/60 bg-white/[0.035] px-3 py-2 text-[13px] leading-relaxed text-slate-100">
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
            <div className="absolute right-16 bottom-full z-10 mb-2 flex gap-0.5 rounded-full border border-white/10 bg-popover p-1 shadow-xl shadow-black/50">
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

function NotificationSummary({ group, conflicts, mergeItems, onOpen }) {
  const changes = (group.reviewConflictIds ?? []).map(id => conflicts.find(c => c.id === id)).filter(Boolean)
  const first = group.notifications[0]
  const author = allPeople.find(p => p.id === first.authorId)
  const comment = group.kind === 'comment' ? commentGroupSummary(group) : null
  const itemName = mergeItems.find(item => item.id === group.target.itemId)?.title
  const subject = itemName ?? group.target.label
  const latest = splitSource(first.text)
  const preview = changes.length ? changes.map(c => c.title).join(' · ')
    : group.kind === 'comment' ? first.text : group.target.label
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex w-full items-start gap-2 rounded-xl px-2.5 py-3.5 text-left ring-1 ring-white/[0.05] transition-colors',
        comment && group.unread ? 'bg-emerald-400/[0.05] hover:bg-emerald-400/[0.08]' : 'bg-white/[0.025] hover:bg-white/[0.05]'
      )}
    >
      <span className="mt-0.5 shrink-0">
        {group.severity ? <RiskBadge severity={group.severity} /> : group.kind === 'comment' ? (
          <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300">
            <MessageSquare className="size-3.5" />
          </span>
        ) : <CheckCheck className="size-4 text-slate-500" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="min-w-0 flex-1 truncate text-[13px] leading-5 font-medium text-white">{comment ? subject : <>{!group.reviewConflictIds && group.kind === 'approval' && author ? `${author.name} ` : ''}{group.text}</>}</span>
          <span className="shrink-0 text-[11px] text-slate-500">{group.timeLabel}</span>
        </span>
        {comment ? <>
          {itemName && itemName !== group.target.label && <span className="mt-1.5 block truncate text-[11px] text-slate-500">{group.target.label}</span>}
          <span className="mt-2 block line-clamp-2 rounded-lg border-l-2 border-emerald-400/50 bg-black/15 px-1.5 py-2 text-xs leading-5 text-slate-200">
            <span className="font-medium text-emerald-300">{latest.source ?? author?.name ?? 'Comment'}: </span>{latest.body}
          </span>
          <span className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-1 text-[10px] text-slate-500">
            {comment.comments > 0 && <span className="text-emerald-300/80">{`${comment.comments} comments`}</span>}
            {comment.feedback > 0 && <span>{`${comment.feedback} automated notes`}</span>}
            {comment.replies > 0 && <span>{`${comment.replies} replies`}</span>}
          </span>
        </> : <span className="mt-2 block line-clamp-2 text-xs leading-5 text-slate-400">{preview}</span>}
      </span>
      <span className="mt-0.5 flex shrink-0 items-center gap-1.5">
        {group.unread && <span className="ds-status-dot rounded-full bg-[#5EEAB5]" aria-label="Unread" />}
        <ChevronRight className="size-3.5 text-slate-500" />
      </span>
    </button>
  )
}

// Notifications open their scoped list first; individual rows open the target.
function MergeInboxDrawer({ onJump, onClose }) {
  const { notifications, conflicts, mergeItems, markNotificationRead, markAllNotificationsRead } = useWorkspace()
  const [tab, setTab] = useState('unread')
  const [selected, setSelected] = useState(null)
  const [unreadIds, setUnreadIds] = useState(() => new Set(notifications.filter(n => n.unread).map(n => n.id)))
  const unread = notifications.filter((n) => n.unread).length
  const groups = groupInboxNotifications(notifications)
  const selectedGroup = selected && (groups.find(group => group.id === selected.id) ?? selected)

  function pick(id) {
    setTab(id)
    setSelected(null)
    setUnreadIds(id === 'unread' ? new Set(notifications.filter((n) => n.unread).map((n) => n.id)) : null)
  }
  function openGroup(group) {
    setSelected(group)
    group.notifications.forEach(n => markNotificationRead(n.id))
  }
  const visible = groups.filter(group => tab === 'all' || (tab === 'unread'
    ? group.notifications.some(n => n.unread || unreadIds?.has(n.id)) : group.kind === tab))
  const reviewItems = selectedGroup?.reviewConflictIds?.map(id => conflicts.find(c => c.id === id)).filter(Boolean) ?? []

  return (
    <MergeDrawer icon={Bell} title="Inbox" onClose={onClose} aside={
      <button type="button" onClick={() => { markAllNotificationsRead(); setUnreadIds(new Set()) }} disabled={unread === 0} className="flex h-7 shrink-0 items-center justify-center gap-1 rounded-full px-2.5 text-xs font-medium whitespace-nowrap text-slate-300 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40">
        <CheckCheck className="size-3.5" /> Mark all read
      </button>
    }>
      {selectedGroup ? <>
        <div className="shrink-0 border-b border-white/[0.07] px-5 pb-3">
          <button type="button" onClick={() => setSelected(null)} className="mb-3 inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-xs text-slate-400 hover:bg-white/5 hover:text-white"><ArrowLeft className="size-3.5" /> Back to notifications</button>
          <h3 className="text-[13px] leading-5 font-medium text-white">{selectedGroup.kind === 'comment' ? mergeItems.find(item => item.id === selectedGroup.target.itemId)?.title ?? selectedGroup.target.label : selectedGroup.text}</h3>
          <p className="mt-1 text-xs text-slate-400">{selectedGroup.reviewConflictIds ? 'Select a change to open its review.' : selectedGroup.kind === 'approval' ? 'Approval activity for this target.' : 'Comments and feedback for this target.'}</p>
        </div>
        <div className="scroll-fade-bottom min-h-0 flex-1 overflow-y-auto px-5 pb-3">
          {selectedGroup.reviewConflictIds ? <div className="divide-y divide-white/[0.06]">
            {reviewItems.map(conflict => <button key={conflict.id} type="button" onClick={() => onJump({ target: { conflictId: conflict.id, label: conflict.title } })} className="flex w-full items-start gap-3 py-4 text-left">
              <RiskBadge severity={conflict.severity} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-white"><LocalizedText text={conflict.title} /></span>
                <span className="mt-1 block text-[11px] text-slate-500">{conflict.file}</span>
                <span className="mt-2 block text-xs leading-5 text-slate-400"><LocalizedText text={conflict.message ?? conflict.suggestion} /></span>
                <span className="mt-2 block text-[11px] text-emerald-300">{needsReviewFrom(conflict) ? 'Needs your review' : 'Review completed'}</span>
              </span>
              <ChevronRight className="mt-1 size-3.5 shrink-0 text-slate-500" />
            </button>)}
            {!reviewItems.length && <p className="py-6 text-center text-xs text-slate-500">No changes waiting for review.</p>}
          </div> : selectedGroup.notifications.map(saved => {
            const n = notifications.find(current => current.id === saved.id) ?? saved
            return <InboxItem key={n.id} n={n} onJump={onJump} />
          })}
        </div>
      </> : <>
        <div className="grid shrink-0 grid-cols-4 gap-1 px-3 pb-2" role="tablist" aria-label="Filter notifications">
          {tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} aria-description={id === 'comment' ? 'Comments and AI / CI feedback' : undefined} onClick={() => pick(id)} className={cn(CATEGORY_TAB, 'min-w-0 w-full gap-1 px-1.5', tab === id ? CATEGORY_TAB_ACTIVE : CATEGORY_TAB_IDLE)}>
            <span className="truncate">{label}</span>
            {id === 'unread' && unread > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-400/20 px-1 text-[10px] leading-none font-semibold text-emerald-300 tabular-nums">{unread}</span>}
          </button>)}
        </div>
        <div className="scroll-fade-bottom min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 pb-3">
          {visible.map(group => <NotificationSummary key={group.id} group={group} conflicts={conflicts} mergeItems={mergeItems} onOpen={() => openGroup(group)} />)}
          {!visible.length && <p className="p-6 text-center text-xs text-muted-foreground">{tab === 'unread' ? 'You’re all caught up.' : 'Nothing here yet.'}</p>}
        </div>
      </>}
    </MergeDrawer>
  )
}

export default MergeInboxDrawer
