// Seed de aportaciones (B4). Idempotente y reproducible como el de B2:
// - Generador pseudoaleatorio con semilla fija y ids derivados → volver a correrlo actualiza, no duplica.
// - Cubre los últimos 12 meses hasta hoy (en la zona horaria de la iglesia) para que el dashboard
//   y el reporte de ingresos tengan datos: ofrendas anónimas cada domingo, diezmos mensuales,
//   primicias, donaciones especiales y algunas anuladas.
import { prisma } from '../src/lib/prisma';

const SEMILLA = 20261102;
const MESES = 12;
const DIA_MS = 86_400_000;

/** mulberry32 (mismo generador que seed-b2.ts). */
function crearAzar(semilla: number) {
  let estado = semilla >>> 0;
  const siguiente = () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    entero: (min: number, max: number) => min + Math.floor(siguiente() * (max - min + 1)),
    elegir: <T>(lista: readonly T[]): T => lista[Math.floor(siguiente() * lista.length)]!,
    probabilidad: (p: number) => siguiente() < p,
  };
}

/** UUID v4 válido y estable: los últimos 12 dígitos son el número de aportación. */
const uuidDe = (n: number) => `b4000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const fechaDe = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const sumarDias = (iso: string, dias: number) =>
  new Date(fechaDe(iso).getTime() + dias * DIA_MS).toISOString().slice(0, 10);

type Concepto = 'DIEZMO' | 'OFRENDA' | 'PRIMICIA' | 'DONACION_ESPECIAL' | 'OTRO';
type Metodo = 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'CHEQUE' | 'OTRO';

interface Aportacion {
  fecha: string;
  monto: string;
  concepto: Concepto;
  conceptoDetalle?: string;
  metodo: Metodo;
  miembroId: string | null;
  referencia?: string;
}

const ESPECIALES = ['Remodelación del templo', 'Campamento de jóvenes', 'Ayuda a misiones'];

/** Aportaciones de los últimos 12 meses para los miembros activos. Devuelve cuántas se guardaron. */
export async function seedDonaciones(miembroIds: string[], iglesiaId: string) {
  const tesorero = await prisma.usuario.findUnique({
    where: { email: 'tesorero@iglesia.local' },
    select: { id: true },
  });
  if (!tesorero) throw new Error('Falta el usuario tesorero@iglesia.local (seed de B1).');
  // E1-06b: la zona horaria es la de la iglesia (antes, la de la configuración única)
  const { zonaHoraria } = await prisma.iglesia.findUniqueOrThrow({
    where: { id: iglesiaId },
    select: { zonaHoraria: true },
  });
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: zonaHoraria }).format(new Date());
  const inicio = new Date(fechaDe(`${hoy.slice(0, 7)}-01`));
  inicio.setUTCMonth(inicio.getUTCMonth() - (MESES - 1));
  const desde = inicio.toISOString().slice(0, 10);

  const azar = crearAzar(SEMILLA);
  // Los 6 últimos ids del seed de B2 son inactivos
  const activos = miembroIds.slice(0, -6);
  const diezmantes = activos.filter(() => azar.probabilidad(0.4));
  const monto = (min: number, max: number) =>
    `${azar.entero(min, max)}.${azar.elegir(['00', '50'])}`;
  const aportaciones: Aportacion[] = [];

  // Ofrendas anónimas en efectivo cada domingo
  let domingo = sumarDias(desde, (7 - fechaDe(desde).getUTCDay()) % 7);
  for (; domingo <= hoy; domingo = sumarDias(domingo, 7)) {
    for (let i = azar.entero(1, 2); i > 0; i--) {
      aportaciones.push({
        fecha: domingo,
        monto: monto(800, 3500),
        concepto: 'OFRENDA',
        metodo: 'EFECTIVO',
        miembroId: null,
      });
    }
  }

  // Diezmos mensuales, primicias y donaciones especiales
  for (let mes = 0; mes < MESES; mes++) {
    const primero = new Date(inicio);
    primero.setUTCMonth(primero.getUTCMonth() + mes);
    const base = primero.toISOString().slice(0, 10);
    for (const miembroId of diezmantes) {
      if (!azar.probabilidad(0.8)) continue;
      const metodo = azar.elegir<Metodo>(['TRANSFERENCIA', 'TRANSFERENCIA', 'EFECTIVO', 'TARJETA']);
      aportaciones.push({
        fecha: sumarDias(base, azar.entero(0, 27)),
        monto: monto(300, 2500),
        concepto: 'DIEZMO',
        metodo,
        miembroId,
        ...(metodo === 'TRANSFERENCIA' && { referencia: `SPEI-${azar.entero(100000, 999999)}` }),
      });
    }
    if (azar.probabilidad(0.5)) {
      aportaciones.push({
        fecha: sumarDias(base, azar.entero(0, 27)),
        monto: monto(500, 1500),
        concepto: 'PRIMICIA',
        metodo: 'EFECTIVO',
        miembroId: azar.elegir(activos),
      });
    }
    if (azar.probabilidad(0.4)) {
      aportaciones.push({
        fecha: sumarDias(base, azar.entero(0, 27)),
        monto: monto(2000, 10000),
        concepto: 'DONACION_ESPECIAL',
        conceptoDetalle: azar.elegir(ESPECIALES),
        metodo: 'CHEQUE',
        miembroId: azar.probabilidad(0.5) ? azar.elegir(activos) : null,
      });
    }
  }

  const vigentes = aportaciones.filter((a) => a.fecha <= hoy);
  for (const [i, a] of vigentes.entries()) {
    const id = uuidDe(i + 1);
    // ~2 % anuladas por captura duplicada
    const anulada = azar.probabilidad(0.02);
    const datos = {
      fecha: fechaDe(a.fecha),
      monto: a.monto,
      concepto: a.concepto,
      conceptoDetalle: a.conceptoDetalle ?? null,
      metodo: a.metodo,
      miembroId: a.miembroId,
      anonima: a.miembroId === null,
      referencia: a.referencia ?? null,
      notas: null,
      anulada,
      motivoAnulacion: anulada ? 'Captura duplicada' : null,
      anuladaEn: anulada ? fechaDe(a.fecha) : null,
      registradoPorId: tesorero.id,
    };
    await prisma.donacion.upsert({
      where: { id },
      create: { id, iglesiaId, ...datos },
      update: datos,
    });
  }
  return vigentes.length;
}
