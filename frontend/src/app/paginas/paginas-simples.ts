import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, SearchX, ShieldX } from 'lucide-angular';

const ESTILOS = `
  .centro {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 64px 0;
    text-align: center;
  }
  h1 {
    margin: 0;
    font-size: 20px;
    font-family: Georgia, 'Times New Roman', serif;
      font-weight: 400;
      color: var(--primario);
  }
  p {
    margin: 0;
    max-width: 24rem;
  }
`;

@Component({
  selector: 'app-no-encontrado',
  imports: [MatButton, RouterLink, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="centro">
      <lucide-icon [img]="icono" [size]="40" class="texto-suave" aria-hidden="true" />
      <h1>Página no encontrada</h1>
      <p class="texto-suave">La dirección que buscas no existe.</p>
      <a matButton="outlined" routerLink="/">Ir al inicio</a>
    </div>
  `,
  styles: ESTILOS,
})
export class NoEncontradoPage {
  protected readonly icono = SearchX;
}

@Component({
  selector: 'app-sin-acceso',
  imports: [MatButton, RouterLink, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="centro">
      <lucide-icon [img]="icono" [size]="40" class="texto-peligro" aria-hidden="true" />
      <h1>No tienes acceso</h1>
      <p class="texto-suave">
        Tu rol no tiene permiso para ver esta sección. Si crees que es un error, contacta al
        administrador.
      </p>
      <a matButton="outlined" routerLink="/">Ir al inicio</a>
    </div>
  `,
  styles: ESTILOS,
})
export class SinAccesoPage {
  protected readonly icono = ShieldX;
}
