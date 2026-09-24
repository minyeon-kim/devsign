import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowRight,
  BetweenHorizontalStart,
  Blend,
  Blocks,
  Circle,
  Link2,
  Link2Off,
  Minus,
  MoveHorizontal,
  MoveVertical,
  Plus,
  RectangleHorizontal,
  Square,
  SquareRoundCorner,
  Check,
  ChevronDown,
  Library,
  Search,
  MousePointerClick,
  SlidersHorizontal,
  Pencil,
  Sparkles,
  Type,
  Wand2,
  X,
} from 'lucide-react'
import { cn } from 'cn'
import {
  blockDeckPresets,
  canvasPages,
  codeMergeVariants,
  designMergeVariants,
  designSystemComponents,
  designSystemMeta,
  inspectorSpecsByType,
} from '@/data/mockData'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import { buildDrifts } from '@/components/mergestudio/mergeSummary'
import { ASSEMBLY_FILLS, SHAPES, assemblyToOverride, blockTemplates, frameWithLayers, isCustomResolution, libraryCompat, recommendAssembly } from '@/components/mergestudio/mergeEffects'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  CATEGORY_TAB,
  CATEGORY_TAB_ACTIVE,
  CATEGORY_TAB_IDLE,
  FLOATING_PANEL,
  GHOST_BUTTON,
  PANEL_LABEL,
  PANEL_ROWS,
  PANEL_SURFACE,
} from '@/components/mergestudio/floatingStyles'
import { SeverityPill } from '@/components/mergestudio/ConflictTag'

// One variant property as a single compact row: `Label  [Original → Current]`
// where clicking either side chooses it (hover previews it on the
// artboard), plus an on-demand pencil for typing a custom value — shown
// inline only while editing, and as a slim chip once set. Callers key it by
// its resolution so the draft resets whenever the choice changes.
function DiffRow({ diff, resolution, onResolve, onHover }) {
  const custom = isCustomResolution(resolution) ? resolution.custom : null
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(custom ?? '')
  const cancelRef = useRef(false)
  const inputRef = useRef(null)

  function commit() {
    setEditing(false)
    if (cancelRef.current) {
      cancelRef.current = false
      setDraft(custom ?? '')
      return
    }
    const value = draft.trim()
    if (!value) {
      if (custom != null) onResolve(diff.id, null)
    } else if (value === diff.optionA) onResolve(diff.id, 'A')
    else if (value === diff.optionB) onResolve(diff.id, 'B')
    else if (value !== custom) onResolve(diff.id, { custom: value })
  }

  const option = (side, value, title) => (
    <button
      type="button"
      title={title}
      onClick={() => onResolve(diff.id, side)}
      onPointerEnter={() => onHover(diff.id, side)}
      onPointerLeave={() => onHover(null)}
      className={cn(
        'flex h-6 min-w-0 flex-1 items-center justify-center gap-1 rounded-full px-1.5 text-[11px] font-medium whitespace-nowrap transition-[background-color,color,box-shadow]',
        // Achromatic only: every value pill shares one quiet neutral
        // surface, and the chosen side is simply lifted — a brighter neutral
        // fill, a hairline ring and white text. No hue, no light/dark
        // inversion, no swatch dots (the value is named in the pill, and
        // hovering previews it on the canvas).
        resolution === side
          ? 'bg-white/[0.14] font-semibold text-white ring-1 ring-inset ring-white/25'
          : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200'
      )}
    >
      <span className="truncate">{value}</span>
    </button>
  )

  return (
    <div className="py-1">
      <div className="flex items-center gap-1.5">
        <span className="w-[74px] shrink-0 truncate text-[11px] text-muted-foreground" title={diff.label}>
          {diff.label}
        </span>
        <div className={cn('flex min-w-0 flex-1 items-center gap-1', custom != null && 'opacity-60')}>
          {option('A', diff.optionA, 'Keep Original Design')}
          <ArrowRight className="size-2.5 shrink-0 text-muted-foreground/60" />
          {option('B', diff.optionB, 'Take Current Implementation')}
        </div>
        <button
          type="button"
          title={custom != null ? 'Edit custom value' : 'Set a custom value'}
          // While editing, the pencil closes the input without saving (and
          // keeps focus until then so blur doesn't commit first).
          onPointerDown={(e) => editing && e.preventDefault()}
          onClick={() => {
            if (editing) {
              cancelRef.current = true
              inputRef.current?.blur()
            } else {
              setDraft(custom ?? '')
              setEditing(true)
            }
          }}
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded-full transition-colors',
            editing || custom != null ? 'bg-white/[0.12] text-white' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
          )}
        >
          <Pencil className="size-3" />
        </button>
      </div>

      {editing ? (
        <input
          ref={inputRef}
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            else if (e.key === 'Escape') {
              cancelRef.current = true
              e.currentTarget.blur()
            }
          }}
          placeholder={`Custom ${diff.label.toLowerCase()}, e.g. ${diff.optionB}`}
          className="mt-1.5 ml-[80px] h-7 w-[calc(100%-80px)] rounded-full bg-white/[0.05] px-3 text-[11px] text-foreground outline-none ring-1 ring-white/25 placeholder:text-muted-foreground"
        />
      ) : (
        custom != null && (
          // A custom value is the active choice: the same lifted neutral.
          <div className="mt-1.5 ml-[80px] flex h-6 items-center gap-1.5 rounded-full bg-white/[0.14] pr-1 pl-2.5 text-[11px] text-white ring-1 ring-inset ring-white/25">
            <span className="shrink-0 text-[11px] font-medium text-slate-400">Custom</span>
            <span className="min-w-0 flex-1 truncate font-medium">{custom}</span>
            <button
              type="button"
              title="Clear custom value"
              onClick={() => onResolve(diff.id, null)}
              className="flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </div>
        )
      )}
    </div>
  )
}

// ---- Figma-style precision inspector ---------------------------------
// Compact sections of exact controls: numeric fields with units (type,
// ↑/↓ to nudge, Shift for ×10, or drag the field's label to scrub), color
// fields that take HEX / rgb() / oklch() or a design-token name beside a
// native swatch picker, and auto-layout direction / gap / padding / 3×3
// alignment. Every change writes the layer's assembly and previews live.

// Per-type defaults shown as each field's placeholder, so an untouched
// property still reads as its real rendered value.
const TYPE_DEFAULTS = {
  button: { radius: 8, gap: 6, align: 'center', valign: 'center', direction: 'row', fill: 'indigo-500' },
  chip: { radius: 999, gap: 4, align: 'center', valign: 'center', direction: 'row', fill: 'indigo-500' },
  input: { radius: 8, gap: 8, padX: 12, align: 'start', valign: 'center', direction: 'row', fill: '#ffffff' },
  card: { radius: 12, gap: 4, padX: 10, padY: 10, align: 'start', valign: 'start', direction: 'column', fill: '#ffffff' },
  iconbtn: { radius: 999, align: 'center', valign: 'center', direction: 'row', fill: '#ffffff' },
  avatar: { radius: 999 },
  toggle: { radius: 999, fill: 'indigo-500' },
  image: { radius: 8 },
  chart: { radius: 12, fill: '#ffffff' },
  table: { radius: 12, fill: '#ffffff' },
  text: { radius: 2 },
}
const AUTO_LAYOUT_TYPES = new Set(['button', 'chip', 'input', 'card', 'iconbtn'])

