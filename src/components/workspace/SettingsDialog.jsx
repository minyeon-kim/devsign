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

// As the Workspace's controls: "Language" with its two choices as the segmented capsule (미리보기 · 화면 ·
// 코드's), then, under a rule, the reset row.
export function SettingsContent({ onDone }) {
  const language = useLanguage()
  useDemoStorageWarnings()
  return (
    <div className="space-y-0.5">
      <section className="flex h-8 items-center justify-between gap-2 px-2">
        <span id="app-language-label" className="text-xs text-slate-300">Language</span>
        <div role="radiogroup" aria-labelledby="app-language-label" className="flex h-7 items-center gap-0.5 rounded-full bg-white/[0.06] p-0.5">
          {LANGUAGES.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={language === id}
              translate="no"
              onClick={() => setLanguage(id)}
              className={cn(
                'ds-intrinsic inline-flex h-6 items-center rounded-full px-2.5 text-xs whitespace-nowrap transition-colors',
                language === id ? 'bg-white/[0.16] font-semibold text-white shadow-[0_1px_2px_rgb(0_0_0/0.35)]' : 'text-slate-400 hover:text-slate-200'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
      <DemoTools onDone={onDone} />
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
      <PopoverContent side="right" align="end" sideOffset={14} alignOffset={8} className="w-64 gap-1 rounded-[20px] border-white/10 bg-popover p-2 shadow-xl">
        <PopoverTitle className="px-2 pt-1 pb-1 text-[13px] font-semibold text-foreground">Settings</PopoverTitle>
        <SettingsContent onDone={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}
