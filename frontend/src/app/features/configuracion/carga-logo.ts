import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatProgressBar } from '@angular/material/progress-bar';
import { Church, ImageUp, LucideAngularModule } from 'lucide-angular';
import { NotificarService } from '@/app/core/notificar.service';
import type { ConfiguracionIglesia } from '@/app/tipos/configuracion';
import { TIPOS_LOGO } from './catalogos';
import { ConfiguracionService, validarLogo } from './configuracion.service';

/** Pestaña Logotipo: arrastrar/soltar con vista previa, validación previa y barra de progreso. */
@Component({
  selector: 'app-carga-logo',
  imports: [MatButton, MatProgressBar, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="columna ancho">
      <div class="fila">
        <div class="marco">
          @if (imagen(); as src) {
            <img [src]="src" alt="Logotipo de la iglesia" />
          } @else {
            <lucide-icon [img]="iconos.Church" [size]="40" class="texto-suave" aria-hidden="true" />
          }
        </div>
        <p class="texto-suave">
          {{ vistaPrevia() ? 'Vista previa del logotipo nuevo.' : 'Logotipo actual.' }}
        </p>
      </div>

      @if (editable()) {
        <div
          class="zona"
          [class.arrastrando]="arrastrando()"
          (dragover)="$event.preventDefault(); arrastrando.set(true)"
          (dragleave)="arrastrando.set(false)"
          (drop)="soltar($event)"
        >
          <lucide-icon [img]="iconos.ImageUp" [size]="32" class="texto-suave" aria-hidden="true" />
          <p>Arrastra una imagen aquí o</p>
          <button matButton="outlined" type="button" (click)="entrada.click()">
            Elegir archivo
          </button>
          <p class="texto-suave pequeno">PNG, JPG, WEBP o SVG. Máximo 2 MB.</p>
          <input
            #entrada
            type="file"
            class="sr-only"
            [accept]="tipos"
            aria-label="Archivo del logotipo"
            (change)="alElegir(entrada)"
          />
        </div>

        @if (error()) {
          <p class="alerta alerta-peligro" role="alert">{{ error() }}</p>
        }
        @if (subiendo()) {
          <mat-progress-bar
            mode="determinate"
            [value]="progreso()"
            aria-label="Progreso de subida"
          />
        }
        @if (archivo()) {
          <button
            matButton="filled"
            type="button"
            class="boton"
            [disabled]="subiendo()"
            (click)="enviar()"
          >
            {{ subiendo() ? 'Subiendo…' : 'Subir logotipo' }}
          </button>
        }
      }
    </div>
  `,
  styles: `
    .ancho {
      max-width: 36rem;
    }
    .marco {
      display: flex;
      width: 96px;
      height: 96px;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border: 1px solid var(--marco);
      border-radius: 8px;
      background: var(--superficie-suave);
    }
    .marco img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .fila p,
    .zona p {
      margin: 0;
    }
    .zona {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      border: 2px dashed var(--borde);
      border-radius: 8px;
      padding: 24px;
      text-align: center;
    }
    .arrastrando {
      border-color: var(--primario);
      background: var(--superficie-suave);
    }
    .pequeno {
      font-size: 12px;
    }
    .boton {
      align-self: flex-start;
    }
  `,
})
export class CargaLogo {
  readonly config = input.required<ConfiguracionIglesia>();
  readonly editable = input(false);
  private readonly servicio = inject(ConfiguracionService);
  private readonly notificar = inject(NotificarService);

  protected readonly archivo = signal<File | null>(null);
  protected readonly vistaPrevia = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly progreso = signal(0);
  protected readonly subiendo = signal(false);
  protected readonly arrastrando = signal(false);
  protected readonly imagen = computed(() => this.vistaPrevia() ?? this.config().logoUrl);
  protected readonly tipos = TIPOS_LOGO.join(',');
  protected readonly iconos = { Church, ImageUp };

  constructor() {
    inject(DestroyRef).onDestroy(() => this.limpiarVista());
  }

  protected alElegir(entrada: HTMLInputElement) {
    this.elegir(entrada.files?.[0]);
    entrada.value = '';
  }

  protected soltar(evento: DragEvent) {
    evento.preventDefault();
    this.arrastrando.set(false);
    if (this.editable()) this.elegir(evento.dataTransfer?.files[0]);
  }

  protected enviar() {
    const archivo = this.archivo();
    if (!archivo) return;
    this.progreso.set(0);
    this.subiendo.set(true);
    this.servicio.subirLogo(archivo).subscribe({
      next: (avance) => {
        if ('porcentaje' in avance) this.progreso.set(avance.porcentaje);
      },
      complete: () => {
        this.subiendo.set(false);
        this.notificar.exito('Logotipo actualizado');
        this.archivo.set(null);
        this.limpiarVista();
      },
      error: (e: unknown) => {
        this.subiendo.set(false);
        this.notificar.error(e);
      },
    });
  }

  private elegir(nuevo: File | undefined) {
    if (!nuevo) return;
    const mensaje = validarLogo(nuevo);
    this.error.set(mensaje);
    this.limpiarVista();
    if (mensaje) {
      this.archivo.set(null);
      return;
    }
    this.archivo.set(nuevo);
    this.vistaPrevia.set(URL.createObjectURL(nuevo));
  }

  private limpiarVista() {
    const actual = this.vistaPrevia();
    if (actual) URL.revokeObjectURL(actual);
    this.vistaPrevia.set(null);
  }
}
