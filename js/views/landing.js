// Página de boas-vindas (visitante, com o Supabase ativado).
import { config } from '../config.js';
import { html, setHtml } from '../core/dom.js';
import { icon } from '../core/icons.js';

const SAMPLE = [
    { title: 'Sousou no Frieren', note: 'Assistindo · 18/28 eps', pct: 64, badge: 'watching' },
    { title: 'Kimi no Na wa.', note: 'Concluído · 1/1 ep', pct: 100, badge: 'completed' },
    { title: 'Dungeon Meshi', note: 'Quero ver', pct: 0, badge: 'planned' },
];
const LABEL = { watching: 'Assistindo', completed: 'Concluído', planned: 'Quero ver' };

export function mount(root) {
    setHtml(root, html`
        <section class="hero glass-panel">
            <div>
                <span class="eyebrow">${icon('sparkles', { size: 14 })} Tracker de animes entre amigos</span>
                <h1>Organize seus animes e <em>compartilhe</em> com a galera.</h1>
                <p class="lead">Marque episódios, acompanhe temporadas, veja a agenda da semana e mostre sua lista num perfil público. Tudo num lugar só.</p>
                <div class="hero-cta">
                    <a class="button button-primary" href="#/criar-conta">${icon('plus', { size: 18 })} Criar minha conta</a>
                    <a class="button button-secondary" href="#/entrar">${icon('logIn', { size: 18 })} Já tenho conta</a>
                    <a class="button button-ghost" href="#/explorar">${icon('compass', { size: 18 })} Explorar perfis</a>
                </div>
            </div>
            <div class="hero-preview" aria-hidden="true">
                ${SAMPLE.map((s) => html`
                    <div class="mini-card">
                        <div class="poster"><span class="poster-empty">${icon('film', { size: 20 })}</span></div>
                        <div class="info">
                            <h3 class="truncate">${s.title}</h3>
                            <span class="badge badge-${s.badge}" style="margin-top:4px">${LABEL[s.badge]}</span>
                            <p class="muted small" style="margin-top:4px">${s.note}</p>
                            <div class="progress ${s.pct >= 100 ? 'is-complete' : ''}"><span style="width:${s.pct}%"></span></div>
                        </div>
                    </div>`)}
            </div>
        </section>

        <section class="feature-grid" aria-label="Recursos">
            <article class="feature glass-panel">
                <span class="stat-icon">${icon('layers', { size: 20 })}</span>
                <h3>Temporadas e episódios</h3>
                <p>Marque episódio por episódio, por temporada, com OVAs e filmes. O status muda sozinho quando você avança.</p>
            </article>
            <article class="feature glass-panel">
                <span class="stat-icon">${icon('globe', { size: 20 })}</span>
                <h3>Perfil público</h3>
                <p>Você escolhe o que mostrar. Seus amigos veem sua lista por um link, e suas anotações continuam privadas se quiser.</p>
            </article>
            <article class="feature glass-panel">
                <span class="stat-icon">${icon('calendar', { size: 20 })}</span>
                <h3>Agenda da semana</h3>
                <p>Veja quais animes saem em cada dia e dê +1 Ep na hora. Busca automática no MyAnimeList e no AniList.</p>
            </article>
        </section>`);
    document.title = `${config.siteName} — seu tracker de animes`;
}
