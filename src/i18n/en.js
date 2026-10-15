// Korean written in the source — a seed's sentences, a step's name, a hint — in English: translate.js's
// English direction reads it. `en`: whole strings; `enTemplates`: strings with values in them ({0}, {1}, …).
export const en = {
 "\"조정 완료\"를 누른 뒤 위쪽의 \"병합 요청\"으로 이어갑니다.": "Press \"Done adjusting,\" then continue with \"Request merge\" above.",
 "\"조정 완료\"를 눌러 변경 내역에서 결과를 확인합니다.": "Press \"Done adjusting\" to see the result in the change history.",
 "\"조정 완료\"를 눌러 변경 내역으로 돌아가 검토를 요청합니다.": "Press \"Done adjusting\" to return to the change history and request a review.",
 "#7c3aed 고정 → 디자인은 44px": "#7c3aed fixed → design is 44px",
 "(선택)": "(Optional)",
 "(수정됨)": "(Edited)",
 "))\n        }\n\n        const next = { paths, anchor, pins, boxes }\n        setLinks((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))\n      }\n      raf = requestAnimationFrame(measure)\n    }\n    raf = requestAnimationFrame(measure)\n    return () => cancelAnimationFrame(raf)\n  }, [hasSelection, selectionKey, syncSelection?.layerId, frameSel, annotations, item.id, designCompare])\n\n  const zoomAt = useCallback((nextZoom, cx, cy) => {\n    setView((v) => {\n      const zoom = clampZoom(nextZoom)\n      const k = zoom / v.zoom\n      return { zoom, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k }\n    })\n  }, [])\n\n  \n  \n  useEffect(() => {\n    const el = viewportRef.current\n    if (!el) return\n    function onWheel(e) {\n      if (e.target.closest?.('[data-code-scroll]') && !e.ctrlKey && !e.metaKey) return\n      \n      if (e.target.closest?.('[data-device-scroll]') && !e.ctrlKey && !e.metaKey) return\n      e.preventDefault()\n      const rect = el.getBoundingClientRect()\n      if (e.ctrlKey || e.metaKey) {\n        zoomAt(viewRef.current.zoom * Math.exp(-e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top)\n      } else {\n        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }))\n      }\n    }\n    el.addEventListener('wheel', onWheel, { passive: false })\n    \n    \n    \n    let gestureStart = null\n    function onGestureStart(e) {\n      e.preventDefault()\n      gestureStart = viewRef.current.zoom\n    }\n    function onGestureChange(e) {\n      e.preventDefault()\n      if (gestureStart == null) return\n      const rect = el.getBoundingClientRect()\n      zoomAt(gestureStart * e.scale, e.clientX - rect.left, e.clientY - rect.top)\n    }\n    function onGestureEnd(e) {\n      e.preventDefault()\n      gestureStart = null\n    }\n    el.addEventListener('gesturestart', onGestureStart, { passive: false })\n    el.addEventListener('gesturechange', onGestureChange, { passive: false })\n    el.addEventListener('gestureend', onGestureEnd, { passive: false })\n    return () => {\n      el.removeEventListener('wheel', onWheel)\n      el.removeEventListener('gesturestart', onGestureStart)\n      el.removeEventListener('gesturechange', onGestureChange)\n      el.removeEventListener('gestureend', onGestureEnd)\n    }\n  }, [zoomAt])\n\n  \n  \n  function pickResultFrame(id) {\n    const dev = RESULT_DEVICES.find((entry) => entry.id === id)\n    const w = layout.result?.w ?? ARTBOARD_PREVIEW_WIDTH\n    const next = { ...layout, result: { ...layout.result, h: dev ? (w * dev.h) / dev.w : null } }\n    setResultDevice(id ?? null)\n    setLayout(next)\n    setView(fitView(next, { only: ['result'] }))\n  }\n\n  function zoomFromCenter(delta) {\n    const rect = viewportRef.current.getBoundingClientRect()\n    zoomAt(viewRef.current.zoom + delta, rect.width / 2, rect.height / 2)\n  }\n\n\n  function startPan(e) {\n    if (e.target !== e.currentTarget || e.button !== 0) return\n    beginPan(e)\n  }\n  \n  function beginPan(e) {\n    if (e.button !== 0) return\n    e.preventDefault()\n    const start = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y }\n    setPanning(true)\n    setAiStage(null)\n    setOpenNote(null)\n    function onMove(m) {\n      setView((v) => ({ ...v, x: start.vx + m.clientX - start.px, y: start.vy + m.clientY - start.py }))\n    }\n    function onUp() {\n      setPanning(false)\n      window.removeEventListener('pointermove', onMove)\n      window.removeEventListener('pointerup', onUp)\n    }\n    window.addEventListener('pointermove', onMove)\n    window.addEventListener('pointerup', onUp)\n  }\n\n  \n  \n  function dragView(e) {\n    const start = { px: e.clientX, py: e.clientY, vx: viewRef.current.x, vy: viewRef.current.y }\n    let moved = false\n    function onMove(m) {\n      const dx = m.clientX - start.px\n      const dy = m.clientY - start.py\n      if (!moved && Math.hypot(dx, dy) < 4) return\n      if (!moved) { moved = true; setPanning(true) }\n      setView((v) => ({ ...v, x: start.vx + dx, y: start.vy + dy }))\n    }\n    function onUp() {\n      if (moved) {\n        setPanning(false)\n        suppressClick.current = true\n        setTimeout(() => (suppressClick.current = false), 0)\n      }\n      window.removeEventListener('pointermove', onMove)\n      window.removeEventListener('pointerup', onUp)\n    }\n    window.addEventListener('pointermove', onMove)\n    window.addEventListener('pointerup', onUp)\n  }\n\n  \n  \n  \n  function startCardDrag(key) {\n    return (e) => {\n      if (e.button !== 0) return\n      if (e.target.closest('button, input, [data-code-scroll]')) return\n      e.stopPropagation()\n      \n      \n      \n      if (designCompare) {\n        dragView(e)\n        return\n      }\n      const start = { px: e.clientX, py: e.clientY, cx: layout[key].x, cy: layout[key].y }\n      let moved = false\n      setOrder((o) => ({ ...o, [key]: Math.max(...Object.values(o)) + 1 }))\n      function onMove(m) {\n        const dx = m.clientX - start.px\n        const dy = m.clientY - start.py\n        if (!moved && Math.hypot(dx, dy) < 4) return\n        moved = true\n        const scale = viewRef.current.zoom / 100\n        setLayout((l) => ({ ...l, [key]: { x: start.cx + dx / scale, y: start.cy + dy / scale } }))\n      }\n      function onUp() {\n        if (moved) {\n          suppressClick.current = true\n          setTimeout(() => (suppressClick.current = false), 0)\n        }\n        window.removeEventListener('pointermove', onMove)\n        window.removeEventListener('pointerup', onUp)\n      }\n      window.addEventListener('pointermove', onMove)\n      window.addEventListener('pointerup', onUp)\n    }\n  }\n\n  function swallowDragClick(e) {\n    if (suppressClick.current) {\n      e.stopPropagation()\n      e.preventDefault()\n    }\n  }\n\n  \n  \n  \n  function startResize(key) {\n    const min = key === 'code' ? { w: 320, h: 180 } : { w: 120, h: 120 }\n    return (dir) => (e) => {\n      if (e.button !== 0) return\n      e.stopPropagation()\n      e.preventDefault()\n      const rect = e.currentTarget.parentElement.getBoundingClientRect()\n      const k = viewRef.current.zoom / 100\n      const start = { px: e.clientX, py: e.clientY, w: rect.width / k, h: rect.height / k }\n      function onMove(m) {\n        const scale = viewRef.current.zoom / 100\n        const w = dir.includes('e') ? Math.max(min.w, start.w + (m.clientX - start.px) / scale) : start.w\n        const h = dir.includes('s') ? Math.max(min.h, start.h + (m.clientY - start.py) / scale) : start.h\n        setLayout((l) => ({ ...l, [key]: { ...l[key], w, h } }))\n      }\n      function onUp() {\n        window.removeEventListener('pointermove', onMove)\n        window.removeEventListener('pointerup', onUp)\n      }\n      window.addEventListener('pointermove', onMove)\n      window.addEventListener('pointerup', onUp)\n    }\n  }\n\n  \n  \n  \n  const overrides = { ...edits }\n  for (const [layerId, assembly] of Object.entries(assemblies ?? {})) {\n    const layer = (frameOverrideB ?? frame)?.layers.find((l) => l.id === layerId)\n    const o = layer && assemblyToOverride(assembly, layer)\n    if (o) overrides[layerId] = mergeOverride(overrides[layerId], o)\n  }\n  \n  \n  for (const [layerId, o] of Object.entries(codeOverrides(item.id, frame, syncedCode ?? manualCode, getFileLines))) {\n    overrides[layerId] = mergeOverride(overrides[layerId], o)\n  }\n  \n  \n  \n  \n  for (const [layerId, e] of Object.entries(variantPreviews ?? {})) {\n    const base = overrides[layerId]\n    const exact = assemblies?.[layerId] ?? {}\n    overrides[layerId] = {\n      ...base,\n      radius: exact.radius !== undefined || exact.shape ? base?.radius : (e.radius ?? base?.radius),\n      fontWeight: e.fontWeight ?? base?.fontWeight,\n      dw: (base?.dw ?? 0) + (exact.width !== undefined ? 0 : (e.dw ?? 0)),\n      dh: (base?.dh ?? 0) + (exact.height !== undefined ? 0 : (e.dh ?? 0)),\n      className: base?.className ?? e.className,\n      \n      ...(e.extraClass && { extraClass: [e.extraClass, base?.extraClass].filter(Boolean).join(' ') }),\n      ...((e.copy || base?.copy) && { copy: { ...e.copy, ...base?.copy } }),\n      ...(e.fillStyle && !base?.fillStyle && { fillStyle: e.fillStyle }),\n    }\n  }\n  if (appliedPreset?.layerId) overrides[appliedPreset.layerId] = { ...overrides[appliedPreset.layerId], className: appliedPreset.previewClass }\n\n  const scale = view.zoom / 100\n  const gridSize = 18 * scale\n  \n  const leftInset = 16\n\n  return (\n    \n    \n    \n    \n    \n    <div className=\"relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#1C1C1C]\">\n      <div ref={containerRef} className=\"relative min-h-0 flex-1\">\n        {}\n        {designCompare && (() => {\n          const ko = getLanguage() === 'ko'\n          const BUTTON = 'flex h-7 min-w-7 shrink-0 cursor-pointer items-center justify-center rounded-full px-1.5 text-[11px] font-medium text-slate-200 transition-colors hover:bg-white/[0.08] hover:text-white disabled:pointer-events-none disabled:opacity-30'\n          \n          \n          const tools = (\n            <div data-result-header data-merge-canvas-bar className=\"pointer-events-auto flex shrink-0 items-center gap-0.5 rounded-full border border-white/10 bg-card/95 p-0.5 shadow-lg backdrop-blur-sm\">\n              {}\n              {}\n              <div data-result-zoom className=\"pointer-events-auto flex h-7 shrink-0 items-center gap-0.5 rounded-md p-0.5 \">\n                <button type=\"button\" data-view-fit title={ko ? '맞춤' : 'Fit'} aria-label={ko ? '맞춤' : 'Fit'} onClick={() => setView(fitView(layout, { only: ['result'] }))} className={BUTTON}><Maximize className=\"size-3.5\" /></button>\n                <button type=\"button\" aria-label={ko ? '축소' : 'Zoom out'} onClick={() => zoomFromCenter(-10)} className={BUTTON}><Minus className=\"size-3.5\" /></button>\n                <span data-view-zoom className=\"min-w-10 text-center text-[11px] text-slate-300 tabular-nums\">{Math.round(view.zoom)}%</span>\n                <button type=\"button\" aria-label={ko ? '확대' : 'Zoom in'} onClick={() => zoomFromCenter(10)} className={BUTTON}><Plus className=\"size-3.5\" /></button>\n              </div>\n              <button\n                type=\"button\"\n                data-result-preview\n                title={ko ? '결과를 크게 미리보기 · 기기별 (Esc로 닫기)' : 'Preview the result large · per device (Esc closes)'}\n                onClick={() => setMergePreviewOpen(true)}\n                aria-label={ko ? '결과 크게 보기' : 'View the result large'}\n                className={BUTTON}\n              >\n                <Expand className=\"size-3.5\" />\n              </button>\n              <span aria-hidden className=\"mx-0.5 h-4 w-px bg-white/10\" />\n              <button type=\"button\" aria-label=\"Undo\" title=\"Undo\" disabled={!editHistory?.canUndo} onClick={editHistory?.undo} className={BUTTON}><Undo2 className=\"size-3.5\" /></button>\n              <button type=\"button\" aria-label=\"Redo\" title=\"Redo\" disabled={!editHistory?.canRedo} onClick={editHistory?.redo} className={BUTTON}><Redo2 className=\"size-3.5\" /></button>\n            </div>\n          )\n          return <div className=\"pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center\">{tools}</div>\n        })()}\n        {!frame && !designCompare && (\n          <div className=\"pointer-events-none absolute inset-0 z-10 flex items-center justify-center\">\n            <div className=\"pointer-events-auto max-w-64 space-y-3 text-center\">\n              <p className=\"text-xs leading-5 text-slate-400\">Code changes are available in the review panel.</p>\n              <button type=\"button\" onClick={onOpenCodeReview} className=\"ds-intrinsic h-7 rounded-md bg-white/[0.06] px-3 text-xs text-slate-200 hover:bg-white/10\">Review changes</button>\n            </div>\n          </div>\n        )}\n        {}\n        {handActive && (\n          <div\n            onPointerDown={beginPan}\n            className={cn('absolute inset-0 z-[15]', panning ? 'cursor-grabbing' : 'cursor-grab')}\n          />\n        )}\n        <div\n          ref={viewportRef}\n          onPointerDown={startPan}\n          className={cn('absolute inset-0 overflow-hidden', panning ? 'cursor-grabbing' : 'cursor-grab')}\n          style={{\n            touchAction: 'none',\n            backgroundImage:\n              'radial-gradient(color-mix(in oklch, var(--foreground) 14%, transparent) 1px, transparent 1px)',\n            backgroundSize:": "))\n        }\n\n        const next = { paths, anchor, pins, boxes }\n        setLinks((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))\n      }\n      raf = requestAnimationFrame(measure)\n    }\n    raf = requestAnimationFrame(measure)\n    return () => cancelAnimationFrame(raf)\n  }, [hasSelection, selectionKey, syncSelection?.layerId, frameSel, annotations, item.id, designCompare])\n\n  const zoomAt = useCallback((nextZoom, cx, cy) => {\n    setView((v) => {\n      const zoom = clampZoom(nextZoom)\n      const k = zoom / v.zoom\n      return { zoom, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k }\n    })\n  }, [])\n\n  \n  \n  useEffect(() => {\n    const el = viewportRef.current\n    if (!el) return\n    function onWheel(e) {\n      if (e.target.closest?.('[data-code-scroll]') && !e.ctrlKey && !e.metaKey) return\n      \n      if (e.target.closest?.('[data-device-scroll]') && !e.ctrlKey && !e.metaKey) return\n      e.preventDefault()\n      const rect = el.getBoundingClientRect()\n      if (e.ctrlKey || e.metaKey) {\n        zoomAt(viewRef.current.zoom * Math.exp(-e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top)\n      } else {\n        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }))\n      }\n    }\n    el.addEventListener('wheel', onWheel, { passive: false })\n    \n    \n    \n    let gestureStart = null\n    function onGestureStart(e) {\n      e.preventDefault()\n      gestureStart = viewRef.current.zoom\n    }\n    function onGestureChange(e) {\n      e.preventDefault()\n      if (gestureStart == null) return\n      const rect = el.getBoundingClientRect()\n      zoomAt(gestureStart * e.scale, e.clientX - rect.left, e.clientY - rect.top)\n    }\n    function onGestureEnd(e) {\n      e.preventDefault()\n      gestureStart = null\n    }\n    el.addEventListener('gesturestart', onGestureStart, { passive: false })\n    el.addEventListener('gesturechange', onGestureChange, { passive: false })\n    el.addEventListener('gestureend', onGestureEnd, { passive: false })\n    return () => {\n      el.removeEventListener('wheel', onWheel)\n      el.removeEventListener('gesturestart', onGestureStart)\n      el.removeEventListener('gesturechange', onGestureChange)\n      el.removeEventListener('gestureend', onGestureEnd)\n    }\n  }, [zoomAt])\n\n  \n  \n  function pickResultFrame(id) {\n    const dev = RESULT_DEVICES.find((entry) => entry.id === id)\n    const w = layout.result?.w ?? ARTBOARD_PREVIEW_WIDTH\n    const next = { ...layout, result: { ...layout.result, h: dev ? (w * dev.h) / dev.w : null } }\n    setResultDevice(id ?? null)\n    setLayout(next)\n    setView(fitView(next, { only: ['result'] }))\n  }\n\n  function zoomFromCenter(delta) {\n    const rect = viewportRef.current.getBoundingClientRect()\n    zoomAt(viewRef.current.zoom + delta, rect.width / 2, rect.height / 2)\n  }\n\n\n  function startPan(e) {\n    if (e.target !== e.currentTarget || e.button !== 0) return\n    beginPan(e)\n  }\n  \n  function beginPan(e) {\n    if (e.button !== 0) return\n    e.preventDefault()\n    const start = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y }\n    setPanning(true)\n    setAiStage(null)\n    setOpenNote(null)\n    function onMove(m) {\n      setView((v) => ({ ...v, x: start.vx + m.clientX - start.px, y: start.vy + m.clientY - start.py }))\n    }\n    function onUp() {\n      setPanning(false)\n      window.removeEventListener('pointermove', onMove)\n      window.removeEventListener('pointerup', onUp)\n    }\n    window.addEventListener('pointermove', onMove)\n    window.addEventListener('pointerup', onUp)\n  }\n\n  \n  \n  function dragView(e) {\n    const start = { px: e.clientX, py: e.clientY, vx: viewRef.current.x, vy: viewRef.current.y }\n    let moved = false\n    function onMove(m) {\n      const dx = m.clientX - start.px\n      const dy = m.clientY - start.py\n      if (!moved && Math.hypot(dx, dy) < 4) return\n      if (!moved) { moved = true; setPanning(true) }\n      setView((v) => ({ ...v, x: start.vx + dx, y: start.vy + dy }))\n    }\n    function onUp() {\n      if (moved) {\n        setPanning(false)\n        suppressClick.current = true\n        setTimeout(() => (suppressClick.current = false), 0)\n      }\n      window.removeEventListener('pointermove', onMove)\n      window.removeEventListener('pointerup', onUp)\n    }\n    window.addEventListener('pointermove', onMove)\n    window.addEventListener('pointerup', onUp)\n  }\n\n  \n  \n  \n  function startCardDrag(key) {\n    return (e) => {\n      if (e.button !== 0) return\n      if (e.target.closest('button, input, [data-code-scroll]')) return\n      e.stopPropagation()\n      \n      \n      \n      if (designCompare) {\n        dragView(e)\n        return\n      }\n      const start = { px: e.clientX, py: e.clientY, cx: layout[key].x, cy: layout[key].y }\n      let moved = false\n      setOrder((o) => ({ ...o, [key]: Math.max(...Object.values(o)) + 1 }))\n      function onMove(m) {\n        const dx = m.clientX - start.px\n        const dy = m.clientY - start.py\n        if (!moved && Math.hypot(dx, dy) < 4) return\n        moved = true\n        const scale = viewRef.current.zoom / 100\n        setLayout((l) => ({ ...l, [key]: { x: start.cx + dx / scale, y: start.cy + dy / scale } }))\n      }\n      function onUp() {\n        if (moved) {\n          suppressClick.current = true\n          setTimeout(() => (suppressClick.current = false), 0)\n        }\n        window.removeEventListener('pointermove', onMove)\n        window.removeEventListener('pointerup', onUp)\n      }\n      window.addEventListener('pointermove', onMove)\n      window.addEventListener('pointerup', onUp)\n    }\n  }\n\n  function swallowDragClick(e) {\n    if (suppressClick.current) {\n      e.stopPropagation()\n      e.preventDefault()\n    }\n  }\n\n  \n  \n  \n  function startResize(key) {\n    const min = key === 'code' ? { w: 320, h: 180 } : { w: 120, h: 120 }\n    return (dir) => (e) => {\n      if (e.button !== 0) return\n      e.stopPropagation()\n      e.preventDefault()\n      const rect = e.currentTarget.parentElement.getBoundingClientRect()\n      const k = viewRef.current.zoom / 100\n      const start = { px: e.clientX, py: e.clientY, w: rect.width / k, h: rect.height / k }\n      function onMove(m) {\n        const scale = viewRef.current.zoom / 100\n        const w = dir.includes('e') ? Math.max(min.w, start.w + (m.clientX - start.px) / scale) : start.w\n        const h = dir.includes('s') ? Math.max(min.h, start.h + (m.clientY - start.py) / scale) : start.h\n        setLayout((l) => ({ ...l, [key]: { ...l[key], w, h } }))\n      }\n      function onUp() {\n        window.removeEventListener('pointermove', onMove)\n        window.removeEventListener('pointerup', onUp)\n      }\n      window.addEventListener('pointermove', onMove)\n      window.addEventListener('pointerup', onUp)\n    }\n  }\n\n  \n  \n  \n  const overrides = { ...edits }\n  for (const [layerId, assembly] of Object.entries(assemblies ?? {})) {\n    const layer = (frameOverrideB ?? frame)?.layers.find((l) => l.id === layerId)\n    const o = layer && assemblyToOverride(assembly, layer)\n    if (o) overrides[layerId] = mergeOverride(overrides[layerId], o)\n  }\n  \n  \n  for (const [layerId, o] of Object.entries(codeOverrides(item.id, frame, syncedCode ?? manualCode, getFileLines))) {\n    overrides[layerId] = mergeOverride(overrides[layerId], o)\n  }\n  \n  \n  \n  \n  for (const [layerId, e] of Object.entries(variantPreviews ?? {})) {\n    const base = overrides[layerId]\n    const exact = assemblies?.[layerId] ?? {}\n    overrides[layerId] = {\n      ...base,\n      radius: exact.radius !== undefined || exact.shape ? base?.radius : (e.radius ?? base?.radius),\n      fontWeight: e.fontWeight ?? base?.fontWeight,\n      dw: (base?.dw ?? 0) + (exact.width !== undefined ? 0 : (e.dw ?? 0)),\n      dh: (base?.dh ?? 0) + (exact.height !== undefined ? 0 : (e.dh ?? 0)),\n      className: base?.className ?? e.className,\n      \n      ...(e.extraClass && { extraClass: [e.extraClass, base?.extraClass].filter(Boolean).join(' ') }),\n      ...((e.copy || base?.copy) && { copy: { ...e.copy, ...base?.copy } }),\n      ...(e.fillStyle && !base?.fillStyle && { fillStyle: e.fillStyle }),\n    }\n  }\n  if (appliedPreset?.layerId) overrides[appliedPreset.layerId] = { ...overrides[appliedPreset.layerId], className: appliedPreset.previewClass }\n\n  const scale = view.zoom / 100\n  const gridSize = 18 * scale\n  \n  const leftInset = 16\n\n  return (\n    \n    \n    \n    \n    \n    <div className=\"relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#1C1C1C]\">\n      <div ref={containerRef} className=\"relative min-h-0 flex-1\">\n        {}\n        {designCompare && (() => {\n          const ko = getLanguage() === 'ko'\n          const BUTTON = 'flex h-7 min-w-7 shrink-0 cursor-pointer items-center justify-center rounded-full px-1.5 text-[11px] font-medium text-slate-200 transition-colors hover:bg-white/[0.08] hover:text-white disabled:pointer-events-none disabled:opacity-30'\n          \n          \n          const tools = (\n            <div data-result-header data-merge-canvas-bar className=\"pointer-events-auto flex shrink-0 items-center gap-0.5 rounded-full border border-white/10 bg-card/95 p-0.5 shadow-lg backdrop-blur-sm\">\n              {}\n              {}\n              <div data-result-zoom className=\"pointer-events-auto flex h-7 shrink-0 items-center gap-0.5 rounded-md p-0.5 \">\n                <button type=\"button\" data-view-fit title={ko ? 'Fit' : 'Fit'} aria-label={ko ? 'Fit' : 'Fit'} onClick={() => setView(fitView(layout, { only: ['result'] }))} className={BUTTON}><Maximize className=\"size-3.5\" /></button>\n                <button type=\"button\" aria-label={ko ? 'Zoom out' : 'Zoom out'} onClick={() => zoomFromCenter(-10)} className={BUTTON}><Minus className=\"size-3.5\" /></button>\n                <span data-view-zoom className=\"min-w-10 text-center text-[11px] text-slate-300 tabular-nums\">{Math.round(view.zoom)}%</span>\n                <button type=\"button\" aria-label={ko ? 'Zoom in' : 'Zoom in'} onClick={() => zoomFromCenter(10)} className={BUTTON}><Plus className=\"size-3.5\" /></button>\n              </div>\n              <button\n                type=\"button\"\n                data-result-preview\n                title={ko ? 'Preview the result large · per device (Esc closes)' : 'Preview the result large · per device (Esc closes)'}\n                onClick={() => setMergePreviewOpen(true)}\n                aria-label={ko ? 'View the result large' : 'View the result large'}\n                className={BUTTON}\n              >\n                <Expand className=\"size-3.5\" />\n              </button>\n              <span aria-hidden className=\"mx-0.5 h-4 w-px bg-white/10\" />\n              <button type=\"button\" aria-label=\"Undo\" title=\"Undo\" disabled={!editHistory?.canUndo} onClick={editHistory?.undo} className={BUTTON}><Undo2 className=\"size-3.5\" /></button>\n              <button type=\"button\" aria-label=\"Redo\" title=\"Redo\" disabled={!editHistory?.canRedo} onClick={editHistory?.redo} className={BUTTON}><Redo2 className=\"size-3.5\" /></button>\n            </div>\n          )\n          return <div className=\"pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center\">{tools}</div>\n        })()}\n        {!frame && !designCompare && (\n          <div className=\"pointer-events-none absolute inset-0 z-10 flex items-center justify-center\">\n            <div className=\"pointer-events-auto max-w-64 space-y-3 text-center\">\n              <p className=\"text-xs leading-5 text-slate-400\">Code changes are available in the review panel.</p>\n              <button type=\"button\" onClick={onOpenCodeReview} className=\"ds-intrinsic h-7 rounded-md bg-white/[0.06] px-3 text-xs text-slate-200 hover:bg-white/10\">Review changes</button>\n            </div>\n          </div>\n        )}\n        {}\n        {handActive && (\n          <div\n            onPointerDown={beginPan}\n            className={cn('absolute inset-0 z-[15]', panning ? 'cursor-grabbing' : 'cursor-grab')}\n          />\n        )}\n        <div\n          ref={viewportRef}\n          onPointerDown={startPan}\n          className={cn('absolute inset-0 overflow-hidden', panning ? 'cursor-grabbing' : 'cursor-grab')}\n          style={{\n            touchAction: 'none',\n            backgroundImage:\n              'radial-gradient(color-mix(in oklch, var(--foreground) 14%, transparent) 1px, transparent 1px)',\n            backgroundSize:",
 ")에는 영향이 없어요": ") isn’t affected",
 ")에는 영향이 없어요 · 양쪽 렌더링이 같아요": ") isn’t affected · Both sides render the same",
 "**머지 전에 남은 일:**": "**Left to do before merging:**",
 "**승인이 모두 끝나서 머지할 수 있어요.**": "**All approvals are in. Ready to merge.**",
 ",\n    \n    proposals: [\n      { id: 'original', name: '원안으로 맞추기', spec: designSpec, side: 'after', result: '디자인 원안' },\n      { id: 'current', name: '현재 값 유지', spec: builtSpec, side: 'before', result:": ",\n    \n    proposals: [\n      { id: 'original', name: 'Match the design', spec: designSpec, side: 'after', result: 'Design' },\n      { id: 'current', name: 'Keep current value', spec: builtSpec, side: 'before', result:",
 ",\n    riskReason: 'Medium: 태블릿 레이아웃 구조가 바뀌는 변경 · 데이터나 결제 로직은 그대로예요.',\n    impact: { screens: [": ",\n    riskReason: 'Medium: Changes the tablet layout structure · Data and payment logic stay the same.',\n    impact: { screens: [",
 ", '~1024px', '전체'], current:": ", '~1024px', 'All'], current:",
 ", action: { label: '결정 보기', onClick: () => openConflictReview(c.id) } })\n      }\n    }, Math.max(0, Math.min(...asked.map((c) => c.decisionRequest.sentAt)) + DECISION_REPLY_MS - Date.now()))\n    return () => window.clearTimeout(timer)\n  }, [conflicts, currentUser.id, decideDesign, isDeveloperViewer, notifyPerson, openConflictReview])\n\n  \n  \n  \n  \n  \n  const revertConflict = useCallback(\n    (conflictId) => {\n      const conflict = conflicts.find((c) => c.id === conflictId)\n      if (!conflict || conflict.reviewStage !== 'resolved') return\n      const invertedDiff = conflict.diff && { before: conflict.diff.after, after: conflict.diff.before }\n      const invertedFields = conflict.comparisonFields?.map((field) => conflict.decidedSide === 'B'\n        ? { ...field }\n        : { ...field, expected: field.current, current: field.expected })\n      const revert = {\n        ...conflict,\n        id:": ", action: { label: 'View decision', onClick: () => openConflictReview(c.id) } })\n      }\n    }, Math.max(0, Math.min(...asked.map((c) => c.decisionRequest.sentAt)) + DECISION_REPLY_MS - Date.now()))\n    return () => window.clearTimeout(timer)\n  }, [conflicts, currentUser.id, decideDesign, isDeveloperViewer, notifyPerson, openConflictReview])\n\n  \n  \n  \n  \n  \n  const revertConflict = useCallback(\n    (conflictId) => {\n      const conflict = conflicts.find((c) => c.id === conflictId)\n      if (!conflict || conflict.reviewStage !== 'resolved') return\n      const invertedDiff = conflict.diff && { before: conflict.diff.after, after: conflict.diff.before }\n      const invertedFields = conflict.comparisonFields?.map((field) => conflict.decidedSide === 'B'\n        ? { ...field }\n        : { ...field, expected: field.current, current: field.expected })\n      const revert = {\n        ...conflict,\n        id:",
 ", columns: built.columns, overlap: true, template: grid.built },\n      proposal: { label: '개발자 제안', note:": ", columns: built.columns, overlap: true, template: grid.built },\n      proposal: { label: 'Developer proposal', note:",
 ", columns: decided.columns },\n    },\n    \n    \n    fixes: {\n      keep: gridLineOf(grid.design),\n      approve: gridLineOf(grid.decided),\n      'one-column': gridLineOf(grid.decided),\n      'narrow-cards': gridLineOf('repeat(2, minmax(0, 320px))'),\n    },\n    diff: { before: [gridLineOf(grid.built)], after: [gridLineOf(grid.decided)] },\n    scriptedRequest: script.request,\n    scriptedDecision: script.decision,\n    \n    reviewStage: 'resolved',\n    resolved: true,\n    requestedBy: steps.requested.by,\n    decisionRequest: { ...script.request, sentAt: ms(steps.requested), round: 1 },\n    designDecision: { ...script.decision, at: timeLabelOf(steps.decided), decidedAt: ms(steps.decided), timing: 'now' },\n    decisionFix: {\n      choice: steps.decided.choice, auto: Boolean(steps.fixed.auto), designSynced: steps.decided.choice === 'approve',\n      appliedAt: timeLabelOf(steps.fixed), appliedAtMs: ms(steps.fixed),\n      verified: true, failed: null, verifiedAt: timeLabelOf(steps.verified), verifiedAtMs: ms(steps.verified),\n    },\n    mergedBy: steps.merged.by,\n    resolvedAtLabel: timeLabelOf(steps.merged),\n    resolvedAtMs: ms(steps.merged),\n    reviewers: change.reviewers.map((id) => ({ id, status: 'approved', reviewedAt: ms(steps.decided), note: steps.decided.reason })),\n  }\n}\n\n\n\nfunction codeRecord(project, change, now) {\n  const { local, remote } = change.sides\n  return {\n    id: change.id,\n    ...(change.page && { designPageId: change.page }),\n    codeComparison: { localTitle: local.title, remoteTitle: remote.title, local: local.did, remote: remote.did, conflict: change.overlap, resolution: change.resolution },\n    kind: 'code-conflict',\n    title: change.title,\n    token: change.title,\n    projectId: project.id,\n    projectName: project.name,\n    file: change.file,\n    line: change.line,\n    severity: change.severity,\n    reviewStage: change.stage,\n    resolved: false,\n    timestamp: timeLabelOf(change.steps.detected),\n    detectedBy: 'Git merge check',\n    changedBy: { type: 'person', id: change.changedBy, what: 'Updated overlapping code in two branches' },\n    cause: change.cause,\n    message: change.cause,\n    effect: '같은 코드 구간이 변경되어 자동 병합할 수 없습니다.',\n    branches: { local: change.branch.source, remote: change.branch.target },\n    gitFlow: change.branch,\n    comparisonFields: [],\n    reviewers: change.reviewers.map((id) => ({ id, status: change.approvedBy?.includes(id) ? 'approved' : 'pending' })),\n    assigneeId: change.assignee,\n    ...(change.steps.requested && { requestedBy: change.steps.requested.by, requestedAtMs: momentOf(change.steps.requested, now).getTime() }),\n    impact: { components: change.components, files: [change.file] },\n    suggestion: change.suggestion ?? '두 브랜치의 변경을 함께 유지하는 해결 제안 코드를 검토하세요.',\n    ...(change.previewPrompt && { previewPrompt: change.previewPrompt }),\n    ...(change.linkedCommentId && { linkedCommentId: change.linkedCommentId }),\n    diff: { before: change.code.conflict, after: change.code.merged },\n  }\n}\n\n\nconst RECORD_OF = { structural: (project, change, now) => structuralRecord(change, now), value: valueRecord, code: codeRecord }\nexport function conflictsOf(seed, now = Date.now()) {\n  return seed.changes.map((change) => RECORD_OF[change.kind](seed.project, change, now))\n}\nexport const dashboardConflicts = (now = Date.now()) => conflictsOf(SEED, now)\n\nexport const seededConflicts = (now = Date.now()) => PROJECT_SEEDS.flatMap((seed) => conflictsOf(seed, now))\n\nexport const seededChangeOf = (id) => PROJECT_SEEDS.flatMap((seed) => seed.changes).find((change) => change.id === id)\n\n\nconst snapshotOf = (lines) => ({ activeFileId: 'app', fileId: 'app', lines, activePageId: SEED.project.pageId, conflicts: [], selectedLayerId: null })\n\n\n\nexport function dashboardHistory() {\n  const change = changeOf('CON-002')\n  const built = layoutOf(SEED.grid.built)\n  const decided = layoutOf(SEED.grid.decided)\n  const bp = change.breakpoint\n  const fileName = change.file.split('/').pop()\n  const entries = []\n  for (const checkpoint of SEED.checkpoints) {\n    const lines = checkpointLines(checkpoint)\n    const step = checkpoint.change ? changeOf(checkpoint.change).steps[checkpoint.step] : checkpoint\n    const base = { id: checkpoint.id, archived: false, timestamp: timeLabelOf(step), snapshot: snapshotOf(lines) }\n    if (checkpoint.what === 'drafts') {\n      entries.push({ ...base, label: 'AI 시안 A · B 생성', kind: 'edit', actorId: checkpoint.by, target: checkpoint.target })\n    } else if (checkpoint.what === 'responsive') {\n      entries.push({\n        ...base, kind: 'edit', actorId: checkpoint.by, target:": ", columns: decided.columns },\n    },\n    \n    \n    fixes: {\n      keep: gridLineOf(grid.design),\n      approve: gridLineOf(grid.decided),\n      'one-column': gridLineOf(grid.decided),\n      'narrow-cards': gridLineOf('repeat(2, minmax(0, 320px))'),\n    },\n    diff: { before: [gridLineOf(grid.built)], after: [gridLineOf(grid.decided)] },\n    scriptedRequest: script.request,\n    scriptedDecision: script.decision,\n    \n    reviewStage: 'resolved',\n    resolved: true,\n    requestedBy: steps.requested.by,\n    decisionRequest: { ...script.request, sentAt: ms(steps.requested), round: 1 },\n    designDecision: { ...script.decision, at: timeLabelOf(steps.decided), decidedAt: ms(steps.decided), timing: 'now' },\n    decisionFix: {\n      choice: steps.decided.choice, auto: Boolean(steps.fixed.auto), designSynced: steps.decided.choice === 'approve',\n      appliedAt: timeLabelOf(steps.fixed), appliedAtMs: ms(steps.fixed),\n      verified: true, failed: null, verifiedAt: timeLabelOf(steps.verified), verifiedAtMs: ms(steps.verified),\n    },\n    mergedBy: steps.merged.by,\n    resolvedAtLabel: timeLabelOf(steps.merged),\n    resolvedAtMs: ms(steps.merged),\n    reviewers: change.reviewers.map((id) => ({ id, status: 'approved', reviewedAt: ms(steps.decided), note: steps.decided.reason })),\n  }\n}\n\n\n\nfunction codeRecord(project, change, now) {\n  const { local, remote } = change.sides\n  return {\n    id: change.id,\n    ...(change.page && { designPageId: change.page }),\n    codeComparison: { localTitle: local.title, remoteTitle: remote.title, local: local.did, remote: remote.did, conflict: change.overlap, resolution: change.resolution },\n    kind: 'code-conflict',\n    title: change.title,\n    token: change.title,\n    projectId: project.id,\n    projectName: project.name,\n    file: change.file,\n    line: change.line,\n    severity: change.severity,\n    reviewStage: change.stage,\n    resolved: false,\n    timestamp: timeLabelOf(change.steps.detected),\n    detectedBy: 'Git merge check',\n    changedBy: { type: 'person', id: change.changedBy, what: 'Updated overlapping code in two branches' },\n    cause: change.cause,\n    message: change.cause,\n    effect: 'The same code section changed on both sides, so it can’t be merged automatically.',\n    branches: { local: change.branch.source, remote: change.branch.target },\n    gitFlow: change.branch,\n    comparisonFields: [],\n    reviewers: change.reviewers.map((id) => ({ id, status: change.approvedBy?.includes(id) ? 'approved' : 'pending' })),\n    assigneeId: change.assignee,\n    ...(change.steps.requested && { requestedBy: change.steps.requested.by, requestedAtMs: momentOf(change.steps.requested, now).getTime() }),\n    impact: { components: change.components, files: [change.file] },\n    suggestion: change.suggestion ?? 'Review the suggested fix that keeps changes from both branches.',\n    ...(change.previewPrompt && { previewPrompt: change.previewPrompt }),\n    ...(change.linkedCommentId && { linkedCommentId: change.linkedCommentId }),\n    diff: { before: change.code.conflict, after: change.code.merged },\n  }\n}\n\n\nconst RECORD_OF = { structural: (project, change, now) => structuralRecord(change, now), value: valueRecord, code: codeRecord }\nexport function conflictsOf(seed, now = Date.now()) {\n  return seed.changes.map((change) => RECORD_OF[change.kind](seed.project, change, now))\n}\nexport const dashboardConflicts = (now = Date.now()) => conflictsOf(SEED, now)\n\nexport const seededConflicts = (now = Date.now()) => PROJECT_SEEDS.flatMap((seed) => conflictsOf(seed, now))\n\nexport const seededChangeOf = (id) => PROJECT_SEEDS.flatMap((seed) => seed.changes).find((change) => change.id === id)\n\n\nconst snapshotOf = (lines) => ({ activeFileId: 'app', fileId: 'app', lines, activePageId: SEED.project.pageId, conflicts: [], selectedLayerId: null })\n\n\n\nexport function dashboardHistory() {\n  const change = changeOf('CON-002')\n  const built = layoutOf(SEED.grid.built)\n  const decided = layoutOf(SEED.grid.decided)\n  const bp = change.breakpoint\n  const fileName = change.file.split('/').pop()\n  const entries = []\n  for (const checkpoint of SEED.checkpoints) {\n    const lines = checkpointLines(checkpoint)\n    const step = checkpoint.change ? changeOf(checkpoint.change).steps[checkpoint.step] : checkpoint\n    const base = { id: checkpoint.id, archived: false, timestamp: timeLabelOf(step), snapshot: snapshotOf(lines) }\n    if (checkpoint.what === 'drafts') {\n      entries.push({ ...base, label: 'Generated AI drafts A · B', kind: 'edit', actorId: checkpoint.by, target: checkpoint.target })\n    } else if (checkpoint.what === 'responsive') {\n      entries.push({\n        ...base, kind: 'edit', actorId: checkpoint.by, target:",
 ", columns: design.columns, template: grid.design },\n      implementation: { label: '실제 구현', note:": ", columns: design.columns, template: grid.design },\n      implementation: { label: 'Actual implementation', note:",
 ", reason: request.reason })\n  }, [conflicts, currentUser.id, logEvent, notifyPerson, projectId, recordDecisionStep, setConflicts])\n\n  \n  \n  const setDecisionDraft = useCallback((conflictId, draft) => {\n    setConflicts((prev) => prev.map((c) => (c.id !== conflictId ? c : { ...c, decisionDraft: draft })))\n  }, [setConflicts])\n\n  \n  \n  const startDirectFix = useCallback((conflictId, request) => {\n    const conflict = conflicts.find((c) => c.id === conflictId)\n    if (!conflict) return\n    \n    const designerId = conflict.reviewers[0]?.id ?? null\n    const at = timeLabel()\n    const decision = { choice: 'keep', by: currentUser.id, at, decidedAt: Date.now(), timing: 'now', direct: true, reason: request.reason || '디자인 원안대로 맞춰 바로 수정해요.' }\n    setConflicts((prev) => prev.map((c) => (c.id !== conflictId ? c : {\n      ...c,\n      decisionRequest: { ...request, by: currentUser.id, at, sentAt: Date.now(), round: (c.decisionRequest?.round ?? 0) + 1, direct: true },\n      designDecision: decision,\n      decisionFix: null,\n      \n      events: (() => {\n        const asked = appendEvent(c, { type: 'requested', actorId: currentUser.id, payload: { proposal: request.proposal, proposalName: proposalOf(request.proposal, request.custom, c)?.name ?? null, reason: request.reason ?? '', reviewerId: designerId, direct: true } })\n        return appendEvent({ ...c, events: asked }, { type: 'decided', actorId: currentUser.id, replyTo: asked.at(-1).id, payload: { result: 'approved', proposalName: proposalOf(request.proposal, request.custom, c)?.name ?? null, reason: decision.reason, direct: true } })\n      })(),\n      reviewStage: 'approved',\n    })))\n    logEvent({ kind: 'decided', projectId, conflictId, actorId: currentUser.id, title: conflict.title })\n    notifyPerson(designerId, conflict,": ", reason: request.reason })\n  }, [conflicts, currentUser.id, logEvent, notifyPerson, projectId, recordDecisionStep, setConflicts])\n\n  \n  \n  const setDecisionDraft = useCallback((conflictId, draft) => {\n    setConflicts((prev) => prev.map((c) => (c.id !== conflictId ? c : { ...c, decisionDraft: draft })))\n  }, [setConflicts])\n\n  \n  \n  const startDirectFix = useCallback((conflictId, request) => {\n    const conflict = conflicts.find((c) => c.id === conflictId)\n    if (!conflict) return\n    \n    const designerId = conflict.reviewers[0]?.id ?? null\n    const at = timeLabel()\n    const decision = { choice: 'keep', by: currentUser.id, at, decidedAt: Date.now(), timing: 'now', direct: true, reason: request.reason || 'Fix it now to match the design.' }\n    setConflicts((prev) => prev.map((c) => (c.id !== conflictId ? c : {\n      ...c,\n      decisionRequest: { ...request, by: currentUser.id, at, sentAt: Date.now(), round: (c.decisionRequest?.round ?? 0) + 1, direct: true },\n      designDecision: decision,\n      decisionFix: null,\n      \n      events: (() => {\n        const asked = appendEvent(c, { type: 'requested', actorId: currentUser.id, payload: { proposal: request.proposal, proposalName: proposalOf(request.proposal, request.custom, c)?.name ?? null, reason: request.reason ?? '', reviewerId: designerId, direct: true } })\n        return appendEvent({ ...c, events: asked }, { type: 'decided', actorId: currentUser.id, replyTo: asked.at(-1).id, payload: { result: 'approved', proposalName: proposalOf(request.proposal, request.custom, c)?.name ?? null, reason: decision.reason, direct: true } })\n      })(),\n      reviewStage: 'approved',\n    })))\n    logEvent({ kind: 'decided', projectId, conflictId, actorId: currentUser.id, title: conflict.title })\n    notifyPerson(designerId, conflict,",
 ", timestamp: timeLabelOf(change.steps.detected), snapshot: snapshotOf(lines),\n      })\n    } else if (checkpoint.what === 'fix') {\n      entries.push({\n        ...base, kind: 'edit', conflictId: change.id, actorLabel: 'Devsign 자동 수정', target:": ", timestamp: timeLabelOf(change.steps.detected), snapshot: snapshotOf(lines),\n      })\n    } else if (checkpoint.what === 'fix') {\n      entries.push({\n        ...base, kind: 'edit', conflictId: change.id, actorLabel: 'Devsign auto-fix', target:",
 "1024px 이하": "1024px and below",
 "1024px부터 접힘 → 디자인은 768px부터": "Collapses from 1024px → Design collapses from 768px",
 "1024px에서 본문 공간을 확보해요": "Frees up content space at 1024px",
 "1024px에서 차트가 잘려 보여요": "The chart looks cut off at 1024px",
 "120px이면 버튼이 첫 화면 밖으로 밀려요": "At 120px the button gets pushed below the first screen",
 "12px 이상": "12px or larger",
 "12px이면 카드 4개가 한 줄에 들어가요": "At 12px, 4 cards fit in one row",
 "16px 아이콘이라 2.5여야 또렷하게 보여요": "It’s a 16px icon, so it needs 2.5 to look crisp",
 "1열 레이아웃": "1-column layout",
 "1열로 변경": "Change to 1 column",
 "1열은 긴 스크롤 · 2열은 숫자 잘림": "1 column scrolls too long · 2 columns cut off numbers",
 "1열은 스크롤이 너무 길어요. 2열을 유지하는 수정안으로 다시 요청해 주세요.": "1 column makes scrolling too long. Please request again with a fix that keeps 2 columns.",
 "1열은 스크롤이 너무 길어져요. 카드 높이를 줄인 2열 안을 다시 제안해 주세요.": "1 column makes scrolling too long. Please propose a 2-column option with shorter cards.",
 "1열이면 겹침 없이 숫자가 보여요": "With 1 column, numbers show without overlap",
 "1열이면 스크롤이 너무 길어질 것 같아요. 원안 2열을 유지하는 방법은 없을까요?": "I think 1 column will make scrolling too long. Is there a way to keep the design’s 2 columns?",
 "2열 · 간격 16px": "2 columns · 16px gap",
 "2열 · 카드 폭을 줄여 맞춤": "2 columns · Narrower cards to fit",
 "2열 배치가 대시보드의 핵심 정보를 한눈에 보여줘요. 카드 폭을 화면에 맞춰 2열을 유지해 주세요.": "The 2-column layout shows the dashboard’s key info at a glance. Please keep 2 columns by fitting card width to the screen.",
 "2열 유지 · 카드 폭 줄이기": "Keep 2 columns · Narrow cards",
 "2열 카드": "2-column cards",
 "2열 카드 · Blue CTA": "2-column cards · Blue CTA",
 "2열로 화면의 정보량을 유지해요": "Keeps the screen’s information density with 2 columns",
 "360px 고정 2열": "Fixed 360px, 2 columns",
 "3열 · 간격 8px": "3 columns · 8px gap",
 "3열 카드": "3-column cards",
 "3열 카드 · Dark CTA": "3-column cards · Dark CTA",
 "3열이 한 화면에 가장 많이 보여요": "3 columns shows the most on one screen",
 "4/8 단위를 지켜 8px로 맞춰요": "Use 8px to stick to the 4/8 grid",
 "4px 낮음 · 테마를 따르지 않음": "4px lower · Doesn’t follow the theme",
 "6px면 결제 버튼까지 스크롤이 줄어요": "At 6px, there’s less scrolling to the pay button",
 "6px이면 결제 버튼까지 스크롤이 줄어요": "At 6px, there’s less scrolling to the pay button",
 "700이면 제목이 옆 숫자보다 무거워 보여요": "At 700, the title looks heavier than the numbers next to it",
 "768px 이하": "768px and below",
 "768px 이하 카드 1열": "1-column cards at 768px and below",
 "768px에서 고정 폭 카드가 겹쳐요": "Fixed-width cards overlap at 768px",
 "768px에서 카드 2장이 여전히 12px 겹쳐요. StatCard의 min-width(360px)가 남아 있어요.": "At 768px, 2 cards still overlap by 12px. StatCard’s min-width (360px) is still there.",
 "768px에서 카드가 겹쳐요": "Cards overlap at 768px",
 "768px에서는 1열이 더 읽기 쉬워요. 디자인 원안도 1열로 업데이트할게요.": "1 column is easier to read at 768px. I’ll update the design to 1 column too.",
 "768px엔 1열이 읽기 쉬워요 · 원안도 1열로 바꿔요": "1 column reads better at 768px · Updating the design to 1 column too",
 "8px이면 범례 6개가 두 줄이 돼요": "At 8px, the 6 legend items wrap to two lines",
 "8px이면 좁은 화면에서 두 줄이 돼요": "At 8px, it wraps to two lines on narrow screens",
 ": ''}고정": ": ''}fixed",
 ": ''}을 고친 뒤 다시 검증하세요.": ": ''} and verify again.",
 ": ''}출시 전": ": ''}before launch",
 ": '값 검증 통과') : PHASE_CHIP[fixPhase][0]}": ": 'Value verified') : PHASE_CHIP[fixPhase][0]}",
 ": '제안'}": ": 'Suggestion'}",
 "A/B 테스트 종료까지 높이·색을 유지해요": "Keep height and color until the A/B test ends",
 "A/B 테스트가 끝날 때까지 유지": "Keep until the A/B test ends",
 "AI 수정 제안 적용 여부": "Whether to apply the AI fix suggestion",
 "AI 시안": "AI draft",
 "AI 시안 A · B 생성": "AI drafts A · B created",
 "Alex에게 전달": "Send to Alex",
 "Blue CTA · 전체 너비": "Blue CTA · Full width",
 "Breakpoint 768px의 대시보드 카드 그리드를 1열로 — DashboardGrid / StatCard 공통 규칙 업데이트 제안": "Make the dashboard card grid 1 column at the 768px breakpoint — proposed shared rule update for DashboardGrid / StatCard",
 "Dark CTA · 캡슐형 + 가격": "Dark CTA · Pill + price",
 "DashboardGrid: 컬럼 폭을 화면 기준으로 변경": "DashboardGrid: Base column width on the screen",
 "Design System 업데이트": "Design System update",
 "Design System 업데이트를 제안했어요": "Proposed a Design System update",
 "DesignCanvas.jsx의 병합 충돌을 해결해 줘": "Resolve the merge change in DesignCanvas.jsx",
 "Devsign 자동 수정": "Devsign auto-fix",
 "Docs 문서 검색": "Search Docs",
 "Docs 페이지 열기": "Open Docs page",
 "History에서 보기": "View in History",
 "Low: 결제 탭의 아이콘 하나예요.": "Low: One icon on the payment tab.",
 "Low: 결제 필드 라벨 자간 · 레이아웃과 동작은 그대로예요.": "Low: Payment field label letter spacing · Layout and behavior stay the same.",
 "Low: 배송 옵션 아이콘 굵기 · 레이아웃과 동작은 그대로예요.": "Low: Shipping option icon weight · Layout and behavior stay the same.",
 "Low: 주문 요약 구분선 색 · 레이아웃과 동작은 그대로예요.": "Low: Order summary divider color · Layout and behavior stay the same.",
 "Medium: 결제 폼 간격 · 눈에 보이지만 동작은 그대로예요.": "Medium: Payment form spacing · Visible, but behavior stays the same.",
 "Medium: 결제의 주 버튼 크기와 색상이 바뀌어요. 스타일만 바뀌고 결제 로직과 데이터는 그대로예요.": "Medium: The main payment button’s size and color change. Only the style changes; payment logic and data stay the same.",
 "Medium: 태블릿 레이아웃 구조가 바뀌는 변경 · 데이터나 결제 로직은 그대로예요.": "Medium: the tablet layout's structure changes · data and payment logic stay the same.",
 "Merge Studio에서 닫기 버튼을 24 × 24px 이상으로 키우세요.": "In Merge Studio, make the close button at least 24 × 24px.",
 "Space: 현재와 비교": "Space: Compare with current",
 "UT 시뮬레이션 · 검토 요청에 승인으로 응답했습니다.": "UT simulation · Responded to the review request with an approval.",
 "[data-mix-panel], section[aria-label=\"Bottom panel\"], section[aria-label=\"하단 패널\"]": "[data-mix-panel], section[aria-label=\"Bottom panel\"], section[aria-label=\"Bottom panel\"]",
 "])\n  }, [appendTerminalLines, conflicts, currentUser.id, fileOverrides, files, logEvent, projectId, recordDecisionStep, setConflicts, setFileOverrides])\n\n  \n  \n  \n  const verifyDecisionFix = useCallback((conflictId, { match = true, difference = null } = {}) => {\n    \n    setConflicts((prev) => prev.map((c) => (c.id !== conflictId || !c.decisionFix ? c : {\n      ...c,\n      decisionFix: match\n        ? { ...c.decisionFix, verified: true, failed: null, verifiedAt: timeLabel(), verifiedAtMs: Date.now() }\n        : { ...c.decisionFix, verified: false, failed: { reason: difference ?? '결정한 레이아웃과 달라요', at: timeLabel() }, attempts: (c.decisionFix.attempts ?? 0) + 1 },\n      \n      events: appendEvent(c, { type: 'verified', actorId: null, replyTo: eventsOf(c).findLast((event) => event.type === 'fixed')?.id, payload: { match, ...(c.layouts && { width: c.breakpoint ?? 768 }), ...(difference && { difference }) } }),\n    })))\n    const layout = Boolean(conflicts.find((c) => c.id === conflictId)?.layouts)\n    appendTerminalLines(layout\n      ? (match\n        ? ['$ devsign verify --breakpoint 768', '✓ cards fit 768px · no overlap', '✓ matches the decided layout']\n        : ['$ devsign verify --breakpoint 768',": "])\n  }, [appendTerminalLines, conflicts, currentUser.id, fileOverrides, files, logEvent, projectId, recordDecisionStep, setConflicts, setFileOverrides])\n\n  \n  \n  \n  const verifyDecisionFix = useCallback((conflictId, { match = true, difference = null } = {}) => {\n    \n    setConflicts((prev) => prev.map((c) => (c.id !== conflictId || !c.decisionFix ? c : {\n      ...c,\n      decisionFix: match\n        ? { ...c.decisionFix, verified: true, failed: null, verifiedAt: timeLabel(), verifiedAtMs: Date.now() }\n        : { ...c.decisionFix, verified: false, failed: { reason: difference ?? 'Doesn’t match the decided layout', at: timeLabel() }, attempts: (c.decisionFix.attempts ?? 0) + 1 },\n      \n      events: appendEvent(c, { type: 'verified', actorId: null, replyTo: eventsOf(c).findLast((event) => event.type === 'fixed')?.id, payload: { match, ...(c.layouts && { width: c.breakpoint ?? 768 }), ...(difference && { difference }) } }),\n    })))\n    const layout = Boolean(conflicts.find((c) => c.id === conflictId)?.layouts)\n    appendTerminalLines(layout\n      ? (match\n        ? ['$ devsign verify --breakpoint 768', '✓ cards fit 768px · no overlap', '✓ matches the decided layout']\n        : ['$ devsign verify --breakpoint 768',",
 "], components: change.components, files: [change.file, 'src/styles/dashboard.css'] },\n    uxNote: '태블릿에서 카드가 겹쳐 숫자가 가려지고, 구매 버튼이 아래로 밀려요.',\n    suggestion:": "], components: change.components, files: [change.file, 'src/styles/dashboard.css'] },\n    uxNote: 'On tablet, cards overlap and hide the numbers, and the purchase button gets pushed down.',\n    suggestion:",
 "color.cta 대비가 4.5:1 미만이에요": "color.cta contrast is below 4.5:1",
 "color.cta는 대비 4.5:1 미달 · 토큰 수정 전까지 유지": "color.cta contrast is below 4.5:1 · Keep until the token is fixed",
 "dashboard-768-구현화면.png": "dashboard-768-implementation.png",
 "gap-2로 변경 · 필드 간격 8px": "Change to gap-2 · 8px field spacing",
 "large primary가 디자인 기준 · 고정 색은 테마 미반영": "Large primary is the design standard · Fixed color ignores the theme",
 "lg 크기 · primary 색상 토큰 적용": "lg size · primary color token applied",
 "main의 key 변경을 유지하고 로컬의 onSelect 핸들러를 그 위에 다시 적용하세요.": "Keep main’s key change and reapply the local onSelect handler on top of it.",
 "main의 key를 유지하고, 그 위에 로컬의 onSelect 핸들러를 다시 붙입니다.": "Keep main’s key and reattach the local onSelect handler on top.",
 "placeOrder 함수의 같은 요청 처리 구간을 수정했습니다.": "Both changed the same request-handling section of the placeOrder function.",
 "primary 토큰": "primary token",
 "total을 계산하는 같은 한 줄을 수정했습니다.": "Both changed the same line that calculates total.",
 "},\n      { id: 'cardWidth', label: '카드 폭', kind: 'width', current: { mode: 'fixed', px: built.width }, currentText:": "},\n      { id: 'cardWidth', label: 'Card width', kind: 'width', current: { mode: 'fixed', px: built.width }, currentText:",
 "},\n      { id: 'gap', label: '카드 간격', kind: 'px', current: 24, currentText: '현재 24px' },\n      { id: 'range', label: '적용 구간', kind: 'choice', options: [": "},\n      { id: 'gap', label: 'Card gap', kind: 'px', current: 24, currentText: 'Currently 24px' },\n      { id: 'range', label: 'Applies to', kind: 'choice', options: [",
 "},\n      { id: 'other', name: '다른 값', spec: '직접 입력', values: {} },\n    ],\n    \n    \n    reasonChips: {\n      current: change.reasons ?? [],\n      \n      other: ['원안과 현재의 절충값'],\n    },\n    decisionChips: {\n      keep: '디자인 기준으로 맞춰요',\n      approve: '원안도 요청한 값으로 바꿀게요.',\n      rework: '다른 값을 제안해 주세요',\n    },\n    \n    driftProps: [{ id: 'value', label: told.length > 1 ? '값' : told[0].label, kind: 'text', primary: true, current: builtSpec, currentText:": "},\n      { id: 'other', name: 'Other value', spec: 'Enter manually', values: {} },\n    ],\n    \n    \n    reasonChips: {\n      current: change.reasons ?? [],\n      \n      other: ['A compromise between the design and current value'],\n    },\n    decisionChips: {\n      keep: 'Match the design',\n      approve: 'We’ll update the design to the requested value too.',\n      rework: 'Please suggest a different value',\n    },\n    \n    driftProps: [{ id: 'value', label: told.length > 1 ? 'Value' : told[0].label, kind: 'text', primary: true, current: builtSpec, currentText:",
 "},\n    ],\n    \n    \n    driftProps: [\n      { id: 'columns', label: '열 수', kind: 'choice', options: [1, 2, 3], current: built.columns, currentText:": "},\n    ],\n    \n    \n    driftProps: [\n      { id: 'columns', label: 'Columns', kind: 'choice', options: [1, 2, 3], current: built.columns, currentText:",
 "},\n    ],\n    layouts: {\n      \n      original: { label: '디자인 원안', note:": "},\n    ],\n    layouts: {\n      \n      original: { label: 'Design', note:",
 "· Space 누르면 현재 구현": "· Hold Space for current implementation",
 "· 복제": "· Duplicate",
 "· 요청 전": "· not requested yet",
 "· 카드 겹침 해소": "· Fixes card overlap",
 "· 현재 버전에도 남아 있음": "· still in the current version",
 "· 현재 버전에서는 해결됨": "· resolved in the current version",
 "←→ 옵션 선택 · Space 누르고 있으면 현재와 비교": "←→ Choose option · Hold Space to compare with current",
 "⌘/Ctrl + Enter로 등록": "⌘/Ctrl + Enter to post",
 "⚠ 변경확인": "⚠ Changes",
 "가로·세로 24px 이상": "At least 24px wide and tall",
 "가이드 닫기": "Close guide",
 "각 변경점의 코드는 아래 **변경확인**의 리뷰에서 볼 수 있고, 머지 전에 거기서 직접 고칠 수 있어요.": "You can see each change’s code in the review under **Changes**, and fix it there directly before merging.",
 "각 프레임에 고유한 key를 추가합니다.": "Adds a unique key to each frame.",
 "간격": "Gap",
 "감지": "Detected",
 "값": "Value",
 "값 검증 통과": "Values verified",
 "값 늘리기": "Increase value",
 "값 입력 전": "No value yet",
 "값 입력 전 · 현재 구현": "No value yet · Current implementation",
 "값 재비교": "Compare values again",
 "값 줄이기": "Decrease value",
 "값을 골라 주세요": "Choose a value",
 "값을 입력하면 여기에 그려져요": "Enter a value to preview it here",
 "값을 입력해 주세요": "Enter a value",
 "강조색 혼용으로 인한 주요 동작 구분 어려움": "Mixed accent colors make primary actions hard to tell apart",
 "같은 코드 구간이 변경되어 자동 병합할 수 없습니다.": "The same lines changed on both sides, so they can't merge automatically.",
 "개발 단계": "Development stage",
 "개발 반영": "Applied in dev",
 "개발 중간": "Mid-development",
 "개발 초기": "Early development",
 "개발자 제안": "Developer's proposal",
 "개발자에게 결정이 전달됐어요": "The decision was sent to the developer",
 "개발자의 재요청을 확인하세요": "Check the developer’s new request",
 "검사를 통과하면 이 안내가 \"해결됨\"으로 바뀝니다.": "Once the check passes, this notice changes to \"Resolved.\"",
 "검사를 통과했어요. 변경 내역에서 결과를 확인하세요.": "The check passed. See the result in the change history.",
 "검색 결과가 없습니다.": "No results found.",
 "검증": "Verify",
 "검증 실패": "Verification failed",
 "검증 중": "Verifying",
 "검증 통과": "Verified",
 "검증에 실패했어요 · 다시 시도하거나 직접 수정하세요": "Verification failed · Try again or fix it yourself",
 "검증에 실패했어요. 다시 시도하거나 직접 수정하세요": "Verification failed. Try again or fix it yourself",
 "검증을 통과하면 병합해요": "Merges once verified",
 "검증을 통과했어요 · 병합하면 자동으로 해결돼요": "Verified · Merging resolves it automatically",
 "검증을 통과했어요. 병합하면 자동으로 해결돼요": "Verified. Merging resolves it automatically",
 "검토 대기": "Awaiting review",
 "검토 대기 중에는 조합할 수 없어요": "Can’t mix while awaiting review",
 "검토 요청": "Review request",
 "검토 요청 보내기": "Send review request",
 "검토 요청과 함께 남길 메시지예요. **코멘트로 쓰기**를 누르면 변경점의 Comments에 들어가요.": "A message to include with the review request. Press **Post as comment** to add it to the change’s Comments.",
 "검토 요청하기": "Request review",
 "검토 현황 보기": "View review status",
 "검토 화면의 카드에 조정한 값이 표시돼요.": "Adjusted values appear on the card in the review screen.",
 "검토 화면의 카드에 조정한 값이 표시돼요. 조정한 이유를 선택하세요.": "Adjusted values appear on the card in the review screen. Choose why you adjusted them.",
 "검토를 요청해야 해요": "Review required",
 "검토자": "Reviewer",
 "검토자 결정": "Reviewer decision",
 "검토자 선택": "Select reviewers",
 "검토자 추가": "Add reviewer",
 "검토자가 보고 결정해요": "The reviewer will look and decide",
 "검토자가 요청을 보고 결정해요": "The reviewer will see the request and decide",
 "검토자를 먼저 추가해 주세요": "Add a reviewer first",
 "검토자를 한 명 이상 골라 주세요": "Choose at least one reviewer",
 "검토자에게 승인을 요청해요": "Ask reviewers for approval",
 "검토자의 결정을 기다리고 있어요": "Waiting for the reviewer’s decision",
 "검토자의 의견을 보고 해결 방법을 다시 골라 주세요": "See the reviewer’s feedback and choose a fix again",
 "검토할 변경이 아직 없어요": "No changes to review yet",
 "결과": "Result",
 "결과 크게 보기": "View result large",
 "결과를 크게 미리보기 · 기기별 (Esc로 닫기)": "Preview the result large · by device (Esc to close)",
 "결과에 사용 중": "Used in result",
 "결과에서 빼기 (Delete)": "Remove from result (Delete)",
 "결정": "Decision",
 "결정 · 반영 시점": "Decision · When to apply",
 "결정 대기": "Awaiting decision",
 "결정 보기": "View decision",
 "결정과": "Decision and",
 "결정대로 코드를 수정하고 있어요": "Fixing the code per the decision",
 "결정대로 코드를 수정했어요": "Fixed the code per the decision",
 "결정대로 코드를 자동으로 수정하고 있어요": "Automatically fixing the code per the decision",
 "결정한 레이아웃과 달라요": "Differs from the decided layout",
 "결제 단계에서 주문 버튼이 44px 높이, primary 색상으로 보여요.": "At checkout, the order button shows at 44px tall in the primary color.",
 "결제 라벨의 자간을 기본값으로 돌려 줘": "Reset the payment label letter spacing to default",
 "결제 버튼의 보라색·40px 높이를 primary 토큰·44px로 맞추려는데, 기준이 맞는지 확인 부탁드려요.": "I want to change the payment button’s purple and 40px height to the primary token and 44px. Can you confirm that’s the right standard?",
 "결제 실패 시 재시도하도록 submitPayment를 retry로 감쌉니다.": "Wrap submitPayment in retry so it retries when payment fails.",
 "결제 재시도 처리": "Payment retry handling",
 "결제 폼 간격을 8px 단위로": "Payment form spacing on the 8px grid",
 "결제 폼 간격을 8px 단위에 맞춰 줘": "Align payment form spacing to the 8px grid",
 "결제 화면 시안 조합": "Checkout draft mix",
 "결제 화면 초기 구성": "Initial checkout setup",
 "결제 화면의 주문 요약 유무": "Whether checkout shows the order summary",
 "겹쳐보기": "Overlay",
 "겹치는 동작": "Overlapping behavior",
 "겹침": "Overlap",
 "경고": "Warning",
 "고정": "Fixed",
 "고정 hex(#7c3aed)를 없애고 새 결제 디자인의 primary 토큰과 44px large 버튼에 맞추기": "Remove the fixed hex (#7c3aed) and match the new payment design’s primary token and 44px large button",
 "고정 색상이라 테마를 바꿔도 구분선 색이 그대로예요.": "The color is fixed, so the divider stays the same when you switch themes.",
 "관련 영역을 동일 강조색의 시안으로 통일": "Unify related regions with the same-accent draft",
 "관련 파일": "Related files",
 "구매 버튼 (CTA)": "Purchase button (CTA)",
 "구매 버튼 배경이 #1D4ED8 고정값 · 디자인은 color.cta 토큰": "Purchase button background is fixed at #1D4ED8 · Design uses the color.cta token",
 "구매 버튼 위치가 밀림": "Purchase button pushed out of place",
 "구분선 slate-200 → 디자인은 border 토큰": "Divider slate-200 → Design uses the border token",
 "구분선에 border-border를 써서 테마를 따르게 하세요.": "Use border-border on the divider so it follows the theme.",
 "구현": "Implementation",
 "구현 ↔ 원안": "Implementation ↔ Design",
 "구현 화면": "Implementation",
 "구현과 원안 사이 비교 위치": "Comparison position between implementation and design",
 "권장": "Recommended",
 "권한": "Permissions",
 "그대로 반영": "Apply as is",
 "그대로 반영하기로 함": "Decided to apply as is",
 "그대로 유지": "kept",
 "그때까지 승인된 상태로 있어요. 수정과 검증은 예정 시점에 시작돼요.": "It stays approved until then. Fixing and verification start at the scheduled time.",
 "그리드를 화면 폭 기준으로 바꾸면 원안대로 2열이 가능해요.": "Basing the grid on screen width makes the design’s 2 columns possible.",
 "그리드를 화면 폭 기준으로 바꿔 원안 2열을 유지해요.": "Base the grid on screen width to keep the design’s 2 columns.",
 "글자 크기 12px 이상 적용": "Font size of 12px or larger",
 "글자색·배경색 조정으로 명도 대비 확보": "Adjust text and background colors for enough contrast",
 "금": "Fri",
 "금액 반올림 적용": "Amount rounding applied",
 "금요일": "Friday",
 "기준": "Baseline",
 "기준 폭": "Base width",
 "끌어서 옮기기 · 원하는 곳에 놓거나, 요소 사이에 놓으면 그 순서로, 다른 요소 위에 놓으면 그 안에 · 더블클릭: 안의 요소 하나": "Drag to move · Drop anywhere, between elements to reorder, or on another element to nest it · Double-click: an element inside",
 "나": "Me",
 "나란히": "Side by side",
 "나란히 비교": "Side-by-side comparison",
 "나에게 온 변경이 없어요": "No changes assigned to you",
 "나중에 반영": "Apply later",
 "낮은 명도 대비로 인한 가독성 저하": "Low contrast hurts readability",
 "낮음": "Low",
 "내 결정": "My decisions",
 "내 할 일": "My tasks",
 "높음": "High",
 "높이": "Height",
 "높이 40px": "Height 40px",
 "높이 40px · #7c3aed 고정 → 디자인은 44px · primary 토큰": "40px tall · Fixed #7c3aed → Design is 44px · primary token",
 "누르거나 Esc로 닫기": "Click or press Esc to close",
 "누르면 알림이 닫혀요": "Click to dismiss",
 "다른 값": "Other value",
 "다른 값을 제안해 주세요": "Please suggest another value",
 "다른 수정안": "Other fix",
 "다시 검증": "Verify again",
 "다시 보내기": "Resend",
 "다시 시도": "Try again",
 "다시 알림": "Remind",
 "다시 열림": "Reopened",
 "다음": "Next",
 "다음 단계": "Next step",
 "다음 버전": "Next version",
 "다음 할 일": "Next up",
 "다음 항목 → 경고 확인 → 병합 요청": "Next item → Check warnings → Request merge",
 "다크 테마에서 border 구분선이 안 보여요": "The border divider is invisible in the dark theme",
 "닫기": "Close",
 "닫기 · Esc": "Close · Esc",
 "답글 취소": "Cancel reply",
 "대기": "Pending",
 "대기 중": "Pending",
 "대비 4.5:1 이상": "Contrast 4.5:1 or higher",
 "대시보드 시안 조합": "Dashboard draft mix",
 "댓글": "Comments",
 "댓글을 남겼어요": "Left a comment",
 "더 보기": "More",
 "데스크톱": "Desktop",
 "데이터베이스": "Database",
 "도움말": "Help",
 "돋보기": "Magnifier",
 "돋보기 끄기": "Turn off magnifier",
 "돋보기 켜기": "Turn on magnifier",
 "동기화 중": "Syncing",
 "두 버전 모두 20 × 20px → W·H를 24px 이상으로": "Both versions are 20 × 20px → set W·H to 24px or more",
 "두 버전 모두 작아요 · 터치 영역 확대 필요": "Both versions are too small · Touch region needs to be larger",
 "두 버전이 동일해서 조합할 게 없어요": "Both versions are identical, so there's nothing to mix",
 "두 브랜치가 같은 주문 합계 계산식에 쿠폰 할인과 소수점 반올림을 각각 추가했습니다.": "Both branches changed the same order total formula: one added a coupon discount, the other decimal rounding.",
 "두 브랜치가 결제 요청 함수를 각각 재시도 처리와 중복 제출 방지 로직으로 수정했습니다.": "Both branches changed the payment request function: one added retry handling, the other duplicate-submit prevention.",
 "두 브랜치가 프레임 매핑 구간을 각각 선택 핸들러와 식별 키로 수정했습니다.": "Both branches changed the frame mapping block: one with a selection handler, the other with an identity key.",
 "두 브랜치의 변경을 함께 유지하는 해결 제안 코드를 검토하세요.": "Review the suggested code that keeps both branches' changes.",
 "등록": "Register",
 "디자이너 결정": "Designer decision",
 "디자이너의 의견을 보고 해결 방법을 다시 골라 주세요": "Review the designer's feedback and choose a resolution again",
 "디자인": "Design",
 "디자인 값": "Design value",
 "디자인 값 · 코드 값": "Design value · Code value",
 "디자인 값 적용": "Apply design value",
 "디자인 값 카드를 선택하고 나머지 값은 병합 스튜디오에서 수정해요.": "Select the design value card and fix the remaining values in Merge Studio.",
 "디자인 값과 다른 결과가 반영될 수 있어요.": "The result may differ from the design value.",
 "디자인 값과 일치하는지 확인해요": "Check that it matches the design value",
 "디자인 값과 일치해요.": "Matches the design value.",
 "디자인 값에 맞게 아이콘 크기를 조정해요.": "Adjust the icon size to match the design value.",
 "디자인 값을 확인하고 값을 수정해요.": "Check the design value and fix the value.",
 "디자인 결정": "Design decision",
 "디자인 기준으로 맞춰요": "Match the design standard",
 "디자인 비교": "Design comparison",
 "디자인 비교 닫기": "Close design comparison",
 "디자인 비교 상세": "Design comparison details",
 "디자인 시안 검색": "Search design drafts",
 "디자인 원안": "Design",
 "디자인 원안대로 맞춰 바로 수정해요.": "Fix it to the design right away.",
 "디자인 원안의 값으로 코드를 고쳐요": "Fix the code to the design's values",
 "디자인 차이": "Design difference",
 "디자인 크기를 고르거나, Merge Studio에서 아이콘의 W와 H를 정하세요.": "Pick the design size, or set the icon's W and H in Merge Studio.",
 "디자인 토큰과 규격 사용 여부": "Whether design tokens and specs are used",
 "디자인 토큰이 확정되기 전이라 브랜드 보라색을 직접 적용": "Brand purple applied directly because design tokens weren't finalized yet",
 "디자인 확정 전까지 유지해요": "Keep until the design is finalized",
 "디자인과": "Design vs.",
 "디자인을 결정했어요": "Design decided",
 "라벨 자간 tracking-wide → 디자인은 기본 자간": "Label letter spacing tracking-wide → design uses default spacing",
 "라벨 자간이 넓음": "Label letter spacing is too wide",
 "레이아웃": "Layout",
 "레이아웃이 달라진 영역": "Regions with layout changes",
 "리플레이": "Replay",
 "마감 임박": "Due soon",
 "맞춤": "Fit",
 "맞춤 · 0": "Fit · 0",
 "머지할 수 있어요": "Ready to merge",
 "메모": "Note",
 "메모 (선택)": "Note (optional)",
 "멘션": "Mention",
 "모두 선택": "Select all",
 "모두 접기": "Collapse all",
 "모두 펼치기": "Expand all",
 "모든 검사 통과": "All checks passed",
 "모든 버튼": "All buttons",
 "모든 속성 선택 완료": "All properties selected",
 "모든 영역 선택 완료": "All regions selected",
 "모든 화면": "All screens",
 "모바일": "Mobile",
 "모서리 선택 후 닫기 버튼을 24 × 24px 이상으로": "Pick a corner, then make the close button 24 × 24px or larger",
 "목": "Thu",
 "목록으로": "Back to list",
 "목록으로 (Esc)": "Back to list (Esc)",
 "목요일": "Thursday",
 "문서 제목, 내용 또는 경로 검색": "Search doc titles, content, or paths",
 "미리보기": "Preview",
 "미리보기 없음": "No preview",
 "미선택 속성의 현재 구현 값 유지": "Keep current implementation value for unselected properties",
 "미선택 영역의 현재 화면 유지": "Keep current screen for unselected regions",
 "미적용 제안 없음": "No unapplied suggestions",
 "미적용 제안의 병합 결과 제외": "Exclude unapplied suggestions from the merge result",
 "바뀌는 코드": "Code that changes",
 "바로 반영으로": "Switch to apply now",
 "바로 반영을 시작해요 · 승인 기록이 남았어요": "Applying now · Approval recorded",
 "바로 수정": "Fix now",
 "밖으로 빼기": "Move out",
 "반려": "Reject",
 "반영 결과": "Result",
 "반영 시점": "When to apply",
 "반영 예정": "Scheduled",
 "반영 완료": "Applied",
 "반영된 결과": "Applied result",
 "반영할 결과": "Result to apply",
 "방금": "Just now",
 "배경 #1D4ED8 고정 → 디자인은 color.cta 토큰": "Background fixed to #1D4ED8 → design uses the color.cta token",
 "배송 아이콘 stroke 2.5 · 아이콘 세트는 2": "Shipping icon stroke 2.5 · icon set uses 2",
 "배송 아이콘 굵기를 기본값으로 돌려 줘": "Reset the shipping icon stroke to the default",
 "배송 아이콘의 strokeWidth를 지워 기본값(2)을 쓰세요.": "Remove strokeWidth from the shipping icon to use the default (2).",
 "배송 아이콘이 나머지 아이콘보다 굵어 보여요.": "The shipping icon looks bolder than the other icons.",
 "배송 옵션을 더 강조해요": "Emphasize shipping options more",
 "배포": "Deploy",
 "백엔드": "Backend",
 "버튼 글자·배경의 명도 대비": "Contrast between button text and background",
 "버튼 높이 4px 부족 · 고정 색으로 테마 미반영": "Button is 4px too short · Fixed color ignores theme",
 "범례 간격 4px → 디자인은 8px(space.2)": "Legend spacing 4px → design uses 8px (space.2)",
 "범례 항목 간격 4px · 디자인은 8px": "Legend item spacing 4px · design uses 8px",
 "범례가 붙어 보임": "Legend items look cramped",
 "변경 감지": "Detected",
 "변경 검토": "Review change",
 "변경 검토하기": "Review change",
 "변경 내역으로 돌아가기": "Back to changes",
 "변경 내역으로 돌아왔어요": "Back to changes",
 "변경 사유": "Reason for change",
 "변경 사유를 입력해 주세요": "Enter a reason for the change",
 "변경 사유를 적어 주세요.": "Write a reason for the change.",
 "변경 승인 — 검증 완료": "Change approved — verified",
 "변경 요청": "Request change",
 "변경 확인": "Changes",
 "변경할 때 자동으로 다시 확인합니다. 승인 상태는 별도로 확인하세요.": "Rechecks automatically when changed. Check approval status separately.",
 "변경확인": "Changes",
 "변경확인 닫기": "Close Changes",
 "변경확인 열기": "Open Changes",
 "병합": "Merge",
 "병합 가능": "Ready to merge",
 "병합 결과 보기": "View merge result",
 "병합 대기": "Waiting to merge",
 "병합 스튜디오": "Merge Studio",
 "병합 스튜디오에서 수정": "Fix in Merge Studio",
 "병합 스튜디오에서 이 항목 수정": "Fix this item in Merge Studio",
 "병합 스튜디오에서 이어서 고르기": "Continue choosing in Merge Studio",
 "병합 스튜디오에서 터치 영역 가로·세로 24px 이상 확보": "Make the touch region at least 24px wide and tall in Merge Studio",
 "병합 완료": "Merged",
 "병합 완료 · 반영됐어요": "Merged · Applied",
 "병합 요청": "Merge request",
 "병합 요청 메모": "Merge request note",
 "병합 요청됨": "Merge requested",
 "병합 요청됨 · 검토 대기": "Merge requested · Awaiting review",
 "병합 요청됨 · 승인됨": "Merge requested · Approved",
 "병합 요청을 보냈어요": "Merge request sent",
 "병합 전 검사": "Pre-merge checks",
 "병합 전후 변경 이력은 History에서 확인할 수 있어요.": "See the change history before and after the merge in History.",
 "병합에 쓰인 시안": "Drafts used in merge",
 "병합하고 해결하기": "Merge and resolve",
 "병합하기": "Merge",
 "병합하면 반영돼요": "Applied once merged",
 "병합하면 해결돼요": "Resolved once merged",
 "병합할 변경점이 없어요": "No changes to merge",
 "보기": "View",
 "보내기": "Send",
 "보내는 중…": "Sending…",
 "보내지 못했어요": "Couldn't send",
 "보통": "Normal",
 "복제": "Duplicate",
 "복제 · 바로 아래에 하나 더": "Duplicate · Add one right below",
 "불러오는 중": "Loading",
 "브랜드 보라색의 전환율이 더 높게 나왔어요": "Brand purple showed a higher conversion rate",
 "비교": "Compare",
 "비교 방식": "Comparison mode",
 "비교 종료": "End comparison",
 "비교 카드에서 적용 버전 선택": "Choose the version to apply on the comparison card",
 "비교를 불러오지 못했어요": "Couldn't load the comparison",
 "비교할 시안을 2개 이상 골라 주세요": "Pick at least 2 drafts to compare",
 "비동기": "Async",
 "빈 상태 일러스트 96px · 디자인은 120px": "Empty state illustration 96px · design uses 120px",
 "빈 화면이 허전해 보임": "Empty screen looks sparse",
 "빼기": "Remove",
 "사용 안 함": "Not used",
 "사용 중": "In use",
 "사용할 코드 버전을 선택하고 충돌 표시를 제거해요.": "Choose the code version to use and remove the change markers.",
 "사유를 보고 다른 수정안으로 다시 요청해요.": "Review the reason and request again with a different fix.",
 "사이드바 접힘 기준 1024px · 디자인은 768px": "Sidebar collapses at 1024px · design uses 768px",
 "삭제된 의견이에요": "This comment was deleted",
 "새 알림이 없어요": "No new notifications",
 "색상": "Color",
 "선 굵기 2.5 → 아이콘 세트는 2": "Stroke width 2.5 → icon set uses 2",
 "선택": "Select",
 "선택 해제": "Deselect",
 "선택 해제 (Esc)": "Deselect (Esc)",
 "선택 후 다음 항목으로 이동": "Select and go to next item",
 "선택됨": "Selected",
 "선택한 결과": "Selected result",
 "선택한 문서를 찾을 수 없습니다. Docs에서 문서를 다시 선택해 주세요.": "Couldn't find the selected doc. Select the doc again in Docs.",
 "속성": "Property",
 "속성 패널에서 값을 직접 입력합니다. 바꾼 값은 변경 내역의 카드와 코드에 바로 반영됩니다.": "Enter values directly in the properties panel. Changes are applied right away to the cards and code in Changes.",
 "속성별 적용 버전 선택 여부": "Whether a version is chosen for each property",
 "수": "Wed",
 "수요일": "Wednesday",
 "수정": "Edit",
 "수정 · 검증": "Fix · Verify",
 "수정 · 승인 · 해결 기록이 남았어요.": "Fix, approval, and resolution recorded.",
 "수정 내용을 확인하고 승인해 주세요": "Review the fix and approve it",
 "수정 반영": "Apply fix",
 "수정 승인": "Approve fix",
 "수정 요청": "Request fix",
 "수정 요청 보기": "View fix request",
 "수정 위치로 이동": "Go to fix location",
 "수정 전": "Before",
 "수정 전 확인 필요": "Needs review before fixing",
 "수정 전/후 비교는 위에서 볼 수 있어요.": "See the before/after comparison above.",
 "수정 중인 코드": "Code being fixed",
 "수정 후": "After",
 "수정 후 · 검증 실패": "After · Verification failed",
 "수정안": "Fix option",
 "수정안 검토 · 결정": "Review and decide on fix",
 "수정안 변경 · 재검토 필요": "Fix changed · Needs re-review",
 "수정안 선택": "Choose fix",
 "수정을 시작했어요": "Fix started",
 "수정을 요청했어요": "Asked for changes",
 "수정한 값": "Fixed value",
 "수정한 값을 검증하고 있어요": "Verifying the fixed value",
 "수정한 값이 결정한 값과 같아요.": "The fixed value matches the decided value.",
 "수정한 값이 기준과 같은지 확인하고 있어요.": "Checking that the fixed value matches the baseline.",
 "수정한 코드": "Fixed code",
 "수정할 내용": "What to fix",
 "수정할 위치로 이동": "Go to fix location",
 "수정할 항목": "Items to fix",
 "숫자 타일 · 캡슐형 버튼 + 가격": "Number tiles · Pill button + price",
 "숫자가 커서 16px이면 두 줄로 넘어가요": "The number is large, so it wraps to two lines at 16px",
 "스키마": "Schema",
 "슬라이더": "Slider",
 "승인": "Approve",
 "승인 · 반려": "Approve · Reject",
 "승인 기록이 남았어요": "Approval recorded",
 "승인 대기": "Awaiting approval",
 "승인 완료": "Approved",
 "승인 요청": "Approval request",
 "승인 요청을 보냈어요": "Approval requested",
 "승인됐어요 · 병합하면 반영돼요": "Approved · Applied once merged",
 "승인되면 병합해요": "Merge once approved",
 "승인되면 자동으로 수정하고 검증해요": "Fixes and verifies automatically once approved",
 "승인됨": "Approved",
 "승인을 요청했어요": "Approval requested",
 "승인했어요": "Approved",
 "시스템 폰트에서 700은 글자가 뭉개져 보여요": "Weight 700 looks smudged in the system font",
 "시안": "Draft",
 "시안 보기": "View draft",
 "시안 비교": "Compare drafts",
 "시안 비교에서 영역별 적용 시안 선택": "Choose a draft for each region in Compare drafts",
 "시안 생성": "Create draft",
 "시안 접기": "Collapse drafts",
 "시안 펴기": "Expand drafts",
 "시안에 대한 코멘트": "Comments on draft",
 "실제 구현": "As built",
 "실제 크기는 값을 고르면 보여요": "Actual size appears once you pick a value",
 "아래 \"기준값 적용\" 버튼으로 해당 속성을 기준값으로 바꿉니다.": "Use the \"Apply baseline\" button below to set this property to the baseline value.",
 "아래로": "Down",
 "아래로 (Alt+↓)": "Down (Alt+↓)",
 "아이콘 20px → 디자인은 24px": "Icon 20px → design uses 24px",
 "아이콘 카드 · 전체 너비 버튼": "Icon card · Full-width button",
 "아이콘 크기가 달라 화면의 일관성이 떨어져요.": "Different icon sizes make the screen look inconsistent.",
 "아이콘 크기가 디자인 값과 일치하는지 확인해요": "Check that icon sizes match the design value",
 "아이콘이 굵어 보임": "Icon looks too bold",
 "아직 검토자가 없어요": "No reviewers yet",
 "아직 고르지 않음": "Not chosen yet",
 "아직 받은 알림이 없어요": "No notifications yet",
 "아키텍처": "Architecture",
 "안": "Option",
 "안 읽음으로 표시": "Mark as unread",
 "안쪽 여백 12px → 디자인은 16px(space.4)": "Padding 12px → design uses 16px (space.4)",
 "알림 닫기": "Close notification",
 "어제": "Yesterday",
 "여기서 터치 영역을 수정하세요": "Fix the touch region here",
 "여기에 해당하는 알림이 없어요": "No notifications here",
 "열 수": "Columns",
 "영역": "Regions",
 "영향 범위": "Impact",
 "예외 승인됨": "Exception approved",
 "예외 요청": "Request exception",
 "예외 요청됨 · 검토자가 승인하면 병합할 수 있어요": "Exception requested · Can merge once a reviewer approves",
 "예외 처리": "Exception",
 "오늘": "Today",
 "올려서 결과 미리보기 · 눌러서 적용": "Hover to preview the result · Click to apply",
 "완료": "Done",
 "완료 직전": "Almost done",
 "요소": "Element",
 "요소 선택": "Select element",
 "요소 편집": "Edit element",
 "요소 항목": "Element item",
 "요소에 올리고 \"이걸로\" · 끌어서 이동 · ⌘+스크롤 확대": "Hover an element and pick \"Use this\" · Drag to move · ⌘+scroll to zoom",
 "요청 보기": "View request",
 "요청 보내기": "Send request",
 "요청 전": "Before request",
 "요청 취소": "Cancel request",
 "요청 확인": "Review request",
 "요청을 확인하고 결정해 주세요": "Review the request and decide",
 "요청한 결과": "Requested result",
 "요청한 수정안": "Requested fix",
 "운영": "Operations",
 "원본": "Original",
 "원본과 코드 겹쳐보기 — 캔버스에서 보기": "Overlay original and code — view on canvas",
 "원안": "Design",
 "원안 2열을 유지할 수 있다면 그 방향으로 가요.": "If we can keep the design's 2 columns, let's go that way.",
 "원안 변경": "Change the design",
 "원안과 구현을 비교해 결정해 주세요": "Compare the design and implementation, then decide",
 "원안과 현재의 절충값": "A value between the design and the current one",
 "원안도 요청한 값으로 바꿀게요.": "I'll update the design to the requested value too.",
 "원안도 지금 값도 아닌 값을 정해 요청해요": "Request a value that's neither the design nor the current value",
 "원안으로 맞추기": "Match the design",
 "원안으로 수정": "Fix to the design",
 "원안의 2열을 유지해요": "Keeps the design's 2 columns",
 "원인": "Cause",
 "월": "Mon",
 "월요일": "Monday",
 "위 값으로 표현하기 어려운 내용만 적어 주세요.": "Only note what the values above can't express.",
 "위로": "Up",
 "위로 (Alt+↑)": "Up (Alt+↑)",
 "위험도가 높은 변경이라 자동으로 수정하지 않았어요. 승인하면 수정과 검증이 이어서 진행돼요.": "This is a high-risk change, so it wasn't fixed automatically. Once approved, fixing and verification will continue.",
 "의견": "Comments",
 "의견만": "Comments only",
 "의견을 남겨 주세요. @로 멘션할 수 있어요": "Leave a comment. Use @ to mention someone",
 "이 값을 고른 이유": "Why this value",
 "이 단계부터 리플레이 보기": "Watch replay from this step",
 "이 문서에 대해 AI에게 질문": "Ask AI about this doc",
 "이 버전부터": "From this version",
 "이 변경은": "This change",
 "이 수정안 적용하기": "Apply this fix",
 "이 시안으로 모두 선택": "Select all from this draft",
 "이 영역 생략": "Skip this region",
 "이 조합을 저장하면서 바뀐 코드와 그 렌더링이에요.": "These are the code changes and render from saving this mix.",
 "이 주소의 디자인 시안을 찾을 수 없어요. 목록에서 다른 항목을 골라 주세요.": "Couldn't find a design draft at this address. Pick another item from the list.",
 "이 항목을 검토할 권한이 없어요": "You don't have permission to review this item",
 "이 항목을 조합할 권한이 없어요": "You don't have permission to mix this item",
 "이렇게 결정한 이유": "Why this decision",
 "이번 주": "This week",
 "이유": "Reason",
 "이유를 입력해 주세요": "Enter a reason",
 "이전": "Previous",
 "이후": "After",
 "인증": "Auth",
 "일": "Sun",
 "일러스트 96px → 디자인은 120px": "Illustration 96px → design is 120px",
 "일러스트보다 버튼이 먼저 보여야 해요": "The button should stand out more than the illustration",
 "일요일": "Sunday",
 "읽기 전용": "Read-only",
 "읽기 전용이에요": "This is read-only",
 "읽음으로 표시": "Mark as read",
 "입력": "Input",
 "입력 칸이 많아 간격을 좁게 두고 싶어요": "There are many inputs, so I want tighter spacing",
 "입력 필드 사이가 8px 간격 단위보다 2px 좁아요.": "Input fields are 2px tighter than the 8px spacing unit.",
 "입력값": "Input value",
 "자동 감지": "Auto-detected",
 "자동 수정": "Auto-fix",
 "자동 수정 불가": "Can't auto-fix",
 "자동 처리": "Auto-handled",
 "자동으로 수정할 수 없어요": "Can't fix automatically",
 "자동으로 수정할 수 없어요 · 코드를 직접 수정해 주세요": "Can't fix automatically · Edit the code directly",
 "자세히": "Details",
 "작은 글자 크기로 인한 가독성 저하": "Reduced readability from small font size",
 "작은 라벨이라 기본 자간이면 글자가 붙어 보여요": "It's a small label, so default letter spacing makes the text look cramped",
 "작은 터치 영역으로 인한 오입력 가능": "Possible mis-taps from small touch target",
 "작은 화면에서 탭 폭이 좁아요": "Tabs are narrow on small screens",
 "잠시 후 다시 시도해 주세요.": "Try again in a moment.",
 "재검토 요청": "Ask for changes",
 "재검토 필요": "Needs re-review",
 "저장됨": "Saved",
 "적용": "Apply",
 "적용 구간": "Applies to",
 "적용 취소하기": "Undo apply",
 "전체": "All",
 "전체 사용": "Use all",
 "전체 시안 비교": "Compare all drafts",
 "전체 알림 보기": "View all notifications",
 "전체 화면으로 보기": "View full screen",
 "접근성 최소 기준으로 키움": "Increased to the accessibility minimum",
 "접기": "Collapse",
 "정밀 조정": "Fine-tune",
 "제목 + 기간 칩": "Title + date range chip",
 "제목 + 인사말": "Title + greeting",
 "제목 굵기 600 · 디자인은 700": "Title weight 600 · design is 700",
 "제목 굵기 600 → 디자인은 700": "Title weight 600 → design is 700",
 "제목이 덜 강조됨": "Title is under-emphasized",
 "제안": "Suggestion",
 "제안 보내기": "Send suggestion",
 "제자리": "In place",
 "제자리로": "Back in place",
 "제자리로 · 쌓인 순서의 자리로": "Back in place · to its spot in the stack order",
 "제출 중에는 요청을 차단하고 isSubmitting 상태를 설정합니다.": "Blocks requests while submitting and sets the isSubmitting state.",
 "조정 내용을 변경 내역에 반영했어요": "Applied adjustments to the change history",
 "조정 완료": "Adjustment done",
 "조합": "Mix",
 "조합 결과": "Mix result",
 "조합 미리보기": "Mix preview",
 "조합 수정": "Edit mix",
 "조합 저장": "Save mix",
 "조합 전": "Before mix",
 "조합 중": "Mixing",
 "조합을 마쳤어요 · 승인을 요청하세요": "Mix complete · Request approval",
 "조합을 마치면 요청해요": "Request once the mix is done",
 "조합하기": "Mix",
 "좁은 차트에 범례를 한 줄로 맞춰요": "Fit the legend on one line in narrow charts",
 "주문 버튼": "Order button",
 "주문 버튼 · 중복 결제 방지 · 겹치는 동작": "Order button · Duplicate payment prevention · Overlapping behavior",
 "주문 버튼 높이 40px · 보라색(#7c3aed) 고정 · 디자인은 44px large 버튼과 primary 토큰": "Order button height 40px · fixed purple (#7c3aed) · design is 44px large button with primary token",
 "주문 버튼 배경을 #7c3aed로 변경": "Change the order button's background to #7c3aed",
 "주문 버튼 추가": "Add order button",
 "주문 버튼을 결제 디자인에 맞춰 줘": "Match the order button to the checkout design",
 "주문 완료 화면 시안 조합": "Mix order complete screen drafts",
 "주문 요약 · 할인 금액 계산 · 겹치는 계산식": "Order summary · Discount calculation · Overlapping formula",
 "주문 요약 구분선 slate-200 · 디자인은 border 토큰": "Order summary divider slate-200 · design uses border token",
 "주문 요약 구분선에 border 토큰을 써 줘": "Use the border token for the order summary divider",
 "주문 요약 누락으로 인한 결제 내역 확인 어려움": "Hard to check payment details without the order summary",
 "주문 요약 표시": "Show order summary",
 "주문 요약이 포함된 시안 선택": "Select a draft that includes the order summary",
 "주문 합계를 소수점 둘째 자리로 반올림합니다.": "Rounds the order total to two decimal places.",
 "주문 합계에서 쿠폰 할인 금액을 차감합니다.": "Subtracts the coupon discount from the order total.",
 "중복 결제 방지": "Prevent duplicate payment",
 "중복 제출 방지와 재시도를 함께 유지하고, 완료 시 제출 상태를 해제합니다.": "Keeps both duplicate-submit prevention and retry, and clears the submitting state on completion.",
 "지금": "Now",
 "지금 이 시안들을 조합하고 있어요 — 캔버스에서 이어서 하세요": "You're mixing these drafts now — continue on the canvas",
 "지금 코드의 값을 그대로 두고, 원안을 바꿔 달라고 요청해요": "Keep the current code value and ask for the design to change",
 "지금은 조합할 수 없어요": "Can't mix right now",
 "직접 수정": "Edit manually",
 "직접 수정 중": "Editing manually",
 "직접 수정 중 · 수정이 끝나면 다시 검증하세요": "Editing manually · Verify again when you're done",
 "직접 수정으로 전환했어요": "Switched to manual editing",
 "직접 이유 입력": "Enter your own reason",
 "직접 입력": "Enter a value",
 "진행 기록": "Activity log",
 "진행 중": "In progress",
 "차이 있음": "Differs",
 "차이가 다시 감지됐어요": "The difference was detected again",
 "처음부터 다시": "Start over",
 "첨부 없음": "No attachments",
 "최소 글자 크기 충족 여부": "Meets minimum font size",
 "최종 디자인을 저장했어요": "Saved the final design",
 "추천": "Recommended",
 "축소": "Zoom out",
 "축소 · −": "Zoom out · −",
 "출시 전": "Before launch",
 "충돌 표시가 남아 있으면 실행 오류가 생길 수 있어요.": "Leftover conflict markers can cause runtime errors.",
 "충돌 표시가 없어요.": "No conflict markers.",
 "취소": "Cancel",
 "카드 간격": "Card spacing",
 "카드 간격 16px · 여백 20px": "Card gap 16px · padding 20px",
 "카드 간격 8px · 여백 16px": "Card gap 8px · padding 16px",
 "카드 겹침": "Cards overlap",
 "카드 배치": "Card layout",
 "카드 번호 라벨은 자간이 넓어야 읽기 쉬워요": "Card number labels need wider letter spacing to read easily",
 "카드 안쪽 여백 12px · 디자인은 16px (space.4)": "Card padding 12px · design is 16px (space.4)",
 "카드 폭": "Card width",
 "카드 폭(px)": "Card width (px)",
 "카드 폭을 줄이면 겹치지 않아요": "Reducing the card width prevents overlap",
 "카드가 답답해 보임": "Cards look cramped",
 "칸에 맞춤": "Fit to cell",
 "캔버스에서 노란 테두리로 표시된 요소를 선택합니다.": "Selects the element outlined in yellow on the canvas.",
 "캔버스에서 보기": "View on canvas",
 "캔버스에서 이 프레임 보기": "View this frame on canvas",
 "캔버스의 AI로 적용 버튼으로 제안 반영": "Apply the suggestion with the Apply with AI button on the canvas",
 "컬러": "Color",
 "컴포넌트": "Components",
 "컴퓨터에서 파일을 선택해 이 작업창에 열기": "Choose a file from your computer to open in this workspace",
 "코드": "Code",
 "코드 값": "Code value",
 "코드 값 적용": "Apply code value",
 "코드 변경 보기": "View code changes",
 "코드 불투명도": "Code opacity",
 "코드 수정 중": "Fixing code",
 "코드 자세히 보기": "View code details",
 "코드·디자인 모두 20 × 20px → 기준은 24px 이상": "Both code and design are 20 × 20px → minimum is 24px",
 "코드는 그대로 두기로 했어요 · 바뀐 줄이 없어요.": "Decided to keep the code as is · No lines changed.",
 "코드를 디자인 원안(768px 카드 2열, 화면 폭에 맞춤)에 맞게 수정해요.": "Fix the code to match the design (768px cards in 2 columns, fit to screen width).",
 "코드를 디자인 원안에 맞춰 고쳐요": "Fix the code to match the design",
 "코멘트": "Comments",
 "코멘트 남기기": "Leave a comment",
 "코멘트를 추가했어요": "Comment added",
 "쿠폰 닫기 버튼 20 × 20px (두 버전 모두) · 어느 쪽을 골라도 해결되지 않음": "Coupon close button 20 × 20px (both versions) · Neither choice resolves it",
 "쿠폰 닫기 버튼 20 × 20px (코드 · 디자인 모두) · 터치 영역 기준 24px 미만": "Coupon close button 20 × 20px (both code and design) · Below the 24px touch target minimum",
 "쿠폰 할인 적용": "Apply coupon discount",
 "쿠폰을 먼저 적용한 뒤 최종 합계를 반올림합니다.": "Applies the coupon first, then rounds the final total.",
 "크기": "Size",
 "클릭: 요소 선택 · 끌어서 사이나 안에 넣기 · 더블클릭: 안의 요소 하나": "Click: select element · Drag: place between or inside · Double-click: one element inside",
 "클릭해서 교체": "Click to replace",
 "태블릿": "Tablet",
 "태블릿 가로에서 사이드바가 일찍 접힘": "Sidebar collapses early on landscape tablet",
 "태블릿에서 카드 내용이 가려짐": "Card content is clipped on tablet",
 "태블릿에서 카드 내용이 가려짐, 2열 유지 시 카드 폭이 너무 좁아짐": "Card content is clipped on tablet; keeping 2 columns makes cards too narrow",
 "태블릿에서 카드가 겹쳐 숫자가 가려지고, 구매 버튼이 아래로 밀려요.": "On tablet the cards overlap, hiding the numbers, and the buy button is pushed down.",
 "태블릿에서도 데스크톱과 같은 2열을 유지하려고": "To keep the same 2 columns as desktop on tablet",
 "태블릿에선 1열이 읽기 쉬워요": "1 column is easier to read on tablet",
 "탭 라벨과 함께 놓이면 24px 아이콘이 커 보여요": "Next to tab labels, a 24px icon looks too big",
 "탭 아이콘 코드 20px · 디자인 24px": "Tab icon code 20px · design 24px",
 "탭 아이콘이 디자인보다 작게 보임": "Tab icons look smaller than the design",
 "터치 영역 크기": "Touch target size",
 "터치 화면에서 누르기 어려움": "Hard to tap on touch screens",
 "테마 변경을 따르지 않음": "Doesn't follow theme changes",
 "테마를 따르지 않음": "Doesn't follow the theme",
 "토": "Sat",
 "토요일": "Saturday",
 "토큰 수정 전까지 현재 색을 유지해요": "Keep the current color until the token is fixed",
 "팀": "Team",
 "파랑": "Blue",
 "파일 여는 중…": "Opening file…",
 "패딩": "Padding",
 "폰트 굵기": "Font weight",
 "폼 필드 간격 6px · 디자인은 8px (4/8 간격 단위)": "Form field gap 6px · design is 8px (4/8 spacing unit)",
 "폼 필드 간격이 6px에서 8px로 바뀌어 4/8 간격 단위를 지켜요.": "Form field gap changes from 6px to 8px, following the 4/8 spacing unit.",
 "프레임 선택 처리": "Handle frame selection",
 "프레임 식별 키 추가": "Add frame identifier key",
 "프레임 클릭 시 선택 상태를 변경하는 핸들러를 추가합니다.": "Adds a handler that changes the selection state when a frame is clicked.",
 "프레임을 그리는 같은 구간(9–14행)을 수정했습니다.": "Edited the same section that draws the frame (lines 9–14).",
 "필드 간격 6px → 디자인은 8px(4/8 단위)": "Field gap 6px → design is 8px (4/8 unit)",
 "필드 라벨 tracking-wide · 디자인 시스템은 기본 자간": "Field label tracking-wide · design system uses default letter spacing",
 "필드 라벨 자간이 나머지 폼보다 조금 넓어 보여요.": "Field labels look slightly wider spaced than the rest of the form.",
 "필드 라벨에서 tracking-wide를 지우세요.": "Remove tracking-wide from field labels.",
 "필드 사이가 2px 좁음": "Fields are 2px too close",
 "필수": "Required",
 "하나의 강조색": "Single accent color",
 "한국어": "Korean",
 "항목을 골라 쓸 시안을 누르기": "Pick an item, then click the draft to use",
 "해결": "Resolve",
 "해결 방법": "Resolution",
 "해결 방법 미선택": "No resolution selected",
 "해결 방법 선택": "Choose resolution",
 "해결 방법을 고르고 승인을 요청해요": "Choose a resolution and request approval",
 "해결 방법을 골라 주세요": "Choose a resolution",
 "해결됐어요": "Resolved",
 "해결되지 않은 코드 충돌 표시가 있는지 확인해요": "Checks for unresolved code conflict markers",
 "해결됨": "Resolved",
 "헤더": "Header",
 "헤더 · B": "Header · B",
 "현재": "Current",
 "현재 24px": "Currently 24px",
 "현재 2열": "Currently 2 columns",
 "현재 360px 고정": "Currently fixed at 360px",
 "현재 값 유지": "Keep current value",
 "현재 구현": "As built",
 "현재 구현 보는 중": "Viewing current implementation",
 "현재 버전에도 남아 있음": "Still present in current version",
 "현재 버전에서는 해결됨": "Resolved in current version",
 "현재 코드": "Current code",
 "현재 화면": "Current screen",
 "화": "Tue",
 "화면": "Screen",
 "화면 맞춤": "Fit to screen",
 "화면 영역별 강조색 일치 여부": "Accent color matches per screen region",
 "화면 영역별 적용 시안 선택 여부": "Draft selected per screen region",
 "화면 폭 맞춤 2열": "2 columns fit to screen width",
 "화면, 시안, 조합 영역 검색…": "Search screens, drafts, mix regions…",
 "화면마다 형태가 달라요. 테마 변경이 반영되지 않았을 수 있어요.": "Each screen looks different. Theme changes may not have been applied.",
 "화면에 맞춰 늘어남": "Stretches to fit screen",
 "화면으로 돌아가기": "Back to screen",
 "화요일": "Tuesday",
 "확대": "Zoom in",
 "확대 · +": "Zoom in · +",
 "확인 필요": "Needs review",
 "확정하고 저장": "Confirm and save",
 "활동": "Activity",
 "활동 필터": "Activity filter",
 "히스토리에서 보기": "View in History"
}
export const enTemplates = [
 [
  "**{0}**을(를) 머지하고 있어요. 남은 변경점은 {1}개예요. 이 변경에 대해 묻거나, 머지 전에 남은 일을 확인하거나, 검토 요청 메시지를 써 달라고 해 주세요.",
  "Merging **{0}**. {1} changes left. Ask about this change, check what's left before merging, or have me write a review request message."
 ],
 [
  "「{0}」에서 질문과 일치하는 내용을 찾지 못했습니다. 문서의 섹션명이나 용어를 포함해 질문해 주세요.\\n\\n{1}\\n섹션: {2}",
  "Couldn't find anything matching your question in “{0}”. Try including a section name or term from the document.\\n\\n{1}\\nSection: {2}"
 ],
 [
  "**{0}**에는 연결된 변경점이 없어요. 캔버스의 두 아트보드를 비교해 차이를 확인해 주세요.",
  "**{0}** has no linked changes. Compare the two artboards on the canvas to see the differences."
 ],
 [
  "속성 → 레이아웃에서 W와 H를 {0}px 이상으로 입력합니다 (강조된 입력란).",
  "In Properties → Layout, set W and H to {0}px or more (highlighted fields)."
 ],
 [
  "{0}px에서 카드가 겹치지 않고, 결정한 레이아웃과 같아요.",
  "At {0}px, cards don't overlap and match the chosen layout."
 ],
 [
  "**{0}**은(는) 모두 머지됐어요. 남은 일이 없어요.",
  "**{0}** is fully merged. Nothing left to do."
 ],
 [
  "**{0}**은(는) 코드를 디자인에 맞추는 변경이에요.",
  "**{0}** is a change that aligns the code with the design."
 ],
 [
  "현재 구현 보는 중 · Space를 떼면 옵션 {0}",
  "Viewing current implementation · Release Space for option {0}"
 ],
 [
  "승인하면 디자인 원안이 '{0}' 값으로 바뀌어요",
  "Approving changes the design to the '{0}' value"
 ],
 [
  "{0} 수정 · 필드 간격 {1} → {2} (검증 통과)",
  "Fixed {0} · Field spacing {1} → {2} (verified)"
 ],
 [
  "바꿀 값: W · H를 각각 {0}px 이상으로",
  "New value: W and H each at least {0}px"
 ],
 [
  "{0}님의 요청대로 승인 · 승인 이력에 저장",
  "Approve as {0} requested · Saved to approval history"
 ],
 [
  "코드를 디자인 원안({0})에 맞게 수정해요.",
  "Update the code to match the design ({0})."
 ],
 [
  "{0} 적용하고 디자인 원안에도 동기화해요.",
  "Apply {0} and sync it to the design too."
 ],
 [
  "승인하면 디자인 원안이 '{0}'로 바뀌어요",
  "Approving changes the design to '{0}'"
 ],
 [
  "{0} 반영 예정 · 승인 기록이 남았어요",
  "{0} will be applied · Approval recorded"
 ],
 [
  "{0}에서 코멘트를 남길 요소를 누르세요.",
  "Click an element in {0} to comment on it."
 ],
 [
  "{0} · 워크스페이스 작업창으로 드래그",
  "{0} · Drag to the workspace panel"
 ],
 [
  "노란 입력칸에 {0} 이상을 입력하세요.",
  "Enter {0} or more in the yellow field."
 ],
 [
  "새 변경확인이 자동 감지됐어요 · {0}",
  "New change automatically detected · {0}"
 ],
 [
  "현재 구현 보는 중 · 떼면 옵션 {0}",
  "Viewing current implementation · Release for option {0}"
 ],
 [
  "{0}님에게 전달 · 승인 이력에 저장",
  "Send to {0} · Saved to approval history"
 ],
 [
  "간격 {0}px로 한 줄에 더 배치해요",
  "Fit more in one row with {0}px spacing"
 ],
 [
  "필수 검사 통과 · 권장 사항 {0}개",
  "Required checks passed · {0} recommendations"
 ],
 [
  "{0} · 눌러서 보기에 넣거나 빼기",
  "{0} · Click to add to or remove from view"
 ],
 [
  "옵션 {0} 미리보기 · 적용 안 됨",
  "Previewing option {0} · Not applied"
 ],
 [
  "{0}: 디자인은 {1}, 코드는 {2}이에요",
  "{0}: design is {1}, code is {2}"
 ],
 [
  "{0}님에게 다른 수정안을 요청해요",
  "Request a different fix from {0}"
 ],
 [
  "카드 간격 {0}px (기준 {1}px)",
  "Card spacing {0}px (baseline {1}px)"
 ],
 [
  "{0} · 승인되면 바로 반영돼요",
  "{0} · Applied as soon as approved"
 ],
 [
  "{0}님의 결정을 기다리고 있어요",
  "Waiting for {0}'s decision"
 ],
 [
  "결제 폼 필드 간격: {0} → {1}",
  "Payment form field spacing: {0} → {1}"
 ],
 [
  "{0} 안에 넣기 · 간격 {1}px",
  "Place inside {0} · Spacing {1}px"
 ],
 [
  "{0}개 항목을 더 골라 주세요",
  "Select {0} more items"
 ],
 [
  "{0}님에게 결정을 보냈어요: {1}",
  "Sent decision to {0}: {1}"
 ],
 [
  "병합 스튜디오 · {0}/{1} 선택",
  "Merge Studio · {0}/{1} selected"
 ],
 [
  "승인됐어요 · {0} 반영 예정",
  "Approved · {0} will be applied"
 ],
 [
  "여기에 넣기 · 간격 {0}px",
  "Place here · Spacing {0}px"
 ],
 [
  "전체 한 번에 비교 · {0}개",
  "Compare all at once · {0}"
 ],
 [
  "{0} · 전체 화면으로 보기",
  "{0} · View full screen"
 ],
 [
  "{0} 밖으로 (바로 아래에)",
  "Outside {0} (directly below)"
 ],
 [
  "{0}님, {1} 검토 부탁드려요.",
  "{0}, please review {1}."
 ],
 [
  "{0}님에게 승인을 요청했어요",
  "Requested approval from {0}"
 ],
 [
  "{0}이 아직 결정과 달라요.",
  "{0} still differs from the decision."
 ],
 [
  "검토자 {0}명에게 승인 요청",
  "Request approval from {0} reviewers"
 ],
 [
  "병합 전 해결할 문제 {0}개",
  "{0} issues to resolve before merging"
 ],
 [
  "카드 열 수: {0}열 → {1}열",
  "Card columns: {0} → {1}"
 ],
 [
  "{0} · 코드·디자인 동일",
  "{0} · Code and design match"
 ],
 [
  "{0}px에서 카드가 겹쳐요",
  "Cards overlap at {0}px"
 ],
 [
  "{0}님이 수정을 요청했어요",
  "{0} requested changes"
 ],
 [
  "{0}에게 승인을 요청했어요",
  "Requested approval from {0}"
 ],
 [
  "{0}을 병합하고 해결했어요",
  "Merged and resolved {0}"
 ],
 [
  "{0}의 승인을 기다리는 중",
  "Waiting for {0}'s approval"
 ],
 [
  "마감이 내일이에요 · {0}",
  "Due tomorrow · {0}"
 ],
 [
  "변경을 감지했어요 · {0}",
  "Change detected · {0}"
 ],
 [
  "승인을 요청했어요 · {0}",
  "Approval requested · {0}"
 ],
 [
  "자동 수정 · 파일 {0}개",
  "Auto-fix · {0} files"
 ],
 [
  "카드 열 너비: {0} → {1}",
  "Card column width: {0} → {1}"
 ],
 [
  "{0} · 원안으로 맞추기",
  "{0} · Match the design"
 ],
 [
  "{0} — 캔버스에서 보기",
  "{0} — View on canvas"
 ],
 [
  "{0} 병합 · 반영 완료",
  "{0} merged · Applied"
 ],
 [
  "{0}을 확인하고 있어요.",
  "Checking {0}."
 ],
 [
  "· 카드가 {0}px 겹침",
  "· Cards overlap by {0}px"
 ],
 [
  "디자인 원안 유지({0})",
  "Keep the design ({0})"
 ],
 [
  "{0} · {1} · 위험도 {2}",
  "{0} · {1} · Risk {2}"
 ],
 [
  "{0} · 두 버전 공통",
  "{0} · Common to both versions"
 ],
 [
  "{0}님이 결정했어요: {1}",
  "{0} decided: {1}"
 ],
 [
  "{0}을 검증하고 있어요",
  "Verifying {0}"
 ],
 [
  "프레임 {0} · {1}px {2}",
  "Frame {0} · {1}px {2}"
 ],
 [
  "{0} · 시안 {1} 사용",
  "{0} · Using draft {1}"
 ],
 [
  "{0}님에게 승인 요청",
  "Request approval from {0}"
 ],
 [
  "커밋 {0} 동기화 중",
  "Syncing commit {0}"
 ],
 [
  "{0} · 영향 화면",
  "{0} · Affected screens"
 ],
 [
  "{0} · 크게 보기",
  "{0} · Enlarge"
 ],
 [
  "내일 마감 · {0}",
  "Due tomorrow · {0}"
 ],
 [
  "디자인 원안({0})",
  "The design ({0})"
 ],
 [
  "미해결 충돌 {0}건",
  "{0} unresolved changes"
 ],
 [
  "병합했어요 · {0}",
  "Merged · {0}"
 ],
 [
  "승인 · {0} 반영",
  "Approve · Apply {0}"
 ],
 [
  "카드 겹침 {0}px",
  "Card overlap {0}px"
 ],
 [
  "카드가 {0} 겹쳐요",
  "Cards overlap by {0}"
 ],
 [
  "{0}단계 중 {1}단계{2}",
  "Step {1} of {0}{2}"
 ],
 [
  "{0}에 대한 의견",
  "Comments on {0}"
 ],
 [
  "· 간격 {0}px",
  "· Spacing {0}px"
 ],
 [
  "· 겹침 {0}px",
  "· Overlap {0}px"
 ],
 [
  "개발 단계: {0}",
  "Dev stage: {0}"
 ],
 [
  "경고 {0}개 포함",
  "Includes {0} warnings"
 ],
 [
  "경고 {0}개 확인",
  "Review {0} warnings"
 ],
 [
  "모두 시안 {0}로",
  "All to draft {0}"
 ],
 [
  "요소 {0}개 사용",
  "Uses {0} elements"
 ],
 [
  "이전 조합 {0}개",
  "{0} previous mixes"
 ],
 [
  "{0} · {1} 해결",
  "{0} · {1} resolved"
 ],
 [
  "{0} 반영 예정",
  "{0} will be applied"
 ],
 [
  "{0} 시안 비교",
  "Compare {0} drafts"
 ],
 [
  "{0}({1}px)에서",
  "At {0} ({1}px)"
 ],
 [
  "{0}px 렌더링",
  "Rendered at {0}px"
 ],
 [
  "{0}px 재비교",
  "Re-compare at {0}px"
 ],
 [
  "{0}시안 {1} · {2}",
  "{0}Draft {1} · {2}"
 ],
 [
  "{0}월 {1}일 ({2})",
  "{0}/{1} ({2})"
 ],
 [
  "· {0}차 요청",
  "· Request #{0}"
 ],
 [
  "· 확인 {0}개",
  "· {0} checks"
 ],
 [
  "대기 중: {0}",
  "Waiting: {0}"
 ],
 [
  "승인됨 · {0}",
  "Approved · {0}"
 ],
 [
  "{0} · 기준",
  "{0} · Baseline"
 ],
 [
  "{0} · 맞춤",
  "{0} · Fit"
 ],
 [
  "{0} · 제안",
  "{0} · Suggestion"
 ],
 [
  "{0}px 고정",
  "Fixed at {0}px"
 ],
 [
  "{0}님의 결정",
  "{0}'s decision"
 ],
 [
  "{0}님이 병합",
  "Merged by {0}"
 ],
 [
  "{0}에 대한 {1}",
  "{1} on {0}"
 ],
 [
  "{0}에게 요청",
  "Request from {0}"
 ],
 [
  "· {0} 반영",
  "· {0} applied"
 ],
 [
  "간격 {0}px",
  "Spacing {0}px"
 ],
 [
  "{0}/{1} 승인",
  "{0}/{1} approved"
 ],
 [
  "{0}개 포함",
  "{0} included"
 ],
 [
  "{0}시간 전",
  "{0}h ago"
 ],
 [
  "{0}월 {1}일 {2}",
  "{0}/{1} {2}"
 ],
 [
  "요청자 {0}",
  "Requested by {0}"
 ],
 [
  "위험도 {0}",
  "Risk {0}"
 ],
 [
  "카드 {0}열",
  "{0} card columns"
 ],
 [
  "통과 {0}개",
  "{0} passed"
 ],
 [
  "({0}차)",
  "(round {0})"
 ],
 [
  "{0} 반영",
  "Apply {0}"
 ],
 [
  "{0} 선택",
  "Select {0}"
 ],
 [
  "{0} 승인",
  "{0} approved"
 ],
 [
  "{0} 요청",
  "{0} request"
 ],
 [
  "{0} 의견",
  "{0} comment"
 ],
 [
  "{0}분 전",
  "{0}m ago"
 ],
 [
  "{0}시안 {1}",
  "{0}Draft {1}"
 ],
 [
  "{0}월 {1}일",
  "{0}/{1}"
 ],
 [
  "{0}일 전",
  "{0}d ago"
 ],
 [
  "· {0}행",
  "· {0} rows"
 ],
 [
  "시안 {0}",
  "Draft {0}"
 ],
 [
  "옵션 {0}",
  "Option {0}"
 ],
 [
  "외 {0}건",
  "+{0} more"
 ],
 [
  "{0}열",
  "{0} columns"
 ]
]
