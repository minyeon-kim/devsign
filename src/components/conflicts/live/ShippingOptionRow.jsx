import { Truck } from 'lucide-react'

// Checkout's shipping option, one row — the component CON-013 is about (ShippingOptions), drawn as the
// product draws it: the radio, the Truck icon in its tile, the option's name and time, its price. Only the
// icon's stroke is a prop, so one row drawn with each way's value compares exactly that.
export default function ShippingOptionRow({ iconStrokeWidth = 2, selected = true }) {
  return (
    <div data-live-component="ShippingOptionRow" data-stroke={iconStrokeWidth} translate="no" className="flex w-[320px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm">
      <span aria-hidden className="flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-slate-900">
        {selected && <span className="size-2 rounded-full bg-slate-900" />}
      </span>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-800">
        <Truck className="size-4" strokeWidth={iconStrokeWidth} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[13px] leading-5 font-medium text-slate-900">Standard shipping</span>
        <span className="text-[11px] leading-4 text-slate-500">3–5 business days</span>
      </span>
      <span className="text-[13px] font-semibold text-slate-900">Free</span>
    </div>
  )
}
