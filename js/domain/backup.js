// Exportação e leitura de backups JSON (compatível com o backup do tracker antigo).
import { capFavorites, normalizeEntry } from './entry.js';

export const LEGACY_STORAGE_KEY = 'media_tracker_data';

export function buildBackup(entries) {
    return JSON.stringify(entries, null, 2);
}

/** Lê um backup e devolve obras válidas (sem ids: o banco gera novos). Lança Error se inválido. */
export function parseBackup(text) {
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('O arquivo não é um JSON válido.'); }
    const list = Array.isArray(data) ? data : Array.isArray(data?.entries) ? data.entries : null;
    if (!list) throw new Error('Arquivo de backup inválido: esperava uma lista de obras.');
    const entries = capFavorites(list
        .filter((e) => e && typeof e === 'object' && String(e.title ?? '').trim())
        .map((e) => ({ ...normalizeEntry(e), id: '' })));
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
        return list.filter((e) => e && String(e.title ?? '').trim()).map((e) => ({ ...normalizeEntry(e), id: '' }));
    } catch {
        return [];
    }
}
