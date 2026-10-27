// Lista de seguidores / de quem a pessoa segue. Quem é dono do perfil pode remover seguidores.
import { el, html, on, setHtml } from '../core/dom.js';
import { confirmDialog } from '../core/dialogs.js';
import { messageOf } from '../core/errors.js';
import { icon, spinner } from '../core/icons.js';
import { openModal } from '../core/modal.js';
import { toast } from '../core/toast.js';
import { avatar, avatarSrc } from './avatar.js';

const TITLES = { followers: 'Seguidores', following: 'Seguindo' };
const EMPTY = {
    followers: 'Ninguém segue este perfil ainda.',
    following: 'Este perfil ainda não segue ninguém.',
};

const personRow = (p, canRemove) => html`
    <li class="person-row" data-id="${p.id}">
        <a class="person-link" href="#/u/${p.username}" data-close>
            ${avatar(p.displayName, 40, avatarSrc(p))}
            <span class="person-names"><b class="truncate">${p.displayName}</b><span class="muted small truncate">@${p.username}</span></span>
        </a>
        ${canRemove ? html`<button type="button" class="button button-ghost button-sm" data-remove aria-label="Remover ${p.displayName} de quem segue você">Remover</button>` : ''}
    </li>`;

/**
 * @param {object} opts
 * @param {string} opts.username   perfil que está sendo visto
 * @param {'followers'|'following'} opts.kind
 * @param {boolean} opts.own       é o meu perfil (pode remover seguidores)
 * @param {object} opts.be         backend
 * @param {() => void} [opts.onChanged]  chamado depois de remover alguém
 */
export function openConnectionsModal({ username, kind, own, be, onChanged }) {
    const content = el(html`
        <div class="stack">
            <div data-list aria-live="polite"><div class="center muted" style="padding:24px 0">${spinner(24)}</div></div>
            <div class="modal-footer"><button type="button" class="button button-secondary" data-modal-close>Fechar</button></div>
        </div>`);
    const modal = openModal({ title: TITLES[kind], iconName: 'users', content });
    const list = content.querySelector('[data-list]');
    const canRemove = own && kind === 'followers';
    let people = [];

    const paint = () => setHtml(list, people.length
        ? html`<ul class="person-list">${people.map((p) => personRow(p, canRemove))}</ul>`
        : html`<p class="muted center" style="padding:20px 0">${EMPTY[kind]}</p>`);

    be.follows.connections(username, kind).then((rows) => { people = rows; paint(); }).catch((err) => {
        console.error(err);
        setHtml(list, html`<div class="notice-box is-error" role="alert">${icon('alert')}<div>${messageOf(err, 'Não foi possível carregar a lista.')}</div></div>`);
    });

    on(content, 'click', '[data-close]', () => modal.close());
    on(content, 'click', '[data-remove]', async (_, btn) => {
        const row = btn.closest('[data-id]');
        const person = people.find((p) => p.id === row.dataset.id);
        if (!person) return;
        const yes = await confirmDialog({
            title: 'Remover de quem segue você', danger: true, confirmLabel: 'Remover',
            message: `Remover ${person.displayName} (@${person.username}) de quem segue você? A pessoa deixa de ver a sua biblioteca e as suas atividades. Se o seu perfil for privado, será preciso pedir para seguir de novo.`,
        });
        if (!yes) return;
        btn.disabled = true;
        try {
            await be.follows.removeFollower(person.id);
            people = people.filter((p) => p.id !== person.id);
            paint();
            toast('Removido de quem segue você.', { type: 'success' });
            onChanged?.(people.length);
        } catch (err) {
            btn.disabled = false;
            toast(messageOf(err, 'Não foi possível remover.'), { type: 'error' });
        }
    });
    return modal;
}
