export type GenerationFeedbackMode = 'create' | 'easy';

export const GENERATION_FEEDBACK_LINKS = {
  create: 'https://docs.google.com/forms/d/e/1FAIpQLSc8jvYJ2f5X2Oyc7owB0Pvq5z3qcoi5BY89UR9DfkT7r-ZPug/viewform',
  easy: 'https://docs.google.com/forms/d/e/1FAIpQLSdElsfqP2kFm-NaUslZORw5Pc1Ww3d_1870NleY3KMOBVgaLA/viewform',
} satisfies Record<GenerationFeedbackMode, string>;

export const GENERATION_FEEDBACK_LABELS = { create: '만들기', easy: '골라서 만들기' } as const;
export const GENERATION_FEEDBACK_CODE_FIELDS = { create: 'entry.745368034', easy: 'entry.1109935147' } as const;
export type GenerationFeedbackStatus = 'available' | 'completed';
export type GenerationFeedbackStatuses = Record<GenerationFeedbackMode, GenerationFeedbackStatus>;
