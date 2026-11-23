// Criptas, nichos, columbarios y osarios (RF-70 a RF-80). Esquemas de panel y de rutas públicas.
import { z } from 'zod';
import { esquemaPaginacion } from '../../lib/paginacion';

export const CLASES_ESPACIO = ['CRIPTA', 'NICHO', 'COLUMBARIO', 'OSARIO'] as const;
export const ESTADOS_SOLICITUD = [
  'RECIBIDA',
  'SIN_LUGAR',
  'COTIZADA',
  'ACEPTADA',
  'RECHAZADA',
  'VENCIDA',
  'CANCELADA',
] as const;

const id = z.uuid('Identificador no válido.');
const texto = (max: number, mensaje: string) =>
  z.string(mensaje).trim().min(1, mensaje).max(max, `Máximo ${max} caracteres.`);

// ───────── Panel (/iglesias/:iglesiaId) ─────────

export const esquemaIglesia = z.object({ iglesiaId: id });
export const esquemaTipo = z.object({ iglesiaId: id, id });
export const esquemaSolicitud = z.object({ iglesiaId: id, id });

export const esquemaCrearTipo = z.strictObject({
  clase: z.enum(CLASES_ESPACIO, { error: 'Elige: cripta, nicho, columbario u osario.' }),
  disponible: z.boolean().optional(),
});

export const esquemaEditarTipo = z
  .strictObject({
    activo: z.boolean().optional(),
    disponible: z.boolean().optional(),
  })
  .refine((d) => d.activo !== undefined || d.disponible !== undefined, 'No hay nada que cambiar.');

export const esquemaListarSolicitudes = esquemaPaginacion.extend({
  estado: z.enum(ESTADOS_SOLICITUD, { error: 'Estado no válido.' }).optional(),
});

/** Dinero como texto con hasta 2 decimales y mayor que cero (RN-44): nunca number. */
const FORMATO_MONTO = /^\d{1,10}(\.\d{1,2})?$/;
export const esquemaCotizar = z.strictObject({
  monto: z
    .string('El monto es obligatorio.')
    .trim()
    .regex(FORMATO_MONTO, 'Monto no válido (hasta 2 decimales).')
    .refine((m) => Number(m) > 0, 'El monto debe ser mayor que cero.'),
  condiciones: texto(2000, 'Escribe las condiciones de la cotización.'),
});

// ───────── Público (/public) ─────────

export const esquemaIglesiaPublica = z.object({ iglesiaId: id });

const telefono = z
  .string()
  .trim()
  .regex(/^[0-9+()\-\s]{7,20}$/, 'Teléfono no válido.');

/** P-25 (supuesto): nombre y al menos un teléfono o un correo para que la iglesia pueda responder. */
export const esquemaCrearSolicitud = z.strictObject({
  tipoEspacioId: id,
  contacto: z
    .strictObject({
      nombre: texto(150, 'Escribe tu nombre.'),
      telefono: telefono.optional(),
      correo: z.email('Correo no válido.').trim().toLowerCase().max(150).optional(),
    })
    .refine((c) => Boolean(c.telefono || c.correo), {
      message: 'Deja un teléfono o un correo para que la iglesia pueda responderte.',
      path: ['telefono'],
    }),
  comentarios: z.string().trim().max(1000, 'Máximo 1000 caracteres.').optional(),
});

export const esquemaFolio = z.object({
  folio: z
    .string()
    .trim()
    .min(6, 'Folio no válido.')
    .max(40, 'Folio no válido.')
    .regex(/^[A-Za-z0-9-]+$/, 'Folio no válido.'),
});

export const esquemaClave = z.strictObject({
  clave: z
    .string('Escribe la clave.')
    .trim()
    .min(1, 'Escribe la clave.')
    .max(40, 'Clave no válida.'),
});

export type CrearTipo = z.infer<typeof esquemaCrearTipo>;
export type EditarTipo = z.infer<typeof esquemaEditarTipo>;
export type QueryListarSolicitudes = z.infer<typeof esquemaListarSolicitudes>;
export type CuerpoCotizar = z.infer<typeof esquemaCotizar>;
export type CrearSolicitud = z.infer<typeof esquemaCrearSolicitud>;
