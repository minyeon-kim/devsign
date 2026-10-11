import { useEffect, useState } from 'react'
import { toast } from '@/i18n/toast'
import { Loader2 } from 'lucide-react'
import { discardUndo, pendingUndo, resetWorkspace, undoReset } from '@/lib/workspaceReset'
import { getLanguage } from '@/i18n/language'
import { translateText } from '@/i18n/translate'

const UNDONE_KEY = 'devsign:reset-undone'

export function useDemoStorageWarnings() {
  useEffect(() => {
    const warn = () => toast(translateText('Changes could not be saved', getLanguage()), {
      description: translateText('Storage is unavailable or full. Changes remain in this tab; allow browser storage before refreshing.', getLanguage()),
    })
    window.addEventListener('devsign:storage-error', warn)
    return () => window.removeEventListener('devsign:storage-error', warn)
  }, [])
}

// Settings owns the entry point; resetting affects this browser's saved
// workspace state only (drafts, reviews, history), not language. One click
// resets at once — no confirmation — and the Undo toast (see
// useResetUndoToast) is the safety net. Separated from the other settings
// by a rule, in the danger colour.
export default function DemoTools({ onDone }) {
  const [busy, setBusy] = useState(false)
  const reset = () => {
    if (busy) return
    setBusy(true)
    try {
      resetWorkspace()
    } catch {
      setBusy(false)
      toast(translateText('Could not reset. Please try again.', getLanguage()))
      return
    }
    onDone?.()
    window.location.assign(`${import.meta.env.BASE_URL}dashboard`)
  }
  return (
    <section aria-label="Workspace data" className="mt-1 border-t border-white/10 pt-1">
      <button type="button" disabled={busy} aria-busy={busy} className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs text-destructive transition-colors hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-60" onClick={reset}>
        {busy && <Loader2 className="size-3 animate-spin" aria-hidden />}
        Reset workspace data
      </button>
    </section>
  )
}

// After a reset the app has reloaded onto the dashboard: say so, with Undo
// for what is left of the 10 seconds. Undo writes the snapshot back and
// reloads in place; "Restored" shows on the other side of that reload.
export function useResetUndoToast() {
  useEffect(() => {
    const language = getLanguage()
    try {
      if (sessionStorage.getItem(UNDONE_KEY)) {
        sessionStorage.removeItem(UNDONE_KEY)
        toast(translateText('Restored', language))
        return
      }
    } catch { /* storage unavailable */ }
    const pending = pendingUndo()
    if (!pending) return
    const remaining = pending.expiresAt - Date.now()
    const timer = setTimeout(discardUndo, remaining)
    toast(translateText('Workspace reset', language), {
      id: 'workspace-reset',
      duration: remaining,
      action: {
        label: 'Undo',
        onClick: () => {
          clearTimeout(timer)
          try {
            if (!undoReset()) throw new Error('expired')
            sessionStorage.setItem(UNDONE_KEY, '1')
            window.location.reload()
          } catch {
            toast(translateText('Could not undo. Please try again.', language))
          }
        },
      },
    })
    return () => clearTimeout(timer)
  }, [])
}
