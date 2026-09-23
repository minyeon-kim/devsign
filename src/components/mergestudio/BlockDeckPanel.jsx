import { useEffect, useRef, useState } from 'react'
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
  Columns3,
  Library,
  Search,
  MousePointerClick,
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
import { FLOATING_PANEL } from '@/components/mergestudio/floatingStyles'

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

  const option = (side, value, cls, title) => (
    <button
      type="button"
      title={title}
      onClick={() => onResolve(diff.id, side)}
      onPointerEnter={() => onHover(diff.id, side)}
      onPointerLeave={() => onHover(null)}
      className={cn(
        'flex min-w-0 flex-1 items-center justify-center gap-1 rounded-full px-1.5 py-1 text-[11px] font-medium whitespace-nowrap transition-colors',
        resolution === side ? 'bg-indigo-500 text-white shadow-sm' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
      )}
    >
      {cls && <span className={cn('size-2 shrink-0 rounded-full', cls)} />}
      <span className="truncate">{value}</span>
    </button>
  )

  return (
    <div className="rounded-lg bg-slate-800/60 px-2 py-1.5">
      <div className="flex items-center gap-1.5">
        <span className="w-[74px] shrink-0 truncate text-[11px] text-muted-foreground" title={diff.label}>
          {diff.label}
        </span>
        <div className={cn('flex min-w-0 flex-1 items-center rounded-full bg-slate-950/60 p-0.5 ring-1', custom != null ? 'ring-white/5 opacity-60' : 'ring-white/10')}>
          {option('A', diff.optionA, diff.optionAClass, 'Keep Original Design')}
          <ArrowRight className="size-2.5 shrink-0 text-muted-foreground/60" />
          {option('B', diff.optionB, diff.optionBClass, 'Take Current Implementation')}
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
            editing || custom != null ? 'bg-violet-500/20 text-violet-300' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
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
          className="mt-1.5 ml-[80px] h-7 w-[calc(100%-80px)] rounded-full border border-violet-500/60 bg-slate-950/60 px-3 text-[11px] text-foreground outline-none placeholder:text-muted-foreground"
        />
      ) : (
        custom != null && (
          <div className="mt-1.5 ml-[80px] flex h-6 items-center gap-1.5 rounded-full bg-violet-500/15 pr-1 pl-2.5 text-[11px] text-violet-200">
            <span className="shrink-0 text-[10px] font-semibold tracking-wide text-violet-300/80 uppercase">Custom</span>
            <span className="min-w-0 flex-1 truncate font-medium">{custom}</span>
            <button
              type="button"
              title="Clear custom value"
              onClick={() => onResolve(diff.id, null)}
              className="flex size-4 shrink-0 items-center justify-center rounded-full text-violet-300 hover:bg-violet-500/25"
            >
              <X className="size-3" />
            </button>
          </div>
        )
      )}
    </div>
  )
}

// Inline editor for a code drift's merged line — synced with the code
// window, so an edit in either place shows up in both immediately (callers
// key it by the manual text so an edit made elsewhere resets the draft).
function CodeDriftEditor({ original, incoming, manual, onEdit }) {
  const value = manual ?? incoming ?? original
  const [draft, setDraft] = useState(value)
  const cancelRef = useRef(false)

  function commit() {
    if (cancelRef.current) {
      cancelRef.current = false
      setDraft(value)
      return
    }
    if (draft === value) return
    onEdit(draft === (incoming ?? original) ? null : draft)
  }

  return (
    <div className="rounded-xl border border-white/10 bg-slate-800/70 p-3.5">
      <div className="grid grid-cols-[5.5rem_1fr] items-start gap-x-2 gap-y-1.5 text-xs">
        <span className="pt-1 text-muted-foreground">Original</span>
        <p className="rounded-md bg-destructive/10 px-2 py-1 font-mono text-[11px] break-words text-destructive/90">{original || ' '}</p>
        <span className="pt-1 text-muted-foreground">Current</span>
        <textarea
          value={draft}
          rows={Math.min(4, Math.max(1, Math.ceil(draft.length / 34)))}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value.replace(/\n/g, ' '))}
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
            'resize-none rounded-md px-2 py-1 font-mono text-[11px] break-words outline-none focus:ring-1 focus:ring-violet-500',
            manual != null ? 'bg-violet-500/10 text-violet-200' : 'bg-emerald-500/10 text-emerald-400'
          )}
        />
      </div>
      <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
        <Pencil className="size-3 text-violet-400" />
        {manual != null ? (
          <>
            Edited by hand ·{' '}
            <button type="button" onClick={() => onEdit(null)} className="font-medium text-violet-300 hover:underline">
              Revert
            </button>
          </>
        ) : (
          'Edit the current line directly — it syncs to the code window.'
        )}
      </p>
    </div>
  )
}

