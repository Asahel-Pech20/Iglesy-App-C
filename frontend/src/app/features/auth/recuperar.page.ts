import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, MailCheck } from 'lucide-angular';
import { normalizarError } from '@/app/core/api';
import { mensajeError, requerido, validarEmail } from '@/app/core/validadores';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-recuperar',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormField,
    MatLabel,
    MatError,
    MatInput,
    MatButton,
    LucideAngularModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (enviado()) {
      <!-- Mensaje neutro: no revela si el correo existe -->
      <div class="aviso" role="status">
        <lucide-icon [img]="icono" [size]="40" class="texto-exito" aria-hidden="true" />
        <p>Si el correo existe, te enviamos un enlace para restablecer tu contraseña.</p>
        <a routerLink="/login">Volver a iniciar sesión</a>
      </div>
    } @else {
      <form [formGroup]="form" (ngSubmit)="enviar()" novalidate class="columna">
        <div class="cabecera">
          <h1>Recuperar contraseña</h1>
          <p class="texto-suave">Escribe tu correo y te enviaremos un enlace.</p>
        </div>
        @if (errorServidor()) {
          <p class="alerta alerta-peligro" role="alert">{{ errorServidor() }}</p>
        }
        <mat-form-field>
          <mat-label>Correo</mat-label>
          <input matInput type="email" autocomplete="email" formControlName="email" />
          <mat-error>{{ error() }}</mat-error>
        </mat-form-field>
        <button matButton="filled" type="submit" [disabled]="enviando()">
          {{ enviando() ? 'Enviando…' : 'Enviar enlace' }}
        </button>
        <a routerLink="/login" class="centrado">Volver a iniciar sesión</a>
      </form>
    }
  `,
  styles: `
    .aviso,
    .cabecera {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      text-align: center;
    }
    .cabecera {
      gap: 0;
    }
    h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 400;
      color: var(--primario);
    }
    p {
      margin: 0;
    }
    .centrado {
      text-align: center;
    }
  `,
})
export class RecuperarPage {
  private readonly auth = inject(AuthService);
  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [requerido('Escribe tu correo.'), validarEmail]],
  });
  protected readonly enviado = signal(false);
  protected readonly enviando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);
  protected readonly icono = MailCheck;

  protected error() {
    return mensajeError(this.form.controls.email);
  }

  protected enviar() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.errorServidor.set(null);
    this.enviando.set(true);
    this.auth.solicitarRecuperacion(this.form.getRawValue().email.trim()).subscribe({
      next: () => this.enviado.set(true),
      error: (e: unknown) => {
        this.errorServidor.set(normalizarError(e).message);
        this.enviando.set(false);
      },
    });
  }
}
