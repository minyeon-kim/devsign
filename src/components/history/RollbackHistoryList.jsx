import { useEffect, useRef, useState } from 'react'
import { Archive, ArchiveRestore, GitCommitHorizontal, RotateCcw, Sparkles } from 'lucide-react'
import { cn } from 'cn'
import { toast } from 'sonner'
import {
  ACCENT_SOFT,
  CATEGORY_TAB,
  CATEGORY_TAB_ACTIVE,
  CATEGORY_TAB_IDLE,
  GHOST_BUTTON,
} from '@/components/mergestudio/floatingStyles'
import { useWorkspace } from '@/state/WorkspaceProvider'

// The workspace's version history, drawn exactly like Merge Studio's
// Version History drawer (MergeHistoryDrawer) so every History surface in
// the app reads as one design — the Agent Log modal, the conflict review
// window's History tab and Archive → History all use this list:
//   · newest first, each entry a node strung on one vertical track (like a
//     commit graph) instead of bordered cards;
//   · a soft tint on the live version, with its mint "Current" tag;
//   · ghost actions (Roll back, Archive) revealed on hover, and rolling
//     back asks for a one-line inline confirmation;
//   · pill category tabs (Active / Archived) like the Inbox's filters.
// Passing `onSelect` turns a row click into selecting it (`selectedId`)
// instead — Archive's History view compares the selection first and
// restores it from there.

function EmptyState({ message }) {
  return <p className="rounded-xl bg-white/[0.03] px-4 py-8 text-center text-xs text-slate-500">{message}</p>
}

function GhostAction({ title, active, onClick, children }) {
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
        active
          ? 'bg-white/[0.08] text-white opacity-100'
          : 'text-slate-400 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-white/[0.06] hover:text-white'
      )}
    >
      {children}
    </button>
  )
}

// Node center, from the top of an entry: 16px padding + half of 28px.
const NODE_Y = 30

