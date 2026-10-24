// Cartão de compartilhamento: imagem PNG desenhada em <canvas> (sem bibliotecas externas).
import { config } from '../config.js';
import { copyText, downloadBlob, el, html, on } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { openModal } from '../core/modal.js';
import { toast } from '../core/toast.js';
import { STATUSES, progressOf } from '../domain/entry.js';
import { starsText } from './mediaCard.js';

const W = 1080;
const H = 1350;

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function wrapLines(ctx, text, maxWidth, maxLines) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (ctx.measureText(test).width <= maxWidth || !line) line = test;
        else { lines.push(line); line = w; }
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) {
        lines.length = maxLines;
        let last = lines[maxLines - 1];
        while (last.length > 1 && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1);
        lines[maxLines - 1] = last + '…';
    }
    return lines;
}

function loadCover(url) {
    return new Promise((resolve) => {
        if (!url) { resolve(null); return; }
        const img = new Image();
        img.crossOrigin = 'anonymous';          // sem CORS o canvas não poderia exportar a imagem
        img.referrerPolicy = 'no-referrer';
        const timer = setTimeout(() => resolve(null), 9000);
        img.onload = () => { clearTimeout(timer); resolve(img); };
        img.onerror = () => { clearTimeout(timer); resolve(null); };
        img.src = url;
    });
}

/** Desenha o cartão e informa se a capa pôde ser incluída. */
export async function drawShareCard(entry, owner = '') {
    try { await document.fonts.load('800 60px Nunito'); } catch { /* usa a fonte do sistema */ }
    const cover = await loadCover(entry.coverImage);

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const font = (weight, size) => `${weight} ${size}px Nunito, system-ui, sans-serif`;

    // Fundo
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#2a1230');
    bg.addColorStop(1, '#130b16');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(180, 120, 20, 180, 120, 700);
    glow.addColorStop(0, 'rgba(209,120,205,.38)');
    glow.addColorStop(1, 'rgba(209,120,205,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Moldura
    ctx.strokeStyle = 'rgba(209,120,205,.55)';
    ctx.lineWidth = 4;
    roundRect(ctx, 28, 28, W - 56, H - 56, 48);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    // Marca
    ctx.fillStyle = '#d178cd';
    ctx.font = font(900, 38);
    ctx.fillText(config.siteName.toUpperCase(), W / 2, 112);

    // Capa
    const pw = 420, ph = 630, px = (W - pw) / 2, py = 160;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.55)';
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 20;
    roundRect(ctx, px, py, pw, ph, 36);
    ctx.fillStyle = '#3a1d40';
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundRect(ctx, px, py, pw, ph, 36);
    ctx.clip();
    if (cover) {
        const scale = Math.max(pw / cover.width, ph / cover.height);
        const dw = cover.width * scale, dh = cover.height * scale;
        ctx.drawImage(cover, px + (pw - dw) / 2, py + (ph - dh) / 2, dw, dh);
    } else {
        ctx.fillStyle = 'rgba(209,120,205,.5)';
        ctx.font = font(900, 150);
        ctx.fillText('▶', W / 2, py + ph / 2 + 50);
    }
    ctx.restore();

    // Título
    ctx.fillStyle = '#f6e9f6';
    ctx.font = font(900, 62);
    const lines = wrapLines(ctx, entry.title, 900, 2);
    lines.forEach((l, i) => ctx.fillText(l, W / 2, 880 + i * 70));
    const afterTitle = 880 + (lines.length - 1) * 70;

    // Status
    const label = STATUSES[entry.status].label.toUpperCase();
    ctx.font = font(900, 30);
    const pillW = ctx.measureText(label).width + 64;
    const pillY = afterTitle + 38;
    roundRect(ctx, (W - pillW) / 2, pillY, pillW, 58, 29);
    ctx.fillStyle = 'rgba(209,120,205,.25)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(209,120,205,.7)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#e9a8e5';
    ctx.fillText(label, W / 2, pillY + 40);

    // Progresso
    const { watched, total, pct } = progressOf(entry);
    const barW = 700, barX = (W - barW) / 2, barY = pillY + 112;
    if (entry.status !== 'planned') {
        roundRect(ctx, barX, barY, barW, 20, 10);
        ctx.fillStyle = 'rgba(255,255,255,.14)';
        ctx.fill();
        if (pct > 0) {
            roundRect(ctx, barX, barY, Math.max(20, (barW * pct) / 100), 20, 10);
            ctx.fillStyle = '#d178cd';
            ctx.fill();
        }
        ctx.fillStyle = '#cdb6cc';
        ctx.font = font(700, 32);
        ctx.fillText(`${watched} / ${total} episódios · ${pct}%`, W / 2, barY + 66);
    }

    // Estrelas
    const starsY = entry.status !== 'planned' ? barY + 138 : barY + 40;
    ctx.font = font(800, 56);
    if (entry.rating > 0) {
        ctx.fillStyle = '#fbbf24';
        ctx.fillText(starsText(entry.rating), W / 2, starsY);
    } else {
        ctx.fillStyle = '#8f7a8e';
        ctx.font = font(700, 32);
        ctx.fillText('Sem nota', W / 2, starsY);
    }

    // Rodapé
    ctx.fillStyle = '#9d869c';
    ctx.font = font(700, 30);
    ctx.fillText(owner ? `@${owner} · ${config.siteName}` : config.siteName, W / 2, H - 70);

    return { canvas, coverIncluded: Boolean(cover) || !entry.coverImage };
}

const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'obra';

export async function openShareModal({ entry, owner = '' }) {
    const content = el(html`
        <div class="stack">
            <div class="share-preview" data-preview aria-live="polite"><span class="muted">Gerando imagem…</span></div>
            <p class="muted small center" data-hint hidden>A capa não pôde ser incluída (o site da imagem não permite). O restante do cartão funciona normalmente.</p>
            <div class="modal-footer" style="justify-content:center">
                <button type="button" class="button button-primary" data-act="download" disabled>${icon('download', { size: 16 })} Baixar imagem</button>
                <button type="button" class="button button-secondary" data-act="copy">${icon('copy', { size: 16 })} Copiar texto</button>
            </div>
        </div>`);

    const modal = openModal({ title: 'Cartão de compartilhamento', iconName: 'share', content });
    let canvas = null;

    on(content, 'click', '[data-act="download"]', () => {
        canvas?.toBlob((blob) => {
            if (!blob) { toast('Não foi possível gerar a imagem.', { type: 'error' }); return; }
            downloadBlob(blob, `kamylist-${slug(entry.title)}.png`);
        }, 'image/png');
    });

    on(content, 'click', '[data-act="copy"]', async () => {
        const stars = entry.rating > 0 ? ` (${'⭐'.repeat(entry.rating)})` : '';
        const text = `🎬 **${entry.title}** — ${STATUSES[entry.status].label}${stars} via ${config.siteName}`;
        const copied = await copyText(text);
        toast(copied ? 'Texto copiado!' : 'Não foi possível copiar.', { type: copied ? 'success' : 'error' });
    });

    const result = await drawShareCard(entry, owner);
    if (!document.body.contains(content)) return modal;   // fechou enquanto gerava
    canvas = result.canvas;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `Cartão de ${entry.title}`);
    const preview = content.querySelector('[data-preview]');
    preview.replaceChildren(canvas);
    content.querySelector('[data-act="download"]').disabled = false;
    content.querySelector('[data-hint]').hidden = result.coverIncluded;
    return modal;
}
