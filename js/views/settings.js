// Conta > Personalização: foto, nome de exibição, bio e nome de usuário.
// (Modo local, sem login: só os ajustes de backup.) A outra aba, "Configurações", fica em settingsAccount.js.
import { config } from '../config.js';
import { debounce, html, on, setHtml } from '../core/dom.js';
import { messageOf } from '../core/errors.js';
import { icon, spinner } from '../core/icons.js';
import { toast } from '../core/toast.js';
import { prepareAvatar } from '../services/avatarImage.js';
import { backend, isCloud, setProfile, state } from '../services/session.js';
import { avatar, avatarSrc } from '../ui/avatar.js';
import { bindDataPanel, dataPanelHtml } from '../ui/dataPanel.js';
import { guardTabs, settingsHeader } from '../ui/settingsShell.js';

const USERNAME_RX = /^[a-z0-9_]{3,20}$/;

const missingProfile = () => html`<div class="glass-panel empty-state">${icon('alert', { size: 40 })}<h3>Perfil não encontrado</h3>
    <p>Não conseguimos carregar o seu perfil. Verifique se o arquivo <code>sql/schema.sql</code> foi executado no Supabase.</p></div>`;

function photoPanel(p) {
    const has = Boolean(avatarSrc(p));
    return html`
    <section class="panel glass-panel" aria-labelledby="st-photo">
        <h2 id="st-photo">${icon('camera')} Foto de perfil</h2>
        <div class="photo-editor">
            <div class="photo-preview" data-avatar-preview>${avatar(p.displayName || p.username, 96, avatarSrc(p))}</div>
            <div class="photo-actions">
                <label class="button button-secondary" data-avatar-pick>${icon('camera', { size: 17 })} <span data-pick-text>${has ? 'Trocar foto' : 'Escolher foto'}</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="sr-only" data-avatar-input aria-label="Escolher uma foto de perfil"></label>
                <button type="button" class="button button-ghost" data-act="avatar-remove" ${has ? '' : 'hidden'}>${icon('trash', { size: 17 })} Remover foto</button>
            </div>
        </div>
        <p class="field-hint">A foto é pública e fica quadrada: o navegador recorta o centro e reduz para 128×128 (poucos KB) antes de enviar. Existe uma foto só por conta; ao trocar ou remover, a anterior é apagada de verdade.</p>
        <p class="field-hint" data-avatar-status aria-live="polite"></p>
    </section>`;
}

function identityPanel(p) {
    return html`
    <section class="panel glass-panel" aria-labelledby="st-profile">
        <h2 id="st-profile">${icon('user')} Seu perfil</h2>
        <form data-profile-form novalidate>
            <div class="field">
                <label for="st-display">Nome de exibição</label>
                <input id="st-display" class="input" maxlength="40" autocomplete="nickname" value="${p.displayName}">
            </div>
            <div class="field">
                <label for="st-bio">Bio</label>
                <textarea id="st-bio" class="textarea" maxlength="200" rows="3" placeholder="Conte um pouco sobre você e seus animes favoritos...">${p.bio}</textarea>
                <p class="field-hint" data-bio-count aria-live="off">${p.bio.length}/200</p>
            </div>
            <div class="field">
                <label for="st-username">Nome de usuário</label>
                <input id="st-username" class="input" maxlength="20" autocomplete="username" autocapitalize="none" spellcheck="false" value="${p.username}">
                <p class="username-status" data-username-status aria-live="polite"></p>
                <p class="field-hint">Ao mudar, o link antigo do seu perfil deixa de funcionar.</p>
            </div>
            <button type="submit" class="button button-primary" data-save>Salvar personalização</button>
        </form>
    </section>`;
}

