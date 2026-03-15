-- posts 테이블에 차량 닉네임/모델 컬럼 추가
ALTER TABLE posts ADD COLUMN IF NOT EXISTS vehicle_nickname TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS vehicle_model    TEXT;
