import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { of } from 'rxjs';
import { errorDeCampo, normalizarError } from '@/app/core/api';
import { ETIQUETAS_TIPO_IGLESIA, opcionesDe } from '@/app/core/formato';
import { NotificarService } from '@/app/core/notificar.service';
import { valorDe } from '@/app/core/recurso';
import {
  errorServidor,
  maximo,
  mensajeError,
  requerido,
  textoONull,
  validarEmail,
} from '@/app/core/validadores';
import type { CrearIglesia, Iglesia, TipoIglesia } from '@/app/tipos/iglesias';
import { IglesiasService } from './iglesias.service';
import { coordenada, entero, numeroONull, telefono } from './validadores-iglesia';

const CAMPOS = [
  'nombre',
  'tipo',
  'zonaHoraria',
  'direccion',
  'estado',
  'municipio',
  'localidad',
  'capacidad',
  'anioConstruccion',
  'telefono',
  'correo',
  'latitud',
  'longitud',
] as const;
type Campo = (typeof CAMPOS)[number];

/**
 * Crea una iglesia (Coordinación) o edita sus datos (Coordinación o su administrador). RF-07–RF-09:
 * el estado, el municipio y la localidad se eligen en cascada del catálogo del INEGI.
 * Recibe la iglesia a editar o nada para crear; se cierra con `true` si guardó.
 */
