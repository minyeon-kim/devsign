import { cn } from 'cn'
import { LocalizedText } from '@/i18n/runtime'

// A value change's values, said once — the one place in the detail they're written out: a row per
// property, a column for what's built (현재), the design's (원안), and — 다른 값 with a value — what was
// typed in (입력값). Each cell the value (13px) over its token or note (12px, faint); a colour with its
// swatch. The column of the way picked has a green dot at its head.
//
//   fields: conflict.comparisonFields — [{ label, current, expected }]
//   own: 다른 값's value, said ('2.25', '#4f46e5'), or null; picked: 'current' | 'original' | 'other' | null

const HEX = /#[0-9a-f]{3}(?:[0-9a-f]{3})?\b/i
// '44px (button.height.lg)' → { value: '44px', note: 'button.height.lg' }
export function splitValue(text) {
  const raw = String(text ?? '').trim()
  const match = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(raw)
  return match ? { value: match[1], note: match[2] } : { value: raw, note: null }
}
// The colour a cell shows as a swatch: a hex in its value or note — else, for a colour field, the side's own.
export function swatchOf(label, text, fallback = null) {
  const hex = HEX.exec(String(text ?? ''))?.[0]
  if (hex) return hex
  return /colou?r|background|fill/i.test(label ?? '') ? fallback : null
}

function Cell({ label, text, fallback }) {
  const { value, note } = splitValue(text)
  const swatch = swatchOf(label, text, fallback)
  return (
    <td className="py-2 pr-3 align-top">
      <span className="flex items-center gap-1.5 text-[13px] leading-5 text-slate-100 tabular-nums">
        {swatch && <span aria-hidden data-swatch={swatch} className="size-3 shrink-0 rounded-[3px] ring-1 ring-white/15 ring-inset" style={{ background: swatch }} />}
        <span translate="no" className="min-w-0 truncate">{HEX.test(value) ? value.toUpperCase() : value}</span>
      </span>
      {note && <span className="block truncate text-[12px] leading-4 text-slate-500"><LocalizedText text={note} /></span>}
    </td>
  )
}

export default function ValueTable({ fields, conflict, own = null, picked = null }) {
  if (!fields?.length) return null
  const columns = [['current', '현재'], ['original', '원안'], ...(own ? [['other', '입력값']] : [])]
  const before = conflict?.preview?.before ?? {}
  const after = conflict?.preview?.after ?? {}
  return (
    <table data-value-table className="w-full table-fixed border-collapse text-left">
      <thead>
        <tr className="border-b border-white/[0.06] text-[12px] text-slate-500">
          <th scope="col" className="w-[28%] py-1.5 pr-3 font-normal">속성</th>
          {columns.map(([id, title]) => (
            <th key={id} scope="col" data-value-column={id} aria-current={picked === id ? 'true' : undefined} className={cn('py-1.5 pr-3 font-normal', picked === id && 'text-slate-200')}>
              <span className="inline-flex items-center gap-1.5">
                {title}
                {picked === id && <span aria-label="선택됨" data-picked-dot className="size-1.5 rounded-full bg-[var(--ds-accent)]" />}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {fields.map((field) => (
          <tr key={field.label} data-value-row={field.label} className="border-b border-white/[0.04] last:border-0">
            <th scope="row" className="py-2 pr-3 align-top text-[13px] leading-5 font-normal text-slate-400"><LocalizedText text={field.label} /></th>
            <Cell label={field.label} text={field.current} fallback={before.background} />
            <Cell label={field.label} text={field.expected} fallback={after.background} />
            {/* (Several properties: the value typed is the one its kind is — a colour on the colour row, a size on the others.) */}
            {own && (fields.length === 1 || HEX.test(own) === /colou?r|background|fill/i.test(field.label)
              ? <Cell label={field.label} text={own} fallback={HEX.exec(own)?.[0] ?? null} />
              : <td className="py-2 pr-3 align-top text-[13px] leading-5 text-slate-600">—</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
