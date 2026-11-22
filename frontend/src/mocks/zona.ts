/** Fecha «aaaa-mm-dd» y hora «HH:mm» de un instante en una zona horaria (RN-31), como lo hace el backend. */
export function fechaYHoraLocal(instante: Date, zona: string): { fecha: string; hora: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: zona,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(instante)
      .map((x) => [x.type, x.value]),
  );
  return { fecha: `${p['year']}-${p['month']}-${p['day']}`, hora: `${p['hour']}:${p['minute']}` };
}
