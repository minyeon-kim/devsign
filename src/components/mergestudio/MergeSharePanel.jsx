import { useState } from 'react'
import { Check, ChevronDown, Copy, Share2 } from 'lucide-react'
import { cn } from 'cn'
import { teamMembers } from '@/data/mockData'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FLOATING_PILL } from '@/components/mergestudio/floatingStyles'

// Merge Studio's Share control, in the top header (it used to live in the
// app's right-hand floating toolbar): per-teammate access, general link
// access, and a copy-link for this merge item.
function RoleMenu({ value, options, onChange }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-6 items-center justify-center gap-1 rounded-full border border-white/10 px-2 text-[11px] text-muted-foreground hover:bg-white/5 hover:text-foreground">
        {value}
        <ChevronDown className="size-2.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl border border-white/10 bg-card/95 backdrop-blur-xl">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {options.map((o) => (
            <DropdownMenuRadioItem key={o} value={o} className="text-xs">
              {o}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MergeShareButton({ item }) {
  const [roles, setRoles] = useState(() => Object.fromEntries(teamMembers.map((m) => [m.id, 'Can edit'])))
  const [linkAccess, setLinkAccess] = useState('Restricted')
  const [copied, setCopied] = useState(false)
  const link = `https://devsign.app/merge/${item.id}`

  function copyLink() {
    navigator.clipboard?.writeText(link)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Popover>
      <PopoverTrigger className={cn('flex h-10 items-center justify-center gap-2 rounded-full px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted', FLOATING_PILL)}>
        <Share2 className="size-4" />
        Share
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 gap-3 rounded-2xl border border-white/10 bg-card/95 p-3 backdrop-blur-xl">
        <p className="text-sm font-semibold text-foreground">Share “{item.title}”</p>
        <div className="space-y-1.5">
          {teamMembers.map((m) => (
            <div key={m.id} className="flex items-center gap-2 text-xs">
              <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white', m.colorClass)}>{m.initials}</span>
              <span className="min-w-0 flex-1 truncate text-foreground">
                {m.name}
                <span className="ml-1.5 text-[10px] text-muted-foreground">{m.role}</span>
              </span>
              <RoleMenu value={roles[m.id]} options={['Can edit', 'Can view']} onChange={(v) => setRoles((prev) => ({ ...prev, [m.id]: v }))} />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-white/10 pt-3 text-xs">
          <span className="text-muted-foreground">General access</span>
          <RoleMenu value={linkAccess} options={['Restricted', 'Anyone with the link']} onChange={setLinkAccess} />
        </div>
        <button
          type="button"
          onClick={copyLink}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-full border border-white/15 text-xs font-medium text-foreground transition-colors hover:border-white/25 hover:bg-white/[0.07]"
        >
          {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
          {copied ? 'Link copied' : 'Copy link'}
        </button>
      </PopoverContent>
    </Popover>
  )
}

export default MergeShareButton
