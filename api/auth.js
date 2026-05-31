// api/auth.js — Notion 연결 검증 엔드포인트
// 클라이언트가 POST /api/auth { token, dbId } 로 요청하면
// 해당 토큰으로 DB에 접근 가능한지, 그리고 '할일/작성일/완료일' 속성이
// 올바르게 존재하는지 검증합니다. 서버에는 아무 비밀도 저장하지 않습니다.

const NOTION_VERSION = '2022-06-28';
const NOTION_API = 'https://api.notion.com/v1';

// 필수 속성 정의: 이름 → 기대 타입
const REQUIRED_PROPS = {
  '할일': 'title',
  '작성일': 'date',
  '완료일': 'date',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { token, dbId } = req.body || {};

  if (!token) return res.status(400).json({ ok: false, error: 'Notion 토큰을 입력해주세요.' });
  if (!dbId)  return res.status(400).json({ ok: false, error: 'Notion 데이터베이스 ID를 입력해주세요.' });

  try {
    // DB 메타데이터 조회로 토큰·접근 권한·스키마를 한 번에 검증
    const r = await fetch(`${NOTION_API}/databases/${dbId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
      },
    });

    if (r.status === 401) {
      return res.status(200).json({ ok: false, error: '토큰이 올바르지 않아요. Integration 토큰을 다시 확인해주세요.' });
    }
    if (r.status === 404) {
      return res.status(200).json({ ok: false, error: 'DB를 찾을 수 없어요. DB ID가 맞는지, 그리고 DB를 Integration과 연결(Connections)했는지 확인해주세요.' });
    }
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.status(200).json({ ok: false, error: err.message || `Notion 오류 (${r.status})` });
    }

    const db = await r.json();
    const props = db.properties || {};

    // 필수 속성 존재 및 타입 검증
    const missing = [];
    const wrongType = [];
    for (const [name, type] of Object.entries(REQUIRED_PROPS)) {
      const p = props[name];
      if (!p) missing.push(name);
      else if (p.type !== type) wrongType.push(`${name}(${type} 필요, 현재 ${p.type})`);
    }

    if (missing.length || wrongType.length) {
      const parts = [];
      if (missing.length)   parts.push(`없는 속성: ${missing.join(', ')}`);
      if (wrongType.length) parts.push(`타입 불일치: ${wrongType.join(', ')}`);
      return res.status(200).json({
        ok: false,
        error: `DB 속성이 올바르지 않아요. (${parts.join(' / ')}) 제공된 템플릿을 복제해 사용하면 가장 쉽습니다.`,
      });
    }

    const dbTitle = (db.title || [])[0]?.plain_text || '제목 없는 DB';
    return res.status(200).json({ ok: true, dbTitle });

  } catch (err) {
    console.error('[auth api error]', err);
    return res.status(500).json({ ok: false, error: '서버 연결 실패. 잠시 후 다시 시도해주세요.' });
  }
}
