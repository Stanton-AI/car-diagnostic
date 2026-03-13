-- ============================================================
-- V5 마이그레이션: 정비 명세서 구조화 저장
-- Supabase Dashboard → SQL Editor에서 실행하세요
-- ============================================================

-- 1. repair_job_details 테이블
CREATE TABLE IF NOT EXISTS repair_job_details (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           uuid NOT NULL REFERENCES repair_jobs(id) ON DELETE CASCADE UNIQUE,
  -- 교체 부품 목록: [{name, part_number, qty, unit_cost, total_cost}]
  replaced_parts   jsonb NOT NULL DEFAULT '[]',
  -- 조치 내역: [{action, description, labor_cost}]
  action_items     jsonb NOT NULL DEFAULT '[]',
  -- 비용 합계
  parts_total      integer NOT NULL DEFAULT 0,
  labor_total      integer NOT NULL DEFAULT 0,
  final_total      integer NOT NULL DEFAULT 0,
  -- 명세서 원본
  invoice_images   text[] DEFAULT array[]::text[],
  ocr_raw_text     text,
  ocr_parsed_at    timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE repair_job_details ENABLE ROW LEVEL SECURITY;

-- 파트너: 자기 정비소 작업 전체 접근
CREATE POLICY "rjd_partner_all" ON repair_job_details
  FOR ALL USING (
    job_id IN (
      SELECT rj.id FROM repair_jobs rj
      JOIN partner_shops ps ON ps.id = rj.shop_id
      WHERE ps.user_id = auth.uid()
    )
  );

-- 소비자: 자기 수리건 읽기
CREATE POLICY "rjd_consumer_select" ON repair_job_details
  FOR SELECT USING (
    job_id IN (
      SELECT rj.id FROM repair_jobs rj
      JOIN repair_requests rr ON rr.id = rj.request_id
      WHERE rr.user_id = auth.uid()
    )
  );

-- 2. repair-files 스토리지 버킷 활성화 (명세서/수리사진용)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('repair-files', 'repair-files', true)
  ON CONFLICT DO NOTHING;

CREATE POLICY IF NOT EXISTS "repair_files_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'repair-files' AND auth.uid() IS NOT NULL);

CREATE POLICY IF NOT EXISTS "repair_files_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'repair-files');
