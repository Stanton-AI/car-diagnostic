-- ─── MIKY Marketplace Bug Fixes ──────────────────────────────────────────
-- 반드시 supabase-marketplace-migration.sql 실행 후 적용할 것
-- Supabase Dashboard → SQL Editor 에서 실행

-- ─── Fix 1: RLS 정책 추가 ──────────────────────────────────────────────────
-- 문제: partner/jobs 페이지에서 repair_requests JOIN 시 null 반환
-- 원인: 파트너는 open|bidding 상태 요청만 조회 가능한데,
--       낙찰된 요청은 'accepted' 상태가 되어 기존 정책으로 조회 불가
-- 해결: 낙찰된 입찰을 보유한 파트너는 해당 요청도 조회 가능하도록 정책 추가

CREATE POLICY "rr_select_partner_won" ON repair_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM shop_bids sb
      JOIN partner_shops ps ON ps.id = sb.shop_id
      WHERE sb.request_id = repair_requests.id
        AND sb.status = 'accepted'
        AND ps.user_id = auth.uid()
    )
  );

-- ─── Fix 2: 어드민은 모든 repair_requests 조회 가능 ─────────────────────────
-- 문제: admin 페이지에서 marketplace 통계 쿼리 시 서비스 역할 필요
-- 해결: admin 역할 보유 사용자는 전체 조회 가능

CREATE POLICY "rr_select_admin" ON repair_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "ps_select_admin" ON partner_shops
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "rj_select_admin" ON repair_jobs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ─── Fix 3: 어드민 파트너샵 승인을 위한 UPDATE 정책 ─────────────────────────
CREATE POLICY "ps_update_admin" ON partner_shops
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ─── 확인용 쿼리 (실행 후 아래로 정책 목록 확인) ─────────────────────────────
-- SELECT policyname, tablename, cmd FROM pg_policies
-- WHERE tablename IN ('repair_requests','partner_shops','repair_jobs')
-- ORDER BY tablename, cmd;
