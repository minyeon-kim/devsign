import { useEffect, useRef, useState } from 'react'
import { GripVertical, PenTool, Sparkles } from 'lucide-react'
import { cn } from 'cn'
import { designMergeVariants, openFiles } from '@/data/mockData'
import { getFileIconMeta } from '@/lib/fileIcons'
import { tokenClassName, tokenizeLine } from '@/lib/syntaxHighlight'
import { useWorkspace } from '@/state/WorkspaceProvider'
import MergeCanvasCompare from '@/components/mergestudio/MergeCanvasCompare'

const MIN_SPLIT = 0.28
const MAX_SPLIT = 0.75
const DEFAULT_SPLIT = 0.5
// Half of the splitter's own width, subtracted from each side's percentage
// so the two panes plus the splitter always sum to exactly the container's
// width — without this, the panes' percentages alone summed to 100% *before*
// accounting for the splitter, so the row was reliably a few pixels too
// wide and depended on flex-shrink to quietly absorb the overflow. That
// approximation is exactly the kind of thing that can tip into visibly
// clipping the design pane depending on the browser's rounding.
const SPLITTER_HALF_WIDTH = 6

// All of the active merge item's code files live in one window, switched via
// Chrome-style pill tabs (matching EditorPanel's own file tabs) — not
// scattered across separate cards. The active tab is the shared
// `activeFileId`, so it stays in sync with the rest of the app (returning to
// the normal workspace picks up on whichever file was last open here).
// `highlightLine` is the code->design sync's other half: whichever line a
// selected design layer maps to gets a distinct highlight and is scrolled
// into view; clicking any line (mapped or not) reports back via
// `onSelectLine` so a design layer can highlight in turn.
function UnifiedCodeWindow({ files, style, highlightFileId, highlightLine, onSelectLine }) {
  const { activeFileId, setActiveFileId, getFileLines } = useWorkspace()
  const activeFile = files.find((f) => f.id === activeFileId) ?? files[0]
  const lines = activeFile ? getFileLines(activeFile.id) : []
  const highlightRef = useRef(null)
  const isHighlightedFile = activeFile && highlightFileId === activeFile.id

  useEffect(() => {
    highlightRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [highlightFileId, highlightLine])

  return (
    <div
      style={style}
      className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm"
    >
      <div className="flex h-10 shrink-0 items-center gap-1.5 border-b bg-card px-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
          {files.map((file) => {
            const { Icon, colorClass } = getFileIconMeta(file.name)
            const active = activeFile?.id === file.id
            return (
              <button
                key={file.id}
                type="button"
                onClick={() => setActiveFileId(file.id)}
                className={cn(
                  'flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs transition-colors',
                  active
                    ? 'bg-muted text-foreground ring-1 ring-border'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
              >
                <Icon className={cn('size-3.5 shrink-0', colorClass)} />
                {file.name}
              </button>
            )
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-background py-2 font-mono text-[11px] leading-relaxed">
        {lines.map((line, i) => {
          const lineNumber = i + 1
          const tokens = tokenizeLine(line, activeFile.language)
          const isHighlighted = isHighlightedFile && highlightLine === lineNumber
          return (
            <div
              key={i}
              ref={isHighlighted ? highlightRef : undefined}
              onClick={() => onSelectLine?.(activeFile.id, lineNumber)}
              className={cn(
                'flex cursor-pointer gap-3 border-l-2 border-transparent px-3 hover:bg-muted/40',
                isHighlighted && 'border-primary bg-primary/10'
              )}
            >
              <span className="w-5 shrink-0 text-right text-muted-foreground/40 select-none">
                {lineNumber}
              </span>
              <span className="whitespace-pre">
                {line.length === 0 ? (
                  ' '
                ) : (
                  tokens.map((token, j) => (
                    <span key={j} className={tokenClassName(token.type)}>
                      {token.text}
                    </span>
                  ))
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// The design side of the split — Option A / Option B artboards on an
// infinite canvas plus a Variant Inspector (see MergeCanvasCompare).
function DesignPane({ item, style, selectedLayerId, onSelectLayer }) {
  return (
    <div
      style={style}
      className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm"
    >
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b bg-card px-3 text-xs font-medium text-foreground">
        <PenTool className="size-3.5 shrink-0 text-primary" />
        Design
      </div>
      <MergeCanvasCompare item={item} selectedLayerId={selectedLayerId} onSelectLayer={onSelectLayer} />
    </div>
  )
}

// A draggable handle between the code and design panes — drag adjusts
// `splitRatio` (the code pane's share of the row's width), clamped so
// neither side can be squeezed away entirely.
function Splitter({ onDrag }) {
  function handlePointerDown(event) {
    event.preventDefault()
    function onMove(moveEvent) {
      onDrag(moveEvent.clientX)
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      title="Drag to resize"
      className="group flex w-3 shrink-0 cursor-col-resize items-center justify-center"
    >
      <div className="flex h-10 w-1.5 items-center justify-center rounded-full bg-border transition-colors group-hover:bg-primary">
        <GripVertical className="size-3 text-muted-foreground/0 transition-colors group-hover:text-primary-foreground" />
      </div>
    </div>
  )
}

// The right-hand side of Merge Studio. "Design + Code" items get a clean,
// resizable two-column split — one unified code window on the left, the
// design comparison on the right — instead of a cluttered row of many
// cards. Selecting a layer on the Option A artboard jumps/highlights the
// matching code line, and clicking a code line highlights its matching
// layer back — see `designMergeVariants[item.id].layerCodeMap`. Code-only
// items just get the unified code window, full width, with no sync (there's
// nothing on this screen to sync it to).
function MergeStudioWorkspace({ item }) {
  const { setActiveFileId, setActivePageId } = useWorkspace()
  const containerRef = useRef(null)
  const [splitRatio, setSplitRatio] = useState(DEFAULT_SPLIT)
  const [syncSelection, setSyncSelection] = useState(null)

  useEffect(() => {
    if (!item) return
    setSyncSelection(null)
    // Every newly-selected merge item starts from a balanced 50:50 split —
    // a previous item's manual resize shouldn't carry over and potentially
    // start the new one squeezed.
    setSplitRatio(DEFAULT_SPLIT)
    if (item.fileIds?.[0]) setActiveFileId(item.fileIds[0])
    if (item.hasDesign && item.designPageId) setActivePageId(item.designPageId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id])

  function handleSplitDrag(clientX) {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const ratio = (clientX - rect.left) / rect.width
    setSplitRatio(Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, ratio)))
  }

  function selectLayer(layerId) {
    const map = designMergeVariants[item.id]?.layerCodeMap ?? {}
    const target = map[layerId]
    setSyncSelection({ layerId, fileId: target?.fileId, line: target?.line })
    if (target?.fileId) setActiveFileId(target.fileId)
  }

  function selectLine(fileId, line) {
    const map = designMergeVariants[item.id]?.layerCodeMap ?? {}
    const layerId = Object.keys(map).find((id) => map[id].fileId === fileId && map[id].line === line)
    setSyncSelection({ layerId, fileId, line })
  }

  if (!item) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="size-5" />
        </span>
        <p className="max-w-sm text-xs text-muted-foreground">
          Select an item from the Merge List, or add your currently open files to start a new
          merge.
        </p>
      </div>
    )
  }

  const files = openFiles.filter((f) => item.fileIds?.includes(f.id))

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 bg-background p-4">
      <UnifiedCodeWindow
        files={files}
        style={{
          width: item.hasDesign
            ? `calc(${splitRatio * 100}% - ${SPLITTER_HALF_WIDTH}px)`
            : '100%',
        }}
        highlightFileId={item.hasDesign ? syncSelection?.fileId : undefined}
        highlightLine={item.hasDesign ? syncSelection?.line : undefined}
        onSelectLine={item.hasDesign ? selectLine : undefined}
      />
      {item.hasDesign && (
        <>
          <Splitter onDrag={handleSplitDrag} />
          <DesignPane
            item={item}
            style={{ width: `calc(${(1 - splitRatio) * 100}% - ${SPLITTER_HALF_WIDTH}px)` }}
            selectedLayerId={syncSelection?.layerId}
            onSelectLayer={selectLayer}
          />
        </>
      )}
    </div>
  )
}

export default MergeStudioWorkspace
