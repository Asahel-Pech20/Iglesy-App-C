// E3-19: revisa en la BD los seeds mínimos de misas, servicios y pláticas (specs.md §12.8).
// Uso: npx tsx prisma/verificar-seed-misas.ts   (no escribe nada; sale con código 1 si algo falla)
import { prisma } from '../src/lib/prisma';
import {
  buscarChoque,
  semanasDeReferencia,
  type DiaSemana,
} from '../src/modules/misas/dominio/solapes';

const BASICOS = ['bautizo', 'primera comunión', 'confirmación', 'matrimonio'];

async function main() {
  const iglesias = await prisma.iglesia.findMany({
    where: { activa: true },
    select: {
      id: true,
      nombre: true,
      horariosMisa: { where: { activo: true }, select: { diaSemana: true } },
      servicios: { where: { activo: true }, select: { nombre: true } },
      platicas: { where: { activo: true }, select: { tipo: true } },
    },
  });
  const fallas: string[] = [];
  for (const i of iglesias) {
    const dias = new Set(i.horariosMisa.map((m) => m.diaSemana));
    if (dias.size < 7) fallas.push(`${i.nombre}: misas solo ${dias.size} días de la semana`);
    const servicios = new Set(i.servicios.map((s) => s.nombre.toLowerCase()));
    for (const b of BASICOS) if (!servicios.has(b)) fallas.push(`${i.nombre}: falta ${b}`);
    if (new Set(i.platicas.map((p) => p.tipo)).size < 2)
      fallas.push(`${i.nombre}: menos de 2 tipos de plática`);
  }

  const padres = await prisma.padre.findMany({
    where: { activo: true },
    select: { id: true, iglesias: { where: { activo: true }, select: { iglesiaId: true } } },
  });
  const enVarias = padres.filter((p) => p.iglesias.length > 1).length;
  if (padres.length < 15) fallas.push(`solo ${padres.length} padres`);
  if (enVarias < 3) fallas.push(`solo ${enVarias} padres en más de una iglesia`);

  // RN-26: ningún padre con dos misas que se empalmen, en ninguna iglesia ni zona horaria
  const horario = await prisma.horarioMisa.findMany({
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
  const misas = horario.map((m) => ({
    id: m.id,
    iglesiaId: m.iglesiaId,
    diaSemana: m.diaSemana as DiaSemana,
    hora: m.hora,
    duracionMin: m.duracionMin,
    zonaHoraria: m.iglesia.zonaHoraria,
    padreId: m.padreId,
  }));
  const semanas = semanasDeReferencia(new Date());
  let choques = 0;
  for (const m of misas) {
    const otras = misas.filter((o) => o.padreId === m.padreId && o.id !== m.id);
    if (buscarChoque(m, otras, semanas)) choques++;
  }
  if (choques > 0) fallas.push(`${choques} misas del horario chocan con otra del mismo padre`);

  const idiomas = await prisma.horarioMisa.groupBy({
    by: ['idioma'],
    where: { activo: true },
    _count: true,
  });
  console.warn(
    `iglesias abiertas: ${iglesias.length} · padres: ${padres.length} (${enVarias} en más de una) · ` +
      `misas del horario: ${misas.length} · choques: ${choques} · idiomas: ` +
      idiomas.map((x) => `${x.idioma} ${x._count}`).join(', '),
  );
  if (fallas.length) {
    console.error(fallas.join('\n'));
    process.exitCode = 1;
  } else {
    console.warn('Todos los mínimos de E3-19 se cumplen.');
  }
}

// Solo lee modelos que no son de la gestión interna: no necesita sinAlcance (ADR-0007)
main().finally(() => prisma.$disconnect());
