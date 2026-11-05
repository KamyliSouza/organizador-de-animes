// Segurança dos textos escritos pelas pessoas (nome, bio, título, tags, análise, anotações).
// Só contas simples, sem tela. As MESMAS regras existem no banco (sql/schema.sql: clean_text, norm_loose,
// text_has_blocked_term, link_hosts, text_has_bad_link): o banco é quem decide, aqui é a primeira camada e a que
// limpa o que já está salvo antes de mostrar. Se mudar algo aqui, mude lá (e rode tools/text-parity se existir no seu fluxo).
//
//   cleanUnicode  tira o que não se vê ou bagunça a tela: caracteres de controle, "invisíveis" (largura zero, setas de
//                 direção de texto), letras empilhadas sem fim (zalgo) e repetições absurdas ("aaaaaaaaaaaa...").
//   findLinkHosts / disallowedLinks   acham endereços de sites no texto e dizem quais não estão na lista de sites permitidos.
//   hasBlockedTerm   o texto usa alguma palavra da lista de palavras proibidas (com letra trocada por número, acento, letras repetidas...)?
//
// Nada aqui vira HTML: os textos continuam sendo mostrados como texto puro (o template `html` escapa tudo) e os links
// continuam NÃO clicáveis. A lista de palavras proibidas é só do painel da equipe e nunca é enviada ao navegador comum.

// Faixas (sem aspas: usadas dentro de [ ] com a flag u).
const EMOJI_RANGES = '\\u2190-\\u2BFF\\u{1F000}-\\u{1FAFF}\\uFE0F';
const COMBINING = '\\u0300-\\u036F\\u1AB0-\\u1AFF\\u1DC0-\\u1DFF\\u20D0-\\u20FF\\uFE20-\\uFE2F';

const SPACE_LIKE = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\t]/g;
const INVISIBLE = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F\\u00AD\\u034F\\u061C\\u115F\\u1160\\u17B4\\u17B5\\u180B-\\u180F'
    + '\\u200B\\u200C\\u200E\\u200F\\u202A-\\u202E\\u2060-\\u206F\\u2800\\u3164\\uFE00-\\uFE0E\\uFEFF\\uFFA0\\uFFF9-\\uFFFB'
    + '\\u{1D173}-\\u{1D17A}\\u{E0000}-\\u{E007F}\\u{E0100}-\\u{E01EF}]', 'gu');
// O "junta-letras" (U+200D) só fica quando liga dois emojis (como em emojis de família); solto, some.
const LONE_ZWJ = new RegExp(`(?<![${EMOJI_RANGES}])\\u200D|\\u200D(?![${EMOJI_RANGES}])`, 'gu');
const MARK_PILE = new RegExp(`([${COMBINING}])([${COMBINING}])[${COMBINING}]+`, 'gu');
const LONG_RUN = /([^\n])\1{10,}/gu;

/** Corta por caracteres (não por pedaços de UTF-16), como o banco conta. */
const clip = (s, max) => (Number.isFinite(max) && s.length > max ? Array.from(s).slice(0, max).join('') : s);

/**
 * Limpa um texto. `multiline`: mantém quebras de linha (no máximo uma linha em branco seguida); senão tudo vira uma linha só.
 * É idempotente: limpar de novo o resultado não muda nada.
 */
export function cleanUnicode(value, { multiline = false, max = Infinity } = {}) {
    let s = String(value ?? '');
    try { s = s.normalize('NFC'); } catch { /* navegador sem normalize: segue */ }
    s = s.replace(/\r\n?/g, '\n').replace(/[\u2028\u2029]/g, '\n');
    s = s.replace(SPACE_LIKE, ' ').replace(INVISIBLE, '').replace(LONE_ZWJ, '');
    s = s.replace(MARK_PILE, '$1$2');
    s = s.replace(LONG_RUN, (_, c) => c.repeat(10));
    s = s.replace(/ {2,}/g, ' ');
    if (multiline) s = s.replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n');
    else s = s.replace(/\n+/g, ' ').replace(/ {2,}/g, ' ');
    s = s.replace(/^[ \n]+|[ \n]+$/g, '');
    return clip(s, max);
}

// ---------------------------------------------------------------------------------------------------------------
// Palavras proibidas
// ---------------------------------------------------------------------------------------------------------------

// Acentos: cada grupo de letras vira a letra sem acento (maiúsculas também). Mesma tabela do banco (norm_loose).
const ACCENT_GROUPS = [
    ['áàâãäåÁÀÂÃÄÅ', 'a'], ['éèêëÉÈÊË', 'e'], ['íìîïÍÌÎÏ', 'i'], ['óòôõöøÓÒÔÕÖØ', 'o'], ['úùûüÚÙÛÜ', 'u'], ['ýÿÝŸ', 'y'], ['çÇ', 'c'], ['ñÑ', 'n'],
];
const ACCENT_MAP = new Map(ACCENT_GROUPS.flatMap(([chars, plain]) => [...chars].map((c) => [c, plain])));
const ACCENTS_FROM = [...ACCENT_MAP.keys()].join('');
const ACCENTS_TO = [...ACCENT_MAP.values()].join('');
const LEET_FROM = '013457@$';
const LEET_TO = 'oieastas';
const translate = (s, from, to) => { let out = ''; for (const ch of s) { const i = from.indexOf(ch); out += i < 0 ? ch : to[i]; } return out; };
// o que separa palavras: pontuação, símbolos e emojis; qualquer outra coisa (inclusive letras de outros alfabetos) conta como letra
const SEPARATORS = /[\u0000-\u002f\u003a-\u0040\u005b-\u0060\u007b-\u00bf\u2000-\u2bff\u3000-\u303f\ufe00-\ufe6f\uff00-\uff0f\u{1F000}-\u{1FAFF}]+/gu;

