import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Info, LucideAngularModule } from 'lucide-angular';
import { FOTOS_POR_IGLESIA } from './fotos-iglesias';

/**
 * SOLO PARA LA DEMO: las iglesias con nombre real de los datos simulados (las que tienen foto en
 * fotos-iglesias.ts). Sus objetos son ilustrativos y el caso pide marcarlos como ficticios.
 */
export const esIglesiaRealDeDemo = (id: string): boolean => Object.hasOwn(FOTOS_POR_IGLESIA, id);

/** Aviso visible de que los objetos de una iglesia real de la demo no son su inventario. */
@Component({
  selector: 'app-aviso-demo',
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 0 0 12px;
      padding: 8px 12px;
      font-size: 13px;
      color: var(--texto);
      background: var(--superficie);
      border: 1px solid var(--marco);
      border-left: 4px solid var(--acento);
      border-radius: 8px;
    }
    lucide-icon {
      flex-shrink: 0;
      margin-top: 1px;
      color: var(--acento);
    }
  `,
  host: { role: 'note' },
  template: `
    <lucide-icon [img]="Info" [size]="16" aria-hidden="true" />
    <span>Datos de demostración: objetos ilustrativos, no es un inventario oficial.</span>
  `,
})
export class AvisoDemo {
  protected readonly Info = Info;
}
