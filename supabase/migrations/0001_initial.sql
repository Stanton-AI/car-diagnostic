-- AI 중정비 진단 플랫폼 — 초기 스키마
-- Supabase SQL Editor에서 실행하거나 drizzle-kit migrate로 적용

-- Enums
create type fuel_type as enum ('gasoline', 'diesel', 'hybrid', 'electric', 'lpg');
create type urgency as enum ('HIGH', 'MID', 'LOW');
create type user_role as enum ('user', 'admin');
create type diagnosis_mode as enum ('free', 'paid', 'ab_test');

-- Users (Supabase Auth 연동)
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  role user_role not null default 'user',
  provider text not null,
  agreed_to_terms boolean not null default false,
  agreed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 신규 소셜 로그인 시 자동으로 users 레코드 생성하는 트리거
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, display_name, avatar_url, provider)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_user_meta_data->>'provider', new.app_metadata->>'provider', 'unknown')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Vehicles
create table vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  maker text not null,
  model text not null,
  year integer not null,
  mileage integer not null,
  fuel_type fuel_type not null,
  plate_number text,
  nickname text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vehicles_user_id_idx on vehicles(user_id);

-- Conversations (진단 세션)
create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  guest_session_id uuid,
  vehicle_id uuid references vehicles(id) on delete set null,
  messages jsonb not null default '[]'::jsonb,
  initial_symptom text not null,
  symptom_images text[] default array[]::text[],
  final_result jsonb,
  self_check_result jsonb,
  category text,
  urgency urgency,
  cost_min integer,
  cost_max integer,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_user_id_idx on conversations(user_id);
create index conversations_guest_session_idx on conversations(guest_session_id);
create index conversations_created_at_idx on conversations(created_at desc);

-- Workshops (파트너 정비소)
create table workshops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  phone text not null,
  categories text[] default array[]::text[],
  rating integer,
  review_count integer default 0,
  is_active boolean not null default true,
  joined_at timestamptz not null default now()
);

-- Admin Config (싱글톤)
create table admin_config (
  id integer primary key default 1,
  diagnosis_mode diagnosis_mode not null default 'free',
  free_users_ratio integer not null default 100,
  guest_max_diagnosis integer not null default 1,
  user_daily_limit integer not null default 0,
  maintenance_banner text,
  updated_at timestamptz not null default now()
);
insert into admin_config default values;

-- RLS (Row Level Security) 정책
alter table users enable row level security;
alter table vehicles enable row level security;
alter table conversations enable row level security;
alter table workshops enable row level security;
alter table admin_config enable row level security;

-- Users: 본인만 조회/수정
create policy "users_self_access" on users
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Vehicles: 본인만 CRUD
create policy "vehicles_owner_access" on vehicles
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Conversations: 본인 것 + public 링크 읽기
create policy "conversations_owner_access" on conversations
  using (auth.uid() = user_id or is_public = true);
create policy "conversations_owner_write" on conversations
  for insert with check (auth.uid() = user_id or user_id is null);
create policy "conversations_owner_update" on conversations
  for update using (auth.uid() = user_id);

-- Workshops: 모든 인증 사용자가 읽기 가능
create policy "workshops_read" on workshops
  for select using (is_active = true);

-- Admin Config: 모든 인증 사용자가 읽기 (관리자만 수정 - 서비스 키로 처리)
create policy "admin_config_read" on admin_config
  for select using (true);

-- Supabase Storage 버킷: 증상 이미지
insert into storage.buckets (id, name, public) values ('symptom-images', 'symptom-images', false);

create policy "symptom_images_upload" on storage.objects
  for insert with check (bucket_id = 'symptom-images');
create policy "symptom_images_read" on storage.objects
  for select using (bucket_id = 'symptom-images');
