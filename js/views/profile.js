// Perfil público de uma pessoa: #/u/nome. Somente leitura.
import { config } from '../config.js';
import { copyText, html, on, setHtml } from '../core/dom.js';
import { messageOf } from '../core/errors.js';
import { icon } from '../core/icons.js';
import { toast } from '../core/toast.js';
import { backend, isCloud, state } from '../services/session.js';
import { avatar } from '../ui/avatar.js';
import { openDetailsModal, openStatsModal } from '../ui/infoModals.js';
import { mountLibraryBrowser } from '../ui/libraryBrowser.js';
import { mediaCardHtml } from '../ui/mediaCard.js';
import { statTilesHtml } from '../ui/statTiles.js';
import { MAX_FAVORITES } from '../domain/entry.js';

const link = (username) => `${location.origin}${location.pathname}#/u/${username}`;

const messageCard = (iconName, title, text, extra = '') => html`
    <div class="glass-panel empty-state">${icon(iconName, { size: 44 })}<h3>${title}</h3><p>${text}</p>${extra}</div>`;

export async function mount(root, ctx) {
    const username = String(ctx.params.username || '').toLowerCase();

    if (!isCloud()) {
        setHtml(root, messageCard('lock', 'Perfis públicos precisam do login ativado', 'Configure o Supabase em js/config.js (passo a passo no README.md).'));
        return;
    }

    setHtml(root, html`<div class="skeleton" style="min-height:120px"></div><div class="media-grid"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>`);

    const be = backend();
    let profile;
    let entries;
    try {
        profile = await be.profiles.getPublic(username);
        if (profile) {
            const own = Boolean(state.user && profile.id === state.user.id);
            entries = own ? await be.library.listMine() : await be.library.listPublic(username);
            // Na prévia do próprio perfil, mostra o mesmo que os visitantes veriam.
            if (own && !profile.showNotes) entries = entries.map((e) => ({ ...e, notes: '' }));
        }
    } catch (err) {
        console.error(err);
        setHtml(root, messageCard('alert', 'Não foi possível carregar este perfil', messageOf(err, 'Verifique sua conexão e tente de novo.'),
            html`<button type="button" class="button button-primary" data-retry>Tentar de novo</button>`));
        root.querySelector('[data-retry]').addEventListener('click', () => location.reload());
        return;
    }

    if (!profile) {
        setHtml(root, messageCard('user', 'Perfil não encontrado', `Não existe o perfil "@${username}", ou ele é privado.`,
            html`<a class="button button-secondary" href="#/explorar">${icon('compass', { size: 17 })} Explorar perfis</a>`));
        return;
    }

    const own = Boolean(state.user && profile.id === state.user.id);
    document.title = `${profile.displayName} (@${profile.username}) · ${config.siteName}`;
    // Obras fixadas pela pessoa (o site limita a MAX_FAVORITES; aqui também, caso alguém grave mais direto pela API)
    const favorites = entries.filter((e) => e.favorite).slice(0, MAX_FAVORITES);

    setHtml(root, html`
        ${own ? html`<div class="notice-box">${icon(profile.isPublic ? 'globe' : 'lock')}<div>
            <strong>Prévia do seu perfil.</strong> ${profile.isPublic ? 'É assim que seus amigos veem.' : 'Ele está privado: só você consegue ver esta página.'}
            <a href="#/configuracoes">Editar perfil e privacidade</a></div></div>` : ''}
        <header class="profile-head glass-panel">
            ${avatar(profile.displayName || profile.username, 84)}
            <div class="profile-info">
                <h1>${profile.displayName}</h1>
                <p class="handle">@${profile.username}</p>
                ${profile.bio ? html`<p class="bio">${profile.bio}</p>` : ''}
            </div>
            <div class="profile-actions">
                <button type="button" class="button button-secondary" data-act="copy">${icon('link', { size: 17 })} Copiar link</button>
                <button type="button" class="button button-secondary" data-act="stats">${icon('chart', { size: 17 })} Estatísticas</button>
            </div>
        </header>
        ${statTilesHtml(entries)}
        ${favorites.length ? html`
            <section class="fav-section" data-favorites aria-labelledby="fav-title">
                <h2 id="fav-title">${icon('heart', { size: 20 })} Favoritos</h2>
                <div class="media-grid">${favorites.map((e) => mediaCardHtml(e, { readonly: true }))}</div>
            </section>` : ''}
        <div data-browser class="stack"></div>`);

    const browser = mountLibraryBrowser(root.querySelector('[data-browser]'), {
        entries, readonly: true,
        actions: { details: (entry) => openDetailsModal(entry) },
    });

    const offFav = on(root, 'click', '[data-favorites] [data-action="details"]', (_, btn) => {
        const entry = entries.find((e) => e.id === btn.closest('[data-id]')?.dataset.id);
        if (entry) openDetailsModal(entry);
    });

    const off = on(root, 'click', '[data-act]', async (_, btn) => {
        if (btn.dataset.act === 'stats') openStatsModal(entries);
        if (btn.dataset.act === 'copy') {
            const ok = await copyText(link(profile.username));
            toast(ok ? 'Link copiado!' : 'Não foi possível copiar o link.', { type: ok ? 'success' : 'error' });
        }
    });

    return () => { off(); offFav(); browser.destroy(); };
}
