import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MarcaIglesia } from './marca-iglesia';
import { AdornoColonial } from '@/app/compartido/adorno-colonial';

/** Layout de pantallas públicas (login, recuperar, restablecer). */
@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet, MarcaIglesia, AdornoColonial],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="fondo">
      <div class="tarjeta caja">
        <div class="cabecera">
          <app-marca-iglesia [grande]="true" />
          <app-adorno-colonial />
        </div>
        <router-outlet />
      </div>
    </main>
  `,
  styles: `
    .fondo {
      display: flex;
      min-height: 100dvh;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: var(--pergamino);
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
    }
  `,
})
export class AuthLayout {}
