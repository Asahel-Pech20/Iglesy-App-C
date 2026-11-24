import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { CalendarPlus, ClipboardCheck, LucideAngularModule } from 'lucide-angular';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import { aFechaApi, formatearFechaHora } from '@/app/core/formato';
import { NotificarService } from '@/app/core/notificar.service';
import { valorDe } from '@/app/core/recurso';
import { SesionService } from '@/app/core/sesion.service';
import { ConfiguracionService } from '@/app/features/configuracion/configuracion.service';
import { BadgeEstadoEvento } from '@/app/features/eventos/componentes';
import { ICONO_CATEGORIA } from '@/app/features/eventos/estilos';
import { EventosService } from '@/app/features/eventos/eventos.service';
import { PermisosMinisterioService } from '@/app/features/eventos/permisos-ministerio.service';

/** Eventos del día elegido para pasar lista; COORDINADOR solo ve los de sus ministerios (F3-06). */
@Component({
  selector: 'app-seleccion-evento',
  imports: [
    RouterLink,
    MatButton,
    MatFormField,
    MatLabel,
    MatInput,
    LucideAngularModule,
    EstadoError,
    EstadoVacio,
    Esqueleto,
    BadgeEstadoEvento,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="columna">
      <mat-form-field class="fecha" subscriptSizing="dynamic">
        <mat-label>Fecha</mat-label>
        <input matInput type="date" [value]="fecha()" (change)="alCambiarFecha($event)" />
      </mat-form-field>
      <section class="tarjeta">
        @if (consulta.isLoading() && !consulta.hasValue()) {
          <app-esqueleto [filas]="3" [columnas]="2" />
        } @else if (consulta.error()) {
          <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
        } @else if (eventos().length === 0) {
          <app-estado-vacio
            titulo="No hay eventos este día"
            descripcion="La asistencia se registra sobre un evento."
          >
            @if (puedeCrearRapido()) {
              <button
                matButton="filled"
                type="button"
                [disabled]="creando()"
                (click)="crearCultoRapido()"
              >
                <lucide-icon [img]="iconos.CalendarPlus" [size]="16" aria-hidden="true" />
                Crear evento rápido (culto)
              </button>
            }
          </app-estado-vacio>
        } @else {
          <ul aria-label="Eventos del día" class="lista">
            @for (e of eventos(); track e.id) {
              <li class="evento">
                <div class="datos">
                  <span class="icono" [class]="'icono cat-' + e.categoria">
                    <lucide-icon
                      [img]="iconoCategoria[e.categoria]"
                      [size]="16"
                      aria-hidden="true"
                    />
                  </span>
                  <div class="textos">
                    <p class="titulo">{{ e.titulo }}</p>
                    <p class="texto-suave detalle">
                      {{ fechaHora(e.fechaInicio) }} · {{ e.lugar
                      }}{{ e.ministerio ? ' · ' + e.ministerio.nombre : '' }}
                    </p>
                  </div>
                </div>
                <div class="acciones">
                  <app-badge-estado-evento [estado]="e.estado" />
                  <a matButton="filled" [routerLink]="['/eventos', e.id, 'asistencia']">
                    <lucide-icon [img]="iconos.ClipboardCheck" [size]="16" aria-hidden="true" />
                    Pasar lista
                  </a>
                </div>
              </li>
            }
          </ul>
        }
      </section>
    </div>
  `,
  styles: `
    .fecha {
      max-width: 20rem;
    }
    .lista {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .evento {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
    }
    .evento + .evento {
      border-top: 1px solid var(--marco);
    }
    @media (min-width: 640px) {
      .evento {
        flex-direction: row;
        align-items: center;
      }
    }
    .datos {
      display: flex;
      min-width: 0;
      flex: 1;
      align-items: flex-start;
      gap: 12px;
    }
    .icono {
      display: inline-flex;
      width: 36px;
      height: 36px;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
    }
    .titulo,
    .detalle {
      margin: 0;
    }
    .titulo {
      font-weight: 500;
    }
    .detalle {
      font-size: 14px;
    }
    .acciones {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
  `,
})
export class SeleccionEvento {
  /** "yyyy-MM-dd" */
  readonly fecha = input.required<string>();
  readonly cambioFecha = output<string>();

  private readonly eventosService = inject(EventosService);
  private readonly sesion = inject(SesionService);
  private readonly permisos = inject(PermisosMinisterioService);
  private readonly configuracion = inject(ConfiguracionService);
  private readonly notificar = inject(NotificarService);
  private readonly router = inject(Router);

  // Fecha sola: el backend toma el día completo en la zona horaria de la iglesia
  protected readonly consulta = rxResource({
    params: () => this.fecha(),
    stream: ({ params }) => this.eventosService.listar({ desde: params, hasta: params }),
  });
  protected readonly eventos = computed(() =>
    (valorDe(this.consulta)?.data ?? []).filter(
      (e) =>
        e.estado !== 'CANCELADO' &&
        this.permisos.puede('asistencia:leer', 'asistencia:leer-propio', e.ministerio?.id),
    ),
  );
  protected readonly puedeCrearRapido = computed(() => this.sesion.puede('eventos:crear'));
  protected readonly creando = signal(false);
  protected readonly iconos = { CalendarPlus, ClipboardCheck };
  protected readonly iconoCategoria = ICONO_CATEGORIA;
  protected readonly fechaHora = formatearFechaHora;

  protected alCambiarFecha(evento: Event) {
    const valor = (evento.target as HTMLInputElement).value;
    this.cambioFecha.emit(valor || aFechaApi(new Date()));
  }

  /** Culto rápido a la hora actual (si es hoy) o a las 10:00, en el lugar habitual. */
  protected crearCultoRapido() {
    const esHoy = this.fecha() === aFechaApi(new Date());
    const fechaInicio = esHoy ? new Date() : new Date(`${this.fecha()}T10:00:00`);
    this.creando.set(true);
    this.configuracion.listarHorarios().subscribe({
      next: (horarios) => this.crear(fechaInicio, horarios.find((h) => h.activo && h.lugar)?.lugar),
      error: () => this.crear(fechaInicio, undefined),
    });
  }

  private crear(fechaInicio: Date, lugar: string | null | undefined) {
    this.eventosService
      .crear({
        titulo: 'Culto',
        tipo: 'RELIGIOSO',
        categoria: 'CULTO',
        fechaInicio: fechaInicio.toISOString(),
        lugar: lugar ?? 'Templo',
      })
      .subscribe({
        next: (evento) => {
          this.notificar.exito('Evento creado');
          void this.router.navigate(['/eventos', evento.id, 'asistencia']);
        },
        error: (e: unknown) => {
          this.creando.set(false);
          this.notificar.error(e);
        },
      });
  }
}
