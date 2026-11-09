// "Casca" do site: navbar, barra inferior (celular) e rodapé.
import { config } from '../config.js';
import { html, on, setHtml } from '../core/dom.js';
import { brandKanji, icon } from '../core/icons.js';
import { currentPath, navigate, onRouteChange } from '../core/router.js';
import { currentTheme, onThemeChange, toggleTheme } from '../core/theme.js';
import { timeAgo } from '../core/time.js';
import { toast } from '../core/toast.js';
import { messageOf } from '../core/errors.js';
import { AUTO_SUSPEND_DAYS, STRIKE_LIMIT, strikeCountText } from '../domain/access.js';
import { SITE_VERSION } from '../domain/changelog.js';
import { isStaff } from '../domain/roles.js';
import { state, isCloud, myRole, onSessionChange, refreshSession } from '../services/session.js';
import { accountMenuHtml, bindAccountMenu, captureAccountFocus, closeAccountMenu } from './accountMenu.js';
import { requestNewWork, showsNewWork } from './newWork.js';
import { openPatchNotesModal } from './patchNotesModal.js';

const isActive = (path, ...prefixes) => prefixes.some((p) => (p === '/' ? path === '/' : path === p || path.startsWith(p + '/')));

function navModel() {
    const cloud = isCloud();
    const user = state.user;
    const path = currentPath();

    const items = [
        { href: '#/', label: user || !cloud ? 'Biblioteca' : 'Início', icon: 'film', active: isActive(path, '/') },
    ];
    if (cloud && user) items.push({ href: '#/feed', label: 'Feed', icon: 'activity', active: isActive(path, '/feed'), badge: state.requests });
    if (cloud) items.push({ href: '#/explorar', label: 'Explorar', icon: 'compass', active: isActive(path, '/explorar', '/u') });
    // Equipe (moderação, administração e Dona): atalho para o painel. No celular o atalho fica no menu do avatar.
    if (cloud && user && isStaff(myRole())) items.push({ href: '#/admin', label: 'Painel', icon: 'shield', active: isActive(path, '/admin'), desktopOnly: true, admin: true });

    // Quem está logada acessa perfil e configurações pelo avatar no topo (accountMenu.js); sem login ou sem conta, o atalho fica na barra inferior.
    let account = null;
    if (!cloud) account = { href: '#/configuracoes', label: 'Ajustes', icon: 'sliders', active: isActive(path, '/configuracoes') };
    else if (!user) account = { href: '#/entrar', label: 'Entrar', icon: 'logIn', active: isActive(path, '/entrar', '/criar-conta', '/recuperar', '/nova-senha') };

    return { items, account, cloud, user };
}

/** Bolinha com o número de pedidos de "seguir" esperando resposta (some quando é 0). */
const badge = (item) => (item.badge > 0
    ? html`<span class="nav-badge" data-badge>${item.badge > 99 ? '99+' : item.badge}<span class="sr-only"> ${item.badge === 1 ? 'pedido para seguir' : 'pedidos para seguir'}</span></span>`
    : '');

function renderNav(nav) {
    const { items, cloud, user } = navModel();
    const dark = currentTheme() === 'dark';
    if (!(cloud && user)) closeAccountMenu();   // saiu da conta: não deixa um "aberto" esquecido para a próxima pessoa que entrar

    setHtml(nav, html`
        <div class="site-nav-inner">
            <a class="brand" href="#/" aria-label="${config.siteName} — início">
                <span class="brand-mark">${brandKanji(28)}</span>
                <span class="brand-text">${config.siteName}</span>
            </a>
            <nav class="nav-links" aria-label="Principal">
                ${items.map((i) => html`<a class="nav-link${i.admin ? ' nav-link-admin' : ''}" href="${i.href}" ${i.admin ? html`aria-label="Painel da equipe" title="Painel da equipe"` : ''} ${i.active ? html`aria-current="page"` : ''}>${icon(i.icon, { size: 17 })}<span class="nav-text">${i.label}</span>${badge(i)}</a>`)}
            </nav>
            <span class="nav-spacer"></span>
            <div class="nav-actions">
                <button type="button" class="icon-button" data-theme-toggle aria-label="${dark ? 'Usar tema claro' : 'Usar tema escuro'}" title="${dark ? 'Tema claro' : 'Tema escuro'}">${icon(dark ? 'sun' : 'moon', { size: 20 })}</button>
                ${showsNewWork(currentPath()) ? html`<button type="button" class="button button-primary new-work-top" data-new-work aria-haspopup="dialog" title="Nova obra">${icon('plus', { size: 18 })}<span class="new-work-label">Nova obra</span></button>` : ''}
                ${cloud && user
                    ? accountMenuHtml({ profile: state.profile, user, role: myRole(), path: currentPath() })
                    : html`<span class="nav-account row" style="gap:8px;flex-wrap:nowrap">
                        ${!cloud
                            ? html`<a class="button button-secondary button-sm" href="#/configuracoes">${icon('sliders', { size: 16 })}Ajustes</a>`
                            : html`
                                <a class="button button-ghost button-sm" href="#/entrar">Entrar</a>
                                <a class="button button-primary button-sm" href="#/criar-conta">Criar conta</a>`}
                    </span>`}
            </div>
        </div>`);
}

