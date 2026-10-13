import { useState } from 'react'
import { DesignComparePanel, designCompareOptions } from '@/components/mergestudio/DesignComparison'
import { useWorkspace } from '@/state/WorkspaceProvider'

const PICKED = new Map()

export default function WorkspaceDesignCompare() {
  const { mergeItems, setSelectedMergeItemId, setDesignCompareRequest, openMergeStudio, bottomPanel, setBottomPanel } = useWorkspace()
  const items = mergeItems.filter(item => item.hasDesign)
  const item = items.find(item => item.id === bottomPanel.designCompareItemId) ?? items.find(item => item.id === 'merge-checkout-payment-drafts') ?? items[0]
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
