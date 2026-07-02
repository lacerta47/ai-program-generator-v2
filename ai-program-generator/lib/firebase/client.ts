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
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
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

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
