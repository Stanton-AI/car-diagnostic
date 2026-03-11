-- ============================================================
-- V3 마이그레이션: 정밀진단 사진 + Storage 정책
-- Supabase Dashboard → SQL Editor에서 실행하세요
-- ============================================================

-- 1. precise_diagnoses에 photos 컬럼 추가
ALTER TABLE precise_diagnoses ADD COLUMN IF NOT EXISTS photos text[] DEFAULT array[]::text[];

-- 2. Storage 공개 읽기 정책 (repair-files 버킷)
--    공개 버킷이지만 명시적 정책으로 확실하게 보장
INSERT INTO storage.buckets (id, name, public)
  VALUES ('repair-files', 'repair-files', true)
  ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "repair_files_public_read" ON storage.objects;
CREATE POLICY "repair_files_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'repair-files');

DROP POLICY IF EXISTS "repair_files_auth_insert" ON storage.objects;
CREATE POLICY "repair_files_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'repair-files' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "repair_files_owner_delete" ON storage.objects;
CREATE POLICY "repair_files_owner_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'repair-files' AND auth.uid() IS NOT NULL);
