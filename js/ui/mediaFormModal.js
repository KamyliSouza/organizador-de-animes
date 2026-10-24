// Modal "Adicionar / Editar obra": busca em MAL/AniList/TMDB, temporadas, tags, notas...
import { el, html, on, safeUrl, setHtml, toInt } from '../core/dom.js';
import { icon, spinner } from '../core/icons.js';
import { openModal } from '../core/modal.js';
import { messageOf } from '../core/errors.js';
import { toast } from '../core/toast.js';
import { CATEGORIES, DAYS, DAY_LABELS, MAX_EPISODES, SEASON_TYPES, STATUSES, cloneEntry, emptyEntry, normalizeSeason } from '../domain/entry.js';
import { SOURCES, searchSeasons, searchWorks, sourceAvailable } from '../services/search/index.js';

const SOURCE_KEY = 'kamylist_last_source';
const LEGACY_SOURCE_KEY = 'media_tracker_last_source';

function loadSource() {
    try {
        const s = localStorage.getItem(SOURCE_KEY) || localStorage.getItem(LEGACY_SOURCE_KEY);
        return SOURCES.some((x) => x.id === s) && sourceAvailable(s) ? s : 'mal';
    } catch { return 'mal'; }
}
const saveSource = (s) => { try { localStorage.setItem(SOURCE_KEY, s); } catch { /* ok */ } };

/** Mantém o progresso já marcado quando os metadados são trocados (casando pelo nome da temporada). */
function mergeSeasons(oldSeasons, nextSeasons) {
    return nextSeasons.map((s, i) => {
        const next = normalizeSeason(s, i);
        const old = oldSeasons.find((o) => o.name === next.name);
        if (old) next.watched = old.watched.filter((n) => n <= next.totalEps);
        return next;
    });
}

/**
 * @param {object} opts
 * @param {object|null} opts.entry   Obra a editar (null = nova).
 * @param {(entry:object)=>Promise<void>} opts.onSave
 */
