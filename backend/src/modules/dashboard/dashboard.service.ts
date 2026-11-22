/**
 * Panel principal (B4-07, B4-08). Solo combina servicios de los módulos dueños:
 * miembros y ministerios (B2), eventos, asistencia y anuncios (B3), donaciones (B4).
 * `ingresos` se OMITE (no es null) si el rol no tiene `donaciones:leer` (AGENTS.md §1, regla 4).
 */
import { type RolUsuario, tienePermiso } from '../../config/permisos';
import { Prisma } from '../../generated/prisma/client';
import { iglesiaDelContexto } from '../../lib/contextoIglesia';
import { consultarDeIglesia } from '../../lib/prisma';
import * as anunciosService from '../anuncios/anuncios.service';
import * as asistenciaService from '../asistencia/asistencia.service';
import * as configuracionService from '../configuracion/configuracion.service';
import * as donacionesService from '../donaciones/donaciones.service';
import { fechaEnZona, finDiaEnZona, inicioDiaEnZona } from '../eventos/eventos.fechas';
import * as eventosService from '../eventos/eventos.service';
import * as miembrosService from '../miembros/miembros.service';
import * as ministeriosService from '../ministerios/ministerios.service';

export const CACHE_MS = 60_000;
/** Semanas de la gráfica de asistencia y meses de las gráficas mensuales. */
const SEMANAS = 12;
const MESES = 12;
const DIA_MS = 86_400_000;

const sumarDias = (fecha: string, dias: number) =>
  new Date(Date.parse(`${fecha}T00:00:00.000Z`) + dias * DIA_MS).toISOString().slice(0, 10);

/** Lunes de la semana ISO de `fecha`. */
function lunesDe(fecha: string) {
  const dia = new Date(`${fecha}T00:00:00.000Z`).getUTCDay();
  return sumarDias(fecha, -((dia + 6) % 7));
}

async function ingresos(hoy: string) {
  const desde = donacionesService.inicioMes(hoy, MESES - 1);
  const anterior = donacionesService.inicioMes(hoy, 1);
  const [porMes, mesAnterior] = await Promise.all([
    donacionesService.resumenEntre(desde, donacionesService.finMes(hoy), 'mes'),
    donacionesService.totalDelMes(Number(anterior.slice(0, 4)), Number(anterior.slice(5, 7))),
  ]);
  const mesActual = porMes.grupos.at(-1)?.total ?? '0.00';
  return {
    mesActual,
    mesAnterior,
    variacionPorcentual: donacionesService.variacionPorcentual(mesActual, mesAnterior),
    porMes: porMes.grupos.map((g) => ({ mes: g.clave, total: g.total, cantidad: g.cantidad })),
  };
}

export async function dashboard(rol: RolUsuario) {
  const { zonaHoraria } = await configuracionService.obtener();
  const hoy = fechaEnZona(new Date(), zonaHoraria);
  const inicioMesActual = donacionesService.inicioMes(hoy);
  const lunes = lunesDe(hoy);
  // Mes y semana completos en la zona horaria de la iglesia
  const rangoMes = [
    inicioDiaEnZona(inicioMesActual, zonaHoraria),
    finDiaEnZona(donacionesService.finMes(hoy), zonaHoraria),
  ] as const;
  const rangoSemana = [
    inicioDiaEnZona(lunes, zonaHoraria),
    finDiaEnZona(sumarDias(lunes, 6), zonaHoraria),
  ] as const;
  const verIngresos = tienePermiso(rol, 'donaciones:leer');

  const [
    miembrosActivos,
    totalMinisterios,
    asistenciasMes,
    asistenciasSemana,
    eventosProximos,
    anunciosImportantes,
    asistenciaSemanal,
    miembrosPorMinisterio,
    altasMiembrosPorMes,
    resumenIngresos,
  ] = await Promise.all([
    miembrosService.contarActivos(),
    ministeriosService.contarActivos(),
    asistenciaService.contarRegistradas(...rangoMes),
    asistenciaService.contarRegistradas(...rangoSemana),
    eventosService.proximos(5),
    anunciosService.vigentes({ soloImportantes: true, limit: 3 }),
    asistenciaService.resumenPorPeriodo('semanal', sumarDias(lunes, -7 * (SEMANAS - 1)), hoy),
    ministeriosService.participacionPorMinisterio(),
    miembrosService.altasPorMes(donacionesService.inicioMes(hoy, MESES - 1), hoy),
    verIngresos ? ingresos(hoy) : null,
  ]);

  return {
    miembrosActivos,
    totalMinisterios,
    asistenciasRegistradas: { mesActual: asistenciasMes, semanaActual: asistenciasSemana },
    eventosProximos,
    anunciosImportantes,
    graficas: {
      asistenciaSemanal: asistenciaSemanal.map((s) => ({
        semana: s.periodo,
        presentes: s.presentes,
        ausentes: s.ausentes,
        eventos: s.eventos,
      })),
      miembrosPorMinisterio,
      altasMiembrosPorMes,
    },
    ...(resumenIngresos && { ingresos: resumenIngresos }),
  };
}

