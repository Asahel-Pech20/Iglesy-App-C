import { format, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { PrioridadAnuncio } from '@/app/tipos/anuncios';
import type { Rol } from '@/app/tipos/comunes';
import type { AgrupacionIngresos, ConceptoDonacion, MetodoPago } from '@/app/tipos/donaciones';
import type { TipoIglesia } from '@/app/tipos/iglesias';
import type { CategoriaEvento, EstadoEvento, TipoEvento } from '@/app/tipos/eventos';

// Helpers de formato de AGENTS.md §4 (UX). Todas las fechas se muestran en español.

function aFecha(valor: string | Date | null | undefined): Date | null {
  if (!valor) return null;
  // "2026-10-30" (@db.Date) se interpreta como fecha local, no UTC, para no restar un día
  const fecha =
    typeof valor === 'string'
      ? /^\d{4}-\d{2}-\d{2}$/.test(valor)
        ? parseISO(`${valor}T00:00:00`)
        : parseISO(valor)
      : valor;
  return isValid(fecha) ? fecha : null;
}

/** dd/MM/yyyy — "—" si no hay valor */
export function formatearFecha(valor: string | Date | null | undefined): string {
  const fecha = aFecha(valor);
  return fecha ? format(fecha, 'dd/MM/yyyy', { locale: es }) : '—';
}

/** dd/MM/yyyy HH:mm — "—" si no hay valor */
export function formatearFechaHora(valor: string | Date | null | undefined): string {
  const fecha = aFecha(valor);
  return fecha ? format(fecha, 'dd/MM/yyyy HH:mm', { locale: es }) : '—';
}

/** Fecha larga: "jueves, 30 de octubre de 2026" */
export function formatearFechaLarga(valor: string | Date | null | undefined): string {
  const fecha = aFecha(valor);
  return fecha ? format(fecha, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es }) : '—';
}

/** Moneda con Intl en es-MX. El monto llega como string desde la API ("1500.00"). */
export function formatearMoneda(monto: string | number | null | undefined, moneda = 'MXN'): string {
  if (monto === null || monto === undefined || monto === '') return '—';
  const numero = typeof monto === 'string' ? Number(monto) : monto;
  if (Number.isNaN(numero)) return '—';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda }).format(numero);
}

/** Fecha a "yyyy-MM-dd" para enviar a la API (campos @db.Date) */
export function aFechaApi(fecha: Date): string {
  return format(fecha, 'yyyy-MM-dd');
}

// ───────── Etiquetas de enums en español ─────────
// Cada dueño agrega las de su módulo (F2–F4) siguiendo el mismo patrón.

export const ETIQUETAS_TIPO_IGLESIA: Record<TipoIglesia, string> = {
  CATEDRAL: 'Catedral',
  BASILICA: 'Basílica',
  PARROQUIA: 'Parroquia',
  TEMPLO: 'Templo',
  CAPILLA: 'Capilla',
  SANTUARIO: 'Santuario',
};

export const ETIQUETAS_ROL: Record<Rol, string> = {
  COORDINACION: 'Coordinación nacional',
  ADMIN_IGLESIA: 'Administrador de iglesia',
  PASTOR: 'Pastor',
  SECRETARIO: 'Secretario',
  TESORERO: 'Tesorero',
  COORDINADOR: 'Coordinador',
};

// F3: eventos y anuncios
export const ETIQUETAS_TIPO_EVENTO: Record<TipoEvento, string> = {
  RELIGIOSO: 'Religioso',
  ADMINISTRATIVO: 'Administrativo',
};

export const ETIQUETAS_CATEGORIA_EVENTO: Record<CategoriaEvento, string> = {
  CULTO: 'Culto',
  REUNION: 'Reunión',
  ACTIVIDAD: 'Actividad',
  OTRO: 'Otro',
};

export const ETIQUETAS_ESTADO_EVENTO: Record<EstadoEvento, string> = {
  PROGRAMADO: 'Programado',
  CANCELADO: 'Cancelado',
  REALIZADO: 'Realizado',
};

export const ETIQUETAS_PRIORIDAD_ANUNCIO: Record<PrioridadAnuncio, string> = {
  NORMAL: 'Normal',
  IMPORTANTE: 'Importante',
};

// F4: donaciones
export const ETIQUETAS_CONCEPTO: Record<ConceptoDonacion, string> = {
  DIEZMO: 'Diezmo',
  OFRENDA: 'Ofrenda',
  PRIMICIA: 'Primicia',
  DONACION_ESPECIAL: 'Donación especial',
  OTRO: 'Otro',
};

export const ETIQUETAS_METODO: Record<MetodoPago, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  TARJETA: 'Tarjeta',
  CHEQUE: 'Cheque',
  OTRO: 'Otro',
};

export const ETIQUETAS_AGRUPACION: Record<AgrupacionIngresos, string> = {
  dia: 'Día',
  semana: 'Semana',
  mes: 'Mes',
  concepto: 'Concepto',
  metodo: 'Método',
};

export const DIAS_SEMANA = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const;

/** Mes en español: (2026, 10) → "octubre de 2026" */
export function formatearMes(anio: number, mes: number): string {
  return format(new Date(anio, mes - 1, 1), "MMMM 'de' yyyy", { locale: es });
}

/**
 * Etiqueta legible de la clave de un resumen: "2026-10" → "oct 2026", "2026-W43" → "Sem. 43",
 * "2026-10-30" → "30/10/2026"; las claves de enum (concepto, método) se traducen.
 */
export function etiquetaClave(clave: string): string {
  if (/^\d{4}-\d{2}$/.test(clave)) {
    return format(parseISO(`${clave}-01T00:00:00`), 'MMM yyyy', { locale: es });
  }
  if (/^\d{4}-W\d{2}$/.test(clave)) return `Sem. ${clave.slice(-2)} · ${clave.slice(0, 4)}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(clave)) return formatearFecha(clave);
  return (
    ETIQUETAS_CONCEPTO[clave as ConceptoDonacion] ?? ETIQUETAS_METODO[clave as MetodoPago] ?? clave
  );
}

/** Convierte un mapa de etiquetas en opciones para SelectEnum */
export function opcionesDe<T extends string>(etiquetas: Record<T, string>) {
  return (Object.entries(etiquetas) as [T, string][]).map(([valor, etiqueta]) => ({
    valor,
    etiqueta,
  }));
}
