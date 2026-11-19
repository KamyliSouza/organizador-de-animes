// Gera um manifesto por paleta (manifest-<paleta>.webmanifest) a partir de manifest.webmanifest, trocando só theme_color e background_color
// pelas cores da paleta (tema claro). Motivo: no Android, a barra de navegação de baixo e a tela de abertura do app instalado usam as cores do
// MANIFESTO (a página não consegue mudá-las em tempo real). O site troca o <link rel="manifest"> para o da paleta da pessoa (js/core/themeColor.js
// e js/boot.js); o Chrome aplica ao app instalado na próxima atualização dele (ou ao instalar de novo).
// Uso (só quem mantém o site; precisa do Playwright): node tools/make-manifests.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright');
const base = JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8'));
const { PALETTES } = await import(pathToFileURL(join(root, 'js/domain/palettes.js')).href);

const browser = await chromium.launch();
const page = await browser.newPage({ colorScheme: 'light' });
const css = ['css/tokens.css', 'css/palettes.css'].map((f) => readFileSync(join(root, f), 'utf8')).join('\n');
await page.setContent(`<style>${css}</style>`);
const hex = (page, name) => page.evaluate((n) => { const c = document.createElement('canvas').getContext('2d'); c.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return c.fillStyle; }, name);

for (const p of PALETTES) {
    if (p.id === 'default') continue;             // o padrão é o próprio manifest.webmanifest
    await page.evaluate((id) => document.documentElement.setAttribute('data-palette', id), p.id);
    const out = { ...base, theme_color: await hex(page, '--primary-color'), background_color: await hex(page, '--bg-color') };
    writeFileSync(join(root, `manifest-${p.id}.webmanifest`), JSON.stringify(out, null, 4) + '\n');
    console.log(p.id, out.theme_color, out.background_color);
}
await browser.close();
