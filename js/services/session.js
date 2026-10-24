// Estado da sessão (quem está logado) e acesso ao backend escolhido.
// Troca de backend em um lugar só: sem chaves do Supabase = modo local.
import { hasSupabase } from '../config.js';

export const state = { backend: null, user: null, profile: null, ready: false };

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

/** Relê quem está logado agora. Chame logo depois de entrar/sair para a tela já refletir o novo estado. */
export async function refreshSession() {
    state.user = await state.backend.auth.getUser();
    state.profile = state.user ? await safeProfile() : null;
    emit();
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
        }
        if (event === 'PASSWORD_RECOVERY') onRecovery?.();
    });

    state.user = await state.backend.auth.getUser();
    state.profile = state.user ? await safeProfile() : null;
    state.ready = true;
    return state;
}
