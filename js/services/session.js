// Estado da sessão (quem está logado) e acesso ao backend escolhido.
// Troca de backend em um lugar só: sem chaves do Supabase = modo local.
import { hasSupabase } from '../config.js';

export const state = { backend: null, user: null, profile: null, requests: 0, ready: false };

const listeners = new Set();
// reason: 'local' (mudança feita por esta aba) ou 'external' (outra aba, expiração de sessão...)
const emit = (reason = 'local') => listeners.forEach((fn) => { try { fn(state, reason); } catch (e) { console.error(e); } });

export const backend = () => state.backend;
export const isCloud = () => state.backend?.mode === 'cloud';
export const isLoggedIn = () => Boolean(state.user);
export function onSessionChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function setProfile(profile) {
    state.profile = profile;
    emit();
}

async function safeProfile() {
    try { return await state.backend.profiles.getMine(); } catch (e) { console.error(e); return null; }
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
    state.profile = state.user ? await safeProfile() : null;
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
            state.profile = user ? await safeProfile() : null;
            emit('external');
            refreshRequests();
        }
        if (event === 'PASSWORD_RECOVERY') onRecovery?.();
    });

    state.user = await state.backend.auth.getUser();
    state.profile = state.user ? await safeProfile() : null;
    state.ready = true;
    refreshRequests();      // sem esperar: o número aparece no menu assim que chegar
    return state;
}
