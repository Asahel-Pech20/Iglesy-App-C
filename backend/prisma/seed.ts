// Seed mínimo (B1-04): configuración de la iglesia y un usuario por rol. Idempotente (upsert).
// B2 extiende este archivo con datos de dominio (B2-12).
import { ROLES } from '../src/config/permisos';
import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/seguridad';
import { seedB2 } from './seed-b2';
import { seedB3 } from './seed-b3';
import { seedDonaciones } from './seed-b4';
import { seedDiezmo } from './seed-diezmo';

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

  await prisma.configuracionIglesia.upsert({
    where: { id: 1 },
    create: { id: 1, nombre: 'Mi Iglesia' },
    update: {},
  });

  // Iglesia inicial: la migración ya la crea con los datos de la configuración; en una BD nueva se crea aquí
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
  const { miembroIds, ministerios } = await seedB2();
  // B4: aportaciones de los últimos 12 meses
  const donaciones = await seedDonaciones(miembroIds);

  // Ecclesia: 4 semanas de misas y diezmos en 6 iglesias (datos ficticios)
  const diezmo = await seedDiezmo(iglesia.id, passwordHash);

  // B3: eventos (con asistencia), anuncios y un evento cancelado para la demo
  const b3 = await seedB3({ ministerios });

  console.warn(
    `Seed listo: configuración, iglesia inicial, ${ROLES.length} usuarios (<rol>@iglesia.local; admin@ es ADMIN_IGLESIA), ${miembroIds.length} miembros, ${ministerios.size} ministerios, ${b3.eventos} eventos, ${b3.asistencias} asistencias, ${b3.anuncios} anuncios, ${donaciones} aportaciones y ${diezmo.misas} misas con diezmo en ${diezmo.iglesias} iglesias.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
