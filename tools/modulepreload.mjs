#!/usr/bin/env node
// Gera (ou confere) a lista de <link rel="modulepreload"> do index.html.
// Sem isso o navegador descobre os módulos em cascata (main.js → ... → arquivo folha), uma viagem de rede por nível;
// com a lista ele baixa todos de uma vez. A lista é o grafo de `import` estáticos de js/main.js
// mais as telas e serviços que o primeiro desenho quase sempre usa (importados dinamicamente).
//   node tools/modulepreload.mjs --check   confere (usado nos testes)
//   node tools/modulepreload.mjs --write   reescreve o trecho do index.html
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ROOT_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const START = '<!-- modulepreload:start (gerado por tools/modulepreload.mjs; não edite à mão) -->';
const END = '<!-- modulepreload:end -->';
// Entram além do grafo estático: a tela inicial e o serviço de dados (o app pergunta ao config qual dos dois usa; os dois são pequenos).
const EXTRA = ['js/views/home.js', 'js/views/library.js', 'js/services/supabase-backend.js', 'js/services/local-backend.js'];

const IMPORT_RE = /(?:^|[;\n}])\s*(?:import|export)\s+(?:[^'"`;]*?\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]/g;

export function graph(rootDir = ROOT) {
    const seen = new Set();
    const visit = (rel) => {
        if (seen.has(rel)) return;
        const file = path.join(rootDir, rel);
        if (!fs.existsSync(file)) return;
        seen.add(rel);
        const src = fs.readFileSync(file, 'utf8');
        for (const m of src.matchAll(IMPORT_RE)) visit(path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1])));
    };
    visit('js/main.js');
    EXTRA.forEach(visit);
    return [...seen].sort();
}

const block = (list) => `${START}\n${list.map((f) => `    <link rel="modulepreload" href="${f}">`).join('\n')}\n    ${END}`;

export const expected = graph;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const indexPath = path.join(ROOT, 'index.html');
    const index = fs.readFileSync(indexPath, 'utf8');
    const want = block(expected());
    const re = new RegExp(`${START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
    if (process.argv.includes('--write')) {
        if (!re.test(index)) { console.error('Marcadores modulepreload não encontrados no index.html'); process.exit(1); }
        fs.writeFileSync(indexPath, index.replace(re, () => want));
        console.log(`modulepreload: ${expected().length} módulos gravados em index.html`);
    } else {
        const m = index.match(re);
        if (m && m[0] === want) console.log(`OK: modulepreload em dia (${expected().length} módulos)`);
        else { console.error('modulepreload desatualizado: rode  node tools/modulepreload.mjs --write'); process.exit(1); }
    }
}
