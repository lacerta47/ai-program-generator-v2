import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// 순수 로직 단위 테스트 전용(Firestore·Next 런타임 미사용). 파일 규칙: lib/**/*.test.ts
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    include: ['lib/**/*.test.ts'],
    environment: 'node',
  },
});
