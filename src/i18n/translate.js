import { ko } from './ko'

const counts = { file: '파일', files: '파일', element: '요소', elements: '요소', change: '변경', changes: '변경', conflict: '변경점', conflicts: '변경점', member: '구성원', members: '구성원', project: '프로젝트', projects: '프로젝트', reviewer: '검토자', reviewers: '검토자', drift: '드리프트', drifts: '드리프트', line: '줄', lines: '줄', property: '속성', properties: '속성', checkpoint: '체크포인트', checkpoints: '체크포인트', 'review item': '검토 항목', 'review items': '검토 항목', 'code review': '코드 검토', 'design review': '디자인 검토' }
const rules = [
  [/^(\d+) design sets$/, (_, n) => `디자인 세트 ${n}개`],
  [/^Button text contrast ([\d.]+):1$/, (_, ratio) => `버튼 텍스트 대비 ${ratio}:1`],
  [/^(.+) with white text is below WCAG AA \(4\.5:1\)\.$/, (_, color) => `${core(color)} 배경과 흰색 텍스트의 대비가 WCAG AA 기준(4.5:1)보다 낮습니다.`],
  [/^(\d+) AI edits? applied$/, (_, n) => `AI 수정 ${n}개 적용됨`],
  [/^(\d+) AI notes? not applied$/, (_, n) => `AI 메모 ${n}개 미적용`],

  // People are counted, not itemized (ahead of the generic count rule).
  [/^(\d+) members?$/, (_, n) => `구성원 ${n}명`],
  [/^(\d+) docs found$/, (_, n) => `문서 ${n}개를 찾았어요.`],
  [/^(\d+) checkpoints?$/, (_, n) => `저장된 버전 ${n}개`],
  [/^Due in (\d+) days?$/, (_, n) => `${n}일 후 마감`],
  [/^In (\d+) days?$/, (_, n) => `${n}일 후`],
  [/^(\d+) days? overdue$/, (_, n) => `${n}일 지남`],
  [/^Within (\d+) days?$/, (_, n) => `${n}일 이내 마감`],
  [/^Overdue by (\d+) days?$/, (_, n) => `${n}일 기한 초과`],
  [/^(.+) goes back to this checkpoint \(\+(\d+) −(\d+) lines\)\.$/, (_, file, added, removed) => `${file}을 이 버전으로 되돌려요. ${added}줄 추가, ${removed}줄 삭제돼요.`],
  [/^Forget the (\d+) agent messages? after this checkpoint\.$/, (_, n) => `이 버전 이후에 나눈 AI 대화 ${n}개를 삭제해요.`],
  [/^(\d+) (days?|weeks?|months?) ago$/, (_, n, unit) => `${n}${unit.startsWith('day') ? '일' : unit.startsWith('week') ? '주' : '개월'} 전`],
  [/^(Today|Yesterday|Last week)(?:, (\d{1,2}):(\d{2}) (AM|PM))?$/, (_, day, h, m, ampm) => {
    const dayKo = day === 'Today' ? '오늘' : day === 'Yesterday' ? '어제' : '지난 주'
    return h ? `${dayKo} ${ampm === 'AM' ? '오전' : '오후'} ${h}:${m}` : dayKo
  }],
  // Absolute seed-history timestamps ("Mar 2, 9:14 AM").
  [/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (\d{1,2}):(\d{2}) (AM|PM)$/, (_, mon, day, h, m, ampm) => {
    const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 }
    return `${MONTHS[mon]}월 ${day}일 ${ampm === 'AM' ? '오전' : '오후'} ${h}:${m}`
  }],
  [/^(\d+) comments$/, (_, n) => `코멘트 ${n}개`],
  [/^Can’t merge (\d+)$/, (_, n) => `병합 불가 ${n}`],
  [/^(\d+) of (\d+) values decided$/, (_, n, total) => `값 ${total}개 중 ${n}개 결정`],
  [/^(.+) — only your own changes were rolled back\.$/, (_, label) => `${core(label)}에서 본인 변경만 복원했어요.`],
  [/^(.+) — everyone affected had confirmed\.$/, (_, label) => `${core(label)}에서 영향을 받는 사람이 모두 확인했어요.`],
  [/^(\d+) automated notes$/, (_, n) => `자동 피드백 ${n}개`],
  [/^(\d+) replies$/, (_, n) => `답글 ${n}개`],
  [/^Daily digest · (\d+) medium changes? needs? review$/, (_, n) => `일일 요약 · Medium 변경사항 ${n}개 검토 필요`],
  [/^Exception requested: (.+)$/, (_, title) => `예외 요청: ${core(title)}`],
  [/^Affects (.+)’s work · confirmed$/, (_, names) => `${names} 작업에 영향 · 확인됨`],
  // "Coupon close button was adjusted to 24 × 24px, which resolves it." The
  // object particle (을 / 를) follows the translated name's last syllable.
  [/^(.+) was adjusted to (\d+ × \d+px)(, which resolves it)?\.$/, (_, name, size, resolved) => {
    const subject = core(name)
    const last = subject.charCodeAt(subject.length - 1)
    const particle = last >= 0xac00 && last <= 0xd7a3 ? ((last - 0xac00) % 28 ? '을' : '를') : '을(를)'
    return `${subject}${particle} ${size}로 ${resolved ? '조정해 해결됐어요' : '조정했어요'}`
  }],
  [/^Request: (.+)$/, (_, name) => `요청: ${core(name)}`],
  [/^Requested by (.+)$/, (_, name) => `${core(name)} 님이 요청`],
  // ----- Sentences built around a name or a title -------------------------
  // Inbox events ("Alex approved the design changes on Hero CTA"), and the
  // prefixes History and the conflict list put before a title. The person,
  // the file / branch names and the title's own technical words stay as
  // they are; the wording is the same wherever it shows.
  [/^(\S+) approved the (design|code) changes(?: on (.+))?$/, (_, name, kind, target) => `${name}님이 ${target ? `${core(target)} ` : ''}${kind === 'design' ? '디자인' : '코드'} 변경을 승인했어요`],
  [/^(\S+) requested your review on (.+)$/, (_, name, title) => `${name}님이 ${core(title)} 검토를 요청했어요`],
  [/^(\S+) requested changes on (.+)$/, (_, name, title) => `${name}님이 ${core(title)}에 변경을 요청했어요`],
  [/^You approved (.+)$/, (_, title) => `내가 ${withObjectParticle(core(title))} 승인했어요`],
  [/^You requested (?:your )?review for (.+)$/, (_, title) => `내가 ${core(title)} 검토를 요청했어요`],
  [/^You requested changes on (.+)$/, (_, title) => `내가 ${core(title)}에 변경을 요청했어요`],
  [/^You merged (.+)$/, (_, title) => `내가 ${withObjectParticle(core(title))} 병합했어요`],
  [/^You updated (.+)$/, (_, title) => `내가 ${withObjectParticle(core(title))} 수정했어요`],
  [/^You commented on (.+)$/, (_, title) => `내가 ${core(title)}에 댓글을 남겼어요`],
  [/^You detected a difference in (.+)$/, (_, title) => `내가 ${core(title)}의 차이를 발견했어요`],
  [/^(\S+) requested a review for (.+)$/, (_, name, title) => `${name}님이 ${core(title)} 검토를 요청했어요`],
  [/^(\S+) requested your review for (.+)$/, (_, name, title) => `${name}님이 ${core(title)} 검토를 요청했어요`],
  [/^(\S+) detected a difference in (.+)$/, (_, name, title) => `${name}님이 ${core(title)}의 차이를 발견했어요`],
  [/^(\S+) updated (.+)$/, (_, name, title) => `${name}님이 ${withObjectParticle(core(title))} 수정했어요`],
  [/^View merged code$/, () => '병합된 코드 보기'],
  [/^(\S+) merged (.+)$/, (_, name, title) => `${name}님이 ${core(title)} 병합했어요`],
  [/^(\S+) commented on (.+)$/, (_, name, title) => `${name}님이 ${core(title)}에 댓글을 남겼어요`],
  [/^(\S+) closed the review for (.+)$/, (_, name, title) => `${name}님이 ${core(title)} 검토를 닫았어요`],
  [/^(\S+) reopened (.+)$/, (_, name, title) => `${name}님이 ${core(title)} 검토를 다시 열었어요`],
  [/^You approved$/, () => '내가 승인했어요'],
  [/^You requested a review$/, () => '내가 검토를 요청했어요'],
  [/^You requested changes$/, () => '내가 수정을 요청했어요'],
  [/^You merged$/, () => '내가 병합했어요'],
  [/^You opened a revert$/, () => '내가 병합 취소를 요청했어요'],
  [/^You canceled the merge of (.+)$/, (_, title) => `내가 ${core(title)} 병합을 취소했어요`],
  [/^You opened a revert of (.+)$/, (_, title) => `내가 ${core(title)} 병합 취소를 요청했어요`],
  [/^You updated$/, () => '내가 변경했어요'],
  [/^You commented$/, () => '내가 댓글을 남겼어요'],
  [/^You detected a difference$/, () => '내가 차이를 발견했어요'],
  [/^You closed the review$/, () => '내가 검토를 닫았어요'],
  [/^You reopened$/, () => '내가 검토를 다시 열었어요'],
  [/^Recently merged$/, () => '최근 병합'],
  [/^(.+?) approved$/, (_, names) => `${approvalSubject(names)} 승인했어요`],
  [/^(.+?) requested a review$/, (_, name) => `${name}님이 검토를 요청했어요`],
  [/^(.+?) requested changes$/, (_, name) => `${name}님이 수정을 요청했어요`],
  [/^(.+?) merged$/, (_, name) => `${name}님이 병합했어요`],
  [/^(\S+) opened a revert of (.+)$/, (_, name, title) => `${name}님이 ${core(title)} 병합 취소를 요청했어요`],
  [/^(\S+) canceled the merge of (.+)$/, (_, name, title) => `${name}님이 ${core(title)} 병합을 취소했어요`],
  [/^(.+?) opened a revert$/, (_, name) => `${name}님이 병합 취소를 요청했어요`],
  [/^(.+?) requested merge cancellation$/, (_, name) => `${name}님이 병합 취소를 요청했어요`],
  [/^(.+?) canceled the merge$/, (_, name) => `${name}님이 병합을 취소했어요`],
  [/^(.+?) updated$/, (_, name) => `${name}님이 변경했어요`],
  [/^(.+?) commented$/, (_, name) => `${name}님이 댓글을 남겼어요`],
  [/^(.+?) detected a difference$/, (_, name) => `${name}님이 차이를 발견했어요`],
  [/^(.+?) closed the review$/, (_, name) => `${name}님이 검토를 닫았어요`],
  [/^(.+?) reopened$/, (_, name) => `${name}님이 검토를 다시 열었어요`],
  [/^(.+) approved it$/, (_, names) => `${approvalSubject(names)} 승인했어요`],
  [/^(\S+) approved (.+)$/, (_, name, title) => `${name}님이 ${withObjectParticle(core(title))} 승인했어요`],
  [/^requested your review on (.+)$/, (_, title) => `${core(title)} 검토를 요청했어요`],
  [/^approved the (design|code) changes(?: on (.+))?$/, (_, kind, target) => `${target ? `${core(target)} ` : ''}${kind === 'design' ? '디자인' : '코드'} 변경을 승인했어요`],
  [/^Conflict detected: (.+)$/, (_, title) => `변경 감지: ${core(title)}`],
  [/^Restored: (.+)$/, (_, title) => `복원: ${core(title)}`],
  [/^Revert: (.+)$/, (_, title) => core(title)],
  [/^Rollback: (.+)$/, (_, title) => `이전 버전 복원: ${core(title)}`],
  [/^Cancels the merge of (.+)\.$/, (_, title) => `${core(title)} 병합을 취소하는 요청이에요.`],
  [/^The change merged on (.+) will be canceled and return to its previous value\.$/, (_, date) => `${core(date)}에 병합한 변경을 취소하고 이전 값으로 돌아가요.`],
  [/^The merged change will be canceled and return to its previous value\.$/, () => '병합한 변경을 취소하고 이전 값으로 돌아가요.'],
  [/^The tab icons look smaller than the new tab bar\. The (\d+px) touch area stays the same\.$/, (_, size) => `탭 아이콘이 새 탭 바보다 작게 보여요. 터치 영역(${size})은 그대로예요.`],
  [/^Conflict Points are where the design and code differ\. Review each one, then merge\.$/, () => '디자인 값과 코드 값이 다른 항목이에요. 하나씩 검토한 뒤 병합해요.'],
  [/^This needs your review$/, () => '검토해 주세요.'],
  [/^(.+) from (.+) to (.+)$/, (_, label, from, to) => `${core(label)} ${from}에서 ${to}로 바뀌어요`],
  [/^line (\d+)$/, (_, n) => `${n}번째 줄`],
  [/^(\d+) preview props?$/, (_, n) => `미리보기 속성 ${n}개`],
  [/^([+-]\d+) conflicts?$/, (_, n) => `변경점 ${n}개`],
  [/^(\d+) adjusted$/, (_, n) => `조정 ${n}개`],
  [/^(\d+) applied$/, (_, n) => `${n}개 적용됨`],
  [/^Daily digest · (\d+) changes? needs? review$/, (_, n) => `일일 요약 · 변경 ${n}개 검토 필요`],
  [/^Immediate review · High risk: (.+)$/, (_, title) => `즉시 검토 · High 위험도: ${title}`],
  [/^Comments · (\d+) conversations?$/, (_, n) => `코멘트 · 대화 ${n}개`],
  [/^(\d+) of (\d+) reviewed$/, (_, n, total) => `${total}개 중 ${n}개 검토 완료`],
  [/^(\d+) of (\d+) changes? not yet reviewed$/, (_, n, total) => `${total}개 중 ${n}개 미검토`],
  [/^(\d+) of (\d+) resolved$/, (_, n, total) => `${total}개 중 ${n}개 해결됨`],
  [/^(\d+) of (\d+) checks need attention$/, (_, n, total) => `${total}개 검사 중 ${n}개 확인 필요`],
  [/^(\d+) of (\d+) to resolve$/, (_, n, total) => `${total}개 중 ${n}개 해결 필요`],
  [/^(\d+) code changes?$/, (_, n) => `코드 변경 ${n}개`],
  [/^(\d+) edits?( · (\d+) files?)?$/, (_, n, _group, m) => `편집 ${n}개${m ? ` · 파일 ${m}개` : ''}`],
  [/^(\d+) controls with a touch area under 24px$/, (_, n) => `터치 영역 24px 미만 컨트롤 ${n}개`],
  [/^(.+) touch area (\d+)px$/, (_, name, n) => `${core(name)} 터치 영역 ${n}px`],
  // ("Navigation" alone reads as 탐색 elsewhere; as an icon's place it's the nav.)
  [/^(.+) icon (\d+px)$/, (_, name, size) => `${name === 'Navigation' ? '내비게이션' : core(name)} 아이콘 ${size}`],
  [/^(.+) icon (\d+px) with no larger touch area$/, (_, name, size) => `${core(name)} 아이콘 ${size} · 터치 영역 없음`],
  [/^Its (\d+)px touch area meets WCAG 2\.5\.8, so this doesn’t block the merge — the icon is just smaller than the design system’s (.+)\.$/, (_, touch, expected) => `터치 영역 ${touch}px는 WCAG 2.5.8을 충족해요. 아이콘은 디자인 값(${expected})보다 작아요.`],
  [/^Target size ≥ 24px on all (\d+) controls$/, (_, n) => `${n}개의 UI 요소 모두 터치 영역 24px 이상`],
  [/^All (\d+) design options decided$/, (_, n) => `디자인 옵션 ${n}개 모두 결정됨`],
  [/^(\d+) design options? undecided$/, (_, n) => `디자인 옵션 ${n}개 미결정`],
  [/^(\d+) values? off the token scale$/, (_, n) => `토큰 규격과 다른 값 ${n}개`],
  [/^(\d+) (files?|elements?|changes?|conflicts?|members?|projects?|reviewers?|drifts?|lines?|properties|property|checkpoints?|review items?)$/, (_, n, key) => `${counts[key]} ${n}개`],
  [/^(\d+) open$/, (_, n) => `미해결 ${n}개`],
  [/^(\d+) merged$/, (_, n) => `병합 완료 ${n}개`],
  [/^(\d+) pending$/, (_, n) => `대기 ${n}개`],
  [/^(High|Medium|Low) (risk|merge conflict)$/, (_, level, type) => `${ko[level]} ${type === 'risk' ? '위험도' : '같은 부분을 둘이 고쳤어요'}`],
  [/^Updated (.+)$/, (_, when) => `${core(when)} 수정됨`],
  [/^Waiting for (.+)$/, (_, name) => `${core(name)} 대기 중`],
  [/^Create a revert request\?$/, () => '병합을 취소할까요?'],
  [/^Assign reviewer$/, () => '검토자 지정'],
  [/^Next step · Assign a reviewer$/, () => '다음 단계 · 검토자 지정'],
  [/^Requesting a review needs at least one reviewer other than the author$/, () => '검토를 요청하려면 작성자 외 검토자가 1명 이상 필요해요'],
  [/^Find someone else$/, () => '다른 사람 찾기'],
  [/^No other project members available$/, () => '지정할 수 있는 다른 프로젝트 멤버가 없어요'],
  [/^Change reviewer$/, () => '변경'],
  [/^Add a reviewer other than the author$/, () => '작성자 외 검토자 지정'],
  [/^Required$/, () => '필요'],
  [/^(.+) will receive the review request$/, (_, name) => `${name}에게 검토를 요청해요`],
  [/^The merged change will stay in place until the inverse change is reviewed and merged\.$/, () => '되돌릴 변경을 검토하고 병합할 때까지 현재 병합 내용은 유지돼요.'],
  [/^Create revert request$/, () => '병합 취소하기'],
  [/^Resolved with the design reference$/, () => '디자인 값으로 해결됐어요'],
  [/^Resolved by keeping the current implementation$/, () => '현재 구현을 유지해 해결됐어요'],
  [/^Resolved with the (remote|local) branch \((.+)\) value$/, (_, side, branch) => `${side === 'remote' ? '원격' : '로컬'} 브랜치(${branch}) 값을 적용해 해결됐어요`],
  [/^Resolved by applying both changes$/, () => '두 변경을 모두 적용해 해결됐어요'],
  [/^Merged by (.+)$/, (_, name) => `${approvalSubject(name)} 병합했어요`],
  [/^View other choices$/, () => '다른 선택지 보기'],
  [/^Hide other choices$/, () => '다른 선택지 접기'],
  [/^Final applied value$/, () => '최종 적용 값'],
  [/^Before merge$/, () => '병합 전'],
  [/^Low risk$/, () => '위험도 낮음'],
  [/^(\d+) steps complete$/, (_, n) => `${n}단계 모두 완료`],
  [/^Approved by (.+)$/, (_, name) => `${name === 'you' ? '내가' : core(name)} 승인함`],
  [/^Changes requested by (.+)$/, (_, name) => `${core(name)} 변경 요청`],
  [/^Projects \(current: (.+)\)$/, (_, name) => `프로젝트 (현재: ${core(name)})`],
  // Was `${name} 홈` — left the captured part (e.g. "Project") untranslated
  // since it never ran back through core(), producing "Project 홈" instead
  // of "프로젝트 홈".
  [/^(.+) home$/, (_, name) => `${core(name)} 홈`],
  // Korean-mode sweep: dynamic copy that was still showing in English.
  [/^Edited (.+)$/, (_, when) => `${core(when)} 수정됨`],
  [/^(\d+) unchanged lines?$/, (_, n) => `변경 없는 ${n}줄`],
  [/^Merged with the (remote|local) branch \((.+)\) value$/, (_, which, name) => `${which === 'remote' ? '원격' : '로컬'} 브랜치(${name}) 값으로 병합`],
  [/^Sign-off from (.+)$/, (_, names) => `${names} 승인`],
  [/^Resolve (\d+) required standards?$/, (_, n) => `필수 규칙 ${n}개 해결 필요`],
  [/^Step (\d+)\/(\d+)$/, (_, a, b) => `${a}/${b} 단계`],
  [/^(\d+) lines hidden$/, (_, n) => `${n}줄 숨김`],
  [/^Waiting on (\d+) reviewers?$/, (_, n) => `검토자 ${n}명 대기`],
  [/^(\d+) reasons?$/, (_, count) => `이유 ${count}개`],
  [/^Enter a value from ([\d.]+) to ([\d.]+)(px|)$/, (_, min, max, unit) => `${min}–${max}${unit} 사이 값을 입력해 주세요`],
  [/^(\d+) required rules? broken$/, (_, count) => `필수 규칙 ${count}개 위반`],
  [/^(\d+) recommended rules? not followed$/, (_, count) => `권장 규칙 ${count}개와 다름`],
  [/^(.+) \(author\) will be notified\.$/, (_, name) => `작성자 ${core(name)}님에게 알림이 가요.`],
  [/^requested changes on (.+)$/, (_, title) => `${core(title)}에 변경을 요청했어요`],
  [/^approved (.+)$/, (_, title) => `${core(title)}을(를) 승인했어요`],
  [/^Approve (\d+) low-risk changes?$/, (_, n) => `위험도 낮음 변경 ${n}개 승인`],
  [/^Approve (\d+)$/, (_, n) => `${n}개 승인`],
  [/^Fix (\d+) checks? to merge$/, (_, n) => `검사 ${n}개를 해결해야 병합할 수 있어요`],
  [/^Merge conflict in (\d+) files?$/, (_, n) => `파일 ${n}개에 병합 충돌`],
  [/^Using (.+)$/, (_, label) => `${core(label)} 적용`],
  [/^(\d+) values? set — see Drifts to adjust\.$/, (_, n) => `값 ${n}개를 정했어요 — 드리프트 탭에서 조정할 수 있어요.`],
  [/^All (\d+) checks passed$/, (_, n) => `검사 ${n}개 모두 통과`],
  [/^(\d+) checks? still need attention — merging waits on them\.$/, (_, n) => `확인이 필요한 검사 ${n}개 — 통과해야 병합할 수 있어요.`],
  [/^(\d+) checks? failing: (.+)$/, (_, n, list) => `검사 ${n}개 실패: ${core(list)}`],
  [/^(\d+) checks?$/, (_, n) => `검사 ${n}개`],
  [/^Removed (.+) as a reviewer$/, (_, name) => `${core(name)}님을 검토자에서 뺐어요`],
  [/^Dismissed (.+)'s change request: ([\s\S]+)$/, (_, name, why) => `${core(name)}님의 변경 요청을 무효화했어요: ${why}`],
  [/^Why dismiss (.+)'s request\? \(required\)$/, (_, name) => `${core(name)}님의 요청을 무효화하는 이유 (필수)`],
  [/^Dismiss (.+)'s change request$/, (_, name) => `${core(name)}님의 변경 요청 무효화`],
  [/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d{1,2}):(\d{2}) (AM|PM)$/, (_, day, h, m, ampm) => {
    const DAYS = { Mon: '월', Tue: '화', Wed: '수', Thu: '목', Fri: '금', Sat: '토', Sun: '일' }
    return `${DAYS[day]}요일 ${ampm === 'AM' ? '오전' : '오후'} ${h}:${m}`
  }],
  [/^(\d+) more teammates?$/, (_, n) => `팀원 ${n}명 더 보기`],
  [/^(.+) profile$/, (_, name) => `${core(name)} 프로필`],
  [/^Layout: (.+)$/, (_, name) => `레이아웃: ${core(name)}`],
  [/^Only components that fit (.+)$/, (_, name) => `${core(name)}에 맞는 컴포넌트만`],
  [/^Open the review of (.+)$/, (_, name) => `${core(name)} 검토 열기`],
  [/^Jump to (.+) on the canvas$/, (_, name) => `캔버스에서 ${core(name)}(으)로 이동`],
  // A tool or action with its one-key shortcut: "Move (V)" → "이동 (V)".
  [/^(.+) \(([A-Z])\)$/, (_, name, key) => `${core(name)} (${key})`],
  [/^Notifications \((\d+) unread\)$/, (_, n) => `알림 (읽지 않음 ${n}개)`],
  [/^Inbox \((\d+) unread\)$/, (_, n) => `받은 알림 (읽지 않음 ${n}개)`],
  [/^No one matches “(.+)”$/, (_, name) => `“${name}”와 일치하는 사람이 없습니다`],
  [/^No files match “(.+)”\.$/, (_, name) => `“${name}”와 일치하는 파일이 없습니다.`],
  [/^Start merge · (\d+) files?$/, (_, n) => `병합 시작 · 파일 ${n}개`],
  // Must sit above the generic action-rename rule just below — "Remove X
  // for design review" would otherwise match THAT rule first (action
  // "Remove", name "X for design review") and never reach this one.
  [/^(.+) requested your review$/, (_, name) => `${core(name)}님이 검토를 요청했어요`],
  [/^(\d+) high-risk conflicts? needs? a look$/, (_, n) => `확인이 필요한 위험도 높음 변경점 ${n}개`],
  [/^(\d+) changes? waiting on your review$/, (_, n) => `내 검토를 기다리는 변경 ${n}개`],
  [/^(\d+) open Conflict Points?$/, (_, n) => `해결할 변경점 ${n}개`],
  [/^\+ (\d+) more$/, (_, n) => `외 ${n}개`],
  [/^Decided (\d+)\/(\d+)$/, (_, a, b) => `결정 ${a}/${b}`],
  [/^(\d+) of (\d+) decided · undecided values keep the code$/, (_, a, b) => `${b}개 중 ${a}개 결정 · 결정하지 않은 값은 코드 값을 유지해요`],
  [/^Use (.+) for all$/, (_, name) => `모두 ${core(name)} 값으로`],
  [/^(\d+) values? set — adjust them in the conflict’s Decide row\.$/, (_, n) => `값 ${n}개를 정했어요 — 변경점의 결정 항목에서 조정할 수 있어요.`],
  [/^(\d+)\/(\d+) picked$/, (_, a, b) => `${a}/${b} 선택`],
  [/^(\d+) of (\d+) elements picked — the rest keep the code\.$/, (_, a, b) => `요소 ${b}개 중 ${a}개를 골랐어요 — 나머지는 코드 값을 유지해요.`],
  [/^([A-Z]) · (.+’s draft|AI draft)$/, (_, letter, name) => `${letter} · ${core(name)}`],
  [/^Click an element in (.+) to comment on it\.$/, (_, name) => `${core(name)}에서 코멘트할 요소를 클릭하세요.`],
  [/^(.+) · needs your review$/, (_, name) => `${name} · 내 검토 필요`],
  [/^Use all of ([A-Z])$/, (_, l) => `${l} 시안 전체 사용`],
  [/^(\d+) of (\d+) decided$/, (_, a, b) => `${b}개 중 ${a}개 결정`],
  [/^from (Taylor|Alex|Jordan|AI draft)$/, (_, name) => `${core(name)}에서`],
  [/^(\d+) of (\d+) picked$/, (_, a, b) => `${b}개 중 ${a}개 고름`],
  [/^(\d+) of (\d+) picked — the rest keep the code\.$/, (_, a, b) => `${b}개 중 ${a}개를 골랐어요 — 나머지는 코드 값을 유지해요.`],
  [/^All (\d+) parts picked$/, (_, n) => `영역 ${n}개 모두 고름`],
  [/^(\d+) of (\d+) parts not picked$/, (_, a, b) => `영역 ${b}개 중 ${a}개 안 고름`],
  [/^(\d+) accent colors mixed$/, (_, n) => `강조 색 ${n}개가 섞임`],
  [/^(.+) — the parts come from drafts with different accents\.$/, (_, list) => `${list} — 강조 색이 다른 시안의 영역이 섞였어요.`],
  [/^(\$[\d.]+(?: vs \$[\d.]+)+) — (.+) show different totals\.$/, (_, amounts, parts) => `${amounts} — ${parts.split(', ').map((p) => core(p)).join(', ')}의 합계가 달라요.`],
  [/^(\d+) of (\d+) drafts$/, (_, a, b) => `시안 ${b}개 중 ${a}개`],
  [/^Comparing (\d+) drafts$/, (_, n) => `시안 ${n}개 비교 중`],
  [/^(Previous|Next) draft for (.+)$/, (_, dir, name) => `${core(name)} ${dir === 'Previous' ? '이전' : '다음'} 시안`],
  // Toasts.
  [/^Deleted (\d+) projects?$/, (_, n) => `프로젝트 ${n}개를 삭제했어요`],
  [/^Reminder sent to (.+)$/, (_, names) => `${names}에게 알림을 보냈어요`],
  [/^Waiting on (\d+) more reviewers?\.$/, (_, n) => `검토자 ${n}명의 승인을 더 기다리고 있어요.`],
  [/^Approved (\d+) as (.+)$/, (_, n, name) => `${name} 이름으로 ${n}개를 승인했어요`],
  [/^(\d+) ready to resolve$/, (_, n) => `${n}개 병합 가능`],
  [/^(\d+) still waiting on other reviewers$/, (_, n) => `${n}개는 다른 검토자를 기다리는 중`],
  [/^(\d+) files? added to the file tree$/, (_, n) => `파일 ${n}개를 파일 트리에 추가했어요`],
  [/^(.+) added to Assets$/, (_, what) => `${core(what)}을(를) 에셋에 추가했어요`],
  [/^(.+) imported$/, (_, what) => `${core(what)}을(를) 가져왔어요`],
  [/^Manage access for (.+)$/, (_, name) => `${name}의 접근 권한 관리`],
  [/^Why dismiss (.+)'s request\? \(required\)$/, (_, name) => `${name}님의 요청을 해제하는 이유 (필수)`],
  [/^Pin comment to (.+)$/, (_, name) => `${core(name)}에 코멘트 고정`],
  [/^(\d+) designs selected for comparison\.$/, (_, n) => `시안 ${n}개를 비교해요.`],
  [/^(\d+) selected$/, (_, n) => `${n}개 선택됨`],
  [/^· (\d+) designs?$/, (_, n) => `· 시안 ${n}개`],
  [/^(\d+) designs?$/, (_, n) => `시안 ${n}개`],
  [/^Align (top|middle|bottom) (left|center|right)$/, (_, v, h) => `${{ top: '위', middle: '가운데', bottom: '아래' }[v]} ${{ left: '왼쪽', center: '가운데', right: '오른쪽' }[h]} 정렬`],
  [/^Dismiss (Neo Glow|Gradient Pill|Soft Card)$/, (_, name) => `${name} 닫기`],
  [/^(Assign|Remove) (.+) for (code|design) review$/, (_, action, name, scope) => `${core(name)} ${core(scope)} 검토 ${action === 'Assign' ? '추가' : '제외'}`],
  [/^(Close|Select|Restore|Remove|Open|Resize) (.+)$/, (_, action, name) => `${core(name)} ${ko[action] ?? action}`],
  [/^(.+) · Drag to reorder or move$/, (_, name) => `${core(name)} · 드래그하여 순서 변경 또는 이동`],
  [/^(.+) · Drag to split or move$/, (_, name) => `${core(name)} · 드래그하여 분할 또는 이동`],
  [/^(.+) · Double-click to rename$/, (_, path) => `${path} · 두 번 클릭하여 이름 변경`],
  [/^Step (\d+) of (\d+)(.*)$/, (_, n, total, suffix) => `${total}단계 중 ${n}단계${core(suffix)}`],
  [/^(\d+)m ago$/, (_, n) => `${n}분 전`],
  [/^(\d+) left$/, (_, n) => `${n}명 남음`],
  [/^(\d+) differences$/, (_, n) => `차이 ${n}건`],
  [/^(\d+)h ago$/, (_, n) => `${n}시간 전`],
  [/^(\d+) hours? ago$/, (_, n) => `${n}시간 전`],
  [/^(\d+)d ago$/, (_, n) => `${n}일 전`],
  [/^I couldn’t turn that into a specific change in (.+)\. Nothing was changed\.$/, (_, where) => `${core(where)}에서 구체적인 변경으로 바꾸지 못했습니다. 아무것도 변경되지 않았습니다.`],
  [/^This needs review because (.+)$/, (_, why) => `검토가 필요한 이유: ${core(why)}`],
  // Conflict/History review sweep — dynamic strings a static ko.js entry
  // can't cover (a name, a count, or a joined list inside otherwise-fixed
  // copy). Specific patterns sit above the generic "Review X" catch-all
  // below so e.g. "Review requested from …" / "Review status: …" don't
  // fall into it first.
  [/^(Before|After) code$/, (_, w) => `${ko[w]} 코드`],
  [/^Review status: (.+), step (\d+) of (\d+)$/, (_, label, n, m) => `검토 상태: ${core(label)}, ${m}단계 중 ${n}단계`],
  [/^Review progress: (.+); current step (\d+) of (\d+)$/, (_, labels, n, m) => `검토 진행 상태: ${labels.split(' → ').map(core).join(' → ')}; ${m}단계 중 ${n}단계`],
  [/^Review requested from (.+)$/, (_, names) => `${names.split(', ').map(core).join(', ')}에게 검토 요청`],
  [/^Remind (.+)$/, (_, name) => `${core(name)}에게 알림`],
  [/^Reminded (.+)$/, (_, when) => `${core(when)}에 알림 보냄`],
  [/^Reply to (.+)$/, (_, name) => `${core(name)}에게 답글`],
  [/^(.+) — saved as a new checkpoint$/, (_, label) => `${core(label)} — 새 체크포인트로 저장됨`],
  [/^(\d+) checks need attention$/, (_, n) => `확인 필요한 검사 ${n}개`],
  [/^(\d+) controls? under 24px$/, (_, n) => `24px 미만 컨트롤 ${n}개`],
  [/^(\d+) AI edits? applied$/, (_, n) => `적용된 AI 편집 ${n}개`],
  [/^(\d+) AI notes? not applied$/, (_, n) => `적용되지 않은 AI 메모 ${n}개`],
  [/^Button text contrast (.+):1$/, (_, ratio) => `버튼 텍스트 대비 ${ratio}:1`],
  [/^(.+) with white text is below WCAG AA \(4\.5:1\)\.$/, (_, color) => `${core(color)}에 흰색 텍스트를 사용하면 WCAG AA 기준(4.5:1)에 못 미칩니다.`],
  [/^Review (.+)$/, (_, name) => `${core(name)} 검토`],
]

// A word with its object particle: 을 after a final consonant, 를 after a
// vowel, both when the last character isn't Hangul.
function withObjectParticle(word) {
  const last = word.charCodeAt(word.length - 1)
  return `${word}${last >= 0xac00 && last <= 0xd7a3 ? ((last - 0xac00) % 28 ? '을' : '를') : '을'}`
}

function approvalSubject(names) {
  const people = names.split(', ')
  if (people.length === 1) return `${people[0]}님이`
  return `${people.slice(0, -1).map((name) => `${name}님`).join(', ')}과 ${people.at(-1)}님이`
}

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
