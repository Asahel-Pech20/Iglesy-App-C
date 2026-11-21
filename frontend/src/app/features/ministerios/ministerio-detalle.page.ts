import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatTab, MatTabGroup } from '@angular/material/tabs';
import { RouterLink } from '@angular/router';
import {
  ArrowLeft,
  CalendarDays,
  LucideAngularModule,
  Pencil,
  Power,
  UserCog,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-angular';
import { formatearFecha } from '@/app/core/formato';
import { valorDe } from '@/app/core/recurso';
import { NotificarService } from '@/app/core/notificar.service';
import { PuedeDirective } from '@/app/core/puede.directive';
import { BadgeEstado } from '@/app/compartido/badge-estado';
import { CampoBusqueda } from '@/app/compartido/campo-busqueda';
import { ConfirmarService } from '@/app/compartido/confirmar-dialogo';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import { Paginacion } from '@/app/compartido/paginacion';
import type { Integrante, Ministerio } from '@/app/tipos/ministerios';
import { ActividadesMinisterio } from '@/app/features/eventos/actividades-ministerio';
import { BotonExportar } from '@/app/features/reportes/boton-exportar';
import { AgregarIntegrantesDialogo, CoordinadoresDialogo, MinisterioFormDialogo } from './dialogos';
import { MinisteriosService } from './ministerios.service';

/** /ministerios/:id — encabezado, coordinadores, integrantes y actividades (F2-09…F2-11). */
@Component({
  selector: 'app-ministerio-detalle',
  imports: [
    RouterLink,
    MatButton,
    MatSlideToggle,
    MatTableModule,
    MatTabGroup,
    MatTab,
    LucideAngularModule,
    PuedeDirective,
    BadgeEstado,
    CampoBusqueda,
    EstadoVacio,
    EstadoError,
    Esqueleto,
    Paginacion,
    ActividadesMinisterio,
    BotonExportar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ministerio-detalle.page.html',
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
    .resumen {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 24px;
    }
    @media (min-width: 640px) {
      .resumen {
        flex-direction: row;
        align-items: flex-start;
        justify-content: space-between;
      }
    }
    .resumen p {
      margin: 0;
    }
    .resumen .coordinacion {
      margin-top: 8px;
    }
    .pestana {
      margin-top: 16px;
    }
    .barra {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }
    @media (min-width: 640px) {
      .barra {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
      }
    }
    .izquierda {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 16px;
    }
  `,
})
export class MinisterioDetallePage {
  readonly id = input.required<string>();
  private readonly servicio = inject(MinisteriosService);
  private readonly dialog = inject(MatDialog);
  private readonly confirmar = inject(ConfirmarService);
  private readonly notificar = inject(NotificarService);

  protected readonly consulta = rxResource({
    params: () => this.id(),
    stream: ({ params }) => this.servicio.obtener(params),
  });

  // Pestaña de integrantes: búsqueda, históricos, agregar y quitar (F2-10)
  protected readonly q = signal('');
  protected readonly historicos = signal(false);
  protected readonly pagina = signal(1);
  protected readonly integrantes = rxResource({
    params: () => ({
      id: this.id(),
      q: this.q() || undefined,
      incluirHistoricos: this.historicos() || undefined,
      page: this.pagina(),
    }),
    stream: ({ params: { id, ...query } }) => this.servicio.listarIntegrantes(id, query),
  });
  protected readonly filas = computed(() => valorDe(this.integrantes)?.data ?? []);
  protected readonly puedeGestionar = computed(() =>
    this.servicio.puedeGestionarIntegrantes(valorDe(this.consulta)),
  );
  protected readonly columnas = computed(() =>
    this.puedeGestionar()
      ? ['nombre', 'telefono', 'fechaUnion', 'estado', 'acciones']
      : ['nombre', 'telefono', 'fechaUnion', 'estado'],
  );
  protected readonly fecha = formatearFecha;
  protected readonly iconos = {
    ArrowLeft,
    Pencil,
    Power,
    UserCog,
    UserPlus,
    UserMinus,
    Users,
    CalendarDays,
  };

  protected coordinacion(m: Ministerio) {
    return m.coordinadores.length > 0
      ? m.coordinadores.map((c) => c.nombre).join(', ')
      : 'sin asignar';
  }

  protected buscar(q: string) {
    this.q.set(q);
    this.pagina.set(1);
  }

  protected verHistoricos(valor: boolean) {
    this.historicos.set(valor);
    this.pagina.set(1);
  }

  private recargarTodo() {
    this.consulta.reload();
    this.integrantes.reload();
  }

  private abrir(componente: Parameters<MatDialog['open']>[0], ministerio: Ministerio) {
    this.dialog
      .open(componente, { data: ministerio, width: '32rem', maxWidth: 'calc(100vw - 32px)' })
      .afterClosed()
      .subscribe((guardado) => guardado && this.recargarTodo());
  }

  protected editar(m: Ministerio) {
    this.abrir(MinisterioFormDialogo, m);
  }

  protected editarCoordinadores(m: Ministerio) {
    this.abrir(CoordinadoresDialogo, m);
  }

  protected agregarIntegrantes(m: Ministerio) {
    this.abrir(AgregarIntegrantesDialogo, m);
  }

  protected async cambiarEstado(m: Ministerio) {
    const hecho = await this.confirmar.abrir({
      titulo: m.activo ? 'Desactivar ministerio' : 'Reactivar ministerio',
      descripcion: m.activo
        ? 'El ministerio dejará de aparecer entre los activos. Se conservan sus integrantes, coordinadores e historial.'
        : 'El ministerio volverá a estar activo con sus integrantes y coordinadores.',
      textoConfirmar: m.activo ? 'Desactivar' : 'Reactivar',
      peligro: m.activo,
      alConfirmar: () => this.servicio.cambiarEstado(m.id, !m.activo),
    });
    if (hecho) {
      this.notificar.exito(m.activo ? 'Ministerio desactivado' : 'Ministerio reactivado');
      this.consulta.reload();
    }
  }

  protected async quitar(m: Ministerio, i: Integrante) {
    const hecho = await this.confirmar.abrir({
      titulo: 'Quitar integrante',
      descripcion: `${i.nombre} ${i.apellidos} saldrá de ${m.nombre}. Su participación quedará en el historial.`,
      textoConfirmar: 'Quitar',
      peligro: true,
      alConfirmar: () => this.servicio.desvincularMiembro(m.id, i.id),
    });
    if (hecho) {
      this.notificar.exito('Integrante quitado');
      this.recargarTodo();
    }
  }
}
