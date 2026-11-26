// E3-19 (Genaro): padres, horario semanal de misas, servicios y pláticas de cada iglesia abierta.
// Seeds mínimos de specs.md §12.8: bautizo, primera comunión, confirmación y matrimonio en cada
// iglesia; ≥ 2 tipos de plática por iglesia; 15 padres (≥ 3 en más de una iglesia); al menos una misa
// cada día de la semana en cada iglesia. Datos ficticios: todos los nombres de personas son inventados.
//
// Completa lo que falta y no duplica: se puede volver a correr. Cada hora del horario se elige con el
// mismo dominio que usa la API (misas/dominio/solapes.ts), así que ningún padre queda con dos misas
// que se empalmen, aunque sean en iglesias o zonas horarias distintas (RN-26).
import type { IdiomaMisa, TipoMisa, TipoPlatica } from '../src/generated/prisma/client';
import { prisma } from '../src/lib/prisma';
import { fechaYHoraLocal, instanteLocal } from '../src/lib/dominio/zona';
import {
  buscarChoque,
  buscarChoqueEnIntervalo,
  domingoDeLaSemana,
  intervaloCelebrada,
  semanasDeReferencia,
  sumarDias,
  type DiaSemana,
  type MisaProgramada,
} from '../src/modules/misas/dominio/solapes';

/** Los 6 primeros son los del seed del diezmo (Oscar); se les agrega el título. Ficticios. */
const PADRES: [titulo: string, nombre: string][] = [
  ['Pbro.', 'Luis Pérez Gómez'],
  ['Pbro.', 'Juan Gómez Ruiz'],
  ['Pbro.', 'Tomás Aguilar Cruz'],
  ['Fr.', 'Martín Castillo Pech'],
  ['Pbro.', 'Ignacio Chan Dzul'],
  ['Pbro.', 'Rafael Mendoza Ek'],
  ['Mons.', 'Arturo Velázquez Ramos'],
  ['Pbro.', 'Esteban Morales Tun'],
  ['Fr.', 'Gabriel Ortiz Canul'],
  ['Pbro.', 'Héctor Lozano Vidal'],
  ['Pbro.', 'Julián Rosas Medina'],
  ['Fr.', 'Óscar Salinas Pool'],
  ['Pbro.', 'Raúl Herrera Balam'],
  ['Pbro.', 'Samuel Torres Cauich'],
  ['Pbro.', 'Víctor Navarro Uc'],
];

/** Lengua de la segunda misa dominical según el estado (RN-21); en los demás, español. */
const LENGUA_POR_ESTADO: Record<string, IdiomaMisa> = {
  '31': 'MAYA', // Yucatán
  '20': 'ZAPOTECO', // Oaxaca
  '21': 'NAHUATL', // Puebla
  '07': 'TSELTAL', // Chiapas
};

/** Horas posibles, de la preferida en adelante; si alguna choca para el padre, se prueba la siguiente. */
const HORAS = [
  '07:00',
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
];

type Iglesia = { id: string; nombre: string; zonaHoraria: string; estadoClave: string | null };
type Programada = MisaProgramada & { padreId: string };

async function asegurarPadres() {
  const ids: string[] = [];
  for (const [titulo, nombre] of PADRES) {
    const existente = await prisma.padre.findFirst({
      where: { nombre },
      select: { id: true, titulo: true },
    });
    if (existente) {
      if (!existente.titulo)
        await prisma.padre.update({ where: { id: existente.id }, data: { titulo } });
      ids.push(existente.id);
    } else {
      ids.push((await prisma.padre.create({ data: { nombre, titulo }, select: { id: true } })).id);
    }
  }
  return ids;
}

async function asociar(padreId: string, iglesiaId: string) {
  await prisma.padreIglesia.upsert({
    where: { padreId_iglesiaId: { padreId, iglesiaId } },
    create: { padreId, iglesiaId },
    update: { activo: true },
  });
}

