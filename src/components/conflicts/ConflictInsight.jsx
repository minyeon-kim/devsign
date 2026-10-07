import { Check, Server, ChevronDown } from 'lucide-react'
import { cn } from 'cn'
import { useState } from 'react'
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
const QUIET_TYPE_TONE = {
  rose: 'bg-rose-400/[0.08] text-rose-200/80',
  violet: 'bg-violet-400/[0.08] text-violet-200/80',
  amber: 'bg-amber-400/[0.08] text-amber-200/80',
  sky: 'bg-sky-400/[0.08] text-sky-200/80',
  slate: 'bg-white/[0.05] text-slate-300',
}

export function ConflictTypeTag({ conflict, className, header = false, quiet = false }) {
  const type = conflictTypeOf(conflict)
  if (!type) return null
  return (
    <span data-conflict-type={type.id} title={type.hint} className={cn(header ? REVIEW_HEADER_BADGE : 'inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-[11px] font-medium whitespace-nowrap', (header ? HEADER_TYPE_TONE : quiet ? QUIET_TYPE_TONE : TYPE_TONE)[type.tone], className)}>
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
      {labels.map((label, index) => <span key={label}>{index > 0 && ', '}<LocalizedText text={label} /></span>)}
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

// What differs, in a line per property: "Icon size  20px → 24px" — the
// code's value, then the design's. Only properties whose values actually
// differ are listed (one both sides share isn't a difference; the choice
// cards show it, as "Same"). A color gets its swatch; nothing else gets a
// picture. The values themselves are compared on the choice cards — this
// is the summary, said once, with the branch the code is on at its right.
export function DifferenceSummary({ conflict, className, resolved = false, mergedSide = 'A' }) {
  const differing = differencesOf(conflict).filter((entry) => !entry.shared)
  const swatch = (entry, value) => (entry.kind === 'color' ? HEX.exec(String(value))?.[0] : null)
  const value = (entry, text, tone) => (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      {swatch(entry, text) && <span aria-hidden data-swatch className="size-3 shrink-0 rounded-full ring-1 ring-white/30" style={{ backgroundColor: swatch(entry, text) }} />}
      {/* (Worded as the choice cards word it: "40px (default size)".) */}
      <span className={cn('min-w-0 font-medium break-words tabular-nums', tone)}><LocalizedText text={String(text)} /></span>
    </span>
  )
  return (
    <section data-difference-summary aria-label="What differs" className={cn('flex min-w-0 flex-wrap items-start gap-x-4 gap-y-2 rounded-xl bg-white/[0.025] px-4 py-3', className)}>
      <div className="min-w-0 flex-1 basis-64">
        {/* (The section's title is the review's; this is the kind of difference.) */}
        <p className="text-xs leading-5 font-medium text-slate-200"><MismatchLabel conflict={conflict} /></p>
        {differing.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {differing.map((entry) => (
              <li key={entry.label} data-difference={entry.kind} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs leading-5">
                <span className="w-24 shrink-0 text-slate-400"><LocalizedText text={entry.label} /></span>
                <span className="inline-flex min-w-0 flex-wrap items-center gap-x-2" title={`${entry.label}: ${entry.current} → ${entry.expected}`}>
                  {/* The code's value → the design's. Merged: the one that was applied is the lit one. */}
                  {value(entry, entry.current, resolved ? (mergedSide === 'B' ? 'text-emerald-100' : 'text-slate-400') : 'text-rose-200')}
                  <span aria-hidden className="text-slate-500">→</span>
                  {value(entry, entry.expected, resolved ? (mergedSide === 'A' ? 'text-emerald-100' : 'text-slate-400') : 'text-emerald-200')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <BaselineBadge conflict={conflict} className="mt-0.5" />
    </section>
  )
}

// Conflict → Compare → Select → Approve → Merge, with where this one is and
// what to do there — so the next move never has to be guessed.
// `next`: the line to say after the steps, when the caller already has
// one (the review's approval area) — so the two never differ.
const STEP_DESCRIPTION = {
  compare: 'Compare code and design values',
  select: 'Choose which value to apply',
  approve: 'Get approval from the reviewer',
  merge: 'Apply the approved changes',
}

// The steps list's spacing, in one place:
//   STEP_GAP        — vertical room between one step and the next;
//   STEP_TEXT_GAP   — between a step's title and its description;
//   STEP_ROW        — a step's first line (its mark and title share it, so
//                     their centers line up).
// The connecting line runs from under each mark to the next one's top, so
// it stays unbroken whatever the gap is.
const STEP_GAP = 22
const STEP_TEXT_GAP = 4
const STEP_ROW = 20

export function FlowSteps({ conflict, className }) {
  const flow = flowOf(conflict)
  const [doneStepsExpanded, setDoneStepsExpanded] = useState(null)
  if (!flow) return null
  const completed = flow.steps.filter(step => step.state === 'done').length
  const isExpanded = doneStepsExpanded ?? flow.current !== 'done'
  return (
    <section data-flow-steps={flow.current} aria-label="Progress" className={cn('overflow-hidden rounded-lg bg-white/[0.015]', className)}>
      <div className="flex items-start justify-between gap-3 px-3 py-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-semibold text-white"><LocalizedText text={flow.current === 'done' ? 'Merged' : 'Progress'} /></h3>
          <p data-flow-next className="mt-1 text-[11px] leading-4 text-slate-400"><LocalizedText text={flow.next} /></p>
        </div>
        {flow.current === 'done' ? (
          <button type="button" data-flow-toggle aria-expanded={isExpanded} onClick={() => setDoneStepsExpanded(!isExpanded)} className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-emerald-200 hover:text-white">
            <LocalizedText text={`${flow.steps.length} steps complete`} />
            <ChevronDown className={cn('size-3.5 transition-transform', isExpanded && 'rotate-180')} />
          </button>
        ) : <span className="shrink-0 text-[11px] font-medium text-slate-200 tabular-nums">{completed}/{flow.steps.length} <LocalizedText text="complete" /></span>}
      </div>
      {isExpanded && <ol className="px-3 py-2">
        {flow.steps.map((step, index) => {
          const last = index === flow.steps.length - 1
          return (
            <li key={step.id} data-step={step.state} aria-current={step.state === 'current' ? 'step' : undefined} className="relative flex items-start gap-3" style={{ paddingBottom: last ? 0 : STEP_GAP }}>
              {!last && (
                <span
                  aria-hidden="true"
                  data-step-line
                  className={cn('absolute left-[9.5px] w-px', step.state === 'done' ? 'bg-[#5EEAB5]' : 'bg-white/20')}
                  style={{ top: STEP_ROW, bottom: 0 }}
                />
              )}
              <span
                aria-hidden="true"
                className={cn(
                  'relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] leading-none font-semibold',
                  step.state === 'done'
                    ? 'bg-[#5EEAB5] text-[#06281D]'
                    : step.state === 'current'
                    ? 'bg-[#1f1f1f] text-[#5EEAB5]'
                    : 'bg-[#1f1f1f] text-white/50'
                )}
              >
                {step.state !== 'done' && (
                  <svg viewBox="0 0 20 20" className="absolute inset-0 size-5 -rotate-90" aria-hidden="true">
                    <circle cx="10" cy="10" r="9" fill="none" strokeWidth="1.5" className={step.state === 'current' ? 'stroke-white/25' : 'stroke-white/30'} />
                    {step.state === 'current' && (
                      <circle cx="10" cy="10" r="9" fill="none" stroke="#5EEAB5" strokeWidth="1.5" strokeLinecap="round" pathLength="100" strokeDasharray="100 100" />
                    )}
                  </svg>
                )}
                {step.state === 'done' ? <Check className="size-3" strokeWidth={3} /> : <span className="relative">{index + 1}</span>}
              </span>
              <div className="min-w-0 flex-1">
                <p data-step-title className={cn('flex items-center text-xs font-medium', step.state === 'current' ? 'text-white' : step.state === 'done' ? 'text-slate-200' : 'text-slate-400')} style={{ height: STEP_ROW }}>
                  <LocalizedText text={step.label} />
                </p>
                {step.state === 'current' && STEP_DESCRIPTION[step.id] && (
                  <p className="text-[11px] leading-4 text-slate-400" style={{ marginTop: STEP_TEXT_GAP }}><LocalizedText text={STEP_DESCRIPTION[step.id]} /></p>
                )}
              </div>
            </li>
          )
        })}
      </ol>}
    </section>
  )
}