@Component({
  selector: 'app-iglesia-form-dialogo',
  imports: [
    ReactiveFormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatFormField,
    MatLabel,
    MatError,
    MatHint,
    MatInput,
    MatSelect,
    MatOption,
    MatButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .rejilla {
      display: grid;
      gap: 0 12px;
      grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    }
    .subtitulo {
      margin: 8px 0 4px;
      font-size: 14px;
      font-family: Georgia, 'Times New Roman', serif;
      font-weight: 400;
      color: var(--primario);
      color: var(--texto-suave);
    }
  `,
  template: `
    <h2 mat-dialog-title>{{ iglesia ? 'Editar iglesia' : 'Nueva iglesia' }}</h2>
    <mat-dialog-content>
      <form id="form-iglesia" [formGroup]="form" (ngSubmit)="enviar()" novalidate class="columna">
        @if (errorGeneral()) {
          <p class="alerta alerta-peligro" role="alert">{{ errorGeneral() }}</p>
        }
        <mat-form-field>
          <mat-label>Nombre</mat-label>
          <input matInput autocomplete="off" formControlName="nombre" required />
          <mat-error>{{ error('nombre') }}</mat-error>
        </mat-form-field>
        <div class="rejilla">
          <mat-form-field>
            <mat-label>Tipo</mat-label>
            <mat-select formControlName="tipo" required>
              @for (o of tipos; track o.valor) {
                <mat-option [value]="o.valor">{{ o.etiqueta }}</mat-option>
              }
            </mat-select>
            <mat-error>{{ error('tipo') }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Zona horaria</mat-label>
            <input matInput autocomplete="off" formControlName="zonaHoraria" required />
            <mat-hint>Hora local de las misas, p. ej. America/Mexico_City.</mat-hint>
            <mat-error>{{ error('zonaHoraria') }}</mat-error>
          </mat-form-field>
        </div>

        <p class="subtitulo">Ubicación (catálogo del INEGI)</p>
        <div class="rejilla">
          <mat-form-field>
            <mat-label>Estado</mat-label>
            <mat-select formControlName="estado" (selectionChange)="cambioEstado()">
              <mat-option value="">Sin estado</mat-option>
              @for (e of estados(); track e.clave) {
                <mat-option [value]="e.clave">{{ e.nombre }}</mat-option>
              }
            </mat-select>
            <mat-error>{{ error('estado') }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Municipio</mat-label>
            <mat-select formControlName="municipio" (selectionChange)="cambioMunicipio()">
              <mat-option value="">Sin municipio</mat-option>
              @for (m of municipios(); track m.clave) {
                <mat-option [value]="m.clave">{{ m.nombre }}</mat-option>
              }
            </mat-select>
            <mat-error>{{ error('municipio') }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Ciudad o localidad</mat-label>
            <mat-select formControlName="localidad">
              <mat-option value="">Sin localidad</mat-option>
              @for (l of localidades(); track l.clave) {
                <mat-option [value]="l.clave">{{ l.nombre }}</mat-option>
              }
            </mat-select>
            <mat-error>{{ error('localidad') }}</mat-error>
          </mat-form-field>
        </div>
        <mat-form-field>
          <mat-label>Dirección</mat-label>
          <input matInput autocomplete="street-address" formControlName="direccion" />
          <mat-error>{{ error('direccion') }}</mat-error>
        </mat-form-field>

        <p class="subtitulo">Datos de la ficha</p>
        <div class="rejilla">
          <mat-form-field>
            <mat-label>Capacidad (personas)</mat-label>
            <input matInput inputmode="numeric" formControlName="capacidad" />
            <mat-error>{{ error('capacidad') }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Año de construcción</mat-label>
            <input matInput inputmode="numeric" formControlName="anioConstruccion" />
            <mat-error>{{ error('anioConstruccion') }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Teléfono</mat-label>
            <input matInput type="tel" autocomplete="tel" formControlName="telefono" />
            <mat-error>{{ error('telefono') }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Correo</mat-label>
            <input matInput type="email" autocomplete="email" formControlName="correo" />
            <mat-error>{{ error('correo') }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Latitud</mat-label>
            <input matInput inputmode="decimal" formControlName="latitud" />
            <mat-error>{{ error('latitud') }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Longitud</mat-label>
            <input matInput inputmode="decimal" formControlName="longitud" />
            <mat-hint>Latitud y longitud van juntas.</mat-hint>
            <mat-error>{{ error('longitud') }}</mat-error>
          </mat-form-field>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="outlined" type="button" (click)="ref.close(false)">Cancelar</button>
      <button matButton="filled" type="submit" form="form-iglesia" [disabled]="enviando()">
        {{ enviando() ? 'Guardando…' : 'Guardar' }}
      </button>
    </mat-dialog-actions>
  `,
})
export class IglesiaFormDialogo {
  protected readonly ref = inject(MatDialogRef<IglesiaFormDialogo, boolean>);
  protected readonly iglesia = inject<Iglesia | null>(MAT_DIALOG_DATA, { optional: true });
  private readonly servicio = inject(IglesiasService);
  private readonly notificar = inject(NotificarService);

  protected readonly tipos = opcionesDe(ETIQUETAS_TIPO_IGLESIA);
  protected readonly enviando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    nombre: [this.iglesia?.nombre ?? '', [requerido('Escribe el nombre.'), maximo(150)]],
    tipo: [(this.iglesia?.tipo ?? '') as TipoIglesia | '', requerido('Elige el tipo de iglesia.')],
    zonaHoraria: [
      this.iglesia?.zonaHoraria ?? 'America/Mexico_City',
      requerido('Escribe la zona horaria.'),
    ],
    direccion: [this.iglesia?.direccion ?? '', maximo(250)],
    estado: [this.iglesia?.estado?.clave ?? ''],
    municipio: [this.iglesia?.municipio?.clave ?? ''],
    localidad: [this.iglesia?.localidad?.clave ?? ''],
    capacidad: [
      String(this.iglesia?.capacidad ?? ''),
      entero(1, 100_000, 'La capacidad es un número entero mayor que 0.'),
    ],
    anioConstruccion: [
      String(this.iglesia?.anioConstruccion ?? ''),
      entero(1500, 2100, 'Año no válido.'),
    ],
    telefono: [this.iglesia?.telefono ?? '', telefono],
    correo: [this.iglesia?.correo ?? '', validarEmail],
    latitud: [this.iglesia?.latitud ?? '', coordenada(90, 'Latitud')],
    longitud: [this.iglesia?.longitud ?? '', coordenada(180, 'Longitud')],
  });

  private readonly estadoElegido = toSignal(this.form.controls.estado.valueChanges, {
    initialValue: this.form.controls.estado.value,
  });
  private readonly municipioElegido = toSignal(this.form.controls.municipio.valueChanges, {
    initialValue: this.form.controls.municipio.value,
  });

  private readonly catalogoEstados = rxResource({ stream: () => this.servicio.estados() });
  private readonly catalogoMunicipios = rxResource({
    params: () => this.estadoElegido(),
    stream: ({ params }) => (params ? this.servicio.municipios(params) : of(null)),
  });
  private readonly catalogoLocalidades = rxResource({
    params: () => this.municipioElegido(),
    stream: ({ params }) => (params ? this.servicio.localidades(params) : of(null)),
  });
  protected readonly estados = computed(() => valorDe(this.catalogoEstados)?.data ?? []);
  protected readonly municipios = computed(() => valorDe(this.catalogoMunicipios)?.data ?? []);
  protected readonly localidades = computed(() => valorDe(this.catalogoLocalidades)?.data ?? []);

  protected error(campo: Campo) {
    return mensajeError(this.form.controls[campo]);
  }

  /** RF-09: al cambiar el estado se vuelve a elegir municipio y localidad. */
  protected cambioEstado() {
    this.form.controls.municipio.setValue('');
    this.form.controls.localidad.setValue('');
  }

  protected cambioMunicipio() {
    this.form.controls.localidad.setValue('');
  }

  private datos(): CrearIglesia {
    const v = this.form.getRawValue();
    return {
      nombre: v.nombre.trim(),
      tipo: v.tipo as TipoIglesia,
      zonaHoraria: v.zonaHoraria.trim(),
      direccion: textoONull(v.direccion),
      estado: textoONull(v.estado),
      municipio: textoONull(v.municipio),
      localidad: textoONull(v.localidad),
      capacidad: numeroONull(v.capacidad),
      anioConstruccion: numeroONull(v.anioConstruccion),
      telefono: textoONull(v.telefono),
      correo: textoONull(v.correo),
      latitud: numeroONull(v.latitud),
      longitud: numeroONull(v.longitud),
    };
  }

  protected enviar() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const datos = this.datos();
    if ((datos.latitud === null) !== (datos.longitud === null)) {
      const falta = datos.latitud === null ? 'latitud' : 'longitud';
      errorServidor(this.form.controls[falta], 'Escribe latitud y longitud juntas.');
      return;
    }
    this.errorGeneral.set(null);
    this.enviando.set(true);
    const peticion = this.iglesia
      ? this.servicio.editar(this.iglesia.id, datos)
      : this.servicio.crear(datos);
    peticion.subscribe({
      next: () => {
        this.notificar.exito(this.iglesia ? 'Iglesia guardada' : 'Iglesia creada');
        this.ref.close(true);
      },
      error: (e: unknown) => {
        this.enviando.set(false);
        const conCampo = CAMPOS.filter((campo) => {
          const mensaje = errorDeCampo(e, campo);
          if (mensaje) errorServidor(this.form.controls[campo], mensaje);
          return Boolean(mensaje);
        });
        if (conCampo.length === 0) this.errorGeneral.set(normalizarError(e).message);
      },
    });
  }
}
