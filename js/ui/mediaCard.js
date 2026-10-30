// Marcação dos cards de obra. Funciona para o dono (com botões de ação) e
// para visitantes de perfil público (somente leitura).
import { html } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { CATEGORY_CLASS, DAY_LABELS, isReading, originLabel, progressOf, readProgress, readSummary, sectionOf, statusLabel, statusesOf } from '../domain/entry.js';

export const starsText = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

export function starsHtml(rating) {
    if (!rating) return html`<span class="muted small">Sem nota</span>`;
    return html`<span class="stars" role="img" aria-label="${rating} de 5 estrelas">${starsText(rating)}</span>`;
}

/** Ícone de capa vazia: livro para mangá e light novel, filme para o resto. */
export const posterPlaceholder = (reading = false) => html`<span class="poster-empty">${icon(reading ? 'book' : 'film', { size: 30 })}</span>`;

/** A capa é um botão: clicar nela abre os detalhes (para quem tem o link "Detalhes", ela sai da ordem do Tab para não repetir). */
function poster(entry, withDay, withHeart = false, tabbable = false) {
    return html`<button type="button" class="poster poster-button" data-action="cover" aria-label="Abrir detalhes de ${entry.title}" tabindex="${tabbable ? 0 : -1}">
        ${withHeart && entry.favorite ? html`<span class="fav-badge" title="Favorito" role="img" aria-label="Favorito">${icon('heart', { size: 13 })}</span>` : ''}
        ${entry.coverImage
            ? html`<img src="${entry.coverImage}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-fallback ${isReading(entry) ? html`data-reading` : ''}>`
            : posterPlaceholder(isReading(entry))}
        ${withDay && entry.airDay ? html`<span class="air-day">${icon('calendar', { size: 11 })} ${entry.airDay}</span>` : ''}
    </button>`;
}

/** Seletor de status (só para a dona/dono da biblioteca). Usa data-change, para não confundir com os botões data-action. */
const statusSelect = (entry) => html`
    <select class="select select-sm status-select" data-change="status" aria-label="Status de ${entry.title}" title="Mudar o status">
        ${statusesOf(sectionOf(entry)).map(([key, st]) => html`<option value="${key}" ${key === entry.status ? 'selected' : ''}>${st.label}</option>`)}
    </select>`;

/** Selos do card: categoria, origem (manhwa, manhua...) e status. */
const badges = (entry) => html`
    <span class="badge badge-${CATEGORY_CLASS[entry.category]}">${entry.category}</span>
    ${originLabel(entry) ? html`<span class="badge badge-muted" title="Origem">${originLabel(entry)}</span>` : ''}
    <span class="badge badge-${entry.status}">${statusLabel(entry.status, sectionOf(entry))}</span>`;

/** Bloco de progresso do card: episódios (Assistir) ou capítulos e volumes (Ler). */
function progressBlock(entry) {
    if (isReading(entry)) {
        const r = readProgress(entry);
        if (entry.status === 'planned') {
            const known = [entry.chaptersTotal > 0 ? `${entry.chaptersTotal} caps` : '', entry.volumesTotal > 0 ? `${entry.volumesTotal} vols` : ''].filter(Boolean).join(' · ');
            return html`<div class="media-progress is-idle">
                <div class="row-between"><span>Ainda não começou${known ? ` · ${known}` : ''}</span></div>
                <div class="progress" aria-hidden="true"><span style="width:0"></span></div>
            </div>`;
        }
        return html`<div class="media-progress">
            <div class="row-between"><span class="read-summary">${readSummary(entry)}</span>${r.known ? html`<span class="pct">${r.pct}%</span>` : ''}</div>
            ${r.known ? html`<div class="progress ${r.pct >= 100 ? 'is-complete' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${r.pct}" aria-label="Progresso de ${entry.title}"><span style="width:${r.pct}%"></span></div>` : ''}
        </div>`;
    }
    const { watched, total, pct } = progressOf(entry);
    return entry.status !== 'planned' ? html`
        <div class="media-progress">
            <div class="row-between"><span>Progresso: <b>${watched}</b> / ${total} eps</span><span class="pct">${pct}%</span></div>
            <div class="progress ${pct >= 100 ? 'is-complete' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Progresso de ${entry.title}"><span style="width:${pct}%"></span></div>
        </div>` : html`
        <div class="media-progress is-idle">
            <div class="row-between"><span>Ainda não começou · ${total} eps</span></div>
            <div class="progress" aria-hidden="true"><span style="width:0"></span></div>
        </div>`;
}

/** "+1 Ep" / "+1 Cap": só aparece enquanto a obra está em andamento. Fica sempre ao lado do seletor de status. */
function incButton(entry) {
    if (entry.status !== 'watching') return '';
    return isReading(entry)
        ? html`<button type="button" class="button button-primary button-sm" data-action="inc" title="Marcar mais 1 capítulo como lido" aria-label="Marcar mais 1 capítulo de ${entry.title}">+1 Cap</button>`
        : html`<button type="button" class="button button-primary button-sm" data-action="inc" title="Marcar mais 1 episódio como visto" aria-label="Marcar mais 1 episódio de ${entry.title}">+1 Ep</button>`;
}

/** Botão que abre as temporadas (Assistir) ou o progresso (Ler). Obra que ainda não começou não tem. */
function progressButton(entry) {
    if (entry.status === 'planned') return '';
    return isReading(entry)
        ? html`<button type="button" class="button button-secondary button-sm" data-action="progress">${icon('layers', { size: 15 })} Progresso</button>`
        : html`<button type="button" class="button button-secondary button-sm" data-action="seasons">${icon('layers', { size: 15 })} Temporadas (${entry.seasons.length})</button>`;
}

function favoriteButton(entry) {
    const label = entry.favorite ? `Tirar ${entry.title} dos favoritos` : `Favoritar ${entry.title}`;
    return html`<button type="button" class="icon-button sm fav" data-action="favorite" aria-pressed="${String(Boolean(entry.favorite))}" aria-label="${label}" title="${entry.favorite ? 'Tirar dos favoritos' : 'Favoritar (fixa no perfil)'}">${icon('heart', { size: 16 })}</button>`;
}

export function mediaCardHtml(entry, { readonly = false } = {}) {
    const hasDetails = Boolean(entry.description || entry.notes || entry.review);

    return html`
    <article class="media-card glass-panel ${entry.status === 'dropped' ? 'is-dropped' : ''}" data-id="${entry.id}">
        ${poster(entry, true, readonly, !hasDetails)}
        <div class="media-body">
            <div class="media-badges">${badges(entry)}</div>
            <h3 class="media-title">${entry.title}</h3>
            <div class="media-tags">${entry.tags.slice(0, 4).map((t) => html`<span class="chip">${t}</span>`)}</div>
            <div class="media-meta">
                ${starsHtml(entry.rating)}
                ${hasDetails ? html`<button type="button" class="link-button" data-action="details">${icon('book', { size: 14 })} Detalhes</button>` : ''}
            </div>
            <div class="media-foot">
                ${progressBlock(entry)}
                ${readonly ? '' : html`
                    <div class="media-actions">
                        <div class="status-row">
                            <div class="status-pick">${statusSelect(entry)}</div>
                            ${incButton(entry)}
                        </div>
                        ${progressButton(entry)}
                        <span class="push">
                            ${favoriteButton(entry)}
                            <button type="button" class="icon-button sm" data-action="share" aria-label="Compartilhar ${entry.title}" title="Compartilhar">${icon('share', { size: 16 })}</button>
                            <button type="button" class="icon-button sm" data-action="edit" aria-label="Editar ${entry.title}" title="Editar">${icon('edit', { size: 16 })}</button>
                            <button type="button" class="icon-button sm danger" data-action="delete" aria-label="Excluir ${entry.title}" title="Excluir">${icon('trash', { size: 16 })}</button>
                        </span>
                    </div>`}
            </div>
        </div>
    </article>`;
}

export function mediaRowHtml(entry, { readonly = false } = {}) {
    const { watched, total, pct } = progressOf(entry);
    const reading = isReading(entry);
    const showBar = !reading || readProgress(entry).known;
    const hasDetails = Boolean(entry.description || entry.notes || entry.review);
    const statusText = statusLabel(entry.status, sectionOf(entry));
    const progressText = reading ? `${readSummary(entry)}${showBar ? ` (${pct}%)` : ''}` : `${watched}/${total} eps (${pct}%)`;

    return html`
    <article class="media-row glass-panel ${entry.status === 'dropped' ? 'is-dropped' : ''}" data-id="${entry.id}">
        <button type="button" class="thumb poster-button" data-action="cover" aria-label="Abrir detalhes de ${entry.title}" tabindex="${hasDetails ? -1 : 0}">${entry.coverImage ? html`<img src="${entry.coverImage}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-fallback>` : ''}</button>
        <div class="info">
            <h3 class="truncate">${entry.title}</h3>
            <p>${entry.category}${originLabel(entry) ? ` · ${originLabel(entry)}` : ''} · ${statusText} · ${progressText}${!reading && entry.airDay ? html` · ${DAY_LABELS[entry.airDay]}` : ''}${entry.rating ? html` · <span class="stars" role="img" aria-label="${entry.rating} de 5 estrelas">${starsText(entry.rating)}</span>` : ''}</p>
            ${showBar ? html`<div class="progress progress-slim ${pct >= 100 ? 'is-complete' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Progresso de ${entry.title}"><span style="width:${pct}%"></span></div>` : ''}
        </div>
        <div class="actions">
            ${readonly ? '' : html`
                <div class="status-pick">${statusSelect(entry)}</div>
                <span class="inc-slot">${incButton(entry)}</span>`}
            <span class="icon-group">
                ${hasDetails ? html`<button type="button" class="icon-button sm" data-action="details" aria-label="Detalhes de ${entry.title}" title="Detalhes">${icon('book', { size: 16 })}</button>` : ''}
                ${readonly ? '' : html`
                    ${entry.status !== 'planned' ? html`<button type="button" class="icon-button sm" data-action="${reading ? 'progress' : 'seasons'}" aria-label="${reading ? 'Progresso' : 'Temporadas'} de ${entry.title}" title="${reading ? 'Progresso' : 'Temporadas'}">${icon('layers', { size: 16 })}</button>` : ''}
                    ${favoriteButton(entry)}
                    <button type="button" class="icon-button sm" data-action="share" aria-label="Compartilhar ${entry.title}" title="Compartilhar">${icon('share', { size: 16 })}</button>
                    <button type="button" class="icon-button sm" data-action="edit" aria-label="Editar ${entry.title}" title="Editar">${icon('edit', { size: 16 })}</button>
                    <button type="button" class="icon-button sm danger" data-action="delete" aria-label="Excluir ${entry.title}" title="Excluir">${icon('trash', { size: 16 })}</button>`}
            </span>
        </div>
    </article>`;
}

/** Troca uma capa que não carregou pelo ícone padrão. */
export function applyImageFallback(img) {
    const holder = img.closest('.poster, .thumb, .feed-cover');
    if (!holder) return;
    img.remove();
    if (!holder.classList.contains('thumb') && !holder.querySelector('.poster-empty')) {
        holder.insertAdjacentHTML('afterbegin', posterPlaceholder(img.hasAttribute('data-reading')).toString());
    }
}
