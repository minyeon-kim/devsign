// A diff cut down to what changed: each run of changed lines with a little
// of the code around it (a hunk), the unchanged stretches between folded
// into one row that says how many lines it hides.
//
// `rows`: lib/lineDiff's diffLines. The rows returned carry their line
// numbers (`from` in the old file, `to` in the new), so a hunk keeps its
// real numbers; a fold is `{ kind: 'fold', count }`.

// Old / new line numbers on every row.
export function numberRows(rows) {
  let from = 0
  let to = 0
  return rows.map((row) => ({ ...row, from: row.kind === 'add' ? null : ++from, to: row.kind === 'remove' ? null : ++to }))
}

// `context`: unchanged lines kept on each side of a change. A stretch too
// short to be worth hiding (fewer than `minFold` lines) stays as it is.
export function foldRows(rows, { context = 2, minFold = 3 } = {}) {
  const numbered = rows.every((row) => row.from !== undefined || row.to !== undefined) ? rows : numberRows(rows)
  const keep = new Array(numbered.length).fill(false)
  numbered.forEach((row, index) => {
    if (row.kind === 'same') return
    for (let i = Math.max(0, index - context); i <= Math.min(numbered.length - 1, index + context); i += 1) keep[i] = true
  })
  const out = []
  for (let i = 0; i < numbered.length;) {
    if (keep[i]) { out.push(numbered[i]); i += 1; continue }
    let end = i
    while (end < numbered.length && !keep[end]) end += 1
    if (end - i < minFold) out.push(...numbered.slice(i, end))
    else out.push({ kind: 'fold', count: end - i })
    i = end
  }
  return out
}

// How many lines a diff changes: a line replaced counts once (its removal
// and its addition are one change), a line only added or only removed once.
export function changedLineCount(rows) {
  let count = 0
  for (let i = 0; i < rows.length;) {
    if (rows[i].kind === 'same' || rows[i].kind === 'fold') { i += 1; continue }
    let removed = 0
    let added = 0
    while (i < rows.length && rows[i].kind === 'remove') { removed += 1; i += 1 }
    while (i < rows.length && rows[i].kind === 'add') { added += 1; i += 1 }
    count += Math.max(removed, added)
  }
  return count
}
