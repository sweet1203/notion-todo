# 🌸 오늘의 할일 (Notion 연동 Todo)

설치 없이 브라우저에서 바로 쓰는 귀여운 할일 앱입니다.
**게스트 모드**(이 기기에만 저장)와 **Notion 연동 모드**(내 Notion DB와 양방향 동기화)를 지원합니다.

> 각 사용자가 **자기 Notion 토큰과 DB ID를 직접 입력**해 연동하는 멀티테넌트 구조입니다.
> 운영자의 Notion 정보는 어디에도 들어가지 않으며, 서버에 어떤 비밀도 저장하지 않습니다.

---

## 🚀 빠른 시작

1. 배포된 사이트에 접속하면 바로 **게스트 모드**로 사용할 수 있습니다. (할일이 브라우저 `localStorage`에 저장)
2. Notion과 동기화하려면 우측 상단 **⚙️ 버튼** → 토큰/DB ID 입력 → **연결**.

---

## 🔗 Notion 연동 설정 (4단계)

### ① 할일 DB 준비 (템플릿 복제 추천)

아래 속성을 가진 Notion 데이터베이스가 필요합니다.

| 속성 이름 | 타입 | 용도 |
|-----------|------|------|
| `할일`    | Title | 할일 내용 |
| `작성일`  | Date  | 생성 시각 |
| `완료일`  | Date  | 완료 시각 (비어 있으면 미완료) |

> 속성 **이름과 타입이 정확히 일치**해야 합니다. 가장 쉬운 방법은 제공된 템플릿을 복제하는 것입니다.
> 템플릿 URL: `index.html`의 `TEMPLATE_URL` 상수와 README의 이 줄을 실제 공개 템플릿 링크로 교체하세요.

직접 만들 경우: 새 데이터베이스 생성 → 기본 `Name`(Title) 속성을 `할일`로 이름 변경 → `작성일`(Date)·`완료일`(Date) 속성 추가.

### ② Integration 생성 & 토큰 발급

1. <https://www.notion.so/my-integrations> 접속 → **New integration**
2. 이름 입력 후 생성 → **Internal Integration Secret** 복사 (`secret_...` 또는 `ntn_...`)

### ③ DB를 Integration에 연결

1. 위에서 만든(또는 복제한) **DB 페이지**를 연다
2. 우측 상단 **⋯** → **Connections** (연결) → 방금 만든 integration 선택

> 이 단계를 건너뛰면 토큰이 맞아도 `404 (DB를 찾을 수 없음)` 에러가 납니다.

### ④ Database ID 확인

DB 페이지 URL에서 32자리 부분이 ID입니다.

```
https://www.notion.so/myworkspace/36f0fb7d31de8037af78cf3134d6c0b4?v=...
                                  └──────────── Database ID ───────────┘
```

> 앱에 입력할 때는 URL 전체를 붙여넣어도 자동으로 32자리만 추출합니다.

---

## 🔒 보안

- 입력한 Notion 토큰과 DB ID는 **사용자 본인 브라우저의 `localStorage`에만** 저장됩니다.
- 서버(`/api`)는 비밀을 **저장하지 않고** 요청을 그대로 Notion API로 전달하는 프록시 역할만 합니다.
  (Notion API는 브라우저 직접 호출이 CORS로 막혀 있어 프록시가 필요합니다.)
- 토큰은 integration에 **연결(Connections)한 DB에만** 접근할 수 있습니다.
- 공용 PC에서는 사용 후 ⚙️ → **연결 해제**로 토큰을 삭제하세요.

---

## 🗂 프로젝트 구조

```
.
├── index.html        # 앱 전체 (HTML + CSS + JS, 단일 파일)
├── api/
│   ├── auth.js        # POST /api/auth  — 토큰·DB·스키마 검증
│   └── todos.js       # /api/todos     — Notion CRUD 프록시 (GET/POST/PATCH/DELETE)
└── README.md
```

### API 요약

| 엔드포인트 | 메서드 | 인증 헤더 | 설명 |
|------------|--------|-----------|------|
| `/api/auth`  | POST | (body의 token/dbId) | 연결 검증 (토큰·접근권한·필수 속성) |
| `/api/todos` | GET  | `Authorization: Bearer <token>`, `X-Notion-Db: <dbId>` | 목록 조회 |
| `/api/todos` | POST | 동일 | 할일 생성 |
| `/api/todos` | PATCH | 동일 | 완료/미완료 토글 |
| `/api/todos` | DELETE | 동일 | 할일 삭제(아카이브) |

---

## ☁️ 배포 (Vercel)

이 레포는 **환경변수 설정이 필요 없습니다.** (비밀은 클라이언트가 입력)

1. 이 레포를 GitHub에 push
2. <https://vercel.com>에서 **New Project** → 이 레포 import
3. 프레임워크 프리셋: **Other** (정적 + `api/` 서버리스 함수 자동 인식)
4. Deploy

### 로컬 개발

```bash
npm i -g vercel     # 최초 1회
vercel dev          # /api 함수 포함 로컬 실행
```

> 정적 서버(`python3 -m http.server`)로도 게스트 모드는 테스트할 수 있지만,
> `/api` 함수가 동작하지 않아 Notion 연동은 `vercel dev`가 필요합니다.

---

## ✨ 기능

- 게스트/연동 모드 전환 (⚙️ 버튼)
- 할일 추가 · 완료 토글 · 삭제 · 완료 일괄 삭제
- 전체/진행중/완료 필터
- XSS 방어 (사용자 입력 이스케이프)
- 모바일 우선 반응형 UI
- 토큰 만료 시 게스트 모드로 자동 폴백
