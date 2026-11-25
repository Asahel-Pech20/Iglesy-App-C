import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  CalendarDays,
  Clock,
  Globe,
  LogIn,
  LucideAngularModule,
  Mail,
  MapPin,
  Phone,
} from 'lucide-angular';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import { DIAS_SEMANA, ETIQUETAS_CATEGORIA_EVENTO, formatearFechaHora } from '@/app/core/formato';
import { valorDe } from '@/app/core/recurso';
import { ICONO_CATEGORIA } from '@/app/features/eventos/estilos';
import { AnunciosService } from './anuncios.service';
import { TarjetaAnuncio } from './tarjeta-anuncio';
import { AdornoColonial } from '@/app/compartido/adorno-colonial';

const CINCO_MINUTOS = 5 * 60_000;

/**
 * /cartelera — pública (sin sesión) para miembros, celular o pantalla/TV (F3-13).
 * Con ?pantalla=1 usa letra grande y se actualiza sola cada 5 minutos.
 */
@Component({
  selector: 'app-cartelera',
  imports: [
    RouterLink,
    LucideAngularModule,
    EstadoError,
    EstadoVacio,
    Esqueleto,
    TarjetaAnuncio,
    AdornoColonial,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cartelera.page.html',
  styleUrl: './cartelera.page.css',
})
export class CarteleraPage {
  /** ?pantalla=1 (enlace con query params, vía withComponentInputBinding) */
  readonly pantallaParam = input<string | undefined>(undefined, { alias: 'pantalla' });
  private readonly servicio = inject(AnunciosService);

  protected readonly pantalla = computed(() => this.pantallaParam() === '1');
  protected readonly consulta = rxResource({ stream: () => this.servicio.cartelera() });
  protected readonly datos = computed(() => valorDe(this.consulta));

  protected readonly iconos = { CalendarDays, Clock, Globe, LogIn, Mail, MapPin, Phone };
  protected readonly iconoCategoria = ICONO_CATEGORIA;
  protected readonly categorias = ETIQUETAS_CATEGORIA_EVENTO;
  protected readonly dias = DIAS_SEMANA;
  protected readonly fechaHora = formatearFechaHora;

  constructor() {
    // En modo pantalla se recarga sola cada 5 minutos
    const temporizador = setInterval(() => {
      if (this.pantalla()) this.consulta.reload();
    }, CINCO_MINUTOS);
    inject(DestroyRef).onDestroy(() => clearInterval(temporizador));
  }

  protected direccion() {
    const i = this.datos()?.iglesia;
    return [i?.direccion, i?.ciudad].filter(Boolean).join(', ');
  }
}
