-- ============================================================
-- V4 마이그레이션: 수리 완료 사진 컬럼 추가
-- Supabase Dashboard → SQL Editor에서 실행하세요
-- ============================================================

ALTER TABLE repair_jobs ADD COLUMN IF NOT EXISTS completion_photos text[] DEFAULT array[]::text[];
