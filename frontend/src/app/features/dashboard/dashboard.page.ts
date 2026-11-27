import { AccesosRapidos } from '@/app/compartido/accesos-rapidos';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Banknote,
  ClipboardCheck,
  LucideAngularModule,
  Megaphone,
  Network,
  Users,
} from 'lucide-angular';
import { EstadoError } from '@/app/compartido/estados';
import { GraficaBarras, TarjetaGrafica } from '@/app/compartido/graficas';
import { PageHeader } from '@/app/compartido/page-header';
import { StatCard } from '@/app/compartido/stat-card';
import { FormatoMonedaService } from '@/app/core/formato-moneda.service';
import { valorDe } from '@/app/core/recurso';
import { SesionService } from '@/app/core/sesion.service';
import { TarjetaAnuncio } from '@/app/features/anuncios/tarjeta-anuncio';
import { textoVariacion } from '@/app/features/donaciones/formato-donacion';
import { ListaEventos } from '@/app/features/eventos/componentes';
import { DashboardService } from './dashboard.service';

/** "2026-W43" → "S43" · "2026-10" → "oct 26" (marcas cortas de los ejes) */
const semanaCorta = (clave: string) => `S${clave.slice(-2)}`;
const mesCorto = (clave: string) =>
  format(parseISO(`${clave}-01T00:00:00`), 'MMM yy', { locale: es });
const compacto = new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 });
const numero = (n: number) => n.toLocaleString('es-MX');

function saludo(hora = new Date().getHours()) {
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/** Panel principal (F4-06 … F4-08). */
@Component({
  selector: 'app-dashboard',
  imports: [
    AccesosRapidos,
    NgTemplateOutlet,
    RouterLink,
    LucideAngularModule,
    PageHeader,
    EstadoError,
    StatCard,
    TarjetaGrafica,
    GraficaBarras,
    ListaEventos,
    TarjetaAnuncio,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.css',
})
export class DashboardPage {
  private readonly servicio = inject(DashboardService);
  private readonly sesion = inject(SesionService);
  protected readonly moneda = inject(FormatoMonedaService);

  protected readonly consulta = rxResource({ stream: () => this.servicio.obtener() });
  protected readonly d = computed(() => valorDe(this.consulta));

  protected readonly titulo = computed(() => `${saludo()}, ${this.sesion.usuario()?.nombre ?? ''}`);
  protected readonly verMiembros = computed(() => this.sesion.puede('miembros:leer'));
  protected readonly verMinisterios = computed(() => this.sesion.puede('ministerios:leer'));
  protected readonly verAsistencia = computed(() =>
    this.sesion.puede('asistencia:leer', 'asistencia:leer-propio'),
  );
  protected readonly verDonaciones = computed(() => this.sesion.puede('donaciones:leer'));
  protected readonly verEventos = computed(() => this.sesion.puede('eventos:leer'));
  protected readonly verAnuncios = computed(() => this.sesion.puede('anuncios:leer'));

  protected readonly iconos = { Banknote, ClipboardCheck, Megaphone, Network, Users };
  protected readonly numero = numero;
  protected readonly variacion = textoVariacion;
  protected readonly compacto = (v: number) => compacto.format(v);

  // Datos de las gráficas
  protected readonly asistencia = computed(() => this.d()?.graficas.asistenciaSemanal ?? []);
  protected readonly totalAsistencia = computed(() =>
    this.asistencia().reduce((s, x) => s + x.presentes, 0),
  );
  protected readonly puntosAsistencia = computed(() =>
    this.asistencia().map((s) => ({ etiqueta: semanaCorta(s.semana), valor: s.presentes })),
  );
  protected readonly filasAsistencia = computed(() =>
    this.asistencia().map((s) => [s.semana, s.presentes, s.ausentes, s.eventos]),
  );

  protected readonly ministerios = computed(() => this.d()?.graficas.miembrosPorMinisterio ?? []);
  protected readonly puntosMinisterios = computed(() =>
    this.ministerios().map((m) => ({ etiqueta: m.ministerio, valor: m.total })),
  );
  protected readonly filasMinisterios = computed(() =>
    this.ministerios().map((m) => [m.ministerio, m.total]),
  );
  protected readonly descMinisterios = computed(() => {
    const primero = this.ministerios()[0];
    return primero
      ? `El ministerio con más integrantes es ${primero.ministerio} (${primero.total}).`
      : 'Aún no hay ministerios con integrantes.';
  });

  protected readonly altas = computed(() => this.d()?.graficas.altasMiembrosPorMes ?? []);
  protected readonly totalAltas = computed(() => this.altas().reduce((s, x) => s + x.total, 0));
  protected readonly puntosAltas = computed(() =>
    this.altas().map((a) => ({ etiqueta: mesCorto(a.mes), valor: a.total })),
  );
  protected readonly filasAltas = computed(() => this.altas().map((a) => [a.mes, a.total]));

  protected readonly ingresosMes = computed(() => this.d()?.ingresos?.porMes ?? []);
  protected readonly puntosIngresos = computed(() =>
    this.ingresosMes().map((m) => ({ etiqueta: mesCorto(m.mes), valor: Number(m.total) })),
  );
  protected readonly filasIngresos = computed(() =>
    this.ingresosMes().map((m) => [m.mes, this.moneda.formato(m.total)]),
  );
}
