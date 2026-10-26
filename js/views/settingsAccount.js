// Conta > Configurações: privacidade, e-mail e senha, backup e exclusão da conta.
import { config } from '../config.js';
import { copyText, html, on, setHtml } from '../core/dom.js';
import { typedConfirmDialog } from '../core/dialogs.js';
import { messageOf } from '../core/errors.js';
import { icon, spinner } from '../core/icons.js';
import { navigate } from '../core/router.js';
import { toast } from '../core/toast.js';
import { backend, isCloud, refreshSession, setProfile, state } from '../services/session.js';
import { bindDataPanel, dataPanelHtml } from '../ui/dataPanel.js';
import { guardTabs, settingsHeader } from '../ui/settingsShell.js';

const publicLink = (u) => `${location.origin}${location.pathname}#/u/${u}`;

function privacyPanel(p) {
    return html`
    <section class="panel glass-panel" aria-labelledby="st-privacy">
        <h2 id="st-privacy">${icon('globe')} Privacidade</h2>
        <form data-privacy-form novalidate>
            <label class="switch-row">
                <input type="checkbox" id="st-public" ${p.isPublic ? 'checked' : ''}>
                <span><span class="switch-title">Perfil público</span><br>
                <span class="switch-desc">Qualquer pessoa com o link (e quem usar a página Explorar) vê sua lista de obras.</span></span>
            </label>
            <label class="switch-row">
                <input type="checkbox" id="st-notes" ${p.showNotes ? 'checked' : ''}>
                <span><span class="switch-title">Mostrar minhas anotações</span><br>
                <span class="switch-desc">Por padrão o seu diário fica só para você, mesmo com o perfil público.</span></span>
            </label>
            <div data-link-box></div>
            <button type="submit" class="button button-primary" data-save>Salvar privacidade</button>
        </form>
    </section>`;
}

const accountPanel = (email) => html`
    <section class="panel glass-panel" aria-labelledby="st-account">
        <h2 id="st-account">${icon('lock')} Conta</h2>
        <div class="field"><span class="field-label">E-mail</span><p style="overflow-wrap:anywhere">${email || '—'}</p></div>
        <form data-password-form novalidate>
            <div class="field">
                <label for="st-pass">Nova senha</label>
                <input id="st-pass" class="input" type="password" minlength="8" autocomplete="new-password" placeholder="Mínimo de 8 caracteres">
            </div>
            <div class="field">
                <label for="st-pass2">Repita a nova senha</label>
                <input id="st-pass2" class="input" type="password" minlength="8" autocomplete="new-password">
            </div>
            <button type="submit" class="button button-secondary" data-pass-save>Trocar senha</button>
        </form>
        <hr style="border:0;border-top:1px solid var(--card-border);width:100%;margin:0">
        <button type="button" class="button button-secondary" data-act="logout">${icon('logOut', { size: 17 })} Sair da conta</button>
    </section>`;

const dangerPanel = () => html`
    <section class="panel glass-panel danger-zone" aria-labelledby="st-danger">
        <h2 id="st-danger">${icon('alert')} Zona de perigo</h2>
        <p class="muted small">Excluir a conta apaga <strong>para sempre</strong> o seu perfil, a sua foto e todas as suas obras. Não dá para desfazer. Se quiser guardar a lista, exporte um backup antes.</p>
        <button type="button" class="button button-danger" data-act="delete-account">${icon('trash', { size: 17 })} Excluir minha conta</button>
    </section>`;

