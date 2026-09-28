import { useRef, useState } from 'react'
import {
  Check,
  CircleAlert,
  Code2,
  Eye,
  GitBranch,
  GitMerge,
  Info,
  Palette,
  Send,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import { cn } from 'cn'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { allPeople } from '@/data/mockData'
import { useWorkspaceOptional } from '@/state/WorkspaceProvider'
import RollbackHistoryList from '@/components/history/RollbackHistoryList'

// ─── The one conflict modal ────────────────────────────────────────────
// Every entry point — the activity bar's Conflicts drawer, the dashboard's
// "Active conflicts" widget, the /conflicts page and the workspace
// terminal's Conflict Point tab — opens this same component, so the
// options, tokens and behavior never drift apart. The two conflict data
// sources (the cross-project checklist and a workspace's detected
// conflict points) are normalized into one shape by the adapters below;
// sections whose data a conflict doesn't carry show an empty state rather
// than disappearing, so the layout is identical everywhere.

export const CONFLICT_STATUSES = ['Pending', 'In Review', 'Resolved']

export const STATUS_DOT_CLASS = {
  Pending: 'bg-muted-foreground/40',
  'In Review': 'bg-sky-400',
  Resolved: 'bg-primary',
}

// A workspace conflict's review stage ↔ the shared status vocabulary.
const STAGE_TO_STATUS = { detected: 'Pending', in_review: 'In Review', approved: 'In Review', resolved: 'Resolved' }
export const STATUS_TO_STAGE = { Pending: 'detected', 'In Review': 'in_review', Resolved: 'resolved' }

// A cross-project checklist item (conflictChecklist + its local status).
export function fromChecklistConflict(c) {
  return {
    ...c,
    title: c.token,
    description: c.message ?? `Design ↔ code conflict in ${c.projectName}.`,
    detectedAt: c.timestamp,
  }
}

// A workspace conflict point (WorkspaceProvider's `conflicts`).
export function fromWorkspaceConflict(c) {
  return {
    ...c,
    title: c.file,
    description: c.message,
    status: STAGE_TO_STATUS[c.reviewStage] ?? 'Pending',
  }
}

const severityConfig = {
  high: { label: 'High', icon: TriangleAlert, className: 'bg-destructive/15 text-destructive' },
  medium: { label: 'Medium', icon: CircleAlert, className: 'bg-amber-500/15 text-amber-500' },
  low: { label: 'Low', icon: Info, className: 'bg-sky-500/15 text-sky-500' },
}

const sectionLabelClass = 'text-[11px] font-semibold tracking-wide text-muted-foreground uppercase'

function EmptyNote({ children }) {
  return (
    <p className="rounded-xl border border-dashed px-3 py-6 text-center text-[11px] text-muted-foreground">
      {children}
    </p>
  )
}

function DiffBlock({ label, lines, tone }) {
  if (!lines?.length) return null
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <pre
        className={cn(
          'overflow-auto rounded-xl border p-2.5 font-mono text-[11px] leading-relaxed',
          tone === 'current'
            ? 'border-destructive/25 bg-destructive/5 text-destructive/90'
            : 'border-emerald-500/25 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
        )}
      >
        {lines.join('\n')}
      </pre>
    </div>
  )
}

