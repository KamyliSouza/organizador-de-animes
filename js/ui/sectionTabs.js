// Abas "Assistir" / "Ler" da biblioteca (e do perfil). Cada aba tem a sua própria lista, números e filtros.
// Segue o padrão de abas do teclado: setas esquerda/direita, Home e End trocam de aba.
import { html } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { SECTIONS, SECTION_KEYS, sectionOf } from '../domain/entry.js';

const KEY = 'kamylist_section';
const ICONS = { watch: 'play', read: 'book' };

export function loadSection() {
    try {
        const v = localStorage.getItem(KEY);
        return SECTIONS[v] ? v : 'watch';
    } catch { return 'watch'; }
}
export function saveSection(section) {
    try { localStorage.setItem(KEY, section); } catch { /* ok */ }
}

/** Quantas obras há em cada seção. */
export function sectionCounts(entries) {
    const counts = { watch: 0, read: 0 };
    for (const e of entries) counts[sectionOf(e)] += 1;
    return counts;
}

/** `panelId` é o id do elemento (role="tabpanel") que a aba controla. */
export function sectionTabsHtml({ active, counts, panelId }) {
    return html`<div class="section-tabs" role="tablist" aria-label="Seção da biblioteca">
        ${SECTION_KEYS.map((key) => html`
        <button type="button" role="tab" class="section-tab" id="tab-${key}" data-section="${key}"
            aria-selected="${String(key === active)}" aria-controls="${panelId}" tabindex="${key === active ? 0 : -1}">
            ${icon(ICONS[key], { size: 17 })}<span>${SECTIONS[key].label}</span><span class="count" aria-label="${counts[key]} obras">${counts[key]}</span>
        </button>`)}
    </div>`;
}

/**
 * Liga cliques e setas. `onSelect(section)` decide o que mudar; depois de redesenhar as abas,
 * o foco volta para a aba escolhida (quando foi pelo teclado).
 * @returns {() => void} desligar
 */
export function bindSectionTabs(container, onSelect) {
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
        const i = SECTION_KEYS.indexOf(tab.dataset.section);
        let next = null;
        if (e.key === 'ArrowRight') next = SECTION_KEYS[(i + 1) % SECTION_KEYS.length];
        else if (e.key === 'ArrowLeft') next = SECTION_KEYS[(i - 1 + SECTION_KEYS.length) % SECTION_KEYS.length];
        else if (e.key === 'Home') next = SECTION_KEYS[0];
        else if (e.key === 'End') next = SECTION_KEYS[SECTION_KEYS.length - 1];
        if (!next) return;
        e.preventDefault();
        select(next, { focus: true });
    };
    container.addEventListener('click', onClick);
    container.addEventListener('keydown', onKey);
    return () => { container.removeEventListener('click', onClick); container.removeEventListener('keydown', onKey); };
}
