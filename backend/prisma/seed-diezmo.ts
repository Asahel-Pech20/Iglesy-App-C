// Seed del diezmo: padres, misas celebradas y diezmos de las últimas 4 semanas en 6 iglesias.
// Datos FICTICIOS (nombres de personas inventados; las iglesias de relleno no existen).
// Idempotente: una iglesia que ya tiene misas no se vuelve a llenar.
//
// E3-19 (Genaro, acordado con Oscar): en dos pasos. `prepararDiezmo` crea padres, iglesias de
// relleno y tesoreros; `llenarDiezmo` corre DESPUÉS del seed del horario de misas y arma las misas
// celebradas a partir del horario de cada iglesia (RF-48, RN-29): el padre programado y, en
// algunas, una sustitución con motivo (RF-49). Una iglesia sin horario conserva las misas fijas.
import type { TipoMisa } from '../src/generated/prisma/client';
import { aCentavos, deCentavos } from '../src/modules/diezmo/dominio/dinero';
import { inicioDelDia } from '../src/lib/dominio/periodo';
import { instanteLocal } from '../src/lib/dominio/zona';
import { prisma } from '../src/lib/prisma';
import {
  buscarChoqueEnIntervalo,
  intervaloCelebrada,
  type DiaSemana,
} from '../src/modules/misas/dominio/solapes';

const DIA = 24 * 60 * 60 * 1000;
const SEMANAS = 4;
const ZONA = 'America/Mexico_City';

// (hora local, base en pesos) de las misas de cada día de la semana; 0 = domingo
const MISAS_POR_DIA: Record<number, [string, number][]> = {
  0: [
    ['08:00', 900],
    ['12:00', 1500],
    ['18:00', 1100],
  ],
  3: [['19:00', 400]],
  5: [['19:00', 450]],
};

const PADRES = [
  'Luis Pérez Gómez',
  'Juan Gómez Ruiz',
  'Tomás Aguilar Cruz',
  'Martín Castillo Pech',
  'Ignacio Chan Dzul',
  'Rafael Mendoza Ek',
];

const IGLESIAS_DE_RELLENO = [
  ['Parroquia de San José (ficticia)', 'PARROQUIA'],
  ['Capilla del Sagrado Corazón (ficticia)', 'CAPILLA'],
  ['Templo de Santa Lucía (ficticio)', 'TEMPLO'],
  ['Santuario de la Virgen del Carmen (ficticio)', 'SANTUARIO'],
  ['Basílica de San Miguel (ficticia)', 'BASILICA'],
] as const;

/** Monto determinista (sin azar) para que el seed siempre dé los mismos datos. */
function monto(basePesos: number, semilla: number): string {
  const variacion = (semilla * 7919 + 104729) % 25_000; // hasta 250.00 de diferencia
  return deCentavos(aCentavos(`${basePesos}.00`) + variacion);
}

/** Base del diezmo según el tipo de misa (las dominicales juntan más). */
const BASE_POR_TIPO: Record<TipoMisa, number> = { DOMINICAL: 1200, DIARIA: 350, ESPECIAL: 600 };
/** Cada cuántas misas hubo un sustituto (para que la demo muestre algunas sustituciones). */
const CADA_SUSTITUCION = 9;
const MOTIVOS = [
  'El párroco salió a una reunión de la diócesis.',
  'El padre programado está enfermo.',
  'El padre programado celebró una boda en otra comunidad.',
];

