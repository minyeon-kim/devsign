import { History as HistoryIcon } from 'lucide-react'
import { allPeople, versionHistoryLog } from '@/data/mockData'

function VersionHistoryPanel() {
  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b px-3 text-xs font-medium">
        <HistoryIcon className="size-3.5 text-primary" />
        Version History
      </div>

      <div className="flex-1 overflow-auto p-3">
        <p className="mb-2 text-[11px] text-muted-foreground">
          Project-wide version changes and activity.
        </p>
        <div className="relative pl-5">
          <div className="absolute top-1 bottom-1 left-[7px] w-px bg-border" />

          {versionHistoryLog.map((entry) => {
            const author = allPeople.find((p) => p.id === entry.authorId)
            return (
              <div key={entry.id} className="relative mb-3 last:mb-0">
                <span
                  className={`absolute -left-5 top-1 flex size-2.5 items-center justify-center rounded-full text-[6px] font-bold text-white ${author?.colorClass ?? 'bg-muted-foreground'}`}
                />
                <div className="text-xs">
                  <span className="font-medium text-foreground">{author?.name}</span>{' '}
                  <span className="text-foreground/80">{entry.action}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{entry.timestamp}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default VersionHistoryPanel
