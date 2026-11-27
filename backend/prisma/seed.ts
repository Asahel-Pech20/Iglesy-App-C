// Seed mínimo (B1-04): configuración de la iglesia y un usuario por rol. Idempotente (upsert).
// B2 extiende este archivo con datos de dominio (B2-12).
import { ROLES } from '../src/config/permisos';
import { sinAlcance } from '../src/lib/contextoIglesia';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/seguridad';
import { seedB2 } from './seed-b2';
import { seedB3 } from './seed-b3';
import { seedDonaciones } from './seed-b4';
import { llenarDiezmo, prepararDiezmo } from './seed-diezmo';
import { seedIglesiasReales } from './seed-iglesias-reales';
import { seedPatrimonio } from './seed-patrimonio';
import { seedEspacios } from './seed-espacios';
import { seedMisasYServicios } from './seed-misas-servicios';

const NOMBRES: Record<(typeof ROLES)[number], string> = {
  COORDINACION: 'Coordinación Nacional de Templos',
  ADMIN_IGLESIA: 'Administrador General',
  PASTOR: 'Pastor General',
  SECRETARIO: 'Secretaría',
  TESORERO: 'Tesorería',
  COORDINADOR: 'Coordinador de Ministerio',
};

/** Correo del usuario de prueba de cada rol (se conservan los de AppIglesia: admin@, pastor@…). */
const correoDe = (rol: (typeof ROLES)[number]) =>
  `${rol === 'ADMIN_IGLESIA' ? 'admin' : rol.toLowerCase()}@iglesia.local`;

async function main() {
  const password = process.env.SEED_PASSWORD;
  if (!password) throw new Error('Falta SEED_PASSWORD en backend/.env (ver .env.example).');

  // Iglesia inicial: la migración ya la crea con los datos de la configuración; en una BD nueva se crea aquí.
  // E1-06b: moneda, zona horaria y logo son de la iglesia; configuracion_iglesia ya no se usa.
  const iglesia =
    (await prisma.iglesia.findFirst({ orderBy: { createdAt: 'asc' } })) ??
    (await prisma.iglesia.create({ data: { nombre: 'Mi Iglesia', tipo: 'PARROQUIA' } }));

  const passwordHash = await hashPassword(password);
  for (const rol of ROLES) {
    const email = correoDe(rol);
    // La Coordinación es nacional (sin iglesia); el resto pertenece a la iglesia inicial
    const iglesiaId = rol === 'COORDINACION' ? null : iglesia.id;
    // update vacío: volver a correr el seed no cambia contraseñas ni datos editados
    await prisma.usuario.upsert({
      where: { email },
      create: { email, nombre: NOMBRES[rol], rol, iglesiaId, passwordHash },
      update: {},
    });
  }

  // B2-12: miembros, ministerios, vínculos y coordinadores
  const { miembroIds, ministerios } = await seedB2(iglesia.id);
  // B4: aportaciones de los últimos 12 meses
  const donaciones = await seedDonaciones(miembroIds, iglesia.id);

  // Ecclesia: iglesias y tesoreros del diezmo; sus misas se arman después, desde el horario
  const preparadoDiezmo = await prepararDiezmo(iglesia.id, passwordHash);

  // E2-09 (Nataly): catálogo del INEGI, 40 iglesias y 120 objetos del patrimonio (ficticios)
  const patrimonio = await seedPatrimonio();
  // Iglesias reales de los 32 estados con foto de Wikimedia Commons (sus objetos, ilustrativos)
  const reales = await seedIglesiasReales();
  // Ecclesia: tipos de espacio y 12 solicitudes (clave de demostración ABCDE-FGHJK)
  const espacios = await seedEspacios();
  // E3-19 (Genaro): 15 padres, horario semanal sin choques, servicios y pláticas en cada iglesia
  const misas = await seedMisasYServicios();
  // Ecclesia: 4 semanas de misas (desde el horario, con algunas sustituciones) y diezmos en 6 iglesias
  const diezmo = await llenarDiezmo(preparadoDiezmo);

  // B3: eventos (con asistencia), anuncios y un evento cancelado para la demo
  const b3 = await seedB3({ ministerios, iglesiaId: iglesia.id });

  console.warn(
    `Seed listo: configuración, iglesia inicial, ${ROLES.length} usuarios (<rol>@iglesia.local; admin@ es ADMIN_IGLESIA), ${miembroIds.length} miembros, ${ministerios.size} ministerios, ${b3.eventos} eventos, ${b3.asistencias} asistencias, ${b3.anuncios} anuncios, ${donaciones} aportaciones, ${diezmo.misas} misas con diezmo en ${diezmo.iglesias} iglesias, ${espacios.solicitudes} solicitudes de espacio; misas y servicios en ${misas.iglesias} iglesias: ${misas.padres} padres, ${misas.misas} misas del horario, ${misas.servicios} servicios y ${misas.platicas} pláticas nuevos; patrimonio: ${patrimonio.estados} estados, ${patrimonio.iglesias} iglesias y ${patrimonio.objetos} objetos nuevos; ${reales.iglesias} iglesias reales con foto en ${reales.estados} estados (${reales.creadas} nuevas).`,
  );
}

// E1-06: la semilla carga datos de varias iglesias; el alcance por iglesia se omite a propósito
sinAlcance('seed', main)
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
