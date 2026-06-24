# categoryId·신고 정합성 검증 (firestore.rules) 설계

작성일: 2026-06-24 · 상태: 승인됨

## 목표
클라이언트가 임의로 채워 보내던 두 필드를 **firestore.rules의 교차문서 검증(get/exists)**으로 강제해, 위조를 차단한다.
1. **신고 `postOwnerUid` 정합성(고위험)**: `submitReport`가 클라의 post 객체에서 `postOwnerUid: post.ownerUid`를 그대로 보냄 → 위조 가능. 방금 만든 교사 신고 인박스/DELETE가 `report.postOwnerUid`로 권한 판정하므로, 악의적 신고자가 owner를 자기 교사의 학생으로 위조하면 그 교사가 임의 글을 삭제하게 유도 가능.
2. **categoryId 정합성(교사 게시판 보호)**: `validPost`이 categoryId를 문자열·길이만 검증 → 존재하지 않는 보드나 남의 교사 게시판에 글 투입 가능.

## 결정 사항 (브레인스토밍 확정)
- **접근**: 서버 API 경유가 아니라 **firestore.rules의 get()/exists() 교차검증**. 신규 엔드포인트·클라 쓰기경로 변경 없음, 진짜 경계(Firestore)에서 강제, 하위호환.
- **범위**: 신고 owner 정합성 + 교사 게시판 보호(존재확인 포함) 둘 다.
- `postTitle`/`postAuthorName`은 표시용 스냅샷이라 검증 대상 아님(권한엔 owner만 영향).
- admin은 categoryId 제약에서 예외(어디든 작성 가능).

## 규칙 변경 (`firestore.rules`)

규칙 함수는 지역변수(let)가 없으므로, 조회한 데이터를 헬퍼 인자로 넘겨 같은 문서 재조회를 피한다. 단일 쓰기당 get/exists ≤10 한도 — 아래 최악 4회.

### 헬퍼 추가 (`match /databases/{database}/documents` 블록 안, 함수 영역)
```
// 신고의 postOwnerUid가 실제 글 주인과 일치하는지(위조 차단). 글이 없으면 거부.
function postOwnerMatches(postId, ownerUid) {
  return exists(/databases/$(database)/documents/posts/$(postId))
    && get(/databases/$(database)/documents/posts/$(postId)).data.ownerUid == ownerUid;
}

// 해당 카테고리에 이 사용자가 글을 쓸 수 있는지.
function categoryAllowed(catId, uid) {
  return exists(/databases/$(database)/documents/categories/$(catId))
    && allowedForCat(get(/databases/$(database)/documents/categories/$(catId)).data, uid);
}
function allowedForCat(cat, uid) {
  return !('teacherUid' in cat)         // 공개 게시판: 누구나
    || cat.teacherUid == uid             // 그 교사 본인
    || isStudentOf(uid, cat.teacherUid); // 그 교사의 학생
}
function isStudentOf(uid, teacherUid) {
  return exists(/databases/$(database)/documents/students/$(uid))
    && get(/databases/$(database)/documents/students/$(uid)).data.teacherUid == teacherUid;
}
```

### posts create 규칙 (현행에 categoryId 검증 추가)
```
allow create: if isSignedIn()
  && (isAdmin() || isVerified() || isRoleAccount())
  && request.resource.data.ownerUid == request.auth.uid
  && validPost(request.resource.data)
  && (isAdmin() || categoryAllowed(request.resource.data.categoryId, request.auth.uid));
```

### reports create 규칙 (현행에 owner 정합성 추가)
```
allow create: if isSignedIn()
  && request.resource.data.reporterUid == request.auth.uid
  && reportId == request.resource.data.postId + '_' + request.auth.uid
  && request.resource.data.keys().hasOnly([...현행...])
  && ...현행 필드/크기 검증...
  && postOwnerMatches(request.resource.data.postId, request.resource.data.postOwnerUid);
```
(reports **update**는 현행 그대로 — 이미 `postOwnerUid`/`postId` 불변 강제. create에서 owner가 검증됐으므로 일관.)

## 에러 처리 / 엣지
- 삭제된 글 신고 → `exists(posts)` 거짓 → 거부(정상; 보이는 글만 신고).
- 학생이 공개 게시판에 작성 → 허용(보호 대상은 교사보드만). 정상 학생은 클라가 자기 보드로 자동 라우팅하므로 영향 없음.
- 외부인(비학생·타반 학생)이 교사보드에 작성 → 거부.
- 정상 클라는 이미 올바른 owner·categoryId를 보냄 → **하위호환, 기존 동작 유지**.
- 규칙 함수 내 런타임 에러(예: null.data)는 Firestore에서 거부로 처리되지만, exists 가드로 명시적으로 막는다.

## 검증
규칙은 Admin SDK로 검증 불가(우회됨) → **클라이언트 SDK로 실제 규칙에 쓰기 시도**.
1. `firebase deploy --only firestore:rules --project test-ai-builder` (프로덕션 규칙 갱신 — 하위호환이라 안전).
2. **self-test** `scripts/selftest-integrity.mjs`(미커밋): Admin SDK로 시드(교사·학생·공개카테고리·교사보드카테고리·글), 이후 **클라이언트 SDK**(`signInWithCustomToken`)로 규칙 검증:
   - 신고: 위조 owner → permission-denied / 정상 owner → 성공.
   - 게시: 외부인이 교사보드 → denied / 그 교사 학생 → 성공 / 그 교사 본인 → 성공 / 공개 카테고리 → 성공 / 없는 categoryId → denied.
   - 시드/생성 문서는 Admin SDK로 정리.
3. tsc/build는 규칙 변경엔 무관하나, 코드 변경이 없으므로 생략 가능(규칙만 변경 시).

## 영향 파일
- 수정: `firestore.rules`(헬퍼 4개 + posts/reports create 규칙).
- 신규: `scripts/selftest-integrity.mjs`(미커밋).
- 클라 코드 변경 없음(`submitReport`/`createPost`는 이미 올바른 값을 보냄).

## 범위 밖
- `postTitle`/`postAuthorName` 일치 강제(표시용, 저위험).
- 서버 API 경유로의 전환(불필요).
- 좋아요/조회/포크 카운터(이미 서버 전용).
