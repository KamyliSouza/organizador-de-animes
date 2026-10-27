// Presets de cores dos perfis. Este arquivo é a FONTE: ele gera o css/palettes.css e confere o contraste (WCAG AA).
//
//   node tools/palettes.mjs          → confere o contraste e escreve css/palettes.css
//   node tools/palettes.mjs --check  → só confere (sai com erro se alguma combinação ficar abaixo de AA)
//
// Para criar um preset novo: copie um bloco de PRESETS, troque o id e as cores, rode o comando acima
// e adicione o id e o nome em js/domain/palettes.js (e no banco nada muda: o campo aceita qualquer id curto).
import fs from 'node:fs';

// ----- cores que NÃO mudam entre presets (as mesmas do css/tokens.css) ------------------------------
const FIXED = {
    light: { text: '#2b2b2b', subtitle: '#666666', muted: '#726371', notice: '#555555', watching: '#1d4ed8', planned: '#b45309', completed: '#047857', onHold: '#4f46e5', dropped: '#52525b', filme: '#be123c', serie: '#0369a1', danger: '#be123c', star: '#d97706' },
    dark:  { text: '#f0e6f0', subtitle: '#bfa9be', muted: '#a894a7', notice: '#e0d0df', watching: '#93c5fd', planned: '#fcd34d', completed: '#6ee7b7', onHold: '#a5b4fc', dropped: '#a1a1aa', filme: '#fda4af', serie: '#7dd3fc', danger: '#fda4af', star: '#fbbf24' },
};