/** Misas de las últimas 4 semanas armadas a partir del horario de la iglesia, con su diezmo. */
async function llenarDesdeHorario(iglesiaId: string, indice: number, capturadoPorId: string) {
  const iglesia = await prisma.iglesia.findUniqueOrThrow({
    where: { id: iglesiaId },
    select: { zonaHoraria: true },
  });
  const horario = await prisma.horarioMisa.findMany({
    where: { iglesiaId, activo: true },
    orderBy: [{ diaSemana: 'asc' }, { hora: 'asc' }],
    select: { id: true, diaSemana: true, hora: true, tipo: true, duracionMin: true, padreId: true },
  });
  if (horario.length === 0) return null;
  // Posibles sustitutos: cualquier padre activo con su horario en todas sus iglesias; primero los
  // que ya celebran en esta iglesia (el titular y el vicario suelen estar ocupados a esa hora)
  const delaIglesia = new Set(
    (
      await prisma.padreIglesia.findMany({
        where: { iglesiaId, activo: true },
        select: { padreId: true },
      })
    ).map((a) => a.padreId),
  );
  const candidatos = (
    await prisma.padre.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        horarios: {
          where: { activo: true },
          select: {
            id: true,
            iglesiaId: true,
            diaSemana: true,
            hora: true,
            duracionMin: true,
            iglesia: { select: { zonaHoraria: true } },
          },
        },
      },
    })
  ).sort((a, b) => Number(delaIglesia.has(b.id)) - Number(delaIglesia.has(a.id)));
  const ahora = Date.now();
  let creados = 0;
  let consecutivo = 0;
  // Toca sustitución cada CADA_SUSTITUCION misas; si en esa nadie está libre (las misas diarias
  // ocupan a todos los padres), se intenta en las siguientes hasta encontrar a alguien
  let tocaSustitucion = false;
  for (let dias = SEMANAS * 7; dias >= 1; dias--) {
    const fecha = new Date(ahora - dias * DIA).toISOString().slice(0, 10);
    const diaSemana = new Date(`${fecha}T12:00:00Z`).getUTCDay();
    for (const h of horario.filter((m) => m.diaSemana === diaSemana)) {
      const inicio = instanteLocal(fecha, h.hora, iglesia.zonaHoraria);
      if (!inicio || inicio.getTime() > ahora) continue;
      consecutivo++;
      // Sustituto: otro padre de la iglesia libre a esa hora (supuesto P-17, RN-26)
      let sustituto: string | null = null;
      if ((consecutivo + indice) % CADA_SUSTITUCION === 0) tocaSustitucion = true;
      if (tocaSustitucion) {
        const intervalo = intervaloCelebrada(inicio, h.duracionMin);
        sustituto =
          candidatos.find(
            (c) =>
              c.id !== h.padreId &&
              !buscarChoqueEnIntervalo(
                intervalo,
                c.horarios.map((x) => ({
                  ...x,
                  diaSemana: x.diaSemana as DiaSemana,
                  zonaHoraria: x.iglesia.zonaHoraria,
                })),
                h.id,
              ),
          )?.id ?? null;
        if (sustituto) tocaSustitucion = false;
        // Supuesto P-17: el sustituto celebra en la iglesia; si venía de otra, queda asociado
        if (sustituto && !delaIglesia.has(sustituto)) {
          await prisma.padreIglesia.upsert({
            where: { padreId_iglesiaId: { padreId: sustituto, iglesiaId } },
            create: { padreId: sustituto, iglesiaId },
            update: { activo: true },
          });
          delaIglesia.add(sustituto);
        }
      }
      const misa = await prisma.misaCelebrada.create({
        data: {
          iglesiaId,
          inicio,
          padreId: sustituto ?? h.padreId,
          horarioMisaId: h.id,
          fecha: new Date(fecha),
          duracionMin: h.duracionMin,
          registradoPorId: capturadoPorId,
        },
        select: { id: true },
      });
      if (sustituto) {
        await prisma.sustitucionMisa.create({
          data: {
            misaCelebradaId: misa.id,
            padreProgramadoId: h.padreId,
            padreRealId: sustituto,
            motivo: MOTIVOS[consecutivo % MOTIVOS.length]!,
            hechaPorId: capturadoPorId,
          },
        });
      }
      await prisma.diezmo.create({
        data: {
          misaId: misa.id,
          iglesiaId,
          monto: monto(BASE_POR_TIPO[h.tipo], dias * 31 + consecutivo * 7 + indice * 101),
          capturadoPorId,
        },
      });
      creados++;
    }
  }
  return creados;
}

