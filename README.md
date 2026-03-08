# MIKY — AI 자동차 중정비 진단 플랫폼

> MVP v2.0 | Next.js 14 + Supabase + Claude API

---

## 🚀 빠른 시작

### 1. 패키지 설치

```bash
npm install
```

### 2. 환경변수 설정

```bash
cp .env.local.example .env.local
```

`.env.local` 파일을 열어 아래 값을 채워주세요:

| 변수 | 설명 | 획득 방법 |
|------|------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | supabase.com → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | 위와 동일 |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (서버 전용) | 위와 동일 |
| `DATABASE_URL` | Postgres 직접 연결 URL | supabase.com → Settings → Database |
| `ANTHROPIC_API_KEY` | Claude API 키 | console.anthropic.com |

### 3. Supabase 데이터베이스 초기화

Supabase 대시보드 → SQL Editor에서 아래 파일 실행:

```
supabase/migrations/0001_initial.sql
```

### 4. Supabase OAuth 설정

**카카오 로그인:**
1. [카카오 개발자 콘솔](https://developers.kakao.com) → 앱 생성
2. REST API 키 복사 → `.env.local`의 `KAKAO_CLIENT_ID`에 입력
3. Supabase 대시보드 → Authentication → Providers → Kakao 활성화
4. 리디렉션 URI: `https://[프로젝트-ref].supabase.co/auth/v1/callback`

**구글 로그인:**
1. [Google Cloud Console](https://console.cloud.google.com) → OAuth 2.0 클라이언트 생성
2. Supabase → Authentication → Providers → Google 활성화

### 5. 개발 서버 실행

```bash
npm run dev
```

→ http://localhost:3000 열기

---

## 📁 프로젝트 구조

```
car-diagnostic/
├── app/
│   ├── (auth)/login/          # 소셜 로그인 페이지
│   ├── (main)/
│   │   ├── chat/              # 핵심: 증상 입력 + AI 진단 채팅
│   │   ├── main/              # 홈 대시보드 (로그인 후)
│   │   ├── results/[id]/      # 진단 결과 + 공유 링크
│   │   ├── history/           # 진단 이력
│   │   └── vehicles/new/      # 차량 등록
│   ├── admin/                 # 관리자 (A/B 테스트 제어)
│   └── api/
│       ├── diagnose/          # Claude API 서버사이드 호출
│       └── conversations/     # 대화 저장/불러오기
├── components/
│   ├── chat/                  # ChatHeader, MessageBubble, QuestionChoices, ChatInput, TypingIndicator
│   ├── diagnosis/             # DiagnosisResultCard
│   └── shared/                # LoginGateModal
├── lib/
│   ├── supabase/              # client.ts / server.ts
│   ├── claude/                # diagnose.ts (프롬프트 + API 호출)
│   └── diagnostic/            # questions.ts (질문 DB 로직)
├── data/
│   └── diagnostic-questions.json  # Excel → JSON 변환 (78개 질문)
├── supabase/
│   ├── schema.ts              # Drizzle ORM 스키마
│   └── migrations/            # SQL 마이그레이션
└── types/index.ts             # TypeScript 타입 정의
```

---

## 🔑 핵심 기능

### 진단 플로우
1. **자유 증상 입력** (비로그인 허용) + 이미지 첨부 옵션
2. **AI 1차 분석** → 정보 부족 시 동적 추가 질문 (최대 5개)
3. **2~3단계 답변** 후 로그인 유도 소프트 게이트
4. **진단 결과** — 원인 확률 / 부품+공임비 분리 / 긴급도 / 자가점검 팁
5. **자가점검 → 재진단** 흐름

### 관리자 기능 (`/admin`)
- 무료/유료/A/B 테스트 모드 즉시 전환
- 비로그인 최대 진단 횟수 조정
- 일일 진단 한도 설정
- 홈 공지 배너 관리

---

## 🌐 Vercel 배포

```bash
# Vercel CLI 설치
npm i -g vercel

# 배포
vercel --prod
```

Vercel 환경변수에 `.env.local` 값 동일하게 추가 필요.

---

## 📋 추후 작업 목록

- [ ] 공공데이터포털 자동차 API 연동 (API 승인 후)
- [ ] 카카오 공유 SDK 연동
- [ ] 파트너 정비소 관리 UI (Admin)
- [ ] OG Image 자동 생성 (결과 공유용)
- [ ] 음성 입력 / 동영상 진단 (v2.0)
- [ ] B2B 정비소 대시보드 (v1.1)
- [ ] 온라인 결제 PG 연동 (사업자 등록 후)

---

## 🎨 디자인 참조

- **색상**: Primary Purple `#5B4FCF` / Surface `#F8F7FF`
- **Stitch Concept**: MIKY 채팅 UI, 진단 결과 확률 바, 비용 카드
- **레이아웃**: 모바일 우선 (max-width: 480px), 웹 앱 반응형
