-- ランキング用テーブル（1人1行。匿名ログインのユーザーIDがそのまま主キー）
create table if not exists public.scores (
  id uuid primary key references auth.users(id) on delete cascade,
  nick text not null default 'インターン' check (char_length(nick) <= 12),
  look jsonb not null default '{}'::jsonb,
  best integer not null default 0 check (best between 0 and 100000),
  best_rank text check (best_rank is null or char_length(best_rank) <= 2),
  type text check (type is null or char_length(type) <= 12),
  titles jsonb not null default '[]'::jsonb,
  types jsonb not null default '[]'::jsonb,
  plays integer not null default 0 check (plays between 0 and 100000),
  updated_at timestamptz not null default now(),
  constraint scores_payload_size check (pg_column_size(look) < 4000 and pg_column_size(titles) < 4000 and pg_column_size(types) < 1000)
);

create index if not exists scores_best_idx on public.scores (best desc);

alter table public.scores enable row level security;

drop policy if exists "scores are readable by everyone" on public.scores;
create policy "scores are readable by everyone" on public.scores for select using (true);

drop policy if exists "players insert own score" on public.scores;
create policy "players insert own score" on public.scores for insert to authenticated with check (auth.uid() = id);

drop policy if exists "players update own score" on public.scores;
create policy "players update own score" on public.scores for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- ランキングをリアルタイム更新するため
do $$ begin
  alter publication supabase_realtime add table public.scores;
exception when duplicate_object then null; end $$;
