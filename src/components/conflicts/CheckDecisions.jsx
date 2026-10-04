import { ArrowUpRight, Check, CircleCheck, RotateCcw, TriangleAlert, Wrench, X } from 'lucide-react'
import { cn } from 'cn'
import { LocalizedText } from '@/i18n/runtime'
import { useLanguage } from '@/i18n/language'
import { useWorkspace } from '@/state/WorkspaceProvider'

// A failing check is a decision, not just a status: fix it, or ship the
// change as it is. The review lists each one with both choices (the
// popover behind CheckStatus only reported them), and choosing Fix leaves a
// guide — the same note here, on the review's comparison card and in Merge
// Studio — saying what to change, with the element highlighted.

const ACTION = 'ds-intrinsic inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium whitespace-nowrap transition-colors'

function Tag({ required, ko }) {
  return (
    <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10.5px] leading-none font-medium', required ? 'bg-amber-400/15 text-amber-200' : 'bg-white/[0.07] text-slate-300')}>
      {required ? (ko ? '필수' : 'Required') : (ko ? '권장' : 'Suggestion')}
    </span>
  )
}

// `activeId`: the check being fixed right now (its guide is open).
export function CheckDecisions({ checks, activeId, onFix, onAccept, onUndoAccept }) {
  const ko = useLanguage() === 'ko'
  if (!checks || (!checks.failing.length && !checks.accepted?.length)) return null
  return (
    <ul className="mt-2 space-y-1.5">
      {checks.failing.map((check) => {
        const required = checks.blocking.includes(check)
        return (
          <li key={check.id} className={cn('rounded-lg p-2.5', required ? 'bg-amber-400/[0.07] ring-1 ring-amber-300/25 ring-inset' : 'bg-white/[0.04]', activeId === check.id && 'ring-1 ring-amber-300/70 ring-inset')}>
            <p className="flex min-w-0 items-start gap-1.5 text-xs leading-[18px] font-medium text-white">
              <TriangleAlert className={cn('mt-0.5 size-3.5 shrink-0', required ? 'text-amber-300' : 'text-slate-400')} />
              <span className="min-w-0 flex-1 break-words"><LocalizedText text={check.title} /></span>
              <Tag required={required} ko={ko} />
            </p>
            {check.hint && <p className="mt-1 pl-5 text-xs leading-[18px] text-slate-300"><LocalizedText text={check.hint} /></p>}
            {(onFix || onAccept) && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-5">
                {onFix && (
                  <button type="button" onClick={() => onFix(check)} className={cn(ACTION, 'bg-amber-300 text-slate-950 hover:bg-amber-200')}>
                    <Wrench className="size-3" />
                    {ko ? '수정하기' : 'Fix it'}
                  </button>
                )}
                {onAccept && (
                  <button type="button" onClick={() => onAccept(check)} className={cn(ACTION, 'bg-white/[0.07] text-slate-200 hover:bg-white/[0.12] hover:text-white')}>
                    {ko ? '그대로 반영' : 'Apply as is'}
                  </button>
                )}
              </div>
            )}
          </li>
        )
      })}
      {(checks.accepted ?? []).map((check) => (
        <li key={check.id} className="flex min-w-0 items-center gap-1.5 rounded-lg bg-white/[0.03] px-2.5 py-2 text-xs leading-[18px] text-slate-400">
          <Check className="size-3.5 shrink-0 text-slate-400" />
          <span className="min-w-0 flex-1 break-words">
            <LocalizedText text={check.title} />
            <span className="text-slate-500"> · {ko ? '그대로 반영하기로 함' : 'Applying as is'}</span>
          </span>
          {onUndoAccept && (
            <button type="button" onClick={() => onUndoAccept(check)} className={cn(ACTION, 'h-6 px-2 text-slate-400 hover:bg-white/[0.07] hover:text-white')}>
              <RotateCcw className="size-3" />
              {ko ? '되돌리기' : 'Undo'}
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

// The guide for the check being fixed: what's wrong and where to change
// it. `resolved` once the check passes. `action` is the way onward (Merge
// Studio, the editor), when there is one from where this is shown.
export function CheckGuideNote({ check, resolved = false, where, action, onClose, className }) {
  const ko = useLanguage() === 'ko'
  if (!check) return null
  return (
    <div role="status" className={cn('flex min-w-0 items-start gap-2.5 rounded-xl p-3 ring-1 ring-inset', resolved ? 'bg-emerald-400/10 ring-emerald-300/40' : 'bg-amber-400/10 ring-amber-300/50', className)}>
      {resolved ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-300" /> : <Wrench className="mt-0.5 size-4 shrink-0 text-amber-300" />}
      <div className="min-w-0 flex-1">
        <p className={cn('text-[11px] leading-4 font-medium', resolved ? 'text-emerald-200' : 'text-amber-200')}>
          {resolved ? (ko ? '해결됨' : 'Fixed') : (ko ? '수정할 항목' : 'What to fix')}
        </p>
        <p className="mt-0.5 text-[13px] leading-5 font-medium break-words text-white"><LocalizedText text={check.title} /></p>
        {!resolved && check.hint && <p className="mt-0.5 text-xs leading-[18px] break-words text-slate-200"><LocalizedText text={check.hint} /></p>}
        {!resolved && where && <p className="mt-1.5 text-xs leading-[18px] text-slate-300">{where}</p>}
        {!resolved && action && (
          <button type="button" onClick={action.onClick} className={cn(ACTION, 'mt-2 bg-white/[0.08] text-white hover:bg-white/[0.14]')}>
            {action.label}
            <ArrowUpRight className="size-3.5 opacity-70" />
          </button>
        )}
      </div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label={ko ? '가이드 닫기' : 'Close guide'} title={ko ? '가이드 닫기' : 'Close guide'} className="ds-intrinsic flex size-6 shrink-0 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

// Keeps the element the guide is about marked on every artboard showing it
// (layers carry `data-layer-id`), for as long as the guide is open.
export function CheckGuideHighlight({ layerId }) {
  if (!layerId) return null
  const selector = `[data-layer-id="${CSS.escape(layerId)}"]`
  return (
    <style>{`
      @keyframes check-guide-pulse { 50% { outline-color: rgb(252 211 77 / 35%); } }
      ${selector} { outline: 2px solid rgb(252 211 77); outline-offset: 4px; animation: check-guide-pulse 1.6s ease-in-out infinite; }
    `}</style>
  )
}

// Merge Studio's side of the guide: the same note, floating over the
// canvas, with the element marked — so arriving from the review's "Fix it"
// says what to change here and when it's done. `checks` are the studio's
// live ones, so the note turns to Fixed as soon as the check passes.
export function MergeCheckGuide({ item, checks }) {
  const { checkGuide, setCheckGuide, conflicts } = useWorkspace()
  const ko = useLanguage() === 'ko'
  if (!checkGuide || !item) return null
  const conflict = conflicts.find((c) => c.id === checkGuide.conflictId)
  if (!conflict || !(conflict.mergeItemId === item.id || item.conflictId === conflict.id)) return null
  const live = checks?.failing.find((check) => check.id === checkGuide.check.id)
  const resolved = Boolean(checks) && !live
  const check = live ?? checkGuide.check
  return (
    <>
      {!resolved && <CheckGuideHighlight layerId={check.layerId ?? conflict.layerId} />}
      <div className="pointer-events-none fixed inset-x-0 top-[104px] z-[540] flex justify-center px-4">
        <div className="pointer-events-auto w-[440px] max-w-full rounded-xl bg-[#1D1D1D] shadow-[0_12px_40px_rgba(0,0,0,0.55)]">
          <CheckGuideNote
            check={check}
            resolved={resolved}
            where={ko
              ? '노란 테두리로 표시된 요소를 선택해 값을 조정하세요. 검사를 통과하면 여기에 해결됨으로 표시됩니다.'
              : 'Select the element outlined in yellow and adjust its value. This turns to Fixed once the check passes.'}
            onClose={() => setCheckGuide(null)}
          />
        </div>
      </div>
    </>
  )
}
