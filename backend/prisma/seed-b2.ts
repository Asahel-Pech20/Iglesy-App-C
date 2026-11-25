// Seed de miembros y ministerios (B2-12). Idempotente y reproducible:
// - Generador pseudoaleatorio con semilla fija → siempre los mismos datos.
// - Ids derivados de la semilla → volver a correrlo actualiza (upsert), no duplica.
// B3/B4: usen `seedMiembros()` / `seedMinisterios()` para obtener los ids y agregar eventos, asistencias y donaciones encima.
import { prisma } from '../src/lib/prisma';

const SEMILLA = 20261030;
const TOTAL_MIEMBROS = 60;
const PORCENTAJE_INACTIVOS = 0.1;

const NOMBRES = [
  'José',
  'María',
  'Juan',
  'Guadalupe',
  'Luis',
  'Ana',
  'Carlos',
  'Rosa',
  'Jorge',
  'Lucía',
  'Miguel',
  'Fernanda',
  'Pedro',
  'Sofía',
  'Daniel',
  'Valeria',
  'Alejandro',
  'Daniela',
  'Ricardo',
  'Gabriela',
  'Fernando',
  'Mariana',
  'Eduardo',
  'Patricia',
  'Andrés',
  'Claudia',
  'Raúl',
  'Elena',
  'Sergio',
  'Verónica',
  'Héctor',
  'Isabel',
  'Manuel',
  'Teresa',
  'Rodrigo',
  'Natalia',
];
const APELLIDOS = [
  'Hernández',
  'García',
  'Martínez',
  'López',
  'González',
  'Pérez',
  'Rodríguez',
  'Sánchez',
  'Ramírez',
  'Cruz',
  'Flores',
  'Gómez',
  'Chan',
  'Pech',
  'Canul',
  'May',
  'Uc',
  'Ek',
  'Dzul',
  'Cauich',
  'Novelo',
  'Euán',
  'Poot',
  'Tun',
  'Couoh',
  'Ku',
  'Medina',
  'Castillo',
  'Ruiz',
  'Núñez',
];
const CALLES = [
  'Calle 60',
  'Calle 47',
  'Calle 21',
  'Av. Itzáes',
  'Calle 33',
  'Av. Colón',
  'Calle 59',
];
const COLONIAS = [
  'Centro',
  'García Ginerés',
  'Itzimná',
  'Montejo',
  'Pensiones',
  'Francisco de Montejo',
];
const DOMINIOS = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com.mx'];
const MOTIVOS_BAJA = ['Se mudó de ciudad', 'Cambio de congregación', 'Solicitud personal'];

export const MINISTERIOS_SEED = [
  { nombre: 'Música', descripcion: 'Alabanza y adoración en los cultos.' },
  { nombre: 'Jóvenes', descripcion: 'Reuniones y actividades para jóvenes de 15 a 30 años.' },
  { nombre: 'Niños', descripcion: 'Escuela dominical y cuidado de los más pequeños.' },
  { nombre: 'Enseñanza', descripcion: 'Estudios bíblicos y discipulado.' },
  { nombre: 'Servicio', descripcion: 'Bienvenida, logística y apoyo en eventos.' },
  { nombre: 'Damas', descripcion: 'Reuniones y obra social del grupo femenil.' },
] as const;

/** Coordinadores: correo del usuario del seed de B1 → ministerios que coordina. */
const COORDINADORES: Record<string, string[]> = {
  'coordinador@iglesia.local': ['Jóvenes', 'Música'],
  'pastor@iglesia.local': ['Enseñanza'],
};

/** mulberry32: generador pseudoaleatorio pequeño y determinista. */
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
    siguiente,
    entero: (min: number, max: number) => min + Math.floor(siguiente() * (max - min + 1)),
    elegir: <T>(lista: readonly T[]): T => lista[Math.floor(siguiente() * lista.length)]!,
    probabilidad: (p: number) => siguiente() < p,
  };
}

type Azar = ReturnType<typeof crearAzar>;

