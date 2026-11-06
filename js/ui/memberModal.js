// Gerenciar uma pessoa (equipe): restaurar dados do perfil, renomear, suspender e mudar o cargo.
// Cada ação chama uma função do banco que confere o cargo de novo; esconder botão aqui é só conforto.
import { el, html } from '../core/dom.js';
import { confirmDialog } from '../core/dialogs.js';
import { messageOf } from '../core/errors.js';
import { openModal } from '../core/modal.js';
import { toast } from '../core/toast.js';
import { WIPE_FIELDS, REMOVED_MARK } from '../domain/reportSnapshot.js';
import { ROLES, canAct, grantableRoles, rankOf } from '../domain/roles.js';
import { avatar, avatarSrc } from './avatar.js';
import { roleBadge } from './roleBadge.js';

const RESET_FIELDS = [
    ['display_name', 'Nome de exibição', 'volta para "Usuário" + 4 letras ou números'],
    ['bio', 'Descrição (bio)', 'fica vazia'],
    ['avatar', 'Foto de perfil', 'a foto some'],
    ['background', 'Imagem de fundo do perfil', 'o fundo some'],
    ['username', 'Nome de usuário (@)', 'vira "user_" + código; o link antigo do perfil deixa de funcionar'],
];
const FIELD_NAMES = Object.fromEntries(RESET_FIELDS.map(([k, label]) => [k, label.toLowerCase()]));
const WIPE_NAMES = Object.fromEntries(WIPE_FIELDS.map((f) => [f.key, f.label.toLowerCase()]));

/**
 * @param {object} opts
 * @param {{id: string, username: string, displayName: string, avatarV?: number, role: string, suspended: boolean, suspensionReason?: string}} opts.member
 * @param {string} opts.actorRole  cargo de quem está usando o painel
 * @param {object} opts.moderation  backend.moderation
 * @param {() => void} [opts.onChanged]  chamado depois de uma ação que deu certo
 */
