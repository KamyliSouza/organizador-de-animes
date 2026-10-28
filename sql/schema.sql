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
--   * Fotos de perfil: bucket público "avatars", uma foto por pessoa, só a dona
--     envia/troca/apaga a sua (seção 6).
--   * Seguir: a tabela "follows" não é acessível direto; tudo passa por funções
--     que respeitam perfil público/privado e a aprovação de pedidos (seção 5).
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
  avatar_v     bigint  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint profiles_username_format  check (username ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_display_name_len check (char_length(display_name) <= 40),
  constraint profiles_bio_len          check (char_length(bio) <= 200)
);

create unique index if not exists profiles_username_key on public.profiles (username);

-- Atualização para quem já tinha rodado uma versão antiga deste script. Seguro rodar sempre.
--   * avatar_v: "versão" da foto de perfil (0 = sem foto). O site usa o número no endereço da
--     imagem para o navegador não mostrar uma foto antiga em cache depois que ela é trocada.
alter table public.profiles add column if not exists avatar_v bigint not null default 0;
alter table public.profiles drop constraint if exists profiles_avatar_v;
alter table public.profiles add  constraint profiles_avatar_v check (avatar_v >= 0);
--   * palette: preset de cores escolhido pela pessoa (ex.: 'oceano'). Aceita qualquer id curto (minúsculas, números e
--     hífen): quem decide quais presets existem é o site (css/palettes.css), então criar um preset novo não exige SQL.
alter table public.profiles add column if not exists palette text not null default 'default';
alter table public.profiles drop constraint if exists profiles_palette_format;
alter table public.profiles add  constraint profiles_palette_format check (palette ~ '^[a-z0-9-]{1,24}$');


-- ---------------------------------------------------------------------
-- 2. Obras (animes, filmes, séries, mangás e light novels de cada pessoa)
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
  favorite    boolean not null default false,
  source_ref  text,
  review      text,
  review_spoiler boolean not null default false,
  activity_at   timestamptz,
  activity_kind text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint entries_title_len    check (char_length(title) between 1 and 200),
  constraint entries_category     check (category in ('Anime', 'Filme', 'Série', 'Mangá', 'Light novel')),
  constraint entries_status       check (status in ('watching', 'planned', 'completed', 'on_hold', 'dropped')),
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

-- Atualização para quem já tinha rodado uma versão antiga deste script. Seguro rodar sempre.
--   * status "dropped" (Dropado) e "on_hold" (Em espera)
--   * favorite: obra fixada como favorita no perfil
--   * source_ref: código da obra na fonte de busca (ex.: mal:52991), usado para achar repetidas
alter table public.entries drop constraint if exists entries_status;
alter table public.entries add  constraint entries_status
  check (status in ('watching', 'planned', 'completed', 'on_hold', 'dropped'));

alter table public.entries add column if not exists favorite   boolean not null default false;
alter table public.entries add column if not exists source_ref text;
alter table public.entries drop constraint if exists entries_source_ref;
alter table public.entries add  constraint entries_source_ref
  check (source_ref is null or source_ref ~ '^[a-z]{2,10}:[a-z0-9_-]{1,30}$');

--   * review / review_spoiler: a "análise" que a pessoa escreve sobre a obra (aparece no feed e para
--     quem pode ver a biblioteca). É DIFERENTE das anotações privadas (coluna notes).
--   * activity_at / activity_kind: a última coisa "publicável" que aconteceu com a obra (adicionada,
--     status mudou ou análise escrita). O feed é montado a partir disso; quem preenche é o gatilho
--     entries_set_activity, nunca o site. Obras antigas ficam sem atividade (não entram no feed).
alter table public.entries add column if not exists review         text;
alter table public.entries add column if not exists review_spoiler boolean not null default false;
alter table public.entries add column if not exists activity_at    timestamptz;
alter table public.entries add column if not exists activity_kind  text;
alter table public.entries drop constraint if exists entries_review_len;
alter table public.entries add  constraint entries_review_len
  check (review is null or char_length(review) <= 2000);
alter table public.entries drop constraint if exists entries_activity_kind;
alter table public.entries add  constraint entries_activity_kind
  check (activity_kind is null or activity_kind in ('added', 'status', 'review'));

