import { useState } from 'react'
import { ArrowUpRight, BookMarked, Braces, Check, Frame, MessageSquare, ScanEye, TriangleAlert } from 'lucide-react'
import { cn } from 'cn'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { LocalizedText } from '@/i18n/runtime'
import { DESIGN_RULES, DEVIATION_LABEL, DEVIATION_REASONS } from '@/lib/rationale'

// Showing a change's reason (lib/rationale): the four-line decision summary,
// the evidence links, the registered rules, and — only for a decision that
// departs from the standard — the dialog that asks why.

const EVIDENCE_ICON = { rule: BookMarked, figma: Frame, token: Braces, wcag: ScanEye, comment: MessageSquare, conflict: TriangleAlert }
const EVIDENCE_KIND = { rule: 'Rule', figma: 'Figma frame', token: 'Token', wcag: 'Accessibility standard', comment: 'Comment', conflict: 'Conflict' }

// Evidence as links: each goes to the thing itself — the rule in the rule
// list, the Figma frame on the canvas, the token's definition, the comment.
// (A file or token name stays as written.)
export function EvidenceLinks({ items, onOpen, className }) {
  if (!items?.length) return null
  return (
    <span className={cn('flex min-w-0 flex-wrap items-center gap-1.5', className)}>
      {items.map((item) => {
        const Icon = EVIDENCE_ICON[item.kind] ?? BookMarked
        const literal = item.kind === 'token' || item.kind === 'wcag'
        return (
          <button
            key={`${item.kind}:${item.id ?? item.label}:${item.conflictId ?? ''}`}
            type="button"
            data-evidence={item.kind}
            title={item.kind === 'comment' ? item.text : undefined}
            aria-label={`${EVIDENCE_KIND[item.kind]}: ${item.label}`}
            onClick={() => onOpen?.(item)}
            className="ds-intrinsic inline-flex h-6 max-w-full shrink-0 cursor-pointer items-center gap-1 rounded-md border border-white/[0.1] bg-white/[0.04] px-1.5 text-[11px] text-slate-200 transition-colors hover:border-white/25 hover:bg-white/[0.09] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300"
          >
            <Icon className="size-3 shrink-0 text-slate-400" />
            {item.kind === 'comment'
              ? <span className="truncate"><span translate="no">{item.label}</span> <LocalizedText text="comment" /></span>
              : literal ? <span translate="no" className="truncate">{item.label}</span>
                : <span className="truncate"><LocalizedText text={item.label} /></span>}
            {item.kind === 'wcag' && <ArrowUpRight className="size-3 shrink-0 text-slate-500" />}
          </button>
        )
      })}
    </span>
  )
}

// Decision and author share one line; sources are available on demand.
export function DecisionSummary({ rationale, onOpen }) {
  const { why, evidence, decision } = rationale
  return (
    <section data-decision-summary aria-label="Decision summary" className="shrink-0 px-1 py-1 text-xs leading-5">
      <p className="flex flex-wrap items-center gap-x-2">
        <span className={decision.deviates ? 'font-medium text-amber-200' : 'font-medium text-white'}><LocalizedText text={decision.label ?? 'Not decided yet'} /></span>
        {decision.by && <span className="text-slate-500"><LocalizedText text="Decided by" /> <span translate="no">{decision.by}</span></span>}
      </p>
      {why && <p className="mt-1 text-slate-300"><LocalizedText text={why.text} /></p>}
      <EvidenceDisclosure items={evidence} onOpen={onOpen} />
    </section>
  )
}

export function EvidenceDisclosure({ items, onOpen }) {
  if (!items?.length) return null
  return <details className="mt-1 text-[11px] text-slate-400">
    <summary className="w-fit cursor-pointer hover:text-white"><LocalizedText text="Evidence" /> · {items.length}</summary>
    <EvidenceLinks items={items} onOpen={onOpen} className="mt-1.5" />
  </details>
}

// One step's reason and its evidence, as a strip (over the replay's code,
// in a History checkpoint's header).
export function ReasonStrip({ text, evidence, onOpen, className, label = 'The why', compact = false }) {
  if (!text && !evidence?.length) return null
  return (
    <div data-step-reason className={cn('flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-5', className)}>
      <span className="shrink-0 font-medium text-slate-500"><LocalizedText text={label} /></span>
      {text && <span className="min-w-0 text-slate-300"><LocalizedText text={text} /></span>}
      {compact ? <EvidenceDisclosure items={evidence} onOpen={onOpen} /> : <EvidenceLinks items={evidence} onOpen={onOpen} />}
    </div>
  )
}

