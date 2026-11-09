// Contexto de uma denúncia, ações rápidas e histórico de punições (Patch 20).
// O banco (sql/schema.sql: admin_list_reports, admin_act_on_report, admin_account_history, admin_list_log) faz o trabalho e confere o cargo;
// aqui o painel só lê as respostas com cuidado e monta as frases. Nada aqui chama o banco.

import { cleanUnicode } from './textSafety.js';
import { AUTO_SUSPEND_DAYS, STRIKE_LIMIT, strikeCountText, suspensionLabel, validDate } from './access.js';
import { actionLabel, describeDetails, motiveLabel, rankOf } from './roles.js';

const count = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 100000) : 0; };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// ---------------------------------------------------------------------------------------
// Contexto da fila de denúncias
// ---------------------------------------------------------------------------------------

const EMPTY_PARTS = { suspensionKind: '', suspensionEnds: '', activeStrikes: 0, forceProfile: false, forceNotes: false, openReports: 0, totalReports: 0, past: { warnings: 0, suspensions: 0, bans: 0, content: 0 }, reporterTotal: 0, reporterDismissed: 0 };

/** Lê as colunas de contexto de uma linha de admin_list_reports. Banco antigo (sem a v17) = sem contexto. */
export function normalizeReportContext(r) {
    const row = r && typeof r === 'object' ? r : {};
    // Só a v17 manda o total de denúncias: sem ele o banco é antigo e as colunas soltas (como a suspensão) não dão o quadro completo
    if (row.target_total_reports == null) return { ...EMPTY_PARTS, past: { ...EMPTY_PARTS.past } };
    const past = row.target_past && typeof row.target_past === 'object' && !Array.isArray(row.target_past) ? row.target_past : {};
    const suspended = row.target_suspended === true;
    const kind = suspended ? (row.target_suspension_kind === 'ban' ? 'ban' : 'suspension') : '';
    return {
        suspensionKind: kind,
        suspensionEnds: kind === 'suspension' ? validDate(row.target_suspension_ends) : '',
        activeStrikes: count(row.target_active_strikes),
        forceProfile: row.target_force_profile === true,
        forceNotes: row.target_force_notes === true,
        openReports: count(row.target_open_reports),
        totalReports: count(row.target_total_reports),
        past: { warnings: count(past.avisos), suspensions: count(past.suspensoes), bans: count(past.banimentos), content: count(past.conteudo) },
        reporterTotal: count(row.reporter_total),
        reporterDismissed: count(row.reporter_dismissed),
    };
}

/** Sem contexto nenhum (denúncia vinda de um banco ainda na v16). */
export const EMPTY_CONTEXT = Object.freeze(normalizeReportContext(null));

/**
 * O que o cartão da denúncia mostra além do motivo:
 *  - flags: a situação atual da conta denunciada (suspensão, avisos, travas), em selos;
 *  - reportsLine: quantas denúncias a pessoa já tem e quantas outras estão abertas;
 *  - others: quantas OUTRAS denúncias abertas existem sobre a mesma pessoa (o diálogo oferece resolver todas de uma vez);
 *  - pastLine: o que já aconteceu com a conta (avisos, suspensões, banimentos, ajustes de conteúdo);
 *  - reporterLine / reporterNote: quantas denúncias quem denunciou já fez e quantas foram descartadas.
 * `known` = false quando o banco ainda não manda o contexto (esconde as linhas em vez de mostrar zeros enganosos).
 */
export function contextView(report) {
    const c = report?.context || EMPTY_CONTEXT;
    const known = c.totalReports > 0;
    const isOpen = report?.status === 'open';
    const others = Math.max(0, c.openReports - (isOpen ? 1 : 0));
    const flags = [];
    if (c.suspensionKind) flags.push({ tone: 'danger', text: suspensionLabel(c.suspensionKind, c.suspensionEnds) });
    if (c.activeStrikes > 0) flags.push({ tone: 'planned', text: `Avisos ${strikeCountText(c.activeStrikes)}` });
    if (c.forceProfile) flags.push({ tone: 'muted', text: 'Perfil travado', lock: true });
    if (c.forceNotes) flags.push({ tone: 'muted', text: 'Anotações travadas', lock: true });

    let reportsLine = '';
    if (known) {
        reportsLine = c.totalReports === 1
            ? 'Primeira denúncia contra esta pessoa.'
            : `Esta pessoa tem ${plural(c.totalReports, 'denúncia', 'denúncias')} no total${others > 0 ? ` (${plural(others, 'outra em aberto', 'outras em aberto')})` : ''}.`;
    }

    const p = c.past;
    const parts = [
        p.warnings ? plural(p.warnings, 'aviso', 'avisos') : '',
        p.suspensions ? plural(p.suspensions, 'suspensão', 'suspensões') : '',
        p.bans ? plural(p.bans, 'banimento', 'banimentos') : '',
        p.content ? plural(p.content, 'ajuste de conteúdo', 'ajustes de conteúdo') : '',
    ].filter(Boolean);
    const pastLine = known ? (parts.length ? `Já teve: ${parts.join(' · ')}.` : 'Sem punições anteriores.') : '';
    const hasPast = parts.length > 0;

    const who = report?.reporter ? `@${report.reporter}` : '';
    let reporterLine = '';
    let reporterNote = '';
    if (who && c.reporterTotal > 0) {
        reporterLine = c.reporterTotal === 1
            ? `Primeira denúncia de ${who}.`
            : `${who} fez ${plural(c.reporterTotal, 'denúncia', 'denúncias')}; ${c.reporterDismissed === 1 ? '1 foi descartada' : `${c.reporterDismissed} foram descartadas`}.`;
        if (c.reporterTotal >= 4 && c.reporterDismissed / c.reporterTotal >= 0.5) reporterNote = 'A maioria foi descartada';
    }
    return { known, flags, reportsLine, others, pastLine, hasPast, reporterLine, reporterNote };
}

