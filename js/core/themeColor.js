// Cor do app: a barra do navegador / do aplicativo instalado (meta theme-color) acompanha o visual do site.
//  • Cor do perfil: a paleta escolhida (data-palette) vale no site todo, então a barra usa a cor principal dela.
//  • Sem paleta: o claro/escuro do sistema (ou o que a pessoa escolheu no botão de tema).
//  • Alto contraste: preto no claro e amarelo no escuro, como o resto do site.
// A cor sai do próprio CSS (a variável --primary-color de <html> já considera paleta, tema, sistema e alto contraste), então nada aqui
// precisa saber os valores de cada paleta. A última cor fica guardada para o js/boot.js pintar a barra certa já na próxima abertura.
// (O manifesto tem uma cor fixa, usada só antes da página abrir; a tela de abertura do app também é fixa: são limites dos navegadores.)
import { ownPalette } from './palette.js';

const KEY = 'kamylist_theme_color';
const FALLBACK = '#B35EAF';
const HEX = /^#[0-9a-f]{6}$/i;

/** "#abc", "#aabbcc" ou "rgb(1, 2, 3)" → "#aabbcc"; qualquer outra coisa → null. */
export function normalizeColor(value) {
    const v = String(value || '').trim();
    if (HEX.test(v)) return v.toLowerCase();
    const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(v);
    if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
    const rgb = /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/i.exec(v);
    if (rgb) return `#${[rgb[1], rgb[2], rgb[3]].map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('')}`;
    return null;
}

/** A cor que o site está usando agora como cor principal. */
export function currentThemeColor() {
    try { return normalizeColor(getComputedStyle(document.documentElement).getPropertyValue('--primary-color')) || FALLBACK; } catch { return FALLBACK; }
}

// No app instalado do Android, a barra de navegação de baixo e a tela de abertura usam as cores do MANIFESTO, que a página não muda em tempo real.
// Por isso existe um manifesto por paleta (manifest-<paleta>.webmanifest, gerado por tools/make-manifests.mjs) e o <link rel="manifest"> aponta
// para o da MINHA paleta (não para a do perfil que estou visitando: senão o app "piscaria" de manifesto a cada perfil aberto).
// O Chrome aplica ao app já instalado na próxima atualização dele (ou na hora, instalando de novo).
export const manifestFor = (paleta) => (paleta && paleta !== 'default' ? `manifest-${paleta}.webmanifest` : 'manifest.webmanifest');
export function applyManifest() {
    const link = document.querySelector('link[rel="manifest"]');
    if (!link) return;
    const want = manifestFor(ownPalette());
    if (link.getAttribute('href') !== want) link.setAttribute('href', want);
}

let last = '';
export function applyThemeColor() {
    const color = currentThemeColor();
    if (color === last) return color;
    last = color;
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', color));
    try { localStorage.setItem(KEY, color); } catch { /* sem armazenamento: vale só nesta visita */ }
    return color;
}

/** Liga: pinta agora e repinta quando a paleta, o tema ou o alto contraste mudam (inclusive o claro/escuro do sistema). */
export function initThemeColor() {
    applyThemeColor();
    applyManifest();
    let queued = false;
    const later = () => {      // vários atributos mudam juntos (ex.: entrar numa conta): uma pintura só
        if (queued) return;
        queued = true;
        queueMicrotask(() => { queued = false; applyThemeColor(); applyManifest(); });
    };
    new MutationObserver(later).observe(document.documentElement, { attributes: true, attributeFilter: ['data-palette', 'data-theme', 'data-contrast'] });
    try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', later); } catch { /* navegador antigo */ }
}
