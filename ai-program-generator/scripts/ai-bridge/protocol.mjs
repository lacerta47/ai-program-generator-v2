// 요청 설정과 CLI가 실제로 제공한 응답 메타데이터를 구분한다.
export const TIERS = ['normal', 'high'];

/** 편지 `tier`(기본 normal)에 맞는 요청 설정. high는 config.tiers.high[target]을 쓰며, 없으면 조용히 기본값으로 내려가지 않고 실패한다. */
export function settingsFor(config, target, tier = 'normal') {
  if (!TIERS.includes(tier)) throw new Error(`${target}: tier는 ${TIERS.join('|')} 중 하나여야 합니다.`);
  const settings = tier === 'normal' ? config[target] : config.tiers?.[tier]?.[target];
  if (!settings || typeof settings.model !== 'string' || !/^[a-z0-9][a-z0-9._-]+$/i.test(settings.model)
    || ['default', 'best', 'fable', 'opus', 'sonnet', 'haiku'].includes(settings.model.toLowerCase())
    || !['low', 'medium', 'high', 'xhigh'].includes(settings.effort)) {
    throw new Error(`${target}(${tier}): 전체 모델 ID와 지원하는 effort를 config.json에 명시하세요.`);
  }
  return { model: settings.model, effort: settings.effort, tier };
}

export function validateLetter(letter, target) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(letter.meta.id ?? '')
    || letter.meta.to !== target
    || letter.meta.from !== (target === 'codex' ? 'claude' : 'codex')
    || !['question', 'review', 'proposal'].includes(letter.meta.kind)
    || !/^[a-f0-9]{40}$/.test(letter.meta.sha ?? '')
    || (letter.meta.tier !== undefined && !TIERS.includes(letter.meta.tier))) {
    throw new Error('편지 id/from/to/kind와 검토 기준 전체 40자 SHA(선택: tier normal|high)를 확인하세요.');
  }
}

/** 현재 트리에서 바로 호출할지, 검토 SHA의 임시 worktree를 만들지 결정한다. 검토 SHA가 HEAD와 같고 편지 외 변경이 없을 때만 현재 트리를 쓴다. */
export function planExecution(reviewSha, head, dirty) {
  return reviewSha === head && !dirty ? 'current' : 'temp_worktree';
}

export function commandArgs(target, settings, root) {
  if (target === 'codex') {
    // `--ignore-user-config`는 쓰지 않는다: 이 환경에서는 사용자 config가 Codex의 명령 실행 정책(PowerShell 허용)을 담고 있어,
    // 빼면 Codex가 파일 하나도 못 읽는다(2026-11-20 실측: "blocked by policy"). 격리는 read-only 샌드박스·ephemeral로 유지한다.
    return ['exec', '--sandbox', 'read-only', '--ephemeral', '--model', settings.model,
      '-c', `model_reasoning_effort="${settings.effort}"`, '-C', root, '--json', '-'];
  }
  return ['-p', '--model', settings.model, '--effort', settings.effort,
    '--output-format', 'stream-json', '--verbose', '--add-dir', root,
    '--safe-mode', '--restricted', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
    '--disallowedTools', 'mcp__*', 'Read(**/.env.local)', 'Read(**/serviceAccountKey.json)',
    '--no-session-persistence', '--permission-mode', 'dontAsk', '--tools', 'Read,Glob,Grep',
    '--allowedTools', 'Read', 'Glob', 'Grep'];
}

export function validateReviewContext(reviewSha, head, dirty) {
  if (reviewSha !== head) throw new Error('검토 SHA가 현재 HEAD와 다릅니다. 해당 커밋의 별도 worktree에서 호출하세요.');
  if (dirty) throw new Error('편지 외 변경이 남아 있습니다. 검토할 코드·지침·이전 답신을 먼저 커밋하세요.');
}

function tokenUsage(usage) {
  return Object.fromEntries(['input_tokens', 'output_tokens', 'cached_input_tokens',
    'cache_read_input_tokens', 'cache_creation_input_tokens', 'reasoning_output_tokens']
    .filter((key) => typeof usage?.[key] === 'number').map((key) => [key, usage[key]]));
}

export function parseResponse(target, stdout) {
  const events = [];
  let malformed = false;
  for (const line of stdout.split(/\r?\n/).filter((line) => line.trim())) {
    try { events.push(JSON.parse(line)); } catch { malformed = true; }
  }
  if (target === 'claude') {
    const result = events.findLast((event) => event.type === 'result');
    const models = [...new Set(events.filter((event) => event.type === 'assistant')
      .map((event) => event.message?.model).filter((model) => typeof model === 'string' && model !== '<synthetic>'))];
    const evidence = { response_models: models,
      response_model_source: models.length ? 'assistant.message.model' : 'not_exposed_by_cli',
      usage: tokenUsage(result?.usage) };
    if (malformed || !result || result.is_error || result.subtype !== 'success' || !result.result?.trim()) {
      throw Object.assign(new Error('Claude가 성공한 최종 답신을 반환하지 않았습니다.'), { evidence });
    }
    return { reply: result.result, ...evidence };
  }
  const result = events.findLast((event) => event.type === 'turn.completed');
  const reply = events.findLast((event) => event.type === 'item.completed' && event.item?.type === 'agent_message')?.item.text;
  const evidence = { response_models: [], response_model_source: 'not_exposed_by_cli', usage: tokenUsage(result?.usage) };
  if (malformed || !result || events.some((event) => event.type === 'turn.failed') || !reply?.trim()) {
    throw Object.assign(new Error('Codex가 성공한 최종 답신을 반환하지 않았습니다.'), { evidence });
  }
  // 현재 Codex exec JSONL은 응답 모델 필드를 제공하지 않는다. 요청값/AI 자기보고로 채우지 않는다.
  return { reply, ...evidence };
}

export function replyIdentity(reply, letter, head) {
  const first = reply.trim().split(/\r?\n/)[0];
  const match = first.match(/^원문 id: ([a-z0-9-]+) · 확인 HEAD: ([a-f0-9]{40}|미확인) · 검토 SHA: ([a-f0-9]{40})$/);
  if (!match || match[1] !== letter.meta.id || match[3] !== letter.meta.sha
    || (match[2] !== '미확인' && match[2] !== head)) {
    throw new Error('답신 첫 줄의 원문 id·확인 HEAD·검토 SHA가 요청과 일치하지 않습니다.');
  }
  return { reported_head: match[2] === '미확인' ? null : match[2], reported_review_sha: match[3] };
}

export function requireSuccess(result) {
  if (result.timedOut || result.status !== 0 || !result.stdout.trim()) {
    throw new Error(result.timedOut ? '브리지 시간 초과' : `CLI 실행 실패/빈 응답 (exit ${result.status})`);
  }
}
