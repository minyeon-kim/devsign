import { useRef, useState } from 'react'
import { ArrowUp, ImagePlus, Mic, Sparkles, Square, X } from 'lucide-react'
import { cn } from 'cn'
import { useWorkspace } from '@/state/WorkspaceProvider'

// Always-visible AI composer — `fixed` to the bottom center of the viewport
// so it stays put regardless of canvas pan/zoom or scrolling, floating
// above the canvas. Sends through the same chat pipeline as the
// "Ask Devsign" window. A spacious multi-row layout (vs. a single-line
// pill) so image attachments and the mic toggle have real room, matching
// the composer in the "Ask Devsign" window.
function MergeAiBar() {
  const { sendChatMessage, isAiTyping } = useWorkspace()
  const [input, setInput] = useState('')
  const [images, setImages] = useState([])
  const [recording, setRecording] = useState(false)
  const fileInputRef = useRef(null)

  function submit(event) {
    event.preventDefault()
    if (!input.trim() && images.length === 0) return
    const prefix = images.length ? `[${images.length} image${images.length === 1 ? '' : 's'} attached] ` : ''
    sendChatMessage(`${prefix}${input.trim()}`)
    setInput('')
    setImages([])
  }

  function onPickImages(event) {
    const files = [...(event.target.files ?? [])].map((f) => f.name)
    if (files.length) setImages((prev) => [...prev, ...files])
    event.target.value = ''
  }

  // Mock voice input: toggles a recording indicator and, on stop, drops a
  // placeholder transcript into the input — there's no real mic capture.
  function toggleRecording() {
    if (recording) {
      setInput((prev) => (prev ? `${prev} ` : '') + 'Make the primary button match the incoming design.')
    }
    setRecording((was) => !was)
  }

  return (
    <form
      onSubmit={submit}
      className="fixed bottom-5 left-1/2 z-40 w-[min(680px,calc(100vw-4rem))] -translate-x-1/2 rounded-3xl border border-indigo-500/40 bg-card/95 p-3 shadow-2xl shadow-indigo-500/10 backdrop-blur-md focus-within:border-violet-500"
    >
      {images.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {images.map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="flex items-center gap-1.5 rounded-full border bg-muted px-2.5 py-1 text-xs text-foreground/80"
            >
              <ImagePlus className="size-3.5 shrink-0" />
              <span className="max-w-32 truncate">{name}</span>
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                title="Remove"
              >
                <X className="size-3 text-muted-foreground hover:text-foreground" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-start gap-3">
        <Sparkles className="mt-2.5 size-5 shrink-0 text-violet-500" />
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit(e)
            }
          }}
          rows={2}
          placeholder={
            recording
              ? 'Listening…'
              : isAiTyping
                ? 'Devsign AI is thinking…'
                : 'Ask AI to merge, restyle, or explain… (attach a screenshot or use voice)'
          }
          className="min-h-14 min-w-0 flex-1 resize-none bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={onPickImages} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Attach image"
          className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ImagePlus className="size-4.5" />
        </button>
        <button
          type="button"
          onClick={toggleRecording}
          title={recording ? 'Stop recording' : 'Voice input'}
          className={cn(
            'flex size-9 items-center justify-center rounded-full transition-colors',
            recording ? 'bg-destructive/15 text-destructive' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          {recording ? <Square className="size-4 fill-current" /> : <Mic className="size-4.5" />}
        </button>
        {recording && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-destructive">
            <span className="size-1.5 animate-pulse rounded-full bg-destructive" />
            Recording…
          </span>
        )}

        <button
          type="submit"
          disabled={!input.trim() && images.length === 0}
          title="Send"
          className="ml-auto flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white transition-opacity disabled:opacity-40"
        >
          <ArrowUp className="size-4.5" />
        </button>
      </div>
    </form>
  )
}

export default MergeAiBar
