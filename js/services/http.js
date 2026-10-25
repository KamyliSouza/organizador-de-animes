/** Erro de rede/HTTP com o código de status (0 = sem resposta / tempo esgotado). */
export class HttpError extends Error {
    constructor(status, message) {
        super(message || 'HTTP ' + status);
        this.name = 'HttpError';
        this.status = status;
    }
}

const RETRYABLE = new Set([0, 408, 429, 500, 502, 503, 504]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function once(url, { timeout, ...init }) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
        const res = await fetch(url, { ...init, signal: ctrl.signal });
        if (!res.ok) {
            const err = new HttpError(res.status);
            // "Retry-After" em segundos (usado pelo Jikan e outras APIs no 429)
            const wait = Number(res.headers?.get?.('retry-after'));
            if (Number.isFinite(wait) && wait > 0) err.retryAfterMs = Math.min(wait * 1000, 6000);
            throw err;
        }
        return await res.json();
    } catch (err) {
        if (err instanceof HttpError) throw err;
        throw new HttpError(0, err?.name === 'AbortError' ? 'Tempo esgotado' : 'Falha de rede');
    } finally {
        clearTimeout(timer);
    }
}

/**
 * fetch + JSON com tempo limite. Lança HttpError em respostas que não sejam 2xx.
 * `retries`: tentativas extras para falhas passageiras (429, 5xx, rede, tempo esgotado),
 * com espera crescente (ou o "Retry-After" que o servidor mandar).
 * `gate`: função async chamada antes de CADA tentativa (usada para espaçar pedidos).
 */
export async function fetchJson(url, { timeout = 12000, retries = 0, retryDelay = 900, gate, ...init } = {}) {
    for (let attempt = 0; ; attempt++) {
        try {
            if (gate) await gate();
            return await once(url, { timeout, ...init });
        } catch (err) {
            if (attempt >= retries || !RETRYABLE.has(err.status)) throw err;
            await sleep(err.retryAfterMs ?? retryDelay * 2 ** attempt);
        }
    }
}
