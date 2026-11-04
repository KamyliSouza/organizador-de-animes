// Imagem de fundo do SITE TODO (escolhida em Personalização → Fundo do perfil). Funciona como as cores:
//  - "Meu fundo": vale em todas as telas enquanto a pessoa está logada (vem do perfil da conta e é refeito quando ela troca a imagem).
//  - "Fundo visto": ao abrir o perfil de OUTRA pessoa, a página usa o fundo dela (ou nenhum, se ela não tem) enquanto você estiver ali.
//    Ao sair do perfil, volta para o seu.
//  - A imagem fica numa camada fixa atrás de tudo (.site-bg) e o <body> recebe data-bg="blur|solid": é esse atributo que deixa
//    os cards semitransparentes (blur) ou opacos (solid). Ver css/profile-bg.css.
//  - O desfoque é uma opção da pessoa (bgBlur):
//      ligado    -> cards semitransparentes que desfocam a imagem atrás deles;
//      desligado -> cards opacos e a imagem com 50% do brilho.
//  - Alto contraste (opção de acessibilidade de quem está olhando) esconde a imagem: fundos sem transparência são o objetivo dele.
//  - Se a imagem não carregar (apagada, sem internet), a camada some e o site volta ao visual normal.
import { config } from '../config.js';

export const BACKGROUND_BUCKET = 'backgrounds';
const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Endereço público do fundo de um perfil, ou '' se a pessoa não tem fundo. O número da versão (bgV) evita mostrar um fundo antigo em cache. */
export function backgroundSrc(profile) {
    const v = Number(profile?.bgV);
    if (!profile || !Number.isSafeInteger(v) || v <= 0 || !UUID_RX.test(String(profile.id || ''))) return '';
    const base = String(config.supabaseUrl || '').replace(/\/+$/, '');
    if (!/^https:\/\//.test(base)) return '';
    return `${base}/storage/v1/object/public/${BACKGROUND_BUCKET}/${profile.id}?v=${v}`;
}

export const backgroundMode = (profile) => (profile?.bgBlur === false ? 'solid' : 'blur');

/** { src, mode } do fundo de um perfil, ou null se ele não tem. */
const specOf = (profile) => {
    const src = backgroundSrc(profile);
    return src ? { src, mode: backgroundMode(profile) } : null;
};

let own = null;              // meu fundo
let viewing;                 // undefined = não estou numa tela de perfil · null = perfil sem fundo · { src, mode } = fundo da pessoa
let viewToken = 0;
let queued = false;
let layer = null;            // a camada que está na tela
let shown = null;            // { src, mode } dela
const failed = new Set();    // endereços que não carregaram: não tenta de novo nesta visita

function build(spec) {
    const el = document.createElement('div');
    el.className = 'site-bg bg-art';
    el.dataset.bg = spec.mode;
    el.setAttribute('aria-hidden', 'true');
    const img = document.createElement('img');
    img.className = 'bg-art-img';
    img.alt = '';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    const veil = document.createElement('span');
    veil.className = 'bg-art-veil';
    el.append(img, veil);
    img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
    img.addEventListener('error', () => { failed.add(spec.src); schedule(); }, { once: true });
    img.src = spec.src;
    return el;
}

function paint() {
    let cur = viewing !== undefined ? viewing : own;
    if (cur && failed.has(cur.src)) cur = null;
    const body = document.body;
    if (!cur) {
        layer?.remove();
        layer = null; shown = null;
        body.removeAttribute('data-bg');
        return;
    }
    if (layer && shown.src === cur.src) {       // mesma imagem: no máximo o desfoque mudou, sem recarregar nada
        if (shown.mode !== cur.mode) { layer.dataset.bg = cur.mode; body.dataset.bg = cur.mode; shown = cur; }
        return;
    }
    layer?.remove();
    layer = build(cur);
    shown = cur;
    body.dataset.bg = cur.mode;
    body.prepend(layer);
}

// Várias mudanças seguidas (sair de um perfil e abrir outro) viram uma só pintura: a imagem não pisca.
function schedule() {
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; paint(); });
}

/** Define o meu fundo a partir do meu perfil (null/sem fundo = nenhum). Vale em todas as telas, menos enquanto eu vejo o perfil de outra pessoa. */
export function setOwnBackground(profile) {
    const next = specOf(profile);
    if (next?.src === own?.src && next?.mode === own?.mode) return;
    own = next;
    schedule();
}

/** Liga ou desliga o desfoque do meu fundo na hora (antes de salvar). */
export function setOwnBackgroundBlur(blur) {
    if (!own) return;
    own = { ...own, mode: blur ? 'blur' : 'solid' };
    schedule();
}

/** Ao sair da conta: some com o fundo (a próxima pessoa não herda a imagem). */
export function clearOwnBackground() {
    if (!own) return;
    own = null;
    schedule();
}

/** Usa o fundo de outra pessoa nesta página (sem fundo = nenhum). Devolve a função que volta para o meu. */
export function viewBackground(profile) {
    const mine = ++viewToken;
    viewing = specOf(profile);
    schedule();
    return () => {
        if (mine !== viewToken) return;     // outra tela já assumiu: não mexe
        viewing = undefined;
        schedule();
    };
}
