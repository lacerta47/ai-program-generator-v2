export type GenerationFeedbackMode = 'create' | 'easy';

export const GENERATION_FEEDBACK_LINKS = {
  create: 'https://docs.google.com/forms/d/e/1FAIpQLSc8jvYJ2f5X2Oyc7owB0Pvq5z3qcoi5BY89UR9DfkT7r-ZPug/viewform',
  easy: 'https://docs.google.com/forms/d/e/1FAIpQLSdElsfqP2kFm-NaUslZORw5Pc1Ww3d_1870NleY3KMOBVgaLA/viewform',
} satisfies Record<GenerationFeedbackMode, string>;
