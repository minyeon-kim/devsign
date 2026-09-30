import { ko } from './ko'

const counts = { file: '파일', files: '파일', element: '요소', elements: '요소', change: '변경', changes: '변경', conflict: '충돌', conflicts: '충돌', member: '구성원', members: '구성원', project: '프로젝트', projects: '프로젝트', reviewer: '검토자', reviewers: '검토자', drift: '차이', drifts: '차이', line: '줄', lines: '줄', property: '속성', properties: '속성', checkpoint: '체크포인트', checkpoints: '체크포인트', 'review item': '검토 항목', 'review items': '검토 항목', 'code review': '코드 검토', 'design review': '디자인 검토' }
const rules = [
  [/^(\d+) docs found$/, (_, n) => `문서 ${n}개를 찾았어요.`],
  [/^(\d+) checkpoints?$/, (_, n) => `저장된 버전 ${n}개`],
  [/^(.+) goes back to this checkpoint \(\+(\d+) −(\d+) lines\)\.$/, (_, file, added, removed) => `${file}을 이 버전으로 되돌려요. ${added}줄 추가, ${removed}줄 삭제돼요.`],
  [/^Forget the (\d+) agent messages? after this checkpoint\.$/, (_, n) => `이 버전 이후에 나눈 AI 대화 ${n}개를 삭제해요.`],
  [/^(\d+) (days?|weeks?|months?) ago$/, (_, n, unit) => `${n}${unit.startsWith('day') ? '일' : unit.startsWith('week') ? '주' : '개월'} 전`],
  [/^(\d+) comments$/, (_, n) => `코멘트 ${n}개`],
  [/^(\d+) automated notes$/, (_, n) => `자동 피드백 ${n}개`],
  [/^(\d+) replies$/, (_, n) => `답글 ${n}개`],
  [/^Daily digest · (\d+) medium changes? needs? review$/, (_, n) => `일일 요약 · Medium 변경사항 ${n}개 검토 필요`],
  [/^Immediate review · High risk: (.+)$/, (_, title) => `즉시 검토 · High 위험도: ${title}`],
  [/^Comments · (\d+) conversations?$/, (_, n) => `코멘트 · 대화 ${n}개`],
  [/^(\d+) of (\d+) reviewed$/, (_, n, total) => `${total}개 중 ${n}개 검토 완료`],
  [/^(\d+) of (\d+) changes? not yet reviewed$/, (_, n, total) => `${total}개 중 ${n}개 미검토`],
  [/^(\d+) of (\d+) resolved$/, (_, n, total) => `${total}개 중 ${n}개 해결됨`],
  [/^(\d+) of (\d+) checks need attention$/, (_, n, total) => `${total}개 검사 중 ${n}개 확인 필요`],
  [/^All (\d+) design options decided$/, (_, n) => `디자인 옵션 ${n}개 모두 결정됨`],
  [/^(\d+) design options? undecided$/, (_, n) => `디자인 옵션 ${n}개 미결정`],
  [/^(\d+) values? off the token scale$/, (_, n) => `토큰 규격과 다른 값 ${n}개`],
  [/^(\d+) (files?|elements?|changes?|conflicts?|members?|projects?|reviewers?|drifts?|lines?|properties|property|checkpoints?|review items?)$/, (_, n, key) => `${counts[key]} ${n}개`],
  [/^(\d+) open$/, (_, n) => `미해결 ${n}개`],
  [/^(\d+) merged$/, (_, n) => `병합 완료 ${n}개`],
  [/^(\d+) pending$/, (_, n) => `대기 ${n}개`],
  [/^(High|Medium|Low) (risk|merge conflict)$/, (_, level, type) => `${ko[level]} ${type === 'risk' ? '위험도' : '병합 충돌'}`],
  [/^Waiting for (.+)$/, (_, name) => `${name} 대기 중`],
  [/^Approved by (.+)$/, (_, name) => `${name === 'you' ? '내가' : name} 승인함`],
  [/^Changes requested by (.+)$/, (_, name) => `${name} 변경 요청`],
  [/^Projects \(current: (.+)\)$/, (_, name) => `프로젝트 (현재: ${name})`],
  [/^(.+) home$/, (_, name) => `${name} 홈`],
  [/^Notifications \((\d+) unread\)$/, (_, n) => `알림 (읽지 않음 ${n}개)`],
  [/^Inbox \((\d+) unread\)$/, (_, n) => `받은 알림 (읽지 않음 ${n}개)`],
  [/^No one matches “(.+)”$/, (_, name) => `“${name}”와 일치하는 사람이 없습니다`],
  [/^(Close|Select|Restore|Remove|Open|Resize) (.+)$/, (_, action, name) => `${core(name)} ${ko[action] ?? action}`],
  [/^(.+) · Drag to reorder or move$/, (_, name) => `${core(name)} · 드래그하여 순서 변경 또는 이동`],
  [/^(.+) · Drag to split or move$/, (_, name) => `${core(name)} · 드래그하여 분할 또는 이동`],
  [/^(.+) · Double-click to rename$/, (_, path) => `${path} · 두 번 클릭하여 이름 변경`],
  [/^Step (\d+) of (\d+)(.*)$/, (_, n, total, suffix) => `${total}단계 중 ${n}단계${core(suffix)}`],
  [/^(\d+)m ago$/, (_, n) => `${n}분 전`],
  [/^(\d+)h ago$/, (_, n) => `${n}시간 전`],
  [/^(\d+)d ago$/, (_, n) => `${n}일 전`],
  [/^I couldn’t turn that into a specific change in (.+)\. Nothing was changed\.$/, (_, where) => `${core(where)}에서 구체적인 변경으로 바꾸지 못했습니다. 아무것도 변경되지 않았습니다.`],
]

function core(text) {
  if (Object.hasOwn(ko, text)) return ko[text]
  for (const [pattern, format] of rules) if (pattern.test(text)) return text.replace(pattern, format)
  // Composite badges keep names, paths and numbers in their original positions.
  if (text.includes(' · ')) return text.split(' · ').map(core).join(' · ')
  return text
}

export function translateText(text, language = 'en') {
  if (language !== 'ko' || typeof text !== 'string' || !text.trim()) return text
  const normalized = text.trim().replace(/\s+/g, ' ')
  const translated = core(normalized)
  if (translated === normalized) return text
  return `${text.match(/^\s*/)[0]}${translated}${text.match(/\s*$/)[0]}`
}

export function hasTranslation(text) {
  return typeof text === 'string' && translateText(text, 'ko') !== text
}
