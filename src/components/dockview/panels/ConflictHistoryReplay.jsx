import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, ChevronDown, Code2, Eye, GitMerge, History, MessageSquare, RotateCcw, Send, TriangleAlert, XCircle } from 'lucide-react'
import { cn } from 'cn'
import { activities, allPeople } from '@/data/mockData'
import { diffLines } from '@/lib/lineDiff'
import { deriveComponentOverride } from '@/lib/prototypeSync'
import { LocalizedText } from '@/i18n/runtime'
import { NAV_BUTTON, NAV_BUTTON_ICON } from '@/components/conflicts/ConflictBadges'
import HistoryTimeline from '@/components/history/HistoryTimeline'
import PreviewPanelContent from '@/components/dockview/panels/PreviewPanelContent'
import { useConflictStore } from '@/state/ConflictStore'
import { foldConflictCheckpoints, withBranches } from '@/lib/historyBranches'
import { ReasonStrip } from '@/components/conflicts/Rationale'
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

// A conflict's activity, in two places:
//   · the review sidebar's Activity tab (ConflictActivityList) — a vertical
//     timeline, oldest first: the steps that changed code or values (the
//     version that caused it, its detection, its merge), each with its
//     reason and a way into its replay, and the system's events (review
//     requested, approvals…) folded to a line per kind;
//   · the review's main area (ConflictReplay) — a step's replay (code,
//     preview, the playback timeline), taking the comparison's place until
//     "Back to review".
// Both read the same data (useConflictActivity), so the step lit in the
// list is the one playing.

// The order system events come in on the timeline.
const GROUP_ORDER = ['origin', 'detected', 'review_requested', 'code_change', 'changes', 'dismiss', 'approve', 'reopened', 'revert', 'merge']

export function useConflictActivity(conflict, workspace) {
  const { events } = useConflictStore()
  const activity = useMemo(() => (conflict ? conflictEvents(conflict, events, workspace?.historyEntries ?? []) : []), [conflict, events, workspace?.historyEntries])
  // The replay's steps, oldest first: the saved version that caused it (one
  // step earlier than the conflict's own checkpoints), then those.
  const entries = useMemo(() => {
    if (!conflict) return []
    const all = (workspace?.historyEntries ?? []).filter((entry) => !entry.archived)
    const linked = all.filter((entry) => entry.conflictId === conflict.id || entry.conflictIds?.includes(conflict.id))
    const cause = foldConflictCheckpoints(withBranches(all, workspace?.conflicts ?? []))
      .find((version) => version.conflictMarks.some((mark) => mark.conflictId === conflict.id))
    const causeEntry = cause && !linked.some((entry) => entry.id === cause.id) ? all.find((entry) => entry.id === cause.id) : null
    return causeEntry ? [causeEntry, ...linked] : linked
  }, [conflict, workspace?.historyEntries, workspace?.conflicts])
  // System events, one group per kind: who did it (each person once) and
  // when it last happened. A step that's on the timeline itself (detected,
  // merged) isn't repeated as a group.
  const groups = useMemo(() => {
    if (!conflict) return []
    const byKind = new Map()
    activity.forEach((item) => {
      if (item.kind === 'comment') return
      const group = byKind.get(item.kind) ?? { kind: item.kind, label: GROUP_LABEL[item.kind] ?? item.action, icon: item.icon, timestamp: item.timestamp, actors: [], items: [] }
      if (!group.actors.includes(item.actor)) {
        group.actors.push(item.actor)
        group.items.push(item)
      }
      byKind.set(item.kind, group)
    })
    const stepKinds = new Set(entries.map((entry) => entry.kind))
    if (stepKinds.has('conflict')) byKind.delete('detected')
    if (stepKinds.has('merge')) byKind.delete('merge')
    // Where it began — who made the change and what caught it — when no
    // saved version stands for that.
    const author = conflict.changedBy
    const origin = [author?.what, conflict.detectedBy].filter(Boolean)
    const who = author?.type === 'person' ? allPeople.find((person) => person.id === author.id)?.name : author?.type === 'ai' ? 'Devsign AI' : null
    if (origin.length && !entries.some((entry) => entry.kind !== 'conflict' && entry.kind !== 'merge')) {
      byKind.set('origin', { kind: 'origin', label: origin[0], extra: origin.slice(1), icon: History, timestamp: conflict.detectedAt ?? conflict.timestamp ?? '', actors: who ? [who] : [], items: [] })
    }
    const rank = (kind) => { const at = GROUP_ORDER.indexOf(kind); return at < 0 ? GROUP_ORDER.length - 2 : at }
    return [...byKind.values()].sort((a, b) => rank(a.kind) - rank(b.kind))
  }, [activity, conflict, entries])
  // The timeline: steps in order, the groups between detection and merge.
  const timeline = useMemo(() => {
    const steps = entries.map((entry) => ({ type: 'step', id: entry.id, entry }))
    const merge = steps.filter((item) => item.entry.kind === 'merge')
    const before = steps.filter((item) => item.entry.kind !== 'merge')
    const lead = groups.filter((group) => group.kind === 'origin').map((group) => ({ type: 'group', id: group.kind, group }))
    const rest = groups.filter((group) => group.kind !== 'origin').map((group) => ({ type: 'group', id: group.kind, group }))
    return [...lead, ...before, ...rest, ...merge]
  }, [entries, groups])
  return { entries, groups, timeline }
}

