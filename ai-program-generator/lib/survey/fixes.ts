// 결과 화면 '고치기'용 빠른 수정 선택지(종류 무관 공통).
// 각 항목은 다중 선택 가능하며, 고른 항목의 request 문구를 직접 입력문과 합쳐
// buildModifyPrompt(plan, code, 합친요청문)으로 한 번에 수정 생성한다.

export interface QuickFix {
  id: string;
  /** 칩에 보이는 아이(저학년) 친화 라벨 */
  label: string;
  icon: string;
  /** AI에게 보낼 수정 요청 문구 */
  request: string;
}

export const QUICK_FIXES: QuickFix[] = [
  {
    id: 'broken',
    label: '눌러도 안 돼요',
    icon: '🔧',
    request: '버튼이나 조작이 작동하지 않아요. 클릭·터치·키보드 입력이 제대로 동작하도록 고쳐주세요.',
  },
  {
    id: 'layout',
    label: '화면이 이상해요',
    icon: '🖼️',
    request: '화면 배치가 깨져 보여요. 요소들이 가지런하고 보기 좋게 정렬되도록 레이아웃을 정리해주세요.',
  },
  {
    id: 'text',
    label: '글씨가 안 보여요',
    icon: '🔎',
    request: '글씨가 잘 안 보여요. 더 크고 또렷하게, 배경과 잘 구분되는 색으로 보이게 해주세요.',
  },
  {
    id: 'color',
    label: '색깔을 바꾸고 싶어요',
    icon: '🎨',
    request: '색깔을 더 밝고 알록달록하게, 예쁜 느낌으로 바꿔주세요.',
  },
  {
    id: 'fun',
    label: '더 재미있으면 좋겠어요',
    icon: '✨',
    request: '더 재미있고 신나게 만들어주세요. 자연스러운 움직임이나 효과를 더해주세요.',
  },
  {
    id: 'mobile',
    label: '폰에서 이상해요',
    icon: '📱',
    request: '휴대폰의 작은 화면에서도 잘 보이고 누르기 편하게 고쳐주세요.',
  },
];

/** 고른 빠른수정 id들 + 직접 입력문을 하나의 수정 요청문으로 합친다(빈 값 제외). */
export function buildFixRequest(pickedIds: string[], freeText: string): string {
  const picked = QUICK_FIXES.filter((f) => pickedIds.includes(f.id)).map((f) => f.request);
  const extra = freeText.trim();
  return [...picked, extra].filter(Boolean).join('\n');
}
