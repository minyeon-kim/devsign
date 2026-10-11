import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Check, CornerDownRight, CornerUpLeft, GitPullRequest, RotateCcw, X } from 'lucide-react'
import { cn } from 'cn'
import { allPeople } from '@/data/mockData'
import {
  EVENT_TYPES, absoluteTimeOf, continuesPrevious, dayLabelOf, decisionLineOf, formatTime, isSystemActor, opinionsOnly, referenceNameOf, stepActionOf, timelineRows,
} from '@/lib/conflictEvents'

// A change's History (lib/conflictEvents): everything that happened to it,
// oldest first, on one line down the page — the request, the opinions, the
// decision, the fix and how it ended, each saying what it answers.
// Kept quiet: a small neutral node for every event, an icon and a faint
// tint only for a decision, a check where it's resolved (the line ends
// there), and the warning color only for a decision turned down or a
// verification that didn't match.
//
// `events`  — the change's events, in order.
// `onSend`  — (body, replyTo) → may throw; an opinion shows at once and is
//             marked to send again if it couldn't be kept.
// `focus`   — { step, nonce }: scroll to that step's first event (asked for
//             from the progress card).

const NODE = 'absolute left-0 flex items-center justify-center rounded-full'
const QUOTE = 'mt-1.5 border-l-2 border-white/15 pl-2.5 text-xs leading-[18px] text-slate-300'

function Avatar({ actor }) {
  if (isSystemActor(actor)) return null
  const person = allPeople.find((entry) => entry.id === actor.id)
  return <span aria-hidden className={cn('flex size-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white', person?.colorClass ?? 'bg-slate-600')}>{person?.initials ?? actor.name.slice(0, 2)}</span>
}

// An opinion's text, with @mentions set off as links are.
function Body({ text }) {
  return text.split(/(@[\p{L}\p{N}_]+)/gu).map((part, index) => (part.startsWith('@')
    ? <span key={index} data-mention className="font-medium text-slate-100 underline decoration-white/30 underline-offset-2">{part}</span>
    : <Fragment key={index}>{part}</Fragment>))
}

