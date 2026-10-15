import { useState } from 'react'
import { Check, ChevronDown, Copy, Globe, Lock, Share2 } from 'lucide-react'
import { cn } from 'cn'
import { teamMembers } from '@/data/mockData'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { STUDIO_PILL as FLOATING_PILL, WORKSPACE_POPOVER } from '@/components/mergestudio/floatingStyles'

// The Share control, in the top header of both Merge Studio and the
// Workspace (it used to live in the app's right-hand floating toolbar):
// per-teammate access, general link access, and a copy-link. Merge Studio
// shares its merge item as a standalone pill; the Workspace passes its own
// `title` / `link` and an `inline` trigger that sits inside its action pill.
// The panel is the workspace's popover (WORKSPACE_POPOVER): a row per person, the access a quiet word with a
// chevron at its end, picked from a menu like the way picker's (a check on the one picked).
const ROW = 'flex min-h-11 items-center gap-2.5 rounded-xl px-2.5 py-1.5'

function RoleMenu({ value, options, onChange }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[12px] text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white data-[popup-open]:bg-white/[0.06]">
        {value}
        <ChevronDown aria-hidden className="size-3.5 text-slate-500" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4} className="min-w-44 rounded-xl bg-[#262626] p-1.5 shadow-xl shadow-black/40 ring-white/10">
        {options.map((o) => (
          <DropdownMenuItem key={o} onClick={() => onChange(o)} className={cn('flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] text-white', o === value && 'bg-white/[0.06]')}>
            <span className="flex-1">{o}</span>
            <Check aria-hidden className={cn('size-4 shrink-0', o !== value && 'invisible')} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MergeShareButton({ item, title = item?.title, link: linkProp, inline = false, borderless = false }) {
  const [roles, setRoles] = useState(() => Object.fromEntries(teamMembers.map((m) => [m.id, 'Can edit'])))
  const [linkAccess, setLinkAccess] = useState('Restricted')
  const [copied, setCopied] = useState(false)
  const link = linkProp ?? `https://devsign.app/merge/${item.id}`

  function copyLink() {
    navigator.clipboard?.writeText(link)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Popover>
      <PopoverTrigger
        className={
          inline
            ? 'flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-white/10 data-[popup-open]:bg-white/10'
            : borderless
              // The Workspace header's own pill language (see TopBar's
              // presence pill) — same `ds-header-pill` surface and 32px
              // height as its neighbors, not Merge Studio's taller bordered
              // one, so it reads as one row instead of an odd one out.
              ? 'ds-header-pill flex h-8 items-center justify-center gap-2 rounded-full px-3 text-[13px] font-semibold text-foreground transition-colors'
              : cn('flex h-10 items-center justify-center gap-2 rounded-full px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted', FLOATING_PILL)
        }
      >
        <Share2 className={inline ? 'size-3.5' : 'size-4'} />
        Share
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} data-share-panel className={cn('w-80 gap-0', WORKSPACE_POPOVER)}>
        <div className="px-2.5 pt-2 pb-1.5">
          <p className="text-[13px] font-semibold text-white">Share</p>
          <p className="truncate text-[12px] text-slate-400" translate="no">{title}</p>
        </div>
        {teamMembers.map((m) => (
          <div key={m.id} className={ROW}>
            <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white', m.colorClass)}>{m.initials}</span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] leading-5 font-medium text-white">{m.name}</span>
              <span className="truncate text-[11.5px] leading-4 text-slate-400">{m.role}</span>
            </span>
            <RoleMenu value={roles[m.id]} options={['Can edit', 'Can view']} onChange={(v) => setRoles((prev) => ({ ...prev, [m.id]: v }))} />
          </div>
        ))}
        <div aria-hidden className="mx-2.5 my-1 h-px bg-white/[0.06]" />
        <div className={ROW}>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-slate-300">
            {linkAccess === 'Restricted' ? <Lock aria-hidden className="size-3.5" /> : <Globe aria-hidden className="size-3.5" />}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-white">General access</span>
          <RoleMenu value={linkAccess} options={['Restricted', 'Anyone with the link']} onChange={setLinkAccess} />
        </div>
        <div className="px-1 pt-1.5 pb-1">
          <button
            type="button"
            onClick={copyLink}
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-white/[0.08] text-[13px] font-medium text-white transition-colors hover:bg-white/[0.12]"
          >
            {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
            {copied ? 'Link copied' : 'Copy link'}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default MergeShareButton
