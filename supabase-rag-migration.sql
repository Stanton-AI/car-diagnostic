-- 1. pgvector 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 컬럼 추가 (이미 있으면 무시)
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS actual_repair JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS variant TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 3. 빠른 유사도 검색을 위한 인덱스
CREATE INDEX IF NOT EXISTS conversations_embedding_idx
  ON conversations USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 4. 유사 케이스 검색 RPC 함수
CREATE OR REPLACE FUNCTION match_conversations(
  query_embedding vector(1536),
  match_count int DEFAULT 3
)
RETURNS TABLE (
  id uuid,
  initial_symptom text,
  final_result jsonb,
  actual_repair jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.initial_symptom,
    c.final_result,
    c.actual_repair,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM conversations c
  WHERE c.actual_repair IS NOT NULL
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
