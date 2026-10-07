import { Check, Server, ChevronDown } from 'lucide-react'
import { cn } from 'cn'
import { useState, Fragment } from 'react'
import { REVIEW_HEADER_BADGE } from './ConflictBadges'
import { LocalizedText } from '@/i18n/runtime'
import { baselineOf, conflictTypeOf, differencesOf, flowOf, mismatchesOf } from '@/lib/conflictInsight'

// A conflict read without its code (lib/conflictInsight): the tag that says
// what kind of thing it is, the difference drawn value by value, the
// baseline the current code is on, and the steps from conflict to merge.

const TYPE_TONE = {
  rose: 'bg-rose-400/15 text-rose-200',
  violet: 'bg-violet-400/15 text-violet-200',
  amber: 'bg-amber-400/15 text-amber-200',
  sky: 'bg-sky-400/15 text-sky-200',
  slate: 'bg-white/[0.08] text-slate-200',
}

const HEADER_TYPE_TONE = {
  rose: 'bg-rose-400/20 text-rose-100',
  violet: 'bg-violet-400/25 text-violet-100',
  amber: 'bg-amber-400/20 text-amber-100',
  sky: 'bg-sky-400/20 text-sky-100',
  slate: 'bg-slate-400/20 text-slate-100',
}

// What kind of conflict it is — the one tag of its kind on a row or header.
export function ConflictTypeTag({ conflict, className, header = false }) {
  const type = conflictTypeOf(conflict)
  if (!type) return null
  return (
    <span data-conflict-type={type.id} title={type.hint} className={cn(header ? REVIEW_HEADER_BADGE : 'inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-[11px] font-medium whitespace-nowrap', (header ? HEADER_TYPE_TONE : TYPE_TONE)[type.tone], className)}>
      <LocalizedText text={type.label} />
    </span>
  )
}

// The cause in words ("Size mismatch · Color mismatch"), for a line of text.
export function MismatchLabel({ conflict, className }) {
  const labels = mismatchesOf(conflict)
  if (!labels.length) return null
  return (
    <span data-mismatch className={className}>
      {labels.map((label, index) => <span key={label}>{index > 0 && ' · '}<LocalizedText text={label} /></span>)}
    </span>
  )
}

// The branch the current code is on. Production is marked as what it is —
// the code that's live — and anything else as the branch it merges into.
export function BaselineBadge({ conflict, className }) {
  const baseline = baselineOf(conflict)
  if (!baseline) return null
  return (
    <span
      data-baseline={baseline.production ? 'production' : 'branch'}
      title={baseline.production ? 'This is the code running in production now.' : 'This branch isn’t in production yet.'}
      className={cn('inline-flex h-5 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium whitespace-nowrap', baseline.production ? 'bg-amber-400/15 text-amber-200' : 'bg-white/[0.07] text-slate-300', className)}
    >
      {baseline.production && <Server className="size-3" />}
      <LocalizedText text={baseline.production ? 'Production baseline' : 'Base branch'} />
      <span translate="no" className="font-mono font-normal opacity-80">{baseline.branch}</span>
    </span>
  )
}

const HEX = /#[0-9a-fA-F]{3,8}\b/
const px = (text) => { const value = parseFloat(String(text).match(/-?\d+(\.\d+)?/)?.[0]); return Number.isFinite(value) ? value : null }

