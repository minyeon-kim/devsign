import { useState } from 'react'
import { Bot, Check, Eye, GitBranch, GitMerge, GitCommitHorizontal, History, MessageSquareMore, RotateCcw, Undo2 } from 'lucide-react'
import { cn } from 'cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { allPeople } from '@/data/mockData'
import MergeDrawer from '@/components/mergestudio/MergeDrawer'

const kindMeta = {
  merge: { icon: GitMerge, label: 'Merge', className: 'bg-violet-500/15 text-violet-400' },
  branch: { icon: GitBranch, label: 'Branch', className: 'bg-indigo-500/15 text-indigo-400' },
  commit: { icon: GitCommitHorizontal, label: 'Commit', className: 'bg-muted text-muted-foreground' },
  review: { icon: MessageSquareMore, label: 'Review', className: 'bg-emerald-500/15 text-emerald-400' },
  ai: { icon: Bot, label: 'AI', className: 'bg-gradient-to-r from-indigo-500/20 to-violet-500/20 text-violet-400' },
  rollback: { icon: Undo2, label: 'Rollback', className: 'bg-amber-500/15 text-amber-500' },
}

// Version history / activity timeline: past merge events, branch logs and
// timestamps. "Preview" expands what changed at that point; "Rollback"
// (confirmed inline) restores that state and logs a rollback event.
function MergeHistoryDrawer({ events, currentId, onRollback, onClose }) {
  const [previewId, setPreviewId] = useState(null)
  const [confirmId, setConfirmId] = useState(null)

  return (
    <MergeDrawer icon={History} title="Version History" onClose={onClose}>
      <p className="shrink-0 px-4 pt-3 text-[11px] text-muted-foreground">
        Merge events, branches and reviews — newest first.
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="relative pl-6">
          <div className="absolute top-2 bottom-2 left-[11px] w-px bg-border" />
          {events.map((event) => {
            const meta = kindMeta[event.kind] ?? kindMeta.commit
            const Icon = meta.icon
            const author = allPeople.find((p) => p.id === event.authorId)
            const current = currentId === event.id
            const previewing = previewId === event.id
            return (
              <div key={event.id} className="relative mb-3.5 last:mb-0">
                <span
                  className={cn(
                    'absolute top-3 -left-6 flex size-[22px] items-center justify-center rounded-full ring-4 ring-card',
                    meta.className
                  )}
                >
                  <Icon className="size-3" />
                </span>

                <div
                  className={cn(
                    'rounded-2xl border p-3 transition-colors',
                    current ? 'border-primary bg-primary/10' : 'border-white/10 bg-slate-800/70'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 text-xs leading-snug font-semibold text-foreground">{event.title}</p>
                    {current && (
                      <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-primary px-2 py-0.5 text-[9px] font-semibold text-primary-foreground">
                        <Check className="size-2.5" />
                        Current
                      </span>
                    )}
                  </div>

                  <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <GitBranch className="size-3 shrink-0" />
                    <span className="truncate font-mono">{event.branch}</span>
                  </p>

                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Avatar size="sm" className="size-4">
                      <AvatarFallback className={cn('text-[7px] font-semibold text-white', author?.colorClass)}>
                        {author?.initials}
                      </AvatarFallback>
                    </Avatar>
                    {author?.name} · {event.time}
                  </div>

                  {previewing && (
                    <ul className="mt-2.5 space-y-1.5 rounded-xl bg-slate-800/70 p-2.5">
                      {event.changes.map((c) => (
                        <li key={c.label} className="text-[11px] leading-snug">
                          <span className="text-foreground">{c.label}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px]">
                            <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-destructive">{c.from}</span>
                            →
                            <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-emerald-400">{c.to}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-2.5 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPreviewId(previewing ? null : event.id)}
                      className={cn(
                        'flex items-center justify-center gap-1 rounded-full border px-2.5 h-6 text-[10px] font-medium transition-colors',
                        previewing ? 'border-indigo-500/60 bg-indigo-500/15 text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Eye className="size-3" />
                      {previewing ? 'Hide preview' : 'Preview'}
                    </button>

                    {!current &&
                      event.kind !== 'rollback' &&
                      (confirmId === event.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              onRollback(event)
                              setConfirmId(null)
                            }}
                            className="flex items-center justify-center gap-1 rounded-full bg-slate-700 px-2.5 h-6 text-[10px] font-semibold text-white transition-colors hover:bg-slate-600"
                          >
                            <RotateCcw className="size-3" />
                            Confirm rollback
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId(null)}
                            className="inline-flex items-center justify-center rounded-full px-2 h-6 text-[10px] text-muted-foreground hover:text-foreground"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmId(event.id)}
                          className="flex items-center justify-center gap-1 rounded-full border px-2.5 h-6 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <RotateCcw className="size-3" />
                          Rollback
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </MergeDrawer>
  )
}

export default MergeHistoryDrawer
