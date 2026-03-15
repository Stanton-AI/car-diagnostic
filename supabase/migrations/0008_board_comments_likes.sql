-- posts 테이블에 images 컬럼 추가
ALTER TABLE posts ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';

-- post_comments 에 parent_id 추가 (대댓글)
ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES post_comments(id) ON DELETE CASCADE;

-- 좋아요 테이블
CREATE TABLE IF NOT EXISTS post_likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

DO $
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'likes_select' AND tablename = 'post_likes') THEN
    EXECUTE 'CREATE POLICY likes_select ON post_likes FOR SELECT USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'likes_insert' AND tablename = 'post_likes') THEN
    EXECUTE 'CREATE POLICY likes_insert ON post_likes FOR INSERT WITH CHECK (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'likes_delete' AND tablename = 'post_likes') THEN
    EXECUTE 'CREATE POLICY likes_delete ON post_likes FOR DELETE USING (auth.uid() = user_id)';
  END IF;
END $;
