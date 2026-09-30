import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import TopBar from '@/components/layout/TopBar'
import InspectorSidebar from '@/components/layout/InspectorSidebar'
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
            <MergeStudioView />
          </div>
        ) : (
          <WorkspaceSplitLayout />
        )}

        <TopBar project={project} onOpenPalette={() => setPaletteOpen(true)} />
        {!inMergeStudio && <FollowMeBanner />}
        {!inMergeStudio && <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />}

        <InspectorSidebar />
      </div>
      {!inMergeStudio && <WorkspaceBottomPanel />}
    </div>
  )
}

export default WorkspacePage
