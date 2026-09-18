import { useEffect, useRef, useState } from 'react'
import {
  Braces,
  ChevronDown,
  Code2,
  FileCode,
  GripHorizontal,
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

const ICON_SIZE = 48
const MODAL_WIDTH = 400
const MODAL_HEIGHT = 560
const MARGIN = 16
const ICON_RADIUS = ICON_SIZE / 2
const MODAL_RADIUS = 28

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-2xl bg-muted px-3 py-2.5">
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
      </div>
    </div>
  )
}

// The floating "Ask Devsign" entry point and its expanded conversation
// window are the *same element* — clicking the icon morphs it (via a CSS
// transition on left/top/width/height/border-radius, all explicit pixel
// values so the browser can smoothly interpolate) into a freely draggable
// window, and the close button reverses the animation back down into the
// icon at its fixed corner.
function ChatMorphWidget() {
  const { chatMessages, isAiTyping, sendChatMessage } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const [windowSize, setWindowSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }))
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState([])
  const [codeBlockMode, setCodeBlockMode] = useState(false)
  const [model, setModel] = useState(aiModels[1] ?? aiModels[0])
  const [autoMode, setAutoMode] = useState(true)
  const [agentLogOpen, setAgentLogOpen] = useState(false)
  const dragRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    function onResize() {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!open) return
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [chatMessages, isAiTyping, open])

  const iconLeft = windowSize.width - MARGIN - ICON_SIZE
  const iconTop = windowSize.height - MARGIN - ICON_SIZE

  function clamp(value, size, max) {
    return Math.min(Math.max(value, MARGIN), Math.max(MARGIN, max - size - MARGIN))
  }

  function openWidget() {
    setPos((prev) => {
      if (prev) return prev
      // First open: land the window so its bottom-right corner lines up
      // with the icon's, so the morph reads as the icon growing in place.
      return {
        left: clamp(iconLeft + ICON_SIZE - MODAL_WIDTH, MODAL_WIDTH, windowSize.width),
        top: clamp(iconTop + ICON_SIZE - MODAL_HEIGHT, MODAL_HEIGHT, windowSize.height),
      }
    })
    setOpen(true)
  }

  function closeWidget() {
    setOpen(false)
  }

  function handleDragStart(event) {
    event.preventDefault()
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startLeft: pos?.left ?? iconLeft,
      startTop: pos?.top ?? iconTop,
    }
    function onMove(moveEvent) {
      const { startX, startY, startLeft, startTop } = dragRef.current
      setPos({
        left: clamp(startLeft + (moveEvent.clientX - startX), MODAL_WIDTH, windowSize.width),
        top: clamp(startTop + (moveEvent.clientY - startY), MODAL_HEIGHT, windowSize.height),
      })
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

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

  const rect = open
    ? {
        left: pos?.left ?? iconLeft,
        top: pos?.top ?? iconTop,
        width: MODAL_WIDTH,
        height: MODAL_HEIGHT,
        radius: MODAL_RADIUS,
      }
    : { left: iconLeft, top: iconTop, width: ICON_SIZE, height: ICON_SIZE, radius: ICON_RADIUS }

  return (
    <>
      <div
        style={{
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          borderRadius: rect.radius,
        }}
        className={cn(
          'fixed z-30 flex flex-col overflow-hidden shadow-xl transition-[left,top,width,height,border-radius] duration-300 ease-in-out',
          open
            ? 'border bg-card/98 backdrop-blur-sm'
            : 'bg-primary text-primary-foreground shadow-primary/30'
        )}
      >
        {open ? (
          <>
            <div
              onPointerDown={handleDragStart}
              title="Drag to reposition"
              className="flex shrink-0 cursor-grab items-center gap-1.5 border-b px-3 py-2 active:cursor-grabbing"
            >
              <GripHorizontal className="size-3.5 text-muted-foreground/50" />
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
              <Button type="button" variant="ghost" size="icon-sm" title="Close" onClick={closeWidget}>
                <X className="size-3.5" />
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
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={2}
                  placeholder="Ask Devsign to tweak the design or code..."
                  className="w-full resize-none border-none bg-transparent px-3 py-2 text-xs outline-none placeholder:text-muted-foreground"
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
                    <Button type="button" size="icon" onClick={handleSend} disabled={!input.trim()}>
                      <Send className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={openWidget}
            className="flex size-full items-center justify-center transition-transform hover:scale-105 active:scale-95"
          >
            <Sparkles className="size-5 animate-pulse" />
          </button>
        )}
      </div>
    </>
  )
}

export default ChatMorphWidget
