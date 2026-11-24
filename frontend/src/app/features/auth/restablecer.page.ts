import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CheckCircle2, LucideAngularModule, XCircle } from 'lucide-angular';
import { errorDeCampo, normalizarError } from '@/app/core/api';
import { coinciden, errorServidor, mensajeError, validarPassword } from '@/app/core/validadores';
import { AuthService } from './auth.service';

/** /restablecer?token=… — también se usa para la invitación de usuarios nuevos (B1-14). */
@Component({
  selector: 'app-restablecer',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormField,
    MatLabel,
    MatError,
    MatHint,
    MatInput,
    MatButton,
    LucideAngularModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (estado()) {
      @case ('invalido') {
        <div class="aviso" role="alert">
          <lucide-icon [img]="iconoError" [size]="40" class="texto-peligro" aria-hidden="true" />
          <p>El enlace no es válido o ya expiró.</p>
          <a routerLink="/recuperar">Solicitar un enlace nuevo</a>
        </div>
      }
      @case ('listo') {
        <div class="aviso" role="status">
          <lucide-icon [img]="iconoListo" [size]="40" class="texto-exito" aria-hidden="true" />
          <p>Tu contraseña se guardó correctamente.</p>
          <a matButton="filled" routerLink="/login">Iniciar sesión</a>
        </div>
      }
      @default {
        <form [formGroup]="form" (ngSubmit)="enviar()" novalidate class="columna">
          <h1>Nueva contraseña</h1>
          @if (errorGeneral()) {
            <p class="alerta alerta-peligro" role="alert">{{ errorGeneral() }}</p>
          }
          <mat-form-field>
            <mat-label>Contraseña nueva</mat-label>
            <input
              matInput
              type="password"
              autocomplete="new-password"
              formControlName="password"
            />
            <mat-hint>Mínimo 8 caracteres, con al menos una letra y un número.</mat-hint>
            <mat-error>{{ error('password') }}</mat-error>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Confirmar contraseña</mat-label>
            <input
              matInput
              type="password"
              autocomplete="new-password"
              formControlName="confirmacion"
            />
            <mat-error>{{ error('confirmacion') }}</mat-error>
          </mat-form-field>
          <button matButton="filled" type="submit" [disabled]="enviando()">
            {{ enviando() ? 'Guardando…' : 'Guardar contraseña' }}
          </button>
        </form>
      }
    }
  `,
  styles: `
    .aviso {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      text-align: center;
    }
    h1 {
      margin: 0;
      text-align: center;
      font-size: 20px;
      font-weight: 400;
      color: var(--primario);
    }
    p {
      margin: 0;
    }
  `,
})
export class RestablecerPage {
  private readonly auth = inject(AuthService);
  private readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token');

  protected readonly form = inject(NonNullableFormBuilder).group(
    { password: ['', validarPassword], confirmacion: [''] },
    { validators: coinciden('password', 'confirmacion') },
  );
  protected readonly estado = signal<'formulario' | 'listo' | 'invalido'>(
    this.token ? 'formulario' : 'invalido',
  );
  protected readonly enviando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly iconoError = XCircle;
  protected readonly iconoListo = CheckCircle2;

  protected error(campo: 'password' | 'confirmacion') {
    return mensajeError(this.form.controls[campo]);
  }

  protected enviar() {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.token) return;
    this.errorGeneral.set(null);
    this.enviando.set(true);
    this.auth.restablecerPassword(this.token, this.form.getRawValue().password).subscribe({
      next: () => this.estado.set('listo'),
      error: (e: unknown) => {
        this.enviando.set(false);
        if (errorDeCampo(e, 'token')) return this.estado.set('invalido');
        const errorPassword = errorDeCampo(e, 'password');
        if (errorPassword) return errorServidor(this.form.controls.password, errorPassword);
        this.errorGeneral.set(normalizarError(e).message);
      },
    });
  }
}
