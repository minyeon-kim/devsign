import ShippingOptionRow, { ShippingIcon } from '@/components/conflicts/live/ShippingOptionRow'

// The real component a change is about, drawn with a way's values — what the comparison viewer
// renders once per way (never a screenshot, never the element cut out of the screen):
//   focus(values): the element the change is about, alone — enlarged to compare;
//   context(values): the component it sits in, at its real size, the element marked;
//   quick: values to try in one press, for the way with a value of one's own.
// Null for a change with no component of its own here: the viewer draws its picture instead.
export function liveComponentOf(conflict) {
  const shipping = conflict?.fileId === 'shipping' || (conflict?.components ?? []).includes('ShippingOptions')
  if (shipping && conflict?.preview?.kind === 'icon') {
    return {
      focus: (values) => <ShippingIcon strokeWidth={values?.stroke ?? 2} />,
      context: (values) => <ShippingOptionRow iconStrokeWidth={values?.stroke ?? 2} markIcon className="w-full max-w-[320px]" />,
      quick: ['1.5', '1.75', '2.25'],
    }
  }
  return null
}
