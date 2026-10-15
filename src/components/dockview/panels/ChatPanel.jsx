import ChatConversation from '@/components/chat/ChatConversation'

// The AI Chat pane — the "Ask Devsign" conversation docked into the
// workspace as a window (a tab or split pane like the editor or canvas),
// the same conversation as the floating chat widget. (No checkpoints button
// over it: History is the activity bar's, and the conversation starts at the
// window's top, level with the canvas window's tab row.)
function ChatPanel() {
  return (
    // (On its window's own surface — the Workspace's AI Chat is on the app's ground, #141414.)
    <div className="flex h-full flex-col">
      <ChatConversation />
    </div>
  )
}

export default ChatPanel
