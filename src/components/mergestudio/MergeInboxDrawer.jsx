import { DAY_GROUP_LABEL, badgeOf, dayGroupOf, defaultTabOf, isUnread, showsIn } from '@/lib/notifications'
import { Fragment, useState } from 'react'
import { ArrowRight, Bell, CheckCheck, ChevronDown, ChevronRight, Send, TriangleAlert } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { openOrFocusPanel, panelById } from '@/components/dockview/dockPanels'
import { cn } from 'cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { allPeople } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { groupInboxNotifications } from '@/lib/inboxNotifications'
import { closedPartsOf, shortValue, summaryOf } from '@/lib/notificationSummary'
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
  const unreadCount = notifications.filter(isUnread).length
  const badge = badgeOf(notifications)

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
        {badge && (
          <span data-inbox-badge className="absolute -top-1 -right-1 flex min-w-3 items-center justify-center rounded-full bg-emerald-400 px-0.5 text-[8px] leading-[12px] font-semibold text-slate-950 tabular-nums ring-2 ring-card">
            {badge}
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

// A notification about one change's values (found, asked about, due, approved):
// its two closed lines and what opens under them come from the change itself
// (lib/notificationSummary) — the same names and values its detail lists.
const nameOfPerson = (id) => allPeople.find((person) => person.id === id)?.name ?? id
function noticeOf(group, conflicts) {
  if (group.kind === 'comment' || (group.reviewConflictIds && group.reviewConflictIds.length !== 1)) return null
  const notification = group.notifications[0]
  const change = conflicts.find((conflict) => conflict.id === notification?.target?.conflictId)
  const summary = summaryOf(notification, change, { nameOf: nameOfPerson })
  if (!summary) return null
  // The title: who did what, as one sentence. (What it's about, and when it's due, is the meta line under it.)
  const actor = notification.authorId ? nameOfPerson(notification.authorId) : null
  const sentence = summary.type === 'request' ? (summary.requester ? `${summary.requester}님이 승인을 요청했어요` : '승인 요청이 왔어요')
    : summary.type === 'decision' ? (summary.label === '수정 요청' ? `${actor ?? '검토자'}님이 수정을 요청했어요` : `${actor ?? '검토자'}님이 승인했어요`)
      : summary.type === 'due' ? '마감이 다가와요' : '변경이 감지됐어요'
  // (A request is the requester's: their face, as the title names them.)
  const authorId = notification.authorId ?? (summary.type === 'request' ? change.decisionRequest?.by ?? change.requestedBy ?? null : null)
  return { type: 'notice', summary, change, severity: change.severity, authorId, title: sentence, target: summary.target, closed: closedPartsOf(summary) }
}

// What opens under a change's notification, top to bottom: what was said, the
// values that differ (a diff chip each — two, then "외 N건"), the file and who
// asked, the two pictures, and the way in. All of it starts where the title's
// text does.
function NoticeBody({ card, destination }) {
  const { summary } = card
  const values = summary.changes.all.map((change) => ({ label: change.label, value: `${shortValue(change.from)} → ${shortValue(change.to)}` }))
  return (
    <>
      {/* What was said (a request's reason), then the values in one quiet line — the comparison itself is the
          change's, a press away. */}
      {summary.type === 'request' && summary.lead && <p data-notice-lead className="text-[13px] leading-5 text-slate-200">“<LocalizedText text={summary.lead} />”</p>}
      {summary.type !== 'request' && summary.lead && <p data-notice-lead className="text-xs leading-5 text-slate-300"><LocalizedText text={summary.lead} /></p>}
      {values.length > 0 && (
        <p data-notice-changes className="text-xs leading-5 text-slate-400 tabular-nums">
          {values.map((entry, index) => <Fragment key={entry.label}>{index > 0 && <span aria-hidden className="mx-1.5 text-slate-600">·</span>}<LocalizedText text={entry.label} /> <span translate="no" className="text-slate-300">{entry.value}</span></Fragment>)}
        </p>
      )}
      {destination && (
        <button type="button" onClick={destination.go} className={ACTION_BUTTON}>
          <LocalizedText text={destination.label} /><ArrowRight className="size-3.5 opacity-70" />
        </button>
      )}
    </>
  )
}

// What a notification is, worked out once for its card: the closed card's
// three things (title · one-line summary · time) and what opens under it.
// A digest of a single change isn't a group — it's that change.
function cardOf(group, conflicts, mergeItems) {
  const notice = noticeOf(group, conflicts)
  if (notice) return notice
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
      // Who said it, as the title; what it's on, the meta line; the message itself, one line under it.
      title: `${latest.source ?? author?.name ?? '누군가'}님이 댓글을 남겼어요`,
      target: mergeItems.find((item) => item.id === group.target.itemId)?.title ?? group.target.label,
      summary: latest.body,
    }
  }
  // An approval: "Alex approved … on Hero CTA". The target is only added
  // as the summary when the title doesn't already name it.
  // ("병합했어요 · CheckoutForm / Field gap": what was done is the title — "Jordan님이 병합했어요" — and what it was done
  // to, the meta line.)
  const said = /^(\S+했어요) · (.+)$/.exec(first.text)
  if (said) return { type: 'event', authorId: first.authorId, title: `${author?.name ?? '누군가'}님이 ${said[1]}`, target: said[2] }
  const named = first.text.includes(group.target.label)
  return { type: 'event', authorId: first.authorId, title: `${author?.name ?? ''} ${first.text}`.trim(), target: named ? null : group.target.label }
}

