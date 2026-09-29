import { useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from 'cn'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { FLOATING_PANEL, PANEL_RADIUS } from '@/components/mergestudio/floatingStyles'

// A Cursor-style command modal: a search field over a sectioned list —
// type to filter, ↑ ↓ to move, Enter to run. Shared by the Workspace's ⌘K
// command palette and each window's `+`. No backdrop: it opens over the
// workspace without dimming or blocking it.
// `commands`: `{ id, section, label, hint?, icon, keywords?, run }`.
function CommandModal({ open, onOpenChange, commands, title, placeholder }) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const listRef = useRef(null)

  // Every opening starts fresh, however it was opened.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setQuery('')
      setActiveIndex(0)
    }
  }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => `${c.label} ${c.hint ?? ''} ${c.keywords ?? ''} ${c.section}`.toLowerCase().includes(q))
  }, [commands, query])

  function run(command) {
    onOpenChange(false)
    command.run()
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const next = (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % Math.max(1, results.length)
      setActiveIndex(next)
      listRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: 'nearest' })
    } else if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault()
      run(results[activeIndex])
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent
        overlay={false}
        showCloseButton={false}
        className={cn('top-[18%] translate-y-0 gap-0 overflow-hidden bg-card p-0 ring-0 sm:max-w-[560px]', PANEL_RADIUS, FLOATING_PANEL)}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-4">
          <Search className="size-4 shrink-0 text-slate-500" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            aria-label={title}
            className="h-12 min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-slate-500"
          />
          <kbd className="shrink-0 rounded-md bg-white/[0.06] px-1.5 py-0.5 font-sans text-[10.5px] text-slate-400">esc</kbd>
        </div>

        <div ref={listRef} role="listbox" aria-label="Commands" className="max-h-[360px] overflow-y-auto p-1.5">
          {results.length === 0 && <p className="px-3 py-8 text-center text-xs text-slate-500">No matching commands.</p>}
          {results.map((command, i) => {
            const Icon = command.icon
            const newSection = i === 0 || results[i - 1].section !== command.section
            return (
              <div key={command.id}>
                {newSection && (
                  <p className="px-3 pt-2 pb-1 text-[10.5px] font-semibold tracking-wide text-slate-500 uppercase">{command.section}</p>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === activeIndex}
                  data-index={i}
                  onMouseMove={() => setActiveIndex(i)}
                  onClick={() => run(command)}
                  className={cn(
                    'flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-left text-[13px] transition-colors',
                    i === activeIndex ? 'bg-white/[0.07] text-white' : 'text-slate-300'
                  )}
                >
                  <Icon className="size-4 shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1 truncate">{command.label}</span>
                  {command.hint && <span className="shrink-0 text-[11px] text-slate-500">{command.hint}</span>}
                </button>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default CommandModal