/** Horario de cada padre en todas sus iglesias, para revisar choques al agregar misas. */
async function horarioPorPadre() {
  const existentes = await prisma.horarioMisa.findMany({
    where: { activo: true },
    select: {
      id: true,
      iglesiaId: true,
      diaSemana: true,
      hora: true,
      duracionMin: true,
      padreId: true,
      iglesia: { select: { zonaHoraria: true } },
    },
  });
  const mapa = new Map<string, Programada[]>();
  for (const m of existentes) {
    const lista = mapa.get(m.padreId) ?? [];
    lista.push({
      id: m.id,
      iglesiaId: m.iglesiaId,
      diaSemana: m.diaSemana as DiaSemana,
      hora: m.hora,
      duracionMin: m.duracionMin,
      zonaHoraria: m.iglesia.zonaHoraria,
      padreId: m.padreId,
    });
    mapa.set(m.padreId, lista);
  }
  return mapa;
}

export async function seedMisasYServicios() {
  const iglesias: Iglesia[] = await prisma.iglesia.findMany({
    where: { activa: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, nombre: true, zonaHoraria: true, estadoClave: true },
  });
  const padres = await asegurarPadres();
  const porPadre = await horarioPorPadre();
  const semanas = semanasDeReferencia(new Date());
  const cuenta = { misas: 0, servicios: 0, platicas: 0 };

  /**
   * Programa una misa en la primera hora libre para el padre: desde la preferida y, si no hay,
   * las anteriores. Devuelve false si el padre no tiene ninguna hora libre ese día.
   */
  async function programar(
    iglesia: Iglesia,
    padreId: string,
    diaSemana: DiaSemana,
    desde: string,
    tipo: TipoMisa,
    idioma: IdiomaMisa = 'ESPANOL',
    duracionMin: number | null = null,
  ) {
    const delPadre = porPadre.get(padreId) ?? [];
    const inicio = Math.max(0, HORAS.indexOf(desde));
    for (const hora of [...HORAS.slice(inicio), ...HORAS.slice(0, inicio)]) {
      const nueva: Programada = {
        iglesiaId: iglesia.id,
        diaSemana,
        hora,
        duracionMin,
        zonaHoraria: iglesia.zonaHoraria,
        padreId,
      };
      if (buscarChoque(nueva, delPadre, semanas)) continue;
      const creada = await prisma.horarioMisa.create({
        data: { iglesiaId: iglesia.id, diaSemana, hora, tipo, idioma, duracionMin, padreId },
        select: { id: true },
      });
      delPadre.push({ ...nueva, id: creada.id });
      porPadre.set(padreId, delPadre);
      cuenta.misas++;
      return true;
    }
    return false;
  }

  /** Las misas obligatorias (una cada día) no pueden quedarse sin hora. */
  async function exigir(...args: Parameters<typeof programar>) {
    if (!(await programar(...args))) {
      throw new Error(
        `Sin hora libre para el padre ${args[1]} el día ${args[2]} en ${args[0].nombre}.`,
      );
    }
  }

  for (const [i, iglesia] of iglesias.entries()) {
    // Titular y vicario: con 15 padres, cada uno queda en varias iglesias (RF-41, RN-28)
    const titular = padres[i % padres.length]!;
    const vicario = padres[(i + 7) % padres.length]!;
    await asociar(titular, iglesia.id);
    await asociar(vicario, iglesia.id);

    // ───── Horario: al menos una misa cada día (RF-42) ─────
    const dias = new Set(
      (
        await prisma.horarioMisa.findMany({
          where: { iglesiaId: iglesia.id, activo: true },
          select: { diaSemana: true },
        })
      ).map((m) => m.diaSemana),
    );
    // Hora preferida distinta según la iglesia, para repartir las misas del mismo padre
    const preferida = HORAS[(Math.floor(i / padres.length) * 2) % 6]!;
    for (const dia of [0, 1, 2, 3, 4, 5, 6] as DiaSemana[]) {
      if (dias.has(dia)) continue;
      if (dia === 0) {
        await exigir(iglesia, titular, 0, preferida, 'DOMINICAL');
        const lengua = LENGUA_POR_ESTADO[iglesia.estadoClave ?? ''] ?? 'ESPANOL';
        await programar(iglesia, vicario, 0, '12:00', 'DOMINICAL', lengua, 75);
      } else {
        await exigir(iglesia, titular, dia, preferida, 'DIARIA', 'ESPANOL', 45);
      }
    }
    // Una misa especial semanal en algunas iglesias (P-16: puede ir en el horario)
    if (i % 5 === 0 && !dias.has(4)) await programar(iglesia, vicario, 4, '19:00', 'ESPECIAL');

    // ───── Servicios (RF-30–RF-33) ─────
    const tienen = new Set(
      (
        await prisma.servicio.findMany({
          where: { iglesiaId: iglesia.id, activo: true },
          select: { nombre: true },
        })
      ).map((s) => s.nombre.toLowerCase()),
    );
    const servicios = [
      {
        nombre: 'Bautizo',
        formaCosto: 'MONTO' as const,
        monto: `${300 + (i % 5) * 50}.00`,
        requisitos: 'Acta de nacimiento, CURP y plática prebautismal de papás y padrinos.',
        duracionMin: 60,
        requiereCita: true,
        horarios: [
          { diaSemana: 6, hora: '10:00' },
          { diaSemana: 6, hora: '12:00' },
        ],
      },
      {
        nombre: 'Primera comunión',
        formaCosto: 'DONATIVO' as const,
        monto: i % 2 === 0 ? '200.00' : null,
        requisitos: 'Fe de bautismo y catecismo de primera comunión.',
        duracionMin: 90,
        requiereCita: false,
        horarios: [{ diaSemana: 0, hora: '13:00' }],
      },
      {
        nombre: 'Confirmación',
        formaCosto: 'GRATUITO' as const,
        monto: null,
        requisitos: 'Fe de bautismo y pláticas de confirmación.',
        duracionMin: 90,
        requiereCita: false,
        horarios: [{ diaSemana: 6, hora: '17:00' }],
      },
      {
        nombre: 'Matrimonio',
        formaCosto: 'MONTO' as const,
        monto: `${1500 + (i % 4) * 500}.00`,
        requisitos:
          'Fe de bautismo y confirmación de ambos, presentación matrimonial y pláticas prematrimoniales.',
        duracionMin: 60,
        requiereCita: true,
        horarios: [],
      },
      ...(i % 3 === 0
        ? [
            {
              nombre: 'Misa de XV años',
              formaCosto: 'DONATIVO' as const,
              monto: '800.00',
              requisitos: 'Fe de bautismo de la quinceañera.',
              duracionMin: 60,
              requiereCita: true,
              horarios: [],
            },
          ]
        : []),
    ];
    for (const { horarios, ...s } of servicios) {
      if (tienen.has(s.nombre.toLowerCase())) continue;
      await prisma.servicio.create({
        data: { ...s, iglesiaId: iglesia.id, horarios: { create: horarios } },
      });
      cuenta.servicios++;
    }

    // ───── Pláticas: al menos dos tipos (RF-36) ─────
    const tipos = new Set(
      (
        await prisma.platica.findMany({
          where: { iglesiaId: iglesia.id, activo: true },
          select: { tipo: true },
        })
      ).map((p) => p.tipo),
    );
    const nombreTitular = PADRES[i % padres.length]!;
    const platicas: {
      tipo: TipoPlatica;
      sesiones: number;
      costo: string;
      cupo: number;
      lugar: string;
      imparte: string;
      padreId: string | null;
      horarios: { diaSemana: number; hora: string }[];
    }[] = [
      {
        tipo: 'PREBAUTISMAL',
        sesiones: 2,
        costo: '0.00',
        cupo: 30,
        lugar: 'Salón parroquial',
        imparte: 'Equipo de pastoral bautismal',
        padreId: null,
        horarios: [{ diaSemana: 3, hora: '19:00' }],
      },
      {
        tipo: 'PREMATRIMONIAL',
        sesiones: 4,
        costo: `${150 + (i % 3) * 50}.00`,
        cupo: 20,
        lugar: 'Capilla del Santísimo',
        imparte: `${nombreTitular[0]} ${nombreTitular[1]}`,
        padreId: titular,
        horarios: [{ diaSemana: 5, hora: '19:00' }],
      },
      ...(i % 2 === 0
        ? [
            {
              tipo: 'PRIMERA_COMUNION' as const,
              sesiones: 30,
              costo: '0.00',
              cupo: 25,
              lugar: 'Aulas de catecismo',
              imparte: 'Catequistas de la parroquia',
              padreId: null,
              horarios: [{ diaSemana: 6, hora: '10:00' }],
            },
          ]
        : []),
      ...(i % 3 === 0
        ? [
            {
              tipo: 'CONFIRMACION' as const,
              sesiones: 12,
              costo: '100.00',
              cupo: 25,
              lugar: 'Salón parroquial',
              imparte: 'Pastoral juvenil',
              padreId: null,
              horarios: [{ diaSemana: 6, hora: '16:00' }],
            },
          ]
        : []),
    ];
    for (const { horarios, ...p } of platicas) {
      if (tipos.has(p.tipo)) continue;
      await prisma.platica.create({
        data: { ...p, iglesiaId: iglesia.id, horarios: { create: horarios } },
      });
      cuenta.platicas++;
    }
  }

  const excepciones = await sembrarExcepciones(iglesias[0]);
  return { iglesias: iglesias.length, padres: padres.length, ...cuenta, excepciones };
}

