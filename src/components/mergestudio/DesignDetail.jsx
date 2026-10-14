import { Fragment, useEffect, useRef, useState } from 'react'
import { ArrowLeft, Blend, LoaderCircle, Send } from 'lucide-react'
import { cn } from 'cn'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { allPeople } from '@/data/mockData'
import { toast } from '@/i18n/toast'
import { MIX_ACTION_LABEL } from '@/lib/mixRecord'
import { useWorkspace } from '@/state/WorkspaceProvider'

// The Design Compare sidebar's detail screen: one set, nothing else on the screen.
//   header (56px)   ←  and the set's name, its group · state under it;
//   the drafts      side by side — "원본" / "코드" over each frame, no boxes; one icon lays them over each other;
//   변경 N          what sets them apart, row by row (pointing at a row lights the layer in the frames);
//   코멘트          only once there is one — and the line to write one;
//   bottom bar      [변경 검토] [조합하기], 40px, side by side, the one thing to do next in green.
// Three sizes of type (15 · 13 · 12), 8px steps, 24px between sections, 20px at the sides.

const LABEL = (option, index) => (option.side === 'A' ? '원본' : option.side === 'B' ? '코드' : option.label ?? String.fromCharCode(65 + index))

// A frame, as a thumbnail the width of its column (its layers drawn as they are; the picked ones outlined).
function Frame({ frame, effects, marks, onPress, label }) {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (!ref.current) return undefined
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  if (!frame) return <div className="flex h-28 items-center justify-center text-xs text-muted-foreground">No design preview</div>
  const scale = width ? width / frame.width : 0
  return (
    <button ref={ref} type="button" data-detail-frame onClick={onPress} aria-label={`${label} — 캔버스에서 보기`} title="캔버스에서 보기"
      className="relative block w-full cursor-pointer overflow-hidden rounded-md bg-white text-left shadow-sm outline-none ring-1 ring-border focus-visible:ring-2 focus-visible:ring-primary" style={{ height: frame.height * scale }}>
      <span aria-hidden className="pointer-events-none absolute top-0 left-0 origin-top-left" style={{ width: frame.width, height: frame.height, transform: `scale(${scale})` }}>
        {frame.layers.map((layer) => <StaticLayer key={layer.id} layer={layer} override={effects[layer.id]} onSelect={() => {}} />)}
        <Marks frame={frame} marks={marks} />
      </span>
    </button>
  )
}

function Marks({ frame, marks }) {
  if (!marks?.size) return null
  return frame.layers.filter((layer) => marks.has(layer.id)).map((layer) => (
    <span key={layer.id} aria-hidden data-detail-mark={layer.id} className="pointer-events-none absolute rounded-[3px] bg-primary/10 ring-2 ring-primary" style={{ left: layer.x, top: layer.y, width: layer.width, height: layer.height }} />
  ))
}

// One draft over the other: the second at the opacity asked for.
function Overlay({ drawn, opacity, marks, onPress }) {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (!ref.current) return undefined
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  const frame = drawn[0]?.frame
  if (!frame) return null
  const scale = width ? width / frame.width : 0
  return (
    <button ref={ref} type="button" data-detail-overlay onClick={onPress} aria-label="원본과 코드 겹쳐보기 — 캔버스에서 보기" title="캔버스에서 보기"
      className="relative mx-auto block w-full max-w-[280px] cursor-pointer overflow-hidden rounded-md bg-white shadow-sm outline-none ring-1 ring-border focus-visible:ring-2 focus-visible:ring-primary" style={{ height: frame.height * scale }}>
      {drawn.slice(0, 2).map(({ frame: layered, effects }, index) => layered && (
        <span key={index} aria-hidden className="pointer-events-none absolute top-0 left-0 origin-top-left" style={{ width: layered.width, height: layered.height, transform: `scale(${scale})`, opacity: index === 0 ? 1 : opacity / 100 }}>
          {layered.layers.map((layer) => <StaticLayer key={layer.id} layer={layer} override={effects[layer.id]} onSelect={() => {}} />)}
        </span>
      ))}
      <span aria-hidden className="pointer-events-none absolute top-0 left-0 origin-top-left" style={{ width: frame.width, height: frame.height, transform: `scale(${scale})` }}><Marks frame={frame} marks={marks} /></span>
    </button>
  )
}

