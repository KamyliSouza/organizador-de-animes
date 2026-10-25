// Script clássico (não é módulo): roda antes de tudo e continua funcionando mesmo se o app falhar ao carregar.
//  1) marca <html class="js"> (o CSS usa isso para saber que o JavaScript está ligado);
//  2) aplica o tema salvo antes da página pintar, evitando o "flash" de cor errada;
//  3) vigia a inicialização: se o app não aparecer em 12 s (internet ruim, arquivo bloqueado...),
//     troca o "Carregando…" por um aviso com botão de recarregar, em vez de ficar travado para sempre.
(function () {
    var root = document.documentElement;
    root.classList.add('js');

    try {
        var t = localStorage.getItem('kamylist_theme');
        if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
    } catch (e) { /* armazenamento bloqueado: segue o tema do sistema */ }

    setTimeout(function () {
        var box = document.querySelector('.boot-loading');   // some quando o app assume a tela
        if (!box) return;
        box.textContent = '';

        var title = document.createElement('strong');
        title.textContent = 'O site está demorando para abrir.';
        var text = document.createElement('span');
        text.textContent = ' Verifique sua internet e recarregue a página. Se o problema continuar, desative bloqueadores de conteúdo para este site.';
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'button button-primary';
        button.textContent = 'Recarregar a página';
        button.addEventListener('click', function () { location.reload(); });

        box.appendChild(title);
        box.appendChild(text);
        box.appendChild(button);
    }, 12000);
})();
