import { CalendarDays, ChevronDown } from 'lucide-react'
import { cn } from 'cn'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ACTIVITY_FILTERS } from './activityTypeMeta'

// Date range is visual-only — it doesn't refilter `activities` (there's
// only one week of mock data), but the dropdown itself is fully
// interactive per the dashboard brief's "interactions only need to be
// visual" allowance.
const dateRanges = ['This week', 'Last week', 'This month']

function ActivityFilterBar({ activeFilter, onFilterChange }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {ACTIVITY_FILTERS.map((filter) => {
          const isActive = filter.id === activeFilter
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => onFilterChange(filter.id)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150',
                isActive
                  ? 'border-primary/40 bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {filter.label}
            </button>
          )
        })}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-muted">
          <CalendarDays className="size-3.5" />
          This week
          <ChevronDown className="size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {dateRanges.map((range) => (
            <DropdownMenuItem key={range}>{range}</DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default ActivityFilterBar
