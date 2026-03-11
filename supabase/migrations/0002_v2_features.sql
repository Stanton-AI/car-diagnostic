-- ============================================================
-- V2 기능 마이그레이션: 날짜/시간, 정밀진단, 수리현황
-- Supabase Dashboard → SQL Editor에서 실행하세요
-- ============================================================

-- 1. repair_requests: 방문 희망 시간대 추가
ALTER TABLE repair_requests ADD COLUMN IF NOT EXISTS preferred_time_slot text;

-- 2. shop_bids: 작업 가능 시간대 추가
ALTER TABLE shop_bids ADD COLUMN IF NOT EXISTS available_time text;

-- 3. repair_jobs: 추가 컬럼
ALTER TABLE repair_jobs ADD COLUMN IF NOT EXISTS estimated_completion_at timestamptz;
ALTER TABLE repair_jobs ADD COLUMN IF NOT EXISTS completion_change_count integer NOT NULL DEFAULT 0;
ALTER TABLE repair_jobs ADD COLUMN IF NOT EXISTS mechanic_final_comment text;
ALTER TABLE repair_jobs ADD COLUMN IF NOT EXISTS invoice_url text;

-- 4. 정밀진단 테이블
CREATE TABLE IF NOT EXISTS precise_diagnoses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES repair_jobs(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES repair_requests(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES partner_shops(id) ON DELETE CASCADE,
  -- diagnosis_items: [{code, name, description, severity}]
  diagnosis_items jsonb NOT NULL DEFAULT '[]',
  -- parts_needed: [{part_name, part_code, unit_cost, qty}]
  parts_needed jsonb NOT NULL DEFAULT '[]',
  labor_cost integer NOT NULL DEFAULT 0,
  total_cost integer NOT NULL DEFAULT 0,
  mechanic_notes text,
  consumer_decision text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  consumer_decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE precise_diagnoses ENABLE ROW LEVEL SECURITY;

-- 파트너: 자기 정비소의 진단 전체 접근
CREATE POLICY "pd_partner_all" ON precise_diagnoses
  FOR ALL USING (
    shop_id IN (SELECT id FROM partner_shops WHERE user_id = auth.uid())
  );

-- 소비자: 자기 요청에 연결된 진단 읽기
CREATE POLICY "pd_consumer_select" ON precise_diagnoses
  FOR SELECT USING (
    request_id IN (SELECT id FROM repair_requests WHERE user_id = auth.uid())
  );

-- 소비자: 진단 승인/거절 업데이트
CREATE POLICY "pd_consumer_update" ON precise_diagnoses
  FOR UPDATE USING (
    request_id IN (SELECT id FROM repair_requests WHERE user_id = auth.uid())
  );

-- 5. 수리 현황 업데이트 테이블
CREATE TABLE IF NOT EXISTS repair_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES repair_jobs(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES partner_shops(id) ON DELETE CASCADE,
  content text NOT NULL,
  photos text[] DEFAULT array[]::text[],
  estimated_completion_at timestamptz, -- ETA 변경 시에만 채움
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE repair_updates ENABLE ROW LEVEL SECURITY;

-- 파트너: 자기 정비소의 업데이트 전체 접근
CREATE POLICY "ru_partner_all" ON repair_updates
  FOR ALL USING (
    shop_id IN (SELECT id FROM partner_shops WHERE user_id = auth.uid())
  );

-- 소비자: 자기 수리건의 업데이트 읽기 (repair_jobs → repair_requests → user)
CREATE POLICY "ru_consumer_select" ON repair_updates
  FOR SELECT USING (
    job_id IN (
      SELECT rj.id FROM repair_jobs rj
      JOIN repair_requests rr ON rr.id = rj.request_id
      WHERE rr.user_id = auth.uid()
    )
  );

-- 6. Supabase Storage: repair-files 버킷 (아래 코드는 Supabase 대시보드에서 수동으로 버킷 생성 필요)
-- Storage > Buckets > New bucket: 이름 "repair-files", Public: ON
-- 또는 아래 SQL 실행:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('repair-files', 'repair-files', true) ON CONFLICT DO NOTHING;

-- Storage RLS (repair-files 버킷)
-- CREATE POLICY "파트너 업로드" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'repair-files' AND auth.uid() IS NOT NULL);
-- CREATE POLICY "공개 읽기" ON storage.objects FOR SELECT USING (bucket_id = 'repair-files');