// ---- Modular builder controls (shared by Block Assemble and the manual
// fallback in Variant Compare) ---------------------------------------
function Seg({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            'rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
            value === id
              ? 'bg-slate-700 text-white'
              : 'bg-slate-800/70 text-muted-foreground hover:text-foreground'
          )}
        >
          {label}
        </button>
      ))}
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

function InspectorSection({ title, action, children }) {
  return (
    <div className="space-y-2 border-t border-white/10 px-4 py-3">
      <div className="flex h-5 items-center justify-between">
        <p className="text-[11px] font-semibold text-foreground/90">{title}</p>
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
    <label
      title={title}
      className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-full bg-slate-900/80 pr-2.5 pl-2 ring-1 ring-white/10 transition-shadow focus-within:ring-violet-500"
    >
      <span onPointerDown={scrub} className="w-3.5 shrink-0 cursor-ew-resize text-center text-[10px] font-medium text-muted-foreground select-none">
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
        className="w-full min-w-0 bg-transparent text-[12px] text-foreground tabular-nums outline-none placeholder:text-muted-foreground/60"
      />
      {unit && <span className="shrink-0 text-[10px] text-muted-foreground">{unit}</span>}
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
      className={cn(
        'flex h-7 min-w-0 flex-1 items-center gap-2 rounded-full bg-slate-900/80 pr-2.5 pl-1 ring-1 transition-shadow focus-within:ring-violet-500',
        invalid ? 'ring-destructive/60' : 'ring-white/10'
      )}
    >
      <span className={cn('relative size-5 shrink-0 overflow-hidden rounded-full ring-1 ring-white/20', swatchClass)} style={swatchClass ? undefined : { background: swatchHex }}>
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
        className="w-full min-w-0 bg-transparent font-mono text-[11px] text-foreground uppercase outline-none placeholder:normal-case placeholder:font-sans placeholder:text-muted-foreground/60"
      />
    </div>
  )
}