// ---------------------------------------------------------------------------------------
// Ações rápidas
// ---------------------------------------------------------------------------------------

/**
 * Ações da fila. `needs`: 'reason' (o texto é obrigatório), 'optional' (texto opcional que a pessoa vê), 'none' (nada a escrever).
 * `term` = pede o prazo (suspensão). `minRank` = cargo mínimo (banir é com a Administração e a Dona; o banco confere de novo).
 */
export const QUICK_ACTIONS = {
    reset_name: { label: 'Restaurar nome', icon: 'user', needs: 'none', title: 'Restaurar o nome', confirm: 'Restaurar', minRank: 1,
        text: (u) => `O nome de exibição de @${u} volta para "Usuário" + 4 letras ou números. A pessoa pode editar de novo depois. Fica no registro de ações.` },
    reset_bio: { label: 'Limpar bio', icon: 'edit', needs: 'none', title: 'Limpar a bio', confirm: 'Limpar', minRank: 1,
        text: (u) => `A bio de @${u} fica vazia. A pessoa pode escrever outra depois. Fica no registro de ações.` },
    reset_media: { label: 'Zerar foto e fundo', icon: 'image', needs: 'none', title: 'Zerar foto e fundo', confirm: 'Zerar', minRank: 1,
        text: (u) => `Tira a foto de perfil e a imagem de fundo de @${u}. Isso não tem como desfazer, mas fica no registro de ações. A pessoa pode colocar outras depois.` },
    strike: { label: 'Dar aviso', icon: 'alert', needs: 'reason', title: 'Dar um aviso', confirm: 'Dar o aviso', minRank: 1,
        text: (u) => `A pessoa vê o motivo num banner fixo no topo de todas as telas. No ${STRIKE_LIMIT}º aviso ativo a conta de @${u} é suspensa por ${AUTO_SUSPEND_DAYS} dias.` },
    suspend: { label: 'Suspender', icon: 'clock', needs: 'optional', term: true, title: 'Suspender conta', confirm: 'Suspender', minRank: 1,
        text: (u) => `O perfil de @${u} some para as outras pessoas e a conta passa a ver só uma tela de aviso. A biblioteca continua guardada e a pessoa pode baixar um backup.` },
    limit_profile: { label: 'Perfil privado', icon: 'lock', needs: 'optional', title: 'Perfil sempre privado', confirm: 'Travar', minRank: 1,
        text: (u) => `O perfil de @${u} passa a ser privado e a pessoa não consegue torná-lo público de novo. Para tirar a trava depois, use Gerenciar.` },
    ban: { label: 'Banir', icon: 'ban', needs: 'optional', title: 'Banir conta', confirm: 'Banir', minRank: 2,
        text: (u) => `Banir @${u}: a conta perde o acesso ao site, o perfil some para as outras pessoas e só a equipe consegue reativar. Fica no registro de ações.` },
};
const own = (obj, key) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(obj, key);
export const quickAction = (key) => (own(QUICK_ACTIONS, key) ? QUICK_ACTIONS[key] : null);

/** A primeira ação de cada lista é a que resolve o problema do motivo da denúncia. */
const BY_REASON = {
    nome: ['reset_name', 'reset_media', 'strike', 'suspend', 'ban'],
    bio: ['reset_bio', 'reset_media', 'strike', 'suspend', 'ban'],
    foto: ['reset_media', 'strike', 'suspend', 'ban'],
    spam: ['strike', 'limit_profile', 'reset_media', 'suspend', 'ban'],
    outro: ['strike', 'suspend', 'limit_profile', 'reset_media', 'ban'],
};

