import { useEffect, useRef, useState } from 'react'
import { SquareTerminal } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useWorkspace } from '@/state/WorkspaceProvider'

function AutoScrollList({ entries, className }) {
  const ref = useRef(null)

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' })
  }, [entries.length])

  return (
    <div ref={ref} className={className}>
      {entries.map((entry) => (
        <div key={entry.id} className="animate-in fade-in slide-in-from-bottom-1 duration-200">
          {entry.text}
        </div>
      ))}
    </div>
  )
}

function TerminalPanel() {
  const [tab, setTab] = useState('terminal')
  const { terminalEntries, consoleEntries } = useWorkspace()

  return (
    <Tabs
      value={tab}
      onValueChange={setTab}
      className="flex h-full flex-col gap-0 bg-card"
    >
      <div className="flex h-9 shrink-0 items-center border-b px-2">
        <TabsList variant="line">
          <TabsTrigger value="terminal" className="gap-1.5">
            <SquareTerminal className="size-3.5" />
            Terminal
          </TabsTrigger>
          <TabsTrigger value="console" className="gap-1.5">
            Console
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="terminal" className="flex-1 overflow-hidden">
        <AutoScrollList
          entries={terminalEntries}
          className="h-full overflow-auto p-3 font-mono text-xs text-muted-foreground"
        />
      </TabsContent>

      <TabsContent value="console" className="flex-1 overflow-hidden">
        <AutoScrollList
          entries={consoleEntries}
          className="h-full overflow-auto p-3 font-mono text-xs text-muted-foreground"
        />
      </TabsContent>
    </Tabs>
  )
}

export default TerminalPanel