export function mount(root) {
    if (!isCloud()) { navigate('/configuracoes', { replace: true }); return; }   // sem login só existe a tela de ajustes
    document.title = `Configurações · ${config.siteName}`;

    const be = backend();
    const profile = state.profile;
    if (!profile) {
        setHtml(root, html`<div class="glass-panel empty-state">${icon('alert', { size: 40 })}<h3>Perfil não encontrado</h3>
            <p>Não conseguimos carregar o seu perfil. Verifique se o arquivo <code>sql/schema.sql</code> foi executado no Supabase.</p></div>`);
        return;
    }

    setHtml(root, html`
        ${settingsHeader({ profile, active: 'configuracoes' })}
        <div class="settings-grid">
            <div class="stack">
                ${privacyPanel(profile)}
                ${accountPanel(state.user?.email)}
            </div>
            <div class="stack">
                ${dataPanelHtml(true)}
                ${dangerPanel()}
            </div>
        </div>`);

    const $ = (s) => root.querySelector(s);
    const offs = [bindDataPanel(root, be)];
    const linkBox = $('[data-link-box]');

    const renderLink = (p) => setHtml(linkBox, p.isPublic ? html`
        <div class="field"><span class="field-label">Link do seu perfil</span>
            <div class="copy-field"><input class="input" readonly value="${publicLink(p.username)}" aria-label="Link do seu perfil" data-link>
            <button type="button" class="button button-secondary" data-act="copy" aria-label="Copiar link">${icon('copy', { size: 16 })}</button></div></div>` : '');
    renderLink(profile);

    // --- privacidade ------------------------------------------------------------------------
    $('[data-privacy-form]').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = $('[data-save]');
        btn.disabled = true;
        setHtml(btn, html`${spinner(17)} Salvando...`);
        try {
            const updated = await be.profiles.updateMine({
                isPublic: $('#st-public').checked,
                showNotes: $('#st-notes').checked,
            });
            setProfile(updated);
            renderLink(updated);
            toast('Privacidade salva!', { type: 'success' });
        } catch (err) {
            console.error(err);
            toast(messageOf(err), { type: 'error' });
        } finally {
            btn.disabled = false;
            btn.textContent = 'Salvar privacidade';
        }
    });

    // --- senha ----------------------------------------------------------------------------------
    $('[data-password-form]').addEventListener('submit', async (e) => {
        e.preventDefault();
        const p1 = $('#st-pass').value;
        if (p1.length < 8) { toast('A senha precisa ter pelo menos 8 caracteres.', { type: 'error' }); return; }
        if (p1 !== $('#st-pass2').value) { toast('As senhas não conferem.', { type: 'error' }); return; }
        const btn = $('[data-pass-save]');
        btn.disabled = true;
        try {
            await be.auth.updatePassword(p1);
            $('#st-pass').value = '';
            $('#st-pass2').value = '';
            toast('Senha alterada com sucesso!', { type: 'success' });
        } catch (err) {
            toast(messageOf(err), { type: 'error' });
        } finally {
            btn.disabled = false;
        }
    });

    // --- cliques: copiar link, sair, excluir conta -----------------------------------------------
    offs.push(on(root, 'click', '[data-act]', async (_, btn) => {
        switch (btn.dataset.act) {
            case 'copy': {
                const ok = await copyText(root.querySelector('[data-link]').value);
                toast(ok ? 'Link copiado!' : 'Não foi possível copiar o link.', { type: ok ? 'success' : 'error' });
                break;
            }
            case 'logout':
                btn.disabled = true;
                try {
                    await be.auth.signOut();
                    await refreshSession();
                    navigate('/');
                    toast('Você saiu da conta.', { type: 'info' });
                } catch (err) {
                    btn.disabled = false;
                    toast(messageOf(err), { type: 'error' });
                }
                break;
            case 'delete-account': {
                const username = state.profile?.username || '';
                let total = 0;
                try { total = (await be.library.listMine()).length; } catch { /* segue sem a contagem */ }
                const sure = await typedConfirmDialog({
                    title: 'Excluir minha conta',
                    message: `Isso apaga para sempre a conta ${state.user?.email || ''}, o perfil @${username}, a sua foto${total ? ` e as ${total} ${total === 1 ? 'obra' : 'obras'} da sua biblioteca` : ' e todas as obras'}.\n\nNão dá para desfazer. (Dica: exporte um backup antes.)`,
                    expected: username,
                    confirmLabel: 'Excluir para sempre',
                });
                if (!sure) break;
                btn.disabled = true;
                try {
                    await be.auth.deleteAccount();
                    await refreshSession();
                    navigate('/');
                    toast('Sua conta foi excluída.', { type: 'info' });
                } catch (err) {
                    console.error(err);
                    btn.disabled = false;
                    toast(messageOf(err, 'Não foi possível excluir a conta.'), { type: 'error' });
                }
                break;
            }
            default: break;
        }
    }));

    // --- sair da aba com alterações não salvas -----------------------------------------------
    const isDirty = () => $('#st-public').checked !== state.profile.isPublic
        || $('#st-notes').checked !== state.profile.showNotes
        || Boolean($('#st-pass').value || $('#st-pass2').value);
    offs.push(guardTabs(root, isDirty));

    return () => offs.forEach((off) => off());
}
