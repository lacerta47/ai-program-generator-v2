import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// 서버 전용 Firebase Admin SDK.
// 자격증명: FIREBASE_SERVICE_ACCOUNT_KEY env(JSON 문자열, 배포용) 또는
// 프로젝트 루트의 serviceAccountKey.json (로컬 개발용, gitignored).
function loadCredential() {
  const envJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (envJson) return JSON.parse(envJson);
  const path = join(process.cwd(), 'serviceAccountKey.json');
  return JSON.parse(readFileSync(path, 'utf8'));
}

function getAdminApp(): App {
  const existing = getApps();
  if (existing.length) return existing[0];
  return initializeApp({ credential: cert(loadCredential()) });
}

export const adminAuth = getAuth(getAdminApp());
export const adminDb = getFirestore(getAdminApp());
