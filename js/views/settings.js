// Configurações: perfil e privacidade, conta e dados (backup).
import { config } from '../config.js';
import { copyText, debounce, downloadBlob, html, on, setHtml } from '../core/dom.js';
import { choiceDialog, typedConfirmDialog } from '../core/dialogs.js';
import { messageOf } from '../core/errors.js';
import { icon, spinner } from '../core/icons.js';
import { navigate } from '../core/router.js';
import { toast } from '../core/toast.js';
import { buildBackup, parseBackup, readLegacyEntries } from '../domain/backup.js';
import { backend, isCloud, refreshSession, setProfile, state } from '../services/session.js';

const USERNAME_RX = /^[a-z0-9_]{3,20}$/;
const MAX_BACKUP_BYTES = 8 * 1024 * 1024;
const publicLink = (u) => `${location.origin}${location.pathname}#/u/${u}`;

function profilePanel(p) {
    return html`
    <section class="panel glass-panel" aria-labelledby="st-profile">
        <h2 id="st-profile">${icon('user')} Perfil e privacidade</h2>
        <form data-profile-form novalidate>
            <div class="field">
                <label for="st-username">Nome de usuário</label>
                <input id="st-username" class="input" maxlength="20" autocomplete="username" autocapitalize="none" spellcheck="false" value="${p.username}">
                <p class="username-status" data-username-status aria-live="polite"></p>
                <p class="field-hint">Ao mudar, o link antigo do seu perfil deixa de funcionar.</p>
            </div>
            <div class="field">
                <label for="st-display">Nome de exibição</label>
                <input id="st-display" class="input" maxlength="40" autocomplete="nickname" value="${p.displayName}">
            </div>
            <div class="field">
                <label for="st-bio">Bio</label>
                <textarea id="st-bio" class="textarea" maxlength="200" rows="3" placeholder="Conte um pouco sobre você e seus animes favoritos...">${p.bio}</textarea>
                <p class="field-hint" data-bio-count aria-live="off">${p.bio.length}/200</p>
            </div>
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
            <button type="submit" class="button button-primary" data-save>Salvar perfil</button>
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
    </section>

    <section class="panel glass-panel danger-zone" aria-labelledby="st-danger">
        <h2 id="st-danger">${icon('alert')} Zona de perigo</h2>
        <p class="muted small">Excluir a conta apaga <strong>para sempre</strong> o seu perfil e todas as suas obras. Não dá para desfazer. Se quiser guardar a lista, exporte um backup antes.</p>
        <button type="button" class="button button-danger" data-act="delete-account">${icon('trash', { size: 17 })} Excluir minha conta</button>
    </section>`;

function dataPanel(cloud, legacyCount) {
    return html`
    <section class="panel glass-panel" aria-labelledby="st-data">
        <h2 id="st-data">${icon('download')} Seus dados</h2>
        <p class="muted small">Faça backup da sua biblioteca em um arquivo JSON, ou restaure um backup (inclusive o da versão antiga do site).</p>
        <div class="row">
            <button type="button" class="button button-secondary" data-act="export">${icon('download', { size: 17 })} Exportar backup</button>
            <label class="button button-secondary" style="cursor:pointer">${icon('upload', { size: 17 })} Importar backup
                <input type="file" accept=".json,application/json" data-import class="sr-only"></label>
        </div>
        ${cloud && legacyCount ? html`
            <div class="notice-box">${icon('upload')}<div>
                Há <strong>${legacyCount}</strong> ${legacyCount === 1 ? 'obra salva' : 'obras salvas'} neste navegador (versão antiga do site).
                <div class="notice-actions"><button type="button" class="button button-primary button-sm" data-act="import-legacy">Importar para minha conta</button></div>
            </div></div>` : ''}
    </section>`;
}

export function mount(root) {
    document.title = `Configurações · ${config.siteName}`;
    const be = backend();
    const cloud = isCloud();
    const profile = state.profile;

    if (cloud && !profile) {
        setHtml(root, html`<div class="glass-panel empty-state">${icon('alert', { size: 40 })}<h3>Perfil não encontrado</h3>
            <p>Não conseguimos carregar o seu perfil. Verifique se o arquivo <code>sql/schema.sql</code> foi executado no Supabase.</p></div>`);
        return;
    }

    setHtml(root, html`
        <header class="page-head">
            <div>
                <span class="eyebrow">${icon('sliders', { size: 14 })} ${cloud ? 'Conta' : 'Modo local'}</span>
                <h1 style="margin-top:10px">${cloud ? 'Perfil e configurações' : 'Ajustes'}</h1>
            </div>
            ${cloud && profile ? html`<div class="page-head-actions"><a class="button button-secondary" href="#/u/${profile.username}">${icon('globe', { size: 17 })} Ver meu perfil</a></div>` : ''}
        </header>
        ${!cloud ? html`<div class="notice-box">${icon('info')}<div>Login e perfis públicos estão desativados porque o Supabase ainda não foi configurado. Siga o <code>README.md</code> para ativar.</div></div>` : ''}
        <div class="settings-grid">
            ${cloud ? profilePanel(profile) : ''}
            <div class="stack">
                ${cloud ? accountPanel(state.user?.email) : ''}
                ${dataPanel(cloud, cloud ? readLegacyEntries().length : 0)}
            </div>
        </div>`);

    const $ = (s) => root.querySelector(s);
    const offs = [];

    // --- perfil -----------------------------------------------------------------------
    if (cloud) {
        const usernameInput = $('#st-username');
        const status = $('[data-username-status]');
        const bio = $('#st-bio');
        const linkBox = $('[data-link-box]');
        let usernameOk = true;
        let token = 0;

        const renderLink = (p) => setHtml(linkBox, p.isPublic ? html`
            <div class="field"><span class="field-label">Link do seu perfil</span>
                <div class="copy-field"><input class="input" readonly value="${publicLink(p.username)}" aria-label="Link do seu perfil" data-link>
                <button type="button" class="button button-secondary" data-act="copy">${icon('copy', { size: 16 })}</button></div></div>` : '');
        renderLink(profile);

        const check = debounce(async (value) => {
            const mine = ++token;
            if (value === state.profile.username) { status.textContent = ''; status.className = 'username-status'; usernameOk = true; return; }
            if (!USERNAME_RX.test(value)) { status.textContent = 'Use 3 a 20 caracteres: a-z, 0-9 e _'; status.className = 'username-status bad'; usernameOk = false; return; }
            const free = await be.auth.usernameAvailable(value);
            if (mine !== token) return;
            usernameOk = free !== false;
            status.textContent = free === null ? '' : free ? 'Disponível ✓' : 'Já está em uso';
            status.className = 'username-status ' + (free === true ? 'ok' : free === false ? 'bad' : '');
        }, 350);

        usernameInput.addEventListener('input', () => {
            usernameInput.value = usernameInput.value.toLowerCase().replace(/\s/g, '');
            check(usernameInput.value);
        });
        bio.addEventListener('input', () => { $('[data-bio-count]').textContent = `${bio.value.length}/200`; });

        $('[data-profile-form]').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = usernameInput.value.trim().toLowerCase();
            if (!USERNAME_RX.test(username)) { toast('Nome de usuário inválido: use 3 a 20 caracteres (a-z, 0-9 e _).', { type: 'error' }); usernameInput.focus(); return; }
            if (!usernameOk) { toast('Esse nome de usuário já está em uso.', { type: 'error' }); usernameInput.focus(); return; }

            const btn = $('[data-save]');
            btn.disabled = true;
            setHtml(btn, html`${spinner(17)} Salvando...`);
            try {
                const updated = await be.profiles.updateMine({
                    username,
                    displayName: $('#st-display').value.trim() || username,
                    bio: bio.value,
                    isPublic: $('#st-public').checked,
                    showNotes: $('#st-notes').checked,
                });
                setProfile(updated);
                renderLink(updated);
                toast('Perfil salvo!', { type: 'success' });
            } catch (err) {
                console.error(err);
                toast(messageOf(err), { type: 'error' });
            } finally {
                btn.disabled = false;
                btn.textContent = 'Salvar perfil';
            }
        });

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

        offs.push(() => check.cancel());
    }

    // --- cliques (copiar, sair, exportar, importar do navegador) -------------------------
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
            case 'export':
                try {
                    const list = await be.library.listMine();
                    downloadBlob(new Blob([buildBackup(list)], { type: 'application/json' }), `kamylist-backup-${new Date().toISOString().slice(0, 10)}.json`);
                    toast(`Backup com ${list.length} obras exportado.`, { type: 'success' });
                } catch (err) {
                    toast(messageOf(err, 'Não foi possível exportar.'), { type: 'error' });
                }
                break;
            case 'delete-account': {
                const username = state.profile?.username || '';
                let total = 0;
                try { total = (await be.library.listMine()).length; } catch { /* segue sem a contagem */ }
                const sure = await typedConfirmDialog({
                    title: 'Excluir minha conta',
                    message: `Isso apaga para sempre a conta ${state.user?.email || ''}, o perfil @${username}${total ? ` e as ${total} ${total === 1 ? 'obra' : 'obras'} da sua biblioteca` : ' e todas as obras'}.\n\nNão dá para desfazer. (Dica: exporte um backup antes.)`,
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
            case 'import-legacy': {
                btn.disabled = true;
                try {
                    const created = await be.library.addMany(readLegacyEntries());
                    toast(`${created.length} obras importadas para a sua conta!`, { type: 'success' });
                    btn.closest('.notice-box').remove();
                } catch (err) {
                    btn.disabled = false;
                    toast(messageOf(err, 'Não foi possível importar.'), { type: 'error' });
                }
                break;
            }
            default: break;
        }
    }));

    // --- importar arquivo de backup -----------------------------------------------------------
    offs.push(on(root, 'change', 'input[data-import]', async (_, input) => {
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;
        if (file.size > MAX_BACKUP_BYTES) { toast('Arquivo grande demais para um backup.', { type: 'error' }); return; }
        try {
            const entries = parseBackup(await file.text());
            const choice = await choiceDialog({
                title: 'Importar backup',
                iconName: 'upload',
                message: `O arquivo tem ${entries.length} ${entries.length === 1 ? 'obra' : 'obras'}.\n\nAdicionar às obras que você já tem, ou substituir tudo pelo conteúdo do arquivo? (Dica: exporte um backup antes de substituir.)`,
                choices: [
                    { value: null, label: 'Cancelar', variant: 'ghost' },
                    { value: 'replace', label: 'Substituir tudo', variant: 'danger' },
                    { value: 'add', label: 'Adicionar', variant: 'primary' },
                ],
            });
            if (!choice) return;
            if (choice === 'replace') await be.library.replaceAll(entries);
            else await be.library.addMany(entries);
            toast(choice === 'replace' ? 'Backup restaurado com sucesso!' : `${entries.length} obras adicionadas!`, { type: 'success' });
        } catch (err) {
            console.error(err);
            toast(messageOf(err, 'Não foi possível importar o arquivo.'), { type: 'error' });
        }
    }));

    return () => offs.forEach((off) => off());
}
