// Cópia da conta e da biblioteca neste aparelho, para "ver offline". Só leitura: nada daqui é enviado ao banco.
//  • account: quem estava logada (usuário, perfil, cargo) — para o site abrir com o nome, a foto e as cores certas mesmo sem internet.
//  • library:<id>: a lista de obras da última vez que carregou com internet.
// Sair da conta (ou entrar com outra) apaga tudo: a cópia não fica no aparelho depois do logout.
import { kvDel, kvGet, kvKeys, kvSet } from '../core/offlineStore.js';
import { normalizeEntry } from '../domain/entry.js';

const ACCOUNT = 'account';
const libKey = (uid) => `library:${uid}`;
const isId = (v) => typeof v === 'string' && v.length > 0 && v.length <= 80;

/** Guarda quem está logada. Se mudou de pessoa, apaga a biblioteca guardada da anterior. */
export async function saveAccount({ user, profile, access }) {
    if (!user || !isId(user.id)) return;
    const old = await kvGet(ACCOUNT);
    if (old?.user?.id && old.user.id !== user.id) await kvDel(libKey(old.user.id));
    await kvSet(ACCOUNT, { user: { id: user.id, email: String(user.email || '') }, profile: profile || null, access: access || null, savedAt: Date.now() });
}

export async function loadAccount() {
    const a = await kvGet(ACCOUNT);
    return a && isId(a.user?.id) ? a : null;
}

export async function saveLibrary(uid, entries) {
    if (!isId(uid) || !Array.isArray(entries)) return;
    await kvSet(libKey(uid), { savedAt: Date.now(), entries });
}

/** { entries, savedAt } ou null. As obras passam pela mesma limpeza de sempre (normalizeEntry). */
export async function loadLibrary(uid) {
    if (!isId(uid)) return null;
    const lib = await kvGet(libKey(uid));
    if (!lib || !Array.isArray(lib.entries)) return null;
    return { savedAt: Number(lib.savedAt) || 0, entries: lib.entries.map(normalizeEntry) };
}

/** Logout: some tudo (conta e bibliotecas). */
export async function clearOffline() {
    for (const key of await kvKeys()) await kvDel(key);
}
