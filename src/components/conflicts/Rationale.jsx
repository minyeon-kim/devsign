import { useState } from 'react'
import { ArrowUpRight, BookMarked, Braces, Check, Frame, MessageSquare, ScanEye, TriangleAlert } from 'lucide-react'
import { cn } from 'cn'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
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
export function EvidenceLinks({ items, onOpen, className, limit = Infinity }) {
  const [expanded, setExpanded] = useState(false)
  if (!items?.length) return null
  const visible = expanded ? items : items.slice(0, limit)
  const more = (
    <button type="button" data-evidence-more aria-expanded={expanded} onClick={() => setExpanded((value) => !value)} className="ds-intrinsic h-6 shrink-0 rounded-md px-2 text-[11px] whitespace-nowrap text-slate-400 hover:bg-white/[0.06] hover:text-white">
      {expanded ? <LocalizedText text="Show less" /> : `+${items.length - limit}`}
    </button>
  )
  return (
    <span className={cn('flex min-w-0 flex-wrap items-center gap-1.5', className)}>
      {visible.map((item, position) => {
        const Icon = EVIDENCE_ICON[item.kind] ?? BookMarked
        const literal = item.kind === 'token' || item.kind === 'wcag'
        const rule = item.kind === 'rule' ? DESIGN_RULES.find((candidate) => candidate.id === item.id) : null
        const key = `${item.kind}:${item.id ?? item.label}:${item.conflictId ?? ''}`
        const chip = (
          <button
            key={`${item.kind}:${item.id ?? item.label}:${item.conflictId ?? ''}`}
            type="button"
            data-evidence={item.kind}
            aria-label={`${EVIDENCE_KIND[item.kind]}: ${item.label}`}
            onClick={rule ? undefined : () => onOpen?.(item)}
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
        // The "+N" stays beside the last chip rather than wrapping alone.
        const tail = position === visible.length - 1 && items.length > limit ? more : null
        const withTail = (node) => (tail ? <span key={key} className="inline-flex max-w-full min-w-0 items-center gap-1.5">{node}{tail}</span> : node)
        if (!rule && !item.text) return withTail(chip)
        return withTail(<Tooltip key={key}>
          {/* (The click is given to the trigger too: wrapped as a tooltip's
              trigger, the chip's own handler wasn't reaching it.) */}
          <TooltipTrigger render={chip} onClick={rule ? undefined : () => onOpen?.(item)} />
          <TooltipContent side="top" align="start" className="max-w-xs flex-col items-start gap-1 py-2 leading-5">
            {rule ? <>
              <span className="font-medium"><LocalizedText text={rule.title} /></span>
              <span className="text-slate-300"><LocalizedText text={rule.reason} /></span>
              <span className="text-[11px] text-slate-400">{rule.sources.map((source) => source.label).join(' · ')}</span>
            </> : <LocalizedText text={item.text} />}
          </TooltipContent>
        </Tooltip>)
      })}
    </span>
  )
}

// Keep the decision context in three stable rows, with three key sources.
export function DecisionSummary({ rationale, onOpen, embedded = false }) {
  const { why, evidence, decision } = rationale
  const core = ['figma', 'token', 'comment'].map((kind) => evidence.find((item) => item.kind === kind)).filter(Boolean)
  const ordered = [...core, ...evidence.filter((item) => !core.includes(item))]
  return (
    <section data-decision-summary aria-label="Decision summary" className={cn('shrink-0 text-xs leading-[18px]', embedded ? 'border-t border-white/[0.07] pt-3' : 'rounded-xl bg-white/[0.03] px-3 py-3')}>
      <dl className="grid grid-cols-[64px_minmax(0,1fr)] items-start gap-x-3 gap-y-2">
        {/* Embedded in the review's left card, the why is already its
            "Why it matters" line above — not said a second time here. */}
        {!embedded && <>
          <dt className="text-[11px] text-slate-400"><LocalizedText text="The why" /></dt>
          <dd className="text-slate-200"><LocalizedText text={why?.text ?? 'No reason linked yet'} /></dd>
        </>}
        <dt className="text-[11px] text-slate-400"><LocalizedText text="Evidence" /></dt>
        <dd className="min-w-0">{ordered.length ? <EvidenceLinks items={ordered} onOpen={onOpen} limit={3} /> : '—'}</dd>
        <dt className="text-[11px] text-slate-400"><LocalizedText text="Decision" /></dt>
        <dd className="flex flex-wrap items-center gap-x-2">
          <span className={'text-slate-200'}><LocalizedText text={decision.label ?? 'Not decided yet'} /></span>
          {decision.by && <span translate="no" className="text-[11px] text-slate-400">· {decision.by}</span>}
        </dd>
      </dl>
    </section>
  )
}

// One step's reason and its evidence, as a strip (over the replay's code,
// in a History checkpoint's header).
export function ReasonStrip({ text, evidence, onOpen, className, label = 'The why' }) {
  if (!text && !evidence?.length) return null
  return (
    <div data-step-reason className={cn('flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-5', className)}>
      <span className="shrink-0 font-medium text-slate-500"><LocalizedText text={label} /></span>
      {text && <span className="min-w-0 text-slate-300"><LocalizedText text={text} /></span>}
      <EvidenceLinks items={evidence} onOpen={onOpen} />
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
  // Several can apply: kept as one line, joined with " · ".
  const parts = (value ?? '').split(' · ').filter(Boolean)
  const chosen = parts.filter((part) => DEVIATION_REASONS.includes(part))
  const typed = parts.filter((part) => !DEVIATION_REASONS.includes(part)).join(' · ')
  const emit = (nextChosen, nextTyped) => onChange([...DEVIATION_REASONS.filter((reason) => nextChosen.includes(reason)), nextTyped].filter((part) => part.trim()).join(' · '))
  return (
    <div data-reason-picker>
      <p className="mb-1.5 text-xs font-medium text-slate-200"><LocalizedText text="Reason for the rollback" /></p>
      <div className="flex flex-wrap gap-1.5">
        {DEVIATION_REASONS.map((option) => (
          <button key={option} type="button" role="checkbox" aria-checked={chosen.includes(option)} onClick={() => emit(chosen.includes(option) ? chosen.filter((entry) => entry !== option) : [...chosen, option], typed)} className="ds-intrinsic inline-flex h-7 cursor-pointer items-center rounded-full border border-white/[0.12] bg-white/[0.03] px-2.5 text-[11.5px] text-slate-300 transition-colors hover:border-white/25 hover:text-white aria-checked:border-emerald-300/50 aria-checked:bg-emerald-400/[0.1] aria-checked:text-white">
            <LocalizedText text={option} />
          </button>
        ))}
      </div>
      <input
        value={typed}
        onChange={(event) => emit(chosen, event.target.value)}
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

// Lives below the selected card, outside its radio click target.
export function InlineDeviationReason({ value, onSave, readOnly = false }) {
  const [editing, setEditing] = useState(false)
  // Several reasons can apply at once: any of the usual ones, ticked, plus
  // one typed in. They're kept as one line, joined with " · ".
  const parts = (value ?? '').split(' · ').filter(Boolean)
  const [picked, setPicked] = useState(() => parts.filter((part) => DEVIATION_REASONS.includes(part)))
  const [draft, setDraft] = useState(() => parts.filter((part) => !DEVIATION_REASONS.includes(part)).join(' · '))
  const toggle = (reason) => setPicked((current) => (current.includes(reason) ? current.filter((entry) => entry !== reason) : [...current, reason]))
  const combined = [...DEVIATION_REASONS.filter((reason) => picked.includes(reason)), draft.trim()].filter(Boolean)
  const save = () => {
    if (!combined.length) return
    onSave(combined.join(' · '))
    setEditing(false)
  }
  if (value && !editing) return <p key="saved" role="status" className="ds-reason-enter mt-3 flex flex-wrap items-center gap-x-1 text-xs leading-5 text-slate-300">
    <Check aria-hidden className="mr-1 size-3.5 text-slate-400" />
    <LocalizedText text="Reason" />: <LocalizedText text={value} />
    {!readOnly && <button type="button" onClick={() => setEditing(true)} className="ml-1 rounded px-1 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300">· <LocalizedText text="Edit reason" /></button>}
  </p>
  if (readOnly) return null
  return <div key="editing" className="ds-reason-reveal"><div className="min-h-0 overflow-hidden">
  <form data-inline-deviation-reason className="space-y-2.5 px-1 pt-3 pb-1" onSubmit={(event) => { event.preventDefault(); save() }}>
    <p className="text-xs font-medium text-slate-300"><LocalizedText text="Why depart from the standard?" /> <span className="font-normal text-slate-500">· <LocalizedText text="Choose all that apply" /></span></p>
    <div className="flex flex-wrap gap-1.5">
      {DEVIATION_REASONS.map((reason) => <button key={reason} type="button" role="checkbox" aria-checked={picked.includes(reason)} onClick={() => toggle(reason)} className="ds-intrinsic ds-reason-chip inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-left text-[11px] text-slate-400 hover:border-white/25 hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300 aria-checked:border-emerald-300/50 aria-checked:bg-emerald-400/[0.1] aria-checked:text-white">{picked.includes(reason) && <Check aria-hidden className="size-3 text-emerald-300" />}<LocalizedText text={reason} /></button>)}
    </div>
    <div className="flex items-center gap-2">
      <input autoFocus={editing} aria-label="Your own reason" placeholder="직접 이유 입력" value={draft} onChange={(event) => setDraft(event.target.value)} className="h-8 min-w-0 flex-1 rounded-full border border-white/15 bg-white/[0.02] px-3 text-xs text-white outline-none transition-colors placeholder:text-slate-500 hover:border-white/25 focus:border-emerald-300/60" />
      <button type="submit" disabled={!combined.length} className="ds-reason-chip h-8 rounded-full px-3 text-xs font-medium text-slate-200 transition-colors hover:bg-white/[0.07] focus-visible:outline-2 focus-visible:outline-emerald-300 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"><LocalizedText text="Save" /></button>
    </div>
  </form>
  </div></div>
}
