import type { PlanFields } from '@/lib/firebase/types';
import type { GeneratedCode } from '@/lib/ai/types';

// 동결된 few-shot 참고 예시 1개(variant별). 모든 import가 type-only라
// 컴파일 후 .js에는 런타임 import가 없어 단독 실행이 가능하다.
export interface Exemplar {
  variant: 'default' | 'survey';
  /** survey 전용 — 유형별 슬롯(PROGRAM_TYPES id). 없으면 유형 공통 슬롯. */
  programType?: string;
  plan: PlanFields;
  code: GeneratedCode;
  sourcePostId: string;
  sourceTitle: string;
  approvedBy: string;
  approvedAt: number;
  /** 코드 참고 가능 여부. 구버전 문서는 읽을 때 코드로 다시 판정한다. */
  codeReference?: 'full' | 'plan-only';
}

/** 참고 예시 코드 각 필드의 최대 길이(자). 초과분은 잘라 생략 마커를 붙인다. */
export const EXEMPLAR_CODE_CAP = 4000;

/** 참고 예시 계획서 각 필드의 최대 길이(자). 프롬프트 비용을 완전히 bounded로 유지. */
export const EXEMPLAR_PLAN_CAP = 1000;

/** 한 필드를 상한으로 축약. 잘렸으면 끝에 생략 마커를 붙인다. */
export function truncateField(s: unknown, cap: number = EXEMPLAR_CODE_CAP): string {
  if (typeof s !== 'string') return '';
  if (s.length <= cap) return s;
  return s.slice(0, cap) + '\n/* …생략… */';
}

/** code 3필드를 모두 축약. */
export function truncateCode(code: GeneratedCode, cap: number = EXEMPLAR_CODE_CAP): GeneratedCode {
  return {
    html: truncateField(code.html, cap),
    css: truncateField(code.css, cap),
    javascript: truncateField(code.javascript, cap),
  };
}

export function exemplarCodeReference(code: GeneratedCode): 'full' | 'plan-only' {
  return [code.html, code.css, code.javascript]
    .every((field) => typeof field === 'string' && field.length <= EXEMPLAR_CODE_CAP && !field.includes('…생략…'))
    ? 'full'
    : 'plan-only';
}

/**
 * 생성 프롬프트 앞에 붙일 참고 예시 블록(순수 함수).
 * 모델이 그대로 베끼지 않고 '완성도 기준'으로만 참고하도록 프레이밍한다.
 * code는 이미 축약된 상태로 들어온다고 가정한다(저장 시점에 truncateCode 적용).
 */
export function buildExemplarBlock(ex: Exemplar): string {
  const { plan } = ex;
  const p = (s: unknown) => {
    if (typeof s !== 'string') return '';
    return s.length <= EXEMPLAR_PLAN_CAP ? s : `${s.slice(0, EXEMPLAR_PLAN_CAP)}…`;
  };
  const codeSection = exemplarCodeReference(ex.code) === 'full'
    ? `[참고 예시 — 완전한 결과 코드]
HTML:
${ex.code.html}
CSS:
${ex.code.css}
JavaScript:
${ex.code.javascript}`
    : `[참고 예시 — 구현 기준]
저장된 예시 코드에 생략된 부분이 있어 불완전한 코드는 제공하지 않습니다. 아래 계획서의 구성과 완성도만 참고하고, 새 계획서의 코드는 처음부터 끝까지 완전하게 작성하세요.`;
  return `아래는 완성도 높은 "참고 예시"입니다. 그대로 베끼지 말고, 구조와 완성도 기준만 참고하세요. 디자인·접근성·안전·실행 환경 규칙은 예시보다 항상 우선합니다.

[참고 예시 — 계획서]
- 이름: ${p(plan.name)}
- 모습: ${p(plan.look)}
- 사용법: ${p(plan.usage)}
- 동작: ${p(plan.how)}
- 기타: ${p(plan.etc)}

${codeSection}

위 예시는 참고용일 뿐입니다. 이제 아래 '새 계획서'에 맞는 완성형 프로그램을 새로 만드세요.

`;
}
