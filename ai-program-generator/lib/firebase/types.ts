import type { GeneratedCode } from '@/lib/ai/types';

export interface Category {
  id: string;
  name: string;
  order: number;
  createdAt: number;
}

export interface Post {
  id: string;
  title: string;
  categoryId: string;
  ownerUid: string;
  code: GeneratedCode;
  prompt: string;
  createdAt: number;
}

/** 새 게시물 생성 시 입력 (id 제외) */
export type NewPost = Omit<Post, 'id'>;
