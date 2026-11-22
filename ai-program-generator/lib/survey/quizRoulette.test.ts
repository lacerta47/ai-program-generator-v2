import { describe, expect, it } from 'vitest';
import { getTypeGuide } from '../ai/typeGuides';
import { assemblePrompt, surveyToPlan, visibleSteps } from './assemble';
import { quiz } from './programs/quiz';
import { roulette } from './programs/roulette';
import { AI_PICK } from './types';

describe('퀴즈 선택 조립', () => {
  it.each([undefined, AI_PICK, 'no'])('시간 제한 %s에서 예전 경고 답이 나타나지 않는다', (timer) => {
    const answers = { ...(timer ? { timer } : {}), timer_warn: 'beep' };
    expect(visibleSteps(quiz, answers).map(step => step.id)).not.toContain('timer_warn');
    expect(assemblePrompt(quiz, answers)).not.toContain('1초마다 삐');
    expect(surveyToPlan(quiz, answers).etc).not.toContain('삐삐');
  });

  it.each(['yes10', 'yes20', 'yes30'])('시간 제한 %s에서 고른 경고 효과를 반영한다', (timer) => {
    expect(assemblePrompt(quiz, { timer, timer_warn: 'beep' })).toContain('1초마다 삐');
  });

  it('숫자 주제를 바꾸면 이전 연산과 숫자 범위를 함께 숨긴다', () => {
    const answers = { topic: '우주', mathtype: 'mul', numrange: 'big', answer: 'picture' };
    const prompt = assemblePrompt(quiz, answers);
    expect(prompt).toContain('우주 퀴즈');
    expect(prompt).toContain('고른 주제');
    expect(prompt).not.toContain('곱하기가 섞인');
    expect(prompt).not.toContain('1~100');
    expect(assemblePrompt(quiz, { ...answers, topic: '숫자' })).toContain('1~100');
  });
});

describe('룰렛 선택 조립', () => {
  it.each(['type', 'count', AI_PICK])('%s 명단 모드와 고정 칸을 동시에 요구하지 않는다', (namemethod) => {
    const answers = { use: 'name', namemethod, namecount: 'n30', slots: 's4' };
    const prompt = assemblePrompt(roulette, answers);
    expect(prompt).not.toContain('룰렛 칸을 4개');
    expect(surveyToPlan(roulette, answers).etc).not.toContain('4칸');
    if (namemethod === 'type') expect(prompt).toContain('최대 30개까지');
    else expect(prompt).not.toContain('최대 30개까지');
  });

  it('직접 명단에서 예시 이름으로 돌아오면 고정 칸 선택을 반영한다', () => {
    expect(assemblePrompt(roulette, { use: 'name', namemethod: 'preset', slots: 's4' })).toContain('룰렛 칸을 4개');
  });

  it('용도를 바꾸면 이전 이름 입력과 축하 형식만 빠진다', () => {
    const answers = { use: 'lunch', namemethod: 'type', namecount: 'n30', bigshow: 'yes', celebrate: 'overlay', slots: 's4' };
    const ids = visibleSteps(roulette, answers).map(step => step.id);
    for (const id of ['namemethod', 'namecount', 'bigshow', 'celebrate']) expect(ids).not.toContain(id);
    expect(assemblePrompt(roulette, answers)).toContain('룰렛 칸을 4개');
    expect(assemblePrompt(roulette, { ...answers, use: 'name' })).toContain('당첨 결과 문장의 글씨를 더 크게');
  });

  it('회전 중 무음과 멈춤 효과음을 독립적으로 반영한다', () => {
    const answers = { spinsound: 'none', soundmood: 'tense', stopfx: ['cheer'] };
    const prompt = assemblePrompt(roulette, answers);
    expect(prompt).toContain('도는 동안에는 음악·효과음을 넣지 마');
    expect(prompt).toContain('멈출 때 Web Audio');
    expect(prompt).toContain('[당첨 소리: 켜기]');
    expect(prompt).not.toContain('긴장감 있고');
    expect(getTypeGuide('roulette', prompt)).toContain('ensureAudio');
    expect(getTypeGuide('roulette', assemblePrompt(roulette, { spinsound: 'none' }))).not.toContain('ensureAudio');
    expect(visibleSteps(roulette, { spinsound: AI_PICK }).map(step => step.id)).not.toContain('soundmood');
  });

  it('회전음과 반짝임만 고르면 당첨음은 끄고 회전 오디오는 유지한다', () => {
    const prompt = assemblePrompt(roulette, { spinsound: 'tick', stopfx: ['flash'] });
    expect(prompt).toContain('[당첨 소리: 끄기]');
    expect(prompt).not.toContain('[당첨 소리: 켜기]');
    expect(getTypeGuide('roulette', prompt)).toContain('ensureAudio');
    const audibleWin = assemblePrompt(roulette, { spinsound: 'tick', stopfx: ['flash', 'cheer'] });
    expect(audibleWin).toContain('[당첨 소리: 켜기]');
    expect(audibleWin).not.toContain('[당첨 소리: 끄기]');
  });
});
