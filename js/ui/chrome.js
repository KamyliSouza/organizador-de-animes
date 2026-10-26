// "Casca" do site: navbar, barra inferior (celular) e rodapé.
import { config } from '../config.js';
import { html, on, setHtml } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { currentPath, navigate, onRouteChange } from '../core/router.js';
import { currentTheme, onThemeChange, toggleTheme } from '../core/theme.js';
import { toast } from '../core/toast.js';
import { messageOf } from '../core/errors.js';
import { state, isCloud, onSessionChange, refreshSession } from '../services/session.js';
import { avatar, avatarSrc } from './avatar.js';

const isActive = (path, ...prefixes) => prefixes.some((p) => (p === '/' ? path === '/' : path === p || path.startsWith(p + '/')));

function navModel() {
    const cloud = isCloud();
    const user = state.user;
    const path = currentPath();

    const items = [
        { href: '#/', label: user || !cloud ? 'Biblioteca' : 'Início', icon: 'film', active: isActive(path, '/') },
    ];
    if (cloud) items.push({ href: '#/explorar', label: 'Explorar', icon: 'compass', active: isActive(path, '/explorar', '/u') });

    let account;
    if (!cloud) account = { href: '#/configuracoes', label: 'Ajustes', icon: 'sliders', active: isActive(path, '/configuracoes') };
    else if (user) account = { href: '#/configuracoes', label: 'Perfil', icon: 'user', active: isActive(path, '/configuracoes') };
    else account = { href: '#/entrar', label: 'Entrar', icon: 'logIn', active: isActive(path, '/entrar', '/criar-conta', '/recuperar', '/nova-senha') };

    return { items, account, cloud, user };
}

function renderNav(nav) {
    const { items, account, cloud, user } = navModel();
    const dark = currentTheme() === 'dark';
    const name = state.profile?.displayName || state.profile?.username || user?.email || '';

    setHtml(nav, html`
        <div class="site-nav-inner">
            <a class="brand" href="#/" aria-label="${config.siteName} — início">
                <span class="brand-mark">${icon('playCircle', { size: 22 })}</span>
                <span class="brand-text">${config.siteName}</span>
            </a>
            <nav class="nav-links" aria-label="Principal">
                ${items.map((i) => html`<a class="nav-link" href="${i.href}" ${i.active ? html`aria-current="page"` : ''}>${icon(i.icon, { size: 17 })}${i.label}</a>`)}
            </nav>
            <span class="nav-spacer"></span>
            <div class="nav-actions">
                <button type="button" class="icon-button" data-theme-toggle aria-label="${dark ? 'Usar tema claro' : 'Usar tema escuro'}" title="${dark ? 'Tema claro' : 'Tema escuro'}">${icon(dark ? 'sun' : 'moon', { size: 20 })}</button>
                <span class="nav-account row" style="gap:8px;flex-wrap:nowrap">
                    ${!cloud
                        ? html`<a class="button button-secondary button-sm" href="#/configuracoes">${icon('sliders', { size: 16 })}Ajustes</a>`
                        : user
                            ? html`
                                <a class="nav-link" href="#/configuracoes" ${isActive(currentPath(), '/configuracoes') ? html`aria-current="page"` : ''} title="Meu perfil e configurações">${avatar(name, 28, avatarSrc(state.profile))}<span class="truncate nav-name">${name}</span></a>
                                <button type="button" class="button button-ghost button-sm" data-logout aria-label="Sair da conta" title="Sair da conta">${icon('logOut', { size: 16 })}<span class="nav-label">Sair</span></button>`
                            : html`
                                <a class="button button-ghost button-sm" href="#/entrar">Entrar</a>
                                <a class="button button-primary button-sm" href="#/criar-conta">Criar conta</a>`}
                </span>
            </div>
        </div>`);
}

function renderTabBar(bar) {
    const { items, account } = navModel();
    const all = [...items, account];
    setHtml(bar, html`${all.map((i) => html`
        <a class="tab-link" href="${i.href}" ${i.active ? html`aria-current="page"` : ''}>${icon(i.icon, { size: 20 })}<span>${i.label}</span></a>`)}`);
}

function renderFooter(footer) {
    setHtml(footer, html`
        <p>© ${new Date().getFullYear()} ${config.siteName}. Feito para organizar animes com os amigos.</p>
        <p>Dados das obras: MyAnimeList (via Jikan), AniList${config.tmdbApiKey ? ' e TMDB' : ''}.
        ${config.repoUrl ? html` · <a href="${config.repoUrl}" target="_blank" rel="noopener noreferrer">Ver código-fonte</a>` : ''}</p>
        ${config.tmdbApiKey ? html`<p class="small">Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB.</p>` : ''}`);
}

export function mountChrome({ nav, tabBar, footer }) {
    const paint = () => { renderNav(nav); renderTabBar(tabBar); };
    paint();
    renderFooter(footer);

    onRouteChange(paint);
    onSessionChange(paint);
    onThemeChange(paint);

    on(nav, 'click', '[data-theme-toggle]', () => toggleTheme());
    on(nav, 'click', '[data-logout]', async (ev, btn) => {
        btn.disabled = true;
        try {
            await state.backend.auth.signOut();
            await refreshSession();
            navigate('/');
            toast('Você saiu da conta.', { type: 'info' });
        } catch (err) {
            btn.disabled = false;
            toast(messageOf(err), { type: 'error' });
        }
    });
}
