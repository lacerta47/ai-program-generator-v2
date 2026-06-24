import { authedJson } from '@/lib/client/authedFetch';

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
  nextPageToken: string | null;
}

/** 관리자 ID 토큰을 Bearer로 붙여 /api/admin/users 호출. pageToken으로 페이지 이동. */
export async function fetchMembers(pageToken?: string): Promise<MembersResponse> {
  const qs = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : '';
  return authedJson(`/api/admin/users${qs}`);
}
