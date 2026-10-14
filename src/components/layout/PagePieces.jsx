import { cn } from 'cn'
import { LocalizedText } from '@/i18n/runtime'

// The pieces every page outside the Workspace is built from, so they read as the Workspace does.

// A page's (or section's) title: 15px, semibold, and how many — as Home's 내 검토 대기 and 프로젝트.
export function PageTitle({ as: Tag = 'h1', title, count = null, className }) {
  return (
    <Tag className={cn('flex items-baseline gap-1.5 text-[15px] font-semibold text-foreground', className)}>
      <LocalizedText text={title} />
      {count != null && <span className="font-normal text-slate-500 tabular-nums">{count}</span>}
    </Tag>
  )
}

// The Workspace's segmented capsule (미리보기 · 화면 · 코드): a quiet track, the one picked on a raised thumb.
//   options: [{ id, label, count? }]
export function Segmented({ options, value, onChange, label, className }) {
  return (
    <div role="tablist" aria-label={label} className={cn('flex h-8 w-fit max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-white/[0.06] p-0.5 [scrollbar-width:none]', className)}>
      {options.map((option) => {
        const on = option.id === value
        return (
          <button key={option.id ?? 'all'} type="button" role="tab" aria-selected={on} onClick={() => onChange(option.id)}
            className={cn('flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-emerald-300',
              on ? 'bg-white/[0.16] font-semibold text-white shadow-[0_1px_2px_rgb(0_0_0/0.35)]' : 'text-slate-400 hover:text-slate-200')}>
            <LocalizedText text={option.label} />
            {option.count != null && <span className={cn('tabular-nums', on ? 'text-slate-300' : 'text-slate-500')}>{option.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

// A quiet capsule control beside a Segmented (a dropdown's trigger): the same track, its words.
export const CAPSULE_CONTROL = 'flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.06] px-3 text-xs text-slate-300 transition-colors hover:bg-white/[0.1] hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-300'

// The windows' card: 24px round, a 10% hairline, the panel surface.
export const PAGE_PANEL = 'rounded-[24px] border border-white/10 bg-card'
