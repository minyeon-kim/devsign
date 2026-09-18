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
    <div className="rounded-2xl border bg-background p-3">
      <div className="flex items-start gap-2">
        <span
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-white',
            author?.colorClass
          )}
        >
          {author?.initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="truncate text-xs">
              <span className="font-medium">{author?.name}</span>{' '}
              <span className="text-muted-foreground">({author?.role})</span>
            </div>
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {comment.timeLabel}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-foreground/90">{comment.text}</p>

          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => toggleCommentLike(comment.id)}
              className={cn(
                'flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground',
                comment.liked && 'text-destructive hover:text-destructive'
              )}
            >
              <Heart className={cn('size-3', comment.liked && 'fill-current')} />
              {comment.likes}
            </button>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Reply className="size-3" />
              {comment.replies}
            </span>

            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  'ml-auto flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
                  comment.status === 'open'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-500'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
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
      <div className="flex h-9 shrink-0 items-center justify-between border-b px-3 text-xs">
        <span className="font-medium text-foreground">Comments</span>
        <span className="text-muted-foreground">
          {comments.length} total · {openCount} open
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-auto p-2">
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