// One notification. Closed, every card is the same three things — title,
// a one-line summary, the time. Clicking opens it in place (the box grows
// downward) with what it's about: the description and file, the thread and
// its reply box, and the button that goes there.
// Under 오늘 / 어제 the day is already said: just the time ("10월 14일 오후 6:40" → "오후 6:40").
const timeIn = (label, day) => (day === 'today' || day === 'yesterday' ? String(label).replace(/^(\d{1,2}월 \d{1,2}일|[A-Z][a-z]{2} \d{1,2},?)\s*/, '') : label)

function InboxCard({ group, day, expanded, onToggle, conflicts, mergeItems, onJump }) {
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
  const notice = card.type === 'notice'
  const language = useLanguage()
  // The meta line: what it's on, then — for a change — when it's due (red when it's today or past).
  const due = notice && card.change?.dueLabel && card.change.reviewStage !== 'resolved' ? card.change.dueLabel : null
  const dueKo = due && translateText(due, 'ko')
  const dueText = due && (language === 'ko' ? (/마감|지남|초과/.test(dueKo) ? dueKo : `${dueKo} 마감`) : (/^due|overdue/i.test(due) ? due : `Due ${String(due).toLowerCase()}`))
  const meta = [
    card.target && { text: card.target },
    dueText && { text: dueText, tone: /today|overdue|지남/i.test(due) ? 'text-rose-300' : /tomorrow/i.test(due) ? 'text-amber-200/80' : null },
    card.type === 'thread' && card.comments.length >= 2 && { text: `${card.comments.length} comments` },
  ].filter(Boolean)

  return (
    // (A flat list: no box per notification — only the open one, and the one under the pointer, are lit.)
    <div data-inbox-card={group.unread ? 'unread' : 'read'} className={cn('rounded-[14px] transition-colors', expanded && 'bg-white/[0.04]')}>
      <button type="button" aria-expanded={expanded} onClick={onToggle} className={cn('flex w-full items-start gap-2 rounded-[14px] px-3 py-2.5 text-left transition-colors', !expanded && 'hover:bg-white/[0.04]')}>
        {/* Unread: a dot at the left (its place is kept when read, so the rows line up). */}
        <span aria-label={group.unread ? 'Unread' : undefined} data-inbox-dot={group.unread ? '' : undefined} className={cn('mt-2 size-1.5 shrink-0 rounded-full', group.unread ? 'bg-[#5EEAB5]' : 'bg-transparent')} />
        {!openThread && <span className="mt-0.5 flex w-5 shrink-0 justify-center">
          {/* A person's avatar, or — from the app — an icon in a circle the same size, so every row lines up. */}
          {card.authorId ? <Person id={card.authorId} size="xs" /> : (
            <span data-inbox-system-icon={card.severity ?? 'low'} aria-label={card.severity ? translateText(RISK_LABEL[card.severity], getLanguage()) : undefined} className="flex size-5 items-center justify-center rounded-full bg-white/[0.06]">
              {card.severity === 'high'
                ? <TriangleAlert aria-hidden className="size-2.5 text-rose-300" />
                : <Bell aria-hidden className={cn('size-2.5', card.severity === 'medium' ? 'text-amber-300' : 'text-slate-400')} />}
            </span>
          )}
        </span>}
        <span className="min-w-0 flex-1">
          {/* 1 — who did what, as a sentence, and when. */}
          <span className="flex min-w-0 items-baseline gap-2">
            <span data-inbox-title className={cn('min-w-0 flex-1 text-[13px] leading-5 font-medium', group.unread || expanded ? 'text-white' : 'text-slate-300', expanded ? 'break-words' : 'truncate')}><LocalizedText text={card.title} /></span>
            <span className="shrink-0 text-[11.5px] text-slate-500 tabular-nums"><LocalizedText text={timeIn(group.timeLabel, day)} /></span>
          </span>
          {/* 2 — what it's on, and when it's due: one quiet line. */}
          {meta.length > 0 && (
            <span data-inbox-meta className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11.5px] leading-4 text-slate-500">
              {meta.map((part, index) => (
                <Fragment key={index}>
                  {index > 0 && <span aria-hidden className="text-slate-600">·</span>}
                  <span className={cn(index === 0 ? 'min-w-0 truncate' : 'shrink-0', part.tone)}><LocalizedText text={part.text} /></span>
                </Fragment>
              ))}
            </span>
          )}
          {/* 3 — a comment's words, one line, while it's closed (open, the thread says them). */}
          {card.type === 'thread' && !expanded && card.summary && (
            <span data-inbox-preview className="mt-1 block min-w-0 truncate text-[12px] leading-4 text-slate-400"><LocalizedText text={card.summary} /></span>
          )}
          {(card.type === 'change' || card.type === 'changes') && (card.summary || card.severity) && (
            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11.5px] leading-4 text-slate-500">
              {card.severity && !card.summary && <span className={cn('shrink-0 font-medium', card.severity === 'high' ? 'text-rose-300' : 'text-slate-300')}><LocalizedText text={RISK_LABEL[card.severity]} /></span>}
              {card.summary && <span className="min-w-0 flex-1 truncate"><LocalizedText text={card.summary} /></span>}
            </span>
          )}
        </span>
        <span className="mt-1 flex shrink-0 items-center gap-1.5">
          <ChevronDown className={cn('size-3.5 text-slate-500 transition-[transform,opacity] duration-200', expanded ? 'rotate-180' : 'opacity-0 group-hover/inbox:opacity-100')} />
        </span>
      </button>

      {/* Opens by growing (grid rows 0fr → 1fr), so the cards under it
          slide down instead of jumping. */}
      <div className={cn('grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none', expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="min-h-0 overflow-hidden" inert={!expanded}>
          <div className={cn('space-y-3.5 pr-3 pb-3', card.type === 'thread' ? 'pl-3 pt-1' : notice ? 'pl-[50px]' : 'pl-[42px]')}>
            {notice && <NoticeBody card={card} destination={destination && { ...destination, label: '변경 검토하기' }} />}
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
  // Opened on what's new — with nothing new, on everything (never an empty first view of a full Inbox).
  const [tab, setTab] = useState(() => defaultTabOf(notifications))
  const [expandedId, setExpandedId] = useState(null)
  // (What was unread when the tab was opened stays listed there while it's read, one by one.)
  const [unreadIds, setUnreadIds] = useState(() => new Set(notifications.filter(isUnread).map(n => n.id)))
  const unread = notifications.filter(isUnread).length
  const groups = groupInboxNotifications(notifications)
  // Older ones come in as the list is scrolled to its end.
  const PAGE = 30
  const [limit, setLimit] = useState(PAGE)

  function pick(id) {
    setTab(id)
    setExpandedId(null)
    setLimit(PAGE)
    setUnreadIds(id === 'unread' ? new Set(notifications.filter(isUnread).map((n) => n.id)) : null)
  }
  function toggleGroup(group) {
    if (expandedId === group.id) { setExpandedId(null); return }
    setExpandedId(group.id)
    group.notifications.forEach(n => markNotificationRead(n.id))
  }
  // Unread: not read yet. All: everything, read or not. Approvals / Comments: their kind, read or not.
  const matching = groups.filter((group) => (tab === 'unread'
    ? group.notifications.some((n) => isUnread(n) || unreadIds?.has(n.id))
    : group.notifications.some((n) => showsIn(tab, n))))
    // Newest first.
    .sort((a, b) => Math.max(...b.notifications.map((n) => n.createdAt ?? 0)) - Math.max(...a.notifications.map((n) => n.createdAt ?? 0)))
  const visible = matching.slice(0, limit)
  const now = Date.now()
  const dayOf = (group) => dayGroupOf(Math.max(...group.notifications.map((n) => n.createdAt ?? now)), now)

  return (
    <MergeDrawer icon={Bell} title="Inbox" onClose={onClose} inset={inset} aside={
      // (Read, all of them — and the list stays as it is.)
      <button type="button" data-inbox-read-all onClick={() => markAllNotificationsRead()} disabled={unread === 0} className="flex h-7 shrink-0 items-center justify-center gap-1 rounded-full px-2.5 text-xs font-medium whitespace-nowrap text-slate-300 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40">
        <CheckCheck className="size-3.5" /> Mark all read
      </button>
    }>
      <div className="grid shrink-0 grid-cols-4 gap-1 px-3 pb-2" role="tablist" aria-label="Filter notifications">
        {tabs.map(([id, label]) => <button key={id} type="button" role="tab" data-inbox-tab={id} aria-selected={tab === id} onClick={() => pick(id)} className={cn(CATEGORY_TAB, 'min-w-0 w-full gap-1 px-1.5', tab === id ? CATEGORY_TAB_ACTIVE : CATEGORY_TAB_IDLE)}>
          <span className="truncate">{label}</span>
          {id === 'unread' && unread > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-400/20 px-1 text-[10px] leading-none font-semibold text-emerald-300 tabular-nums">{unread > 99 ? '99+' : unread}</span>}
        </button>)}
      </div>
      <div
        data-inbox-list
        className="scroll-fade-bottom min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 pb-3"
        onScroll={(event) => { const list = event.currentTarget; if (limit < matching.length && list.scrollTop + list.clientHeight >= list.scrollHeight - 80) setLimit((count) => count + PAGE) }}
      >
        {visible.map((group, index) => {
          const day = dayOf(group)
          return (
            <Fragment key={group.id}>
              {/* 오늘 / 어제 / 이번 주 / 이전 — said once, over the first of each. */}
              {(index === 0 || dayOf(visible[index - 1]) !== day) && <h3 data-inbox-day={day} className="flex h-7 items-center px-3 pt-2 text-[12px] font-semibold text-slate-400 first:pt-0">{DAY_GROUP_LABEL[day]}</h3>}
              <div className="group/inbox relative">
                <InboxCard group={group} day={day} expanded={expandedId === group.id} onToggle={() => toggleGroup(group)} conflicts={conflicts} mergeItems={mergeItems} onJump={onJump} />
                {/* (No read ↔ unread on each card: opening one reads it; the head's 모두 읽음으로 표시 reads them all.) */}
              </div>
            </Fragment>
          )
        })}
        {!visible.length && (
          <div data-inbox-empty={tab} className="flex flex-col items-center gap-2 p-6 text-center text-xs text-muted-foreground">
            <p>{tab === 'unread' ? '새 알림이 없어요' : notifications.length ? '여기에 해당하는 알림이 없어요' : '아직 받은 알림이 없어요'}</p>
            {tab === 'unread' && notifications.length > 0 && <button type="button" data-inbox-show-all onClick={() => pick('all')} className="ds-intrinsic text-xs font-medium text-emerald-300 underline-offset-2 hover:underline">전체 알림 보기</button>}
          </div>
        )}
      </div>
    </MergeDrawer>
  )
}

export default MergeInboxDrawer
