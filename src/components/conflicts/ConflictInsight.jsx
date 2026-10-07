import { Check, ChevronRight, Server } from 'lucide-react'
import { cn } from 'cn'
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
}

// What kind of conflict it is — the one tag of its kind on a row or header.
export function ConflictTypeTag({ conflict, className }) {
  const type = conflictTypeOf(conflict)
  if (!type) return null
  return (
    <span data-conflict-type={type.id} title={type.hint} className={cn('inline-flex h-5 shrink-0 items-center rounded-md px-1.5 text-[11px] font-medium whitespace-nowrap', TYPE_TONE[type.tone], className)}>
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
    <section data-difference-summary aria-label="What differs" className={cn('min-w-0 rounded-xl bg-white/[0.03] px-4 py-3', className)}>
      <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[13px] font-semibold text-white"><MismatchLabel conflict={conflict} /></span>
        <BaselineBadge conflict={conflict} className="ml-auto" />
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {differences.map((entry) => (
          <li key={entry.label} data-difference={entry.kind} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="w-28 shrink-0 truncate text-slate-400"><LocalizedText text={entry.label} /></span>
            <span className="flex min-w-0 items-center gap-2">
              <ValueFigure kind={entry.kind} value={entry.current} other={entry.expected} tone="current" />
              <span className="min-w-0">
                <span className="block text-[10px] leading-3 text-slate-500"><LocalizedText text="Code now" /></span>
                <span translate="no" className={cn('block truncate tabular-nums', entry.shared ? 'text-slate-200' : 'text-red-300')}>{entry.current}</span>
              </span>
            </span>
            {!entry.shared && <>
              <ChevronRight aria-hidden className="size-3.5 shrink-0 text-slate-600" />
              <span className="flex min-w-0 items-center gap-2">
                <ValueFigure kind={entry.kind} value={entry.expected} other={entry.current} tone="expected" />
                <span className="min-w-0">
                  <span className="block text-[10px] leading-3 text-slate-500"><LocalizedText text="Design standard" /></span>
                  <span translate="no" className="block truncate text-emerald-200 tabular-nums">{entry.expected}</span>
                </span>
              </span>
            </>}
            {entry.shared && <span className="text-[11px] text-slate-500"><LocalizedText text="Same in the design — neither side fixes it" /></span>}
          </li>
        ))}
      </ul>
    </section>
  )
}

// Conflict → Compare → Select → Approve → Merge, with where this one is and
// what to do there — so the next move never has to be guessed.
export function FlowSteps({ conflict, chosen, approvals, onApprove, className }) {
  const flow = flowOf(conflict, { chosen })
  if (!flow) return null
  return (
    <div data-flow-steps={flow.current} className={cn('flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1', className)}>
      <ol className="flex shrink-0 items-center gap-1 text-[11px] font-medium">
        {flow.steps.map((step, index) => (
          <li key={step.id} data-step={step.state} aria-current={step.state === 'current' ? 'step' : undefined} className="flex items-center gap-1">
            {index > 0 && <span aria-hidden className={cn('h-px w-3', step.state === 'todo' ? 'bg-white/15' : 'bg-emerald-300/50')} />}
            {(() => {
              // The Approve step counts the approvals, and goes to them.
              const counted = step.id === 'approve' && approvals?.total > 0
              const tone = cn(
                'inline-flex h-5 items-center gap-1 rounded-full px-2 whitespace-nowrap',
                step.state === 'current' ? 'bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/40'
                  : step.state === 'done' ? 'text-slate-300' : 'text-slate-500'
              )
              const body = <>
                {step.state === 'done' && <Check className="size-3 text-emerald-300" />}
                <LocalizedText text={step.label} />
                {counted && <span data-step-approvals className="tabular-nums">{approvals.done}/{approvals.total}</span>}
              </>
              return step.id === 'approve' && onApprove
                ? <button type="button" data-step-jump onClick={onApprove} className={cn(tone, 'ds-intrinsic cursor-pointer transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300')}>{body}</button>
                : <span className={tone}>{body}</span>
            })()}
          </li>
        ))}
      </ol>
      <p data-flow-next className="min-w-0 truncate text-[11px] text-slate-400"><LocalizedText text={flow.next} /></p>
    </div>
  )
}
