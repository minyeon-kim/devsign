import { useRef, useState } from 'react'
import { toast } from '@/i18n/toast'
import { FileArchive, FileCode2, FileSpreadsheet, FolderGit2, Frame, PenTool, Upload } from 'lucide-react'
import { cn } from 'cn'
import { ACCENT_CTA, GHOST_BUTTON } from '@/components/mergestudio/floatingStyles'
import { assetIcon, getFileIconMeta } from '@/lib/fileIcons'
import { useWorkspace } from '@/state/WorkspaceProvider'

// The import sources shared by the Import drawer and the /import page:
// each one's look, what it takes, and its action (a URL field or a file
// picker). Code lands in the file tree, everything else in Assets (see
// lib/importFiles).

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

// Every source, in order, each with its action already wired to this
// project's WorkspaceProvider.
export function useImportSources() {
  const { importFiles, importFigmaLink } = useWorkspace()

  async function upload(files, what) {
    const { code, design } = await importFiles(files)
    toast(`${what} imported`, {
      description: [code && `${code} file${code === 1 ? '' : 's'} added to the file tree`, design && `${design} added to Assets`]
        .filter(Boolean)
        .join(' · '),
    })
  }

  return [
    {
      id: 'github',
      icon: FolderGit2,
      tone: 'bg-slate-700',
      title: 'GitHub',
      description: "Import a repository's files into this project's file tree.",
      formats: ['owner/repo', 'https://github.com/…'],
      action: (
        <UrlForm
          placeholder="owner/repository"
          action="Import"
          onSubmit={(repo) => upload(repoFiles(repo.replace(/^https?:\/\/github\.com\//, '')), 'Repository')}
        />
      ),
    },
    {
      id: 'figma',
      icon: Frame,
      tone: 'bg-violet-500',
      title: 'Figma design',
      description: 'Link a Figma file; its frames are available from Assets.',
      formats: ['figma.com/design/…', '.fig'],
      action: (
        <UrlForm
          placeholder="https://figma.com/design/…"
          action="Link"
          onSubmit={(url) => {
            const name = importFigmaLink(url)
            toast('Figma file linked', { description: `“${name}” added to Assets` })
          }}
        />
      ),
    },
    {
      id: 'zip',
      icon: FileArchive,
      tone: 'bg-amber-500',
      title: 'Zip file',
      description: "Upload a project archive. It's kept with the project's assets.",
      formats: ['.zip'],
      action: <UploadButton accept=".zip" label="Upload zip" onFiles={(f) => upload(f, 'Archive')} />,
    },
    {
      id: 'spreadsheet',
      icon: FileSpreadsheet,
      tone: 'bg-emerald-600',
      title: 'Spreadsheet',
      description: 'CSV and TSV open as data files you can edit; Excel files join Assets.',
      formats: ['.csv', '.tsv', '.xlsx'],
      action: <UploadButton accept=".csv,.tsv,.xlsx,.xls" label="Upload spreadsheet" onFiles={(f) => upload(f, 'Spreadsheet')} />,
    },
    {
      id: 'code',
      icon: FileCode2,
      tone: 'bg-sky-600',
      title: 'Code files',
      description: 'Components, styles and config — added to the file tree and opened.',
      formats: ['.jsx', '.tsx', '.js', '.css', '.json', '.md'],
      action: <UploadButton accept=".js,.jsx,.ts,.tsx,.css,.scss,.json,.md,.html" label="Upload code" onFiles={(f) => upload(f, 'Code')} />,
    },
    {
      id: 'design',
      icon: PenTool,
      tone: 'bg-rose-500',
      title: 'Illustrator & images',
      description: 'Vector and image files for the canvas, kept in Assets.',
      formats: ['.ai', '.svg', '.png', '.jpg', '.pdf'],
      action: <UploadButton accept=".ai,.eps,.svg,.png,.jpg,.jpeg,.webp,.pdf" label="Upload files" onFiles={(f) => upload(f, 'Design files')} />,
    },
  ]
}

export function FormatChips({ formats, className }) {
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {formats.map((f) => (
        <span key={f} className="rounded-md bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10.5px] text-slate-400">
          {f}
        </span>
      ))}
    </div>
  )
}

// What's been imported so far: code files (file tree) then Assets.
export function ImportedItems({ className, showPath = true }) {
  const { importedAssets, workspaceFiles } = useWorkspace()
  const importedCode = workspaceFiles.filter((f) => f.imported)

  if (importedCode.length + importedAssets.length === 0) {
    return <p className="rounded-2xl bg-white/[0.03] px-4 py-8 text-center text-xs text-slate-500">Nothing imported yet.</p>
  }
  return (
    <div className={className}>
      {importedCode.map((file) => {
        const { Icon, colorClass } = getFileIconMeta(file.name)
        return (
          <div key={file.id} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px]">
            <Icon className={cn('size-4 shrink-0', colorClass)} />
            <span className="min-w-0 flex-1 truncate text-slate-200">{file.name}</span>
            {showPath && <span className="shrink-0 font-mono text-[11px] text-slate-500">{file.path}</span>}
          </div>
        )
      })}
      {importedAssets.map((asset) => {
        const Icon = assetIcon(asset.kind)
        return (
          <div key={asset.id} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px]">
            <Icon className="size-4 shrink-0 text-violet-300" />
            <span className="min-w-0 flex-1 truncate text-slate-200">{asset.name}</span>
            <span className="shrink-0 text-[11px] text-slate-500">{showPath ? `Assets · ${asset.kind}` : 'Assets'}</span>
          </div>
        )
      })}
    </div>
  )
}
