import { Layers, Sparkles } from 'lucide-react'
import { cn } from 'cn'
import { FLOATING_PILL } from '@/components/mergestudio/floatingStyles'
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { LocalizedText } from '@/i18n/runtime'
import { translateText } from '@/i18n/translate'
import { useLanguage } from '@/i18n/language'

// The menu's items, from what's there (lib/mergeEntry), in the order they're worth: the one to do
// now first (marked), what can't be done after — each saying why in a line, never silently.
//   · "Open Saved Merge Work" — with how many there are and when the newest was touched; with
//     none, "No saved merge work", and it can't be picked;
//   · "Start New with Current Work" — with how many files it starts from (their names on hover);
//     with none, "Open a file first".
// With neither, the menu says there's nothing to merge (no items at all).
export function entriesOf(state, { openMergeStudio, startMergeFromOpenFiles }) {
  const { saved, start, primary } = state ?? {}
  if (!saved && !start) return []
  const open = {
    id: 'saved',
    title: 'Open Saved Merge Work',
    detail: saved ? `${saved.count} saved merge${saved.count === 1 ? '' : 's'}${saved.updatedLabel ? ` · Updated ${saved.updatedLabel}` : ''}` : 'No saved merge work',
    enabled: Boolean(saved),
    onPick: openMergeStudio,
  }
  const begin = {
    id: 'start',
    title: 'Start New with Current Work',
    detail: start ? `Start with ${start.count} open file${start.count === 1 ? '' : 's'}` : 'Open a file first',
    hint: start?.names.join(', '),
    enabled: Boolean(start),
    onPick: startMergeFromOpenFiles,
  }
  const ordered = primary === 'start' ? [begin, open] : [open, begin]
  // (Disabled ones go last, whatever else.)
  return [...ordered.filter((entry) => entry.enabled), ...ordered.filter((entry) => !entry.enabled)].map((entry) => ({ ...entry, primary: entry.enabled && entry.id === primary }))
}

const ITEM = 'relative flex w-full flex-col items-start gap-0.5 rounded-xl border border-transparent p-2.5 text-left transition-colors'

export function EntryItem({ entry }) {
  const language = useLanguage()
  const body = (
    <>
      {entry.primary && <span aria-hidden data-merge-entry-bar className="absolute top-2.5 bottom-2.5 left-0 w-0.5 rounded-full bg-white" />}
      <span className={cn('text-xs font-medium', entry.enabled ? 'text-foreground' : 'text-slate-500')}><LocalizedText text={entry.title} /></span>
      <span data-merge-entry-detail className="text-[11px] text-muted-foreground"><LocalizedText text={entry.detail} /></span>
    </>
  )
  if (!entry.enabled) {
    // Not a way in: it says why, takes no click, and the menu stays.
    return (
      <button type="button" role="menuitem" data-merge-entry={entry.id} aria-disabled="true" tabIndex={-1} aria-description={translateText(entry.detail, language)} onClick={(event) => event.preventDefault()} className={cn(ITEM, 'cursor-not-allowed')}>
        {body}
      </button>
    )
  }
  return (
    <PopoverClose
      type="button"
      role="menuitem"
      data-merge-entry={entry.id}
      data-merge-entry-primary={entry.primary ? '' : undefined}
      title={entry.hint}
      onClick={entry.onPick}
      className={cn(ITEM, 'hover:border-border hover:bg-muted', entry.primary && 'bg-white/[0.06]')}
    >
      {body}
    </PopoverClose>
  )
}

// The header's "Merge Studio" button is the entry point into a separate
// view (see MergeStudioView) rather than a dockview panel — clicking it
// opens this popover so the user picks how they're entering it before the
// whole workspace body swaps over. Popover.Trigger already toggles on
// repeat clicks and dismisses on an outside click/Escape out of the box
// (base-ui), so no extra open-state or click-outside wiring is needed here.
// `standalone` renders the trigger as its own floating pill (the
// Workspace header's separate pieces) instead of a control inside a pill.
function MergeStudioMenu({ standalone = false, borderless = false }) {
  const { openMergeStudio, startMergeFromOpenFiles, mergeEntry } = useWorkspace()
  const entries = entriesOf(mergeEntry, { openMergeStudio, startMergeFromOpenFiles })

  // ↑ / ↓ move between the items that can be picked (a disabled one says why, and is skipped).
  function onKeyDown(event) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    const items = [...event.currentTarget.querySelectorAll('[data-merge-entry]:not([aria-disabled="true"])')]
    if (!items.length) return
    event.preventDefault()
    const at = items.indexOf(document.activeElement)
    const next = at === -1 ? items[event.key === 'ArrowDown' ? 0 : items.length - 1] : items[(at + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]
    next.focus()
  }

  return (
    <Popover>
      {/* Styled as a control inside the Workspace's action pill: a
          borderless 32px pill with the accent carried by the icon only. */}
      <PopoverTrigger
        data-control-tooltip="off"
        className={
          standalone
            ? borderless
              // The Workspace header: a bare 32px pill like its neighbors,
              // surfaced only on hover / while open (see .ds-header-pill).
              ? 'ds-header-pill flex h-8 items-center gap-2 rounded-full px-3 text-[13px] font-semibold text-foreground'
              : cn('flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted data-[popup-open]:bg-muted', FLOATING_PILL)
            : 'flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-white/10 data-[popup-open]:bg-white/10'
        }
      >
        <Sparkles className={cn('text-emerald-400', standalone ? 'size-4' : 'size-3.5')} />
        Merge Studio
      </PopoverTrigger>
      <PopoverContent data-control-tooltip="off" align="end" sideOffset={10} className="w-72 gap-1 rounded-2xl p-2">
        <p className="px-1 pb-1 text-xs font-medium text-slate-400">
          Merge Studio
        </p>
        {entries.length === 0 ? (
          // Nothing to open, nothing to start from.
          <div role="status" data-merge-entry-empty className="flex flex-col items-center gap-2 px-3 py-6 text-center">
            <Layers className="size-6 text-slate-500" />
            <p className="text-[13px] font-semibold text-foreground"><LocalizedText text="Nothing to merge yet" /></p>
            <p className="text-xs text-slate-400"><LocalizedText text="Open and edit a file, then come back to start a merge." /></p>
          </div>
        ) : (
          <div role="menu" aria-label="Merge Studio" onKeyDown={onKeyDown} className="flex flex-col gap-1">
            {entries.map((entry) => <EntryItem key={entry.id} entry={entry} />)}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

export default MergeStudioMenu
