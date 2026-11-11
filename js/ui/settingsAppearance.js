// Configurações > Personalização: Cores, Fundo do perfil (só com login) e Acessibilidade (alto contraste).
// Tudo aqui salva na hora, então não há "alterações por salvar". No modo local (sem login) só existem Cores e Acessibilidade.
import { html } from '../core/dom.js';
import { messageOf } from '../core/errors.js';
import { icon } from '../core/icons.js';
import { ownPalette, setOwnPalette } from '../core/palette.js';
import { toast } from '../core/toast.js';
import { setProfile } from '../services/session.js';
import { accessibilityPanelHtml, bindAccessibility } from './accessibilityPanel.js';
import { backgroundPanelHtml, bindBackgroundPanel } from './backgroundPanel.js';
import { bindPalettePicker, palettePickerHtml, selectPalette } from './palettePicker.js';

function palettePanel(current, cloud) {
    return html`
    <section class="panel panel-wide glass-panel" aria-labelledby="st-palette">
        <h2 id="st-palette">${icon('sparkles')} Cores</h2>
        <p class="field-hint">${cloud
            ? 'Escolha uma combinação de cores. Ela vale para o site todo enquanto você estiver com login. Quem abrir seu perfil vê estas cores só enquanto estiver nele. A escolha é salva na hora.'
            : 'Escolha uma combinação de cores para o site. A escolha fica salva neste navegador.'}</p>
        ${palettePickerHtml(current)}
        <p class="field-hint">Todas as combinações têm bom contraste de leitura (padrão WCAG AA), nos temas claro e escuro. Para ainda mais contraste, ligue o "Alto contraste" no painel Acessibilidade, logo abaixo.</p>
        <p class="field-hint" data-palette-status aria-live="polite"></p>
    </section>`;
}

/** Liga o seletor: aplica na hora, salva em seguida e desfaz se não conseguir salvar. */
function bindPalette(root, be, cloud) {
    const status = root.querySelector('[data-palette-status]');
    let saving = Promise.resolve();
    return bindPalettePicker(root, (id) => {
        const before = ownPalette();
        setOwnPalette(id);            // aparece na hora
        if (!cloud) { status.textContent = 'Cores salvas neste navegador.'; return; }
        status.textContent = 'Salvando...';
        saving = saving.then(async () => {
            try {
                const updated = await be.profiles.updateMine({ palette: id });
                setProfile(updated);
                status.textContent = 'Cores salvas.';
            } catch (err) {
                console.error(err);
                setOwnPalette(before);
                selectPalette(root, before);
                status.textContent = '';
                toast(messageOf(err, 'Não foi possível salvar as cores.'), { type: 'error' });
            }
        });
    });
}

/** O tema completo (com login): Cores, Fundo do perfil e Acessibilidade, nesta ordem. */
export const appearanceThemeHtml = (profile) => html`
    ${palettePanel(profile.palette, true)}
    ${backgroundPanelHtml(profile)}
    ${accessibilityPanelHtml(true)}`;

/** Só o que existe sem login: Cores e Acessibilidade. */
export const localAppearanceHtml = () => html`${palettePanel(ownPalette(), false)}${accessibilityPanelHtml(false)}`;

/** Liga o tema. Devolve { off, isDirty } (nada aqui fica por salvar: isDirty é sempre falso). */
export function bindAppearanceTheme(root, be, cloud = true) {
    const offs = [bindPalette(root, be, cloud), bindAccessibility(root, be, cloud)];
    if (cloud) offs.push(bindBackgroundPanel(root, be));
    return { off: () => offs.forEach((off) => off()), isDirty: () => false };
}
