import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import TopBar from '@/components/layout/TopBar'
import ErrorBoundary from '@/components/ErrorBoundary'
import { TriangleAlert } from 'lucide-react'
import FollowMeBanner from '@/components/layout/FollowMeBanner'
import CommandPalette from '@/components/layout/CommandPalette'
import MergeStudioView from '@/components/mergestudio/MergeStudioView'
import WorkspaceSplitLayout from '@/components/workspace/WorkspaceSplitLayout'
import WorkspaceBottomPanel from '@/components/workspace/WorkspaceBottomPanel'
import { WorkspaceBottomPanelPortalContext } from '@/components/workspace/WorkspaceBottomPanelContext'
import { useWorkspace } from '@/state/WorkspaceProvider'

// Project resolution + WorkspaceProvider now live in ProjectLayout (the
// parent route), shared with ArchivePage — this component just consumes
// that context via useOutletContext/useWorkspace.
function WorkspacePage() {
  const { project } = useOutletContext()
  const location = useLocation()
  const navigate = useNavigate()
  const {
    activeView,
    openMergeStudio,
    exitMergeStudio,
    mergeItems,
    setSelectedMergeItemId,
    requestMergeFocus,
    conflicts,
    setBottomPanel,
    focusChange,
    openConflictReview,
  } = useWorkspace()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [workspaceRoot, setWorkspaceRoot] = useState(null)

  // Arriving with an intent in router state:
  //  · `openMergeStudio` (a Conflict Point's "Open in Merge Studio") — Merge
  //    Studio on that conflict's item, its element (or line) focused; with
  //    no linked item nothing is pre-selected (never an unrelated default);
  //  · `openConflictId` (Dashboard / overview links) — the Conflict Points
  //    tab, that conflict's review window, and its element and file.
  // Handled once per navigation (location.key).
  const handledNav = useRef(null)
  useEffect(() => {
    const state = location.state
    if (!state || handledNav.current === location.key) return
    handledNav.current = location.key
    // Consume it, so a later remount (e.g. back from History) doesn't
    // replay it; Back still returns to where the link was clicked.
    navigate(location.pathname, { replace: true, state: null })
    if (state.openMergeStudio) {
      const item = state.mergeItemId && mergeItems.find((i) => i.id === state.mergeItemId)
      setSelectedMergeItemId(item ? item.id : null)
      openMergeStudio()
      if (item) {
        requestMergeFocus({
          itemId: item.id,
          ...(state.layerId ? { layerId: state.layerId } : { fileId: state.fileId, line: state.line }),
          openDeck: true,
        })
      }
      return
    }
    if (state.openConflictId) {
      const conflict = conflicts.find((c) => c.id === state.openConflictId)
      if (!conflict) return
      exitMergeStudio()
      setBottomPanel({ open: true, tab: 'conflict' })
      focusChange(conflict)
      openConflictReview(conflict.id)
    }
  }, [
    location.key,
    location.pathname,
    location.state,
    navigate,
    conflicts,
    mergeItems,
    openMergeStudio,
    exitMergeStudio,
    requestMergeFocus,
    setSelectedMergeItemId,
    setBottomPanel,
    focusChange,
    openConflictReview,
  ])

  const inMergeStudio = activeView === 'mergeStudio'

  return (
    // One persistent dock owns the AI and navigator panels in both modes.
    // Merge Studio replaces only its canvas pane and owns its bottom panel.
    <WorkspaceBottomPanelPortalContext.Provider value={workspaceRoot}>
    <div ref={setWorkspaceRoot} className="ds-workspace relative flex h-full flex-col overflow-hidden bg-[#070708] text-foreground">
      <div className="@container relative min-h-0 flex-1 overflow-hidden">
        <WorkspaceSplitLayout mergeStudio={inMergeStudio}>
          {inMergeStudio && (
            <ErrorBoundary
              key={location.key}
              fallback={(error, reset) => (
                <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-2 bg-[#070708] p-6 text-center text-slate-400">
                  <TriangleAlert className="size-5 text-amber-400" />
                  <p className="text-sm font-medium text-slate-300">Merge Studio couldn't open this.</p>
                  <p className="max-w-[320px] text-xs text-slate-500">{error?.message || 'Something went wrong.'}</p>
                  <button
                    type="button"
                    onClick={() => {
                      reset()
                      exitMergeStudio()
                    }}
                    className="mt-1 inline-flex h-8 items-center rounded-full bg-white/[0.08] px-3 text-xs font-medium text-slate-200 transition-colors hover:bg-white/[0.14]"
                  >
                    Back to Workspace
                  </button>
                </div>
              )}
            >
              <MergeStudioView />
            </ErrorBoundary>
          )}
        </WorkspaceSplitLayout>

        <TopBar project={project} onOpenPalette={() => setPaletteOpen(true)} />
        {!inMergeStudio && <FollowMeBanner />}
        {!inMergeStudio && <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />}
      </div>
      {/* The floating panel's own mb-2 leaves a sliver of full-size canvas
          visible below it — paint that sliver the same color as the
          activity rail it's flush against, instead of the canvas's dot grid. */}
      {inMergeStudio && <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-[551] h-3 bg-[#050506]" />}
      {!inMergeStudio && <WorkspaceBottomPanel />}
    </div>
    </WorkspaceBottomPanelPortalContext.Provider>
  )
}

export default WorkspacePage
