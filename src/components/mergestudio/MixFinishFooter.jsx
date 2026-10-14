import { useState } from 'react'
import { Check, Send } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export default function MixFinishFooter({ live }) {
  const finish = live.getFinish?.()
  const [open, setOpen] = useState(false)
  const [reviewers, setReviewers] = useState(() => finish?.defaultReviewerIds ?? [])
  const [note, setNote] = useState('')
  if (!finish) return null
  const pending = finish.total - finish.picked
  const disabled = finish.readOnly || pending > 0 || finish.total === 0
  const warnings = finish.checks?.failing ?? []
  const button = 'ds-intrinsic flex h-8 items-center justify-center gap-1.5 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed'
  return <footer data-mix-finish className="flex shrink-0 items-center justify-between gap-2 border-t border-white/[0.06] px-3 py-2">
    <span aria-live="polite" className="text-[11px] text-slate-500">{finish.picked}/{finish.total} 선택{warnings.length > 0 && ` · 확인 ${warnings.length}개`}</span>
    {finish.requested || finish.done ? <span className="text-xs text-emerald-300">{finish.done ? '저장됨' : '병합 요청됨'}</span>
      : finish.kind === 'save' ? <button type="button" data-mix-save disabled={disabled} onClick={finish.onSave} className={button}><Check className="size-3.5" />조합 저장</button>
        : <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger data-mix-request-trigger disabled={disabled} className={button}><Send className="size-3.5" />병합 요청</PopoverTrigger>
          <PopoverContent data-mix-request side="top" align="end" className="w-72 space-y-3 rounded-xl border-white/10 bg-[#1C1C1C] p-3">
            <p className="text-xs font-medium text-slate-200">검토자 선택</p>
            {finish.reviewers.map((person) => <label key={person.id} className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={reviewers.includes(person.id)} onChange={() => setReviewers((prev) => prev.includes(person.id) ? prev.filter((id) => id !== person.id) : [...prev, person.id])} className="accent-emerald-300" />{person.name}</label>)}
            {warnings.length > 0 && <p className="text-[11px] leading-4 text-amber-300">확인할 항목 {warnings.length}개가 남아 있어요. 현재 조합과 함께 검토를 요청합니다.</p>}
            <textarea aria-label="병합 요청 메모" value={note} onChange={(event) => setNote(event.target.value)} placeholder="메모 (선택)" className="h-16 w-full resize-none rounded-md border border-white/10 bg-white/[0.04] p-2 text-xs text-slate-200" />
            <button type="button" data-mix-send disabled={!reviewers.length || disabled} onClick={() => { finish.onSend({ reviewerIds: reviewers, note: note.trim(), warnings: warnings.length }); setOpen(false) }} className={`${button} w-full`}>검토 요청 보내기</button>
          </PopoverContent>
        </Popover>}
  </footer>
}
