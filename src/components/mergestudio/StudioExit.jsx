import { useEffect, useRef } from 'react'
import { ArrowLeft } from 'lucide-react'
import { cn } from 'cn'
import { FLOATING_PILL } from '@/components/mergestudio/floatingStyles'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { LocalizedText } from '@/i18n/runtime'
import { translateText } from '@/i18n/translate'
import { useLanguage } from '@/i18n/language'

// The way out of Merge Studio: "← Workspace", at the left end of the studio's header row
// (the AI Chat pill moves one place along), and Esc. Straight back — the merge in
// progress is kept in the Workspace's state either way, so there's nothing to confirm and
// nothing to announce. In a narrow window the name steps aside (it stays the tooltip).
//
// Esc leaves only when nothing else is waiting for it: an open dialog, menu, popover or
// listbox (or a layer over the studio — a conflict's detail, Docs, History — or the
// full-screen preview) goes first, text being typed is left alone, and a key something
// else already took (`defaultPrevented`) isn't ours.
export const ESC_FIRST = '[role="dialog"], [data-slot="dialog-content"], [data-slot="popover-content"], [role="menu"], [role="listbox"], [data-preview-fullscreen-layer]'
export const TYPING = 'input, textarea, select, [contenteditable="true"]'

export function shouldExitOnEscape(event, root = document) {
  if (event.key !== 'Escape' || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return false
  if (event.target?.closest?.(TYPING)) return false
  return !root.querySelector(ESC_FIRST)
}

function StudioExit() {
  const { exitMergeStudio } = useWorkspace()
  const language = useLanguage()
  const exit = useRef(exitMergeStudio)
  useEffect(() => { exit.current = exitMergeStudio })
  useEffect(() => {
    function onKey(event) {
      if (!shouldExitOnEscape(event)) return
      event.preventDefault()
      exit.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const hint = `${translateText('Back to Workspace', language)} · Esc`
  return (
    <button
      type="button"
      data-studio-exit
      aria-label={translateText('Back to Workspace', language)}
      title={hint}
      onClick={exitMergeStudio}
      className={cn('ds-intrinsic absolute top-2 left-4 z-50 flex h-8 items-center justify-center gap-2 rounded-full px-3.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-white/60 @max-[1100px]:w-8 @max-[1100px]:px-0', FLOATING_PILL)}
    >
      <ArrowLeft className="size-4 shrink-0" />
      <span className="@max-[1100px]:hidden"><LocalizedText text="Workspace" /></span>
    </button>
  )
}

export default StudioExit
