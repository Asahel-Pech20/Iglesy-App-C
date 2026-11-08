import type { Prisma } from '../../generated/prisma/client';
import { AppError } from '../../lib/appError';
import { crearMeta, paginar } from '../../lib/paginacion';
import { prisma } from '../../lib/prisma';
import type { CrearIglesia, QueryListarIglesias } from './iglesias.schemas';

const SELECT = {
  id: true,
  nombre: true,
  tipo: true,
  zonaHoraria: true,
  activa: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.IglesiaSelect;

export async function listar(query: QueryListarIglesias) {
  const { page, limit, skip, take } = paginar(query);
  const where: Prisma.IglesiaWhereInput = query.q
    ? { nombre: { contains: query.q, mode: 'insensitive' } }
    : {};
  const [total, datos] = await Promise.all([
    prisma.iglesia.count({ where }),
    prisma.iglesia.findMany({ where, select: SELECT, orderBy: { nombre: 'asc' }, skip, take }),
  ]);
  return { datos, meta: crearMeta(total, page, limit) };
}

export async function crear(datos: CrearIglesia) {
  const repetida = await prisma.iglesia.findFirst({
    where: { nombre: { equals: datos.nombre, mode: 'insensitive' } },
    select: { id: true },
  });
  if (repetida) throw AppError.conflicto('Ya existe una iglesia con ese nombre.');
  return prisma.iglesia.create({ data: datos, select: SELECT });
}
