import { formatTime, isSystemActor, relativeTimeOf, stepActionOf } from '@/lib/conflictEvents'

// The line under a finished progress step: who (a person's name, or the
// system as an icon and what it did) and when — absolute, in the app's one
// time format; "4분 전" is the tooltip.
export default function StepMeta({ step, onOpenSource }) {
  const { first, last } = step
  if (!last) return null
  let action = stepActionOf(last)
  // Step 4 reads as one: the fix and its check.
  if (step.step === 4 && first && last.type === 'verified' && first.type === 'fixed') {
    const fixer = stepActionOf(first)
    const check = `${last.payload?.width ?? 768}px ${last.payload?.match === false ? '차이 있음' : '검증 통과'}`
    action = fixer.system
      ? { system: true, text: `자동 수정 · ${check}` }
      : { system: false, name: first.actor.name, text: `수정 · ${check}` }
  }
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1">
      {!action.system && <span className="text-slate-300">{action.name}</span>}
      {action.text && <span>{!action.system && '· '}{action.text}</span>}
      {action.commit && onOpenSource && (
        <button type="button" data-source-link onClick={onOpenSource} className="ds-intrinsic underline underline-offset-2 hover:text-slate-200">기록 보기</button>
      )}
      <span aria-hidden>·</span>
      <time dateTime={last.createdAt} title={relativeTimeOf(last.createdAt)} className="tabular-nums">{formatTime(last.createdAt)}</time>
    </span>
  )
}
export { isSystemActor }
