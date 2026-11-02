// Imagem de fundo do perfil (só aparece na página pública #/u/nome, nunca no resto do site).
//  - Fica no bucket público "backgrounds" (uma imagem por pessoa; o nome do arquivo é o ID da conta).
//  - O desfoque é uma opção da pessoa (bgBlur):
//      ligado    -> cards semitransparentes que desfocam a imagem atrás deles;
//      desligado -> cards opacos e a imagem com 50% do brilho.
//    As cores dos cards vêm do tema e da combinação de cores em uso (modo claro/escuro), então o contraste acompanha os dois.
//  - Alto contraste (opção de acessibilidade de quem está olhando) esconde a imagem: fundos sem transparência são o objetivo dele.
import { config } from '../config.js';
import { html } from '../core/dom.js';

export const BACKGROUND_BUCKET = 'backgrounds';
const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Endereço público do fundo de um perfil, ou '' se a pessoa não tem fundo. O número da versão (bgV) evita mostrar um fundo antigo em cache. */
export function backgroundSrc(profile) {
    const v = Number(profile?.bgV);
    if (!profile || !Number.isSafeInteger(v) || v <= 0 || !UUID_RX.test(String(profile.id || ''))) return '';
    const base = String(config.supabaseUrl || '').replace(/\/+$/, '');
    if (!/^https:\/\//.test(base)) return '';
    return `${base}/storage/v1/object/public/${BACKGROUND_BUCKET}/${profile.id}?v=${v}`;
}

export const backgroundMode = (profile) => (profile?.bgBlur === false ? 'solid' : 'blur');

/**
 * Coloca o fundo atrás da página do perfil. `view` é o contêiner da tela (recebe data-bg e as cores dos cards).
 * Sem fundo, não faz nada. Se a imagem não carregar, tudo volta ao visual normal. Devolve a função que remove o fundo.
 */
export function showProfileBackground(view, profile) {
    const src = backgroundSrc(profile);
    if (!src) return () => {};
    const mode = backgroundMode(profile);
    const layer = document.createElement('div');
    layer.className = 'profile-bg bg-art';
    layer.dataset.bg = mode;
    layer.setAttribute('aria-hidden', 'true');
    const img = document.createElement('img');
    img.className = 'bg-art-img';
    img.alt = '';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    const veil = document.createElement('span');
    veil.className = 'bg-art-veil';
    layer.append(img, veil);

    const off = () => { layer.remove(); view.removeAttribute('data-bg'); };
    img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
    img.addEventListener('error', off, { once: true });
    img.src = src;
    view.dataset.bg = mode;
    document.body.prepend(layer);
    return off;
}

/** Prévia do fundo na tela de Personalização: a imagem com um cartão de exemplo, já no modo escolhido. */
export function backgroundPreviewHtml(profile, srcOverride = '') {
    const src = srcOverride || backgroundSrc(profile);
    if (!src) {
        return html`<div class="bg-preview bg-preview-empty" data-bg-preview><span class="muted">Nenhum fundo escolhido: o seu perfil usa as cores normais do site.</span></div>`;
    }
    return html`
    <div class="bg-preview bg-art" data-bg="${backgroundMode(profile)}" data-bg-preview>
        <img class="bg-art-img is-loaded" src="${src}" alt="Prévia do seu fundo de perfil" decoding="async" referrerpolicy="no-referrer">
        <span class="bg-art-veil"></span>
        <div class="bg-preview-card glass-panel"><strong>Seu perfil</strong><span>Assim os cards ficam sobre o fundo.</span></div>
    </div>`;
}