export type Dashboard = Awaited<ReturnType<typeof dashboard>>;

/**
 * Huella de los datos que muestra el panel: cambia al registrar asistencia, crear o anular una
 * aportación, editar miembros, ministerios, eventos o anuncios. Una sola consulta barata.
 */
export async function huellaDatos() {
  // E1-06: la huella es de la iglesia del contexto (cada subconsulta filtra por ella)
  const [fila] = await consultarDeIglesia<{ huella: string }[]>(
    (iglesiaId) => Prisma.sql`
    SELECT concat_ws('|',
      (SELECT count(*) || ':' || coalesce(max("updatedAt")::text, '')
         FROM miembros WHERE "iglesiaId" = ${iglesiaId}),
      (SELECT count(*) || ':' || coalesce(max("updatedAt")::text, '')
         FROM ministerios WHERE "iglesiaId" = ${iglesiaId}),
      (SELECT count(*) FILTER (WHERE mm.activo) || ':' ||
              coalesce(max(greatest(mm."fechaUnion", coalesce(mm."fechaSalida", mm."fechaUnion")))::text, '')
         FROM miembro_ministerios mm JOIN ministerios m ON m.id = mm."ministerioId"
         WHERE m."iglesiaId" = ${iglesiaId}),
      (SELECT count(*) || ':' || coalesce(max("updatedAt")::text, '')
         FROM eventos WHERE "iglesiaId" = ${iglesiaId}),
      (SELECT count(*) || ':' || coalesce(max(a."updatedAt")::text, '')
         FROM asistencias a JOIN eventos e ON e.id = a."eventoId" WHERE e."iglesiaId" = ${iglesiaId}),
      (SELECT count(*) || ':' || coalesce(max("updatedAt")::text, '')
         FROM anuncios WHERE "iglesiaId" = ${iglesiaId}),
      (SELECT count(*) || ':' || coalesce(max("updatedAt")::text, '')
         FROM donaciones WHERE "iglesiaId" = ${iglesiaId})
    ) AS huella`,
  );
  return fila?.huella ?? '';
}

/**
 * Cache en memoria por iglesia y vista (con / sin ingresos), una por instancia de la app.
 * E1-06: la clave lleva la iglesia; sin ella, una iglesia recibiría el panel de otra. Una entrada vale
 * 60 s y solo mientras la huella de los datos no cambie: registrar asistencia o crear/anular una
 * aportación la invalida al instante sin tocar los módulos de B2/B3.
 */
export function crearCacheDashboard(duracionMs = CACHE_MS) {
  const guardadas = new Map<
    `${string}:${'con-ingresos' | 'sin-ingresos'}`,
    { datos: Dashboard; huella: string; expira: number }
  >();
  return async function obtenerDashboard(rol: RolUsuario) {
    const vista = tienePermiso(rol, 'donaciones:leer') ? 'con-ingresos' : 'sin-ingresos';
    const clave = `${iglesiaDelContexto('dashboard')}:${vista}` as const;
    const [huella, ahora] = [await huellaDatos(), Date.now()];
    const guardada = guardadas.get(clave);
    if (guardada && guardada.expira > ahora && guardada.huella === huella) return guardada.datos;
    const datos = await dashboard(rol);
    guardadas.set(clave, { datos, huella, expira: ahora + duracionMs });
    return datos;
  };
}
