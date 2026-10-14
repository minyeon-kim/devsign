import { Children, useEffect, useId, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from 'cn'
import { FoldBody } from '@/components/conflicts/Fold'
import { IDLE, STEP_STATE_WORD, countDone, firstView, liveView, progressLabel, readSeen, writeSeen } from '@/lib/stepProgress'

// The record's label / value rows: 8px between rows, an 80px label column in grey 12px, values at 12.5px.
export const RECORD_ROWS = 'grid grid-cols-[68px_minmax(0,1fr)] gap-x-2 gap-y-1.5 text-[12.5px] leading-[1.55] [&>dt]:text-[12px]'

const motionOk = () => {
  try { return !window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return true }
}

// Which finished steps move, and when (see lib/stepProgress): the ones this
// viewer hasn't seen finished — from the moment the list scrolls into view —
// and one that finishes while it is being watched, at once. Everything else
// is shown still. `ref` goes on the list.
export function useStepReveal(conflictId, states) {
  const done = countDone(states)
  const [reveal, setReveal] = useState(() => (states.length ? firstView(readSeen(conflictId), done, motionOk()) : IDLE))
  const [before, setBefore] = useState({ conflictId, done, started: states.length > 0 })
  const [list, setList] = useState(null)
  // (Set while rendering, so the step never shows once in its finished look before it moves.)
  if (before.conflictId !== conflictId) {
    setBefore({ conflictId, done, started: states.length > 0 })
    setReveal(states.length ? firstView(readSeen(conflictId), done, motionOk()) : IDLE)
  } else if (before.done !== done || before.started !== states.length > 0) {
    setBefore({ conflictId, done, started: states.length > 0 })
    // The record appearing at all (the decision just made) starts from what was seen.
    setReveal(before.started ? liveView(before.done, done, motionOk()) : firstView(readSeen(conflictId), done, motionOk()))
  }

  useEffect(() => {
    if (!states.length) return undefined
    if (reveal.phase !== 'wait') { writeSeen(conflictId, done); return undefined }
    const played = () => { writeSeen(conflictId, done); setReveal((current) => (current.phase === 'wait' ? { ...current, phase: 'play' } : current)) }
    if (!list || typeof IntersectionObserver === 'undefined') { if (list) played(); return undefined }
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); played() } })
    observer.observe(list)
    return () => observer.disconnect()
  }, [conflictId, done, reveal.phase, list, states.length])

  // Done moving: back to still (the live flourish around the status block ends too).
  useEffect(() => {
    if (reveal.phase !== 'play') return undefined
    const timer = window.setTimeout(() => setReveal(IDLE), 1500)
    return () => window.clearTimeout(timer)
  }, [reveal])

  return { reveal, ref: setList, done }
}

const WORD = (state) => STEP_STATE_WORD[state]

// The record's steps open one at a time: opening a step folds every other —
// except the step under way, which stays open until it's folded by hand.
// (`folds`: useFoldState; `isOpen(key)`: with the caller's own defaults;
// `keep`: the step under way.) "Fold all / open all" is the caller's, as before.
export function accordionToggle(folds, keys, isOpen, keep) {
  return (key) => {
    if (isOpen(key)) { folds.set(key, false); return }
    const others = keys.filter((other) => other !== key && other !== keep && isOpen(other))
    if (others.length) folds.setMany(others, false)
    folds.set(key, true)
  }
}

// A step's mark. Done: a soft success disc with the check in the success
// colour (drawn when new); under way: an outlined disc with a slow pulse
// ring; waiting: an empty grey outline; needs a person: a warning disc and
// "!". The shape differs by state, so colour never carries it alone.
export function StepDot({ state, moves: animate = false, arrive = false }) {
  const base = 'relative flex size-3 shrink-0 items-center justify-center rounded-full'
  if (state === 'done') {
    return (
      <span aria-hidden data-step-dot="done" className={cn(base, 'bg-emerald-400/15 text-emerald-300', animate && 'ds-step-pop')}>
        <svg viewBox="0 0 16 16" className="size-2" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 8.5l3 3 6-7" pathLength="1" className={cn('ds-step-check', animate && 'ds-step-check-draw')} />
        </svg>
      </span>
    )
  }
  if (state === 'current') {
    return (
      // (The accent, with a soft ring around it.)
      <span aria-hidden data-step-dot="current" className={cn(base, 'border-[1.5px] border-sky-300 shadow-[0_0_0_3px_rgb(125_211_252/0.14)]', arrive && 'ds-step-arrive')} />
    )
  }
  if (state === 'problem') {
    return (
      <span aria-hidden data-step-dot="problem" className={cn(base, 'bg-amber-400/20 text-amber-300')}>
        <svg viewBox="0 0 16 16" className="size-2" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="M8 3.5v5.2M8 12.2v.1" /></svg>
      </span>
    )
  }
  return <span aria-hidden data-step-dot="pending" className={cn(base, 'border-[1.5px] border-white/20')} />
}

