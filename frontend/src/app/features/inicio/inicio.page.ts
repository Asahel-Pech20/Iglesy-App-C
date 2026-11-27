import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AccesosRapidos } from '@/app/compartido/accesos-rapidos';
import { PageHeader } from '@/app/compartido/page-header';
import { SesionService } from '@/app/core/sesion.service';
import { DashboardPage } from '@/app/features/dashboard/dashboard.page';

/**
 * Inicio: el panel de la iglesia para quien lo tiene; para la Coordinación nacional (sin iglesia ni
 * panel), un saludo con accesos a lo que sí puede hacer.
 */
@Component({
  selector: 'app-inicio',
  imports: [AccesosRapidos, PageHeader, DashboardPage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (conPanel()) {
      <app-dashboard />
    } @else {
      <app-page-header
        [titulo]="'Bienvenido, ' + (sesion.usuario()?.nombre ?? '')"
        [descripcion]="descripcion()"
      />
      <app-accesos-rapidos />
    }
  `,
})
export class InicioPage {
  protected readonly sesion = inject(SesionService);
  protected readonly conPanel = computed(() => this.sesion.puede('dashboard:leer'));
  protected readonly descripcion = computed(() =>
    this.sesion.puede('solicitudes:propias')
      ? 'Aquí sigues tus solicitudes de espacio y respondes sus cotizaciones.'
      : 'Desde aquí administras las iglesias del sistema y su personal.',
  );
}
