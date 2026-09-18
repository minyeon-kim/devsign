import { useState } from 'react'
import {
  Check,
  CircleAlert,
  Code2,
  Eye,
  GitBranch,
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
import { allPeople, reviewStages } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'
import RollbackHistoryList from '@/components/history/RollbackHistoryList'

const severityConfig = {
  high: { label: 'High', icon: TriangleAlert, className: 'bg-destructive/15 text-destructive' },
  medium: { label: 'Medium', icon: CircleAlert, className: 'bg-amber-500/15 text-amber-500' },
  low: { label: 'Low', icon: Info, className: 'bg-sky-500/15 text-sky-500' },
}

function DiffBlock({ label, lines, tone }) {
  if (!lines?.length) return null
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
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
        tone === 'expected'
          ? 'border-emerald-500/25 bg-emerald-500/5'
          : 'border-destructive/25 bg-destructive/5'
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

      {conflict.suggestion && (
        <div className="space-y-2.5 rounded-xl border border-primary/25 bg-primary/5 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-primary uppercase">
            <Sparkles className="size-3.5" />
            AI suggested change
          </div>
          <p className="text-xs leading-relaxed text-foreground/85">{conflict.suggestion}</p>
          <Button type="button" size="sm" className="gap-1.5" onClick={onPreview}>
            <Eye className="size-3.5" />
            Preview change
          </Button>
        </div>
      )}
    </div>
  )
}

function DiffTab({ conflict }) {
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

function ReviewStepper({ stage }) {
  const currentIndex = Math.max(
    0,
    reviewStages.findIndex((s) => s.id === stage)
  )

  return (
    <div className="relative pl-5">
      <div className="absolute top-1 bottom-1 left-[7px] w-px bg-border" />
      {reviewStages.map((s, i) => {
        const done = i < currentIndex
        const active = i === currentIndex
        return (
          <div key={s.id} className="relative mb-3 last:mb-0">
            <span
              className={cn(
                'absolute -left-5 top-0.5 flex size-2.5 items-center justify-center rounded-full border-2 bg-card',
                done || active ? 'border-primary' : 'border-border'
              )}
            >
              {done ? (
                <Check className="size-2 text-primary" strokeWidth={3} />
              ) : (
                active && <span className="size-1 rounded-full bg-primary" />
              )}
            </span>
            <span
              className={cn(
                'text-xs',
                active
                  ? 'font-semibold text-foreground'
                  : done
                    ? 'text-foreground/70'
                    : 'text-muted-foreground'
              )}
            >
              {s.label}
            </span>
          </div>
        )
      })}
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
              <AvatarFallback
                className={cn('text-[10px] font-medium text-white', person.colorClass)}
              >
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

function CommentThread({ conflict }) {
  const { comments, addComment } = useWorkspace()
  const [draft, setDraft] = useState('')
  const linked = comments.filter((c) => c.id === conflict.linkedCommentId)

  function handleSend() {
    if (!draft.trim()) return
    addComment(draft)
    setDraft('')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="min-h-0 flex-1 space-y-2 overflow-auto">
        {linked.length === 0 && (
          <p className="text-xs text-muted-foreground">No linked comments yet.</p>
        )}
        {linked.map((comment) => {
          const author = allPeople.find((p) => p.id === comment.authorId)
          return (
            <div key={comment.id} className="rounded-xl border bg-background p-2.5 text-xs">
              <div className="flex items-center gap-1.5">
                <Avatar size="sm">
                  <AvatarFallback
                    className={cn('text-[10px] font-medium text-white', author?.colorClass)}
                  >
                    {author?.initials}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-foreground">{author?.name}</span>
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                  {comment.timeLabel}
                </span>
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

// The 'View' button on a Conflict Points row opens this — a 2-column
// dashboard: the left panel is the working area (Overview/Diff/History
// tabs), the right panel is the review sidebar (status stepper, required
// reviewers, comment thread) that stays visible no matter which left tab is
// open.
function ConflictDetailModal({ conflict, open, onOpenChange, onResolve }) {
  const { sendChatMessage } = useWorkspace()
  if (!conflict) return null

  const severity = severityConfig[conflict.severity] ?? severityConfig.medium
  const SeverityIcon = severity.icon

  function handlePreviewChange() {
    if (conflict.previewPrompt) sendChatMessage(conflict.previewPrompt)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(680px,85vh)] w-full max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 gap-1.5 border-b px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Badge className={cn('gap-1 border-transparent', severity.className)}>
              <SeverityIcon className="size-3" />
              {severity.label}
            </Badge>
            {conflict.detectedAt && (
              <span className="text-[11px] text-muted-foreground">
                Detected {conflict.detectedAt}
              </span>
            )}
          </div>
          <DialogTitle className="truncate text-left">{conflict.file}</DialogTitle>
          <DialogDescription className="text-left">{conflict.message}</DialogDescription>
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
                <OverviewTab conflict={conflict} onPreview={handlePreviewChange} />
              </TabsContent>
              <TabsContent value="diff" className="min-h-0 flex-1 overflow-auto">
                <DiffTab conflict={conflict} />
              </TabsContent>
              <TabsContent value="history" className="min-h-0 flex-1 overflow-auto p-4">
                <RollbackHistoryList />
              </TabsContent>
            </Tabs>
          </div>

          {/* Right: review sidebar — stepper/reviewers stay pinned, only the
              comment thread scrolls internally (it has its own min-h-0
              flex-1 + overflow-auto), since this modal (unlike the right
              floating toolbar) has a fixed height to work with. */}
          <div className="flex w-72 shrink-0 flex-col gap-4 overflow-hidden p-4">
            <div className="shrink-0">
              <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Review status
              </p>
              <ReviewStepper stage={conflict.reviewStage} />
            </div>

            <Separator className="shrink-0" />

            <div className="shrink-0">
              <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Required reviewers
              </p>
              <ReviewersList reviewers={conflict.reviewers} />
            </div>

            <Separator className="shrink-0" />

            <div className="flex min-h-0 flex-1 flex-col">
              <p className="mb-2 shrink-0 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                Comments
              </p>
              <CommentThread conflict={conflict} />
            </div>
          </div>
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" onClick={() => onResolve?.(conflict.id)}>
            Mark resolved
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ConflictDetailModal
