import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSort, MatSortHeader, type Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterLink } from '@angular/router';
import {
  Eye,
  LucideAngularModule,
  MoreHorizontal,
  Pencil,
  Plus,
  UserCheck,
  Users,
  UserX,
} from 'lucide-angular';
import { filtrosURL } from '@/app/core/filtros-url';
import { valorDe } from '@/app/core/recurso';
import { formatearFecha } from '@/app/core/formato';
import { PuedeDirective } from '@/app/core/puede.directive';
import { SesionService } from '@/app/core/sesion.service';
import { BadgeEstado } from '@/app/compartido/badge-estado';
import { CampoBusqueda } from '@/app/compartido/campo-busqueda';
import { EstadoError, EstadoVacio, Esqueleto } from '@/app/compartido/estados';
import { PageHeader } from '@/app/compartido/page-header';
import { Paginacion } from '@/app/compartido/paginacion';
import type { QueryLista } from '@/app/tipos/comunes';
import type { EstadoMiembroFiltro, MiembroLista } from '@/app/tipos/miembros';
import { BotonExportar } from '@/app/features/reportes/boton-exportar';
import { MinisteriosService } from '@/app/features/ministerios/ministerios.service';
import { EstadoMiembroService } from './estado-miembro';
import { MiembrosService } from './miembros.service';

/** /miembros — listado con búsqueda, filtros en la URL y paginación (F2-01). */
@Component({
  selector: 'app-miembros',
  imports: [
    RouterLink,
    MatTableModule,
    MatSort,
    MatSortHeader,
    MatButton,
    MatIconButton,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatFormField,
    MatLabel,
    MatSelect,
    MatOption,
    LucideAngularModule,
    PuedeDirective,
    PageHeader,
    CampoBusqueda,
    BadgeEstado,
    EstadoVacio,
    EstadoError,
    Esqueleto,
    Paginacion,
    BotonExportar,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './miembros.page.html',
})
export class MiembrosPage {
  private readonly servicio = inject(MiembrosService);
  private readonly ministeriosService = inject(MinisteriosService);
  private readonly estado = inject(EstadoMiembroService);
  private readonly router = inject(Router);
  private readonly sesion = inject(SesionService);

  protected readonly filtros = filtrosURL({
    q: '',
    estado: 'activo',
    ministerioId: '',
    orden: 'apellidos:asc',
    page: 1,
  });
  protected readonly consulta = rxResource({
    params: () => {
      const f = this.filtros.valores();
      return {
        q: f.q || undefined,
        estado: f.estado as EstadoMiembroFiltro,
        ministerioId: f.ministerioId || undefined,
        orden: f.orden as QueryLista['orden'],
        page: f.page,
      };
    },
    stream: ({ params }) => this.servicio.listar(params),
  });
  protected readonly ministerios = rxResource({
    stream: () => this.ministeriosService.listar({ limit: 100 }),
  });
  protected readonly opcionesMinisterio = computed(() => valorDe(this.ministerios)?.data ?? []);
  protected readonly filas = computed(() => valorDe(this.consulta)?.data ?? []);
  protected readonly filtrosExportar = computed(() => ({
    estado: this.filtros.valores().estado as EstadoMiembroFiltro,
  }));
  protected readonly hayFiltros = computed(() => {
    const f = this.filtros.valores();
    return Boolean(f.q || f.ministerioId || f.estado !== 'activo');
  });
  protected readonly orden = computed(() => {
    const [campo, direccion] = this.filtros.valores().orden.split(':');
    return { campo: campo ?? 'apellidos', direccion: (direccion ?? 'asc') as 'asc' | 'desc' };
  });
  protected readonly puedeEditar = computed(() => this.sesion.puede('miembros:editar'));
  protected readonly puedeDesactivar = computed(() => this.sesion.puede('miembros:eliminar'));

  protected readonly columnas = [
    'apellidos',
    'telefono',
    'email',
    'fechaIngreso',
    'ministerios',
    'activo',
    'acciones',
  ];
  protected readonly opcionesEstado = [
    { valor: 'activo', etiqueta: 'Activos' },
    { valor: 'inactivo', etiqueta: 'Inactivos' },
    { valor: 'todos', etiqueta: 'Todos' },
  ];
  protected readonly fecha = formatearFecha;
  protected readonly iconos = { Plus, MoreHorizontal, Eye, Pencil, UserX, UserCheck, Users };

  protected nombresMinisterios(m: MiembroLista) {
    return m.ministerios.length > 0 ? m.ministerios.map((x) => x.nombre).join(', ') : '—';
  }

  protected ordenar(orden: Sort) {
    this.filtros.cambiar({
      orden: orden.direction ? `${orden.active}:${orden.direction}` : 'apellidos:asc',
    });
  }

  /** Clic en la fila abre el perfil (F2-01); los botones y enlaces de la fila no cuentan. */
  protected abrirFila(evento: MouseEvent, m: MiembroLista) {
    if ((evento.target as Element).closest('a, button, input, [role="menuitem"]')) return;
    void this.router.navigate(['/miembros', m.id]);
  }

  protected async cambiarEstado(m: MiembroLista) {
    if (await this.estado.cambiar(m)) this.consulta.reload();
  }
}
