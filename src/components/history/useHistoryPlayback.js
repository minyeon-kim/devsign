import { useEffect, useRef, useState } from 'react'

export function useHistoryPlayback(timeline, selectedId, select) {
  const [playing, setPlaying] = useState(false)
  const expected = useRef(null)
  const previous = useRef(selectedId)
  const selectRef = useRef(select)
  useEffect(() => { selectRef.current = select }, [select])
  const index = timeline.findIndex(entry => entry.id === selectedId)

  useEffect(() => {
    if (previous.current === selectedId) return
    previous.current = selectedId
    if (expected.current !== selectedId) setPlaying(false)
    expected.current = null
  }, [selectedId])

  useEffect(() => {
    if (!playing) return
    const next = timeline[index + 1]
    const timer = window.setTimeout(() => {
      if (!next || index < 0) { setPlaying(false); return }
      expected.current = next.id
      selectRef.current(next.id)
      if (index + 1 === timeline.length - 1) setPlaying(false)
    }, 1600)
    return () => window.clearTimeout(timer)
  }, [playing, index, timeline])

  function pause() { expected.current = null; setPlaying(false) }
  function toggle() {
    if (playing) { pause(); return }
    if (timeline.length < 2) return
    if (index < 0 || index === timeline.length - 1) {
      expected.current = timeline[0].id
      selectRef.current(timeline[0].id)
    }
    setPlaying(true)
  }
  return { playing, pause, toggle }
}
