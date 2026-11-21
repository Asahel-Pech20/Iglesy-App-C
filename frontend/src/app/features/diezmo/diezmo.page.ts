import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatTab, MatTabContent, MatTabGroup } from '@angular/material/tabs';
import { LucideAngularModule, Plus } from 'lucide-angular';
import { PageHeader } from '@/app/compartido/page-header';
import { filtrosURL } from '@/app/core/filtros-url';
import { PuedeDirective } from '@/app/core/puede.directive';
import type { MisaCelebrada } from '@/app/tipos/diezmo';
import { HistorialDiezmoDialogo } from './historial-diezmo.dialogo';
import { MisasTab } from './misas.tab';
import { MontoDiezmoDialogo } from './monto-diezmo.dialogo';
import { RegistrarMisaDialogo } from './registrar-misa.dialogo';
import { ReportesDiezmoTab } from './reportes-diezmo.tab';

const PESTANAS = ['misas', 'reportes'] as const;
const OPCIONES_DIALOGO = { width: '32rem', maxWidth: 'calc(100vw - 32px)' };

/** /diezmo — captura y corrección del diezmo de cada misa, y sus reportes (E4-14 … E4-16). */
@Component({
  selector: 'app-diezmo',
  imports: [
    MatButton,
    MatTabGroup,
    MatTab,
    MatTabContent,
    LucideAngularModule,
    PuedeDirective,
    PageHeader,
    MisasTab,
    ReportesDiezmoTab,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      titulo="Diezmo"
      descripcion="Diezmo de cada misa celebrada en tu iglesia, sus correcciones y reportes."
    >
      <button
        *appPuede="'misas:registrar'"
        matButton="filled"
        type="button"
        (click)="registrarMisa()"
      >
        <lucide-icon [img]="iconos.Plus" [size]="16" aria-hidden="true" /> Registrar misa
      </button>
    </app-page-header>

    <mat-tab-group
      animationDuration="0ms"
      [selectedIndex]="indice()"
      (selectedIndexChange)="cambiarPestana($event)"
    >
      <mat-tab label="Misas">
        <ng-template matTabContent>
          <div class="pestana">
            <app-misas-tab
              (capturar)="capturar($event)"
              (historial)="verHistorial($event)"
              (registrar)="registrarMisa()"
            />
          </div>
        </ng-template>
      </mat-tab>
      <mat-tab label="Reportes">
        <ng-template matTabContent>
          <div class="pestana"><app-reportes-diezmo-tab /></div>
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
export class DiezmoPage {
  private readonly dialogo = inject(MatDialog);

  protected readonly filtros = filtrosURL({ tab: 'misas' });
  protected readonly iconos = { Plus };
  protected readonly indice = computed(() => {
    const i = PESTANAS.indexOf(this.filtros.valores().tab as (typeof PESTANAS)[number]);
    return i < 0 ? 0 : i;
  });

  protected cambiarPestana(indice: number) {
    const tab = PESTANAS[indice] ?? 'misas';
    if (tab !== this.filtros.valores().tab) this.filtros.cambiar({ tab });
  }

  // Las listas y reportes se recargan solos con DiezmoService.version
  protected registrarMisa() {
    this.dialogo.open(RegistrarMisaDialogo, OPCIONES_DIALOGO);
  }

  protected capturar(misa: MisaCelebrada) {
    this.dialogo.open(MontoDiezmoDialogo, { ...OPCIONES_DIALOGO, data: misa });
  }

  protected verHistorial(misa: MisaCelebrada) {
    this.dialogo.open(HistorialDiezmoDialogo, { ...OPCIONES_DIALOGO, data: misa });
  }
}
