import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Code2, GitMerge, History, MessageSquare, Play, RotateCcw, Scale, Send, TriangleAlert, XCircle } from 'lucide-react'
import { cn } from 'cn'
import { activities, allPeople, projectHistorySeeds } from '@/data/mockData'
import { LocalizedText } from '@/i18n/runtime'
import { NAV_BUTTON, NAV_BUTTON_ICON } from '@/components/conflicts/ConflictBadges'
import HistoryTimeline from '@/components/history/HistoryTimeline'
import HistoryCompare from '@/components/history/HistoryCompare'
import { useHistoryPlayback } from '@/components/history/useHistoryPlayback'
import { useConflictStore } from '@/state/ConflictStore'
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
  decision_requested: { action: '승인을 요청했어요', Icon: Send },
  decided: { action: '디자인을 결정했어요', Icon: Scale },
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
  decision_requested: '승인 요청',
  decided: '디자인 결정',
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
    // (A saved history keeps the seeds as they were when it was saved; a
    // step's reason added to the seed since is picked up here.)
    const seeds = projectHistorySeeds[conflict.projectId] ?? []
    return (causeEntry ? [causeEntry, ...linked] : linked)
      .map((entry) => (entry.reason ? entry : { ...entry, reason: seeds.find((seed) => seed.id === entry.id)?.reason }))
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
      if (conflict.revertOf && item.kind === 'merge') group.label = 'canceled the merge'
      if (conflict.revertOf && item.kind === 'revert') group.label = 'requested merge cancellation'
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
export function ConflictActivityList({ conflict, activity, replayId, onReplay, onOpenProjectHistory }) {
  const { timeline } = activity
  if (!timeline.length) {
    return <p className="py-3 text-xs text-slate-400"><LocalizedText text="No activity has been recorded for this conflict yet." /></p>
  }
  // Every item is the same short shape — what happened · who · when. A step
  // that changed code or values is a button (the whole row: it opens that
  // step's replay in the main area, a ▶ showing on hover); an event that
  // changed nothing — a review request, an approval — is just a line.
  return (
    <div data-activity-list className="flex min-h-full flex-col">
      <ol className="relative space-y-0.5 before:absolute before:top-3 before:bottom-3 before:left-[9px] before:w-px before:bg-white/[0.08]">
        {timeline.map((item) => {
          if (item.type === 'group') {
            const { group } = item
            const Icon = group.icon
            return (
              <li key={item.id} data-activity-item="group" className="flex items-start gap-2 py-1.5">
                <span className="relative z-10 flex size-[19px] shrink-0 items-center justify-center rounded-full bg-[#1c1c1e] text-slate-400"><Icon className="size-3" /></span>
                <span className="min-w-0 flex-1 text-xs leading-[18px] text-slate-300">
                  <LocalizedText text={group.label} />
                  {group.actors.length > 0 && <span className="text-slate-400"> · <span translate="no">{group.actors.join(', ')}</span></span>}
                  {group.timestamp && <span className="text-slate-400"> · <LocalizedText text={group.timestamp} /></span>}
                </span>
              </li>
            )
          }
          const { entry } = item
          const Icon = STEP_ICON[entry.kind] ?? Code2
          const watching = replayId === entry.id
          const person = allPeople.find((candidate) => candidate.id === entry.actorId)
          const who = person?.name ?? entry.actorLabel ?? null
          return (
            <li key={item.id} data-activity-item="step" data-watching={watching ? '' : undefined}>
              <button
                type="button"
                data-replay-open
                aria-pressed={watching}
                title="View this step’s replay"
                onClick={() => onReplay(entry.id)}
                className={cn('group/step ds-intrinsic flex w-full cursor-pointer items-start gap-2 rounded-lg py-1.5 pr-1.5 text-left transition-colors hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-emerald-300', watching && 'bg-emerald-400/[0.08] ring-1 ring-emerald-300/30 ring-inset')}
              >
                <span className={cn('relative z-10 flex size-[19px] shrink-0 items-center justify-center rounded-full', watching ? 'bg-emerald-400/20 text-emerald-200' : 'bg-[#1c1c1e] text-slate-300')}><Icon className="size-3" /></span>
                <span className="min-w-0 flex-1 text-xs leading-[18px] text-slate-100">
                  <LocalizedText text={stepName(entry, conflict)} />
                  {who && <span className="text-slate-400"> · {person ? <span translate="no">{who}</span> : <LocalizedText text={who} />}</span>}
                  {entry.timestamp && <span className="text-slate-400"> · <LocalizedText text={entry.timestamp} /></span>}
                </span>
                <Play aria-hidden className={cn('mt-[3px] size-3 shrink-0 fill-current transition-opacity', watching ? 'text-emerald-300 opacity-100' : 'text-slate-300 opacity-0 group-hover/step:opacity-100 group-focus-visible/step:opacity-100')} />
              </button>
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

// A change's replay, in its detail's main area: the History page's own
// checkpoint viewer (HistoryCompare, embedded) over this change's steps — so
// what it compares with, its change line, its renders, its code and its
// inspection marks are the page's, not a second version of them. Here it's
// given the line on top — back to the review, which step of how many, and
// the way out to the whole History — and the timeline under it.
// `onClose` closes it; `onStep(id)` moves it (the caller owns which step).
export function ConflictReplay({ conflict, activity, replayId, onReplay, onBack, onOpenHistory, autoplay = false }) {
  const { entries } = activity
  const [baseline, setBaseline] = useState('previous')
  const foundIndex = entries.findIndex((entry) => entry.id === replayId)
  const selectedIndex = foundIndex < 0 ? Math.max(0, entries.length - 1) : foundIndex
  const selected = entries[selectedIndex] ?? null
  const { playing, pause, toggle, advance } = useHistoryPlayback(entries, selected?.id ?? null, onReplay)
  // Opened to play from the start: it starts once, by itself.
  const started = useRef(false)
  useEffect(() => {
    if (!autoplay || started.current || entries.length < 2) return
    started.current = true
    toggle()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, entries.length])

  const timelineEntries = useMemo(
    () => entries.map((entry) => ({ ...entry, label: stepName(entry, conflict), timestamp: entry.timestamp ?? entry.label })),
    [entries, conflict]
  )

  if (!selected) {
    return (
      <section data-conflict-replay aria-label="Replay" className="flex min-h-[240px] min-w-0 flex-1 flex-col rounded-xl bg-white/[0.03] p-4">
        <button type="button" data-replay-back onClick={onBack} className={cn(NAV_BUTTON, 'w-fit')}><ArrowLeft className={NAV_BUTTON_ICON} /><LocalizedText text="Back to review" /></button>
        <p className="mt-4 text-xs text-slate-500"><LocalizedText text="No replay snapshots are linked to this conflict yet. Review and comment activity will still appear in the timeline." /></p>
      </section>
    )
  }
  return (
    // (Tall enough for the render to read whatever the window: the review's
    // main column scrolls while a replay is open.)
    <section data-conflict-replay aria-label="Replay" className="flex min-h-[560px] min-w-0 flex-1 flex-col">
      <HistoryCompare
        embedded
        hideRestore
        entryId={selected.id}
        baseEntryId={entries[selectedIndex - 1]?.id}
        position={{ index: selectedIndex, total: entries.length }}
        baseline={baseline}
        onBaselineChange={setBaseline}
        playing={playing}
        onStepDone={advance}
        header={(
          <div data-replay-head className="flex shrink-0 items-center gap-3 px-3 pt-3 pb-2">
            {/* Going back: the arrow leads, pointing left. */}
            <button type="button" data-replay-back onClick={onBack} className={NAV_BUTTON}>
              <ArrowLeft className={NAV_BUTTON_ICON} />
              <LocalizedText text="Back to review" />
            </button>
            <p data-replay-status className="min-w-0 flex-1 truncate text-[13px] text-slate-300">
              <span className="font-semibold text-white"><LocalizedText text="Replay" /></span>
              <span className="text-slate-500"> · </span>
              <span className="tabular-nums"><LocalizedText text={`Step ${selectedIndex + 1}/${entries.length}`} /></span>
              {/* The step in view — not the change's title (that's the page's, once). */}
              <span data-replay-step className="text-slate-400"> · <LocalizedText text={stepName(selected, conflict)} /></span>
            </p>
            {onOpenHistory && (
              <button type="button" data-replay-history onClick={() => onOpenHistory(selected.id)} className="ds-intrinsic inline-flex shrink-0 items-center gap-1 rounded text-[12px] text-slate-400 underline-offset-4 transition-colors hover:text-white hover:underline">
                <LocalizedText text="See it all in History" />
                <ArrowUpRight className="size-3.5" />
              </button>
            )}
          </div>
        )}
        footer={(
          <HistoryTimeline
            compact
            entries={timelineEntries}
            selectedId={selected.id}
            onSelect={(id) => { pause(); onReplay(id) }}
            playing={playing}
            onTogglePlay={toggle}
            isCurrent
            hideRestore
          />
        )}
      />
    </section>
  )
}
