import { useEffect, useRef, useState } from 'react'

// History playback. The selected checkpoint is the one being played: the
// viewer types the code from the checkpoint before it, and calls
// `advance()` when that's in and it has rested — which selects the next
// one. Checkpoints go in time order, whatever branch they're on. Selecting
// something by hand stops playback.
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

  function pause() { expected.current = null; setPlaying(false) }
  // The checkpoint in view has finished playing: on to the next, or stop
  // after the last.
  function advance() {
    const next = timeline[index + 1]
    if (!playing || !next) { pause(); return }
    expected.current = next.id
    selectRef.current(next.id)
  }
  function toggle() {
    if (playing) { pause(); return }
    if (timeline.length < 2) return
    if (index < 0 || index === timeline.length - 1) {
      expected.current = timeline[0].id
      selectRef.current(timeline[0].id)
    }
    setPlaying(true)
  }
  return { playing, pause, toggle, advance }
}
