import { docsHistoryKo } from './docsHistoryKo'

// UI copy only. Project names, source code and authored content are not catalog keys.
// Exception: the three team members' names below (Jane/James/Min are
// Korean-mode display names, not literal translations, and JA/JD/MI are
// their avatar initials) — every other exact match in this catalog is real
// UI copy.
export const ko = Object.fromEntries(`
Follow|화면 따라가기
Stop following|따라가기 중지
Let’s review the Place order button together. Compare its height and color with the checkout design, adjust the style, then request a review.|주문 버튼을 디자인에 맞게 다듬어볼까요? Place order 버튼의 높이와 색상을 비교하고, 스타일을 수정한 뒤 검토를 요청할 수 있어요. 아래 질문을 선택하면 순서대로 안내해드릴게요.
Let’s check the shared Button height. Compare the code with the design token, review the affected screens, then check the saved version after merging.|공통 버튼의 높이가 디자인 시스템 기준과 맞는지 확인해볼까요? Button 코드를 높이 토큰에 맞게 수정하고, 다른 화면에 미치는 영향도 살펴보세요. 검토와 병합을 마친 뒤에는 저장된 버전까지 확인할 수 있어요.
Jane|김수연
James|이지훈
Min|한소민
JA|수
JD|지
MI|소
All members|전체 구성원
Designer UT · Checkout|디자이너 UT · 결제 화면
Designer UT: inspect the Place order button, compare design and code, adjust its style, and request a review.|디자이너 UT: Place order 버튼을 확인하고, 디자인과 코드를 비교하고, 스타일을 조정한 뒤 검토를 요청하세요.
Developer UT · Design System|개발자 UT · 디자인 시스템
Developer UT: inspect token drift, compare code, resolve changes, request review, and inspect the saved checkpoint.|개발자 UT: 토큰 차이를 확인하고, 코드를 비교하고, 변경 사항을 해결한 뒤 검토를 요청하고 저장된 체크포인트를 확인하세요.
Issue summary|이슈 요약
Review impact|검토 필요 이유
Background|배경
Proposal|제안
Why|이유
Expected result|예상 결과
Devsign design ↔ code sync|Devsign 디자인 ↔ 코드 동기화
The Place order button is 40px tall with a fixed violet background (#7c3aed). The Checkout design uses the 44px large button and the primary color token.|Place order 버튼이 고정된 violet 배경(#7c3aed)으로 40px 높이입니다. 결제 화면 디자인은 44px의 large 버튼과 primary 색상 토큰을 사용합니다.
a visible size and color change on the checkout’s main call to action. Styling only — no payment logic or data changes.|결제 화면의 핵심 CTA에 눈에 띄는 크기·색상 변경입니다. 스타일만 변경되며 결제 로직이나 데이터는 바뀌지 않습니다.
Implemented the button in PlaceOrderButton.jsx|PlaceOrderButton.jsx에 버튼을 구현함
Use the lg button size and remove the fixed background so the button uses the primary color token.|lg 버튼 크기를 사용하고 고정 배경을 제거해 버튼이 primary 색상 토큰을 사용하도록 하세요.
The Checkout design specifies the large primary button; the hard-coded hex bypasses the theme.|결제 화면 디자인은 large 크기의 primary 버튼을 지정합니다. 하드코딩된 hex 값은 테마를 우회합니다.
Place order renders 44px tall in the primary color on the payment step.|결제 단계에서 Place order가 44px 높이, primary 색상으로 렌더링됩니다.
Button height in code (36px) drifts from the design system token (40px).|코드의 Button 높이(36px)가 디자인 시스템 토큰(40px)과 다릅니다.
the shared Button component — a height change reaches every screen that uses it.|공유 Button 컴포넌트입니다 — 높이 변경이 이를 사용하는 모든 화면에 영향을 미칩니다.
Pushed new changes to Button.jsx|Button.jsx에 새 변경사항을 푸시함
Swap the hard-coded h-9 for the size token so the button follows the design system height.|하드코딩된 h-9를 size 토큰으로 교체해 버튼이 디자인 시스템 높이를 따르도록 하세요.
The design system defines size/md as --button-height-md (40px); h-9 hard-codes 36px and bypasses the token.|디자인 시스템은 size/md를 --button-height-md(40px)로 정의합니다. h-9는 36px로 하드코딩되어 토큰을 우회합니다.
Every Button renders 40px tall from --button-height-md.|모든 Button이 --button-height-md로 40px 높이로 렌더링됩니다.
a merge conflict — both branches edited the same lines, so one side’s change could be lost.|머지 충돌입니다 — 두 브랜치가 같은 줄을 수정해 한쪽의 변경 사항이 사라질 수 있습니다.
Merge conflict between local and remote branch (lines 9-14).|로컬 브랜치와 원격 브랜치 사이에 머지 충돌이 있습니다 (9-14행).
Both branches edited the frame-mapping block. Keep the remote's key prop change and reapply the local onSelect handler on top of it.|두 브랜치 모두 frame-mapping 블록을 수정했습니다. 원격의 key prop 변경을 유지하고 그 위에 로컬의 onSelect 핸들러를 다시 적용하세요.
a corner radius on the Card container; no layout or behavior change.|Card 컨테이너의 모서리 반경입니다. 레이아웃이나 동작 변경은 없습니다.
Card corner radius (8px) is smaller than the design system radius (12px).|Card 모서리 반경(8px)이 디자인 시스템 반경(12px)보다 작습니다.
Use the radius-lg token on the card container instead of rounded-lg.|카드 컨테이너에 rounded-lg 대신 radius-lg 토큰을 사용하세요.
the tab bar icons appear on every mobile screen.|탭 바 아이콘은 모든 모바일 화면에 나타납니다.
Nav icons render at 20px in code but 24px in the redesigned nav frame.|내비게이션 아이콘이 코드에서는 20px이지만 재설계된 내비게이션 프레임에서는 24px입니다.
Bump the nav icon size to 24px and keep the 44px hit area.|내비게이션 아이콘 크기를 24px로 키우고 44px 탭 영역은 유지하세요.
one color token value; components keep reading the same token.|색상 토큰 값 하나입니다. 컴포넌트는 계속 같은 토큰을 참조합니다.
Primary color in code (#5B5BD6) drifted from the brand token (#5E6AD2).|코드의 primary 색상(#5B5BD6)이 브랜드 토큰(#5E6AD2)과 어긋났습니다.
Point --primary at the brand token instead of the hard-coded hex.|--primary가 하드코딩된 hex 대신 브랜드 토큰을 가리키도록 하세요.
2px of horizontal padding inside the Input component.|Input 컴포넌트 내부의 좌우 패딩 2px 차이입니다.
Input horizontal padding (10px) differs from the design system (12px).|Input의 좌우 패딩(10px)이 디자인 시스템(12px)과 다릅니다.
Use px-3 on the input so it matches the 12px design padding.|input에 px-3을 사용해 12px 디자인 패딩에 맞추세요.
form spacing on the checkout — visible, but no behavior change.|결제 화면 폼 간격입니다 — 눈에는 보이지만 동작 변경은 없습니다.
Checkout spacing uses a 6px step that is not on the 4/8 spacing scale.|결제 화면 간격이 4/8 간격 스케일에 없는 6px 단위를 사용합니다.
Replace gap-1.5 with gap-2 so the form sits on the 8px scale.|gap-1.5를 gap-2로 교체해 폼이 8px 스케일에 맞도록 하세요.
a divider color on the order summary; no layout or behavior change.|주문 요약의 구분선 색상입니다. 레이아웃이나 동작 변경은 없습니다.
The order summary divider uses slate-200 instead of the border token.|주문 요약 구분선이 border 토큰 대신 slate-200을 사용합니다.
Use border-border on the divider so it follows the theme.|구분선에 border-border를 사용해 테마를 따르도록 하세요.
letter spacing on payment field labels; no layout or behavior change.|결제 입력란 라벨의 자간입니다. 레이아웃이나 동작 변경은 없습니다.
Field labels use tracking-wide; the design system label style has normal tracking.|입력란 라벨이 tracking-wide를 사용합니다. 디자인 시스템 라벨 스타일은 normal 자간입니다.
Drop tracking-wide from the field labels.|입력란 라벨에서 tracking-wide를 제거하세요.
icon stroke weight on the shipping options; no layout or behavior change.|배송 옵션 아이콘의 선 굵기입니다. 레이아웃이나 동작 변경은 없습니다.
Shipping option icons render at stroke 2.5; the icon set is drawn at 2.|배송 옵션 아이콘이 선 굵기 2.5로 렌더링됩니다. 아이콘 세트는 2로 그려져 있습니다.
Use the default stroke width on the shipping icons.|배송 아이콘에 기본 선 굵기를 사용하세요.
Icon size|아이콘 크기
Hit area|탭 영역
Primary|기본색상
Field gap|필드 간격
Divider|구분선
Tracking|자간
Reviewing|검토 중
Viewing|보는 중
Commenting|댓글 작성 중
Online|온라인
Reviewing design tokens|디자인 토큰 검토 중
Looking over the latest screens|최신 화면 확인 중
Reviewing the Continue button spacing|Continue 버튼 여백 검토 중
Tweaking the accent color token|강조 색상 토큰 조정 중
Inspecting the hero card layout|히어로 카드 레이아웃 확인 중
Checking the design tokens|디자인 토큰 확인 중
Reading the card title copy|카드 제목 문구 검토 중
Looking at the mobile frame|모바일 프레임 확인 중
Editing Place order button in Checkout|결제 화면에서 Place order 버튼 편집 중
Editing button sizes in tokens.json|tokens.json에서 버튼 크기 편집 중
Reviewing Order summary in Checkout|결제 화면에서 Order summary 검토 중
Reviewing color tokens in tokens.json|tokens.json에서 색상 토큰 검토 중
Editing Order summary card in Checkout|결제 화면에서 Order summary 카드 편집 중
Viewing the Checkout payment screen|결제 화면 보는 중
Editing md size in Button.jsx|Button.jsx에서 md 크기 편집 중
Checking --button-height-md in tokens.css|tokens.css에서 --button-height-md 확인 중
Reviewing size tokens in tokens.css|tokens.css에서 size 토큰 검토 중
Viewing compact Button|Small 버튼 보는 중
Reviewing the Button height conflict|Button 높이 충돌 검토 중
Commenting on --button-height-md in tokens.css|tokens.css의 --button-height-md에 댓글 작성 중
Checkout Redesign|결제 화면 리디자인
Design System v2|디자인 시스템 v2
Marketing Site Refresh|마케팅 사이트 리뉴얼
Mobile Nav Revamp|모바일 내비게이션 개편
Onboarding Flow|온보딩 플로우
size="lg" and the primary token replace the fixed violet hex|size="lg"와 primary 토큰이 고정된 violet hex를 대체합니다
md size uses --button-height-md instead of h-9|md 크기가 h-9 대신 --button-height-md를 사용합니다
Button padding set to 12px 24px (px-6 py-3)|Button 패딩을 12px 24px(px-6 py-3)로 설정
Primary button background set to the sky accent|기본 버튼 배경을 sky 강조색으로 설정
Inputs move from 10px to the 12px design system padding.|Input 패딩이 10px에서 디자인 시스템 기준인 12px로 바뀝니다.
The lg radius step becomes 12px so cards and sheets share one curve.|lg 반경 단계가 12px가 되어 카드와 시트가 같은 곡률을 공유합니다.
Form gaps move from 6px to 8px to stay on the 4/8 spacing scale.|폼 간격이 4/8 간격 스케일에 맞춰 6px에서 8px로 바뀝니다.
--primary points at the brand token instead of a hard-coded hex.|--primary가 하드코딩된 hex 대신 브랜드 토큰을 가리킵니다.
Design frame padding (12px 24px) does not match code button padding (8px 16px).|디자인 프레임 패딩(12px 24px)이 코드의 버튼 패딩(8px 16px)과 다릅니다.
Ask Devsign to apply the padding fix — it will update the button className to px-6 py-3 to match the design frame.|Devsign에 패딩 수정을 요청하세요 — 버튼 className을 px-6 py-3으로 업데이트해 디자인 프레임과 맞춥니다.
Switch user|사용자 전환
Select an element on the canvas to see only the components that fit it.|캔버스에서 요소를 선택하면 해당 요소에 맞는 컴포넌트만 볼 수 있습니다.
No checkpoints have been saved for this project yet.|이 프로젝트에는 아직 저장된 버전이 없습니다.
No file snapshot is available for this checkpoint.|이 버전에는 파일 스냅샷이 없습니다.
Select a checkpoint to inspect its file snapshot.|버전을 선택하면 파일 스냅샷을 확인할 수 있습니다.
Edit or combine elements before merging.|병합하기 전에 요소를 편집하거나 조합하세요.
Document not found|문서를 찾을 수 없습니다
Select an element on the canvas to inspect its layout, style and CSS.|캔버스에서 요소를 선택하면 레이아웃, 스타일, CSS를 확인할 수 있습니다.
No design spec for this element type yet.|이 요소 유형에 대한 디자인 명세가 아직 없습니다.
Project home|프로젝트 홈
Design Team|디자인 팀
Engineering|엔지니어링
Product|프로덕트
Marketing|마케팅
Settings|설정
Workspace settings|워크스페이스 설정
App preferences for this browser.|이 브라우저의 앱 환경설정입니다.
Language|언어
Applies to the entire app. Code, file paths and your content stay in their original language.|앱 전체에 적용됩니다. 코드, 파일 경로와 사용자 콘텐츠는 원문을 유지합니다.
Demo|데모
Local demo data|로컬 데모 데이터
Local demo tools|로컬 데모 도구
Reset demo data|데모 데이터 초기화
Saved only in this browser. Approvals and edits are not synchronized with other users.|이 브라우저에만 저장됩니다. 승인과 편집 내용은 다른 사용자와 동기화되지 않습니다.
Reset this prototype’s drafts, reviews and history for all projects?|모든 프로젝트의 초안, 검토와 기록을 초기화할까요?
Local demo could not be saved|로컬 데모를 저장하지 못했습니다
Storage is unavailable or full. Changes remain in this tab; allow browser storage before refreshing.|저장 공간을 사용할 수 없거나 가득 찼습니다. 변경 내용은 이 탭에 남아 있습니다. 새로고침 전에 브라우저 저장소를 허용하세요.
Reset failed. Allow access to browser storage and try again.|초기화하지 못했습니다. 브라우저 저장소 접근을 허용한 뒤 다시 시도하세요.
Close|닫기
Cancel|취소
Current|현재
Files|파일
Needs your review|검토할 항목
Open|열기
Status|상태
Preview|미리보기
All|전체
History|기록
Design|디자인
Done|완료
Send|보내기
Review|검토
Projects|프로젝트
Rollback here|여기로 되돌리기
Merged|병합 완료
Compare latest|최신 버전과 비교
Merge Studio|머지 스튜디오
Notifications|알림
Original Design|원본 디자인
Restore|복원
Changes|변경 사항
Comments|댓글
risk|위험도
Docs|문서
Imported|가져온 항목
All types|모든 유형
Import|가져오기
Back|뒤로
Fill|채우기
Radius|모서리 반경
Resolved|해결됨
High|높음
Medium|보통
Low|낮음
Reviewers|검토자
Conflict Points|충돌 지점
Assets|에셋
Terminal|터미널
Console|콘솔
Following|팔로우 중
None|없음
Inbox|받은 알림
Current Implementation|현재 구현
Code|코드
Filter|필터
Code changes|코드 변경
Add user|사용자 추가
Teams|팀
All projects|모든 프로젝트
This week|이번 주
Conflict|충돌
Comment|댓글
Conflicts|충돌
Updated|수정됨
On this page|이 페이지의 항목
Draft changes · Not merged|변경 초안 · 병합 전
Review changes|변경 사항 검토
Choose a target first|먼저 대상을 선택하세요
Auto|자동
You|나
Before|변경 전
After|변경 후
Members|구성원
View profile|프로필 보기
All docs|모든 문서
Design System Updates|디자인 시스템 업데이트
Archive|보관함
Restore to History|기록으로 복원
Bring designs, code and data into|디자인, 코드와 데이터 가져오기
Delete|삭제
Approved · Pending merge|승인됨 · 병합 대기
Forward|앞으로
Agent checkpoints (History)|에이전트 체크포인트 (기록)
No comments yet.|아직 댓글이 없습니다.
Clear selection|선택 해제
Copied|복사됨
Copy|복사
Regenerate|다시 생성
Thumbs up|좋아요
Thumbs down|싫어요
Selected element|선택한 요소
Current page|현재 페이지
Open file|열린 파일
Docs document|문서
Choose a file|파일 선택
Attach file|파일 첨부
Remove attachment|첨부 제거
Code block|코드 블록
Draft · not merged|초안 · 병합 전
ready for review|검토 대기
Upload files|파일 업로드
Width|너비
Height|높이
Label|레이블
Version History|버전 기록
Checkpoint ·|체크포인트 ·
Play history|기록 재생
Version|버전
Rollback to checkpoint|체크포인트로 되돌리기
Code files|코드 파일
Code Editor|코드 편집기
Canvas|캔버스
AI Chat|AI 채팅
Layers|레이어
Bottom panel|하단 패널
Stroke|테두리
Layout|레이아웃
Workspace|워크스페이스
Appearance|모양
Square|사각형
Rounded|둥근 모서리
Pill|캡슐형
Reset|초기화
Original|원본
Block Deck|블록 덱
Resolve all|모두 해결
Drag to move|드래그하여 이동
Remove|제거
Check|확인
All changes reviewed|모든 변경 사항 검토 완료
Property|속성
Edit in Assemble|조합에서 편집
Review requested|검토 요청됨
Compare|비교
Approved|승인됨
Step|단계
Write a comment|댓글 작성
Resize|크기 조절
In review|검토 중
In Review|검토 중
Edited|편집됨
Edit member|구성원 편집
Role|역할
(optional)|(선택 사항)
(you)|(나)
Owner|소유자
Open a view|화면 열기
Maximize|최대화
Collapse panel|패널 접기
Expand panel|패널 펼치기
Back to dashboard|대시보드로 돌아가기
Activity overview|활동 개요
More|더 보기
Most active projects|활동이 많은 프로젝트
Stay in sync|최신 소식 받기
Get notified when there are new conflicts or merges.|새 충돌이나 병합이 발생하면 알림을 받습니다.
Turn on notifications|알림 켜기
Merge|병합
File|파일
Mention|멘션
Merges|병합
Mentions|멘션
Pipeline|처리 과정
Doc|문서
Generate documentation|문서 생성
Archive to history|기록에 보관
Changes to the design system are written up as documentation, then recorded in the project's history.|디자인 시스템 변경을 문서로 작성한 뒤 프로젝트 기록에 보관합니다.
No design system updates yet. Resolving a Conflict Point starts one.|아직 디자인 시스템 업데이트가 없습니다. 충돌 지점을 해결하면 시작됩니다.
Spec|명세
Guide|안내
Target:|대상:
Choose what to change|변경할 대상 선택
Apply the request to|요청 적용 대상
Select an element on the canvas to target it.|캔버스에서 요청 대상을 선택하세요.
Partially done|일부 완료
No changes made|변경 사항 없음
Failed|실패
View changes|변경 사항 보기
Ask Devsign to tweak the design or code...|바꾸고 싶은 디자인이나 코드를 알려주세요
Nothing yet.|아직 항목이 없습니다.
Search projects, files, or members...|프로젝트, 파일 또는 구성원 검색...
No results found.|검색 결과가 없습니다.
This is a demo — no account was affected.|데모입니다. 실제 계정에는 영향을 주지 않습니다.
Sign out|로그아웃
Undo|실행 취소
Checkpoints|체크포인트
Archive this checkpoint|이 체크포인트 보관
No archived checkpoints.|보관된 체크포인트가 없습니다.
Switch project|프로젝트 전환
Home · All projects|홈 · 모든 프로젝트
Select projects|프로젝트 선택
Deselect all|전체 선택 해제
Select all|전체 선택
Last modified|최근 수정일
Grid view|격자 보기
List view|목록 보기
New project|새 프로젝트
Nothing needs your review.|검토할 항목이 없습니다.
High risk|높은 위험도
No open high-risk items.|미해결 고위험 항목이 없습니다.
Nothing is waiting to be merged.|병합 대기 중인 항목이 없습니다.
You’re a reviewer|내가 검토자인 항목
Not assigned to you|나에게 배정되지 않음
Your queue|내 작업 목록
Queue|작업 목록
Home|홈
Activity|활동
Team|팀
Main|주 메뉴
Close drawer|서랍 닫기
Resize sidebar|사이드바 크기 조절
Open a panel from the toolbar, or drag a tab here to dock it.|도구 모음에서 패널을 열거나 여기에 탭을 끌어 놓으세요.
New comment|새 댓글
Leave a comment...|댓글 남기기...
Less radius|반경 줄이기
More radius|반경 늘리기
Double-click text to edit|텍스트를 두 번 클릭하여 편집
Zoom out|축소
Zoom in|확대
Write a comment...|댓글 작성...
Pending merge|병합 대기
Filter conflicts|충돌 필터
No conflicts — design and code are in sync.|충돌이 없습니다. 디자인과 코드가 일치합니다.
Select all low-risk conflicts|낮은 위험도의 충돌 모두 선택
Severity|위험도
Issue|항목
Nothing needs your review right now.|현재 검토할 항목이 없습니다.
No conflicts in this view.|이 보기에 충돌이 없습니다.
Only low-risk conflicts waiting on review can be batch-approved|검토 대기 중인 낮은 위험도의 충돌만 일괄 승인할 수 있습니다
Unassigned|미배정
low-risk selected|개의 낮은 위험도 항목 선택됨
Batch Approve Selected|선택 항목 일괄 승인
Minimap — click to jump|미니맵 · 클릭하여 이동
Comment on this line|이 줄에 댓글 작성
Reply...|답글 작성...
Editing|편집 중
Saved|저장됨
Edit|편집
Import files|파일 가져오기
Import into this project|이 프로젝트로 가져오기
Figma (.fig), Illustrator (.ai), SVG and images, or code files (.jsx, .tsx, .css, .json…). You can also drop them onto the file tree.|Figma (.fig), Illustrator (.ai), SVG, 이미지 또는 코드 파일 (.jsx, .tsx, .css, .json 등)을 가져옵니다. 파일 트리에 끌어 놓을 수도 있습니다.
Link a Figma file|Figma 파일 연결
Link|연결
· imported|· 가져옴
Project root|프로젝트 루트
Project files|프로젝트 파일
No files yet. Import files to get started.|파일이 없습니다. 파일을 가져와 시작하세요.
Design imports|가져온 디자인
Drop to import|놓아서 가져오기
This layer no longer exists.|이 레이어는 더 이상 존재하지 않습니다.
Position & size|위치와 크기
Synced from|동기화 원본
Project-wide version changes and activity.|프로젝트 전체의 버전 변경과 활동입니다.
Select a version to compare it with the current one.|현재 버전과 비교할 버전을 선택하세요.
This is the current version.|현재 버전입니다.
The file as it was at this version.|이 버전 당시의 파일입니다.
Compared with current ·|현재 버전과 비교 ·
lines|줄
Restore this version|이 버전 복원
No code changes between this version and the latest.|이 버전과 최신 버전 사이에 코드 변경이 없습니다.
Resize code and canvas|코드와 캔버스 크기 조절
Canvas version|캔버스 버전
Preview props|미리보기 속성
History playback|기록 재생
Pause playback|재생 일시 정지
Pause|일시 정지
Previous version|이전 버전
Previous version (←)|이전 버전 (←)
Next version|다음 버전
Next version (→)|다음 버전 (→)
Current version|현재 버전
Restore to here|여기까지 복원
Always|항상
Your work goes back to how it was at this checkpoint, saved as a new checkpoint on top — nothing after it is erased.|작업을 이 체크포인트 당시로 복원하고 새 체크포인트로 저장합니다. 이후 기록은 삭제하지 않습니다.
Preview ·|미리보기 ·
vs. current|현재 버전과 비교
The code is the same as the current version.|현재 버전과 코드가 같습니다.
What will be rolled back|되돌릴 내용
Preview & canvas|미리보기와 캔버스
Agent memory|에이전트 기억
Nothing to forget — the agent conversation hasn’t moved on since.|이후 에이전트 대화가 없어 지울 내용이 없습니다.
Preview settings and the canvas selection at this checkpoint.|이 체크포인트 시점의 미리보기 설정과 캔버스 선택 상태입니다.
Review state of the conflicts this checkpoint knows about.|이 체크포인트가 알고 있는 충돌의 검토 상태입니다.
Database|데이터베이스
No database is connected to this project.|이 프로젝트에 연결된 데이터베이스가 없습니다.
the current target|현재 대상
The demo could not apply this code. Try a supported request or edit the target in Assemble.|데모에서 이 코드를 적용하지 못했습니다. 지원되는 요청을 시도하거나 조합에서 대상을 직접 편집하세요.
The target already matches this result. No files or approvals were changed.|대상이 이미 이 결과와 일치합니다. 파일이나 승인 내용이 변경되지 않았습니다.
Import a repository's files into this project's file tree.|저장소의 파일을 이 프로젝트의 파일 트리로 가져옵니다.
Figma design|Figma 디자인
Link a Figma file; its frames are available from Assets.|Figma 파일을 연결하면 에셋에서 프레임을 사용할 수 있습니다.
Zip file|ZIP 파일
Upload a project archive. It's kept with the project's assets.|프로젝트 압축 파일을 업로드합니다. 프로젝트 에셋에 보관됩니다.
Upload zip|ZIP 업로드
Spreadsheet|스프레드시트
CSV and TSV open as data files you can edit; Excel files join Assets.|CSV와 TSV는 편집 가능한 데이터 파일로 열고 Excel 파일은 에셋에 추가합니다.
Upload spreadsheet|스프레드시트 업로드
Components, styles and config — added to the file tree and opened.|컴포넌트, 스타일과 설정 파일을 파일 트리에 추가하고 엽니다.
Upload code|코드 업로드
Illustrator & images|Illustrator 및 이미지
Vector and image files for the canvas, kept in Assets.|캔버스에서 사용할 벡터와 이미지 파일을 에셋에 보관합니다.
Nothing imported yet.|아직 가져온 항목이 없습니다.
Commands|명령
No matching commands.|일치하는 명령이 없습니다.
Tab|탭
Pane|패널
Hide Inspector|속성 패널 숨기기
Show Inspector|속성 패널 표시
Collapse bottom panel|하단 패널 접기
Expand bottom panel|하단 패널 펼치기
Command palette|명령 팔레트
Open a view or run a command…|화면을 열거나 명령 실행…
Waiting for followers...|팔로워 대기 중...
Stop|중지
Inspect|속성 보기
Select a frame or shape on the Canvas to inspect its design spec.|캔버스에서 프레임이나 도형을 선택하여 디자인 명세를 확인하세요.
Design tokens|디자인 토큰
Fill token|채우기 토큰
Layout (Auto Layout)|레이아웃 (자동 레이아웃)
Direction|방향
Padding|안쪽 여백
Gap|간격
Align|정렬
Size|크기
Position|위치
Style|스타일
Typography|타이포그래피
Window Layout|창 배치
Search files, commands...|파일, 명령 검색...
Follow me|내 화면 공유
Teammate activity is simulated in this prototype.|이 프로토타입의 팀원 활동은 시뮬레이션입니다.
Edit custom value|사용자 지정 값 편집
Set a custom value|사용자 지정 값 설정
Custom|사용자 지정
Clear custom value|사용자 지정 값 지우기
Pick a color|색상 선택
X position|X 위치
Y position|Y 위치
Unlock aspect ratio|비율 고정 해제
Lock aspect ratio|비율 고정
Auto layout|자동 레이아웃
Horizontal|가로
Vertical|세로
Gap between items|항목 사이 간격
Horizontal padding|가로 안쪽 여백
Vertical padding|세로 안쪽 여백
Alignment|정렬
Opacity|불투명도
Corner radius|모서리 반경
Square corners (0px)|직각 모서리 (0px)
Rounded corners (12px)|둥근 모서리 (12px)
Pill corners (999px)|캡슐형 모서리 (999px)
Remove fill override|채우기 변경 해제
Remove stroke|테두리 제거
Add stroke|테두리 추가
HEX or token|HEX 또는 토큰
Stroke width|테두리 두께
No stroke|테두리 없음
Effects|효과
Drop shadow|그림자
Glow|빛 효과
Icon|아이콘
No icon|아이콘 없음
Leading|앞쪽
Leading icon|앞쪽 아이콘
Trailing|뒤쪽
Trailing icon|뒤쪽 아이콘
No design tokens found|디자인 토큰이 없습니다
AI recommends|AI 추천
Apply recommendation|추천 적용
No drifts — this item matches the Original Design.|차이가 없습니다. 원본 디자인과 일치합니다.
drifts resolved|개 차이 해결됨
design ·|디자인 ·
Detected drifts|감지된 차이
Collapse|접기
Show property diffs|속성 차이 표시
Not resolved yet|아직 해결되지 않음
All properties resolved|모든 속성 해결됨
Incoming|들어오는 변경
Edit this line directly in the code window.|코드 창에서 이 줄을 직접 편집하세요.
Open a drift to compare and resolve its properties right here.|차이 항목을 열어 여기서 속성을 비교하고 해결하세요.
Text|텍스트
Synced to copy.json|copy.json에 동기화됨
Dismiss suggestion|추천 닫기
AI suggestions|AI 추천
Select a canvas element to preview suggestions on it|캔버스 요소를 선택하여 추천 결과를 미리 보세요
For|대상
— click one to preview it live|· 선택하여 실시간으로 미리 보기
All suggestions dismissed.|모든 추천을 닫았습니다.
Generate alternatives|대안 생성
No more alternatives|더 이상 대안이 없습니다
Token binding|토큰 연결
Select an element on the canvas to assemble its shape, size and layout.|캔버스 요소를 선택하여 모양, 크기와 레이아웃을 조합하세요.
Drag onto the canvas to place|캔버스로 끌어 놓아 배치
Replace|교체
Insert|삽입
Add to canvas|캔버스에 추가
Filter by category|분류별 필터
Components|컴포넌트
Search components…|컴포넌트 검색…
Compatible|호환됨
Every component|모든 컴포넌트
Nothing fits|호환되는 항목 없음
— showing all|· 전체 표시
All components ·|모든 컴포넌트 ·
Fits|호환
Select an element on the canvas to see only the components that fit it — or drag one onto the canvas.|캔버스 요소를 선택하면 호환되는 컴포넌트만 표시됩니다. 컴포넌트를 캔버스로 끌어 놓을 수도 있습니다.
No components match.|일치하는 컴포넌트가 없습니다.
No compatible components match this search.|검색과 일치하는 호환 컴포넌트가 없습니다.
Collapse to the header|헤더만 남기고 접기
Collapse Block Deck|블록 덱 접기
This merge item has no design page to compare.|이 병합 항목에는 비교할 디자인 페이지가 없습니다.
Recommended|추천
No linked conflict blocks are available. This item cannot be resolved without its source data.|연결된 충돌 블록이 없습니다. 원본 데이터 없이는 이 항목을 해결할 수 없습니다.
Back to Check|확인으로 돌아가기
Checks|검사
Resolve the|해결할 항목:
Pick a version for each conflicting value — or let AI resolve them all.|각 충돌 값의 버전을 선택하거나 AI로 모두 해결하세요.
with AI|AI로
Uses the latest Design System tokens|최신 디자인 시스템 토큰 사용
Applied|적용됨
Show on canvas|캔버스에서 보기
Locate|위치 찾기
Previous|이전
Apply resolution|해결 결과 적용
Next|다음
No conflicts|충돌 없음
Reset position & size|위치와 크기 초기화
Delete (⌫)|삭제 (⌫)
Listening…|듣는 중…
Devsign AI is thinking…|Devsign AI가 생각 중입니다…
Ask AI to merge, restyle, or explain… (attach a screenshot or use voice)|AI에 병합, 스타일 변경 또는 설명을 요청하세요… (스크린샷 첨부 또는 음성 입력)
Attach image|이미지 첨부
Stop recording|녹음 중지
Voice input|음성 입력
Recording…|녹음 중…
Committing changes|변경 사항 기록 중
Opening pull request|풀 리퀘스트 생성 중
Requesting team reviews|팀 검토 요청 중
No variant options resolved.|해결된 후보 옵션이 없습니다.
No code files.|코드 파일이 없습니다.
AI edits|AI 편집
No AI edits applied.|적용된 AI 편집이 없습니다.
What will be merged|병합할 내용
not applied|적용 전
No explicit selection. The current implementation will be used.|명시적으로 선택하지 않았습니다. 현재 구현을 사용합니다.
Changed since review|검토 후 변경됨
Previous change|이전 변경
Next change|다음 변경
Design system|디자인 시스템
Replaced with|교체한 컴포넌트
Styled with|스타일 출처
Final|최종안
Keep the Original value|원본 값 유지
Adopt the Current value|현재 값 채택
— its final code is in the output below.|· 최종 코드는 아래 출력에 표시됩니다.
Select this element in the Block Deck's Assemble tab to change its final result|최종 결과를 변경하려면 블록 덱의 조합 탭에서 이 요소를 선택하세요
Reviewed|검토 완료
Mark as unreviewed|검토 취소
Mark as reviewed|검토 완료로 표시
No merge conflicts|병합 충돌 없음
Conflicting blocks need a version before this merges cleanly.|병합하기 전에 충돌 블록의 버전을 결정해야 합니다.
They’ll ship the Current Implementation’s value — review them in Preview.|현재 구현의 값을 사용합니다. 미리보기에서 검토하세요.
All values on the token scale|모든 값이 토큰 규격에 맞음
WCAG 2.2 AA (2.5.8) target size.|WCAG 2.2 AA (2.5.8) 대상 크기 기준입니다.
Text sizes ≥ 12px|텍스트 크기 12px 이상
Text below 12px|12px 미만 텍스트
No pending AI notes|대기 중인 AI 메모 없음
Use “Apply with AI” on the canvas to include them.|캔버스에서 ‘AI로 적용’을 눌러 포함하세요.
Token consistency|토큰 일치도
Screen impacted|영향받는 화면
Screens impacted|영향받는 화면
Breaking change|호환성을 깨뜨리는 변경
Breaking changes|호환성을 깨뜨리는 변경
Checks passed|통과한 검사
Merge impact|병합 영향
All automated checks pass|모든 자동 검사 통과
Impact|영향
Resolve|해결
Merged result|병합 결과
Both at|공통 배율
Staging preview|최종안 미리보기
Review the final result before merging.|병합 전에 최종 결과를 검토하세요.
Live|실시간
This drift has no design element — its change is in the code below.|이 차이에는 디자인 요소가 없습니다. 아래 코드에서 변경을 확인하세요.
Output files|출력 파일
Needs at least one reviewer|검토자가 한 명 이상 필요합니다
Not required|필수 아님
Add|추가
Deploys automatically once approved and merged|승인 및 병합 후 자동 배포
Auto-deploy is off — deploy manually after merge|자동 배포가 꺼져 있습니다. 병합 후 수동으로 배포하세요
” is open and waiting for approval.|’ 검토가 열려 승인 대기 중입니다.
Merge changes|변경 사항 병합
Draft changes · Not merged · Local demo|변경 초안 · 병합 전 · 로컬 데모
Required approvals · Local demo simulation|필수 승인 · 로컬 데모 시뮬레이션
Simulate approval|승인 시뮬레이션
Merge approved changes|승인된 변경 병합
Generating…|생성 중…
Generate with AI|AI로 생성
Commit & PR|커밋 및 PR
Commit message|커밋 메시지
PR title|PR 제목
PR description|PR 설명
Describe this merge, or use Generate with AI…|병합 내용을 설명하거나 AI로 생성하세요…
Deploy automatically once approved and merged|승인 및 병합 후 자동 배포
Assign at least one Code and one Design reviewer.|코드 검토자와 디자인 검토자를 각각 한 명 이상 배정하세요.
Commit message and PR title are required.|커밋 메시지와 PR 제목이 필요합니다.
Back to Compare|비교로 돌아가기
Continue to|다음 단계:
Open PR & Request Review|PR 생성 및 검토 요청
Find people…|사람 검색…
Back to filters|필터로 돌아가기
Custom due range|마감일 범위 지정
Clear|지우기
Assignee|담당자
Due|마감일
Custom range…|범위 지정…
Clear all filters|모든 필터 해제
Showing|표시 중
Clear filters|필터 해제
Explore the Merge List|병합 목록 살펴보기
Open a merge item|병합 항목 열기
Step through drifts|차이 항목 순서대로 보기
Edit & bind in the Block Deck|블록 덱에서 편집 및 연결
Finish the merge|병합 마무리
Skip guide|안내 건너뛰기
Roll back to this version|이 버전으로 되돌리기
Roll back to this version?|이 버전으로 되돌릴까요?
Roll back|되돌리기
Merges, branches and reviews — newest first.|병합, 브랜치와 검토를 최신순으로 표시합니다.
Unread|읽지 않음
Add emoji|이모지 추가
Mark all read|모두 읽음으로 표시
Filter notifications|알림 필터
You’re all caught up.|모든 알림을 확인했습니다.
Nothing here yet.|아직 항목이 없습니다.
Edited by hand|직접 편집함
Edit this line|이 줄 편집
Double-click a line to edit it|줄을 두 번 클릭하여 편집
View all|전체 보기
Double-click to edit text|두 번 클릭하여 텍스트 편집
Double-click any text on this artboard to edit it — synced to copy.json|아트보드의 텍스트를 두 번 클릭하면 편집할 수 있으며 copy.json에 동기화됩니다
Edit with AI|AI로 편집
AI Edit|AI 편집
Apply|적용
Delete annotation|주석 삭제
AI is updating design & code…|AI가 디자인과 코드를 수정하고 있습니다…
Waiting — use Apply with AI|대기 중 · AI로 적용을 사용하세요
Save|저장
Version history|버전 기록
No changes yet — pick or edit values, edit code, assemble blocks, or annotate.|아직 변경이 없습니다. 값을 선택하거나 편집하고, 코드를 수정하거나 블록을 조합하거나 주석을 추가하세요.
Edits|편집 사항
Jump to element|요소로 이동
Undo this change|이 변경 취소
Incoming from the Current Implementation|현재 구현에서 들어오는 변경
Incoming changed lines|들어오는 변경된 줄
Changes log|변경 기록
Design changes|디자인 변경
Close preview|미리보기 닫기
Apply with AI|AI로 적용
Previous drift|이전 차이
Drift|차이
Next drift|다음 차이
Merge Changes|변경 사항 병합
Reset view and layout|보기와 레이아웃 초기화
Hide selection guides|선택 안내선 숨기기
Show selection guides|선택 안내선 표시
Selection guides|선택 안내선
AI is updating…|AI가 수정 중입니다…
Not applied yet|아직 적용하지 않음
Needs review|검토 필요
Needs Review|검토 필요
In progress|진행 중
In Progress|진행 중
Draft|초안
Other|기타
No changes yet|아직 변경 사항 없음
Incoming changes from the Current Implementation|현재 구현에서 들어오는 변경 사항
Lines edited by hand|직접 편집한 줄
Show Merge List|병합 목록 표시
Hide Merge List|병합 목록 숨기기
Merge List|병합 목록
Search…|검색…
Add files — start a merge item from your open files|파일 추가 · 열린 파일로 병합 항목 만들기
Add files|파일 추가
No merge items match these filters.|필터와 일치하는 병합 항목이 없습니다.
Back to Merge List|병합 목록으로 돌아가기
Mobile|모바일
Tablet|태블릿
Desktop|데스크톱
Device|기기
Actions|작업
Rotate (mobile & tablet only)|회전 (모바일과 태블릿만 가능)
Rotate|회전
Close preview (Esc)|미리보기 닫기 (Esc)
This merge item has no design to preview.|이 병합 항목에는 미리 볼 디자인이 없습니다.
Hover or click an element to inspect it|요소에 마우스를 올리거나 클릭하여 확인하세요
Share|공유
General access|일반 접근 권한
Link copied|링크 복사됨
Copy link|링크 복사
Open Saved Merge Work|저장된 병합 작업 열기
Continue from Merge List|병합 목록에서 계속하기
Start New with Current Work|현재 작업으로 새로 시작
Start with currently open files|현재 열린 파일로 시작
State restored|상태 복원됨
Back to Preview|미리보기로 돌아가기
Show Block Deck|블록 덱 표시
release on an artboard to drop|아트보드 위에서 놓아 배치
click on an artboard to place|아트보드를 클릭하여 배치
Esc to cancel|Esc로 취소
Previous month|이전 달
Next month|다음 달
Indigo|인디고
Violet|바이올렛
Emerald|에메랄드
Rose|로즈
Amber|앰버
Gradient|그라데이션
Surface|표면
Ghost|투명
Circle|원형
Solid pill|단색 캡슐형
Ghost outline|투명 윤곽선
Compact|간결하게
Full width|전체 너비
Icon circle|원형 아이콘
Overdue|기한 초과
Due today|오늘 마감
Due this week|이번 주 마감
No due date|마감일 없음
Kept original design|원본 디자인 유지
Accepted current implementation|현재 구현 채택
Update this person's details and team assignments.|구성원의 정보와 팀 배정을 수정하세요.
Invite a new person to your workspace.|워크스페이스에 새 구성원을 초대하세요.
Name|이름
Name is required.|이름을 입력하세요.
Email|이메일
A valid email is required.|올바른 이메일을 입력하세요.
e.g. Developer, PM, Designer|예: 개발자, PM, 디자이너
Save changes|변경 사항 저장
Pending|대기 중
Changes requested|변경 요청됨
Review status|검토 상태
Code before|변경 전 코드
Changed by|변경한 사람
Detected by|감지한 주체
AI suggestion|AI 제안
References|참고 자료
View code diff|코드 차이 보기
Approving signs off on this proposal. It is applied to the code only when merged.|승인은 이 제안에 동의하는 것입니다. 병합할 때만 코드에 적용됩니다.
Merged — the code now matches the proposed change. Values below are as they were before the merge.|병합되어 코드에 제안이 적용되었습니다. 아래 값은 병합 전 상태입니다.
Devsign AI already made this change in the workspace. It becomes final only when approved and merged.|Devsign AI가 워크스페이스에 변경 초안을 적용했습니다. 승인 후 병합해야 최종 확정됩니다.
Before and after|변경 전후
What changed|변경 내용
No comparison captured yet.|아직 비교 정보가 없습니다.
Why review is needed|검토가 필요한 이유
No diff captured for this conflict yet.|이 충돌의 코드 차이가 아직 없습니다.
Proposed change|제안된 변경
Preview only — applied when the change is merged, after every required reviewer approves.|미리보기입니다. 필수 검토자가 모두 승인한 뒤 병합할 때 적용됩니다.
Next:|다음:
your review|내 검토
Remind all|모두에게 알림
Assign|배정
No reviewers yet.|아직 검토자가 없습니다.
Remind|알림 보내기
Remove reviewer|검토자 제거
Open the project's workspace to see and reply to its thread.|프로젝트 워크스페이스에서 대화를 확인하고 답글을 작성하세요.
All required approvals received|필수 승인 모두 완료
Approved by you|내가 승인함
Pending merge. Approval does not merge the changes.|병합 대기 중입니다. 승인만으로 병합되지 않습니다.
Request review|검토 요청
Request changes|변경 요청
Approve change|변경 승인
Merge change|변경 병합
Reopen|다시 열기
Approval does not merge the changes.|승인만으로 변경 사항이 병합되지 않습니다.
Merging applies the change and saves a History checkpoint.|병합하면 변경을 적용하고 기록에 체크포인트를 저장합니다.
Risk|위험도
Conflict details|충돌 상세
Checkpoints and rollbacks for this project are in History.|이 프로젝트의 체크포인트와 되돌리기는 기록에서 확인할 수 있습니다.
Open History|기록 열기
Open in Merge Studio|머지 스튜디오에서 열기
Edit or combine elements in Merge Studio before merging.|병합 전에 머지 스튜디오에서 요소를 편집하거나 조합하세요.
Create new project|새 프로젝트 만들기
Set up a new workspace for your team.|팀을 위한 새 워크스페이스를 만드세요.
Project name|프로젝트 이름
Project name is required.|프로젝트 이름을 입력하세요.
A project with this name already exists.|같은 이름의 프로젝트가 이미 있습니다.
Description|설명
What's this project for?|어떤 프로젝트인가요?
Project type|프로젝트 유형
Creating…|생성 중…
Create project|프로젝트 만들기
Editor|편집자
Create a new team|새 팀 만들기
Group people together to share projects and access.|프로젝트와 접근 권한을 공유할 사람들을 팀으로 묶으세요.
Team name|팀 이름
Team name is required.|팀 이름을 입력하세요.
Add members by name or email|이름이나 이메일로 구성원 추가
Reset to default|기본값으로 초기화
Create team|팀 만들기
Open here|여기서 열기
Drag to split or move|드래그하여 분할 또는 이동
Resize bottom panel|하단 패널 크기 조절
Needs your review ·|검토할 항목 ·
No views open|열린 화면이 없습니다
Resize panes|패널 크기 조절
All activities|모든 활동
What your team is doing across every project. For one project's saved versions, open its Archive → History.|모든 프로젝트의 팀 활동입니다. 프로젝트의 저장된 버전은 보관함 → 기록에서 확인하세요.
No activity matches this filter.|필터와 일치하는 활동이 없습니다.
Open in Workspace|워크스페이스에서 열기
Open Workspace|워크스페이스 열기
Open design ↔ code differences|디자인 ↔ 코드 차이 열기
None high risk|고위험 항목 없음
Conflict Points not merged yet|아직 병합되지 않은 충돌 지점
Open Conflict Points|해결할 충돌
In Workspace|워크스페이스에서
No open Conflict Points.|미해결 충돌 지점이 없습니다.
Recent activity|최근 활동
All activity|모든 활동
Design system pipeline|디자인 시스템 처리 과정
Reference docs|참고 문서
Recent versions|최근 버전
Active|활성
Offline|오프라인
Member updated|구성원 수정됨
Member added|구성원 추가됨
Team members|팀 구성원
People with access to your projects.|프로젝트에 접근할 수 있는 구성원입니다.
Search|검색
Download CSV|CSV 다운로드
New team|새 팀
Member|구성원
Email address|이메일 주소
No members match your search.|검색과 일치하는 구성원이 없습니다.
More actions|더 많은 작업
Permissions|권한
Assemble|조합
Library|라이브러리
Approvals|승인
Feedback|피드백
Code review|코드 검토
Design review|디자인 검토
Review not requested|검토 요청 전
Awaiting review|검토 대기
Just now|방금
Today|오늘
Yesterday|어제
Default|기본값
default|기본값
Select|선택
Deselect|선택 해제
Approved changes|승인된 변경
All changes|모든 변경
Untitled|제목 없음
Close sidebar|사이드바 닫기
No reviewers assigned|배정된 검토자 없음
Your approval is needed|내 승인이 필요합니다
You requested changes|변경을 요청했습니다
Review not requested yet|아직 검토를 요청하지 않았습니다
Merge the approved change|승인된 변경 병합
Assign reviewers|검토자 배정
Review and approve|검토 후 승인
Waiting on changes|변경 대기 중
Can't merge yet|아직 병합할 수 없습니다
Every required reviewer has to approve the latest changes first.|먼저 모든 필수 검토자가 최신 변경 사항을 승인해야 합니다.
Resolve the conflicting blocks in Merge Studio’s Check step first.|먼저 머지 스튜디오의 확인 단계에서 충돌 블록을 해결하세요.
Unresolved conflict markers remain in the code.|코드에 미해결 충돌 표시가 남아 있습니다.
This change is already merged.|이미 병합된 변경입니다.

Document updates|문서 업데이트
Document update|문서 변경사항
Approve update|변경사항 승인
Record in history|기록에 저장
Affected docs|관련 문서
Waiting for earlier updates|이전 변경사항 처리 대기
System changes from Conflict and Merge are automatically listed here for approval. Updates cover all project documents and are processed in order, then recorded in History.|Conflict·Merge에서 발생한 시스템 변경사항이 자동으로 등록됩니다. 모든 프로젝트 문서를 대상으로 순차 승인하고 History에 기록합니다.
No document updates yet. Resolving a Conflict Point or merging system changes adds an update automatically.|문서 업데이트가 없습니다. Conflict 해결 또는 시스템 변경사항 Merge 시 자동 등록됩니다.
Create new document|새 문서 생성
Created document|생성된 문서
Change path|경로 변경
Document creation path|문서 생성 경로
Document category|문서 카테고리
Back to notifications|알림 목록으로
Select a change to open its review.|변경사항을 선택하면 리뷰가 열립니다.
Comments and feedback for this target.|이 대상의 코멘트와 피드백입니다.
Approval activity for this target.|이 대상의 승인 내역입니다.
Review completed|검토 완료
No changes waiting for review.|검토 대기 중인 변경사항이 없습니다.
Comments and AI / CI feedback|코멘트 및 AI / CI 피드백
Hi, I'm your design + code copilot. Ask me to tweak spacing, colors, or sync the canvas with the editor — I'll update the code, preview and terminal together.|디자인과 코드 수정을 도와드릴게요. 바꾸고 싶은 요소와 내용을 알려주세요.
Updated Place order button height and color|주문 버튼 높이·색상 수정
Updated the Place order button: it now uses the large size (44px) and the primary color token.|Place order 버튼 높이를 디자인과 같은 44px로 맞추고, 색상에는 primary 토큰을 적용했어요. 미리보기에서 확인해보세요.
Updated the Place order button. The other checkout buttons are in files that aren’t in this workspace, so they weren’t changed.|Place order 버튼을 업데이트했습니다. 다른 결제 화면 버튼들은 이 워크스페이스에 없는 파일에 있어 변경하지 않았습니다.
Other checkout buttons live in files that aren’t in this workspace.|다른 결제 화면 버튼들은 이 워크스페이스에 없는 파일에 있습니다.
Updated Button height to use the size token|공통 버튼 높이 토큰 적용
Updated Button.jsx: the md size now uses --button-height-md (40px) instead of h-9.|Button.jsx의 md 높이를 수정했어요. 이제 h-9 대신 --button-height-md 토큰을 사용해 40px로 표시돼요.
Updated Continue button padding|Continue 버튼 패딩을 업데이트했습니다
Fixed it — the Continue button now uses 12px/24px padding to match the design frame. The padding conflict is back in review — it closes once its reviewers approve.|수정했습니다 — Continue 버튼이 이제 디자인 프레임과 일치하는 12px/24px 패딩을 사용합니다. 패딩 충돌이 다시 검토 중 상태가 되었습니다 — 검토자들이 승인하면 종료됩니다.
Changed primary button color to sky|기본 버튼 색상을 sky로 변경했습니다
Swapped the primary button to the sky accent token in theme.css.|theme.css에서 기본 버튼을 sky 강조 색상 토큰으로 변경했습니다.
Where should I start?|어떤 것부터 확인할까요?
Where should I start the designer UT?|주문 버튼 디자인은 어떤 것부터 확인하면 되나요?
Start with Open Conflict Points and select the Place order button issue. Read the summary, then open Diff to compare the 40px implementation with the 44px design. Open Merge Studio, select Place order, and use Compare to choose the design value. Use Assemble for further styling, then Merge Changes to inspect the result and request review.|먼저 충돌 지점에서 Place order 버튼을 선택해보세요. 차이 보기에서 현재 높이 40px와 디자인의 44px를 비교할 수 있어요. 머지 스튜디오의 ‘비교’에서 디자인 값을 선택하고, 스타일을 더 다듬고 싶으면 ‘조합’을 열어보세요. 수정이 끝나면 ‘변경 사항 병합’에서 결과를 확인하고 검토를 요청하세요.
Match Place order to design|주문 버튼을 디자인에 맞추기
Make the Place order button match the checkout design|Place order 버튼의 높이와 색상을 디자인에 맞춰주세요
What happens after my edit?|수정한 다음에는 뭘 해야 하나요?
What happens after my design edit?|버튼을 수정했어요. 다음에는 뭘 해야 하나요?
Inspect the visual comparison and code diff before approving. An AI edit creates a draft and a History checkpoint; it does not merge automatically. Request review, collect the required approvals, then merge. History lets you inspect or roll back the saved checkpoint.|‘변경 사항 병합’에서 버튼 모양과 코드가 의도대로 바뀌었는지 확인해보세요. AI가 수정한 내용은 자동으로 병합되지 않아요. 검토를 요청하고 필요한 승인을 받은 뒤 병합하면 돼요. 저장된 버전은 ‘기록’에서 확인하거나 이전 상태로 되돌릴 수 있어요.
Guide me through code review|버튼 코드 검토 시작하기
Guide me through the developer UT|공통 버튼의 높이를 수정하려고 해요. 어떤 것부터 확인하면 되나요?
Open the Button / Height conflict from the project overview. Inspect the Diff: the implementation uses h-9 while the design system requires the medium height token. Open Workspace to inspect the affected file, then use Merge Studio Compare to resolve the drift. Review the resulting code in Merge Changes, assign reviewers, and request review. After approvals, merge and inspect History.|충돌 지점에서 Button / Height를 선택하고 코드 차이를 확인해보세요. 현재 코드는 h-9를 쓰지만, 디자인 시스템 기준은 40px 높이 토큰이에요. Button.jsx를 확인한 뒤 머지 스튜디오의 ‘비교’에서 토큰을 사용하는 코드로 맞춰보세요. ‘변경 사항 병합’에서 결과를 확인하고 검토자를 지정해 검토를 요청하세요. 필요한 승인을 받아 병합한 뒤에는 ‘기록’에서 변경 내용을 확인할 수 있어요.
Use the size token for Button|버튼 높이에 토큰 적용하기
Use the size token for the Button height|Button의 높이에 디자인 시스템 토큰을 적용해주세요
Why use a shared token?|높이를 토큰으로 관리하는 이유
Why should the button use a shared token?|버튼 높이를 직접 지정하지 않고 토큰을 쓰는 이유가 뭔가요?
A shared height token keeps every Button consumer aligned with the design system. Replacing the hard-coded h-9 avoids fixing each screen separately. Review the component diff and affected screens before merging because this shared component has a wider impact than a single page edit.|같은 버튼을 쓰는 여러 화면의 높이를 한곳에서 관리할 수 있기 때문이에요. h-9처럼 값을 직접 지정하면 기준이 바뀔 때마다 코드를 따로 수정해야 해요. 공통 버튼을 바꾸는 작업이니, 병합 전에 코드 차이와 이 버튼을 쓰는 화면도 함께 확인해보세요.
How do I verify and roll back?|변경 이력 확인하고 되돌리기
How do I verify and roll back the change?|수정한 내용을 확인하고 이전 상태로 되돌리려면 어떻게 하나요?
Check the final code and visual preview in Merge Changes. Approval and merge are separate steps. Once merged, open History, select the new checkpoint, and inspect its changed files. Use the rollback action to restore a previous checkpoint if the result is wrong.|먼저 ‘변경 사항 병합’에서 코드와 미리보기를 확인해보세요. 승인이 끝나도 병합은 직접 진행해야 해요. 병합 후에는 ‘기록’에서 새로 저장된 버전과 변경 파일을 확인할 수 있어요. 이전 상태로 돌아가려면 원하는 버전을 선택해 복원하세요.
Should the CTA use the violet accent or stay neutral here?|CTA에 violet 강조색을 쓸까요, 아니면 중립색을 유지할까요?
Padding looks tight on the mobile frame — can we match the 24px spec?|모바일 프레임에서 패딩이 좁아 보입니다 — 24px 스펙에 맞출 수 있을까요?
I'll sync this with the token file once the palette is finalized.|팔레트가 확정되면 토큰 파일과 동기화하겠습니다.
I kept the old violet as a hard-coded hex. Does the new checkout design drop it?|기존 violet을 하드코딩된 hex 값으로 남겨뒀어요. 새 결제 화면 디자인에서는 빠지나요?
The design system says md is 40px. Can we use the token instead of h-9?|디자인 시스템에서는 md가 40px입니다. h-9 대신 토큰을 사용할 수 있을까요?
approved the design changes on Hero CTA|Hero CTA 디자인 변경을 승인했습니다
approved the code changes|코드 변경을 승인했습니다
Padding looks tight on the primary button — can we match the 24px spec?|기본 버튼에서 패딩이 좁아 보입니다 — 24px 스펙에 맞출 수 있을까요?
Leaning violet — it matches the new tokens.|violet 쪽으로 기울고 있어요 — 새 토큰과 어울립니다.
requested your review on Place order button · Height & color|Place order button · Height & color 검토를 요청했습니다
Can you take a look at the payment label spacing before we ship?|배포 전에 결제 라벨 간격을 확인해주시겠어요?
divider color drifts from the border token in OrderSummary.jsx|OrderSummary.jsx의 구분선 색상이 border 토큰과 어긋납니다
requested your review on Button / Height|Button / Height 검토를 요청했습니다
GitHub Actions checks passed on merge/flowbank-homepage|merge/flowbank-homepage에서 GitHub Actions 검사를 통과했습니다
checks passed on merge/place-order-button|merge/place-order-button에서 검사를 통과했습니다
checks passed on merge/button-height-token|merge/button-height-token에서 검사를 통과했습니다
heading size differs between A and B on line 4|4행에서 A안과 B안의 제목 크기가 다릅니다
requested your review|검토를 요청했습니다
approved the design changes|디자인 변경을 승인했습니다
requested your review on|검토를 요청했습니다 ·
commented on|댓글을 남겼습니다 ·
flagged a design ↔ code difference on|디자인↔코드 차이를 발견했습니다 ·
changed the Place order button background in|버튼 배경색을 변경했습니다 ·
approved|승인했습니다
merged|병합했습니다
requested changes on|변경을 요청했습니다 ·
pushed new changes to|새 변경사항을 푸시했습니다 ·
added a new file to|새 파일을 추가했습니다 ·
mentioned you in a comment on|댓글에서 언급했습니다 ·
`.trim().split('\n').map((line) => { const index = line.indexOf('|'); return [line.slice(0, index), line.slice(index + 1)] }))

