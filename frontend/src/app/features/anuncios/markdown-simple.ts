import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Markdown simple seguro: **negrita**, *cursiva*, [enlace](https://…), listas con "- " y títulos "#".
 * Nunca usa innerHTML: el texto se convierte en datos y la plantilla de Angular lo pinta escapado,
 * así que cualquier HTML escrito en el contenido se muestra como texto (F3-11).
 * Solo se enlazan URLs http(s).
 */

export interface Segmento {
  tipo: 'texto' | 'negrita' | 'cursiva' | 'enlace';
  texto: string;
  url?: string;
}

export type Bloque =
  | { tipo: 'parrafo'; lineas: Segmento[][] }
  | { tipo: 'lista'; items: Segmento[][] }
  | { tipo: 'titulo'; segmentos: Segmento[] };

const PATRON_EN_LINEA = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)\s]+\))/g;

function enLinea(texto: string): Segmento[] {
  return texto
    .split(PATRON_EN_LINEA)
    .filter((parte) => parte !== '')
    .map((parte): Segmento => {
      if (/^\*\*[^*]+\*\*$/.test(parte)) return { tipo: 'negrita', texto: parte.slice(2, -2) };
      if (/^\*[^*]+\*$/.test(parte)) return { tipo: 'cursiva', texto: parte.slice(1, -1) };
      const enlace = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(parte);
      if (enlace) {
        const [, etiqueta = '', url = ''] = enlace;
        // Una URL que no es http(s) se muestra solo como texto
        return /^https?:\/\//i.test(url)
          ? { tipo: 'enlace', texto: etiqueta, url }
          : { tipo: 'texto', texto: etiqueta };
      }
      return { tipo: 'texto', texto: parte };
    });
}

export function parsearMarkdown(texto: string): Bloque[] {
  const bloques: Bloque[] = [];
  let lista: Segmento[][] = [];
  let parrafo: Segmento[][] = [];

  const cerrarParrafo = () => {
    if (parrafo.length > 0) bloques.push({ tipo: 'parrafo', lineas: parrafo });
    parrafo = [];
  };
  const cerrarLista = () => {
    if (lista.length > 0) bloques.push({ tipo: 'lista', items: lista });
    lista = [];
  };

  for (const linea of texto.split(/\r?\n/)) {
    const item = /^\s*[-*]\s+(.*)$/.exec(linea);
    const titulo = /^#{1,3}\s+(.*)$/.exec(linea);
    if (item) {
      cerrarParrafo();
      lista.push(enLinea(item[1] ?? ''));
    } else if (titulo) {
      cerrarParrafo();
      cerrarLista();
      bloques.push({ tipo: 'titulo', segmentos: enLinea(titulo[1] ?? '') });
    } else if (linea.trim() === '') {
      cerrarParrafo();
      cerrarLista();
    } else {
      cerrarLista();
      parrafo.push(enLinea(linea));
    }
  }
  cerrarParrafo();
  cerrarLista();
  return bloques;
}

@Component({
  selector: 'app-markdown-simple',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #segs let-lista>
      @for (s of lista; track $index) {
        @switch (s.tipo) {
          @case ('negrita') {
            <strong>{{ s.texto }}</strong>
          }
          @case ('cursiva') {
            <em>{{ s.texto }}</em>
          }
          @case ('enlace') {
            <a [href]="s.url" target="_blank" rel="noopener noreferrer">{{ s.texto }}</a>
          }
          @default {
            {{ s.texto }}
          }
        }
      }
    </ng-template>
    @for (b of bloques(); track $index) {
      @switch (b.tipo) {
        @case ('parrafo') {
          <p>
            @for (linea of b.lineas; track $index) {
              @if ($index > 0) {
                <br />
              }
              <ng-container *ngTemplateOutlet="segs; context: { $implicit: linea }" />
            }
          </p>
        }
        @case ('lista') {
          <ul>
            @for (item of b.items; track $index) {
              <li><ng-container *ngTemplateOutlet="segs; context: { $implicit: item }" /></li>
            }
          </ul>
        }
        @case ('titulo') {
          <p class="titulo">
            <ng-container *ngTemplateOutlet="segs; context: { $implicit: b.segmentos }" />
          </p>
        }
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow-wrap: anywhere;
    }
    p,
    ul {
      margin: 0;
    }
    ul {
      padding-left: 20px;
    }
    .titulo {
      font-family: Georgia, 'Times New Roman', serif;
      font-weight: 400;
      color: var(--primario);
    }
  `,
  imports: [NgTemplateOutlet],
})
export class MarkdownSimple {
  readonly texto = input.required<string>();
  protected readonly bloques = computed(() => parsearMarkdown(this.texto()));
}