function HistoryEntry({ entry, current, selected, highlighted, confirming, isFirst, isLast, onClick, onAskRollback, onCancelRollback, onRollback, onArchive, entryRef }) {
  const Icon = entry.prompt ? Sparkles : GitCommitHorizontal

  return (
    <article
      ref={entryRef}
      role="button"
      tabIndex={0}
      aria-pressed={selected || undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className="group relative cursor-pointer py-4 outline-none"
    >
      {/* Full-bleed surface: a soft lift on hover/focus, a touch more on the
          live or selected version, a mint wash on a deep-linked one. */}
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-0 -right-3 -left-3 rounded-lg transition-colors',
          highlighted
            ? 'bg-emerald-400/[0.07]'
            : current || selected
              ? 'bg-white/[0.04]'
              : 'group-hover:bg-white/[0.025] group-focus-visible:bg-white/[0.025]'
        )}
      />
      {!(isFirst && isLast) && (
        <span
          aria-hidden
          className="absolute left-[13.5px] w-px bg-white/[0.12]"
          style={{ top: isFirst ? NODE_Y : 0, bottom: isLast ? undefined : 0, height: isLast ? NODE_Y : undefined }}
        />
      )}

      <div className="relative flex items-start gap-3">
        <span
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-full ring-4 ring-[var(--card)]',
            current ? 'bg-emerald-400 text-slate-950' : 'bg-[#2a2a30] text-slate-300'
          )}
        >
          <Icon className="size-3.5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex h-7 items-center gap-2">
            <span className="shrink-0 text-xs text-slate-500">{entry.prompt ? 'AI edit' : 'Saved'}</span>
            {current && <span className={cn('shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold', ACCENT_SOFT)}>Current</span>}
            <span className="ml-auto shrink-0 text-[11px] text-slate-500 tabular-nums">{entry.timestamp}</span>
            {!current && (
              <span className="-mr-1.5 flex shrink-0 items-center">
                <GhostAction title="Roll back to this version" active={confirming} onClick={onAskRollback}>
                  <RotateCcw className="size-3.5" />
                </GhostAction>
                <GhostAction title="Archive this entry" onClick={onArchive}>
                  <Archive className="size-3.5" />
                </GhostAction>
              </span>
            )}
          </div>
          <p className="text-[13px] leading-relaxed text-white">{entry.label}</p>
          {entry.prompt && <p className="mt-1 truncate text-xs text-slate-500">“{entry.prompt}”</p>}

          {confirming && (
            <div className="mt-3 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <span className="min-w-0 flex-1 text-xs text-slate-300">Roll back to this version?</span>
              <button
                type="button"
                onClick={onCancelRollback}
                className="flex h-7 items-center rounded-full px-2.5 text-xs text-slate-400 transition-colors hover:text-white"
              >
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

function RollbackHistoryList({ onRollback, highlightId, selectedId, onSelect }) {
  const { historyEntries, activeHistoryId, rollbackTo, archiveHistoryEntry, restoreHistoryEntry } = useWorkspace()
  const [confirmId, setConfirmId] = useState(null)

  const active = [...historyEntries].filter((e) => !e.archived).reverse()
  const archived = [...historyEntries].filter((e) => e.archived).reverse()
  const [tab, setTab] = useState(() => (archived.some((e) => e.id === highlightId) ? 'archived' : 'active'))

  // Deep-linked from the Workspace's "view change history" action — scroll
  // the referenced record into view (it's tinted mint, see HistoryEntry).
  const refs = useRef(new Map())
  useEffect(() => {
    if (!highlightId) return
    refs.current.get(highlightId)?.scrollIntoView({ block: 'center' })
  }, [highlightId])

  function setRef(id) {
    return (el) => {
      if (el) refs.current.set(id, el)
      else refs.current.delete(id)
    }
  }

  function rollback(id) {
    rollbackTo(id)
    setConfirmId(null)
    onRollback?.(id)
  }

  function handleArchive(entry) {
    archiveHistoryEntry(entry.id)
    toast('Archived from history', {
      description: entry.label,
      action: { label: 'Undo', onClick: () => restoreHistoryEntry(entry.id) },
    })
  }

  function handleRestore(entry) {
    restoreHistoryEntry(entry.id)
    toast('Restored to active history', { description: entry.label })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1 pb-2" role="tablist" aria-label="History">
        {[
          ['active', 'Active', null],
          ['archived', 'Archived', archived.length || null],
        ].map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(CATEGORY_TAB, 'gap-1.5', tab === id ? CATEGORY_TAB_ACTIVE : CATEGORY_TAB_IDLE)}
          >
            {label}
            {count && <span className="text-[10px] text-slate-500 tabular-nums">{count}</span>}
          </button>
        ))}
      </div>

      {tab === 'active' &&
        (active.length === 0 ? (
          <EmptyState message="No history yet." />
        ) : (
          <div className="px-3">
            {active.map((entry, i) => {
              const current = entry.id === activeHistoryId
              return (
                <HistoryEntry
                  key={entry.id}
                  entryRef={setRef(entry.id)}
                  entry={entry}
                  current={current}
                  selected={Boolean(onSelect) && entry.id === selectedId}
                  highlighted={entry.id === highlightId}
                  confirming={confirmId === entry.id}
                  isFirst={i === 0}
                  isLast={i === active.length - 1}
                  // Selecting (Archive's compare view) or, elsewhere,
                  // asking to roll back — never an instant rollback.
                  onClick={() => (onSelect ? onSelect(entry.id) : !current && setConfirmId((id) => (id === entry.id ? null : entry.id)))}
                  onAskRollback={() => setConfirmId((id) => (id === entry.id ? null : entry.id))}
                  onCancelRollback={() => setConfirmId(null)}
                  onRollback={() => rollback(entry.id)}
                  onArchive={() => handleArchive(entry)}
                />
              )
            })}
          </div>
        ))}

      {tab === 'archived' &&
        (archived.length === 0 ? (
          <EmptyState message="No archived history yet." />
        ) : (
          <div className="flex flex-col gap-1">
            {archived.map((entry) => (
              <div
                key={entry.id}
                ref={setRef(entry.id)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-white/[0.025]',
                  entry.id === highlightId && 'bg-emerald-400/[0.07]'
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-slate-300">{entry.label}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">{entry.timestamp}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRestore(entry)}
                  className={cn('inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-medium', GHOST_BUTTON)}
                >
                  <ArchiveRestore className="size-3" />
                  Restore
                </button>
              </div>
            ))}
          </div>
        ))}
    </div>
  )
}

export default RollbackHistoryList
