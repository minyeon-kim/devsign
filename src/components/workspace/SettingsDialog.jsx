import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import DemoTools, { useDemoStorageWarnings } from '@/components/workspace/DemoTools'
import { setLanguage, useLanguage } from '@/i18n/language'

export default function SettingsDialog({ open, onOpenChange }) {
  const language = useLanguage()
  useDemoStorageWarnings()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 rounded-2xl p-6 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>App preferences for this browser.</DialogDescription>
        </DialogHeader>
        <section className="space-y-2">
          <label htmlFor="app-language" className="text-sm font-medium">Language</label>
          <select
            id="app-language"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <option value="en" translate="no">English</option>
            <option value="ko" translate="no">한국어 (Korean)</option>
          </select>
          <p className="text-xs leading-relaxed text-muted-foreground">Applies to the entire app. Code, file paths and your content stay in their original language.</p>
        </section>
        <DemoTools />
      </DialogContent>
    </Dialog>
  )
}
