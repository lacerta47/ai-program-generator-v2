import { auth } from '@/lib/firebase/client';

export interface Member {
  uid: string;
  email: string | null;
  nickname: string | null;
  createdAt: number; // ms
  lastSignInAt: number | null;
  isAdmin: boolean;
  disabled: boolean;
  postCount: number;
  usageToday: number;
  usage7d: number[]; // days 순서(오래된→오늘)에 맞춘 7개
  limitOverride: number | null; // 학생별 한도(없으면 null=전역)
}

export interface MembersResponse {
  members: Member[];
  usageLimit: number;
  days: string[];
}

/** 관리자 ID 토큰을 Bearer로 붙여 /api/admin/users 호출. */
export async function fetchMembers(): Promise<MembersResponse> {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요해요.');
  const idToken = await user.getIdToken();
  const res = await fetch('/api/admin/users', {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `요청 실패 (${res.status})`);
  return data as MembersResponse;
}
