// Painel "Seus dados": exportar/importar backup (e importar a lista salva no navegador pela versão antiga).
import { downloadBlob, html, on } from '../core/dom.js';
import { choiceDialog } from '../core/dialogs.js';
import { messageOf } from '../core/errors.js';
import { icon } from '../core/icons.js';
import { toast } from '../core/toast.js';
import { buildBackup, parseBackup, readLegacyEntries } from '../domain/backup.js';

const MAX_BACKUP_BYTES = 8 * 1024 * 1024;

export function dataPanelHtml(cloud) {
    const legacyCount = cloud ? readLegacyEntries().length : 0;
    return html`
    <section class="panel glass-panel" aria-labelledby="st-data">
        <h2 id="st-data">${icon('download')} Seus dados</h2>
        <p class="muted small">Faça backup da sua biblioteca em um arquivo JSON, ou restaure um backup (inclusive o da versão antiga do site).</p>
        <div class="row">
            <button type="button" class="button button-secondary" data-act="export">${icon('download', { size: 17 })} Exportar backup</button>
            <label class="button button-secondary" style="cursor:pointer">${icon('upload', { size: 17 })} Importar backup
                <input type="file" accept=".json,application/json" data-import class="sr-only"></label>
        </div>
        ${cloud && legacyCount ? html`
            <div class="notice-box">${icon('upload')}<div>
                Há <strong>${legacyCount}</strong> ${legacyCount === 1 ? 'obra salva' : 'obras salvas'} neste navegador (versão antiga do site).
                <div class="notice-actions"><button type="button" class="button button-primary button-sm" data-act="import-legacy">Importar para minha conta</button></div>
            </div></div>` : ''}
    </section>`;
}

/** Liga os botões do painel. Devolve a função que desfaz as ligações. */
export function bindDataPanel(root, be) {
    const offs = [];

    offs.push(on(root, 'click', '[data-act="export"]', async () => {
        try {
            const list = await be.library.listMine();
            downloadBlob(new Blob([buildBackup(list)], { type: 'application/json' }), `kamylist-backup-${new Date().toISOString().slice(0, 10)}.json`);
            toast(`Backup com ${list.length} obras exportado.`, { type: 'success' });
        } catch (err) {
            toast(messageOf(err, 'Não foi possível exportar.'), { type: 'error' });
        }
    }));

    offs.push(on(root, 'click', '[data-act="import-legacy"]', async (_, btn) => {
        btn.disabled = true;
        try {
            const created = await be.library.addMany(readLegacyEntries());
            toast(`${created.length} obras importadas para a sua conta!`, { type: 'success' });
            btn.closest('.notice-box').remove();
        } catch (err) {
            btn.disabled = false;
            toast(messageOf(err, 'Não foi possível importar.'), { type: 'error' });
        }
    }));

    offs.push(on(root, 'change', 'input[data-import]', async (_, input) => {
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;
        if (file.size > MAX_BACKUP_BYTES) { toast('Arquivo grande demais para um backup.', { type: 'error' }); return; }
        try {
            const entries = parseBackup(await file.text());
            const choice = await choiceDialog({
                title: 'Importar backup',
                iconName: 'upload',
                message: `O arquivo tem ${entries.length} ${entries.length === 1 ? 'obra' : 'obras'}.\n\nAdicionar às obras que você já tem, ou substituir tudo pelo conteúdo do arquivo? (Dica: exporte um backup antes de substituir.)`,
                choices: [
                    { value: null, label: 'Cancelar', variant: 'ghost' },
                    { value: 'replace', label: 'Substituir tudo', variant: 'danger' },
                    { value: 'add', label: 'Adicionar', variant: 'primary' },
                ],
            });
            if (!choice) return;
            if (choice === 'replace') await be.library.replaceAll(entries);
            else await be.library.addMany(entries);
            toast(choice === 'replace' ? 'Backup restaurado com sucesso!' : `${entries.length} obras adicionadas!`, { type: 'success' });
        } catch (err) {
            console.error(err);
            toast(messageOf(err, 'Não foi possível importar o arquivo.'), { type: 'error' });
        }
    }));

    return () => offs.forEach((off) => off());
}
