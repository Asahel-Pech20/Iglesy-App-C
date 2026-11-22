import type { Prisma } from '../../generated/prisma/client';

// Forma pública del usuario. Va en `.tipos.ts` porque también la usa el módulo `auth`
// (regla `modulos-solo-por-service`: entre módulos solo se importan service, schemas y tipos).

/** Campos públicos de un usuario. Nunca incluye passwordHash ni tokens (AGENTS.md regla 5). */
export const SELECT_USUARIO = {
  id: true,
  nombre: true,
  email: true,
  rol: true,
  // Iglesia del personal; null para la Coordinación. El panel la usa para armar sus rutas.
  iglesiaId: true,
  activo: true,
  ultimoAcceso: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UsuarioSelect;

export type UsuarioPublico = Prisma.UsuarioGetPayload<{ select: typeof SELECT_USUARIO }>;
