import { useState } from 'react'
import { ArrowRight, Bell, CheckCheck, ChevronDown, ChevronRight, Send } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { openOrFocusPanel, panelById } from '@/components/dockview/dockPanels'
import { cn } from 'cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { allPeople } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { groupInboxNotifications } from '@/lib/inboxNotifications'
import { RISK_LABEL, needsReviewFrom, taskFor } from '@/lib/conflicts'
import MergeDrawer from '@/components/mergestudio/MergeDrawer'
import { CATEGORY_TAB, CATEGORY_TAB_ACTIVE, CATEGORY_TAB_IDLE } from '@/components/mergestudio/floatingStyles'
import { getLanguage, useLanguage } from '@/i18n/language'
import { translateText } from '@/i18n/translate'
import { LocalizedText } from '@/i18n/runtime'

// The bell that opens this same drawer everywhere it appears (the
// Workspace/Merge Studio header, a project's own overview) — same content
// and design in every host, not a separate simpler notifications widget
// per page. Each host owns its own open/close state and passes it in.
// The Inbox is for people: reviews to do, approvals, and comments. Automated
// notes (CI results, AI feedback) aren't listed or counted here — they're
// read where they apply, on the canvas and in the conflict's review.
const forInbox = (notifications) => notifications.filter((n) => n.kind !== 'feedback')

export function InboxButton({ open, onToggle }) {
  const notifications = forInbox(useWorkspace().notifications)
  const unreadCount = notifications.filter((n) => n.unread).length

  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        // HighReviewNotifications anchors its banners under this.
        data-inbox-button=""
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
      <AvatarFallback className={cn('font-semibold text-white', size === 'xs' ? 'text-[8px]' : size === 'sm' ? 'text-[9px]' : 'text-[11px]', person?.colorClass)}>
        <LocalizedText text={person?.initials ?? ''} />
      </AvatarFallback>
    </Avatar>
  )
}

// Placeholders skip the JSX translation pass, so they're translated here.
const tr = (text) => translateText(text, getLanguage())


// For path-like words in messages only the last segment shows, in quiet
// monospace (full path on hover).
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
// "AI: …" / "CI: …" → a small source label + the rest of the message.
function splitSource(text) {
  const m = /^([A-Z]{2,4}):\s*(.*)$/.exec(text)
  return m ? { source: m[1], body: m[2] } : { source: null, body: text }
}

const ACTION_BUTTON = 'ds-intrinsic inline-flex h-7 items-center gap-1.5 rounded-full bg-white/[0.07] px-3 text-xs font-medium text-slate-100 transition-colors hover:bg-white/[0.12] hover:text-white'

// One message in a thread — the same for a comment and its replies: no
// box, just avatar · name (· role · time) and the text under it.
function ThreadMessage({ authorId, text, timeLabel }) {
  const author = allPeople.find((p) => p.id === authorId)
  return (
    <div className="flex items-start gap-2">
      {/* Small (20px): the text is what's read, not the face. */}
      <Person id={authorId} size="xs" />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-baseline gap-1.5 text-[13px] leading-5">
          <span className="font-medium text-slate-100"><LocalizedText text={author?.name ?? ''} /></span>
          {author?.role && <span className="text-xs text-slate-500"><LocalizedText text={author.role} /></span>}
          {timeLabel && <span className="ml-auto shrink-0 text-[11px] text-slate-500 tabular-nums"><LocalizedText text={timeLabel} /></span>}
        </p>
        <p className="text-[13px] leading-relaxed text-slate-200"><CondensedText text={text} /></p>
      </div>
    </div>
  )
}

