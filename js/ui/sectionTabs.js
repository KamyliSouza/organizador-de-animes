// Abas "Anime" / "Mangá" / "Light Novel" da biblioteca (e do perfil). Cada aba tem a sua própria lista, números e filtros.
// Filme e Série ficam dentro de Anime (com o selo da categoria no card).
// Segue o padrão de abas do teclado: setas esquerda/direita, Home e End trocam de aba.
import { html } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { DEFAULT_SECTION, SECTIONS, SECTION_KEYS, normalizeSection, sectionOf } from '../domain/entry.js';

const KEY = 'kamylist_section';
export const SECTION_ICONS = { anime: 'play', manga: 'book', novel: 'bookmark' };

/** Aba lembrada neste navegador (as versões antigas guardavam "watch"/"read": viram Anime/Mangá). */
export function loadSection() {
    try { return normalizeSection(localStorage.getItem(KEY)); } catch { return DEFAULT_SECTION; }
}
export function saveSection(section) {
    try { localStorage.setItem(KEY, section); } catch { /* ok */ }
}

/** Quantas obras há em cada seção. */
export function sectionCounts(entries) {
    const counts = Object.fromEntries(SECTION_KEYS.map((k) => [k, 0]));
    for (const e of entries) counts[sectionOf(e)] += 1;
    return counts;
}

/** `panelId` é o id do elemento (role="tabpanel") que a aba controla. `keys` = abas mostradas (no perfil de outra pessoa, só as ativas dela). */
export function sectionTabsHtml({ active, counts, panelId, keys = SECTION_KEYS }) {
    return html`<div class="section-tabs" role="tablist" aria-label="Tipo de obra">
        ${keys.map((key) => html`
        <button type="button" role="tab" class="section-tab" id="tab-${key}" data-section="${key}"
            aria-selected="${String(key === active)}" aria-controls="${panelId}" tabindex="${key === active ? 0 : -1}">
            ${icon(SECTION_ICONS[key], { size: 17 })}<span>${SECTIONS[key].label}</span><span class="count" aria-label="${counts[key]} obras">${counts[key]}</span>
        </button>`)}
    </div>`;
}

/**
 * Liga cliques e setas. `onSelect(section)` decide o que mudar; depois de redesenhar as abas,
 * o foco volta para a aba escolhida (quando foi pelo teclado).
 * `keys` = as abas que existem no seletor (as setas só andam entre elas).
 * @returns {() => void} desligar
 */
export function bindSectionTabs(container, onSelect, keys = SECTION_KEYS) {
    const select = (section, { focus = false } = {}) => {
        onSelect(section);
        if (focus) container.querySelector(`[data-section="${section}"]`)?.focus({ preventScroll: true });
    };
    const onClick = (e) => {
        const tab = e.target instanceof Element ? e.target.closest('[data-section]') : null;
        if (tab && container.contains(tab)) select(tab.dataset.section, { focus: true });
    };
    const onKey = (e) => {
        const tab = e.target instanceof Element ? e.target.closest('[data-section]') : null;
        if (!tab || !container.contains(tab)) return;
        const i = keys.indexOf(tab.dataset.section);
        let next = null;
        if (e.key === 'ArrowRight') next = keys[(i + 1) % keys.length];
        else if (e.key === 'ArrowLeft') next = keys[(i - 1 + keys.length) % keys.length];
        else if (e.key === 'Home') next = keys[0];
        else if (e.key === 'End') next = keys[keys.length - 1];
        if (!next) return;
        e.preventDefault();
        select(next, { focus: true });
    };
    container.addEventListener('click', onClick);
    container.addEventListener('keydown', onKey);
    return () => { container.removeEventListener('click', onClick); container.removeEventListener('keydown', onKey); };
}
