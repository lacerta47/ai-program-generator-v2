# 마이페이지 설계

작성일: 2026-06-14

## 배경 / 목표
헤더 우측 신원 영역(닉네임)을 진입점으로, 로그인한 사용자가 **내 작품 · 별명 변경 · 계정 정보 · 오늘 사용량**을 한곳에서 보는 `/mypage`를 만든다. 메모(mypage-future-idea)의 실현. 초등 저학년, 방향 C.

## 결정 사항(확정)
- 단일 화면 `/mypage`(로그인 필수). 진입 = 헤더 `AuthButton`의 닉네임 클릭.
- 섹션: 내 작품 목록 + 별명 변경 + 계정 정보 + 오늘 사용량 (전부).
- 별명 변경 UI는 현재 `AuthButton`의 "별명 바꾸기" 모달을 **마이페이지로 이동**(헤더는 닉네임 표시·링크만).

## 진입 · 가드
- 신규 라우트 `app/mypage/page.tsx`(클라이언트).
- 로그인 가드: `useAuth()`의 `loading` 동안 로딩, **`!user` 면 토스트("로그인이 필요해요") + `/` 리다이렉트.** (개인 페이지)
- `AuthButton.tsx`: 닉네임 버튼을 `<Link href="/mypage">`로 교체(라벨=닉네임 또는 "별명 정하기", lucide `User` 아이콘). 기존 `editOpen` 모달·`saveNick`·`claimNickname` 로직은 제거(마이페이지로 이동). 닉네임 표시용 `getUserProfile`는 헤더에 유지.

## 섹션 1 — 계정 카드(상단)
- **닉네임**(크게) + **"별명 바꾸기"** 버튼 → 모달(`AuthButton`에서 이동한 그대로): `TextInput`(maxLength 20) + claimNickname + 15일 쿨다운 안내(`NICKNAME_COOLDOWN_DAYS`). 에러 매핑(`NicknameError`: taken/cooldown/profanity/reserved) 동일.
- **이메일 · 가입일** — `auth.currentUser.email`, `auth.currentUser.metadata.creationTime`(클라에서 바로, 추가 호출 없음).
- **오늘 사용량** `n/한도` — 신규 `GET /api/me/usage`. admin이면 "무제한".

### `GET /api/me/usage`(신규)
- `Authorization: Bearer <ID 토큰>` → `adminAuth.verifyIdToken` → uid·admin 판별. 토큰 없음/만료 → **401**.
- admin → `{ used: 0, limit: null, unlimited: true }`.
- 일반 → `used = usage/{uid}_{오늘KST}.count ?? 0`, `limit = readEffectiveLimit(uid)`, `{ used, limit, unlimited: false }`.
- *usage·config·limits는 admin 전용 컬렉션이라 클라가 못 읽음 → 이 자기-전용 라우트로 해결(다른 유저 노출·규칙 변경 없음).*

## 섹션 2 — 내 작품 그리드
- 신규 `fetchMyPosts(uid, limitN = 50)`(`lib/firebase/posts.ts`): `query(collection(posts), where('ownerUid','==',uid), orderBy('createdAt','desc'), limit(50))` → `Post[]`. (페이지네이션은 YAGNI — 저학년은 작품 수 적음. 50개 초과는 "최근 50개".)
- **새 복합 인덱스 `posts (ownerUid ASC, createdAt DESC)`** → `firestore.indexes.json`에 추가 + `firebase deploy --only firestore:indexes`. (posts read는 공개라 rules 변경 없음.)
- 작품 카드: 제목 · 날짜(`formatDate`) · ♥`likeCount`/`viewCount`/`forkCount`(>0일 때) + 인라인 액션:
  - **공유** = `sharePostUrl`, **다운로드** = `downloadProgram(code, title)`, **삭제** = `deletePost`(확인 후 목록에서 제거), **고치기** = `/?edit=${post.id}`(기존 Creator 편집 흐름).
- 상태: 로딩(`LoadingDots`) / 에러(친절 메시지 + 다시 시도) / 빈("아직 만든 작품이 없어요. 첫 작품을 만들어 볼까요?" + 만들기 링크).

## 데이터 계층 (신규/수정 요약)
- 신규: `app/mypage/page.tsx`, `app/api/me/usage/route.ts`, `lib/firebase/posts.ts`의 `fetchMyPosts`.
- 수정: `components/auth/AuthButton.tsx`(닉네임→링크, 별명 모달 제거), `firestore.indexes.json`(+인덱스, 배포).
- 재사용: `Modal`/`Button`/`TextInput`/`Label`/`LoadingDots`, `lib/client/postActions`(sharePostUrl, downloadProgram), `deletePost`, `claimNickname`/`getUserProfile`/`NicknameError`/`NICKNAME_COOLDOWN_DAYS`, `readEffectiveLimit`, `todayKeyKST`.

## 보안 · 성능
- `/api/me/usage`는 **본인 토큰으로 본인 데이터만** 반환(uid는 검증된 토큰에서). 다른 유저 조회 불가.
- 배포 주의: `/api/me/usage`도 Admin SDK라 프로덕션 자격증명 필요(기존과 동일).
- `fetchMyPosts`는 인덱스 필요(배포). 50개 제한으로 읽기 비용 한정.
- **헤더 닉네임 동기화(경미·수용)**: 마이페이지에서 별명을 바꾸면 마이페이지엔 즉시 반영되지만, 헤더 `AuthButton`의 라벨은 `user` 변경 시에만 재조회하므로 다음 로드/이동 시 갱신된다. 크로스컴포넌트 즉시 동기화는 과하니 하지 않는다.

## 검증 기준 (완료 정의)
1. 비로그인 `/mypage` → 토스트 + 홈 리다이렉트. 로그인 → 렌더.
2. 계정 카드: 닉네임·이메일·가입일·오늘 사용량(`n/한도`, admin 무제한) 표시.
3. 별명 바꾸기: 모달에서 변경 → 헤더·카드 반영, 쿨다운/중복/비속어/예약어 에러 동일.
4. 내 작품: **내 글만, 최신순**. 카드 액션(공유·다운로드·삭제·고치기) 동작. 빈 상태 표시.
5. `tsc` + 빌드 + 인덱스 배포. self-test: `fetchMyPosts`가 내 글만/최신순(다른 uid 글 제외) + `/api/me/usage`가 본인 used·limit 반환, 비로그인 401.
