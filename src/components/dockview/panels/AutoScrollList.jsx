import { useEffect, useRef } from 'react'

// Shared by TerminalPanel and ConsolePanel — auto-scrolls to the bottom as
// new log entries stream in.
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

export default AutoScrollList
