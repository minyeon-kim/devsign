import { cn } from 'cn'
import { brand } from '@/data/mockData'

// Custom symbol mark — a rounded square carrying a stylized "D" plus a
// small accent dot, in the muted indigo/slate-purple gradient defined in
// mockData.brand so the color stays data-driven. `iconOnly` drops the
// wordmark for narrow icon-rail contexts (e.g. the dashboard sidebar).
function Logo({ iconOnly = false }) {
  return (
    <div className={cn('flex shrink-0 items-center gap-2 select-none', !iconOnly && 'pr-1')}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="devsign-logo-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor={brand.mark.from} />
            <stop offset="1" stopColor={brand.mark.to} />
          </linearGradient>
        </defs>
        <rect x="1.5" y="1.5" width="21" height="21" rx="6.5" fill="url(#devsign-logo-grad)" />
        <rect x="1.5" y="1.5" width="21" height="21" rx="6.5" stroke="white" strokeOpacity="0.08" />
        <path
          d="M7.5 6.75h4.75a5.25 5.25 0 1 1 0 10.5H7.5V6.75Z"
          fill="white"
          fillOpacity="0.92"
        />
        <circle cx="16.25" cy="7.75" r="1.35" fill="white" fillOpacity="0.5" />
      </svg>
      {!iconOnly && (
        <span className="text-[13px] font-semibold tracking-tight text-foreground/90">
          {brand.name}
        </span>
      )}
    </div>
  )
}

export default Logo
