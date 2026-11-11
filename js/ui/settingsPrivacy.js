// Configurações > Privacidade: perfil público, mostrar anotações e quais abas (Anime/Mangá/Light Novel) outras pessoas veem.
// O que a equipe do site trava (perfil sempre privado, anotações sempre privadas) aparece desligado, com o motivo.
import { copyText, html, on, setHtml } from '../core/dom.js';
import { messageOf } from '../core/errors.js';
import { icon, spinner } from '../core/icons.js';
import { refresh } from '../core/router.js';
import { toast } from '../core/toast.js';
import { SECTIONS, SECTION_KEYS, normalizeSections } from '../domain/entry.js';
import { refreshAccess, setProfile, state } from '../services/session.js';

const publicLink = (u) => `${location.origin}${location.pathname}#/u/${u}`;

const SECTION_HINTS = { anime: 'Animes, filmes e séries', manga: 'Mangás, manhwas e manhuas', novel: 'Light novels' };

/** Aviso de trava: a equipe deixou isto sempre privado nesta conta. */
const lockNote = (id, what, reason) => html`
    <span class="switch-lock" id="${id}" data-lock-note>${icon('lock', { size: 14 })}
        <span><strong>Travado pela equipe do site.</strong> ${what}${reason ? html` Motivo: “${reason}”.` : ''} Quando a equipe tirar a trava, a opção volta a ficar com você (ela não liga sozinha).</span></span>`;

export function privacyThemeHtml(p, access) {
    const lockProfile = access.forcePrivateProfile;
    const lockNotes = access.forcePrivateNotes;
    return html`
    <section class="panel glass-panel" aria-labelledby="st-privacy">
        <h2 id="st-privacy">${icon('globe')} Privacidade</h2>
        <form data-privacy-form novalidate>
            <label class="switch-row ${lockProfile ? 'is-locked' : ''}">
                <input type="checkbox" id="st-public" ${p.isPublic && !lockProfile ? 'checked' : ''} ${lockProfile ? 'disabled' : ''}>
                <span><span class="switch-title">Perfil público</span><br>
                <span class="switch-desc">Qualquer pessoa com o link (ou que use o Explorar) vê sua lista e suas análises. Desligado, só quem você aprovar vê (os pedidos ficam em Feed → Pedidos). Ao ligar, os pedidos pendentes são aprovados.</span>
                ${lockProfile ? lockNote('st-public-lock', 'O seu perfil fica privado.', access.forceReason) : ''}</span>
            </label>
            <label class="switch-row ${lockNotes ? 'is-locked' : ''}">
                <input type="checkbox" id="st-notes" ${p.showNotes && !lockNotes ? 'checked' : ''} ${lockNotes ? 'disabled' : ''}>
                <span><span class="switch-title">Mostrar minhas anotações</span><br>
                <span class="switch-desc">Por padrão, suas anotações ficam só com você, mesmo com o perfil público. As análises são diferentes: aparecem para quem vê a sua lista.</span>
                ${lockNotes ? lockNote('st-notes-lock', 'As suas anotações ficam só com você.', access.forceReason) : ''}</span>
            </label>
            <div class="sections-group" role="group" aria-labelledby="st-sections-title" aria-describedby="st-sections-desc" data-sections-group>
                <span class="switch-title" id="st-sections-title">Abas visíveis no seu perfil</span>
                <p class="switch-desc" id="st-sections-desc">Escolha quais abas outras pessoas veem no seu perfil, no Explorar e no feed. Obras de uma aba desligada ficam escondidas de todo mundo, mas você continua vendo tudo na sua biblioteca. Pelo menos uma aba precisa ficar ligada; com só uma, o seletor de abas some do perfil.</p>
                ${SECTION_KEYS.map((k) => html`
                <label class="switch-row">
                    <input type="checkbox" data-section-check="${k}" ${normalizeSections(p.sections).includes(k) ? 'checked' : ''}>
                    <span><span class="switch-title">${SECTIONS[k].label}</span><br><span class="switch-desc">${SECTION_HINTS[k]}</span></span>
                </label>`)}
            </div>
            <div data-link-box></div>
            <button type="submit" class="button button-primary" data-save>Salvar privacidade</button>
        </form>
    </section>`;
}


/** Liga o tema. `be` = backend. Devolve { off, isDirty }. */
export function bindPrivacyTheme(root, be) {
    const $ = (s) => root.querySelector(s);
    const offs = [];
    // opções travadas pela equipe: o leitor de tela lê a explicação junto com o campo
    if (state.access.forcePrivateProfile) $('#st-public')?.setAttribute('aria-describedby', 'st-public-lock');
    if (state.access.forcePrivateNotes) $('#st-notes')?.setAttribute('aria-describedby', 'st-notes-lock');

    const linkBox = $('[data-link-box]');
    const renderLink = (p) => setHtml(linkBox, p.isPublic ? html`
        <div class="field"><span class="field-label">Link do seu perfil</span>
            <div class="copy-field"><input class="input" readonly value="${publicLink(p.username)}" aria-label="Link do seu perfil" data-link>
            <button type="button" class="button button-secondary" data-act="copy" aria-label="Copiar link">${icon('copy', { size: 16 })}</button></div></div>` : '');
    renderLink(state.profile);

    // --- abas do perfil: sempre sobra pelo menos uma ligada ------------------------------------
    const sectionChecks = () => [...root.querySelectorAll('[data-section-check]')];
    const checkedSections = () => sectionChecks().filter((c) => c.checked).map((c) => c.dataset.sectionCheck);
    offs.push(on(root, 'change', '[data-section-check]', (_, box) => {
        if (checkedSections().length > 0) return;
        box.checked = true;
        toast('Deixe pelo menos uma aba ligada no perfil.', { type: 'info' });
    }));

    // --- privacidade ------------------------------------------------------------------------
    $('[data-privacy-form]').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = $('[data-save]');
        btn.disabled = true;
        setHtml(btn, html`${spinner(17)} Salvando...`);
        try {
            const wantPublic = $('#st-public').checked;
            const wantNotes = $('#st-notes').checked;
            const updated = await be.profiles.updateMine({
                isPublic: wantPublic,
                showNotes: wantNotes,
                sections: checkedSections(),
            });
            setProfile(updated);
            // O banco manda: se a equipe travou algo depois de a tela abrir, o valor volta como "desligado".
            if ((wantPublic && !updated.isPublic) || (wantNotes && !updated.showNotes)) {
                await refreshAccess();
                refresh();
                toast('A equipe do site deixou isto privado nesta conta. As outras opções foram salvas.', { type: 'info' });
                return;
            }
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

    offs.push(on(root, 'click', '[data-act="copy"]', async () => {
        const ok = await copyText(root.querySelector('[data-link]').value);
        toast(ok ? 'Link copiado!' : 'Não foi possível copiar o link.', { type: ok ? 'success' : 'error' });
    }));

    const isDirty = () => (!state.access.forcePrivateProfile && $('#st-public').checked !== state.profile.isPublic)
        || (!state.access.forcePrivateNotes && $('#st-notes').checked !== state.profile.showNotes)
        || checkedSections().join() !== normalizeSections(state.profile.sections).join();

    return { off: () => offs.forEach((off) => off()), isDirty };
}
