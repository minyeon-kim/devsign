import { useRef } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from 'cn'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

// How a change is resolved, picked from one dropdown — the same for every kind of change (a value, a merge of
// code, an accessibility fix): the way picked, in a line, with a chevron; opened, each way with what it does
// under its name and a check on the one picked.
//
//   options: [{ id, title, value?, badge?: { text, tone? }, mono?, detail?, data?: { 'data-…': … } }] — detail: in the menu
//     value — its value, quiet, after its name ('2', '24 × 24px'); mono — a branch's name, at the row's end
//     badge — '추천' / '제안' (accent) or a rule's state (its own tone)
//   readOnly: nothing to open — the way taken, with `tag` ('적용됨', '반영된 결과') beside it
//   children: what the picked way needs set (a value of one's own), under the line
const ACCENT = 'bg-[var(--ds-accent-bg)] text-[var(--ds-accent-text)]'

function Badge({ badge }) {
  if (!badge?.text) return null
  return <span data-way-badge className={cn('inline-flex h-[18px] shrink-0 items-center gap-1 rounded px-1.5 text-[10.5px] leading-none font-medium whitespace-nowrap', badge.tone ?? ACCENT)}>{badge.icon}{badge.text}</span>
}

function Line({ option, placeholder }) {
  if (!option) return <span className="min-w-0 flex-1 truncate text-[13px] text-slate-400">{placeholder}</span>
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <span className="min-w-0 truncate text-[13px] leading-5 font-medium text-white">{option.title}</span>
      {option.value && <span className="min-w-0 shrink truncate text-[13px] text-slate-400 tabular-nums">{option.value}</span>}
      <Badge badge={option.badge} />
    </span>
  )
}

export default function WayPicker({ options, value, onChange, readOnly = false, tag = null, label = '해결 방법', placeholder = '해결 방법을 골라 주세요', children = null, className, ...rest }) {
  const picked = options.find((option) => option.id === value) ?? null
  // (It opens downward, always — never flipped up over what it's choosing for. Opened near the panel's foot,
  // the panel scrolls it up first so the menu has the room.)
  const triggerRef = useRef(null)
  const onOpenChange = (open) => { if (open) triggerRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }
  const box = 'flex min-h-11 w-full min-w-0 items-center gap-2.5 rounded-xl border px-3.5 py-2 text-left'
  return (
    <div data-way-picker={picked?.id ?? 'none'} className={cn('flex min-w-0 flex-col gap-2', className)} {...rest}>
      {readOnly ? (
        <div data-way-current aria-label={label} className={cn(box, 'border-white/[0.08] bg-white/[0.03]')} {...(picked?.data ?? {})}>
          <Line option={picked} placeholder={placeholder} />
          {tag && <span data-way-state className="shrink-0 rounded bg-white/[0.08] px-1.5 py-0.5 text-[10.5px] leading-none font-medium text-slate-200">{tag}</span>}
        </div>
      ) : (
        <DropdownMenu onOpenChange={onOpenChange}>
          <DropdownMenuTrigger ref={triggerRef} data-way-trigger aria-label={label} className={cn(box, 'cursor-pointer border-white/10 bg-white/[0.04] transition-colors hover:border-white/20 hover:bg-white/[0.07] focus-visible:outline-2 focus-visible:outline-emerald-300 data-[popup-open]:border-white/25')}>
            <Line option={picked} placeholder={placeholder} />
            {picked?.mono && <span translate="no" className="hidden min-w-0 shrink truncate font-mono text-[10.5px] text-slate-500 min-[420px]:inline">{picked.mono}</span>}
            <ChevronDown aria-hidden className="size-4 shrink-0 text-slate-400" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} collisionAvoidance={{ side: 'none', align: 'shift', fallbackAxisSide: 'none' }} className="rounded-xl bg-[#262626] p-1.5 shadow-xl shadow-black/40 ring-white/10">
            {options.map((option) => {
              const on = option.id === picked?.id
              return (
                <DropdownMenuItem key={option.id} data-way-option={option.id} {...(option.data ?? {})} onClick={() => onChange(option.id)}
                  className={cn('flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5', on && 'bg-white/[0.06]')}>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 truncate text-[13px] leading-5 font-medium text-white">{option.title}</span>
                      {option.value && <span className="min-w-0 truncate text-[12.5px] text-slate-400 tabular-nums">{option.value}</span>}
                      <Badge badge={option.badge} />
                    </span>
                    {option.detail && <span className="text-[12px] leading-[18px] text-slate-400">{option.detail}</span>}
                    {option.mono && <span translate="no" className="truncate font-mono text-[10.5px] text-slate-500">{option.mono}</span>}
                  </span>
                  <Check aria-hidden className={cn('mt-0.5 size-4 shrink-0 text-white', !on && 'invisible')} />
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {/* (What each way does is the menu's to say — the line under the trigger would only say it again.) */}
      {children}
    </div>
  )
}
