import { translateText } from './translate'

// Toasts describe completed actions; compact status labels elsewhere stay unchanged.
const KO = {
  'Review requested': '검토 요청을 보냈어요',
  'Approved by you': '변경 내용을 승인했어요',
  'All approvals received': '검토자 모두가 승인했어요',
  'Change merged': '변경 내용을 병합했어요',
  'Code updated': '코드를 수정했어요',
  'Exception requested': '예외 검토를 요청했어요',
  'Applying as is': '현재 값 그대로 반영하기로 했어요',
  'Rolled back': '이전 버전을 복원했어요',
  "Can't merge yet": '아직 병합할 수 없어요',
  'Checkpoint archived': '체크포인트를 보관했어요',
  'Checkpoint restored to History': '체크포인트를 히스토리에 복원했어요',
  'Rollback sent for agreement': '이전 버전 복원 요청을 보냈어요',
  'Rollback shared with the team': '이전 버전을 팀과 공유했어요',
  'Project created': '프로젝트를 만들었어요',
  'Team created': '팀을 만들었어요',
  'Member added': '팀원을 추가했어요',
  'Member updated': '팀원 정보를 수정했어요',
  'Member deleted': '팀원을 삭제했어요',
  'Member archived': '팀원 정보를 보관했어요',
  'Exported CSV': 'CSV 파일로 내보냈어요',
  'Figma file linked': 'Figma 파일을 연결했어요',
  'Imported': '가져오기를 완료했어요',
  'Signed out': '로그아웃했어요',
  'Changes could not be saved': '변경 내용을 저장하지 못했어요',
  'Couldn’t open the file': '파일을 열지 못했어요',
}

export function translateToast(text, language) {
  if (language !== 'ko' || typeof text !== 'string') return text
  const request = /^Review requested from (.+)$/.exec(text)
  if (request) return `${request[1]}에게 검토 요청을 보냈어요`
  const reminder = /^Reminder sent to (.+)$/.exec(text)
  if (reminder) return `${reminder[1]}에게 검토 알림을 다시 보냈어요`
  return KO[text] ?? translateText(text, language)
}
