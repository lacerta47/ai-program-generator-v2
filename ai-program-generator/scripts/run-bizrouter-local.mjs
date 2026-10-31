// Load server settings without displaying or returning credential values.
import nextEnv from '@next/env';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
nextEnv.loadEnvConfig(root, true, { info() {}, error() {} });
if (process.argv[2] === '--check') {
  console.log(process.env.BIZROUTER_API_KEY ? 'BizRouter 키 등록됨 (API 호출 없음)' : 'BizRouter 키 미등록 (API 호출 없음)');
  process.exit(process.env.BIZROUTER_API_KEY ? 0 : 1);
}
if (!process.env.BIZROUTER_API_KEY) {
  console.error('BizRouter 키가 없습니다. scripts/set-bizrouter-key.ps1로 한 번 등록하세요.');
  process.exit(1);
}
if (!process.argv[2]) {
  console.error('실행할 Vitest 설정 파일을 지정하세요.');
  process.exit(1);
}
const child = spawn(process.execPath, [resolve(root, 'node_modules/vitest/vitest.mjs'), 'run', '--config', process.argv[2]], {
  cwd: root, env: process.env, stdio: 'inherit',
});
child.on('error', () => { console.error('시험 실행에 실패했습니다.'); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
