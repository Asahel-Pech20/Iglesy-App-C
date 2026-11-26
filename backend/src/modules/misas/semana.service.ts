// RF-84 (deseable, Genaro): el sistema arma solo las misas de cada semana a partir del horario.
// Supuesto P-29 (pendiente con el cliente):
// - La semana armada es la lista de misas del horario con su fecha local y su estado. Las que ya
//   empezaron y no están registradas se registran de una vez con su padre programado.
// - Una sustitución se registra antes, misa por misa (RF-49): después de armada, la misa celebrada
//   no se edita (RN-30). Una fiesta de una sola fecha se registra como misa suelta (P-16).
import { AppError } from '../../lib/appError';
import { prisma } from '../../lib/prisma';
import { fechaYHoraLocal, instanteLocal } from '../../lib/dominio/zona';
import { domingoDeLaSemana, sumarDias, type DiaSemana } from './dominio/solapes';
import { excepcionesPorMisa } from './excepciones.service';
import * as misasService from './misas.service';
import type { QueryAgenda } from './misas.schemas';

// SIN_MISA: ese día es inhábil para esa misa (E3-25, supuesto P-33)
export type EstadoMisaSemana = 'REGISTRADA' | 'PENDIENTE' | 'FUTURA' | 'SIN_MISA';

/** Misas de la semana según el horario, con su fecha local y si ya están registradas. */
export async function semanaDeMisas(iglesiaId: string, query: QueryAgenda, ahora = new Date()) {
  const iglesia = await prisma.iglesia.findUnique({
    where: { id: iglesiaId },
    select: { zonaHoraria: true },
  });
  if (!iglesia) throw AppError.noEncontrado('La iglesia no existe.');
  const zona = iglesia.zonaHoraria;
  const domingo = domingoDeLaSemana(query.semana ?? fechaYHoraLocal(ahora, zona).fecha);
  const sabado = sumarDias(domingo, 6);

  const horario = await prisma.horarioMisa.findMany({
    where: { iglesiaId, activo: true },
    orderBy: [{ diaSemana: 'asc' }, { hora: 'asc' }],
    select: {
      id: true,
      diaSemana: true,
      hora: true,
      tipo: true,
      idioma: true,
      duracionMin: true,
      padre: { select: { id: true, nombre: true, titulo: true } },
    },
  });
  const celebradas = await prisma.misaCelebrada.findMany({
    where: {
      iglesiaId,
      horarioMisaId: { in: horario.map((h) => h.id) },
      fecha: { gte: new Date(domingo), lte: new Date(sabado) },
    },
    select: {
      id: true,
      horarioMisaId: true,
      fecha: true,
      padre: { select: { id: true, nombre: true } },
      sustitucion: { select: { motivo: true } },
    },
  });

  const excepciones = await excepcionesPorMisa(
    horario.map((h) => h.id),
    domingo,
    sabado,
  );

  const misas = horario.flatMap((h) => {
    const fecha = sumarDias(domingo, h.diaSemana as DiaSemana);
    const excepcion = excepciones.get(`${h.id}|${fecha}`) ?? null;
    const hora = excepcion?.tipo === 'OTRA_HORA' ? (excepcion.horaNueva as string) : h.hora;
    const inicio = instanteLocal(fecha, hora, zona);
    if (!inicio) return [];
    const hecha = celebradas.find(
      (c) => c.horarioMisaId === h.id && c.fecha?.toISOString().slice(0, 10) === fecha,
    );
    const estado: EstadoMisaSemana = hecha
      ? 'REGISTRADA'
      : excepcion?.tipo === 'SIN_MISA'
        ? 'SIN_MISA'
        : inicio.getTime() > ahora.getTime()
          ? 'FUTURA'
          : 'PENDIENTE';
    return [
      {
        horarioId: h.id,
        diaSemana: h.diaSemana,
        fecha,
        hora,
        inicio,
        tipo: h.tipo,
        idioma: h.idioma,
        duracionMin: h.duracionMin,
        padreProgramado: h.padre,
        estado,
        // Si ese día no hubo misa u otra hora: el tipo, la hora del horario y el motivo (E3-25)
        excepcion: excepcion ? { ...excepcion, horaHorario: h.hora } : null,
        misaCelebrada: hecha
          ? { id: hecha.id, padre: hecha.padre, conSustitucion: hecha.sustitucion !== null }
          : null,
      },
    ];
  });
  misas.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  return { semana: { desde: domingo, hasta: sabado }, misas };
}

/**
 * Registra de una vez las misas pendientes de la semana con su padre programado. Usa el mismo
 * registro que una misa individual (día del horario, ya empezada, una por fecha). Las que no se
 * pueden registrar (p. ej., otra misa a esa hora) se informan sin detener las demás.
 */
export async function armarSemana(iglesiaId: string, query: QueryAgenda, usuarioId: string) {
  const { semana, misas } = await semanaDeMisas(iglesiaId, query);
  const resultado = {
    semana,
    creadas: 0,
    yaRegistradas: misas.filter((m) => m.estado === 'REGISTRADA').length,
    futuras: misas.filter((m) => m.estado === 'FUTURA').length,
    sinMisa: misas.filter((m) => m.estado === 'SIN_MISA').length,
    omitidas: [] as { fecha: string; hora: string; motivo: string }[],
  };
  for (const m of misas.filter((x) => x.estado === 'PENDIENTE')) {
    try {
      await misasService.registrarMisa(
        iglesiaId,
        { horarioMisaId: m.horarioId, fecha: m.fecha },
        usuarioId,
      );
      resultado.creadas++;
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      resultado.omitidas.push({ fecha: m.fecha, hora: m.hora, motivo: error.message });
    }
  }
  return resultado;
}
