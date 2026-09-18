import { useWorkspace } from '@/state/WorkspaceProvider'
import AutoScrollList from '@/components/dockview/panels/AutoScrollList'

// Split out from TerminalPanel so "Terminal" and "Console" are two native
// dockview tabs in one row (Chrome-style) instead of a second internal Tabs
// strip stacked underneath the dockview tab.
function ConsolePanel() {
  const { consoleEntries } = useWorkspace()

  return (
    <AutoScrollList
      entries={consoleEntries}
      className="h-full overflow-auto bg-card p-3 font-mono text-xs text-muted-foreground"
    />
  )
}

export default ConsolePanel