export function openMemberModal({ member, actorRole, moderation, onChanged }) {
    const allowed = canAct(actorRole, member.role);
    const roles = allowed ? grantableRoles(actorRole) : [];

    const header = html`
        <div class="admin-who">
            ${avatar(member.displayName || member.username, 46, avatarSrc(member))}
            <span class="person-names">
                <span class="name-line"><b class="truncate">${member.displayName}</b>${roleBadge(member.role)}</span>
                <span class="muted small truncate">@${member.username}</span>
            </span>
        </div>
        ${member.suspended ? html`<div class="admin-flags"><span class="badge badge-danger">Conta suspensa</span></div>` : ''}`;

    const blocked = html`<p class="notice-box">Você só pode agir sobre quem tem um cargo menor que o seu. ${rankOf(member.role) >= rankOf(actorRole) ? 'Esta pessoa tem o mesmo cargo que você ou um maior.' : ''}</p>`;

    const content = el(html`
        <div class="stack">
            ${header}
            ${!allowed ? blocked : html`
            <section class="manage-section" aria-labelledby="mm-reset">
                <h3 id="mm-reset">Restaurar dados do perfil</h3>
                <p class="field-hint">Use quando o nome, a bio, a foto ou o fundo forem impróprios. A pessoa pode editar de novo depois.</p>
                <div class="manage-quick">
                    <button type="button" class="button button-secondary" data-do="media">Zerar foto e fundo de uma vez</button>
                </div>
                ${RESET_FIELDS.map(([key, label, effect]) => html`
                    <label class="check-row"><input type="checkbox" data-reset="${key}"><span>${label} <span class="muted small">(${effect})</span></span></label>`)}
                <div><button type="button" class="button button-secondary" data-do="reset" disabled>Restaurar o que marquei</button></div>
            </section>

            <section class="manage-section" aria-labelledby="mm-wipe">
                <h3 id="mm-wipe">Remover conteúdo</h3>
                <p class="field-hint">Troca o texto marcado por “${REMOVED_MARK}” em todas as obras da pessoa (nas tags, o campo fica vazio). Progresso, notas, status, favoritos e capas não mudam. Para tirar de uma obra só, abra a denúncia e use os botões ao lado de cada texto.</p>
                ${WIPE_FIELDS.map((f) => html`
                    <label class="check-row"><input type="checkbox" data-wipe-field="${f.key}"><span>${f.label} <span class="muted small">(${f.effect})</span></span></label>`)}
                <div><button type="button" class="button button-secondary" data-do="wipe" disabled>Remover o que marquei</button></div>
            </section>

            <section class="manage-section" aria-labelledby="mm-rename">
                <h3 id="mm-rename">Renomear</h3>
                <form class="input-row" data-form="rename" novalidate>
                    <label class="sr-only" for="mm-name">Novo nome de exibição</label>
                    <input id="mm-name" class="input" maxlength="40" value="${member.displayName}" autocomplete="off">
                    <button type="submit" class="button button-secondary">Salvar nome</button>
                </form>
            </section>

            <section class="manage-section" aria-labelledby="mm-sus">
                <h3 id="mm-sus">${member.suspended ? 'Conta suspensa' : 'Suspender conta'}</h3>
                ${member.suspended ? html`
                    ${member.suspensionReason ? html`<p class="small">Motivo: ${member.suspensionReason}</p>` : ''}
                    <div><button type="button" class="button button-secondary" data-do="unsuspend">Reativar conta</button></div>` : html`
                    <p class="field-hint">O perfil some para as outras pessoas e a conta não pode seguir nem denunciar. A biblioteca continua guardada.</p>
                    <div class="field">
                        <label for="mm-why">Motivo <span class="muted">(a pessoa vê este texto)</span></label>
                        <textarea id="mm-why" class="textarea" rows="2" maxlength="300"></textarea>
                    </div>
                    <div><button type="button" class="button button-danger" data-do="suspend">Suspender</button></div>`}
            </section>

            ${roles.length ? html`
            <section class="manage-section" aria-labelledby="mm-role">
                <h3 id="mm-role">Cargo</h3>
                <form class="input-row" data-form="role" novalidate>
                    <label class="sr-only" for="mm-role-select">Cargo</label>
                    <select id="mm-role-select" class="select">
                        ${roles.map((r) => html`<option value="${r}" ${r === member.role ? 'selected' : ''}>${ROLES[r].long}</option>`)}
                    </select>
                    <button type="submit" class="button button-secondary">Salvar cargo</button>
                </form>
                <p class="field-hint">Você só pode conceder cargos menores que o seu. A Dona só se define pelo banco de dados.</p>
            </section>` : ''}`}
            <p class="field-error" data-error role="alert" hidden></p>
            <div class="modal-footer"><button type="button" class="button button-ghost" data-modal-close>Fechar</button></div>
        </div>`);

    const error = content.querySelector('[data-error]');
    const modal = openModal({ title: 'Gerenciar pessoa', iconName: 'shield', size: 'md', content });
    if (!allowed) return modal;

    async function act(task, okMessage) {
        error.hidden = true;
        content.querySelectorAll('button').forEach((b) => { b.dataset.wasDisabled = b.disabled ? '1' : ''; b.disabled = true; });
        try {
            await task();
            toast(typeof okMessage === 'function' ? okMessage() : okMessage, { type: 'success' });
            modal.close();
            onChanged?.();
        } catch (err) {
            console.error(err);
            content.querySelectorAll('button').forEach((b) => { b.disabled = b.dataset.wasDisabled === '1'; });
            error.textContent = messageOf(err, 'Não foi possível concluir.');
            error.hidden = false;
        }
    }

    const resetBtn = content.querySelector('[data-do="reset"]');
    const wipeBtn = content.querySelector('[data-do="wipe"]');
    const checked = () => [...content.querySelectorAll('[data-reset]:checked')].map((c) => c.dataset.reset);
    const checkedWipe = () => [...content.querySelectorAll('[data-wipe-field]:checked')].map((c) => c.dataset.wipeField);
    content.addEventListener('change', (e) => {
        if (!(e.target instanceof Element)) return;
        if (e.target.matches('[data-reset]')) resetBtn.disabled = checked().length === 0;
        if (e.target.matches('[data-wipe-field]')) wipeBtn.disabled = checkedWipe().length === 0;
    });

    content.addEventListener('click', async (e) => {
        const btn = e.target instanceof Element ? e.target.closest('[data-do]') : null;
        if (!btn) return;
        switch (btn.dataset.do) {
            case 'reset': {
                const fields = checked();
                if (!fields.length) return;
                const yes = await confirmDialog({
                    title: 'Restaurar dados do perfil',
                    message: `Restaurar ${fields.map((f) => FIELD_NAMES[f]).join(', ')} de @${member.username}? Isso não tem como desfazer, mas fica no registro de ações.`,
                    confirmLabel: 'Restaurar', danger: true,
                });
                if (yes) await act(() => moderation.resetProfile(member.id, fields), 'Perfil restaurado.');
                break;
            }
            case 'media': {
                const yes = await confirmDialog({
                    title: 'Zerar foto e fundo',
                    message: `Tirar a foto de perfil e a imagem de fundo de @${member.username}? Isso não tem como desfazer, mas fica no registro de ações. A pessoa pode colocar outras depois.`,
                    confirmLabel: 'Zerar', danger: true,
                });
                if (yes) await act(() => moderation.resetProfile(member.id, ['avatar', 'background']), 'Foto e fundo zerados.');
                break;
            }
            case 'wipe': {
                const fields = checkedWipe();
                if (!fields.length) return;
                const yes = await confirmDialog({
                    title: 'Remover conteúdo',
                    message: `Remover ${fields.map((f) => WIPE_NAMES[f]).join(', ')} de @${member.username}? O texto vira “${REMOVED_MARK}” (tags ficam vazias). Progresso, notas e status não mudam. Isso não tem como desfazer, mas fica no registro de ações.`,
                    confirmLabel: 'Remover', danger: true,
                });
                if (!yes) break;
                let changed = 0;
                await act(async () => { changed = await moderation.wipeText(member.id, fields); },
                    () => (changed > 0 ? 'Conteúdo removido.' : 'Nada para remover: já estava removido ou vazio.'));
                break;
            }
            case 'suspend': {
                const why = content.querySelector('#mm-why').value.trim();
                const yes = await confirmDialog({ title: 'Suspender conta', message: `Suspender @${member.username}? O perfil some para as outras pessoas até a conta ser reativada.`, confirmLabel: 'Suspender', danger: true });
                if (yes) await act(() => moderation.setSuspended(member.id, true, why), 'Conta suspensa.');
                break;
            }
            case 'unsuspend':
                await act(() => moderation.setSuspended(member.id, false), 'Conta reativada.');
                break;
            default: break;
        }
    });

    content.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target instanceof Element ? e.target.closest('[data-form]') : null;
        if (!form) return;
        if (form.dataset.form === 'rename') {
            const name = content.querySelector('#mm-name').value.trim();
            if (!name) { error.textContent = 'Escreva o novo nome.'; error.hidden = false; return; }
            await act(() => moderation.rename(member.id, name), 'Nome alterado.');
        } else if (form.dataset.form === 'role') {
            const role = content.querySelector('#mm-role-select').value;
            if (role === member.role) { error.textContent = 'Esta pessoa já tem esse cargo.'; error.hidden = false; return; }
            await act(() => moderation.setRole(member.id, role), role === 'member' ? 'Cargo removido.' : `Cargo: ${ROLES[role].long}.`);
        }
    });
    return modal;
}
