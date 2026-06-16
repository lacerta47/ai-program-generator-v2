import type { ProgramType } from '../types';
import { paint } from './paint';
import { game } from './game';
import { quiz } from './quiz';
import { card } from './card';
import { maze } from './maze';
import { roulette } from './roulette';
import { calc } from './calc';
import { fortune } from './fortune';
import { sound } from './sound';
import { aquarium } from './aquarium';

/** 종류 목록(순서 = 종류 선택 화면 노출 순서). 추가 종류는 여기에 import해 넣으면 됨. */
export const PROGRAM_TYPES: ProgramType[] = [
  paint,
  game,
  quiz,
  card,
  maze,
  roulette,
  calc,
  fortune,
  sound,
  aquarium,
];

export function getProgramType(id: string): ProgramType | undefined {
  return PROGRAM_TYPES.find((t) => t.id === id);
}
