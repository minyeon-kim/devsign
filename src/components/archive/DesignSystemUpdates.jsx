import { ArrowRight, BookOpen, Check, History, FileText } from 'lucide-react'
import { cn } from 'cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ACCENT_CTA, GHOST_BUTTON } from '@/components/mergestudio/floatingStyles'
import { allPeople } from '@/data/mockData'
import { DS_STAGES, docIdFor, stageIndex } from '@/lib/designSystemUpdates'
import { affectedDocuments, nextDocumentChange } from '@/lib/documentChanges'
import { useWorkspace } from '@/state/WorkspaceProvider'

const STAGE_ICONS = { update: FileText, documented: BookOpen, archived: History }

// The pipeline itself, drawn once at the top of the view: what each stage
// means, left to right.
function PipelineHeader({ counts }) {
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label="Pipeline">
      {DS_STAGES.map((stage, i) => {
        const Icon = STAGE_ICONS[stage.id]
        return (
          <li key={stage.id} className="flex items-center gap-2">
            <span className="flex h-9 items-center gap-2 rounded-full bg-white/[0.04] pr-3.5 pl-2.5 text-xs">
              <Icon className="size-3.5 text-emerald-300" />
              <span className="font-medium text-slate-200">{stage.label}</span>
              <span className="text-slate-500 tabular-nums">{counts[stage.id] ?? 0}</span>
            </span>
            {i < DS_STAGES.length - 1 && <ArrowRight className="size-3.5 text-slate-600" />}
          </li>
        )
      })}
    </ol>
  )
}

function StageTrack({ stage }) {
  const at = stageIndex(stage)
  return (
    <div className="flex items-center gap-1.5">
      {DS_STAGES.map((s, i) => {
        const done = i < at || stage === 'archived'
        const active = i === at && stage !== 'archived'
        return (
          <span key={s.id} className="flex items-center gap-1.5">
            <span
              title={s.label}
              className={cn(
                'flex size-5 items-center justify-center rounded-full text-[10px] font-semibold',
                done && 'bg-emerald-400 text-slate-950',
                active && 'bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/60',
                !done && !active && 'bg-white/[0.06] text-slate-500'
              )}
            >
              {done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
            </span>
            {i < DS_STAGES.length - 1 && (
              <span className={cn('h-px w-5 rounded-full', i < at || stage === 'archived' ? 'bg-emerald-400/50' : 'bg-white/10')} />
            )}
          </span>
        )
      })}
    </div>
  )
}

function UpdateCard({ update, active, affectedDocs, onDocument, onArchive, onOpenDoc, onOpenHistory, onOpenReference }) {
  const author = allPeople.find((p) => p.id === update.authorId)

  return (
    <article className="rounded-2xl bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.045]">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-white">{update.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{update.summary}</p>
        </div>
        <StageTrack stage={update.stage} />
      </div>

      {affectedDocs.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
        <span>Affected docs</span>
        {affectedDocs.map((doc) => <button key={doc.id} type="button" onClick={() => onOpenReference(doc.id)} className="rounded-full bg-white/[0.05] px-2.5 py-1 text-xs hover:text-white">{doc.title}</button>)}
      </div>}
      {update.changes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {update.changes.map((c) => (
            <span key={c.label} className="inline-flex items-center gap-1.5 rounded-lg bg-black/20 px-2 py-1 font-mono text-[11px]">
              <span className="text-slate-400">{c.label}</span>
              <span className="text-slate-500 line-through decoration-slate-600">{c.from}</span>
              <ArrowRight className="size-3 text-slate-600" />
              <span className="text-emerald-300">{c.to}</span>
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        {author && (
          <Avatar size="sm">
            <AvatarFallback className={cn('text-[10px] font-semibold text-white', author.colorClass)}>{author.initials}</AvatarFallback>
          </Avatar>
        )}
        <span className="min-w-0 truncate text-[11px] text-slate-500">
          {author?.name} · {update.createdAtLabel}
          {update.conflictTitle && ` · from Conflict Point “${update.conflictTitle}”`}
          {update.mergeItemId && ' · from Merge'}
          {!active && update.stage !== 'archived' && ' · Waiting for earlier updates'}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {update.stage !== 'update' && (
            <button type="button" onClick={onOpenDoc} className={cn('inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium', GHOST_BUTTON)}>
              <BookOpen className="size-3.5" />
              Doc
            </button>
          )}
          {update.stage === 'archived' && (
            <button type="button" onClick={onOpenHistory} className={cn('inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium', GHOST_BUTTON)}>
              <History className="size-3.5" />
              History
            </button>
          )}
          {update.stage === 'update' && (
            <button type="button" onClick={onDocument} disabled={!active} className={cn('inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold disabled:opacity-35', ACCENT_CTA)}>
              <BookOpen className="size-3.5" />
              Approve update
            </button>
          )}
          {update.stage === 'documented' && (
            <button type="button" onClick={onArchive} disabled={!active} className={cn('inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold disabled:opacity-35', ACCENT_CTA)}>
              <History className="size-3.5" />
              Record in history
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

// System changes automatically queued by Conflict / Merge, reviewed in Docs.
function DesignSystemUpdates({ onOpenDoc, onOpenHistory }) {
  const { dsUpdates, referenceDocs, documentDsUpdate, archiveDsUpdate } = useWorkspace()
  const counts = dsUpdates.reduce((acc, u) => ({ ...acc, [u.stage]: (acc[u.stage] ?? 0) + 1 }), {})
  // Keep registration order for pending updates, completed records below.
  const ordered = [...dsUpdates.filter((u) => u.stage !== 'archived'), ...dsUpdates.filter((u) => u.stage === 'archived')]
  const next = nextDocumentChange(dsUpdates)

  return (
    <div className="flex max-w-3xl flex-col gap-5 px-6 py-5">
      <div className="flex flex-col gap-3">
        <p className="text-xs text-slate-400">
          System changes from Conflict and Merge are automatically listed here for approval. Updates cover all project documents and are processed in order, then recorded in History.
        </p>
        <PipelineHeader counts={counts} />
      </div>

      {ordered.length === 0 ? (
        <p className="rounded-2xl bg-white/[0.03] px-4 py-10 text-center text-xs text-slate-500">
          No document updates yet. Resolving a Conflict Point or merging system changes adds an update automatically.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {ordered.map((update) => (
            <UpdateCard
              key={update.id}
              update={update}
              active={next?.id === update.id}
              affectedDocs={affectedDocuments(update, referenceDocs)}
              onOpenReference={onOpenDoc}
              onDocument={() => documentDsUpdate(update.id)}
              onArchive={() => archiveDsUpdate(update.id)}
              onOpenDoc={() => onOpenDoc(docIdFor(update))}
              onOpenHistory={() => onOpenHistory(update.historyId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default DesignSystemUpdates
