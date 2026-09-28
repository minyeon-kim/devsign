import { useNavigate, useOutletContext } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { cn } from 'cn'
import { FormatChips, ImportedItems, useImportSources } from '@/components/import/importSources'
import { useWorkspace } from '@/state/WorkspaceProvider'

// One import source: icon, name, what it takes, and its action — a URL
// field, or a file picker.
function ImportCard({ icon: Icon, tone, title, description, formats, children }) {
  return (
    <article className="flex flex-col rounded-2xl bg-white/[0.03] p-5 transition-colors hover:bg-white/[0.045]">
      <span className={cn('flex size-10 items-center justify-center rounded-xl', tone)}>
        <Icon className="size-5 text-white" />
      </span>
      <h2 className="mt-4 text-[15px] font-semibold text-white">{title}</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{description}</p>
      {formats && <FormatChips formats={formats} className="mt-3" />}
      <div className="mt-auto pt-5">{children}</div>
    </article>
  )
}

// Import as a full page — the activity bar opens Import as a drawer now
// (ImportDrawer); this spacious grid of the same sources stays for direct
// /import links. Each source is a card with its own action, then what's
// been imported so far.
function ImportPage() {
  const { project } = useOutletContext()
  const navigate = useNavigate()
  const { workspaceFiles } = useWorkspace()
  const sources = useImportSources()
  const hasImportedCode = workspaceFiles.some((f) => f.imported)

  return (
    <div className="h-full overflow-y-auto bg-background text-foreground">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-8 px-6 py-8 sm:px-10">
        <header>
          <h1 className="text-xl font-semibold tracking-tight text-white">Import</h1>
          <p className="mt-1 text-[13px] text-slate-400">Bring designs, code and data into {project.name}.</p>
        </header>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sources.map((source) => (
            <ImportCard
              key={source.id}
              icon={source.icon}
              tone={source.tone}
              title={source.title}
              description={source.description}
              formats={source.formats}
            >
              {source.action}
            </ImportCard>
          ))}
        </div>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-white">Imported</h2>
            {hasImportedCode && (
              <button
                type="button"
                onClick={() => navigate(`/projects/${project.id}/workspace`)}
                className="flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-white"
              >
                Open in Workspace
                <ArrowRight className="size-3.5" />
              </button>
            )}
          </div>
          <ImportedItems className="grid grid-cols-1 gap-1 sm:grid-cols-2" />
        </section>
      </div>
    </div>
  )
}

export default ImportPage
