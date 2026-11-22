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
import { MatOption, MatSelect } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Network, Plus, X } from 'lucide-angular';
import { formatearFecha } from '@/app/core/formato';
import { valorDe } from '@/app/core/recurso';
import { NotificarService } from '@/app/core/notificar.service';
import { BadgeEstado } from '@/app/compartido/badge-estado';
import { ConfirmarService } from '@/app/compartido/confirmar-dialogo';
import { EstadoVacio } from '@/app/compartido/estados';
import { MinisteriosService } from '@/app/features/ministerios/ministerios.service';
import type { MiembroDetalle, MinisterioDeMiembro } from '@/app/tipos/miembros';

/** Ministerios del miembro con opción de agregar/quitar según permisos (F2-04, F2-05). */
@Component({
  selector: 'app-ministerios-del-miembro',
  imports: [
    RouterLink,
    MatButton,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    LucideAngularModule,
    BadgeEstado,
    EstadoVacio,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="tarjeta tarjeta-cuerpo columna">
      <h2 class="tarjeta-titulo">Ministerios</h2>
      @if (miembro().activo && opciones().length > 0) {
        <div class="agregar">
          <mat-form-field subscriptSizing="dynamic" class="selector">
            <mat-label>Ministerio al que agregar</mat-label>
            <mat-select [value]="elegido()" (valueChange)="elegido.set($event)">
              @for (o of opciones(); track o.id) {
                <mat-option [value]="o.id">{{ o.nombre }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <button
            matButton="filled"
            type="button"
            [disabled]="!elegido() || agregando()"
            (click)="agregar()"
          >
            <lucide-icon [img]="iconos.Plus" [size]="16" aria-hidden="true" />
            {{ agregando() ? 'Agregando…' : 'Agregar a ministerio' }}
          </button>
        </div>
      }

      @if (actuales().length === 0) {
        <app-estado-vacio [icono]="iconos.Network" titulo="No pertenece a ningún ministerio" />
      } @else {
        <ul class="lista" aria-label="Ministerios actuales">
          @for (m of actuales(); track m.id) {
            <li>
              <div>
                <a [routerLink]="['/ministerios', m.id]" class="nombre">{{ m.nombre }}</a>
                <p class="texto-suave pequeno">Desde {{ fecha(m.fechaUnion) }}</p>
              </div>
              @if (puedeQuitar(m.id)) {
                <button
                  matButton
                  type="button"
                  (click)="quitar(m)"
                  [attr.aria-label]="'Quitar de ' + m.nombre"
                >
                  <lucide-icon [img]="iconos.X" [size]="16" aria-hidden="true" /> Quitar
                </button>
              }
            </li>
          }
        </ul>
      }

      @if (historicos().length > 0) {
        <div>
          <p class="texto-suave pequeno titulo-historico">ANTERIORES</p>
          <ul class="historicos" aria-label="Ministerios anteriores">
            @for (m of historicos(); track m.id) {
              <li>
                <app-badge-estado
                  variante="neutro"
                  [etiqueta]="
                    m.nombre + ' (' + fecha(m.fechaUnion) + ' – ' + fecha(m.fechaSalida) + ')'
                  "
                />
              </li>
            }
          </ul>
        </div>
      }
    </section>
  `,
  styles: `
    .agregar {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    @media (min-width: 640px) {
      .agregar {
        flex-direction: row;
        align-items: center;
      }
      .selector {
        width: 15rem;
      }
    }
    .lista {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .lista li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 0;
    }
    .lista li + li {
      border-top: 1px solid var(--borde);
    }
    .nombre {
      font-weight: 500;
    }
    p {
      margin: 0;
    }
    .pequeno {
      font-size: 12px;
    }
    .titulo-historico {
      margin-bottom: 4px;
      font-weight: 500;
    }
    .historicos {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
  `,
})
export class MinisteriosDelMiembro {
  readonly miembro = input.required<MiembroDetalle>();
  /** Se emite tras agregar o quitar, para recargar el perfil */
  readonly cambio = output();
  private readonly servicio = inject(MinisteriosService);
  private readonly confirmar = inject(ConfirmarService);
  private readonly notificar = inject(NotificarService);

  private readonly catalogo = rxResource({ stream: () => this.servicio.listar({ limit: 100 }) });
  protected readonly elegido = signal<string | undefined>(undefined);
  protected readonly agregando = signal(false);
  protected readonly actuales = computed(() => this.miembro().ministerios.filter((m) => m.activo));
  protected readonly historicos = computed(() =>
    this.miembro().ministerios.filter((m) => !m.activo),
  );
  // COORDINADOR: solo ve como opción los ministerios que coordina
  protected readonly opciones = computed(() =>
    (valorDe(this.catalogo)?.data ?? []).filter(
      (m) =>
        m.activo &&
        this.servicio.puedeGestionarIntegrantes(m) &&
        !this.actuales().some((a) => a.id === m.id),
    ),
  );
  protected readonly fecha = formatearFecha;
  protected readonly iconos = { Network, Plus, X };

  protected puedeQuitar(id: string) {
    return this.servicio.puedeGestionarIntegrantes(
      valorDe(this.catalogo)?.data.find((m) => m.id === id),
    );
  }

  protected agregar() {
    const id = this.elegido();
    if (!id) return;
    this.agregando.set(true);
    this.servicio.vincularMiembros(id, [this.miembro().id]).subscribe({
      next: () => {
        this.agregando.set(false);
        this.elegido.set(undefined);
        this.notificar.exito('Miembro agregado al ministerio');
        this.cambio.emit();
      },
      error: (e: unknown) => {
        this.agregando.set(false);
        this.notificar.error(e);
      },
    });
  }

  protected async quitar(m: MinisterioDeMiembro) {
    const hecho = await this.confirmar.abrir({
      titulo: 'Quitar del ministerio',
      descripcion: `${this.miembro().nombre} saldrá de ${m.nombre}. Su participación quedará en el historial.`,
      textoConfirmar: 'Quitar',
      peligro: true,
      alConfirmar: () => this.servicio.desvincularMiembro(m.id, this.miembro().id),
    });
    if (hecho) {
      this.notificar.exito('Miembro quitado del ministerio');
      this.cambio.emit();
    }
  }
}
