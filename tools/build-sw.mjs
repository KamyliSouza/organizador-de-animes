#!/usr/bin/env node
// Gera (ou confere) a lista de arquivos e a versão do service worker (sw.js).
// A versão é um resumo (hash) do conteúdo de todos os arquivos guardados: mudou qualquer arquivo do site → sw.js muda → os aparelhos baixam tudo de novo
// e oferecem a atualização. js/config.js NÃO entra (são as chaves de cada pessoa; o sw.js trata esse arquivo à parte, sempre pela internet primeiro).
//   node tools/build-sw.mjs --check   confere (usado nos testes)
//   node tools/build-sw.mjs --write   reescreve o trecho de sw.js — rode depois de mexer em qualquer arquivo do site
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const START = '// precache:start (gerado por tools/build-sw.mjs; não edite à mão)';
const END = '// precache:end';
const SKIP = new Set(['js/config.js']);
const FIXED = ['index.html', 'favicon.svg', 'manifest.webmanifest'];

function walk(dir, ext, out = []) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) return out;
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
        const rel = path.posix.join(dir, entry.name);
        if (entry.isDirectory()) walk(rel, ext, out);
        else if (ext.some((e) => entry.name.endsWith(e))) out.push(rel);
    }
    return out;
}

export function files() {
    const manifests = fs.readdirSync(ROOT).filter((f) => /^manifest(-[a-z-]+)?\.webmanifest$/.test(f));     // um por paleta (tools/make-manifests.mjs)
    const list = [...FIXED, ...manifests, ...walk('css', ['.css']), ...walk('js', ['.js']), ...walk('icons', ['.png'])]
        .filter((f) => !SKIP.has(f) && fs.existsSync(path.join(ROOT, f)));
    return [...new Set(list)].sort();
}

export function version(list = files()) {
    const h = crypto.createHash('sha256');
    for (const f of list) {
        h.update(f + '\0');
        h.update(fs.readFileSync(path.join(ROOT, f)).toString('utf8').replace(/\r\n/g, '\n'));   // fim de linha do Windows não conta como mudança
        h.update('\0');
    }
    return h.digest('hex').slice(0, 12);
}

export function block() {
    const list = files();
    return `${START}\nconst VERSION = '${version(list)}';\nconst PRECACHE = [\n${list.map((f) => `    '${f}',`).join('\n')}\n];\n${END}`;
}

const swPath = path.join(ROOT, 'sw.js');
const current = () => {
    const src = fs.readFileSync(swPath, 'utf8');
    const a = src.indexOf(START), b = src.indexOf(END);
    if (a < 0 || b < 0) throw new Error('Marcadores não encontrados em sw.js');
    return { src, a, b: b + END.length };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const mode = process.argv[2];
    const { src, a, b } = current();
    const want = block();
    if (mode === '--write') {
        fs.writeFileSync(swPath, src.slice(0, a) + want + src.slice(b));
        console.log(`sw.js atualizado (${files().length} arquivos, versão ${version()})`);
    } else if (mode === '--check') {
        if (src.slice(a, b) !== want) { console.error('sw.js desatualizado: rode  node tools/build-sw.mjs --write'); process.exit(1); }
        console.log(`sw.js em dia (${files().length} arquivos, versão ${version()})`);
    } else {
        console.error('Use --check ou --write');
        process.exit(2);
    }
}
