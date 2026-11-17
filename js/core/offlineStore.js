// Armazenamento para "ver offline": um IndexedDB minúsculo (chave → valor). Bem maior que o localStorage, que estouraria com bibliotecas grandes.
// Tudo é à prova de falha: navegador sem IndexedDB, janela privada ou disco cheio devolvem "nada" e o site segue normal (só não há cópia offline).
const DB = 'kamylist-offline';
const STORE = 'kv';
let opening = null;

function open() {
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') { reject(new Error('sem IndexedDB')); return; }
        let req;
        try { req = indexedDB.open(DB, 1); } catch (e) { reject(e); return; }
        req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error('bloqueado'));
    }).catch((e) => { opening = null; throw e; });
    return opening;
}

async function tx(mode, run) {
    const db = await open();
    return new Promise((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const out = run(t.objectStore(STORE));
        t.oncomplete = () => resolve(out && 'result' in out ? out.result : undefined);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error || new Error('cancelado'));
    });
}

export async function kvGet(key) { try { return (await tx('readonly', (s) => s.get(key))) ?? null; } catch { return null; } }
export async function kvSet(key, value) { try { await tx('readwrite', (s) => s.put(value, key)); return true; } catch { return false; } }
export async function kvDel(key) { try { await tx('readwrite', (s) => s.delete(key)); return true; } catch { return false; } }
export async function kvKeys() { try { return (await tx('readonly', (s) => s.getAllKeys())) || []; } catch { return []; } }
