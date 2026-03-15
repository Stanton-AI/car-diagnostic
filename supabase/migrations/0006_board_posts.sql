-- 게시판 posts 테이블
CREATE TABLE IF NOT EXISTS posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category    TEXT NOT NULL DEFAULT '자유',  -- 정비후기 | Q&A | 정보공유 | 자유
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  like_count  INT NOT NULL DEFAULT 0,
  view_count  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 댓글 테이블
CREATE TABLE IF NOT EXISTS post_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

DO $
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'posts_select' AND tablename = 'posts') THEN
    EXECUTE 'CREATE POLICY posts_select ON posts FOR SELECT USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'posts_insert' AND tablename = 'posts') THEN
    EXECUTE 'CREATE POLICY posts_insert ON posts FOR INSERT WITH CHECK (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'posts_update' AND tablename = 'posts') THEN
    EXECUTE 'CREATE POLICY posts_update ON posts FOR UPDATE USING (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'posts_delete' AND tablename = 'posts') THEN
    EXECUTE 'CREATE POLICY posts_delete ON posts FOR DELETE USING (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'comments_select' AND tablename = 'post_comments') THEN
    EXECUTE 'CREATE POLICY comments_select ON post_comments FOR SELECT USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'comments_insert' AND tablename = 'post_comments') THEN
    EXECUTE 'CREATE POLICY comments_insert ON post_comments FOR INSERT WITH CHECK (auth.uid() = user_id)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'comments_delete' AND tablename = 'post_comments') THEN
    EXECUTE 'CREATE POLICY comments_delete ON post_comments FOR DELETE USING (auth.uid() = user_id)';
  END IF;
END $;
