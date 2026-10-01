import { Truck } from 'lucide-react'
import { LocalizedText } from '@/i18n/runtime'

// Before / after of the element a Conflict Point changes, drawn from the
// record's `preview` spec (the same values as its comparison table) — so a
// designer can see the difference without reading code. Both sides are
// drawn at the same scale, so a real size difference stays visible.
// Records without a `preview` simply don't render one.

function Frame({ label, children }) {
  return (
    <figure aria-label={label} className="flex min-w-0 flex-col items-center">
      <figcaption className="mb-0.5 text-[10px] font-medium text-slate-500"><LocalizedText text={label} /></figcaption>
      <div className="flex h-14 w-full shrink-0 items-center justify-center">{children}</div>
    </figure>
  )
}

function ButtonSample({ height, background, label }) {
  return (
    <div className="flex w-full items-center justify-center">
      <span
        className="flex w-full max-w-[220px] items-center justify-center rounded-lg text-[13px] font-semibold text-white"
        style={{ height, background }}
      >
        <LocalizedText text={label} />
      </span>
    </div>
  )
}

function Pair({ before, after, side }) {
  if (side) {
    return <Frame label={side === 'before' ? 'Before' : 'After'}>{side === 'before' ? before : after}</Frame>
  }
  return (
    <div className="grid grid-cols-2 items-stretch gap-3">
      <Frame label="Before">{before}</Frame>
      <Frame label="After">
        {after}
      </Frame>
    </div>
  )
}

function ChangePreview({ preview, side }) {
  if (!preview) return null
  const { kind, before, after } = preview

  if (kind === 'button') {
    return (
      <Pair
        side={side}
        before={<ButtonSample {...before} label={preview.label} />}
        after={<ButtonSample {...after} label={preview.label} />}
      />
    )
  }

  if (kind === 'divider') {
    // Per theme: the fixed color stays put, the token follows the theme.
    return (
      <div className="space-y-2">
        {preview.themes.map((t) => (
          <div key={t.label} className="grid grid-cols-[88px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3">
            <span className="text-[11px] text-slate-400"><LocalizedText text={t.label} /></span>
            {[t.before, t.after].map((color, i) => (
              <div key={i} className="rounded-lg px-4 py-4" style={{ background: t.surface }}>
                <div className="h-px w-full" style={{ background: color }} />
                <p className="mt-1.5 font-mono text-[10px]" style={{ color: t.surface === '#ffffff' ? '#64748b' : '#a1a1aa' }}>
                  {color}
                </p>
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (kind === 'text') {
    const sample = (s) => (
      <span className="text-sm font-medium text-slate-700" style={{ letterSpacing: s.letterSpacing }}>
        <LocalizedText text={preview.label} />
      </span>
    )
    return <Pair side={side} before={sample(before)} after={sample(after)} />
  }

  if (kind === 'icon') {
    const sample = (s) => (
      <span className="flex items-center justify-center">
        <Truck className="text-slate-700" style={{ width: s.size, height: s.size }} strokeWidth={s.stroke} />
      </span>
    )
    return <Pair side={side} before={sample(before)} after={sample(after)} />
  }

  if (kind === 'card') {
    const { title = 'Card.jsx', detail = 'bg-card · p-4' } = preview.content ?? {}
    const sample = (s) => (
      <div
        className="flex h-24 w-full max-w-56 items-center gap-3 border border-white/15 bg-[#17171B] p-3 shadow-[0_4px_14px_rgba(0,0,0,0.28)]"
        style={{ borderRadius: s.radius }}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15 text-[10px] font-semibold text-emerald-300">DS</span>
        <span className="min-w-0 flex-1 space-y-1.5">
          <span className="block truncate text-left text-[9px] leading-none font-medium tracking-wide text-slate-500">DESIGN SYSTEM V2</span>
          <span className="block truncate text-left text-[12px] leading-none font-medium text-slate-100"><LocalizedText text={title} /></span>
          <span className="block truncate text-left font-mono text-[9px] leading-none text-slate-400">{detail}</span>
        </span>
      </div>
    )
    return <Pair side={side} before={sample(before)} after={sample(after)} />
  }

  if (kind === 'swatch') {
    const sample = (s) => (
      <span className="flex items-center justify-center">
        <span className="block size-12 rounded-lg" style={{ background: s.color }} />
      </span>
    )
    return <Pair side={side} before={sample(before)} after={sample(after)} />
  }

  return null
}

export default ChangePreview
