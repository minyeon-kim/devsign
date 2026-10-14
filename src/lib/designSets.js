import { draftScreens } from '@/data/draftScreens'

// Only sets with complete design alternatives can be composed region by region.
// A design/code discrepancy has a different review flow.
export function designSetsOf(items) {
  return items.filter((item) => {
    const screen = draftScreens[item.id]
    return item.hasDesign && screen?.regions.length > 0 && item.variants?.length >= 2
      && item.variants.every((variant) => screen.regions.every((region) => Array.isArray(screen.drafts[variant.key]?.[region.id]?.layers)))
  })
}

export function designRegionsOf(item) {
  return draftScreens[item?.id]?.regions ?? []
}
