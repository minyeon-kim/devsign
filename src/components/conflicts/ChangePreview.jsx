import { Truck } from 'lucide-react'
import { cn } from 'cn'

// Before / after of the element a Conflict Point changes, drawn from the
// record's `preview` spec (the same values as its comparison table) — so a
// designer can see the difference without reading code. Both sides are
// drawn at the same scale, so a real size difference stays visible.
// Records without a `preview` simply don't render one.

function Frame({ label, tone, children }) {
  return (
    <figure className="min-w-0 flex-1">
      <figcaption className={cn('mb-1.5 text-[11px] font-medium', tone === 'after' ? 'text-emerald-300' : 'text-slate-400')}>
        {label}
      </figcaption>
      <div className="flex h-28 items-center justify-center rounded-xl bg-white px-4">{children}</div>
    </figure>
  )
}

function ButtonSample({ height, background, label }) {
  return (
    <div className="flex w-full flex-col items-center gap-1.5">
      <span
        className="flex w-full max-w-[220px] items-center justify-center rounded-lg text-[13px] font-semibold text-white"
        style={{ height, background }}
      >
        {label}
      </span>
      <span className="text-[10px] text-slate-500 tabular-nums">{height}px</span>
    </div>
  )
}

function Pair({ before, after }) {
  return (
    <div className="flex gap-3">
      <Frame label="Before">{before}</Frame>
      <Frame label="After" tone="after">
        {after}
      </Frame>
    </div>
  )
}

function ChangePreview({ preview }) {
  if (!preview) return null
  const { kind, before, after } = preview

  if (kind === 'button') {
    return (
      <Pair
        before={<ButtonSample {...before} label={preview.label} />}
        after={<ButtonSample {...after} label={preview.label} />}
      />
    )
  }

  if (kind === 'divider') {
    // Per theme: the fixed color stays put, the token follows the theme.
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-[88px_1fr_1fr] gap-3 text-[11px] font-medium">
          <span />
          <span className="text-slate-400">Before</span>
          <span className="text-emerald-300">After</span>
        </div>
        {preview.themes.map((t) => (
          <div key={t.label} className="grid grid-cols-[88px_1fr_1fr] items-center gap-3">
            <span className="text-[11px] text-slate-400">{t.label}</span>
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
        {preview.label}
      </span>
    )
    return <Pair before={sample(before)} after={sample(after)} />
  }

  if (kind === 'icon') {
    const sample = (s) => (
      <span className="flex flex-col items-center gap-1.5">
        <Truck className="text-slate-700" style={{ width: s.size, height: s.size }} strokeWidth={s.stroke} />
        <span className="text-[10px] text-slate-500 tabular-nums">
          {s.size}px · stroke {s.stroke}
        </span>
      </span>
    )
    return <Pair before={sample(before)} after={sample(after)} />
  }

  if (kind === 'card') {
    const sample = (s) => (
      <span className="flex flex-col items-center gap-1.5">
        <span className="block h-14 w-28 border border-slate-200 bg-slate-50" style={{ borderRadius: s.radius }} />
        <span className="text-[10px] text-slate-500 tabular-nums">radius {s.radius}px</span>
      </span>
    )
    return <Pair before={sample(before)} after={sample(after)} />
  }

  if (kind === 'swatch') {
    const sample = (s) => (
      <span className="flex flex-col items-center gap-1.5">
        <span className="block size-12 rounded-lg" style={{ background: s.color }} />
        <span className="font-mono text-[10px] text-slate-500">{s.color}</span>
      </span>
    )
    return <Pair before={sample(before)} after={sample(after)} />
  }

  return null
}

export default ChangePreview
