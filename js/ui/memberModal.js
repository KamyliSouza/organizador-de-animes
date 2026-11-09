// Gerenciar uma pessoa (equipe): restaurar dados do perfil, remover conteúdo, renomear, avisos, privacidade forçada,
// suspender ou banir, ver o histórico de punições da conta e mudar o cargo. Cada ação chama uma função do banco que confere o cargo de novo; esconder botão aqui é só conforto.
import { el, html, setHtml } from '../core/dom.js';
import { confirmDialog } from '../core/dialogs.js';
import { messageOf } from '../core/errors.js';
import { icon, spinner } from '../core/icons.js';
import { openModal } from '../core/modal.js';
import { timeAgo } from '../core/time.js';
import { toast } from '../core/toast.js';
import { AUTO_SUSPEND_DAYS, BAN_KEY, STRIKE_LIMIT, SUSPEND_PRESETS, strikeCountText, suspensionLabel } from '../domain/access.js';
import { WIPE_FIELDS, REMOVED_MARK } from '../domain/reportSnapshot.js';
import { historyView } from '../domain/reportContext.js';
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
const STRIKE_STATUS = { active: 'Ativo', revoked: 'Retirado', used: 'Usado na suspensão' };

/** Situação da conta (suspensão, travas, avisos): a lista de membros já traz; vindo de outra tela, o modal busca. */
const hasDetails = (m) => m && typeof m.activeStrikes === 'number' && 'suspensionKind' in m;

/**
 * @param {object} opts
 * @param {{id: string, username: string, displayName: string, avatarV?: number, role: string, suspended: boolean, suspensionReason?: string}} opts.member
 *   Pode ser só o básico (denúncia, perfil): a situação da conta (suspensão, travas e avisos) é buscada ao abrir.
 * @param {string} opts.actorRole  cargo de quem está usando o painel
 * @param {object} opts.moderation  backend.moderation
 * @param {() => void} [opts.onChanged]  chamado depois de uma ação que deu certo
 */
