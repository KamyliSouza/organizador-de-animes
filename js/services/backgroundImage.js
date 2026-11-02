// Prepara a imagem de FUNDO do perfil NO NAVEGADOR antes de enviar: reduz (no máximo 1600 px no lado maior, sem ampliar)
// e comprime em WebP (JPEG nos navegadores que não geram WebP). O resultado costuma ter 60 a 200 KB.
// O plano gratuito do Supabase não tem redimensionamento de imagens, por isso essa etapa é feita aqui.
// O bucket "backgrounds" aceita até 384 KB: este módulo mira em 360 KB e reduz a imagem mais um pouco se precisar.
import { AppError } from '../core/errors.js';
import { decode, sizeOf, toBlob } from './avatarImage.js';

export const BACKGROUND_MAX_SIDE = 1600;
export const BACKGROUND_MAX_BYTES = 360 * 1024;
const MAX_INPUT_BYTES = 20 * 1024 * 1024;          // imagem original (antes de reduzir)
const QUALITIES = [0.8, 0.68, 0.56, 0.44, 0.32];
const SCALES = [1, 0.8, 0.64, 0.5];                // se nem a menor qualidade couber, reduz também as dimensões
const INPUT_TYPE = /^image\/(png|jpe?g|webp|gif|bmp|avif)$/i;
const BAD_FILE = 'Escolha uma imagem (JPG, PNG, WebP ou GIF) de até 20 MB.';

/** Confere tipo e tamanho do arquivo escolhido. Lança AppError com mensagem pronta. */
export function checkBackgroundFile(file) {
    if (!file || !INPUT_TYPE.test(file.type || '')) throw new AppError(BAD_FILE);
    if (file.size > MAX_INPUT_BYTES) throw new AppError(BAD_FILE);
}

/** Dimensões finais: cabe em 1600 px no lado maior, nunca amplia. */
export function fitSize(w, h, maxSide = BACKGROUND_MAX_SIDE) {
    const k = Math.min(1, maxSide / Math.max(w, h));
    return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
}

function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
}

/** Reduz até (width x height) em etapas (metade por vez) para ficar nítido. `background` pinta o fundo (JPEG não tem transparência). */
function resize(source, width, height, background = null) {
    const { w, h } = sizeOf(source);
    let current = source;
    let cw = w, ch = h;
    while (cw / 2 >= width && ch / 2 >= height) {
        const nw = Math.max(width, Math.floor(cw / 2));
        const nh = Math.max(height, Math.floor(ch / 2));
        const c = makeCanvas(nw, nh);
        const ctx = c.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(current, 0, 0, cw, ch, 0, 0, nw, nh);
        current = c; cw = nw; ch = nh;
    }
    const out = makeCanvas(width, height);
    const ctx = out.getContext('2d');
    if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, width, height); }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(current, 0, 0, cw, ch, 0, 0, width, height);
    return out;
}

/**
 * file (File) -> { blob, type, width, height, originalBytes }. Lança AppError com mensagem pronta.
 * `type` é "image/webp" ou "image/jpeg".
 */
export async function prepareBackground(file, { maxBytes = BACKGROUND_MAX_BYTES, maxSide = BACKGROUND_MAX_SIDE } = {}) {
    checkBackgroundFile(file);
    const { source, release } = await decode(file);
    try {
        const { w, h } = sizeOf(source);
        if (!w || !h) throw new AppError('Não foi possível ler essa imagem. Tente outro arquivo.');
        for (const type of ['image/webp', 'image/jpeg']) {
            let unsupported = false;
            for (const scale of SCALES) {
                const { width, height } = fitSize(w * scale, h * scale, maxSide);
                const canvas = resize(source, width, height, type === 'image/jpeg' ? '#ffffff' : null);
                for (const q of QUALITIES) {
                    const blob = await toBlob(canvas, type, q);
                    if (!blob || blob.type !== type) { unsupported = true; break; }   // este navegador não gera esse formato: tenta o próximo
                    if (blob.size <= maxBytes) return { blob, type: blob.type, width, height, originalBytes: file.size };
                }
                if (unsupported) break;           // reduzir as dimensões não adianta: passa direto para o JPEG
            }
        }
        throw new AppError('Não consegui reduzir essa imagem o bastante. Tente outra.');
    } finally {
        release();
        if (typeof source.close === 'function') source.close();
    }
}
