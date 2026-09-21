import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  CheckCircle2,
  Code2,
  GitBranch,
  GitPullRequest,
  Loader2,
  MessageSquare,
  Palette,
  Rocket,
  Send,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import { cn } from 'cn'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { allPeople, canvasPages, codeMergeVariants, designMergeVariants, openFiles } from '@/data/mockData'

const PROGRESS_STEPS = [
  { label: 'Committing changes', icon: GitBranch },
  { label: 'Opening pull request', icon: GitPullRequest },
  { label: 'Requesting team reviews', icon: Send },
  { label: 'Starting GitHub Actions deployment', icon: Rocket },
]

// Turns the merge item + the user's resolutions + the canvas annotations
// into the pre-flight summary shown at the top of the modal.
function buildSummary(item, resolutions, annotations) {
  const layers = canvasPages.find((p) => p.id === item.designPageId)?.frames[0]?.layers ?? []
  const layerDiffs = designMergeVariants[item.id]?.layerDiffs ?? {}

  const design = Object.entries(resolutions).map(([key, side]) => {
    const [layerId, diffId] = key.split(':')
    const diff = layerDiffs[layerId]?.find((d) => d.id === diffId)
    const layer = layers.find((l) => l.id === layerId)
    return {
      key,
      text: `${layer?.name ?? layerId} · ${diff?.label ?? diffId}`,
      choice: side === 'A' ? `Kept ${diff?.optionA ?? 'A'}` : `Accepted ${diff?.optionB ?? 'B'}`,
    }
  })

  const files = openFiles
    .filter((f) => item.fileIds?.includes(f.id))
    .map((f) => ({
      id: f.id,
      name: f.name,
      changed: codeMergeVariants[item.id]?.[f.id]?.length ?? 0,
      aiLines: annotations.filter((a) => a.status === 'done' && a.fileId === f.id).length,
    }))

  return {
    design,
    files,
    applied: annotations.filter((a) => a.status === 'done'),
    pending: annotations.filter((a) => a.status !== 'done').length,
  }
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function SectionTitle({ icon: Icon, children, aside }) {
  return (
    <div className="mb-2 flex items-center gap-1.5">
      <Icon className="size-3.5 text-indigo-500" />
      <h3 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{children}</h3>
      {aside && <span className="ml-auto">{aside}</span>}
    </div>
  )
}

function SummarySection({ summary }) {
  return (
    <section>
      <SectionTitle icon={Sparkles}>Pre-flight summary</SectionTitle>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-2xl border bg-background/40 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Palette className="size-3.5 text-violet-500" />
            Design
          </p>
          {summary.design.length ? (
            <ul className="space-y-1.5">
              {summary.design.map((d) => (
                <li key={d.key} className="text-[11px] leading-snug">
                  <span className="text-foreground">{d.text}</span>
                  <span className="block text-muted-foreground">{d.choice}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-muted-foreground">No variant options resolved.</p>
          )}
        </div>

        <div className="rounded-2xl border bg-background/40 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Code2 className="size-3.5 text-violet-500" />
            Code
          </p>
          {summary.files.length ? (
            <ul className="space-y-1.5">
              {summary.files.map((f) => (
                <li key={f.id} className="text-[11px] leading-snug">
                  <span className="text-foreground">{f.name}</span>
                  <span className="block text-muted-foreground">
                    {f.changed} incoming line{f.changed === 1 ? '' : 's'}
                    {f.aiLines > 0 && ` · ${f.aiLines} AI edit${f.aiLines === 1 ? '' : 's'}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-muted-foreground">No code files.</p>
          )}
        </div>

        <div className="rounded-2xl border bg-background/40 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <MessageSquare className="size-3.5 text-violet-500" />
            AI annotations
          </p>
          {summary.applied.length ? (
            <ul className="space-y-1.5">
              {summary.applied.map((a) => (
                <li key={a.id} className="text-[11px] leading-snug">
                  <span className="text-foreground">“{a.text}”</span>
                  <span className="block text-muted-foreground">{a.summary}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-muted-foreground">No AI edits applied.</p>
          )}
          {summary.pending > 0 && (
            <p className="mt-2 flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 text-[10px] font-medium text-amber-500">
              <TriangleAlert className="size-3 shrink-0" />
              {summary.pending} note{summary.pending === 1 ? '' : 's'} not applied
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

function ReviewerSection({ reviewers, setReviewers }) {
  function togglePerson(id) {
    setReviewers((prev) => {
      const next = { ...prev }
      if (next[id]) delete next[id]
      else next[id] = ['code', 'design']
      return next
    })
  }

  function toggleType(id, type) {
    setReviewers((prev) => {
      const current = prev[id] ?? []
      const types = current.includes(type) ? current.filter((t) => t !== type) : [...current, type]
      const next = { ...prev }
      if (types.length) next[id] = types
      else delete next[id]
      return next
    })
  }

  return (
    <section>
      <SectionTitle icon={Send}>Request review</SectionTitle>
      <div className="flex flex-col gap-1.5">
        {allPeople.map((person) => {
          const types = reviewers[person.id]
          const selected = Boolean(types)
          return (
            <div
              key={person.id}
              className={cn(
                'flex items-center gap-2.5 rounded-full border py-1.5 pr-2 pl-1.5 transition-colors',
                selected ? 'border-indigo-500/60 bg-indigo-500/10' : 'border-border'
              )}
            >
              <button
                type="button"
                onClick={() => togglePerson(person.id)}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
              >
                <Avatar size="sm">
                  <AvatarFallback className={cn('text-[9px] font-semibold text-white', person.colorClass)}>
                    {person.initials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium text-foreground">{person.name}</span>
                <span className="text-[11px] text-muted-foreground">{person.role}</span>
                {selected && <Check className="ml-auto size-3.5 shrink-0 text-indigo-500" />}
              </button>
              {selected &&
                [
                  ['code', 'Code'],
                  ['design', 'Design'],
                ].map(([type, label]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleType(person.id, type)}
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors',
                      types.includes(type)
                        ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {label}
                  </button>
                ))}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function ProgressView({ step }) {
  return (
    <div className="flex flex-col items-center gap-5 py-6">
      <span className="flex size-12 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white">
        <Loader2 className="size-5 animate-spin" />
      </span>
      <div className="w-full max-w-sm space-y-2">
        {PROGRESS_STEPS.map((s, i) => {
          const done = i < step
          const active = i === step
          return (
            <div
              key={s.label}
              className={cn(
                'flex items-center gap-2.5 rounded-full border px-3 py-2 text-xs transition-all duration-300',
                done && 'border-emerald-500/40 bg-emerald-500/10 text-foreground',
                active && 'border-indigo-500/60 bg-indigo-500/10 text-foreground',
                !done && !active && 'border-border text-muted-foreground opacity-60'
              )}
            >
              {done ? (
                <Check className="size-3.5 text-emerald-400" />
              ) : active ? (
                <Loader2 className="size-3.5 animate-spin text-indigo-500" />
              ) : (
                <s.icon className="size-3.5" />
              )}
              {s.label}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SuccessView({ prTitle, reviewerNames, deploy, prNumber }) {
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-8 ring-emerald-500/10">
        <CheckCircle2 className="size-7" />
      </span>
      <div>
        <p className="text-base font-semibold text-foreground">Review request sent</p>
        <p className="mt-1 text-xs text-muted-foreground">
          PR #{prNumber} “{prTitle}” is open.
        </p>
      </div>
      <div className="w-full max-w-sm space-y-2 text-left text-xs">
        <p className="flex items-center gap-2 rounded-full border px-3 py-2">
          <Send className="size-3.5 shrink-0 text-indigo-500" />
          <span className="text-foreground">Requested review from {reviewerNames.join(', ')}</span>
        </p>
        <p className="flex items-center gap-2 rounded-full border px-3 py-2">
          <Rocket className="size-3.5 shrink-0 text-violet-500" />
          <span className="text-foreground">
            {deploy ? 'GitHub Actions deployment started' : 'GitHub Actions deployment skipped'}
          </span>
          {deploy && (
            <span className="ml-auto flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-500">
              <Loader2 className="size-2.5 animate-spin" />
              Running
            </span>
          )}
        </p>
      </div>
    </div>
  )
}

// The "Merge Changes" flow: pre-flight summary -> reviewers -> commit/PR
// settings -> a stepped progress state -> success. Rendered only while
// open (the parent mounts it per click), so every session starts fresh.
function MergeExecutionModal({ item, resolutions, annotations, onClose, onComplete }) {
  const summary = useMemo(() => buildSummary(item, resolutions, annotations), [item, resolutions, annotations])
  const branch = `merge/${slugify(item.title)}`
  const [stage, setStage] = useState('form') // form | progress | success
  const [step, setStep] = useState(0)
  const [reviewers, setReviewers] = useState({ james: ['code'], min: ['design'] })
  const [commit, setCommit] = useState(`merge: ${item.title}`)
  const [prTitle, setPrTitle] = useState(`Merge: ${item.title}`)
  const [prBody, setPrBody] = useState('')
  const [deploy, setDeploy] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [prNumber] = useState(() => 100 + Math.floor(Math.random() * 90))

  const reviewerIds = Object.keys(reviewers)
  const reviewerNames = reviewerIds.map((id) => allPeople.find((p) => p.id === id)?.name).filter(Boolean)

  useEffect(() => {
    if (stage !== 'progress') return
    const timer = setInterval(() => setStep((s) => s + 1), 750)
    return () => clearInterval(timer)
  }, [stage])

  useEffect(() => {
    if (stage === 'progress' && step >= PROGRESS_STEPS.length) {
      setStage('success')
      onComplete()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, stage])

  function generateWithAi() {
    setGenerating(true)
    setTimeout(() => {
      const d = summary.design.length
      const a = summary.applied.length
      setCommit(`merge(${slugify(item.title)}): reconcile ${d} design decision${d === 1 ? '' : 's'}, ${a} AI edit${a === 1 ? '' : 's'}`)
      setPrTitle(`Merge: ${item.title} — design & code reconciliation`)
      setPrBody(
        [
          '## Summary',
          `Reconciles Option A (current) and Option B (incoming) for **${item.title}**.`,
          '',
          '## Changes',
          ...summary.design.map((x) => `- Design: ${x.text} → ${x.choice}`),
          ...summary.files.map((f) => `- Code: ${f.name} (${f.changed} incoming line${f.changed === 1 ? '' : 's'})`),
          ...summary.applied.map((x) => `- AI: ${x.summary} (“${x.text}”)`),
          '',
          '## Review',
          `Requested from ${reviewerNames.join(', ') || 'no one yet'}.`,
        ].join('\n')
      )
      setGenerating(false)
    }, 900)
  }

  const busy = stage === 'progress'

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent
        showCloseButton={!busy}
        className="flex max-h-[88vh] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-2xl"
      >
        <DialogHeader className="shrink-0 border-b px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white">
              <GitPullRequest className="size-3.5" />
            </span>
            {stage === 'success' ? 'Merge in progress' : 'Merge changes'}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 text-xs">
            <GitBranch className="size-3" />
            {branch} → main
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {stage === 'form' && (
            <div className="space-y-5">
              <SummarySection summary={summary} />
              <ReviewerSection reviewers={reviewers} setReviewers={setReviewers} />

              <section>
                <SectionTitle
                  icon={GitPullRequest}
                  aside={
                    <button
                      type="button"
                      onClick={generateWithAi}
                      disabled={generating}
                      className="flex items-center gap-1 rounded-full border border-indigo-500/50 px-2.5 py-1 text-[10px] font-semibold tracking-normal text-foreground normal-case transition-colors hover:bg-indigo-500/15 disabled:opacity-60"
                    >
                      {generating ? (
                        <Loader2 className="size-3 animate-spin text-violet-500" />
                      ) : (
                        <Sparkles className="size-3 text-violet-500" />
                      )}
                      {generating ? 'Generating…' : 'Generate with AI'}
                    </button>
                  }
                >
                  Commit &amp; PR
                </SectionTitle>
                <div className="space-y-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-muted-foreground">Commit message</span>
                    <Input value={commit} onChange={(e) => setCommit(e.target.value)} className="rounded-full" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-muted-foreground">PR title</span>
                    <Input value={prTitle} onChange={(e) => setPrTitle(e.target.value)} className="rounded-full" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-muted-foreground">PR description</span>
                    <textarea
                      value={prBody}
                      onChange={(e) => setPrBody(e.target.value)}
                      rows={5}
                      placeholder="Describe this merge, or use Generate with AI…"
                      className="w-full resize-none rounded-2xl border bg-transparent px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </label>
                  <label className="flex items-center gap-2 rounded-full border px-3 py-2 text-xs">
                    <Rocket className="size-3.5 text-violet-500" />
                    <span className="flex-1 text-foreground">Trigger GitHub Actions deployment after merge</span>
                    <Switch checked={deploy} onCheckedChange={setDeploy} />
                  </label>
                </div>
              </section>
            </div>
          )}

          {stage === 'progress' && <ProgressView step={Math.min(step, PROGRESS_STEPS.length - 1)} />}
          {stage === 'success' && (
            <SuccessView prTitle={prTitle} reviewerNames={reviewerNames} deploy={deploy} prNumber={prNumber} />
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t px-5 py-3">
          {stage === 'form' && (
            <>
              {reviewerIds.length === 0 && (
                <span className="mr-auto text-[11px] text-muted-foreground">Select at least one reviewer.</span>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-full px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reviewerIds.length === 0 || !commit.trim() || !prTitle.trim()}
                onClick={() => {
                  setStep(0)
                  setStage('progress')
                }}
                className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all hover:brightness-110 disabled:opacity-40"
              >
                <Send className="size-3.5" />
                Request Review &amp; Merge
              </button>
            </>
          )}
          {stage === 'success' && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2 text-xs font-semibold text-white"
            >
              Done
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default MergeExecutionModal
