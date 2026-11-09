// Histórico de novidades do site (aparece no botão de versão do rodapé).
// Para cada atualização nova: acrescente um bloco NO TOPO da lista e troque SITE_VERSION pelo mesmo número.
// Escreva para a comunidade: frases curtas, sem termos técnicos.
export const SITE_VERSION = '1.22';

export const CHANGELOG = [
    {
        version: '1.22',
        title: 'Biblioteca mais limpa: abas de status e Filtros',
        items: [
            'Os cartões de números do topo saíram: agora cada status é uma aba logo acima da lista (Todas, Assistindo, Quero ver, Concluídas, Em espera, Dropadas), com o número de obras ao lado. Clicar numa aba filtra a lista, como antes.',
            'A categoria (Anime, Filme, Série) e a ordem da lista foram para o botão "Filtros", ao lado da busca. Quando há algo ligado ali, o botão mostra quantos ajustes estão ativos. Se a lista ficar vazia, há um botão para limpar os filtros e a busca.',
            'As abas Anime, Mangá e Light Novel, a busca e o botão de cards/lista continuam onde estavam. O perfil público usa o mesmo desenho.',
        ],
    },
    {
        version: '1.21',
        title: '"Nova obra" sempre à mão',
        items: [
            'O botão "Nova obra" agora fica sempre visível: no computador, no topo, ao lado da sua foto; no celular, como um botão flutuante acima da barra de baixo.',
            'Dá para adicionar uma obra de qualquer tela (Feed, Explorar, seu perfil, configurações). Quando você está na biblioteca, o formulário abre como sempre; nas outras telas, abre na aba que você usou por último e o aviso de sucesso tem um atalho para ver a biblioteca.',
        ],
    },
    {
        version: '1.20',
        title: 'Denúncias mais rápidas e justas',
        items: [
            'A equipe agora vê, em cada denúncia, a situação da conta denunciada (avisos, suspensão, privacidade travada), quantas denúncias ela já tem e o que já aconteceu antes. Também vê quantas denúncias quem denunciou já fez e quantas foram descartadas. Isso ajuda a decidir com mais cuidado.',
            'Ações rápidas na própria denúncia: restaurar o nome, limpar a bio, zerar foto e fundo, dar um aviso, suspender ou banir. A ação e a resolução da denúncia acontecem juntas, sem passos esquecidos.',
            'Cada conta tem agora um histórico de punições (avisos, suspensões, banimentos, travas e o que foi restaurado ou removido), e o Registro da equipe ganhou filtros por tipo de ação e por pessoa.',
        ],
    },
    {
        version: '1.19',
        title: 'Suspensão com prazo, avisos e privacidade travada',
        items: [
            'Conta suspensa ou banida agora vê uma tela só dela, com o motivo, até quando vale e um botão para falar com a equipe no Discord. Dá para baixar um backup da biblioteca e sair da conta. Passado o prazo, a conta volta sozinha.',
            'A equipe escolhe o prazo da suspensão (1, 3, 7 ou 30 dias, ou sem prazo) e a administração também pode banir. O link do Discord é definido no painel (aba Site).',
            'Novo: avisos da equipe. Cada aviso aparece num banner no topo de todas as telas, com o motivo. No 3º aviso a conta é suspensa por 7 dias e a contagem recomeça. A equipe pode retirar um aviso.',
            'A equipe agora pode deixar o perfil e/ou as anotações de uma conta sempre privados. Em Configurações, a opção aparece travada com o motivo; você continua vendo o seu conteúdo. Quando a trava sai, a opção volta a ficar com você (ela não liga sozinha).',
        ],
    },
    {
        version: '1.18',
        title: 'Denúncias com cópia e remoção por campo',
        items: [
            'Quando um perfil é denunciado, a equipe passa a guardar uma cópia do que ele mostrava na hora (nome, bio, foto, fundo e os textos das obras que dava para ver). Assim a análise não depende de a pessoa não editar depois.',
            'A equipe agora consegue remover só o texto ofensivo (nome, bio, título digitado, análise, anotações ou tags). Ele vira "[Conteúdo removido pela moderação]". Progresso, nota, status e favoritos não mudam, e o texto removido não aparece como novidade no feed.',
            'A equipe também pode zerar a foto e o fundo de um perfil de uma vez só.',
        ],
    },
    {
        version: '1.17',
        title: 'Textos mais seguros',
        items: [
            'Os textos que você escreve (nome, bio, título, tags, anotações e análise) agora são limpos antes de salvar e antes de aparecer: caracteres invisíveis, letras empilhadas sem fim e repetições enormes ("aaaaaaaaaaaaaaaa") são cortados. Textos antigos também aparecem limpos.',
            'Bio, tags, anotações, análise e título digitado à mão não aceitam palavras da lista de palavras proibidas da equipe (a lista dos nomes agora vale para eles também). Se algo for recusado, o aviso diz qual campo mexer. Obras que vêm da busca (com título da fonte) não passam por essa conferência no título.',
            'Endereços de sites nesses textos só são aceitos se o site estiver na lista de sites permitidos, que a administração edita no painel (aba Site). Os endereços continuam sendo só texto, sem link clicável.',
            'Painel da equipe: a lista "Nomes proibidos" virou "Palavras proibidas", e há um novo quadro "Sites permitidos nos textos".',
        ],
    },
    {
        version: '1.16',
        title: 'Menu do avatar e equipe sem limite de troca',
        items: [
            'Seu avatar agora fica no canto superior direito, em todas as telas, inclusive no celular. Clique nele para abrir o menu da conta: Meu perfil, Personalização, Configurações, Painel da equipe (só para a equipe) e Sair da conta.',
            'O botão Perfil saiu da barra inferior do celular, porque o menu do avatar já leva para os mesmos lugares. O menu também abre pelo teclado (Enter, Espaço ou seta para baixo), anda com as setas e fecha com Esc.',
            'Dona, Administração e Moderação não têm mais espera nem limite por dia para trocar a foto e o fundo. Quem perder o cargo volta a ter os limites normais.',
        ],
    },
    {
        version: '1.15',
        title: 'Fundo no site todo e limites para trocar foto e fundo',
        items: [
            'O fundo que você escolhe agora aparece no site inteiro enquanto você estiver com login, como as cores. Ao abrir o perfil de outra pessoa, você vê o fundo dela; ao sair, volta o seu. Se a pessoa não tem fundo, a página fica sem imagem.',
            'Para o texto continuar fácil de ler sobre qualquer imagem, os títulos das páginas e a barra de filtros do painel ganharam um painel por trás. O Alto contraste continua escondendo o fundo e sem transparência.',
            'Limites para trocar a foto e o fundo: espere 30 segundos entre uma troca e outra (a foto e o fundo têm a sua própria espera) e faça no máximo 10 trocas por dia, somando foto e fundo. Remover não conta. Na tela aparece quantas trocas você já fez e, quando precisa esperar, o tempo que falta.',
            'Correção: ao excluir a conta, a imagem de fundo também é apagada do armazenamento (antes só a foto era).',
            'Correção: no Alto contraste, a bolinha das chaves (Alto contraste, Desfoque, Perfil público...) ficava torta e encostada na borda. Agora fica centralizada, ligada e desligada.',
        ],
    },
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
