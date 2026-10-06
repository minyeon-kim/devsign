import { LocalizedText } from '@/i18n/runtime'

const GUIDANCE = {
  tokens: ['디자인 토큰과 규격을 사용하는지 검사했어요.', '공통 규격을 벗어나면 화면 간 모양이 달라지고 테마 변경이 반영되지 않을 수 있어요.', '디자인 기준 카드를 선택하세요. 남은 항목은 병합 스튜디오에서 기준 값으로 수정하세요.'],
  targets: ['누를 수 있는 영역의 크기를 검사했어요.', '영역이 너무 작으면 원하는 버튼을 누르기 어려워요.', '병합 스튜디오에서 터치 영역의 가로와 세로를 모두 24px 이상으로 늘리세요.', '가로·세로 24px 이상'],
  contrast: ['버튼 글자와 배경의 명도 대비를 검사했어요.', '대비가 낮으면 버튼 글자를 읽기 어려워요.', '글자나 배경색을 조정해 대비를 높이세요.', '대비 4.5:1 이상'],
  text: ['글자 크기가 화면의 최소 기준을 충족하는지 검사했어요.', '글자가 너무 작으면 내용을 읽기 어려워요.', '글자 크기를 12px 이상으로 수정하세요.', '12px 이상'],
  'icon-size': ['아이콘 크기가 디자인 기준과 같은지 검사했어요.', '아이콘 크기가 다르면 화면의 시각적 일관성이 떨어져요.', '디자인 기준의 아이콘 크기로 맞추세요.'],
  markers: ['코드에 해결되지 않은 충돌 표시가 있는지 검사했어요.', '충돌 표시가 남아 있으면 코드가 정상 실행되지 않을 수 있어요.', '충돌한 코드에서 사용할 버전을 선택하고 충돌 표시를 제거하세요.', '충돌 표시 없음'],
  decided: ['각 속성에 적용할 버전을 선택했는지 검사했어요.', '선택하지 않은 속성은 현재 구현 값으로 반영돼요.', '비교 카드에서 적용할 버전을 선택하세요.', '모든 속성 선택 완료'],
  picked: ['각 화면 영역에 적용할 시안을 선택했는지 검사했어요.', '선택하지 않은 영역은 현재 화면을 유지해요.', '시안 비교에서 각 영역에 적용할 시안을 선택하세요.', '모든 영역 선택 완료'],
  ai: ['AI 수정 제안이 적용됐는지 검사했어요.', '적용하지 않은 제안은 병합 결과에 포함되지 않아요.', '캔버스에서 AI로 적용을 눌러 제안을 반영하세요.', '미적용 제안 없음'],
  amounts: ['화면에 표시된 주문 금액이 서로 같은지 검사했어요.', '서로 다른 금액은 결제할 금액을 혼동하게 해요.', '금액이 표시된 영역을 같은 시안으로 맞추세요.', '모든 영역의 주문 금액 일치'],
  accents: ['화면 영역의 강조색이 같은지 검사했어요.', '강조색이 섞이면 주요 동작을 구분하기 어려워요.', '관련 영역을 같은 강조색의 시안으로 맞추세요.', '하나의 강조색'],
  'summary-missing': ['결제 화면에 주문 요약이 있는지 검사했어요.', '주문 요약이 없으면 무엇을 결제하는지 확인하기 어려워요.', '주문 요약이 있는 시안을 선택하세요.', '주문 요약 표시'],
}

export function CheckExplanation({ check }) {
  const [subject, impact, fix, expected] = GUIDANCE[check.id] ?? ['디자인 기준을 충족하는지 검사했어요.', '기준과 다른 결과가 화면에 반영될 수 있어요.', '해당 항목의 디자인 기준을 확인하고 값을 수정하세요.']
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
