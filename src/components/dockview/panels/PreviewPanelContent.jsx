import { cn } from 'cn'
import { useWorkspace } from '@/state/WorkspaceProvider'

const buttonColorClasses = {
  primary: 'bg-primary text-primary-foreground',
  sky: 'bg-sky-500 text-white',
}

function PreviewPanelContent() {
  const { workspaceFiles, activeFileId, previewProps, previewVersion } = useWorkspace()
  const activeFile = workspaceFiles.find((file) => file.id === activeFileId) ?? workspaceFiles[0]

  return (
    <div className="flex h-full flex-col overflow-auto bg-card p-4">
      <div className="mb-3 flex shrink-0 items-center justify-between text-[11px] text-muted-foreground">
        <span className="truncate">Synced from {activeFile?.path}</span>
        <span className="flex shrink-0 items-center gap-1">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          Live
        </span>
      </div>

      <div
        key={previewVersion}
        className="mx-auto w-full max-w-[260px] animate-in rounded-xl border bg-background p-4 shadow-lg duration-300 fade-in zoom-in-95"
      >
        <div
          className="mb-4 h-28 rounded-lg border border-border bg-muted/40"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, color-mix(in oklch, var(--foreground) 6%, transparent) 0 6px, transparent 6px 12px)',
          }}
        />
        <div className="mb-1.5 h-3.5 w-3/4 rounded-sm bg-muted-foreground/25" />
        <div className="mb-1.5 h-2.5 w-full rounded-sm bg-muted-foreground/20" />
        <div className="mb-4 h-2.5 w-2/3 rounded-sm bg-muted-foreground/20" />
        <button
          type="button"
          className={cn(
            'w-full rounded-md text-xs font-medium transition-colors',
            buttonColorClasses[previewProps.buttonColor] ?? buttonColorClasses.primary
          )}
          style={{ padding: previewProps.buttonPadding }}
        >
          Continue
        </button>
      </div>
    </div>
  )
}

export default PreviewPanelContent
