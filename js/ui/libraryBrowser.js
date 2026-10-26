// Lista da biblioteca com filtros (status, categoria, ordem, busca) e modos
// "cards" / "lista". Usada na sua biblioteca e nos perfis públicos.
import { debounce, html, on, setHtml } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { CATEGORIES, STATUSES, filterEntries, sortEntries } from '../domain/entry.js';
import { applyImageFallback, mediaCardHtml, mediaRowHtml } from './mediaCard.js';

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

/**
 * @param {Element} root
 * @param {object} opts
 * @param {Array} opts.entries
 * @param {boolean} [opts.readonly]
 * @param {Record<string,(entry:object, el:Element)=>void>} [opts.actions]  inc, seasons, details, share, edit, delete, add
 */
export function mountLibraryBrowser(root, { entries = [], readonly = false, actions = {} }) {
    const filters = { status: 'all', category: 'all', sort: 'recent', query: '' };
    let view = loadView();
    let all = entries;

    setHtml(root, html`
        <div class="toolbar">
            <div class="segmented scroll" role="group" aria-label="Filtrar por status">
                <button type="button" data-status="all" aria-pressed="true">Todos</button>
                ${Object.entries(STATUSES).map(([k, s]) => html`<button type="button" data-status="${k}" aria-pressed="false">${s.label}</button>`)}
            </div>
            <div class="toolbar-group">
                <select class="select" data-filter="category" aria-label="Filtrar por categoria">
                    <option value="all">Categorias</option>
                    ${CATEGORIES.map((c) => html`<option value="${c}">${c}</option>`)}
                </select>
                <select class="select" data-filter="sort" aria-label="Ordenar">
                    ${SORTS.map(([v, l]) => html`<option value="${v}">${l}</option>`)}
                </select>
                <div class="segmented" role="group" aria-label="Modo de exibição">
                    <button type="button" data-view="cards" aria-label="Cards" title="Cards">${icon('grid', { size: 16 })}</button>
                    <button type="button" data-view="list" aria-label="Lista compacta" title="Lista compacta">${icon('list', { size: 16 })}</button>
                </div>
                <div class="search-field">
                    ${icon('search', { size: 16 })}
                    <input class="input" type="search" data-filter="query" placeholder="Buscar por título ou tag..." aria-label="Buscar obras" autocomplete="off">
                </div>
            </div>
        </div>
        <div data-results aria-live="polite"></div>`);

    const results = root.querySelector('[data-results]');
    const byId = (id) => all.find((e) => e.id === id);

    function syncControls() {
        root.querySelectorAll('[data-status]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.status === filters.status)));
        root.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    }

    function renderResults() {
        const list = sortEntries(filterEntries(all, filters), filters.sort);

        if (!list.length) {
            const empty = all.length === 0;
            setHtml(results, html`
                <div class="empty-state glass-panel">
                    ${icon('film', { size: 44 })}
                    <h3>${empty ? (readonly ? 'Nada por aqui ainda' : 'Sua biblioteca está vazia') : 'Nenhuma obra encontrada'}</h3>
                    <p>${empty ? (readonly ? 'Esta pessoa ainda não adicionou obras.' : 'Adicione seu primeiro anime, série ou filme.') : 'Tente mudar os filtros ou a busca.'}</p>
                    ${empty && !readonly && actions.add ? html`<button type="button" class="button button-primary" data-action="add">${icon('plus', { size: 18 })} Adicionar obra</button>` : ''}
                </div>`);
            return;
        }

        if (view === 'cards') {
            setHtml(results, html`<div class="media-grid">${list.map((e) => mediaCardHtml(e, { readonly }))}</div>`);
        } else {
            setHtml(results, html`<div class="media-list">${list.map((e) => mediaRowHtml(e, { readonly }))}</div>`);
        }
    }

    const offs = [];

    offs.push(on(root, 'click', '[data-status]', (_, b) => { filters.status = b.dataset.status; syncControls(); renderResults(); }));
    offs.push(on(root, 'click', '[data-view]', (_, b) => { view = b.dataset.view; saveView(view); syncControls(); renderResults(); }));
    offs.push(on(root, 'change', 'select[data-filter]', (_, s) => { filters[s.dataset.filter] = s.value; renderResults(); }));

    const search = debounce((value) => { filters.query = value; renderResults(); }, 150);
    offs.push(on(root, 'input', 'input[data-filter="query"]', (_, i) => search(i.value)));

    offs.push(on(results, 'click', '[data-action]', (_, btn) => {
        const action = btn.dataset.action;
        if (action === 'add') { actions.add?.(); return; }
        const id = btn.closest('[data-id]')?.dataset.id;
        const entry = id ? byId(id) : null;
        if (entry) actions[action]?.(entry, btn);
    }));

    // "error" não borbulha: captura na fase de captura.
    offs.push(on(results, 'error', 'img[data-fallback]', (_, img) => applyImageFallback(img), true));

    syncControls();
    renderResults();

    /** Limpa os filtros e rola até a obra, destacando-a por um instante (usado em "ver na biblioteca"). */
    function reveal(id) {
        filters.status = 'all'; filters.category = 'all'; filters.query = '';
        root.querySelectorAll('select[data-filter]').forEach((sel) => { if (sel.dataset.filter === 'category') sel.value = 'all'; });
        const q = root.querySelector('input[data-filter="query"]');
        if (q) q.value = '';
        syncControls();
        renderResults();
        const card = [...results.querySelectorAll('[data-id]')].find((c) => c.dataset.id === String(id));
        if (!card) return;
        card.scrollIntoView({ block: 'center', behavior: 'smooth' });
        card.classList.add('flash');
        setTimeout(() => card.classList.remove('flash'), 2000);
    }

    return {
        reveal,
        setEntries(list) { all = list; renderResults(); },
        destroy() { search.cancel(); offs.forEach((off) => off()); },
    };
}
