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
--   * Trocar a foto ou o fundo tem espera entre trocas e limite por dia, aplicados
--     aqui no banco (seção 7).
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
--   * sections: quais abas da biblioteca aparecem para OUTRAS pessoas (perfil, Explorar e feed). Valores: anime, manga, novel.
--     Vale para as obras de cada tipo, não só para o visual: as funções públicas abaixo não devolvem obras de uma aba desativada.
--     A própria pessoa continua vendo e editando tudo na sua biblioteca. Padrão: as três ativas; precisa sobrar pelo menos uma.
alter table public.profiles add column if not exists sections text[] not null default array['anime', 'manga', 'novel'];
alter table public.profiles drop constraint if exists profiles_sections_valid;
alter table public.profiles add  constraint profiles_sections_valid
  check (cardinality(sections) between 1 and 3 and sections <@ array['anime', 'manga', 'novel']);
--   * bg_v / bg_blur: imagem de fundo da página pública do perfil. bg_v é a "versão" da imagem (0 = sem fundo), como o avatar_v;
--     o arquivo fica no armazenamento "backgrounds" (seção 6). bg_blur liga/desliga o desfoque dos cards sobre o fundo
--     (ligado = cards translúcidos com desfoque; desligado = cards opacos e imagem escurecida).
alter table public.profiles add column if not exists bg_v    bigint  not null default 0;
alter table public.profiles add column if not exists bg_blur boolean not null default true;
alter table public.profiles drop constraint if exists profiles_bg_v;
alter table public.profiles add  constraint profiles_bg_v check (bg_v >= 0);


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
  constraint entries_rating       check (rating between 0 and 10),
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

-- Notas de 0 a 10 (v9). A nota mostrada no site vai de 0 a 5 estrelas, em passos de meia estrela: cada meia estrela vale 1 ponto
-- (1 = meia estrela, 10 = cinco estrelas, 0 = sem nota).
-- As notas antigas (1 a 5 estrelas) são MULTIPLICADAS por 2 (4 estrelas viram 8) UMA ÚNICA vez: o bloco abaixo só age enquanto
-- a restrição antiga (nota até 5) ainda existe, então rodar o script de novo não dobra as notas outra vez.
do $$
begin
  if exists (select 1 from pg_constraint
             where conrelid = 'public.entries'::regclass and conname = 'entries_rating'
               and pg_get_constraintdef(oid) ~ '<= 5\)') then
    alter table public.entries drop constraint entries_rating;
    update public.entries set rating = rating * 2 where rating > 0;
    alter table public.entries add constraint entries_rating check (rating between 0 and 10);
  end if;
end
$$;


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
-- 2c. Cargos e moderação
--   Dona (owner) > Administração (admin) > Moderação (mod) > Membro (sem linha na tabela)
--   Estas tabelas ficam FECHADAS (nem leitura direta): tudo passa pelas funções da seção 5b, que
--   conferem o cargo de quem chama. Por isso ninguém consegue se promover editando uma coluna.
-- ---------------------------------------------------------------------
create table if not exists public.user_roles (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  role       text not null,
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  constraint user_roles_role check (role in ('owner', 'admin', 'mod'))
);
-- Só pode existir UMA Dona. Ela é definida uma vez, direto no SQL (veja o README).
create unique index if not exists user_roles_single_owner on public.user_roles ((true)) where role = 'owner';

-- Conta suspensa: o perfil some para as outras pessoas e a conta não pode seguir, denunciar nem agir como equipe.
create table if not exists public.suspensions (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  reason       text not null default '',
  suspended_by uuid references public.profiles (id) on delete set null,
  suspended_at timestamptz not null default now(),
  constraint suspensions_reason_len check (char_length(reason) <= 300)
);

-- Registro de ações da equipe. Guarda os nomes (@usuario) no momento da ação, para o registro continuar
-- legível mesmo se a conta for excluída depois.
create table if not exists public.mod_log (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  actor_id    uuid references public.profiles (id) on delete set null,
  actor_name  text not null,
  action      text not null,
  target_id   uuid references public.profiles (id) on delete set null,
  target_name text,
  details     jsonb not null default '{}'::jsonb
);

-- Denúncias de perfil (nome, bio ou foto). Uma denúncia aberta por par denunciante/perfil.
create table if not exists public.profile_reports (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  reporter_id uuid references public.profiles (id) on delete set null,
  target_id   uuid not null references public.profiles (id) on delete cascade,
  reason      text not null,
  details     text not null default '',
  status      text not null default 'open',
  handled_by  uuid references public.profiles (id) on delete set null,
  handled_at  timestamptz,
  constraint profile_reports_reason  check (reason in ('nome', 'bio', 'foto', 'spam', 'outro')),
  constraint profile_reports_status  check (status in ('open', 'resolved', 'dismissed')),
  constraint profile_reports_details check (char_length(details) <= 300)
);
create unique index if not exists profile_reports_one_open on public.profile_reports (reporter_id, target_id) where status = 'open';
create index if not exists profile_reports_status_idx on public.profile_reports (status, id desc);
--   * snapshot (Patch 18): cópia do que a pessoa denunciada mostrava NA HORA da denúncia (nome, @, bio, versões da foto e do fundo
--     e os textos das obras que quem denunciou conseguia ver). Assim a equipe vê a prova mesmo que a pessoa edite tudo depois.
--     Só a equipe lê (admin_list_reports). Os arquivos de imagem não são copiados: só a versão (avatar_v / bg_v).
alter table public.profile_reports add column if not exists snapshot jsonb not null default '{}'::jsonb;
alter table public.profile_reports drop constraint if exists profile_reports_snapshot;
alter table public.profile_reports add  constraint profile_reports_snapshot
  check (jsonb_typeof(snapshot) = 'object' and octet_length(snapshot::text) <= 120000);

-- Configurações do site: signups_open (true/false), announcement (aviso no topo), blocked_names (lista de palavras proibidas)
-- e allowed_link_hosts (sites que podem ser citados nos textos).
create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint site_settings_key check (key in ('signups_open', 'announcement', 'blocked_names', 'allowed_link_hosts'))
);
-- Quem já tinha a tabela: aceita a chave nova (seguro rodar sempre).
alter table public.site_settings drop constraint if exists site_settings_key;
alter table public.site_settings add  constraint site_settings_key
  check (key in ('signups_open', 'announcement', 'blocked_names', 'allowed_link_hosts'));
insert into public.site_settings (key, value) values
  ('signups_open',  'true'::jsonb),
  ('announcement',  '""'::jsonb),
  ('blocked_names', '[]'::jsonb),
  ('allowed_link_hosts', '["myanimelist.net", "anilist.co", "themoviedb.org", "imdb.com", "mangadex.org"]'::jsonb)
on conflict (key) do nothing;

alter table public.user_roles      enable row level security;
alter table public.suspensions     enable row level security;
alter table public.mod_log         enable row level security;
alter table public.profile_reports enable row level security;
alter table public.site_settings   enable row level security;
revoke all on public.user_roles, public.suspensions, public.mod_log, public.profile_reports, public.site_settings from anon, authenticated;


-- ---------------------------------------------------------------------
-- 2d. Funções de apoio (uso interno: o site não as chama direto)
-- ---------------------------------------------------------------------

-- Peso de cada cargo. Quem age só atinge quem tem peso ESTRITAMENTE menor que o seu.
create or replace function public.rank_of_role(p_role text)
returns int
language sql
immutable
set search_path = ''
as $$ select case p_role when 'owner' then 3 when 'admin' then 2 when 'mod' then 1 else 0 end $$;

