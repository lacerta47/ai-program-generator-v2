import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

// 클라이언트 Firebase 설정 (NEXT_PUBLIC_* — 브라우저 노출은 정상, 실제 방어는 보안 규칙)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// 중복 초기화 가드 (Next.js HMR/SSR 대응)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// App Check (reCAPTCHA v3) — 공개 config로 앱을 우회한 직접 API 남용(읽기 DoS·자동 가입 등)을 차단.
// 프로덕션 브라우저에서만 켠다(로컬 dev·SSR엔 App Check가 localhost/서버를 막으므로). getAuth/getFirestore 전에
// 초기화해야 토큰이 붙는다. site key는 공개값+도메인 잠금이라 커밋 안전(env로 덮어쓰기 가능). 서버 Admin SDK는 우회.
if (typeof window !== 'undefined') {
  const isProd = process.env.NODE_ENV === 'production';
  const debugToken = process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN;
  // 프로덕션은 항상 진짜 reCAPTCHA로. 로컬 dev는 debug token이 있을 때만 켠다
  // (없으면 localhost에서 reCAPTCHA가 실패하므로 안 켬 — Firestore Enforce 시 로컬 개발엔 debug token 필수).
  if (isProd || debugToken) {
    if (!isProd && debugToken) {
      // App Check debug 모드 — App Check 콘솔에 등록한 이 토큰으로 Enforce를 로컬에서 통과한다.
      (globalThis as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
    }
    const siteKey = process.env.NEXT_PUBLIC_APPCHECK_RECAPTCHA_KEY || '6Lc9nEAtAAAAAE0MFPWEaMsXuiXlp0DGbboRSVcZ';
    try {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } catch {
      // 중복 초기화(HMR 등)는 무시
    }
  }
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
