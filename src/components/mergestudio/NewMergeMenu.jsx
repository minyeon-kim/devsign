import { useState } from 'react'
import { Check, Plus, Search } from 'lucide-react'
import { cn } from 'cn'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getFileIconMeta } from '@/lib/fileIcons'
import { FLOATING_PILL } from '@/components/mergestudio/floatingStyles'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { defaultSelection, orderFilesForMerge, startLabelOf } from '@/lib/mergeEntry'
import { LocalizedText } from '@/i18n/runtime'
import { translateText } from '@/i18n/translate'
import { useLanguage } from '@/i18n/language'

function toggle(list, v) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

// "New merge" — where a merge is started, inside the studio (the header button only goes
// in). It asks what to merge: the project's files, the ones with changes on top and
// marked, those selected to begin with; with no changes it says so and starts from
// nothing — it never guesses a set. The button says how many it starts from.
// `variant`: "header" (the studio's own header row — where it lives), "toolbar" (the Merge
// List's controls), "empty" (the studio's first-merge call to action).
function NewMergeMenu({ variant = 'toolbar' }) {
  const { workspaceFiles, startMergeFromFiles, mergeEntry } = useWorkspace()
  const language = useLanguage()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState([])
  const changedIds = mergeEntry?.changedIds ?? new Set()
  const ordered = orderFilesForMerge(workspaceFiles, changedIds)
  const changedCount = ordered.filter((file) => changedIds.has(file.id)).length

  const q = query.trim().toLowerCase()
  const shown = ordered.filter((f) => f.name.toLowerCase().includes(q))

  return (
    <Popover onOpenChange={(open) => { if (open) { setSelected(defaultSelection(workspaceFiles, changedIds)); setQuery('') } }}>
      <PopoverTrigger
        type="button"
        data-new-merge={variant}
        className={variant === 'header'
          // The studio's own header row: a pill like its neighbours.
          ? cn(FLOATING_PILL, 'flex h-8 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-semibold text-foreground')
          : variant === 'empty'
            ? 'ds-intrinsic inline-flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-3.5 text-xs font-medium text-slate-100 transition-colors hover:bg-white/15 hover:text-white'
            : 'ds-intrinsic flex h-8 shrink-0 items-center gap-1 rounded-full bg-white/10 px-3 text-xs font-medium text-slate-100 transition-colors hover:bg-white/15 hover:text-white'}
      >
        <Plus className="size-3.5" />
        <LocalizedText text="New merge" />
      </PopoverTrigger>
      <PopoverContent align={variant === 'empty' ? 'center' : 'end'} className="w-72 gap-2 rounded-xl border border-white/10 bg-card/95 p-3 backdrop-blur-xl">
        <p className="px-0.5 text-xs font-medium text-slate-300"><LocalizedText text="Start a merge from" /></p>
        {/* What the picker has done for you — or why it hasn't. */}
        <p data-new-merge-note className="px-0.5 text-[11px] text-slate-400">
          <LocalizedText text={changedCount > 0 ? `${changedCount} changed file${changedCount === 1 ? '' : 's'} selected` : 'No changed files. Pick the files to merge.'} />
        </p>
        {workspaceFiles.length > 5 && (
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={translateText('Find files…', language)}
              className="h-7 w-full rounded-full border border-white/10 bg-slate-900 pr-2.5 pl-7 text-[11px] outline-none focus:ring-1 focus:ring-white/30"
            />
          </div>
        )}
        <div className="max-h-56 space-y-0.5 overflow-y-auto">
          {shown.map((file) => {
            const on = selected.includes(file.id)
            const changed = changedIds.has(file.id)
            const { Icon, colorClass } = getFileIconMeta(file.name)
            return (
              <button
                key={file.id}
                type="button"
                data-new-merge-file={file.id}
                data-changed={changed ? '' : undefined}
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
                {changed && <span data-changed-tag className="shrink-0 rounded bg-white/10 px-1.5 text-[10px] font-medium text-slate-200"><LocalizedText text="File changed" /></span>}
              </button>
            )
          })}
          {shown.length === 0 && <p className="px-1.5 py-2 text-[11px] text-muted-foreground">{`No files match “${query}”.`}</p>}
        </div>
        <PopoverClose
          type="button"
          data-new-merge-start
          disabled={selected.length === 0}
          onClick={() => startMergeFromFiles(selected)}
          className="flex h-8 w-full items-center justify-center rounded-full bg-emerald-400 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <LocalizedText text={startLabelOf(selected.length)} />
        </PopoverClose>
      </PopoverContent>
    </Popover>
  )
}

export default NewMergeMenu
