-- 피드백 테이블
CREATE TABLE IF NOT EXISTS feedback (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  page       TEXT,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- 누구나 삽입 가능 (비로그인 포함)
CREATE POLICY "feedback_insert" ON feedback
  FOR INSERT WITH CHECK (true);

-- 본인만 조회
CREATE POLICY "feedback_select_own" ON feedback
  FOR SELECT USING (user_id = auth.uid());

-- admin 서비스롤은 모두 조회 가능 (Supabase 서비스키로 접근)
