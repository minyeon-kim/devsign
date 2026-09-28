import { useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowRight, FileArchive, FileCode2, FileSpreadsheet, FolderGit2, Frame, PenTool, Upload } from 'lucide-react'
import { cn } from 'cn'
import { ACCENT_CTA, GHOST_BUTTON } from '@/components/mergestudio/floatingStyles'
import { assetIcon, getFileIconMeta } from '@/lib/fileIcons'
import { useWorkspace } from '@/state/WorkspaceProvider'

// What a GitHub import brings in — a small repo's worth of files, so the
// flow is real end to end (they land in the file tree and open).
function repoFiles(repo) {
  const name = repo.split('/').pop() || 'repo'
  return [
    new File([`# ${name}\n\nImported from ${repo}.\n`], 'README.md'),
    new File([JSON.stringify({ name, private: true, scripts: { dev: 'vite' } }, null, 2)], 'package.json'),
    new File(
      ["import { Button } from './components/Button'\n", '\n', 'export function App() {\n', '  return <Button>Get started</Button>\n', '}\n'],
      'App.jsx'
    ),
  ]
}

const inputClass =
  'h-9 min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.04] px-3.5 text-[13px] text-foreground outline-none placeholder:text-slate-500 focus:border-white/25'

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
      {formats && (
        <div className="mt-3 flex flex-wrap gap-1">
          {formats.map((f) => (
            <span key={f} className="rounded-md bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10.5px] text-slate-400">
              {f}
            </span>
          ))}
        </div>
      )}
      <div className="mt-auto pt-5">{children}</div>
    </article>
  )
}

function UploadButton({ accept, label, onFiles }) {
  const ref = useRef(null)
  return (
    <>
      <button type="button" onClick={() => ref.current?.click()} className={cn('inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full text-[13px] font-medium', GHOST_BUTTON)}>
        <Upload className="size-3.5" />
        {label}
      </button>
      <input
        ref={ref}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </>
  )
}

function UrlForm({ placeholder, action, onSubmit }) {
  const [value, setValue] = useState('')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!value.trim()) return
        onSubmit(value.trim())
        setValue('')
      }}
      className="flex items-center gap-1.5"
    >
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className={inputClass} />
      <button
        type="submit"
        disabled={!value.trim()}
        className={cn('h-9 shrink-0 rounded-full px-4 text-[13px] font-semibold', ACCENT_CTA, 'disabled:bg-white/[0.06] disabled:text-slate-500 disabled:shadow-none')}
      >
        {action}
      </button>
    </form>
  )
}

// Import — its own screen from the activity bar: a spacious grid of import
// sources (GitHub, Figma, Zip, Spreadsheet, code files, Illustrator/SVG),
// each a card with its own action, then what's been imported so far. Code
// lands in the file tree, everything else in Assets (see lib/importFiles).
function ImportPage() {
  const { project } = useOutletContext()
  const navigate = useNavigate()
  const { importFiles, importFigmaLink, importedAssets, workspaceFiles } = useWorkspace()
  const importedCode = workspaceFiles.filter((f) => f.imported)

  async function upload(files, what) {
    const { code, design } = await importFiles(files)
    toast(`${what} imported`, {
      description: [code && `${code} file${code === 1 ? '' : 's'} added to the file tree`, design && `${design} added to Assets`]
        .filter(Boolean)
        .join(' · '),
    })
  }

  return (
    <div className="h-full overflow-y-auto bg-background text-foreground">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-8 px-6 py-8 sm:px-10">
        <header>
          <h1 className="text-xl font-semibold tracking-tight text-white">Import</h1>
          <p className="mt-1 text-[13px] text-slate-400">Bring designs, code and data into {project.name}.</p>
        </header>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ImportCard
            icon={FolderGit2}
            tone="bg-slate-700"
            title="GitHub"
            description="Import a repository's files into this project's file tree."
            formats={['owner/repo', 'https://github.com/…']}
          >
            <UrlForm
              placeholder="owner/repository"
              action="Import"
              onSubmit={(repo) => upload(repoFiles(repo.replace(/^https?:\/\/github\.com\//, '')), 'Repository')}
            />
          </ImportCard>

          <ImportCard
            icon={Frame}
            tone="bg-violet-500"
            title="Figma design"
            description="Link a Figma file; its frames are available from Assets."
            formats={['figma.com/design/…', '.fig']}
          >
            <UrlForm
              placeholder="https://figma.com/design/…"
              action="Link"
              onSubmit={(url) => {
                const name = importFigmaLink(url)
                toast('Figma file linked', { description: `“${name}” added to Assets` })
              }}
            />
          </ImportCard>

          <ImportCard
            icon={FileArchive}
            tone="bg-amber-500"
            title="Zip file"
            description="Upload a project archive. It's kept with the project's assets."
            formats={['.zip']}
          >
            <UploadButton accept=".zip" label="Upload zip" onFiles={(f) => upload(f, 'Archive')} />
          </ImportCard>

          <ImportCard
            icon={FileSpreadsheet}
            tone="bg-emerald-600"
            title="Spreadsheet"
            description="CSV and TSV open as data files you can edit; Excel files join Assets."
            formats={['.csv', '.tsv', '.xlsx']}
          >
            <UploadButton accept=".csv,.tsv,.xlsx,.xls" label="Upload spreadsheet" onFiles={(f) => upload(f, 'Spreadsheet')} />
          </ImportCard>

          <ImportCard
            icon={FileCode2}
            tone="bg-sky-600"
            title="Code files"
            description="Components, styles and config — added to the file tree and opened."
            formats={['.jsx', '.tsx', '.js', '.css', '.json', '.md']}
          >
            <UploadButton accept=".js,.jsx,.ts,.tsx,.css,.scss,.json,.md,.html" label="Upload code" onFiles={(f) => upload(f, 'Code')} />
          </ImportCard>

          <ImportCard
            icon={PenTool}
            tone="bg-rose-500"
            title="Illustrator & images"
            description="Vector and image files for the canvas, kept in Assets."
            formats={['.ai', '.svg', '.png', '.jpg', '.pdf']}
          >
            <UploadButton accept=".ai,.eps,.svg,.png,.jpg,.jpeg,.webp,.pdf" label="Upload files" onFiles={(f) => upload(f, 'Design files')} />
          </ImportCard>
        </div>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-white">Imported</h2>
            {importedCode.length > 0 && (
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
          {importedCode.length + importedAssets.length === 0 ? (
            <p className="rounded-2xl bg-white/[0.03] px-4 py-8 text-center text-xs text-slate-500">Nothing imported yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {importedCode.map((file) => {
                const { Icon, colorClass } = getFileIconMeta(file.name)
                return (
                  <div key={file.id} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px]">
                    <Icon className={cn('size-4 shrink-0', colorClass)} />
                    <span className="min-w-0 flex-1 truncate text-slate-200">{file.name}</span>
                    <span className="shrink-0 font-mono text-[11px] text-slate-500">{file.path}</span>
                  </div>
                )
              })}
              {importedAssets.map((asset) => {
                const Icon = assetIcon(asset.kind)
                return (
                  <div key={asset.id} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px]">
                    <Icon className="size-4 shrink-0 text-violet-300" />
                    <span className="min-w-0 flex-1 truncate text-slate-200">{asset.name}</span>
                    <span className="shrink-0 text-[11px] text-slate-500">Assets · {asset.kind}</span>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default ImportPage
