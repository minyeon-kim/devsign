import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Blend, Check, LoaderCircle, Send } from 'lucide-react'
import { cn } from 'cn'
import { StaticLayer } from '@/components/mergestudio/MergeInfiniteCanvas'
import MergeContextTitle from '@/components/workspace/MergeContextTitle'
import VisualRegionPicker from '@/components/mergestudio/VisualRegionPicker'
import MixFinishFooter from '@/components/mergestudio/MixFinishFooter'
import DraftCompareBoard from '@/components/mergestudio/DraftCompareBoard'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { allPeople, canvasPages } from '@/data/mockData'
import { draftScreens } from '@/data/draftScreens'
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
function Frame({ frame, effects, marks, onPress, label, fit = false }) {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  const [height, setHeight] = useState(0)
  useEffect(() => {
    if (!ref.current) return undefined
    const observer = new ResizeObserver(([entry]) => { setWidth(entry.contentRect.width); setHeight(entry.contentRect.height) })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  if (!frame) return <div className="flex h-28 items-center justify-center text-xs text-muted-foreground">No design preview</div>
  const scale = width ? Math.min(width / frame.width, fit ? height / frame.height : Infinity) : 0
  return (
    <button ref={ref} type="button" data-detail-frame onClick={onPress} aria-label={`${label} — 캔버스에서 보기`} title="캔버스에서 보기"
      className={cn("relative block w-full cursor-pointer overflow-hidden rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-primary", fit ? "min-h-0 flex-1" : "bg-white shadow-sm ring-1 ring-border")} style={fit ? undefined : { height: frame.height * scale }}>
      <span aria-hidden className="pointer-events-none absolute top-0 left-0 origin-top-left" style={{ width: frame.width, height: frame.height, background: "white", left: fit ? "50%" : 0, top: fit ? "50%" : 0, transform: fit ? `translate(-50%, -50%) scale(${scale})` : `scale(${scale})`, transformOrigin: fit ? "center" : "top left" }}>
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

export default function DesignDetail({ item, drawn, identical, conflict, status, compose, next, edit, selection = null, titleRef, onBack, readOnly = false, onDone }) {
  const { comments, addComment, showScreenIn, focusConflictPin, mixBridge, compositionEditing, comparePanelMode: comparisonMode, setComparePanelMode: setComparisonMode } = useWorkspace()
  // While the studio is mixing this set's drafts, they're drawn live here — the place the picking is done from
  // (a part into the Result, one whole draft); otherwise they're thumbnails.
  const live = compositionEditing && mixBridge && item && mixBridge.itemId === item.id ? mixBridge : null
  const [overlay, setOverlay] = useState(false)
  const [opacity, setOpacity] = useState(50)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(null)
  const marks = new Set()
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
  const composeReason = live ? '지금 이 시안들을 조합하고 있어요 — 캔버스에서 이어서 하세요' : readOnly ? '이 항목을 조합할 권한이 없어요' : waiting ? '검토 대기 중에는 조합할 수 없어요' : identical ? '두 버전이 동일해서 조합할 게 없어요' : composeAction?.disabled ? '비교할 시안을 2개 이상 골라 주세요' : !composeAction ? '지금은 조합할 수 없어요' : null
  const reviewReason = readOnly ? '이 항목을 검토할 권한이 없어요' : !next ? '검토할 변경이 아직 없어요' : null
  const rootButton = 'ds-intrinsic inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md text-[12px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-45'

  return (
    <div data-design-detail className="flex h-full min-h-0 flex-col bg-background text-[13px] text-foreground">
      <header className="flex h-12 shrink-0 items-center gap-1.5 pr-10 pl-2">
        <Tooltip>
          <TooltipTrigger ref={titleRef} data-compare-back aria-label="목록으로 (Esc)" onClick={onBack} className="ds-intrinsic flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary">
            <ArrowLeft className="size-4" />
          </TooltipTrigger>
          <TooltipContent side="bottom">목록으로 <span className="opacity-60">Esc</span></TooltipContent>
        </Tooltip>
        <MergeContextTitle item={item} />
      </header>

      <div className="min-h-0 flex-1 overflow-hidden px-3 pb-2">
        <div className="flex h-full min-h-0 flex-col gap-2">
          <section aria-label="비교" className="flex min-h-0 flex-1 flex-col">
            {!live && !draftScreens[item?.id] && (selection || canOverlay) && (
              <div className="mb-2 flex h-6 shrink-0 items-center gap-2 text-[10px] text-slate-500">
                {selection && <>
                  <span data-detail-selection aria-live="polite" className="tabular-nums">{selection.count}/{selection.total} 선택</span>
                  <button type="button" data-detail-select-all onClick={selection.all} className="ds-intrinsic rounded px-1 text-[10px] transition-colors hover:text-slate-200">{selection.allSelected ? '선택 해제' : '모두 선택'}</button>
                </>}
                {canOverlay && <Tooltip><TooltipTrigger data-detail-overlay-toggle aria-pressed={overlay} aria-label="겹쳐보기" onClick={() => setOverlay((on) => !on)} className={cn('ds-intrinsic ml-auto flex size-6 items-center justify-center rounded transition-colors hover:bg-white/[0.05]', overlay ? 'text-slate-200' : 'text-slate-500')}><Blend className="size-3.5" /></TooltipTrigger><TooltipContent side="bottom">겹쳐보기</TooltipContent></Tooltip>}
              </div>
            )}
            {live ? (
              <div data-detail-live className="flex min-h-0 flex-1 flex-col">
                <div className="mb-1 flex shrink-0 justify-end gap-1" role="tablist" aria-label="비교 방식">
                  {[['regions', '요소 선택'], ['whole', '전체 시안 비교']].map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={comparisonMode === id} data-comparison-mode={id} onClick={() => setComparisonMode(id)} className={cn('ds-intrinsic h-6 rounded px-1.5 text-[10px] transition-colors', comparisonMode === id ? 'bg-white/[0.08] text-white' : 'text-slate-500 hover:text-slate-200')}>{label}</button>)}
                </div>
                <div className="min-h-0 flex-1">
                  {comparisonMode === 'regions' ? <VisualRegionPicker item={item} live={live} /> : <DraftCompareBoard embedded item={item} options={live.options} frame={live.frame} decisions={live.decisions} onPick={live.onPick} onTakeAll={live.onTakeAll} />}
                </div>
              </div>
            ) : draftScreens[item?.id] ? (
              <DraftCompareBoard embedded item={item} options={drawn.map(({ option }) => option)} frame={canvasPages.find((page) => page.id === item.designPageId)?.frames[0]} decisions={{}} draftSelection={selection} />
            ) : overlay && canOverlay ? (
              <div className="flex flex-col gap-3">
                <Overlay drawn={drawn} opacity={opacity} marks={marks} onPress={seeOnCanvas} />
                <label className="flex items-center gap-3 text-xs text-muted-foreground">
                  원본
                  <input type="range" data-detail-opacity min={0} max={100} value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} aria-label="코드 불투명도" className="h-1 min-w-0 flex-1 accent-primary" />
                  코드 <span className="w-8 text-right tabular-nums">{opacity}%</span>
                </label>
              </div>
            ) : (
              <div className={cn('grid min-h-0 flex-1 gap-2 auto-rows-fr', drawn.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
                {drawn.map(({ option, frame, effects }, index) => (
                  <div key={option.key} data-detail-draft={option.key} className="flex min-h-0 min-w-0 flex-col gap-1">
                    <span className="flex h-5 shrink-0 items-center justify-between gap-1.5 text-[10px] text-muted-foreground">
                      <span className="min-w-0 truncate">{LABEL(option, index)}</span>
                      {selection && (
                        <button type="button" role="checkbox" aria-checked={selection.keys.includes(option.key)} aria-label={`${LABEL(option, index)} 선택`} data-detail-pick={option.key} onClick={() => selection.toggle(option.key)}
                          className={cn('ds-intrinsic flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary', selection.keys.includes(option.key) ? 'border-emerald-300/60 text-emerald-300' : 'border-white/20 text-slate-500 hover:border-white/40')}>
                          {selection.keys.includes(option.key) && <Check className="size-2.5" />}
                        </button>
                      )}
                    </span>
                    <Frame fit frame={frame} effects={effects} marks={marks} onPress={seeOnCanvas} label={LABEL(option, index)} />
                  </div>
                ))}
              </div>
            )}
          </section>



          {!live && list.length > 0 && (
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

          {!live && conflict && (
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
      {live ? <MixFinishFooter live={live} /> : <div data-detail-actions className="grid shrink-0 grid-cols-2 gap-2 border-t border-white/[0.06] px-3 py-2">
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
      </div>}
    </div>
  )
}
