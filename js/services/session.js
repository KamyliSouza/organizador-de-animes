// Estado da sessão (quem está logado) e acesso ao backend escolhido.
// Troca de backend em um lugar só: sem chaves do Supabase = modo local.
import { hasSupabase } from '../config.js';
import { clearHighContrast, setHighContrast } from '../core/contrast.js';
import { clearOwnPalette, setOwnPalette } from '../core/palette.js';
import { isNetworkError } from '../core/errors.js';
import { isOffline, markNetworkFailure } from '../core/online.js';
import { clearOwnBackground, setOwnBackground } from '../core/siteBackground.js';
import { NO_ACCESS } from '../domain/access.js';
import * as offlineCache from './offlineCache.js';

const OPEN_SITE = { signupsOpen: true, announcement: '', discordUrl: '' };

// access = cargo em vigor, suspensão (com prazo ou banimento), travas de privacidade e avisos de quem está logado (veja domain/access.js)
// site = configurações públicas (aviso, cadastros e link do Discord)
// fromCache = o site abriu sem internet e a conta (usuário, perfil, cargo) veio da cópia guardada neste aparelho (só leitura)
export const state = { backend: null, user: null, profile: null, requests: 0, ready: false, access: NO_ACCESS, site: OPEN_SITE, fromCache: false };

const listeners = new Set();
// reason: 'local' (mudança feita por esta aba) ou 'external' (outra aba, expiração de sessão...)
const emit = (reason = 'local') => { syncPalette(); listeners.forEach((fn) => { try { fn(state, reason); } catch (e) { console.error(e); } }); };

/**
 * O preset de cores e a imagem de fundo da conta valem no site todo para quem está logado. Sem conta (ou sem login): padrão e sem imagem.
 * No modo local fica só o que está neste navegador (e não há imagem de fundo).
 */
function syncPalette() {
    if (state.backend?.mode !== 'cloud') return;
    if (!state.user) { clearOwnPalette(); clearOwnBackground(); }
    else if (state.profile) { setOwnPalette(state.profile.palette); setOwnBackground(state.profile); }
    syncContrast();
}

/** O alto contraste da conta vale só para quem o ligou: sem login volta ao normal; com login segue o que está salvo na conta. */
function syncContrast() {
    if (state.backend?.mode !== 'cloud') return;
    if (!state.user) clearHighContrast();
    else if (state.profile) setHighContrast(state.profile.highContrast);
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
    try { return await state.backend.profiles.getMine(); } catch (e) {
        if (isNetworkError(e)) markNetworkFailure(); else console.error(e);
        return null;
    }
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
    if (profile) {
        state.profile = profile;
        state.access = access;
        state.fromCache = false;
        offlineCache.saveAccount({ user: state.user, profile, access });       // cópia para abrir sem internet da próxima vez
        return;
    }
    // Sem perfil e sem internet: usa a cópia guardada (nome, foto, cores, cargo) se ela for desta mesma pessoa.
    const saved = isOffline() ? await offlineCache.loadAccount() : null;
    if (saved && saved.user.id === state.user.id && saved.profile) {
        state.profile = saved.profile;
        state.access = saved.access || NO_ACCESS;
        state.fromCache = true;
        return;
    }
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
    state.fromCache = false;
    state.user = await state.backend.auth.getUser();
    await loadAccount();
    emit();
    refreshRequests();
}

/** Carrega o backend e a sessão. `onRecovery` roda quando a pessoa chega por um link de "recuperar senha". */
export async function initSession({ onRecovery } = {}) {
    if (hasSupabase()) {
        const { createSupabaseBackend } = await import('./supabase-backend.js');
        try {
            state.backend = await createSupabaseBackend();
        } catch (err) {
            // Sem internet e a biblioteca do Supabase (CDN) nunca foi baixada: se há cópia da conta, abre só para leitura.
            if (!(isOffline() || isNetworkError(err)) || !(await offlineCache.loadAccount())) throw err;
            const { createOfflineBackend } = await import('./offline-backend.js');
            state.backend = createOfflineBackend();
            markNetworkFailure();
        }
    } else {
        const { createLocalBackend } = await import('./local-backend.js');
        state.backend = createLocalBackend();
    }

    // Registra o ouvinte ANTES de ler a sessão: o evento PASSWORD_RECOVERY sai durante a inicialização.
    state.backend.auth.onChange(async (event, user) => {
        if (event === 'SIGNED_OUT') offlineCache.clearOffline();     // saiu da conta: a cópia da biblioteca não fica no aparelho
        // Aberto sem internet com a conta da cópia: o "sem sessão" que o Supabase avisa por não conseguir renovar o login não é um logout.
        if (state.fromCache && !user && event !== 'SIGNED_OUT') return;
        if (user && state.fromCache && user.id === state.user?.id) {   // internet voltou e o login foi renovado: troca a cópia pelos dados de verdade
            state.fromCache = false;
            await loadAccount();
            emit('external');
            refreshRequests();
            return;
        }
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
    if (!state.user && isOffline()) {       // login vencido e sem internet para renová-lo: segue com a conta da cópia (só leitura)
        const saved = await offlineCache.loadAccount();
        if (saved) { state.user = saved.user; state.fromCache = true; }
    }
    await loadAccount();
    state.site = await sitePromise;
    state.ready = true;
    syncPalette();
    refreshRequests();      // sem esperar: o número aparece no menu assim que chegar
    return state;
}
