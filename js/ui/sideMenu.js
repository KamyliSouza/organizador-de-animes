// Menu lateral opcional (computador): Biblioteca, Feed e Explorar, e os atalhos Agenda (só na aba Anime), Favoritos e Estatísticas.
// Desligado por padrão. A escolha fica salva neste navegador. Só aparece em telas largas (CSS) e para quem tem biblioteca
// (conta logada ou modo local). Quando está aberto, o topo deixa de repetir Biblioteca, Feed e Explorar (CSS).
import { html } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { currentPath } from '../core/router.js';
import { canAddWork } from './newWork.js';
import { shortcutsFor } from './shortcuts.js';

const KEY = 'kamylist_sidemenu';
export const SIDE_ID = 'side-region';

/** Telas sem o menu lateral: a de nova senha (a pessoa está no meio de trocar a senha). */
const HIDDEN_ON = ['/nova-senha'];

let open = loadOpen();

function loadOpen() {
    try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export const isSideMenuOpen = () => open;

export function setSideMenuOpen(value) {
    open = Boolean(value);
    try { localStorage.setItem(KEY, open ? '1' : '0'); } catch { /* ok */ }
}

/** Tem menu lateral nesta tela? (quem tem biblioteca; o botão do topo e o menu seguem a mesma regra) */
export const showsSideMenu = (path = currentPath()) => canAddWork() && !HIDDEN_ON.includes(path);

const SHORTCUT_UI = {
    schedule: { label: 'Agenda', icon: 'calendar' },
    favorites: { label: 'Favoritos', icon: 'heart' },
    stats: { label: 'Estatísticas', icon: 'chart' },
};

/**
 * @param {object} opts
 * @param {Array<{href:string,label:string,icon:string,active:boolean}>} opts.items  Biblioteca, Feed, Explorar
 * @param {string} opts.section  aba lembrada da biblioteca ('anime' | 'manga' | 'novel'); só em Anime há Agenda
 * @param {(item:object)=>any} [opts.badge]  bolinha de aviso (pedidos para seguir no Feed)
 */
export function sideMenuHtml({ items, section, badge = () => '' }) {
    return html`<nav class="side-menu" aria-label="Menu lateral">
        <ul class="side-list">
            ${items.map((i) => html`<li><a class="side-link" href="${i.href}" ${i.active ? html`aria-current="page"` : ''}>${icon(i.icon, { size: 18 })}<span class="side-text">${i.label}</span>${badge(i)}</a></li>`)}
        </ul>
        <p class="side-caption" id="side-shortcuts-label">Atalhos</p>
        <ul class="side-list" aria-labelledby="side-shortcuts-label">
            ${shortcutsFor(section).map((name) => html`<li><button type="button" class="side-link" data-shortcut="${name}">${icon(SHORTCUT_UI[name].icon, { size: 18 })}<span class="side-text">${SHORTCUT_UI[name].label}</span></button></li>`)}
        </ul>
    </nav>`;
}
