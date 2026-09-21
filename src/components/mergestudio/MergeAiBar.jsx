import { useState } from 'react'
import { ArrowUp, Sparkles } from 'lucide-react'
import { useWorkspace } from '@/state/WorkspaceProvider'

// Always-visible AI input — `fixed` to the bottom center of the viewport
// so it stays put regardless of canvas pan/zoom or scrolling, floating
// above the canvas. Sends through the same chat pipeline as the
// "Ask Devsign" window.
function MergeAiBar() {
  const { sendChatMessage, isAiTyping } = useWorkspace()
  const [input, setInput] = useState('')

  function submit(event) {
    event.preventDefault()
    if (!input.trim()) return
    sendChatMessage(input)
    setInput('')
  }

  return (
    <form
      onSubmit={submit}
      className="fixed bottom-5 left-1/2 z-40 flex w-[min(560px,calc(100vw-8rem))] -translate-x-1/2 items-center gap-2 rounded-full border border-indigo-500/40 bg-card/95 py-1.5 pr-1.5 pl-4 shadow-2xl shadow-indigo-500/10 backdrop-blur-md focus-within:border-violet-500"
    >
      <Sparkles className="size-4 shrink-0 text-violet-500" />
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={isAiTyping ? 'Devsign AI is thinking…' : 'Ask AI to merge, restyle, or explain…'}
        className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
      <button
        type="submit"
        disabled={!input.trim()}
        title="Send"
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-white transition-opacity disabled:opacity-40"
      >
        <ArrowUp className="size-4" />
      </button>
    </form>
  )
}

export default MergeAiBar
