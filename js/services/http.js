/** fetch + JSON com tempo limite. Lança Error em respostas que não sejam 2xx. */
export async function fetchJson(url, { timeout = 12000, ...init } = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
        const res = await fetch(url, { ...init, signal: ctrl.signal });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}
