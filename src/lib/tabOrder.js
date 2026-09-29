export function moveTab(ids, source, target, after = false) {
  if (source === target || !ids.includes(source) || !ids.includes(target)) return ids
  const next = ids.filter((id) => id !== source)
  next.splice(next.indexOf(target) + Number(after), 0, source)
  return next.every((id, i) => id === ids[i]) ? ids : next
}

export function orderedTabs(items, order = []) {
  const byId = new Map(items.map((item) => [item.key, item]))
  return [...order.filter((id) => byId.has(id)).map((id) => byId.get(id)), ...items.filter((item) => !order.includes(item.key))]
}
