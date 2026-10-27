// Backend com Supabase: login (Auth), perfis e obras (Postgres + RLS).
// As regras de quem pode ver/editar o quê estão no banco (sql/schema.sql);
// este arquivo só conversa com ele.
import { config } from '../config.js';
import { AppError } from '../core/errors.js';
import { safeUrl } from '../core/dom.js';
import { normalizeEntry } from '../domain/entry.js';

const PAGE = 1000;   // limite de linhas por requisição do Supabase
const CHUNK = 100;   // obras por lote ao importar

// --- tradução de erros ---------------------------------------------------

function friendly(error, fallback) {
    const msg = String(error?.message || '');
    const code = String(error?.code || '');
    const has = (s) => msg.toLowerCase().includes(s.toLowerCase());

    if (has('Invalid login credentials')) return 'E-mail ou senha incorretos.';
    if (has('Email not confirmed')) return 'Confirme seu e-mail antes de entrar (veja a caixa de entrada e o spam).';
    if (has('User already registered')) return 'Este e-mail já está cadastrado. Tente entrar ou recuperar a senha.';
    if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || error?.status === 429 || has('rate limit')) {
        return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.';
    }
    if (code === 'same_password' || has('different from the old password')) return 'A nova senha precisa ser diferente da atual.';
    if (code === 'weak_password' || has('Password should')) return 'A senha é muito fraca. Use pelo menos 8 caracteres.';
    if (code === 'signup_disabled' || has('Signups not allowed')) return 'Novos cadastros estão desativados.';
    if (code === 'email_address_invalid') return 'Esse e-mail não é aceito. Confira o endereço.';
    if (code === '23505') return 'Este nome de usuário já está em uso.';
    // mensagens das funções do banco que já vêm prontas em português
    if (code === 'P0002' || code === '22023' || has('Limite de 1000') || has('Não autenticado')) return msg.includes('Não autenticado') ? 'Entre na sua conta para fazer isso.' : msg;
    if (has('Bucket not found')) return 'O armazenamento de fotos ainda não existe no Supabase. Rode o sql/schema.sql de novo (SQL Editor).';
    if (has('maximum allowed size') || error?.statusCode === '413' || error?.status === 413) return 'A foto ficou grande demais (o limite é 64 KB). Tente outra imagem.';
    if (has('mime type') && has('not supported')) return 'Formato de imagem não aceito pelo servidor. Tente outra imagem.';
    if (has('entries_status')) return 'O banco ainda não aceita este status ("Dropado" ou "Em espera"). Rode o sql/schema.sql de novo no Supabase (SQL Editor).';
    if (code === 'PGRST204' || has('schema cache')) return 'O banco de dados está desatualizado. Rode o sql/schema.sql de novo no Supabase (SQL Editor) e recarregue a página.';
    if (code === '23514') return has('Limite') ? 'Limite de obras da conta atingido.' : 'Algum dado está em formato inválido.';
    if (code === '42501' || has('row-level security')) return 'Sem permissão para isso. Saia e entre de novo.';
    if (has('Failed to fetch') || has('NetworkError') || has('Load failed') || error?.name === 'AuthRetryableFetchError') {
        return 'Sem conexão com o servidor. Verifique sua internet.';
    }
    if (has('JWT') || has('session')) return 'Sua sessão expirou. Entre novamente.';
    return fallback;
}

const fail = (error, fallback) => new AppError(friendly(error, fallback), error);

/** Resolve uma chamada do supabase-js ({ data, error }) ou lança AppError. */
async function ok(promise, fallback = 'Algo deu errado. Tente novamente.') {
    let res;
    try { res = await promise; } catch (e) { throw fail(e, fallback); }
    if (res.error) throw fail(res.error, fallback);
    return res.data;
}

// --- mapeamento banco <-> app -------------------------------------------

const toRow = (e) => ({
    title: e.title,
    category: e.category,
    status: e.status,
    rating: e.rating,
    tags: e.tags,
    air_day: e.airDay || null,
    notes: e.notes || null,
    cover_image: e.coverImage || null,
    description: e.description || null,
    genres: e.genres,
    seasons: e.seasons,
    favorite: e.favorite === true,
    source_ref: e.sourceRef || null,
    review: e.review || null,
    review_spoiler: e.reviewSpoiler === true,
});

const fromRow = (r) => normalizeEntry({
    id: r.id, title: r.title, category: r.category, status: r.status, rating: r.rating,
    tags: r.tags, airDay: r.air_day, notes: r.notes, coverImage: r.cover_image,
    description: r.description, genres: r.genres, seasons: r.seasons, createdAt: r.created_at,
    favorite: r.favorite, sourceRef: r.source_ref,
    review: r.review, reviewSpoiler: r.review_spoiler,
});

