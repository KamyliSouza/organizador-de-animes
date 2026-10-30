// Conta do recorte circular da foto de perfil (sem DOM, para poder testar).
//
// O recorte é um quadrado da foto original. O estado é { zoom, cx, cy }:
//   zoom   1 = o quadrado inteiro do lado menor da foto; 4 = quatro vezes mais perto
//   cx, cy centro do quadrado, em pixels da foto original
// O lado do quadrado é  min(largura, altura) / zoom,  não importa o tamanho da janela na tela.
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/** Lado do quadrado recortado, em pixels da foto original. */
export const cropSide = (zoom, iw, ih) => Math.min(iw, ih) / clamp(zoom, MIN_ZOOM, MAX_ZOOM);

/** Estado inicial: foto toda enquadrada (zoom 1), centralizada. */
export const initialView = (iw, ih) => ({ zoom: 1, cx: iw / 2, cy: ih / 2 });

/** Mantém o zoom no intervalo e o quadrado sempre dentro da foto (nunca aparece "vazio" no círculo). */
export function clampView(view, iw, ih) {
    const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);   // 0 é um valor válido
    const zoom = clamp(num(view.zoom, 1), MIN_ZOOM, MAX_ZOOM);
    const half = cropSide(zoom, iw, ih) / 2;
    return { zoom, cx: clamp(num(view.cx, iw / 2), half, iw - half), cy: clamp(num(view.cy, ih / 2), half, ih - half) };
}

/** O recorte { x, y, size } (canto superior esquerdo + lado) para entregar ao prepareAvatar. */
export function cropOf(view, iw, ih) {
    const v = clampView(view, iw, ih);
    const size = cropSide(v.zoom, iw, ih);
    return { x: v.cx - size / 2, y: v.cy - size / 2, size };
}

/**
 * Muda o zoom mantendo parado o ponto da foto que está sob (px, py), medidos dentro da janela de lado `box`.
 * Sem ponto, o zoom é no centro do recorte.
 */
export function zoomAt(view, nextZoom, iw, ih, box, px = box / 2, py = box / 2) {
    const v = clampView(view, iw, ih);
    const z = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    const s0 = box / Math.min(iw, ih);                 // pixels da tela por pixel da foto, com zoom 1
    const ix = v.cx + (px - box / 2) / (s0 * v.zoom);  // ponto da foto sob o dedo/mouse
    const iy = v.cy + (py - box / 2) / (s0 * v.zoom);
    return clampView({ zoom: z, cx: ix - (px - box / 2) / (s0 * z), cy: iy - (py - box / 2) / (s0 * z) }, iw, ih);
}

/** Arrasta a foto: (dx, dy) em pixels da tela, dentro da janela de lado `box`. */
export function panBy(view, dx, dy, iw, ih, box) {
    const v = clampView(view, iw, ih);
    const s = (box / Math.min(iw, ih)) * v.zoom;
    return clampView({ ...v, cx: v.cx - dx / s, cy: v.cy - dy / s }, iw, ih);
}
