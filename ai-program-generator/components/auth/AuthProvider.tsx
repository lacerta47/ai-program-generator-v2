'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { claimSession, watchSession } from '@/lib/client/session';
import type { Unsubscribe } from 'firebase/firestore';

interface AuthState {
  user: User | null;
  isAdmin: boolean;
  isTeacher: boolean;
  isStudent: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, isAdmin: false, isTeacher: false, isStudent: false, loading: true });

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [isStudent, setIsStudent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [kicked, setKicked] = useState(false); // 다른 기기 로그인으로 밀려났을 때 안내 배너
  const [needsReauth, setNeedsReauth] = useState(false); // 학생인데 classTeacherUid 클레임이 없을 때(배너 폴백)
  const sessionUnsub = useRef<Unsubscribe | null>(null);
  // classTeacherUid 클레임이 없는 학생 토큰을 1회 강제갱신한 uid 집합(루프 방지)
  const forcedRefreshRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      sessionUnsub.current?.();
      sessionUnsub.current = null;
      if (u) {
        let token = await u.getIdTokenResult();
        if (cancelled) return;
        setIsAdmin(token.claims.admin === true);
        setIsTeacher(token.claims.teacher === true);
        const student = token.claims.student === true;
        setIsStudent(student);
        // 학생인데 classTeacherUid 클레임이 없으면: 재로그인 강요 대신 토큰을 1회 강제갱신해
        // 마이그레이션이 서버에 심은 새 클레임을 즉시 반영. 갱신 후에도 없으면 배너로 폴백.
        if (student && token.claims.classTeacherUid === undefined) {
          if (forcedRefreshRef.current.has(u.uid)) {
            // 이미 이 세션에서 1회 갱신했는데도 여전히 없음 → 배너 폴백(마이그레이션 미실행 등)
            setNeedsReauth(true);
          } else {
            forcedRefreshRef.current.add(u.uid);
            try {
              await u.getIdToken(true); // 강제 갱신(SDK 캐시 토큰도 함께 갱신 → 다른 소비자도 새 클레임 인식)
              token = await u.getIdTokenResult();
              if (cancelled) return;
              setNeedsReauth(token.claims.classTeacherUid === undefined);
            } catch (e) {
              // 네트워크 등으로 강제갱신 실패 → 배너로 폴백(throw 금지)
              console.error('토큰 강제갱신 실패:', e);
              if (cancelled) return;
              setNeedsReauth(true);
            }
          }
        } else {
          setNeedsReauth(false);
        }
        if (student) {
          try {
            const myId = await claimSession(u.uid);
            sessionUnsub.current = watchSession(u.uid, myId, () => {
              signOut(auth).catch(() => {});
              setKicked(true);
            });
          } catch (e) {
            console.error('세션 설정 실패:', e);
          }
        }
      } else {
        setIsAdmin(false);
        setIsTeacher(false);
        setIsStudent(false);
        setNeedsReauth(false);
        // 로그아웃 시 강제갱신 가드 초기화(다른 사용자는 다시 1회 갱신 가능)
        forcedRefreshRef.current.clear();
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  // 배너 자동 닫힘(6초)
  useEffect(() => {
    if (!kicked) return;
    const t = setTimeout(() => setKicked(false), 6000);
    return () => clearTimeout(t);
  }, [kicked]);

  return (
    <AuthContext.Provider value={{ user, isAdmin, isTeacher, isStudent, loading }}>
      {children}
      {kicked && typeof document !== 'undefined' &&
        createPortal(
          <div
            role="status"
            className="anim-pop-in fixed left-1/2 top-4 z-[100] flex -translate-x-1/2 items-center gap-3 rounded-[var(--r-md)] border-2 border-coral/40 bg-coral-soft px-4 py-3 text-[15px] text-coral-ink shadow-lg"
          >
            다른 기기에서 로그인해서 이 화면은 로그아웃했어요.
            <button onClick={() => setKicked(false)} className="press rounded-full px-2 py-0.5 underline underline-offset-2">
              닫기
            </button>
          </div>,
          document.body,
        )}
      {needsReauth && typeof document !== 'undefined' &&
        createPortal(
          <div
            role="status"
            className="anim-pop-in fixed left-1/2 top-4 z-[100] flex -translate-x-1/2 items-center gap-3 rounded-[var(--r-md)] border-2 border-coral/40 bg-coral-soft px-4 py-3 text-[15px] text-coral-ink shadow-lg"
          >
            우리 반 게시판을 보려면 한 번 더 로그인해 주세요.
            <button onClick={() => setNeedsReauth(false)} className="press rounded-full px-2 py-0.5 underline underline-offset-2">
              닫기
            </button>
          </div>,
          document.body,
        )}
    </AuthContext.Provider>
  );
}
