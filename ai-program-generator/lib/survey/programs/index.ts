import type { ProgramType } from '../types';
import { paint } from './paint';
import { quiz } from './quiz';
import { card } from './card';

/** v1 종류 목록(순서 = 종류 선택 화면 노출 순서). 추가 종류는 여기에 import해 넣으면 됨. */
export const PROGRAM_TYPES: ProgramType[] = [paint, quiz, card];

export function getProgramType(id: string): ProgramType | undefined {
  return PROGRAM_TYPES.find((t) => t.id === id);
}
