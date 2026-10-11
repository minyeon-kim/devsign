import { useEffect, useState } from 'react'
import { cn } from 'cn'
import { IDLE, STEP_STATE_WORD, countDone, firstView, liveView, progressLabel, readSeen, writeSeen } from '@/lib/stepProgress'

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

// A step's mark. Done: a soft success disc with the check in the success
// colour (drawn when new); under way: an outlined disc with a slow pulse
// ring; waiting: an empty grey outline; needs a person: a warning disc and
// "!". The shape differs by state, so colour never carries it alone.
export function StepDot({ state, moves: animate = false, arrive = false }) {
  const base = 'relative flex size-4 shrink-0 items-center justify-center rounded-full'
  if (state === 'done') {
    return (
      <span aria-hidden data-step-dot="done" className={cn(base, 'bg-emerald-400/15 text-emerald-300', animate && 'ds-step-pop')}>
        <svg viewBox="0 0 16 16" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 8.5l3 3 6-7" pathLength="1" className={cn('ds-step-check', animate && 'ds-step-check-draw')} />
        </svg>
      </span>
    )
  }
  if (state === 'current') {
    return (
      <span aria-hidden data-step-dot="current" className={cn(base, 'border-[1.5px] border-sky-300', arrive && 'ds-step-arrive')}>
        <span className="ds-step-ring pointer-events-none absolute -inset-px rounded-full border-[1.5px] border-sky-300/60" />
      </span>
    )
  }
  if (state === 'problem') {
    return (
      <span aria-hidden data-step-dot="problem" className={cn(base, 'bg-amber-400/20 text-amber-300')}>
        <svg viewBox="0 0 16 16" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M8 3.5v5.2M8 12.2v.1" /></svg>
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
