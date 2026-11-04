// Painel "Fundo do perfil" (Personalização, só com login): enviar, trocar e remover a imagem de fundo e ligar/desligar o desfoque.
//  - A imagem é reduzida e convertida para WebP aqui no navegador antes de enviar (js/services/backgroundImage.js).
//  - Só existe uma imagem por conta: ao trocar ou remover, a anterior é apagada.
//  - O fundo vale no site todo enquanto você está logada, como as cores (js/core/siteBackground.js), e é público: quem abrir o seu perfil o vê ali.
//    O desfoque salva na hora, como as cores.
import { html, on, setHtml } from '../core/dom.js';
import { messageOf } from '../core/errors.js';
import { icon, spinner } from '../core/icons.js';
import { setOwnBackgroundBlur } from '../core/siteBackground.js';
import { toast } from '../core/toast.js';
import { checkBackgroundFile, prepareBackground } from '../services/backgroundImage.js';
import { setProfile, state } from '../services/session.js';
import { bindMediaLimits } from './mediaLimits.js';
import { backgroundPreviewHtml, backgroundSrc } from './profileBackground.js';

const kb = (bytes) => `${Math.max(1, Math.round(bytes / 1024))} KB`;

export function backgroundPanelHtml(p) {
    const has = Boolean(backgroundSrc(p));
    return html`
    <section class="panel panel-wide glass-panel" aria-labelledby="st-bg">
        <h2 id="st-bg">${icon('image')} Fundo do perfil</h2>
        <p class="field-hint">Uma imagem que aparece atrás do site inteiro enquanto você estiver com login, como as cores. Quem abrir o seu perfil também vê o seu fundo ali, só enquanto estiver nele. Como a foto de perfil, o fundo é público.</p>
        <div class="bg-editor">
            <div data-bg-preview-wrap>${backgroundPreviewHtml(p)}</div>
            <div class="bg-controls">
                <div class="row">
                    <label class="button button-secondary" data-bg-pick>${icon('image', { size: 17 })} <span data-bg-pick-text>${has ? 'Trocar fundo' : 'Escolher fundo'}</span>
                        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="sr-only" data-bg-input aria-label="Escolher uma imagem de fundo para o site"></label>
                    <button type="button" class="button button-ghost" data-act="bg-remove" ${has ? '' : 'hidden'}>${icon('trash', { size: 17 })} Remover fundo</button>
                </div>
                <label class="switch-row">
                    <input type="checkbox" id="st-bgblur" data-bgblur-switch ${p.bgBlur !== false ? 'checked' : ''} aria-describedby="st-bgblur-desc">
                    <span><span class="switch-title">Desfoque nos cards</span><br>
                    <span class="switch-desc" id="st-bgblur-desc">Ligado: os cards ficam semitransparentes e desfocam a imagem que está atrás deles. Desligado: os cards ficam opacos e a imagem fica mais escura (metade do brilho), para o texto continuar fácil de ler. Vale para o tema claro e para o escuro.</span></span>
                </label>
            </div>
        </div>
        <p class="field-hint">Escolha uma imagem JPG, PNG, WebP ou GIF de até 20 MB. Antes de enviar, o site a reduz (no máximo 1600 px) e converte para WebP, então ela fica leve. Só existe um fundo por conta: ao trocar ou remover, o anterior é apagado. Quem ligar o "Alto contraste" não vê nenhum fundo, nem o seu nem o dos outros.</p>
        <p class="field-hint" data-bg-status aria-live="polite"></p>
        <p class="field-hint" data-bg-limit aria-live="off"></p>
    </section>`;
}

