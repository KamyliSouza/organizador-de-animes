// Lista da biblioteca com filtros (status, categoria, ordem, busca) e modos
// "cards" / "lista". Usada na sua biblioteca e nos perfis públicos.
import { debounce, html, on, setHtml } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { DEFAULT_SECTION, SECTIONS, SECTION_KEYS, STATUSES, filterEntries, normalizeSection, sortEntries, statusesOf } from '../domain/entry.js';
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
 * @param {'anime'|'manga'|'novel'} [opts.section]  Aba mostrada (Anime, Mangá ou Light Novel). Troque depois com setSection().
 * @param {Record<string,(entry:object, el:Element)=>void>} [opts.actions]  inc, seasons, progress, details, share, edit, delete, add, status
 *        ("cover" = clique na capa = "details"; "status" recebe o novo valor em el.value)
 * @param {(status:string)=>void} [opts.onStatusChange]  chamado quando o filtro de status muda (botões ou cards de números)
 * @param {(section:string)=>void} [opts.onSectionRequest]  chamado quando a pessoa clica numa aba que também tem a obra buscada
 */
export function mountLibraryBrowser(root, { entries = [], readonly = false, section: initialSection = DEFAULT_SECTION, actions = {}, onStatusChange = null, onSectionRequest = null }) {
    const filters = { status: 'all', category: 'all', sort: 'recent', query: '' };
    let section = normalizeSection(initialSection);
    let view = loadView();
    let all = entries;

    setHtml(root, html`
        <div class="toolbar" data-toolbar></div>
        <div data-results aria-live="polite"></div>`);

    const toolbar = root.querySelector('[data-toolbar]');

    /** Botões de status e categorias dependem da aba; o resto (ordem, modo, busca) continua como estava. */
    function renderToolbar() {
        const categories = SECTIONS[section].categories;
        setHtml(toolbar, html`
            <div class="segmented scroll" role="group" aria-label="Filtrar por status">
                <button type="button" data-status="all" aria-pressed="true">Todos</button>
                ${statusesOf(section).map(([k, st]) => html`<button type="button" data-status="${k}" aria-pressed="false">${st.label}</button>`)}
            </div>
            <div class="toolbar-group">
                ${categories.length > 1 ? html`<select class="select" data-filter="category" aria-label="Filtrar por categoria">
                    <option value="all">Categorias</option>
                    ${categories.map((c) => html`<option value="${c}">${c}</option>`)}
                </select>` : ''}
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
            </div>`);
        toolbar.querySelector('select[data-filter="sort"]').value = filters.sort;
        const cat = toolbar.querySelector('select[data-filter="category"]');
        if (cat) cat.value = filters.category;
        toolbar.querySelector('input[data-filter="query"]').value = filters.query;
    }

    const results = root.querySelector('[data-results]');
    const byId = (id) => all.find((e) => e.id === id);

    function syncControls() {
        root.querySelectorAll('[data-status]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.status === filters.status)));
        root.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
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
            setHtml(results, html`
                <div class="empty-state glass-panel">
                    ${icon('film', { size: 44 })}
                    <h3>${empty ? (readonly ? 'Nada por aqui ainda' : (all.length === 0 ? 'Sua biblioteca está vazia' : EMPTY_TITLE[section])) : 'Nenhuma obra encontrada'}</h3>
                    <p>${empty ? (readonly ? 'Esta pessoa ainda não adicionou obras aqui.' : FIRST_WORK[section]) : 'Tente mudar os filtros ou a busca.'}</p>
                    ${empty && !readonly && actions.add ? html`<button type="button" class="button button-primary" data-action="add">${icon('plus', { size: 18 })} Adicionar obra</button>` : ''}
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

    offs.push(on(root, 'click', '[data-status]', (_, b) => setStatus(b.dataset.status)));
    offs.push(on(results, 'click', '[data-goto-section]', (_, b) => onSectionRequest?.(b.dataset.gotoSection)));
    offs.push(on(root, 'click', '[data-view]', (_, b) => { view = b.dataset.view; saveView(view); syncControls(); renderResults(); }));
    offs.push(on(root, 'change', 'select[data-filter]', (_, s) => { filters[s.dataset.filter] = s.value; renderResults(); }));

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

    renderToolbar();
    syncControls();
    renderResults();

    /** Troca a aba (Anime/Mangá/Light Novel): status e categoria voltam para "todos"; ordem, modo e busca ficam. */
    function setSection(next) {
        if (!SECTIONS[next] || next === section) return;
        section = next;
        filters.status = 'all'; filters.category = 'all';
        renderToolbar();
        syncControls();
        renderResults();
        onStatusChange?.('all');
    }

    /** Limpa os filtros e rola até a obra, destacando-a por um instante (usado em "ver na biblioteca"). */
    function reveal(id) {
        filters.status = 'all'; filters.category = 'all'; filters.query = '';
        onStatusChange?.('all');
        root.querySelectorAll('select[data-filter="category"]').forEach((sel) => { sel.value = 'all'; });
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

    /** Rola suavemente até a lista filtrada (usado pelos cards de números do topo). Sem animação se a pessoa pediu menos movimento. */
    function scrollToList() {
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        root.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    }

    return {
        reveal,
        scrollToList,
        getStatus: () => filters.status,
        setStatus,
        setSection,
        getSection: () => section,
        setEntries(list) { all = list; renderResults(); },
        destroy() { search.cancel(); offs.forEach((off) => off()); },
    };
}
