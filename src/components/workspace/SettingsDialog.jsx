import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { useState } from 'react'
import DemoTools, { useDemoStorageWarnings } from '@/components/workspace/DemoTools'
import { setLanguage, useLanguage } from '@/i18n/language'
import { ChevronDown, Languages, Settings } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export function SettingsContent() {
  const language = useLanguage()
  useDemoStorageWarnings()
  return <div className="space-y-3 px-1 pb-1">
        <section className="space-y-2">
          <label id="app-language-label" className="text-xs font-medium text-foreground">Language</label>
          <DropdownMenu>
            <DropdownMenuTrigger aria-labelledby="app-language-label app-language-value" className="flex h-9 w-full items-center gap-2.5 rounded-lg border border-border bg-background px-3 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
        </section>
        <DemoTools />
  </div>
}

export default function SettingsDialog({ triggerClassName }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger aria-label="Settings" title="Settings" className={triggerClassName}>
        <Settings className="size-[18px]" />
      </PopoverTrigger>
      <PopoverContent side="right" align="end" sideOffset={12} className="w-64 max-h-[80vh] overflow-y-auto rounded-2xl border-white/10 bg-[#121212] p-3 shadow-xl">
        <PopoverTitle className="mb-1 text-xs font-medium text-muted-foreground">Settings</PopoverTitle>
        <SettingsContent />
      </PopoverContent>
    </Popover>
  )
}
