// "há 3 horas", "ontem"... em português. Datas muito antigas viram dia/mês/ano.
const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

export function timeAgo(iso, now = Date.now()) {
    // o banco manda microssegundos (".123456"); o JavaScript só entende milissegundos
    const t = Date.parse(String(iso || '').replace(/(\.\d{3})\d+/, '$1'));
    if (!Number.isFinite(t)) return '';
    const diff = Math.round((t - now) / 1000);   // negativo = no passado
    const abs = Math.abs(diff);
    if (abs < 45) return 'agora mesmo';
    if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
    if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
    return new Date(t).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
}
