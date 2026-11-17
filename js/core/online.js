// "Estou sem internet?" em um lugar só. Vale quando o navegador avisa (navigator.onLine) e também quando uma chamada de rede falhou
// mesmo com o navegador achando que há conexão (Wi-Fi sem sinal): `markNetworkFailure()` marca, e a próxima chamada que der certo
// (`markNetworkOk()`) ou o evento "online" desmarca. Quem muda de comportamento sem internet (barra, biblioteca, telas) ouve onConnectionChange.
const listeners = new Set();
let failed = false;

export const isOffline = () => (typeof navigator !== 'undefined' && navigator.onLine === false) || failed;
export function onConnectionChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

const emit = () => listeners.forEach((fn) => { try { fn(isOffline()); } catch (e) { console.error(e); } });

export function markNetworkFailure() { if (!failed) { failed = true; emit(); } }
export function markNetworkOk() { if (failed) { failed = false; emit(); } }

if (typeof window !== 'undefined') {
    window.addEventListener('offline', emit);
    window.addEventListener('online', () => { failed = false; emit(); });
}
