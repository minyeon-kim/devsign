import { useEffect, useMemo, useState } from 'react'
import { Check, Clock3, Code2, Eye, GitMerge, History, MessageSquare, RotateCcw, Send, XCircle } from 'lucide-react'
import { cn } from 'cn'
import { activities, allPeople, conflictChecklist } from '@/data/mockData'
import { diffLines } from '@/lib/lineDiff'
import { LocalizedText } from '@/i18n/runtime'
import HistoryTimeline from '@/components/history/HistoryTimeline'
import PreviewPanelContent from '@/components/dockview/panels/PreviewPanelContent'
import { useConflictStore } from '@/state/ConflictStore'

const EVENT_COPY = {
  review_requested: { action: 'requested a review', Icon: Send },
  approve: { action: 'approved this change', Icon: Check },
  changes: { action: 'requested changes', Icon: MessageSquare },
  dismiss: { action: 'dismissed a change request', Icon: XCircle },
  merge: { action: 'merged this change', Icon: GitMerge },
  reopened: { action: 'reopened this issue', Icon: RotateCcw },
  revert: { action: 'opened a revert of this change', Icon: RotateCcw },
  code_change: { action: 'pushed code changes', Icon: Code2 },
  comment: { action: 'commented on this issue', Icon: MessageSquare },
}

function conflictEvents(conflict, events) {
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
    }))

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

function ConflictHistoryReplay({ conflict, workspace }) {
  const { events } = useConflictStore()
  const activity = useMemo(() => conflictEvents(conflict, events), [conflict, events])
  const entries = useMemo(
    () => (workspace?.historyEntries ?? []).filter(
      (entry) => !entry.archived && (entry.conflictId === conflict.id || entry.conflictIds?.includes(conflict.id))
    ),
    [conflict.id, workspace?.historyEntries]
  )
  const [selectedId, setSelectedId] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [compareLatest, setCompareLatest] = useState(true)
  const [view, setView] = useState('code')
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
    <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[minmax(220px,0.75fr)_minmax(0,1.5fr)]">
      <section aria-label="Conflict activity" className="flex min-h-0 flex-col overflow-hidden rounded-xl bg-white/[0.03]">
        <div className="flex shrink-0 items-center gap-2 px-3 py-3">
          <History className="size-3.5 text-slate-500" />
          <h3 className="text-xs font-medium text-slate-300"><LocalizedText text="Issue activity" /></h3>
          <span className="ml-auto text-[11px] tabular-nums text-slate-500">
            {activity.length}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          <section className="mb-3 rounded-lg border border-white/10 p-3">
            <h4 className="text-xs font-medium text-slate-200">합치기 전 확인할 근거</h4>
            <p className="mt-2 text-xs leading-5 text-slate-400"><LocalizedText text={conflict.riskReason || conflict.message} /></p>
            {(conflict.decisionEvidence ?? conflictChecklist.find(entry => entry.id === conflict.id)?.decisionEvidence ?? []).map(evidence => (
              <div key={evidence.title} className="mt-3 border-t border-white/[0.06] pt-3">
                <p className="text-xs font-medium text-slate-200">{evidence.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{evidence.detail}</p>
              </div>
            ))}
            <p className="mt-2 text-[11px] leading-5 text-slate-500">변경 기록과 이전 버전을 비교한 뒤 Overview로 돌아가 카드 안에서 합칠 내용을 선택하세요.</p>
          </section>
          {activity.length ? (
            <ol className="space-y-1">
              {activity.map(({ id, action, actor, timestamp, detail, icon: Icon }) => (
                <li key={id} className="flex items-start gap-2.5 rounded-lg px-1 py-2">
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
                </li>
              ))}
            </ol>
          ) : (
            <p className="px-1 py-3 text-xs text-slate-500"><LocalizedText text="No activity has been recorded for this issue yet." /></p>
          )}
        </div>
      </section>

      <section aria-label="Conflict change replay" className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl bg-white/[0.03]">
        <div className="flex shrink-0 items-center gap-2 px-3 py-3">
          <History className="size-3.5 text-slate-500" />
          <h3 className="text-xs font-medium text-slate-300"><LocalizedText text="Change replay" /></h3>
          {selected && <span className="min-w-0 flex-1 truncate text-[10px] text-slate-500">{selected.label}</span>}
          {selected && (
            // Plain text toggles, like the review's Overview / History.
            <div className="flex shrink-0 items-center gap-x-3" role="tablist" aria-label="Replay content">
              {[
                ['code', Code2, 'Code'],
                ['preview', Eye, 'Preview'],
              ].map(([id, Icon, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={view === id}
                  onClick={() => setView(id)}
                  className={cn('ds-intrinsic inline-flex h-5 items-center gap-1 text-[10.5px] transition-colors', view === id ? 'font-medium text-white' : 'text-slate-500 hover:text-slate-300')}
                >
                  <Icon className="size-3" />
                  <LocalizedText text={label} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          {selected ? view === 'code' ? (
            <div className="h-full overflow-auto py-2 font-mono text-[10px] leading-relaxed">
              {rows.length ? rows.map((row, index) => (
                <div key={`${row.kind}-${index}`} className={cn('flex min-w-0 px-3 whitespace-pre-wrap [word-break:break-all]', row.kind === 'add' ? 'bg-emerald-500/[0.18] text-emerald-300' : row.kind === 'remove' ? 'bg-red-500/[0.18] text-red-300' : 'text-slate-500')}>
                  <span className="w-4 shrink-0 select-none opacity-70">{row.kind === 'add' ? '+' : row.kind === 'remove' ? '−' : ' '}</span>
                  <span className="min-w-0 flex-1 whitespace-pre-wrap [word-break:break-all]">{row.text || ' '}</span>
                </div>
              )) : <p className="px-3 py-4 text-xs font-sans text-slate-500">This replay checkpoint has no code snapshot.</p>}
            </div>
          ) : (
            <PreviewPanelContent
              key={`conflict-replay-${selected.id}`}
              previewProps={selected.snapshot?.previewProps}
              prototypeEdits={selected.snapshot?.prototypeEdits}
              activePageId={selected.snapshot?.activePageId}
              showZoomControl
              caption={<span className="text-emerald-300">{selected.label}</span>}
            />
          ) : (
            <p className="px-4 py-5 text-xs text-slate-500">
              <LocalizedText text="No replay snapshots are linked to this issue yet. Review and comment activity will still appear in the timeline." />
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
  )
}

export default ConflictHistoryReplay