// The line down from a step to the next: success-tinted once the step is
// done (runs down when new, deeper while a later step is hovered), a grey
// dashed line while it isn't.
export function StepLine({ filled, strong = false, moves: animate = false, className }) {
  return (
    <span aria-hidden data-step-line={filled ? 'done' : 'pending'} className={cn('pointer-events-none absolute w-px', className)}>
      {filled ? (
        <>
          <span className="absolute inset-0 bg-white/[0.08]" />
          <span className={cn('absolute inset-0 transition-colors duration-150', strong ? 'bg-emerald-400/50' : 'bg-emerald-400/25', animate && 'ds-step-line')} />
        </>
      ) : <span className="absolute inset-0 border-l border-dashed border-white/20" />}
    </span>
  )
}

// The record of what's been done, as a thin timeline: a small dot on a line,
// one row a step — [step] · [who] · [what] · [when] — that opens in place.
// A finished step wears a soft success disc and check (StepTimeline); only
// the step under way is outlined in the accent color, one that needs
// attention wears the warning color, and one still to come is an empty ring.
// `onReplay`: the replay opened at this step — a quiet text button that shows
// on the row's hover or focus. `moves`/`delay`/`anim`: the step has just
// finished and fills in (see StepTimeline); `strong`: the line below it is
// deeper while a later step is hovered. A step with nothing inside (no
// `children`) has no fold: its head is all there is.
export function StepRow({ state, title, who: _who, summary: _summary, time, open, onToggle, onReplay, last, moves = false, arrive = false, delay = 0, anim, strong = false, onHover, children, ...rest }) {
  const pending = state === 'pending'
  const current = state === 'current' || state === 'problem'
  // (Nothing inside — or only conditions that didn't hold: no fold.)
  const foldable = Children.toArray(children).length > 0
  const bodyId = useId()
  // Opened and partly out of view: brought into view once it has grown (it grows over 220ms).
  const rowRef = useRef(null)
  const wasOpen = useRef(open)
  useEffect(() => {
    const opened = open && !wasOpen.current
    wasOpen.current = open
    if (!opened) return undefined
    const timer = window.setTimeout(() => rowRef.current?.scrollIntoView({ block: 'nearest', behavior: motionOk() ? 'smooth' : 'auto' }), 230)
    return () => window.clearTimeout(timer)
  }, [open])
  // One line, folded or not: the step's name, where it stands, when — and the chevron.
  const head = (
    <>
      <span data-step-title className={cn('min-w-0 truncate text-[13px] leading-5', pending ? 'text-slate-500' : state === 'done' ? 'font-medium text-slate-300' : 'font-semibold text-white')}>{title}</span>
      <span data-step-state className={cn('shrink-0 text-[11px] leading-5', current ? 'text-sky-200' : 'text-slate-500')}>{WORD(state)}</span>
      <span className="ml-auto flex h-5 shrink-0 items-center gap-1.5">
        {time && <time data-step-time className="shrink-0 text-[11px] whitespace-nowrap text-slate-500 tabular-nums">{time}</time>}
        {foldable && <ChevronRight aria-hidden data-step-chevron className={cn('size-3.5 shrink-0 text-slate-400 transition-transform duration-[180ms] ease-out motion-reduce:transition-none', open && 'rotate-90')} />}
      </span>
    </>
  )
  return (
    <li
      ref={rowRef}
      className="group/step relative scroll-my-3 pl-6"
      aria-label={`${title} · ${STEP_STATE_WORD[state]}`}
      data-step-anim={anim}
      style={{ '--d': `${delay}ms` }}
      onMouseEnter={onHover && (() => onHover(true))}
      onMouseLeave={onHover && (() => onHover(false))}
      {...rest}
    >
      {/* (The line runs on to the next step's dot, whatever the height of this one — it's drawn from the row's top to past its bottom.) */}
      {!last && <StepLine filled={state === 'done'} strong={strong} moves={moves} className="top-[18px] bottom-[-18px] left-[5.5px]" />}
      {/* (12px from the mark to the step's name; the mark centred on the name's line.) */}
      <span className="absolute top-1 left-0"><StepDot state={state} moves={moves} arrive={arrive} /></span>
      {/* The step under way is set apart: a faint accent behind it (no change to where anything sits). */}
      <div data-step-row={state} data-open={open} className={cn('-mx-2 rounded-lg px-2', current && 'bg-sky-400/[0.05] ring-1 ring-sky-300/15')}>
        <div data-step-head className="flex min-w-0 items-start gap-1">
          {foldable ? (
            // The whole head is the switch: Enter or Space folds and opens it.
            <button
              type="button"
              aria-expanded={open}
              aria-controls={bodyId}
              onClick={onToggle}
              className={cn('ds-intrinsic -mx-2 flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-2 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-emerald-300', !open && 'hover:bg-white/[0.05]')}
            >
              {head}
            </button>
          ) : <div className="flex min-w-0 flex-1 items-center gap-2">{head}</div>}
          {onReplay && (
            <button type="button" data-step-replay onClick={onReplay} className="ds-intrinsic h-5 shrink-0 rounded px-1 text-[11.5px] text-slate-300 underline-offset-4 opacity-0 transition-opacity hover:text-white hover:underline focus-visible:opacity-100 group-hover/step:opacity-100">
              이 단계부터 보기
            </button>
          )}
        </div>
        {/* Opened: 12px under its head, from the name's own left edge; 16px between its blocks, a readable measure. */}
        {foldable && <div id={bodyId} role="region" aria-label={title}><FoldBody open={open}><div data-step-body className="flex flex-col gap-4 pt-3 pb-2 [&_dl]:max-w-[640px] [&_p]:max-w-[640px]">{children}</div></FoldBody></div>}
      </div>
    </li>
  )
}

