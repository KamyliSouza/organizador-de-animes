// Prepara a foto de perfil NO NAVEGADOR antes de enviar: recorta um quadrado no centro,
// reduz para 128x128 e comprime (WebP; JPEG nos navegadores que não geram WebP).
// O resultado costuma ter 3 a 10 KB. O plano gratuito do Supabase não tem redimensionamento
// de imagens, por isso essa etapa é feita aqui.
import { AppError } from '../core/errors.js';

export const AVATAR_SIZE = 128;
export const AVATAR_MAX_BYTES = 60 * 1024;       // o bucket aceita até 64 KB: deixa uma folga
const MAX_INPUT_BYTES = 12 * 1024 * 1024;        // foto original (antes de reduzir)
const QUALITIES = [0.86, 0.72, 0.58, 0.45, 0.32];
const INPUT_TYPE = /^image\/(png|jpe?g|webp|gif|bmp|avif)$/i;

const BAD_FILE = 'Escolha uma imagem (JPG, PNG, WebP ou GIF) de até 12 MB.';

/** Lê a imagem respeitando a rotação do celular (EXIF). */
async function decode(file) {
    if (typeof createImageBitmap === 'function') {
        try { return { source: await createImageBitmap(file, { imageOrientation: 'from-image' }), release() {} }; } catch { /* tenta pelo <img> */ }
    }
    const url = URL.createObjectURL(file);
    try {
        const img = await new Promise((resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = () => reject(new Error('decode'));
            el.src = url;
        });
        return { source: img, release: () => URL.revokeObjectURL(url) };
    } catch {
        URL.revokeObjectURL(url);
        throw new AppError('Não foi possível ler essa imagem. Tente outro arquivo.');
    }
}

const sizeOf = (src) => ({ w: src.naturalWidth || src.videoWidth || src.width, h: src.naturalHeight || src.videoHeight || src.height });

function makeCanvas(size) {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    return c;
}

/** Recorte quadrado central, reduzindo em etapas (metade por vez) para ficar nítido. */
function squareThumb(source, background) {
    const { w, h } = sizeOf(source);
    if (!w || !h) throw new AppError('Não foi possível ler essa imagem. Tente outro arquivo.');
    const side = Math.min(w, h);
    let sx = (w - side) / 2, sy = (h - side) / 2;

    let size = side;
    let current = source;
    // etapas: enquanto o quadrado for mais que o dobro do alvo, reduz pela metade
    while (size / 2 >= AVATAR_SIZE) {
        const next = Math.max(AVATAR_SIZE, Math.floor(size / 2));
        const c = makeCanvas(next);
        const ctx = c.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(current, sx, sy, size, size, 0, 0, next, next);
        current = c; sx = 0; sy = 0; size = next;
    }
    const out = makeCanvas(AVATAR_SIZE);
    const ctx = out.getContext('2d');
    if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE); }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(current, sx, sy, size, size, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    return out;
}

const toBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * file (File) -> { blob, type, width, height }. Lança AppError com mensagem pronta.
 * `type` é "image/webp" ou "image/jpeg".
 */
export async function prepareAvatar(file) {
    if (!file || !INPUT_TYPE.test(file.type || '')) throw new AppError(BAD_FILE);
    if (file.size > MAX_INPUT_BYTES) throw new AppError(BAD_FILE);

    const { source, release } = await decode(file);
    try {
        // 1) WebP (com transparência)
        const webpCanvas = squareThumb(source, null);
        for (const q of QUALITIES) {
            const blob = await toBlob(webpCanvas, 'image/webp', q);
            if (!blob || blob.type !== 'image/webp') break;                 // este navegador não gera WebP: vai para JPEG
            if (blob.size <= AVATAR_MAX_BYTES) return { blob, type: blob.type, width: AVATAR_SIZE, height: AVATAR_SIZE };
        }
        // 2) JPEG (fundo branco no lugar da transparência)
        const jpegCanvas = squareThumb(source, '#ffffff');
        for (const q of QUALITIES) {
            const blob = await toBlob(jpegCanvas, 'image/jpeg', q);
            if (blob && blob.type === 'image/jpeg' && blob.size <= AVATAR_MAX_BYTES) return { blob, type: blob.type, width: AVATAR_SIZE, height: AVATAR_SIZE };
        }
        throw new AppError('Não consegui reduzir essa imagem o bastante. Tente outra.');
    } finally {
        release();
        if (typeof source.close === 'function') source.close();
    }
}
