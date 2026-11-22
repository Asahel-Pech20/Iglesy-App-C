import {
  Banknote,
  CalendarDays,
  ClipboardCheck,
  Church,
  FileBarChart,
  HandCoins,
  Home,
  type LucideIconData,
  Megaphone,
  Network,
  Settings,
  UserCog,
  Users,
} from 'lucide-angular';
import type { Permiso } from '@/app/tipos/comunes';

export interface EntradaMenu {
  etiqueta: string;
  ruta: string;
  icono: LucideIconData;
  /** Si se omite, la ve cualquier usuario autenticado */
  permiso?: Permiso | Permiso[];
  /** Módulo todavía no migrado: se muestra deshabilitado (ya no queda ninguno) */
  pendiente?: boolean;
}

/**
 * Menú lateral, filtrado por permisos en el layout.
 * F3–F4: al migrar su módulo, quiten `pendiente` y agreguen su ruta en app.routes.ts con el mismo permiso.
 */
export const MENU: EntradaMenu[] = [
  { etiqueta: 'Inicio', ruta: '/', icono: Home },
  { etiqueta: 'Miembros', ruta: '/miembros', icono: Users, permiso: 'miembros:leer' },
  { etiqueta: 'Ministerios', ruta: '/ministerios', icono: Network, permiso: 'ministerios:leer' },
  {
    etiqueta: 'Eventos',
    ruta: '/eventos',
    icono: CalendarDays,
    permiso: 'eventos:leer',
  },
  {
    etiqueta: 'Asistencia',
    ruta: '/asistencia',
    icono: ClipboardCheck,
    permiso: ['asistencia:leer', 'asistencia:leer-propio'],
  },
  {
    etiqueta: 'Anuncios',
    ruta: '/anuncios',
    icono: Megaphone,
    permiso: 'anuncios:leer',
  },
  {
    etiqueta: 'Donaciones',
    ruta: '/donaciones',
    icono: Banknote,
    permiso: 'donaciones:leer',
  },
  { etiqueta: 'Iglesias', ruta: '/iglesias', icono: Church, permiso: 'iglesias:leer' },
  {
    etiqueta: 'Diezmo',
    ruta: '/diezmo',
    icono: HandCoins,
    permiso: 'diezmo:leer',
  },
  {
    etiqueta: 'Reportes',
    ruta: '/reportes',
    icono: FileBarChart,
    permiso: ['reportes:generales', 'reportes:generales-propio', 'reportes:ingresos'],
  },
  { etiqueta: 'Usuarios', ruta: '/usuarios', icono: UserCog, permiso: 'usuarios:leer' },
  {
    etiqueta: 'Configuración',
    ruta: '/configuracion',
    icono: Settings,
    permiso: 'configuracion:leer',
  },
];
