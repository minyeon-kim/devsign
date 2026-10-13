import ConflictReviewOverlay from '@/components/conflicts/ConflictReviewOverlay'
import DocsOverlay from '@/components/docs/DocsOverlay'
import { readChangeParams, sourceKeyOf } from '@/lib/changeLink'
import { checkpointRationale } from '@/lib/rationale'
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
    historyEntries,
    comments,
  } = useWorkspace()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [workspaceRoot, setWorkspaceRoot] = useState(null)

  // Arriving with an intent.
  // In the address (lib/changeLink) — kept, so a reload or a shared link opens the same thing:
  //  · `?change=<id>` — that change's detail, full screen (the provider shows
  //    it); arriving by a link, its place in the left list, its element and file too;
  //  · `?changes=<filter>` (a project card's badge) — the change list on that filter.
  // In router state — used once, then dropped:
  //  · `openMergeStudio` (a Conflict Point's "Open in Merge Studio") — Merge
  //    Studio on that conflict's item, its element (or line) focused, and
  //    the conflict's review kept open in the bottom panel (`conflictId`);
  //    with no linked item nothing is pre-selected (never an unrelated
  //    default).
  // Handled once per navigation (location.key).
  const handledNav = useRef(null)
  useEffect(() => {
    const state = location.state
    if (!state?.openMergeStudio || handledNav.current === location.key) return
    handledNav.current = location.key
    // Consume it, so a later remount (e.g. back from History) doesn't
    // replay it; Back still returns to where the link was clicked.
    navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null })
    if (state.openMergeStudio) {
      const item = state.mergeItemId && mergeItems.find((i) => i.id === state.mergeItemId)
      setSelectedMergeItemId(item ? item.id : null)
      openMergeStudio()
      if (state.conflictId) {
        // `collapsePanel` (arriving to fix a check): the review stays
        // selected but folded, so the canvas it points at is in view.
        setBottomPanel({ open: !state.collapsePanel, tab: 'conflict' })
        // (In Merge Studio: the bottom panel's own detail — the one exception to full screen.)
        openConflictReview(state.conflictId, { view: 'panel' })
      }
      if (item) {
        requestMergeFocus({
          itemId: item.id,
          ...(state.layerId ? { layerId: state.layerId } : { fileId: state.fileId, line: state.line }),
          openDeck: true,
          // From a conflict: both artboards in view, the element marked.
          overview: true,
        })
      }
      return
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

  // `?changes=<filter>`: the change list, on that filter — each time the address names one.
  const { change: changeId, evidence: evidenceId, source: sourceKey, changes: listFilter } = readChangeParams(location.search)
  // (Applied when the address first names it or names another — not again each time
  // something else about the address changes. With a change open full screen, only
  // the filter is set: the list that's shown beside a detail is the left one.)
  const appliedFilter = useRef(null)
  useEffect(() => {
    if (!listFilter) { appliedFilter.current = null; return }
    if (appliedFilter.current === listFilter) return
    appliedFilter.current = listFilter
    if (changeId) { setBottomPanel({ conflictFilter: listFilter }); return }
    exitMergeStudio()
    setBottomPanel({ open: true, tab: 'conflict', conflictFilter: listFilter })
  }, [listFilter, changeId, exitMergeStudio, setBottomPanel])

  // `?change=<id>` reached by a link (another page, a reload, a shared address —
  // not opened here a moment ago): its element and file are selected too (the
  // left list and the Workspace's own view come with any change that's open —
  // the provider's). With a History source
  // (`&evidence=<checkpoint>`), that source is found again and brought up.
  const handledChange = useRef(null)
  useEffect(() => {
    if (!changeId || handledChange.current === `${location.key}:${changeId}`) return
    const conflict = conflicts.find((c) => c.id === changeId)
    if (!conflict) return
    handledChange.current = `${location.key}:${changeId}`
    if (location.state?.changePushed) return
    focusChange(conflict)
    if (evidenceId) {
      const entry = historyEntries.find((candidate) => candidate.id === evidenceId)
      const item = entry ? checkpointRationale(entry, [conflict], comments).evidence.find((candidate) => sourceKeyOf(candidate) === sourceKey) ?? null : null
      setBottomPanel({ evidence: item ? { ...item, conflictId: conflict.id } : null })
    }
  }, [changeId, evidenceId, sourceKey, location.key, location.state, conflicts, historyEntries, comments, focusChange, setBottomPanel])

  const inMergeStudio = activeView === 'mergeStudio'

  return (
    // One persistent dock owns the AI and navigator panels in both modes.
    // Merge Studio replaces only its canvas pane and owns its bottom panel.
    <WorkspaceBottomPanelPortalContext.Provider value={workspaceRoot}>
    <div ref={setWorkspaceRoot} className="ds-workspace relative flex h-full flex-col overflow-hidden bg-background text-foreground">
      <div className="@container relative min-h-0 flex-1 overflow-hidden">
        <WorkspaceSplitLayout mergeStudio={inMergeStudio}>
          {inMergeStudio && (
            <ErrorBoundary
              key={location.key}
              fallback={(error, reset) => (
                <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-2 bg-background p-6 text-center text-slate-400">
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

        <TopBar project={project} />
        {!inMergeStudio && <FollowMeBanner />}
        {!inMergeStudio && <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />}
      </div>
      {!inMergeStudio && <WorkspaceBottomPanel />}
      {/* A conflict's detail, full-screen over all of the above. */}
      <ConflictReviewOverlay inMergeStudio={inMergeStudio} />
      {/* (Docs: the same kind of layer, at ?doc / ?docs.) */}
      <DocsOverlay />
    </div>
    </WorkspaceBottomPanelPortalContext.Provider>
  )
}

export default WorkspacePage