function IconToggle({ active, title, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'flex h-7 flex-1 items-center justify-center rounded-full transition-colors',
        active ? 'bg-indigo-500 text-white' : 'bg-slate-900/80 text-muted-foreground ring-1 ring-white/10 hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}

// Figma's 3×3 alignment box: sets horizontal + vertical alignment at once.
function AlignGrid({ h, v, onChange }) {
  const axes = ['start', 'center', 'end']
  return (
    <div className="grid size-[76px] shrink-0 grid-cols-3 gap-0.5 rounded-xl bg-slate-900/80 p-1.5 ring-1 ring-white/10">
      {axes.map((vv) =>
        axes.map((hh) => {
          const active = h === hh && v === vv
          return (
            <button
              key={`${vv}-${hh}`}
              type="button"
              title={`Align ${vv === 'center' ? 'middle' : vv === 'start' ? 'top' : 'bottom'} ${hh === 'start' ? 'left' : hh === 'end' ? 'right' : 'center'}`}
              onClick={() => onChange({ align: hh, valign: vv })}
              className="group flex items-center justify-center rounded-md hover:bg-white/5"
            >
              <span className={cn('rounded-full transition-all', active ? 'h-2.5 w-1 bg-indigo-400' : 'size-1 bg-muted-foreground/40 group-hover:bg-muted-foreground')} />
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
          <div className="flex gap-2">
            <NumInput label="X" value={layer.x + (a.dx ?? 0)} title="X position" onChange={(x) => onChange({ dx: x - layer.x })} />
            <NumInput label="Y" value={layer.y + (a.dy ?? 0)} title="Y position" onChange={(y) => onChange({ dy: y - layer.y })} />
          </div>
          <div className="flex items-center gap-2">
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
              onClick={() => setLockRatio((v) => !v)}
              className={cn('flex size-7 shrink-0 items-center justify-center rounded-full transition-colors', lockRatio ? 'bg-indigo-500/20 text-indigo-300' : 'text-muted-foreground hover:bg-white/5')}
            >
              {lockRatio ? <Link2 className="size-3.5" /> : <Link2Off className="size-3.5" />}
            </button>
          </div>
        </InspectorSection>
      )}

      {has('autolayout') && AUTO_LAYOUT_TYPES.has(layer.type) && (
        <InspectorSection title="Auto layout">
          <div className="flex gap-3">
            <AlignGrid h={a.align ?? d.align ?? 'center'} v={a.valign ?? d.valign ?? 'center'} onChange={onChange} />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex gap-1.5">
                <IconToggle active={direction === 'row'} title="Horizontal" onClick={() => onChange({ direction: 'row' })}>
                  <ArrowRight className="size-3.5" />
                </IconToggle>
                <IconToggle active={direction === 'column'} title="Vertical" onClick={() => onChange({ direction: 'column' })}>
                  <ArrowDown className="size-3.5" />
                </IconToggle>
              </div>
              <NumInput label={<BetweenHorizontalStart className="size-3" />} value={a.gap} placeholder={d.gap} title="Gap between items" min={0} onChange={(gap) => onChange({ gap })} />
            </div>
          </div>
          <div className="flex gap-2">
            <NumInput label={<MoveHorizontal className="size-3" />} value={a.padX} placeholder={d.padX} title="Horizontal padding" min={0} onChange={(padX) => onChange({ padX })} />
            <NumInput label={<MoveVertical className="size-3" />} value={a.padY} placeholder={d.padY} title="Vertical padding" min={0} onChange={(padY) => onChange({ padY })} />
          </div>
        </InspectorSection>
      )}

      {has('appearance') && (
        <InspectorSection title="Appearance">
          <div className="flex gap-2">
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
          <div className="flex gap-1.5">
            {[
              ['Square', 0, Square],
              ['Rounded', 12, RectangleHorizontal],
              ['Pill', 999, Circle],
            ].map(([label, r, Icon]) => (
              <IconToggle key={label} active={(a.radius ?? shapeRadius) === r} title={`${label} corners (${r}px)`} onClick={() => onChange({ radius: r })}>
                <Icon className="size-3" />
                <span className="ml-1 text-[10px]">{label}</span>
              </IconToggle>
            ))}
          </div>
        </InspectorSection>
      )}

      {has('fill') && (
        <InspectorSection
          title="Fill"
          action={
            (a.fill || a.fillColor) && (
              <button type="button" title="Remove fill override" onClick={() => onChange({ fill: undefined, fillColor: undefined })} className="flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-white/5 hover:text-foreground">
                <Minus className="size-3" />
              </button>
            )
          }
        >
          <ColorField
            value={a.fillColor ?? fillToken?.token}
            swatchHex={a.fillColor ?? fillToken?.hex}
            swatchClass={!a.fillColor && fillToken ? fillToken.swatch : undefined}
            placeholder={`${d.fill ?? 'Default'} · HEX or token`}
            onHex={(fillColor) => onChange({ fillColor, fill: undefined })}
            onToken={(f) => onChange({ fill: f.id, fillColor: undefined })}
            onClear={() => onChange({ fill: undefined, fillColor: undefined })}
          />
          <div className="flex flex-wrap gap-1.5">
            {ASSEMBLY_FILLS.map((f) => (
              <button
                key={f.id}
                type="button"
                title={`${f.label} · ${f.token}`}
                onClick={() => onChange({ fill: f.id, fillColor: undefined })}
                className={cn('size-5 rounded-full transition-transform hover:scale-110', f.swatch, a.fill === f.id && !a.fillColor && 'ring-2 ring-white ring-offset-1 ring-offset-slate-900')}
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
              className="flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-white/5 hover:text-foreground"
            >
              {a.stroke ? <Minus className="size-3" /> : <Plus className="size-3" />}
            </button>
          }
        >
          {a.stroke ? (
            <div className="flex gap-2">
              <ColorField
                value={a.stroke.color}
                swatchHex={a.stroke.color}
                placeholder="HEX or token"
                onHex={(color) => onChange({ stroke: { ...a.stroke, color } })}
                onToken={(f) => onChange({ stroke: { ...a.stroke, color: f.hex } })}
              />
              <div className="w-[76px] shrink-0">
                <NumInput label="W" value={a.stroke.width} min={0} max={24} title="Stroke width" onChange={(width) => onChange({ stroke: { ...a.stroke, width } })} />
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground/70">No stroke</p>
          )}
        </InspectorSection>
      )}

      {has('effects') && (
        <InspectorSection title="Effects">
          <div className="flex gap-1.5">
            {[['none', 'None'], ['soft', 'Drop shadow'], ['glow', 'Glow']].map(([id, label]) => (
              <IconToggle key={id} active={(a.shadow ?? 'none') === id} title={label} onClick={() => onChange({ shadow: id })}>
                <span className="text-[10px]">{label}</span>
              </IconToggle>
            ))}
          </div>
          {['button', 'chip'].includes(layer.type) && (
            <div className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-[10px] text-muted-foreground">Icon</span>
              {[['none', 'None'], ['left', 'Leading'], ['right', 'Trailing']].map(([id, label]) => (
                <IconToggle key={id} active={(a.icon ?? 'none') === id} title={`${label} icon`} onClick={() => onChange({ icon: id === 'none' ? null : id })}>
                  <span className="text-[10px]">{label}</span>
                </IconToggle>
              ))}
            </div>
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
    <div className="border-b border-white/10 pb-1">
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <Blocks className="size-4 text-indigo-500" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{layer.name}</span>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-muted-foreground capitalize">{layer.type}</span>
        <button
          type="button"
          onClick={onReset}
          disabled={!assembly}
          className="rounded-full px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          Reset
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 px-4 pb-3">
        {blockTemplates(layer, frameWidth).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.patch)}
            className="shrink-0 rounded-full border border-indigo-500/40 px-2.5 py-1 text-[11px] font-medium whitespace-nowrap text-foreground transition-colors hover:bg-indigo-500/15"
          >
            {t.label}
          </button>
        ))}
      </div>
      <PrecisionInspector layer={layer} assembly={assembly} driftEffect={driftEffect} onChange={onChange} />
    </div>
  )
}

// For elements with no parseable design-system options: an AI
// recommendation (one-click apply) beside plain manual controls.
function ManualFallback({ layer, assembly, onChange }) {
  const rec = recommendAssembly(layer)
  const a = assembly ?? {}
  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-slate-800/70 p-3.5">
      <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">No design tokens found</p>
      <div className="rounded-xl border border-indigo-500/40 bg-gradient-to-r from-indigo-500/10 to-violet-500/10 p-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Sparkles className="size-3.5 text-violet-500" />
          AI recommends
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{rec.rationale}</p>
        <button
          type="button"
          onClick={() => onChange(rec.patch)}
          className="mt-2.5 flex items-center gap-1.5 rounded-full bg-slate-700 text-foreground hover:bg-slate-600 px-3.5 py-1.5 text-xs font-semibold transition-colors"
        >
          <Wand2 className="size-3.5" />
          Apply recommendation
        </button>
      </div>
      <p className="text-xs text-muted-foreground">Or set it precisely:</p>
      <div className="-mx-3.5 -mb-3.5">
        <PrecisionInspector layer={layer} assembly={a} onChange={onChange} sections={['layout', 'appearance', 'fill']} />
      </div>
    </div>
  )
}

// What used to be MergeCanvasCompare's own docked "Variant Inspector"
// column — now a tab inside the floating Block Deck instead of a fixed
// sidebar next to the artboards, so it can float freely like the rest of
// the deck. Still entirely selection-driven: reacts to whichever layer was
// last clicked on either artboard on the infinite canvas.
// Every drift for this item (design + code, via the same `buildDrifts` the
// canvas's own < > pager and the merge wizard's Check step use), as an
// accordion: one row open at a time, its detail (A/B pills for a design
// drift, current/incoming for a code drift) expanding in place while every
// other row collapses back to its summary line — so reviewing one drift
// never leaves a wall of everyone else's detail on screen too. Opening a
// row also jumps/selects it on the canvas, exactly like the canvas's own
// drift navigator. Consolidated here so the Compare tab is the one place
// to both see drift history and review each one's detail.
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

// A clean pill tag per row — matching the Merge List sidebar's own
// High/Medium/Low conflict badge exactly (`conflictBadgeClass` in
// MergeListSidebar.jsx) — instead of tinting the whole row's background.
const SEVERITY_TAG_CLASS = {
  high: 'bg-destructive/15 text-destructive',
  medium: 'bg-amber-500/15 text-amber-500',
  low: 'bg-sky-500/15 text-sky-500',
}

function DriftHistoryAccordion({ item, frame, resolutions, manualCode, onEditCode, onResolve, onHoverDiff, expandedId, onExpand }) {
  const { requestMergeFocus, getFileLines } = useWorkspace()
  const drifts = buildDrifts(item, frame)
  if (!drifts.length) return null

  function toggle(d) {
    const opening = expandedId !== d.id
    onExpand(opening ? d.id : null)
    if (opening) {
      requestMergeFocus({
        itemId: item.id,
        keepDeck: true,
        label: d.label,
        ...(d.kind === 'design' ? { layerId: d.layerId } : { fileId: d.fileId, line: d.line }),
      })
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Detected Drifts · {drifts.length}</p>
      {drifts.map((d) => {
        const resolved = d.kind === 'design' && d.diffs.every((diff) => resolutions[`${d.layerId}:${diff.id}`])
        const open = expandedId === d.id
        const original = d.kind === 'code' ? (getFileLines(d.fileId)[d.line - 1] ?? '') : null
        const incoming = d.kind === 'code' ? codeMergeVariants[item.id]?.[d.fileId]?.find((x) => x.line === d.line)?.incoming : null
        return (
          <div
            key={d.id}
            className={cn(
              'overflow-hidden rounded-xl border transition-colors',
              // The active/open row gets an unmissable primary ring on top
              // of its own tinted surface — not just a border color change
              // — so it's obvious at a glance which one you're reviewing.
              // Closed rows stay on the same plain surface as before; the
              // severity tag (not a row-wide tint) carries that signal now.
              open ? 'border-primary/50 bg-primary/10 ring-1 ring-inset ring-primary/30' : 'border-white/10 bg-slate-800/70'
            )}
          >
            <button
              type="button"
              onClick={() => toggle(d)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-white/5"
            >
              {/* No expand chevron — the whole row is the toggle, and the
                  open row's ring/tint already shows which one is expanded.
                  Severity first, in a fixed-width column so every row's pill
                  lines up for top-to-bottom priority scanning; then the label
                  (`Nav Bar · 1 change` / `File.tsx · line 12`), then the
                  checkmark on the far right. */}
              <span className={cn('w-[58px] shrink-0 rounded-full py-0.5 text-center text-[11px] font-medium', SEVERITY_TAG_CLASS[severityOf(d)])}>
                {severityOf(d) === 'high' ? 'High' : severityOf(d) === 'medium' ? 'Medium' : 'Low'}
              </span>
              <span className={cn('min-w-0 flex-1 truncate', open ? 'font-semibold text-foreground' : 'text-foreground')}>{d.label}</span>
              <span
                className={cn(
                  'flex size-4 shrink-0 items-center justify-center rounded-full',
                  resolved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-muted-foreground'
                )}
              >
                {resolved && <Check className="size-2.5" />}
              </span>
            </button>

            {open && (
              <div className="space-y-1 border-t border-white/10 px-2 py-2">
                {d.kind === 'design' ? (
                  d.diffs.map((diff) => (
                    <DiffRow
                      key={`${diff.id}:${JSON.stringify(resolutions[`${d.layerId}:${diff.id}`] ?? null)}`}
                      diff={diff}
                      resolution={resolutions[`${d.layerId}:${diff.id}`]}
                      onResolve={(diffId, side) => onResolve(d.layerId, diffId, side)}
                      onHover={(diffId, side) => onHoverDiff(diffId ? { layerId: d.layerId, diffId, side } : null)}
                    />
                  ))
                ) : (
                  <CodeDriftEditor
                    key={manualCode?.[`${d.fileId}:${d.line}`] ?? ''}
                    original={original}
                    incoming={incoming}
                    manual={manualCode?.[`${d.fileId}:${d.line}`]}
                    onEdit={(text) => onEditCode?.(d.fileId, d.line, text)}
                  />
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
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
          'w-full resize-none rounded-lg border bg-slate-900/80 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-emerald-400',
          slot.current !== slot.value ? 'border-violet-500/60' : 'border-white/10'
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
    <div className="rounded-xl border border-white/10 bg-slate-800/70 p-3.5">
      <div className="mb-2 flex items-center gap-2">
        <Type className="size-3.5 text-indigo-400" />
        <p className="flex-1 text-sm font-semibold text-foreground">Text</p>
        {edited ? (
          <button
            type="button"
            onClick={() => slots.forEach((s) => s.current !== s.value && onEditText(s.layerId, s.slot, s.value))}
            className="rounded-full px-2 py-0.5 text-[11px] font-medium text-violet-300 hover:bg-violet-500/15"
          >
            Reset
          </button>
        ) : (
          <span className="text-[11px] text-muted-foreground">Synced to copy.json</span>
        )}
      </div>
      <div className="space-y-2.5">
        {slots.map((slot) => (
          <TextSlotField key={slot.key} slot={slot} onEditText={onEditText} />
        ))}
      </div>
    </div>
  )
}

function VariantCompareTab({ item, selectedLayerId, resolutions, manualCode, onEditCode, onResolve, onHoverDiff, assembly, onAssemble }) {
  const page = canvasPages.find((p) => p.id === item.designPageId)
  const frame = frameWithLayers(page?.frames[0])
  const selectedLayer = frame?.layers.find((l) => l.id === selectedLayerId)
  const specificDiffs = designMergeVariants[item.id]?.layerDiffs?.[selectedLayerId]
  const tokenSpec = selectedLayer ? inspectorSpecsByType[selectedLayer.type] : null

  // Which drift row the accordion has open — defaults to whichever design
  // drift matches the canvas's current selection, so clicking a layer on
  // the canvas still opens its detail here automatically; the user can
  // then expand any other row instead, same as clicking one directly.
  const [expandedId, setExpandedId] = useState(selectedLayerId ? `d:${selectedLayerId}` : null)
  useEffect(() => {
    if (selectedLayerId && designMergeVariants[item.id]?.layerDiffs?.[selectedLayerId]) {
      setExpandedId(`d:${selectedLayerId}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLayerId])

  const resolvedCount = specificDiffs?.filter((d) => resolutions[`${selectedLayerId}:${d.id}`]).length ?? 0

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="shrink-0 px-4 pt-3 text-xs text-muted-foreground">
        {selectedLayer && specificDiffs ? `${resolvedCount} of ${specificDiffs.length} resolved` : 'Nothing selected'}
      </p>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
        <DriftHistoryAccordion
          item={item}
          frame={frame}
          resolutions={resolutions}
          manualCode={manualCode}
          onEditCode={onEditCode}
          onResolve={onResolve}
          onHoverDiff={onHoverDiff}
          expandedId={expandedId}
          onExpand={setExpandedId}
        />

        {!selectedLayer && (
          <div className="flex flex-col items-center gap-2 p-3 text-center">
            <MousePointerClick className="size-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Select an element, frame, or component on the canvas — or a drift above — to inspect it.
            </p>
          </div>
        )}

        {selectedLayer && !specificDiffs && tokenSpec && (
          <div className="rounded-xl border border-white/10 bg-slate-800/70 p-3.5">
            <p className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Token Binding
            </p>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Fill</span>
                <span className="flex items-center gap-1.5 text-foreground">
                  <span
                    className="size-3 rounded-sm border border-border"
                    style={{ background: tokenSpec.fill.color }}
                  />
                  {tokenSpec.fill.token}
                </span>
              </div>
              {tokenSpec.typography && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="text-foreground">
                    {tokenSpec.typography.font} {tokenSpec.typography.size}/{tokenSpec.typography.weight}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Layout</span>
                <span className="text-foreground">{tokenSpec.layout.mode}</span>
              </div>
            </div>
          </div>
        )}

        {selectedLayer && !specificDiffs && (
          <ManualFallback layer={selectedLayer} assembly={assembly} onChange={onAssemble} />
        )}
      </div>
    </div>
  )
}

// A single AI-generated style suggestion — badge, preview swatch, rationale
// copy explaining why the (mock) model picked it, and its own dismiss
// button so an unsatisfactory suggestion can be cleared without affecting
// the rest of the list.
function AiSuggestionCard({ preset, applied, onApply, onDelete }) {
  return (
    <div
      className={cn(
        'group relative rounded-xl border p-3.5 text-left transition-colors',
        applied ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/60'
      )}
    >
      <button type="button" onClick={() => onApply(preset)} className="flex w-full items-start gap-3 text-left">
        <span className={cn('size-9 shrink-0 rounded-full', preset.previewClass)} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{preset.label}</span>
            <span className="flex items-center gap-0.5 rounded-full bg-indigo-500/15 text-indigo-400 px-2 py-0.5 text-[10px] font-semibold">
              <Sparkles className="size-3" />
              AI
            </span>
            {applied && <Check className="ml-auto size-4 shrink-0 text-primary" />}
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
      <p className="shrink-0 px-4 pt-3 text-xs text-muted-foreground">
        {selectedLayerName ? (
          <>
            Suggestions for <span className="font-medium text-foreground">{selectedLayerName}</span>
          </>
        ) : (
          'Select a canvas element to preview suggestions on it'
        )}
      </p>

      <div className="space-y-3 p-4">
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

      <div className="shrink-0 border-t border-white/10 p-4">
        <button
          type="button"
          onClick={generateAlternatives}
          disabled={!hasMore}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-primary/40 px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Wand2 className="size-4" />
          {hasMore ? 'Generate alternatives' : 'No more alternatives'}
        </button>
      </div>
    </div>
  )
}

// Block Assemble: structural builder for the selected element, then the AI
// style suggestions below it.
// Assemble is where an element is composed: its content copy first (the
// Text card, bound to copy.json), then its shape / size / style.
function BlockAssembleTab({ selectedLayer, frameWidth, assembly, driftEffect, onAssemble, onAssembleReset, textSlots, onEditText, ...suggestionProps }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {textSlots?.length > 0 && (
        <div className="border-b border-white/10 p-4">
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
        <p className="border-b border-white/10 p-5 text-center text-sm text-muted-foreground">
          Select an element on the canvas to assemble its shape, size and layout.
        </p>
      )}
      <AiSuggestionsSection {...suggestionProps} />
    </div>
  )
}

// Design System library: browse the integrated component library, then
// either restyle the selected element with a component ("Apply") or pull
// a fresh instance onto both artboards ("Add").
function ComponentPreview({ def }) {
  const box = { w: 124, h: 58 }
  const k = Math.min(1, box.w / def.width, box.h / def.height)
  const layer = { id: def.id, type: def.type, label: def.label, x: 0, y: 0, width: def.width, height: def.height }
  const override = { ...assemblyToOverride(def.assembly, layer), static: true }
  return (
    <div className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-slate-200" style={{ width: box.w + 12, height: box.h + 12 }}>
      <div className="relative" style={{ width: def.width * k, height: def.height * k }}>
        <div className="absolute top-0 left-0" style={{ width: def.width, height: def.height, transform: `scale(${k})`, transformOrigin: 'top left' }}>
          <StaticLayer layer={layer} override={override} onSelect={() => {}} />
        </div>
      </div>
    </div>
  )
}

function ComponentsTab({ selectedLayer, onApply, onAdd, onInsert }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [showAll, setShowAll] = useState(false)
  // Contextual: with an element selected, only components that can replace
  // it or be inserted into it are listed (unless "Show all" is on).
  const compat = selectedLayer ? libraryCompat(selectedLayer) : null
  const modeOf = (def) => (!compat ? null : compat.replace.has(def.type) ? 'replace' : compat.insert.has(def.type) ? 'insert' : null)
  const pool = designSystemComponents.filter((c) => showAll || !compat || modeOf(c))
  const categories = ['All', ...new Set(pool.map((c) => c.category))]
  const visible = pool.filter(
    (c) => (category === 'All' || c.category === category) && c.name.toLowerCase().includes(query.trim().toLowerCase())
  )
  const activeCategory = categories.includes(category) ? category : 'All'

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="space-y-3 border-b border-white/10 px-4 pt-3 pb-4">
        <div className="flex items-center gap-2 text-sm">
          <Library className="size-4 text-indigo-500" />
          <span className="font-semibold text-foreground">{designSystemMeta.name}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{designSystemMeta.version}</span>
          <span className="ml-auto flex items-center gap-1 text-xs text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            {designSystemMeta.syncedLabel}
          </span>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search components…"
            className="h-9 w-full rounded-full border border-white/10 bg-slate-800/70 pr-3 pl-8 text-sm outline-none focus:border-violet-500"
          />
        </div>
        <Seg options={categories.map((c) => [c, c])} value={activeCategory} onChange={setCategory} />

        {selectedLayer ? (
          <div className="flex items-start gap-2.5 rounded-xl bg-indigo-500/10 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            <span className="min-w-0 flex-1">
              {showAll ? 'Showing every component.' : `${pool.length} component${pool.length === 1 ? '' : 's'} fit`}{' '}
              <span className="font-medium text-foreground">{selectedLayer.name}</span>
              {showAll ? '' : ' — replace it or insert into it.'}
            </span>
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="shrink-0 rounded-full border border-indigo-500/40 px-2.5 py-1 font-medium text-foreground hover:bg-indigo-500/15"
            >
              {showAll ? 'Only compatible' : 'Show all'}
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Select an element to see only the components that fit it, or Add one to the canvas.</p>
        )}
      </div>

      <div className="space-y-3 p-4">
        {visible.map((def) => {
          const mode = modeOf(def)
          return (
            <div key={def.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-800/70 p-3">
              <ComponentPreview def={def} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{def.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {mode === 'replace' ? `Replaces ${selectedLayer.name}` : mode === 'insert' ? `Inserts into ${selectedLayer.name}` : def.tokens.join(' · ')}
                </p>
                {/* Fixed 2-col grid instead of a flex row — "Replace"/"Insert"
                    and "Add" each get a stable half-width cell, so the
                    longer label never wraps or gets squeezed. Alone (no
                    mode), "Add" spans both columns. */}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {mode === 'replace' && (
                    <button
                      type="button"
                      onClick={() => onApply(def)}
                      className="w-full truncate rounded-full bg-slate-700 text-foreground hover:bg-slate-600 px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors"
                    >
                      Replace
                    </button>
                  )}
                  {mode === 'insert' && (
                    <button
                      type="button"
                      onClick={() => onInsert(def)}
                      className="w-full truncate rounded-full bg-slate-700 text-foreground hover:bg-slate-600 px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors"
                    >
                      Insert
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onAdd(def)}
                    className={cn(
                      'w-full truncate rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap',
                      !mode && 'col-span-2',
                      mode ? 'border border-indigo-500/50 text-foreground hover:bg-indigo-500/15' : 'bg-slate-700 text-foreground hover:bg-slate-600'
                    )}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )
        })}
        {visible.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">No components match.</p>}
      </div>
    </div>
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
  manualCode,
  onEditCode,
  onResolve,
  onHoverDiff,
  selectedLayer,
  frameWidth,
  assembly,
  onAssemble,
  onAssembleReset,
  onApplyComponent,
  onAddComponent,
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
        className="flex h-12 shrink-0 cursor-grab items-center gap-2 border-b border-white/10 px-4 active:cursor-grabbing"
      >
        <Blocks className="size-4 shrink-0 text-indigo-500" />
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
      {/* Segmented pill switcher — the active tab is a ghost pill (faint
          surface, hairline ring, bright text) rather than a solid color
          block, matching the Merge List's tabs. */}
      <div className="flex h-12 shrink-0 items-center gap-1.5 border-b border-white/10 px-2.5">
        <button
          type="button"
          onClick={() => switchTab('compare')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
            tab === 'compare' ? 'bg-white/[0.07] text-foreground ring-1 ring-inset ring-white/15' : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground'
          )}
        >
          <Columns3 className="size-3.5" />
          Compare
        </button>
        <button
          type="button"
          onClick={() => switchTab('assemble')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors',
            tab === 'assemble' ? 'bg-white/[0.07] text-foreground ring-1 ring-inset ring-white/15' : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground'
          )}
        >
          <Sparkles className="size-3.5" />
          Assemble
        </button>
        <button
          type="button"
          onClick={() => switchTab('library')}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors',
            tab === 'library' ? 'bg-white/[0.07] text-foreground ring-1 ring-inset ring-white/15' : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground'
          )}
        >
          <Library className="size-3.5" />
          Library
        </button>
      </div>
      {/* Library needs no intro line — its Design System header and search
          sit directly under the tabs. */}
      {tab !== 'library' && (
        <p className="shrink-0 border-b border-white/10 bg-slate-800/60 px-4 py-2 text-xs leading-snug text-muted-foreground">
          {tab === 'compare' && 'Compare visual drifts and style tokens: keep the Original Design, take the Current Implementation, or set your own value.'}
          {tab === 'assemble' && 'Edit the element’s copy and compose its shape, size and style — or accept an AI suggestion.'}
        </p>
      )}

      {tab === 'compare' ? (
        item.hasDesign ? (
          <VariantCompareTab
            item={item}
            selectedLayerId={selectedLayerId}
            resolutions={resolutions}
            manualCode={manualCode}
            onEditCode={onEditCode}
            onResolve={onResolve}
            onHoverDiff={onHoverDiff}
            assembly={assembly}
            onAssemble={onAssemble}
          />
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
            This merge item has no design page to compare.
          </div>
        )
      ) : tab === 'library' ? (
        <ComponentsTab selectedLayer={selectedLayer} onApply={onApplyComponent} onAdd={onAddComponent} onInsert={onInsertComponent} />
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
