export const DOCUMENT_DRAG_TYPE = 'application/x-devsign-document'

export function documentTarget(doc) {
  return { kind: 'document', key: `document:${doc.id}`, docId: doc.id, label: doc.title }
}

export function openWorkspaceDocument(api, doc, position = {}) {
  const id = `document:${doc.id}`
  const existing = api.getPanel(id)
  if (existing) {
    if (position.referencePanel && api.dockPanel) {
      const reference = api.getPanel(position.referencePanel)
      if (reference?.group) api.dockPanel(id, reference.group.id, position.direction === 'within' ? 'center' : position.direction)
    }
    existing.api.setActive()
    return existing
  }
  return api.addPanel({ id, component: 'document', title: doc.title, params: { docId: doc.id, iconName: 'FileText' }, position })
}

// Grounded excerpts for the local demo assistant; no unsupported facts or edits.
export function answerDocumentQuestion(doc, question) {
  if (!doc) return '선택한 문서를 찾을 수 없습니다. Docs에서 문서를 다시 선택해 주세요.'
  let heading = doc.title
  const passages = []
  for (const block of doc.blocks ?? []) {
    if (block.type === 'h2') { heading = block.text; continue }
    const text = block.type === 'table'
      ? [block.columns.join(' · '), ...block.rows.map((row) => row.join(' · '))].join('\n')
      : block.items?.join('\n') ?? block.text
    if (text) passages.push({ heading, text })
  }
  const terms = question.toLowerCase().match(/[\p{L}\p{N}_-]{2,}/gu) ?? []
  const ranked = passages.map((p, index) => ({ ...p, index, score: terms.reduce((sum, word) => sum + (p.text.toLowerCase().includes(word) || p.heading.toLowerCase().includes(word) ? 1 : 0), 0) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
  const summary = /요약|정리|summary|summarize|overview|설명/.test(question.toLowerCase())
  if (!summary && !ranked.some((p) => p.score)) return `「${doc.title}」에서 질문과 일치하는 내용을 찾지 못했습니다. 문서의 섹션명이나 용어를 포함해 질문해 주세요.\n\n${doc.summary ?? ''}\n섹션: ${[...new Set(passages.map((p) => p.heading))].join(' · ')}`
  const selected = (summary ? passages : ranked.filter((p) => p.score)).slice(0, 3)
  return `「${doc.title}」 문서에서 확인한 내용입니다.\n\n${summary && doc.summary ? `${doc.summary}\n\n` : ''}${selected.map((p) => `**${p.heading}**\n${p.text}`).join('\n\n')}\n\n출처: Docs / ${doc.title}`
}
