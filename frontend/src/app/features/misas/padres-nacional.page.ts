import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, UserRound } from 'lucide-angular';
import { CampoBusqueda } from '@/app/compartido/campo-busqueda';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import { PageHeader } from '@/app/compartido/page-header';
import { normalizarError } from '@/app/core/api';
import { filtrosURL } from '@/app/core/filtros-url';
import { NotificarService } from '@/app/core/notificar.service';
import { valorDe } from '@/app/core/recurso';
import { mensajeError, requerido, textoONull } from '@/app/core/validadores';
import { nombrePadre } from './formato-misas';
import { MisasService } from './misas.service';

/**
 * /padres — padres de todo el país para la Coordinación (supuesto P-19): los busca con las iglesias
 * donde celebran, registra uno nuevo y abre su agenda semanal (RF-47).
 */
@Component({
  selector: 'app-padres-nacional',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButton,
    MatFormField,
    MatLabel,
    MatError,
    MatInput,
    LucideAngularModule,
    CampoBusqueda,
    PageHeader,
    EstadoError,
    EstadoVacio,
    Esqueleto,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      titulo="Padres"
      descripcion="Padres de todas las iglesias. Cada iglesia los asocia; aquí se registran y se consulta su agenda."
    />
    <section class="tarjeta">
      <form class="nuevo" [formGroup]="form" (ngSubmit)="registrar()" novalidate>
        <mat-form-field class="titulo" subscriptSizing="dynamic">
          <mat-label>Título</mat-label>
          <input matInput formControlName="titulo" maxlength="30" placeholder="Pbro." />
        </mat-form-field>
        <mat-form-field class="nombre" subscriptSizing="dynamic">
          <mat-label>Nombre del padre</mat-label>
          <input matInput formControlName="nombre" maxlength="120" />
          <mat-error>{{ error() }}</mat-error>
        </mat-form-field>
        <button matButton="filled" type="submit" [disabled]="enviando()">Registrar padre</button>
      </form>
      @if (errorGeneral()) {
        <p class="alerta alerta-peligro" role="alert">{{ errorGeneral() }}</p>
      }

      <app-campo-busqueda
        etiqueta="Buscar padre"
        placeholder="Nombre"
        [valor]="filtros.valores().q"
        (cambio)="filtros.cambiar({ q: $event })"
      />
      @if (consulta.isLoading() && !consulta.hasValue()) {
        <app-esqueleto [filas]="5" [columnas]="3" />
      } @else if (consulta.error()) {
        <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
      } @else if (padres().length === 0) {
        <app-estado-vacio
          [icono]="iconoVacio"
          titulo="No hay padres con ese nombre"
          descripcion="Registra al padre; después cada iglesia lo asocia."
        />
      } @else {
        <div class="contenedor-tabla">
          <table class="tabla-simple" aria-label="Padres del país">
            <thead>
              <tr>
                <th scope="col">Padre</th>
                <th scope="col">Iglesias donde celebra</th>
                <th scope="col"><span class="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              @for (p of padres(); track p.id) {
                <tr>
                  <td class="fuerte">
                    {{ nombre(p) }}
                    @if (!p.activo) {
                      <span class="texto-suave"> (de baja)</span>
                    }
                  </td>
                  <td>{{ iglesias(p.iglesias) }}</td>
                  <td class="acciones">
                    <a matButton [routerLink]="['/padres', p.id, 'agenda']">Ver agenda</a>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: `
    .nuevo {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 16px;
    }
    .titulo {
      width: 7rem;
    }
    .nombre {
      flex: 1 1 16rem;
    }
    .acciones {
      text-align: right;
    }
  `,
})
export class PadresNacionalPage {
  private readonly servicio = inject(MisasService);
  private readonly notificar = inject(NotificarService);

  protected readonly nombre = nombrePadre;
  protected readonly iconoVacio = UserRound;
  protected readonly filtros = filtrosURL({ q: '' });
  protected readonly enviando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);

  protected readonly consulta = rxResource({
    params: () => ({ q: this.filtros.valores().q, v: this.servicio.version() }),
    stream: ({ params }) => this.servicio.buscarPadres(params.q),
  });
  protected readonly padres = computed(() => valorDe(this.consulta)?.data ?? []);

  protected readonly form = inject(NonNullableFormBuilder).group({
    titulo: [''],
    nombre: ['', [requerido('Escribe el nombre.'), Validators.maxLength(120)]],
  });

  protected error() {
    return mensajeError(this.form.controls.nombre);
  }

  protected iglesias(lista: { nombre: string }[]) {
    return lista.length > 0 ? lista.map((i) => i.nombre).join(', ') : 'Ninguna todavía';
  }

  protected registrar() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.errorGeneral.set(null);
    this.enviando.set(true);
    this.servicio
      .crearPadreNacional({ nombre: v.nombre.trim(), titulo: textoONull(v.titulo) })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.form.reset();
          this.notificar.exito('Padre registrado');
        },
        error: (e: unknown) => {
          this.enviando.set(false);
          this.errorGeneral.set(normalizarError(e).message);
        },
      });
  }
}
