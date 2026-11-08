import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageHeader } from '@/app/compartido/page-header';
import { SesionService } from '@/app/core/sesion.service';
import { DashboardPage } from '@/app/features/dashboard/dashboard.page';

/**
 * Inicio: el panel de la iglesia para quien lo tiene; para la Coordinación nacional (sin iglesia ni
 * panel), un saludo con accesos a lo que sí puede hacer.
 */
@Component({
  selector: 'app-inicio',
  imports: [RouterLink, PageHeader, DashboardPage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (conPanel()) {
      <app-dashboard />
    } @else {
      <app-page-header
        [titulo]="'Bienvenido, ' + (sesion.usuario()?.nombre ?? '')"
        descripcion="Desde aquí administras las iglesias del sistema y su personal."
      />
      <section class="tarjeta tarjeta-cuerpo accesos">
        @if (sesion.puede('iglesias:leer')) {
          <a routerLink="/iglesias">Ver y crear iglesias</a>
        }
        @if (sesion.puede('usuarios:leer')) {
          <a routerLink="/usuarios">Administrar usuarios</a>
        }
        @if (sesion.puede('configuracion:leer')) {
          <a routerLink="/configuracion">Configuración</a>
        }
      </section>
    }
  `,
  styles: `
    .accesos {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
  `,
})
export class InicioPage {
  protected readonly sesion = inject(SesionService);
  protected readonly conPanel = computed(() => this.sesion.puede('dashboard:leer'));
}
