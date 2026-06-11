// 특정 계정에 관리자(admin) 권한을 부여하는 1회성 스크립트.
//
// 사용법:
//   1) 먼저 앱(npm run dev)에서 본인 계정으로 한 번 로그인/가입한다.
//   2) node scripts/set-admin.mjs your@email.com
//   3) 해당 계정에서 로그아웃 후 다시 로그인하면 관리자 UI가 보인다.
//
// (Auth custom claim { admin: true } 를 부여한다. Firestore 규칙의 isAdmin() 과 연동됨)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = join(__dirname, '..', 'serviceAccountKey.json');

const email = process.argv[2];
if (!email) {
  console.error('사용법: node scripts/set-admin.mjs <이메일>');
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
} catch {
  console.error('❌ serviceAccountKey.json 을 프로젝트 루트에서 찾을 수 없습니다.');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth();

try {
  const user = await auth.getUserByEmail(email);
  await auth.setCustomUserClaims(user.uid, { admin: true });
  console.log(`✅ ${email} (uid=${user.uid}) 에 admin 권한을 부여했습니다.`);
  console.log('   → 해당 계정에서 로그아웃 후 다시 로그인하면 적용됩니다.');
  process.exit(0);
} catch (e) {
  if (e?.code === 'auth/user-not-found') {
    console.error(`❌ ${email} 계정을 찾을 수 없습니다. 먼저 앱에서 한 번 로그인(가입)하세요.`);
  } else {
    console.error('❌ 실패:', e?.message ?? e);
  }
  process.exit(1);
}
