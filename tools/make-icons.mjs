// Gera os ícones do app (PWA) a partir de favicon.svg. Uso (só quem mantém o site; precisa do Playwright): node tools/make-icons.mjs
//  icon-192.png / icon-512.png  → ícone normal (cantos arredondados, como o favicon)
//  icon-maskable-512.png        → fundo até as bordas e desenho menor (zona segura de 80%): o Android recorta no formato que quiser
//  apple-touch-icon.png (180)   → fundo até as bordas (o iOS arredonda sozinho)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright');
const svg = readFileSync(join(root, 'favicon.svg'), 'utf8');
const glyph = svg.match(/<path[^>]*>/)[0];
const defs = svg.match(/<defs>[\s\S]*?<\/defs>/)[0];

const make = ({ rx, scale }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${defs}<rect width="64" height="64" rx="${rx}" fill="url(#g)"/><g transform="translate(32 32) scale(${scale}) translate(-32 -32)">${glyph}</g></svg>`;
const jobs = [
    ['icon-192.png', 192, make({ rx: 16, scale: 1 })],
    ['icon-512.png', 512, make({ rx: 16, scale: 1 })],
    ['icon-maskable-512.png', 512, make({ rx: 0, scale: 0.78 })],
    ['apple-touch-icon.png', 180, make({ rx: 0, scale: 0.9 })],
];

mkdirSync(join(root, 'icons'), { recursive: true });
const browser = await chromium.launch();
for (const [name, size, markup] of jobs) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${markup}`);
    writeFileSync(join(root, 'icons', name), await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } }));
    await page.close();
    console.log('ok', name);
}
await browser.close();