export default function DesignDetail({ item, drawn, diffRows, identical, conflict, status, compose, next, edit, titleRef, group, onBack, readOnly = false, onDone }) {
  const { comments, addComment, showScreenIn, focusConflictPin } = useWorkspace()
  const [overlay, setOverlay] = useState(false)
  const [opacity, setOpacity] = useState(50)
  const [hot, setHot] = useState(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(null)
  const marks = hot ? new Set([hot]) : new Set()
  const canOverlay = drawn.length >= 2
  const list = conflict ? comments.filter((comment) => comment.target?.conflictId === conflict.id) : []

  // A frame pressed: the canvas goes to that screen (and to the change, when it has one) — the sidebar stays.
  function seeOnCanvas() {
    if (!item) return
    showScreenIn('screens', item.designPageId)
    if (conflict) focusConflictPin(conflict)
  }
  // Pressed: the button shows it's working and can't be pressed twice; what it did is said; `then` follows.
  async function run(which, action, done, then) {
    if (busy) return
    setBusy(which)
    await new Promise((resolve) => setTimeout(resolve, 420))
    try { action(); if (done) toast(done, { description: item?.title }) } finally { setBusy(null) }
    then?.()
  }

  // (A saved mix is put together again through its own "edit".)
  const composeAction = compose ?? (edit ? { run: edit.run, disabled: false } : null)
  const waiting = status?.id === 'in_review' || status?.id === 'requested'
  const composeReason = readOnly ? '이 항목을 조합할 권한이 없어요' : waiting ? '검토 대기 중에는 조합할 수 없어요' : identical ? '두 버전이 동일해서 조합할 게 없어요' : composeAction?.disabled ? '비교할 시안을 2개 이상 골라 주세요' : !composeAction ? '지금은 조합할 수 없어요' : null
  const reviewReason = readOnly ? '이 항목을 검토할 권한이 없어요' : !next ? '검토할 변경이 아직 없어요' : null
  const rootButton = 'ds-intrinsic inline-flex h-10 w-full items-center justify-center gap-2 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-45'

  return (
    <div data-design-detail className="flex h-full min-h-0 flex-col bg-background text-[13px] text-foreground">
      <header className="flex h-14 shrink-0 items-center gap-2 pr-5 pl-3">
        <Tooltip>
          <TooltipTrigger data-compare-back aria-label="목록으로 (Esc)" onClick={onBack} className="ds-intrinsic flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary">
            <ArrowLeft className="size-4" />
          </TooltipTrigger>
          <TooltipContent side="bottom">목록으로 <span className="opacity-60">Esc</span></TooltipContent>
        </Tooltip>
        <div className="min-w-0 flex-1">
          <h2 ref={titleRef} tabIndex={-1} className="truncate rounded text-[15px] leading-5 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary">{item?.title}</h2>
          <p className="truncate text-xs leading-4 text-muted-foreground">{[group, status?.label].filter(Boolean).join(' · ')}</p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
        <div className="flex flex-col gap-6">
          <section aria-label="비교">
            {canOverlay && (
              <div className="mb-2 flex h-8 items-center justify-end">
                <Tooltip>
                  <TooltipTrigger data-detail-overlay-toggle aria-pressed={overlay} aria-label="겹쳐보기" onClick={() => setOverlay((on) => !on)}
                    className={cn('ds-intrinsic flex size-8 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary', overlay ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                    <Blend className="size-4" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom">겹쳐보기</TooltipContent>
                </Tooltip>
              </div>
            )}
            {overlay && canOverlay ? (
              <div className="flex flex-col gap-3">
                <Overlay drawn={drawn} opacity={opacity} marks={marks} onPress={seeOnCanvas} />
                <label className="flex items-center gap-3 text-xs text-muted-foreground">
                  원본
                  <input type="range" data-detail-opacity min={0} max={100} value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} aria-label="코드 불투명도" className="h-1 min-w-0 flex-1 accent-primary" />
                  코드 <span className="w-8 text-right tabular-nums">{opacity}%</span>
                </label>
              </div>
            ) : (
              <div className={cn('grid gap-4', drawn.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
                {drawn.map(({ option, frame, effects }, index) => (
                  <div key={option.key} data-detail-draft={option.key} className="flex min-w-0 flex-col gap-2">
                    <span className="truncate text-xs text-muted-foreground">{LABEL(option, index)}</span>
                    <Frame frame={frame} effects={effects} marks={marks} onPress={seeOnCanvas} label={LABEL(option, index)} />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section aria-label="변경" data-detail-diffs>
            <h3 className="mb-2 text-xs font-normal text-muted-foreground">변경 {diffRows.length}</h3>
            {identical && <p role="status" data-detail-identical className="py-1 text-[13px] text-muted-foreground">두 버전이 동일합니다.</p>}
            <ul className="flex flex-col">
              {diffRows.map((row) => (
                <li key={row.key} data-detail-diff-row={row.key} tabIndex={row.layerId ? 0 : undefined}
                  onMouseEnter={() => setHot(row.layerId)} onMouseLeave={() => setHot(null)} onFocus={() => setHot(row.layerId)} onBlur={() => setHot(null)}
                  className="flex h-8 items-center justify-between gap-4 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <span className="min-w-0 truncate text-[13px]">{row.label}</span>
                  <span className="flex shrink-0 items-center gap-2 text-[13px] tabular-nums">
                    {row.values.map((value, index) => (
                      <Fragment key={index}>
                        {index > 0 && <span aria-hidden className="text-muted-foreground">→</span>}
                        <span className={index < row.values.length - 1 ? 'text-muted-foreground' : undefined}>{value}</span>
                      </Fragment>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {list.length > 0 && (
            <section aria-label="코멘트" data-detail-comments>
              <h3 className="mb-2 text-xs font-normal text-muted-foreground">코멘트 {list.length}</h3>
              <ul className="flex flex-col gap-4">
                {list.map((comment) => {
                  const person = allPeople.find((candidate) => candidate.id === comment.authorId)
                  return (
                    <li key={comment.id} className="flex flex-col gap-1">
                      <p className="text-xs text-muted-foreground"><span className="text-foreground">{person?.name ?? comment.authorId}</span>{comment.timeLabel && ` · ${comment.timeLabel}`}</p>
                      <p className="text-[13px] break-words">{comment.text}</p>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {conflict && (
            <form onSubmit={(event) => { event.preventDefault(); if (!draft.trim()) return; addComment(draft, { conflictId: conflict.id }); setDraft('') }} className="flex items-center gap-2 rounded-full bg-muted py-1 pr-1 pl-4">
              <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="코멘트 남기기" aria-label="코멘트 남기기" className="h-8 min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground" />
              <Tooltip>
                <TooltipTrigger type="submit" disabled={!draft.trim()} aria-label="보내기" className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"><Send className="size-4" /></TooltipTrigger>
                <TooltipContent side="top">보내기</TooltipContent>
              </Tooltip>
            </form>
          )}
        </div>
      </div>

      {/* The actions, always in reach: review (quiet) and compose (the one in green). */}
      <div data-detail-actions className="grid shrink-0 grid-cols-2 gap-2 border-t border-border px-5 py-3">
        <span title={reviewReason ?? undefined} className="block">
          <button type="button" data-design-next disabled={Boolean(reviewReason) || Boolean(busy)} aria-busy={busy === 'next' || undefined}
            onClick={() => run('next', next.run, next.label === MIX_ACTION_LABEL.request ? '병합 요청을 보냈어요' : null, next.label === MIX_ACTION_LABEL.request ? onDone : null)}
            className={cn(rootButton, 'border border-border bg-card hover:bg-[var(--ds-surface-raised)]')}>
            {busy === 'next' && <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />}
            {next?.label ?? '변경 검토'}
          </button>
        </span>
        <span title={composeReason ?? undefined} className="block">
          <button type="button" data-design-compose disabled={Boolean(composeReason) || Boolean(busy)} aria-busy={busy === 'compose' || undefined}
            onClick={() => run('compose', composeAction.run, null, null)}
            className={cn(rootButton, 'bg-primary text-primary-foreground hover:brightness-105')}>
            {busy === 'compose' && <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />}
            조합하기
          </button>
        </span>
      </div>
    </div>
  )
}
