import { ArrowUpRight, Check, CircleCheck, Clock3, RotateCcw, TriangleAlert, Wrench, X } from 'lucide-react'
import { cn } from 'cn'
import { LocalizedText } from '@/i18n/runtime'
import { useLanguage } from '@/i18n/language'
import { useWorkspace } from '@/state/WorkspaceProvider'

// Each check offers a concrete resolution, or navigation to its editor.

const ACTION = 'ds-intrinsic inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium whitespace-nowrap transition-colors'
const ACTION_PRIMARY = 'bg-white/[0.1] text-white hover:bg-white/[0.16]'
const ACTION_QUIET = 'bg-white/[0.05] text-slate-200 hover:bg-white/[0.1] hover:text-white'

// Neutral: amber is kept for the "can't merge" label these sit under.
function Tag({ required, ko }) {
  return (
    <span className="shrink-0 rounded bg-white/[0.07] px-1.5 py-0.5 text-[10.5px] leading-none font-medium text-slate-300">
      {required ? (ko ? '필수' : 'Required') : (ko ? '권장' : 'Suggestion')}
    </span>
  )
}

// `only`: the failing checks to list here (the review shows required ones
// and suggestions in different places); `showAccepted` adds the ones being
// applied as they are.
// What can be done about a check depends on which kind it is:
//   · a suggestion — fix it, or apply the change as it is;
//   · a required one — fix it, or request an exception. It can't simply be
//     waived: the exception goes to the reviewers, and the check stops
//     blocking only once they've approved the change with it.
export function CheckDecisions({ checks, only, showAccepted = !only, onFix, fixSideFor, onAccept, onUndoAccept, onRequestException, onUndoException }) {
  const ko = useLanguage() === 'ko'
  const failing = only ?? checks?.failing ?? []
  const accepted = showAccepted ? checks?.accepted ?? [] : []
  const exceptions = checks?.exceptions ?? []
  // Exceptions the reviewers approved, listed with what was applied as is.
  const granted = showAccepted && checks?.exceptionsGranted ? exceptions : []
  if (!checks || (!failing.length && !accepted.length && !granted.length)) return null
  return (
    // Rows, not boxes: a hairline between checks.
    <ul className="mt-1.5 divide-y divide-white/[0.07]">
      {failing.map((check) => {
        const required = checks.blocking.includes(check)
        const requested = exceptions.includes(check)
        const fixSide = fixSideFor?.(check)
        return (
          <li key={check.id} className="py-2.5">
            <p className="flex min-w-0 items-start gap-1.5 text-xs leading-[18px] font-medium text-white">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1 break-words"><LocalizedText text={check.title} /></span>
              <Tag required={required} ko={ko} />
            </p>
            {!check.details?.length && check.hint && <p className="mt-1 pl-5 text-xs leading-[18px] text-slate-300"><LocalizedText text={check.hint} /></p>}
            <div className="pl-5"><CheckValueDetails check={check} /></div>
            {requested ? (
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 pl-5 text-xs leading-[18px] text-slate-300">
                <Clock3 className="size-3.5 shrink-0 text-slate-400" />
                {ko ? '예외 요청됨 · 검토자가 승인하면 병합할 수 있어요' : 'Exception requested · it can merge once the reviewers approve'}
                {onUndoException && (
                  <button type="button" onClick={() => onUndoException(check)} className={cn(ACTION, 'h-6 px-2 text-slate-400 hover:bg-white/[0.07] hover:text-white')}>
                    <RotateCcw className="size-3" />
                    {ko ? '요청 취소' : 'Withdraw'}
                  </button>
                )}
              </p>
            ) : (onFix || onAccept || onRequestException) && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-5">
                {onFix && (
                  <button type="button" onClick={() => onFix(check)} className={cn(ACTION, ACTION_PRIMARY)}>
                    {fixSide ? <Check className="size-3" /> : <ArrowUpRight className="size-3" />}
                    {fixSide === 'A' ? (ko ? '디자인 기준 적용' : 'Apply design reference')
                      : fixSide === 'B' ? (ko ? '현재 구현 적용' : 'Apply current implementation')
                        : (ko ? '수정 위치로 이동' : 'Go to fix')}
                  </button>
                )}
                {required ? onRequestException && (
                  <button type="button" onClick={() => onRequestException(check)} className={cn(ACTION, ACTION_QUIET)}>
                    {ko ? '예외 요청' : 'Request exception'}
                  </button>
                ) : onAccept && (
                  <button type="button" onClick={() => onAccept(check)} className={cn(ACTION, ACTION_QUIET)}>
                    {ko ? '그대로 반영' : 'Apply as is'}
                  </button>
                )}
              </div>
            )}
          </li>
        )
      })}
      {accepted.map((check) => (
        <li key={check.id} className="flex min-w-0 items-center gap-1.5 py-2 text-xs leading-[18px] text-slate-400">
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
      {granted.map((check) => (
        <li key={check.id} className="flex min-w-0 items-center gap-1.5 py-2 text-xs leading-[18px] text-slate-400">
          <Check className="size-3.5 shrink-0 text-slate-400" />
          <span className="min-w-0 flex-1 break-words">
            <LocalizedText text={check.title} />
            <span className="text-slate-500"> · {ko ? '예외 승인됨' : 'Exception approved'}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

// Show the actual property values everywhere a token failure is explained.
export function CheckValueDetails({ check, onApply }) {
  const ko = useLanguage() === 'ko'
  if (!check.details?.length) return null
  return <ul className="mt-2 space-y-3 text-xs leading-5">
    {check.details.map((detail) => <li key={detail.key}>
      <p className="font-medium text-white"><LocalizedText text={detail.element} /> · <LocalizedText text={detail.property} /></p>
      <p className="text-slate-200">{ko ? '현재' : 'Current'} <span className="font-semibold text-red-300"><LocalizedText text={detail.current} /></span> → {ko ? '디자인 기준' : 'Design reference'} <span className="font-semibold text-emerald-200"><LocalizedText text={detail.expected} /></span></p>
      {detail.reason && <p className="text-slate-400"><LocalizedText text={detail.reason} /></p>}
      {onApply && detail.canApply && <button type="button" className={cn(ACTION, ACTION_PRIMARY, 'mt-1.5')} onClick={() => onApply(detail)}>
        <Check className="size-3" />{ko ? '기준값 ' : 'Apply reference value '}<LocalizedText text={detail.expected} />{ko ? ' 적용' : ''}
      </button>}
    </li>)}
  </ul>
}

// The guide for the check being fixed: what's wrong and where to change
// it. `resolved` once the check passes. `action` is the way onward (Merge
// Studio, the editor), when there is one from where this is shown.
export function CheckGuideNote({ check, resolved = false, where, action, onApply, onClose, className }) {
  const ko = useLanguage() === 'ko'
  if (!check) return null
  return (
    <div role="status" className={cn('flex min-w-0 items-start gap-2.5 rounded-xl p-3', resolved ? 'bg-emerald-400/10' : 'bg-amber-400/10', className)}>
      {resolved ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-300" /> : <Wrench className="mt-0.5 size-4 shrink-0 text-amber-300" />}
      <div className="min-w-0 flex-1">
        <p className={cn('text-[11px] leading-4 font-medium', resolved ? 'text-emerald-200' : 'text-amber-200')}>
          {resolved ? (ko ? '해결됨' : 'Fixed') : (ko ? '수정할 항목' : 'What to fix')}
        </p>
        <p className="mt-0.5 text-[13px] leading-5 font-medium break-words text-white"><LocalizedText text={check.title} /></p>
        {!resolved && !check.details?.length && check.hint && <p className="mt-0.5 text-xs leading-[18px] break-words text-slate-200"><LocalizedText text={check.hint} /></p>}
        {!resolved && <CheckValueDetails check={check} onApply={onApply} />}
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
  const { checkGuide, setCheckGuide, conflicts, decideDrift } = useWorkspace()
  const ko = useLanguage() === 'ko'
  if (!checkGuide || !item) return null
  const conflict = conflicts.find((c) => c.id === checkGuide.conflictId)
  if (!conflict || !(conflict.mergeItemId === item.id || item.conflictId === conflict.id)) return null
  const live = checks?.failing.find((check) => check.id === checkGuide.check.id)
  const resolved = Boolean(checks) && !live
  const check = live ?? checks?.checks?.find((entry) => entry.id === checkGuide.check.id) ?? checkGuide.check
  return (
    <>
      {!resolved && !check.details?.length && <CheckGuideHighlight layerId={check.layerId ?? conflict.layerId} />}
      <div className="pointer-events-none fixed inset-x-0 top-[104px] z-[540] flex justify-center px-4">
        <div className="pointer-events-auto w-[440px] max-w-full rounded-xl bg-[#1D1D1D] shadow-[0_12px_40px_rgba(0,0,0,0.55)]">
          <CheckGuideNote
            check={check}
            resolved={resolved}
            onApply={(detail) => decideDrift(item.id, detail.key, 'A')}
            where={check.editHint ? <LocalizedText text={check.editHint} /> : check.details?.length ? (ko
              ? '기준값 적용 버튼으로 해당 속성을 변경하세요.'
              : 'Apply the reference value above to update this property.') : ko
              ? '노란 테두리로 표시된 요소를 선택해 값을 조정하세요. 검사를 통과하면 여기에 해결됨으로 표시됩니다.'
              : 'Select the element outlined in yellow and adjust its value. This turns to Fixed once the check passes.'}
            onClose={() => setCheckGuide(null)}
          />
        </div>
      </div>
    </>
  )
}
