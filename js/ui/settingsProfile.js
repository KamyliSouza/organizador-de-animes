// Configurações > Perfil e foto: foto de perfil, nome de exibição, nome de usuário e "sobre você".
// Devolve o HTML do tema (profileThemeHtml) e liga o comportamento (bindProfileTheme); a tela em volta fica em js/views/settings.js.
import { debounce, html, on, setHtml } from '../core/dom.js';
import { messageOf } from '../core/errors.js';
import { cleanUnicode } from '../domain/textSafety.js';
import { icon, spinner } from '../core/icons.js';
import { toast } from '../core/toast.js';
import { checkAvatarFile, prepareAvatar } from '../services/avatarImage.js';
import { setProfile, state } from '../services/session.js';
import { avatar, avatarSrc } from './avatar.js';
import { bindMediaLimits } from './mediaLimits.js';
import { openAvatarCropper } from './avatarCropModal.js';

const USERNAME_RX = /^[a-z0-9_]{3,20}$/;

/** Foto de perfil: o bloco da esquerda (ou de cima, no celular) do painel "Seu perfil". */
function photoBlock(p) {
    const has = Boolean(avatarSrc(p));
    return html`
    <div class="photo-block" role="group" aria-labelledby="st-photo">
        <h3 id="st-photo">${icon('camera', { size: 17 })} Foto de perfil</h3>
        <div class="photo-editor">
            <div class="photo-preview" data-avatar-preview>${avatar(p.displayName || p.username, 112, avatarSrc(p))}</div>
            <div class="photo-actions">
                <label class="button button-secondary" data-avatar-pick>${icon('camera', { size: 17 })} <span data-pick-text>${has ? 'Trocar foto' : 'Escolher foto'}</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="sr-only" data-avatar-input aria-label="Escolher uma foto de perfil"></label>
                <button type="button" class="button button-ghost" data-act="avatar-remove" ${has ? '' : 'hidden'}>${icon('trash', { size: 17 })} Remover foto</button>
            </div>
        </div>
        <p class="field-hint">A foto é pública. Ao escolher, você enquadra a imagem dentro de um círculo (arrastando e ampliando) antes de enviar. Só existe uma foto por conta: ao trocar ou remover, a anterior é apagada.</p>
        <p class="field-hint" data-avatar-status aria-live="polite"></p>
        <p class="field-hint" data-avatar-limit aria-live="off"></p>
    </div>`;
}

function identityForm(p) {
    return html`
        <form class="profile-form" data-profile-form novalidate>
            <div class="field">
                <label for="st-display">Nome de exibição</label>
                <input id="st-display" class="input" maxlength="40" autocomplete="nickname" value="${p.displayName}">
            </div>
            <div class="field">
                <label for="st-username">Nome de usuário</label>
                <input id="st-username" class="input" maxlength="20" autocomplete="username" autocapitalize="none" spellcheck="false" value="${p.username}">
                <p class="username-status" data-username-status aria-live="polite"></p>
                <p class="field-hint">Ao mudar, o link antigo do seu perfil deixa de funcionar.</p>
            </div>
            <div class="field span-2">
                <label for="st-bio">Sobre você</label>
                <textarea id="st-bio" class="textarea" maxlength="200" rows="3" placeholder="Conte um pouco sobre você e seus animes favoritos...">${p.bio}</textarea>
                <p class="field-hint" data-bio-count aria-live="off">${p.bio.length}/200</p>
            </div>
            <button type="submit" class="button button-primary" data-save>Salvar perfil</button>
        </form>`;
}

/** O tema inteiro: um painel só, com a foto e os campos (no celular, um embaixo do outro). */
export function profileThemeHtml(p) {
    return html`
    <section class="panel panel-wide glass-panel profile-panel" aria-labelledby="st-profile">
        <h2 id="st-profile">${icon('user')} Seu perfil</h2>
        <div class="profile-panel-body">
            ${photoBlock(p)}
            ${identityForm(p)}
        </div>
    </section>`;
}


/**
 * Liga o tema (`root` já tem o HTML de profileThemeHtml). `be` = backend.
 * Devolve { off, isDirty }: `off` desfaz tudo; `isDirty()` diz se há campo editado e não salvo.
 */
export function bindProfileTheme(root, be) {
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
    let limits = null;                // limites de troca (espera entre trocas e limite por dia): ver js/ui/mediaLimits.js

    const nameNow = () => displayInput.value.trim() || state.profile.displayName || state.profile.username;
    function paintAvatar(src) { setHtml(previewBox, avatar(nameNow(), 112, src)); }
    function setBusy(on_, text = '') {
        busy = on_;
        const locked = on_ || Boolean(limits?.blocked());
        fileInput.disabled = locked;
        removeBtn.disabled = on_;
        $('[data-avatar-pick]').classList.toggle('is-disabled', locked);
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
        setBusy(true, 'Abrindo a foto...');
        try {
            const blockedMsg = await limits.check();     // espera entre trocas / limite por dia: avisa antes de a pessoa enquadrar a foto à toa
            if (blockedMsg) { setBusy(false, ''); toast(blockedMsg, { type: 'error' }); return; }
            checkAvatarFile(file);                       // tipo e tamanho, antes de abrir o recorte
            const crop = await openAvatarCropper(file);  // a pessoa enquadra a foto no círculo
            if (!crop) { setBusy(false, ''); return; }   // cancelou: nada muda
            setBusy(true, 'Preparando a foto...');
            const { blob } = await prepareAvatar(file, crop);
            setBusy(true, 'Enviando...');
            const updated = await be.profiles.setAvatar(blob);
            if (blobUrl) URL.revokeObjectURL(blobUrl);
            blobUrl = URL.createObjectURL(blob);
            paintAvatar(blobUrl);
            afterPhotoChange(updated);
            setBusy(false, '');
            limits.refresh();
            toast('Foto atualizada!', { type: 'success' });
        } catch (err) {
            console.error(err);
            setBusy(false, '');
            limits.refresh();
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

    limits = bindMediaLimits(be, {
        kind: 'avatar',
        hint: $('[data-avatar-limit]'),
        onChange: (blocked) => {                         // trava o botão durante a espera (e não destrava no meio de um envio)
            const locked = busy || blocked;
            fileInput.disabled = locked;
            $('[data-avatar-pick]').classList.toggle('is-disabled', locked);
        },
    });
    offs.push(() => limits.destroy());

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
                displayName: cleanUnicode(displayInput.value, { max: 40 }) || username,
                bio: bio.value,
            });
            setProfile(updated);
            displayInput.value = updated.displayName;
            toast('Perfil salvo!', { type: 'success' });
        } catch (err) {
            console.error(err);
            toast(messageOf(err), { type: 'error' });
        } finally {
            btn.disabled = false;
            btn.textContent = 'Salvar perfil';
        }
    });


    const isDirty = () => {
        const p = state.profile;
        return usernameInput.value.trim().toLowerCase() !== p.username
            || displayInput.value.trim() !== p.displayName
            || bio.value.trim() !== p.bio;
    };
    offs.push(() => check.cancel());
    offs.push(() => { if (blobUrl) URL.revokeObjectURL(blobUrl); });

    return { off: () => offs.forEach((off) => off()), isDirty };
}
