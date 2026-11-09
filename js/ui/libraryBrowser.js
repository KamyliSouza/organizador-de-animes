// Lista da biblioteca com sub-abas de status (com contagem), busca, botão "Filtros" (categoria e ordem)
// e os modos "cards" / "lista". Usada na sua biblioteca e nos perfis públicos.
import { debounce, html, on, setHtml } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { DEFAULT_SECTION, SECTIONS, SECTION_KEYS, STATUSES, filterEntries, normalizeSection, sortEntries } from '../domain/entry.js';
import { applyImageFallback, mediaCardHtml, mediaRowHtml } from './mediaCard.js';
import { STATUS_TAB_KEYS, statusCounts, statusTabsHtml, updateStatusCounts } from './statusTabs.js';

const VIEW_KEY = 'kamylist_view_mode';
const LEGACY_VIEW_KEY = 'media_tracker_view_mode';

function loadView() {
    try {
        const v = localStorage.getItem(VIEW_KEY) || localStorage.getItem(LEGACY_VIEW_KEY);
        return v === 'list' ? 'list' : 'cards';
    } catch { return 'cards'; }
}
function saveView(v) { try { localStorage.setItem(VIEW_KEY, v); } catch { /* ok */ } }

const SORTS = [
    ['recent', 'Mais recentes'], ['title', 'Título (A-Z)'], ['rating', 'Melhor nota'], ['progress', 'Maior progresso'],
];
const RESULTS_ID = 'library-results';
const FILTERS_ID = 'filters-panel';

/**
 * @param {Element} root
 * @param {object} opts
 * @param {Array} opts.entries
 * @param {boolean} [opts.readonly]
 * @param {'anime'|'manga'|'novel'} [opts.section]  Aba mostrada (Anime, Mangá ou Light Novel). Troque depois com setSection().
 * @param {Record<string,(entry:object, el:Element)=>void>} [opts.actions]  inc, seasons, progress, details, share, edit, delete, add, status
 *        ("cover" = clique na capa = "details"; "status" recebe o novo valor em el.value)
 * @param {(status:string)=>void} [opts.onStatusChange]  chamado quando o filtro de status muda (sub-abas)
 * @param {(section:string)=>void} [opts.onSectionRequest]  chamado quando a pessoa clica numa aba que também tem a obra buscada
 */
