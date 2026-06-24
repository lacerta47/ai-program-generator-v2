# 학생 간편 로그인 (학교+학번+PIN) 설계

작성일: 2026-06-24 · 상태: 승인됨

## 목표
초등 저학년(7–10세) 학생이 긴 이메일·비밀번호 타이핑 없이 **학교 선택 + 학번 + 공용 PIN**으로 빠르게 로그인하게 한다. 발급·배포·로그인을 한 묶음으로 재설계하고, 동시접속을 막아(단일 세션) 사칭을 억제한다.

## 결정 (브레인스토밍 확정)
- 로그인 UI를 **일반/학생 양분**(LoginDialog 탭).
- **학교 = 교사 계정 1개**(admin 발급). 교사닉네임=학교명=게시판명. `schoolCode`로 식별.
- **학번 = `{학년}{반2}{번호2}`** 5자리 자동(예 `10101`). (학년 1–6, 반·번호 ≤99)
- **PIN = 반마다 1개, 6자리(=Firebase 계정 비밀번호 그대로)**. 별도 로그인 API 없이 클라가 이메일 조합 후 `signInWithEmailAndPassword`. Firebase 자체 throttle이 브루트포스 방어.
- **로그인 무결성 = 단일 세션**(학생 계정만): 나중 로그인이 이전을 밀어냄.
- 잔여위험(합의): 공용 PIN이라 *대상이 오프라인일 때* 사칭은 잔존. 단일세션은 *동시* 접속만 차단. 저위험 수용.

## 이메일 스킴
`{schoolCode}-{학번}@class.kr` — 예 `haetnim-10101@class.kr`. schoolCode 전역 유일 + 학번 학교 내 유일 → 전역 유일. schoolCode·학번 모두 `[a-z0-9-]`/숫자.

## 데이터 모델 델타
- `teachers/{uid}`: **+`schoolCode: string`**
- `schools/{schoolCode}` (신규, 공개읽기): `{ name: string, teacherUid: string }`
- `students/{uid}`: **+`schoolCode: string`, +`hakbun: string`(5자리)** (기존 teacherUid·name·limitType·limitValue·usedTotal 유지)
- `sessions/{uid}` (신규): `{ activeToken: string, updatedAt: timestamp }`

## 구성요소

### 1) rules (`firestore.rules`)
```
match /schools/{schoolCode} {
  allow read: if true;          // 학생 로그인 드롭다운 소스
  allow write: if false;        // 서버 Admin SDK만 생성
}
match /sessions/{uid} {
  allow read: if isOwner(uid);
  allow write: if isOwner(uid)
    && request.resource.data.keys().hasOnly(['activeToken','updatedAt'])
    && request.resource.data.activeToken is string
    && request.resource.data.updatedAt == request.time;
}
```
배포: `firebase deploy --only firestore:rules --project test-ai-builder`.

### 2) 학교 발급 (admin)
- admin 교사 발급(`app/api/admin/teachers` POST + `app/admin/teachers/page.tsx`)에 **`schoolCode` 입력** 추가(검증 `^[a-z0-9-]+$`, 중복 시 거부).
- 서버: 교사 생성 시 `teachers/{uid}.schoolCode` 저장 + `schools/{schoolCode}.set({name, teacherUid})`(Admin SDK).
- 화면: 교사 목록에 schoolCode 표기.

### 3) 학번 발급 (teacher)
- 발급 폼(`app/teacher/page.tsx`)을 `prefix`(자유) → **학년(1–6)·반(1–99)·인원(1–50)·PIN(6자)·한도**로 교체.
- `app/api/teacher/students` POST: 요청 교사의 `teachers/{gate.uid}.schoolCode`를 읽어, `i=1..인원`에 대해
  - `hakbun = ${grade}${pad2(class)}${pad2(i)}`, `email = ${schoolCode}-${hakbun}@class.kr`, password=PIN.
  - `adminAuth.createUser` + claim student + `students/{uid}.set({teacherUid, schoolCode, hakbun, name: hakbun, limitType, limitValue, usedTotal:0, createdAt})`.
  - 검증: grade 1–6, class 1–99, count 1–50, PIN 길이 ≥6, limitValue ≥1. 중복 이메일은 skipped.
