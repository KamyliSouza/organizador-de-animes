// Exportação e leitura de backups JSON (compatível com o backup do tracker antigo).
import { normalizeEntry, rating5to10 } from './entry.js';

export const LEGACY_STORAGE_KEY = 'media_tracker_data';

/**
 * Notas: a partir da versão 1.11 vão de 0 a 10 (meia estrela = 1 ponto); antes iam de 1 a 5 estrelas.
 *  - Backup NOVO: objeto com `ratingScale: 10`. As notas entram como estão.
 *  - Backup ANTIGO (lista de obras, ou objeto sem `ratingScale`): as notas valem 1 a 5 e são multiplicadas por 2 ao importar.
 *  - Dados locais deste navegador: a chave abaixo marca que o armazenamento local já está na escala nova.
 */
const SCALE_KEY = 'kamylist_rating_scale';
export const RATING_SCALE = 10;

export function localRatingsAreNew() {
    try { return localStorage.getItem(SCALE_KEY) === String(RATING_SCALE); } catch { return false; }
}
export function markLocalRatingsNew() {
    try { localStorage.setItem(SCALE_KEY, String(RATING_SCALE)); } catch { /* ok */ }
}
/** Converte a nota de uma obra salva na escala antiga (1 a 5) para a nova (0 a 10). */
export const withNewRating = (e) => ({ ...e, rating: rating5to10(e?.rating) });

export function buildBackup(entries) {
    return JSON.stringify({ app: 'KamyList', ratingScale: RATING_SCALE, exportedAt: new Date().toISOString(), entries }, null, 2);
}

/** Lê um backup e devolve obras válidas (sem ids: o banco gera novos). Lança Error se inválido. */
export function parseBackup(text) {
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('O arquivo não é um JSON válido.'); }
    const list = Array.isArray(data) ? data : Array.isArray(data?.entries) ? data.entries : null;
    if (!list) throw new Error('Arquivo de backup inválido: esperava uma lista de obras.');
    const newScale = !Array.isArray(data) && Number(data?.ratingScale) === RATING_SCALE;
    const entries = list
        .filter((e) => e && typeof e === 'object' && String(e.title ?? '').trim())
        .map((e) => ({ ...normalizeEntry(newScale ? e : withNewRating(e)), id: '' }));
    if (!entries.length) throw new Error('Nenhuma obra válida encontrada no arquivo.');
    return entries;
}

/** Obras salvas pela versão antiga deste site no localStorage deste navegador. */
export function readLegacyEntries() {
    try {
        const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (!raw) return [];
        const list = JSON.parse(raw);
        if (!Array.isArray(list)) return [];
        const newScale = localRatingsAreNew();
        return list.filter((e) => e && String(e.title ?? '').trim()).map((e) => ({ ...normalizeEntry(newScale ? e : withNewRating(e)), id: '' }));
    } catch {
        return [];
    }
}
