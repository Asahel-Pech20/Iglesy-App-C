// Fecha y hora de un instante en la zona horaria de una iglesia (RN-31: la hora de la misa es la
// hora local de su iglesia). Puro: solo usa Intl, sin leer el reloj.

export interface PartesLocales {
  anio: number;
  mes: number;
  dia: number;
  hora: string;
  minuto: string;
  segundo: string;
}

export function partesLocales(instante: Date, zonaHoraria: string): PartesLocales {
  const formato = new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const p: Record<string, string> = {};
  for (const parte of formato.formatToParts(instante)) p[parte.type] = parte.value;
  return {
    anio: Number(p['year']),
    mes: Number(p['month']),
    dia: Number(p['day']),
    hora: p['hour'] ?? '00',
    minuto: p['minute'] ?? '00',
    segundo: p['second'] ?? '00',
  };
}

/** Fecha «yyyy-MM-dd» y hora «HH:mm» de un instante en la zona horaria (para mostrarlos tal cual). */
export function fechaYHoraLocal(
  instante: Date,
  zonaHoraria: string,
): { fecha: string; hora: string } {
  const p = partesLocales(instante, zonaHoraria);
  const dos = (n: number) => String(n).padStart(2, '0');
  return { fecha: `${p.anio}-${dos(p.mes)}-${dos(p.dia)}`, hora: `${p.hora}:${p.minuto}` };
}

/** Milisegundos que la hora local de la zona se adelanta (o atrasa, si es negativo) respecto a UTC. */
export function desfaseDeZona(instanteMs: number, zonaHoraria: string): number {
  const p = partesLocales(new Date(instanteMs), zonaHoraria);
  const comoUtc = Date.UTC(
    p.anio,
    p.mes - 1,
    p.dia,
    Number(p.hora),
    Number(p.minuto),
    Number(p.segundo),
  );
  // El instante puede traer milisegundos que Intl no devuelve: se descartan para comparar
  return comoUtc - Math.floor(instanteMs / 1000) * 1000;
}

/** ¿La zona horaria existe en la base IANA? (por ejemplo «America/Mexico_City»). */
export function esZonaValida(zonaHoraria: string): boolean {
  try {
    new Intl.DateTimeFormat('es-MX', { timeZone: zonaHoraria });
    return true;
  } catch {
    return false;
  }
}

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DOCE_HORAS = 12 * 60 * 60 * 1000;

/**
 * Instante de una fecha «yyyy-MM-dd» y hora «HH:mm» en la hora local de una iglesia (RN-31, RNF-07).
 * Es la inversa de `fechaYHoraLocal`: sirve para guardar la hora de una misa o de un horario.
 * Días con cambio de horario (decisión técnica, E1-04):
 * - Hora que no existe (el reloj salta, p. ej. 02:30 al adelantar) → null; quien llama responde 422.
 * - Hora que ocurre dos veces (el reloj se atrasa) → la primera.
 * Fecha, hora o zona inválidas → null.
 */
export function instanteLocal(fecha: string, hora: string, zonaHoraria: string): Date | null {
  const f = FECHA.exec(fecha);
  const h = HORA.exec(hora);
  if (!f || !h || !esZonaValida(zonaHoraria)) return null;
  const comoUtc = Date.UTC(
    Number(f[1]),
    Number(f[2]) - 1,
    Number(f[3]),
    Number(h[1]),
    Number(h[2]),
  );
  // Desfases posibles ese día (antes y después de un cambio de horario)
  const desfases = new Set([
    desfaseDeZona(comoUtc - DOCE_HORAS, zonaHoraria),
    desfaseDeZona(comoUtc + DOCE_HORAS, zonaHoraria),
  ]);
  const candidatos = [...desfases]
    .map((desfase) => comoUtc - desfase)
    .filter((ms) => {
      const local = fechaYHoraLocal(new Date(ms), zonaHoraria);
      return local.fecha === fecha && local.hora === hora;
    });
  return candidatos.length > 0 ? new Date(Math.min(...candidatos)) : null;
}
