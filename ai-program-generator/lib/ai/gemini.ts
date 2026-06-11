import { GoogleGenAI, Type } from '@google/genai';
import type { AIProvider, GeneratedCode, GenerateInput } from './types';

// 제공자별 세부사항(모델 선택, JSON 모드, 파싱, 폴백)을 이 파일 안에 가둔다.
// 다른 제공자로 교체할 때는 이 파일에 대응하는 구현만 추가하면 된다.

// 2026-04부터 gemini-2.5-pro는 무료 티어 제외 → flash 계열 사용.
// 무료 티어는 모델별 일일 한도가 매우 작아(flash 기준 20회/일),
// flash 한도 소진 시 별도 한도를 가진 flash-lite로 자동 폴백한다.
const PRIMARY_MODEL = 'gemini-2.5-flash';
const FALLBACK_MODEL = 'gemini-2.5-flash-lite';

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    html: { type: Type.STRING },
    css: { type: Type.STRING },
    javascript: { type: Type.STRING },
  },
  required: ['html', 'css', 'javascript'],
};

export class GeminiProvider implements AIProvider {
  async generate(input: GenerateInput): Promise<GeneratedCode> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY 환경변수가 설정되지 않았습니다.');
    }
    const ai = new GoogleGenAI({ apiKey });

    let response;
    try {
      response = await callModel(ai, PRIMARY_MODEL, input);
    } catch (e) {
      if (!isQuotaExhausted(e)) throw e;
      console.warn(`[gemini] ${PRIMARY_MODEL} 일일 무료 한도 소진 → ${FALLBACK_MODEL}로 폴백`);
      try {
        response = await callModel(ai, FALLBACK_MODEL, input);
      } catch (e2) {
        if (isQuotaExhausted(e2)) {
          throw new Error(
            '오늘 사용할 수 있는 무료 AI 횟수를 모두 썼어요. 내일 다시 해보세요! (무료 한도는 매일 새로 채워져요)',
          );
        }
        throw e2;
      }
    }

    const text = response.text;
    if (!text) {
      throw new Error('Gemini 응답이 비어 있습니다.');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Gemini 응답을 JSON으로 파싱하지 못했습니다.');
    }
    return normalize(parsed);
  }
}

function callModel(ai: GoogleGenAI, model: string, input: GenerateInput) {
  return callWithRetry(() =>
    ai.models.generateContent({
      model,
      contents: input.prompt,
      config: {
        systemInstruction: input.system,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  );
}

/** 429 RESOURCE_EXHAUSTED (무료 할당량 소진) 여부 */
function isQuotaExhausted(e: unknown): boolean {
  const msg = String((e as { message?: string })?.message ?? e);
  const status = (e as { status?: number })?.status;
  return status === 429 || /RESOURCE_EXHAUSTED|exceeded your current quota/i.test(msg);
}

// 일시적 과부하(503)만 짧은 백오프로 재시도.
// 429(할당량)는 재시도해도 소용없으므로 즉시 던져 폴백/안내로 처리한다.
async function callWithRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e);
      const status = (e as { status?: number })?.status;
      const transient =
        status === 503 || /\b503\b|UNAVAILABLE|high demand|overloaded/i.test(msg);
      if (attempt >= retries || !transient) throw e;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
}

function normalize(value: unknown): GeneratedCode {
  const obj = (value ?? {}) as Record<string, unknown>;
  return {
    html: typeof obj.html === 'string' ? obj.html : '',
    css: typeof obj.css === 'string' ? obj.css : '',
    javascript: typeof obj.javascript === 'string' ? obj.javascript : '',
  };
}