// ----- presets ----------------------------------------------------------------------------------------
// primary = cor de destaque (bordas, brilhos, foco) · text = cor de links/títulos coloridos · button = fundo dos botões
// bg = fundo da página · modal = fundo dos modais · (escuro) surface/deep = painéis e barra
// `over` troca textos fixos (usado só no alto contraste).
export const PRESETS = [
    { id: 'default', name: 'Ameixa',
      light: { primary: '#B35EAF', hover: '#9b4d97', text: '#92488e', button: '#9b4d97', buttonHover: '#843f80', buttonText: '#ffffff', bg: '#f7eff7', modal: '#fdf8fd' },
      dark:  { primary: '#d178cd', hover: '#b35eaf', text: '#d178cd', button: '#d178cd', buttonHover: '#e08ddc', buttonText: '#1a0f1a', bg: '#121212', modal: '#1d1720', surface: '#1e1820', deep: '#19141b' } },
    { id: 'oceano', name: 'Oceano',
      light: { primary: '#2b8aa3', hover: '#0e7490', text: '#0d6d87', button: '#0e7490', buttonHover: '#155e75', buttonText: '#ffffff', bg: '#eef7f9', modal: '#f8fcfd' },
      dark:  { primary: '#38bdf8', hover: '#0ea5e9', text: '#7dd3fc', button: '#38bdf8', buttonHover: '#7dd3fc', buttonText: '#06202e', bg: '#0f1417', modal: '#162026', surface: '#162026', deep: '#121b20' } },
    { id: 'floresta', name: 'Floresta',
      light: { primary: '#3f9b62', hover: '#15803d', text: '#166534', button: '#15803d', buttonHover: '#166534', buttonText: '#ffffff', bg: '#f0f7f1', modal: '#f9fcf9' },
      dark:  { primary: '#4ade80', hover: '#22c55e', text: '#86efac', button: '#4ade80', buttonHover: '#86efac', buttonText: '#052e16', bg: '#0f1511', modal: '#17211a', surface: '#17211a', deep: '#121b15' } },
    { id: 'por-do-sol', name: 'Pôr do sol',
      light: { primary: '#c8642a', hover: '#c2410c', text: '#9a3412', button: '#c2410c', buttonHover: '#9a3412', buttonText: '#ffffff', bg: '#fdf3ec', modal: '#fffaf6' },
      dark:  { primary: '#fb923c', hover: '#f97316', text: '#fdba74', button: '#fb923c', buttonHover: '#fdba74', buttonText: '#2a1002', bg: '#16110d', modal: '#241912', surface: '#241912', deep: '#1c140f' } },
    { id: 'cereja', name: 'Cereja',
      light: { primary: '#d2506f', hover: '#be123c', text: '#be123c', button: '#be123c', buttonHover: '#9f1239', buttonText: '#ffffff', bg: '#fdf0f3', modal: '#fff8fa' },
      dark:  { primary: '#fb7185', hover: '#f43f5e', text: '#fda4af', button: '#fb7185', buttonHover: '#fda4af', buttonText: '#2a0a10', bg: '#160e10', modal: '#251619', surface: '#251619', deep: '#1d1214' } },
    { id: 'indigo', name: 'Índigo',
      light: { primary: '#6366f1', hover: '#4338ca', text: '#4338ca', button: '#4338ca', buttonHover: '#3730a3', buttonText: '#ffffff', bg: '#f1f1fc', modal: '#f9f9ff' },
      dark:  { primary: '#818cf8', hover: '#6366f1', text: '#a5b4fc', button: '#818cf8', buttonHover: '#a5b4fc', buttonText: '#11103a', bg: '#0f1018', modal: '#171827', surface: '#171827', deep: '#12131f' } },
    { id: 'grafite', name: 'Grafite',
      light: { primary: '#71717a', hover: '#3f3f46', text: '#3f3f46', button: '#3f3f46', buttonHover: '#27272a', buttonText: '#ffffff', bg: '#f4f4f5', modal: '#fafafa' },
      dark:  { primary: '#a1a1aa', hover: '#d4d4d8', text: '#d4d4d8', button: '#d4d4d8', buttonHover: '#f4f4f5', buttonText: '#18181b', bg: '#121212', modal: '#1f1f22', surface: '#1c1c1f', deep: '#17171a' } },
    { id: 'alto-contraste', name: 'Alto contraste',
      light: { primary: '#000000', hover: '#000000', text: '#000000', button: '#000000', buttonHover: '#333333', buttonText: '#ffffff', bg: '#ffffff', modal: '#ffffff',
               over: { text: '#000000', subtitle: '#1f1f1f', muted: '#2e2e2e', notice: '#1f1f1f', planned: '#7c2d12', filme: '#9f1239', serie: '#075985', dropped: '#3f3f46' } },
      dark:  { primary: '#ffe500', hover: '#ffe500', text: '#ffe500', button: '#ffe500', buttonHover: '#ffffff', buttonText: '#000000', bg: '#000000', modal: '#000000', surface: '#0a0a0a', deep: '#000000',
               over: { text: '#ffffff', subtitle: '#f2f2f2', muted: '#e0e0e0', notice: '#f2f2f2' } } },
];