export function openMediaForm({ entry = null, onSave }) {
    const isEdit = Boolean(entry?.id);
    const draft = cloneEntry(entry || emptyEntry());
    let source = loadSource();
    let found = [];   // resultados da última busca

    const content = el(html`
    <form class="stack" novalidate>
        <div class="subpanel">
            <div class="row-between">
                <label class="field-label" for="mf-source">Fonte de busca</label>
                <select id="mf-source" class="select select-sm" style="width:auto">
                    ${SOURCES.map((s) => html`<option value="${s.id}" ${sourceAvailable(s.id) ? '' : 'disabled'}>${s.label}${sourceAvailable(s.id) ? '' : ' (configure a chave)'}</option>`)}
                </select>
            </div>
        </div>

        <div class="field">
            <label for="mf-title">Título da obra</label>
            <div class="row" style="flex-wrap:nowrap">
                <input id="mf-title" class="input" required maxlength="200" autocomplete="off" placeholder="Ex: Diários de uma Apotecária...">
                <button type="button" class="button button-secondary" data-act="search" style="flex:0 0 auto">${icon('search', { size: 16 })} Buscar</button>
            </div>
        </div>

        ${isEdit ? html`<button type="button" class="button button-secondary button-block" data-act="refresh-meta">${icon('refresh', { size: 16 })} Atualizar card com dados mais recentes</button>` : ''}

        <div class="result-list" data-results hidden></div>
        <div class="notice-box" data-loaded hidden>${icon('checkCircle')}<span data-loaded-text></span></div>

        <div class="subpanel">
            <span class="field-label" style="color:var(--primary-text)">Temporadas, OVAs e filmes</span>
            <div class="row" style="flex-wrap:nowrap">
                <input id="mf-season-name" class="input" maxlength="80" autocomplete="off" placeholder="Nome da temporada/OVA..." aria-label="Nome da temporada ou OVA a adicionar">
                <button type="button" class="button button-secondary button-sm" data-act="search-season" style="flex:0 0 auto">${icon('search', { size: 15 })} Buscar</button>
                <button type="button" class="button button-ghost button-sm" data-act="add-season" style="flex:0 0 auto">${icon('plus', { size: 15 })} Manual</button>
            </div>
            <div class="result-list" data-season-results hidden></div>
            <div class="stack" style="gap:6px" data-seasons></div>
        </div>

        <div class="form-grid">
            <div class="field">
                <label for="mf-tags">Tags (separadas por vírgula)</label>
                <input id="mf-tags" class="input" autocomplete="off" placeholder="Ex: Live, Maratona, Favoritos">
            </div>
            <div class="field">
                <label for="mf-air">Dia de lançamento</label>
                <select id="mf-air" class="select">
                    <option value="">Nenhum / Finalizado</option>
                    ${DAYS.map((d) => html`<option value="${d}">${DAY_LABELS[d]}</option>`)}
                </select>
            </div>
        </div>

        <div class="field">
            <label for="mf-notes">Anotações / Diário</label>
            <textarea id="mf-notes" class="textarea" rows="2" maxlength="5000" placeholder="Anote lembretes, teorias ou impressões..."></textarea>
        </div>

        <div class="form-grid">
            <div class="field">
                <label for="mf-category">Categoria</label>
                <select id="mf-category" class="select">${CATEGORIES.map((c) => html`<option value="${c}">${c}</option>`)}</select>
            </div>
            <div class="field">
                <label for="mf-status">Status</label>
                <select id="mf-status" class="select">${Object.entries(STATUSES).map(([k, s]) => html`<option value="${k}">${s.label}</option>`)}</select>
            </div>
            <div class="field span-2">
                <label for="mf-rating">Avaliação</label>
                <select id="mf-rating" class="select">
                    <option value="0">Sem nota</option>
                    ${[1, 2, 3, 4, 5].map((n) => html`<option value="${n}">${'★'.repeat(n)} ${n} ${n === 1 ? 'estrela' : 'estrelas'}</option>`)}
                </select>
            </div>
        </div>

        <div class="modal-footer">
            <button type="button" class="button button-ghost" data-modal-close>Cancelar</button>
            <button type="submit" class="button button-primary" data-submit>Salvar obra</button>
        </div>
    </form>`, 'div');

    const form = content.querySelector('form');
    const $ = (sel) => content.querySelector(sel);
    const fields = {
        source: $('#mf-source'), title: $('#mf-title'), tags: $('#mf-tags'), air: $('#mf-air'),
        notes: $('#mf-notes'), category: $('#mf-category'), status: $('#mf-status'), rating: $('#mf-rating'),
        seasonName: $('#mf-season-name'),
    };
    const boxes = { results: $('[data-results]'), seasonResults: $('[data-season-results]'), loaded: $('[data-loaded]'), seasons: $('[data-seasons]') };

    // Preenche com os dados atuais
    fields.source.value = source;
    fields.title.value = draft.title;
    fields.tags.value = draft.tags.join(', ');
    fields.air.value = draft.airDay;
    fields.notes.value = draft.notes;
    fields.category.value = draft.category;
    fields.status.value = draft.status;
    fields.rating.value = String(draft.rating);

    const modal = openModal({ title: isEdit ? 'Editar / atualizar obra' : 'Adicionar obra', iconName: isEdit ? 'edit' : 'plus', content });

    // --- helpers de interface ------------------------------------------------

    const setBusy = (btn, busy, idleHtml) => {
        btn.disabled = busy;
        if (busy) { btn.dataset.idle = btn.innerHTML; setHtml(btn, spinner(16)); }
        else btn.innerHTML = idleHtml ?? btn.dataset.idle ?? btn.innerHTML;
    };

    const showResultsMessage = (box, message) => {
        setHtml(box, html`<p class="muted small" style="padding:8px 10px">${message}</p>`);
        box.hidden = false;
    };

    function renderSeasons() {
        if (!draft.seasons.length) {
            setHtml(boxes.seasons, html`<span class="muted small" style="font-style:italic">Nenhuma temporada cadastrada (será criada a 1ª Temporada).</span>`);
            return;
        }
        setHtml(boxes.seasons, html`${draft.seasons.map((s, i) => html`
            <div class="season-edit-row" data-idx="${i}">
                <input class="input input-sm" data-field="name" value="${s.name}" maxlength="80" aria-label="Nome da temporada ${i + 1}">
                <select class="select select-sm" data-field="type" aria-label="Tipo da temporada ${i + 1}">
                    ${SEASON_TYPES.map((t) => html`<option value="${t}" ${t === s.type ? 'selected' : ''}>${t}</option>`)}
                </select>
                <input class="input input-sm" data-field="totalEps" type="number" min="1" max="${MAX_EPISODES}" value="${s.totalEps}" aria-label="Total de episódios da temporada ${i + 1}">
                <button type="button" class="icon-button sm danger" data-act="remove-season" aria-label="Remover temporada ${i + 1}">${icon('x', { size: 15 })}</button>
            </div>`)}`);
    }

    function showLoaded(text) {
        content.querySelector('[data-loaded-text]').textContent = text;
        boxes.loaded.hidden = false;
    }

    function applyResult(r) {
        fields.title.value = r.title || fields.title.value;
        fields.category.value = r.category || fields.category.value;
        if (r.rating > 0) fields.rating.value = String(r.rating);
        if (r.tags?.length) fields.tags.value = r.tags.join(', ');
        if (r.airDay) fields.air.value = r.airDay;
        draft.coverImage = safeUrl(r.coverImage);
        draft.description = r.description || '';
        draft.genres = r.genres || [];
        const seasons = (r.seasons || []).map(normalizeSeason);
        draft.seasons = isEdit ? mergeSeasons(draft.seasons, seasons) : seasons;
        renderSeasons();
        showLoaded(`Obra carregada com ${draft.seasons.length} temporada(s)!`);
        boxes.results.hidden = true;
    }

    const markSourceDown = (id) => {
        const opt = fields.source.querySelector(`option[value="${id}"]`);
        if (opt && !opt.text.includes('(fora do ar)')) opt.text += ' (fora do ar)';
    };

    // --- ações ------------------------------------------------------------------

    on(content, 'change', '#mf-source', (_, s) => { source = s.value; saveSource(source); });

    async function runSearch(btn) {
        const query = fields.title.value.trim();
        if (!query) { toast('Digite um título para buscar.', { type: 'error' }); fields.title.focus(); return; }
        if (!navigator.onLine) { showResultsMessage(boxes.results, 'Sem conexão com a internet.'); return; }
        boxes.loaded.hidden = true;
        setBusy(btn, true);
        try {
            found = await searchWorks(source, query, { limit: 5 });
            if (!found.length) { showResultsMessage(boxes.results, 'Nenhum resultado encontrado. Tente outro título ou outra fonte.'); return; }
            setHtml(boxes.results, html`${found.map((r, i) => html`
                <button type="button" class="result-item" data-pick="${i}">
                    <span class="truncate">${r.title}${r.category !== 'Anime' ? ` (${r.category})` : ''}</span>
                    <span class="count">${r.category === 'Filme' ? 'Filme' : `${r.seasons.length} Temp.`}</span>
                </button>`)}`);
            boxes.results.hidden = false;
        } catch (err) {
            console.error(err);
            markSourceDown(source);
            showResultsMessage(boxes.results, 'Serviço indisponível no momento. Selecione outra fonte.');
        } finally {
            setBusy(btn, false);
        }
    }

    async function refreshMeta(btn) {
        const query = fields.title.value.trim();
        if (!query) { toast('Digite um título para atualizar.', { type: 'error' }); return; }
        setBusy(btn, true);
        try {
            const [r] = await searchWorks(source, query, { limit: 1 });
            if (!r) { toast('Nenhum resultado encontrado para atualizar.', { type: 'error' }); return; }
            draft.coverImage = safeUrl(r.coverImage) || draft.coverImage;
            draft.description = r.description || draft.description;
            if (r.genres?.length) draft.genres = r.genres;
            if (r.airDay) fields.air.value = r.airDay;
            toast('Metadados atualizados com sucesso!', { type: 'success' });
        } catch (err) {
            console.error(err);
            markSourceDown(source);
            toast('Serviço temporariamente indisponível. Tente outra fonte.', { type: 'error' });
        } finally {
            setBusy(btn, false);
        }
    }

    const addSeason = (season) => {
        draft.seasons.push(normalizeSeason(season, draft.seasons.length));
        renderSeasons();
    };

    function addManualSeason() {
        const name = fields.seasonName.value.trim();
        if (!name) { toast('Digite o nome da temporada.', { type: 'error' }); fields.seasonName.focus(); return false; }
        addSeason({ name, type: 'TV', totalEps: 12, watched: [] });
        fields.seasonName.value = '';
        return true;
    }

    async function runSeasonSearch(btn) {
        const query = fields.seasonName.value.trim();
        if (!query) { toast('Digite o nome da temporada/OVA.', { type: 'error' }); fields.seasonName.focus(); return; }
        if (source === 'tmdb' || !navigator.onLine) { addManualSeason(); return; }
        setBusy(btn, true);
        try {
            const list = await searchSeasons(source, query);
            if (!list.length) { showResultsMessage(boxes.seasonResults, 'Nada encontrado. Use "Manual" para criar esta temporada.'); return; }
            setHtml(boxes.seasonResults, html`${list.map((s, i) => html`
                <button type="button" class="result-item" data-pick-season="${i}" data-name="${s.name}" data-eps="${s.eps}">
                    <span class="truncate">${s.name}</span><span class="count">${s.eps} eps</span>
                </button>`)}`);
            boxes.seasonResults.hidden = false;
        } catch (err) {
            console.error(err);
            markSourceDown(source);
            toast('Serviço indisponível: adicionei a temporada manualmente.', { type: 'info' });
            addManualSeason();
        } finally {
            setBusy(btn, false);
        }
    }

    on(content, 'click', '[data-act]', (_, btn) => {
        switch (btn.dataset.act) {
            case 'search': runSearch(btn); break;
            case 'refresh-meta': refreshMeta(btn); break;
            case 'search-season': runSeasonSearch(btn); break;
            case 'add-season': addManualSeason(); break;
            case 'remove-season': {
                const idx = Number(btn.closest('[data-idx]').dataset.idx);
                draft.seasons.splice(idx, 1);
                renderSeasons();
                break;
            }
            default: break;
        }
    });

    on(content, 'click', '[data-pick]', async (_, btn) => {
        let r = found[Number(btn.dataset.pick)];
        if (!r) return;
        if (r.loadDetails) {
            btn.disabled = true;
            setHtml(btn, html`<span>Carregando temporadas...</span>${spinner(15)}`);
            r = await r.loadDetails();
        }
        applyResult(r);
    });

    on(content, 'click', '[data-pick-season]', (_, btn) => {
        addSeason({ name: btn.dataset.name, type: 'TV', totalEps: toInt(btn.dataset.eps, 1, MAX_EPISODES, 12), watched: [] });
        boxes.seasonResults.hidden = true;
        fields.seasonName.value = '';
    });

    // Edição das temporadas na lista (sem redesenhar, para não perder o foco)
    on(content, 'input', '[data-idx] [data-field]', (_, input) => {
        const season = draft.seasons[Number(input.closest('[data-idx]').dataset.idx)];
        if (!season) return;
        const f = input.dataset.field;
        if (f === 'name') season.name = input.value;
        if (f === 'totalEps') {
            const n = parseInt(input.value, 10);
            if (Number.isFinite(n) && n >= 1) { season.totalEps = Math.min(n, MAX_EPISODES); season.watched = season.watched.filter((w) => w <= season.totalEps); }
        }
    });
    on(content, 'change', '[data-idx] select[data-field="type"]', (_, select) => {
        const season = draft.seasons[Number(select.closest('[data-idx]').dataset.idx)];
        if (season) season.type = select.value;
    });

    // Enter no campo de temporada adiciona manualmente, sem enviar o formulário
    fields.seasonName.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addManualSeason(); } });
    // Enter no título busca nas fontes (salvar é só pelo botão, para não gravar sem querer)
    fields.title.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        runSearch($('[data-act="search"]'));
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = fields.title.value.trim();
        if (!title) { toast('Informe o título da obra.', { type: 'error' }); fields.title.focus(); return; }

        const submit = $('[data-submit]');
        const idle = submit.innerHTML;
        submit.disabled = true;
        setHtml(submit, html`${spinner(16)} Salvando...`);
        try {
            await onSave({
                ...draft,
                title,
                category: fields.category.value,
                status: fields.status.value,
                rating: toInt(fields.rating.value, 0, 5, 0),
                tags: fields.tags.value.split(',').map((t) => t.trim()).filter(Boolean),
                airDay: fields.air.value,
                notes: fields.notes.value,
            });
            modal.close();
        } catch (err) {
            console.error(err);
            toast(messageOf(err, 'Não foi possível salvar a obra.'), { type: 'error' });
            submit.disabled = false;
            submit.innerHTML = idle;
        }
    });

    renderSeasons();
    return modal;
}
