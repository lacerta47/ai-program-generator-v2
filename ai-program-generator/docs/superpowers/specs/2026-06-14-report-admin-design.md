# 신고 기능 + 관리자 처리 화면 설계

작성일: 2026-06-14

## 배경 / 목표
저학년 공유 게시판의 안전장치. 비속어 필터로 못 거르는 부적절·악의 작품을 사용자가 **신고**하고, **관리자**가 검토해 삭제/무시한다. 신고 제출은 단순하게, 관리자 처리는 전용 화면으로.

## 결정 사항(확정)
- 관리자 화면 = **별도 라우트 `/admin`** (관리자 로그인 시에만 노출 — 코드 스플릿이라 일반 사용자 부담 0, 진짜 방어는 규칙).
- 신고 제출: 로그인 필수, 사용자당 작품 1회.
- 데이터: flat `reports` 컬렉션(비정규화 카운트 없음). 처리 = 신고 doc 삭제(상태 필드 없음).
- 헤더 배지 유지(관리자만, **세션당 1회** count 쿼리 — 처리 후 새로고침 전까진 숫자 그대로).
- 신고 사유: `나쁜 말` / `이상해요` / `불쾌해요` / `기타` + 선택 메모.

## 신고 제출 (UI)
- `PostPreview` 액션 줄에 신고 버튼(lucide `Flag`) — **남의 글에만** 노출(`currentUserUid !== post.ownerUid`). 비로그인 클릭 → `onNeedLogin()`(기존 likes에서 쓰던 prop 재사용).
- 클릭 → `ReportDialog`(공용 `Modal` 기반): 사유 택1(칩 4개) + 선택 메모(textarea, ≤500자) + "신고 보내기".
- 제출 → `submitReport` → 토스트 "신고했어요. 선생님이 확인할게요" + 닫기. 재신고는 자기 것 덮어쓰기.

## 데이터 모델 (`reports` 컬렉션)
- `reports/{postId}_{reporterUid}` = `{ postId, postTitle, postAuthorName, postOwnerUid, reporterUid, reason, memo?, createdAt }`
- doc id가 `postId_uid` → 1인 1회.

## Firestore 규칙 (+배포)
```
match /reports/{reportId} {
  allow read: if isAdmin();
  allow create, update: if isSignedIn()
    && request.resource.data.reporterUid == request.auth.uid
    && request.resource.data.keys().hasOnly(['postId','postTitle','postAuthorName','postOwnerUid','reporterUid','reason','memo','createdAt'])
    && request.resource.data.postId is string
    && request.resource.data.reason is string && request.resource.data.reason.size() <= 20
    && (!('memo' in request.resource.data) || (request.resource.data.memo is string && request.resource.data.memo.size() <= 500))
    && request.resource.data.createdAt is number;
  allow delete: if isAdmin();
}
```

## 데이터 계층 (`lib/firebase/reports.ts`, 신규)
- `submitReport(post, reporterUid, reason, memo?)` — `setDoc(reports/{post.id}_{reporterUid}, {...})`
- `fetchReports()` — `getDocs(reports)` → 전체(관리자). 배열 반환.
- `dismissReportsForPost(postId)` — `query(where('postId','==',postId))` → 각 삭제.
- `countReports()` — `getCountFromServer(reports)` (헤더 배지용).

## 관리자 화면 `/admin` (`app/admin/page.tsx`, 신규)
- 클라이언트 컴포넌트. `useAuth()`: `loading` 동안 대기, **`!isAdmin` 이면 토스트 + 홈 리다이렉트**(진짜 방어는 규칙).
- `fetchReports()` → **postId로 그룹핑** → 작품별 카드:
  - 제목 · 작성자(`postAuthorName`) · **신고 N건** · 사유 목록(+메모) · 신고 시각
  - **"작품 보기"** → `<a href="/board?post={postId}" target="_blank">` (새 탭, 큐 유지)
- 액션 2개(확인 모달):
  - **작품 삭제** — `deletePost(postId)` + `dismissReportsForPost(postId)` → 카드 제거
  - **신고 무시** — `dismissReportsForPost(postId)` → 카드 제거(작품 유지)
- 정렬: 신고 많은 순(client).
- 빈 상태: "처리할 신고가 없어요".

## 관리자 진입점 (`components/auth/AuthButton.tsx`)
- 기존 "관리자" 칩(현재 비클릭 라벨)을 **클릭 가능한 `/admin` 링크**로 만든다(별도 헤더 배지 신설 X — 기존 표시 재사용).
- 칩에 미처리 신고 수 표시: `관리자 · 신고 N`(N>0일 때). `useEffect`로 `countReports()` **세션 1회** 호출.
- 일반 사용자: **변화 없음**(닉네임 클릭 = 별명 바꾸기 그대로). "마이페이지"(닉네임 클릭 → 내 작품/설정/별명변경 통합)는 **별도 미래 기능**으로 분리.

## 범위 밖
- 신고 누적 카운트 비정규화(게시판 내 ⚠ 배지·정렬) — 필요해지면 like/view 패턴으로
- 신고 이력/감사 로그(처리 = 삭제라 이력 없음)
- 신고자 제재·자동 모더레이션

## 영향 파일
- 신규: `app/admin/page.tsx`, `lib/firebase/reports.ts`, `components/board/ReportDialog.tsx`
- 수정: `firestore.rules`(reports 규칙, 배포), `components/board/PostPreview.tsx`(신고 버튼+다이얼로그), `components/auth/AuthButton.tsx`(관리자 칩 → /admin 링크 + 신고 count)

## 검증 기준 (완료 정의)
1. 남의 글에 신고 버튼, 비로그인 클릭 → 로그인창. 로그인 후 사유+메모 신고 → reports 기록, 토스트.
2. 같은 사용자 재신고 → 덮어쓰기(중복 doc 없음).
3. 비관리자가 `/admin` 직접 진입 → 홈 리다이렉트 + 규칙이 reports 읽기 거부(빈 화면).
4. 관리자 `/admin` → 신고된 작품 카드, 작품 보기(새 탭), **삭제**(작품+신고 사라짐) / **무시**(신고만 사라짐).
5. 관리자 "관리자" 칩 클릭 → `/admin` 진입, 칩에 "신고 N" 표시.
6. `tsc` + 프로덕션 빌드 통과, 규칙 배포. 자체 통합테스트(custom token)로 신고 제출·관리자 읽기·삭제 + 규칙 거부 검증.
