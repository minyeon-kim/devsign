import { useState } from 'react'
import { Check, Circle, Component, Copy, Frame, Group, Type } from 'lucide-react'
import { cn } from 'cn'
import { findCanvasTarget, inspectorSpecsByType } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'

const kindIcons = {
  frame: Frame,
  component: Component,
  group: Group,
  vector: Circle,
  text: Type,
}

// Same hover-revealed row action as Explorer/Layers — no button chrome,
// only the icon lightens on hover, with a small tooltip below it. `show`
// keeps it visible past hover (used here for the CSS block's Copy → Check
// swap after a click).
function RowAction({ icon: Icon, label, show, onClick }) {
  return (
    <span className="group/tip relative flex">
      <button
        type="button"
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation()
          onClick()
        }}
        className={cn(
          'flex items-center justify-center p-0.5 text-slate-500 hover:text-foreground',
          show ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100'
        )}
      >
        <Icon className="size-3.5" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute top-[calc(100%+5px)] left-1/2 z-[100] -translate-x-1/2 whitespace-nowrap rounded-md border border-[color:var(--ds-border-subtle)] bg-[#121212] px-2 py-1 text-[11px] text-[#FAFAFA] opacity-0 shadow-lg transition-opacity duration-75 group-hover/tip:opacity-100"
      >
        {label}
      </span>
    </span>
  )
}

function SpecRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-[10px] text-slate-500">{label}</span>
      <span className="truncate text-slate-200">{value}</span>
    </div>
  )
}

function SectionLabel({ children }) {
  return <div className="mb-1.5 flex h-5 items-center text-[11px] font-medium text-slate-300">{children}</div>
}

// The Files/Layers/Assets navigator's Dev-Mode-style Inspect view: the
// canvas's current selection (a frame or a layer — findCanvasTarget
// resolves either), read straight off `inspectorSpecsByType`'s per-type
// mock spec (layout, fill, stroke, typography, a ready CSS block). Not
// wired to the Assemble tab's live overrides — this mirrors the design
// system's default spec for the element's type, same as the original
// Inspector drawer this replaces.
function InspectPanel() {
  const { selectedLayerId } = useWorkspace()
  const [copied, setCopied] = useState(false)
  const target = selectedLayerId ? findCanvasTarget(selectedLayerId) : null

  if (!target) {
    return (
      <div className="flex h-full flex-col bg-card text-xs text-muted-foreground">
        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <p className="text-[11px] leading-relaxed text-slate-500">
            Select an element on the canvas to inspect its layout, style and CSS.
          </p>
        </div>
      </div>
    )
  }

  const { frame, layer } = target
  const node = layer ?? frame
  const specType = layer ? layer.type : frame.kind
  const spec = inspectorSpecsByType[specType]
  const Icon = kindIcons[node.kind] ?? Group

  function copyCss() {
    if (!spec) return
    navigator.clipboard?.writeText(spec.css)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex h-full flex-col bg-card text-xs text-muted-foreground">
      <div className="scroll-fade-bottom min-h-0 flex-1 overflow-auto">
        <div className="space-y-4 px-3 pt-2.5 pb-3">
          <div className="flex items-center gap-2">
            <Icon className="size-3.5 shrink-0 text-emerald-300" />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-slate-100">{node.name}</p>
              <p className="text-[10px] text-slate-500 capitalize">{node.kind}</p>
            </div>
          </div>

          {!spec ? (
            <p className="text-[11px] leading-relaxed text-slate-500">No design spec for this element type yet.</p>
          ) : (
            <>
              <div>
                <SectionLabel>Design tokens</SectionLabel>
                <div className="space-y-1">
                  <SpecRow label="Fill token" value={spec.fill.token} />
                  <SpecRow label="Radius" value="var(--radius)" />
                </div>
              </div>

              <div>
                <SectionLabel>Layout</SectionLabel>
                <div className="space-y-1">
                  <SpecRow label="Direction" value={spec.layout.mode} />
                  <SpecRow label="Padding" value={spec.layout.padding} />
                  <SpecRow label="Gap" value={spec.layout.gap} />
                  <SpecRow label="Align" value={spec.layout.align} />
                  <SpecRow label="Size" value={`${node.width} × ${node.height}`} />
                  <SpecRow label="Position" value={`x${node.x}, y${node.y}`} />
                </div>
              </div>

              <div>
                <SectionLabel>Style</SectionLabel>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-[10px] text-slate-500">Fill</span>
                    <span className="flex items-center gap-1.5 text-slate-200">
                      <span className="size-3 rounded-sm border border-white/10" style={{ background: spec.fill.color }} />
                      {spec.fill.color}
                    </span>
                  </div>
                  <SpecRow
                    label="Stroke"
                    value={spec.stroke.color === 'none' ? 'None' : `${spec.stroke.color} · ${spec.stroke.width}px`}
                  />
                  {spec.typography && (
                    <SpecRow label="Typography" value={`${spec.typography.font} ${spec.typography.size}/${spec.typography.weight}`} />
                  )}
                </div>
              </div>

              <div className="group/row">
                <div className="mb-1.5 flex h-5 items-center justify-between">
                  <span className="text-xs font-medium text-slate-300">CSS</span>
                  <RowAction icon={copied ? Check : Copy} label={copied ? 'Copied' : 'Copy CSS'} show={copied} onClick={copyCss} />
                </div>
                <pre className="overflow-auto rounded-md border border-white/10 bg-black/30 p-2 font-mono text-[10px] leading-relaxed whitespace-pre-wrap break-words text-slate-300">
                  {spec.css}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default InspectPanel