create index if not exists entries_activity_idx on public.entries (user_id, activity_at desc, id desc)
  where activity_at is not null;

-- Mangás e light novels (seção "Ler"). Seguro rodar sempre.
--   * category passa a aceitar 'Mangá' e 'Light novel'
--   * chapters_read / chapters_total / volumes_read / volumes_total: o progresso de leitura é por contador
--     (total 0 = não se sabe, por exemplo obra ainda em publicação). Essas obras não usam "seasons" (fica []).
--   * origin: país de origem em 2 letras (KR = manhwa, CN = manhua...), para o selo no card. Vazio = Japão/desconhecido.
alter table public.entries drop constraint if exists entries_category;
alter table public.entries add  constraint entries_category
  check (category in ('Anime', 'Filme', 'Série', 'Mangá', 'Light novel'));

alter table public.entries add column if not exists chapters_read  integer not null default 0;
alter table public.entries add column if not exists chapters_total integer not null default 0;
alter table public.entries add column if not exists volumes_read   integer not null default 0;
alter table public.entries add column if not exists volumes_total  integer not null default 0;
alter table public.entries add column if not exists origin         text;
alter table public.entries drop constraint if exists entries_read_counts;
alter table public.entries add  constraint entries_read_counts check (
  chapters_read  between 0 and 99999 and chapters_total between 0 and 99999
  and volumes_read between 0 and 9999 and volumes_total between 0 and 9999
  and (chapters_total = 0 or chapters_read <= chapters_total)
  and (volumes_total  = 0 or volumes_read  <= volumes_total));
alter table public.entries drop constraint if exists entries_origin;
alter table public.entries add  constraint entries_origin check (origin is null or origin ~ '^[A-Z]{2}$');


-- ---------------------------------------------------------------------
-- 2b. Seguidores
--   pending  = pedido feito a um perfil privado, esperando aprovação da dona
--   accepted = pode ver a biblioteca e aparece no feed de quem segue
-- A tabela fica fechada (sem acesso direto): só as funções da seção 5 mexem nela.
-- ---------------------------------------------------------------------
create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  status      text not null default 'pending',
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_not_self check (follower_id <> followee_id),
  constraint follows_status   check (status in ('pending', 'accepted'))
);

create index if not exists follows_followee_idx on public.follows (followee_id, status, created_at desc);

alter table public.follows enable row level security;
revoke all on public.follows from anon, authenticated;


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

-- 3d. Atividade da obra (alimenta o feed). Só estes eventos contam:
--       obra adicionada, status mudou, análise escrita/alterada.
--     Marcar episódios, favoritar, mudar tags etc. NÃO geram atividade.
--     Importações (backup / lista antiga) chegam com activity_kind = 'silent' e não entram no feed.
--     O que o site mandar nas colunas activity_* é ignorado: quem decide é este gatilho.
create or replace function public.set_entry_activity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.activity_kind = 'silent' then
      new.activity_at   := null;
      new.activity_kind := null;
    else
      new.activity_at   := now();
      new.activity_kind := case when coalesce(btrim(new.review), '') <> '' then 'review' else 'added' end;
    end if;
  elsif coalesce(btrim(new.review), '') <> '' and new.review is distinct from old.review then
    new.activity_at   := now();
    new.activity_kind := 'review';
  elsif new.status is distinct from old.status then
    new.activity_at   := now();
    new.activity_kind := 'status';
  else
    new.activity_at   := old.activity_at;
    new.activity_kind := old.activity_kind;
  end if;
  return new;
end;
$$;

drop trigger if exists entries_set_activity on public.entries;
create trigger entries_set_activity before insert or update on public.entries
  for each row execute function public.set_entry_activity();

-- 3e. Perfil que vira público: os pedidos pendentes são aceitos (já poderiam ver tudo mesmo).
create or replace function public.accept_pending_follows()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_public and not old.is_public then
    update public.follows set status = 'accepted' where followee_id = new.id and status = 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_accept_pending on public.profiles;
create trigger profiles_accept_pending after update of is_public on public.profiles
  for each row execute function public.accept_pending_follows();


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

