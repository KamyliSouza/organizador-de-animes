// Modal "Adicionar / Editar obra": busca em MAL/AniList/TMDB, temporadas (ou capítulos e volumes, nos mangás), tags, notas...
import { el, html, on, safeUrl, setHtml, toInt } from '../core/dom.js';
import { icon, spinner } from '../core/icons.js';
import { choiceDialog } from '../core/dialogs.js';
import { openModal } from '../core/modal.js';
import { openTextEditor } from './textEditorModal.js';
import { messageOf } from '../core/errors.js';
import { toast } from '../core/toast.js';
import { DAYS, DAY_LABELS, MAX_CHAPTERS, MAX_EPISODES, MAX_NOTES, MAX_REVIEW, MAX_VOLUMES, SEASON_TYPES, categoriesFor, cloneEntry, emptyEntryFor, findDuplicate, isReading, isReadingSection, markAllWatched, normalizeSection, normalizeSeason, originLabel, progressOf, readSummary, sectionOf, statusLabel, statusesOf, titleKey } from '../domain/entry.js';
import { DEFAULT_SOURCE, READ_SOURCES, SOURCES, searchReadings, searchSeasons, searchWorks, sourceAvailable } from '../services/search/index.js';

const SOURCE_KEY = 'kamylist_last_source';
const LEGACY_SOURCE_KEY = 'media_tracker_last_source';

