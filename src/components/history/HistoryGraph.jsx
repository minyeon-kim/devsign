import { useLayoutEffect, useState } from 'react'
import { historyGraphEdges } from '@/lib/historyGraph'

export default function HistoryGraph({ entries, visibleEntries, containerRef, selectedId }) {
  const [positions, setPositions] = useState({})
  useLayoutEffect(() => {
    const root = containerRef.current
    if (!root) return
    const measure = () => {
      const bounds = root.getBoundingClientRect()
      const next = {}
      root.querySelectorAll('[data-history-id]').forEach((row) => {
        next[row.dataset.historyId] = row.getBoundingClientRect().top - bounds.top + 17
      })
      setPositions(next)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    root.querySelectorAll('[data-history-id]').forEach((row) => observer.observe(row))
    return () => observer.disconnect()
  }, [containerRef, visibleEntries])
  const visible = new Set(visibleEntries.map((entry) => entry.id))
  const edges = historyGraphEdges(entries).filter((edge) => visible.has(edge.from) && visible.has(edge.to))
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-1 h-full w-12 overflow-visible" fill="none">
      {edges.map((edge, index) => {
        const y1 = positions[edge.from], y2 = positions[edge.to]
        if (y1 === undefined || y2 === undefined) return null
        const branch = edge.kind === 'merge' || edge.kind === 'restore'
        const x = edge.kind === 'restore' ? 40 : 28
        return <path key={`${edge.from}-${edge.to}-${index}`}
          d={branch ? `M 10 ${y1} C ${x} ${y1}, ${x} ${y1 + 12}, ${x} ${y1 + 20} L ${x} ${y2 - 20} C ${x} ${y2 - 12}, ${x} ${y2}, 10 ${y2}` : `M 10 ${y1} L 10 ${y2}`}
          stroke={edge.kind === 'restore' ? '#7dd3fc' : edge.kind === 'merge' ? '#6ee7b7' : '#64748b'}
          strokeWidth="1.5" strokeDasharray={edge.kind === 'sequence' || edge.kind === 'restore' ? '3 3' : undefined} opacity={branch ? .85 : .5} />
      })}
      {visibleEntries.map((entry) => positions[entry.id] === undefined ? null : (
        <g key={entry.id}>
          <circle cx="10" cy={positions[entry.id]} r={entry.id === selectedId ? 6 : 4} fill="var(--background)" stroke={entry.kind === 'merge' ? '#6ee7b7' : entry.kind === 'rollback' ? '#7dd3fc' : entry.id === selectedId ? '#f8fafc' : '#94a3b8'} strokeWidth="2" />
          {entry.kind === 'merge' && <circle cx="10" cy={positions[entry.id]} r="1.5" fill="#6ee7b7" />}
        </g>
      ))}
    </svg>
  )
}
