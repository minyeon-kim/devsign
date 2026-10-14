import BoardConflicts from '@/components/screens/BoardConflicts'
import { conflictsByScreen } from '@/lib/screenConflicts'
import { reviewForDesign } from '@/lib/designReview'
import { useMainWindowInset } from '@/lib/useMainWindowInset'
import { useWorkspace } from '@/state/WorkspaceProvider'

// The same change-review list used by Screens, available from every workspace tab.
export default function WorkspaceChanges() {
  const { activeView, workspaceView, prototype, conflicts, boardConflicts, setBoardConflicts, activePageId, mergeItems, openCompareView, selectConflictPin, aiChat } = useWorkspace()
  // (Within the canvas's width, not the page's: it moves with AI Chat.)
  const [ref, inset] = useMainWindowInset([boardConflicts.open, aiChat.open, workspaceView, activeView])
  if (!boardConflicts.open || (activeView !== 'mergeStudio' && workspaceView === 'screens')) return null
  const changes = conflictsByScreen(prototype, conflicts)
  const groups = prototype.screens.filter((screen) => changes.byScreen.has(screen.id)).map((screen, index) => ({ id: screen.id, n: index + 1, name: screen.name, conflicts: changes.byScreen.get(screen.id) }))
  if (changes.unplaced.length) groups.push({ id: null, n: null, name: 'Not on a screen', conflicts: changes.unplaced })
  const picked = conflicts.find((conflict) => conflict.id === boardConflicts.conflictId) ?? null
  return <div ref={ref} style={{ right: inset }} className="pointer-events-none absolute left-0 top-[calc(var(--ds-chrome-size)+40px)] bottom-0 z-30 overflow-hidden [&>section]:pointer-events-auto">
    <BoardConflicts groups={groups} total={changes.total} picked={picked} currentScreenId={activePageId}
    compareItem={picked ? mergeItems.find((item) => reviewForDesign(item, conflicts)?.id === picked.id) : null}
    onOpenCompare={(item) => openCompareView(item.id)}
    onPick={(conflict) => { setBoardConflicts({ conflictId: conflict.id }); selectConflictPin(conflict.id, conflict.layerId ?? null) }}
    onBack={() => setBoardConflicts({ conflictId: null })}
    onClose={() => setBoardConflicts({ open: false, conflictId: null })} />
  </div>
}
