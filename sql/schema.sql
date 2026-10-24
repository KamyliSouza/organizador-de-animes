-- =====================================================================
-- KamyList — esquema do banco (Supabase / PostgreSQL)
--
-- Como usar: Supabase > SQL Editor > New query > cole TUDO > Run.
-- Pode rodar de novo sem medo: o script é idempotente (não duplica nada).
--
-- Resumo da segurança:
--   * Cada pessoa só lê e escreve as PRÓPRIAS obras (RLS).
--   * Obras de outras pessoas só aparecem pelas funções get_public_entries()
--     e list_public_profiles(), e apenas se o perfil estiver marcado como
--     público. As anotações privadas só saem se a pessoa permitir.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Perfis
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text not null,
  display_name text not null default '',
  bio          text not null default '',
  is_public    boolean not null default false,
  show_notes   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint profiles_username_format  check (username ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_display_name_len check (char_length(display_name) <= 40),
  constraint profiles_bio_len          check (char_length(bio) <= 200)
);

create unique index if not exists profiles_username_key on public.profiles (username);


-- ---------------------------------------------------------------------
-- 2. Obras (animes, filmes e séries de cada pessoa)
-- ---------------------------------------------------------------------
create table if not exists public.entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  title       text not null,
  category    text not null default 'Anime',
  status      text not null default 'planned',
  rating      smallint not null default 0,
  tags        text[] not null default '{}',
  air_day     text,
  notes       text,
  cover_image text,
  description text,
  genres      text[] not null default '{}',
  seasons     jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint entries_title_len    check (char_length(title) between 1 and 200),
  constraint entries_category     check (category in ('Anime', 'Filme', 'Série')),
  constraint entries_status       check (status in ('watching', 'planned', 'completed')),
  constraint entries_rating       check (rating between 0 and 5),
  constraint entries_tags_len     check (cardinality(tags) <= 20),
  constraint entries_genres_len   check (cardinality(genres) <= 20),
  constraint entries_air_day      check (air_day is null or air_day in
                                    ('Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo')),
  constraint entries_notes_len    check (notes is null or char_length(notes) <= 5000),
  constraint entries_desc_len     check (description is null or char_length(description) <= 10000),
  -- só aceita capas em https (impede javascript:, data: etc.)
  constraint entries_cover_https  check (cover_image is null
                                    or (cover_image ~ '^https://' and char_length(cover_image) <= 600)),
  constraint entries_seasons_shape check (jsonb_typeof(seasons) = 'array'
                                    and jsonb_array_length(seasons) <= 100
                                    and octet_length(seasons::text) <= 200000)
);

create index if not exists entries_user_created_idx on public.entries (user_id, created_at desc);


-- ---------------------------------------------------------------------
-- 3. Gatilhos
-- ---------------------------------------------------------------------

-- 3a. Mantém updated_at atualizado
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists entries_set_updated_at on public.entries;
create trigger entries_set_updated_at before update on public.entries
  for each row execute function public.set_updated_at();

-- 3b. Cria o perfil automaticamente quando alguém se cadastra.
--     O nome de usuário vem de options.data.username no signUp().
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted     text := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
  final_name text;
  attempts   int := 0;
  shown_name text;
begin
  if wanted !~ '^[a-z0-9_]{3,20}$' then
    wanted := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  final_name := wanted;
  while exists (select 1 from public.profiles where username = final_name) and attempts < 5 loop
    final_name := left(wanted, 14) || '_' || substr(md5(random()::text), 1, 5);
    attempts := attempts + 1;
  end loop;

  shown_name := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), wanted), 40);

  insert into public.profiles (id, username, display_name)
  values (new.id, final_name, shown_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3c. Limite de obras por conta (proteção contra abuso do plano gratuito)
create or replace function public.enforce_entry_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.entries where user_id = new.user_id) >= 2000 then
    raise exception 'Limite de 2000 obras por conta atingido.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists entries_enforce_limit on public.entries;
create trigger entries_enforce_limit before insert on public.entries
  for each row execute function public.enforce_entry_limit();


-- ---------------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.entries  enable row level security;

-- Perfis: qualquer pessoa vê perfis públicos; cada um vê e edita o seu.
-- (Não existe política de INSERT/DELETE: o perfil nasce pelo gatilho e some
--  junto com a conta.)
drop policy if exists "profiles_select_public_or_own" on public.profiles;
create policy "profiles_select_public_or_own" on public.profiles
  for select to anon, authenticated
  using (is_public or id = (select auth.uid()));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Obras: somente o dono lê e escreve diretamente na tabela.
drop policy if exists "entries_select_own" on public.entries;
create policy "entries_select_own" on public.entries
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "entries_insert_own" on public.entries;
create policy "entries_insert_own" on public.entries
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "entries_update_own" on public.entries;
create policy "entries_update_own" on public.entries
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "entries_delete_own" on public.entries;
create policy "entries_delete_own" on public.entries
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Visitantes (sem login) nunca tocam na tabela de obras.
revoke all on public.entries from anon;


-- ---------------------------------------------------------------------
-- 5. Funções públicas (usadas pelo site via supabase.rpc)
-- ---------------------------------------------------------------------

-- Obras de um perfil público. As anotações só saem se a pessoa permitir.
create or replace function public.get_public_entries(p_username text)
returns table (
  id          uuid,
  title       text,
  category    text,
  status      text,
  rating      smallint,
  tags        text[],
  air_day     text,
  notes       text,
  cover_image text,
  description text,
  genres      text[],
  seasons     jsonb,
  created_at  timestamptz,
  updated_at  timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.title, e.category, e.status, e.rating, e.tags, e.air_day,
         case when p.show_notes then e.notes else null end,
         e.cover_image, e.description, e.genres, e.seasons,
         e.created_at, e.updated_at
  from public.entries e
  join public.profiles p on p.id = e.user_id
  where p.username = lower(p_username)
    and p.is_public
  order by e.created_at desc;
$$;

-- Lista de perfis públicos com contagens (página "Explorar").
create or replace function public.list_public_profiles(p_query text default '', p_limit int default 30)
returns table (
  username     text,
  display_name text,
  bio          text,
  total        bigint,
  watching     bigint,
  completed    bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.username, p.display_name, p.bio,
         count(e.id)                                          as total,
         count(e.id) filter (where e.status = 'watching')     as watching,
         count(e.id) filter (where e.status = 'completed')    as completed
  from public.profiles p
  left join public.entries e on e.user_id = p.id
  where p.is_public
    and (
      coalesce(trim(p_query), '') = ''
      or strpos(p.username, lower(trim(p_query))) > 0
      or strpos(lower(p.display_name), lower(trim(p_query))) > 0
    )
  group by p.id
  order by count(e.id) desc, p.username
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

-- Checagem de nome de usuário livre (usada na tela de cadastro).
create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p_username, '') ~ '^[a-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles where username = lower(p_username));
$$;

-- Só quem precisa pode executar cada função.
revoke all on function public.get_public_entries(text)            from public;
revoke all on function public.list_public_profiles(text, int)     from public;
revoke all on function public.username_available(text)            from public;
revoke all on function public.handle_new_user()                   from public, anon, authenticated;
revoke all on function public.enforce_entry_limit()               from public, anon, authenticated;

grant execute on function public.get_public_entries(text)         to anon, authenticated;
grant execute on function public.list_public_profiles(text, int)  to anon, authenticated;
grant execute on function public.username_available(text)         to anon, authenticated;
