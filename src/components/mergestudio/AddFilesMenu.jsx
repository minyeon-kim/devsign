import { useState } from 'react'
import { Check, FilePlus2, Search } from 'lucide-react'
import { cn } from 'cn'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getFileIconMeta } from '@/lib/fileIcons'
import { useWorkspace } from '@/state/WorkspaceProvider'

function toggle(list, v) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

// "Add files" — starts a new merge item from a hand-picked set of this
// project's files, instead of only ever whatever happens to be open in the
// editor. The Merge Studio menu's "Start New with Current Work" shortcut
// still uses the open-files-only path (`startMergeFromOpenFiles`) for its
// one-click case; this picker is for choosing deliberately, so it opens to
// nothing selected rather than guessing a starting set.
function AddFilesMenu() {
  const { workspaceFiles, startMergeFromFiles } = useWorkspace()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState([])

  const q = query.trim().toLowerCase()
  const shown = workspaceFiles.filter((f) => f.name.toLowerCase().includes(q))

  return (
    <Popover onOpenChange={(open) => open && setSelected([])}>
      <PopoverTrigger
        type="button"
        data-guide="add-files"
        title="Add files — start a merge item from your project's files"
        aria-label="Add files"
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#09090A] text-slate-300 transition-colors hover:bg-[#161618] hover:text-white"
      >
        <FilePlus2 className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 gap-2 rounded-xl border border-white/10 bg-card/95 p-3 backdrop-blur-xl">
        <p className="px-0.5 text-xs font-medium text-slate-300">Start a merge item from</p>
        {workspaceFiles.length > 5 && (
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find files…"
              className="h-7 w-full rounded-full border border-white/10 bg-slate-900 pr-2.5 pl-7 text-[11px] outline-none focus:ring-1 focus:ring-emerald-400"
            />
          </div>
        )}
        <div className="max-h-56 space-y-0.5 overflow-y-auto">
          {shown.map((file) => {
            const on = selected.includes(file.id)
            const { Icon, colorClass } = getFileIconMeta(file.name)
            return (
              <button
                key={file.id}
                type="button"
                aria-pressed={on}
                onClick={() => setSelected((prev) => toggle(prev, file.id))}
                className="flex h-8 w-full items-center gap-2 rounded-lg px-1.5 text-left text-xs text-foreground hover:bg-white/5"
              >
                <span
                  className={cn(
                    'flex size-4 shrink-0 items-center justify-center rounded border',
                    on ? 'border-foreground bg-foreground text-background' : 'border-white/20'
                  )}
                >
                  {on && <Check className="size-3" />}
                </span>
                <Icon className={cn('size-3.5 shrink-0', colorClass)} />
                <span className="min-w-0 flex-1 truncate font-mono">{file.name}</span>
              </button>
            )
          })}
          {shown.length === 0 && <p className="px-1.5 py-2 text-[11px] text-muted-foreground">{`No files match “${query}”.`}</p>}
        </div>
        <PopoverClose
          type="button"
          disabled={selected.length === 0}
          onClick={() => startMergeFromFiles(selected)}
          className="flex h-8 w-full items-center justify-center rounded-full bg-emerald-400 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {`Start merge · ${selected.length} file${selected.length === 1 ? '' : 's'}`}
        </PopoverClose>
      </PopoverContent>
    </Popover>
  )
}

export default AddFilesMenu
