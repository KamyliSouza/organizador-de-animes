// Janela "Ajustar foto": a pessoa enquadra a foto dentro de um círculo (arrastar, zoom, teclado) antes de enviar.
// Resolve com o recorte { x, y, size } (em pixels da foto original) ou null se cancelar.
import { el, html } from '../core/dom.js';
import { openModal } from '../core/modal.js';
import { MAX_ZOOM, MIN_ZOOM, clampView, cropOf, initialView, panBy, zoomAt } from '../domain/avatarCrop.js';

export function openAvatarCropper(file) {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        let answer = null;
        let view = null;           // { zoom, cx, cy }
        let iw = 0, ih = 0;

        const content = el(html`
            <div class="stack crop-wrap">
                <p class="muted small">Arraste a foto para enquadrar e use o zoom. A parte que fica dentro do círculo é a que aparece no seu perfil.</p>
                <div class="crop-viewport" data-viewport tabindex="0" role="group"
                     aria-label="Área de recorte da foto. Use as setas do teclado para mover a foto, e mais ou menos para o zoom.">
                    <img class="crop-img" alt="" draggable="false" data-img>
                    <span class="crop-mask" aria-hidden="true"></span>
                </div>
                <div class="crop-zoom">
                    <label for="crop-zoom">Zoom</label>
                    <input type="range" id="crop-zoom" min="${MIN_ZOOM * 100}" max="${MAX_ZOOM * 100}" step="1" value="100" data-zoom>
                    <button type="button" class="button button-ghost button-sm" data-crop-reset>Centralizar</button>
                </div>
                <p class="field-hint" data-crop-error hidden role="alert"></p>
                <div class="modal-footer">
                    <button type="button" class="button button-ghost" data-modal-close>Cancelar</button>
                    <button type="button" class="button button-primary" data-crop-ok disabled>Usar esta foto</button>
                </div>
            </div>`);

        const viewport = content.querySelector('[data-viewport]');
        const img = content.querySelector('[data-img]');
        const zoomInput = content.querySelector('[data-zoom]');
        const okBtn = content.querySelector('[data-crop-ok]');
        // largura de layout (não muda durante a animação de abertura da janela, ao contrário de getBoundingClientRect)
        const box = () => viewport.clientWidth || 280;

        function render() {
            if (!view) return;
            view = clampView(view, iw, ih);
            const b = box();
            const s = (b / Math.min(iw, ih)) * view.zoom;       // tela por pixel da foto
            img.style.transform = `translate(${b / 2 - view.cx * s}px, ${b / 2 - view.cy * s}px) scale(${s})`;
            zoomInput.value = String(Math.round(view.zoom * 100));
        }
        const set = (next) => { view = clampView(next, iw, ih); render(); };

        img.addEventListener('load', () => {
            iw = img.naturalWidth; ih = img.naturalHeight;
            if (!iw || !ih) { fail(); return; }
            img.style.width = `${iw}px`; img.style.height = `${ih}px`;
            view = initialView(iw, ih);
            okBtn.disabled = false;
            render();
        });
        img.addEventListener('error', fail);
        function fail() {
            const msg = content.querySelector('[data-crop-error]');
            msg.textContent = 'Não foi possível ler essa imagem. Tente outro arquivo.';
            msg.hidden = false;
        }
        img.src = url;

        // --- arrastar (mouse, toque, caneta) e pinça com dois dedos -------------------------
        const pointers = new Map();
        let pinch = 0;
        viewport.addEventListener('pointerdown', (e) => {
            if (!view) return;
            viewport.setPointerCapture?.(e.pointerId);
            pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
        });
        viewport.addEventListener('pointermove', (e) => {
            const last = pointers.get(e.pointerId);
            if (!last || !view) return;
            if (pointers.size === 1) {
                view = panBy(view, e.clientX - last.x, e.clientY - last.y, iw, ih, box());
            } else if (pointers.size === 2) {
                pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
                const [a, b] = [...pointers.values()];
                const dist = Math.hypot(a.x - b.x, a.y - b.y);
                if (pinch > 0 && dist > 0) {
                    const r = viewport.getBoundingClientRect();
                    view = zoomAt(view, view.zoom * (dist / pinch), iw, ih, box(), (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
                }
                pinch = dist;
            }
            pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            render();
        });
        const release = (e) => { pointers.delete(e.pointerId); pinch = 0; };
        viewport.addEventListener('pointerup', release);
        viewport.addEventListener('pointercancel', release);
        viewport.addEventListener('lostpointercapture', release);

        // roda do mouse / pinça do touchpad: zoom no ponto sob o cursor
        viewport.addEventListener('wheel', (e) => {
            if (!view) return;
            e.preventDefault();
            const r = viewport.getBoundingClientRect();
            const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
            set(zoomAt(view, view.zoom * factor, iw, ih, box(), e.clientX - r.left, e.clientY - r.top));
        }, { passive: false });

        // teclado: as setas movem a foto, + e - dão zoom, 0 centraliza
        viewport.addEventListener('keydown', (e) => {
            if (!view) return;
            const step = (e.shiftKey ? 0.2 : 0.05) * box();
            const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];   // a foto anda para o lado da seta
            if (move) { e.preventDefault(); set(panBy(view, move[0], move[1], iw, ih, box())); return; }
            if (e.key === '+' || e.key === '=') { e.preventDefault(); set(zoomAt(view, view.zoom * 1.1, iw, ih, box())); }
            else if (e.key === '-' || e.key === '_') { e.preventDefault(); set(zoomAt(view, view.zoom / 1.1, iw, ih, box())); }
            else if (e.key === '0') { e.preventDefault(); set(initialView(iw, ih)); }
        });

        zoomInput.addEventListener('input', () => { if (view) set(zoomAt(view, Number(zoomInput.value) / 100, iw, ih, box())); });
        content.querySelector('[data-crop-reset]').addEventListener('click', () => { if (view) set(initialView(iw, ih)); });
        okBtn.addEventListener('click', () => { if (!view) return; answer = cropOf(view, iw, ih); modal.close(); });

        const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(render) : null;
        const modal = openModal({
            title: 'Ajustar foto', iconName: 'camera', size: 'sm', content, closeOnBackdrop: false, initialFocus: '[data-viewport]',
            onClose: () => { ro?.disconnect(); URL.revokeObjectURL(url); resolve(answer); },
        });
        ro?.observe(viewport);
    });
}
