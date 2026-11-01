// Painel "Acessibilidade" (Personalização, ou Ajustes no modo local). Hoje tem uma opção: alto contraste.
//  - A opção é PRIVADA: vale só para quem a liga. Com login fica guardada na conta (tabela user_prefs) e vale em qualquer aparelho
//    em que a pessoa entrar; sem login (modo local) fica só neste navegador. Ninguém mais a vê, nem ao abrir o perfil dela.
//  - Liga na hora, salva em seguida e volta atrás se não conseguir salvar.
import { html, on } from '../core/dom.js';
import { highContrast, setHighContrast } from '../core/contrast.js';
import { messageOf } from '../core/errors.js';
import { icon } from '../core/icons.js';
import { toast } from '../core/toast.js';
import { setProfile } from '../services/session.js';

export function accessibilityPanelHtml(cloud) {
    return html`
    <section class="panel panel-wide glass-panel" aria-labelledby="st-a11y">
        <h2 id="st-a11y">${icon('eye')} Acessibilidade</h2>
        <label class="switch-row">
            <input type="checkbox" id="st-contrast" data-contrast-switch ${highContrast() ? 'checked' : ''} aria-describedby="st-contrast-desc">
            <span><span class="switch-title">Alto contraste</span><br>
            <span class="switch-desc" id="st-contrast-desc">Preto e branco no tema claro, preto e amarelo no tema escuro, com bordas mais fortes, fundos sem transparência e links sublinhados. Vale por cima de qualquer combinação de cores e funciona junto com o tema claro ou escuro.</span></span>
        </label>
        <p class="field-hint">${cloud
            ? 'É só para você: fica guardado na sua conta e vale nos aparelhos em que você entrar. Não muda o seu perfil nem aparece para ninguém, e o alto contraste de outras pessoas também não muda o que você vê.'
            : 'É só para você e fica guardado neste navegador.'}</p>
        <p class="field-hint" data-contrast-status aria-live="polite"></p>
    </section>`;
}

/** Liga o interruptor. `be` é o backend (só é usado com login). Devolve a função que desfaz a ligação. */
export function bindAccessibility(root, be, cloud) {
    const status = root.querySelector('[data-contrast-status]');
    let saving = Promise.resolve();
    return on(root, 'change', '[data-contrast-switch]', (_, box) => {
        const before = highContrast();
        const next = box.checked;
        setHighContrast(next);                // aparece na hora
        if (!cloud) { status.textContent = next ? 'Alto contraste ligado neste navegador.' : 'Alto contraste desligado.'; return; }
        status.textContent = 'Salvando...';
        saving = saving.then(async () => {
            try {
                const updated = await be.profiles.updateMine({ highContrast: next });
                setProfile(updated);
                status.textContent = next ? 'Alto contraste ligado e guardado na sua conta.' : 'Alto contraste desligado.';
            } catch (err) {
                console.error(err);
                setHighContrast(before);
                box.checked = before;
                status.textContent = '';
                toast(messageOf(err, 'Não foi possível salvar a opção.'), { type: 'error' });
            }
        });
    });
}
