import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, ChevronDown, Code2, Eye, GitMerge, History, MessageSquare, RotateCcw, Send, XCircle } from 'lucide-react'
import { cn } from 'cn'
import { activities, allPeople } from '@/data/mockData'
import { diffLines } from '@/lib/lineDiff'
import { deriveComponentOverride } from '@/lib/prototypeSync'
import { LocalizedText } from '@/i18n/runtime'
import HistoryTimeline from '@/components/history/HistoryTimeline'
import PreviewPanelContent from '@/components/dockview/panels/PreviewPanelContent'
import { useConflictStore } from '@/state/ConflictStore'
import { foldConflictCheckpoints, withBranches } from '@/lib/historyBranches'
import { DecisionSummary, ReasonStrip } from '@/components/conflicts/Rationale'
import { mergeEvidence, stepRationale } from '@/lib/rationale'

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

// A system event as the few words its one-line group uses: "Taylor, Alex
// approved · Just now".
const GROUP_LABEL = {
  review_requested: 'asked for review',
  approve: 'gave approval',
  changes: 'asked for changes',
  dismiss: 'dismissed a request',
  merge: 'merged it',
  reopened: 'reopened it',
  revert: 'asked to revert',
  code_change: 'changed the code',
  detected: 'found a difference',
  comment: 'commented',
}
// A seeded activity is worded as a sentence ("requested your review on");
// it joins the group of the event it is.
const SEEDED_KIND = [
  [/requested .*review/, 'review_requested'],
  [/requested changes/, 'changes'],
  [/^approved/, 'approve'],
  [/^merged/, 'merge'],
  [/flagged|detected/, 'detected'],
  [/commented/, 'comment'],
]

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
        kind: event.kind,
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
      seeded: true,
      kind: SEEDED_KIND.find(([pattern]) => pattern.test(activity.action))?.[1] ?? `seed:${activity.action}`,
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

