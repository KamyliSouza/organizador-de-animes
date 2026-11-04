// Limites para trocar a foto de perfil e o fundo (o banco é quem aplica: ver a seção 7 de sql/schema.sql).
//  - espera entre trocas (separada para a foto e para o fundo) e limite de trocas nas últimas 24 horas (foto e fundo somados);
//  - quando o banco recusa um envio, a mensagem vem num formato fixo: KAMYLIST_LIMITE_<COOLDOWN|DIARIO>:<foto|fundo>:<segundos>:<limite>;
//  - aqui ficam só funções puras: ler essa mensagem e escrever os textos em português.

export const MEDIA_KINDS = {
    avatar: { noun: 'foto', article: 'a' },
    background: { noun: 'fundo', article: 'o' },
};

const NOUN_TO_KIND = { foto: 'avatar', fundo: 'background' };
const LIMIT_RX = /KAMYLIST_LIMITE_(COOLDOWN|DIARIO):(foto|fundo):(\d+):(\d+)/;

/** Lê a recusa do banco. Devolve { reason: 'cooldown'|'diario', kind: 'avatar'|'background', wait, limit } ou null se não for um limite. */
export function parseLimitError(text) {
    const m = LIMIT_RX.exec(String(text || ''));
    if (!m) return null;
    return { reason: m[1].toLowerCase(), kind: NOUN_TO_KIND[m[2]], wait: Number(m[3]), limit: Number(m[4]) };
}

/** "17 s", "5 min", "3 h 12 min". Sempre arredonda para cima: nunca promete que já dá antes da hora. */
export function formatWait(seconds) {
    const s = Math.max(1, Math.ceil(Number(seconds) || 0));
    if (s < 60) return `${s} s`;
    const totalMin = Math.ceil(s / 60);
    if (totalMin < 60) return `${totalMin} min`;
    const h = Math.floor(totalMin / 60);
    const min = totalMin % 60;
    return min ? `${h} h ${min} min` : `${h} h`;
}

/** Texto da recusa. `limit` é o número do limite diário (para 'diario'). */
export function limitMessage({ kind, reason, wait, limit }) {
    const k = MEDIA_KINDS[kind] || MEDIA_KINDS.avatar;
    if (reason === 'diario') {
        const n = Number(limit) || 10;
        return `Você já fez ${n} trocas de foto e fundo nas últimas 24 horas (o limite é ${n}). Dá para trocar de novo em ${formatWait(wait)}.`;
    }
    return `Calma! Espere ${formatWait(wait)} para trocar ${k.article} ${k.noun} de novo.`;
}

/**
 * Linha de apoio da tela. `info` vem do banco: { cooldown, dailyLimit, used, avatar: { wait, reason }, background: { wait, reason } }.
 * `waitLeft` é o que ainda falta (em segundos) para o tipo em questão, já descontado o tempo que passou desde a consulta.
 */
export function limitHint(info, kind, waitLeft, reason) {
    if (!info) return '';
    const k = MEDIA_KINDS[kind] || MEDIA_KINDS.avatar;
    if (waitLeft > 0) return limitMessage({ kind, reason, wait: waitLeft, limit: info.dailyLimit });
    return `Trocas de foto e fundo nas últimas 24 horas: ${info.used} de ${info.dailyLimit}. Entre duas trocas ${k.article === 'a' ? 'da' : 'do'} ${k.noun}, é preciso esperar ${info.cooldown} s.`;
}
