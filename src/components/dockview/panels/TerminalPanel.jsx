import { useWorkspace } from '@/state/WorkspaceProvider'
import AutoScrollList from '@/components/dockview/panels/AutoScrollList'

// The dockview tab strip above this panel ("Terminal" / "Console" / "Conflict
// Point") is the only tab row for this section — no internal Tabs component
// duplicating it underneath (see ConsolePanel for the sibling tab).
function TerminalPanel() {
  const { terminalEntries } = useWorkspace()

  return (
    <AutoScrollList
      entries={terminalEntries}
      className="h-full overflow-auto bg-card p-3 font-mono text-xs text-muted-foreground"
    />
  )
}

export default TerminalPanel
