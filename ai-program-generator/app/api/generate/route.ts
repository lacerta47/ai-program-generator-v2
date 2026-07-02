import { NextRequest, NextResponse } from 'next/server';
import { getAIProvider } from '@/lib/ai/provider';
import { SYSTEM_PROMPTS, MODIFY_SYSTEM_SUFFIX, PHOTO_INSTRUCTION, type SystemPromptVariant } from '@/lib/ai/prompts';
import { getExemplar } from '@/lib/admin/exemplars';
import { buildExemplarBlock } from '@/lib/ai/exemplars';
import type { GenerateMode } from '@/lib/ai/types';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { todayKeyKST } from '@/lib/usageDay';
import { readEffectiveLimit } from '@/lib/admin/usageConfig';
import { reserveStudentQuota, refundStudentQuota } from '@/lib/server/studentQuota';
import { allowGenerate } from '@/lib/server/genRate';
import { UserFacingError } from '@/lib/ai/errors';

// AI 호출은 반드시 서버에서만 실행한다(키 노출 방지).
export const runtime = 'nodejs';

// 교사·admin 일일 생성 상한 — 무제한 방지(한 계정이 공유 Gemini 키를 소진하는 비용·DoS 차단). env로 조정.
const ROLE_DAILY_LIMIT = Number(process.env.ROLE_GEN_DAILY_LIMIT) || 100;

function isMode(v: unknown): v is GenerateMode {
  return v === 'generate' || v === 'modify';
}

