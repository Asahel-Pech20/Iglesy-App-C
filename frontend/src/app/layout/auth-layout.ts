import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ArrowLeft, LucideAngularModule } from 'lucide-angular';
import { MarcaIglesia } from './marca-iglesia';
import { AdornoColonial } from '@/app/compartido/adorno-colonial';
import { FOTOS_IGLESIAS } from '@/app/features/explorar/fotos-iglesias';

/**
 * Layout de pantallas públicas (login, recuperar, restablecer), con el estilo de la landing: foto de
 * una iglesia de orilla a orilla, sombra oscura pareja y la tarjeta del formulario encima.
 */
@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet, RouterLink, LucideAngularModule, MarcaIglesia, AdornoColonial],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="fondo" [style.background-image]="'url(' + foto.archivo + ')'">
      <a routerLink="/" class="volver">
        <lucide-icon [img]="iconos.ArrowLeft" [size]="16" aria-hidden="true" /> Volver al inicio
      </a>
      <div class="contenido">
        <div class="bienvenida">
          <p class="lema">Ecclesia · Patrimonio de México</p>
          <p class="titulo">Acceso del personal</p>
          <p class="texto">Coordinación Nacional y personal de cada iglesia.</p>
        </div>
        <div class="tarjeta caja">
          <div class="cabecera">
            <app-marca-iglesia [grande]="true" />
            <app-adorno-colonial />
          </div>
          <router-outlet />
        </div>
      </div>
      <p class="credito">
        Foto:
        <a [href]="foto.enlace" target="_blank" rel="noopener noreferrer">{{ foto.lugar }}</a> ·
        {{ foto.autor }} en Unsplash
      </p>
    </main>
  `,
  styles: `
    .fondo {
      position: relative;
      isolation: isolate;
      display: flex;
      min-height: 100dvh;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 72px 16px 16px;
      color: var(--foto-texto);
      background-color: var(--foto-sombra);
      background-position: center;
      background-size: cover;
    }
    /* Sombra pareja: el texto blanco queda con contraste ≥ 4.5:1 sobre cualquier parte de la foto */
    .fondo::before {
      content: '';
      position: absolute;
      inset: 0;
      z-index: -1;
      background: color-mix(in srgb, var(--foto-sombra) 72%, transparent);
    }
    /* Píldora flotante, como la barra de las pantallas públicas */
    .volver {
      position: absolute;
      top: 16px;
      left: 16px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      font-size: 14px;
      color: var(--texto);
      text-decoration: none;
      border-radius: 999px;
      background: color-mix(in srgb, var(--pergamino) 90%, transparent);
      backdrop-filter: blur(8px);
      box-shadow: 0 2px 12px rgb(0 0 0 / 0.15);
    }
    .contenido {
      display: grid;
      width: 100%;
      max-width: 60rem;
      gap: 24px;
      align-items: center;
      justify-items: center;
    }
    .bienvenida {
      display: none;
    }
    .lema {
      margin: 0;
      font-size: 12px;
      letter-spacing: 3px;
      text-transform: uppercase;
    }
    .titulo {
      margin: 8px 0 12px;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 44px;
      line-height: 1.1;
    }
    .texto {
      margin: 0;
      max-width: 26rem;
      font-size: 16px;
    }
    @media (min-width: 768px) {
      .contenido {
        grid-template-columns: minmax(0, 1fr) 24rem;
        justify-items: stretch;
      }
      .bienvenida {
        display: block;
      }
    }
    .cabecera {
      display: flex;
      flex-direction: column;
    }
    .caja {
      display: flex;
      width: 100%;
      max-width: 24rem;
      flex-direction: column;
      gap: 24px;
      padding: 32px 24px;
      color: var(--texto);
      border-radius: 16px;
      box-shadow: 0 12px 40px rgb(0 0 0 / 0.35);
    }
    .credito {
      margin: 0;
      padding: 4px 10px;
      font-size: 11px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--foto-sombra) 80%, transparent);
    }
    .credito a {
      color: inherit;
    }
    @media (min-width: 768px) {
      .credito {
        position: absolute;
        right: 12px;
        bottom: 12px;
      }
    }
  `,
})
export class AuthLayout {
  /** La foto de la sección de bienvenida de la landing (Mamatla). */
  protected readonly foto = FOTOS_IGLESIAS[3];
  protected readonly iconos = { ArrowLeft };
}
