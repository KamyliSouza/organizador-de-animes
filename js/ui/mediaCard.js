// Marcação dos cards de obra. Funciona para o dono (com botões de ação) e
// para visitantes de perfil público (somente leitura).
import { html } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { CATEGORY_CLASS, DAY_LABELS, STATUSES, progressOf } from '../domain/entry.js';

export const starsText = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

export function starsHtml(rating) {
    if (!rating) return html`<span class="muted small">Sem nota</span>`;
    return html`<span class="stars" role="img" aria-label="${rating} de 5 estrelas">${starsText(rating)}</span>`;
}

export const posterPlaceholder = () => html`<span class="poster-empty">${icon('film', { size: 30 })}</span>`;

function poster(entry, withDay, withHeart = false) {
    return html`<div class="poster">
        ${withHeart && entry.favorite ? html`<span class="fav-badge" title="Favorito" role="img" aria-label="Favorito">${icon('heart', { size: 13 })}</span>` : ''}
        ${entry.coverImage
            ? html`<img src="${entry.coverImage}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-fallback>`
            : posterPlaceholder()}
        ${withDay && entry.airDay ? html`<span class="air-day">${icon('calendar', { size: 11 })} ${entry.airDay}</span>` : ''}
    </div>`;
}

function favoriteButton(entry) {
    const label = entry.favorite ? `Tirar ${entry.title} dos favoritos` : `Favoritar ${entry.title}`;
    return html`<button type="button" class="icon-button sm fav" data-action="favorite" aria-pressed="${String(Boolean(entry.favorite))}" aria-label="${label}" title="${entry.favorite ? 'Tirar dos favoritos' : 'Favoritar (fixa no perfil)'}">${icon('heart', { size: 16 })}</button>`;
}

export function mediaCardHtml(entry, { readonly = false } = {}) {
    const { watched, total, pct } = progressOf(entry);
    const status = STATUSES[entry.status];
    const hasDetails = Boolean(entry.description || entry.notes || entry.review);

    return html`
    <article class="media-card glass-panel ${entry.status === 'dropped' ? 'is-dropped' : ''}" data-id="${entry.id}">
        ${poster(entry, true, readonly)}
        <div class="media-body">
            <div class="media-badges">
                <span class="badge badge-${CATEGORY_CLASS[entry.category]}">${entry.category}</span>
                <span class="badge badge-${entry.status}">${status.label}</span>
            </div>
            <h3 class="media-title">${entry.title}</h3>
            <div class="media-tags">${entry.tags.slice(0, 4).map((t) => html`<span class="chip">${t}</span>`)}</div>
            <div class="media-meta">
                ${starsHtml(entry.rating)}
                ${hasDetails ? html`<button type="button" class="link-button" data-action="details">${icon('book', { size: 14 })} Detalhes</button>` : ''}
            </div>
            ${entry.status !== 'planned' ? html`
                <div class="media-progress">
                    <div class="row-between"><span>Progresso: <b>${watched}</b> / ${total} eps</span><span class="pct">${pct}%</span></div>
                    <div class="progress ${pct >= 100 ? 'is-complete' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Progresso de ${entry.title}"><span style="width:${pct}%"></span></div>
                </div>` : html`
                <div class="media-progress is-idle">
                    <div class="row-between"><span>Ainda não começou · ${total} eps</span></div>
                    <div class="progress" aria-hidden="true"><span style="width:0"></span></div>
                </div>`}
            ${readonly ? '' : html`
                <div class="media-actions">
                    ${entry.status !== 'planned' ? html`
                        <button type="button" class="button button-secondary button-sm" data-action="seasons">${icon('layers', { size: 15 })} Temporadas (${entry.seasons.length})</button>
                        <button type="button" class="button button-primary button-sm" data-action="inc" title="Marcar mais 1 episódio como assistido" aria-label="Marcar mais 1 episódio de ${entry.title}">+1 Ep</button>` : ''}
                    <span class="push">
                        ${favoriteButton(entry)}
                        <button type="button" class="icon-button sm" data-action="share" aria-label="Compartilhar ${entry.title}" title="Compartilhar">${icon('share', { size: 16 })}</button>
                        <button type="button" class="icon-button sm" data-action="edit" aria-label="Editar ${entry.title}" title="Editar">${icon('edit', { size: 16 })}</button>
                        <button type="button" class="icon-button sm danger" data-action="delete" aria-label="Excluir ${entry.title}" title="Excluir">${icon('trash', { size: 16 })}</button>
                    </span>
                </div>`}
        </div>
    </article>`;
}

export function mediaRowHtml(entry, { readonly = false } = {}) {
    const { watched, total, pct } = progressOf(entry);
    const hasDetails = Boolean(entry.description || entry.notes || entry.review);

    return html`
    <article class="media-row glass-panel ${entry.status === 'dropped' ? 'is-dropped' : ''}" data-id="${entry.id}">
        <div class="thumb">${entry.coverImage ? html`<img src="${entry.coverImage}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-fallback>` : ''}</div>
        <div class="info">
            <h3 class="truncate">${entry.title}</h3>
            <p class="truncate">${entry.category} · ${STATUSES[entry.status].label} · ${watched}/${total} eps (${pct}%)${entry.airDay ? html` · ${DAY_LABELS[entry.airDay]}` : ''}</p>
        </div>
        <div class="actions">
            ${readonly
                ? (hasDetails ? html`<button type="button" class="icon-button sm" data-action="details" aria-label="Detalhes de ${entry.title}" title="Detalhes">${icon('book', { size: 16 })}</button>` : '')
                : html`
                    ${entry.status !== 'planned' ? html`<button type="button" class="button button-primary button-sm" data-action="inc" aria-label="Marcar mais 1 episódio de ${entry.title}">+1 Ep</button>
                    <button type="button" class="icon-button sm" data-action="seasons" aria-label="Temporadas de ${entry.title}" title="Temporadas">${icon('layers', { size: 16 })}</button>` : ''}
                    ${favoriteButton(entry)}
                    <button type="button" class="icon-button sm" data-action="edit" aria-label="Editar ${entry.title}" title="Editar">${icon('edit', { size: 16 })}</button>
                    <button type="button" class="icon-button sm danger" data-action="delete" aria-label="Excluir ${entry.title}" title="Excluir">${icon('trash', { size: 16 })}</button>`}
        </div>
    </article>`;
}

/** Troca uma capa que não carregou pelo ícone padrão. */
export function applyImageFallback(img) {
    const holder = img.closest('.poster, .thumb');
    if (!holder) return;
    img.remove();
    if (holder.classList.contains('poster') && !holder.querySelector('.poster-empty')) {
        holder.insertAdjacentHTML('afterbegin', posterPlaceholder().toString());
    }
}
