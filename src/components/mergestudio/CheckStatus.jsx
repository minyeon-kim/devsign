import { useState } from 'react'
import { CheckValueDetails } from '@/components/conflicts/CheckDecisions'
import { CircleCheck, TriangleAlert, ChevronDown, ArrowUpRight } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { LocalizedText } from '@/i18n/runtime'
import { useLanguage } from '@/i18n/language'

// `quiet`: passing reads as neutral text (the review keeps its accent for
// the decision), instead of the mint used on the canvas.
// `compact`: just the icon (and the count when something's off), the
// wording in its tooltip — for the slim element picker.
export default function CheckStatus({ checks, onFix, quiet = false, compact = false }) {
  const [open, setOpen] = useState(false)
  const language = useLanguage()
  if (!checks) return null
  const blocked = checks.blocking.length
  const warnings = checks.failing.length - blocked
  const ko = language === 'ko'
  const label = blocked ? (ko ? `병합 전 해결할 문제 ${blocked}개` : `${blocked} issues blocking merge`)
    : warnings ? (ko ? `필수 검사 통과 · 권장 사항 ${warnings}개` : `Required checks passed · ${warnings} suggestions`)
      : (ko ? '모든 검사 통과' : 'All checks passed')
  return <Popover open={open} onOpenChange={setOpen}>
    {compact ? (
      <PopoverTrigger data-check-status={blocked ? 'blocked' : warnings ? 'warnings' : 'ok'} title={label} aria-label={label} className={`ds-intrinsic inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-1.5 text-[11px] font-semibold tabular-nums transition-colors hover:bg-white/[0.08] ${blocked ? 'text-amber-300' : warnings ? 'text-amber-200/80' : 'text-emerald-300'}`}>
        {blocked || warnings ? <TriangleAlert className="size-3.5" /> : <CircleCheck className="size-3.5" />}
        {(blocked || warnings) > 0 && <span>{blocked || warnings}</span>}
      </PopoverTrigger>
    ) : (
    // Blocked is the one state that needs acting on, so it's a filled
    // amber pill; passing stays quiet text.
    <PopoverTrigger className={`ds-intrinsic inline-flex items-center gap-1.5 rounded-full ${blocked ? 'h-8 bg-amber-400/15 px-3 text-xs font-semibold text-amber-200 ring-1 ring-amber-300/50 ring-inset hover:bg-amber-400/25' : `h-7 px-2 text-xs hover:bg-white/5 ${quiet ? 'text-slate-300' : 'text-emerald-300'}`}`}>
      {blocked ? <TriangleAlert className="size-4" /> : <CircleCheck className="size-3.5" />}
      <span aria-live="polite">{label}</span><ChevronDown className="size-3.5" />
    </PopoverTrigger>
    )}
    {compact ? <CompactChecks checks={checks} ko={ko} onFix={onFix && ((check) => { setOpen(false); onFix(check) })} /> : (
    <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] gap-3 rounded-xl p-3">
      <p className="text-xs font-medium text-white">{ko ? '병합 전 검사' : 'Pre-merge checks'}</p>
      <p className="text-[11px] leading-4 text-slate-400">{ko ? '변경할 때 자동으로 다시 확인합니다. 승인 상태는 별도로 확인하세요.' : 'Checks update automatically when you edit. Review approvals are tracked separately.'}</p>
      <ul className="max-h-72 space-y-3 overflow-y-auto">
        {[...checks.failing, ...checks.checks.filter((check) => check.ok)].map((check) => <li key={check.id} className="text-[11px] leading-4">
          <div className="flex gap-2">
            {check.ok ? <CircleCheck className="mt-0.5 size-3 shrink-0 text-emerald-300" /> : <TriangleAlert className="mt-0.5 size-3 shrink-0 text-amber-200" />}
            <div className="min-w-0 flex-1">
              <span className={check.ok ? 'text-slate-400' : 'text-white'}><LocalizedText text={check.title} /></span>
              {!check.ok && <span className="ml-1.5 text-[10px] text-slate-400">{checks.blocking.includes(check) ? (ko ? '필수' : 'Required') : (ko ? '권장' : 'Suggestion')}</span>}
              {!check.ok && !check.details?.length && check.hint && <p className="mt-1 text-slate-400"><LocalizedText text={check.hint} /></p>}
              {!check.ok && <CheckValueDetails check={check} />}
              {!check.ok && onFix && <button type="button" onClick={() => { setOpen(false); onFix(check) }} className="ds-intrinsic mt-1.5 inline-flex items-center gap-1 text-emerald-300 hover:underline">{ko ? '수정할 위치로 이동' : 'Go to fix'}<ArrowUpRight className="size-3" /></button>}
            </div>
          </div>
        </li>)}
      </ul>
    </PopoverContent>
    )}
  </Popover>
}

// The compact list: one line per problem (what, required or not, and the
// way to it), its details only when opened; what passed folded into a count.
function CompactChecks({ checks, ko, onFix }) {
  const [openId, setOpenId] = useState(null)
  const [showPassed, setShowPassed] = useState(false)
  const passed = checks.checks.filter((check) => check.ok)
  return (
    <PopoverContent align="end" sideOffset={8} className="w-72 max-w-[calc(100vw-2rem)] gap-1 rounded-xl p-1.5 text-[11px] leading-4">
      {checks.failing.map((check) => {
        const required = checks.blocking.includes(check)
        const open = openId === check.id
        return (
          <div key={check.id} data-compact-check={check.id} className="rounded-lg hover:bg-white/[0.04]">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <span className={`size-1.5 shrink-0 rounded-full ${required ? 'bg-amber-400' : 'bg-amber-200/60'}`} title={required ? (ko ? '필수' : 'Required') : (ko ? '권장' : 'Suggestion')} />
              <button type="button" onClick={() => setOpenId(open ? null : check.id)} className="ds-intrinsic min-w-0 flex-1 truncate text-left text-slate-100">
                <LocalizedText text={check.title} />
              </button>
              {onFix && (
                <button type="button" onClick={() => onFix(check)} title={ko ? '수정할 위치로 이동' : 'Go to fix'} aria-label={ko ? '수정할 위치로 이동' : 'Go to fix'} className="ds-intrinsic shrink-0 rounded p-0.5 text-slate-400 hover:bg-white/[0.08] hover:text-emerald-300">
                  <ArrowUpRight className="size-3.5" />
                </button>
              )}
            </div>
            {open && (
              <div className="px-2 pb-2 pl-5.5 text-slate-400">
                {!check.details?.length && check.hint && <p><LocalizedText text={check.hint} /></p>}
                <CheckValueDetails check={check} />
              </div>
            )}
          </div>
        )
      })}
      {passed.length > 0 && (
        <div className={checks.failing.length ? 'mt-0.5 border-t border-white/[0.06] pt-1' : ''}>
          <button type="button" onClick={() => setShowPassed((value) => !value)} className="ds-intrinsic flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-slate-400 hover:bg-white/[0.04]">
            <CircleCheck className="size-3 shrink-0 text-emerald-300" />
            <span className="flex-1">{ko ? `통과 ${passed.length}개` : `${passed.length} passed`}</span>
            <ChevronDown className={`size-3 transition-transform ${showPassed ? 'rotate-180' : ''}`} />
          </button>
          {showPassed && (
            <ul className="space-y-1 px-2 pb-1.5 pl-7 text-slate-500">
              {passed.map((check) => <li key={check.id} className="truncate"><LocalizedText text={check.title} /></li>)}
            </ul>
          )}
        </div>
      )}
    </PopoverContent>
  )
}
