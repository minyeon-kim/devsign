import { useRef, useState } from 'react'
import { cn } from 'cn'

// The one tool a value is picked with on the 해결 방법 card: a scale of steps,
// smallest first — a spacing's tokens, a weight's, a palette's colours. What
// the steps are is the change's adapter's to say (lib/changeAdapters.scaleOf);
// this draws them the same way for every kind.
//
//   · each step: its value, its token's name under it; "현재" over what the
//     code has, "원안" over what the design has.
//   · the pointer or the focus on a step tries it (`onTry`: the picture shows
//     it); a click, Enter or Space takes it (`onPick`). ← / → move along.
//   · 직접 입력, at the end: a field for a value that isn't on the scale —
//     shown only once asked for. One that's no token is said so, and kept.
//
//   scale: { label, unit, custom, steps: [{ key, value, label, token, swatch }], designKey, currentKey }
//   selectedKey: the step that's taken (null: none yet)
//   onCustom(text): a typed value (as typed); `customNote`: what's said under it
export default function ValueScale({ scale, selectedKey, onTry, onPick, customText = '', onCustom, customNote = null }) {
  const refs = useRef([])
  const offScale = selectedKey != null && !scale.steps.some((step) => step.key === selectedKey)
  const [typing, setTyping] = useState(offScale)
  const focusAt = scale.steps.findIndex((step) => step.key === selectedKey)
  const move = (event, index) => {
    const by = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : event.key === 'Home' ? -index : event.key === 'End' ? scale.steps.length - 1 - index : 0
    if (!by) return
    event.preventDefault()
    refs.current[(index + by + scale.steps.length) % scale.steps.length]?.focus()
  }
  return (
    <div data-value-scale className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-wrap items-end gap-x-3 gap-y-2">
        <div role="radiogroup" aria-label={`${scale.label}${scale.unit ? ` (${scale.unit})` : ''}`} className="flex min-w-0 flex-wrap items-end gap-1.5">
          {scale.steps.map((step, index) => {
            const on = step.key === selectedKey
            const mark = step.key === scale.designKey ? '원안' : step.key === scale.currentKey ? '현재' : null
            return (
              <span key={step.key} className="flex flex-col items-center gap-1">
                {/* (A row of its own over every step, so the steps stay on one line.) */}
                <span data-scale-mark={mark ? (step.key === scale.designKey ? 'design' : 'current') : undefined} className="h-3.5 text-[10.5px] leading-[14px] font-medium text-slate-400">{mark}</span>
                <button
                  ref={(node) => { refs.current[index] = node }}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={`${step.value}${mark ? ` · ${mark}` : ''}`}
                  data-scale-step={step.key}
                  tabIndex={on || (focusAt < 0 && index === 0) ? 0 : -1}
                  onClick={() => onPick(step)}
                  onKeyDown={(event) => move(event, index)}
                  onMouseEnter={() => onTry(step)}
                  onMouseLeave={() => onTry(null)}
                  onFocus={() => onTry(step)}
                  onBlur={() => onTry(null)}
                  className={cn(
                    'ds-intrinsic flex h-12 min-w-14 flex-col items-center justify-center gap-0.5 rounded-xl px-2.5 ring-1 transition-colors ring-inset focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-300',
                    on ? 'bg-emerald-400/15 text-emerald-50 ring-emerald-400/70' : 'bg-white/[0.03] text-slate-200 ring-white/10 hover:bg-white/[0.07] hover:text-white',
                  )}
                >
                  <span className="flex items-center gap-1.5 text-[13px] leading-4 font-semibold" translate="no">
                    {step.swatch && <span aria-hidden data-swatch className="size-3 shrink-0 rounded-full ring-1 ring-white/30" style={{ background: step.swatch }} />}
                    {step.label}
                  </span>
                  <span className="text-[10px] leading-3 text-slate-400" translate="no">{step.token ?? ' '}</span>
                </button>
              </span>
            )
          })}
        </div>
        {scale.custom && !typing && (
          <button type="button" data-scale-custom-open onClick={() => setTyping(true)} className="ds-intrinsic mb-3.5 rounded-md px-1.5 py-1 text-xs text-slate-400 underline-offset-2 transition-colors hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-emerald-300">
            직접 입력
          </button>
        )}
      </div>
      {scale.custom && typing && (
        <div data-scale-custom className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-400">
            직접 입력
            <input
              autoFocus={!offScale}
              type="text"
              inputMode={scale.custom === 'px' ? 'decimal' : 'text'}
              data-scale-custom-input
              value={customText}
              onChange={(event) => onCustom(event.target.value)}
              placeholder={scale.custom === 'hex' ? '#000000' : scale.custom === 'px' ? '0' : ''}
              aria-describedby={customNote ? 'scale-custom-note' : undefined}
              className="h-8 w-24 rounded-lg border border-white/10 bg-black/20 px-2.5 text-[13px] text-slate-100 outline-none focus:border-white/30"
            />
            {scale.unit && <span translate="no">{scale.unit}</span>}
          </label>
          {customNote && <p id="scale-custom-note" data-scale-custom-note role="status" className="text-xs text-amber-200">{customNote}</p>}
        </div>
      )}
    </div>
  )
}
