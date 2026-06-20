'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

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

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // 역할은 custom claim 으로 판별 (admin: set-admin 스크립트 / teacher: 관리자 발급)
        const token = await u.getIdTokenResult();
        setIsAdmin(token.claims.admin === true);
        setIsTeacher(token.claims.teacher === true);
        setIsStudent(token.claims.student === true);
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
