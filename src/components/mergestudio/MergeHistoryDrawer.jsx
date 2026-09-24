import { useState } from 'react'
import { Bot, GitBranch, GitCommitHorizontal, GitMerge, History, MessageSquareMore, RotateCcw, Undo2 } from 'lucide-react'
import { cn } from 'cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { allPeople } from '@/data/mockData'
import MergeDrawer from '@/components/mergestudio/MergeDrawer'
import { ACCENT_SOFT, GHOST_BUTTON, PANEL_ROWS, PANEL_SURFACE } from '@/components/mergestudio/floatingStyles'

// What happened, as a glyph on the author's avatar and a short verb.
const kindMeta = {
  merge: { icon: GitMerge, verb: 'Merged' },
  branch: { icon: GitBranch, verb: 'Branched' },
  commit: { icon: GitCommitHorizontal, verb: 'Committed' },
  review: { icon: MessageSquareMore, verb: 'Reviewed' },
  ai: { icon: Bot, verb: 'AI assist' },
  rollback: { icon: Undo2, verb: 'Rolled back' },
}

// A ghost icon action in an entry's header (Rollback). Hidden until the
// entry is hovered or focused (or the action is in use), so the stream
// reads as avatars + titles first. Doesn't toggle the entry's details.
function EntryAction({ title, active, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cn(
        'flex size-7 items-center justify-center rounded-full transition-[opacity,background-color,color] focus-visible:opacity-100',
        active ? 'bg-white/[0.08] text-white opacity-100' : 'text-slate-400 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-white/[0.06] hover:text-white'
      )}
    >
      {children}
    </button>
  )
}

// Avatar center, from the top of an entry: 20px padding + half of 32px.
const NODE_Y = 36

