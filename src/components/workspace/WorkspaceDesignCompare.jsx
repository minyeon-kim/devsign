import { useState } from 'react'
import { DesignComparePanel, designCompareOptions } from '@/components/mergestudio/DesignComparison'
import { useWorkspace } from '@/state/WorkspaceProvider'

const PICKED = new Map()

export default function WorkspaceDesignCompare() {
  const { mergeItems, setSelectedMergeItemId, setDesignCompareRequest, openMergeStudio, bottomPanel, setBottomPanel, activePageId } = useWorkspace()
  const items = mergeItems.filter(item => item.hasDesign)
  // What's compared follows the screen in view: picking a screen that has design sets shows them (the
  // first, until one is picked for that screen); a screen with none leaves the comparison where it is.
  const [followed, setFollowed] = useState(activePageId)
  const ofScreen = items.filter(item => item.designPageId === activePageId)
  if (followed !== activePageId) {
    setFollowed(activePageId)
    if (ofScreen.length && !ofScreen.some(item => item.id === bottomPanel.designCompareItemId)) setBottomPanel({ designCompareItemId: ofScreen[0].id })
  }
  const item = items.find(item => item.id === bottomPanel.designCompareItemId) ?? ofScreen[0] ?? items.find(item => item.id === 'merge-checkout-payment-drafts') ?? items[0]
  // (Which drafts are picked is kept for the session, per item: leaving Design Compare and coming back carries on.)
  const [, redraw] = useState(0)
  const keys = PICKED.get(item?.id) ?? null
  const setKeys = (next) => { if (item) PICKED.set(item.id, next); redraw((n) => n + 1) }
  const selectedKeys = keys ?? (item ? designCompareOptions(item).map(option => option.key) : [])
  return <DesignComparePanel items={items} itemId={item?.id} selectedKeys={selectedKeys}
    onSelectItem={id => setBottomPanel({ designCompareItemId: id })}
    onToggleVariant={key => setKeys(selectedKeys.includes(key) ? selectedKeys.filter(value => value !== key) : [...selectedKeys, key])}
    onSelectAll={setKeys}
    onCompare={(candidate, options) => {
      setSelectedMergeItemId(candidate.id)
      setDesignCompareRequest({ itemId: candidate.id, keys: options.map(option => option.key) })
      openMergeStudio()
    }} />
}
