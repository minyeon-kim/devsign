import { useEffect, useRef, useState } from 'react'
import {
  Braces,
  ChevronDown,
  Code2,
  FileCode,
  History,
  MessageCircle,
  Paperclip,
  Pin,
  Send,
  Sparkles,
  X,
} from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import AgentHistoryModal from '@/components/modals/AgentHistoryModal'
import { aiModels, chatSuggestions } from '@/data/mockData'
import { useWorkspace } from '@/state/WorkspaceProvider'

const suggestionIcons = { MessageCircle, Sparkles, Pin }
const attachablePool = ['DesignCanvas.jsx', 'theme.css', 'tokens.json', 'screenshot.png']

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-lg bg-muted px-3 py-2.5">
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
      </div>
    </div>
  )
}

function ChatPanel() {
  const { chatMessages, isAiTyping, sendChatMessage } = useWorkspace()
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState([])
  const [codeBlockMode, setCodeBlockMode] = useState(false)
  const [model, setModel] = useState(aiModels[1] ?? aiModels[0])
  const [autoMode, setAutoMode] = useState(true)
  const [agentLogOpen, setAgentLogOpen] = useState(false)
  const listRef = useRef(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [chatMessages, isAiTyping])

  function handleSend() {
    if (!input.trim()) return
    sendChatMessage(input)
    setInput('')
    setAttachments([])
    setCodeBlockMode(false)
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  function handleAttach() {
    setAttachments((prev) => {
      const next = attachablePool.find((f) => !prev.includes(f))
      return next ? [...prev, next] : prev
    })
  }

  function removeAttachment(name) {
    setAttachments((prev) => prev.filter((f) => f !== name))
  }

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex shrink-0 items-center gap-1.5 border-b px-3 py-2">
        <Sparkles className="size-4 text-primary" />
        <span className="flex-1 text-sm font-semibold">Ask Devsign</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Agent Log"
          onClick={() => setAgentLogOpen(true)}
        >
          <History className="size-3.5" />
        </Button>
      </div>

      <AgentHistoryModal open={agentLogOpen} onOpenChange={setAgentLogOpen} />

      <div className="flex shrink-0 flex-wrap gap-1.5 border-b px-3 py-2">
        {chatSuggestions.map((suggestion) => {
          const Icon = suggestionIcons[suggestion.iconName]
          return (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => sendChatMessage(suggestion.prompt)}
              className="flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-[11px] text-foreground/80 transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {Icon && <Icon className="size-3 text-primary" />}
              {suggestion.label}
            </button>
          )
        })}
      </div>

      <div ref={listRef} className="flex-1 space-y-2 overflow-auto p-3">
        {chatMessages.map((message) => (
          <div
            key={message.id}
            className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed',
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              )}
            >
              {message.text}
            </div>
          </div>
        ))}
        {isAiTyping && <TypingBubble />}
      </div>

      <div className="shrink-0 space-y-1.5 border-t p-2">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1">
            {attachments.map((file) => (
              <span
                key={file}
                className="flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-[10px] text-foreground/80"
              >
                <FileCode className="size-2.5" />
                {file}
                <button type="button" onClick={() => removeAttachment(file)}>
                  <X className="size-2.5 text-muted-foreground hover:text-foreground" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="rounded-3xl border bg-background">
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Devsign to tweak the design or code..."
            className="h-8 border-none bg-transparent text-xs shadow-none focus-visible:ring-0"
          />
          <div className="flex items-center justify-between px-1.5 pb-1.5">
            <div className="flex items-center gap-0.5">
              <Button type="button" variant="ghost" size="icon-xs" onClick={handleAttach}>
                <Paperclip className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setCodeBlockMode((v) => !v)}
                className={cn(codeBlockMode && 'bg-primary/10 text-primary')}
              >
                <Code2 className="size-3.5" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1 rounded-full px-1.5 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground">
                  <Braces className="size-3" />
                  {model}
                  <ChevronDown className="size-2.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuRadioGroup value={model} onValueChange={setModel}>
                    {aiModels.map((option) => (
                      <DropdownMenuRadioItem key={option} value={option}>
                        {option}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                Auto
                <Switch checked={autoMode} onCheckedChange={setAutoMode} size="sm" />
              </label>
              <Button
                type="button"
                size="icon"
                onClick={handleSend}
                disabled={!input.trim()}
              >
                <Send className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatPanel
