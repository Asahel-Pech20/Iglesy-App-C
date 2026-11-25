import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CalendarDays, LucideAngularModule, Megaphone, Star } from 'lucide-angular';
import { BadgeEstado } from '@/app/compartido/badge-estado';
import { formatearFechaHora } from '@/app/core/formato';
import type { Anuncio } from '@/app/tipos/anuncios';
import { MarkdownSimple } from './markdown-simple';

type DatosAnuncio = Pick<Anuncio, 'titulo' | 'contenido' | 'prioridad' | 'fechaPublicacion'> &
  Partial<Pick<Anuncio, 'autor' | 'evento' | 'fechaExpiracion'>>;

/**
 * Tarjeta de anuncio con título, extracto, badge "Importante", fecha, autor y evento vinculado.
 * Los botones de edición se proyectan como contenido (los pone la página según permisos).
 * @example <app-tarjeta-anuncio [anuncio]="a" [compacta]="true" />  // dashboard (F4)
 */
@Component({
  selector: 'app-tarjeta-anuncio',
  imports: [RouterLink, LucideAngularModule, BadgeEstado, MarkdownSimple],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="tarjeta cuerpo" [class.importante]="importante()" [class.compacta]="compacta()">
      <div class="cabecera">
        <h3 class="titulo">
          <lucide-icon
            [img]="importante() ? iconos.Star : iconos.Megaphone"
            [size]="16"
            [class]="importante() ? 'acento' : 'texto-suave'"
            aria-hidden="true"
          />
          {{ anuncio().titulo }}
        </h3>
        @if (importante()) {
          <app-badge-estado etiqueta="Importante" variante="alerta" />
        }
      </div>
      <app-markdown-simple [texto]="anuncio().contenido" class="contenido" />
      <p class="texto-suave meta">
        Publicado {{ fechaHora(anuncio().fechaPublicacion) }}
        @if (!compacta() && anuncio().autor) {
          por {{ anuncio().autor!.nombre }}
        }
        @if (!compacta() && anuncio().fechaExpiracion) {
          · Expira {{ fechaHora(anuncio().fechaExpiracion) }}
        }
      </p>
      @if (anuncio().evento; as evento) {
        <p class="evento">
          <lucide-icon
            [img]="iconos.CalendarDays"
            [size]="16"
            class="texto-suave"
            aria-hidden="true"
          />
          <a [routerLink]="['/eventos', evento.id]">{{ evento.titulo }}</a>
          <span class="texto-suave">· {{ fechaHora(evento.fechaInicio) }}</span>
        </p>
      }
      <div class="acciones"><ng-content /></div>
    </article>
  `,
  styles: `
    :host {
      display: block;
    }
    .cuerpo {
      display: flex;
      height: 100%;
      flex-direction: column;
      gap: 8px;
      padding: 16px;
    }
    .compacta {
      padding: 12px;
    }
    .importante {
      border-color: var(--acento);
    }
    .cabecera {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
    }
    .titulo {
      margin: 0;
      font-size: 16px;
      font-family: Georgia, 'Times New Roman', serif;
      font-weight: 400;
      color: var(--primario);
    }
    .compacta .titulo {
      font-size: 14px;
    }
    .acento {
      color: var(--acento);
    }
    .contenido {
      font-size: 14px;
    }
    .compacta .contenido {
      display: -webkit-box;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
      line-clamp: 3;
    }
    .meta {
      margin: 0;
      font-size: 12px;
    }
    .evento {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px;
      margin: 0;
      font-size: 14px;
    }
    .acciones {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
      margin-top: auto;
    }
    .acciones:empty {
      display: none;
    }
  `,
})
export class TarjetaAnuncio {
  readonly anuncio = input.required<DatosAnuncio>();
  /** Variante para el dashboard (F4): sin autor ni acciones, extracto corto */
  readonly compacta = input(false);
  protected readonly importante = computed(() => this.anuncio().prioridad === 'IMPORTANTE');
  protected readonly iconos = { CalendarDays, Megaphone, Star };
  protected readonly fechaHora = formatearFechaHora;
}
