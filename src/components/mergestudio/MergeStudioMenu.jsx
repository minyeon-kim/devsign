import { Sparkles } from 'lucide-react'
import { cn } from 'cn'
import { FLOATING_PILL } from '@/components/mergestudio/floatingStyles'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { badgeOf } from '@/lib/mergeEntry'
import { LocalizedText } from '@/i18n/runtime'
import { translateText } from '@/i18n/translate'
import { useLanguage } from '@/i18n/language'

// The header's "Merge Studio" button: pressing it goes straight in (the studio is
// its own view — see MergeStudioView — with the Merge List and its "New merge"
// inside; there's no menu to choose from first). How many merges are waiting is
// on the button itself, a small number at the icon's corner; in the studio the
// button reads as where you are.
// `standalone` renders the trigger as its own floating pill (the Workspace
// header's separate pieces) instead of a control inside a pill.
function MergeStudioMenu({ standalone = false, borderless = false }) {
  const { openMergeStudio, activeView, mergeEntry } = useWorkspace()
  const language = useLanguage()
  const inStudio = activeView === 'mergeStudio'
  const badge = badgeOf(mergeEntry?.pending ?? 0)
  const label = badge ? `${translateText('Merge Studio', language)} · ${translateText(`${mergeEntry.pending} merges waiting`, language)}` : translateText('Merge Studio', language)

  return (
    <button
      type="button"
      data-merge-studio-button
      data-control-tooltip="off"
      aria-pressed={inStudio}
      aria-label={label}
      title={label}
      onClick={() => { if (!inStudio) openMergeStudio() }}
      className={cn(
        // Styled as a control inside the Workspace's action pill: a
        // borderless 32px pill with the accent carried by the icon only.
        standalone
          ? borderless
            // The Workspace header: a bare 32px pill like its neighbors,
            // surfaced only on hover / while open (see .ds-header-pill).
            ? 'ds-header-pill flex h-8 items-center gap-2 rounded-full px-3 text-[13px] font-semibold text-foreground'
            : cn('flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted', FLOATING_PILL)
          : 'flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-white/10',
        inStudio && (borderless ? 'bg-white/[0.08]' : 'bg-muted')
      )}
    >
      <span className="relative flex">
        <Sparkles className={cn('text-emerald-400', standalone ? 'size-4' : 'size-3.5')} />
        {badge && <span data-merge-badge aria-hidden className="absolute -top-2 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] leading-none font-semibold text-slate-950 tabular-nums">{badge}</span>}
      </span>
      <LocalizedText text="Merge Studio" />
    </button>
  )
}

export default MergeStudioMenu
