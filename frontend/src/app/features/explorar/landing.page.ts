import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { Gem, Landmark, LogIn, LucideAngularModule, MapPin, Search } from 'lucide-angular';
import { TituloColonial } from './explorar-layout';

/**
 * Página de entrada de Ecclesia para quien llega sin sesión (`/`). Presenta el sistema en el estilo
 * colonial de las pantallas públicas (E2-14) y lleva a las consultas o al acceso del personal.
 * Con sesión, `/` sigue siendo el inicio del panel (ver `sinSesion` en core/guards.ts).
 */
@Component({
  selector: 'app-landing',
  imports: [RouterLink, MatButton, LucideAngularModule, TituloColonial],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }
    .portada {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 24px 0 8px;
      text-align: center;
    }
    .lema {
      margin: 0;
      font-size: 11px;
      letter-spacing: 2px;
      color: var(--acento);
    }
    .intro {
      max-width: 36rem;
      margin: 0;
      font-size: 16px;
      line-height: 1.6;
      color: var(--texto-suave);
    }
    .botones {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 12px;
      margin-top: 16px;
    }
    .tarjetas {
      display: grid;
      gap: 16px;
      margin: 32px 0 0;
      padding: 0;
      list-style: none;
    }
    @media (min-width: 768px) {
      .tarjetas {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }
    .tarjeta-colonial {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      height: 100%;
      margin: 4px;
      padding: 20px 16px;
      background: var(--superficie);
      border: 1px solid var(--marco);
      outline: 1px solid var(--marco);
      outline-offset: 3px;
      border-radius: 4px;
      text-align: center;
      box-sizing: border-box;
    }
    .icono {
      color: var(--acento);
    }
    h2 {
      margin: 0;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 19px;
      font-weight: 400;
      color: var(--primario);
    }
    .tarjeta-colonial p {
      margin: 0;
      color: var(--texto-suave);
      line-height: 1.5;
    }
    .tarjeta-colonial a {
      margin-top: auto;
      padding-top: 4px;
      font-size: 14px;
    }
    .pie {
      margin: 40px 0 0;
      padding-top: 16px;
      border-top: 1px solid var(--marco);
      font-size: 12px;
      letter-spacing: 1px;
      text-align: center;
      color: var(--texto-suave);
    }
  `,
  template: `
    <section class="portada" aria-labelledby="titulo-landing">
      <p class="lema">COORDINACIÓN NACIONAL DE TEMPLOS</p>
      <app-titulo-colonial
        texto="Ecclesia"
        subtitulo="Las iglesias de México y su patrimonio, en un solo lugar."
        idTitulo="titulo-landing"
      />
      <p class="intro">
        Consulta las iglesias de cada estado, conoce los objetos que guardan y cuáles tienen mayor
        valor patrimonial. El personal de cada iglesia administra aquí su información.
      </p>
      <div class="botones">
        <a matButton="filled" routerLink="/templos">
          <lucide-icon [img]="iconos.MapPin" [size]="16" aria-hidden="true" /> Explorar iglesias
        </a>
        <a matButton="outlined" routerLink="/login">
          <lucide-icon [img]="iconos.LogIn" [size]="16" aria-hidden="true" /> Acceso del personal
        </a>
      </div>
    </section>

    <ul class="tarjetas" aria-label="Qué puedes hacer">
      <li>
        <article class="tarjeta-colonial">
          <lucide-icon class="icono" [img]="iconos.Landmark" [size]="24" aria-hidden="true" />
          <h2>Iglesias por estado</h2>
          <p>Elige un estado y filtra por municipio, tipo de templo o capacidad.</p>
          <a routerLink="/templos">Ver iglesias</a>
        </article>
      </li>
      <li>
        <article class="tarjeta-colonial">
          <lucide-icon class="icono" [img]="iconos.Gem" [size]="24" aria-hidden="true" />
          <h2>Las más reconocidas</h2>
          <p>Ordenadas por su índice de valor patrimonial, de mayor a menor.</p>
          <a routerLink="/reconocidas">Ver el ranking</a>
        </article>
      </li>
      <li>
        <article class="tarjeta-colonial">
          <lucide-icon class="icono" [img]="iconos.Search" [size]="24" aria-hidden="true" />
          <h2>Búsqueda por patrimonio</h2>
          <p>Encuentra las iglesias que guardan un tipo de objeto, como retablos o pinturas.</p>
          <a routerLink="/busqueda-patrimonio">Buscar</a>
        </article>
      </li>
    </ul>

    <p class="pie">ECCLESIA · PATRIMONIO DE MÉXICO</p>
  `,
})
export class LandingPage {
  protected readonly iconos = { Gem, Landmark, LogIn, MapPin, Search };
}
