// Snapshot de denúncia e remoção de conteúdo campo a campo (Patch 18).
// O banco guarda, junto com cada denúncia, uma cópia do que a pessoa denunciada mostrava NA HORA da denúncia
// (sql/schema.sql: report_snapshot). Aqui o painel da equipe lê essa cópia com cuidado (o texto passa pela mesma limpeza
// do resto do site) e compara com o perfil de hoje para avisar o que mudou depois. Nada aqui chama o banco.

import { cleanUnicode } from './textSafety.js';

/** Texto que entra no lugar do conteúdo removido (o banco usa o mesmo texto: admin_wipe_text). */
export const REMOVED_MARK = '[Conteúdo removido pela moderação]';

/**
 * Campos que a equipe pode remover. `scope`: 'profile' (nome e bio) ou 'entry' (textos das obras).
 * `effect` diz o que acontece com o campo; progresso, nota (0 a 10), status, favoritos, temporadas e capa nunca mudam.
 */
export const WIPE_FIELDS = [
    { key: 'display_name', scope: 'profile', label: 'Nome de exibição', short: 'nome', effect: 'vira o aviso de conteúdo removido' },
    { key: 'bio', scope: 'profile', label: 'Descrição (bio)', short: 'bio', effect: 'vira o aviso de conteúdo removido' },
    { key: 'title', scope: 'entry', label: 'Títulos digitados à mão', short: 'título', effect: 'viram o aviso; títulos que vieram da busca não mudam' },
    { key: 'review', scope: 'entry', label: 'Análises', short: 'análise', effect: 'viram o aviso (e não aparecem como novidade no feed)' },
    { key: 'notes', scope: 'entry', label: 'Anotações', short: 'anotações', effect: 'viram o aviso' },
    { key: 'tags', scope: 'entry', label: 'Tags', short: 'tags', effect: 'ficam vazias' },
];
export const wipeField = (key) => WIPE_FIELDS.find((f) => f.key === key) || null;

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ENTRIES = 10;
const MAX_TAGS = 10;

const version = (v) => { const n = Number(v); return Number.isSafeInteger(n) && n > 0 ? n : 0; };

/**
 * Lê o snapshot que veio do banco. Devolve null para denúncias antigas (de antes do Patch 18, o campo vem vazio)
 * ou para qualquer coisa que não tenha o formato esperado.
 */
export function normalizeSnapshot(raw) {
    const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null;
    if (!o || typeof o.username !== 'string') return null;
    const line = (v) => cleanUnicode(v);
    const block = (v) => cleanUnicode(v, { multiline: true });
    const entries = (Array.isArray(o.entries) ? o.entries : []).slice(0, MAX_ENTRIES).map((e) => ({
        id: typeof e?.id === 'string' && UUID_RX.test(e.id) ? e.id.toLowerCase() : '',
        title: line(e?.title),
        category: line(e?.category),
        manual: e?.manual === true,
        review: block(e?.review),
        notes: block(e?.notes),
        tags: (Array.isArray(e?.tags) ? e.tags : []).slice(0, MAX_TAGS).map(line).filter(Boolean),
    })).filter((e) => e.id);
    return {
        username: line(o.username),
        displayName: line(o.display_name),
        bio: block(o.bio),
        avatarV: version(o.avatar_v),
        bgV: version(o.bg_v),
        isPublic: o.is_public === true,
        entriesVisible: o.entries_visible === true,
        entries,
    };
}

/**
 * Como a foto (ou o fundo) está hoje em relação ao snapshot, comparando as versões (avatar_v / bg_v):
 * 'none' sem imagem nos dois momentos · 'same' continua a mesma · 'gone' foi removida · 'changed' foi trocada · 'added' não havia e agora há.
 * O arquivo antigo não é guardado: só 'same' ainda mostra a imagem que foi denunciada.
 */
export function mediaState(snapshotV, currentV) {
    const a = version(snapshotV);
    const b = version(currentV);
    if (a === 0) return b === 0 ? 'none' : 'added';
    if (b === 0) return 'gone';
    return a === b ? 'same' : 'changed';
}

/** O que, no snapshot, ainda pode ser removido de uma obra: lista de chaves de WIPE_FIELDS. */
export function removableFields(entry) {
    const out = [];
    if (entry.manual && entry.title && entry.title !== REMOVED_MARK) out.push('title');
    if (entry.review && entry.review !== REMOVED_MARK) out.push('review');
    if (entry.notes && entry.notes !== REMOVED_MARK) out.push('notes');
    if (entry.tags.length) out.push('tags');
    return out;
}
