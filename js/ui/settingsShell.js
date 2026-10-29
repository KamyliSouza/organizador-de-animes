// Parte comum das duas telas de conta: cabeçalho, abas (Personalização / Configurações)
// e o aviso "descartar alterações?" ao trocar de aba com algo por salvar.
import { html, on } from '../core/dom.js';
import { confirmDialog } from '../core/dialogs.js';
import { icon } from '../core/icons.js';
import { navigate } from '../core/router.js';
import { isStaff } from '../domain/roles.js';
import { myRole } from '../services/session.js';

export const TABS = [
    { id: 'personalizacao', path: '/configuracoes', label: 'Personalização', icon: 'sparkles' },
    { id: 'configuracoes', path: '/configuracoes/conta', label: 'Configurações', icon: 'sliders' },
];

/** Cabeçalho da página + abas. `active` = id da aba atual. */
export function settingsHeader({ profile, active }) {
    return html`
        <header class="page-head">
            <div>
                <span class="eyebrow">${icon('user', { size: 14 })} Conta</span>
                <h1 style="margin-top:10px">Perfil e configurações</h1>
            </div>
            ${profile ? html`<div class="page-head-actions">
                ${isStaff(myRole()) ? html`<a class="button button-secondary" href="#/admin">${icon('shield', { size: 17 })} Painel da equipe</a>` : ''}
                <a class="button button-secondary" href="#/u/${profile.username}">${icon('globe', { size: 17 })} Ver meu perfil</a></div>` : ''}
        </header>
        <nav class="settings-tabs" aria-label="Seções da conta">
            ${TABS.map((t) => html`<a class="settings-tab" href="#${t.path}" ${t.id === active ? html`aria-current="page"` : ''}>${icon(t.icon, { size: 17 })}${t.label}</a>`)}
        </nav>`;
}

/**
 * Ao clicar na OUTRA aba com alterações não salvas, pergunta antes de sair.
 * `isDirty()` diz se há algo por salvar. Devolve a função que desfaz a ligação.
 */
export function guardTabs(root, isDirty) {
    return on(root, 'click', '.settings-tab:not([aria-current])', async (ev, link) => {
        if (!isDirty()) return;
        ev.preventDefault();
        const leave = await confirmDialog({
            title: 'Descartar alterações?',
            message: 'Você mudou alguns campos e ainda não salvou. Se trocar de aba agora, essas mudanças se perdem.',
            confirmLabel: 'Descartar e trocar',
            cancelLabel: 'Continuar editando',
            danger: true,
        });
        if (leave) navigate(link.getAttribute('href').slice(1));
    });
}