function loadSource(list = SOURCES) {
    try {
        const s = localStorage.getItem(SOURCE_KEY) || localStorage.getItem(LEGACY_SOURCE_KEY);
        return list.some((x) => x.id === s) && sourceAvailable(s) ? s : DEFAULT_SOURCE;
    } catch { return DEFAULT_SOURCE; }
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
 * @param {'anime'|'manga'|'novel'} [opts.section]  Aba da obra nova (Anime, Mangá ou Light Novel). Na edição vale a da própria obra.
 * @param {(entry:object)=>Promise<void>} opts.onSave
 * @param {object[]} [opts.existing]   Obras que já estão na biblioteca (para avisar de repetidas).
 * @param {(entry:object)=>void} [opts.onShowExisting]  Chamado ao escolher "ver na biblioteca" numa repetida.
 */
export function openMediaForm({ entry = null, section = 'anime', onSave, existing = [], onShowExisting }) {
    const isEdit = Boolean(entry?.id);
    const reading = entry ? isReading(entry) : isReadingSection(section);    // mangá/light novel: capítulos e volumes, sem temporadas
    const sec = entry ? sectionOf(entry) : normalizeSection(section);        // aba da obra (a categoria inicial vem dela)
    const sourceList = reading ? READ_SOURCES : SOURCES;
    const draft = cloneEntry(entry || emptyEntryFor(sec));
    const baseRef = draft.sourceRef || '';   // código da obra antes de escolher outro resultado
    let pickedKey = '';                      // título (normalizado) do resultado escolhido na busca
    let source = loadSource(sourceList);
    let found = [];   // resultados da última busca

    const content = el(html`
    <form class="stack" novalidate>
        <div class="subpanel">
            <div class="field">
                <label for="mf-source">Fonte de busca</label>
                <select id="mf-source" class="select select-sm">
                    ${sourceList.map((s) => html`<option value="${s.id}" ${sourceAvailable(s.id) ? '' : 'disabled'}>${s.label}${sourceAvailable(s.id) ? '' : ' (configure a chave)'}</option>`)}
                </select>
            </div>
        </div>

        <div class="field">
            <label for="mf-title">Título da obra</label>
            <div class="input-row">
                <input id="mf-title" class="input" required maxlength="200" autocomplete="off" placeholder="${reading ? 'Ex: Frieren: Além do Fim da Jornada...' : 'Ex: Diários de uma Apotecária...'}">
                <button type="button" class="button button-secondary" data-act="search">${icon('search', { size: 16 })} Buscar</button>
            </div>
        </div>

        <div class="notice-box is-warn" data-dup hidden>${icon('alert')}<div class="grow">
            <span data-dup-text></span>
            ${onShowExisting ? html` <button type="button" class="link-button" data-act="show-existing">Ver na biblioteca</button>` : ''}
        </div></div>

        ${isEdit ? html`<button type="button" class="button button-secondary button-block" data-act="refresh-meta">${icon('refresh', { size: 16 })} Atualizar dados da obra</button>` : ''}

        <div class="result-list" data-results hidden></div>
        <div class="notice-box" data-loaded hidden>${icon('checkCircle')}<span data-loaded-text></span></div>

        ${reading ? html`
        <div class="subpanel">
            <span class="field-label" style="color:var(--primary-text)">Progresso de leitura</span>
            <div class="form-grid">
                <div class="field">
                    <label for="mf-ch">Capítulos lidos</label>
                    <input id="mf-ch" class="input input-sm" type="number" inputmode="numeric" min="0" max="${MAX_CHAPTERS}">
                </div>
                <div class="field">
                    <label for="mf-ch-total">Total de capítulos</label>
                    <input id="mf-ch-total" class="input input-sm" type="number" inputmode="numeric" min="0" max="${MAX_CHAPTERS}">
                </div>
                <div class="field">
                    <label for="mf-vol">Volumes lidos</label>
                    <input id="mf-vol" class="input input-sm" type="number" inputmode="numeric" min="0" max="${MAX_VOLUMES}">
                </div>
                <div class="field">
                    <label for="mf-vol-total">Total de volumes</label>
                    <input id="mf-vol-total" class="input input-sm" type="number" inputmode="numeric" min="0" max="${MAX_VOLUMES}">
                </div>
            </div>
            <p class="field-hint">Deixe o total em 0 se ainda não souber (obra em publicação). Os lidos não passam do total.</p>
        </div>

        <div class="field">
            <label for="mf-tags">Tags (separadas por vírgula)</label>
            <input id="mf-tags" class="input" autocomplete="off" placeholder="Ex: Em publicação, Reler, Favoritos">
        </div>` : html`
        <div class="subpanel">
            <span class="field-label" style="color:var(--primary-text)">Temporadas, OVAs e filmes</span>
            <div class="input-row">
                <input id="mf-season-name" class="input" maxlength="80" autocomplete="off" placeholder="Nome da temporada/OVA..." aria-label="Nome da temporada ou OVA a adicionar">
                <button type="button" class="button button-secondary button-sm" data-act="search-season">${icon('search', { size: 15 })} Buscar</button>
                <button type="button" class="button button-ghost button-sm" data-act="add-season">${icon('plus', { size: 15 })} Manual</button>
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
        </div>`}

        <div class="field">
            <span class="field-label" id="mf-texts-label">Análise e anotações</span>
            <div class="text-cards" role="group" aria-labelledby="mf-texts-label">
                <button type="button" class="text-card" data-act="edit-review" aria-haspopup="dialog">
                    <span class="text-card-head">${icon('quote', { size: 16 })} Minha análise <span class="muted small">(aparece no feed)</span></span>
                    <span class="text-card-state" data-review-state></span>
                </button>
                <button type="button" class="text-card" data-act="edit-notes" aria-haspopup="dialog">
                    <span class="text-card-head">${icon('book', { size: 16 })} Anotações / Diário <span class="muted small">(privado)</span></span>
                    <span class="text-card-state" data-notes-state></span>
                </button>
            </div>
            <p class="field-hint">A análise aparece para quem vê sua biblioteca. As anotações só você vê (a menos que ative "Mostrar minhas anotações").</p>
        </div>

        <div class="form-grid">
            <div class="field">
                <label for="mf-category">Categoria</label>
                <select id="mf-category" class="select">${categoriesFor(reading).map((c) => html`<option value="${c}">${c}</option>`)}</select>
            </div>
            <div class="field">
                <label for="mf-status">Status</label>
                <select id="mf-status" class="select">${statusesOf(sec).map(([k, st]) => html`<option value="${k}">${st.label}</option>`)}</select>
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
        category: $('#mf-category'), status: $('#mf-status'), rating: $('#mf-rating'),
        seasonName: $('#mf-season-name'),
        chRead: $('#mf-ch'), chTotal: $('#mf-ch-total'), volRead: $('#mf-vol'), volTotal: $('#mf-vol-total'),
    };
    const boxes = { results: $('[data-results]'), seasonResults: $('[data-season-results]'), loaded: $('[data-loaded]'), seasons: $('[data-seasons]') };

    // Preenche com os dados atuais
    fields.source.value = source;
    fields.title.value = draft.title;
    fields.tags.value = draft.tags.join(', ');
    if (fields.air) fields.air.value = draft.airDay;
    if (reading) {
        fields.chRead.value = String(draft.chaptersRead || 0);
        fields.chTotal.value = String(draft.chaptersTotal || 0);
        fields.volRead.value = String(draft.volumesRead || 0);
        fields.volTotal.value = String(draft.volumesTotal || 0);
    }
    // Análise e anotações ficam em janelas próprias (textEditorModal); aqui só o rascunho e o resumo nos botões.
    const texts = { review: draft.review || '', spoiler: Boolean(draft.reviewSpoiler), notes: draft.notes || '' };
    const stateOf = (text, extra = '') => {
        const t = text.trim();
        if (!t) return 'Vazia · toque para escrever';
        const excerpt = t.replace(/\s+/g, ' ');
        return `${excerpt.length > 60 ? excerpt.slice(0, 60).trimEnd() + '…' : excerpt} · ${text.length} caractere${text.length === 1 ? '' : 's'}${extra}`;
    };
    const paintTexts = () => {
        $('[data-review-state]').textContent = stateOf(texts.review, texts.spoiler && texts.review.trim() ? ' · com spoilers' : '');
        $('[data-notes-state]').textContent = stateOf(texts.notes).replace('Vazia', 'Vazias');
    };
    paintTexts();
    fields.category.value = draft.category;
    fields.status.value = draft.status;
    fields.rating.value = String(draft.rating);

    const modal = openModal({ title: isEdit ? 'Editar / atualizar obra' : (reading ? 'Adicionar mangá ou light novel' : 'Adicionar obra'), iconName: isEdit ? 'edit' : 'plus', content, initialFocus: isEdit ? 'dialog' : '#mf-title' });   // editar não abre o teclado do celular; adicionar abre

    // --- obra repetida -------------------------------------------------------------
    const dupBox = $('[data-dup]');
    const dupOf = () => findDuplicate(existing, { title: fields.title.value, sourceRef: draft.sourceRef, category: fields.category.value }, entry?.id || '');
    const describe = (e) => {
        const label = statusLabel(e.status, sectionOf(e));
        if (isReading(e)) return `"${e.title}" (${e.category} · ${label}${e.status === 'planned' ? '' : `, ${readSummary(e)}`})`;
        const { watched, total } = progressOf(e);
        return `"${e.title}" (${e.category} · ${label}${e.status === 'planned' ? '' : `, ${watched}/${total} eps`})`;
    };
    function checkDuplicate() {
        const dup = dupOf();
        dupBox.hidden = !dup;
        if (dup) $('[data-dup-text]').textContent = `Você já tem ${describe(dup)} na biblioteca.`;
        return dup;
    }
    let dupTimer = 0;
    fields.title.addEventListener('input', () => {
        // se a pessoa muda o título depois de escolher um resultado, o código da fonte deixa de valer
        if (draft.sourceRef !== baseRef && titleKey(fields.title.value) !== pickedKey) draft.sourceRef = baseRef;
        clearTimeout(dupTimer);
        dupTimer = setTimeout(checkDuplicate, 200);
    });
    const stopTimer = () => clearTimeout(dupTimer);
    fields.category.addEventListener('change', checkDuplicate);   // o mesmo nome em outro tipo (anime × filme × mangá...) não é repetida
    /** Resultado da busca que o mesmo tipo de obra já tem na biblioteca. */
    const inLibrary = (r) => findDuplicate(existing, { title: r.title, sourceRef: r.sourceRef, category: r.category }, entry?.id || '');

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
            setHtml(boxes.seasons, html`<span class="muted small" style="font-style:italic">Nenhuma temporada adicionada (será criada a Temporada 1).</span>`);
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
        if (categoriesFor(reading).includes(r.category)) fields.category.value = r.category;
        if (r.rating > 0) fields.rating.value = String(r.rating);
        if (r.tags?.length) fields.tags.value = r.tags.join(', ');
        if (r.airDay && fields.air) fields.air.value = r.airDay;
        if (r.sourceRef) { draft.sourceRef = r.sourceRef; pickedKey = titleKey(r.title); }
        draft.coverImage = safeUrl(r.coverImage);
        draft.description = r.description || '';
        draft.genres = r.genres || [];
        if (reading) {
            draft.origin = r.origin || '';
            fields.chTotal.value = String(r.chaptersTotal || 0);
            fields.volTotal.value = String(r.volumesTotal || 0);
            const total = [r.chaptersTotal ? `${r.chaptersTotal} capítulos` : '', r.volumesTotal ? `${r.volumesTotal} volumes` : ''].filter(Boolean);
            showLoaded(`Obra carregada${total.length ? `: ${total.join(' e ')}` : ' (sem total conhecido, ainda em publicação)'}!`);
        } else {
            const seasons = (r.seasons || []).map(normalizeSeason);
            draft.seasons = isEdit ? mergeSeasons(draft.seasons, seasons) : seasons;
            renderSeasons();
            showLoaded(`Obra carregada com ${draft.seasons.length} temporada(s)!`);
        }
        boxes.results.hidden = true;
        checkDuplicate();
    }

    // 429 = o serviço pediu calma (limite de buscas): não é "fora do ar".
    const tooManyRequests = (err) => err?.status === 429;
    const markSourceDown = (id, err) => {
        if (tooManyRequests(err)) return;
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
            found = reading ? await searchReadings(source, query, { limit: 5 }) : await searchWorks(source, query, { limit: 5 });
            if (!found.length) { showResultsMessage(boxes.results, 'Nenhum resultado encontrado. Tente outro título ou outra fonte.'); return; }
            setHtml(boxes.results, html`${found.map((r, i) => reading ? html`
                <button type="button" class="result-item" data-pick="${i}">
                    <span class="truncate">${r.title} (${r.category}${originLabel(r) ? `, ${originLabel(r)}` : ''})${inLibrary(r) ? ' · já na sua lista' : ''}</span>
                    <span class="count">${r.chaptersTotal ? `${r.chaptersTotal} caps` : r.volumesTotal ? `${r.volumesTotal} vols` : 'Em publicação'}</span>
                </button>` : html`
                <button type="button" class="result-item" data-pick="${i}">
                    <span class="truncate">${r.title} (${r.category})${inLibrary(r) ? ' · já na sua lista' : ''}</span>
                    <span class="count">${r.category === 'Filme' ? 'Filme' : r.loadDetails ? 'Temporadas' : `${r.seasons.length} Temp.`}</span>
                </button>`)}`);
            boxes.results.hidden = false;
        } catch (err) {
            console.error(err);
            markSourceDown(source, err);
            showResultsMessage(boxes.results, tooManyRequests(err)
                ? 'Muitas buscas seguidas. Espere alguns segundos e tente de novo (ou use outra fonte).'
                : 'Serviço indisponível no momento. Tente de novo ou selecione outra fonte.');
        } finally {
            setBusy(btn, false);
        }
    }

    async function refreshMeta(btn) {
        const query = fields.title.value.trim();
        if (!query) { toast('Digite um título para atualizar.', { type: 'error' }); return; }
        setBusy(btn, true);
        try {
            // Mangá: entre os primeiros resultados, prefere a mesma obra (mesmo código); senão, o primeiro.
            const list = reading ? await searchReadings(source, query, { limit: 5 }) : await searchWorks(source, query, { limit: 1 });
            const r = (reading && draft.sourceRef && list.find((x) => x.sourceRef === draft.sourceRef)) || list[0];
            if (!r) { toast('Nenhum resultado encontrado para atualizar.', { type: 'error' }); return; }
            draft.coverImage = safeUrl(r.coverImage) || draft.coverImage;
            draft.description = r.description || draft.description;
            if (r.genres?.length) draft.genres = r.genres;
            if (r.airDay && fields.air) fields.air.value = r.airDay;
            if (reading) {   // obra em publicação: os totais crescem, então atualizar traz o número novo
                if (r.chaptersTotal) fields.chTotal.value = String(r.chaptersTotal);
                if (r.volumesTotal) fields.volTotal.value = String(r.volumesTotal);
                if (r.origin) draft.origin = r.origin;
            }
            if (r.sourceRef && !draft.sourceRef) draft.sourceRef = r.sourceRef;
            toast('Dados da obra atualizados!', { type: 'success' });
        } catch (err) {
            console.error(err);
            markSourceDown(source, err);
            toast(tooManyRequests(err) ? 'Muitas buscas seguidas. Espere alguns segundos.' : 'Serviço temporariamente indisponível. Tente outra fonte.', { type: 'error' });
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
            markSourceDown(source, err);
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
            case 'show-existing': {
                const dup = dupOf();
                if (dup) { modal.close(); onShowExisting?.(dup); }
                break;
            }
            case 'edit-review':
                openTextEditor({
                    title: 'Minha análise', iconName: 'quote', label: 'Texto da análise', value: texts.review, maxLength: MAX_REVIEW, spoiler: texts.spoiler,
                    intro: 'O que você achou? Quem pode ver sua biblioteca pode ler, e a análise aparece no feed de quem segue você.',
                    placeholder: 'Escreva sua análise...',
                    onChange: (v) => { texts.review = v.value; texts.spoiler = v.spoiler; paintTexts(); },
                });
                break;
            case 'edit-notes':
                openTextEditor({
                    title: 'Anotações / Diário', iconName: 'book', label: 'Texto das anotações', value: texts.notes, maxLength: MAX_NOTES,
                    intro: 'Só você vê estas anotações (a menos que ative "Mostrar minhas anotações" nas configurações).',
                    placeholder: 'Anote lembretes, teorias ou impressões...',
                    onChange: (v) => { texts.notes = v.value; paintTexts(); },
                });
                break;
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
    fields.seasonName?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addManualSeason(); } });
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

        // obra repetida: avisa e deixa a pessoa decidir (nunca bloqueia)
        const dup = dupOf();
        if (dup) {
            const choice = await choiceDialog({
                title: 'Obra repetida', iconName: 'alert',
                message: `Você já tem ${describe(dup)} na biblioteca.\n\n${isEdit ? 'Salvar mesmo assim?' : 'Adicionar mesmo assim?'}`,
                choices: [
                    { value: 'cancel', label: 'Cancelar', variant: 'ghost' },
                    ...(onShowExisting ? [{ value: 'show', label: 'Ver a existente', variant: 'secondary' }] : []),
                    { value: 'go', label: isEdit ? 'Salvar mesmo assim' : 'Adicionar mesmo assim', variant: 'primary' },
                ],
            });
            if (choice === 'show') { modal.close(); onShowExisting?.(dup); return; }
            if (choice !== 'go') return;
        }

        const submit = $('[data-submit]');
        const idle = submit.innerHTML;
        submit.disabled = true;
        setHtml(submit, html`${spinner(16)} Salvando...`);
        try {
            const data = cloneEntry({
                ...draft,
                title,
                category: fields.category.value,
                status: fields.status.value,
                rating: toInt(fields.rating.value, 0, 5, 0),
                tags: fields.tags.value.split(',').map((t) => t.trim()).filter(Boolean),
                airDay: fields.air?.value || '',
                notes: texts.notes,
                review: texts.review,
                reviewSpoiler: texts.spoiler && texts.review.trim() !== '',
            });
            if (reading) {
                data.seasons = [];
                data.chaptersTotal = toInt(fields.chTotal.value, 0, MAX_CHAPTERS, 0);
                data.volumesTotal = toInt(fields.volTotal.value, 0, MAX_VOLUMES, 0);
                data.chaptersRead = toInt(fields.chRead.value, 0, data.chaptersTotal || MAX_CHAPTERS, 0);
                data.volumesRead = toInt(fields.volRead.value, 0, data.volumesTotal || MAX_VOLUMES, 0);
            }
            // Ao marcar a obra como Concluída, todos os episódios (ou capítulos e volumes, se o total é conhecido) ficam como lidos.
            if (data.status === 'completed' && (!isEdit || entry.status !== 'completed')) markAllWatched(data);
            await onSave(data);
            stopTimer();
            modal.close();
        } catch (err) {
            console.error(err);
            toast(messageOf(err, 'Não foi possível salvar a obra.'), { type: 'error' });
            submit.disabled = false;
            submit.innerHTML = idle;
        }
    });

    if (!reading) renderSeasons();
    return modal;
}
