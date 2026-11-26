import { z } from 'zod';
import { FORMATOS } from '../../lib/exportadores/reporte';
import { AGRUPACIONES, MAX_DIAS_RESUMEN } from '../donaciones/donaciones.schemas';

const DIA_MS = 86_400_000;

const fecha = z.iso.date('Fecha no válida (formato yyyy-MM-dd).');
const formato = z
  .enum(FORMATOS, { error: 'Formato no válido (json, pdf o xlsx).' })
  .default('json');

/** desde/hasta opcionales, en orden y de 2 años como máximo. */
const rango = {
  desde: fecha.optional(),
  hasta: fecha.optional(),
};

const enOrden = (q: { desde?: string; hasta?: string }) =>
  !q.desde || !q.hasta || q.hasta >= q.desde;
const rangoPermitido = (q: { desde?: string; hasta?: string }) =>
  !q.desde || !q.hasta || Date.parse(q.hasta) - Date.parse(q.desde) <= MAX_DIAS_RESUMEN * DIA_MS;

function conRango<T extends z.ZodObject>(esquema: T) {
  return esquema
    .refine(enOrden, { message: '"hasta" debe ser igual o posterior a "desde".', path: ['hasta'] })
    .refine(rangoPermitido, { message: 'El rango no puede pasar de 2 años.', path: ['hasta'] });
}

export const esquemaReporteMiembros = z.object({
  estado: z.enum(['activo', 'inactivo', 'todos']).default('activo'),
  formato,
});

export const esquemaReporteAsistencia = conRango(
  z.object({
    eventoId: z.uuid('Identificador de evento no válido.').optional(),
    // Solo aplica al reporte por periodo: con `eventoId` el evento ya define el ministerio
    ministerioId: z.uuid('Identificador de ministerio no válido.').optional(),
    ...rango,
    periodo: z.enum(['semanal', 'mensual']).default('semanal'),
    formato,
  }),
);

export const esquemaReporteMinisterios = conRango(
  z.object({
    ministerioId: z.uuid('Identificador de ministerio no válido.').optional(),
    ...rango,
    formato,
  }),
);

export const esquemaReporteIngresos = conRango(
  z.object({
    ...rango,
    agrupar: z.enum(AGRUPACIONES, { error: 'Agrupación no válida.' }).default('mes'),
    formato,
  }),
);

export type QueryReporteMiembros = z.infer<typeof esquemaReporteMiembros>;
export type QueryReporteAsistencia = z.infer<typeof esquemaReporteAsistencia>;
export type QueryReporteMinisterios = z.infer<typeof esquemaReporteMinisterios>;
export type QueryReporteIngresos = z.infer<typeof esquemaReporteIngresos>;