// The design system's rules, as registered: each with why it exists and
// where it comes from. `focusId` marks the one that was followed here.
export function RulesDialog({ focusId, onOpenChange, onOpenSource }) {
  return (
    <Dialog open={Boolean(focusId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] gap-0 overflow-hidden bg-card p-0 sm:max-w-[520px]">
        <div className="px-5 pt-4 pb-3">
          <DialogTitle className="text-sm font-semibold text-white"><LocalizedText text="Design system rules" /></DialogTitle>
          <DialogDescription className="mt-1 text-xs text-slate-400">
            <LocalizedText text="Registered reasons — linked to a change automatically when it runs into a rule." />
          </DialogDescription>
        </div>
        <ul className="max-h-[60vh] space-y-2 overflow-y-auto px-5 pb-5">
          {DESIGN_RULES.map((rule) => (
            <li key={rule.id} data-rule={rule.id} aria-current={rule.id === focusId ? 'true' : undefined} className={cn('rounded-xl p-3', rule.id === focusId ? 'bg-emerald-400/[0.08] ring-1 ring-emerald-300/30' : 'bg-white/[0.03]')}>
              <p className="text-[12.5px] font-medium text-white"><LocalizedText text={rule.title} /></p>
              <p className="mt-1 text-xs leading-[18px] text-slate-300"><LocalizedText text={rule.reason} /></p>
              <EvidenceLinks items={rule.sources} onOpen={onOpenSource} className="mt-2" />
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}

// The reason itself, where it's asked inline (the rollback dialog): the
// usual ones as chips, or one typed in. `value` is the reason so far.
export function ReasonPicker({ value, onChange }) {
  const typed = value && !DEVIATION_REASONS.includes(value) ? value : ''
  return (
    <div data-reason-picker>
      <p className="mb-1.5 text-xs font-medium text-slate-200"><LocalizedText text="Reason for the rollback" /></p>
      <div className="flex flex-wrap gap-1.5">
        {DEVIATION_REASONS.map((option) => (
          <button key={option} type="button" role="radio" aria-checked={value === option} onClick={() => onChange(value === option ? '' : option)} className="ds-intrinsic inline-flex h-7 cursor-pointer items-center rounded-full border border-white/[0.12] bg-white/[0.03] px-2.5 text-[11.5px] text-slate-300 transition-colors hover:border-white/25 hover:text-white aria-checked:border-emerald-300/50 aria-checked:bg-emerald-400/[0.1] aria-checked:text-white">
            <LocalizedText text={option} />
          </button>
        ))}
      </div>
      <input
        value={typed}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Your own reason"
        placeholder="Or write your own reason"
        className="mt-1.5 h-8 w-full rounded-lg border border-white/[0.1] bg-black/20 px-3 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-300/50"
      />
    </div>
  )
}

// Asked only when a decision departs from the standard (`request.kind`: an
// exception, keeping the current implementation, a rollback): the usual
// reasons as choices, or one typed in.
export function DeviationReasonDialog({ request, onSubmit, onCancel }) {
  return (
    <Dialog open={Boolean(request)} onOpenChange={(open) => { if (!open) onCancel() }}>
      <DialogContent showCloseButton={false} className="gap-0 bg-card p-0 sm:max-w-[440px]">
        {request && <DeviationReasonForm key={`${request.kind}:${request.subject ?? ''}`} request={request} onSubmit={onSubmit} onCancel={onCancel} />}
      </DialogContent>
    </Dialog>
  )
}

function DeviationReasonForm({ request, onSubmit, onCancel }) {
  const [preset, setPreset] = useState(null)
  const [text, setText] = useState('')
  const reason = text.trim() || preset
  return (
    <form data-deviation-reason onSubmit={(event) => { event.preventDefault(); if (reason) onSubmit(reason) }}>
      <div className="px-5 pt-4 pb-3">
        <DialogTitle className="text-sm font-semibold text-white"><LocalizedText text="Why depart from the standard?" /></DialogTitle>
        <DialogDescription className="mt-1 text-xs leading-[18px] text-slate-400">
          <span className="font-medium text-slate-200"><LocalizedText text={DEVIATION_LABEL[request.kind]} /></span>
          {request.subject && <> · <LocalizedText text={request.subject} /></>}
          <br />
          <LocalizedText text="A choice that follows the standard needs no reason — this one is kept with the decision." />
        </DialogDescription>
      </div>
      <div className="space-y-1.5 px-5">
        {DEVIATION_REASONS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={preset === option && !text.trim()}
            onClick={() => { setPreset(option); setText('') }}
            className="ds-intrinsic flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-left text-xs text-slate-200 transition-colors hover:border-white/25 hover:bg-white/[0.07] aria-checked:border-emerald-300/50 aria-checked:bg-emerald-400/[0.08] aria-checked:text-white"
          >
            <span className="min-w-0 flex-1"><LocalizedText text={option} /></span>
            {preset === option && !text.trim() && <Check className="size-3.5 shrink-0 text-emerald-300" />}
          </button>
        ))}
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={2}
          aria-label="Your own reason"
          placeholder="Or write your own reason"
          className="mt-1 w-full resize-none rounded-lg border border-white/[0.1] bg-black/20 px-3 py-2 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-300/50"
        />
      </div>
      <div className="flex items-center justify-end gap-2 px-5 pt-3 pb-4">
        <button type="button" onClick={onCancel} className="ds-intrinsic inline-flex h-8 items-center rounded-full px-3 text-xs font-medium text-slate-300 hover:bg-white/[0.07] hover:text-white">Cancel</button>
        <button type="submit" disabled={!reason} className="ds-intrinsic inline-flex h-8 items-center rounded-full bg-emerald-400 px-3.5 text-xs font-semibold text-emerald-950 transition-colors hover:bg-emerald-300 disabled:bg-white/[0.06] disabled:text-slate-500">
          <LocalizedText text="Save reason" />
        </button>
      </div>
    </form>
  )
}