/** Liga o painel. `be` é o backend. Devolve a função que desfaz a ligação. */
export function bindBackgroundPanel(root, be) {
    const $ = (s) => root.querySelector(s);
    const wrap = $('[data-bg-preview-wrap]');
    const status = $('[data-bg-status]');
    const input = $('[data-bg-input]');
    const removeBtn = $('[data-act="bg-remove"]');
    const pickText = $('[data-bg-pick-text]');
    const blurBox = $('[data-bgblur-switch]');
    let busy = false;
    let blobUrl = '';
    let limits = null;                                           // limites de troca (espera entre trocas e limite por dia): ver js/ui/mediaLimits.js
    let saving = Promise.resolve();
    let current = state.profile?.bgBlur !== false;               // valor em vigor (a tela já mostra o novo antes de salvar)

    const setBusy = (on_, text = '') => {
        busy = on_;
        const locked = on_ || Boolean(limits?.blocked());
        input.disabled = locked;
        removeBtn.disabled = on_;
        $('[data-bg-pick]').classList.toggle('is-disabled', locked);
        wrap.setAttribute('aria-busy', String(on_));
        setHtml(status, on_ ? html`${spinner(14)} ${text}` : text);
    };
    const revoke = () => { if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = ''; } };
    const paint = (profile, override = '') => {
        setHtml(wrap, backgroundPreviewHtml(profile, override));
        const has = Boolean(backgroundSrc(profile));
        removeBtn.hidden = !has;
        pickText.textContent = has ? 'Trocar fundo' : 'Escolher fundo';
    };

    const offs = [];
    limits = bindMediaLimits(be, {
        kind: 'background',
        hint: $('[data-bg-limit]'),
        onChange: (blocked) => {                                        // trava o botão durante a espera (e não destrava no meio de um envio)
            const locked = busy || blocked;
            input.disabled = locked;
            $('[data-bg-pick]').classList.toggle('is-disabled', locked);
        },
    });
    offs.push(() => limits.destroy());
    offs.push(on(root, 'change', '[data-bg-input]', async (_, el) => {
        const file = el.files?.[0];
        el.value = '';
        if (!file || busy) return;
        setBusy(true, 'Abrindo a imagem...');
        try {
            const blockedMsg = await limits.check();                    // espera entre trocas / limite por dia: avisa antes de converter a imagem à toa
            if (blockedMsg) { setBusy(false, ''); toast(blockedMsg, { type: 'error' }); return; }
            checkBackgroundFile(file);                                  // tipo e tamanho, antes de processar
            setBusy(true, 'Reduzindo e convertendo para WebP...');
            const prepared = await prepareBackground(file);
            setBusy(true, 'Enviando...');
            const updated = await be.profiles.setBackground(prepared.blob);
            revoke();
            blobUrl = URL.createObjectURL(prepared.blob);
            setProfile(updated);
            paint(updated, blobUrl);
            setBusy(false, `Fundo atualizado! ${prepared.width}×${prepared.height} px, ${kb(prepared.blob.size)} (a imagem original tinha ${kb(prepared.originalBytes)}).`);
            limits.refresh();
            toast('Fundo atualizado!', { type: 'success' });
        } catch (err) {
            console.error(err);
            setBusy(false, '');
            limits.refresh();
            toast(messageOf(err, 'Não foi possível trocar o fundo.'), { type: 'error' });
        }
    }));

    offs.push(on(root, 'click', '[data-act="bg-remove"]', async () => {
        if (busy) return;
        setBusy(true, 'Removendo...');
        try {
            const updated = await be.profiles.removeBackground();
            revoke();
            setProfile(updated);
            paint(updated);
            setBusy(false, '');
            toast('Fundo removido.', { type: 'success' });
        } catch (err) {
            console.error(err);
            setBusy(false, '');
            toast(messageOf(err, 'Não foi possível remover o fundo.'), { type: 'error' });
        }
    }));

    // Desfoque: aparece na prévia na hora, salva em seguida e volta atrás se não conseguir salvar
    offs.push(on(root, 'change', '[data-bgblur-switch]', (_, box) => {
        const before = current;
        const next = box.checked;
        current = next;
        const preview = wrap.querySelector('[data-bg]');
        if (preview) preview.dataset.bg = next ? 'blur' : 'solid';
        setOwnBackgroundBlur(next);                                 // o site todo já mostra o novo modo
        status.textContent = 'Salvando...';
        saving = saving.then(async () => {
            try {
                const updated = await be.profiles.updateMine({ bgBlur: next });
                setProfile(updated);
                status.textContent = next ? 'Desfoque ligado.' : 'Desfoque desligado.';
            } catch (err) {
                console.error(err);
                current = before;
                box.checked = before;
                const again = wrap.querySelector('[data-bg]');
                if (again) again.dataset.bg = before ? 'blur' : 'solid';
                setOwnBackgroundBlur(before);
                status.textContent = '';
                toast(messageOf(err, 'Não foi possível salvar a opção.'), { type: 'error' });
            }
        });
    }));

    offs.push(() => revoke());
    return () => offs.forEach((off) => off());
}