// Figma-style inspector specs — one set for every control in Assemble:
// 28px tall, 6px corners, 8px side padding; a fixed 16px label slot, 12px
// values, 11px labels / units. Numeric rows share one grid: two equal
// columns + a fixed 28px action column (lock ratio, etc.), so fields line
// up vertically from section to section even when a row has no action.
const CONTROL = 'h-7 rounded-[6px] bg-white/[0.05] transition-shadow focus-within:bg-white/[0.08] focus-within:ring-1 focus-within:ring-white/30'
const ROW = 'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_28px] items-center gap-2'
const SPAN2 = 'col-span-2'
const CAPTION = 'text-[11px] text-slate-500'

// The deck's scrolling body (each tab's content). Content keeps the same
// 20px inset on the left and right whether or not it scrolls: the
// scrollbar's actual width (0 for overlay scrollbars, ~11px for classic
// ones — measured, not assumed) is given back to the content, so the
// scrollbar sits inside the right padding instead of pushing the layout
// in. Thin, low-contrast scrollbar.
function DeckScroll({ innerClassName, children }) {
  const ref = useRef(null)
  const [scrollbar, setScrollbar] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setScrollbar(el.offsetWidth - el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    return () => ro.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      // The content reaches under the scrollbar by exactly its width (only
      // ever into the right padding), so pin the horizontal offset at 0 —
      // focusing a field near the edge must never shift the layout sideways.
      onScroll={(e) => {
        if (e.currentTarget.scrollLeft) e.currentTarget.scrollLeft = 0
      }}
      className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-color:rgba(255,255,255,0.14)_transparent] [scrollbar-width:thin]"
    >
      <div className={innerClassName} style={{ marginRight: -scrollbar }}>
        {children}
      </div>
    </div>
  )
}

function InspectorSection({ title, action, children }) {
  return (
    <div className="space-y-2 px-5 py-2.5">
      <div className="flex h-5 items-center justify-between">
        <p className="text-xs font-medium text-slate-200">{title}</p>
        {action}
      </div>
      {children}
    </div>
  )
}

// A pill numeric field: prefix label (drag it to scrub), value, unit.
function NumInput({ label, value, placeholder, unit = 'px', min = -9999, max = 9999, title, onChange }) {
  const [draft, setDraft] = useState(null)
  const clamp = (n) => Math.min(max, Math.max(min, Math.round(n)))
  const shown = draft ?? (value === undefined || value === null ? '' : String(Math.round(value)))
  const base = value ?? (Number.isFinite(Number(placeholder)) ? Number(placeholder) : 0)

  function scrub(e) {
    e.preventDefault()
    const startX = e.clientX
    const start = Number.isFinite(base) ? base : 0
    function move(m) {
      onChange(clamp(start + Math.round((m.clientX - startX) / 2) * (m.shiftKey ? 10 : 1)))
    }
    function up() {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <label title={title} className={cn('flex min-w-0 items-center gap-1.5 px-2', CONTROL)}>
      <span onPointerDown={scrub} className="flex w-4 shrink-0 cursor-ew-resize items-center justify-center text-[11px] font-medium text-slate-500 select-none">
        {label}
      </span>
      <input
        inputMode="numeric"
        value={shown}
        placeholder={placeholder === undefined ? 'Auto' : String(placeholder)}
        onFocus={(e) => {
          setDraft(shown)
          e.target.select()
        }}
        onChange={(e) => {
          setDraft(e.target.value)
          const n = parseFloat(e.target.value)
          if (Number.isFinite(n)) onChange(clamp(n))
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            const next = clamp((Number.isFinite(base) ? base : 0) + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1))
            setDraft(String(next))
            onChange(next)
          }
        }}
        className="w-full min-w-0 bg-transparent text-[12px] text-foreground tabular-nums outline-none placeholder:text-slate-600"
      />
      {unit && <span className="shrink-0 text-[11px] text-slate-500">{unit}</span>}
    </label>
  )
}

// Color text → assembly patch: a literal color becomes an exact fill; a
// token name (`violet-500`, `bg-rose-500`, `primary`, `surface`…) maps to a
// design-system fill. null for text that's neither (yet).
function parseColorInput(text) {
  const t = text.trim()
  if (!t) return {}
  if (/^[0-9a-f]{6}$/i.test(t)) return { hex: `#${t}` }
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(t) || /^(rgba?|hsla?|oklch)\(.+\)$/i.test(t)) return { hex: t }
  const key = t.toLowerCase().replace(/^(bg-|color\.|--)/, '')
  const bare = key.replace(/-\d{2,3}$/, '')
  const fill =
    ASSEMBLY_FILLS.find((f) => f.token === key || f.id === bare || f.label.toLowerCase() === bare) ??
    (bare === 'primary' ? ASSEMBLY_FILLS.find((f) => f.id === 'indigo') : null)
  return fill ? { token: fill } : null
}

