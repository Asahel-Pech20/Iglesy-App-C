import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatTab, MatTabGroup } from '@angular/material/tabs';
import { RouterLink } from '@angular/router';
import {
  ArrowLeft,
  CalendarCheck,
  LucideAngularModule,
  Pencil,
  Percent,
  UserCheck,
  UserX,
} from 'lucide-angular';
import { formatearFecha, formatearFechaHora } from '@/app/core/formato';
import { valorDe } from '@/app/core/recurso';
import { PuedeDirective } from '@/app/core/puede.directive';
import { SesionService } from '@/app/core/sesion.service';
import { BadgeEstado } from '@/app/compartido/badge-estado';
import { EstadoError, Esqueleto } from '@/app/compartido/estados';
import { StatCard } from '@/app/compartido/stat-card';
import { AsistenciaDelMiembro } from '@/app/features/asistencia/asistencia-del-miembro';
import { AportacionesDelMiembro } from '@/app/features/donaciones/aportaciones-del-miembro';
import { EstadoMiembroService } from './estado-miembro';
import type { EstadoPerfilMiembro } from './miembro-form.page';
import { MiembrosService } from './miembros.service';
import { MinisteriosDelMiembro } from './ministerios-del-miembro';

/** /miembros/:id — perfil con datos, ministerios, asistencia y aportaciones (F2-04). */
@Component({
  selector: 'app-miembro-perfil',
  imports: [
    RouterLink,
    MatButton,
    MatTabGroup,
    MatTab,
    LucideAngularModule,
    PuedeDirective,
    BadgeEstado,
    EstadoError,
    Esqueleto,
    StatCard,
    MinisteriosDelMiembro,
    AsistenciaDelMiembro,
    AportacionesDelMiembro,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './miembro-perfil.page.html',
  styles: `
    .encabezado {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 24px;
    }
    h1 {
      margin: 0 0 4px;
      font-size: 20px;
      font-weight: 600;
    }
    .acciones {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .boton-peligro {
      --mat-button-filled-container-color: var(--peligro);
      --mat-button-filled-label-text-color: var(--peligro-texto);
    }
    .aviso {
      margin-bottom: 16px;
    }
    .pestana {
      margin-top: 16px;
    }
  `,
})
export class MiembroPerfilPage {
  readonly id = input.required<string>();
  private readonly servicio = inject(MiembrosService);
  private readonly estado = inject(EstadoMiembroService);
  private readonly sesion = inject(SesionService);

  /** Si se acaba de crear y ya había alguien con el mismo nombre (B2-01) */
  protected readonly duplicadoId =
    (history.state as EstadoPerfilMiembro | null)?.duplicadoId ?? null;
  protected readonly consulta = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.servicio.obtener(params),
  });
  protected readonly verAsistencia = computed(() =>
    this.sesion.puede('asistencia:leer', 'asistencia:leer-propio'),
  );
  protected readonly verAportaciones = computed(() => this.sesion.puede('donaciones:leer'));
  protected readonly fecha = formatearFecha;
  protected readonly fechaHora = formatearFechaHora;
  protected readonly iconos = { ArrowLeft, Pencil, UserX, UserCheck, Percent, CalendarCheck };

  protected async cambiarEstado() {
    const m = valorDe(this.consulta);
    if (m && (await this.estado.cambiar(m))) this.consulta.reload();
  }
}
