// Consultas públicas de iglesias (E2-07, E2-11–E2-13, Nataly): sin sesión y solo iglesias activas.
import { z } from 'zod';
import { esquemaPaginacion } from '../../lib/paginacion';
import { digitos as clave } from '../catalogos/catalogos.schemas';
import { TIPOS_OBJETO } from '../patrimonio/patrimonio.schemas';

export { esquemaListaPublica, type QueryListaPublica } from '../iglesias/iglesias.schemas';

export const esquemaIdPublico = z.object({ iglesiaId: z.uuid('Iglesia no válida.') });

const lugar = {
  estado: clave(2).optional(),
  municipio: clave(5).optional(),
  localidad: clave(9).optional(),
};

/** Un solo nivel de lugar: estado, municipio o ciudad (RF-20, RF-23). */
function unSoloLugar(d: { estado?: string; municipio?: string; localidad?: string }) {
  return [d.estado, d.municipio, d.localidad].filter(Boolean).length <= 1;
}
const mensajeLugar = {
  path: ['estado'],
  message: 'Elige solo uno: estado, municipio o localidad.',
};

/** RF-19, RF-20: sin lugar es el ranking del país. */
export const esquemaReconocidas = esquemaPaginacion.extend(lugar).refine(unSoloLugar, mensajeLugar);

/** RF-23: un tipo, una antigüedad mínima y un lugar (supuesto de P-09). */
export const esquemaBusquedaPatrimonio = esquemaPaginacion
  .extend({
    ...lugar,
    tipoObjeto: z.enum(TIPOS_OBJETO, { error: 'Elige un tipo de objeto válido.' }),
    antiguedadMin: z.coerce
      .number({ error: 'La antigüedad es un número de años.' })
      .int('La antigüedad es un número entero de años.')
      .min(0, 'La antigüedad no puede ser negativa.')
      .max(3000),
  })
  .refine(unSoloLugar, mensajeLugar)
  .refine((d) => Boolean(d.estado || d.municipio || d.localidad), {
    path: ['estado'],
    message: 'Elige un estado, un municipio o una localidad.',
  });

export type QueryReconocidas = z.infer<typeof esquemaReconocidas>;
export type QueryBusquedaPatrimonio = z.infer<typeof esquemaBusquedaPatrimonio>;
