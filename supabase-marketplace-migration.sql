-- ====================================================================
-- MIKY 마켓플레이스 마이그레이션 (Phase 1 + 2 + 3 스켈레톤)
-- 실행: Supabase Dashboard → SQL Editor에서 전체 실행
-- ====================================================================

-- ─── 1. partner_shops (파트너 정비소) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS partner_shops (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name                  text NOT NULL,
  owner_name            text NOT NULL,
  phone                 text NOT NULL,
  address               text NOT NULL,
  latitude              numeric,
  longitude             numeric,
  categories            text[] DEFAULT '{}',      -- ['brake','engine','transmission','ac',...]
  description           text,
  profile_image_url     text,
  business_number       text,                      -- 사업자등록번호
  status                text DEFAULT 'pending'
    CHECK (status IN ('pending','active','suspended')),
  -- Phase 2: 수수료율
  commission_rate       numeric DEFAULT 0.10,      -- 기본 10%
  -- Phase 3: 구독 플랜
  subscription_plan     text DEFAULT 'free'
    CHECK (subscription_plan IN ('free','basic','pro')),
  subscription_expires_at timestamptz,
  -- 실적 집계 (트리거로 자동 갱신)
  rating                numeric DEFAULT 0,
  review_count          integer DEFAULT 0,
  total_jobs            integer DEFAULT 0,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- ─── 2. repair_requests (소비자 수리 견적 요청) ─────────────────────────
CREATE TABLE IF NOT EXISTS repair_requests (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  conversation_id       uuid REFERENCES conversations(id) ON DELETE SET NULL,
  -- 진단 요약 (스냅샷)
  symptom_summary       text NOT NULL,
  diagnosis_category    text,
  urgency_level         text CHECK (urgency_level IN ('HIGH','MID','LOW')),
  -- 딜러 기준가 앵커 (AI 계산값)
  dealer_parts_min      integer,
  dealer_parts_max      integer,
  dealer_labor_min      integer,
  dealer_labor_max      integer,
  dealer_total_min      integer GENERATED ALWAYS AS (COALESCE(dealer_parts_min,0) + COALESCE(dealer_labor_min,0)) STORED,
  dealer_total_max      integer GENERATED ALWAYS AS (COALESCE(dealer_parts_max,0) + COALESCE(dealer_labor_max,0)) STORED,
  -- 소비자 입력
  contact_phone         text,
  preferred_location    text NOT NULL,
  preferred_latitude    numeric,
  preferred_longitude   numeric,
  preferred_date        date,
  consumer_notes        text,
  -- 차량 스냅샷
  vehicle_maker         text,
  vehicle_model         text,
  vehicle_year          integer,
  vehicle_mileage       integer,
  -- 상태 흐름
  status                text DEFAULT 'open'
    CHECK (status IN ('open','bidding','accepted','in_progress','completed','cancelled')),
  accepted_bid_id       uuid,                      -- 낙찰 후 FK 업데이트
  bid_count             integer DEFAULT 0,
  bid_deadline          timestamptz DEFAULT (now() + interval '48 hours'),
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- ─── 3. shop_bids (파트너 정비소 입찰) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_bids (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id            uuid REFERENCES repair_requests(id) ON DELETE CASCADE,
  shop_id               uuid REFERENCES partner_shops(id) ON DELETE CASCADE,
  -- 입찰 내용
  parts_cost            integer NOT NULL,
  labor_cost            integer NOT NULL,
  total_cost            integer GENERATED ALWAYS AS (parts_cost + labor_cost) STORED,
  estimated_days        integer DEFAULT 1,
  available_date        date,
  bid_notes             text,
  -- 상태
  status                text DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','rejected','expired')),
  -- Phase 2: 수수료
  commission_rate       numeric DEFAULT 0.10,
  commission_amount     integer,                   -- total_cost * commission_rate (낙찰 시 계산)
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- ─── 4. repair_jobs (낙찰 후 작업 관리) ────────────────────────────────
CREATE TABLE IF NOT EXISTS repair_jobs (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id            uuid REFERENCES repair_requests(id),
  bid_id                uuid REFERENCES shop_bids(id),
  shop_id               uuid REFERENCES partner_shops(id),
  user_id               uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- 실제 수리 결과
  actual_parts_cost     integer,
  actual_labor_cost     integer,
  actual_total_cost     integer,
  started_at            timestamptz,
  completed_at          timestamptz,
  status                text DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  -- Phase 2: 결제 정보 (토스페이먼츠)
  payment_status        text DEFAULT 'pending'
    CHECK (payment_status IN ('pending','paid','refunded')),
  payment_method        text,
  payment_key           text,                      -- 토스 결제키
  order_id              text,                      -- 주문ID
  paid_at               timestamptz,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- ─── 5. shop_reviews (리뷰) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_reviews (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id                uuid REFERENCES repair_jobs(id),
  shop_id               uuid REFERENCES partner_shops(id),
  user_id               uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rating                integer CHECK (rating BETWEEN 1 AND 5),
  content               text,
  is_verified           boolean DEFAULT true,      -- 실제 수리 완료 건만 true
  created_at            timestamptz DEFAULT now()
);

-- ─── 6. notifications (알림) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id               uuid REFERENCES partner_shops(id) ON DELETE CASCADE,
  type                  text NOT NULL,
    -- 'new_request' | 'new_bid' | 'bid_accepted' | 'bid_rejected'
    -- | 'job_complete' | 'payment_required' | 'review_request'
  title                 text NOT NULL,
  body                  text,
  data                  jsonb DEFAULT '{}',
  is_read               boolean DEFAULT false,
  created_at            timestamptz DEFAULT now()
);

-- ─── 인덱스 ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_partner_shops_user_id   ON partner_shops(user_id);
CREATE INDEX IF NOT EXISTS idx_partner_shops_status    ON partner_shops(status);
CREATE INDEX IF NOT EXISTS idx_partner_shops_latlon    ON partner_shops(latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_repair_requests_user_id ON repair_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_repair_requests_status  ON repair_requests(status);
CREATE INDEX IF NOT EXISTS idx_repair_requests_conv    ON repair_requests(conversation_id);

CREATE INDEX IF NOT EXISTS idx_shop_bids_request_id    ON shop_bids(request_id);
CREATE INDEX IF NOT EXISTS idx_shop_bids_shop_id       ON shop_bids(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_bids_status        ON shop_bids(status);

CREATE INDEX IF NOT EXISTS idx_repair_jobs_shop_id     ON repair_jobs(shop_id);
CREATE INDEX IF NOT EXISTS idx_repair_jobs_user_id     ON repair_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_repair_jobs_status      ON repair_jobs(status);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id   ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_shop_id   ON notifications(shop_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread    ON notifications(user_id, is_read) WHERE NOT is_read;

-- ─── RLS 활성화 ────────────────────────────────────────────────────────
ALTER TABLE partner_shops    ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_bids        ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_jobs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_reviews     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications    ENABLE ROW LEVEL SECURITY;

-- ─── RLS 정책 ──────────────────────────────────────────────────────────

-- partner_shops: 누구나 active 정비소 조회, 본인만 수정
CREATE POLICY "ps_select_active"  ON partner_shops FOR SELECT USING (status = 'active' OR auth.uid() = user_id);
CREATE POLICY "ps_insert_own"     ON partner_shops FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ps_update_own"     ON partner_shops FOR UPDATE USING (auth.uid() = user_id);

-- repair_requests: 본인이 생성/조회, 파트너는 open|bidding 요청 조회
CREATE POLICY "rr_select_own"     ON repair_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "rr_select_open"    ON repair_requests FOR SELECT
  USING (status IN ('open','bidding') AND EXISTS (
    SELECT 1 FROM partner_shops WHERE user_id = auth.uid() AND status = 'active'
  ));
CREATE POLICY "rr_insert_own"     ON repair_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rr_update_own"     ON repair_requests FOR UPDATE USING (auth.uid() = user_id);

-- shop_bids: 파트너는 자기 정비소 입찰 관리, 소비자는 본인 요청 입찰 조회
CREATE POLICY "sb_select_shop"    ON shop_bids FOR SELECT USING (
  EXISTS (SELECT 1 FROM partner_shops WHERE id = shop_bids.shop_id AND user_id = auth.uid())
);
CREATE POLICY "sb_select_consumer" ON shop_bids FOR SELECT USING (
  EXISTS (SELECT 1 FROM repair_requests WHERE id = shop_bids.request_id AND user_id = auth.uid())
);
CREATE POLICY "sb_insert_shop"    ON shop_bids FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM partner_shops WHERE id = shop_bids.shop_id AND user_id = auth.uid() AND status = 'active')
);
CREATE POLICY "sb_update_shop"    ON shop_bids FOR UPDATE USING (
  EXISTS (SELECT 1 FROM partner_shops WHERE id = shop_bids.shop_id AND user_id = auth.uid())
);

-- repair_jobs: 본인 소비자 + 해당 정비소
CREATE POLICY "rj_select"         ON repair_jobs FOR SELECT USING (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM partner_shops WHERE id = repair_jobs.shop_id AND user_id = auth.uid())
);
CREATE POLICY "rj_update_shop"    ON repair_jobs FOR UPDATE USING (
  EXISTS (SELECT 1 FROM partner_shops WHERE id = repair_jobs.shop_id AND user_id = auth.uid())
);

-- shop_reviews: 누구나 조회, 본인만 작성
CREATE POLICY "sr_select"         ON shop_reviews FOR SELECT USING (true);
CREATE POLICY "sr_insert_own"     ON shop_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

-- notifications: 본인 알림만
CREATE POLICY "notif_select"      ON notifications FOR SELECT USING (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM partner_shops WHERE id = notifications.shop_id AND user_id = auth.uid())
);
CREATE POLICY "notif_update"      ON notifications FOR UPDATE USING (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM partner_shops WHERE id = notifications.shop_id AND user_id = auth.uid())
);

-- ─── 트리거: repair_requests.bid_count 자동 갱신 ───────────────────────
CREATE OR REPLACE FUNCTION update_bid_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE repair_requests
  SET bid_count = (
    SELECT COUNT(*) FROM shop_bids
    WHERE request_id = COALESCE(NEW.request_id, OLD.request_id)
      AND status = 'pending'
  ),
  status = CASE
    WHEN (SELECT COUNT(*) FROM shop_bids WHERE request_id = COALESCE(NEW.request_id, OLD.request_id) AND status = 'pending') > 0
      AND status = 'open' THEN 'bidding'
    ELSE status
  END,
  updated_at = now()
  WHERE id = COALESCE(NEW.request_id, OLD.request_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_bid_count ON shop_bids;
CREATE TRIGGER trg_update_bid_count
  AFTER INSERT OR UPDATE OR DELETE ON shop_bids
  FOR EACH ROW EXECUTE FUNCTION update_bid_count();

-- ─── 트리거: shop_reviews → partner_shops.rating 갱신 ──────────────────
CREATE OR REPLACE FUNCTION update_shop_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE partner_shops
  SET rating = (
    SELECT ROUND(AVG(rating)::numeric, 1)
    FROM shop_reviews WHERE shop_id = COALESCE(NEW.shop_id, OLD.shop_id)
  ),
  review_count = (
    SELECT COUNT(*) FROM shop_reviews WHERE shop_id = COALESCE(NEW.shop_id, OLD.shop_id)
  ),
  updated_at = now()
  WHERE id = COALESCE(NEW.shop_id, OLD.shop_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_shop_rating ON shop_reviews;
CREATE TRIGGER trg_update_shop_rating
  AFTER INSERT OR UPDATE OR DELETE ON shop_reviews
  FOR EACH ROW EXECUTE FUNCTION update_shop_rating();

-- ─── 트리거: repair_jobs 완료 시 total_jobs 갱신 ───────────────────────
CREATE OR REPLACE FUNCTION update_shop_total_jobs()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    UPDATE partner_shops
    SET total_jobs = total_jobs + 1, updated_at = now()
    WHERE id = NEW.shop_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_shop_total_jobs ON repair_jobs;
CREATE TRIGGER trg_update_shop_total_jobs
  AFTER UPDATE ON repair_jobs
  FOR EACH ROW EXECUTE FUNCTION update_shop_total_jobs();

-- ─── Realtime 활성화 (Phase 2 실시간 알림용) ───────────────────────────
-- Supabase Dashboard → Database → Replication 에서 아래 테이블 활성화:
-- notifications, shop_bids, repair_requests

-- ─── 완료 메시지 ────────────────────────────────────────────────────────
DO $$ BEGIN
  RAISE NOTICE '✅ MIKY 마켓플레이스 마이그레이션 완료';
  RAISE NOTICE '  - partner_shops, repair_requests, shop_bids';
  RAISE NOTICE '  - repair_jobs, shop_reviews, notifications';
  RAISE NOTICE '  - RLS 정책, 트리거 모두 적용됨';
END $$;