function renderTabBar(bar) {
    const { items, account } = navModel();
    const all = [...items.filter((i) => !i.desktopOnly), account].filter(Boolean);
    setHtml(bar, html`${all.map((i) => html`
        <a class="tab-link" href="${i.href}" ${i.active ? html`aria-current="page"` : ''}>${icon(i.icon, { size: 20 })}<span>${i.label}</span>${badge(i)}</a>`)}`);
}

/** Botão flutuante "Nova obra" (celular). Só é redesenhado quando aparece ou some, para o teclado não perder o foco nele. */
let fabShown = null;
function renderFab(region) {
    if (!region) return;
    const show = showsNewWork(currentPath());
    document.body.classList.toggle('has-fab', show);
    if (show === fabShown) return;
    fabShown = show;
    setHtml(region, show
        ? html`<button type="button" class="button button-primary new-work-fab" data-new-work aria-haspopup="dialog">${icon('plus', { size: 22 })}<span class="new-work-label">Nova obra</span></button>`
        : '');
}

/** O botão flutuante fica logo acima da barra inferior, qualquer que seja a altura dela (texto grande, tela baixa). */
function watchFabOffset(tabBar) {
    const sync = () => {
        const r = tabBar.getBoundingClientRect();
        if (!r.height) return;           // barra escondida (computador): vale o padrão do CSS
        document.documentElement.style.setProperty('--fab-bottom', `${Math.round(window.innerHeight - r.top + 12)}px`);
    };
    sync();
    window.addEventListener('resize', sync);
    if (typeof ResizeObserver === 'function') new ResizeObserver(sync).observe(tabBar);
    return sync;
}

function renderFooter(footer) {
    setHtml(footer, html`
        <p>© ${new Date().getFullYear()} ${config.siteName}. Feito para organizar e compartilhar animes.
        <button type="button" class="version-button" data-patch-notes aria-haspopup="dialog" title="Ver as novidades do site">v${SITE_VERSION}<span class="sr-only"> — ver as novidades do site</span></button></p>
        <p>Dados das obras: MyAnimeList (via Jikan), AniList${config.tmdbApiKey ? ' e TMDB' : ''}.
        ${config.repoUrl ? html` · <a href="${config.repoUrl}" target="_blank" rel="noopener noreferrer">Ver código-fonte</a>` : ''}</p>
        ${config.tmdbApiKey ? html`<p class="small">Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB.</p>` : ''}`);
}

/**
 * Avisos do site no topo: os avisos (strikes) da equipe para esta conta e o aviso escrito pela administração.
 * Conta suspensa não passa por aqui: ela vê só a tela de suspensão (ui/suspendedScreen.js).
 * O banner de avisos é fixo: aparece em todas as telas e não dá para fechar; some quando a equipe retira os avisos.
 */
function renderNotice(region) {
    if (!region) return;
    const member = isCloud() && state.user && !state.access.suspended;
    const strikes = member ? state.access.strikes : [];
    const text = isCloud() ? state.site.announcement : '';
    setHtml(region, strikes.length || text ? html`
        <div class="site-notice-inner">
            ${strikes.length ? html`<div class="notice-box is-warn strike-notice" role="status" data-strike-notice>${icon('alert')}<div>
                <strong>Você tem ${strikeCountText(strikes.length)} avisos da equipe.</strong>
                No ${STRIKE_LIMIT}º aviso, a conta é suspensa por ${AUTO_SUSPEND_DAYS} dias.
                <ul class="strike-list">${strikes.map((s) => html`<li>${s.reason}${s.at ? html` <span class="muted small">· ${timeAgo(s.at)}</span>` : ''}</li>`)}</ul>
            </div></div>` : ''}
            ${text ? html`<div class="notice-box site-announcement" role="status">${icon('info')}<div>${text}</div></div>` : ''}
        </div>` : '');
}

export function mountChrome({ nav, tabBar, footer, notice, fab }) {
    const paint = () => {
        const restoreFocus = captureAccountFocus(nav);
        const hadNewWorkFocus = nav.contains(document.activeElement) && document.activeElement.closest('[data-new-work]');
        renderNav(nav); renderTabBar(tabBar); renderNotice(notice); renderFab(fab);
        restoreFocus();
        if (hadNewWorkFocus) nav.querySelector('[data-new-work]')?.focus({ preventScroll: true });   // o redesenho não tira o teclado do botão
        syncFab?.();
    };
    const syncFab = fab ? watchFabOffset(tabBar) : null;
    paint();
    renderFooter(footer);
    on(footer, 'click', '[data-patch-notes]', () => openPatchNotesModal());
    on(nav, 'click', '[data-new-work]', () => requestNewWork());
    if (fab) on(fab, 'click', '[data-new-work]', () => requestNewWork());

    // Mudou de tela: o menu da conta fecha. Um aviso de rota para a MESMA tela (acontece no começo, enquanto o site termina de abrir) só redesenha.
    let lastPath = currentPath();
    onRouteChange(() => {
        const now = currentPath();
        if (now !== lastPath) { lastPath = now; closeAccountMenu(); }
        paint();
    });
    onSessionChange(paint);
    onThemeChange(paint);

    bindAccountMenu(nav);
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