function EventContent({ event }) {
  const { type, payload = {} } = event
  if (type === 'detected') {
    return (
      <>
        <p className="text-xs leading-[18px] text-slate-200">{payload.summary}</p>
        {(payload.source?.commit || payload.source?.file) && <p data-detect-source className="mt-0.5 text-[11px] text-slate-500">{payload.source.commit ? `커밋 ${payload.source.commit} 동기화 중` : '동기화 중'}{payload.source.file && ` · ${payload.source.file}`}</p>}
        {(payload.design || payload.implementation) && (
          <p data-value-chips className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-slate-300"><span className="text-slate-500">디자인</span> {payload.design}</span>
            <span aria-hidden className="text-slate-500">→</span>
            <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-slate-300"><span className="text-slate-500">구현</span> {payload.implementation}</span>
          </p>
        )}
      </>
    )
  }
  if (type === 'requested') {
    const reviewer = allPeople.find((entry) => entry.id === payload.reviewerId)?.name
    return (
      <>
        <p className="text-xs leading-[18px] text-slate-200">{reviewer ? `${reviewer}님에게 디자인 결정을 요청했어요` : '디자인 결정을 요청했어요'}</p>
        {(payload.proposalName || payload.reason) && (
          <blockquote className={QUOTE}>
            {payload.proposalName && <span className="block font-medium text-slate-100">{payload.proposalName}</span>}
            {payload.reason}
          </blockquote>
        )}
        {payload.timing && <p className="mt-1 text-[11px] text-slate-500">희망 반영 시점 · {payload.timing}</p>}
      </>
    )
  }
  if (type === 'commented') {
    if (payload.deleted) return <p data-deleted className="text-xs text-slate-500 italic">삭제된 의견이에요</p>
    return (
      <p className="text-xs leading-[18px] break-words whitespace-pre-wrap text-slate-200">
        <Body text={payload.body ?? ''} />
        {payload.editedAt && <span className="ml-1 text-slate-500" title={absoluteTimeOf(payload.editedAt)}>(수정됨)</span>}
      </p>
    )
  }
  if (type === 'decided') {
    const line = decisionLineOf(event)
    return (
      <>
        <p data-decision-result className={cn('text-xs leading-[18px] font-semibold', line.warn ? 'text-destructive' : 'text-slate-100')}>{line.text}</p>
        {line.changed && (
          <p data-decision-change className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
            <span className="line-through">{line.changed[0]}</span>
            <span aria-hidden>→</span>
            <span className="font-medium text-slate-100">{line.changed[1]}</span>
          </p>
        )}
        {payload.reason && <blockquote className={QUOTE}>{payload.reason}</blockquote>}
      </>
    )
  }
  if (type === 'fixed') {
    return (
      <>
        {payload.pr ? (
          <p className="flex min-w-0 items-center gap-1.5 text-xs leading-[18px] text-slate-200">
            <GitPullRequest aria-hidden className="size-3.5 shrink-0 text-slate-400" />
            <span className="min-w-0 truncate"><span className="font-medium tabular-nums">#{payload.pr.number}</span> {payload.pr.title}</span>
          </p>
        ) : <p className="text-xs leading-[18px] text-slate-200">결정대로 코드를 수정했어요</p>}
        <p className="mt-0.5 text-[11px] text-slate-500">파일 {payload.files ?? 1}개 변경</p>
      </>
    )
  }
  if (type === 'verified') {
    const width = payload.width ?? 768
    return payload.match === false
      ? <><p className="text-xs leading-[18px] font-medium text-destructive">{width}px 재비교 결과 아직 차이가 있어요</p>{payload.difference && <p className="mt-0.5 text-[11px] text-slate-400">{payload.difference}</p>}</>
      : <p className="text-xs leading-[18px] text-slate-200">{width}px 재비교 결과 디자인과 일치해요</p>
  }
  if (type === 'resolved') {
    const how = { fix: '수정 반영', 'design-change': '원안 변경', exception: '예외 처리' }[payload.how] ?? '수정 반영'
    return <p className="text-xs leading-[18px] font-medium text-slate-100">해결됨 · {how}</p>
  }
  return null
}

