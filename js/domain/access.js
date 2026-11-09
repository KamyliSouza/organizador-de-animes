// Situação da conta (Patch 19): suspensão com prazo ou banimento, travas de privacidade e avisos (strikes).
// A regra de verdade mora no banco (sql/schema.sql: my_access, admin_set_suspended, admin_set_account_limits, admin_give_strike).
// Aqui o site só lê a resposta com cuidado (todo texto passa pela mesma limpeza do resto do site) e monta as frases da tela.

import { cleanUnicode } from './textSafety.js';
import { normalizeRole } from './roles.js';

/** No 3º aviso ativo a conta é suspensa sozinha (o banco faz isso; aqui é só para escrever o texto). */
export const STRIKE_LIMIT = 3;
export const AUTO_SUSPEND_DAYS = 7;

/** Prazos que a equipe escolhe ao suspender. `days: null` = sem prazo (a equipe reativa à mão). Banir é uma escolha à parte. */
export const SUSPEND_PRESETS = [
    { key: '1', days: 1, label: '1 dia' },
    { key: '3', days: 3, label: '3 dias' },
    { key: '7', days: 7, label: '7 dias' },
    { key: '30', days: 30, label: '30 dias' },
    { key: 'open', days: null, label: 'Sem prazo (até a equipe reativar)' },
];
export const BAN_KEY = 'ban';

/** Estado de quem não tem conta, não está logado ou está num banco sem a v16. */
export const NO_ACCESS = Object.freeze({
    role: 'member', suspended: false, reason: '', kind: '', endsAt: '',
    forcePrivateProfile: false, forcePrivateNotes: false, forceReason: '', strikes: Object.freeze([]),
});

/** Data válida em ISO, ou '' (qualquer outra coisa). */
export const validDate = (v) => {
    if (!v) return '';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
};

/** Lê a resposta de my_access. Qualquer coisa fora do formato vira "sem restrição". */
export function normalizeAccess(raw) {
    const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const suspended = r.suspended === true;
    const kind = suspended ? (r.suspension_kind === 'ban' ? 'ban' : 'suspension') : '';
    const strikes = (Array.isArray(r.strikes) ? r.strikes : []).slice(0, 20).map((s) => ({
        reason: cleanUnicode(s?.reason, { multiline: true }),
        at: validDate(s?.at),
    })).filter((s) => s.reason).slice(0, STRIKE_LIMIT);
    return {
        role: normalizeRole(r.role),
        suspended,
        reason: cleanUnicode(r.reason, { multiline: true }),
        kind,
        endsAt: kind === 'suspension' ? validDate(r.suspension_ends) : '',
        forcePrivateProfile: r.force_private_profile === true,
        forcePrivateNotes: r.force_private_notes === true,
        forceReason: cleanUnicode(r.force_reason, { multiline: true }),
        strikes,
    };
}

/**
 * Só endereços https sem usuário e senha. Vazio quando não serve.
 * (A equipe grava o link do Discord no painel; mesmo assim a tela confere de novo antes de criar o link.)
 */
export function safeHttpsUrl(value) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text || text.length > 200) return '';
    try {
        const u = new URL(text);
        if (u.protocol !== 'https:' || u.username || u.password || !u.hostname.includes('.')) return '';
        return u.href;
    } catch { return ''; }
}

const pad = (n) => String(n).padStart(2, '0');

/** "12/11/2026 às 14:30", no fuso de quem está vendo. */
export function formatEnd(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "menos de 1 hora", "5 horas", "1 dia", "6 dias". */
export function formatRemaining(ms) {
    const hours = Math.max(0, ms) / 3_600_000;
    if (hours < 1) return 'menos de 1 hora';
    if (hours < 24) { const h = Math.floor(hours); return `${h} ${h === 1 ? 'hora' : 'horas'}`; }
    const days = Math.ceil(hours / 24 - 0.0001);
    return `${days} ${days === 1 ? 'dia' : 'dias'}`;
}

/**
 * O que a tela de suspensão mostra.
 * kind: 'ban' | 'suspension'; term: 'permanent' (banimento) | 'open' (sem prazo) | 'until' (com data) | 'checking' (a data já passou aqui, o banco ainda não liberou).
 */
export function suspensionView(access, now = Date.now()) {
    const ban = access.kind === 'ban';
    const ends = access.endsAt ? new Date(access.endsAt).getTime() : NaN;
    let term = 'open';
    if (ban) term = 'permanent';
    else if (Number.isFinite(ends)) term = ends > now ? 'until' : 'checking';
    const termText = {
        permanent: 'Banimento permanente: a conta não volta ao site.',
        open: 'Sem prazo definido: a conta volta quando a equipe reativar.',
        until: `Até ${formatEnd(access.endsAt)} (faltam ${formatRemaining(ends - now)}). A conta volta sozinha.`,
        checking: 'O prazo acabou. Conferindo com o site…',
    }[term];
    return {
        ban,
        term,
        title: ban ? 'Sua conta foi banida' : 'Sua conta está suspensa',
        lead: ban
            ? 'Esta conta não pode mais ser usada no site. O perfil ficou oculto para as outras pessoas. A sua biblioteca continua sendo sua: você ainda pode baixar um backup.'
            : 'Enquanto a suspensão durar, o seu perfil fica oculto para as outras pessoas e o resto do site fica indisponível para esta conta. A sua biblioteca continua guardada e é sua: você pode baixar um backup.',
        reason: access.reason || '',
        termText,
    };
}

/**
 * Daqui a quantos milissegundos conferir de novo se a suspensão acabou (null = nunca: banimento ou sem prazo).
 * Passou da data mas o banco ainda diz "suspensa" (relógio diferente): tenta de novo a cada 30 s.
 * O limite de 24 dias existe porque setTimeout não aceita atrasos maiores.
 */
export function nextCheckDelay(access, now = Date.now()) {
    if (access.kind !== 'suspension' || !access.endsAt) return null;
    const left = new Date(access.endsAt).getTime() - now;
    if (!Number.isFinite(left)) return null;
    if (left <= 0) return 30_000;
    return Math.min(left + 1500, 2_000_000_000);
}

/** Frase curta da situação de uma conta para a equipe: "Banida", "Suspensa até 12/11/2026 às 14:30" ou "Suspensa sem prazo". */
export function suspensionLabel(kind, endsAt) {
    if (kind === 'ban') return 'Banida';
    return endsAt ? `Suspensa até ${formatEnd(endsAt)}` : 'Suspensa sem prazo';
}

/** Texto de "Aviso 2 de 3" para o banner e para a equipe. */
export const strikeCountText = (n) => `${n} de ${STRIKE_LIMIT}`;
