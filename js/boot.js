// Script clássico (não é módulo): roda antes de tudo e continua funcionando mesmo se o app falhar ao carregar.
//  1) marca <html class="js"> (o CSS usa isso para saber que o JavaScript está ligado);
//  2) aplica o tema, o preset de cores e o alto contraste salvos antes da página pintar, evitando o "flash" de cor errada;
//  3) vigia a inicialização: se o app não aparecer em 12 s (internet ruim, arquivo bloqueado...),
//     troca o "Carregando…" por um aviso com botão de recarregar, em vez de ficar travado para sempre.
(function () {
    var root = document.documentElement;
    root.classList.add('js');

    try {
        var t = localStorage.getItem('kamylist_theme');
        if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
    } catch (e) { /* armazenamento bloqueado: segue o tema do sistema */ }

    try {   // "Alto contraste" era uma cor de perfil; agora é uma opção própria (acessibilidade). Quem tinha a cor passa para a opção.
        if (localStorage.getItem('kamylist_palette') === 'alto-contraste') {
            localStorage.setItem('kamylist_contrast', 'high');
            localStorage.removeItem('kamylist_palette');
        }
    } catch (e) { /* ok */ }

    try {   // combinação de cores da pessoa (cache do último login): aplicado antes da página pintar
        var pal = localStorage.getItem('kamylist_palette');
        if (pal && /^[a-z0-9-]{1,24}$/.test(pal) && pal !== 'default') root.setAttribute('data-palette', pal);
    } catch (e) { /* ok */ }

    try {   // alto contraste (cache da opção da conta ou deste navegador): também antes de pintar
        if (localStorage.getItem('kamylist_contrast') === 'high') root.setAttribute('data-contrast', 'high');
    } catch (e) { /* ok */ }

    try {   // manifesto da minha paleta (cores da barra de navegação do Android no app instalado): já certo antes de o navegador ler o manifesto
        var pal = localStorage.getItem('kamylist_palette');
        var mf = document.querySelector('link[rel="manifest"]');
        if (mf && pal && pal !== 'default' && /^[a-z]+(-[a-z]+)*$/.test(pal) && pal.length < 24) mf.setAttribute('href', 'manifest-' + pal + '.webmanifest');
    } catch (e) { /* ok */ }

    try {   // última cor do app (barra do navegador/aplicativo): a barra já nasce na cor da paleta, sem piscar; o js/core/themeColor.js confirma depois
        var tc = localStorage.getItem('kamylist_theme_color');
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta && tc && /^#[0-9a-f]{6}$/i.test(tc)) meta.setAttribute('content', tc);
    } catch (e) { /* ok */ }

    // A folha de estilo da fonte (Google) nasce com media="print" para não travar a pintura; quando chega, passa a valer para a tela.
    var fontCss = document.querySelector('link[data-font-css]');
    if (fontCss) {
        var showFont = function () { fontCss.media = 'all'; };
        if (fontCss.sheet) showFont();
        else {
            fontCss.addEventListener('load', showFont);
            fontCss.addEventListener('error', showFont);
        }
    }

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
