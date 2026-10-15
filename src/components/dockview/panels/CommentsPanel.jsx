import { useState } from 'react'
import { ChevronDown, Heart, Paperclip, Reply, Send } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { allPeople } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'

function CommentItem({ comment }) {
  const { setCommentStatus, toggleCommentLike } = useWorkspace()
  const author = allPeople.find((p) => p.id === comment.authorId)

  return (
    // (A row of the app's lists — History, the change list, Merge's, the Inbox: no box, 14px round on hover; the
    // name as the title, the time at the right, quieter; then what was said, and its actions a step quieter still.)
    <div data-comment-row className="rounded-[14px] px-3 py-2.5 transition-colors hover:bg-white/[0.04]">
      <div className="flex items-start gap-2">
        <span
          className={cn(
            'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[8px] font-semibold text-white',
            author?.colorClass
          )}
        >
          {author?.initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <div className="min-w-0 truncate text-[13px] leading-5">
              <span className="font-medium text-slate-100">{author?.name}</span>{' '}
              <span className="text-[11.5px] text-slate-500">{author?.role}</span>
            </div>
            <span className="shrink-0 text-[11.5px] text-slate-500 tabular-nums">
              {comment.timeLabel}
            </span>
          </div>
          <p className="mt-0.5 text-[13px] leading-5 text-slate-300">{comment.text}</p>

          <div className="mt-1.5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => toggleCommentLike(comment.id)}
              className={cn(
                'flex items-center gap-1 text-[11.5px] text-slate-500 hover:text-slate-200',
                comment.liked && 'text-destructive hover:text-destructive'
              )}
            >
              <Heart className={cn('size-3', comment.liked && 'fill-current')} />
              {comment.likes}
            </button>
            <span className="flex items-center gap-1 text-[11.5px] text-slate-500">
              <Reply className="size-3" />
              {comment.replies}
            </span>

            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  'ml-auto flex h-5 items-center gap-1 rounded-full px-1.5 text-[10.5px] font-medium',
                  comment.status === 'open'
                    ? 'bg-amber-300/[0.14] text-amber-200'
                    : 'bg-emerald-400/[0.14] text-emerald-200'
                )}
              >
                {comment.status === 'open' ? 'Open' : 'Resolved'}
                <ChevronDown className="size-2.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setCommentStatus(comment.id, 'open')}>
                  Open
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCommentStatus(comment.id, 'resolved')}>
                  Resolved
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  )
}

function CommentsPanel() {
  const { comments, addComment } = useWorkspace()
  const [draft, setDraft] = useState('')

  const openCount = comments.filter((c) => c.status === 'open').length

  function handleSend() {
    if (!draft.trim()) return
    addComment(draft)
    setDraft('')
  }

  return (
    // h-full covers the plain-block dockview-panel context; min-h-0 flex-1
    // additionally let it stretch correctly when it's a flex child instead
    // (the right-floating-toolbar's expanded panel), where percentage
    // heights on a flex item don't reliably resolve without an explicit
    // flex-grow.
    //
    // No internal All/Open/Resolved tab row here — when this panel is shown
    // inside the right floating toolbar's flyout, that row would stack
    // directly under the flyout's own Comment/History/Share switcher,
    // exactly the double-tab-row layout the Chrome-style pass eliminated
    // elsewhere. A single count line replaces it; each comment's own status
    // badge still shows (and can change) its open/resolved state.
    <div className="flex h-full min-h-0 flex-1 flex-col bg-card">
      {/* (Its head as the lists' group heads: the name and how many, quiet.) */}
      <div className="flex h-9 shrink-0 items-center justify-between px-4 text-[12px]">
        <span className="font-semibold text-slate-400">Comments <span className="font-normal text-slate-500 tabular-nums">{comments.length}</span></span>
        <span className="text-[11.5px] text-slate-500">
          {openCount} open
        </span>
      </div>

      <div className="scroll-fade-bottom min-h-0 flex-1 space-y-0.5 overflow-auto px-1.5 pb-2">
        {comments.length === 0 && (
          <p className="p-2 text-xs text-muted-foreground">No comments yet.</p>
        )}
        {comments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} />
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t p-2">
        <Button type="button" variant="ghost" size="icon" className="shrink-0">
          <Paperclip className="size-3.5" />
        </Button>
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              handleSend()
            }
          }}
          placeholder="Write a comment..."
          className="h-8 flex-1 text-xs"
        />
        <Button type="button" size="icon" onClick={handleSend} disabled={!draft.trim()}>
          <Send className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

export default CommentsPanel
