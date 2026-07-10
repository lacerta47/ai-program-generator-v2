import { GoogleGenAI, Type } from '@google/genai';
import type { AIProvider, GeneratedCode, GenerateInput, GenerationChunk } from './types';
import { parsePartialCode } from './partialJson';
import { UserFacingError } from './errors';

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
    // 교육 메타(Phase 0) — 코드 뒤에 오게 배치(라이브 미리보기는 code 3필드로만 진행).
    logicSummary: { type: Type.STRING },
    conceptTags: { type: Type.ARRAY, items: { type: Type.STRING } },
    // 교육(#6) — 다음 도전 한 문장(저장 안 함, 고치기 칸 힌트).
    nextChallenge: { type: Type.STRING },
    // 개념별 '내 작품 예시' 한 줄(하이브리드 C). 미사용 개념은 빈 문자열.
    conceptNotes: {
      type: Type.OBJECT,
      properties: {
        순서: { type: Type.STRING },
        조건: { type: Type.STRING },
        반복: { type: Type.STRING },
        입력: { type: Type.STRING },
        출력: { type: Type.STRING },
      },
    },
  },
  required: ['html', 'css', 'javascript', 'logicSummary', 'conceptTags', 'nextChallenge', 'conceptNotes'],
};

const CONCEPT_SET = ['순서', '조건', '반복', '입력', '출력'];

export class GeminiProvider implements AIProvider {
  async *generateStream(input: GenerateInput, signal?: AbortSignal): AsyncGenerator<GenerationChunk> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY 환경변수가 설정되지 않았습니다.');
    }
    const ai = new GoogleGenAI({ apiKey });

    // 초기화 시점에 폴백/재시도 적용(첫 청크 전에 429/503이 표면화됨).
    let stream;
    try {
      stream = await startStream(ai, PRIMARY_MODEL, input, signal);
    } catch (e) {
      if (!isQuotaExhausted(e)) throw e;
      console.warn(`[gemini] ${PRIMARY_MODEL} 일일 무료 한도 소진 → ${FALLBACK_MODEL}로 폴백`);
      try {
        stream = await startStream(ai, FALLBACK_MODEL, input, signal);
      } catch (e2) {
        if (isQuotaExhausted(e2)) {
          throw new UserFacingError(
            '오늘 사용할 수 있는 무료 AI 횟수를 모두 썼어요. 내일 다시 해보세요! (무료 한도는 매일 새로 채워져요)',
          );
        }
        throw e2; // raw SDK 에러 — 클라엔 일반 메시지로 치환됨(B4)
      }
    }

    let acc = '';
    let lastSig = '';
    let lastUsage: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } | undefined;
    for await (const chunk of stream) {
      if (chunk.usageMetadata) lastUsage = chunk.usageMetadata; // usageMetadata는 보통 마지막 청크에 누적치로 온다
      const t = chunk.text;
      if (!t) continue;
      acc += t;
      const partial = parsePartialCode(acc);
      const sig = JSON.stringify(partial);
      if (sig !== lastSig) {
        lastSig = sig;
        yield { type: 'delta', partial };
      }
    }

    // 최종: 엄격 파싱 + 빈 html 검사(기존 의미 보존 — 빈 결과는 실패로 보고 한도 환불 유도).
    let parsed: unknown;
    try {
      parsed = JSON.parse(acc);
    } catch {
      throw new UserFacingError('앗, 결과를 정리하다 살짝 꼬였어요. 다시 한 번 만들어 볼까요?');
    }
    const code = normalize(parsed);
    if (!code.html.trim()) {
      throw new UserFacingError('AI가 빈 결과를 만들었어요. 다시 한 번 만들어 볼까요?');
    }
    // 토큰 사용량(비용 실측용). thoughtsTokenCount=thinking(출력으로 과금됨).
    const usage = lastUsage
      ? {
          input: lastUsage.promptTokenCount ?? 0,
          output: lastUsage.candidatesTokenCount ?? 0,
          thinking: lastUsage.thoughtsTokenCount ?? 0,
        }
      : undefined;
    // 교육 메타(Phase 0) — 로직 설명 + 개념 태그(고정 목록으로만 필터, 최대 5개).
    const p = parsed as Record<string, unknown>;
    const meta = {
      // rules validPost가 logicSummary ≤2000자를 강제 → 모델이 길게 뱉어도 업로드가 거부되지 않게 여기서 절단
      // (형제 필드 conceptTags.slice(0,5)·nextChallenge.slice(0,120)와 동일한 방어).
      logicSummary: typeof p.logicSummary === 'string' ? p.logicSummary.slice(0, 2000) : '',
      conceptTags: Array.isArray(p.conceptTags)
        ? p.conceptTags.filter((t): t is string => typeof t === 'string' && CONCEPT_SET.includes(t)).slice(0, 5)
        : [],
      nextChallenge: typeof p.nextChallenge === 'string' ? p.nextChallenge.trim().slice(0, 120) : '',
      // 개념별 예시: CONCEPT_SET 키만, 값 trim·60자 절단, 빈값 제외(규칙 ≤60과 일치).
      conceptNotes:
        p.conceptNotes && typeof p.conceptNotes === 'object' && !Array.isArray(p.conceptNotes)
          ? Object.fromEntries(
              CONCEPT_SET.filter((k) => {
                const v = (p.conceptNotes as Record<string, unknown>)[k];
                return typeof v === 'string' && v.trim().length > 0;
              }).map((k) => [k, (p.conceptNotes as Record<string, string>)[k].trim().slice(0, 60)]),
            )
          : {},
    };
    yield { type: 'done', code, usage, meta };
  }

  async generate(input: GenerateInput): Promise<GeneratedCode> {
    let final: GeneratedCode | null = null;
    for await (const chunk of this.generateStream(input)) {
      if (chunk.type === 'done') final = chunk.code;
    }
    if (!final) throw new Error('앗, 결과가 비어서 왔어요. 다시 만들어 볼까요?');
    return final;
  }
}

/** 모델 스트림 시작(초기화)만 담당 — 503 일시 과부하는 callWithRetry로. signal로 모델 호출 취소. */
function startStream(ai: GoogleGenAI, model: string, input: GenerateInput, signal?: AbortSignal) {
  const contents = input.photo
    ? [{ role: 'user', parts: [{ text: input.prompt }, { inlineData: { mimeType: input.photo.mimeType, data: input.photo.data } }] }]
    : input.prompt;
  return callWithRetry(() =>
    ai.models.generateContentStream({
      model,
      contents,
      config: {
        systemInstruction: input.system,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        // 콜당 출력 토큰 상한(비용/폭주 방어). 저학년 프로그램 크기엔 매우 넉넉(~수십 KB)하되
        // 모델 최대(65536)의 절반이라 무한 반복 시 최악 비용을 절반으로 바운드. thinking 예산은
        // 품질 트레이드오프라 의도적으로 손대지 않음(기본 유지). 대형 출력 잘림이 보이면 상향.
        maxOutputTokens: 32768,
        abortSignal: signal,
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