/** UUID v4 con formato válido derivado del generador (estable entre corridas). */
function uuidDe(azar: Azar) {
  const hex = Array.from({ length: 32 }, () => azar.entero(0, 15).toString(16));
  hex[12] = '4';
  hex[16] = ((azar.entero(0, 15) & 0x3) | 0x8).toString(16);
  const s = hex.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

function fecha(anio: number, mes: number, dia: number) {
  return new Date(Date.UTC(anio, mes - 1, dia));
}

function sinAcentos(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** ~60 miembros (10 % inactivos). Devuelve sus ids en orden. */
export async function seedMiembros(iglesiaId: string) {
  const azar = crearAzar(SEMILLA);
  const inactivos = Math.round(TOTAL_MIEMBROS * PORCENTAJE_INACTIVOS);
  const ids: string[] = [];

  for (let i = 0; i < TOTAL_MIEMBROS; i++) {
    const id = uuidDe(azar);
    const nombre = azar.elegir(NOMBRES);
    const apellidos = `${azar.elegir(APELLIDOS)} ${azar.elegir(APELLIDOS)}`;
    const fechaIngreso = fecha(azar.entero(2015, 2026), azar.entero(1, 9), azar.entero(1, 28));
    const fechaNacimiento = fecha(azar.entero(1950, 2015), azar.entero(1, 12), azar.entero(1, 28));
    const conEmail = azar.probabilidad(0.75);
    const usuarioCorreo = sinAcentos(`${nombre}.${apellidos.split(' ')[0]}${azar.entero(1, 99)}`);
    const email = conEmail ? `${usuarioCorreo}@${azar.elegir(DOMINIOS)}` : null;
    const telefono = azar.probabilidad(0.9) ? `999${azar.entero(1000000, 9999999)}` : null;
    const direccion = `${azar.elegir(CALLES)} #${azar.entero(100, 999)}, Col. ${azar.elegir(COLONIAS)}`;
    // Los últimos quedan inactivos para que el 10 % sea exacto
    const activo = i < TOTAL_MIEMBROS - inactivos;
    const motivoBaja = azar.elegir(MOTIVOS_BAJA);

    const datos = {
      nombre,
      apellidos,
      fechaIngreso,
      fechaNacimiento,
      email,
      telefono,
      direccion,
      notas: null,
      activo,
      fechaBaja: activo ? null : fecha(2026, 9, azar.entero(1, 28)),
      motivoBaja: activo ? null : motivoBaja,
    };
    await prisma.miembro.upsert({
      where: { id },
      create: { id, iglesiaId, ...datos },
      update: datos,
    });
    ids.push(id);
  }
  return ids;
}

/** Los 6 ministerios del seed. Devuelve un mapa nombre → id. */
export async function seedMinisterios(iglesiaId: string) {
  const ids = new Map<string, string>();
  for (const { nombre, descripcion } of MINISTERIOS_SEED) {
    const ministerio = await prisma.ministerio.upsert({
      where: { iglesiaId_nombre: { iglesiaId, nombre } },
      create: { iglesiaId, nombre, descripcion },
      update: { descripcion, activo: true },
      select: { id: true },
    });
    ids.set(nombre, ministerio.id);
  }
  return ids;
}

/** Vincula a cada miembro activo con 0–2 ministerios y asigna coordinadores. */
export async function seedVinculos(miembroIds: string[], ministerios: Map<string, string>) {
  const azar = crearAzar(SEMILLA + 1);
  const ministerioIds = [...ministerios.values()];
  const encontrados = await prisma.miembro.findMany({
    where: { id: { in: miembroIds }, activo: true },
    select: { id: true, fechaIngreso: true },
  });
  // Mismo orden en cada corrida (el de miembroIds): si no, el generador asigna otros ministerios
  const porId = new Map(encontrados.map((m) => [m.id, m]));
  const activos = miembroIds.flatMap((id) => porId.get(id) ?? []);

  for (const miembro of activos) {
    const cuantos = azar.entero(0, 2);
    const elegidos = new Set(Array.from({ length: cuantos }, () => azar.elegir(ministerioIds)));
    for (const ministerioId of elegidos) {
      const fechaUnion = new Date(
        miembro.fechaIngreso.getTime() + azar.entero(0, 180) * 86_400_000,
      );
      await prisma.miembroMinisterio.upsert({
        where: { miembroId_ministerioId: { miembroId: miembro.id, ministerioId } },
        create: { miembroId: miembro.id, ministerioId, fechaUnion },
        update: {},
      });
    }
  }

  for (const [email, nombres] of Object.entries(COORDINADORES)) {
    const usuario = await prisma.usuario.findUnique({ where: { email }, select: { id: true } });
    if (!usuario) continue;
    for (const nombre of nombres) {
      const ministerioId = ministerios.get(nombre);
      if (!ministerioId) continue;
      await prisma.ministerioCoordinador.upsert({
        where: { ministerioId_usuarioId: { ministerioId, usuarioId: usuario.id } },
        create: { ministerioId, usuarioId: usuario.id },
        update: {},
      });
    }
  }
}

/** Punto de entrada que llama seed.ts. E1-06: todo es de la iglesia indicada (la inicial). */
export async function seedB2(iglesiaId: string) {
  const miembroIds = await seedMiembros(iglesiaId);
  const ministerios = await seedMinisterios(iglesiaId);
  await seedVinculos(miembroIds, ministerios);
  return { miembroIds, ministerios };
}