// ----- cálculo -------------------------------------------------------------------------------------------
const rgb = (hex) => { const h = hex.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const toHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const mix = (top, a, under) => { const t = rgb(top); const u = rgb(under); return toHex(t.map((v, i) => v * a + u[i] * (1 - a))); };   // `top` com opacidade `a` sobre `under`
const lum = (hex) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; const [r, g, b] = rgb(hex); return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
export const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const rgba = (hex, a) => `rgba(${rgb(hex).join(', ')}, ${a})`;

/** Todas as variáveis CSS de um preset em um modo (as mesmas chaves sempre, para o seletor de cores mostrar certo nos dois temas). */
function tokens(p, mode) {
    const c = p[mode]; const dark = mode === 'dark'; const hc = p.id === 'alto-contraste';
    const t = {
        '--primary-color': c.primary, '--primary-hover': c.hover, '--primary-soft': rgba(c.primary, dark ? 0.12 : 0.08), '--primary-text': c.text,
        '--button-bg': c.button, '--button-bg-hover': c.buttonHover, '--button-text': c.buttonText,
        '--bg-color': c.bg,
        '--card-border': rgba(c.primary, hc ? 1 : dark ? 0.35 : 0.30), '--card-border-strong': rgba(dark && !hc ? mix('#ffffff', 0.35, c.primary) : c.primary, hc ? 1 : dark ? 0.58 : 0.46),
        '--notice-bg': rgba(c.primary, hc ? 0.1 : dark ? 0.12 : 0.08),
        '--modal-bg': c.modal,
        '--focus-ring': `0 0 0 3px ${rgba(c.button, hc ? 1 : dark ? 0.45 : 0.35)}`,
        '--shadow-soft': dark ? '0 4px 14px rgba(0, 0, 0, 0.35)' : `0 4px 14px ${rgba(c.hover, 0.12)}`,
        '--overlay-bg': dark ? 'rgba(0, 0, 0, 0.62)' : rgba(mix('#000000', 0.8, c.hover), 0.45),
    };
    if (dark) {
        Object.assign(t, {
            '--card-bg': rgba(c.surface, 0.85), '--footer-bg': rgba(c.deep, 0.85), '--nav-bg': rgba(c.deep, 0.88), '--input-bg': rgba(mix('#000000', 0.5, c.deep), 0.65),
        });
    } else {
        Object.assign(t, { '--card-bg': 'rgba(255, 255, 255, 0.92)', '--footer-bg': 'rgba(255, 255, 255, 0.85)', '--nav-bg': 'rgba(255, 255, 255, 0.85)', '--input-bg': 'rgba(255, 255, 255, 0.95)' });
    }
    // textos fixos só mudam quando o preset pede (alto contraste)
    const f = { ...FIXED[mode], ...(c.over || {}) };
    if (c.over) Object.assign(t, { '--text-color': f.text, '--subtitle-color': f.subtitle, '--muted-color': f.muted, '--notice-text': f.notice });
    if (c.over?.planned) t['--st-planned'] = f.planned;
    if (c.over?.filme) t['--cat-filme'] = f.filme;
    if (c.over?.serie) t['--cat-serie'] = f.serie;
    if (c.over?.dropped) t['--st-dropped'] = f.dropped;
    return t;
}

// Para manter as MESMAS chaves nos dois modos (o chip de prévia dentro do tema oposto), completa o que faltar com o padrão do tema.
const DEFAULT_TEXT = { light: { '--text-color': '#2b2b2b', '--subtitle-color': '#666666', '--muted-color': '#726371', '--notice-text': '#555555', '--st-planned': '#b45309', '--cat-filme': '#be123c', '--cat-serie': '#0369a1', '--st-dropped': '#52525b' },
                      dark:  { '--text-color': '#f0e6f0', '--subtitle-color': '#bfa9be', '--muted-color': '#a894a7', '--notice-text': '#e0d0df', '--st-planned': '#fcd34d', '--cat-filme': '#fda4af', '--cat-serie': '#7dd3fc', '--st-dropped': '#a1a1aa' } };
function fullTokens(p, mode) {
    const t = tokens(p, mode);
    // textos sempre presentes: um preset com textos próprios num modo e sem no outro não "vaza" valores entre os temas
    for (const [k, v] of Object.entries(DEFAULT_TEXT[mode])) if (!(k in t)) t[k] = v;
    return t;
}

// ----- conferência de contraste ---------------------------------------------------------------------------
export function check() {
    const problems = []; const lines = [];
    for (const p of PRESETS) for (const mode of ['light', 'dark']) {
        const T = fullTokens(p, mode);
        const solid = (v) => (v.startsWith('#') ? v : null);
        const bg = T['--bg-color'];
        const cardRgba = T['--card-bg'].match(/[\d.]+/g).map(Number);
        const card = mix(toHex(cardRgba.slice(0, 3)), cardRgba[3], bg);
        const noticeA = Number(T['--notice-bg'].match(/[\d.]+/g)[3]);
        const prim = p[mode].primary;
        const notice = mix(prim, noticeA, bg);
        const pairs = [
            ['texto/página', T['--text-color'], bg, 4.5], ['texto/card', T['--text-color'], card, 4.5],
            ['subtítulo/página', T['--subtitle-color'], bg, 4.5], ['subtítulo/card', T['--subtitle-color'], card, 4.5],
            ['apagado/card', T['--muted-color'], card, 4.5], ['apagado/página', T['--muted-color'], bg, 4.5],
            ['aviso/aviso', T['--notice-text'], notice, 4.5],
            ['link/página', T['--primary-text'], bg, 4.5], ['link/card', T['--primary-text'], card, 4.5], ['link/aviso', T['--primary-text'], notice, 4.5],
            ['botão', T['--button-text'], T['--button-bg'], 4.5], ['botão (hover)', T['--button-text'], T['--button-bg-hover'], 4.5],
            ['destaque/página (componente)', prim, bg, 3], ['botão/página (componente)', T['--button-bg'], bg, 3],
            ['assistindo', FIXED[mode].watching, card, 4.5], ['quero ver', T['--st-planned'], card, 4.5], ['concluído', FIXED[mode].completed, card, 4.5], ['em espera', FIXED[mode].onHold, card, 4.5],
            ['dropado', T['--st-dropped'], card, 4.5], ['filme', T['--cat-filme'], card, 4.5], ['série', T['--cat-serie'], card, 4.5], ['perigo', FIXED[mode].danger, card, 4.5],
            ['estrela (componente)', FIXED[mode].star, card, 3],
        ];
        const worst = { v: 99, n: '' };
        for (const [name, fg, back, min] of pairs) {
            if (!solid(fg) || !solid(back)) continue;
            const r = ratio(fg, back);
            if (r < worst.v) { worst.v = r; worst.n = name; }
            if (r < min) problems.push(`${p.id}/${mode}: ${name} = ${r.toFixed(2)} (mín. ${min})`);
        }
        lines.push(`${p.id.padEnd(15)} ${mode.padEnd(5)} pior combinação: ${worst.n} = ${worst.v.toFixed(2)}`);
    }
    return { problems, lines };
}

// ----- CSS -----------------------------------------------------------------------------------------------
function block(selectors, t, indent = '') {
    return `${selectors.map((x) => indent + x).join(',\n')} {\n${Object.entries(t).map(([k, v]) => `${indent}    ${k}: ${v};`).join('\n')}\n${indent}}\n`;
}
export function css() {
    let out = `/* =========================================================
   PRESETS DE CORES DO PERFIL — GERADO por tools/palettes.mjs (não edite à mão)
   O preset vale em qualquer elemento com data-palette="id": no <html> (o site todo da pessoa,
   ou o perfil que ela está visitando) e nas amostras do seletor de cores.
   ========================================================= */
`;
    for (const p of PRESETS) {
        const a = `[data-palette="${p.id}"]`;
        out += `\n/* ${p.name} */\n`;
        out += block([a], fullTokens(p, 'light'));
        out += block([`:root[data-theme="dark"] ${a}`, `:root[data-theme="dark"]${a}`], fullTokens(p, 'dark'));
        out += `@media (prefers-color-scheme: dark) {\n${block([`:root:not([data-theme]) ${a}`, `:root:not([data-theme])${a}`], fullTokens(p, 'dark'), '    ')}}\n`;
    }
    return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const { problems, lines } = check();
    console.log(lines.join('\n'));
    if (problems.length) { console.log('\nABAIXO DO MÍNIMO:\n' + problems.join('\n')); process.exitCode = 1; }
    else console.log('\nTodas as combinações passam (texto ≥ 4,5:1, componentes ≥ 3:1).');
    if (!process.argv.includes('--check') && !problems.length) {
        fs.writeFileSync(new URL('../css/palettes.css', import.meta.url), css());
        console.log('css/palettes.css escrito.');
    }
}
