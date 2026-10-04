import { useState } from 'react'
import { DesignComparePanel, designCompareOptions } from '@/components/mergestudio/DesignComparison'
import { useWorkspace } from '@/state/WorkspaceProvider'

export default function WorkspaceDesignCompare() {
  const { mergeItems, setSelectedMergeItemId, setDesignCompareRequest, openMergeStudio } = useWorkspace()
  const items = mergeItems.filter(item => item.hasDesign)
  const [selectedId, setSelectedId] = useState(null)
  const item = items.find(item => item.id === selectedId) ?? items.find(item => item.id === 'merge-checkout-payment-drafts') ?? items[0]
  const [keys, setKeys] = useState(null)
  const selectedKeys = keys ?? (item ? designCompareOptions(item).map(option => option.key) : [])
  return <DesignComparePanel items={items} itemId={item?.id} selectedKeys={selectedKeys}
    onSelectItem={id => { setSelectedId(id); setKeys(null) }}
    onToggleVariant={key => setKeys(selectedKeys.includes(key) ? selectedKeys.filter(value => value !== key) : [...selectedKeys, key])}
    onSelectAll={setKeys}
    onCompare={(candidate, options) => {
      setSelectedMergeItemId(candidate.id)
      setDesignCompareRequest({ itemId: candidate.id, keys: options.map(option => option.key) })
      openMergeStudio()
    }} />
}
