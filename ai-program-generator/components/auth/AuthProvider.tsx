'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
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
              if (typeof window !== 'undefined') {
                window.alert('다른 곳에서 같은 학생으로 로그인했어요. 이 화면은 로그아웃할게요.');
              }
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

  return <AuthContext.Provider value={{ user, isAdmin, isTeacher, isStudent, loading }}>{children}</AuthContext.Provider>;
}
