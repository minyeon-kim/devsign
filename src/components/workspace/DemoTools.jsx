import { useEffect, useState } from 'react'
import { toast } from '@/i18n/toast'
import { resetDemo } from '@/lib/demoStorage'
import { getLanguage } from '@/i18n/language'
import { translateText } from '@/i18n/translate'

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
// workspace state only (drafts, reviews, history), not language.
export default function DemoTools() {
  const [confirming, setConfirming] = useState(false)
  return (
    <section className="space-y-2 border-t border-border/60 pt-2" aria-label="Workspace data">
      {confirming ? <>
        <p className="text-xs">Reset all drafts, reviews and history for every project?</p>
        <div className="flex gap-2">
          <button type="button" className="rounded-lg border px-3 py-2 text-xs" onClick={() => setConfirming(false)}>Cancel</button>
          <button type="button" className="rounded-lg bg-destructive px-3 py-2 text-xs text-white" onClick={() => {
            try { resetDemo(); window.location.reload() } catch {
              toast(translateText('Reset failed. Allow access to browser storage and try again.', getLanguage()))
            }
          }}>Reset workspace data</button>
        </div>
      </> : <button type="button" className="w-full rounded-lg px-2 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" onClick={() => setConfirming(true)}>Reset workspace data</button>}
    </section>
  )
}
