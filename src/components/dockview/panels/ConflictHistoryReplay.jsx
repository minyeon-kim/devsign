import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, Clock3, Code2, Eye, GitMerge, History, MessageSquare, RotateCcw, Send, XCircle } from 'lucide-react'
import { cn } from 'cn'
import { activities, allPeople } from '@/data/mockData'
import { diffLines } from '@/lib/lineDiff'
import { deriveComponentOverride } from '@/lib/prototypeSync'
import { LocalizedText } from '@/i18n/runtime'
import HistoryTimeline from '@/components/history/HistoryTimeline'
import PreviewPanelContent from '@/components/dockview/panels/PreviewPanelContent'
import { useConflictStore } from '@/state/ConflictStore'
import { NAV_BUTTON, NAV_BUTTON_ICON } from '@/components/conflicts/ConflictBadges'
import { foldConflictCheckpoints, withBranches } from '@/lib/historyBranches'

const EVENT_COPY = {
  review_requested: { action: 'requested a review', Icon: Send },
  approve: { action: 'approved this change', Icon: Check },
  changes: { action: 'requested changes', Icon: MessageSquare },
  dismiss: { action: 'dismissed a change request', Icon: XCircle },
  merge: { action: 'merged this change', Icon: GitMerge },
  reopened: { action: 'reopened this conflict', Icon: RotateCcw },
  revert: { action: 'opened a revert of this change', Icon: RotateCcw },
  code_change: { action: 'pushed code changes', Icon: Code2 },
  comment: { action: 'commented on this conflict', Icon: MessageSquare },
}

const REPLAY_PANE_LABEL = 'flex h-6 shrink-0 items-center gap-1 px-3 text-[10.5px] font-medium text-slate-400'

function conflictEvents(conflict, events, historyEntries) {
  const issueCheckpoint = [...historyEntries].reverse().find((entry) => entry.kind === 'conflict'
    && (entry.conflictId === conflict.id || entry.conflictIds?.includes(conflict.id)))
  const mergeCheckpoint = [...historyEntries].reverse().find((entry) => entry.kind === 'merge'
    && (entry.conflictId === conflict.id || entry.conflictIds?.includes(conflict.id)))
  const saved = events
    .filter((event) => event.conflictId === conflict.id && event.projectId === conflict.projectId)
    .map((event, index) => {
      const eventCopy = EVENT_COPY[event.kind] ?? { action: event.kind, Icon: History }
      const person = allPeople.find((candidate) => candidate.id === event.actorId)
      return {
        id: event.id,
        action: eventCopy.action,
        icon: eventCopy.Icon,
        actor: event.actorId === 'system' ? 'Devsign' : person?.name ?? event.actorId ?? 'Devsign',
        timestamp: event.timeLabel,
        detail: event.detail,
        historyId: event.historyId ?? (event.kind === 'merge' ? mergeCheckpoint?.id : issueCheckpoint?.id),
        createdAt: event.createdAt ?? 0,
        sequence: index,
      }
    })
    .sort((a, b) => b.createdAt - a.createdAt || a.sequence - b.sequence)

  const seeded = activities
    .filter((activity) => activity.conflictId === conflict.id && activity.projectId === conflict.projectId)
    .map((activity) => ({
      id: activity.id,
      action: activity.action,
      icon: activity.type === 'comment' ? MessageSquare : activity.type === 'merge' ? GitMerge : History,
      actor: activity.actorName ?? 'Devsign',
      timestamp: activity.timestamp,
      historyId: activity.historyId ?? (activity.type === 'merge' ? mergeCheckpoint?.id : issueCheckpoint?.id),
    }))

  if (!saved.length && !seeded.length && issueCheckpoint) {
    return [{
      id: `activity-${conflict.id}`,
      action: 'was recorded in History',
      icon: History,
      actor: issueCheckpoint.actorLabel ?? 'Devsign',
      timestamp: issueCheckpoint.timestamp ?? issueCheckpoint.label,
      historyId: issueCheckpoint.id,
    }]
  }
  return [...saved, ...seeded]
}