export function openMemberModal({ member, actorRole, moderation, onChanged }) {
    const allowed = canAct(actorRole, member.role);
    const roles = allowed ? grantableRoles(actorRole) : [];
    const mayBan = rankOf(actorRole) >= 2;
    let current = member;

    const header = html`
        <div class="admin-who">
            ${avatar(member.displayName || member.username, 46, avatarSrc(member))}
            <span class="person-names">
                <span class="name-line"><b class="truncate">${member.displayName}</b>${roleBadge(member.role)}</span>
                <span class="muted small truncate">@${member.username}</span>
            </span>
        </div>
        <div class="admin-flags" data-flags></div>`;

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

            <div class="stack" data-dynamic aria-live="polite"><div class="center muted" style="padding:14px 0">${spinner(22)}</div></div>

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
    if (!allowed) {
        paintFlags(current);
        return modal;
    }

    // --- situação da conta: bandeiras do topo e as seções de avisos, privacidade e suspensão ---------------------------
    function flagsHtml(m) {
        const items = [];
        if (m.suspended) items.push(html`<span class="badge badge-danger">${hasDetails(m) ? suspensionLabel(m.suspensionKind, m.suspensionEnds) : 'Conta suspensa'}</span>`);
        if (m.activeStrikes > 0) items.push(html`<span class="badge badge-planned">Avisos ${strikeCountText(m.activeStrikes)}</span>`);
        if (m.forcePrivateProfile) items.push(html`<span class="badge badge-muted">${icon('lock', { size: 11 })} Perfil travado</span>`);
        if (m.forcePrivateNotes) items.push(html`<span class="badge badge-muted">${icon('lock', { size: 11 })} Anotações travadas</span>`);
        return items;
    }
    function paintFlags(m) {
        const box = content.querySelector('[data-flags]');
        const items = flagsHtml(m);
        if (items.length) setHtml(box, html`${items}`); else box.replaceChildren();
        box.hidden = items.length === 0;
    }

    const suspendSection = (m) => m.suspended ? html`
        <section class="manage-section" aria-labelledby="mm-sus">
            <h3 id="mm-sus">${m.suspensionKind === 'ban' ? 'Conta banida' : 'Conta suspensa'}</h3>
            <p class="small" data-sus-status><strong>${suspensionLabel(m.suspensionKind, m.suspensionEnds)}.</strong></p>
            ${m.suspensionReason ? html`<p class="small">Motivo: ${m.suspensionReason}</p>` : ''}
            <div><button type="button" class="button button-secondary" data-do="unsuspend">Reativar conta</button></div>
        </section>` : html`
        <section class="manage-section" aria-labelledby="mm-sus">
            <h3 id="mm-sus">Suspender ou banir</h3>
            <p class="field-hint">O perfil some para as outras pessoas e a conta passa a ver só uma tela de aviso (com o motivo, o prazo e o link do Discord). A biblioteca continua guardada e a pessoa pode baixar um backup. Passado o prazo, a conta volta sozinha.</p>
            <div class="field">
                <label for="mm-term">Prazo</label>
                <select id="mm-term" class="select" data-term>
                    ${SUSPEND_PRESETS.map((p) => html`<option value="${p.key}" ${p.key === '7' ? 'selected' : ''}>${p.label}</option>`)}
                    ${mayBan ? html`<option value="${BAN_KEY}">Banir (sem volta; só a equipe reativa)</option>` : ''}
                </select>
                ${mayBan ? '' : html`<span class="field-hint">Banir é com a Administração e a Dona.</span>`}
            </div>
            <div class="field">
                <label for="mm-why">Motivo <span class="muted">(a pessoa vê este texto)</span></label>
                <textarea id="mm-why" class="textarea" rows="2" maxlength="300"></textarea>
            </div>
            <div><button type="button" class="button button-danger" data-do="suspend" data-suspend-btn>Suspender</button></div>
        </section>`;

    const limitsSection = (m) => html`
        <section class="manage-section" aria-labelledby="mm-limits">
            <h3 id="mm-limits">Privacidade forçada</h3>
            <p class="field-hint">Mantém o perfil e/ou as anotações sempre privados nesta conta. A pessoa continua vendo o próprio conteúdo, mas não consegue ligar de novo (a tela de Privacidade mostra a trava e o motivo). Tirar a trava não liga nada sozinho: a opção só volta a ficar com a pessoa.</p>
            <label class="check-row"><input type="checkbox" data-limit="profile" ${m.forcePrivateProfile ? 'checked' : ''}><span>Perfil sempre privado <span class="muted small">(sai do Explorar e do feed e fica só para quem a pessoa aprovou)</span></span></label>
            <label class="check-row"><input type="checkbox" data-limit="notes" ${m.forcePrivateNotes ? 'checked' : ''}><span>Anotações sempre privadas <span class="muted small">(as análises não entram nesta trava)</span></span></label>
            <div class="field">
                <label for="mm-limit-why">Motivo <span class="muted">(a pessoa vê este texto)</span></label>
                <input id="mm-limit-why" class="input" maxlength="300" autocomplete="off" value="${m.forceReason}">
            </div>
            <div><button type="button" class="button button-secondary" data-do="limits">Salvar privacidade forçada</button></div>
        </section>`;

    const strikesSection = (m) => html`
        <section class="manage-section" aria-labelledby="mm-strikes">
            <h3 id="mm-strikes">Avisos <span class="badge ${m.activeStrikes > 0 ? 'badge-planned' : 'badge-muted'}" data-strike-count>${strikeCountText(m.activeStrikes)}</span></h3>
            <p class="field-hint">Cada aviso ativo aparece num banner fixo, em todas as telas, para a pessoa. No ${STRIKE_LIMIT}º aviso ativo a conta é suspensa por ${AUTO_SUSPEND_DAYS} dias e o contador recomeça.</p>
            <div data-strike-list><div class="center muted" style="padding:8px 0">${spinner(18)}</div></div>
            ${m.suspended ? html`<p class="field-hint">Conta suspensa ou banida não recebe aviso.</p>` : html`
            <div class="field">
                <label for="mm-strike-why">Motivo do aviso <span class="muted">(a pessoa vê este texto)</span></label>
                <textarea id="mm-strike-why" class="textarea" rows="2" maxlength="300"></textarea>
            </div>
            <div><button type="button" class="button button-secondary" data-do="strike">Dar um aviso</button></div>`}
        </section>`;

    // --- histórico de punições (Patch 20): avisos, suspensões, banimentos, travas e ajustes de conteúdo, do mais novo para o mais antigo ---
    const HISTORY_PAGE = 10;
    let historyRows = [];
    let historyMore = false;
    const historySection = html`
        <section class="manage-section" aria-labelledby="mm-history">
            <h3 id="mm-history">Histórico de punições</h3>
            <p class="field-hint">Avisos, suspensões, banimentos, travas de privacidade e o que foi restaurado ou removido nesta conta, do mais novo para o mais antigo. Quando a ação veio de uma denúncia, o número aparece junto.</p>
            <div data-history-list><div class="center muted" style="padding:8px 0">${spinner(18)}</div></div>
        </section>`;

    function paintHistory() {
        const box = content.querySelector('[data-history-list]');
        if (!box) return;
        if (!historyRows.length) { setHtml(box, html`<p class="muted small" data-history-empty>Nenhuma punição registrada para esta conta.</p>`); return; }
        setHtml(box, html`
            <ul class="history-list">${historyRows.map((row) => {
                const v = historyView(row);
                return html`
                <li class="history-item ${v.punishment ? 'is-punishment' : ''}" data-history="${row.id}">
                    <span class="history-title">${v.title}</span>
                    ${v.extra ? html`<span class="history-extra">${v.extra}</span>` : ''}
                    <span class="muted small">${v.actor ? html`por ${v.actor} · ` : ''}${timeAgo(row.at)}${v.ref ? html` · ${v.ref}` : ''}</span>
                </li>`;
            })}</ul>
            ${historyMore ? html`<div><button type="button" class="button button-ghost button-sm" data-history-more>Mostrar mais</button></div>` : ''}`);
    }

    async function loadHistory({ append = false } = {}) {
        if (!content.querySelector('[data-history-list]')) return;
        try {
            const got = await moderation.accountHistory(member.id, { limit: HISTORY_PAGE, before: append ? historyRows[historyRows.length - 1]?.id : null });
            if (!content.isConnected) return;
            historyRows = append ? [...historyRows, ...got] : got;
            historyMore = got.length === HISTORY_PAGE;
            paintHistory();
        } catch (err) {
            console.error(err);
            const box = content.querySelector('[data-history-list]');
            if (box) setHtml(box, html`<p class="field-error">${messageOf(err, 'Não foi possível carregar o histórico.')}</p>`);
        }
    }
    content.addEventListener('click', (ev) => {
        const btn = ev.target instanceof Element ? ev.target.closest('[data-history-more]') : null;
        if (btn && content.contains(btn)) { btn.disabled = true; loadHistory({ append: true }); }
    });

    function paintDynamic(m) {
        current = m;
        setHtml(content.querySelector('[data-dynamic]'), html`${strikesSection(m)}${limitsSection(m)}${suspendSection(m)}${historySection}`);
        paintFlags(m);
        loadStrikes();
        loadHistory();
    }

    async function loadStrikes() {
        const box = content.querySelector('[data-strike-list]');
        if (!box) return;
        try {
            const rows = await moderation.strikes(member.id);
            if (!content.isConnected || !content.querySelector('[data-strike-list]')) return;
            setHtml(content.querySelector('[data-strike-list]'), rows.length ? html`
                <ul class="strike-history">${rows.map((r) => html`
                    <li class="strike-item is-${r.status}">
                        <span class="strike-main"><span class="strike-reason">${r.reason}</span>
                            <span class="muted small">${STRIKE_STATUS[r.status]} · ${timeAgo(r.givenAt)}${r.givenBy ? html` · por @${r.givenBy}` : ''}</span></span>
                        ${r.status === 'active' ? html`<button type="button" class="button button-ghost button-sm" data-revoke="${r.id}">Retirar</button>` : ''}
                    </li>`)}</ul>` : html`<p class="muted small">Nenhum aviso até agora.</p>`);
        } catch (err) {
            console.error(err);
            const target = content.querySelector('[data-strike-list]');
            if (target) setHtml(target, html`<p class="field-error">${messageOf(err, 'Não foi possível carregar os avisos.')}</p>`);
        }
    }

    (async () => {
        let m = member;
        if (!hasDetails(member)) {
            try {
                const rows = await moderation.members({ query: member.username, limit: 100 });
                const found = rows.find((r) => r.id === member.id);
                if (found) m = { ...member, ...found };
            } catch (err) {
                console.error(err);
                const dyn = content.querySelector('[data-dynamic]');
                if (dyn) setHtml(dyn, html`<p class="field-error">${messageOf(err, 'Não foi possível carregar a situação da conta.')}</p>`);
                return;
            }
        }
        if (!hasDetails(m)) m = { ...m, suspensionKind: m.suspended ? 'suspension' : '', suspensionEnds: '', forcePrivateProfile: false, forcePrivateNotes: false, forceReason: '', activeStrikes: 0 };
        if (content.isConnected) paintDynamic(m);
    })();

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

    const fail = (text) => { error.textContent = text; error.hidden = false; };

    const resetBtn = content.querySelector('[data-do="reset"]');
    const wipeBtn = content.querySelector('[data-do="wipe"]');
    const checked = () => [...content.querySelectorAll('[data-reset]:checked')].map((c) => c.dataset.reset);
    const checkedWipe = () => [...content.querySelectorAll('[data-wipe-field]:checked')].map((c) => c.dataset.wipeField);
    content.addEventListener('change', (e) => {
        if (!(e.target instanceof Element)) return;
        if (e.target.matches('[data-reset]')) resetBtn.disabled = checked().length === 0;
        if (e.target.matches('[data-wipe-field]')) wipeBtn.disabled = checkedWipe().length === 0;
        if (e.target.matches('[data-term]')) {
            const btn = content.querySelector('[data-suspend-btn]');
            if (btn) btn.textContent = e.target.value === BAN_KEY ? 'Banir conta' : 'Suspender';
        }
    });

    content.addEventListener('click', async (e) => {
        const target = e.target instanceof Element ? e.target : null;
        const revoke = target?.closest('[data-revoke]');
        if (revoke && content.contains(revoke)) {
            const yes = await confirmDialog({
                title: 'Retirar aviso',
                message: `Retirar este aviso de @${member.username}? Ele deixa de contar e some do banner da pessoa. Fica no registro de ações.`,
                confirmLabel: 'Retirar',
            });
            if (!yes) return;
            content.querySelectorAll('button').forEach((b) => { b.dataset.wasDisabled = b.disabled ? '1' : ''; b.disabled = true; });
            error.hidden = true;
            try {
                await moderation.revokeStrike(revoke.dataset.revoke);
                toast('Aviso retirado.', { type: 'success' });
                const next = { ...current, activeStrikes: Math.max(0, current.activeStrikes - 1) };
                paintDynamic(next);
                onChanged?.();
            } catch (err) {
                console.error(err);
                fail(messageOf(err, 'Não foi possível retirar o aviso.'));
            } finally {
                content.querySelectorAll('button').forEach((b) => { if ('wasDisabled' in b.dataset) b.disabled = b.dataset.wasDisabled === '1'; });
            }
            return;
        }

        const btn = target?.closest('[data-do]');
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
            case 'strike': {
                const why = content.querySelector('#mm-strike-why')?.value.trim() || '';
                if (!why) { fail('Escreva o motivo do aviso.'); break; }
                const third = (current.activeStrikes || 0) + 1 >= STRIKE_LIMIT;
                const yes = await confirmDialog({
                    title: 'Dar um aviso',
                    message: third
                        ? `Este será o ${STRIKE_LIMIT}º aviso ativo de @${member.username}: a conta será suspensa por ${AUTO_SUSPEND_DAYS} dias e o contador recomeça. Continuar?`
                        : `Dar um aviso a @${member.username}? A pessoa vê o motivo num banner em todas as telas (${strikeCountText((current.activeStrikes || 0) + 1)}).`,
                    confirmLabel: third ? 'Dar o aviso e suspender' : 'Dar o aviso', danger: third,
                });
                if (!yes) break;
                let res = { activeCount: 0, autoSuspended: false };
                await act(async () => { res = await moderation.giveStrike(member.id, why); },
                    () => (res.autoSuspended
                        ? `Aviso dado. Era o ${STRIKE_LIMIT}º: a conta foi suspensa por ${AUTO_SUSPEND_DAYS} dias.`
                        : `Aviso dado (${strikeCountText(res.activeCount)}).`));
                break;
            }
            case 'limits': {
                const profile = content.querySelector('[data-limit="profile"]').checked;
                const notes = content.querySelector('[data-limit="notes"]').checked;
                const reason = content.querySelector('#mm-limit-why').value.trim();
                if (profile === current.forcePrivateProfile && notes === current.forcePrivateNotes && (!(profile || notes) || reason === current.forceReason)) {
                    fail('Nada mudou na privacidade forçada.');
                    break;
                }
                await act(() => moderation.setLimits(member.id, { profile, notes, reason }),
                    profile || notes ? 'Privacidade forçada salva.' : 'Trava retirada. As opções voltam a ficar com a pessoa.');
                break;
            }
            case 'suspend': {
                const why = content.querySelector('#mm-why').value.trim();
                const term = content.querySelector('#mm-term').value;
                const ban = term === BAN_KEY;
                const preset = SUSPEND_PRESETS.find((p) => p.key === term) || SUSPEND_PRESETS[2];
                const yes = await confirmDialog({
                    title: ban ? 'Banir conta' : 'Suspender conta',
                    message: ban
                        ? `Banir @${member.username}? A conta perde o acesso ao site, o perfil some para as outras pessoas e só a equipe consegue reativar. Fica no registro de ações.`
                        : `Suspender @${member.username} ${preset.days ? `por ${preset.label}` : 'sem prazo'}? O perfil some para as outras pessoas ${preset.days ? 'e a conta volta sozinha no fim do prazo' : 'até a conta ser reativada'}.`,
                    confirmLabel: ban ? 'Banir' : 'Suspender', danger: true,
                });
                if (yes) await act(() => moderation.setSuspended(member.id, true, why, { days: ban ? null : preset.days, ban }), ban ? 'Conta banida.' : 'Conta suspensa.');
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
            if (!name) { fail('Escreva o novo nome.'); return; }
            await act(() => moderation.rename(member.id, name), 'Nome alterado.');
        } else if (form.dataset.form === 'role') {
            const role = content.querySelector('#mm-role-select').value;
            if (role === member.role) { fail('Esta pessoa já tem esse cargo.'); return; }
            await act(() => moderation.setRole(member.id, role), role === 'member' ? 'Cargo removido.' : `Cargo: ${ROLES[role].long}.`);
        }
    });
    return modal;
}
