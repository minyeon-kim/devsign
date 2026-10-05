import { useEffect, useRef, useState } from 'react'

// History playback. A step isn't a timer: the viewer types the code from
// the selected checkpoint to the next one and calls `advance()` when it's
// in — only then does the selection (and the timeline's handle) move on.
// Selecting something by hand stops playback.
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

  // Landed on the last checkpoint: nothing left to play.
  useEffect(() => {
    if (playing && !expected.current && index === timeline.length - 1) setPlaying(false)
  }, [playing, index, timeline.length])

  function pause() { expected.current = null; setPlaying(false) }
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
