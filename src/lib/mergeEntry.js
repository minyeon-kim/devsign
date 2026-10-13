// What the Merge Studio entry menu (and the studio's own empty state) can
// offer, read from what's there — never from a guess:
//   · `saved`  — the project's saved merge work (the Merge List's items): how
//     many, and when the newest was touched (the list keeps newest first);
//     null when there is none;
//   · `start`  — what "Start New with Current Work" would start with: the
//     files it snapshots (the same ones `startMergeFromOpenFiles` takes);
//     null when there are none;
//   · `primary` — the one thing to do now: the saved work when there is some,
//     else starting a new one, else nothing.
export function mergeEntryState({ mergeItems = [], openFiles = [] } = {}) {
  const saved = mergeItems.length ? { count: mergeItems.length, updatedLabel: mergeItems[0].updatedLabel ?? null } : null
  const start = openFiles.length ? { count: openFiles.length, names: openFiles.map((file) => file.name) } : null
  return { saved, start, primary: saved ? 'saved' : start ? 'start' : null }
}