/** Forma "solta" para comparar: minúsculas, sem acento, números no lugar de letras viram letras, só letras e espaços, letras repetidas viram uma. */
export function normLoose(text) {
    let s = translate(translate(String(text ?? '').toLowerCase(), ACCENTS_FROM, ACCENTS_TO), LEET_FROM, LEET_TO);
    s = s.replace(SEPARATORS, ' ').replace(/([a-z])\1+/g, '$1').replace(/ {2,}/g, ' ');
    return s.replace(/^ | $/g, '');
}

/**
 * O texto usa alguma palavra da lista? Duas conferências:
 *   1) a palavra (ou frase) aparece inteira, entre espaços e pontuação ("palavra", "p4lavra", "paalavra", "p.a.l.a.v.r.a" não: veja 2);
 *   2) para palavras com 6 letras ou mais, também vale escrita separada ou colada em outra ("p a l a v r a", "palavrazinha").
 */
export function hasBlockedTerm(text, terms) {
    const norm = normLoose(text);
    if (!norm) return false;
    const padded = ` ${norm} `;
    const squashed = norm.replace(/ /g, '');
    for (const raw of terms || []) {
        const t = normLoose(raw);
        if (!t) continue;
        if (padded.includes(` ${t} `)) return true;
        const tight = t.replace(/ /g, '');
        if (tight.length >= 6 && squashed.includes(tight)) return true;
    }
    return false;
}

// ---------------------------------------------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------------------------------------------

// Endereços com final que também é palavra comum ("muito.com certeza", "ver.in") só contam se vierem com / ? ou #;
// os demais (".net", ".gg", ".br"...) contam sempre. Com "http://", "https://" ou "www." qualquer final conta.
const TLD_STRONG = 'net|org|edu|gov|info|biz|io|gg|tv|ly|cc|ws|xyz|top|site|online|app|dev|link|club|shop|store|fun|live|br|ru|cn|jp|uk|fr|mx|pl|tk|ml|ga|cf|gq|ink|pro|world|today|bio|lol|ai|sh|im|vip|wiki|blog|page|click|zip';
const TLD_AMBIGUOUS = 'com|co|me|to|in|it|us|de|pt|es';
const LABEL = '(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+';
const LINK_SCHEME = /(?:(?:https?|ftp):\/\/(?:[^\s/?#@]*@)?|(?<![a-z0-9])www\.)([^\s/?#:]+)/gi;
const LINK_BARE_STRONG = new RegExp(`(?<![a-z0-9_.-])(${LABEL}(?:${TLD_STRONG}))(?![a-z0-9_-])`, 'gi');
const LINK_BARE_AMBIGUOUS = new RegExp(`(?<![a-z0-9_.-])(${LABEL}(?:${TLD_AMBIGUOUS}))(?=[/?#])`, 'gi');

/** "Exemplo.COM/abc", "https://www.exemplo.com:80/x" → "exemplo.com". Vazio se não parece um endereço. */
export function normalizeHost(value) {
    let h = String(value ?? '').toLowerCase().trim();
    h = h.replace(/^[a-z]+:\/\//, '').replace(/^[^/?#]*@/, '').split(/[/?#]/)[0].replace(/:\d*$/, '');
    h = h.replace(/[.,;:!?)\]}]+$/, '').replace(/^www\./, '');
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h) ? h : '';
}

const unobfuscate = (s) => String(s ?? '').toLowerCase().replace(/\[\.\]|\(\.\)|\{\.\}|[\u3002\uFF0E]/g, '.');

/** Todos os sites citados no texto (sem repetir). */
export function findLinkHosts(text) {
    const s = unobfuscate(text);
    const found = new Set();
    for (const rx of [LINK_SCHEME, LINK_BARE_STRONG, LINK_BARE_AMBIGUOUS]) {
        for (const m of s.matchAll(rx)) {
            const h = normalizeHost(m[1]);
            if (h) found.add(h);
        }
    }
    return [...found];
}

/** `host` é um dos sites permitidos ou um subdomínio deles? */
export function isHostAllowed(host, allowed) {
    const h = normalizeHost(host);
    if (!h) return false;
    return (allowed || []).some((a) => { const x = normalizeHost(a); return x && (h === x || h.endsWith(`.${x}`)); });
}

/** Sites citados no texto que NÃO estão na lista de permitidos. */
export const disallowedLinks = (text, allowed) => findLinkHosts(text).filter((h) => !isHostAllowed(h, allowed));

/** Lista de sites permitidos digitada pela equipe: um por linha (aceita endereço inteiro, mas guarda só o site). */
export function parseHostList(text, max = 100) {
    const out = [];
    for (const part of String(text ?? '').split(/[\n,;\s]+/)) {
        const h = normalizeHost(part.includes('.') ? part : '');
        if (h && !out.includes(h)) out.push(h);
        if (out.length >= max) break;
    }
    return out.sort();
}
