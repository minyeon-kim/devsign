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
    // A single full-bleed surface: the split-pane frame (Code Editor |
    // Canvas, see WorkspaceSplitLayout) or Merge Studio fills the view and
    // every other piece of chrome —
    // top bar, follow-me banner, inspector, chat — is an absolutely
    // positioned overlay on top of it, instead of a flex row/column that carves the viewport into fixed
    // bands. Nothing here pushes the canvas around anymore.
    // `@container` lets floating chrome (e.g. the TopBar search) size itself
    // against this view's width, which shrinks when the sidebar drawer opens.
    //
    // Below it, outside that overlay area, sits the docked bottom panel
    // (Terminal / Console / Conflict Points), so it never floats over the
    // canvas and the bottom-row chrome (save status, zoom) sits just above it.
    <div className="ds-workspace flex h-full flex-col overflow-hidden bg-[#070708] text-foreground">
      <div className="@container relative min-h-0 flex-1 overflow-hidden">
        {inMergeStudio ? (
          // MergeStudioView/MergeStudioWorkspace size themselves with
          // flex-1 + min-h-0, expecting a flex-column ancestor with a
          // definite height to cascade from (the old layout nested it
          // several flex levels deep under h-screen) — this root is
          // `relative`, not `flex`, so it needs its own properly-sized flex
          // wrapper here instead of relying on the root itself.
          <div className="absolute inset-0 flex flex-col">
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
          </div>
        ) : (
          <WorkspaceSplitLayout />
        )}

        <TopBar project={project} onOpenPalette={() => setPaletteOpen(true)} />
        {!inMergeStudio && <FollowMeBanner />}
        {!inMergeStudio && <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />}
      </div>
      {!inMergeStudio && <WorkspaceBottomPanel />}
    </div>
  )
}

export default WorkspacePage
