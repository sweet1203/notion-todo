// api/todos.js — Notion DB CRUD 프록시 (멀티테넌트 / BYO 토큰)
// GET    → Notion DB에서 할일 목록 조회
// POST   → 새 할일 생성
// PATCH  → 완료/미완료 토글
// DELETE → 할일 삭제 (아카이브)
//
// 인증 모델: 서버에 비밀을 저장하지 않습니다.
// 사용자가 자기 Notion 토큰과 DB ID를 요청 헤더로 보내면 그대로 Notion에 전달합니다.
//   Authorization: Bearer <사용자 Notion Integration Token>
//   X-Notion-Db:   <사용자 Notion Database ID>

const NOTION_VERSION = '2022-06-28';
const NOTION_API = 'https://api.notion.com/v1';

// 요청에서 사용자 자격증명(토큰 + DB ID) 추출
function getCreds(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '').trim();
  const dbId = (req.headers['x-notion-db'] || '').toString().trim();
  return { token, dbId };
}

// Notion API 공통 헤더 (사용자 토큰 사용)
function notionHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

// Notion 페이지 → 앱 투두 객체 변환
function pageToTodo(page) {
  const titleArr = page.properties['할일']?.title || [];
  return {
    notionId: page.id,
    text: titleArr[0]?.plain_text || '(제목 없음)',
    createdAt: page.properties['작성일']?.date?.start || page.created_time,
    doneAt: page.properties['완료일']?.date?.start || null,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Notion-Db');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { token, dbId } = getCreds(req);
  if (!token) return res.status(401).json({ error: 'Notion 토큰이 필요합니다.' });
  if (!dbId)  return res.status(400).json({ error: 'Notion 데이터베이스 ID가 필요합니다.' });

  try {
    // ── GET: 할일 목록 조회 ──────────────────────────────────
    if (req.method === 'GET') {
      const r = await fetch(`${NOTION_API}/databases/${dbId}/query`, {
        method: 'POST',
        headers: notionHeaders(token),
        body: JSON.stringify({
          sorts: [{ property: '작성일', direction: 'descending' }],
          filter: { property: '할일', title: { is_not_empty: true } },
        }),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        return res.status(r.status).json({ error: err.message || 'Notion 조회 실패' });
      }

      const data = await r.json();
      const todos = data.results.map(pageToTodo);
      return res.status(200).json({ todos });
    }

    // ── POST: 새 할일 생성 ──────────────────────────────────
    if (req.method === 'POST') {
      const { text, createdAt } = req.body || {};
      if (!text) return res.status(400).json({ error: '할일 내용이 없습니다.' });

      const r = await fetch(`${NOTION_API}/pages`, {
        method: 'POST',
        headers: notionHeaders(token),
        body: JSON.stringify({
          parent: { database_id: dbId },
          properties: {
            '할일': { title: [{ text: { content: text } }] },
            '작성일': { date: { start: createdAt || new Date().toISOString() } },
          },
        }),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        return res.status(r.status).json({ error: err.message || 'Notion 생성 실패' });
      }

      const page = await r.json();
      return res.status(201).json({ notionId: page.id });
    }

    // ── PATCH: 완료일 업데이트 (완료 ↔ 미완료) ──────────────
    if (req.method === 'PATCH') {
      const { notionId, doneAt } = req.body || {};
      if (!notionId) return res.status(400).json({ error: 'notionId가 없습니다.' });

      const r = await fetch(`${NOTION_API}/pages/${notionId}`, {
        method: 'PATCH',
        headers: notionHeaders(token),
        body: JSON.stringify({
          properties: {
            '완료일': doneAt ? { date: { start: doneAt } } : { date: null },
          },
        }),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        return res.status(r.status).json({ error: err.message || 'Notion 업데이트 실패' });
      }

      return res.status(200).json({ ok: true });
    }

    // ── DELETE: 할일 아카이브(삭제) ─────────────────────────
    if (req.method === 'DELETE') {
      const { notionId } = req.body || {};
      if (!notionId) return res.status(400).json({ error: 'notionId가 없습니다.' });

      const r = await fetch(`${NOTION_API}/pages/${notionId}`, {
        method: 'PATCH',
        headers: notionHeaders(token),
        body: JSON.stringify({ archived: true }),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        return res.status(r.status).json({ error: err.message || 'Notion 삭제 실패' });
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('[todos api error]', err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}