// A step's name in the replay header: what happened, without the conflict's
// title or description (the page header and the review have those). The
// conflict's own checkpoints are named by kind — for a revert, its detection
// is the revert being requested; a saved version keeps its own name.
function stepName(entry, conflict) {
  if (entry?.kind === 'conflict') return conflict.revertOf ? 'Revert requested' : 'Conflict detected'
  if (entry?.kind === 'merge') return 'Merged'
  return entry?.label ?? ''
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

// Activity hierarchy: decision summary, full-width replay, compact system
// events. The review's right-hand sidebar owns the comment thread.
function ConflictHistoryReplay({ conflict, workspace, rationale, onOpenEvidence, onOpenProjectHistory }) {
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
  // Comments live in the right-hand thread; decision reasons live in the
  // summary. Only compact system events belong below the replay.
  const groups = useMemo(() => {
    const byKind = new Map()
    activity.forEach((item, index) => {
      if (item.kind === 'comment') return
      const group = byKind.get(item.kind) ?? { kind: item.kind, label: GROUP_LABEL[item.kind] ?? item.action, icon: item.icon, timestamp: item.timestamp, actors: [], items: [] }
      if (!group.actors.includes(item.actor)) {
        group.actors.push(item.actor)
        group.items.push({ ...item, index })
      }
      byKind.set(item.kind, group)
    })
    return [...byKind.values()]
  }, [activity])
  const [openGroup, setOpenGroup] = useState(null)
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

  const step = rationale && selected ? stepRationale(selected, conflict, rationale) : null
  // Shared sources stay in the summary; only step-specific additions repeat here.
  const stepEvidence = mergeEvidence(rationale?.evidence, step?.evidence)
    .slice(mergeEvidence(rationale?.evidence).length)

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto">
    {/* The decision first — what, why, the evidence, who — then its trail. */}
    {rationale && <DecisionSummary rationale={rationale} onOpen={onOpenEvidence} />}
      <div className={cn('grid min-h-[280px] min-w-0 flex-1 grid-cols-1 gap-3', groups.length > 0 && 'xl:grid-cols-[240px_minmax(0,1fr)]')}>
      {groups.length > 0 && (
        <section aria-label="System activity" className="min-h-0 overflow-y-auto rounded-xl bg-white/[0.03] p-3">
          <h3 className="mb-3 text-xs font-medium text-slate-300"><LocalizedText text="System activity" /><span className="ml-2 text-slate-500">{groups.length}</span></h3>
          <ol data-conversation-events className="space-y-0.5">
                  {groups.map((group) => {
                    const open = openGroup === group.kind
                    const Icon = group.icon
                    return (
                      <li key={group.kind}>
                        <button type="button" aria-expanded={open} onClick={() => setOpenGroup(open ? null : group.kind)} className="ds-intrinsic flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-slate-200">
                          <Icon className="size-3 shrink-0" />
                          <span className="min-w-0 flex-1 truncate">
                            <span translate="no" className="text-slate-300">{group.actors.join(', ')}</span>{' '}
                            <LocalizedText text={group.label} />
                            <span className="text-slate-500"> · <LocalizedText text={group.timestamp} /></span>
                          </span>
                          <ChevronDown className={cn('size-3 shrink-0 transition-transform', open && 'rotate-180')} />
                        </button>
                        {open && (
                          <ol className="mb-1 ml-5 space-y-0.5 border-l border-white/[0.07] pl-2">
                            {group.items.map(({ id, actor, timestamp, detail, historyId, index }) => {
                              const replayEntry = entries.find((entry) => entry.id === historyId || entry.id === id)
                                ?? (entries.length ? entries[Math.max(0, Math.round((activity.length - 1 - index) * (entries.length - 1) / Math.max(activity.length - 1, 1)))] : null)
                              const isCurrentMarker = replayEntry && replayEntry.id === selected?.id
                              return (
                                <li key={id}>
                                  <button type="button" disabled={!replayEntry} onClick={() => { if (replayEntry) { setPlaying(false); setSelectedId(replayEntry.id) } }} aria-pressed={Boolean(isCurrentMarker)} className="ds-intrinsic flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] text-slate-400 transition-colors hover:bg-white/[0.04] disabled:cursor-default disabled:hover:bg-transparent aria-pressed:bg-emerald-400/[0.06]">
                                    <span className="min-w-0 flex-1 truncate">
                                      <span translate="no" className="text-slate-200">{actor}</span>
                                      {detail && <span className="text-slate-500"> · {detail}</span>}
                                      <span className="text-slate-500"> · <LocalizedText text={timestamp} /></span>
                                    </span>
                                    {replayEntry && <span title={isCurrentMarker ? 'Replay marker selected' : 'Open this point in change replay'} className={cn('size-1.5 shrink-0 rounded-full', isCurrentMarker ? 'bg-emerald-300' : 'bg-slate-500')} />}
                                  </button>
                                </li>
                              )
                            })}
                          </ol>
                        )}
                      </li>
                    )
                  })}
          </ol>
        </section>
      )}
      <section aria-label="Conflict change replay" className="flex min-h-[240px] min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-white/[0.03]">
        <div className="flex shrink-0 items-center gap-2 px-3 py-3">
          <History className="size-3.5 text-slate-500" />
          <h3 className="text-xs font-medium text-slate-300"><LocalizedText text="Step replay" /></h3>
          {/* The step in view — not the conflict's title (that's the page
              header's, once). */}
          <span data-replay-step className="min-w-0 flex-1 truncate text-[11px] text-slate-400">{selected && <LocalizedText text={stepName(selected, conflict)} />}</span>
          {/* The way out to the project's archive: a quiet text link. */}
          {onOpenProjectHistory && (
            <button type="button" onClick={onOpenProjectHistory} className="ds-intrinsic inline-flex shrink-0 items-center gap-1 text-[11px] whitespace-nowrap text-slate-400 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300">
              <LocalizedText text="Project history" />
              <ArrowRight className="size-3" />
            </button>
          )}
        </div>
        {/* Why this step happened, and what backs it — read before its code. */}
        {step && <ReasonStrip label="Reason for this step" text={step.text} evidence={stepEvidence} onOpen={onOpenEvidence} className="shrink-0 border-t border-white/[0.06] px-3 py-2" />}
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
