import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// ⚠️ [보안 교육/시연용 허니팟] — 취약점 시연 체인 2단계.
// 이 앱(LUN)의 '실제 공개 게시판 콘텐츠'(누구나 /board에서 보이는 것)를 실어 덤프처럼 리얼하게 보이게 하되,
// 민감 필드(이메일·PIN 등)는 실제로 읽지 않고 리댁션/조작된 데모값으로 채운다(실 시크릿 노출 0).
// 라이브 DB에 붙지 않는 정적 스냅샷이라 공개 배포해도 실제 데이터 유출 없음.
// ❗시연 끝나면 이 파일 + public/WEB-INF/web.xml 삭제.

// 실제 공개 게시판 글(제목·작성자·날짜·개념) — 이미 외부 공개된 데이터.
const POSTS = [
  { id: 'JL6StH', title: '숫자 카운터', author: '코딩왕별', created: '2026-07-08', concepts: '순서,입력,출력' },
  { id: 'fXmflG', title: '구구단 퀴즈', author: '퀴즈요정', created: '2026-07-08', concepts: '순서,조건,입력,출력' },
  { id: 'ZJl7KG', title: '무지개 그림판', author: '무지개손', created: '2026-07-08', concepts: '순서,입력,출력' },
  { id: 'LjIclG', title: '두더지 잡기', author: '게임달인', created: '2026-07-08', concepts: '순서,조건,반복,입력,출력' },
  { id: 'KRI3z0', title: '피하기 게임', author: 'test', created: '2026-07-06', concepts: '순서,조건,반복,입력,출력' },
  { id: 'pWMUX3', title: '클래식 스네이크 게임', author: 'test', created: '2026-07-02', concepts: '순서,조건,반복,입력,출력' },
];

// 컬렉션 인벤토리(실제 존재하는 컬렉션명 — 스키마는 앱 그대로, 건수는 데모 근사값).
const TABLES = [
  ['posts', 7], ['categories', 2], ['users', 14], ['nicknames', 14], ['students', 26],
  ['teachers', 3], ['schools', 3], ['sessions', 9], ['reports', 1], ['usage', 41],
];

// 학생 계정 테이블(치명적으로 보이는 부분) — 실제 데이터가 아니라 조작된 데모값 + 리댁션.
const STUDENTS = [
  { hakbun: '10101', name: '김○준', email: '10101@***.kr', pin_hash: 'sha256:9f2b…a1', role: 'student' },
  { hakbun: '10102', name: '이○서', email: '10102@***.kr', pin_hash: 'sha256:3c7d…e0', role: 'student' },
  { hakbun: '10203', name: '박○윤', email: '10203@***.kr', pin_hash: 'sha256:b18f…44', role: 'student' },
  { hakbun: '20101', name: '최○아', email: '20101@***.kr', pin_hash: 'sha256:6ad2…9c', role: 'student' },
];

function table(headers: string[], rows: (string | number)[][]): string {
  return `<table><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('')}</table>`;
}

const HTML = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>lun_prod :: DB Console</title>
<style>
  body{margin:0;background:#0b0e14;color:#c9d1d9;font:13.5px/1.6 "Consolas",ui-monospace,monospace}
  header{background:#161b22;border-bottom:1px solid #30363d;padding:10px 16px;color:#ff7b72;font-weight:bold}
  .wrap{padding:16px;max-width:1000px}
  .box{background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:12px 14px;margin:12px 0}
  .k{color:#7ee787}.v{color:#ffa657}.warn{color:#ff7b72;font-weight:bold}.c{color:#8b949e}
  table{border-collapse:collapse;width:100%;margin-top:6px}
  th,td{border:1px solid #30363d;padding:5px 9px;text-align:left;white-space:nowrap}
  th{background:#161b22;color:#79c0ff}
  input{background:#010409;border:1px solid #30363d;color:#c9d1d9;padding:8px;width:100%;font-family:inherit}
  .tag{display:inline-block;background:#3fb95022;color:#7ee787;border:1px solid #3fb95055;border-radius:4px;padding:1px 8px;font-size:12px}
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  @media(max-width:720px){.cols{grid-template-columns:1fr}}
</style>
</head>
<body>
<header>⚠ Apache Tomcat/9.0.71 &nbsp;·&nbsp; lun_prod — Internal Database Console <span class="tag">authenticated: bypass</span></header>
<div class="wrap">
  <div class="box">
    <div class="warn">EXPOSED — 이 콘솔은 방화벽 뒤에 있어야 합니다. 외부에서 접근됨.</div>
    <div><span class="k">datasource</span> = <span class="v">jdbc:mysql://10.10.30.12:3306/lun_prod</span></div>
    <div><span class="k">user</span> = <span class="v">lun_admin</span> &nbsp; <span class="k">pool</span> = <span class="v">ACTIVE (8/20)</span> &nbsp; <span class="k">server</span> = <span class="v">Apache Tomcat/9.0.71</span></div>
  </div>

  <div class="cols">
    <div class="box">
      <div class="k">&gt; SHOW TABLES;</div>
      ${table(['collection', 'rows'], TABLES)}
    </div>
    <div class="box">
      <div class="k">&gt; SELECT hakbun,name,email,pin_hash,role FROM students LIMIT 4;</div>
      ${table(['hakbun', 'name', 'email', 'pin_hash', 'role'], STUDENTS.map((s) => [s.hakbun, s.name, s.email, s.pin_hash, s.role]))}
    </div>
  </div>

  <div class="box">
    <div class="k">&gt; SELECT id,title,author,created,concepts FROM posts ORDER BY created DESC;</div>
    ${table(['id', 'title', 'author', 'created', 'concepts'], POSTS.map((p) => [p.id, p.title, p.author, p.created, p.concepts]))}
  </div>

  <div class="box">
    <div class="k">query &gt;</div>
    <input value="SELECT * FROM users; --" readonly>
  </div>

  <div class="box c" style="font-size:11.5px">security lab · lun_prod snapshot</div>
</div>
</body>
</html>`;

export async function GET() {
  return new NextResponse(HTML, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      Server: 'Apache Tomcat/9.0.71',
      'X-Powered-By': 'Servlet/4.0 JSP/2.3 (Apache Tomcat/9.0.71)',
    },
  });
}