// One value, drawn as what it is: a size as a square that big, a radius as
// a corner, spacing as an inset, a color as its swatch. (Anything else has
// no picture — its value says it.)
function ValueFigure({ kind, value, other, tone }) {
  const size = px(value)
  const edge = tone === 'expected' ? 'border-emerald-300/70' : 'border-slate-400/70'
  if (kind === 'color') {
    const hex = HEX.exec(String(value))?.[0]
    return hex ? <span aria-hidden className="size-6 shrink-0 rounded-md ring-1 ring-white/20" style={{ backgroundColor: hex }} /> : null
  }
  if (size == null) return null
  if (kind === 'size') {
    // Both drawn to one scale, so the bigger one looks bigger.
    const scale = 28 / Math.max(size, px(other) ?? size, 1)
    return <span aria-hidden className="flex size-7 shrink-0 items-center justify-center"><span className={cn('rounded-[3px] border bg-white/[0.06]', edge)} style={{ width: Math.max(6, size * scale), height: Math.max(6, size * scale) }} /></span>
  }
  if (kind === 'radius') return <span aria-hidden className={cn('size-7 shrink-0 border bg-white/[0.06]', edge)} style={{ borderRadius: Math.min(size, 14) }} />
  if (kind === 'spacing') {
    return (
      <span aria-hidden className={cn('flex size-7 shrink-0 items-stretch rounded-[3px] border border-dashed', edge)} style={{ padding: Math.max(1, Math.min(size / 2, 10)) }}>
        <span className="flex-1 rounded-[2px] bg-white/40" />
      </span>
    )
  }
  return null
}

