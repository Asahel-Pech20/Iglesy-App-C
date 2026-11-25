import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { MatTab, MatTabContent, MatTabGroup } from '@angular/material/tabs';
import { PageHeader } from '@/app/compartido/page-header';
import { filtrosURL } from '@/app/core/filtros-url';
import { CelebradasTab } from './celebradas.tab';
import { HorarioMisasTab } from './horario.tab';
import { PadresTab } from './padres.tab';

const PESTANAS = ['horario', 'padres', 'celebradas'] as const;

/** /misas — panel de la iglesia: horario semanal, padres y misas celebradas (E3-15, Genaro). */
@Component({
  selector: 'app-misas',
  imports: [
    MatTabGroup,
    MatTab,
    MatTabContent,
    PageHeader,
    HorarioMisasTab,
    PadresTab,
    CelebradasTab,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      titulo="Misas"
      descripcion="Horario semanal con el padre de cada misa, padres de la iglesia y misas celebradas."
    />
    <mat-tab-group
      animationDuration="0ms"
      [selectedIndex]="indice()"
      (selectedIndexChange)="cambiarPestana($event)"
    >
      <mat-tab label="Horario">
        <ng-template matTabContent>
          <div class="pestana"><app-horario-misas-tab /></div>
        </ng-template>
      </mat-tab>
      <mat-tab label="Padres">
        <ng-template matTabContent>
          <div class="pestana"><app-padres-tab /></div>
        </ng-template>
      </mat-tab>
      <mat-tab label="Celebradas">
        <ng-template matTabContent>
          <div class="pestana"><app-celebradas-tab /></div>
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
export class MisasPage {
  protected readonly filtros = filtrosURL({ tab: 'horario' });
  protected readonly indice = computed(() => {
    const i = PESTANAS.indexOf(this.filtros.valores().tab as (typeof PESTANAS)[number]);
    return i < 0 ? 0 : i;
  });

  protected cambiarPestana(indice: number) {
    const tab = PESTANAS[indice] ?? 'horario';
    if (tab !== this.filtros.valores().tab) this.filtros.cambiar({ tab });
  }
}
