import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { allUserCreationMs, countByCreatedAt } from '@/lib/server/operationsCounts';
import { lastDayKeysKST } from '@/lib/usageDay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const HOUR_MS = 60 * 60 * 1000;
const REPORTS_URL = 'https://eduai-lun.co.kr/admin/reports';

type Email = { key: string; subject: string; text: string };

async function reportEmail(): Promise<Email | null> {
  const end = Math.floor(Date.now() / HOUR_MS) * HOUR_MS;
  const start = end - HOUR_MS;
  const count = await countByCreatedAt('reports', start, end);
  if (!count) return null;

  const kstHour = (ms: number) => new Date(ms + 9 * HOUR_MS).toISOString().slice(0, 16).replace('T', ' ');
  return {
    key: `lun-reports/${new Date(start).toISOString()}`,
    subject: `[LUN] 확인할 신고 ${count}건`,
    text: `한국시간 ${kstHour(start)}부터 ${kstHour(end)} 전까지 접수된 미처리 신고가 ${count}건 있습니다.\n\n신고 확인\n${REPORTS_URL}`,
  };
}

async function dailyEmail(): Promise<Email> {
  const [date, today] = lastDayKeysKST(2);
  const start = Date.parse(`${date}T00:00:00+09:00`);
  const end = Date.parse(`${today}T00:00:00+09:00`);
  const [stats, signups, posts, newReports, pending] = await Promise.all([
    adminDb.doc(`stats/${date}`).get(),
    allUserCreationMs(),
    countByCreatedAt('posts', start, end),
    countByCreatedAt('reports', start, end),
    adminDb.collection('reports').count().get(),
  ]);

  return {
    key: `lun-daily/${date}`,
    subject: `[LUN] ${date} 운영 통계`,
    text: [
      `${date} 한국시간 기준`,
      '',
      `방문 집계 ${stats.get('visits') ?? 0}회 (브라우저 기준)`,
      `가입 ${signups.filter((ms) => ms >= start && ms < end).length}건 (현재 남아 있는 계정 기준)`,
      `생성 완료 ${stats.get('genCount') ?? 0}건`,
      `게시 ${posts}건 (현재 남아 있는 작품 기준)`,
      `당일 접수분 중 미처리 신고 ${newReports}건`,
      `현재 전체 미처리 신고 ${pending.data().count}건`,
      '',
      `신고 확인\n${REPORTS_URL}`,
    ].join('\n'),
  };
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'cron_not_configured' }, { status: 503 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const mode = req.nextUrl.searchParams.get('mode') ?? 'daily';
  if (mode !== 'daily' && mode !== 'reports') {
    return NextResponse.json({ error: 'invalid_mode' }, { status: 400 });
  }
  if (process.env.VERCEL_ENV !== 'production') {
    return NextResponse.json({ status: 'production_only' });
  }

  const apiKey = process.env.Resend?.trim();
  const from = process.env.LUN_OPERATIONS_EMAIL_FROM?.trim();
  const to = process.env.LUN_OPERATIONS_EMAIL_TO?.trim();
  if (!apiKey && !from && !to) return NextResponse.json({ status: 'disabled' });
  if (!apiKey || !from || !to) {
    console.error('[operations-email] incomplete email configuration');
    return NextResponse.json({ error: 'email_not_configured' }, { status: 503 });
  }

  try {
    const email = mode === 'reports' ? await reportEmail() : await dailyEmail();
    if (!email) return NextResponse.json({ status: 'no_reports' });

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': email.key,
      },
      body: JSON.stringify({ from, to: [to], subject: email.subject, text: email.text }),
      signal: AbortSignal.timeout(8000),
    });
    if (response.ok) return NextResponse.json({ status: 'accepted' });

    // 같은 기간의 집계가 갱신되어 본문이 달라진 재호출. 진행 중인 요청은 실패로 남긴다.
    if (response.status === 409) {
      const error = await response.json().catch(() => null);
      if (error?.name === 'invalid_idempotent_request') {
        return NextResponse.json({ status: 'duplicate_period' });
      }
    }
    console.error('[operations-email] email provider returned', response.status);
    return NextResponse.json({ error: 'send_failed' }, { status: 502 });
  } catch {
    console.error('[operations-email] could not prepare or send email', mode);
    return NextResponse.json({ error: 'operations_email_failed' }, { status: 500 });
  }
}