export function mount(root) {
    const be = backend();
    const cloud = isCloud();
    const profile = state.profile;

    // --- sem login (modo local): só backup ---------------------------------------------------
    if (!cloud) {
        document.title = `Ajustes · ${config.siteName}`;
        setHtml(root, html`
            <header class="page-head">
                <div>
                    <span class="eyebrow">${icon('sliders', { size: 14 })} Modo local</span>
                    <h1 style="margin-top:10px">Ajustes</h1>
                </div>
            </header>
            <div class="notice-box">${icon('info')}<div>Login e perfis públicos estão desativados porque o Supabase ainda não foi configurado. Siga o <code>README.md</code> para ativar.</div></div>
            <div class="settings-grid">${dataPanelHtml(false)}</div>`);
        return bindDataPanel(root, be);
    }

    document.title = `Personalização · ${config.siteName}`;
    if (!profile) { setHtml(root, missingProfile()); return; }

    setHtml(root, html`
        ${settingsHeader({ profile, active: 'personalizacao' })}
        <div class="settings-grid">
            ${photoPanel(profile)}
            ${identityPanel(profile)}
        </div>`);

    const $ = (s) => root.querySelector(s);
    const offs = [];
    const usernameInput = $('#st-username');
    const displayInput = $('#st-display');
    const bio = $('#st-bio');
    const status = $('[data-username-status]');
    let usernameOk = true;
    let token = 0;

    // --- foto -----------------------------------------------------------------------------------
    const previewBox = $('[data-avatar-preview]');
    const photoStatus = $('[data-avatar-status]');
    const fileInput = $('[data-avatar-input]');
    const removeBtn = $('[data-act="avatar-remove"]');
    const pickText = $('[data-pick-text]');
    let busy = false;
    let blobUrl = '';

    const nameNow = () => displayInput.value.trim() || state.profile.displayName || state.profile.username;
    function paintAvatar(src) { setHtml(previewBox, avatar(nameNow(), 96, src)); }
    function setBusy(on_, text = '') {
        busy = on_;
        fileInput.disabled = on_;
        removeBtn.disabled = on_;
        $('[data-avatar-pick]').classList.toggle('is-disabled', on_);
        previewBox.setAttribute('aria-busy', String(on_));
        setHtml(photoStatus, on_ ? html`${spinner(14)} ${text}` : text);
    }
    function afterPhotoChange(updated) {
        setProfile(updated);
        const has = Boolean(avatarSrc(updated));
        removeBtn.hidden = !has;
        pickText.textContent = has ? 'Trocar foto' : 'Escolher foto';
    }

    offs.push(on(root, 'change', '[data-avatar-input]', async (_, input) => {
        const file = input.files?.[0];
        input.value = '';
        if (!file || busy) return;
        setBusy(true, 'Preparando a foto...');
        try {
            const { blob } = await prepareAvatar(file);
            setBusy(true, 'Enviando...');
            const updated = await be.profiles.setAvatar(blob);
            if (blobUrl) URL.revokeObjectURL(blobUrl);
            blobUrl = URL.createObjectURL(blob);
            paintAvatar(blobUrl);
            afterPhotoChange(updated);
            setBusy(false, '');
            toast('Foto atualizada!', { type: 'success' });
        } catch (err) {
            console.error(err);
            setBusy(false, '');
            toast(messageOf(err, 'Não foi possível trocar a foto.'), { type: 'error' });
        }
    }));

    offs.push(on(root, 'click', '[data-act="avatar-remove"]', async () => {
        if (busy) return;
        setBusy(true, 'Removendo...');
        try {
            const updated = await be.profiles.removeAvatar();
            if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = ''; }
            paintAvatar('');
            afterPhotoChange(updated);
            setBusy(false, '');
            toast('Foto removida.', { type: 'success' });
        } catch (err) {
            console.error(err);
            setBusy(false, '');
            toast(messageOf(err, 'Não foi possível remover a foto.'), { type: 'error' });
        }
    }));

    // --- nome, bio e usuário ------------------------------------------------------------------
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
    // a inicial do avatar acompanha o nome enquanto a pessoa digita (só quando não há foto)
    displayInput.addEventListener('input', () => { if (!avatarSrc(state.profile) && !blobUrl) paintAvatar(''); });

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
                displayName: displayInput.value.trim() || username,
                bio: bio.value,
            });
            setProfile(updated);
            displayInput.value = updated.displayName;
            toast('Personalização salva!', { type: 'success' });
        } catch (err) {
            console.error(err);
            toast(messageOf(err), { type: 'error' });
        } finally {
            btn.disabled = false;
            btn.textContent = 'Salvar personalização';
        }
    });

    // --- sair da aba com alterações não salvas -----------------------------------------------
    const isDirty = () => {
        const p = state.profile;
        return usernameInput.value.trim().toLowerCase() !== p.username
            || displayInput.value.trim() !== p.displayName
            || bio.value.trim() !== p.bio;
    };
    offs.push(guardTabs(root, isDirty));
    offs.push(() => check.cancel());
    offs.push(() => { if (blobUrl) URL.revokeObjectURL(blobUrl); });

    return () => offs.forEach((off) => off());
}
