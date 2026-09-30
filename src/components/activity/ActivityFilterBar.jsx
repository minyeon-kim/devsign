import { CalendarDays, Check, ChevronDown, FolderKanban } from 'lucide-react'
import { cn } from 'cn'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { projects } from '@/data/mockData'
import { ACTIVITY_FILTERS } from './activityTypeMeta'

// Date range is visual-only — it doesn't refilter `activities` (there's
// only one week of mock data), but the dropdown itself is fully
// interactive per the dashboard brief's "interactions only need to be
// visual" allowance.
const dateRanges = ['This week', 'Last week', 'This month']

const dropdownTriggerClass =
  'flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:bg-muted'

// Type pills on the left; project + date-range dropdowns on the right.
// The project scope lives here in the page (not in the sidebar), so the
// sidebar stays primary navigation only.
function ActivityFilterBar({ activeFilter, onFilterChange, projectFilter, onProjectChange }) {
  const selectedProject = projects.find((p) => p.id === projectFilter)

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
                  ? 'border-foreground/20 bg-muted text-foreground'
                  : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {filter.label}
            </button>
          )
        })}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(dropdownTriggerClass, selectedProject && 'border-foreground/20 bg-muted text-foreground')}
          >
            <FolderKanban className="size-3.5" />
            <span className="max-w-40 truncate">{selectedProject ? selectedProject.name : 'All projects'}</span>
            <ChevronDown className="size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => onProjectChange(null)}>
              <span className="flex-1">All projects</span>
              {!selectedProject && <Check className="size-3.5 text-foreground" />}
            </DropdownMenuItem>
            {projects.map((p) => (
              <DropdownMenuItem key={p.id} onClick={() => onProjectChange(p.id)}>
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                {p.id === projectFilter && <Check className="size-3.5 text-foreground" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className={dropdownTriggerClass}>
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
    </div>
  )
}

export default ActivityFilterBar
