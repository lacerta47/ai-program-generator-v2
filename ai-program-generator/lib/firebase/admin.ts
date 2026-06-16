import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

// 서버 전용 Firebase Admin SDK — **지연 초기화**.
// 모듈 import 시점엔 자격증명을 읽지 않는다: next build의 라우트 분석(page data 수집)이나
// 프리렌더가 이 모듈을 import만 해도 자격증명 없이 크래시하지 않도록.
// 실제 adminAuth/adminDb의 메서드를 호출하는 시점(=요청 처리 시)에 1회 초기화한다.
// 자격증명: FIREBASE_SERVICE_ACCOUNT_KEY env(JSON 문자열, 배포용) 또는
// 프로젝트 루트의 serviceAccountKey.json (로컬 개발용, gitignored).
function loadCredential() {
  const envJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (envJson) return JSON.parse(envJson);
  try {
    return JSON.parse(readFileSync(join(process.cwd(), 'serviceAccountKey.json'), 'utf8'));
  } catch {
    throw new Error(
      'Firebase Admin 자격증명을 찾을 수 없습니다. 배포 환경에 FIREBASE_SERVICE_ACCOUNT_KEY(서비스계정 JSON 문자열)를 설정하세요.',
    );
  }
}

function getAdminApp(): App {
  const existing = getApps();
  if (existing.length) return existing[0];
  return initializeApp({ credential: cert(loadCredential()) });
}

let authSingleton: Auth | null = null;
let dbSingleton: Firestore | null = null;
function authInstance(): Auth {
  return (authSingleton ??= getAuth(getAdminApp()));
}
function dbInstance(): Firestore {
  return (dbSingleton ??= getFirestore(getAdminApp()));
}

// import 시점엔 초기화하지 않는 지연 프록시 — 속성/메서드 접근 시 1회 초기화.
function lazy<T extends object>(resolve: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      const inst = resolve() as Record<string | symbol, unknown>;
      const value = inst[prop];
      return typeof value === 'function'
        ? (value as (...args: unknown[]) => unknown).bind(inst)
        : value;
    },
  });
}

export const adminAuth: Auth = lazy(authInstance);
export const adminDb: Firestore = lazy(dbInstance);