/** Ações rápidas que `actorRole` vê para uma denúncia com este motivo. A primeira vem marcada como sugerida. */
export function quickActionsFor(reason, actorRole) {
    const list = own(BY_REASON, reason) ? BY_REASON[reason] : BY_REASON.outro;
    return list
        .filter((key) => rankOf(actorRole) >= QUICK_ACTIONS[key].minRank)
        .map((key, i) => ({ key, ...QUICK_ACTIONS[key], suggested: i === 0 }));
}

/** Texto que já vem escrito no motivo (a pessoa vê; a equipe pode mudar): o motivo da denúncia, de forma neutra. */
export const defaultReasonText = (reason) => motiveLabel(reason);

/** O 3º aviso ativo suspende a conta sozinho: o diálogo avisa antes. */
export const strikeWillSuspend = (activeStrikes) => count(activeStrikes) + 1 >= STRIKE_LIMIT;

/** Frase do aviso na tela depois da ação (inclui quantas denúncias foram resolvidas). */
export function quickResultMessage(action, result = {}, { days = null } = {}) {
    const closed = count(result.closedReports);
    let text;
    switch (action) {
        case 'strike':
            text = result.autoSuspended
                ? `Aviso dado. Era o ${STRIKE_LIMIT}º: a conta foi suspensa por ${AUTO_SUSPEND_DAYS} dias.`
                : `Aviso dado (${strikeCountText(count(result.activeCount))}).`;
            break;
        case 'suspend': text = days ? `Conta suspensa por ${plural(days, 'dia', 'dias')}.` : 'Conta suspensa, sem prazo.'; break;
        case 'ban': text = 'Conta banida.'; break;
        case 'limit_profile': text = 'Perfil sempre privado.'; break;
        case 'reset_name': text = 'Nome restaurado.'; break;
        case 'reset_bio': text = 'Bio limpa.'; break;
        case 'reset_media': text = 'Foto e fundo zerados.'; break;
        default: text = 'Feito.';
    }
    if (closed === 1) return `${text} Denúncia resolvida.`;
    if (closed > 1) return `${text} ${closed} denúncias resolvidas.`;
    return text;
}

// ---------------------------------------------------------------------------------------
// Registro e histórico por conta
// ---------------------------------------------------------------------------------------

/** Grupos do filtro do Registro (iguais aos do banco: log_category). */
export const LOG_CATEGORIES = [
    ['all', 'Tudo'],
    ['punicoes', 'Punições (avisos, suspensões, travas)'],
    ['conteudo', 'Conteúdo e perfil'],
    ['denuncias', 'Denúncias'],
    ['equipe', 'Equipe e site'],
];

/** Número da denúncia que originou a ação ('' quando não há). As próprias linhas de denúncia já mostram o número no texto. */
export function reportRef(action, details) {
    if (String(action).startsWith('report_')) return '';
    const n = Number(details?.denuncia);
    return Number.isSafeInteger(n) && n > 0 ? `denúncia #${n}` : '';
}

const HISTORY_TITLE = {
    strike: 'Aviso',
    strike_suspend: 'Suspensa automaticamente (3º aviso)',
    strike_revoke: 'Aviso retirado',
    suspend: 'Suspensão',
    unsuspend: 'Conta reativada',
    ban: 'Banimento',
    limits_set: 'Privacidade forçada',
    limits_clear: 'Trava de privacidade retirada',
    reset_display_name: 'Nome restaurado',
    reset_bio: 'Bio limpa',
    reset_avatar: 'Foto removida',
    reset_background: 'Fundo removido',
    reset_username: '@usuário restaurado',
    wipe_display_name: 'Nome removido',
    wipe_bio: 'Bio removida',
    wipe_title: 'Títulos removidos',
    wipe_review: 'Análises removidas',
    wipe_notes: 'Anotações removidas',
    wipe_tags: 'Tags removidas',
    rename: 'Renomeada',
};
/** Ações que são punições de verdade (as outras do histórico são ajustes de conteúdo). */
const PUNISHMENTS = new Set(['strike', 'strike_suspend', 'suspend', 'ban', 'limits_set']);

/** Lê uma linha de admin_account_history. */
export function normalizeHistoryEntry(r) {
    const details = r?.details && typeof r.details === 'object' && !Array.isArray(r.details) ? r.details : {};
    return {
        id: Number(r?.id) || 0,
        at: validDate(r?.created_at),
        actor: cleanUnicode(r?.actor_name) || 'Alguém',
        action: typeof r?.action === 'string' ? r.action : '',
        details,
    };
}

/** O que o histórico mostra de cada item: título, detalhe (antes e depois, motivo, prazo), quem fez e a denúncia de origem. */
export function historyView(entry) {
    const e = entry || {};
    return {
        title: own(HISTORY_TITLE, e.action) ? HISTORY_TITLE[e.action] : (typeof e.action === 'string' ? actionLabel(e.action) : ''),
        extra: describeDetails(e.action, e.details),
        ref: reportRef(e.action, e.details),
        punishment: PUNISHMENTS.has(e.action),
        actor: e.actor || '',
    };
}