// A conversation, as one thread: each comment and its replies indented
// under it. Replying is one small "Reply" under the thread — the box only
// appears (focused) when that's pressed, answers the latest comment, and
// goes away again on send, on Esc, or when it's left empty.
function CommentThread({ comments }) {
  const { replyToNotification } = useWorkspace()
  const [replying, setReplying] = useState(false)
  const [draft, setDraft] = useState('')
  const latest = comments[comments.length - 1]

  function close() {
    setReplying(false)
    setDraft('')
  }
  function send(e) {
    e.preventDefault()
    if (!draft.trim()) return
    replyToNotification(latest.id, draft.trim())
    close()
  }

  // The reply control belongs to the conversation: it sits right under the
  // last message, starting where that message's text starts (to the right
  // of its avatar) — the "Reply" button, and in the same spot the box it
  // turns into.
  const replyControl = replying ? (
    // One line, a thin edge, and the send arrow inside it — live only once
    // there's something to send.
    <form onSubmit={send} className="relative">
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); close() } }}
        // Left with nothing typed: back to the "Reply" button.
        onBlur={() => { if (!draft.trim()) close() }}
        placeholder={tr('Write a reply')}
        aria-label={tr('Write a reply')}
        className="h-8 w-full min-w-0 rounded-full border border-white/[0.12] bg-transparent pr-9 pl-3 text-[13px] text-white outline-none transition-colors placeholder:text-slate-500 focus:border-white/30"
      />
      <button
        type="submit"
        aria-label="Send"
        title="Send"
        disabled={!draft.trim()}
        // (Keeps the input from blurring — and closing — before the click lands.)
        onMouseDown={(e) => e.preventDefault()}
        className="ds-intrinsic absolute top-1/2 right-1 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-emerald-300 transition-colors hover:bg-white/[0.08] disabled:pointer-events-none disabled:text-slate-600"
      >
        <Send className="size-3.5" />
      </button>
    </form>
  ) : (
    <button type="button" onClick={() => setReplying(true)} className="ds-intrinsic inline-flex h-5 items-center text-xs font-medium text-slate-400 transition-colors hover:text-white">
      <LocalizedText text="Reply" />
    </button>
  )

  return (
    <div className="space-y-3">
      {comments.map((n) => {
        const replies = n.replies ?? []
        const last = n === latest
        return (
          <div key={n.id}>
            <ThreadMessage authorId={n.authorId} text={n.text} timeLabel={n.timeLabel} />
            {replies.length > 0 && (
              <div className="mt-3 ml-7 space-y-3">
                {replies.map((r) => <ThreadMessage key={r.id} authorId={r.authorId} text={r.text} />)}
              </div>
            )}
            {/* 8px under the last message, on its text line: a reply's
                text starts one avatar (28px) further in than a comment's. */}
            {last && <div className={cn('mt-2', replies.length > 0 ? 'ml-14' : 'ml-7')}>{replyControl}</div>}
          </div>
        )
      })}
    </div>
  )
}

// What a notification is, worked out once for its card: the closed card's
// three things (title · one-line summary · time) and what opens under it.
// A digest of a single change isn't a group — it's that change.
function cardOf(group, conflicts, mergeItems) {
  if (group.reviewConflictIds) {
    const changes = group.reviewConflictIds.map((id) => conflicts.find((c) => c.id === id)).filter(Boolean)
    if (changes.length === 1) {
      const [change] = changes
      return { type: 'change', change, severity: change.severity, title: change.title, summary: needsReviewFrom(change) ? 'Needs your review' : 'Review completed' }
    }
    return { type: 'changes', changes, severity: group.severity, title: group.text, summary: changes.map((c) => c.title).join(' · ') }
  }
  const first = group.notifications[0]
  const author = allPeople.find((p) => p.id === first.authorId)
  if (group.kind === 'comment') {
    const comments = group.notifications.filter((n) => n.kind === 'comment')
    const latest = splitSource(first.text)
    return {
      type: 'thread', comments: [...comments].reverse(), authorId: comments.length ? first.authorId : null,
      title: mergeItems.find((item) => item.id === group.target.itemId)?.title ?? group.target.label,
      // Who said it, then the message — translated on its own.
      summaryLead: latest.source ?? author?.name ?? 'Comment', summary: latest.body,
    }
  }
  // An approval: "Alex approved … on Hero CTA". The target is only added
  // as the summary when the title doesn't already name it.
  const named = first.text.includes(group.target.label)
  return { type: 'event', authorId: first.authorId, title: `${author?.name ?? ''} ${first.text}`.trim(), summary: named ? null : group.target.label }
}