// One history entry, on the Inbox feed's grid (the studio's reference): a
// 32px avatar node on the timeline track, carrying the event glyph, then
//   header  — author ··· time (+ "Current" on the live version) and the
//             hover-revealed Rollback ghost action;
//   context — what kind of event, on which branch (quiet, mono branch);
//   message — the event title, in white, like a comment body.
// The whole entry is the click target: anywhere on it toggles what changed
// at that point (no separate preview button). Rollback asks for a one-line
// inline confirmation.
function HistoryEntry({ event, current, previewing, confirming, isFirst, isLast, onPreview, onAskRollback, onCancelRollback, onRollback }) {
  const meta = kindMeta[event.kind] ?? kindMeta.commit
  const Icon = meta.icon
  const author = allPeople.find((p) => p.id === event.authorId)
  const canRollback = !current && event.kind !== 'rollback'

  return (
    <article
      role="button"
      tabIndex={0}
      aria-expanded={previewing}
      onClick={onPreview}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onPreview()
        }
      }}
      className="group relative cursor-pointer py-5 outline-none"
    >
      {/* Full-bleed card surface (the content stays on the 20px inset): a
          soft lift on hover / keyboard focus, a touch more while open, and
          the accent bar on the live version. */}
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-0 -right-5 -left-5 transition-colors',
          current || previewing ? 'bg-white/[0.035]' : 'group-hover:bg-white/[0.025] group-focus-visible:bg-white/[0.025]'
        )}
      />
      {current && <span aria-hidden className="absolute inset-y-0 -left-5 w-[3px] bg-emerald-400" />}
      {/* Timeline track: this entry's segment of one continuous line through
          the avatar nodes — from the first node down to the last. */}
      {!(isFirst && isLast) && (
        <span
          aria-hidden
          className="absolute left-[15.5px] w-px bg-white/[0.12]"
          style={{ top: isFirst ? NODE_Y : 0, bottom: isLast ? undefined : 0, height: isLast ? NODE_Y : undefined }}
        />
      )}
      <div className="relative flex items-start gap-3">
        <span className="relative flex w-8 shrink-0 justify-center">
          {/* The node: the avatar, ringed in the drawer's surface so the
              track reads as passing behind it. */}
          <Avatar className="ring-4 ring-[var(--card)]">
            <AvatarFallback className={cn('text-[11px] font-semibold text-white', author?.colorClass)}>{author?.initials}</AvatarFallback>
          </Avatar>
          <span
            title={meta.verb}
            className="absolute -right-1 -bottom-1 flex size-[18px] items-center justify-center rounded-full bg-[#2a2a30] text-slate-300 ring-2 ring-[var(--card)]"
          >
            <Icon className="size-2.5" />
          </span>
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex h-7 items-center gap-2">
            <span className="min-w-0 truncate text-[13px] font-medium text-slate-100">{author?.name}</span>
            {current && <span className={cn('shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold', ACCENT_SOFT)}>Current</span>}
            <span className="ml-auto shrink-0 text-[11px] text-slate-500 tabular-nums">{event.time}</span>
            {canRollback && (
              <span className="-mr-1.5 flex shrink-0 items-center">
                <EntryAction title="Roll back to this version" active={confirming} onClick={onAskRollback}>
                  <RotateCcw className="size-3.5" />
                </EntryAction>
              </span>
            )}
          </div>

          <p className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
            <span className="shrink-0">{meta.verb}</span>
            <span aria-hidden>·</span>
            <span className="truncate font-mono text-[11px]">{event.branch}</span>
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-[#FFFFFF]">{event.title}</p>

          {previewing && (
            <ul className={cn(PANEL_SURFACE, PANEL_ROWS, 'mt-3')}>
              {event.changes.map((c) => (
                <li key={c.label} className="px-3 py-2.5">
                  <p className="truncate text-xs text-slate-200" title={c.label}>
                    {c.label}
                  </p>
                  <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px]">
                    <span className="truncate text-slate-500 line-through decoration-slate-600">{c.from}</span>
                    <span aria-hidden className="shrink-0 text-slate-600">→</span>
                    <span className="truncate font-medium text-emerald-300">{c.to}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}

          {confirming && (
            // Its own controls — clicks here don't toggle the entry.
            <div className="mt-3 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <span className="min-w-0 flex-1 text-xs text-slate-300">Roll back to this version?</span>
              <button type="button" onClick={onCancelRollback} className="flex h-7 items-center rounded-full px-2.5 text-xs text-slate-400 transition-colors hover:text-white">
                Cancel
              </button>
              <button type="button" onClick={onRollback} className={cn('flex h-7 items-center gap-1 rounded-full px-3 text-xs font-medium', GHOST_BUTTON)}>
                <RotateCcw className="size-3" />
                Roll back
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

// Version history as a comment-stream timeline (same rhythm as the Inbox):
// newest first, the entries' avatars strung on one vertical track (like a
// commit graph) instead of hairline dividers, the live version marked with
// the accent bar. Preview expands what changed at that point; Rollback
// (confirmed inline) restores that state and logs a rollback entry.
function MergeHistoryDrawer({ events, currentId, onRollback, onClose }) {
  const [previewId, setPreviewId] = useState(null)
  const [confirmId, setConfirmId] = useState(null)

  return (
    <MergeDrawer icon={History} title="Version History" onClose={onClose}>
      <p className="shrink-0 px-5 pb-1 text-xs text-slate-500">Merges, branches and reviews — newest first.</p>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2">
        {events.map((event, i) => (
          <HistoryEntry
            key={event.id}
            event={event}
            isFirst={i === 0}
            isLast={i === events.length - 1}
            current={currentId === event.id}
            previewing={previewId === event.id}
            confirming={confirmId === event.id}
            onPreview={() => setPreviewId((id) => (id === event.id ? null : event.id))}
            onAskRollback={() => setConfirmId((id) => (id === event.id ? null : event.id))}
            onCancelRollback={() => setConfirmId(null)}
            onRollback={() => {
              onRollback(event)
              setConfirmId(null)
            }}
          />
        ))}
      </div>
    </MergeDrawer>
  )
}

export default MergeHistoryDrawer
