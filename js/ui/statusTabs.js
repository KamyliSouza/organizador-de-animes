// Sub-abas de status da biblioteca (e do perfil): Todas · Assistindo · Quero ver · Concluídas · Em espera · Dropadas.
// Cada uma mostra quantas obras há naquele status, na aba atual (Anime, Mangá ou Light Novel), e filtra a lista.
// Substituem os antigos cartões de números do topo: o número continua à vista e o clique continua filtrando.
import { html } from '../core/dom.js';
import { STATUS_KEYS, normalizeSection, statusLabel } from '../domain/entry.js';
import { computeStats } from '../domain/stats.js';

/** 'all' primeiro, depois os status na ordem de sempre. */
export const STATUS_TAB_KEYS = ['all', ...STATUS_KEYS];

const PLURAL = { completed: 'Concluídas', dropped: 'Dropadas' };

/** Nome da sub-aba. Fala de "obras": Todas, Concluídas, Dropadas. Em Mangá e Light Novel, "Lendo" e "Quero ler". */
export function statusTabLabel(status, section) {
    if (status === 'all') return 'Todas';
    return PLURAL[status] || statusLabel(status, normalizeSection(section));
}

/** Quantas obras há em cada status, só na aba `section`. */
export function statusCounts(entries, section) {
    const s = computeStats(entries, normalizeSection(section));
    return { all: s.total, ...Object.fromEntries(STATUS_KEYS.map((k) => [k, s[k]])) };
}

const countLabel = (n) => `${n} ${n === 1 ? 'obra' : 'obras'}`;

/**
 * @param {object} opts
 * @param {'anime'|'manga'|'novel'} opts.section
 * @param {Record<string, number>} opts.counts  resultado de statusCounts()
 * @param {string} opts.active  status filtrado agora ('all' = nenhum)
 * @param {string} opts.panelId  id do elemento (role="tabpanel") que as sub-abas controlam
 */
export function statusTabsHtml({ section, counts, active = 'all', panelId }) {
    return html`<div class="status-tabs" role="tablist" aria-label="Filtrar por status">
        ${STATUS_TAB_KEYS.map((key) => html`<button type="button" role="tab" class="status-tab" id="status-tab-${key}" data-status="${key}"
            aria-selected="${String(key === active)}" aria-controls="${panelId}" tabindex="${key === active ? 0 : -1}">
            ${key === 'all' ? '' : html`<i class="st-dot" aria-hidden="true"></i>`}<span class="status-tab-label">${statusTabLabel(key, section)}</span><span class="count" data-count aria-label="${countLabel(counts[key] ?? 0)}">${counts[key] ?? 0}</span>
        </button>`)}
    </div>`;
}

/** Atualiza só os números (sem redesenhar: o foco do teclado fica onde estava). */
export function updateStatusCounts(container, counts) {
    for (const tab of container.querySelectorAll('[data-status]')) {
        const n = counts[tab.dataset.status] ?? 0;
        const badge = tab.querySelector('[data-count]');
        if (!badge) continue;
        badge.textContent = String(n);
        badge.setAttribute('aria-label', countLabel(n));
    }
}