async function llenarIglesia(iglesiaId: string, indice: number, capturadoPorId: string) {
  if ((await prisma.misaCelebrada.count({ where: { iglesiaId } })) > 0) return 0;
  const desdeHorario = await llenarDesdeHorario(iglesiaId, indice, capturadoPorId);
  if (desdeHorario !== null) return desdeHorario;
  // Sin horario: misas fijas (versión original de Oscar)
  const padres = await prisma.padre.findMany({ orderBy: { nombre: 'asc' } });
  let creados = 0;
  for (let dias = 1; dias <= SEMANAS * 7; dias++) {
    const fecha = new Date(Date.now() - dias * DIA).toISOString().slice(0, 10);
    const diaSemana = new Date(`${fecha}T12:00:00Z`).getUTCDay();
    const misas = MISAS_POR_DIA[diaSemana] ?? [];
    for (const [indiceMisa, [hora, base]] of misas.entries()) {
      const [horas = 0, minutos = 0] = hora.split(':').map(Number);
      const inicio = new Date(
        inicioDelDia(fecha, ZONA).getTime() + (horas * 60 + minutos) * 60_000,
      );
      const padre = padres[(indice + dias + indiceMisa) % padres.length];
      if (!padre) continue;
      const misa = await prisma.misaCelebrada.create({
        data: { iglesiaId, inicio, padreId: padre.id },
      });
      // E3-06 (Genaro): el padre que oficia en la iglesia queda asociado a ella (RF-41, RN-28)
      await prisma.padreIglesia.upsert({
        where: { padreId_iglesiaId: { padreId: padre.id, iglesiaId } },
        create: { padreId: padre.id, iglesiaId },
        update: {},
      });
      await prisma.diezmo.create({
        data: {
          misaId: misa.id,
          iglesiaId,
          monto: monto(base, dias * 31 + indiceMisa * 7 + indice * 101),
          capturadoPorId,
        },
      });
      creados++;
    }
  }
  return creados;
}

export interface DiezmoPreparado {
  /** Iglesia y su tesorero de prueba, en orden: la inicial y luego las de relleno */
  tesorerias: { iglesiaId: string; tesoreroId: string }[];
}

/** Paso 1: padres, iglesias de relleno y un tesorero de prueba en cada una (sin misas todavía). */
export async function prepararDiezmo(
  iglesiaInicialId: string,
  passwordHash: string,
): Promise<DiezmoPreparado> {
  for (const nombre of PADRES) {
    if (!(await prisma.padre.findFirst({ where: { nombre } }))) {
      await prisma.padre.create({ data: { nombre } });
    }
  }

  const tesoreroInicial = await prisma.usuario.findFirstOrThrow({
    where: { iglesiaId: iglesiaInicialId, rol: 'TESORERO' },
    select: { id: true },
  });
  const tesorerias = [{ iglesiaId: iglesiaInicialId, tesoreroId: tesoreroInicial.id }];

  for (const [i, [nombre, tipo]] of IGLESIAS_DE_RELLENO.entries()) {
    const iglesia =
      (await prisma.iglesia.findFirst({ where: { nombre } })) ??
      (await prisma.iglesia.create({ data: { nombre, tipo, zonaHoraria: ZONA } }));
    const email = `tesorero${i + 2}@iglesia.local`;
    const tesorero = await prisma.usuario.upsert({
      where: { email },
      create: {
        email,
        nombre: `Tesorería de ${nombre}`,
        rol: 'TESORERO',
        iglesiaId: iglesia.id,
        passwordHash,
      },
      update: {},
      select: { id: true },
    });
    tesorerias.push({ iglesiaId: iglesia.id, tesoreroId: tesorero.id });
  }
  return { tesorerias };
}

/** Paso 2: 4 semanas de misas y diezmos en cada iglesia preparada (desde su horario, si lo tiene). */
export async function llenarDiezmo({ tesorerias }: DiezmoPreparado) {
  let misas = 0;
  for (const [i, t] of tesorerias.entries())
    misas += await llenarIglesia(t.iglesiaId, i, t.tesoreroId);
  return { iglesias: tesorerias.length, misas };
}

/** Los dos pasos seguidos (sin horario de por medio, cada iglesia usa las misas fijas). */
export async function seedDiezmo(iglesiaInicialId: string, passwordHash: string) {
  return llenarDiezmo(await prepararDiezmo(iglesiaInicialId, passwordHash));
}
