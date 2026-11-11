// Parte comum das Configurações: cabeçalho da página, a lista de temas (índice no celular, lista lateral no computador),
// o link "Todas as configurações" e o aviso "descartar alterações?" ao trocar de tema com algo por salvar.
// Os temas e seus endereços vêm de js/domain/settingsThemes.js.
import { html, on } from '../core/dom.js';
import { confirmDialog } from '../core/dialogs.js';
import { icon } from '../core/icons.js';
import { navigate } from '../core/router.js';
import { SETTINGS_THEMES, themeHref } from '../domain/settingsThemes.js';
import { isStaff } from '../domain/roles.js';
import { myRole } from '../services/session.js';

/** A partir desta largura a lista de temas fica ao lado do conteúdo (em em: acompanha o tamanho do texto, como o CSS). */
export const WIDE_QUERY = '(min-width: 56.25em)';

export const isWideSettings = () => window.matchMedia(WIDE_QUERY).matches;

/** Chama `fn` quando a janela passa a ser larga (ex.: o celular girou). Devolve a função que desfaz. */
export function onBecomeWide(fn) {
    const mq = window.matchMedia(WIDE_QUERY);
    const handler = (ev) => { if (ev.matches) fn(); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
}

/** Título da página + atalhos. */
export function settingsHeader({ profile }) {
    return html`
        <header class="page-head">
            <div>
                <span class="eyebrow">${icon('user', { size: 14 })} Conta</span>
                <h1 style="margin-top:10px">Perfil e configurações</h1>
            </div>
            ${profile ? html`<div class="page-head-actions">
                ${isStaff(myRole()) ? html`<a class="button button-secondary" href="#/admin">${icon('shield', { size: 17 })} Painel da equipe</a>` : ''}
                <a class="button button-secondary" href="#/u/${profile.username}">${icon('globe', { size: 17 })} Ver meu perfil</a></div>` : ''}
        </header>`;
}

/** A lista de temas. `active` = id do tema aberto ('' no índice). */
export function settingsNavHtml({ active }) {
    return html`
        <nav class="settings-nav glass-panel" aria-label="Temas das configurações">
            <ul class="settings-list">
                ${SETTINGS_THEMES.map((t) => html`
                <li><a class="settings-link" data-settings-link href="${themeHref(t.id)}" ${t.id === active ? html`aria-current="page"` : ''}>
                    <span class="settings-link-icon">${icon(t.icon, { size: 20 })}</span>
                    <span class="settings-link-text"><span class="settings-link-label">${t.label}</span><span class="settings-link-hint">${t.hint}</span></span>
                    <span class="settings-link-go">${icon('chevronRight', { size: 18 })}</span>
                </a></li>`)}
            </ul>
        </nav>`;
}

/** O link que volta ao índice (só aparece no celular, quando um tema está aberto). */
export const settingsBackHtml = () => html`
    <a class="button button-secondary button-sm settings-back" data-settings-link href="${themeHref('')}">${icon('arrowLeft', { size: 17 })} Todas as configurações</a>`;

/**
 * Ao clicar em OUTRO tema (ou em "Todas as configurações") com alterações não salvas, pergunta antes de sair.
 * `isDirty()` diz se há algo por salvar. Devolve a função que desfaz a ligação.
 */
export function guardSettingsNav(root, isDirty) {
    return on(root, 'click', '[data-settings-link]:not([aria-current])', async (ev, link) => {
        if (!isDirty()) return;
        ev.preventDefault();
        const leave = await confirmDialog({
            title: 'Descartar alterações?',
            message: 'Você mudou alguns campos e ainda não salvou. Se trocar de tema agora, essas mudanças se perdem.',
            confirmLabel: 'Descartar e trocar',
            cancelLabel: 'Continuar editando',
            danger: true,
        });
        if (leave) navigate(link.getAttribute('href').slice(1));
    });
}