// One notification. Closed, every card is the same three things — title,
// a one-line summary, the time. Clicking opens it in place (the box grows
// downward) with what it's about: the description and file, the thread and
// its reply box, and the button that goes there.
function InboxCard({ group, expanded, onToggle, conflicts, mergeItems, onJump }) {
  const card = cardOf(group, conflicts, mergeItems)
  const openChange = (change) => onJump({ target: { conflictId: change.id, label: change.title } })
  const first = group.notifications[0]
  // Where the card's button goes: a conflict's review, or the place on the
  // canvas the notification is about — the Inbox closes, that canvas tab
  // and frame come up centered on it, a comment's thread open on its pin.
  // With neither (no tab, frame or position to go to) there's no button.
  const { canvasLocationFor, revealOnCanvas, dockApi } = useWorkspace()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const onCanvas = !first.target?.conflictId && Boolean(canvasLocationFor(first.target))
  function showOnCanvas() {
    if (!revealOnCanvas(first)) return
    if (dockApi) openOrFocusPanel(dockApi, panelById.canvas)
    // From a page without the canvas (a project's overview): go to it.
    const workspacePath = pathname.replace(/\/(history|overview|docs|activity)?\/?$/, '/workspace')
    if (!/\/workspace\/?$/.test(pathname)) navigate(workspacePath)
  }
  const destination = first.target?.conflictId
    ? { label: taskFor(conflicts.find((conflict) => conflict.id === first.target.conflictId))?.label ?? 'Open review', go: () => onJump(first) }
    : onCanvas ? { label: 'Show on canvas', go: showOnCanvas } : null
  // Open, a conversation is its thread: the header's avatar and one-line
  // preview would only repeat the first comment right under them.
  const openThread = expanded && card.type === 'thread'

  return (
    <div className={cn('rounded-xl transition-colors', expanded ? 'bg-white/[0.05]' : group.unread ? 'bg-emerald-400/[0.05]' : 'bg-white/[0.025]')}>
      <button type="button" aria-expanded={expanded} onClick={onToggle} className="flex w-full items-start gap-2.5 rounded-xl px-3 py-3 text-left transition-colors hover:bg-white/[0.03]">
        {!openThread && <span className="mt-0.5 flex w-6 shrink-0 justify-center">
          {card.authorId ? <Person id={card.authorId} /> : (
            <span className={cn('mt-1.5 size-2 rounded-full', card.severity === 'high' ? 'bg-rose-400' : card.severity === 'medium' ? 'bg-amber-400' : 'bg-sky-400')} />
          )}
        </span>}
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-baseline gap-2">
            <span className={cn('min-w-0 flex-1 text-[13px] leading-5 font-medium text-white', expanded ? 'break-words' : 'truncate')}><LocalizedText text={card.title} /></span>
            <span className="shrink-0 text-[11px] text-slate-500 tabular-nums"><LocalizedText text={group.timeLabel} /></span>
          </span>
          {(card.summary || card.severity) && !openThread && (
            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs leading-5 text-slate-400">
              {/* The level, once per card. */}
              {card.severity && <span className={cn('shrink-0 font-medium', card.severity === 'high' ? 'text-rose-300' : 'text-slate-300')}><LocalizedText text={RISK_LABEL[card.severity]} /></span>}
              {card.severity && card.summary && <span aria-hidden className="text-slate-600">·</span>}
              {card.summary && (
                <span className="min-w-0 flex-1 truncate">
                  {card.summaryLead && <span className="text-slate-300"><LocalizedText text={card.summaryLead} />: </span>}
                  <LocalizedText text={card.summary} />
                </span>
              )}
              {/* A count only says something from two up. */}
              {card.type === 'thread' && card.comments.length >= 2 && <span className="shrink-0 text-slate-500"><LocalizedText text={`${card.comments.length} comments`} /></span>}
            </span>
          )}
        </span>
        <span className="mt-1 flex shrink-0 items-center gap-1.5">
          {group.unread && <span className="ds-status-dot rounded-full bg-[#5EEAB5]" aria-label="Unread" />}
          <ChevronDown className={cn('size-3.5 text-slate-500 transition-transform duration-300', expanded && 'rotate-180')} />
        </span>
      </button>

      {/* Opens by growing (grid rows 0fr → 1fr), so the cards under it
          slide down instead of jumping. */}
      <div className={cn('grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none', expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="min-h-0 overflow-hidden" inert={!expanded}>
          <div className={cn('space-y-3.5 pr-3 pb-3', card.type === 'thread' ? 'pl-3 pt-1' : 'pl-[46px]')}>
            {card.type === 'change' && (
              <>
                <p className="text-xs leading-5 text-slate-300"><LocalizedText text={card.change.message ?? card.change.suggestion} /></p>
                <p translate="no" className="font-mono text-[11.5px] break-all text-slate-400">{card.change.file}</p>
                <button type="button" onClick={() => openChange(card.change)} className={ACTION_BUTTON}>
                  <LocalizedText text={taskFor(card.change)?.label ?? 'Open review'} /><ArrowRight className="size-3.5 opacity-70" />
                </button>
              </>
            )}
            {card.type === 'changes' && (
              <div className="-ml-2 space-y-0.5">
                {card.changes.map((change) => (
                  <button key={change.id} type="button" onClick={() => openChange(change)} className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.05]">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-white"><LocalizedText text={change.title} /></span>
                      <span translate="no" className="mt-0.5 block truncate font-mono text-[11px] text-slate-500">{change.file}</span>
                    </span>
                    <ChevronRight className="mt-1 size-3.5 shrink-0 text-slate-500" />
                  </button>
                ))}
              </div>
            )}
            {card.type === 'event' && destination && (
              <button type="button" onClick={destination.go} className={ACTION_BUTTON}>
                <LocalizedText text={destination.label} /><ArrowRight className="size-3.5 opacity-70" />
              </button>
            )}
            {card.type === 'thread' && (
              <>
                <CommentThread comments={card.comments} />
                {/* Not part of the conversation: what the card as a whole
                    does, set off at its foot under a hairline. */}
                {destination && (
                  <div className="!mt-4 border-t border-white/[0.07] pt-3">
                    <button type="button" onClick={destination.go} className={ACTION_BUTTON}>
                      <LocalizedText text={destination.label} /><ArrowRight className="size-3.5 opacity-70" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// The Inbox. Every notification is a closed card until it's clicked; it
// opens in place, one at a time — opening another closes the last.
function MergeInboxDrawer({ onJump, onClose, inset }) {
  const { notifications: allNotifications, conflicts, mergeItems, markNotificationRead, markAllNotificationsRead } = useWorkspace()
  const notifications = forInbox(allNotifications)
  const [tab, setTab] = useState('unread')
  const [expandedId, setExpandedId] = useState(null)
  const [unreadIds, setUnreadIds] = useState(() => new Set(notifications.filter(n => n.unread).map(n => n.id)))
  const unread = notifications.filter((n) => n.unread).length
  const groups = groupInboxNotifications(notifications)

  function pick(id) {
    setTab(id)
    setExpandedId(null)
    setUnreadIds(id === 'unread' ? new Set(notifications.filter((n) => n.unread).map((n) => n.id)) : null)
  }
  function toggleGroup(group) {
    if (expandedId === group.id) { setExpandedId(null); return }
    setExpandedId(group.id)
    group.notifications.forEach(n => markNotificationRead(n.id))
  }
  const visible = groups.filter(group => tab === 'all' || (tab === 'unread'
    ? group.notifications.some(n => n.unread || unreadIds?.has(n.id)) : group.kind === tab))

  return (
    <MergeDrawer icon={Bell} title="Inbox" onClose={onClose} inset={inset} aside={
      <button type="button" onClick={() => { markAllNotificationsRead(); setUnreadIds(new Set()) }} disabled={unread === 0} className="flex h-7 shrink-0 items-center justify-center gap-1 rounded-full px-2.5 text-xs font-medium whitespace-nowrap text-slate-300 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40">
        <CheckCheck className="size-3.5" /> Mark all read
      </button>
    }>
      <div className="grid shrink-0 grid-cols-4 gap-1 px-3 pb-2" role="tablist" aria-label="Filter notifications">
        {tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => pick(id)} className={cn(CATEGORY_TAB, 'min-w-0 w-full gap-1 px-1.5', tab === id ? CATEGORY_TAB_ACTIVE : CATEGORY_TAB_IDLE)}>
          <span className="truncate">{label}</span>
          {id === 'unread' && unread > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-400/20 px-1 text-[10px] leading-none font-semibold text-emerald-300 tabular-nums">{unread}</span>}
        </button>)}
      </div>
      <div className="scroll-fade-bottom min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 pb-3">
        {visible.map(group => (
          <InboxCard key={group.id} group={group} expanded={expandedId === group.id} onToggle={() => toggleGroup(group)} conflicts={conflicts} mergeItems={mergeItems} onJump={onJump} />
        ))}
        {!visible.length && <p className="p-6 text-center text-xs text-muted-foreground">{tab === 'unread' ? 'You’re all caught up.' : 'Nothing here yet.'}</p>}
      </div>
    </MergeDrawer>
  )
}

export default MergeInboxDrawer
