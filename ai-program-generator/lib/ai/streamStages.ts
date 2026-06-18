import type { GeneratedCode } from './types';

export type StreamStage = 'html' | 'css' | 'javascript';
export const STAGE_ORDER: StreamStage[] = ['html', 'css', 'javascript'];

/** 부분 코드에서 '지금 도착 중'인 필드 추정: 값이 있는 마지막 필드(순서 html→css→js). */
export function currentStage(partial: Partial<GeneratedCode>): StreamStage | null {
  let cur: StreamStage | null = null;
  for (const k of STAGE_ORDER) {
    if (typeof partial[k] === 'string' && partial[k] !== '') cur = k;
  }
  return cur;
}

/** 가르치는 개념(3층). */
export const STAGE_CONCEPT: Record<StreamStage, string> = {
  html: '구조',
  css: '스타일',
  javascript: '동작',
};

/** 생성기 배너용 친근 문구. */
export const STAGE_LABEL: Record<StreamStage, string> = {
  html: '화면의 뼈대를 만들어요',
  css: '색과 모양으로 꾸며요',
  javascript: '규칙과 움직임을 넣어요',
};

/** easy(저학년) 진행 신호용 더 단순한 문구. */
export const STAGE_LABEL_EASY: Record<StreamStage, string> = {
  html: '화면을 그려요',
  css: '예쁘게 꾸며요',
  javascript: '움직임을 넣어요',
};
