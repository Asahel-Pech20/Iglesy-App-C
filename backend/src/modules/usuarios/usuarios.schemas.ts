import { z } from 'zod';
import { ROLES } from '../../config/permisos';
import { esquemaPaginacion } from '../../lib/paginacion';
import { esquemaPassword } from '../../lib/seguridad';

const nombre = z.string().trim().min(1, 'Escribe el nombre.').max(120);
const email = z.string().trim().toLowerCase().pipe(z.email('Correo no válido.'));
const rol = z.enum(ROLES, { error: 'Rol no válido.' });

export const esquemaIdUsuario = z.object({ id: z.uuid('Identificador no válido.') });

export const esquemaListarUsuarios = esquemaPaginacion.extend({
  rol: rol.optional(),
  activo: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

/** Sin contraseña se envía una invitación por correo para que la configure (B1-14). */
export const esquemaCrearUsuario = z.strictObject({
  nombre,
  email,
  rol,
  password: esquemaPassword.optional(),
  /** Solo la Coordinación la indica; el administrador de una iglesia crea en la suya. */
  iglesiaId: z.uuid('Identificador no válido.').optional(),
});

export const esquemaEditarUsuario = z
  .strictObject({
    nombre: nombre.optional(),
    email: email.optional(),
    rol: rol.optional(),
    iglesiaId: z.uuid('Identificador no válido.').optional(),
  })
  .refine((d) => Object.keys(d).length > 0, 'No hay cambios para guardar.');

export const esquemaEstadoUsuario = z.strictObject({ activo: z.boolean() });

export const esquemaOpcionesUsuario = z.object({ rol: rol.optional() });

export type QueryUsuarios = z.infer<typeof esquemaListarUsuarios>;
export type CrearUsuario = z.infer<typeof esquemaCrearUsuario>;
export type EditarUsuario = z.infer<typeof esquemaEditarUsuario>;
