import { docsHistoryKo } from './docsHistoryKo'

// UI copy and seeded conflict-review content shown to Korean-language users.
// Source code, file paths and identifiers remain unchanged.
export const ko = Object.fromEntries(`
Code changes are available in the review panel.|코드 변경 내역은 검토 패널에서 확인할 수 있습니다.
Stop generating|답변 생성 중지
Follow|화면 따라가기
Stop following|따라가기 중지
Let’s review the Place order button together. Compare its height and color with the checkout design, adjust the style, then request a review.|주문 버튼을 디자인에 맞게 다듬어볼까요? Place order 버튼의 높이와 색상을 비교하고, 스타일을 수정한 뒤 검토를 요청할 수 있어요. 아래 질문을 선택하면 순서대로 안내해드릴게요.
Let’s check the shared Button height. Compare the code with the design token, review the affected screens, then check the saved version after merging.|공통 버튼의 높이가 디자인 시스템 기준과 맞는지 확인해볼까요? Button 코드를 높이 토큰에 맞게 수정하고, 다른 화면에 미치는 영향도 살펴보세요. 검토와 병합을 마친 뒤에는 저장된 버전까지 확인할 수 있어요.
All members|전체 구성원
Overview|개요
Diff|변경 내용
Detected|감지됨
Screens|영향 화면
Project|프로젝트
Reply|답글
Dashboard|대시보드
You're a required reviewer|필수 검토자로 지정됨
Applied to the code|코드에 적용됨
Keep Original Design|원본 디자인 값 유지
Take Current Implementation|현재 구현 값 사용
Accessibility|접근성
Refresh Explorer|탐색기 새로고침
New File...|새 파일…
New Folder...|새 폴더…
Quick diff|빠른 비교
Drag to reorder|끌어서 순서 바꾸기
Share project|프로젝트 공유
Documentation|문서
Archived|보관됨
Indigo 500|인디고 500
Violet 500|바이올렛 500
Height token|높이 토큰
hard-coded h-9|하드코딩된 h-9
Step 3 of 3 · Payment|3/3단계 · 결제
2 items · $128.00|상품 2개 · $128.00
Standard shipping · 3–5 days|일반 배송 · 3~5일
Total $128.00|합계 $128.00
Total|합계
Small|작게
Checkout design specifies button.height.lg = 44px|결제 화면 디자인은 button.height.lg = 44px를 지정합니다
Design system size/md = 40px|디자인 시스템 size/md = 40px
Use the shared token|공용 토큰을 사용합니다
Visual refresh of the checkout flow — payment step layout, button and card styling kept in sync with the Figma design.|결제 플로우의 비주얼 리뉴얼입니다 — 결제 단계 레이아웃, 버튼과 카드 스타일을 Figma 디자인과 동기화된 상태로 유지합니다.
Shared components and design tokens used across every product surface, kept consistent between Figma and code.|모든 제품 화면에서 쓰이는 공용 컴포넌트와 디자인 토큰입니다. Figma와 코드 간 일관성을 유지합니다.
Issue summary|이슈 요약
Review impact|검토 필요 이유
Proposal|제안
Why|이유
Expected result|예상 결과
Radius & weight|반경·굵기
Taylor’s draft|Taylor의 시안
Alex’s draft|Alex의 시안
Jordan’s draft|Jordan의 시안
More drafts:|추가 시안:
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
Place order button|Place order 버튼
Editing button sizes in tokens.json|tokens.json에서 버튼 크기 편집 중
Reviewing Order summary in Checkout|결제 화면에서 Order summary 검토 중
Reviewing color tokens in tokens.json|tokens.json에서 색상 토큰 검토 중
Editing Order summary card in Checkout|결제 화면에서 주문 요약 카드 편집 중
Viewing the Checkout payment screen|결제 화면 보는 중
Editing md size in Button.jsx|Button.jsx에서 md 크기 편집 중
Checking --button-height-md in tokens.css|tokens.css에서 --button-height-md 확인 중
Reviewing size tokens in tokens.css|tokens.css에서 size 토큰 검토 중
Viewing compact Button|Small 버튼 보는 중
Reviewing the Button height conflict|Button 높이 충돌 검토 중
Commenting on --button-height-md in tokens.css|tokens.css의 --button-height-md에 댓글 작성 중
Marketing Site Refresh|마케팅 사이트 리뉴얼
size="lg" and the primary token replace the fixed violet hex|size="lg"와 primary 토큰이 고정된 violet hex를 대체합니다
md size uses --button-height-md instead of h-9|md 크기가 h-9 대신 --button-height-md를 사용합니다
Button padding set to 12px 24px (px-6 py-3)|Button 패딩을 12px 24px(px-6 py-3)로 설정
Primary button background set to the sky accent|기본 버튼 배경을 sky 강조색으로 설정
Inputs move from 10px to the 12px design system padding.|Input 패딩이 10px에서 디자인 시스템 기준인 12px로 바뀝니다.
The lg radius step becomes 12px so cards and sheets share one curve.|lg 반경 단계가 12px가 되어 카드와 시트가 같은 곡률을 공유합니다.
Form gaps move from 6px to 8px to stay on the 4/8 spacing scale.|폼 간격이 4/8 간격 스케일에 맞춰 6px에서 8px로 바뀝니다.
--primary points at the brand token instead of a hard-coded hex.|--primary가 하드코딩된 hex 대신 브랜드 토큰을 가리킵니다.
Switch user|사용자 전환
Team activity|팀 활동
Voice chat|음성 채팅
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
Workspace data|워크스페이스 데이터
Reset workspace data|워크스페이스 데이터 초기화
Reset all drafts, reviews and history for every project?|모든 프로젝트의 초안, 검토와 히스토리를 초기화할까요?
Changes could not be saved|변경 사항을 저장하지 못했습니다
Storage is unavailable or full. Changes remain in this tab; allow browser storage before refreshing.|저장 공간을 사용할 수 없거나 가득 찼습니다. 변경 내용은 이 탭에 남아 있습니다. 새로고침 전에 브라우저 저장소를 허용하세요.
Reset failed. Allow access to browser storage and try again.|초기화하지 못했습니다. 브라우저 저장소 접근을 허용한 뒤 다시 시도하세요.
Close|닫기
Cancel|취소
Current|현재
Files|파일
Status|상태
Preview|미리보기
History|히스토리
Design|디자인
Done|완료
Send|보내기
Review|검토
Projects|프로젝트
Rollback here|여기로 되돌리기
AI edit|AI 편집
Rollback|롤백
Conflict detected|충돌 감지됨
All kinds|전체 종류
All files|모든 파일
No checkpoints match this filter.|이 필터에 맞는 체크포인트가 없습니다.
No checkpoints yet.|아직 체크포인트가 없습니다.
No matching checkpoints.|일치하는 체크포인트가 없습니다.
— every other checkpoint is filtered out of this playback.|— 나머지 체크포인트는 이 재생에서 제외됩니다.
Every checkpoint across every file in this project, oldest to newest. Filter by kind or file from the History drawer.|이 프로젝트의 모든 파일에 걸친 체크포인트를 오래된 순서로 보여줍니다. 히스토리에서 종류나 파일로 걸러 볼 수 있습니다.
Compare latest|최신 버전과 비교
Merge Studio|병합 스튜디오
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
Resolved|해결됨
High|높음
Medium|보통
Low|낮음
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
Last week|지난 주
This month|이번 달
Earlier|이전 히스토리
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
Restore to History|히스토리로 복원
Bring designs, code and data into|디자인, 코드와 데이터 가져오기
Delete|삭제
Forward|앞으로
Agent checkpoints (History)|에이전트 체크포인트 (히스토리)
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
Proposed · not applied|제안됨 · 적용 전
Needs your approval|승인 필요
Discarded|취소됨
Apply change|변경 적용
Discard|취소
Auto-apply AI changes without asking first|AI 변경 사항을 묻지 않고 자동으로 적용합니다
AI changes wait for your approval before they apply|AI가 제안한 변경 사항은 승인해야 적용됩니다
ready for review|검토 대기
Upload files|파일 업로드
Width|너비
Label|레이블
Version History|버전 히스토리
Checkpoint ·|체크포인트 ·
Play history|히스토리 재생
Version|버전
Rollback to checkpoint|체크포인트로 되돌리기
Code files|코드 파일
Code Editor|코드 편집기
Canvas|캔버스
AI Chat|AI 채팅
Layers|레이어
Bottom panel|하단 패널
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
Archive to history|히스토리에 보관
Changes to the design system are written up as documentation, then recorded in the project's history.|디자인 시스템 변경을 문서로 작성한 뒤 프로젝트 히스토리에 보관합니다.
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
Compared with the previous step ·|이전 단계와 비교 ·
This version|이 버전
Latest|최신
Previous step|이전 단계
lines|줄
Restore this version|이 버전 복원
No code changes between this version and the latest.|이 버전과 최신 버전 사이에 코드 변경이 없습니다.
No code changes from the previous step.|이전 단계와 비교해 코드 변경이 없습니다.
Other changes|기타 변경
Resize code and canvas|코드와 캔버스 크기 조절
Canvas version|캔버스 버전
Preview props|미리보기 속성
History playback|히스토리 재생
Pause playback|재생 일시 정지
Pause|일시 정지
Previous version|이전 버전
Previous version (←)|이전 버전 (←)
Next version|다음 버전
Next version (→)|다음 버전 (→)
Current version|현재 버전
Restore to here|여기까지 복원
Always|항상
Your work goes back to how it was at this checkpoint, saved as a new checkpoint on top — nothing after it is erased.|작업을 이 체크포인트 당시로 복원하고 새 체크포인트로 저장합니다. 이후 히스토리는 삭제하지 않습니다.
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
I couldn’t apply this change. Try rephrasing the request, or edit the target directly in Assemble.|이 변경 사항을 적용하지 못했습니다. 요청을 다르게 표현해보거나 조합에서 대상을 직접 편집하세요.
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
Follow me|나를 따라가기
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
drifts resolved|Drift 해결
design ·|디자인 ·
Detected drifts|감지된 Drift
Collapse|접기
Show property diffs|속성 차이 표시
Not resolved yet|아직 해결되지 않음
All properties resolved|모든 속성 해결됨
Incoming|들어오는 변경
Edit this line directly in the code window.|코드 창에서 이 줄을 직접 편집하세요.
Open a drift to compare and resolve its properties right here.|Drift를 열어 속성을 비교하고 바로 해결하세요.
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
Comment #1|댓글 #1
Comment #2|댓글 #2
Comment #11|댓글 #11
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
This drift has no design element — its change is in the code below.|이 Drift는 디자인 요소와 관련이 없습니다. 아래 코드에서 확인하세요.
Output files|출력 파일
Needs at least one reviewer|검토자가 한 명 이상 필요합니다
Not required|필수 아님
Add|추가
Deploys automatically once approved and merged|승인 및 병합 후 자동 배포
Auto-deploy is off — deploy manually after merge|자동 배포가 꺼져 있습니다. 병합 후 수동으로 배포하세요
” is open and waiting for approval.|’ 검토가 열려 승인 대기 중입니다.
Merge changes|변경 사항 병합
Required approvals|필수 승인
Approve|승인
Merge approved changes|승인된 변경 병합
Generating…|생성 중…
AI generating…|AI 생성 중…
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
Open a merge item|병합 항목 열기
Step through drifts|Drift를 순서대로 살펴보기
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
Version history|버전 히스토리
No changes yet — pick or edit values, edit code, assemble blocks, or annotate.|아직 변경이 없습니다. 값을 선택하거나 편집하고, 코드를 수정하거나 블록을 조합하거나 주석을 추가하세요.
Edits|편집 사항
Jump to element|요소로 이동
Undo this change|이 변경 취소
Incoming from the Current Implementation|현재 구현에서 들어오는 변경
Incoming changed lines|들어오는 변경된 줄
Changes log|변경 히스토리
Design changes|디자인 변경
Close preview|미리보기 닫기
Apply with AI|AI로 적용
Previous drift|이전 Drift
Drift|Drift
Next drift|다음 Drift
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
Add files — start a merge item from your project's files|파일 추가 · 프로젝트 파일로 병합 항목 만들기
Add files|파일 추가
Start a merge item from|다음 파일로 병합 항목 만들기
Find files…|파일 찾기…
Designer|디자이너
Developer|개발자
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
Continue with saved merge work|저장된 병합 작업 계속하기
No saved merge work|저장된 병합 작업이 없습니다
Start a new merge from the currently open files to begin.|현재 열린 파일로 새 병합을 시작하세요.
Open saved merge work|저장된 병합 작업 열기
Merge Studio opens your current saved merge work.|Merge Studio에서 현재 저장된 병합 작업을 엽니다.
Start a new merge|새 병합 시작
Use the Merge Studio menu to start with currently open files.|Merge Studio 메뉴에서 현재 열린 파일로 새 병합을 시작하세요.
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
Applied after required approvals and merge|필수 승인 후 병합 시 적용
All|전체
Open|미해결
Pending merge|병합 대기
Needs your review|내 검토 필요
Reviewers|검토자
Checkout Redesign|결제 화면 개편
Design System v2|디자인 시스템 v2
Mobile Nav Revamp|모바일 내비게이션 개편
Onboarding Flow|온보딩 흐름
Implemented the button in PlaceOrderButton.jsx|PlaceOrderButton.jsx에 버튼을 구현했습니다
Opened a second draft of the Order summary card|주문 요약 카드의 두 번째 초안을 열었습니다
Button|버튼
40px (size/md)|40px (size/md)
36px (h-9)|36px (h-9)
--button-height-md|--button-height-md
none — hard-coded|없음 — 하드코딩
12px (custom)|12px (사용자 지정)
8px (rounded-lg)|8px (rounded-lg)
44px|44px
24px|24px
20px|20px
button.height.lg = 44|button.height.lg = 44
color.primary|color.primary
16px radius and 700 title weight|모서리 반경 16px 및 제목 두께 700
Button / Padding|버튼 / 안쪽 여백
Design System|디자인 시스템
Checkout|결제
Navigation|내비게이션
Height & color|높이 및 색상
Title weight|제목 두께
normal|기본값
border (token)|border 토큰
slate-200|slate-200
0.025em (tracking-wide)|0.025em (tracking-wide)
Button (DesignCanvas.jsx)|Button (DesignCanvas.jsx)
Button · Frame 1 (Figma)|Button · 프레임 1 (Figma)
Frame 1 · Button (Figma)|프레임 1 · 버튼 (Figma)
Design frame padding (12px 24px) does not match code button padding (8px 16px).|디자인 프레임의 안쪽 여백(12px 24px)이 코드 버튼의 여백(8px 16px)과 다릅니다.
Ask Devsign to apply the padding fix — it will update the button className to px-6 py-3 to match the design frame.|Devsign에 여백 수정을 요청하세요. 디자인 프레임에 맞게 버튼 className을 px-6 py-3으로 변경합니다.
Fix the button padding to match the design frame|버튼 여백을 디자인 프레임에 맞추기
Approved · Pending merge|승인됨 · 병합 대기
Merged|병합 완료
No conflicts|충돌 없음
Button / Height|버튼 / 높이
Merge conflict · DesignCanvas.jsx|병합 충돌 · DesignCanvas.jsx
Card / Radius|카드 / 모서리 반경
Nav Icon / Size|내비게이션 아이콘 / 크기
Color token drift|색상 토큰 불일치
Input / Padding|입력 필드 / 안쪽 여백
Spacing scale mismatch|간격 단위 불일치
Divider / Color|구분선 / 색상
Label / Letter spacing|레이블 / 자간
Icon / Stroke width|아이콘 / 선 두께
Place order button · Height & color|주문 버튼 · 높이 및 색상
Order summary card · Radius & weight|주문 요약 카드 · 모서리 반경 및 글자 두께
the shared Button component — a height change reaches every screen that uses it.|공용 Button 컴포넌트의 높이 변경으로, 이를 사용하는 모든 화면에 영향을 줍니다.
a merge conflict — both branches edited the same lines, so one side’s change could be lost.|병합 충돌입니다. 두 브랜치가 같은 줄을 수정해 한쪽 변경 사항이 사라질 수 있습니다.
a corner radius on the Card container; no layout or behavior change.|Card 컨테이너의 모서리 반경 변경으로, 레이아웃이나 동작에는 영향이 없습니다.
the tab bar icons appear on every mobile screen.|탭 바 아이콘이 모든 모바일 화면에 표시됩니다.
one color token value; components keep reading the same token.|색상 토큰 값 하나의 변경이며, 컴포넌트는 동일한 토큰을 계속 사용합니다.
2px of horizontal padding inside the Input component.|Input 컴포넌트 안쪽의 가로 여백이 2px 달라집니다.
form spacing on the checkout — visible, but no behavior change.|결제 화면의 폼 간격 차이로, 눈에 보이지만 동작에는 영향이 없습니다.
a divider color on the order summary; no layout or behavior change.|주문 요약 구분선의 색상 변경으로, 레이아웃이나 동작에는 영향이 없습니다.
letter spacing on payment field labels; no layout or behavior change.|결제 입력란 레이블의 자간 차이로, 레이아웃이나 동작에는 영향이 없습니다.
icon stroke weight on the shipping options; no layout or behavior change.|배송 옵션 아이콘의 선 두께 차이로, 레이아웃이나 동작에는 영향이 없습니다.
a visible size and color change on the checkout’s main call to action. Styling only — no payment logic or data changes.|결제 화면의 주요 버튼 크기와 색상이 달라집니다. 스타일만 변경되며 결제 로직이나 데이터에는 영향이 없습니다.
a visible style choice on the checkout’s order summary card — no logic or data changes either way.|결제 화면의 주문 요약 카드 스타일 선택으로, 어느 쪽을 선택해도 로직이나 데이터에는 영향이 없습니다.
Button height in code (36px) drifts from the design system token (40px).|코드의 버튼 높이(36px)가 디자인 시스템 토큰(40px)과 다릅니다.
Merge conflict between local and remote branch (lines 9-14).|로컬과 원격 브랜치의 9~14번째 줄에서 병합 충돌이 발생했습니다.
Card corner radius (8px) is smaller than the design system radius (12px).|카드 모서리 반경(8px)이 디자인 시스템 기준(12px)보다 작습니다.
Nav icons render at 20px in code but 24px in the redesigned nav frame.|코드에서는 내비게이션 아이콘이 20px로 표시되지만, 새 디자인 프레임에서는 24px입니다.
Primary color in code (#5B5BD6) drifted from the brand token (#5E6AD2).|코드의 기본 색상(#5B5BD6)이 브랜드 토큰(#5E6AD2)과 다릅니다.
Input horizontal padding (10px) differs from the design system (12px).|입력 필드의 가로 안쪽 여백(10px)이 디자인 시스템 기준(12px)과 다릅니다.
Checkout spacing uses a 6px step that is not on the 4/8 spacing scale.|결제 화면 간격에 4/8 단위에 없는 6px 값이 사용되고 있습니다.
The order summary divider uses slate-200 instead of the border token.|주문 요약 구분선에 border 토큰 대신 slate-200이 사용되고 있습니다.
Field labels use tracking-wide; the design system label style has normal tracking.|필드 레이블에 tracking-wide가 적용되어 있습니다. 디자인 시스템에서는 기본 자간을 사용합니다.
Shipping option icons render at stroke 2.5; the icon set is drawn at 2.|배송 옵션 아이콘의 선 두께는 2.5지만, 아이콘 세트 기준은 2입니다.
The Place order button is 40px tall with a fixed violet background (#7c3aed). The Checkout design uses the 44px large button and the primary color token.|주문 버튼은 높이가 40px이고 보라색 배경(#7c3aed)이 고정되어 있습니다. 결제 디자인은 높이 44px의 large 버튼과 기본 색상 토큰을 사용합니다.
Three drafts of the Order summary card are open side by side — Taylor’s, Alex’s and Jordan’s disagree on corner radius and title weight.|주문 요약 카드 초안 세 개가 나란히 열려 있습니다. Taylor, Alex, Jordan의 초안은 모서리 반경과 제목 글자 두께가 서로 다릅니다.
Buttons render 4px shorter than the design system’s medium size.|버튼 높이가 디자인 시스템의 medium 크기보다 4px 낮습니다.
Without the merged version, frames either lose their selection handler or their stable key.|병합하지 않으면 프레임에서 선택 핸들러나 안정적인 key 중 하나가 누락됩니다.
Cards look slightly sharper than the rest of the design system.|카드 모서리가 디자인 시스템의 다른 요소보다 조금 더 각져 보입니다.
Tab icons read smaller than the redesigned tab bar; the 44px tap area stays the same.|탭 아이콘이 새 탭 바보다 작아 보이지만, 44px 터치 영역은 유지됩니다.
The primary color is a slightly different shade from the brand color.|기본 색상이 브랜드 색상과 미세하게 다릅니다.
Input text sits 2px closer to the edge than in the design.|입력 텍스트가 디자인보다 가장자리에 2px 더 가깝습니다.
Form fields sit 2px closer together than the 8px spacing scale.|폼 필드 사이 간격이 8px 단위보다 2px 좁습니다.
The fixed color will not follow theme changes.|고정 색상은 테마 변경을 반영하지 않습니다.
Field labels read slightly wider-spaced than the rest of the form.|필드 레이블의 자간이 폼의 다른 텍스트보다 약간 넓습니다.
Shipping icons look heavier than the rest of the icon set.|배송 아이콘 선이 아이콘 세트의 다른 아이콘보다 굵어 보입니다.
The button is 4px shorter than the design’s large button, and its fixed violet color won’t follow theme changes.|버튼 높이가 디자인의 large 크기보다 4px 낮고, 고정된 보라색은 테마 변경을 반영하지 않습니다.
Picking one draft keeps the Order summary card consistent with the rest of the checkout’s cards.|초안 하나를 선택하면 주문 요약 카드가 결제 화면의 다른 카드와 일관된 스타일을 유지합니다.
Every other card on this screen already uses a 16px radius and a 700-weight title.|이 화면의 다른 카드는 모두 모서리 반경 16px와 글자 두께 700을 사용합니다.
Buttons|버튼
Checkout · Payment step|결제 · 결제 단계
Onboarding · Welcome|온보딩 · 환영 화면
Settings · Profile|설정 · 프로필
Checkout · Shipping step|결제 · 배송 단계
Order summary|주문 요약
Three open drafts on the same element|같은 요소에 열린 초안 3개
Devsign design ↔ code sync|Devsign 디자인 ↔ 코드 동기화
Pushed new changes to Button.jsx|Button.jsx에 새 변경 사항을 푸시했습니다
DesignCanvas|디자인 캔버스
DesignCanvas.jsx|DesignCanvas.jsx
Card|카드
BottomNav|하단 내비게이션
Input|입력 필드
CheckoutForm|결제 폼
OrderSummary|주문 요약
PaymentForm|결제 폼
PlaceOrderButton|주문 버튼
Height|높이
Token|토큰
key prop|key 속성
onSelect handler|onSelect 핸들러
frame.id (preserved)|frame.id (유지됨)
missing — merge conflict|누락됨 — 병합 충돌
kept from local branch|로컬 브랜치에서 유지
duplicated across branches|두 브랜치에 중복됨
Radius|모서리 반경
Icon size|아이콘 크기
Hit area|터치 영역
Primary|기본 색상
Padding X|가로 안쪽 여백
Field gap|필드 간격
Divider|구분선
Tracking|자간
Stroke|선 두께
44px (button.height.lg)|44px (button.height.lg)
40px (default size)|40px (기본 크기)
Background|배경
color.primary (Indigo 500)|color.primary (인디고 500)
#7c3aed (fixed hex)|#7c3aed (고정 색상)
16px (Alex’s draft)|16px (Alex 초안)
12px (Taylor’s draft)|12px (Taylor 초안)
700 (Alex’s draft)|700 (Alex 초안)
600 (Taylor’s draft)|600 (Taylor 초안)
Checkout · Payment step (Figma)|결제 · 결제 단계 (Figma)
Button · Size/MD (Figma)|Button · 크기/MD (Figma)
Card · Default (Figma)|카드 · 기본값 (Figma)
Nav · Tab bar (Figma)|내비게이션 · 탭 바 (Figma)
Color · Primary (Figma)|색상 · 기본값 (Figma)
Input · Default (Figma)|입력 필드 · 기본값 (Figma)
Checkout · Form (Figma)|결제 · 폼 (Figma)
Checkout · Summary (Figma)|결제 · 요약 (Figma)
Checkout · Payment (Figma)|결제 · 결제 단계 (Figma)
Checkout · Shipping (Figma)|결제 · 배송 (Figma)
Light theme|라이트 테마
Dark theme|다크 테마
Continue|계속
Place order|주문하기
Card number|카드 번호
Order summary card|주문 요약 카드
The design system defines size/md as --button-height-md (40px); h-9 hard-codes 36px and bypasses the token.|디자인 시스템에서 size/md는 --button-height-md(40px)입니다. h-9는 36px을 고정해 토큰을 사용하지 않습니다.
Every Button renders 40px tall from --button-height-md.|모든 Button이 --button-height-md에 따라 높이 40px로 표시됩니다.
Swap the hard-coded h-9 for the size token so the button follows the design system height.|고정된 h-9 대신 크기 토큰을 사용해 버튼 높이를 디자인 시스템 기준에 맞추세요.
Both branches edited the frame-mapping block. Keep the remote's key prop change and reapply the local onSelect handler on top of it.|두 브랜치가 프레임 매핑 블록을 수정했습니다. 원격 브랜치의 key 속성 변경을 유지하고 그 위에 로컬 onSelect 핸들러를 다시 적용하세요.
Resolve the merge conflict in DesignCanvas.jsx|DesignCanvas.jsx의 병합 충돌 해결
Use the radius-lg token on the card container instead of rounded-lg.|카드 컨테이너에 rounded-lg 대신 radius-lg 토큰을 사용하세요.
Match the card radius to the design system|카드 모서리 반경을 디자인 시스템에 맞추세요
Bump the nav icon size to 24px and keep the 44px hit area.|내비게이션 아이콘을 24px로 키우고 44px 터치 영역은 유지하세요.
Resize the bottom nav icons to 24px|하단 내비게이션 아이콘을 24px로 조정
Point --primary at the brand token instead of the hard-coded hex.|고정된 HEX 값 대신 --primary가 브랜드 토큰을 참조하도록 바꾸세요.
Sync the primary color with the brand token|기본 색상을 브랜드 토큰과 동기화
Use px-3 on the input so it matches the 12px design padding.|입력 필드에 px-3을 적용해 디자인의 12px 여백에 맞추세요.
Fix the input padding to match the design system|입력 필드 여백을 디자인 시스템에 맞추세요
Replace gap-1.5 with gap-2 so the form sits on the 8px scale.|폼 간격을 8px 단위에 맞추도록 gap-1.5를 gap-2로 바꾸세요.
Align checkout spacing to the 8px scale|결제 화면 간격을 8px 단위에 맞추세요
Use border-border on the divider so it follows the theme.|테마를 따르도록 구분선에 border-border를 사용하세요.
Use the border token on the order summary divider|주문 요약 구분선에 border 토큰 사용
Drop tracking-wide from the field labels.|필드 레이블에서 tracking-wide를 제거하세요.
Remove the extra letter spacing from payment labels|결제 레이블의 추가 자간을 제거
Use the default stroke width on the shipping icons.|배송 아이콘에 기본 선 두께를 사용하세요.
Reset the shipping icon stroke width|배송 아이콘 선 두께를 기본값으로 되돌리기
Use the lg button size and remove the fixed background so the button uses the primary color token.|버튼에 lg 크기를 적용하고 고정 배경을 제거해 기본 색상 토큰을 사용하세요.
The Checkout design specifies the large primary button; the hard-coded hex bypasses the theme.|결제 디자인은 큰 기본 버튼을 지정하지만, 고정된 HEX 값은 테마를 따르지 않습니다.
Place order renders 44px tall in the primary color on the payment step.|결제 단계에서 주문 버튼이 기본 색상으로 높이 44px에 표시됩니다.
Use Alex’s draft — the 16px radius and 700 title weight match the rest of the checkout’s cards.|Alex의 초안을 사용하세요. 모서리 반경 16px와 제목 두께 700이 결제 화면의 다른 카드와 일치합니다.
One Order summary card style, used consistently across the checkout flow.|결제 흐름 전체에서 일관되게 사용하는 하나의 주문 요약 카드 스타일입니다.
Merged Button height to size token|Button 높이를 크기 토큰에 맞춰 병합
Merged Place order button size and color|주문 버튼의 크기와 색상 병합
Merged Order summary card style|주문 요약 카드 스타일 병합
I’ll sync this with the token file once the palette is finalized.|팔레트가 확정되면 토큰 파일에도 반영하겠습니다.
AI: divider color drifts from the border token in OrderSummary.jsx|AI: OrderSummary.jsx의 구분선 색상이 border 토큰과 다릅니다
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
Risk|위험도
Conflict details|충돌 상세
Checkpoints and rollbacks for this project are in History.|이 프로젝트의 체크포인트와 되돌리기는 히스토리에서 확인할 수 있습니다.
Open History|히스토리 열기
Open in Merge Studio|병합 스튜디오에서 열기
Edit or combine elements in Merge Studio before merging.|병합 전에 병합 스튜디오에서 요소를 편집하거나 조합하세요.
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
What your team is doing across every project. For one project's saved versions, open its Archive → History.|모든 프로젝트의 팀 활동입니다. 프로젝트의 저장된 버전은 보관함 → 히스토리에서 확인하세요.
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
Issue activity|이슈 활동
Change replay|변경 리플레이
No activity has been recorded for this issue yet.|이 이슈에 기록된 활동이 없습니다.
No replay snapshots are linked to this issue yet. Review and comment activity will still appear in the timeline.|아직 이 이슈에 연결된 리플레이 스냅샷이 없습니다. 검토 및 댓글 활동은 타임라인에 표시됩니다.
requested a review|검토를 요청했습니다
approved this change|변경을 승인했습니다
requested changes|변경을 요청했습니다
merged this change|변경을 병합했습니다
reopened this issue|이 이슈를 다시 열었습니다
pushed code changes|코드를 수정했습니다
commented on this issue|이 이슈에 댓글을 남겼습니다.
Merge the approved change|승인된 변경 병합
Assign reviewers|검토자 배정
Review and approve|검토 후 승인
Waiting on changes|변경 대기 중
Can't merge yet|아직 병합할 수 없습니다
Every required reviewer has to approve the latest changes first.|먼저 모든 필수 검토자가 최신 변경 사항을 승인해야 합니다.
Resolve the conflicting blocks in Merge Studio’s Check step first.|먼저 병합 스튜디오의 확인 단계에서 충돌 블록을 해결하세요.
Unresolved conflict markers remain in the code.|코드에 미해결 충돌 표시가 남아 있습니다.
This change is already merged.|이미 병합된 변경입니다.

Document updates|문서 업데이트
Document update|문서 변경사항
Approve update|변경사항 승인
Record in history|히스토리에 저장
Affected docs|관련 문서
Waiting for earlier updates|이전 변경사항 처리 대기
System changes from Conflict and Merge are automatically listed here for approval. Updates cover all project documents and are processed in order, then recorded in History.|충돌·병합에서 발생한 시스템 변경사항이 자동으로 등록됩니다. 모든 프로젝트 문서를 대상으로 순차 승인하고 히스토리에 기록합니다.
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
Work through Conflict Points → Diff → Merge Studio → Assemble → Merge Changes, in that order.|충돌 지점 → 차이 보기 → 병합 스튜디오 → 조합 → 변경 사항 병합 순서로 진행하세요.
**Follow these steps:**|**이렇게 진행해보세요:**
1. Open **Conflict Points** and select the \`Place order button\` issue.|1. **충돌 지점**에서 \`Place order 버튼\` 이슈를 선택하세요.
2. Read the summary, then open **Diff** to compare the 40px implementation with the 44px design.|2. 요약을 읽은 뒤 **차이 보기**를 열어 40px 구현과 44px 디자인을 비교하세요.
3. Open **Merge Studio**, select \`Place order\`, and use **Compare** to choose the design value.|3. **병합 스튜디오**를 열고 \`Place order\`를 선택한 뒤 **비교**에서 디자인 값을 선택하세요.
4. Use **Assemble** for further styling.|4. 스타일을 더 다듬고 싶으면 **조합**을 사용하세요.
5. Open **Merge Changes** to inspect the result and request review.|5. **변경 사항 병합**에서 결과를 확인하고 검토를 요청하세요.
Match Place order to design|주문 버튼을 디자인에 맞추기
Make the Place order button match the checkout design|Place order 버튼의 높이와 색상을 디자인에 맞춰주세요
What happens after my edit?|수정한 다음에는 뭘 해야 하나요?
What happens after my design edit?|버튼을 수정했어요. 다음에는 뭘 해야 하나요?
AI edits create a draft checkpoint — review and approval are required before it merges.|AI 수정은 초안 체크포인트를 만들어요 — 병합 전에 검토와 승인이 필요해요.
**What happens after an AI edit:**|**AI가 수정한 뒤에는 이렇게 진행돼요:**
- It creates a **draft** and a **History checkpoint** — it does not merge automatically.|- **초안**과 **히스토리 체크포인트**가 생성돼요 — 자동으로 병합되지 않아요.
- Inspect the visual comparison and code diff before approving.|- 승인하기 전에 비교 화면과 코드 차이를 확인하세요.
- **Request review** and collect the required approvals, then merge.|- **검토를 요청**하고 필요한 승인을 받은 뒤 병합하세요.
- Use **History** to inspect or roll back the saved checkpoint anytime.|- **히스토리**에서 저장된 버전을 언제든 확인하거나 되돌릴 수 있어요.
Guide me through code review|버튼 코드 검토 시작하기
Button / Height conflict → Diff → Merge Studio Compare → Merge Changes → review → merge.|Button / Height 충돌 → 차이 보기 → 병합 스튜디오 비교 → 변경 사항 병합 → 검토 → 병합 순서예요.
1. Open the **Button / Height** conflict from the project overview.|1. 프로젝트 홈에서 **Button / Height** 충돌을 여세요.
2. Inspect **Diff** — the implementation uses \`h-9\` while the design system requires the medium height token.|2. **차이 보기**를 확인하세요 — 현재 코드는 \`h-9\`를 쓰지만 디자인 시스템 기준은 medium 높이 토큰이에요.
3. Open **Workspace** to inspect the affected file, then use **Merge Studio Compare** to resolve the drift.|3. **워크스페이스**에서 관련 파일을 확인한 뒤 **병합 스튜디오 비교**로 차이를 해결하세요.
4. Review the resulting code in **Merge Changes**, assign reviewers, and request review.|4. **변경 사항 병합**에서 결과 코드를 확인하고 검토자를 지정해 검토를 요청하세요.
5. After approvals, merge and inspect **History**.|5. 승인을 받으면 병합하고 **히스토리**에서 확인하세요.
Use the size token for Button|버튼 높이에 토큰 적용하기
Use the size token for the Button height|Button의 높이에 디자인 시스템 토큰을 적용해주세요
Why use a shared token?|높이를 토큰으로 관리하는 이유
Why should the button use a shared token?|버튼 높이를 직접 지정하지 않고 토큰을 쓰는 이유가 뭔가요?
A shared Button token avoids fixing every screen separately — review affected screens before merging.|공유 Button 토큰을 쓰면 화면마다 따로 고치지 않아도 돼요 — 병합 전에 영향받는 화면을 확인하세요.
**Why use a shared token:**|**토큰을 공유해서 쓰는 이유:**
- A shared height token keeps every \`Button\` consumer aligned with the design system.|- 공유 높이 토큰을 쓰면 \`Button\`을 사용하는 모든 화면이 디자인 시스템과 맞춰져요.
- Replacing the hard-coded \`h-9\` avoids fixing each screen separately.|- \`h-9\`처럼 값을 직접 지정하면 화면마다 따로 고쳐야 해요.
- This is a **shared component** with wider impact than a single page edit — review the component diff and affected screens before merging.|- 여러 화면에 영향을 주는 **공용 컴포넌트**이니, 병합 전에 코드 차이와 영향받는 화면을 함께 확인하세요.
How do I verify and roll back?|변경 이력 확인하고 되돌리기
How do I verify and roll back the change?|수정한 내용을 확인하고 이전 상태로 되돌리려면 어떻게 하나요?
Verify in Merge Changes, then use History → Rollback if something looks wrong.|변경 사항 병합에서 확인한 뒤, 문제가 있으면 히스토리 → 롤백을 사용하세요.
**How to verify and roll back:**|**확인하고 되돌리는 방법:**
1. Check the final code and visual preview in **Merge Changes**.|1. **변경 사항 병합**에서 최종 코드와 미리보기를 확인하세요.
2. Note that **approval** and **merge** are separate steps.|2. **승인**과 **병합**은 별도의 단계예요.
3. Once merged, open **History**, select the new checkpoint, and inspect its changed files.|3. 병합 후에는 **히스토리**에서 새 체크포인트를 선택해 변경된 파일을 확인하세요.
4. Use **Rollback** to restore a previous checkpoint if the result is wrong.|4. 결과가 잘못됐다면 **롤백**으로 이전 체크포인트를 복원하세요.
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
  'drift': 'Drift', 'drifts': 'Drift', 'conflict': '충돌', 'conflicts': '충돌',
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
  'Checkpoint restored to History': '체크포인트를 히스토리에 복원했습니다', 'Rolled back to checkpoint': '체크포인트로 되돌렸습니다',
  "Can't archive the entry you're currently on — roll back to a different one first.": '현재 적용 중인 항목은 보관할 수 없습니다. 먼저 다른 체크포인트로 되돌리세요.',
  'e.g. Alex Kim': '예: 김민수', 'e.g. Checkout Redesign': '예: 결제 화면 리디자인', 'e.g. Design Team': '예: 디자인 팀',
  'Focus Editor': '편집기 집중', 'Design Review': '디자인 검토', 'Debug': '디버그',
  'Default workspace': '기본 워크스페이스', 'Balanced layout for everyday work': '일상 작업을 위한 균형 잡힌 배치',
  'Bring the terminal into focus': '터미널에 집중', 'Loading…': '불러오는 중…', 'Loading...': '불러오는 중...',
})

Object.assign(ko, docsHistoryKo)

Object.assign(ko, {
  'Merge Studio help': '병합 스튜디오 도움말',
  'Close help': '도움말 닫기',
  'Filter by status, conflict or due date.': '상태, 충돌 여부, 마감일로 병합 목록을 필터링하세요.',
  'Open an item, or add files to start a merge.': '항목을 열거나 파일을 추가해 병합을 시작하세요.',
  'Use ‹ › to review each visual change.': '‹ › 버튼으로 각 변경점을 확인하세요.',
  'Select a canvas element to compare values and edit styles or tokens in the Block Deck.': '캔버스 요소를 선택하면 블록 덱에서 값을 비교하고 스타일이나 토큰을 편집할 수 있어요.',
  'Click Merge Changes to check conflicts, preview changes and request a review.': '변경 사항 병합을 눌러 충돌을 확인하고, 변경 사항을 미리 본 뒤 검토를 요청하세요.',
})

Object.assign(ko, {
  'Open design preview': '디자인 미리보기 열기',
  'Design preview': '디자인 미리보기',
  'Current mock design · Not an activity snapshot': '현재 샘플 디자인이에요. 활동 당시의 화면과는 다를 수 있어요.',
  'Checkout - Payment step': '결제 화면',
  'Button · Size': '버튼 · 크기',
})

// New projects/merge items (Mobile Nav Revamp, Onboarding Flow and every
// Conflict Point now reachable from Merge Studio) and a Conflict/History
// translation sweep — every literal UI string these added or that the
// sweep found uncovered. "Drift" itself stays in English everywhere (see
// the `drift`/`drifts` fragment above) — nothing here touches that word.
Object.assign(ko, {
  'Design + Code': '디자인 + 코드',
  'ShippingOptions': '배송 옵션',
  'Onboarding': '온보딩',
  'Due tomorrow': '내일 마감',
  'Bottom navigation redesign — icon sizing and gesture affordances kept in sync between the Figma prototype and the app.':
    '하단 내비게이션 리디자인입니다 — 아이콘 크기와 제스처 요소를 Figma 프로토타입과 동기화된 상태로 유지합니다.',
  "First-run welcome screens and progress steps, kept in sync between the onboarding design and the app.":
    '첫 실행 시 보여지는 환영 화면과 진행 단계를 온보딩 디자인과 동기화된 상태로 유지합니다.',
  'Review impact & checks': '영향 및 검사 검토',
  'Hide quick diff': '빠른 비교 숨기기',
  'Review status': '검토 상태',
  'Summary': '요약',
  'No comments yet': '아직 댓글이 없습니다',
  'Cancel reply': '답글 취소',
  'Write a reply': '답글 작성',
  'Send reply': '답글 보내기',
  'Back to list': '목록으로 돌아가기',
  'Your decision': '내 결정',
  'Review merge impact and automated checks. This does not approve or merge the change.':
    '병합 영향과 자동 검사를 확인합니다. 이 동작은 변경 사항을 승인하거나 병합하지 않습니다.',
  'Review first': '먼저 검토하세요',
  'Remind': '알림 보내기',
  'Latest Design System token': '최신 디자인 시스템 토큰',
  'Uses updated token references': '최신 토큰 참조 사용',
  'DESIGN SYSTEM V2': '디자인 시스템 V2',
  'Original and merged': '원본 및 병합본',
  'This change is in code and has no design element.': '이 변경은 코드에만 있으며 디자인 요소가 없습니다.',
  'No design preview for this item.': '이 항목에는 미리 볼 디자인이 없습니다.',
  'Checks pass': '검사 통과',
  'Shown as “In review” in the Merge List': '병합 목록에 “검토 중”으로 표시됩니다',
  'Back to conflict list': '충돌 목록으로 돌아가기',
  'Merge complete': '병합 완료',
  'Merge steps': '병합 단계',
  'Changes already merged': '이미 병합된 변경 사항',
  'This item is complete. It can’t be submitted or merged again.': '이 항목은 이미 완료되어 다시 제출하거나 병합할 수 없습니다.',
  'Back to conflict': '충돌로 돌아가기',
  'Draft changes': '변경 초안',
  'Reviews': '검토',
  'Waiting': '대기 중',
  'AI draft': 'AI 초안',
  'Auto-deploy after merge': '병합 후 자동 배포',
  'Search project history': '프로젝트 히스토리 검색',
  'Search history...': '히스토리 검색...',
  'Clear history search': '히스토리 검색 지우기',
  'No matching archived checkpoints.': '일치하는 보관된 체크포인트가 없습니다.',
})

// The shared fallback History seed (initialHistoryEntries/OLDER_HISTORY in
// mockData.js) — used by any project with no History of its own
// (projectHistorySeeds), which used to mean it rarely showed up for a real
// project. Now that Mobile Nav Revamp and Onboarding Flow fall back to it
// too, it's a real project's actual History list, not background filler.
Object.assign(ko, {
  'Generated initial DesignCanvas scaffold': 'DesignCanvas 초기 뼈대 생성',
  'Scaffold a design canvas component': '디자인 캔버스 컴포넌트 뼈대 만들기',
  'Added frame mapping and Deselect button': '프레임 매핑과 Deselect 버튼 추가',
  'Render each frame and add a deselect button': '각 프레임을 렌더링하고 선택 해제 버튼 추가',
  'Set up the project and design tokens': '프로젝트와 디자인 토큰 설정',
  'Added the color palette tokens': '색상 팔레트 토큰 추가',
  'Add the brand palette as CSS variables': '브랜드 팔레트를 CSS 변수로 추가',
  'Imported the type scale from Figma': 'Figma에서 타이포그래피 체계 가져오기',
  'Created Button with primary and ghost variants': 'Primary·Ghost 버전의 Button 생성',
  'Create a Button with primary and ghost variants': 'Primary와 Ghost 버전을 가진 Button 만들기',
  'Button sizes sm / md / lg': 'Button 크기 sm / md / lg',
  'Input component with label and helper text': '레이블과 도움말 텍스트가 있는 Input 컴포넌트',
  'Build an Input with label and helper text': '레이블과 도움말 텍스트가 있는 Input 만들기',
  'Card component and elevation tokens': 'Card 컴포넌트와 고도(elevation) 토큰',
  'Merged feature/card-radius into main': 'feature/card-radius를 main에 병합',
  'Replaced hard-coded grays with surface tokens': '하드코딩된 회색을 surface 토큰으로 교체',
  'Replace hard-coded grays with surface tokens': '하드코딩된 회색을 surface 토큰으로 교체',
  'Focus rings on every interactive component': '모든 인터랙티브 컴포넌트에 포커스 링 적용',
  'Status chip and badge variants': 'Status Chip과 Badge 버전',
  'Add status chip variants: new, active, archived': '상태 칩 버전 추가: new, active, archived',
  'Navigation bar for the mobile frame': '모바일 프레임용 내비게이션 바',
  'Tab bar with active indicator': '활성 표시가 있는 Tab Bar',
  'Add a bottom tab bar with an active indicator': '활성 표시가 있는 하단 탭 바 추가',
  'Rolled back the tab bar animation': '탭 바 애니메이션 롤백',
  'Toggle switch with keyboard support': '키보드를 지원하는 토글 스위치',
  'Avatar and avatar group components': 'Avatar와 AvatarGroup 컴포넌트',
  'Create Avatar and AvatarGroup': 'Avatar와 AvatarGroup 만들기',
  'Dashboard card chart placeholder': '대시보드 카드 차트 자리표시자',
  'Spacing pass on the mobile frame (4/8 scale)': '모바일 프레임 간격 정리 (4/8 스케일)',
  'Align the mobile frame spacing to the 8px scale': '모바일 프레임 간격을 8px 단위에 맞추기',
  'Resolved merge conflict in DesignCanvas.jsx': 'DesignCanvas.jsx의 병합 충돌 해결',
  'Dark mode surface steps': '다크 모드 표면 단계',
  'Primary color moved to the brand token': '기본 색상을 브랜드 토큰으로 이전',
  'Point --primary at the brand token': '--primary가 브랜드 토큰을 가리키도록 변경',
  'Search input with icon slot': '아이콘 슬롯이 있는 검색 입력창',
  'Email input and validation states': '이메일 입력창과 검증 상태',
  'Add validation states to the email input': '이메일 입력창에 검증 상태 추가',
  'Follow chip and meta text on cards': '카드의 팔로우 칩과 메타 텍스트',
  'Merged design-system-v2 into release/1.4': 'design-system-v2를 release/1.4에 병합',
  'Hero card layout for the landing page with gradient background and chart': '그라데이션 배경과 차트가 있는 랜딩 페이지 히어로 카드 레이아웃',
  'Lay out the hero card with a gradient and a chart': '그라데이션과 차트가 있는 히어로 카드 배치',
  'Cleanup: removed unused tokens and dead styles': '정리: 사용하지 않는 토큰과 불필요한 스타일 제거',
  'Accessibility pass: labels and contrast': '접근성 점검: 레이블과 대비',
  'Fix missing labels and contrast issues': '누락된 레이블과 대비 문제 수정',
  'Prepared the canvas scaffold': '캔버스 뼈대 준비',
  'Scaffold review with the team': '팀과 함께 뼈대 검토',
})

Object.assign(ko, {
  'Zoom to 100%': '100%로 보기',
  'Zoom to Fit': '전체 맞춤',
  'Zoom to Selection': '선택 영역 맞춤',
})

Object.assign(ko, { 'Request review': '검토 요청 보내기', 'Awaiting approval': '승인 대기', 'Not requested': '요청 전', 'Continue to Check': '확인 단계로 이동' })

// Korean-mode sweep: UI copy that was still showing in English.
Object.assign(ko, {
  // Command palette
  'Views': '보기',
  'Go to': '이동',
  'Focus Editor': '에디터 집중',
  'Terminal Below': '터미널 아래',
  // Canvas tools (the shortcut key is kept by a rule in translate.js)
  'Move': '이동',
  'Hand tool': '손 도구',
  'Frame': '프레임',
  'Rectangle': '사각형',
  // Navigation / chrome
  'Drawer': '사이드 패널',
  'Project navigation': '프로젝트 메뉴',
  'Notifications alt+T': '알림 alt+T',
  'High priority notifications': '중요 알림',
  'Dismiss notification': '알림 닫기',
  // Layers
  'Toggle layer locking': '레이어 잠금 전환',
  'Toggle layer visibility': '레이어 표시 전환',
  // Conflict review
  'Summary': '요약',
  'Current implementation': '현재 구현',
  'Design reference': '디자인 기준',
  'Local branch': '로컬 브랜치',
  'Remote branch': '원격 브랜치',
  'AI draft': 'AI 초안',
  'Back to list': '목록으로',
  'Replay content': '재생 내용',
  'Hide quick diff': '빠른 비교 숨기기',
  // Assets
  'Show components': '컴포넌트 표시',
  // Editing a conflict's code in its review
  'Code updated': '코드를 수정했어요',
  'Open in editor': '에디터에서 열기',
  'Show changes only': '변경 부분만 보기',
  'Show full file': '전체 파일 보기',
  // Merge Studio's per-item AI Chat
  'Explain this change': '이 변경 설명해줘',
  'What’s left before merging?': '머지 전에 남은 일은?',
  'Draft a review request': '검토 요청 메시지 써줘',
  'Use as comment': '코멘트로 쓰기',
  'Values below are from before the merge.': '아래 값은 병합 전 상태예요.',
  // Reviewer removal / dismissing a change request
  'Request dismissed': '요청 무효화됨',
  'Dismiss request': '요청 무효화',
  'Dismiss change request…': '변경 요청 무효화…',
  'dismissed a change request': '변경 요청을 무효화했어요',
  // The review decision popover
  'Your review': '내 검토',
  'You can’t review your own change': '본인 변경은 검토할 수 없어요',
  'Author · not required': '작성자 · 승인 불필요',
  // Checks (run on their own; gate merging)
  'Checks': '검사',
  'Blocks merge': '병합 차단',
  'Decide them in Merge Studio’s Drifts tab — undecided ones ship the Current Implementation’s value.': '병합 스튜디오의 드리프트 탭에서 결정하세요 — 결정하지 않은 값은 현재 구현 값으로 병합돼요.',
  'Drifts': '드리프트',
  'Open a merge item to decide its drifts.': '머지 항목을 열어 드리프트를 결정하세요.',
  'Checks need attention — merging waits on them': '확인이 필요한 검사가 있어요 — 통과해야 병합할 수 있어요',
  // Batch approval
  'Review & approve': '확인 후 승인',
  'Check each change before approving them together.': '한꺼번에 승인하기 전에 각 변경을 확인하세요.',
  'No comments': '코멘트 없음',
  'Only low-risk changes can be batch-approved': '위험도 낮음 변경만 일괄 승인할 수 있어요',
  'Not waiting on review': '검토 대기 중이 아니에요',
  'Changes were requested — review it on its own': '변경 요청이 있어요 — 따로 검토하세요',
  'Has an unanswered comment — review it on its own': '답이 없는 코멘트가 있어요 — 따로 검토하세요',
  'Submit approval': '승인하기',
  'The change is good to merge.': '이대로 병합해도 좋아요.',
  'Something needs fixing before it merges.': '병합 전에 고쳐야 할 부분이 있어요.',
  'What needs to change? (required)': '무엇을 고쳐야 하나요? (필수)',
  'Leave a comment (optional)': '코멘트 남기기 (선택)',
  'Adjust in Merge Studio': '병합 스튜디오에서 조정',
  "Adjust the design in Merge Studio. This doesn't approve or merge the change.": '병합 스튜디오에서 디자인을 조정해요. 승인이나 병합은 되지 않아요.',
  'Approvals were reset — the change is back in review.': '승인이 초기화되어 다시 검토 단계로 돌아갔어요.',
  '⌘↵ to save · Esc to cancel. Saving resets any approvals — the change goes back to review.': '⌘↵ 저장 · Esc 취소. 저장하면 승인이 초기화되고 다시 검토 단계로 돌아가요.',
})
