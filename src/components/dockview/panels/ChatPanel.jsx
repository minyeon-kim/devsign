import { useNavigate } from 'react-router-dom'
import { History } from 'lucide-react'
import ChatConversation from '@/components/chat/ChatConversation'
import { WindowHeaderPortal } from '@/components/workspace/WindowHeaderSlot'
import { useWorkspace } from '@/state/WorkspaceProvider'

// The AI Chat pane — the "Ask Devsign" conversation docked into the
// workspace as a window (a tab or split pane like the editor or canvas),
// the same conversation as the floating chat widget. The agent's
// checkpoints (History) sit on the window's header line.
function ChatPanel() {
  const { projectId } = useWorkspace()
  const navigate = useNavigate()

  return (
    <div className="flex h-full flex-col bg-card pt-2">
      <WindowHeaderPortal fallbackClassName="flex shrink-0 justify-end px-2 pt-1">
        <button
          type="button"
          title="Agent checkpoints (History)"
          aria-label="Agent checkpoints (History)"
          onClick={() => navigate(`/projects/${projectId}/history`)}
          className="ml-auto flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        >
          <History className="size-3.5" />
        </button>
      </WindowHeaderPortal>
      <ChatConversation />
    </div>
  )
}

export default ChatPanel
