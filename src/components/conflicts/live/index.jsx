import ShippingOptionRow from '@/components/conflicts/live/ShippingOptionRow'

// The real component a change is about, drawn with a way's values — what the comparison viewer
// renders once per way (never a screenshot, never the element cut out of the screen). Null for a
// change with no component of its own here: the viewer draws its picture instead.
//   → (values) => element
export function liveComponentOf(conflict) {
  const shipping = conflict?.fileId === 'shipping' || (conflict?.components ?? []).includes('ShippingOptions')
  if (shipping && conflict?.preview?.kind === 'icon') return (values) => <ShippingOptionRow iconStrokeWidth={values?.stroke ?? 2} />
  return null
}