// `onOpenStep(event)`: pressing a record opens the replay at its step (what
// was said — an opinion — has no step of its own to open). `activeStep`: the
// step the replay is on; its records are lit.
function ConflictHistory({ events, viewerId, onSend, focus, canWrite = true, footer, onOpenStep, activeStep = null }) {
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState(() => new Set())
  const [reply, setReply] = useState(null)
  const [draft, setDraft] = useState('')
  // Opinions shown before they're kept, and ones that couldn't be.
  const [pending, setPending] = useState([])
  const [flash, setFlash] = useState(null)
  const [unseen, setUnseen] = useState(0)
  const scroller = useRef(null)
  const nodes = useRef(new Map())
  const atBottom = useRef(true)
  const now = Date.now()
  const byId = useMemo(() => new Map(events.map((event) => [event.id, event])), [events])
  const shown = filter === 'opinions' ? opinionsOnly(events) : events
  const rows = timelineRows(shown, { expanded })
  const resolved = events.at(-1)?.type === 'resolved'

  // To an event: into view, lit for a second, and focused.
  function goTo(id) {
    if (filter !== 'all' && !opinionsOnly(events).some((event) => event.id === id)) setFilter('all')
    window.requestAnimationFrame(() => {
      const node = nodes.current.get(id)
      if (!node) return
      node.scrollIntoView({ block: 'center', behavior: 'smooth' })
      node.focus({ preventScroll: true })
      setFlash(id)
      window.setTimeout(() => setFlash((current) => (current === id ? null : current)), 1000)
    })
  }
  // Asked for from the progress card: that step's first event.
  useEffect(() => {
    if (!focus?.nonce) return
    const first = events.find((event) => event.step === focus.step && event.type !== 'commented') ?? events.find((event) => event.step === focus.step)
    if (first) goTo(first.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce])

  // New events arrive at the bottom: follow them if that's where the reader
  // is; otherwise say how many are waiting.
  const count = useRef(events.length)
  useEffect(() => {
    const added = events.length - count.current
    count.current = events.length
    if (added <= 0) return
    if (atBottom.current) scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
    else setUnseen((value) => value + added)
  }, [events.length])
  const onScroll = () => {
    const el = scroller.current
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
    if (atBottom.current && unseen) setUnseen(0)
  }

  async function send(body, replyTo, retryId) {
    const id = retryId ?? `pending-${Date.now()}`
    setPending((list) => [...list.filter((entry) => entry.id !== id), { id, body, replyTo, failed: false }])
    atBottom.current = true
    window.requestAnimationFrame(() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight }))
    try {
      await onSend(body, replyTo)
      setPending((list) => list.filter((entry) => entry.id !== id))
    } catch {
      setPending((list) => list.map((entry) => (entry.id === id ? { ...entry, failed: true } : entry)))
    }
  }
  function submit(event) {
    event?.preventDefault()
    const body = draft.trim()
    if (!body) return
    send(body, reply)
    setDraft('')
    setReply(null)
  }

  let lastDay = null
  let previous = null
  return (
    <div data-conflict-history className="flex min-h-0 flex-1 flex-col">
      <div role="group" aria-label="활동 필터" className="mb-3 flex shrink-0 items-center gap-1">
        {[['all', '전체'], ['opinions', '의견만']].map(([id, label]) => (
          <button key={id} type="button" aria-pressed={filter === id} data-history-filter={id} onClick={() => setFilter(id)} className={cn('ds-intrinsic inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-medium transition-colors', filter === id ? 'bg-white/[0.1] text-white' : 'text-slate-400 hover:text-slate-200')}>
            {label}
          </button>
        ))}
      </div>

      <div ref={scroller} onScroll={onScroll} data-review-scroll="history" className="relative min-h-0 flex-1 overflow-y-auto pr-1">
        <ol data-history-timeline className="relative">
          {rows.map((row, index) => {
            const event = row.kind === 'system-run' ? row.events[0] : row.event
            const day = dayLabelOf(event.createdAt, now)
            const newDay = day !== lastDay
            lastDay = day
            const last = index === rows.length - 1
            const dayCaption = newDay && <li key={`day:${row.id}`} aria-hidden data-history-day className="mb-2 pl-7 text-[11px] leading-4 text-slate-500">{day}</li>

            if (row.kind === 'system-run') {
              previous = null
              return (
                <Fragment key={row.id}>
                  {dayCaption}
                  <li className="relative pb-4 pl-7">
                    <span aria-hidden className="absolute top-3 bottom-0 left-[9.5px] w-px bg-white/15" />
                    <span aria-hidden className={cn(NODE, 'top-1.5 left-1.5 size-2 bg-slate-500')} />
                    <button type="button" data-system-run onClick={() => setExpanded((set) => new Set(set).add(row.id))} className="ds-intrinsic text-[11px] text-slate-400 underline-offset-2 hover:text-white hover:underline">
                      시스템 기록 {row.events.length}개 · 펼치기
                    </button>
                  </li>
                </Fragment>
              )
            }
            if (row.kind === 'reopened') {
              previous = null
              return (
                <Fragment key={row.id}>
                  {dayCaption}
                  <li data-history-event={event.id} data-event-type="reopened" className="relative my-2 flex items-center gap-2 pb-4 text-[11px] text-slate-400">
                    <span aria-hidden className="h-px flex-1 bg-white/15" />
                    <RotateCcw aria-hidden className="size-3" />
                    <span>다시 열림 · {event.payload?.summary ?? '차이가 다시 감지됐어요'}</span>
                    <time dateTime={event.createdAt} title={absoluteTimeOf(event.createdAt)} className="text-slate-500">{formatTime(event.createdAt, now)}</time>
                    <span aria-hidden className="h-px flex-1 bg-white/15" />
                  </li>
                </Fragment>
              )
            }

            const grouped = !newDay && continuesPrevious(event, previous)
            previous = event
            const decided = event.type === 'decided'
            const done = event.type === 'resolved'
            const rejected = decided && event.payload?.result === 'rejected'
            const target = event.replyTo ? byId.get(event.replyTo) : null
            return (
              <Fragment key={row.id}>
                {dayCaption}
                <li
                  ref={(node) => { if (node) nodes.current.set(event.id, node); else nodes.current.delete(event.id) }}
                  tabIndex={-1}
                  data-history-event={event.id}
                  data-event-type={event.type}
                  data-event-step={event.step}
                  data-replay-active={activeStep != null && event.step === activeStep ? '' : undefined}
                  title={onOpenStep && event.type !== 'commented' ? '이 단계부터 리플레이 보기' : undefined}
                  onClick={onOpenStep && event.type !== 'commented' ? (click) => { if (!click.target.closest('button, a, textarea, input')) onOpenStep(event) } : undefined}
                  className={cn('group relative rounded-lg pr-2 pl-7 outline-none transition-colors duration-500 focus-visible:ring-1 focus-visible:ring-emerald-300/60', onOpenStep && event.type !== 'commented' && 'cursor-pointer hover:bg-white/[0.04]', activeStep != null && event.step === activeStep && 'bg-white/[0.06]', grouped ? 'pt-0 pb-3' : 'pt-1 pb-4', decided && 'bg-white/[0.03]', flash === event.id && 'bg-white/[0.08]')}
                >
                  {/* The line down the page; it ends where the change is resolved. */}
                  {!(last && (resolved || !canWrite)) && !done && <span aria-hidden className={cn('absolute bottom-0 left-[9.5px] w-px bg-white/15', grouped ? 'top-0' : 'top-4')} />}
                  {!grouped && (decided
                    ? <span aria-hidden data-node="decided" className={cn(NODE, 'top-1.5 left-0.5 size-4', rejected ? 'bg-destructive/15 text-destructive' : 'bg-emerald-400/15 text-emerald-300')}>{rejected ? <X className="size-2.5" strokeWidth={3} /> : <Check className="size-2.5" strokeWidth={3} />}</span>
                    : done
                      ? <span aria-hidden data-node="resolved" className={cn(NODE, 'top-1.5 left-0.5 size-4 bg-emerald-400 text-emerald-950')}><Check className="size-2.5" strokeWidth={3} /></span>
                      : <span aria-hidden data-node="plain" className={cn(NODE, 'top-2.5 left-1.5 size-2 bg-slate-500')} />)}

                  {!grouped && (
                    <p className="flex min-w-0 items-center gap-1.5 text-xs leading-5">
                      <Avatar actor={event.actor} />
                      <span className="min-w-0 truncate">{isSystemActor(event.actor)
                        ? <span className="text-slate-300">{stepActionOf(event)?.text ?? '자동 처리'} <span className="text-slate-400">· {EVENT_TYPES[event.type].label}</span></span>
                        : <><span className="font-medium text-slate-100">{event.actor.name}</span> <span className="text-slate-400">· {EVENT_TYPES[event.type].label}</span></>}</span>
                      <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[11px] text-slate-500">
                        {/* (Which progress step this belongs to — said on hover.) */}
                        {event.step && <span data-event-step-label className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">{event.step}단계</span>}
                        <time dateTime={event.createdAt} title={absoluteTimeOf(event.createdAt)} className="tabular-nums">{formatTime(event.createdAt, now)}</time>
                      </span>
                    </p>
                  )}
                  {/* What this answers; pressing it goes there. */}
                  {target && (
                    <button type="button" data-history-ref={target.id} onClick={() => goTo(target.id)} className="ds-intrinsic mt-1 flex items-center gap-1 text-[11px] text-slate-500 underline-offset-2 hover:text-slate-200 hover:underline focus-visible:outline-2 focus-visible:outline-emerald-300">
                      <CornerDownRight aria-hidden className="size-3" />
                      {event.type === 'commented' ? `${referenceNameOf(target)}에 대한 의견` : `${referenceNameOf(target)}에 대한 ${EVENT_TYPES[event.type].label}`}
                    </button>
                  )}
                  <div className="mt-1 min-w-0"><EventContent event={event} /></div>
                  {canWrite && !event.payload?.deleted && (
                    <button type="button" data-history-reply={event.id} onClick={() => setReply(event.id)} className="ds-intrinsic mt-1 inline-flex items-center gap-1 text-[11px] text-slate-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-slate-200 focus-visible:opacity-100">
                      <CornerUpLeft aria-hidden className="size-3" />
                      답글
                    </button>
                  )}
                </li>
              </Fragment>
            )
          })}
          {/* Sent, not yet kept — and ones that have to be sent again. */}
          {pending.map((entry) => (
            <li key={entry.id} data-history-pending={entry.failed ? 'failed' : 'sending'} className="relative pb-4 pl-7">
              <span aria-hidden className={cn(NODE, 'top-2.5 left-1.5 size-2 bg-slate-600')} />
              <p className={cn('text-xs leading-[18px] break-words whitespace-pre-wrap', entry.failed ? 'text-slate-400' : 'text-slate-300')}><Body text={entry.body} /></p>
              {entry.failed
                ? <p className="mt-1 flex items-center gap-2 text-[11px] text-destructive">보내지 못했어요 <button type="button" data-history-retry onClick={() => send(entry.body, entry.replyTo, entry.id)} className="ds-intrinsic font-medium underline underline-offset-2">다시 보내기</button></p>
                : <p className="mt-1 text-[11px] text-slate-500">보내는 중…</p>}
            </li>
          ))}
        </ol>
        {unseen > 0 && (
          <button type="button" data-history-new onClick={() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }); setUnseen(0) }} className="ds-intrinsic sticky bottom-2 left-1/2 inline-flex h-7 -translate-x-1/2 items-center rounded-full bg-popover px-3 text-[11px] font-medium text-slate-100 shadow-md ring-1 ring-white/10">
            새 기록 {unseen}개
          </button>
        )}
      </div>

      {footer}
      {/* The composer stays put under the timeline. */}
      {canWrite && (
        <form data-history-composer onSubmit={submit} className="mt-3 shrink-0 border-t border-white/[0.07] pt-3">
          {reply && byId.get(reply) && (
            <p data-reply-chip className="mb-1.5 inline-flex max-w-full items-center gap-1 rounded-full bg-white/[0.07] py-0.5 pr-1 pl-2 text-[11px] text-slate-300">
              <CornerDownRight aria-hidden className="size-3 shrink-0" />
              <span className="truncate">{referenceNameOf(byId.get(reply))}에 답글</span>
              <button type="button" aria-label="답글 취소" onClick={() => setReply(null)} className="ds-intrinsic flex size-4 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white"><X className="size-3" /></button>
            </p>
          )}
          <textarea
            data-history-input
            rows={2}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit(event) }}
            placeholder="의견을 남겨 주세요. @로 멘션할 수 있어요"
            aria-label="의견"
            className="block w-full resize-none rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs leading-[18px] text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/30"
          />
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500">⌘/Ctrl + Enter로 등록</span>
            <button type="submit" disabled={!draft.trim()} data-history-send className="ds-intrinsic inline-flex h-7 items-center rounded-full bg-white/[0.08] px-3 text-[11px] font-medium text-slate-100 transition-colors hover:bg-white/[0.14] disabled:opacity-40">등록</button>
          </div>
        </form>
      )}
      {/* (viewerId is who writes; the composer has no other identity to show.) */}
      <span hidden data-history-viewer={viewerId} />
    </div>
  )
}

export default ConflictHistory
