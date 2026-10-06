import { LocalizedText } from '@/i18n/runtime'

const GUIDANCE = {
  tokens: ['디자인 토큰·규격 사용 여부', '화면 간 형태 불일치 · 테마 변경 미반영 가능', '디자인 기준 카드 선택 · 나머지 값은 병합 스튜디오에서 수정'],
  targets: ['터치 영역 크기', '작은 터치 영역으로 인한 오입력 가능', '병합 스튜디오에서 터치 영역 가로·세로 24px 이상 확보', '가로·세로 24px 이상'],
  contrast: ['버튼 글자·배경의 명도 대비', '낮은 명도 대비로 인한 가독성 저하', '글자색·배경색 조정으로 명도 대비 확보', '대비 4.5:1 이상'],
  text: ['최소 글자 크기 충족 여부', '작은 글자 크기로 인한 가독성 저하', '글자 크기 12px 이상 적용', '12px 이상'],
  'icon-size': ['아이콘 크기의 디자인 기준 일치 여부', '아이콘 크기 차이로 인한 시각적 일관성 저하', '디자인 기준의 아이콘 크기 적용'],
  markers: ['미해결 코드 충돌 표시 유무', '남은 충돌 표시로 인한 실행 오류 가능', '사용할 코드 버전 선택 · 충돌 표시 제거', '충돌 표시 없음'],
  decided: ['속성별 적용 버전 선택 여부', '미선택 속성의 현재 구현 값 유지', '비교 카드에서 적용 버전 선택', '모든 속성 선택 완료'],
  picked: ['화면 영역별 적용 시안 선택 여부', '미선택 영역의 현재 화면 유지', '시안 비교에서 영역별 적용 시안 선택', '모든 영역 선택 완료'],
  ai: ['AI 수정 제안 적용 여부', '미적용 제안의 병합 결과 제외', '캔버스의 AI로 적용 버튼으로 제안 반영', '미적용 제안 없음'],
  accents: ['화면 영역별 강조색 일치 여부', '강조색 혼용으로 인한 주요 동작 구분 어려움', '관련 영역을 동일 강조색의 시안으로 통일', '하나의 강조색'],
  'summary-missing': ['결제 화면의 주문 요약 유무', '주문 요약 누락으로 인한 결제 내역 확인 어려움', '주문 요약이 포함된 시안 선택', '주문 요약 표시'],
}

// Why a failing check matters and how to resolve it, as concise summary values.
export function checkGuidance(check) {
  if (!check) return null
  const [, impact, fix] = GUIDANCE[check.id] ?? [null, '디자인 기준과 다른 결과 반영 가능', '해당 디자인 기준 확인 · 값 수정']
  return { impact, fix }
}

export function CheckExplanation({ check }) {
  const [subject, impact, fix, expected] = GUIDANCE[check.id] ?? ['디자인 기준 충족 여부', '디자인 기준과 다른 결과 반영 가능', '해당 디자인 기준 확인 · 값 수정']
  return <li className="space-y-1.5 py-2 first:pt-0 last:pb-0">
    <p>{subject}</p>
    {check.details?.length ? check.details.map((detail) => <div key={detail.key} className="space-y-1">
      <p className="text-slate-400"><LocalizedText text={detail.element} /> · <LocalizedText text={detail.property} /></p>
      <p><span className="text-slate-400">현재 </span><LocalizedText text={String(detail.current)} /> · <span className="text-slate-400">기준 </span><LocalizedText text={String(detail.expected)} /></p>
    </div>) : <p><span className="text-slate-400">현재 </span><LocalizedText text={check.currentValue ?? check.title} /><br /><span className="text-slate-400">기준 </span><LocalizedText text={check.expectedValue ?? expected ?? '디자인 기준과 일치'} /></p>}
    <p className="text-slate-400">{impact}</p>
    <p>{fix}</p>
  </li>
}
