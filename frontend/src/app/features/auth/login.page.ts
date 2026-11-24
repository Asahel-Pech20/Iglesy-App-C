import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatError, MatFormField, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Eye, EyeOff, LucideAngularModule } from 'lucide-angular';
import { normalizarError } from '@/app/core/api';
import { SesionService } from '@/app/core/sesion.service';
import { mensajeError, requerido, validarEmail } from '@/app/core/validadores';

/** Solo se permite redirigir a rutas internas (evita redirecciones abiertas) */
export function destinoSeguro(redirect: string | null) {
  return redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/';
}

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormField,
    MatLabel,
    MatError,
    MatSuffix,
    MatInput,
    MatButton,
    MatIconButton,
    LucideAngularModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="enviar()" novalidate class="columna">
      <h1 class="titulo">Inicia sesión</h1>
      @if (errorServidor()) {
        <p class="alerta alerta-peligro" role="alert">{{ errorServidor() }}</p>
      }
      <mat-form-field>
        <mat-label>Correo</mat-label>
        <input matInput type="email" autocomplete="email" formControlName="email" />
        <mat-error>{{ error('email') }}</mat-error>
      </mat-form-field>
      <mat-form-field>
        <mat-label>Contraseña</mat-label>
        <input
          matInput
          [type]="verPassword() ? 'text' : 'password'"
          autocomplete="current-password"
          formControlName="password"
        />
        <button
          matIconButton
          matSuffix
          type="button"
          (click)="verPassword.set(!verPassword())"
          [attr.aria-label]="verPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
          [attr.aria-pressed]="verPassword()"
        >
          <lucide-icon [img]="verPassword() ? ojoCerrado : ojo" [size]="16" aria-hidden="true" />
        </button>
        <mat-error>{{ error('password') }}</mat-error>
      </mat-form-field>
      <button matButton="filled" type="submit" [disabled]="enviando()">
        {{ enviando() ? 'Entrando…' : 'Entrar' }}
      </button>
      <a routerLink="/recuperar" class="enlace">¿Olvidaste tu contraseña?</a>
    </form>
  `,
  styles: `
    .titulo {
      margin: 0;
      text-align: center;
      font-size: 16px;
      font-weight: 500;
    }
    .enlace {
      text-align: center;
      font-size: 14px;
    }
  `,
})
export class LoginPage {
  private readonly sesion = inject(SesionService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [requerido('Escribe tu correo.'), validarEmail]],
    password: ['', requerido('Escribe tu contraseña.')],
  });
  protected readonly enviando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);
  protected readonly verPassword = signal(false);
  protected readonly ojo = Eye;
  protected readonly ojoCerrado = EyeOff;

  protected error(campo: 'email' | 'password') {
    return mensajeError(this.form.controls[campo]);
  }

  protected async enviar() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.errorServidor.set(null);
    this.enviando.set(true);
    try {
      const { email, password } = this.form.getRawValue();
      await this.sesion.iniciarSesion(email.trim(), password);
      const destino = destinoSeguro(this.ruta.snapshot.queryParamMap.get('redirect'));
      await this.router.navigateByUrl(destino, { replaceUrl: true });
    } catch (error) {
      const e = normalizarError(error);
      this.errorServidor.set(
        e.code === 'RATE_LIMITED' ? 'Demasiados intentos, espera un minuto.' : e.message,
      );
    } finally {
      this.enviando.set(false);
    }
  }
}
