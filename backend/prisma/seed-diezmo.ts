// Seed del diezmo: padres, misas celebradas y diezmos de las últimas 4 semanas en 6 iglesias.
// Datos FICTICIOS (nombres de personas inventados; las iglesias de relleno no existen).
// Idempotente: una iglesia que ya tiene misas no se vuelve a llenar.
import { aCentavos, deCentavos } from '../src/modules/diezmo/dominio/dinero';
import { inicioDelDia } from '../src/lib/dominio/periodo';
import { prisma } from '../src/lib/prisma';

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

async function llenarIglesia(iglesiaId: string, indice: number, capturadoPorId: string) {
  if ((await prisma.misaCelebrada.count({ where: { iglesiaId } })) > 0) return 0;
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

/** Llena la iglesia inicial y 5 iglesias de relleno, cada una con su propio tesorero de prueba. */
export async function seedDiezmo(iglesiaInicialId: string, passwordHash: string) {
  for (const nombre of PADRES) {
    if (!(await prisma.padre.findFirst({ where: { nombre } }))) {
      await prisma.padre.create({ data: { nombre } });
    }
  }

  const tesoreroInicial = await prisma.usuario.findFirstOrThrow({
    where: { iglesiaId: iglesiaInicialId, rol: 'TESORERO' },
    select: { id: true },
  });
  let misas = await llenarIglesia(iglesiaInicialId, 0, tesoreroInicial.id);

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
    misas += await llenarIglesia(iglesia.id, i + 1, tesorero.id);
  }
  return { iglesias: 1 + IGLESIAS_DE_RELLENO.length, misas };
}
