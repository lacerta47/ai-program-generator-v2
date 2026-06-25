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
  const sessionUnsub = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      sessionUnsub.current?.();
      sessionUnsub.current = null;
      if (u) {
        const token = await u.getIdTokenResult();
        setIsAdmin(token.claims.admin === true);
        setIsTeacher(token.claims.teacher === true);
        const student = token.claims.student === true;
        setIsStudent(student);
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
      }
      setLoading(false);
    });
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
    </AuthContext.Provider>
  );
}
