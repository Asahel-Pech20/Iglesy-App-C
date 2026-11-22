import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { valorDe } from '@/app/core/recurso';
import {
  MatAutocomplete,
  type MatAutocompleteSelectedEvent,
  MatAutocompleteTrigger,
  MatOption,
} from '@angular/material/autocomplete';
import { MatChip, MatChipRemove, MatChipSet } from '@angular/material/chips';
import { MatFormField, MatLabel, MatPrefix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { Check, LucideAngularModule, Search, X } from 'lucide-angular';
import { BadgeEstado } from '@/app/compartido/badge-estado';
import { MiembrosService } from './miembros.service';

interface MiembroOpcion {
  id: string;
  nombre: string;
  apellidos: string;
  activo: boolean;
}

const nombreCompleto = (m: Pick<MiembroOpcion, 'nombre' | 'apellidos'>) =>
  `${m.nombre} ${m.apellidos}`;

/**
 * Buscador de miembros con autocompletado (debounce 300 ms, sin acentos). Lo usan F2, F3 y F4.
 * `seleccion` es un arreglo de ids (con `multiple = false` tiene como máximo uno).
 *
 * @example Selección simple (responsable, donante):
 * <app-selector-miembros [(seleccion)]="ids" etiqueta="Donante" />
 *
 * @example Varios con chips, excluyendo a los ya vinculados:
 * <app-selector-miembros [multiple]="true" [(seleccion)]="ids" [excluirIds]="actuales" />
 */
@Component({
  selector: 'app-selector-miembros',
  imports: [
    MatFormField,
    MatLabel,
    MatPrefix,
    MatInput,
    MatAutocomplete,
    MatAutocompleteTrigger,
    MatOption,
    MatChipSet,
    MatChip,
    MatChipRemove,
    LucideAngularModule,
    BadgeEstado,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-form-field class="campo-completo" subscriptSizing="dynamic">
      <mat-label>{{ etiqueta() }}</mat-label>
      <lucide-icon matPrefix [img]="iconos.Search" [size]="16" class="lupa" aria-hidden="true" />
      <input
        #entrada
        matInput
        [placeholder]="textoPlaceholder()"
        [matAutocomplete]="auto"
        [disabled]="deshabilitado()"
        (input)="escribir(entrada.value)"
        (focus)="abierto.set(true)"
        aria-label="Buscar miembro"
      />
      <mat-autocomplete
        #auto="matAutocomplete"
        (optionSelected)="elegir($event); entrada.value = ''"
        (opened)="abierto.set(true)"
        (closed)="abierto.set(false)"
      >
        @if (consulta.isLoading()) {
          <mat-option disabled>Buscando…</mat-option>
        } @else if (consulta.error()) {
          <mat-option disabled>No se pudieron cargar los miembros.</mat-option>
        } @else if (opciones().length === 0) {
          <mat-option disabled>Sin resultados.</mat-option>
        } @else {
          @for (m of opciones(); track m.id) {
            <mat-option [value]="m">
              <span class="opcion">
                <lucide-icon
                  [img]="iconos.Check"
                  [size]="16"
                  [class.invisible]="!seleccion().includes(m.id)"
                  aria-hidden="true"
                />
                {{ nombre(m) }}
                @if (!m.activo) {
                  <app-badge-estado [activo]="false" />
                }
              </span>
            </mat-option>
          }
        }
      </mat-autocomplete>
    </mat-form-field>

    @if (seleccion().length > 0) {
      <mat-chip-set aria-label="Miembros seleccionados" class="chips">
        @for (id of seleccion(); track id) {
          <mat-chip (removed)="quitar(id)" [disabled]="deshabilitado()">
            {{ nombreDe(id) }}
            <button matChipRemove type="button" aria-label="Quitar">
              <lucide-icon [img]="iconos.X" [size]="14" aria-hidden="true" />
            </button>
          </mat-chip>
        }
      </mat-chip-set>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .lupa {
      margin: 0 4px 0 12px;
      color: var(--texto-suave);
    }
    .opcion {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .invisible {
      visibility: hidden;
    }
  `,
})
export class SelectorMiembros {
  readonly seleccion = model<string[]>([]);
  readonly multiple = input(false);
  readonly etiqueta = input('Miembro');
  readonly placeholder = input<string>();
  /** Solo integrantes activos de este ministerio */
  readonly ministerioId = input<string>();
  /** Incluye miembros inactivos en la búsqueda (por defecto solo activos) */
  readonly incluirInactivos = input(false);
  /** Ids que no se ofrecen (p. ej. los integrantes actuales) */
  readonly excluirIds = input<string[]>([]);
  readonly deshabilitado = input(false);

  private readonly servicio = inject(MiembrosService);
  protected readonly abierto = signal(false);
  private readonly busqueda = signal('');
  // Nombres de los miembros vistos, para mostrar los seleccionados sin otra petición
  private readonly conocidos = signal(new Map<string, MiembroOpcion>());
  private readonly pidiendo = new Set<string>();
  private temporizador: ReturnType<typeof setTimeout> | undefined;

  protected readonly consulta = rxResource({
    params: () =>
      this.abierto()
        ? {
            q: this.busqueda() || undefined,
            estado: this.incluirInactivos() ? ('todos' as const) : ('activo' as const),
            ministerioId: this.ministerioId(),
            limit: 20,
          }
        : undefined,
    stream: ({ params }) => this.servicio.listar(params),
  });
  protected readonly opciones = computed(() =>
    (valorDe(this.consulta)?.data ?? []).filter((m) => !this.excluirIds().includes(m.id)),
  );
  protected readonly textoPlaceholder = computed(() => {
    if (this.placeholder()) return this.placeholder()!;
    return this.multiple() ? 'Agregar miembros…' : 'Selecciona un miembro…';
  });
  protected readonly nombre = nombreCompleto;
  protected readonly iconos = { Search, Check, X };

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.temporizador));
  }

  /** Nombre de un id seleccionado; si no se conoce (vino del formulario) lo pide una vez. */
  protected nombreDe(id: string) {
    const conocido = this.conocidos().get(id);
    if (conocido) return nombreCompleto(conocido);
    if (!this.pidiendo.has(id)) {
      this.pidiendo.add(id);
      this.servicio.obtener(id).subscribe((m) => this.recordar(m));
    }
    return 'Cargando…';
  }

  protected escribir(texto: string) {
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.busqueda.set(texto.trim()), 300);
  }

  protected elegir(evento: MatAutocompleteSelectedEvent) {
    const miembro = evento.option.value as MiembroOpcion;
    this.recordar(miembro);
    const actual = this.seleccion();
    if (!this.multiple()) this.seleccion.set([miembro.id]);
    else
      this.seleccion.set(
        actual.includes(miembro.id)
          ? actual.filter((v) => v !== miembro.id)
          : [...actual, miembro.id],
      );
  }

  protected quitar(id: string) {
    this.seleccion.set(this.seleccion().filter((v) => v !== id));
  }

  private recordar(miembro: MiembroOpcion) {
    if (this.conocidos().has(miembro.id)) return;
    this.conocidos.update((previo) => new Map(previo).set(miembro.id, miembro));
  }
}
