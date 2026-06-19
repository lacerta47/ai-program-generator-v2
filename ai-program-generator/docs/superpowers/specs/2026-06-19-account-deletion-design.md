# 회원탈퇴(본인 계정 삭제) 설계

작성일: 2026-06-19 · 상태: 승인 대기

## 목표
로그인한 일반 회원이 마이페이지에서 **본인 계정과 모든 작품을 영구 삭제**할 수 있게 한다. 무분별 가입 차단(이메일 인증) 다음 단계로, "그만 쓰겠다"는 사용자가 스스로 정리할 수 있는 경로를 제공한다.

## 결정 사항
- **확인 강도**: `ConfirmDialog` 1회(기존 `ConfirmProvider`). 강한 문구 + danger 스타일. 재인증·타이핑 확인 없음(저학년·교사 마찰 최소화).
- **관리자 본인 탈퇴**: **차단**. 서버가 거부(403)하고, 버튼도 관리자에겐 숨김. 기존 `blockIfAdminTarget` 정책과 일관.
- **처리 위치**: **서버(Admin SDK)**. 본인 ID 토큰 검증 후 uid로 삭제 → Firebase `requires-recent-login` 재인증 플로우 불필요.
- **삭제 범위**: 관리자 삭제(`DELETE /api/admin/users/[uid]`)와 **동일** — `posts`(ownerUid)·`nicknames`(uid)·`users/{uid}`·`limits/{uid}` → 마지막에 Auth 계정.

## 아키텍처

### 1) 공유 서버 헬퍼 (DRY 추출)
현재 캐스케이드 삭제 로직이 `app/api/admin/users/[uid]/route.ts`의 `DELETE` 핸들러에 인라인으로 있다. 이를 서버 전용 헬퍼로 추출한다.

- **신규** `lib/server/deleteAccount.ts`:
  ```ts
  import { adminAuth, adminDb } from '@/lib/firebase/admin';

  /** uid의 모든 흔적을 삭제: Firestore(작품·닉네임·users·limits) 후 Auth 계정.
   *  Firestore를 먼저(중간 실패 시 고아 닉네임 방지), Auth를 마지막에. */
  export async function deleteAccountCascade(uid: string): Promise<void> {
    const refs: FirebaseFirestore.DocumentReference[] = [];
    const posts = await adminDb.collection('posts').where('ownerUid', '==', uid).get();
    posts.forEach((d) => refs.push(d.ref));
    const nicks = await adminDb.collection('nicknames').where('uid', '==', uid).get();
    nicks.forEach((d) => refs.push(d.ref));
    refs.push(adminDb.doc(`users/${uid}`));
    refs.push(adminDb.doc(`limits/${uid}`));
    for (let i = 0; i < refs.length; i += 450) {
      const batch = adminDb.batch();
      refs.slice(i, i + 450).forEach((r) => batch.delete(r));
      await batch.commit();
    }
    await adminAuth.deleteUser(uid);
  }
  ```
- **관리자 라우트 수정**: `DELETE /api/admin/users/[uid]`의 인라인 삭제 블록을 `await deleteAccountCascade(uid)` 호출로 교체(동작 동일, 중복 제거). `blockIfAdminTarget` 가드는 그대로 둔다.

### 2) 본인 탈퇴 API
- **신규** `DELETE /api/me/route.ts` (`runtime = 'nodejs'`):
  1. `Authorization: Bearer <idToken>` 없으면 401.
  2. `adminAuth.verifyIdToken(idToken)` → `uid`, `admin` 클레임. 실패 시 401("로그인이 만료됐어요…").
  3. `decoded.admin === true` 이면 403("관리자 계정은 탈퇴할 수 없어요.").
  4. `await deleteAccountCascade(uid)` → `{ ok: true }`. 실패 시 500("계정을 삭제하지 못했어요.").

### 3) 클라이언트 헬퍼
- **신규** `lib/client/account.ts`:
  ```ts
  import { auth } from '@/lib/firebase/client';

  export async function deleteMyAccount(): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('로그인이 필요해요.');
    const idToken = await user.getIdToken();
    const res = await fetch('/api/me', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || '계정을 삭제하지 못했어요.');
  }
  ```

