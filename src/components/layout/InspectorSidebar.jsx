import { useState } from 'react'
import { Check, Copy, ScanEye, X } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { canvasFrames, inspectorSpecsByType } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'

function findSelectable(layerId) {
  for (const frame of canvasFrames) {
    if (frame.id === layerId) {
      return {
        name: frame.name,
        type: frame.kind,
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height,
      }
    }
    const layer = frame.layers.find((l) => l.id === layerId)
    if (layer) {
      return {
        name: layer.name,
        type: layer.type,
        x: layer.x,
        y: layer.y,
        width: layer.width,
        height: layer.height,
      }
    }
  }
  return null
}

function SpecRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  )
}

function InspectorSidebar() {
  const { inspectorOpen, setInspectorOpen, selectedLayerId } = useWorkspace()
  const [copied, setCopied] = useState(false)

  if (!inspectorOpen) return null

  const selected = selectedLayerId ? findSelectable(selectedLayerId) : null
  const spec = selected ? inspectorSpecsByType[selected.type] : null

  function copyCss() {
    if (!spec) return
    navigator.clipboard?.writeText(spec.css)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="animate-in absolute inset-y-0 right-0 z-40 flex w-80 flex-col border-l bg-card shadow-2xl slide-in-from-right duration-200">
      <div className="flex h-11 shrink-0 items-center justify-between border-b px-3">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <ScanEye className="size-3.5 text-primary" />
          Inspect
        </div>
        <Button variant="ghost" size="icon-sm" onClick={() => setInspectorOpen(false)}>
          <X className="size-3.5" />
        </Button>
      </div>

      {!selected ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-muted-foreground">
          Select a frame or shape on the Canvas to inspect its design spec.
        </div>
      ) : (
        <div className="flex-1 space-y-5 overflow-auto p-3">
          <div>
            <p className="text-sm font-medium">{selected.name}</p>
            <p className="text-[11px] text-muted-foreground capitalize">{selected.type}</p>
          </div>

          <div className="space-y-1.5">
            <SectionTitle>Design tokens</SectionTitle>
            <SpecRow label="Fill token" value={spec.fill.token} />
            <SpecRow label="Radius" value="var(--radius)" />
          </div>

          <div className="space-y-1.5">
            <SectionTitle>Layout (Auto Layout)</SectionTitle>
            <SpecRow label="Direction" value={spec.layout.mode} />
            <SpecRow label="Padding" value={spec.layout.padding} />
            <SpecRow label="Gap" value={spec.layout.gap} />
            <SpecRow label="Align" value={spec.layout.align} />
            <SpecRow label="Size" value={`${selected.width} × ${selected.height}`} />
            <SpecRow label="Position" value={`x${selected.x}, y${selected.y}`} />
          </div>

          <div className="space-y-1.5">
            <SectionTitle>Style</SectionTitle>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Fill</span>
              <span className="flex items-center gap-1.5 text-foreground">
                <span
                  className="size-3 rounded-sm border border-border"
                  style={{ background: spec.fill.color }}
                />
                {spec.fill.color}
              </span>
            </div>
            <SpecRow
              label="Stroke"
              value={spec.stroke.color === 'none' ? 'None' : `${spec.stroke.color} · ${spec.stroke.width}px`}
            />
            {spec.typography && (
              <SpecRow
                label="Typography"
                value={`${spec.typography.font} ${spec.typography.size}/${spec.typography.weight}`}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <SectionTitle>CSS</SectionTitle>
              <button
                type="button"
                onClick={copyCss}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre
              className={cn(
                'overflow-auto rounded-md border bg-background p-2 font-mono text-[11px] leading-relaxed text-foreground/80'
              )}
            >
              {spec.css}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

export default InspectorSidebar
