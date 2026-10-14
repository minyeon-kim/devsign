import { useEffect, useRef, useState } from 'react'
import { DesignComparePanel, designCompareOptions } from '@/components/mergestudio/DesignComparison'
import { reviewForDesign } from '@/lib/designReview'
import { useWorkspace } from '@/state/WorkspaceProvider'

const PICKED = new Map()

// The comparison of the design set picked in the Design Compare drawer (CompareDrawer), shown in the work
// area where the canvas is: the set's drafts side by side, and "← canvas" to go back to it. The sets are the
// drawer's list, not a column here. The pick is the change list's too — a design set's change picked there
// (its pin, its row) is the set shown here, with the comparison open.
export default function WorkspaceDesignCompare() {
  const { mergeItems, conflicts, compareItemId, setCompareItemId, closeCompareView, conflictPin, boardConflicts, setSelectedMergeItemId, setDesignCompareRequest, openMergeStudio } = useWorkspace()
  const items = mergeItems.filter(item => item.hasDesign)
  const item = items.find(candidate => candidate.id === compareItemId) ?? null

  // The change lists' pick moves the comparison (when it is another design set's change): the change pins' and
  // the drawer's (`conflictPin`), the board's list at the right (`boardConflicts`).
  const follow = (pickedId) => {
    const linked = pickedId ? items.find(candidate => reviewForDesign(candidate, conflicts)?.id === pickedId) : null
    if (linked && linked.id !== compareItemId) setCompareItemId(linked.id)
  }
  const pinPick = conflictPin.selected?.conflictId ?? null
  const boardPick = boardConflicts.conflictId ?? null
  const seen = useRef({ pin: pinPick, board: boardPick })
  useEffect(() => {
    if (seen.current.pin !== pinPick) { seen.current.pin = pinPick; follow(pinPick) }
    if (seen.current.board !== boardPick) { seen.current.board = boardPick; follow(boardPick) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinPick, boardPick])

  // (Which drafts are picked is kept for the session, per item: leaving Design Compare and coming back carries on.)
  const [, redraw] = useState(0)
  const keys = PICKED.get(item?.id) ?? null
  const setKeys = (next) => { if (item) PICKED.set(item.id, next); redraw((n) => n + 1) }
  const selectedKeys = keys ?? (item ? designCompareOptions(item).map(option => option.key) : [])
  return <DesignComparePanel items={items} itemId={item?.id} selectedKeys={selectedKeys}
    hideSets
    onBack={() => closeCompareView({ focus: true })}
    onSelectItem={id => setCompareItemId(id)}
    onToggleVariant={key => setKeys(selectedKeys.includes(key) ? selectedKeys.filter(value => value !== key) : [...selectedKeys, key])}
    onSelectAll={setKeys}
    onCompare={(candidate, options) => {
      setCompareItemId(null)
      setSelectedMergeItemId(candidate.id)
      setDesignCompareRequest({ itemId: candidate.id, keys: options.map(option => option.key) })
      openMergeStudio()
    }} />
}