// "진행 기록 · 4/4 완료" — the count changes with a short tick when a step finishes.
export function StepProgressCount({ states, ticks }) {
  const done = countDone(states)
  const [, rest] = progressLabel(states).split('/')
  return (
    <span data-step-count aria-label={`${states.length}단계 중 ${done}단계${done === states.length ? ' 완료' : ''}`} className="text-xs text-slate-400 tabular-nums">
      <span aria-hidden>
        · <span key={done} className={cn('inline-block', ticks && 'ds-step-tick')}>{done}</span>/{rest}
      </span>
    </span>
  )
}

// While a saved step is being replayed, where it sits in the record: the
// steps before it done, the one in view under way, the rest waiting. Moving
// forward fills in only the step just reached.
export function ReplayStepRail({ steps }) {
  const done = countDone(steps.map((step) => step.state))
  const [seen, setSeen] = useState(done)
  const [filled, setFilled] = useState(null)
  if (seen !== done) {
    setSeen(done)
    setFilled(done > seen && motionOk() ? { from: seen, to: done } : null)
  }
  const fresh = (index) => filled && index >= filled.from && index < filled.to
  return (
    <ol data-replay-rail aria-label="진행 기록" className="m-0 flex list-none items-center gap-2 px-1 py-0.5 text-xs">
      {steps.map((step, index) => (
        <li key={step.key} aria-label={`${step.title} · ${WORD(step.state)}`} className="flex min-w-0 items-center gap-2 last:flex-none [&:not(:last-child)]:flex-1">
          <StepDot state={step.state} moves={fresh(index)} arrive={filled && step.state === 'current' && index === filled.to} />
          <span className={cn('whitespace-nowrap', step.state === 'pending' ? 'text-slate-500' : step.state === 'done' ? 'text-slate-300' : 'font-medium text-white')}>{step.title}</span>
          {index < steps.length - 1 && (
            <span aria-hidden className="relative h-px min-w-3 flex-1">
              {step.state === 'done' ? (
                <>
                  <span className="absolute inset-0 bg-white/[0.08]" />
                  <span className={cn('absolute inset-0 bg-emerald-400/25', fresh(index) && 'ds-step-line-x')} />
                </>
              ) : <span className="absolute inset-0 border-t border-dashed border-white/20" />}
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}
