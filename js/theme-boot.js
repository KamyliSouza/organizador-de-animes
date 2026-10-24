// Aplica o tema salvo antes da página pintar, evitando o "flash" de cor errada.
(function () {
    try {
        var t = localStorage.getItem('kamylist_theme');
        if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    } catch (e) { /* armazenamento bloqueado: segue o tema do sistema */ }
})();
