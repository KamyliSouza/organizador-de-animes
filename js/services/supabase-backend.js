// Backend com Supabase: login (Auth), perfis e obras (Postgres + RLS).
// As regras de quem pode ver/editar o quê estão no banco (sql/schema.sql);
// este arquivo só conversa com ele.
import { config } from '../config.js';
import { AppError } from '../core/errors.js';
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
    if (has('entries_status')) return 'O banco ainda não aceita o status "Dropado". Rode o sql/schema.sql de novo no Supabase (SQL Editor).';
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
});

const fromRow = (r) => normalizeEntry({
    id: r.id, title: r.title, category: r.category, status: r.status, rating: r.rating,
    tags: r.tags, airDay: r.air_day, notes: r.notes, coverImage: r.cover_image,
    description: r.description, genres: r.genres, seasons: r.seasons, createdAt: r.created_at,
});

const fromProfile = (r) => (r ? {
    id: r.id,
    username: r.username,
    displayName: r.display_name || r.username,
    bio: r.bio || '',
    isPublic: Boolean(r.is_public),
    showNotes: Boolean(r.show_notes),
} : null);

const redirectUrl = () => location.origin + location.pathname;

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
            const rows = entries.slice(i, i + CHUNK).map((e) => ({ ...toRow(normalizeEntry(e)), user_id: uid }));
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
                const row = await ok(sb.from('profiles').update(clean).eq('id', uid).select().single(), 'Não foi possível salvar o perfil.');
                return fromProfile(row);
            },

            /** Perfil público (ou o seu próprio, mesmo privado). null se não existir/não for público. */
            async getPublic(username) {
                const row = await ok(
                    sb.from('profiles').select('*').eq('username', String(username).toLowerCase()).maybeSingle(),
                    'Não foi possível carregar o perfil.'
                );
                return fromProfile(row);
            },

            async listPublic({ query = '', limit = 30 } = {}) {
                const rows = await ok(sb.rpc('list_public_profiles', { p_query: query, p_limit: limit }), 'Não foi possível carregar os perfis.');
                return (rows || []).map((r) => ({
                    username: r.username,
                    displayName: r.display_name || r.username,
                    bio: r.bio || '',
                    total: Number(r.total) || 0,
                    watching: Number(r.watching) || 0,
                    completed: Number(r.completed) || 0,
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
