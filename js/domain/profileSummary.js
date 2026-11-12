// Contas do perfil público, sem tela: os números do cabeçalho, o quadro "Assistindo agora" e o que entra em cada aba
// (Biblioteca, Favoritos e Análises) de Anime, Mangá ou Light Novel. A parte visual fica em js/ui/profilePanes.js.
import { SECTIONS, isReading, normalizeSection, progressOf, readSummary, sectionOf, sortEntries, statusLabel } from './entry.js';

/** As abas do perfil (o que mostrar). A "Biblioteca" é a lista de sempre; as outras duas são recortes dela. */
export const PANES = [
    { id: 'library', label: 'Biblioteca', icon: 'grid', one: 'obra', many: 'obras' },
    { id: 'favorites', label: 'Favoritos', icon: 'heart', one: 'favorito', many: 'favoritos' },
    { id: 'reviews', label: 'Análises', icon: 'book', one: 'análise', many: 'análises' },
];
export const PANE_KEYS = PANES.map((p) => p.id);
export const DEFAULT_PANE = 'library';
export const normalizePane = (v) => (PANE_KEYS.includes(v) ? v : DEFAULT_PANE);

/** Quantas obras aparecem no quadro "Assistindo agora" (as demais ficam atrás do botão "Ver todos"). */
export const NOW_LIMIT = 3;

const inSection = (entries, section) => entries.filter((e) => sectionOf(e) === normalizeSection(section));
const hasReview = (e) => String(e?.review ?? '').trim() !== '';

/** Números do cabeçalho: todas as obras do perfil (das abas ativas) e quantas estão em andamento ("Assistindo" ou "Lendo"). */
export function profileCounters(entries) {
    return { works: entries.length, inProgress: entries.filter((e) => e.status === 'watching').length };
}

/**
 * Nome do contador de obras em andamento: perfil só de Anime = "assistindo"; só de Mangá e/ou Light Novel = "lendo";
 * com os dois tipos de aba = "em andamento" (a conta junta as duas coisas).
 */
export function inProgressLabel(keys) {
    const list = keys.filter((k) => SECTIONS[k]);
    const reading = list.filter((k) => SECTIONS[k].reading).length;
    if (reading === 0) return 'assistindo';
    return reading === list.length ? 'lendo' : 'em andamento';
}

/** As obras que a pessoa está acompanhando agora na aba, as mais recentes primeiro. */
export const nowWatching = (entries, section) => sortEntries(inSection(entries, section).filter((e) => e.status === 'watching'), 'recent');
export const favoritesOf = (entries, section) => inSection(entries, section).filter((e) => e.favorite);
export const reviewsOf = (entries, section) => sortEntries(inSection(entries, section).filter(hasReview), 'recent');

/** O número que aparece em cada aba do perfil, para a aba (Anime/Mangá/Light Novel) escolhida. */
export function paneCounts(entries, section) {
    const list = inSection(entries, section);
    return { library: list.length, favorites: list.filter((e) => e.favorite).length, reviews: list.filter(hasReview).length };
}

/** "Assistindo agora" (Anime) ou "Lendo agora" (Mangá e Light Novel). */
export const nowTitle = (section) => `${statusLabel('watching', section)} agora`;

/** Uma linha de progresso para o quadro: "Ep. 5 de 24", "Cap. 120 / 450 · Vol. 14" ou "Filme". */
export function nowProgress(entry) {
    if (isReading(entry)) return readSummary(entry);
    if (entry.category === 'Filme') return 'Filme';
    const { watched, total } = progressOf(entry);
    return total > 0 ? `Ep. ${watched} de ${total}` : `Ep. ${watched}`;
}
