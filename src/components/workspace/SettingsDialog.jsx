import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { useState } from 'react'
import DemoTools, { useDemoStorageWarnings } from '@/components/workspace/DemoTools'
import { setLanguage, useLanguage } from '@/i18n/language'
import { Settings } from 'lucide-react'
import { cn } from 'cn'

const LANGUAGES = [
  ['en', 'English'],
  ['ko', '한국어'],
]

// Plain rows, no boxes or rules: "Language ··· English 한국어" with both
// choices right in the row as text toggles — two options don't need a
// menu of their own popping out of the popover — then the reset row.
export function SettingsContent() {
  const language = useLanguage()
  useDemoStorageWarnings()
  return (
    <div className="space-y-0.5">
      <section className="flex h-8 items-center justify-between gap-2 px-2">
        <span id="app-language-label" className="text-xs text-slate-300">Language</span>
        <div role="radiogroup" aria-labelledby="app-language-label" className="flex items-center gap-x-3">
          {LANGUAGES.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={language === id}
              translate="no"
              onClick={() => setLanguage(id)}
              className={cn(
                'ds-intrinsic inline-flex h-5 items-center text-xs whitespace-nowrap transition-colors',
                language === id ? 'font-medium text-white' : 'text-slate-500 hover:text-slate-300'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
      <DemoTools />
    </div>
  )
}

// Opens beside the activity bar's gear, its bottom edge on the same line
// as the Workspace bottom panel's (both sit 8px above the window edge).
export default function SettingsDialog({ triggerClassName }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger aria-label="Settings" title="Settings" className={triggerClassName}>
        <Settings className="size-[18px]" />
      </PopoverTrigger>
      <PopoverContent side="right" align="end" sideOffset={14} alignOffset={8} className="w-56 gap-1 rounded-xl border-white/10 bg-popover p-1.5 shadow-xl">
        <PopoverTitle className="px-2 pt-1 pb-0.5 text-[11px] font-medium text-slate-500">Settings</PopoverTitle>
        <SettingsContent />
      </PopoverContent>
    </Popover>
  )
}