Object.assign(ko, {
  'of': '/', 'file': '파일', 'files': '파일', 'change': '변경', 'changes': '변경',
  'code': '코드', 'design': '디자인', 'layers': '레이어', 'copy': '복사',
  'drift': '차이', 'drifts': '차이', 'conflict': '충돌', 'conflicts': '충돌',
  'element': '요소', 'elements': '요소', 'propert': '속성', 'ies': '',
  'note': '메모', 'notes': '메모', 'checkpoints': '체크포인트', 's': '',
  'resolve': '해결', 'resolved': '해결됨', 'reviewed': '검토 완료', 'stale': '검토 후 변경됨',
  'approved': '승인됨', 'in_review': '검토 중', 'open': '미해결', 'edited': '편집됨',
  'total ·': '전체 ·', 'latest': '최신', 'selection': '선택', 'compare': '비교',
  'replace': '교체', 'insert': '삽입', 'edit': '편집', 'all': '전체', 'fit': '맞춤',
  'auto': '자동', 'left': '왼쪽', 'right': '오른쪽', 'center': '가운데', 'middle': '중앙',
  'top': '위', 'bottom': '아래', 'above': '위', 'below': '아래', 'horizontal': '가로', 'vertical': '세로',
  'No one matches “': '검색 결과 없음: “', 'Share “': '공유: “', 'across': '범위',
  'Any': '전체', 'Due Soon': '마감 임박', 'No Due Date': '마감일 없음',
  'Has conflicts': '충돌 있음', 'Most conflicts': '충돌 많은 순',
  'Just Now': '방금', 'Viewer': '뷰어', 'Admin': '관리자', 'Developer': '개발자', 'Designer': '디자이너',
  'Design System': '디자인 시스템', 'Component': '컴포넌트', 'Buttons': '버튼', 'Inputs': '입력',
  'Chips': '칩', 'Surfaces': '표면', 'Controls': '컨트롤', 'Navigation': '탐색',
  'Primary Button': '기본 버튼', 'Secondary Button': '보조 버튼', 'Icon Button': '아이콘 버튼',
  'Search Field': '검색 필드', 'Text Field': '텍스트 필드', 'Status Chip': '상태 칩', 'Tag': '태그',
  'Card': '카드', 'Media Card': '미디어 카드', 'Toggle': '토글', 'Avatar': '아바타', 'Tab Bar': '탭 바',
  'Viewing profile': '프로필 보기', 'Signed out': '로그아웃됨', 'Project created': '프로젝트 생성됨',
  'Team created': '팀 생성됨', 'Figma file linked': 'Figma 파일 연결됨', 'Nothing to import.': '가져올 항목이 없습니다.',
  'Restored this version': '이 버전 복원됨', 'Checkpoint archived': '체크포인트 보관됨',
  'Checkpoint restored to History': '체크포인트를 기록에 복원했습니다', 'Rolled back to checkpoint': '체크포인트로 되돌렸습니다',
  "Can't archive the entry you're currently on — roll back to a different one first.": '현재 적용 중인 항목은 보관할 수 없습니다. 먼저 다른 체크포인트로 되돌리세요.',
  'e.g. Alex Kim': '예: 김민수', 'e.g. Checkout Redesign': '예: 결제 화면 리디자인', 'e.g. Design Team': '예: 디자인 팀',
  'Focus Editor': '편집기 집중', 'Design Review': '디자인 검토', 'Debug': '디버그',
  'Default workspace': '기본 워크스페이스', 'Balanced layout for everyday work': '일상 작업을 위한 균형 잡힌 배치',
  'Bring the terminal into focus': '터미널에 집중', 'Loading…': '불러오는 중…', 'Loading...': '불러오는 중...',
})

Object.assign(ko, docsHistoryKo)

Object.assign(ko, {
  'Open design preview': '디자인 미리보기 열기',
  'Design preview': '디자인 미리보기',
  'Current mock design · Not an activity snapshot': '현재 샘플 디자인이에요. 활동 당시의 화면과는 다를 수 있어요.',
  'Checkout - Payment step': '결제 화면',
  'Button · Size': '버튼 · 크기',
})
