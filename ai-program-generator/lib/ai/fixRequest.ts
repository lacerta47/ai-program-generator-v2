// 고치기(디버깅 대화) 요청문 빌더 — 아이의 '기대(want)'와 '실제(actual)'를
// 자연어 수정 요청으로 합친다. 두 칸이 관찰·가설을 언어화시키는 게 핵심(교육 Phase 1).
// buildModifyPrompt(plan, code, 이 결과)로 한 번의 modify 생성에 넣는다.

export function buildDebugRequest(want: string, actual: string): string {
  const w = want.trim();
  const a = actual.trim();
  // 둘 다 있으면 기대↔실제 '차이'를 명시 → 디버깅 프레임.
  if (w && a) return `아이가 원한 것: ${w}\n그런데 지금은: ${a}\n이 차이를 해결하도록 고쳐 주세요.`;
  // 기대만(순수 추가·변경 요청): 현행처럼 요청 그대로.
  if (w) return w;
  // 방어: 기대가 비고 실제만 온 경우(UI는 기대 필수라 보통 도달 안 함).
  return a;
}
