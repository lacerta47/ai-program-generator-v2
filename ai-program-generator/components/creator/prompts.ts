import type { GeneratedCode } from '@/lib/ai/types';
import type { PlanFields } from '@/lib/firebase/types';

// 생성기 프롬프트 빌더(순수 함수). 프롬프트 튜닝은 이 파일만 손대면 된다.

export function buildGeneratePrompt(p: PlanFields): string {
  return `프로그램 계획서:
- 프로그램 이름: ${p.name}
- 프로그램 모습 (배경, 아이콘 등): ${p.look}
- 사용법 및 조작 방법: ${p.usage}
- 동작 방식: ${p.how}
- 기타 사항: ${p.etc}`;
}

export function buildModifyPrompt(p: PlanFields, code: GeneratedCode, request: string): string {
  return `기존에 생성된 웹사이트 코드에 다음 요청사항을 반영하여 코드를 수정해주세요.
기존 프로그램 계획서:
- 프로그램 이름: ${p.name}
- 프로그램 모습: ${p.look}
- 사용법: ${p.usage}
- 동작 방식: ${p.how}
- 기타 사항: ${p.etc}

기존 코드:
- HTML: ${JSON.stringify(code.html)}
- CSS: ${JSON.stringify(code.css)}
- JavaScript: ${JSON.stringify(code.javascript)}

사용자 수정 요청사항: ${request}`;
}