// One side of the Expected (Design System) vs Current (Code) comparison —
// a small attribute table so the mismatch is scannable at a glance instead
// of buried in a code diff (that lives in the Diff tab).
function ComparisonCard({ label, tone, icon: Icon, fields }) {
  return (
    <div
      className={cn(
        'flex-1 space-y-2.5 rounded-xl border p-3',
        tone === 'expected' ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-destructive/25 bg-destructive/5'
      )}
    >
      <div
        className={cn(
          'flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase',
          tone === 'expected' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
        )}
      >
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="space-y-1.5">
        {fields.map((field) => (
          <div key={field.label} className="flex items-start justify-between gap-2 text-xs">
            <span className="shrink-0 text-muted-foreground">{field.label}</span>
            <span className="text-right font-medium text-foreground">{field.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function OverviewTab({ conflict, onPreview }) {
  const fields = conflict.comparisonFields ?? []

  return (
    <div className="space-y-4 p-4">
      {fields.length ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <ComparisonCard
            label="Expected · Design System"
            tone="expected"
            icon={Palette}
            fields={fields.map((f) => ({ label: f.label, value: f.expected }))}
          />
          <ComparisonCard
            label="Current · Code"
            tone="current"
            icon={Code2}
            fields={fields.map((f) => ({ label: f.label, value: f.current }))}
          />
        </div>
      ) : (
        <EmptyNote>No design ↔ code comparison captured for this conflict yet. Open Merge Studio to inspect it.</EmptyNote>
      )}

      {conflict.suggestion && (
        <div className="space-y-2.5 rounded-xl border border-primary/25 bg-primary/5 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-primary uppercase">
            <Sparkles className="size-3.5" />
            AI suggested change
          </div>
          <p className="text-xs leading-relaxed text-foreground/85">{conflict.suggestion}</p>
          {onPreview && (
            <Button type="button" size="sm" className="gap-1.5" onClick={onPreview}>
              <Eye className="size-3.5" />
              Preview change
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function DiffTab({ conflict }) {
  if (!conflict.branches && !conflict.diff) {
    return (
      <div className="p-4">
        <EmptyNote>No diff captured for this conflict yet.</EmptyNote>
      </div>
    )
  }

  return (
    <div className="space-y-3 p-4">
      {conflict.branches && (
        <div className="flex items-center gap-2 rounded-xl border bg-background p-2.5 text-xs">
          <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="font-medium text-foreground">{conflict.branches.local}</span>
          <span className="text-muted-foreground">vs</span>
          <span className="font-medium text-foreground">{conflict.branches.remote}</span>
        </div>
      )}
      {conflict.diff && (
        <>
          <DiffBlock label="Current (Code)" lines={conflict.diff.before} tone="current" />
          <DiffBlock label="Expected (Design System)" lines={conflict.diff.after} tone="expected" />
        </>
      )}
    </div>
  )
}

function StatusPicker({ status, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CONFLICT_STATUSES.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={status === option}
          onClick={() => onChange?.(option)}
          className={cn(
            'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            status === option
              ? 'border-transparent bg-foreground text-background'
              : 'border-border text-muted-foreground hover:text-foreground'
          )}
        >
          <span className={cn('size-1.5 rounded-full', STATUS_DOT_CLASS[option])} />
          {option}
        </button>
      ))}
    </div>
  )
}

function ReviewersList({ reviewers = [] }) {
  if (!reviewers.length) {
    return <p className="text-xs text-muted-foreground">No reviewers assigned.</p>
  }

  return (
    <div className="space-y-2">
      {reviewers.map((reviewer) => {
        const person = allPeople.find((p) => p.id === reviewer.id)
        if (!person) return null
        return (
          <div key={reviewer.id} className="flex items-center gap-2 text-xs">
            <Avatar size="sm">
              <AvatarFallback className={cn('text-[10px] font-medium text-white', person.colorClass)}>
                {person.initials}
              </AvatarFallback>
            </Avatar>
            <span className="flex-1 truncate font-medium text-foreground">{person.name}</span>
            {reviewer.status === 'approved' ? (
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-500">
                <Check className="size-3" />
                Approved
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground">Pending</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Comments live in a project's workspace; outside one (dashboard, the
// global conflict list) the thread says where to find it instead.
function CommentThread({ conflict, workspace }) {
  const [draft, setDraft] = useState('')

  if (!workspace) {
    return <p className="text-xs text-muted-foreground">Open the project's workspace to see and reply to its thread.</p>
  }

  const linked = workspace.comments.filter((c) => c.id === conflict.linkedCommentId)

  function handleSend() {
    if (!draft.trim()) return
    workspace.addComment(draft)
    setDraft('')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="min-h-0 flex-1 space-y-2 overflow-auto">
        {linked.length === 0 && <p className="text-xs text-muted-foreground">No linked comments yet.</p>}
        {linked.map((comment) => {
          const author = allPeople.find((p) => p.id === comment.authorId)
          return (
            <div key={comment.id} className="rounded-xl border bg-background p-2.5 text-xs">
              <div className="flex items-center gap-1.5">
                <Avatar size="sm">
                  <AvatarFallback className={cn('text-[10px] font-medium text-white', author?.colorClass)}>
                    {author?.initials}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground">{author?.name}</span>
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{comment.timeLabel}</span>
              </div>
              <p className="mt-1.5 leading-relaxed text-foreground/85">{comment.text}</p>
            </div>
          )
        })}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              handleSend()
            }
          }}
          placeholder="Reply..."
          className="h-8 flex-1 text-xs"
        />
        <Button type="button" size="icon-sm" onClick={handleSend} disabled={!draft.trim()}>
          <Send className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

// Lets the window be dragged by its header. The offset is applied on top
// of the dialog's centering translate, and clamped so the header can't be
// dragged fully off-screen. It persists while the modal stays mounted, so
// moving between conflicts keeps the window where you put it.
function useDraggable() {
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const drag = useRef(null)

  function onPointerDown(event) {
    if (event.button !== 0 || event.target.closest('button, a, input, textarea, [role=tab]')) return
    const popup = event.currentTarget.closest('[data-slot=dialog-content]')
    drag.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      offset,
      rect: popup.getBoundingClientRect(),
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event) {
    const d = drag.current
    if (!d) return
    const clamp = (v, min, max) => Math.min(Math.max(v, min), max)
    const dx = clamp(event.clientX - d.pointerX, 120 - d.rect.right, window.innerWidth - 120 - d.rect.left)
    const dy = clamp(event.clientY - d.pointerY, -d.rect.top, window.innerHeight - 56 - d.rect.top)
    setOffset({ x: d.offset.x + dx, y: d.offset.y + dy })
  }

  function onPointerUp() {
    drag.current = null
  }

  return {
    // No transition, so the window tracks the pointer 1:1 (open/close
    // use keyframe animations, which this doesn't affect).
    style: { translate: `calc(-50% + ${offset.x}px) calc(-50% + ${offset.y}px)`, transition: 'none' },
    handleProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  }
}

// A 2-column dashboard: the left panel is the working area (Overview /
// Diff / History tabs), the right panel is the review sidebar (status,
// required reviewers, comment thread) that stays visible whichever tab is
// open. Footer options are the same everywhere: Close, Open Merge Studio,
// Mark resolved.
//
// A floating window, not a blocking dialog: non-modal, no backdrop, and
// clicking the page behind it doesn't dismiss it — the workspace and
// canvas stay clear and fully interactive, and the window can be dragged
// anywhere by its header. A shadow + hairline ring lift it off the page
// instead of dimming. Close / Esc / the ✕ close it.
function ConflictModal({ conflict, onOpenChange, onStatusChange, onOpenMergeStudio }) {
  const workspace = useWorkspaceOptional()
  const open = Boolean(conflict)
  const { style: dragStyle, handleProps } = useDraggable()

  const severity = conflict?.severity ? (severityConfig[conflict.severity] ?? severityConfig.medium) : null
  const SeverityIcon = severity?.icon

  function handlePreviewChange() {
    if (conflict.previewPrompt) workspace.sendChatMessage(conflict.previewPrompt)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false} disablePointerDismissal>
      <DialogContent
        overlay={false}
        style={dragStyle}
        className="flex h-[min(680px,85vh)] w-full max-w-4xl flex-col gap-0 overflow-hidden p-0 shadow-2xl shadow-black/60 sm:max-w-4xl"
      >
        {conflict && (
          <>
            <DialogHeader
              {...handleProps}
              title="Drag to move"
              className="shrink-0 cursor-grab touch-none gap-1.5 border-b px-5 py-3.5 select-none active:cursor-grabbing"
            >
              <div className="flex items-center gap-2">
                {severity && (
                  <Badge className={cn('gap-1 border-transparent', severity.className)}>
                    <SeverityIcon className="size-3" />
                    {severity.label}
                  </Badge>
                )}
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className={cn('size-1.5 rounded-full', STATUS_DOT_CLASS[conflict.status])} />
                  {conflict.status}
                </span>
                {conflict.projectName && (
                  <span className="text-[11px] text-muted-foreground">· {conflict.projectName}</span>
                )}
                {conflict.detectedAt && (
                  <span className="text-[11px] text-muted-foreground">· Detected {conflict.detectedAt}</span>
                )}
              </div>
              <DialogTitle className="truncate pr-8 text-left">{conflict.title}</DialogTitle>
              <DialogDescription className="text-left">{conflict.description}</DialogDescription>
            </DialogHeader>

            <div className="flex min-h-0 flex-1">
              {/* Left: working area */}
              <div className="flex min-h-0 flex-[1.6] flex-col border-r">
                <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col gap-0">
                  <div className="flex h-10 shrink-0 items-center border-b px-4">
                    <TabsList variant="line">
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="diff">Diff</TabsTrigger>
                      <TabsTrigger value="history">History</TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="overview" className="min-h-0 flex-1 overflow-auto">
                    <OverviewTab conflict={conflict} onPreview={workspace ? handlePreviewChange : null} />
                  </TabsContent>
                  <TabsContent value="diff" className="min-h-0 flex-1 overflow-auto">
                    <DiffTab conflict={conflict} />
                  </TabsContent>
                  <TabsContent value="history" className="min-h-0 flex-1 overflow-auto p-4">
                    {workspace ? (
                      <RollbackHistoryList />
                    ) : (
                      <EmptyNote>Version history lives in the project's workspace.</EmptyNote>
                    )}
                  </TabsContent>
                </Tabs>
              </div>

              {/* Right: review sidebar — status/reviewers stay pinned, only
                  the comment thread scrolls internally. */}
              <div className="flex w-72 shrink-0 flex-col gap-4 overflow-hidden p-4">
                <div className="shrink-0">
                  <p className={cn(sectionLabelClass, 'mb-2')}>Status</p>
                  <StatusPicker status={conflict.status} onChange={(status) => onStatusChange?.(conflict.id, status)} />
                </div>

                <Separator className="shrink-0" />

                <div className="shrink-0">
                  <p className={cn(sectionLabelClass, 'mb-2')}>Required reviewers</p>
                  <ReviewersList reviewers={conflict.reviewers} />
                </div>

                <Separator className="shrink-0" />

                <div className="flex min-h-0 flex-1 flex-col">
                  <p className={cn(sectionLabelClass, 'mb-2 shrink-0')}>Comments</p>
                  <CommentThread key={conflict.id} conflict={conflict} workspace={workspace} />
                </div>
              </div>
            </div>

            <DialogFooter className="mx-0 mb-0 shrink-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button type="button" variant="outline" className="gap-1.5" onClick={() => onOpenMergeStudio?.(conflict)}>
                <GitMerge className="size-3.5" />
                Open Merge Studio
              </Button>
              <Button
                type="button"
                disabled={conflict.status === 'Resolved'}
                onClick={() => onStatusChange?.(conflict.id, 'Resolved')}
              >
                Mark resolved
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default ConflictModal
