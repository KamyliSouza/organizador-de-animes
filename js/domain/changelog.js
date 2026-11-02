// Histórico de novidades do site (aparece no botão de versão do rodapé).
// Para cada atualização nova: acrescente um bloco NO TOPO da lista e troque SITE_VERSION pelo mesmo número.
// Escreva para a comunidade: frases curtas, sem termos técnicos.
export const SITE_VERSION = '1.14';

export const CHANGELOG = [
    {
        version: '1.14',
        title: 'Fundo personalizado no perfil',
        items: [
            'Novo painel Fundo do perfil na Personalização: escolha uma imagem para aparecer atrás da página pública do seu perfil. Quem abrir o seu link vê o fundo; o resto do site continua normal.',
            'A imagem é reduzida e convertida para WebP aqui no navegador antes de enviar, então fica leve. Só existe um fundo por conta: ao trocar ou remover, o anterior é apagado.',
            'Chave Desfoque nos cards. Ligada: os cards ficam semitransparentes e desfocam a imagem atrás deles. Desligada: os cards ficam opacos e a imagem fica com metade do brilho. Vale para o tema claro e para o escuro, e o texto continua legível com qualquer imagem.',
            'Quem usa Alto contraste não vê a imagem de fundo. Se a imagem não carregar, a página volta ao visual normal.',
            'A equipe pode restaurar (remover) o fundo de um perfil impróprio. No botão Denunciar, o motivo "Foto" virou "Foto ou fundo impróprio".',
            'Ajuste: o número da aba selecionada (Anime, Mangá, Light Novel) ganhou um contorno em vez de um fundo clareado, para ficar mais fácil de ler.',
        ],
    },
    {
        version: '1.13',
        title: 'Novo tema Strong Violet',
        items: [
            'Nova combinação de cores no perfil: Strong Violet, um violeta intenso baseado na cor #7F29C5. Escolha em Perfil → Personalização → Cores (fica entre Índigo e Grafite).',
            'Botões, links, destaques e etiquetas foram ajustados para ler bem nos dois temas: no claro o violeta forte fica no botão e no destaque; no escuro ele clareia para não sumir no fundo. As etiquetas de status e categoria continuam com cores bem diferentes do violeta, para você nunca confundir uma coisa com a outra.',
            'Como as outras cores, é salva na sua conta e quem visita o seu perfil vê o Strong Violet enquanto estiver nele. O Alto contraste continua valendo por cima, se você ligar.',
        ],
    },
    {
        version: '1.12',
        title: 'Alto contraste como opção de acessibilidade',
        items: [
            'Novo painel Acessibilidade na Personalização (em Ajustes, no modo local) com a chave Alto contraste: preto e branco no tema claro, preto e amarelo no tema escuro, bordas firmes, fundos sem transparência, foco bem visível e links sublinhados.',
            'A opção é só sua: fica guardada na sua conta, vale em qualquer aparelho em que você entrar e não aparece para mais ninguém. Quem visita o seu perfil não recebe o seu alto contraste, e o seu continua valendo quando você visita o perfil de outra pessoa.',
            'Funciona junto com o tema claro ou escuro e com qualquer combinação de cores. Por isso o Alto contraste saiu da lista de cores do perfil; quem usava essa cor já foi passado para a nova opção.',
            'Ao sair da conta, a opção é desligada neste navegador, para a próxima pessoa que usar o aparelho não herdar o visual.',
        ],
    },
    {
        version: '1.11',
        title: 'Notas com meia estrela',
        items: [
            'Agora dá para dar nota com meia estrela: de 0,5 a 5 estrelas, em passos de meia estrela. No formulário da obra, clique na metade esquerda de uma estrela para meia estrela ou na direita para a estrela inteira. Com o teclado, use as setas (meia estrela), PageUp/PageDown (uma estrela), Home (sem nota) e End (cinco estrelas).',
            'As notas que você já tinha foram convertidas uma única vez, sem perder nada: 4 estrelas continuam sendo 4 estrelas (por baixo, a escala agora vai de 0 a 10).',
            'As estrelas (inclusive as meias) aparecem nos cartões, na lista, no feed, nos perfis e no cartão de compartilhar. Ao buscar uma obra, a nota da comunidade já vem preenchida na nova escala.',
            'Backups: o arquivo exportado agora leva a marca da nova escala. Backups antigos (de antes desta versão) continuam entrando, com as notas convertidas automaticamente.',
        ],
    },
    {
        version: '1.10',
        title: 'Abas do perfil, Explorar em três linhas e favoritos sem limite',
        items: [
            'Você escolhe quais abas (Anime, Mangá e Light Novel) outras pessoas veem no seu perfil, em Configurações → Privacidade. As obras das abas desligadas ficam escondidas no perfil, no Explorar e no feed. Com só uma aba ligada, o seletor de abas some do perfil.',
            'O Explorar agora resume cada pessoa em até três linhas: Animes, Mangás e Light Novels, cada uma com total, ativas e concluídas.',
            'No perfil de outra pessoa, cada obra mostra em que ponto ela está: "Episódio: 4 da Temporada: 2" ou "Volume: 5, Capítulo: 10".',
            'Favoritos sem limite: favorite quantas obras quiser. No perfil, os favoritos de cada aba ficam numa faixa com rolagem lateral.',
        ],
    },
    {
        version: '1.9',
        title: 'Abas Anime, Mangá e Light Novel',
        items: [
            'A biblioteca (e os perfis) agora tem três abas: Anime, Mangá e Light Novel. Filmes e séries continuam dentro de Anime, cada um com o selo da sua categoria.',
            'Cada aba tem os próprios números, filtros, favoritos e estatísticas. Ao adicionar uma obra, ela já começa no tipo da aba em que você está.',
            'O mesmo nome pode existir em tipos diferentes (por exemplo, o anime e o mangá de "Death Note"). O aviso de obra repetida agora só aparece dentro do mesmo tipo, e a busca marca o que você já tem.',
            'Ao buscar um título na biblioteca, o site avisa se ele também aparece nas outras abas e leva você até lá com um clique.',
            'Clicar nos cartões de números do topo (Obras, Assistindo, Concluídas...) filtra a lista e rola suavemente até ela.',
        ],
    },
    {
        version: '1.8',
        title: 'Formulário, Personalização e foto de perfil',
        items: [
            'Ao adicionar ou editar uma obra, a análise e as anotações agora têm janelas próprias: o formulário fica mais curto e você escreve com mais espaço. O texto vale na hora, então fechar a janela não perde nada.',
            'Foto de perfil com recorte circular: ao escolher a imagem, você arrasta, amplia e enquadra dentro de um círculo (também funciona com os dedos e com o teclado) antes de enviar.',
            'Personalização reorganizada: a foto e os dados do perfil ficam no mesmo painel, e as cores ocupam a largura toda logo abaixo, sem espaço vazio no computador.',
        ],
    },
    {
        version: '1.7',
        title: 'Correções e acabamento',
        items: [
            'Nova logo: o kanji 菫 (sumire, "violeta").',
            'Cards mais certinhos: o +1 agora fica ao lado do seletor de status e o rodapé do card não deixa mais um buraco quando a obra não está em "Assistindo".',
            'Modo lista: o botão +1 fica ao lado do status e o ícone de detalhes se junta aos outros ícones.',
            'O seletor de status não estica mais em celulares de tela muito nítida.',
            'Ao editar uma obra o teclado do celular não abre sozinho (ele só abre ao adicionar).',
            'No feed, clicar na capa abre os detalhes da obra.',
            'As etiquetas de status e categoria agora mudam de cor conforme o tema escolhido, para não se confundirem com o fundo da página.',
            'Painel da equipe: as abas não quebram mais as palavras ao meio quando o zoom do navegador é grande.',
            'Novo botão de versão no rodapé, com o histórico de novidades (é esta janela).',
        ],
    },
    {
        version: '1.6',
        title: 'Cargos e painel da equipe',
        items: [
            'Cargos Dona, Administração e Moderação, com selo ao lado do nome.',
            'Denúncias de perfis, com fila para a equipe resolver.',
            'Painel da equipe com membros, denúncias, registro de ações e configurações do site.',
            'Aviso do site no topo, nomes proibidos e opção de fechar os cadastros.',
        ],
    },
    {
        version: '1.5',
        title: 'Mangás e light novels',
        items: [
            'Nova aba "Ler", com mangás, manhwas, manhuas e light novels.',
            'Progresso por capítulos e volumes, com o botão +1 Cap.',
            'Busca no AniList e no MyAnimeList (via Jikan).',
            'Estatísticas, feed e cartão de compartilhar também entendem a leitura.',
        ],
    },
    {
        version: '1.4',
        title: 'Cores, ajustes e mais controle',
        items: [
            'Cores do perfil: oito combinações, com contraste conferido, que valem para o site todo e para o perfil que você visita.',
            'Seletor de status em cada card e em cada linha do modo lista.',
            'O +1 Ep só aparece em obras "Assistindo".',
            'Os números do topo (Obras, Assistindo, Quero ver...) filtram a lista.',
            'Clicar na capa abre os detalhes da obra.',
            'O botão voltar do celular fecha as janelas em vez de sair da página.',
        ],
    },
    {
        version: '1.3',
        title: 'Seguir pessoas, feed e análises',
        items: [
            'Seguir pessoas, com pedidos para quem tem perfil privado.',
            'Feed com o que as pessoas que você segue adicionam, concluem ou analisam.',
            'Análises das obras, com opção de esconder spoilers.',
        ],
    },
    {
        version: '1.2',
        title: 'Foto de perfil e configurações',
        items: [
            'Foto de perfil, reduzida automaticamente antes de enviar.',
            'Configurações separadas em "Personalização" e "Configurações".',
        ],
    },
    {
        version: '1.1',
        title: 'Status, favoritos e compartilhar',
        items: [
            'Marcar uma obra como "Concluído" completa todos os episódios.',
            'Aviso quando a obra que você vai adicionar já está na sua lista.',
            'Favoritos fixados no perfil (o coração do card).',
            'Status "Em espera" e "Dropado".',
            'Cartão de compartilhamento da obra.',
        ],
    },
];