### 4) 마이페이지 UI
`app/mypage/page.tsx`의 `AccountCard`(또는 페이지 하단)에 **"회원 탈퇴"** 버튼 추가.
- **관리자(`isAdmin`)에겐 렌더하지 않음**(차단 정책과 일관).
- 위치: 계정 카드 맨 아래, 다른 액션과 구분되게 작은 텍스트 버튼(`variant="ghost"`, danger 톤). 위에 얇은 구분선.
- 동작:
  1. `useConfirm({ title: '정말 탈퇴할까요?', message: '계정과 만든 작품이 모두 영구 삭제돼요. 되돌릴 수 없어요.', confirmLabel: '탈퇴', danger: true })`.
  2. 확인 시 `setBusy(true)` → `deleteMyAccount()`.
  3. 성공: `await signOut(auth)` → `router.replace('/')` → `toast('탈퇴가 완료됐어요. 그동안 고마웠어요.', 'success')`.
  4. 실패: `toast(에러 메시지)`, `setBusy(false)`.

## 데이터 흐름
마이페이지 "회원 탈퇴" → ConfirmDialog → `deleteMyAccount()` → `DELETE /api/me`(Bearer) → 토큰 검증·admin 차단 → `deleteAccountCascade(uid)`(Firestore 배치 → Auth) → 클라 `signOut` → 홈 이동 + 토스트.

## 에러 처리 / 엣지
- **관리자**: 서버 403 + 버튼 숨김(이중 방어).
- **토큰 만료**: 401 → 클라가 메시지 노출.
- **재인증 불필요**: 서버가 검증된 토큰의 uid로 Admin SDK 삭제하므로 `requires-recent-login` 미발생.
- **삭제 후 인증 상태**: `deleteUser`로 `onAuthStateChanged(null)`이 곧 발화하지만, 명시적 `signOut`+홈 이동으로 UI를 즉시 정리.
- **남는 흔적(의도)**: `usage/{uid}_{날짜}`(날짜 키 임시 카운터), 다른 글에 단 `likes`/`views` 서브문서, 본인이 낸 `reports` 는 삭제하지 않는다 — 관리자 삭제와 동일하며, 무해(삭제된 uid 참조)하고 경미. 범위 확대는 YAGNI.

## 검증
- `./node_modules/.bin/tsc --noEmit` + `npm run build` 통과.
- **self-test** `scripts/selftest-account-delete.mjs`(미커밋, 일회성):
  1. Admin SDK로 임시 계정 `createUser` + 해당 uid로 `posts`/`nicknames`/`users`/`limits` 더미 문서 시드.
  2. 임시 계정 ID 토큰 발급 → `DELETE /api/me` → 200.
  3. Auth `getUser`가 `auth/user-not-found` + 시드 문서들이 모두 사라졌는지 확인.
  4. admin 클레임 부여한 임시 계정 토큰 → `DELETE /api/me` → 403.
  - 종료 후 임시 계정/문서 정리.
- 브라우저: 관리자 로그인 상태에서 마이페이지에 **버튼이 안 보이는지** 확인(차단 UX). 실제 삭제 동작은 self-test로 검증(신규 일반계정 가입은 직접 수행 불가).

## 영향 파일
- 신규: `lib/server/deleteAccount.ts`, `app/api/me/route.ts`, `lib/client/account.ts`, `scripts/selftest-account-delete.mjs`(미커밋).
- 수정: `app/api/admin/users/[uid]/route.ts`(인라인 삭제 → 헬퍼 호출), `app/mypage/page.tsx`(회원탈퇴 버튼).
- 규칙/인덱스 변경 없음(서버 Admin SDK는 rules 우회). 배포 불필요.

## 범위 밖(다음 단계)
B(선생님 역할), C(학생/한도/게시판)는 별도 spec. 본 spec은 A만 다룬다.
