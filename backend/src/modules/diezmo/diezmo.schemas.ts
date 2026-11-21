import { z } from 'zod';
import { esquemaPaginacion } from '../../lib/paginacion';

const fechaDia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato aaaa-mm-dd.');

export const esquemaMisa = z.object({
  iglesiaId: z.uuid('Identificador no válido.'),
  misaId: z.uuid('Identificador no válido.'),
});

export const esquemaIglesia = z.object({ iglesiaId: z.uuid('Identificador no válido.') });

// El monto viaja como texto («1250.50»); el dominio decide si es válido (RN-44)
export const esquemaMonto = z.strictObject({ monto: z.string('El monto es obligatorio.').trim() });

export const esquemaPeriodo = z.object({
  desde: fechaDia.optional(),
  hasta: fechaDia.optional(),
});

export const esquemaListarDiezmos = esquemaPaginacion.extend(esquemaPeriodo.shape);

export const esquemaAgrupado = esquemaPeriodo.extend({
  por: z.enum(['dia', 'semana', 'mes', 'horario', 'padre'], {
    error: 'Elige: dia, semana, mes, horario o padre.',
  }),
});

export type CuerpoMonto = z.infer<typeof esquemaMonto>;
export type QueryPeriodo = z.infer<typeof esquemaPeriodo>;
export type QueryListarDiezmos = z.infer<typeof esquemaListarDiezmos>;
export type QueryAgrupado = z.infer<typeof esquemaAgrupado>;
