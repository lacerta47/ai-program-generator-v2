import type { Timestamp } from 'firebase/firestore';
import type { GeneratedCode } from '@/lib/ai/types';

export interface Category {
  id: string;
  name: string;
  order: number;
  createdAt: number;
}

/** 계획서 5필드 — 생성기 입력이자 게시물에 개별 저장(편집 시 폼 복원용) */
export interface PlanFields {
  name: string;
  look: string;
  usage: string;
  how: string;
  etc: string;
}

export const EMPTY_PLAN: PlanFields = { name: '', look: '', usage: '', how: '', etc: '' };

export interface Post {
  id: string;
  title: string;
  categoryId: string;
  ownerUid: string;
  authorName: string;
  code: GeneratedCode;
  /** 계획서 개별 필드. 구버전 글에는 없을 수 있음(옵셔널) */
  plan?: PlanFields;
  /** 생성에 쓰인 프롬프트 이력(구버전 호환·계획서 폴백 표시용) */
  prompt: string;
  createdAt: number;
  updatedAt?: number;
  /** 이어서 만들기(fork) 출처 — 원본 게시물 id (비-fork 글엔 없음) */
  forkedFrom?: string;
  /** 이어서 만들기 출처 작성자명 스냅샷 (원본이 지워져도 표시 유지) */
  forkedFromAuthor?: string;
}

/** 새 게시물 생성 시 입력 (id 제외) */
export type NewPost = Omit<Post, 'id'>;

/** 게시물 편집 시 덮어쓸 수 있는 필드 */
export interface PostEdit {
  title: string;
  authorName: string;
  plan: PlanFields;
  code: GeneratedCode;
  prompt: string;
  updatedAt: number;
}

export interface UserProfile {
  nickname: string;
  /** 마지막 닉네임 변경 시각(서버 타임스탬프) — 변경 쿨다운 판정용. 구버전 문서엔 number일 수 있음 */
  nicknameUpdatedAt?: Timestamp;
}