const fromProfile = (r) => (r ? {
    id: r.id,
    username: r.username,
    displayName: r.display_name || r.username,
    bio: r.bio || '',
    isPublic: Boolean(r.is_public),
    showNotes: Boolean(r.show_notes),
    avatarV: Number(r.avatar_v) || 0,
    palette: r.palette || 'default',
} : null);

const personOf = (r) => ({
    id: r.id,
    username: r.username,
    displayName: r.display_name || r.username,
    avatarV: Number(r.avatar_v) || 0,
});

const redirectUrl = () => location.origin + location.pathname;
const AVATAR_BUCKET = 'avatars';

// --- backend -------------------------------------------------------------

export async function createSupabaseBackend() {
    const { createClient } = await import(config.supabaseEsmUrl);
    const sb = createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });

    const currentUid = async () => {
        const { data } = await sb.auth.getSession();
        return data?.session?.user?.id || null;
    };
    const requireUid = async () => {
        const uid = await currentUid();
        if (!uid) throw new AppError('Sua sessão expirou. Entre novamente.');
        return uid;
    };

    // Lê todas as páginas de um resultado (o Supabase devolve no máximo 1000 linhas por vez).
    async function fetchAll(makePage) {
        const rows = [];
        for (let from = 0; ; from += PAGE) {
            const page = await ok(makePage(from, from + PAGE - 1), 'Não foi possível carregar as obras.');
            rows.push(...(page || []));
            if (!page || page.length < PAGE) break;
        }
        return rows;
    }

    // `created` recebe cada lote assim que ele entra; se algo falhar no meio, quem chamou
    // ainda sabe o que já foi inserido.
    async function insertChunks(entries, uid, created = []) {
        for (let i = 0; i < entries.length; i += CHUNK) {
            // activity_kind "silent": importar backup/lista antiga não vira atividade no feed dos seguidores
            const rows = entries.slice(i, i + CHUNK).map((e) => ({ ...toRow(normalizeEntry(e)), user_id: uid, activity_kind: 'silent' }));
            const data = await ok(sb.from('entries').insert(rows).select(), 'Não foi possível importar as obras.');
            created.push(...data.map(fromRow));
        }
        return created;
    }

    return {
        mode: 'cloud',
        features: { accounts: true },

        auth: {
            async getUser() {
                const { data } = await sb.auth.getSession();
                const u = data?.session?.user;
                return u ? { id: u.id, email: u.email || '' } : null;
            },

            onChange(cb) {
                const { data } = sb.auth.onAuthStateChange((event, session) => {
                    const u = session?.user;
                    // setTimeout: o Supabase pede para não chamar outras APIs dele dentro deste callback.
                    setTimeout(() => cb(event, u ? { id: u.id, email: u.email || '' } : null), 0);
                });
                return () => data.subscription.unsubscribe();
            },

            async signUp({ email, password, username }) {
                const data = await ok(
                    sb.auth.signUp({
                        email, password,
                        options: { data: { username, display_name: username }, emailRedirectTo: redirectUrl() },
                    }),
                    'Não foi possível criar a conta.'
                );
                // Com confirmação de e-mail ligada, e-mail repetido não dá erro: vem sem identidades.
                if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
                    throw new AppError('Este e-mail já está cadastrado. Tente entrar ou recuperar a senha.');
                }
                return { needsConfirmation: !data?.session };
            },

            async signIn({ email, password }) {
                await ok(sb.auth.signInWithPassword({ email, password }), 'Não foi possível entrar.');
            },

            async signOut() {
                await ok(sb.auth.signOut(), 'Não foi possível sair.');
            },

            async sendPasswordReset(email) {
                await ok(sb.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl() }), 'Não foi possível enviar o e-mail.');
            },

            async updatePassword(password) {
                await ok(sb.auth.updateUser({ password }), 'Não foi possível trocar a senha.');
            },

            /** Apaga a própria conta, o perfil e todas as obras (função delete_my_account do banco). */
            async deleteAccount() {
                // A foto fica no Storage (arquivos não somem com o apagar em cascata do banco): remove primeiro.
                // Se falhar (ex.: banco ainda sem o armazenamento), a exclusão da conta continua.
                try {
                    const uid = await currentUid();
                    if (uid) await sb.storage.from(AVATAR_BUCKET).remove([uid]);
                } catch { /* melhor esforço */ }
                await ok(sb.rpc('delete_my_account'), 'Não foi possível excluir a conta. Rode o sql/schema.sql de novo no Supabase.');
                // A sessão local ainda existe, mas o usuário não: limpa só o navegador (sem chamar o servidor).
                try { await sb.auth.signOut({ scope: 'local' }); } catch { /* já foi apagada */ }
            },

            /** true / false, ou null se não deu para checar. */
            async usernameAvailable(username) {
                try {
                    const { data, error } = await sb.rpc('username_available', { p_username: username });
                    return error ? null : Boolean(data);
                } catch {
                    return null;
                }
            },
        },

        /** Versão do esquema do banco (1 = antigo, sem a função schema_version). null = não deu para saber. */
        meta: {
            async schemaVersion() {
                try {
                    const { data, error } = await sb.rpc('schema_version');
                    if (error) return error.code === 'PGRST202' || error.code === '42883' ? 1 : null;
                    return Number(data) || 1;
                } catch {
                    return null;
                }
            },
        },

        profiles: {
            async getMine() {
                const uid = await currentUid();
                if (!uid) return null;
                const row = await ok(sb.from('profiles').select('*').eq('id', uid).maybeSingle(), 'Não foi possível carregar seu perfil.');
                return fromProfile(row);
            },

            async updateMine(patch) {
                const uid = await requireUid();
                const clean = {};
                if (patch.username !== undefined) clean.username = String(patch.username).trim().toLowerCase();
                if (patch.displayName !== undefined) clean.display_name = String(patch.displayName).trim().slice(0, 40);
                if (patch.bio !== undefined) clean.bio = String(patch.bio).trim().slice(0, 200);
                if (patch.isPublic !== undefined) clean.is_public = Boolean(patch.isPublic);
                if (patch.showNotes !== undefined) clean.show_notes = Boolean(patch.showNotes);
                if (patch.palette !== undefined) clean.palette = String(patch.palette).trim().toLowerCase().slice(0, 24);
                const row = await ok(sb.from('profiles').update(clean).eq('id', uid).select().single(), 'Não foi possível salvar o perfil.');
                return fromProfile(row);
            },

            /**
             * Troca a foto de perfil. `blob` já vem reduzido (js/services/avatarImage.js).
             * O arquivo tem sempre o mesmo nome (o ID da conta): enviar de novo SOBRESCREVE a foto anterior,
             * então nenhuma imagem antiga fica ocupando espaço.
             */
            async setAvatar(blob) {
                const uid = await requireUid();
                let res;
                try {
                    res = await sb.storage.from(AVATAR_BUCKET).upload(uid, blob, { upsert: true, contentType: blob.type, cacheControl: '31536000' });
                } catch (e) { throw fail(e, 'Não foi possível enviar a foto.'); }
                if (res.error) throw fail(res.error, 'Não foi possível enviar a foto.');
                // versão = segundos desde 1970 (nunca menor que a anterior + 1): muda a cada troca, mesmo por outro aparelho
                const cur = await ok(sb.from('profiles').select('avatar_v').eq('id', uid).maybeSingle(), 'Não foi possível carregar seu perfil.');
                const version = Math.max(Math.floor(Date.now() / 1000), (Number(cur?.avatar_v) || 0) + 1);
                const row = await ok(sb.from('profiles').update({ avatar_v: version }).eq('id', uid).select().single(), 'A foto foi enviada, mas não deu para salvar no perfil.');
                return fromProfile(row);
            },

            /** Remove a foto: apaga o arquivo do Storage e zera a versão no perfil. */
            async removeAvatar() {
                const uid = await requireUid();
                let res;
                try { res = await sb.storage.from(AVATAR_BUCKET).remove([uid]); } catch (e) { throw fail(e, 'Não foi possível remover a foto.'); }
                if (res.error) throw fail(res.error, 'Não foi possível remover a foto.');
                const row = await ok(sb.from('profiles').update({ avatar_v: 0 }).eq('id', uid).select().single(), 'Não foi possível atualizar o perfil.');
                return fromProfile(row);
            },

            /**
             * Perfil de qualquer pessoa, já respeitando a privacidade (função get_profile do banco).
             * Devolve null se o usuário não existir. Perfil privado visto por quem não é seguidor aceito
             * vem só com nome, usuário e foto (canView = false).
             * relation: 'self' | 'accepted' | 'pending' | 'none'
             */
            async getPublic(username) {
                const rows = await ok(sb.rpc('get_profile', { p_username: String(username).toLowerCase() }), 'Não foi possível carregar o perfil.');
                const r = Array.isArray(rows) ? rows[0] : rows;
                if (!r) return null;
                return {
                    ...fromProfile(r),
                    relation: r.relation || 'none',
                    canView: Boolean(r.can_view),
                    followersCount: r.followers_count == null ? null : Number(r.followers_count),
                    followingCount: r.following_count == null ? null : Number(r.following_count),
                };
            },

            async listPublic({ query = '', limit = 30 } = {}) {
                const rows = await ok(sb.rpc('list_public_profiles', { p_query: query, p_limit: limit }), 'Não foi possível carregar os perfis.');
                return (rows || []).map((r) => ({
                    id: r.id,
                    avatarV: Number(r.avatar_v) || 0,
                    username: r.username,
                    displayName: r.display_name || r.username,
                    bio: r.bio || '',
                    total: Number(r.total) || 0,
                    watching: Number(r.watching) || 0,
                    completed: Number(r.completed) || 0,
                }));
            },
        },

        follows: {
            /** Segue (perfil público => 'accepted') ou pede para seguir (perfil privado => 'pending'). */
            async follow(username) {
                return ok(sb.rpc('follow_user', { p_username: username }), 'Não foi possível seguir este perfil.');
            },
            /** Deixa de seguir, ou cancela o pedido pendente. */
            async unfollow(username) {
                await ok(sb.rpc('unfollow_user', { p_username: username }), 'Não foi possível deixar de seguir.');
            },
            /** Pedidos de quem quer seguir o MEU perfil (privado) e espera aprovação. */
            async requests() {
                const rows = await ok(sb.rpc('list_follow_requests'), 'Não foi possível carregar os pedidos.');
                return (rows || []).map((r) => ({ ...personOf(r), requestedAt: r.requested_at }));
            },
            async respond(followerId, accept) {
                await ok(sb.rpc('respond_follow_request', { p_follower: followerId, p_accept: Boolean(accept) }), 'Não foi possível responder ao pedido.');
            },
            async removeFollower(followerId) {
                await ok(sb.rpc('remove_follower', { p_follower: followerId }), 'Não foi possível remover.');
            },
            /** kind: 'followers' | 'following' */
            async connections(username, kind) {
                const rows = await ok(sb.rpc('list_connections', { p_username: username, p_kind: kind }), 'Não foi possível carregar a lista.');
                return (rows || []).map(personOf);
            },
            /** Atividade de quem eu sigo. `before` = { at, id } do último item recebido (próxima página). */
            async feed({ limit = 30, before = null } = {}) {
                const args = { p_limit: limit };
                if (before) { args.p_before_at = before.at; args.p_before_id = before.id; }
                const rows = await ok(sb.rpc('get_feed', args), 'Não foi possível carregar o feed.');
                return (rows || []).map((r) => ({
                    entryId: r.entry_id,
                    person: personOf({ id: r.user_id, username: r.username, display_name: r.display_name, avatar_v: r.avatar_v }),
                    title: r.title,
                    category: r.category,
                    status: r.status,
                    rating: Number(r.rating) || 0,
                    coverImage: safeUrl(r.cover_image),
                    review: r.review || '',
                    reviewSpoiler: r.review_spoiler === true,
                    kind: r.activity_kind,
                    at: r.activity_at,
                }));
            },
        },

        library: {
            async listMine() {
                await requireUid();
                const rows = await fetchAll((from, to) =>
                    sb.from('entries').select('*').order('created_at', { ascending: false }).order('id').range(from, to));
                return rows.map(fromRow);
            },

            async create(entry) {
                const uid = await requireUid();
                const row = await ok(
                    sb.from('entries').insert({ ...toRow(normalizeEntry(entry)), user_id: uid }).select().single(),
                    'Não foi possível salvar a obra.'
                );
                return fromRow(row);
            },

            async update(entry) {
                const row = await ok(
                    sb.from('entries').update(toRow(normalizeEntry(entry))).eq('id', entry.id).select().single(),
                    'Não foi possível salvar as alterações.'
                );
                return fromRow(row);
            },

            async remove(id) {
                await ok(sb.from('entries').delete().eq('id', id), 'Não foi possível excluir a obra.');
            },

            async addMany(entries) {
                const uid = await requireUid();
                return insertChunks(entries, uid);
            },

            /** Insere as novas primeiro e só então apaga as antigas, para nunca perder dados se algo falhar no meio. */
            async replaceAll(entries) {
                const uid = await requireUid();
                const oldRows = await fetchAll((from, to) => sb.from('entries').select('id').order('id').range(from, to));
                const created = [];
                try {
                    await insertChunks(entries, uid, created);
                } catch (err) {
                    // Desfaz o que entrou pela metade (as obras antigas continuam intactas).
                    if (created.length) {
                        try { await sb.from('entries').delete().in('id', created.map((e) => e.id)); } catch { /* melhor esforço */ }
                    }
                    throw err;
                }
                for (let i = 0; i < oldRows.length; i += CHUNK) {
                    const ids = oldRows.slice(i, i + CHUNK).map((r) => r.id);
                    await ok(sb.from('entries').delete().in('id', ids), 'As obras novas foram importadas, mas não deu para remover as antigas.');
                }
                return created;
            },

            async listPublic(username) {
                const rows = await fetchAll((from, to) => sb.rpc('get_public_entries', { p_username: username }).range(from, to));
                return rows.map(fromRow);
            },
        },
    };
}
