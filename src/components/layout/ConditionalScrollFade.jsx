import { useEffect } from 'react'

// CSS cannot tell whether a fixed-size scroll viewport currently has overflow.
// Track only elements that opt into the fade utility, then expose which edges
// have content beyond them so masks appear only while scrolling is possible.
function ConditionalScrollFade() {
  useEffect(() => {
    const tracked = new Set()
    let frame = 0

    function update(element) {
      const hasOverflow = element.scrollHeight > element.clientHeight + 1
      const hasContentBefore = hasOverflow && element.scrollTop > 1
      const hasContentAfter = hasOverflow && element.scrollTop + element.clientHeight < element.scrollHeight - 1
      element.dataset.scrollBefore = String(hasContentBefore)
      element.dataset.scrollAfter = String(hasContentAfter)
    }

    function scheduleUpdate() {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        tracked.forEach(update)
      })
    }

    function onScroll(event) {
      const element = event.target
      if (tracked.has(element)) update(element)
    }

    const resizeObserver = new ResizeObserver(scheduleUpdate)

    function syncElements() {
      const current = new Set(document.querySelectorAll('.scroll-fade-bottom'))
      tracked.forEach((element) => {
        if (current.has(element)) return
        element.removeEventListener('scroll', onScroll)
        resizeObserver.unobserve(element)
        tracked.delete(element)
      })
      current.forEach((element) => {
        if (!tracked.has(element)) {
          tracked.add(element)
          element.addEventListener('scroll', onScroll, { passive: true })
          resizeObserver.observe(element)
        }
        update(element)
      })
    }

    const mutationObserver = new MutationObserver(() => {
      syncElements()
      scheduleUpdate()
    })

    syncElements()
    mutationObserver.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    })
    window.addEventListener('resize', scheduleUpdate)
    document.addEventListener('load', scheduleUpdate, true)

    return () => {
      mutationObserver.disconnect()
      resizeObserver.disconnect()
      tracked.forEach((element) => element.removeEventListener('scroll', onScroll))
      tracked.clear()
      window.removeEventListener('resize', scheduleUpdate)
      document.removeEventListener('load', scheduleUpdate, true)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return null
}

export default ConditionalScrollFade
