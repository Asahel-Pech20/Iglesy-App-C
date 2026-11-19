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
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { errorDeCampo, normalizarError } from '@/app/core/api';
import { ETIQUETAS_ROL, opcionesDe } from '@/app/core/formato';
import { NotificarService } from '@/app/core/notificar.service';
import {
  errorServidor,
  maximo,
  mensajeError,
  requerido,
  validarEmail,
} from '@/app/core/validadores';
import { SesionService } from '@/app/core/sesion.service';
import { IglesiasService } from '@/app/features/iglesias/iglesias.service';
import type { Rol } from '@/app/tipos/comunes';
import type { Usuario } from '@/app/tipos/usuarios';
import { UsuariosService } from './usuarios.service';

/** Crea (sin `data`) o edita un usuario. Se cierra con `true` si guardó. */
@Component({
  selector: 'app-usuario-form-dialogo',
  imports: [
    ReactiveFormsModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatFormField,
    MatLabel,
    MatError,
    MatInput,
    MatSelect,
    MatOption,
    MatButton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ usuario ? 'Editar usuario' : 'Nuevo usuario' }}</h2>
    <mat-dialog-content>
      <p class="texto-suave">
        {{
          usuario
            ? 'Los cambios de rol se aplican en su próximo inicio de sesión.'
            : 'Recibirá un correo para configurar su contraseña.'
        }}
      </p>
      <form id="form-usuario" [formGroup]="form" (ngSubmit)="enviar()" novalidate class="columna">
        @if (errorGeneral()) {
          <p class="alerta alerta-peligro" role="alert">{{ errorGeneral() }}</p>
        }
        <mat-form-field>
          <mat-label>Nombre</mat-label>
          <input matInput autocomplete="off" formControlName="nombre" required />
          <mat-error>{{ error('nombre') }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Correo</mat-label>
          <input matInput type="email" autocomplete="off" formControlName="email" required />
          <mat-error>{{ error('email') }}</mat-error>
        </mat-form-field>
        <mat-form-field>
          <mat-label>Rol</mat-label>
          <mat-select formControlName="rol" required>
            @for (o of roles; track o.valor) {
              <mat-option [value]="o.valor">{{ o.etiqueta }}</mat-option>
            }
          </mat-select>
          <mat-error>{{ error('rol') }}</mat-error>
        </mat-form-field>
        @if (pideIglesia()) {
          <mat-form-field>
            <mat-label>Iglesia</mat-label>
            <mat-select formControlName="iglesiaId" aria-required="true">
              @for (i of iglesias(); track i.id) {
                <mat-option [value]="i.id">{{ i.nombre }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          @if (errorIglesia()) {
            <p class="texto-peligro" role="alert">{{ errorIglesia() }}</p>
          }
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="outlined" type="button" (click)="ref.close(false)">Cancelar</button>
      <button matButton="filled" type="submit" form="form-usuario" [disabled]="enviando()">
        {{ enviando() ? 'Guardando…' : 'Guardar' }}
      </button>
    </mat-dialog-actions>
  `,
})
export class UsuarioFormDialogo {
  protected readonly usuario = inject<Usuario | null>(MAT_DIALOG_DATA, { optional: true });
  protected readonly ref = inject(MatDialogRef<UsuarioFormDialogo, boolean>);
  private readonly servicio = inject(UsuariosService);
  private readonly notificar = inject(NotificarService);
  private readonly sesion = inject(SesionService);
  private readonly iglesiasServicio = inject(IglesiasService);

  /** Solo la Coordinación elige la iglesia, y solo al crear; el resto crea en la suya */
  private readonly eligeIglesia = !this.usuario && this.sesion.puede('iglesias:leer');
  protected readonly listaIglesias = rxResource({
    params: () => (this.eligeIglesia ? {} : undefined),
    stream: () => this.iglesiasServicio.listar({ page: 1, limit: 100 }),
  });
  protected readonly iglesias = computed(() =>
    this.listaIglesias.hasValue() ? this.listaIglesias.value().data : [],
  );

  protected readonly errorIglesia = signal('');

  protected readonly roles = opcionesDe(ETIQUETAS_ROL);
  protected readonly enviando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({
    nombre: [this.usuario?.nombre ?? '', [requerido('Escribe el nombre.'), maximo(120)]],
    email: [this.usuario?.email ?? '', [requerido('Escribe el correo.'), validarEmail]],
    rol: [(this.usuario?.rol ?? '') as Rol | '', requerido('Selecciona un rol.')],
    iglesiaId: [''],
  });
  private readonly rolElegido = toSignal(this.form.controls.rol.valueChanges, {
    initialValue: this.form.controls.rol.value,
  });
  /** La Coordinación nacional no pertenece a una iglesia: no se le pide */
  protected readonly pideIglesia = computed(
    () => this.eligeIglesia && this.rolElegido() !== '' && this.rolElegido() !== 'COORDINACION',
  );

  protected error(campo: 'nombre' | 'email' | 'rol') {
    return mensajeError(this.form.controls[campo]);
  }

  protected enviar() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const { nombre, email, rol, iglesiaId } = this.form.getRawValue();
    if (this.pideIglesia() && !iglesiaId) {
      this.errorIglesia.set('Elige la iglesia del usuario.');
      return;
    }
    this.errorIglesia.set('');
    this.errorGeneral.set(null);
    this.enviando.set(true);
    this.servicio
      .guardar(
        {
          nombre: nombre.trim(),
          email: email.trim().toLowerCase(),
          rol: rol as Rol,
          ...(this.pideIglesia() && { iglesiaId }),
        },
        this.usuario?.id,
      )
      .subscribe({
        next: () => {
          this.notificar.exito(
            this.usuario
              ? 'Usuario actualizado'
              : 'Usuario creado. Le enviamos un correo de invitación.',
          );
          this.ref.close(true);
        },
        error: (e: unknown) => {
          this.enviando.set(false);
          // 409 (correo duplicado) va al campo; 422 (último admin) y otros, al diálogo
          const errorEmail = errorDeCampo(e, 'email');
          if (errorEmail) errorServidor(this.form.controls.email, errorEmail);
          else this.errorGeneral.set(normalizarError(e).message);
        },
      });
  }
}
