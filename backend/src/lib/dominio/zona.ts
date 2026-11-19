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