export async function POST(req: NextRequest) {
  // 1) 로그인 검증 — Authorization: Bearer <Firebase ID 토큰>
  const authHeader = req.headers.get('authorization') ?? '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!idToken) {
    return NextResponse.json(
      { error: '로그인해야 프로그램을 만들 수 있어요.' },
      { status: 401 },
    );
  }

  let uid: string;
  let isAdmin = false;
  let isTeacher = false;
  let isStudent = false;
  let emailVerified = false;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    uid = decoded.uid;
    isAdmin = decoded.admin === true;
    isTeacher = decoded.teacher === true;
    isStudent = decoded.student === true;
    emailVerified = decoded.email_verified === true;
  } catch {
    return NextResponse.json(
      { error: '로그인이 만료됐어요. 다시 로그인해 주세요.' },
      { status: 401 },
    );
  }

  // 이메일 인증 필수(Google 로그인은 자동 인증, 관리자는 예외). 무분별 가입·생성 양산 차단.
  if (!isAdmin && !isTeacher && !isStudent && !emailVerified) {
    return NextResponse.json(
      { error: '이메일 인증이 필요해요. 마이페이지에서 인증 메일을 다시 받을 수 있어요.' },
      { status: 403 },
    );
  }

  // 2) 입력 검증 (한도 차감 전에 — 잘못된 요청이 횟수를 소모하지 않도록)
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바른 JSON이 아닙니다.' }, { status: 400 });
  }

  // system 텍스트는 클라이언트가 보내도 무시(주입 차단). 대신 variant 키로 서버가 선택.
  const { prompt, mode, variant, photo } = (body ?? {}) as {
    prompt?: unknown;
    mode?: unknown;
    variant?: unknown;
    photo?: unknown;
  };
  const promptVariant: SystemPromptVariant = variant === 'survey' ? 'survey' : 'default';

  if (typeof prompt !== 'string' || !prompt.trim()) {
    return NextResponse.json({ error: 'prompt(문자열)가 필요합니다.' }, { status: 400 });
  }
  if (prompt.length > 200000) {
    return NextResponse.json({ error: '계획서가 너무 길어요.' }, { status: 400 });
  }
  if (!isMode(mode)) {
    return NextResponse.json(
      { error: "mode는 'generate' 또는 'modify' 여야 합니다." },
      { status: 400 },
    );
  }

  // 사진(선택) — data-URI 검증·분해. 잘못/과대 사진은 한도 차감 전에 거절(횟수 소모 방지).
  let parsedPhoto: { data: string; mimeType: string } | undefined;
  if (typeof photo === 'string' && photo) {
    // 저장 rule(validPost photo<=350000)과 동일 상한. generate만 크게 받으면 생성(쿼터 차감)은 되고
    // 저장은 규칙 위반으로 거부돼 '쿼터 증발'이 되므로 두 캡을 일치시킨다.
    if (photo.length > 350000) {
      return NextResponse.json({ error: '사진이 너무 커요.' }, { status: 413 });
    }
    const m = /^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/.exec(photo);
    if (!m) {
      return NextResponse.json({ error: '사진 형식이 올바르지 않아요.' }, { status: 400 });
    }
    parsedPhoto = { mimeType: m[1], data: m[2] };
  }

  // 2.5) 생성 시작 레이트리밋(비환불) — 입력검증 후·한도선점 전에 체크.
  // 일일 쿼터는 취소 시 환불되므로, '부분 스트리밍만 받고 abort→환불'을 반복하면 카운터가 안 쌓여
  // 유료 Gemini 호출을 무제한 낼 수 있다(abort-파밍). 이 카운터는 환불되지 않아 빈도의 천장이 된다. (B2)
  if (!(await allowGenerate(uid))) {
    return NextResponse.json(
      { error: '너무 빠르게 여러 번 만들고 있어요. 잠깐 쉬었다가 다시 해주세요.' },
      { status: 429 },
    );
  }

  // 3) 한도 선점 (트랜잭션). 생성이 실패하면 4)에서 환불한다.
  // 사진 생성은 멀티모달이라 비용이 더 들어 2칸을 차감한다(일반 생성은 1칸).
  const cost = parsedPhoto ? 2 : 1;
  const day = todayKeyKST();
  const usageRef = adminDb.collection('usage').doc(`${uid}_${day}`);
  if (isStudent) {
    const r = await reserveStudentQuota(uid, cost);
    if (!r.ok) {
      const msg =
        r.reason === 'pool'
          ? '선생님이 정한 우리 반 한도를 다 썼어요.'
          : r.reason === 'cap-daily'
            ? '오늘 만들 수 있는 횟수를 다 썼어요. 내일 다시 만들어 보세요!'
            : r.reason === 'cap-total'
              ? '만들 수 있는 횟수를 다 썼어요.'
              : '한도를 확인하지 못했어요. 잠시 후 다시 해주세요.';
      return NextResponse.json({ error: msg }, { status: r.reason === 'misconfig' ? 500 : 429 });
    }
  } else {
    // 교사·admin도 무제한이 아니라 넉넉한 일일 상한(키 남용 방어용) 경유. 일반 사용자는 설정 한도.
    // 참고(리뷰 오해 방지): '교사별' 한도는 이 일일캡이 아니라 공유 풀(teachers.totalQuota,
    // admin이 PATCH로 보충)로 따로 존재한다. 요금제별 개별 한도는 출시 전 YAGNI라 단순 분기로 두며,
    // 확장 시엔 readEffectiveLimit(config·per-user override) 쪽 국소 변경으로 흡수된다(스파게티 아님).
    const dailyLimit = isAdmin || isTeacher ? ROLE_DAILY_LIMIT : await readEffectiveLimit(uid);
    try {
      const allowed = await adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(usageRef);
        const count = (snap.data()?.count as number | undefined) ?? 0;
        if (count + cost > dailyLimit) return false;
        tx.set(usageRef, { uid, day, count: count + cost, updatedAt: Date.now() }, { merge: true });
        return true;
      });
      if (!allowed) {
        return NextResponse.json(
          { error: `오늘 만들 수 있는 횟수(${dailyLimit}번)를 모두 썼어요. 내일 다시 만들어 보세요!` },
          { status: 429 },
        );
      }
    } catch (e) {
      console.error('[/api/generate] 사용량 확인 실패:', e);
      return NextResponse.json(
        { error: '사용량을 확인하지 못했어요. 잠시 후 다시 해주세요.' },
        { status: 500 },
      );
    }
  }

  // 4) 생성(스트리밍) — NDJSON. 실패/취소 시 선점한 한도를 1회 환불.
  const provider = getAIProvider();
  let system = SYSTEM_PROMPTS[promptVariant];
  let finalPrompt = prompt;
  if (mode === 'modify') {
    // 수정 모드: 요청한 부분만 바꾸고 나머지 코드·제약을 보존하라는 지시를 덧붙인다.
    system = SYSTEM_PROMPTS[promptVariant] + MODIFY_SYSTEM_SUFFIX;
  } else {
    // 생성 모드: 해당 variant에 승인된 참고 예시가 있으면 프롬프트 앞에 붙여 완성도 floor를 올린다.
    const exemplar = await getExemplar(promptVariant);
    if (exemplar) finalPrompt = buildExemplarBlock(exemplar) + prompt;
  }
  // 사진이 첨부됐으면 그 사진을 활용하라는 지시를 시스템 프롬프트에 덧붙인다.
  if (parsedPhoto) system = system + PHOTO_INSTRUCTION;

  const encoder = new TextEncoder();
  // [의도된 trade-off — 리뷰 오해 방지] 실패뿐 아니라 '취소(abort)'에도 환불한다: 네트워크 끊김 등으로
  // 결과를 못 받은 정당 사용자가 한도를 까이지 않게 하려는 것. 부분 스트리밍분만 받고 고의로 abort하는
  // 어뷰징이 이론상 가능하나, 이 쿼터의 목적은 매출 보호가 아니라 Gemini 키 남용(DoS) 방지(무료 티어)라
  // 수용한 것. 정책을 바꾸려면 'done 도달분만 과금' 또는 '상당량 전송 시 환불 생략'을 검토.
  let refunded = false;
  const refundOnce = async () => {
    if (refunded) return;
    refunded = true;
    if (isStudent) await refundStudentQuota(uid, cost);
    else await refundQuota(usageRef, cost);
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      try {
        for await (const chunk of provider.generateStream({ prompt: finalPrompt, system, mode, photo: parsedPhoto }, req.signal)) {
          if (req.signal.aborted) throw new Error('ABORTED');
          send(chunk);
        }
        controller.close();
      } catch (e) {
        const aborted =
          req.signal.aborted ||
          (e instanceof Error && (e.message === 'ABORTED' || e.name === 'AbortError'));
        await refundOnce();
        if (!aborted) {
          console.error('[/api/generate] 스트리밍 실패:', e);
          try {
            // 내부 정보 누출 방지: 안전하다고 표시된(UserFacingError) 메시지만 그대로 전달하고,
            // raw Gemini/SDK 에러 등은 일반 메시지로 치환한다(서버 로그엔 위에서 e 원본 기록). (B4)
            const msg = e instanceof UserFacingError ? e.message : '앗, 만들다가 문제가 생겼어요. 잠깐 뒤 다시 해볼까요?';
            send({ type: 'error', error: msg });
          } catch {}
        }
        try {
          controller.close();
        } catch {}
      }
    },
    async cancel() {
      // 클라이언트 연결 끊김(취소) — 한도 환불
      await refundOnce();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

/** 생성 실패 시 선점했던 한도(cost칸)를 되돌린다(0 미만으로는 안 내려감). */
async function refundQuota(ref: FirebaseFirestore.DocumentReference, cost = 1): Promise<void> {
  try {
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const count = (snap.data()?.count as number | undefined) ?? 0;
      tx.update(ref, { count: Math.max(0, count - cost), updatedAt: Date.now() });
    });
  } catch (e) {
    console.error('[/api/generate] 한도 환불 실패:', e);
  }
}
