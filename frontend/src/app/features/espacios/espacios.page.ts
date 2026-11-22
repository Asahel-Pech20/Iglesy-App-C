import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatTab, MatTabContent, MatTabGroup } from '@angular/material/tabs';
import { PageHeader } from '@/app/compartido/page-header';
import { filtrosURL } from '@/app/core/filtros-url';
import type { SolicitudEspacio } from '@/app/tipos/espacios';
import { SolicitudEspacioDialogo } from './solicitud.dialogo';
import { SolicitudesEspacioTab } from './solicitudes.tab';
import { TiposEspacioTab } from './tipos.tab';

const PESTANAS = ['solicitudes', 'tipos'] as const;

/** /espacios — panel de la iglesia: solicitudes (con cotización) y tipos de espacio que ofrece. */
@Component({
  selector: 'app-espacios',
  imports: [MatTabGroup, MatTab, MatTabContent, PageHeader, SolicitudesEspacioTab, TiposEspacioTab],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      titulo="Espacios"
      descripcion="Criptas, nichos, columbarios y osarios: solicitudes del público y cotizaciones."
    />
    <mat-tab-group
      animationDuration="0ms"
      [selectedIndex]="indice()"
      (selectedIndexChange)="cambiarPestana($event)"
    >
      <mat-tab label="Solicitudes">
        <ng-template matTabContent>
          <div class="pestana"><app-solicitudes-espacio-tab (abrir)="abrir($event)" /></div>
        </ng-template>
      </mat-tab>
      <mat-tab label="Tipos">
        <ng-template matTabContent>
          <div class="pestana"><app-tipos-espacio-tab /></div>
        </ng-template>
      </mat-tab>
    </mat-tab-group>
  `,
  styles: `
    .pestana {
      padding-top: 16px;
    }
  `,
})
export class EspaciosPage {
  private readonly dialogo = inject(MatDialog);

  protected readonly filtros = filtrosURL({ tab: 'solicitudes' });
  protected readonly indice = computed(() => {
    const i = PESTANAS.indexOf(this.filtros.valores().tab as (typeof PESTANAS)[number]);
    return i < 0 ? 0 : i;
  });

  protected cambiarPestana(indice: number) {
    const tab = PESTANAS[indice] ?? 'solicitudes';
    if (tab !== this.filtros.valores().tab) this.filtros.cambiar({ tab });
  }

  protected abrir(solicitud: SolicitudEspacio) {
    this.dialogo.open(SolicitudEspacioDialogo, {
      data: solicitud,
      width: '36rem',
      maxWidth: 'calc(100vw - 32px)',
    });
  }
}
