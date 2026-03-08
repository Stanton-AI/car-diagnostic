/**
 * 임시 마이그레이션 스크립트
 * 실행: node scripts/migrate.mjs
 *
 * Supabase 프로젝트에 직접 SQL을 실행합니다.
 * DB URL 또는 Management API 토큰이 필요합니다.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

const PROJECT_REF = 'ntsfeapiqwzjrqmnuozh'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50c2ZlYXBpcXd6anJxbW51b3poIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg5NjI5NCwiZXhwIjoyMDg4NDcyMjk0fQ.Q9jeYKOVICuSJKzLrH4vfiQGhJ00wa6k4nh1kMvIdWU'

// 환경변수에서 토큰 읽기
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN

const migrationSQL = readFileSync(
  resolve('./supabase/migrations/0001_initial.sql'),
  'utf-8'
)

async function runMigrationViaManagementAPI(token) {
  console.log('🔑 Supabase Management API 로 마이그레이션 시도...')

  // 쿼리를 세미콜론으로 분리하여 개별 실행
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  let successCount = 0
  let skipCount = 0

  for (const stmt of statements) {
    const query = stmt + ';'
    try {
      const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      })

      const data = await res.json()

      if (!res.ok) {
        const msg = data.message || data.error || JSON.stringify(data)
        if (msg.includes('already exists') || msg.includes('duplicate')) {
          console.log(`  ⏭️  이미 존재: ${query.substring(0, 60)}...`)
          skipCount++
        } else {
          console.error(`  ❌ 오류: ${msg}`)
          console.error(`     쿼리: ${query.substring(0, 80)}`)
        }
      } else {
        console.log(`  ✅ 성공: ${query.substring(0, 60)}...`)
        successCount++
      }
    } catch (e) {
      console.error(`  ❌ 네트워크 오류: ${e.message}`)
    }
  }

  console.log(`\n완료: ${successCount}개 성공, ${skipCount}개 스킵`)
}

async function main() {
  if (SUPABASE_ACCESS_TOKEN) {
    await runMigrationViaManagementAPI(SUPABASE_ACCESS_TOKEN)
  } else {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║          Supabase 마이그레이션 실행 안내                        ║
╚══════════════════════════════════════════════════════════════╝

SUPABASE_ACCESS_TOKEN 환경변수가 없습니다.

[ 방법 1 - 브라우저 SQL 에디터 (가장 간단) ]
1. https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new 접속
2. 아래 SQL 파일 내용을 복사해서 붙여넣기:
   supabase/migrations/0001_initial.sql
3. Run 버튼 클릭

[ 방법 2 - 환경변수로 스크립트 실행 ]
1. https://supabase.com/dashboard/account/tokens 에서 Access Token 생성
2. 아래 명령 실행:
   SUPABASE_ACCESS_TOKEN=your_token node scripts/migrate.mjs

[ 방법 3 - Supabase CLI 사용 ]
   npx supabase login
   npx supabase link --project-ref ${PROJECT_REF}
   npx supabase db push
`)
  }
}

main().catch(console.error)
