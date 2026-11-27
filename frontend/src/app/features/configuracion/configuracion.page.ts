import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatTab, MatTabGroup } from '@angular/material/tabs';
import { Church, LucideAngularModule } from 'lucide-angular';
import { of } from 'rxjs';
import { CampoBusqueda } from '@/app/compartido/campo-busqueda';
import { filtrosURL } from '@/app/core/filtros-url';
import { valorDe } from '@/app/core/recurso';
import { IglesiasService } from '@/app/features/iglesias/iglesias.service';
import { SesionService } from '@/app/core/sesion.service';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import { PageHeader } from '@/app/compartido/page-header';
import { CargaLogo } from './carga-logo';
import { ConfiguracionService } from './configuracion.service';
import { FormGeneral } from './form-general';
import { Horarios } from './horarios';

@Component({
  selector: 'app-configuracion',
  imports: [
    MatTabGroup,
    MatTab,
    PageHeader,
    EstadoError,
    EstadoVacio,
    Esqueleto,
    CampoBusqueda,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    LucideAngularModule,
    FormGeneral,
    CargaLogo,
    Horarios,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      titulo="Configuración de la iglesia"
      [descripcion]="editable() ? undefined : 'Solo el administrador puede modificar estos datos.'"
    />
    <!-- La Coordinación no tiene iglesia propia: elige de cuál ver la configuración -->
    @if (esNacional()) {
      <section class="tarjeta tarjeta-cuerpo selector" aria-label="Iglesia a consultar">
        <app-campo-busqueda
          etiqueta="Buscar iglesia"
          placeholder="Parte del nombre…"
          [valor]="busqueda()"
          (cambio)="busqueda.set($event)"
        />
        <mat-form-field>
          <mat-label>Iglesia</mat-label>
          <mat-select
            [value]="iglesiaElegida()"
            (selectionChange)="filtros.cambiar({ iglesiaId: $event.value })"
          >
            @for (i of opciones(); track i.id) {
              <mat-option [value]="i.id">{{ i.nombre }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </section>
    }
    @if (esNacional() && !iglesiaElegida()) {
      <app-estado-vacio
        [icono]="iconos.Church"
        titulo="Elige una iglesia"
        descripcion="La Coordinación consulta la configuración de cualquier iglesia; la edita su administrador."
      />
    } @else if (consulta.isLoading() && !consulta.hasValue()) {
      <app-esqueleto [filas]="4" [columnas]="2" />
    } @else if (consulta.error()) {
      <app-estado-error [error]="consulta.error()" (reintentar)="consulta.reload()" />
    } @else if (consulta.value(); as config) {
      <mat-tab-group animationDuration="0ms" mat-stretch-tabs="false">
        <mat-tab label="General">
          <section class="tarjeta tarjeta-cuerpo pestana">
            <app-form-general [config]="config" [editable]="editable()" />
          </section>
        </mat-tab>
        <mat-tab label="Logotipo">
          <section class="tarjeta tarjeta-cuerpo pestana">
            <app-carga-logo [config]="servicio.actual() ?? config" [editable]="editable()" />
          </section>
        </mat-tab>
        <mat-tab label="Horarios">
          <div class="pestana">
            <app-horarios [editable]="editable()" [iglesiaId]="iglesiaElegida()" />
          </div>
        </mat-tab>
      </mat-tab-group>
    }
  `,
  styles: `
    .pestana {
      margin-top: 16px;
    }
    .selector {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
      gap: 0 16px;
      margin-bottom: 16px;
    }
  `,
})
export class ConfiguracionPage {
  protected readonly servicio = inject(ConfiguracionService);
  private readonly sesion = inject(SesionService);
  protected readonly editable = computed(() => this.sesion.puede('configuracion:editar'));
  private readonly iglesias = inject(IglesiasService);
  protected readonly iconos = { Church };

  /** Coordinación: sesión sin iglesia propia (E1-06b). */
  protected readonly esNacional = computed(
    () => this.sesion.estado() === 'autenticado' && !this.sesion.iglesia(),
  );
  /** ?iglesiaId= en la dirección, para poder compartir o recargar la consulta. */
  protected readonly filtros = filtrosURL({ iglesiaId: '' });
  protected readonly iglesiaElegida = computed(() =>
    this.esNacional() ? this.filtros.valores().iglesiaId || null : null,
  );
  protected readonly busqueda = signal('');
  private readonly listaIglesias = rxResource({
    params: () => (this.esNacional() ? this.busqueda() : null),
    stream: ({ params }) =>
      params === null
        ? of(null)
        : this.iglesias.listar({ q: params || undefined, situacion: 'activas', limit: 50 }),
  });
  protected readonly opciones = computed(() => valorDe(this.listaIglesias)?.data ?? []);

  protected readonly consulta = rxResource({
    params: () => ({ nacional: this.esNacional(), id: this.iglesiaElegida() }),
    stream: ({ params }) =>
      params.nacional && !params.id ? of(null) : this.servicio.obtener(params.id ?? undefined),
  });
}