function snapshotLines(entry, conflict) {
  const snapshot = entry?.snapshot
  if (!snapshot) return []
  const fileId = conflict.fileId ?? snapshot.fileId
  const targetLines = fileId ? snapshot.files?.[fileId] : null
  if (Array.isArray(targetLines)) return targetLines
  const availableFileLines = Object.values(snapshot.files ?? {}).find(Array.isArray)
  if (availableFileLines) return availableFileLines
  if (Array.isArray(snapshot.lines)) return snapshot.lines
  return []
}

// "Conflict activity": the conflict's own trail, inside its review — named
// apart from the sidebar's History on purpose.
//
// The sidebar's History is the project's archive: every saved version, to
// look back over. This is the opposite end: only what bears on the one
// conflict being settled right now, laid out for deciding it —
//   · Conversation — the requests, sign-offs and comments on it, in order,
//     each tied to the step it belongs to;
//   · Step replay — the change itself, step by step: the version that
//     caused it, its detection, and its merge.
// (Who was asked to approve and where they stand is the Reviewers panel
// beside it.)
// `onOpenProjectHistory` is the one way out to the archive, for when the
// wider picture is what's needed.
function ConflictHistoryReplay({ conflict, workspace, onOpenProjectHistory }) {
  const { events } = useConflictStore()
  const activity = useMemo(() => conflictEvents(conflict, events, workspace?.historyEntries ?? []), [conflict, events, workspace?.historyEntries])
  const entries = useMemo(() => {
    const all = (workspace?.historyEntries ?? []).filter((entry) => !entry.archived)
    const linked = all.filter((entry) => entry.conflictId === conflict.id || entry.conflictIds?.includes(conflict.id))
    // The replay starts one step earlier than the issue's own checkpoints:
    // at the saved version that caused it.
    const cause = foldConflictCheckpoints(withBranches(all, workspace?.conflicts ?? []))
      .find((version) => version.conflictMarks.some((mark) => mark.conflictId === conflict.id))
    const causeEntry = cause && !linked.some((entry) => entry.id === cause.id) ? all.find((entry) => entry.id === cause.id) : null
    return causeEntry ? [causeEntry, ...linked] : linked
  }, [conflict.id, workspace?.historyEntries, workspace?.conflicts])
  // What people said on it (its thread), for the log.
  const remarks = useMemo(() => (workspace?.comments ?? [])
    .filter((comment) => comment.id === conflict.linkedCommentId || comment.target?.conflictId === conflict.id)
    .map((comment) => ({
      id: `comment-${comment.id}`,
      action: comment.target?.replyTo ? 'replied' : 'commented',
      icon: MessageSquare,
      actor: allPeople.find((person) => person.id === comment.authorId)?.name ?? 'Devsign',
      timestamp: comment.timeLabel,
      detail: comment.text,
      remark: true,
    })), [workspace?.comments, conflict.id, conflict.linkedCommentId])
  const log = [...activity, ...remarks]
  const [selectedId, setSelectedId] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [compareLatest, setCompareLatest] = useState(true)
  const foundIndex = entries.findIndex((entry) => entry.id === selectedId)
  const selectedIndex = foundIndex < 0 ? Math.max(0, entries.length - 1) : foundIndex
  const selected = entries[selectedIndex] ?? null
  const latest = entries.at(-1) ?? null
  const selectedLines = snapshotLines(selected, conflict)
  const latestLines = snapshotLines(latest, conflict)
  const rows = useMemo(() => {
    if (!compareLatest || !selected || selected === latest) {
      return selectedLines.map((text) => ({ kind: 'same', text }))
    }
    return diffLines(latestLines, selectedLines)
  }, [compareLatest, latest, latestLines, selected, selectedLines])

  useEffect(() => {
    if (!playing) return undefined
    const timer = window.setTimeout(() => {
      if (selectedIndex < entries.length - 1) setSelectedId(entries[selectedIndex + 1].id)
      else setPlaying(false)
    }, 900)
    return () => window.clearTimeout(timer)
  }, [entries, playing, selectedIndex])

  const replayEntries = useMemo(
    () => entries.map((entry) => ({
      ...entry,
      timestamp: entry.timestamp ?? entry.label,
    })),
    [entries]
  )

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      {/* What this view is — and isn't: this conflict's activity, named
          apart from the sidebar's project History (the version archive),
          which is one click away. */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-white/[0.03] px-3 py-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sky-400/15 text-sky-300"><History className="size-3.5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white"><LocalizedText text="Conflict activity" /> <span className="font-normal text-slate-400">· <LocalizedText text={conflict.title} /></span></p>
        </div>
        {onOpenProjectHistory && (
          <button type="button" onClick={onOpenProjectHistory} className={NAV_BUTTON}>
            <LocalizedText text="Project history" />
            <ArrowRight className={NAV_BUTTON_ICON} />
          </button>
        )}
      </div>
    <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.5fr)]">
      <div className="flex min-h-0 flex-col gap-3">
      {/* (Who was asked and where they stand is the Reviewers panel on the
          right — with the approval count in its title — not repeated here.) */}
      <section aria-label="Conversation" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-white/[0.03]">
        <div className="flex shrink-0 items-center gap-2 px-3 py-3">
          <MessageSquare className="size-3.5 text-slate-500" />
          <h3 className="text-xs font-medium text-slate-300"><LocalizedText text="Conversation" /></h3>
          <span className="ml-auto text-[11px] tabular-nums text-slate-500">
            {log.length}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {log.length ? (
            <ol className="space-y-1">
              {log.map(({ id, action, actor, timestamp, detail, icon: Icon, historyId, remark }, index) => {
                // (A comment isn't a step of the change — it has no replay point.)
                const replayEntry = remark ? null : entries.find((entry) => entry.id === historyId || entry.id === id)
                  ?? (entries.length ? entries[Math.max(0, Math.round((activity.length - 1 - index) * (entries.length - 1) / Math.max(activity.length - 1, 1)))] : null)
                const isCurrentMarker = replayEntry && replayEntry.id === selected?.id
                return (
                  <li key={id}>
                    <button type="button" disabled={!replayEntry} onClick={() => { if (replayEntry) { setPlaying(false); setSelectedId(replayEntry.id) } }} aria-pressed={Boolean(isCurrentMarker)} className="flex w-full items-start gap-2.5 rounded-lg py-2 pr-4 pl-2 text-left transition-colors hover:bg-white/[0.04] disabled:cursor-default disabled:hover:bg-transparent aria-pressed:bg-emerald-400/[0.06]">
                      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-slate-400">
                        <Icon className="size-3" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs leading-5 text-slate-300">
                          <span className="font-medium text-slate-100">{actor}</span>{' '}
                          <LocalizedText text={action} />
                        </span>
                        {detail && <span className="mt-0.5 block line-clamp-2 text-[11px] leading-4 text-slate-400">{detail}</span>}
                        <span className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500">
                          <Clock3 className="size-3" />
                          <LocalizedText text={timestamp} />
                        </span>
                      </span>
                      {replayEntry && <span title={isCurrentMarker ? 'Replay marker selected' : 'Open this point in change replay'} className={cn('mt-2 size-2 shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-[#171719]', isCurrentMarker ? 'bg-emerald-300 ring-emerald-300/25' : 'bg-slate-500 ring-slate-500/15')} />}
                    </button>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="px-1 py-3 text-xs text-slate-500"><LocalizedText text="No activity has been recorded for this conflict yet." /></p>
          )}
        </div>
      </section>
      </div>

      <section aria-label="Conflict change replay" className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl bg-white/[0.03]">
        <div className="flex shrink-0 items-center gap-2 px-3 py-3">
          <History className="size-3.5 text-slate-500" />
          <h3 className="text-xs font-medium text-slate-300"><LocalizedText text="Step replay" /></h3>
          {selected && <span className="shrink-0 rounded bg-white/[0.07] px-1.5 py-0.5 text-[10.5px] leading-none font-medium text-slate-300 tabular-nums">{selectedIndex + 1}/{entries.length}</span>}
          {selected && <span className="min-w-0 flex-1 truncate text-[11px] text-slate-400">{selected.label}</span>}
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          {selected ? (
            // Code and its preview together, half the replay each — the
            // checkpoint's code and what it renders are read as a pair.
            <div className="grid h-full min-h-0 grid-cols-2">
            <div role="group" aria-label="Code" className="flex min-h-0 min-w-0 flex-col">
            <p className={REPLAY_PANE_LABEL}><Code2 className="size-3" /><LocalizedText text="Code" /></p>
            <div className="min-h-0 flex-1 overflow-auto pb-2 font-mono text-[10px] leading-relaxed">
              {rows.length ? rows.map((row, index) => (
                <div key={`${row.kind}-${index}`} className={cn('flex min-w-0 px-3 whitespace-pre-wrap [word-break:break-all]', row.kind === 'add' ? 'bg-emerald-500/[0.18] text-emerald-300' : row.kind === 'remove' ? 'bg-red-500/[0.18] text-red-300' : 'text-slate-500')}>
                  <span className="w-4 shrink-0 select-none opacity-70">{row.kind === 'add' ? '+' : row.kind === 'remove' ? '−' : ' '}</span>
                  <span className="min-w-0 flex-1 whitespace-pre-wrap [word-break:break-all]">{row.text || ' '}</span>
                </div>
              )) : <p className="px-3 py-4 text-xs font-sans text-slate-500">This replay checkpoint has no code snapshot.</p>}
            </div>
            </div>
            <div role="group" aria-label="Preview" className="flex min-h-0 min-w-0 flex-col border-l border-white/[0.06]">
            <p className={REPLAY_PANE_LABEL}><Eye className="size-3" /><LocalizedText text="Preview" /></p>
            <div className="min-h-0 flex-1">
            <PreviewPanelContent
              key={`conflict-replay-${selected.id}`}
              previewProps={selected.snapshot?.previewProps}
              // The whole screen at this checkpoint, not a sample of the
              // changed element: checkpoints without their own edits get
              // them from that checkpoint's code (see lib/prototypeSync).
              prototypeEdits={selected.snapshot?.prototypeEdits
                ?? deriveComponentOverride(conflict.projectId, conflict.fileId ?? selected.snapshot?.fileId, selectedLines)
                ?? {}}
              activePageId={selected.snapshot?.activePageId}
              frames={selected.snapshot?.mergeOutput?.design?.frame ? [selected.snapshot.mergeOutput.design.frame] : undefined}
              historical
              snapshotKey={selected.id}
              embedded
            />
            </div>
            </div>
            </div>
          ) : (
            <p className="px-4 py-5 text-xs text-slate-500">
              <LocalizedText text="No replay snapshots are linked to this conflict yet. Review and comment activity will still appear in the timeline." />
            </p>
          )}
        </div>
        {entries.length > 0 && (
          <HistoryTimeline
            compact
            entries={replayEntries}
            selectedId={selected?.id}
            onSelect={(id) => { setPlaying(false); setSelectedId(id) }}
            playing={playing}
            onTogglePlay={() => {
              if (!playing && selectedIndex >= entries.length - 1 && entries[0]) {
                setSelectedId(entries[0].id)
              }
              setPlaying((current) => !current)
            }}
            compareLatest={compareLatest}
            onCompareLatestChange={setCompareLatest}
            isCurrent
            hideRestore
          />
        )}
      </section>
    </div>
    </div>
  )
}

export default ConflictHistoryReplay
