import { describe, it, expect } from 'vitest';
import { hasProfanity, findProfanity, isReservedNickname, assertClean, ProfanityError } from './moderation';

describe('hasProfanity — korcen + 보강 목록', () => {
  it('빈 문자열·평범한 문장은 깨끗하다', async () => {
    expect(await hasProfanity('')).toBe(false);
    expect(await hasProfanity('구구단 퀴즈 만들기')).toBe(false);
    expect(await hasProfanity('나의 디지털 시계')).toBe(false);
  });

  it('한국어 비속어와 문장부호 우회를 잡는다', async () => {
    expect(await hasProfanity('병신')).toBe(true);
    expect(await hasProfanity('병,신')).toBe(true);
    expect(await hasProfanity('씨 발')).toBe(true); // 보강 목록(공백 제거 부분일치)
  });

  it('영어 비속어는 반복·기호 삽입·혼동문자 우회를 잡는다', async () => {
    expect(await hasProfanity('fuuuck')).toBe(true);
    expect(await hasProfanity('f.u.c.k')).toBe(true);
    expect(await hasProfanity('fuсk')).toBe(true); // 키릴 с
  });

  it('오탐 우려 단어는 막지 않는다', async () => {
    expect(await hasProfanity('Nigeria')).toBe(false);
    expect(await hasProfanity('물걸레 로봇')).toBe(false);
    expect(await hasProfanity('1등 신나는 게임')).toBe(false);
  });
});

describe('findProfanity — 걸린 단어 짚기', () => {
  it('깨끗하면 null', async () => {
    expect(await findProfanity('안녕 친구들')).toBeNull();
  });

  it('단어 하나에서 걸리면 그 단어를 돌려준다(앞뒤 기호 정리)', async () => {
    expect(await findProfanity('오늘 (병신) 퀴즈')).toBe('병신');
  });

  it("공백 우회처럼 단어 하나로 특정 못 하면 ''", async () => {
    expect(await findProfanity('씨 발')).toBe('');
  });
});

describe('assertClean', () => {
  it('걸린 단어와 칸 이름을 안내 문구에 넣는다', async () => {
    await expect(assertClean('병신 퀴즈', '제목')).rejects.toThrow(ProfanityError);
    await expect(assertClean('병신 퀴즈', '제목')).rejects.toThrow("제목에 '병신'는 쓸 수 없는 말이에요");
  });

  it('깨끗하면 통과', async () => {
    await expect(assertClean('구구단 퀴즈', '제목')).resolves.toBeUndefined();
  });
});

describe('isReservedNickname — 관리자 사칭 예약어', () => {
  it('한글·영문 예약어의 공백·기호·전각·키릴 우회를 잡는다', () => {
    expect(isReservedNickname('관 리 자')).toBe(true);
    expect(isReservedNickname('ADMIN9')).toBe(true);
    expect(isReservedNickname('ad-min')).toBe(true);
    expect(isReservedNickname('ａｄｍｉｎ')).toBe(true);
    expect(isReservedNickname('аdmin')).toBe(true); // 키릴 а
  });

  it('일반 닉네임은 통과', () => {
    expect(isReservedNickname('코딩왕')).toBe(false);
    expect(isReservedNickname('minji')).toBe(false);
  });
});
