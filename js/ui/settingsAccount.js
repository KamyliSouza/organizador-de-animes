// Configurações > Conta: e-mail, trocar a senha, sair da conta e a zona de perigo (excluir a conta).
import { html, on } from '../core/dom.js';
import { typedConfirmDialog } from '../core/dialogs.js';
import { messageOf } from '../core/errors.js';
import { icon } from '../core/icons.js';
import { navigate } from '../core/router.js';
import { toast } from '../core/toast.js';
import { refreshSession, state } from '../services/session.js';

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

/** O tema inteiro: o quadro da conta e, separado, a zona de perigo. */
export const accountThemeHtml = (email) => html`${accountPanel(email)}${dangerPanel()}`;

/** Liga o tema. `be` = backend. Devolve { off, isDirty } (senha digitada e não trocada conta como alteração). */
export function bindAccountTheme(root, be) {
    const $ = (s) => root.querySelector(s);
    const offs = [];

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

    // --- cliques: sair, excluir conta -----------------------------------------------
    offs.push(on(root, 'click', '[data-act]', async (_, btn) => {
        switch (btn.dataset.act) {
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


    const isDirty = () => Boolean($('#st-pass').value || $('#st-pass2').value);
    return { off: () => offs.forEach((off) => off()), isDirty };
}