-- Obras de um perfil. Quem pode ver: qualquer pessoa (perfil público), a própria dona,
-- ou quem a dona já aceitou como seguidor (perfil privado). As anotações só saem se a dona permitir;
-- a análise (review) sai junto com a obra.
-- (drop antes: o formato do resultado ganhou colunas novas: "review", "review_spoiler" e os contadores de leitura)
drop function if exists public.get_public_entries(text);
create function public.get_public_entries(p_username text)
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
  favorite    boolean,
  review      text,
  review_spoiler boolean,
  chapters_read  integer,
  chapters_total integer,
  volumes_read   integer,
  volumes_total  integer,
  origin         text,
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
         e.cover_image, e.description, e.genres, e.seasons, e.favorite,
         e.review, e.review_spoiler,
         e.chapters_read, e.chapters_total, e.volumes_read, e.volumes_total, e.origin,
         e.created_at, e.updated_at
  from public.entries e
  join public.profiles p on p.id = e.user_id
  where p.username = lower(p_username)
    and (
      p.is_public
      or p.id = (select auth.uid())
      or exists (select 1 from public.follows f
                 where f.follower_id = (select auth.uid()) and f.followee_id = p.id and f.status = 'accepted')
    )
  order by e.created_at desc;
$$;

-- Lista de perfis públicos com contagens (página "Explorar").
-- (drop antes: o formato do resultado ganhou as colunas "id" e "avatar_v", usadas para a foto)
drop function if exists public.list_public_profiles(text, int);
create function public.list_public_profiles(p_query text default '', p_limit int default 30)
returns table (
  id           uuid,
  username     text,
  display_name text,
  bio          text,
  avatar_v     bigint,
  total        bigint,
  watching     bigint,
  completed    bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.bio, p.avatar_v,
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

-- Exclusão da PRÓPRIA conta (botão "Excluir minha conta" nas configurações).
-- Só apaga quem está logado e só a si mesmo (auth.uid()); o perfil e todas as
-- obras somem junto, em cascata.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;
  delete from auth.users where id = uid;
end;
$$;

-- ---- Seguir ----------------------------------------------------------

-- Perfil de alguém, respeitando a privacidade. Perfil privado visto por quem não é seguidor aceito
-- devolve só nome de usuário, nome de exibição e foto (bio e contagens ficam vazias).
--   relation: self | accepted | pending | none
drop function if exists public.get_profile(text);
create function public.get_profile(p_username text)
returns table (
  id              uuid,
  username        text,
  display_name    text,
  bio             text,
  avatar_v        bigint,
  is_public       boolean,
  show_notes      boolean,
  relation        text,
  can_view        boolean,
  followers_count bigint,
  following_count bigint,
  palette         text
)
language sql
stable
security definer
set search_path = ''
as $$
  with t as (
    select p.id, p.username, p.display_name, p.bio, p.avatar_v, p.is_public, p.show_notes, p.palette,
           (select auth.uid()) as me
    from public.profiles p
    where p.username = lower(coalesce(p_username, ''))
  ), r as (
    select t.*,
           case
             when t.me is not null and t.id = t.me then 'self'
             when exists (select 1 from public.follows f
                          where f.follower_id = t.me and f.followee_id = t.id and f.status = 'accepted') then 'accepted'
             when exists (select 1 from public.follows f
                          where f.follower_id = t.me and f.followee_id = t.id and f.status = 'pending') then 'pending'
             else 'none'
           end as rel
    from t
  )
  select r.id, r.username, r.display_name,
         case when r.is_public or r.rel in ('self', 'accepted') then r.bio else '' end,
         r.avatar_v, r.is_public,
         (r.rel = 'self' and r.show_notes),
         r.rel,
         (r.is_public or r.rel in ('self', 'accepted')),
         case when r.is_public or r.rel in ('self', 'accepted')
              then (select count(*) from public.follows f where f.followee_id = r.id and f.status = 'accepted') end,
         case when r.is_public or r.rel in ('self', 'accepted')
              then (select count(*) from public.follows f where f.follower_id = r.id and f.status = 'accepted') end,
         r.palette                         -- as cores são só visuais: quem abre o perfil sempre as vê (até o perfil privado trancado)
  from r;
$$;

-- Seguir alguém. Perfil público: já fica "accepted". Perfil privado: fica "pending" até a dona aceitar.
-- Devolve o status. Repetir a chamada não faz nada (devolve o status atual).
create or replace function public.follow_user(p_username text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me         uuid := auth.uid();
  target     public.profiles%rowtype;
  v_status   text;
begin
  if me is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;
  select * into target from public.profiles where username = lower(coalesce(p_username, ''));
  if not found then
    raise exception 'Perfil não encontrado.' using errcode = 'P0002';
  end if;
  if target.id = me then
    raise exception 'Você não pode seguir a si mesmo.' using errcode = '22023';
  end if;
  select f.status into v_status from public.follows f where f.follower_id = me and f.followee_id = target.id;
  if found then
    return v_status;
  end if;
  if (select count(*) from public.follows f where f.follower_id = me) >= 1000 then
    raise exception 'Limite de 1000 perfis seguidos atingido.' using errcode = 'check_violation';
  end if;
  v_status := case when target.is_public then 'accepted' else 'pending' end;
  insert into public.follows (follower_id, followee_id, status) values (me, target.id, v_status);
  return v_status;
end;
$$;

-- Deixar de seguir (ou cancelar um pedido pendente).
create or replace function public.unfollow_user(p_username text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.follows f
  using public.profiles t
  where t.username = lower(coalesce(p_username, ''))
    and f.followee_id = t.id
    and f.follower_id = (select auth.uid());
$$;

-- Dona do perfil aceita (true) ou recusa (false) um pedido pendente.
create or replace function public.respond_follow_request(p_follower uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;
  if p_accept then
    update public.follows set status = 'accepted'
    where followee_id = me and follower_id = p_follower and status = 'pending';
  else
    delete from public.follows
    where followee_id = me and follower_id = p_follower and status = 'pending';
  end if;
end;
$$;

-- Dona do perfil tira alguém da lista de seguidores (a pessoa perde o acesso).
create or replace function public.remove_follower(p_follower uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.follows
  where followee_id = (select auth.uid()) and follower_id = p_follower;
$$;

-- Pedidos pendentes para o MEU perfil.
create or replace function public.list_follow_requests()
returns table (
  id           uuid,
  username     text,
  display_name text,
  avatar_v     bigint,
  requested_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_v, f.created_at
  from public.follows f
  join public.profiles p on p.id = f.follower_id
  where f.followee_id = (select auth.uid()) and f.status = 'pending'
  order by f.created_at desc
  limit 100;
$$;

-- Quem segue / quem é seguido por um perfil (só aceitos). Só para quem pode ver aquele perfil.
create or replace function public.list_connections(p_username text, p_kind text)
returns table (
  id           uuid,
  username     text,
  display_name text,
  avatar_v     bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_v
  from public.profiles t
  join public.follows f
    on f.status = 'accepted'
   and ((p_kind = 'followers' and f.followee_id = t.id) or (p_kind = 'following' and f.follower_id = t.id))
  join public.profiles p
    on p.id = case when p_kind = 'followers' then f.follower_id else f.followee_id end
  where t.username = lower(coalesce(p_username, ''))
    and p_kind in ('followers', 'following')
    and (
      t.is_public
      or t.id = (select auth.uid())
      or exists (select 1 from public.follows v
                 where v.follower_id = (select auth.uid()) and v.followee_id = t.id and v.status = 'accepted')
    )
  order by f.created_at desc
  limit 200;
$$;

-- Feed: atividade (mais recente por obra) de quem eu sigo, da mais nova para a mais antiga.
-- Paginação por cursor: passe activity_at e entry_id do último item recebido.
-- Nunca devolve anotações privadas (só a análise, que a pessoa escreveu para ser vista).
drop function if exists public.get_feed(int, timestamptz, uuid);
create function public.get_feed(p_limit int default 30, p_before_at timestamptz default null, p_before_id uuid default null)
returns table (
  entry_id       uuid,
  user_id        uuid,
  username       text,
  display_name   text,
  avatar_v       bigint,
  title          text,
  category       text,
  status         text,
  rating         smallint,
  cover_image    text,
  review         text,
  review_spoiler boolean,
  activity_kind  text,
  activity_at    timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, p.id, p.username, p.display_name, p.avatar_v,
         e.title, e.category, e.status, e.rating, e.cover_image,
         e.review, e.review_spoiler, e.activity_kind, e.activity_at
  from public.follows f
  join public.entries e  on e.user_id = f.followee_id
  join public.profiles p on p.id = f.followee_id
  where f.follower_id = (select auth.uid())
    and f.status = 'accepted'
    and e.activity_at is not null
    and (p_before_at is null
         or (e.activity_at, e.id) < (p_before_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
  order by e.activity_at desc, e.id desc
  limit least(greatest(coalesce(p_limit, 30), 1), 50);
$$;

-- Versão deste esquema. O site compara com a que ele espera e avisa se o banco estiver atrasado.
--   2 = Em espera, favoritos e códigos de obra
--   3 = foto de perfil (coluna avatar_v e armazenamento "avatars")
--   4 = seguir, feed e análises
--   5 = cores do perfil (coluna palette)
--   6 = mangás e light novels (categorias novas e contadores de leitura)
create or replace function public.schema_version()
returns integer
language sql
immutable
set search_path = ''
as $$ select 6 $$;

-- Só quem precisa pode executar cada função.
revoke all on function public.get_public_entries(text)            from public;
revoke all on function public.list_public_profiles(text, int)     from public;
revoke all on function public.username_available(text)            from public;
revoke all on function public.handle_new_user()                   from public, anon, authenticated;
revoke all on function public.enforce_entry_limit()               from public, anon, authenticated;
revoke all on function public.delete_my_account()                 from public, anon;
revoke all on function public.schema_version()                    from public;
revoke all on function public.get_profile(text)                   from public;
revoke all on function public.follow_user(text)                   from public, anon;
revoke all on function public.unfollow_user(text)                 from public, anon;
revoke all on function public.respond_follow_request(uuid, boolean) from public, anon;
revoke all on function public.remove_follower(uuid)               from public, anon;
revoke all on function public.list_follow_requests()              from public, anon;
revoke all on function public.list_connections(text, text)        from public;
revoke all on function public.get_feed(int, timestamptz, uuid)    from public, anon;
revoke all on function public.set_entry_activity()                from public, anon, authenticated;
revoke all on function public.accept_pending_follows()            from public, anon, authenticated;

grant execute on function public.get_public_entries(text)         to anon, authenticated;
grant execute on function public.list_public_profiles(text, int)  to anon, authenticated;
grant execute on function public.username_available(text)         to anon, authenticated;
grant execute on function public.delete_my_account()               to authenticated;
grant execute on function public.schema_version()                  to anon, authenticated;
grant execute on function public.get_profile(text)                 to anon, authenticated;
grant execute on function public.follow_user(text)                 to authenticated;
grant execute on function public.unfollow_user(text)               to authenticated;
grant execute on function public.respond_follow_request(uuid, boolean) to authenticated;
grant execute on function public.remove_follower(uuid)             to authenticated;
grant execute on function public.list_follow_requests()            to authenticated;
grant execute on function public.list_connections(text, text)      to anon, authenticated;
grant execute on function public.get_feed(int, timestamptz, uuid)  to authenticated;


-- ---------------------------------------------------------------------
-- 6. Fotos de perfil (Supabase Storage)
-- ---------------------------------------------------------------------
-- Um "bucket" público chamado avatars, com UMA foto por pessoa:
--   * o arquivo tem como nome o ID da própria conta, então trocar a foto SOBRESCREVE a anterior
--     (nada de imagens antigas acumulando no armazenamento);
--   * o site já reduz a foto para 128x128 (WebP/JPEG) antes de enviar; o limite abaixo (64 KB) e
--     o filtro de tipo são a segunda trava, no servidor;
--   * qualquer pessoa pode VER as fotos (bucket público), mas só a dona envia, troca ou apaga a sua.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 65536, array['image/webp', 'image/jpeg'])
on conflict (id) do update
  set public = true,
      file_size_limit = 65536,
      allowed_mime_types = array['image/webp', 'image/jpeg'];

drop policy if exists "avatars_select_own" on storage.objects;
create policy "avatars_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and name = (select auth.uid())::text);

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and name = (select auth.uid())::text);

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using      (bucket_id = 'avatars' and name = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and name = (select auth.uid())::text);

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and name = (select auth.uid())::text);