/**
 * E3-25 (supuesto P-33): en la iglesia inicial, la semana siguiente, un domingo sin misa y una misa
 * a otra hora (06:00, solo si el padre no choca). `upsert`: correrlo de nuevo no duplica.
 */
async function sembrarExcepciones(iglesia: Iglesia | undefined) {
  if (!iglesia) return 0;
  const admin = await prisma.usuario.findFirst({
    where: { iglesiaId: iglesia.id, rol: 'ADMIN_IGLESIA', activo: true },
    select: { id: true },
  });
  const horario = await prisma.horarioMisa.findMany({
    where: { iglesiaId: iglesia.id, activo: true },
    orderBy: [{ diaSemana: 'asc' }, { hora: 'asc' }],
    select: { id: true, diaSemana: true, hora: true, duracionMin: true, padreId: true },
  });
  const domingo = horario.find((h) => h.diaSemana === 0);
  const otra = horario.find((h) => h.diaSemana !== 0 && h.hora !== '06:00');
  if (!admin || !domingo) return 0;
  const proximoDomingo = sumarDias(
    domingoDeLaSemana(fechaYHoraLocal(new Date(), iglesia.zonaHoraria).fecha),
    7,
  );
  const guardar = (
    h: { id: string; diaSemana: number },
    datos: { tipo: 'SIN_MISA' | 'OTRA_HORA'; horaNueva?: string; motivo: string },
  ) => {
    const fecha = new Date(sumarDias(proximoDomingo, h.diaSemana));
    return prisma.excepcionMisa.upsert({
      where: { horarioMisaId_fecha: { horarioMisaId: h.id, fecha } },
      update: {},
      create: {
        iglesiaId: iglesia.id,
        horarioMisaId: h.id,
        fecha,
        registradoPorId: admin.id,
        ...datos,
      },
    });
  };
  await guardar(domingo, {
    tipo: 'SIN_MISA',
    motivo: 'Templo cerrado por mantenimiento del techo (dato de prueba).',
  });
  let total = 1;
  if (otra) {
    const fecha = sumarDias(proximoDomingo, otra.diaSemana);
    const inicio = instanteLocal(fecha, '06:00', iglesia.zonaHoraria);
    const suyas = await prisma.horarioMisa.findMany({
      where: { padreId: otra.padreId, activo: true },
      select: {
        id: true,
        iglesiaId: true,
        diaSemana: true,
        hora: true,
        duracionMin: true,
        iglesia: { select: { zonaHoraria: true } },
      },
    });
    const choca =
      !inicio ||
      buscarChoqueEnIntervalo(
        intervaloCelebrada(inicio, otra.duracionMin),
        suyas.map((m) => ({
          id: m.id,
          iglesiaId: m.iglesiaId,
          diaSemana: m.diaSemana as DiaSemana,
          hora: m.hora,
          duracionMin: m.duracionMin,
          zonaHoraria: m.iglesia.zonaHoraria,
        })),
        otra.id,
      );
    if (!choca) {
      await guardar(otra, {
        tipo: 'OTRA_HORA',
        horaNueva: '06:00',
        motivo: 'Fiesta patronal: la misa se adelanta (dato de prueba).',
      });
      total++;
    }
  }
  return total;
}