create or replace function public.rank_of(p_user uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$ select public.rank_of_role((select r.role from public.user_roles r where r.user_id = p_user)) $$;

create or replace function public.is_suspended(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from public.suspensions s where s.user_id = p_user) $$;

-- Peso de quem está chamando. Conta suspensa perde os poderes (peso 0).
create or replace function public.my_rank()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select case when (select auth.uid()) is null or public.is_suspended((select auth.uid())) then 0
              else public.rank_of((select auth.uid())) end
$$;

-- Minúsculas e sem acentos, para comparar nomes.
create or replace function public.norm_text(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$ select translate(lower(coalesce(p_text, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') $$;

-- Aba (anime, manga ou novel) de uma categoria de obra. Anime, Filme e Série ficam na aba "anime".
create or replace function public.category_section(p_category text)
returns text
language sql
immutable
set search_path = ''
as $$ select case p_category when 'Mangá' then 'manga' when 'Light novel' then 'novel' else 'anime' end $$;

-- O texto CONTÉM alguma palavra da lista de nomes proibidos? (ignora maiúsculas e acentos)
create or replace function public.name_is_blocked(p_text text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.site_settings s, jsonb_array_elements_text(s.value) as term
    where s.key = 'blocked_names'
      and jsonb_typeof(s.value) = 'array'
      and btrim(term) <> ''
      and strpos(public.norm_text(p_text), public.norm_text(btrim(term))) > 0
  )
$$;

-- ---------------------------------------------------------------------
-- 2e. Segurança dos textos (Patch 17). Espelha js/domain/textSafety.js: o banco é quem decide.
-- ---------------------------------------------------------------------

-- Limpa um texto: normaliza (NFC), tira caracteres de controle e "invisíveis" (largura zero, setas de direção de texto),
-- limita letras empilhadas (zalgo) a 2 e repetições do mesmo caractere a 10, e arruma espaços e linhas.
-- p_multiline = false: tudo numa linha só. true: mantém quebras (no máximo uma linha em branco).
create or replace function public.clean_text(p_text text, p_multiline boolean default false)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  s text := coalesce(p_text, '');
begin
  s := normalize(s, NFC);
  s := replace(replace(s, E'\r\n', E'\n'), E'\r', E'\n');
  s := regexp_replace(s, '[\u2028\u2029]', E'\n', 'g');
  s := regexp_replace(s, '[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000\t]', ' ', 'g');
  s := regexp_replace(s, '[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180b-\u180f\u200b\u200c\u200e\u200f\u202a-\u202e\u2060-\u206f\u2800\u3164\ufe00-\ufe0e\ufeff\uffa0\ufff9-\ufffb\U0001d173-\U0001d17a\U000e0000-\U000e007f\U000e0100-\U000e01ef]', '', 'g');
  -- o "junta-letras" (U+200D) só fica ligando dois emojis
  s := regexp_replace(s, '(?<![\u2190-\u2bff\U0001f000-\U0001faff\ufe0f])\u200d|\u200d(?![\u2190-\u2bff\U0001f000-\U0001faff\ufe0f])', '', 'g');
  s := regexp_replace(s, '([\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f])([\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f])[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]+', '\1\2', 'g');
  s := regexp_replace(s, '([^\n])\1{10,}', '\1\1\1\1\1\1\1\1\1\1', 'g');
  s := regexp_replace(s, ' {2,}', ' ', 'g');
  if p_multiline then
    s := regexp_replace(s, ' ?\n ?', E'\n', 'g');
    s := regexp_replace(s, '\n{3,}', E'\n\n', 'g');
  else
    s := regexp_replace(s, '\n+', ' ', 'g');
    s := regexp_replace(s, ' {2,}', ' ', 'g');
  end if;
  return regexp_replace(s, '^[ \n]+|[ \n]+$', '', 'g');
end;
$$;

-- Forma "solta" para comparar palavras: minúsculas, sem acento, 0 1 3 4 5 7 @ $ viram o, i, e, a, s, t, a, s,
-- só letras e espaços, letras repetidas viram uma ("paaalavra" = "palavra").
create or replace function public.norm_loose(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          translate(
            lower(translate(coalesce(p_text, ''),
              'áàâãäå' || 'éèêë' || 'íìîï' || 'óòôõöø' || 'úùûü' || 'ýÿ' || 'çñ' || 'ÁÀÂÃÄÅ' || 'ÉÈÊË' || 'ÍÌÎÏ' || 'ÓÒÔÕÖØ' || 'ÚÙÛÜ' || 'ÝŸ' || 'ÇÑ',
              'aaaaaa' || 'eeee' || 'iiii' || 'oooooo' || 'uuuu' || 'yy' || 'cn' || 'aaaaaa' || 'eeee' || 'iiii' || 'oooooo' || 'uuuu' || 'yy' || 'cn')),
            '013457@$', 'oieastas'),
          '[\u0001-\u002f\u003a-\u0040\u005b-\u0060\u007b-\u00bf\u2000-\u2bff\u3000-\u303f\ufe00-\ufe6f\uff00-\uff0f\U0001f000-\U0001faff]+', ' ', 'g'),
        '([a-z])\1+', '\1', 'g'),
      ' {2,}', ' ', 'g'),
    ' ')
$$;

-- O texto usa alguma palavra da lista de palavras proibidas (a mesma dos nomes)? Duas conferências:
--   1) a palavra (ou frase) aparece inteira, entre espaços e pontuação, com acento, número no lugar de letra ou letra repetida;
--   2) para palavras com 6 letras ou mais, também vale escrita separada ou colada em outra ("p a l a v r a", "palavrazinha").
create or replace function public.text_has_blocked_term(p_text text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  norm     text := public.norm_loose(p_text);
  padded   text;
  squashed text;
  t        text;
  tight    text;
begin
  if norm = '' then return false; end if;
  padded := ' ' || norm || ' ';
  squashed := replace(norm, ' ', '');
  for t in
    select public.norm_loose(term)
    from public.site_settings s, jsonb_array_elements_text(s.value) as term
    where s.key = 'blocked_names' and jsonb_typeof(s.value) = 'array'
  loop
    if t = '' then continue; end if;
    if strpos(padded, ' ' || t || ' ') > 0 then return true; end if;
    tight := replace(t, ' ', '');
    if char_length(tight) >= 6 and strpos(squashed, tight) > 0 then return true; end if;
  end loop;
  return false;
end;
$$;

-- "Exemplo.COM/abc", "https://www.exemplo.com:80/x" → "exemplo.com". Vazio se não parece um endereço.
create or replace function public.normalize_host(p_value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  h text := regexp_replace(lower(coalesce(p_value, '')), '^\s+|\s+$', '', 'g');
begin
  h := regexp_replace(h, '^[a-z]+://', '');
  h := regexp_replace(h, '^[^/?#]*@', '');
  h := regexp_replace(h, '[/?#].*$', '');
  h := regexp_replace(h, ':[0-9]*$', '');
  h := regexp_replace(h, '[.,;:!?)\]}]+$', '');
  h := regexp_replace(h, '^www\.', '');
  if h ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$' then return h; end if;
  return '';
end;
$$;

-- Todos os sites citados no texto (sem repetir, em ordem alfabética). Com "http://", "https://" ou "www." qualquer final conta;
-- sem isso só contam finais como .net, .gg, .br; os que também são palavras ("muito.com certeza") só com / ? ou # depois.
create or replace function public.link_hosts(p_text text)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  s     text := lower(coalesce(p_text, ''));
  lbl   text := '(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+';
  pats  text[];
  pat   text;
  m     text[];
  h     text;
  found text[] := '{}';
begin
  s := replace(replace(replace(replace(replace(s, '[.]', '.'), '(.)', '.'), '{.}', '.'), '。', '.'), '．', '.');
  pats := array[
    '(?:(?:https?|ftp)://(?:[^\s/?#@]*@)?|(?<![a-z0-9])www\.)([^\s/?#:]+)',
    '(?<![a-z0-9_.-])(' || lbl || '(?:net|org|edu|gov|info|biz|io|gg|tv|ly|cc|ws|xyz|top|site|online|app|dev|link|club|shop|store|fun|live|br|ru|cn|jp|uk|fr|mx|pl|tk|ml|ga|cf|gq|ink|pro|world|today|bio|lol|ai|sh|im|vip|wiki|blog|page|click|zip))(?![a-z0-9_-])',
    '(?<![a-z0-9_.-])(' || lbl || '(?:com|co|me|to|in|it|us|de|pt|es))(?=[/?#])'
  ];
  foreach pat in array pats loop
    for m in select regexp_matches(s, pat, 'g') loop
      h := public.normalize_host(m[1]);
      if h <> '' and not (h = any (found)) then found := found || h; end if;
    end loop;
  end loop;
  return coalesce((select array_agg(x order by x) from unnest(found) x), '{}');
end;
$$;

-- O texto cita algum site que NÃO está na lista de sites permitidos (nem é subdomínio de um deles)?
create or replace function public.text_has_bad_link(p_text text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  allowed text[];
  h       text;
begin
  select coalesce(array_agg(public.normalize_host(x)), '{}') into allowed
  from public.site_settings s, jsonb_array_elements_text(s.value) x
  where s.key = 'allowed_link_hosts' and jsonb_typeof(s.value) = 'array';
  foreach h in array public.link_hosts(p_text) loop
    if not exists (select 1 from unnest(allowed) a where a <> '' and (h = a or h like '%.' || a)) then
      return true;
    end if;
  end loop;
  return false;
end;
$$;

-- 'blocked' (palavra proibida), 'link' (site fora da lista) ou null (tudo certo).
create or replace function public.text_problem(p_text text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.text_has_blocked_term(p_text) then 'blocked'
              when public.text_has_bad_link(p_text) then 'link'
              else null end
$$;


revoke all on function public.rank_of_role(text)   from public, anon, authenticated;
revoke all on function public.rank_of(uuid)        from public, anon, authenticated;
revoke all on function public.is_suspended(uuid)   from public, anon, authenticated;
revoke all on function public.my_rank()            from public, anon, authenticated;
revoke all on function public.category_section(text) from public, anon, authenticated;
revoke all on function public.norm_text(text)      from public, anon, authenticated;
revoke all on function public.name_is_blocked(text) from public, anon, authenticated;
revoke all on function public.clean_text(text, boolean)       from public, anon, authenticated;
revoke all on function public.norm_loose(text)                from public, anon, authenticated;
revoke all on function public.text_has_blocked_term(text)     from public, anon, authenticated;
revoke all on function public.normalize_host(text)            from public, anon, authenticated;
revoke all on function public.link_hosts(text)                from public, anon, authenticated;
revoke all on function public.text_has_bad_link(text)         from public, anon, authenticated;
revoke all on function public.text_problem(text)              from public, anon, authenticated;


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
--     Cadastros fechados (configuração do site) recusam a criação da conta. Nome de usuário ou de exibição
--     que contenha uma palavra da lista de nomes proibidos é trocado por um nome neutro (user_xxxxxxxx).
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
  if exists (select 1 from public.site_settings s where s.key = 'signups_open' and s.value = 'false'::jsonb) then
    raise exception 'Os cadastros estão fechados no momento.' using errcode = 'P0001';
  end if;

  if wanted !~ '^[a-z0-9_]{3,20}$' or public.name_is_blocked(wanted) then
    wanted := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  final_name := wanted;
  while exists (select 1 from public.profiles where username = final_name) and attempts < 5 loop
    final_name := left(wanted, 14) || '_' || substr(md5(random()::text), 1, 5);
    attempts := attempts + 1;
  end loop;

  shown_name := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), wanted), 40);
  if public.name_is_blocked(shown_name) then
    shown_name := final_name;
  end if;

  perform set_config('kamylist.staff_edit', '1', true);   -- nomes já conferidos acima
  insert into public.profiles (id, username, display_name)
  values (new.id, final_name, shown_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3b2. Nome de usuário, nome de exibição e bio.
--      * Nome de usuário e de exibição não podem conter palavras da lista de palavras proibidas.
--      * Nome de exibição e bio passam pela limpeza (clean_text: sem caracteres invisíveis, letras empilhadas etc.).
--      * Nome de exibição e bio não podem ter palavra proibida (conferência por palavra inteira, veja text_has_blocked_term)
--        nem citar site fora da lista de sites permitidos.
--      Vale para quem edita o próprio perfil. As funções da equipe (seção 5b) passam por cima, porque
--      só colocam nomes neutros ou escolhidos por quem tem cargo. Só confere o que mudou: editar outra coisa
--      (cor, privacidade...) nunca é recusado por texto antigo.
create or replace function public.profiles_check_names()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_changed boolean := tg_op = 'INSERT';
  name_changed boolean := tg_op = 'INSERT';
  bio_changed  boolean := tg_op = 'INSERT';
  clean_name   text;
begin
  if coalesce(current_setting('kamylist.staff_edit', true), '') = '1' then
    return new;
  end if;

  -- o que mudou é decidido antes da limpeza
  if tg_op = 'UPDATE' then
    user_changed := new.username     is distinct from old.username;
    name_changed := new.display_name is distinct from old.display_name;
    bio_changed  := new.bio          is distinct from old.bio;
  end if;

  if name_changed then
    clean_name := public.clean_text(new.display_name, false);
    if clean_name = '' and btrim(coalesce(new.display_name, '')) <> '' then
      raise exception 'Esse nome não é permitido. Escolha outro.' using errcode = 'check_violation';
    end if;
    new.display_name := clean_name;
  end if;
  if bio_changed then
    new.bio := public.clean_text(new.bio, true);
  end if;

  if user_changed or name_changed then
    if public.name_is_blocked(new.username) or public.name_is_blocked(new.display_name) then
      raise exception 'Esse nome não é permitido. Escolha outro.' using errcode = 'check_violation';
    end if;
  end if;
  if name_changed then
    case public.text_problem(new.display_name)
      when 'blocked' then raise exception 'Esse nome não é permitido. Escolha outro.' using errcode = 'check_violation';
      when 'link' then raise exception 'O nome de exibição não pode ter endereço de site que não esteja na lista de sites permitidos.' using errcode = 'check_violation';
      else null;
    end case;
  end if;
  if bio_changed and new.bio <> '' then
    case public.text_problem(new.bio)
      when 'blocked' then raise exception 'Sua bio tem uma palavra que não é permitida aqui. Reescreva o trecho e tente de novo.' using errcode = 'check_violation';
      when 'link' then raise exception 'Sua bio tem um endereço de site que não está na lista de sites permitidos. Tire o endereço e tente de novo.' using errcode = 'check_violation';
      else null;
    end case;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_check_names on public.profiles;
create trigger profiles_check_names before insert or update of username, display_name, bio on public.profiles
  for each row execute function public.profiles_check_names();
revoke all on function public.profiles_check_names() from public, anon, authenticated;

-- 3b3. Textos das obras (Patch 17). Antes de gravar, o título, as tags, os gêneros, a sinopse, as anotações e a análise passam
--      pela limpeza (clean_text). Título digitado à mão (obra sem código de fonte), tags, anotações e análise ainda não podem
--      ter palavra proibida nem site fora da lista de sites permitidos. Só confere o que mudou (obras antigas continuam
--      abrindo e editando normalmente). A sinopse não é conferida porque, em geral, vem da fonte de busca.
create or replace function public.entries_check_text()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  title_changed  boolean := tg_op = 'INSERT';
  notes_changed  boolean := tg_op = 'INSERT';
  review_changed boolean := tg_op = 'INSERT';
  tags_changed   boolean := tg_op = 'INSERT';
  problem text;
  field   text;
begin
  -- o que mudou é decidido antes da limpeza (obra antiga com sujeira não é recusada por causa da limpeza)
  if tg_op = 'UPDATE' then
    title_changed  := new.title  is distinct from old.title;
    notes_changed  := new.notes  is distinct from old.notes;
    review_changed := new.review is distinct from old.review;
    tags_changed   := new.tags   is distinct from old.tags;
  end if;

  new.title := public.clean_text(new.title, false);
  if new.title = '' then
    raise exception 'Dê um título para a obra (com letras ou números visíveis).' using errcode = 'check_violation';
  end if;
  if new.notes is not null then new.notes := nullif(public.clean_text(new.notes, true), ''); end if;
  if new.review is not null then new.review := nullif(public.clean_text(new.review, true), ''); end if;
  if new.description is not null then new.description := nullif(public.clean_text(new.description, true), ''); end if;
  new.tags := coalesce(array(
    select q.c from (select public.clean_text(t.v, false) as c, t.i from unnest(new.tags) with ordinality as t(v, i)) q
    where q.c <> '' order by q.i), '{}');
  new.genres := coalesce(array(
    select q.c from (select public.clean_text(t.v, false) as c, t.i from unnest(new.genres) with ordinality as t(v, i)) q
    where q.c <> '' order by q.i), '{}');

  -- Ação da equipe (remoção de conteúdo, seção 5b): só limpa, não confere palavras nem sites.
  if coalesce(current_setting('kamylist.staff_edit', true), '') = '1' then
    return new;
  end if;

  if new.source_ref is null and title_changed then
    problem := public.text_problem(new.title); field := 'Título';
  end if;
  if problem is null and new.notes is not null and notes_changed then
    problem := public.text_problem(new.notes); field := 'Anotações';
  end if;
  if problem is null and new.review is not null and review_changed then
    problem := public.text_problem(new.review); field := 'Análise';
  end if;
  if problem is null and cardinality(new.tags) > 0 and tags_changed then
    problem := public.text_problem(array_to_string(new.tags, E'\n')); field := 'Tags';
  end if;

  if problem = 'blocked' then
    raise exception 'Não foi possível salvar “%”: há uma palavra que não é permitida no campo “%”. Reescreva o trecho e tente de novo.', left(new.title, 40), field
      using errcode = 'check_violation';
  elsif problem = 'link' then
    raise exception 'Não foi possível salvar “%”: há um endereço de site que não está na lista de sites permitidos no campo “%”. Tire o endereço e tente de novo.', left(new.title, 40), field
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists entries_check_text on public.entries;
create trigger entries_check_text before insert or update on public.entries
  for each row execute function public.entries_check_text();
revoke all on function public.entries_check_text() from public, anon, authenticated;

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
  elsif coalesce(current_setting('kamylist.staff_edit', true), '') = '1' then
    -- ação da equipe (remoção de conteúdo): o texto trocado não vira "análise nova" no feed
    new.activity_at   := old.activity_at;
    new.activity_kind := old.activity_kind;
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
-- 4b. Preferências da conta (PRIVADAS)
-- ---------------------------------------------------------------------
-- Opções de acessibilidade e de uso que só dizem respeito a quem as ligou. Ficam numa tabela à parte, e não na do perfil,
-- porque a tabela de perfis pode ser lida por qualquer pessoa (perfil público): aqui só a própria dona lê e edita.
--   * high_contrast: modo de alto contraste do site (vale só para a pessoa que o ligou; ninguém mais o vê nem o recebe ao abrir o perfil dela).
create table if not exists public.user_prefs (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  high_contrast boolean not null default false
);

alter table public.user_prefs enable row level security;

drop policy if exists "user_prefs_select_own" on public.user_prefs;
create policy "user_prefs_select_own" on public.user_prefs
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "user_prefs_insert_own" on public.user_prefs;
create policy "user_prefs_insert_own" on public.user_prefs
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "user_prefs_update_own" on public.user_prefs;
create policy "user_prefs_update_own" on public.user_prefs
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Visitantes não tocam nessa tabela; quem tem login só lê, cria e altera a própria linha (ela some junto com a conta).
revoke all on public.user_prefs from anon, authenticated;
grant select, insert, update on public.user_prefs to authenticated;

-- "Alto contraste" deixou de ser uma cor de perfil (quem abria o perfil via o visual da pessoa): agora é a opção acima.
-- Quem usava essa cor passa para o padrão com o alto contraste ligado. Seguro repetir: só mexe em quem ainda tem a cor antiga.
insert into public.user_prefs (user_id, high_contrast)
select id, true from public.profiles where palette = 'alto-contraste'
on conflict (user_id) do update set high_contrast = true;
update public.profiles set palette = 'default' where palette = 'alto-contraste';


-- ---------------------------------------------------------------------
-- 5. Funções públicas (usadas pelo site via supabase.rpc)
-- ---------------------------------------------------------------------

-- Obras de um perfil. Quem pode ver: qualquer pessoa (perfil público), a própria dona,
-- ou quem a dona já aceitou como seguidor (perfil privado). As anotações só saem se a dona permitir;
-- a análise (review) sai junto com a obra. Obras de uma aba que a dona desativou (profiles.sections) não saem.
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
    and (p.id = (select auth.uid()) or not public.is_suspended(p.id))
    and (
      p.is_public
      or p.id = (select auth.uid())
      or exists (select 1 from public.follows f
                 where f.follower_id = (select auth.uid()) and f.followee_id = p.id and f.status = 'accepted')
    )
    -- abas desativadas pela dona do perfil não saem para ninguém (ela mesma vê tudo)
    and (p.id = (select auth.uid()) or public.category_section(e.category) = any (p.sections))
  order by e.created_at desc;
$$;

-- Lista de perfis públicos com contagens (página "Explorar"). Só contam as abas ativas de cada perfil;
-- as colunas anime_*, manga_* e novel_* trazem o resumo de cada tipo (total, em andamento e concluídas)
-- e "total", "watching" e "completed" continuam sendo a soma das abas ativas.
-- (drop antes: o formato do resultado ganhou colunas: "sections" e as contagens por tipo)
drop function if exists public.list_public_profiles(text, int);
create function public.list_public_profiles(p_query text default '', p_limit int default 30)
returns table (
  id              uuid,
  username        text,
  display_name    text,
  bio             text,
  avatar_v        bigint,
  total           bigint,
  watching        bigint,
  completed       bigint,
  role            text,
  sections        text[],
  anime_total     bigint,
  anime_active    bigint,
  anime_completed bigint,
  manga_total     bigint,
  manga_active    bigint,
  manga_completed bigint,
  novel_total     bigint,
  novel_active    bigint,
  novel_completed bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with e as (
    select p.id as pid, public.category_section(x.category) as sec, x.status
    from public.profiles p
    join public.entries x on x.user_id = p.id
    where p.is_public
      and not public.is_suspended(p.id)
      and public.category_section(x.category) = any (p.sections)
  ), c as (
    select pid,
           count(*)                                                        as total,
           count(*) filter (where status = 'watching')                     as active,
           count(*) filter (where status = 'completed')                    as done,
           count(*) filter (where sec = 'anime')                           as a_total,
           count(*) filter (where sec = 'anime' and status = 'watching')   as a_active,
           count(*) filter (where sec = 'anime' and status = 'completed')  as a_done,
           count(*) filter (where sec = 'manga')                           as m_total,
           count(*) filter (where sec = 'manga' and status = 'watching')   as m_active,
           count(*) filter (where sec = 'manga' and status = 'completed')  as m_done,
           count(*) filter (where sec = 'novel')                           as n_total,
           count(*) filter (where sec = 'novel' and status = 'watching')   as n_active,
           count(*) filter (where sec = 'novel' and status = 'completed')  as n_done
    from e
    group by pid
  )
  select p.id, p.username, p.display_name, p.bio, p.avatar_v,
         coalesce(c.total, 0), coalesce(c.active, 0), coalesce(c.done, 0),
         (select r.role from public.user_roles r where r.user_id = p.id),
         p.sections,
         coalesce(c.a_total, 0), coalesce(c.a_active, 0), coalesce(c.a_done, 0),
         coalesce(c.m_total, 0), coalesce(c.m_active, 0), coalesce(c.m_done, 0),
         coalesce(c.n_total, 0), coalesce(c.n_active, 0), coalesce(c.n_done, 0)
  from public.profiles p
  left join c on c.pid = p.id
  where p.is_public
    and not public.is_suspended(p.id)
    and (
      coalesce(trim(p_query), '') = ''
      or strpos(p.username, lower(trim(p_query))) > 0
      or strpos(lower(p.display_name), lower(trim(p_query))) > 0
    )
  order by coalesce(c.total, 0) desc, p.username
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
     and not exists (select 1 from public.profiles where username = lower(p_username))
     and not public.name_is_blocked(p_username);
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
  if public.rank_of(uid) >= 3 then
    raise exception 'A Dona do site não pode excluir a conta. Passe o cargo para outra pessoa antes (veja o README).' using errcode = '42501';
  end if;
  delete from auth.users where id = uid;
end;
$$;

-- ---- Seguir ----------------------------------------------------------

-- Perfil de alguém, respeitando a privacidade. Perfil privado visto por quem não é seguidor aceito
-- devolve só nome de usuário, nome de exibição e foto (bio e contagens ficam vazias).
--   relation: self | accepted | pending | none
-- (role: cargo da pessoa, nulo para membros. suspended: conta suspensa; para os outros o perfil fica
--  indisponível: sem nome, foto, bio nem contagens)
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
  palette         text,
  role            text,
  suspended       boolean,
  sections        text[],
  bg_v            bigint,
  bg_blur         boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with t as (
    select p.id, p.username, p.display_name, p.bio, p.avatar_v, p.is_public, p.show_notes, p.palette, p.sections,
           p.bg_v, p.bg_blur,
           (select ur.role from public.user_roles ur where ur.user_id = p.id) as role,
           public.is_suspended(p.id) as sus,
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
  ), v as (
    select r.*, (r.sus and r.rel <> 'self') as hidden from r
  )
  select v.id, v.username,
         case when v.hidden then '' else v.display_name end,
         case when v.hidden then '' when v.is_public or v.rel in ('self', 'accepted') then v.bio else '' end,
         case when v.hidden then 0 else v.avatar_v end,
         v.is_public,
         (v.rel = 'self' and v.show_notes),
         v.rel,
         (not v.hidden and (v.is_public or v.rel in ('self', 'accepted'))),
         case when not v.hidden and (v.is_public or v.rel in ('self', 'accepted'))
              then (select count(*) from public.follows f where f.followee_id = v.id and f.status = 'accepted') end,
         case when not v.hidden and (v.is_public or v.rel in ('self', 'accepted'))
              then (select count(*) from public.follows f where f.follower_id = v.id and f.status = 'accepted') end,
         v.palette,                        -- as cores são só visuais: quem abre o perfil sempre as vê (até o perfil privado trancado)
         case when v.hidden then null else v.role end,
         v.sus,
         case when not v.hidden and (v.is_public or v.rel in ('self', 'accepted')) then v.sections end,   -- abas ativas (para quem pode ver o perfil)
         case when v.hidden then 0 else v.bg_v end,    -- o fundo é visual, como a foto: aparece até no perfil privado trancado, mas some se a conta estiver suspensa
         v.bg_blur
  from v;
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
  if public.is_suspended(me) then
    raise exception 'Sua conta está suspensa.' using errcode = '42501';
  end if;
  select * into target from public.profiles where username = lower(coalesce(p_username, ''));
  if not found or public.is_suspended(target.id) then
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
-- (drop antes: o resultado ganhou a coluna "role")
drop function if exists public.list_follow_requests();
create function public.list_follow_requests()
returns table (
  id           uuid,
  username     text,
  display_name text,
  avatar_v     bigint,
  requested_at timestamptz,
  role         text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_v, f.created_at,
         (select r.role from public.user_roles r where r.user_id = p.id)
  from public.follows f
  join public.profiles p on p.id = f.follower_id
  where f.followee_id = (select auth.uid()) and f.status = 'pending'
    and not public.is_suspended(p.id)
  order by f.created_at desc
  limit 100;
$$;

-- Quem segue / quem é seguido por um perfil (só aceitos). Só para quem pode ver aquele perfil.
-- (drop antes: o resultado ganhou a coluna "role")
drop function if exists public.list_connections(text, text);
create function public.list_connections(p_username text, p_kind text)
returns table (
  id           uuid,
  username     text,
  display_name text,
  avatar_v     bigint,
  role         text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_v,
         (select r.role from public.user_roles r where r.user_id = p.id)
  from public.profiles t
  join public.follows f
    on f.status = 'accepted'
   and ((p_kind = 'followers' and f.followee_id = t.id) or (p_kind = 'following' and f.follower_id = t.id))
  join public.profiles p
    on p.id = case when p_kind = 'followers' then f.follower_id else f.followee_id end
  where t.username = lower(coalesce(p_username, ''))
    and p_kind in ('followers', 'following')
    and not public.is_suspended(p.id)
    and (t.id = (select auth.uid()) or not public.is_suspended(t.id))
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
  activity_at    timestamptz,
  role           text
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, p.id, p.username, p.display_name, p.avatar_v,
         e.title, e.category, e.status, e.rating, e.cover_image,
         e.review, e.review_spoiler, e.activity_kind, e.activity_at,
         (select r.role from public.user_roles r where r.user_id = p.id)
  from public.follows f
  join public.entries e  on e.user_id = f.followee_id
  join public.profiles p on p.id = f.followee_id
  where f.follower_id = (select auth.uid())
    and f.status = 'accepted'
    and not public.is_suspended(f.followee_id)
    and not public.is_suspended((select auth.uid()))
    and e.activity_at is not null
    and public.category_section(e.category) = any (p.sections)   -- abas desativadas no perfil não aparecem no feed
    and (p_before_at is null
         or (e.activity_at, e.id) < (p_before_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
  order by e.activity_at desc, e.id desc
  limit least(greatest(coalesce(p_limit, 30), 1), 50);
$$;

-- ---- Cargos e moderação (painel de administração) ----------------------
-- Regra de ouro: quem age só atinge quem tem cargo ESTRITAMENTE menor que o seu
-- (Dona > Administração > Moderação > Membro), e só concede cargos menores que o seu.
-- Cada função confere o cargo de quem chama; o painel do site é só a vitrine.

-- Registra uma ação no log (uso interno).
create or replace function public.log_action(p_action text, p_target uuid, p_details jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  insert into public.mod_log (actor_id, actor_name, action, target_id, target_name, details)
  values (me,
          coalesce((select '@' || p.username from public.profiles p where p.id = me), '?'),
          p_action,
          p_target,
          (select '@' || p.username from public.profiles p where p.id = p_target),
          coalesce(p_details, '{}'::jsonb));
end;
$$;

-- Exige cargo mínimo (1 = moderação, 2 = administração, 3 = Dona). Devolve o peso de quem chama.
create or replace function public.require_staff(p_min int default 1)
returns int
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r int := public.my_rank();
begin
  if (select auth.uid()) is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;
  if r < greatest(p_min, 1) then
    raise exception 'Você não tem permissão para isso.' using errcode = '42501';
  end if;
  return r;
end;
$$;

-- Exige que quem chama tenha cargo estritamente maior que o da pessoa alvo (e que ela exista).
create or replace function public.require_outranks(p_target uuid)
returns int
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r int := public.require_staff(1);
begin
  if not exists (select 1 from public.profiles p where p.id = p_target) then
    raise exception 'Perfil não encontrado.' using errcode = 'P0002';
  end if;
  if r <= public.rank_of(p_target) then
    raise exception 'Você só pode agir em quem tem um cargo menor que o seu.' using errcode = '42501';
  end if;
  return r;
end;
$$;

-- Meu acesso agora: cargo em vigor (owner | admin | mod | member; conta suspensa vira member) e se estou suspensa.
create or replace function public.my_access()
returns table (role text, suspended boolean, reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select case public.my_rank() when 3 then 'owner' when 2 then 'admin' when 1 then 'mod' else 'member' end,
         public.is_suspended((select auth.uid())),
         (select s.reason from public.suspensions s where s.user_id = (select auth.uid()))
$$;

-- Configurações que o site mostra para todo mundo: cadastros abertos e aviso no topo.
create or replace function public.get_public_settings()
returns table (signups_open boolean, announcement text)
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.site_settings s where s.key = 'signups_open' and s.value = 'false'::jsonb),
         coalesce((select s.value #>> '{}' from public.site_settings s where s.key = 'announcement'), '')
$$;

-- Snapshot da denúncia (uso interno). Guarda o perfil como ele está agora e, das obras, só os textos que QUEM DENUNCIA
-- conseguia ver: perfil público ou seguidor aceito, aba ativa, anotações só se a pessoa deixou aparecer. No máximo 10 obras
-- (as mexidas mais recentemente que têm análise, anotações, tags ou título digitado à mão), com os textos cortados.
create or replace function public.report_snapshot(p_reporter uuid, p_target uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p       public.profiles%rowtype;
  can_see boolean;
  items   jsonb := '[]'::jsonb;
begin
  select * into p from public.profiles where id = p_target;
  if not found then
    return '{}'::jsonb;
  end if;
  can_see := p.is_public
             or exists (select 1 from public.follows f
                        where f.follower_id = p_reporter and f.followee_id = p_target and f.status = 'accepted');
  if can_see then
    select coalesce(jsonb_agg(q.j order by q.upd desc, q.id), '[]'::jsonb) into items
    from (
      select e.id, e.updated_at as upd,
             jsonb_build_object(
               'id', e.id,
               'title', left(e.title, 120),
               'category', e.category,
               'manual', e.source_ref is null,
               'review', left(e.review, 600),
               'notes', case when p.show_notes then left(e.notes, 400) end,
               'tags', to_jsonb(array(select left(t.v, 40) from unnest(e.tags) with ordinality as t(v, i) where t.i <= 10 order by t.i))
             ) as j
      from public.entries e
      where e.user_id = p_target
        and public.category_section(e.category) = any (p.sections)
        and (e.review is not null or cardinality(e.tags) > 0 or (p.show_notes and e.notes is not null) or e.source_ref is null)
      order by e.updated_at desc, e.id
      limit 10
    ) q;
  end if;
  return jsonb_build_object(
    'v', 1,
    'username', p.username,
    'display_name', p.display_name,
    'bio', p.bio,
    'avatar_v', p.avatar_v,
    'bg_v', p.bg_v,
    'is_public', p.is_public,
    'entries_visible', can_see,
    'entries', items
  );
end;
$$;

-- Denunciar o perfil de alguém (nome, bio ou foto). Repetir enquanto a denúncia está aberta não faz nada.
-- A denúncia guarda um snapshot do perfil na hora (veja report_snapshot).
create or replace function public.report_profile(p_username text, p_reason text, p_details text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me     uuid := auth.uid();
  target uuid;
begin
  if me is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;
  if public.is_suspended(me) then
    raise exception 'Sua conta está suspensa.' using errcode = '42501';
  end if;
  if p_reason is null or p_reason not in ('nome', 'bio', 'foto', 'spam', 'outro') then
    raise exception 'Escolha o motivo da denúncia.' using errcode = '22023';
  end if;
  select p.id into target from public.profiles p where p.username = lower(coalesce(p_username, ''));
  if target is null then
    raise exception 'Perfil não encontrado.' using errcode = 'P0002';
  end if;
  if target = me then
    raise exception 'Você não pode denunciar o próprio perfil.' using errcode = '22023';
  end if;
  if exists (select 1 from public.profile_reports r where r.reporter_id = me and r.target_id = target and r.status = 'open') then
    return;
  end if;
  if (select count(*) from public.profile_reports r where r.reporter_id = me and r.status = 'open') >= 10 then
    raise exception 'Você já tem várias denúncias em análise. Aguarde a resposta da equipe.' using errcode = 'check_violation';
  end if;
  insert into public.profile_reports (reporter_id, target_id, reason, details, snapshot)
  values (me, target, p_reason, left(public.clean_text(p_details, true), 300), public.report_snapshot(me, target));
end;
$$;

-- Membros (para a equipe): busca por nome de usuário ou de exibição. Não mostra e-mail.
-- can_act = quem chama pode agir nessa pessoa (cargo estritamente maior).
create or replace function public.admin_list_members(p_query text default '', p_limit int default 30, p_offset int default 0)
returns table (
  id                uuid,
  username          text,
  display_name      text,
  bio               text,
  avatar_v          bigint,
  role              text,
  suspended         boolean,
  suspension_reason text,
  is_public         boolean,
  total_entries     bigint,
  open_reports      bigint,
  created_at        timestamptz,
  can_act           boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  q      text := lower(btrim(coalesce(p_query, '')));
  myrank int  := public.require_staff(1);
begin
  return query
  select p.id, p.username, p.display_name, p.bio, p.avatar_v,
         r.role,
         (s.user_id is not null),
         s.reason,
         p.is_public,
         (select count(*) from public.entries e where e.user_id = p.id),
         (select count(*) from public.profile_reports pr where pr.target_id = p.id and pr.status = 'open'),
         p.created_at,
         (myrank > public.rank_of_role(r.role))
  from public.profiles p
  left join public.user_roles  r on r.user_id = p.id
  left join public.suspensions s on s.user_id = p.id
  where q = '' or strpos(p.username, q) > 0 or strpos(lower(p.display_name), q) > 0
  order by p.created_at desc, p.id
  limit least(greatest(coalesce(p_limit, 30), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- Troca nome de exibição, bio, foto, fundo e/ou nome de usuário por um valor neutro.
-- p_fields: 'display_name', 'bio', 'avatar', 'background', 'username'
create or replace function public.admin_reset_profile(p_user uuid, p_fields text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t         public.profiles%rowtype;
  f         text;
  fresh     text;
  tries     int := 0;
begin
  perform public.require_outranks(p_user);
  if p_fields is null or cardinality(p_fields) = 0 then
    raise exception 'Escolha o que restaurar.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(p_fields) x where x not in ('display_name', 'bio', 'avatar', 'background', 'username')) then
    raise exception 'Campo inválido.' using errcode = '22023';
  end if;
  select * into t from public.profiles where id = p_user;
  perform set_config('kamylist.staff_edit', '1', true);

  foreach f in array p_fields loop
    if f = 'display_name' then
      perform public.log_action('reset_display_name', p_user, jsonb_build_object('antes', t.display_name));
      update public.profiles set display_name = 'Usuário ' || substr(replace(p_user::text, '-', ''), 1, 4) where id = p_user;
    elsif f = 'bio' then
      perform public.log_action('reset_bio', p_user, jsonb_build_object('antes', t.bio));
      update public.profiles set bio = '' where id = p_user;
    elsif f = 'avatar' then
      perform public.log_action('reset_avatar', p_user, '{}'::jsonb);
      update public.profiles set avatar_v = 0 where id = p_user;
      -- O site só mostra a foto quando avatar_v > 0, então ela já some daqui. Apagar o arquivo é um extra:
      -- se o armazenamento recusar, o resto continua valendo (dá para apagar em Storage > avatars).
      begin
        perform set_config('storage.allow_delete_query', 'true', true);
        delete from storage.objects where bucket_id = 'avatars' and name = p_user::text;
      exception when others then
        null;
      end;
    elsif f = 'background' then
      perform public.log_action('reset_background', p_user, '{}'::jsonb);
      update public.profiles set bg_v = 0 where id = p_user;
      -- Igual à foto: o site só mostra o fundo quando bg_v > 0; apagar o arquivo é um extra.
      begin
        perform set_config('storage.allow_delete_query', 'true', true);
        delete from storage.objects where bucket_id = 'backgrounds' and name = p_user::text;
      exception when others then
        null;
      end;
    elsif f = 'username' then
      fresh := 'user_' || substr(replace(p_user::text, '-', ''), 1, 8);
      while exists (select 1 from public.profiles x where x.username = fresh and x.id <> p_user) and tries < 5 loop
        fresh := 'user_' || substr(md5(random()::text), 1, 8);
        tries := tries + 1;
      end loop;
      perform public.log_action('reset_username', p_user, jsonb_build_object('antes', t.username, 'depois', fresh));
      update public.profiles set username = fresh where id = p_user;
    end if;
  end loop;
end;
$$;

-- Remove conteúdo ofensivo CAMPO A CAMPO, trocando o texto por "[Conteúdo removido pela moderação]". Não mexe em progresso,
-- nota (0 a 10), status, favoritos, temporadas, capa nem datas, e o texto trocado não vira novidade no feed.
--   p_fields: do perfil 'display_name' e 'bio'; das obras 'title' (só títulos digitados à mão), 'review' (análise),
--             'notes' (anotações) e 'tags' (as tags ficam vazias).
--   p_entry:  só essa obra (campos de obra); vazio = todas as obras da pessoa.
-- Devolve quantas coisas mudaram (0 = já estava tudo removido ou não havia nada para remover).
create or replace function public.admin_wipe_text(p_user uuid, p_fields text[], p_entry uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed_mark constant text := '[Conteúdo removido pela moderação]';
  fields    text[];
  f         text;
  t         public.profiles%rowtype;
  total     integer := 0;
  n         integer;
  one_title text;
begin
  perform public.require_outranks(p_user);
  fields := coalesce(array(select distinct x from unnest(p_fields) x), '{}');
  if cardinality(fields) = 0 then
    raise exception 'Escolha o que remover.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(fields) x where x not in ('display_name', 'bio', 'title', 'review', 'notes', 'tags')) then
    raise exception 'Campo inválido.' using errcode = '22023';
  end if;
  if p_entry is not null then
    select e.title into one_title from public.entries e where e.id = p_entry and e.user_id = p_user;
    if not found then
      raise exception 'Obra não encontrada.' using errcode = 'P0002';
    end if;
    if exists (select 1 from unnest(fields) x where x in ('display_name', 'bio')) then
      raise exception 'Nome e bio são do perfil, não de uma obra.' using errcode = '22023';
    end if;
  end if;
  select * into t from public.profiles where id = p_user;
  perform set_config('kamylist.staff_edit', '1', true);

  foreach f in array fields loop
    n := 0;
    if f = 'display_name' then
      if t.display_name <> removed_mark then
        update public.profiles set display_name = removed_mark where id = p_user;
        perform public.log_action('wipe_display_name', p_user, jsonb_build_object('antes', t.display_name));
        n := 1;
      end if;
    elsif f = 'bio' then
      if t.bio <> '' and t.bio <> removed_mark then
        update public.profiles set bio = removed_mark where id = p_user;
        perform public.log_action('wipe_bio', p_user, jsonb_build_object('antes', t.bio));
        n := 1;
      end if;
    elsif f = 'title' then
      update public.entries set title = removed_mark
       where user_id = p_user and source_ref is null and title <> removed_mark and (p_entry is null or id = p_entry);
      get diagnostics n = row_count;
    elsif f = 'review' then
      update public.entries set review = removed_mark
       where user_id = p_user and review is not null and review <> removed_mark and (p_entry is null or id = p_entry);
      get diagnostics n = row_count;
    elsif f = 'notes' then
      update public.entries set notes = removed_mark
       where user_id = p_user and notes is not null and notes <> removed_mark and (p_entry is null or id = p_entry);
      get diagnostics n = row_count;
    elsif f = 'tags' then
      update public.entries set tags = '{}'
       where user_id = p_user and cardinality(tags) > 0 and (p_entry is null or id = p_entry);
      get diagnostics n = row_count;
    end if;
    -- campos de obra: o registro guarda só a quantidade (ou o título da obra), nunca o texto (as anotações são privadas)
    if n > 0 and f not in ('display_name', 'bio') then
      perform public.log_action('wipe_' || f, p_user,
        case when p_entry is null then jsonb_build_object('obras', n) else jsonb_build_object('obra', left(one_title, 80)) end);
    end if;
    total := total + n;
  end loop;
  return total;
end;
$$;

-- Dá um novo nome de exibição para alguém.
create or replace function public.admin_rename_user(p_user uuid, p_display_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  newname text := btrim(coalesce(p_display_name, ''));
  oldname text;
begin
  perform public.require_outranks(p_user);
  if char_length(newname) < 1 or char_length(newname) > 40 then
    raise exception 'O nome precisa ter de 1 a 40 caracteres.' using errcode = '22023';
  end if;
  select display_name into oldname from public.profiles where id = p_user;
  perform public.log_action('rename', p_user, jsonb_build_object('antes', oldname, 'depois', newname));
  perform set_config('kamylist.staff_edit', '1', true);
  update public.profiles set display_name = newname where id = p_user;
end;
$$;

-- Suspende (ou reativa) uma conta.
create or replace function public.admin_set_suspended(p_user uuid, p_suspended boolean, p_reason text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  why text := left(public.clean_text(p_reason, true), 300);
begin
  perform public.require_outranks(p_user);
  if p_suspended then
    insert into public.suspensions (user_id, reason, suspended_by)
    values (p_user, why, auth.uid())
    on conflict (user_id) do update set reason = excluded.reason, suspended_by = excluded.suspended_by, suspended_at = now();
    perform public.log_action('suspend', p_user, jsonb_build_object('motivo', why));
  else
    delete from public.suspensions where user_id = p_user;
    perform public.log_action('unsuspend', p_user, '{}'::jsonb);
  end if;
end;
$$;

-- Muda o cargo de alguém: 'admin', 'mod' ou 'member'. A Dona só se define pelo SQL (veja o README).
-- Administração só mexe em Moderação e Membros; só a Dona cria ou tira administradores.
create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  myrank int := public.require_staff(2);
  cur    text;
begin
  if p_role is null or p_role not in ('admin', 'mod', 'member') then
    raise exception 'Cargo inválido.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user) then
    raise exception 'Perfil não encontrado.' using errcode = 'P0002';
  end if;
  if p_user = auth.uid() then
    raise exception 'Você não pode mudar o seu próprio cargo.' using errcode = '42501';
  end if;
  if public.rank_of(p_user) >= myrank then
    raise exception 'Você só pode mudar o cargo de quem tem um cargo menor que o seu.' using errcode = '42501';
  end if;
  if public.rank_of_role(p_role) >= myrank then
    raise exception 'Você só pode conceder cargos menores que o seu.' using errcode = '42501';
  end if;
  select r.role into cur from public.user_roles r where r.user_id = p_user;
  if p_role = 'member' then
    delete from public.user_roles where user_id = p_user;
  else
    insert into public.user_roles (user_id, role, granted_by)
    values (p_user, p_role, auth.uid())
    on conflict (user_id) do update set role = excluded.role, granted_by = excluded.granted_by, granted_at = now();
  end if;
  perform public.log_action('set_role', p_user, jsonb_build_object('antes', coalesce(cur, 'member'), 'depois', p_role));
end;
$$;

-- Fila de denúncias. A equipe só vê denúncias sobre quem tem cargo menor que o seu.
-- p_status: 'open', 'resolved', 'dismissed' ou 'all'
-- (drop antes: o formato do resultado ganhou colunas: bio e fundo atuais e o snapshot)
drop function if exists public.admin_list_reports(text, int);
create function public.admin_list_reports(p_status text default 'open', p_limit int default 50)
returns table (
  id                  bigint,
  created_at          timestamptz,
  status              text,
  reason              text,
  details             text,
  reporter_username   text,
  target_id           uuid,
  target_username     text,
  target_display_name text,
  target_avatar_v     bigint,
  target_role         text,
  target_suspended    boolean,
  handled_by_username text,
  handled_at          timestamptz,
  target_bio          text,
  target_bg_v         bigint,
  snapshot            jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  myrank int := public.require_staff(1);
begin
  return query
  select pr.id, pr.created_at, pr.status, pr.reason, pr.details,
         rp.username,
         t.id, t.username, t.display_name, t.avatar_v,
         tr.role,
         (ts.user_id is not null),
         hb.username,
         pr.handled_at,
         t.bio, t.bg_v,
         pr.snapshot
  from public.profile_reports pr
  join public.profiles t            on t.id = pr.target_id
  left join public.user_roles tr    on tr.user_id = t.id
  left join public.suspensions ts   on ts.user_id = t.id
  left join public.profiles rp      on rp.id = pr.reporter_id
  left join public.profiles hb      on hb.id = pr.handled_by
  where (coalesce(p_status, 'open') = 'all' or pr.status = coalesce(p_status, 'open'))
    and myrank > public.rank_of_role(tr.role)
  order by pr.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

-- Marca uma denúncia como resolvida, descartada ou volta para a fila.
create or replace function public.admin_resolve_report(p_report bigint, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rep public.profile_reports%rowtype;
begin
  if p_status is null or p_status not in ('open', 'resolved', 'dismissed') then
    raise exception 'Situação inválida.' using errcode = '22023';
  end if;
  select * into rep from public.profile_reports where id = p_report;
  if not found then
    raise exception 'Denúncia não encontrada.' using errcode = 'P0002';
  end if;
  perform public.require_outranks(rep.target_id);
  update public.profile_reports
     set status = p_status,
         handled_by = case when p_status = 'open' then null else auth.uid() end,
         handled_at = case when p_status = 'open' then null else now() end
   where id = p_report;
  perform public.log_action('report_' || p_status, rep.target_id, jsonb_build_object('denuncia', p_report, 'motivo', rep.reason));
end;
$$;

-- Registro de ações (mais recentes primeiro). Paginação: passe o id do último item recebido em p_before.
create or replace function public.admin_list_log(p_limit int default 50, p_before bigint default null)
returns table (
  id          bigint,
  created_at  timestamptz,
  actor_name  text,
  action      text,
  target_name text,
  details     jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_staff(1);
  return query
  select l.id, l.created_at, l.actor_name, l.action, l.target_name, l.details
  from public.mod_log l
  where p_before is null or l.id < p_before
  order by l.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

-- Todas as configurações (administração e Dona).
-- (O formato da resposta ganhou allowed_link_hosts: a função antiga é derrubada antes de recriar.)
drop function if exists public.admin_get_settings();
create or replace function public.admin_get_settings()
returns table (signups_open boolean, announcement text, blocked_names text[], allowed_link_hosts text[])
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_staff(2);
  return query
  select not exists (select 1 from public.site_settings s where s.key = 'signups_open' and s.value = 'false'::jsonb),
         coalesce((select s.value #>> '{}' from public.site_settings s where s.key = 'announcement'), ''),
         coalesce((select array(select jsonb_array_elements_text(s.value) order by 1)
                   from public.site_settings s where s.key = 'blocked_names' and jsonb_typeof(s.value) = 'array'), '{}'::text[]),
         coalesce((select array(select jsonb_array_elements_text(s.value) order by 1)
                   from public.site_settings s where s.key = 'allowed_link_hosts' and jsonb_typeof(s.value) = 'array'), '{}'::text[]);
end;
$$;

-- Muda uma configuração.
--   signups_open   (true/false)            só a Dona
--   announcement   (texto de até 280)      administração e Dona
--   blocked_names  (lista de palavras)     administração e Dona
--   allowed_link_hosts (lista de sites)    administração e Dona
create or replace function public.admin_set_setting(p_key text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleaned jsonb;
  prev    jsonb;
begin
  if p_key = 'signups_open' then
    perform public.require_staff(3);
    if p_value is null or jsonb_typeof(p_value) <> 'boolean' then
      raise exception 'Valor inválido.' using errcode = '22023';
    end if;
    cleaned := p_value;
  elsif p_key = 'announcement' then
    perform public.require_staff(2);
    if p_value is null or jsonb_typeof(p_value) <> 'string' or char_length(p_value #>> '{}') > 280 then
      raise exception 'O aviso pode ter até 280 caracteres.' using errcode = '22023';
    end if;
    cleaned := to_jsonb(public.clean_text(p_value #>> '{}', true));
  elsif p_key = 'allowed_link_hosts' then
    perform public.require_staff(2);
    if p_value is null or jsonb_typeof(p_value) <> 'array' or jsonb_array_length(p_value) > 100
       or exists (select 1 from jsonb_array_elements(p_value) x where jsonb_typeof(x) <> 'string') then
      raise exception 'A lista de sites permitidos aceita até 100 endereços.' using errcode = '22023';
    end if;
    select coalesce(jsonb_agg(distinct h order by h), '[]'::jsonb) into cleaned
    from (select public.normalize_host(x) as h from jsonb_array_elements_text(p_value) x) q
    where h <> '';
  elsif p_key = 'blocked_names' then
    perform public.require_staff(2);
    if p_value is null or jsonb_typeof(p_value) <> 'array' or jsonb_array_length(p_value) > 200
       or exists (select 1 from jsonb_array_elements(p_value) x where jsonb_typeof(x) <> 'string') then
      raise exception 'A lista de nomes proibidos aceita até 200 palavras.' using errcode = '22023';
    end if;
    select coalesce(jsonb_agg(distinct w order by w), '[]'::jsonb) into cleaned
    from (select left(lower(btrim(x)), 30) as w from jsonb_array_elements_text(p_value) x) q
    where char_length(w) >= 2;
  else
    raise exception 'Configuração desconhecida.' using errcode = '22023';
  end if;

  select s.value into prev from public.site_settings s where s.key = p_key;
  insert into public.site_settings (key, value, updated_by, updated_at)
  values (p_key, cleaned, auth.uid(), now())
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at;

  perform public.log_action('setting_' || p_key, null,
    case p_key
      when 'blocked_names' then jsonb_build_object('total', jsonb_array_length(cleaned))
      when 'allowed_link_hosts' then jsonb_build_object('total', jsonb_array_length(cleaned))
      else jsonb_build_object('antes', prev, 'depois', cleaned)
    end);
end;
$$;

revoke all on function public.log_action(text, uuid, jsonb)        from public, anon, authenticated;
revoke all on function public.require_staff(int)                   from public, anon, authenticated;
revoke all on function public.require_outranks(uuid)               from public, anon, authenticated;
revoke all on function public.my_access()                          from public, anon;
revoke all on function public.get_public_settings()                from public;
revoke all on function public.report_profile(text, text, text)    from public, anon;
revoke all on function public.admin_list_members(text, int, int)   from public, anon;
revoke all on function public.admin_reset_profile(uuid, text[])    from public, anon;
revoke all on function public.admin_wipe_text(uuid, text[], uuid)  from public, anon;
revoke all on function public.report_snapshot(uuid, uuid)          from public, anon, authenticated;
revoke all on function public.admin_rename_user(uuid, text)        from public, anon;
revoke all on function public.admin_set_suspended(uuid, boolean, text) from public, anon;
revoke all on function public.admin_set_role(uuid, text)           from public, anon;
revoke all on function public.admin_list_reports(text, int)        from public, anon;
revoke all on function public.admin_resolve_report(bigint, text)   from public, anon;
revoke all on function public.admin_list_log(int, bigint)          from public, anon;
revoke all on function public.admin_get_settings()                 from public, anon;
revoke all on function public.admin_set_setting(text, jsonb)       from public, anon;

grant execute on function public.my_access()                        to authenticated;
grant execute on function public.get_public_settings()              to anon, authenticated;
grant execute on function public.report_profile(text, text, text)  to authenticated;
grant execute on function public.admin_list_members(text, int, int) to authenticated;
grant execute on function public.admin_reset_profile(uuid, text[]) to authenticated;
grant execute on function public.admin_wipe_text(uuid, text[], uuid) to authenticated;
grant execute on function public.admin_rename_user(uuid, text)     to authenticated;
grant execute on function public.admin_set_suspended(uuid, boolean, text) to authenticated;
grant execute on function public.admin_set_role(uuid, text)        to authenticated;
grant execute on function public.admin_list_reports(text, int)     to authenticated;
grant execute on function public.admin_resolve_report(bigint, text) to authenticated;
grant execute on function public.admin_list_log(int, bigint)       to authenticated;
grant execute on function public.admin_get_settings()              to authenticated;
grant execute on function public.admin_set_setting(text, jsonb)    to authenticated;


-- Versão deste esquema. O site compara com a que ele espera e avisa se o banco estiver atrasado.
--   2 = Em espera, favoritos e códigos de obra
--   3 = foto de perfil (coluna avatar_v e armazenamento "avatars")
--   4 = seguir, feed e análises
--   5 = cores do perfil (coluna palette)
--   6 = mangás e light novels (categorias novas e contadores de leitura)
--   7 = cargos (Dona, Administração, Moderação), painel, denúncias, registro de ações e configurações do site
--   8 = abas ativas no perfil (coluna sections) e contagens por tipo no Explorar
--   9 = notas de 0 a 10 (meia estrela = 1 ponto; as notas antigas de 1 a 5 viram o dobro)
--   10 = preferências privadas da conta (tabela user_prefs: alto contraste); a cor de perfil "Alto contraste" virou essa opção
--   11 = fundo do perfil (colunas bg_v e bg_blur, armazenamento "backgrounds") e restauração do fundo pela equipe
--   12 = limites para trocar a foto e o fundo (tabela media_changes, funções my_media_limits e media_limits, gatilho no armazenamento)
--   13 = quem tem cargo (Dona, Administração, Moderação) fica fora dos limites de troca de foto e fundo (função media_exempt)
--   14 = segurança dos textos: limpeza de caracteres invisíveis/zalgo, palavras proibidas também em bio, tags, título digitado,
--        anotações e análise, e lista de sites permitidos (configuração allowed_link_hosts)
--   15 = denúncia com snapshot do perfil (coluna profile_reports.snapshot) e remoção de conteúdo campo a campo pela equipe
--        (função admin_wipe_text)
create or replace function public.schema_version()
returns integer
language sql
immutable
set search_path = ''
as $$ select 15 $$;

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


-- Fundos de perfil: outro bucket público, "backgrounds", também com UMA imagem por pessoa (o nome do arquivo é o ID da conta).
--   * o site reduz a imagem (no máximo 1600 px no lado maior) e converte para WebP (JPEG nos navegadores que não geram WebP)
--     antes de enviar; o limite de 384 KB e o filtro de tipo abaixo são a segunda trava, no servidor;
--   * qualquer pessoa pode VER (bucket público), mas só a dona envia, troca ou apaga o seu.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('backgrounds', 'backgrounds', true, 393216, array['image/webp', 'image/jpeg'])
on conflict (id) do update
  set public = true,
      file_size_limit = 393216,
      allowed_mime_types = array['image/webp', 'image/jpeg'];

drop policy if exists "backgrounds_select_own" on storage.objects;
create policy "backgrounds_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'backgrounds' and name = (select auth.uid())::text);

drop policy if exists "backgrounds_insert_own" on storage.objects;
create policy "backgrounds_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'backgrounds' and name = (select auth.uid())::text);

drop policy if exists "backgrounds_update_own" on storage.objects;
create policy "backgrounds_update_own" on storage.objects
  for update to authenticated
  using      (bucket_id = 'backgrounds' and name = (select auth.uid())::text)
  with check (bucket_id = 'backgrounds' and name = (select auth.uid())::text);

drop policy if exists "backgrounds_delete_own" on storage.objects;
create policy "backgrounds_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'backgrounds' and name = (select auth.uid())::text);


-- ---------------------------------------------------------------------
-- 7. Limites para trocar a foto e o fundo (cooldown + limite diário)
-- ---------------------------------------------------------------------
-- Trocar a foto ou o fundo sem parar (para fugir de denúncias ou só para gastar armazenamento e banda) é barrado AQUI, no banco:
--   * Cada troca (enviar uma imagem nova para o bucket "avatars" ou "backgrounds") fica registrada em media_changes.
--   * Espera entre trocas: 30 segundos, separadamente para a foto e para o fundo.
--   * Limite por dia: 10 trocas nas últimas 24 horas, somando foto E fundo.
--   * Vale também para quem tentar enviar direto ao Storage, sem passar pelo site: o gatilho fica no próprio armazenamento.
--   * Remover a foto ou o fundo não conta como troca.
--   * Quem tem cargo (Dona, Administração e Moderação) e as rotinas do servidor (sem login) não são limitados: nada é recusado nem registrado.
--   * Quem passa do limite recebe um erro com o tempo que falta (o site mostra isso em português).
-- Para mudar os números, edite só a função media_limits() logo abaixo e rode o script de novo.
create table if not exists public.media_changes (
  id         bigint generated always as identity primary key,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  kind       text        not null,
  created_at timestamptz not null default now()
);
alter table public.media_changes drop constraint if exists media_changes_kind;
alter table public.media_changes  add constraint media_changes_kind check (kind in ('avatar', 'background'));
create index if not exists media_changes_user_idx on public.media_changes (user_id, created_at desc);

-- Só as funções abaixo (que rodam com a permissão do banco) leem e escrevem aqui: ninguém acessa a tabela direto.
alter table public.media_changes enable row level security;
revoke all on public.media_changes from anon, authenticated;

-- Os números dos limites num lugar só.
create or replace function public.media_limits()
returns table (cooldown_s integer, daily_limit integer)
language sql
immutable
set search_path = ''
as $$ select 30, 10 $$;

-- Quem tem cargo (Dona, Administração ou Moderação) fica fora dos limites. Perder o cargo faz os limites valerem de novo na hora.
create or replace function public.media_exempt(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from public.user_roles r where r.user_id = p_user) $$;

-- Quanto tempo falta (em segundos) para a pessoa poder trocar a foto ('avatar') ou o fundo ('background') e por quê:
-- 'cooldown' (espera entre trocas) ou 'diario' (limite das últimas 24 horas). 0 segundos = pode trocar agora.
create or replace function public.media_wait(p_user uuid, p_kind text)
returns table (wait_s integer, reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cool    integer;
  v_daily   integer;
  v_now     timestamptz := clock_timestamp();
  v_last    timestamptz;
  v_used    integer;
  v_edge    timestamptz;
  v_cool_w  numeric := 0;
  v_day_w   numeric := 0;
begin
  if public.media_exempt(p_user) then
    wait_s := 0;
    reason := null;
    return next;
    return;
  end if;

  select l.cooldown_s, l.daily_limit into v_cool, v_daily from public.media_limits() l;

  select max(m.created_at) into v_last from public.media_changes m where m.user_id = p_user and m.kind = p_kind;
  if v_last is not null then
    v_cool_w := extract(epoch from (v_last + make_interval(secs => v_cool)) - v_now);
  end if;

  select count(*) into v_used from public.media_changes m where m.user_id = p_user and m.created_at > v_now - interval '24 hours';
  if v_used >= v_daily then
    -- libera quando sair da janela de 24 h a troca que fecha o limite (a mais antiga, se estiver exatamente no limite)
    select m.created_at into v_edge from public.media_changes m
     where m.user_id = p_user and m.created_at > v_now - interval '24 hours'
     order by m.created_at asc offset (v_used - v_daily) limit 1;
    v_day_w := extract(epoch from (v_edge + interval '24 hours') - v_now);
  end if;

  wait_s := greatest(ceil(greatest(v_cool_w, v_day_w))::integer, 0);
  reason := case when wait_s = 0 then null when v_day_w >= v_cool_w then 'diario' else 'cooldown' end;
  return next;
end;
$$;

-- A situação de quem está logado: o site usa para mostrar "X de 10 trocas hoje" e para travar o botão durante a espera.
-- (exempt: a pessoa tem cargo e está fora dos limites.)
-- (drop antes: o resultado ganhou a coluna "exempt")
drop function if exists public.my_media_limits();
create or replace function public.my_media_limits()
returns table (
  cooldown_s        integer,
  daily_limit       integer,
  used_today        integer,
  avatar_wait       integer,
  avatar_reason     text,
  background_wait   integer,
  background_reason text,
  exempt            boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Não autenticado.' using errcode = '28000';
  end if;
  select l.cooldown_s, l.daily_limit into cooldown_s, daily_limit from public.media_limits() l;
  select count(*) into used_today from public.media_changes m where m.user_id = v_uid and m.created_at > clock_timestamp() - interval '24 hours';
  select w.wait_s, w.reason into avatar_wait, avatar_reason from public.media_wait(v_uid, 'avatar') w;
  select w.wait_s, w.reason into background_wait, background_reason from public.media_wait(v_uid, 'background') w;
  exempt := public.media_exempt(v_uid);
  return next;
end;
$$;

-- O gatilho no armazenamento: confere e registra cada troca. Se estiver no limite, recusa o envio com uma mensagem de formato fixo
-- (KAMYLIST_LIMITE_<COOLDOWN|DIARIO>:<foto|fundo>:<segundos>:<número do limite>) que o site traduz.
-- Só o INSERT conta: enviar de novo "por cima" da imagem atual também passa por um INSERT (o armazenamento usa "inserir ou substituir"),
-- e assim nenhuma atualização interna do Supabase (data de acesso, metadados) é confundida com uma troca.
create or replace function public.limit_media_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_kind text;
  v_wait integer;
  v_why  text;
  v_lim  integer;
begin
  if v_uid is null then return new; end if;                                   -- rotina do servidor ou painel do Supabase: sem limite
  v_kind := case new.bucket_id when 'avatars' then 'avatar' when 'backgrounds' then 'background' else null end;
  if v_kind is null or new.name is distinct from v_uid::text then return new; end if;   -- outro bucket, ou arquivo de outra conta (a política recusa)
  if public.media_exempt(v_uid) then return new; end if;                      -- equipe (Dona, Administração, Moderação): sem limite e sem registro

  select w.wait_s, w.reason into v_wait, v_why from public.media_wait(v_uid, v_kind) w;
  if v_wait > 0 then
    select case when v_why = 'diario' then l.daily_limit else l.cooldown_s end into v_lim from public.media_limits() l;
    raise exception 'KAMYLIST_LIMITE_%:%:%:%', upper(v_why), case v_kind when 'avatar' then 'foto' else 'fundo' end, v_wait, v_lim
      using errcode = 'P0001';
  end if;

  insert into public.media_changes (user_id, kind) values (v_uid, v_kind);
  delete from public.media_changes where user_id = v_uid and created_at < now() - interval '2 days';   -- só guarda o que ainda conta
  return new;
end;
$$;

revoke all on function public.media_limits()                  from public, anon, authenticated;
revoke all on function public.media_exempt(uuid)              from public, anon, authenticated;
revoke all on function public.media_wait(uuid, text)          from public, anon, authenticated;
revoke all on function public.my_media_limits()               from public, anon;
revoke all on function public.limit_media_changes()           from public, anon, authenticated;
grant execute on function public.my_media_limits()            to authenticated;

-- Liga o gatilho ao armazenamento. Se o Supabase não deixar criar gatilhos ali, o resto do script segue (o aviso aparece no resultado)
-- e os limites valem só para quem passa pelo site, que também confere antes de enviar.
do $$
begin
  drop trigger if exists limit_media_changes on storage.objects;
  create trigger limit_media_changes
    before insert on storage.objects
    for each row
    when (new.bucket_id in ('avatars', 'backgrounds'))
    execute function public.limit_media_changes();
exception when insufficient_privilege then
  raise warning 'KamyList: não foi possível criar o gatilho de limites no armazenamento (sem permissão). As trocas de foto e fundo não terão limite no servidor.';
end $$;
