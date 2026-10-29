// Estado da sessão (quem está logado) e acesso ao backend escolhido.
// Troca de backend em um lugar só: sem chaves do Supabase = modo local.
import { hasSupabase } from '../config.js';
import { clearOwnPalette, setOwnPalette } from '../core/palette.js';

const NO_ACCESS = { role: 'member', suspended: false, reason: '' };
const OPEN_SITE = { signupsOpen: true, announcement: '' };

// access = cargo em vigor e suspensão de quem está logado · site = configurações públicas (aviso e cadastros)
export const state = { backend: null, user: null, profile: null, requests: 0, ready: false, access: NO_ACCESS, site: OPEN_SITE };

const listeners = new Set();
// reason: 'local' (mudança feita por esta aba) ou 'external' (outra aba, expiração de sessão...)
const emit = (reason = 'local') => { syncPalette(); listeners.forEach((fn) => { try { fn(state, reason); } catch (e) { console.error(e); } }); };

/** O preset de cores da conta vale no site todo para quem está logado. Sem conta (ou sem login): padrão. No modo local fica só o que está neste navegador. */
function syncPalette() {
    if (state.backend?.mode !== 'cloud') return;
    if (!state.user) clearOwnPalette();
    else if (state.profile) setOwnPalette(state.profile.palette);
}

export const backend = () => state.backend;
export const isCloud = () => state.backend?.mode === 'cloud';
export const isLoggedIn = () => Boolean(state.user);
/** Cargo em vigor de quem está logado ('member' quando não há login, no modo local ou com a conta suspensa). */
export const myRole = () => (state.user ? state.access.role : 'member');
export function onSessionChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function setProfile(profile) {
    state.profile = profile;
    emit();
}

async function safeProfile() {
    try { return await state.backend.profiles.getMine(); } catch (e) { console.error(e); return null; }
}

/** Cargo e suspensão de quem está logado. Só existe com o Supabase; sem a v7 do banco todo mundo é membro. */
async function safeAccess() {
    if (state.backend?.mode !== 'cloud' || !state.backend.access) return NO_ACCESS;
    try { return await state.backend.access.mine(); } catch { return NO_ACCESS; }
}
async function safeSite() {
    if (state.backend?.mode !== 'cloud' || !state.backend.access) return OPEN_SITE;
    try { return await state.backend.access.siteSettings(); } catch { return OPEN_SITE; }
}

/** Relê só o cargo e as configurações (usado pelo painel depois de mudar algo). */
export async function refreshAccess() {
    const [access, site] = await Promise.all([state.user ? safeAccess() : NO_ACCESS, safeSite()]);
    state.access = access;
    state.site = site;
    emit();
}

/** Perfil + cargo de uma vez (em paralelo). */
async function loadAccount() {
    if (!state.user) { state.profile = null; state.access = NO_ACCESS; return; }
    const [profile, access] = await Promise.all([safeProfile(), safeAccess()]);
    state.profile = profile;
    state.access = access;
}

/** Quantos pedidos de "seguir" esperam a minha resposta (mostrado no menu). Falhas só zeram o número. */
export function setRequestCount(n) {
    const next = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    if (next === state.requests) return;
    state.requests = next;
    emit();
}

let requestsToken = 0;
export async function refreshRequests() {
    const mine = ++requestsToken;
    if (!state.user || !state.backend?.follows?.requests || state.backend.mode !== 'cloud') { setRequestCount(0); return; }
    try {
        const list = await state.backend.follows.requests();
        if (mine === requestsToken) setRequestCount(list.length);
    } catch {
        if (mine === requestsToken) setRequestCount(0);   // banco ainda sem a função: sem pedidos
    }
}

/** Relê quem está logado agora. Chame logo depois de entrar/sair para a tela já refletir o novo estado. */
export async function refreshSession() {
    state.user = await state.backend.auth.getUser();
    await loadAccount();
    emit();
    refreshRequests();
}

/** Carrega o backend e a sessão. `onRecovery` roda quando a pessoa chega por um link de "recuperar senha". */
export async function initSession({ onRecovery } = {}) {
    if (hasSupabase()) {
        const { createSupabaseBackend } = await import('./supabase-backend.js');
        state.backend = await createSupabaseBackend();
    } else {
        const { createLocalBackend } = await import('./local-backend.js');
        state.backend = createLocalBackend();
    }

    // Registra o ouvinte ANTES de ler a sessão: o evento PASSWORD_RECOVERY sai durante a inicialização.
    state.backend.auth.onChange(async (event, user) => {
        const changed = (user?.id || null) !== (state.user?.id || null);
        if (changed) {            // SIGNED_IN também dispara ao voltar para a aba: sem mudança de usuário, ignora
            state.user = user;
            await loadAccount();
            emit('external');
            refreshRequests();
        }
        if (event === 'PASSWORD_RECOVERY') onRecovery?.();
    });

    const sitePromise = safeSite();        // em paralelo com o login: aviso do site e cadastros abertos
    state.user = await state.backend.auth.getUser();
    await loadAccount();
    state.site = await sitePromise;
    state.ready = true;
    syncPalette();
    refreshRequests();      // sem esperar: o número aparece no menu assim que chegar
    return state;
}