export function mountLibraryBrowser(root, { entries = [], readonly = false, section: initialSection = DEFAULT_SECTION, actions = {}, onStatusChange = null, onSectionRequest = null }) {
    const filters = { status: 'all', category: 'all', sort: 'recent', query: '' };
    let section = normalizeSection(initialSection);
    let view = loadView();
    let all = entries;
    let filtersOpen = false;

    setHtml(root, html`
        <div class="library-controls" data-toolbar>
            <div data-status-tabs></div>
            <div class="toolbar library-bar">
                <div class="search-field">
                    ${icon('search', { size: 16 })}
                    <input class="input" type="search" data-filter="query" placeholder="Buscar por título ou tag..." aria-label="Buscar obras" autocomplete="off">
                </div>
                <button type="button" class="button button-secondary filters-toggle" data-filters-toggle aria-expanded="false" aria-controls="${FILTERS_ID}">
                    ${icon('sliders', { size: 17 })}<span>Filtros</span><span class="filters-badge" data-filters-badge hidden></span>
                </button>
                <div class="segmented" role="group" aria-label="Modo de exibição">
                    <button type="button" data-view="cards" aria-label="Cards" title="Cards">${icon('grid', { size: 16 })}</button>
                    <button type="button" data-view="list" aria-label="Lista compacta" title="Lista compacta">${icon('list', { size: 16 })}</button>
                </div>
            </div>
            <div class="filters-panel glass-panel" id="${FILTERS_ID}" data-filters-panel hidden></div>
        </div>
        <div id="${RESULTS_ID}" data-results role="tabpanel" aria-live="polite"></div>`);

    const tabsEl = root.querySelector('[data-status-tabs]');
    const panel = root.querySelector('[data-filters-panel]');
    const toggle = root.querySelector('[data-filters-toggle]');
    const badge = root.querySelector('[data-filters-badge]');
    const searchInput = root.querySelector('input[data-filter="query"]');
    const results = root.querySelector('[data-results]');
    const byId = (id) => all.find((e) => e.id === id);

    /** As sub-abas dependem da aba (Assistindo/Lendo); a categoria só existe quando a aba tem mais de uma. */
    function renderTabs() {
        setHtml(tabsEl, statusTabsHtml({ section, counts: statusCounts(all, section), active: filters.status, panelId: RESULTS_ID }));
    }
    function renderPanel() {
        const categories = SECTIONS[section].categories;
        setHtml(panel, html`
            <div class="filters-grid">
                ${categories.length > 1 ? html`<div class="field">
                    <label for="filter-category">Categoria</label>
                    <select class="select" id="filter-category" data-filter="category">
                        <option value="all">Todas</option>
                        ${categories.map((c) => html`<option value="${c}">${c}</option>`)}
                    </select>
                </div>` : ''}
                <div class="field">
                    <label for="filter-sort">Ordenar por</label>
                    <select class="select" id="filter-sort" data-filter="sort">
                        ${SORTS.map(([v, l]) => html`<option value="${v}">${l}</option>`)}
                    </select>
                </div>
            </div>
            <div class="filters-actions">
                <button type="button" class="button button-ghost button-sm" data-filters-clear>Limpar filtros</button>
            </div>`);
    }

    /** Quantos ajustes do painel Filtros estão ligados (categoria diferente de "todas" e/ou ordem diferente da padrão). */
    const activeFilters = () => (filters.category !== 'all' ? 1 : 0) + (filters.sort !== 'recent' ? 1 : 0);

    function syncControls() {
        for (const tab of tabsEl.querySelectorAll('[data-status]')) {
            const selected = tab.dataset.status === filters.status;
            tab.setAttribute('aria-selected', String(selected));
            tab.tabIndex = selected ? 0 : -1;
        }
        results.setAttribute('aria-labelledby', `status-tab-${filters.status}`);
        root.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
        panel.querySelectorAll('select[data-filter]').forEach((sel) => { sel.value = filters[sel.dataset.filter]; });

        const n = activeFilters();
        badge.hidden = n === 0;
        badge.textContent = n ? String(n) : '';
        if (n) toggle.setAttribute('aria-label', `Filtros (${n} ${n === 1 ? 'ativo' : 'ativos'})`);
        else toggle.removeAttribute('aria-label');
        const clear = panel.querySelector('[data-filters-clear]');
        if (clear) clear.disabled = n === 0;
        toggle.setAttribute('aria-expanded', String(filtersOpen));
        panel.hidden = !filtersOpen;
    }

    const FIRST_WORK = { anime: 'Adicione seu primeiro anime, série ou filme.', manga: 'Adicione seu primeiro mangá.', novel: 'Adicione sua primeira light novel.' };
    const EMPTY_TITLE = { anime: 'Nenhum anime por aqui ainda', manga: 'Nenhum mangá por aqui ainda', novel: 'Nenhuma light novel por aqui ainda' };

    /** Busca digitada: avisa se o mesmo nome aparece nas outras abas (obras de tipos diferentes podem ter o mesmo título). */
    function otherTypesHtml() {
        const q = filters.query.trim();
        if (!q) return '';
        const found = SECTION_KEYS.filter((k) => k !== section)
            .map((k) => ({ key: k, count: filterEntries(all, { query: q, section: k }).length }))
            .filter((x) => x.count > 0);
        if (!found.length) return '';
        return html`<div class="notice-box" data-other-types>${icon('search')}<div class="grow">
            <span>Também há resultados para essa busca em:</span>
            <div class="notice-actions">${found.map((x) => html`<button type="button" class="button button-secondary button-sm" data-goto-section="${x.key}">${SECTIONS[x.key].label} (${x.count})</button>`)}</div>
        </div></div>`;
    }

    function renderResults() {
        const inSection = filterEntries(all, { section });
        const list = sortEntries(filterEntries(all, { ...filters, section }), filters.sort);
        const others = otherTypesHtml();

        if (!list.length) {
            const empty = inSection.length === 0;
            const narrowed = filters.status !== 'all' || filters.category !== 'all' || filters.query.trim() !== '';
            setHtml(results, html`
                <div class="empty-state glass-panel">
                    ${icon('film', { size: 44 })}
                    <h3>${empty ? (readonly ? 'Nada por aqui ainda' : (all.length === 0 ? 'Sua biblioteca está vazia' : EMPTY_TITLE[section])) : 'Nenhuma obra encontrada'}</h3>
                    <p>${empty ? (readonly ? 'Esta pessoa ainda não adicionou obras aqui.' : FIRST_WORK[section]) : 'Tente mudar os filtros ou a busca.'}</p>
                    ${empty && !readonly && actions.add ? html`<button type="button" class="button button-primary" data-action="add">${icon('plus', { size: 18 })} Adicionar obra</button>` : ''}
                    ${!empty && narrowed ? html`<button type="button" class="button button-secondary" data-clear-all>Limpar filtros e busca</button>` : ''}
                </div>${others}`);
            return;
        }

        if (view === 'cards') {
            setHtml(results, html`<div class="media-grid">${list.map((e) => mediaCardHtml(e, { readonly }))}</div>${others}`);
        } else {
            setHtml(results, html`<div class="media-list">${list.map((e) => mediaRowHtml(e, { readonly }))}</div>${others}`);
        }
    }

    const offs = [];

    function setStatus(status) {
        filters.status = status === 'all' || STATUSES[status] ? status : 'all';
        syncControls();
        renderResults();
        onStatusChange?.(filters.status);
    }

    // Sub-abas: clique e teclado (setas, Home e End), como nas abas Anime / Mangá / Light Novel.
    offs.push(on(tabsEl, 'click', '[data-status]', (_, b) => setStatus(b.dataset.status)));
    const onTabKey = (e) => {
        const tab = e.target instanceof Element ? e.target.closest('[data-status]') : null;
        if (!tab || !tabsEl.contains(tab)) return;
        const keys = STATUS_TAB_KEYS;
        const i = keys.indexOf(tab.dataset.status);
        let next = null;
        if (e.key === 'ArrowRight') next = keys[(i + 1) % keys.length];
        else if (e.key === 'ArrowLeft') next = keys[(i - 1 + keys.length) % keys.length];
        else if (e.key === 'Home') next = keys[0];
        else if (e.key === 'End') next = keys[keys.length - 1];
        if (!next) return;
        e.preventDefault();
        setStatus(next);
        tabsEl.querySelector(`[data-status="${next}"]`)?.focus({ preventScroll: true });
    };
    tabsEl.addEventListener('keydown', onTabKey);
    offs.push(() => tabsEl.removeEventListener('keydown', onTabKey));

    // Botão Filtros: abre e fecha o painel (categoria e ordem).
    offs.push(on(root, 'click', '[data-filters-toggle]', () => { filtersOpen = !filtersOpen; syncControls(); }));
    offs.push(on(panel, 'click', '[data-filters-clear]', () => {
        filters.category = 'all'; filters.sort = 'recent';
        syncControls();
        renderResults();
    }));
    offs.push(on(panel, 'change', 'select[data-filter]', (_, s) => { filters[s.dataset.filter] = s.value; syncControls(); renderResults(); }));

    offs.push(on(results, 'click', '[data-goto-section]', (_, b) => onSectionRequest?.(b.dataset.gotoSection)));
    offs.push(on(results, 'click', '[data-clear-all]', () => clearAll()));
    offs.push(on(root, 'click', '[data-view]', (_, b) => { view = b.dataset.view; saveView(view); syncControls(); renderResults(); }));

    const search = debounce((value) => { filters.query = value; renderResults(); }, 150);
    offs.push(on(root, 'input', 'input[data-filter="query"]', (_, i) => search(i.value)));

    offs.push(on(results, 'click', '[data-action]', (_, btn) => {
        let action = btn.dataset.action;
        if (action === 'add') { actions.add?.(); return; }
        if (action === 'cover') action = 'details';          // clicar na capa abre os detalhes
        const id = btn.closest('[data-id]')?.dataset.id;
        const entry = id ? byId(id) : null;
        if (entry) actions[action]?.(entry, btn);
    }));

    // Seletores dentro dos cards (status). Depois de redesenhar a lista, o foco volta para o mesmo seletor.
    offs.push(on(results, 'change', 'select[data-change]', (_, sel) => {
        const id = sel.closest('[data-id]')?.dataset.id;
        const entry = id ? byId(id) : null;
        const handler = actions[sel.dataset.change];
        if (!entry || !handler) return;
        handler(entry, sel);
        const again = [...results.querySelectorAll('[data-id]')].find((c) => c.dataset.id === id)?.querySelector(`select[data-change="${sel.dataset.change}"]`);
        again?.focus({ preventScroll: true });
    }));

    // "error" não borbulha: captura na fase de captura.
    offs.push(on(results, 'error', 'img[data-fallback]', (_, img) => applyImageFallback(img), true));

    renderTabs();
    renderPanel();
    syncControls();
    renderResults();

    /** Tira status, categoria e busca (a ordem e o modo ficam): usado por "ver na biblioteca" e pelo botão da lista vazia. */
    function clearAll() {
        filters.status = 'all'; filters.category = 'all'; filters.query = '';
        searchInput.value = '';
        syncControls();
        renderResults();
        onStatusChange?.('all');
    }

    /** Troca a aba (Anime/Mangá/Light Novel): status e categoria voltam para "todos"; ordem, modo e busca ficam. */
    function setSection(next) {
        if (!SECTIONS[next] || next === section) return;
        section = next;
        filters.status = 'all'; filters.category = 'all';
        renderTabs();
        renderPanel();
        syncControls();
        renderResults();
        onStatusChange?.('all');
    }

    /** Limpa os filtros e rola até a obra, destacando-a por um instante (usado em "ver na biblioteca"). */
    function reveal(id) {
        clearAll();
        const card = [...results.querySelectorAll('[data-id]')].find((c) => c.dataset.id === String(id));
        if (!card) return;
        card.scrollIntoView({ block: 'center', behavior: 'smooth' });
        card.classList.add('flash');
        setTimeout(() => card.classList.remove('flash'), 2000);
    }

    return {
        reveal,
        getStatus: () => filters.status,
        setStatus,
        setSection,
        getSection: () => section,
        setEntries(list) {
            all = list;
            updateStatusCounts(tabsEl, statusCounts(all, section));
            renderResults();
        },
        destroy() { search.cancel(); offs.forEach((off) => off()); },
    };
}