// A color row: native swatch picker + a HEX/token text field.
function ColorField({ value, swatchHex, swatchClass, placeholder, onHex, onToken, onClear }) {
  const [draft, setDraft] = useState(null)
  const invalid = draft !== null && parseColorInput(draft) === null
  function apply(text) {
    const parsed = parseColorInput(text)
    if (!parsed) return
    if (parsed.hex) onHex(parsed.hex)
    else if (parsed.token) onToken(parsed.token)
    else onClear?.()
  }
  return (
    <div
      className={cn('flex min-w-0 items-center gap-1.5 px-2', CONTROL, invalid && 'ring-1 ring-destructive/60')}
    >
      {/* Swatch in the same 16px label slot as the numeric fields. */}
      <span className={cn('relative size-4 shrink-0 overflow-hidden rounded-[4px] ring-1 ring-white/20', swatchClass)} style={swatchClass ? undefined : { background: swatchHex }}>
        <input
          type="color"
          title="Pick a color"
          value={/^#[0-9a-f]{6}$/i.test(swatchHex ?? '') ? swatchHex : '#6366f1'}
          onChange={(e) => onHex(e.target.value)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </span>
      <input
        value={draft ?? value ?? ''}
        placeholder={placeholder}
        spellCheck={false}
        onFocus={(e) => {
          setDraft(value ?? '')
          e.target.select()
        }}
        onChange={(e) => {
          setDraft(e.target.value)
          apply(e.target.value)
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className="w-full min-w-0 bg-transparent font-mono text-[12px] text-foreground uppercase outline-none placeholder:font-sans placeholder:text-[12px] placeholder:normal-case placeholder:text-slate-600"
      />
    </div>
  )
}

// Figma-style segmented control: one 28px track, options as equal inner
// segments; the active one is a lifted neutral.
function Segmented({ options, value, onChange, className }) {
  return (
    <div className={cn('flex h-7 items-center gap-0.5 rounded-[6px] bg-white/[0.05] p-0.5', className)}>
      {options.map(({ id, label, icon: Icon, title }) => (
        <button
          key={id}
          type="button"
          title={title ?? label}
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={cn(
            'flex h-6 min-w-0 flex-1 items-center justify-center gap-1 rounded-[4px] px-1.5 text-[11px] font-medium whitespace-nowrap transition-colors',
            value === id ? 'bg-white/[0.12] text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
          )}
        >
          {Icon && <Icon className="size-3 shrink-0" />}
          {label && <span className="truncate">{label}</span>}
        </button>
      ))}
    </div>
  )
}

// Figma's 3×3 alignment box: sets horizontal + vertical alignment at once.
function AlignGrid({ h, v, onChange }) {
  const axes = ['start', 'center', 'end']
  return (
    <div className="grid h-[64px] w-full grid-cols-3 gap-0.5 rounded-[6px] bg-white/[0.05] p-1">
      {axes.map((vv) =>
        axes.map((hh) => {
          const active = h === hh && v === vv
          return (
            <button
              key={`${vv}-${hh}`}
              type="button"
              title={`Align ${vv === 'center' ? 'middle' : vv === 'start' ? 'top' : 'bottom'} ${hh === 'start' ? 'left' : hh === 'end' ? 'right' : 'center'}`}
              onClick={() => onChange({ align: hh, valign: vv })}
              className="group flex items-center justify-center rounded-[4px] hover:bg-white/5"
            >
              <span className={cn('rounded-full transition-all', active ? 'h-2.5 w-1 bg-slate-100' : 'size-1 bg-muted-foreground/40 group-hover:bg-muted-foreground')} />
            </button>
          )
        })
      )}
    </div>
  )
}

// `driftEffect`: the Current Implementation's own drift for this layer, so
// untouched W / H / radius read as what's actually rendered.
function PrecisionInspector({ layer, assembly, driftEffect, onChange, sections = ['layout', 'autolayout', 'appearance', 'fill', 'stroke', 'effects'] }) {
  const a = assembly ?? {}
  const d = TYPE_DEFAULTS[layer.type] ?? {}
  const [lockRatio, setLockRatio] = useState(false)
  const w = a.width ?? layer.width + (driftEffect?.dw ?? 0)
  const h = a.height ?? layer.height + (driftEffect?.dh ?? 0)
  const has = (id) => sections.includes(id)
  const fillToken = ASSEMBLY_FILLS.find((f) => f.id === a.fill)
  const shapeRadius = SHAPES.find((sh) => sh.id === a.shape)?.radius
  const direction = a.direction ?? d.direction ?? 'row'

  return (
    <div>
      {has('layout') && (
        <InspectorSection title="Layout">
          <div className={ROW}>
            <NumInput label="X" value={layer.x + (a.dx ?? 0)} title="X position" onChange={(x) => onChange({ dx: x - layer.x })} />
            <NumInput label="Y" value={layer.y + (a.dy ?? 0)} title="Y position" onChange={(y) => onChange({ dy: y - layer.y })} />
          </div>
          <div className={ROW}>
            <NumInput
              label="W"
              value={w}
              min={8}
              title="Width"
              onChange={(nw) => onChange(lockRatio ? { width: nw, height: Math.round((nw * h) / w) } : { width: nw })}
            />
            <NumInput
              label="H"
              value={h}
              min={8}
              title="Height"
              onChange={(nh) => onChange(lockRatio ? { height: nh, width: Math.round((nh * w) / h) } : { height: nh })}
            />
            <button
              type="button"
              title={lockRatio ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
              aria-pressed={lockRatio}
              onClick={() => setLockRatio((v) => !v)}
              className={cn('flex size-7 items-center justify-center rounded-[6px] transition-colors', lockRatio ? 'bg-white/[0.12] text-white' : 'text-slate-500 hover:bg-white/[0.05] hover:text-slate-200')}
            >
              {lockRatio ? <Link2 className="size-3.5" /> : <Link2Off className="size-3.5" />}
            </button>
          </div>
        </InspectorSection>
      )}

      {has('autolayout') && AUTO_LAYOUT_TYPES.has(layer.type) && (
        <InspectorSection title="Auto layout">
          <div className={ROW}>
            <Segmented
              value={direction}
              onChange={(dir) => onChange({ direction: dir })}
              options={[
                { id: 'row', icon: ArrowRight, title: 'Horizontal' },
                { id: 'column', icon: ArrowDown, title: 'Vertical' },
              ]}
            />
            <NumInput label={<BetweenHorizontalStart className="size-3" />} value={a.gap} placeholder={d.gap} title="Gap between items" min={0} onChange={(gap) => onChange({ gap })} />
          </div>
          <div className={ROW}>
            <NumInput label={<MoveHorizontal className="size-3" />} value={a.padX} placeholder={d.padX} title="Horizontal padding" min={0} onChange={(padX) => onChange({ padX })} />
            <NumInput label={<MoveVertical className="size-3" />} value={a.padY} placeholder={d.padY} title="Vertical padding" min={0} onChange={(padY) => onChange({ padY })} />
          </div>
          <div className={ROW}>
            <AlignGrid h={a.align ?? d.align ?? 'center'} v={a.valign ?? d.valign ?? 'center'} onChange={onChange} />
            <p className={cn(CAPTION, 'self-start leading-snug')}>Alignment</p>
          </div>
        </InspectorSection>
      )}

      {has('appearance') && (
        <InspectorSection title="Appearance">
          <div className={ROW}>
            <NumInput label={<Blend className="size-3" />} value={a.opacity} placeholder={100} unit="%" min={0} max={100} title="Opacity" onChange={(opacity) => onChange({ opacity })} />
            <NumInput
              label={<SquareRoundCorner className="size-3" />}
              value={a.radius ?? shapeRadius}
              placeholder={driftEffect?.radius ?? d.radius}
              min={0}
              max={999}
              title="Corner radius"
              onChange={(radius) => onChange({ radius })}
            />
          </div>
          <div className={ROW}>
            <Segmented
              className={SPAN2}
              value={a.radius ?? shapeRadius}
              onChange={(r) => onChange({ radius: r })}
              options={[
                { id: 0, label: 'Square', icon: Square, title: 'Square corners (0px)' },
                { id: 12, label: 'Rounded', icon: RectangleHorizontal, title: 'Rounded corners (12px)' },
                { id: 999, label: 'Pill', icon: Circle, title: 'Pill corners (999px)' },
              ]}
            />
          </div>
        </InspectorSection>
      )}

      {has('fill') && (
        <InspectorSection
          title="Fill"
          action={
            (a.fill || a.fillColor) && (
              <button type="button" title="Remove fill override" onClick={() => onChange({ fill: undefined, fillColor: undefined })} className="flex size-5 items-center justify-center rounded-[4px] text-muted-foreground hover:bg-white/5 hover:text-foreground">
                <Minus className="size-3" />
              </button>
            )
          }
        >
          <div className={ROW}>
            <div className={SPAN2}>
              <ColorField
                value={a.fillColor ?? fillToken?.token}
                swatchHex={a.fillColor ?? fillToken?.hex}
                swatchClass={!a.fillColor && fillToken ? fillToken.swatch : undefined}
                placeholder={`${d.fill ?? 'Default'} · HEX or token`}
                onHex={(fillColor) => onChange({ fillColor, fill: undefined })}
                onToken={(f) => onChange({ fill: f.id, fillColor: undefined })}
                onClear={() => onChange({ fill: undefined, fillColor: undefined })}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ASSEMBLY_FILLS.map((f) => (
              <button
                key={f.id}
                type="button"
                title={`${f.label} · ${f.token}`}
                onClick={() => onChange({ fill: f.id, fillColor: undefined })}
                className={cn('size-5 rounded-[4px] transition-transform hover:scale-110', f.swatch, a.fill === f.id && !a.fillColor && 'ring-2 ring-white ring-offset-1 ring-offset-slate-900')}
              />
            ))}
          </div>
        </InspectorSection>
      )}

      {has('stroke') && (
        <InspectorSection
          title="Stroke"
          action={
            <button
              type="button"
              title={a.stroke ? 'Remove stroke' : 'Add stroke'}
              onClick={() => onChange(a.stroke ? { stroke: undefined, border: 'none' } : { stroke: { color: '#cbd5e1', width: 1 } })}
              className="flex size-5 items-center justify-center rounded-[4px] text-muted-foreground hover:bg-white/5 hover:text-foreground"
            >
              {a.stroke ? <Minus className="size-3" /> : <Plus className="size-3" />}
            </button>
          }
        >
          {a.stroke ? (
            <div className={ROW}>
              <ColorField
                value={a.stroke.color}
                swatchHex={a.stroke.color}
                placeholder="HEX or token"
                onHex={(color) => onChange({ stroke: { ...a.stroke, color } })}
                onToken={(f) => onChange({ stroke: { ...a.stroke, color: f.hex } })}
              />
              <NumInput label="W" value={a.stroke.width} min={0} max={24} title="Stroke width" onChange={(width) => onChange({ stroke: { ...a.stroke, width } })} />
            </div>
          ) : (
            <p className={cn(CAPTION, 'flex h-7 items-center')}>No stroke</p>
          )}
        </InspectorSection>
      )}

      {has('effects') && (
        <InspectorSection title="Effects">
          <div className={ROW}>
            <Segmented
              className={SPAN2}
              value={a.shadow ?? 'none'}
              onChange={(shadow) => onChange({ shadow })}
              options={[
                { id: 'none', label: 'None' },
                { id: 'soft', label: 'Drop shadow' },
                { id: 'glow', label: 'Glow' },
              ]}
            />
          </div>
          {['button', 'chip'].includes(layer.type) && (
            <>
              <p className={cn(CAPTION, 'pt-1')}>Icon</p>
              <div className={ROW}>
                <Segmented
                  className={SPAN2}
                  value={a.icon ?? 'none'}
                  onChange={(id) => onChange({ icon: id === 'none' ? null : id })}
                  options={[
                    { id: 'none', label: 'None', title: 'No icon' },
                    { id: 'left', label: 'Leading', title: 'Leading icon' },
                    { id: 'right', label: 'Trailing', title: 'Trailing icon' },
                  ]}
                />
              </div>
            </>
          )}
        </InspectorSection>
      )}
    </div>
  )
}

// The Assemble inspector for the selected element: one-click block presets
// up top, then the precision sections. Everything writes into the layer's
// "assembly", which previews live on the Current Implementation and is
// bundled into the merge.
function AssembleBuilder({ layer, frameWidth, assembly, driftEffect, onChange, onReset }) {
  return (
    <div className="pb-2">
      <div className="flex h-7 items-center gap-2 px-5">
        <Blocks className="size-4 text-slate-400" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{layer.name}</span>
        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-muted-foreground capitalize">{layer.type}</span>
        <button
          type="button"
          onClick={onReset}
          disabled={!assembly}
          className="inline-flex items-center justify-center rounded-full px-2.5 h-6 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          Reset
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 px-5 pt-2 pb-2.5">
        {blockTemplates(layer, frameWidth).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.patch)}
            className={cn('inline-flex h-7 shrink-0 items-center justify-center rounded-[6px] px-2.5 text-[11px] font-medium whitespace-nowrap', GHOST_BUTTON)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <PrecisionInspector layer={layer} assembly={assembly} driftEffect={driftEffect} onChange={onChange} />
    </div>
  )
}

// For elements with no parseable design-system options (Assemble): an AI
// recommendation with one-click apply; the precision inspector below it
// covers setting values by hand.
function AiRecommendation({ layer, onChange }) {
  const rec = recommendAssembly(layer)
  return (
    <section>
      <p className={PANEL_LABEL}>No design tokens found</p>
      <div className={cn(PANEL_SURFACE, 'p-3')}>
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-slate-100">
          <Sparkles className="size-3.5 text-slate-400" />
          AI recommends
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{rec.rationale}</p>
        <button type="button" onClick={() => onChange(rec.patch)} className={cn('mt-2.5 flex h-7 items-center justify-center gap-1.5 rounded-[6px] px-3 text-[11px] font-medium', GHOST_BUTTON)}>
          <Wand2 className="size-3.5" />
          Apply recommendation
        </button>
      </div>
    </section>
  )
}

// The Compare tab: the high-level conflict summary only — how much is
// resolved, then every drift for this item (design + code, via the same
// `buildDrifts` as the canvas's < > pager and the merge wizard's Check
// step) as an accordion: each row is severity · what drifted · status, and
// clicking one expands it in place — right beneath it, never a screen or
// tab switch — to its property diffs (keep Original / take Current / set a
// custom value per property; for a code drift, the original → incoming
// line, edited in the code window). One row open at a time; opening a row
// also selects it on the canvas, and selecting a drifting element on the
// canvas opens its row.
// No per-drift severity exists in the mock data (only a per-*item*
// conflictLevel, which would paint every row in the list the same color) —
// so this derives a reasonable per-row signal from how many properties are
// actually in conflict: more properties touched reads as a bigger conflict.
// A code drift is always a single line, so it reads as the mildest case.
function severityOf(d) {
  if (d.kind !== 'design') return 'low'
  if (d.diffs.length >= 3) return 'high'
  if (d.diffs.length === 2) return 'medium'
  return 'low'
}

function VariantCompareTab({ item, selectedLayerId, resolutions, onResolve, onHoverDiff }) {
  const { requestMergeFocus, getFileLines } = useWorkspace()
  const page = canvasPages.find((p) => p.id === item.designPageId)
  const frame = frameWithLayers(page?.frames[0])
  const drifts = buildDrifts(item, frame)
  const resolvedOf = (d) => d.kind === 'design' && d.diffs.every((diff) => resolutions[`${d.layerId}:${diff.id}`])
  const resolved = drifts.filter(resolvedOf).length
  const design = drifts.filter((d) => d.kind === 'design').length

  // The open row. Follows the canvas: selecting a drifting element opens
  // its row (context-aware), without closing a row the user opened by hand
  // for something else unless the selection points at a drift.
  const [openId, setOpenId] = useState(selectedLayerId ? `d:${selectedLayerId}` : null)
  useEffect(() => {
    if (selectedLayerId && designMergeVariants[item.id]?.layerDiffs?.[selectedLayerId]) setOpenId(`d:${selectedLayerId}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLayerId])

  function toggle(d) {
    const opening = openId !== d.id
    setOpenId(opening ? d.id : null)
    if (opening) {
      requestMergeFocus({
        itemId: item.id,
        keepDeck: true,
        label: d.label,
        ...(d.kind === 'design' ? { layerId: d.layerId } : { fileId: d.fileId, line: d.line }),
      })
    }
  }

  if (!drifts.length) {
    return (
      <DeckScroll innerClassName="px-5 pb-5">
        <p className={cn(PANEL_SURFACE, 'px-4 py-6 text-center text-xs text-slate-400')}>No drifts — this item matches the Original Design.</p>
      </DeckScroll>
    )
  }

  return (
    <DeckScroll innerClassName="space-y-4 px-5 pb-5">
      {/* Resolution summary. */}
      <div className={cn(PANEL_SURFACE, 'px-3 py-3')}>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[13px] font-semibold text-slate-100 tabular-nums">
            {resolved} of {drifts.length}
          </span>
          <span className="text-xs text-slate-400">drifts resolved</span>
          <span className="ml-auto text-[11px] text-slate-500 tabular-nums">
            {design} design · {drifts.length - design} code
          </span>
        </div>
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-emerald-400 transition-[width] duration-300" style={{ width: `${(resolved / drifts.length) * 100}%` }} />
        </div>
      </div>

      <section>
        <p className={PANEL_LABEL}>
          Detected drifts
          <span className="text-slate-500 tabular-nums">{drifts.length}</span>
        </p>
        <div className={cn(PANEL_SURFACE, PANEL_ROWS)}>
          {drifts.map((d) => {
            const done = resolvedOf(d)
            const open = openId === d.id
            const left = d.kind === 'design' ? d.diffs.filter((diff) => !resolutions[`${d.layerId}:${diff.id}`]).length : null
            const original = d.kind === 'code' ? (getFileLines(d.fileId)[d.line - 1] ?? '') : null
            const incoming = d.kind === 'code' ? codeMergeVariants[item.id]?.[d.fileId]?.find((x) => x.line === d.line)?.incoming : null
            return (
              <div key={d.id} className={cn('relative transition-colors', open && 'bg-white/[0.04]')}>
                {open && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-emerald-400" />}
                <button
                  type="button"
                  onClick={() => toggle(d)}
                  aria-expanded={open}
                  className={cn('flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors', !open && 'hover:bg-white/[0.03]')}
                >
                  <SeverityPill level={severityOf(d)} />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-xs', open ? 'font-semibold text-white' : 'text-slate-100')}>{d.label}</span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {d.kind === 'code' ? `Code · line ${d.line}` : done ? 'All properties resolved' : `${left} of ${d.diffs.length} to resolve`}
                    </span>
                  </span>
                  {/* Resolved: a solid mint circle with a dark check and a soft
                      mint glow — unmissable at a glance. Pending: plain gray. */}
                  <span
                    title={done ? 'Resolved' : 'Not resolved yet'}
                    className={cn(
                      'flex size-4 shrink-0 items-center justify-center rounded-full transition-colors',
                      done ? 'bg-emerald-400 text-slate-950 shadow-[0_0_8px_rgba(52,211,153,0.55)]' : 'bg-slate-700 text-muted-foreground'
                    )}
                  >
                    {done && <Check strokeWidth={3.5} className="size-2.5" />}
                  </span>
                  <ChevronDown className={cn('size-3.5 shrink-0 text-slate-500 transition-transform duration-200', open && 'rotate-180 text-slate-300')} />
                </button>

                {/* Inline accordion body, directly beneath its row: animates
                    its height open / closed (grid-rows 0fr ↔ 1fr). */}
                <div className={cn('grid transition-[grid-template-rows] duration-200 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')} inert={!open} aria-hidden={!open}>
                  <div className="overflow-hidden">
                    <div className="px-3 pb-3">
                      {d.kind === 'design' ? (
                        <div>
                          {d.diffs.map((diff) => (
                            <DiffRow
                              key={`${diff.id}:${JSON.stringify(resolutions[`${d.layerId}:${diff.id}`] ?? null)}`}
                              diff={diff}
                              resolution={resolutions[`${d.layerId}:${diff.id}`]}
                              onResolve={(diffId, side) => onResolve(d.layerId, diffId, side)}
                              onHover={(diffId, side) => onHoverDiff(diffId ? { layerId: d.layerId, diffId, side } : null)}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-[4.5rem_1fr] items-start gap-x-2 gap-y-1.5 py-1 text-[11px]">
                          <span className="pt-0.5 text-slate-500">Original</span>
                          <p className="font-mono break-words text-slate-500 line-through decoration-slate-600">{original || ' '}</p>
                          <span className="pt-0.5 text-slate-500">Incoming</span>
                          <p className="font-mono break-words text-slate-100">{incoming ?? '—'}</p>
                          <span />
                          <p className="text-slate-500">Edit this line directly in the code window.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Open a drift to compare and resolve its properties right here.</p>
      </section>
    </DeckScroll>
  )
}

// One editable text slot of the selected element. While focused it keeps
// its own draft (streamed live to the canvas + copy.json on every
// keystroke); otherwise it shows the slot's current value, so edits made on
// the canvas or in the code window show up here too.
function TextSlotField({ slot, onEditText }) {
  const [draft, setDraft] = useState(null)
  const cancelRef = useRef(false)
  const multiline = slot.slot === 'body' || slot.slot === 'text'
  const Field = multiline ? 'textarea' : 'input'
  function commit() {
    const value = draft
    setDraft(null)
    if (cancelRef.current) {
      cancelRef.current = false
      onEditText(slot.layerId, slot.slot, null, { live: true })
    } else if (value !== null) onEditText(slot.layerId, slot.slot, value)
  }
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-muted-foreground capitalize">{slot.slot === 'label' ? 'Label' : slot.slot}</span>
      <Field
        value={draft ?? slot.current}
        rows={multiline ? 2 : undefined}
        onFocus={() => setDraft(slot.current)}
        onChange={(e) => {
          const v = e.target.value.replace(/\n/g, ' ')
          setDraft(v)
          onEditText(slot.layerId, slot.slot, v, { live: true })
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
          } else if (e.key === 'Escape') {
            cancelRef.current = true
            e.currentTarget.blur()
          }
        }}
        className={cn(
          'w-full resize-none rounded-[6px] bg-white/[0.05] px-2 py-1.5 text-[12px] leading-4 text-foreground outline-none transition-colors focus:bg-white/[0.08] focus:ring-1 focus:ring-white/30',
          slot.current !== slot.value && 'ring-1 ring-white/25'
        )}
      />
    </label>
  )
}

// The selected element's text — headings, body copy, labels, placeholders,
// card titles — edited here, on the canvas, or in copy.json alike.
function TextContentSection({ slots, onEditText }) {
  const edited = slots.some((s) => s.current !== s.value)
  return (
    <section>
      <div className={PANEL_LABEL}>
        <span className="flex-1">Text</span>
        {edited ? (
          <button
            type="button"
            onClick={() => slots.forEach((s) => s.current !== s.value && onEditText(s.layerId, s.slot, s.value))}
            className="inline-flex h-5 items-center justify-center rounded-full px-2 text-[11px] font-medium tracking-normal text-slate-200 normal-case hover:bg-white/[0.08]"
          >
            Reset
          </button>
        ) : (
          <span className="text-[11px] tracking-normal text-slate-500 normal-case">Synced to copy.json</span>
        )}
      </div>
      <div className="space-y-2.5">
        {slots.map((slot) => (
          <TextSlotField key={slot.key} slot={slot} onEditText={onEditText} />
        ))}
      </div>
    </section>
  )
}


// A single AI-generated style suggestion — badge, preview swatch, rationale
// copy explaining why the (mock) model picked it, and its own dismiss
// button so an unsatisfactory suggestion can be cleared without affecting
// the rest of the list.
function AiSuggestionCard({ preset, applied, onApply, onDelete }) {
  return (
    <div className={cn('group relative px-3 py-3.5 text-left transition-colors', applied ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]')}>
      {applied && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-emerald-400" />}
      <button type="button" onClick={() => onApply(preset)} className="flex w-full items-start gap-3 text-left">
        <span className={cn('size-9 shrink-0 rounded-full', preset.previewClass)} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{preset.label}</span>
            <span className="flex items-center gap-0.5 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-slate-400">
              <Sparkles className="size-3" />
              AI
            </span>
            {applied && <Check className="ml-auto size-4 shrink-0 text-slate-100" />}
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
            {preset.rationale}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => onDelete(preset.id)}
        title="Dismiss suggestion"
        className="absolute top-2.5 right-2.5 flex size-6 items-center justify-center rounded-full text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

// The AI-driven "Block Assemble" tab — a short list of mock AI style
// suggestions (badged, with rationale) for whichever canvas layer is
// currently selected. Picking one calls `onApplyPreset` so the parent can
// live-preview it on the Current Implementation artboard; dismissing one just removes it
// from view; "Generate alternatives" pulls more from the shared preset pool
// until it's exhausted.
function AiSuggestionsSection({ selectedLayerName, appliedPresetId, onApplyPreset }) {
  const [visibleIds, setVisibleIds] = useState(() => blockDeckPresets.slice(0, 3).map((p) => p.id))
  // Dismissed suggestions stay dismissed — "Generate alternatives" only ever
  // pulls presets that have never been shown yet, so clearing a bad
  // suggestion never brings that exact one back.
  const [seenIds, setSeenIds] = useState(() => new Set(visibleIds))

  const visiblePresets = blockDeckPresets.filter((p) => visibleIds.includes(p.id))
  const hasMore = seenIds.size < blockDeckPresets.length

  function generateAlternatives() {
    const next = blockDeckPresets.find((p) => !seenIds.has(p.id))
    if (!next) return
    setVisibleIds((prev) => [...prev, next.id])
    setSeenIds((prev) => new Set(prev).add(next.id))
  }

  function deleteSuggestion(id) {
    setVisibleIds((prev) => prev.filter((v) => v !== id))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-5 pt-2">
        <p className={PANEL_LABEL}>AI suggestions</p>
        <p className="-mt-1 mb-2 text-xs text-muted-foreground">
          {selectedLayerName ? (
            <>
              For <span className="font-medium text-foreground">{selectedLayerName}</span>
            </>
          ) : (
            'Select a canvas element to preview suggestions on it'
          )}
        </p>
      </div>

      <div className="px-5">
        <div className={cn(PANEL_SURFACE, PANEL_ROWS)}>
        {visiblePresets.map((preset) => (
          <AiSuggestionCard
            key={preset.id}
            preset={preset}
            applied={appliedPresetId === preset.id}
            onApply={onApplyPreset}
            onDelete={deleteSuggestion}
          />
        ))}
        {visiblePresets.length === 0 && (
          <p className="p-3 text-center text-sm text-muted-foreground">
            All suggestions dismissed. Generate more below.
          </p>
        )}
        </div>
      </div>

      <div className="shrink-0 px-5 pt-3 pb-5">
        <button
          type="button"
          onClick={generateAlternatives}
          disabled={!hasMore}
          className={cn('flex h-9 w-full items-center justify-center gap-2 rounded-full px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40', GHOST_BUTTON)}
        >
          <Wand2 className="size-4" />
          {hasMore ? 'Generate alternatives' : 'No more alternatives'}
        </button>
      </div>
    </div>
  )
}

// The selected element's drift, resolved here in Assemble (Compare only
// summarizes): one row per differing property — keep the Original Design
// value, take the Current Implementation's, or set a custom one.
function DriftResolveSection({ layerId, diffs, resolutions, onResolve, onHoverDiff }) {
  const done = diffs.filter((d) => resolutions[`${layerId}:${d.id}`]).length
  return (
    <section>
      <div className={PANEL_LABEL}>
        <span className="flex-1">Drift</span>
        <span className={cn('text-[11px]', done === diffs.length ? 'text-emerald-300' : 'text-slate-500')}>
          {done} of {diffs.length} resolved
        </span>
      </div>
      <div className={cn(PANEL_SURFACE, 'px-3 py-1.5')}>
        {diffs.map((diff) => (
          <DiffRow
            key={`${diff.id}:${JSON.stringify(resolutions[`${layerId}:${diff.id}`] ?? null)}`}
            diff={diff}
            resolution={resolutions[`${layerId}:${diff.id}`]}
            onResolve={(diffId, side) => onResolve(layerId, diffId, side)}
            onHover={(diffId, side) => onHoverDiff(diffId ? { layerId, diffId, side } : null)}
          />
        ))}
      </div>
    </section>
  )
}

// Which design tokens the selected element is bound to (read-only).
function TokenBindingSection({ spec }) {
  const rows = [
    ['Fill', <span key="f" className="flex items-center gap-1.5"><span className="size-3 rounded-[3px] ring-1 ring-white/15" style={{ background: spec.fill.color }} />{spec.fill.token}</span>],
    spec.typography && ['Type', `${spec.typography.font} ${spec.typography.size}/${spec.typography.weight}`],
    ['Layout', spec.layout.mode],
  ].filter(Boolean)
  return (
    <section>
      <p className={PANEL_LABEL}>Token binding</p>
      <div className={cn(PANEL_SURFACE, 'space-y-1.5 px-3 py-2.5 text-xs')}>
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <span className="text-slate-500">{label}</span>
            <span className="truncate text-slate-100">{value}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

// Block Assemble: everything about the selected element, in detail — its
// drift, resolved property by property (or, without drift, its token
// binding / an AI recommendation), then its content copy (the Text card,
// bound to copy.json), its shape / size / style, and AI style suggestions.
function BlockAssembleTab({ selectedLayer, frameWidth, assembly, driftEffect, onAssemble, onAssembleReset, textSlots, onEditText, diffs, tokenSpec, resolutions, onResolve, onHoverDiff, ...suggestionProps }) {
  return (
    <DeckScroll>
      {selectedLayer && diffs?.length > 0 && (
        <div className="px-5 pb-4">
          <DriftResolveSection layerId={selectedLayer.id} diffs={diffs} resolutions={resolutions} onResolve={onResolve} onHoverDiff={onHoverDiff} />
        </div>
      )}
      {selectedLayer && !diffs?.length && (
        <div className="px-5 pb-4">
          {tokenSpec ? <TokenBindingSection spec={tokenSpec} /> : <AiRecommendation layer={selectedLayer} onChange={onAssemble} />}
        </div>
      )}
      {textSlots?.length > 0 && (
        <div className="px-5 pb-4">
          <TextContentSection slots={textSlots} onEditText={onEditText} />
        </div>
      )}
      {selectedLayer ? (
        <AssembleBuilder
          layer={selectedLayer}
          frameWidth={frameWidth}
          assembly={assembly}
          driftEffect={driftEffect}
          onChange={onAssemble}
          onReset={onAssembleReset}
        />
      ) : (
        <p className="px-5 py-4 text-center text-sm text-muted-foreground">
          Select an element on the canvas to assemble its shape, size and layout.
        </p>
      )}
      <AiSuggestionsSection {...suggestionProps} />
    </DeckScroll>
  )
}

// Design System library: browse the integrated component library, then
// either restyle the selected element with a component ("Replace" /
// "Insert") or pull a fresh instance onto both artboards ("Add").
// Preview tile: the live component on a white (light-mode canvas) tile,
// scaled to fit — 92×56, sized so a row keeps room for its text + actions.
function ComponentPreview({ def }) {
  const box = { w: 80, h: 44 }
  const k = Math.min(1, box.w / def.width, box.h / def.height)
  // `name` matters: some layer types (avatars) render from it — without it
  // an avatar preview crashed the whole Library tab.
  const layer = { id: def.id, name: def.name, type: def.type, label: def.label, x: 0, y: 0, width: def.width, height: def.height }
  const override = { ...assemblyToOverride(def.assembly, layer), static: true }
  return (
    <div className="flex shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-white ring-1 ring-white/10" style={{ width: box.w + 12, height: box.h + 12 }}>
      <div className="relative" style={{ width: def.width * k, height: def.height * k }}>
        <div className="absolute top-0 left-0" style={{ width: def.width, height: def.height, transform: `scale(${k})`, transformOrigin: 'top left' }}>
          <StaticLayer layer={layer} override={override} onSelect={() => {}} />
        </div>
      </div>
    </div>
  )
}

// Library row actions: same 28px / 6px spec as the inspector controls,
// medium weight. The contextual action (Replace / Insert) is a soft fill;
// Add is a quiet outline.
const LIB_ACTION = 'flex h-7 min-w-0 items-center justify-center gap-1 rounded-[6px] px-2.5 text-[11px] font-medium whitespace-nowrap transition-colors'
const LIB_PRIMARY = 'bg-white/[0.08] text-slate-100 hover:bg-white/[0.12] hover:text-white'
const LIB_SECONDARY = 'text-slate-300 ring-1 ring-inset ring-white/10 hover:bg-white/[0.05] hover:text-white'

// One library component row: preview tile (drag it onto an artboard to
// place it) · name + what the action does · actions.
function LibraryRow({ def, mode, target, onApply, onInsert, onAdd, onDrag }) {
  return (
    <div className="flex items-center gap-3 p-3">
      <div
        title="Drag onto the canvas to place"
        className="shrink-0 cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={(e) => {
          if (e.button !== 0 || !onDrag) return
          e.preventDefault()
          onDrag(def)
        }}
      >
        <ComponentPreview def={def} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-slate-100">{def.name}</p>
        <p className="mt-0.5 truncate text-xs text-slate-400">
          {mode === 'replace' ? `Replaces ${target}` : mode === 'insert' ? `Inserts into ${target}` : def.tokens.join(' · ')}
        </p>
        {/* Equal-width cells, so labels never squeeze; Add alone (no
            contextual action) spans both. */}
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {mode === 'replace' && (
            <button type="button" onClick={() => onApply(def)} className={cn(LIB_ACTION, LIB_PRIMARY)}>
              Replace
            </button>
          )}
          {mode === 'insert' && (
            <button type="button" onClick={() => onInsert(def)} className={cn(LIB_ACTION, LIB_PRIMARY)}>
              Insert
            </button>
          )}
          <button type="button" onClick={() => onAdd(def)} className={cn(LIB_ACTION, mode ? LIB_SECONDARY : cn(LIB_PRIMARY, 'col-span-2'))}>
            <Plus className="size-3" />
            Add
          </button>
        </div>
      </div>
    </div>
  )
}

// Compact category picker (replaces the old sideways-scrolling chip row):
// a 32px control beside the search, opening a menu with per-category
// counts.
function CategoryMenu({ categories, counts, value, onChange }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title="Filter by category"
        className={cn(
          'flex h-8 shrink-0 items-center gap-1.5 rounded-[6px] px-2.5 text-[12px] font-medium transition-colors',
          value === 'All' ? 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.08]' : 'bg-white/[0.1] text-white hover:bg-white/[0.13]'
        )}
      >
        <SlidersHorizontal className="size-3.5 text-slate-400" />
        <span className="max-w-[88px] truncate">{value === 'All' ? 'All types' : value}</span>
        <ChevronDown className="size-3 text-slate-500" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44 rounded-xl border border-white/10 bg-card/95 backdrop-blur-xl">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {categories.map((c) => (
            <DropdownMenuRadioItem key={c} value={c} className="text-xs">
              <span className="flex-1">{c === 'All' ? 'All types' : c}</span>
              <span className="ml-3 text-[11px] text-slate-500 tabular-nums">{counts[c] ?? 0}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// The Library tab — driven by the canvas selection:
//   • nothing selected: the whole design system, one list;
//   • an element selected: a "Selected" card naming it, and only what fits
//     it, split by what the component would do — "Replace <name>" (same
//     role) and "Insert into <name>" (children it can hold). A Compatible /
//     All switch widens to every component (rows still say whether they'd
//     replace / insert). Selecting another element re-filters and resets
//     the view; if nothing fits, the tab says so and shows everything.
// Search + a compact category menu narrow any of these.
function ComponentsTab({ selectedLayer, onApply, onAdd, onDrag, onInsert }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [showAll, setShowAll] = useState(false)
  // A new selection is a new context: back to its compatible set.
  useEffect(() => {
    setShowAll(false)
    setCategory('All')
  }, [selectedLayer?.id])

  const compat = selectedLayer ? libraryCompat(selectedLayer) : null
  const modeOf = (def) => (!compat ? null : compat.replace.has(def.type) ? 'replace' : compat.insert.has(def.type) ? 'insert' : null)
  const fitting = compat ? designSystemComponents.filter((c) => modeOf(c)) : []
  const nothingFits = Boolean(compat) && fitting.length === 0
  const contextual = Boolean(compat) && !showAll && !nothingFits
  const pool = contextual ? fitting : designSystemComponents

  const q = query.trim().toLowerCase()
  const matchesQuery = (c) => c.name.toLowerCase().includes(q)
  const counts = { All: pool.filter(matchesQuery).length }
  pool.filter(matchesQuery).forEach((c) => (counts[c.category] = (counts[c.category] ?? 0) + 1))
  const categories = ['All', ...new Set(pool.map((c) => c.category))]
  const activeCategory = categories.includes(category) ? category : 'All'
  const visible = pool.filter((c) => (activeCategory === 'All' || c.category === activeCategory) && matchesQuery(c))

  const rowProps = { target: selectedLayer?.name, onApply, onInsert, onAdd, onDrag }
  const groups = contextual
    ? [
        { id: 'replace', title: `Replace ${selectedLayer.name}`, items: visible.filter((d) => modeOf(d) === 'replace') },
        { id: 'insert', title: `Insert into ${selectedLayer.name}`, items: visible.filter((d) => modeOf(d) === 'insert') },
      ].filter((g) => g.items.length)
    : [{ id: 'all', title: 'Components', items: visible }]

  return (
    <DeckScroll innerClassName="space-y-4 px-5 pb-5">
      <div className="space-y-3">
        <div className="flex h-5 items-center gap-2 text-xs">
          <span className="font-medium text-slate-200">{designSystemMeta.name}</span>
          <span className="rounded-[4px] bg-white/[0.06] px-1.5 py-px text-[10px] text-slate-400 tabular-nums">{designSystemMeta.version}</span>
          <span className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            {designSystemMeta.syncedLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search components…"
              className="h-8 w-full rounded-[6px] bg-white/[0.05] pr-3 pl-8 text-[12px] text-white outline-none placeholder:text-slate-500 focus:bg-white/[0.08] focus:ring-1 focus:ring-white/20"
            />
          </div>
          <CategoryMenu categories={categories} counts={counts} value={activeCategory} onChange={setCategory} />
        </div>
      </div>

      {/* The selection this list is filtered for. */}
      {selectedLayer ? (
        <div className={cn(PANEL_SURFACE, 'flex items-center gap-3 px-3 py-2.5')}>
          <MousePointerClick className="size-4 shrink-0 text-slate-400" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-slate-100">{selectedLayer.name}</p>
            <p className="truncate text-xs text-slate-400">
              {nothingFits ? 'No component fits this element — showing all' : `${fitting.length} compatible · ${selectedLayer.type}`}
            </p>
          </div>
          {!nothingFits && (
            <Segmented
              className="w-[140px] shrink-0"
              value={showAll ? 'all' : 'fit'}
              onChange={(v) => setShowAll(v === 'all')}
              options={[
                { id: 'fit', label: 'Compatible', title: `Only components that fit ${selectedLayer.name}` },
                { id: 'all', label: 'All', title: 'Every component' },
              ]}
            />
          )}
        </div>
      ) : (
        <p className="text-xs leading-relaxed text-slate-500">Select an element on the canvas to see only the components that fit it — or drag one onto the canvas.</p>
      )}

      {groups.map((g) => (
        <section key={g.id}>
          <div className={PANEL_LABEL}>
            <span className="min-w-0 truncate">{g.title}</span>
            <span className="text-slate-500 tabular-nums">{g.items.length}</span>
          </div>
          <div className={cn(PANEL_SURFACE, PANEL_ROWS)}>
            {g.items.map((def) => (
              <LibraryRow key={def.id} def={def} mode={modeOf(def)} {...rowProps} />
            ))}
            {g.items.length === 0 && <p className="p-4 text-center text-xs text-slate-500">No components match.</p>}
          </div>
        </section>
      ))}
      {contextual && groups.length === 0 && (
        <p className={cn(PANEL_SURFACE, 'p-4 text-center text-xs text-slate-500')}>No compatible components match this search.</p>
      )}
    </DeckScroll>
  )
}

// A floating, freely draggable window — rendered only while `open` (the
// workspace opens it when an element, frame, or code line on the canvas is
// clicked; there is no standalone trigger button). Drag it by its header
// anywhere within Merge Studio. "Variant Compare" is the design-merge
// inspector; "Block Assemble" is the AI style-suggestion picker.
export const DECK_WIDTH = 360
// Docked below the top toolbar row (notifications/avatars, Preview, Apply
// with AI at `top-3`, 36px tall) — same 60px top as the Merge List window
// on the left — so the deck never covers those controls. Dragging keeps
// this as the ceiling too.
const DECK_TOP = 60

function BlockDeckPanel({
  open,
  onFloat,
  item,
  selectedLayerId,
  selectedLayerName,
  appliedPresetId,
  onApplyPreset,
  resolutions,
  driftEffect,
  textSlots,
  onEditText,
  onResolve,
  onHoverDiff,
  selectedLayer,
  frameWidth,
  assembly,
  onAssemble,
  onAssembleReset,
  onApplyComponent,
  onAddComponent,
  onDragComponent,
  onInsertComponent,
  onTabSwitch,
}) {
  const [tab, setTab] = useState('compare')
  function switchTab(next) {
    setTab(next)
    onTabSwitch?.()
  }
  const [pos, setPos] = useState(null)
  // Collapsed at rest (no selection yet) — but every fresh selection (a new
  // layer/frame/code diff clicked on the canvas) re-expands it automatically
  // so the right, context-aware tab content is immediately visible instead
  // of hiding behind a chevron the user has to remember to click.
  const [collapsed, setCollapsed] = useState(true)
  const rootRef = useRef(null)

  useEffect(() => {
    setCollapsed(false)
  }, [selectedLayerId])

  if (!open) return null

  function handleDragStart(event) {
    if (event.button !== 0) return
    event.preventDefault()
    onFloat?.()
    const root = rootRef.current
    const bounds = root.offsetParent.getBoundingClientRect()
    const rect = root.getBoundingClientRect()
    const start = {
      x: event.clientX,
      y: event.clientY,
      left: rect.left - bounds.left,
      top: rect.top - bounds.top,
    }
    function onMove(m) {
      setPos({
        left: Math.min(Math.max(0, start.left + m.clientX - start.x), Math.max(0, bounds.width - rect.width)),
        top: Math.min(Math.max(DECK_TOP, start.top + m.clientY - start.y), Math.max(DECK_TOP, bounds.height - 48)),
      })
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div
      ref={rootRef}
      data-guide="block-deck"
      style={{
        width: DECK_WIDTH,
        ...(pos ? { left: pos.left, top: pos.top } : { right: 16, top: DECK_TOP }),
        maxHeight: `calc(100% - ${DECK_TOP + 16}px)`,
      }}
      className={cn('absolute z-30 flex flex-col overflow-hidden rounded-2xl', FLOATING_PANEL)}
    >
      <div
        onPointerDown={handleDragStart}
        className="flex h-12 shrink-0 cursor-grab items-center gap-2 px-5 active:cursor-grabbing"
      >
        <Blocks className="size-4 shrink-0 text-slate-400" />
        <span className="flex-1 text-sm font-semibold text-foreground">Block Deck</span>
        {/* Fold-only now — no separate "X" close. The deck stays docked;
            collapsing is the one and only way to get it out of the way. */}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          onPointerDown={(e) => e.stopPropagation()}
          title={collapsed ? 'Expand' : 'Collapse'}
          className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ChevronDown strokeWidth={2.5} className={cn('size-3.5 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </div>

      {!collapsed && (
      <>
      {/* Tabs: the shared category-tab pills (same as the Merge List's
          Files / Layers switch and the Inbox filters), straight under the
          title — no rules above or below, just spacing. */}
      <div className="flex shrink-0 items-center gap-1 px-5 pb-3">
        {[
          ['compare', 'Compare'],
          ['assemble', 'Assemble'],
          ['library', 'Library'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => switchTab(id)}
            className={cn(CATEGORY_TAB, tab === id ? CATEGORY_TAB_ACTIVE : CATEGORY_TAB_IDLE)}
          >
            {label}
          </button>
        ))}
      </div>
      {/* No per-tab description line — each tab's content starts right
          under the tab bar. */}
      {tab === 'compare' ? (
        item.hasDesign ? (
          <VariantCompareTab
            item={item}
            selectedLayerId={selectedLayerId}
            resolutions={resolutions}
            onResolve={onResolve}
            onHoverDiff={onHoverDiff}
          />
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
            This merge item has no design page to compare.
          </div>
        )
      ) : tab === 'library' ? (
        <ComponentsTab selectedLayer={selectedLayer} onApply={onApplyComponent} onAdd={onAddComponent} onDrag={onDragComponent} onInsert={onInsertComponent} />
      ) : (
        <BlockAssembleTab
          selectedLayer={selectedLayer}
          frameWidth={frameWidth}
          assembly={assembly}
          onAssemble={onAssemble}
          onAssembleReset={onAssembleReset}
          driftEffect={driftEffect}
          textSlots={textSlots}
          onEditText={onEditText}
          diffs={designMergeVariants[item.id]?.layerDiffs?.[selectedLayerId]}
          tokenSpec={selectedLayer ? inspectorSpecsByType[selectedLayer.type] : null}
          resolutions={resolutions}
          onResolve={onResolve}
          onHoverDiff={onHoverDiff}
          selectedLayerName={selectedLayerName}
          appliedPresetId={appliedPresetId}
          onApplyPreset={onApplyPreset}
        />
      )}
      </>
      )}
    </div>
  )
}

export default BlockDeckPanel
