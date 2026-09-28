import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from 'cn'
import { FormatChips, ImportedItems, useImportSources } from '@/components/import/importSources'

// The drawer behind the activity bar's Import icon — beside the Workspace
// (or whatever's open), so you never leave it to bring something in. The
// sources are a compact accordion: a row each, opening to what it takes
// and its action (a URL field or a file picker). Below, what's been
// imported so far.
function ImportDrawer({ project }) {
  const sources = useImportSources()
  const [openId, setOpenId] = useState(null)

  return (
    <div className="flex flex-col pb-2">
      <p className="mb-2 px-2.5 text-[12px] leading-snug text-slate-500">Bring designs, code and data into {project.name}.</p>

      {sources.map((source) => {
        const Icon = source.icon
        const open = openId === source.id
        return (
          <div key={source.id} className={cn('rounded-xl transition-colors', open ? 'bg-white/[0.04]' : 'hover:bg-white/[0.03]')}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : source.id)}
              className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left"
            >
              <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg', source.tone)}>
                <Icon className="size-3.5 text-white" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-slate-100">{source.title}</span>
                <span className="block truncate font-mono text-[10.5px] text-slate-500">{source.formats.join('  ')}</span>
              </span>
              <ChevronDown className={cn('size-3.5 shrink-0 text-slate-500 transition-transform', open && 'rotate-180')} />
            </button>
            {open && (
              <div className="px-2.5 pb-3 animate-in fade-in slide-in-from-top-1 duration-150">
                <p className="text-[12px] leading-relaxed text-slate-400">{source.description}</p>
                <FormatChips formats={source.formats} className="mt-2 mb-3" />
                {source.action}
              </div>
            )}
          </div>
        )
      })}

      <p className="mt-5 mb-1 px-2.5 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Imported</p>
      <ImportedItems showPath={false} />
    </div>
  )
}

export default ImportDrawer
