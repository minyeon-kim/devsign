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
// workspace state only (drafts, reviews, history), not language. One quiet
// row, the same shape as Settings' Language row; confirming swaps it for
// the question and two small actions in place — no divider, no boxes.
export default function DemoTools() {
  const [confirming, setConfirming] = useState(false)
  return (
    <section aria-label="Workspace data">
      {confirming ? (
        <div className="space-y-2 px-2 py-1.5">
          <p className="text-xs leading-relaxed text-slate-300">Reset all drafts, reviews and history for every project?</p>
          <div className="flex justify-end gap-1">
            <button type="button" className="h-7 rounded-md px-2.5 text-xs text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white" onClick={() => setConfirming(false)}>Cancel</button>
            <button type="button" className="h-7 rounded-md bg-red-500/15 px-2.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/25" onClick={() => {
              try { resetDemo(); window.location.reload() } catch {
                toast(translateText('Reset failed. Allow access to browser storage and try again.', getLanguage()))
              }
            }}>Reset</button>
          </div>
        </div>
      ) : (
        <button type="button" className="flex h-8 w-full items-center rounded-md px-2 text-left text-xs text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-red-300" onClick={() => setConfirming(true)}>
          Reset workspace data
        </button>
      )}
    </section>
  )
}
