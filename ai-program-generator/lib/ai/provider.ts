import { GeminiProvider } from './gemini';
import type { AIProvider } from './types';

// AI 제공자 교체 지점(single swap point).
// 나중에 OpenAI/Claude 등으로 바꾸려면 여기서 반환하는 구현만 교체한다.
export function getAIProvider(): AIProvider {
  return new GeminiProvider();
}