- 반환에 `schoolCode`·`hakbun` 포함(배포 표시용).

### 4) 학생 로그인 탭 (`components/auth/LoginDialog.tsx`)
- 상단에 [일반]/[학생] 탭. 일반 = 기존 Google/이메일. 학생 = 학교 셀렉트 + 학번 + PIN.
- 학교 목록: 클라가 공개 `schools` 컬렉션 읽어 `<Select>`(name 표시, value=schoolCode). `lib/firebase/schools.ts`에 `listSchools()`.
- 제출: `email = ${schoolCode}-${hakbun}@class.kr` 조합 → `signInWithEmailAndPassword(auth, email, pin)`. 에러 `auth/invalid-credential` → "학교·학번·비밀번호를 다시 확인해 주세요". 성공 시 onClose.
- 학번/PIN 입력은 `inputMode="numeric"`.

### 5) 로그인 무결성 — 단일 세션 (학생만)
- `lib/client/session.ts`:
  - `claimSession(uid): Promise<string>` — 랜덤 id 생성(`crypto.randomUUID()`), `setDoc(sessions/{uid}, {activeToken:id, updatedAt: serverTimestamp()})`, id 반환.
  - `watchSession(uid, myId, onKicked): Unsubscribe` — `onSnapshot(sessions/{uid})`, `data.activeToken !== myId`면 `onKicked()`.
- `components/auth/AuthProvider.tsx` 훅: 로그인 사용자가 **student claim**이면 `claimSession`→`watchSession`. `onKicked` 시 `signOut` + 안내 플래그(토스트/리다이렉트). 로그아웃·언마운트 시 unsubscribe. 비학생은 미적용.
- 효과: 새 로그인이 `activeToken`을 덮어쓰면 이전 세션 리스너가 감지→자동 로그아웃. **동시 활성 세션 1개**. (다중 탭도 1개로 수렴 — 수용.)

### 6) 배포 표시 (teacher 콘솔)
- 발급 후 "만든 계정" 박스에 **학교(schoolCode) · PIN · 학번 목록** 표시. `buildCredText` 갱신(학교/PIN/학번). 복사·텍스트저장 유지. (인쇄용 카드 레이아웃은 범위 밖.)

## 검증
- **rules self-test** `selftest-student-login.mjs`(미커밋, 클라SDK):
  1. Admin SDK로 학교(schools+teacher.schoolCode)·학생(email 스킴) 시드.
  2. 클라SDK: 올바른 학교+학번+PIN(=조합 이메일+비번) → 로그인 성공. 틀린 PIN → 실패.
  3. **단일 세션**: 동일 uid로 두 번 `claimSession` → `sessions/{uid}.activeToken`이 두 번째 값으로 바뀜 확인(첫 세션이 밀려남).
  4. `schools` 공개 읽기 가능, `sessions/{uid}` 본인만 쓰기.
- **발급 API self-test**(미커밋): teacher 토큰으로 학년·반·인원 발급 → 이메일/학번 스킴·students 문서 필드 확인.
- `tsc --noEmit` + 프로덕션 빌드.

## 에러 처리 / 엣지
- 학교 없음/학번 오타/PIN 오타 → `signInWithEmailAndPassword` invalid-credential → 친절 안내.
- 중복 schoolCode 발급 거부, 중복 학번(이미 있는 학생) skipped.
- 기존 `prefix-NN` 학생/스키마 없는 교사 = 테스트 계정 → 재생성(마이그레이션 범위 밖).
- 단일세션: 학생만 적용(교사·admin·일반은 다중 허용 — 교실 운영상 무방).

## 영향 파일
- 수정: `firestore.rules`, `app/api/admin/teachers/route.ts`, `app/admin/teachers/page.tsx`, `app/api/teacher/students/route.ts`, `app/teacher/page.tsx`, `components/auth/LoginDialog.tsx`, `components/auth/AuthProvider.tsx`.
- 신규: `lib/firebase/schools.ts`, `lib/client/session.ts`, self-test 스크립트(미커밋).

## 범위 밖
인쇄용 카드 디자인, 기존 계정 마이그레이션, 단일세션의 서버측 강제 revoke(협조적 클라 방식으로 충분), 학교 간 학번 중복 표준화.
