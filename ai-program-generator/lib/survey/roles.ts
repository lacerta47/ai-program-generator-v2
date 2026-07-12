// 골라서 만들기 "역할 카드" 공유 정의(단일 소스). SurveyStep.role이 이 키를 참조하고,
// SurveySummary가 label(태그)·hint(ⓘ 설명)·concept(개념 다리)를 읽어 렌더한다.
// concept는 lib/edu/concepts.ts의 개념 키('순서'|'조건'|'반복'|'입력'|'출력') — 칩 색·아이콘은 CONCEPT_BY_KEY에서 재사용.

export type RoleKey = 'type' | 'goal' | 'appearance' | 'decor' | 'sound' | 'control' | 'rule' | 'flow' | 'output';

export interface RoleInfo {
  /** 인라인 태그(A) */
  label: string;
  /** ⓘ 카드 한 줄(B), 저학년 말투 */
  hint: string;
  /** 개념 다리 — 없으면 개념 칩 미표시 */
  concept?: string;
}

export const ROLES: Record<RoleKey, RoleInfo> = {
  type: { label: '종류', hint: '어떤 놀이를 만들지 큰 틀을 정해요.' },
  goal: { label: '목표', hint: '무엇을 하는 게 목표인지 정해요.' },
  appearance: { label: '모양', hint: '주인공이나 화면이 어떻게 생길지 정해요.' },
  decor: { label: '배경', hint: '펼쳐지는 곳을 꾸며요.' },
  sound: { label: '소리', hint: '어떤 소리로 들려줄지 정해요.', concept: '출력' },
  control: { label: '조작', hint: '네가 어떻게 움직일지 정하는 부분이에요.', concept: '입력' },
  rule: { label: '규칙', hint: '언제 어떻게 될지 규칙을 정해요.', concept: '조건' },
  flow: { label: '흐름', hint: '얼마나 빠르게·계속 될지 정해요.', concept: '반복' },
  output: { label: '결과', hint: '끝나면 무엇을 보여줄지 정해요.', concept: '출력' },
};
