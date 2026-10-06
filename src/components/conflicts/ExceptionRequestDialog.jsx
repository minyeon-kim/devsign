import { useRef, useState } from 'react'
import { Check, LoaderCircle, Send, TriangleAlert } from 'lucide-react'
import { cn } from 'cn'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { LocalizedText } from '@/i18n/runtime'

// A reason as it's kept on the conflict (the chosen ones, then the typed
// one, joined) — the same form ReasonField hands back.
export const exceptionReasonText = (draft, reasons) => [...reasons.filter((reason) => draft.picked.includes(reason)), draft.typed.trim()].filter(Boolean).join(' · ')
export const exceptionDraftOf = (text, reasons) => {
  const parts = (text ?? '').split(' · ').filter(Boolean)
  return { picked: parts.filter((part) => reasons.includes(part)), typed: parts.filter((part) => !reasons.includes(part)).join(' · ') }
}

// The reason a decision needs, asked when its button is pressed — an
// exception request (what it's for and what it breaks, in the warning
// tone), keeping the current value, or a value set by hand (`title`,
// `reasonTitle`, `reasons` and `submitLabel` say which) — then why:
// chosen, typed, or both. The draft is the caller's, so closing
// and opening again (on the same conflict) keeps what was entered; a send
// that fails leaves it open, with everything still there.
export function ExceptionRequestDialog({ open, onOpenChange, conflict, violations = [], title = 'Send exception request', reasonTitle = 'Reason for the exception request', hint = 'Required · choose all that apply', submitLabel = 'Send request', reasons, draft, onDraftChange, onSend, finalFocus }) {
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const firstChip = useRef(null)
  const ready = draft.picked.length > 0 || draft.typed.trim().length > 0
  const location = conflict?.file ? `${conflict.file}${conflict.line ? `:${conflict.line}` : ''}` : null

  async function send(event) {
    event.preventDefault()
    if (!ready || sending) return
    setSending(true)
    setError(null)
    try {
      await onSend(exceptionReasonText(draft, reasons))
    } catch {
      setError('The request couldn’t be sent. Try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!sending) { setError(null); onOpenChange(next) } }}>
      <DialogContent
        data-exception-dialog
        initialFocus={firstChip}
        finalFocus={finalFocus}
        className="gap-0 bg-card p-0 sm:max-w-[560px] max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-h-[90dvh] max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:overflow-y-auto max-sm:rounded-b-none"
      >
        <form onSubmit={send} aria-busy={sending}>
          <div className="px-5 pt-5 pb-4">
            <DialogTitle className="text-sm font-semibold text-white"><LocalizedText text={title} /></DialogTitle>
            {/* What it's for and what it breaks — the warning the review
                shows, in the same tone. */}
            <DialogDescription render={<div />} data-exception-summary className={cn('mt-3 space-y-1 rounded-lg px-4 py-3 text-xs leading-[18px]', violations.length ? 'bg-amber-400/[0.08]' : 'bg-white/[0.04]')}>
              <p className="font-medium text-white">
                <LocalizedText text={conflict?.token ?? conflict?.title ?? ''} />
                {conflict?.id && <span translate="no" className="ml-1.5 font-normal text-slate-400">#{conflict.id}</span>}
              </p>
              {violations.length > 0 && <p className="flex items-start gap-1.5 text-amber-100">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-300" />
                <span>
                  <LocalizedText text="Breaks a required rule" />
                  {violations.map((entry) => (
                    <span key={entry.label}>
                      {' · '}<LocalizedText text={entry.label} />
                      {entry.from != null && <> <span translate="no">{entry.from}</span> → <LocalizedText text="Design standard" /> <span translate="no">{entry.to}</span></>}
                    </span>
                  ))}
                </span>
              </p>}
              {location && <p translate="no" className={cn(violations.length > 0 && 'pl-5', 'font-mono text-[11px] break-all text-slate-400')}>{location}</p>}
            </DialogDescription>
          </div>
          <div className="space-y-3 px-5 pb-4">
            <p id="exception-reason-label" className="text-xs font-medium text-slate-200">
              <LocalizedText text={reasonTitle} /> <span className="font-normal text-slate-500">· <LocalizedText text={hint} /></span>
            </p>
            <div role="group" aria-labelledby="exception-reason-label" className="flex flex-wrap gap-1.5">
              {reasons.map((reason, index) => {
                const picked = draft.picked.includes(reason)
                return (
                  <button
                    key={reason}
                    ref={index === 0 ? firstChip : undefined}
                    type="button"
                    aria-pressed={picked}
                    disabled={sending}
                    onClick={() => onDraftChange({ ...draft, picked: picked ? draft.picked.filter((entry) => entry !== reason) : [...draft.picked, reason] })}
                    className="ds-intrinsic ds-reason-chip inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-left text-[11px] text-slate-400 hover:border-white/25 hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300 aria-pressed:border-emerald-300/50 aria-pressed:bg-emerald-400/[0.1] aria-pressed:text-white"
                  >
                    {picked && <Check aria-hidden className="size-3 text-emerald-300" />}
                    <LocalizedText text={reason} />
                  </button>
                )
              })}
            </div>
            <textarea
              aria-label="Your own reason"
              placeholder="직접 입력"
              rows={3}
              value={draft.typed}
              disabled={sending}
              onChange={(event) => onDraftChange({ ...draft, typed: event.target.value })}
              className="block w-full min-w-0 resize-none rounded-xl border border-white/15 bg-white/[0.02] px-3 py-2 text-xs leading-[18px] text-white outline-none transition-colors placeholder:text-slate-500 hover:border-white/25 focus:border-emerald-300/60"
            />
            {error && (
              <p role="alert" data-exception-error className="flex items-start gap-1.5 text-xs leading-[18px] text-red-300">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                <LocalizedText text={error} />
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.07] px-5 py-4">
            {!ready && <p id="exception-send-hint" data-exception-hint className="mr-auto text-[11px] text-slate-400"><LocalizedText text="Choose or enter at least one reason" /></p>}
            <button type="button" disabled={sending} onClick={() => onOpenChange(false)} className="ds-intrinsic inline-flex h-8 items-center rounded-full px-3 text-xs font-medium text-slate-300 hover:bg-white/[0.07] hover:text-white disabled:opacity-45">
              <LocalizedText text="Cancel" />
            </button>
            <button type="submit" data-exception-send disabled={!ready || sending} aria-describedby={ready ? undefined : 'exception-send-hint'} className="ds-intrinsic inline-flex h-8 items-center rounded-full bg-emerald-400 px-3.5 text-xs font-semibold text-emerald-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-slate-500">
              {sending ? <LoaderCircle className="mr-1.5 size-3.5 animate-spin" /> : <Send className="mr-1.5 size-3.5" />}
              <LocalizedText text={sending ? 'Sending…' : submitLabel} />
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
