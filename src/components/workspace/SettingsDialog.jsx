import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import DemoTools, { useDemoStorageWarnings } from '@/components/workspace/DemoTools'
import { setLanguage, useLanguage } from '@/i18n/language'
import { ChevronDown, Languages } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export default function SettingsDialog({ open, onOpenChange }) {
  const language = useLanguage()
  useDemoStorageWarnings()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>App preferences for this browser.</DialogDescription>
        </DialogHeader>
        <section className="space-y-2">
          <label id="app-language-label" className="text-xs font-medium text-foreground">Language</label>
          <DropdownMenu>
            <DropdownMenuTrigger aria-labelledby="app-language-label app-language-value" className="flex h-10 w-full items-center gap-2.5 rounded-lg border border-border bg-background px-3 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Languages className="size-4 text-muted-foreground" />
              <span id="app-language-value" translate="no" className="flex-1 text-left">{language === 'ko' ? '한국어' : 'English'}</span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[var(--anchor-width)]">
              <DropdownMenuRadioGroup value={language} onValueChange={setLanguage}>
                <DropdownMenuRadioItem value="en"><span translate="no">English</span></DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="ko"><span translate="no">한국어</span></DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <p className="text-xs leading-relaxed text-muted-foreground">Applies to the entire app. Code, file paths and your content stay in their original language.</p>
        </section>
        <DemoTools />
      </DialogContent>
    </Dialog>
  )
}