// What differs, for someone who doesn't read the code: each property of the
// element with the code's value and the design's side by side, drawn where
// it can be. Stays put above the comparison, so it's there while choosing.
export function DifferenceSummary({ conflict, className }) {
  const differences = differencesOf(conflict)
  if (!differences.length) return null
  return (
    <section data-difference-summary aria-label="What differs" className={cn('min-w-0 rounded-xl bg-white/[0.025] px-4 py-3', className)}>
      <div className="mb-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="text-[13px] font-semibold text-white"><MismatchLabel conflict={conflict} /></h3>
        <BaselineBadge conflict={conflict} className="ml-auto" />
      </div>
      <div className="grid grid-cols-[minmax(72px,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 text-[10px] leading-4 text-slate-400">
        <span />
        <span><LocalizedText text="Code now" /></span>
        <span><LocalizedText text="Design standard" /></span>
      </div>
      <ul className="mt-1 space-y-1.5">
        {differences.map((entry) => (
          <li key={entry.label} data-difference={entry.kind} className="grid min-w-0 grid-cols-[minmax(72px,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-3 text-xs">
            <span className="leading-4 text-slate-400"><LocalizedText text={entry.label} /></span>
            <div className="flex min-w-0 items-center gap-2">
              <ValueFigure kind={entry.kind} value={entry.current} other={entry.expected} tone="current" />
              <span translate="no" className={cn('min-w-0 leading-5 font-medium break-words tabular-nums', entry.shared ? 'text-slate-200' : 'text-rose-200')}>{entry.current}</span>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <ValueFigure kind={entry.kind} value={entry.expected} other={entry.current} tone={entry.shared ? 'current' : 'expected'} />
              <span translate="no" className={cn('min-w-0 leading-5 font-medium break-words tabular-nums', entry.shared ? 'text-slate-200' : 'text-emerald-200')}>{entry.expected}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

// Conflict → Compare → Select → Approve → Merge, with where this one is and
// what to do there — so the next move never has to be guessed.
// `next`: the line to say after the steps, when the caller already has
// one (the review's approval area) — so the two never differ.
const STEP_DESCRIPTION = {
  conflict: '디자인과 코드의 차이를 확인해요',
  compare: '현재 값과 디자인 기준을 비교해요',
  select: '해결 방법을 정하고 검토를 요청해요',
  approve: '검토자의 승인을 받아요',
  merge: '승인된 변경 내용을 반영해요',
}

export function FlowSteps({ conflict, chosen, approvals, next, reviewersJSX, className }) {
  const flow = flowOf(conflict, { chosen })
  const [expandedStep, setExpandedStep] = useState(null)
  if (!flow) return null
  const completed = flow.steps.filter(step => step.state === 'done').length
  return (
    <section data-flow-steps={flow.current} aria-label="검토 진행 상태" className={cn('overflow-hidden rounded-lg bg-white/[0.015]', className)}>
      <div className="flex items-start justify-between gap-3 px-3 py-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-semibold text-white">{flow.current === 'done' ? '병합 완료' : '검토 진행 상태'}</h3>
          <p data-flow-next className="mt-1 text-[11px] leading-4 text-slate-400">{next ?? <LocalizedText text={flow.next} />}</p>
        </div>
        <span className="shrink-0 text-[11px] font-medium text-slate-200 tabular-nums">{completed}/{flow.steps.length}</span>
      </div>
      <ol className="px-3 py-2">
        {flow.steps.map((step, index) => {
          const last = index === flow.steps.length - 1
          const isApprove = step.id === 'approve'
          const ring = isApprove && approvals?.total > 0 && step.state !== 'done' ? approvals.done / approvals.total : null
          const toggle = () => setExpandedStep(expandedStep === step.id ? null : step.id)
          const open = isApprove && expandedStep === 'approve' && reviewersJSX
          return (
            <li key={step.id} data-step={step.state} aria-current={step.state === 'current' ? 'step' : undefined} className={cn('relative flex items-start gap-3', last ? 'pb-0' : 'pb-4')}>
              {!last && (
                <span
                  aria-hidden="true"
                  className={cn('absolute top-6 bottom-0 left-[9.5px] w-px', step.state === 'done' ? 'bg-[#5EEAB5]' : 'bg-white/20')}
                />
              )}
              <button
                type="button"
                onClick={toggle}
                className={cn(
                  'ds-intrinsic relative z-10 mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full p-0 text-[10px] leading-none font-semibold transition-opacity hover:opacity-80',
                  step.state === 'done'
                    ? 'bg-[#5EEAB5] text-[#06281D]'
                    : step.state === 'current'
                    ? 'bg-[#1f1f1f] text-[#5EEAB5]'
                    : 'bg-[#1f1f1f] text-white/50'
                )}
                style={{ width: 20, height: 20, minWidth: 20, minHeight: 20 }}
              >
                {step.state !== 'done' && (
                  <svg viewBox="0 0 20 20" className="absolute inset-0 size-5 -rotate-90" aria-hidden="true">
                    <circle cx="10" cy="10" r="9" fill="none" strokeWidth="1.5" className={step.state === 'current' || ring ? 'stroke-white/25' : 'stroke-white/30'} />
                    {(ring != null || step.state === 'current') && (
                      <circle cx="10" cy="10" r="9" fill="none" stroke="#5EEAB5" strokeWidth="1.5" strokeLinecap="round" pathLength="100" strokeDasharray={`${ring != null ? ring * 100 : 100} 100`} />
                    )}
                  </svg>
                )}
                {step.state === 'done' ? <Check className="size-3" strokeWidth={3} /> : <span className="relative">{index + 1}</span>}
              </button>
              <div className="min-w-0 flex-1">
                <div
                  role={isApprove ? 'button' : undefined}
                  tabIndex={isApprove ? 0 : undefined}
                  aria-expanded={isApprove ? Boolean(open) : undefined}
                  onClick={isApprove ? toggle : undefined}
                  onKeyDown={isApprove ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } } : undefined}
                  className={cn(isApprove && 'cursor-pointer rounded-md hover:bg-white/[0.03]')}
                >
                  <p className={cn('flex items-center gap-1 text-xs leading-5 font-medium', step.state === 'current' ? 'text-white' : step.state === 'done' ? 'text-slate-200' : 'text-slate-400')}>
                    <LocalizedText text={step.label} />
                    {isApprove && reviewersJSX && <ChevronDown className={cn('size-3.5 text-slate-400 transition-transform', open && 'rotate-180')} />}
                  </p>
                  <p className="text-[11px] leading-4 text-slate-400">{STEP_DESCRIPTION[step.id]}</p>
                </div>
                {open && <div className="mt-2 pl-1">{reviewersJSX(true, () => setExpandedStep(null))}</div>}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