const STEP_ICON = { conflict: TriangleAlert, merge: GitMerge, rollback: RotateCcw }

// The sidebar's Activity tab. `replayId`: the step whose replay is open in
// the main area (lit here); `onReplay(id)` opens one.
export function ConflictActivityList({ conflict, rationale, activity, replayId, onReplay, onOpenProjectHistory }) {
  const [openGroup, setOpenGroup] = useState(null)
  const { timeline } = activity
  if (!timeline.length) {
    return <p className="py-3 text-xs text-slate-400"><LocalizedText text="No activity has been recorded for this conflict yet." /></p>
  }
  return (
    <div data-activity-list className="flex min-h-full flex-col">
      <ol className="relative space-y-0.5 before:absolute before:top-3 before:bottom-3 before:left-[9px] before:w-px before:bg-white/[0.08]">
        {timeline.map((item) => {
          if (item.type === 'group') {
            const { group } = item
            const open = openGroup === group.kind
            const Icon = group.icon
            const many = group.items.length > 1
            const line = (
              <>
                <span className="relative z-10 flex size-[19px] shrink-0 items-center justify-center rounded-full bg-[#1c1c1e] text-slate-400"><Icon className="size-3" /></span>
                <span className="min-w-0 flex-1 text-xs leading-[18px] text-slate-300">
                  {group.actors.length > 0 && <><span translate="no" className="text-slate-200">{group.actors.join(', ')}</span>{' '}</>}
                  <LocalizedText text={group.label} />
                  {group.extra?.map((part) => <span key={part} className="text-slate-400"> · <LocalizedText text={part} /></span>)}
                  {group.timestamp && <span className="text-slate-400"> · <LocalizedText text={group.timestamp} /></span>}
                </span>
              </>
            )
            return (
              <li key={item.id} data-activity-item="group">
                {many ? (
                  <button type="button" aria-expanded={open} onClick={() => setOpenGroup(open ? null : group.kind)} className="ds-intrinsic flex w-full cursor-pointer items-start gap-2 rounded-lg py-1.5 pr-1 text-left transition-colors hover:bg-white/[0.04]">
                    {line}
                    <ChevronDown className={cn('mt-0.5 size-3.5 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
                  </button>
                ) : <div className="flex items-start gap-2 py-1.5">{line}</div>}
                {many && open && (
                  <ol className="mb-1 ml-[27px] space-y-0.5">
                    {group.items.map(({ id, actor, timestamp, detail }) => (
                      <li key={id} className="text-[11px] leading-4 text-slate-400">
                        <span translate="no" className="text-slate-200">{actor}</span>
                        {detail && <span> · {detail}</span>}
                        <span> · <LocalizedText text={timestamp} /></span>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            )
          }
          // A step that changed code or values: its reason, and its replay.
          const { entry } = item
          const Icon = STEP_ICON[entry.kind] ?? Code2
          const reason = rationale ? stepRationale(entry, conflict, rationale).text : null
          const watching = replayId === entry.id
          const person = allPeople.find((candidate) => candidate.id === entry.actorId)
          const who = person?.name ?? entry.actorLabel ?? null
          return (
            <li key={item.id} data-activity-item="step" data-watching={watching ? '' : undefined} className={cn('flex items-start gap-2 rounded-lg py-1.5 pr-1', watching && 'bg-emerald-400/[0.08] ring-1 ring-emerald-300/30 ring-inset')}>
              <span className={cn('relative z-10 flex size-[19px] shrink-0 items-center justify-center rounded-full text-slate-300', watching ? 'bg-emerald-400/20 text-emerald-200' : 'bg-[#1c1c1e]')}><Icon className="size-3" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs leading-[18px] font-medium text-slate-100"><LocalizedText text={stepName(entry, conflict)} /></span>
                {reason && <span className="block text-xs leading-[18px] text-slate-300"><LocalizedText text={reason} /></span>}
                <span className="block text-[11px] leading-4 text-slate-400">
                  {who && <>{person ? <span translate="no">{who}</span> : <LocalizedText text={who} />} · </>}
                  <LocalizedText text={entry.timestamp ?? ''} />
                </span>
                <button type="button" data-replay-open onClick={() => onReplay(entry.id)} className="ds-intrinsic mt-0.5 inline-flex h-5 items-center gap-1 text-[11px] text-emerald-300 transition-colors hover:text-emerald-200">
                  <LocalizedText text={watching ? 'Watching the replay' : 'View replay'} />
                  {!watching && <ArrowRight className="size-3" />}
                </button>
              </span>
            </li>
          )
        })}
      </ol>
      {/* The way out to the project's archive: a quiet text link, last. */}
      {onOpenProjectHistory && (
        <button type="button" data-project-history onClick={onOpenProjectHistory} className="ds-intrinsic mt-3 inline-flex h-6 w-fit items-center gap-1 border-t border-white/[0.07] pt-3 text-[11px] whitespace-nowrap text-slate-400 transition-colors hover:text-white">
          <LocalizedText text="Project history" />
          <ArrowRight className="size-3" />
        </button>
      )}
    </div>
  )
}

// A step's replay, in the review's main area: which step of how many, the
// way back to the comparison, why the step happened, its code beside what
// it renders, and the timeline to play through the steps.
export function ConflictReplay({ conflict, rationale, activity, replayId, onReplay, onBack, onOpenEvidence }) {
  const { entries } = activity
  const [playing, setPlaying] = useState(false)
  const [compareLatest, setCompareLatest] = useState(true)
  const foundIndex = entries.findIndex((entry) => entry.id === replayId)
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
      if (selectedIndex < entries.length - 1) onReplay(entries[selectedIndex + 1].id)
      else setPlaying(false)
    }, 900)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <section data-conflict-replay aria-label="Conflict change replay" className="flex min-h-[240px] min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-white/[0.03]">
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-3 py-2.5">
        {/* Going back: the arrow leads, pointing left. */}
        <button type="button" data-replay-back onClick={onBack} className={NAV_BUTTON}>
          <ArrowLeft className={NAV_BUTTON_ICON} />
          <LocalizedText text="Back to review" />
        </button>
        <p data-replay-status className="min-w-0 text-xs text-slate-300">
          <span className="font-semibold text-white"><LocalizedText text="Watching the replay" /></span>
          <span className="text-slate-400"> · </span>
          <span className="tabular-nums"><LocalizedText text={`Step ${selectedIndex + 1}/${entries.length}`} /></span>
          {/* The step in view — not the conflict's title (that's the page
              header's, once). */}
          {selected && <span data-replay-step className="text-slate-400"> · <LocalizedText text={stepName(selected, conflict)} /></span>}
        </p>
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
          onSelect={(id) => { setPlaying(false); onReplay(id) }}
          playing={playing}
          onTogglePlay={() => {
            if (!playing && selectedIndex >= entries.length - 1 && entries[0]) onReplay(entries[0].id)
            setPlaying((current) => !current)
          }}
          compareLatest={compareLatest}
          onCompareLatestChange={setCompareLatest}
          isCurrent
          hideRestore
        />
      )}
    </section>
  )
}
